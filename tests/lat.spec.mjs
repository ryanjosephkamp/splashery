// Lane Lattices and orbitals (docs/handoff/Lattices.md): the Unit cells toy (real lattice
// constants and atom positions, true relative radii, nearest-neighbor bonds, ice's hydrogens by
// the ice rules, Debye–Waller thermal motion) and the Orbital atlas (every hydrogen orbital of n =
// 1 to 5 and 6s to 7p, checked against the analytic radial and angular functions, and sampled
// from |psi|²).

import { test, expect } from "@playwright/test";
import fs from "node:fs";
import path from "node:path";
import {
  CRYSTALS,
  CRYSTAL_ORDER,
  blockAtoms,
  findBonds,
  addIceHydrogens,
} from "../src/lattice/cells.js";
import {
  orbital,
  orbitalList,
  radial,
  harmonic,
  radialSampler,
  samplePoint,
  radialNodes,
} from "../src/lattice/orbitals.js";

const SHOTS = path.resolve("tests/screenshots");
const PI = Math.PI;
const dist = (p, q) => Math.hypot(p[0] - q[0], p[1] - q[1], p[2] - q[2]);

// A seeded random number generator (Park–Miller).
function seeded(seed = 1) {
  let s = seed;
  return () => (s = (s * 16807) % 2147483647) / 2147483647;
}

async function build(id, options = {}, count = 30000) {
  const { buildRecipe } = await import("../src/kit.js");
  const { RECIPES } = await import("../src/packs/lattices.js");
  const r = RECIPES[id];
  const opts = { ...Object.fromEntries((r.options || []).map((o) => [o.key, o.default])), ...options }; // prettier-ignore
  const it = buildRecipe(r, { seed: 7, count, options: opts }, () => {});
  let b = it.next();
  while (!b.done) b = it.next();
  return b.value;
}

// ---- Crystals ---------------------------------------------------------------------------

// The cells as the Crystallography Open Database gives them (checked October 7, 2026).
const COD = {
  diamond: { cod: 9008564, a: 3.56679, c: 3.56679, atoms: 8 },
  graphite: { cod: 9011577, a: 2.464, c: 6.711, atoms: 4 },
  ice: { cod: 1538173, a: 4.506, c: 7.346, atoms: 4 },
  copper: { cod: 9008468, a: 3.61496, c: 3.61496, atoms: 4 },
  iron: { cod: 9008536, a: 2.8665, c: 2.8665, atoms: 2 },
  magnesium: { cod: 9008506, a: 3.20927, c: 5.21033, atoms: 2 },
};

test("the cells are the published ones", () => {
  for (const id of CRYSTAL_ORDER) {
    const c = CRYSTALS[id];
    expect(c.cell.a, id).toBe(COD[id].a);
    expect(c.cell.c, id).toBe(COD[id].c);
    expect(c.basis.length, id).toBe(COD[id].atoms);
  }
});

// Nearest-neighbor distances and how many neighbors an atom deep inside a block has.
const NEIGHBORS = {
  diamond: { d: 1.5445, z: 4 },
  graphite: { d: 1.4226, z: 3 },
  copper: { d: 2.5562, z: 12 },
  iron: { d: 2.4825, z: 8 },
  magnesium: { d: 3.203, z: 12 },
};

test("bond lengths and coordination: 4 in diamond, 3 in graphite, 12 fcc, 8 bcc, 12 hcp", () => {
  for (const [id, want] of Object.entries(NEIGHBORS)) {
    const c = CRYSTALS[id];
    const atoms = blockAtoms(c, 4);
    const bonds = findBonds(c, atoms);
    const deg = atoms.map(() => 0);
    for (const [i, j] of bonds) {
      deg[i]++;
      deg[j]++;
      expect(Math.abs(dist(atoms[i].p, atoms[j].p) - want.d), id).toBeLessThan(0.01);
    }
    expect(Math.max(...deg), id).toBe(want.z);
  }
  // hcp's two neighbor distances: a in the layer and √(a²/3 + c²/4) across.
  const { a, c } = CRYSTALS.magnesium.cell;
  expect(Math.abs(Math.sqrt((a * a) / 3 + (c * c) / 4) - 3.197)).toBeLessThan(0.001);
});

