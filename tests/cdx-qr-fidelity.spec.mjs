import { test, expect } from "@playwright/test";
import { createHash } from "node:crypto";
import { makeWoven, tidy, rasterize } from "../src/qr-craft/picture.js";
import { loadPicture, read } from "../tools/qrc-picture.mjs";
import { fidelity } from "../tools/picture-qr-fidelity/metrics.mjs";
import { readZxingCpp } from "../tools/qrs-study/readers.mjs";
import {
  rasterSticker,
  conditionImage,
  CONDITIONS,
  circleCrop,
} from "../tools/picture-qr-fidelity/captures.mjs";
const OPTIONS = {
  text: "https://ryanjosephkamp.github.io/splashery/",
  level: "H",
  size: "more",
  center: "small",
  style: "color",
  contrast: 0.5,
};
const pic = loadPicture("assets/toys/photo-3d/wildflowers.jpg");

test("Most detail preserves more of the source picture at phone and print size", () => {
  const standard = makeWoven(pic, OPTIONS, read),
    detail = makeWoven(pic, { ...OPTIONS, fidelity: "detail" }, read);
  const before = fidelity(pic, standard),
    after = fidelity(pic, detail);
  for (const scale of ["phone", "print"])
    expect(after[scale].ssim).toBeGreaterThan(before[scale].ssim + 0.03);
});

test("Most detail decodes with both independent readers under blur, tilt, and brightness", async () => {
  const w = makeWoven(pic, { ...OPTIONS, fidelity: "detail" }, read);
  for (const ppm of [8, 4]) {
    const sticker = rasterSticker(w, pic, "square", ppm);
    for (const c of CONDITIONS.filter((c) => c.ppm === ppm)) {
      const img = conditionImage(sticker, w, "square", c);
      expect(read(img.data, img.width, img.height), c.id + " jsQR").toBe(OPTIONS.text);
      expect(await readZxingCpp(img), c.id + " zxing-cpp").toBe(OPTIONS.text);
    }
  }
});

test("Legacy options retain the standard rendering and the saved shape-independent settings", () => {
  expect(tidy({ ...OPTIONS, fidelity: "unknown" }).fidelity).toBe("standard");
  expect(tidy({ ...OPTIONS, fidelity: "detail" }).fidelity).toBe("detail");
  expect(tidy({ ...OPTIONS, fidelity: "detail", style: "bw" }).fidelity).toBe("standard");
  const a = makeWoven(pic, OPTIONS),
    b = makeWoven(pic, { ...OPTIONS, fidelity: "standard" });
  expect(Array.from(b.cells)).toEqual(Array.from(a.cells));
});

test("Rejecting a Small candidate keeps the corresponding Medium repair available", async () => {
  const { makeWovenAsync, renderingKey } = await import("../src/qr-craft/picture.js");
  const options = {
    ...OPTIONS,
    fidelity: "detail",
    texture: "tiles",
    channel: "weighted",
    preferContinuous: true,
  };
  const small = await makeWovenAsync(pic, options, async () => ({ ok: true }));
  const visited = [];
  const medium = await makeWovenAsync(
    pic,
    { ...options, center: "medium", rejected: [renderingKey(small)] },
    async (woven) => {
      visited.push(woven);
      return { ok: true };
    },
  );
  expect(medium.code.version).toBe(small.code.version);
  expect(medium.code.mask).toBe(small.code.mask);
  expect(medium.k).not.toBe(small.k);
  expect(visited[0].rendering.edge).toBe(small.rendering.edge);
  expect(renderingKey({ ...small, code: { ...small.code, ecc: "Q" } })).not.toBe(
    renderingKey(small),
  );
});

test("The standard weave and camera rasters remain byte-identical to main", () => {
  const w = makeWoven(pic, OPTIONS),
    hash = (data) => createHash("sha256").update(data).digest("hex");
  expect(hash(Buffer.from(w.cells.buffer))).toBe(
    "1699d5c97dc7f5d8014a05a641e5cbb2e9ce5a69b3db0fcdea5003661ac6d690",
  );
  for (const [ppm, blur, expected] of [
    [8, 0.2, "9a1ad445f3964cb991c6dcbb916b089f60ba9715487f9c32b4152e5a28981d1c"],
    [4, 0.3, "deb08370879ef340b8c21c4ad292fe9daf10e9249b08d0f5f301c26c6d777c4e"],
    [3.7, 0.2, "0bf74fd5235cad13606d0c6e533d127f8b6d034e84522c189d1403f6fec681ed"],
  ])
    expect(hash(rasterize(w, ppm, { blur }).data), `${ppm}px, blur ${blur}`).toBe(expected);
});

