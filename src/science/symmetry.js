// Lane Science r3 (October 5, 2026): a crystal's unit cell from its
// asymmetric unit. A small-molecule CIF lists only the asymmetric unit and the
// space group's symmetry operations (_space_group_symop_operation_xyz or
// _symmetry_equiv_pos_as_xyz); a mineral's few listed atoms only make sense
// with their copies.
//
// Each operation (W, t) maps a fractional position f to W·f + t. An atom's
// displacement tensor goes with it: in Cartesian axes U' = R·U·Rᵀ with
// R = A·W·A⁻¹ (A the orthogonalization matrix), which is exact for a
// symmetry copy (the copy's measured U is the same tensor, turned).
//
// fillCell(structure, { cells, molecular }) returns a new structure whose
// atoms fill `cells` = [n1, n2, n3] unit cells:
//   - molecular: each operation is applied to the whole asymmetric unit, and
//     the copy is moved by whole cells so its center lies in the block, so
//     molecules stay whole (as Mercury's "pack" does);
//   - otherwise each atom is wrapped into the block, with the copies on its
//     faces, edges and corners (as a textbook unit cell is drawn).
// Copies that land on one another (atoms on special positions) are merged.

import { ellipsoidOf, symOf, sixOf } from "./crystal.js";
import { covalentRadius } from "../chem/elements.js";

const FRACTIONS = /^([+-]?)(\d+)\/(\d+)$/;

// "x-y+1/2" style terms -> one row of W and its t.
function parseRow(expr) {
  const s = String(expr).replace(/\s+/g, "").toLowerCase();
  if (!s) throw new Error("An empty symmetry operation.");
  const row = [0, 0, 0];
  let t = 0;
  const terms = s.match(/[+-]?[^+-]+/g) ?? [];
  for (const term of terms) {
    const m = /^([+-]?)(\d*\.?\d*(?:\/\d+)?)\*?([xyz])$/.exec(term);
    if (m) {
      const sign = m[1] === "-" ? -1 : 1;
      let k = 1;
      if (m[2]) {
        const f = FRACTIONS.exec(m[2]);
        k = f ? Number(f[2]) / Number(f[3]) : Number(m[2]);
      }
      row["xyz".indexOf(m[3])] += sign * k;
      continue;
    }
    const f = FRACTIONS.exec(term);
    if (f) {
      t += (f[1] === "-" ? -1 : 1) * (Number(f[2]) / Number(f[3]));
      continue;
    }
    const n = Number(term);
    if (!Number.isFinite(n)) throw new Error(`Can't read the symmetry term "${term}".`);
    t += n;
  }
  return { row, t };
}

// "-x+1/2, y, -z" -> { W: 3×3 rows, t: [3] }.
export function parseSymop(op) {
  const parts = String(op).replace(/^'|'$/g, "").split(",");
  if (parts.length !== 3) throw new Error(`Can't read the symmetry operation "${op}".`);
  const rows = parts.map(parseRow);
  return { W: rows.map((r) => r.row), t: rows.map((r) => r.t) };
}

const mul3 = (X, Y) =>
  X.map((r) => [0, 1, 2].map((j) => r[0] * Y[0][j] + r[1] * Y[1][j] + r[2] * Y[2][j]));
const tr3 = (X) => [0, 1, 2].map((i) => [X[0][i], X[1][i], X[2][i]]);
const apply3 = (X, v) => X.map((r) => r[0] * v[0] + r[1] * v[1] + r[2] * v[2]);

function inv3(m) {
  const [[a, b, c], [d, e, f], [g, h, i]] = m;
  const A = e * i - f * h;
  const B = -(d * i - f * g);
  const C = d * h - e * g;
  const det = a * A + b * B + c * C;
  return [
    [A / det, -(b * i - c * h) / det, (b * f - c * e) / det],
    [B / det, (a * i - c * g) / det, -(a * f - c * d) / det],
    [C / det, -(a * h - b * g) / det, (a * e - b * d) / det],
  ];
}

// A displacement tensor (six numbers, Cartesian) turned by R.
export function turnU(U, R) {
  return sixOf(mul3(mul3(R, symOf(U)), tr3(R)));
}

const EPS = 0.02; // fractional tolerance for atoms on a face
const SAME = 0.3; // Å: copies nearer than this are one atom

// The cell's twelve edges (Cartesian, Å) for `cells` = [n1, n2, n3].
export function cellEdges(A, cells = [1, 1, 1]) {
  const out = [];
  const [n1, n2, n3] = cells;
  const corner = (i, j, k) => apply3(A, [i * n1, j * n2, k * n3]);
  for (const [a, b] of [
    [0, 1],
    [2, 3],
    [4, 5],
    [6, 7],
    [0, 2],
    [1, 3],
    [4, 6],
    [5, 7],
    [0, 4],
    [1, 5],
    [2, 6],
    [3, 7],
  ]) {
    const ca = [a & 1, (a >> 1) & 1, (a >> 2) & 1];
    const cb = [b & 1, (b >> 1) & 1, (b >> 2) & 1];
    out.push([corner(...ca), corner(...cb)]);
  }
  return out;
}

