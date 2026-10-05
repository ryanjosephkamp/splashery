// Lane Live r7's engine change: relief splats moved by a toy's screen canvas
// (a 3D offset per splat) sort where the canvas puts them (src/pose.js
// posePass with `relief`), so splats a recipe moves every frame, like the
// Chladni plate's live sand, don't draw under the plate. Toys that don't
// pass a screen sort exactly as before.

import { test, expect } from "@playwright/test";
import { posePass } from "../src/pose.js";
import { KINDS } from "../src/effects.js";

// Three splats: a relief splat (axis 3) on part 0, one on part 1, and a plain
// splat on part 0. The canvas is 4 by 1: the colors on the left half, the
// offsets on the right.
function setup() {
  const pos = new Float32Array([0, 0, 0, 1, 1, 1, 5, 5, 5]);
  const anim = new Float32Array(12);
  const lift = 500; // half a toy unit, in thousandths
  // Relief splat 0 reads texel u = 0.25 (the right half's first column).
  anim.set([0, KINDS.relief, 0.25 + 6, 0.5 + 2 * lift], 0);
  // Relief splat 1 on part 1 reads u = 0.75 (the second column).
  anim.set([1, KINDS.relief, 0.75 + 6, 0.5 + 2 * lift], 4);
  anim.set([0, 0, 0, 0], 8);
  const data = new Uint8ClampedArray(4 * 4);
  data.set([255, 128, 0, 255], 2 * 4); // +x, about nothing, −z
  data.set([128, 255, 128, 255], 3 * 4); // +y
  return { pos, anim, relief: { data, width: 4, height: 1 } };
}
const leaf = new Float32Array(32);
// Part 1 at rest: no turn (w = 1), no move.
const parts = new Float32Array(16 * 12);
for (let p = 0; p < 16; p++) parts[p * 12 + 3] = 1;

test("relief splats sort where their screen texel moves them", () => {
  const { pos, anim, relief } = setup();
  const out = new Float32Array(9).fill(-9);
  posePass(pos, anim, 3, out, leaf, parts, relief);
  const k = (2 * 500 * 0.001) / 255;
  expect(out[0]).toBeCloseTo(127.5 * k, 4);
  expect(out[1]).toBeCloseTo(0.5 * k, 4);
  expect(out[2]).toBeCloseTo(-127.5 * k, 4);
  expect(out[3]).toBeCloseTo(1 + 0.5 * k, 4);
  expect(out[4]).toBeCloseTo(1 + 127.5 * k, 4);
  expect(out[5]).toBeCloseTo(1 + 0.5 * k, 4);
  // The plain splat on part 0 is left alone, as before.
  expect(out[6]).toBe(-9);
});

test("without a screen nothing changes: part 0 splats are skipped, part splats keep their rest", () => {
  const { pos, anim } = setup();
  const out = new Float32Array(9).fill(-9);
  posePass(pos, anim, 3, out, leaf, parts);
  expect(Array.from(out.slice(0, 3))).toEqual([-9, -9, -9]);
  expect(Array.from(out.slice(3, 6))).toEqual([1, 1, 1]);
  expect(out[6]).toBe(-9);
});
