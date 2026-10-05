// Lane Molecule viewer: turns a structure (src/molview/parse.js) into splats.
// Everything is drawn as explicit splats (position, three sizes in ångströms,
// a turn and a color) into a SplatList, which the recipe hands to the kit as
// one cloud. Sizes follow a budget, so a big structure gets fewer splats per
// atom and, past a point, one Gaussian per atom (the level of detail).

import { ribbonPath } from "../chem/protein.js";
import { KIND } from "./parse.js";
import { vdwRadius, cpk } from "./radii.js";
import { blobbySurface } from "./geom.js";

const TAU = Math.PI * 2;
const GOLDEN = Math.PI * (3 - Math.sqrt(5));

// ---- A growable list of splats -------------------------------------------------------------

export class SplatList {
  constructor(cap = 4096) {
    this.n = 0;
    this.alloc(cap);
  }
  alloc(cap) {
    const g = (old, k) => {
      const t = new Float32Array(cap * k);
      if (old) t.set(old.subarray(0, this.n * k));
      return t;
    };
    this.p = g(this.p, 3);
    this.s = g(this.s, 3);
    this.q = g(this.q, 4);
    this.c = g(this.c, 3);
    this.cap = cap;
  }
  push(p, s, q, c) {
    if (this.n >= this.cap) this.alloc(this.cap * 2);
    const i = this.n++;
    this.p.set(p, i * 3);
    this.s.set(s, i * 3);
    this.q.set(q, i * 4);
    this.c.set(c, i * 3);
    return i;
  }
  // The kit's sample for splat i (fresh small arrays: the kit keeps none).
  sample(i, extra) {
    if (i >= this.n) return null;
    return {
      p: [this.p[i * 3], this.p[i * 3 + 1], this.p[i * 3 + 2]],
      scales: [this.s[i * 3], this.s[i * 3 + 1], this.s[i * 3 + 2]],
      quat: [this.q[i * 4], this.q[i * 4 + 1], this.q[i * 4 + 2], this.q[i * 4 + 3]],
      color: [this.c[i * 3], this.c[i * 3 + 1], this.c[i * 3 + 2]],
      opacity: 1,
      jitter: 0,
      ...extra,
    };
  }
}

// ---- Small vector and turn helpers ------------------------------------------------------------

const sub = (a, b) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
const add = (a, b) => [a[0] + b[0], a[1] + b[1], a[2] + b[2]];
const mul = (a, k) => [a[0] * k, a[1] * k, a[2] * k];
const dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
const cross = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]]; // prettier-ignore
const len = (a) => Math.hypot(a[0], a[1], a[2]);
const unit = (a) => {
  const l = len(a) || 1;
  return [a[0] / l, a[1] / l, a[2] / l];
};
const across = (t) => unit(cross(t, Math.abs(t[0]) < 0.9 ? [1, 0, 0] : [0, 1, 0]));

// The turn whose columns are the right-handed frame (x, y, z).
export function quatOf(x, y, z) {
  const tr = x[0] + y[1] + z[2];
  let q;
  if (tr > 0) {
    const s = Math.sqrt(tr + 1) * 2;
    q = [(y[2] - z[1]) / s, (z[0] - x[2]) / s, (x[1] - y[0]) / s, s / 4];
  } else if (x[0] > y[1] && x[0] > z[2]) {
    const s = Math.sqrt(1 + x[0] - y[1] - z[2]) * 2;
    q = [s / 4, (y[0] + x[1]) / s, (z[0] + x[2]) / s, (y[2] - z[1]) / s];
  } else if (y[1] > z[2]) {
    const s = Math.sqrt(1 + y[1] - x[0] - z[2]) * 2;
    q = [(y[0] + x[1]) / s, s / 4, (z[1] + y[2]) / s, (z[0] - x[2]) / s];
  } else {
    const s = Math.sqrt(1 + z[2] - x[0] - y[1]) * 2;
    q = [(z[0] + x[2]) / s, (z[1] + y[2]) / s, s / 4, (x[1] - y[0]) / s];
  }
  const l = Math.hypot(q[0], q[1], q[2], q[3]) || 1;
  return [q[0] / l, q[1] / l, q[2] / l, q[3] / l];
}
// A disc facing n.
const discQuat = (n) => {
  const a = across(n);
  return quatOf(a, cross(n, a), n);
};
// A splat stretched along d (its x axis).
const alongQuat = (d) => {
  const y = across(d);
  return quatOf(d, y, cross(d, y));
};

