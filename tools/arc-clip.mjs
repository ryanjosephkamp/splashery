#!/usr/bin/env node
// Lane Arcade: clips of a game for the Effect review page, as a phone shows
// it: 390x844 in play mode (the whole page), the game playing itself (its
// autopilot), the clock stepped by hand at --fps (15) so the game moves at
// its real speed however slow the software renderer is. A script says what
// happens: "play:4" plays 4 s, "switch" presses the 2D/3D switch, "key:X"
// presses a key, "fire" presses fire.
//
//   python3 -m http.server 4173 --bind 127.0.0.1 &
//   SPLASHERY_CHROMIUM=/opt/pw-browsers/chromium node tools/arc-clip.mjs <out-dir> <name> \
//     --toy=shardball --opt=style=dome --script=play:4,switch,play:5,switch,play:2
//
// Writes <out-dir>/<name>.mp4 with the game's sound (needs ffmpeg: pip install imageio-ffmpeg),
// <name>-strip.png (six frames) and prints the frame times and splat count.

import { chromium } from "@playwright/test";
import fs from "node:fs";
import path from "node:path";
import { execFileSync } from "node:child_process";
import { PNG } from "pngjs";

const base = process.env.SPLASHERY_URL || "http://127.0.0.1:4173/";
const args = process.argv.slice(2);
const opt = (name, def) => {
  const a = args.find((x) => x.startsWith(`--${name}=`));
  return a ? a.slice(name.length + 3) : def;
};
const [outDir, name] = args.filter((a) => !a.startsWith("--"));
if (!outDir || !name) throw new Error("Usage: node tools/arc-clip.mjs <out-dir> <name> --toy=<id> [--opt=k=v,...] [--script=...]"); // prettier-ignore
const TOY = opt("toy", "shardball");
const OPTS = Object.fromEntries(
  (opt("opt", "") || "")
    .split(",")
    .filter(Boolean)
    .map((kv) => kv.split("=")),
);
const SCRIPT = opt("script", "play:4,switch,play:5,switch,play:2").split(",");
const FPS = Number(opt("fps", 15));
const WIDTH = Number(opt("width", 780)); // the frames' own width (390 at 2x): no resampling
const SIZE = (opt("size", "390x844") || "390x844").split("x").map(Number);
const PROFILE = opt("profile", "mid");
const LABEL = opt("label", "built by Opus 5.5");
const AUTO = opt("autopilot", "1") !== "0";
fs.mkdirSync(outDir, { recursive: true });
const tmp = path.join(outDir, `.${name}-frames`);
fs.rmSync(tmp, { recursive: true, force: true });
fs.mkdirSync(tmp, { recursive: true });

