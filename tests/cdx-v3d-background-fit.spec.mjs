// MIT. Made by Ryan with Codex (GPT-6). Pure CPU analytic controls, no browser/GPU/photographs.
import { test, expect } from "@playwright/test";
import {
  backgroundFitMoments,
  accumulateBackgroundFit,
  solveBackgroundFit,
  backgroundFitSse,
} from "../vendor/splatjs/src/gs/background-fit.js";

const pack = (r, g, b, alpha = 255) => ((alpha << 24) | (b << 16) | (g << 8) | r) >>> 0;
const directSse = (rgba, targets, bg, gain = 1, bias = 0) => {
  let sse = 0;
  for (let p = 0; p < targets.length; p++) {
    if (targets[p] >>> 24 === 0) continue;
    for (let c = 0; c < 3; c++) {
      const expected = ((targets[p] >>> (c * 8)) & 255) / 255,
        actual = gain * (rgba[p * 4 + c] + (1 - rgba[p * 4 + 3]) * bg[c]) + bias;
      sse += (actual - expected) ** 2;
    }
  }
  return sse;
};

test("a transparent black renderer recovers exact packed target color in RGB byte order", () => {
  const moments = backgroundFitMoments();
  expect(moments).toEqual({
    denominator: 0,
    numerator: [0, 0, 0],
    baseSse: 0,
    pixels: 0,
    invalidPixels: 0,
  });
  const rgba = Float32Array.of(0, 0, 0, 0),
    targets = Uint32Array.of(pack(31, 127, 233));
  accumulateBackgroundFit(moments, rgba, targets);
  expect(solveBackgroundFit(moments)).toEqual([31 / 255, 127 / 255, 233 / 255]);
  expect(moments.denominator).toBe(1);
  expect(moments.pixels).toBe(1);
  expect(backgroundFitSse(moments, solveBackgroundFit(moments))).toBeLessThan(1e-15);
});

test("pooled varying-transmittance cameras recover one shared color, including exposure", () => {
  const expected = [0.25, 0.5, 0.75];
  for (const [gain, bias] of [
    [1, 0],
    [1.25, -0.0625],
  ]) {
    const moments = backgroundFitMoments();
    for (const transmittance of [0.125, 0.25, 0.5, 0.75]) {
      const target = [160, 180, 220],
        rgba = Float32Array.from([
          ...target.map((byte, c) => (byte / 255 - bias) / gain - transmittance * expected[c]),
          1 - transmittance,
        ]),
        targets = Uint32Array.of(pack(...target));
      accumulateBackgroundFit(moments, rgba, targets, { gain, bias });
    }
    expect(moments.pixels).toBe(4);
    solveBackgroundFit(moments).forEach((value, c) => expect(value).toBeCloseTo(expected[c], 6));
    expect(backgroundFitSse(moments, solveBackgroundFit(moments))).toBeLessThan(1e-12);
  }
});

test("the constrained optimum clips independent channels and beats a direct color grid", () => {
  const rgba = Float32Array.of(0.5, 0, 0, 0.75),
    targets = Uint32Array.of(pack(10, 250, 32)),
    moments = backgroundFitMoments();
  accumulateBackgroundFit(moments, rgba, targets);
  const bg = solveBackgroundFit(moments);
  expect(bg[0]).toBe(0);
  expect(bg[1]).toBe(1);
  expect(bg[2]).toBeCloseTo(32 / 255 / 0.25, 12);
  const best = directSse(rgba, targets, bg);
  expect(backgroundFitSse(moments, bg)).toBeCloseTo(best, 12);
  for (let channel = 0; channel < 3; channel++)
    for (let i = 0; i <= 100; i++) {
      const other = [...bg];
      other[channel] = i / 100;
      expect(directSse(rgba, targets, other)).toBeGreaterThanOrEqual(best - 1e-14);
    }
});

test("a hardcoded exposure example fits the raw renderer rather than an exposed screenshot", () => {
  const moments = backgroundFitMoments(),
    rgba = Float32Array.of(0.125, 0.25, 0.375, 0.5),
    targets = Uint32Array.of(pack(153, 204, 255));
  accumulateBackgroundFit(moments, rgba, targets, { gain: 2, bias: 0.1 });
  const bg = solveBackgroundFit(moments);
  for (const [channel, value] of [0.25, 0.2, 0.15].entries())
    expect(bg[channel]).toBeCloseTo(value, 12);
  expect(directSse(rgba, targets, bg, 2, 0.1)).toBeLessThan(1e-28);
  expect(backgroundFitSse(moments, bg)).toBeLessThan(1e-14);
});

test("empty or fully opaque input has no identifiable background energy", () => {
  const moments = backgroundFitMoments();
  expect(solveBackgroundFit(moments)).toBeNull();
  accumulateBackgroundFit(
    moments,
    Float32Array.of(0.2, 0.3, 0.4, 1),
    Uint32Array.of(pack(100, 120, 140)),
  );
  expect(solveBackgroundFit(moments)).toBeNull();
  expect(moments.denominator).toBe(0);
  expect(backgroundFitSse(moments, [0, 0, 0])).toBe(backgroundFitSse(moments, [1, 1, 1]));
});

