import test from "node:test";
import assert from "node:assert/strict";
const m = await import("../tools/studio-truth/novel.mjs").catch(() => ({}));
const close = (a, b) => assert.ok(Math.abs(a - b) < 1e-10, `${a} vs ${b}`);
const identity = [
  [1, 0, 0, 0],
  [0, 1, 0, 0],
  [0, 0, 1, 0],
  [0, 0, 0, 1],
];
const pose = {
  width: 640,
  height: 360,
  K: [
    [720, 0, 320],
    [0, 720, 180],
    [0, 0, 1],
  ],
  camera_to_world: identity,
};

test("median-plane camera calibration preserves the source pinhole projection", () => {
  assert.equal(typeof m.calibratedCamera, "function");
  const result = m.calibratedCamera(pose, pose, 10, 1);
  assert.deepEqual(result.position, [0, 0, 2]);
  assert.deepEqual(result.rotation, [
    [1, 0, 0],
    [0, 1, 0],
    [0, 0, 1],
  ]);
  const world = [2, -1, 10];
  const point = m.worldToRecipePoint(world, pose, 10, 1);
  close(point[0], 0.4);
  close(point[1], 0.2);
  close(point[2], 0);
  close(320 + (720 * world[0]) / world[2], 320 + (720 * point[0]) / 2);
  close(180 + (720 * world[1]) / world[2], 180 - (720 * point[1]) / 2);
});

test("known world camera motion maps to recipe coordinates without fitting held-out images", () => {
  const target = {
    ...pose,
    camera_to_world: [
      [1, 0, 0, 1],
      [0, 1, 0, 0.5],
      [0, 0, 1, 2],
      [0, 0, 0, 1],
    ],
  };
  const result = m.calibratedCamera(pose, target, 10, 1);
  close(result.position[0], 0.2);
  close(result.position[1], -0.1);
  close(result.position[2], 1.6);
});

test("camera calibration rejects missing or nonpositive depth scale", () => {
  assert.throws(() => m.calibratedCamera(pose, pose, NaN, 1), /calibration/);
  assert.throws(() => m.calibratedCamera(pose, pose, 0, 1), /calibration/);
});
