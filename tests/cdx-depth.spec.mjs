import { test, expect } from "@playwright/test";
import { guideBetween, sparseClipDepth } from "../src/depth/clip.js";
import { validatePhoto } from "../src/depth/engine.js";

// These small numerical fixtures check behavior that independent-frame interpolation loses.
test("color guidance follows a translating edge instead of making two faded edges", () => {
  const w = 18,
    h = 7;
  const scene = (shift) => {
    const d = new Float32Array(w * h),
      g = new Float32Array(w * h * 3);
    for (let y = 0; y < h; y++)
      for (let x = 0; x < w; x++) {
        const inside = x >= 5 + shift && x < 10 + shift;
        d[y * w + x] = inside ? 9 : 1;
        g.set(inside ? [0.9, 0.1, 0.1] : [0.1, 0.1, 0.9], (y * w + x) * 3);
      }
    return { w, h, d, g };
  };
  const a = scene(0),
    b = scene(2),
    target = scene(1);
  const guided = guideBetween(a, b, a.g, b.g, target.g, 0.5);
  let error = 0,
    plain = 0;
  for (let i = 0; i < w * h; i++) {
    error += Math.abs(guided.d[i] - target.d[i]);
    plain += Math.abs((a.d[i] + b.d[i]) / 2 - target.d[i]);
  }
  expect(error).toBeLessThan(plain * 0.2);
});

test("a skipped scene change gets its own model result", async () => {
  const w = 14,
    h = 14;
  const frame = (v) => ({ data: new Uint8Array(w * h * 4).fill(v) });
  let runs = 0;
  const engine = {
    async estimate() {
      runs++;
      return { w, h, d: new Float32Array(w * h).fill(runs), ms: 1 };
    },
  };
  const r = await sparseClipDepth(engine, [frame(0), frame(255), frame(0)], w, h);
  expect(r.modelRuns).toBe(3);
  expect(r.depths[1].guided).toBeUndefined();
});

test("incomplete pictures fail before starting model work", () => {
  expect(() => validatePhoto({ w: 14, h: 14, data: new Uint8Array(4) })).toThrow(/complete RGBA/);
});

test("the real worker answers concurrent photo and legacy frame requests and keeps input bytes", async ({
  page,
}) => {
  await page.goto("/tests/");
  const r = await page.evaluate(async () => {
    const { createDepthClient } = await import("/src/depth/client.js");
    const { decodePhoto } = await import("/src/packs/photo-3d.js");
    const { resampleArea } = await import("/src/packs/photo-3d-core.js");
    const c = createDepthClient();
    try {
      const photo = await decodePhoto(
        await (await fetch("/assets/toys/photo-3d/forest.jpg")).blob(),
      );
      const px = resampleArea(photo, 196, 126);
      const data = new Uint8Array(196 * 126 * 4);
      for (let i = 0; i < px.length / 3; i++) {
        for (let k = 0; k < 3; k++) data[i * 4 + k] = Math.round(255 * px[i * 3 + k]);
        data[i * 4 + 3] = 255;
      }
      const statuses = [];
      const [a, b] = await Promise.all([
        c.request("photo", { ...photo, options: { side: 196 } }, (s) => statuses.push(s)),
        c.request("frame", { w: 196, h: 126, data }),
      ]);
      const invalid = await c.request("frame", { w: 1, h: 1, data: new Uint8Array(4) }).then(
        () => false,
        () => true,
      );
      const badConfig = await c
        .request("init", { options: { modelUrl: "/missing-model.onnx" } })
        .then(
          () => false,
          () => true,
        );
      const retry = await c.request("frame", { w: 196, h: 126, data });
      return {
        a: [a.w, a.h],
        b: [b.w, b.h],
        ids: [a.id, b.id],
        finite: a.d.every(Number.isFinite) && b.d.every(Number.isFinite),
        range: Math.max(...a.d) - Math.min(...a.d),
        bytes: photo.data.byteLength,
        statuses,
        invalid,
        badConfig,
        retry: retry.d.length,
      };
    } finally {
      c.dispose();
    }
  });
  expect(r.a).toEqual([196, 126]);
  expect(r.b).toEqual([196, 126]);
  expect(new Set(r.ids).size).toBe(2);
  expect(r.finite).toBe(true);
  expect(r.range).toBeGreaterThan(0.01);
  expect(r.bytes).toBeGreaterThan(100000);
  expect(r.statuses.some((s) => s.includes("%"))).toBe(true);
  expect(r.invalid).toBe(true);
  expect(r.badConfig).toBe(true);
  expect(r.retry).toBe(196 * 126);
});

