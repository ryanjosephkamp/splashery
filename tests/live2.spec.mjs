// Lane Live input r2 (docs/handoff/LiveInput.md): the Song landscape opens a
// long song at once and measures it in a worker, and its measured looks stay
// in step with the sound. The test songs are made here: a click track (clicks
// at known, uneven moments) and a sine. The browser plays them through a real
// <audio> element (Chromium's autoplay flag stands in for the tap).

import { test, expect } from "@playwright/test";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import config from "../playwright.config.mjs";
import { makeAnalyser, makeFeatures, analyzeFrames, frameCount, F, FIELDS, HOP } from "../src/packs/song-analysis.js"; // prettier-ignore

const APP = "/?renderer=webgl2&adapt=off&profile=mid&labs=1";
const RATE = 44100;
const DIR = fs.mkdtempSync(path.join(os.tmpdir(), "splashery-live2-"));

function wavBytes(samples) {
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
  return b;
}

// Clicks at uneven moments (seconds) in a 40-second track, over a faint hiss.
const CLICKS = [1.0, 2.37, 3.81, 5.12, 6.9, 8.33, 9.47, 11.06, 12.58, 13.71, 15.2, 16.94];
function clickTrack(seconds = 40) {
  const s = new Float32Array(RATE * seconds);
  let seed = 7;
  for (let i = 0; i < s.length; i++) s[i] = 0.002 * (((seed = (seed * 16807) % 2147483647) / 2147483647) * 2 - 1); // prettier-ignore
  for (const c of CLICKS) {
    const a = Math.round(c * RATE);
    for (let j = 0; j < RATE * 0.012; j++) s[a + j] += 0.7 * Math.exp(-j / (RATE * 0.002)) * Math.sin((2 * Math.PI * 1500 * j) / RATE); // prettier-ignore
  }
  return s;
}
const CLICK_WAV = path.join(DIR, "clicks.wav");
fs.writeFileSync(CLICK_WAV, wavBytes(clickTrack()));

// ---- The measurements (no browser) ----------------------------------------------------------
test.describe("the measurements (no browser)", () => {
  const measure = (samples) => {
    const out = makeFeatures(frameCount(samples.length / RATE));
    analyzeFrames(makeAnalyser(RATE), samples, 0, out.n, out);
    return out;
  };

  test("each click is loudest in the frame that holds it", () => {
    const out = measure(clickTrack(20));
    for (const c of CLICKS) {
      const at = Math.floor(c / HOP);
      let best = at - 5;
      for (let i = at - 5; i <= at + 5; i++) if (out.feat[i * FIELDS.length + F.rms] > out.feat[best * FIELDS.length + F.rms]) best = i; // prettier-ignore
      // The loudest frame's moment is within 50 ms of the click.
      expect(Math.abs((best + 0.5) * HOP - c)).toBeLessThanOrEqual(0.05);
    }
  });

  test("the pitch of a held note reads true, and silence has none", () => {
    for (const hz of [110, 220, 440, 880]) {
      const s = new Float32Array(RATE * 2);
      for (let i = RATE / 2; i < s.length; i++) s[i] = 0.3 * Math.sin((2 * Math.PI * hz * i) / RATE) + 0.1 * Math.sin((4 * Math.PI * hz * i) / RATE); // prettier-ignore
      const out = measure(s);
      const f = (i) => out.feat[i * FIELDS.length + F.f0];
      expect(f(5)).toBe(0); // silence
      expect(Math.abs(f(30) / hz - 1)).toBeLessThan(0.01);
    }
  });

  test("measuring in chunks, in any order, gives the same numbers as all at once", () => {
    const s = clickTrack(8);
    const all = measure(s);
    const out = makeFeatures(all.n);
    const A = makeAnalyser(RATE);
    for (const [a, b] of [[100, 150], [0, 50], [150, all.n], [50, 100]]) analyzeFrames(A, s, a, b, out); // prettier-ignore
    let worst = 0;
    for (let i = 0; i < all.feat.length; i++)
      worst = Math.max(worst, Math.abs(all.feat[i] - out.feat[i]));
    expect(worst).toBeLessThan(1e-3);
  });
});

