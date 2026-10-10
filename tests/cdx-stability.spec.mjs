import { test, expect } from "@playwright/test";
import { normalizeDepths, makeClip, depthOf } from "../src/packs/moving-photo.js";
import {
  alignDepth,
  cubicDepth,
  filterDepths,
  stableEdges,
  streamDepth,
} from "../src/live/clip-stabilize.js";
import { reliefScale } from "../src/packs/photo-3d-core.js";
import { measureSample, stabilityMetrics } from "../tools/cdx-stability-measure.mjs";

function synthetic() {
  const w = 48,
    h = 24,
    raw = [],
    frames = [],
    truth = [];
  let seed = 32;
  const random = () => (seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0) / 2 ** 32;
  for (let f = 0; f < 21; f++) {
    const d = new Float32Array(w * h),
      data = new Uint8ClampedArray(w * h * 4),
      base = new Float32Array(w * h);
    const scale = 0.7 + random() * 0.8,
      shift = random() * 0.8;
    for (let y = 0; y < h; y++)
      for (let x = 0; x < w; x++) {
        const i = y * w + x;
        base[i] = x < 23 ? 0.2 + (y / h) * 0.04 : x === 23 ? 0.5 : 0.8 + (y / h) * 0.04;
        d[i] = base[i] * scale + shift + (random() - 0.5) * 0.025;
        data.set(x < 24 ? [30, 50, 80, 255] : [200, 150, 50, 255], i * 4);
      }
    raw.push({ d, w, h });
    frames.push({ data, delay: 100 });
    truth.push(base);
  }
  return { w, h, raw, frames, truth };
}

test("a still clip with random scale, shift, and noise keeps its relief and loses jitter and flips", () => {
  const { w, h, raw, frames } = synthetic();
  const before = stabilityMetrics(
    raw.map((r) => r.d),
    frames.map((f) => f.data),
    1,
  );
  const normalized = normalizeDepths(raw, w, h, false, frames);
  const clip = makeClip("synthetic", w, h, frames, normalized);
  const after = stabilityMetrics(clip.near, clip.colors);
  expect(after.heightJitter).toBeLessThan(before.heightJitter * 0.1);
  expect(after.edgeFlipsPer1000).toBeLessThan(before.edgeFlipsPer1000 * 0.1);
  expect(clip.near[10][12 * w + 35] - clip.near[10][12 * w + 12]).toBeGreaterThan(180);
  expect(clip.n).toBe(21);
  expect(clip.duration).toBeCloseTo(2.1);
});

test("alignment recovers affine noise and leaves scene cuts and uniform maps finite", () => {
  const { raw, frames } = synthetic();
  const reference = raw[0].d;
  const changed = Float32Array.from(reference, (v) => v * 1.5 + 0.3);
  const aligned = alignDepth(changed, reference, frames[0].data, frames[0].data);
  expect(Math.max(...aligned.map((v, i) => Math.abs(v - reference[i])))).toBeLessThan(1e-6);
  const cut = new Uint8ClampedArray(frames[0].data.length).fill(255);
  expect(Array.from(alignDepth(changed, reference, cut, frames[0].data))).toEqual(
    Array.from(changed),
  );
  const flat = new Float32Array(reference.length).fill(0.5);
  expect(Array.from(alignDepth(flat, flat, null, null)).every(Number.isFinite)).toBe(true);
  const shifted = alignDepth(new Float32Array(reference.length).fill(1.7), flat, null, null);
  expect(shifted.every((v) => Math.abs(v - 0.5) < 1e-6)).toBe(true);
});

test("the symmetric filter follows changing colors immediately and has no time bias", () => {
  const list = Array.from({ length: 9 }, (_, f) => new Float32Array(16).fill(f < 4 ? 0.2 : 0.8));
  const colors = list.map((_, f) => new Uint8ClampedArray(64).fill(f < 4 ? 20 : 220));
  const out = filterDepths(list, colors);
  expect(out[3][0]).toBeCloseTo(0.2);
  expect(out[4][0]).toBeCloseTo(0.8);
  const reversed = filterDepths([...list].reverse(), [...colors].reverse()).reverse();
  expect(out.map((d) => Array.from(d))).toEqual(reversed.map((d) => Array.from(d)));
});

test("edge flips require three consecutive still proposals; a moving edge follows its color", () => {
  const w = 9,
    h = 5,
    state = {};
  const frame = (middle) =>
    Float32Array.from({ length: w * h }, (_, i) => (i % w < 4 ? 0.1 : i % w === 4 ? middle : 0.9));
  const index = 2 * w + 4;
  expect(stableEdges(frame(0.4), w, h, null, state)[index]).toBeCloseTo(0.1);
  expect(stableEdges(frame(0.6), w, h, null, state)[index]).toBeCloseTo(0.1);
  expect(stableEdges(frame(0.4), w, h, null, state)[index]).toBeCloseTo(0.1);
  for (let i = 0; i < 2; i++)
    expect(stableEdges(frame(0.6), w, h, null, state)[index]).toBeCloseTo(0.1);
  expect(stableEdges(frame(0.6), w, h, null, state)[index]).toBeCloseTo(0.9);
  const colors = (near) =>
    Uint8ClampedArray.from({ length: w * h * 4 }, (_, i) =>
      Math.floor(i / 4) % w < (near ? 4 : 5) ? 20 : 230,
    );
  stableEdges(frame(0.4), w, h, colors(false), state);
  expect(stableEdges(frame(0.4), w, h, colors(true), state)[index]).toBeCloseTo(0.9);
});

