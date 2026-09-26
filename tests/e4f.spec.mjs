// Lane E4-finish (docs/handoff/E4-finish.md): the fixes from the owner's E4
// review. tests/taps.spec.mjs already plays each tap through; these check
// what is particular to the fixes.

import { test, expect } from "@playwright/test";

async function built(pack, id, options = {}) {
  const { buildRecipe } = await import("../src/kit.js");
  const { RECIPES } = await import(`../src/packs/${pack}.js`);
  const r = RECIPES[id];
  const opts = { ...Object.fromEntries((r.options || []).map((o) => [o.key, o.default])), ...options }; // prettier-ignore
  const it = buildRecipe(r, { seed: 5, count: 8000, options: opts }, () => {});
  let b = it.next();
  while (!b.done) b = it.next();
  return { r, kit: b.value.kit };
}
const frame = (r, t, c, data) => {
  const out = { parts: {}, glow: [0, 0, 0, 0], cues: [], fx: {}, tokens: null };
  r.drive(t, c, out, { time: t, R: 1, tap: null, data });
  return out;
};

test("the lava lamp takes any blob count, size and shape, and its blobs stay in the glass", async () => {
  for (const options of [
    { blobs: 2, size: 0.5, shape: "round" },
    { blobs: 12, size: 1.5, shape: "tall", set: "ocean" },
    { blobs: 9, size: 1.3, shape: "mixed", set: "midnight" },
  ]) {
    const { r, kit } = await built("elements", "lava-lamp", options);
    const blobs = kit.data.blobs;
    expect(blobs.length, JSON.stringify(options)).toBe(options.blobs);
    for (const b of blobs) {
      // Its widest point, all the way up its travel, is inside the glass.
      for (let y = b.lo; y <= b.hi + 1e-9; y += 0.02) {
        const glass =
          0.2 +
          0.075 * Math.sin(Math.PI * Math.min(1, Math.max(0, (y + 0.05) / 1.35)) * 0.8) -
          0.115 * (y <= 0.62 ? 0 : y >= 1.3 ? 1 : ((t) => t * t * (3 - 2 * t))((y - 0.62) / 0.68));
        expect(b.r + Math.hypot(b.x, b.z), `${JSON.stringify(options)} at ${y}`).toBeLessThan(glass + 0.012); // prettier-ignore
      }
    }
    const c = Object.fromEntries(r.controls.map((x) => [x.key, x.default ?? 0]));
    const out = frame(r, 2, c, kit.data);
    expect(Object.keys(out.parts).length).toBe(options.blobs);
  }
});

test("changing the lava lamp's Flow never makes the blobs jump", async () => {
  const { r, kit } = await built("elements", "lava-lamp");
  const c = Object.fromEntries(r.controls.map((x) => [x.key, x.default ?? 0]));
  let last = null;
  for (let i = 0; i < 300; i++) {
    const t = 3 + i / 60;
    c.flow = i < 150 ? 0.1 : 1; // a sudden change of speed
    const y = frame(r, t, c, kit.data).parts.blob0.offset[1];
    if (last !== null) expect(Math.abs(y - last), `frame ${i}`).toBeLessThan(0.02);
    last = y;
  }
});

test("the ice swan melts piece by piece and Temperature brings it back whole", async () => {
  const { r, kit } = await built("elements", "ice-statue");
  const c = { temp: 0, thaw: 0 };
  const pieces = ["body", "beak", "tail", "neckLo", "neckHi", "head", "wingNear", "wingFar", "tipNear", "tipFar"]; // prettier-ignore
  const size = (out, n) => (out.parts[n].visible ?? 1) * (out.parts[n].scale ?? 1);
  // Melted up high: the beak, the wing tips and the head are gone; the body
  // is a lump; water drips.
  for (let i = 0; i <= 50; i++) c.temp = i / 50;
  c.temp = 0.93;
  const hot = frame(r, 5, c, kit.data);
  for (const n of ["beak", "tipNear", "tipFar", "head", "neckHi"]) expect(size(hot, n), n).toBeLessThan(0.01); // prettier-ignore
  expect(size(hot, "body")).toBeGreaterThan(0.2);
  expect(size(hot, "body")).toBeLessThan(0.5);
  expect(hot.parts.puddle.scale).toBeGreaterThan(0.9);
  // Cooled again: every piece whole and home.
  for (let i = 50; i >= 0; i--) {
    c.temp = (0.93 * i) / 50;
    frame(r, 5 + (50 - i) / 60, c, kit.data);
  }
  const cold = frame(r, 6, c, kit.data);
  for (const n of pieces) {
    expect(size(cold, n), n).toBeCloseTo(1, 3);
    expect(Math.hypot(...(cold.parts[n].offset || [0, 0, 0])), n).toBeLessThan(1e-6);
  }
  expect(cold.tokens.every((tk) => (tk.visible ?? 1) === 0)).toBe(true);
});

test("the ocean wave's keyframes loop back to the curl it rests in", async () => {
  const { r, kit } = await built("elements", "ocean-wave");
  const ctl = r.controls.find((x) => x.key === r.action.key);
  const at = (v) => frame(r, 2, { [ctl.key]: v }, kit.data);
  const rest = at(0);
  expect(rest.tokens.length).toBeLessThanOrEqual(48);
  // Mid-effect the whole face has moved, not only the lip.
  const mid = at(1 - 1.2 / ctl.ease);
  const moved = mid.tokens.slice(0, 28).filter((tk) => Math.hypot(...tk.offset) > 0.05).length;
  expect(moved).toBeGreaterThan(12);
  // Every splat is skinned to control points that exist.
  const { anim, count } = kit.buf;
  const { KINDS } = await import("../src/effects.js");
  for (let i = 0; i < count; i++) {
    if (anim[i * 4 + 1] !== KINDS.skin) continue;
    const z = anim[i * 4 + 2];
    expect(z % 64).toBeLessThan(38);
    expect(Math.floor(z / 64)).toBeLessThan(38);
  }
});

test("the pinecone's loose scales and seeds fit the token limit and land on the ground", async () => {
  const { r, kit } = await built("nature", "pinecone");
  const { loose, seeds } = kit.data;
  expect(loose.length + seeds.length).toBeLessThanOrEqual(48);
  expect(loose.length).toBeGreaterThanOrEqual(40);
  for (const sc of loose) {
    expect(sc.land[1]).toBeLessThan(-0.65); // on the ground, or on a scale that landed first
    expect(Math.hypot(sc.land[0], sc.land[2])).toBeLessThan(0.6);
    expect(sc.tb + sc.fall).toBeLessThan(sc.back);
  }
});
