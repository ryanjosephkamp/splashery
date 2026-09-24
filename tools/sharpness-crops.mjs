#!/usr/bin/env node
// Crops the middle of the stage for a few toys at phone and desktop sizes, so
// sharpness can be compared by pixels before and after a change.
//
//   python3 -m http.server 4173 --bind 127.0.0.1 &
//   SPLASHERY_CHROMIUM=/path/to/chrome node tools/sharpness-crops.mjs <out-dir> [id ...]
//
// Writes <out-dir>/<size>-<id>.png: a square crop, in device pixels, of the
// middle of the canvas (200 CSS px on the phone at 3x, 300 CSS px on the
// desktop at 2x, so both are 600 px). No ?profile= is passed, so the page
// picks its own device tier the way a real visitor's would; the core count and
// memory are set to a typical phone's and desktop's, not the test machine's.
// tools/sharpness-pairs.mjs puts two such folders side by side.

import { chromium } from "@playwright/test";
import fs from "node:fs";
import path from "node:path";

const base = process.env.SPLASHERY_URL || "http://127.0.0.1:4173/";
const [outDir, ...ids] = process.argv.slice(2);
if (!outDir) throw new Error("Usage: node tools/sharpness-crops.mjs <out-dir> [id ...]");
const toys = ids.length
  ? ids
  : ["basketball", "animal-cell", "taj-mahal", "sunflower", "diamond", "raspberry"];

export const SIZES = [
  {
    name: "phone",
    context: {
      viewport: { width: 390, height: 844 },
      deviceScaleFactor: 3,
      isMobile: true,
      hasTouch: true,
    },
    hardware: { cores: 6, memory: 4 },
    crop: 200,
  },
  {
    name: "desktop",
    context: { viewport: { width: 1440, height: 900 }, deviceScaleFactor: 2 },
    hardware: { cores: 8, memory: 8 },
    crop: 300,
  },
];

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
for (const size of SIZES) {
  const context = await browser.newContext({ ...size.context, reducedMotion: "reduce" });
  await context.addInitScript(({ cores, memory }) => {
    Object.defineProperty(navigator, "hardwareConcurrency", { get: () => cores });
    Object.defineProperty(navigator, "deviceMemory", { get: () => memory });
  }, size.hardware);
  const page = await context.newPage();
  page.on("pageerror", (e) => console.error("page error:", e.message));
  // adapt=off: SwiftShader is slow, and a real GPU would not step down.
  await page.goto(`${base}?renderer=webgl2&adapt=off`);
  await page.waitForSelector("body[data-ready='true']", { timeout: 180_000 });
  for (const id of toys) {
    const info = await page.evaluate(async (id) => {
      const { app, player } = window.__splashery;
      await app.chooseToy(id);
      player.idle.weight = 0;
      player.camera.cur = { ...player.camera.home };
      player.camera.tgt = { ...player.camera.home };
      // Let the camera, the sort and any adaptive resolution settle.
      await new Promise((r) => setTimeout(r, 3000));
      for (let i = 0; i < 4; i++) await player.stage.captureFrame();
      const c = player.stage.canvas;
      const r = c.getBoundingClientRect();
      return {
        profile: player.profile,
        splats: player.toyInfo?.splats,
        backing: [c.width, c.height],
        css: [Math.round(r.width), Math.round(r.height)],
        mid: [r.left + r.width / 2, r.top + r.height / 2],
      };
    }, id);
    const half = size.crop / 2;
    const file = path.join(outDir, `${size.name}-${id}.png`);
    await page.screenshot({
      path: file,
      clip: { x: info.mid[0] - half, y: info.mid[1] - half, width: size.crop, height: size.crop },
    });
    console.log(
      `${size.name} ${id}: ${info.profile} profile, ${info.splats} splats, canvas ${info.backing.join("x")} for ${info.css.join("x")} CSS px`,
    );
  }
  await context.close();
}
await browser.close();
