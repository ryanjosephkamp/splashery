// Lane Studio Sound: the song landscape and the Chladni plate
// (docs/handoff/StudioSound.md). The spectrogram is checked on synthetic
// sounds; the plate's settled sand is checked against its nodal lines.

import { test, expect } from "@playwright/test";
import fs from "node:fs";
import { spectrogram, bandOf, bands, landscapePlan, DB_FLOOR } from "../src/packs/studio-audio.js";
import { settle, MODES, displacement, nodalDistance, KEYS, modeFreq, landscapeData, parseWav } from "../src/packs/studio.js"; // prettier-ignore
import { TOYS, CATEGORIES } from "../src/toys.js";

const APP = "/?renderer=webgl2&adapt=off&profile=mid&labs=1";
const R = 22050;
const tone = (hz, secs, amp = 0.5) =>
  Float32Array.from({ length: Math.floor(R * secs) }, (_, i) => amp * Math.sin((2 * Math.PI * hz * i) / R)); // prettier-ignore
const peak = (g, t) => {
  let b = 0;
  for (let f = 1; f < g.nf; f++) if (g.db[t * g.nf + f] > g.db[t * g.nf + b]) b = f;
  return b;
};

test.describe("the spectrogram", () => {
  test("a 440 Hz sine puts one ridge in the 440 Hz band, at about its loudness", () => {
    const g = spectrogram(tone(440, 2), R, { frames: 16 });
    const want = bandOf(440);
    for (let t = 2; t < 14; t++) {
      expect(peak(g, t)).toBe(want);
      // A sine of amplitude 0.5 is 20·log10(0.5) = −6 dB.
      expect(Math.abs(g.db[t * g.nf + want] + 6.02)).toBeLessThan(1.5);
      // Two octaves away it is far quieter.
      expect(g.db[t * g.nf + bandOf(1760)]).toBeLessThan(-45);
      expect(g.db[t * g.nf + bandOf(110)]).toBeLessThan(-45);
    }
  });

  test("the bands are musical: twelve to the octave, log-spaced from 40 Hz to 16 kHz", () => {
    const { nf, edges } = bands(12);
    expect(nf).toBe(104);
    expect(edges[0]).toBeCloseTo(40);
    expect(edges[nf]).toBeCloseTo(16000, 0);
    expect(bandOf(880) - bandOf(440)).toBe(12);
  });

  test("a chirp makes a diagonal, and silence is flat", () => {
    const secs = 4;
    const f0 = 200;
    const f1 = 3200;
    const n = R * secs;
    const chirp = new Float32Array(n);
    // A rising exponential sweep from f0 to f1.
    const k = Math.log(f1 / f0) / secs;
    for (let i = 0; i < n; i++) {
      const t = i / R;
      chirp[i] = 0.5 * Math.sin((2 * Math.PI * f0 * (Math.exp(k * t) - 1)) / k);
    }
    const g = spectrogram(chirp, R, { frames: 24 });
    let prev = -1;
    for (let t = 1; t < 23; t += 3) {
      const b = peak(g, t);
      expect(b).toBeGreaterThan(prev);
      // Where the sweep is at that slice's time.
      const hz = f0 * Math.exp(k * g.times[t]);
      expect(Math.abs(b - bandOf(hz))).toBeLessThanOrEqual(3);
      prev = b;
    }
    const silent = spectrogram(new Float32Array(R * 2), R, { frames: 8 });
    expect(silent.db.every((v) => v === DB_FLOOR)).toBe(true);
    const d = landscapeData(new Float32Array(R * 2), R, 20000);
    expect(d.height.every((h) => h === 0 || h === 1)).toBe(true);
  });

  test("a long song is a coarser landscape within the splat budget", () => {
    const a = landscapePlan(20, 60000);
    const b = landscapePlan(600, 60000);
    expect(a.nf * a.frames).toBeLessThanOrEqual(60000);
    expect(b.nf * b.frames).toBeLessThanOrEqual(60000);
    expect(b.frames).toBeGreaterThan(a.frames);
    expect(b.frames / 600).toBeLessThan(a.frames / 20);
  });

  test("the sample song reads and has ridges", async () => {
    const wav = parseWav(new Uint8Array(fs.readFileSync("assets/toys/song-landscape/sample.wav")));
    expect(wav.rate).toBe(22050);
    expect(wav.samples.length / wav.rate).toBeCloseTo(20, 1);
    const d = landscapeData(wav.samples, wav.rate, 30000);
    expect(d.top).toBeGreaterThan(-20);
    expect(d.top).toBeLessThanOrEqual(1);
  });
});

