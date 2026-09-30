#!/usr/bin/env node
// Video to 3D (lane Video 3D): clips of the Video to 3D toy for the Effect review page, at a
// phone's or a desktop's size, as looping GIFs. The clock is stepped by hand (like
// tools/effect-clip.mjs), so the clip moves at its real speed however slow the renderer is.
//
//   python3 -m http.server 4173 --bind 127.0.0.1 &
//   SPLASHERY_CHROMIUM=/opt/pw-browsers/chromium node tools/v3d-clip.mjs <out.gif> \
//     --scene=<sample id> --mode=turn|replay|roam [--size=390x844] [--secs=8] [--fps=12]
//
// turn: the camera swings around the scene. replay: the tap (Replay flight) flies the video's
// camera path. roam: the flight, then the camera turns away from where the flight ended.
// --strip=6 also writes <out>-strip.png, six frames side by side.

import { chromium } from "@playwright/test";
import fs from "node:fs";

const base = process.env.SPLASHERY_URL || "http://127.0.0.1:4173/";
const args = process.argv.slice(2);
const opt = (name, def) => {
  const a = args.find((x) => x.startsWith(`--${name}=`));
  return a ? a.slice(name.length + 3) : def;
};
const [out] = args.filter((a) => !a.startsWith("--"));
if (!out) throw new Error("Usage: node tools/v3d-clip.mjs <out.gif> --scene=<id> --mode=turn");
const [w, h] = opt("size", "390x844").split("x").map(Number);
const settings = {
  scene: opt("scene", ""),
  mode: opt("mode", "turn"),
  secs: Number(opt("secs", 8)),
  fps: Number(opt("fps", 12)),
  scale: Number(opt("scale", 1)),
  strip: Number(opt("strip", 0)),
  swing: Number(opt("swing", 0.9)),
  bg: opt("bg", "#111111"),
};

const browser = await chromium.launch({
  executablePath: process.env.SPLASHERY_CHROMIUM || undefined,
  args: ["--use-angle=swiftshader", "--enable-unsafe-swiftshader", "--ignore-gpu-blocklist"],
});
const page = await browser.newPage({ viewport: { width: w, height: h } });
page.on("pageerror", (e) => console.error("page error:", e.message));
await page.goto(`${base}?labs=1&renderer=webgl2&profile=high&adapt=off`);
await page.waitForSelector("body[data-ready='true']", { timeout: 180_000 });
const res = await page.evaluate(
  async ({ s, w, h }) => {
    const { app, player } = window.__splashery;
    const { GIFEncoder, quantize, applyPalette } = await import("gifenc");
    await app.chooseToy("video-3d");
    if (s.scene) await app.setToyOptions({ source: s.scene });
    app.setLook({ background: s.bg });
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
      for (const fn of handlers) fn(d);
    });
    const W = Math.round(w * s.scale);
    const H = Math.round(h * s.scale);
    stage.setFixedSize([W, H]);
    const cam = player.camera;
    cam.turntable = false;
    const home = { ...cam.home };
    const step = 1 / s.fps;
    const gif = GIFEncoder();
    const delay = Math.round(1000 / s.fps);
    const total = Math.round(s.secs * s.fps);
    const shots = [];
    const pick = new Set();
    for (let i = 0; i < s.strip; i++) pick.add(Math.round(((i + 0.5) / s.strip) * total));
    let n = 0;
    let roamFrom = null;
    const frame = async () => {
      const f = n / Math.max(1, total - 1);
      if (s.mode === "turn") {
        const yaw = home.yaw + s.swing * Math.sin(f * Math.PI * 2);
        cam.cur = { ...home, yaw, pitch: home.pitch + 0.15 * Math.sin(f * Math.PI * 4) };
        cam.tgt = { ...cam.cur };
      }
      if (s.mode === "roam" && player.motion.state.replay > 0.5) {
        // After the path's end, the camera turns away from where the flight ended.
        const flight = player.proc?.ctx?.kit?.data?.flight;
        const t = player.time;
        if (flight && roamFrom === null && flight.state?.done) roamFrom = t;
        if (roamFrom !== null) {
          const k = Math.min(1, (t - roamFrom) / 3);
          cam.cur = { ...cam.cur, yaw: cam.cur.yaw + step * 0.5 * Math.sin(k * Math.PI) };
          cam.tgt = { ...cam.cur };
        }
      }
      pending = step;
      await stage.captureFrame();
      pending = 0;
      const c = await stage.captureFrame();
      if (pick.has(n)) shots.push({ bmp: await createImageBitmap(c), t: n * step });
      n++;
      const rgba = c.getContext("2d").getImageData(0, 0, W, H).data;
      const palette = quantize(rgba, 256, { format: "rgb565" });
      gif.writeFrame(applyPalette(rgba, palette, "rgb565"), W, H, { palette, delay, repeat: 0 });
    };
    pending = 0.5;
    await stage.captureFrame();
    if (s.mode !== "turn") {
      for (let i = 0; i < 4; i++) await frame();
      player.act(null);
    }
    while (n < total) await frame();
    gif.finish();
    stage.setFixedSize(null);
    stage.updateHandlers.length = 0;
    stage.updateHandlers.push(...handlers);
    let strip = null;
    if (shots.length) {
      const sw = Math.round(W / 2);
      const sh = Math.round(H / 2);
      const o = document.createElement("canvas");
      o.width = sw * shots.length;
      o.height = sh + 18;
      const g = o.getContext("2d");
      g.fillStyle = s.bg;
      g.fillRect(0, 0, o.width, o.height);
      g.font = "12px sans-serif";
      g.fillStyle = "#bbb";
      shots.forEach((x, i) => {
        g.drawImage(x.bmp, i * sw, 0, sw, sh);
        g.fillText(`${x.t.toFixed(1)}s`, i * sw + 6, sh + 13);
      });
      strip = o.toDataURL("image/png");
    }
    return { bytes: Array.from(gif.bytes()), strip, info: player.proc?.ctx?.kit?.data?.video };
  },
  { s: settings, w, h },
);
fs.writeFileSync(out, Buffer.from(res.bytes));
if (res.strip)
  fs.writeFileSync(out.replace(/\.gif$/, "-strip.png"), Buffer.from(res.strip.split(",")[1], "base64")); // prettier-ignore
console.log(`${out}: ${(res.bytes.length / 1024).toFixed(0)} KB`, JSON.stringify(res.info));
await browser.close();
