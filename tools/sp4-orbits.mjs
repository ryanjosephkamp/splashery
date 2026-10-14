#!/usr/bin/env node
// Lane Space r4: the data for "The solar system on real orbits", a small
// dated snapshot that ships with the site (nothing is fetched at run time).
//
//   node tools/sp4-orbits.mjs            writes assets/toys/solar-orbits/orbits.json and maps/
//   node tools/sp4-orbits.mjs --horizons prints JPL Horizons positions for the test
//
// - Asteroids: a uniform random sample (seeded, so it is the same every run)
//   of the numbered asteroids in the JPL Small-Body Database whose orbits'
//   semi-major axes are under 5.6 au (the main belt, the Hildas, the Trojans
//   and the near-Earth and Mars-crossing asteroids; 99.9% of the numbered
//   ones), from the SBDB Query API, plus Ceres, Pallas, Vesta and Hygiea,
//   the four largest, marked as such. One common epoch (SBDB's).
// - Comets: 1P/Halley, 2P/Encke, 9P/Tempel 1 and 67P/Churyumov-Gerasimenko
//   from the SBDB API (each at its own solution's epoch).
// - Moons: JPL's Planetary Satellite Mean Elements (copied below from
//   https://ssd.jpl.nasa.gov/sats/elem/, checked October 7, 2026).
// - Maps: 128 x 64 copies of the Space r2 color maps (assets/toys/real-worlds/),
//   small enough to color a planet a few hundred splats across.
//
// The SBDB download (about 140 MB) is cached in .cache/sp4/.

import fs from "node:fs";
import path from "node:path";
import jpeg from "jpeg-js";

const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname), "..");
const CACHE = path.join(ROOT, ".cache/sp4");
const OUT = path.join(ROOT, "assets/toys/solar-orbits");
const SAMPLE = 4000;
const A_MAX = 5.6;
const CHECKED = "2026-10-07";

async function cached(name, url) {
  const f = path.join(CACHE, name);
  if (fs.existsSync(f)) return JSON.parse(fs.readFileSync(f, "utf8"));
  fs.mkdirSync(CACHE, { recursive: true });
  const r = await fetch(url);
  if (!r.ok) throw new Error(`${url}: ${r.status}`);
  const text = await r.text();
  fs.writeFileSync(f, text);
  return JSON.parse(text);
}

