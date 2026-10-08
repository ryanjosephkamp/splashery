#!/usr/bin/env node
// Lane Photo fidelity (prefix phf): how well Photo to 3D and Moving photo to 3D keep text legible.
// The toy is rendered paused at phone size (390 by 844, device scale 3), face on, and compared with
// the source frame scaled to the same on-screen size. Two numbers per run:
//
//   ssim    SSIM (grayscale, 8 by 8 Gaussian windows, the usual constants) over the text area:
//           the windows whose source has ink in them.
//   gaps    the stroke-contrast measure of letters staying separate. The text lines of the source
//           (runs of rows with ink, luminance under 0.5) are found and sized by their ink band on
//           screen, in CSS pixels. Within a line, every run of columns with no ink at all between
//           two inked columns is a gap (between letters, or inside a letter: the counter of an "n",
//           an "m"). A gap is kept when, in the render, the lightest of its columns' darkest pixels
//           stands above the darkest pixels of the strokes beside it by at least half as much as in
//           the source. A line reads when 80% of its gaps are kept. Reported: the share of lines of
//           12 to 16 CSS pixels that read, and the share of their gaps kept (lines of other sizes too).
//
// The source is registered on the render (the picture's corners projected by the toy's camera,
// then the best shift within 6 device pixels and scale within 1.5% by correlation), so a pixel's
// misplacement doesn't count as blur.
//
//   python3 -m http.server 4173 --bind 127.0.0.1 &
//   SPLASHERY_CHROMIUM=/opt/pw-browsers/chromium node tools/phf-measure.mjs
//     --toy=photo-3d|moving-photo-3d [--tiers=low,mid,high,max] [--still=.cache/text-scroll/still-05s.png]
//     [--video=.cache/text-scroll/text-scroll.webm] [--rise=0] [--out=.cache/phf-measure] [--label=before]
//     [--url-extra=&x=1] [--view=fit|home] [--detail=photo|splats]
// Writes <out>/<label>-<toy>-<tier>.png (the render) and -crop.png (the picture and the source side
// by side), and prints a JSON line per tier.

import { chromium } from "@playwright/test";
import fs from "node:fs";
import path from "node:path";
import { PNG } from "pngjs";

const args = process.argv.slice(2);
const opt = (name, def) => {
  const a = args.find((x) => x.startsWith(`--${name}=`));
  return a ? a.slice(name.length + 3) : def;
};
const TOY = opt("toy", "photo-3d");
const TIERS = opt("tiers", "low,mid,high,max").split(",");
const OUT = opt("out", ".cache/phf-measure");
const LABEL = opt("label", "now");
const STILL = opt("still", ".cache/text-scroll/still-05s.png");
const VIDEO = opt("video", ".cache/text-scroll/text-scroll.webm");
const RISE = Number(opt("rise", 0));
const EXTRA = opt("url-extra", "");
const DETAIL = opt("detail", ""); // the Detail option (photo: Fine, splats: One color per splat); unset: the default
const VIEW = opt("view", "fit"); // home: as the toy opens; fit: zoomed so the picture fills the width
const SCALE = 3;
fs.mkdirSync(OUT, { recursive: true });
const base = process.env.SPLASHERY_URL || "http://127.0.0.1:4173/";
const info = JSON.parse(
  fs.readFileSync(path.join(path.dirname(STILL), "text-scroll.json"), "utf8"),
);
const stillInfo = info.stills.find((s) => path.basename(s.file) === path.basename(STILL));

// ---- Images ------------------------------------------------------------------------
const lumOf = (png) => {
  const out = new Float32Array(png.width * png.height);
  for (let i = 0; i < out.length; i++) {
    const r = png.data[i * 4] / 255;
    const g = png.data[i * 4 + 1] / 255;
    const b = png.data[i * 4 + 2] / 255;
    out[i] = 0.2126 * r + 0.7152 * g + 0.0722 * b;
  }
  return { w: png.width, h: png.height, d: out };
};

