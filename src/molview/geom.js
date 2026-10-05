// Lane Molecule viewer: geometry on a parsed structure (src/molview/parse.js):
// turning it to face the viewer, measuring, finding the atom under a tap, and
// the molecular surface.

import { eigenSym3 } from "../science/crystal.js";
import { KIND } from "./parse.js";

// Moves the structure onto its center (the mean of its atoms, waters left
// out) and turns it so its widest spread lies across the screen and its
// flattest toward the viewer. Rotations keep every distance and angle.
// Changes the model in place; records `center` (in the file's coordinates)
// and `axes` (the rows of the turn).
export function orient(m) {
  const { n, x, y, z } = m;
  const use = (i) => m.residues[m.res[i]].kind !== KIND.water;
  let c = [0, 0, 0];
  let k = 0;
  for (let i = 0; i < n; i++)
    if (use(i)) {
      c[0] += x[i];
      c[1] += y[i];
      c[2] += z[i];
      k++;
    }
  if (!k) return m;
  c = c.map((v) => v / k);
  const s = [
    [0, 0, 0],
    [0, 0, 0],
    [0, 0, 0],
  ];
  const step = Math.max(1, Math.floor(k / 50000));
  for (let i = 0; i < n; i += step) {
    if (!use(i)) continue;
    const d = [x[i] - c[0], y[i] - c[1], z[i] - c[2]];
    for (let a = 0; a < 3; a++) for (let b = 0; b < 3; b++) s[a][b] += d[a] * d[b];
  }
  let R = eigenSym3(s).vectors; // rows, largest spread first
  // A proper rotation (no mirror image): the third axis is the cross product.
  const [u, v] = R;
  R = [u, v, [u[1] * v[2] - u[2] * v[1], u[2] * v[0] - u[0] * v[2], u[0] * v[1] - u[1] * v[0]]];
  for (let i = 0; i < n; i++) {
    const d = [x[i] - c[0], y[i] - c[1], z[i] - c[2]];
    x[i] = R[0][0] * d[0] + R[0][1] * d[1] + R[0][2] * d[2];
    y[i] = R[1][0] * d[0] + R[1][1] * d[1] + R[1][2] * d[2];
    z[i] = R[2][0] * d[0] + R[2][1] * d[1] + R[2][2] * d[2];
  }
  m.center = c;
  m.axes = R;
  return m;
}

export const pos = (m, i) => [m.x[i], m.y[i], m.z[i]];

// Distance between atoms i and j, in ångströms.
export function distance(m, i, j) {
  return Math.hypot(m.x[i] - m.x[j], m.y[i] - m.y[j], m.z[i] - m.z[j]);
}

// The angle at atom j between atoms i and k, in degrees.
export function angle(m, i, j, k) {
  const a = [m.x[i] - m.x[j], m.y[i] - m.y[j], m.z[i] - m.z[j]];
  const b = [m.x[k] - m.x[j], m.y[k] - m.y[j], m.z[k] - m.z[j]];
  const dot = a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
  const cross = Math.hypot(
    a[1] * b[2] - a[2] * b[1],
    a[2] * b[0] - a[0] * b[2],
    a[0] * b[1] - a[1] * b[0],
  );
  return (Math.atan2(cross, dot) * 180) / Math.PI;
}

// The shown atom nearest a point (a tap): { atom, d } or null. `shown` is a
// Uint8Array of the atoms drawn.
export function nearestAtom(m, p, shown) {
  let best = -1;
  let bd = Infinity;
  for (let i = 0; i < m.n; i++) {
    if (shown && !shown[i]) continue;
    const dx = m.x[i] - p[0];
    const dy = m.y[i] - p[1];
    const dz = m.z[i] - p[2];
    const d = dx * dx + dy * dy + dz * dz;
    if (d < bd) {
      bd = d;
      best = i;
    }
  }
  return best < 0 ? null : { atom: best, d: Math.sqrt(bd) };
}

// A plain label for an atom: "CA of Ile 7 (chain A)", or "C3" in a small molecule.
const THREE = (s) => (s.length === 3 ? s[0] + s.slice(1).toLowerCase() : s);
export function atomLabel(m, i) {
  const r = m.residues[m.res[i]];
  if (m.format === "sdf" || m.format === "xyz") return `${m.el[i]}${i + 1}`;
  const chain = m.chains[r.chain]?.id;
  return `${m.atomName[i]} of ${THREE(r.name)} ${r.seq}${r.icode}${chain ? ` (chain ${chain})` : ""}`;
}

// ---- The molecular surface ------------------------------------------------------------------

