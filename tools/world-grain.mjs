#!/usr/bin/env node
// Measures the grain of a world (worlds/index.html) in fixed views, the way
// lanes Lab and Sharpness measure toys (docs/lab/KERNELS.md,
// docs/lab/SHARPNESS.md): speckle is the mean difference of each pixel's
// lightness from the median of its 3×3 neighbors, over the flatter half of
// the region (lower is cleaner).
//
//   python3 -m http.server 4173 --bind 127.0.0.1 &
//   SPLASHERY_CHROMIUM=/opt/pw-browsers/chromium node tools/world-grain.mjs <out-dir> [--label=before] [--dpr=2] [--profile=mid] [--q=extra query]
//
// Writes <out-dir>/<label>-<view>.png and prints a row per view: the
// speckle of the lower half (the ground), of the whole frame, and the
// splats drawn.

import { chromium } from "@playwright/test";
import { PNG } from "pngjs";
import fs from "node:fs";
import path from "node:path";

const args = process.argv.slice(2);
const opt = (name, def) => {
  const a = args.find((x) => x.startsWith(`--${name}=`));
  return a ? a.slice(name.length + 3) : def;
};
const [outDir] = args.filter((a) => !a.startsWith("--"));
if (!outDir) throw new Error("Usage: node tools/world-grain.mjs <out-dir> [--label=...]");
const label = opt("label", "now");
const dpr = Number(opt("dpr", 2));
const profile = opt("profile", "mid");
const extra = opt("q", "");
const base = process.env.SPLASHERY_URL || "http://127.0.0.1:4173/";

// Views: where the character stands, which way it faces, the camera's
// distance and tilt.
const VIEWS = {
  ground: { at: [-4, 6, 180], distance: 3.2, pitch: 0.55 },
  shore: { at: [-22, -2, 270], distance: 5.2, pitch: 0.3 },
  props: { at: [-16, 9, 290], distance: 5.2, pitch: 0.25 },
  aerial: { overview: true },
};

fs.mkdirSync(outDir, { recursive: true });
const browser = await chromium.launch({
  executablePath: process.env.SPLASHERY_CHROMIUM || undefined,
  args: ["--use-angle=swiftshader", "--enable-unsafe-swiftshader", "--ignore-gpu-blocklist", "--enable-webgl"], // prettier-ignore
});
const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: dpr }); // prettier-ignore
const page = await ctx.newPage();
page.on("pageerror", (e) => console.error("page error:", e.message));
await page.goto(`${base}worlds/?labs=1&renderer=webgl2&profile=${profile}&clock=manual${extra}`);
await page.waitForFunction(() => document.body.dataset.ready === "true", null, { timeout: 300_000 }); // prettier-ignore
const results = {};
for (const [name, v] of Object.entries(VIEWS)) {
  const stats = await page.evaluate(async (v) => {
    const w = window.__world;
    if (v.overview) {
      document.getElementById("start").hidden = true;
      w.world.overview = true;
    } else {
      w.enter();
      document.getElementById("hint").hidden = true;
      document.getElementById("card").hidden = true;
      Object.assign(w.world.camera, { distance: v.distance, pitch: v.pitch });
      w.place(v.at[0], v.at[1], v.at[2]);
    }
    w.catchUp();
    for (let i = 0; i < 6; i++) await w.tick(1 / 30);
    document.getElementById("card").hidden = true;
    return w.stats();
  }, v);
  await page.waitForTimeout(1500);
  const file = path.join(outDir, `${label}-${name}.png`);
  await page.screenshot({ path: file });
  const png = PNG.sync.read(fs.readFileSync(file));
  const lower = speckle(png, Math.floor(png.height * 0.55), png.height);
  const all = speckle(png, Math.floor(png.height * 0.12), png.height);
  results[name] = { lower: +lower.toFixed(2), all: +all.toFixed(2), splats: stats.total };
  console.log(`${label} ${name}: speckle ground ${lower.toFixed(2)}, frame ${all.toFixed(2)}, ${stats.total} splats`); // prettier-ignore
}
fs.writeFileSync(path.join(outDir, `${label}.json`), JSON.stringify(results, null, 2));
await browser.close();

// Mean |L - median of 3×3| over the flatter half of rows y0..y1.
function speckle(png, y0, y1) {
  const { width: w, data } = png;
  const L = new Float32Array(w * png.height);
  for (let i = 0; i < w * png.height; i++)
    L[i] = 0.299 * data[i * 4] + 0.587 * data[i * 4 + 1] + 0.114 * data[i * 4 + 2];
  const vals = [];
  const n = new Float32Array(9);
  for (let y = Math.max(1, y0); y < Math.min(png.height - 1, y1); y += 2)
    for (let x = 1; x < w - 1; x += 2) {
      let k = 0;
      for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) n[k++] = L[(y + dy) * w + x + dx]; // prettier-ignore
      const s = Array.from(n).sort((a, b) => a - b);
      // Local contrast: skip edges (the flatter half only).
      vals.push([s[8] - s[0], Math.abs(L[y * w + x] - s[4])]);
    }
  vals.sort((a, b) => a[0] - b[0]);
  const half = vals.slice(0, Math.floor(vals.length / 2));
  return half.reduce((t, v) => t + v[1], 0) / Math.max(1, half.length);
}
