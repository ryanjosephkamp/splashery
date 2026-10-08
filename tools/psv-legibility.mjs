#!/usr/bin/env node
// Lane Photo sharp view (October 8, 2026): how well text reads in Photo to 3D and Moving photo to
// 3D, in the splats and in the Sharp view, measured on the shared test material
// (tools/text-scroll-video.mjs).
//
//   python3 -m http.server 4173 --bind 127.0.0.1 &
//   node tools/text-scroll-video.mjs                     (once: .cache/text-scroll/)
//   SPLASHERY_CHROMIUM=/opt/pw-browsers/chromium node tools/psv-legibility.mjs
//     --toy=photo-3d|moving-photo-3d [--at=10] [--views=splats,sharp] [--profile=mid]
//     [--out=.cache/psv-legibility] [--renderer=webgl2] [--zoom=home|max]
//
// Photo to 3D opens the still at --at seconds as a photo; Moving photo to 3D opens the whole video
// and pauses at --at seconds. Each view is rendered paused, face-on, at 390 x 844 and device scale
// 3, in focus mode (only the toy on screen), with the depth raised, at the toy's own view or
// (--zoom=max) zoomed in as far as the toy lets a finger zoom. The source frame is scaled to
// the picture's size on screen (box filter) and the two are compared:
//
//   - SSIM on the text area: each text line, cut into pieces about eight line heights long, each
//     piece matched to the render by its best shift (60% of a line height down, 12 pixels across:
//     the relief bends the picture a little), then SSIM of luminance in 8 x 8 windows every 4
//     pixels, averaged by area. The picture as a whole is placed first by the best shift of up to 6
//     pixels and a scale within 1.5% (the relief puts it a little nearer or farther than its middle).
//   - Letters apart: for each text line set at 12 to 16 CSS pixels, the ink runs are counted along
//     each pixel row of the middle 40% of the line (the x-height band), ink being darker than the
//     midpoint of the reference line's 10th and 90th percentile luminance; the line's count is the
//     median over those rows. A line keeps its letters apart when the render has at least 70% of
//     the reference's runs (blur merges neighboring letters into one run; a hole or speckle splits
//     them, so the measure also reports lines with more than 130%). The share of lines that pass.
//
// Writes the renders, the scaled references and a JSON of the numbers to --out.

import { chromium } from "@playwright/test";
import fs from "node:fs";
import path from "node:path";
import { PNG } from "pngjs";

const args = process.argv.slice(2);
const opt = (name, def) => {
  const a = args.find((x) => x.startsWith(`--${name}=`));
  return a ? a.slice(name.length + 3) : def;
};
const toy = opt("toy", "photo-3d");
const at = Number(opt("at", 10));
const views = opt("views", "splats,sharp").split(",");
const profile = opt("profile", "mid");
const renderer = opt("renderer", "webgl2");
const src = opt("src", ".cache/text-scroll");
const out = opt("out", ".cache/psv-legibility");
const zoom = opt("zoom", "home"); // "home" (the toy's own view) or "max" (zoomed in as far as it goes)
const base = process.env.SPLASHERY_URL || "http://127.0.0.1:4173/";
const W = 390;
const H = 844;
const DPR = 3;
fs.mkdirSync(out, { recursive: true });

const meta = JSON.parse(fs.readFileSync(path.join(src, "text-scroll.json"), "utf8"));
const still = meta.stills.find((s) => s.t === at);
if (!still) throw new Error(`No still at ${at} s (stills: ${meta.stills.map((s) => s.t)}).`);
const srcPng = PNG.sync.read(fs.readFileSync(path.join(src, still.file)));

// ---- Rendering ----------------------------------------------------------------------------

