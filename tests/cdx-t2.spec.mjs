import { test, expect } from "@playwright/test";
import { TOYS_T2, EXCLUDED, TIERS, buildToy, measure } from "../tools/cdx-t2-data.mjs";

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