// A small seeded generator (mulberry32).
function rng(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const r5 = (x) => Math.round(x * 1e5) / 1e5;
const r3 = (x) => Math.round(x * 1e3) / 1e3;

async function asteroids() {
  const d = await cached(
    "numbered.json",
    "https://ssd-api.jpl.nasa.gov/sbdb_query.api?fields=pdes,a,e,i,om,w,ma,epoch,H,class&sb-kind=a&sb-ns=n&full-prec=1",
  );
  const rows = d.data;
  // The common epoch (all but a couple share it).
  const count = new Map();
  for (const r of rows) count.set(r[7], (count.get(r[7]) || 0) + 1);
  const epoch = [...count].sort((a, b) => b[1] - a[1])[0][0];
  const pool = rows.filter((r) => r[7] === epoch && Number(r[1]) > 0 && Number(r[1]) < A_MAX);
  const rand = rng(20261007);
  // A partial Fisher-Yates shuffle: the first SAMPLE of a random order.
  const idx = pool.map((_, i) => i);
  for (let i = 0; i < SAMPLE; i++) {
    const j = i + Math.floor(rand() * (idx.length - i));
    [idx[i], idx[j]] = [idx[j], idx[i]];
  }
  const picked = idx.slice(0, SAMPLE).map((i) => pool[i]);
  const big = ["1", "2", "4", "10"];
  for (const n of big) if (!picked.some((r) => r[0] === n)) picked.push(rows.find((r) => r[0] === n)); // prettier-ignore
  picked.sort((a, b) => Number(a[0]) - Number(b[0]));
  const classes = {};
  for (const r of picked) classes[r[9]] = (classes[r[9]] || 0) + 1;
  return {
    epochJD: Number(epoch),
    total: rows.length,
    pool: pool.length,
    classes,
    fields: ["number", "a (au)", "e", "i", "node", "peri", "M (deg)", "H"],
    big: big.map(Number),
    list: picked.map((r) => [
      Number(r[0]),
      r5(Number(r[1])),
      r5(Number(r[2])),
      r3(Number(r[3])),
      r3(Number(r[4])),
      r3(Number(r[5])),
      r3(Number(r[6])),
      Math.round(Number(r[8]) * 10) / 10,
    ]),
  };
}

const COMETS = [
  { id: "halley", sstr: "1P", name: "Halley's Comet (1P)", label: "Halley" },
  { id: "encke", sstr: "2P", name: "Comet Encke (2P)", label: "Encke" },
  { id: "tempel-1", sstr: "9P", name: "Tempel 1 (9P)", label: "Tempel 1" },
  { id: "67p", sstr: "67P", name: "Churyumov-Gerasimenko (67P)", label: "67P" },
];

async function comets() {
  const out = [];
  for (const c of COMETS) {
    const d = await cached(`${c.sstr}.json`, `https://ssd-api.jpl.nasa.gov/sbdb.api?sstr=${c.sstr}&full-prec=1`); // prettier-ignore
    const el = Object.fromEntries(d.orbit.elements.map((e) => [e.name, Number(e.value)]));
    out.push({
      id: c.id,
      name: c.name,
      label: c.label,
      full: d.object.fullname,
      epochJD: Number(d.orbit.epoch),
      a: el.a,
      e: el.e,
      i: el.i,
      node: el.om,
      peri: el.w,
      M: el.ma,
      tpJD: el.tp,
      periodDays: el.per,
    });
  }
  return out;
}

// JPL Planetary Satellite Mean Elements (https://ssd.jpl.nasa.gov/sats/elem/):
// epoch 2000-01-01.5 TDB; a (km), e, peri (w), M, i, node (degrees), period
// (days), the apsis and node periods (years; the node regresses), and the
// Laplace plane's pole (RA, Dec; J2000 equator). The Moon's are referred to
// the ecliptic, and its period is sidereal (its mean longitude's). The
// Galilean moons' periods are their mean anomalies'; Io's and Europa's
// periapses regress (held by the Laplace resonance with Ganymede), so their
// apsis periods are given negative. Titan: its osculating elements on
// October 7, 2026 from JPL Horizons (Saturn-centered, J2000 ecliptic), run
// at the table's mean sidereal period. (Triton is left out: neither way
// stays within a few degrees of Horizons from 1800 to 2050.)
// (The table's Titan row does not match Horizons even at its own epoch, so
// it is not used.) tests/sp4.spec.mjs checks each against Horizons.
const MOONS = [
  { id: "moon", name: "the Moon", planet: "earth", frame: "ecliptic", a: 384400, e: 0.0554, peri: 318.15, M: 135.27, i: 5.16, node: 125.08, P: 27.322, sidereal: true, Papsis: 5.997, Pnode: 18.6, radiusKm: 1737.4, map: "moon" }, // prettier-ignore
  { id: "io", name: "Io", planet: "jupiter", frame: "laplace", a: 421800, e: 0.004, peri: 49.1, M: 330.9, i: 0.0, node: 0.0, P: 1.762732, Papsis: -1.333, Pnode: 0, ra: 268.1, dec: 64.5, radiusKm: 1821.6, map: "io" }, // prettier-ignore
  { id: "europa", name: "Europa", planet: "jupiter", frame: "laplace", a: 671100, e: 0.009, peri: 45.0, M: 345.4, i: 0.5, node: 184.0, P: 3.525463, Papsis: -1.394, Pnode: 30.202, ra: 268.1, dec: 64.5, radiusKm: 1560.8, map: "europa" }, // prettier-ignore
  { id: "ganymede", name: "Ganymede", planet: "jupiter", frame: "laplace", a: 1070400, e: 0.001, peri: 198.3, M: 324.8, i: 0.2, node: 58.5, P: 7.155588, Papsis: 68.301, Pnode: 137.812, ra: 268.2, dec: 64.6, radiusKm: 2634.1, map: "ganymede" }, // prettier-ignore
  { id: "callisto", name: "Callisto", planet: "jupiter", frame: "laplace", a: 1882700, e: 0.007, peri: 43.8, M: 87.4, i: 0.3, node: 309.1, P: 16.69044, Papsis: 277.921, Pnode: 577.264, ra: 268.7, dec: 64.8, radiusKm: 2410.3, map: "callisto" }, // prettier-ignore
  { id: "titan", name: "Titan", planet: "saturn", frame: "ecliptic", epochJD: 2461320.5, a: 1221966.6, e: 0.0286517, peri: 178.42087, M: 170.80377, i: 27.705623, node: 169.08072, P: 15.945448, sidereal: true, Papsis: 0, Pnode: 0, radiusKm: 2574.7 }, // prettier-ignore
];

// The small maps: the Space r2 color maps, averaged down to 128 x 64.
const MAPS = ["earth", "moon", "mars", "mercury", "io", "europa", "ganymede", "callisto"];
function smallMaps() {
  fs.mkdirSync(path.join(OUT, "maps"), { recursive: true });
  for (const id of MAPS) {
    const src = jpeg.decode(fs.readFileSync(path.join(ROOT, `assets/toys/real-worlds/${id}-color.jpg`)), { useTArray: true, maxMemoryUsageInMB: 1024 }); // prettier-ignore
    const W = 128;
    const H = 64;
    const out = new Uint8Array(W * H * 4);
    const fx = src.width / W;
    const fy = src.height / H;
    for (let y = 0; y < H; y++)
      for (let x = 0; x < W; x++) {
        const s = [0, 0, 0];
        let n = 0;
        for (let j = Math.floor(y * fy); j < Math.floor((y + 1) * fy); j++)
          for (let i = Math.floor(x * fx); i < Math.floor((x + 1) * fx); i++) {
            const k = (j * src.width + i) * 4;
            s[0] += src.data[k];
            s[1] += src.data[k + 1];
            s[2] += src.data[k + 2];
            n++;
          }
        const o = (y * W + x) * 4;
        out[o] = s[0] / n;
        out[o + 1] = s[1] / n;
        out[o + 2] = s[2] / n;
        out[o + 3] = 255;
      }
    const enc = jpeg.encode({ data: out, width: W, height: H }, 88);
    fs.writeFileSync(path.join(OUT, "maps", `${id}.jpg`), enc.data);
  }
}

// ---- JPL Horizons reference positions (for tests/sp4.spec.mjs) ----

const HZ_DATES = ["1850-01-01", "1950-06-15", "2000-01-01", "2026-10-07", "2049-12-31"];
const HZ_PLANETS = { mercury: 199, venus: 299, emb: 3, mars: 499, jupiter: 599, saturn: 699, uranus: 799, neptune: 899 }; // prettier-ignore
async function horizons(command, date, center = "500@10") {
  const next = new Date(Date.parse(date) + 86400000).toISOString().slice(0, 10);
  const q = new URLSearchParams({
    format: "json",
    COMMAND: `'${command}'`,
    EPHEM_TYPE: "VECTORS",
    CENTER: `'${center}'`,
    START_TIME: `'${date}'`,
    STOP_TIME: `'${next}'`,
    STEP_SIZE: "'2d'",
    REF_PLANE: "ECLIPTIC",
    REF_SYSTEM: "J2000",
    OUT_UNITS: "AU-D",
    VEC_TABLE: "1",
    CSV_FORMAT: "YES",
  });
  const r = await fetch(`https://ssd.jpl.nasa.gov/api/horizons.api?${q}`);
  const j = await r.json();
  const body = j.result.split("$$SOE")[1].split("$$EOE")[0].trim().split("\n")[0].split(",");
  return [Number(body[2]), Number(body[3]), Number(body[4])].map((v) => Math.round(v * 1e6) / 1e6); // prettier-ignore
}

async function printHorizons() {
  const out = { planets: {}, small: {}, moons: {} };
  for (const [name, id] of Object.entries(HZ_PLANETS))
    for (const d of HZ_DATES) (out.planets[name] ||= {})[d] = await horizons(String(id), d);
  for (const [name, cmd, dates] of [
    ["ceres", "1;", ["2000-01-01", "2026-10-07", "2045-03-20"]],
    ["vesta", "4;", ["2000-01-01", "2026-10-07", "2045-03-20"]],
    ["halley", "DES=1P; CAP<2000; NOFRAG;", ["1986-02-09", "1950-06-15", "2000-01-01"]],
    ["encke", "DES=2P; CAP; NOFRAG;", ["2023-10-22", "2026-10-07"]],
    ["67p", "DES=67P; CAP; NOFRAG;", ["2015-08-13", "2026-10-07"]],
  ])
    for (const d of dates) (out.small[name] ||= {})[d] = await horizons(cmd, d);
  for (const [name, id, center] of [
    ["moon", "301", "500@399"],
    ["io", "501", "500@599"],
    ["ganymede", "503", "500@599"],
    ["titan", "606", "500@699"],
  ])
    for (const d of ["2000-01-01", "2026-10-07"])
      (out.moons[name] ||= {})[d] = await horizons(id, d, center);
  console.log(JSON.stringify(out, null, 1));
}

if (process.argv.includes("--horizons")) {
  await printHorizons();
} else {
  fs.mkdirSync(OUT, { recursive: true });
  const ast = await asteroids();
  const com = await comets();
  smallMaps();
  const data = {
    checked: CHECKED,
    sources: {
      asteroids:
        "JPL Small-Body Database Query API (https://ssd-api.jpl.nasa.gov/doc/sbdb_query.html)",
      comets: "JPL Small-Body Database API (https://ssd-api.jpl.nasa.gov/doc/sbdb.html)",
      moons: "JPL Planetary Satellite Mean Elements (https://ssd.jpl.nasa.gov/sats/elem/)",
    },
    asteroids: ast,
    comets: com,
    moons: MOONS,
  };
  fs.writeFileSync(path.join(OUT, "orbits.json"), JSON.stringify(data));
  console.log(`asteroids ${ast.list.length} of ${ast.pool} (of ${ast.total} numbered), epoch JD ${ast.epochJD}`, ast.classes); // prettier-ignore
  console.log(`orbits.json ${fs.statSync(path.join(OUT, "orbits.json")).size} bytes`);
}
