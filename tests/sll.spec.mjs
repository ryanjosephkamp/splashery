// Lane Sound and light lab (docs/handoff/SoundLightLab.md): the Sound lab,
// the Sound recorder and the Light lab. Every signal and picture is made
// here or by the page: tones, a WAV for the fake microphone, a made-up
// photo of a fluorescent lamp's spectrum. No outside files.

import { test, expect } from "@playwright/test";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import config from "../playwright.config.mjs";
import { toneSamples, spectrumDb, peakOf, rmsDb, metronome, clickTimes, wavBytes, readWav, trimmed, soundSpan } from "../src/labs/sound-dsp.js"; // prettier-ignore
import { NIST_LINES } from "../src/labs/nist-lines.js";
import { bk7, prismGeometry, minDeviationBeam, prismRay, minDeviation, gratingAngle, GRATINGS, lineSpectrum, samplePhoto, brightBand, profileOf, calibrate, peaksOf, nmColor } from "../src/labs/light-optics.js"; // prettier-ignore
import { glassIndex } from "../src/packs/light-lab.js";

const APP = "/?renderer=webgl2&adapt=off&profile=mid&labs=1";
const RATE = 48000;

// ---- The sums (Node) -------------------------------------------------------------------

test.describe("sound sums", () => {
  test("the spectrum's peak lands on a known tone", () => {
    for (const f of [100, 440, 1000, 3000, 12000]) {
      const x = toneSamples({ wave: "sine", f, vol: 0.5 }, RATE, 0.1, 4096);
      const p = peakOf(spectrumDb(x), RATE, 4096);
      expect(Math.abs(p.hz - f) / f).toBeLessThan(0.005);
      expect(Math.abs(p.db - 20 * Math.log10(0.5))).toBeLessThan(0.6); // a half-scale sine: −6 dB
    }
  });

  test("a square wave's odd harmonics are a third and a fifth of its fundamental", () => {
    const f = 375; // exactly on a bin (48000 / 4096 × 32)
    const db = spectrumDb(toneSamples({ wave: "square", f, vol: 1 }, RATE, 0, 4096));
    const at = (hz) => db[Math.round(hz / (RATE / 4096))];
    expect(at(3 * f) - at(f)).toBeCloseTo(20 * Math.log10(1 / 3), 0);
    expect(at(5 * f) - at(f)).toBeCloseTo(20 * Math.log10(1 / 5), 0);
    expect(at(2 * f) - at(f)).toBeLessThan(-40); // no even harmonics
  });

  test("two tones 3 Hz apart beat three times a second", () => {
    const x = toneSamples(
      { wave: "sine", f: 440, f2: 443, two: true, vol: 0.8 },
      RATE,
      0,
      RATE * 2,
    );
    // The loudness in 10 ms windows: count its dips over two seconds.
    const hop = RATE / 100;
    const lv = [];
    for (let i = 0; i + hop <= x.length; i += hop) lv.push(rmsDb(x, i, i + hop));
    let dips = 0;
    for (let i = 1; i < lv.length - 1; i++) if (lv[i] < lv[i - 1] && lv[i] <= lv[i + 1] && lv[i] < -20) dips++; // prettier-ignore
    expect(dips).toBe(6);
  });

  test("a sine's level is 3 dB under its peak", () => {
    expect(rmsDb(toneSamples({ wave: "sine", f: 1000, vol: 1 }, RATE, 0, RATE))).toBeCloseTo(-3.01, 1); // prettier-ignore
    expect(rmsDb(toneSamples({ wave: "square", f: 1000, vol: 0.5 }, RATE, 0, RATE))).toBeCloseTo(-6.02, 1); // prettier-ignore
  });

  test("the metronome clicks once a beat, at the ends of its swing", () => {
    const c = clickTimes(120, 0, 3);
    expect(c.length).toBe(6);
    for (let i = 1; i < c.length; i++) expect(c[i].t - c[i - 1].t).toBeCloseTo(0.5, 9);
    for (const { t } of c) expect(Math.abs(metronome(120, t).angle)).toBeCloseTo(0.42, 6);
    expect(metronome(120, 0).angle).toBe(0);
  });

  test("a WAV file round-trips sample for sample", () => {
    const x = toneSamples({ wave: "sawtooth", f: 220, vol: 0.7 }, 44100, 0, 44100);
    const back = readWav(wavBytes(x, 44100));
    expect(back.rate).toBe(44100);
    expect(back.samples.length).toBe(x.length);
    let err = 0;
    for (let i = 0; i < x.length; i++) err = Math.max(err, Math.abs(back.samples[i] - x[i]));
    expect(err).toBeLessThanOrEqual(0.5 / 32767 + 1e-9); // half a step of 16 bits
  });

  test("a trim keeps its span, fades its ends and finds the sound", () => {
    const x = new Float32Array(RATE * 2);
    x.set(toneSamples({ wave: "sine", f: 500, vol: 0.5 }, RATE, 0, RATE / 2), RATE * 0.75);
    const [a, b] = soundSpan(x, RATE);
    expect(a).toBeGreaterThan(0.65);
    expect(a).toBeLessThan(0.76);
    expect(b).toBeGreaterThan(1.24);
    expect(b).toBeLessThan(1.35);
    const t = trimmed(x, RATE, 0.8, 1.2);
    expect(t.length).toBe(Math.round(0.4 * RATE));
    expect(Math.abs(t[0])).toBeLessThan(1e-6);
  });
});