test("Most detail validates the complete Circle frame before returning a code", async () => {
  const text = "https://example.org/notes/7?q=circlecirclecirclecirclecirclecircle&page=6";
  const sample = loadPicture("assets/toys/photo-3d/ai/farm.jpg");
  const options = { ...OPTIONS, text, fidelity: "detail", shape: "circle" };
  const w = makeWoven(sample, options, read);
  expect(w.detailCheck?.ok).toBe(true);
  for (const ppm of [8, 4]) {
    const sticker = rasterSticker(w, sample, "circle", ppm);
    for (const c of CONDITIONS.filter((c) => c.ppm === ppm)) {
      const img = conditionImage(sticker, w, "circle", c);
      expect(read(img.data, img.width, img.height), c.id + " jsQR").toBe(text);
      expect(await readZxingCpp(img), c.id + " zxing-cpp").toBe(text);
    }
  }
});

test("Most detail keeps the source colors in the Circle picture band", async () => {
  const { detailFrame } = await import("../src/qr-craft/frame.js");
  const { shapeHalf } = await import("../src/qr/circle.js");
  const data = new Float32Array(32 * 32 * 3);
  for (let i = 0; i < 32 * 32; i++) data.set([0.12, 0.3, 0.15], i * 3);
  const source = { w: 32, h: 32, data },
    w = makeWoven(source, { ...OPTIONS, fidelity: "detail", shape: "circle" });
  const H = shapeHalf(w.code, "circle"),
    x = (w.code.size / 2 + 4 + H - 0.65) / 2,
    total = 2 * (H + 1),
    img = detailFrame(w, source, 8, "circle");
  const px = Math.floor((0.5 + x / total) * img.width),
    py = Math.floor(img.height / 2),
    q = (py * img.width + px) * 4;
  expect(Array.from(img.data.slice(q, q + 3))).toEqual([31, 77, 38]);
});

test("Most detail checks its actual phone render before uncovering it", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/?renderer=webgl2&adapt=off&profile=low&labs=1");
  await page.waitForSelector("body[data-ready='true']", { timeout: 180000 });
  await page.evaluate(async () => {
    const a = window.__splashery.app;
    await a.chooseToy("qr-picture");
    await a.setToyOptions({
      text: "https://example.org/a/1",
      fidelity: "detail",
      shape: "circle",
      picture: "ai-farm",
      size: "more",
      level: "H",
      center: "small",
      contrast: 0.5,
    });
  });
  await page.waitForFunction(
    () => {
      const { app: a, qrCraft: q } = window.__splashery,
        p = q.picture();
      return (
        !a.busy &&
        p.options.fidelity === "detail" &&
        p.check?.stage?.length === 2 &&
        !a.player.stage.coverDepth &&
        !document.querySelector(".stage-cover")
      );
    },
    null,
    { timeout: 180000 },
  );
  const { check, rendering } = await page.evaluate(() => {
    const p = window.__splashery.qrCraft.picture();
    return { check: p.check, rendering: p.woven.rendering };
  });
  expect(rendering).toMatchObject({ texture: "tiles", channel: "weighted", validation: "capture" });
  expect(check.ok).toBe(true);
  expect(check.stress?.ok).toBe(true);
  expect(check.stress?.readers).toEqual(["jsqr", "zxingcpp"]);
  expect(check.detail?.layoutChecked).toBe(true);
  expect(check.stage.every((s) => s.ok)).toBe(true);
});

test("A previous code cannot start a scan while the next picture is still preparing", async ({
  page,
}) => {
  await page.goto("/?renderer=webgl2&adapt=off&profile=low&labs=1");
  await page.waitForSelector("body[data-ready='true']", { timeout: 180000 });
  const result = await page.evaluate(async () => {
    const { RECIPES } = await import("/src/packs/qr-craft.js"),
      { app: a, qrCraft: q } = window.__splashery;
    q.autoCheck = false;
    await a.chooseToy("qr-picture");
    const recipe = RECIPES["qr-picture"],
      prepare = recipe.prepare;
    let entered, finish;
    const waiting = new Promise((resolve) => (entered = resolve)),
      gate = new Promise((resolve) => (finish = resolve));
    recipe.prepare = async (options) => {
      entered();
      await gate;
      return prepare(options);
    };
    const building = a.setToyOptions({
      text: "https://example.org/a/1",
      fidelity: "detail",
      shape: "circle",
      picture: "ai-farm",
      size: "more",
      level: "H",
      center: "small",
      contrast: 0.5,
    });
    await waiting;
    const before = q.picture().check,
      stale = q.checkPicture();
    const settled = await Promise.race([
      stale.then(() => true),
      new Promise((resolve) => setTimeout(() => resolve(false), 100)),
    ]);
    const unchanged = q.picture().check === before;
    recipe.prepare = prepare;
    finish();
    await building;
    await stale;
    await q.checkPicture();
    return { settled, unchanged, options: q.picture().options, check: q.picture().check };
  });
  expect(result.settled).toBe(true);
  expect(result.unchanged).toBe(true);
  expect(result.options).toMatchObject({ fidelity: "detail", text: "https://example.org/a/1" });
  expect(result.check.ok).toBe(true);
  expect(result.check.stress.ok).toBe(true);
});

