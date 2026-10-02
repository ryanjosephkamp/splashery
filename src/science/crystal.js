// Thermal ellipsoids (lane Science): atoms with their displacement tensors U
// from crystal files, in Cartesian ångströms.
//
// readCrystal(text, fileName) reads
//   - a small-molecule CIF: the cell (_cell_length_*, _cell_angle_*), the
//     atoms in fractional coordinates (_atom_site_fract_*) with
//     _atom_site_U_iso_or_equiv (or B), and the anisotropic table
//     (_atom_site_aniso_U_11 … _U_23, or B_11 … B_23);
//   - an mmCIF file: _atom_site (Cartesian) with _atom_site_anisotrop;
//   - a PDB file: ATOM and HETATM records with their ANISOU records.
// and returns
//   {
//     format: "cif" | "mmcif" | "pdb", name, id, cell, formula,
//     atoms: [{ label, el, p: [x, y, z], U: [U11, U22, U33, U12, U13, U23], aniso,
//               npd, resName, seq, chain, name }],
//     counts: { atoms, aniso, iso, npd, skipped }, notes: [string],
//   }
// with U in Å² along Cartesian axes (x along a, y in the ab plane).
//
// A CIF gives U against the reciprocal cell, so it is converted:
// U_cart = A · N · U · Nᵀ · Aᵀ, with A the orthogonalization matrix and
// N = diag(a*, b*, c*). mmCIF and PDB give U in Cartesian axes already (PDB
// ANISOU in units of 10⁻⁴ Å²). An isotropic atom has U = Uiso · I.
//
// The CIF tokenizer is lane Chemistry's (eachCifToken in src/chem/protein.js).

import { eachCifToken } from "../chem/protein.js";
import { readPdbAtom } from "../chem/molfile.js";
import { element, normalSymbol } from "../chem/elements.js";

export const MAX_CRYSTAL_ATOMS = 20000;
const EIGHT_PI2 = 8 * Math.PI * Math.PI;
const WATER = new Set(["HOH", "WAT", "DOD", "H2O", "TIP", "TIP3", "SOL"]);

const fail = (message) => {
  throw new Error(message);
};

// "12.2696(5)" -> 12.2696; "?" or "." -> NaN.
export function cifNumber(v) {
  const s = String(v ?? "").trim();
  if (!s || s === "?" || s === ".") return NaN;
  return Number(s.replace(/\(\d+\)$/, ""));
}

// ---- The cell ----------------------------------------------------------------------------

const deg = (x) => (x * Math.PI) / 180;

// The cell's orthogonalization matrix A (fractional -> Cartesian, rows) and
// the reciprocal lengths a*, b*, c*. Angles in degrees.
export function cellMatrices({ a, b, c, alpha, beta, gamma }) {
  const [ca, cb, cg] = [alpha, beta, gamma].map((x) => Math.cos(deg(x)));
  const [sa, , sg] = [alpha, beta, gamma].map((x) => Math.sin(deg(x)));
  const root = 1 - ca * ca - cb * cb - cg * cg + 2 * ca * cb * cg;
  if (!(root > 0)) fail("The cell's angles don't make a cell.");
  const V = a * b * c * Math.sqrt(root);
  const A = [
    [a, b * cg, c * cb],
    [0, b * sg, (c * (ca - cb * cg)) / sg],
    [0, 0, V / (a * b * sg)],
  ];
  const sb = Math.sin(deg(beta));
  const recip = [(b * c * sa) / V, (a * c * sb) / V, (a * b * sg) / V];
  return { A, recip, V };
}

// 3×3 helpers (rows).
const mul3 = (X, Y) =>
  X.map((r) => [0, 1, 2].map((j) => r[0] * Y[0][j] + r[1] * Y[1][j] + r[2] * Y[2][j]));
const tr3 = (X) => [0, 1, 2].map((i) => [X[0][i], X[1][i], X[2][i]]);
const apply3 = (X, v) => X.map((r) => r[0] * v[0] + r[1] * v[1] + r[2] * v[2]);

