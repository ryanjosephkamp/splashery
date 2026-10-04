// Lane Live input r3 (docs/handoff/LiveInput.md, "Brief r3"): the fixes and
// additions from the owner's review of October 2, end to end, with
// Chromium's fake devices. The microphone plays WAV files made here.

import { test, expect } from "@playwright/test";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import config from "../playwright.config.mjs";

const APP = "/?renderer=webgl2&adapt=off&profile=mid&labs=1";
const RATE = 48000;
const DIR = fs.mkdtempSync(path.join(os.tmpdir(), "splashery-live3-"));

// ---- Test signals ------------------------------------------------------------------
function wav(name, samples) {
  const b = Buffer.alloc(44 + samples.length * 2);
  b.write("RIFF", 0);
  b.writeUInt32LE(36 + samples.length * 2, 4);
  b.write("WAVEfmt ", 8);
  b.writeUInt32LE(16, 16);
  b.writeUInt16LE(1, 20);
  b.writeUInt16LE(1, 22);
  b.writeUInt32LE(RATE, 24);
  b.writeUInt32LE(RATE * 2, 28);
  b.writeUInt16LE(2, 32);
  b.writeUInt16LE(16, 34);
  b.write("data", 36);
  b.writeUInt32LE(samples.length * 2, 40);
  for (let i = 0; i < samples.length; i++) b.writeInt16LE(Math.round(Math.max(-1, Math.min(1, samples[i])) * 32767), 44 + i * 2); // prettier-ignore
  const file = path.join(DIR, name);
  fs.writeFileSync(file, b);
  return file;
}

// A sung G3 the way a voice sings it: a 5 Hz vibrato of ±40 cents, and every
// 1.5 s a half-second slide down toward the 150 Hz mode (about 165 Hz), 12 s.
const WAVER = wav(
  "waver.wav",
  (() => {
    const s = new Float32Array(RATE * 12);
    let ph = 0;
    for (let i = 0; i < s.length; i++) {
      const t = i / RATE;
      const slide = t % 1.5 > 1 ? -280 : 0; // cents
      const cents = 40 * Math.sin(2 * Math.PI * 5 * t) + slide;
      const hz = 196 * 2 ** (cents / 1200);
      ph += (2 * Math.PI * hz) / RATE;
      s[i] = 0.3 * Math.sin(ph) + 0.12 * Math.sin(2 * ph) + 0.05 * Math.sin(3 * ph);
    }
    return s;
  })(),
);

// An ordinary voice: about 125 Hz with a 5 Hz vibrato, 20 s (between the
// plate's 75 and 150 Hz modes, far from the default plate's 195 Hz).
const LOW = wav(
  "low.wav",
  (() => {
    const s = new Float32Array(RATE * 20);
    let ph = 0;
    for (let i = 0; i < s.length; i++) {
      const hz = 125 * 2 ** ((50 * Math.sin(2 * Math.PI * 5 * (i / RATE))) / 1200);
      ph += (2 * Math.PI * hz) / RATE;
      s[i] = 0.3 * Math.sin(ph) + 0.15 * Math.sin(2 * ph) + 0.06 * Math.sin(3 * ph);
    }
    return s;
  })(),
);

// ---- Helpers -----------------------------------------------------------------------
const withMic = (file) => ({
  ...config.use.launchOptions,
  args: [
    ...config.use.launchOptions.args,
    "--use-fake-ui-for-media-stream",
    "--use-fake-device-for-media-stream",
    ...(file ? [`--use-file-for-fake-audio-capture=${file}`] : []),
  ],
});

async function micPage(playwright, baseURL, file, viewport = { width: 390, height: 844 }) {
  const browser = await playwright.chromium.launch(withMic(file));
  const page = await browser.newPage({ baseURL, viewport });
  const errors = [];
  page.on("pageerror", (e) => errors.push(e.message));
  return { page, errors, close: () => browser.close() };
}

async function open(page, toy) {
  await page.goto(APP);
  await page.waitForSelector("body[data-ready='true']", { timeout: 180_000 });
  await page.evaluate((t) => window.__splashery.app.chooseToy(t), toy);
  await page.waitForFunction((t) => window.__splashery.player.scene.toy.id === t && window.__splashery.player.motion.recipe, toy, { timeout: 120_000 }); // prettier-ignore
}

