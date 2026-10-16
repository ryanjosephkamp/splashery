// MIT. Made by Ryan with Codex (GPT-6). Source intervals, evidence, and fallback controls.
import { test, expect } from "@playwright/test";
import { seekPicture } from "../src/video3d/extract.js";
const original = Object.getOwnPropertyDescriptor(globalThis, "VideoFrame");
test.afterEach(() => {
  if (original) Object.defineProperty(globalThis, "VideoFrame", original);
  else delete globalThis.VideoFrame;
});
class Video extends EventTarget {
  src = "local-source.mp4";
  readyState = 2;
  paused = true;
  seeking = false;
  decodedTime = 0.3;
  duration = 0.05;
  closed = 0;
  next = 0;
  callbacks = new Map();
  seeks = 0;
  set currentTime(time) {
    this.position = time;
    this.seeks++;
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
  requestVideoFrameCallback(callback) {
    this.callbacks.set(++this.next, callback);
    return this.next;
  }
  cancelVideoFrameCallback(id) {
    this.callbacks.delete(id);
  }
  present(time) {
    const callbacks = [...this.callbacks.values()];
    this.callbacks.clear();
    callbacks.forEach((callback) =>
      callback(performance.now(), { mediaTime: time, presentationTime: performance.now() }),
    );
  }
}
function decodedFrames() {
  globalThis.VideoFrame = class {
    constructor(video) {
      this.video = video;
      this.timestamp = video.decodedTime * 1e6;
      this.duration = video.duration == null ? video.duration : video.duration * 1e6;
    }
    close() {
      this.video.closed++;
    }
  };
}
const turn = () => new Promise((resolve) => setTimeout(resolve, 0));

test("a paused decoded source interval records the actual captured picture time", async () => {
  decodedFrames();
  const video = new Video();
  expect(await seekPicture(video, 0.333)).toEqual({
    time: 0.3,
    decodedTime: 0.3,
    presentedTime: 0.3,
  });
  expect(video.closed).toBe(1);
  expect(video.seeks).toBe(1);
  expect(video.currentTime).toBe(0.333);
});

test("a stale decoded interval cannot satisfy a later seek", async () => {
  decodedFrames();
  const video = new Video();
  let finished = false;
  const pending = seekPicture(video, 2, { timeoutMs: 200 }).then((value) => {
    finished = true;
    return value;
  });
  await turn();
  expect(finished).toBe(false);
  video.decodedTime = 1.25;
  video.present(1.25);
  expect(await pending).toEqual({ time: 1.25, decodedTime: null, presentedTime: 1.25 });
  expect(video.closed).toBe(2);
  expect(video.callbacks.size).toBe(0);
});

test("a missing source duration falls back to an actual presentation", async () => {
  decodedFrames();
  const video = new Video();
  video.duration = null;
  let finished = false;
  const pending = seekPicture(video, 0.333, { timeoutMs: 200 }).then((value) => {
    finished = true;
    return value;
  });
  await turn();
  expect(finished).toBe(false);
  video.present(0.3);
  expect(await pending).toEqual({ time: 0.3, decodedTime: null, presentedTime: 0.3 });
  expect(video.closed).toBe(2);
});

test("source interval ends are exclusive and do not invent a frame at the next boundary", async () => {
  decodedFrames();
  const video = new Video();
  video.decodedTime = 0.25;
  video.duration = 0.125;
  let finished = false;
  const pending = seekPicture(video, 0.375, { timeoutMs: 200 }).then((value) => {
    finished = true;
    return value;
  });
  await turn();
  expect(finished).toBe(false);
  video.decodedTime = 0.375;
  video.present(0.375);
  expect((await pending).presentedTime).toBe(0.375);
  expect(video.closed).toBe(2);
});

test("unsupported decoded-picture construction retains the bounded presentation fallback", async () => {
  globalThis.VideoFrame = class {
    constructor() {
      throw new TypeError("Unsupported source");
    }
  };
  const video = new Video(),
    pending = seekPicture(video, 0.333, { timeoutMs: 200 });
  await turn();
  video.present(0.4);
  expect(await pending).toEqual({ time: 0.4, decodedTime: null, presentedTime: 0.4 });
});

test("a canceled picture request never seeks or allocates a decoded frame", async () => {
  decodedFrames();
  const video = new Video(),
    controller = new AbortController();
  controller.abort();
  await expect(seekPicture(video, 0.333, { signal: controller.signal })).rejects.toMatchObject({
    name: "AbortError",
  });
  expect(video.seeks).toBe(0);
  expect(video.closed).toBe(0);
});

test("a decoded picture takes playback ownership from an older pending recovery", async () => {
  decodedFrames();
  const { seekPresented } = await import("../src/video3d/extract.js");
  const video = new Video(),
    controller = new AbortController();
  video.playbackRate = 1.5;
  let finishPlayback;
  let plays = 0;
  video.play = () => {
    plays++;
    video.paused = false;
    return new Promise((resolve) => {
      finishPlayback = resolve;
    });
  };
  video.pause = () => {
    video.paused = true;
  };
  const old = seekPresented(video, 0.333, { signal: controller.signal, timeoutMs: 1000 });
  await expect.poll(() => plays).toBe(1);
  video.decodedTime = 0.9;
  expect(await seekPicture(video, 0.91)).toEqual({
    time: 0.9,
    decodedTime: 0.9,
    presentedTime: 0.9,
  });
  expect(video.playbackRate).toBe(1.5);
  video.playbackRate = 0.75;
  finishPlayback();
  await Promise.resolve();
  controller.abort();
  await expect(old).rejects.toMatchObject({ name: "AbortError" });
  expect(video.playbackRate).toBe(0.75);
  expect(video.paused).toBe(true);
  expect(video.callbacks.size).toBe(0);
});
