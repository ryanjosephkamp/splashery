#!/usr/bin/env node
// Lane Shelves: renders a toy through several of its Toy tab choices as one
// phone-sized clip (390×844), each part labeled, for the Effect review page.
// Like tools/effect-clip.mjs, the clock is stepped by hand, so the clip shows
// the real speed however slow the renderer is.
//
//   python3 -m http.server 4173 --bind 127.0.0.1 &
//   SPLASHERY_CHROMIUM=/opt/pw-browsers/chromium node tools/shv-clip.mjs <out.gif> --toy=torus \
//     --key=dress --values=plain:Plain,donut:Donut [--hold=0.8] [--secs=3.8] [--fps=10] \
//     [--title=Torus] [--by="built by Opus 5.5"] [--strip=8]
//
// For each value: the toy is rebuilt with that choice, rests --hold seconds,
// is tapped, and runs --secs seconds. --strip=8 also writes <out>-strip.png.

import { chromium } from "@playwright/test";
import fs from "node:fs";

const base = process.env.SPLASHERY_URL || "http://127.0.0.1:4173/";
const args = process.argv.slice(2);
const opt = (name, def) => {
  const a = args.find((x) => x.startsWith(`--${name}=`));
  return a ? a.slice(name.length + 3) : def;
};
const [out] = args.filter((a) => !a.startsWith("--"));
if (!out)
  throw new Error("Usage: node tools/shv-clip.mjs <out.gif> --toy=torus --key=dress --values=…");
const toy = opt("toy", "torus");
const key = opt("key", "");
const values = opt("values", "")
  .split(",")
  .filter(Boolean)
  .map((v) => v.split(":"));
const [W, H] = opt("size", "390x844").split("x").map(Number);
const fps = Number(opt("fps", 10));
const hold = Number(opt("hold", 0.8));
const secs = Number(opt("secs", 3.8));
const title = opt("title", toy);
const by = opt("by", "built by Opus 5.5");
const stripN = Number(opt("strip", 0));

const browser = await chromium.launch({
  executablePath: process.env.SPLASHERY_CHROMIUM || undefined,
  args: ["--use-angle=swiftshader", "--enable-unsafe-swiftshader", "--ignore-gpu-blocklist", "--enable-webgl"], // prettier-ignore
});
const page = await browser.newPage({ viewport: { width: W, height: H } });
page.on("pageerror", (e) => console.error("page error:", e.message));
await page.goto(`${base}?renderer=webgl2&profile=high&adapt=off`);
await page.waitForSelector("body[data-ready='true']", { timeout: 180_000 });
await page.addStyleTag({
  content: `.dock, #panel, .brand, #toy-status, .view-button, #help-line, #help-toggle, #sound-toggle, #game-bar { visibility: hidden !important; }
  #shv-label { position: fixed; left: 0; right: 0; top: 18px; text-align: center; font: 600 20px system-ui, sans-serif; color: #1c1c1c; z-index: 99; }
  #shv-label small { display: block; font-weight: 400; font-size: 14px; opacity: 0.75; margin-top: 4px; }`,
});
await page.evaluate(() => {
  const d = document.createElement("div");
  d.id = "shv-label";
  document.body.appendChild(d);
});

await page.evaluate(async () => {
  const { GIFEncoder } = await import("gifenc");
  window.__clip = { gif: GIFEncoder(), pending: 0 };
});

const shots = [];
const frames = [];
const segs = values.length ? values : [[null, ""]];
for (const [value, label] of segs) {
  await page.evaluate(
    async ({ toy, key, value, text }) => {
      const { app, player } = window.__splashery;
      if (player.scene.toy.id !== toy) await app.chooseToy(toy);
      if (key && value !== null) await app.setToyOption(key, value);
      document.getElementById("shv-label").innerHTML = text;
      player.opts.idleDelay = 1e9;
      player.idle.weight = 0;
      player.camera.setTurntable(false);
      const stage = player.stage;
      if (!window.__clip.handlers) {
        // The clock: frames move time only by what the clip asks.
        window.__clip.handlers = stage.updateHandlers.slice();
        stage.updateHandlers.length = 0;
        stage.updateHandlers.push(() => {
          const d = window.__clip.pending;
          window.__clip.pending = 0;
          for (const h of window.__clip.handlers) h(d);
        });
      }
      window.__clip.pending = 1.5;
      await stage.captureFrame();
      window.__clip.hold = { ...player.camera.cur };
    },
    { toy, key, value, text: `${title}${label ? `: ${label}` : ""}<small>${by}</small>` },
  );
  const step = 1 / fps;
  const total = Math.round((hold + secs) / step);
  let tapped = false;
  for (let n = 0; n < total; n++) {
    const t = n * step;
    await page.evaluate(
      async ({ step, tap }) => {
        const { player } = window.__splashery;
        if (tap) player.act(null);
        window.__clip.pending = step;
        player.camera.cur = { ...window.__clip.hold };
        player.camera.tgt = { ...window.__clip.hold };
        await player.stage.captureFrame();
      },
      { step, tap: !tapped && t >= hold },
    );
    if (t >= hold) tapped = true;
    const png = await page.screenshot({ timeout: 600_000 });
    frames.push(png);
  }
}
const pick = new Set();
if (stripN > 1)
  for (let i = 0; i < stripN; i++) pick.add(Math.round((i / (stripN - 1)) * (frames.length - 1)));
for (let n = 0; n < frames.length; n++) {
  if (pick.has(n)) shots.push(frames[n]);
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
    { b64: frames[n].toString("base64"), delay: Math.round(1000 / fps) },
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
console.log(`${out}: ${(bytes.length / 1024).toFixed(0)} KB, ${frames.length} frames`);
await browser.close();
