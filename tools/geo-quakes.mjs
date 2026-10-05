#!/usr/bin/env node
// Earth and maps (lane Geo): the earthquakes toy's shipped data.
//
//   node tools/geo-quakes.mjs
//
// Writes assets/toys/earthquakes/:
//   globe.bin       NOAA NCEI ETOPO1 relief, 360 x 180 (public domain)
//   snapshot.json   dated snapshots of the USGS feeds the toy reads live (the
//                   past week of M2.5 and up, the past month of M4.5 and up),
//                   for when the feed can't be reached, and a year of the USGS
//                   catalog (M5 and up) for the year view
//
// The shipped records are only those USGS (or NOAA's tsunami centers)
// authored: network us, hv (the Hawaiian Volcano Observatory), at and pt.
// Other networks' records contribute to the live feed and are shown live,
// but never saved here (docs/audits/new-sources-2026-10.md, C8).

import fs from "node:fs";
import { readTiff, writeGeo, fillNoData } from "./geo-lib.mjs";

const OUT = "assets/toys/earthquakes";
fs.mkdirSync(OUT, { recursive: true });
const OWN = new Set(["us", "hv", "at", "pt"]);

async function json(url) {
  for (let i = 0; ; i++) {
    try {
      const r = await fetch(url);
      if (!r.ok) throw new Error(`${r.status} ${url}`);
      return await r.json();
    } catch (err) {
      if (i >= 3) throw err;
      await new Promise((res) => setTimeout(res, 2000 * 2 ** i));
    }
  }
}

// [time (s since 1970), lon, lat, depth km, magnitude] for USGS-authored records.
function rows(gj) {
  const out = [];
  let dropped = 0;
  for (const f of gj.features) {
    const p = f.properties;
    const [lon, lat, depth] = f.geometry.coordinates;
    if (p.type !== "earthquake" || p.mag == null) continue;
    if (!OWN.has(p.net)) {
      dropped++;
      continue;
    }
    out.push([Math.round(p.time / 1000), +lon.toFixed(3), +lat.toFixed(3), +(+depth).toFixed(1), +p.mag.toFixed(1)]); // prettier-ignore
  }
  out.sort((a, b) => a[0] - b[0]);
  return { events: out, dropped };
}

const FEEDS = {
  week: "https://earthquake.usgs.gov/earthquakes/feed/v1.0/summary/2.5_week.geojson",
  month: "https://earthquake.usgs.gov/earthquakes/feed/v1.0/summary/4.5_month.geojson",
};
const snap = { note: "USGS-authored records only (networks us, hv, at, pt); times in seconds since 1970 UTC.", feeds: {} }; // prettier-ignore
for (const [id, url] of Object.entries(FEEDS)) {
  const gj = await json(url);
  const { events, dropped } = rows(gj);
  snap.feeds[id] = { url, fetched: new Date(gj.metadata.generated).toISOString(), title: gj.metadata.title, dropped, events }; // prettier-ignore
  console.log(`${id}: ${events.length} events (${dropped} from other networks left out)`);
}
{
  const start = "2025-10-01";
  const end = "2026-10-01";
  const url = `https://earthquake.usgs.gov/fdsnws/event/1/query?format=geojson&starttime=${start}&endtime=${end}&minmagnitude=5&orderby=time-asc`; // prettier-ignore
  const gj = await json(url);
  const { events, dropped } = rows(gj);
  snap.feeds.year = { url, fetched: new Date().toISOString(), title: "USGS earthquakes of magnitude 5 and up, October 1, 2025, to September 30, 2026", start, end, dropped, events }; // prettier-ignore
  console.log(`year: ${events.length} events (${dropped} left out)`);
}
fs.writeFileSync(`${OUT}/snapshot.json`, JSON.stringify(snap));
console.log(`${OUT}/snapshot.json: ${(fs.statSync(`${OUT}/snapshot.json`).size / 1024).toFixed(0)} KB`);

// The globe's relief: ETOPO1 bedrock, 360 x 180 (one degree... sampled at cell centers).
const W = 360;
const H = 180;
const url =
  "https://gis.ngdc.noaa.gov/arcgis/rest/services/DEM_mosaics/ETOPO1_bedrock/ImageServer/exportImage?" +
  new URLSearchParams({ bbox: "-180,-90,180,90", bboxSR: "4326", imageSR: "4326", size: `${W},${H}`, format: "tiff", pixelType: "F32", interpolation: "RSP_BilinearInterpolation", f: "image" }); // prettier-ignore
const { cached } = await import("./geo-lib.mjs");
const t = fillNoData(readTiff(await cached(`etopo1-world-${W}.tif`, url)));
writeGeo(`${OUT}/globe.bin`, { source: "NOAA NCEI ETOPO1 Global Relief Model (bedrock)", bbox: [-180, -90, 180, 90], fetched: new Date().toISOString().slice(0, 10) }, [ // prettier-ignore
  { name: "height", type: "height", w: t.w, h: t.h, data: t.data },
]);
