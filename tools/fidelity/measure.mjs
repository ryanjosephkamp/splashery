#!/usr/bin/env node
// Lane Fidelity: how close a trained splat comes to the renders it never saw. Renders a SOG (or
// PLY) at every camera of a dataset's transforms_test.json with the vendored PlayCanvas
// (tools/fidelity/measure.html, no Splashery effects), puts both it and the held-out Blender
// render on the same background, and reports PSNR and SSIM per view and on average. Also writes
// side-by-side PNGs (render | splat) for the report.
//
//   python3 -m http.server 4173 --bind 127.0.0.1 &
//   SPLASHERY_CHROMIUM=/opt/pw-browsers/chromium node tools/fidelity/measure.mjs \
//     <part.sog> <dataset dir> [--out=dir] [--bg=0,0,0] [--size=512] [--zup] [--views=25]
//
// The file is expected in our coordinates (y up), as the toy loads it; the dataset's cameras are
// Blender's (z up) and are turned to match. --zup takes a file still in Blender's frame. Writes
// <out>/measure.json and <out>/side-NN.png (default out: <dataset>/measure).
//
// PSNR is over the RGB of the whole frame (8-bit, peak 255). SSIM is the usual one (11-pixel
// Gaussian window, sigma 1.5, K1 0.01, K2 0.03) on each channel, averaged.

import { chromium } from "@playwright/test";
import fs from "node:fs";
import path from "node:path";
import { PNG } from "pngjs";

const base = process.env.SPLASHERY_URL || "http://127.0.0.1:4173/";
const args = process.argv.slice(2);
const opt = (name, def) => {
  const a = args.find((x) => x.startsWith(`--${name}=`));
  return a ? a.slice(name.length + 3) : def;
};
const flag = (name) => args.includes(`--${name}`);
const [file, dataset] = args.filter((a) => !a.startsWith("--"));
if (!file || !dataset)
  throw new Error("Usage: node tools/fidelity/measure.mjs <part.sog> <dataset dir> [--out=dir]");
const out = opt("out", path.join(dataset, "measure"));
const bg = opt("bg", "0,0,0").split(",").map(Number);
const views = Number(opt("views", 1e9));
fs.mkdirSync(out, { recursive: true });

const tf = JSON.parse(fs.readFileSync(path.join(dataset, "transforms_test.json"), "utf8"));
const first = PNG.sync.read(fs.readFileSync(path.join(dataset, `${tf.frames[0].file_path}.png`)));
const size = Number(opt("size", first.width));

// Blender (x, y, z up) to ours (x, y up, z toward the viewer): (x, z, -y).
const A = [
  [1, 0, 0, 0],
  [0, 0, 1, 0],
  [0, -1, 0, 0],
  [0, 0, 0, 1],
];
const mul = (a, b) => a.map((row) => b[0].map((_, j) => row.reduce((s, v, k) => s + v * b[k][j], 0))); // prettier-ignore

function onBackground(png, w) {
  // Nearest-neighbour resample to w x w (the renders are square), then alpha over bg.
  const o = new Float64Array(w * w * 3);
  for (let y = 0; y < w; y++)
    for (let x = 0; x < w; x++) {
      const sx = Math.floor((x * png.width) / w);
      const sy = Math.floor((y * png.height) / w);
      const i = (sy * png.width + sx) * 4;
      const a = png.data[i + 3] / 255;
      for (let k = 0; k < 3; k++)
        o[(y * w + x) * 3 + k] = png.data[i + k] * a + bg[k] * 255 * (1 - a);
    }
  return o;
}

function psnr(a, b) {
  let s = 0;
  for (let i = 0; i < a.length; i++) s += (a[i] - b[i]) ** 2;
  const mse = s / a.length;
  return mse === 0 ? 99 : 10 * Math.log10((255 * 255) / mse);
}

