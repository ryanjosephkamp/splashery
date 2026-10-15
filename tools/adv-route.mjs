#!/usr/bin/env node
// Task 84. Real browser evidence, without changing or mocking the toys.
// Start npm run serve, then: SPLASHERY_CHROMIUM=/path/to/chromium node tools/adv-route.mjs
// ADV_REAL_GPU=1 omits every software-renderer flag. See the generated README.
import fs from "node:fs/promises";
import path from "node:path";
import { execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { chromium } from "@playwright/test";

export const PAYLOAD = process.env.ADV_PAYLOAD || "https://ryanjosephkamp.github.io/splashery/";
const ROOT = fileURLToPath(new URL("../", import.meta.url));
const PHONE = { width: 390, height: 844 };
const REAL = process.env.ADV_REAL_GPU === "1";
const BASE = process.env.SPLASHERY_URL || `http://127.0.0.1:${process.env.SPLASHERY_PORT || 4173}/`;
const OUT = path.resolve(ROOT, process.env.ADV_OUT || ".cache/advisor-route");
const STILL = "tests/fixtures/p3d/scene.jpg";
const CLIP = "tests/fixtures/psv3/silent.webm";
const OWNER = {
  "photo-3d": "task 76, PR #622",
  "moving-photo-3d": "task 48, PR #560",
  "qr-code": "QR lane (no owning task named in task 84)",
  "qr-picture": "tasks 79 and 80",
  "qr-three": "task 72",
  "share-qr": "QR share sheet (no owning task named in task 84)",
};
const ensure = (condition, message, actual) => {
  if (!condition) throw Object.assign(new Error(message), { actual });
};
const json = (name, value) => fs.writeFile(name, `${JSON.stringify(value, null, 2)}\n`);
const COMMON_QR = [
  "Fresh load",
  "Export and decode PNG",
  "Native-size exported decode",
  "On-screen decode at phone size",
  "Full viewport decode",
  "Recipient link",
  "Second-phone scan",
  "Route console and network health",
];
const PLAN = {
  "photo-3d": [
    "Fresh load",
    "Sample front",
    "Sample oblique",
    "Orbit drag",
    "Splats",
    "Splats front",
    "Splats oblique",
    "Sharp picture and depth slider",
    "Reset camera",
    "Local still",
    "Local front",
    "Local oblique",
    "Local-file recipient",
    "Back to sample",
    "Save scene and reopen",
    "Sample recipient",
    "Route console and network health",
  ],
  "moving-photo-3d": [
    "Fresh load",
    "Play and frame-time spread",
    "Pause",
    "Seek",
    "End and loop",
    "Sample recipient",
    "Local clip",
    "Local clip playback",
    "Local-file recipient",
    "Switch sources five times",
    "Back to still photo",
    "Reload",
    "Route console and network health",
  ],
  "qr-code": COMMON_QR,
  "qr-picture": COMMON_QR,
  "qr-three": COMMON_QR,
  "share-qr": COMMON_QR,
};

export async function drawn(page) {
  await page.evaluate(async () => {
    const stage = window.__splashery.player.stage;
    await stage.captureFrame();
    await stage.captureFrame(); // also let the splat sorter publish its first result
  });
}

export async function openRoute(page, id, base = BASE) {
  const url = new URL(base);
  page.setDefaultTimeout(180_000);
  url.searchParams.set("labs", "1");
  url.searchParams.set("adapt", "off");
  url.searchParams.set("profile", "mid");
  url.searchParams.set("renderer", process.env.ADV_RENDERER || (REAL ? "auto" : "webgl2"));
  await page.goto(url.href);
  await page.waitForSelector("body[data-ready='true']", { timeout: 180_000 });
  await page.evaluate(async (id) => {
    if (!window.__splashery?.app) throw new Error("The graphics fallback is showing.");
    const { app, player: p } = window.__splashery;
    p.scene.seed = 1; // Repeatable scene generation and settings; share URLs still include creation time.
    const start = performance.now();
    window.__advFirstDraw = null;
    const collect = () => {
      if (p.scene.toy.id !== id || p.toyInfo?.id !== id || p.loading || app.busy) return;
      if (["photo-3d", "moving-photo-3d"].includes(id) && !window.__psv?.state().on) return;
      window.__advFirstDraw = {
        chooseToyToFirstFrameMs: performance.now() - start,
        navigationToFirstFrameMs: performance.now(),
        stageUpdateTicks: p.stage.frames,
      };
      p.stage.app.off("postrender", collect);
    };
    p.stage.app.on("postrender", collect);
    await app.chooseToy(id);
  }, id);
  await page.waitForFunction(
    (id) => window.__splashery.player.scene.toy.id === id && !window.__splashery.app.busy,
    id,
    { timeout: 180_000 },
  );
  await drawn(page);
  await page.waitForFunction(() => window.__advFirstDraw !== null, null, { timeout: 180_000 });
}

// Keep the original export, and separately decode a phone-sized copy. No QR is regenerated.
export async function phonePNG(page, bytes) {
  const url = await page.evaluate(async (base64) => {
    const img = new Image();
    img.src = `data:image/png;base64,${base64}`;
    await img.decode();
    const scale = Math.min(1, 390 / Math.max(img.width, img.height));
    const c = document.createElement("canvas");
    c.width = Math.round(img.width * scale);
    c.height = Math.round(img.height * scale);
    c.getContext("2d").drawImage(img, 0, 0, c.width, c.height);
    return c.toDataURL("image/png");
  }, Buffer.from(bytes).toString("base64"));
  return Buffer.from(url.split(",")[1], "base64");
}

// Use the vendored browser readers, not regenerated QR matrices or mocked responses.
// qrModules is an optional geometry-assisted diagnostic for bounded square
// rasters with a four-module quiet zone. Route and smoke assertions never use
// it: both readers must find the code independently in the exported pixels.
export async function decodePNG(page, bytes, { qrModules = null } = {}) {
  if (!(await page.evaluate(() => !!window.jsQR)))
    await page.addScriptTag({ url: new URL("vendor/jsqr/jsQR.js", page.url()).href });
  if (!(await page.evaluate(() => !!window.ZXing)))
    await page.addScriptTag({ url: new URL("vendor/zxing-js/zxing.min.js", page.url()).href });
  return page.evaluate(
    async ({ base64, qrModules }) => {
      const img = new Image();
      img.src = `data:image/png;base64,${base64}`;
      await img.decode();
      const c = document.createElement("canvas");
      c.width = img.width;
      c.height = img.height;
      const g = c.getContext("2d");
      g.drawImage(img, 0, 0);
      const pixels = g.getImageData(0, 0, c.width, c.height);
      const jsqr =
        (window.jsQR.default || window.jsQR)(pixels.data, c.width, c.height)?.data ?? null;
      const Z = window.ZXing;
      const lum = new Uint8ClampedArray(c.width * c.height);
      for (let i = 0; i < lum.length; i++) {
        const j = i * 4;
        lum[i] = (pixels.data[j] * 306 + pixels.data[j + 1] * 601 + pixels.data[j + 2] * 117) >> 10;
      }
      let zxing = null;
      try {
        const bitmap = new Z.BinaryBitmap(
          new Z.HybridBinarizer(new Z.RGBLuminanceSource(lum, c.width, c.height)),
        );
        const reader = new Z.QRCodeReader();
        const hints = new Map([[Z.DecodeHintType.TRY_HARDER, true]]);
        if (qrModules === null) zxing = reader.decode(bitmap, hints).getText();
        else {
          const n = qrModules;
          if (
            c.width !== c.height ||
            !Number.isInteger(n) ||
            n < 21 ||
            n > 177 ||
            (n - 17) % 4 !== 0 ||
            c.width < n + 8
          )
            throw new Error("Invalid share export geometry.");
          const source = bitmap.getBlackMatrix();
          const ppm = c.width / (n + 8);
          const quiet = Math.floor(4 * ppm);
          for (let y = 0; y < c.height; y++)
            for (let x = 0; x < c.width; x++)
              if (
                (x < quiet || y < quiet || x >= c.width - quiet || y >= c.height - quiet) &&
                source.get(x, y)
              )
                throw new Error("Share export quiet zone is not clear.");
          const bits = new Z.BitMatrix(n);
          for (let y = 0; y < n; y++)
            for (let x = 0; x < n; x++)
              if (source.get(Math.floor((x + 4.5) * ppm), Math.floor((y + 4.5) * ppm)))
                bits.set(x, y);
          // Reject a supplied grid that does not match the pixels. These standard
          // finder and timing shapes contain no expected payload or encoded data.
          for (const [left, top] of [
            [0, 0],
            [n - 7, 0],
            [0, n - 7],
          ])
            for (let y = 0; y < 7; y++)
              for (let x = 0; x < 7; x++) {
                const dark =
                  x === 0 ||
                  y === 0 ||
                  x === 6 ||
                  y === 6 ||
                  (x >= 2 && x <= 4 && y >= 2 && y <= 4);
                if (bits.get(left + x, top + y) !== dark)
                  throw new Error("Share export finder geometry does not match.");
              }
          for (let i = 8; i < n - 8; i++)
            if (bits.get(i, 6) !== (i % 2 === 0) || bits.get(6, i) !== (i % 2 === 0))
              throw new Error("Share export timing geometry does not match.");
          zxing = reader.getDecoder().decodeBitMatrix(bits, hints).getText();
        }
      } catch {
        /* a failed decode is a finding, represented by null */
      }
      return { jsqr, zxing };
    },
    { base64: Buffer.from(bytes).toString("base64"), qrModules },
  );
}

async function configureCode(page, id) {
  await page.evaluate(
    async ({ id, payload }) => {
      const { app, player: p } = window.__splashery;
      if (id === "qr-code") {
        await window.__splashery.qr.set({ text: payload });
      } else if (id === "qr-picture") {
        await app.setToyOptions({ text: payload, shape: "square" });
      } else if (id === "qr-three") {
        await app.setToyOptions({ t1: payload, t2: payload, t3: payload });
      }
      if (id !== "qr-code" && id !== "share-qr") {
        p.camera.setState({ ...p.camera.getState(), yaw: 0, pitch: 0, roll: 0 }, { snap: true });
        p.stage.requestRender();
      }
    },
    { id, payload: PAYLOAD },
  );
  await drawn(page);
}

// The export paths are the shipped PNG exporters. Three QR uses the general Save PNG exporter.
export async function exportCode(page, id) {
  await configureCode(page, id === "share-qr" ? "qr-code" : id);
  if (id === "share-qr") {
    const share = await page.evaluate(() => window.__splashery.app.openShareQR());
    ensure(share?.ok, "Share QR could not encode the scene URL", share);
    const download = page.waitForEvent("download");
    await page.locator("#sqr-save").click();
    const d = await download;
    return {
      png: await fs.readFile(await d.path()),
      payload: share.url,
      share: await page.evaluate(async () => (await import("/src/qr/share.js")).SHARE.last),
    };
  }
  if (id === "qr-code" || id === "qr-picture") {
    const data = await page.evaluate(async (id) => {
      const q = window.__splashery;
      const blob = id === "qr-code" ? await q.qr.png(390) : await q.qrCraft.savePNG(390);
      return Array.from(new Uint8Array(await blob.arrayBuffer()));
    }, id);
    return { png: Buffer.from(data), payload: PAYLOAD };
  }
  const download = page.waitForEvent("download");
  await page.evaluate(() => window.__splashery.app.exportPNG());
  const d = await download;
  return { png: await fs.readFile(await d.path()), payload: PAYLOAD };
}

async function state(page) {
  return page.evaluate(() => {
    const w = window.__splashery;
    const p = w?.player;
    const gl = p?.stage?.device?.gl;
    const debug = gl?.getExtension("WEBGL_debug_renderer_info");
    const gpu = p?.stage?.device;
    const adapter = gpu?.gpuAdapter?.info;
    const adapterString = adapter
      ? [adapter.vendor, adapter.architecture, adapter.device, adapter.description]
          .filter(Boolean)
          .join("; ")
      : null;
    return {
      url: location.href,
      title: document.title,
      userAgent: navigator.userAgent,
      toyId: p?.scene?.toy?.id,
      options: p?.scene?.toy?.options,
      resolvedOptions: p?.toyInfo?.options,
      scene: w?.app?.exportScene(),
      camera: p?.camera?.getState(),
      graphics: {
        backend: p?.stage ? (p.stage.deviceType === "webgpu" ? "WebGPU" : "WebGL2") : null,
        renderer: gl
          ? gl.getParameter(debug ? debug.UNMASKED_RENDERER_WEBGL : gl.RENDERER)
          : adapterString || gpu?.unmaskedRenderer || "unavailable",
      },
      labs: new URLSearchParams(location.search).get("labs"),
      storage: {
        initial: window.__advInitialStorage,
        current: { ...localStorage },
        session: { ...sessionStorage },
      },
      input: document.querySelector("#toy-input")?.innerText || "",
      statusText: document.querySelector("#toy-status")?.textContent || "",
      visibleText: document.body.innerText,
      toast: {
        text: document.querySelector("#toast")?.textContent || "",
        visible: document.querySelector("#toast")?.classList.contains("show") || false,
      },
      linkNote: document.querySelector("#link-note")?.textContent || "",
      sharp: window.__psv?.state(),
      stageUpdateTicks: p?.stage?.frames,
      firstDraw: window.__advFirstDraw,
      controls: p?.motion?.targets,
      controlState: p?.motion?.state,
    };
  });
}

function observe(page) {
  const logs = { consoleErrors: [], pageErrors: [], failedRequests: [], httpErrors: [] };
  page.on(
    "console",
    (m) => m.type() === "error" && logs.consoleErrors.push({ at: Date.now(), text: m.text() }),
  );
  page.on("pageerror", (e) => logs.pageErrors.push({ at: Date.now(), text: e.message }));
  page.on("requestfailed", (r) =>
    logs.failedRequests.push({ url: r.url(), error: r.failure()?.errorText }),
  );
  page.on(
    "response",
    (r) => r.status() >= 400 && logs.httpErrors.push({ url: r.url(), status: r.status() }),
  );
  return logs;
}

async function localFile(page, fixture, key) {
  await page.evaluate((key) => {
    const { app, player: p } = window.__splashery;
    const start = performance.now();
    window.__advLocalFirstDraw = null;
    const collect = () => {
      if (
        app.busy ||
        p.loading ||
        p.toyInfo?.options?.[key] !== "custom" ||
        !window.__psv?.state().on
      )
        return;
      window.__advLocalFirstDraw = {
        fileInputToFirstFrameMs: performance.now() - start,
        stageUpdateTicks: p.stage.frames,
      };
      p.stage.app.off("postrender", collect);
    };
    p.stage.app.on("postrender", collect);
  }, key);
  await page.locator("#toy-input-file").setInputFiles(path.join(ROOT, fixture));
  await page.waitForFunction(
    (key) =>
      window.__splashery.player.scene.toy.options?.[key] === "custom" ||
      document.querySelector("#toy-input .warning:not([hidden])"),
    key,
    { timeout: 180_000 },
  );
  const error = await page.locator("#toy-input .warning").textContent();
  ensure(await page.locator("#toy-input .warning").isHidden(), "Local input failed", {
    fixture,
    error,
  });
  await page.waitForFunction(
    (key) => {
      const { app, player: p } = window.__splashery;
      return !app.busy && !p.loading && p.toyInfo?.options?.[key] === "custom";
    },
    key,
    { timeout: 180_000 },
  );
  await drawn(page);
  await page.waitForFunction(() => window.__advLocalFirstDraw !== null);
  return {
    fixture,
    firstDraw: await page.evaluate(() => window.__advLocalFirstDraw),
    state: await state(page),
  };
}

async function requireLocal(page, key) {
  const options = await page.evaluate(() => window.__splashery.player.scene.toy.options);
  if (options?.[key] !== "custom")
    throw Object.assign(
      new Error("Local-file step blocked: the earlier file load did not select a custom source"),
      { blocked: true },
    );
}

async function pose(page, yaw = 0, pitch = 0) {
  await page.evaluate(
    ({ yaw, pitch }) => {
      const p = window.__splashery.player;
      p.camera.setState({ ...p.camera.getState(), yaw, pitch, roll: 0 }, { snap: true });
      p.stage.requestRender();
    },
    { yaw, pitch },
  );
  await drawn(page);
}

function photoView(s, view, yaw, pitch) {
  ensure(
    s.sharp?.views?.["photo-3d"] === view && s.sharp.on === (view === "sharp"),
    `Expected the ${view} view`,
    s.sharp,
  );
  ensure(
    Math.abs(s.camera.yaw - yaw) < 0.005 && Math.abs(s.camera.pitch - pitch) < 0.005,
    "Photo camera did not reach the requested pose",
    s.camera,
  );
  if (view === "splats")
    ensure(
      s.statusText.includes("Photo to 3D") && !/\bundefined\b/.test(s.statusText),
      "Photo Splats status contains undefined",
      { statusText: s.statusText, view, camera: s.camera },
    );
  return s;
}

async function movingState(page) {
  return page.evaluate(async () => {
    const { MOVING, movingTransport } = await import(
      new URL("src/packs/moving-photo.js", location.href).href
    );
    return {
      ...movingTransport.state(),
      frame: MOVING.frame,
      last: MOVING.last,
      sample: MOVING.clip?.sample,
      frames: MOVING.clip?.n,
    };
  });
}

// postrender runs only when PlayCanvas renders; frameend also runs on update-only ticks.
async function playWindow(page, ms = 3000) {
  return page.evaluate(async (ms) => {
    const { app, player: p } = window.__splashery;
    const { MOVING } = await import(new URL("src/packs/moving-photo.js", location.href).href);
    const samples = [];
    const collect = () =>
      samples.push({ at: performance.now(), clipTime: MOVING.t, sourceFrame: MOVING.frame });
    p.stage.app.on("postrender", collect);
    app.setControl("play", 1);
    const start = performance.now();
    try {
      await new Promise((r) => setTimeout(r, ms));
    } finally {
      p.stage.app.off("postrender", collect);
    }
    const intervals = samples
      .slice(1)
      .map((s, i) => s.at - samples[i].at)
      .sort((a, b) => a - b);
    const percentile = (q) =>
      intervals.length ? intervals[Math.floor((intervals.length - 1) * q)] : null;
    return {
      method:
        "performance.now at PlayCanvas postrender during unmodified playback (CPU event, not GPU presentation)",
      elapsedMs: performance.now() - start,
      samples,
      frameTimeMs: {
        min: intervals[0] ?? null,
        median: percentile(0.5),
        p95: percentile(0.95),
        max: intervals.at(-1) ?? null,
      },
    };
  }, ms);
}

async function run() {
  const runs = Number(process.env.ADV_RUNS || 3);
  ensure(Number.isInteger(runs) && runs >= 1 && runs <= 3, "ADV_RUNS must be 1, 2, or 3");
  await fs.mkdir(OUT, { recursive: true });
  const buildCommit = execFileSync("git", ["rev-parse", "HEAD"], {
    cwd: ROOT,
    encoding: "utf8",
  }).trim();
  const launch = {
    executablePath: process.env.SPLASHERY_CHROMIUM || undefined,
    headless: process.env.ADV_HEADED !== "1",
    args: REAL
      ? []
      : [
          "--use-angle=swiftshader",
          "--enable-unsafe-swiftshader",
          "--ignore-gpu-blocklist",
          "--enable-webgl",
        ],
  };
  const browser = await chromium.launch(launch);
  const records = [];
  const fixtures = {};
  for (const file of [STILL, CLIP]) {
    const { createHash } = await import("node:crypto");
    const bytes = await fs.readFile(path.join(ROOT, file));
    fixtures[file] = {
      synthetic: true,
      bytes: bytes.length,
      sha256: createHash("sha256").update(bytes).digest("hex"),
    };
  }
  const environment = {
    buildCommit,
    recordedAt: new Date().toISOString(),
    browser: browser.version(),
    runtime: { node: process.version, platform: process.platform, arch: process.arch },
    launch,
    realGPURequested: REAL,
    viewport: PHONE,
    deviceScaleFactor: 1,
    payload: PAYLOAD,
    sceneSeed: 1,
    fixtures,
    browserPlugin: "Browser plugin not available; task 84 explicitly requests Playwright",
    automation:
      "Real browser, shipped media, real depth inference, no route or model mocks; app hooks used for deterministic controls",
  };
  async function context() {
    const c = await browser.newContext({
      viewport: PHONE,
      deviceScaleFactor: 1,
      storageState: { cookies: [], origins: [] },
    });
    await c.addInitScript(() => {
      window.__advInitialStorage = { local: { ...localStorage }, session: { ...sessionStorage } };
    });
    return c;
  }
  try {
    for (let repetition = 1; repetition <= runs; repetition++) {
      for (const id of [
        "photo-3d",
        "moving-photo-3d",
        "qr-code",
        "qr-picture",
        "qr-three",
        "share-qr",
      ]) {
        const c = await context();
        const page = await c.newPage();
        page.setDefaultTimeout(180_000);
        const logs = observe(page);
        let number = 0;
        async function step(name, expected, action, fixture = "shipped sample") {
          const n = ++number;
          const prefix = `run-${repetition}-${id}-${String(n).padStart(2, "0")}`;
          const logStart = Object.fromEntries(Object.entries(logs).map(([k, v]) => [k, v.length]));
          const record = {
            ...environment,
            repetition,
            toyId: id,
            owner: OWNER[id],
            step: n,
            name,
            fixture,
            expected,
            result: "passed",
            evidence: [],
            logs,
          };
          const start = Date.now();
          try {
            record.actual = await action(record);
          } catch (error) {
            record.result = error.blocked
              ? "blocked"
              : error.inconclusive
                ? "inconclusive"
                : "failed";
            record.actual = { error: error.message, detail: error.actual ?? null };
          }
          record.durationMs = Date.now() - start;
          record.stepLogs = Object.fromEntries(
            Object.entries(logs).map(([k, v]) => [k, v.slice(logStart[k])]),
          );
          try {
            record.state = await state(page);
            const shot = `${prefix}.png`;
            await page.screenshot({ path: path.join(OUT, shot), timeout: 30_000 });
            record.evidence.push(shot);
          } catch (error) {
            record.captureError = error.message;
          }
          records.push(record);
          await json(path.join(OUT, `${prefix}.json`), record);
          console.log(`run ${repetition}/${runs} ${id} ${n} ${name}: ${record.result}`);
          return record;
        }
        try {
          const opened = await step(
            "Fresh load",
            "The requested toy draws with empty initial storage and no console or page error",
            async () => {
              await openRoute(page, id === "share-qr" ? "qr-code" : id);
              const s = await state(page);
              ensure(s.toyId === (id === "share-qr" ? "qr-code" : id), "Wrong toy", s.toyId);
              ensure(
                !logs.consoleErrors.length && !logs.pageErrors.length,
                "Errors while opening",
                logs,
              );
              ensure(
                Object.keys(s.storage.initial.local).length === 0 &&
                  Object.keys(s.storage.initial.session).length === 0,
                "Storage was not empty",
                s.storage,
              );
              return {
                state: s,
                navigationThroughSettledCaptureMs: await page.evaluate(() => performance.now()),
                method:
                  "Navigation time origin and chooseToy performance.now through first postrender event of the nonbusy target with Sharp picture visible for photo routes; not a GPU presentation timestamp",
              };
            },
          );
          if (opened.result === "failed") continue;
          if (id === "photo-3d") {
            await step(
              "Sample front",
              "Sharp picture draws the shipped forest sample front on",
              async () => {
                await pose(page);
                const s = await state(page);
                ensure(s.sharp?.on, "Sharp picture did not draw", s.sharp);
                return s;
              },
            );
            await step(
              "Sample oblique",
              "Estimated depth draws at yaw 0.35 and pitch 0.12",
              async () => {
                await page.evaluate(() => window.__splashery.app.setControl("flat", 0));
                await page.waitForFunction(
                  () => window.__splashery.player.motion.state.flat < 0.02,
                );
                await pose(page, 0.35, 0.12);
                return photoView(await state(page), "sharp", 0.35, 0.12);
              },
            );
            await step("Orbit drag", "Dragging the stage changes the camera yaw", async () => {
              const before = await state(page);
              const box = await page.locator("#stage").boundingBox();
              const x = box.x + box.width / 2,
                y = box.y + box.height / 2;
              await page.mouse.move(x, y);
              await page.mouse.down();
              await page.mouse.move(x + 55, y + 12, { steps: 8 });
              await page.mouse.up();
              await drawn(page);
              const after = await state(page);
              ensure(
                Math.abs(after.camera.yaw - before.camera.yaw) > 0.01,
                "Orbit drag did not change yaw",
                { before, after },
              );
              return { before, after };
            });
            await step(
              "Splats",
              "The Splats switch selects the splat view with valid status text",
              async () => {
                await page.locator("#psv-splats").dispatchEvent("click");
                await drawn(page);
                const s = await state(page);
                ensure(
                  s.sharp.views[id] === "splats" && !s.sharp.on,
                  "Splats did not replace Sharp picture",
                  s.sharp,
                );
                ensure(
                  !/\bundefined\b/.test(s.statusText),
                  "Photo Splats status contains undefined",
                  {
                    statusText: s.statusText,
                  },
                );
                return s;
              },
            );
            await step("Splats front", "Splats draw the sample front on", async () => {
              await pose(page);
              return photoView(await state(page), "splats", 0, 0);
            });
            await step(
              "Splats oblique",
              "Splats draw the estimated relief at yaw 0.35 and pitch 0.12",
              async () => {
                await pose(page, 0.35, 0.12);
                return photoView(await state(page), "splats", 0.35, 0.12);
              },
            );
            await step(
              "Sharp picture and depth slider",
              "Sharp picture returns and the Depth slider changes depth to 0.75",
              async () => {
                await page.locator("#psv-sharp").dispatchEvent("click");
                await page
                  .locator("#toy-options")
                  .getByLabel("Depth", { exact: true })
                  .evaluate((el) => {
                    el.value = "0.75";
                  });
                await page
                  .locator("#toy-options")
                  .getByLabel("Depth", { exact: true })
                  .dispatchEvent("change");
                await page.waitForFunction(() => {
                  const { app, player: p } = window.__splashery;
                  return (
                    p.scene.toy.options.depth === 0.75 &&
                    p.toyInfo?.options?.depth === 0.75 &&
                    !p.loading &&
                    !app.busy
                  );
                });
                await drawn(page);
                const actual = await state(page);
                ensure(
                  actual.sharp?.on && actual.sharp.views[id] === "sharp",
                  "Sharp picture did not return",
                  actual.sharp,
                );
                return actual;
              },
            );
            await step("Reset camera", "Reset restores the toy's home camera", async () => {
              const home = await page.evaluate(() => ({
                ...window.__splashery.player.camera.home,
              }));
              await page.evaluate(() => window.__splashery.app.resetCamera());
              await page.waitForFunction(() => {
                const c = window.__splashery.player.camera;
                return ["yaw", "pitch", "distance"].every(
                  (k) => Math.abs(c.cur[k] - c.home[k]) < 0.001,
                );
              });
              await drawn(page);
              const actual = await state(page);
              ensure(
                Math.abs(actual.camera.yaw - home.yaw) < 0.001,
                "Reset did not restore home yaw",
                { home, actual },
              );
              return { home, actual };
            });
            await step(
              "Local still",
              "The existing local JPEG is read and depth is estimated on device",
              () => localFile(page, STILL, "source"),
              STILL,
            );
            await step(
              "Local front",
              "The local estimated-depth scene draws front on",
              async () => {
                await requireLocal(page, "source");
                await pose(page);
                return state(page);
              },
              STILL,
            );
            await step(
              "Local oblique",
              "The local estimated-depth scene draws at yaw 0.35 and pitch 0.12",
              async () => {
                await requireLocal(page, "source");
                await pose(page, 0.35, 0.12);
                return state(page);
              },
              STILL,
            );
            await recipient("Local-file recipient", true, STILL);
            await step("Back to sample", "The forest sample returns", async () => {
              await page.evaluate(() => window.__splashery.app.setToyOptions({ source: "forest" }));
              await drawn(page);
              const s = await state(page);
              ensure(s.options.source === "forest", "The forest sample did not return", s);
              return s;
            });
            await step(
              "Save scene and reopen",
              "Downloaded JSON reopens with its toy, options, and camera",
              async (r) => {
                const before = await page.evaluate(() => window.__splashery.app.exportScene());
                const pending = page.waitForEvent("download");
                await page.evaluate(() => window.__splashery.app.exportJSON());
                const d = await pending;
                const name = `run-${repetition}-photo-scene.json`;
                await d.saveAs(path.join(OUT, name));
                r.evidence.push(name);
                const text = await fs.readFile(path.join(OUT, name), "utf8");
                // Reopen after a navigation, as a person returning to a downloaded scene would.
                await openRoute(page, "photo-3d");
                await page.locator("#import-json").setInputFiles(path.join(OUT, name));
                await page.waitForFunction(
                  (toy) =>
                    !window.__splashery.app.busy &&
                    JSON.stringify(window.__splashery.app.exportScene().toy) ===
                      JSON.stringify(toy),
                  JSON.parse(text).toy,
                );
                await page.waitForFunction(
                  (name) =>
                    document.querySelector("#toast").textContent === `Loaded ${name}.` &&
                    !window.__splashery.player.loading,
                  name,
                );
                await drawn(page);
                const after = await page.evaluate(() => window.__splashery.app.exportScene());
                ensure(
                  JSON.stringify(after.toy) === JSON.stringify(before.toy),
                  "Scene options did not round trip",
                  { before, after },
                );
                ensure(
                  JSON.stringify(after.camera) === JSON.stringify(before.camera),
                  "Camera did not round trip",
                  { before, after },
                );
                return { before, after };
              },
            );
            await recipient("Sample recipient");
          } else if (id === "moving-photo-3d") {
            await step(
              "Play and frame-time spread",
              "Playback advances source frames, measured at completed stage frames",
              async () => {
                const r = await playWindow(page);
                ensure(
                  new Set(r.samples.map((s) => s.sourceFrame)).size > 1,
                  "Playback did not advance",
                  r,
                );
                return r;
              },
            );
            await step(
              "Pause",
              "The source position stays still across completed render frames",
              async () => {
                await page.evaluate(() => window.__splashery.app.setControl("play", 0));
                await drawn(page);
                const a = await movingState(page);
                await page.waitForTimeout(500);
                await drawn(page);
                const b = await movingState(page);
                ensure(Math.abs(b.pos - a.pos) < 0.05, "Pause moved the source", { a, b });
                return { a, b };
              },
            );
            await step("Seek", "Paused seek reaches half the source duration", async () => {
              await page.evaluate(async () => {
                const { movingTransport: t } = await import(
                  new URL("src/packs/moving-photo.js", location.href).href
                );
                t.seek(t.state().length / 2);
              });
              await drawn(page);
              const s = await movingState(page);
              ensure(Math.abs(s.pos - s.length / 2) < 0.1, "Seek did not reach midpoint", s);
              return s;
            });
            await step(
              "End and loop",
              "Playing near the end wraps into the beginning",
              async () => {
                await page.evaluate(async () => {
                  const { movingTransport: t } = await import(
                    new URL("src/packs/moving-photo.js", location.href).href
                  );
                  t.seek(t.state().length - 0.4);
                });
                const r = await playWindow(page, 1800);
                ensure(
                  r.samples.some((s, i) => i > 0 && s.clipTime < r.samples[i - 1].clipTime - 0.5),
                  "No end-to-start loop observed",
                  r,
                );
                return r;
              },
            );
            await recipient("Sample recipient");
            await step(
              "Local clip",
              "The existing local clip is read with real depth inference",
              () => localFile(page, CLIP, "clip"),
              CLIP,
            );
            await step(
              "Local clip playback",
              "Local source frames advance",
              async () => {
                await requireLocal(page, "clip");
                const r = await playWindow(page);
                ensure(
                  new Set(r.samples.map((s) => s.sourceFrame)).size > 1,
                  "Local playback did not advance",
                  r,
                );
                return r;
              },
              CLIP,
            );
            await recipient("Local-file recipient", true, CLIP);
            await step(
              "Switch sources five times",
              "Sample and local clip alternate five times without stale source or errors",
              async () => {
                await requireLocal(page, "clip");
                const seen = [];
                for (const clip of ["sample", "custom", "sample", "custom", "sample"]) {
                  await page.evaluate(
                    (clip) => window.__splashery.app.setToyOptions({ clip }),
                    clip,
                  );
                  await drawn(page);
                  const s = await movingState(page);
                  seen.push({ requested: clip, ...s });
                  ensure(
                    clip === "sample" ? s.sample === "sample" : !s.sample,
                    "Stale source after switching",
                    seen,
                  );
                }
                ensure(
                  !logs.consoleErrors.length && !logs.pageErrors.length,
                  "Errors after source switches",
                  logs,
                );
                return seen;
              },
              CLIP,
            );
            await step(
              "Back to still photo",
              "Photo to 3D opens with the shipped still",
              async () => {
                await page.evaluate(() => window.__splashery.app.chooseToy("photo-3d"));
                await drawn(page);
                const s = await state(page);
                ensure(s.toyId === "photo-3d" && s.sharp?.on, "Still photo did not draw", s);
                return s;
              },
            );
            await step(
              "Reload",
              "A shared Moving photo sample URL reopens after reload",
              async () => {
                await page.evaluate(async () => {
                  const a = window.__splashery.app;
                  await a.chooseToy("moving-photo-3d");
                  await a.setToyOptions({ clip: "sample" });
                  await a.copyLink();
                });
                await page.reload();
                await page.waitForSelector("body[data-ready='true']");
                await drawn(page);
                const s = await state(page);
                ensure(s.toyId === id, "Reload lost the shared toy", s);
                return s;
              },
            );
          } else {
            let exported;
            await step(
              "Export and decode PNG",
              "Both vendored readers return the exact payload from the exported PNG scaled to at most 390 pixels",
              async (r) => {
                exported = await exportCode(page, id);
                const name = `run-${repetition}-${id}-export.png`;
                await fs.writeFile(path.join(OUT, name), exported.png);
                r.evidence.push(name);
                const phone = await phonePNG(page, exported.png);
                const phoneName = `run-${repetition}-${id}-export-phone.png`;
                await fs.writeFile(path.join(OUT, phoneName), phone);
                r.evidence.push(phoneName);
                const decoded = await decodePNG(page, phone);
                r.qr = {
                  payload: exported.payload,
                  decoded,
                  settings: await qrSettings(page, id),
                };
                ensure(
                  decoded.jsqr === exported.payload && decoded.zxing === exported.payload,
                  "Export did not decode exactly",
                  { decoded, payload: exported.payload },
                );
                return {
                  payload: exported.payload,
                  decoded,
                  settings: await qrSettings(page, id),
                  share: exported.share,
                };
              },
            );
            await step(
              "Native-size exported decode",
              "Both readers also decode the untouched native-size exported PNG",
              async (r) => {
                if (!exported)
                  throw Object.assign(new Error("No export was produced by the prior step"), {
                    blocked: true,
                  });
                const decoded = await decodePNG(page, exported.png);
                r.qr = {
                  payload: exported.payload,
                  decoded,
                  settings: await qrSettings(page, id),
                };
                ensure(
                  decoded.jsqr === exported.payload && decoded.zxing === exported.payload,
                  "Native export did not decode exactly",
                  r.qr,
                );
                return r.qr;
              },
            );
            await step(
              "On-screen decode at phone size",
              "Both readers return the exact payload from the visible target's screenshot at its phone CSS size",
              async (r) => {
                const target = page.locator(id === "share-qr" ? "#sqr-canvas" : "#stage");
                const box = await target.boundingBox();
                const bytes = await target.screenshot();
                const name = `run-${repetition}-${id}-target-screen.png`;
                await fs.writeFile(path.join(OUT, name), bytes);
                r.evidence.push(name);
                const decoded = await decodePNG(page, bytes);
                const payload = exported?.payload || PAYLOAD;
                r.qr = {
                  payload,
                  decoded,
                  screenshotRegion: box,
                  settings: await qrSettings(page, id),
                };
                ensure(
                  decoded.jsqr === payload && decoded.zxing === payload,
                  "Visible target screenshot did not decode exactly",
                  r.qr,
                );
                return r.qr;
              },
            );
            await step(
              "Full viewport decode",
              "Supplementary full-viewport read; other shelf QR codes make failures inconclusive",
              async (r) => {
                r.owner = null; // Shelf thumbnails make this diagnostic inconclusive, not a toy finding.
                const bytes = await page.screenshot();
                const name = `run-${repetition}-${id}-screen.png`;
                await fs.writeFile(path.join(OUT, name), bytes);
                r.evidence.push(name);
                const decoded = await decodePNG(page, bytes);
                const payload = exported?.payload || PAYLOAD;
                r.qr = { payload, decoded, settings: await qrSettings(page, id) };
                if (decoded.jsqr !== payload || decoded.zxing !== payload)
                  throw Object.assign(
                    new Error(
                      "Inconclusive: the full viewport includes other QR codes in shelf thumbnails",
                    ),
                    { inconclusive: true, actual: { payload, decoded } },
                  );
                return { payload, decoded, settings: await qrSettings(page, id) };
              },
            );
            if (id === "share-qr") await page.locator("#sqr-close").click();
            await recipient("Recipient link");
            await step("Second-phone scan", "Scanned with a second phone", async () => {
              throw Object.assign(
                new Error("blocked, needs the owner: a second phone and camera scan"),
                { blocked: true },
              );
            });
          }
          await step(
            "Route console and network health",
            "No console errors, page errors, failed requests, or HTTP errors",
            async () => {
              ensure(
                Object.values(logs).every((a) => a.length === 0),
                "Route emitted errors",
                logs,
              );
              return logs;
            },
          );
        } catch (error) {
          await step("Route could not continue", "All route steps are attempted", async () => {
            throw error;
          });
        } finally {
          await json(path.join(OUT, `run-${repetition}-${id}-logs.json`), logs);
          await c.close();
        }

        async function recipient(name, local = false, fixture = "shipped sample") {
          await step(
            name,
            local
              ? "A fresh recipient is told the local file is missing and must be opened on their device"
              : "A fresh recipient opens the same toy and settings",
            async (r) => {
              if (local) await requireLocal(page, id === "photo-3d" ? "source" : "clip");
              const url = await page.evaluate(() => window.__splashery.app.copyLink());
              const sender = await state(page);
              const fresh = await context();
              try {
                const p = await fresh.newPage();
                const recipientLogs = observe(p);
                // Keep the generated #s= value and labs state; use this checkout's origin.
                const target = new URL(url);
                const base = new URL(BASE);
                target.protocol = base.protocol;
                target.host = base.host;
                await p.goto(target.href);
                await p.waitForSelector("body[data-ready='true']", { timeout: 180_000 });
                await drawn(p);
                const seen = await state(p);
                const shot = `run-${repetition}-${id}-${number}-recipient.png`;
                await p.screenshot({ path: path.join(OUT, shot) });
                r.evidence.push(shot);
                const result = {
                  url,
                  localFile: local,
                  fileBytesIncluded: false,
                  fixtureDescriptor: local ? { path: fixture, ...fixtures[fixture] } : null,
                  linkFileMetadata: sender.scene.toy.media || {
                    photoName: sender.options?.photoName,
                    clipName: sender.options?.clipName,
                  },
                  sender,
                  recipient: seen,
                  recipientLogs,
                };
                r.recipient = result;
                ensure(seen.toyId === sender.toyId, "Recipient opened a different toy", result);
                ensure(
                  Object.values(recipientLogs).every((a) => a.length === 0),
                  "Recipient emitted errors",
                  result,
                );
                if (local)
                  ensure(
                    /not on this device|isn't on this device|open.*same|open.*again|missing/i.test(
                      `${seen.visibleText} ${seen.input} ${seen.toast.visible ? seen.toast.text : ""}`,
                    ),
                    "Recipient is not clearly asked to open the missing local file",
                    result,
                  );
                else
                  ensure(
                    JSON.stringify(seen.scene.toy.options) ===
                      JSON.stringify(sender.scene.toy.options),
                    "Recipient settings differ",
                    result,
                  );
                return result;
              } finally {
                await fresh.close();
              }
            },
            fixture,
          );
        }
      }
    }
  } finally {
    await browser.close();
  }
  // Missing prerequisites stay visible; a failed opening must not erase the rest of the route.
  for (let repetition = 1; repetition <= runs; repetition++)
    for (const [toyId, names] of Object.entries(PLAN)) {
      const rows = records.filter((r) => r.repetition === repetition && r.toyId === toyId);
      let number = Math.max(0, ...rows.map((r) => r.step));
      for (const name of names)
        if (!rows.some((r) => r.name === name)) {
          const prerequisite = rows.find((r) => r.result === "failed");
          records.push({
            ...environment,
            repetition,
            toyId,
            owner: OWNER[toyId],
            step: ++number,
            name,
            fixture: "See failed prerequisite",
            expected: `Complete ${name}`,
            result: "blocked",
            actual: {
              error: `Needs the route prerequisite: ${prerequisite?.name || "route execution"}`,
            },
            evidence: [],
            state: rows.at(-1)?.state,
            logs: rows.at(-1)?.logs,
          });
        }
    }
  const summary = summarize(records, runs);
  for (const r of records) {
    const group = summary.find((s) => s.step === `${r.toyId}: ${r.name}`);
    r.runPasses = { passed: group.passed, of: runs, attempted: group.attempted };
    await json(path.join(OUT, recordFile(r)), r);
  }
  await writeReport(OUT, environment, records, runs);
  console.log(`Evidence: ${OUT}`);
  process.exitCode =
    process.env.ADV_FAIL_ON_FINDINGS === "0"
      ? 0
      : records.some((r) => r.result === "failed")
        ? 1
        : 0;
}

