#!/usr/bin/env node
// Lane Powers of ten: renders the zoom as an MP4 clip at phone size, frame by
// frame (each frame waits for the chunks it needs), with the label and the
// scale bar drawn in, as the toy shows them beside the view.
//
//   python3 -m http.server 4173 --bind 127.0.0.1 &
//   SPLASHERY_CHROMIUM=/opt/pw-browsers/chromium node tools/pot-clip.mjs out.mp4 [--w=360] [--h=640] [--fps=20] [--profile=high] [--z=a,b,c,...] [--secs=40]
//
// --z gives the zoom's keyframes (log10 of the view's height in meters),
// eased between and spread evenly over --secs; without it, the toy's own
// journey (Play). Needs imageio-ffmpeg (pip install imageio-ffmpeg).
import { chromium } from "@playwright/test";
import fs from "node:fs";
import path from "node:path";
import os from "node:os";
import { execFileSync } from "node:child_process";

const base = process.env.SPLASHERY_URL || "http://127.0.0.1:4173/";
const args = process.argv.slice(2);
const opt = (name, def) => {
  const a = args.find((x) => x.startsWith(`--${name}=`));
  return a ? a.slice(name.length + 3) : def;
};
const [out] = args.filter((a) => !a.startsWith("--"));
if (!out) throw new Error("Usage: node tools/pot-clip.mjs out.mp4 [--z=...]");
const W = Number(opt("w", 360));
const H = Number(opt("h", 640));
const fps = Number(opt("fps", 20));
const secs = Number(opt("secs", 40));
const keys = opt("z", "") ? opt("z", "").split(",").map(Number) : null;
const profile = opt("profile", "high");
const dir = fs.mkdtempSync(path.join(os.tmpdir(), "pot-clip-"));

const browser = await chromium.launch({
  executablePath: process.env.SPLASHERY_CHROMIUM || undefined,
  args: ["--use-angle=swiftshader", "--enable-unsafe-swiftshader", "--ignore-gpu-blocklist", "--enable-webgl"], // prettier-ignore
});
const page = await browser.newPage({ viewport: { width: 1000, height: 1000 } });
page.on("pageerror", (e) => console.error("page error:", e.message));
await page.goto(`${base}?renderer=webgl2&profile=${profile}&adapt=off&labs=1`);
await page.waitForSelector("body[data-ready='true']", { timeout: 180_000 });
await page.evaluate(async ({ W, H }) => {
  const { app, player } = window.__splashery;
  await app.chooseToy("powers-of-ten");
  player.opts.idleDelay = 1e9;
  player.idle.weight = 0;
  const stage = player.stage;
  stage.setFixedSize([W, H]);
  window.__pot = await import("/src/packs/powers-of-ten.js");
}, { W, H }); // prettier-ignore

const ease = (x) => 0.5 - 0.5 * Math.cos(Math.PI * x);
const zAt = async (t) => {
  if (!keys) return page.evaluate((p) => window.__pot.journey(p), t / secs);
  const f = (t / secs) * (keys.length - 1);
  const i = Math.min(keys.length - 2, Math.floor(f));
  return keys[i] + (keys[i + 1] - keys[i]) * ease(f - i);
};

const n = Math.round(secs * fps);
for (let i = 0; i <= n; i++) {
  const z = await zAt(i / fps);
  const png = await page.evaluate(
    async ({ z, W, H }) => {
      const { player } = window.__splashery;
      const stage = player.stage;
      window.__pot.CLIP.z = z;
      // Only the scenes this frame shows are waited for (the ones ahead
      // keep building meanwhile).
      const need = Object.keys(window.__pot.layout(z));
      const busy = () => need.some((id) => !["ready", "failed"].includes(player.chunks?.items.get(id)?.state)); // prettier-ignore
      let c = await stage.captureFrame();
      for (let k = 0; k < 600 && busy(); k++) {
        await new Promise((r) => setTimeout(r, 100));
        c = await stage.captureFrame();
      }
      // (A scene that just finished shows from the next frame, sorted the one after.)
      await stage.captureFrame();
      c = await stage.captureFrame();
      // The label and the scale bar, as the toy shows them.
      const g = c.getContext("2d");
      const lg = player.motion.out?.legend;
      if (lg) {
        const lines = [lg.title, lg.items[0].text];
        g.font = "600 15px system-ui, sans-serif";
        const wrap = (text, max) => {
          const words = text.split(" ");
          const rows = [];
          let row = "";
          for (const w of words) {
            if (g.measureText(`${row} ${w}`).width > max && row) {
              rows.push(row);
              row = w;
            } else row = row ? `${row} ${w}` : w;
          }
          rows.push(row);
          return rows;
        };
        g.font = "13px system-ui, sans-serif";
        const rows = wrap(lines[1], W - 32);
        const boxH = 30 + rows.length * 17 + 26;
        g.fillStyle = "rgba(0,0,0,0.55)";
        g.fillRect(0, H - boxH, W, boxH);
        g.fillStyle = "#fff";
        g.font = "600 16px system-ui, sans-serif";
        g.fillText(lines[0], 14, H - boxH + 22);
        g.font = "13px system-ui, sans-serif";
        rows.forEach((r, k) => g.fillText(r, 14, H - boxH + 42 + k * 17));
        const ru = lg.items.find((x) => x.ruler);
        if (ru) {
          const a = stage.toScreen([0, 0, 0]);
          const b = stage.toScreen([ru.ruler.size, 0, 0]);
          const px = Math.min(W * 0.4, Math.hypot(b[0] - a[0], b[1] - a[1]));
          const y = H - 14;
          g.strokeStyle = "#fff";
          g.lineWidth = 2;
          g.beginPath();
          g.moveTo(14, y - 6);
          g.lineTo(14, y);
          g.lineTo(14 + px, y);
          g.lineTo(14 + px, y - 6);
          g.stroke();
          g.fillText(ru.text, 22 + px, y);
        }
      }
      const blob = await new Promise((r) => c.toBlob(r, "image/png"));
      const buf = new Uint8Array(await blob.arrayBuffer());
      let s = "";
      for (let k = 0; k < buf.length; k += 0x8000) s += String.fromCharCode(...buf.subarray(k, k + 0x8000)); // prettier-ignore
      return btoa(s);
    },
    { z, W, H },
  );
  fs.writeFileSync(
    path.join(dir, `f${String(i).padStart(5, "0")}.png`),
    Buffer.from(png, "base64"),
  );
  if (i % 50 === 0) console.log(`frame ${i}/${n} z=${z.toFixed(2)}`);
}
await browser.close();
const ffmpeg = execFileSync("python3", ["-c", "import imageio_ffmpeg;print(imageio_ffmpeg.get_ffmpeg_exe())"]).toString().trim(); // prettier-ignore
execFileSync(ffmpeg, ["-y", "-loglevel", "error", "-framerate", String(fps), "-i", path.join(dir, "f%05d.png"), "-movflags", "+faststart", "-pix_fmt", "yuv420p", "-vf", "scale=trunc(iw/2)*2:trunc(ih/2)*2", "-c:v", "libx264", "-crf", "23", out]); // prettier-ignore
fs.rmSync(dir, { recursive: true, force: true });
console.log(`${out}: ${(fs.statSync(out).size / 1024).toFixed(0)} KB, ${n + 1} frames`);
