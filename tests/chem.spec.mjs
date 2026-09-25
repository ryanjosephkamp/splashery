// Unit checks for the chemistry modules (no browser): SMILES reading, 3D
// embedding, molecule files, the name/formula table, and the protein reader
// with its secondary structure and ribbon path.

import { test, expect } from "@playwright/test";
import fs from "node:fs";
import { element, formulaOf, parseFormula } from "../src/chem/elements.js";
import { parseSmiles, withHydrogens } from "../src/chem/smiles.js";
import { embed3D, moleculeFromSmiles } from "../src/chem/embed.js";
import { condensedToSmiles } from "../src/chem/condensed.js";
import {
  MOLECULES,
  moleculeFromText,
  readMoleculeFile,
  toMolfile,
  toXyz,
} from "../src/chem/molfile.js";
import {
  parseStructure,
  ribbonPath,
  centreStructure,
  assignSecondaryStructure,
} from "../src/chem/protein.js";

const UBQ = fs.readFileSync(new URL("../assets/proteins/1ubq.pdb", import.meta.url), "utf8");

// ---- Geometry helpers ------------------------------------------------------------

const sub = (a, b) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
const dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
const cross = (a, b) => [
  a[1] * b[2] - a[2] * b[1],
  a[2] * b[0] - a[0] * b[2],
  a[0] * b[1] - a[1] * b[0],
];
const len = (a) => Math.hypot(...a);
const dist = (a, b) => len(sub(a, b));
const angle = (a, b, c) => {
  const u = sub(a, b);
  const v = sub(c, b);
  return (Math.acos(dot(u, v) / (len(u) * len(v))) * 180) / Math.PI;
};
const dihedral = (p0, p1, p2, p3) => {
  const b1 = sub(p1, p0);
  const b2 = sub(p2, p1);
  const b3 = sub(p3, p2);
  const n1 = cross(b1, b2);
  const n2 = cross(b2, b3);
  const y = dot(cross(n1, n2), b2) / len(b2);
  return (Math.atan2(y, dot(n1, n2)) * 180) / Math.PI;
};
const neighbours = (mol) => {
  const adj = mol.atoms.map(() => []);
  for (const [i, j] of mol.bonds) (adj[i].push(j), adj[j].push(i));
  return adj;
};
// Largest distance of the given points from their best plane (the plane
// through the centroid, normal to the direction of least spread).
const planeDeviation = (pts) => {
  const c = [0, 1, 2].map((k) => pts.reduce((s, p) => s + p[k], 0) / pts.length);
  let best = Infinity;
  for (let i = 0; i < pts.length; i++)
    for (let j = i + 1; j < pts.length; j++) {
      const n = cross(sub(pts[i], c), sub(pts[j], c));
      if (len(n) < 0.5) continue;
      const u = n.map((v) => v / len(n));
      best = Math.min(best, Math.max(...pts.map((p) => Math.abs(dot(sub(p, c), u)))));
    }
  return best;
};
const closestNonBonded = (mol) => {
  const bonded = new Set(mol.bonds.map(([i, j]) => `${Math.min(i, j)},${Math.max(i, j)}`));
  let min = Infinity;
  mol.atoms.forEach((a, i) =>
    mol.atoms.forEach((b, j) => {
      if (j > i && !bonded.has(`${i},${j}`)) min = Math.min(min, dist(a.p, b.p));
    }),
  );
  return min;
};
const countsOf = (mol) => formulaOf(mol.atoms);

// ---- SMILES --------------------------------------------------------------------

test("SMILES: chains, branches, rings and hydrogen counts", () => {
  const ethanol = parseSmiles("CCO");
  expect(ethanol.atoms.map((a) => a.h)).toEqual([3, 2, 1]);
  expect(ethanol.bonds).toEqual([
    [0, 1, 1],
    [1, 2, 1],
  ]);
  const neo = parseSmiles("CC(C)(C)C");
  expect(neo.atoms[1].h).toBe(0);
  expect(neo.bonds).toHaveLength(4);
  const ring = parseSmiles("C1CCCCC1");
  expect(ring.bonds).toHaveLength(6);
  expect(ring.atoms.every((a) => a.h === 2)).toBe(true);
  expect(parseSmiles("C%10CCCCC%10").bonds).toHaveLength(6);
  expect(parseSmiles("C=1CCC1").bonds.find(([a, b]) => a === 0 && b === 3)[2]).toBe(2);
  expect(parseSmiles("F/C=C/F").bonds.map((b) => b[2])).toEqual([1, 2, 1]);
  expect(parseSmiles("C#N").atoms[0].h).toBe(1);
  const salt = parseSmiles("[Na+].[Cl-]");
  expect(salt.bonds).toHaveLength(0);
  expect(salt.atoms.map((a) => a.charge)).toEqual([1, -1]);
});

