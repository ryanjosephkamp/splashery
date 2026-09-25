// Atoms and chemistry pack: electron orbitals, Bohr atoms, molecules and
// crystal lattices. Stylised, but built from real shapes and numbers.
// Loaded on demand.

import {
  mix,
  shade,
  ramp,
  clamp,
  smoothstep,
  quatFromTo,
  quatAxisAngle,
  quatRotate,
} from "../kit.js";
import { element, covalentRadius, formulaOf } from "../chem/elements.js";
import { moleculeFromText, readMoleculeFile } from "../chem/molfile.js";
import { parseStructure, ribbonPath, centreStructure } from "../chem/protein.js";

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

// ---- Timing helpers for tap effects ------------------------------------------------

const clamp01 = (x) => (x < 0 ? 0 : x > 1 ? 1 : x);
const ease = (x) => x * x * (3 - 2 * x);
const easeOut = (x) => 1 - (1 - x) ** 3;
// 0 before a, rising to 1 at b.
const band = (x, a, b) => clamp01((x - a) / (b - a));
// Rises from a to b, holds, falls from c to d.
const bump = (x, a, b, c, d) => band(x, a, b) * (1 - band(x, c, d));
// A pulse control's progress: 0 at the tap, 1 when done (and at rest).
const progress = (v) => (v > 0 ? 1 - v : 1);
// Per-toy memory for drive(), keyed by the control state object.
const MEM = new WeakMap();
function mem(c) {
  let m = MEM.get(c);
  if (!m) MEM.set(c, (m = {}));
  return m;
}
// An angle that turns at `rate` (which may change) without jumping.
function turning(m, key, t, rate) {
  const s = m[key] || (m[key] = { a: 0, t });
  s.a += (t - s.t) * rate;
  s.t = t;
  return s.a;
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
  "5g": {
    label: "5g (z⁴)",
    R: (r) => r * r * r * r * Math.exp(-r / 5),
    Y: (x, y, z) => 35 * z ** 4 - 30 * z * z + 3,
    ymax: 8,
    rmax: 62,
    hidden: true,
  },
};

