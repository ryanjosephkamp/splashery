// Lane Video to 3D (prefix v3d): its own checks. docs/handoff/Video3D.md.

import { test, expect } from "@playwright/test";

test("a kit cloud keeps a trained splat's own sizes and rotation", async () => {
  const { buildRecipe } = await import("../src/kit.js");
  const s = Math.SQRT1_2;
  const recipe = {
    build(k) {
      k.fitOn = false;
      k.cloud({ count: 2 * (160000 / 6000) }, (_r, i) =>
        i === 0
          ? { p: [0, 0, 0], color: "#ff0000", opacity: 0.5, scales: [0.3, 0.02, 0.01], quat: [0, 0, s, s] } // prettier-ignore
          : { p: [0.5, 0, 0], color: "#00ff00", size: 1, jitter: 0 },
      );
    },
  };
  const it = buildRecipe(recipe, { seed: 1, count: 6000, options: {} }, () => {});
  let b = it.next();
  while (!b.done) b = it.next();
  const buf = b.value.buf;
  expect(buf.count).toBe(2);
  expect([...buf.scale.slice(0, 3)].map((v) => +v.toFixed(4))).toEqual([0.3, 0.02, 0.01]);
  expect([...buf.rot.slice(0, 4)].map((v) => +v.toFixed(4))).toEqual([0, 0, 0.7071, 0.7071]);
  expect(+buf.color[3].toFixed(3)).toBe(0.5);
  // The other splat is sized as before: the base size, round.
  expect(buf.scale[3]).toBeCloseTo(buf.scale[4], 6);
  expect([...buf.rot.slice(4, 8)]).toEqual([0, 0, 0, 1]);
});

// ---- Frames, the PLY reader and the scene frame (Node) ----------------------------------------

test("the stretch and frame rate pick the right frames", async () => {
  const { planFrames, windowTimes } = await import("../src/video3d/frames.js");
  // 10 s from 4 s, 3 a second: 30 windows of a third of a second, from 4 s to 14 s.
  const p = planFrames({ duration: 60, start: 4, length: 10, rate: 3, maxFrames: 60 });
  expect(p.windows.length).toBe(30);
  expect(p.start).toBe(4);
  expect(p.end).toBe(14);
  expect(p.windows[0]).toEqual({ t: 4.167, from: 4, to: 4.333 });
  expect(p.windows[29].to).toBeCloseTo(14, 3);
  // A long stretch is sampled more thinly, never past maxFrames.
  const q = planFrames({ duration: 600, start: 0, length: 40, rate: 6, maxFrames: 32 });
  expect(q.windows.length).toBe(32);
  expect(q.rate).toBeCloseTo(0.8, 3);
  // A stretch past the end is cut at the end; one before 0 starts at 0.
  const r = planFrames({ duration: 8, start: 5, length: 10, rate: 2 });
  expect([r.start, r.end, r.windows.length]).toEqual([5, 8, 6]);
  expect(planFrames({ duration: 8, start: -3, length: 2, rate: 2 }).start).toBe(0);
  expect(planFrames({ duration: 0 }).windows).toEqual([]);
  // Three tries in a window, spread across it.
  expect(windowTimes({ t: 1.5, from: 1, to: 2 }, 3)).toEqual([1.167, 1.5, 1.833]);
  expect(windowTimes({ t: 1.5, from: 1, to: 2 }, 1)).toEqual([1.5]);
});

test("a frame close to 2:1 is trimmed, so it is not taken for a 360-degree panorama", async () => {
  const { panoSafeCrop } = await import("../src/video3d/frames.js");
  const { isEquirect } = await import("../vendor/splatjs/src/io/pano.js");
  expect(panoSafeCrop(1920, 1080)).toEqual({ sx: 0, sw: 1920 }); // 16:9 stays whole
  for (const [w, h] of [
    [854, 422],
    [2000, 1000],
    [1024, 500],
  ]) {
    const c = panoSafeCrop(w, h);
    expect(isEquirect(c.sw, h), `${w}x${h}`).toBe(false);
    expect(c.sx * 2 + c.sw).toBeLessThanOrEqual(w + 1);
  }
});

test("a sharp picture scores higher than the same picture blurred", async () => {
  const { sharpness } = await import("../src/video3d/frames.js");
  const w = 64;
  const sharp = new Float32Array(w * w).map((_, i) => ((i % w >> 3) + ((i / w) >> 3)) % 2 ? 255 : 0); // prettier-ignore
  const blur = new Float32Array(w * w);
  for (let y = 1; y < w - 1; y++)
    for (let x = 1; x < w - 1; x++) {
      let s = 0;
      for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) s += sharp[(y + dy) * w + x + dx]; // prettier-ignore
      blur[y * w + x] = s / 9;
    }
  expect(sharpness(sharp, w, w)).toBeGreaterThan(2 * sharpness(blur, w, w));
});

