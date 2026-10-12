#!/usr/bin/env node
// Lane Live r10: Sound in a box or the Chladni plate played the test song
// (tools/lv10-song.mjs, made here: "Ode to Joy", public domain), as an MP4
// at phone size with the song's sound, for before-and-after clips. As
// tools/lv9-clip.mjs: the song is opened as your own file, measured by the
// real worker, and its clock is the clip's stepped clock, so each frame
// hears the moment it shows. --tour rings each of the toy's modes in turn
// instead (a tap each, the toy's own tone made here the same way: a sine at
// the mode's heard pitch and a soft octave, ringing down over 7 s), with
// the mode's name over the picture.
//
//   python3 -m http.server 4173 --bind 127.0.0.1 &
//   SPLASHERY_CHROMIUM=/opt/pw-browsers/chromium node tools/lv10-clip.mjs <out.mp4> [--toy=chladni-cell|chladni-plate] [--opt=key=value,...] [--from=0] [--secs=14] [--tour=4] [--w=390] [--h=844] [--fps=12] [--pitch=0.25] [--sweep=1] [--label=text]
//
// SPLASHERY_URL points it at another server (a checkout of main for the
// "before" clip). Needs imageio-ffmpeg (pip install imageio-ffmpeg). The
// frames are timed at exactly 1/fps in the MP4 (a GIF's delays are whole
// hundredths, so at 12 fps it would run 4% fast against the sound).

import { chromium } from "@playwright/test";
import { execFileSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { songWav, songSamples } from "./lv10-song.mjs";

const base = process.env.SPLASHERY_URL || "http://127.0.0.1:4173/";
const args = process.argv.slice(2);
const opt = (name, def) => {
  const a = args.find((x) => x.startsWith(`--${name}=`));
  return a ? a.slice(name.length + 3) : def;
};
const [out] = args.filter((a) => !a.startsWith("--"));
if (!out) throw new Error("Usage: node tools/lv10-clip.mjs <out.mp4> [options]");
const toy = opt("toy", "chladni-cell");
const W = Number(opt("w", 390));
const H = Number(opt("h", 844));
const fps = Number(opt("fps", 12));
const secs = Number(opt("secs", 14));
const from = Number(opt("from", 0));
const lowPitch = Number(opt("pitch", 0.25));
const sweep = Number(opt("sweep", 1));
const tour = Number(opt("tour", 0)); // seconds per mode
const label = opt("label", "");
const toyOpts = Object.fromEntries(
  opt("opt", "")
    .split(",")
    .filter(Boolean)
    .map((kv) => kv.split("=")),
);
const RATE = 44100;
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "lv10-clip-"));
const wavFile = path.join(tmp, "song.wav");
fs.writeFileSync(wavFile, songWav(RATE));
const MOD = toy === "chladni-cell" ? "/src/packs/chladni-3d.js" : "/src/packs/studio.js";

const browser = await chromium.launch({
  executablePath: process.env.SPLASHERY_CHROMIUM || undefined,
  args: ["--use-angle=swiftshader", "--enable-unsafe-swiftshader", "--ignore-gpu-blocklist", "--enable-webgl"], // prettier-ignore
});
const page = await browser.newPage({ viewport: { width: 1000, height: 700 } });
page.on("pageerror", (e) => console.error("page error:", e.message));
await page.goto(`${base}?labs=1&renderer=webgl2&profile=mid&adapt=off`);
await page.waitForSelector("body[data-ready='true']", { timeout: 180_000 });
async function until(fn, arg, timeout = 180_000) {
  const end = Date.now() + timeout;
  while (!(await page.evaluate(fn, arg))) {
    if (Date.now() > end) throw new Error(`Timed out waiting for ${fn}`);
    await page.waitForTimeout(150);
  }
}
await page.evaluate(async ({ toy, toyOpts }) => {
  const { app } = window.__splashery;
  await app.chooseToy(toy);
  if (Object.keys(toyOpts).length) await app.setToyOptions(toyOpts);
}, { toy, toyOpts }); // prettier-ignore
const count = async () => page.evaluate(async ([m, cell]) => { const x = await import(m); return cell ? x.cellState().n : x.chladniSand().n; }, [MOD, toy === "chladni-cell"]); // prettier-ignore
await until(() => document.getElementById("progress").hidden);
for (let k = 0; k < 400 && !(await count()); k++) await page.waitForTimeout(150);
await page.waitForTimeout(1500); // (a flag's colors are read from its image)

