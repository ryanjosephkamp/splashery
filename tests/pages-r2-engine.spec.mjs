// Task 95: opt-in hybrid sheets retain the original splat path and bounded backing.
import { test, expect } from "@playwright/test";
import { buildSheet } from "../src/picture-splats.js";
import { surfaceGrid, grayPixels, rampPixels } from "../src/picture-surface.js";
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

test("monochrome storage preserves every opaque gray value and rejects color or transparency", () => {
  const rgba = new Uint8ClampedArray(256 * 4);
  for (let i = 0; i < 256; i++) rgba.set([i, i, i, 255], i * 4);
  expect([...grayPixels(rgba)]).toEqual(Array.from({ length: 256 }, (_, i) => i));
  rgba[1] = 1;
  expect(grayPixels(rgba)).toBe(null);
  rgba[1] = 0;
  rgba[3] = 254;
  expect(grayPixels(rgba)).toBe(null);
});

test("two-color coverage checks every color, including equal-brightness outliers", () => {
  const rgba = new Uint8ClampedArray(256 * 4);
  for (let i = 0; i < 256; i++)
    rgba.set([23, 32, 42].map((v) => Math.round(v + ((255 - v) * i) / 255)).concat(255), i * 4);
  const r = rampPixels(rgba);
  expect(r.pixels).toHaveLength(256);
  for (let i = 0; i < 256; i++)
    for (let k = 0; k < 3; k++)
      expect(
        Math.abs(
          Math.round(255 * (r.low[k] + ((r.high[k] - r.low[k]) * r.pixels[i]) / 255)) -
            rgba[i * 4 + k],
        ),
      ).toBeLessThanOrEqual(1);
  rgba.set([200, 10, 40, 255], 64);
  expect(rampPixels(rgba)).toBe(null);
  expect(rampPixels(new Uint8ClampedArray([255, 0, 0, 255, 0, 255, 0, 255]))).toBe(null);
  expect(rampPixels(new Uint8ClampedArray())).toBe(null);
});

test("native color pixels keep every RGBA byte while releasing their staging canvas", () => {
  const rgba = new Uint8ClampedArray([35, 120, 198, 255, 180, 27, 60, 143]);
  const canvas = {
    width: 2,
    height: 1,
    getContext: () => ({ getImageData: () => ({ data: rgba }) }),
  };
  const surface = { source: canvas, w: 2, h: 1 };
  Pictures.prototype.compactSurface({ surface }, false, true);
  expect([...surface.pixels]).toEqual([...rgba]);
  expect(surface.channels).toBe(4);
  expect(surface.sourceBytes).toBe(8);
  expect(surface.source).toBe(null);
  expect([canvas.width, canvas.height]).toEqual([1, 1]);
});

test("native-image caching keeps the latest resolution for each page", () => {
  const p = Object.create(Pictures.prototype);
  Object.assign(p, { budget: { ink: 220000 }, cache: new Map(), sheets: [] });
  const data = (page) => ({ count: 1, resolutionKey: `0|${page}|pixels|0|` });
  p.remember("page0-small", data(0));
  p.remember("page1", data(1));
  p.remember("page0-large", data(0));
  expect([...p.cache.keys()]).toEqual(["page1", "page0-large"]);
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

test("an opening view installs its first face before upgrading to settled detail", () => {
  const p = Object.create(Pictures.prototype);
  const sheet = { i: 0, def: { id: "face" }, shown: null, want: null };
  let width = 128;
  Object.assign(p, {
    solid: true,
    media: { kind: "pdf", count: 1, aspect: () => 1 },
    sheets: [sheet],
    retiring: [],
    page: 0,
    order: 0,
    stage: { requestRender() {} },
    screenWidth: () => width,
    levelFor: (_sheet, _aspect, pixels) => pixels,
    pump() {},
  });
  p.update({}, 0);
  const first = sheet.want.key;
  width = 512;
  p.update({}, 1);
  expect(sheet.want.key).toBe(first);
  sheet.shown = { ...sheet.want };
  sheet.levelSince = performance.now() - 1000;
  p.update({}, 2);
  expect(sheet.want.level).toBe(512);
  expect(sheet.want.key).not.toBe(first);
});

test("the initial ink raster matches display detail and keeps its supersampled upgrade and cap", () => {
  const p = Object.create(Pictures.prototype);
  Object.assign(p, { solid: true, budget: { width: 1100 } });
  const sheet = { shown: null };
  const first = p.levelFor(sheet, 0.75, 400, 0, 1, "ink");
  expect(first).toBe(512);
  sheet.shown = { level: first };
  expect(p.levelFor(sheet, 0.75, 400, 0, 1, "ink")).toBe(724);
  expect(p.levelFor(sheet, 0.75, Infinity, 0, 1, "ink")).toBe(1100);
});

test("native images install within the old raster allowance before upgrading", () => {
  const p = Object.create(Pictures.prototype);
  Object.assign(p, { solid: true, budget: { width: 1100, pixels: 90000 } });
  const sheet = { shown: null };
  expect(p.levelFor(sheet, 1, Infinity, 0, 1, "pixels")).toBe(300);
  sheet.shown = { level: 300 };
  expect(p.levelFor(sheet, 1, Infinity, 0, 1, "pixels")).toBe(600);
});

test("cached source canvases and relief maps share the original memory allowance", () => {
  const p = Object.create(Pictures.prototype);
  Object.assign(p, { budget: { ink: 220000 }, cache: new Map(), sheets: [] });
  for (let i = 0; i < 3; i++)
    p.remember(String(i), {
      count: 1,
      center: new Float32Array(1),
      w: 1000,
      h: 1000,
      surface: { relief: { d: new Float32Array(3000000) } },
    });
  expect(p.cache.size).toBe(2);
  expect([...p.cache.keys()]).toEqual(["1", "2"]);
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

test("a continuous page keeps its soft paper inside the sharp face's perimeter", () => {
  const input = { ...job(), method: "ink", backingOnly: true };
  const data = buildSheet(input);
  expect(data.count).toBeGreaterThan(0);
  // Three standard deviations of the coarse paper stay inside the face,
  // including its corners. The face supplies the exact rectangular edge.
  const sx = (3 * 3.6 * 2) / input.w;
  const sy = (3 * 3.6 * 2) / input.h;
  for (let i = 0; i < data.count; i++) {
    expect(data.centers[i * 3] - sx).toBeGreaterThanOrEqual(-1);
    expect(data.centers[i * 3] + sx).toBeLessThanOrEqual(1);
    expect(data.centers[i * 3 + 1] - sy).toBeGreaterThanOrEqual(-1);
    expect(data.centers[i * 3 + 1] + sy).toBeLessThanOrEqual(1);
  }
  expect(data.center.length).toBeLessThan(
    buildSheet({ ...input, backingOnly: false }).center.length,
  );
});
