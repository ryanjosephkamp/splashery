#!/usr/bin/env node
// Lane Space r2: the real worlds' maps. Reads each world's color and
// elevation maps from NASA, USGS and NOAA (public domain; the sources and
// their pages are in src/space/worlds.js and tools/assets.json), and writes
// small equirectangular maps for the toys:
//
//   assets/toys/real-worlds/<world>-color.jpg      1536 × 768, east to the right
//   assets/toys/real-worlds/<world>-height.bin     1024 × 512 heights (the SPH1 format below)
//   assets/toys/real-worlds/<world>-night.jpg      1024 × 512 lights at night (Earth)
//   assets/toys/real-worlds/<world>-<feature>-color.jpg / -height.bin
//                                                  a close-up patch round each named feature
//
//   node tools/sp2-maps.mjs                 # every world
//   node tools/sp2-maps.mjs moon mars       # some
//   node tools/sp2-maps.mjs --patches-only mars
//
// Every map is longitude −180° to 180° east (left to right) and latitude 90°
// to −90° (top to bottom), whatever the source's own layout. Big sources are
// streamed and averaged as they arrive (tools/sp2-tiff.mjs), never stored.
//
// The SPH1 height file (read by src/space/maps.js): "SPH1", uint16 width,
// uint16 height, float32 step and float32 base (meters: height = base + step
// × v), then zlib-deflated int16 values v, row by row, each row's values
// stored as its difference from the plane through its left, upper and
// upper-left neighbors (missing neighbors count as 0).

import fs from "node:fs";
import path from "node:path";
import zlib from "node:zlib";
import jpeg from "jpeg-js";
import { openTiff, readRows } from "./sp2-tiff.mjs";
import { WORLDS } from "../src/space/worlds.js";

const OUT = "assets/toys/real-worlds";
const CACHE = ".cache/sp2";
const args = process.argv.slice(2);
const only = args.filter((a) => !a.startsWith("--"));
const patchesOnly = args.includes("--patches-only");
const noPatches = args.includes("--no-patches");

// ---- Sources ------------------------------------------------------------------------------

// A source is { url, kind: "tiff" | "jpeg", lonLeft (east longitude of the
// left edge, degrees), scale, offset (value → meters or 0..255), nodata,
// gray (one channel shown as gray) }.
async function openSource(s) {
  if (s.kind === "jpeg") {
    fs.mkdirSync(CACHE, { recursive: true });
    const file = path.join(CACHE, path.basename(new URL(s.url).pathname));
    if (!fs.existsSync(file)) {
      const r = await fetch(s.url);
      if (!r.ok) throw new Error(`${s.url}: HTTP ${r.status}`);
      fs.writeFileSync(file, Buffer.from(await r.arrayBuffer()));
    }
    const img = jpeg.decode(fs.readFileSync(file), { maxMemoryUsageInMB: 4096, maxResolutionInMP: 600 }); // prettier-ignore
    const t = { width: img.width, height: img.height, spp: 3, mem: img.data };
    return { t, s };
  }
  const t = await openTiff(s.url);
  return { t, s };
}

async function rowsOf({ t }, y0, y1, onRow) {
  if (!t.mem) return readRows(t, y0, y1, onRow);
  const vals = new Float64Array(t.width * 3);
  for (let y = y0; y < y1; y++) {
    for (let x = 0; x < t.width; x++)
      for (let c = 0; c < 3; c++) vals[x * 3 + c] = t.mem[(y * t.width + x) * 4 + c];
    onRow(y, vals);
  }
}

