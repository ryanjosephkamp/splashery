import { test, expect } from "@playwright/test";

test("short phone training refines while growth is still possible", async () => {
  const { refinementSchedule } = await import("../src/video3d/run.js");
  const { TIERS } = await import("../src/video3d/frames.js");
  for (const tier of Object.values(TIERS)) {
    const schedule = refinementSchedule(tier.iters);
    const growthSteps = [];
    let lastRefine = 0;
    for (let iter = 1; iter <= tier.iters; iter++) {
      if (iter > schedule.refineStart && iter - lastRefine >= schedule.refineEvery) {
        lastRefine = iter;
        if (iter < schedule.growUntil) growthSteps.push(iter);
      }
    }
    expect(growthSteps.length).toBeGreaterThanOrEqual(3);
    expect(growthSteps.at(-1)).toBeLessThan(tier.iters);
  }
});

test("a dark textured clip gets an exposure explanation and a concrete retry", async () => {
  const { assessFrames } = await import("../src/video3d/suitability.js");
  const width = 128,
    height = 80;
  const frames = [0, 1, 2, 3].map((t) => ({
    width,
    height,
    gray: Float32Array.from({ length: width * height }, (_, i) => {
      const y = Math.floor(i / width),
        x = (i % width) + t * (y < height / 2 ? 3 : 1);
      return (((x * 17 + y * 23) ^ (x * y * 7)) & 127) / 8;
    }),
  }));
  const assessment = assessFrames(frames);
  expect(assessment.verdict).toBe("poor");
  expect(assessment.reasons.join(" ")).toMatch(/too dark/i);
  expect(assessment.reasons.join(" ")).toMatch(/brighter|light/i);
});

test("a fitted custom PLY keeps broad surfaces and rejects splats at the camera", async () => {
  const { gaussiansToPly } = await import("../vendor/splatjs/src/io/ply.js");
  const { sceneFromPly } = await import("../src/packs/video3d.js");
  const count = 33;
  const data = new Float32Array(count * 16);
  for (let i = 0; i < count; i++)
    data.set(
      [
        0,
        0,
        i === 32 ? 0.005 : 2,
        Math.log(0.08),
        Math.log(0.06),
        Math.log(0.05),
        1,
        0,
        0,
        0,
        -1,
        -1,
        -1,
        Math.log(0.2 / 0.8),
        0,
        0,
      ],
      i * 16,
    );
  const bytes = new Uint8Array(await (await gaussiansToPly(data, count)).arrayBuffer());
  const cams = [0, 1, 2].map((time) => ({
    time,
    R: [1, 0, 0, 0, 1, 0, 0, 0, 1],
    t: [0, 0, 0],
    f: 100,
    w: 100,
    h: 100,
  }));
  const fitted = sceneFromPly(bytes, cams, 400000, { affine: true, preservePhotometric: true });
  expect(fitted.scene.count).toBe(32);
  expect(fitted.pruned.atCamera).toBe(1);
  expect(fitted.scene.scales[0]).toBeCloseTo(0.08 * 0.45, 6);
});

test("unresponsive camera work ends with retry advice and cancels its work", async () => {
  const { runWithDeadline } = await import("../src/video3d/deadline.js");
  let workSignal;
  await expect(
    runWithDeadline(
      (signal) => {
        workSignal = signal;
        return new Promise(() => {});
      },
      { timeoutMs: 10, message: "The camera path took too long. Try a shorter stretch." },
    ),
  ).rejects.toThrow(/too long.*shorter/);
  expect(workSignal.aborted).toBe(true);
});

test("canceling camera work stays distinct from reaching its time limit", async () => {
  const { runWithDeadline } = await import("../src/video3d/deadline.js");
  const controller = new AbortController();
  let started = false;
  const pending = runWithDeadline(
    () => {
      started = true;
      return new Promise(() => {});
    },
    {
      signal: controller.signal,
      timeoutMs: 10000,
      message: "Timed out.",
    },
  );
  controller.abort();
  await expect(pending).rejects.toMatchObject({ name: "AbortError" });
  expect(started).toBe(false);
});