test("A small blurred yaw of a pale picture passes every actual reader condition", async ({
  page,
}) => {
  const text = "https://example.org/gallery/6?q=circlecirclecirclecirclecircle&page=5";
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/?renderer=webgl2&adapt=off&profile=low&labs=1");
  await page.waitForSelector("body[data-ready='true']", { timeout: 180000 });
  await page.evaluate(async (text) => {
    await import("/src/packs/qr-craft.js");
    const { app: a, qrCraft: q } = window.__splashery;
    q.autoCheck = false;
    await a.chooseToy("qr-picture");
    q.autoCheck = true;
    await a.setToyOptions({
      text,
      fidelity: "detail",
      shape: "square",
      picture: "cdx-qr-ai-cactus",
      size: "more",
      level: "H",
      center: "small",
      contrast: 0.5,
      style: "color",
    });
  }, text);
  await page.waitForFunction(
    () => {
      const { app: a, qrCraft: q } = window.__splashery,
        p = q.picture();
      return !a.busy && p.check?.stage?.length === 2 && !p.checking && !a.player.stage.coverDepth;
    },
    null,
    { timeout: 180000 },
  );
  const result = await page.evaluate(async () => {
    const q = window.__splashery.qrCraft,
      p = q.picture();
    const { shapeHalf } = await import("/src/qr/circle.js");
    return {
      shot: q.lastShot(),
      check: p.check,
      codeSize: p.woven.code.size,
      modules: 2 * (shapeHalf(p.woven.code, "square") + 1),
    };
  });
  expect(result.check.ok).toBe(true);
  expect(result.check.stress.ok).toBe(true);
  const { qualifyCapture } = await import("../tools/picture-qr-fidelity/qualify.mjs");
  const independent = await qualifyCapture(
    loadPicture("assets/toys/qr-picture/codex/cdx-qr-ai-cactus.jpg"),
    result,
    text,
    "square",
  );
  expect(independent.scans).toHaveLength(24);
  expect(independent.scans.every((scan) => scan.jsqr && scan.zxingcpp)).toBe(true);
});

test("Repeated actual finder failures try another method while retaining every reader check", async ({
  page,
}) => {
  const text = "https://example.org/workshop/4?q=circlecirclecircle&page=3";
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/?renderer=webgl2&adapt=off&profile=low&labs=1");
  await page.waitForSelector("body[data-ready='true']", { timeout: 180000 });
  await page.evaluate(async (text) => {
    await import("/src/packs/qr-craft.js");
    const { app: a, qrCraft: q } = window.__splashery;
    q.autoCheck = false;
    await a.chooseToy("qr-picture");
    q.autoCheck = true;
    await a.setToyOptions({
      text,
      fidelity: "detail",
      shape: "circle",
      picture: "cdx-qr-ai-fern",
      size: "more",
      level: "H",
      center: "small",
      contrast: 0.5,
      style: "color",
    });
  }, text);
  await page.waitForFunction(
    () => {
      const { app: a, qrCraft: q } = window.__splashery,
        p = q.picture();
      return !a.busy && p.check?.stage?.length === 2 && !p.checking && !a.player.stage.coverDepth;
    },
    null,
    { timeout: 180000 },
  );
  const result = await page.evaluate(async () => {
    const q = window.__splashery.qrCraft,
      p = q.picture();
    const { shapeHalf } = await import("/src/qr/circle.js");
    return {
      shot: q.lastShot(),
      check: p.check,
      rejected: p.rejected,
      codeSize: p.woven.code.size,
      modules: 2 * (shapeHalf(p.woven.code, "circle") + 1),
    };
  });
  expect(
    result.rejected.filter((key) => JSON.parse(key)[0] === "continuous").length,
  ).toBeLessThanOrEqual(2);
  expect(result.check.ok).toBe(true);
  expect(result.check.stress.ok).toBe(true);
  const { qualifyCapture } = await import("../tools/picture-qr-fidelity/qualify.mjs");
  const independent = await qualifyCapture(
    loadPicture("assets/toys/qr-picture/codex/cdx-qr-ai-fern.jpg"),
    result,
    text,
    "circle",
  );
  expect(independent.scans).toHaveLength(24);
  expect(independent.scans.every((scan) => scan.jsqr && scan.zxingcpp)).toBe(true);
});

test("A failed reader load settles the scan cover with a failure verdict", async ({ page }) => {
  await page.route("**/vendor/jsqr/jsQR.js", (route) => route.abort());
  const errors = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await page.goto("/?renderer=webgl2&adapt=off&profile=low&labs=1");
  await page.waitForSelector("body[data-ready='true']", { timeout: 180000 });
  await page.evaluate(async () => {
    await import("/src/packs/qr-craft.js");
    const { app: a, qrCraft: q } = window.__splashery;
    q.autoCheck = false;
    await a.chooseToy("qr-picture");
    q.autoCheck = true;
    await a.setToyOptions({ fidelity: "detail", picture: "ai-farm", size: "fit" });
  });
  await page.waitForFunction(() => {
    const { app: a, qrCraft: q } = window.__splashery;
    return (
      q.picture().check?.error &&
      !q.picture().checking &&
      !a.player.stage.coverDepth &&
      !document.querySelector(".stage-cover")
    );
  });
  await expect(page.locator("#qrc-verdict")).toContainText("The scan check couldn't finish");
  expect(await page.evaluate(() => window.__splashery.qrCraft.picture().check.ok)).toBe(false);
  expect(errors).toEqual([]);
});

