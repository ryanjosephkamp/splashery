// Molecule files and typed-in molecules, all turned into the molecule toy's
// format:
//
//   { atoms: [{ el: "C", p: [x, y, z], charge? }], bonds: [[i, j, order]], name? }
//
// Positions are in ångströms and centred on the origin; bond orders are 1, 2
// or 3 (aromatic rings kekulized).
//
//   readMoleculeFile(text, fileName)  MOL/SDF (V2000 and V3000), XYZ or PDB
//   moleculeFromText(text)            a name ("caffeine"), a formula ("H2O"),
//                                     a SMILES string ("CCO") or file text
//   MOLECULES, findMolecule(text)     the built-in table of well-known molecules
//   toMolfile(mol), toXyz(mol)        write the format back out
//
// Flat 2D drawings (as PubChem's default SDF) are rebuilt in 3D with the
// embedder, with the hydrogens the drawing leaves out. XYZ files and PDB
// files without CONECT records get their bonds from atom distances. Errors
// are thrown with short messages meant for the person who gave the input.

import { element, normalSymbol, covalentRadius, parseFormula } from "./elements.js";
import { finishGraph, withHydrogens, valencesFor, maxMatching, adjacency } from "./smiles.js";
import { embed3D, toMolecule, centreMolecule, moleculeFromSmiles } from "./embed.js";

export const MAX_FILE_ATOMS = 2000;

// Elements whose missing hydrogens are worked out from the normal valence.
const IMPLICIT_H = new Set(["B", "C", "N", "O", "P", "S", "F", "Cl", "Br", "I"]);

const fail = (message) => {
  throw new Error(message);
};

// An atom in the toy's format, with its charge only when it has one.
const plainAtom = ({ el, p, charge }) => (charge ? { el, p, charge } : { el, p });

const tooBig = (n) =>
  fail(
    `That file has ${n.toLocaleString("en")} atoms; the molecule toy takes up to ` +
      `${MAX_FILE_ATOMS.toLocaleString("en")}. Big structures belong in the protein toy.`,
  );

// ---- Bonds from distances ---------------------------------------------------

const distance = (a, b) => Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]);

// Bonds between atoms closer than the sum of their covalent radii plus a
// tolerance. A hydrogen keeps only its nearest partner.
export function perceiveBonds(atoms, { tolerance = 0.45 } = {}) {
  const n = atoms.length;
  const radius = atoms.map((a) => covalentRadius(a.el));
  const cell = 2 * Math.max(0.5, ...radius) + tolerance;
  const grid = new Map();
  const keyOf = (x, y, z) => `${x},${y},${z}`;
  atoms.forEach((a, i) => {
    const k = keyOf(...a.p.map((v) => Math.floor(v / cell)));
    if (!grid.has(k)) grid.set(k, []);
    grid.get(k).push(i);
  });
  const found = [];
  atoms.forEach((a, i) => {
    const [cx, cy, cz] = a.p.map((v) => Math.floor(v / cell));
    for (let dx = -1; dx <= 1; dx++)
      for (let dy = -1; dy <= 1; dy++)
        for (let dz = -1; dz <= 1; dz++) {
          for (const j of grid.get(keyOf(cx + dx, cy + dy, cz + dz)) ?? []) {
            if (j <= i) continue;
            const d = distance(a.p, atoms[j].p);
            if (d > 0.4 && d < radius[i] + radius[j] + tolerance) found.push([i, j, d]);
          }
        }
  });
  // Each hydrogen keeps its closest bond only.
  const nearestH = new Map();
  for (const bond of found)
    for (const h of [bond[0], bond[1]])
      if (atoms[h].el === "H" && !(nearestH.get(h)?.[2] <= bond[2])) nearestH.set(h, bond);
  return found
    .filter((b) => [b[0], b[1]].every((h) => atoms[h].el !== "H" || nearestH.get(h) === b))
    .map(([i, j]) => [i, j, 1]);
}

