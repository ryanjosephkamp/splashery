#!/usr/bin/env node
// Earth and maps (lane Geo): the migration toy's data. White storks tagged in
// Germany on their fall migration to Africa: GPS tracks from Rotics et al.
// (2016), Movebank Data Repository, doi:10.5441/001/1.hn1bd23k (CC0 1.0).
//
//   node tools/geo-migration.mjs
//
// Keeps one fix per bird every six hours for the busiest fall, and the birds
// that reach Africa south of 15° N; writes assets/toys/stork-migration/
// migration.bin with the map's ETOPO1 relief (NOAA, public domain).

import fs from "node:fs";
import path from "node:path";
import readline from "node:readline";
import { execFileSync } from "node:child_process";
import { CACHE, cached, readTiff, fillNoData, resample, spanMeters, writeGeo } from "./geo-lib.mjs";

const MAP = [4, 6, 46, 57]; // lon/lat box round the eastern flyway
const STEP = 6 * 3600; // seconds between kept fixes
const MAX_BIRDS = 30;

const zip = path.join(CACHE, "storks.zip");
await cached("storks.zip", "https://datarepository.movebank.org/server/api/core/bitstreams/ef95f900-1cde-417e-be8a-c6e64e576bea/content"); // prettier-ignore
const csvName =
  "Fall migrations of juvenile vs. adult white storks (data from Rotics et al. 2016)-gps.csv";
const csv = path.join(CACHE, csvName);
if (!fs.existsSync(csv)) execFileSync("unzip", ["-o", "-q", zip, "-d", CACHE]);

// bird|year -> Map(bin -> [t, lon, lat])
const tracks = new Map();
const rl = readline.createInterface({ input: fs.createReadStream(csv) });
let head = null;
for await (const line of rl) {
  const r = line.split(",").map((x) => x.replace(/^"|"$/g, ""));
  if (!head) {
    head = Object.fromEntries(r.map((n, i) => [n, i]));
    continue;
  }
  if (r[head.visible] !== "true") continue;
  const lon = +r[head["location-long"]];
  const lat = +r[head["location-lat"]];
  if (!Number.isFinite(lon) || !Number.isFinite(lat) || (lon === 0 && lat === 0)) continue;
  const t = Date.parse(r[head.timestamp].replace(" ", "T") + "Z") / 1000;
  const year = new Date(t * 1000).getUTCFullYear();
  const key = `${r[head["individual-local-identifier"]]}|${year}`;
  if (!tracks.has(key)) tracks.set(key, new Map());
  const bins = tracks.get(key);
  const bin = Math.floor(t / STEP);
  if (!bins.has(bin)) bins.set(bin, [t, lon, lat]);
}
// The busiest year among birds that reached the Sahel.
const byYear = new Map();
for (const [key, bins] of tracks) {
  const pts = [...bins.values()].sort((a, b) => a[0] - b[0]);
  if (pts.length < 40 || Math.min(...pts.map((p) => p[2])) > 15) continue;
  if (Math.max(...pts.map((p) => p[2])) < 47) continue; // started in Europe
  const year = key.split("|")[1];
  if (!byYear.has(year)) byYear.set(year, []);
  byYear.get(year).push({ id: key.split("|")[0], pts });
}
const [year, birds0] = [...byYear].sort((a, b) => b[1].length - a[1].length)[0];
const birds = birds0.sort((a, b) => (a.id < b.id ? -1 : 1)).slice(0, MAX_BIRDS);
const t0 = Math.min(...birds.map((b) => b.pts[0][0]));
const t1 = Math.max(...birds.map((b) => b.pts[b.pts.length - 1][0]));
console.log(`fall ${year}: ${birds.length} birds of ${birds0.length}, ${new Date(t0 * 1000).toISOString()} to ${new Date(t1 * 1000).toISOString()}`); // prettier-ignore

// Per bird: fixes as [hours since t0, lon, lat] with two decimals.
const out = birds.map((b) => ({
  id: b.id,
  pts: b.pts.map(([t, lon, lat]) => [
    Math.round((t - t0) / 3600),
    +lon.toFixed(2),
    +lat.toFixed(2),
  ]),
}));
const etopo = "https://gis.ngdc.noaa.gov/arcgis/rest/services/DEM_mosaics/ETOPO1_bedrock/ImageServer/exportImage?" + new URLSearchParams({ bbox: MAP.join(","), bboxSR: "4326", imageSR: "4326", size: "420,510", format: "tiff", pixelType: "F32", interpolation: "RSP_BilinearInterpolation", f: "image" }); // prettier-ignore
const z = fillNoData(readTiff(await cached("stork-etopo1-b.tif", etopo)));
writeGeo(
  "assets/toys/stork-migration/migration.bin",
  {
    study: "Fall migrations of juvenile vs. adult white storks (Rotics et al. 2016)",
    doi: "10.5441/001/1.hn1bd23k",
    map: MAP,
    span: spanMeters(MAP),
    start: new Date(t0 * 1000).toISOString(),
    hours: Math.round((t1 - t0) / 3600),
    birds: out,
    fetched: new Date().toISOString().slice(0, 10),
  },
  [{ name: "height", type: "height", w: 210, h: 255, data: resample(z, 210, 255) }],
);