// ---- Light ------------------------------------------------------------------------------------

// Splats are unlit, so a soft studio light is baked into the colors: a key
// light from the upper left and front, and a little gloss.
const LIGHT = unit([-0.4, 0.75, 0.55]);
const HALF = unit(add(LIGHT, [0, 0, 1]));
export function lit(c, n, gloss = 0.3) {
  const d = dot(n, LIGHT);
  const k = 0.5 + 0.55 * Math.max(0, d) + 0.08 * d;
  const g = gloss * Math.max(0, dot(n, HALF)) ** 22;
  return [Math.min(1, c[0] * k + g), Math.min(1, c[1] * k + g), Math.min(1, c[2] * k + g)];
}

// ---- Colors -----------------------------------------------------------------------------------

const hex = (h) => [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16) / 255);
// prettier-ignore
export const CHAIN_COLORS = ["#4f8cff", "#ff8a3d", "#3fc46f", "#e8559a", "#a678ff", "#f2c230", "#2fc4d6", "#e2574c", "#8fd14f", "#ff9ecf", "#5f6fe8", "#d9a066"].map(hex);
// Residue types: the "Shapely" colors (as in RasMol and Jmol), the darkest
// lifted a little so they read on the dark stage.
// prettier-ignore
const SHAPELY = {
  ALA: "#8cff8c", ARG: "#3c3cb4", ASN: "#ff7c70", ASP: "#c0305a", CYS: "#ffff70", GLN: "#ff4c4c",
  GLU: "#a03030", GLY: "#ffffff", HIS: "#7070ff", ILE: "#2f7a2f", LEU: "#5f7f5f", LYS: "#4747b8",
  MET: "#b8a042", PHE: "#7a707a", PRO: "#808080", SER: "#ff7042", THR: "#b84c00", TRP: "#7a6c20",
  TYR: "#8c704c", VAL: "#ff8cff",
  A: "#a0a0ff", DA: "#a0a0ff", C: "#ff8c4b", DC: "#ff8c4b", G: "#ff7070", DG: "#ff7070",
  T: "#a0ffa0", DT: "#a0ffa0", U: "#ff8080", DU: "#ff8080",
};
const SHAPELY_RGB = Object.fromEntries(Object.entries(SHAPELY).map(([k, v]) => [k, hex(v)]));
const OTHER = hex("#c8a0c8");
export const residueColor = (name) => SHAPELY_RGB[name] ?? OTHER;

const B_STOPS = ["#3b4cc0", "#8db0fe", "#dddddd", "#f49a7b", "#d6334a"].map(hex);
function rampB(t) {
  const x = Math.max(0, Math.min(1, t)) * (B_STOPS.length - 1);
  const i = Math.min(B_STOPS.length - 2, Math.floor(x));
  const f = x - i;
  return [0, 1, 2].map((k) => B_STOPS[i][k] + (B_STOPS[i + 1][k] - B_STOPS[i][k]) * f);
}

// The 5th and 95th percentiles of the B-factors of the atoms `use(i)`.
export function bRange(m, use) {
  const v = [];
  const step = Math.max(1, Math.floor(m.n / 40000));
  for (let i = 0; i < m.n; i += step) if (use(i)) v.push(m.b[i]);
  if (!v.length) return [0, 1];
  v.sort((a, b) => a - b);
  const lo = v[Math.floor(v.length * 0.05)];
  const hi = v[Math.floor(v.length * 0.95)];
  return hi > lo ? [lo, hi] : [lo, lo + 1];
}