test.describe("light sums", () => {
  // Values read off NIST's Handbook "Strong Lines" tables (air, Å → nm).
  const NIST = [
    ["H", 656.28518],
    ["H", 486.13615],
    ["He", 587.56148],
    ["Ne", 640.2248],
    ["Na", 588.995],
    ["Na", 589.5924],
    ["Hg", 435.8328],
    ["Hg", 546.0735],
    ["Li", 670.7775],
  ];
  test("the shipped lines are NIST's", () => {
    for (const [sym, nm] of NIST) {
      const e = NIST_LINES.find((x) => x.symbol === sym);
      expect(
        e.lines.some((l) => Math.abs(l[0] - nm) < 1e-6),
        `${sym} ${nm}`,
      ).toBe(true);
    }
    for (const e of NIST_LINES) {
      expect(e.source).toMatch(/^https:\/\/physics\.nist\.gov\/PhysRefData\/Handbook\/Tables\/\w+table2\.htm$/); // prettier-ignore
      expect(e.lines.length).toBeGreaterThan(2);
      for (const [nm] of e.lines) expect(nm >= 380 && nm <= 750).toBe(true);
    }
    expect(NIST_LINES.length).toBe(16);
    // Hydrogen's fine-structure components merge into one line each for the eye.
    const h = lineSpectrum("H").map((l) => l.nm);
    expect(h.some((nm) => Math.abs(nm - 656.28) < 0.01)).toBe(true);
    expect(h.filter((nm) => Math.abs(nm - 656.28) < 0.1).length).toBe(1);
  });

  test("glass indexes match the makers' values", () => {
    expect(bk7(587.5618)).toBeCloseTo(1.5168, 4);
    expect(glassIndex("bk7", 587.5618)).toBeCloseTo(1.5168, 4);
    expect(glassIndex("sf11", 587.5618)).toBeCloseTo(1.78472, 4);
    expect(glassIndex("sf11", 450)).toBeGreaterThan(glassIndex("sf11", 650)); // blue bends more
  });

  test("the traced prism passes the beam at the textbook minimum deviation", () => {
    for (const glass of ["bk7", "sf11"]) {
      const P = prismGeometry();
      const n = glassIndex(glass, 550);
      const beam = minDeviationBeam(P, n);
      const r = prismRay(550, { prism: P, ...beam, n });
      expect(r.deviation).toBeCloseTo(minDeviation(n), 6);
      // Inside, it runs parallel to the base.
      expect(Math.abs(r.d1[1])).toBeLessThan(1e-9);
      const blue = prismRay(420, { prism: P, ...beam, n: glassIndex(glass, 420) });
      const red = prismRay(680, { prism: P, ...beam, n: glassIndex(glass, 680) });
      expect(blue.deviation).toBeGreaterThan(red.deviation);
    }
  });

  test("grating angles follow d sin θ = m λ", () => {
    expect(gratingAngle(500, GRATINGS.cd.d, 1)).toBeCloseTo(Math.asin(500 / 1600), 12);
    expect(gratingAngle(650, GRATINGS.dvd.d, 1)).toBeCloseTo(Math.asin(650 / 740), 12);
    expect(gratingAngle(400, GRATINGS.dvd.d, 2)).toBe(null); // 800 nm > 740 nm: no second order
    expect(gratingAngle(500, 1000, -1)).toBeCloseTo(-Math.PI / 6, 12);
  });

  test("the spectrometer finds a fluorescent lamp's mercury lines within 2 nm", () => {
    for (const flip of [false, true])
      for (const nmPerPx of [0.6, 0.9]) {
        const img = samplePhoto({ flip, nmPerPx, x380: 30 });
        const [y0, y1] = brightBand(img);
        expect(y0).toBeLessThan(img.height / 2);
        expect(y1).toBeGreaterThan(img.height / 2);
        const p = profileOf(img, y0, y1);
        const cal = calibrate(p);
        expect(cal).not.toBe(null);
        const peaks = peaksOf(p, cal).map((q) => q.nm);
        for (const hg of [404.6563, 435.8328, 546.0735])
          expect(Math.min(...peaks.map((nm) => Math.abs(nm - hg))), `${hg} (flip ${flip}, ${nmPerPx})`).toBeLessThan(2); // prettier-ignore
      }
  });

  test("wavelength colors run violet, blue, green, yellow, red", () => {
    const hue = (nm) => {
      const [r, g, b] = nmColor(nm);
      return [r, g, b].indexOf(Math.max(r, g, b));
    };
    expect(hue(450)).toBe(2);
    expect(hue(530)).toBe(1);
    expect(hue(650)).toBe(0);
    expect(nmColor(300)).toEqual([0, 0, 0]);
  });
});

