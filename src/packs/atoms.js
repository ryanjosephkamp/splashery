// Atoms and chemistry pack: electron orbitals, Bohr atoms, molecules and
// crystal lattices. Stylised, but built from real shapes and numbers.
// Loaded on demand.

import { mix, shade, clamp, quatFromTo, quatAxisAngle, quatRotate } from "../kit.js";

const TAU = Math.PI * 2;
const PHI = (1 + Math.sqrt(5)) / 2;

// ---- Small vector helpers -------------------------------------------------------

const add = (a, b) => [a[0] + b[0], a[1] + b[1], a[2] + b[2]];
const sub = (a, b) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
const mul = (a, s) => [a[0] * s, a[1] * s, a[2] * s];
const dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
const cross = (a, b) => [
  a[1] * b[2] - a[2] * b[1],
  a[2] * b[0] - a[0] * b[2],
  a[0] * b[1] - a[1] * b[0],
];
const len = (a) => Math.hypot(a[0], a[1], a[2]);
const unit = (a) => mul(a, 1 / (len(a) || 1));
const lerp = (a, b, t) => add(a, mul(sub(b, a), t));

// Fake lighting (splats are unlit): a key light from the upper left front and
// a highlight towards the default camera.
const LIGHT = unit([-0.45, 0.8, 0.45]);
const VIEW = unit([0.5, 0.3, 0.82]);
const HALF = unit(add(LIGHT, VIEW));
const lit = (col, n, amb = 0.62, k = 0.45) => shade(col, amb + k * Math.max(0, dot(n, LIGHT)));
const gloss = (col, n, amt = 0.45, pow = 18) =>
  mix(col, "#ffffff", amt * Math.pow(Math.max(0, dot(n, HALF)), pow));
const shiny = (col, n, amt = 0.5) => gloss(lit(col, n), n, amt);

function randDir(rand) {
  const z = rand() * 2 - 1;
  const a = rand() * TAU;
  const r = Math.sqrt(1 - z * z);
  return [r * Math.cos(a), z, r * Math.sin(a)];
}

function basis(d) {
  const a = Math.abs(d[1]) < 0.9 ? [0, 1, 0] : [1, 0, 0];
  const e1 = unit(cross(d, a));
  return [e1, cross(d, e1)];
}

// A standard normal random number.
function gauss(rand) {
  return Math.sqrt(-2 * Math.log(1 - rand())) * Math.cos(TAU * rand());
}

// ---- Orbitals --------------------------------------------------------------------
// Hydrogen-like orbitals: psi = R(r) Y(direction), in units of the Bohr radius,
// with chemistry's z axis pointing up. |psi|² separates, so the radius is drawn
// from r² R² (a tabulated inverse CDF) and the direction from Y² (rejection).

const ORBITALS = {
  "1s": { label: "1s", R: (r) => Math.exp(-r), Y: () => 1, ymax: 1, rmax: 9 },
  "2s": { label: "2s", R: (r) => (2 - r) * Math.exp(-r / 2), Y: () => 1, ymax: 1, rmax: 18 },
  "2p": { label: "2p", R: (r) => r * Math.exp(-r / 2), Y: (x, y, z) => z, ymax: 1, rmax: 18 },
  "3p": {
    label: "3p",
    R: (r) => r * (6 - r) * Math.exp(-r / 3),
    Y: (x, y, z) => z,
    ymax: 1,
    rmax: 30,
  },
  "3dz2": {
    label: "3d (z²)",
    R: (r) => r * r * Math.exp(-r / 3),
    Y: (x, y, z) => 3 * z * z - 1,
    ymax: 2,
    rmax: 30,
  },
  "3dxy": {
    label: "3d (xy)",
    R: (r) => r * r * Math.exp(-r / 3),
    Y: (x, y) => 2 * x * y,
    ymax: 1,
    rmax: 30,
    face: true,
  },
  "4fz3": {
    label: "4f (z³)",
    R: (r) => r * r * r * Math.exp(-r / 4),
    Y: (x, y, z) => z * (5 * z * z - 3),
    ymax: 2,
    rmax: 44,
  },
  "4fxyz": {
    label: "4f (xyz)",
    R: (r) => r * r * r * Math.exp(-r / 4),
    Y: (x, y, z) => 5.196 * x * y * z,
    ymax: 1,
    rmax: 44,
  },
};

// A radius sampler for r² R(r)², cut at the 98.5% quantile so a few far
// samples do not shrink the picture.
function radialSampler(R, rmax) {
  const N = 2048;
  const cdf = new Float64Array(N + 1);
  for (let i = 1; i <= N; i++) {
    const r = ((i - 0.5) / N) * rmax;
    const f = r * R(r);
    cdf[i] = cdf[i - 1] + f * f;
  }
  const total = cdf[N];
  for (let i = 0; i <= N; i++) cdf[i] /= total;
  const cutQ = 0.985;
  let hiR = rmax;
  for (let i = 0; i <= N; i++)
    if (cdf[i] >= cutQ) {
      hiR = (i / N) * rmax;
      break;
    }
  return {
    extent: hiR,
    sample(rand) {
      const x = rand() * cutQ;
      let lo = 0;
      let hi = N;
      while (lo < hi) {
        const m = (lo + hi) >> 1;
        if (cdf[m] < x) lo = m + 1;
        else hi = m;
      }
      const i = Math.max(1, lo);
      const f = (x - cdf[i - 1]) / Math.max(1e-12, cdf[i] - cdf[i - 1]);
      return ((i - 1 + f) / N) * rmax;
    },
  };
}

