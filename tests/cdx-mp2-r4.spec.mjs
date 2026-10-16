import { test, expect } from "@playwright/test";
import fs from "node:fs/promises";
import { openRender, renderFrame } from "../tools/cdx-mp2-render.mjs";

const android =
  "Mozilla/5.0 (Linux; Android 14; Pixel 7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/141.0.0.0 Mobile Safari/537.36";
async function watchPictures(page) {
  await page.evaluate(async () => {
    window.__r4Moving = await import("/src/packs/moving-photo.js");
    const { ReliefMesh } = await import("/src/live/relief-mesh.js");
    const color = ReliefMesh.prototype.setColor,
      draw = CanvasRenderingContext2D.prototype.drawImage;
    window.__r4Videos = new WeakMap();
    ReliefMesh.prototype.setColor = function (...args) {
      const r = color.apply(this, args);
      window.__r4Mesh = this;
      return r;
    };
    CanvasRenderingContext2D.prototype.drawImage = function (src, ...args) {
      const r = draw.call(this, src, ...args);
      if (src instanceof HTMLVideoElement) window.__r4Videos.set(this.canvas, src);
      return r;
    };
    await window.__splashery.app.chooseToy("moving-photo-3d");
    window.__splashery.app.setControl("play", 0);
  });
}
async function chosenPicture(page) {
  await page.waitForFunction(() => !window.__splashery.player.loading);
  await page.evaluate(
    () => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r))),
  );
  return page.evaluate(() => {
    const moving = window.__r4Moving.MOVING,
      clip = moving.clip,
      mesh = window.__r4Mesh;
    const source = mesh.colorSrc,
      level = mesh.color.getSource();
    let own = false,
      pixels;
    if (ArrayBuffer.isView(level)) {
      pixels = level;
      own =
        pixels.length === clip.colors[moving.frame].length &&
        pixels.every((v, i) => v === clip.colors[moving.frame][i]);
    } else if (source instanceof HTMLVideoElement) {
      own = source === clip.video || source.currentSrc === clip.audio?.url;
    } else if (source instanceof HTMLCanvasElement) {
      pixels = source.getContext("2d").getImageData(0, 0, source.width, source.height).data;
      const video = window.__r4Videos.get(source);
      if (video && (video === clip.video || video.currentSrc === clip.audio?.url)) {
        for (const cpu of [false, true]) {
          const canvas = document.createElement("canvas");
          canvas.width = video.videoWidth;
          canvas.height = video.videoHeight;
          const g = canvas.getContext("2d", { willReadFrequently: cpu });
          g.drawImage(video, 0, 0);
          const expected = g.getImageData(0, 0, canvas.width, canvas.height).data;
          own ||= pixels.length === expected.length && pixels.every((v, i) => v === expected[i]);
        }
      }
    }
    let hash = 2166136261;
    if (pixels) for (const v of pixels) hash = Math.imul(hash ^ v, 16777619) >>> 0;
    return {
      name: clip.name,
      sample: clip.sample,
      own,
      hash,
      sharp: window.__psv.state().on,
      bound: mesh.matS.getParameter("uColor")?.data === mesh.color,
      shared: !clip.video || clip.audio?.track.el === clip.video,
    };
  });
}

