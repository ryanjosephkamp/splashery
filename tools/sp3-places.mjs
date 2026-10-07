#!/usr/bin/env node
// Lane Space r3: the place names a tap on a real world reads (src/space/places.js).
//
// Earth, from Natural Earth (public domain, naturalearthdata.com), 1:10m:
//   assets/toys/real-earth/places.bin   three maps of what is where, 2 arc-minutes a cell
//                                        (states and provinces; seas and lakes; mountain
//                                        ranges, deserts and other regions), run-length coded
//   assets/toys/real-earth/places.json  their names, with the cities and the peaks
//
// The other worlds, from the IAU's Gazetteer of Planetary Nomenclature (USGS
// Astrogeology, public domain, planetarynames.wr.usgs.gov), every adopted
// feature but the lettered satellite craters:
//   assets/toys/<toy>/names-<world>.json  [name, kind, lat, lon (east, −180..180), km across]
//
//   node tools/sp3-places.mjs            # downloads into .cache/sp3 the first time
//
// places.bin: "SPP1", uint16 width, uint16 height, uint8 layers, 3 bytes 0;
// then zlib-deflated, per layer, per row: uint16 runs, then each run as
// uint16 value and uint16 end column (exclusive). Value 0 is nothing there,
// else 1 + an index into the layer's list in places.json.

import fs from "node:fs";
import path from "node:path";
import zlib from "node:zlib";

const CACHE = ".cache/sp3";
const NE = "https://raw.githubusercontent.com/nvkelso/natural-earth-vector/master/geojson/";
const GAZ = "https://asc-planetarynames-data.s3.us-west-2.amazonaws.com/";
const CELLS = 30; // per degree: 2 arc-minutes, about 3.7 km
const W = 360 * CELLS;
const H = 180 * CELLS;

async function cached(url, name = path.basename(new URL(url).pathname)) {
  const file = path.join(CACHE, name);
  if (!fs.existsSync(file)) {
    fs.mkdirSync(path.dirname(file), { recursive: true });
    const r = await fetch(url);
    if (!r.ok) throw new Error(`${url}: HTTP ${r.status}`);
    fs.writeFileSync(file, Buffer.from(await r.arrayBuffer()));
  }
  return file;
}
const geo = async (n) => JSON.parse(fs.readFileSync(await cached(`${NE}${n}.geojson`, `ne/${n}.geojson`), "utf8")); // prettier-ignore

// ---- Rasterizing ----------------------------------------------------------------------------

// The polygons of a GeoJSON geometry, each a list of rings ([[lon, lat], …]).
const polysOf = (g) => (!g ? [] : g.type === "Polygon" ? [g.coordinates] : g.type === "MultiPolygon" ? g.coordinates : []); // prettier-ignore

// Fills each cell whose center is inside the polygon (even-odd over its rings)
// with v. A polygon too small to hold a cell's center marks the cell of its
// first point, if that cell is still empty.
function fill(grid, rings, v) {
  const rows = new Map();
  let any = false;
  for (const ring of rings)
    for (let i = 0; i < ring.length - 1; i++) {
      const [x1, y1] = ring[i];
      const [x2, y2] = ring[i + 1];
      if (y1 === y2) continue;
      const ja = Math.ceil((90 - Math.max(y1, y2)) * CELLS - 0.5);
      const jb = Math.floor((90 - Math.min(y1, y2)) * CELLS - 0.5);
      for (let j = Math.max(0, ja); j <= Math.min(H - 1, jb); j++) {
        const lat = 90 - (j + 0.5) / CELLS;
        if ((y1 > lat) === (y2 > lat)) continue;
        const x = x1 + ((lat - y1) / (y2 - y1)) * (x2 - x1);
        if (!rows.has(j)) rows.set(j, []);
        rows.get(j).push(x);
      }
    }
  for (const [j, xs] of rows) {
    xs.sort((a, b) => a - b);
    for (let k = 0; k + 1 < xs.length; k += 2) {
      const a = Math.max(0, Math.ceil((xs[k] + 180) * CELLS - 0.5));
      const b = Math.min(W - 1, Math.floor((xs[k + 1] + 180) * CELLS - 0.5));
      for (let i = a; i <= b; i++) grid[j * W + i] = v;
      if (b >= a) any = true;
    }
  }
  if (!any && rings[0]?.length) {
    const [x, y] = rings[0][0];
    const i = Math.min(W - 1, Math.max(0, Math.floor((x + 180) * CELLS)));
    const j = Math.min(H - 1, Math.max(0, Math.floor((90 - y) * CELLS)));
    if (!grid[j * W + i]) grid[j * W + i] = v;
  }
}

