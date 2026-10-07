// Lane Powers of ten: fetches the zoom's aerial pictures, square on the
// ground and centered on the zoom's target (a small tree in the Enid A.
// Haupt Garden, Washington, D.C.), every half decade from 1,000 km down to
// 30 m across, and the half of the Earth that faces it, for the globe.
//
//   node tools/pot-maps.mjs            # all of them
//   node tools/pot-maps.mjs 2.0 1.5    # only these layers (log10 of the width in meters)
//
// Sources (all keyless, read once here; the site only serves the JPEGs):
// - 1,000 km to 10 km: EOxCloudless 2016 (Sentinel-2 cloudless, EOX IT
//   Services GmbH, contains modified Copernicus Sentinel data 2016), CC BY 4.0.
// - 3 km: USGS The National Map, "USGS Imagery Only" (NAIP), public domain.
// - Below 1 km: District of Columbia, Office of the Chief Technology Officer,
//   2023 orthophoto (3 inch, 8 cm), CC BY 4.0.
// - The hemisphere: the same USGS service at its smallest scales (Blue
//   Marble: Next Generation, NASA), as a latitude and longitude grid.

import fs from "node:fs/promises";
import jpeg from "jpeg-js";
import { TARGET, AERIAL } from "../src/powers/stops.js";

const OUT = new URL("../assets/toys/powers-of-ten/", import.meta.url);
const USGS =
  "https://basemap.nationalmap.gov/arcgis/rest/services/USGSImageryOnly/MapServer/export";
const DC =
  "https://imagery.dcgis.dc.gov/dcgis/rest/services/Ortho/Ortho_2023/ImageServer/exportImage";
const S2 = "https://tiles.maps.eox.at/wmts/1.0.0/s2cloudless_3857/default/g";
const R = 6378137; // Web Mercator's sphere
const ORIGIN = Math.PI * R; // Web Mercator's half width

const merc = (lat, lon) => [
  R * ((lon * Math.PI) / 180),
  R * Math.log(Math.tan(Math.PI / 4 + (lat * Math.PI) / 360)),
];

async function get(url, file) {
  for (let t = 0; t < 4; t++) {
    try {
      const r = await fetch(url);
      const type = r.headers.get("content-type") || "";
      if (!r.ok || !type.includes("image")) throw new Error(`${r.status} ${type}`);
      const b = Buffer.from(await r.arrayBuffer());
      await fs.writeFile(new URL(file, OUT), b);
      console.log(`${file}: ${(b.length / 1024).toFixed(0)} KB`);
      return;
    } catch (e) {
      console.warn(`${file}: ${e.message}, trying again`);
      await new Promise((r) => setTimeout(r, 2000 * 2 ** t));
    }
  }
  throw new Error(`Could not fetch ${file}`);
}

// A square of `w` meters on the ground, centered on the target, in Web
// Mercator (whose meters are ground meters over cos(latitude) there).
async function aerial(layer) {
  const [x, y] = merc(TARGET.lat, TARGET.lon);
  const h = layer.width / Math.cos((TARGET.lat * Math.PI) / 180) / 2;
  const svc = layer.source === "dc" ? DC : USGS;
  const q = new URLSearchParams({
    bbox: [x - h, y - h, x + h, y + h].join(","),
    bboxSR: "3857",
    imageSR: "3857",
    size: `${layer.px},${layer.px}`,
    format: "jpg",
    f: "image",
  });
  if (layer.source === "dc") q.set("compression", "88");
  if (layer.source === "s2") return stitch(layer, x, y, h);
  await get(`${svc}?${q}`, layer.file);
}

async function tile(z, tx, ty) {
  for (let t = 0; t < 4; t++) {
    try {
      const r = await fetch(`${S2}/${z}/${ty}/${tx}.jpg`);
      if (!r.ok) throw new Error(String(r.status));
      return jpeg.decode(Buffer.from(await r.arrayBuffer()), { useTArray: true });
    } catch (e) {
      await new Promise((r) => setTimeout(r, 1500 * 2 ** t));
    }
  }
  throw new Error(`Could not fetch tile ${z}/${ty}/${tx}`);
}

