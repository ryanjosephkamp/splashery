#!/usr/bin/env node
// Earth and maps (lane Geo): the storm toy's data. Hurricane Polo (eastern
// Pacific) as it grew from a Category 1 to a Category 5 hurricane in a day,
// September 21–22, 2026.
//
//   node tools/geo-storm.mjs
//
// Writes assets/toys/hurricane/storm.bin:
//   irA, irB   GOES-East ABI band 13 (clean infrared) cloud-top temperatures
//              at the start and end of the day, each a 10-degree square round
//              that time's eye (NOAA; through NASA GIBS), as °C + 100 in bytes
//   height     NOAA NCEI ETOPO1 relief of the map
//   color      NASA Blue Marble (shaded relief and bathymetry), through GIBS
// and the best track (NOAA NHC, ATCF b-deck) in its header.
// All public domain.

import fs from "node:fs";
import { cached, decodeImage, readTiff, fillNoData, resample, rgbGrid, spanMeters, writeGeo } from "./geo-lib.mjs"; // prettier-ignore

const START = "2026092118";
const END = "2026092218";
const MAP = [-108.4, 8.9, -96.4, 20.9]; // lon/lat box round the day's track
const R = 5; // half-width of each infrared square, degrees
const N = 256;

// The best track: every six hours, position, wind (kt) and pressure (mb).
const btk = await cached("bep172026.dat", "https://ftp.nhc.noaa.gov/atcf/btk/bep172026.dat", { text: true }); // prettier-ignore
const seen = new Set();
const track = [];
for (const line of btk.trim().split("\n")) {
  const r = line.split(",").map((x) => x.trim());
  if (seen.has(r[2])) continue;
  seen.add(r[2]);
  const lat = (parseInt(r[6]) / 10) * (r[6].endsWith("S") ? -1 : 1);
  const lon = (parseInt(r[7]) / 10) * (r[7].endsWith("W") ? -1 : 1);
  track.push({ time: r[2], lat, lon, kt: +r[8], mb: +r[9], kind: r[10] });
}
const at = (t) => track.find((p) => p.time === t);

