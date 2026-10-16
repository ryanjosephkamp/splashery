import { test, expect } from "@playwright/test";

class Video extends EventTarget {
  paused = true;
  readyState = 2;
  seeking = false;
  playbackRate = 1.5;
  callbacks = new Map();
  next = 0;
  rates = [];
  requestVideoFrameCallback(fn) {
    this.callbacks.set(++this.next, fn);
    return this.next;
  }
  cancelVideoFrameCallback(id) {
    this.callbacks.delete(id);
  }
  set currentTime(t) {
    this.position = t;
    this.seeking = true;
    queueMicrotask(() => {
      this.dispatchEvent(new Event("seeking"));
      this.seeking = false;
      this.dispatchEvent(new Event("seeked"));
    });
  }
  get currentTime() {
    return this.position;
  }
  async play() {
    this.rates.push(this.playbackRate);
    this.paused = false;
  }
  pause() {
    this.paused = true;
  }
  present(mediaTime) {
    const pending = [...this.callbacks.values()];
    this.callbacks.clear();
    pending.forEach((fn) =>
      fn(performance.now(), { mediaTime, presentationTime: performance.now() }),
    );
  }
}

test("recovery slows playback until the presented picture is captured and restores the caller's rate", async () => {
  const { seekPresented } = await import("../src/video3d/extract.js");
  const video = new Video();
  const pending = seekPresented(video, 0.333, { timeoutMs: 1000 });
  await expect.poll(() => video.rates.length).toBe(1);
  video.present(0.4);
  expect(await pending).toBe(0.4);
  expect(video.rates).toEqual([0.125]);
  expect(video.playbackRate).toBe(1.5);
  expect(video.paused).toBe(true);
  expect(video.callbacks.size).toBe(0);
});

test("cancellation restores the recovery rate and clears the pending presentation", async () => {
  const { seekPresented } = await import("../src/video3d/extract.js");
  const video = new Video(),
    controller = new AbortController();
  const pending = seekPresented(video, 0.333, { signal: controller.signal, timeoutMs: 1000 });
  await expect.poll(() => video.rates.length).toBe(1);
  controller.abort();
  await expect(pending).rejects.toMatchObject({ name: "AbortError" });
  expect(video.rates).toEqual([0.125]);
  expect(video.playbackRate).toBe(1.5);
  expect(video.paused).toBe(true);
  expect(video.callbacks.size).toBe(0);
});

test("a host speed change during recovery remains authoritative", async () => {
  const { seekPresented } = await import("../src/video3d/extract.js");
  const video = new Video();
  const pending = seekPresented(video, 0.333, { timeoutMs: 1000 });
  await expect.poll(() => video.rates.length).toBe(1);
  video.playbackRate = 0.75;
  video.present(0.4);
  await pending;
  expect(video.playbackRate).toBe(0.75);
  expect(video.paused).toBe(true);
});

test("a canceled older recovery cannot change the newer seek's speed or playback", async () => {
  const { seekPresented } = await import("../src/video3d/extract.js");
  const video = new Video(),
    firstController = new AbortController();
  let finishFirstPlay;
  video.play = () => {
    video.rates.push(video.playbackRate);
    video.paused = false;
    return video.rates.length === 1
      ? new Promise((resolve) => {
          finishFirstPlay = resolve;
        })
      : Promise.resolve();
  };
  const first = seekPresented(video, 0.333, { signal: firstController.signal, timeoutMs: 1000 });
  await expect.poll(() => video.rates.length).toBe(1);
  const second = seekPresented(video, 0.9, { timeoutMs: 1000 });
  await expect.poll(() => video.rates.length).toBe(2);
  firstController.abort();
  await expect(first).rejects.toMatchObject({ name: "AbortError" });
  finishFirstPlay();
  await Promise.resolve();
  expect(video.playbackRate).toBe(0.125);
  expect(video.paused).toBe(false);
  video.present(0.95);
  expect(await second).toBe(0.95);
  expect(video.playbackRate).toBe(1.5);
  expect(video.paused).toBe(true);
  expect(video.callbacks.size).toBe(0);
});