test("true relative radii: neighbors touch in the metals, diamond and graphite", () => {
  for (const [id, want] of Object.entries(NEIGHBORS)) {
    const r = Object.values(CRYSTALS[id].radius)[0];
    // Magnesium's spheres touch in the layer (a = 3.209 Å).
    const d = id === "magnesium" ? CRYSTALS.magnesium.cell.a : want.d;
    expect(Math.abs(2 * r - d), id).toBeLessThan(0.002);
  }
  // Ice: covalent radii O 0.66 Å and H 0.31 Å (Cordero et al. 2008).
  expect(CRYSTALS.ice.radius).toEqual({ O: 0.66, H: 0.31 });
});

test("ice: every oxygen has two hydrogens at 1.00 Å, each O–O line one (the ice rules)", () => {
  const c = CRYSTALS.ice;
  const ox = blockAtoms(c, 3);
  const atoms = addIceHydrogens(c, ox, seeded(3));
  const O = atoms.filter((a) => a.el === "O");
  const H = atoms.filter((a) => a.el === "H");
  expect(H.length).toBe(2 * O.length);
  // O–O neighbors 2.75 Å apart, as the cell gives (2.76 Å in ice Ih).
  const oo = findBonds({ ...c, bonds: [["O", "O", 2.76, 0.05]] }, O);
  for (const [i, j] of oo) expect(Math.abs(dist(O[i].p, O[j].p) - 2.76)).toBeLessThan(0.03);
  // Each hydrogen: 1.00 Å from its own oxygen, on the line to a neighbor oxygen.
  for (const h of H) {
    const own = atoms[h.owner];
    expect(Math.abs(dist(h.p, own.p) - 1)).toBeLessThan(1e-9);
  }
  // No O–O line carries two hydrogens: within the block, no two hydrogens are closer than the
  // line's length minus two bonds (0.76 Å).
  let closest = Infinity;
  for (let i = 0; i < H.length; i++)
    for (let j = i + 1; j < H.length; j++) closest = Math.min(closest, dist(H[i].p, H[j].p));
  expect(closest).toBeGreaterThan(1.4);
  // H–O–H angles near the tetrahedral 109.5° (the O–O–O angles of ice Ih).
  for (let i = 0; i < O.length; i++) {
    const hs = H.filter((h) => atoms[h.owner] === O[i]);
    const u = hs.map((h) => h.p.map((x, k) => x - O[i].p[k]));
    const cos = (u[0][0] * u[1][0] + u[0][1] * u[1][1] + u[0][2] * u[1][2]) / (Math.hypot(...u[0]) * Math.hypot(...u[1])); // prettier-ignore
    const deg = (Math.acos(cos) * 180) / PI;
    expect(deg).toBeGreaterThan(108);
    expect(deg).toBeLessThan(111);
  }
});

test("thermal motion: U = B / 8π² from Peng et al. (1996), graphite's anisotropic U", () => {
  const B = { diamond: 0.1435, copper: 0.5505, iron: 0.325, magnesium: 1.8122 };
  const el = { diamond: "C", copper: "Cu", iron: "Fe", magnesium: "Mg" };
  for (const [id, b] of Object.entries(B)) {
    const U = CRYSTALS[id].U[el[id]];
    for (const u of U) expect(Math.abs(u - b / (8 * PI * PI))).toBeLessThan(1e-12);
  }
  // Copper's root-mean-square displacement along an axis: 0.0835 Å at 293 K.
  expect(Math.sqrt(CRYSTALS.copper.U.Cu[0])).toBeCloseTo(0.0835, 3);
  // Graphite moves about five times more across its layers than along them.
  const [u11, , u33] = CRYSTALS.graphite.U.C;
  expect(u33 / u11).toBeGreaterThan(5);
});