// [U11, U22, U33, U12, U13, U23] <-> a symmetric matrix.
export const symOf = (u) => [
  [u[0], u[3], u[4]],
  [u[3], u[1], u[5]],
  [u[4], u[5], u[2]],
];
export const sixOf = (m) => [m[0][0], m[1][1], m[2][2], m[0][1], m[0][2], m[1][2]];

// A CIF's U (against the reciprocal cell) in Cartesian axes.
export function uCifToCart(u, cellM) {
  const { A, recip } = cellM;
  const N = [
    [recip[0], 0, 0],
    [0, recip[1], 0],
    [0, 0, recip[2]],
  ];
  const AN = mul3(A, N);
  return sixOf(mul3(mul3(AN, symOf(u)), tr3(AN)));
}

// ---- Eigenvalues and the probability level ---------------------------------------------

// Eigen-decomposition of a symmetric 3×3 matrix (cyclic Jacobi). Returns the
// eigenvalues (largest first) and unit eigenvectors as columns' rows:
// vectors[i] belongs to values[i]. The vectors form a right-handed frame.
export function eigenSym3(m) {
  const a = m.map((r) => r.slice());
  const v = [
    [1, 0, 0],
    [0, 1, 0],
    [0, 0, 1],
  ];
  for (let sweep = 0; sweep < 50; sweep++) {
    const off = a[0][1] ** 2 + a[0][2] ** 2 + a[1][2] ** 2;
    if (off < 1e-30) break;
    for (const [p, q] of [
      [0, 1],
      [0, 2],
      [1, 2],
    ]) {
      if (Math.abs(a[p][q]) < 1e-300) continue;
      const theta = (a[q][q] - a[p][p]) / (2 * a[p][q]);
      const t = Math.sign(theta || 1) / (Math.abs(theta) + Math.sqrt(theta * theta + 1));
      const c = 1 / Math.sqrt(t * t + 1);
      const s = t * c;
      for (let k = 0; k < 3; k++) {
        const akp = a[k][p];
        const akq = a[k][q];
        a[k][p] = c * akp - s * akq;
        a[k][q] = s * akp + c * akq;
      }
      for (let k = 0; k < 3; k++) {
        const apk = a[p][k];
        const aqk = a[q][k];
        a[p][k] = c * apk - s * aqk;
        a[q][k] = s * apk + c * aqk;
      }
      for (let k = 0; k < 3; k++) {
        const vkp = v[k][p];
        const vkq = v[k][q];
        v[k][p] = c * vkp - s * vkq;
        v[k][q] = s * vkp + c * vkq;
      }
    }
  }
  const order = [0, 1, 2].sort((i, j) => a[j][j] - a[i][i]);
  const values = order.map((i) => a[i][i]);
  const vectors = order.map((i) => [v[0][i], v[1][i], v[2][i]]);
  // Right-handed: e3 = e1 × e2.
  const [e1, e2] = vectors;
  vectors[2] = [
    e1[1] * e2[2] - e1[2] * e2[1],
    e1[2] * e2[0] - e1[0] * e2[2],
    e1[0] * e2[1] - e1[1] * e2[0],
  ];
  return { values, vectors };
}

// The chance that a 3D Gaussian displacement falls inside the ellipsoid at r
// standard deviations: P(χ²₃ ≤ r²) = erf(r/√2) − √(2/π) r e^(−r²/2).
function erf(x) {
  // Abramowitz and Stegun 7.1.26 is too coarse here; use the series and the
  // continued fraction.
  const t = Math.abs(x);
  let r;
  if (t < 2.5) {
    let sum = t;
    let term = t;
    for (let n = 1; n < 60; n++) {
      term *= (-t * t) / n;
      sum += term / (2 * n + 1);
    }
    r = (2 / Math.sqrt(Math.PI)) * sum;
  } else {
    let f = 0;
    for (let n = 60; n >= 1; n--) f = n / 2 / (t + f);
    r = 1 - Math.exp(-t * t) / Math.sqrt(Math.PI) / (t + f);
  }
  return x < 0 ? -r : r;
}
export const chi3Cdf = (r) => erf(r / Math.SQRT2) - Math.sqrt(2 / Math.PI) * r * Math.exp(-r * r / 2); // prettier-ignore

