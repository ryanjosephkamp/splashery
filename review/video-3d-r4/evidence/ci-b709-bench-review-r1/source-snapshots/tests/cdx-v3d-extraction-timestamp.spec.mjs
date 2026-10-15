// MIT. Made by Ryan with Codex (GPT-6). CPU event-order controls, not a decoder simulation.
import { test, expect } from "@playwright/test";
import { seekPresented } from "../src/video3d/extract.js";

class Video extends EventTarget {
  src = "local-fixture.webm";
  readyState = 2;
  seeking = false;
  paused = true;
  callbacks = new Map();
  next = 0;
  seeks = 0;
  plays = 0;
  pauses = 0;
  position = 0;
  set currentTime(value) {
    this.seeks++;
    this.position = value;
    this.seeking = true;
    queueMicrotask(() => this.dispatchEvent(new Event("seeking")));
  }
  get currentTime() {
    return this.position;
  }
  settleSeek() {
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
  present(mediaTime, presentationTime = performance.now()) {
    const callbacks = [...this.callbacks.values()];
    this.callbacks.clear();
    callbacks.forEach((callback) => callback(performance.now(), { mediaTime, presentationTime }));
  }
  pause() {
    this.paused = true;
    this.pauses++;
  }
}
const turn = () => new Promise((resolve) => setTimeout(resolve, 0));

test("an initial RVFC after seeking but before seeked cannot label the new photograph", async () => {
  const video = new Video();
  let finished = false;
  const pending = seekPresented(video, 0.333).then((time) => {
    finished = true;
    return time;
  });
  await Promise.resolve();
  video.present(0); // The initial frame's callback arrives after this seek began.
  video.settleSeek(); // drawImage may now see the newly sought .333 picture.
  await turn();
  expect(finished).toBe(false);
  video.present(0.333);
  expect(await pending).toBe(0.333);
  expect(video.callbacks.size).toBe(0);
});

test("a queued old presentation delivered after seeked is rejected without a VFR proximity cutoff", async () => {
  const video = new Video();
  let finished = false;
  const pending = seekPresented(video, 2).then((time) => {
    finished = true;
    return time;
  });
  await Promise.resolve();
  const queuedAt = performance.now();
  await turn();
  video.settleSeek();
  video.present(0, queuedAt);
  await turn();
  expect(finished).toBe(false);
  video.present(1.25); // A fresh long-duration frame can begin well before the requested time.
  expect(await pending).toBe(1.25);
  expect(await seekPresented(video, 2, { timeoutMs: 20 })).toBe(1.25);
  expect(video.seeks).toBe(1);
  expect(video.callbacks.size).toBe(0);
});

test("a picture presented before seeked uses bounded real-frame recovery instead of a stale timestamp", async () => {
  const video = new Video();
  video.play = async () => {
    video.plays++;
    video.paused = false;
    queueMicrotask(() => video.present(0.4));
  };
  const pending = seekPresented(video, 0.333, { timeoutMs: 2000 });
  await Promise.resolve();
  video.present(0.333);
  video.settleSeek();
  expect(await pending).toBe(0.4);
  expect(video.plays).toBe(1);
  expect(video.paused).toBe(true);
  expect(video.callbacks.size).toBe(0);
});

test("cancellation after a discarded presentation cleans callbacks and cannot cache its time", async () => {
  const video = new Video(),
    controller = new AbortController(),
    pending = seekPresented(video, 0.333, { signal: controller.signal });
  await Promise.resolve();
  video.present(0);
  controller.abort();
  await expect(pending).rejects.toMatchObject({ name: "AbortError" });
  expect(video.callbacks.size).toBe(0);
  video.settleSeek();
  const retry = seekPresented(video, 0.333);
  await Promise.resolve();
  video.settleSeek();
  video.present(0.333);
  expect(await retry).toBe(0.333);
  expect(video.seeks).toBe(2);
});

test("no fresh terminal presentation fails at the original bound rather than inventing a timestamp", async () => {
  const video = new Video(),
    pending = seekPresented(video, 1.99, { timeoutMs: 40 });
  await Promise.resolve();
  video.present(0);
  video.settleSeek();
  await expect(pending).rejects.toThrow(/decoded video frame took too long/);
  expect(video.callbacks.size).toBe(0);
});