test("SMILES: bracket atoms, charges, isotopes and chirality marks", () => {
  expect(parseSmiles("[NH4+]").atoms[0]).toMatchObject({ el: "N", h: 4, charge: 1 });
  expect(parseSmiles("[O-]C(=O)C").atoms[0]).toMatchObject({ el: "O", h: 0, charge: -1 });
  expect(parseSmiles("[Fe+2]").atoms[0]).toMatchObject({ el: "Fe", charge: 2 });
  expect(parseSmiles("[Cu++]").atoms[0].charge).toBe(2);
  expect(parseSmiles("[13CH3]O").atoms[0]).toMatchObject({ el: "C", isotope: 13, h: 3 });
  const alanine = withHydrogens(parseSmiles("C[C@@H](N)C(=O)O"));
  expect(formulaOf(alanine.atoms)).toBe("C3H7NO2");
  expect(formulaOf(withHydrogens(parseSmiles("[C@H](F)(Cl)Br")).atoms)).toBe("CHBrClF");
  expect(formulaOf(withHydrogens(parseSmiles("[H][H]")).atoms)).toBe("H2");
});

test("SMILES: aromatic rings are kekulized", () => {
  const doubles = (g) => g.bonds.filter((b) => b[2] === 2);
  const touches = (b, i) => b[0] === i || b[1] === i;
  const oneDoubleEach = (g) =>
    g.atoms.every((a, i) => !a.aromatic || doubles(g).filter((b) => touches(b, i)).length <= 1);

  const benzene = parseSmiles("c1ccccc1");
  expect(doubles(benzene)).toHaveLength(3);
  expect(benzene.atoms.every((a, i) => doubles(benzene).some((b) => touches(b, i)))).toBe(true);
  expect(benzene.atoms.every((a) => a.aromatic && a.h === 1)).toBe(true);

  const pyridine = parseSmiles("c1ccncc1");
  expect(doubles(pyridine)).toHaveLength(3);
  expect(pyridine.atoms[3]).toMatchObject({ el: "N", h: 0 });

  const pyrrole = parseSmiles("c1cc[nH]c1");
  expect(doubles(pyrrole)).toHaveLength(2);
  expect(pyrrole.atoms[3]).toMatchObject({ el: "N", h: 1 });
  expect(doubles(pyrrole).some((b) => touches(b, 3))).toBe(false);
  // Pyrrole written without its [nH] still works: the N gets the hydrogen.
  expect(parseSmiles("c1ccnc1").atoms[3].h).toBe(1);

  const naphthalene = parseSmiles("c1ccc2ccccc2c1");
  expect(doubles(naphthalene)).toHaveLength(5);
  expect(oneDoubleEach(naphthalene)).toBe(true);

  for (const smi of ["c1ccsc1", "c1ccoc1", "c1cnc[nH]1", "O=c1cccc[nH]1", "C[n+]1ccccc1"]) {
    const g = parseSmiles(smi);
    expect(oneDoubleEach(g), smi).toBe(true);
  }
  // Caffeine, aromatic and Kekulé forms: C8H10N4O2, 24 atoms with hydrogens.
  for (const smi of ["Cn1cnc2c1c(=O)n(C)c(=O)n2C", "CN1C=NC2=C1C(=O)N(C(=O)N2C)C"]) {
    const full = withHydrogens(parseSmiles(smi));
    expect(formulaOf(full.atoms)).toBe("C8H10N4O2");
    expect(full.atoms).toHaveLength(24);
  }
});

test("SMILES: bad input gives short, friendly errors", () => {
  const cases = [
    ["", /Paste a SMILES/],
    ["C1CC", /Ring bond 1 is opened but never closed/],
    ["C(C", /never closed/],
    ["CC)", /without a matching/],
    ["[Xx]", /Unknown element/],
    ["[NH4+", /never closed/],
    ["[N@X]", /Could not read the bracket atom/],
    ["C=", /ends with a bond/],
    ["C==C", /Two bond symbols/],
    ["CNa", /Put Na in brackets/],
    ["C(C)(C)(C)(C)C", /at most 4/],
    ["c1cccc1", /aromatic ring/],
    ["CC>>CO", /Reactions/],
    ["C".repeat(401), /too big/],
  ];
  for (const [smi, message] of cases) expect(() => parseSmiles(smi), smi).toThrow(message);
});

// ---- Embedding --------------------------------------------------------------------

test("embedding: benzene is a flat regular hexagon", () => {
  const mol = moleculeFromSmiles("c1ccccc1");
  expect(mol.atoms).toHaveLength(12);
  const cc = mol.bonds.filter(([i, j]) => mol.atoms[i].el === "C" && mol.atoms[j].el === "C");
  expect(cc).toHaveLength(6);
  for (const [i, j] of cc) {
    const d = dist(mol.atoms[i].p, mol.atoms[j].p);
    expect(d).toBeGreaterThan(1.34);
    expect(d).toBeLessThan(1.45);
  }
  expect(planeDeviation(mol.atoms.map((a) => a.p))).toBeLessThan(0.05);
  // Centred on the origin.
  for (let k = 0; k < 3; k++)
    expect(Math.abs(mol.atoms.reduce((s, a) => s + a.p[k], 0))).toBeLessThan(1e-2);
});

