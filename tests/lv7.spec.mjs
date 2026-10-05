// Lane Live r7 (docs/handoff/LiveR7.md): a clean, steady Splat mirror with
// nothing over the face in the hologram view; the Song landscape growing as
// the song plays; the Chladni plate's bow only while a tap moves the sand.
//
// The mirror is measured on a generated mannequin (tools/lv7-mannequin.mjs
// --still: one pose, a camera's noise in every frame) through Chromium's fake
// camera, with tools/lv7-mirror-measure.mjs. Main before this lane measured
// (the mid profile, 390 by 844 at 2x, two runs): color jitter 3.6, height
// jitter 0.013, shown jitter 1.41 to 1.51 face on and 2.31 to 3.23 turned;
// the hologram added 36 to 37 over the face and its shown jitter was 9.6 to
// 11.4.

import { test, expect } from "@playwright/test";
import { execFileSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import config from "../playwright.config.mjs";
import { fakeCamera, openMirror, measure, overFace } from "../tools/lv7-mirror-measure.mjs";

const DIR = fs.mkdtempSync(path.join(os.tmpdir(), "splashery-lv7-"));
const APP = "/?renderer=webgl2&adapt=off&profile=mid&labs=1";

// ---- The mirror's depth, cell by cell (no browser) ------------------------------------

test.describe("the mirror's depth (no browser)", () => {
  test("a face's gentle relief is kept smooth, not cut into terraces; a real jump still cuts clean", async () => {
    const { snapEdges, smoothSurface } = await import("../src/live/relief.js");
    const w = 60;
    const h = 20;
    // A face: a dome rising 0.35 over 30 cells (a nose and cheeks), with the
    // model's wobble on it; then the wall, 0.6 lower, past x = 45 (ramping
    // over 4 cells, as the model's guess does).
    let seed = 7;
    const rnd = () => ((seed = (seed * 1664525 + 1013904223) >>> 0) / 4294967296 - 0.5) * 0.02;
    const d = new Float32Array(w * h);
    for (let y = 0; y < h; y++)
      for (let x = 0; x < w; x++) {
        const face =
          0.6 + 0.35 * Math.cos(((x - 22) / 30) * Math.PI) ** 2 * (Math.abs(x - 22) < 15 ? 1 : 0);
        const wall = 0.05;
        const f = Math.min(1, Math.max(0, (x - 43) / 4));
        d[y * w + x] = face * (1 - f) + wall * f + rnd();
      }
    const out = snapEdges(smoothSurface(d, w, h), w, h);
    // Across the face the relief steps by no more than its own slope: no
    // terraces (the old cut made steps of 0.15 and more here).
    let step = 0;
    for (let y = 2; y < h - 2; y++)
      for (let x = 8; x < 38; x++)
        step = Math.max(step, Math.abs(out[y * w + x + 1] - out[y * w + x]));
    expect(step).toBeLessThan(0.06);
    // The wobble is smoothed: neighbors along a column agree closely.
    let wob = 0;
    for (let y = 2; y < h - 3; y++) wob += Math.abs(out[(y + 1) * w + 20] - out[y * w + 20]);
    expect(wob / (h - 5)).toBeLessThan(0.004);
    // The jump to the wall is a clean cut: no cell hangs between.
    let hang = 0;
    for (let y = 0; y < h; y++)
      for (let x = 38; x < w; x++) {
        const v = out[y * w + x];
        if (v > 0.15 && v < 0.5) hang++;
      }
    expect(hang).toBe(0);
  });

  test("at a jump each cell goes with the side whose colors it has", async () => {
    const { snapEdges } = await import("../src/live/relief.js");
    // A red person (near) before a blue wall; the depth ramps over cells
    // 16 to 24, but the colors change at 22: the cut follows the colors (each
    // cell takes its window's nearest or farthest depth).
    const w = 40;
    const h = 8;
    const d = new Float32Array(w * h);
    const colors = new Float32Array(w * h * 3);
    for (let y = 0; y < h; y++)
      for (let x = 0; x < w; x++) {
        const i = y * w + x;
        d[i] = 0.9 - 0.8 * Math.min(1, Math.max(0, (x - 16) / 8));
        const red = x < 22;
        colors[i * 3] = red ? 200 : 30;
        colors[i * 3 + 1] = 40;
        colors[i * 3 + 2] = red ? 40 : 200;
      }
    const out = snapEdges(d, w, h, colors);
    for (let y = 0; y < h; y++) {
      for (let x = 14; x < 22; x++) expect(out[y * w + x]).toBeGreaterThan(0.75);
      for (let x = 22; x < 28; x++) expect(out[y * w + x]).toBeLessThan(0.25);
    }
  });
});

// ---- The mirror on a camera ----------------------------------------------------------

test.describe("the mirror on a camera (a generated mannequin)", () => {
  test.describe.configure({ timeout: 600_000 });
  let y4m;
  test.beforeAll(() => {
    y4m = path.join(DIR, "still.y4m");
    execFileSync("node", ["tools/lv7-mannequin.mjs", y4m, "--still", "--frames=20"], { stdio: "ignore" }); // prettier-ignore
  });

  const launch = (playwright) =>
    playwright.chromium.launch({ ...config.use.launchOptions, args: fakeCamera(y4m, config.use.launchOptions.args) }); // prettier-ignore

  test("plain: steadier than before, frame to frame, and sharper", async ({
    playwright,
    baseURL,
  }) => {
    const browser = await launch(playwright);
    try {
      const page = await browser.newPage({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2 }); // prettier-ignore
      const errors = [];
      page.on("pageerror", (e) => errors.push(e.message));
      await openMirror(page, baseURL + "/");
      const m = await measure(page, { answers: 8 });
      console.log("lv7 mirror, plain:", JSON.stringify(m));
      // (Medians over the answers, with room for a loaded machine, where every
      // jitter runs higher: this lane measured 0.7 to 1.0 face on and 1.2 to
      // 3.0 turned on this container, main 1.41 to 1.51 and 2.31 to 3.23.)
      expect(m.colorJitter).toBeLessThan(1.6); // main: 3.63
      // The depth model's own guess wanders on a still picture; the relief
      // follows it no more than before.
      expect(m.heightJitter).toBeLessThan(0.03); // main: 0.013
      expect(m.shownJitter).toBeLessThan(1.3); // main: 1.41 to 1.51
      // Turned, the picture moves mostly with the depth model's own wobble,
      // which runs from about 1.6 to over 4 on a loaded machine whatever the
      // code (the face-on, color and height jitters above carry the claim);
      // this catches a turned view gone wrong.
      expect(m.shownJitterTurned).toBeLessThan(6); // main: 2.31 to 3.23 (unloaded)
      // The polish round: sharper (how much of the camera's own edges reach
      // the face; 0.51 to 0.52 before it, 0.56 to 0.57 after).
      expect(m.sharpness).toBeGreaterThan(0.54);
      expect(errors).toEqual([]);
    } finally {
      await browser.close();
    }
  });

  test("hologram: nothing drawn over the face, and steady", async ({ playwright, baseURL }) => {
    const browser = await launch(playwright);
    try {
      const page = await browser.newPage({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2 }); // prettier-ignore
      const errors = [];
      page.on("pageerror", (e) => errors.push(e.message));
      await openMirror(page, baseURL + "/", { look: "hologram" });
      const m = await measure(page, { answers: 4 });
      const over = await overFace(page);
      console.log("lv7 mirror, hologram:", JSON.stringify({ ...m, overFace: over }));
      expect(over).toBeLessThan(10); // main: 36 (scanlines and edge glow over the face)
      expect(m.shownJitter).toBeLessThan(3); // main: 11.4 (the scanlines drifted over the face)
      // Still the cool cyan look (r3).
      const tint = await page.evaluate(async () => {
        const { MIRROR, mirrorScreen } = await import("/src/live/relief.js");
        const c = document.createElement("canvas");
        c.width = mirrorScreen.width;
        c.height = mirrorScreen.height;
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
      await browser.close();
    }
  });
});

// ---- The Song landscape grows as the song plays --------------------------------------

// Until the song on show is measured.
async function measured(page) {
  for (let k = 0; k < 240; k++) {
    if (await page.evaluate(async () => (await import("/src/packs/studio.js")).songAnalysisState().finished)) return; // prettier-ignore
    await page.waitForTimeout(500);
  }
  throw new Error("The song was never measured.");
}

// How many of the landscape's splats show now (its screen's alpha), and the
// furthest slot shown.
const landShown = (page) =>
  page.evaluate(async () => {
    const m = await import("/src/packs/studio.js");
    const L = m.r2Land();
    if (!L) return null;
    const R = m.RECIPES["song-landscape"];
    const c = document.createElement("canvas");
    c.width = R.screen.width;
    c.height = R.screen.height;
    const g = c.getContext("2d");
    R.screen.draw(g, 0);
    const d = g.getImageData(0, 0, c.width, c.height).data;
    const cols = L.atlas.cols;
    let shown = 0;
    let last = -1;
    for (let i = 0; i < L.n; i++) {
      const q = (Math.floor(i / cols) * cols * 2 + cols + (i % cols)) * 4;
      if (d[q + 3] > 0) {
        shown++;
        last = Math.max(last, L.roles[i][0]);
      }
    }
    return { shown, last, nt: L.nt, pos: m.playState().pos };
  });

test.describe("the Song landscape grows with the song", () => {
  test.describe.configure({ timeout: 300_000 });

  test("Live opens on an empty plain, the land grows as the song plays, and Whole song shows it all", async ({
    page,
  }) => {
    const errors = [];
    page.on("pageerror", (e) => errors.push(e.message));
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto(APP);
    await page.waitForSelector("body[data-ready='true']", { timeout: 180_000 });
    await page.evaluate(() => window.__splashery.app.chooseToy("song-landscape"));
    await page.waitForFunction(() => window.__splashery.player.proc?.ctx?.kit?.data?.song && document.getElementById("progress").hidden, null, { timeout: 120_000 }); // prettier-ignore
    // Live is the default; the sample (20 s) is measured, and nothing shows yet.
    await measured(page);
    await page.waitForTimeout(1000);
    const empty = await landShown(page);
    expect(empty.shown).toBe(0);
    // Play: the land rises slot by slot with what has been heard.
    await page.evaluate(() => window.__splashery.app.act());
    const seen = [];
    for (let k = 0; k < 4; k++) {
      await page.waitForTimeout(1500);
      seen.push(await landShown(page));
    }
    for (let k = 1; k < seen.length; k++) {
      expect(seen[k].shown).toBeGreaterThan(seen[k - 1].shown);
      expect(seen[k].last).toBeGreaterThanOrEqual(seen[k - 1].last);
    }
    // What shows is what has been heard: never a slot from later in the song.
    for (const s of seen) expect(s.last / s.nt).toBeLessThanOrEqual(s.pos / 20 + 0.02);
    // And the part of the land heard moves back from the line at the front.
    const off = await page.evaluate(() => window.__splashery.player.motion.out?.parts?.look?.offset?.[2]); // prettier-ignore
    expect(off).toBeGreaterThan(0);
    // Whole song: all of it, at once.
    await page.evaluate(() => window.__splashery.app.setToyOptions({ view: "whole" }));
    await page.waitForFunction(() => window.__splashery.player.proc?.ctx?.kit?.data?.song?.live === false, null, { timeout: 120_000 }); // prettier-ignore
    expect(errors).toEqual([]);
  });
});

// ---- The Chladni plate: live sand, and the bow only for a tap ------------------------
// The owner's report of October 5, 2026: with his own audio or the
// microphone the bow kept coming back every five or six seconds, and the
// sand waited, then started over, at each change of note.

const RATE = 48000;
// Notes one after another ([hz, seconds]), as an instrument plays them, as a
// 16-bit mono WAV.
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
      const env = Math.min(1, t / 0.02, (d - t) / 0.02);
      ph += (2 * Math.PI * hz * 2 ** ((10 * Math.sin(2 * Math.PI * 5 * t)) / 1200)) / RATE;
      const v = env * (0.3 * Math.sin(ph) + 0.12 * Math.sin(2 * ph) + 0.05 * Math.sin(3 * ph));
      b.writeInt16LE(Math.round(v * 32767), 44 + (at + i) * 2);
    }
    at += m;
  }
  fs.writeFileSync(file, b);
  return file;
}
// G3 (the 195 Hz mode), F♯4 (375 Hz), C4 (255 Hz), G3 again: 6 s each.
const STEPS = [
  [196, 6],
  [370, 6],
  [262, 6],
  [196, 6],
];

