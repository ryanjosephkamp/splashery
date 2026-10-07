#!/usr/bin/env node
// Lane Space r3: the close-up tiles a tap on a real world zooms into (read by
// src/space/zoom.js). Each world's color and elevation maps (the sources in
// src/space/worlds.js, public domain; the finest of them where it has a
// finer one for close-ups) are cut into 10° × 10° tiles at the resolutions in
// TILES (src/space/zoom.js):
//
//   assets/toys/<toy>/tiles/<world>-<row>-<col>.jpg    color
//   assets/toys/<toy>/tiles/<world>-<row>-<col>.bin    heights (SPH1, as tools/sp2-maps.mjs writes)
//   assets/toys/<toy>/tiles/<world>-tiles.json         which tiles there are
//
//   node tools/sp3-tiles.mjs                 # every world
//   node tools/sp3-tiles.mjs moon mars       # some
//
// Sources are read from .cache/sp3 when they are there (the same file names
// as their addresses), else streamed from their addresses (tools/sp2-tiff.mjs).

import fs from "node:fs";
import path from "node:path";
import zlib from "node:zlib";
import jpeg from "jpeg-js";
import { openTiff, readRows } from "./sp2-tiff.mjs";
import { WORLDS } from "../src/space/worlds.js";
import { TILES, TILE_DEG, tileName } from "../src/space/zoom.js";

const CACHE = ".cache/sp3";
const only = process.argv.slice(2).filter((a) => !a.startsWith("--"));

// Finer sources for the close-ups than the worlds' own maps, where there are.
const SVS = "https://svs.gsfc.nasa.gov/vis/a000000/a004700/a004720/";
const ETOPO = "https://www.ngdc.noaa.gov/mgg/global/relief/ETOPO2022/data/";
const CLOSE = {
  moon: { height: { url: `${SVS}ldem_16.tif`, lonLeft: -180, scale: 1000 } },
  earth: {
    height: { url: `${ETOPO}60s/60s_surface_elev_gtif/ETOPO_2022_v1_60s_N90W180_surface.tif`, lonLeft: -180 }, // prettier-ignore
  },
};

const local = (url) => {
  const f = path.join(CACHE, path.basename(new URL(url).pathname));
  return fs.existsSync(f) ? f : null;
};

async function openSource(s) {
  if (s.kind === "jpeg") {
    let file = local(s.url);
    if (!file) {
      fs.mkdirSync(CACHE, { recursive: true });
      file = path.join(CACHE, path.basename(new URL(s.url).pathname));
      const r = await fetch(s.url);
      if (!r.ok) throw new Error(`${s.url}: HTTP ${r.status}`);
      fs.writeFileSync(file, Buffer.from(await r.arrayBuffer()));
    }
    const img = jpeg.decode(fs.readFileSync(file), { maxMemoryUsageInMB: 4096, maxResolutionInMP: 600 }); // prettier-ignore
    return { t: { width: img.width, height: img.height, spp: 3, mem: img.data }, s };
  }
  return { t: await openTiff(local(s.url) || s.url), s };
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

// A band of latitudes, all the way round, resampled to w × h with ch
// channels: area-averaged from a finer source, bilinear from a coarser one
// (as tools/sp2-maps.mjs does). NaN where the source has no data.
async function band(src, latTop, latBottom, w, h, ch) {
  const { t, s } = src;
  const W = t.width;
  const H = t.height;
  const spp = t.spp;
  const lat0 = s.latTop ?? 90;
  const lat1 = s.latBottom ?? -90;
  const lonLeft = s.lonLeft ?? -180;
  const scale = s.scale ?? 1;
  const offset = s.offset ?? 0;
  const value = (vals, x, c) => {
    const v = vals[x * spp + (spp === 1 ? 0 : c)];
    if (s.nodata !== undefined && v === s.nodata) return NaN;
    if (!Number.isFinite(v) || v < -1e30) return NaN;
    return offset + scale * v;
  };
  const rowOfLat = (lat) => ((lat0 - lat) / (lat0 - lat1)) * H;
  const out = new Float32Array(w * h * ch);
  const wsum = new Float32Array(w * h);
  const yA = Math.max(0, Math.floor(rowOfLat(latTop)) - 1);
  const yB = Math.min(H, Math.ceil(rowOfLat(latBottom)) + 1);
  if (W / w >= 1.2) {
    const tx = new Int32Array(W);
    for (let x = 0; x < W; x++) {
      const lon = lonLeft + ((x + 0.5) / W) * 360;
      const d = (((lon + 180) % 360) + 360) % 360;
      tx[x] = Math.min(w - 1, Math.floor((d / 360) * w));
    }
    await rowsOf(src, yA, yB, (y, vals) => {
      const lat = lat0 - ((y + 0.5) / H) * (lat0 - lat1);
      if (lat > latTop || lat < latBottom) return;
      const ty = Math.min(h - 1, Math.floor(((latTop - lat) / (latTop - latBottom)) * h));
      for (let x = 0; x < W; x++) {
        const v0 = value(vals, x, 0);
        if (Number.isNaN(v0)) continue;
        const k = ty * w + tx[x];
        wsum[k]++;
        out[k * ch] += v0;
        for (let c = 1; c < ch; c++) out[k * ch + c] += value(vals, x, c);
      }
    });
  } else {
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
      const a = rows.get(y0);
      const b = rows.get(y1);
      for (let i = 0; i < w; i++) {
        const lon = -180 + ((i + 0.5) / w) * 360;
        const fx = (((((lon - lonLeft) % 360) + 360) % 360) / 360) * W - 0.5;
        const x0 = Math.floor(fx);
        const ax = fx - x0;
        const xa = ((x0 % W) + W) % W;
        const xb = (xa + 1) % W;
        const k = j * w + i;
        let ok = 1;
        for (let c = 0; c < ch; c++) {
          const v = (1 - ay) * ((1 - ax) * a[xa * ch + c] + ax * a[xb * ch + c]) + ay * ((1 - ax) * b[xa * ch + c] + ax * b[xb * ch + c]); // prettier-ignore
          if (Number.isNaN(v)) ok = 0;
          out[k * ch + c] = v;
        }
        wsum[k] = ok;
      }
    }
  }
  for (let k = 0; k < w * h; k++) {
    if (wsum[k] > 0) for (let c = 0; c < ch; c++) out[k * ch + c] /= wsum[k];
    else for (let c = 0; c < ch; c++) out[k * ch + c] = NaN;
  }
  return out;
}

