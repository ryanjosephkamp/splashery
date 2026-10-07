// Lane Elements, engine: the sort of a turned part (src/pose.js). Splats on a part sort where
// the kit shader draws them; a quarter turn shows which way round (a half turn, which
// tests/bk.spec.mjs checks, is the same either way).

import { test, expect } from "@playwright/test";
import { posePass } from "../src/pose.js";

test("a part's quarter turn sorts its splats the way the shader draws them", () => {
  const leaf = new Float32Array(32);
  const parts = new Float32Array(16 * 12);
  for (let i = 0; i < 16; i++) parts[i * 12 + 3] = 1;
  // Part 1: a quarter turn about Y through the origin.
  parts.set([0, Math.SQRT1_2, 0, Math.SQRT1_2], 12);
  const pos = new Float32Array([1, 0, 0]);
  const anim = new Float32Array([1, 0, 0, 0]);
  const out = new Float32Array(3);
  expect(posePass(pos, anim, 1, out, leaf, parts)).toBe(1);
  // The splat at +x sorts at +z (toward the camera), where the shader draws it.
  [0, 0, 1].forEach((v, i) => expect(out[i]).toBeCloseTo(v, 5));
});