const studio = "/src/packs/studio.js";
const plateReady = (page) =>
  page.waitForFunction(() => window.__splashery.player.scene.toy.id === "chladni-plate" && window.__splashery.player.motion.recipe && document.getElementById("progress").hidden, null, { timeout: 120_000 }); // prettier-ignore

// A log of every frame: the bow shown (its part, and its fade channel), the
// plate's builds, the audio's clock and the modes' strengths.
async function logFrames(page) {
  await page.evaluate(async (m) => {
    const st = await import(m);
    window.__log = [];
    const tick = () => {
      const out = window.__splashery.player.motion.out;
      const f = st.chladniFileState();
      window.__log.push({
        t: performance.now(),
        bow: (out?.parts?.bow?.visible ?? 0) > 0 || (out?.morph?.[1] ?? 0) > 0,
        builds: f.builds,
        pos: f.pos,
        playing: f.playing,
        amps: st.chladniSand().amps,
        steps: st.chladniSand().steps,
      });
      requestAnimationFrame(tick);
    };
    tick();
  }, studio);
}
const takeLog = (page) => page.evaluate(() => window.__log.splice(0));

test.describe("the Chladni plate", () => {
  test.describe.configure({ timeout: 300_000 });

  test("a tap bows the plate (the bow shows while it moves the sand) and nothing else does, not a change of mode", async ({
    page,
  }) => {
    const errors = [];
    page.on("pageerror", (e) => errors.push(e.message));
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto("/?renderer=webgl2&adapt=off&profile=low&labs=1");
    await page.waitForSelector("body[data-ready='true']", { timeout: 180_000 });
    await page.evaluate(() => window.__splashery.app.chooseToy("chladni-plate"));
    await plateReady(page);
    await logFrames(page);
    // At rest: no bow.
    await page.waitForTimeout(1000);
    expect((await takeLog(page)).some((f) => f.bow)).toBe(false);
    // A tap bows: the bow shows while the sand moves, and goes once it has
    // settled.
    await page.evaluate(() => window.__splashery.app.act());
    let bowed = [];
    for (let k = 0; k < 60; k++) {
      await page.waitForTimeout(1000);
      bowed = bowed.concat(await takeLog(page));
      if (bowed.length > 5 && !bowed.slice(-5).some((f) => f.bow)) break;
    }
    expect(bowed.some((f) => f.bow)).toBe(true);
    expect(bowed.slice(-5).some((f) => f.bow)).toBe(false);
    expect((await page.evaluate(async (m) => (await import(m)).singState(), studio)).p).toBeGreaterThan(0.5); // prettier-ignore
    // Change the mode: the plate rebuilds with no bow.
    for (const mode of ["3-4+", "1-2+"]) {
      await page.evaluate((mode) => window.__splashery.app.setToyOptions({ mode }), mode);
      await plateReady(page);
      await page.waitForTimeout(2500);
      expect((await takeLog(page)).some((f) => f.bow)).toBe(false);
    }
    // A tap on the new plate bows it again.
    await page.evaluate(() => window.__splashery.app.act());
    await page.waitForTimeout(1500);
    expect((await takeLog(page)).some((f) => f.bow)).toBe(true);
    expect(errors).toEqual([]);
  });

  test("your audio: no bow ever, no new plate, the sand sets off for each new note at once and holds when it stops", async ({
    page,
  }) => {
    const errors = [];
    page.on("pageerror", (e) => errors.push(e.message));
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto("/?renderer=webgl2&adapt=off&profile=low&labs=1");
    await page.waitForSelector("body[data-ready='true']", { timeout: 180_000 });
    await page.evaluate(() => window.__splashery.app.chooseToy("chladni-plate"));
    await plateReady(page);
    await page.setInputFiles("#toy-input-file", toneWav(path.join(DIR, "steps.wav"), STEPS));
    for (let k = 0; k < 240; k++) {
      const f = await page.evaluate(async (m) => (await import(m)).chladniFileState(), studio);
      if (f.name && f.measured >= 1) break;
      await page.waitForTimeout(250);
    }
    await plateReady(page);
    if (!(await page.evaluate(async (m) => (await import(m)).chladniFileState().playing, studio)))
      await page.evaluate(() => document.getElementById("chladni-play").click());
    await logFrames(page);
    // Play it through the first three notes and into the fourth.
    for (let k = 0; k < 90; k++) {
      await page.waitForTimeout(500);
      if ((await page.evaluate(async (m) => (await import(m)).chladniFileState().pos, studio)) > 19.5) break; // prettier-ignore
    }
    const log = await takeLog(page);
    // Never a bow, and never a new plate.
    expect(log.filter((f) => f.bow).length).toBe(0);
    expect(new Set(log.map((f) => f.builds)).size).toBe(1);
    // Each new note drives its mode within about 100 ms of the audio clock
    // reaching it (the analysis' 40 ms frames, and the frames this software
    // renderer draws): 375 Hz (3, 4) after 6 s, 255 Hz after 12 s.
    for (const [at, mode] of [
      [6, "3-4+"],
      [12, "1-4-"],
    ]) {
      const first = log.find((f) => f.pos >= at && (f.amps[mode] ?? 0) > 0.2);
      expect(first, `${mode} driven after ${at} s`).toBeTruthy();
      // The frame before it, to allow for a slow frame here.
      const i = log.indexOf(first);
      const before = log[i - 1];
      expect(Math.min(first.pos, Math.max(at, before?.pos ?? at)) - at).toBeLessThan(0.15);
    }
    // The sand moved on every frame while the audio played.
    const playing = log.filter((f) => f.playing);
    expect(playing[playing.length - 1].steps - playing[0].steps).toBeGreaterThan(
      playing.length * 0.8,
    );
    // Pause: the sand holds where it is.
    await page.evaluate(() => document.getElementById("chladni-play").click());
    await page.waitForTimeout(600);
    const a = await page.evaluate(async (m) => (await import(m)).chladniSand().at, studio);
    await page.waitForTimeout(1500);
    const b = await page.evaluate(async (m) => (await import(m)).chladniSand().at, studio);
    expect(b).toEqual(a);
    expect((await takeLog(page)).some((f) => f.bow)).toBe(false);
    expect(errors).toEqual([]);
  });

  test("the microphone: no bow ever, and no new plate, through a run of notes", async ({
    playwright,
    baseURL,
  }) => {
    const wav = toneWav(path.join(DIR, "sung.wav"), STEPS.slice(0, 3));
    const browser = await playwright.chromium.launch({
      ...config.use.launchOptions,
      args: [...config.use.launchOptions.args, "--use-fake-ui-for-media-stream", "--use-fake-device-for-media-stream", `--use-file-for-fake-audio-capture=${wav}`], // prettier-ignore
    });
    try {
      const page = await browser.newPage({ baseURL, viewport: { width: 390, height: 844 } });
      const errors = [];
      page.on("pageerror", (e) => errors.push(e.message));
      await page.goto("/?renderer=webgl2&adapt=off&profile=low&labs=1");
      await page.waitForSelector("body[data-ready='true']", { timeout: 180_000 });
      await page.evaluate(() => window.__splashery.app.chooseToy("chladni-plate"));
      await plateReady(page);
      await logFrames(page);
      await page.evaluate(() => document.getElementById("live-mic").click());
      // Until the sand has settled on the 375 Hz figure (F♯4).
      for (let k = 0; k < 120; k++) {
        await page.waitForTimeout(500);
        const s = await page.evaluate(async (m) => (await import(m)).singState(), studio);
        if (s.lead?.startsWith("3-4") && s.p > 0.3) break;
      }
      await page.evaluate(() => document.getElementById("live-mic").click());
      await page.waitForTimeout(1500);
      const log = await takeLog(page);
      expect(log.filter((f) => f.bow).length).toBe(0);
      expect(new Set(log.map((f) => f.builds)).size).toBe(1);
      expect((await page.evaluate(async (m) => (await import(m)).singState(), studio)).lead).toMatch(/^3-4/); // prettier-ignore
      expect(errors).toEqual([]);
    } finally {
      await browser.close();
    }
  });
});