// The orbital a tap excites each one to: one step up in energy, with the
// angular momentum one higher (the rule for absorbing a photon).
const EXCITE = {
  "1s": "2p",
  "2s": "3p",
  "2p": "3dz2",
  "3p": "3dz2",
  "3dz2": "4fz3",
  "3dxy": "4fxyz",
  "4fz3": "5g",
  "4fxyz": "5g",
  "5g": "4fz3",
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
// Bonds are split in two, each half in its atom's colour. Each atom and its
// bond halves can be a token (token(i), moved by drive) or a part
// (part(i)); `overlap` lengthens each half past the middle so a stretched
// bond does not open a gap.
function ballStick(
  k,
  atoms,
  bonds,
  { bondR = 0.09, vibrate = 0.02, glint = 0, grey = null, token, part, overlap = 0 } = {},
) {
  const phase = atoms.map(() => k.rand() * TAU);
  const motion = (i, own) =>
    token ? { kind: "token", params: [token(i), 0] } : { ...own, part: part ? part(i) : undefined };
  atoms.forEach((a, i) => {
    const el = CPK[a.el] || {};
    const col = a.color || el.color;
    k.add(k.sphere(a.r ?? el.r), {
      pos: a.p,
      flat: 0.3,
      ...motion(i, {
        kind: glint ? "glint" : "breathe",
        params: glint ? [glint, 0] : [vibrate, phase[i]],
      }),
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
    const mid = lerp(A.p, B.p, 0.5);
    for (const o of offs) {
      const shift = mul(side, o * bondR * 1.3);
      for (const [from, to, atom, idx] of [
        [A.p, add(mid, mul(u, overlap)), A, i],
        [add(mid, mul(u, -overlap)), B.p, B, j],
      ]) {
        const el = CPK[atom.el] || {};
        const col = grey || atom.bondColor || atom.color || el.color;
        k.add(k.cylinder(r, L / 2 + overlap, { caps: false }), {
          pos: add(lerp(from, to, 0.5), shift),
          quat: q,
          flat: 0.3,
          ...motion(idx, { kind: "breathe", params: [vibrate, phase[idx]] }),
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

// ---- Your own molecule ------------------------------------------------------------

// The molecule toy shows up to this many atoms (hydrogens included).
const MOLECULE_MAX = 600;
// What the molecule toy is showing, for its panel.
const MOLECULE_SHOWN = { label: "" };

// A molecule read from a file, packed into one line of text for the toy's
// options (and so for links and scene files): "M1;name;atoms;bonds", atoms
// as "El x y z" (ångströms, two decimals) and bonds as "i j order".
function packMolecule(mol) {
  const r = (x) => Math.round(x * 100) / 100;
  const atoms = mol.atoms.map((a) => `${a.el} ${r(a.p[0])} ${r(a.p[1])} ${r(a.p[2])}`).join(",");
  const bonds = mol.bonds.map(([i, j, o = 1]) => `${i} ${j} ${o}`).join(",");
  const name = String(mol.name || "")
    .replace(/[^\x20-\x7e]|[;,]/g, " ")
    .slice(0, 60);
  return `M1;${name};${atoms};${bonds}`;
}
function unpackMolecule(text) {
  const [, name, atomText = "", bondText = ""] = text.split(";");
  const atoms = atomText
    .split(",")
    .filter(Boolean)
    .map((a) => {
      const [el, x, y, z] = a.split(" ");
      return { el, p: [Number(x), Number(y), Number(z)] };
    });
  const n = atoms.length;
  const bonds = bondText
    .split(",")
    .filter(Boolean)
    .map((b) => b.split(" ").map(Number))
    .filter(([i, j, o]) => i >= 0 && i < n && j >= 0 && j < n && i !== j && o >= 1 && o <= 3);
  if (!n || atoms.some((a) => !element(a.el) || a.p.some((v) => !Number.isFinite(v))))
    throw new Error("That molecule could not be read.");
  return { atoms, bonds, name };
}

// Checks a molecule fits the toy, else says why.
function checkSize(mol) {
  if (mol.atoms.length > MOLECULE_MAX)
    throw new Error(
      `That molecule has ${mol.atoms.length} atoms; the molecule toy shows up to ${MOLECULE_MAX}. A protein goes in the Protein toy.`,
    );
  return mol;
}

// The molecule toy's own-molecule panel (ui.js): a name, formula or SMILES
// string typed in, or a molecule file.
const MOLECULE_INPUT = {
  title: "Your own molecule",
  placeholder: "aspirin, H2O, or SMILES like CC(=O)O",
  button: "Show it",
  fileButton: "Open a molecule file…",
  accept: ".mol,.sdf,.sd,.xyz,.pdb,.ent,.txt",
  note: "About sixty well-known molecules work by name (aspirin, glucose, dopamine, ATP…). For anything else paste a SMILES string: PubChem shows one for every compound. Files: MOL, SDF, XYZ or PDB, up to 600 atoms.",
  async read(text, fileName) {
    if (fileName) {
      const mol = checkSize(readMoleculeFile(text, fileName));
      const source = packMolecule(mol);
      if (source.length > 24000) throw new Error("That molecule is too big to keep in a link.");
      return { molecule: "custom", source };
    }
    const typed = String(text || "").trim();
    checkSize(moleculeFromText(typed));
    return { molecule: "custom", source: typed };
  },
  shown: () => MOLECULE_SHOWN.label,
};

// A molecule's atoms grouped into at most `max` tokens: each hydrogen goes
// with the atom it is bonded to, and when there are still too many groups
// the heavy atoms are gathered round well-spread seeds.
function tokenGroups(atoms, bonds, max = 48) {
  const owner = atoms.map((a, i) => i);
  for (const [i, j] of bonds) {
    if (atoms[i].el === "H" && atoms[j].el !== "H") owner[i] = j;
    else if (atoms[j].el === "H" && atoms[i].el !== "H") owner[j] = i;
  }
  const heads = [...new Set(owner)];
  let groupOf = new Map(heads.map((h, g) => [h, g]));
  if (heads.length > max) {
    // Seeds spread out (each the head furthest from those chosen so far).
    const seeds = [heads[0]];
    const near = heads.map((h) => len(sub(atoms[h].p, atoms[heads[0]].p)));
    while (seeds.length < max) {
      let best = 0;
      near.forEach((d, i) => (d > near[best] ? (best = i) : 0));
      seeds.push(heads[best]);
      heads.forEach((h, i) => (near[i] = Math.min(near[i], len(sub(atoms[h].p, atoms[heads[best]].p))))); // prettier-ignore
    }
    groupOf = new Map();
    for (const h of heads) {
      let g = 0;
      seeds.forEach((sd, i) => {
        if (len(sub(atoms[h].p, atoms[sd].p)) < len(sub(atoms[h].p, atoms[seeds[g]].p))) g = i;
      });
      groupOf.set(h, g);
    }
  }
  return atoms.map((a, i) => groupOf.get(owner[i]));
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

// The buckyball's atoms by pentagon: the twelve pentagons sit round the
// twelve corners of an icosahedron.
function pentagonOf(atoms) {
  const ico = [];
  for (const [a, b] of [
    [1, PHI],
    [-1, PHI],
    [1, -PHI],
    [-1, -PHI],
  ])
    ico.push(unit([0, a, b]), unit([a, b, 0]), unit([b, 0, a]));
  return atoms.map((at) => {
    const d = unit(at.p);
    let best = 0;
    let bv = -2;
    ico.forEach((v, i) => {
      const x = dot(d, v);
      if (x > bv) [bv, best] = [x, i];
    });
    return best;
  });
}

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

// An orbital as the toy draws it: its boundary surface (the level that
// holds 90% of the electron) and a cloud sampled from |psi|² inside it,
// scaled to fit (1 = the resting size). glow mixes the colours towards
// white; the surface's weight sets its share of the rest of the budget.
function orbitalLook(
  k,
  orb,
  { part, plus, minus, lobes, cloudShare, weight = 1, fit = 1, glow = 0 },
) {
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
    return Math.max(0.004, (r / E) * fit);
  };
  // (The surface takes the rest of the budget, so splat sizes follow it.)
  k.add(k.radial(surfR, { grid: 96 }), {
    weight,
    part,
    flat: 0.15,
    opacity: lobes ? 0.92 : 0.28,
    pattern: false,
    kind: "breathe",
    params: [0.01, 0],
    color: (c) => {
      const d = toChem(unit(c.lp));
      const r = (len(c.lp) / fit) * E;
      const sign = orb.R(r) * orb.Y(d[0], d[1], d[2]) >= 0;
      const base = mix(sign ? plus : minus, "#fffbe8", glow);
      if (!lobes) return gloss(lit(mix(base, "#ffffff", 0.3), c.n, 0.75, 0.3), c.n, 0.5, 20);
      return gloss(lit(base, c.n, 0.55, 0.55), c.n, 0.45, 16);
    },
  });
  k.cloud({ share: cloudShare, size: 1.1, pattern: false, part }, (rand) => {
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
    const base = mix(psi >= 0 ? plus : minus, "#fffbe8", glow);
    const col = mix(shade(base, 0.8), mix(base, "#fffbe8", 0.7), Math.pow(t, 0.6));
    return {
      p: mul(toToy(d), (r / E) * fit),
      color: col,
      opacity: lobes ? 0.35 : 0.1 + 0.55 * Math.pow(t, 0.6),
      size: 0.7 + 0.6 * rand(),
      kind: "twinkle",
      params: [0.5, rand() * TAU],
    };
  });
}

// ---- Proteins ------------------------------------------------------------------------

// The proteins on the shelf (structures from the Protein Data Bank, CC0) and
// what they are.
const PROTEINS = {
  ubiquitin: { file: "1ubq", label: "Ubiquitin (1UBQ)" },
  insulin: { file: "4ins", label: "Insulin (4INS)" },
  gfp: { file: "1ema", label: "Green fluorescent protein (1EMA)" },
  hemoglobin: { file: "4hhb", label: "Hemoglobin (4HHB)" },
};
// Parsed structures by file, a structure opened from a file, and what the
// protein toy is showing (for its panel).
const PROTEIN_CACHE = new Map();
const PROTEIN_FILE = { name: "", structure: null };
const PROTEIN_SHOWN = { label: "" };

// A file of this pack's assets as text (fetched in a browser, read from disk
// in Node for the build tools and tests).
async function readAsset(rel) {
  const url = new URL(rel, import.meta.url);
  if (url.protocol === "file:") {
    const fs = await import("node:fs/promises");
    return fs.readFile(url, "utf8");
  }
  const r = await fetch(url);
  if (!r.ok) throw new Error(`Could not load ${rel.split("/").pop()}.`);
  return r.text();
}

// The protein toy's panel (ui.js): open a PDB or mmCIF file.
const PROTEIN_INPUT = {
  title: "Your own protein",
  fileButton: "Open a PDB or mmCIF file…",
  accept: ".pdb,.ent,.cif,.mmcif,.txt",
  note: "Download any structure from rcsb.org (Download Files → PDB Format or PDBx/mmCIF) and open it here. It stays in your browser; a link to it shows ubiquitin until you open the file again.",
  async read(text, fileName) {
    const s = centreStructure(parseStructure(text, fileName));
    if (!s.chains.length) throw new Error("There is no protein chain in that file.");
    PROTEIN_FILE.name = String(fileName || "protein")
      .replace(/[^\x20-\x7e]/g, "")
      .slice(0, 80);
    PROTEIN_FILE.structure = s;
    return { protein: "file", fileName: PROTEIN_FILE.name };
  },
  shown: () => PROTEIN_SHOWN.label,
};

// Where each residue of a chain gets its colour: `rainbow` runs blue to
// red from each chain's start to its end; `chain` gives each chain its own
// colour; `structure` colours helices, strands and loops.
const CHAIN_COLOURS = ["#4f7cff", "#ff8a3d", "#39b86a", "#e04f8c", "#9c6bff", "#f2c230", "#2fb7c9", "#d9544a"]; // prettier-ignore
const SS_COLOURS = { H: "#e0445c", E: "#f2c230", C: "#d8d8d2" };
function residueColour(scheme, chainIndex, t, ss) {
  if (scheme === "chain") return CHAIN_COLOURS[chainIndex % CHAIN_COLOURS.length];
  if (scheme === "structure") return SS_COLOURS[ss] || SS_COLOURS.C;
  return ramp(["#3b4cc0", "#4fa3e0", "#6cc86c", "#f2d24a", "#f0843c", "#d6334a"], t);
}

// The cartoon: the backbone of each chain as a ribbon (a coiled band for a
// helix, a flat arrow for a strand, a thin tube for a loop), and the small
// molecules bound to it (hemes, zinc, GFP's chromophore) as balls and
// sticks. Each run of one kind is a token, so a tap can pull the protein
// apart into its helices, strands and loops and put it back together.
function buildProtein(k, s, scheme) {
  const runs = [];
  s.chains.forEach((chain, ci) => {
    const pts = ribbonPath(chain, { perResidue: 6 });
    const n = chain.residues.length;
    let run = null;
    pts.forEach((pt, i) => {
      const kind = pt.ss === "H" || pt.ss === "E" ? pt.ss : "C";
      if (!run || run.kind !== kind || run.seg !== pt.seg) {
        // Each run takes the next run's first point, so they join up.
        if (run && run.seg === pt.seg) run.pts.push(pt);
        run = { kind, seg: pt.seg, chain: ci, pts: [], n };
        runs.push(run);
      }
      run.pts.push(pt);
    });
  });
  // At most 48 tokens, the ligands included: merge the shortest runs into
  // their neighbours in the same chain until the rest fit.
  const budget = 48 - Math.min(16, s.ligands.length);
  while (runs.length > budget) {
    let best = -1;
    runs.forEach((r, i) => {
      const next = runs[i + 1];
      if (next && next.chain === r.chain && (best < 0 || r.pts.length + next.pts.length < runs[best].pts.length + runs[best + 1].pts.length)) best = i; // prettier-ignore
    });
    if (best < 0) break;
    const [a, b] = runs.splice(best, 2);
    runs.splice(best, 0, { ...a, merged: true, parts: [...(a.parts || [a]), ...(b.parts || [b])], pts: [...a.pts, ...b.pts] }); // prettier-ignore
  }
  const tokens = [];
  runs.forEach((r) => {
    const id = tokens.length;
    const base = mul(
      r.pts.reduce((acc, pt) => add(acc, pt.p), [0, 0, 0]),
      1 / r.pts.length,
    );
    tokens.push({ base, kind: r.kind });
    for (const piece of r.parts || [r]) ribbonRun(k, piece, id, scheme);
  });
  // The bound small molecules.
  const ligandTokens = [];
  s.ligands.slice(0, 16).forEach((lig) => {
    const id = tokens.length;
    const base = mul(
      lig.atoms.reduce((acc, a) => add(acc, a.p), [0, 0, 0]),
      1 / lig.atoms.length,
    );
    tokens.push({ base, kind: "L", name: lig.name });
    ligandTokens.push({ lig, id });
    const atoms = lig.atoms.map((a) => ({
      el: a.el,
      p: a.p,
      r: a.el === "ZN" || a.el === "Zn" || a.el === "FE" || a.el === "Fe" ? 0.75 : 0.42,
      color: element(a.el)?.color || "#ff66cc",
    }));
    ballStick(k, atoms, lig.bonds || [], { bondR: 0.17, token: () => id, overlap: 0.05 });
  });
  const spread = Math.max(...tokens.map((t) => len(t.base)), 8);
  return { tokens, spread, ligands: ligandTokens };
}

// One run of the ribbon as a surface: u along the run, v round its cross
// section (an ellipse: wide and thin for helices and strands, round for
// loops; a strand ends in an arrowhead).
function ribbonRun(k, run, token, scheme) {
  const pts = run.pts;
  const m = pts.length;
  if (m < 2) return;
  const size = (i) => {
    if (run.kind === "H") return [1.15, 0.28];
    if (run.kind === "E") {
      // The arrowhead over the strand's last residue (6 points).
      const left = m - 1 - i;
      return left < 6 ? [0.3 + (left / 6) * 1.5, 0.28] : [1.0, 0.28];
    }
    return [0.42, 0.42];
  };
  const at = (u) => {
    const x = u * (m - 1);
    const i = Math.min(m - 2, Math.floor(x));
    const f = x - i;
    const a = pts[i];
    const b = pts[i + 1];
    const [wa, ha] = size(i);
    const [wb, hb] = size(i + 1);
    return {
      p: lerp(a.p, b.p, f),
      side: unit(lerp(a.side, b.side, f)),
      normal: unit(lerp(a.normal, b.normal, f)),
      w: wa + (wb - wa) * f,
      h: ha + (hb - ha) * f,
      res: f < 0.5 ? a.res : b.res,
    };
  };
  const shape = k.param(
    (u, v) => {
      const q = at(u);
      const t = v * TAU;
      return add(q.p, add(mul(q.side, Math.cos(t) * q.w), mul(q.normal, Math.sin(t) * q.h)));
    },
    {
      grid: Math.min(96, 8 + m),
      normal: (u, v) => {
        const q = at(u);
        const t = v * TAU;
        return add(mul(q.side, Math.cos(t) * q.h), mul(q.normal, Math.sin(t) * q.w));
      },
    },
  );
  k.add(shape, {
    kind: "token",
    params: [token, 0],
    flat: 0.3,
    even: true,
    pattern: true,
    color: (c) => {
      const q = at(c.u);
      const col = residueColour(scheme, run.chain, q.res / Math.max(1, run.n - 1), run.kind);
      return gloss(lit(col, c.n, 0.6, 0.45), c.n, 0.35, 18);
    },
  });
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
        choices: Object.entries(ORBITALS)
          .filter(([, o]) => !o.hidden)
          .map(([id, o]) => ({ id, label: o.label })),
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
    controls: [{ key: "excite", label: "Excite", type: "pulse", ease: 5.2 }],
    action: { key: "excite", label: "Excite the electron" },
    // A tap sends in a photon (a wiggle of light) that the electron
    // absorbs: its cloud jumps to a bigger, higher-energy orbital and glows.
    // A moment later it drops back to where it was, with a flash, and
    // gives the photon out again.
    drive(t, c, out) {
      const p = progress(c.excite);
      const on = c.excite > 0 ? 1 : 0;
      const up = ease(band(p, 0.08, 0.17));
      const down = ease(band(p, 0.56, 0.64));
      const high = on * up * (1 - down);
      out.parts.ground = {
        visible: (1 - high) * (1 + 0.6 * on * bump(p, 0.58, 0.62, 0.66, 0.8)),
        scale: 1 + 0.25 * high,
      };
      out.parts.excited = { visible: 1.2 * high, scale: 1 + 0.3 * up - 0.2 * down };
      const inP = band(p, 0, 0.09);
      out.parts.photonIn = {
        offset: mul(PHOTON_IN, 2.4 * (1 - inP)),
        visible: on * (p < 0.09 ? 1 : 0),
      };
      const outP = band(p, 0.58, 0.95);
      out.parts.photonOut = {
        offset: mul(PHOTON_OUT, 0.2 + 2.4 * outP),
        visible: on * bump(p, 0.58, 0.6, 0.85, 0.95),
      };
      out.parts.flash = {
        visible: on * (1.6 * bump(p, 0.07, 0.09, 0.1, 0.18) + 2 * bump(p, 0.57, 0.6, 0.62, 0.75)),
      };
      out.amount = 1 + 0.6 * high;
    },
    build(k, o) {
      const orb = ORBITALS[o.orbital] || ORBITALS["3dz2"];
      const ground = k.part("ground");
      const lobes = o.look === "lobes";
      const look = { plus: o.plus, minus: o.minus, lobes };
      orbitalLook(k, orb, { ...look, part: ground, cloudShare: lobes ? 0.2 : 0.46 });
      // The nucleus: a tiny bright dot at the centre, with a soft glow.
      k.add(k.sphere(0.03), { share: 0.01, color: (c) => gloss("#fff3c4", c.n, 0.6, 8) });
      k.cloud({ share: 0.01, size: 1.4, pattern: false }, (rand) => ({
        p: mul(randDir(rand), 0.06 * Math.abs(gauss(rand))),
        color: "#fff0b3",
        opacity: 0.25,
        kind: "twinkle",
        params: [0.6, rand() * TAU],
      }));
      // The excited orbital (hidden until a tap): the next shape up, drawn
      // the same way, a little brighter, at the same size and grown by its
      // part.
      const hi = ORBITALS[EXCITE[o.orbital] || "4fz3"];
      orbitalLook(k, hi, { ...look, part: k.part("excited"), cloudShare: 0.12, weight: 0.8, fit: 0.95, glow: 0.2 }); // prettier-ignore
      // The photons: short wiggles of light, one coming in and one going out.
      for (const [name, dir, col] of [
        ["photonIn", PHOTON_IN, "#bfe8ff"],
        ["photonOut", PHOTON_OUT, "#fff2a8"],
      ]) {
        const [e1] = basis(dir);
        k.cloud({ share: 0.01, size: 1.2, pattern: false, part: k.part(name) }, (rand) => {
          const u = rand() * 2 - 1;
          const env = Math.exp(-u * u * 3);
          return {
            p: add(mul(dir, u * 0.35), mul(e1, 0.07 * env * Math.sin(u * 22))),
            color: mix(col, "#ffffff", 0.4 * rand()),
            opacity: 0.9 * env + 0.1,
          };
        });
      }
      // A flash at the middle as the photon is taken in and given out.
      k.cloud({ share: 0.01, size: 2.4, pattern: false, part: k.part("flash") }, (rand) => ({
        p: mul(randDir(rand), 0.3 * Math.pow(rand(), 1.5)),
        color: mix("#ffffff", "#fff0b0", rand()),
        opacity: 0.3,
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
    controls: [
      { key: "speed", label: "Electrons", type: "slider", default: 0.5 },
      { key: "energy", label: "Energise", type: "pulse", ease: 4.6 },
    ],
    action: { key: "energy", label: "Speed up the electrons" },
    // A tap energises the atom: the electrons whirl faster and faster until
    // each shell blurs into a glowing ring (as a fast electron is better
    // pictured, a cloud round its orbit), then slow down again.
    drive(t, c, out) {
      const m = mem(c);
      const p = progress(c.energy);
      const on = c.energy > 0 ? 1 : 0;
      const boost = on * 16 * ease(band(p, 0, 0.32)) * (1 - ease(band(p, 0.6, 1)));
      const a = turning(m, "a", t, 0.3 + 1.7 * c.speed + boost);
      for (let i = 0; i < 7; i++) out.parts[`shell${i}`] = { angle: a * shellSpeed(i) };
      const blur = band(boost, 3, 13);
      out.parts.blur = { visible: 1.2 * blur };
      out.parts.fuzz = { scale: 1 + 0.12 * blur, visible: 1 + 0.6 * blur };
      out.amount = 1 + 2 * blur;
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
        const fuzz = k.part("fuzz");
        shells.forEach((n, i) => {
          k.cloud(
            { share: (0.6 * Math.sqrt(n)) / total, size: 1.2, pattern: false, part: fuzz },
            (rand) => {
              const r = shellR(i) + 0.05 * gauss(rand);
              return {
                p: mul(randDir(rand), r),
                color: mix("#6fd3ff", "#b388ff", i / 6),
                opacity: 0.12 + 0.1 * rand(),
                kind: "twinkle",
                params: [0.6, rand() * TAU],
              };
            },
          );
        });
        k.cloud({ share: 0.02, size: 2.5, pattern: false }, (rand) => ({
          p: mul(randDir(rand), nucR * 1.2 * rand()),
          color: "#ffb4a0",
          opacity: 0.12,
        }));
        return;
      }
      const blur = k.part("blur");
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
        // The blur (hidden until a tap): the shell's electrons smeared
        // into a glowing ring round their orbit.
        k.cloud({ share: 0.012 * Math.sqrt(n), size: 1.3, pattern: false, part: blur }, (rand) => {
          const a = rand() * TAU;
          const p = mul(add(mul(e1, Math.cos(a)), mul(e2, Math.sin(a))), R);
          return {
            p: add(p, mul(randDir(rand), 0.03 * Math.abs(gauss(rand)))),
            color: mix("#36c9ff", "#d8f6ff", rand() * rand()),
            opacity: 0.35,
            kind: "twinkle",
            params: [0.5, rand() * TAU],
          };
        });
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
          { id: "custom", label: "Your own (below)" },
        ],
      },
      // Your own molecule: typed text (a name, formula or SMILES) or a
      // molecule from a file, packed (set from the panel, not shown).
      { key: "source", label: "Your molecule", type: "text", default: "", hidden: true },
    ],
    input: MOLECULE_INPUT,
    controls: [{ key: "heat", label: "Heat", type: "pulse", ease: 4.4 }],
    action: { key: "heat", label: "Heat it up" },
    // The atoms always jiggle a little on their bonds. A tap heats the
    // molecule: every bond stretches and squeezes hard at its own pace
    // (light hydrogens swing furthest), then it cools and calms. Each atom
    // (for the buckyball, each of its twelve pentagons, which also breathe
    // in and out together) is a token that moves on its own.
    drive(t, c, out, info) {
      const D = info.data;
      if (!D?.bonds) return;
      const p = progress(c.heat);
      const on = c.heat > 0 ? 1 : 0;
      const amp = 0.15 + 0.85 * on * bump(p, 0, 0.1, 0.5, 1);
      const disp = D.tokens.map(() => [0, 0, 0]);
      for (const b of D.bonds) {
        const d = amp * b.L * 0.1 * Math.sin(TAU * b.f * t + b.ph);
        const ma = D.tokens[b.a].mass;
        const mb = D.tokens[b.b].mass;
        disp[b.a] = add(disp[b.a], mul(b.u, (-d * mb) / (ma + mb)));
        disp[b.b] = add(disp[b.b], mul(b.u, (d * ma) / (ma + mb)));
      }
      if (D.breathe) {
        const r = amp * 0.07 * Math.sin(TAU * 1.6 * t);
        D.tokens.forEach((tk, i) => (disp[i] = add(disp[i], mul(tk.dir, r * len(tk.base)))));
      }
      out.tokens = D.tokens.map((tk, i) => ({ base: tk.base, offset: disp[i] }));
    },
    build(k, o) {
      let mol = null;
      if (o.molecule === "custom" && o.source) {
        try {
          mol = checkSize(
            o.source.startsWith("M1;") ? unpackMolecule(o.source) : moleculeFromText(o.source),
          );
          const name = mol.name || (o.source.startsWith("M1;") ? "" : o.source);
          MOLECULE_SHOWN.label = `${name ? `${name.slice(0, 40)} · ` : ""}${formulaOf(mol.atoms)} · ${mol.atoms.length} atoms`; // prettier-ignore
        } catch (err) {
          mol = null;
          MOLECULE_SHOWN.label = `Caffeine (yours could not be read: ${err.message})`;
        }
      } else MOLECULE_SHOWN.label = "";
      const { atoms, bonds } = mol
        ? { atoms: mol.atoms.map((a) => ({ ...a, p: a.p.slice() })), bonds: mol.bonds }
        : (MOLECULES[o.molecule] || MOLECULES.caffeine)();
      // Any element: its colour and a size from its covalent radius.
      for (const a of atoms) {
        if (CPK[a.el]) continue;
        a.color = element(a.el)?.color || "#ff66cc";
        a.r = 0.14 + 0.3 * covalentRadius(a.el);
      }
      // Turn flat molecules a little so they show some depth.
      const q = quatAxisAngle([0.3, 1, 0], o.molecule === "c60" ? 0.3 : -0.35);
      for (const a of atoms) a.p = quatRotate(q, a.p);
      // One token per atom; the buckyball's sixty atoms go by pentagon, and
      // a big molecule of your own by groups (a hydrogen goes with its atom).
      const c60 = o.molecule === "c60" && !mol;
      const tokenOf = c60
        ? pentagonOf(atoms)
        : atoms.length > 48
          ? tokenGroups(atoms, bonds)
          : atoms.map((a, i) => i);
      const n = Math.max(...tokenOf) + 1;
      const MASS = new Proxy({ H: 1, C: 12, N: 14, O: 16 }, { get: (m, el) => m[el] ?? 2 * (element(el)?.z ?? 6) }); // prettier-ignore
      const tokens = Array.from({ length: n }, () => ({ base: [0, 0, 0], mass: 0, count: 0 }));
      atoms.forEach((a, i) => {
        const tk = tokens[tokenOf[i]];
        tk.base = add(tk.base, a.p);
        tk.mass += MASS[a.el] ?? 12;
        tk.count++;
      });
      for (const tk of tokens) {
        tk.base = mul(tk.base, 1 / tk.count);
        tk.dir = unit(tk.base);
      }
      const heavy = (a) => a.el !== "H";
      const list = [];
      bonds.forEach(([i, j], bi) => {
        if (tokenOf[i] === tokenOf[j]) return;
        const d = sub(atoms[j].p, atoms[i].p);
        const L = len(d);
        const light = !heavy(atoms[i]) || !heavy(atoms[j]);
        list.push({
          a: tokenOf[i],
          b: tokenOf[j],
          u: mul(d, 1 / L),
          L,
          f: (light ? 3.1 : 2.1) * (0.85 + 0.3 * ((bi * 0.618) % 1)),
          ph: (bi * 2.39996) % TAU,
        });
      });
      k.data = { tokens, bonds: list, breathe: c60 };
      ballStick(k, atoms, bonds, {
        bondR: c60 ? 0.08 : 0.1,
        token: (i) => tokenOf[i],
        overlap: 0.09,
      });
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
    controls: [{ key: "wave", label: "Wave", type: "pulse", ease: 3.8 }],
    action: { key: "wave", label: "Send a wave through" },
    // A tap sends a wave of vibration (a phonon) through the crystal: a
    // ripple runs across it from left to right, each slice of atoms rising
    // and falling in turn with its bonds, and leaves it still again.
    drive(t, c, out, info) {
      const D = info.data;
      if (!D?.slabs) return;
      const p = progress(c.wave);
      const on = c.wave > 0 ? 1 : 0;
      const front = -1.6 + 3.3 * band(p, 0, 0.92);
      D.slabs.forEach((sk, i) => {
        const x = sk - front;
        const y = on * 0.13 * Math.exp(-(x * x) / (2 * 0.3 * 0.3)) * Math.sin(x * 7);
        out.parts[`slab${i}`] = { offset: mul(D.up, y) };
      });
    },
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
      // Every crystal is scaled to the same size (the toy is fitted to its
      // frame anyway), so the wave's height suits them all.
      const ext = Math.max(...lat.atoms.map((a) => len(a.p)));
      const f = 1.5 / ext;
      for (const a of lat.atoms) {
        a.p = mul(a.p, f);
        a.r = (a.r ?? CPK[a.el]?.r ?? 0.3) * f;
      }
      lat.bondR *= f;
      if (lat.hbonds) lat.hbonds = lat.hbonds.map(([a, b]) => [mul(a, f), mul(b, f)]);
      // Slices across the view, left to right, each a part the wave lifts.
      const right = unit(cross([0, 1, 0], VIEW));
      const up = cross(VIEW, right);
      const across = lat.atoms.map((a) => dot(a.p, right));
      const lo = Math.min(...across);
      const hi = Math.max(...across);
      const SLABS = 14;
      const slabAt = (p) =>
        Math.min(
          SLABS - 1,
          Math.max(0, Math.floor(((dot(p, right) - lo) / (hi - lo + 1e-6)) * SLABS)),
        );
      const slabs = [];
      for (let i = 0; i < SLABS; i++) slabs.push(k.part(`slab${i}`));
      k.data = {
        up,
        slabs: slabs.map((_, i) => ((lo + ((i + 0.5) / SLABS) * (hi - lo)) / (hi - lo)) * 2),
      };
      ballStick(k, lat.atoms, lat.bonds, {
        bondR: lat.bondR,
        vibrate: 0.012,
        glint: lat.glint || 0,
        grey: lat.grey || null,
        part: (i) => slabs[slabAt(lat.atoms[i].p)],
        overlap: 0.02,
      });
      if (lat.hbonds) {
        // Hydrogen bonds: dotted lines from each hydrogen to its neighbour's oxygen.
        k.cloud({ share: 0.03, size: 0.9, pattern: false }, (rand, i, n) => {
          const [a, b] = lat.hbonds[i % lat.hbonds.length];
          const t = 0.18 + (0.64 * Math.floor(rand() * 6)) / 5;
          const p = add(lerp(a, b, t), mul(randDir(rand), 0.03 * f));
          return { p, color: "#7fc4ff", opacity: 0.9, part: slabs[slabAt(p)] };
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
            const p = lerp(a, b, t);
            return { p, color: "#9aa3b5", opacity: 0.9, part: slabs[slabAt(p)] };
          });
      }
    },
  },

  // ---- Protein ----------------------------------------------------------------------------
  protein: {
    alive: true,
    options: [
      {
        key: "protein",
        label: "Protein",
        type: "select",
        default: "ubiquitin",
        choices: [
          ...Object.entries(PROTEINS).map(([id, p]) => ({ id, label: p.label })),
          { id: "file", label: "Your own (below)" },
        ],
      },
      {
        key: "colour",
        label: "Colour",
        type: "select",
        default: "rainbow",
        choices: [
          { id: "rainbow", label: "Rainbow, start to end" },
          { id: "chain", label: "By chain" },
          { id: "structure", label: "Helices, strands, loops" },
        ],
      },
      // The name of a file opened in the panel (the structure stays here).
      { key: "fileName", label: "File", type: "text", default: "", hidden: true },
    ],
    input: PROTEIN_INPUT,
    credits: [
      {
        label: "Protein structures",
        title: "RCSB Protein Data Bank entries 1UBQ, 4INS, 1EMA and 4HHB",
        source: "https://www.rcsb.org/",
        author: "the wwPDB and the structures' authors",
        license: "CC0 1.0",
        licenseUrl: "https://creativecommons.org/publicdomain/zero/1.0/",
      },
    ],
    // The structure is read before the build (a fetch in the browser).
    async prepare(o) {
      if (o.protein === "file" && PROTEIN_FILE.structure) return;
      const def = PROTEINS[o.protein] || PROTEINS.ubiquitin;
      if (PROTEIN_CACHE.has(def.file)) return;
      const text = await readAsset(`../../assets/proteins/${def.file}.pdb`);
      PROTEIN_CACHE.set(def.file, centreStructure(parseStructure(text, `${def.file}.pdb`)));
    },
    controls: [{ key: "apart", label: "Pull apart", type: "pulse", ease: 5 }],
    action: { key: "apart", label: "Pull it apart" },
    // A tap pulls the protein apart into its pieces: every helix, strand
    // and loop (and each bound molecule) moves straight out from the middle,
    // turning a little, so you can see what it is made of, then they all
    // come back and lock together. In GFP the chromophore in the middle of
    // the barrel glows green while the barrel is open.
    drive(t, c, out, info) {
      const D = info.data;
      if (!D?.tokens) return;
      const p = progress(c.apart);
      const on = c.apart > 0 ? 1 : 0;
      const e = on * ease(band(p, 0, 0.3)) * (1 - ease(band(p, 0.58, 0.95)));
      out.tokens = D.tokens.map((tk, i) => {
        const r = len(tk.base);
        const away = Math.min(1, r / (0.25 * D.spread));
        const d = D.spread * (0.35 + 0.2 * ((i * 0.618) % 1)) * away;
        return {
          base: tk.base,
          offset: mul(unit(r > 1e-3 ? tk.base : [0, 1, 0]), d * e),
          quat: quatAxisAngle(tk.axis, 0.6 * e * tk.spin),
        };
      });
      if (D.glow) out.parts.glow = { visible: 1.3 * e };
    },
    build(k, o) {
      let s = null;
      let label = "";
      if (o.protein === "file" && PROTEIN_FILE.structure) {
        s = PROTEIN_FILE.structure;
        label = PROTEIN_FILE.name;
      } else {
        const def = PROTEINS[o.protein] || PROTEINS.ubiquitin;
        s = PROTEIN_CACHE.get(def.file) || PROTEIN_CACHE.get("1ubq");
        label = def.label;
        if (o.protein === "file") label = `${def.label} (open your file again to see it)`;
      }
      if (!s) throw new Error("The protein was not loaded.");
      const residues = s.chains.reduce((n, ch) => n + ch.residues.length, 0);
      PROTEIN_SHOWN.label = `${label} · ${s.chains.length} chain${s.chains.length > 1 ? "s" : ""}, ${residues} residues`; // prettier-ignore
      const built = buildProtein(k, s, o.colour);
      const rand = k.rand;
      const tokens = built.tokens.map((tk) => ({
        ...tk,
        axis: unit([rand() - 0.5, rand() - 0.5, rand() - 0.5]),
        spin: rand() < 0.5 ? -1 : 1,
      }));
      // GFP's glow: a green haze round the chromophore (hidden until a tap).
      const cro = built.ligands.find((l) => l.lig.name === "CRO");
      if (cro) {
        const at = tokens[cro.id].base;
        k.cloud({ share: 0.02, size: 3, pattern: false, part: k.part("glow") }, (rnd) => {
          const d = unit([rnd() - 0.5, rnd() - 0.5, rnd() - 0.5]);
          const rr = 7 * Math.pow(rnd(), 1.6);
          return {
            p: add(at, mul(d, rr)),
            color: mix("#b6ff9a", "#3fe07a", rr / 7),
            opacity: 0.22 * (1 - rr / 7) + 0.02,
          };
        });
      }
      k.data = { tokens, spread: built.spread, glow: !!cro };
    },
  },
};

// The directions the orbital's photons travel: in from the upper left, out
// towards the lower right (both in the picture plane).
const PHOTON_IN = unit([-0.75, 0.62, 0.2]);
const PHOTON_OUT = unit([0.8, -0.35, -0.1]);

// Keeps a splat out of the pattern layer.
function keep(c) {
  return { c, keep: true };
}