test("training waits for the decoded picture and records its presented timestamp", async () => {
  const { seekPresented } = await import("../src/video3d/extract.js");
  class Video extends EventTarget {
    readyState = 2;
    seeking = false;
    callbacks = new Map();
    next = 0;
    requestVideoFrameCallback(fn) {
      this.callbacks.set(++this.next, fn);
      return this.next;
    }
    cancelVideoFrameCallback(id) {
      this.callbacks.delete(id);
    }
    set currentTime(value) {
      this.time = value;
      this.seeking = true;
      queueMicrotask(() => {
        this.dispatchEvent(new Event("seeking"));
        this.seeking = false;
        this.dispatchEvent(new Event("seeked"));
      });
    }
    get currentTime() {
      return this.time;
    }
    present(mediaTime) {
      const callbacks = [...this.callbacks.values()];
      this.callbacks.clear();
      callbacks.forEach((fn) => fn(0, { mediaTime }));
    }
  }
  const video = new Video();
  let finished = false;
  const pending = seekPresented(video, 1).then((time) => {
    finished = true;
    return time;
  });
  video.present(0.2); // A presentation queued before this seek does not belong to it.
  await new Promise((resolve) => setTimeout(resolve, 0));
  expect(finished).toBe(false); // seeked alone still exposes the old decoded picture.
  video.present(29 / 30);
  expect(await pending).toBeCloseTo(29 / 30, 8);
  expect(video.callbacks.size).toBe(0);
  const lowRate = seekPresented(video, 2);
  await Promise.resolve();
  video.present(1.25); // A valid long-duration VFR frame can begin far before the seek time.
  expect(await lowRate).toBe(1.25);
  expect(await seekPresented(video, 2)).toBe(1.25);
  const controller = new AbortController();
  const canceled = seekPresented(video, 3, { signal: controller.signal });
  controller.abort();
  await expect(canceled).rejects.toMatchObject({ name: "AbortError" });
  expect(video.callbacks.size).toBe(0);
});

test("an identical seek reuses presentation after the browser rounds its position", async () => {
  const { seekPresented } = await import("../src/video3d/extract.js");
  class Video extends EventTarget {
    src = "first.mp4";
    readyState = 2;
    seeking = false;
    seeks = 0;
    callbacks = new Map();
    next = 0;
    requestVideoFrameCallback(fn) {
      this.callbacks.set(++this.next, fn);
      return this.next;
    }
    cancelVideoFrameCallback(id) {
      this.callbacks.delete(id);
    }
    set currentTime(value) {
      this.seeks++;
      this.time = value === 2.01 ? 2.009999 : value;
      this.seeking = true;
      queueMicrotask(() => {
        this.dispatchEvent(new Event("seeking"));
        this.seeking = false;
        this.dispatchEvent(new Event("seeked"));
      });
    }
    get currentTime() {
      return this.time;
    }
    present(mediaTime) {
      const callbacks = [...this.callbacks.values()];
      this.callbacks.clear();
      callbacks.forEach((fn) => fn(0, { mediaTime }));
    }
  }
  const video = new Video();
  const first = seekPresented(video, 2.01);
  await Promise.resolve();
  video.present(2);
  expect(await first).toBe(2);
  expect(video.currentTime).toBe(2.009999);
  expect(await seekPresented(video, 2.01, { timeoutMs: 20 })).toBe(2);
  expect(video.seeks).toBe(1);
  expect(video.callbacks.size).toBe(0);
  video.src = "second.mp4";
  const changedSource = seekPresented(video, 2.01);
  await Promise.resolve();
  video.present(1.25);
  expect(await changedSource).toBe(1.25);
  expect(video.seeks).toBe(2);
});