// A color function for atoms by scheme: element, chain, residue or B-factor.
// Ligands and ions keep their element colors under chain and residue.
export function colorer(m, scheme, use) {
  if (scheme === "bfactor" && m.hasB) {
    const [lo, hi] = bRange(m, use);
    return (i) => rampB((m.b[i] - lo) / (hi - lo));
  }
  if (scheme === "bfactor") return () => [0.62, 0.64, 0.68];
  if (scheme === "chain")
    return (i) => {
      const r = m.residues[m.res[i]];
      return r.kind === KIND.other || r.kind === KIND.water
        ? cpk(m.el[i])
        : CHAIN_COLORS[r.chain % CHAIN_COLORS.length];
    };
  if (scheme === "residue")
    return (i) => {
      const r = m.residues[m.res[i]];
      return r.kind === KIND.amino || r.kind === KIND.nucleic ? residueColor(r.name) : cpk(m.el[i]); // prettier-ignore
    };
  return (i) => cpk(m.el[i]);
}

// ---- Atoms ------------------------------------------------------------------------------------

// A grid of atoms for "is this point inside another atom?" (spacefill culls
// the splats buried where spheres overlap).
function atomGrid(m, atoms, radius) {
  let rmax = 0;
  for (const i of atoms) rmax = Math.max(rmax, radius(i));
  const cell = Math.max(1, 2 * rmax);
  const map = new Map();
  const key = (a, b, c) => ((a + 1024) * 2048 + (b + 1024)) * 2048 + (c + 1024);
  for (const i of atoms) {
    const k = key(Math.floor(m.x[i] / cell), Math.floor(m.y[i] / cell), Math.floor(m.z[i] / cell));
    let list = map.get(k);
    if (!list) map.set(k, (list = []));
    list.push(i);
  }
  return {
    // Calls f(j) for every atom in the cells round p.
    each(p, f) {
      const a = Math.floor(p[0] / cell);
      const b = Math.floor(p[1] / cell);
      const c = Math.floor(p[2] / cell);
      for (let dx = -1; dx <= 1; dx++)
        for (let dy = -1; dy <= 1; dy++)
          for (let dz = -1; dz <= 1; dz++) {
            const list = map.get(key(a + dx, b + dy, c + dz));
            if (list) for (const j of list) f(j);
          }
    },
    // True when p lies inside an atom other than `self`.
    buried(p, self) {
      const a = Math.floor(p[0] / cell);
      const b = Math.floor(p[1] / cell);
      const c = Math.floor(p[2] / cell);
      for (let dx = -1; dx <= 1; dx++)
        for (let dy = -1; dy <= 1; dy++)
          for (let dz = -1; dz <= 1; dz++) {
            const list = map.get(key(a + dx, b + dy, c + dz));
            if (!list) continue;
            for (const j of list) {
              if (j === self) continue;
              const r = radius(j);
              const ex = p[0] - m.x[j];
              const ey = p[1] - m.y[j];
              const ez = p[2] - m.z[j];
              if (ex * ex + ey * ey + ez * ez < r * r * 0.995) return true;
            }
          }
      return false;
    },
    // The nearest atom to p, among these (for coloring a surface point).
    nearest(p) {
      const a = Math.floor(p[0] / cell);
      const b = Math.floor(p[1] / cell);
      const c = Math.floor(p[2] / cell);
      let best = -1;
      let bd = Infinity;
      for (let reach = 1; reach <= 3 && best < 0; reach++)
        for (let dx = -reach; dx <= reach; dx++)
          for (let dy = -reach; dy <= reach; dy++)
            for (let dz = -reach; dz <= reach; dz++) {
              const list = map.get(key(a + dx, b + dy, c + dz));
              if (!list) continue;
              for (const j of list) {
                const ex = p[0] - m.x[j];
                const ey = p[1] - m.y[j];
                const ez = p[2] - m.z[j];
                // Measured from the atom's own surface, so a big atom wins its patch.
                const d = Math.sqrt(ex * ex + ey * ey + ez * ez) - radius(j);
                if (d < bd) {
                  bd = d;
                  best = j;
                }
              }
            }
      return best;
    },
  };
}

