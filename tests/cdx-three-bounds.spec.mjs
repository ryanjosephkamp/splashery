import { test, expect } from "@playwright/test";
import * as pc from "../src/pc.js";
import { updateTokenBounds } from "../src/token-bounds.js";
import { assertSafeArguments, safeLaunchOptions } from "./cdx-three-browser.mjs";

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

test("one envelope contains multiple tokens and preserves earlier poses", () => {
  const r = resource();
  const tokens = new Float32Array([
    -10, 3, -20, 1, 0, 0, 0, 1, 12, -4, 8, 1, 0, 0, 1, 0, 1000, 1000, 1000, 0, 0, 0, 0, 1,
  ]);
  expect(updateTokenBounds(r, tokens)).toBe(true);
  // The second token rotates 180 degrees around Z. Compute expected extrema
  // directly from the original corners, independently of the helper's Mat4.
  expect(r.aabb.getMin().toArray()).toEqual([-11, -5, -20.5]);
  expect(r.aabb.getMax().toArray()).toEqual([13, 4, 8.5]);
  const expanded = r.aabb;
  expect(updateTokenBounds(r, new Float32Array([0, 0, -2, 1, 0, 0, 0, 1]))).toBe(false);
  expect(updateTokenBounds(r, new Float32Array([1000, 0, 0, 0, 0, 0, 0, 1]))).toBe(false);
  expect(r.aabb).toBe(expanded);
  expect(r.updates).toBe(1);
});

test("different resources keep independent envelopes", () => {
  const first = resource();
  const second = resource();
  updateTokenBounds(first, new Float32Array([0, 0, -30, 1, 0, 0, 0, 1]));
  updateTokenBounds(second, new Float32Array([0, 0, 4, 1, 0, 0, 0, 1]));
  expect(first.aabb.getMin().z).toBe(-30.5);
  expect(first.aabb.getMax().z).toBe(0.5);
  expect(second.aabb.getMin().z).toBe(-0.5);
  expect(second.aabb.getMax().z).toBe(4.5);
});

test("the task browser launch retains sandboxing and rejects unsafe arguments", () => {
  const options = safeLaunchOptions();
  expect(options.chromiumSandbox).toBe(true);
  expect(options.args).toEqual([]);
  expect(options.ignoreDefaultArgs).toContain("--enable-unsafe-swiftshader");
  expect(() => assertSafeArguments(["--headless", "--enable-automation"])).not.toThrow();
  for (const arg of [
    "--enable-unsafe-swiftshader",
    "--enable-unsafe-webgpu",
    "--no-sandbox",
    "--disable-gpu-sandbox=true",
    "--ignore-gpu-blocklist",
    "--disable-web-security",
    "--unsafely-disable-devtools-self-xss-warnings",
  ])
    expect(() => assertSafeArguments([arg])).toThrow(/Unsafe browser launch/);
});
