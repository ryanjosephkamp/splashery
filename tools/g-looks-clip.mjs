#!/usr/bin/env node
// Lane G: one clip that runs through a scan toy's looks (src/toys.js,
// `looks`): each look is picked in the app, tapped once and filmed for a
// moment, with its name in the corner. Frames are stepped by hand as in
// tools/effect-clip.mjs, so the motion plays at its real speed.
//
//   python3 -m http.server 4173 --bind 127.0.0.1 &
//   SPLASHERY_CHROMIUM=/opt/pw-browsers/chromium node tools/g-looks-clip.mjs <out-dir>
//     [--size=320] [--fps=12] [--secs=1.6] [--bg=#111111] id[:secs] ...
//
// Writes <out-dir>/<id>-looks.gif.

import { chromium } from "@playwright/test";
import fs from "node:fs";
import path from "node:path";
import { TOYS } from "../src/toys.js";

const base = process.env.SPLASHERY_URL || "http://127.0.0.1:4173/";
const args = process.argv.slice(2);
const opt = (name, def) => {
  const a = args.find((x) => x.startsWith(`--${name}=`));
  return a ? a.slice(name.length + 3) : def;
};
const [outDir, ...ids] = args.filter((a) => !a.startsWith("--"));
if (!outDir || !ids.length) throw new Error("Usage: node tools/g-looks-clip.mjs <out-dir> id ...");
const size = Number(opt("size", 320));
const fps = Number(opt("fps", 12));
const secsAll = Number(opt("secs", 1.6));
const bg = opt("bg", "#111111");
fs.mkdirSync(outDir, { recursive: true });

const browser = await chromium.launch({
  executablePath: process.env.SPLASHERY_CHROMIUM || undefined,
  args: ["--use-angle=swiftshader", "--enable-unsafe-swiftshader", "--ignore-gpu-blocklist", "--enable-webgl"], // prettier-ignore
});
const page = await browser.newPage({ viewport: { width: 1000, height: 700 } });
page.on("pageerror", (e) => console.error("page error:", e.message));
await page.goto(`${base}?renderer=webgl2&profile=high&adapt=off`);
await page.waitForSelector("body[data-ready='true']", { timeout: 180_000 });
for (const spec of ids) {
  const [id, own] = spec.split(":");
  const secs = own ? Number(own) : secsAll;
  const looks = TOYS.find((t) => t.id === id)?.looks;
  if (!looks) throw new Error(`${id} has no looks`);
  const bytes = await page.evaluate(
    async ({ id, looks, size, fps, secs, bg }) => {
      const { app, player } = window.__splashery;
      const { GIFEncoder, quantize, applyPalette } = await import("gifenc");
      await app.chooseToy(id);
      app.setLook({ background: bg });
      player.opts.idleDelay = 1e9;
      player.idle.weight = 0;
      const gif = GIFEncoder();
      const step = 1 / fps;
      const delay = Math.round(1000 / fps);
      const label = document.createElement("canvas");
      label.width = size;
      label.height = size;
      const g = label.getContext("2d");
      for (const look of looks) {
        await app.setToyOption("look", look.id);
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
        stage.setFixedSize([size, size]);
        const frame = async () => {
          pending = step;
          player.camera.cur = { ...player.camera.home };
          player.camera.tgt = { ...player.camera.home };
          await stage.captureFrame();
          pending = 0;
          const c = await stage.captureFrame();
          g.drawImage(c, 0, 0, size, size);
          g.font = "600 15px sans-serif";
          g.fillStyle = "rgba(0,0,0,0.55)";
          g.fillRect(8, 8, g.measureText(look.label).width + 16, 26);
          g.fillStyle = "#f2f2f2";
          g.fillText(look.label, 16, 26);
          const rgba = g.getImageData(0, 0, size, size).data;
          const palette = quantize(rgba, 256, { format: "rgb565" });
          gif.writeFrame(applyPalette(rgba, palette, "rgb565"), size, size, { palette, delay, repeat: 0 }); // prettier-ignore
        };
        pending = 0.5;
        await stage.captureFrame();
        for (let t = 0; t < 0.4; t += step) await frame();
        player.act(null);
        for (let t = 0; t < secs - 1e-6; t += step) await frame();
        stage.setFixedSize(null);
        stage.updateHandlers.length = 0;
        stage.updateHandlers.push(...handlers);
      }
      gif.finish();
      return Array.from(gif.bytes());
    },
    { id, looks: looks.map((l) => ({ id: l.id, label: l.label })), size, fps, secs, bg },
  );
  const out = path.join(outDir, `${id}-looks.gif`);
  fs.writeFileSync(out, Buffer.from(bytes));
  console.log(`${id}: ${out} (${(bytes.length / 1024).toFixed(0)} KB)`);
}
await browser.close();
