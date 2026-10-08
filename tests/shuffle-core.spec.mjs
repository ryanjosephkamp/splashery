import { test, expect } from "@playwright/test";
import * as core from "../src/packs/incompressible-shuffle-core.js";
const close = (a, b) => a.forEach((v, i) => expect(v).toBeCloseTo(b[i], 12));
const fixtures = {
  ".5": [
    [0.25, -0.125],
    [0.25, -0.25],
    [0, -0.25],
    [0, -0.25],
    [0.125, -0.25],
  ],
  1: [
    [0.25, -0.125],
    [0.25, -0.375],
    [0.25, -0.375],
    [0.25, -0.125],
    [0.25, -0.125],
  ],
  2: [
    [0.25, -0.125],
    [0.25, -0.625],
    [0.5625, -0.625],
    [0.5625, -0.0625],
    [0.5, -0.0625],
  ],
};
test("analytic flat pulse has exact endpoints and rational interior values", () => {
  expect(core.pulse(0)).toBe(0);
  expect(core.pulse(1)).toBe(1);
  expect(core.pulse(0.5)).toBe(0.5);
  expect(core.pulse(0.25)).toBeCloseTo(1 / (1 + Math.exp(8 / 3)), 14);
  expect(core.pulse(1e-300)).toBe(0);
});
test("all independent shear endpoint and half-stage fixtures agree", () => {
  const halves = {
    ".5": [
      [0.25, -0.1875],
      [0.125, -0.25],
      [0, -0.25],
      [0.0625, -0.25],
    ],
    1: [
      [0.25, -0.25],
      [0.25, -0.375],
      [0.25, -0.25],
      [0.25, -0.125],
    ],
    2: [
      [0.25, -0.375],
      [0.40625, -0.625],
      [0.5625, -0.34375],
      [0.53125, -0.0625],
    ],
  };
  for (const [key, rows] of Object.entries(fixtures)) {
    const l = Number(key);
    for (let j = 0; j < 5; j++)
      close(core.path([0.25, -0.125], 0, l, (j + 1) / 8), [-1.25 + rows[j][0], rows[j][1], 1.25]);
    for (let j = 0; j < 4; j++)
      close(core.path([0.25, -0.125], 0, l, (2 * (j + 2) - 0.5) / 16), [
        -1.25 + halves[key][j][0],
        halves[key][j][1],
        1.25,
      ]);
  }
});
test("lift, translation, lower and both branches match independent fixtures", () => {
  for (const b of [0, 1]) {
    const p = b ? 1.25 : -1.25,
      h = b ? 2.5 : 1.25,
      q = -p;
    close(core.path([0.25, -0.125], b, 2, 0), [p + 0.25, -0.125, 0]);
    close(core.path([0.25, -0.125], b, 2, 1.5 / 16), [p + 0.25, -0.125, h / 2]);
    close(core.path([0.25, -0.125], b, 2, 11.5 / 16), [0.5, -0.0625, h]);
    close(core.path([0.25, -0.125], b, 2, 13.5 / 16), [q + 0.5, -0.0625, h / 2]);
    close(core.path([0.25, -0.125], b, 2, 1), [q + 0.5, -0.0625, 0]);
  }
});
test("each partial map preserves orientation, patch area, inverse and envelope", () => {
  for (const l of [0.5, 1, 2])
    for (let n = 0; n <= 512; n++) {
      const t = n / 512,
        o = core.path([0, 0], 0, l, t),
        a = core.path([0.1, 0], 0, l, t),
        b = core.path([0, 0.1], 0, l, t);
      expect((a[0] - o[0]) * (b[1] - o[1]) - (a[1] - o[1]) * (b[0] - o[0])).toBeCloseTo(0.01, 12);
      for (const r of [-0.4, 0.4])
        for (const s of [-0.4, 0.4]) {
          const p = core.path([r, s], 0, l, t);
          close(core.unmap(p, 0, l, t), [r, s]);
          expect(Math.max(Math.abs(p[0] - o[0]), Math.abs(p[1] - o[1]))).toBeLessThanOrEqual(
            1.200000000001,
          );
        }
    }
});
test("scrubbing is stateless, bounded, holds gaps and never wraps finished time", () => {
  const times = [0, 0.73, 0.18, 1];
  const baseline = new Map(times.map((t) => [t, core.path([0.25, -0.125], 0, 2, t).slice()]));
  for (const t of [0, 0.73, 0.18, 1, 0, 1, 0.18, 0.73]) {
    core.path([-0.4, 0.4], 1, 0.5, 1 - t);
    close(core.path([0.25, -0.125], 0, 2, t), baseline.get(t));
  }
  for (let j = 1; j <= 7; j++)
    close(
      core.path([0.25, -0.125], 0, 2, (2 * j) / 16),
      core.path([0.25, -0.125], 0, 2, (2 * j + 0.8) / 16),
    );
  close(core.path([0.25, -0.125], 0, 2, 9), [1.75, -0.0625, 0]);
  close(core.path([0.25, -0.125], 0, 2, -9), [-1, -0.125, 0]);
  expect(core.path([0.25, -0.125], 0, 1, 2 / 8)[1]).not.toBe(-0.125);
  for (const l of [0, -1, 4, NaN, Infinity]) expect(() => core.path([0, 0], 0, l, 0)).toThrow();
  expect(() => core.path([0, 0], 0, 1, NaN)).toThrow();
});
