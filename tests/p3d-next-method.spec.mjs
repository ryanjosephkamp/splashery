import { test, expect } from "@playwright/test";
import { patchMatchBackground, showFilledAreas } from "../src/photo3d/next/patchmatch.js";
import {
  trueBoundaries,
  median,
  maskedMetrics,
  boundaryAccuracy,
} from "../tools/p3d-next-score.mjs";
import { imageMetrics } from "../tools/studio-truth/metrics.mjs";
import { softBoundaryShader } from "../tools/p3d-next-shader.mjs";
import { cleanForeground } from "../src/photo3d/next/clean-color.js";
import { compareTruth, compareAtlas } from "../tools/p3d-next-compare.mjs";
import {
  depthBoundaryAccuracy,
  labExpectation,
  planeResidual,
} from "../tools/p3d-next-depth-score.mjs";

test("masked PatchMatch never copies the occluder into a supported hole", () => {
  const w = 20,
    h = 16,
    n = w * h,
    rgba = new Uint8Array(n * 4),
    depth = new Float32Array(n),
    donor = Int32Array.from({ length: n }, (_, i) => i);
  for (let y = 0; y < h; y++)
    for (let x = 0; x < w; x++) {
      const i = y * w + x,
        front = x >= 7 && x <= 12;
      depth[i] = front ? 0.9 : 0.1;
      rgba.set(front ? [255, 0, 0, 255] : [0, (x * 17 + y * 11) % 256, 90, 255], i * 4);
      if (front) donor[i] = y * w + 4;
    }
  const photo = { w, h, data: rgba },
    build = {
      depth,
      gx: w,
      gy: h,
      background: {
        w,
        h,
        depth: new Float32Array(n).fill(0.1),
        rgba: Uint8Array.from(rgba),
        donor,
        reach: 0.3,
      },
    };
  const before = Uint8Array.from(rgba),
    b = patchMatchBackground(photo, build),
    repeat = patchMatchBackground(photo, build);
  expect([...b.rgba]).toEqual([...repeat.rgba]);
  expect([...rgba]).toEqual([...before]);
  expect(b.patchmatch.supported).toBeGreaterThan(0);
  for (let i = 0; i < n; i++)
    if (b.filled[i] && b.donor[i] !== donor[i]) expect(b.rgba[i * 4]).toBe(0);
  const tint = showFilledAreas(b);
  for (let i = 0; i < n; i++) {
    if (b.filled[i]) expect([tint.rgba[i * 4], tint.rgba[i * 4 + 2]]).toEqual([255, 255]);
    else
      expect([...tint.rgba.subarray(i * 4, i * 4 + 4)]).toEqual([
        ...rgba.subarray(i * 4, i * 4 + 4),
      ]);
  }
});

test("true boundaries exclude texture and flag a geometric step", () => {
  const z = new Float32Array(81).fill(2),
    mask = new Uint8Array(81).fill(1);
  expect(trueBoundaries(z, mask, 9, 9).some(Boolean)).toBe(false);
  for (let y = 0; y < 9; y++) for (let x = 5; x < 9; x++) z[y * 9 + x] = 4;
  expect(trueBoundaries(z, mask, 9, 9)[4 * 9 + 4]).toBe(1);
  mask.fill(3);
  expect(trueBoundaries(z, mask, 9, 9).some(Boolean)).toBe(false);
});

test("unknown metrics never become a passing zero", () => {
  expect(median([])).toBeNull();
  expect(median([0.2, null])).toBeNull();
  expect(median([2, 1, 4, 3])).toBe(2.5);
});

test("soft band has an explicit source-pixel width and fails on shader drift", () => {
  expect(softBoundaryShader("smoothstep(-0.5 * aa[axis], 0.5 * aa[axis], distance)", 3)).toContain(
    "1.5 / float(textureSize",
  );
  expect(() => softBoundaryShader("changed", 3)).toThrow();
  expect(() => softBoundaryShader("", 8)).toThrow();
});