// ---- Elements (for the Bohr atom) --------------------------------------------------
// [symbol, name, mass number of the commonest isotope, electrons per shell]

const ELEMENTS = [
  ["H", "Hydrogen", 1, [1]],
  ["He", "Helium", 4, [2]],
  ["Li", "Lithium", 7, [2, 1]],
  ["Be", "Beryllium", 9, [2, 2]],
  ["B", "Boron", 11, [2, 3]],
  ["C", "Carbon", 12, [2, 4]],
  ["N", "Nitrogen", 14, [2, 5]],
  ["O", "Oxygen", 16, [2, 6]],
  ["F", "Fluorine", 19, [2, 7]],
  ["Ne", "Neon", 20, [2, 8]],
  ["Na", "Sodium", 23, [2, 8, 1]],
  ["Mg", "Magnesium", 24, [2, 8, 2]],
  ["Al", "Aluminium", 27, [2, 8, 3]],
  ["Si", "Silicon", 28, [2, 8, 4]],
  ["P", "Phosphorus", 31, [2, 8, 5]],
  ["S", "Sulfur", 32, [2, 8, 6]],
  ["Cl", "Chlorine", 35, [2, 8, 7]],
  ["Ar", "Argon", 40, [2, 8, 8]],
  ["K", "Potassium", 39, [2, 8, 8, 1]],
  ["Ca", "Calcium", 40, [2, 8, 8, 2]],
  ["Sc", "Scandium", 45, [2, 8, 9, 2]],
  ["Ti", "Titanium", 48, [2, 8, 10, 2]],
  ["V", "Vanadium", 51, [2, 8, 11, 2]],
  ["Cr", "Chromium", 52, [2, 8, 13, 1]],
  ["Mn", "Manganese", 55, [2, 8, 13, 2]],
  ["Fe", "Iron", 56, [2, 8, 14, 2]],
  ["Co", "Cobalt", 59, [2, 8, 15, 2]],
  ["Ni", "Nickel", 58, [2, 8, 16, 2]],
  ["Cu", "Copper", 63, [2, 8, 18, 1]],
  ["Zn", "Zinc", 64, [2, 8, 18, 2]],
  ["Ga", "Gallium", 69, [2, 8, 18, 3]],
  ["Ge", "Germanium", 74, [2, 8, 18, 4]],
  ["As", "Arsenic", 75, [2, 8, 18, 5]],
  ["Se", "Selenium", 80, [2, 8, 18, 6]],
  ["Br", "Bromine", 79, [2, 8, 18, 7]],
  ["Kr", "Krypton", 84, [2, 8, 18, 8]],
  ["Ag", "Silver", 107, [2, 8, 18, 18, 1]],
  ["Sn", "Tin", 120, [2, 8, 18, 18, 4]],
  ["I", "Iodine", 127, [2, 8, 18, 18, 7]],
  ["Xe", "Xenon", 132, [2, 8, 18, 18, 8]],
  ["Au", "Gold", 197, [2, 8, 18, 32, 18, 1]],
  ["Hg", "Mercury", 202, [2, 8, 18, 32, 18, 2]],
  ["Pb", "Lead", 208, [2, 8, 18, 32, 18, 4]],
  ["U", "Uranium", 238, [2, 8, 18, 32, 21, 9, 2]],
];

const zOf = (shells) => shells.reduce((s, n) => s + n, 0);

// The tilt of each electron shell's ring, and how fast it turns.
const SHELL_TILT = [
  [0.95, 0.35],
  [1.25, 2.3],
  [0.8, 4.1],
  [1.35, 5.5],
  [1.05, 1.2],
  [0.7, 3.2],
  [1.2, 0.2],
];
const shellNormal = (i) => {
  const [a, b] = SHELL_TILT[i % SHELL_TILT.length];
  return [Math.sin(a) * Math.cos(b), Math.cos(a), Math.sin(a) * Math.sin(b)];
};
const shellSpeed = (i) => (i % 2 ? -1 : 1) * (1.5 / Math.pow(i + 1, 0.75));

// Balls packed in a round cluster: face-centred cubic points nearest the
// centre, for a nucleus of n nucleons of radius rb.
function packBall(n, rb, rand) {
  const a = rb * 2 * 0.98 * Math.SQRT2;
  const pts = [];
  const m = Math.ceil(Math.cbrt(n)) + 2;
  for (let i = -m; i <= m; i++)
    for (let j = -m; j <= m; j++)
      for (let l = -m; l <= m; l++) {
        if ((i + j + l) % 2) continue;
        const p = [(i * a) / 2, (j * a) / 2, (l * a) / 2];
        pts.push({ p, d: len(p) + rand() * 1e-3 });
      }
  pts.sort((x, y) => x.d - y.d);
  const out = pts.slice(0, n).map((x) => x.p);
  const c = mul(
    out.reduce((s, p) => add(s, p), [0, 0, 0]),
    1 / n,
  );
  return out.map((p) => sub(p, c));
}

// ---- Ball-and-stick models -----------------------------------------------------------

