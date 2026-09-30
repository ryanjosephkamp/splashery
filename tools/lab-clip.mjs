#!/usr/bin/env node
// Lane Lab: a before-and-after clip for the Effect review page. Renders a toy
// turning at 390×844, once with each kernel, and puts them side by side
// (before on the left) in one looping GIF.
//
//   python3 -m http.server 4173 --bind 127.0.0.1 &
//   SPLASHERY_CHROMIUM=/opt/pw-browsers/chromium node tools/lab-clip.mjs <out.gif> <toy id> [--kernels=gaussian,sharp] [--zoom=1] [--secs=4] [--fps=12] [--turn=30] [--opt=key=value] [--strip=<out.png>]
//
// --turn is how far the view turns, in degrees, over the clip. --strip also
// writes the first frame of the pair as a PNG still. The toy's clock is
// stepped by hand (1/fps a frame), so motion plays at its real speed however
// slow the renderer is; --tap=<seconds> taps the toy that far into the clip
// (--canvas-tap: a tap on the canvas through the app's pick, in the middle,
// or --canvas-tap=0.3,0.6 at those fractions of its width and height).
// With one kernel the clip is a single 390×844 view.

import { chromium } from "@playwright/test";
import fs from "node:fs";

const base = process.env.SPLASHERY_URL || "http://127.0.0.1:4173/";
const args = process.argv.slice(2);
const opt = (name, def) => {
  const a = args.find((x) => x.startsWith(`--${name}=`));
  return a ? a.slice(name.length + 3) : def;
};
const [out, id] = args.filter((a) => !a.startsWith("--"));
if (!out || !id) throw new Error("Usage: node tools/lab-clip.mjs <out.gif> <toy id>");
const kernels = opt("kernels", "gaussian,sharp").split(",");
const zoom = Number(opt("zoom", 1));
const secs = Number(opt("secs", 4));
const fps = Number(opt("fps", 12));
const turn = Number(opt("turn", 30));
const toyOpt = opt("opt", "");
const strip = opt("strip", "");
const tapAt = Number(opt("tap", -1));
const canvasTap = args.some((a) => a === "--canvas-tap" || a.startsWith("--canvas-tap="));
// Where the canvas tap lands, as fractions of the canvas (the middle by default).
const tapFrac = (opt("canvas-tap", "") || "0.5,0.5").split(",").map(Number);

const browser = await chromium.launch({
  executablePath: process.env.SPLASHERY_CHROMIUM || undefined,
  args: ["--use-angle=swiftshader", "--enable-unsafe-swiftshader", "--ignore-gpu-blocklist", "--enable-webgl"], // prettier-ignore
});
const page = await browser.newPage({ viewport: { width: 1000, height: 900 } });
page.on("pageerror", (e) => console.error("page error:", e.message));
await page.goto(`${base}?renderer=webgl2&profile=high&adapt=off&labs=1`);
await page.waitForSelector("body[data-ready='true']", { timeout: 180_000 });

const { gif, still } = await page.evaluate(
  async ({ id, kernels, zoom, secs, fps, turn, toyOpt, tapAt, canvasTap, tapFrac }) => {
    const { app, player } = window.__splashery;
    const { GIFEncoder, quantize, applyPalette } = await import("gifenc");
    const W = 390;
    const H = 844;
    const n = Math.round(secs * fps);
    const runs = [];
    for (const kernel of kernels) {
      const url = new URL(location.href);
      url.searchParams.set("kernel", kernel);
      history.replaceState(null, "", url);
      await app.chooseToy(id);
      if (toyOpt) {
        const [key, value] = toyOpt.split("=");
        await app.setToyOption(key, value);
        // The rebuild resets the view: back to the toy's own.
        const { findToy } = await import("/src/toys.js");
        const def = findToy(id)?.camera;
        if (def) player.camera.setState(def, { asHome: true, snap: true });
      }
      app.setLook({ background: "#ffffff" });
      player.opts.idleDelay = 1e9;
      player.idle.weight = 0;
      player.camera.setTurntable(false);
      const stage = player.stage;
      stage.setFixedSize([W, H]);
      const cam = player.camera;
      const view = { ...cam.home, distance: cam.home.distance * zoom };
      const put = (v) => {
        cam.cur = { ...v };
        cam.tgt = { ...v };
      };
      const until = performance.now() + (id.startsWith("picture") ? 9000 : 2500);
      while (performance.now() < until) {
        put(view);
        await stage.captureFrame();
        await new Promise((r) => setTimeout(r, 100));
      }
      // Step the clock by hand from here on.
      const handlers = stage.updateHandlers.slice();
      let pending = 0;
      stage.updateHandlers.length = 0;
      stage.updateHandlers.push(() => {
        const d = pending;
        pending = 0;
        for (const h of handlers) h(d);
      });
      const frames = [];
      for (let k = 0; k < n; k++) {
        if (tapAt >= 0 && k === Math.round(tapAt * fps)) {
          // A real tap on the canvas, as a finger's: through the app's pick.
          if (canvasTap) {
            const r = player.canvas.getBoundingClientRect();
            await app.tapToy({
              clientX: r.left + r.width * tapFrac[0],
              clientY: r.top + r.height * tapFrac[1],
            });
          } else player.act(null);
        }
        pending = 1 / fps;
        // Turn out and back, so the loop has no jump.
        const f = Math.sin((Math.PI * 2 * k) / n);
        put({ ...view, yaw: view.yaw + (f * turn * Math.PI) / 360 });
        await stage.captureFrame();
        const c = await stage.captureFrame();
        frames.push(c.getContext("2d").getImageData(0, 0, W, H));
      }
      stage.setFixedSize(null);
      stage.updateHandlers.length = 0;
      stage.updateHandlers.push(...handlers);
      runs.push(frames);
    }
    const gap = 6;
    const cw = W * runs.length + gap * (runs.length - 1);
    const canvas = document.createElement("canvas");
    canvas.width = cw;
    canvas.height = H;
    const g = canvas.getContext("2d");
    const enc = GIFEncoder();
    let still = null;
    for (let k = 0; k < n; k++) {
      g.fillStyle = "#888";
      g.fillRect(0, 0, cw, H);
      runs.forEach((frames, i) => g.putImageData(frames[k], i * (W + gap), 0));
      g.fillStyle = "rgba(0,0,0,0.6)";
      g.font = "bold 16px system-ui, sans-serif";
      if (runs.length > 1)
        runs.forEach((_, i) => g.fillText(i === 0 ? "Before" : "After", i * (W + gap) + 12, 26));
      const rgba = g.getImageData(0, 0, cw, H).data;
      const palette = quantize(rgba, 256, { format: "rgb565" });
      enc.writeFrame(applyPalette(rgba, palette, "rgb565"), cw, H, { palette, delay: Math.round(1000 / fps), repeat: 0 }); // prettier-ignore
      if (k === 0) still = canvas.toDataURL("image/png");
    }
    enc.finish();
    return { gif: Array.from(enc.bytes()), still };
  },
  { id, kernels, zoom, secs, fps, turn, toyOpt, tapAt, canvasTap, tapFrac },
);
fs.writeFileSync(out, Buffer.from(gif));
if (strip) fs.writeFileSync(strip, Buffer.from(still.split(",")[1], "base64"));
console.log(out, (gif.length / 1024).toFixed(0), "KB");
await browser.close();