// Guesses double and triple bonds from free valences and bond lengths:
// only bonds clearly shorter than a single bond can be multiple. Changes the
// bond orders in place and returns the bonds.
export function guessBondOrders(atoms, bonds) {
  const n = atoms.length;
  const adj = adjacency(n, bonds);
  const dist = ([i, j]) => distance(atoms[i].p, atoms[j].p);
  const single = ([i, j]) => covalentRadius(atoms[i].el) + covalentRadius(atoms[j].el);
  const deficit = atoms.map((a, i) => {
    if (a.el === "H" || (!IMPLICIT_H.has(a.el) && !["Si", "Se", "As"].includes(a.el))) return 0;
    const degree = adj[i].length;
    const vals = valencesFor(a.el, a.charge ?? 0);
    let v = vals.find((x) => x >= degree);
    if (v === undefined) return 0;
    if (a.el === "S" || a.el === "P") {
      // S and P reach higher valences only through terminal O, S or N.
      const terminal = adj[i].filter(
        (e) => ["O", "S", "N"].includes(atoms[e.to].el) && adj[e.to].length === 1,
      ).length;
      v = Math.max(v, Math.min(Math.max(...vals), degree + terminal));
    }
    return v - degree;
  });
  const ratio = bonds.map((b) => dist(b) / single(b));
  // Triple bonds: both ends short of two bonds, and the bond very short.
  bonds.forEach((b, k) => {
    if (deficit[b[0]] >= 2 && deficit[b[1]] >= 2 && ratio[k] < 0.84) {
      b[2] = 3;
      deficit[b[0]] -= 2;
      deficit[b[1]] -= 2;
    }
  });
  const open = (k) => {
    const [i, j, o] = bonds[k];
    return o < 3 && deficit[i] > 0 && deficit[j] > 0 && ratio[k] < 0.965;
  };
  const raise = (k) => {
    bonds[k][2]++;
    deficit[bonds[k][0]]--;
    deficit[bonds[k][1]]--;
  };
  // Atoms with just one place for their extra bond take it first (C=O,
  // O=C=O), then a matching shares out the rest (alternating rings).
  for (let changed = true; changed; ) {
    changed = false;
    for (let i = 0; i < n; i++) {
      if (!deficit[i]) continue;
      const options = adj[i].filter((e) => open(e.bond));
      if (options.length === 1) {
        raise(options[0].bond);
        changed = true;
      }
    }
  }
  const graph = Array.from({ length: n }, () => []);
  bonds.forEach(([i, j], k) => {
    if (!open(k)) return;
    graph[i].push(j);
    graph[j].push(i);
  });
  const match = maxMatching(graph);
  bonds.forEach(([i, j], k) => {
    if (match[i] === j && open(k)) raise(k);
  });
  return bonds;
}

// ---- MOL and SDF ------------------------------------------------------------------

const MOL_CHARGE = { 1: 3, 2: 2, 3: 1, 5: -1, 6: -2, 7: -3 };
// MOL bond types: 1–3 as they are, 4 aromatic (1.5 until kekulized), query types as single.
const molOrder = (type) => (type === 4 ? 1.5 : type >= 1 && type <= 3 ? type : 1);

function molSymbol(text, where) {
  const t = text.trim();
  if (t === "D" || t === "T") return "H";
  const el = normalSymbol(t);
  if (!element(el)) {
    if (["R", "R#", "*", "A", "Q", "L", "X"].includes(t))
      fail("The file has query or R-group atoms. Save the molecule itself, without them.");
    fail(`Unknown element "${t}" in ${where}.`);
  }
  return el;
}

function readV2000(lines, start) {
  const counts = lines[start + 3] ?? "";
  const nAtoms = parseInt(counts.slice(0, 3), 10);
  const nBonds = parseInt(counts.slice(3, 6), 10);
  if (!(nAtoms >= 0) || !(nBonds >= 0)) fail("Could not read the MOL counts line.");
  if (nAtoms > MAX_FILE_ATOMS) tooBig(nAtoms);
  const atoms = [];
  for (let i = 0; i < nAtoms; i++) {
    const line = lines[start + 4 + i] ?? "";
    let x = parseFloat(line.slice(0, 10));
    let y = parseFloat(line.slice(10, 20));
    let z = parseFloat(line.slice(20, 30));
    let sym = line.slice(31, 34);
    let code = parseInt(line.slice(36, 39), 10) || 0;
    if (![x, y, z].every(Number.isFinite) || !sym.trim()) {
      // Loosely spaced file: fall back to splitting on whitespace.
      const t = line.trim().split(/\s+/);
      [x, y, z] = t.slice(0, 3).map(Number);
      sym = t[3] ?? "";
      code = parseInt(t[5], 10) || 0;
      if (![x, y, z].every(Number.isFinite)) fail(`Could not read atom ${i + 1} of the MOL file.`);
    }
    atoms.push({
      el: molSymbol(sym, `atom ${i + 1}`),
      p: [x, y, z],
      charge: MOL_CHARGE[code] ?? 0,
    });
  }
  const bonds = [];
  for (let k = 0; k < nBonds; k++) {
    const line = lines[start + 4 + nAtoms + k] ?? "";
    let a = parseInt(line.slice(0, 3), 10);
    let b = parseInt(line.slice(3, 6), 10);
    let type = parseInt(line.slice(6, 9), 10);
    if (![a, b, type].every(Number.isFinite)) [a, b, type] = line.trim().split(/\s+/).map(Number);
    if (!(a >= 1 && a <= nAtoms && b >= 1 && b <= nAtoms))
      fail(`Bond ${k + 1} of the MOL file points at a missing atom.`);
    bonds.push([a - 1, b - 1, molOrder(type)]);
  }
  // Properties block: "M  CHG" replaces the charges from the atom lines.
  let charged = false;
  for (let i = start + 4 + nAtoms + nBonds; i < lines.length; i++) {
    const line = lines[i];
    if (line.startsWith("M  END") || line.startsWith("$$$$")) break;
    if (!line.startsWith("M  CHG")) continue;
    if (!charged) for (const atom of atoms) atom.charge = 0;
    charged = true;
    const t = line.slice(6).trim().split(/\s+/).map(Number);
    for (let k = 1; k + 1 < t.length; k += 2)
      if (atoms[t[k] - 1]) atoms[t[k] - 1].charge = t[k + 1];
  }
  return { atoms, bonds };
}

