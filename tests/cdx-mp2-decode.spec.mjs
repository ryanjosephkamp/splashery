import { test, expect } from "@playwright/test";
import * as moving from "../src/packs/moving-photo.js";

class DelayedPicture extends EventTarget {
  constructor() {
    super();
    this.time = 0;
    this.seeking = false;
    this.next = 1;
    this.callbacks = new Map();
    this.canceled = 0;
  }
  get currentTime() {
    return this.time;
  }
  set currentTime(time) {
    this.time = time;
    this.seeking = true;
  }
  requestVideoFrameCallback(callback) {
    const id = this.next++;
    this.callbacks.set(id, callback);
    return id;
  }
  cancelVideoFrameCallback(id) {
    this.callbacks.delete(id);
    this.canceled++;
  }
  seeked() {
    this.seeking = false;
    this.dispatchEvent(new Event("seeked"));
  }
  picture(presentationTime = performance.now(), mediaTime = this.time) {
    const callbacks = [...this.callbacks.values()];
    this.callbacks.clear();
    for (const callback of callbacks) callback(performance.now(), { mediaTime, presentationTime });
  }
}

test("clip extraction waits for the presented picture after seek completion", async () => {
  const video = new DelayedPicture();
  let readable = false;
  const done = moving.seekClipFrame(video, 0.5).then(() => {
    readable = true;
  });
  video.seeked();
  await Promise.resolve();
  expect(readable).toBe(false);
  video.picture();
  await done;
  expect(readable).toBe(true);
  expect(video.callbacks.size).toBe(0);
});

test("a queued old presentation cannot satisfy a newer clip seek", async () => {
  const video = new DelayedPicture();
  let readable = false;
  const done = moving.seekClipFrame(video, 0.75).then(() => {
    readable = true;
  });
  video.picture(performance.now(), 0);
  video.seeked();
  video.picture(performance.now() - 1000);
  await Promise.resolve();
  expect(readable).toBe(false);
  video.picture();
  await done;
  expect(readable).toBe(true);
});

test("canceling clip extraction releases its pending video-frame callback", async () => {
  const video = new DelayedPicture();
  let canceled = false;
  const done = moving.seekClipFrame(video, 1, () => canceled);
  canceled = true;
  video.seeked();
  video.picture();
  await expect(done).rejects.toThrow(/canceled/);
  expect(video.callbacks.size).toBe(0);
  expect(video.canceled).toBe(1);
});

test("a presented target may arrive before the seeked event once seeking has ended", async () => {
  const video = new DelayedPicture();
  let readable = false;
  const done = moving.seekClipFrame(video, 1.5).then(() => {
    readable = true;
  });
  video.seeking = false;
  video.picture();
  await Promise.resolve();
  expect(readable).toBe(false);
  video.seeked();
  await done;
  expect(readable).toBe(true);
});

test("a rejected seek releases the registered frame callback", async () => {
  const video = new DelayedPicture();
  Object.defineProperty(video, "currentTime", {
    get: () => 0,
    set: () => {
      throw new Error("Seek rejected");
    },
  });
  await expect(moving.seekClipFrame(video, 2)).rejects.toThrow("Seek rejected");
  expect(video.callbacks.size).toBe(0);
  expect(video.canceled).toBe(1);
});

test("a paused seek with no later compositor callback completes after paint cycles", async () => {
  const video = new DelayedPicture();
  let readable = false;
  const done = moving.seekClipFrame(video, 2).then(() => {
    readable = true;
  });
  video.picture(); // The decoder presented while seeking was still true.
  video.seeked();
  await Promise.resolve();
  expect(readable).toBe(false);
  await done;
  expect(readable).toBe(true);
  expect(video.callbacks.size).toBe(0);
});

test("a browser without compositor callbacks also waits for paint cycles", async () => {
  const video = new DelayedPicture();
  video.requestVideoFrameCallback = undefined;
  let readable = false;
  const done = moving.seekClipFrame(video, 2).then(() => {
    readable = true;
  });
  video.seeked();
  await Promise.resolve();
  expect(readable).toBe(false);
  await done;
  expect(readable).toBe(true);
});
