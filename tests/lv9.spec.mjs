// Lane Live r9: Sound in a box takes your audio and the microphone, as the
// Chladni plate does. The physics (src/packs/chladni-3d.js) in Node; the
// toy in the browser, played a melody the test makes itself (no song).

import { test, expect } from "@playwright/test";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import config from "../playwright.config.mjs";
import {
  CELL_MODES,
  Beads,
  SCALE,
  ladder,
  cellFreq,
  heardFreq,
  heardRange,
  foldCell,
  cellDrive,
} from "../src/packs/chladni-3d.js";

const APP = "/?renderer=webgl2&adapt=off&profile=low&labs=1";
const BOX = "/src/packs/chladni-3d.js";
const DIR = fs.mkdtempSync(path.join(os.tmpdir(), "splashery-lv9-"));

function rng(seed = 7) {
  let s = seed >>> 0;
  return () => (s = (s * 1664525 + 1013904223) >>> 0) / 2 ** 32;
}

// ---- The physics, in Node --------------------------------------------------------------

test("the ladder follows the cell's real frequency ratios, f ∝ √(l² + m² + n²) and f ∝ ka", () => {
  const cube = ladder("cube");
  const base = cellFreq(cube[0]);
  for (const m of cube) {
    const [l, mm, n] = m.terms[0];
    // Every term of a mixed mode rings at the same frequency.
    for (const [a, b, c] of m.terms) expect(a * a + b * b + c * c).toBe(l * l + mm * mm + n * n);
    expect(cellFreq(m) / base).toBeCloseTo(Math.hypot(l, mm, n) / 1, 9);
  }
  const flask = ladder("flask");
  for (const m of flask) expect(cellFreq(m) / cellFreq(flask[0])).toBeCloseTo(m.ka / flask[0].ka, 9); // prettier-ignore
  // In order, and each of the toy's own modes is on its shape's ladder.
  for (const l of [cube, flask])
    for (let i = 1; i < l.length; i++) expect(cellFreq(l[i])).toBeGreaterThan(cellFreq(l[i - 1]));
  for (const m of CELL_MODES) expect(ladder(m.shape)).toContain(m);
});

test("a pitch is moved by octaves into the cell's range and scaled up 256 times to the mode it rings", () => {
  expect(SCALE).toBe(256);
  for (const shape of ["cube", "flask"]) {
    const [lo, hi] = heardRange(shape);
    expect(hi / lo).toBeGreaterThan(2);
    for (const hz of [55, 110, 196, 440, 1000, 3520]) {
      const f = foldCell(hz, shape);
      expect(f).toBeGreaterThanOrEqual(lo);
      expect(f).toBeLessThan(hi);
      expect(Math.log2(f / hz) % 1).toBeCloseTo(0, 9); // by whole octaves
    }
    // A note on a mode's heard pitch rings that mode most, at full
    // loudness; four octaves down, it folds back up to the same mode.
    for (const m of ladder(shape)) {
      const { modes, ultra } = cellDrive(heardFreq(m), 1, shape);
      const lead = modes.reduce((b, d) => (!b || d.a > b.a ? d : b));
      expect(lead.mode.id).toBe(m.id);
      expect(lead.a).toBeCloseTo(1, 6);
      expect(ultra).toBeCloseTo(cellFreq(m), 3);
      if (heardFreq(m) / 2 < lo) expect(cellDrive(heardFreq(m) / 16, 1, shape).ultra).toBeCloseTo(cellFreq(m), 3); // prettier-ignore
    }
    // Loudness scales the drive; silence asks nothing.
    expect(cellDrive(440, 0, shape).modes).toEqual([]);
  }
});

test("a held note settles the beads, a new note moves them on from where they are, silence holds them", () => {
  const cube = ladder("cube");
  const b = new Beads(3000, CELL_MODES[2], rng(5));
  const play = (hz, secs) => {
    const d = cellDrive(hz, 1, "cube").modes;
    for (let i = 0; i < secs * 30; i++) b.step(1 / 30, d);
  };
  const want = (id) => cube.find((m) => m.id === id);
  expect(b.settled(want("cube-110"))).toBeLessThan(0.15);
  play(heardFreq(want("cube-110")), 5);
  expect(b.settled(want("cube-110"))).toBeGreaterThan(0.8);
  // A new note: within a second the beads have left the old figure for the
  // new one, without a fresh scatter (the steps carry on).
  const steps = b.steps;
  play(heardFreq(want("cube-122")), 1);
  expect(b.steps - steps).toBe(30);
  expect(b.settled(want("cube-110"))).toBeLessThan(0.6);
  play(heardFreq(want("cube-122")), 4);
  expect(b.settled(want("cube-122"))).toBeGreaterThan(0.8);
  // Silence: nothing moves.
  const P = b.P.slice();
  expect(b.step(1 / 30, [])).toBe(false);
  expect(b.P).toEqual(P);
  // The toy's own single mode still works as before.
  const own = new Beads(2000, CELL_MODES[2], rng(9));
  for (let i = 0; i < 6 * 30; i++) own.step(1 / 30, 1);
  expect(own.settled()).toBeGreaterThan(0.6);
});