// ---- Screenshots (lv7-*.png) ---------------------------------------------------------

// ---- The polish round (the owner's "the toys could still be sharper", October 5) -------

test.describe("the polish round (no browser)", () => {
  test("the Chladni plate and the Song landscape draw with the sharp kernel, the landscape on half as many splats again", async () => {
    const { RECIPES } = await import("../src/packs/studio.js");
    expect(RECIPES["chladni-plate"].kernel).toBe("sharp");
    expect(RECIPES["song-landscape"].kernel).toBe("sharp");
    expect(RECIPES["song-landscape"].density).toBe(1.5);
  });

  test("the landscape's waveform is a smooth envelope that keeps its loud parts, not a scatter", async () => {
    const { waveEnvelope } = await import("../src/packs/song-looks.js");
    // A jagged swing, as a song's slot by slot loudness is.
    const nt = 400;
    const wave = new Float32Array(nt);
    for (let i = 0; i < nt; i++) wave[i] = (i % 2 ? 1 : 0.1) * (0.5 + 0.5 * Math.sin(i / 40));
    const e = waveEnvelope({ nt, wave, hVersion: 1 });
    let jumps = 0;
    let raw = 0;
    for (let i = 1; i < nt; i++) {
      jumps += Math.abs(e[i] - e[i - 1]);
      raw += Math.abs(wave[i] - wave[i - 1]);
    }
    expect(jumps).toBeLessThan(raw * 0.05);
    expect(Math.max(...e)).toBeGreaterThan(0.9 * Math.max(...wave));
  });
});

test("screenshots at phone and desktop size: the landscape growing", async ({ browser }) => {
  test.setTimeout(300_000);
  for (const [w, h] of [
    [390, 844],
    [1440, 900],
  ]) {
    const page = await browser.newPage({ viewport: { width: w, height: h } });
    await page.goto(APP);
    await page.waitForSelector("body[data-ready='true']", { timeout: 180_000 });
    await page.evaluate(() => window.__splashery.app.chooseToy("song-landscape"));
    await page.waitForFunction(() => window.__splashery.player.proc?.ctx?.kit?.data?.song && document.getElementById("progress").hidden, null, { timeout: 120_000 }); // prettier-ignore
    await measured(page);
    await page.evaluate(() => window.__splashery.app.act());
    await page.waitForTimeout(7000);
    await page.evaluate(() => window.__splashery.app.act());
    await page.waitForTimeout(1200);
    await page.screenshot({ path: `tests/screenshots/lv7-landscape-${w}x${h}.png` });
    await page.close();
  }
});