// The ellipsoid's scale in standard deviations for a probability p (0.5 ->
// 1.5382, the crystallographers' usual 50% level).
export function probabilityScale(p) {
  let lo = 0;
  let hi = 10;
  for (let i = 0; i < 80; i++) {
    const mid = (lo + hi) / 2;
    if (chi3Cdf(mid) < p) lo = mid;
    else hi = mid;
  }
  return (lo + hi) / 2;
}

// An atom's ellipsoid: the principal standard deviations (Å, largest first)
// and axes. A U that is not positive definite ("NPD") keeps its axes with
// the bad ones set to a small size, and npd is set.
export function ellipsoidOf(U) {
  const { values, vectors } = eigenSym3(symOf(U));
  const npd = values[2] <= 0;
  const floor = Math.max(1e-4, values[0] * 0.02);
  const sigma = values.map((v) => Math.sqrt(Math.max(v, floor)));
  return { sigma, axes: vectors, npd };
}

// ---- Elements ----------------------------------------------------------------------------

// "O2-" -> "O", "Fe3+" -> "Fe", "C1A" (a label) -> "C". Returns "" if unknown.
export function elementFromCif(type, label = "") {
  const t = /^[A-Za-z]{1,2}/.exec(String(type ?? "").trim())?.[0] ?? "";
  for (const s of [t, t.slice(0, 1)]) if (s && element(s)) return normalSymbol(s);
  const l = /^[A-Za-z]{1,2}/.exec(String(label ?? "").trim())?.[0] ?? "";
  for (const s of [l, l.slice(0, 1)]) if (s && element(s)) return normalSymbol(s);
  return "";
}

// ---- Reading a file ----------------------------------------------------------------------

// A CIF data block read by full tag names (so both the small-molecule style,
// "_cell_length_a", and mmCIF's "_atom_site.cartn_x" work): single items in
// a Map, and loops as tables. Tags are lower case; "?" and "." are empty.
export function readCifBlocks(text) {
  const blocks = [];
  let block = null;
  let state = "top"; // "tag" (a tag read, its value next), "loopTags", "loopValues"
  let tag = "";
  let loop = null;
  const empty = (v, quoted) => (!quoted && (v === "?" || v === ".") ? "" : v);
  const newBlock = (id) => {
    block = { id, items: new Map(), loops: [] };
    blocks.push(block);
  };
  eachCifToken(text, (t, quoted) => {
    const lower = t.toLowerCase();
    const keyword = !quoted && (t[0] === "_" || /^(loop_|data_|save_|global_|stop_)/i.test(t));
    if (state === "tag") {
      state = "top";
      if (!keyword) {
        block.items.set(tag, empty(t, quoted));
        return true;
      }
      block.items.set(tag, "");
    }
    if (state === "loopTags") {
      if (keyword && t[0] === "_") {
        loop.tags.push(lower);
        return true;
      }
      state = "loopValues";
    }
    if (state === "loopValues") {
      if (!keyword) {
        loop.values.push(empty(t, quoted));
        return true;
      }
      state = "top";
    }
    if (keyword && lower.startsWith("data_")) newBlock(t.slice(5));
    else if (!block) newBlock("");
    if (keyword && lower === "loop_") {
      loop = { tags: [], values: [] };
      block.loops.push(loop);
      state = "loopTags";
    } else if (keyword && t[0] === "_") {
      tag = lower;
      state = "tag";
    }
    return true;
  });
  return blocks.map((b) => ({
    id: b.id,
    item: (...tags) => {
      for (const k of tags) {
        const v = b.items.get(k);
        if (v) return v;
      }
      return "";
    },
    // The loop that has this tag, as rows: get(r, tag, fallback tag...).
    table(anyTag) {
      const lp = b.loops.find((l) => l.tags.includes(anyTag));
      if (!lp) return null;
      const nf = lp.tags.length;
      const col = new Map(lp.tags.map((f, i) => [f, i]));
      return {
        count: Math.floor(lp.values.length / nf),
        has: (f) => col.has(f),
        get(r, ...names) {
          for (const f of names) {
            const c = col.get(f);
            const v = c === undefined ? "" : (lp.values[r * nf + c] ?? "");
            if (v !== "") return v;
          }
          return "";
        },
      };
    },
  }));
}

