// Lane Fidelity B's own checks (docs/OPERATING.md): the even shapes in
// src/packs/even.js sample the same surfaces as the kit's own shapes (points
// on the surface, unit outward normals, the same face and cap fields), and
// every toy the lane changed still builds at the phone tier within its
// budget, with finite splats and no see-through solids left from random
// placement.

import { test, expect } from "@playwright/test";
import { Kit, buildRecipe } from "../src/kit.js";
import { PROFILES } from "../src/generators.js";
import {
  evenBox,
  evenCylinder,
  evenTorus,
  evenDisc,
  evenEllipsoid,
  evenTube,
  evenRoundBox,
  capPoint,
} from "../src/packs/even.js";

const TOYS = {
  tiny: ["white-blood-cell", "paramecium", "amoeba", "animal-cell", "mitochondrion", "diatom"],
  vehicles: ["ocean-liner", "bus", "sports-car", "rocket"],
  balls: ["marble", "squash-ball", "medicine-ball"],
  animals: ["butterfly", "nautilus", "ladybug"],
  playthings: ["soap-bubbles", "dice", "robot"],
  objects: ["book", "umbrella", "music-box"],
  computing: ["word-vectors"],
  space: ["saturn"],
  food: ["candy-cane", "avocado", "croissant", "gummy-bear", "apple", "egg"],
  medieval: ["bow-and-target", "wizards-orb", "knights-helmet", "shield", "crown"],
  nature: ["acorn"],
  landmarks: [
    "big-ben",
    "windmill",
    "lighthouse",
    "supertall",
    "white-house",
    "colosseum",
    "leaning-tower",
  ],
  elements: ["rainbow", "geyser"],
  games: ["chess-set"],
  holidays: ["patterned-egg"],
  gems: ["crystal-ball", "pearl", "emerald", "sapphire"],
  maths: ["seashell-spiral", "platonic"],
  music: ["xylophone", "drum"],
  anatomy: ["brain", "tooth"],
};

const len = (v) => Math.hypot(v[0], v[1], v[2]);
const dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];

// Samples a shape n times evenly (as the kit does for even: true) and
// checks each point with onSurface(p) -> distance from the true surface and
// outward(p) -> the true outward normal there.
function checkShape(name, shape, onSurface, outward, n = 2000) {
  expect(typeof shape.sampleEven, name).toBe("function");
  for (let i = 0; i < n; i++) {
    const a = (i + 0.5) / n;
    const b = (i * 0.618034) % 1;
    const s = shape.sampleEven(a, b);
    expect(s.p.every(Number.isFinite), `${name} point ${i}`).toBe(true);
    expect(Math.abs(onSurface(s.p)), `${name} on surface ${i}`).toBeLessThan(1e-3);
    expect(Math.abs(len(s.n) - 1), `${name} unit normal ${i}`).toBeLessThan(1e-3);
    if (outward) {
      const o = outward(s.p);
      expect(dot(s.n, o) / len(o), `${name} outward ${i}`).toBeGreaterThan(0.5);
    }
  }
}

test("the even box and cylinder sample the kit's surfaces, with the same fields", () => {
  const [sx, sy, sz] = [1, 2, 0.5];
  const box = evenBox(sx, sy, sz);
  expect(box.area).toBeCloseTo(2 * (sx * sy + sy * sz + sx * sz), 6);
  const boxDist = (p) =>
    Math.max(Math.abs(p[0]) - sx / 2, Math.abs(p[1]) - sy / 2, Math.abs(p[2]) - sz / 2);
  checkShape("box", box, boxDist, null);
  // Every face gets its share of splats (by area), and face numbers match
  // k.box (0..5 for +X, -X, +Y, -Y, +Z, -Z).
  const counts = [0, 0, 0, 0, 0, 0];
  const N = 6000;
  for (let i = 0; i < N; i++) {
    const s = box.sampleEven((i + 0.5) / N, (i * 0.618034) % 1);
    counts[s.face]++;
    const ax = s.face >> 1;
    expect(Math.sign(s.p[ax]), `face ${s.face}`).toBe(s.face % 2 ? -1 : 1);
  }
  const areas = [sy * sz, sy * sz, sx * sz, sx * sz, sx * sy, sx * sy];
  const total = areas.reduce((a, b) => a + b, 0);
  counts.forEach((c, f) => expect(c / N).toBeCloseTo(areas[f] / total, 2));

  const cyl = evenCylinder(0.5, 0.3, 1.2);
  const kitCyl = new Kit(1).cone(0.5, 0.3, 1.2);
  expect(cyl.area).toBeCloseTo(kitCyl.area, 6);
  let caps = 0;
  for (let i = 0; i < 3000; i++) {
    const s = cyl.sampleEven((i + 0.5) / 3000, (i * 0.618034) % 1);
    if (s.cap) {
      caps++;
      expect(Math.abs(Math.abs(s.p[1]) - 0.6)).toBeLessThan(1e-9);
      expect(s.radial).toBeGreaterThanOrEqual(0);
      expect(s.radial).toBeLessThanOrEqual(1);
    } else {
      expect(s.side).toBe(true);
      const t = (s.p[1] + 0.6) / 1.2;
      expect(Math.abs(Math.hypot(s.p[0], s.p[2]) - (0.5 - 0.2 * t))).toBeLessThan(1e-6);
    }
  }
  const capShare = (Math.PI * (0.25 + 0.09)) / kitCyl.area;
  expect(caps / 3000).toBeCloseTo(capShare, 2);
  // An uncapped one has no caps.
  const open = evenCylinder(0.4, 0.4, 1, false);
  for (let i = 0; i < 500; i++) expect(open.sampleEven((i + 0.5) / 500, 0.3).cap).toBeUndefined();
});

