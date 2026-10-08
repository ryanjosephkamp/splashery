// Lattices and orbitals pack (lane Lattices and orbitals, labs): real crystal
// unit cells, built from published lattice constants and atom positions, and
// an atlas of hydrogen orbitals sampled from |psi|².
//
// Unit cells: the crystal's conventional cell, a block of n × n × n cells and
// its bonds, a tap stepping from one to the next. Atoms are solid spheres
// with their true relative radii (src/lattice/cells.js says which radii).
// The stages:
//   cell:  the central cell, zoomed to fill the view; the other atoms are
//          hidden (their parts shrunk to the cell's center).
//   block: every cell; the shells of cells around the central one grow out
//          of it, nearest first, as the view zooms out.
//   bonds: every atom moves out from the cell's center by a factor E (a
//          morph) while its part shrinks by 1/E about the same point, so
//          each atom stays where it is and shrinks to a ball 1/E its size,
//          and the bonds between nearest neighbors show (ball and stick).
//          With Thermal motion on, each atom becomes one Gaussian whose
//          spread is its measured mean-square displacement (U = B / 8π²):
//          the Debye–Waller factor drawn as the splat it already is.
//
// Orbital atlas: every hydrogen orbital of n = 1 to 5, and 6s, 6p, 6d, 7s and
// 7p, drawn as the Electron orbital toy draws its newer orbitals (a boundary
// surface holding 90% of the electron and a cloud sampled from |psi|², in
// the two phase colors). A tap cuts it in half and lifts the front half away,
// so the cut face shows the density in the plane of the cut, nodes and all.

import { mix, shade, clamp } from "../kit.js";
import { evenCylinder } from "./even.js";
import {
  CRYSTALS,
  CRYSTAL_ORDER,
  blockAtoms,
  findBonds,
  addIceHydrogens,
  cellAxes,
  toCart,
} from "../lattice/cells.js";
import {
  orbital,
  orbitalList,
  radialSampler,
  sampleDirection,
  LETTERS,
} from "../lattice/orbitals.js";

const TAU = Math.PI * 2;
const add = (a, b) => [a[0] + b[0], a[1] + b[1], a[2] + b[2]];
const sub = (a, b) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
const mul = (a, s) => [a[0] * s, a[1] * s, a[2] * s];
const dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
const len = (a) => Math.hypot(a[0], a[1], a[2]);
const unit = (a) => mul(a, 1 / (len(a) || 1));
const lerp = (a, b, t) => add(a, mul(sub(b, a), t));

// A pulse control's progress: 0 at the tap, 1 when done (and at rest).
const progress = (v) => (v > 0 ? 1 - v : 1);
const ease = (x) => {
  const t = clamp(x, 0, 1);
  return t * t * (3 - 2 * t);
};
const band = (x, a, b) => clamp((x - a) / (b - a), 0, 1);

// A soft key light from the upper left front, baked into the colors.
const LIGHT = unit([-0.45, 0.75, 0.5]);
const HALF = unit(add(LIGHT, [0, 0, 1]));
const lit = (col, n, amb = 0.6, k = 0.5) => shade(col, amb + k * Math.max(0, dot(n, LIGHT)));
const gloss = (col, n, amt = 0.45, pow = 18) =>
  mix(col, "#ffffff", amt * Math.pow(Math.max(0, dot(n, HALF)), pow));

// ---- Unit cells ----------------------------------------------------------------------

// Chemistry's axes (c along z) -> the toy's (c up, along +Y).
const toToyAxes = (p) => [p[0], p[2], -p[1]];

// The default view's right-hand direction (the camera's yaw is 0.55).
const VIEW_RIGHT = [Math.cos(0.55), 0, Math.sin(0.55)];
// How far the bonds stage spreads the atoms (and shrinks them).
const SPREAD = 2.5;
// The stages, in the order a tap steps through them.
const STAGES = ["cell", "block", "bonds"];
const STEP_SECS = 2.4;

// The look of each stage: the zoom on the central cell (z: 1 is the block),
// how far the shells of cells have grown out (g1, g2, g3), the spread of the
// bonds stage (e), and how much of the cell's outline and the bonds show.
function stageLook(stage, D) {
  if (stage === "cell") return { z: D.zoom, g: [0, 0, 0], e: 0, edges: 1, bonds: 0 };
  if (stage === "block") return { z: 1, g: [1, 1, 1], e: 0, edges: 0, bonds: 0 };
  return { z: 1, g: [1, 1, 1], e: 1, edges: 0.85, bonds: 1 };
}

