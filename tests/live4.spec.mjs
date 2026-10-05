// Lane Live input r4: the Chladni plate plays your audio, and re-sorts its
// sand when the note changes (the owner's question of October 2, 2026).
// Lane Live r7 updated the mode checks: the sand now moves live to the new
// figure on the same plate (no new plate per note).
// Chromium's fake microphone plays WAV files made here.

import { test, expect } from "@playwright/test";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import config from "../playwright.config.mjs";

// The low profile draws more frames a second in this container's software
// renderer; the plate's clock moves at most 0.1 s a frame, so the sand
// settles at its real speed only when frames come often enough.
const APP = "/?renderer=webgl2&adapt=off&profile=low&labs=1";
const RATE = 48000;
const DIR = fs.mkdtempSync(path.join(os.tmpdir(), "splashery-live4-"));
const studio = "/src/packs/studio.js";
// Phone size (and fewer pixels for the software renderer to draw).
test.use({ viewport: { width: 390, height: 844 } });

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

// Notes one after another: [hz, seconds] pairs, each with a little vibrato
// and a soft start and end, as a voice or an instrument plays them.
function tune(notes, { vibrato = 30, gap = 0.02 } = {}) {
  const total = notes.reduce((s, [, d]) => s + d, 0);
  const s = new Float32Array(Math.round(RATE * total));
  let at = 0;
  let ph = 0;
  for (const [hz, d] of notes) {
    const n = Math.round(RATE * d);
    for (let i = 0; i < n; i++) {
      const t = i / RATE;
      const env = Math.min(1, t / 0.02, (d - t) / gap);
      const f = hz * 2 ** ((vibrato * Math.sin(2 * Math.PI * 5 * t)) / 1200);
      ph += (2 * Math.PI * f) / RATE;
      s[at + i] = env * (0.3 * Math.sin(ph) + 0.12 * Math.sin(2 * ph) + 0.05 * Math.sin(3 * ph));
    }
    at += n;
  }
  return s;
}

// Sung: G3 for 10 s (the plate's 195 Hz mode), then F♯4 for 20 s (375 Hz).
const SUNG = wav(
  "sung.wav",
  tune([
    [196, 10],
    [370, 20],
  ]),
);
// A short song: a quick tune around G3 (G, A, B, A, quarter notes) for 10 s,
// then one around F♯4 (F♯, G, F♯, E) for 14 s.
const quick = (notes, secs) => Array.from({ length: Math.round(secs / 0.25) }, (_, i) => [notes[i % notes.length], 0.25]); // prettier-ignore
const SONG = wav("song.wav", tune([...quick([196, 220, 247, 220], 10), ...quick([370, 392, 370, 330], 14)], { vibrato: 10 })); // prettier-ignore

const withMic = (file) => ({
  ...config.use.launchOptions,
  args: [
    ...config.use.launchOptions.args,
    "--use-fake-ui-for-media-stream",
    "--use-fake-device-for-media-stream",
    ...(file ? [`--use-file-for-fake-audio-capture=${file}`] : []),
  ],
});

async function open(page) {
  await page.goto(APP);
  await page.waitForSelector("body[data-ready='true']", { timeout: 180_000 });
  await page.evaluate(() => window.__splashery.app.chooseToy("chladni-plate"));
  await page.waitForFunction(() => window.__splashery.player.scene.toy.id === "chladni-plate" && window.__splashery.player.motion.recipe && document.getElementById("progress").hidden, null, { timeout: 120_000 }); // prettier-ignore
}

// Counts the frames that draw the bow (it must never show while your voice
// or audio drives the plate, nor while the sand they left holds after).
async function watchBow(page) {
  await page.evaluate(() => {
    window.__bowSeen = 0;
    setInterval(() => {
      if ((window.__splashery.player.motion.out?.parts?.bow?.visible ?? 0) > 0) window.__bowSeen++;
    }, 40);
  });
}
const bowSeen = (page) => page.evaluate(() => window.__bowSeen);

async function until(page, check, arg = null, timeout = 120_000) {
  const end = Date.now() + timeout;
  for (;;) {
    const v = await page.evaluate(check, arg);
    if (v) return v;
    if (Date.now() > end) throw new Error(`Timed out waiting for ${check}`);
    await page.waitForTimeout(250);
  }
}