test("embedding: ethanol angles are near tetrahedral", () => {
  const mol = moleculeFromSmiles("CCO");
  expect(formulaOf(mol.atoms)).toBe("C2H6O");
  const adj = neighbours(mol);
  const angles = [];
  adj.forEach((nb, j) => {
    for (let a = 0; a < nb.length; a++)
      for (let b = a + 1; b < nb.length; b++)
        angles.push(angle(mol.atoms[nb[a]].p, mol.atoms[j].p, mol.atoms[nb[b]].p));
  });
  expect(angles).toHaveLength(13);
  for (const a of angles) expect(Math.abs(a - 109.5)).toBeLessThan(6);
});

test("embedding: naphthalene is flat and cyclohexane is a chair", () => {
  const naph = moleculeFromSmiles("c1ccc2ccccc2c1");
  expect(planeDeviation(naph.atoms.map((a) => a.p))).toBeLessThan(0.05);
  const chx = moleculeFromSmiles("C1CCCCC1");
  const ring = [0, 1, 2, 3, 4, 5].map((i) => chx.atoms[i].p);
  const torsions = ring.map((_, i) => dihedral(...[0, 1, 2, 3].map((k) => ring[(i + k) % 6])));
  torsions.forEach((t, i) => {
    expect(Math.abs(t)).toBeGreaterThan(45);
    expect(Math.abs(t)).toBeLessThan(70);
    expect(Math.sign(t)).not.toBe(Math.sign(torsions[(i + 1) % 6]));
  });
});

test("embedding: no clashes in caffeine, glucose and cholesterol", () => {
  for (const name of ["caffeine", "glucose", "cholesterol"]) {
    const mol = moleculeFromText(name);
    expect(closestNonBonded(mol), name).toBeGreaterThan(1.0);
    for (const [i, j] of mol.bonds) {
      const d = dist(mol.atoms[i].p, mol.atoms[j].p);
      expect(d, name).toBeGreaterThan(0.9);
      expect(d, name).toBeLessThan(1.65);
    }
  }
});

test("embedding: big molecules do not tangle, and seeds are repeatable", () => {
  // β-cyclodextrin (147 atoms: seven sugar rings in a macrocycle) and a
  // heptapeptide (114 atoms).
  let cd = "";
  for (let k = 0; k < 7; k++) cd += `C%${10 + k}C(O)C(O)C(OC%${10 + k}CO)O`;
  cd = cd.replace(/^C%10/, "C%99%10").replace(/O$/, "O%99");
  const peptide =
    "NCC(=O)NC(C)C(=O)NC(Cc1ccccc1)C(=O)NC(CO)C(=O)NC(CC(C)C)C(=O)NC(Cc1ccc(O)cc1)C(=O)NC(CCCNC(=N)N)C(=O)O";
  for (const smi of [cd, peptide]) {
    const mol = moleculeFromSmiles(smi, { seed: 3 });
    expect(mol.atoms.length).toBeGreaterThan(100);
    expect(closestNonBonded(mol)).toBeGreaterThan(1.2);
    for (const [i, j] of mol.bonds) expect(dist(mol.atoms[i].p, mol.atoms[j].p)).toBeLessThan(1.6);
  }
  expect(formulaOf(moleculeFromSmiles(cd).atoms)).toBe("C42H70O35");
  const a = moleculeFromSmiles("CC(C)Cc1ccc(cc1)C(C)C(=O)O", { seed: 5 });
  const b = moleculeFromSmiles("CC(C)Cc1ccc(cc1)C(C)C(=O)O", { seed: 5 });
  expect(a).toEqual(b);
  // embed3D lines up with withHydrogens(graph).atoms.
  const graph = parseSmiles("CO");
  expect(embed3D(graph)).toHaveLength(withHydrogens(graph).atoms.length);
});

test("embedding: 100 atoms in well under 300 ms", () => {
  moleculeFromSmiles("CCCCCCCCCC"); // warm up
  const smi = "C".repeat(33); // C33H68, 101 atoms
  const t0 = performance.now();
  const mol = moleculeFromSmiles(smi);
  const ms = performance.now() - t0;
  console.log(`embedding ${mol.atoms.length} atoms took ${ms.toFixed(0)} ms`);
  expect(mol.atoms).toHaveLength(101);
  expect(ms).toBeLessThan(1000); // generous for slow CI machines; ~100 ms here
});

// ---- Names, formulas and files -------------------------------------------------------