// The toy's open track (a getter in the page).
const trackOf = toy === "chladni-cell" ? "(await import('/src/packs/chladni-3d.js')).cellAudioState().track" : "(await import('/src/packs/studio.js')).chladniTest().track"; // prettier-ignore
const tones = [];
if (!tour) {
  await page.setInputFiles("#toy-input-file", wavFile);
  await page.evaluate(async (getter) => {
    const get = new Function(`return (async () => ${getter})()`);
    window.__clipClock = -1e3;
    for (let k = 0; k < 3000 && !(await get()); k++) await new Promise((r) => setTimeout(r, 5));
    const track = await get();
    track.pause();
    track.time = () => window.__clipClock;
    Object.defineProperty(track, "playing", { get: () => true });
    window.__clipGet = get;
    window.__clipTracks = new Set([track]);
  }, trackOf);
  // Measured all through before the clip starts.
  await until(async ([m, cell]) => { const x = await import(m); return (cell ? x.cellAudioState() : x.chladniFileState()).measured >= 1; }, [MOD, toy === "chladni-cell"]); // prettier-ignore
  await until(() => document.getElementById("progress").hidden);
}

const result = await page.evaluate(
  async ({ W, H, fps, secs, from, lowPitch, sweep, tour, toy, label }) => {
    const { app, player } = window.__splashery;
    const { GIFEncoder, quantize, applyPalette } = await import("gifenc");
    app.setLook({ background: "#111111" });
    player.opts.idleDelay = 1e9;
    player.idle.weight = 0;
    await new Promise((r) => setTimeout(r, 1200));
    const stage = player.stage;
    const handlers = stage.updateHandlers.slice();
    let pending = 0;
    stage.updateHandlers.length = 0;
    stage.updateHandlers.push(() => {
      const d = pending;
      pending = 0;
      for (const h of handlers) h(d);
    });
    stage.setFixedSize([W, H]);
    const take = async () => {
      if (!window.__clipGet) return;
      const t = await window.__clipGet();
      if (!t || window.__clipTracks.has(t)) return;
      window.__clipTracks.add(t);
      t.pause();
      t.time = () => window.__clipClock;
      Object.defineProperty(t, "playing", { get: () => true });
    };
    const box = toy === "chladni-cell" ? await import("/src/packs/chladni-3d.js") : null;
    const modes = box ? box.CELL_MODES : [];
    const step = 1 / fps;
    const total = Math.round(secs * fps);
    const gif = GIFEncoder();
    const delay = Math.round(1000 / fps);
    const tones = [];
    let caption = label;
    const ctx2 = document.createElement("canvas").getContext("2d");
    ctx2.canvas.width = W;
    ctx2.canvas.height = H;
    window.__clipClock = from;
    for (let fi = 0; fi < total; fi++) {
      const t = fi * step;
      if (tour) {
        // A new mode every `tour` seconds: rebuilt, then tapped.
        const k = Math.floor(t / tour);
        if (Math.abs(t - k * tour) < step / 2 && k < modes.length) {
          await app.setToyOptions({ mode: modes[k].id });
          for (let q = 0; q < 200 && !document.getElementById("progress").hidden; q++) await new Promise((r) => setTimeout(r, 50)); // prettier-ignore
          player.act(null);
          tones.push({ at: t, f: box.heardFreq(modes[k]) });
          caption = `${box.cellLabel(modes[k])}: ${box.MODE_NOTES[modes[k].id]}`;
        }
      }
      window.__clipClock = from + t;
      await take();
      const h = player.camera.home;
      const u = sweep ? 0.5 - 0.5 * Math.cos((2 * Math.PI * fi) / total) : 0;
      const pose = { ...h, pitch: h.pitch + (lowPitch - h.pitch) * u, yaw: h.yaw + 0.5 * u };
      player.camera.cur = { ...pose };
      player.camera.tgt = { ...pose };
      pending = step;
      await stage.captureFrame();
      pending = 0;
      const c = await stage.captureFrame();
      ctx2.drawImage(c, 0, 0, W, H);
      if (caption) {
        // The caption, wrapped, on a dark band at the bottom.
        ctx2.font = "15px sans-serif";
        const words = caption.split(" ");
        const lines = [];
        let line = "";
        for (const w of words) {
          if (ctx2.measureText(`${line} ${w}`).width > W - 28) {
            lines.push(line);
            line = w;
          } else line = line ? `${line} ${w}` : w;
        }
        lines.push(line);
        const top = H - 24 - lines.length * 20;
        ctx2.fillStyle = "rgba(0,0,0,0.6)";
        ctx2.fillRect(0, top - 10, W, H - top + 10);
        ctx2.fillStyle = "#f2f2f2";
        lines.forEach((l, i) => ctx2.fillText(l, 14, top + 14 + i * 20));
      }
      const rgba = ctx2.getImageData(0, 0, W, H).data;
      const palette = quantize(rgba, 256, { format: "rgb565" });
      gif.writeFrame(applyPalette(rgba, palette, "rgb565"), W, H, { palette, delay, repeat: 0 });
    }
    gif.finish();
    stage.setFixedSize(null);
    stage.updateHandlers.length = 0;
    stage.updateHandlers.push(...handlers);
    return { bytes: Array.from(gif.bytes()), tones };
  },
  { W, H, fps, secs, from, lowPitch, sweep, tour, toy, label },
);
await browser.close();
const gifFile = path.join(tmp, "clip.gif");
fs.writeFileSync(gifFile, Buffer.from(result.bytes));

