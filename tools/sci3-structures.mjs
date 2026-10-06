#!/usr/bin/env node
// Lane Science r3: the Thermal ellipsoids toy's structures. Each comes from
// the Crystallography Open Database (CC0; a CIF with _atom_site_aniso_U) or
// the Protein Data Bank (CC0; a PDB file with ANISOU records). The tool
// downloads each one into assets/toys/thermal-ellipsoids/ (PDB files trimmed
// to the records the toy reads, without waters and other alternate
// locations), reads its citation, checks it has anisotropic displacements,
// and writes src/science/structures.js (the catalog the toy's picker shows).
//
//   node tools/sci3-structures.mjs            fetch what is missing, write the catalog
//   node tools/sci3-structures.mjs --check    only check the files and the catalog
//
// The list below is the lane's choice (October 5, 2026): the best-refined
// entry with anisotropic U for each everyday molecule, medicine, mineral,
// ice and salt, and the atomic-resolution proteins and DNA with ANISOU.

import fs from "node:fs";
import path from "node:path";
import { readCrystal, readCifBlocks } from "../src/science/crystal.js";

const DIR = "assets/toys/thermal-ellipsoids";
const KEEP_DEPOSIT = new Set(["1J8G"]);
const OUT = "src/science/structures.js";
const check = process.argv.includes("--check");

// group, id (kept in links), label, source (cod:<id> or pdb:<id>), the
// file name, and how the toy shows it ("molecule": the file's atoms;
// "cell": the unit cell, or a block of cells for a small one).
const LIST = [
  ["Everyday molecules", "sucrose", "Table sugar (sucrose)", "cod:2300557", "molecule"],
  ["Everyday molecules", "urea", "Urea", "cod:1566505", "molecule"],
  ["Everyday molecules", "vitamin-c", "Vitamin C (ascorbic acid)", "cod:2300646", "molecule"],
  ["Everyday molecules", "vanillin", "Vanillin (the taste of vanilla)", "cod:7242089", "molecule"],
  ["Everyday molecules", "capsaicin", "Capsaicin (the heat of chili peppers)", "cod:2312782", "molecule"], // prettier-ignore
  ["Medicines", "aspirin", "Aspirin", "cod:2104857", "molecule", "aspirin-cod-2104857.cif"],
  ["Medicines", "paracetamol", "Acetaminophen (paracetamol)", "cod:7232757", "molecule"],
  ["Medicines", "ibuprofen", "Ibuprofen (neutron)", "cod:2006278", "molecule"],
  ["Medicines", "nicotinamide", "Vitamin B3 (nicotinamide, neutron)", "cod:2003053", "molecule"],
  ["Medicines", "salicylic-acid", "Salicylic acid (from willow bark)", "cod:2100548", "molecule"],
  ["Medicines", "morphine", "Morphine", "cod:2237167", "molecule"],
  ["Molecules of life", "glycine", "Glycine, an amino acid (neutron)", "cod:2103308", "molecule"],
  ["Molecules of life", "cytosine", "Cytosine, a letter of DNA", "cod:2019803", "molecule"],
  ["Molecules of life", "guanine", "Guanine, a letter of DNA", "cod:2015488", "molecule"],
  [
    "Molecules of life",
    "serotonin",
    "Serotonin, a messenger in the brain",
    "cod:2244048",
    "molecule",
  ],
  ["Molecules of life", "nad", "NAD+, a helper molecule in every cell", "cod:1507221", "molecule"],
  ["Minerals and gems", "quartz", "Quartz", "cod:9000775", "cell"],
  ["Minerals and gems", "calcite", "Calcite", "cod:9000965", "cell"],
  ["Minerals and gems", "corundum", "Corundum (ruby and sapphire)", "cod:1000032", "cell"],
  ["Minerals and gems", "beryl", "Beryl (emerald)", "cod:9000992", "cell"],
  ["Minerals and gems", "zircon", "Zircon", "cod:9000684", "cell"],
  ["Minerals and gems", "pyrope", "Garnet (pyrope)", "cod:2108142", "cell"],
  ["Minerals and gems", "pyrite", "Pyrite (fool's gold)", "cod:1564890", "cell"],
  ["Ice and salts", "ice", "Ice from Antarctica (neutron)", "cod:9015208", "cell"],
  ["Ice and salts", "rock-salt", "Rock salt", "cod:7132177", "cell"],
  ["Ice and salts", "gypsum", "Gypsum (neutron)", "cod:2300258", "cell"],
  ["Ice and salts", "chalcanthite", "Blue vitriol (chalcanthite, neutron)", "cod:9008253", "cell"],
  ["Proteins at atomic resolution", "crambin", "Crambin, 0.54 Å", "pdb:1EJG", "molecule", "crambin-1ejg.pdb"], // prettier-ignore
  ["Proteins at atomic resolution", "lysozyme", "Lysozyme, 0.65 Å", "pdb:2VB1", "molecule"],
  ["Proteins at atomic resolution", "hipip", "An iron-sulfur protein (HiPIP), 0.48 Å", "pdb:5D8V", "molecule"], // prettier-ignore
  ["Proteins at atomic resolution", "rubredoxin", "Rubredoxin, 0.68 Å", "pdb:2DSX", "molecule"],
  ["DNA and RNA", "b-dna", "B-DNA, 0.74 Å", "pdb:1D8G", "molecule"],
  ["DNA and RNA", "a-dna", "A-DNA, 0.83 Å", "pdb:1DPL", "molecule"],
  ["DNA and RNA", "z-dna", "Z-DNA, 0.55 Å", "pdb:3P4J", "molecule"],
  ["DNA and RNA", "rna-quadruplex", "A four-stranded RNA, 0.61 Å", "pdb:1J8G", "molecule"],
  ["DNA and RNA", "rrna-loop", "A loop of ribosomal RNA, 0.85 Å", "pdb:5NQI", "molecule"],
  ["DNA and RNA", "dna-drug", "DNA with a drug in its groove, 0.95 Å", "pdb:3OMJ", "molecule"],
  [
    "DNA and RNA",
    "dna-ruthenium",
    "DNA with a light-switch metal complex, 0.92 Å",
    "pdb:4E1U",
    "molecule",
  ],
];

