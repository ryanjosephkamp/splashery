#!/usr/bin/env node
// Renders a Tiny world r2 toy's tap as an MP4 clip at phone size, letting the
// toy's own camera views play (tools/effect-clip.mjs puts the camera back
// home every frame, which a toy that follows its story can't use).
//
//   python3 -m http.server 4173 --bind 127.0.0.1 &
//   SPLASHERY_CHROMIUM=/opt/pw-browsers/chromium node tools/tw2-clip.mjs <out-dir> id[:secs] ... [--w=360] [--h=540] [--fps=15] [--before=0.6] [--opt=key=value,key=value] [--name=file] [--strip=8] [--taps=1]
//
// Writes <out-dir>/<name or id>.mp4 (ffmpeg from the imageio-ffmpeg Python
// package) and, with --strip=N, <name>-strip.png: N frames side by side.

import { chromium } from "@playwright/test";
import { execFileSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";

const base = process.env.SPLASHERY_URL || "http://127.0.0.1:4173/";
const args = process.argv.slice(2);
const opt = (name, def) => {
  const a = args.find((x) => x.startsWith(`--${name}=`));
  return a ? a.slice(name.length + 3) : def;
};
const [outDir, ...ids] = args.filter((a) => !a.startsWith("--"));
if (!outDir || !ids.length)
  throw new Error("Usage: node tools/tw2-clip.mjs <out-dir> id[:secs] ...");
const W = Number(opt("w", 360));
const H = Number(opt("h", 540));
const fps = Number(opt("fps", 15));
const before = Number(opt("before", 0.6));
const toyOpts = opt("opt", "")
  .split(",")
  .filter(Boolean)
  .map((kv) => kv.split("="));
const stripN = Number(opt("strip", 0));
const taps = Number(opt("taps", 1));
const gap = Number(opt("gap", 0));
const name = opt("name", "");
// --stills=1,5,9: only frames at these seconds after the tap, side by side.
const stills = opt("stills", "").split(",").filter(Boolean).map(Number);

fs.mkdirSync(outDir, { recursive: true });
const ffmpeg =
  execFileSync("python3", ["-c", "import imageio_ffmpeg;print(imageio_ffmpeg.get_ffmpeg_exe())"]) // prettier-ignore
    .toString()
    .trim();
const browser = await chromium.launch({
  executablePath: process.env.SPLASHERY_CHROMIUM || undefined,
  args: ["--use-angle=swiftshader", "--enable-unsafe-swiftshader", "--ignore-gpu-blocklist", "--enable-webgl"], // prettier-ignore
});
const page = await browser.newPage({ viewport: { width: W, height: H } });
page.on("pageerror", (e) => console.error("page error:", e.message));
await page.goto(`${base}?renderer=webgl2&profile=high&adapt=off&labs=1`);
await page.waitForSelector("body[data-ready='true']", { timeout: 180_000 });
for (const spec of ids) {
  const [id, own] = spec.split(":");
  const secs = own ? Number(own) : 4;
  const frames = path.join(outDir, `.frames-${id}`);
  fs.rmSync(frames, { recursive: true, force: true });
  fs.mkdirSync(frames, { recursive: true });
  await page.evaluate(
    async ({ id, toyOpts, W, H }) => {
      const { app, player } = window.__splashery;
      await app.chooseToy(id);
      for (const [k, v] of toyOpts) await app.setToyOption(k, v);
      app.setLook({ background: "#111111" });
      player.opts.idleDelay = 1e9;
      player.idle.weight = 0;
      await new Promise((r) => setTimeout(r, 1500));
      const stage = player.stage;
      // (Unwrap a previous toy's clock first, or the clock stops.)
      if (window.__tw2) stage.updateHandlers.splice(0, stage.updateHandlers.length, ...window.__tw2.handlers); // prettier-ignore
      const handlers = stage.updateHandlers.slice();
      window.__tw2 = { pending: 0, handlers };
      stage.updateHandlers.length = 0;
      stage.updateHandlers.push(() => {
        const d = window.__tw2.pending;
        window.__tw2.pending = 0;
        for (const h of handlers) h(d);
      });
      stage.setFixedSize([W, H]);
      player.camera.cur = { ...player.camera.home };
      player.camera.tgt = { ...player.camera.home };
      window.__tw2.pending = 0.5;
      await stage.captureFrame();
    },
    { id, toyOpts, W, H },
  );
  if (stills.length) {
    const files = [];
    let now = 0;
    await page.evaluate(() => window.__splashery.player.act(null));
    for (const ts of [0.05, ...stills]) {
      while (now < ts - 1e-6) {
        const d = Math.min(0.25, ts - now);
        await page.evaluate(async (d) => {
          window.__tw2.pending = d;
          await window.__splashery.player.stage.captureFrame();
        }, d);
        now += d;
      }
      if (ts === 0.05 && !stills.includes(0.05)) continue;
      const url = await page.evaluate(async () => {
        window.__tw2.pending = 0;
        const c = await window.__splashery.player.stage.captureFrame();
        return c.toDataURL("image/png");
      });
      const file = path.join(frames, `s${files.length}.png`);
      fs.writeFileSync(file, Buffer.from(url.split(",")[1], "base64"));
      files.push(file);
    }
    const strip = path.join(outDir, `${name || id}-stills.png`);
    execFileSync(ffmpeg, ["-y", "-loglevel", "error", ...files.flatMap((s) => ["-i", s]), "-filter_complex", `hstack=inputs=${files.length}`, strip]); // prettier-ignore
    fs.rmSync(frames, { recursive: true, force: true });
    console.log(`${id}: ${strip}`);
    continue;
  }
  const step = 1 / fps;
  const total = Math.round((before + secs) / step);
  const tapAt = Math.round(before / step);
  const shots = [];
  const pick = new Set();
  if (stripN > 1)
    for (let i = 0; i < stripN; i++) pick.add(Math.round((i / (stripN - 1)) * (total - 1)));
  for (let n = 0; n < total; n++) {
    for (let k = 0; k < taps; k++)
      if (n === tapAt + Math.round((k * gap) / step))
        await page.evaluate(() => window.__splashery.player.act(null));
    const url = await page.evaluate(
      async ({ step }) => {
        const { player } = window.__splashery;
        window.__tw2.pending = step;
        await player.stage.captureFrame();
        window.__tw2.pending = 0;
        const c = await player.stage.captureFrame();
        return c.toDataURL("image/png");
      },
      { step },
    );
    const file = path.join(frames, `f${String(n).padStart(5, "0")}.png`);
    fs.writeFileSync(file, Buffer.from(url.split(",")[1], "base64"));
    if (pick.has(n)) shots.push(file);
  }
  const out = path.join(outDir, `${name || id}.mp4`);
  execFileSync(ffmpeg, ["-y", "-loglevel", "error", "-framerate", String(fps), "-i", path.join(frames, "f%05d.png"), "-movflags", "+faststart", "-pix_fmt", "yuv420p", "-vf", "scale=trunc(iw/2)*2:trunc(ih/2)*2", "-c:v", "libx264", "-crf", "23", out]); // prettier-ignore
  if (shots.length) {
    const strip = path.join(outDir, `${name || id}-strip.png`);
    execFileSync(ffmpeg, ["-y", "-loglevel", "error", ...shots.flatMap((s) => ["-i", s]), "-filter_complex", `hstack=inputs=${shots.length}`, strip]); // prettier-ignore
  }
  fs.rmSync(frames, { recursive: true, force: true });
  console.log(`${id}: ${out} (${(fs.statSync(out).size / 1024).toFixed(0)} KB)`);
}
await browser.close();