// ---- In the page --------------------------------------------------------------------------

const DIR = fs.mkdtempSync(path.join(os.tmpdir(), "splashery-sll-"));
function wavFile(name, samples) {
  const file = path.join(DIR, name);
  fs.writeFileSync(file, wavBytes(samples, RATE));
  return file;
}
// 1 kHz at half scale, 8 s, for the fake microphone.
const KHZ = wavFile("khz.wav", toneSamples({ wave: "sine", f: 1000, vol: 0.5 }, RATE, 0, RATE * 8));

const withMic = (file) => ({
  ...config.use.launchOptions,
  args: [
    ...config.use.launchOptions.args,
    "--use-fake-ui-for-media-stream",
    "--use-fake-device-for-media-stream",
    `--use-file-for-fake-audio-capture=${file}`,
  ],
});

const SPY = () => {
  window.__liveCalls = [];
  const md = navigator.mediaDevices;
  for (const name of ["getUserMedia", "getDisplayMedia"]) {
    const f = md?.[name]?.bind(md);
    if (f)
      md[name] = (...a) => {
        window.__liveCalls.push(name);
        return f(...a);
      };
  }
};

async function open(page, toy) {
  await page.goto(APP);
  await page.waitForSelector("body[data-ready='true']", { timeout: 180_000 });
  await page.evaluate((t) => window.__splashery.app.chooseToy(t), toy);
  await page.waitForFunction((t) => window.__splashery.player.scene.toy.id === t && window.__splashery.player.motion.recipe, toy, { timeout: 120_000 }); // prettier-ignore
}

async function until(page, check, arg = null, timeout = 60_000) {
  const end = Date.now() + timeout;
  for (;;) {
    if (await page.evaluate(check, arg)) return;
    if (Date.now() > end) throw new Error(`Timed out waiting for ${check}`);
    await page.waitForTimeout(250);
  }
}