test("a new sung note re-sorts the sand: the plate switches mode and the fresh sand settles", async ({
  playwright,
  baseURL,
}) => {
  const browser = await playwright.chromium.launch(withMic(SUNG));
  try {
    const page = await browser.newPage({ baseURL, viewport: { width: 390, height: 844 } });
    const errors = [];
    page.on("pageerror", (e) => errors.push(e.message));
    await open(page);
    const before = await page.evaluate(async (m) => (await import(m)).singState().builds, studio); // prettier-ignore
    await watchBow(page);
    await page.evaluate(() => document.getElementById("live-mic").click());
    // G3: the 2, 3 plate's sand settles.
    const a = await until(page, async (m) => { const s = (await import(m)).singState(); return s.p > 0.4 ? s : null; }, studio, 60_000); // prettier-ignore
    expect(a.builds).toBe(before);
    expect(a.mode).toMatch(/^2-3/);
    // Then F♯4: the sand moves on to the 3, 4 figure (375 Hz) and settles
    // there. (Live r7: on the same plate, from where it lies; until r7 a new
    // plate with fresh sand.)
    const b = await until(page, async (m) => { const s = (await import(m)).singState(); return s.lead?.startsWith("3-4") && s.p > 0.3 ? s : null; }, studio, 60_000); // prettier-ignore
    expect(b.builds).toBe(before);
    // Stop the microphone: the sand it left holds, and still no bow.
    await page.evaluate(() => document.getElementById("live-mic").click());
    await until(page, async () => !(await import("/src/live/live.js")).live.on("mic"), null, 10_000).catch(() => {}); // prettier-ignore
    await page.waitForTimeout(1500);
    expect(await bowSeen(page)).toBe(0);
    expect(errors).toEqual([]);
  } finally {
    await browser.close();
  }
});

test("your audio plays to the plate: its strongest pitch rings the modes, re-sorting as the tune moves; play, pause and scrub", async ({
  page,
}) => {
  const errors = [];
  page.on("pageerror", (e) => errors.push(e.message));
  const requests = [];
  page.on("request", (r) => requests.push(r.url()));
  await open(page);
  // The transport hides until audio is open.
  expect(await page.evaluate(() => document.getElementById("chladni-transport")?.hidden)).toBe(true); // prettier-ignore
  const before = await page.evaluate(async (m) => (await import(m)).chladniFileState().builds, studio); // prettier-ignore
  await watchBow(page);
  await page.setInputFiles("#toy-input-file", SONG);
  await until(page, async (m) => (await import(m)).chladniFileState().name, studio, 60_000);
  // A browser that wants a tap before sound plays gets one (as a phone may).
  if (!(await page.evaluate(async (m) => (await import(m)).chladniFileState().playing, studio)))
    await page.evaluate(() => document.getElementById("chladni-play").click());
  await until(page, async (m) => (await import(m)).chladniFileState().playing, studio, 60_000);
  // The first tune keeps the 195 Hz plate and settles its sand.
  const a = await until(page, async (m) => { const s = (await import(m)).chladniFileState(); return s.p > 0.4 ? s : null; }, studio, 60_000); // prettier-ignore
  expect(a.builds).toBeGreaterThanOrEqual(before);
  expect(a.lead).toMatch(/^2-3/);
  // The second tune (F♯4 and around it) takes the sand to the 375 Hz figure.
  // (Live r7: on the same plate, from where it lies; until r7 a new plate.)
  const b = await until(page, async (m) => { const s = (await import(m)).chladniFileState(); return s.lead?.startsWith("3-4") && s.p > 0.3 ? s : null; }, studio, 60_000); // prettier-ignore
  expect(b.builds).toBe(a.builds);
  expect(b.playing).toBe(true); // the audio played on through the switch
  // Pause: the clock and the sand hold.
  await page.evaluate(() => document.getElementById("chladni-play").click());
  const p0 = await page.evaluate(async (m) => (await import(m)).chladniFileState(), studio);
  await page.waitForTimeout(1000);
  const p1 = await page.evaluate(async (m) => (await import(m)).chladniFileState(), studio);
  expect(p1.playing).toBe(false);
  expect(Math.abs(p1.pos - p0.pos)).toBeLessThan(0.05);
  expect(p1.p).toBeCloseTo(p0.p, 5);
  // Scrub to the middle; Start over plays from the top.
  await page.evaluate(() => {
    const s = document.getElementById("chladni-seek");
    s.value = "500";
    s.dispatchEvent(new Event("input"));
    s.dispatchEvent(new Event("change"));
  });
  const p2 = await page.evaluate(async (m) => (await import(m)).chladniFileState(), studio);
  expect(Math.abs(p2.pos - 12)).toBeLessThan(0.5);
  await page.evaluate(() => document.getElementById("chladni-start").click());
  const p3 = await page.evaluate(async (m) => (await import(m)).chladniFileState(), studio);
  expect(p3.pos).toBeLessThan(0.3);
  expect(p3.playing).toBe(true);
  // Nothing left the device.
  const base = new URL(page.url()).origin;
  expect(requests.filter((u) => !u.startsWith(base) && !u.startsWith("blob:") && !u.startsWith("data:"))).toEqual([]); // prettier-ignore
  // Close the audio: the bow is back.
  await page.evaluate(() => document.getElementById("chladni-close").click());
  expect(await page.evaluate(async (m) => (await import(m)).chladniFileState().name, studio)).toBe(null); // prettier-ignore
  // No bow while the audio played, paused or after it closed (its sand holds).
  await page.waitForTimeout(1500);
  expect(await bowSeen(page)).toBe(0);
  expect(errors).toEqual([]);
});