test("A missing uploaded picture cannot reuse a previous sample's allocation cap", async ({
  page,
}) => {
  await page.goto("/?renderer=webgl2&adapt=off&profile=low&labs=1");
  await page.waitForSelector("body[data-ready='true']", { timeout: 180000 });
  const result = await page.evaluate(async () => {
    const { RECIPES } = await import("/src/packs/qr-craft.js"),
      { app: a, qrCraft: q } = window.__splashery;
    q.autoCheck = false;
    await a.chooseToy("qr-picture");
    await a.setToyOptions({
      fidelity: "detail",
      picture: "ai-farm",
      size: "fit",
      text: "https://example.org/a/1",
    });
    const sampleCount = a.player.proc.ctx.kit.count;
    await a.setToyOptions({ picture: "own", text: "https://example.org/" + "missing".repeat(18) });
    return {
      sampleCount,
      count: a.player.proc.ctx.kit.count,
      budget: a.player.splatBudget(RECIPES["qr-picture"].density ?? 1),
      error: q.picture().error,
    };
  });
  expect(result.sampleCount).toBeLessThan(result.budget);
  expect(result.count).toBe(result.budget);
  expect(result.error).toContain("isn't on this device");
});

test("Most detail also improves fine leaf detail at phone and print size", () => {
  const source = loadPicture("assets/toys/qr-picture/codex/cdx-qr-ai-fern.jpg");
  const options = {
    ...OPTIONS,
    text: "https://example.org/notes/7?q=circlecirclecirclecirclecirclecircle&page=6",
  };
  const before = fidelity(source, makeWoven(source, options, read)),
    after = fidelity(source, makeWoven(source, { ...options, fidelity: "detail" }, read));
  for (const scale of ["phone", "print"])
    expect(after[scale].ssim).toBeGreaterThan(before[scale].ssim + 0.01);
});

test("Parallel camera groups retain every strict layout and camera condition", async () => {
  const { checkStrict } = await import("../src/qr-craft/picture.js");
  const { checkCapturedViews } = await import("../src/qr-craft/views.js");
  const w = makeWoven(pic, OPTIONS);
  let layouts = 0,
    captures = 0;
  const image = rasterize(w, 4);
  for (const blur of [0.2, 0.3])
    for (const views of [
      [0, 1, 2],
      [3, 4, 5],
    ]) {
      const only = { blur, views };
      if (views[0] === 0)
        expect(
          checkStrict(
            w,
            () => {
              layouts++;
              return w.code.text;
            },
            only,
          ),
        ).toBe(true);
      expect(
        checkCapturedViews(
          image,
          w.code.size + 8,
          () => {
            captures++;
            return w.code.text;
          },
          w.code.text,
          only,
        ).ok,
      ).toBe(true);
    }
  expect(layouts).toBe(4);
  expect(captures).toBe(24);
  const { strictFrames, partitionFrames } = await import("../src/qr-craft/scan-pool.js");
  const { cameraFrames, checkPreparedFrames } = await import("../src/qr-craft/views.js");
  const grouped = partitionFrames(cameraFrames(() => image));
  expect(new Set(grouped.flat().map((f) => `${f.ppm}/${f.blur}/${f.view}`)).size).toBe(24);
  let transferredReads = 0;
  const buffers = new Set();
  for (const group of grouped) {
    for (const buffer of new Set(group.map((f) => f.image.data.buffer))) {
      expect(buffers.has(buffer)).toBe(false);
      buffers.add(buffer);
    }
    const copies = structuredClone(group, {
      transfer: [...new Set(group.map((f) => f.image.data.buffer))],
    });
    expect(
      checkPreparedFrames(
        copies,
        () => {
          transferredReads++;
          return w.code.text;
        },
        w.code.text,
      ).ok,
    ).toBe(true);
  }
  expect(transferredReads).toBe(24);
  const { gaussBlur } = await import("../src/qr-craft/picture.js");
  const frames = strictFrames(w);
  expect(frames.map((f) => [f.ppm, f.blur])).toEqual([
    [8, 0.2],
    [4, 0.2],
    [8, 0.3],
    [4, 0.3],
  ]);
  for (const f of frames) {
    const image = f.image.data.slice();
    gaussBlur(image, f.image.width, f.image.height, f.ppm * f.blur);
    expect(
      Buffer.compare(Buffer.from(image), Buffer.from(rasterize(w, f.ppm, { blur: f.blur }).data)),
    ).toBe(0);
  }
});

