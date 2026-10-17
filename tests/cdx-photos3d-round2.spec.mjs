import { test, expect } from "@playwright/test";
import { allPairs, verifyPair, summarizeGraph, buildTracks } from "../src/photos3d/graph.js";
import { groupLenses, photoSettings } from "../src/photos3d/lenses.js";
import { solvePhotoGraph } from "../src/photos3d/solve.js";
import { makeControl, scoreCameras } from "../tools/photos3d-controls.mjs";
import { PNG } from "pngjs";
import { matchSift } from "../vendor/splatjs/src/sfm/sift.js";
import { polygonMask, scoreHeldOut } from "../tools/photos3d-evaluate.mjs";

test("masked metrics score object pixels, exclude holes, and distinguish a changed held-out render", () => {
  const width = 28,
    height = 28;
  const annotation = {
    polygons: [
      [
        [0, 0],
        [1, 0],
        [1, 1],
        [0, 1],
      ],
    ],
    holes: [
      [
        [0, 0],
        [0.25, 0],
        [0.25, 1],
        [0, 1],
      ],
    ],
  };
  const mask = polygonMask(width, height, annotation);
  expect(mask.reduce((a, b) => a + b, 0)).toBe(21 * 28);
  const frame = { tw: width, th: height, rgb: new Float32Array(width * height * 3).fill(0.5) };
  const rendered = new Uint8ClampedArray(width * height * 4).fill(128);
  for (let i = 0; i < width * height; i++) {
    rendered[i * 4 + 3] = 255;
    if (!mask[i]) rendered[i * 4] = 0;
  }
  const exact = scoreHeldOut(frame, rendered, annotation);
  expect(exact.exactMatch).toBe(true);
  expect(exact.ssim).toBe(1);
  rendered.fill(0);
  const changed = scoreHeldOut(frame, rendered, annotation);
  expect(changed.ssim).toBeLessThan(0.1);
  expect(changed.psnr).toBeGreaterThan(0);
  expect(changed.psnr).toBeLessThan(10);
});

test("every unordered pair is proposed at 8, 24, and 60 photos", () => {
  for (const n of [8, 24, 60]) {
    const pairs = allPairs(n);
    expect(pairs).toHaveLength((n * (n - 1)) / 2);
    expect(new Set(pairs.map(([i, j]) => `${i}:${j}`)).size).toBe(pairs.length);
  }
  expect(() => allPairs(7)).toThrow();
  expect(() => allPairs(61)).toThrow();
  expect(photoSettings("phone").featureSide).toBe(960);
  expect(photoSettings("high").featureSide).toBe(1600);
  expect(photoSettings("high", 1280).featureSide).toBe(1280);
  expect(() => photoSettings("phone", 480)).toThrow();
});

test("lens selection rejects outliers and incomplete EXIF independent of input order", () => {
  const frames = Array.from({ length: 12 }, (_, i) => ({
    name: `p${i}`,
    fw: 960,
    fh: 720,
    exif: { f35: i < 8 ? 28 : 56, model: "camera" },
  }));
  frames.push({ name: "missing", fw: 720, fh: 960 });
  const rows = groupLenses(frames);
  expect(rows.filter((r) => r.accepted)).toHaveLength(8);
  expect(rows.find((r) => r.name === "p9").reason).toMatch(/Different camera or focal/);
  expect(rows.at(-1).reason).toMatch(/Missing/);
  const byName = (r) => r.sort((a, b) => a.name.localeCompare(b.name)).map(({ index, ...v }) => v);
  expect(byName(groupLenses([...frames].reverse()))).toEqual(byName(rows));
  expect(groupLenses([frames.at(-1)])[0].accepted).toBe(false);
  expect(groupLenses([frames.at(-1)], { assumeSingleLens: true })[0].source).toMatch(/assumption/);
});

test("graph diagnostics include isolated components and track conflicts cannot merge identities", () => {
  const frames = Array.from({ length: 8 }, (_, i) => ({ name: `p${i}` }));
  const features = frames.map(() => ({ n: 50 }));
  const edges = [
    {
      i: 0,
      j: 1,
      accepted: true,
      raw: 30,
      inliers: 30,
      matches: [
        [0, 0],
        [1, 1],
      ],
    },
    {
      i: 1,
      j: 2,
      accepted: true,
      raw: 30,
      inliers: 30,
      matches: [
        [0, 0],
        [1, 0],
      ],
    },
  ];
  const graph = summarizeGraph(frames, features, edges, new Set([0]));
  expect(graph.components).toEqual([["p0", "p1", "p2"], ["p3"], ["p4"], ["p5"], ["p6"], ["p7"]]);
  expect(graph.photos[0].registered).toBe(true);
  expect(graph.photos[3].reason).toMatch(/No geometrically verified/);
  expect(buildTracks(features, edges)).toEqual([]);
});

test("photo geometry recovers a calibrated orbit with per-photo focal lengths", async () => {
  const control = makeControl({ count: 12, mixedFocal: true });
  const K = control.truth.map((c) => ({ f: c.f, cx: 240, cy: 180 }));
  const edges = allPairs(12).map(([i, j]) =>
    verifyPair(
      i,
      j,
      matchSift(
        control.feats[i].desc,
        control.feats[i].n,
        control.feats[j].desc,
        control.feats[j].n,
      ),
      control.feats,
      K,
    ),
  );
  const result = await solvePhotoGraph(control.images, control.feats, edges, K);
  const score = scoreCameras(result.cams, control.truth, control.sceneSize);
  expect(score.registered).toBe(12);
  expect(score.rotationDegMedian).toBeLessThan(2);
  expect(score.positionFractionMedian).toBeLessThan(0.02);
});