// Mixes two stage looks at time p (0..1) of the step from a to b. Shells
// grow out one after another (nearest first) and draw back in the other
// order; the zoom and the spread run through the whole step.
function stepLook(a, b, p) {
  const A = stageLook(a.stage, a.D);
  const B = stageLook(b.stage, b.D);
  const m = (x, y, t) => x + (y - x) * t;
  // Zooming out runs ahead of the shells; zooming in waits for them.
  const zt = B.z > A.z ? ease(band(p, 0.4, 0.95)) : ease(band(p, 0.02, 0.5));
  const growing = B.g[0] > A.g[0];
  const shells = [0, 1, 2].map((i) => {
    const t = growing ? band(p, 0.25 + 0.18 * i, 0.6 + 0.18 * i) : band(p, 0.26 - 0.12 * i, 0.5 - 0.12 * i); // prettier-ignore
    return m(A.g[i], B.g[i], ease(t));
  });
  const et = ease(band(p, 0.08, 0.8));
  return {
    z: m(A.z, B.z, zt),
    g: shells,
    e: m(A.e, B.e, et),
    edges: m(A.edges, B.edges, ease(band(p, 0.2, 0.9))),
    bonds: m(A.bonds, B.bonds, ease(band(p, B.bonds > A.bonds ? 0.45 : 0, B.bonds > A.bonds ? 0.95 : 0.35))), // prettier-ignore
  };
}

// The atom colors by finish: a gem (diamond), satin (graphite, ice) or metal.
function atomColor(base, finish, n) {
  if (finish === "metal") {
    // Softly lit metal: a broad sheen and a darker rim, no mirror chrome.
    const facing = Math.max(0, n[2] * 0.6 + 0.4);
    return gloss(lit(shade(base, 0.75 + 0.3 * facing), n, 0.5, 0.6), n, 0.55, 10);
  }
  if (finish === "gem") return gloss(lit(base, n, 0.62, 0.45), n, 0.7, 24);
  return gloss(lit(base, n, 0.6, 0.5), n, 0.35, 14);
}