test("Captured-detail predictions keep every check and run perspective and lighting concurrently", async () => {
  const { validateDetail } = await import("../src/qr-craft/scan-pool.js");
  const previous = globalThis.Worker,
    workers = [],
    calls = [];
  let active = 0,
    peak = 0;
  globalThis.Worker = class {
    constructor() {
      this.queue = [];
      this.running = false;
      workers.push(this);
    }
    postMessage(job) {
      this.queue.push(job);
      this.runNext();
    }
    runNext() {
      if (this.running || !this.queue.length) return;
      this.running = true;
      const job = this.queue.shift();
      const frame = job.frames[0];
      calls.push(`${frame.ppm}/${frame.blur}/${frame.view}`);
      if (frame.view) peak = Math.max(peak, ++active);
      setTimeout(() => {
        if (frame.view) active--;
        this.onmessage({ data: { id: job.id, result: { ok: true } } });
        this.running = false;
        this.runNext();
      }, 10);
    }
    terminate() {}
  };
  try {
    const w = makeWoven(pic, {
      ...OPTIONS,
      fidelity: "detail",
      texture: "tiles",
      preferContinuous: true,
      captureValidation: true,
      channel: "weighted",
    });
    expect(await validateDetail(w, pic, "square", read)).toMatchObject({
      ok: true,
      layoutChecked: true,
      cameraDeferred: true,
    });
    expect(calls.sort()).toEqual(
      [
        "4/0.2/0",
        "4/0.3/0",
        "4/0.3/0",
        "8/0.2/0",
        "8/0.3/0",
        "8/0.2/1",
        "8/0.2/2",
        "4/0.3/1",
        "4/0.3/5",
        "8/0.3/1",
        "8/0.3/5",
      ].sort(),
    );
    expect(peak).toBe(Math.min(6, workers.length));
  } finally {
    workers[0]?.onerror();
    globalThis.Worker = previous;
  }
});

test("A failed worker rebuilds transferred pixels and repeats every camera check locally", async () => {
  const { validateCapture } = await import("../src/qr-craft/scan-pool.js");
  const original = globalThis.Worker;
  let terminated = 0,
    reads = 0;
  globalThis.Worker = class {
    postMessage(message, transfer) {
      structuredClone(message, { transfer });
      queueMicrotask(() => this.onerror?.(new Error("Worker failed after transfer")));
    }
    terminate() {
      terminated++;
    }
  };
  try {
    const w = makeWoven(pic, OPTIONS),
      image = rasterize(w, 4),
      bytes = image.data.byteLength;
    const result = await validateCapture(image, w.code.size + 8, w.code.text, () => {
      reads++;
      return w.code.text;
    });
    expect(result.ok).toBe(true);
    expect(reads).toBe(24);
    expect(terminated).toBe(4);
    expect(image.data.byteLength).toBe(bytes);
  } finally {
    globalThis.Worker = original;
  }
});

test("The accelerated Gaussian keeps every camera pixel identical", async () => {
  const fs = await import("node:fs");
  const { loadBlurKernel } = await import("../src/qr-craft/fast-blur.js");
  const { gaussBlur } = await import("../src/qr-craft/picture.js");
  expect(await loadBlurKernel(fs.readFileSync("src/qr-craft/blur.wasm"))).toBe(true);
  for (const [width, height] of [
    [11, 17],
    [129, 97],
    [600, 400],
  ])
    for (const sigma of [0.3, 0.8, 1.6, 2.4]) {
      const a = Uint8ClampedArray.from(
          { length: width * height * 4 },
          (_, i) => (i * 31 + (i % 13)) % 256,
        ),
        b = a.slice(),
        c = a.slice();
      gaussBlur(a, width, height, sigma, null, false);
      gaussBlur(b, width, height, sigma, new Float32Array(width * height * 3));
      gaussBlur(c, width, height, sigma);
      expect(Buffer.compare(Buffer.from(a), Buffer.from(c))).toBe(0);
      expect(
        Buffer.compare(Buffer.from(a), Buffer.from(b)),
        `${width}x${height}, sigma ${sigma}`,
      ).toBe(0);
    }
});

test("Rendered fidelity includes the complete encoded square and excludes its quiet border", async () => {
  const { capturedFidelity } = await import("../tools/picture-qr-fidelity/metrics.mjs");
  const source = { w: 120, h: 120, data: new Float32Array(120 * 120 * 3) };
  const img = { width: 200, height: 200, data: new Uint8ClampedArray(200 * 200 * 4).fill(255) };
  for (let y = 0; y < 120; y++)
    for (let x = 0; x < 120; x++)
      for (let ch = 0; ch < 3; ch++) {
        const value = (x * 3 + y * 5 + ch * 17) % 256;
        source.data[(y * 120 + x) * 3 + ch] = value / 255;
        img.data[((y + 40) * 200 + x + 40) * 4 + ch] = value;
      }
  const scores = capturedFidelity(source, img, 30, 50);
  for (const scale of ["phone", "print"]) {
    expect(scores[scale].ssim).toBeGreaterThan(0.999999);
    expect(scores[scale].rmse).toBeLessThan(0.000001);
  }
});

