// Task 41: relative-depth drift, persistent edges, freshness, and occlusion.
import { test, expect } from "@playwright/test";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { execFileSync } from "node:child_process";
import config from "../playwright.config.mjs";
import { fakeCamera, openMirror, measure } from "../tools/lv7-mirror-measure.mjs";
import { cameras } from "../tools/cdx-mir-camera.mjs";
import { relativeAlignment, holdDepth, upsampleSnap, BackPlate } from "../src/live/relief.js";
import { paired } from "../tools/cdx-mir-paired.mjs";

const meanError = (a, b) => a.reduce((s, v, i) => s + Math.abs(v - b[i]), 0) / a.length;
const rgba = (w, h, rgb) => {
  const data = new Uint8ClampedArray(w * h * 4);
  for (let i = 0; i < w * h; i++) data.set([...rgb, 255], i * 4);
  return { w, h, data, crop: [0, 0, 1, 1] };
};

test("scale and shift align on unchanged colors while a moving object keeps its depth", () => {
  const n = 2400;
  const ref = Float32Array.from({ length: n }, (_, i) => 2 + (i % 60) / 20);
  const now = Float32Array.from(ref, (v) => v * 1.7 - 0.8);
  const oldColor = new Float32Array(n * 3).fill(100);
  const color = oldColor.slice();
  for (let i = 0; i < n / 4; i++) {
    now[i] += 1.7;
    color[i * 3] = 220;
  }
  const fit = relativeAlignment(now, ref, color, oldColor);
  expect(fit.samples).toBeGreaterThan(1000);
  const aligned = Float32Array.from(now, (v) => v * fit.scale + fit.shift);
  expect(meanError(aligned.slice(n / 4), ref.slice(n / 4))).toBeLessThan(0.00001);
  expect(meanError(aligned.slice(0, n / 4), ref.slice(0, n / 4))).toBeCloseTo(1, 5);
  // A scene cut has no reliable correspondence; it must not invent a fit.
  expect(relativeAlignment(now, ref, color.fill(240), oldColor).samples).toBe(0);
});

test("still depths do not accumulate noise; flips need consecutive answers on the same side", () => {
  const n = 800;
  const ref = new Float32Array(n).fill(0.4);
  const colors = new Float32Array(n * 3).fill(90);
  const still = new Uint8Array(n).fill(1);
  const jumps = new Uint8Array(n);
  const sides = new Int8Array(n);
  let prev = ref.slice();
  for (let f = 0; f < 100; f++) {
    const next = Float32Array.from(ref, (_, i) => 0.4 + 0.03 * Math.sin(i * 7 + f));
    const sensor = Float32Array.from(colors, (v, i) => v + 12 * Math.sin(i * 7 + f));
    holdDepth(next, prev, still, sensor, colors, jumps, sides);
    expect(meanError(next, ref)).toBe(0);
    prev = next;
  }
  const jump = (v) => {
    const d = new Float32Array(n).fill(v);
    holdDepth(d, prev, still, colors, colors, jumps, sides);
    prev = d;
    return d[0];
  };
  for (let f = 0; f < 10; f++) expect(jump(f % 2 ? 0.05 : 0.8)).toBeCloseTo(0.4);
  expect(jump(0.8)).toBeCloseTo(0.4);
  expect(jump(0.8)).toBeCloseTo(0.4);
  expect(jump(0.8)).toBeCloseTo(0.8);
  // A visible move is accepted immediately, even after a long still period.
  const moved = colors.slice().fill(180);
  const next = new Float32Array(n).fill(0.1);
  holdDepth(next, prev, still, moved, colors, jumps, sides);
  expect(next[0]).toBeCloseTo(0.1);
});