export function fillCell(
  structure,
  { cells = [1, 1, 1], molecular = false, maxAtoms = 4000 } = {},
) {
  const s = structure;
  if (s.format !== "cif" || !s.cellM) throw new Error("Only a small-molecule CIF has a unit cell to fill."); // prettier-ignore
  const A = s.cellM.A;
  const Ai = inv3(A);
  const ops = (s.symops?.length ? s.symops : ["x,y,z"]).map(parseSymop);
  const out = [];
  // A grid of the kept atoms for merging copies.
  const grid = new Map();
  const key = (p) => p.map((v) => Math.floor(v / SAME)).join(",");
  const near = (p) => {
    const c = p.map((v) => Math.floor(v / SAME));
    for (let dx = -1; dx <= 1; dx++)
      for (let dy = -1; dy <= 1; dy++)
        for (let dz = -1; dz <= 1; dz++) {
          const g = grid.get(`${c[0] + dx},${c[1] + dy},${c[2] + dz}`);
          if (!g) continue;
          for (const q of g) {
            const d = (q.p[0] - p[0]) ** 2 + (q.p[1] - p[1]) ** 2 + (q.p[2] - p[2]) ** 2;
            if (d < SAME * SAME) return true;
          }
        }
    return false;
  };
  const add = (a, f, R) => {
    const p = apply3(A, f);
    if (near(p)) return;
    const U = turnU(a.U, R);
    const e = ellipsoidOf(U);
    const atom = { ...a, f, p, U, sigma: e.sigma, axes: e.axes, npd: e.npd };
    out.push(atom);
    const k = key(p);
    if (!grid.has(k)) grid.set(k, []);
    grid.get(k).push(atom);
    if (out.length > maxAtoms) throw new Error(`The unit cell has more than ${maxAtoms} atoms.`);
  };
  const inside = (f) => f.every((v, i) => v > -EPS && v < cells[i] + EPS);
  for (const op of ops) {
    const R = mul3(mul3(A, op.W), Ai);
    const fs = s.atoms.map((a) => apply3(op.W, a.f).map((v, i) => v + op.t[i]));
    if (molecular) {
      // The whole asymmetric unit together, its center moved into each cell.
      const c = [0, 1, 2].map((i) => fs.reduce((m, f) => m + f[i], 0) / fs.length);
      const base = c.map((v) => Math.floor(v));
      for (let i = 0; i < cells[0]; i++)
        for (let j = 0; j < cells[1]; j++)
          for (let k = 0; k < cells[2]; k++) {
            const sh = [i - base[0], j - base[1], k - base[2]];
            fs.forEach((f, n) =>
              add(
                s.atoms[n],
                f.map((v, d) => v + sh[d]),
                R,
              ),
            );
          }
    } else {
      fs.forEach((f0, n) => {
        if (s.atoms[n].el === "H") return; // they follow their atoms, below
        const w = f0.map((v) => v - Math.floor(v + 1e-9));
        // The copies on the block's faces, edges and corners too.
        for (let i = -1; i <= cells[0]; i++)
          for (let j = -1; j <= cells[1]; j++)
            for (let k = -1; k <= cells[2]; k++) {
              const f = [w[0] + i, w[1] + j, w[2] + k];
              if (inside(f)) add(s.atoms[n], f, R);
            }
      });
    }
  }
  // A wrapped cell's hydrogens follow their atoms: every copy of a hydrogen
  // within bonding distance (1.25 Å) of a kept atom, inside the block or not.
  if (!molecular && s.atoms.some((a) => a.el === "H")) {
    const heavy = out.slice();
    const hgrid = new Map();
    const cellKey = (p) => p.map((v) => Math.floor(v / 1.3)).join(",");
    for (const a of heavy) {
      const k = cellKey(a.p);
      if (!hgrid.has(k)) hgrid.set(k, []);
      hgrid.get(k).push(a);
    }
    const bonded = (p) => {
      const c = p.map((v) => Math.floor(v / 1.3));
      for (let dx = -1; dx <= 1; dx++)
        for (let dy = -1; dy <= 1; dy++)
          for (let dz = -1; dz <= 1; dz++)
            for (const a of hgrid.get(`${c[0] + dx},${c[1] + dy},${c[2] + dz}`) ?? []) {
              const d = (a.p[0] - p[0]) ** 2 + (a.p[1] - p[1]) ** 2 + (a.p[2] - p[2]) ** 2;
              if (d < 1.25 * 1.25 && d > 0.25) return true;
            }
      return false;
    };
    for (const op of ops) {
      const R = mul3(mul3(A, op.W), Ai);
      s.atoms.forEach((a) => {
        if (a.el !== "H") return;
        const f0 = apply3(op.W, a.f).map((v, i) => v + op.t[i]);
        const w = f0.map((v) => v - Math.floor(v + 1e-9));
        for (let i = -1; i <= cells[0]; i++)
          for (let j = -1; j <= cells[1]; j++)
            for (let k = -1; k <= cells[2]; k++) {
              const f = [w[0] + i, w[1] + j, w[2] + k];
              if (bonded(apply3(A, f))) add(a, f, R);
            }
      });
    }
  }
  const counts = { ...s.counts, atoms: out.length, aniso: out.filter((a) => a.aniso).length };
  counts.iso = counts.atoms - counts.aniso;
  counts.npd = out.filter((a) => a.npd).length;
  const notes = s.notes.filter((n) => !n.startsWith("The asymmetric unit only"));
  const what = cells.every((n) => n === 1) ? "The unit cell" : `A block of ${cells.join(" × ")} unit cells`; // prettier-ignore
  notes.unshift(`${what}: the file's ${s.atoms.length} atoms and their ${ops.length} symmetry copies.`); // prettier-ignore
  return { ...s, atoms: out, counts, notes, edges: cellEdges(A, cells), filled: cells };
}

