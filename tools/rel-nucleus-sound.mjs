#!/usr/bin/env node
// Lane Elements: the periodic table's nucleus ticks, heard (the owner's walkthrough, October 6,
// 2026: "like nails on a chalkboard"). Opens the periodic table on one element, taps it, records
// every sound cue the toy plays as its atom builds (the whoosh and a tick for each proton and
// neutron), and renders them offline through the app's own voices and limiter to a WAV, the tap
// at --before seconds, so it lines up with an effect-clip.mjs clip of the same tap.
//
//   python3 -m http.server 4173 --bind 127.0.0.1 &
//   SPLASHERY_CHROMIUM=/opt/pw-browsers/chromium node tools/rel-nucleus-sound.mjs out.wav [El] [--before=0.4] [--secs=4]
import fs from "node:fs";
import { chromium } from "@playwright/test";

const args = process.argv.slice(2);
const opt = (k, d) => Number(args.find((a) => a.startsWith(`--${k}=`))?.split("=")[1] ?? d);
const [out, el = "Fe"] = args.filter((a) => !a.startsWith("--"));
if (!out) throw new Error("Usage: node tools/rel-nucleus-sound.mjs out.wav [El]");
const before = opt("before", 0.4);
const secs = opt("secs", 4);
const base = process.env.SPLASHERY_URL || "http://127.0.0.1:4173/";

const browser = await chromium.launch({ executablePath: process.env.SPLASHERY_CHROMIUM || undefined }); // prettier-ignore
const page = await browser.newPage();
await page.addInitScript(() => localStorage.setItem("splashery.sound", "on"));
await page.goto(`${base}?renderer=webgl2&profile=weak`);
await page.waitForSelector("body[data-ready='true']", { timeout: 180_000 });
await page.evaluate(async (el) => {
  const { app, player } = window.__splashery;
  await app.chooseToy("periodic-table");
  await app.setToyOptions({ element: el });
  window.__cues = [];
  player.on("cue", (cues) => window.__cues.push({ t: performance.now() / 1000, cues }));
}, el);
await page.waitForFunction((el) => window.__splashery.player.motion?.ctx?.kit?.data?.nucleons?.length && window.__splashery.player.toyInfo?.id === "periodic-table", el, { timeout: 120_000 }); // prettier-ignore
await page.waitForTimeout(800);
const b64 = await page.evaluate(
  async ({ before, secs }) => {
    const { app } = window.__splashery;
    const { playSpec } = await import("/src/voices.js");
    const { masterChain } = await import("/src/sound.js");
    const { TOY_SOUNDS } = await import("/src/toy-sounds.js");
    window.__cues = [];
    const t0 = performance.now() / 1000;
    app.act();
    await new Promise((ok) => setTimeout(ok, secs * 1000));
    const rate = 44100;
    const ctx = new OfflineAudioContext(1, Math.floor(rate * (before + secs)), rate);
    const master = masterChain(ctx);
    // The tap's own sound (toy-sounds.js "on"), then the toy's cues where they came.
    const tap = TOY_SOUNDS["periodic-table"]?.on || [];
    for (const spec of tap) playSpec(ctx, master, before + (spec.at || 0), spec);
    // (A cue is a spec or a batch of them, each with its own delay.)
    let n = 0;
    for (const { t, cues } of window.__cues)
      for (const spec of cues.flat()) {
        playSpec(ctx, master, before + (t - t0) + (spec.at || 0), { ...spec, at: 0 });
        n++;
      }
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
    return { wav: btoa(s), n };
  },
  { before, secs },
);
fs.writeFileSync(out, Buffer.from(b64.wav, "base64"));
console.log(`${b64.n} cues -> ${out}`);
await browser.close();