// Resamples a source into a w × h grid over a window (east longitudes lonA
// to lonB, latitudes latTop to latBottom) with ch channels (1 for heights,
// 3 for color). Area-averages when the source is finer; bilinear when it is
// coarser. Returns { data: Float32Array, cover: fraction with data }.
async function resample(src, { lonA = -180, lonB = 180, latTop = 90, latBottom = -90, w, h, ch }) {
  const { t, s } = src;
  const W = t.width;
  const H = t.height;
  const spp = t.spp;
  const lat0 = s.latTop ?? 90;
  const lat1 = s.latBottom ?? -90;
  const lonLeft = s.lonLeft ?? -180;
  const span = s.lonSpan ?? 360;
  const scale = s.scale ?? 1;
  const offset = s.offset ?? 0;
  const value = (vals, x, c) => {
    const v = vals[x * spp + (spp === 1 ? 0 : c)];
    if (s.nodata !== undefined && s.nodata !== null && (v === s.nodata || (s.nodataBelow !== undefined && v < s.nodataBelow))) return NaN; // prettier-ignore
    if (!Number.isFinite(v) || v < -1e30) return NaN;
    return offset + scale * v;
  };
  const rowOfLat = (lat) => ((lat0 - lat) / (lat0 - lat1)) * H;
  const colOfLon = (lon) => ((((lon - lonLeft) % 360) + 360) % 360) * (W / span);
  const winW = (((lonB - lonA) % 360) + 360) % 360 || 360;
  const srcPerOut = ((winW / 360) * (W * (360 / span))) / w;
  const out = new Float32Array(w * h * ch);
  const wsum = new Float32Array(w * h);
  const yA = Math.max(0, Math.floor(rowOfLat(latTop)) - 1);
  const yB = Math.min(H, Math.ceil(rowOfLat(latBottom)) + 1);
  if (srcPerOut >= 1.2) {
    // Each source pixel into the output pixel holding its center.
    const tx = new Int32Array(W).fill(-1);
    for (let x = 0; x < W; x++) {
      const lon = lonLeft + ((x + 0.5) / W) * span;
      const d = (((lon - lonA) % 360) + 360) % 360;
      if (d < winW) tx[x] = Math.min(w - 1, Math.floor((d / winW) * w));
    }
    let done = 0;
    await rowsOf(src, yA, yB, (y, vals) => {
      const lat = lat0 - ((y + 0.5) / H) * (lat0 - lat1);
      if (lat > latTop || lat < latBottom) return;
      const ty = Math.min(h - 1, Math.floor(((latTop - lat) / (latTop - latBottom)) * h));
      for (let x = 0; x < W; x++) {
        const o = tx[x];
        if (o < 0) continue;
        const v0 = value(vals, x, 0);
        if (Number.isNaN(v0)) continue;
        const k = ty * w + o;
        wsum[k]++;
        out[k * ch] += v0;
        for (let c = 1; c < ch; c++) out[k * ch + c] += value(vals, x, c);
      }
      if (++done % 2000 === 0) process.stdout.write(`  ${Math.round((100 * done) / (yB - yA))}%\r`);
    });
  } else {
    // Coarser source: hold its rows in the window, then sample bilinearly.
    const rows = new Map();
    await rowsOf(src, yA, yB, (y, vals) => {
      const r = new Float32Array(W * ch);
      for (let x = 0; x < W; x++) for (let c = 0; c < ch; c++) r[x * ch + c] = value(vals, x, c);
      rows.set(y, r);
    });
    for (let j = 0; j < h; j++) {
      const lat = latTop - ((j + 0.5) / h) * (latTop - latBottom);
      const fy = Math.min(yB - 1, Math.max(yA, rowOfLat(lat) - 0.5));
      const y0 = Math.floor(fy);
      const y1 = Math.min(yB - 1, y0 + 1);
      const ay = fy - y0;
      for (let i = 0; i < w; i++) {
        const lon = lonA + ((i + 0.5) / w) * winW;
        const fx = colOfLon(lon) - 0.5;
        const x0 = Math.floor(fx);
        const ax = fx - x0;
        const xs = [((x0 % W) + W) % W, (((x0 + 1) % W) + W) % W];
        const k = j * w + i;
        let ok = 0;
        for (let c = 0; c < ch; c++) {
          const a = rows.get(y0);
          const b = rows.get(y1);
          const v =
            (1 - ay) * ((1 - ax) * a[xs[0] * ch + c] + ax * a[xs[1] * ch + c]) +
            ay * ((1 - ax) * b[xs[0] * ch + c] + ax * b[xs[1] * ch + c]);
          if (Number.isNaN(v)) break;
          out[k * ch + c] = v;
          ok = 1;
        }
        wsum[k] = ok;
        if (!ok) for (let c = 0; c < ch; c++) out[k * ch + c] = 0;
      }
    }
  }
  let have = 0;
  for (let k = 0; k < w * h; k++) {
    if (wsum[k] > 0) {
      have++;
      for (let c = 0; c < ch; c++) out[k * ch + c] /= wsum[k];
    } else for (let c = 0; c < ch; c++) out[k * ch + c] = NaN;
  }
  return { data: out, cover: have / (w * h), w, h, ch };
}