const browser = await chromium.launch({
  executablePath: process.env.SPLASHERY_CHROMIUM || undefined,
  args: ["--use-angle=swiftshader", "--enable-unsafe-swiftshader", "--ignore-gpu-blocklist"],
});
const page = await browser.newPage({ viewport: { width: SIZE[0], height: SIZE[1] }, deviceScaleFactor: 2 }); // prettier-ignore
page.on("pageerror", (e) => console.error("page error:", e.message));
await page.goto(`${base}?renderer=webgl2&adapt=off&profile=${PROFILE}&labs=1&watch=off`);
await page.waitForSelector("body[data-ready='true']", { timeout: 180_000 });
const run = (fn, arg) => page.evaluate(fn, arg);
await run(
  async ([toy, opts]) => {
    const { app, player } = window.__splashery;
    await app.chooseToy(toy);
    for (const [k, v] of Object.entries(opts)) await app.setToyOption(k, isNaN(v) ? v : Number(v));
    player.opts.idleDelay = 1e9;
  },
  [TOY, OPTS],
);
// --file=<path>: a file of the person's own, opened as the game's own
// button opens it (Note Rider's ♪ Your song), before the clip starts.
const FILE = opt("file", "");
if (FILE) {
  for (let i = 0; i < 200; i++) {
    if (await run(() => !!window.__splashery.player.arcade?.game)) break;
    await page.waitForTimeout(200);
  }
  const chooser = page.waitForEvent("filechooser");
  await page.click(".arc-file");
  await (await chooser).setFiles(FILE);
  await page.waitForTimeout(1500);
}
for (let i = 0; i < 200; i++) {
  if (await run(() => !!window.__splashery.player.arcade?.game)) break;
  await page.waitForTimeout(200);
}
// The stage's update handlers run only with the time this script gives.
await run(
  ([label, auto, phone]) => {
    const { player } = window.__splashery;
    const stage = player.stage;
    const handlers = stage.updateHandlers.slice();
    window.__arcPending = 0;
    // The game's sounds, on the clip's own clock (Arcade r2: clips with sound).
    window.__arcClock = 0;
    window.__arcCues = [];
    player.on("cue", (specs) => window.__arcCues.push([window.__arcClock, specs]));
    stage.updateHandlers.length = 0;
    stage.updateHandlers.push(() => {
      const d = window.__arcPending;
      window.__arcPending = 0;
      window.__arcClock += d;
      for (const h of handlers) h(d);
    });
    const a = player.arcade;
    // A phone's controls (the pad, 2D/3D and play/pause at the thumbs).
    if (phone) a.input.lastDevice = "touch";
    a.enterPlay();
    a.autopilot = auto;
    const tag = document.createElement("div");
    tag.textContent = `${a.def.title} · ${label}`;
    tag.style.cssText =
      "position:fixed;left:10px;bottom:10px;z-index:2147483600;font:600 12px system-ui;color:#fff;background:rgba(0,0,0,.55);padding:4px 8px;border-radius:6px;pointer-events:none"; // prettier-ignore
    document.body.appendChild(tag);
  },
  [LABEL, AUTO, SIZE[0] < 600],
);
let n = 0;
const times = [];
const step = async (dt) => {
  const t0 = Date.now();
  await run(async (dt) => {
    const { player } = window.__splashery;
    window.__arcPending = dt;
    await player.stage.captureFrame();
    await player.stage.captureFrame();
  }, dt);
  times.push(Date.now() - t0);
};
const shot = async () => {
  await page.screenshot({ path: path.join(tmp, `f${String(n++).padStart(4, "0")}.png`), timeout: 180_000 }); // prettier-ignore
};
const play = async (secs) => {
  for (let t = 0; t < secs - 1e-6; t += 1 / FPS) {
    await step(1 / FPS);
    await shot();
  }
};
await play(0.4);
for (const s of SCRIPT) {
  const [cmd, arg] = s.split(":");
  if (cmd === "play") await play(Number(arg));
  else if (cmd === "switch") await run(() => window.__splashery.player.arcade.toggleView());
  else if (cmd === "fire")
    await run(() => window.__splashery.player.arcade.input.edges.push("fire"));
  else if (cmd === "key") await page.keyboard.press(arg);
  // "auto:0" or "auto:1" turns the autopilot off or on; "tap:x;y" taps the
  // stage there (0..1 across and down); "head:dx;dy" taps beside the
  // head (Longtail); "drag:dx;dy" drags across the stage (in its widths),
  // over --dragsecs (0.6) of play.
  else if (cmd === "auto")
    await run((on) => (window.__splashery.player.arcade.autopilot = on), arg === "1"); // prettier-ignore
  else if (cmd === "tap") {
    const [x, y] = arg.split(";").map(Number);
    await run(([x, y]) => window.__splashery.player.arcade.input.tapAt.push({ x, y }), [x, y]);
  } else if (cmd === "head") {
    const [dx, dy] = arg.split(";").map(Number);
    await run(
      async ([dx, dy]) => {
        const { orbitPose, viewTangents } = await import("/src/arcade/runtime.js");
        const a = window.__splashery.player.arcade;
        const p = orbitPose(a.cam);
        const [tx, ty] = viewTangents(a.aspect(), a.cam.fov);
        const h = a.game.head.pos;
        const d = [0, 1, 2].map((i) => h[i] - p.position[i]);
        const dot = (u, v) => u[0] * v[0] + u[1] * v[1] + u[2] * v[2];
        const z = dot(d, p.forward);
        const x = (dot(d, p.right) / z / tx + 1) / 2;
        const y = (1 - dot(d, p.up) / z / ty) / 2;
        a.input.tapAt.push({ x: x + dx, y: y + dy });
      },
      [dx, dy],
    );
  } else if (cmd === "drag") {
    const [dx, dy] = arg.split(";").map(Number);
    const secs = Number(opt("dragsecs", 0.6));
    const k = Math.max(1, Math.round(secs * FPS));
    for (let i = 0; i < k; i++) {
      await run(
        ([dx, dy]) => {
          const d = window.__splashery.player.arcade.input.drag;
          d[0] += dx;
          d[1] += dy;
        },
        [dx / k, dy / k],
      );
      await step(1 / FPS);
      await shot();
    }
  }
}
// The sound: every cue the game played, rendered offline through the app's
// own limiter, on the clip's clock.
const clipSecs = n / FPS;
const wav = await run(async (secs) => {
  const { playSpec, loadSamples } = await import("/src/voices.js");
  const { masterChain } = await import("/src/sound.js");
  const rate = 44100;
  const ctx = new OfflineAudioContext(1, Math.max(1, Math.floor(rate * secs)), rate);
  const master = masterChain(ctx);
  const cues = window.__arcCues;
  await Promise.all(cues.map(([, specs]) => loadSamples(ctx, specs)));
  // A frame's clock runs ahead of its picture by one step: the frame shot
  // after a step shows that step's end.
  for (const [at, specs] of cues) if (at < secs) playSpec(ctx, master, Math.max(0, at), specs);
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
  return { b64: btoa(s), cues: cues.length };
}, clipSecs);
const wavFile = path.join(tmp, "sound.wav");
fs.writeFileSync(wavFile, Buffer.from(wav.b64, "base64"));
const stats = await run(() => {
  const a = window.__splashery.player.arcade;
  return {
    splats: a.sprites.used,
    slots: a.layer.slots,
    gameMs: a.stats.gameMs,
    score: a.game.stats(),
  };
});
await browser.close();