// The source's (sw by sh) luminance resampled into a w by h grid that covers the source rectangle
// [x0, x0 + sw*sx) …: area averaging along each axis (it only ever shrinks here).
function resample(src, w, h, fx, fy, ox, oy) {
  // destination pixel (i, j) covers source x in [ox + i*fx, ox + (i+1)*fx)
  const axis = (n, f, o, size) => {
    const list = [];
    for (let i = 0; i < n; i++) {
      const a = o + i * f;
      const b = a + f;
      const s = Math.floor(a);
      const e = Math.ceil(b);
      const ws = [];
      for (let k = s; k < e; k++) ws.push([Math.min(size - 1, Math.max(0, k)), Math.min(b, k + 1) - Math.max(a, k)]); // prettier-ignore
      const t = ws.reduce((x, y) => x + y[1], 0);
      list.push(ws.map(([k, v]) => [k, v / t]));
    }
    return list;
  };
  const ax = axis(w, fx, ox, src.w);
  const ay = axis(h, fy, oy, src.h);
  const mid = new Float32Array(w * src.h);
  for (let y = 0; y < src.h; y++)
    for (let i = 0; i < w; i++) {
      let s = 0;
      for (const [k, v] of ax[i]) s += src.d[y * src.w + k] * v;
      mid[y * w + i] = s;
    }
  const out = new Float32Array(w * h);
  for (let j = 0; j < h; j++)
    for (let i = 0; i < w; i++) {
      let s = 0;
      for (const [k, v] of ay[j]) s += mid[k * w + i] * v;
      out[j * w + i] = s;
    }
  return { w, h, d: out };
}

const crop = (img, x0, y0, w, h) => {
  const out = new Float32Array(w * h);
  for (let j = 0; j < h; j++)
    for (let i = 0; i < w; i++) {
      const x = Math.min(img.w - 1, Math.max(0, x0 + i));
      const y = Math.min(img.h - 1, Math.max(0, y0 + j));
      out[j * w + i] = img.d[y * img.w + x];
    }
  return { w, h, d: out };
};

function ncc(a, b) {
  let ma = 0;
  let mb = 0;
  const n = a.d.length;
  for (let i = 0; i < n; i++) ((ma += a.d[i]), (mb += b.d[i]));
  ma /= n;
  mb /= n;
  let ab = 0;
  let aa = 0;
  let bb = 0;
  for (let i = 0; i < n; i++) {
    const x = a.d[i] - ma;
    const y = b.d[i] - mb;
    ab += x * y;
    aa += x * x;
    bb += y * y;
  }
  return ab / Math.sqrt(aa * bb + 1e-12);
}

// SSIM over 8 by 8 Gaussian windows (sigma 1.5) on a 4-pixel stride, counting only windows where
// `mask` (the source's ink) has a pixel.
function ssim(a, b, ink) {
  const C1 = 0.01 ** 2;
  const C2 = 0.03 ** 2;
  const g = [];
  let gs = 0;
  for (let j = 0; j < 8; j++)
    for (let i = 0; i < 8; i++) {
      const v = Math.exp(-((i - 3.5) ** 2 + (j - 3.5) ** 2) / (2 * 1.5 * 1.5));
      g.push(v);
      gs += v;
    }
  let sum = 0;
  let n = 0;
  for (let y = 0; y + 8 <= a.h; y += 4)
    for (let x = 0; x + 8 <= a.w; x += 4) {
      let has = false;
      for (let j = 0; j < 8 && !has; j++) for (let i = 0; i < 8; i++) if (ink[(y + j) * a.w + x + i]) { has = true; break; } // prettier-ignore
      if (!has) continue;
      let ma = 0;
      let mb = 0;
      for (let j = 0, k = 0; j < 8; j++)
        for (let i = 0; i < 8; i++, k++) {
          const p = (y + j) * a.w + x + i;
          ma += (g[k] / gs) * a.d[p];
          mb += (g[k] / gs) * b.d[p];
        }
      let va = 0;
      let vb = 0;
      let cv = 0;
      for (let j = 0, k = 0; j < 8; j++)
        for (let i = 0; i < 8; i++, k++) {
          const p = (y + j) * a.w + x + i;
          const w = g[k] / gs;
          va += w * (a.d[p] - ma) ** 2;
          vb += w * (b.d[p] - mb) ** 2;
          cv += w * (a.d[p] - ma) * (b.d[p] - mb);
        }
      sum += ((2 * ma * mb + C1) * (2 * cv + C2)) / ((ma * ma + mb * mb + C1) * (va + vb + C2));
      n++;
    }
  return n ? sum / n : NaN;
}