async function render() {
  const browser = await chromium.launch({
    executablePath: process.env.SPLASHERY_CHROMIUM || undefined,
    args: ["--use-angle=swiftshader", "--enable-unsafe-swiftshader", "--ignore-gpu-blocklist",
      "--enable-unsafe-webgpu", "--enable-features=Vulkan,WebGPU", "--use-webgpu-adapter=swiftshader", "--use-vulkan=swiftshader"], // prettier-ignore
  });
  const page = await browser.newPage({ viewport: { width: W, height: H }, deviceScaleFactor: DPR });
  page.on("pageerror", (e) => console.log("page error:", e.message));
  await page.goto(`${base}?renderer=${renderer}&adapt=off&profile=${profile}&labs=1`);
  await page.waitForSelector("body[data-ready='true']", { timeout: 180_000 });
  await page.evaluate((t) => window.__splashery.app.chooseToy(t), toy);
  await page.waitForFunction(() => !window.__splashery.player.loading && window.__splashery.player.proc?.ctx?.kit?.data, null, { timeout: 120_000 }); // prettier-ignore
  const file = toy === "photo-3d" ? path.join(src, still.file) : path.join(src, "text-scroll.mp4");
  await page.locator("#toy-input-file").setInputFiles(file);
  const t0 = Date.now();
  if (toy === "photo-3d") {
    await page.waitForFunction(() => window.__splashery.player.proc?.ctx?.kit?.data?.photo?.custom === true, null, { timeout: 600_000 }); // prettier-ignore
    await page.evaluate(() => window.__splashery.app.act()); // raise the depth
    await page.waitForFunction(() => window.__splashery.player.motion.state.flat < 0.002, null, { timeout: 60_000 }); // prettier-ignore
  } else {
    await page.evaluate(async () => (window.__mv = (await import("/src/packs/moving-photo.js")).MOVING)); // prettier-ignore
    await page.waitForFunction(
      () => {
        const c = window.__mv.clip;
        return (
          c?.name === "text-scroll" &&
          !window.__splashery.player.loading &&
          (!c.long || c.depth.ready >= c.depth.n)
        );
      },
      null,
      { timeout: 1_200_000, polling: 2000 },
    );
    await page.evaluate(async (t) => {
      const m = await import("/src/packs/moving-photo.js");
      window.__splashery.app.setControl("play", 0);
      m.movingTransport.seek(t);
    }, at);
  }
  const took = (Date.now() - t0) / 1000;
  await page.keyboard.press("f"); // focus mode: only the toy
  await page.waitForTimeout(800);
  await page.evaluate(() => window.__splashery.app.resetView?.() ?? window.__splashery.player.camera.reset()); // prettier-ignore
  if (zoom === "max") {
    await page.evaluate(() => window.__splashery.player.camera.zoomBy(0.001));
    await page.waitForTimeout(2500);
  }
  const shots = {};
  for (const view of views) {
    await page.evaluate(
      async ([t, v]) => {
        const m = await import("/src/packs/photo-sharp.js");
        m.setSharpView(t, v);
      },
      [toy, view],
    );
    await page.waitForTimeout(2500);
    if (toy !== "photo-3d") {
      await page.evaluate(async (t) => (await import("/src/packs/moving-photo.js")).movingTransport.seek(t), at); // prettier-ignore
      await page.waitForTimeout(2500);
    }
    // The picture's corners on screen (CSS pixels): its plane at the middle of its relief.
    const rect = await page.evaluate(async (t) => {
      const pl = window.__splashery.player;
      let hw, hh, z;
      if (t === "photo-3d") {
        const p = pl.proc.ctx.kit.data.photo;
        const s = (await import("/src/packs/photo-sharp.js")).sharpState();
        hw = (s.color ? s.color[0] / s.color[1] : 1080 / 2340) / 2;
        hh = 0.5;
        z = 0 * p.relief;
      } else {
        const d = pl.proc.ctx.kit.data.moving;
        const m = await import("/src/packs/moving-photo.js");
        hw = 1;
        hh = d.rows / d.cols;
        z = m.MOVING.full * 0.5;
      }
      const cv = pl.canvas.getBoundingClientRect();
      const tl = pl.stage.toScreen(pl.fromRecipe([-hw, hh, z]));
      const br = pl.stage.toScreen(pl.fromRecipe([hw, -hh, z]));
      return { x0: tl[0] + cv.left, y0: tl[1] + cv.top, x1: br[0] + cv.left, y1: br[1] + cv.top };
    }, toy);
    const state = await page.evaluate(async () => (await import("/src/packs/photo-sharp.js")).sharpState()); // prettier-ignore
    const png = await page.screenshot({ type: "png" });
    fs.writeFileSync(path.join(out, `${toy}-${view}-${at}s-${zoom}.png`), png);
    shots[view] = { png: PNG.sync.read(png), rect, state };
  }
  await browser.close();
  return { shots, took };
}

