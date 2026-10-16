import { test, expect } from "@playwright/test";
import { pictureMetrics } from "../tools/cdx-mp2-pixels.mjs";

test("the full-picture oracle counts a missing rim pixel and an introduced bright speck", () => {
  const w = 40,
    h = 30;
  const source = new Uint8ClampedArray(w * h * 4);
  for (let i = 0; i < source.length; i += 4) source.set([32, 32, 32, 255], i);
  const plain = source.slice();
  plain.set([255, 255, 255, 0], (2 * w + 2) * 4);
  plain.set([255, 255, 255, 255], (4 * w + 4) * 4);
  const result = pictureMetrics(plain, source, w, h);
  expect(result.pixels).toBe(w * h);
  expect(result.holes).toBe(1);
  expect(result.edgeSpecks).toBe(2);
});

test("a bright point already present in the source is not an introduced edge speck", () => {
  const w = 40,
    h = 30;
  const source = new Uint8ClampedArray(w * h * 4);
  for (let i = 0; i < source.length; i += 4) source.set([32, 32, 32, 255], i);
  source.set([255, 255, 255, 255], (4 * w + 4) * 4);
  expect(pictureMetrics(source, source, w, h).edgeSpecks).toBe(0);
});

test("a reprojected source detail uses its physical source neighborhood", () => {
  const w = 40,
    h = 30,
    at = 4 * w + 4;
  const reference = new Uint8ClampedArray(w * h * 4);
  for (let i = 0; i < reference.length; i += 4) reference.set([32, 32, 32, 255], i);
  const plain = reference.slice();
  plain.set([235, 237, 186, 255], at * 4);
  expect(pictureMetrics(plain, reference, w, h).edgeSpecks).toBe(1);
  expect(pictureMetrics(plain, reference, w, h, 12, { [at]: 245.6 }).edgeSpecks).toBe(0);
});

test("a borrowed distant bright color is absent from the physical source neighborhood", () => {
  const w = 40,
    h = 30,
    at = 4 * w + 4;
  const reference = new Uint8ClampedArray(w * h * 4);
  for (let i = 0; i < reference.length; i += 4) reference.set([32, 32, 32, 255], i);
  reference.set([255, 255, 255, 255], (w * h - 1) * 4);
  const plain = reference.slice();
  plain.set([255, 255, 255, 255], at * 4);
  expect(pictureMetrics(plain, reference, w, h, 12, { [at]: 32 }).edgeSpecks).toBe(1);
});

test("bright source detail cannot excuse a transparent tear", () => {
  const w = 40,
    h = 30,
    at = 4 * w + 4;
  const reference = new Uint8ClampedArray(w * h * 4);
  for (let i = 0; i < reference.length; i += 4) reference.set([32, 32, 32, 255], i);
  reference.set([255, 255, 255, 255], at * 4);
  const plain = reference.slice();
  plain.set([0, 0, 0, 0], at * 4);
  const r = pictureMetrics(plain, reference, w, h, 12, { [at]: 255 });
  expect(r.holes).toBe(1);
  expect(r.edgeSpecks).toBe(1);
});

test("an actual wall overhang is scanned beyond the uncut picture silhouette", () => {
  const w = 40,
    h = 30,
    at = 10 * w + 12;
  const reference = new Uint8ClampedArray(w * h * 4),
    plain = reference.slice(),
    mask = new Uint8Array(w * h);
  for (let y = 5; y < 25; y++)
    for (let x = 15; x < 35; x++) reference.set([32, 32, 32, 255], (y * w + x) * 4);
  for (let y = 5; y < 25; y++)
    for (let x = 10; x < 35; x++) {
      plain.set([32, 32, 32, 255], (y * w + x) * 4);
      mask[y * w + x] = 1;
    }
  plain.set([255, 255, 255, 255], at * 4);
  const r = pictureMetrics(plain, reference, w, h, 12, { [at]: 32 }, false, mask);
  expect(r.pixels).toBe(400);
  expect(r.holes).toBe(0);
  expect(r.edgeSpecks).toBe(1);
});

test("a visible-role mask cannot crop the hole reference or its denominator", () => {
  const w = 40,
    h = 30,
    reference = new Uint8ClampedArray(w * h * 4);
  for (let i = 0; i < reference.length; i += 4) reference.set([32, 32, 32, 255], i);
  const plain = reference.slice();
  plain.set([0, 0, 0, 0], (4 * w + 4) * 4);
  const r = pictureMetrics(plain, reference, w, h, 12, {}, false, new Uint8Array(w * h));
  expect(r.pixels).toBe(w * h);
  expect(r.holes).toBe(1);
});