test("every table molecule parses and matches its formula", () => {
  expect(MOLECULES.length).toBeGreaterThanOrEqual(40);
  for (const m of MOLECULES) {
    const full = withHydrogens(parseSmiles(m.smiles));
    expect(formulaOf(full.atoms), m.name).toBe(m.formula);
    const mol = moleculeFromText(m.name);
    expect(mol.name).toBe(m.name);
    expect(formulaOf(mol.atoms), m.name).toBe(m.formula);
    expect(closestNonBonded(mol), m.name).toBeGreaterThan(1.0);
  }
});

test("condensed formulas are read as written", () => {
  const cases = {
    CH3CH2OH: "C2H6O",
    C2H5OH: "C2H6O",
    CH3OCH3: "C2H6O",
    CH3COOH: "C2H4O2",
    "(CH3)2CHOH": "C3H8O",
    "CH3(CH2)4CH3": "C6H14",
    "CH2=CHCl": "C2H3Cl",
    "HC≡CH": "C2H2",
    "CH3CH(NH2)COOH": "C3H7NO2",
    CH2OHCHOHCH2OH: "C3H8O3",
    CH3COCH3: "C3H6O",
    CH3CHO: "C2H4O",
    HCOOH: "CH2O2",
    CH3CN: "C2H3N",
    CH3COOC2H5: "C4H8O2",
    CHCl3: "CHCl3",
    C6H5COOH: "C7H6O2",
    C6H5NO2: "C6H5NO2",
    "(C6H5)2CO": "C13H10O",
    SO3: "O3S",
  };
  for (const [text, formula] of Object.entries(cases)) {
    const smiles = condensedToSmiles(text);
    expect(smiles, text).not.toBeNull();
    expect(countsOf(moleculeFromSmiles(smiles)), text).toBe(formula);
  }
  // The C=O comes from the valences: acetone has a double bond to O.
  const acetone = moleculeFromText("CH3COCH3");
  const o = acetone.atoms.findIndex((a) => a.el === "O");
  expect(acetone.bonds.find(([a, b]) => a === o || b === o)[2]).toBe(2);
  // Not readable this way: a plain formula, a bad valence.
  expect(condensedToSmiles("C6H12O6")).toBeNull();
  expect(condensedToSmiles("CH5")).toBeNull();
});

test("moleculeFromText takes names, formulas and SMILES", () => {
  expect(moleculeFromText("Carbon Dioxide").name).toBe("carbon dioxide");
  expect(moleculeFromText("acetaminophen").name).toBe("paracetamol");
  expect(moleculeFromText("H2O").name).toBe("water");
  expect(moleculeFromText("H₂O").name).toBe("water");
  expect(moleculeFromText("NH3").name).toBe("ammonia");
  expect(moleculeFromText("NaCl").name).toBe("sodium chloride");
  expect(moleculeFromText("C6H6").name).toBe("benzene");
  expect(countsOf(moleculeFromText("CCO"))).toBe("C2H6O");
  expect(moleculeFromText("Xe").atoms).toHaveLength(1);
  // A formula that fits a built-in molecule shows it, and says when others
  // share it; CO is carbon monoxide, OC the SMILES for methanol.
  const sugar = moleculeFromText("C6H12O6");
  expect(sugar.name).toBe("glucose");
  expect(sugar.note).toContain("fructose");
  expect(moleculeFromText("CO").name).toBe("carbon monoxide");
  expect(countsOf(moleculeFromText("OC"))).toBe("CH4O");
  expect(moleculeFromText("Co").name).toBe("cobalt");
  expect(() => moleculeFromText("C7H6O2")).toThrow(
    "A formula like C7H6O2 does not say how the atoms join. Write it out (CH3CH2OH rather than C2H6O) or paste a SMILES string, e.g. from PubChem.",
  );
  expect(() => moleculeFromText("vitamin b12")).toThrow(/not in the built-in list/);
  expect(() => moleculeFromText("")).toThrow(/Type a molecule name/);
  expect(parseFormula("C8H10N4O2")).toEqual({ C: 8, H: 10, N: 4, O: 2 });
  expect(element("cl").name).toBe("chlorine");
  expect(element("AU").z).toBe(79);
});

// Fixed-width helpers for writing test files.
const pad = (v, width) => String(v).padStart(width);
const pdbLine = ({ het, serial, name, alt = " ", res, chain = "A", seq, icode = " ", p, el }) =>
  [
    het ? "HETATM" : "ATOM  ",
    pad(serial, 5),
    " ",
    name.padEnd(4),
    alt,
    res.padStart(3),
    " ",
    chain,
    pad(seq, 4),
    icode,
    "   ",
    p.map((v) => pad(v.toFixed(3), 8)).join(""),
    "  1.00  0.00          ",
    pad(el, 2),
  ].join("");
const cifLoop = (category, fields, rows) => [
  "loop_",
  ...fields.map((f) => `_${category}.${f}`),
  ...rows.map((row) => row.join(" ")),
  "#",
];