test("upsampling uses the request's colors to move an edge, without a stretched depth ramp", () => {
  const w = 8,
    h = 4,
    gw = 32,
    gh = 16;
  const d = new Float32Array(w * h);
  const source = new Float32Array(w * h * 3);
  const guide = new Uint8ClampedArray(gw * gh * 4);
  for (let y = 0; y < h; y++)
    for (let x = 0; x < w; x++) {
      const near = x < 4;
      d[y * w + x] = near ? 0.9 : 0.1;
      source.set(near ? [200, 30, 30] : [30, 30, 200], (y * w + x) * 3);
    }
  for (let y = 0; y < gh; y++)
    for (let x = 0; x < gw; x++)
      guide.set(x < 18 ? [200, 30, 30, 255] : [30, 30, 200, 255], (y * gw + x) * 4);
  const out = upsampleSnap(d, w, h, gw, gh, guide, source);
  expect(out[8 * gw + 16]).toBeCloseTo(0.9);
  expect(out[8 * gw + 18]).toBeCloseTo(0.1);
  expect(out[8 * gw + 17]).toBeCloseTo(0.9);
});

test("the faster sharpening pass preserves the existing default filter's pixels", async ({
  page,
}) => {
  const before = execFileSync("git", ["show", "ec4aaa37:src/live/relief.js"], { encoding: "utf8" });
  await page.route(/\/src\/live\/relief\.js\?cdx-before$/, (route) =>
    route.fulfill({ contentType: "text/javascript", body: before }),
  );
  await page.goto("/tests/");
  const different = await page.evaluate(async () => {
    const before = await import("/src/live/relief.js?cdx-before");
    const after = await import("/src/live/relief.js");
    let different = 0;
    for (const [w, h] of [
      [1, 1],
      [3, 2],
      [64, 48],
    ]) {
      const pixels = Uint8ClampedArray.from({ length: w * h * 4 }, (_, i) =>
        i % 4 === 3 ? 255 : Math.round(120 + 45 * Math.sin(i * 2.1) + 2 * Math.cos(i / 3)),
      );
      const a = pixels.slice(),
        b = pixels.slice();
      before.sharpen(a, w, h, 1.2, new Float32Array(w * h * 3));
      after.sharpen(b, w, h, 1.2, new Float32Array(w * h * 3));
      different += a.reduce((n, v, i) => n + (v !== b[i] ? 1 : 0), 0);
    }
    return different;
  });
  expect(different).toBe(0);
});

test("previously seen wall detail survives occlusion, and its plate stays behind the visible wall", () => {
  const w = 60,
    h = 40;
  const back = new BackPlate(30, 20);
  const frame = rgba(w, h, [40, 80, 190]);
  for (let y = 0; y < h; y++) for (let x = 20; x < 40; x++) frame.data[(y * w + x) * 4 + 1] = 140;
  const d = new Float32Array(w * h).fill(0.2);
  back.learn(frame, d, w, h, false);
  const hidden = (10 * 30 + 15) * 4;
  const wall = Array.from(back.vals.slice(hidden, hidden + 4));
  for (let y = 0; y < h; y++)
    for (let x = 20; x < 40; x++) {
      d[y * w + x] = 0.9;
      frame.data.set([230, 30, 30, 255], (y * w + x) * 4);
    }
  back.learn(frame, d, w, h, false);
  expect(Array.from(back.vals.slice(hidden, hidden + 4))).toEqual(wall);
  let img;
  const g = {
    createImageData: (width, height) => ({
      width,
      height,
      data: new Uint8ClampedArray(width * height * 4),
    }),
    putImageData: (i) => (img = i),
  };
  // Deliberately make a remembered wall too near: drawing must clamp it.
  back.vals.fill(0.8);
  back.draw(g, w, h, 0.5, d);
  const q = (20 * w * 2 + w + 18) * 4;
  expect(img.data[q + 2]).toBeLessThanOrEqual(Math.round(255 * (0.5 + (0.2 * 0.5) / 2)));
  // A splat centered under the foreground also stays behind the lower
  // wall that its footprint overlaps.
  const edge = (20 * w * 2 + w + 21) * 4;
  expect(img.data[edge + 2]).toBeLessThanOrEqual(Math.round(255 * (0.5 + (0.2 * 0.5) / 2)));
});