function ssim(a, b, w) {
  const R = 5;
  const g = [];
  for (let i = -R; i <= R; i++) g.push(Math.exp(-(i * i) / (2 * 1.5 * 1.5)));
  const gs = g.reduce((s, v) => s + v, 0);
  const k = g.map((v) => v / gs);
  const blur = (src) => {
    const tmp = new Float64Array(w * w);
    const dst = new Float64Array(w * w);
    for (let y = 0; y < w; y++)
      for (let x = 0; x < w; x++) {
        let s = 0;
        for (let i = -R; i <= R; i++)
          s += k[i + R] * src[y * w + Math.min(w - 1, Math.max(0, x + i))];
        tmp[y * w + x] = s;
      }
    for (let y = 0; y < w; y++)
      for (let x = 0; x < w; x++) {
        let s = 0;
        for (let i = -R; i <= R; i++)
          s += k[i + R] * tmp[Math.min(w - 1, Math.max(0, y + i)) * w + x];
        dst[y * w + x] = s;
      }
    return dst;
  };
  const C1 = (0.01 * 255) ** 2;
  const C2 = (0.03 * 255) ** 2;
  let total = 0;
  for (let c = 0; c < 3; c++) {
    const x = new Float64Array(w * w);
    const y = new Float64Array(w * w);
    for (let i = 0; i < w * w; i++) {
      x[i] = a[i * 3 + c];
      y[i] = b[i * 3 + c];
    }
    const mx = blur(x);
    const my = blur(y);
    const xx = blur(x.map((v) => v * v));
    const yy = blur(y.map((v) => v * v));
    const xy = blur(x.map((v, i) => v * y[i]));
    let s = 0;
    for (let i = 0; i < w * w; i++) {
      const vx = xx[i] - mx[i] ** 2;
      const vy = yy[i] - my[i] ** 2;
      const cxy = xy[i] - mx[i] * my[i];
      s += ((2 * mx[i] * my[i] + C1) * (2 * cxy + C2)) / ((mx[i] ** 2 + my[i] ** 2 + C1) * (vx + vy + C2)); // prettier-ignore
    }
    total += s / (w * w);
  }
  return total / 3;
}

function writeSide(name, a, b, w) {
  const png = new PNG({ width: w * 2, height: w });
  for (let y = 0; y < w; y++)
    for (let x = 0; x < w * 2; x++) {
      const src = x < w ? a : b;
      const i = (y * w + (x % w)) * 3;
      const o = (y * w * 2 + x) * 4;
      png.data[o] = src[i];
      png.data[o + 1] = src[i + 1];
      png.data[o + 2] = src[i + 2];
      png.data[o + 3] = 255;
    }
  fs.writeFileSync(path.join(out, name), PNG.sync.write(png));
}

const browser = await chromium.launch({
  executablePath: process.env.SPLASHERY_CHROMIUM || undefined,
  args: ["--use-angle=swiftshader", "--enable-unsafe-swiftshader", "--ignore-gpu-blocklist"],
});
const page = await browser.newPage({ viewport: { width: size, height: size } });
const ext = path.extname(file).toLowerCase();
const served = `${base}__fid/file${ext}`;
await page.route(`${base}__fid/**`, (route) => route.fulfill({ body: fs.readFileSync(file) }));
page.on("pageerror", (e) => console.error(e));
await page.goto(`${base}tools/fidelity/measure.html`);
const splats = await page.evaluate(([u, s, c]) => window.fid.load(u, s, c), [served, size, bg]);

const rows = [];
const frames = tf.frames.slice(0, views);
for (let f = 0; f < frames.length; f++) {
  const fr = frames[f];
  const m = flag("zup") ? fr.transform_matrix : mul(A, fr.transform_matrix);
  const fov = (tf.camera_angle_x * 180) / Math.PI;
  const url = await page.evaluate(([mm, fv]) => window.fid.shoot(mm, fv), [m.flat(), fov]);
  const shot = PNG.sync.read(Buffer.from(url.split(",")[1], "base64"));
  const truth = PNG.sync.read(fs.readFileSync(path.join(dataset, `${fr.file_path}.png`)));
  const a = onBackground(truth, size);
  const b = onBackground(shot, size);
  const row = { view: fr.file_path, psnr: psnr(a, b), ssim: ssim(a, b, size) };
  rows.push(row);
  writeSide(`side-${String(f).padStart(2, "0")}.png`, a, b, size);
  console.log(`${row.view}: PSNR ${row.psnr.toFixed(2)} dB, SSIM ${row.ssim.toFixed(4)}`);
}
await browser.close();
const mean = (k) => rows.reduce((s, r) => s + r[k], 0) / rows.length;
const result = {
  file: path.basename(file),
  bytes: fs.statSync(file).size,
  splats,
  size,
  background: bg,
  views: rows.length,
  psnr: mean("psnr"),
  ssim: mean("ssim"),
  rows,
};
fs.writeFileSync(path.join(out, "measure.json"), JSON.stringify(result, null, 1));
console.log(`Mean over ${rows.length} views: PSNR ${result.psnr.toFixed(2)} dB, SSIM ${result.ssim.toFixed(4)}`); // prettier-ignore