// Points spread evenly over a unit sphere (a Fibonacci lattice), turned by
// `spin` so neighboring atoms don't line their patterns up.
function spherePoints(count, spin) {
  const out = [];
  const cs = Math.cos(spin);
  const sn = Math.sin(spin);
  for (let k = 0; k < count; k++) {
    const y = 1 - (2 * (k + 0.5)) / count;
    const r = Math.sqrt(Math.max(0, 1 - y * y));
    const a = k * GOLDEN + spin * 7;
    const x = Math.cos(a) * r;
    const z = Math.sin(a) * r;
    // A tilt about x by `spin`, so the poles don't all point up.
    out.push([x, y * cs - z * sn, y * sn + z * cs]);
  }
  return out;
}

// Draws atoms as solid spheres of radius radius(i), `density` splats per Å²
// of sphere. Below about six splats an atom becomes one round Gaussian (the
// level of detail). With `cull`, splats buried inside a neighbor are left out
// and the saved budget goes to the exposed ones.
export function drawAtoms(L, m, atoms, { radius, color, density, budget = 0, cull = false, rand }) {
  // Spacefill: each atom's overlapping neighbors, so a splat buried inside
  // one of them can be left out.
  const near = cull ? neighbors(m, atoms, radius) : null;
  const buried = (p, i) => {
    for (const j of near[i]) {
      const r = radius(j);
      const ex = p[0] - m.x[j];
      const ey = p[1] - m.y[j];
      const ez = p[2] - m.z[j];
      if (ex * ex + ey * ey + ez * ez < r * r * 0.995) return true;
    }
    return false;
  };
  // Exposed share of each atom (spacefill): from a quick look at 24 points.
  const exposed = new Float32Array(atoms.length).fill(1);
  if (near) {
    const probe = spherePoints(24, 0.7);
    atoms.forEach((i, k) => {
      const r = radius(i);
      let out = 0;
      for (const d of probe) if (!buried([m.x[i] + d[0] * r, m.y[i] + d[1] * r, m.z[i] + d[2] * r], i)) out++; // prettier-ignore
      exposed[k] = out / probe.length;
    });
  }
  // With a budget instead of a density (spacefill), the density is what the
  // exposed area allows.
  if (budget) {
    let area = 0;
    atoms.forEach((i, k) => (area += 4 * Math.PI * radius(i) ** 2 * exposed[k]));
    density = Math.min(density ?? Infinity, budget / Math.max(1, area));
  }
  let single = 0;
  atoms.forEach((i, k) => {
    if (exposed[k] === 0) return;
    const r = radius(i);
    const area = 4 * Math.PI * r * r;
    const want = area * density * exposed[k];
    const c = color(i);
    const at = [m.x[i], m.y[i], m.z[i]];
    if (want < 6) {
      // One Gaussian for the whole atom: lit from its front.
      L.push(at, [0.62 * r, 0.62 * r, 0.62 * r], [0, 0, 0, 1], lit(c, unit([-0.2, 0.3, 1]), 0.15));
      single++;
      return;
    }
    // Over the whole sphere, so the buried ones can be dropped.
    const total = Math.round(want / exposed[k]);
    const sz = 1.25 * Math.sqrt(area / (total * Math.PI));
    for (const d of spherePoints(total, rand() * TAU)) {
      const p = [at[0] + d[0] * r, at[1] + d[1] * r, at[2] + d[2] * r];
      if (near && buried(p, i)) continue;
      L.push(p, [sz, sz, sz * 0.3], discQuat(d), lit(c, d));
    }
  });
  return { single };
}

// For each atom (indexed by atom number), the atoms whose spheres overlap it.
function neighbors(m, atoms, radius) {
  const grid = atomGrid(m, atoms, radius);
  const list = [];
  for (const i of atoms) {
    const near = [];
    grid.each([m.x[i], m.y[i], m.z[i]], (j) => {
      if (j === i) return;
      const lim = radius(i) + radius(j);
      const ex = m.x[i] - m.x[j];
      const ey = m.y[i] - m.y[j];
      const ez = m.z[i] - m.z[j];
      if (ex * ex + ey * ey + ez * ez < lim * lim) near.push(j);
    });
    list[i] = near;
  }
  return list;
}

// ---- Bonds ------------------------------------------------------------------------------------