// ---- Measuring ----------------------------------------------------------------------------

const lum = (p, i) => 0.299 * p.data[i] + 0.587 * p.data[i + 1] + 0.114 * p.data[i + 2];

// The source scaled to w x h by box filtering (exact coverage), as luminance.
function boxScale(png, w, h) {
  const out = new Float32Array(w * h);
  const sx = png.width / w;
  const sy = png.height / h;
  for (let y = 0; y < h; y++) {
    const ya = y * sy;
    const yb = ya + sy;
    for (let x = 0; x < w; x++) {
      const xa = x * sx;
      const xb = xa + sx;
      let s = 0;
      let n = 0;
      for (let j = Math.floor(ya); j < Math.ceil(yb) && j < png.height; j++) {
        const wy = Math.min(yb, j + 1) - Math.max(ya, j);
        for (let i = Math.floor(xa); i < Math.ceil(xb) && i < png.width; i++) {
          const wx = Math.min(xb, i + 1) - Math.max(xa, i);
          s += lum(png, (j * png.width + i) * 4) * wx * wy;
          n += wx * wy;
        }
      }
      out[y * w + x] = s / n;
    }
  }
  return out;
}

function crop(png, x0, y0, w, h) {
  const out = new Float32Array(w * h);
  for (let y = 0; y < h; y++)
    for (let x = 0; x < w; x++) {
      const X = Math.min(png.width - 1, Math.max(0, x0 + x));
      const Y = Math.min(png.height - 1, Math.max(0, y0 + y));
      out[y * w + x] = lum(png, (Y * png.width + X) * 4);
    }
  return out;
}

// Mean SSIM of a and b (w wide) over 8 x 8 windows every 4 pixels whose centers fall in mask.
function ssim(a, b, w, h, mask = null) {
  const C1 = (0.01 * 255) ** 2;
  const C2 = (0.03 * 255) ** 2;
  let sum = 0;
  let n = 0;
  for (let y = 0; y + 8 <= h; y += 4)
    for (let x = 0; x + 8 <= w; x += 4) {
      if (mask && !mask[(y + 4) * w + x + 4]) continue;
      let ma = 0;
      let mb = 0;
      for (let j = 0; j < 8; j++)
        for (let i = 0; i < 8; i++) {
          ma += a[(y + j) * w + x + i];
          mb += b[(y + j) * w + x + i];
        }
      ma /= 64;
      mb /= 64;
      let va = 0;
      let vb = 0;
      let cov = 0;
      for (let j = 0; j < 8; j++)
        for (let i = 0; i < 8; i++) {
          const da = a[(y + j) * w + x + i] - ma;
          const db = b[(y + j) * w + x + i] - mb;
          va += da * da;
          vb += db * db;
          cov += da * db;
        }
      va /= 63;
      vb /= 63;
      cov /= 63;
      sum += ((2 * ma * mb + C1) * (2 * cov + C2)) / ((ma * ma + mb * mb + C1) * (va + vb + C2));
      n++;
    }
  return n ? sum / n : 0;
}

