#!/usr/bin/env node
// Lane Computing r2: renders the sorting machine's sound for each algorithm
// (every comparison and swap as the toy plays them, src/packs/computing.js,
// sortCues) offline, through the app's own limiter, to WAV files, so a clip
// can carry its sound. The notes start at the tap (0 s).
//
//   python3 -m http.server 4173 --bind 127.0.0.1   # in another shell
//   SPLASHERY_CHROMIUM=/opt/pw-browsers/chromium node tools/cmp2-sound.mjs <out-dir> [algo ...]

import fs from "node:fs";
import path from "node:path";
import { chromium } from "@playwright/test";

const args = process.argv.slice(2);
const [outDir, ...algos] = args;
if (!outDir) throw new Error("Usage: node tools/cmp2-sound.mjs <out-dir> [algo ...]");
const base = process.env.SPLASHERY_URL || "http://127.0.0.1:4173";
fs.mkdirSync(outDir, { recursive: true });

const browser = await chromium.launch({ executablePath: process.env.SPLASHERY_CHROMIUM || undefined }); // prettier-ignore
const page = await browser.newPage();
await page.goto(`${base}/tools/`);
const files = await page.evaluate(async (algos) => {
  const { SORTING } = await import("/src/packs/computing.js");
  const { playSpec } = await import("/src/voices.js");
  const { masterChain } = await import("/src/sound.js");
  const rate = 44100;
  const seconds = 5.6;
  const out = {};
  for (const algo of algos.length ? algos : SORTING.ALGOS) {
    const n = SORTING.SORT.steps[algo].length;
    const dt = Math.min(0.34, (SORTING.SORT.t1 - SORTING.SORT.t0) / n);
    const cues = SORTING.cues(algo, SORTING.SORT.runs[algo], dt);
    const ctx = new OfflineAudioContext(1, Math.floor(rate * seconds), rate);
    const master = masterChain(ctx);
    for (const [at, spec] of cues) playSpec(ctx, master, at, spec);
    const d = (await ctx.startRendering()).getChannelData(0);
    const bytes = new Uint8Array(44 + d.length * 2);
    const v = new DataView(bytes.buffer);
    const str = (o, s) => [...s].forEach((ch, i) => v.setUint8(o + i, ch.charCodeAt(0)));
    str(0, "RIFF");
    v.setUint32(4, 36 + d.length * 2, true);
    str(8, "WAVEfmt ");
    v.setUint32(16, 16, true);
    v.setUint16(20, 1, true);
    v.setUint16(22, 1, true);
    v.setUint32(24, rate, true);
    v.setUint32(28, rate * 2, true);
    v.setUint16(32, 2, true);
    v.setUint16(34, 16, true);
    str(36, "data");
    v.setUint32(40, d.length * 2, true);
    for (let i = 0; i < d.length; i++) v.setInt16(44 + i * 2, Math.max(-1, Math.min(1, d[i])) * 32767, true); // prettier-ignore
    let s = "";
    for (let i = 0; i < bytes.length; i += 0x8000) s += String.fromCharCode(...bytes.subarray(i, i + 0x8000)); // prettier-ignore
    out[algo] = btoa(s);
  }
  return out;
}, algos);
for (const [algo, b64] of Object.entries(files)) {
  const file = path.join(outDir, `${algo}.wav`);
  fs.writeFileSync(file, Buffer.from(b64, "base64"));
  console.log(file);
}
await browser.close();