// Draws bonds as sticks of radius `stick`, each half in its atom's color, from
// the edge of one ball to the edge of the other. A double bond is two thinner
// sticks side by side, a triple three, and an aromatic bond one stick with a
// dashed thin one beside it. `density` splats per Å² of stick; too few and
// each half becomes one stretched Gaussian (`whole`: one for the whole bond).
export function drawBonds(L, m, bonds, { stick, color, density, ball = () => 0, whole = false }) {
  let single = 0;
  for (const [i, j, order] of bonds) {
    const a = [m.x[i], m.y[i], m.z[i]];
    const b = [m.x[j], m.y[j], m.z[j]];
    const d = sub(b, a);
    const full = len(d);
    if (full < 1e-3) continue;
    const t = mul(d, 1 / full);
    // A side direction for multiple bonds: in the plane of a neighbor, if any.
    const side = across(t);
    const ci = color(i);
    const cj = color(j);
    if (whole) {
      // The level of detail's last step before no sticks: one Gaussian per bond.
      const c = [0, 1, 2].map((q) => (ci[q] + cj[q]) / 2);
      L.push(add(a, mul(t, full / 2)), [full * 0.3, stick * 0.8, stick * 0.8], alongQuat(t), lit(c, unit([-0.2, 0.3, 1]), 0.1)); // prettier-ignore
      single++;
      continue;
    }
    const lines =
      order === 2
        ? [
            [-1, 0.55, false],
            [1, 0.55, false],
          ]
        : order === 3
          ? [
              [-1.6, 0.45, false],
              [0, 0.45, false],
              [1.6, 0.45, false],
            ]
          : order === 4
            ? [
                [-0.7, 0.75, false],
                [1.2, 0.4, true],
              ]
            : [[0, 1, false]];
    for (const [off, thick, dashed] of lines) {
      const r = stick * thick;
      const shift = mul(side, off * stick * 1.15);
      const s0 = ball(i) * 0.8;
      const s1 = full - ball(j) * 0.8;
      if (s1 <= s0) continue;
      const lenS = s1 - s0;
      const area = TAU * r * lenS;
      const want = area * density;
      if (want < 8) {
        for (const [half, c] of [
          [0, ci],
          [1, cj],
        ]) {
          const mid = add(add(a, shift), mul(t, s0 + lenS * (0.25 + 0.5 * half)));
          L.push(mid, [lenS * 0.3, r * 0.8, r * 0.8], alongQuat(t), lit(c, unit([-0.2, 0.3, 1]), 0.1)); // prettier-ignore
          single++;
        }
        continue;
      }
      const around = Math.max(5, Math.round(Math.sqrt((want * TAU * r) / lenS)));
      const rows = Math.max(2, Math.round(want / around));
      const step = lenS / rows;
      const w = (TAU * r) / around;
      const u = side;
      const v = cross(t, u);
      for (let k = 0; k < rows; k++) {
        const along = s0 + (k + 0.5) * step;
        if (dashed && Math.floor(k / Math.max(1, Math.round(0.18 / step))) % 2) continue;
        const c = along < full / 2 ? ci : cj;
        for (let q = 0; q < around; q++) {
          const ang = ((q + 0.5 * (k % 2)) / around) * TAU;
          const n = add(mul(u, Math.cos(ang)), mul(v, Math.sin(ang)));
          const p = add(add(a, shift), add(mul(t, along), mul(n, r)));
          L.push(p, [step * 0.75, w * 0.7, Math.min(step, w) * 0.25], quatOf(t, cross(n, t), n), lit(c, n, 0.2)); // prettier-ignore
        }
      }
    }
  }
  return { single };
}

// ---- Cartoon ----------------------------------------------------------------------------------

// Residues of a chain of one kind, split where the chain breaks.
function chainRuns(m, kind) {
  const out = new Map();
  m.residues.forEach((r, ri) => {
    if (r.kind !== kind) return;
    if (!out.has(r.chain)) out.set(r.chain, []);
    out.get(r.chain).push(ri);
  });
  return [...out.values()];
}

const atomIn = (m, r, name) => {
  for (let i = r.start; i < r.end; i++) if (m.atomName[i] === name) return i;
  return -1;
};

