#!/usr/bin/env node
// Builds src/tiny/genes.js for the "DNA to protein" toy (lane Tiny world r2):
// four real genes from NCBI (public domain) and the alpha-carbon trace of
// each protein's structure from the Protein Data Bank (CC0).
//
//   node tools/tw2-genes.mjs [--cache=.cache/tw2]
//
// For each gene it reads the RefSeq (or GenBank) record, takes the coding
// sequence (CDS) with a few bases on each side, checks that the standard
// genetic code turns the CDS into the record's own protein translation, and
// reads the PDB entry's alpha carbons, matching each chain to its place in
// that protein. It stops with an error if anything disagrees.

import fs from "node:fs";
import path from "node:path";
import { translate } from "../src/tiny/genetic-code.js";

const args = process.argv.slice(2);
const opt = (name, def) => {
  const a = args.find((x) => x.startsWith(`--${name}=`));
  return a ? a.slice(name.length + 3) : def;
};
const cache = opt("cache", ".cache/tw2");
fs.mkdirSync(cache, { recursive: true });

// The genes. `chains` are the PDB chains that hold this protein.
const GENES = [
  {
    id: "hbb",
    label: "Hemoglobin beta (HBB)",
    protein: "hemoglobin subunit beta",
    organism: "human",
    accession: "NM_000518.5",
    pdb: "4HHB",
    chains: ["B"],
    pdbNote: "deoxyhemoglobin, one of its two beta chains",
    // The first methionine is cut off (the next amino acid, valine, is small).
    removed: [[1, 1]],
  },
  {
    id: "ins",
    label: "Insulin (INS)",
    protein: "preproinsulin",
    organism: "human",
    accession: "NM_000207.3",
    pdb: "1MSO",
    chains: ["A", "B"],
    pdbNote: "insulin's A and B chains",
    // The record's sig_peptide (1-24) and mat_peptides: B chain 25-54,
    // C-peptide 57-87, A chain 90-110; the pairs of basic residues between
    // them (55-56, 88-89) are cut away with the C-peptide.
    removed: [
      [1, 24],
      [55, 89],
    ],
  },
  {
    id: "lyz",
    label: "Lysozyme (LYZ)",
    protein: "lysozyme C",
    organism: "human",
    accession: "NM_000239.3",
    pdb: "1LZ1",
    chains: ["A"],
    pdbNote: "the mature enzyme",
    // The record's sig_peptide: codons 1-18.
    removed: [[1, 18]],
  },
  {
    id: "gfp",
    label: "Green fluorescent protein (GFP)",
    protein: "green fluorescent protein",
    organism: "jellyfish (Aequorea victoria)",
    accession: "M62653.1",
    pdb: "1GFL",
    chains: ["A"],
    pdbNote: "one of the two molecules in the crystal",
    // The first methionine is cut off (the next amino acid, serine, is small).
    removed: [[1, 1]],
    // The crystallized clone differs from this record at residue 80 (Gln to
    // Arg, a harmless change in the widely used cDNA clone), and its residue
    // 1 is not the gene's methionine, so that one is left out.
    byNumber: true,
    allow: { 80: "R" },
    skip: [1],
  },
];

const LEAD = 5; // bases shown before the start codon

async function cached(name, url) {
  const file = path.join(cache, name);
  if (!fs.existsSync(file)) {
    const res = await fetch(url);
    if (!res.ok) throw new Error(`${url}: ${res.status}`);
    fs.writeFileSync(file, await res.text());
    await new Promise((r) => setTimeout(r, 400)); // NCBI asks for at most 3 requests a second
  }
  return fs.readFileSync(file, "utf8");
}

function readGenBank(text) {
  const origin = text.slice(text.indexOf("\nORIGIN") + 7);
  const seq = origin.replace(/[^acgtn]/gi, "").toUpperCase();
  const cds = text.match(/^ {5}CDS {13}(<?\d+)\.\.(>?\d+)/m);
  if (!cds) throw new Error("no simple CDS");
  const from = Number(cds[1]);
  const to = Number(cds[2]);
  const block = text.slice(cds.index).split(/\n {5}\S/)[0];
  const tr = block.match(/\/translation="([^"]+)"/);
  return { seq, from, to, translation: tr[1].replace(/\s+/g, "") };
}

const THREE = {
  ALA: "A", ARG: "R", ASN: "N", ASP: "D", CYS: "C", GLN: "Q", GLU: "E", GLY: "G", HIS: "H", ILE: "I",
  LEU: "L", LYS: "K", MET: "M", PHE: "F", PRO: "P", SER: "S", THR: "T", TRP: "W", TYR: "Y", VAL: "V",
}; // prettier-ignore

