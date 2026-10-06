#!/usr/bin/env node
// Earth and maps (lane Geo, round 2): a toy's tap effect as an MP4 clip at
// phone width, with labs on (so the toys' sharp kernel is used, as the owner
// sees them), from lossless frames (a GIF's 256 colors soften the land).
// The same stepping as tools/effect-clip.mjs: the clock is moved by hand, so
// the clip runs at real speed however slow the renderer is.
//
//   python3 -m http.server 4173 --bind 127.0.0.1 &
//   SPLASHERY_CHROMIUM=/opt/pw-browsers/chromium node tools/geo-clip.mjs <out-dir> [--w=390] [--h=520] [--fps=15] [--before=0.4] [--taps=1] [--gap=1] [--opt=key=value] [--strip=8] id[:secs] ...
//
// Writes <out-dir>/geo-<id>.mp4 (and geo-<id>-strip.png with --strip).

import { chromium } from "@playwright/test";
import fs from "node:fs";
import path from "node:path";
import { execFileSync } from "node:child_process";

const base = process.env.SPLASHERY_URL || "http://127.0.0.1:4173/";
const args = process.argv.slice(2);
const opt = (name, def) => {
  const a = args.find((x) => x.startsWith(`--${name}=`));
  return a ? a.slice(name.length + 3) : def;
};
const [outDir, ...ids] = args.filter((a) => !a.startsWith("--"));
if (!outDir || !ids.length)
  throw new Error("Usage: node tools/geo-clip.mjs <out-dir> id[:secs] ...");
const W = Number(opt("w", 390));
const H = Number(opt("h", 520));
const fps = Number(opt("fps", 15));
const before = Number(opt("before", 0.4));
const taps = Number(opt("taps", 1));
const gap = Number(opt("gap", 1));
const toyOpt = opt("opt", "");
const stripN = Number(opt("strip", 0));
const ffmpeg = process.env.FFMPEG || "ffmpeg";

fs.mkdirSync(outDir, { recursive: true });
const browser = await chromium.launch({
  executablePath: process.env.SPLASHERY_CHROMIUM || undefined,
  args: ["--use-angle=swiftshader", "--enable-unsafe-swiftshader", "--ignore-gpu-blocklist", "--enable-webgl"], // prettier-ignore
});
const page = await browser.newPage({ viewport: { width: 1000, height: 900 } });
page.on("pageerror", (e) => console.error("page error:", e.message));
let frameDir = null;
await page.exposeFunction("geoFrame", (n, url) => {
  fs.writeFileSync(path.join(frameDir, `${String(n).padStart(4, "0")}.png`), Buffer.from(url.split(",")[1], "base64")); // prettier-ignore
});
await page.goto(`${base}?renderer=webgl2&profile=high&adapt=off&labs=1`);
await page.waitForSelector("body[data-ready='true']", { timeout: 180_000 });
for (const spec of ids) {
  const [id, own] = spec.split(":");
  const secs = own ? Number(own) : 6;
  frameDir = fs.mkdtempSync(path.join(outDir, `.frames-${id}-`));
  const n = await page.evaluate(
    async ({ id, W, H, secs, fps, before, taps, gap, toyOpt }) => {
      const { app, player } = window.__splashery;
      await app.chooseToy(id);
      if (toyOpt) {
        const [key, value] = toyOpt.split("=");
        await app.setToyOption(key, value);
      }
      app.setLook({ background: "#111111" });
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
      const home = () => {
        player.camera.cur = { ...player.camera.home };
        player.camera.tgt = { ...player.camera.home };
      };
      const step = 1 / fps;
      let n = 0;
      const frame = async () => {
        pending = step;
        home();
        await stage.captureFrame();
        pending = 0;
        const c = await stage.captureFrame();
        await window.geoFrame(n++, c.toDataURL("image/png"));
      };
      pending = 0.5;
      await stage.captureFrame();
      for (let t = 0; t < before; t += step) await frame();
      for (let i = 0; i < taps; i++) {
        player.act(null);
        if (i < taps - 1) for (let t = 0; t < gap - 1e-6; t += step) await frame();
      }
      for (let t = 0; t < secs - 1e-6; t += step) await frame();
      stage.setFixedSize(null);
      stage.updateHandlers.length = 0;
      stage.updateHandlers.push(...handlers);
      return n;
    },
    { id, W, H, secs, fps, before, taps, gap, toyOpt },
  );
  const out = path.join(outDir, `geo-${id}.mp4`);
  execFileSync(ffmpeg, ["-loglevel", "error", "-y", "-framerate", String(fps), "-i", path.join(frameDir, "%04d.png"), "-movflags", "+faststart", "-pix_fmt", "yuv420p", "-c:v", "libx264", "-crf", "18", out]); // prettier-ignore
  if (stripN > 1) {
    const pick = Array.from({ length: stripN }, (_, i) => Math.round((i * (n - 1)) / (stripN - 1)));
    const sel = pick.map((p) => `eq(n\\,${p})`).join("+");
    execFileSync(ffmpeg, ["-loglevel", "error", "-y", "-i", out, "-vf", `select='${sel}',scale=${Math.round(W / 2)}:-1,tile=${stripN}x1`, "-frames:v", "1", path.join(outDir, `geo-${id}-strip.png`)]); // prettier-ignore
  }
  fs.rmSync(frameDir, { recursive: true, force: true });
  console.log(`${id}: ${out} (${(fs.statSync(out).size / 1024).toFixed(0)} KB, ${n} frames)`);
}
await browser.close();