async function get(url, ok, binary = false) {
  for (let i = 0; i < 6; i++) {
    try {
      const r = await fetch(url);
      if (r.ok) {
        const body = binary ? new Uint8Array(await r.arrayBuffer()) : await r.text();
        if (ok(body)) return body;
      }
    } catch {
      // retried below
    }
    await new Promise((res) => setTimeout(res, 3000 * (i + 1)));
  }
  throw new Error(`Could not fetch ${url}`);
}

// A PDB file trimmed to what the toy reads: the header lines it names, the
// first model's atoms (no waters, no alternate locations but A) and their
// ANISOU records.
const WATER = /^(HOH|WAT|DOD)$/;
function trimPdb(text) {
  const keep = [];
  let skipSerial = false;
  for (const line of text.split(/\r?\n/)) {
    const rec = line.slice(0, 6);
    if (rec === "ENDMDL") break;
    if (["HEADER", "TITLE ", "CRYST1"].includes(rec)) keep.push(line);
    else if (rec === "ATOM  " || rec === "HETATM") {
      const alt = line[16];
      skipSerial = WATER.test(line.slice(17, 20).trim()) || (alt !== " " && alt !== "A");
      if (!skipSerial) keep.push(line);
    } else if (rec === "ANISOU") {
      if (!skipSerial) keep.push(line);
    } else if (rec === "TER   ") keep.push(line);
  }
  keep.push("END");
  return keep.join("\n") + "\n";
}