test.describe("phone clip switches", () => {
  test.use({
    viewport: { width: 390, height: 844 },
    deviceScaleFactor: 3,
    isMobile: true,
    hasTouch: true,
    userAgent: android,
  });
  test("MP4, WebM, MOV, GIF, and 60 fps uploads keep their own Sharp picture and share video sound", async ({
    page,
    context,
  }) => {
    test.setTimeout(600_000);
    const cdp = await context.newCDPSession(page);
    await cdp.send("Emulation.setCPUThrottlingRate", { rate: 4 });
    await page.goto("/?renderer=webgl2&adapt=off&profile=low&labs=1");
    await page.waitForSelector("body[data-ready='true']");
    await watchPictures(page);
    const hashes = [];
    for (const file of ["blocks.mp4", "gate.webm", "wheel.mov", "orbit.gif", "fast.webm"]) {
      const name = `cdx-mp2-r4-${file.split(".")[0]}`;
      await page.setInputFiles("#toy-input-file", `assets/toys/moving-photo-3d/cdx-mp2-r4-${file}`);
      await page.waitForFunction(
        (name) =>
          window.__r4Moving.MOVING.clip?.name === name &&
          window.__r4Moving.MOVING.clip === window.__r4Moving.MOVING.custom &&
          !window.__splashery.player.loading,
        name,
      );
      const uploaded = await chosenPicture(page);
      expect(uploaded).toMatchObject({ name, own: true, sharp: true, bound: true, shared: true });
      hashes.push(uploaded.hash);
      await page.evaluate(() => window.__splashery.app.setToyOptions({ clip: "machine" }));
      expect(await chosenPicture(page)).toMatchObject({
        sample: "machine",
        own: true,
        sharp: true,
        bound: true,
      });
      await page.evaluate(
        (clipName) => window.__splashery.app.setToyOptions({ clip: "custom", clipName }),
        name,
      );
      expect(await chosenPicture(page)).toMatchObject({
        name,
        own: true,
        sharp: true,
        bound: true,
        shared: true,
      });
      await page.evaluate(() => window.__psv.set("moving-photo-3d", "splats"));
      await page.waitForFunction(
        () => !window.__psv.state().on && window.__splashery.player.stage.toy.entity.gsplat.enabled,
      );
      await page.evaluate(() => window.__psv.set("moving-photo-3d", "sharp"));
      expect(await chosenPicture(page)).toMatchObject({
        name,
        own: true,
        sharp: true,
        bound: true,
      });
    }
    expect(new Set(hashes).size).toBe(5);
  });
  test("every ordered sample pair binds the chosen clip's actual picture", async ({
    page,
    context,
  }) => {
    test.setTimeout(900_000);
    const cdp = await context.newCDPSession(page);
    await cdp.send("Emulation.setCPUThrottlingRate", { rate: 4 });
    await page.goto("/?renderer=webgl2&adapt=off&profile=low&labs=1");
    await page.waitForSelector("body[data-ready='true']");
    await watchPictures(page);
    const ids = await page.evaluate(() =>
      window.__r4Moving.MOVING_PHOTO.options
        .find((o) => o.key === "clip")
        .choices.filter((c) => c.id !== "custom")
        .map((c) => c.id),
    );
    expect(ids).toHaveLength(9);
    for (const from of ids)
      for (const to of ids) {
        await page.evaluate((clip) => window.__splashery.app.setToyOptions({ clip }), from);
        await page.evaluate((clip) => window.__splashery.app.setToyOptions({ clip }), to);
        expect(await chosenPicture(page), `${from} to ${to}`).toMatchObject({
          sample: to,
          own: true,
          sharp: true,
          bound: true,
        });
      }
    const resources = await page.evaluate(() => {
      const clips = [...window.__r4Moving.MOVING.samples.values()];
      return {
        active: clips.filter((c) => c.video?.getAttribute("src")).length,
        shared: clips.every((c) => !c.video || c.audio?.track.el === c.video),
      };
    });
    expect(resources).toEqual({ active: 1, shared: true });
  });
});

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

