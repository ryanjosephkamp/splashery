// MIT. Made by Ryan with Codex (GPT-6). Real local video decode with optional APIs removed.
import { test, expect } from "@playwright/test";

test.use({
  launchOptions: {
    executablePath: process.env.SPLASHERY_CHROMIUM || "/usr/bin/chromium",
    args: ["--disable-gpu"],
  },
});

test("a changed seek waits for its own seeked event when seeking starts asynchronously", async () => {
  const { seek } = await import("../src/video3d/extract.js");
  class Video extends EventTarget {
    readyState = 2;
    seeking = false;
    position = 0;
    get currentTime() {
      return this.position;
    }
    set currentTime(time) {
      this.position = time;
      queueMicrotask(() => {
        this.seeking = true;
        this.dispatchEvent(new Event("seeking"));
      });
    }
  }
  const video = new Video();
  let finished = false;
  const pending = seek(video, 1).then(() => {
    finished = true;
  });
  await Promise.resolve();
  expect(finished).toBe(false);
  video.seeking = false;
  video.dispatchEvent(new Event("loadeddata")); // An initial picture is not this seek's completion.
  await Promise.resolve();
  expect(finished).toBe(false);
  video.dispatchEvent(new Event("seeked"));
  await pending;
  expect(finished).toBe(true);
});

for (const missing of ["VideoFrame", "requestVideoFrameCallback", "both"]) {
  test(`real sample feedback and training frames survive missing ${missing}`, async ({ page }) => {
    const errors = [];
    page.on("pageerror", (error) => errors.push(error.message));
    await page.goto("/tests/fixtures/v3d/");
    const results = await page.evaluate(async (missing) => {
      const { checkVideo } = await import("/src/video3d/suitability.js");
      const { openVideo, closeVideo, grabFrames } = await import("/src/video3d/extract.js");
      const { planFrames } = await import("/src/video3d/frames.js");
      const vf = globalThis.VideoFrame;
      const rvfc = HTMLVideoElement.prototype.requestVideoFrameCallback;
      const cancel = HTMLVideoElement.prototype.cancelVideoFrameCallback;
      const results = [];
      for (const id of ["liberty", "edinburgh", "adjara", "lihula", "toolse", "poltsamaa"]) {
        globalThis.VideoFrame = vf;
        HTMLVideoElement.prototype.requestVideoFrameCallback = rvfc;
        HTMLVideoElement.prototype.cancelVideoFrameCallback = cancel;
        const blob = await (await fetch(`/assets/toys/video-3d/${id}-source.webm`)).blob();
        const file = new File([blob], `${id}.webm`, { type: "video/webm" });
        const modern = await checkVideo(file, { length: 20 });
        if (missing !== "requestVideoFrameCallback") globalThis.VideoFrame = undefined;
        if (missing !== "VideoFrame") {
          HTMLVideoElement.prototype.requestVideoFrameCallback = undefined;
          HTMLVideoElement.prototype.cancelVideoFrameCallback = undefined;
        }
        const older = await checkVideo(file, { length: 20 });
        const opened = await openVideo(file);
        try {
          const frames = await grabFrames(
            opened,
            planFrames({ duration: opened.duration, length: 2, maxFrames: 3 }),
            { side: 128, tries: 1 },
          );
          results.push({
            id,
            modern,
            older,
            frames: frames.map((f) => ({
              time: f.time,
              presentedTime: f.presentedTime,
              bytes: f.blob.size,
              sharpness: f.sharpness,
            })),
          });
        } finally {
          closeVideo(opened);
        }
      }
      return results;
    }, missing);
    expect(results).toHaveLength(6);
    for (const { id, modern, older, frames } of results) {
      expect(modern.checked, id).toBe(true);
      // Separate decodes may land on adjacent source frames. The compatibility contract
      // is the same suitability answer and advice, not identical floating-point metrics.
      const answer = ({ checked, verdict, message, reasons, duration, start, end }) => ({
        checked,
        verdict,
        message,
        reasons,
        duration,
        start,
        end,
      });
      expect(answer(older), id).toEqual(answer(modern));
      expect(older.metrics.frames, id).toBe(12);
      expect(frames, id).toHaveLength(3);
      for (const frame of frames) {
        expect(frame.bytes, id).toBeGreaterThan(100);
        expect(frame.sharpness, id).toBeGreaterThan(0);
        expect(Number.isFinite(frame.time), id).toBe(true);
        if (missing === "both") expect(frame.presentedTime, id).toBeNull();
      }
    }
    expect(errors).toEqual([]);
  });
}

test("canceling a suitability paint wait releases its callback without newer frame APIs", async ({
  page,
}) => {
  const errors = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await page.goto("/tests/fixtures/v3d/");
  const result = await page.evaluate(async () => {
    globalThis.VideoFrame = undefined;
    HTMLVideoElement.prototype.requestVideoFrameCallback = undefined;
    const { checkVideo } = await import("/src/video3d/suitability.js");
    const blob = await (await fetch("/assets/toys/video-3d/toolse-source.webm")).blob();
    const controller = new AbortController();
    let requested = 0,
      canceled = 0;
    globalThis.requestAnimationFrame = () => {
      requested++;
      queueMicrotask(() => controller.abort());
      return 42;
    };
    globalThis.cancelAnimationFrame = (id) => {
      if (id === 42) canceled++;
    };
    let error;
    try {
      await checkVideo(new File([blob], "toolse.webm"), { signal: controller.signal });
    } catch (failure) {
      error = failure.name;
    }
    return { error, requested, canceled };
  });
  expect(result).toEqual({ error: "AbortError", requested: 1, canceled: 1 });
  expect(errors).toEqual([]);
});