function finish(result) {
  const { atoms } = result;
  const counts = { atoms: atoms.length, aniso: 0, iso: 0, npd: 0, skipped: result.skipped ?? 0 };
  for (const a of atoms) {
    const e = ellipsoidOf(a.U);
    a.sigma = e.sigma;
    a.axes = e.axes;
    a.npd = e.npd;
    if (a.aniso) counts.aniso++;
    else counts.iso++;
    if (e.npd) counts.npd++;
  }
  const notes = result.notes ?? [];
  if (!counts.aniso)
    notes.push(
      "This file has no anisotropic displacements, so every atom is a sphere (its isotropic U).",
    );
  else if (counts.iso)
    notes.push(
      `${counts.iso} of ${counts.atoms} atoms have only an isotropic U (usually the hydrogens), so they are spheres.`,
    );
  if (counts.npd)
    notes.push(
      `${counts.npd} atom${counts.npd > 1 ? "s have" : " has"} a U that is not positive definite ("NPD"); ${counts.npd > 1 ? "they are" : "it is"} drawn flattened.`,
    );
  delete result.skipped;
  return { ...result, counts, notes };
}

const DEFAULT_UISO = 0.05; // Å², for an atom with no displacement at all (noted)

function readSmallCif(blocks) {
  for (const blk of blocks) {
    const site = blk.table("_atom_site_fract_x");
    if (!site?.count) continue;
    const cell = {};
    for (const k of ["a", "b", "c"]) cell[k] = cifNumber(blk.item(`_cell_length_${k}`));
    for (const k of ["alpha", "beta", "gamma"]) {
      cell[k] = cifNumber(blk.item(`_cell_angle_${k}`));
      if (!Number.isFinite(cell[k])) cell[k] = 90;
    }
    if (!["a", "b", "c"].every((k) => cell[k] > 0))
      fail("This CIF has atoms but no cell lengths (_cell_length_a, b and c).");
    const cellM = cellMatrices(cell);
    const aniso = new Map();
    const at = blk.table("_atom_site_aniso_label");
    if (at?.count) {
      const isB = !at.has("_atom_site_aniso_u_11") && at.has("_atom_site_aniso_b_11");
      const pre = isB ? "_atom_site_aniso_b_" : "_atom_site_aniso_u_";
      for (let r = 0; r < at.count; r++) {
        const u = ["11", "22", "33", "12", "13", "23"].map((ij) => cifNumber(at.get(r, pre + ij)));
        if (!u.every(Number.isFinite)) continue;
        aniso.set(at.get(r, "_atom_site_aniso_label"), isB ? u.map((x) => x / EIGHT_PI2) : u);
      }
    }
    const atoms = [];
    const notes = [];
    let skipped = 0;
    let guessed = 0;
    for (let r = 0; r < site.count; r++) {
      const label = site.get(r, "_atom_site_label");
      if (/^dum$/i.test(site.get(r, "_atom_site_calc_flag"))) continue;
      const el = elementFromCif(site.get(r, "_atom_site_type_symbol"), label);
      const f = ["x", "y", "z"].map((k) => cifNumber(site.get(r, `_atom_site_fract_${k}`)));
      if (!el || !f.every(Number.isFinite)) {
        skipped++;
        continue;
      }
      let U;
      let isAniso = false;
      if (aniso.has(label)) {
        U = uCifToCart(aniso.get(label), cellM);
        isAniso = true;
      } else {
        let uiso = cifNumber(site.get(r, "_atom_site_u_iso_or_equiv"));
        if (!Number.isFinite(uiso))
          uiso = cifNumber(site.get(r, "_atom_site_b_iso_or_equiv")) / EIGHT_PI2;
        if (!Number.isFinite(uiso) || uiso <= 0) {
          uiso = DEFAULT_UISO;
          guessed++;
        }
        U = [uiso, uiso, uiso, 0, 0, 0];
      }
      atoms.push({ label, el, p: apply3(cellM.A, f), U, aniso: isAniso });
      if (atoms.length > MAX_CRYSTAL_ATOMS) fail(tooMany());
    }
    if (!atoms.length) fail("This CIF's atom table has no atoms this toy can read.");
    if (guessed) notes.push(`${guessed} atoms have no displacement given; they are shown with U = 0.05 Å².`); // prettier-ignore
    if (skipped) notes.push(`${skipped} atoms without a known element or coordinates were left out.`); // prettier-ignore
    const formula = blk.item("_chemical_formula_sum", "_chemical_formula_moiety");
    const name =
      blk.item("_chemical_name_common", "_chemical_name_mineral", "_chemical_name_systematic") ||
      formula ||
      blk.id;
    const temperature = cifNumber(
      blk.item("_diffrn_ambient_temperature", "_cell_measurement_temperature"),
    );
    notes.unshift("The asymmetric unit only: the atoms the file lists, without symmetry copies.");
    return { format: "cif", id: blk.id, name: clean(name), formula: clean(formula), cell, temperature, atoms, notes, skipped }; // prettier-ignore
  }
  return null;
}

