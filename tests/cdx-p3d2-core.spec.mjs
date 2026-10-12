import { test, expect } from "@playwright/test";
import { buildPhotoSplats } from "../src/packs/photo-3d-core.js";
import { minimumField, softenDepth } from "../src/photo3d/background.js";

test("the worker's quiet depth matches the shader's 25 bilinear samples", () => {
  const w = 9,
    h = 7,
    aspect = 1.8;
  const d = Float32Array.from({ length: w * h }, (_, i) => ((i * 17) % 31) / 31);
  const actual = softenDepth(d, w, h, aspect);
  const sample = (x, y) => {
    x = Math.max(0, Math.min(w - 1, x));
    y = Math.max(0, Math.min(h - 1, y));
    const i = Math.floor(x),
      j = Math.floor(y),
      fx = x - i,
      fy = y - j;
    return (
      (d[j * w + i] * (1 - fx) + d[j * w + Math.min(w - 1, i + 1)] * fx) * (1 - fy) +
      (d[Math.min(h - 1, j + 1) * w + i] * (1 - fx) +
        d[Math.min(h - 1, j + 1) * w + Math.min(w - 1, i + 1)] * fx) *
        fy
    );
  };
  for (let y = 0; y < h; y++)
    for (let x = 0; x < w; x++) {
      let expected = 0;
      for (let j = -2; j <= 2; j++)
        for (let i = -2; i <= 2; i++)
          expected += sample(x + (i * 0.02 * w) / aspect, y + j * 0.02 * h);
      expect(actual[y * w + x]).toBeCloseTo(expected / 25, 6);
    }
});

test("the background minimum matches a direct rectangular search, including borders", () => {
  const w = 13,
    h = 9;
  const d = Float32Array.from({ length: w * h }, (_, i) => ((i * 17) % 31) / 31);
  const actual = minimumField(d, w, h, 4, 2);
  for (let y = 0; y < h; y++)
    for (let x = 0; x < w; x++) {
      let m = Infinity;
      for (let j = Math.max(0, y - 2); j <= Math.min(h - 1, y + 2); j++)
        for (let i = Math.max(0, x - 4); i <= Math.min(w - 1, x + 4); i++)
          m = Math.min(m, d[j * w + i]);
      expect(actual[y * w + x]).toBe(m);
    }
});

const layers = () => {
  const w = 96,
    h = 72;
  const data = new Uint8Array(w * h * 4);
  const d = new Float32Array(w * h);
  for (let y = 0; y < h; y++)
    for (let x = 0; x < w; x++) {
      const near = x > 32 && x < 64 && y > 16 && y < 56;
      const i = y * w + x;
      data.set(near ? [240, 20, 10, 255] : [10, 40, y % 2 ? 180 : 220, 255], i * 4);
      d[i] = near ? 5 : 1;
    }
  return { photo: { w, h, data }, depth: { w, h, d } };
};

test("background depth and unblurred background color extend under a foreground object", () => {
  const { photo, depth } = layers();
  const s = buildPhotoSplats(photo, depth, { count: 5000, depth: 1 });
  expect(s.background).toBeDefined();
  const b = s.background;
  const i = Math.floor(b.h / 2) * b.w + Math.floor(b.w / 2);
  expect(b.depth[i]).toBeLessThan(0.1);
  expect(b.rgba[i * 4]).toBe(10);
  expect([180, 220]).toContain(b.rgba[i * 4 + 2]);
  expect(b.donor[i]).not.toBe(i);
  for (let k = 0; k < b.depth.length; k++) {
    expect(Number.isFinite(b.depth[k])).toBe(true);
    expect(b.rgba[k * 4 + 3]).toBe(255);
  }
});

test("a custom planar picture keeps its plane instead of expanding depth noise into steps", () => {
  const { photo, depth } = layers();
  for (let y = 0; y < depth.h; y++)
    for (let x = 0; x < depth.w; x++)
      depth.d[y * depth.w + x] = 10 + (x / depth.w) * 0.05 + (x % 2 ? 0.002 : -0.002);
  const s = buildPhotoSplats(photo, depth, { count: 5000, keepFlat: true });
  let worst = 0;
  for (let y = 2; y < s.gy - 2; y++)
    for (let x = 2; x < s.gx - 2; x++) {
      const i = y * s.gx + x;
      worst = Math.max(worst, Math.abs(s.depth[i - 1] + s.depth[i + 1] - 2 * s.depth[i]));
    }
  expect(worst).toBeLessThan(0.0001);
  expect(new Set(s.cellBand).size).toBe(1);
});