test("invalid target pixels skip arbitrary raw storage and are counted separately", () => {
  const moments = backgroundFitMoments();
  accumulateBackgroundFit(
    moments,
    Float32Array.of(NaN, Infinity, -Infinity, NaN, 0, 0, 0, 0),
    Uint32Array.of(pack(10, 20, 30, 0), pack(64, 128, 192)),
  );
  expect(moments.invalidPixels).toBe(1);
  expect(moments.pixels).toBe(1);
  expect(solveBackgroundFit(moments)).toEqual([64 / 255, 128 / 255, 192 / 255]);
});

test("soft-alpha and bad raw packets reject atomically without keeping a partial chunk", () => {
  for (const mutate of [
    (_rgba, targets) => (targets[1] = pack(1, 2, 3, 1)),
    (_rgba, targets) => (targets[1] = pack(1, 2, 3, 128)),
    (_rgba, targets) => (targets[1] = pack(1, 2, 3, 254)),
    (rgba) => (rgba[4] = NaN),
    (rgba) => (rgba[7] = Infinity),
    (rgba) => (rgba[7] = -0.00001),
    (rgba) => (rgba[7] = 1.00001),
  ]) {
    const moments = backgroundFitMoments(),
      before = structuredClone(moments),
      rgba = Float32Array.of(0, 0, 0, 0, 0, 0, 0, 0),
      targets = Uint32Array.of(pack(1, 2, 3), pack(4, 5, 6));
    mutate(rgba, targets);
    expect(() => accumulateBackgroundFit(moments, rgba, targets)).toThrow();
    expect(moments).toEqual(before);
  }
});

test("dimensions, moment state, color, and exposure conventions fail closed", () => {
  const rgba = Float32Array.of(0, 0, 0, 0),
    targets = Uint32Array.of(pack(1, 2, 3));
  for (const bad of [0, -1, Infinity, NaN])
    expect(() =>
      accumulateBackgroundFit(backgroundFitMoments(), rgba, targets, { gain: bad }),
    ).toThrow(/gain/);
  expect(() =>
    accumulateBackgroundFit(backgroundFitMoments(), rgba, targets, { bias: NaN }),
  ).toThrow(/bias/);
  expect(() =>
    accumulateBackgroundFit(backgroundFitMoments(), new Float64Array(4), targets),
  ).toThrow(/Float32/);
  expect(() =>
    accumulateBackgroundFit(backgroundFitMoments(), new Float32Array(3), targets),
  ).toThrow(/matching/);
  expect(() => solveBackgroundFit({ ...backgroundFitMoments(), denominator: Infinity })).toThrow(
    /moments/,
  );
  expect(() => solveBackgroundFit({ ...backgroundFitMoments(), pixels: -1 })).toThrow(/moments/);
  expect(() => solveBackgroundFit({ ...backgroundFitMoments(), numerator: new Array(3) })).toThrow(
    /moments/,
  );
  for (const rgb of [
    [0, 0],
    [0, NaN, 0],
    [0, 0, 1.01],
  ])
    expect(() => backgroundFitSse(backgroundFitMoments(), rgb)).toThrow(/RGB/);
});

test("streamed moments match direct fixed-model SSE and cannot increase pooled training MSE", () => {
  let state = 0xa588;
  const random = () => (state = (1664525 * state + 1013904223) >>> 0) / 4294967296;
  for (let trial = 0; trial < 80; trial++) {
    const rgba = Float32Array.from({ length: 17 * 4 }, random),
      targets = Uint32Array.from({ length: 17 }, () =>
        pack(Math.floor(random() * 256), Math.floor(random() * 256), Math.floor(random() * 256)),
      ),
      whole = backgroundFitMoments(),
      streamed = backgroundFitMoments(),
      oldBg = [random(), random(), random()];
    accumulateBackgroundFit(whole, rgba, targets);
    for (let p = 0; p < 17; p++)
      accumulateBackgroundFit(
        streamed,
        rgba.subarray(p * 4, p * 4 + 4),
        targets.subarray(p, p + 1),
      );
    const bg = solveBackgroundFit(whole);
    expect(backgroundFitSse(whole, bg)).toBeCloseTo(directSse(rgba, targets, bg), 11);
    expect(backgroundFitSse(whole, bg)).toBeLessThanOrEqual(
      directSse(rgba, targets, oldBg) + 1e-12,
    );
    solveBackgroundFit(streamed).forEach((value, c) => expect(value).toBeCloseTo(bg[c], 12));
    expect(backgroundFitSse(streamed, bg)).toBeCloseTo(backgroundFitSse(whole, bg), 11);
  }
});