test.describe("phone clip playback", () => {
  test.use({
    viewport: { width: 390, height: 844 },
    deviceScaleFactor: 3,
    isMobile: true,
    hasTouch: true,
    userAgent: android,
  });
  test("a still camera keeps drawing short and long clip pictures", async ({ page, context }) => {
    test.setTimeout(240000);
    const worker = await fs.readFile("src/packs/moving-photo-geometry-worker.js", "utf8");
    await context.route("**/moving-photo-geometry-worker.js", (route) =>
      route.fulfill({
        contentType: "text/javascript",
        body: worker.replace(
          "const started = performance.now();",
          "const started = performance.now(); await new Promise((resolve) => setTimeout(resolve, 160));",
        ),
      }),
    );
    await (await context.newCDPSession(page)).send("Emulation.setCPUThrottlingRate", { rate: 4 });
    await page.goto("/?renderer=webgl2&adapt=off&profile=low&labs=1");
    await page.waitForSelector("body[data-ready='true']");
    await watchPictures(page);
    for (const id of ["sample", "bridge", "machine-long"]) {
      await page.evaluate(async (id) => {
        const { app, player } = window.__splashery;
        app.setControl("play", 0);
        await app.setToyOptions({ clip: id });
        player.idle.weight = 0;
        player.opts.idleDelay = 1e9;
        const device = player.stage.device;
        window.__r4DrawnFrames = new Set();
        if (!window.__r4DrawSpy) {
          const draw = device.draw;
          device.draw = function (primitive, buffer, ...rest) {
            const result = draw.call(this, primitive, buffer, ...rest);
            const mesh = window.__r4Mesh;
            if (
              this.shaderValid &&
              primitive.count > 0 &&
              buffer === mesh?.surface.mesh.indexBuffer[0] &&
              mesh.clipGeometryOwner === window.__r4Moving.MOVING.clip
            )
              window.__r4DrawnFrames.add(mesh.clipBitmapTime ?? window.__r4Moving.MOVING.frame);
            return result;
          };
          window.__r4DrawSpy = true;
        }
        app.setControl("play", 1);
      }, id);
      await page.waitForTimeout(600);
      await page.evaluate(() => window.__r4DrawnFrames.clear());
      await page.waitForFunction(() => window.__r4DrawnFrames.size >= 4, null, { timeout: 6000 });
      const state = await page.evaluate(() => {
        const m = window.__r4Mesh;
        window.__splashery.app.setControl("play", 0);
        return {
          drawn: window.__r4DrawnFrames.size,
          frame: window.__r4Moving.MOVING.frame,
          waiting: m.clipWaitingDepth,
          cache: m.clipCache?.stats,
          stream: m.clipStream?.stats,
        };
      });
      console.log(`${id} still camera: ${JSON.stringify(state)}`);
      expect(state.drawn, id).toBeGreaterThanOrEqual(4);
    }
  });
  test("each drawn accelerated relief uses the current depth frame", async ({ page, context }) => {
    test.setTimeout(120000);
    await (await context.newCDPSession(page)).send("Emulation.setCPUThrottlingRate", { rate: 4 });
    await page.goto("/?renderer=webgl2&adapt=off&profile=low&labs=1");
    await page.waitForSelector("body[data-ready='true']");
    await watchPictures(page);
    const result = await page.evaluate(async () => {
      const { prepareGeometry, geometryField, drawFields } =
        await import("/src/packs/moving-photo-geometry.js");
      const { player, app } = window.__splashery,
        m = window.__r4Mesh,
        c = window.__r4Moving.MOVING.clip;
      const reference = geometryField(await prepareGeometry(), c.w, c.h, m.cols, m.rows);
      return new Promise((resolve) => {
        const seen = new Set(),
          errors = [];
        const finish = () => {
          clearTimeout(timer);
          player.stage.app.off("postrender", draw);
          app.setControl("play", 0);
          resolve({ frames: seen.size, errors });
        };
        const timer = setTimeout(finish, 15000);
        const draw = () => {
          const frame = window.__r4Moving.MOVING.frame;
          if (seen.has(frame)) return;
          seen.add(frame);
          try {
            const count = reference.compute(c.near[frame], true, m.clipAspect);
            const expected = drawFields(reference, count, m.cols, m.rows).instances;
            const actual = m.matS.getParameter("uClipSoft").data.getSource();
            if (actual.some((v, i) => v !== reference.soft[i * 4]))
              errors.push(`surface at frame ${frame}`);
            if (
              expected.length !== m.clipAllPlanes.length ||
              expected.some((v, i) => v !== m.clipAllPlanes[i])
            )
              errors.push(`solid at frame ${frame}`);
          } catch (error) {
            errors.push(error.message);
          }
          if (seen.size === 5 || errors.length) finish();
        };
        player.stage.app.on("postrender", draw);
        app.setControl("play", 1);
      });
    });
    expect(result.errors).toEqual([]);
    expect(result.frames).toBe(5);
  });
  test("a hidden video without frame notifications keeps uploading its picture", async ({
    page,
    context,
  }) => {
    await (await context.newCDPSession(page)).send("Emulation.setCPUThrottlingRate", { rate: 4 });
    await page.goto("/?renderer=webgl2&adapt=off&profile=low&labs=1");
    await page.waitForSelector("body[data-ready='true']");
    await page.evaluate(() => {
      HTMLVideoElement.prototype.requestVideoFrameCallback = () => 1;
      HTMLVideoElement.prototype.cancelVideoFrameCallback = () => {};
      HTMLVideoElement.prototype.getVideoPlaybackQuality = () => ({ totalVideoFrames: 0 });
      window.__r4VideoUploads = [];
      for (const name of ["texImage2D", "texSubImage2D"]) {
        const original = WebGL2RenderingContext.prototype[name];
        WebGL2RenderingContext.prototype[name] = function (...args) {
          const video = window.__r4Moving?.MOVING.clip?.video;
          if (video && !video.paused && args.includes(video))
            window.__r4VideoUploads.push(video.currentTime);
          return original.apply(this, args);
        };
      }
    });
    await watchPictures(page);
    const times = await page.evaluate(async () => {
      window.__r4VideoUploads = [];
      window.__splashery.app.setControl("play", 1);
      await new Promise((r) => setTimeout(r, 1800));
      window.__splashery.app.setControl("play", 0);
      return window.__r4VideoUploads;
    });
    expect(times.length).toBeGreaterThanOrEqual(3);
    expect(times.at(-1) - times[0]).toBeGreaterThan(0.5);
  });
});

