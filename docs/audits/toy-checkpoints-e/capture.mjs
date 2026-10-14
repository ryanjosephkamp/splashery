import { createRequire } from "node:module";
import fs from "node:fs/promises";
import path from "node:path";
const require = createRequire(path.join(process.cwd(), "package.json"));
const { chromium } = require("@playwright/test");
const out = process.env.CHECKPOINT_E_OUT || "/tmp/checkpoint-e-evidence";
await fs.mkdir(out, { recursive: true });
const ids = ["powers-of-ten", "smlm-microscope", "galaxy-box", "point-clouds", "volume-viewer"];
const browser = await chromium.launch({
  executablePath: process.env.SPLASHERY_CHROMIUM || "/usr/bin/chromium",
  args: [
    "--use-angle=swiftshader",
    "--enable-unsafe-swiftshader",
    "--ignore-gpu-blocklist",
    "--enable-webgl",
  ],
});
const profile = {
  viewport: { width: 390, height: 844 },
  deviceScaleFactor: 1,
  isMobile: true,
  hasTouch: true,
};
const url = "http://127.0.0.1:4173/?labs=1&renderer=webgl2&profile=low&adapt=off";
async function settle(page, id) {
  await page.waitForFunction(
    (id) => window.__splashery.player.scene.toy.id === id && !window.__splashery.player.loading,
    id,
    { timeout: 180000 },
  );
  if (id === "powers-of-ten")
    await page.waitForFunction(
      () => {
        const p = window.__splashery.player;
        p.stage.requestRender();
        const items = [...p.chunks.items.values()];
        return items.length > 1 && items.every((x) => x.state !== "loading");
      },
      null,
      { timeout: 180000 },
    );
  await page.evaluate(async () => {
    await window.__splashery.player.stage.captureFrame();
  });
}
async function open(page, id) {
  await page.goto(url);
  await page.waitForSelector("body[data-ready='true']", { timeout: 180000 });
  await page.evaluate(() => {
    const p = window.__splashery.player;
    p.opts.idleDelay = 1e9;
    p.idle.weight = 0;
  });
  await page.evaluate(async (id) => {
    await window.__splashery.app.chooseToy(id);
  }, id);
  await settle(page, id);
}
const metrics = {
  checkpoint: "41b21e74e04ccca178b95ac02b4e5dc0e51b4b45",
  browser: browser.version(),
  profile,
  url,
  method:
    "Fresh browser context per toy; time from chooseToy until loading ends, streamed chunks settle, and captureFrame completes. Asset bytes from local HTTP response bodies excluding thumbnails, after app boot. Rendered frameend events over 5 s while requesting renders and turning the camera (Powers of ten stays tilt-locked). Software WebGL2; no video during measurements. One run, no physical phone or WAN timing.",
  toys: [],
};
if (process.env.CHECKPOINT_E_MODE !== "clips") {
  for (const id of ids) {
    const context = await browser.newContext(profile);
    const page = await context.newPage();
    const errors = [],
      failures = [],
      assets = {},
      bodies = [];
    page.on("pageerror", (e) => errors.push(e.message));
    page.on("requestfailed", (r) => failures.push({ url: r.url(), error: r.failure()?.errorText }));
    await page.goto(url);
    await page.waitForSelector("body[data-ready='true']", { timeout: 180000 });
    page.on("response", (r) => {
      if (r.url().includes("/assets/") && !r.url().endsWith("thumb.webp"))
        bodies.push(
          r
            .body()
            .then((b) => (assets[new URL(r.url()).pathname] = b.length))
            .catch(() => {}),
        );
    });
    await page.evaluate(() => {
      const p = window.__splashery.player;
      p.opts.idleDelay = 1e9;
      p.idle.weight = 0;
    });
    const start = performance.now();
    await page.evaluate(async (id) => {
      await window.__splashery.app.chooseToy(id);
    }, id);
    await settle(page, id);
    const loadMs = performance.now() - start;
    await page.waitForTimeout(500);
    const state = await page.evaluate(async (id) => {
      const p = window.__splashery.player;
      let detail;
      if (id === "smlm-microscope" || id === "galaxy-box") {
        const s = await import("/src/packs/science.js");
        detail = id === "galaxy-box" ? s.galaxyState() : s.microscopeState();
      }
      if (id === "point-clouds") detail = (await import("/src/packs/viewers.js")).cloudState();
      if (id === "volume-viewer") detail = (await import("/src/packs/volume-viewer.js")).describe();
      if (id === "powers-of-ten")
        detail = {
          legend: document.querySelector("#toy-legend")?.innerText,
          chunks: [...p.chunks.items.entries()].map(([id, x]) => ({ id, state: x.state })),
        };
      const gl = p.stage.device.gl;
      const dbg = gl?.getExtension("WEBGL_debug_renderer_info");
      return {
        detail,
        splats: p.proc?.ctx?.kit?.buf?.count,
        canvas: { width: p.stage.canvas.width, height: p.stage.canvas.height },
        renderer: dbg ? gl.getParameter(dbg.UNMASKED_RENDERER_WEBGL) : null,
      };
    }, id);
    const render = await page.evaluate(async (id) => {
      const p = window.__splashery.player,
        stage = p.stage;
      const intervals = [];
      let previous = null;
      const handler = () => {
        const now = performance.now();
        if (previous !== null) intervals.push(now - previous);
        previous = now;
      };
      stage.app.on("frameend", handler);
      const t0 = performance.now(),
        f0 = stage.frames;
      let running = true;
      const tick = () => {
        if (!running) return;
        if (id !== "powers-of-ten") p.camera.tgt.yaw += 0.01;
        stage.requestRender();
        requestAnimationFrame(tick);
      };
      requestAnimationFrame(tick);
      await new Promise((r) => setTimeout(r, 5000));
      running = false;
      stage.app.off("frameend", handler);
      const elapsedMs = performance.now() - t0;
      const sorted = intervals.slice().sort((a, b) => a - b);
      return {
        elapsedMs,
        renderedFrames: stage.frames - f0,
        fps: ((stage.frames - f0) * 1000) / elapsedMs,
        medianFrameMs: sorted[Math.floor(sorted.length / 2)],
        p95FrameMs: sorted[Math.floor(sorted.length * 0.95)],
      };
    }, id);
    await Promise.all(bodies);
    metrics.toys.push({
      id,
      loadMs,
      assetBytes: Object.values(assets).reduce((a, b) => a + b, 0),
      assets,
      state,
      render,
      errors,
      failures,
    });
    console.log(JSON.stringify(metrics.toys.at(-1)));
    await context.close();
  }
  await fs.writeFile(path.join(out, "measurements.json"), JSON.stringify(metrics, null, 2));
}
const clips = [];
for (const id of ids) {
  const context = await browser.newContext({
    ...profile,
    recordVideo: { dir: out, size: { width: 390, height: 844 } },
  });
  const page = await context.newPage();
  await open(page, id);
  const video = page.video();
  if (id === "smlm-microscope") {
    await page.evaluate(() => window.__splashery.app.setToyOption("data", "nucleus"));
    await settle(page, id);
  }
  await page.waitForTimeout(700);
  const clipStart = Date.now();
  await page.screenshot({ path: path.join(out, `${id}-390x844.png`) });
  if (id === "powers-of-ten") {
    for (const z of [2, 4, 7.1, 21, -4, -7.4, 0.3]) {
      await page.evaluate(
        (z) => window.__splashery.player.sliderInput("zoom", (21.6 - z) / 29.2),
        z,
      );
      await page.waitForTimeout(2000);
      await settle(page, id);
      await page.waitForTimeout(900);
    }
  } else if (id === "volume-viewer") {
    await page.evaluate(() => window.__splashery.player.act(null));
    await page.waitForTimeout(5300);
    await page.evaluate(() => window.__splashery.app.setToyOption("source", "gar"));
    await settle(page, id);
    await page.waitForTimeout(1200);
  } else {
    if (id === "smlm-microscope") {
      await page.evaluate(() => {
        const p = window.__splashery.player;
        p.act([0, 0, 0]);
      });
      await page.waitForTimeout(1200);
      await page.evaluate(() => window.__splashery.player.act([0, 0, 0]));
    } else await page.evaluate(() => window.__splashery.player.act(null));
    await page.waitForTimeout(3200);
    if (id === "galaxy-box") {
      await page.evaluate(() => window.__splashery.app.setToyOption("view", "telescope"));
      await settle(page, id);
      await page.evaluate(() => window.__splashery.player.act(null));
      await page.waitForTimeout(6500);
    }
  }
  await page.screenshot({ path: path.join(out, `${id}-after-390x844.png`) });
  const clipEnd = Date.now();
  await page.close();
  await video.saveAs(path.join(out, `${id}-390x844.webm`));
  const raw = await video.path();
  if (raw !== path.join(out, `${id}-390x844.webm`)) await fs.unlink(raw);
  await context.close();
  clips.push({ id, actionSeconds: (clipEnd - clipStart) / 1000 });
  await fs.writeFile(path.join(out, "clips.json"), JSON.stringify(clips, null, 2));
  console.log(`clip ${id} action section ${(clipEnd - clipStart) / 1000}s`);
}
await browser.close();
