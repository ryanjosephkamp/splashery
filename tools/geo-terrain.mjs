#!/usr/bin/env node
// Earth and maps (lane Geo): fetches the terrain snapshots for the shelf's
// landscapes, once, at build time, and writes them to assets/toys/<id>/.
//
//   node tools/geo-terrain.mjs                # every site
//   node tools/geo-terrain.mjs grand-canyon   # one site
//
// Sources (all public domain; tools/assets.json and CREDITS.md list them):
//   USGS 3DEP elevation (The National Map ImageServer)
//   The National Map orthoimagery basemap (USDA NAIP, NASA Landsat)
//   USGS pre-1980 Mount St. Helens DEM (ScienceBase, doi:10.5066/P91W7C1L)
//   NOAA NCEI ETOPO1 bedrock relief (the sea floor)
// Downloads are cached in .cache/geo/.

import fs from "node:fs";
import path from "node:path";
import { execFileSync } from "node:child_process";
import {
  CACHE,
  cached,
  elevation3dep,
  imageryUsgs,
  readTiff,
  resample,
  fillNoData,
  rgbGrid,
  spanMeters,
  writeGeo,
} from "./geo-lib.mjs";

const N = 192; // height grid
const C = 320; // color grid

const SITES = {
  // Grand Canyon: Grand Canyon Village, the Bright Angel and Garden Creek
  // drainages and the Colorado River below them.
  async "grand-canyon"() {
    const bbox = [-112.2, 36.02, -111.98, 36.2];
    const span = spanMeters(bbox);
    const z = fillNoData(await elevation3dep("gc", bbox, 400, 400));
    const img = await imageryUsgs("gc", bbox, 1024, 1024);
    writeGeo("assets/toys/grand-canyon/terrain.bin", {
      site: "Grand Canyon, Arizona", bbox, span, fetched: today(),
    }, [
      { name: "height", type: "height", w: N, h: N, data: resample(z, N, N) },
      { name: "color", type: "rgb", w: C, h: C, data: rgbGrid(img, C, C) },
    ]);
  },

  // Mount St. Helens before (1952-era topography, the USGS pre-eruption DEM)
  // and after (3DEP today), both on the same UTM zone 10 grid.
  async "st-helens"() {
    const zip = await cached("msh-pre.zip", "https://www.sciencebase.gov/catalog/file/get/650dbee5d34e823a027455f3?f=__disk__ca%2F82%2F72%2Fca82727cc6aee0251d54571101b62a42a355db32"); // prettier-ignore
    const tif = path.join(CACHE, "msh_pre_eruption_dem_nad83_utm10.tif");
    if (!fs.existsSync(tif)) execFileSync("unzip", ["-o", "-q", path.join(CACHE, "msh-pre.zip"), "-d", CACHE]); // prettier-ignore
    void zip;
    const pre = readTiff(new Uint8Array(fs.readFileSync(tif)));
    const X0 = 540396.3585808862;
    const Y0 = 5131147.3338968474;
    const CELL = 10;
    // An 11 km square round the old summit, north up (the crater opens north).
    const box = [556500, 5110600, 567500, 5121600]; // xmin, ymin, xmax, ymax (m)
    const crop = (w) => {
      const out = new Float32Array(w * w);
      for (let j = 0; j < w; j++)
        for (let i = 0; i < w; i++) {
          const x = box[0] + ((box[2] - box[0]) * i) / (w - 1);
          const y = box[3] - ((box[3] - box[1]) * j) / (w - 1);
          const fx = (x - X0) / CELL;
          const fy = (Y0 - y) / CELL;
          const x0 = Math.floor(fx);
          const y0 = Math.floor(fy);
          const tx = fx - x0;
          const ty = fy - y0;
          const at = (a, b) => {
            const v = pre.data[Math.min(pre.h - 1, Math.max(0, b)) * pre.w + Math.min(pre.w - 1, Math.max(0, a))]; // prettier-ignore
            return v > 9000 || v < -1000 ? NaN : v;
          };
          out[j * w + i] = (at(x0, y0) * (1 - tx) + at(x0 + 1, y0) * tx) * (1 - ty) + (at(x0, y0 + 1) * (1 - tx) + at(x0 + 1, y0 + 1) * tx) * ty; // prettier-ignore
        }
      return { w, h: w, data: out };
    };
    const pre0 = crop(N);
    const utm = async (kind, w, h) => {
      const base = kind === "elev"
        ? "https://elevation.nationalmap.gov/arcgis/rest/services/3DEPElevation/ImageServer/exportImage?"
        : "https://basemap.nationalmap.gov/arcgis/rest/services/USGSImageryOnly/MapServer/export?";
      const q = { bbox: box.join(","), bboxSR: "26910", imageSR: "26910", size: `${w},${h}`, f: "image" };
      if (kind === "elev") Object.assign(q, { format: "tiff", pixelType: "F32", interpolation: "RSP_BilinearInterpolation" }); // prettier-ignore
      else q.format = "png24";
      return cached(`msh-${kind}-${w}.${kind === "elev" ? "tif" : "png"}`, base + new URLSearchParams(q));
    };
    const after = fillNoData(readTiff(await utm("elev", 400, 400)));
    const { decodeImage } = await import("./geo-lib.mjs");
    const img = decodeImage(await utm("img", 1024, 1024));
    // The pre-eruption DEM covers the mountain and the valley north of it
    // (196 km²); beyond it the land barely changed, so today's heights fill in,
    // blended over a few cells at the seam.
    const now = resample(after, N, N);
    const ok = new Float32Array(N * N);
    pre0.data.forEach((v, i) => (ok[i] = Number.isFinite(v) ? 1 : 0));
    let wgt = ok;
    for (let pass = 0; pass < 6; pass++) {
      const next = new Float32Array(N * N);
      for (let j = 0; j < N; j++)
        for (let i = 0; i < N; i++) {
          let m = wgt[j * N + i];
          for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) { // prettier-ignore
            const X = Math.min(N - 1, Math.max(0, i + dx));
            const Y = Math.min(N - 1, Math.max(0, j + dy));
            m = Math.min(m, wgt[Y * N + X] + 0.2);
          }
          next[j * N + i] = Math.min(m, ok[j * N + i]);
        }
      wgt = next;
    }
    const before = { data: new Float32Array(N * N) };
    for (let i = 0; i < N * N; i++)
      before.data[i] = ok[i] ? pre0.data[i] * wgt[i] + now[i] * (1 - wgt[i]) : now[i];
    writeGeo("assets/toys/st-helens/terrain.bin", {
      site: "Mount St. Helens, Washington", utm: box, span: [box[2] - box[0], box[3] - box[1]], fetched: today(),
    }, [
      { name: "before", type: "height", w: N, h: N, data: before.data },
      { name: "after", type: "height", w: N, h: N, data: now },
      { name: "color", type: "rgb", w: C, h: C, data: rgbGrid(img, C, C) },
    ]);
  },
};

function today() {
  return new Date().toISOString().slice(0, 10);
}

const only = process.argv.slice(2);
for (const [id, make] of Object.entries(SITES)) {
  if (only.length && !only.includes(id)) continue;
  await make();
}