test("A capture tail hold keeps camera updates active and releases on a newer build", async () => {
  const { withScanTail } = await import("../src/qr-craft/scan-pause.js");
  const player = {
    loadToken: 1,
    paused: false,
    stage: {
      holds: 0,
      holdRenderTail() {
        this.holds++;
        return () => this.holds--;
      },
    },
  };
  let finish;
  const work = withScanTail(player, () => new Promise((resolve) => (finish = resolve)));
  expect(player.paused).toBe(false);
  expect(player.stage.holds).toBe(1);
  player.loadToken++;
  await new Promise((resolve) => setTimeout(resolve, 65));
  expect(player.stage.holds).toBe(0);
  finish();
  await work;
  expect(player.stage.holds).toBe(0);
  await expect(
    withScanTail(player, () => Promise.reject(new Error("capture failed"))),
  ).rejects.toThrow("capture failed");
  expect(player.stage.holds).toBe(0);
});

test("A canceled scan releases the next build's animation before its worker finishes", async () => {
  const { withScanPause } = await import("../src/qr-craft/scan-pause.js");
  const player = {
    loadToken: 1,
    paused: false,
    stage: {
      holds: 0,
      holdRenderTail() {
        this.holds++;
        return () => this.holds--;
      },
    },
    setPaused(value) {
      this.paused = value;
    },
  };
  let finish;
  const work = withScanPause(player, () => new Promise((resolve) => (finish = resolve)));
  expect(player.paused).toBe(true);
  expect(player.stage.holds).toBe(1);
  player.loadToken++;
  await new Promise((resolve) => setTimeout(resolve, 65));
  expect(player.paused).toBe(false);
  expect(player.stage.holds).toBe(0);
  // An old finally block must not resume a newer scan's pause.
  let finishNext;
  const next = withScanPause(player, () => new Promise((resolve) => (finishNext = resolve)));
  finish();
  await work;
  expect(player.paused).toBe(true);
  expect(player.stage.holds).toBe(1);
  finishNext();
  await next;
  expect(player.paused).toBe(false);
  expect(player.stage.holds).toBe(0);
  await expect(
    withScanPause(player, () => {
      throw new Error("reader failed");
    }),
  ).rejects.toThrow("reader failed");
  expect(player.paused).toBe(false);
  expect(player.stage.holds).toBe(0);
});

test("Detail repair yields and cancels between candidates", async () => {
  const { closestScanningAsync } = await import("../src/qr-craft/picture.js");
  let current = true,
    checks = 0,
    inputTurn = false;
  setTimeout(() => (inputTurn = true), 0);
  const repair = closestScanningAsync(
    pic,
    { ...OPTIONS, fidelity: "detail" },
    read,
    () => {
      checks++;
      expect(inputTurn).toBe(true);
      setTimeout(() => (current = false), 0);
      return { ok: false };
    },
    { isCurrent: () => current, maxTries: 1 },
  );
  await expect(repair).rejects.toMatchObject({ name: "AbortError" });
  expect(checks).toBe(1);
});

test("An obsolete rendered check cannot restore the previous picture options", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.addInitScript(() => {
    const OriginalWorker = window.Worker;
    window.__cameraReplies = [];
    window.Worker = class extends OriginalWorker {
      constructor(url, options) {
        super(url, options);
        this.pictureScan = String(url).endsWith("/scan-worker.js");
      }
      set onmessage(handler) {
        super.onmessage = (event) => {
          if (this.pictureScan && window.__delayCamera) {
            window.__cameraReplies.push(() =>
              handler({ data: { ...event.data, result: { ok: false } } }),
            );
          } else handler(event);
        };
      }
    };
  });
  await page.goto("/?renderer=webgl2&adapt=off&profile=low&labs=1");
  await page.waitForSelector("body[data-ready='true']", { timeout: 180000 });
  await page.evaluate(async () => {
    const { app: a } = window.__splashery;
    await a.chooseToy("qr-picture");
    window.__splashery.qrCraft.autoCheck = false;
    await a.setToyOptions({
      text: "https://example.org/a/1",
      fidelity: "detail",
      shape: "circle",
      picture: "ai-farm",
      size: "more",
      center: "small",
      contrast: 0.5,
      level: "H",
    });
    const q = window.__splashery.qrCraft;
    q.autoCheck = true;
    window.__delayCamera = true;
    window.__oldGeneration = a.player.loadToken;
    window.__oldCheck = q.checkPicture();
  });
  await page.waitForFunction(() => window.__cameraReplies.length > 0);
  await page.evaluate(() => {
    window.__newPicture = window.__splashery.app.setToyOptions({ text: "https://example.org/b/2" });
  });
  await page.waitForFunction(
    () => window.__splashery.app.player.loadToken > window.__oldGeneration,
  );
  await page.evaluate(async () => {
    window.__delayCamera = false;
    for (const reply of window.__cameraReplies.splice(0)) reply();
    await Promise.all([window.__oldCheck, window.__newPicture]);
  });
  await expect
    .poll(() => page.evaluate(() => window.__splashery.qrCraft.picture().options.text))
    .toBe("https://example.org/b/2");
});