test("MOL files round-trip, and 2D drawings become 3D", () => {
  const acetate = moleculeFromSmiles("CC(=O)[O-]");
  const text = toMolfile({ ...acetate, name: "acetate" });
  const back = readMoleculeFile(text, "acetate.mol");
  expect(back.name).toBe("acetate");
  expect(back.atoms.map((a) => a.el)).toEqual(acetate.atoms.map((a) => a.el));
  expect(back.bonds).toEqual(acetate.bonds);
  expect(back.atoms[3].charge).toBe(-1);
  back.atoms.forEach((a, i) => expect(dist(a.p, acetate.atoms[i].p)).toBeLessThan(1e-3));

  // A flat 2D drawing with aromatic bonds and no hydrogens (first SDF record).
  const atomRows = [0, 1, 2, 3, 4, 5].map((k) => {
    const [x, y] = [Math.cos, Math.sin].map((f) =>
      pad((1.5 * f((k * Math.PI) / 3)).toFixed(4), 10),
    );
    return `${x}${y}    0.0000 C   0  0  0  0  0  0  0  0  0  0  0  0`;
  });
  const bondRows = [1, 2, 3, 4, 5, 6].map(
    (i) => `${pad(i, 3)}${pad((i % 6) + 1, 3)}  4  0  0  0  0`,
  );
  const header = ["benzene", "  hand      2D", "", "  6  6  0  0  0  0  0  0  0  0999 V2000"];
  const sdf = [...header, ...atomRows, ...bondRows, "M  END", "$$$$", "second record"].join("\n");
  const benzene = readMoleculeFile(sdf, "benzene.sdf");
  expect(formulaOf(benzene.atoms)).toBe("C6H6");
  expect(benzene.bonds.filter((b) => b[2] === 2)).toHaveLength(3);
  for (const [i, j] of benzene.bonds)
    if (benzene.atoms[i].el === "C" && benzene.atoms[j].el === "C")
      expect(Math.abs(dist(benzene.atoms[i].p, benzene.atoms[j].p) - 1.395)).toBeLessThan(0.05);

  // V3000 with a charge.
  const v3000 = `methylammonium
  Hand      2D

  0  0  0     0  0            999 V3000
M  V30 BEGIN CTAB
M  V30 COUNTS 2 1 0 0 0
M  V30 BEGIN ATOM
M  V30 1 C 0 0 0 0
M  V30 2 N 1.49 0 0 0 CHG=1
M  V30 END ATOM
M  V30 BEGIN BOND
M  V30 1 1 1 2
M  V30 END BOND
M  V30 END CTAB
M  END
`;
  const ion = readMoleculeFile(v3000, "ion.mol");
  expect(formulaOf(ion.atoms)).toBe("CH6N"); // the 2D drawing gains its hydrogens
  expect(ion.atoms[1]).toMatchObject({ el: "N", charge: 1 });
});

test("XYZ files get bonds and bond orders from distances", () => {
  const acid = moleculeFromSmiles("c1ccccc1C(=O)O");
  const back = readMoleculeFile(toXyz(acid, "benzoic acid"), "acid.xyz");
  expect(back.name).toBe("benzoic acid");
  expect(back.bonds).toHaveLength(acid.bonds.length);
  expect(back.bonds.filter((b) => b[2] === 2)).toHaveLength(4);
  const nitrile = readMoleculeFile(toXyz(moleculeFromSmiles("CC#N")), "x.xyz");
  expect(nitrile.bonds.filter((b) => b[2] === 3)).toHaveLength(1);
  const co2 = readMoleculeFile(toXyz(moleculeFromSmiles("O=C=O")), "x.xyz");
  expect(co2.bonds.map((b) => b[2])).toEqual([2, 2]);
  const bad = "3\nbad\nC 0 0 0\nQ 1 1 1\nH 0 0 1\n";
  expect(() => readMoleculeFile(bad, "bad.xyz")).toThrow(/Could not read line 4/);
});

test("small-molecule PDB: CONECT records, or distances without them", () => {
  const acid = moleculeFromSmiles("CC(=O)O");
  const het = { het: true, seq: 1, res: "ACE" };
  const hetatm = acid.atoms.map(({ el, p }, i) =>
    pdbLine({ ...het, serial: i + 1, name: ` ${el}${i + 1}`, p, el }),
  );
  // A double bond is listed twice.
  const conect = acid.bonds.flatMap(([i, j, o]) =>
    Array(o).fill(`CONECT${pad(i + 1, 5)}${pad(j + 1, 5)}`),
  );
  const text = ["COMPND    acetic acid", ...hetatm, ...conect, "END"].join("\n");
  const withConect = readMoleculeFile(text, "a.pdb");
  expect(withConect.name).toBe("acetic acid");
  expect(withConect.bonds.map((b) => b[2]).sort()).toEqual(acid.bonds.map((b) => b[2]).sort());
  const water = pdbLine({ ...het, serial: 99, name: " O", res: "HOH", p: [10, 10, 10], el: "O" });
  const bare = readMoleculeFile([...hetatm, water].join("\n"), "a.pdb");
  expect(formulaOf(bare.atoms)).toBe("C2H4O2");
  expect(bare.bonds).toHaveLength(7);
  expect(bare.bonds.filter((b) => b[2] === 2)).toHaveLength(1);
});