test("the Unit cells toy builds every crystal at every size, and every view", async () => {
  for (const crystal of CRYSTAL_ORDER)
    for (const cells of [1, 4]) {
      const r = await build("unit-cells", { crystal, cells });
      expect(r.buf.count, `${crystal} ${cells}`).toBeGreaterThan(20000);
      expect(r.buf.pos.every(Number.isFinite), `${crystal} ${cells}`).toBe(true);
      expect(r.kit.data.zoom).toBeGreaterThanOrEqual(1);
    }
  for (const thermal of ["true", "magnified"]) {
    const r = await build("unit-cells", { crystal: "graphite", thermal });
    expect(r.kit.data.thermal).toBe(true);
  }
});

// ---- Orbitals ---------------------------------------------------------------------------

test("the atlas: all of n = 1 to 5, and 6s, 6p, 6d, 7s and 7p (68 orbitals)", () => {
  const ids = orbitalList();
  expect(ids.length).toBe(1 + 4 + 9 + 16 + 25 + 1 + 3 + 5 + 1 + 3);
  expect(new Set(ids).size).toBe(ids.length);
  for (const want of ["4d", "4d-2", "4d2", "5f", "5f-3", "5g-4", "6d", "7p1"])
    expect(ids).toContain(want);
});

// Analytic radial functions (a₀ = 1), from the tables (ρ = 2r/n): each must equal R_nl exactly.
const ANALYTIC_R = {
  "1,0": (r) => 2 * Math.exp(-r),
  "2,1": (r) => (1 / (2 * Math.sqrt(6))) * r * Math.exp(-r / 2),
  "3,2": (r) => (4 / (81 * Math.sqrt(30))) * r * r * Math.exp(-r / 3),
  // 4d: (1 / (96√5)) (6 − ρ) ρ² e^(−ρ/2), ρ = r/2.
  "4,2": (r) => (1 / (96 * Math.sqrt(5))) * (6 - r / 2) * (r / 2) ** 2 * Math.exp(-r / 4),
  // 4f: (1 / (96√35)) ρ³ e^(−ρ/2), ρ = r/2.
  "4,3": (r) => (1 / (96 * Math.sqrt(35))) * (r / 2) ** 3 * Math.exp(-r / 4),
};
// Radial functions up to a constant: the polynomial in ρ = 2r/n times ρ^l e^(−ρ/2).
const SHAPE_R = {
  "5,0": (p) => 120 - 240 * p + 120 * p * p - 20 * p ** 3 + p ** 4,
  "5,3": (p) => p ** 3 * (8 - p),
  "5,4": (p) => p ** 4,
  "6,2": (p) => p * p * L(3, 5, p),
  "7,1": (p) => p * L(5, 3, p),
};
// L_k^a by its closed form, Σ (−1)^i (k + a)! / ((k − i)! (a + i)! i!) x^i (6d and 7p).
function L(k, a, x) {
  let s = 0;
  const f = (n) => (n <= 1 ? 1 : n * f(n - 1));
  for (let i = 0; i <= k; i++)
    s += (((-1) ** i * f(k + a)) / (f(k - i) * f(a + i) * f(i))) * x ** i;
  return s;
}