// A blobby (Gaussian) surface over the atoms `use(i)`: each atom adds
// exp(B (1 - d²/R²)) with R its van der Waals radius, so an atom on its own
// has its surface exactly at R; where atoms crowd, the sum fills the gaps
// between them, much as the solvent-excluded surface (a 1.4 Å water probe
// rolled over the atoms) does, but smoother and shallower in deep crevices.
// The density is summed on a grid, and the surface points are where it
// crosses 1 along the grid's edges (the vertices marching cubes would make).
//
// Returns { points: Float32Array (x, y, z), normals: Float32Array, count, h }
// with at most about `max` points (a coarser grid when there would be more).
export const BLOBBY = 1.6;
export function blobbySurface(
  m,
  { radius, use, max = 120000, h: h0 = 0.42, maxVoxels = 3e6 } = {},
) {
  const idx = [];
  for (let i = 0; i < m.n; i++) if (use(i)) idx.push(i);
  if (!idx.length)
    return { points: new Float32Array(0), normals: new Float32Array(0), count: 0, h: h0 };
  const B = BLOBBY;
  const reachOf = (R) => R * Math.sqrt(1 + 5 / B); // where a term falls below e^-5
  let rmax = 0;
  const lo = [Infinity, Infinity, Infinity];
  const hi = [-Infinity, -Infinity, -Infinity];
  for (const i of idx) {
    const r = radius(i);
    rmax = Math.max(rmax, r);
    const p = [m.x[i], m.y[i], m.z[i]];
    for (let a = 0; a < 3; a++) {
      lo[a] = Math.min(lo[a], p[a]);
      hi[a] = Math.max(hi[a], p[a]);
    }
  }
  const pad = reachOf(rmax) + 1;
  const ext = [0, 1, 2].map((a) => hi[a] - lo[a] + 2 * pad);
  // Grid spacing: as fine as asked, within the voxel budget, and coarse
  // enough that the points fit `max` (about 2.2 points per h² of surface).
  let area = 0;
  for (const i of idx) area += 4 * Math.PI * radius(i) ** 2;
  // The exposed area is far less than the atoms' total: about the square of
  // the atom count's cube root, per atom (a sphere's surface over its volume).
  const exposed = area * Math.min(1, 2.2 / Math.cbrt(idx.length));
  const h = Math.max(h0, Math.cbrt((ext[0] * ext[1] * ext[2]) / maxVoxels), Math.sqrt((2.2 * exposed) / max)); // prettier-ignore
  const N = ext.map((e) => Math.max(2, Math.ceil(e / h) + 1));
  const o = [lo[0] - pad, lo[1] - pad, lo[2] - pad];
  const grid = new Float32Array(N[0] * N[1] * N[2]);
  const at = (a, b, c) => (c * N[1] + b) * N[0] + a;
  for (const i of idx) {
    const R = radius(i);
    const reach = reachOf(R);
    const p = [m.x[i], m.y[i], m.z[i]];
    const g0 = p.map((v, a) => Math.max(0, Math.floor((v - reach - o[a]) / h)));
    const g1 = p.map((v, a) => Math.min(N[a] - 1, Math.ceil((v + reach - o[a]) / h)));
    const k = B / (R * R);
    for (let c = g0[2]; c <= g1[2]; c++) {
      const dz = o[2] + c * h - p[2];
      for (let b = g0[1]; b <= g1[1]; b++) {
        const dy = o[1] + b * h - p[1];
        const dyz = dy * dy + dz * dz;
        let row = at(0, b, c);
        for (let a = g0[0]; a <= g1[0]; a++) {
          const dx = o[0] + a * h - p[0];
          const d2 = dx * dx + dyz;
          if (d2 < reach * reach) grid[row + a] += Math.exp(B - k * d2);
        }
      }
    }
  }
  // The gradient by central differences (the normal points out, down the density).
  const grad = (a, b, c) => {
    const g = (aa, bb, cc) => grid[at(Math.max(0, Math.min(N[0] - 1, aa)), Math.max(0, Math.min(N[1] - 1, bb)), Math.max(0, Math.min(N[2] - 1, cc)))]; // prettier-ignore
    return [
      g(a - 1, b, c) - g(a + 1, b, c),
      g(a, b - 1, c) - g(a, b + 1, c),
      g(a, b, c - 1) - g(a, b, c + 1),
    ];
  };
  const pts = [];
  const nrm = [];
  for (let c = 0; c < N[2]; c++)
    for (let b = 0; b < N[1]; b++)
      for (let a = 0; a < N[0]; a++) {
        const v0 = grid[at(a, b, c)];
        const steps = [
          [a + 1, b, c],
          [a, b + 1, c],
          [a, b, c + 1],
        ];
        for (const [a1, b1, c1] of steps) {
          if (a1 >= N[0] || b1 >= N[1] || c1 >= N[2]) continue;
          const v1 = grid[at(a1, b1, c1)];
          if (v0 >= 1 === v1 >= 1) continue;
          const t = (1 - v0) / (v1 - v0);
          pts.push(o[0] + (a + (a1 - a) * t) * h, o[1] + (b + (b1 - b) * t) * h, o[2] + (c + (c1 - c) * t) * h); // prettier-ignore
          const g0 = grad(a, b, c);
          const g1 = grad(a1, b1, c1);
          const g = [0, 1, 2].map((q) => g0[q] + (g1[q] - g0[q]) * t);
          const l = Math.hypot(g[0], g[1], g[2]) || 1;
          nrm.push(g[0] / l, g[1] / l, g[2] / l);
        }
      }
  return { points: Float32Array.from(pts), normals: Float32Array.from(nrm), count: pts.length / 3, h }; // prettier-ignore
}