// Waits until an async check in the page is true.
async function until(page, check, arg = null, timeout = 120_000) {
  const end = Date.now() + timeout;
  for (;;) {
    const v = await page.evaluate(check, arg);
    if (v) return v;
    if (Date.now() > end) throw new Error(`Timed out waiting for ${check}`);
    await page.waitForTimeout(250);
  }
}

const tap = (page, sel) => page.evaluate((s) => document.querySelector(s).click(), sel);
const idle = (page) =>
  page.waitForFunction(() => document.getElementById("progress").hidden && window.__splashery.player.motion.recipe, null, { timeout: 180_000 }); // prettier-ignore
const studio = "/src/packs/studio.js";

// ---- The Chladni plate, sung to (item 8) -------------------------------------------
test.describe("the Chladni plate, sung to", () => {
  test("a wavering voice settles the sand while it sings, without rebuilding the plate", async ({
    playwright,
    baseURL,
  }) => {
    const { page, errors, close } = await micPage(playwright, baseURL, WAVER);
    try {
      await open(page, "chladni-plate");
      await idle(page);
      const before = await page.evaluate(async (m) => (await import(m)).singState().builds, studio);
      await tap(page, "#live-mic");
      // The sand settles while the microphone is still on.
      const s = await until(
        page,
        async (m) => {
          const s = (await import(m)).singState();
          return s.p > 0.5 ? s : null;
        },
        studio,
        60_000,
      );
      expect(s.p).toBeGreaterThan(0.5);
      // The slides toward the 150 Hz mode didn't swap the plate (each swap is
      // a new plate of scattered sand).
      expect(s.builds).toBe(before);
      // The sand shown is the sung sand: the drive picks the settled copy.
      const shown = await page.evaluate(() => {
        const { parts } = window.__splashery.player.motion.out ?? {};
        return parts ? Object.keys(parts).filter((k) => k.startsWith("sand") && parts[k].visible) : null; // prettier-ignore
      });
      if (shown) expect(shown[0]).not.toBe("sand0");
      // Stopping the microphone keeps the sand where the voice left it.
      const p0 = s.p;
      await tap(page, "#live-stop");
      await page.waitForTimeout(800);
      const after = await page.evaluate(() => {
        const { parts } = window.__splashery.player.motion.out ?? {};
        return parts ? Object.keys(parts).filter((k) => k.startsWith("sand") && parts[k].visible) : null; // prettier-ignore
      });
      if (after && shown) expect(after[0]).toBe(shown[0]);
      expect(p0).toBeGreaterThan(0.5);
      expect(errors).toEqual([]);
    } finally {
      await close();
    }
  });

  test("an ordinary voice between modes rings the nearest one: one switch, and the sand settles", async ({
    playwright,
    baseURL,
  }) => {
    const { page, errors, close } = await micPage(playwright, baseURL, LOW);
    try {
      await open(page, "chladni-plate");
      await idle(page);
      const before = await page.evaluate(async (m) => (await import(m)).singState().builds, studio);
      await tap(page, "#live-mic");
      const s = await until(
        page,
        async (m) => {
          const s = (await import(m)).singState();
          return s.p > 0.4 ? s : null;
        },
        studio,
        60_000,
      );
      // 125 Hz is nearest the 150 Hz mode (1, 3): the plate switched to it
      // once and its sand settled.
      expect(s.mode).toMatch(/^1-3/);
      expect(s.builds - before).toBe(1);
      expect(errors).toEqual([]);
    } finally {
      await close();
    }
  });
});

// ---- The Song landscape: the transport, the recording, the tilt (items 1-6) --------
const song = "/src/packs/studio.js";

