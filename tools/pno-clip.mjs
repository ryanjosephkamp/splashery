#!/usr/bin/env node
// Lane Pianos: renders a keyboard toy as a phone-sized clip (390×844 by
// default), with the page's own song bar, for the Effect review page. Like
// tools/effect-clip.mjs, the clock is stepped by hand, so the clip shows the
// real speed however slow the renderer is.
//
//   python3 -m http.server 4173 --bind 127.0.0.1 &
//   SPLASHERY_CHROMIUM=/opt/pw-browsers/chromium node tools/pno-clip.mjs <out.gif> --toy=grand-piano \
//     [--size=390x844] [--fps=12] [--secs=5] [--cam=yaw,pitch,distance[,x,y,z]] [--ui=bar|none|app] \
//     [--events='[{"at":0.4,"key":39},{"at":1.5,"tap":true},{"at":2,"midi":"song.mid"},{"at":3,"play":true}]'] \
//     [--strip=8]
//
// --cam: the view (distance in toy radii; x, y, z a point in the recipe's own
// coordinates to look at). --ui: "bar" shows only the song bar, "none" only
// the stage, "app" the whole page. Events: "key" taps key i (from the lowest),
// "tap" taps beside the keys (the opening), "play" presses the bar's play,
// "midi" opens a MIDI file through the Toy tab's song panel, "voice" presses
// the electronic keyboard's panel button i. --strip=8 also writes
// <out>-strip.png.

import { chromium } from "@playwright/test";
import fs from "node:fs";

const base = process.env.SPLASHERY_URL || "http://127.0.0.1:4173/";
const args = process.argv.slice(2);
const opt = (name, def) => {
  const a = args.find((x) => x.startsWith(`--${name}=`));
  return a ? a.slice(name.length + 3) : def;
};
const [out] = args.filter((a) => !a.startsWith("--"));
if (!out) throw new Error("Usage: node tools/pno-clip.mjs <out.gif> --toy=grand-piano …");
const toy = opt("toy", "grand-piano");
const [W, H] = opt("size", "390x844").split("x").map(Number);
const fps = Number(opt("fps", 12));
const secs = Number(opt("secs", 5));
const cam = opt("cam", "") ? opt("cam", "").split(",").map(Number) : null;
const ui = opt("ui", "bar");
const events = JSON.parse(opt("events", "[]"));
const stripN = Number(opt("strip", 0));

const browser = await chromium.launch({
  executablePath: process.env.SPLASHERY_CHROMIUM || undefined,
  args: ["--use-angle=swiftshader", "--enable-unsafe-swiftshader", "--ignore-gpu-blocklist", "--enable-webgl"], // prettier-ignore
});
const page = await browser.newPage({ viewport: { width: W, height: H } });
page.on("pageerror", (e) => console.error("page error:", e.message));
await page.goto(`${base}?renderer=webgl2&profile=high&adapt=off`);
await page.waitForSelector("body[data-ready='true']", { timeout: 180_000 });
await page.evaluate((id) => window.__splashery.app.chooseToy(id), toy);
const hide = {
  bar: ".dock, #panel, .brand, #toy-status, .view-button, #help-line, #help-toggle, #sound-toggle { visibility: hidden !important; }", // prettier-ignore
  none: ".dock, #panel, .brand, #toy-status, .view-button, #help-line, #help-toggle, #sound-toggle, #game-bar { visibility: hidden !important; }", // prettier-ignore
  app: "",
}[ui];
if (hide) await page.addStyleTag({ content: hide });
await page.evaluate(
  async ({ cam }) => {
    const { player } = window.__splashery;
    player.opts.idleDelay = 1e9;
    player.idle.weight = 0;
    player.camera.setTurntable(false);
    const stage = player.stage;
    // The clock: frames move time only by what the clip asks.
    const handlers = stage.updateHandlers.slice();
    window.__clip = { pending: 0 };
    stage.updateHandlers.length = 0;
    stage.updateHandlers.push(() => {
      const d = window.__clip.pending;
      window.__clip.pending = 0;
      for (const h of handlers) h(d);
    });
    const c = player.camera;
    if (cam) {
      c.minDistance = 0.05;
      c.setState({ yaw: cam[0], pitch: cam[1], roll: 0, distance: cam[2] }, { snap: true });
      if (cam.length >= 6) {
        // Aim at the point (the player resets the camera's offset each
        // frame, so the target itself moves).
        const tf = player.motion.ctx?.transform;
        const p = [cam[3], cam[4], cam[5]];
        c.target = tf ? p.map((v, i) => (v - tf.center[i]) * tf.scale) : p;
      }
    }
    window.__clip.hold = { ...c.cur };
    window.__clip.pending = 0.5;
    await stage.captureFrame();
  },
  { cam },
);