function readMmcif(blocks) {
  const blk = blocks.find((b) => b.table("_atom_site.cartn_x"));
  if (!blk) return null;
  const site = blk.table("_atom_site.cartn_x");
  const an = blk.table("_atom_site_anisotrop.id");
  const aniso = new Map();
  if (an?.count) {
    const isB = !an.has("_atom_site_anisotrop.u[1][1]") && an.has("_atom_site_anisotrop.b[1][1]");
    const pre = isB ? "_atom_site_anisotrop.b" : "_atom_site_anisotrop.u";
    for (let r = 0; r < an.count; r++) {
      const u = ["[1][1]", "[2][2]", "[3][3]", "[1][2]", "[1][3]", "[2][3]"].map((ij) =>
        cifNumber(an.get(r, pre + ij)),
      );
      if (u.every(Number.isFinite)) aniso.set(an.get(r, "_atom_site_anisotrop.id"), isB ? u.map((x) => x / EIGHT_PI2) : u); // prettier-ignore
    }
  }
  const col = (r, ...names) => site.get(r, ...names.map((n) => `_atom_site.${n}`));
  const atoms = [];
  let model = null;
  let skipped = 0;
  let water = 0;
  for (let r = 0; r < site.count; r++) {
    const m = col(r, "pdbx_pdb_model_num");
    if (model === null) model = m;
    if (m !== model) break;
    const alt = col(r, "label_alt_id");
    if (alt && alt !== "A" && alt !== "1") continue;
    const resName = col(r, "auth_comp_id", "label_comp_id");
    if (WATER.has(resName)) {
      water++;
      continue;
    }
    const name = col(r, "auth_atom_id", "label_atom_id");
    const el = elementFromCif(col(r, "type_symbol"), name);
    const p = ["cartn_x", "cartn_y", "cartn_z"].map((k) => cifNumber(col(r, k)));
    if (!el || !p.every(Number.isFinite)) {
      skipped++;
      continue;
    }
    const sid = col(r, "id");
    let U;
    let isAniso = false;
    if (aniso.has(sid)) {
      U = aniso.get(sid);
      isAniso = true;
    } else {
      const b = cifNumber(col(r, "b_iso_or_equiv"));
      let uiso = Number.isFinite(b) && b > 0 ? b / EIGHT_PI2 : cifNumber(col(r, "u_iso_or_equiv"));
      if (!(uiso > 0)) uiso = DEFAULT_UISO;
      U = [uiso, uiso, uiso, 0, 0, 0];
    }
    const seq = parseInt(col(r, "auth_seq_id", "label_seq_id"), 10);
    atoms.push({
      label: `${resName}${Number.isFinite(seq) ? seq : ""} ${name}`,
      el,
      p,
      U,
      aniso: isAniso,
      resName,
      seq: Number.isFinite(seq) ? seq : 0,
      chain: col(r, "auth_asym_id", "label_asym_id"),
      name,
    });
    if (atoms.length > MAX_CRYSTAL_ATOMS) fail(tooMany());
  }
  if (!atoms.length) fail("This mmCIF file has no atoms this toy can read.");
  const title = blk.item("_struct.title");
  const notes = ["The first model and the first alternate location only."];
  if (water) notes.push(`${water} water atoms were left out.`);
  return { format: "mmcif", id: blk.id, name: clean(title) || blk.id, formula: "", atoms, notes, skipped }; // prettier-ignore
}