function runsOf(img, w, x0, x1, y, T) {
  let n = 0;
  let ink = false;
  for (let x = x0; x < x1; x++) {
    const d = img[y * w + x] < T;
    if (d && !ink) n++;
    ink = d;
  }
  return n;
}

function measure(shot) {
  const r = shot.rect;
  const px = (v) => Math.round(v * DPR);
  let x0 = px(r.x0);
  let y0 = px(r.y0);
  let w = px(r.x1) - x0;
  let h = px(r.y1) - y0;
  // Best shift and scale (on a band through the middle of the picture, for speed).
  const band = { x: Math.round(w * 0.2), y: Math.round(h * 0.4), w: Math.round(w * 0.6), h: Math.round(h * 0.2) }; // prettier-ignore
  let best = { s: -1 };
  for (const k of [0.985, 1, 1.015]) {
    const kw = Math.round(w * k);
    const kh = Math.round(h * k);
    const ref = boxScale(srcPng, kw, kh);
    const bx = Math.round(band.x * k);
    const by = Math.round(band.y * k);
    const refBand = new Float32Array(band.w * band.h);
    for (let y = 0; y < band.h; y++)
      for (let x = 0; x < band.w; x++) refBand[y * band.w + x] = ref[(by + y) * kw + bx + x];
    for (let dy = -6; dy <= 6; dy += 2)
      for (let dx = -6; dx <= 6; dx += 2) {
        const ox = x0 - Math.round((kw - w) / 2) + dx;
        const oy = y0 - Math.round((kh - h) / 2) + dy;
        const ren = crop(shot.png, ox + bx, oy + by, band.w, band.h);
        const s = ssim(refBand, ren, band.w, band.h);
        if (s > best.s) best = { s, k, dx, dy, ox, oy, kw, kh, ref };
      }
  }
  // (refine the shift to one pixel)
  for (let dy = -1; dy <= 1; dy++)
    for (let dx = -1; dx <= 1; dx++) {
      if (!dx && !dy) continue;
      const bx = Math.round(band.x * best.k);
      const by = Math.round(band.y * best.k);
      const refBand = new Float32Array(band.w * band.h);
      for (let y = 0; y < band.h; y++)
        for (let x = 0; x < band.w; x++)
          refBand[y * band.w + x] = best.ref[(by + y) * best.kw + bx + x];
      const ren = crop(shot.png, best.ox + dx + bx, best.oy + dy + by, band.w, band.h);
      const s = ssim(refBand, ren, band.w, band.h);
      if (s > best.s) best = { ...best, s, ox: best.ox + dx, oy: best.oy + dy };
    }
  ({ kw: w, kh: h, ox: x0, oy: y0 } = best);
  const ref = best.ref;
  const ren = crop(shot.png, x0, y0, w, h);
  // Only what is on screen counts.
  const visTop = Math.max(0, -y0);
  const visBot = Math.min(h, H * DPR - y0);
  const fx = w / srcPng.width;
  const fy = h / srcPng.height;
  // Each line is cut into pieces about eight line heights long, and each piece is matched on its
  // own (the best shift within 60% of a line height down and 12 pixels across, by correlation): the
  // relief bends the picture a little, so a whole line rarely sits exactly where it is in the source.
  const lines = [];
  let ssSum = 0;
  let ssArea = 0;
  for (const l of still.lines) {
    const lx0 = Math.max(0, Math.round(l.x0 * meta.dpr * fx));
    const lx1 = Math.min(w, Math.round(l.x1 * meta.dpr * fx));
    const ly0 = Math.round(l.y0 * meta.dpr * fy);
    const ly1 = Math.round(l.y1 * meta.dpr * fy);
    const lh = ly1 - ly0;
    const reach = Math.max(4, Math.round(lh * 0.6));
    if (ly0 - reach < visTop || ly1 + reach > visBot || ly0 < 0 || ly1 > h || lx1 - lx0 < lh)
      continue;
    const vals = [];
    for (let y = ly0; y < ly1; y++) for (let x = lx0; x < lx1; x++) vals.push(ref[y * w + x]);
    vals.sort((a, b) => a - b);
    const T = (vals[Math.floor(vals.length * 0.1)] + vals[Math.floor(vals.length * 0.9)]) / 2;
    const seg = Math.max(lh * 8, 64);
    let nRef = 0;
    let nRen = 0;
    for (let sx = lx0; sx < lx1; sx += seg) {
      const sw = Math.min(seg, lx1 - sx);
      if (sw < lh) continue;
      const a = new Float32Array(sw * lh);
      for (let y = 0; y < lh; y++)
        for (let x = 0; x < sw; x++) a[y * sw + x] = ref[(ly0 + y) * w + sx + x];
      let ma = 0;
      for (const v of a) ma += v;
      ma /= a.length;
      let best = { c: -Infinity, b: null };
      for (let dy = -reach; dy <= reach; dy++)
        for (let dx = -12; dx <= 12; dx += 2) {
          const b = crop(shot.png, x0 + sx + dx, y0 + ly0 + dy, sw, lh);
          let mb = 0;
          for (const v of b) mb += v;
          mb /= b.length;
          let num = 0;
          let da = 0;
          let db = 0;
          for (let i = 0; i < a.length; i++) {
            num += (a[i] - ma) * (b[i] - mb);
            da += (a[i] - ma) ** 2;
            db += (b[i] - mb) ** 2;
          }
          const c = num / Math.sqrt(da * db + 1e-9);
          if (c > best.c) best = { c, b };
        }
      ssSum += ssim(a, best.b, sw, lh) * sw * lh;
      ssArea += sw * lh;
      // ink runs along the middle 40% of the line, the median over its rows
      const runs = (img) => {
        const c = [];
        for (let y = Math.round(lh * 0.3); y <= Math.round(lh * 0.7); y++)
          c.push(runsOf(img, sw, 0, sw, y, T));
        c.sort((p, q) => p - q);
        return c[c.length >> 1];
      };
      nRef += runs(a);
      nRen += runs(best.b);
    }
    if (l.size < 12 || l.size > 16 || nRef < 3) continue;
    lines.push({ size: l.size, ref: nRef, ren: nRen, ok: nRen >= 0.7 * nRef && nRen <= 1.3 * nRef, split: nRen > 1.3 * nRef }); // prettier-ignore
  }
  const bySize = {};
  for (const l of lines) {
    const b = (bySize[l.size] ||= { n: 0, ok: 0 });
    b.n++;
    if (l.ok) b.ok++;
  }
  return {
    ssimText: ssArea ? +(ssSum / ssArea).toFixed(4) : null,
    lines: lines.length,
    apart: lines.length ? +(lines.filter((l) => l.ok).length / lines.length).toFixed(3) : null,
    split: lines.filter((l) => l.split).length,
    bySize,
    onScreen: [w, h],
    shift: [best.dx, best.dy, best.k],
    refPng: { ref, w, h },
  };
}

const { shots, took } = await render();
const result = { toy, at, zoom, profile, renderer, opened: `${took.toFixed(0)} s`, views: {} };
for (const view of views) {
  const m = measure(shots[view]);
  const { refPng, ...nums } = m;
  result.views[view] = { ...nums, state: shots[view].state };
  if (view === views[0]) {
    const p = new PNG({ width: refPng.w, height: refPng.h });
    for (let i = 0; i < refPng.w * refPng.h; i++) {
      const v = Math.round(refPng.ref[i]);
      p.data.set([v, v, v, 255], i * 4);
    }
    fs.writeFileSync(path.join(out, `${toy}-reference-${at}s-${zoom}.png`), PNG.sync.write(p));
  }
}
fs.writeFileSync(path.join(out, `${toy}-${at}s-${zoom}.json`), JSON.stringify(result, null, 1));
console.log(JSON.stringify(result, (k, v) => (k === "state" ? undefined : v), 1));