test("Scalar and SIMD rasters preserve fractional samples, quiet zones, and byte rounding", async () => {
  const fs = await import("node:fs");
  for (const name of ["raster", "raster-simd"]) {
    const { loadRasterKernel, fastRaster } = await import(`../src/qr-craft/fast-raster.js?${name}`);
    expect(await loadRasterKernel(fs.readFileSync(`src/qr-craft/${name}.wasm`))).toBe(true);
    for (const N of [21, 53, 69])
      for (const k of [1, 3, 5])
        for (const ppm of [1.25, 4, 8])
          for (const samples of [1, 4]) {
            const G = N * k,
              length = G * G * 3,
              storage = new Float32Array(length + 6),
              cells = storage.subarray(3, 3 + length);
            for (let i = 0; i < length; i++)
              cells[i] = ((i * 73 + ((i / 31) | 0) * 127) % 997) / 996;
            const w = { code: { size: N }, G, k, cells },
              expected = rasterize(w, ppm, { samples, accelerated: false });
            const W = expected.width,
              total = N + 8,
              indices = new Int32Array(W * samples),
              active = new Uint8Array(W),
              data = new Uint8ClampedArray(expected.data.length);
            for (let p = 0; p < W; p++)
              for (let u = 0; u < samples; u++) {
                const m = ((p + (u + 0.5) / samples) / W) * total - 4;
                indices[p * samples + u] = m < 0 || m >= N ? -1 : Math.floor(m * k);
                if (indices[p * samples + u] >= 0) active[p] = 1;
              }
            expect(fastRaster(w, indices, active, data, W, samples)).toBe(true);
            expect(
              Buffer.compare(Buffer.from(data), Buffer.from(expected.data)),
              `${name} N${N} k${k} ppm${ppm} samples${samples}`,
            ).toBe(0);
            expect(
              fastRaster({ ...w, cells: Array.from(cells) }, indices, active, data, W, samples),
            ).toBe(false);
          }
  }
});

test("Cached camera area weights match the independent study for all aspect ratios", async () => {
  const { resizeFrame } = await import("../src/qr-craft/views.js");
  const { resize } = await import("../tools/qr-scan-lab/sim.mjs");
  for (const [width, height] of [
    [11, 17],
    [129, 97],
    [720, 720],
    [640, 480],
    [1, 17],
    [17, 1],
  ])
    for (const out of [1, 4, 31, 97, 164, 328, 424, 600, 900]) {
      const image = {
        width,
        height,
        data: Uint8ClampedArray.from(
          { length: width * height * 4 },
          (_, i) => (i * 31 + (i % 13)) % 256,
        ),
      };
      expect(
        Buffer.compare(
          Buffer.from(resizeFrame(image, out).data),
          Buffer.from(resize(image, out).data),
        ),
        `${width}x${height} to ${out}`,
      ).toBe(0);
    }
});

test("Gaussian fallback preserves the rounding of non-clamped buffers", async () => {
  const fs = await import("node:fs");
  const { loadBlurKernel } = await import("../src/qr-craft/fast-blur.js");
  const { gaussBlur } = await import("../src/qr-craft/picture.js");
  expect(await loadBlurKernel(fs.readFileSync("src/qr-craft/blur.wasm"))).toBe(true);
  for (const Type of [Uint8Array, Float32Array, Uint8ClampedArray])
    for (const [width, height] of [
      [11, 17],
      [129, 97],
    ])
      for (const sigma of [0.8, 2.4]) {
        const expected = Type.from(
          { length: width * height * 4 },
          (_, i) => ((i * 31 + (i % 13)) % 256) + 0.25,
        );
        const actual = expected.slice(),
          scratch = expected.slice();
        gaussBlur(expected, width, height, sigma, null, false);
        gaussBlur(actual, width, height, sigma);
        gaussBlur(scratch, width, height, sigma, new Float32Array(width * height * 3));
        const bytes = (data) => Buffer.from(data.buffer, data.byteOffset, data.byteLength);
        expect(Buffer.compare(bytes(actual), bytes(expected)), Type.name).toBe(0);
        expect(Buffer.compare(bytes(scratch), bytes(expected)), Type.name + " scratch").toBe(0);
      }
});

