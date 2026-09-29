#!/usr/bin/env node
// Films opening a model file in the "Model to splats" toy (lane Studio Models): the toy shows its
// sample, a file is opened with the Toy tab's panel, and the model appears as splats. Real time,
// 390 x 844 phone screen, cropped to the stage. Usage:
//   node tools/stm-open-clip.mjs <model file> <out.gif> [--secs 6] [--fps 8]
import { chromium } from "@playwright/test";
import fs from "node:fs";
import path from "node:path";
import { PNG } from "pngjs";
import { GIFEncoder, quantize, applyPalette } from "../vendor/gifenc/gifenc.esm.js";

const args = process.argv.slice(2);
const opt = (n, d) => {
  const i = args.indexOf(`--${n}`);
  return i >= 0 ? Number(args[i + 1]) : d;
};
const [file, out] = args.filter(
  (a, i) => !a.startsWith("--") && !(args[i - 1] || "").startsWith("--"),
);
const secs = opt("secs", 6);
const fps = opt("fps", 8);
const browser = await chromium.launch({
  executablePath: process.env.SPLASHERY_CHROMIUM || undefined,
  args: [
    "--use-angle=swiftshader",
    "--enable-unsafe-swiftshader",
    "--ignore-gpu-blocklist",
    "--enable-webgl",
  ],
});
const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
await page.goto(
  (process.env.SPLASHERY_URL || "http://127.0.0.1:4173/") +
    "?renderer=webgl2&adapt=off&profile=mid&labs=1",
);
await page.waitForSelector("body[data-ready='true']", { timeout: 180_000 });
await page.evaluate(() => window.__splashery.app.chooseToy("model-splats"));
await page.waitForFunction(() => window.__splashery.player.proc?.ctx?.kit?.data?.model?.splats > 5000, null, { timeout: 90_000 }); // prettier-ignore
await page.waitForTimeout(800);
const clip = { x: 0, y: 70, width: 390, height: 420 };
const frames = [];
const grab = async () => {
  const f = PNG.sync.read(await page.screenshot({ clip }));
  f.t = Date.now();
  frames.push(f);
};
for (let i = 0; i < 3; i++) await grab();
await page.locator("#toy-input-file").setInputFiles(file);
const t0 = Date.now();
while (Date.now() - t0 < secs * 1000) {
  await grab();
  await page.waitForTimeout(1000 / fps);
}
const gif = GIFEncoder();
for (const [i, f] of frames.entries()) {
  // Each frame lasts as long as it really did (a slow renderer takes a while per picture).
  const delay = i + 1 < frames.length ? Math.min(1000, frames[i + 1].t - f.t) : 1500;
  const palette = quantize(f.data, 256, { format: "rgb565" });
  gif.writeFrame(applyPalette(f.data, palette, "rgb565"), f.width, f.height, { palette, delay, repeat: 0 }); // prettier-ignore
}
gif.finish();
fs.mkdirSync(path.dirname(path.resolve(out)), { recursive: true });
fs.writeFileSync(out, gif.bytes());
console.log(`${out}: ${frames.length} frames, ${(fs.statSync(out).size / 1024) | 0} KB`);
await browser.close();
