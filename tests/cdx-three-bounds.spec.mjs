import { test, expect } from "@playwright/test";
import * as pc from "../src/pc.js";
import { updateTokenBounds } from "../src/token-bounds.js";

function resource() {
  return {
    aabb: new pc.BoundingBox(new pc.Vec3(1, 0, 0), new pc.Vec3(2, 1, 0.5)),
    updates: 0,
    update() {
      this.updates++;
    },
  };
}

test("the token bounds cover translation and rotation around the origin", () => {
  const r = resource();
  const original = r.aabb.clone();
  const q = new pc.Quat().setFromEulerAngles(0, 90, 0);
  const tokens = new Float32Array([-4, 2, -6, 1, q.x, q.y, q.z, q.w]);
  const component = {};
  expect(updateTokenBounds(r, tokens, component)).toBe(true);
  expect(r.updates).toBe(1);
  expect(component.customAabb).toBe(r.aabb);
  const matrix = new pc.Mat4().setTRS(
    new pc.Vec3(-4, 2, -6),
    new pc.Quat(...tokens.slice(4)),
    new pc.Vec3(1, 1, 1),
  );
  for (const x of [-1, 3])
    for (const y of [-1, 1])
      for (const z of [-0.5, 0.5]) {
        const p = matrix.transformPoint(new pc.Vec3(x, y, z));
        const min = r.aabb.getMin(),
          max = r.aabb.getMax();
        for (const k of ["x", "y", "z"]) {
          expect(p[k]).toBeGreaterThanOrEqual(min[k] - 1e-6);
          expect(p[k]).toBeLessThanOrEqual(max[k] + 1e-6);
        }
      }
  expect(original.center.toArray()).toEqual([1, 0, 0]);
  expect(updateTokenBounds(r, tokens, component)).toBe(false);
  expect(r.updates).toBe(1);
  expect(updateTokenBounds(r, new Float32Array([0, 0, 0, 1, 0, 0, 0, 1]), component)).toBe(false);
  expect(r.updates).toBe(1);
});

test("hidden tokens and empty uniforms do not expand or update the bounds", () => {
  const r = resource();
  expect(updateTokenBounds(r)).toBe(false);
  expect(updateTokenBounds(r, new Float32Array([100, 200, -300, 0, 0, 0, 0, 1]))).toBe(false);
  expect(r.updates).toBe(0);
});

test("a geometry upload starts a new envelope, and zero quaternions are identity", () => {
  const r = resource();
  updateTokenBounds(r, new Float32Array([0, 0, -20, 1, 0, 0, 0, 0]));
  expect(r.aabb.getMin().z).toBe(-20.5);
  r.aabb = new pc.BoundingBox(new pc.Vec3(), new pc.Vec3(1, 1, 1));
  updateTokenBounds(r, new Float32Array([0, 0, -4, 1, 0, 0, 0, 0]));
  expect(r.aabb.getMin().z).toBe(-5);
  expect(r.aabb.getMax().z).toBe(1);
});