test("the PLY reader turns a small known PLY into the right splats", async () => {
  // Written by Splat.js's own exporter (the file the toy reads), then read back.
  const { gaussiansToPly } = await import("../vendor/splatjs/src/io/ply.js");
  const { readSplatPly } = await import("../src/video3d/ply.js");
  const logit = (p) => Math.log(p / (1 - p));
  // The trainer's layout, 16 floats a splat: xyz, log scales, quaternion (w x y z), color logits,
  // opacity logit, 2 spare.
  const rows = [
    { p: [1, 2, 3], s: [0.1, 0.2, 0.3], q: [1, 0, 0, 0], c: [0.9, 0.5, 0.1], o: 0.8 },
    { p: [-1, 0, 0.5], s: [0.05, 0.05, 0.01], q: [0, 0, 0, 2], c: [0.2, 0.4, 0.6], o: 0.3 },
    { p: [0, -4, 0], s: [1, 1, 1], q: [0.5, 0.5, 0.5, 0.5], c: [0, 1, 0.5], o: 0.5 },
  ];
  const data = new Float32Array(rows.length * 16);
  rows.forEach((r, i) => {
    data.set([...r.p, ...r.s.map(Math.log), ...r.q, ...r.c.map((v) => logit(Math.min(0.999, Math.max(0.001, v)))), logit(r.o)], i * 16); // prettier-ignore
  });
  const blob = gaussiansToPly(data, rows.length);
  const bytes = new Uint8Array(await blob.arrayBuffer());
  const s = readSplatPly(bytes);
  expect(s.count).toBe(3);
  rows.forEach((r, i) => {
    for (let k = 0; k < 3; k++) {
      expect(s.pos[i * 3 + k]).toBeCloseTo(r.p[k], 5);
      expect(s.scales[i * 3 + k]).toBeCloseTo(r.s[k], 5);
      expect(s.color[i * 3 + k]).toBeCloseTo(Math.min(0.999, Math.max(0.001, r.c[k])), 3);
    }
    expect(s.opacity[i]).toBeCloseTo(r.o, 4);
  });
  // Quaternions come out [x, y, z, w], normalized: (w 0, z 2) is a half turn about z.
  expect([...s.quat.slice(0, 4)]).toEqual([0, 0, 0, 1]);
  expect([...s.quat.slice(4, 8)]).toEqual([0, 0, 1, 0]);
  // Not a splat file: a plain message.
  expect(() => readSplatPly(new TextEncoder().encode("hello"))).toThrow(/not a splat/);
});

test("the scene frame puts the cameras' up at +y and the video's view toward -z", async () => {
  const { sceneFrame, toyCamera, splatsInFrame } = await import("../src/video3d/scene.js");
  // A camera 5 units behind the origin looking at it (the solve's frame: y down, z forward).
  const cam = { R: [1, 0, 0, 0, 1, 0, 0, 0, 1], t: [0, 0, 5] };
  const splats = {
    count: 3,
    pos: new Float32Array([0, 0, 0, 1, 0, 0, 0, -1, 0]),
    scales: new Float32Array([0.1, 0.1, 0.1, 0.1, 0.1, 0.1, 0.1, 0.1, 0.1]),
    quat: new Float32Array([0, 0, 0, 1, 0, 0, 0, 1, 0, 0, 0, 1]),
    color: new Float32Array(9),
    opacity: new Float32Array([1, 1, 1]),
  };
  const f = sceneFrame(splats, [cam], { fit: 0.95 });
  expect(f.around).toBe(false); // one camera: no point the views meet
  const c = toyCamera(f, cam);
  expect(c.pos.map((v) => +v.toFixed(3))).toEqual([0, 0, 4.75]);
  expect(c.forward.map((v) => +v.toFixed(3) + 0)).toEqual([0, 0, -1]);
  expect(c.up.map((v) => +v.toFixed(3) + 0)).toEqual([0, 1, 0]);
  expect([c.yaw, c.pitch, c.roll].map((v) => +v.toFixed(3) + 0)).toEqual([0, 0, 0]);
  const t = splatsInFrame(f, splats);
  // The point above the middle in the solve (y -1, "up" there) is above it in the toy.
  expect(t.pos[7]).toBeGreaterThan(0);
  expect(t.scales[0]).toBeCloseTo(0.1 * f.scale, 6);
});