// ---- In the browser -------------------------------------------------------------------------
async function songPage(playwright) {
  const use = config.use.launchOptions;
  const browser = await playwright.chromium.launch({ ...use, args: [...use.args, "--autoplay-policy=no-user-gesture-required"] }); // prettier-ignore
  const page = await browser.newPage({ viewport: { width: 390, height: 844 }, baseURL: config.use.baseURL }); // prettier-ignore
  const errors = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.addInitScript(() => localStorage.setItem("splashery.sound", "on"));
  await page.goto(APP);
  await page.waitForSelector("body[data-ready='true']", { timeout: 180_000 });
  await page.evaluate(() => window.__splashery.app.chooseToy("song-landscape"));
  await page.waitForTimeout(1500);
  return { browser, page, errors };
}

// Polls fn in the page until it returns something truthy.
async function until(page, fn, arg, ms = 60_000) {
  const t0 = Date.now();
  for (;;) {
    const v = await page.evaluate(fn, arg);
    if (v) return v;
    if (Date.now() - t0 > ms) throw new Error(`timed out: ${fn}`);
    await page.waitForTimeout(100);
  }
}

const studio = "/src/packs/studio.js";

test.describe("in the browser", () => {
  test("a long song plays from the file at once and is measured while it plays", async ({
    playwright,
  }) => {
    const { browser, page, errors } = await songPage(playwright);
    await page.locator("#toy-input-file").setInputFiles(CLICK_WAV);
    await until(page, () => window.__splashery.player.proc?.ctx?.kit?.data?.song?.song?.long);
    await page.evaluate(() => window.__splashery.app.act());
    const st = await until(page, async (m) => {
      const s = (await import(m)).playState();
      return s.on && s.pos > 0.2 ? s : null;
    }, studio); // prettier-ignore
    expect(st.long).toBe(true);
    expect(st.audio).toBe(true);
    const an = await until(page, async (m) => {
      const a = (await import(m)).songAnalysisState();
      return a.finished || a.error ? a : null;
    }, studio); // prettier-ignore
    expect(an.error).toBe(null);
    expect(an.progress).toBe(1);
    expect(an.land).toBe(true);
    // A tap pauses, and the clock holds.
    await page.evaluate(() => window.__splashery.app.act());
    const a = await until(page, async (m) => {
      const s = (await import(m)).playState();
      return s.on ? null : s;
    }, studio); // prettier-ignore
    await page.waitForTimeout(500);
    const b = await page.evaluate(async (m) => (await import(m)).playState(), studio);
    expect(b.pos).toBeCloseTo(a.pos, 3);
    expect(errors).toEqual([]);
    await browser.close();
  });

  test("the click track: each click is at the now mark within 50 ms of when it is heard", async ({
    playwright,
  }) => {
    const { browser, page, errors } = await songPage(playwright);
    await page.evaluate(() =>
      window.__splashery.app.setToyOptions({ look: "lines", view: "live" }),
    );
    await page.locator("#toy-input-file").setInputFiles(CLICK_WAV);
    await until(page, () => window.__splashery.player.proc?.ctx?.kit?.data?.song?.song?.long);
    // Measured up to the clicks first (the worker starts at the playhead).
    await until(page, async (m) => (await import(m)).songAnalysisState().progress > 0.5, studio);
    await page.evaluate(() => window.__splashery.app.act());
    // While it plays, two records on the page's clock (performance.now):
    // - heard: when each click comes out, found by an analyser on the
    //   song's own output and placed with the audio output's timestamp;
    // - drawn: each frame drawn and the moment the toy's audio clock gave it.
    const rec = await page.evaluate(
      async ({ m, CLICKS }) => {
        const { songShown, songTest } = await import(m);
        const { track } = songTest();
        const ctx = track.ctx;
        const an = ctx.createAnalyser();
        an.fftSize = 32768; // 0.74 s: no click is missed between frames
        track.src.connect(an);
        const buf = new Float32Array(an.fftSize);
        const heard = [];
        const drawn = [];
        const t0 = performance.now();
        await new Promise((done) => {
          const step = () => {
            const p = performance.now();
            an.getFloatTimeDomainData(buf);
            const ts = ctx.getOutputTimestamp();
            let at = -1;
            for (let i = 0; i < buf.length; i++) if (Math.abs(buf[i]) > 0.25) { at = i; break; } // prettier-ignore
            if (at >= 0) {
              // The analyser holds the newest samples, ending at currentTime;
              // the output timestamp says when a context moment is heard.
              const ct = ctx.currentTime - (buf.length - at) / ctx.sampleRate;
              const ph = ts.performanceTime + (ct - ts.contextTime) * 1000;
              if (!heard.length || ph - heard[heard.length - 1] > 300) heard.push(ph);
            }
            const s = songShown();
            if (s) drawn.push([p, s.now]);
            if (p - t0 < 19_000) requestAnimationFrame(step);
            else done();
          };
          requestAnimationFrame(step);
        });
        // Where each click's loudest frame is (its middle, in the song).
        const { features: fe } = songTest();
        const nfi = 10;
        const peaks = (c) => {
          let best = -1;
          for (let i = Math.max(0, Math.floor(c / 0.04) - 5); i <= Math.floor(c / 0.04) + 5; i++) if (best < 0 || fe.feat[i * nfi] > fe.feat[best * nfi]) best = i; // prettier-ignore
          return (best + 0.5) * 0.04;
        };
        return { heard, drawn, peaks: CLICKS.map(peaks), latency: track.latency() };
      },
      { m: studio, CLICKS },
    );
    // A click's line crosses the now mark when the toy's clock reaches its
    // frame's middle: on the page's clock, that frame's moment plus the
    // drawing's offset (performance time less song time) around then.
    const rows = [];
    const t0 = rec.drawn[0][0] - rec.drawn[0][1] * 1000;
    for (let k = 0; k < CLICKS.length; k++) {
      const c = CLICKS[k];
      const h = rec.heard.find((x) => Math.abs((x - t0) / 1000 - c) < 0.3);
      const near = rec.drawn.filter(([, now]) => Math.abs(now - c) < 1);
      if (h === undefined || near.length < 3) continue;
      const off = near.reduce((a, [p, now]) => a + (p - now * 1000), 0) / near.length;
      const crossed = off + rec.peaks[k] * 1000;
      rows.push({ click: c, offMs: Math.round(crossed - h) });
    }
    console.log("live2 sync:", JSON.stringify({ latencyMs: Math.round(rec.latency * 1000), rows }));
    expect(rows.length).toBeGreaterThanOrEqual(CLICKS.length - 2);
    for (const r of rows) expect(Math.abs(r.offMs)).toBeLessThanOrEqual(50);
    expect(errors).toEqual([]);
    await browser.close();
  });

  for (const look of ["ribbons", "tube", "lines", "mesh"]) {
    test(`${look}: builds in both views, on paper and alone, and fills in as it plays`, async ({
      playwright,
    }) => {
      const { browser, page, errors } = await songPage(playwright);
      const counts = {};
      for (const view of ["whole", "live"])
        for (const backdrop of ["paper", "none"]) {
          await page.evaluate((o) => window.__splashery.app.setToyOptions(o), {
            look,
            view,
            backdrop,
          });
          await until(page, (o) => {
            const d = window.__splashery.player.proc?.ctx?.kit?.data?.song;
            return d?.r2 && d.look === o.look && d.live === (o.view === "live");
          }, { look, view }); // prettier-ignore
          await until(page, async (m) => (await import(m)).songAnalysisState().finished, studio);
          counts[`${view}-${backdrop}`] = await page.evaluate(() => window.__splashery.player.toyInfo.splats); // prettier-ignore
        }
      // The paper is its own splats.
      expect(counts["whole-paper"]).toBeGreaterThan(counts["whole-none"]);
      // Playing: what is drawn at the now mark changes as the song goes.
      await page.evaluate(() => window.__splashery.app.act());
      const seen = new Set();
      for (let i = 0; i < 20; i++) {
        const s = await page.evaluate(async (m) => (await import(m)).songShown(), studio);
        if (s) seen.add(s.now.toFixed(2));
        await page.waitForTimeout(100);
      }
      expect(seen.size).toBeGreaterThan(3);
      if (look === "lines" || look === "ribbons") {
        await page.evaluate(() =>
          window.__splashery.app.setToyOptions({ view: "whole", backdrop: "paper" }),
        );
        await page.waitForTimeout(2500);
        for (const [w, h] of [
          [390, 844],
          [1440, 900],
        ]) {
          await page.setViewportSize({ width: w, height: h });
          await page.waitForTimeout(1200);
          await page.screenshot({ path: `tests/screenshots/live2-${look}-${w}x${h}.png` });
        }
      }
      expect(errors).toEqual([]);
      await browser.close();
    });
  }
});