// ---- In the browser --------------------------------------------------------------------

const RATE = 48000;
// Notes one after another ([hz, seconds]) as a 16-bit mono WAV, with a
// little vibrato and two overtones, as an instrument plays them.
function toneWav(file, notes) {
  const n = Math.round(RATE * notes.reduce((a, [, d]) => a + d, 0));
  const b = Buffer.alloc(44 + n * 2);
  b.write("RIFF", 0);
  b.writeUInt32LE(36 + n * 2, 4);
  b.write("WAVEfmt ", 8);
  b.writeUInt32LE(16, 16);
  b.writeUInt16LE(1, 20);
  b.writeUInt16LE(1, 22);
  b.writeUInt32LE(RATE, 24);
  b.writeUInt32LE(RATE * 2, 28);
  b.writeUInt16LE(2, 32);
  b.writeUInt16LE(16, 34);
  b.write("data", 36);
  b.writeUInt32LE(n * 2, 40);
  let at = 0;
  let ph = 0;
  for (const [hz, d] of notes) {
    const m = Math.round(RATE * d);
    for (let i = 0; i < m; i++) {
      const t = i / RATE;
      const env = hz > 0 ? Math.min(1, t / 0.02, (d - t) / 0.02) : 0;
      ph += (2 * Math.PI * hz * 2 ** ((10 * Math.sin(2 * Math.PI * 5 * t)) / 1200)) / RATE;
      const v = env * (0.3 * Math.sin(ph) + 0.12 * Math.sin(2 * ph) + 0.05 * Math.sin(3 * ph));
      b.writeInt16LE(Math.round(v * 32767), 44 + (at + i) * 2);
    }
    at += m;
  }
  fs.writeFileSync(file, b);
  return file;
}
// A♭4 (cube 1, 1, 0 at 413 Hz), E5 (cube 0, 1, 2 at 654 Hz), A5 (cube 1, 2, 2
// at 877 Hz), then rest: 5 s each.
const MELODY = [
  [415.3, 5],
  [659.3, 5],
  [880, 5],
  [0, 4],
];

const cellReady = (page) =>
  page.waitForFunction(async (m) => window.__splashery.player.scene.toy.id === "chladni-cell" && document.getElementById("progress").hidden && (await import(m)).cellState().n > 0, BOX, { timeout: 120_000 }); // prettier-ignore
const audio = (page) => page.evaluate(async (m) => (await import(m)).cellAudioState(), BOX);

async function logFrames(page) {
  await page.evaluate(async (m) => {
    const st = await import(m);
    window.__log = [];
    const tick = () => {
      const a = st.cellAudioState();
      window.__log.push({ pos: a.pos, playing: a.playing, amps: a.amps, steps: a.steps, ring: st.cellState().ringing }); // prettier-ignore
      requestAnimationFrame(tick);
    };
    tick();
  }, BOX);
}
const takeLog = (page) => page.evaluate(() => window.__log.splice(0));