test.describe("the Song landscape, r3", () => {
  test("it opens in Live, tilts within its range, and the transport starts over, pauses, scrubs and switches views", async ({
    playwright,
    baseURL,
  }) => {
    const { page, errors, close } = await micPage(playwright, baseURL, null);
    try {
      await open(page, "song-landscape");
      await idle(page);
      const cam = await page.evaluate(() => {
        const c = window.__splashery.player.camera;
        return { lock: c.tiltLock, range: c.pitchRange };
      });
      expect(cam.lock).toBe(false);
      expect(cam.range).toEqual([0.05, 1.35]);
      expect(await page.evaluate(() => window.__splashery.player.scene.toy.options?.view ?? null)).not.toBe("whole"); // prettier-ignore
      expect(await page.evaluate(async (m) => (await import(m)).transport.state().live, song)).toBe(true); // prettier-ignore
      await page.waitForSelector("#landscape-transport", { state: "attached" });
      // Play, then scrub to the middle while it plays.
      await tap(page, "#landscape-play");
      await until(page, async (m) => (await import(m)).transport.state().pos > 0.5, song, 30_000);
      const len = await page.evaluate(async (m) => (await import(m)).transport.state().length, song); // prettier-ignore
      await page.evaluate((v) => {
        const s = document.getElementById("landscape-seek");
        s.value = String(v);
        s.dispatchEvent(new Event("input"));
        s.dispatchEvent(new Event("change"));
      }, 500);
      const mid = await until(page, async (m) => { const s = (await import(m)).transport.state(); return s.pos > 0 ? s : null; }, song); // prettier-ignore
      expect(Math.abs(mid.pos - len / 2)).toBeLessThan(1.5);
      expect(mid.playing).toBe(true);
      // Pause: the clock holds.
      await tap(page, "#landscape-play");
      const p0 = await page.evaluate(async (m) => (await import(m)).transport.state().pos, song);
      await page.waitForTimeout(700);
      const p1 = await page.evaluate(async (m) => (await import(m)).transport.state(), song);
      expect(p1.playing).toBe(false);
      expect(Math.abs(p1.pos - p0)).toBeLessThan(0.05);
      // Scrub while paused: it moves there and stays paused.
      await page.evaluate(() => {
        const s = document.getElementById("landscape-seek");
        s.value = "200";
        s.dispatchEvent(new Event("input"));
      });
      const p2 = await page.evaluate(async (m) => (await import(m)).transport.state(), song);
      expect(Math.abs(p2.pos - len * 0.2)).toBeLessThan(0.3);
      expect(p2.playing).toBe(false);
      // Start over: back to 0 and playing.
      await tap(page, "#landscape-start");
      const p3 = await page.evaluate(async (m) => (await import(m)).transport.state(), song);
      expect(p3.pos).toBeLessThan(0.3);
      expect(p3.playing).toBe(true);
      // Whole is one tap away, and back.
      await tap(page, "#landscape-view");
      await idle(page);
      expect(await page.evaluate(async (m) => (await import(m)).transport.state().live, song)).toBe(false); // prettier-ignore
      // The song kept playing from where it was.
      const p4 = await until(page, async (m) => { const s = (await import(m)).transport.state(); return s.pos > 0.5 ? s : null; }, song, 30_000); // prettier-ignore
      expect(p4.playing).toBe(true);
      expect(await page.evaluate(() => document.getElementById("landscape-view")?.textContent)).toBe("Live view"); // prettier-ignore
      expect(errors).toEqual([]);
    } finally {
      await close();
    }
  });

  test("what the microphone hears is kept in memory, becomes the song when it stops, plays back and saves as a WAV", async ({
    playwright,
    baseURL,
  }) => {
    const { page, errors, close } = await micPage(playwright, baseURL, WAVER);
    try {
      await open(page, "song-landscape");
      await idle(page);
      await tap(page, "#live-mic");
      await until(page, async (m) => (await import(m)).recordState().recording > 3, song, 60_000);
      // Nothing is saved or sent while it records: no download, no request.
      const requests = [];
      page.on("request", (r) => requests.push(r.url()));
      // (The button is disabled until the toy has rebuilt for the microphone.)
      await page.waitForFunction(() => !document.getElementById("live-mic").disabled, null, { timeout: 60_000 }); // prettier-ignore
      await tap(page, "#live-mic"); // stop
      await until(page, async (m) => (await import(m)).recordState().onRecording, song, 60_000);
      const st = await page.evaluate(async (m) => (await import(m)).recordState(), song);
      expect(st.recorded).toBeGreaterThan(3);
      expect(requests.filter((u) => !u.startsWith(baseURL) && !u.startsWith("blob:") && !u.startsWith("data:"))).toEqual([]); // prettier-ignore
      // It plays back: the song's clock moves and the recording has the voice in it.
      await tap(page, "#landscape-recording-play");
      await until(page, async (m) => (await import(m)).transport.state().pos > 0.5, song, 30_000);
      // Save: a WAV file of the same length.
      const [download] = await Promise.all([page.waitForEvent("download"), tap(page, "#landscape-recording-save")]); // prettier-ignore
      expect(download.suggestedFilename()).toMatch(/^splashery-recording-\d{8}-\d{6}\.wav$/);
      const file = await download.path();
      const bytes = fs.readFileSync(file);
      expect(bytes.toString("ascii", 0, 4)).toBe("RIFF");
      const rate = bytes.readUInt32LE(24);
      const secs = (bytes.length - 44) / 2 / rate;
      expect(Math.abs(secs - st.recorded)).toBeLessThan(0.1);
      // The voice is in it (a sung G3: loud, not silence).
      let sum = 0;
      for (let i = 44; i < bytes.length; i += 2) sum += (bytes.readInt16LE(i) / 32768) ** 2;
      expect(Math.sqrt(sum / ((bytes.length - 44) / 2))).toBeGreaterThan(0.02);
      expect(errors).toEqual([]);
    } finally {
      await close();
    }
  });
});

