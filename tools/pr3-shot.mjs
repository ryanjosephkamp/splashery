#!/usr/bin/env node
// Lane Photoreal r3: phone stills of toys (390×844 at device scale 3, the mid
// tier), from the home view, from below, from the side or close up, for the
// bases audit and the framing checks. Labs toys load with ?labs=1.
//
//   python3 -m http.server 4173 --bind 127.0.0.1 &
//   SPLASHERY_CHROMIUM=/opt/pw-browsers/chromium node tools/pr3-shot.mjs <out-dir> [--views=home,below,side,close] [--scale=3] [--wait=2500] [--size=390x844] id ...
//
// Writes <out-dir>/<id>-<view>.png. "below" looks up from under the toy at the
// lowest tilt the camera allows (about 83 degrees), "side" from the toy's
// level, "close" from the home angle at 60% of the home distance.

import { chromium } from "@playwright/test";
import fs from "node:fs";
import path from "node:path";

const base = process.env.SPLASHERY_URL || "http://127.0.0.1:4173/";
const args = process.argv.slice(2);
const opt = (name, def) => {
  const a = args.find((x) => x.startsWith(`--${name}=`));
  return a ? a.slice(name.length + 3) : def;
};
const [outDir, ...ids] = args.filter((a) => !a.startsWith("--"));
if (!outDir || !ids.length) throw new Error("Usage: node tools/pr3-shot.mjs <out-dir> id ...");
const views = opt("views", "home,below").split(",");
const scale = Number(opt("scale", 3));
const wait = Number(opt("wait", 2500));
const [w, h] = opt("size", "390x844").split("x").map(Number);

fs.mkdirSync(outDir, { recursive: true });
const browser = await chromium.launch({
  executablePath: process.env.SPLASHERY_CHROMIUM || undefined,
  args: [
    "--use-angle=swiftshader",
    "--enable-unsafe-swiftshader",
    "--ignore-gpu-blocklist",
    "--enable-webgl",
  ],
});
const page = await browser.newPage({ viewport: { width: w, height: h }, deviceScaleFactor: scale });
page.on("pageerror", (e) => console.error("page error:", e.message));
await page.goto(`${base}?labs=1&renderer=webgl2&profile=mid&adapt=off`);
await page.waitForSelector("body[data-ready='true']", { timeout: 180_000 });
for (const id of ids) {
  await page.evaluate(async (id) => {
    const { app, player } = window.__splashery;
    await app.chooseToy(id);
    player.opts.idleDelay = 1e9;
    player.idle.weight = 0;
  }, id);
  await page.waitForTimeout(wait);
  for (const view of views) {
    await page.evaluate((view) => {
      const { player } = window.__splashery;
      const cam = player.camera;
      const home = { ...cam.home };
      const s = { ...home };
      if (view === "below") s.pitch = -1.45;
      if (view === "top") s.pitch = 1.45;
      if (view === "side") s.pitch = 0;
      if (view === "close") s.distance = home.distance * 0.6;
      if (view === "back") s.yaw = home.yaw + Math.PI;
      cam.setState(s, { snap: true });
    }, view);
    // Render a few frames so the splats are sorted for the new view (the sort runs a frame or two
    // behind the camera).
    for (let i = 0; i < 6; i++) {
      await page.evaluate(() => window.__splashery.player.stage.requestRender());
      await page.waitForTimeout(300);
    }
    await page.screenshot({ path: path.join(outDir, `${id}-${view}.png`) });
  }
  console.log(id);
}
await browser.close();