function buildUnitCells(k, o) {
  const crystal = CRYSTALS[o.crystal] || CRYSTALS.diamond;
  const n = clamp(Math.round(Number(o.cells) || 3), 1, 4);
  let atoms = blockAtoms(crystal, n);
  if (crystal.hydrogens) atoms = addIceHydrogens(crystal, atoms, k.rand);
  const bonds = findBonds(crystal, atoms);
  const axes = cellAxes(crystal.cell);
  // A hexagonal block (a rhombic prism) is turned about the up axis so its
  // long diagonal runs across the default view, not toward the camera.
  let th = 0;
  if (crystal.cell.gamma !== 90) {
    const diag = toToyAxes(toCart(axes, [1, 1, 0]));
    th = Math.atan2(diag[2], diag[0]) - Math.atan2(VIEW_RIGHT[2], VIEW_RIGHT[0]);
  }
  const T = (p) => {
    const q = toToyAxes(p);
    const c = Math.cos(th);
    const s = Math.sin(th);
    return [q[0] * c + q[2] * s, q[1], -q[0] * s + q[2] * c];
  };
  // The central cell (for an even count, the one just below the middle).
  const c0 = Math.floor((n - 1) / 2);
  const inCell = (f) => f.every((x) => x >= c0 - 1e-6 && x <= c0 + 1 + 1e-6);
  const pivot = T(toCart(axes, [c0 + 0.5, c0 + 0.5, c0 + 0.5]));
  const center = T(toCart(axes, [n / 2, n / 2, n / 2]));
  const radius = (el) => crystal.radius[el] ?? 0.5;

  // Parts: the central cell's atoms, three shells of cells around it, the
  // bonds, the cell's outline and the thermal Gaussians.
  const P = {};
  for (const name of ["cell", "shell1", "shell2", "shell3", "bonds", "edges", "thermal", "balls"])
    P[name] = k.part(name, { pivot });
  const shellOf = (a) => {
    if (inCell(a.f)) return 0;
    return Math.min(3, Math.max(...a.cell.map((x) => Math.abs(x - c0))));
  };
  const partOf = (a) => [P.cell, P.shell1, P.shell2, P.shell3][shellOf(a)];

  const thermal = o.thermal === "true" || o.thermal === "magnified";
  const mag = o.thermal === "magnified" ? 5 : 1;
  const finish = crystal.finish;
  // Every atom: an evenly placed, opaque sphere. Its morph target is its
  // place spread out from the cell's center (or, with thermal motion on,
  // gathered to its center, so it shrinks away and its Gaussian shows).
  const toyAtoms = atoms.map((a) => ({ ...a, q: T(a.p), r: radius(a.el) }));
  for (const a of toyAtoms) {
    const target = add(pivot, mul(sub(a.q, pivot), SPREAD));
    const keep = thermal ? 0.03 : 1;
    const col = crystal.color[a.el] || "#cccccc";
    k.add(k.sphere(a.r), {
      pos: a.q,
      even: true,
      opacity: 1,
      jitter: 0.01,
      // Thin splats lying on the surface, overlapping a little more than the
      // kit's: a smooth, solid ball (no mottle) under the sharp kernel.
      flat: 0.2,
      size: 1.25,
      weight: a.el === "H" ? 1.6 : 1,
      part: partOf(a),
      pattern: false,
      to: (c) => add(target, mul(sub(c.p, a.q), keep)),
      channel: 0,
      color: (c) => atomColor(col, finish, c.n),
    });
    // The same atom as a ball 1/SPREAD its size, for the settled bonds view:
    // the spread-and-shrunk atom ends exactly here, so the swap is unseen,
    // and the morph channel is back at 0 whenever the toy rests.
    if (!thermal)
      k.add(k.sphere(a.r / SPREAD), {
        pos: a.q,
        even: true,
        opacity: 1,
        jitter: 0.01,
        flat: 0.2,
        size: 1.25 / Math.sqrt(SPREAD),
        weight: (a.el === "H" ? 1.6 : 1) * SPREAD,
        part: P.balls,
        pattern: false,
        color: (c) => atomColor(col, finish, c.n),
      });
  }
  k.fitMorphs = false;
  // Frame the block (its atoms' outer edges).
  const rmax = Math.max(...toyAtoms.map((a) => a.r));
  let far = 0;
  for (const a of toyAtoms) far = Math.max(far, len(sub(a.q, center)) + a.r);
  for (const d of [[1, 0, 0], [-1, 0, 0], [0, 1, 0], [0, -1, 0], [0, 0, 1], [0, 0, -1]]) k.reach(add(center, mul(d, far))); // prettier-ignore

  // Bonds (ball and stick): rods between the atoms' centers, sized for the
  // shrunk balls. Hydrogen bonds (ice) are dotted.
  const main = Math.max(...Object.values(crystal.radius));
  const bondR = ((finish === "metal" ? 0.2 : 0.3) * main) / SPREAD;
  const hb = [];
  for (const [i, j, kind] of bonds) {
    const A = toyAtoms[i];
    const B = toyAtoms[j];
    if (kind === "hydrogen") {
      hb.push([A.q, B.q]);
      continue;
    }
    const d = sub(B.q, A.q);
    const L = len(d);
    const u = mul(d, 1 / L);
    const quat = quatFromY(u);
    // Each half in its own atom's color (lighter for metals: contacts).
    for (const [from, to, atom] of [
      [A.q, lerp(A.q, B.q, 0.5), A],
      [lerp(A.q, B.q, 0.5), B.q, B],
    ]) {
      const col = mix(
        crystal.color[atom.el] || "#cccccc",
        "#ffffff",
        finish === "metal" ? 0.25 : 0.1,
      );
      k.add(evenCylinder(bondR, bondR, L / 2, false), {
        pos: lerp(from, to, 0.5),
        quat,
        even: true,
        opacity: 1,
        jitter: 0.01,
        flat: 0.3,
        weight: 1.4,
        part: P.bonds,
        pattern: false,
        color: (c) => lit(col, c.n, 0.62, 0.45),
      });
    }
  }
  if (hb.length)
    k.cloud({ share: 0.02, size: 0.8, pattern: false, part: P.bonds }, (rand, i) => {
      const [a, b] = hb[i % hb.length];
      // Dots from just off the hydrogen to just off the oxygen.
      const t = 0.12 + (0.76 * Math.floor(rand() * 8)) / 7;
      return { p: lerp(a, b, t), color: "#8fd0ff", opacity: 1 };
    });

  // The central cell's outline: its twelve edges as fine dotted lines.
  const corner = (i, j, l) => T(toCart(axes, [c0 + i, c0 + j, c0 + l]));
  const edges = [];
  for (const [
    a,
    b,
  ] of [
    [[0, 0, 0], [1, 0, 0]], [[0, 1, 0], [1, 1, 0]], [[0, 0, 1], [1, 0, 1]], [[0, 1, 1], [1, 1, 1]],
    [[0, 0, 0], [0, 1, 0]], [[1, 0, 0], [1, 1, 0]], [[0, 0, 1], [0, 1, 1]], [[1, 0, 1], [1, 1, 1]],
    [[0, 0, 0], [0, 0, 1]], [[1, 0, 0], [1, 0, 1]], [[0, 1, 0], [0, 1, 1]], [[1, 1, 0], [1, 1, 1]],
  ]) // prettier-ignore
    edges.push([corner(...a), corner(...b)]);
  const edgeLen = edges.reduce((s, [a, b]) => s + len(sub(b, a)), 0);
  k.cloud({ share: 0.03, size: 0.22, pattern: false, part: P.edges }, (rand, i, count) => {
    // Evenly along the twelve edges.
    let s = ((i + 0.5) / count) * edgeLen;
    for (const [a, b] of edges) {
      const L = len(sub(b, a));
      if (s <= L) return { p: lerp(a, b, s / L), color: "#a99c84", opacity: 1 };
      s -= L;
    }
    return { p: edges[0][0], color: "#a99c84", opacity: 1 };
  });

  // Thermal motion: one Gaussian per atom, its spread along each axis the
  // root of the mean-square displacement U (Å²) there.
  if (thermal) {
    const list = toyAtoms;
    k.cloud({ share: Math.min(0.2, list.length / 100000 + 0.004), pattern: false, part: P.thermal }, (rand, i) => {
      const a = list[i % list.length];
      const U = crystal.U[a.el] || [0.01, 0.01, 0.01];
      // U is along chemistry's x, y, z; the toy's axes are x, z, −y.
      const s = [Math.sqrt(U[0]), Math.sqrt(U[2]), Math.sqrt(U[1])].map((x) => x * mag);
      return {
        p: a.q,
        scales: s,
        quat: [0, 0, 0, 1],
        color: mix(crystal.color[a.el] || "#cccccc", "#ffffff", 0.35),
        opacity: 1,
      };
    }); // prettier-ignore
  }

  // The zoom that makes the central cell fill the view.
  let cellFar = 0;
  for (const a of toyAtoms)
    if (inCell(a.f)) cellFar = Math.max(cellFar, len(sub(a.q, pivot)) + a.r);
  for (const [a] of edges) cellFar = Math.max(cellFar, len(sub(a, pivot)));
  k.data = {
    zoom: Math.max(1, (0.92 * far) / Math.max(cellFar, rmax)),
    pivot,
    center,
    thermal,
    start: Math.max(0, STAGES.indexOf(o.view)),
  };
}

