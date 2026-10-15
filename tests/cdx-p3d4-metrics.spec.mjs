import { test, expect } from "@playwright/test";
import { streakR4, fringeR4 } from "../tools/cdx-p3d4-metrics.mjs";

test("the streak diagnostic distinguishes directional extrusion from an isotropic texture", () => {
  const width = 96,
    height = 64,
    data = new Uint8Array(width * height * 4),
    classes = new Uint8Array(width * height);
  for (let y = 0; y < height; y++)
    for (let x = 0; x < width; x++) {
      const i = y * width + x,
        value =
          x < 48
            ? 80 + 60 * Math.sin(y * 0.7)
            : 80 + 30 * Math.sin(y * 0.7) + 30 * Math.sin(x * 0.7);
      data.set([value, value, value, 255], i * 4);
      classes[i] = x < 44 ? 1 : x > 51 ? 2 : 0;
    }
  const result = streakR4({ width, height, data }, classes);
  expect(result.revealed.pixels).toBeGreaterThan(1000);
  expect(result.directionalExcess).toBeGreaterThan(0.5);
  expect(
    streakR4({ width, height, data }, new Uint8Array(classes.length)).directionalExcess,
  ).toBeNull();
});

test("the fringe diagnostic penalizes broad transitions and reports a missing wire", () => {
  const width = 64,
    height = 32;
  const near = [220, 40, 20],
    far = [20, 60, 160],
    profile = Array.from({ length: 25 }, (_, i) => ({ rgb: i >= 10 && i <= 14 ? near : far })),
    projected = [profile.map((_, i) => [20 + i, 16])],
    anchors = [{ near, far, profile }];
  const picture = (blur, gone = false) => {
    const data = new Uint8Array(width * height * 4);
    for (let y = 0; y < height; y++)
      for (let x = 0; x < width; x++) {
        const a = gone ? 0 : Math.max(0, Math.min(1, (3.5 - Math.abs(x - 32)) / blur));
        data.set([...far.map((v, c) => v + (near[c] - v) * a), 255], (y * width + x) * 4);
      }
    return { width, height, data };
  };
  expect(fringeR4(picture(4), projected, anchors).fringeMean).toBeGreaterThan(
    fringeR4(picture(1), projected, anchors).fringeMean,
  );
  expect(fringeR4(picture(1, true), projected, anchors).missing).toBe(1);
});

test("local fringe measurement retains clean edges when the revealed background changes color", () => {
  const width = 64,
    height = 32,
    near = [220, 40, 20],
    far = [20, 60, 160],
    newFar = [24, 184, 72];
  const profile = Array.from({ length: 25 }, (_, i) => ({ rgb: i >= 10 && i <= 14 ? near : far })),
    projected = [profile.map((_, i) => [20 + i, 16])],
    anchors = [{ near, far, profile }];
  const picture = (back, blur = 1) => {
    const data = new Uint8Array(width * height * 4);
    for (let y = 0; y < height; y++)
      for (let x = 0; x < width; x++) {
        const a = Math.max(0, Math.min(1, (3.5 - Math.abs(x - 32)) / blur));
        data.set([...back.map((v, c) => v + (near[c] - v) * a), 255], (y * width + x) * 4);
      }
    return { width, height, data };
  };
  const measure = (image) => fringeR4(image, projected, anchors, 1, { localBackground: true });
  const original = measure(picture(far)),
    changed = measure(picture(newFar)),
    blurred = measure(picture(newFar, 4));
  expect(changed.correctedBackgrounds).toBe(1);
  expect(changed.fringeMean).toBeCloseTo(original.fringeMean, 1);
  expect(blurred.fringeMean).toBeGreaterThan(changed.fringeMean);
});