// Fills the gaps (NaN) from their neighbors, a ring at a time, then smooths
// only the filled cells, so a map with missing pieces has no cliffs.
function fillGaps(g, wrap = true) {
  const { data, w, h, ch } = g;
  const missing = new Uint8Array(w * h);
  let left = 0;
  for (let k = 0; k < w * h; k++) if (Number.isNaN(data[k * ch])) ((missing[k] = 1), left++);
  const filled = missing.slice();
  for (let pass = 0; left > 0 && pass < 4000; pass++) {
    const next = [];
    for (let j = 0; j < h; j++)
      for (let i = 0; i < w; i++) {
        const k = j * w + i;
        if (!missing[k]) continue;
        const sum = new Float64Array(ch);
        let n = 0;
        for (const [di, dj] of [
          [1, 0],
          [-1, 0],
          [0, 1],
          [0, -1],
        ]) {
          // prettier-ignore
          let ii = i + di;
          const jj = j + dj;
          if (jj < 0 || jj >= h) continue;
          if (ii < 0 || ii >= w) {
            if (!wrap) continue;
            ii = (ii + w) % w;
          }
          const kk = jj * w + ii;
          if (missing[kk]) continue;
          for (let c = 0; c < ch; c++) sum[c] += data[kk * ch + c];
          n++;
        }
        if (n) next.push([k, Array.from(sum, (v) => v / n)]);
      }
    for (const [k, v] of next) {
      for (let c = 0; c < ch; c++) data[k * ch + c] = v[c];
      missing[k] = 0;
      left--;
    }
    if (!next.length) break;
  }
  for (let k = 0; k < w * h; k++) if (missing[k]) for (let c = 0; c < ch; c++) data[k * ch + c] = 0;
  // Relax the filled cells toward their neighbors' mean.
  for (let it = 0; it < 60; it++)
    for (let j = 1; j < h - 1; j++)
      for (let i = 0; i < w; i++) {
        const k = j * w + i;
        if (!filled[k]) continue;
        const l = j * w + ((i + w - 1) % w);
        const r = j * w + ((i + 1) % w);
        for (let c = 0; c < ch; c++)
          data[k * ch + c] =
            (data[l * ch + c] + data[r * ch + c] + data[k * ch - w * ch + c] + data[k * ch + w * ch + c]) / 4; // prettier-ignore
      }
  return filled;
}

// ---- Writers ------------------------------------------------------------------------------

function writeColor(file, g, { gray = false, quality = 80, gain = 1, gamma = 1 } = {}) {
  const { data, w, h, ch } = g;
  const rgba = Buffer.alloc(w * h * 4);
  for (let k = 0; k < w * h; k++) {
    for (let c = 0; c < 3; c++) {
      let v = data[k * ch + (ch === 1 || gray ? 0 : c)];
      v = 255 * Math.pow(Math.max(0, (v * gain) / 255), gamma);
      rgba[k * 4 + c] = Math.max(0, Math.min(255, Math.round(v)));
    }
    rgba[k * 4 + 3] = 255;
  }
  const enc = jpeg.encode({ data: rgba, width: w, height: h }, quality);
  fs.writeFileSync(file, enc.data);
  return enc.data.length;
}

export function encodeHeights(values, w, h, minStep = 8) {
  let lo = Infinity;
  let hi = -Infinity;
  for (const v of values) {
    if (v < lo) lo = v;
    if (v > hi) hi = v;
  }
  const base = (lo + hi) / 2;
  const step = Math.max(minStep, (hi - lo) / 30000);
  const v = new Int32Array(w * h);
  for (let k = 0; k < w * h; k++) v[k] = Math.round((values[k] - base) / step);
  // Each value as its difference from a plane through its left, upper and
  // upper-left neighbors (0 outside the map).
  const q = new Int16Array(w * h);
  for (let j = 0; j < h; j++)
    for (let i = 0; i < w; i++) {
      const l = i ? v[j * w + i - 1] : 0;
      const u = j ? v[(j - 1) * w + i] : 0;
      const ul = i && j ? v[(j - 1) * w + i - 1] : 0;
      q[j * w + i] = (v[j * w + i] - (l + u - ul)) << 16 >> 16; // prettier-ignore
    }
  const head = Buffer.alloc(16);
  head.write("SPH1", 0, "latin1");
  head.writeUInt16LE(w, 4);
  head.writeUInt16LE(h, 6);
  head.writeFloatLE(step, 8);
  head.writeFloatLE(base, 12);
  const body = zlib.deflateSync(Buffer.from(q.buffer), { level: 9 });
  return Buffer.concat([head, body]);
}

