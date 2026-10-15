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
const OUT = path.resolve(ROOT, process.env.ADV_OUT || "docs/audits/advisor-route-2026-10");
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
export async function decodePNG(page, bytes) {
  if (!(await page.evaluate(() => !!window.jsQR)))
    await page.addScriptTag({ url: new URL("vendor/jsqr/jsQR.js", page.url()).href });
  if (!(await page.evaluate(() => !!window.ZXing)))
    await page.addScriptTag({ url: new URL("vendor/zxing-js/zxing.min.js", page.url()).href });
  return page.evaluate(async (base64) => {
    const img = new Image();
    img.src = `data:image/png;base64,${base64}`;
    await img.decode();
    const c = document.createElement("canvas");
    c.width = img.width;
    c.height = img.height;
    const g = c.getContext("2d");
    g.drawImage(img, 0, 0);
    const pixels = g.getImageData(0, 0, c.width, c.height);
    const jsqr = (window.jsQR.default || window.jsQR)(pixels.data, c.width, c.height)?.data ?? null;
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
      zxing = new Z.QRCodeReader()
        .decode(bitmap, new Map([[Z.DecodeHintType.TRY_HARDER, true]]))
        .getText();
    } catch {
      /* a failed decode is a finding, represented by null */
    }
    return { jsqr, zxing };
  }, Buffer.from(bytes).toString("base64"));
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
    return { png: await fs.readFile(await d.path()), payload: share.url, share };
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
            record.result = error.blocked ? "blocked" : "failed";
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
                return state(page);
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
            await step("Splats", "The Splats switch selects the splat view", async () => {
              await page.locator("#psv-splats").dispatchEvent("click");
              await drawn(page);
              const s = await state(page);
              ensure(
                s.sharp.views[id] === "splats" && !s.sharp.on,
                "Splats did not replace Sharp picture",
                s.sharp,
              );
              return s;
            });
            await step("Splats front", "Splats draw the sample front on", async () => {
              await pose(page);
              return state(page);
            });
            await step(
              "Splats oblique",
              "Splats draw the estimated relief at yaw 0.35 and pitch 0.12",
              async () => {
                await pose(page, 0.35, 0.12);
                return state(page);
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
                r.qr = { payload: exported.payload, decoded, settings: await qrSettings(page, id) };
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
                r.qr = { payload: exported.payload, decoded, settings: await qrSettings(page, id) };
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
              "Both readers return the exact payload from an unscaled 390 × 844 viewport screenshot",
              async (r) => {
                const bytes = await page.screenshot();
                const name = `run-${repetition}-${id}-screen.png`;
                await fs.writeFile(path.join(OUT, name), bytes);
                r.evidence.push(name);
                const decoded = await decodePNG(page, bytes);
                const payload = exported?.payload || PAYLOAD;
                r.qr = { payload, decoded, settings: await qrSettings(page, id) };
                ensure(
                  decoded.jsqr === payload && decoded.zxing === payload,
                  "On-screen code did not decode exactly",
                  { payload, decoded },
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
  // Persist final classifications (including blocked phone scans), then aggregate by step.
  for (const r of records)
    await json(
      path.join(OUT, `run-${r.repetition}-${r.toyId}-${String(r.step).padStart(2, "0")}.json`),
      r,
    );
  const groups = new Map();
  for (const r of records) {
    const key = `${r.toyId}: ${r.name}`;
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(r);
  }
  const summary = [...groups].map(([step, rows]) => ({
    step,
    passed: rows.filter((r) => r.result === "passed").length,
    attempted: rows.filter((r) => r.result !== "blocked").length,
    planned: 3,
    result: rows.some((r) => r.result === "failed")
      ? "failed"
      : rows.some((r) => r.result === "blocked")
        ? "blocked"
        : "passed",
    records: rows.map(
      (r) => `run-${r.repetition}-${r.toyId}-${String(r.step).padStart(2, "0")}.json`,
    ),
  }));
  for (const r of records) {
    const group = summary.find((s) => s.step === `${r.toyId}: ${r.name}`);
    r.runPasses = { passed: group.passed, of: 3, attempted: group.attempted };
    await json(
      path.join(OUT, `run-${r.repetition}-${r.toyId}-${String(r.step).padStart(2, "0")}.json`),
      r,
    );
  }
  await json(path.join(OUT, "results.json"), {
    environment,
    requestedRuns: runs,
    summary,
    records,
  });
  const recordedOn = `${new Intl.DateTimeFormat("en-US", { month: "long", day: "numeric", year: "numeric", timeZone: "UTC" }).format(new Date(environment.recordedAt))}, at ${environment.recordedAt.slice(11, 19)} UTC`;
  const graphics = records.find((r) => r.state?.graphics?.renderer)?.state.graphics;
  const totals = Object.fromEntries(
    ["passed", "failed", "blocked"].map((kind) => [
      kind,
      records.filter((r) => r.result === kind).length,
    ]),
  );
  const movingTimings = records
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
  const table = summary
    .map((s) => {
      const links = s.records.map((file, i) => {
        const row = records.find(
          (r) => `${r.toyId}: ${r.name}` === s.step && r.repetition === i + 1,
        );
        return [
          `[${i + 1} record](${file})`,
          ...(row?.evidence || []).map((evidence, j) => `[${i + 1} file ${j + 1}](${evidence})`),
        ].join(", ");
      });
      return `| ${s.step} | ${s.result} | ${s.passed}/3 (${s.attempted} attempted) | ${links.join("; ")} |`;
    })
    .join("\n");
  const failures = records
    .filter((r) => r.result !== "passed")
    .map(
      (r) =>
        `- Run ${r.repetition}, ${r.toyId}, step ${r.step} (${r.name}): ${r.actual?.error}. Owner: ${r.owner}. Reproduce with the fixture and exact options in [record](run-${r.repetition}-${r.toyId}-${String(r.step).padStart(2, "0")}.json).`,
    )
    .join("\n");
  await fs.writeFile(
    path.join(OUT, "README.md"),
    `# Advisor demo route evidence\n\nRecorded ${recordedOn}, build \`${buildCommit}\`, Chromium ${environment.browser}. Rule check: none. Codex built this evidence harness.\n\nGraphics: ${graphics?.backend || "unavailable"}; ${graphics?.renderer || "unavailable"}. ${totals.passed} passed, ${totals.failed} failed, and ${totals.blocked} blocked step records. Failures make the runner exit with status 1 and remain findings for the owning tasks.\n\nRun a static server with \`npm run serve\`, then \`SPLASHERY_CHROMIUM=/path/to/chromium node tools/adv-route.mjs\`. The default is three independent runs, each route in a fresh browser context with empty cookies, local storage, and session storage. Each route uses scene seed 1 to keep scene generation and settings repeatable. Share URLs also carry their creation timestamp, so each exact URL is recorded verbatim and may differ across runs. \`ADV_PAYLOAD\` overrides the QR toys' payload, \`ADV_OUT\` selects an output directory, \`SPLASHERY_URL\` selects the server, and \`ADV_RUNS=1\` is a development smoke run, never three-run evidence.\n\nFor the owner's Mac, use \`ADV_OUT=.cache/advisor-route-mac ADV_REAL_GPU=1 ADV_HEADED=1 node tools/adv-route.mjs\`; this removes all software-renderer flags and permits the app's automatic backend choice. Use \`ADV_RENDERER=webgpu\` to request WebGPU explicitly, and check the recorded actual backend and renderer. Real-device smoothness, real load times, GPU presentation, and hardware WebGPU remain blocked until that run. No software result proves them.\n\nPhoto depth is estimated from pictures, never measured geometry. The local JPEG and silent WebM are existing repository fixtures; hashes are in results.json. The moving measurements belong to Moving photo to 3D, not Video to 3D. First-frame timing records navigation-to-frame and chooseToy-to-frame at the first PlayCanvas postrender event for the nonbusy target (with Sharp picture visible for photo routes). Two stage captures then settle the screenshot. It is not the moment pixels reach a display. Playback intervals are performance.now differences at PlayCanvas postrender, with source positions and frame numbers, and min, median, p95, and max recorded. These events mark CPU render completion, not GPU completion or display presentation. The software renderer and automation overhead influence all timings. stageUpdateTicks is a diagnostic update count, not a rendered-frame count. No mocked media or depth model is used.\n\nAll screenshots use a 390 × 844 CSS-pixel viewport at DPR 1. PNG exports use the real exporters: 390 pixels for QR code and Picture QR, the current phone canvas for Three QR, and the share sheet's native PNG size. Each untouched export is saved and decoded, and a separately saved copy is scaled to a maximum dimension of 390 pixels for the required phone-size decode. Native-size failures remain findings even when the phone-size copy decodes. The screen decoder reads a screenshot of the visible stage (or the share dialog canvas), cropped only to that element at its actual CSS size. The full unscaled viewport is also decoded separately; it includes QR thumbnails in the shelf, which can interfere with detection. Both checks retain failures. No on-screen screenshot is replaced by an offscreen render. Each step records options, camera, actual backend, renderer string, labs state, initial and final storage, expected and actual results, duration, evidence, and route logs. Logs are also separate per route. Steps use the public app hooks for deterministic controls and actual file inputs and exporters; this is browser integration evidence, not a test of every pointer target.\n\nThe QR toys use the same exact payload throughout. Three QR uses that payload in all three channels; this does not establish distinct-channel separation. The share QR holds the actual scene URL (recorded exactly), which cannot be replaced by ADV_PAYLOAD without changing the feature. Themes, contrast, and quiet zones are in the QR step records. A generated code or a successful software decode is not a phone scan: **scanned with a second phone: blocked, needs the owner**, with a second phone and camera as the missing input.\n\nCheckpoint references are the photo-3d, moving-photo-3d, qr-code, and qr-picture checkpoint documents under docs/studio/. Compare the versions present at the recorded build; later checkpoint captures can use different settings and timing methods. No changes were made to src/, assets/, vendor/, or existing toy tests.\n\n## Moving photo timings\n\nMilliseconds, measured in this browser with the method above. These observations describe the recorded backend and do not predict performance on other devices.\n\n| Run | Choose toy to first frame | Navigation to first frame | Frame min | Median | p95 | Max |\n| --- | --- | --- | --- | --- | --- | --- |\n${movingTimings}\n\n## Results\n\n| Step | Result | Passed of three | Evidence records |\n| --- | --- | --- | --- |\n${table}\n\n## Reproduction records and missing inputs\n\n${failures || "All attempted automated steps passed."}\n\nEach numbered run links its JSON record and evidence files directly; file order matches the record’s evidence array. Every failure is retained for the owning task; no checks are relaxed and no toy fixes are included. Images larger than 1 MB and any large clips belong on codex/advisor-route-evidence-clips, which must never be merged.\n`,
  );
  console.log(`Evidence: ${OUT}`);
  process.exitCode = records.some((r) => r.result === "failed") ? 1 : 0;
}

async function qrSettings(page, id) {
  return page.evaluate(async (id) => {
    const w = window.__splashery;
    if (id === "qr-code") return { ...w.qr.info(), quietModules: 4, theme: "classic" };
    if (id === "qr-picture") {
      const p = w.qrCraft.picture();
      return {
        options: p.options,
        metrics: p.woven
          ? (await import(new URL("src/qr-craft/picture.js", location.href).href)).measure(p.woven)
          : null,
        quietModules: 4,
        theme: "shipped sample picture",
        error: p.error,
      };
    }
    if (id === "qr-three")
      return {
        options: w.player.scene.toy.options,
        quietModules: 4,
        theme: "three equal payloads, RGB channels coincide",
        foreground: "#000000",
        background: "#ffffff",
        contrast: 21,
      };
    return {
      quietModules: 4,
      theme: "black on white",
      foreground: "#000000",
      background: "#ffffff",
      contrast: 21,
    };
  }, id);
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  run().catch((error) => {
    console.error(error);
    process.exitCode = 1;
  });
}