// Alpha carbons of the first model, by chain, in order.
function readCa(text) {
  const chains = {};
  for (const line of text.split("\n")) {
    if (line.startsWith("ENDMDL")) break;
    if (!line.startsWith("ATOM") || line.slice(12, 16).trim() !== "CA") continue;
    const alt = line[16];
    if (alt !== " " && alt !== "A") continue;
    const ch = line[21];
    const res = THREE[line.slice(17, 20).trim()] || "X";
    const num = Number(line.slice(22, 26));
    const p = [30, 38, 46].map((s) => Number(line.slice(s, s + 8)));
    (chains[ch] ||= []).push({ res, num, p });
  }
  return chains;
}

const out = [];
for (const g of GENES) {
  const gb = readGenBank(
    await cached(
      `${g.accession}.gb`,
      `https://eutils.ncbi.nlm.nih.gov/entrez/eutils/efetch.fcgi?db=nuccore&id=${g.accession}&rettype=gb&retmode=text`,
    ),
  );
  const cds = gb.seq.slice(gb.from - 1, gb.to);
  const protein = translate(cds);
  if (protein.stop !== cds.length / 3 - 1) throw new Error(`${g.id}: the CDS does not end on its only stop codon`); // prettier-ignore
  if (protein.seq !== gb.translation) throw new Error(`${g.id}: our translation differs from the record's`); // prettier-ignore
  const lead = gb.seq.slice(gb.from - 1 - LEAD, gb.from - 1);
  // The whole 3′ untranslated region: a frameshift can read on into it.
  const utr3 = gb.seq.slice(gb.to);

  const pdb = readCa(await cached(`${g.pdb}.pdb`, `https://files.rcsb.org/download/${g.pdb}.pdb`));
  // Each chain in runs of consecutive residue numbers, each run found in the protein.
  const ca = new Array(protein.seq.length).fill(null);
  const pieces = [];
  for (const ch of g.chains) {
    const list = pdb[ch];
    if (!list) throw new Error(`${g.id}: no chain ${ch} in ${g.pdb}`);
    const runs = [];
    for (const r of list) {
      const last = runs.at(-1);
      if (last && r.num === last.at(-1).num + 1) last.push(r);
      else runs.push([r]);
    }
    if (g.byNumber) {
      // Matched by residue number, with the listed differences allowed.
      const kept = list.filter((r) => !g.skip?.includes(r.num));
      for (const r of kept) {
        const want = g.allow?.[r.num] ?? protein.seq[r.num - 1];
        if (r.res !== want) throw new Error(`${g.id}: residue ${r.num} is ${r.res} in ${g.pdb}, ${protein.seq[r.num - 1]} in the record`); // prettier-ignore
        ca[r.num - 1] = r.p.map((v) => Math.round(v * 10) / 10);
      }
      pieces.push({ chain: ch, from: kept[0].num, to: kept.at(-1).num });
      continue;
    }
    for (const run of runs) {
      const s = run.map((r) => r.res).join("");
      const at = protein.seq.indexOf(s);
      if (at < 0 || protein.seq.indexOf(s, at + 1) >= 0) throw new Error(`${g.id}: chain ${ch} ${s.slice(0, 12)}… not found once in the protein`); // prettier-ignore
      run.forEach((r, i) => (ca[at + i] = r.p.map((v) => Math.round(v * 10) / 10)));
      pieces.push({ chain: ch, from: at + 1, to: at + run.length });
    }
  }
  out.push({ ...g, lead, cds, utr3, protein: protein.seq, pieces, ca, record: g.protein });
  console.log(`${g.id}: ${cds.length} bases, ${protein.seq.length} amino acids, ${pieces.map((p) => `${p.chain} ${p.from}-${p.to}`).join(", ")} in ${g.pdb}`); // prettier-ignore
}

const lines = [
  "// Four real genes for the DNA to protein toy (lane Tiny world r2), written by",
  "// tools/tw2-genes.mjs from NCBI records (public domain) and Protein Data Bank",
  "// entries (CC0). Do not edit by hand.",
  "//",
  "// lead: the bases before the start codon; cds: the coding sequence, start to",
  "// stop codon; utr3: the bases after it; protein: the record's translation;",
  "// removed: the stretches the cell cuts away after translation (1-based);",
  "// pieces: the stretches of the protein in the structure (1-based); ca: each",
  "// amino acid's alpha carbon in ångströms (null where the structure has none).",
  "",
  "export const GENES = {",
];
for (const g of out) {
  lines.push(`  ${g.id}: {`);
  for (const k of ["label", "record", "organism", "accession", "pdb", "pdbNote", "lead", "cds", "utr3", "protein", "removed", "allow"]) // prettier-ignore
    if (g[k] !== undefined) lines.push(`    ${k}: ${JSON.stringify(g[k])},`);
  lines.push(`    pieces: ${JSON.stringify(g.pieces)},`);
  lines.push(`    ca: ${JSON.stringify(g.ca)},`);
  lines.push("  },");
}
lines.push("};", "");
fs.writeFileSync("src/tiny/genes.js", lines.join("\n"));
console.log("wrote src/tiny/genes.js");
