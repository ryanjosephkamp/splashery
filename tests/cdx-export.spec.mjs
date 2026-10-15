import { test, expect } from "@playwright/test";

// Match tools/effect-clip.mjs: these tests exercise WebGL2 exports. The
// shared config also enables Vulkan/WebGPU, which is not used by this flow.
test.use({
  launchOptions: {
    executablePath: process.env.SPLASHERY_CHROMIUM || undefined,
    args: [
      "--use-angle=swiftshader",
      "--enable-unsafe-swiftshader",
      "--ignore-gpu-blocklist",
      "--enable-webgl",
    ],
  },
});

async function open(page) {
  await page.goto("/?renderer=webgl2&profile=weak&adapt=off&labs=1");
  await page.waitForSelector("body[data-ready='true']", { timeout: 180_000 });
  // A real user interaction also grants the audio activation Record receives
  // from its button. Long export setup must not stand in for that gesture.
  await page.locator("#stage").click({ position: { x: 2, y: 2 } });
}

// Encoder policies do not need a running 3D scene. Keep the native canvas,
// codecs, muxers, and audio graph real, without competing scene rendering.
async function openEncoder(page) {
  await page.goto("/LICENSES.md");
  await page.setContent(
    `<script type="importmap">{"imports":{"gifenc":"/vendor/gifenc/gifenc.esm.js"}}</script><button>Start</button>`,
  );
  await page.getByRole("button", { name: "Start" }).click();
}

test("Share defaults come from the export presets", async ({ page }) => {
  await open(page);
  expect(await page.locator("#gif-kind").inputValue()).toBe("effects");
  await expect(page.locator("#gif-frames")).toHaveValue("72");
  await expect(page.locator("#gif-size")).toHaveValue("720");
  await expect(page.locator("#webm-kind")).toHaveValue("effects");
  await expect(page.locator("#webm-seconds")).toHaveValue("8");
  await expect(page.locator("#webm-size")).toHaveValue("1080");
  await expect(page.locator("#webm-fps")).toHaveValue("30");
  await expect(page.locator("#record-quality")).toHaveValue("high");
  await expect(page.locator("#gif-estimate")).toContainText(/Estimated.*MB/);
});

test("recording limit is ten minutes, with full-screen High and phone budgets", async ({
  page,
}) => {
  await open(page);
  const out = await page.evaluate(async () => {
    const { EXPORT_PRESETS, recordingPlan, gifPlan } = await import("/src/export/presets.js");
    const screen = { width: 390, height: 600, dpr: 3, tierCap: 1.5, phone: true };
    return {
      limit: EXPORT_PRESETS.record.maxSeconds,
      standard: recordingPlan({ ...screen, quality: "standard" }),
      high: recordingPlan({ ...screen, quality: "high" }),
      max: recordingPlan({ ...screen, quality: "max", phone: false }),
      huge: gifPlan({ width: 1080, height: 1080, frames: 144, phone: true }),
    };
  });
  expect(out.limit).toBe(600);
  expect(out.standard.height).toBe(900);
  expect(out.high.height).toBe(1800);
  expect(out.max.height).toBe(3840);
  expect(out.high.maxBytes).toBeLessThan(out.max.maxBytes);
  expect(out.huge.ok).toBe(false);
});

for (const webmOnly of [false, true]) {
  test(`stepped ${webmOnly ? "VP9 WebM" : "preferred video"} encodes every frame despite slow drawing, with exact timestamps`, async ({
    page,
  }) => {
    await openEncoder(page);
    const out = await page.evaluate(async (webmOnly) => {
      const { encodeVideo } = await import("/src/export/video.js");
      const c = document.createElement("canvas");
      c.width = 160;
      c.height = 90;
      const times = [];
      const started = performance.now();
      const result = await encodeVideo({
        webmOnly,
        width: 160,
        height: 90,
        seconds: 0.4,
        fps: 30,
        drawFrame: async (time, i) => {
          times.push(time);
          await new Promise((r) => setTimeout(r, 45));
          const g = c.getContext("2d");
          g.fillStyle = i % 2 ? "#224488" : "#ccaa22";
          g.fillRect(0, 0, c.width, c.height);
          return c;
        },
      });
      const v = document.createElement("video");
      v.muted = true;
      v.src = URL.createObjectURL(result.blob);
      await new Promise((resolve, reject) => {
        v.onloadedmetadata = resolve;
        v.onerror = reject;
      });
      const meta = { duration: v.duration, width: v.videoWidth, height: v.videoHeight };
      URL.revokeObjectURL(v.src);
      return {
        frames: result.frames,
        size: result.blob.size,
        type: result.blob.type,
        times,
        elapsed: performance.now() - started,
        ...meta,
      };
    }, webmOnly);
    expect(out.frames).toBe(12);
    expect(out.times).toEqual(Array.from({ length: 12 }, (_, i) => i / 30));
    expect(out.elapsed).toBeGreaterThan(500);
    expect(out.duration).toBeCloseTo(0.4, 2);
    expect(out.width).toBe(160);
    expect(out.height).toBe(90);
    expect(out.size).toBeGreaterThan(200);
    expect(out.type).toMatch(webmOnly ? /^video\/webm$/ : /^video\/(mp4|webm)$/);
  });
}