test("foreground cleanup uses an interior color and preserves unsupported thin parts", () => {
  const w = 32,
    h = 24,
    n = w * h,
    data = new Uint8Array(n * 4),
    depth = new Float32Array(n);
  for (let y = 0; y < h; y++)
    for (let x = 0; x < w; x++) {
      const i = y * w + x,
        front = x >= 12 && x <= 22;
      depth[i] = front ? 0.9 : 0.1;
      data.set(front ? [240, 20, 10, 255] : [10, 20, 240, 255], i * 4);
      if (x === 12) data.set([120, 20, 120, 255], i * 4);
    }
  const result = cleanForeground({ w, h, data }, { gx: w, gy: h, depth }, 3);
  expect([...result.data.subarray((12 * w + 12) * 4, (12 * w + 12) * 4 + 3)]).toEqual([
    240, 20, 10,
  ]);
  expect([...data.subarray((12 * w + 12) * 4, (12 * w + 12) * 4 + 3)]).toEqual([120, 20, 120]);
  depth.fill(0.1);
  for (let y = 0; y < h; y++) depth[y * w + 12] = 0.9;
  expect([...cleanForeground({ w, h, data }, { gx: w, gy: h, depth }, 3).data]).toEqual([...data]);
});

test("native masked SSIM and boundary MAE reproduce the established metric", () => {
  const w = 63,
    h = 49,
    n = w * h,
    reference = new Uint8Array(n * 4),
    actual = new Uint8Array(n * 4),
    mask = new Uint8Array(n).fill(1),
    edges = new Uint8Array(n);
  for (let i = 0; i < n; i++) {
    reference.set([(i * 13) % 256, (i * 31) % 256, (i * 17) % 256, 255], i * 4);
    actual.set([(i * 13 + 7) % 256, (i * 31) % 256, (i * 17 + 11) % 256, 255], i * 4);
    if (i % 997 === 0) mask[i] = 3;
    if (i % 11 === 0) edges[i] = 1;
  }
  for (const rendered of [actual, reference]) {
    const a = maskedMetrics(reference, rendered, w, h, mask, edges),
      b = imageMetrics(reference, rendered, w, h, mask, edges);
    expect(a.ssimWindows).toBe(b.ssimWindows);
    expect(a.pixels).toBe(b.pixels);
    expect(a.edgePixels).toBe(b.edgePixels);
    expect(a.ssim).toBeCloseTo(b.ssim, 11);
    expect(a.edgeHaloMae).toBeCloseTo(b.edgeHaloMae, 11);
  }
  mask.fill(3);
  expect(maskedMetrics(reference, actual, w, h, mask, edges).ssim).toBeNull();
});

test("boundary accuracy detects a lost edge and distinguishes absent support", () => {
  const w = 32,
    h = 16,
    n = w * h,
    mask = new Uint8Array(n).fill(1),
    z = Float32Array.from({ length: n }, (_, i) => (i % w < 16 ? 2 : 4)),
    rgba = new Uint8Array(n * 4),
    shifted = new Uint8Array(n * 4);
  for (let i = 0; i < n; i++) {
    const a = i % w < 16 ? 0 : 255,
      b = i % w < 21 ? 0 : 255;
    rgba.set([a, a, a, 255], i * 4);
    shifted.set([b, b, b, 255], i * 4);
  }
  const band = trueBoundaries(z, mask, w, h);
  expect(boundaryAccuracy(rgba, rgba, w, h, mask, band).f1).toBe(1);
  expect(boundaryAccuracy(rgba, shifted, w, h, mask, band).f1).toBe(0);
  expect(boundaryAccuracy(rgba, rgba, w, h, mask, new Uint8Array(n)).f1).toBeNull();
});

test("truth gates require all views and reject a scene that is over 5% worse", () => {
  const base = {
    complete: true,
    views: 216,
    medianError: 1,
    medianBoundaryError: 10,
    boundaryViews: 190,
    boundaryPixels: 1000,
    scenes: Array.from({ length: 12 }, (_, i) => ({ scene: String(i), error: 1 })),
  };
  const candidate = {
    ...base,
    candidate: "fixture",
    medianError: 0.89,
    medianBoundaryError: 8.4,
    scenes: base.scenes.map((x) => ({ ...x, error: 0.89 })),
  };
  expect(compareTruth(base, candidate).truthPass).toBe(true);
  expect(compareTruth(base, candidate).boundaryPass).toBe(true);
  expect(compareTruth(base, { ...candidate, views: 9 }).truthPass).toBe(false);
  expect(compareTruth(base, { ...candidate, medianError: null }).truthPass).toBe(false);
  expect(compareTruth(base, { ...candidate, boundaryPixels: 999 }).boundaryPass).toBe(false);
  candidate.scenes[0].error = 1.051;
  expect(compareTruth(base, candidate).truthPass).toBe(false);
});

