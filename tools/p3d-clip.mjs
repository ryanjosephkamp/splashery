#!/usr/bin/env node
// Photo to 3D (lane Photo to 3D): looping GIF clips of the toy for the Effect review page. The clock is
// stepped by hand, so a clip shows the motion at its real speed however slow the renderer is.
//
//   python3 -m http.server 4173 --bind 127.0.0.1 &
//   SPLASHERY_CHROMIUM=/opt/pw-browsers/chromium node tools/p3d-clip.mjs <out-dir> sample|layers [--source=forest] [--size=390x520] [--fps=12]
//
// sample: flat picture, the tap (the depth rises layer by layer while the toy sways), then a slow turn.
// layers: the depth risen, then the Layers switch pulls the depth bands apart while the toy turns.
// Writes <out-dir>/p3d-<kind>-<source>.gif. (Opening a photo of your own is p3d-open-clip.mjs.)
import { chromium } from "@playwright/test";
import fs from "node:fs";
import path from "node:path";

const args = process.argv.slice(2);
const opt = (name, def) => {
  const a = args.find((x) => x.startsWith(`--${name}=`));
  return a ? a.slice(name.length + 3) : def;
};
const [outDir, kind = "sample"] = args.filter((a) => !a.startsWith("--"));
if (!outDir) throw new Error("Usage: node tools/p3d-clip.mjs <out-dir> sample|layers");
const source = opt("source", kind === "layers" ? "street" : "forest");
const [W, H] = opt("size", "390x520").split("x").map(Number);
const fps = Number(opt("fps", 12));
fs.mkdirSync(outDir, { recursive: true });
const base = process.env.SPLASHERY_URL || "http://127.0.0.1:4173/";
const browser = await chromium.launch({
  executablePath: process.env.SPLASHERY_CHROMIUM || undefined,
  args: [
    "--use-angle=swiftshader",
    "--enable-unsafe-swiftshader",
    "--ignore-gpu-blocklist",
    "--enable-webgl",
  ],
});
const page = await browser.newPage({
  viewport: { width: 1000, height: 800 },
  reducedMotion: "reduce",
});
page.on("pageerror", (e) => console.error("page error:", e.message));
await page.goto(`${base}?renderer=webgl2&profile=mid&adapt=off&labs=1`);
await page.waitForSelector("body[data-ready='true']", { timeout: 180_000 });
const bytes = await page.evaluate(
  async ({ kind, source, W, H, fps }) => {
    const { app, player } = window.__splashery;
    const { GIFEncoder, quantize, applyPalette } = await import("gifenc");
    await app.chooseToy("photo-3d");
    await app.setToyOptions({ source });
    app.setLook({ background: "#111111" });
    player.opts.idleDelay = 1e9;
    player.idle.weight = 0;
    await new Promise((r) => setTimeout(r, 2500));
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
    const step = 1 / fps;
    const gif = GIFEncoder();
    const delay = Math.round(1000 / fps);
    let yaw = 0;
    const frame = async () => {
      pending = step;
      player.camera.cur = { ...player.camera.home, yaw };
      player.camera.tgt = { ...player.camera.cur };
      await stage.captureFrame();
      pending = 0;
      const c = await stage.captureFrame();
      const rgba = c.getContext("2d").getImageData(0, 0, W, H).data;
      const palette = quantize(rgba, 256, { format: "rgb565" });
      gif.writeFrame(applyPalette(rgba, palette, "rgb565"), W, H, { palette, delay, repeat: 0 });
    };
    const hold = async (s) => {
      for (let t = 0; t < s - 1e-6; t += step) await frame();
    };
    const sweep = async (from, to, s) => {
      const n = Math.round(s / step);
      for (let i = 1; i <= n; i++) {
        const u = i / n;
        yaw = from + (to - from) * (0.5 - 0.5 * Math.cos(Math.PI * u));
        await frame();
      }
    };
    pending = 0.5;
    await stage.captureFrame();
    if (kind === "sample") {
      await hold(0.6); // flat
      player.act();
      await hold(4); // the depth rises, the toy sways
      await sweep(0, -0.5, 1.2);
      await sweep(-0.5, 0.5, 2.4);
      await sweep(0.5, 0, 1.2);
      await hold(0.4);
    } else {
      player.motion.setControl("flat", 0, { snap: true });
      await hold(0.5);
      await sweep(0, -0.45, 1);
      player.motion.setControl("layers", 1); // the depth bands pull apart
      await sweep(-0.45, 0.45, 3.4);
      player.motion.setControl("layers", 0); // and come back
      await sweep(0.45, 0, 2);
      await hold(0.4);
    }
    gif.finish();
    stage.setFixedSize(null);
    stage.updateHandlers.length = 0;
    stage.updateHandlers.push(...handlers);
    return Array.from(gif.bytes());
  },
  { kind, source, W, H, fps },
);
const out = path.join(outDir, `p3d-${kind}-${source}.gif`);
fs.writeFileSync(out, Buffer.from(bytes));
console.log(`${out} (${(bytes.length / 1024).toFixed(0)} KB)`);
await browser.close();