test("Record warns and stops at its byte budget, returning a playable Blob", async ({ page }) => {
  await openEncoder(page);
  const out = await page.evaluate(async () => {
    const { startRecording } = await import("/src/exports.js");
    const c = document.createElement("canvas");
    c.width = 160;
    c.height = 120;
    const notices = [];
    const ctx = new AudioContext();
    const node = ctx.createGain();
    await ctx.resume();
    const rec = startRecording({
      canvas: c,
      audio: { ctx, node },
      maxSeconds: 30,
      maxBytes: 1024 * 1024,
      bitrate: 4_000_000,
      onWarning: (s) => notices.push(s),
    });
    let seed = 12345;
    const draw = setInterval(() => {
      const g = c.getContext("2d");
      const p = g.createImageData(160, 120);
      for (let i = 0; i < p.data.length; i += 4) {
        seed ^= seed << 13;
        seed ^= seed >>> 17;
        seed ^= seed << 5;
        p.data[i] = seed & 255;
        p.data[i + 1] = (seed >>> 8) & 255;
        p.data[i + 2] = (seed >>> 16) & 255;
        p.data[i + 3] = 255;
      }
      g.putImageData(p, 0, 0);
      rec.frame();
    }, 35);
    try {
      const result = await rec.done;
      const v = document.createElement("video");
      const url = URL.createObjectURL(result.blob);
      v.src = url;
      await new Promise((resolve, reject) => {
        v.onloadedmetadata = resolve;
        v.onerror = () => reject(new Error("Budget-limited take is not playable"));
      });
      const width = v.videoWidth;
      URL.revokeObjectURL(url);
      v.removeAttribute("src");
      v.load();
      return {
        width,
        size: result.size,
        seconds: result.seconds,
        reason: result.reason,
        type: result.type,
        notices,
      };
    } finally {
      clearInterval(draw);
      await ctx.close();
    }
  });
  expect(out.reason).toBe("size");
  expect(out.width).toBe(160);
  expect(out.seconds).toBeLessThan(30);
  expect(out.size).toBeGreaterThan(100);
  expect(out.size).toBeLessThanOrEqual(1024 * 1024);
  expect(out.notices.join(" ")).toMatch(/80%/);
  expect(out.type).toMatch(/^video\/(mp4|webm)$/);
});