// ---- The room echo meter: real reasons (item 10) -----------------------------------
test.describe("the room echo meter's reasons", () => {
  // A clap in a room: decaying noise over a steady background, as hop energies.
  const HOP = 240;
  function clap({ rt = 0.5, rangeDb = 40, bg = 0.01, extra = null, seed = 7 } = {}) {
    let s = seed;
    const rnd = () => ((s = (s * 1103515245 + 12345) & 0x7fffffff) / 0x7fffffff) * 2 - 1;
    const peak = bg * 10 ** (rangeDb / 20);
    const e = [];
    for (let i = 0; i + HOP <= RATE * 2.5; i += HOP) {
      let sum = 0;
      for (let j = 0; j < HOP; j++) {
        const t = (i + j) / RATE;
        const v = peak * rnd() * Math.exp((-6.91 * t) / rt) + bg * rnd() + (extra ? extra(t) * rnd() : 0); // prettier-ignore
        sum += v * v;
      }
      e.push(sum / HOP);
    }
    return { e: Float32Array.from(e), noise: (bg * bg) / 3 };
  }

  test("an ordinary clap in an ordinary room measures, down to about 20 dB above the background", async () => {
    const { measureDecay } = await import("../src/live/analysis.js");
    for (const rt of [0.3, 0.5, 0.8])
      for (const rangeDb of [22, 25, 30, 40, 50]) {
        const { e, noise } = clap({ rt, rangeDb });
        const r = measureDecay(e, HOP / RATE, noise);
        expect(r.ok, `${rt} s at ${rangeDb} dB`).toBe(true);
        expect(Math.abs(r.rt60 - rt) / rt).toBeLessThan(0.12);
        expect(r.method).toBe(rangeDb >= 45 ? "T30" : rangeDb >= 35 ? "T20" : "T10");
      }
  });

  test("each failure says why, with a hint", async () => {
    const { measureDecay, DECAY_HINTS } = await import("../src/live/analysis.js");
    const hop = HOP / RATE;
    // Too quiet: a soft clap in a silent room, 15 dB above it.
    let c = clap({ rangeDb: 15, bg: 0.0005 });
    expect(measureDecay(c.e, hop, c.noise).why).toBe("quiet");
    // Too noisy: a loud background.
    c = clap({ rangeDb: 15, bg: 0.05 });
    expect(measureDecay(c.e, hop, c.noise).why).toBe("noisy");
    // Too loud: the analyser counted full-scale samples.
    c = clap();
    expect(measureDecay(c.e, hop, c.noise, { clipped: 0.1 }).why).toBe("clipped");
    // Interrupted: a second loud sound 0.4 s in.
    c = clap({ rt: 0.8, extra: (t) => (t > 0.4 && t < 0.6 ? 0.3 : 0) });
    expect(measureDecay(c.e, hop, c.noise).why).toBe("interrupted");
    // Too short: a sound that stops at once.
    c = clap({ rt: 0.01, rangeDb: 40 });
    expect(measureDecay(c.e, hop, c.noise).why).toBe("short");
    for (const why of ["quiet", "noisy", "clipped", "interrupted", "short", "uneven"])
      expect(DECAY_HINTS[why].length).toBeGreaterThan(20);
  });

  test("the panel shows the reason and the input panel the hint", async ({ page }) => {
    await open(page, "room-echo");
    const shown = await page.evaluate(async () => {
      const m = await import("/src/packs/live.js");
      m.ECHO.result = { why: "clipped", rangeDb: 50 };
      m.ECHO.sample = false;
      return m.echoText();
    });
    expect(shown).toEqual({ big: "Too loud", small: "Clap softer or farther" });
  });
});