test.describe("the Chladni plate", () => {
  // Mulberry32.
  const prng = (s) => () => {
    s = (s + 0x6d2b79f5) | 0;
    let t = Math.imul(s ^ (s >>> 15), 1 | s);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };

  test("its pitch grows with n² + m²", () => {
    expect(modeFreq({ n: 2, m: 3 })).toBeGreaterThan(modeFreq({ n: 1, m: 3 }));
    expect(modeFreq({ n: 1, m: 2 })).toBeGreaterThan(200);
  });

  for (const mode of MODES) {
    test(`mode ${mode.id}: the settled sand lies on the nodal lines`, () => {
      const n = 3000;
      const snaps = settle(mode, n, prng(11));
      expect(snaps.length).toBe(KEYS + 1);
      const mean = (s) => {
        let a = 0;
        for (let i = 0; i < n; i++) a += Math.abs(displacement(mode, s[i * 3], s[i * 3 + 1]));
        return a / n;
      };
      // Scattered sand sits about anywhere (mean swing ~0.8); settled sand at the still lines.
      expect(mean(snaps[0])).toBeGreaterThan(0.5);
      expect(mean(snaps[KEYS])).toBeLessThan(0.05);
      // Nearly every grain is within a few grain-widths of a nodal line, and the
      // last copy has no hop left.
      let near = 0;
      for (let i = 0; i < n; i++) {
        const s = snaps[KEYS];
        if (nodalDistance(mode, s[i * 3], s[i * 3 + 1]) < 0.02) near++;
        expect(s[i * 3 + 2]).toBe(0);
      }
      expect(near / n).toBeGreaterThan(0.95);
      // It gets there step by step (never all at once).
      expect(mean(snaps[2])).toBeGreaterThan(mean(snaps[KEYS - 1]));
      expect(mean(snaps[1])).toBeGreaterThan(mean(snaps[2]) * 0.99);
    });
  }
});

test.describe("the Studio shelf", () => {
  test.describe.configure({ timeout: 300_000 });

  test("both toys are labs toys on a Studio shelf after Pictures and pages", () => {
    const ids = CATEGORIES.map((c) => c.id);
    expect(ids.indexOf("studio")).toBe(ids.indexOf("pictures") + 1);
    for (const id of ["song-landscape", "chladni-plate"]) {
      const t = TOYS.find((x) => x.id === id);
      expect(t.labs).toBe(true);
      expect(t.category).toBe("studio");
    }
  });

  for (const id of ["song-landscape", "chladni-plate"]) {
    test(`${id} builds, and a tap runs without errors`, async ({ page }) => {
      const errors = [];
      page.on("pageerror", (e) => errors.push(e.message));
      await page.goto(APP);
      await page.waitForSelector("body[data-ready='true']", { timeout: 180_000 });
      await page.evaluate((i) => window.__splashery.app.chooseToy(i), id);
      await page.waitForTimeout(1500);
      const count = await page.evaluate(() => window.__splashery.player.proc?.ctx?.buf?.count ?? 0);
      expect(count).toBeGreaterThan(5000);
      expect(count).toBeLessThan(240_000);
      await page.evaluate(() => window.__splashery.app.act());
      await page.waitForTimeout(1500);
      await page.evaluate(() => window.__splashery.app.act());
      await page.waitForTimeout(500);
      expect(errors).toEqual([]);
    });
  }
});