// A polygon's area in square degrees (to draw big ones first, small on top).
function area(polys) {
  let s = 0;
  for (const rings of polys)
    for (const ring of rings.slice(0, 1))
      for (let i = 0; i < ring.length - 1; i++)
        s += ring[i][0] * ring[i + 1][1] - ring[i + 1][0] * ring[i][1];
  return Math.abs(s) / 2;
}

function runs(grid) {
  const out = [];
  for (let j = 0; j < H; j++) {
    const row = [];
    let v = grid[j * W];
    for (let i = 1; i <= W; i++) {
      const u = i < W ? grid[j * W + i] : -1;
      if (u !== v) {
        row.push(v, i);
        v = u;
      }
    }
    out.push(row);
  }
  return out;
}

// Plain letters for the toy's 5 × 7 font is the toy's business; names are
// kept as Natural Earth writes them.
const clean = (s) => String(s ?? "").trim();

// ---- Earth --------------------------------------------------------------------------------

async function earth() {
  const [adm1, countries, marine, lakes, regions, cities, peaks] = await Promise.all([
    geo("ne_10m_admin_1_states_provinces"),
    geo("ne_10m_admin_0_countries"),
    geo("ne_10m_geography_marine_polys"),
    geo("ne_10m_lakes"),
    geo("ne_10m_geography_regions_polys"),
    geo("ne_10m_populated_places_simple"),
    geo("ne_10m_geography_regions_elevation_points"),
  ]);
  // Countries by their code (a state's adm0_a3), named as Natural Earth's
  // short name has them.
  const cName = new Map();
  for (const f of countries.features) cName.set(f.properties.ADM0_A3, clean(f.properties.NAME_LONG || f.properties.NAME)); // prettier-ignore
  const countryList = [];
  const countryIdx = new Map();
  const country = (a3, fallback) => {
    const n = cName.get(a3) || clean(fallback);
    if (!countryIdx.has(n)) (countryIdx.set(n, countryList.length), countryList.push(n));
    return countryIdx.get(n);
  };

  // Layer 0: states and provinces.
  const g0 = new Uint16Array(W * H);
  const states = [];
  const sorted = adm1.features.map((f) => ({ f, a: area(polysOf(f.geometry)) })).sort((a, b) => b.a - a.a); // prettier-ignore
  for (const { f } of sorted) {
    const p = f.properties;
    const v = states.length + 1;
    states.push([clean(p.name), clean(p.type_en), country(p.adm0_a3, p.admin)]);
    for (const rings of polysOf(f.geometry)) fill(g0, rings, v);
  }
  // Layer 1: seas, oceans and lakes (lakes over the seas).
  const g1 = new Uint16Array(W * H);
  const water = [];
  const wet = [
    ...marine.features.map((f) => ({ f, a: area(polysOf(f.geometry)), lake: false })).sort((a, b) => b.a - a.a), // prettier-ignore
    ...lakes.features.filter((f) => f.properties.name).map((f) => ({ f, a: area(polysOf(f.geometry)), lake: true })).sort((a, b) => b.a - a.a), // prettier-ignore
  ];
  for (const { f, lake } of wet) {
    const p = f.properties;
    const name = clean(p.name_en || p.name);
    if (!name) continue;
    const v = water.length + 1;
    water.push([name, lake ? "lake" : clean(p.featurecla).toLowerCase()]);
    for (const rings of polysOf(f.geometry)) fill(g1, rings, v);
  }
  // Layer 2: mountain ranges, deserts, plateaus and other regions (small over big).
  const g2 = new Uint16Array(W * H);
  const regionList = [];
  const reg = regions.features
    .filter((f) => f.properties.NAME && !/^(Island|Island group|Continent)$/i.test(f.properties.FEATURECLA)) // prettier-ignore
    .map((f) => ({ f, a: area(polysOf(f.geometry)) }))
    .sort((a, b) => b.a - a.a);
  for (const { f } of reg) {
    const p = f.properties;
    const v = regionList.length + 1;
    regionList.push([clean(p.NAME_EN || p.NAME), clean(p.FEATURECLA).toLowerCase()]);
    for (const rings of polysOf(f.geometry)) fill(g2, rings, v);
  }
  // Islands, as a fourth layer (an island inside a sea's polygon is still land).
  const g3 = new Uint16Array(W * H);
  const islands = [];
  const isl = regions.features
    .filter((f) => f.properties.NAME && /^(Island|Island group)$/i.test(f.properties.FEATURECLA))
    .map((f) => ({ f, a: area(polysOf(f.geometry)) }))
    .sort((a, b) => b.a - a.a);
  for (const { f } of isl) {
    const p = f.properties;
    const v = islands.length + 1;
    islands.push([clean(p.NAME_EN || p.NAME), clean(p.FEATURECLA).toLowerCase()]);
    for (const rings of polysOf(f.geometry)) fill(g3, rings, v);
  }

  const layers = [g0, g1, g2, g3].map(runs);
  const parts = [];
  for (const L of layers)
    for (const row of L) {
      const b = Buffer.alloc(2 + row.length * 2);
      b.writeUInt16LE(row.length / 2, 0);
      for (let k = 0; k < row.length; k++) b.writeUInt16LE(row[k], 2 + k * 2);
      parts.push(b);
    }
  const head = Buffer.alloc(12);
  head.write("SPP1", 0, "latin1");
  head.writeUInt16LE(W, 4);
  head.writeUInt16LE(H, 6);
  head.writeUInt8(layers.length, 8);
  const body = zlib.deflateSync(Buffer.concat(parts), { level: 9 });
  const dir = "assets/toys/real-earth";
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(path.join(dir, "places.bin"), Buffer.concat([head, body]));
  const r2 = (x) => Math.round(x * 100) / 100;
  const json = {
    source: "Natural Earth, 1:10m (public domain), naturalearthdata.com",
    cells: CELLS,
    countries: countryList,
    states,
    water,
    regions: regionList,
    islands,
    // [name, lat, lon, population]
    cities: cities.features
      .map((f) => f.properties)
      .map((p) => [clean(p.name), r2(p.latitude), r2(p.longitude), Math.max(0, p.pop_max | 0)]),
    // [name, lat, lon, meters]
    peaks: peaks.features
      .map((f) => f.properties)
      .filter((p) => p.name && /mountain|volcano|pass/i.test(p.featurecla))
      .map((p) => [clean(p.name_en || p.name), r2(p.lat_y), r2(p.long_x), p.elevation | 0, clean(p.featurecla).toLowerCase()]), // prettier-ignore
  };
  fs.writeFileSync(path.join(dir, "places.json"), JSON.stringify(json));
  const kb = (f) => `${Math.round(fs.statSync(path.join(dir, f)).size / 1024)} KB`;
  console.log(`earth: ${states.length} states, ${water.length} waters, ${regionList.length} regions, ${islands.length} islands, ${json.cities.length} cities, ${json.peaks.length} peaks; places.bin ${kb("places.bin")}, places.json ${kb("places.json")}`); // prettier-ignore
}