// A quaternion turning +Y onto u.
function quatFromY(u) {
  const d = clamp(u[1], -1, 1);
  if (d > 0.999999) return [0, 0, 0, 1];
  if (d < -0.999999) return [1, 0, 0, 0];
  const axis = unit([u[2], 0, -u[0]]);
  const h = Math.acos(d) / 2;
  const s = Math.sin(h);
  return [axis[0] * s, axis[1] * s, axis[2] * s, Math.cos(h)];
}

function driveUnitCells(t, c, out, info) {
  const D = info.data;
  if (!D?.pivot) return;
  const taps = info.tap?.key === "step" ? info.tap.n : 0;
  const cur = STAGES[(D.start + taps) % 3];
  const prev = STAGES[(D.start + taps + 2) % 3];
  const p = progress(c.step);
  const L =
    c.step > 0 && taps > 0 ? stepLook({ stage: prev, D }, { stage: cur, D }, p) : stageLook(cur, D);
  // In the cell stage the central cell moves to the middle of the frame.
  const zt = D.zoom > 1 ? (L.z - 1) / (D.zoom - 1) : 0;
  const offset = mul(sub(D.center, D.pivot), zt);
  const shrink = 1 / (1 + (SPREAD - 1) * L.e);
  const atomScale = (g) => L.z * g * shrink;
  out.parts.cell = { scale: atomScale(1), offset };
  ["shell1", "shell2", "shell3"].forEach((name, i) => {
    const g = L.g[i];
    out.parts[name] = { scale: Math.max(1e-3, atomScale(g)), offset, visible: g > 0.01 ? 1 : 0 };
  });
  out.parts.bonds = { scale: L.z, offset, visible: L.bonds };
  out.parts.edges = { scale: L.z, offset, visible: L.edges };
  out.parts.thermal = { scale: L.z, offset, visible: D.thermal ? L.e : 0 };
  out.morph = [L.e, 0, 0, 0];
  // Settled in the bonds view (at rest, or at the very end of the step into
  // it): the small balls stand in for the spread atoms, which look the same,
  // so the morph channel rests at 0 (or, with thermal motion, the atoms
  // stay gathered away and only their Gaussians show).
  const settled = cur === "bonds" && (c.step <= 0 || taps === 0 || p >= 0.97);
  out.parts.balls = { scale: L.z, offset, visible: settled && !D.thermal ? 1 : 0 };
  if (settled) {
    for (const name of ["cell", "shell1", "shell2", "shell3"]) out.parts[name] = { ...out.parts[name], visible: 0 }; // prettier-ignore
    out.morph = [0, 0, 0, 0];
  }
}