// ---- The splat mirror (items 11-15) ------------------------------------------------
test.describe("the splat mirror, r3", () => {
  test("the still picture holds still face on: nudging the view a hair doesn't reshuffle its splats", async ({
    playwright,
    baseURL,
  }) => {
    // At phone size, where the owner saw it flash.
    const { page, close } = await micPage(playwright, baseURL, null);
    await open(page, "splat-mirror");
    await idle(page);
    await page.waitForTimeout(3000);
    // The largest change at each pixel over 16 hair-width nudges back and
    // forth. With the splats all resting at z = 0 (before r3), 15,600 pixels
    // flashed by over 40 levels here; resting at their depth, about 270.
    const n = await page.evaluate(async () => {
      const pl = window.__splashery.player;
      const canvas = document.querySelector("canvas");
      const grab = () =>
        new Promise((r) =>
          requestAnimationFrame(() =>
            requestAnimationFrame(() => {
              const t = document.createElement("canvas");
              t.width = canvas.width;
              t.height = canvas.height;
              const g = t.getContext("2d");
              g.drawImage(canvas, 0, 0);
              r(g.getImageData(0, 0, t.width, t.height).data);
            }),
          ),
        );
      let prev = await grab();
      const acc = new Float32Array(prev.length / 4);
      const changed = (a, b) => {
        let n = 0;
        for (let j = 0; j < a.length; j += 4)
          if (Math.abs(a[j] - b[j]) + Math.abs(a[j + 1] - b[j + 1]) > 40) n++;
        return n;
      };
      // r6 fix (October 4): each nudge's frame is taken once the picture has
      // settled (two grabs in a row nearly alike, or 16 tries), since the
      // splats are re-sorted on a worker a few frames after a view change,
      // later on a busy machine. Splats that rest in a tie (r3's flashing)
      // reshuffle on every sort and never settle, so they still count.
      const settled = async () => {
        let last = await grab();
        for (let k = 0; k < 16; k++) {
          pl.stage.requestRender();
          await new Promise((r) => setTimeout(r, 120));
          const d = await grab();
          const n = changed(d, last);
          last = d;
          if (n < 30) break;
        }
        return last;
      };
      prev = await settled();
      for (let i = 0; i < 16; i++) {
        pl.camera.rotateBy((i % 2 ? -1 : 1) * 0.02, 0);
        pl.stage.requestRender();
        const d = await settled();
        for (let j = 0; j < acc.length; j++) acc[j] = Math.max(acc[j], Math.abs(d[j * 4] - prev[j * 4]) + Math.abs(d[j * 4 + 1] - prev[j * 4 + 1])); // prettier-ignore
        prev = d;
      }
      return acc.filter((v) => v > 40).length;
    });
    await close();
    console.log(`mirror: ${n} pixels changed by over 40 levels`);
    expect(n).toBeLessThan(2500);
  });

  test("a big Start camera over the picture, the back camera, a recording to save, and the hologram look", async ({
    playwright,
    baseURL,
  }) => {
    const { page, errors, close } = await micPage(playwright, baseURL, null);
    try {
      await open(page, "splat-mirror");
      await idle(page);
      // Nothing asked for before the tap.
      expect(await page.evaluate(async () => (await import("/src/live/live.js")).live.on("camera"))).toBe(false); // prettier-ignore
      await page.waitForSelector("#live-camera-stage", { state: "visible" });
      const box = await page.locator("#live-camera-stage").boundingBox();
      expect(box.height).toBeGreaterThan(40);
      await page.click("#live-camera-stage");
      await until(page, async () => (await import("/src/live/relief.js")).MIRROR.cam?.video?.videoWidth > 0); // prettier-ignore
      expect(await page.isVisible("#live-camera-stage")).toBe(false);
      // The front camera shows as a mirror; the back one the right way round.
      expect(await page.evaluate(async () => (await import("/src/live/relief.js")).MIRROR.cam.mirror)).toBe(true); // prettier-ignore
      const facing = await page.evaluate(async () => (await import("/src/live/live.js")).switchCamera()); // prettier-ignore
      expect(facing).toBe("environment");
      await page.evaluate(() => window.__splashery.app.setToyOptions({}));
      await idle(page);
      const after = await page.evaluate(async () => {
        const { MIRROR } = await import("/src/live/relief.js");
        const { live } = await import("/src/live/live.js");
        return { mirror: MIRROR.cam?.mirror, facing: live.camera?.facing, on: live.on("camera") };
      });
      expect(after).toEqual({ mirror: false, facing: "environment", on: true });
      // Record two seconds and save it: a video file, made on this device.
      await tap(page, "#live-camera-record");
      await page.waitForTimeout(2500);
      await tap(page, "#live-camera-record");
      await page.waitForFunction(() => !document.getElementById("live-camera-save").hidden, null, { timeout: 30_000 }); // prettier-ignore
      const [download] = await Promise.all([page.waitForEvent("download"), tap(page, "#live-camera-save")]); // prettier-ignore
      expect(download.suggestedFilename()).toMatch(
        /^splashery-splat-mirror-\d{8}-\d{6}\.(mp4|webm)$/,
      );
      expect(fs.statSync(await download.path()).size).toBeGreaterThan(1000);
      // The hologram look: cool cyan colors.
      await page.evaluate(() => window.__splashery.app.setToyOptions({ look: "hologram" }));
      await idle(page);
      const tint = await page.evaluate(async () => {
        const { MIRROR, mirrorScreen } = await import("/src/live/relief.js");
        const c = document.createElement("canvas");
        c.width = MIRROR.cols * 2;
        c.height = MIRROR.rows;
        const g = c.getContext("2d");
        mirrorScreen.draw(g, 1);
        const d = g.getImageData(0, 0, MIRROR.cols, MIRROR.rows).data;
        let r = 0;
        let b = 0;
        for (let i = 0; i < d.length; i += 4) {
          r += d[i];
          b += d[i + 2];
        }
        return b / Math.max(1, r);
      });
      expect(tint).toBeGreaterThan(2);
      expect(errors).toEqual([]);
    } finally {
      await close();
    }
  });
});