const CPK = {
  H: { color: "#f4f4f4", r: 0.27 },
  C: { color: "#3d3d3d", r: 0.38 },
  N: { color: "#3b5bff", r: 0.37 },
  O: { color: "#e3322b", r: 0.37 },
};

// Adds atoms and bonds. atoms: [{ el, p, color?, r? }], bonds: [[i, j, order]].
// Bonds are split in two, each half in its atom's colour.
function ballStick(k, atoms, bonds, { bondR = 0.09, vibrate = 0.02, glint = 0, grey = null } = {}) {
  const phase = atoms.map(() => k.rand() * TAU);
  atoms.forEach((a, i) => {
    const el = CPK[a.el] || {};
    const col = a.color || el.color;
    k.add(k.sphere(a.r ?? el.r), {
      pos: a.p,
      flat: 0.3,
      kind: glint ? "glint" : "breathe",
      params: glint ? [glint, 0] : [vibrate, phase[i]],
      color: (c) => {
        const base = a.el === "H" ? mix(col, "#b8c4d6", 0.25 * (1 - Math.max(0, c.n[1]))) : col;
        return gloss(lit(base, c.n, 0.6, 0.5), c.n, a.el === "C" ? 0.55 : 0.45, 16);
      },
    });
  });
  for (const [i, j, order = 1] of bonds) {
    const A = atoms[i];
    const B = atoms[j];
    const d = sub(B.p, A.p);
    const L = len(d);
    const u = mul(d, 1 / L);
    // A sideways offset for double bonds, in the plane of a neighbour.
    let side = cross(u, [0, 0, 1]);
    if (len(side) < 0.2) side = cross(u, [0, 1, 0]);
    side = unit(side);
    const offs = order === 2 ? [-1, 1] : order === 3 ? [-1.4, 0, 1.4] : [0];
    const r = order === 1 ? bondR : bondR * 0.65;
    const q = quatFromTo([0, 1, 0], u);
    for (const o of offs) {
      const shift = mul(side, o * bondR * 1.3);
      for (const [from, to, atom, idx] of [
        [A.p, lerp(A.p, B.p, 0.5), A, i],
        [lerp(A.p, B.p, 0.5), B.p, B, j],
      ]) {
        const el = CPK[atom.el] || {};
        const col = grey || atom.bondColor || atom.color || el.color;
        k.add(k.cylinder(r, L / 2, { caps: false }), {
          pos: add(lerp(from, to, 0.5), shift),
          quat: q,
          flat: 0.3,
          kind: "breathe",
          params: [vibrate, phase[idx]],
          color: (c) => lit(atom.el === "H" && !grey ? "#dcdcdc" : col, c.n, 0.65, 0.4),
        });
      }
    }
  }
}

// Hydrogens on an sp3 atom at p with neighbours at the given positions:
// fills the missing corners of a tetrahedron.
function tetraH(p, neighbours, count, bond = 1.09, twist = 0) {
  const dirs = neighbours.map((q) => unit(sub(q, p)));
  const out = [];
  if (dirs.length === 1) {
    const a = mul(dirs[0], -1);
    const [e1, e2] = basis(a);
    for (let i = 0; i < count; i++) {
      const t = twist + (i / 3) * TAU;
      const d = add(mul(a, 0.334), mul(add(mul(e1, Math.cos(t)), mul(e2, Math.sin(t))), 0.943));
      out.push(add(p, mul(d, bond)));
    }
  } else if (dirs.length === 2) {
    const b = unit(mul(add(dirs[0], dirs[1]), -1));
    const n = unit(cross(dirs[0], dirs[1]));
    for (const s of [1, -1].slice(0, count)) {
      const d = add(mul(b, 0.577), mul(n, 0.816 * s));
      out.push(add(p, mul(d, bond)));
    }
  } else if (dirs.length === 3) {
    out.push(add(p, mul(unit(mul(add(add(dirs[0], dirs[1]), dirs[2]), -1)), bond)));
  }
  return out;
}

