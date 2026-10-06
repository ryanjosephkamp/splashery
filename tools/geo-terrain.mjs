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
  elevationEtopo1,
  resample,
  fillNoData,
  writeJpeg,
  spanMeters,
  writeGeo,
  decodeImage,
} from "./geo-lib.mjs";

const N = 512; // height grid (round 2: finer, gzipped)
const C = 1024; // the aerial picture, a JPEG beside it

const SITES = {
  // Grand Canyon: Grand Canyon Village, the Bright Angel and Garden Creek
  // drainages and the Colorado River below them.
  async "grand-canyon"() {
    const bbox = [-112.2, 36.02, -111.98, 36.2];
    const span = spanMeters(bbox);
    const z = fillNoData(await elevation3dep("gc", bbox, 1024, 1024));
    const img = await imageryUsgs("gc", bbox, 2048, 2048);
    writeGeo(
      "assets/toys/grand-canyon/terrain.bin.gz",
      {
        site: "Grand Canyon, Arizona",
        bbox,
        span,
        fetched: today(),
      },
      [{ name: "height", type: "height", w: N, h: N, data: resample(z, N, N) }],
    );
    writeJpeg("assets/toys/grand-canyon/color.jpg", img, C, C);
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
      const base =
        kind === "elev"
          ? "https://elevation.nationalmap.gov/arcgis/rest/services/3DEPElevation/ImageServer/exportImage?"
          : "https://basemap.nationalmap.gov/arcgis/rest/services/USGSImageryOnly/MapServer/export?";
      const q = {
        bbox: box.join(","),
        bboxSR: "26910",
        imageSR: "26910",
        size: `${w},${h}`,
        f: "image",
      };
      if (kind === "elev")
        Object.assign(q, { format: "tiff", pixelType: "F32", interpolation: "RSP_BilinearInterpolation" }); // prettier-ignore
      else q.format = "png24";
      return cached(
        `msh-${kind}-${w}.${kind === "elev" ? "tif" : "png"}`,
        base + new URLSearchParams(q),
      );
    };
    const after = fillNoData(readTiff(await utm("elev", 1024, 1024)));
    const img = decodeImage(await utm("img", 2048, 2048));
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
          for (const [dx, dy] of [
            [1, 0],
            [-1, 0],
            [0, 1],
            [0, -1],
          ]) {
            // prettier-ignore
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
    writeGeo(
      "assets/toys/st-helens/terrain.bin.gz",
      {
        site: "Mount St. Helens, Washington",
        utm: box,
        span: [box[2] - box[0], box[3] - box[1]],
        fetched: today(),
      },
      [
        { name: "before", type: "height", w: N, h: N, data: before.data },
        { name: "after", type: "height", w: N, h: N, data: now },
      ],
    );
    writeJpeg("assets/toys/st-helens/color.jpg", img, C, C);
  },

  // The Mariana Trench and the Mariana Islands (Guam at the lower left), from
  // NOAA's ETOPO1 bedrock relief.
  async "sea-floor"() {
    const bbox = [141.5, 9.5, 148.5, 16.5];
    const z = fillNoData(await elevationEtopo1("mariana", bbox, 420, 420));
    writeGeo(
      "assets/toys/sea-floor/terrain.bin.gz",
      {
        site: "The Mariana Trench, western Pacific",
        bbox,
        span: spanMeters(bbox),
        fetched: today(),
      },
      [{ name: "height", type: "height", w: N, h: N, data: resample(z, N, N) }],
    );
  },

  // Bar Harbor, Maine: the bar to Bar Island, dry for a few hours around each
  // low tide, with NOAA's tide predictions for one lunar day of the spring
  // tide of October 28, 2026 (station 8413320, relative to mean sea level).
  // Heights: NOAA NCEI's coastal DEMs (DEM_tiles_mosaic, NAVD88, taken here as
  // mean sea level; at Bar Harbor the two differ by about a decimeter).
  async "tide-harbor"() {
    const bbox = [-68.2185, 44.3875, -68.2035, 44.3985];
    const url =
      "https://gis.ngdc.noaa.gov/arcgis/rest/services/DEM_mosaics/DEM_tiles_mosaic/ImageServer/exportImage?" +
      new URLSearchParams({ bbox: bbox.join(","), bboxSR: "4326", imageSR: "4326", size: "800,800", format: "tiff", pixelType: "F32", interpolation: "RSP_BilinearInterpolation", f: "image" }); // prettier-ignore
    const z = fillNoData(readTiff(await cached("bh2-dem-800.tif", url)));
    const img = await imageryUsgs("bh2", bbox, 2048, 2048);
    const tq = new URLSearchParams({ product: "predictions", station: "8413320", begin_date: "20261028 00:00", end_date: "20261029 00:54", datum: "MSL", units: "metric", time_zone: "gmt", format: "json", interval: "6" }); // prettier-ignore
    const tide = JSON.parse(await cached("bh-tide.json", "https://api.tidesandcurrents.noaa.gov/api/prod/datagetter?" + tq, { text: true })); // prettier-ignore
    const levels = tide.predictions.map((p) => +p.v);
    writeGeo(
      "assets/toys/tide-harbor/terrain.bin.gz",
      {
        site: "Bar Harbor, Maine",
        bbox,
        span: spanMeters(bbox),
        fetched: today(),
        tide: {
          station: "8413320 Bar Harbor, ME",
          start: "2026-10-28T00:00Z",
          step: 360,
          datum: "MSL",
        },
      },
      [
        { name: "height", type: "height", w: N, h: N, data: resample(z, N, N) },
        { name: "tide", type: "f32", w: levels.length, h: 1, data: levels },
      ],
    );
    writeJpeg("assets/toys/tide-harbor/color.jpg", img, C, C);
  },

  // Yosemite Valley for the relief map: heights, imagery, USGS NLCD 2021 land
  // cover (MRLC) and the named streams of the USGS National Hydrography
  // Dataset, each a line of u, v points in the direction the water flows.
  async "relief-map"() {
    const bbox = [-119.7, 37.69, -119.5, 37.79];
    const span = spanMeters(bbox);
    const z = fillNoData(await elevation3dep("yv", bbox, 1024, 640));
    const img = await imageryUsgs("yv", bbox, 2048, 1280);
    const nlcdUrl = "https://www.mrlc.gov/geoserver/mrlc_display/NLCD_2021_Land_Cover_L48/wms?" + new URLSearchParams({ service: "WMS", version: "1.1.1", request: "GetMap", layers: "NLCD_2021_Land_Cover_L48", srs: "EPSG:4326", bbox: bbox.join(","), width: "1024", height: "640", format: "image/png" }); // prettier-ignore
    const nlcd = decodeImage(await cached("yv-nlcd-1024.png", nlcdUrl));
    const nhdUrl = "https://hydro.nationalmap.gov/arcgis/rest/services/nhd/MapServer/6/query?" + new URLSearchParams({ geometry: bbox.join(","), geometryType: "esriGeometryEnvelope", inSR: "4326", outSR: "4326", spatialRel: "esriSpatialRelIntersects", outFields: "gnis_name,ftype", returnGeometry: "true", f: "geojson" }); // prettier-ignore
    const nhd = JSON.parse(await cached("yv-nhd.json", nhdUrl, { text: true }));
    const rivers = [];
    for (const f of nhd.features) {
      const name = f.properties.gnis_name;
      if (!name) continue;
      const lines =
        f.geometry.type === "MultiLineString" ? f.geometry.coordinates : [f.geometry.coordinates];
      for (const line of lines) {
        const pts = line
          .map(([lon, lat]) => [
            (lon - bbox[0]) / (bbox[2] - bbox[0]),
            (bbox[3] - lat) / (bbox[3] - bbox[1]),
          ])
          .filter(([u, v]) => u >= 0 && u <= 1 && v >= 0 && v <= 1)
          .map(([u, v]) => [+u.toFixed(4), +v.toFixed(4)]);
        if (pts.length >= 2) rivers.push({ name, main: name === "Merced River", pts });
      }
    }
    const HW = 512;
    const HH = Math.round((HW * span[1]) / span[0]);
    const CW = 1024;
    const CH = Math.round((CW * span[1]) / span[0]);
    writeGeo(
      "assets/toys/relief-map/terrain.bin.gz",
      { site: "Yosemite Valley, California", bbox, span, fetched: today(), rivers },
      [
        // prettier-ignore
        { name: "height", type: "height", w: HW, h: HH, data: resample(z, HW, HH) },
      ],
    );
    writeJpeg("assets/toys/relief-map/color.jpg", img, CW, CH);
    writeJpeg("assets/toys/relief-map/land.jpg", nlcd, CW, CH, 92);
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