test("Record keeps a paused sound context paused and captures sound after resume", async ({
  page,
}) => {
  await openEncoder(page);
  const out = await page.evaluate(async () => {
    const { startRecording } = await import("/src/exports.js");
    const ctx = new AudioContext();
    await ctx.resume();
    await ctx.suspend();
    const node = ctx.createGain();
    node.gain.value = 0.2;
    const osc = ctx.createOscillator();
    osc.connect(node);
    const canvas = document.createElement("canvas");
    canvas.width = 160;
    canvas.height = 120;
    const rec = startRecording({ canvas, audio: { ctx, node }, maxSeconds: 4 });
    const paused = ctx.state;
    let frame = 0;
    const draw = setInterval(() => {
      const g = canvas.getContext("2d");
      g.fillStyle = `hsl(${frame++ * 47} 70% 50%)`;
      g.fillRect(0, 0, 160, 120);
      rec.frame();
    }, 40);
    try {
      await new Promise((resolve) => setTimeout(resolve, 1000));
      await ctx.resume();
      osc.start();
      const result = await rec.done;
      const audio = await ctx.decodeAudioData(await result.blob.arrayBuffer());
      const samples = audio.getChannelData(0);
      let quiet = 0,
        peak = 0;
      for (let i = 0; i < samples.length; i++) {
        const value = Math.abs(samples[i]);
        if (i < audio.sampleRate * 0.4) quiet = Math.max(quiet, value);
        peak = Math.max(peak, value);
      }
      const v = document.createElement("video");
      const url = URL.createObjectURL(result.blob);
      v.src = url;
      await new Promise((resolve, reject) => {
        v.onloadedmetadata = resolve;
        v.onerror = reject;
      });
      const width = v.videoWidth;
      URL.revokeObjectURL(url);
      return { paused, sourceAfter: ctx.state, quiet, peak, width, size: result.size };
    } finally {
      clearInterval(draw);
      osc.stop();
      await ctx.close();
    }
  });
  expect(out.paused).toBe("suspended");
  expect(out.sourceAfter).toBe("running");
  expect(out.quiet).toBeLessThan(0.001);
  expect(out.peak).toBeGreaterThan(0.05);
  expect(out.width).toBe(160);
  expect(out.size).toBeGreaterThan(1024);
});