test("WebGPU missing uses real WASM inference; extra threads stay disabled without isolation", async ({
  page,
}) => {
  await page.route("**/src/live/depth-worker.js", async (route) => {
    const response = await route.fetch();
    await route.fulfill({
      response,
      body:
        'Object.defineProperty(navigator, "gpu", { value: undefined });\n' +
        (await response.text()),
    });
  });
  await page.goto("/tests/");
  const r = await page.evaluate(async () => {
    const { createDepthClient } = await import("/src/depth/client.js");
    const c = createDepthClient();
    try {
      // Only hardware availability is mocked; the WASM model and inference are real.
      const meta = await c.request("init", {
        options: { provider: "webgpu", runtimeUrl: "/vendor/onnxruntime-web/", threads: 4 },
      });
      const r = await c.request("frame", {
        w: 28,
        h: 28,
        data: new Uint8Array(28 * 28 * 4).fill(180),
      });
      return {
        provider: meta.provider,
        fallback: meta.fallback,
        threads: meta.threads,
        finite: r.d.every(Number.isFinite),
      };
    } finally {
      c.dispose();
    }
  });
  expect(r.provider).toBe("wasm");
  expect(r.fallback).toBeTruthy();
  expect(r.threads).toBe(1);
  expect(r.finite).toBe(true);
});

for (const rate of [1, 4]) {
  test(`Photo to 3D depth stays responsive at ${rate}x CPU throttle with real inference`, async ({
    page,
  }) => {
    await page.goto("/tests/");
    const cdp = await page.context().newCDPSession(page);
    await cdp.send("Emulation.setCPUThrottlingRate", { rate });
    const r = await page.evaluate(async () => {
      const dep = await import("/src/packs/photo-3d-depth.js");
      const { decodePhoto } = await import("/src/packs/photo-3d.js");
      const photo = await decodePhoto(
        await (await fetch("/assets/toys/photo-3d/forest.jpg")).blob(),
      );
      const original = photo.data.byteLength;
      // End the decode/import task before measuring inference; those caller-owned steps have
      // already finished and can otherwise be included in the first Long Tasks entry.
      await new Promise((resolve) => setTimeout(resolve, 0));
      const tasks = [];
      const observer = new PerformanceObserver((list) =>
        tasks.push(...list.getEntries().map((e) => e.duration)),
      );
      observer.observe({ type: "longtask" });
      let ticks = 0;
      const timer = setInterval(() => ticks++, 16);
      const statuses = [];
      const depth = await dep.estimateDepth(photo, (s) => statuses.push(s));
      await new Promise((r) => setTimeout(r, 100));
      clearInterval(timer);
      observer.disconnect();
      // Also check the old { ort, s } return and raw Tensor session call at a small input size.
      const { ort, s } = await dep.loadDepthModel();
      const out = await s.run({
        [s.inputNames[0]]: new ort.Tensor("float32", new Float32Array(3 * 28 * 28), [1, 3, 28, 28]),
      });
      return {
        w: depth.w,
        h: depth.h,
        n: depth.d.length,
        finite: depth.d.every(Number.isFinite),
        original,
        bytes: photo.data.byteLength,
        ticks,
        tasks,
        statuses,
        raw: out[s.outputNames[0]].dims,
      };
    });
    expect([r.w, r.h]).toEqual([518, 350]);
    expect(r.n).toBe(518 * 350);
    expect(r.finite).toBe(true);
    expect(r.bytes).toBe(r.original);
    expect(r.ticks).toBeGreaterThan(10);
    expect(Math.max(0, ...r.tasks)).toBeLessThanOrEqual(200);
    expect(r.statuses.some((s) => s.includes("Working out"))).toBe(true);
    expect(r.raw.slice(-2)).toEqual([28, 28]);
  });
}

