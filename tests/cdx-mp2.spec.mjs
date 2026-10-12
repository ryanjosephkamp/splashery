import { test, expect } from "@playwright/test";
import { motionDepth } from "../src/live/clip-stabilize.js";
import { measure } from "../tools/cdx-mp2-measure.mjs";
import fs from "node:fs";
import crypto from "node:crypto";

const mp = "/src/packs/moving-photo.js";

test("long depth assets contain changing per-frame answers, not repeated first-frame estimates", () => {
  for (const stem of ["bunny", "sintel", "elephants", "tears"]) {
    const bytes = fs.readFileSync(`assets/toys/moving-photo-3d/${stem}-long.mp2depth`);
    const per = bytes.readUInt16LE(4) * bytes.readUInt16LE(6);
    const n = bytes.readUInt32LE(8);
    const unique = new Set(
      Array.from({ length: n }, (_, i) =>
        crypto
          .createHash("sha256")
          .update(bytes.subarray(12 + i * per, 12 + (i + 1) * per))
          .digest("hex"),
      ),
    );
    expect(unique.size, stem).toBeGreaterThan(n / 10);
    expect(bytes.length).toBeLessThan(20e6);
  }
});
test.use({ viewport: { width: 390, height: 844 } });

async function open(page) {
  await page.goto("/?renderer=webgl2&adapt=off&profile=low&labs=1");
  await page.waitForSelector("body[data-ready='true']");
  await page.evaluate(() => window.__splashery.app.chooseToy("moving-photo-3d"));
  await page.waitForFunction(() => window.__psv?.state().on && !window.__splashery.player.loading);
}

test("a sample's own pixels replace the previous picture in the first Sharp update", async ({
  page,
}) => {
  const errors = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await open(page);
  const result = await page.evaluate(async () => {
    const { ReliefMesh } = await import("/src/live/relief-mesh.js");
    const m = await import("/src/packs/moving-photo.js");
    const machine = await m.loadSample("machine");
    const old = ReliefMesh.prototype.setColor;
    const seen = [];
    ReliefMesh.prototype.setColor = function (src) {
      const result = old.call(this, src);
      if (m.MOVING.clip === machine) {
        seen.push({
          frame: m.MOVING.frame,
          own: src.data === machine.colors[m.MOVING.frame],
          // The actual bytes supplied to the GPU texture, after setColor.
          pixels: !!src.data && this.color._levels[0].every((v, i) => v === src.data[i]),
        });
      }
      return result;
    };
    try {
      await window.__splashery.app.setToyOptions({ clip: "machine" });
      await new Promise((r) => requestAnimationFrame(r));
      return seen;
    } finally {
      ReliefMesh.prototype.setColor = old;
    }
  });
  expect(result.length).toBeGreaterThan(0);
  expect(result[0]).toMatchObject({ own: true, pixels: true });
  expect(errors).toEqual([]);
});

test("the speaker mutes and unmutes a real track while playing and paused, including first enabling", async ({
  page,
}) => {
  await open(page);
  await page.evaluate(async (path) => {
    const m = await import(path);
    window.__track = m.MOVING.clip.audio.track;
    window.__splashery.app.sound.setEnabled(false);
    window.__track.play(window.__splashery.app.sound);
  }, mp);
  const state = () =>
    page.evaluate(() => ({
      playing: window.__track.playing,
      muted: window.__track.el.muted,
      gain: window.__track.gain?.gain.value,
      enabled: window.__splashery.app.sound.enabled,
    }));
  await expect.poll(async () => (await state()).playing).toBe(true);
  expect((await state()).muted).toBe(true);
  await page.locator("#sound-toggle").click();
  await expect.poll(async () => (await state()).muted).toBe(false);
  await page.locator("#sound-toggle").click();
  expect(await state()).toMatchObject({ playing: true, muted: true, gain: 0 });
  await page.evaluate(() => {
    window.__splashery.app.setControl("play", 0);
    window.__track.pause();
  });
  await page.locator("#sound-toggle").click();
  expect(await state()).toMatchObject({ playing: false, muted: false, gain: 1 });
  await page.locator("#sound-toggle").click();
  expect(await state()).toMatchObject({ playing: false, muted: true, gain: 0 });
});

