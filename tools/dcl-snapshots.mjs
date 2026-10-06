#!/usr/bin/env node
// Lane Data and climate: fetches the dated data snapshots the two toys ship
// with, trims them, and writes them under assets/toys/. The toys never fetch
// anything live; run this by hand to refresh a snapshot, then update the
// dates in src/packs/data-climate.js, CREDITS.md and the evidence file.
//
//   node tools/dcl-snapshots.mjs [--from=<dir>]
//
// --from reads files already downloaded (co2_mm_mlo.csv, GLB.Ts+dSST.csv,
// 4.5_month.csv, bezdekIris.data) from a folder instead of the web.
//
// Sources (licenses read on their live pages, October 5, 2026):
// - NOAA GML, Mauna Loa monthly mean CO2 (public domain, gml.noaa.gov/about/
//   disclaimer.html). Only NOAA's own measurements, from May 1974: the file's
//   earlier rows are Scripps data (March 1958 to April 1974) whose reuse
//   isn't cleared (docs/handoff/DataClimate.md, "Notes").
// - NASA GISS GISTEMP v4, Land-Ocean Temperature Index (a U.S. government
//   work, public domain).
// - USGS, earthquakes of magnitude 4.5 and up in the past 30 days (public
//   domain), for Data in 3D.
// - Fisher's Iris data from the UCI Machine Learning Repository (CC BY 4.0),
//   for Data in 3D.

import fs from "node:fs";
import path from "node:path";

const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname), "..");
const from = process.argv.find((a) => a.startsWith("--from="))?.slice(7);

const SOURCES = {
  co2: "https://gml.noaa.gov/webdata/ccgg/trends/co2/co2_mm_mlo.csv",
  gistemp: "https://data.giss.nasa.gov/gistemp/tabledata_v4/GLB.Ts+dSST.csv",
  quakes: "https://earthquake.usgs.gov/earthquakes/feed/v1.0/summary/4.5_month.csv",
  iris: "https://archive.ics.uci.edu/static/public/53/iris.zip",
};
const LOCAL = {
  co2: "co2_mm_mlo.csv",
  gistemp: "GLB.Ts+dSST.csv",
  quakes: "4.5_month.csv",
  iris: "bezdekIris.data",
};

async function get(key) {
  if (from) return fs.readFileSync(path.join(from, LOCAL[key]), "utf8");
  if (key === "iris") throw new Error("Unzip iris.zip and pass --from=<dir> for the Iris data.");
  for (let i = 0; i < 4; i++) {
    try {
      const r = await fetch(SOURCES[key]);
      if (r.ok) return r.text();
    } catch {
      // retry below
    }
    await new Promise((res) => setTimeout(res, 2000 * 2 ** i));
  }
  throw new Error(`Could not fetch ${SOURCES[key]}`);
}

const today = new Date().toISOString().slice(0, 10);
const write = (rel, text) => {
  const file = path.join(ROOT, rel);
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, text);
  console.log(`${rel}: ${text.length} bytes`);
};

// CO2: NOAA's header comments kept (with a line saying what was cut), the
// Scripps rows before May 1974 left out.
{
  const text = await get("co2");
  const lines = text.split(/\r?\n/);
  const out = [];
  let cut = 0;
  for (const line of lines) {
    if (line.startsWith("#")) {
      out.push(line);
      continue;
    }
    if (!line.trim()) continue;
    if (line.startsWith("year")) {
      out.push(`# Splashery snapshot of ${SOURCES.co2}, taken ${today}.`);
      out.push("# Only NOAA's own measurements, from May 1974, are kept: the Scripps rows");
      out.push("# (March 1958 to April 1974) were left out because their reuse isn't cleared.");
      out.push(line);
      continue;
    }
    const [y, m] = line.split(",").map(Number);
    if (y < 1974 || (y === 1974 && m < 5)) {
      cut++;
      continue;
    }
    out.push(line);
  }
  console.log(`CO2: ${cut} Scripps rows left out.`);
  write("assets/toys/climate-records/co2-mlo-monthly.csv", out.join("\n") + "\n");
}

// GISTEMP: as published, with one line of provenance on top.
{
  const text = await get("gistemp");
  write(
    "assets/toys/climate-records/gistemp-v4-global.csv",
    `# Splashery snapshot of ${SOURCES.gistemp}, taken ${today}. NASA GISS, public domain.\n` +
      text.replace(/\r\n/g, "\n"),
  );
}

// Earthquakes: the columns a chart needs; the place names keep their quotes
// (they hold commas), which is half the point of the sample.
{
  const text = (await get("quakes")).replace(/\r\n/g, "\n").trim();
  const rows = text.split("\n");
  const head = rows[0].split(",");
  const keep = ["time", "latitude", "longitude", "depth", "mag", "magType", "place"];
  const idx = keep.map((k) => head.indexOf(k));
  const split = (line) => {
    const out = [];
    let cur = "";
    let q = false;
    for (let i = 0; i < line.length; i++) {
      const ch = line[i];
      if (q) {
        if (ch === '"' && line[i + 1] === '"') ((cur += '""'), i++);
        else if (ch === '"') ((q = false), (cur += ch));
        else cur += ch;
      } else if (ch === '"') ((q = true), (cur += ch));
      else if (ch === ",") (out.push(cur), (cur = ""));
      else cur += ch;
    }
    out.push(cur);
    return out;
  };
  const out = [keep.join(",")];
  for (const line of rows.slice(1)) {
    const f = split(line);
    out.push(idx.map((i) => f[i] ?? "").join(","));
  }
  write("assets/toys/data-in-3d/earthquakes-usgs.csv", out.join("\n") + "\n");
}

// Iris: Bezdek's corrected copy of Fisher's table, with a header row.
{
  const text = (await get("iris")).replace(/\r\n/g, "\n").trim();
  const out = ["sepal length (cm),sepal width (cm),petal length (cm),petal width (cm),species"];
  for (const line of text.split("\n")) {
    if (!line.trim()) continue;
    const f = line.split(",");
    f[4] = f[4].replace(/^Iris-/, "Iris ");
    out.push(f.join(","));
  }
  write("assets/toys/data-in-3d/iris-uci.csv", out.join("\n") + "\n");
}