function readV3000(lines, start) {
  // Join continuation lines (ending in "-") and keep the "M  V30" bodies.
  const body = [];
  for (let i = start + 4; i < lines.length; i++) {
    const line = lines[i];
    if (line.startsWith("M  END") || line.startsWith("$$$$")) break;
    if (!line.startsWith("M  V30 ")) continue;
    const text = line.slice(7);
    if (body.length && body[body.length - 1].endsWith("-"))
      body[body.length - 1] = body[body.length - 1].slice(0, -1) + text;
    else body.push(text);
  }
  const atoms = [];
  const bonds = [];
  const ids = new Map();
  let block = "";
  for (const line of body) {
    const t = line.trim().split(/\s+/);
    if (t[0] === "BEGIN" || t[0] === "END") {
      block = t[0] === "BEGIN" ? t[1] : "";
      continue;
    }
    if (block === "ATOM") {
      const [id, sym, x, y, z] = t;
      const chg = t.find((s) => s.startsWith("CHG="));
      ids.set(id, atoms.length);
      atoms.push({
        el: molSymbol(sym, `atom ${id}`),
        p: [x, y, z].map(Number),
        charge: chg ? Number(chg.slice(4)) : 0,
      });
      if (atoms.length > MAX_FILE_ATOMS) tooBig(`over ${MAX_FILE_ATOMS}`);
    } else if (block === "BOND") {
      const [, type, a, b] = t;
      if (!ids.has(a) || !ids.has(b)) fail("A bond in the MOL file points at a missing atom.");
      bonds.push([ids.get(a), ids.get(b), molOrder(Number(type))]);
    }
  }
  if (atoms.some((a) => !a.p.every(Number.isFinite))) fail("Could not read the MOL atom block.");
  return { atoms, bonds };
}

// Reads the first record of a MOL or SDF file. Returns the raw atoms and
// bonds (order 1.5 marks aromatic bonds), the title and whether it is a flat
// 2D drawing.
export function parseMolfile(text) {
  const lines = String(text).split(/\r?\n/);
  // The counts line is the fourth line of the record (the title may be blank).
  const tagged = lines.findIndex((l, i) => i >= 3 && / V[23]000\s*$/.test(l));
  const start = tagged >= 3 ? tagged - 3 : 0;
  const counts = lines[start + 3] ?? "";
  const v3000 = counts.includes("V3000");
  if (!v3000 && !/^[\s\d]{6}/.test(counts)) fail("This does not look like a MOL or SDF file.");
  const { atoms, bonds } = v3000 ? readV3000(lines, start) : readV2000(lines, start);
  if (!atoms.length) fail("The MOL file has no atoms.");
  const dim = (lines[start + 1] ?? "").slice(20, 22).toUpperCase();
  const flat = atoms.every((a) => Math.abs(a.p[2]) < 1e-4);
  return {
    // PubChem puts the compound number on the title line.
    name: lines[start]
      .trim()
      .replace(/^(\d+)$/, (cid) => (/PUBCHEM_/.test(text) ? `PubChem CID ${cid}` : cid)),
    atoms,
    bonds,
    is2D: dim === "2D" || (dim !== "3D" && flat),
  };
}

