// Lane Video to 3D (prefix v3d): its own checks. docs/handoff/Video3D.md.

import { test, expect } from "@playwright/test";

test("a kit cloud keeps a trained splat's own sizes and rotation", async () => {
  const { buildRecipe } = await import("../src/kit.js");
  const s = Math.SQRT1_2;
  const recipe = {
    build(k) {
      k.fitOn = false;
      k.cloud({ count: 2 * (160000 / 6000) }, (_r, i) =>
        i === 0
          ? { p: [0, 0, 0], color: "#ff0000", opacity: 0.5, scales: [0.3, 0.02, 0.01], quat: [0, 0, s, s] } // prettier-ignore
          : { p: [0.5, 0, 0], color: "#00ff00", size: 1, jitter: 0 },
      );
    },
  };
  const it = buildRecipe(recipe, { seed: 1, count: 6000, options: {} }, () => {});
  let b = it.next();
  while (!b.done) b = it.next();
  const buf = b.value.buf;
  expect(buf.count).toBe(2);
  expect([...buf.scale.slice(0, 3)].map((v) => +v.toFixed(4))).toEqual([0.3, 0.02, 0.01]);
  expect([...buf.rot.slice(0, 4)].map((v) => +v.toFixed(4))).toEqual([0, 0, 0.7071, 0.7071]);
  expect(+buf.color[3].toFixed(3)).toBe(0.5);
  // The other splat is sized as before: the base size, round.
  expect(buf.scale[3]).toBeCloseTo(buf.scale[4], 6);
  expect([...buf.rot.slice(4, 8)]).toEqual([0, 0, 0, 1]);
});