// The letter-gap measure (see the top). src and ren are the same size (device pixels).
function gaps(src, ren) {
  const { w, h } = src;
  const inkRow = new Uint8Array(h);
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) if (src.d[y * w + x] < 0.5) { inkRow[y] = 1; break; } // prettier-ignore
  // lines: runs of inked rows, merged over gaps of 1 px; dropped when touching the picture's edge
  const lines = [];
  for (let y = 0; y < h; ) {
    if (!inkRow[y]) {
      y++;
      continue;
    }
    let e = y;
    while (e < h && (inkRow[e] || (e + 1 < h && inkRow[e + 1]))) e++;
    if (y > 2 && e < h - 2) lines.push([y, e]);
    y = e;
  }
  const buckets = {};
  for (const [y0, y1] of lines) {
    const css = (y1 - y0) / SCALE;
    const colMin = (img) => {
      const out = new Float32Array(w);
      for (let x = 0; x < w; x++) {
        let m = 1;
        for (let y = y0; y < y1; y++) m = Math.min(m, img.d[y * w + x]);
        out[x] = m;
      }
      return out;
    };
    const sm = colMin(src);
    const rm = colMin(ren);
    const ink = Array.from(sm, (v) => v < 0.5);
    let kept = 0;
    let all = 0;
    let x = ink.indexOf(true);
    while (x >= 0 && x < w) {
      // the ink run [x, a), then the gap [a, b)
      let a = x;
      while (a < w && ink[a]) a++;
      let b = a;
      while (b < w && !ink[b]) b++;
      if (b >= w) break;
      if (b - a <= 4 * SCALE * 2) {
        // (gaps up to 8 CSS px: between letters and words; wider ones are between columns)
        const strokeS = Math.min(
          ...sm.slice(Math.max(x, a - 3), a),
          ...sm.slice(b, Math.min(w, b + 3)),
        );
        const strokeR = Math.min(
          ...rm.slice(Math.max(x, a - 3), a),
          ...rm.slice(b, Math.min(w, b + 3)),
        );
        const gapS = Math.max(...sm.slice(a, b));
        const gapR = Math.max(...rm.slice(a, b));
        const cs = gapS - strokeS;
        if (cs > 0.2) {
          all++;
          if (gapR - strokeR >= 0.5 * cs) kept++;
        }
      }
      x = b;
    }
    if (!all) continue;
    const key =
      css < 9 ? "<9" : css < 12 ? "9-12" : css <= 16 ? "12-16" : css <= 22 ? "16-22" : ">22";
    const B = (buckets[key] ||= { lines: 0, read: 0, gaps: 0, kept: 0 });
    B.lines++;
    B.gaps += all;
    B.kept += kept;
    if (kept / all >= 0.8) B.read++;
  }
  for (const B of Object.values(buckets)) {
    B.readShare = +(B.read / B.lines).toFixed(3);
    B.keptShare = +(B.kept / B.gaps).toFixed(3);
  }
  return buckets;
}

function writeGray(file, imgs) {
  const W = imgs.reduce((s, i) => s + i.w, 0) + 8 * (imgs.length - 1);
  const H = Math.max(...imgs.map((i) => i.h));
  const png = new PNG({ width: W, height: H });
  png.data.fill(255);
  let ox = 0;
  for (const im of imgs) {
    for (let y = 0; y < im.h; y++)
      for (let x = 0; x < im.w; x++) {
        const v = Math.round(255 * Math.min(1, Math.max(0, im.d[y * im.w + x])));
        const o = (y * W + ox + x) * 4;
        png.data[o] = png.data[o + 1] = png.data[o + 2] = v;
        png.data[o + 3] = 255;
      }
    ox += im.w + 8;
  }
  fs.writeFileSync(file, PNG.sync.write(png));
}

