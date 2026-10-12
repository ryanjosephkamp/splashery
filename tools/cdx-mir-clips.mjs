#!/usr/bin/env node
// Real-time phone clips from the fake camera. Optional baseline module from
// an immutable commit; every other file and the renderer stay the same.
// DISPLAY=:99 SPLASHERY_GL=llvmpipe SPLASHERY_CHROMIUM=/usr/bin/chromium \
//   node tools/cdx-mir-clips.mjs .cache/cdx-mir before ec4aaa37
import fs from "node:fs";
import path from "node:path";
import { execFileSync } from "node:child_process";
import { chromium } from "@playwright/test";
import jpeg from "jpeg-js";
import gifenc from "gifenc";
import config from "../playwright.config.mjs";
import { fakeCamera } from "./lv7-mirror-measure.mjs";
import { CLIPS, cameras } from "./cdx-mir-camera.mjs";

const [dir = ".cache/cdx-mir", label = "after", revision] = process.argv.slice(2);
cameras(dir);
const baseline = revision
  ? execFileSync("git", ["show", `${revision}:src/live/relief.js`], { encoding: "utf8" })
  : null;
for (const clip of CLIPS) {
  const browser = await chromium.launch({
    ...config.use.launchOptions,
    args: fakeCamera(path.resolve(dir, `${clip}.y4m`), config.use.launchOptions.args),
  });
  try {
    const page = await browser.newPage({
      viewport: { width: 390, height: 844 },
      deviceScaleFactor: 1,
    });
    if (baseline)
      await page.route("**/src/live/relief.js", (route) =>
        route.fulfill({ contentType: "text/javascript", body: baseline }),
      );
    await page.goto(
      `${process.env.SPLASHERY_URL || "http://127.0.0.1:4173/"}?renderer=webgl2&adapt=off&profile=mid&labs=1`,
    );
    await page.waitForSelector("body[data-ready='true']", { timeout: 180000 });
    await page.evaluate(() => window.__splashery.app.chooseToy("splat-mirror"));
    await page.waitForFunction(
      () => document.getElementById("progress").hidden && window.__splashery.player.motion.recipe,
    );
    await page.locator("#live-camera-stage").click();
    await page.waitForFunction(
      async () => (await import("/src/live/relief.js")).MIRROR.cam?.answers >= 6,
      null,
      { timeout: 180000 },
    );
    await page.evaluate((text) => {
      const badge = document.createElement("div");
      badge.textContent = text;
      badge.style.cssText =
        "position:fixed;top:70px;left:8px;z-index:99;background:#111d;color:white;padding:6px;font:12px system-ui;pointer-events:none";
      document.body.append(badge);
    }, `Fake camera · ${clip} · ${label} · Codex GPT-6`);
    const session = await page.context().newCDPSession(page);
    const frames = [];
    session.on("Page.screencastFrame", (f) => {
      frames.push({ bytes: Buffer.from(f.data, "base64"), time: f.metadata.timestamp });
      session.send("Page.screencastFrameAck", { sessionId: f.sessionId }).catch(() => {});
    });
    await session.send("Page.startScreencast", {
      format: "jpeg",
      quality: 85,
      maxWidth: 390,
      maxHeight: 844,
      everyNthFrame: 1,
    });
    await page.waitForTimeout(4000);
    await page.evaluate(() => {
      const c = window.__splashery.player.camera;
      const s = c.getState();
      c.setState({ ...s, yaw: s.yaw + 0.35 }, { snap: true });
    });
    await page.waitForTimeout(4000);
    await session.send("Page.stopScreencast");
    await session.detach();
    if (frames.length < 2) throw new Error(`No motion frames captured for ${clip}`);
    const { GIFEncoder, quantize, applyPalette } = gifenc;
    const gif = GIFEncoder();
    for (let i = 0; i < frames.length; i++) {
      const image = jpeg.decode(frames[i].bytes, { useTArray: true });
      const palette = quantize(image.data, 256, { format: "rgb565" });
      const delay =
        i + 1 < frames.length
          ? Math.max(20, Math.round((frames[i + 1].time - frames[i].time) * 1000))
          : 200;
      gif.writeFrame(applyPalette(image.data, palette, "rgb565"), image.width, image.height, {
        palette,
        delay,
        repeat: 0,
      });
    }
    gif.finish();
    const out = path.join(dir, `${label}-${clip}-390x844.gif`);
    fs.writeFileSync(out, gif.bytes());
    await page.screenshot({ path: path.join(dir, `${label}-${clip}-390x844.png`) });
    if (clip === "still") {
      await page.setViewportSize({ width: 1440, height: 900 });
      await page.waitForTimeout(1000);
      await page.screenshot({ path: path.join(dir, `${label}-${clip}-1440x900.png`) });
    }
    console.log(`${out}: ${frames.length} frames, ${(gif.bytes().length / 1024).toFixed(0)} KB`);
  } finally {
    await browser.close();
  }
}
