#!/usr/bin/env node
// Films opening a photo of your own in the "Photo to 3D" toy (lane Photo to 3D), as a phone would: the
// toy shows its sample, a photo is opened with the Toy tab's panel, the depth model runs on the device
// (the first time it also loads), the photo appears as splats, and a tap raises its depth. Real time,
// 390 x 844 phone screen, cropped to the stage; a frame lasts as long as it really did. Usage:
//   node tools/p3d-open-clip.mjs <photo file> <out.gif> [--fps 6]
import { chromium } from "@playwright/test";
import fs from "node:fs";
import path from "node:path";
import { PNG } from "pngjs";
import { GIFEncoder, quantize, applyPalette } from "../vendor/gifenc/gifenc.esm.js";

const args = process.argv.slice(2);
const fpsI = args.indexOf("--fps");
const fps = fpsI >= 0 ? Number(args[fpsI + 1]) : 6;
const [file, out] = args.filter(
  (a, i) => !a.startsWith("--") && !(args[i - 1] || "").startsWith("--"),
);
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
await page.goto((process.env.SPLASHERY_URL || "http://127.0.0.1:4173/") + "?renderer=webgl2&adapt=off&profile=mid&labs=1"); // prettier-ignore
await page.waitForSelector("body[data-ready='true']", { timeout: 180_000 });
await page.evaluate(() => window.__splashery.app.chooseToy("photo-3d"));
await page.waitForFunction(() => window.__splashery.player.proc?.ctx?.kit?.data?.photo?.splats > 5000, null, { timeout: 90_000 }); // prettier-ignore
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
const built = () =>
  page.evaluate(() => window.__splashery.player.proc?.ctx?.kit?.data?.photo?.custom === true);
const t0 = Date.now();
while (!(await built()) && Date.now() - t0 < 120_000) {
  await grab();
  await page.waitForTimeout(1000 / fps);
}
for (let i = 0; i < 4; i++) await grab();
await page.evaluate(() => window.__splashery.app.act()); // the tap: the depth rises
const t1 = Date.now();
while (Date.now() - t1 < 9000) {
  await grab();
  await page.waitForTimeout(1000 / fps);
}
const gif = GIFEncoder();
for (const [i, f] of frames.entries()) {
  const delay = i + 1 < frames.length ? Math.min(1000, frames[i + 1].t - f.t) : 1500;
  const palette = quantize(f.data, 256, { format: "rgb565" });
  gif.writeFrame(applyPalette(f.data, palette, "rgb565"), f.width, f.height, { palette, delay, repeat: 0 }); // prettier-ignore
}
gif.finish();
fs.mkdirSync(path.dirname(path.resolve(out)), { recursive: true });
fs.writeFileSync(out, gif.bytes());
console.log(`${out}: ${frames.length} frames, ${(fs.statSync(out).size / 1024) | 0} KB`);
await browser.close();
