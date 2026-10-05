#!/usr/bin/env node
// Lane Space r2: the stars within 20 parsecs (65 light-years) of the Sun, for
// the "Stars near the Sun" toy. Writes assets/toys/nearby-stars/stars.json.
//
//   node tools/sp2-stars.mjs
//
// The stars come from the Gaia Catalogue of Nearby Stars (GCNS; Gaia
// Collaboration, Smart et al. 2021, A&A 649, A6; Gaia data, CC BY-SA 3.0
// IGO), read from CDS VizieR (J/A+A/649/A6): each star's Galactic x, y, z
// (the median of its distance), G magnitude and BP and RP magnitudes. Gaia
// cannot measure the very brightest stars (Sirius, Alpha Centauri A and B,
// Vega ...), so the stars brighter than magnitude 3.5 that GCNS lacks come
// from the HYG database v4.4 (David Nash, astronexus; CC BY-SA 4.0), from
// Hipparcos: their equatorial x, y, z turned to Galactic, V magnitude and
// B − V color. HYG also gives the proper names of the stars it shares with
// GCNS (a star within 0.15 pc, with G no more than 3.5 magnitudes brighter than V, or 1 fainter: red dwarfs are much brighter in G).
//
// The file: { about, credits, stars: [[x, y, z, absG, teff, source, name?], ...] }
// with x toward the Galactic center, y toward Galactic rotation, z toward
// the north Galactic pole (parsecs, 3 decimals), absG the absolute G
// magnitude (from Hipparcos V for HYG stars, plus the table's G − V for its
// color), teff its temperature in kelvins from its color (null without
// one), and source 0 (GCNS) or 1 (HYG).

import fs from "node:fs";
import zlib from "node:zlib";

const OUT = "assets/toys/nearby-stars/stars.json";
const GCNS =
  "https://vizier.cds.unistra.fr/viz-bin/asu-tsv?-source=J/A%2BA/649/A6/table1c&-out.max=200000" +
  "&-out=GaiaEDR3,xcoord50,ycoord50,zcoord50,Gmag,BPmag,RPmag,Dist50&Dist50=<0.02";
const HYG = "https://codeberg.org/astronexus/hyg/media/branch/main/data/hyg/CURRENT/hyg_v44.csv.gz";
const R = 20;

async function get(url) {
  const r = await fetch(url);
  if (!r.ok) throw new Error(`${url}: HTTP ${r.status}`);
  return Buffer.from(await r.arrayBuffer());
}

// Equatorial (ICRS) to Galactic: the standard rotation (Hipparcos, vol. 1, 1.5.3).
const AG = [
  [-0.0548755604, -0.8734370902, -0.4838350155],
  [0.4941094279, -0.44482963, 0.7469822445],
  [-0.867666149, -0.1980763734, 0.4559837762],
];
const toGal = (v) => AG.map((row) => row[0] * v[0] + row[1] * v[1] + row[2] * v[2]);

// Colors to temperatures, and V to G, by interpolating Mamajek's table of
// mean dwarf colors and temperatures (Pecaut & Mamajek 2013, version
// 2022.04.16): Teff from Gaia's BP − RP, or from B − V for HYG stars.
const EEM = "https://www.pas.rochester.edu/~emamajek/EEM_dwarf_UBVIJHK_colors_Teff.txt";
const eem = (await get(EEM)).toString("utf8").split("\n");
const cols = eem
  .find((l) => l.startsWith("#SpT"))
  .trim()
  .split(/\s+/);
const rows = [];
for (const l of eem) {
  if (l.startsWith("#SpT")) {
    if (rows.length) break;
    continue;
  }
  const f = l.trim().split(/\s+/);
  if (f.length < 12 || !/^[OBAFGKMLTY]\d/.test(f[0])) continue;
  const v = (name) => {
    const x = Number(f[cols.indexOf(name)]);
    return Number.isFinite(x) ? x : null;
  };
  rows.push({ teff: v("Teff"), bv: v("B-V"), bprp: v("Bp-Rp"), gv: v("G-V") });
}
// y at x, along the table (rows where both are known), by a straight line
// between neighbors; clamped at the ends.
function interp(key, x, out) {
  const t = rows.filter((r) => r[key] !== null && r[out] !== null).sort((a, b) => a[key] - b[key]);
  if (x <= t[0][key]) return t[0][out];
  for (let i = 1; i < t.length; i++)
    if (x <= t[i][key]) {
      const a = t[i - 1];
      const b = t[i];
      return a[out] + ((b[out] - a[out]) * (x - a[key])) / (b[key] - a[key] || 1);
    }
  return t[t.length - 1][out];
}

