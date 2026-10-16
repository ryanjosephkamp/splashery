// MIT. Made by Ryan with Codex (GPT-6). CPU-only opt-in seed-bound checks.
import { createHash } from "node:crypto";
import { test, expect } from "@playwright/test";
import { initGaussians } from "../vendor/splatjs/src/gs/init.js";
import { Session } from "../vendor/splatjs/src/session.js";

const fixture = () => [
  ...Array.from({ length: 24 }, (_, i) => ({
    X: [
      (i % 4) * 0.04 - 0.06,
      (Math.floor(i / 4) % 3) * 0.05 - 0.05,
      2 + Math.floor(i / 12) * 0.06,
    ],
    rgb: [0.1 + (i % 7) * 0.1, 0.2 + (i % 5) * 0.1, 0.3 + (i % 3) * 0.1],
  })),
  { X: [80000, -60000, 160000], rgb: [0.2, 0.4, 0.6] },
];
const digest = (data) =>
  createHash("sha256")
    .update(Buffer.from(data.buffer, data.byteOffset, data.byteLength))
    .digest("hex");

test("legacy initializer bytes remain unchanged unless robust bounds are explicitly enabled", () => {
  // Captured with unchanged init.js SHA b8adfdcf4505e5785689427ed01ae07136858cabc57902c45ad7b8f7f5ba6251
  // before adding the option. These constants cover jitter, scales, colors, rotations, and opacity.
  for (const [conv, expected] of [
    [{}, "18e98b546375feb1524be3cefda0b1ae7155b42b9a72316994691efae97251d0"],
    [
      { dc: "sh", randRot: true },
      "e513a58f4c5719b3061f9b6f2152b7f408c3eac4458908d725860201416eafb0",
    ],
  ]) {
    expect(digest(initGaussians(fixture(), 2, undefined, conv).data)).toBe(expected);
    expect(
      digest(initGaussians(fixture(), 2, undefined, { ...conv, robustBounds: false }).data),
    ).toBe(expected);
    expect(digest(initGaussians(fixture(), 2, undefined, { ...conv, robustBounds: 1 }).data)).toBe(
      expected,
    );
  }
});

test("one distant point cannot inflate robust bounds or normal-point scales, and remains in the seed", () => {
  const points = fixture(),
    legacy = initGaussians(points, 0),
    robust = initGaussians(points, 0, undefined, { robustBounds: true }),
    ordinary = initGaussians(points.slice(0, -1), 0, undefined, { robustBounds: true });
  expect(legacy.radius).toBeGreaterThan(7000);
  expect(robust.radius).toBeLessThan(0.2);
  expect(robust.radius).toBeLessThan(ordinary.radius * 1.5);
  expect(robust.n).toBe(points.length);
  expect(robust.data.every(Number.isFinite)).toBe(true);
  for (let i = 0; i < points.length; i++) {
    expect(Array.from(robust.data.subarray(i * 16, i * 16 + 3))).toEqual(
      Array.from(Float32Array.from(points[i].X)),
    );
    if (i < points.length - 1) {
      expect(Math.exp(robust.data[i * 16 + 3])).toBeLessThan(
        Math.exp(legacy.data[i * 16 + 3]) * 0.01,
      );
      expect(Math.exp(robust.data[i * 16 + 3])).toBeLessThan(
        Math.exp(ordinary.data[i * 16 + 3]) * 1.5,
      );
    }
  }
});

test("robust center and radius are invariant to point order, including even-sized clouds", () => {
  for (const points of [fixture(), fixture().slice(0, -1)]) {
    const expected = initGaussians(points, 0, undefined, { robustBounds: true });
    for (const ordered of [
      points.toReversed(),
      points.filter((_, i) => i % 2).concat(points.filter((_, i) => !(i % 2))),
    ]) {
      const actual = initGaussians(ordered, 0, undefined, { robustBounds: true });
      expect(actual.center).toEqual(expected.center);
      expect(actual.radius).toBe(expected.radius);
    }
    for (let axis = 0; axis < 3; axis++) {
      const sorted = points.map((p) => p.X[axis]).sort((a, b) => a - b),
        middle = Math.floor(sorted.length / 2);
      expect(expected.center[axis]).toBe(
        sorted.length % 2 ? sorted[middle] : (sorted[middle - 1] + sorted[middle]) / 2,
      );
    }
  }
});

for (const limited of [false, true]) {
  for (const v2 of [false, true]) {
    test(`Session passes robust bounds through ${limited ? "bounded" : "legacy-capacity"} seeding with ${v2 ? "v2" : "sigmoid"} conventions`, async () => {
      const points = fixture(),
        session = new Session({
          maskTraining: false,
          initTarget: points.length * 3,
          robustSeedBounds: true,
          trainer: v2 ? { engine: "v2" } : {},
        }),
        stop = new Error("CPU test stops at the GPU boundary"),
        expected = initGaussians(points, 2, undefined, {
          robustBounds: true,
          ...(v2 ? { dc: "sh", randRot: true } : {}),
        });
      let gpuBoundaryCalls = 0;
      session.recon = { points };
      session._getGpu = async () => {
        gpuBoundaryCalls++;
        throw stop;
      };
      try {
        await expect(session.seed(limited ? { seedLimit: points.length * 3 } : {})).rejects.toBe(
          stop,
        );
        expect(gpuBoundaryCalls).toBe(1);
        expect(session.model.center).toEqual(expected.center);
        expect(session.model.radius).toBe(expected.radius);
        expect(session.model.radius).toBeLessThan(0.2);
        expect(session.model.n).toBe(points.length * 3);
        expect(session.model.dc).toBe(v2 ? "sh" : "sigmoid");
        expect(Array.from(session.model.data.subarray(0, 16))).toEqual(
          Array.from(expected.data.subarray(0, 16)),
        );
        if (!limited) expect(digest(session.model.data)).toBe(digest(expected.data));
      } finally {
        session.dispose();
      }
    });
  }
}
