#!/usr/bin/env node
// Renders a toy's touch play (drags and taps) as a looping GIF clip, like
// tools/effect-clip.mjs does for a single tap. A white dot shows the finger.
//
//   python3 -m http.server 4173 --bind 127.0.0.1 &
//   SPLASHERY_CHROMIUM=/opt/pw-browsers/chromium node tools/drag-clip.mjs <out-dir> <name> <toy id> <script.json> [--size=320] [--fps=15] [--bg=#111111] [--strip=8] [--cam=yaw,pitch]
//
// The script is a JSON list of steps, played in order, in recipe
// coordinates (the toy's build space):
//   { "wait": 1.2 }                               frames with nothing done
//   { "drag": [[x, y, z], [x, y, z], ...], "secs": 0.6, "hold": 0.2 }
//        press on the first point, move along the points over secs, hold
//        still for hold seconds, then let go (the player's grab path)
//   { "tap": [x, y, z] }                          a tap on the toy there
//   { "act": true }                               the toy's action (Play)
// Writes <out-dir>/<name>.gif (and <name>-strip.png with --strip).

import { chromium } from "@playwright/test";
import fs from "node:fs";
import path from "node:path";

const base = process.env.SPLASHERY_URL || "http://127.0.0.1:4173/";
const args = process.argv.slice(2);
const opt = (name, def) => {
  const a = args.find((x) => x.startsWith(`--${name}=`));
  return a ? a.slice(name.length + 3) : def;
};
const [outDir, name, id, scriptFile] = args.filter((a) => !a.startsWith("--"));
if (!scriptFile) throw new Error("Usage: node tools/drag-clip.mjs <out-dir> <name> <toy id> <script.json>"); // prettier-ignore
const script = JSON.parse(fs.readFileSync(scriptFile, "utf8"));
const size = Number(opt("size", 320));
const fps = Number(opt("fps", 15));
const bg = opt("bg", "#111111");
const stripN = Number(opt("strip", 0));
const cam = opt("cam", "") ? opt("cam", "").split(",").map(Number) : null;

fs.mkdirSync(outDir, { recursive: true });
const browser = await chromium.launch({
  executablePath: process.env.SPLASHERY_CHROMIUM || undefined,
  args: ["--use-angle=swiftshader", "--enable-unsafe-swiftshader", "--ignore-gpu-blocklist", "--enable-webgl"], // prettier-ignore
});
const page = await browser.newPage({ viewport: { width: 700, height: 700 } });
page.on("pageerror", (e) => console.error("page error:", e.message));
await page.goto(`${base}?renderer=webgl2&profile=high&adapt=off`);
await page.waitForSelector("body[data-ready='true']", { timeout: 180_000 });
const { bytes, strip } = await page.evaluate(
  async ({ id, size, fps, bg, script, stripN, cam }) => {
    const { app, player } = window.__splashery;
    const { GIFEncoder, quantize, applyPalette } = await import("gifenc");
    await app.chooseToy(id);
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
    stage.setFixedSize([size, size]);
    const home = { ...player.camera.home };
    if (cam) Object.assign(home, { yaw: home.yaw + cam[0], pitch: home.pitch + cam[1] });
    const hold = () => {
      player.camera.cur = { ...home };
      player.camera.tgt = { ...home };
    };
    const step = 1 / fps;
    const gif = GIFEncoder();
    const delay = Math.round(1000 / fps);
    const frames = [];
    let finger = null; // [x, y] in CSS pixels while pressed
    const frame = async () => {
      pending = step;
      hold();
      await stage.captureFrame();
      pending = 0;
      const c = await stage.captureFrame();
      const ctx = c.getContext("2d");
      if (finger) {
        const r = stage.canvas.getBoundingClientRect();
        const x = (finger[0] / r.width) * size;
        const y = (finger[1] / r.height) * size;
        ctx.beginPath();
        ctx.arc(x, y, size * 0.035, 0, Math.PI * 2);
        ctx.fillStyle = "rgba(255,255,255,0.55)";
        ctx.strokeStyle = "rgba(0,0,0,0.5)";
        ctx.lineWidth = 1.5;
        ctx.fill();
        ctx.stroke();
      }
      if (stripN > 1) frames.push(await createImageBitmap(c));
      const rgba = ctx.getImageData(0, 0, size, size).data;
      const palette = quantize(rgba, 256, { format: "rgb565" });
      gif.writeFrame(applyPalette(rgba, palette, "rgb565"), size, size, { palette, delay, repeat: 0 }); // prettier-ignore
    };
    pending = 0.5;
    hold();
    await stage.captureFrame();
    for (const s of script) {
      if (s.wait) for (let t = 0; t < s.wait - 1e-6; t += step) await frame();
      else if (s.tap) {
        finger = player.screenPoint(s.tap);
        player.act(player.fromRecipe(s.tap));
        await frame();
        await frame();
        finger = null;
      } else if (s.act) player.act();
      else if (s.drag) {
        const pts = s.drag;
        const at = (u) => {
          const f = Math.min(pts.length - 1, u * (pts.length - 1));
          const i = Math.min(pts.length - 2, Math.floor(f));
          const k = f - i;
          return pts[i].map((v, j) => v + (pts[i + 1][j] - v) * k);
        };
        finger = player.screenPoint(pts[0]);
        player.grabStart(player.fromRecipe(pts[0]), ...finger);
        await frame();
        const n = Math.max(1, Math.round((s.secs ?? 0.6) / step));
        for (let i = 1; i <= n; i++) {
          finger = player.screenPoint(at(i / n));
          player.grabAt(...finger);
          await frame();
        }
        for (let t = 0; t < (s.hold ?? 0) - 1e-6; t += step) await frame();
        player.grabEnd();
        finger = null;
      }
    }
    gif.finish();
    stage.setFixedSize(null);
    stage.updateHandlers.length = 0;
    stage.updateHandlers.push(...handlers);
    let strip = null;
    if (stripN > 1) {
      const pick = Array.from({ length: stripN }, (_, i) => frames[Math.round((i / (stripN - 1)) * (frames.length - 1))]); // prettier-ignore
      const out = document.createElement("canvas");
      out.width = size * pick.length;
      out.height = size;
      const ctx = out.getContext("2d");
      pick.forEach((b, i) => ctx.drawImage(b, i * size, 0, size, size));
      strip = out.toDataURL("image/png");
    }
    return { bytes: Array.from(gif.bytes()), strip };
  },
  { id, size, fps, bg, script, stripN, cam },
);
fs.writeFileSync(path.join(outDir, `${name}.gif`), Buffer.from(bytes));
if (strip) fs.writeFileSync(path.join(outDir, `${name}-strip.png`), Buffer.from(strip.split(",")[1], "base64")); // prettier-ignore
console.log(
  `${name}: ${path.join(outDir, `${name}.gif`)} (${(bytes.length / 1024).toFixed(0)} KB)`,
);
await browser.close();