// The cross section of the ribbon at a path point: a wide, thin band for a
// helix, a flat arrow for a strand (narrowing to a point over its last
// residue), and a round tube for a coil. Sizes in ångströms.
function section(ss, left) {
  if (ss === "H") return [1.3, 0.3];
  if (ss === "E") return left < 1 ? [0.35 + left * 1.6, 0.3] : [1.05, 0.3];
  return [0.35, 0.35];
}

// Draws protein chains as a cartoon (src/chem/protein.js's ribbonPath through
// the CA atoms) and nucleic acids as a tube through their phosphates with a
// rung into each base. `colorRes(ri, t, rung)` colors residue ri, t along its chain
// (rung: true for a base's rung).
// Returns the count of splats and the backbone atoms (for taps).
export function drawCartoon(L, m, { colorRes, density, rand }) {
  const backbone = [];
  // Proteins.
  for (const run of chainRuns(m, KIND.amino)) {
    const chain = {
      residues: run.map((ri) => {
        const r = m.residues[ri];
        const atoms = [];
        for (const name of ["CA", "C", "O", "N"]) {
          const i = atomIn(m, r, name);
          if (i >= 0) atoms.push({ name, p: [m.x[i], m.y[i], m.z[i]] });
          if (name === "CA" && i >= 0) backbone.push(i);
        }
        return { atoms, ss: r.ss, ri };
      }),
    };
    if (chain.residues.filter((r) => r.atoms.some((a) => a.name === "CA")).length < 2) continue;
    // Path points per residue step (3.8 Å): enough for the budget, at least 3.
    let per = Math.max(1, Math.min(16, Math.round(Math.sqrt(density) * 3.8)));
    // Too few splats for rings round the ribbon (a big structure): one flat
    // Gaussian per path point, as many points per residue as the budget allows.
    const single = 4 * (3.8 / per) * density < 5;
    if (single) per = Math.max(1, Math.min(8, Math.round(density * 19.8)));
    const pts = ribbonPath(chain, { perResidue: per });
    // How far each point is from the end of its strand (in residues), for the arrowheads.
    const left = new Float32Array(pts.length).fill(9);
    for (let k = pts.length - 1, seen = Infinity; k >= 0; k--) {
      if (pts[k].ss !== "E") {
        seen = Infinity;
        continue;
      }
      if (seen === Infinity || pts[k + 1]?.res === undefined || pts[k + 1]?.ss !== "E" || pts[k + 1]?.seg !== pts[k].seg) seen = k; // prettier-ignore
      left[k] = (seen - k) / per;
    }
    const n = run.length;
    pts.forEach((pt, k) => {
      const [w, h] = section(pt.ss, left[k]);
      const next = pts[k + 1]?.seg === pt.seg ? pts[k + 1] : pts[k - 1];
      const stepLen = next ? len(sub(next.p, pt.p)) : 3.8 / per;
      const perim = Math.PI * (w + h) * 1.1;
      const ring = Math.min(72, Math.round(perim * stepLen * density));
      const resIndex = chain.residues[pt.res].ri;
      const c = colorRes(resIndex, pt.res / Math.max(1, n - 1));
      if (single || ring < 5) {
        // The level of detail: one flat Gaussian across the ribbon here.
        L.push(pt.p, [stepLen * 0.7, w * 0.75, h * 0.75], quatOf(pt.t, pt.side, pt.normal), lit(c, pt.normal ?? [0, 0, 1], 0.2)); // prettier-ignore
        return;
      }
      const seam = rand() * TAU;
      for (let q = 0; q < ring; q++) {
        const ang = seam + (q / ring) * TAU;
        const cs = Math.cos(ang);
        const sn = Math.sin(ang);
        const p = add(pt.p, add(mul(pt.side, cs * w), mul(pt.normal, sn * h)));
        // Outward normal of the ellipse.
        const nrm = unit(add(mul(pt.side, cs * h), mul(pt.normal, sn * w)));
        const arc = perim / ring;
        L.push(p, [stepLen * 0.85, arc * 0.75, Math.min(arc, stepLen) * 0.3], quatOf(pt.t, cross(nrm, pt.t), nrm), lit(c, nrm, 0.35)); // prettier-ignore
      }
    });
  }
  // Nucleic acids: a tube through the phosphates (or C4' atoms) and a rung
  // from the backbone into each base.
  for (const run of chainRuns(m, KIND.nucleic)) {
    const guide = [];
    for (const ri of run) {
      const r = m.residues[ri];
      let i = atomIn(m, r, "P");
      if (i < 0) i = atomIn(m, r, "C4'");
      if (i < 0) continue;
      backbone.push(i);
      guide.push({ ri, p: [m.x[i], m.y[i], m.z[i]] });
    }
    const n = run.length;
    // Splits where the chain breaks (phosphates more than 8 Å apart).
    const segs = [];
    guide.forEach((g, k) => {
      if (!k || len(sub(g.p, guide[k - 1].p)) > 8) segs.push([]);
      segs[segs.length - 1].push(g);
    });
    for (const seg of segs) {
      const P = seg.map((g) => g.p);
      const at = (k) => P[Math.max(0, Math.min(P.length - 1, k))];
      const R = 0.9;
      let steps = Math.max(1, Math.min(12, Math.round(Math.sqrt(density) * 6)));
      const single = TAU * R * (6.5 / steps) * density < 5;
      if (single) steps = Math.max(1, Math.min(8, Math.round(density * 30)));
      for (let k = 0; k < P.length - 1 || (P.length === 1 && k === 0); k++) {
        for (let s = 0; s < steps; s++) {
          const u = s / steps;
          const [p0, p1, p2, p3] = [at(k - 1), at(k), at(k + 1), at(k + 2)];
          const p = [0, 1, 2].map((c) => 0.5 * (2 * p1[c] + (p2[c] - p0[c]) * u + (2 * p0[c] - 5 * p1[c] + 4 * p2[c] - p3[c]) * u * u + (-p0[c] + 3 * p1[c] - 3 * p2[c] + p3[c]) * u * u * u)); // prettier-ignore
          const tan = unit([0, 1, 2].map((c) => 0.5 * (p2[c] - p0[c] + 2 * (2 * p0[c] - 5 * p1[c] + 4 * p2[c] - p3[c]) * u + 3 * (-p0[c] + 3 * p1[c] - 3 * p2[c] + p3[c]) * u * u))); // prettier-ignore
          const stepLen = len(sub(p2, p1)) / steps || 0.5;
          const ring = Math.min(24, Math.round(TAU * R * stepLen * density));
          const sd = across(tan);
          const nd = cross(tan, sd);
          const ri = seg[u < 0.5 ? k : Math.min(k + 1, seg.length - 1)].ri;
          const c = colorRes(ri, run.indexOf(ri) / Math.max(1, n - 1), false);
          if (single || ring < 5) {
            L.push(p, [stepLen * 0.7, R * 0.75, R * 0.75], alongQuat(tan), lit(c, nd, 0.2));
            continue;
          }
          for (let q = 0; q < ring; q++) {
            const ang = (q / ring) * TAU + s * 0.4;
            const nrm = add(mul(sd, Math.cos(ang)), mul(nd, Math.sin(ang)));
            const arc = (TAU * R) / ring;
            L.push(add(p, mul(nrm, R)), [stepLen * 0.85, arc * 0.75, Math.min(arc, stepLen) * 0.3], quatOf(tan, cross(nrm, tan), nrm), lit(c, nrm, 0.35)); // prettier-ignore
          }
        }
      }
    }
    // Rungs: from the sugar's C3' (or the backbone) to the base's N1
    // (purines, A and G) or N3 (pyrimidines, C, T and U), as a slim plank.
    for (const ri of run) {
      const r = m.residues[ri];
      const purine = /G|A|I/.test(r.name.replace(/^D/, ""));
      const from = atomIn(m, r, "C3'") >= 0 ? atomIn(m, r, "C3'") : atomIn(m, r, "C4'");
      const to = atomIn(m, r, purine ? "N1" : "N3");
      if (from < 0 || to < 0) continue;
      const a = [m.x[from], m.y[from], m.z[from]];
      const b = [m.x[to], m.y[to], m.z[to]];
      const d = sub(b, a);
      const l = len(d);
      if (l < 0.5) continue;
      const t = mul(d, 1 / l);
      const c = colorRes(ri, run.indexOf(ri) / Math.max(1, n - 1), true);
      const rr = 0.55;
      const around = Math.min(18, Math.round(TAU * rr * Math.sqrt(density) * 1.2));
      const rows = Math.max(1, Math.round(l * Math.sqrt(density) * 1.2));
      if (around < 5) {
        L.push(add(a, mul(t, l / 2)), [l * 0.4, rr * 0.75, rr * 0.75], alongQuat(t), lit(c, unit([-0.2, 0.3, 1]), 0.2)); // prettier-ignore
        continue;
      }
      const u0 = across(t);
      const v0 = cross(t, u0);
      for (let k = 0; k <= rows; k++)
        for (let q = 0; q < around; q++) {
          const ang = ((q + 0.5 * (k % 2)) / around) * TAU;
          const nrm = add(mul(u0, Math.cos(ang)), mul(v0, Math.sin(ang)));
          const arc = (TAU * rr) / around;
          L.push(add(a, add(mul(t, (l * k) / rows), mul(nrm, rr))), [(l / rows) * 0.8, arc * 0.75, arc * 0.3], quatOf(t, cross(nrm, t), nrm), lit(c, nrm, 0.25)); // prettier-ignore
        }
    }
  }
  return { backbone };
}