// A molecule that sits on a symmetry element (urea on a mirror) is listed in
// part: its copies under the space group's operations that bond to the
// listed atoms complete it (as Mercury's "complete molecules" does). Returns
// the structure with the copies added (the same object if none are needed).
export function completeMolecules(structure, { tolerance = 0.45, maxAtoms = 2000 } = {}) {
  const s = structure;
  if (s.format !== "cif" || !s.cellM || !(s.symops?.length > 1)) return s;
  // A network solid or a polymer would grow forever: at most 8 times the listed atoms.
  maxAtoms = Math.min(maxAtoms, s.atoms.length * 8);
  if (s.atoms.length * s.symops.length > 20000) return s;
  const A = s.cellM.A;
  const Ai = inv3(A);
  const ops = s.symops.map(parseSymop);
  // Every copy within a cell of the listed atoms.
  const cand = [];
  for (const op of ops) {
    const R = mul3(mul3(A, op.W), Ai);
    s.atoms.forEach((a) => {
      const f0 = apply3(op.W, a.f).map((v, i) => v + op.t[i]);
      for (let i = -1; i <= 1; i++)
        for (let j = -1; j <= 1; j++)
          for (let k = -1; k <= 1; k++) {
            const f = [f0[0] + i, f0[1] + j, f0[2] + k];
            cand.push({ a, f, R, p: apply3(A, f) });
          }
    });
  }
  const atoms = s.atoms.slice();
  const dist2 = (p, q) => (p[0] - q[0]) ** 2 + (p[1] - q[1]) ** 2 + (p[2] - q[2]) ** 2;
  let grew = true;
  let added = 0;
  while (grew && atoms.length < maxAtoms) {
    grew = false;
    for (const c of cand) {
      if (c.used) continue;
      if (atoms.some((b) => dist2(b.p, c.p) < SAME * SAME)) {
        c.used = true;
        continue;
      }
      const rc = covalentRadius(c.a.el);
      const bonded = atoms.some((b) => {
        const lim = rc + covalentRadius(b.el) + tolerance;
        const d2 = dist2(b.p, c.p);
        return d2 > 0.16 && d2 < lim * lim;
      });
      if (!bonded) continue;
      const U = turnU(c.a.U, c.R);
      const e = ellipsoidOf(U);
      atoms.push({ ...c.a, f: c.f, p: c.p, U, sigma: e.sigma, axes: e.axes, npd: e.npd });
      c.used = true;
      grew = true;
      added++;
    }
  }
  if (!added) return s;
  const counts = { ...s.counts, atoms: atoms.length, aniso: atoms.filter((a) => a.aniso).length };
  counts.iso = counts.atoms - counts.aniso;
  counts.npd = atoms.filter((a) => a.npd).length;
  const notes = s.notes.map((n) =>
    n.startsWith("The asymmetric unit only")
      ? `The file lists part of the molecule; ${added} symmetry copies of its atoms complete it.`
      : n,
  );
  return { ...s, atoms, counts, notes };
}

// Enough cells for a block at least `span` Å along each edge (at most 2).
export function cellsFor(cell, span = 4) {
  return ["a", "b", "c"].map((k) => Math.max(1, Math.min(2, Math.ceil(span / cell[k] - 1e-6))));
}
