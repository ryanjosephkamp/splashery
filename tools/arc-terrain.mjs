#!/usr/bin/env node
// Lane Arcade: real ground for Soft Landing, the lander game. Cuts patches
// of real elevation (and color) out of NASA's public-domain maps and writes
// them small to assets/toys/soft-landing/terrain.json:
//
//   the Moon: the CGI Moon Kit (NASA's Scientific Visualization Studio,
//   https://svs.gsfc.nasa.gov/4720), elevation from LRO's laser altimeter
//   (LOLA; ldem_16_uint.tif, 16 pixels a degree, half-meters above a
//   radius of 1,727,400 m) and color from LRO's camera (lroc_color_2k.jpg).
//
//   Mars: elevation from Mars Global Surveyor's laser altimeter (MOLA; the
//   MEGDR at 16 pixels a degree, megt90n000eb.img from NASA's Planetary Data
//   System, https://pds-geosciences.wustl.edu/missions/mgs/megdr.html:
//   meters above the areoid, east longitudes from 0), colored by height in
//   Mars's own tones (MOLA has no color).
//
//   node tools/arc-terrain.mjs <dir with ldem_16_uint.tif, lroc_color_2k.jpg and megt90n000eb.img>

import fs from "node:fs";
import path from "node:path";
import jpeg from "jpeg-js";

const dir = process.argv[2];
if (!dir) throw new Error("Usage: node tools/arc-terrain.mjs <dir>");

// Landing sites: center (latitude, longitude in degrees), and the patch's
// size in degrees (longitude, latitude).
const SITES = [
  { id: "tycho", name: "Tycho crater", world: "Moon", lat: -43.3, lon: -11.2, w: 9, h: 4.5 },
  { id: "copernicus", name: "Copernicus crater", world: "Moon", lat: 9.6, lon: -20.1, w: 8, h: 4 },
  { id: "tranquility", name: "Sea of Tranquility (Apollo 11)", world: "Moon", lat: 0.67, lon: 23.47, w: 8, h: 4 }, // prettier-ignore
  { id: "gale", name: "Gale crater (Curiosity)", world: "Mars", lat: -5.4, lon: 137.8, w: 5, h: 2.5 }, // prettier-ignore
  { id: "jezero", name: "Jezero crater (Perseverance)", world: "Mars", lat: 18.4, lon: 77.5, w: 3, h: 1.5 }, // prettier-ignore
  { id: "valles", name: "Valles Marineris", world: "Mars", lat: -9.0, lon: -68.0, w: 14, h: 7 },
  { id: "olympus", name: "Olympus Mons", world: "Mars", lat: 18.65, lon: -133.8, w: 26, h: 13 },
];
const COLS = 144;
const ROWS = 72;

// A baseline TIFF reader: one 16-bit band in strips, uncompressed.
function readTiff16(file) {
  const b = fs.readFileSync(file);
  const le = b.toString("latin1", 0, 2) === "II";
  const u16 = (o) => (le ? b.readUInt16LE(o) : b.readUInt16BE(o));
  const u32 = (o) => (le ? b.readUInt32LE(o) : b.readUInt32BE(o));
  const ifd = u32(4);
  const n = u16(ifd);
  const tags = {};
  for (let i = 0; i < n; i++) {
    const e = ifd + 2 + i * 12;
    const tag = u16(e);
    const type = u16(e + 2);
    const count = u32(e + 4);
    if (type !== 3 && type !== 4) continue; // only the numbers needed here
    const at = count * (type === 3 ? 2 : 4) > 4 ? u32(e + 8) : e + 8;
    const vals = [];
    for (let k = 0; k < Math.min(count, 4096); k++)
      vals.push(type === 3 ? u16(at + k * 2) : u32(at + k * 4));
    tags[tag] = vals;
  }
  if ((tags[259]?.[0] ?? 1) !== 1) throw new Error("Compressed TIFFs aren't read here.");
  const width = tags[256][0];
  const height = tags[257][0];
  const rowsPer = tags[278]?.[0] ?? height;
  const offsets = tags[273];
  const px = new Uint16Array(width * height);
  for (let s = 0; s < offsets.length; s++) {
    const y0 = s * rowsPer;
    for (let y = y0; y < Math.min(height, y0 + rowsPer); y++)
      for (let x = 0; x < width; x++)
        px[y * width + x] = u16(offsets[s] + ((y - y0) * width + x) * 2);
  }
  return { width, height, px };
}