// Molecule builders: each returns { atoms, bonds } in ångströms.
const MOLECULES = {
  water: () => ({
    atoms: [
      { el: "O", p: [0, 0.12, 0] },
      { el: "H", p: [0.757, -0.47, 0] },
      { el: "H", p: [-0.757, -0.47, 0] },
    ],
    bonds: [
      [0, 1],
      [0, 2],
    ],
  }),
  co2: () => ({
    atoms: [
      { el: "C", p: [0, 0, 0] },
      { el: "O", p: [1.16, 0, 0] },
      { el: "O", p: [-1.16, 0, 0] },
    ],
    bonds: [
      [0, 1, 2],
      [0, 2, 2],
    ],
  }),
  methane: () => {
    const atoms = [{ el: "C", p: [0, 0, 0] }];
    const dirs = [
      [1, 1, 1],
      [1, -1, -1],
      [-1, 1, -1],
      [-1, -1, 1],
    ];
    // Stand it on three legs with one hydrogen straight up.
    const q = quatFromTo(unit([1, 1, 1]), [0, 1, 0]);
    for (const d of dirs) atoms.push({ el: "H", p: mul(quatRotate(q, unit(d)), 1.09) });
    return { atoms, bonds: [1, 2, 3, 4].map((i) => [0, i]) };
  },
  ammonia: () => {
    const atoms = [{ el: "N", p: [0, 0.25, 0] }];
    const alpha = (68 / 180) * Math.PI;
    for (let i = 0; i < 3; i++) {
      const b = (i / 3) * TAU + 0.5;
      atoms.push({
        el: "H",
        p: [
          1.01 * Math.sin(alpha) * Math.cos(b),
          0.25 - 1.01 * Math.cos(alpha),
          1.01 * Math.sin(alpha) * Math.sin(b),
        ],
      });
    }
    return { atoms, bonds: [1, 2, 3].map((i) => [0, i]) };
  },
  ethanol: () => {
    const C1 = [-1.2, -0.25, 0];
    const C2 = [0.05, 0.6, 0];
    const O = [1.2, -0.2, 0];
    const HO = [1.95, 0.38, 0];
    const atoms = [
      { el: "C", p: C1 },
      { el: "C", p: C2 },
      { el: "O", p: O },
      { el: "H", p: HO },
    ];
    const bonds = [
      [0, 1],
      [1, 2],
      [2, 3],
    ];
    for (const h of tetraH(C1, [C2], 3, 1.09, 0.3)) {
      atoms.push({ el: "H", p: h });
      bonds.push([0, atoms.length - 1]);
    }
    for (const h of tetraH(C2, [C1, O], 2)) {
      atoms.push({ el: "H", p: h });
      bonds.push([1, atoms.length - 1]);
    }
    return { atoms, bonds };
  },
  benzene: () => {
    const atoms = [];
    const bonds = [];
    for (let i = 0; i < 6; i++) {
      const a = (i / 6) * TAU + TAU / 12;
      atoms.push({ el: "C", p: [1.39 * Math.cos(a), 1.39 * Math.sin(a), 0] });
    }
    for (let i = 0; i < 6; i++) {
      const a = (i / 6) * TAU + TAU / 12;
      atoms.push({ el: "H", p: [2.47 * Math.cos(a), 2.47 * Math.sin(a), 0] });
      bonds.push([i, (i + 1) % 6, i % 2 ? 1 : 2], [i, i + 6]);
    }
    return { atoms, bonds };
  },
  caffeine: () => {
    // A hexagon (N1 C2 N3 C4 C5 C6) fused to a pentagon (C4 C5 N7 C8 N9).
    const b = 1.39;
    const at = (deg, r = b, c = [0, 0]) => [
      c[0] + r * Math.cos((deg * Math.PI) / 180),
      c[1] + r * Math.sin((deg * Math.PI) / 180),
      0,
    ];
    const C6 = at(90);
    const N1 = at(150);
    const C2 = at(210);
    const N3 = at(270);
    const C4 = at(330);
    const C5 = at(30);
    const pc = [C4[0] + 0.95, 0];
    const rp = Math.hypot(C4[0] - pc[0], C4[1]);
    const N7 = at(72, rp, pc);
    const C8 = at(0, rp, pc);
    const N9 = at(-72, rp, pc);
    const out = (p, from, r) => add(p, mul(unit(sub(p, from)), r));
    const O6 = out(C6, [0, 0, 0], 1.22);
    const O2 = out(C2, [0, 0, 0], 1.22);
    const M1 = out(N1, [0, 0, 0], 1.47);
    const M3 = out(N3, [0, 0, 0], 1.47);
    const M7 = out(N7, [pc[0], pc[1], 0], 1.47);
    const H8 = out(C8, [pc[0], pc[1], 0], 1.08);
    const atoms = [
      { el: "N", p: N1 },
      { el: "C", p: C2 },
      { el: "N", p: N3 },
      { el: "C", p: C4 },
      { el: "C", p: C5 },
      { el: "C", p: C6 },
      { el: "N", p: N7 },
      { el: "C", p: C8 },
      { el: "N", p: N9 },
      { el: "O", p: O6 },
      { el: "O", p: O2 },
      { el: "C", p: M1 },
      { el: "C", p: M3 },
      { el: "C", p: M7 },
      { el: "H", p: H8 },
    ];
    const bonds = [
      [0, 1],
      [1, 2],
      [2, 3],
      [3, 4, 2],
      [4, 5],
      [5, 0],
      [4, 6],
      [6, 7],
      [7, 8, 2],
      [8, 3],
      [5, 9, 2],
      [1, 10, 2],
      [0, 11],
      [2, 12],
      [6, 13],
      [7, 14],
    ];
    for (const [m, n] of [
      [11, 0],
      [12, 2],
      [13, 6],
    ]) {
      for (const h of tetraH(atoms[m].p, [atoms[n].p], 3, 1.09, 0.5)) {
        atoms.push({ el: "H", p: h });
        bonds.push([m, atoms.length - 1]);
      }
    }
    // Centre it.
    const c = mul(
      atoms.reduce((s, a) => add(s, a.p), [0, 0, 0]),
      1 / atoms.length,
    );
    for (const a of atoms) a.p = sub(a.p, c);
    return { atoms, bonds };
  },
  c60: () => {
    // Even permutations of (0, ±1, ±3φ), (±1, ±(2+φ), ±2φ), (±φ, ±2, ±φ³).
    const base = [
      [0, 1, 3 * PHI],
      [1, 2 + PHI, 2 * PHI],
      [PHI, 2, PHI * PHI * PHI],
    ];
    const seen = new Set();
    const atoms = [];
    for (const v of base)
      for (const sx of [-1, 1])
        for (const sy of [-1, 1])
          for (const sz of [-1, 1]) {
            const s = [v[0] * sx, v[1] * sy, v[2] * sz];
            for (const [a, b, c] of [
              [0, 1, 2],
              [1, 2, 0],
              [2, 0, 1],
            ]) {
              const p = [s[a], s[b], s[c]];
              const key = p.map((x) => x.toFixed(3)).join(",");
              if (seen.has(key)) continue;
              seen.add(key);
              atoms.push({ el: "C", p: mul(p, 0.7), r: 0.3 });
            }
          }
    const bonds = [];
    for (let i = 0; i < atoms.length; i++)
      for (let j = i + 1; j < atoms.length; j++)
        if (Math.abs(len(sub(atoms[i].p, atoms[j].p)) - 1.4) < 0.05) bonds.push([i, j]);
    return { atoms, bonds };
  },
};