test("radial functions: equal to the analytic ones, normalized, orthogonal, n − l − 1 nodes", () => {
  for (const [key, f] of Object.entries(ANALYTIC_R)) {
    const [n, l] = key.split(",").map(Number);
    const R = radial(n, l);
    for (const r of [0.3, 1, 2.5, 5, 9, 17]) expect(R(r) / f(r), key).toBeCloseTo(1, 10);
  }
  for (const [key, f] of Object.entries(SHAPE_R)) {
    const [n, l] = key.split(",").map(Number);
    const R = radial(n, l);
    const ratios = [0.7, 2.1, 4.4, 7.9, 13, 21].map((r) => {
      const p = (2 * r) / n;
      return R(r) / (f(p) * Math.exp(-p / 2));
    });
    for (const q of ratios) expect(q / ratios[0], key).toBeCloseTo(1, 8);
  }
  const integral = (f, top) => {
    const N = 40000;
    let s = 0;
    for (let i = 0; i < N; i++) {
      const r = ((i + 0.5) / N) * top;
      s += f(r) * (top / N);
    }
    return s;
  };
  for (const id of orbitalList()) {
    const o = orbital(id);
    if (o.m !== 0) continue;
    expect(
      integral((r) => (r * o.R(r)) ** 2, 4 * o.rmax),
      id,
    ).toBeCloseTo(1, 5);
    expect(radialNodes(o).length, id).toBe(o.n - o.l - 1);
  }
  // Same l, different n: orthogonal (∫ r² R₄d R₅d dr = 0, and so on).
  for (const [a, b] of [
    ["4d", "5d"],
    ["5f", "4f"],
    ["5s", "7s"],
    ["6p", "7p"],
    ["3d", "6d"],
  ]) {
    const A = orbital(a);
    const B = orbital(b);
    expect(Math.abs(integral((r) => r * r * A.R(r) * B.R(r), 4 * Math.max(A.rmax, B.rmax))), `${a} ${b}`).toBeLessThan(1e-6); // prettier-ignore
  }
});

// Real spherical harmonics in Cartesian form, with their normalizations.
const ANALYTIC_Y = {
  "2,-2": (x, y) => Math.sqrt(15 / (4 * PI)) * x * y,
  "2,0": (x, y, z) => Math.sqrt(5 / (16 * PI)) * (3 * z * z - 1),
  "2,2": (x, y) => Math.sqrt(15 / (16 * PI)) * (x * x - y * y),
  "3,0": (x, y, z) => Math.sqrt(7 / (16 * PI)) * (5 * z ** 3 - 3 * z),
  "3,-2": (x, y, z) => Math.sqrt(105 / (4 * PI)) * x * y * z,
  "3,1": (x, y, z) => Math.sqrt(21 / (32 * PI)) * x * (5 * z * z - 1),
  "3,3": (x, y) => Math.sqrt(35 / (32 * PI)) * x * (x * x - 3 * y * y),
  "4,0": (x, y, z) => (3 / 16) * Math.sqrt(1 / PI) * (35 * z ** 4 - 30 * z * z + 3),
  "4,-4": (x, y) => (3 / 4) * Math.sqrt(35 / PI) * x * y * (x * x - y * y),
  "4,4": (x, y) => (3 / 16) * Math.sqrt(35 / PI) * (x ** 4 - 6 * x * x * y * y + y ** 4),
  "4,-1": (x, y, z) => (3 / 4) * Math.sqrt(5 / (2 * PI)) * y * (7 * z ** 3 - 3 * z),
};

test("angular functions: equal to the Cartesian real harmonics, normalized over the sphere", () => {
  const rand = seeded(11);
  for (const [key, f] of Object.entries(ANALYTIC_Y)) {
    const [l, m] = key.split(",").map(Number);
    const Y = harmonic(l, m);
    for (let i = 0; i < 20; i++) {
      const z = rand() * 2 - 1;
      const a = rand() * 2 * PI;
      const s = Math.sqrt(1 - z * z);
      const d = [s * Math.cos(a), s * Math.sin(a), z];
      expect(Math.abs(Y(...d) - f(...d)), key).toBeLessThan(1e-12);
    }
  }
  const N = 60000;
  for (const id of orbitalList()) {
    const o = orbital(id);
    let s = 0;
    for (let i = 0; i < N; i++) {
      const z = 1 - (2 * (i + 0.5)) / N;
      const r = Math.sqrt(1 - z * z);
      const a = i * 2.399963229728653;
      s += o.Y(r * Math.cos(a), r * Math.sin(a), z) ** 2;
    }
    expect((s * 4 * PI) / N, id).toBeCloseTo(1, 4);
  }
});