// ---- The Gazetteer ------------------------------------------------------------------------

function dbf(buf) {
  const n = buf.readUInt32LE(4);
  const hl = buf.readUInt16LE(8);
  const rl = buf.readUInt16LE(10);
  const fields = [];
  for (let o = 32; buf[o] !== 0x0d; o += 32)
    fields.push({ name: buf.toString("latin1", o, o + 11).replace(/\0.*$/, ""), len: buf[o + 16] });
  const rows = [];
  for (let i = 0; i < n; i++) {
    const r = {};
    let p = hl + i * rl + 1;
    for (const f of fields) {
      r[f.name] = buf.toString("utf8", p, p + f.len).trim();
      p += f.len;
    }
    rows.push(r);
  }
  return rows;
}

async function unzipDbf(zipFile) {
  // The first .dbf in the archive (stored or deflated).
  const b = fs.readFileSync(zipFile);
  for (let o = 0; o + 30 < b.length; ) {
    if (b.readUInt32LE(o) !== 0x04034b50) break;
    const method = b.readUInt16LE(o + 8);
    const csize = b.readUInt32LE(o + 18);
    const nlen = b.readUInt16LE(o + 26);
    const xlen = b.readUInt16LE(o + 28);
    const name = b.toString("utf8", o + 30, o + 30 + nlen);
    const start = o + 30 + nlen + xlen;
    if (name.endsWith(".dbf")) {
      const data = b.subarray(start, start + csize);
      return method === 8 ? zlib.inflateRawSync(data) : data;
    }
    o = start + csize;
  }
  throw new Error(`No table in ${zipFile}.`);
}