test("outdated request IDs, resized frames, and answers after close cannot replace the relief", async ({
  page,
}) => {
  await page.goto("/tests/");
  const result = await page.evaluate(async () => {
    const { CameraDepth } = await import("/src/live/relief.js");
    const video = document.createElement("canvas");
    video.width = 64;
    video.height = 48;
    video.videoWidth = 64;
    video.videoHeight = 48;
    video.getContext("2d").fillRect(0, 0, 64, 48);
    const cam = new CameraDepth(video, { cols: 32, rows: 24, depth: false });
    let request;
    cam.worker = { postMessage: (m) => (request = m), terminate() {} };
    const c = document.createElement("canvas");
    c.width = 64;
    c.height = 24;
    cam.draw(c.getContext("2d"));
    const answer = {
      type: "depth",
      id: request.id,
      w: 4,
      h: 4,
      d: Float32Array.from({ length: 16 }, (_, i) => i),
      ms: 10,
    };
    cam.onAnswer({ ...answer, id: request.id - 1 });
    const stale = { answers: cam.answers, busy: cam.busy };
    cam.onAnswer(answer);
    const accepted = cam.answers;
    cam.ask();
    video.videoWidth = 80;
    cam.onAnswer({ ...answer, id: request.id });
    const resized = cam.answers;
    cam.close();
    cam.onAnswer({ ...answer, id: request.id });
    return { stale, accepted, resized, closed: cam.answers };
  });
  expect(result.stale).toEqual({ answers: 0, busy: true });
  expect(result.accepted).toBe(1);
  expect(result.resized).toBe(1);
  expect(result.closed).toBe(1);
});

test("the complete camera pipeline holds a still map through model scale, shift, and noise", async ({
  page,
}) => {
  await page.goto("/tests/");
  const result = await page.evaluate(async () => {
    const { CameraDepth } = await import("/src/live/relief.js");
    const video = document.createElement("canvas");
    video.width = video.videoWidth = 64;
    video.height = video.videoHeight = 48;
    const g = video.getContext("2d");
    g.fillStyle = "#626262";
    g.fillRect(0, 0, 64, 48);
    const cam = new CameraDepth(video, { cols: 32, rows: 24, depth: false, mirror: false });
    let request;
    cam.worker = { postMessage: (m) => (request = m), terminate() {} };
    cam.stillT.fill(2);
    const c = document.createElement("canvas");
    c.width = 64;
    c.height = 24;
    cam.draw(c.getContext("2d"));
    let held,
      max = 0;
    for (let f = 0; f < 80; f++) {
      cam.ask();
      const scale = 0.7 + (f % 7) * 0.25;
      const shift = Math.sin(f) * 2;
      const d = Float32Array.from(
        { length: 32 * 24 },
        (_, i) => (2 + (i % 32) / 32 + 0.001 * Math.sin(i * 9 + f)) * scale + shift,
      );
      cam.onAnswer({ type: "depth", id: request.id, w: 32, h: 24, d, ms: 10 });
      if (f === 3) held = cam.target.slice();
      if (held)
        for (let i = 0; i < held.length; i++)
          max = Math.max(max, Math.abs(held[i] - cam.target[i]));
    }
    // The source frame changes completely, then stops. The old range must
    // not survive just because motion has stopped before inference answers.
    g.fillStyle = "#eaeaea";
    g.fillRect(0, 0, 64, 48);
    cam.moving = 0;
    cam.ask();
    cam.onAnswer({
      type: "depth",
      id: request.id,
      w: 32,
      h: 24,
      d: Float32Array.from({ length: 32 * 24 }, (_, i) => 20 + (i % 32) / 32),
      ms: 10,
    });
    const cut = { lo: cam.lo, spread: Math.max(...cam.target) - Math.min(...cam.target) };
    // A delayed delivery is dropped while the next request starts.
    cam.ask();
    cam.sent.capturedAt -= 10000;
    const before = cam.answers;
    cam.onAnswer({
      type: "depth",
      id: request.id,
      w: 2,
      h: 2,
      d: new Float32Array([0, 1, 2, 3]),
      ms: 10,
    });
    const delayed = { before, after: cam.answers, discarded: cam.discarded, busy: cam.busy };
    cam.close();
    return { max, cut, delayed };
  });
  expect(result.max).toBe(0);
  expect(result.cut.lo).toBeGreaterThan(19);
  expect(result.cut.spread).toBeGreaterThan(0.8);
  expect(result.delayed).toEqual({ before: 81, after: 81, discarded: 1, busy: true });
});

