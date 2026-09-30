#!/usr/bin/env node
// Lane Chemistry's clips: a toy at phone size (a 390 x 844 page by default;
// the clip is its stage, above the toy sheet) played through a script of
// taps, as a looping GIF. Like tools/effect-clip.mjs, the
// clock is stepped by hand, so the clip shows the effects at their real
// speed however slow the renderer is; a tap that switches the toy (a tile of
// the periodic table) waits for the rebuild without recording it.
//
//   python3 -m http.server 4173 --bind 127.0.0.1 &
//   SPLASHERY_CHROMIUM=/opt/pw-browsers/chromium node tools/chs-clip.mjs <out.gif> <toy> "<script>" [--w=390] [--h=844] [--fps=12] [--opt=key=value] [--dist=1] [--strip=8]
//
// The script is a list of steps separated by ";":
//   wait:2.5        record 2.5 seconds
//   tap             the toy's own tap (the Play button)
//   tap:x,y,z       a tap at a point in recipe coordinates
//   tile:Na         (periodic table) a tap on that element's tile
//   atom            (periodic table) a tap on the risen atom
//   opt:key=value   set an option (rebuilds the toy, not recorded)
// --dist multiplies the camera's home distance.

import { chromium } from "@playwright/test";
import fs from "node:fs";

const args = process.argv.slice(2);
const opt = (name, def) => {
  const a = args.find((x) => x.startsWith(`--${name}=`));
  return a ? a.slice(name.length + 3) : def;
};
const [out, toy, script] = args.filter((a) => !a.startsWith("--"));
if (!out || !toy || !script)
  throw new Error('Usage: node tools/chs-clip.mjs <out.gif> <toy> "<script>"');
const W = Number(opt("w", 390));
const H = Number(opt("h", 844));
const fps = Number(opt("fps", 12));
const toyOpt = opt("opt", "");
const dist = Number(opt("dist", 1));
const stripN = Number(opt("strip", 0));
const base = process.env.SPLASHERY_URL || "http://127.0.0.1:4173/";

const browser = await chromium.launch({
  executablePath: process.env.SPLASHERY_CHROMIUM || undefined,
  args: ["--use-angle=swiftshader", "--enable-unsafe-swiftshader", "--ignore-gpu-blocklist", "--enable-webgl"], // prettier-ignore
});
// The page is the clip's size, so the toy is framed as on a phone.
const page = await browser.newPage({ viewport: { width: W, height: H } });
page.on("pageerror", (e) => console.error("page error:", e.message));
page.on("console", (m) => m.text().startsWith("camera") && console.log(m.text()));
await page.goto(`${base}?renderer=webgl2&profile=mid&adapt=off`);
await page.waitForSelector("body[data-ready='true']", { timeout: 180_000 });
const res = await page.evaluate(
  async ({ toy, script, W, H, fps, toyOpt, dist, stripN }) => {
    const { app, player } = window.__splashery;
    const { GIFEncoder, quantize, applyPalette } = await import("gifenc");
    await app.chooseToy(toy);
    for (const kv of toyOpt ? toyOpt.split(",") : []) {
      const [key, value] = kv.split("=");
      await app.setToyOption(key, value);
    }
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
    // The toy's own starting view (its camera in src/toys.js), as the app shows it.
    const start = player.camera.getState();
    console.log(
      "camera",
      JSON.stringify(start),
      player.camera.radius,
      player.canvas.clientWidth,
      player.canvas.clientHeight,
    );
    const home = () => {
      player.camera.setState({ ...start, distance: start.distance * dist }, { snap: true });
    };
    const step = 1 / fps;
    const gif = GIFEncoder();
    const delay = Math.round(1000 / fps);
    const frames = [];
    const frame = async () => {
      pending = step;
      home();
      await stage.captureFrame();
      pending = 0;
      const c = await stage.captureFrame();
      // The stage as the phone shows it (the page minus the toy sheet).
      const cw = c.width;
      const ch = c.height;
      const rgba = c.getContext("2d").getImageData(0, 0, cw, ch).data;
      const palette = quantize(rgba, 256, { format: "rgb565" });
      gif.writeFrame(applyPalette(rgba, palette, "rgb565"), cw, ch, { palette, delay, repeat: 0 });
      frames.push(await createImageBitmap(c));
      if (frames.length > 400) frames.shift();
    };
    const toWorld = (p) => {
      const tf = player.motion.ctx?.transform;
      return tf ? p.map((v, i) => (v - tf.center[i]) * tf.scale) : p;
    };
    // Waits for a rebuild (a switched toy) to finish, without recording.
    const settle = async (was) => {
      const t0 = performance.now();
      while (player.motion.ctx === was && performance.now() - t0 < 120_000)
        await new Promise((r) => setTimeout(r, 50));
      while (player.loading && performance.now() - t0 < 120_000)
        await new Promise((r) => setTimeout(r, 50));
      await new Promise((r) => setTimeout(r, 300));
    };
    pending = 0.5;
    await stage.captureFrame();
    const marks = [];
    for (const s of script.split(";").map((x) => x.trim())) {
      const [cmd, arg = ""] = s.split(":");
      if (cmd === "wait") {
        const secs = Number(arg);
        for (let t = 0; t < secs - 1e-6; t += step) await frame();
      } else if (cmd === "opt") {
        const [key, value] = arg.split("=");
        await app.setToyOption(key, value);
        await new Promise((r) => setTimeout(r, 500));
      } else {
        let point = null;
        const recipe = player.toyInfo.recipe;
        if (cmd === "tap" && arg) point = arg.split(",").map(Number);
        if (cmd === "tile") point = recipe.tileAt(arg);
        if (cmd === "atom") point = recipe.atomAt();
        const was = player.motion.ctx;
        const r = player.act(point ? toWorld(point) : null);
        marks.push(frames.length);
        if (r?.options) await settle(was);
      }
    }
    gif.finish();
    stage.updateHandlers.length = 0;
    stage.updateHandlers.push(...handlers);
    let strip = null;
    if (stripN > 1 && frames.length) {
      const sw = Math.round(frames[0].width / 2);
      const sh = Math.round(frames[0].height / 2);
      const c = document.createElement("canvas");
      c.width = sw * stripN;
      c.height = sh;
      const g = c.getContext("2d");
      for (let i = 0; i < stripN; i++) {
        const f = frames[Math.min(frames.length - 1, Math.round(((i + 0.5) / stripN) * frames.length))]; // prettier-ignore
        g.drawImage(f, i * sw, 0, sw, sh);
      }
      strip = c.toDataURL("image/png");
    }
    return { bytes: Array.from(gif.bytes()), strip, n: frames.length };
  },
  { toy, script, W, H, fps, toyOpt, dist, stripN },
);
fs.writeFileSync(out, Buffer.from(res.bytes));
if (res.strip) fs.writeFileSync(out.replace(/\.gif$/, "-strip.png"), Buffer.from(res.strip.split(",")[1], "base64")); // prettier-ignore
console.log(`${out}: ${res.n} frames, ${(res.bytes.length / 1024).toFixed(0)} KB`);
await browser.close();
