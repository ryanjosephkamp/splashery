// Task 95: opt-in hybrid sheets retain the original splat path and bounded backing.
import { test, expect } from "@playwright/test";
import { buildSheet } from "../src/picture-splats.js";
import { surfaceGrid } from "../src/picture-surface.js";
import { Pictures } from "../src/pictures.js";

const job = (w = 128, h = 160) => ({
  w,
  h,
  method: "pixels",
  pixels: new Uint8ClampedArray(w * h * 4).fill(255),
  origin: [-1, 1, 0],
  right: [2 / w, 0, 0],
  down: [0, -2 / h, 0],
  normal: [0, 0, 1],
});

test("an immediately evicted prefetch is not rebuilt on every frame", () => {
  const p = Object.create(Pictures.prototype);
  const want = { sheet: 0, page: 0, level: 128, method: "ink", key: "0|128|ink|0" };
  Object.assign(p, {
    busy: false,
    media: { kind: "pdf", count: 100 },
    sheets: [{ want, shown: { ...want }, hidden: false }],
    cache: new Map(),
    order: 0,
  });
  const builds = [];
  p.build = (_sheet, w) => builds.push(w);
  p.pump();
  p.pump();
  p.pump();
  expect(builds).toHaveLength(1);
  expect(builds[0].page).toBe(1);
  p.sheets[0].want = { ...want, level: 256, key: "0|256|ink|0" };
  p.sheets[0].shown = { ...p.sheets[0].want };
  p.pump();
  expect(builds).toHaveLength(2);
});

test("continuous faces retain a Gaussian backing without allocating a hidden full raster of splats", () => {
  const j = job();
  const full = buildSheet(j),
    paper = buildSheet({ ...j, backingOnly: true }),
    photo = buildSheet({ ...j, sparse: true });
  const bytes = (d) =>
    Object.values(d)
      .filter(ArrayBuffer.isView)
      .reduce((n, a) => n + a.byteLength, 0);
  expect(paper.count).toBeGreaterThan(0);
  expect(bytes(paper)).toBeLessThan(bytes(full) * 0.1);
  expect(photo.count).toBeGreaterThan(j.w * j.h * 0.5);
  expect(bytes(photo)).toBeLessThan(bytes(full) * 0.6);
  for (const d of [paper, photo])
    for (const a of [d.center, d.centers, d.anim]) expect(a.every(Number.isFinite)).toBe(true);
});

test("masked cards have no soft Gaussian rim outside their hard silhouette", () => {
  const j = job();
  const d = new Float32Array([0, 0.49999, 0.5, 1]);
  const cut = buildSheet({
    ...j,
    backingOnly: true,
    relief: { w: 4, h: 1, d, amount: 0, keep: [0.5, 1] },
  });
  expect(cut.count).toBe(0);
  // The continuous face is a connected rectangle; the fragment mask, not
  // disconnected displaced splats, supplies its cutout boundary.
  const grid = surfaceGrid(j, j.w, j.h);
  const seen = new Set(grid.indices);
  expect(seen.size).toBe(grid.positions.length / 3);
  expect(Math.min(...grid.positions.filter((_, i) => i % 3 === 0))).toBe(-1);
  expect(Math.max(...grid.positions.filter((_, i) => i % 3 === 0))).toBe(1);
});

test("a face stays on its sheet plane and a raised crop retains its full depth", () => {
  const j = job();
  const flat = surfaceGrid({ ...j, lift: 0.012 }, j.w, j.h);
  const raised = surfaceGrid({ ...j, lift: 0.012 }, j.w, j.h, {
    w: 8,
    h: 8,
    d: new Float32Array(64).fill(1),
    amount: 0.2,
  });
  expect(flat.positions.every((x, i) => i % 3 !== 2 || Math.abs(x - 0.012) < 1e-6)).toBe(true);
  expect(raised.positions.every((x, i) => i % 3 !== 2 || Math.abs(x - 0.212) < 1e-6)).toBe(true);
});
