import { test, expect } from "@playwright/test";
import { surfaceGrid } from "../src/photo3d/surface.js";

test("prepared cut cells retain their own depth at shared corners and classify both sides of the cut", () => {
  const depth = new Uint8Array([0, 255]),
    band = new Uint8Array([0, 3]);
  const s = surfaceGrid(2, 1, { depth, band, gx: 2, gy: 1, cut: 0.03 });
  expect(s.meta).toBeDefined();
  for (let vertex = 0; vertex < 4; vertex++) {
    expect(Array.from(s.meta.slice(vertex * 4, vertex * 4 + 4))).toEqual([0, 0, 32, 0]);
    expect(Array.from(s.meta.slice((vertex + 4) * 4, (vertex + 4) * 4 + 4))).toEqual([1, 3, 1, 1]);
  }
  expect(Array.from(depth)).toEqual([0, 255]);
  expect(Array.from(band)).toEqual([0, 3]);
});

test("a continuous plane below the cut threshold has no precomputed cut edges", () => {
  const depth = Uint8Array.from({ length: 16 }, (_, i) => 64 + 7 * (i % 4) + 7 * Math.floor(i / 4));
  const s = surfaceGrid(4, 4, { depth, band: new Uint8Array(16), gx: 4, gy: 4, cut: 0.03 });
  for (let i = 0; i < s.meta.length; i += 4) expect(Math.round(s.meta[i + 2]) & 255).toBe(0);
});

test("a vertex near the cut threshold requests native sampling for its whole cell", () => {
  const depth = Uint8Array.from({ length: 64 }, (_, i) => [0, 15, 15, 0][i % 4]);
  const s = surfaceGrid(4, 4, { depth, band: new Uint8Array(64), gx: 8, gy: 8, cut: 0.03 });
  for (let vertex = 0; vertex < 4; vertex++) {
    const mask = Math.round(s.meta[(5 * 4 + vertex) * 4 + 2]);
    expect(mask & 255).toBe(0);
    expect(mask & 256).toBe(256);
  }
});

test("a cut cell centered between depth texels keeps its own surface depth", () => {
  const depth = new Uint8Array([0, 0, 255, 255]);
  const s = surfaceGrid(3, 1, {
    depth,
    band: new Uint8Array([0, 0, 3, 3]),
    gx: 4,
    gy: 1,
    cut: 0.03,
  });
  for (let vertex = 0; vertex < 4; vertex++) expect(s.meta[(4 + vertex) * 4 + 3]).toBe(1);
});