// ---- The outside atoms ------------------------------------------------------------------------

// The atoms a viewer outside the structure could see: each atom's sphere
// (radius(i) plus half a voxel) is marked on a grid, the empty space joined to
// the grid's edge is flooded, and an atom is "outside" when that space comes
// within a voxel of its sphere. Used when a big structure has more atoms than
// splats to draw them with (the level of detail): the buried ones would never
// show. Returns the atoms kept, in order.
export function outerAtoms(m, atoms, radius, { maxVoxels = 8e6 } = {}) {
  if (!atoms.length) return [];
  const lo = [Infinity, Infinity, Infinity];
  const hi = [-Infinity, -Infinity, -Infinity];
  let rmax = 0;
  for (const i of atoms) {
    const p = [m.x[i], m.y[i], m.z[i]];
    for (let a = 0; a < 3; a++) {
      lo[a] = Math.min(lo[a], p[a]);
      hi[a] = Math.max(hi[a], p[a]);
    }
    rmax = Math.max(rmax, radius(i));
  }
  const pad = rmax + 3;
  const ext = [0, 1, 2].map((a) => hi[a] - lo[a] + 2 * pad);
  const v = Math.max(1.4, Math.cbrt((ext[0] * ext[1] * ext[2]) / maxVoxels));
  const N = ext.map((e) => Math.ceil(e / v) + 1);
  const o = lo.map((x) => x - pad);
  const at = (a, b, c) => (c * N[1] + b) * N[0] + a;
  const grid = new Uint8Array(N[0] * N[1] * N[2]); // 1 inside a sphere, 2 outside
  const cells = (i, extra, f) => {
    const r = radius(i) + extra;
    const p = [m.x[i], m.y[i], m.z[i]];
    const g0 = p.map((x, a) => Math.max(0, Math.floor((x - r - o[a]) / v)));
    const g1 = p.map((x, a) => Math.min(N[a] - 1, Math.ceil((x + r - o[a]) / v)));
    for (let c = g0[2]; c <= g1[2]; c++)
      for (let b = g0[1]; b <= g1[1]; b++)
        for (let a = g0[0]; a <= g1[0]; a++) {
          const dx = o[0] + a * v - p[0];
          const dy = o[1] + b * v - p[1];
          const dz = o[2] + c * v - p[2];
          if (dx * dx + dy * dy + dz * dz <= r * r) if (f(at(a, b, c))) return true;
        }
    return false;
  };
  for (const i of atoms)
    cells(i, v * 0.5, (k) => {
      grid[k] = 1;
      return false;
    });
  // Flood the empty space from the grid's corner (the padding is all empty).
  const queue = new Int32Array(grid.length);
  let head = 0;
  let tail = 0;
  grid[0] = 2;
  queue[tail++] = 0;
  const NX = N[0];
  const NXY = N[0] * N[1];
  while (head < tail) {
    const k = queue[head++];
    const a = k % NX;
    const b = Math.floor(k / NX) % N[1];
    const c = Math.floor(k / NXY);
    const visit = (q) => {
      if (grid[q] === 0) {
        grid[q] = 2;
        queue[tail++] = q;
      }
    };
    if (a > 0) visit(k - 1);
    if (a < N[0] - 1) visit(k + 1);
    if (b > 0) visit(k - NX);
    if (b < N[1] - 1) visit(k + NX);
    if (c > 0) visit(k - NXY);
    if (c < N[2] - 1) visit(k + NXY);
  }
  return atoms.filter((i) => cells(i, v * 1.5, (k) => grid[k] === 2));
}