// CIF's TeX-like accents ("Lef\\`evre") as letters.
const ACCENT = {
  "`": "\u0300",
  "'": "\u0301",
  "^": "\u0302",
  '"': "\u0308",
  "~": "\u0303",
  c: "\u0327",
};
const untex = (s) =>
  String(s).replace(/\\([`'^"~c])\{?([A-Za-z])\}?/g, (_m, a, l) =>
    (l + ACCENT[a]).normalize("NFC"),
  );

// A PDB entry whose biological assembly needs symmetry copies (a DNA duplex
// whose second strand is the first one's mate): the copies under the
// assembly's operators (RCSB's data API), each atom moved by x' = M·x + v
// and its ANISOU turned by U' = M·U·Mᵀ, in new chains.
async function assemble(id, text) {
  const d = JSON.parse(await get(`https://data.rcsb.org/rest/v1/core/assembly/${id}/1`, (t) => t.startsWith("{"))); // prettier-ignore
  const ops = d.pdbx_struct_oper_list.filter((o) => o.type !== "identity operation");
  if (!ops.length) return { text, ops: [] };
  const lines = text.split("\n").filter((l) => l && l !== "END");
  const atomLines = lines.filter((l) => /^(ATOM  |HETATM|ANISOU|TER   )/.test(l));
  const used = new Set(atomLines.map((l) => l[21]));
  const free = "BCDEFGHIJKLMNOPQRSTUVWXYZ".split("").filter((c) => !used.has(c));
  const out = lines.slice();
  ops.forEach((o, n) => {
    const M = [1, 2, 3].map((i) => [1, 2, 3].map((j) => o[`matrix_${i}_${j}`]));
    const v = [o.vector_1, o.vector_2, o.vector_3];
    const chain = free[n];
    const serialOff = 10000 * (n + 1);
    for (const l of atomLines) {
      let line = l.slice(0, 21) + chain + l.slice(22);
      if (l.startsWith("TER")) {
        out.push(line);
        continue;
      }
      const serial = (parseInt(l.slice(6, 11), 10) + serialOff) % 100000;
      line = line.slice(0, 6) + String(serial).padStart(5) + line.slice(11);
      if (l.startsWith("ANISOU")) {
        const u = [28, 35, 42, 49, 56, 63].map((c) => Number(l.slice(c, c + 7)));
        const U = [
          [u[0], u[3], u[4]],
          [u[3], u[1], u[5]],
          [u[4], u[5], u[2]],
        ];
        const MU = M.map((r) => [0, 1, 2].map((j) => r[0] * U[0][j] + r[1] * U[1][j] + r[2] * U[2][j])); // prettier-ignore
        const R = MU.map((r) => [0, 1, 2].map((j) => r[0] * M[j][0] + r[1] * M[j][1] + r[2] * M[j][2])); // prettier-ignore
        const six = [R[0][0], R[1][1], R[2][2], R[0][1], R[0][2], R[1][2]];
        line = line.slice(0, 28) + six.map((x) => String(Math.round(x)).padStart(7)).join("") + line.slice(70); // prettier-ignore
      } else {
        const p = [30, 38, 46].map((c) => Number(l.slice(c, c + 8)));
        const q = M.map((r, i) => r[0] * p[0] + r[1] * p[1] + r[2] * p[2] + v[i]);
        line = line.slice(0, 30) + q.map((x) => x.toFixed(3).padStart(8)).join("") + line.slice(54);
      }
      out.push(line);
    }
  });
  out.push("END");
  return { text: out.join("\n") + "\n", ops: ops.map((o) => o.symmetry_operation) };
}

// A CIF without the refinement's embedded files (the reflections, the
// SHELX .res and .hkl, the .fcf) and reflection loops, which the toy doesn't
// read (sucrose's CIF is 2.5 MB with them, 10 kB without).
const BIG_TEXT =
  /^_(shelx_(hkl|res|fab)_file|iucr_refine_(instructions|fcf)_details|shelx_hkl_checksum|shelx_res_checksum|shelx_fab_checksum)\b/i;
function trimCif(text) {
  const lines = text.split(/\r?\n/);
  const out = [];
  for (let i = 0; i < lines.length; i++) {
    const l = lines[i];
    if (BIG_TEXT.test(l)) {
      // The tag, then its value: on the line, or a ;-delimited text field.
      if (lines[i + 1]?.startsWith(";")) {
        i += 2;
        while (i < lines.length && !lines[i].startsWith(";")) i++;
      }
      continue;
    }
    if (/^loop_\s*$/.test(l) && /^\s*_refln_/i.test(lines[i + 1] ?? "")) {
      i++;
      while (i < lines.length && /^\s*_refln_/i.test(lines[i])) i++;
      while (i < lines.length && !/^\s*(_|loop_|data_|#)/.test(lines[i])) i++;
      i--;
      continue;
    }
    out.push(l);
  }
  return out.join("\n");
}

// "Smith, John" (or "John Smith") -> "J. Smith".
function shortName(n) {
  n = untex(n);
  let [last, first = ""] = n.split(",").map((s) => s.trim());
  if (!n.includes(",")) {
    const w = n.trim().split(/\s+/);
    last = w.pop();
    first = w.join(" ");
  }
  const ini = first
    .split(/[\s-]+/)
    .filter(Boolean)
    .map((p) => `${p[0]}.`)
    .join(" ");
  return ini ? `${ini} ${last}` : last;
}
function authorsText(names) {
  const s = names.map(shortName);
  if (s.length > 4) return `${s.slice(0, 3).join(", ")} et al.`;
  if (s.length > 1) return `${s.slice(0, -1).join(", ")} and ${s[s.length - 1]}`;
  return s[0] ?? "";
}

function citeCif(text) {
  const blk = readCifBlocks(text)[0];
  const t = blk.table("_publ_author_name");
  const names = [];
  for (let r = 0; t && r < t.count; r++) names.push(t.get(r, "_publ_author_name"));
  const journal = blk.item("_journal_name_full").replace(/\s*\([^)]*\)/g, "");
  const vol = blk.item("_journal_volume");
  const page = blk.item("_journal_page_first");
  const year = blk.item("_journal_year");
  return { names, ref: [journal, vol, page].filter(Boolean).join(" ") + (year ? `, ${year}` : "") };
}

async function citePdb(id) {
  const d = JSON.parse(await get(`https://data.rcsb.org/rest/v1/core/entry/${id}`, (t) => t.startsWith("{"))); // prettier-ignore
  const c = d.rcsb_primary_citation ?? {};
  const names = c.rcsb_authors ?? [];
  const deposited = d.rcsb_accession_info?.deposit_date?.slice(0, 4);
  const ref = /to be published/i.test(c.journal_abbrev ?? "")
    ? `deposited ${deposited}`
    : [c.journal_abbrev, c.journal_volume, c.page_first].filter(Boolean).join(" ") +
      (c.year ? `, ${c.year}` : "");
  return { names, ref, title: d.struct?.title ?? "" };
}

const catalog = [];
for (const [group, id, label, src, show, fileName] of LIST) {
  const [db, acc] = src.split(":");
  const file = fileName ?? `${id}-${db}-${acc.toLowerCase()}.${db === "cod" ? "cif" : "pdb"}`;
  const out = path.join(DIR, file);
  if (!fs.existsSync(out)) {
    if (check) throw new Error(`Missing ${out}`);
    const url = db === "cod" ? `https://www.crystallography.net/cod/${acc}.cif` : `https://files.rcsb.org/download/${acc}.pdb`; // prettier-ignore
    let text = await get(url, (t) => (db === "cod" ? t.includes("data_") : t.includes("ATOM")));
    if (db === "pdb") {
      // (1J8G's file already holds the four-stranded unit; its assembly stacks seven of them.)
      const a = KEEP_DEPOSIT.has(acc) ? { text: trimPdb(text), ops: [] } : await assemble(acc, trimPdb(text)); // prettier-ignore
      text = a.text;
      if (a.ops.length) console.log(`${acc}: the biological assembly, with copies under ${a.ops.join("; ")}`); // prettier-ignore
    }
    fs.writeFileSync(out, text);
    console.log(`fetched ${out} (${text.length} bytes)`);
  }
  let text = fs.readFileSync(out, "utf8");
  if (db === "cod" && !check) {
    const trimmed = trimCif(text);
    if (trimmed !== text) {
      fs.writeFileSync(out, trimmed);
      console.log(`trimmed ${out}: ${text.length} -> ${trimmed.length} bytes`);
      text = trimmed;
    }
  }
  const s = readCrystal(text, file);
  if (!s.counts.aniso) throw new Error(`${file} has no anisotropic displacements.`);
  let cite;
  let title;
  let source;
  if (db === "cod") {
    cite = citeCif(text);
    title = `${label} (COD ${acc})`;
    source = `https://www.crystallography.net/cod/${acc}.html`;
  } else {
    cite = await citePdb(acc);
    title = `${label} (PDB ${acc})`;
    source = `https://www.rcsb.org/structure/${acc}`;
  }
  const via = db === "cod" ? "the Crystallography Open Database" : "the Protein Data Bank";
  catalog.push({
    id,
    group,
    label,
    file,
    show,
    title,
    author: `${authorsText(cite.names)} (${cite.ref}), via ${via}`,
    source,
    license: db === "cod" ? "CC0 1.0 (Crystallography Open Database)" : "CC0 1.0 (wwPDB data policy)", // prettier-ignore
    licenseUrl: "https://creativecommons.org/publicdomain/zero/1.0/",
    atoms: s.counts.atoms,
    aniso: s.counts.aniso,
    temperature: Number.isFinite(s.temperature) ? s.temperature : undefined,
  });
  console.log(`${id}: ${s.counts.atoms} atoms, ${s.counts.aniso} anisotropic; ${cite.names.length} authors`); // prettier-ignore
}

const js = `// Generated by tools/sci3-structures.mjs (lane Science r3); don't edit by hand.
// The Thermal ellipsoids toy's structures: each from the Crystallography Open
// Database or the Protein Data Bank (both CC0), with real anisotropic U.

export const STRUCTURES = ${JSON.stringify(catalog, null, 2)};
`;
if (check) {
  if (fs.readFileSync(OUT, "utf8") !== js) throw new Error(`${OUT} is out of date.`);
  console.log("ok");
} else {
  fs.writeFileSync(OUT, js);
  console.log(`wrote ${OUT}: ${catalog.length} structures`);
}