// ---- In the browser ----------------------------------------------------------------------------

const APP = "/?renderer=webgl2&adapt=off&profile=mid&labs=1";
const FIX = "tests/fixtures/v3d";
const splatjs = (u) => /vendor\/splatjs\//.test(u);

async function openToy(page) {
  await page.goto(APP);
  await page.waitForSelector("body[data-ready='true']", { timeout: 180_000 });
  await page.evaluate(() => window.__splashery.app.chooseToy("video-3d"));
  await page.waitForFunction(() => window.__splashery.player.proc?.ctx?.kit?.data?.video, null, { timeout: 120_000 }); // prettier-ignore
}

test("Splat.js loads only when a video is opened in this toy", async ({ page }) => {
  test.setTimeout(300_000);
  const errors = [];
  const requests = [];
  page.on("pageerror", (e) => errors.push(e.message));
  page.on("request", (r) => requests.push(r.url()));
  await page.goto(APP);
  await page.waitForSelector("body[data-ready='true']", { timeout: 180_000 });
  // Other toys, the shelf and this toy's sample never fetch it.
  for (const id of ["photo-3d", "model-splats"]) {
    await page.evaluate((id) => window.__splashery.app.chooseToy(id), id);
    await page.waitForTimeout(800);
  }
  await page.evaluate(() => window.__splashery.app.chooseToy("video-3d"));
  await page.waitForFunction(() => window.__splashery.player.proc?.ctx?.kit?.data?.video, null, { timeout: 120_000 }); // prettier-ignore
  await page.evaluate(() => window.__splashery.app.act());
  await page.waitForTimeout(800);
  expect(requests.filter(splatjs)).toEqual([]);
  const gpu = await page.evaluate(async () => !!(navigator.gpu && (await navigator.gpu.requestAdapter()))); // prettier-ignore
  test.skip(!gpu, "no WebGPU adapter here: the loading half needs one");
  // A tiny video (a test pattern: nothing to solve) with the smallest settings: Splat.js comes,
  // the camera path fails, and the card says so plainly.
  await page.evaluate(() => {
    window.__v3dSettings = { maxFrames: 4, iters: 5, splats: 5000, trainSide: 96, frameSide: 192, featSide: 192 }; // prettier-ignore
  });
  await page.locator("#toy-input-file").setInputFiles(`${FIX}/tiny.webm`);
  await expect(page.locator("#v3d-card")).toBeVisible();
  await page.evaluate(async () => {
    window.__v3d = await import("./src/packs/video3d.js");
  });
  await page.waitForFunction(() => !!window.__v3d.video3dResult() || !!window.__v3d.video3dState().error, null, { timeout: 240_000, polling: 1000 }); // prettier-ignore
  expect(requests.filter(splatjs).length).toBeGreaterThan(3);
  expect(requests.some((u) => /splatjs\/src\/session\.js/.test(u))).toBe(true);
  expect(errors).toEqual([]);
});

test("without WebGPU the toy says so plainly and keeps going", async ({ page }) => {
  test.setTimeout(240_000);
  const errors = [];
  const requests = [];
  page.on("pageerror", (e) => errors.push(e.message));
  page.on("request", (r) => requests.push(r.url()));
  await page.addInitScript(() => {
    Object.defineProperty(Navigator.prototype, "gpu", { get: () => undefined, configurable: true });
  });
  await openToy(page);
  await page.locator("#toy-input-file").setInputFiles(`${FIX}/tiny.webm`);
  await expect(page.locator("#v3d-card .v3d-err")).toContainText("no WebGPU", { timeout: 60_000 });
  // The toy is still there (the sample or the stand-in), the page is fine, nothing heavy came.
  await page.waitForFunction(() => window.__splashery.player.proc?.ctx?.kit?.data?.video, null, { timeout: 60_000 }); // prettier-ignore
  await expect(page.locator("#toy-input")).toContainText("did not finish");
  expect(requests.filter(splatjs)).toEqual([]);
  expect(errors).toEqual([]);
});

test("screenshots at phone and desktop size", async ({ browser }) => {
  test.setTimeout(300_000);
  for (const [w, h] of [
    [390, 844],
    [1440, 900],
  ]) {
    const page = await browser.newPage({ viewport: { width: w, height: h } });
    await openToy(page);
    await page.waitForTimeout(1500);
    await page.screenshot({ path: `tests/screenshots/v3d-video-3d-${w}x${h}.png` });
    await page.close();
  }
});