// ---- Orbital atlas -----------------------------------------------------------------------

const ORBITAL_IDS = orbitalList();
const ORBITAL_CACHE = new Map();
const orbitalOf = (id) => {
  if (!ORBITAL_CACHE.has(id)) ORBITAL_CACHE.set(id, orbital(id));
  return ORBITAL_CACHE.get(id);
};
const SHELL_NAMES = ["", "n = 1", "n = 2", "n = 3", "n = 4", "n = 5", "n = 6", "n = 7"];

// Chemistry's (x, y, z) -> the toy's axes: z is up; orbitals that lie in
// the xy plane (|m| = l) face the viewer instead.
const toToy = (orb, d) => (orb.face ? d : [d[0], d[2], -d[1]]);
const toChem = (orb, d) => (orb.face ? d : [d[0], -d[2], d[1]]);

// The plane the tap cuts along: it holds the toy's up axis and the
// horizontal direction where the orbital is densest. Returns its normal.
function cutNormal(orb) {
  if (orb.face) return [0, 0, 1];
  let best = null;
  for (let a = 0; a < 12; a++) {
    const phi = (a / 12) * Math.PI;
    const nrm = [Math.cos(phi), 0, Math.sin(phi)];
    const h = [-Math.sin(phi), 0, Math.cos(phi)];
    // The angular density over the great circle in the plane.
    let s = 0;
    for (let i = 0; i < 180; i++) {
      const w = (i / 180) * TAU;
      const d = toChem(orb, add(mul(h, Math.cos(w)), [0, Math.sin(w), 0]));
      s += orb.Y(d[0], d[1], d[2]) ** 2;
    }
    if (!best || s > best.s * 1.02) best = { s, nrm };
  }
  return best.nrm;
}

// Turns the orbital about the up axis so the plane to cut along faces the
// viewer: (x, z) -> (x cos θ + z sin θ, −x sin θ + z cos θ).
const turnY = (p, th) => {
  const c = Math.cos(th);
  const s = Math.sin(th);
  return [p[0] * c + p[2] * s, p[1], -p[0] * s + p[2] * c];
};

