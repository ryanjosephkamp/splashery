#!/usr/bin/env node
// Builds src/chem/gallery.js, the molecule toy's gallery (lane Chemistry):
// each molecule's 3D conformer from PubChem (NCBI; public domain), read as
// an SDF file and packed as the toy packs a molecule of your own. Each one's
// formula is checked against the built-in table in src/chem/molfile.js.
//
//   node tools/chs-molecules.mjs

import fs from "node:fs";
import path from "node:path";
import { readMoleculeFile, MOLECULES } from "../src/chem/molfile.js";
import { formulaOf } from "../src/chem/elements.js";

const root = path.resolve(path.dirname(new URL(import.meta.url).pathname), "..");
const cache = path.join(root, ".cache/chs-data/pubchem");
fs.mkdirSync(cache, { recursive: true });

// [toy id, label, PubChem CID, the built-in table's name]
export const GALLERY = [
  ["glucose", "Glucose", 5793, "glucose"],
  ["sucrose", "Sucrose (table sugar)", 5988, "sucrose"],
  ["aspirin", "Aspirin", 2244, "aspirin"],
  ["paracetamol", "Paracetamol", 1983, "paracetamol"],
  ["ibuprofen", "Ibuprofen", 3672, "ibuprofen"],
  ["penicillin", "Penicillin G", 5904, "penicillin G"],
  ["vitamin-c", "Vitamin C", 54670067, "ascorbic acid"],
  ["dopamine", "Dopamine", 681, "dopamine"],
  ["serotonin", "Serotonin", 5202, "serotonin"],
  ["adrenaline", "Adrenaline", 5816, "adrenaline"],
  ["melatonin", "Melatonin", 896, "melatonin"],
  ["tryptophan", "Tryptophan", 6305, "tryptophan"],
  ["capsaicin", "Capsaicin (chili heat)", 1548943, "capsaicin"],
  ["vanillin", "Vanillin", 1183, "vanillin"],
  ["menthol", "Menthol", 1254, "menthol"],
  ["citric-acid", "Citric acid", 311, "citric acid"],
  ["cholesterol", "Cholesterol", 5997, "cholesterol"],
  ["testosterone", "Testosterone", 6013, "testosterone"],
  ["atp", "ATP", 5957, "ATP"],
];

async function sdf(cid) {
  const at = path.join(cache, `${cid}.sdf`);
  if (fs.existsSync(at)) return fs.readFileSync(at, "utf8");
  const url = `https://pubchem.ncbi.nlm.nih.gov/rest/pug/compound/cid/${cid}/SDF?record_type=3d`;
  const r = await fetch(url);
  if (!r.ok) throw new Error(`${r.status} ${url}`);
  const text = await r.text();
  fs.writeFileSync(at, text);
  await new Promise((ok) => setTimeout(ok, 300));
  return text;
}

const round = (x) => Math.round(x * 100) / 100;
const lines = [];
for (const [id, label, cid, name] of GALLERY) {
  const mol = readMoleculeFile(await sdf(cid), `${cid}.sdf`);
  const want = MOLECULES.find((m) => m.name === name)?.formula;
  const got = formulaOf(mol.atoms);
  if (got !== want) throw new Error(`${id}: ${got}, the table says ${want}`);
  const atoms = mol.atoms.map((a) => `${a.el} ${round(a.p[0])} ${round(a.p[1])} ${round(a.p[2])}`).join(","); // prettier-ignore
  const bonds = mol.bonds.map(([i, j, o = 1]) => `${i} ${j} ${o}`).join(",");
  lines.push(`  ${JSON.stringify(id)}: { label: ${JSON.stringify(label)}, cid: ${cid}, formula: ${JSON.stringify(got)}, packed: ${JSON.stringify(`M1;${label};${atoms};${bonds}`)} },`); // prettier-ignore
  console.log(id, got, mol.atoms.length);
}
const out = `// The molecule toy's gallery (lane Chemistry), written by
// tools/chs-molecules.mjs; don't edit it by hand. Each molecule is PubChem's
// 3D conformer of the compound (the CID), packed as "M1;name;atoms;bonds"
// with atoms as "El x y z" in ångströms.

// prettier-ignore
export const GALLERY = {
${lines.join("\n")}
};
`;
fs.writeFileSync(path.join(root, "src/chem/gallery.js"), out);
console.log("wrote src/chem/gallery.js");