// Replacing the canvas-only capture with a page/screen capture must fail this
// test: fluorescent DOM markers occupy the actual overlay elements.
for (const toy of ["photo-3d", "powers-of-ten"]) {
  test(`${toy}: PNG, GIF, video, and Record exclude the visible overlays`, async ({ page }) => {
    test.setTimeout(240_000);
    await open(page);
    await page.evaluate(async (toy) => {
      const { app } = window.__splashery;
      await app.chooseToy(toy);
      if (toy === "photo-3d") await app.setToyOptions({ original: "on" });
    }, toy);
    const selectors = toy === "photo-3d" ? ["#stage-dial", ".smd-original"] : ["#toy-slider"];
    for (const selector of selectors) await expect(page.locator(selector)).toBeVisible();
    await page.addStyleTag({
      content: selectors
        .map(
          (s) =>
            `${s} { background: rgb(255, 0, 255) !important; box-shadow: 0 0 0 4px #f0f !important; } ${s}::after { content: ''; position: absolute; inset: 0; background: #f0f; z-index: 999; }`,
        )
        .join("\n"),
    });
    const out = await page.evaluate(async (toy) => {
      const { app, player } = window.__splashery;
      const { GifReader } = await import("/vendor/omggif/omggif.js");
      const markerPixels = (rgba) => {
        let n = 0;
        for (let i = 0; i < rgba.length; i += 4)
          if (rgba[i] > 235 && rgba[i + 1] < 25 && rgba[i + 2] > 235) n++;
        return n;
      };
      const read = (c) =>
        markerPixels(c.getContext("2d").getImageData(0, 0, c.width, c.height).data);
      const scene = () => {
        const s = app.exportScene();
        delete s.createdAt;
        return JSON.stringify(s);
      };
      const before = scene();
      const png = await app.exportPNG();
      const bitmap = await createImageBitmap(png);
      const c = document.createElement("canvas");
      c.width = bitmap.width;
      c.height = bitmap.height;
      c.getContext("2d").drawImage(bitmap, 0, 0);
      bitmap.close();
      const pngMarkers = read(c);
      const gif = await app.exportGIF({ frames: 4, size: 160, shape: "source" });
      if (!gif) throw new Error("GIF export failed");
      const reader = new GifReader(new Uint8Array(await gif.arrayBuffer()));
      const gifMarkers = [];
      for (let i = 0; i < reader.numFrames(); i++) {
        const rgba = new Uint8Array(reader.width * reader.height * 4);
        reader.decodeAndBlitFrameRGBA(i, rgba);
        gifMarkers.push(markerPixels(rgba));
      }
      const video = await app.exportWebM({ seconds: 0.2, fps: 30, size: 160 });
      if (!video) throw new Error("Video export failed");
      const decoded = async (blob, samples = [0.01, 0.045, 0.08, 0.115, 0.15, 0.18]) => {
        const v = document.createElement("video");
        v.muted = true;
        v.playsInline = true;
        v.style.cssText = "position:fixed;top:0;left:0;width:2px;height:2px;pointer-events:none";
        document.body.append(v);
        const url = URL.createObjectURL(blob);
        v.src = url;
        try {
          await new Promise((resolve, reject) => {
            v.onloadeddata = resolve;
            v.onerror = () => reject(new Error("Cannot decode exported video"));
          });
          if (!v.videoWidth)
            throw new Error(
              `Export has no video track: ${blob.type}, ${blob.size} bytes, ready ${v.readyState}`,
            );
          const c = document.createElement("canvas");
          c.width = v.videoWidth;
          c.height = v.videoHeight;
          const found = [];
          // All six stepped frames, and frames throughout the short Record take.
          for (const t of samples) {
            const at = Math.min(
              t,
              Number.isFinite(v.duration) ? Math.max(0, v.duration - 0.001) : t,
            );
            if (Math.abs(v.currentTime - at) > 0.0001)
              await new Promise((resolve, reject) => {
                const timer = setTimeout(
                  () =>
                    reject(
                      new Error(
                        `Export seek timed out at ${at}; duration ${v.duration}, current ${v.currentTime}`,
                      ),
                    ),
                  10000,
                );
                v.onseeked = () => {
                  clearTimeout(timer);
                  resolve();
                };
                v.currentTime = at;
              });
            await new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)));
            c.getContext("2d").drawImage(v, 0, 0);
            if (toy === "photo-3d") {
              const p = c.getContext("2d").getImageData(0, 0, c.width, c.height).data;
              let light = 0,
                count = 0;
              for (let i = 0; i < p.length; i += 64) {
                light += p[i] + p[i + 1] + p[i + 2];
                count++;
              }
              if (light / count / 3 < 15) throw new Error("The export contains a cleared frame.");
            }
            found.push(read(c));
          }
          return found;
        } finally {
          v.removeAttribute("src");
          v.load();
          v.remove();
          URL.revokeObjectURL(url);
        }
      };
      const videoMarkers = await decoded(video);
      const wasPaused = player.paused;
      player.paused = true; // An idle picture must still produce a playable video.
      await app.startRecord({ quality: "standard" });
      await new Promise((r) => setTimeout(r, 3000));
      const done = app.recording.done;
      app.stopRecord();
      await done;
      // app's UI callback is installed before this await, so Blob metadata is ready.
      const recorded = app.recorded;
      const recordMarkers = await decoded(recorded.blob, [0.01, 0.5, 1, 1.5, 2, 2.5]);
      player.paused = wasPaused;
      const handoff = { type: recorded.type, size: recorded.size, seconds: recorded.seconds };
      app.closeRecord();
      return {
        pngMarkers,
        gifMarkers,
        videoMarkers,
        recordMarkers,
        width: reader.width,
        height: reader.height,
        before,
        after: scene(),
        handoff,
        restored: !player.stage.fixedSize && !player.frozen && window.__clipT === undefined,
      };
    }, toy);
    expect(out.pngMarkers).toBe(0);
    expect(out.gifMarkers).toEqual([0, 0, 0, 0]);
    expect(out.videoMarkers).toEqual([0, 0, 0, 0, 0, 0]);
    expect(out.recordMarkers).toEqual([0, 0, 0, 0, 0, 0]);
    if (toy === "photo-3d") {
      expect(out.width).toBe(160);
      expect(out.height).toBe(106); // forest source: 1280 × 853
    } else expect(out.width).toBe(out.height);
    expect(out.after).toBe(out.before);
    expect(out.handoff.type).toMatch(/^video\/(mp4|webm)$/);
    expect(out.handoff.size).toBeGreaterThan(100);
    expect(out.handoff.seconds).toBeGreaterThan(0.5);
    expect(out.restored).toBe(true);
  });
}