// Turns parsed atoms and bonds into the toy's format. Aromatic bonds are
// kekulized; flat drawings get hydrogens and 3D coordinates.
function finishFile({ atoms, bonds, name, is2D }, { seed = 1 } = {}) {
  const aromatic = new Set(bonds.filter((b) => b[2] === 1.5).flatMap((b) => b.slice(0, 2)));
  let result = { atoms: atoms.map(plainAtom), bonds };
  if (is2D || aromatic.size) {
    const graph = {
      atoms: atoms.map((a, i) => ({
        el: a.el,
        charge: a.charge ?? 0,
        isotope: 0,
        aromatic: aromatic.has(i),
        h: 0,
        implicitH: IMPLICIT_H.has(a.el),
      })),
      bonds: bonds.map((b) => b.slice()),
    };
    finishGraph(graph, { strict: false });
    if (is2D) {
      // A drawing: add the hydrogens it leaves out and build real 3D shape.
      const full = withHydrogens(graph);
      result = toMolecule(full, embed3D(full, { seed }));
    } else result.bonds = graph.bonds;
  }
  result.bonds = result.bonds.map(([i, j, o]) => [i, j, Math.min(3, Math.max(1, Math.round(o)))]);
  centreMolecule(result);
  if (name) result.name = name;
  return result;
}

// ---- XYZ ----------------------------------------------------------------------------

// Reads an XYZ file (first frame). Bonds come from distances and double
// bonds are guessed where the free valences make them clear.
export function parseXyz(text) {
  const lines = String(text).split(/\r?\n/);
  let k = 0;
  while (k < lines.length && !lines[k].trim()) k++;
  const count = /^\s*\d+\s*$/.test(lines[k] ?? "") ? Number(lines[k]) : -1;
  if (count > MAX_FILE_ATOMS) tooBig(count);
  const name = count >= 0 ? (lines[k + 1] ?? "").trim() : "";
  const body = count >= 0 ? lines.slice(k + 2, k + 2 + count) : lines.slice(k);
  const atoms = [];
  body.forEach((line, i) => {
    const t = line.trim().split(/\s+/);
    if (!t[0]) return;
    const el = /^\d+$/.test(t[0])
      ? element(Number(t[0]))?.symbol
      : normalSymbol(t[0].replace(/[^A-Za-z].*$/, ""));
    const p = t.slice(1, 4).map(Number);
    if (!el || !element(el) || p.length < 3 || !p.every(Number.isFinite))
      fail(`Could not read line ${i + (count >= 0 ? k + 3 : k + 1)} of the XYZ file.`);
    atoms.push({ el, p });
  });
  if (!atoms.length) fail("The XYZ file has no atoms.");
  if (atoms.length > MAX_FILE_ATOMS) tooBig(atoms.length);
  const bonds = guessBondOrders(atoms, perceiveBonds(atoms));
  return centreMolecule({ atoms, bonds, ...(name ? { name } : {}) });
}

// ---- PDB (small molecules) -----------------------------------------------------------

// Element of a PDB ATOM/HETATM line: columns 77–78, or else from the atom
// name (two-letter elements start in column 13, one-letter ones in 14).
export function pdbElement(line) {
  const col = normalSymbol(line.slice(76, 78).trim());
  if (element(col)) return col;
  const name = line.slice(12, 16).padEnd(4);
  const one = (c) => (element(normalSymbol(c)) ? normalSymbol(c) : "");
  if (/^[\s\d]/.test(name)) return one(name[1]);
  // Four-character names starting with H (HG21, HD11) are hydrogens.
  if (name[0] === "H" && name.trim().length === 4) return "H";
  const two = normalSymbol(name.slice(0, 2));
  return two && element(two) ? two : one(name[0]);
}

// Reads one ATOM/HETATM line into plain fields.
export function readPdbAtom(line) {
  const p = [line.slice(30, 38), line.slice(38, 46), line.slice(46, 54)].map(Number);
  const charge = /^\s*(\d)([+-])/.exec(line.slice(78, 80));
  return {
    het: line.startsWith("HETATM"),
    serial: parseInt(line.slice(6, 11), 10),
    name: line.slice(12, 16).trim(),
    alt: line.slice(16, 17).trim(),
    resName: line.slice(17, 20).trim(),
    chain: line.slice(21, 22).trim(),
    seq: parseInt(line.slice(22, 26), 10),
    icode: line.slice(26, 27).trim(),
    p,
    el: pdbElement(line),
    charge: charge ? Number(charge[1]) * (charge[2] === "-" ? -1 : 1) : 0,
  };
}

const WATER = new Set(["HOH", "WAT", "DOD", "H2O", "TIP", "TIP3", "SOL"]);