test("all tracks on a speaker follow its toggle, and closed tracks stop observing it", async ({
  page,
}) => {
  await page.goto("/LICENSES.md");
  const result = await page.evaluate(async () => {
    const { Track } = await import("/src/packs/song-stream.js");
    const { Sound } = await import("/src/sound.js");
    const sound = new Sound();
    const original = sound.setEnabled;
    sound.setEnabled(false);
    const tracks = [
      new Track("/assets/toys/screen/bunny.webm"),
      new Track("/assets/toys/moving-photo-3d/elephants.mp3"),
    ];
    await Promise.all(tracks.map((t) => t.ready));
    tracks.forEach((t) => t.route(sound));
    sound.setEnabled(true);
    const audible = tracks.every((t) => !t.el.muted && t.gain.gain.value === 1);
    sound.setEnabled(false);
    const silent = tracks.every((t) => t.el.muted && t.gain.gain.value === 0);
    tracks[0].close();
    sound.setEnabled(true);
    const survivor = !tracks[1].el.muted;
    tracks[1].close();
    const restored = sound.setEnabled === original;
    await sound.ctx?.close();
    return { audible, silent, survivor, restored };
  });
  expect(result).toEqual({ audible: true, silent: true, survivor: true, restored: true });
});

test("a hidden, paused video uploads the picture reached by a seek", async ({ page }) => {
  await open(page);
  const result = await page.evaluate(async () => {
    const { ReliefMesh } = await import("/src/live/relief-mesh.js");
    const { sharpDrive } = await import("/src/packs/photo-sharp.js");
    const { MOVING } = await import("/src/packs/moving-photo.js");
    const old = ReliefMesh.prototype.setColor;
    let video = null,
      uploads = 0;
    ReliefMesh.prototype.setColor = function (src) {
      if (src instanceof HTMLVideoElement) video = src;
      if (
        src instanceof HTMLVideoElement ||
        (src instanceof HTMLCanvasElement && src.currentTime !== undefined)
      )
        uploads++;
      return old.call(this, src);
    };
    try {
      for (let i = 0; i < 200 && !video; i++) {
        sharpDrive({});
        await new Promise((r) => setTimeout(r, 20));
      }
      if (!video) throw new Error("The native sample picture never became ready.");
      window.__splashery.app.setControl("play", 0);
      MOVING.clip.audio.track.pause();
      video.pause();
      MOVING.t = 2.5;
      await new Promise((r) => {
        video.addEventListener("seeked", r, { once: true });
        video.currentTime = 2.5;
      });
      const before = uploads;
      sharpDrive({});
      for (let i = 0; i < 5; i++) await window.__splashery.player.stage.captureFrame();
      return {
        uploaded: uploads > before,
        time: video.currentTime,
        paused: video.paused,
        sharp: window.__psv.state().on,
      };
    } finally {
      ReliefMesh.prototype.setColor = old;
    }
  });
  expect(result).toMatchObject({ uploaded: true, paused: true, sharp: true });
  expect(result.time).toBeCloseTo(2.5, 1);
});

