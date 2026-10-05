#!/usr/bin/env node
// Lane Night sky: builds the Night sky's catalog snapshot,
// assets/toys/night-sky/sky.json, from two open sources (docs/handoff/NightSky.md):
//
// - the HYG database v4.1 (David Nash, astronexus; CC BY-SA 4.0): every star to magnitude 6.0,
//   plus the fainter stars a constellation line needs;
// - the Stellarium "Western" sky culture's constellation lines (the Stellarium team; text and
//   data CC BY-SA), pinned to one commit.
//
// The snapshot is made from CC BY-SA data, so it is CC BY-SA 4.0 too (CREDITS.md).
//
//   node tools/sky-catalog.mjs            downloads the sources into .cache/sky/ (once) and writes
//                                         the snapshot
//   node tools/sky-catalog.mjs --mag=6.0  another magnitude limit

import fs from "node:fs";
import path from "node:path";

const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname), "..");
const CACHE = path.join(ROOT, ".cache/sky");
const OUT = path.join(ROOT, "assets/toys/night-sky/sky.json");
const arg = (k, d) => process.argv.find((a) => a.startsWith(`--${k}=`))?.split("=")[1] ?? d;
const MAG = Number(arg("mag", "6.0"));

const HYG_URL =
  "https://raw.githubusercontent.com/astronexus/HYG-Database/main/hyg/CURRENT/hygdata_v41.csv";
const LINES_COMMIT = "014fbb5e59233d133c22f9811af96b67d05a95c9";
const LINES_URL = `https://raw.githubusercontent.com/Stellarium/stellarium-skycultures/${LINES_COMMIT}/western/index.json`;

async function fetchOnce(url, file) {
  const p = path.join(CACHE, file);
  if (!fs.existsSync(p)) {
    fs.mkdirSync(CACHE, { recursive: true });
    const r = await fetch(url);
    if (!r.ok) throw new Error(`${url}: ${r.status}`);
    fs.writeFileSync(p, Buffer.from(await r.arrayBuffer()));
  }
  return fs.readFileSync(p, "utf8");
}

// A CSV line with quoted fields (HYG quotes its strings).
function splitCSV(line) {
  const out = [];
  let cur = "";
  let q = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (q) {
      if (ch === '"' && line[i + 1] === '"') (cur += '"'), i++;
      else if (ch === '"') q = false;
      else cur += ch;
    } else if (ch === '"') q = true;
    else if (ch === ",") out.push(cur), (cur = "");
    else cur += ch;
  }
  out.push(cur);
  return out;
}

const GREEK = {
  Alp: "α", Bet: "β", Gam: "γ", Del: "δ", Eps: "ε", Zet: "ζ", Eta: "η", The: "θ", Iot: "ι",
  Kap: "κ", Lam: "λ", Mu: "μ", Nu: "ν", Xi: "ξ", Omi: "ο", Pi: "π", Rho: "ρ", Sig: "σ",
  Tau: "τ", Ups: "υ", Phi: "φ", Chi: "χ", Psi: "ψ", Ome: "ω",
}; // prettier-ignore
const SUP = { 1: "¹", 2: "²", 3: "³", 4: "⁴", 5: "⁵", 6: "⁶", 7: "⁷", 8: "⁸", 9: "⁹" };

// "α Ori", "61 Cyg", or "" from HYG's bayer, flam and con fields.
function designation(bayer, flam, con) {
  if (!con) return "";
  const m = /^([A-Z][a-z]+)(?:-(\d))?$/.exec(bayer || "");
  if (m && GREEK[m[1]]) return `${GREEK[m[1]]}${m[2] ? SUP[m[2]] : ""} ${con}`;
  if (flam) return `${flam} ${con}`;
  return "";
}

const r = (v, d) => Math.round(v * 10 ** d) / 10 ** d;