test.describe("Sound in a box, played to", () => {
  test.describe.configure({ timeout: 300_000 });
  test.use({ viewport: { width: 390, height: 844 } });

  test("your audio: each note drives its mode at once, the beads settle, and a pause holds them", async ({
    page,
  }) => {
    const errors = [];
    page.on("pageerror", (e) => errors.push(e.message));
    await page.goto(APP);
    await page.waitForSelector("body[data-ready='true']", { timeout: 180_000 });
    await page.evaluate(() => window.__splashery.app.chooseToy("chladni-cell"));
    await cellReady(page);
    await page.setInputFiles("#toy-input-file", toneWav(path.join(DIR, "melody.wav"), MELODY));
    for (let k = 0; k < 240; k++) {
      const f = await audio(page);
      if (f.name && f.measured >= 1) break;
      await page.waitForTimeout(250);
    }
    await cellReady(page);
    if (!(await audio(page)).playing)
      await page.evaluate(() => document.getElementById("cell-play").click());
    await logFrames(page);
    const seen = {};
    for (let k = 0; k < 90; k++) {
      await page.waitForTimeout(500);
      const a = await audio(page);
      // Late in each note: how settled the beads are on its mode.
      for (const [from, id] of [
        [4, "cube-110"],
        [9, "cube-012"],
        [14, "cube-122"],
      ])
        if (a.pos > from && a.pos < from + 0.9 && a.lead === id) seen[id] = Math.max(seen[id] ?? 0, a.p); // prettier-ignore
      if (a.pos > 15.6) break;
    }
    const log = await takeLog(page);
    // Each new note drives its mode within about 150 ms of the audio
    // clock reaching it.
    for (const [at, id] of [
      [5, "cube-012"],
      [10, "cube-122"],
    ]) {
      const first = log.find((f) => f.pos >= at && (f.amps[id] ?? 0) > 0.5);
      expect(first, `${id} driven after ${at} s`).toBeTruthy();
      const before = log[log.indexOf(first) - 1];
      expect(Math.min(first.pos, Math.max(at, before?.pos ?? at)) - at).toBeLessThan(0.2);
    }
    // A held note settles the beads into its figure.
    for (const id of ["cube-110", "cube-012", "cube-122"]) expect(seen[id] ?? 0, id).toBeGreaterThan(0.5); // prettier-ignore
    // The cell's own tone never rang, and the beads moved on every frame
    // while it played.
    expect(log.every((f) => f.ring === 0)).toBe(true);
    const playing = log.filter((f) => f.playing);
    expect(playing[playing.length - 1].steps - playing[0].steps).toBeGreaterThan(playing.length * 0.8); // prettier-ignore
    // The rest after the melody: the beads hold where they are.
    for (let k = 0; k < 20 && (await audio(page)).pos < 16.5; k++) await page.waitForTimeout(250);
    await page.waitForTimeout(400);
    const a = (await audio(page)).at;
    await page.waitForTimeout(1200);
    expect((await audio(page)).at).toEqual(a);
    // A tap plays or pauses the audio, and doesn't ring the cell.
    await page.evaluate(() => window.__splashery.player.act(null));
    await page.waitForTimeout(300);
    expect(await page.evaluate(async (m) => (await import(m)).cellState().ringing, BOX)).toBe(0);
    expect(errors).toEqual([]);
  });

  test("the microphone, after a tap: a sung note rings its mode and the beads settle", async ({
    playwright,
    baseURL,
  }) => {
    const wav = toneWav(path.join(DIR, "sung.wav"), [
      [415.3, 8],
      [880, 8],
    ]);
    const browser = await playwright.chromium.launch({
      ...config.use.launchOptions,
      args: [...config.use.launchOptions.args, "--use-fake-ui-for-media-stream", "--use-fake-device-for-media-stream", `--use-file-for-fake-audio-capture=${wav}`], // prettier-ignore
    });
    try {
      const page = await browser.newPage({ baseURL, viewport: { width: 390, height: 844 } });
      const errors = [];
      page.on("pageerror", (e) => errors.push(e.message));
      await page.goto(APP);
      await page.waitForSelector("body[data-ready='true']", { timeout: 180_000 });
      await page.evaluate(() => window.__splashery.app.chooseToy("chladni-cell"));
      await cellReady(page);
      // Nothing listens before the tap.
      expect(await page.evaluate(async () => (await import("/src/live/live.js")).live.on("mic"))).toBe(false); // prettier-ignore
      await page.evaluate(() => document.getElementById("live-mic").click());
      let best = 0;
      let lead = null;
      for (let k = 0; k < 120; k++) {
        await page.waitForTimeout(500);
        const a = await audio(page);
        if (a.lead && a.p > best) {
          best = a.p;
          lead = a.lead;
        }
        if (best > 0.5) break;
      }
      expect(["cube-110", "cube-122"]).toContain(lead);
      expect(best).toBeGreaterThan(0.5);
      await page.evaluate(() => document.getElementById("live-mic").click());
      await page.waitForTimeout(800);
      const a = (await audio(page)).at;
      await page.waitForTimeout(1200);
      expect((await audio(page)).at).toEqual(a);
      expect(errors).toEqual([]);
    } finally {
      await browser.close();
    }
  });
});
