#!/usr/bin/env node
// Lane Science r3: the land for "Terrain in a box" and the Contour lab. Each
// place is a square cut from the USGS 3D Elevation Program's 1/3 arc-second
// (about 10 m) seamless elevation tiles (GeoTIFF on The National Map; the
// tile's metadata: "All 3DEP products are public domain."), read by range
// requests with geotiff.js (a pinned devDependency; LICENSES.md), averaged
// down to N × N samples, and written as assets/toys/terrain-box/<id>.dem.gz:
// a uint32 byte length, a JSON header (the place, the corner, the spacing in
// meters, the lowest height, the step), then N × N uint16 heights (meters =
// low + v × step), rows north to south, gzipped.
//
//   node tools/sci3-terrain.mjs [id ...]

import fs from "node:fs";
import zlib from "node:zlib";
import { fromUrl } from "geotiff";

const N = 256;
const TILE = (lat, lon) => {
  const n = Math.ceil(lat);
  const w = Math.ceil(-lon);
  const name = `n${n}w${String(w).padStart(3, "0")}`;
  return `https://prd-tnm.s3.amazonaws.com/StagedProducts/Elevation/13/TIFF/current/${name}/USGS_13_${name}.tif`; // prettier-ignore
};
// The middle of each square (degrees) and its side (km).
export const PLACES = {
  "st-helens": { name: "Mount St. Helens, Washington", lat: 46.2, lon: -122.19, km: 9 },
  "grand-canyon": { name: "The Grand Canyon near Grand Canyon Village, Arizona", lat: 36.085, lon: -112.12, km: 12 }, // prettier-ignore
  yosemite: {
    name: "Yosemite Valley and Half Dome, California",
    lat: 37.735,
    lon: -119.56,
    km: 10,
  },
};

async function cut(id) {
  const P = PLACES[id];
  const url = TILE(P.lat, P.lon);
  const tiff = await fromUrl(url);
  const img = await tiff.getImage();
  const [ox, oy] = img.getOrigin();
  const [rx, ry] = img.getResolution(); // degrees per pixel (ry < 0)
  const mPerDegLat = 111320;
  const mPerDegLon = 111320 * Math.cos((P.lat * Math.PI) / 180);
  const halfLat = (P.km * 500) / mPerDegLat;
  const halfLon = (P.km * 500) / mPerDegLon;
  const x0 = Math.round((P.lon - halfLon - ox) / rx);
  const x1 = Math.round((P.lon + halfLon - ox) / rx);
  const y0 = Math.round((P.lat + halfLat - oy) / ry);
  const y1 = Math.round((P.lat - halfLat - oy) / ry);
  const [raster] = await img.readRasters({ window: [x0, y0, x1, y1] });
  const W = x1 - x0;
  const H = y1 - y0;
  // Average down to N × N (a box filter over each new sample).
  const out = new Float64Array(N * N);
  for (let j = 0; j < N; j++)
    for (let i = 0; i < N; i++) {
      const a0 = Math.floor((i * W) / N);
      const a1 = Math.max(a0 + 1, Math.floor(((i + 1) * W) / N));
      const b0 = Math.floor((j * H) / N);
      const b1 = Math.max(b0 + 1, Math.floor(((j + 1) * H) / N));
      let s = 0;
      let n = 0;
      for (let b = b0; b < b1; b++)
        for (let a = a0; a < a1; a++) {
          const v = raster[b * W + a];
          if (v > -1000) {
            s += v;
            n++;
          }
        }
      out[j * N + i] = n ? s / n : NaN;
    }
  let lo = Infinity;
  let hi = -Infinity;
  for (const v of out)
    if (Number.isFinite(v)) {
      lo = Math.min(lo, v);
      hi = Math.max(hi, v);
    }
  const step = (hi - lo) / 65535 || 1;
  const q = new Uint16Array(N * N);
  for (let k = 0; k < N * N; k++) q[k] = Number.isFinite(out[k]) ? Math.round((out[k] - lo) / step) : 0; // prettier-ignore
  const head = {
    format: "splashery-dem-1",
    id,
    name: P.name,
    n: N,
    center: [P.lat, P.lon],
    km: P.km,
    spacing: [(W * Math.abs(rx) * mPerDegLon) / N, (H * Math.abs(ry) * mPerDegLat) / N],
    low: lo,
    high: hi,
    step,
    source: url,
    license: "Public domain (USGS 3DEP)",
  };
  const h = Buffer.from(JSON.stringify(head));
  const body = Buffer.concat([Buffer.alloc(4), h, Buffer.from(q.buffer)]);
  body.writeUInt32LE(h.length, 0);
  fs.mkdirSync("assets/toys/terrain-box", { recursive: true });
  const file = `assets/toys/terrain-box/${id}.dem.gz`;
  fs.writeFileSync(file, zlib.gzipSync(body, { level: 9 }));
  console.log(`${file}: ${P.name}, ${W}×${H} → ${N}×${N}, ${lo.toFixed(0)}–${hi.toFixed(0)} m, ${fs.statSync(file).size} bytes`); // prettier-ignore
}

const want = process.argv.slice(2);
for (const id of want.length ? want : Object.keys(PLACES)) await cut(id);