await page.evaluate(async () => {
  const { GIFEncoder } = await import("gifenc");
  window.__clip.gif = GIFEncoder();
});
const step = 1 / fps;
const total = Math.round(secs / step);
const pick = new Set();
if (stripN > 1)
  for (let i = 0; i < stripN; i++) pick.add(Math.round((i / (stripN - 1)) * (total - 1)));
const shots = [];
const pending = events.slice().sort((a, b) => a.at - b.at);
for (let n = 0; n < total; n++) {
  const t = n * step;
  while (pending.length && pending[0].at <= t + 1e-6) {
    const ev = pending.shift();
    if (ev.midi) {
      await page.setInputFiles("#song-file", ev.midi);
      await page.waitForTimeout(300);
    } else
      await page.evaluate(
        async ({ ev, toy }) => {
          const { player } = window.__splashery;
          const tf = player.motion.ctx?.transform;
          const toWorld = (p) => (tf ? p.map((v, i) => (v - tf.center[i]) * tf.scale) : p);
          const pianos = await import("/src/packs/pianos.js");
          const recipe = player.toyInfo.recipe;
          if (ev.key !== undefined) {
            player.act(toWorld(pianos.keyPoint(toy, ev.key)));
          } else if (ev.voice !== undefined) {
            player.act(toWorld(pianos.panelPoint(toy, ev.voice)));
          } else if (ev.tap) {
            player.act(null);
          } else if (ev.play) recipe.song.play();
          else if (ev.pause) recipe.song.pause();
        },
        { ev, toy },
      );
  }
  await page.evaluate(async (step) => {
    const { player } = window.__splashery;
    window.__clip.pending = step;
    player.camera.cur = { ...window.__clip.hold };
    player.camera.tgt = { ...window.__clip.hold };
    await player.stage.captureFrame();
  }, step);
  const png = await page.screenshot({ timeout: 240_000 });
  if (pick.has(n)) shots.push(png);
  await page.evaluate(
    async ({ b64, delay }) => {
      const { quantize, applyPalette } = await import("gifenc");
      const blob = await (await fetch(`data:image/png;base64,${b64}`)).blob();
      const bmp = await createImageBitmap(blob);
      const cv = new OffscreenCanvas(bmp.width, bmp.height);
      const g = cv.getContext("2d");
      g.drawImage(bmp, 0, 0);
      const rgba = g.getImageData(0, 0, bmp.width, bmp.height).data;
      const palette = quantize(rgba, 256, { format: "rgb565" });
      window.__clip.gif.writeFrame(applyPalette(rgba, palette, "rgb565"), bmp.width, bmp.height, { palette, delay, repeat: 0 }); // prettier-ignore
    },
    { b64: png.toString("base64"), delay: Math.round(1000 / fps) },
  );
}
const bytes = await page.evaluate(() => {
  window.__clip.gif.finish();
  return Array.from(window.__clip.gif.bytes());
});
fs.writeFileSync(out, Buffer.from(bytes));
if (shots.length) {
  const strip = await page.evaluate(
    async ({ list, W, H }) => {
      const scale = 0.5;
      const cv = new OffscreenCanvas(Math.round(W * scale) * list.length, Math.round(H * scale));
      const g = cv.getContext("2d");
      for (let i = 0; i < list.length; i++) {
        const blob = await (await fetch(`data:image/png;base64,${list[i]}`)).blob();
        g.drawImage(await createImageBitmap(blob), i * W * scale, 0, W * scale, H * scale);
      }
      const b = await cv.convertToBlob({ type: "image/png" });
      return Array.from(new Uint8Array(await b.arrayBuffer()));
    },
    { list: shots.map((s) => s.toString("base64")), W, H },
  );
  fs.writeFileSync(out.replace(/\.gif$/, "-strip.png"), Buffer.from(strip));
}
console.log(`${out}: ${(bytes.length / 1024).toFixed(0)} KB, ${total} frames`);
await browser.close();