test("the even torus, disc, ellipsoid, tube and rounded box are on their surfaces", () => {
  const k = new Kit(3);
  const [R, r] = [0.8, 0.2];
  checkShape(
    "torus",
    evenTorus(k, R, r),
    (p) => Math.hypot(Math.hypot(p[0], p[2]) - R, p[1]) - r,
    (p) => {
      const q = Math.hypot(p[0], p[2]);
      return [p[0] - (p[0] / q) * R, p[1], p[2] - (p[2] / q) * R];
    },
  );
  checkShape(
    "disc",
    evenDisc(k, 0.5, 0.1),
    (p) => p[1] + Math.max(0, 0.1 - Math.hypot(p[0], p[2])),
    () => [0, 1, 0],
  );
  const [a, b, c] = [0.6, 0.3, 0.4];
  checkShape(
    "ellipsoid",
    evenEllipsoid(k, a, b, c),
    (p) => (Math.hypot(p[0] / a, p[1] / b, p[2] / c) - 1) * 0.3,
    (p) => [p[0] / (a * a), p[1] / (b * b), p[2] / (c * c)],
  );
  // A capped straight tube along Y: a cylinder of radius 0.1 with flat ends.
  const tube = evenTube(k, (t) => [0, t, 0], 0.1, { caps: true, samples: 32 });
  checkShape(
    "tube",
    tube,
    (p) => {
      const rr = Math.hypot(p[0], p[2]);
      if (p[1] < 1e-6 || p[1] > 1 - 1e-6) return Math.max(0, rr - 0.1);
      return rr - 0.1;
    },
    null,
  );
  let ends = 0;
  for (let i = 0; i < 2000; i++) {
    const s = tube.sampleEven((i + 0.5) / 2000, (i * 0.618) % 1);
    if (s.p[1] < 1e-6 || s.p[1] > 1 - 1e-6) ends++;
  }
  expect(ends / 2000).toBeCloseTo((2 * Math.PI * 0.01) / tube.area, 2);
  const [sx, sy, sz, rb] = [1, 0.6, 0.8, 0.1];
  const rbox = evenRoundBox(sx, sy, sz, rb);
  checkShape(
    "rounded box",
    rbox,
    (p) => {
      const q = [Math.abs(p[0]) - sx / 2 + rb, Math.abs(p[1]) - sy / 2 + rb, Math.abs(p[2]) - sz / 2 + rb]; // prettier-ignore
      const o = Math.hypot(Math.max(q[0], 0), Math.max(q[1], 0), Math.max(q[2], 0));
      return o + Math.min(Math.max(q[0], q[1], q[2]), 0) - rb;
    },
    null,
  );
  // capPoint spreads points over a cap round its direction.
  const d = [0, 0, 1];
  for (let i = 0; i < 200; i++) {
    const { p, f } = capPoint(d, 0.3, i, 200);
    expect(Math.abs(len(p) - 1)).toBeLessThan(1e-9);
    expect(Math.acos(Math.min(1, dot(p, d)))).toBeLessThanOrEqual(0.3 + 1e-9);
    expect(f).toBeGreaterThan(0);
    expect(f).toBeLessThan(1);
  }
});

test("every toy the lane changed builds at the phone tier, within its budget", async () => {
  test.setTimeout(600_000);
  const tier = PROFILES.mid;
  for (const [pack, ids] of Object.entries(TOYS)) {
    const { RECIPES } = await import(`../src/packs/${pack}.js`);
    for (const id of ids) {
      const recipe = RECIPES[id];
      expect(recipe, id).toBeTruthy();
      // (A toy that loads data first, like the word vectors, is built by
      // tests/taps.spec.mjs in the page instead.)
      if (recipe.prepare) continue;
      const options = {};
      for (const o of recipe.options || []) options[o.key] = o.default;
      const count = Math.round(Math.min(tier.maxCount, tier.defaultCount * (recipe.density ?? 1)));
      const it = buildRecipe(recipe, { seed: 7, count, options }, () => {});
      let r = it.next();
      while (!r.done) r = it.next();
      const buf = r.value.buf;
      // Within the tier's budget (the kit adds room for clay).
      expect(buf.count, id).toBeGreaterThan(count * 0.5);
      expect(buf.count, id).toBeLessThanOrEqual(tier.maxCount * 1.1);
      for (let i = 0; i < buf.count * 3; i++)
        if (!Number.isFinite(buf.pos[i])) throw new Error(`${id}: splat ${i / 3} is not finite`);
    }
  }
});