const recordFile = (r) => `run-${r.repetition}-${r.toyId}-${String(r.step).padStart(2, "0")}.json`;
const kinds = ["passed", "failed", "inconclusive", "blocked"];
const counts = (rows) =>
  Object.fromEntries(kinds.map((kind) => [kind, rows.filter((r) => r.result === kind).length]));
const countText = (rows) =>
  Object.entries(counts(rows))
    .filter(([, n]) => n)
    .map(([kind, n]) => `${n} ${kind}`)
    .join(", ");

function summarize(records, runs) {
  const groups = new Map();
  for (const r of records) {
    const key = `${r.toyId}: ${r.name}`;
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(r);
  }
  return [...groups].map(([step, rows]) => ({
    step,
    ...counts(rows),
    attempted: rows.filter((r) => r.result !== "blocked").length,
    planned: runs,
    result: ["failed", "blocked", "inconclusive", "passed"].find((kind) =>
      rows.some((r) => r.result === kind),
    ),
    records: rows.map(recordFile),
  }));
}

// Also usable after capture to publish run 1 locally and link runs 2/3 on the evidence-only branch.
export async function writeReport(
  out,
  environment,
  records,
  runs,
  { linkFor = (file) => file, verification = "" } = {},
) {
  const link = (label, file) => `[${label}](${linkFor(file)})`;
  const summary = summarize(records, runs);
  const graphics = records.find((r) => r.state?.graphics?.renderer)?.state.graphics;
  const recordedOn = new Intl.DateTimeFormat("en-US", {
    dateStyle: "long",
    timeStyle: "long",
    timeZone: "America/New_York",
  }).format(new Date(environment.recordedAt));
  const byToy = [...new Set(records.map((r) => r.toyId))]
    .map((id) => {
      const rows = records.filter((r) => r.toyId === id);
      const first = rows[0];
      const findings = [
        ...new Set(rows.filter((r) => r.result === "failed").map((r) => r.actual?.error)),
      ];
      const missing = [
        ...new Set(
          rows.filter((r) => r.result === "blocked").map((r) => r.actual?.error || r.name),
        ),
      ];
      return `| ${id} | ${countText(rows)} | ${findings.join("; ") || missing.join("; ") || "No failed checks"} | ${link("Run 1", recordFile(first))} |`;
    })
    .join("\n");
  const table = summary
    .map((s) => {
      const rows = records.filter((r) => `${r.toyId}: ${r.name}` === s.step);
      const links = rows
        .map((r) =>
          [
            link(`${r.repetition} record`, recordFile(r)),
            ...r.evidence.map((f, i) => link(`${r.repetition} file ${i + 1}`, f)),
          ].join(", "),
        )
        .join("; ");
      return `| ${s.step} | ${s.result} | ${s.passed}/${runs} (${s.attempted} attempted) | ${links} |`;
    })
    .join("\n");
  const findingGroups = new Map();
  for (const r of records.filter((r) => r.result !== "passed")) {
    const key = `${r.toyId}: ${r.actual?.error || r.name}`;
    if (!findingGroups.has(key)) findingGroups.set(key, []);
    findingGroups.get(key).push(r);
  }
  const findings = [...findingGroups.values()]
    .map((rows) => {
      const first = rows[0];
      const names = [...new Set(rows.map((r) => r.name))].join(", ");
      const reps = [...new Set(rows.map((r) => r.repetition))];
      const links = reps
        .flatMap((rep) => {
          const row = rows.find((r) => r.repetition === rep);
          return [
            link(`Run ${rep}`, recordFile(row)),
            ...(row.name === "Native-size exported decode"
              ? [link(`Run ${rep} native PNG`, `run-${rep}-${row.toyId}-export.png`)]
              : []),
          ];
        })
        .join(", ");
      return `| ${first.toyId}: ${names} | ${first.result} | ${first.actual?.error} | ${first.owner || "No toy owner: supplementary diagnostic"} | ${links} |`;
    })
    .join("\n");
  const moving = records
    .filter(
      (r) =>
        r.toyId === "moving-photo-3d" &&
        r.name === "Play and frame-time spread" &&
        r.actual?.frameTimeMs,
    )
    .map(
      (r) =>
        `| ${r.repetition} | ${r.state.firstDraw?.chooseToyToFirstFrameMs?.toFixed(1)} | ${r.state.firstDraw?.navigationToFirstFrameMs?.toFixed(1)} | ${r.actual.frameTimeMs.min?.toFixed(1)} | ${r.actual.frameTimeMs.median?.toFixed(1)} | ${r.actual.frameTimeMs.p95?.toFixed(1)} | ${r.actual.frameTimeMs.max?.toFixed(1)} |`,
    )
    .join("\n");
  const shareRecords = records.filter(
    (r) => r.toyId === "share-qr" && r.name === "Export and decode PNG" && r.qr?.payload,
  );
  const shareOrigins = [...new Set(shareRecords.map((r) => new URL(r.qr.payload).origin))];
  const loopback = shareOrigins.some((origin) =>
    ["127.0.0.1", "localhost", "[::1]"].includes(new URL(origin).hostname),
  );
  const firstShare = shareRecords[0];
  const firstShareSize = firstShare?.actual?.share?.version
    ? `Run ${firstShare.repetition} has a **${firstShare.qr.payload.length}-character link and ${17 + 4 * firstShare.actual.share.version} modules per side**. `
    : "";
  const share = shareRecords
    .map((r) => {
      const made = r.actual?.share;
      return `| ${r.repetition} | ${new URL(r.qr.payload).origin} | ${r.qr.payload.length} | ${made?.version ? 17 + 4 * made.version : "See dialog info in record"} | ${link("Exact URL and decodes", recordFile(r))} |`;
    })
    .join("\n");
  await json(path.join(out, "summary.json"), {
    environment,
    requestedRuns: runs,
    totals: counts(records),
    summary: summary.map((s) => ({ ...s, records: s.records.map(linkFor) })),
  });
  await fs.writeFile(
    path.join(out, "README.md"),
    `| Toy | Observations across ${runs} run${runs === 1 ? "" : "s"} | Findings / missing input | Evidence |\n| --- | --- | --- | --- |\n${byToy}

# Advisor demo route evidence

Recorded ${recordedOn}, build \`${environment.buildCommit}\`, Chromium ${environment.browser}. Codex (GPT-6) built this harness. Rule check: none.

Graphics: ${graphics?.backend || "unavailable"}; ${graphics?.renderer || "unavailable"}. ${countText(records)}. Each independent route starts with empty storage at 390 × 844 CSS pixels and DPR 1. The runs force \`profile=mid&adapt=off\`, labs on, and scene seed 1. The initial storage, resolved options, browser, backend, numbered actions, errors, expected results, and actual results are recorded in each step. Creation timestamps remain real and can change exact share URLs across runs.

## Distinct findings and missing inputs

The ${findingGroups.size} distinct observations below group repeated runs by cause. Photo Splats status failures in steps 5–7 share one status-text finding owned by task 76 when present. Full-viewport reads are supplementary, inconclusive diagnostics when readers fail; they have no toy owner and do not affect the exit code. The visible code and real exported PNG have separate exact-payload checks with both vendored readers. A second-phone scan stays **blocked, needs the owner**.

| Step(s) | Result | Finding / smallest missing input | Owner | Reproduction records |
| --- | --- | --- | --- | --- |
${findings || "| All attempted checks | passed | None | — | See results below |"}

A local-file link carries settings and file details, never the file bytes. Recipient records and screenshots show exactly what a fresh recipient sees and whether the page clearly asks them to reopen the file. A failure here belongs to the toy's owning task; this PR fixes no toys.

## Run it again

Start a static server with \`npm run serve\`, then run \`SPLASHERY_CHROMIUM=/path/to/chromium node tools/adv-route.mjs\`. Output defaults to \`.cache/advisor-route/\`, so a rerun cannot overwrite this committed report. \`ADV_OUT\` selects another output directory, \`SPLASHERY_URL\` the server, \`ADV_PAYLOAD\` the QR toys' text, and \`ADV_RUNS\` 1–3 repetitions (default 3). Pass counts use the actual number requested; a one-run dispatch is not three-run evidence. Each result is saved as a per-step JSON file; \`summary.json\` indexes those files without duplicating their contents.

The evidence workflow is **workflow_dispatch only**, one run per dispatch, with \`ADV_RUNS=1\` and \`ADV_FAIL_ON_FINDINGS=0\`. Route findings are reported without making that job red; infrastructure failures and regression failures still fail. Locally the runner exits 1 for failed checks unless \`ADV_FAIL_ON_FINDINGS=0\`; inconclusive and blocked observations never trigger that exit. The Operator controls manual evidence dispatches and the full-suite label. Check the latest Actions run separately from these local results.

For the owner's Mac: \`ADV_OUT=.cache/advisor-route-mac ADV_REAL_GPU=1 ADV_HEADED=1 node tools/adv-route.mjs\`. This removes all software-renderer flags and allows the app's automatic backend choice. Request WebGPU with \`ADV_RENDERER=webgpu\`, then inspect the actual recorded backend. Physical camera scans, hardware smoothness, real-device load times, GPU presentation, and hardware WebGPU remain unmeasured until an owner device run.

## Inputs and measurement method

Both local fixtures are **synthetic**: \`${STILL}\` is a generated disc on a striped wall, and \`${CLIP}\` is a synthetic silent test clip. File hashes and sizes are in every step's fixture metadata. Shipped samples are loaded unchanged; local depth inference is real, with no media or model mocks. Photo depth is **estimated relative depth**, never measured geometry.

These Moving photo to 3D measurements do not describe Video to 3D. First-frame timing records navigation-to-frame and chooseToy-to-frame at the first PlayCanvas postrender for the nonbusy target with Sharp picture visible. Two stage captures then settle the screenshot. Playback samples record performance.now differences at postrender, source positions, and frame numbers. Min, median, p95, and max are retained with raw samples. They describe CPU render completion, not GPU completion or display presentation. Software rendering and automation overhead influence the values. stageUpdateTicks counts updates, not rendered frames. Photo steps 3, 6, and 7 explicitly check view and camera pose; Splats also checks status text.

PNG exports come from the real exporters, not regenerated matrices. Untouched exports and separately saved copies scaled to at most 390 pixels are each decoded with vendor jsQR and ZXing. The visible stage or share-dialog canvas is captured at its actual phone CSS size. Full unscaled viewport screenshots include shelf QR thumbnails; failing reads are inconclusive about the target. Settings marked \`assumed\` in QR metadata are not measurements; app-returned options and metrics are labeled separately. Three QR uses the same payload in all three channels, which does not prove distinct-channel separation.

Both readers must independently find and decode every exported PNG at native size and at 390 pixels, without geometry hints. The Share exporter tries QR masks only when saving and accepts one only when both readers locate and decode its actual raster at both sizes. The optional geometry-assisted helper is a separate diagnostic covered by rejection tests; it is never used by route pass/fail checks. These digital-image reads do not establish phone-camera detection.

## Share QR origin and size

The share QR holds the actual scene URL, including the captured origin: ${shareOrigins.map((origin) => `**${origin}**`).join(", ") || "no share export was captured"}. ${loopback ? "Another phone cannot reach this server through that loopback URL. " : ""}${firstShareSize}Sizes below are read from this capture and can vary with timestamps. Exact URLs and both decoded strings are retained in the linked records.

| Run | Encoded origin | Link characters | Modules per side | Evidence |
| --- | --- | --- | --- | --- |
${share}

## Moving photo timings

Milliseconds on the recorded backend; these do not predict performance on another device.

| Run | Choose toy to first frame | Navigation to first frame | Frame min | Median | p95 | Max |
| --- | --- | --- | --- | --- | --- | --- |
${moving}

## Every step

| Step | Result | Passed of requested runs | Evidence |
| --- | --- | --- | --- |
${table}

Each numbered run links its JSON record and evidence files; file order matches the record's evidence array. Every failure is retained. Images are at most 1 MB each. Runs stored on \`codex/advisor-route-evidence-clips\` are evidence only and that branch must never be merged.
${verification ? `\n## Verification\n\n${verification}\n` : ""}`,
  );
}

async function qrSettings(page, id) {
  return page.evaluate(async (id) => {
    const w = window.__splashery;
    if (id === "qr-code") return { app: w.qr.info(), assumed: { quietModules: 4 } };
    if (id === "qr-picture") {
      const p = w.qrCraft.picture();
      return {
        options: p.options,
        metrics: p.woven
          ? (await import(new URL("src/qr-craft/picture.js", location.href).href)).measure(p.woven)
          : null,
        assumed: { quietModules: 4 },
        error: p.error,
      };
    }
    if (id === "qr-three")
      return {
        options: w.player.scene.toy.options,
        assumed: {
          quietModules: 4,
          theme: "three equal payloads, RGB channels coincide",
          foreground: "#000000",
          background: "#ffffff",
          contrast: 21,
        },
      };
    return {
      app: { dialogInfo: document.querySelector("#sqr-info")?.textContent || "" },
      assumed: {
        quietModules: 4,
        theme: "black on white",
        foreground: "#000000",
        background: "#ffffff",
        contrast: 21,
      },
    };
  }, id);
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  run().catch((error) => {
    console.error(error);
    process.exitCode = 1;
  });
}
