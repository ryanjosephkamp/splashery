#!/usr/bin/env node
// Renders toys at their home camera to PNG files, for before/after reviews.
//
//   python3 -m http.server 4173 --bind 127.0.0.1 &
//   SPLASHERY_CHROMIUM=/opt/pw-browsers/chromium node tools/toy-shots.mjs <out-dir> [--size=480] [--bg=#111111] [--suffix=-after] id ...
//
// Writes <out-dir>/<id><suffix>.png. The background defaults to the dark
// theme's page colour; pass --bg=#f4f1ea (or any colour) to check light mode.
// --set=open=0 sets a toy control first (for example, a closed book).

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
if (!outDir || !ids.length) throw new Error("Usage: node tools/toy-shots.mjs <out-dir> id ...");
const size = Number(opt("size", 480));
const bg = opt("bg", "#111111");
const suffix = opt("suffix", "");
const theme = opt("theme", "dark");
const set = opt("set", "");

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
const page = await browser.newPage({
  viewport: { width: 1000, height: 700 },
  reducedMotion: "reduce",
  colorScheme: theme,
});
page.on("pageerror", (e) => console.error("page error:", e.message));
await page.goto(`${base}?renderer=webgl2&profile=high&adapt=off`);
await page.waitForSelector("body[data-ready='true']", { timeout: 180_000 });
for (const id of ids) {
  const dataUrl = await page.evaluate(
    async ({ id, size, bg, set }) => {
      const { app, player } = window.__splashery;
      await app.chooseToy(id);
      app.setLook({ background: bg });
      if (set) {
        const [key, value] = set.split("=");
        player.motion.setControl(key, Number(value), { snap: true });
      }
      player.idle.weight = 0;
      await new Promise((r) => setTimeout(r, 2500));
      player.stage.setFixedSize([size, size]);
      player.camera.cur = { ...player.camera.home };
      player.camera.tgt = { ...player.camera.home };
      for (let i = 0; i < 6; i++) await player.stage.captureFrame();
      const shot = await player.stage.captureFrame();
      player.stage.setFixedSize(null);
      return shot.toDataURL("image/png");
    },
    { id, size, bg, set },
  );
  const out = path.join(outDir, `${id}${suffix}.png`);
  fs.writeFileSync(out, Buffer.from(dataUrl.split(",")[1], "base64"));
  console.log(`${id}: ${out}`);
}
await browser.close();