// ---- Surface ------------------------------------------------------------------------------------

// Draws the blobby surface (src/molview/geom.js) of the atoms `use(i)`, each
// point colored by the atom under it. At most `max` splats.
export function drawSurface(L, m, { use, color, max, rand }) {
  const atoms = [];
  for (let i = 0; i < m.n; i++) if (use(i)) atoms.push(i);
  const surf = blobbySurface(m, { radius: (i) => vdwRadius(m.el[i]), use, max });
  const grid = atomGrid(m, atoms, (i) => vdwRadius(m.el[i]));
  const keep = Math.min(1, max / Math.max(1, surf.count));
  const sz = surf.h * 0.62 * Math.sqrt(1 / keep);
  let drawn = 0;
  for (let k = 0; k < surf.count; k++) {
    if (keep < 1 && rand() > keep) continue;
    const p = [surf.points[k * 3], surf.points[k * 3 + 1], surf.points[k * 3 + 2]];
    const n = [surf.normals[k * 3], surf.normals[k * 3 + 1], surf.normals[k * 3 + 2]];
    const j = grid.nearest(p);
    const c = j >= 0 ? color(j) : [0.8, 0.8, 0.8];
    L.push(p, [sz, sz, sz * 0.3], discQuat(n), lit(c, n, 0.25));
    drawn++;
  }
  return { points: surf.count, drawn, h: surf.h };
}

