#!/usr/bin/env node
// Builds src/chem/periodic.js, the element data behind the periodic table
// and the atom toy (lane Chemistry), from published tables:
//
// - NIST, "Atomic Weights and Isotopic Compositions" (Coursey et al.): the
//   most abundant isotope of each element, or the mass number NIST gives in
//   brackets for an element with no stable isotope.
// - PubChem's periodic table (NCBI): names, families (the "group block"),
//   and the mass numbers (the longest-lived isotope) and predicted electron
//   configurations of the elements NIST has no numbers for (95 to 118 and
//   109 to 118), with the IUPAC table's mass numbers from 109 on.
// - NIST Atomic Spectra Database, ground levels (Kramida et al.): the
//   ground-state electron configuration of every neutral atom it lists
//   (1 to 108).
// - NIST, "Handbook of Basic Atomic Spectroscopic Data" (Sansonetti and
//   Martin, SRD 108): each element's strong lines; the toy's photon is the
//   strongest visible line (380 to 750 nm in air) of the neutral atom (or of
//   its ion when the atom has none there). It covers 1 to 99.
//
//   node tools/chs-data.mjs            # fetch and write src/chem/periodic.js
//   node tools/chs-data.mjs --cache=D  # keep the downloads in D

import fs from "node:fs";
import path from "node:path";

const root = path.resolve(path.dirname(new URL(import.meta.url).pathname), "..");
const cacheArg = process.argv.find((a) => a.startsWith("--cache="));
const cache = cacheArg ? cacheArg.slice(8) : path.join(root, ".cache/chs-data");
fs.mkdirSync(cache, { recursive: true });

async function get(url, file) {
  const at = path.join(cache, file);
  if (fs.existsSync(at)) return fs.readFileSync(at, "utf8");
  for (let i = 0; i < 4; i++) {
    try {
      const r = await fetch(url, { headers: { "User-Agent": "SplasheryBuild/1.0 (build tool)" } });
      if (!r.ok) throw new Error(`${r.status} ${url}`);
      const text = await r.text();
      fs.writeFileSync(at, text);
      return text;
    } catch (err) {
      if (i === 3) throw err;
      await new Promise((ok) => setTimeout(ok, 2000 * 2 ** i));
    }
  }
}

// ---- PubChem's periodic table ------------------------------------------------
const pt = JSON.parse(await get("https://pubchem.ncbi.nlm.nih.gov/rest/pug/periodictable/JSON", "pubchem.json")); // prettier-ignore
const cols = pt.Table.Columns.Column;
const col = (row, name) => row.Cell[cols.indexOf(name)];
const pub = pt.Table.Row.map((r) => ({
  z: Number(col(r, "AtomicNumber")),
  symbol: col(r, "Symbol"),
  name: col(r, "Name"),
  mass: Number(col(r, "AtomicMass")),
  config: col(r, "ElectronConfiguration"),
  block: col(r, "GroupBlock"),
}));

// ---- NIST isotopes ------------------------------------------------------------
const comp = await get("https://physics.nist.gov/cgi-bin/Compositions/stand_alone.pl?ele=&all=all&ascii=ascii2&isotype=all", "nist-isotopes.txt"); // prettier-ignore
const isotopes = {};
for (const block of comp.split(/\n\s*\n/)) {
  const rec = Object.fromEntries(
    block
      .split("\n")
      .map((l) => l.split(" = "))
      .filter((x) => x.length === 2)
      .map(([k, v]) => [k.trim(), v.trim()]),
  );
  if (!rec["Atomic Number"]) continue;
  (isotopes[rec["Atomic Number"]] ??= []).push(rec);
}
function massNumber(z) {
  const list = isotopes[z] || [];
  let best = null;
  let most = 0;
  for (const r of list) {
    const c = parseFloat(r["Isotopic Composition"] || "");
    if (c > most) [most, best] = [c, r];
  }
  if (best) return { A: Number(best["Mass Number"]), how: "abundant" };
  const saw = list[0]?.["Standard Atomic Weight"] || "";
  const m = saw.match(/^\[(\d+)\]$/);
  if (m) return { A: Number(m[1]), how: "longest-lived" };
  // No NIST number: PubChem's mass of the longest-lived isotope.
  return { A: Math.round(pub[z - 1].mass), how: "longest-lived" };
}

