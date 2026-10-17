import { test, expect } from "@playwright/test";

const core = () => import("../src/pano3d/core.js");

test("local calibration confidence distinguishes flat pixels from color texture", async () => {
  const { tileConfidence } = await core();
  const w = 16,
    h = 8,
    data = new Uint8ClampedArray(w * h * 4);
  for (let y = 0; y < h; y++)
    for (let x = 0; x < w; x++) {
      const rgb = x < 8 ? [90, 90, 90] : Math.floor(x / 2) % 2 ? [180, 20, 20] : [20, 20, 180];
      data.set([...rgb, 255], (y * w + x) * 4);
    }
  const confidence = tileConfidence({ w, h, data });
  expect(confidence.length).toBe(w * h);
  expect(confidence[3 * w + 1]).toBe(0);
  // These colors have equal channel sums; averaging RGB before variance loses the texture.
  expect(confidence[3 * w + 11]).toBe(1);
  expect(
    tileConfidence({ w, h, data: new Uint8ClampedArray(w * h * 4).fill(90) }).some(Boolean),
  ).toBe(false);
});

test("unsupported flat predictions cannot change overlap calibration or remove output pixels", async () => {
  const { TILES, tileRay, alignTiles, fuseDepth } = await core();
  const tiles = TILES.map((tile, face) => {
    const w = 48,
      h = 48,
      d = new Float32Array(w * h),
      confidence = new Uint8Array(w * h);
    for (let y = 0; y < h; y++)
      for (let x = 0; x < w; x++) {
        const { ray, cosine } = tileRay((x + 0.5) / w, (y + 0.5) / h, tile);
        d[y * w + x] = 1 / ((3 + 0.4 * ray[0] + 0.3 * ray[2]) * cosine) + face * 0.04;
        confidence[y * w + x] = x < 15 ? 0 : 1;
      }
    return { ...tile, w, h, d, confidence };
  });
  const corrupted = tiles.map((tile, face) => ({
    ...tile,
    d: tile.d.map((value, i) => (tile.confidence[i] ? value : 100 + face * 3)),
  }));
  const clean = alignTiles(tiles),
    changed = alignTiles(corrupted);
  expect(changed.transforms).toEqual(clean.transforms);
  expect(changed.residual).toBe(clean.residual);
  const field = fuseDepth(corrupted, changed, 80, 40);
  expect(field.d.length).toBe(80 * 40);
  expect(field.d.every((value) => Number.isFinite(value) && value > 0)).toBe(true);
});

test("an unsupported front tile cannot collapse the five supported views", async () => {
  const { TILES, tileRay, direction, project, median, alignTiles, fuseDepth } = await core();
  const smooth = (ray) => 3 + 0.8 * ray[0] + 0.5 * ray[2];
  const box = (ray) =>
    1 /
    Math.max(Math.abs(ray[0]) / 10, Math.abs(ray[1]) / 10, ray[2] >= 0 ? ray[2] / 3 : -ray[2] / 10);
  for (const [truth, front] of [
    [smooth, (value) => value],
    [smooth, (value) => value * 3 + 0.7],
    [box, () => 2],
  ])
    for (const frontReliability of [0, 1]) {
      const tiles = TILES.map((tile, face) => {
        const w = 48,
          h = 48;
        return {
          ...tile,
          w,
          h,
          reliability: face ? 1 : frontReliability,
          confidence: new Uint8Array(w * h).fill(face ? 1 : 0),
          d: Float32Array.from({ length: w * h }, (_, i) => {
            const { ray, cosine } = tileRay(
              ((i % w) + 0.5) / w,
              (Math.floor(i / w) + 0.5) / h,
              tile,
            );
            const inverse = 1 / (truth(ray) * cosine);
            return face ? inverse : front(inverse);
          }),
        };
      });
      const field = fuseDepth(tiles, alignTiles(tiles), 80, 40);
      const rays = Array.from(field.d, (_, i) =>
        direction(((i % 80) + 0.5) / 80, (Math.floor(i / 80) + 0.5) / 40),
      );
      const supported = rays.map((ray) => TILES.slice(1).some((tile) => project(ray, tile)));
      const scale = median(
        Array.from(field.d, (value, i) => (supported[i] ? truth(rays[i]) / value : NaN)),
      );
      const errors = Array.from(field.d, (value, i) =>
        supported[i] ? Math.abs(value * scale - truth(rays[i])) / truth(rays[i]) : NaN,
      ).filter(Number.isFinite);
      expect(errors.reduce((a, b) => a + b) / errors.length).toBeLessThan(0.003);
      expect(Array.from(field.d).filter((value) => value === 30).length).toBeLessThan(
        field.d.length * 0.3,
      );
    }
});