// ---- Measuring marks ----------------------------------------------------------------------------

// A marker round a picked atom: three rings at right angles (it reads from
// any side), radius R, drawn at the origin (the recipe moves it as a token).
export function markerSplats(R, color) {
  const out = [];
  const ringN = Math.max(24, Math.round((TAU * R) / 0.08));
  const w = (TAU * R) / ringN;
  const axes = [
    [1, 0, 0],
    [0, 1, 0],
    [0, 0, 1],
  ];
  for (const ax of axes) {
    const u = across(ax);
    const v = cross(ax, u);
    for (let q = 0; q < ringN; q++) {
      const a = (q / ringN) * TAU;
      const n = add(mul(u, Math.cos(a)), mul(v, Math.sin(a)));
      const tan = cross(ax, n);
      out.push({ p: mul(n, R), scales: [w * 0.9, R * 0.06, R * 0.06], quat: alongQuat(tan), color, opacity: 1, jitter: 0 }); // prettier-ignore
    }
  }
  return out;
}

// One bead of a measuring line or arc: a small solid ball of radius r at the
// origin (lit like the atoms, so it reads as a crisp dot, not a haze).
export function beadSplats(r, color) {
  const n = 36;
  const sz = 1.3 * Math.sqrt((4 * Math.PI * r * r) / (n * Math.PI));
  return spherePoints(n, 0.3).map((d) => ({
    p: mul(d, r),
    scales: [sz, sz, sz * 0.35],
    quat: discQuat(d),
    color: lit(color, d, 0.4),
    opacity: 1,
    jitter: 0,
  }));
}