// ---- Crystal lattices ------------------------------------------------------------------

function saltLattice() {
  const atoms = [];
  const bonds = [];
  const n = 4;
  const idx = new Map();
  for (let i = 0; i < n; i++)
    for (let j = 0; j < n; j++)
      for (let l = 0; l < n; l++) {
        const na = (i + j + l) % 2 === 0;
        idx.set(`${i},${j},${l}`, atoms.length);
        atoms.push({
          el: na ? "Na" : "Cl",
          p: [i - (n - 1) / 2, j - (n - 1) / 2, l - (n - 1) / 2],
          color: na ? "#9b59e8" : "#5cd65c",
          r: na ? 0.19 : 0.3,
        });
      }
  for (let i = 0; i < n; i++)
    for (let j = 0; j < n; j++)
      for (let l = 0; l < n; l++) {
        const a = idx.get(`${i},${j},${l}`);
        for (const [di, dj, dl] of [
          [1, 0, 0],
          [0, 1, 0],
          [0, 0, 1],
        ]) {
          const b = idx.get(`${i + di},${j + dj},${l + dl}`);
          if (b !== undefined) bonds.push([a, b]);
        }
      }
  return { atoms, bonds, bondR: 0.035, grey: "#c9c9c9" };
}

function diamondLattice() {
  const atoms = [];
  const fcc = [
    [0, 0, 0],
    [0, 0.5, 0.5],
    [0.5, 0, 0.5],
    [0.5, 0.5, 0],
  ];
  const N = 2;
  const seen = new Set();
  for (let i = -1; i <= N; i++)
    for (let j = -1; j <= N; j++)
      for (let l = -1; l <= N; l++)
        for (const f of fcc)
          for (const o of [0, 0.25]) {
            const p = [i + f[0] + o, j + f[1] + o, l + f[2] + o];
            if (p.some((x) => x < -1e-6 || x > N + 1e-6)) continue;
            const key = p.map((x) => x.toFixed(3)).join(",");
            if (seen.has(key)) continue;
            seen.add(key);
            atoms.push({ el: "C", p: p.map((x) => x - N / 2), color: "#8fb0ec", r: 0.1 });
          }
  const bonds = [];
  for (let i = 0; i < atoms.length; i++)
    for (let j = i + 1; j < atoms.length; j++)
      if (Math.abs(len(sub(atoms[i].p, atoms[j].p)) - 0.433) < 0.02) bonds.push([i, j]);
  // Drop atoms left with a single bond or none at the corners.
  const deg = atoms.map(() => 0);
  for (const [i, j] of bonds) {
    deg[i]++;
    deg[j]++;
  }
  const keepIdx = atoms.map((a, i) => deg[i] >= 2);
  const remap = [];
  const out = [];
  atoms.forEach((a, i) => {
    if (keepIdx[i]) {
      remap[i] = out.length;
      out.push(a);
    }
  });
  const outBonds = bonds
    .filter(([i, j]) => keepIdx[i] && keepIdx[j])
    .map(([i, j]) => [remap[i], remap[j]]);
  return { atoms: out, bonds: outBonds, bondR: 0.032, grey: "#7d92bd", glint: 0.6 };
}

function graphiteLattice() {
  const atoms = [];
  const bonds = [];
  const s3 = Math.sqrt(3);
  const layers = 3;
  const gap = 2.36;
  for (let L = 0; L < layers; L++) {
    const shift = L % 2 ? [0, 1] : [0, 0];
    const start = atoms.length;
    for (let m = -5; m <= 5; m++)
      for (let n = -5; n <= 5; n++)
        for (const bz of [0, 1]) {
          const x = m * s3 + n * (s3 / 2);
          const z = n * 1.5 + bz + shift[1] - 0.5;
          if (Math.hypot(x, z) > 2.75) continue;
          atoms.push({
            el: "C",
            p: [x, (L - (layers - 1) / 2) * gap, z],
            color: "#4b4f57",
            r: 0.2,
            layer: L,
          });
        }
    for (let i = start; i < atoms.length; i++)
      for (let j = i + 1; j < atoms.length; j++)
        if (Math.abs(len(sub(atoms[i].p, atoms[j].p)) - 1) < 0.02) bonds.push([i, j]);
  }
  return { atoms, bonds, bondR: 0.06, grey: "#8d939e", dotted: true };
}

