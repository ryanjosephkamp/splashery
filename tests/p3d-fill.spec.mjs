import { test, expect } from "@playwright/test";
import { fillSurface } from "../src/photo3d/next/fill.js";
import { patchMatchBackground } from "../src/photo3d/next/patchmatch.js";
import { buildPhotoSplats } from "../src/packs/photo-3d-core.js";
import { compareFillQuality, compareFillBoundaries } from "../tools/p3d-fill-score.mjs";
import { POSES } from "../tools/p3df/scoring.mjs";

test("Fill preserves Classic geometry and foreground while using Layered A background colors", () => {
  const w = 96,
    h = 64,
    data = new Uint8Array(w * h * 4),
    d = new Float32Array(w * h);
  for (let y = 0; y < h; y++)
    for (let x = 0; x < w; x++) {
      const i = y * w + x,
        front = x > 30 && x < 60 && y > 8 && y < 56;
      data.set(front ? [245, 10, 10, 255] : [10, (x * 17 + y * 23) % 256, 90, 255], i * 4);
      d[i] = front ? 1 : 0;
    }
  const photo = { w, h, data },
    classic = buildPhotoSplats(photo, { w, h, d }, { count: 2000, depth: 0.5 }),
    before = structuredClone(classic),
    result = fillSurface(photo, classic),
    layeredA = patchMatchBackground(photo, classic, {
      passes: 3,
      radius: 2,
      seed: 99,
      coherent: false,
    });
  expect(classic).toEqual(before);
  expect(result).not.toBe(classic);
  for (const key of Object.keys(classic))
    if (key !== "background") expect(result[key]).toBe(classic[key]);
  for (const key of Object.keys(classic.background))
    if (!["rgba", "donor"].includes(key))
      expect(result.background[key]).toBe(classic.background[key]);
  expect(result.background.rgba).toEqual(layeredA.rgba);
  expect(result.background.filled).toEqual(layeredA.filled);
  expect(result.background.patchmatch.supported).toBeGreaterThan(0);
  expect(result.background.rgba).not.toEqual(classic.background.rgba);
});

const qualityFixture = () => {
  const ids = Array.from({ length: 118 }, (_, i) => "input-" + i);
  const rows = ids.flatMap((id) =>
    ["phone", "desktop"].flatMap((profile) =>
      ["classic", "fill"].map((candidate) => ({
        id,
        profile,
        candidate,
        photoHash: id,
        probeSha256: id + profile,
        observation: {
          errors: [],
          externalRequests: [],
          overlayProof: {
            hits: candidate === "fill" ? ["worker"] : [],
            fillStats: candidate === "fill" ? { supported: 1 } : null,
          },
          native: profile === "phone" ? [585, 1266] : [1440, 900],
          browser: "same",
          renderer: "same",
          targetCameras: Array.from({ length: 9 }, (_, yaw) => ({ yaw })),
          values: { streaks: candidate === "fill" ? 0.2 : 1, textureLoss: 0 },
          rows: POSES.map(([yaw, pitch]) => ({ yaw, pitch, fringe: { evaluated: 1, missing: 0 } })),
        },
      })),
    ),
  );
  return { ids, rows };
};

test("Fill's full-corpus gate rejects an incomplete corpus and duplicate poses", () => {
  const { ids, rows } = qualityFixture();
  expect(compareFillQuality(rows, ids).ribbonPass).toBe(true);
  expect(compareFillQuality(rows.slice(1), ids).complete).toBe(false);
  rows[1].observation.rows[1].yaw = 0;
  expect(compareFillQuality(rows, ids).complete).toBe(false);
});

test("Fill cannot pass by dropping ribbon support, softening the shader, or losing a thin probe", () => {
  const { ids, rows } = qualityFixture();
  rows[1].observation.values.streaks = null;
  expect(compareFillQuality(rows, ids).ribbonPass).toBe(false);
  rows[0].observation.values.streaks = null;
  const absent = compareFillQuality(rows, ids);
  expect(absent.profiles[0].unsupported).toEqual(["input-0"]);
  expect(absent.profiles[0].ribbonSupport).toBe(117);
  expect(absent.ribbonPass).toBe(true);
  rows[1].observation.overlayProof.hits.push("shader");
  expect(compareFillQuality(rows, ids).complete).toBe(false);
  rows[1].observation.overlayProof.hits.pop();
  rows[1].observation.rows[1].fringe.missing = 1;
  expect(compareFillQuality(rows, ids).thinPass).toBe(false);
});

test("Fill reports each input below 60% even when the corpus median passes", () => {
  const { ids, rows } = qualityFixture();
  rows[1].observation.values.streaks = 0.5;
  const result = compareFillQuality(rows, ids);
  expect(result.ribbonPass).toBe(true);
  expect(result.everyInputRibbonPass).toBe(false);
  expect(result.profiles[0].below60Percent).toEqual(["input-0"]);
});

test("a good ribbon median cannot hide a single input more than 5% worse", () => {
  const { ids, rows } = qualityFixture();
  rows[1].observation.values.streaks = 1.051;
  expect(compareFillQuality(rows, ids).ribbonPass).toBe(false);
});

test("Fill boundary acceptance needs all truth views and identical boundary support", () => {
  const base = {
    complete: true,
    views: 216,
    boundaryViews: 184,
    boundaryPixels: 100,
    medianBoundaryError: 47,
    medianError: 0.5,
    scenes: Array.from({ length: 12 }, (_, i) => ({ scene: String(i), boundary: 47 })),
  };
  expect(compareFillBoundaries(base, base).pass).toBe(true);
  expect(compareFillBoundaries(base, { ...base, medianBoundaryError: 47.47 }).pass).toBe(true);
  expect(compareFillBoundaries(base, { ...base, medianBoundaryError: 47.48 }).pass).toBe(false);
  expect(compareFillBoundaries(base, { ...base, medianError: 0.50001 }).truthPass).toBe(false);
  expect(compareFillBoundaries(base, { ...base, views: 215 }).pass).toBe(false);
  expect(compareFillBoundaries(base, { ...base, boundaryPixels: 99 }).pass).toBe(false);
  expect(
    compareFillBoundaries(base, { ...base, scenes: base.scenes.map(() => base.scenes[0]) }).pass,
  ).toBe(false);
});