// Sentinel-2 cloudless comes as 256-pixel tiles: the window is cut from
// the tiles of the first zoom level as sharp as its pixels (bilinear).
async function stitch(layer, x, y, h) {
  const N = layer.px;
  const want = (2 * h) / N; // mercator meters per output pixel
  let z = 0;
  while ((2 * ORIGIN) / (256 * 2 ** z) > want && z < 15) z++;
  const res = (2 * ORIGIN) / (256 * 2 ** z);
  const tiles = new Map();
  const at = async (tx, ty) => {
    const k = `${tx},${ty}`;
    if (!tiles.has(k)) tiles.set(k, await tile(z, tx, ty));
    return tiles.get(k);
  };
  // Every tile the window touches, first.
  const t0x = Math.floor((x - h + ORIGIN) / res / 256);
  const t1x = Math.floor((x + h + ORIGIN) / res / 256);
  const t0y = Math.floor((ORIGIN - (y + h)) / res / 256);
  const t1y = Math.floor((ORIGIN - (y - h)) / res / 256);
  for (let ty = t0y; ty <= t1y; ty++) for (let tx = t0x; tx <= t1x; tx++) await at(tx, ty);
  const px = (gx, gy) => {
    const tx = Math.floor(gx / 256);
    const ty = Math.floor(gy / 256);
    const t = tiles.get(`${tx},${ty}`);
    const o = ((gy - ty * 256) * t.width + (gx - tx * 256)) * 4;
    return [t.data[o], t.data[o + 1], t.data[o + 2]];
  };
  const out = Buffer.alloc(N * N * 4);
  for (let j = 0; j < N; j++)
    for (let i = 0; i < N; i++) {
      const mx = x - h + (i + 0.5) * want;
      const my = y + h - (j + 0.5) * want;
      const fx = (mx + ORIGIN) / res - 0.5;
      const fy = (ORIGIN - my) / res - 0.5;
      const ix = Math.floor(fx);
      const iy = Math.floor(fy);
      const ax = fx - ix;
      const ay = fy - iy;
      const a = px(ix, iy);
      const b = px(ix + 1, iy);
      const c = px(ix, iy + 1);
      const d = px(ix + 1, iy + 1);
      const o = (j * N + i) * 4;
      for (let k = 0; k < 3; k++)
        out[o + k] = (a[k] * (1 - ax) + b[k] * ax) * (1 - ay) + (c[k] * (1 - ax) + d[k] * ax) * ay;
      out[o + 3] = 255;
    }
  const enc = jpeg.encode({ data: out, width: N, height: N }, 86);
  await fs.writeFile(new URL(layer.file, OUT), enc.data);
  console.log(
    `${layer.file}: ${(enc.data.length / 1024).toFixed(0)} KB (Sentinel-2 cloudless, zoom ${z})`,
  );
}

// The half of the Earth round the target as a longitude and latitude grid
// (2:1 per degree... a square of 180 by 180 degrees).
async function hemisphere() {
  const lon0 = TARGET.lon - 90;
  const q = new URLSearchParams({
    bbox: [lon0, -90, lon0 + 180, 90].join(","),
    bboxSR: "4326",
    imageSR: "4326",
    size: "2048,2048",
    format: "jpg",
    f: "image",
  });
  await get(`${USGS}?${q}`, "earth-hemisphere.jpg");
}

const only = process.argv.slice(2);
await fs.mkdir(OUT, { recursive: true });
for (const layer of AERIAL) if (!only.length || only.includes(layer.e.toFixed(1))) await aerial(layer); // prettier-ignore
if (!only.length || only.includes("earth")) await hemisphere();
