#!/usr/bin/env node
// Renders every toy's tap sound offline (an OfflineAudioContext in headless
// Chromium, through the same limiter the app uses) and checks it: not silent,
// not clipping, not too long. With --sheet it also draws a spectrogram of
// each sound into one PNG, for a look at what every voice is doing.
//
//   python3 -m http.server 4173 --bind 127.0.0.1   # in another shell
//   node tools/sound-check.mjs                      # all toys
//   node tools/sound-check.mjs rubber-duck guitar   # some toys
//   node tools/sound-check.mjs --sheet=tests/screenshots/d-sounds.png
//   node tools/sound-check.mjs --wav=/tmp/sounds    # also write WAV files
//   node tools/sound-check.mjs --voices             # measure each voice's LEVEL
//
// Toggles are rendered twice (id:on and id:off). Exits non-zero on a problem.

import fs from "node:fs";
import path from "node:path";
import { chromium } from "@playwright/test";

const args = process.argv.slice(2);
const opt = (name) => args.find((a) => a.startsWith(`--${name}=`))?.split("=")[1];
const ids = args.filter((a) => !a.startsWith("--"));
const base = opt("base") || "http://127.0.0.1:4173";
const sheet = opt("sheet");
const wav = opt("wav");

export const LIMITS = { minPeak: 0.02, maxPeak: 0.99, maxSeconds: 5 };

// Each voice's loudness at its defaults, and the level that evens it out.
if (args.includes("--voices")) {
  const browser = await chromium.launch({
    executablePath: process.env.SPLASHERY_CHROMIUM || undefined,
  });
  const page = await browser.newPage();
  await page.goto(`${base}/tools/`);
  const levels = await page.evaluate(async () => {
    const { playSpec, VOICE_NAMES } = await import("/src/voices.js");
    const out = {};
    for (const voice of VOICE_NAMES) {
      let loud = 0;
      let peak = 0;
      // Noisy voices differ each time, so take the loudest of three.
      for (let k = 0; k < 3; k++) {
        const rate = 22050;
        const ctx = new OfflineAudioContext(1, rate * 5, rate);
        const g = ctx.createGain();
        g.gain.value = 0.35;
        g.connect(ctx.destination);
        playSpec(ctx, g, 0.01, { voice }, { raw: true });
        const d = (await ctx.startRendering()).getChannelData(0);
        const W = Math.round(rate * 0.05);
        let acc = 0;
        for (let i = 0; i < d.length; i++) {
          acc += d[i] * d[i] - (i >= W ? d[i - W] * d[i - W] : 0);
          loud = Math.max(loud, Math.sqrt(Math.max(0, acc) / W));
          peak = Math.max(peak, Math.abs(d[i]));
        }
      }
      out[voice] = { loud, peak };
    }
    return out;
  });
  const table = {};
  for (const [voice, { loud, peak }] of Object.entries(levels)) {
    const level = Math.min(12, Math.max(0.3, Math.sqrt((0.09 / loud) * (0.3 / peak))));
    table[voice] = +level.toFixed(2);
    console.log(`${voice.padEnd(10)} loud ${loud.toFixed(4)}  peak ${peak.toFixed(3)}  level ${table[voice]}`); // prettier-ignore
  }
  console.log(`\nconst LEVEL = ${JSON.stringify(table)};`);
  await browser.close();
  process.exit(0);
}

