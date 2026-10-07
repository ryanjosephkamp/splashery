#!/usr/bin/env node
// Real elements (lane Elements): a phone-size clip of the whole table as the app shows it on a
// phone (390 x 844 points, 2 device pixels to the point, panels and all): the table, a sample
// lifted out of its tile, its turn and its way back. The toy's controls are stepped frame by
// frame (several frames drawn for each, so the splats sort where they stand), so the clip is the
// same every time. Writes PNG frames and an MP4.
//
//   python3 -m http.server 4173 --bind 127.0.0.1 &
//   SPLASHERY_CHROMIUM=/opt/pw-browsers/chromium node tools/rel-table-clip.mjs out-dir [El]
import { chromium } from "@playwright/test";
import fs from "node:fs";
import path from "node:path";
import { execFileSync } from "node:child_process";
import { settle } from "./rel-settle.mjs";

const [outDir = ".cache/rel/table-clip", el = "Cu"] = process.argv.slice(2);
const frames = path.join(outDir, "frames");
fs.mkdirSync(frames, { recursive: true });
const base = process.env.SPLASHERY_URL || "http://127.0.0.1:4173/";
const FPS = 12;

const b = await chromium.launch({
  executablePath: process.env.SPLASHERY_CHROMIUM || undefined,
  args: ["--use-angle=swiftshader", "--enable-unsafe-swiftshader", "--ignore-gpu-blocklist"],
});
const page = await b.newPage({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2 });
await page.goto(`${base}?labs=1&renderer=webgl2&profile=low&adapt=off`);
await page.waitForSelector("body[data-ready='true']", { timeout: 180_000 });
await page.evaluate(() => window.__splashery.app.chooseToy("real-elements"));
await page.waitForFunction(() => window.__splashery.player.motion?.ctx?.kit?.data, null, { timeout: 120_000 }); // prettier-ignore
await page.evaluate((el) => window.__splashery.app.setToyOption("element", el), el);
await page.waitForFunction((el) => window.__splashery.player.motion?.ctx?.kit?.data?.element === el, el, { timeout: 120_000 }); // prettier-ignore
await page.waitForTimeout(1500);

// The script: [seconds, up, spin] keys, eased between by the toy itself.
const keys = [
  [0, 0, 0],
  [1.2, 0, 0],
  [3.0, 1, 0],
  [3.6, 1, 0.999],
  [9.6, 1, 0.001],
  [10.4, 1, 0],
  [12.2, 0, 0],
  [13.0, 0, 0],
];
const at = (t) => {
  for (let i = 1; i < keys.length; i++)
    if (t <= keys[i][0]) {
      const [t0, u0, s0] = keys[i - 1];
      const [t1, u1, s1] = keys[i];
      const f = (t - t0) / (t1 - t0 || 1);
      return [u0 + (u1 - u0) * f, s0 + (s1 - s0) * f];
    }
  return keys[keys.length - 1].slice(1);
};
const n = Math.round(keys[keys.length - 1][0] * FPS);
for (let i = 0; i <= n; i++) {
  const [up, spin] = at(i / FPS);
  await page.evaluate(
    ({ up, spin }) => {
      const { motion } = window.__splashery.player;
      motion.setControl("up", up, { snap: true });
      motion.setControl("spin", spin, { snap: true });
    },
    { up, spin },
  );
  await settle(page, 4);
  await page.screenshot({ path: path.join(frames, `f${String(i).padStart(4, "0")}.png`) });
}
await b.close();
const ff = execFileSync("python3", ["-c", "import imageio_ffmpeg;print(imageio_ffmpeg.get_ffmpeg_exe())"]).toString().trim(); // prettier-ignore
const mp4 = path.join(outDir, `rel-table-${el}.mp4`);
execFileSync(ff, ["-loglevel", "error", "-y", "-framerate", String(FPS), "-i", path.join(frames, "f%04d.png"), "-movflags", "+faststart", "-pix_fmt", "yuv420p", "-vf", "scale=trunc(iw/2)*2:trunc(ih/2)*2", "-c:v", "libx264", "-crf", "22", mp4]); // prettier-ignore
console.log(`${n + 1} frames -> ${mp4}`);