const stars = [];
const tsv = (await get(GCNS))
  .toString("utf8")
  .split("\n")
  .filter((l) => /^\d/.test(l));
for (const line of tsv) {
  const [, x, y, z, g, bp, rp, d] = line.split("\t").map((s) => s.trim());
  if (!x || !g) continue;
  const dist = Number(d) * 1000;
  const absG = Number(g) - 5 * Math.log10(dist / 10);
  const teff = bp && rp ? interp("bprp", Number(bp) - Number(rp), "teff") : null;
  stars.push({ p: [Number(x), Number(y), Number(z)], absG, teff, src: 0, g: Number(g) });
}
const hyg = zlib
  .gunzipSync(await get(HYG))
  .toString("utf8")
  .split("\n");
const head = hyg[0].replace(/"/g, "").split(",");
const col = (name) => head.indexOf(name);
const [iD, iM, iCi, iX, iY, iZ, iN] = ["dist", "mag", "ci", "x", "y", "z", "proper"].map(col);
let added = 0;
let named = 0;
for (const line of hyg.slice(1)) {
  const f = line.replace(/"/g, "").split(",");
  const dist = Number(f[iD]);
  if (!(dist > 0 && dist < R)) continue;
  const p = toGal([Number(f[iX]), Number(f[iY]), Number(f[iZ])]);
  const mag = Number(f[iM]);
  const bv = f[iCi] === "" ? 0.6 : Number(f[iCi]);
  const name = f[iN] || "";
  // The same star in GCNS?
  let best = null;
  for (const s of stars) {
    if (s.src) continue;
    const d = Math.hypot(s.p[0] - p[0], s.p[1] - p[1], s.p[2] - p[2]);
    if (d < 0.15 && s.g - mag < 1 && s.g - mag > -3.5 && (!best || d < best.d)) best = { s, d };
  }
  if (best) {
    if (name && !best.s.name) ((best.s.name = name), named++);
    continue;
  }
  if (mag >= 3.5) continue;
  const absV = mag - 5 * Math.log10(dist / 10);
  stars.push({ p, absG: absV + interp("bv", bv, "gv"), teff: interp("bv", bv, "teff"), src: 1, name }); // prettier-ignore
  added++;
}
const round = (v, k = 3) => Math.round(v * 10 ** k) / 10 ** k;
const out = {
  about:
    "Stars within 20 pc of the Sun: Galactic x (toward the center), y (toward rotation), z (north) in parsecs, absolute G magnitude, temperature (K) from color, source (0 GCNS, 1 HYG) and name. Made by tools/sp2-stars.mjs.",
  credits: [
    "Gaia Catalogue of Nearby Stars (Gaia Collaboration, Smart et al. 2021, A&A 649, A6), ESA/Gaia/DPAC, CC BY-SA 3.0 IGO, via CDS VizieR J/A+A/649/A6.",
    "HYG database v4.4 (David Nash, astronexus), CC BY-SA 4.0: the brightest stars Gaia lacks, and star names.",
    "Temperatures from colors: E. Mamajek, A Modern Mean Dwarf Stellar Color and Effective Temperature Sequence (Pecaut & Mamajek 2013), version 2022.04.16.",
  ],
  stars: stars.map((s) => {
    const row = [round(s.p[0]), round(s.p[1]), round(s.p[2]), round(s.absG, 2), s.teff === null ? null : Math.round(s.teff), s.src]; // prettier-ignore
    if (s.name) row.push(s.name);
    return row;
  }),
};
fs.mkdirSync("assets/toys/nearby-stars", { recursive: true });
fs.writeFileSync(OUT, JSON.stringify(out) + "\n");
console.log(`${stars.length} stars (${added} bright ones from HYG, ${named} GCNS stars named), ${Math.round(fs.statSync(OUT).size / 1024)} KB`); // prettier-ignore
