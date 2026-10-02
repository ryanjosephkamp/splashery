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
