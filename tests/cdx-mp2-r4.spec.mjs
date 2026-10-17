import { test, expect } from "@playwright/test";
import fs from "node:fs/promises";
import { openRender, renderFrame } from "../tools/cdx-mp2-render.mjs";

import { android, watchPictures, chosenPicture } from "./cdx-mp2-r4-helpers.mjs";

test("the accelerated and fallback reliefs render the same solid picture", async ({ page }) => {
  test.setTimeout(240_000);
  const images = [];
  for (const fallback of [true, false]) {
    if (fallback) await page.route("**/clip-geometry.wasm", (route) => route.abort());
    else await page.unroute("**/clip-geometry.wasm");
    await openRender(page, { id: "bridge" });
    const frames = [];
    for (const time of [0.015625, 4.203125]) {
      const result = await renderFrame(page, time, { evidence: true });
      expect(result.holes).toBe(0);
      expect(result.edgeSpecks).toBe(0);
      frames.push(result.picture);
    }
    images.push(frames);
  }
  expect(images[1]).toEqual(images[0]);
});

test("a video with non-square source pixels keeps its native picture after pausing", async ({
  page,
}) => {
  test.setTimeout(180000);
  await openRender(page, { id: "sample-long", stepped: true, bindNativePicture: true });
  await page.evaluate(() => {
    delete window.__mp3BindNative;
    const mesh = window.__mp3BoundMesh,
      video = window.__mp3.MOVING.clip.video;
    // Start with real native video storage, as a live decoder can provide.
    mesh.color.destroy();
    mesh.color = null;
    mesh.setColor(video);
  });
  const errors = [];
  page.on("console", (m) => {
    if (/GL_INVALID|shader.*error/i.test(m.text())) errors.push(m.text());
  });
  const result = await renderFrame(page, 0.25, { verifyDepth: true, sourceWitness: true });
  expect(result.sourcePixelsVerified).toBe(true);
  expect(result.holes).toBe(0);
  expect(result.edgeSpecks).toBe(0);
  expect(errors).toEqual([]);
});

test("retiring a live video stream closes its transferred frames before stopping workers", async ({
  page,
  context,
}) => {
  test.setTimeout(120000);
  const warnings = [];
  page.on("console", (m) => {
    if (/VideoFrame.*(?:garbage collected|without being closed)/i.test(m.text()))
      warnings.push(m.text());
  });
  await page.goto("/?renderer=webgl2&adapt=off&profile=low&labs=1");
  await page.waitForSelector("body[data-ready='true']");
  await watchPictures(page);
  await page.evaluate(() => window.__splashery.app.setToyOptions({ clip: "sample-long" }));
  await page.waitForFunction(() => !window.__splashery.player.loading);
  await page.evaluate(() => window.__splashery.app.setControl("play", 1));
  await page.waitForFunction(() => window.__r4Mesh?.clipStream?.stats.submitted >= 2);
  await page.evaluate(() => {
    window.__r4Retiring = window.__r4Mesh.clipStream;
    window.__r4Retiring.close();
    window.__splashery.app.setControl("play", 0);
  });
  await page.waitForFunction(() => window.__r4Retiring.stats.retired === 2);
  await (await context.newCDPSession(page)).send("HeapProfiler.collectGarbage");
  const stats = await page.evaluate(() => window.__r4Retiring.stats);
  expect(stats.error).toBeUndefined();
  expect(stats.framesClosed).toBe(stats.submitted);
  expect(warnings).toEqual([]);
});

test("baked long depth answers meet the exact source times used by their baker", async ({
  page,
}) => {
  test.setTimeout(180000);
  await openRender(page, { id: "sample-long", stepped: true });
  const checks = await page.evaluate(async () => {
    const m = window.__mp3,
      c = m.MOVING.clip,
      D = c.depth,
      { guidedDepth } = await import("/src/packs/moving-photo-depth.js");
    const checks = [];
    for (const i of [1, 48]) {
      const time = i / D.rate;
      await m.seekClipFrame(c.video, time);
      const actual = c.shownDepth(time),
        expected = guidedDepth(
          Float32Array.from(D.frames[i], (value) => value / 255),
          D.ms.w,
          D.ms.h,
          c.scratch.colors,
          c.w,
          c.h,
        );
      checks.push({
        offset: D.offset,
        frame: i,
        mismatches: expected.reduce(
          (count, value, p) => count + (Math.round(value * 255) !== actual[p]),
          0,
        ),
      });
    }
    return checks;
  });
  expect(checks).toEqual([
    { offset: 0, frame: 1, mismatches: 0 },
    { offset: 0, frame: 48, mismatches: 0 },
  ]);
});