function buildOrbitalAtlas(k, o) {
  const orb = orbitalOf(o.orbital) || orbitalOf("4d");
  const lobes = o.look === "lobes";
  const plus = o.plus;
  const minus = o.minus;
  const radial = radialSampler(orb.R, orb.rmax);
  const E = radial.extent;
  // The cut is the plane facing the viewer (z = 0): the orbital is turned
  // so its densest vertical plane lies there. (Turning the halves to face
  // the viewer instead would draw them out of order: splats sort in the
  // pose they were built in.)
  const nrm = cutNormal(orb);
  const th = Math.atan2(-nrm[0], nrm[2]);
  const place = (d) => turnY(toToy(orb, d), th);
  const unplace = (p) => toChem(orb, turnY(p, -th));
  // The front half lifts away; the back half stays, with the cut face.
  const F = k.part("front", { pivot: [0, 0, 0] });
  const B = k.part("back", { pivot: [0, 0, 0] });
  const C = k.part("cut", { pivot: [0, 0, 0] });
  const half = (p) => (p[2] > 0 ? F : B);

  // Densities of samples: the peak, and the level whose surface holds 90%
  // of the electron (as the Electron orbital toy finds them).
  const dens = [];
  for (let i = 0; i < 4000; i++) {
    const r = radial.sample(k.rand());
    const { y } = sampleDirection(orb, k.rand);
    dens.push((orb.R(r) * y) ** 2);
  }
  dens.sort((a, b) => a - b);
  const peak = dens[dens.length - 1] || 1;
  const level = dens[Math.floor(dens.length * 0.1)];
  // The boundary surface: along a direction with |Y| = y, the outermost
  // radius where psi² reaches the level, tabulated against y.
  const N = 2048;
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
    const d = unplace(dToy);
    const y = Math.abs(orb.Y(d[0], d[1], d[2]));
    const x = Math.min(T, (y / orb.ymax) * T);
    const j = Math.floor(x);
    const f = x - j;
    const r = j >= T ? table[T] : table[j] * (1 - f) + table[j + 1] * f;
    return Math.max(0.004, r / E);
  };
  k.add(k.radial(surfR, { grid: 112 }), {
    part: (c) => half(c.lp),
    flat: 0.15,
    size: 1.2,
    even: true,
    jitter: 0.01,
    opacity: lobes ? 0.95 : 0.36,
    pattern: false,
    color: (c) => {
      // Where the surface dips to the nucleus (along a nodal cone or plane)
      // its splats crowd into lines: leave them out.
      if (len(c.lp) < 0.09) return null;
      // Nor the steep walls the one-radius-per-direction surface draws
      // between lobes (they are not part of the real 90% surface).
      if (Math.abs(dot(c.ln, unit(c.lp))) < 0.3) return null;
      const d = unplace(unit(c.lp));
      const r = len(c.lp) * E;
      const sign = orb.R(r) * orb.Y(d[0], d[1], d[2]) >= 0;
      const base = sign ? plus : minus;
      if (!lobes) return gloss(lit(mix(base, "#ffffff", 0.3), c.n, 0.75, 0.3), c.n, 0.5, 20);
      return gloss(lit(base, c.n, 0.55, 0.55), c.n, 0.45, 16);
    },
  });
  // The cloud: sampled from |psi|², mostly inside the boundary surface so
  // its shape reads; bigger, fainter splats that hold still (a smooth haze).
  k.cloud({ share: lobes ? 0.26 : 0.6, size: 1.5, pattern: false }, (rand) => {
    let r;
    let d;
    let y;
    let psi;
    for (let tries = 0; tries < 12; tries++) {
      r = radial.sample(rand());
      ({ d, y } = sampleDirection(orb, rand));
      psi = orb.R(r) * y;
      if (psi * psi > level * 0.9 || rand() < 0.02) break;
    }
    const tt = clamp((psi * psi) / peak, 0, 1);
    const base = psi >= 0 ? plus : minus;
    const col = mix(shade(base, 0.8), mix(base, "#fffbe8", 0.7), Math.pow(tt, 0.6));
    const p = mul(place(d), r / E);
    return {
      p,
      color: col,
      opacity: (lobes ? 0.35 : 0.1 + 0.55 * Math.pow(tt, 0.6)) * 0.45,
      size: 0.85 + 0.3 * rand(),
      part: half(p),
    };
  });
  // The nucleus: a tiny bright dot at the center, on the cut face.
  k.add(k.sphere(0.022), { share: 0.004, part: B, pattern: false, color: (c) => gloss("#fff3c4", c.n, 0.6, 8) }); // prettier-ignore

  // The cut face: |psi|² in the plane of the cut, on a fine even grid, in
  // the phase colors, brighter where the electron is likelier; dark at the
  // nodes. Just in front of the back half's cut.
  const G = 260;
  const pts = [];
  let fpeak = 0;
  for (let i = 0; i < G; i++)
    for (let j = 0; j < G; j++) {
      const u = ((i + 0.5) / G) * 2 - 1;
      const v = ((j + 0.5) / G) * 2 - 1;
      if (u * u + v * v > 1) continue;
      const p = [u, v, 0];
      const rr = len(p) * E;
      const dc = unplace(len(p) > 1e-9 ? unit(p) : [0, 1, 0]);
      const psi = orb.R(rr) * orb.Y(dc[0], dc[1], dc[2]);
      fpeak = Math.max(fpeak, psi * psi);
      pts.push([p, psi]);
    }
  const shown = pts.filter(([, psi]) => (psi * psi) / fpeak > 0.0015);
  k.cloud({ share: 0.14, size: 0.8, pattern: false, part: C }, (rand, i) => {
    const [p, psi] = shown[i % shown.length];
    const t = Math.sqrt((psi * psi) / fpeak);
    const base = psi >= 0 ? plus : minus;
    return {
      p: [p[0], p[1], 0.004],
      n: [0, 0, 1],
      color: mix(shade(base, 0.35 + 0.65 * Math.min(1, t * 1.4)), "#fffbe8", 0.45 * t * t),
      opacity: clamp(0.25 + 1.2 * t, 0, 1),
    };
  });
  k.data = { cut: true };
}