test("samples follow |psi|²: the radius from r²R², the direction from Y² (4d, 5f, 5g, 6d)", () => {
  for (const id of ["4d-2", "5f", "5g-4", "6d"]) {
    const o = orbital(id);
    const S = radialSampler(o.R, o.rmax);
    const rand = seeded(5);
    const n = 60000;
    // Radius: histogram against r²R² over the drawn range (cut at 98.5%).
    const bins = 24;
    const hist = new Array(bins).fill(0);
    const ang = { hi: 0, all: 0 };
    for (let i = 0; i < n; i++) {
      const s = samplePoint(o, S, rand);
      hist[Math.min(bins - 1, Math.floor((s.r / S.extent) * bins))]++;
      const d = s.p.map((x) => x / s.r);
      ang.all++;
      // Where Y² is above half its peak, by the sampled directions.
      if (o.Y(...d) ** 2 > 0.5 * o.ymax ** 2) ang.hi++;
    }
    const want = [];
    for (let b = 0; b < bins; b++) {
      let w = 0;
      for (let j = 0; j < 50; j++) {
        const r = ((b + (j + 0.5) / 50) / bins) * S.extent;
        w += (r * o.R(r)) ** 2;
      }
      want.push(w);
    }
    const tot = want.reduce((a, b) => a + b, 0);
    for (let b = 0; b < bins; b++) {
      const p = want[b] / tot;
      if (p < 0.01) continue;
      expect(Math.abs(hist[b] / n - p), `${id} bin ${b}`).toBeLessThan(
        5 * Math.sqrt(p / n) + 0.004,
      );
    }
    // Direction: the share of samples where Y² > ½ max equals ∫ of Y² over that region.
    let inHi = 0;
    const M = 200000;
    for (let i = 0; i < M; i++) {
      const z = 1 - (2 * (i + 0.5)) / M;
      const r = Math.sqrt(1 - z * z);
      const a = i * 2.399963229728653;
      const y2 = o.Y(r * Math.cos(a), r * Math.sin(a), z) ** 2;
      if (y2 > 0.5 * o.ymax ** 2) inHi += y2;
    }
    inHi *= (4 * PI) / M;
    expect(Math.abs(ang.hi / ang.all - inHi), id).toBeLessThan(0.01);
  }
});

test("the Orbital atlas builds every orbital, with finite positions", async () => {
  for (const id of orbitalList()) {
    const r = await build("orbital-atlas", { orbital: id }, 8000);
    expect(r.buf.count, id).toBeGreaterThan(6000);
    expect(r.buf.pos.every(Number.isFinite), id).toBe(true);
  }
});

// ---- In the app -------------------------------------------------------------------------

test.describe("the lattices toys in the app", () => {
  const APP = "/?renderer=webgl2&adapt=off&profile=low&labs=1";

  async function open(page, id) {
    await page.goto(APP);
    await page.waitForSelector("body[data-ready='true']", { timeout: 180_000 });
    await page.evaluate((t) => window.__splashery.app.chooseToy(t), id);
    await page.waitForFunction((t) => window.__splashery.player.toyInfo?.id === t, id, { timeout: 120_000 }); // prettier-ignore
  }

  for (const [w, h] of [
    [390, 844],
    [1440, 900],
  ]) {
    test(`screenshots at ${w}x${h}`, async ({ page }) => {
      await page.setViewportSize({ width: w, height: h });
      await open(page, "unit-cells");
      await page.waitForTimeout(1500);
      await page.screenshot({ path: path.join(SHOTS, `lat-cells-${w}x${h}.png`) });
      await open(page, "orbital-atlas");
      await page.waitForTimeout(1500);
      await page.screenshot({ path: path.join(SHOTS, `lat-orbitals-${w}x${h}.png`) });
      expect(fs.existsSync(path.join(SHOTS, `lat-orbitals-${w}x${h}.png`))).toBe(true);
    });
  }
});