// GIBS colors back to temperatures, through the layer's color map.
const xml = await cached("irmap.xml", "https://gibs.earthdata.nasa.gov/colormaps/v1.3/Clean_Longwave_Infrared_Window_Band.xml", { text: true }); // prettier-ignore
const entries = [...xml.matchAll(/rgb="(\d+),(\d+),(\d+)"[^>]*value="[(\[]([-\d.]+),([-\d.]+)/g)].map((m) => ({ rgb: [+m[1], +m[2], +m[3]], t: (+m[4] + +m[5]) / 2 })); // prettier-ignore
// The palette reuses grays and near-blacks at both ends (the coldest tops and
// warm clear sea), and the image's resampling blends neighbors: each pixel
// gets its best cold (below -30 °C) and best warm match; an ambiguous pixel
// takes the side its clear-cut neighbors are on, then a 3 x 3 median smooths.
const lut = new Map();
function matches(r, g, b) {
  const key = (r << 16) | (g << 8) | b;
  if (lut.has(key)) return lut.get(key);
  const best = [
    { t: 0, d: Infinity },
    { t: 0, d: Infinity },
  ];
  for (const e of entries) {
    if (e.t > 34) continue; // warmer than any tropical sea or this coast
    const d = (e.rgb[0] - r) ** 2 + (e.rgb[1] - g) ** 2 + (e.rgb[2] - b) ** 2;
    const side = e.t < -30 ? 0 : 1;
    if (d < best[side].d) best[side] = { t: e.t, d };
  }
  lut.set(key, best);
  return best;
}
function decode(img, n) {
  const Tc = new Float32Array(n * n);
  const Tw = new Float32Array(n * n);
  const near = new Float32Array(n * n).fill(NaN); // the nearest colored pixel's temperature
  for (let j = 0; j < n; j++)
    for (let i = 0; i < n; i++) {
      const x = Math.round((i / (n - 1)) * (img.w - 1));
      const y = Math.round((j / (n - 1)) * (img.h - 1));
      const o = (y * img.w + x) * 4;
      const k = j * n + i;
      const [r, g, b] = [img.data[o], img.data[o + 1], img.data[o + 2]];
      if (img.data[o + 3] < 10) {
        Tc[k] = Tw[k] = 25;
        continue;
      }
      const [c, w] = matches(r, g, b);
      Tc[k] = c.t;
      Tw[k] = w.t;
      const gray = Math.max(r, g, b) - Math.min(r, g, b) < 12;
      if (!gray) near[k] = c.d <= w.d ? c.t : w.t;
    }
  // Spread the colored pixels' temperatures into the grays, a ring at a time.
  for (let pass = 0; pass < 60; pass++) {
    const next = near.slice();
    let grew = 0;
    for (let j = 0; j < n; j++)
      for (let i = 0; i < n; i++) {
        const k = j * n + i;
        if (!Number.isNaN(near[k])) continue;
        for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) { // prettier-ignore
          const X = i + dx;
          const Y = j + dy;
          if (X < 0 || Y < 0 || X >= n || Y >= n) continue;
          const v = near[Y * n + X];
          if (!Number.isNaN(v)) {
            next[k] = v;
            grew++;
            break;
          }
        }
      }
    near.set(next);
    if (!grew) break;
  }
  const out = new Float32Array(n * n);
  for (let k = 0; k < n * n; k++) out[k] = near[k] < -55 ? Tc[k] : Tw[k];
  const med = new Float32Array(n * n);
  const win = [];
  for (let j = 0; j < n; j++)
    for (let i = 0; i < n; i++) {
      win.length = 0;
      for (let dy = -1; dy <= 1; dy++)
        for (let dx = -1; dx <= 1; dx++)
          win.push(out[Math.min(n - 1, Math.max(0, j + dy)) * n + Math.min(n - 1, Math.max(0, i + dx))]); // prettier-ignore
      win.sort((a, b) => a - b);
      med[j * n + i] = win[4];
    }
  return med;
}

async function infrared(t) {
  const p = at(t);
  const box = [p.lon - R, p.lat - R, p.lon + R, p.lat + R];
  const iso = `${t.slice(0, 4)}-${t.slice(4, 6)}-${t.slice(6, 8)}T${t.slice(8, 10)}:00:00Z`;
  const url = "https://gibs.earthdata.nasa.gov/wms/epsg4326/best/wms.cgi?" + new URLSearchParams({ SERVICE: "WMS", VERSION: "1.1.1", REQUEST: "GetMap", LAYERS: "GOES-East_ABI_Band13_Clean_Infrared", SRS: "EPSG:4326", BBOX: box.join(","), WIDTH: "512", HEIGHT: "512", FORMAT: "image/png", TIME: iso }); // prettier-ignore
  const img = decodeImage(await cached(`polo-ir-${t}.png`, url));
  const T = decode(img, N);
  const out = new Uint8Array(N * N);
  T.forEach((v, k) => (out[k] = Math.max(0, Math.min(255, Math.round(v + 100)))));
  return { box, data: out, iso };
}

const A = await infrared(START);
const B = await infrared(END);
const etopo = "https://gis.ngdc.noaa.gov/arcgis/rest/services/DEM_mosaics/ETOPO1_bedrock/ImageServer/exportImage?" + new URLSearchParams({ bbox: MAP.join(","), bboxSR: "4326", imageSR: "4326", size: "400,400", format: "tiff", pixelType: "F32", interpolation: "RSP_BilinearInterpolation", f: "image" }); // prettier-ignore
const z = fillNoData(readTiff(await cached("polo-etopo1-400.tif", etopo)));
const bm = "https://gibs.earthdata.nasa.gov/wms/epsg4326/best/wms.cgi?" + new URLSearchParams({ SERVICE: "WMS", VERSION: "1.1.1", REQUEST: "GetMap", LAYERS: "BlueMarble_ShadedRelief_Bathymetry", SRS: "EPSG:4326", BBOX: MAP.join(","), WIDTH: "1024", HEIGHT: "1024", FORMAT: "image/jpeg" }); // prettier-ignore
const color = decodeImage(await cached("polo-bluemarble.jpg", bm));
const day = track.filter((p) => p.time >= START && p.time <= END);
writeGeo("assets/toys/hurricane/storm.bin", {
  storm: "Hurricane Polo (EP17), eastern Pacific",
  map: MAP,
  span: spanMeters(MAP),
  frames: [{ time: A.iso, box: A.box }, { time: B.iso, box: B.box }],
  track: day,
  fetched: new Date().toISOString().slice(0, 10),
}, [
  { name: "irA", type: "u8", w: N, h: N, data: A.data },
  { name: "irB", type: "u8", w: N, h: N, data: B.data },
  { name: "height", type: "height", w: 192, h: 192, data: resample(z, 192, 192) },
  { name: "color", type: "rgb", w: 320, h: 320, data: rgbGrid(color, 320, 320) },
]);
console.log(day.map((p) => `${p.time} ${p.kt} kt ${p.mb} mb`).join("\n"));
void fs;
