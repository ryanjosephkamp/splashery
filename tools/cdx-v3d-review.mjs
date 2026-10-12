#!/usr/bin/env node
// Real cold-load transfers and screenshots of selected samples in the Playground.
// SPLASHERY_CHROMIUM=/path/to/chromium SPLASHERY_URL=http://127.0.0.1:4173/ \
// node tools/cdx-v3d-review.mjs [sample-id ...]
import fs from "node:fs";
import { chromium } from "@playwright/test";
import { SAMPLES } from "../src/video3d/samples.js";
import { createScene } from "../src/state.js";
import { encodeSceneHash } from "../src/codec.js";

const ids = process.argv.slice(2);
for (const id of ids)
  if (!SAMPLES.some((s) => s.id === id)) throw new Error(`Unknown sample: ${id}`);
const selected = SAMPLES.filter((s) => !ids.length || ids.includes(s.id));
const base = (process.env.SPLASHERY_URL || "http://127.0.0.1:4173/").replace(/\/$/, "");
const out = "assets/toys/video-3d/review";
fs.mkdirSync(out, { recursive: true });
const browser = await chromium.launch({
  executablePath: process.env.SPLASHERY_CHROMIUM || undefined,
  args: ["--use-angle=swiftshader", "--enable-unsafe-swiftshader", "--ignore-gpu-blocklist"],
});
try {
  for (const sample of selected) {
    for (const [width, height] of [
      [390, 844],
      [1440, 900],
    ]) {
      const context = await browser.newContext({
        viewport: { width, height },
        hasTouch: width === 390,
      });
      const page = await context.newPage();
      const errors = [];
      let transfer = 0;
      page.on("pageerror", (e) => errors.push(e.message));
      const cdp = await context.newCDPSession(page);
      await cdp.send("Network.enable");
      cdp.on("Network.loadingFinished", (e) => {
        transfer += e.encodedDataLength || 0;
      });
      const hash = await encodeSceneHash(
        createScene({
          toy: {
            kind: "builtin",
            id: "video-3d",
            options: { source: sample.id, navigation: "walk" },
          },
        }),
      );
      await page.goto(`${base}/?renderer=webgl2&labs=1&profile=low&adapt=off#s=${hash}`);
      await page.waitForSelector("body[data-ready='true']", { timeout: 180_000 });
      await page.waitForFunction(
        (id) => window.__splashery.player.proc?.ctx?.kit?.data?.video?.uid === id,
        sample.id,
      );
      await page.waitForLoadState("networkidle", { timeout: 60_000 });
      await page.screenshot({ path: `${out}/${sample.id}-${width}x${height}.png` });
      const info = await page.evaluate(() => window.__splashery.player.proc.ctx.kit.data.video);
      if (errors.length) throw new Error(`${sample.id}: ${errors.join("; ")}`);
      const result = {
        sample: sample.id,
        width,
        height,
        transferBytes: transfer,
        renderer: "Chromium WebGL2 / SwiftShader",
        info,
      };
      fs.writeFileSync(
        `${out}/${sample.id}-${width}x${height}.json`,
        JSON.stringify(result, null, 2) + "\n",
      );
      console.log(
        JSON.stringify({
          sample: sample.id,
          width,
          transferBytes: transfer,
          splats: info.splats,
          cameras: info.cams,
        }),
      );
      await context.close();
    }
  }
} finally {
  await browser.close();
}
