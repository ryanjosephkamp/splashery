import test from "node:test";
import assert from "node:assert/strict";

const m = await import("../tools/studio-truth/metrics.mjs").catch(() => ({}));
const near = (a, b, epsilon = 1e-8) => assert.ok(Math.abs(a - b) < epsilon, `${a} vs ${b}`);

test("affine inverse-depth calibration is evaluated on held-out pixels", () => {
  assert.equal(typeof m.fitInverseDepth, "function");
  const z = Float32Array.from({ length: 64 }, (_, i) => 1 + i / 16);
  const d = Float32Array.from(z, (v) => 2 / v + 7);
  const mask = new Uint8Array(64).fill(1);
  const fit = m.fitInverseDepth(d, z, mask);
  near(fit.scale, 0.5, 1e-6);
  near(fit.shift, -3.5, 1e-6);
  const score = m.depthError(d, z, mask, fit);
  assert.equal(score.pixels, 56);
  assert.ok(score.absRel < 1e-6);
});

test("invalid and appearance-ambiguous truth cannot improve a depth score", () => {
  assert.equal(typeof m.depthError, "function");
  const z = Float32Array.from({ length: 32 }, (_, i) => 1 + i / 16);
  const d = Float32Array.from(z, (v) => 1 / v);
  const mask = new Uint8Array(32).fill(1);
  mask[1] = 0;
  mask[2] = 3;
  z[3] = NaN;
  d[1] = d[2] = d[3] = 1000;
  const score = m.depthError(d, z, mask, { scale: 1, shift: 0 });
  assert.equal(score.pixels, 25);
  assert.ok(score.absRel < 1e-6);
});

test("invalid predictions count as holes and a wrong depth ordering is rejected", () => {
  assert.equal(typeof m.fitInverseDepth, "function");
  const z = Float32Array.from({ length: 32 }, (_, i) => 1 + i / 16);
  assert.throws(() => m.fitInverseDepth(z, z, new Uint8Array(32).fill(1)), /ordering/);
  const d = Float32Array.from(z, (v) => 1 / v);
  d[1] = NaN;
  d[2] = 0;
  const score = m.depthError(d, z, new Uint8Array(32).fill(1), { scale: 1, shift: 0 });
  assert.equal(score.holePixels, 2);
  near(score.holeFraction, 2 / 28);
});

test("identical images have zero color error, unit SSIM, and unit sharpness", () => {
  assert.equal(typeof m.imageMetrics, "function");
  const a = Uint8Array.from({ length: 12 * 12 * 4 }, (_, i) =>
    i % 4 === 3 ? 255 : (i * 23) % 255,
  );
  const score = m.imageMetrics(a, a, 12, 12, new Uint8Array(144).fill(1));
  near(score.mae, 0);
  near(score.ssim, 1);
  near(score.sharpnessRatio, 1);
  assert.equal(score.psnr, null); // Exact equality, represented without JSON Infinity.
});

test("a blurred render loses sharpness without being scored as a hole", () => {
  assert.equal(typeof m.imageMetrics, "function");
  const a = Uint8Array.from({ length: 16 * 16 * 4 }, (_, i) =>
    i % 4 === 3 ? 255 : (Math.floor(i / 4) % 2) * 255,
  );
  const b = Uint8Array.from(a, (_, i) => (i % 4 === 3 ? 255 : 128));
  const score = m.imageMetrics(a, b, 16, 16, new Uint8Array(256).fill(1));
  assert.ok(score.sharpnessRatio < 0.01);
  assert.equal(score.holePixels, 0);
  assert.ok(score.ssim < 0.1);
});

test("camera motion is removed before temporal depth jitter is counted", () => {
  assert.equal(typeof m.temporalJitter, "function");
  const k = [
    [20, 0, 2],
    [0, 20, 2],
    [0, 0, 1],
  ];
  const a = {
    K: k,
    camera_to_world: [
      [1, 0, 0, 0],
      [0, 1, 0, 0],
      [0, 0, 1, 0],
      [0, 0, 0, 1],
    ],
  };
  const b = {
    K: k,
    world_to_camera: [
      [1, 0, 0, 0],
      [0, 1, 0, 0],
      [0, 0, 1, -0.5],
      [0, 0, 0, 1],
    ],
  };
  const zA = new Float32Array(16).fill(3),
    zB = new Float32Array(16).fill(2.5);
  const mask = new Uint8Array(16).fill(1);
  const score = m.temporalJitter(zA, zB, zA, zB, mask, mask, a, b, 4, 4);
  near(score.meanMeters, 0);
  const bad = new Float32Array(16).fill(2.6);
  assert.ok(m.temporalJitter(zA, bad, zA, zB, mask, mask, a, b, 4, 4).meanMeters > 0.09);
});