test("stepped effects advance toggles, repeat, and restore after an encoder failure", async ({
  page,
}) => {
  await open(page);
  const out = await page.evaluate(async () => {
    const { app, player } = window.__splashery;
    await app.chooseToy("photo-3d");
    const before = { ...player.motion.state };
    const values = [];
    const handlers = player.stage.updateHandlers.slice();
    try {
      await app.withCapture(
        [100, 100],
        async (base) => {
          for (const time of [0, 0.8, 1.6, 2.4, 3.2]) {
            await base.frame(time, "effects", 4);
            values.push(player.motion.state.flat);
          }
          throw new Error("encoder failed");
        },
        { stepped: true },
      );
    } catch (e) {
      if (e.message !== "encoder failed") throw e;
    }
    return {
      before,
      after: player.motion.state,
      values,
      restored:
        handlers.every((h, i) => player.stage.updateHandlers[i] === h) &&
        !player.stage.fixedSize &&
        !player.frozen,
    };
  });
  expect(out.values[1]).toBeLessThan(out.values[0]);
  expect(out.values[2]).toBeLessThan(out.values[1]);
  expect(out.values[4]).toBeGreaterThan(out.values[3]); // next effect cycle
  expect(out.after).toEqual(out.before);
  expect(out.restored).toBe(true);
});

test("old v2 and v3 scene links load without export settings", async ({ page }) => {
  await open(page);
  for (const version of [2, 3]) {
    const hash = await page.evaluate(async (version) => {
      const { createScene } = await import("/src/state.js");
      const { encodeSceneHash } = await import("/src/codec.js");
      const scene = createScene();
      scene.version = version;
      scene.toy = { kind: "builtin", id: "donut" };
      if (version === 2) {
        delete scene.motion;
        delete scene.pattern;
      }
      return encodeSceneHash(scene);
    }, version);
    await page.goto(`/?renderer=webgl2&profile=weak#s=${hash}`);
    await page.waitForSelector("body[data-ready='true']", { timeout: 180_000 });
    const saved = await page.evaluate(() => window.__splashery.app.exportScene());
    expect(saved.version).toBe(3);
    expect(saved.toy.id).toBe("donut");
    expect(Object.keys(saved)).not.toContain("exports");
    expect(Object.keys(saved)).not.toContain("record");
    expect(Object.keys(saved)).not.toContain("gif");
  }
});

test("Record stops at a short time limit and releases its canvas track", async ({ page }) => {
  await openEncoder(page);
  const out = await page.evaluate(async () => {
    const { startRecording, RECORD_LIMIT } = await import("/src/exports.js");
    const c = document.createElement("canvas");
    c.width = c.height = 64;
    const g = c.getContext("2d");
    let stream;
    const capture = HTMLCanvasElement.prototype.captureStream;
    HTMLCanvasElement.prototype.captureStream = function (...args) {
      stream = capture.apply(this, args);
      return stream;
    };
    let rec;
    try {
      rec = startRecording({ canvas: c, maxSeconds: 3 });
    } finally {
      HTMLCanvasElement.prototype.captureStream = capture;
    }
    const draw = setInterval(() => {
      g.fillStyle = "#226699";
      g.fillRect(0, 0, 64, 64);
      rec.frame();
    }, 40);
    try {
      const r = await rec.done;
      return {
        limit: RECORD_LIMIT,
        reason: r.reason,
        seconds: r.seconds,
        bytes: r.size,
        ended: stream.getTracks().every((t) => t.readyState === "ended"),
      };
    } finally {
      clearInterval(draw);
    }
  });
  expect(out.limit).toBe(600);
  expect(out.reason).toBe("time");
  expect(out.seconds).toBe(3);
  expect(out.bytes).toBeGreaterThan(100);
  expect(out.ended).toBe(true);
});

test.describe("phone export controls", () => {
  test.use({
    viewport: { width: 390, height: 844 },
    isMobile: true,
    hasTouch: true,
    deviceScaleFactor: 3,
  });
  test("High is the default and Max is not offered", async ({ page }) => {
    await open(page);
    await expect(page.locator("#record-quality")).toHaveValue("high");
    await expect(page.locator('#record-quality option[value="max"]')).toHaveCount(0);
  });
});

test("Moving photo exports step the clip instead of pausing it with a tap", async ({ page }) => {
  await open(page);
  const out = await page.evaluate(async () => {
    const { app } = window.__splashery;
    await app.chooseToy("moving-photo-3d");
    const { MOVING } = await import("/src/packs/moving-photo.js");
    const frames = [];
    await app.withCapture(
      [100, 56],
      async (base) => {
        for (const time of [0, 0.2, 0.4, 0.6]) {
          await base.frame(time, "effects", 4);
          frames.push(MOVING.frame);
        }
      },
      { stepped: true },
    );
    return frames;
  });
  expect(new Set(out).size).toBeGreaterThan(2);
});