const ffmpeg = execFileSync("python3", ["-c", "import imageio_ffmpeg;print(imageio_ffmpeg.get_ffmpeg_exe())"]).toString().trim(); // prettier-ignore
const out = path.join(outDir, `${name}.mp4`);
execFileSync(ffmpeg, ["-y", "-loglevel", "error", "-framerate", String(FPS), "-i", path.join(tmp, "f%04d.png"), "-i", wavFile, "-vf", `scale=${WIDTH}:-2:flags=area`, "-movflags", "+faststart", "-pix_fmt", "yuv420p", "-c:v", "libx264", "-crf", "18", "-c:a", "aac", "-b:a", "128k", "-shortest", out]); // prettier-ignore
// A strip of six frames.
const files = fs
  .readdirSync(tmp)
  .filter((f) => f.endsWith(".png"))
  .sort();
const pick = [0, 1, 2, 3, 4, 5].map((i) => files[Math.round((i / 5) * (files.length - 1))]);
const imgs = pick.map((f) => PNG.sync.read(fs.readFileSync(path.join(tmp, f))));
const k = 4;
const w = Math.floor(imgs[0].width / k);
const h = Math.floor(imgs[0].height / k);
const strip = new PNG({ width: w * 6, height: h });
imgs.forEach((img, i) => {
  for (let y = 0; y < h; y++)
    for (let x = 0; x < w; x++) {
      const s = (y * k * img.width + x * k) * 4;
      const d = (y * w * 6 + i * w + x) * 4;
      strip.data[d] = img.data[s];
      strip.data[d + 1] = img.data[s + 1];
      strip.data[d + 2] = img.data[s + 2];
      strip.data[d + 3] = 255;
    }
});
fs.writeFileSync(path.join(outDir, `${name}-strip.png`), PNG.sync.write(strip));
fs.rmSync(tmp, { recursive: true, force: true });
const avg = times.reduce((a, b) => a + b, 0) / times.length;
console.log(`${name}: ${out} (${(fs.statSync(out).size / 1024).toFixed(0)} KB, ${files.length} frames; software render ${avg.toFixed(0)} ms a frame) ${JSON.stringify(stats)}`); // prettier-ignore