test.describe("phone long-clip pairing", () => {
  test.use({
    viewport: { width: 390, height: 844 },
    deviceScaleFactor: 3,
    isMobile: true,
    hasTouch: true,
    userAgent: android,
  });
  test("parallel picture processing keeps each drawn bitmap paired with its depth", async ({
    page,
    context,
  }) => {
    test.setTimeout(120000);
    await (await context.newCDPSession(page)).send("Emulation.setCPUThrottlingRate", { rate: 4 });
    await page.goto("/?renderer=webgl2&adapt=off&profile=low&labs=1");
    await page.waitForSelector("body[data-ready='true']");
    await watchPictures(page);
    await page.evaluate(() => window.__splashery.app.setToyOptions({ clip: "machine-long" }));
    await page.waitForFunction(() => !window.__splashery.player.loading);
    const result = await page.evaluate(async () => {
      const { blendNear, guidedDepth } = await import("/src/packs/moving-photo-depth.js");
      const { prepareGeometry, geometryField, drawFields } =
        await import("/src/packs/moving-photo-geometry.js");
      const { player, app } = window.__splashery,
        m = window.__r4Mesh,
        c = window.__r4Moving.MOVING.clip;
      const reference = geometryField(await prepareGeometry(), c.w, c.h, m.cols, m.rows);
      const canvas = document.createElement("canvas");
      canvas.width = c.w;
      canvas.height = c.h;
      const g = canvas.getContext("2d", { willReadFrequently: true });
      g.imageSmoothingQuality = "high";
      return new Promise((resolve) => {
        const seen = new Set(),
          errors = [];
        const finish = () => {
          clearTimeout(timer);
          player.stage.app.off("postrender", draw);
          app.setControl("play", 0);
          resolve({ frames: seen.size, workers: m.clipStream?.stats.workers, errors });
        };
        const timer = setTimeout(finish, 20000);
        const draw = () => {
          const time = m.clipBitmapTime;
          if (!m.clipBitmap || seen.has(time)) return;
          seen.add(time);
          try {
            const D = c.depth,
              k = Math.max(0, time * D.rate - (D.offset ?? 0.5)),
              a = Math.min(D.n - 1, Math.floor(k)),
              b = Math.min(D.n - 1, a + 1);
            blendNear(D, a, b, k - a);
            g.drawImage(m.clipBitmap, 0, 0, c.w, c.h);
            const near = guidedDepth(
              D.blend,
              D.ms.w,
              D.ms.h,
              g.getImageData(0, 0, c.w, c.h).data,
              c.w,
              c.h,
            );
            const bytes = Uint8Array.from(near, (v) => Math.round(v * 255));
            if (m.depth.getSource().some((v, i) => v !== bytes[i]))
              errors.push(`picture/depth at ${time}`);
            const count = reference.compute(bytes, true, m.clipAspect),
              expected = drawFields(reference, count, m.cols, m.rows).instances;
            if (
              m.matS
                .getParameter("uClipSoft")
                .data.getSource()
                .some((v, i) => v !== reference.soft[i * 4])
            )
              errors.push(`surface at ${time}`);
            if (
              expected.length !== m.clipAllPlanes.length ||
              expected.some((v, i) => v !== m.clipAllPlanes[i])
            )
              errors.push(`solid at ${time}`);
          } catch (error) {
            errors.push(error.message);
          }
          if (seen.size === 3 || errors.length) finish();
        };
        player.stage.app.on("postrender", draw);
        app.setControl("play", 1);
      });
    });
    expect(result.errors).toEqual([]);
    expect(result.frames).toBe(3);
    expect(result.workers).toBe(2);
  });
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