// The sound: the song from `from` for `secs`, or the tour's rings.
const n = Math.round(secs * RATE);
const audio = new Float32Array(n);
if (!tour) {
  const s = songSamples(RATE);
  audio.set(s.subarray(Math.round(from * RATE), Math.round(from * RATE) + n));
} else
  for (const { at, f } of result.tones) {
    const i0 = Math.round(at * RATE);
    for (let i = 0; i0 + i < n; i++) {
      const t = i / RATE;
      const env = Math.min(1, t / 0.01) * Math.exp(-t / 1.6); // (a 7 s ring, heard as it fades)
      audio[i0 + i] += 0.35 * env * (Math.sin(2 * Math.PI * f * t) + 0.11 * Math.sin(4 * Math.PI * f * t)); // prettier-ignore
    }
  }
const pcm = Buffer.alloc(n * 2);
for (let i = 0; i < n; i++) pcm.writeInt16LE(Math.round(Math.max(-1, Math.min(1, audio[i])) * 32767), i * 2); // prettier-ignore
const rawFile = path.join(tmp, "audio.raw");
fs.writeFileSync(rawFile, pcm);
const ffmpeg = execFileSync("python3", ["-c", "import imageio_ffmpeg;print(imageio_ffmpeg.get_ffmpeg_exe())"]).toString().trim(); // prettier-ignore
execFileSync(ffmpeg, ["-y", "-loglevel", "error", "-i", gifFile, "-f", "s16le", "-ar", String(RATE), "-ac", "1", "-i", rawFile, "-movflags", "+faststart", "-pix_fmt", "yuv420p", "-vf", `setpts=N/(${fps}*TB),scale=trunc(iw/2)*2:trunc(ih/2)*2`, "-r", String(fps), "-c:v", "libx264", "-crf", "23", "-c:a", "aac", "-b:a", "96k", "-shortest", out]); // prettier-ignore
console.log(`${out} (${(fs.statSync(out).size / 1024).toFixed(0)} KB)`);
