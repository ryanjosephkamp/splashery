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
// Writes <out-dir>/<name>.mp4 (needs ffmpeg: pip install imageio-ffmpeg),
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
const WIDTH = Number(opt("width", 720));
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
for (let i = 0; i < 200; i++) {
  if (await run(() => !!window.__splashery.player.arcade?.game)) break;
  await page.waitForTimeout(200);
}
// The stage's update handlers run only with the time this script gives.
await run(
  ([label, auto]) => {
    const { player } = window.__splashery;
    const stage = player.stage;
    const handlers = stage.updateHandlers.slice();
    window.__arcPending = 0;
    stage.updateHandlers.length = 0;
    stage.updateHandlers.push(() => {
      const d = window.__arcPending;
      window.__arcPending = 0;
      for (const h of handlers) h(d);
    });
    const a = player.arcade;
    a.enterPlay();
    a.autopilot = auto;
    const tag = document.createElement("div");
    tag.textContent = `${a.def.title} · ${label}`;
    tag.style.cssText =
      "position:fixed;left:10px;bottom:10px;z-index:2147483600;font:600 12px system-ui;color:#fff;background:rgba(0,0,0,.55);padding:4px 8px;border-radius:6px;pointer-events:none"; // prettier-ignore
    document.body.appendChild(tag);
  },
  [LABEL, AUTO],
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
}
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
execFileSync(ffmpeg, ["-y", "-loglevel", "error", "-framerate", String(FPS), "-i", path.join(tmp, "f%04d.png"), "-vf", `scale=${WIDTH}:-2:flags=area`, "-movflags", "+faststart", "-pix_fmt", "yuv420p", "-c:v", "libx264", "-crf", "18", out]); // prettier-ignore
// A strip of six frames.
const files = fs.readdirSync(tmp).sort();
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