const click = (page, sel) => page.evaluate((s) => document.querySelector(s).click(), sel);
const state = (page, mod, fn) =>
  page.evaluate(([m, f]) => import(m).then((x) => x[f]()), [mod, fn]);

test.describe("in the page", () => {
  test.setTimeout(300_000);

  test("Sound lab: a tap plays a tone and the screens measure it; the microphone only after its button", async ({
    playwright,
    baseURL,
  }) => {
    const browser = await playwright.chromium.launch(withMic(KHZ));
    const page = await browser.newPage({ baseURL, viewport: { width: 1440, height: 900 } });
    try {
      await page.addInitScript(SPY);
      await open(page, "sound-lab");
      const S = "/src/packs/sound-lab.js";
      expect((await state(page, S, "soundLabState")).source).toBe("quiet");
      await page.evaluate(() => window.__splashery.app.act());
      await until(page, () => import("/src/packs/sound-lab.js").then((m) => m.soundLabState().source === "tone" && m.soundLabState().histPeakHz)); // prettier-ignore
      let s = await state(page, S, "soundLabState");
      expect(Math.abs(s.peak.hz - 440)).toBeLessThan(2);
      // The spectrogram's rows are about a sixth of an octave: its newest column peaks within one.
      expect(Math.abs(Math.log2(s.histPeakHz / 440))).toBeLessThan(1 / 12);
      await page.evaluate(() =>
        import("/src/packs/sound-lab.js").then((m) => m.setTone({ f: 3000 })),
      );
      await until(page, () => import("/src/packs/sound-lab.js").then((m) => Math.abs((m.soundLabState().peak?.hz ?? 0) - 3000) < 10)); // prettier-ignore
      expect(await page.evaluate(() => window.__liveCalls.length)).toBe(0);
      // A tap stops the tone; the microphone then fills the screens.
      await page.evaluate(() => window.__splashery.app.act());
      await click(page, "#live-mic");
      await until(page, () => import("/src/packs/sound-lab.js").then((m) => m.soundLabState().source === "mic" && m.soundLabState().peak)); // prettier-ignore
      s = await state(page, S, "soundLabState");
      expect(Math.abs(s.peak.hz - 1000)).toBeLessThan(5);
      expect(await page.evaluate(() => window.__liveCalls)).toEqual(["getUserMedia"]);
      // Its metronome swings.
      await page.evaluate(() =>
        import("/src/packs/sound-lab.js").then((m) => m.setMetronome(true, 120)),
      );
      await page.waitForTimeout(600);
      const rod = await page.evaluate(() => window.__splashery.player.motion.out.parts.rod.angle);
      expect(Number.isFinite(rod)).toBe(true);
      await page.screenshot({ path: "tests/screenshots/sll-sound-lab-1440x900.png" });
    } finally {
      await browser.close();
    }
  });

  test("Sound recorder: records from the microphone after Record, and its WAV round-trips", async ({
    playwright,
    baseURL,
  }) => {
    const browser = await playwright.chromium.launch(withMic(KHZ));
    const page = await browser.newPage({ baseURL, viewport: { width: 390, height: 844 } });
    try {
      await page.addInitScript(SPY);
      await open(page, "sound-recorder");
      const S = "/src/packs/sound-lab.js";
      expect((await state(page, S, "recorderState")).take.name).toMatch(/Sample/);
      expect(await page.evaluate(() => window.__liveCalls.length)).toBe(0);
      await click(page, "#sll-record");
      await until(page, () => import("/src/packs/sound-lab.js").then((m) => m.recorderState().recording)); // prettier-ignore
      await page.waitForTimeout(2500);
      await click(page, "#sll-record");
      await until(page, () => import("/src/packs/sound-lab.js").then((m) => !m.recorderState().recording)); // prettier-ignore
      const r = await state(page, S, "recorderState");
      expect(r.take.name).toMatch(/Your recording/);
      expect(r.take.duration).toBeGreaterThan(1);
      expect(await page.evaluate(() => window.__liveCalls)).toEqual(["getUserMedia"]);
      // The microphone is let go once the recording stops.
      expect(await page.evaluate(() => import("/src/live/live.js").then((m) => m.live.on("mic")))).toBe(false); // prettier-ignore
      // The recording's file: trimmed, written, read back and decoded by the browser.
      const check = await page.evaluate(async () => {
        const m = await import("/src/packs/sound-lab.js");
        const d = await import("/src/labs/sound-dsp.js");
        m.setTrim(0.5, 1.0);
        const t = m.trimmedTake();
        const bytes = m.recordingWav();
        const back = d.readWav(bytes);
        let err = 0;
        for (let i = 0; i < t.samples.length; i++) err = Math.max(err, Math.abs(back.samples[i] - t.samples[i])); // prettier-ignore
        const ctx = new OfflineAudioContext(1, 1, back.rate);
        const dec = await ctx.decodeAudioData(bytes.slice().buffer);
        const ch = dec.getChannelData(0);
        let err2 = 0;
        for (let i = 0; i < t.samples.length; i++) err2 = Math.max(err2, Math.abs(ch[i] - t.samples[i])); // prettier-ignore
        const p = d.peakOf(d.spectrumDb(back.samples.slice(0, 4096)), back.rate, 4096);
        return { n: t.samples.length, rate: back.rate, len: back.samples.length, dlen: dec.length, err, err2, hz: p.hz }; // prettier-ignore
      });
      expect(check.len).toBe(check.n);
      expect(check.dlen).toBe(check.n);
      expect(Math.abs(check.n / check.rate - 0.5)).toBeLessThan(0.01);
      expect(check.err).toBeLessThanOrEqual(0.5 / 32767 + 1e-9);
      expect(check.err2).toBeLessThanOrEqual(2 / 32768); // the browser reads 16 bits as n / 32768
      expect(Math.abs(check.hz - 1000)).toBeLessThan(5); // what the fake microphone played
      await page.screenshot({ path: "tests/screenshots/sll-sound-recorder-390x844.png" });
    } finally {
      await browser.close();
    }
  });

  test("Light lab: spectra, a prism and a grating rebuilt per lamp by a tap, and the spectrometer's sample", async ({
    page,
  }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.addInitScript(SPY);
    await open(page, "light-lab");
    const L = "/src/packs/light-lab.js";
    let s = await state(page, L, "lightLabState");
    expect(s.view).toBe("spectra");
    expect(s.highlight).toBe("H");
    await page.evaluate(() => window.__splashery.app.act());
    await until(page, () => import("/src/packs/light-lab.js").then((m) => m.lightLabState().highlight === "He")); // prettier-ignore
    await page.screenshot({ path: "tests/screenshots/sll-light-lab-1440x900.png" });
    for (const view of ["prism", "grating"]) {
      await page.evaluate((v) => window.__splashery.app.setToyOptions({ view: v }), view);
      await until(page, (v) => import("/src/packs/light-lab.js").then((m) => m.lightLabState().view === v && m.lightLabState().rays > 100), view); // prettier-ignore
      s = await state(page, L, "lightLabState");
      expect(s.card.x1).toBeGreaterThan(s.card.x0);
      const before = s.source;
      await page.evaluate(() => window.__splashery.app.act());
      await until(page, (b) => import("/src/packs/light-lab.js").then((m) => m.lightLabState().source !== b), before); // prettier-ignore
    }
    await page.evaluate(() => window.__splashery.app.setToyOptions({ view: "camera" }));
    await until(page, () => import("/src/packs/light-lab.js").then((m) => m.lightLabState().reading?.cal)); // prettier-ignore
    s = await state(page, L, "lightLabState");
    expect(s.reading.from).toBe("sample");
    for (const hg of [435.8328, 546.0735]) expect(Math.min(...s.reading.peaks.map((nm) => Math.abs(nm - hg)))).toBeLessThan(2); // prettier-ignore
    expect(await page.evaluate(() => window.__liveCalls.length)).toBe(0);
    await page.setViewportSize({ width: 390, height: 844 });
    await page.waitForTimeout(800);
    await page.screenshot({ path: "tests/screenshots/sll-light-lab-390x844.png" });
  });
});
