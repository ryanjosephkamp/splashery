#!/usr/bin/env node
// Lane Live r7 (the owner's note of October 6, 2026: "The moving photo to
// 3d is also still too grainy and needs to be much sharper. It should match
// the sharpness of the photo to 3d toy"): one frame of the Moving photo to
// 3D sample, shown by both toys at phone size, and how sharp each looks.
//
//   python3 -m http.server 4173 --bind 127.0.0.1 &
//   SPLASHERY_CHROMIUM=/opt/pw-browsers/chromium node tools/lv7-sharp-compare.mjs [--frame=24] [--profile=mid] [--out=<dir>]
//   … --mirror=<still.y4m> (tools/lv7-mannequin.mjs --still): the Splat mirror instead, on
//   that camera, against Photo to 3D with the camera's frame and the mirror's depth
//
// It opens Moving photo to 3D (paused on the frame) and then Photo to 3D
// with that frame and its depth as "your photo", both face on at 390 by 844
// at 2x, crops each picture (the same part of the frame), scales the crops
// to one size and prints the variance of their Laplacian (how much fine
// edge they hold; higher is sharper), with the frame itself for reference.
// --out writes the crops and a side-by-side still.

import { chromium } from "@playwright/test";
import { fakeCamera, openMirror } from "./lv7-mirror-measure.mjs";
import { PNG } from "pngjs";
import fs from "node:fs";

const args = process.argv.slice(2);
const opt = (name, def) => {
  const a = args.find((x) => x.startsWith(`--${name}=`));
  return a ? a.slice(name.length + 3) : def;
};
const FRAME = Number(opt("frame", 24));
const PROFILE = opt("profile", "mid");
const OUT = opt("out", null);
const MIRROR_CAM = opt("mirror", null);
const BASE = process.env.SPLASHERY_URL || "http://127.0.0.1:4173/";
const CROP = { x0: 0.08, x1: 0.92, y0: 0.08, y1: 0.92 }; // of the frame, inside the toys' edges
const W = Number(opt("width", 640)); // the crops' common width

// The variance of the 4-neighbor Laplacian of the gray picture.
export function laplacianVariance({ width: w, height: h, data }) {
  const g = new Float32Array(w * h);
  for (let i = 0; i < w * h; i++) g[i] = 0.299 * data[i * 4] + 0.587 * data[i * 4 + 1] + 0.114 * data[i * 4 + 2]; // prettier-ignore
  let s = 0;
  let s2 = 0;
  let n = 0;
  for (let y = 1; y < h - 1; y++)
    for (let x = 1; x < w - 1; x++) {
      const i = y * w + x;
      const l = g[i - 1] + g[i + 1] + g[i - w] + g[i + w] - 4 * g[i];
      s += l;
      s2 += l * l;
      n++;
    }
  const m = s / n;
  return s2 / n - m * m;
}

// Bilinear scale of a PNG to w by h.
function scale(png, w, h) {
  const out = new PNG({ width: w, height: h });
  for (let y = 0; y < h; y++)
    for (let x = 0; x < w; x++) {
      const fx = ((x + 0.5) * png.width) / w - 0.5;
      const fy = ((y + 0.5) * png.height) / h - 0.5;
      const x0 = Math.max(0, Math.min(png.width - 1, Math.floor(fx)));
      const y0 = Math.max(0, Math.min(png.height - 1, Math.floor(fy)));
      const x1 = Math.min(png.width - 1, x0 + 1);
      const y1 = Math.min(png.height - 1, y0 + 1);
      const ax = Math.max(0, Math.min(1, fx - x0));
      const ay = Math.max(0, Math.min(1, fy - y0));
      for (let k = 0; k < 4; k++) {
        const v = (a, b) => png.data[(b * png.width + a) * 4 + k];
        const top = v(x0, y0) * (1 - ax) + v(x1, y0) * ax;
        const bot = v(x0, y1) * (1 - ax) + v(x1, y1) * ax;
        out.data[(y * w + x) * 4 + k] = top * (1 - ay) + bot * ay;
      }
    }
  return out;
}

