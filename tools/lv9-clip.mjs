#!/usr/bin/env node
// Lane Live r9: Sound in a box played to, as a looping GIF at phone size
// (tools/lv8-clip.mjs, with the audio). --tone=hz:secs,hz:secs,... makes a
// melody (a synthetic tone with two overtones; 0 Hz rests) and opens it as
// your audio: it is measured by the real worker, and its clock is the
// clip's stepped clock, so each frame hears the moment it shows. --mic
// feeds the same tones to the microphone instead (a fake capture device,
// started by a tap on "Use my microphone"); the microphone runs in real
// time, so --tone there is best one long note. No tap on the cell.
//
//   python3 -m http.server 4173 --bind 127.0.0.1 &
//   SPLASHERY_CHROMIUM=/opt/pw-browsers/chromium node tools/lv9-clip.mjs <out-dir> (--tone=415.3:6,880:6 [--mic] | --tune=ode) [--w=390] [--h=844] [--dpr=2] [--secs=12] [--fps=12] [--pitch=0.2] [--sweep=1] [--opt=key=value] [--name=x] chladni-cell

import { chromium } from "@playwright/test";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

const base = process.env.SPLASHERY_URL || "http://127.0.0.1:4173/";
const args = process.argv.slice(2);
const opt = (name, def) => {
  const a = args.find((x) => x.startsWith(`--${name}=`));
  return a ? a.slice(name.length + 3) : def;
};
const [outDir, ...ids] = args.filter((a) => !a.startsWith("--"));
if (!outDir || !ids.length) throw new Error("Usage: node tools/effect-clip.mjs <out-dir> id ...");
const W = Number(opt("w", 390));
const H = Number(opt("h", 844));
const lowPitch = Number(opt("pitch", 0.2));
const sweep = Number(opt("sweep", 1));
const name = opt("name", "");
const secsAll = Number(opt("secs", 6));
const fps = Number(opt("fps", 12));
const before = Number(opt("before", 0.4));
const bg = opt("bg", "#111111");
const toyOpt = opt("opt", "");
const stripN = Number(opt("strip", 0));
const dpr = Number(opt("dpr", 1));
const mic = args.includes("--mic");
const tone = opt("tone", "")
  .split(",")
  .filter(Boolean)
  .map((p) => p.split(":").map(Number));
// Part 2: --tune=<id> plays one of the toy's built-in tunes instead (its
// button in the Toy tab).
const tuneId = opt("tune", "");
if (!tone.length && !tuneId) throw new Error("Give --tone=hz:secs,... or --tune=id");
if (!tone.length) tone.push([440, 1]);

// The melody as a 16-bit mono WAV (tests/lv9.spec.mjs's toneWav).
const RATE = 48000;
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
const wav = toneWav(path.join(fs.mkdtempSync(path.join(os.tmpdir(), "lv9-clip-")), "tone.wav"), tone); // prettier-ignore