test("color-guided interpolation follows a moving solid edge rather than leaving a depth ghost", () => {
  const w = 24,
    h = 12;
  const frame = (start) => {
    const d = new Float32Array(w * h),
      color = new Uint8ClampedArray(w * h * 4);
    for (let i = 0; i < d.length; i++) {
      const near = i % w >= start && i % w < start + 6;
      d[i] = near ? 0.9 : 0.1;
      color.set(near ? [220, 40, 30, 255] : [20, 60, 150, 255], i * 4);
    }
    return { d, color };
  };
  const a = frame(4),
    b = frame(10),
    truth = frame(7);
  const linear = Float32Array.from(a.d, (v, i) => (v + b.d[i]) / 2);
  const guided = motionDepth(a.d, b.d, a.color, b.color, truth.color, w, h, 0.5, linear);
  const error = (d) => d.reduce((sum, v, i) => sum + Math.abs(v - truth.d[i]), 0) / d.length;
  expect(error(guided)).toBeLessThan(error(linear) / 10);
});

test("a real uploaded bunny refines every depth frame and closes the measured low-tier sample gap", async ({
  page,
}) => {
  test.setTimeout(600_000);
  await page.goto("/LICENSES.md");
  const sample = await measure(page, { id: "sample" });
  const upload = await measure(page, { id: "sample", path: "assets/toys/screen/bunny.webm" });
  expect(upload.refinement.error).toBeFalsy();
  expect(upload.refinement.measured).toBe(upload.frames);
  expect(upload.heightJitter).toBeLessThan(sample.heightJitter * 1.2);
  expect(upload.edgeFlipsPer1000).toBeLessThan(sample.edgeFlipsPer1000 * 1.2);
  expect(upload.surfaceCutShare).toBeLessThan(sample.surfaceCutShare * 1.2);
});

test("60 fps input retains its native picture and improves depth in the background at a larger size", async ({
  page,
}) => {
  test.setTimeout(600_000);
  await page.goto("/LICENSES.md");
  const result = await page.evaluate(async () => {
    window.__splashery = { player: { profile: "mid" } };
    const m = await import("/src/packs/moving-photo.js");
    const blob = await (await fetch("/assets/toys/moving-photo-3d/cdx-mp2-fast-60.webm")).blob();
    const clip = await m.openClip(new File([blob], "fast.webm", { type: blob.type }), "fast");
    const initial = { n: clip.n, duration: clip.duration, w: clip.w, h: clip.h };
    await clip.refinement.finished;
    const result = {
      initial,
      final: { n: clip.n, duration: clip.duration, w: clip.w, h: clip.h },
      video: [clip.video.videoWidth, clip.video.videoHeight],
      measured: clip.refinement.measured,
      side: clip.refinement.side,
      error: clip.refinement.error,
    };
    clip.audio?.track.close();
    clip.video.pause();
    clip.refinement.cancel();
    URL.revokeObjectURL(clip.url);
    return result;
  });
  expect(result.final).toEqual(result.initial);
  expect(result.video).toEqual([320, 180]);
  expect(result.side).toBe(294);
  expect(result.measured).toBe(result.final.n);
  expect(result.error).toBeFalsy();
});

test("30-second films are opt-in, play precomputed depth on every frame, and never load the model", async ({
  page,
}) => {
  test.setTimeout(300_000);
  const requested = [];
  page.on("request", (r) => requested.push(r.url()));
  await open(page);
  expect(requested.some((u) => /-long\.(webm|mp2depth)/.test(u))).toBe(false);
  for (const [id, duration, frames] of [
    ["sample-long", 30, 720],
    ["dragon-long", 30, 720],
    ["machine-long", 30, 720],
    ["bridge-long", 27, 648],
  ]) {
    await page.evaluate((clip) => window.__splashery.app.setToyOptions({ clip }), id);
    const result = await page.evaluate(async (path) => {
      const clip = (await import(path)).MOVING.clip;
      return {
        sample: clip.sample,
        duration: clip.duration,
        n: clip.n,
        depth: clip.depth.done,
        video: clip.video.videoWidth,
      };
    }, mp);
    expect(result).toMatchObject({ sample: id, duration, n: frames, depth: frames });
    expect(result.video).toBeGreaterThan(300);
  }
  expect(requested.some((u) => /vendor\/(depth-anything|onnxruntime)/.test(u))).toBe(false);
});