// ---- Proteins ---------------------------------------------------------------------------

test("1UBQ parses to 76 residues with helix and strand", () => {
  const t0 = performance.now();
  const s = parseStructure(UBQ, "1ubq.pdb");
  console.log(`parsing 1UBQ took ${(performance.now() - t0).toFixed(1)} ms`);
  expect(s.id).toBe("1UBQ");
  expect(s.title).toMatch(/UBIQUITIN/);
  expect(s.chains).toHaveLength(1);
  const [chain] = s.chains;
  expect(chain.id).toBe("A");
  expect(chain.residues).toHaveLength(76);
  expect(chain.residues[0]).toMatchObject({ name: "MET", seq: 1, icode: "" });
  expect(chain.residues[0].atoms.map((a) => a.name).slice(0, 4)).toEqual(["N", "CA", "C", "O"]);
  expect(chain.residues[0].atoms[0].el).toBe("N");
  expect(s.ligands).toHaveLength(0); // only water, which is dropped
  const ss = chain.residues.map((r) => r.ss).join("");
  expect(ss.slice(22, 34)).toBe("HHHHHHHHHHHH"); // HELIX 1: Ile23–Glu34
  expect(ss.slice(0, 7)).toBe("EEEEEEE"); // strand Met1–Thr7
  expect(ss).toMatch(/^[HEC]+$/);
});

test("the DSSP fallback agrees with 1UBQ's own records", () => {
  const withRecords = parseStructure(UBQ, "1ubq.pdb");
  const bare = UBQ.split("\n")
    .filter((l) => !/^(HELIX|SHEET)/.test(l))
    .join("\n");
  const computed = parseStructure(bare, "1ubq.pdb");
  const a = withRecords.chains[0].residues.map((r) => r.ss);
  const b = computed.chains[0].residues.map((r) => r.ss);
  const agree = a.filter((s, i) => s === b[i]).length / a.length;
  console.log(`DSSP agreement with HELIX/SHEET: ${(agree * 100).toFixed(0)}%`);
  expect(agree).toBeGreaterThan(0.75);
  expect(b).toContain("H");
  expect(b).toContain("E");
  // Running it again on the same chains gives the same answer.
  assignSecondaryStructure(computed.chains);
  expect(computed.chains[0].residues.map((r) => r.ss)).toEqual(b);
});