function iceLattice(rand) {
  const a = 4.52;
  const c = 7.37;
  const frac = [
    [1 / 3, 2 / 3, 1 / 16],
    [2 / 3, 1 / 3, 9 / 16],
    [1 / 3, 2 / 3, 7 / 16],
    [2 / 3, 1 / 3, 15 / 16],
  ];
  const O = [];
  for (let m = -1; m <= 2; m++)
    for (let n = -1; n <= 2; n++)
      for (let l = 0; l < 2; l++)
        for (const f of frac) {
          const u = m + f[0];
          const v = n + f[1];
          const w = l + f[2];
          const x = a * (u - v / 2);
          const z = a * v * (Math.sqrt(3) / 2);
          O.push([x, w * c, z]);
        }
  const cen = mul(
    O.reduce((s, p) => add(s, p), [0, 0, 0]),
    1 / O.length,
  );
  const inside = O.map((p) => sub(p, cen)).filter(
    (p) => Math.hypot(p[0] / 1.15, p[1], p[2] / 1.15) < 6.2,
  );
  const edges = [];
  for (let i = 0; i < inside.length; i++)
    for (let j = i + 1; j < inside.length; j++)
      if (Math.abs(len(sub(inside[i], inside[j])) - 2.76) < 0.15) edges.push([i, j]);
  // Two near hydrogens per oxygen where it can (the ice rules), greedily.
  const hc = inside.map(() => 0);
  const order = edges.map((e, i) => ({ e, r: rand() + i * 0 })).sort((x, y) => x.r - y.r);
  const hs = [];
  for (const { e } of order) {
    let [i, j] = e;
    if (rand() < 0.5) [i, j] = [j, i];
    const owner = hc[i] < 2 ? i : hc[j] < 2 ? j : -1;
    const other = owner === i ? j : i;
    if (owner < 0) continue;
    hc[owner]++;
    hs.push({ owner, other });
  }
  const atoms = inside.map((p) => ({ el: "O", p, color: "#e8453c", r: 0.42 }));
  const bonds = [];
  const hbonds = [];
  for (const { owner, other } of hs) {
    const p = lerp(inside[owner], inside[other], 0.96 / 2.76);
    atoms.push({ el: "H", p, r: 0.25 });
    bonds.push([owner, atoms.length - 1]);
    hbonds.push([p, inside[other]]);
  }
  return { atoms, bonds, bondR: 0.1, hbonds };
}

