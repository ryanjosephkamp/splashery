import { test, expect } from "@playwright/test";
import fs from "node:fs";
import { makeWoven, makeWovenAsync, renderingKey } from "../src/qr-craft/picture.js";
import { validateDetail } from "../src/qr-craft/scan-pool.js";
import { loadBlurKernel } from "../src/qr-craft/fast-blur.js";
import { loadSecondReader } from "../src/qr-craft/second-reader.js";
import { read } from "../tools/qrc-picture.mjs";

test("A narrower optional finder guard restores picture cells and still passes the complete two-reader forecast", async () => {
  await loadBlurKernel(fs.readFileSync("src/qr-craft/blur.wasm"));
  await loadSecondReader(fs.readFileSync("src/qr-craft/vendor/zxing/reader/zxing_reader.wasm"));
  const pic = { w: 48, h: 48, data: new Float32Array(48 * 48 * 3).fill(0.5) };
  const options = {
    text: "https://example.org/finder-guard",
    shape: "square",
    fidelity: "detail",
    level: "H",
    size: "more",
    center: "small",
    style: "color",
    contrast: 0.5,
    preferContinuous: true,
    texture: "tiles",
    channel: "weighted",
  };
  const original = makeWoven(pic, { ...options, finderGuard: 3 });
  const narrower = makeWoven(pic, { ...options, finderGuard: 1 });
  expect(narrower.plain.reduce((sum, x) => sum + x, 0)).toBeLessThan(
    original.plain.reduce((sum, x) => sum + x, 0),
  );
  expect(narrower.code.dark).toEqual(original.code.dark);
  expect(await validateDetail(narrower, pic, "square", read)).toMatchObject({
    ok: true,
    layoutChecked: true,
    readers: ["jsqr", "zxingcpp"],
  });
});

test("Weighted picture fitting can prefer a bounded correction candidate without changing the payload", async () => {
  await loadBlurKernel(fs.readFileSync("src/qr-craft/blur.wasm"));
  await loadSecondReader(fs.readFileSync("src/qr-craft/vendor/zxing/reader/zxing_reader.wasm"));
  const pic = { w: 48, h: 48, data: new Float32Array(48 * 48 * 3).fill(0.5) };
  const seen = [];
  const w = await makeWovenAsync(
    pic,
    {
      text: "https://example.org/correction-first",
      shape: "square",
      fidelity: "detail",
      level: "H",
      size: "more",
      center: "small",
      style: "color",
      contrast: 0.5,
      preferContinuous: true,
      preferCorrection: true,
      texture: "tiles",
      channel: "weighted",
    },
    async (candidate, picture, shape) => {
      seen.push(candidate.rendering);
      return validateDetail(candidate, picture, shape, read);
    },
  );
  expect(seen[0]).toMatchObject({ method: "correction", fraction: 0.4 });
  expect(w.code.text).toBe("https://example.org/correction-first");
  expect(w.detailCheck).toMatchObject({
    ok: true,
    layoutChecked: true,
    readers: ["jsqr", "zxingcpp"],
  });
});

test("A rejected first tile candidate tries the opposite orientation before cycling finder tones", async () => {
  await loadBlurKernel(fs.readFileSync("src/qr-craft/blur.wasm"));
  await loadSecondReader(fs.readFileSync("src/qr-craft/vendor/zxing/reader/zxing_reader.wasm"));
  const pic = { w: 48, h: 48, data: new Float32Array(48 * 48 * 3).fill(0.5) },
    rotations = [];
  const w = await makeWovenAsync(
    pic,
    {
      text: "https://example.org/early-rotation",
      shape: "square",
      fidelity: "detail",
      level: "H",
      size: "more",
      center: "small",
      style: "color",
      contrast: 0.5,
      preferContinuous: true,
      texture: "tiles",
      channel: "weighted",
    },
    async (candidate, picture, shape) => {
      rotations.push(candidate.code.rotation || 0);
      if (rotations.length === 1) return { ok: false, preflight: true };
      expect(rotations).toEqual([0, 2]);
      return validateDetail(candidate, picture, shape, read);
    },
  );
  expect(w.detailCheck).toMatchObject({ ok: true, readers: ["jsqr", "zxingcpp"] });
  expect(rotations).toEqual([0, 2]);
});

test("An initial correction request retains at least forty percent of the correction reserve", () => {
  const pic = { w: 24, h: 24, data: new Float32Array(24 * 24 * 3).fill(0.5) };
  const options = {
    text: "https://example.org/correction-reserve",
    shape: "square",
    fidelity: "detail",
    level: "H",
    size: "more",
    center: "small",
    style: "color",
    contrast: 0.5,
    preferContinuous: true,
    preferCorrection: true,
    texture: "tiles",
    channel: "weighted",
  };
  expect(makeWoven(pic, { ...options, errorFraction: 0.6 }).rendering.fraction).toBe(0.6);
  expect(makeWoven(pic, { ...options, errorFraction: 99 }).rendering.fraction).toBe(0.6);
});

test("An actual rejection reduces the correction budget before another finder-only attempt", () => {
  const pic = { w: 24, h: 24, data: new Float32Array(24 * 24 * 3).fill(0.5) };
  const options = {
    text: "https://example.org/correction-backoff",
    shape: "square",
    fidelity: "detail",
    level: "H",
    size: "more",
    center: "small",
    style: "color",
    contrast: 0.5,
    preferContinuous: true,
    preferCorrection: true,
    texture: "tiles",
    channel: "weighted",
    errorFraction: 0.6,
  };
  const rejected = makeWoven(pic, options);
  expect(
    makeWoven(pic, { ...options, rejected: [renderingKey(rejected)] }).rendering.fraction,
  ).toBe(0.4);
});

test("A failed perspective forecast tries spatial repair before reducing an already bounded correction fit", async () => {
  await loadBlurKernel(fs.readFileSync("src/qr-craft/blur.wasm"));
  await loadSecondReader(fs.readFileSync("src/qr-craft/vendor/zxing/reader/zxing_reader.wasm"));
  const pic = { w: 48, h: 48, data: new Float32Array(48 * 48 * 3).fill(0.5) },
    rotations = [];
  const w = await makeWovenAsync(
    pic,
    {
      text: "https://example.org/early-rotation",
      shape: "square",
      fidelity: "detail",
      level: "H",
      size: "more",
      center: "small",
      style: "color",
      contrast: 0.5,
      preferContinuous: true,
      preferCorrection: true,
      errorFraction: 0.6,
      texture: "tiles",
      channel: "weighted",
    },
    async (candidate, picture, shape) => {
      rotations.push(candidate.code.rotation || 0);
      if (rotations.length === 1) return { ok: false, preflight: true, ppm: 4, blur: 0.3, view: 2 };
      expect(rotations).toEqual([0, 2]);
      return validateDetail(candidate, picture, shape, read);
    },
  );
  expect(w.detailCheck).toMatchObject({ ok: true, readers: ["jsqr", "zxingcpp"] });
});
