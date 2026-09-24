#!/usr/bin/env node
// Renders a toy's tap effect as a filmstrip: one frame before the tap, then
// frames at fixed times after it, tiled left to right into one PNG.
//
//   python3 -m http.server 4173 --bind 127.0.0.1 &
//   SPLASHERY_CHROMIUM=/opt/pw-browsers/chromium node tools/effect-strip.mjs <out-dir> [--size=240] [--times=0.1,0.3,0.6,1,1.5,2.2,3] [--taps=1] [--gap=0.25] [--suffix=-after] id ...
//
// Writes <out-dir>/<id><suffix>.png. The clock is stepped by hand (1/30 s
// steps), so frames land at the same toy time on any machine. --taps=3 taps
// three times, --gap seconds apart (times count from the last tap).
// --bg sets the page colour (dark theme by default). --opt=style=double sets a
// toy option first. --at=x,y,z taps that point (in the recipe's coordinates)
// instead of pressing the action, for toys whose tap depends on where it lands.

import { chromium } from "@playwright/test";
import fs from "node:fs";
import path from "node:path";

const base = process.env.SPLASHERY_URL || "http://127.0.0.1:4173/";
const args = process.argv.slice(2);
const opt = (name, def) => {
  const a = args.find((x) => x.startsWith(`--${name}=`));
  return a ? a.slice(name.length + 3) : def;
};
const [outDir, ...ids] = args.filter((a) => !a.startsWith("--"));
if (!outDir || !ids.length) throw new Error("Usage: node tools/effect-strip.mjs <out-dir> id ...");
const size = Number(opt("size", 240));
const bg = opt("bg", "#111111");
const suffix = opt("suffix", "");
const times = opt("times", "0.1,0.3,0.6,1,1.5,2.2,3").split(",").map(Number);
const taps = Number(opt("taps", 1));
const gap = Number(opt("gap", 0.25));
const toyOpt = opt("opt", "");
const at = opt("at", "") ? opt("at", "").split(",").map(Number) : null;

fs.mkdirSync(outDir, { recursive: true });
const browser = await chromium.launch({
  executablePath: process.env.SPLASHERY_CHROMIUM || undefined,
  args: [
    "--use-angle=swiftshader",
    "--enable-unsafe-swiftshader",
    "--ignore-gpu-blocklist",
    "--enable-webgl",
  ],
});
const page = await browser.newPage({ viewport: { width: 1000, height: 700 } });
page.on("pageerror", (e) => console.error("page error:", e.message));
await page.goto(`${base}?renderer=webgl2&profile=high&adapt=off`);
await page.waitForSelector("body[data-ready='true']", { timeout: 180_000 });
for (const id of ids) {
  const dataUrl = await page.evaluate(
    async ({ id, size, bg, times, taps, gap, toyOpt, at }) => {
      const { app, player } = window.__splashery;
      await app.chooseToy(id);
      if (toyOpt) {
        const [key, value] = toyOpt.split("=");
        await app.setToyOption(key, value);
      }
      app.setLook({ background: bg });
      player.opts.idleDelay = 1e9;
      player.idle.weight = 0;
      await new Promise((r) => setTimeout(r, 1500));
      // From here on the clock only moves when we step it.
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
      const home = () => {
        player.camera.cur = { ...player.camera.home };
        player.camera.tgt = { ...player.camera.home };
      };
      const advance = async (secs) => {
        let left = secs;
        while (left > 1e-6) {
          const d = Math.min(1 / 30, left);
          left -= d;
          pending = d;
          home();
          await stage.captureFrame();
        }
      };
      const shot = async () => {
        home();
        pending = 0;
        await stage.captureFrame();
        return stage.captureFrame();
      };
      await advance(0.5);
      const frames = [await shot()];
      // Recipe coordinates -> world (a kit toy is centred and scaled).
      const tf = player.motion.ctx?.transform;
      const world = at && (tf ? at.map((v, i) => (v - tf.center[i]) * tf.scale) : at);
      for (let i = 0; i < taps; i++) {
        player.act(world || null);
        if (i < taps - 1) await advance(gap);
      }
      let now = 0;
      for (const t of times) {
        await advance(t - now);
        now = t;
        frames.push(await shot());
      }
      stage.setFixedSize(null);
      stage.updateHandlers.length = 0;
      stage.updateHandlers.push(...handlers);
      const labels = ["before", ...times.map((t) => `${t}s`)];
      const out = document.createElement("canvas");
      out.width = size * frames.length;
      out.height = size + 18;
      const ctx = out.getContext("2d");
      ctx.fillStyle = bg;
      ctx.fillRect(0, 0, out.width, out.height);
      ctx.font = "12px sans-serif";
      ctx.fillStyle = "#bbb";
      frames.forEach((f, i) => {
        ctx.drawImage(f, i * size, 0, size, size);
        ctx.fillText(labels[i], i * size + 6, size + 13);
      });
      return out.toDataURL("image/png");
    },
    { id, size, bg, times, taps, gap, toyOpt, at },
  );
  const out = path.join(outDir, `${id}${suffix}.png`);
  fs.writeFileSync(out, Buffer.from(dataUrl.split(",")[1], "base64"));
  console.log(`${id}: ${out}`);
}
await browser.close();
