import fs from "node:fs";
import path from "node:path";
import { chromium } from "@playwright/test";
import config from "../../playwright.config.mjs";
import { cameras } from "../../tools/cdx-mir-camera.mjs";
import { fakeCamera } from "../../tools/lv7-mirror-measure.mjs";

const dir = path.resolve(".cache/checkpoint-b");
fs.mkdirSync(dir, { recursive: true });
cameras(dir, 120, ["turn"]);
const results = fs.existsSync(path.join(dir, "measurements.json"))
  ? JSON.parse(fs.readFileSync(path.join(dir, "measurements.json"), "utf8"))
  : {
      revision: "41b21e74e04ccca178b95ac02b4e5dc0e51b4b45",
      viewport: [390, 844],
      deviceScaleFactor: 1,
      profile: "mid",
      renderer: "WebGL2 / SwiftShader",
      cpuThrottle: "none",
      networkThrottle: "none",
      clips: {},
    };
for (const toy of ["moving-photo-3d", "video-3d", "splat-mirror", "model-splats"]) {
  if (results.clips[toy]) continue;
  console.log(`Opening ${toy}`);
  const browser = await chromium.launch({
    ...config.use.launchOptions,
    args: fakeCamera(path.join(dir, "turn.y4m"), config.use.launchOptions.args),
  });
  const context = await browser.newContext({
    viewport: { width: 390, height: 844 },
    deviceScaleFactor: 1,
    isMobile: true,
    hasTouch: true,
    userAgent:
      "Mozilla/5.0 (Linux; Android 13) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/151.0.0.0 Mobile Safari/537.36",
  });
  const page = await context.newPage();
  const errors = [];
  page.on("pageerror", (e) => errors.push(e.message));
  try {
    await page.goto("http://127.0.0.1:4173/?renderer=webgl2&adapt=off&profile=mid&labs=1");
    await page.waitForSelector('body[data-ready="true"]', { timeout: 180000 });
    const start = Date.now();
    await page.evaluate((t) => window.__splashery.app.chooseToy(t), toy);
    await page.waitForFunction(
      (t) =>
        window.__splashery.player.scene.toy.id === t &&
        window.__splashery.player.motion.recipe &&
        document.querySelector("#progress").hidden,
      toy,
      { timeout: 180000 },
    );
    if (toy === "moving-photo-3d")
      await page.waitForFunction(
        async () => (await import("/src/packs/photo-sharp.js")).sharpState().on,
        null,
        { timeout: 90000 },
      );
    const readyMs = Date.now() - start;
    let cameraWarmMs = null;
    if (toy === "splat-mirror") {
      const cameraStart = Date.now();
      await page.locator("#live-camera-stage").click();
      await page.waitForFunction(
        async () => (await import("/src/live/relief.js")).MIRROR.cam?.answers >= 3,
        null,
        { timeout: 240000 },
      );
      cameraWarmMs = Date.now() - cameraStart;
    }
    if (toy === "video-3d") await page.evaluate(() => window.__splashery.app.act());
    // Warm-up, then measure stage frameend events separately from video capture.
    await page.waitForTimeout(1500);
    const measure = await page.evaluate(async () => {
      const stage = window.__splashery.player.stage;
      const times = [];
      const tick = () => times.push(performance.now());
      stage.app.on("postrender", tick);
      const start = performance.now();
      stage.requestRender(7000);
      await new Promise((r) => setTimeout(r, 6000));
      stage.app.off("postrender", tick);
      const elapsed = performance.now() - start;
      const intervals = times
        .slice(1)
        .map((t, i) => t - times[i])
        .sort((a, b) => a - b);
      const percentile = (p) =>
        intervals[Math.min(intervals.length - 1, Math.floor(intervals.length * p))] || null;
      return {
        elapsedMs: elapsed,
        renderedFrames: times.length,
        renderedFps: times.length / (elapsed / 1000),
        medianIntervalMs: percentile(0.5),
        p95IntervalMs: percentile(0.95),
        canvas: [stage.canvas.width, stage.canvas.height],
      };
    });
    const states = await page.evaluate(async (t) => {
      if (t === "moving-photo-3d")
        return {
          moving: (await import("/src/packs/moving-photo.js")).movingState(),
          sharp: (await import("/src/packs/photo-sharp.js")).sharpState(),
        };
      if (t === "video-3d") return (await import("/src/packs/video3d.js")).video3dState();
      if (t === "model-splats") return (await import("/src/packs/studio-models.js")).modelState();
      const { MIRROR } = await import("/src/live/relief.js");
      return {
        cols: MIRROR.cols,
        rows: MIRROR.rows,
        depthSide: MIRROR.cam.side,
        answers: MIRROR.cam.answers,
        lastInferenceMs: MIRROR.cam.ms,
        discarded: MIRROR.cam.discarded,
      };
    }, toy);
    const resources = await page.evaluate(() =>
      performance
        .getEntriesByType("resource")
        .filter((r) => r.name.startsWith(location.origin))
        .map((r) => ({ path: new URL(r.name).pathname, bytes: r.decodedBodySize })),
    );
    const transferBodyBytes = resources.reduce((n, r) => n + r.bytes, 0);
    await page.evaluate((t) => {
      const badge = document.createElement("div");
      badge.textContent = `Checkpoint b · ${t === "splat-mirror" ? "generated dummy camera" : t === "moving-photo-3d" ? "baked sample · Sharp picture" : t === "video-3d" ? "baked sample · Replay flight" : "baked sample · Lift off"} · mid · 390×844`;
      badge.style.cssText =
        "position:fixed;top:70px;left:4px;max-width:374px;z-index:99;background:#111d;color:white;padding:5px;font:11px system-ui;pointer-events:none";
      document.body.append(badge);
    }, toy);
    const cdp = await context.newCDPSession(page);
    const frames = [];
    cdp.on("Page.screencastFrame", (f) => {
      frames.push({ time: f.metadata.timestamp, bytes: Buffer.from(f.data, "base64") });
      cdp.send("Page.screencastFrameAck", { sessionId: f.sessionId }).catch(() => {});
    });
    await cdp.send("Page.startScreencast", {
      format: "jpeg",
      quality: 85,
      maxWidth: 390,
      maxHeight: 844,
      everyNthFrame: 1,
    });
    if (toy === "model-splats") await page.evaluate(() => window.__splashery.app.act());
    await page.waitForTimeout(4500);
    await page.evaluate(() => {
      const c = window.__splashery.player.camera;
      const s = c.getState();
      c.setState({ ...s, yaw: s.yaw + 0.22 }, { snap: true });
      window.__splashery.player.stage.requestRender(4500);
    });
    await page.waitForTimeout(4000);
    await cdp.send("Page.stopScreencast");
    await cdp.detach();
    if (frames.length < 2) throw Error("Insufficient clip frames");
    const folder = path.join(dir, toy);
    fs.mkdirSync(folder, { recursive: true });
    const concat = [];
    frames.forEach((f, i) => {
      const name = `${String(i).padStart(4, "0")}.jpg`;
      fs.writeFileSync(path.join(folder, name), f.bytes);
      concat.push(
        `file '${name}'`,
        `duration ${i + 1 < frames.length ? Math.max(0.02, frames[i + 1].time - f.time) : 0.25}`,
      );
    });
    concat.push(`file '${String(frames.length - 1).padStart(4, "0")}.jpg'`);
    fs.writeFileSync(path.join(folder, "frames.txt"), concat.join("\n") + "\n");
    await page.screenshot({ path: path.join(dir, `${toy}-390x844.png`) });
    results.clips[toy] = {
      readyMs,
      cameraWarmMs,
      measure,
      states,
      transferBodyBytes,
      resources,
      errors,
      capture: {
        frames: frames.length,
        durationSeconds: frames.at(-1).time - frames[0].time,
        width: 390,
        height: 844,
      },
    };
    fs.writeFileSync(path.join(dir, "measurements.json"), JSON.stringify(results, null, 2) + "\n");
    console.log(
      JSON.stringify({
        toy,
        readyMs,
        cameraWarmMs,
        measure,
        states,
        transferBodyBytes,
        errors,
        capture: results.clips[toy].capture,
      }),
    );
  } finally {
    await browser.close();
  }
}