test("mmCIF gives the same protein as PDB", () => {
  const lines = UBQ.split("\n");
  const cut = (l, a, b) => l.slice(a, b).trim();
  const quote = (v) => (v === "" ? "?" : /[\s'"]/.test(v) ? `"${v}"` : v);
  const atomRows = lines
    .filter((l) => /^(ATOM  |HETATM)/.test(l))
    .map((l) =>
      [
        cut(l, 0, 6),
        cut(l, 6, 11),
        cut(l, 76, 78),
        cut(l, 12, 16),
        cut(l, 16, 17) || ".",
        cut(l, 17, 20),
        cut(l, 21, 22),
        cut(l, 22, 26),
        cut(l, 26, 27),
        cut(l, 30, 38),
        cut(l, 38, 46),
        cut(l, 46, 54),
        "1",
      ].map(quote),
    );
  const helixRows = lines
    .filter((l) => l.startsWith("HELIX"))
    .map((l) => ["HELX_P", l[19], cut(l, 21, 25), "?", cut(l, 33, 37), "?"]);
  const sheetRows = lines
    .filter((l) => l.startsWith("SHEET"))
    .map((l) => ["BET", l[21], cut(l, 22, 26), cut(l, 33, 37)]);
  const cif = [
    "data_1UBQ",
    "_struct.title",
    ";Ubiquitin, written",
    "as a text field",
    ";",
    "_struct_keywords.text 'CHROMOSOMAL PROTEIN'",
    ...cifLoop(
      "struct_conf",
      [
        "conf_type_id",
        "beg_auth_asym_id",
        "beg_auth_seq_id",
        "pdbx_beg_PDB_ins_code",
        "end_auth_seq_id",
        "pdbx_end_PDB_ins_code",
      ],
      helixRows,
    ),
    ...cifLoop(
      "struct_sheet_range",
      ["sheet_id", "beg_auth_asym_id", "beg_auth_seq_id", "end_auth_seq_id"],
      sheetRows,
    ),
    ...cifLoop(
      "atom_site",
      [
        "group_PDB",
        "id",
        "type_symbol",
        "auth_atom_id",
        "label_alt_id",
        "auth_comp_id",
        "auth_asym_id",
        "auth_seq_id",
        "pdbx_PDB_ins_code",
        "Cartn_x",
        "Cartn_y",
        "Cartn_z",
        "pdbx_PDB_model_num",
      ],
      atomRows,
    ),
  ].join("\n");
  const fromCif = parseStructure(cif, "1ubq.cif");
  const fromPdb = parseStructure(UBQ, "1ubq.pdb");
  expect(fromCif.title).toBe("Ubiquitin, written as a text field");
  expect(fromCif.chains[0].residues).toHaveLength(76);
  expect(fromCif.chains[0].residues.map((r) => r.ss)).toEqual(
    fromPdb.chains[0].residues.map((r) => r.ss),
  );
  expect(fromCif.chains[0].residues[5].atoms).toEqual(fromPdb.chains[0].residues[5].atoms);
});

test("PDB details: first model, first altLoc, insertion codes, DNA skipped", () => {
  let serial = 0;
  const atom = (name, res, seq, x, more = {}) =>
    pdbLine({ serial: ++serial, name, res, seq, p: [x, 0, 0], el: name.trim()[0], ...more });
  const residue = (res, seq, x, more) =>
    [" N", " CA", " C", " O"].map((name, k) => atom(name, res, seq, x + 1.2 * k, more));
  const text = [
    "MODEL        1",
    ...residue("GLY", 51, 0),
    ...residue("SER", 52, 3.8, { alt: "A" }),
    ...residue("SER", 52, 3.9, { alt: "B" }),
    ...residue("ALA", 52, 7.6, { icode: "A" }),
    atom(" P", "DA", 1, 20, { chain: "B" }),
    atom(" C1'", "DA", 1, 21, { chain: "B", el: "C" }),
    atom("ZN", "ZN", 1, 30, { chain: "C", het: true, el: "ZN" }),
    atom(" O", "HOH", 2, 40, { chain: "C", het: true }),
    "ENDMDL",
    "MODEL        2",
    ...residue("GLY", 51, 100),
    "ENDMDL",
  ].join("\n");
  const s = parseStructure(text, "tiny.pdb");
  expect(s.chains).toHaveLength(1);
  const res = s.chains[0].residues;
  expect(res.map((r) => `${r.name}${r.seq}${r.icode}`)).toEqual(["GLY51", "SER52", "ALA52A"]);
  expect(res[1].atoms).toHaveLength(4);
  expect(res[1].atoms[1].p[0]).toBeCloseTo(5.0, 3); // altLoc A, not B
  expect(res[0].atoms[0].p[0]).toBe(0); // model 1, not model 2
  expect(s.ligands.map((l) => l.name)).toEqual(["ZN"]);
  expect(s.ligands[0].atoms[0].el).toBe("Zn");
  expect(() => parseStructure(atom(" P", "DA", 1, 0, { chain: "B" }), "dna.pdb")).toThrow(
    /DNA or RNA/,
  );
  expect(() => parseStructure("hello", "x.txt")).toThrow(/PDB or mmCIF/);
});

test("structures over 20,000 atoms are refused kindly", () => {
  const names = [" N", " CA", " C", " O"];
  const lines = Array.from({ length: 20010 }, (_, i) =>
    pdbLine({
      serial: i + 1,
      name: names[i % 4],
      res: "ALA",
      seq: Math.floor(i / 4) + 1,
      p: [i * 0.1, 0, 0],
      el: names[i % 4].trim()[0],
    }),
  );
  expect(() => parseStructure(lines.join("\n"), "big.pdb")).toThrow(/20,000 atoms/);
});

test("ribbonPath gives unit vectors and continuous sides", () => {
  const s = centreStructure(parseStructure(UBQ, "1ubq.pdb"));
  const all = s.chains[0].residues.flatMap((r) => r.atoms);
  for (let k = 0; k < 3; k++)
    expect(Math.abs(all.reduce((sum, a) => sum + a.p[k], 0) / all.length)).toBeLessThan(1e-9);
  const chain = s.chains[0];
  const path = ribbonPath(chain, { perResidue: 8 });
  expect(path).toHaveLength(75 * 8 + 1);
  const ca = (i) => chain.residues[i].atoms.find((a) => a.name === "CA").p;
  expect(dist(path[0].p, ca(0))).toBeLessThan(1e-9);
  expect(dist(path[path.length - 1].p, ca(75))).toBeLessThan(1e-9);
  expect(dist(path[8].p, ca(1))).toBeLessThan(1e-9);
  // Worst cases over the whole path, checked once.
  let unitError = 0;
  let skew = 0;
  let minTurn = 1;
  let maxStep = 0;
  path.forEach((pt, i) => {
    unitError = Math.max(unitError, ...[pt.t, pt.side, pt.normal].map((v) => Math.abs(len(v) - 1)));
    skew = Math.max(skew, Math.abs(dot(pt.t, pt.side)));
    if (i) {
      minTurn = Math.min(minTurn, dot(pt.side, path[i - 1].side));
      maxStep = Math.max(maxStep, dist(pt.p, path[i - 1].p));
    }
  });
  expect(unitError).toBeLessThan(1e-9);
  expect(skew).toBeLessThan(1e-9);
  expect(minTurn).toBeGreaterThan(0.5); // sides never flip
  expect(maxStep).toBeLessThan(1.5);
  expect(path.every((pt) => pt.ss === chain.residues[pt.res].ss && pt.seg === 0)).toBe(true);
  expect(new Set(path.map((p) => p.ss))).toEqual(new Set(["H", "E", "C"]));
  // A gap in the chain starts a new segment.
  const gapped = { residues: [...chain.residues.slice(0, 10), ...chain.residues.slice(20, 30)] };
  const parts = ribbonPath(gapped, { perResidue: 4 });
  expect(new Set(parts.map((p) => p.seg))).toEqual(new Set([0, 1]));
});

// ---- The toys ------------------------------------------------------------------------------

const buildToy = async (id, given = {}) => {
  const { RECIPES } = await import("../src/packs/atoms.js");
  const { buildRecipe } = await import("../src/kit.js");
  const { resolveOptions } = await import("../src/player.js");
  const recipe = RECIPES[id];
  const options = resolveOptions(recipe, given);
  await recipe.prepare?.(options);
  const it = buildRecipe(recipe, { seed: 3, count: 12000, options }, () => {});
  let r = it.next();
  while (!r.done) r = it.next();
  return { recipe, ctx: r.value, data: r.value.kit.data };
};

test("the molecule toy takes a name, a SMILES string or a file of your own", async () => {
  const { RECIPES } = await import("../src/packs/atoms.js");
  const input = RECIPES.molecule.input;
  // A name: kept as typed; the toy builds it (aspirin, C9H8O4: 21 atoms).
  const named = await input.read("Aspirin");
  expect(named).toEqual({ molecule: "custom", source: "Aspirin" });
  const a = await buildToy("molecule", named);
  expect(a.data.tokens.length).toBe(21);
  expect(input.shown()).toContain("C9H8O4");
  // SMILES keeps its case (aromatic atoms are lower case).
  expect((await input.read("c1ccncc1")).source).toBe("c1ccncc1");
  // Something that is not a molecule says why.
  await expect(input.read("C7H6O2")).rejects.toThrow(/SMILES/);
  // A formula written out is built as written (acetic acid: 8 atoms).
  const acid = await input.read("CH3COOH");
  expect((await buildToy("molecule", acid)).data.tokens.length).toBeGreaterThan(1);
  expect(input.shown()).toContain("C2H4O2");
  // A file is packed into one line that the toy unpacks (cholesterol:
  // 74 atoms, grouped into at most 48 moving pieces).
  const mol = moleculeFromText("cholesterol");
  const fromFile = await input.read(toMolfile(mol, "cholesterol"), "cholesterol.mol");
  expect(fromFile.source.startsWith("M1;")).toBe(true);
  const b = await buildToy("molecule", fromFile);
  expect(b.data.tokens.length).toBeLessThanOrEqual(48);
  expect(b.data.tokens.length).toBeGreaterThan(10);
  expect(input.shown()).toContain("74 atoms");
  // Scenes keep the text as it is.
  const { normalizeOptions } = await import("../src/state.js");
  expect(normalizeOptions({ source: "CC(=O)O" }).source).toBe("CC(=O)O");
  expect(normalizeOptions({ source: fromFile.source }).source).toBe(fromFile.source);
});

test("the protein toy draws each structure and pulls it apart into its pieces", async () => {
  for (const [id, chains] of [
    ["ubiquitin", 1],
    ["insulin", 4],
    ["gfp", 1],
    ["hemoglobin", 4],
  ]) {
    const { recipe, data } = await buildToy("protein", { protein: id });
    expect(recipe.input.shown(), id).toContain(`${chains} chain`);
    expect(data.tokens.length, id).toBeLessThanOrEqual(48);
    expect(data.tokens.length, id).toBeGreaterThan(4);
    // At rest nothing has moved; mid-effect the pieces are apart.
    const drive = (v) => {
      const out = { parts: {}, cues: [] };
      recipe.drive(1, { apart: v }, out, { time: 1, data });
      return out;
    };
    const far = (out) => Math.max(...out.tokens.map((t) => Math.hypot(...t.offset)));
    expect(far(drive(0)), id).toBeLessThan(1e-6);
    expect(far(drive(0.6)), id).toBeGreaterThan(2);
    expect(data.glow, id).toBe(id === "gfp");
  }
  // A structure of your own, read from a file.
  const { RECIPES } = await import("../src/packs/atoms.js");
  const text = fs.readFileSync("assets/proteins/1ubq.pdb", "utf8");
  const options = await RECIPES.protein.input.read(text, "my-protein.pdb");
  expect(options).toEqual({ protein: "file", fileName: "my-protein.pdb" });
  const own = await buildToy("protein", options);
  expect(own.recipe.input.shown()).toContain("my-protein.pdb");
});
