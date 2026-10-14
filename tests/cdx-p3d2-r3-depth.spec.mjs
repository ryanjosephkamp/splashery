import { test, expect } from "@playwright/test";
import { buildPhotoSplats } from "../src/packs/photo-3d-core.js";
import { refineDepthEdges } from "../src/photo3d/depth-edges.js";

test("a soft model boundary meets the photo's hard color edge without a depth ramp on either side", () => {
  const w = 128,
    h = 96;
  const data = new Uint8Array(w * h * 4);
  const dw = 32,
    dh = 24,
    d = new Float32Array(dw * dh);
  for (let y = 0; y < h; y++)
    for (let x = 0; x < w; x++)
      data.set(
        x >= 40 && x < 88 && y >= 28 && y < 68 ? [224, 48, 24, 255] : [24, 72, 184, 255],
        (y * w + x) * 4,
      );
  for (let y = 0; y < dh; y++)
    for (let x = 0; x < dw; x++) {
      const distance = Math.min(x + 0.5 - 10, 22 - x - 0.5, y + 0.5 - 7, 17 - y - 0.5);
      d[y * dw + x] = 1 + 4 * Math.max(0, Math.min(1, 0.5 + distance / 3));
    }
  const s = buildPhotoSplats({ w, h, data }, { w: dw, h: dh, d }, { count: 5000, depth: 1 });
  const at = (x, y) => s.depth[Math.floor((y * s.gy) / h) * s.gx + Math.floor((x * s.gx) / w)];
  expect(at(41, 48)).toBeGreaterThan(0.95);
  expect(at(38, 48)).toBeLessThan(0.05);
  // The inferred hidden background must not repeat the red foreground edge.
  const b = s.background;
  const p = (Math.floor((48 * b.h) / h) * b.w + Math.floor((42 * b.w) / w)) * 4;
  expect(Array.from(b.rgba.slice(p, p + 3))).toEqual([24, 72, 184]);
});

test("a color stripe on a continuous sloping surface keeps its depth slope", () => {
  const w = 80,
    h = 64,
    rgb = new Float32Array(w * h * 3),
    d = new Float32Array(w * h);
  for (let y = 0; y < h; y++)
    for (let x = 0; x < w; x++) {
      rgb.set(x < 40 ? [0.1, 0.3, 0.8] : [0.9, 0.2, 0.1], (y * w + x) * 3);
      d[y * w + x] = 0.2 + 0.006 * x + 0.002 * y;
    }
  const refined = refineDepthEdges(d, rgb, w, h, 8);
  let error = 0;
  for (let i = 0; i < d.length; i++) error = Math.max(error, Math.abs(refined[i] - d[i]));
  expect(error).toBeLessThan(0.00001);
});

test("a color stripe on a continuous curved surface keeps its curvature", () => {
  const w = 80,
    h = 64,
    rgb = new Float32Array(w * h * 3),
    d = new Float32Array(w * h);
  for (let y = 0; y < h; y++)
    for (let x = 0; x < w; x++) {
      rgb.set(x < 40 ? [0.1, 0.3, 0.8] : [0.9, 0.2, 0.1], (y * w + x) * 3);
      d[y * w + x] = 0.2 + 0.0003 * (x - 40) ** 2;
    }
  const refined = refineDepthEdges(d, rgb, w, h, 24);
  let error = 0;
  for (let i = 0; i < d.length; i++) error = Math.max(error, Math.abs(refined[i] - d[i]));
  expect(error).toBeLessThan(0.00001);
});

test("a color stripe at a smooth inflection cannot become a depth cut", () => {
  const w = 80,
    h = 64,
    rgb = new Float32Array(w * h * 3),
    d = new Float32Array(w * h);
  for (let y = 0; y < h; y++)
    for (let x = 0; x < w; x++) {
      rgb.set(x < 40 ? [0.1, 0.3, 0.8] : [0.9, 0.2, 0.1], (y * w + x) * 3);
      d[y * w + x] = 0.2 + 0.000003 * (x - 40) ** 3;
    }
  const refined = refineDepthEdges(d, rgb, w, h, 24);
  let error = 0;
  for (let i = 0; i < d.length; i++) error = Math.max(error, Math.abs(refined[i] - d[i]));
  expect(error).toBeLessThan(0.00001);
});

test("a broad soft model edge can meet the source boundary without flattening its stable interiors", () => {
  const w = 128,
    h = 80,
    rgb = new Float32Array(w * h * 3),
    d = new Float32Array(w * h);
  for (let y = 0; y < h; y++)
    for (let x = 0; x < w; x++) {
      rgb.set(x < 64 ? [0.1, 0.3, 0.8] : [0.9, 0.2, 0.1], (y * w + x) * 3);
      d[y * w + x] = 0.2 + 0.6 * Math.max(0, Math.min(1, (x - 52) / 24));
    }
  const refined = refineDepthEdges(d, rgb, w, h, 24);
  expect(refined[40 * w + 63]).toBeCloseTo(0.2, 5);
  expect(refined[40 * w + 64]).toBeCloseTo(0.8, 5);
  expect(refined[40 * w + 20]).toBe(d[40 * w + 20]);
  expect(refined[40 * w + 100]).toBe(d[40 * w + 100]);
});

test("a slope along a soft boundary does not prevent its cross-boundary refinement", () => {
  const w = 128,
    h = 16,
    rgb = new Float32Array(w * h * 3),
    d = new Float32Array(w * h);
  for (let y = 0; y < h; y++)
    for (let x = 0; x < w; x++) {
      rgb.set(x < 64 ? [0.1, 0.3, 0.8] : [0.9, 0.2, 0.1], (y * w + x) * 3);
      d[y * w + x] = 0.2 + 0.6 * Math.max(0, Math.min(1, (x - 52) / 24)) + 0.007 * y;
    }
  const refined = refineDepthEdges(d, rgb, w, h, 24);
  expect(refined[8 * w + 63]).toBeCloseTo(0.2 + 0.007 * 8, 5);
  expect(refined[8 * w + 64]).toBeCloseTo(0.8 + 0.007 * 8, 5);
});

test("the hard source boundary stays aligned when area sampling straddles source pixels", () => {
  const w = 512,
    h = 384,
    data = new Uint8Array(w * h * 4),
    dw = 64,
    dh = 48,
    d = new Float32Array(dw * dh);
  for (let y = 0; y < h; y++)
    for (let x = 0; x < w; x++)
      data.set(
        x >= 152 && x < 360 && y >= 104 && y < 280 ? [224, 48, 24, 255] : [24, 72, 184, 255],
        (y * w + x) * 4,
      );
  for (let y = 0; y < dh; y++)
    for (let x = 0; x < dw; x++) {
      const distance = Math.min(x + 0.5 - 19, 45 - x - 0.5, y + 0.5 - 13, 35 - y - 0.5);
      d[y * dw + x] = 1 + 4 * Math.max(0, Math.min(1, 0.5 + distance / 3));
    }
  const s = buildPhotoSplats({ w, h, data }, { w: dw, h: dh, d }, { count: 32000, depth: 1 });
  const at = (x, y) => s.depth[Math.floor((y * s.gy) / h) * s.gx + Math.floor((x * s.gx) / w)];
  expect(at(154, 192)).toBeGreaterThan(0.95);
  expect(at(149, 192)).toBeLessThan(0.05);
});