const browser = await chromium.launch({
  executablePath: process.env.SPLASHERY_CHROMIUM || undefined,
});
const page = await browser.newPage();
await page.goto(`${base}/tools/`);
const results = await page.evaluate(
  async ({ ids, wantSheet, wantWav }) => {
    const { TOY_SOUNDS } = await import("/src/toy-sounds.js");
    const { playSpec, specFor } = await import("/src/voices.js");
    const { masterChain } = await import("/src/sound.js");
    const rate = 22050;
    const seconds = 6;
    const jobs = [];
    for (const id of ids.length ? ids : Object.keys(TOY_SOUNDS)) {
      const spec = TOY_SOUNDS[id];
      if (!spec) {
        jobs.push({ id, missing: true });
        continue;
      }
      const toggle = typeof spec === "object" && !Array.isArray(spec) && "on" in spec;
      if (toggle) {
        jobs.push({ id: `${id}:on`, spec: specFor(spec, true) });
        jobs.push({ id: `${id}:off`, spec: specFor(spec, false) });
      } else jobs.push({ id, spec });
    }
    const out = [];
    for (const job of jobs) {
      if (job.missing) {
        out.push({ id: job.id, problem: "no sound" });
        continue;
      }
      const ctx = new OfflineAudioContext(1, rate * seconds, rate);
      const master = masterChain(ctx);
      playSpec(ctx, master, 0.01, job.spec);
      const buf = await ctx.startRendering();
      const d = buf.getChannelData(0);
      let peak = 0;
      let sum = 0;
      let last = 0;
      for (let i = 0; i < d.length; i++) {
        const a = Math.abs(d[i]);
        if (a > peak) peak = a;
        sum += d[i] * d[i];
        if (a > 0.003) last = i;
      }
      const r = {
        id: job.id,
        peak: +peak.toFixed(3),
        rms: +Math.sqrt(sum / Math.max(1, last)).toFixed(4),
        seconds: +(last / rate).toFixed(2),
      };
      if (wantSheet) {
        // A small spectrogram: 64 log-spaced bands from 60 Hz to 10 kHz,
        // one column per 25 ms, by a sliding Goertzel (plenty for a look).
        const cols = Math.min(160, Math.ceil((last / rate + 0.1) / 0.025));
        const bands = 48;
        const hop = Math.floor(rate * 0.025);
        const win = 512;
        const grid = [];
        for (let b = 0; b < bands; b++) {
          const f = 60 * (10000 / 60) ** (b / (bands - 1));
          const w = (2 * Math.PI * f) / rate;
          const coeff = 2 * Math.cos(w);
          const row = [];
          for (let c = 0; c < cols; c++) {
            let s1 = 0;
            let s2 = 0;
            const start = c * hop;
            for (let i = 0; i < win && start + i < d.length; i++) {
              const hann = 0.5 - 0.5 * Math.cos((2 * Math.PI * i) / win);
              const s0 = d[start + i] * hann + coeff * s1 - s2;
              s2 = s1;
              s1 = s0;
            }
            const p = s1 * s1 + s2 * s2 - coeff * s1 * s2;
            row.push(Math.max(0, Math.min(1, (10 * Math.log10(p + 1e-9) + 30) / 60)));
          }
          grid.push(row);
        }
        r.grid = grid;
      }
      if (wantWav) {
        const n = last + Math.floor(rate * 0.1);
        const bytes = new Uint8Array(44 + n * 2);
        const v = new DataView(bytes.buffer);
        const str = (o, s) => [...s].forEach((ch, i) => v.setUint8(o + i, ch.charCodeAt(0)));
        str(0, "RIFF");
        v.setUint32(4, 36 + n * 2, true);
        str(8, "WAVEfmt ");
        v.setUint32(16, 16, true);
        v.setUint16(20, 1, true);
        v.setUint16(22, 1, true);
        v.setUint32(24, rate, true);
        v.setUint32(28, rate * 2, true);
        v.setUint16(32, 2, true);
        v.setUint16(34, 16, true);
        str(36, "data");
        v.setUint32(40, n * 2, true);
        for (let i = 0; i < n; i++)
          v.setInt16(44 + i * 2, Math.max(-1, Math.min(1, d[i] || 0)) * 32767, true);
        let bin = "";
        for (let i = 0; i < bytes.length; i += 8192)
          bin += String.fromCharCode(...bytes.subarray(i, i + 8192));
        r.wav = btoa(bin);
      }
      out.push(r);
    }
    return out;
  },
  { ids, wantSheet: !!sheet, wantWav: !!wav },
);

const problems = [];
for (const r of results) {
  if (r.problem) problems.push(`${r.id}: ${r.problem}`);
  else if (r.peak < LIMITS.minPeak) problems.push(`${r.id}: nearly silent (peak ${r.peak})`);
  else if (r.peak > LIMITS.maxPeak) problems.push(`${r.id}: clips (peak ${r.peak})`);
  else if (r.seconds > LIMITS.maxSeconds) problems.push(`${r.id}: lasts ${r.seconds} s`);
}
for (const r of results)
  if (!r.problem) console.log(`${r.id.padEnd(26)} peak ${r.peak}  rms ${r.rms}  ${r.seconds} s`);

if (wav) {
  fs.mkdirSync(wav, { recursive: true });
  for (const r of results)
    if (r.wav) fs.writeFileSync(path.join(wav, `${r.id.replace(":", "-")}.wav`), Buffer.from(r.wav, "base64")); // prettier-ignore
  console.log(`WAV files in ${wav}`);
}

if (sheet) {
  // Draw the spectrograms in the browser: 6 per row, labelled, 60 to a
  // page (sheet.png, then sheet-2.png, ...).
  const all = results.filter((r) => r.grid);
  for (let pg = 0; pg * 60 < all.length; pg++) {
    const cells = all.slice(pg * 60, pg * 60 + 60);
    const png = await page.evaluate((cells) => {
      const W = 200;
      const H = 72;
      const per = 6;
      const rows = Math.ceil(cells.length / per);
      const cv = document.createElement("canvas");
      cv.width = per * W;
      cv.height = rows * (H + 14);
      const g = cv.getContext("2d");
      g.fillStyle = "#111";
      g.fillRect(0, 0, cv.width, cv.height);
      g.font = "11px sans-serif";
      cells.forEach((c, i) => {
        const x0 = (i % per) * W;
        const y0 = Math.floor(i / per) * (H + 14);
        g.fillStyle = "#ddd";
        g.fillText(`${c.id} ${c.seconds}s`, x0 + 3, y0 + 11);
        const bands = c.grid.length;
        const cols = c.grid[0].length;
        const cw = (W - 4) / 160;
        const bh = H / bands;
        for (let b = 0; b < bands; b++)
          for (let k = 0; k < cols; k++) {
            const v = c.grid[b][k];
            g.fillStyle = `rgb(${Math.round(255 * Math.min(1, v * 1.6))},${Math.round(255 * v * v)},${Math.round(90 * v + 30)})`; // prettier-ignore
            g.fillRect(x0 + 2 + k * cw, y0 + 14 + H - (b + 1) * bh, cw + 0.5, bh + 0.5);
          }
      });
      return cv.toDataURL("image/png");
    }, cells);
    const file = pg ? sheet.replace(/(\.png)?$/, `-${pg + 1}.png`) : sheet;
    fs.mkdirSync(path.dirname(file), { recursive: true });
    fs.writeFileSync(file, Buffer.from(png.split(",")[1], "base64"));
    console.log(`Spectrograms in ${file}`);
  }
}

await browser.close();
if (problems.length) {
  console.error(problems.join("\n"));
  process.exit(1);
}
console.log(`${results.length} sounds OK`);