test("a failed GPU runtime cannot poison the real WASM fallback", async ({ page }) => {
  await page.route("**/src/live/depth-worker.js", async (route) => {
    const response = await route.fetch();
    await route.fulfill({
      response,
      body:
        'Object.defineProperty(navigator, "gpu", { value: { requestAdapter: async () => ({}) } });\n' +
        (await response.text()),
    });
  });
  await page.route("**/ort.webgpu.min.mjs", (route) =>
    route.fulfill({
      contentType: "text/javascript",
      body: 'export const env={wasm:{}}; export const InferenceSession={create:async()=>{throw new Error("GPU initialization failed");}};',
    }),
  );
  await page.goto("/tests/");
  const r = await page.evaluate(async () => {
    const { createDepthClient } = await import("/src/depth/client.js");
    const c = createDepthClient();
    try {
      const meta = await c.request("init", { options: { provider: "webgpu" } });
      const d = await c.request("frame", {
        w: 28,
        h: 28,
        data: new Uint8Array(28 * 28 * 4).fill(180),
      });
      return {
        provider: meta.provider,
        fallback: meta.fallback,
        finite: d.d.every(Number.isFinite),
      };
    } finally {
      c.dispose();
    }
  });
  expect(r.provider).toBe("wasm");
  expect(r.fallback).toContain("GPU initialization failed");
  expect(r.finite).toBe(true);
});

test("a failed first model download is retried by the same worker", async ({ page, context }) => {
  let first = true;
  await context.route("**/depth-anything-v2-small/model_quantized.onnx", async (route) => {
    if (first) {
      first = false;
      await route.fulfill({ status: 503, body: "Unavailable" });
    } else await route.continue();
  });
  await page.goto("/tests/");
  const r = await page.evaluate(async () => {
    const { createDepthClient } = await import("/src/depth/client.js");
    const c = createDepthClient();
    const frame = { w: 28, h: 28, data: new Uint8Array(28 * 28 * 4).fill(180) };
    try {
      const failed = await c.request("frame", frame).then(
        () => false,
        () => true,
      );
      const d = await c.request("frame", frame);
      return { failed, finite: d.d.every(Number.isFinite) };
    } finally {
      c.dispose();
    }
  });
  expect(r.failed).toBe(true);
  expect(r.finite).toBe(true);
});

test("a stalled accelerated run switches to WASM and later frames reuse it", async ({ page }) => {
  await page.route("**/src/live/depth-worker.js", async (route) => {
    const response = await route.fetch();
    await route.fulfill({
      response,
      body:
        'Object.defineProperty(navigator, "gpu", { value: { requestAdapter: async () => ({}) } });\n' +
        (await response.text()),
    });
  });
  await page.route("**/ort.webgpu.min.mjs", (route) =>
    route.fulfill({
      contentType: "text/javascript",
      body: `import * as wasm from "/vendor/onnxruntime-web/ort.wasm.min.mjs";
    export const Tensor=wasm.Tensor, env=wasm.env;
    export const InferenceSession={create:async()=>({inputNames:["pixel_values"],outputNames:["predicted_depth"],run:()=>new Promise(()=>{}),release:async()=>{}})};`,
    }),
  );
  await page.goto("/tests/");
  const r = await page.evaluate(async () => {
    const { createDepthClient } = await import("/src/depth/client.js");
    const c = createDepthClient();
    const frame = { w: 28, h: 28, data: new Uint8Array(28 * 28 * 4).fill(180) };
    try {
      await c.request("init", { options: { provider: "webgpu", providerTimeoutMs: 50 } });
      const a = await c.request("frame", frame),
        b = await c.request("frame", frame);
      return {
        providers: [a.provider, b.provider],
        fallback: a.fallback,
        finite: a.d.every(Number.isFinite) && b.d.every(Number.isFinite),
      };
    } finally {
      c.dispose();
    }
  });
  expect(r.providers).toEqual(["wasm", "wasm"]);
  expect(r.fallback).toContain("took too long");
  expect(r.finite).toBe(true);
});