fs.mkdirSync(outDir, { recursive: true });
const browser = await chromium.launch({
  executablePath: process.env.SPLASHERY_CHROMIUM || undefined,
  args: [
    "--use-angle=swiftshader",
    "--enable-unsafe-swiftshader",
    "--ignore-gpu-blocklist",
    "--enable-webgl",
    ...(mic ? ["--use-fake-ui-for-media-stream", "--use-fake-device-for-media-stream", `--use-file-for-fake-audio-capture=${wav}`] : []), // prettier-ignore
  ],
});
const page = await browser.newPage({ viewport: { width: 1000, height: 700 }, deviceScaleFactor: dpr }); // prettier-ignore
page.on("pageerror", (e) => console.error("page error:", e.message));
await page.goto(`${base}?labs=1&renderer=webgl2&profile=mid&adapt=off`);
await page.waitForSelector("body[data-ready='true']", { timeout: 180_000 });
// Polls an async check in the page (page.waitForFunction passes one at once).
async function until(fn, timeout = 180_000) {
  const end = Date.now() + timeout;
  while (!(await page.evaluate(fn))) {
    if (Date.now() > end) throw new Error(`Timed out waiting for ${fn}`);
    await page.waitForTimeout(150);
  }
}
for (const spec of ids) {
  const [id, own] = spec.split(":");
  const secs = own ? Number(own) : secsAll;
  await page.evaluate(
    async ({ id, toyOpt }) => {
      const { app } = window.__splashery;
      await app.chooseToy(id);
      if (toyOpt) {
        const [key, value] = toyOpt.split("=");
        await app.setToyOption(key, value);
      }
    },
    { id, toyOpt },
  );
  await until(async () => document.getElementById("progress").hidden && (await import("/src/packs/chladni-3d.js")).cellState().n > 0); // prettier-ignore
  if (mic) {
    await page.evaluate(() => document.getElementById("live-mic").click());
  } else {
    if (tuneId)
      await page.evaluate((id) => document.getElementById(`cell-tune-${id}`).click(), tuneId); // prettier-ignore
    else await page.setInputFiles("#toy-input-file", wav);
    await until(async () => { const a = (await import("/src/packs/chladni-3d.js")).cellAudioState(); return a.name && a.measured >= 1; }); // prettier-ignore
    await until(() => document.getElementById("progress").hidden);
  }
  const { bytes, strip, heardLog } = await page.evaluate(
    async ({ id, W, H, lowPitch, sweep, secs, fps, before, bg, stripN }) => {
      const { app, player } = window.__splashery;
      const { GIFEncoder, quantize, applyPalette } = await import("gifenc");
      // The open audio on the clip's clock: silent, and heard frame by frame.
      const box = await import("/src/packs/chladni-3d.js");
      let clock = 0;
      const heardLog = [];
      // (The toy may open its track again after a rebuild: each new one is
      // taken over too.)
      const tracks = new Set();
      const takeTrack = () => {
        const track = box.cellAudioState().track;
        if (!track || tracks.has(track)) return;
        tracks.add(track);
        track.pause();
        track.time = () => clock;
        Object.defineProperty(track, "playing", { get: () => true });
      };
      takeTrack();
      app.setLook({ background: bg });
      player.opts.idleDelay = 1e9;
      player.idle.weight = 0;
      await new Promise((r) => setTimeout(r, 1500));
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
      const total0 = Math.round((before + secs) * fps);
      let fi = 0;
      const home = () => {
        const h = player.camera.home;
        // Down to the side and back up, once over the clip.
        const u = sweep ? 0.5 - 0.5 * Math.cos((2 * Math.PI * fi) / total0) : 0;
        const pose = { ...h, pitch: h.pitch + (lowPitch - h.pitch) * u, yaw: h.yaw + 0.5 * u };
        player.camera.cur = { ...pose };
        player.camera.tgt = { ...pose };
      };
      const step = 1 / fps;
      const gif = GIFEncoder();
      const delay = Math.round(1000 / fps);
      // Frames for the strip: one before the tap, then evenly spread after.
      const shots = [];
      const total = Math.round((before + secs) / step);
      const pickAt = new Set();
      if (stripN > 1) {
        pickAt.add(Math.max(0, Math.round(before / step) - 1));
        for (let i = 1; i < stripN; i++)
          pickAt.add(
            Math.round(before / step + ((i - 0.5) / (stripN - 1)) * (total - before / step)),
          );
      }
      let n = 0;
      const frame = async () => {
        pending = step;
        clock += step;
        takeTrack();
        if (Math.abs(clock * 2 - Math.round(clock * 2)) < step / 2) {
          const a = box.cellAudioState();
          heardLog.push(`${clock.toFixed(1)}s t=${player.time.toFixed(2)} steps=${a.steps} pos=${a.pos.toFixed(2)} ${a.heard?.note ?? "-"} ${a.heard?.hz?.toFixed?.(0) ?? ""} lead ${a.lead} ${Object.entries(a.amps).map(([k, v]) => `${k}=${v.toFixed(2)}`).join(" ")}`); // prettier-ignore
        }
        home();
        await stage.captureFrame();
        pending = 0;
        const c = await stage.captureFrame();
        fi++;
        if (pickAt.has(n)) shots.push({ bmp: await createImageBitmap(c), t: n * step - before });
        n++;
        const rgba = c.getContext("2d").getImageData(0, 0, W, H).data;
        const palette = quantize(rgba, 256, { format: "rgb565" });
        gif.writeFrame(applyPalette(rgba, palette, "rgb565"), W, H, { palette, delay, repeat: 0 }); // prettier-ignore
      };
      // The lead-in frames (silence: the beads scattered as built).
      clock = -1e3;
      for (let t = 0; t < before; t += step) await frame();
      clock = 0;
      for (let t = 0; t < secs - 1e-6; t += step) await frame();
      gif.finish();
      stage.setFixedSize(null);
      stage.updateHandlers.length = 0;
      stage.updateHandlers.push(...handlers);
      let strip = null;
      if (shots.length) {
        const out = document.createElement("canvas");
        out.width = W * shots.length;
        out.height = H + 18;
        const ctx = out.getContext("2d");
        ctx.fillStyle = bg;
        ctx.fillRect(0, 0, out.width, out.height);
        ctx.font = "12px sans-serif";
        ctx.fillStyle = "#bbb";
        shots.forEach((s, i) => {
          ctx.drawImage(s.bmp, i * W, 0, W, H);
          ctx.fillText(s.t < 0 ? "before" : `${s.t.toFixed(1)}s`, i * W + 6, H + 13);
        });
        strip = out.toDataURL("image/png");
      }
      heardLog.push(`tracks taken over: ${tracks.size}`);
      return { bytes: Array.from(gif.bytes()), strip, heardLog };
    },
    {
      id,
      W,
      H,
      lowPitch,
      sweep,
      secs,
      fps,
      before,
      bg,
      stripN,
    },
  );
  const out = path.join(outDir, `${name || id}.gif`);
  fs.writeFileSync(out, Buffer.from(bytes));
  if (strip) fs.writeFileSync(path.join(outDir, `${name || id}-strip.png`), Buffer.from(strip.split(",")[1], "base64")); // prettier-ignore
  if (args.includes("--log")) console.log(heardLog.join("\n"));
  console.log(`${id}: ${out} (${(bytes.length / 1024).toFixed(0)} KB)`);
}
await browser.close();