// ---- Moving photo to 3D (item 17) --------------------------------------------------
test.describe("Moving photo to 3D", () => {
  const mp = "/src/packs/moving-photo.js";

  test("the sample plays its frames in relief, a tap pauses it, and each splat rests at its average depth", async ({
    page,
  }) => {
    const errors = [];
    page.on("pageerror", (e) => errors.push(e.message));
    await open(page, "moving-photo-3d");
    await idle(page);
    const s0 = await page.evaluate(async (m) => (await import(m)).movingState(), mp);
    expect(s0.clip.n).toBe(48);
    // It plays: the frame moves on.
    const s1 = await until(page, async (m) => { const s = (await import(m)).movingState(); return s.t > 1 ? s : null; }, mp, 60_000); // prettier-ignore
    expect(s1.t).toBeGreaterThan(1);
    // The frame's canvas: depth offsets around a half, both ways (the bunny
    // nearer than it rests in some frames, farther in others).
    const spread = await page.evaluate(async (m) => {
      const { MOVING, frameImages } = await import(m);
      const { cols, rows } = MOVING.grid;
      let lo = 255;
      let hi = 0;
      for (const img of frameImages(MOVING.clip, cols, rows))
        for (let j = 0; j < rows; j++)
          for (let i = 0; i < cols; i++) {
            const b = img[(j * cols * 2 + cols + i) * 4 + 2];
            lo = Math.min(lo, b);
            hi = Math.max(hi, b);
          }
      return { lo, hi };
    }, mp);
    expect(spread.lo).toBeLessThan(110);
    expect(spread.hi).toBeGreaterThan(146);
    // A tap pauses: the clock holds.
    await page.evaluate(() => window.__splashery.app.act());
    await page.waitForTimeout(600);
    const a = await page.evaluate(async (m) => (await import(m)).movingState().t, mp);
    await page.waitForTimeout(800);
    const b = await page.evaluate(async (m) => (await import(m)).movingState().t, mp);
    expect(b - a).toBeLessThan(0.05);
    expect(errors).toEqual([]);
  });

  test("an opened GIF gets each frame's depth on this device and plays", async ({ page }) => {
    test.setTimeout(300_000);
    const errors = [];
    page.on("pageerror", (e) => errors.push(e.message));
    const requests = [];
    page.on("request", (r) => requests.push(r.url()));
    await open(page, "moving-photo-3d");
    await idle(page);
    await page.setInputFiles("#toy-input-file", "assets/toys/screen/horse.gif");
    const s = await until(page, async (m) => { const s = (await import(m)).movingState(); return s.clip?.name === "horse" ? s : null; }, mp, 280_000); // prettier-ignore
    expect(s.clip.n).toBe(15);
    expect(s.clip.w).toBe(300); // the GIF's own width (r5: up to 384 at this profile, never larger than the source)
    // Only this site's own files were fetched (the model among them).
    const base = new URL(page.url()).origin;
    expect(requests.filter((u) => !u.startsWith(base) && !u.startsWith("blob:") && !u.startsWith("data:"))).toEqual([]); // prettier-ignore
    expect(errors).toEqual([]);
  });
});