test("replacement terminates the old worker and rejects its pending request", async () => {
  const { createPanoramaClient } = await import("../src/pano3d/client.js");
  const workers = [];
  const client = createPanoramaClient(() => {
    const w = {
      postMessage() {},
      terminate() {
        this.dead = true;
      },
    };
    workers.push(w);
    return w;
  });
  const first = client.run({});
  const rejected = expect(first).rejects.toThrow(/canceled/);
  const second = client.run({});
  await rejected;
  expect(workers[0].dead).toBe(true);
  workers[0].onmessage({ data: { result: "obsolete" } });
  workers[1].onmessage({ data: { result: "current" } });
  expect(await second).toBe("current");
  expect(workers[1].dead).toBe(true);
});

test("sphere and perspective tiles cover both poles and wrap without holes", async () => {
  const { direction, coordinates, TILES, project } = await core();
  for (let y = 0; y <= 40; y++)
    for (let x = 0; x < 80; x++) {
      const ray = direction(x / 80, y / 40);
      expect(Math.hypot(...ray)).toBeCloseTo(1, 10);
      expect(TILES.some((tile) => project(ray, tile) !== null)).toBe(true);
      if (y > 0 && y < 40) expect(coordinates(ray)[1]).toBeCloseTo(y / 40, 8);
    }
  expect(direction(0, 0.5)).toEqual(direction(1, 0.5));
  // The player's inside camera looks along +Z with its right axis along -X.
  expect(direction(0.75, 0.5)[0]).toBeLessThan(-0.99);
});

test("GPano accepts complete spheres and rejects cropped, invalid, or non-2:1 images", async () => {
  const { readGPano, validatePanorama } = await import("../src/pano3d/input.js");
  const meta = readGPano(
    `<x GPano:FullPanoWidthPixels="4000" GPano:FullPanoHeightPixels="2000"><GPano:PoseHeadingDegrees>90</GPano:PoseHeadingDegrees></x>`,
  );
  expect(meta.poseHeading).toBe(90);
  expect(validatePanorama(4000, 2000, meta).heading).toBe(0);
  expect(validatePanorama(4000, 2000, { ...meta, initialHeading: 90 }).heading).toBe(0);
  expect(validatePanorama(4000, 2000, { ...meta, initialHeading: 120 }).heading).toBe(30);
  expect(() => validatePanorama(3000, 2000, {})).toThrow(/2:1/);
  expect(() =>
    validatePanorama(2000, 1000, { ...meta, cropWidth: 2000, cropHeight: 1000 }),
  ).toThrow(/complete/);
  expect(() => validatePanorama(0, 0, {})).toThrow();
  expect(() => readGPano('<x GPano:FullPanoWidthPixels="0"/>')).toThrow(/invalid/);
  expect(() => readGPano('<x GPano:ProjectionType="cylindrical"/>')).toThrow(/equirectangular/);
});

test("joint overlap alignment removes per-face inverse-depth scale and shift", async () => {
  const { TILES, tileRay, alignTiles, fuseDepth, direction } = await core();
  const truth = (r) => 3 + 0.7 * r[0] + 0.4 * r[1] + 0.3 * r[2];
  const tiles = TILES.map((tile, i) => {
    const w = 64,
      h = 64,
      d = new Float32Array(w * h);
    for (let y = 0; y < h; y++)
      for (let x = 0; x < w; x++) {
        const { ray, cosine } = tileRay((x + 0.5) / w, (y + 0.5) / h, tile);
        d[y * w + x] = (1 / (truth(ray) * cosine) - 0.08 - i * 0.007) / (1 + i * 0.13);
      }
    return { ...tile, w, h, d };
  });
  const aligned = alignTiles(tiles);
  const result = fuseDepth(tiles, aligned, 160, 80, { normalize: false });
  const errors = Array.from(
    result.d,
    (r, i) =>
      Math.abs(r - truth(direction(((i % 160) + 0.5) / 160, (Math.floor(i / 160) + 0.5) / 80))) /
      truth(direction(((i % 160) + 0.5) / 160, (Math.floor(i / 160) + 0.5) / 80)),
  );
  expect(errors.reduce((a, b) => a + b) / errors.length).toBeLessThan(0.015);
  expect(result.d.every((v) => Number.isFinite(v) && v > 0)).toBe(true);
  expect(aligned.seamMedian).toBeLessThan(0.02);
});

test("splat budgets preserve polar caps and movement is bounded with a stretch warning", async () => {
  const { buildShell, movement } = await core();
  const photo = { w: 4, h: 2, data: new Uint8ClampedArray(32).fill(170) };
  const depth = { w: 4, h: 2, d: new Float32Array(8).fill(3) };
  const shell = buildShell(photo, depth, 9000, 0);
  expect(shell.n).toBeLessThanOrEqual(9000);
  expect(shell.pos.every(Number.isFinite)).toBe(true);
  expect(Math.max(...shell.pos.filter((_, i) => i % 3 === 1))).toBeGreaterThan(2.99);
  expect(Math.min(...shell.pos.filter((_, i) => i % 3 === 1))).toBeLessThan(-2.99);
  expect(movement([5, 0, 5], 0.5).warning).toBe(true);
  expect(Math.hypot(...movement([5, 0, 5], 0.5).position)).toBeLessThanOrEqual(1.001);
  expect(() => buildShell(photo, depth, Infinity)).toThrow();
});