// Reads a small molecule from PDB text: first model, first alternate
// location, water left out (unless there is nothing else). Bonds come from
// CONECT records (repeated entries give the order) or from distances.
export function parsePdbMolecule(text) {
  const lines = String(text).split(/\r?\n/);
  let atoms = [];
  const conect = [];
  let name = "";
  const firstAlt = new Map();
  for (const line of lines) {
    const rec = line.slice(0, 6);
    if (rec === "ENDMDL") break;
    if ((rec === "COMPND" || rec === "TITLE ") && !name && !/MOL_ID|CHAIN:/.test(line))
      name = line
        .slice(10)
        .replace(/^\s*MOLECULE:\s*/, "")
        .replace(/;\s*$/, "")
        .trim();
    if (rec === "CONECT") conect.push(line);
    if (rec !== "ATOM  " && rec !== "HETATM") continue;
    const a = readPdbAtom(line);
    if (!a.el || !a.p.every(Number.isFinite)) fail(`Could not read this PDB line: ${line.trim()}`);
    const res = `${a.chain}:${a.seq}:${a.icode}`;
    if (a.alt) {
      if (!firstAlt.has(res)) firstAlt.set(res, a.alt);
      if (firstAlt.get(res) !== a.alt) continue;
    }
    atoms.push(a);
    if (atoms.length > MAX_FILE_ATOMS * 2) break;
  }
  const dry = atoms.filter((a) => !WATER.has(a.resName));
  if (dry.length) atoms = dry;
  if (!atoms.length) fail("The PDB file has no atoms.");
  if (atoms.length > MAX_FILE_ATOMS) tooBig(atoms.length);

  // CONECT: an atom listed twice for the same partner is a double bond.
  const index = new Map(atoms.map((a, i) => [a.serial, i]));
  const counts = new Map();
  const listed = new Set();
  for (const line of conect) {
    const serials = [];
    for (let c = 6; c < line.length; c += 5) {
      const v = parseInt(line.slice(c, c + 5), 10);
      if (Number.isFinite(v)) serials.push(v);
    }
    const from = index.get(serials[0]);
    if (from === undefined) continue;
    const seen = new Map();
    for (const s of serials.slice(1)) {
      const to = index.get(s);
      if (to === undefined || to === from) continue;
      seen.set(to, (seen.get(to) ?? 0) + 1);
    }
    for (const [to, times] of seen) {
      const key = Math.min(from, to) * 1e6 + Math.max(from, to);
      counts.set(key, Math.max(counts.get(key) ?? 0, times));
      listed.add(from).add(to);
    }
  }
  const bonds = [...counts].map(([key, times]) => [
    Math.floor(key / 1e6),
    key % 1e6,
    Math.min(3, times),
  ]);
  // Atoms without any CONECT entry get bonds from distances.
  if (listed.size < atoms.length) {
    const have = new Set(bonds.map(([i, j]) => i * 1e6 + j));
    for (const [i, j] of perceiveBonds(atoms)) {
      if (listed.has(i) && listed.has(j)) continue;
      if (!have.has(i * 1e6 + j)) bonds.push([i, j, 1]);
    }
  }
  if (bonds.every((b) => b[2] === 1)) guessBondOrders(atoms, bonds);
  const mol = { atoms: atoms.map(plainAtom), bonds };
  const title = name || atoms.find((a) => a.het)?.resName || "";
  if (title) mol.name = title;
  return centreMolecule(mol);
}

// ---- Sniffing ------------------------------------------------------------------------

const extensionOf = (fileName) => (/\.([a-z0-9]+)$/i.exec(fileName ?? "")?.[1] ?? "").toLowerCase();
const FORMATS = {
  mol: "mol",
  sdf: "mol",
  sd: "mol",
  mdl: "mol",
  xyz: "xyz",
  pdb: "pdb",
  ent: "pdb",
};

// Reads a molecule file into the toy's format, choosing the reader from the
// file name or, failing that, from the text itself.
export function readMoleculeFile(text, fileName = "", { seed = 1 } = {}) {
  const src = String(text ?? "");
  if (!src.trim()) fail("That file is empty.");
  const ext = extensionOf(fileName);
  let format = FORMATS[ext];
  if (ext === "cif" || ext === "mmcif") fail("mmCIF files are for the protein toy.");
  if (!format) {
    const lines = src.split(/\r?\n/);
    if (/V[23]000/.test(src) || lines.some((l) => l.startsWith("M  END"))) format = "mol";
    else if (lines.some((l) => /^(ATOM  |HETATM)/.test(l))) format = "pdb";
    else if (/^\s*\d+\s*$/.test(lines.find((l) => l.trim()) ?? "")) format = "xyz";
    else fail("Could not tell what kind of file this is. Try a .mol, .sdf, .xyz or .pdb file.");
  }
  const base = String(fileName ?? "")
    .replace(/^.*[\\/]/, "")
    .replace(/\.[^.]*$/, "");
  let mol;
  if (format === "mol") mol = finishFile(parseMolfile(src), { seed });
  else if (format === "xyz") mol = parseXyz(src);
  else mol = parsePdbMolecule(src);
  if (!mol.name && base) mol.name = base;
  return mol;
}