const dem = readTiff16(path.join(dir, "ldem_16_uint.tif"));
// The MOLA MEGDR: big-endian signed 16-bit meters, 5760 x 2880, from 90°N
// and 0°E eastward.
const mola = (() => {
  const b = fs.readFileSync(path.join(dir, "megt90n000eb.img"));
  const w = 5760;
  const h = 2880;
  const px = new Float32Array(w * h);
  for (let i = 0; i < w * h; i++) px[i] = b.readInt16BE(i * 2);
  return { width: w, height: h, px };
})();
const MARS = [[0.36, 0.17, 0.11], [0.55, 0.28, 0.16], [0.72, 0.45, 0.28], [0.82, 0.62, 0.45], [0.9, 0.82, 0.72]]; // prettier-ignore
const marsColor = (t) => {
  const x = Math.max(0, Math.min(0.999, t)) * (MARS.length - 1);
  const k = Math.floor(x);
  const f = x - k;
  return MARS[k].map((v, c) => v + (MARS[k + 1][c] - v) * f);
};
const col = jpeg.decode(fs.readFileSync(path.join(dir, "lroc_color_2k.jpg")), { useTArray: true });

function sample(img, w, h, u, v, ch) {
  // bilinear, u and v in pixels
  const x0 = Math.floor(u);
  const y0 = Math.floor(v);
  const fx = u - x0;
  const fy = v - y0;
  const at = (x, y) => {
    x = ((x % w) + w) % w;
    y = Math.max(0, Math.min(h - 1, y));
    return ch === undefined ? img[y * w + x] : img[(y * w + x) * 4 + ch];
  };
  return (at(x0, y0) * (1 - fx) + at(x0 + 1, y0) * fx) * (1 - fy) + (at(x0, y0 + 1) * (1 - fx) + at(x0 + 1, y0 + 1) * fx) * fy; // prettier-ignore
}

const out = {
  source:
    "Moon: NASA Scientific Visualization Studio, CGI Moon Kit (https://svs.gsfc.nasa.gov/4720), LOLA elevation and LROC color. Mars: MGS MOLA MEGDR, NASA Planetary Data System.",
  license: "Public domain (NASA)",
  sites: [],
};
for (const s of SITES) {
  const heights = new Float32Array(COLS * ROWS);
  const rgb = new Uint8Array(COLS * ROWS * 3);
  for (let j = 0; j < ROWS; j++)
    for (let i = 0; i < COLS; i++) {
      const lon = s.lon - s.w / 2 + (s.w * (i + 0.5)) / COLS;
      const lat = s.lat + s.h / 2 - (s.h * (j + 0.5)) / ROWS;
      if (s.world === "Mars") {
        const u = ((((lon % 360) + 360) % 360) / 360) * mola.width - 0.5;
        const v = ((90 - lat) / 180) * mola.height - 0.5;
        heights[j * COLS + i] = sample(mola.px, mola.width, mola.height, u, v);
        continue;
      }
      const u = ((lon + 180) / 360) * dem.width - 0.5;
      const v = ((90 - lat) / 180) * dem.height - 0.5;
      heights[j * COLS + i] = sample(dem.px, dem.width, dem.height, u, v) * 0.5 - 10000; // meters above 1737.4 km
      const cu = ((lon + 180) / 360) * col.width - 0.5;
      const cv = ((90 - lat) / 180) * col.height - 0.5;
      for (let c = 0; c < 3; c++) rgb[(j * COLS + i) * 3 + c] = Math.round(sample(col.data, col.width, col.height, cu, cv, c)); // prettier-ignore
    }
  let lo = Infinity;
  let hi = -Infinity;
  for (const h of heights) {
    lo = Math.min(lo, h);
    hi = Math.max(hi, h);
  }
  if (s.world === "Mars")
    for (let k = 0; k < COLS * ROWS; k++) {
      const c = marsColor((heights[k] - lo) / (hi - lo || 1));
      for (let ch = 0; ch < 3; ch++) rgb[k * 3 + ch] = Math.round(c[ch] * 255);
    }
  const q = new Uint16Array(COLS * ROWS);
  for (let k = 0; k < q.length; k++)
    q[k] = Math.round(((heights[k] - lo) / (hi - lo || 1)) * 65535);
  // Meters across the patch (east-west at its middle latitude).
  const R = s.world === "Mars" ? 3389500 : 1737400;
  const widthM = ((s.w * Math.PI) / 180) * R * Math.cos((s.lat * Math.PI) / 180);
  const heightM = ((s.h * Math.PI) / 180) * R;
  out.sites.push({
    id: s.id,
    name: s.name,
    world: s.world,
    lat: s.lat,
    lon: s.lon,
    cols: COLS,
    rows: ROWS,
    widthM: Math.round(widthM),
    depthM: Math.round(heightM),
    lowM: Math.round(lo),
    highM: Math.round(hi),
    heights: Buffer.from(q.buffer).toString("base64"),
    colors: Buffer.from(rgb.buffer).toString("base64"),
  });
  console.log(
    `${s.name}: ${Math.round(widthM / 1000)} km wide, ${Math.round(hi - lo)} m from lowest to highest`,
  );
}
const dest = new URL("../assets/toys/soft-landing/terrain.json", import.meta.url);
fs.mkdirSync(new URL(".", dest), { recursive: true });
fs.writeFileSync(dest, JSON.stringify(out));
console.log(`${fs.statSync(dest).size} bytes -> assets/toys/soft-landing/terrain.json`);