test("A Circle museum picture keeps its small blurred pitch margin", async ({ page }) => {
  const text = "https://example.org/a/9?q=circlecirclecirclecirclecirclecirclecirclecircle&page=8";
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/?renderer=webgl2&adapt=off&profile=low&labs=1");
  await page.waitForSelector("body[data-ready='true']", { timeout: 180000 });
  await page.evaluate(async (text) => {
    const { RECIPES } = await import("/src/packs/qr-craft.js");
    const { app: a, qrCraft: q } = window.__splashery;
    q.autoCheck = false;
    await a.chooseToy("qr-picture");
    const blob = await (await fetch("/tools/picture-qr-fidelity/fixtures/met-459968.jpg")).blob();
    await RECIPES["qr-picture"].input.read(
      "",
      "Met still life",
      new File([blob], "met-459968.jpg", { type: "image/jpeg" }),
    );
    q.autoCheck = true;
    await a.setToyOptions({
      text,
      fidelity: "detail",
      shape: "circle",
      picture: "own",
      size: "more",
      level: "H",
      center: "small",
      contrast: 0.5,
      style: "color",
    });
  }, text);
  await page.waitForFunction(
    () => {
      const { app: a, qrCraft: q } = window.__splashery,
        p = q.picture();
      return !a.busy && p.check?.stage?.length === 2 && !p.checking && !a.player.stage.coverDepth;
    },
    null,
    { timeout: 180000 },
  );
  const result = await page.evaluate(async () => {
    const q = window.__splashery.qrCraft,
      p = q.picture();
    const { shapeHalf } = await import("/src/qr/circle.js");
    return {
      shot: q.lastShot(),
      check: p.check,
      codeSize: p.woven.code.size,
      modules: 2 * (shapeHalf(p.woven.code, "circle") + 1),
    };
  });
  expect(result.check.ok).toBe(true);
  expect(result.check.stress.readers).toEqual(["jsqr", "zxingcpp"]);
  const { qualifyCapture } = await import("../tools/picture-qr-fidelity/qualify.mjs");
  const independent = await qualifyCapture(
    loadPicture("tools/picture-qr-fidelity/fixtures/met-459968.jpg"),
    result,
    text,
    "circle",
  );
  expect(independent.scans).toHaveLength(24);
  expect(independent.scans.every((scan) => scan.jsqr && scan.zxingcpp)).toBe(true);
});

test("Model retries repeat the last failed condition first and retain the full accepted matrix", async () => {
  const previous = globalThis.Worker;
  try {
    for (const shape of ["square", "circle"])
      for (const guard of [0, 0.1]) {
        const { validateDetail } = await import(
          `../src/qr-craft/scan-pool.js?priority=${shape}-${guard}`
        );
        const calls = [],
          workers = [];
        let fail = true;
        const target = (f) => f.ppm === 4 && f.blur === 0.3 + guard && f.view === 2;
        const hash = (frame) => createHash("sha256").update(frame.image.data).digest("hex");
        globalThis.Worker = class {
          constructor() {
            workers.push(this);
          }
          postMessage(job, transfer = []) {
            calls.push({
              dual: !!job.dual,
              frames: job.frames.map((f) => ({
                ppm: f.ppm,
                blur: f.blur,
                view: f.view,
                hash: hash(f),
              })),
            });
            const copy = structuredClone(job, { transfer });
            const bad = fail && copy.dual && copy.frames.find(target);
            const result = bad
              ? { ok: false, ppm: bad.ppm, blur: bad.blur, view: bad.view, reader: "zxingcpp" }
              : { ok: true };
            queueMicrotask(() => this.onmessage({ data: { id: copy.id, result } }));
          }
          terminate() {}
        };
        const w = makeWoven(pic, {
          ...OPTIONS,
          fidelity: "detail",
          texture: "tiles",
          preferContinuous: true,
          channel: "weighted",
          shape,
        });
        w.rendering = { ...w.rendering, validation: "model", textureGuard: guard };
        expect(await validateDetail(w, pic, shape, read)).toMatchObject({
          ok: false,
          reader: "zxingcpp",
        });
        const original = calls
          .filter((c) => c.dual)
          .flatMap((c) => c.frames)
          .find(target);
        expect(original).toBeTruthy();
        calls.length = 0;
        expect(await validateDetail(w, pic, shape, read)).toMatchObject({
          ok: false,
          preflight: true,
          reader: "zxingcpp",
        });
        expect(calls.filter((c) => c.dual)).toEqual([{ dual: true, frames: [original] }]);
        calls.length = 0;
        fail = false;
        expect(await validateDetail(w, pic, shape, read)).toMatchObject({
          ok: true,
          layoutChecked: true,
        });
        const dual = calls.filter((c) => c.dual);
        expect(dual[0]).toEqual({ dual: true, frames: [original] });
        const complete = dual.slice(1).flatMap((c) => c.frames);
        expect(complete).toHaveLength(24);
        expect(new Set(complete.map((f) => `${f.ppm}/${f.blur}/${f.view}`)).size).toBe(24);
        expect(complete.find(target)).toEqual(original);
        workers[0]?.onerror();
      }
  } finally {
    globalThis.Worker = previous;
  }
});