test("browser photo API keeps picker order out of graph results and reports every blank photo", async ({
  page,
}) => {
  await page.goto("/");
  const png = new PNG({ width: 32, height: 32 });
  png.data.fill(255);
  const bytes = Array.from(PNG.sync.write(png));
  const result = await page.evaluate(async (bytes) => {
    const { solvePhotos } = await import("/src/photos3d/run.js");
    const files = Array.from(
      { length: 8 },
      (_, i) => new File([new Uint8Array(bytes)], `blank-${i}.png`, { type: "image/png" }),
    );
    const options = { assumeSingleLens: true, cpuMatching: true, workers: 2 };
    const a = await solvePhotos(files, options);
    const b = await solvePhotos([...files].reverse(), options);
    const cancel = new AbortController();
    cancel.abort();
    let aborted;
    try {
      await solvePhotos(files, { ...options, signal: cancel.signal });
    } catch (e) {
      aborted = e.name;
    }
    return { a: a.graph, b: b.graph, error: a.error, aborted, recon: a.recon };
  }, bytes);
  expect(result.a).toEqual(result.b);
  expect(result.a.pairs).toBe(28);
  expect(result.a.photos.every((p) => !p.registered && p.reason)).toBe(true);
  expect(result.error).toMatch(/No geometrically verified/);
  expect(result.recon).toBeNull();
  expect(result.aborted).toBe("AbortError");
});

test("held-out RGB and masks cannot affect sparse/surface seeds, uploaded targets, or trained parameters", async ({
  page,
}) => {
  await page.goto("/");
  const result = await page.evaluate(async () => {
    const { makeControl } = await import("/tools/photos3d-controls.mjs");
    const { seedPhotos } = await import("/src/photos3d/run.js");
    const { appearanceFold } = await import("/src/photos3d/appearance.js");
    const control = makeControl({ count: 8 });
    const frames = control.images.map((f, i) => ({
      ...f,
      tw: 32,
      th: 24,
      sharpness: 1,
      rgb: new Float32Array(32 * 24 * 3).fill(0.3 + i / 100),
      sampleColor: () => [0.5, 0.5, 0.5],
    }));
    const cams = control.truth.map((c, imgIdx) => ({ ...c, imgIdx, cx: 240, cy: 180 }));
    // Exact geometry only: appearance exclusion is the subject of this test.
    const tracks = Array.from({ length: 140 }, (_, feat) => ({ feat }));
    const { triangulateN } = await import("/vendor/splatjs/src/sfm/geometry.js");
    for (const track of tracks) {
      track.obs = cams.map((_, img) => ({ img, feat: track.feat }));
      track.X = triangulateN(
        cams,
        track.obs.map((o) => [
          (control.feats[o.img].x[o.feat] - 240) / 420,
          (control.feats[o.img].y[o.feat] - 180) / 420,
        ]),
      );
    }
    const solution = {
      settings: { profile: "phone" },
      frames,
      recon: { cams, tracks, features: control.feats },
    };
    const run = async (color) => {
      frames[0] = { ...frames[0], rgb: new Float32Array(32 * 24 * 3).fill(color) };
      Object.defineProperty(frames[0], "alpha", {
        get: () => {
          throw new Error("Held-out mask read");
        },
      });
      frames[0].sampleColor = () => {
        throw new Error("Held-out color sampled");
      };
      const fold = appearanceFold(solution, [frames[0].name]);
      const trained = await seedPhotos(solution, {
        heldOut: [frames[0].name],
        software: true,
        seed: 128,
        iterations: 2,
      });
      const { session } = trained;
      try {
        const seed = Array.from(session.model.data);
        session.trainer.stepOnce();
        session.trainer.stepOnce();
        await session.trainer.device.queue.onSubmittedWorkDone();
        const params = Array.from((await session.trainer.readGaussians()).data);
        return {
          seed,
          params,
          surface: trained.surfacePoints,
          sparse: fold.recon.points,
          uploaded: session.frames.map((f) => f.name),
        };
      } finally {
        session.dispose();
      }
    };
    const a = await run(0),
      b = await run(1);
    return {
      seedEqual: JSON.stringify(a.seed) === JSON.stringify(b.seed),
      sparseEqual: JSON.stringify(a.sparse) === JSON.stringify(b.sparse),
      surface: [a.surface, b.surface],
      maxChange: Math.max(...a.params.map((v, i) => Math.abs(v - b.params[i]))),
      uploaded: a.uploaded,
    };
  });
  expect(result.seedEqual).toBe(true);
  expect(result.sparseEqual).toBe(true);
  expect(result.surface[0]).toBeGreaterThan(0);
  expect(result.surface[0]).toBe(result.surface[1]);
  expect(result.maxChange).toBeLessThan(1e-6);
  expect(result.uploaded).toHaveLength(7);
  expect(result.uploaded).not.toContain("control-0");
});