// ---- Writers ------------------------------------------------------------------------------

// A V2000 MOL file for the molecule (charges in an "M  CHG" block).
export function toMolfile(mol, name = mol.name ?? "") {
  // Fixed-width columns: numbers right-aligned in 3 (or 4) characters.
  const num = (v, w = 3) => String(v).padStart(w);
  const zeros = (count) => "  0".repeat(count);
  const xyz = (p) => p.map((v) => v.toFixed(4).padStart(10)).join("");
  const lines = [name, "  Splashery          3D", ""];
  lines.push(num(mol.atoms.length) + num(mol.bonds.length) + zeros(8) + "999 V2000");
  for (const a of mol.atoms) lines.push(`${xyz(a.p)} ${a.el.padEnd(3)} 0${zeros(11)}`);
  for (const [i, j, o] of mol.bonds) lines.push(num(i + 1) + num(j + 1) + num(o) + zeros(4));
  const charged = mol.atoms.map((a, i) => [i + 1, a.charge ?? 0]).filter(([, c]) => c);
  for (let k = 0; k < charged.length; k += 8) {
    const part = charged.slice(k, k + 8);
    lines.push("M  CHG" + num(part.length) + part.map(([i, c]) => num(i, 4) + num(c, 4)).join(""));
  }
  lines.push("M  END");
  return lines.join("\n") + "\n";
}

// An XYZ file for the molecule.
export function toXyz(mol, name = mol.name ?? "") {
  const row = (a) => `${a.el.padEnd(2)} ${a.p.map((v) => v.toFixed(5).padStart(12)).join(" ")}`;
  return `${mol.atoms.length}\n${name}\n${mol.atoms.map(row).join("\n")}\n`;
}

// ---- Names and formulas --------------------------------------------------------------------