// Fills a tile's gaps from its neighbors (as tools/sp2-maps.mjs does).
function fillGaps(data, w, h, ch) {
  const missing = new Uint8Array(w * h);
  let left = 0;
  for (let k = 0; k < w * h; k++) if (Number.isNaN(data[k * ch])) ((missing[k] = 1), left++);
  if (left === w * h) return false;
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
          const ii = i + di;
          const jj = j + dj;
          if (ii < 0 || jj < 0 || ii >= w || jj >= h) continue;
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
  return true;
}

function encodeColor(data, w, h, { gray = false, gamma = 1 } = {}, quality) {
  const rgba = Buffer.alloc(w * h * 4);
  for (let k = 0; k < w * h; k++) {
    for (let c = 0; c < 3; c++) {
      let v = data[k * 3 + (gray ? 0 : c)];
      v = 255 * Math.pow(Math.max(0, v / 255), gamma);
      rgba[k * 4 + c] = Math.max(0, Math.min(255, Math.round(v)));
    }
    rgba[k * 4 + 3] = 255;
  }
  return jpeg.encode({ data: rgba, width: w, height: h }, quality).data;
}

function encodeHeights(values, w, h, minStep) {
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
  return Buffer.concat([head, zlib.deflateSync(Buffer.from(q.buffer), { level: 9 })]);
}

// Cuts a band into its 36 tiles.
function cut(data, w, h, ch, c) {
  const tw = w / 36;
  const t = new Float32Array(tw * h * ch);
  for (let j = 0; j < h; j++)
    t.set(data.subarray((j * w + c * tw) * ch, (j * w + c * tw + tw) * ch), j * tw * ch);
  return t;
}

for (const world of WORLDS) {
  const spec = TILES[world.id];
  if (!spec || (only.length && !only.includes(world.id))) continue;
  const dir = `assets/toys/${spec.toy}/tiles`;
  fs.mkdirSync(dir, { recursive: true });
  const m = world.maps;
  const colorSrc = await openSource(m.patchColor ?? m.color);
  const heightDef = CLOSE[world.id]?.height ?? m.patchHeight ?? m.height;
  const heightSrc = spec.height && heightDef ? await openSource(heightDef) : null;
  const have = { color: [], height: [] };
  let bytes = 0;
  const cw = 36 * TILE_DEG * spec.color;
  const chh = TILE_DEG * spec.color;
  const hw = spec.height ? 36 * TILE_DEG * spec.height : 0;
  const hh = spec.height ? TILE_DEG * spec.height : 0;
  // Larger tiles of color compress less; a little lower quality keeps them small.
  const quality = 74;
  for (let r = 0; r < 18; r++) {
    const top = 90 - r * TILE_DEG;
    const col = await band(colorSrc, top, top - TILE_DEG, cw, chh, 3);
    const hts = heightSrc ? await band(heightSrc, top, top - TILE_DEG, hw, hh, 1) : null;
    for (let c = 0; c < 36; c++) {
      const name = tileName(world.id, r, c);
      const key = `${r}-${c}`;
      let hTile = hts ? cut(hts, hw, hh, 1, c) : null;
      if (hTile && !fillGaps(hTile, hw / 36, hh, 1)) hTile = null;
      // Earth: only tiles with land (the sea is one blue; its floor isn't shown).
      if (spec.sea) {
        if (!hTile) continue;
        let land = 0;
        for (let k = 0; k < hTile.length; k++) {
          if (hTile[k] > 0) land++;
          else hTile[k] = 0;
        }
        if (!land) continue;
      }
      const cTile = cut(col, cw, chh, 3, c);
      if (!fillGaps(cTile, cw / 36, chh, 3)) continue;
      const jpg = encodeColor(cTile, cw / 36, chh, m.patchColor ?? m.color, quality);
      fs.writeFileSync(path.join(dir, `${name}.jpg`), jpg);
      bytes += jpg.length;
      have.color.push(key);
      if (hTile) {
        const bin = encodeHeights(hTile, hw / 36, hh, 8);
        fs.writeFileSync(path.join(dir, `${name}.bin`), bin);
        bytes += bin.length;
        have.height.push(key);
      }
    }
    process.stdout.write(`  ${world.id} ${r + 1}/18\r`);
  }
  fs.writeFileSync(path.join(dir, `${world.id}-tiles.json`), JSON.stringify(have));
  console.log(`${world.id}: ${have.color.length} color tiles, ${have.height.length} height tiles, ${(bytes / 1048576).toFixed(1)} MB`); // prettier-ignore
}