test("a shared playing video keeps its own picture clock through audio latency and pause", async ({
  page,
}) => {
  test.setTimeout(180000);
  await page.goto("/?renderer=webgl2&adapt=off&profile=low&labs=1");
  await page.waitForSelector("body[data-ready='true']");
  await watchPictures(page);
  await page.mouse.click(5, 180);
  await page.evaluate(() => {
    const track = window.__r4Moving.MOVING.clip.audio.track;
    // Controlled output buffering exercises the real media-clock decision.
    // It is not a measurement of this machine's physical audio latency.
    track.latency = () => 0.18;
    window.__splashery.app.setControl("play", 1);
  });
  await page.waitForFunction(() => window.__r4Moving.MOVING.clip.video.currentTime > 0.6);
  const result = await page.evaluate(async () => {
    const m = window.__r4Moving,
      c = m.MOVING.clip,
      video = c.video;
    m.MOVING_PHOTO.drive(0, { play: 1 }, {}, { time: 0 });
    const liveDifference = Math.abs(video.currentTime - m.MOVING.t),
      beforePause = video.currentTime;
    window.__splashery.app.setControl("play", 0);
    m.MOVING_PHOTO.drive(0, { play: 0 }, {}, { time: 0 });
    if (video.seeking)
      await new Promise((resolve) => video.addEventListener("seeked", resolve, { once: true }));
    return {
      shared: c.audio.track.el === video,
      liveDifference,
      pauseRewind: Math.max(0, beforePause - video.currentTime),
    };
  });
  expect(result.shared).toBe(true);
  expect(result.liveDifference).toBeLessThan(0.02);
  expect(result.pauseRewind).toBeLessThan(0.02);
});

test("two paused source times inside one retained frame upload their own interpolated depth", async ({
  page,
}) => {
  test.setTimeout(180000);
  await openRender(page, { id: "sample-long", stepped: true });
  await page.evaluate(() => {
    const c = window.__mp3.MOVING.clip,
      D = c.depth,
      per = D.ms.w * D.ms.h;
    c.depth = {
      ...D,
      n: 3,
      ready: 3,
      done: 3,
      frames: [new Uint8Array(per), new Uint8Array(per).fill(255), new Uint8Array(per).fill(255)],
    };
  });
  const values = [];
  for (const time of [0.001, 0.02]) {
    const result = await renderFrame(page, time, { verifyDepth: true });
    expect(result.depthPixelsVerified).toBe(true);
    values.push(
      await page.evaluate(() => ({
        frame: window.__mp3.MOVING.frame,
        value: window.__mp3.MOVING.clip.scratch.bytes[0],
      })),
    );
  }
  expect(values[0].frame).toBe(0);
  expect(values[1].frame).toBe(0);
  expect(values[1].value - values[0].value).toBeGreaterThan(20);
});

test("a delayed frame callback cannot relabel a frozen native picture with an older clock", async ({
  page,
}) => {
  test.setTimeout(180000);
  await page.goto("/?renderer=webgl2&adapt=off&profile=low&labs=1");
  await page.waitForSelector("body[data-ready='true']");
  await watchPictures(page);
  await page.evaluate(() => window.__splashery.app.setToyOptions({ clip: "sample-long" }));
  await page.waitForFunction(() => !window.__splashery.player.loading);
  await page.evaluate(async () => {
    const m = window.__r4Moving,
      c = m.MOVING.clip,
      video = c.video,
      callback = HTMLVideoElement.prototype.requestVideoFrameCallback,
      post = Worker.prototype.postMessage;
    window.__r4SnapshotClocks = [];
    m.MOVING.t = 0.75;
    m.MOVING.frame = m.frameAt(c, 0.75);
    await m.seekClipFrame(video, 0.75);
    HTMLVideoElement.prototype.requestVideoFrameCallback = function (f) {
      return callback.call(this, (now, metadata) => f(now, { ...metadata, mediaTime: 0 }));
    };
    Worker.prototype.postMessage = function (data, ...rest) {
      if (data.frame instanceof VideoFrame) {
        const reference = new VideoFrame(video);
        window.__r4SnapshotClocks.push({
          packet: data.time,
          native: reference.timestamp / 1e6,
        });
        reference.close();
      }
      return post.call(this, data, ...rest);
    };
    window.__splashery.app.setControl("play", 1);
  });
  await page.waitForFunction(() => window.__r4SnapshotClocks.length >= 3);
  const clocks = await page.evaluate(() => {
    window.__splashery.app.setControl("play", 0);
    return window.__r4SnapshotClocks;
  });
  expect(clocks.length).toBeGreaterThanOrEqual(3);
  expect(clocks.every((clock) => Math.abs(clock.packet - clock.native) < 0.05)).toBe(true);
});