// The Gazetteer's descriptor terms in plain English.
export const KINDS = {
  AA: "crater", AL: "albedo feature", AR: "arc", CA: "chain of craters", CB: "hollows", CH: "chaos terrain",
  CM: "canyon", CO: "hills", CR: "corona", DO: "ridge", ER: "eruptive center", FA: "bright spot",
  FE: "curved ridge", FL: "lava flow", FM: "channel", FO: "trough", FR: "pancake dome", FT: "strait",
  IN: "island", LA: "landslide", LB: "maze of valleys", LC: "small plain", LF: "astronaut-named feature",
  LG: "ringed basin", LI: "line", LN: "tongue of land", LU: "dry lake bed", MA: "dark spot", ME: "lunar sea",
  MN: "mesa", MO: "mountain", OC: "great plain", PA: "small plain", PE: "volcanic crater",
  PL: "plain", PM: "plateau", PR: "cape", RE: "region", RI: "rille", RU: "cliff", SC: "scarp", SE: "sinuous ridge",
  SI: "bay of lava plain", ST: "landing site", SU: "grooves", TA: "highlands", TE: "tessera", TH: "small mountain",
  UN: "dunes", VA: "valley", VI: "streak", VS: "vast plain",
}; // prettier-ignore

const TOYS = {
  moon: "real-moon",
  mars: "real-mars",
  mercury: "real-mercury",
  venus: "real-venus",
  io: "real-moons",
  europa: "real-moons",
  ganymede: "real-moons",
  callisto: "real-moons",
  titan: "real-moons",
  pluto: "real-small-worlds",
  ceres: "real-small-worlds",
  vesta: "real-small-worlds",
};

async function gazetteer() {
  for (const [world, toy] of Object.entries(TOYS)) {
    const B = world.toUpperCase();
    const zip = await cached(`${GAZ}${B}_nomenclature_center_pts.zip`, `gaz/${B}_nomenclature_center_pts.zip`); // prettier-ignore
    const rows = dbf(await unzipDbf(zip));
    const r3 = (x) => Math.round(x * 1000) / 1000;
    const list = rows
      .filter((r) => r.code !== "SF" && /adopted/i.test(r.approval))
      .map((r) => {
        let lon = Number(r.center_lon);
        if (lon > 180) lon -= 360;
        return [clean(r.clean_name || r.name), r.code, r3(Number(r.center_lat)), r3(lon), Math.round(Number(r.diameter) * 10) / 10]; // prettier-ignore
      })
      .filter((r) => Number.isFinite(r[2]) && Number.isFinite(r[3]));
    const dir = `assets/toys/${toy}`;
    fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(
      path.join(dir, `names-${world}.json`),
      JSON.stringify({
        source: "Gazetteer of Planetary Nomenclature, IAU WGPSN and USGS Astrogeology (public domain)",
        kinds: Object.fromEntries([...new Set(list.map((r) => r[1]))].map((c) => [c, KINDS[c] || ""])),
        features: list,
      }),
    );
    console.log(`${world}: ${list.length} features → ${dir}/names-${world}.json`);
  }
}

const only = process.argv.slice(2);
if (!only.length || only.includes("earth")) await earth();
if (!only.length || only.includes("gazetteer")) await gazetteer();