async function main() {
  const csv = await fetchOnce(HYG_URL, "hygdata_v41.csv");
  const lines = JSON.parse(await fetchOnce(LINES_URL, "western-index.json"));
  // The HIP numbers the lines need.
  const lineHips = new Set();
  for (const c of lines.constellations)
    for (const poly of c.lines) for (const h of poly) if (typeof h === "number") lineHips.add(h);

  const rows = csv.split(/\r?\n/);
  const head = splitCSV(rows[0]);
  const col = Object.fromEntries(head.map((h, i) => [h, i]));
  const stars = [];
  for (let i = 1; i < rows.length; i++) {
    if (!rows[i]) continue;
    const f = splitCSV(rows[i]);
    const id = Number(f[col.id]);
    if (id === 0) continue; // the Sun
    const mag = Number(f[col.mag]);
    const hip = Number(f[col.hip]) || 0;
    if (!(mag <= MAG) && !(hip && lineHips.has(hip))) continue;
    const ci = f[col.ci] === "" ? null : Number(f[col.ci]);
    const dist = Number(f[col.dist]);
    stars.push({
      ra: r(Number(f[col.ra]) * 15, 4), // degrees
      dec: r(Number(f[col.dec]), 4),
      mag: r(mag, 2),
      ci: ci === null || !Number.isFinite(ci) ? null : r(ci, 3),
      // Parsecs; HYG marks a missing or dubious parallax with 100000 or more.
      dist: Number.isFinite(dist) && dist > 0 && dist < 100000 ? r(dist, 2) : null,
      hip,
      name: f[col.proper] || "",
      des: designation(f[col.bayer], f[col.flam], f[col.con]),
      con: f[col.con] || "",
      spect: f[col.spect] || "",
    });
  }
  stars.sort((a, b) => a.mag - b.mag);
  const byHip = new Map(stars.filter((s) => s.hip).map((s, i) => [s.hip, s]));
  stars.forEach((s, i) => (s.i = i));

  const cons = [];
  let segments = 0;
  let missing = 0;
  for (const c of lines.constellations) {
    const pairs = [];
    for (const poly of c.lines) {
      const hips = poly.filter((h) => typeof h === "number"); // skip "thin" and "bold"
      for (let k = 1; k < hips.length; k++) {
        const a = byHip.get(hips[k - 1]);
        const b = byHip.get(hips[k]);
        if (!a || !b) {
          missing++;
          continue;
        }
        pairs.push(a.i, b.i);
        segments++;
      }
    }
    cons.push({ iau: c.iau, name: c.common_name?.native || c.iau, english: c.common_name?.english || "", lines: pairs }); // prettier-ignore
  }

  // Compact columns keep the file small: one array per field.
  const out = {
    about:
      "The Night sky's catalog snapshot, made by tools/sky-catalog.mjs. Stars: the HYG database v4.1 (David Nash, astronexus.com; CC BY-SA 4.0), every star to magnitude " +
      MAG.toFixed(1) +
      " and the fainter stars a constellation line needs; positions are J2000. Constellation lines: the Stellarium team's Western sky culture (github.com/Stellarium/stellarium-skycultures, commit " +
      LINES_COMMIT.slice(0, 10) +
      "; text and data CC BY-SA). This file is CC BY-SA 4.0.",
    license: "CC BY-SA 4.0",
    built: new Date().toISOString().slice(0, 10),
    count: stars.length,
    ra: stars.map((s) => s.ra),
    dec: stars.map((s) => s.dec),
    mag: stars.map((s) => s.mag),
    ci: stars.map((s) => s.ci),
    dist: stars.map((s) => s.dist),
    hip: stars.map((s) => s.hip),
    name: stars.map((s) => s.name),
    des: stars.map((s) => s.des),
    con: stars.map((s) => s.con),
    spect: stars.map((s) => s.spect),
    constellations: cons,
  };
  fs.mkdirSync(path.dirname(OUT), { recursive: true });
  fs.writeFileSync(OUT, JSON.stringify(out));
  const kb = (fs.statSync(OUT).size / 1024).toFixed(0);
  console.log(`${stars.length} stars (to mag ${MAG}), ${cons.length} constellations, ${segments} line segments (${missing} missing), ${kb} KB → ${path.relative(ROOT, OUT)}`); // prettier-ignore
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