test("a flat prediction loses supported depth edges rather than making them unknown", () => {
  const w = 16,
    h = 12,
    n = w * h,
    mask = new Uint8Array(n).fill(1),
    truth = Float32Array.from({ length: n }, (_, i) => (i % w < 8 ? 2 : 4));
  expect(depthBoundaryAccuracy(truth, truth, mask, w, h).f1).toBe(1);
  expect(depthBoundaryAccuracy(new Float32Array(n).fill(3), truth, mask, w, h).f1).toBe(0);
  expect(depthBoundaryAccuracy(truth, new Float32Array(n).fill(3), mask, w, h).f1).toBeNull();
});

test("lab order checks distinguish a supported reversal from an absent cue", () => {
  const row = {
    category: "e",
    expect: "Front before back",
    variables: { mode: "pair", overlap: 0.5, backGray: 100, frontGray: 170 },
  };
  const rgb = Float32Array.of(100 / 255, 100 / 255, 100 / 255, 170 / 255, 170 / 255, 170 / 255);
  expect(labExpectation(row, Float32Array.of(1, 2), rgb).verdict).toBe(true);
  expect(labExpectation(row, Float32Array.of(2, 1), rgb).verdict).toBe(false);
  row.variables.overlap = 0;
  expect(labExpectation(row, Float32Array.of(1, 2), rgb).verdict).toBeNull();
  expect(labExpectation({ ...row, category: "j" }, Float32Array.of(1, 2), rgb).verdict).toBeNull();
});

test("an atlas scout cannot pass the corpus gate, and zero baselines still detect regressions", () => {
  const row = (id, candidate, streaks) => ({
    id,
    candidate,
    photoHash: "same",
    targetCameras: [],
    values: { streaks, textureLoss: 0, missing: 0 },
  });
  const study = {
    complete: true,
    rows: [
      row("a", "classic", 1),
      row("a", "next", 0.5),
      row("b", "classic", 0),
      row("b", "next", 0.01),
    ],
  };
  const result = compareAtlas(study, "next");
  expect(result.streakGain).toBeGreaterThan(0.3);
  expect(result.worse).toEqual(["b"]);
  expect(result.complete).toBe(false);
  expect(result.ribbonPass).toBe(false);
});

test("complete atlas gates reject lost support, duplicates, and individual thin-part regressions", () => {
  const selection = Array.from({ length: 118 }, (_, i) => ({ id: String(i) }));
  const rows = selection.flatMap(({ id }) =>
    ["classic", "next"].map((candidate) => ({
      id,
      candidate,
      photoHash: id,
      targetCameras: [],
      rows: Array.from({ length: 9 }, (_, yaw) => ({
        yaw,
        pitch: 0,
        fringe: { evaluated: 1, missing: 0 },
      })),
      values: {
        streaks: candidate === "classic" ? 1 : 0.6,
        textureLoss: candidate === "classic" ? 0.5 : 0.4,
        missing: 0,
      },
    })),
  );
  const study = { complete: true, selection, rows };
  expect(compareAtlas(study, "next").ribbonPass).toBe(true);
  expect(compareAtlas(study, "next").thinPass).toBe(true);
  rows[1].rows[1].fringe.missing = 1;
  expect(compareAtlas(study, "next").thinPass).toBe(false);
  rows[1].rows[1].fringe.missing = 0;
  rows[1].values.missing = 0.1;
  expect(compareAtlas(study, "next").thinPass).toBe(false);
  rows[1].values.textureLoss = null;
  expect(compareAtlas(study, "next").ribbonPass).toBe(false);
  rows[1].id = "1";
  rows[1].photoHash = "1";
  expect(compareAtlas(study, "next").complete).toBe(false);
});

test("a receding plane stays planar, while raised painted lines fail the floor diagnostic", () => {
  const w = 24,
    h = 24,
    plane = Float32Array.from({ length: w * h }, (_, i) => 1 + (i % w) / w + Math.floor(i / w) / h);
  expect(planeResidual(plane, w, h)).toBeLessThan(1e-6);
  const ridges = Float32Array.from(plane, (z, i) => z + ((i % w) % 3 === 0 ? 0.4 : 0));
  expect(planeResidual(ridges, w, h)).toBeGreaterThan(0.05);
  expect(planeResidual(new Float32Array(w * h).fill(NaN), w, h)).toBeNull();
});
