import { test, expect } from "@playwright/test";
import { direction } from "../src/pano3d/core.js";

test("yaw rotation preserves pixels and reports its exact integer-pixel offset", async () => {
  const { rotatePhoto } = await import("../src/pano3d/prior.js");
  const photo = { w: 6, h: 3, data: Uint8ClampedArray.from({ length: 72 }, (_, i) => i) };
  const before = photo.data.slice();
  const rotated = rotatePhoto(photo, 0.25);
  expect(rotated.offset).toBe(2 / 6);
  expect(Array.from(rotated.photo.data.slice(0, 4))).toEqual(Array.from(before.slice(8, 12)));
  expect(photo.data).toEqual(before);
});

test("featureless input abstains from global calibration and keeps the local field", async () => {
  const { panoramaPrior } = await import("../src/pano3d/prior.js");
  const photo = { w: 64, h: 32, data: new Uint8ClampedArray(64 * 32 * 4).fill(100) };
  const cube = { w: 8, h: 4, d: new Float32Array(32).fill(30) };
  const observations = Array.from({ length: 4 }, (_, j) => ({
    w: 8,
    h: 4,
    d: new Float32Array(32).fill(100),
    offset: j / 4,
  }));
  const result = panoramaPrior(photo, observations, cube);
  expect(result.depth).toBe(cube);
  expect(result.calibration.supported).toBe(false);
});

test("four affine yaw predictions produce finite, periodic spherical depth", async () => {
  const { panoramaPrior } = await import("../src/pano3d/prior.js");
  const w = 96,
    h = 48;
  const radial = (u, v) => {
    const r = direction(u, v);
    return 3 + 0.4 * r[0] + 0.2 * r[1];
  };
  const photo = {
    w: 128,
    h: 64,
    data: Uint8ClampedArray.from({ length: 128 * 64 * 4 }, (_, i) =>
      i % 4 === 3 ? 255 : (i * 71 + Math.floor(i / 512) * 13) % 256,
    ),
  };
  const observations = Array.from({ length: 4 }, (_, j) => ({
    offset: j / 4,
    w,
    h,
    d: Float32Array.from(
      { length: w * h },
      (_, i) =>
        (1 / radial(((i % w) + 0.5) / w + j / 4, (Math.floor(i / w) + 0.5) / h) - j * 0.01) /
        (1 + j * 0.1),
    ),
  }));
  const cube = {
    w,
    h,
    d: Float32Array.from({ length: w * h }, (_, i) =>
      radial(((i % w) + 0.5) / w, (Math.floor(i / w) + 0.5) / h),
    ),
  };
  const result = panoramaPrior(photo, observations, cube);
  expect(result.depth.d.every((v) => Number.isFinite(v) && v > 0)).toBe(true);
  const { depth } = result;
  for (let y = 0; y < depth.h; y++) {
    const a = depth.d[y * depth.w],
      b = depth.d[(y + 1) * depth.w - 1];
    expect(Math.abs(a - b) / Math.max(a, b)).toBeLessThan(0.015);
  }
  const meanError =
    Array.from(
      depth.d,
      (v, i) =>
        Math.abs(
          v - radial(((i % depth.w) + 0.5) / depth.w, (Math.floor(i / depth.w) + 0.5) / depth.h),
        ) / v,
    ).reduce((a, b) => a + b) / depth.d.length;
  expect(meanError).toBeLessThan(0.03);
});

test("sequential yaw inference can reuse one buffer without changing source pixels", async () => {
  const { rotatePhoto } = await import("../src/pano3d/prior.js");
  const photo = {
    w: 64,
    h: 32,
    data: Uint8ClampedArray.from({ length: 64 * 32 * 4 }, (_, i) => i % 251),
  };
  const source = photo.data.slice(),
    scratch = new Uint8ClampedArray(source.length);
  for (const offset of [0.25, 0.5, 0.75]) {
    const expected = rotatePhoto(photo, offset);
    const reused = rotatePhoto(photo, offset, scratch);
    expect(reused.photo.data).toBe(scratch);
    expect(reused.photo.data).toEqual(expected.photo.data);
    expect(photo.data).toEqual(source);
  }
});