test.describe("real depth worker with a fake camera", () => {
  test.describe.configure({ timeout: 600000 });
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "splashery-cdx-mir-"));
  test.beforeAll(() => {
    cameras(dir, 20, ["still", "low-light"]);
  });
  test.afterAll(() => fs.rmSync(dir, { recursive: true, force: true }));
  for (const [clip, height, shown] of [
    // Live sampling varied across four independent runs. Bounds cover the
    // measured maxima (0.0003501 still, 0.0110579 low light); the exact-pose
    // comparison below adds much tighter absolute and relative checks.
    ["still", 0.00055, 0.95],
    ["low-light", 0.0135, 2.2],
  ]) {
    test(`${clip}: measured drift stays below the baseline`, async ({ playwright, baseURL }) => {
      const browser = await playwright.chromium.launch({
        ...config.use.launchOptions,
        args: fakeCamera(path.join(dir, `${clip}.y4m`), config.use.launchOptions.args),
      });
      try {
        const page = await browser.newPage({
          viewport: { width: 390, height: 844 },
          deviceScaleFactor: 2,
        });
        const errors = [];
        const requests = [];
        page.on("pageerror", (e) => errors.push(e.message));
        page.on("request", (r) => requests.push(r.url()));
        await openMirror(page, baseURL + "/");
        const m = await measure(page, { answers: 6 });
        console.log(`cdx mirror ${clip}: ${JSON.stringify(m)}`);
        expect(m.heightJitter).toBeLessThan(height);
        expect(m.shownJitter).toBeLessThan(shown);
        // Record live timing, but guard cost with the identical-input
        // relative benchmark below instead of a host-dependent ceiling.
        expect(m.grid).toBe("423x317");
        expect(errors).toEqual([]);
        expect(
          requests.filter(
            (u) => /^https?:/.test(u) && new URL(u).origin !== new URL(baseURL).origin,
          ),
        ).toEqual([]);
      } finally {
        await browser.close();
      }
    });
  }
});

test("matched camera frames keep real feature contrast and improve held-pose stability", async () => {
  test.setTimeout(600000);
  fs.mkdirSync(".cache", { recursive: true });
  const dir = fs.mkdtempSync(path.resolve(".cache/cdx-mir-pairs-test-"));
  try {
    const result = await paired(dir, {
      profiles: ["mid"],
      clips: ["still", "low-light"],
      includeReview: false,
      liveTiming: false,
    });
    const before = result["mid-before"],
      after = result["mid-after"];
    expect(before.grid).toBe(after.grid);
    expect(before.modelHash).toBe(after.modelHash);
    expect(before.errors).toEqual([]);
    expect(after.errors).toEqual([]);
    for (let i = 0; i < before.poses.length; i++) {
      const a = after.poses[i],
        b = before.poses[i];
      expect(a.inputHash).toBe(b.inputHash);
      expect(a.featurePixels).toBe(b.featurePixels);
      expect(a.featureSharpness).toBeGreaterThanOrEqual(b.featureSharpness * 0.99);
      expect(a.heightJitter).toBeLessThan(b.heightJitter * 0.2);
      // Fixed input and draw times remove the live camera's sampling
      // variation, allowing a tight absolute regression bound too.
      expect(a.heightJitter).toBeLessThan(a.clip === "still" ? 0.00001 : 0.002);
      expect(a.shownJitterTurned).toBeLessThan(b.shownJitterTurned * 0.85);
      // The same 10% cost bound, measured in alternating matched batches in
      // one browser. Separate before/after browser runs see different CPU load.
      expect(a.referenceDrawMs).toBeGreaterThan(0);
      expect(a.drawMs).toBeLessThan(a.referenceDrawMs * 1.1);
    }
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});