// The IUPAC Periodic Table of the Elements (May 4, 2022) gives these mass
// numbers for the longest-lived known isotopes; PubChem's differ.
const IUPAC = { 109: 278, 110: 281, 111: 282, 112: 285, 113: 286, 114: 289, 115: 290, 116: 293, 117: 294, 118: 294 }; // prettier-ignore

// ---- NIST ground configurations ---------------------------------------------------
const ie = await get("https://physics.nist.gov/cgi-bin/ASD/ie.pl?spectra=H-Og&submit=Retrieve+Data&units=1&format=2&order=0&at_num_out=on&sp_name_out=on&ion_charge_out=on&el_name_out=on&seq_out=on&shells_out=on&level_out=on&e_out=0", "nist-ground.csv"); // prettier-ignore
const nistConfig = {};
for (const line of ie.split("\n").slice(1)) {
  const c = line.split(",").map((s) => s.replace(/^"=""|"""$/g, ""));
  if (c[2] === "0" && c[5]) nistConfig[Number(c[0])] = c[5];
}

// "[Ar].3d10.4s2.4p" or "[Rn]7s2 5f14 6d10 7p1 (predicted)" -> subshells.
const subshells = {};
function expand(config) {
  const out = [];
  const core = config.match(/\[([A-Z][a-z]?)\]/);
  if (core) out.push(...subshells[core[1]]);
  for (const [, n, l, k] of config.replace(/\[[A-Za-z]+\]/, "").matchAll(/(\d)([spdfg])(\d*)/g))
    out.push([Number(n), l, k ? Number(k) : 1]);
  return out;
}

// ---- NIST strong lines ------------------------------------------------------------------
const ROMAN = ["I", "II", "III"];
async function strongLine(name, symbol) {
  const file = name.toLowerCase().replace("aluminium", "aluminum").replace("caesium", "cesium");
  let html;
  try {
    html = await get(`https://physics.nist.gov/PhysRefData/Handbook/Tables/${file}table2.htm`, `lines-${file}.htm`); // prettier-ignore
  } catch {
    return null;
  }
  const text = html.replace(/<[^>]*>/g, "").replace(/&nbsp;/g, " ");
  const esc = symbol.replace(/[^A-Za-z]/g, "");
  const re = new RegExp(`^\\s*(\\d+)\\s*[A-Za-z]*\\s+([\\d.]+)\\s*${esc}\\s+(III|II|I)(?![IV])`);
  // Only the air wavelengths (the vacuum table comes first, below 2000 Å).
  const air = text.slice(Math.max(0, text.indexOf("AirWavelength")));
  const lines = [];
  for (const l of air.split("\n")) {
    const m = l.match(re);
    if (!m) continue;
    const nm = Number(m[2]) / 10;
    if (nm >= 380 && nm <= 750) lines.push({ intensity: Number(m[1]), nm, spectrum: m[3] });
  }
  for (const sp of ROMAN) {
    const of = lines.filter((x) => x.spectrum === sp);
    if (!of.length) continue;
    const top = of.reduce((a, b) => (b.intensity > a.intensity ? b : a));
    return { ...top, color: waveColor(top.nm) };
  }
  return null;
}