export const RECIPES = {
  // ---- Electron orbital ---------------------------------------------------------------
  orbital: {
    alive: true,
    options: [
      {
        key: "orbital",
        label: "Orbital",
        type: "select",
        default: "3dz2",
        choices: Object.entries(ORBITALS).map(([id, o]) => ({ id, label: o.label })),
      },
      {
        key: "look",
        label: "Look",
        type: "select",
        default: "cloud",
        choices: [
          { id: "cloud", label: "Cloud" },
          { id: "lobes", label: "Lobes" },
        ],
      },
      { key: "plus", label: "Plus phase", type: "color", default: "#ff8a3d" },
      { key: "minus", label: "Minus phase", type: "color", default: "#3d8bff" },
    ],
    build(k, o) {
      const orb = ORBITALS[o.orbital] || ORBITALS["3dz2"];
      const radial = radialSampler(orb.R, orb.rmax);
      const E = radial.extent;
      // Chemistry's (x, y, z) -> the toy's axes: z is up; "face" orbitals lie
      // in the plane facing the viewer.
      const toToy = (d) => (orb.face ? d : [d[0], d[2], -d[1]]);
      const toChem = (d) => (orb.face ? d : [d[0], -d[2], d[1]]);
      const drawDir = (rand) => {
        let d;
        let y;
        for (let tries = 0; tries < 200; tries++) {
          d = randDir(rand);
          y = orb.Y(d[0], d[1], d[2]);
          if (rand() * orb.ymax * orb.ymax <= y * y) break;
        }
        return { d, y };
      };
      // Densities of samples: the peak (to brighten the thick of the cloud)
      // and the level whose surface holds 90% of the electron.
      const dens = [];
      for (let i = 0; i < 3000; i++) {
        const r = radial.sample(k.rand);
        const { y } = drawDir(k.rand);
        dens.push((orb.R(r) * y) ** 2);
      }
      dens.sort((a, b) => a - b);
      const peak = dens[dens.length - 1] || 1;
      const level = dens[Math.floor(dens.length * 0.1)];
      // The boundary surface: along a direction with |Y| = y, the outermost
      // radius where psi² reaches the level. Tabulated against y.
      const N = 1024;
      const g = new Float64Array(N + 1);
      for (let i = 0; i <= N; i++) g[i] = Math.abs(orb.R((i / N) * orb.rmax));
      const T = 256;
      const table = new Float64Array(T + 1);
      for (let j = 1; j <= T; j++) {
        const need = Math.sqrt(level) / ((j / T) * orb.ymax);
        let i = N;
        while (i > 0 && g[i] < need) i--;
        table[j] = (i / N) * orb.rmax;
      }
      const surfR = (dToy) => {
        const d = toChem(dToy);
        const y = Math.abs(orb.Y(d[0], d[1], d[2]));
        const x = Math.min(T, (y / orb.ymax) * T);
        const j = Math.floor(x);
        const f = x - j;
        const r = j >= T ? table[T] : table[j] * (1 - f) + table[j + 1] * f;
        return Math.max(0.004, r / E);
      };
      const plus = o.plus;
      const minus = o.minus;
      const lobes = o.look === "lobes";
      // (The surface takes the rest of the budget, so splat sizes follow it.)
      k.add(k.radial(surfR, { grid: 96 }), {
        flat: 0.15,
        opacity: lobes ? 0.92 : 0.28,
        pattern: false,
        kind: "breathe",
        params: [0.01, 0],
        color: (c) => {
          const d = toChem(unit(c.lp));
          const r = len(c.lp) * E;
          const sign = orb.R(r) * orb.Y(d[0], d[1], d[2]) >= 0;
          const base = sign ? plus : minus;
          if (!lobes) return gloss(lit(mix(base, "#ffffff", 0.3), c.n, 0.75, 0.3), c.n, 0.5, 20);
          return gloss(lit(base, c.n, 0.55, 0.55), c.n, 0.45, 16);
        },
      });
      k.cloud({ share: lobes ? 0.24 : 0.66, size: 1.1, pattern: false }, (rand) => {
        // Rejection sampling from |psi|², keeping the cloud mostly inside the
        // boundary surface so its shape reads clearly.
        let r;
        let d;
        let y;
        let psi;
        for (let tries = 0; tries < 12; tries++) {
          r = radial.sample(rand);
          ({ d, y } = drawDir(rand));
          psi = orb.R(r) * y;
          if (psi * psi > level * 0.6 || rand() < 0.08) break;
        }
        const t = clamp((psi * psi) / peak, 0, 1);
        const base = psi >= 0 ? plus : minus;
        const col = mix(shade(base, 0.8), mix(base, "#fffbe8", 0.7), Math.pow(t, 0.6));
        return {
          p: mul(toToy(d), r / E),
          color: col,
          opacity: lobes ? 0.35 : 0.1 + 0.55 * Math.pow(t, 0.6),
          size: 0.7 + 0.6 * rand(),
          kind: "twinkle",
          params: [0.5, rand() * TAU],
        };
      });
      // The nucleus: a tiny bright dot at the centre, with a soft glow.
      k.add(k.sphere(0.03), { share: 0.01, color: (c) => gloss("#fff3c4", c.n, 0.6, 8) });
      k.cloud({ share: 0.01, size: 1.4, pattern: false }, (rand) => ({
        p: mul(randDir(rand), 0.06 * Math.abs(gauss(rand))),
        color: "#fff0b3",
        opacity: 0.25,
        kind: "twinkle",
        params: [0.6, rand() * TAU],
      }));
    },
  },

  // ---- Bohr atom ------------------------------------------------------------------------
  atom: {
    alive: true,
    options: [
      {
        key: "element",
        label: "Element",
        type: "select",
        default: "C",
        choices: ELEMENTS.map(([sym, name, , shells]) => ({
          id: sym,
          label: `${zOf(shells)} ${name}`,
        })),
      },
      {
        key: "style",
        label: "Style",
        type: "select",
        default: "bohr",
        choices: [
          { id: "bohr", label: "Bohr" },
          { id: "cloud", label: "Cloud" },
        ],
      },
    ],
    controls: [{ key: "speed", label: "Electrons", type: "slider", default: 0.5 }],
    drive(t, c, out) {
      const s = 0.3 + 1.7 * c.speed;
      for (let i = 0; i < 7; i++) out.parts[`shell${i}`] = { angle: t * s * shellSpeed(i) };
    },
    build(k, o) {
      const [, , A, shells] = ELEMENTS.find((e) => e[0] === o.element) || ELEMENTS[5];
      const Z = zOf(shells);
      // The nucleus: every nucleon for light atoms, a representative ball for heavy ones.
      const nd = A <= 40 ? A : Math.round(40 + (A - 40) * 0.3);
      const np = Math.max(1, Math.round((nd * Z) / A));
      const rb = 0.075;
      const pts = packBall(nd, rb, k.rand);
      const kinds = pts.map((p, i) => i < np);
      for (let i = kinds.length - 1; i > 0; i--) {
        const j = Math.floor(k.rand() * (i + 1));
        [kinds[i], kinds[j]] = [kinds[j], kinds[i]];
      }
      const nucR = pts.reduce((m, p) => Math.max(m, len(p)), 0) + rb;
      pts.forEach((p, i) => {
        const proton = kinds[i];
        k.add(k.sphere(rb), {
          pos: p,
          flat: 0.3,
          weight: 1.5,
          kind: "beat",
          params: [0.03, 0],
          color: (c) => shiny(proton ? "#e8483f" : "#aab4c4", c.n, 0.5),
        });
      });
      const shellR = (i) => nucR + 0.3 + 0.24 * i;
      if (o.style === "cloud") {
        // Fuzzy shells: electrons as clouds of probability.
        const total = shells.reduce((s, n) => s + Math.sqrt(n), 0);
        shells.forEach((n, i) => {
          k.cloud({ share: (0.6 * Math.sqrt(n)) / total, size: 1.2, pattern: false }, (rand) => {
            const r = shellR(i) + 0.05 * gauss(rand);
            return {
              p: mul(randDir(rand), r),
              color: mix("#6fd3ff", "#b388ff", i / 6),
              opacity: 0.12 + 0.1 * rand(),
              kind: "twinkle",
              params: [0.6, rand() * TAU],
            };
          });
        });
        k.cloud({ share: 0.02, size: 2.5, pattern: false }, (rand) => ({
          p: mul(randDir(rand), nucR * 1.2 * rand()),
          color: "#ffb4a0",
          opacity: 0.12,
        }));
        return;
      }
      shells.forEach((n, i) => {
        const nrm = shellNormal(i);
        const part = k.part(`shell${i}`, { pivot: [0, 0, 0], axis: nrm });
        const R = shellR(i);
        k.add(k.torus(R, 0.01), {
          quat: quatFromTo([0, 1, 0], nrm),
          part,
          weight: 2.2,
          flat: 0.35,
          color: (c) => lit(mix("#8fb4ff", "#c7d6ff", 0.5 + 0.5 * c.n[1]), c.n, 0.75, 0.3),
        });
        const [e1, e2] = basis(nrm);
        for (let j = 0; j < n; j++) {
          const a = (j / n) * TAU + i * 0.7;
          const p = mul(add(mul(e1, Math.cos(a)), mul(e2, Math.sin(a))), R);
          k.add(k.sphere(0.042), {
            pos: p,
            part,
            weight: 2.5,
            pattern: false,
            color: (c) => keep(gloss(lit("#36c9ff", c.n, 0.8, 0.3), c.n, 0.7, 10)),
          });
          k.cloud({ count: 60, size: 1.6, pattern: false }, (rand) => ({
            p: add(p, mul(randDir(rand), 0.05 * Math.abs(gauss(rand)))),
            color: "#9fe8ff",
            opacity: 0.25,
            part,
            kind: "twinkle",
            params: [0.7, rand() * TAU],
          }));
        }
      });
    },
  },

  // ---- Molecule ------------------------------------------------------------------------
  molecule: {
    alive: true,
    options: [
      {
        key: "molecule",
        label: "Molecule",
        type: "select",
        default: "caffeine",
        choices: [
          { id: "water", label: "Water" },
          { id: "co2", label: "Carbon dioxide" },
          { id: "methane", label: "Methane" },
          { id: "ammonia", label: "Ammonia" },
          { id: "ethanol", label: "Ethanol" },
          { id: "benzene", label: "Benzene" },
          { id: "caffeine", label: "Caffeine" },
          { id: "c60", label: "Buckyball (C60)" },
        ],
      },
    ],
    build(k, o) {
      const make = MOLECULES[o.molecule] || MOLECULES.caffeine;
      const { atoms, bonds } = make();
      // Turn flat molecules a little so they show some depth.
      const q = quatAxisAngle([0.3, 1, 0], o.molecule === "c60" ? 0.3 : -0.35);
      for (const a of atoms) a.p = quatRotate(q, a.p);
      ballStick(k, atoms, bonds, { bondR: o.molecule === "c60" ? 0.08 : 0.1 });
    },
  },

  // ---- Crystal lattice -------------------------------------------------------------------
  "crystal-lattice": {
    alive: true,
    options: [
      {
        key: "crystal",
        label: "Crystal",
        type: "select",
        default: "salt",
        choices: [
          { id: "salt", label: "Salt (NaCl)" },
          { id: "diamond", label: "Diamond" },
          { id: "graphite", label: "Graphite" },
          { id: "ice", label: "Ice" },
        ],
      },
    ],
    build(k, o) {
      const make = {
        salt: saltLattice,
        diamond: diamondLattice,
        graphite: graphiteLattice,
        ice: () => iceLattice(k.rand),
      }[o.crystal];
      const lat = (make || saltLattice)();
      if (o.crystal === "ice") {
        // Tip ice towards the viewer so its six-sided channels show.
        const q = quatFromTo([0, 1, 0], unit(lerp([0, 1, 0], VIEW, 0.72)));
        for (const a of lat.atoms) a.p = quatRotate(q, a.p);
        lat.hbonds = lat.hbonds.map(([a, b]) => [quatRotate(q, a), quatRotate(q, b)]);
      }
      ballStick(k, lat.atoms, lat.bonds, {
        bondR: lat.bondR,
        vibrate: 0.012,
        glint: lat.glint || 0,
        grey: lat.grey || null,
      });
      if (lat.hbonds) {
        // Hydrogen bonds: dotted lines from each hydrogen to its neighbour's oxygen.
        k.cloud({ share: 0.03, size: 0.9, pattern: false }, (rand, i, n) => {
          const [a, b] = lat.hbonds[i % lat.hbonds.length];
          const t = 0.18 + (0.64 * Math.floor(rand() * 6)) / 5;
          return {
            p: add(lerp(a, b, t), mul(randDir(rand), 0.03)),
            color: "#7fc4ff",
            opacity: 0.9,
          };
        });
      }
      if (lat.dotted) {
        // Weak bonds between the layers of graphite, as dotted lines.
        const pairs = [];
        for (const a of lat.atoms)
          for (const b of lat.atoms)
            if (b.layer === a.layer + 1 && Math.hypot(a.p[0] - b.p[0], a.p[2] - b.p[2]) < 0.05)
              pairs.push([a.p, b.p]);
        if (pairs.length)
          k.cloud({ share: 0.02, size: 0.8, pattern: false }, (rand, i) => {
            const [a, b] = pairs[i % pairs.length];
            const t = 0.12 + (0.76 * Math.floor(rand() * 9)) / 8;
            return { p: lerp(a, b, t), color: "#9aa3b5", opacity: 0.9 };
          });
      }
    },
  },
};

// Keeps a splat out of the pattern layer.
function keep(c) {
  return { c, keep: true };
}