// ---- The renders -----------------------------------------------------------------------
const browser = await chromium.launch({
  executablePath: process.env.SPLASHERY_CHROMIUM || undefined,
  args: ["--use-angle=swiftshader", "--enable-unsafe-swiftshader", "--ignore-gpu-blocklist", "--enable-webgl"], // prettier-ignore
});
const source = lumOf(PNG.sync.read(fs.readFileSync(STILL)));
const results = [];
for (const tier of TIERS) {
  const page = await browser.newPage({ viewport: { width: 390, height: 844 }, deviceScaleFactor: SCALE, reducedMotion: "reduce" }); // prettier-ignore
  page.on("pageerror", (e) => console.error("page error:", e.message));
  await page.goto(`${base}?renderer=webgl2&profile=${tier}&adapt=off&labs=1${EXTRA}`);
  await page.waitForSelector("body[data-ready='true']", { timeout: 180_000 });
  const t0 = Date.now();
  let corners;
  if (TOY === "photo-3d") {
    corners = await page.evaluate(
      async ({ still, rise, view, detail }) => {
        const { app, player } = window.__splashery;
        const m = await import("/src/packs/photo-3d.js");
        const bytes = new Uint8Array(await (await fetch(still)).arrayBuffer());
        const photo = await m.decodePhoto(bytes);
        const { estimateDepth } = await import("/src/packs/photo-3d-depth.js");
        const depth = await estimateDepth(photo);
        m.usePhoto(photo, depth, "Text");
        await import("/src/packs/photo-sharp.js")
          .then((s) => s.setSharpView("photo-3d", "splats"))
          .catch(() => {}); // Splats, not the Sharp picture view (lane Photo sharp view)
        await app.chooseToy("photo-3d");
        await app.setToyOptions({ source: "custom", ...(detail ? { detail } : {}) });
        player.idle.weight = 0;
        await new Promise((r) => setTimeout(r, 1500));
        player.motion.setControl("flat", 1 - rise, { snap: true });
        for (let i = 0; i < 6; i++) await player.stage.captureFrame();
        // --view=fit: closer, until the picture's width fills 96% of the canvas (a pinch would)
        const fitView = async (corner) => {
          if (view !== "fit") return;
          for (let k = 0; k < 3; k++) {
            const a = player.screenPoint(corner[0]);
            const b = player.screenPoint(corner[1]);
            const want = 0.96 * player.stage.canvas.getBoundingClientRect().width;
            const c = player.camera;
            c.cur = { ...c.cur, distance: Math.max(c.minDistance, c.cur.distance * (Math.abs(b[0] - a[0]) / want)) }; // prettier-ignore
            c.tgt = { ...c.cur };
            for (let i = 0; i < 3; i++) await player.stage.captureFrame();
          }
        };
        const a0 = photo.w / photo.h;
        await fitView([
          [-a0 / 2, 0, 0],
          [a0 / 2, 0, 0],
        ]);
        for (let i = 0; i < 3; i++) await player.stage.captureFrame();
        // the rows of the page where the toy's canvas is not covered (the header, the sheet, buttons)
        const cvEl = player.stage.canvas;
        const rowsFree = [];
        for (let y = 0; y < innerHeight; y++) {
          const ok = [0.08, 0.3, 0.5, 0.7, 0.92].every(
            (f) => document.elementFromPoint(innerWidth * f, y + 0.5) === cvEl,
          );
          rowsFree.push(ok);
        }
        let bestBand = [0, 0];
        for (let y = 0; y < rowsFree.length; ) {
          if (!rowsFree[y]) {
            y++;
            continue;
          }
          let e = y;
          while (e < rowsFree.length && rowsFree[e]) e++;
          if (e - y > bestBand[1] - bestBand[0]) bestBand = [y, e];
          y = e;
        }
        const s = m.photoState();
        const a = photo.w / photo.h;
        const st = player.stage;
        const cv = st.canvas.getBoundingClientRect();
        const pts = [[-a / 2, 0.5, 0], [a / 2, 0.5, 0], [-a / 2, -0.5, 0], [a / 2, -0.5, 0]].map((p) => player.screenPoint(p)).map(([x, y]) => [x + cv.left, y + cv.top]); // prettier-ignore
        return { pts, band: bestBand, info: s, count: player.kit?.count ?? null };
      },
      { still: "/" + STILL, rise: RISE, view: VIEW, detail: DETAIL },
    );
  } else {
    await page.evaluate(async (detail) => {
      const { app } = window.__splashery;
      await import("/src/packs/photo-sharp.js")
        .then((s) => s.setSharpView("moving-photo-3d", "splats"))
        .catch(() => {}); // Splats, not the Sharp picture view (lane Photo sharp view)
      await app.chooseToy("moving-photo-3d");
      if (detail) await app.setToyOptions({ detail });
    }, DETAIL);
    await page.waitForTimeout(1500);
    await page.setInputFiles("#toy-input-file", VIDEO);
    if (process.env.PHF_VERBOSE) console.error("opened the video");
    corners = await page.evaluate(
      async ({ t, view }) => {
        const { player } = window.__splashery;
        const m = await import("/src/packs/moving-photo.js");
        const until = async (f, ms = 600000) => {
          const end = Date.now() + ms;
          while (!f()) {
            if (Date.now() > end) throw new Error("timed out");
            await new Promise((r) => setTimeout(r, 250));
          }
        };
        await until(() => m.MOVING.clip?.name === "text-scroll" && m.MOVING.grid, 900000);
        player.idle.weight = 0;
        window.__splashery.app.setControl("play", 0);
        await new Promise((r) => setTimeout(r, 500));
        m.movingTransport.seek(t);
        const clip = m.MOVING.clip;
        if (clip.video) {
          clip.video.pause();
          clip.video.currentTime = t;
          await new Promise((r) => clip.video.addEventListener("seeked", r, { once: true }));
        }
        for (let i = 0; i < 8; i++) {
          await player.stage.captureFrame();
          await new Promise((r) => setTimeout(r, 100));
        }
        // --view=fit: closer, until the picture's width fills 96% of the canvas (a pinch would)
        const fitView = async (corner) => {
          if (view !== "fit") return;
          for (let k = 0; k < 3; k++) {
            const a = player.screenPoint(corner[0]);
            const b = player.screenPoint(corner[1]);
            const want = 0.96 * player.stage.canvas.getBoundingClientRect().width;
            const c = player.camera;
            c.cur = { ...c.cur, distance: Math.max(c.minDistance, c.cur.distance * (Math.abs(b[0] - a[0]) / want)) }; // prettier-ignore
            c.tgt = { ...c.cur };
            for (let i = 0; i < 3; i++) await player.stage.captureFrame();
          }
        };
        await fitView([
          [-1, 0, 0],
          [1, 0, 0],
        ]);
        for (let i = 0; i < 3; i++) await player.stage.captureFrame();
        // the rows of the page where the toy's canvas is not covered (the header, the sheet, buttons)
        const cvEl = player.stage.canvas;
        const rowsFree = [];
        for (let y = 0; y < innerHeight; y++) {
          const ok = [0.08, 0.3, 0.5, 0.7, 0.92].every(
            (f) => document.elementFromPoint(innerWidth * f, y + 0.5) === cvEl,
          );
          rowsFree.push(ok);
        }
        let bestBand = [0, 0];
        for (let y = 0; y < rowsFree.length; ) {
          if (!rowsFree[y]) {
            y++;
            continue;
          }
          let e = y;
          while (e < rowsFree.length && rowsFree[e]) e++;
          if (e - y > bestBand[1] - bestBand[0]) bestBand = [y, e];
          y = e;
        }
        const { cols, rows } = m.MOVING.grid;
        const st = player.stage;
        const cv = st.canvas.getBoundingClientRect();
        const hh = rows / cols;
        const z = m.MOVING.full * 0.5;
        const pts = [[-1, hh, z], [1, hh, z], [-1, -hh, z], [1, -hh, z]].map((p) => player.screenPoint(p)).map(([x, y]) => [x + cv.left, y + cv.top]); // prettier-ignore
        return { pts, band: bestBand, info: { grid: [cols, rows], clip: { w: clip.w, h: clip.h, long: !!clip.long }, t: m.MOVING.t }, count: player.kit?.count ?? null }; // prettier-ignore
      },
      { t: stillInfo.t + 1 / (2 * info.fps), view: VIEW },
    );
  }
  const ms = Date.now() - t0;
  const shotFile = path.join(OUT, `${LABEL}-${TOY}-${tier}-${VIEW}.png`);
  await page.screenshot({ path: shotFile, timeout: 180_000 });
  await page.close();
  const shot = lumOf(PNG.sync.read(fs.readFileSync(shotFile)));
  // the picture's rectangle on the screenshot, in device pixels
  const [tl, tr, bl] = corners.pts;
  let rx = tl[0] * SCALE;
  let ry = tl[1] * SCALE;
  let rw = (tr[0] - tl[0]) * SCALE;
  let rh = (bl[1] - tl[1]) * SCALE;
  // keep the part of the picture on screen (inset 2%)
  const inset = 0.02;
  const vis = {
    x0: Math.max(rx + rw * inset, 0),
    y0: Math.max(ry + rh * inset, corners.band[0] * SCALE + 40 * SCALE),
    x1: Math.min(rx + rw * (1 - inset), shot.w),
    y1: Math.min(ry + rh * (1 - inset), corners.band[1] * SCALE - 6),
  };
  const cw = Math.floor(vis.x1 - vis.x0);
  const ch = Math.floor(vis.y1 - vis.y0);
  const ren = crop(shot, Math.round(vis.x0), Math.round(vis.y0), cw, ch);
  // registration: scale (s) and shift (dx, dy) of the source rectangle
  const srcFor = (s, dx, dy, small = 1) => {
    const f = source.w / (rw * s);
    const fy = source.h / (rh * s);
    const ox = (Math.round(vis.x0) - (rx + dx)) * f;
    const oy = (Math.round(vis.y0) - (ry + dy)) * fy;
    return resample(source, Math.floor(cw / small), Math.floor(ch / small), f * small, fy * small, ox, oy); // prettier-ignore
  };
  let best = { c: -2, s: 1, dx: 0, dy: 0 };
  const sub = crop(ren, 0, 0, cw, ch);
  for (const s of [0.985, 0.99, 0.995, 1, 1.005, 1.01, 1.015])
    for (let dx = -12; dx <= 12; dx += 2)
      for (let dy = -12; dy <= 12; dy += 2) {
        const c = ncc(srcFor(s, dx, dy), sub);
        if (c > best.c) best = { c, s, dx, dy };
      }
  for (let dx = best.dx - 1; dx <= best.dx + 1; dx += 0.5)
    for (let dy = best.dy - 1; dy <= best.dy + 1; dy += 0.5) {
      const c = ncc(srcFor(best.s, dx, dy), sub);
      if (c > best.c) best = { ...best, c, dx, dy };
    }
  const src = srcFor(best.s, best.dx, best.dy);
  // match the render's paper and ink levels to the source's (the toy's lighting can shift both)
  const ink = new Uint8Array(src.d.length);
  for (let i = 0; i < ink.length; i++) ink[i] = src.d[i] < 0.5 ? 1 : 0;
  const r = {
    toy: TOY,
    tier,
    view: VIEW,
    label: LABEL,
    ssim: +ssim(src, ren, ink).toFixed(4),
    gaps: gaps(src, ren),
    ncc: +best.c.toFixed(4),
    onScreenCss: [+(rw / SCALE).toFixed(1), +(rh / SCALE).toFixed(1)],
    reg: { s: best.s, dx: best.dx, dy: best.dy },
    info: corners.info,
    count: corners.count,
    buildMs: ms,
  };
  writeGray(path.join(OUT, `${LABEL}-${TOY}-${tier}-${VIEW}-crop.png`), [ren, src]);
  results.push(r);
  console.log(JSON.stringify(r));
}
await browser.close();
fs.writeFileSync(path.join(OUT, `${LABEL}-${TOY}-${VIEW}.json`), JSON.stringify(results, null, 2));
