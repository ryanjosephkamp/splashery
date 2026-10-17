import { test, expect } from "@playwright/test";
import { makeControl, scoreCameras } from "../tools/photos3d-controls.mjs";
import { orderedFiles, browserProbe, withWatchdog } from "../tools/photos3d-probe.mjs";
import { runSfM } from "../vendor/splatjs/src/sfm/sfm.js";
import { PNG } from "pngjs";

test("the real browser pipeline reports eight unplaceable photos without inventing cameras", async ({
  page,
}) => {
  await page.route("**/photos3d-probe.html", (route) =>
    route.fulfill({
      contentType: "text/html",
      body: '<input type="file" multiple><canvas></canvas>',
    }),
  );
  await page.goto("/photos3d-probe.html");
  const available = await page.evaluate(
    async () => !!(navigator.gpu && (await navigator.gpu.requestAdapter())),
  );
  test.skip(!available, "This probe requires the existing solver's WebGPU device setup");
  const png = new PNG({ width: 32, height: 32 });
  png.data.fill(255);
  const buffer = PNG.sync.write(png);
  await page.setInputFiles(
    "input",
    Array.from({ length: 8 }, (_, i) => ({
      name: `blank-${i}.png`,
      mimeType: "image/png",
      buffer,
    })),
  );
  const writes = [];
  page.on("request", (r) => {
    if (r.method() !== "GET") writes.push(r.url());
  });
  const result = await page.evaluate(browserProbe, {
    profile: "phone",
    timeoutMs: 30000,
    trainSteps: 0,
  });
  expect(result.decoded).toHaveLength(8);
  expect(result.error.message).toMatch(/no image pair with enough matches/i);
  expect(result.accepted).toEqual([]);
  expect(result.missing.map((f) => f.name)).toEqual(
    Array.from({ length: 8 }, (_, i) => `blank-${i}.png`),
  );
  expect(result.firstViewSeconds).toBeUndefined();
  expect(result.acceptance.maskedHeldOutSSIM).toBeNull();
  expect(writes).toEqual([]);
  const timed = await page.evaluate(browserProbe, {
    profile: "phone",
    timeoutMs: 1,
    trainSteps: 0,
  });
  expect(timed.timedOut).toBe(true);
  expect(timed.error.name).toBe("TimeoutError");
  expect(timed.accepted).toEqual([]);
  expect(timed.missing).toHaveLength(8);
  expect(timed.seconds).toBeLessThan(5);
});

test("the host watchdog terminates browser work that never settles", async () => {
  let terminated = false;
  await expect(
    withWatchdog(new Promise(() => {}), 10, () => {
      terminated = true;
    }),
  ).rejects.toThrow(/host deadline/);
  expect(terminated).toBe(true);
  expect(
    await withWatchdog(Promise.resolve(42), 100, () => {
      throw new Error("unexpected termination");
    }),
  ).toBe(42);
});

test("photo permutations are deterministic and preserve every filename", () => {
  const files = Array.from({ length: 60 }, (_, i) => `photo-${i}.png`);
  const shuffled = orderedFiles(files, 104);
  expect(shuffled).toEqual(orderedFiles([...files].reverse(), 104));
  expect(shuffled).not.toEqual(orderedFiles(files));
  expect([...shuffled].sort()).toEqual([...files].sort());
  expect(files[0]).toBe("photo-0.png");
});

test("the existing numeric camera solver recovers a calibrated 24-camera control", async () => {
  const control = makeControl();
  const result = await runSfM(
    control.images,
    () => {},
    () => [0.5, 0.5, 0.5],
    {
      workers: false,
      cpuMatching: true,
      focalPx: control.focalPx,
      lockIntrinsics: true,
      _feats: control.feats,
    },
  );
  const cameras = result.cams.map((c) => ({ ...c, name: control.images[c.imgIdx].name }));
  const score = scoreCameras(cameras, control.truth, control.sceneSize);
  expect(score.registered).toBe(24);
  expect(score.rotationDegMedian).toBeLessThan(2);
  expect(score.positionFractionMedian).toBeLessThan(0.02);
  expect(score.pass).toBe(true);
});

test("camera scoring removes one global gauge, preserves source identity, and counts omissions", () => {
  const { truth, sceneSize } = makeControl();
  // Rotate world coordinates 90 degrees about Y, scale by 3, and translate.
  const Q = [0, 0, 1, 0, 1, 0, -1, 0, 0],
    shift = [2, -1, 4];
  const estimated = truth
    .map((c) => {
      const R = Array.from({ length: 9 }, (_, i) =>
        [0, 1, 2].reduce((s, k) => s + c.R[Math.floor(i / 3) * 3 + k] * Q[(i % 3) * 3 + k], 0),
      );
      const t = c.t.map(
        (v, r) => 3 * v - R.slice(r * 3, r * 3 + 3).reduce((s, v, j) => s + v * shift[j], 0),
      );
      return { name: c.name, R, t };
    })
    .reverse();
  const score = scoreCameras(estimated, truth, sceneSize);
  expect(score.pass).toBe(true);
  expect(score.rotationDegMax).toBeLessThan(0.00001);
  expect(score.positionFractionMax).toBeLessThan(1e-12);
  const partial = scoreCameras(estimated.slice(1), truth, sceneSize);
  expect(partial.missing).toEqual(["control-23"]);
  expect(partial.pass).toBe(false);
});

test("camera scoring rejects invalid identities and detects relative orientation errors", () => {
  const { truth, sceneSize } = makeControl();
  expect(() => scoreCameras([truth[0], truth[0]], truth, sceneSize)).toThrow(/Duplicate/);
  expect(() => scoreCameras([{ ...truth[0], R: Array(9).fill(0) }], truth, sceneSize)).toThrow(
    /Invalid/,
  );
  expect(() => scoreCameras([{ ...truth[0], name: "unknown" }], truth, sceneSize)).toThrow(
    /Invalid/,
  );
  expect(scoreCameras([], truth, sceneSize).rotationDegMedian).toBeNull();
  // Change rotations about each unchanged camera center by 5 degrees.
  const c = Math.cos((5 * Math.PI) / 180),
    s = Math.sin((5 * Math.PI) / 180);
  const changed = truth.map((p) => ({
    ...p,
    R: [
      ...p.R.slice(0, 3).map((v, j) => c * v - s * p.R[3 + j]),
      ...p.R.slice(3, 6).map((v, j) => s * p.R[j] + c * v),
      ...p.R.slice(6),
    ],
    t: [c * p.t[0] - s * p.t[1], s * p.t[0] + c * p.t[1], p.t[2]],
  }));
  const score = scoreCameras(changed, truth, sceneSize);
  expect(score.rotationDegMedian).toBeCloseTo(5, 5);
  expect(score.positionFractionMedian).toBeLessThan(1e-12);
  expect(score.pass).toBe(false);
});