test("Video to 3D follows its flight and restores the lens and camera", async ({ page }) => {
  await open(page);
  const out = await page.evaluate(async () => {
    const { app, player } = window.__splashery;
    await app.chooseToy("video-3d");
    await player.stage.captureFrame(); // the toy opens at its source camera on its first draw
    const flight = player.proc.ctx.kit.data.flight;
    const lens = player.stage.cameraEntity.camera;
    const before = {
      fov: lens.fov,
      horizontal: lens.horizontalFov,
      camera: player.camera.getState(),
    };
    const originalState = player.motion.state;
    const offsets = [];
    await app.withCapture(
      [100, 100],
      async (base) => {
        for (const t of [0, 0.2, 0.4, 0.6]) {
          await base.frame(t, "effects", 4);
          offsets.push(flight.state.off.yaw);
        }
      },
      { stepped: true },
    );
    const turns = [];
    await app.withCapture(
      [100, 100],
      async (base) => {
        for (const t of [0, 0.5]) {
          await base.frame(t, "turntable", 2);
          turns.push(player.camera.getState().yaw);
        }
      },
      { stepped: true },
    );
    return {
      before,
      offsets,
      turns,
      after: { fov: lens.fov, horizontal: lens.horizontalFov, camera: player.camera.getState() },
      identity: player.motion.state === originalState,
    };
  });
  expect(out.offsets.every((n) => Math.abs(n) < 1e-6)).toBe(true);
  expect(out.turns[1] - out.turns[0]).toBeCloseTo(Math.PI / 2, 3);
  expect(out.after).toEqual(out.before);
  expect(out.identity).toBe(true);
});

test("Max stops after sustained long rendering work", async ({ page }) => {
  await openEncoder(page);
  const out = await page.evaluate(async () => {
    const { startRecording } = await import("/src/exports.js");
    const { recordingPerformanceMonitor } = await import("/src/export/record.js");
    const c = document.createElement("canvas");
    c.width = 160;
    c.height = 90;
    const g = c.getContext("2d");
    g.fillStyle = "#226699";
    g.fillRect(0, 0, 160, 90);
    const rec = startRecording({ canvas: c, quality: "max", maxSeconds: 10 });
    let calls = 0;
    const check = recordingPerformanceMonitor(() => {
      calls++;
      rec.stop("performance");
    });
    const draw = setInterval(() => rec.frame(), 50);
    try {
      await new Promise((r) => setTimeout(r, 3000));
      // Duration samples exercise the policy; the recorder and encoder are real.
      check(700);
      check(5); // One slow frame followed by fast work resets the run.
      const before = calls;
      check(700);
      check(700);
      check(700);
      check(700);
      const result = await rec.done;
      return { before, calls, reason: result.reason, size: result.size };
    } finally {
      clearInterval(draw);
    }
  });
  expect(out.before).toBe(0);
  expect(out.calls).toBe(1);
  expect(out.reason).toBe("performance");
  expect(out.size).toBeGreaterThan(100);
});

test("an oversized codec chunk is released with a plain refusal", async ({ page }) => {
  await openEncoder(page);
  const message = await page.evaluate(async () => {
    const { startRecording } = await import("/src/exports.js");
    const c = document.createElement("canvas");
    c.width = c.height = 160;
    const g = c.getContext("2d");
    const p = g.createImageData(160, 160);
    let seed = 12345;
    for (let i = 0; i < p.data.length; i += 4) {
      seed ^= seed << 13;
      seed ^= seed >>> 17;
      seed ^= seed << 5;
      p.data[i] = seed & 255;
      p.data[i + 1] = (seed >>> 8) & 255;
      p.data[i + 2] = (seed >>> 16) & 255;
      p.data[i + 3] = 255;
    }
    g.putImageData(p, 0, 0);
    const ctx = new AudioContext();
    await ctx.resume();
    const rec = startRecording({
      canvas: c,
      audio: { ctx, node: ctx.createGain() },
      maxBytes: 5000,
      maxSeconds: 3,
    });
    try {
      await rec.done;
      return "unexpected successful take";
    } catch (e) {
      return e.message;
    } finally {
      await ctx.close();
    }
  });
  expect(message).toMatch(/chunk larger than this device's size budget.*take was released/);
});
