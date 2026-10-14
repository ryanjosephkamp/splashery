import { test, expect } from "@playwright/test";
import { TOYS_T2, EXCLUDED, TIERS, buildToy, measure } from "../tools/cdx-t2-data.mjs";

// These are the full bitmap glyph samples, including the dim and lit
// equation copies and the proof's labels on each moving triangle.
const GLYPH_SAMPLES = {
  "graph-plotter": [56],
  "surface-plotter": [56],
  "unit-circle": [708, 168, 216, 248],
  "pythagoras-proof": [112, 120, 96, 404, 404, 56, 64, 40, 56, 64, 40, 56, 64, 40, 56, 64, 40],
};

for (const [id, expected] of Object.entries(GLYPH_SAMPLES)) {
  test(`${id}: every glyph stays complete at every Auto tier`, async () => {
    const def = TOYS_T2.find((t) => t.id === id);
    for (const tier of TIERS) {
      const { kit } = await buildToy(def, tier);
      // Text is emitted as flat discs; the other clouds are moving trail
      // markers, which may still scale with the tier.
      const text = kit.items.filter(
        (it) => it.kind === "cloud" && it.sample(() => 0.5, 0, it.n)?.flat === 0.4,
      );
      expect(
        text.map((it) => it.end - it.start),
        tier,
      ).toEqual(expected);
    }
  });
}

test("task 66 covers 65 toys and leaves task 44's seven worlds alone", () => {
  expect(TOYS_T2).toHaveLength(65);
  expect(new Set(TOYS_T2.map((t) => t.id)).size).toBe(65);
  expect(TOYS_T2.filter((t) => EXCLUDED.includes(t.id))).toEqual([]);
});

for (const def of TOYS_T2) {
  test(`${def.id}: all Auto tiers build finite splats with the same parts`, async () => {
    let parts;
    for (const tier of TIERS) {
      const ctx = await buildToy(def, tier);
      const m = measure(ctx);
      expect(m.emitted, tier).toBeGreaterThan(0);
      expect(m.nonFinite, tier).toBe(0);
      expect(m.parts.length, tier).toBeLessThanOrEqual(16);
      if (parts) expect(m.parts, tier).toEqual(parts);
      parts = m.parts;
    }
  });
}
