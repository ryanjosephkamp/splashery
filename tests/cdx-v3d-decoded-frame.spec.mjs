// MIT. Made by Ryan with Codex (GPT-6). Event-order and decoded-frame ownership controls.
import { test, expect } from "@playwright/test";
import { seekPresented } from "../src/video3d/extract.js";

const original = Object.getOwnPropertyDescriptor(globalThis, "VideoFrame");
test.afterEach(() => {
  if (original) Object.defineProperty(globalThis, "VideoFrame", original);
  else delete globalThis.VideoFrame;
});
class Video extends EventTarget {
  src = "local-decoded-frame.webm";
  readyState = 2;
  seeking = false;
  paused = true;
  callbacks = new Map();
  next = 0;
  decodedTime = 0;
  closed = 0;
  set currentTime(value) {
    this.position = value;
    this.seeking = true;
    queueMicrotask(() => this.dispatchEvent(new Event("seeking")));
  }
  get currentTime() {
    return this.position;
  }
  settle() {
    this.seeking = false;
    this.dispatchEvent(new Event("seeked"));
  }
  requestVideoFrameCallback(callback) {
    this.callbacks.set(++this.next, callback);
    return this.next;
  }
  cancelVideoFrameCallback(id) {
    this.callbacks.delete(id);
  }
  present(mediaTime, presentationTime) {
    const callbacks = [...this.callbacks.values()];
    this.callbacks.clear();
    callbacks.forEach((callback) => callback(performance.now(), { mediaTime, presentationTime }));
  }
}
function decodedFrames() {
  globalThis.VideoFrame = class {
    constructor(video) {
      this.video = video;
      this.timestamp = video.decodedTime * 1e6;
    }
    close() {
      this.video.closed++;
    }
  };
}
const turn = () => new Promise((resolve) => setTimeout(resolve, 0));

test("a queued presentation matching the actual decoded picture avoids advancing past it", async () => {
  decodedFrames();
  const video = new Video(),
    pending = seekPresented(video, 0.333, { timeoutMs: 80 });
  await Promise.resolve();
  const presentedAt = performance.now();
  await turn();
  video.settle();
  video.decodedTime = 0.3;
  video.present(0.3, presentedAt);
  expect(await pending).toBe(0.3);
  expect(video.closed).toBe(1);
  expect(video.callbacks.size).toBe(0);
});

test("a decoded picture can confirm a callback before seeked while the seek still must finish", async () => {
  decodedFrames();
  const video = new Video();
  let finished = false;
  const pending = seekPresented(video, 0.333, { timeoutMs: 80 }).then((value) => {
    finished = true;
    return value;
  });
  await Promise.resolve();
  video.seeking = false;
  video.decodedTime = 0.3;
  video.present(0.3, performance.now());
  await turn();
  expect(finished).toBe(false);
  video.settle();
  expect(await pending).toBe(0.3);
  expect(video.closed).toBe(1);
});

test("a stale callback cannot label a different decoded picture, and both frames are released", async () => {
  decodedFrames();
  const video = new Video();
  let finished = false;
  const pending = seekPresented(video, 2, { timeoutMs: 200 }).then((value) => {
    finished = true;
    return value;
  });
  await Promise.resolve();
  const queuedAt = performance.now();
  await turn();
  video.settle();
  video.decodedTime = 1.25;
  video.present(0, queuedAt);
  await turn();
  expect(finished).toBe(false);
  video.present(1.25, queuedAt);
  expect(await pending).toBe(1.25);
  expect(video.closed).toBe(2);
});

test("unsupported decoded-frame construction keeps the original presentation guard and deadline", async () => {
  globalThis.VideoFrame = class {
    constructor() {
      throw new TypeError("Unsupported source");
    }
  };
  const video = new Video(),
    pending = seekPresented(video, 1, { timeoutMs: 40 });
  await Promise.resolve();
  const queuedAt = performance.now();
  await turn();
  video.settle();
  video.present(0, queuedAt);
  await expect(pending).rejects.toThrow(/decoded video frame took too long/);
  expect(video.callbacks.size).toBe(0);
});

test("even a fresh callback must match an available decoded-picture timestamp", async () => {
  decodedFrames();
  const video = new Video();
  let finished = false;
  const pending = seekPresented(video, 2, { timeoutMs: 200 }).then((value) => {
    finished = true;
    return value;
  });
  await Promise.resolve();
  video.settle();
  video.decodedTime = 1.5;
  video.present(1.25, performance.now());
  await turn();
  expect(finished).toBe(false);
  video.present(1.5, performance.now());
  expect(await pending).toBe(1.5);
  expect(video.closed).toBe(2);
});

test("an unreadable decoded timestamp releases its frame and retains the conservative fallback", async () => {
  globalThis.VideoFrame = class {
    constructor(video) {
      this.video = video;
    }
    get timestamp() {
      throw new TypeError("Timestamp unavailable");
    }
    close() {
      this.video.closed++;
    }
  };
  const video = new Video(),
    pending = seekPresented(video, 1, { timeoutMs: 80 });
  await Promise.resolve();
  video.settle();
  video.present(0.9, performance.now());
  expect(await pending).toBe(0.9);
  expect(video.closed).toBe(1);
});