function writeHeights(file, g, minStep) {
  const buf = encodeHeights(g.data, g.w, g.h, minStep);
  fs.writeFileSync(file, buf);
  return buf.length;
}

const kb = (n) => `${Math.round(n / 1024)} KB`;
function stats(g) {
  let lo = Infinity;
  let hi = -Infinity;
  for (let k = 0; k < g.w * g.h; k++) {
    const v = g.data[k * g.ch];
    if (v < lo) lo = v;
    if (v > hi) hi = v;
  }
  return `${Math.round(lo)} to ${Math.round(hi)}`;
}

// ---- Run ----------------------------------------------------------------------------------

fs.mkdirSync(OUT, { recursive: true });
const opened = new Map();
async function source(s) {
  const key = s.url;
  if (!opened.has(key)) opened.set(key, await openSource(s));
  return opened.get(key);
}

for (const world of WORLDS) {
  if (only.length && !only.includes(world.id)) continue;
  const m = world.maps;
  console.log(`${world.id}:`);
  if (!patchesOnly) {
    const c = await source(m.color);
    const cw = m.colorSize?.[0] ?? 1536;
    const chh = m.colorSize?.[1] ?? 768;
    const color = await resample(c, { w: cw, h: chh, ch: 3 });
    fillGaps(color);
    const n = writeColor(path.join(OUT, `${world.id}-color.jpg`), color, m.color);
    console.log(`  color ${cw}×${chh}, ${kb(n)} (cover ${Math.round(color.cover * 100)}%)`);
    if (m.night) {
      const ns = await source(m.night);
      const g = await resample(ns, { w: 1024, h: 512, ch: 3 });
      fillGaps(g);
      const n3 = writeColor(path.join(OUT, `${world.id}-night.jpg`), g, { ...m.night, gray: true });
      console.log(`  night lights 1024×512, ${kb(n3)}`);
    }
    if (m.height) {
      const hs = await source(m.height);
      const [hw, hh] = m.heightSize ?? [1024, 512];
      const g = await resample(hs, { w: hw, h: hh, ch: 1 });
      const gaps = fillGaps(g);
      const n2 = writeHeights(path.join(OUT, `${world.id}-height.bin`), g);
      let gapCount = 0;
      for (const v of gaps) gapCount += v;
      console.log(`  height ${hw}×${hh}, ${kb(n2)}, ${stats(g)} m (gaps filled ${((100 * gapCount) / gaps.length).toFixed(1)}%)`); // prettier-ignore
    }
  }
  if (noPatches) continue;
  for (const f of world.features || []) {
    if (!f.patch) continue;
    const r = f.patch.deg; // half-width in latitude, degrees
    const rl = Math.min(179, r / Math.max(0.2, Math.cos((f.lat * Math.PI) / 180)));
    const win = { lonA: f.lon - rl, lonB: f.lon + rl, latTop: f.lat + r, latBottom: f.lat - r };
    const size = f.patch.size ?? 512;
    const cs = await source(f.patch.color ?? m.patchColor ?? m.color);
    const color = await resample(cs, { ...win, w: size, h: size, ch: 3 });
    fillGaps(color, false);
    const n = writeColor(path.join(OUT, `${world.id}-${f.id}-color.jpg`), color, m.patchColor ?? m.color); // prettier-ignore
    let line = `  ${f.id}: color ${size}², ${kb(n)}`;
    if (m.height) {
      const hs = await source(f.patch.height ?? m.patchHeight ?? m.height);
      const hsz = f.patch.heightSize ?? 256;
      const g = await resample(hs, { ...win, w: hsz, h: hsz, ch: 1 });
      fillGaps(g, false);
      const n2 = writeHeights(path.join(OUT, `${world.id}-${f.id}-height.bin`), g, 2);
      line += `; height ${hsz}², ${kb(n2)}, ${stats(g)} m`;
    }
    console.log(line);
  }
}