// Well-known molecules by name. `formula` is the Hill formula (checked by the
// tests); `byFormula` marks the formulas that name one molecule clearly
// enough to look up. SMILES follow PubChem, without stereo marks.
// prettier-ignore
export const MOLECULES = [
  { name: "water", formula: "H2O", smiles: "O", byFormula: true },
  { name: "carbon dioxide", formula: "CO2", smiles: "O=C=O", byFormula: true },
  { name: "carbon monoxide", formula: "CO", smiles: "[C-]#[O+]" },
  { name: "methane", formula: "CH4", smiles: "C", byFormula: true },
  { name: "ammonia", aliases: ["nh3"], formula: "H3N", smiles: "N", byFormula: true },
  { name: "oxygen", aliases: ["dioxygen"], formula: "O2", smiles: "O=O", byFormula: true },
  { name: "ozone", formula: "O3", smiles: "[O-][O+]=O", byFormula: true },
  { name: "nitrogen", aliases: ["dinitrogen"], formula: "N2", smiles: "N#N", byFormula: true },
  { name: "hydrogen", aliases: ["dihydrogen"], formula: "H2", smiles: "[H][H]", byFormula: true },
  { name: "hydrogen peroxide", formula: "H2O2", smiles: "OO", byFormula: true },
  { name: "hydrogen chloride", aliases: ["hydrochloric acid", "hcl"], formula: "ClH", smiles: "Cl", byFormula: true },
  { name: "hydrogen sulfide", aliases: ["h2s"], formula: "H2S", smiles: "S", byFormula: true },
  { name: "sulfur dioxide", aliases: ["so2"], formula: "O2S", smiles: "O=S=O", byFormula: true },
  { name: "sulfuric acid", aliases: ["h2so4"], formula: "H2O4S", smiles: "OS(=O)(=O)O", byFormula: true },
  { name: "nitrous oxide", aliases: ["laughing gas"], formula: "N2O", smiles: "[N-]=[N+]=O", byFormula: true },
  { name: "sodium chloride", aliases: ["salt", "table salt", "nacl"], formula: "ClNa", smiles: "[Na+].[Cl-]", byFormula: true },
  { name: "formaldehyde", formula: "CH2O", smiles: "C=O", byFormula: true },
  { name: "methanol", formula: "CH4O", smiles: "CO", byFormula: true },
  { name: "ethanol", aliases: ["alcohol", "ethyl alcohol"], formula: "C2H6O", smiles: "CCO" },
  { name: "glycerol", aliases: ["glycerin", "glycerine"], formula: "C3H8O3", smiles: "C(C(CO)O)O" },
  { name: "acetone", formula: "C3H6O", smiles: "CC(=O)C" },
  { name: "acetic acid", formula: "C2H4O2", smiles: "CC(=O)O" },
  { name: "lactic acid", formula: "C3H6O3", smiles: "CC(C(=O)O)O" },
  { name: "citric acid", formula: "C6H8O7", smiles: "C(C(=O)O)C(CC(=O)O)(C(=O)O)O" },
  { name: "urea", formula: "CH4N2O", smiles: "C(=O)(N)N" },
  { name: "ethylene", aliases: ["ethene"], formula: "C2H4", smiles: "C=C", byFormula: true },
  { name: "acetylene", aliases: ["ethyne"], formula: "C2H2", smiles: "C#C", byFormula: true },
  { name: "ethane", formula: "C2H6", smiles: "CC", byFormula: true },
  { name: "propane", formula: "C3H8", smiles: "CCC", byFormula: true },
  { name: "butane", formula: "C4H10", smiles: "CCCC" },
  { name: "cyclohexane", formula: "C6H12", smiles: "C1CCCCC1" },
  { name: "benzene", formula: "C6H6", smiles: "C1=CC=CC=C1", byFormula: true },
  { name: "toluene", formula: "C7H8", smiles: "CC1=CC=CC=C1" },
  { name: "phenol", formula: "C6H6O", smiles: "C1=CC=C(C=C1)O" },
  { name: "naphthalene", formula: "C10H8", smiles: "C1=CC=C2C=CC=CC2=C1" },
  { name: "glucose", aliases: ["dextrose", "d-glucose"], formula: "C6H12O6", smiles: "C(C1C(C(C(C(O1)O)O)O)O)O" },
  { name: "fructose", aliases: ["d-fructose"], formula: "C6H12O6", smiles: "C1C(C(C(C(O1)(CO)O)O)O)O" },
  { name: "sucrose", aliases: ["table sugar", "sugar"], formula: "C12H22O11", smiles: "C(C1C(C(C(C(O1)OC2(C(C(C(O2)CO)O)O)CO)O)O)O)O" },
  { name: "ascorbic acid", aliases: ["vitamin c"], formula: "C6H8O6", smiles: "C(C(C1C(=C(C(=O)O1)O)O)O)O" },
  { name: "caffeine", formula: "C8H10N4O2", smiles: "CN1C=NC2=C1C(=O)N(C(=O)N2C)C" },
  { name: "theobromine", formula: "C7H8N4O2", smiles: "CN1C=NC2=C1C(=O)NC(=O)N2C" },
  { name: "aspirin", aliases: ["acetylsalicylic acid"], formula: "C9H8O4", smiles: "CC(=O)OC1=CC=CC=C1C(=O)O" },
  { name: "paracetamol", aliases: ["acetaminophen"], formula: "C8H9NO2", smiles: "CC(=O)NC1=CC=C(C=C1)O" },
  { name: "ibuprofen", formula: "C13H18O2", smiles: "CC(C)CC1=CC=C(C=C1)C(C)C(=O)O" },
  { name: "nicotine", formula: "C10H14N2", smiles: "CN1CCCC1C2=CN=CC=C2" },
  { name: "dopamine", formula: "C8H11NO2", smiles: "C1=CC(=C(C=C1CCN)O)O" },
  { name: "serotonin", formula: "C10H12N2O", smiles: "C1=CC2=C(C=C1O)C(=CN2)CCN" },
  { name: "adrenaline", aliases: ["epinephrine"], formula: "C9H13NO3", smiles: "CNCC(C1=CC(=C(C=C1)O)O)O" },
  { name: "melatonin", formula: "C13H16N2O2", smiles: "CC(=O)NCCC1=CNC2=C1C=C(C=C2)OC" },
  { name: "histamine", formula: "C5H9N3", smiles: "C1=C(NC=N1)CCN" },
  { name: "vanillin", formula: "C8H8O3", smiles: "COC1=C(C=CC(=C1)C=O)O" },
  { name: "capsaicin", formula: "C18H27NO3", smiles: "CC(C)C=CCCCCC(=O)NCC1=CC(=C(C=C1)O)OC" },
  { name: "menthol", formula: "C10H20O", smiles: "CC1CCC(C(C1)O)C(C)C" },
  { name: "limonene", formula: "C10H16", smiles: "CC1=CCC(CC1)C(=C)C" },
  { name: "cholesterol", formula: "C27H46O", smiles: "CC(C)CCCC(C)C1CCC2C1(CCC3C2CC=C4C3(CCC(C4)O)C)C" },
  { name: "testosterone", formula: "C19H28O2", smiles: "CC12CCC3C(C1CCC2O)CCC4=CC(=O)CCC34C" },
  { name: "penicillin G", aliases: ["benzylpenicillin", "penicillin"], formula: "C16H18N2O4S", smiles: "CC1(C(N2C(S1)C(C2=O)NC(=O)CC3=CC=CC=C3)C(=O)O)C" },
  { name: "ATP", aliases: ["adenosine triphosphate"], formula: "C10H16N5O13P3", smiles: "C1=NC(=C2C(=N1)N(C=N2)C3C(C(C(O3)COP(=O)(O)OP(=O)(O)OP(=O)(O)O)O)O)N" },
  { name: "adenine", formula: "C5H5N5", smiles: "C1=NC2=NC=NC(=C2N1)N" },
  { name: "guanine", formula: "C5H5N5O", smiles: "C1=NC2=C(N1)C(=O)NC(=N2)N" },
  { name: "cytosine", formula: "C4H5N3O", smiles: "C1=C(NC(=O)N=C1)N" },
  { name: "thymine", formula: "C5H6N2O2", smiles: "CC1=CNC(=O)NC1=O" },
  { name: "uracil", formula: "C4H4N2O2", smiles: "C1=CNC(=O)NC1=O" },
  { name: "glycine", formula: "C2H5NO2", smiles: "C(C(=O)O)N" },
  { name: "alanine", formula: "C3H7NO2", smiles: "CC(C(=O)O)N" },
  { name: "tryptophan", formula: "C11H12N2O2", smiles: "C1=CC=C2C(=C1)C(=CN2)CC(C(=O)O)N" },
];