// A wavelength's color as the eye sees it, at full brightness (Dan Bruton's
// approximation of the visible spectrum).
function waveColor(nm) {
  let rgb;
  if (nm < 440) rgb = [(440 - nm) / 60, 0, 1];
  else if (nm < 490) rgb = [0, (nm - 440) / 50, 1];
  else if (nm < 510) rgb = [0, 1, (510 - nm) / 20];
  else if (nm < 580) rgb = [(nm - 510) / 70, 1, 0];
  else if (nm < 645) rgb = [1, (645 - nm) / 65, 0];
  else rgb = [1, 0, 0];
  const f = nm < 420 ? 0.3 + (0.7 * (nm - 380)) / 40 : nm > 700 ? 0.3 + (0.7 * (780 - nm)) / 80 : 1;
  const hex = (v) =>
    Math.round(255 * (v * f) ** 0.8)
      .toString(16)
      .padStart(2, "0");
  return `#${rgb.map(hex).join("")}`;
}

// ---- The families, as the toy colors them -------------------------------------------------
const FAMILY = {
  "Alkali metal": "alkali",
  "Alkaline earth metal": "alkaline",
  "Transition metal": "transition",
  "Post-transition metal": "post",
  Metalloid: "metalloid",
  Nonmetal: "nonmetal",
  Halogen: "halogen",
  "Noble gas": "noble",
  Lanthanide: "lanthanide",
  Actinide: "actinide",
};

const rows = [];
for (const e of pub) {
  const config = nistConfig[e.z] || e.config.replace(/\s*\(.*\)\s*/, "");
  const subs = expand(config);
  subshells[e.symbol] = subs;
  const shells = [];
  for (const [n, , k] of subs) shells[n - 1] = (shells[n - 1] || 0) + k;
  for (let i = 0; i < shells.length; i++) shells[i] ||= 0;
  const Z = shells.reduce((a, b) => a + b, 0);
  if (Z !== e.z) throw new Error(`${e.symbol}: ${config} holds ${Z} electrons`);
  const { A: nistA, how } = massNumber(e.z);
  const A = IUPAC[e.z] ?? nistA;
  const line = e.z <= 99 ? await strongLine(e.name, e.symbol) : null;
  const family = FAMILY[e.block];
  if (!family) throw new Error(`${e.symbol}: family ${e.block}`);
  const name = e.name;
  // "[Ar].3d10.4s2" -> "[Ar] 3d10 4s2" (a count of 1 is left out, as NIST writes it).
  const pretty = config
    .replace(/\s*\(.*\)\s*/, "")
    .replace(/\./g, " ")
    .replace(/\](?=\d)/, "] ")
    .replace(/(\d[spdfg])1(?=\s|$)/g, "$1")
    .replace(/\s+/g, " ")
    .trim();
  rows.push([e.z, e.symbol, name, A, how === "abundant" ? 1 : 0, family, shells, pretty, line ? Math.round(line.nm * 10) / 10 : 0, line ? line.spectrum : "", line ? line.color : ""]); // prettier-ignore
  process.stdout.write(`${e.z} ${e.symbol} A=${A} ${shells.join(",")} ${line ? `${line.nm} ${line.spectrum} ${line.color}` : "-"}\n`); // prettier-ignore
}

const body = rows.map((r) => `  ${JSON.stringify(r)},`).join("\n");
const out = `// The 118 elements for the chemistry toys (lane Chemistry), written by
// tools/chs-data.mjs from published tables; don't edit it by hand.
//
// Each row: [Z, symbol, name, mass number, 1 when that is the most abundant
// isotope (else the longest-lived one), family, electrons per shell (n = 1
// up), ground-state configuration, the strongest visible emission line in nm
// (0: none measured), the spectrum it belongs to ("I" the neutral atom,
// "II" its ion), that line's color ("" when none)].
//
// Sources: NIST Atomic Weights and Isotopic Compositions; the NIST Atomic
// Spectra Database's ground levels (1 to 108); the NIST Handbook of Basic
// Atomic Spectroscopic Data's strong lines (1 to 99); PubChem's periodic
// table (families; mass numbers from 95 to 108 and configurations from 109);
// the IUPAC Periodic Table of the Elements (2022; mass numbers from 109).

// prettier-ignore
export const PERIODIC = [
${body}
];
`;
fs.writeFileSync(path.join(root, "src/chem/periodic.js"), out);
console.log("wrote src/chem/periodic.js");