function readPdb(text) {
  const lines = String(text).split(/\r?\n/);
  const atoms = [];
  const bySerial = new Map();
  let title = "";
  let id = "";
  let skipped = 0;
  let water = 0;
  let last = null;
  for (const line of lines) {
    const rec = line.slice(0, 6);
    if (rec === "ENDMDL") break;
    if (rec === "HEADER") id = line.slice(62, 66).trim();
    if (rec === "TITLE ") title += line.slice(10).trim() + " ";
    if (rec === "ATOM  " || rec === "HETATM") {
      last = null;
      const a = readPdbAtom(line);
      if (a.alt && a.alt !== "A" && a.alt !== "1") continue;
      if (WATER.has(a.resName)) {
        water++;
        continue;
      }
      if (!a.el || !a.p.every(Number.isFinite)) {
        skipped++;
        continue;
      }
      const b = Number(line.slice(60, 66));
      const uiso = Number.isFinite(b) && b > 0 ? b / EIGHT_PI2 : DEFAULT_UISO;
      last = {
        label: `${a.resName}${a.seq} ${a.name}`,
        el: a.el,
        p: a.p,
        U: [uiso, uiso, uiso, 0, 0, 0],
        aniso: false,
        resName: a.resName,
        seq: a.seq,
        chain: a.chain,
        name: a.name,
      };
      atoms.push(last);
      bySerial.set(a.serial, last);
      if (atoms.length > MAX_CRYSTAL_ATOMS) fail(tooMany());
    } else if (rec === "ANISOU") {
      const serial = parseInt(line.slice(6, 11), 10);
      const target = bySerial.get(serial) ?? last;
      const u = [28, 35, 42, 49, 56, 63].map((c) => Number(line.slice(c, c + 7)) * 1e-4);
      if (target && u.every(Number.isFinite)) {
        target.U = u;
        target.aniso = true;
      }
    }
  }
  if (!atoms.length) return null;
  const notes = ["The first model and the first alternate location only."];
  if (water) notes.push(`${water} water atoms were left out.`);
  return { format: "pdb", id, name: clean(title) || id || "PDB file", formula: "", atoms, notes, skipped }; // prettier-ignore
}

const clean = (s) =>
  String(s ?? "")
    .replace(/\s+/g, " ")
    .trim();
const tooMany = () =>
  `This file has more than ${MAX_CRYSTAL_ATOMS.toLocaleString("en")} atoms, more than this toy draws.`;

// Reads a CIF, mmCIF or PDB file (see the top of this file).
export function readCrystal(text, fileName = "") {
  const src = String(text ?? "");
  if (!src.trim()) fail("That file is empty.");
  const ext = (/\.([a-z0-9]+)$/i.exec(String(fileName))?.[1] ?? "").toLowerCase();
  const looksCif = /^\s*data_/m.test(src) && /_atom_site[._]/i.test(src);
  const looksPdb = /^(ATOM  |HETATM)/m.test(src);
  let res = null;
  if (looksCif && !(ext === "pdb" || ext === "ent")) {
    const blocks = readCifBlocks(src);
    res = readSmallCif(blocks) ?? readMmcif(blocks);
  }
  if (!res && looksPdb) res = readPdb(src);
  if (!res) fail("This doesn't look like a CIF, mmCIF or PDB file with atoms.");
  return finish(res);
}

// The structure's center (the mean of its atoms), for centering it.
export function centerOf(atoms) {
  const c = [0, 0, 0];
  for (const a of atoms) for (let k = 0; k < 3; k++) c[k] += a.p[k] / atoms.length;
  return c;
}