const nameKey = (text) =>
  String(text ?? "")
    .toLowerCase()
    .replace(/[\s\-_'’,.()]/g, "");

const BY_NAME = new Map();
for (const entry of MOLECULES) {
  for (const key of [entry.name, ...(entry.aliases ?? [])]) BY_NAME.set(nameKey(key), entry);
  // "h2o", "co2" and the like, typed in lower case.
  if (entry.byFormula) BY_NAME.set(nameKey(entry.formula), entry);
}

const sameCounts = (a, b) =>
  Object.keys(a).length === Object.keys(b).length && Object.keys(a).every((k) => a[k] === b[k]);

// The table entry for a name or alias (any case, spaces and hyphens
// ignored), or for a formula that clearly names one molecule. Else null.
export function findMolecule(text) {
  const s = String(text ?? "").trim();
  const byName = BY_NAME.get(nameKey(s));
  if (byName) return byName;
  const counts = parseFormula(s);
  if (!counts) return null;
  return MOLECULES.find((m) => m.byFormula && sameCounts(parseFormula(m.formula), counts)) ?? null;
}

const pasteSmiles = "Paste a SMILES string instead, e.g. from PubChem's page for the molecule.";

// A molecule from typed text: a name or formula from the table, a SMILES
// string, or the text of a molecule file.
export function moleculeFromText(text, { seed = 1 } = {}) {
  const raw = String(text ?? "")
    .trim()
    .replace(/[₀-₉]/g, (d) => String(d.charCodeAt(0) - 0x2080));
  if (!raw) fail("Type a molecule name, a formula like H2O, or a SMILES string.");
  if (raw.includes("\n")) return readMoleculeFile(raw, "", { seed });
  const named = (entry) => ({ ...moleculeFromSmiles(entry.smiles, { seed }), name: entry.name });
  const byName = BY_NAME.get(nameKey(raw));
  if (byName) return named(byName);
  if (/\s/.test(raw)) fail(`"${raw}" is not in the built-in list. ${pasteSmiles}`);
  try {
    return moleculeFromSmiles(raw, { seed });
  } catch (err) {
    const counts = parseFormula(raw);
    if (counts) {
      const entry = findMolecule(raw);
      if (entry) return named(entry);
      // A lone atom, such as Xe or Fe, needs no bonds.
      const [only, more] = Object.keys(counts);
      if (!more && counts[only] === 1)
        return { atoms: [{ el: only, p: [0, 0, 0] }], bonds: [], name: element(only).name };
      fail(`A formula like ${raw} does not say how the atoms join. ${pasteSmiles}`);
    }
    if (/^[A-Za-z][a-z]{3,}$/.test(raw))
      fail(`"${raw}" is not in the built-in list. ${pasteSmiles}`);
    throw err;
  }
}
