// Lane E6b's own checks (docs/OPERATING.md): the landmarks, animals, shield,
// crown and snowman whose taps need more than tests/taps.spec.mjs looks at.
// They run the recipes' drive() in Node, frame by frame, as the app does.

import { test, expect } from "@playwright/test";
import { buildRecipe } from "../src/kit.js";

async function load(pack, id, options = {}) {
  const { RECIPES } = await import(`../src/packs/${pack}.js`);
  const r = RECIPES[id];
  const opts = {
    ...Object.fromEntries((r.options || []).map((o) => [o.key, o.default])),
    ...options,
  };
  const it = buildRecipe(r, { seed: 5, count: 6000, options: opts }, () => {});
  let b = it.next();
  while (!b.done) b = it.next();
  return { r, kit: b.value.kit };
}

// Plays a pulse from the tap to its end; step(s, out) sees each frame (s
// seconds after the tap).
function play(r, kit, key, step, controls = {}) {
  const def = r.controls.find((x) => x.key === key);
  const c = { ...Object.fromEntries(r.controls.map((x) => [x.key, x.default ?? 0])), ...controls };
  const dt = 1 / 60;
  for (let s = 0; s <= def.ease + 1e-9; s += dt) {
    c[key] = Math.max(0, 1 - s / def.ease);
    const out = { parts: {}, glow: [1, 1, 1, 0], amount: 1, grow: 1, cues: [], fx: {}, tokens: null }; // prettier-ignore
    r.drive(1 + s, c, out, { time: 1 + s, R: 1, tap: { n: 1 }, data: kit.data });
    step(s, out);
  }
}

test("Galileo's two balls land at the same moment, clear of the tower, at any lean", async () => {
  const { r, kit } = await load("landmarks", "leaning-tower");
  const { center, scale } = kit.transform;
  for (const lean of [0, 0.35, 1]) {
    const hit = [0, 1].map((i) => {
      const part = kit.parts.find((p) => p.name === `ball${i}`);
      const home = part.pivot.map((v, k) => v / scale + center[k]);
      let t = null;
      let at = null;
      play(
        r,
        kit,
        "drop",
        (s, out) => {
          const pd = out.parts[`ball${i}`];
          if (t === null && pd?.visible > 0.5 && s > 1.5 && pd.offset[1] < 1e-3) {
            t = s;
            at = home.map((v, k) => v + pd.offset[k]);
          }
        },
        { lean },
      );
      return { t, at };
    });
    expect(hit[0].t, `lean ${lean}`).not.toBeNull();
    expect(Math.abs(hit[0].t - hit[1].t), `lean ${lean}: they land together`).toBeLessThan(0.02);
    // The round step round the tower's foot has a radius of 0.64.
    for (const { at } of hit) expect(Math.hypot(at[0], at[2]), `lean ${lean}`).toBeGreaterThan(0.7);
  }
});

test("the frog's tongue reaches the fly and carries it into the mouth", async () => {
  const { r, kit } = await load("animals", "frog");
  let caught = false;
  let swallowed = false;
  play(r, kit, "snap", (s, out) => {
    const tongue = out.morph?.[0] ?? 0;
    const fly = out.parts.fly;
    if (tongue > 0.99 && fly.visible > 0.5 && Math.hypot(...fly.offset) < 0.03) caught = true;
    if (caught && s > 1.45 && fly.visible === 0) swallowed = true;
  });
  expect(caught).toBe(true);
  expect(swallowed).toBe(true);
});

test("the snowman's Warmth melts it into its pieces, and cold builds it back", async () => {
  const { r, kit } = await load("holidays", "snowman");
  const frame = (warmth) => {
    const out = { parts: {}, glow: [1, 1, 1, 0], amount: 1, grow: 1, cues: [], fx: {}, tokens: null }; // prettier-ignore
    r.drive(1, { warmth, thaw: 0 }, out, { time: 1, R: 1, tap: null, data: kit.data });
    return out;
  };
  const warm = frame(1);
  expect(warm.parts.ball2.scale).toBeLessThan(0.3);
  // Every piece has fallen to the ground (below the bottom ball's middle).
  for (const tk of warm.tokens) expect(tk.offset[1]).toBeLessThan(-0.3);
  expect(warm.grow).toBeGreaterThan(0.99);
  const cold = frame(0);
  for (const tk of cold.tokens) expect(Math.hypot(...tk.offset)).toBeLessThan(1e-9);
  for (const i of [0, 1, 2]) expect(cold.parts[`ball${i}`].scale).toBe(1);
});

test("the school of fish moves as 48 separate fish", async () => {
  const { r, kit } = await load("animals", "fish-school");
  expect(kit.data.fish.length).toBe(48);
  let spread = 0;
  let tight = Infinity;
  play(r, kit, "swirl", (s, out) => {
    expect(out.tokens.length).toBe(48);
    const reach = Math.max(
      ...out.tokens.map((tk, i) => {
        const p = kit.data.fish[i].pos;
        return Math.hypot(p[0] + tk.offset[0], p[1] + tk.offset[1], p[2] + tk.offset[2]);
      }),
    );
    if (s > 1.3 && s < 2.1) tight = Math.min(tight, reach);
    if (s > 2.4 && s < 3.2) spread = Math.max(spread, reach);
  });
  // A tight ball, then a burst wider than the school at rest.
  expect(tight).toBeLessThan(0.62);
  expect(spread).toBeGreaterThan(1.0);
});