const OPEN_SECS = 5.5;

function driveOrbitalAtlas(t, c, out, info) {
  if (!info.data?.cut) return;
  const p = progress(c.open);
  const on = c.open > 0 ? 1 : 0;
  // Opens over the first fifth, holds, and closes over the last fifth.
  const e = on * ease(band(p, 0, 0.2)) * (1 - ease(band(p, 0.78, 0.98)));
  // The front half lifts up and to the left, shrinking out of the way; the
  // back half and its cut face settle a little down and to the right.
  out.parts.front = { offset: [-0.6 * e, 0.45 * e, 0.12 * e], scale: 1 - 0.5 * e };
  const back = { offset: [0.16 * e, -0.12 * e, 0], scale: 1 - 0.12 * e };
  out.parts.back = back;
  out.parts.cut = { ...back, visible: ease(band(e, 0.1, 0.5)) };
}

// The atlas's choices, grouped by shell.
const ORBITAL_CHOICES = ORBITAL_IDS.map((id) => {
  const o = orbitalOf(id);
  return { id, label: o.label, group: SHELL_NAMES[o.n] };
});

export const RECIPES = {
  // ---- Unit cells ------------------------------------------------------------------
  "unit-cells": {
    alive: false,
    // The owner's "Just sharper" (October 7, 2026): the sharp splat kernel
    // (labs) and twice the splats.
    kernel: "sharp",
    density: 2,
    options: [
      {
        key: "crystal",
        label: "Crystal",
        type: "select",
        default: "diamond",
        choices: CRYSTAL_ORDER.map((id) => ({ id, label: CRYSTALS[id].label })),
      },
      { key: "cells", label: "Cells along each edge", type: "slider", min: 1, max: 4, step: 1, default: 3 }, // prettier-ignore
      {
        key: "view",
        label: "Start with",
        type: "select",
        default: "cell",
        choices: [
          { id: "cell", label: "The unit cell" },
          { id: "block", label: "A block of cells" },
          { id: "bonds", label: "The bonds" },
        ],
      },
      {
        key: "thermal",
        label: "Thermal motion",
        type: "select",
        default: "off",
        choices: [
          { id: "off", label: "Off" },
          { id: "true", label: "At true size (with the bonds)" },
          { id: "magnified", label: "Five times larger (with the bonds)" },
        ],
      },
    ],
    controls: [{ key: "step", label: "Next view", type: "pulse", ease: STEP_SECS }],
    action: { key: "step", label: "Next view: cell, block, bonds" },
    credits: [
      {
        label: "Lattice constants and atom positions",
        title: "Crystallography Open Database entries 9008564, 9011577, 1538173, 9008468, 9008536 and 9008506",
        source: "https://www.crystallography.net/cod/",
        author: "the COD and the structures' authors (Wyckoff 1963; Trucano and Chen 1975; Goto, Hondoh and Mae 1990)",
        license: "Public domain (CC0)",
        licenseUrl: "https://creativecommons.org/publicdomain/zero/1.0/",
      },
    ], // prettier-ignore
    drive: driveUnitCells,
    build: buildUnitCells,
  },

  // ---- Orbital atlas ---------------------------------------------------------------
  "orbital-atlas": {
    alive: false,
    kernel: "sharp",
    density: 2,
    // It keeps still, facing you, so the opened halves' cut faces face you.
    turntable: false,
    options: [
      { key: "orbital", label: "Orbital", type: "select", default: "5f", choices: ORBITAL_CHOICES },
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
    controls: [{ key: "open", label: "Cut open", type: "pulse", ease: OPEN_SECS }],
    action: { key: "open", label: "Cut it open" },
    drive: driveOrbitalAtlas,
    build: buildOrbitalAtlas,
  },
};

// For the tests: the data the toys are built from.
export const LATTICE_DATA = { CRYSTALS, ORBITAL_IDS, LETTERS };