test("four-frame cubic interpolation preserves endpoints, tangents, and bounds", () => {
  expect(cubicDepth(0.1, 0.3, 0.6, 0.8, 0)).toBe(0.3);
  expect(cubicDepth(0.1, 0.3, 0.6, 0.8, 1)).toBeCloseTo(0.6);
  const eps = 1e-4;
  const left = (cubicDepth(0.1, 0.3, 0.6, 0.8, 1) - cubicDepth(0.1, 0.3, 0.6, 0.8, 1 - eps)) / eps;
  const right = (cubicDepth(0.3, 0.6, 0.8, 0.9, eps) - 0.6) / eps;
  expect(Math.abs(left - right)).toBeLessThan(0.001);
  const irregularLeft = (0.6 - cubicDepth(0.1, 0.3, 0.6, 0.8, 1 - eps, 1, 2, 3)) / (eps * 2);
  const irregularRight = (cubicDepth(0.3, 0.6, 0.8, 0.9, eps, 2, 3, 4) - 0.6) / (eps * 3);
  expect(Math.abs(irregularLeft - irregularRight)).toBeLessThan(0.001);
  for (let i = 0; i <= 100; i++) {
    const v = cubicDepth(1, 0.3, 0.6, 0, i / 100);
    expect(v).toBeGreaterThanOrEqual(0.3);
    expect(v).toBeLessThanOrEqual(0.6);
  }
});

test("sparse model answers align before interpolation, retain the model budget, and guide every missing frame", async () => {
  const original = globalThis.Worker;
  let answers = 0,
    terminated = false;
  globalThis.Worker = class {
    postMessage({ id }) {
      answers++;
      const d = Float32Array.from(
        { length: 24 },
        (_, i) => (0.2 + i / 30) * (1 + id / 80) + id / 100,
      );
      queueMicrotask(() => this.onmessage({ data: { type: "depth", w: 6, h: 4, d } }));
    }
    terminate() {
      terminated = true;
    }
  };
  try {
    const frames = Array.from({ length: 49 }, () => ({
      data: new Uint8ClampedArray(12 * 8 * 4).fill(90),
      delay: 80,
    }));
    const raw = await depthOf(frames, 12, 8);
    expect(answers).toBe(32);
    expect(terminated).toBe(true);
    expect(raw.interpolated.filter(Boolean)).toHaveLength(17);
    expect(raw.aligned).toBe(true);
    const near = normalizeDepths(raw, 12, 8, true, frames);
    expect(near).toHaveLength(49);
    expect(near.every((d) => d.length === 96 && d.every(Number.isFinite))).toBe(true);
    const jitter = stabilityMetrics(
      near,
      frames.map((f) => f.data),
      1,
    ).heightJitter;
    expect(jitter).toBeLessThan(0.005);
  } finally {
    globalThis.Worker = original;
  }
});

test("opened clips use the same relief scale on every frame and leave raw answers unchanged", () => {
  const { raw, frames, w, h } = synthetic();
  const original = raw.map((r) => Array.from(r.d));
  const full = normalizeDepths(raw, w, h, false, frames);
  const flat = normalizeDepths(raw, w, h, true, frames);
  const ratio = (flat[0][0] - 0.5) / (full[0][0] - 0.5);
  for (let f = 0; f < full.length; f++)
    expect((flat[f][0] - 0.5) / (full[f][0] - 0.5)).toBeCloseTo(ratio, 5);
  expect(raw.map((r) => Array.from(r.d))).toEqual(original);
});

test("unequal GIF delays preserve a depth ramp moving at a constant speed in source time", async () => {
  const original = globalThis.Worker;
  const frames = Array.from({ length: 49 }, (_, i) => ({
    data: new Uint8ClampedArray(12 * 8 * 4).fill(255),
    delay: i % 7 === 0 ? 400 : 20,
  }));
  const times = [];
  let duration = 0;
  for (const f of frames) {
    times.push(duration);
    duration += f.delay;
  }
  globalThis.Worker = class {
    postMessage({ id }) {
      queueMicrotask(() =>
        this.onmessage({
          data: { type: "depth", w: 2, h: 2, d: new Float32Array(4).fill(times[id] / duration) },
        }),
      );
    }
    terminate() {}
  };
  try {
    const raw = await depthOf(frames, 12, 8);
    for (let i = 0; i < frames.length; i++) expect(raw[i].d[0]).toBeCloseTo(times[i] / duration, 6);
  } finally {
    globalThis.Worker = original;
  }
});

test("long-video state damps still noise, follows motion, and only widens after seeding", () => {
  const { raw, frames } = synthetic(),
    state = {};
  const result = raw.map((r, f) => streamDepth(state, r.d, frames[f].data, reliefScale));
  expect(
    stabilityMetrics(
      result,
      frames.map((f) => f.data),
      1,
    ).heightJitter,
  ).toBeLessThan(0.01);
  const lo = state.lo,
    hi = state.hi,
    scale = state.scale;
  streamDepth(state, raw[0].d, frames[0].data, reliefScale);
  expect(state.lo).toBeLessThanOrEqual(lo);
  expect(state.hi).toBeGreaterThanOrEqual(hi);
  expect(state.scale).toBe(scale);
  const moving = new Uint8ClampedArray(frames[0].data.length).fill(255);
  const next = streamDepth(state, new Float32Array(raw[0].d.length).fill(hi), moving, reliefScale);
  expect(next[0]).toBeGreaterThan(result.at(-1)[0] + 0.1);
});

test("the browser's bunny sample halves measured jitter and edge flips at its original size and speed", async ({
  page,
}) => {
  await page.goto("/LICENSES.md");
  const r = await measureSample(page, "sample");
  expect(r.heightJitter).toBeLessThan(0.010713168881253746 / 2);
  expect(r.edgeFlipsPer1000).toBeLessThan(13.69973209321225 / 2);
  expect([r.w, r.h, r.frames, r.fps]).toEqual([480, 270, 96, 16]);
});