test("sky observations cannot prevent negative inverse-depth offsets for geometry", async () => {
  const { TILES, tileRay, alignTiles, fuseDepth, direction } = await core();
  const truth = (ray) => 3 + 0.5 * ray[0] + 0.4 * ray[2];
  const tiles = TILES.map((tile, i) => {
    const w = 48,
      h = 48,
      d = new Float32Array(w * h);
    for (let y = 0; y < h; y++)
      for (let x = 0; x < w; x++) {
        const { ray, cosine } = tileRay((x + 0.5) / w, (y + 0.5) / h, tile);
        d[y * w + x] =
          ray[1] > 0.72 ? 0 : (1 / (truth(ray) * cosine) + 0.45 + i * 0.03) / (1 + i * 0.1);
      }
    return { ...tile, w, h, d };
  });
  const alignment = alignTiles(tiles),
    result = fuseDepth(tiles, alignment, 80, 40, { normalize: false });
  const errors = [];
  for (let y = 10; y < 35; y++)
    for (let x = 0; x < 80; x++) {
      const ray = direction((x + 0.5) / 80, (y + 0.5) / 40);
      errors.push(Math.abs(result.d[y * 80 + x] - truth(ray)) / truth(ray));
    }
  expect(errors.reduce((s, v) => s + v, 0) / errors.length).toBeLessThan(0.04);
  expect(alignment.transforms.some((t) => t.b < -0.1)).toBe(true);
});

test("unsupported sky stays far without changing the scale of supported geometry", async () => {
  const { TILES, tileRay, fuseDepth, tileReliability } = await core();
  const tiles = TILES.map((tile, i) => {
    const w = 32,
      h = 32,
      d = new Float32Array(w * h);
    for (let y = 0; y < h; y++)
      for (let x = 0; x < w; x++)
        d[y * w + x] = 1 / (3 * tileRay((x + 0.5) / w, (y + 0.5) / h, tile).cosine);
    return { ...tile, w, h, d, reliability: i === 4 ? 0 : 1 };
  });
  const depth = fuseDepth(tiles, { transforms: tiles.map(() => ({ a: 1, b: 0 })) }, 80, 40);
  expect(depth.d[20 * 80 + 40]).toBeCloseTo(3, 1);
  expect(depth.d[40]).toBe(30);
  expect(depth.d.every((v) => Number.isFinite(v) && v > 0)).toBe(true);
  expect(tileReliability({ data: new Uint8Array(64 * 64 * 4).fill(100) })).toBe(0);
  expect(tileReliability({ data: Uint8Array.from([255, 0, 0, 255, 0, 255, 0, 255]) })).toBe(1);
});

test("canceling between perspective faces prevents further inference", async () => {
  const { reconstruct } = await import("../src/pano3d/pipeline.js");
  let calls = 0;
  const photo = { w: 4, h: 2, data: new Uint8Array(32) };
  await expect(
    reconstruct(
      photo,
      async () => {
        calls++;
        return { w: 1, h: 1, d: Float32Array.of(1) };
      },
      { side: 14, canceled: () => calls > 0 },
    ),
  ).rejects.toThrow(/canceled/);
  expect(calls).toBe(1);
});

test("the actual recipe orients side-wall and polar discs toward the camera", async () => {
  const { RECIPES } = await import("../src/pano3d/toy.js");
  const recipe = RECIPES["step-inside-360"];
  await recipe.prepare({ source: "room" });
  const clouds = [];
  recipe.build({
    count: 1000,
    reach() {},
    part: () => 0,
    cloud(o, fn) {
      clouds.push({ fn, n: Math.round(o.share * 1000) });
    },
  });
  let wrong = 0;
  for (let i = 0; i < clouds[0].n; i++) {
    const splat = clouds[0].fn(() => 0.5, i);
    if (!splat) break;
    const q = splat.quat || [0, 0, 0, 1];
    const axis = [
      2 * (q[0] * q[2] + q[3] * q[1]),
      2 * (q[1] * q[2] - q[3] * q[0]),
      1 - 2 * (q[0] ** 2 + q[1] ** 2),
    ];
    const p = splat.p,
      r = Math.hypot(...p);
    const alignment = Math.abs(axis.reduce((s, v, j) => s + (v * p[j]) / r, 0));
    if (alignment < 0.999) wrong++;
  }
  expect(wrong).toBe(0);
});