async function open(page, id) {
  await page.evaluate((id) => window.__splashery.app.chooseToy(id), id);
  await page.waitForFunction((id) => window.__splashery.player.scene?.toy?.id === id && document.getElementById("progress").hidden && window.__splashery.player.motion.recipe, id, { timeout: 180_000 }); // prettier-ignore
}

// The crop of the picture on the page (CSS pixels): its corners projected.
async function shotOf(page, corners) {
  const box = await page.evaluate((cs) => {
    const p = window.__splashery.player;
    const pts = cs.map((c) => p.screenPoint(c));
    const r = document.getElementById("stage").getBoundingClientRect();
    const xs = pts.map((q) => q[0] + r.left);
    const ys = pts.map((q) => q[1] + r.top);
    return { x: Math.min(...xs), y: Math.min(...ys), width: Math.max(...xs) - Math.min(...xs), height: Math.max(...ys) - Math.min(...ys) }; // prettier-ignore
  }, corners);
  await page.evaluate(() => window.__splashery.player.stage.captureFrame?.());
  return PNG.sync.read(await page.screenshot({ clip: box }));
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const base = ["--use-angle=swiftshader", "--enable-unsafe-swiftshader", "--ignore-gpu-blocklist"];
  const browser = await chromium.launch({
    executablePath: process.env.SPLASHERY_CHROMIUM || undefined,
    args: MIRROR_CAM ? fakeCamera(MIRROR_CAM, base) : base,
  });
  const page = await browser.newPage({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2 }); // prettier-ignore
  page.on("pageerror", (e) => console.error("page error:", e.message));
  await page.goto(`${BASE}?renderer=webgl2&adapt=off&profile=${PROFILE}&labs=1`);
  await page.waitForSelector("body[data-ready='true']", { timeout: 180_000 });

  let mv;
  let moving;
  if (MIRROR_CAM) {
    // The Splat mirror on the camera, face on; the frame is the camera's
    // own (mirrored, as the mirror shows it) and its depth the mirror's.
    await openMirror(page, BASE, {});
    mv = await page.evaluate(async () => {
      const { MIRROR } = await import("/src/live/relief.js");
      const cam = MIRROR.cam;
      const v = cam.video;
      const [cx, cy, cw, ch] = cam.crop;
      const w = Math.round(cw * v.videoWidth);
      const h = Math.round(ch * v.videoHeight);
      const c = document.createElement("canvas");
      c.width = w;
      c.height = h;
      const g = c.getContext("2d");
      g.translate(w, 0);
      g.scale(-1, 1);
      g.drawImage(v, cx * v.videoWidth, cy * v.videoHeight, w, h, 0, 0, w, h);
      const near = Array.from(cam.heights, (x) => Math.round(255 * x));
      return { cols: cam.cols, rows: cam.rows, w, h, frame: Array.from(g.getImageData(0, 0, w, h).data), near, dw: cam.cols, dh: cam.rows, count: window.__splashery.player.proc?.ctx?.buf?.count }; // prettier-ignore
    });
    const mh = (2 * mv.rows) / mv.cols;
    const z = await page.evaluate(async () => (await import("/src/live/relief.js")).MIRROR.gain * 0.9 * 0.5); // prettier-ignore
    moving = await shotOf(page, [[CROP.x0, CROP.y0], [CROP.x1, CROP.y0], [CROP.x0, CROP.y1], [CROP.x1, CROP.y1]].map(([u, v]) => [(u - 0.5) * 2, (0.5 - v) * mh, z])); // prettier-ignore
  } else {
    // Moving photo to 3D, paused on the frame, face on.
    await open(page, "moving-photo-3d");
    mv = await page.evaluate(async (f) => {
      const m = await import("/src/packs/moving-photo.js");
      const p = window.__splashery.player;
      if (m.MOVING.clip && (p.motion.state?.play ?? 1) > 0.5) window.__splashery.app.act(); // pause
      await new Promise((r) => setTimeout(r, 400));
      const clip = m.MOVING.clip;
      m.MOVING.t = (f + 0.5) * (clip.duration / clip.n);
      m.MOVING.frame = f;
      p.stage.requestRender();
      const { cols, rows } = m.MOVING.grid;
      return { cols, rows, w: clip.w, h: clip.h, frame: Array.from(clip.colors[f]), near: Array.from(clip.near[f]), count: p.proc?.ctx?.buf?.count }; // prettier-ignore
    }, FRAME);
    await page.waitForTimeout(1500);
    const mh = (2 * mv.rows) / mv.cols;
    const mvCorners = [[CROP.x0, CROP.y0], [CROP.x1, CROP.y0], [CROP.x0, CROP.y1], [CROP.x1, CROP.y1]].map(([u, v]) => [(u - 0.5) * 2, (0.5 - v) * mh, 0.3]); // prettier-ignore
    moving = await shotOf(page, mvCorners);
  }

  // Photo to 3D with the same frame and its depth, flat (as it opens).
  await page.evaluate(async (f) => {
    const p3 = await import("/src/packs/photo-3d.js");
    const d = new Float32Array(f.near.length);
    for (let i = 0; i < d.length; i++) d[i] = f.near[i] / 255;
    p3.usePhoto({ w: f.w, h: f.h, data: new Uint8ClampedArray(f.frame) }, { w: f.dw || f.w, h: f.dh || f.h, d }, "Moving photo frame"); // prettier-ignore
  }, mv);
  await open(page, "photo-3d");
  await page.evaluate(() => window.__splashery.app.setToyOptions({ source: "custom" }));
  await page.waitForTimeout(800);
  await page.waitForFunction(() => document.getElementById("progress").hidden && window.__splashery.player.proc?.ctx?.kit?.data?.photo?.custom, null, { timeout: 180_000 }); // prettier-ignore
  await page.waitForTimeout(1500);
  const p3 = await page.evaluate(() => ({ count: window.__splashery.player.proc?.ctx?.buf?.count, info: window.__splashery.player.proc.ctx.kit.data.photo })); // prettier-ignore
  const aspect = mv.w / mv.h;
  const pCorners = [[CROP.x0, CROP.y0], [CROP.x1, CROP.y0], [CROP.x0, CROP.y1], [CROP.x1, CROP.y1]].map(([u, v]) => [(u - 0.5) * aspect, 0.5 - v, 0]); // prettier-ignore
  const photo = await shotOf(page, pCorners);

  // The frame itself, cropped the same.
  const fx0 = Math.round(CROP.x0 * mv.w);
  const fy0 = Math.round(CROP.y0 * mv.h);
  const fw = Math.round((CROP.x1 - CROP.x0) * mv.w);
  const fh = Math.round((CROP.y1 - CROP.y0) * mv.h);
  const src = new PNG({ width: fw, height: fh });
  for (let y = 0; y < fh; y++)
    for (let x = 0; x < fw; x++)
      for (let k = 0; k < 4; k++) src.data[(y * fw + x) * 4 + k] = k === 3 ? 255 : mv.frame[((fy0 + y) * mv.w + fx0 + x) * 4 + k]; // prettier-ignore

  const H = Math.round((W * fh) / fw);
  const a = scale(moving, W, H);
  const b = scale(photo, W, H);
  const c = scale(src, W, H);
  const res = {
    frame: FRAME,
    profile: PROFILE,
    toy: MIRROR_CAM ? "splat-mirror" : "moving-photo-3d",
    movingSplats: mv.count,
    movingGrid: `${mv.cols}x${mv.rows}`,
    photoSplats: p3.count,
    photoGrid: p3.info?.grid?.join("x"),
    shownPx: [moving.width, moving.height],
    moving: laplacianVariance(a),
    photo3d: laplacianVariance(b),
    source: laplacianVariance(c),
  };
  res.ratio = res.moving / res.photo3d;
  console.log(JSON.stringify(res, null, 1));
  if (OUT) {
    fs.mkdirSync(OUT, { recursive: true });
    const side = new PNG({ width: W * 3 + 16, height: H });
    side.data.fill(255);
    for (const [img, at] of [[a, 0], [b, W + 8], [c, 2 * W + 16]])
      for (let y = 0; y < H; y++) img.data.copy(side.data, (y * side.width + at) * 4, y * W * 4, (y + 1) * W * 4); // prettier-ignore
    fs.writeFileSync(`${OUT}/compare.png`, PNG.sync.write(side));
  }
  await browser.close();
}
