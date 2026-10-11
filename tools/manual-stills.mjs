#!/usr/bin/env node
// The still pictures of the Tinkerer's Manual's Chapters 6 to 10 (manual/img/r7b-<toy>.jpg): each is
// a toy at its home camera on the light page color, as the Playground draws it (lane Manual r7b).
// manual/make-stills.mjs is the other set (the live demos' print stills); this one is the toys.
//
//   python3 -m http.server 4173 --bind 127.0.0.1 &
//   SPLASHERY_CHROMIUM=/opt/pw-browsers/chromium node tools/manual-stills.mjs [id ...]
//
// With no ids it takes every picture in STILLS. A picture may set toy options first (`options`,
// which `app.setToyOptions` takes), set controls (`set`, eased snap), or wait for a toy that loads
// something (`wait`, milliseconds). JPEG files come from pngjs and jpeg-js (devDependencies).

import { chromium } from "@playwright/test";
import fs from "node:fs";
import { PNG } from "pngjs";
import jpeg from "jpeg-js";

const base = process.env.SPLASHERY_URL || "http://127.0.0.1:4173/";
const OUT = new URL("../manual/img/", import.meta.url);
const SIZE = 512;
const BG = "#f4f1ea";

// id -> { file (without r7b- and .jpg; defaults to the id), set, options, wait }
export const STILLS = {
  chest: {},
  "sword-in-stone": {},
  "music-box": {},
  orange: {},
  "candy-cane": {},
  "yo-yo": {},
  octopus: {},
  "molecule-viewer": {},
  earthquakes: {},
  "night-sky": {},
  "volume-viewer": {},
  "point-clouds": {},
  hurricane: {},
  "data-in-3d": {},
  "stork-migration": {},
  protein: {},
  // Chapter 8: the Sharp view is the default, so the splat view needs its option.
  "photo-3d": { file: "photo-3d-sharp", wait: 6000 },
  "photo-3d-splats": { id: "photo-3d", options: { view: "splats" }, wait: 6000 },
  "moving-photo-3d": { wait: 8000 },
  "video-3d": { wait: 8000 },
  strawberry: {},
  bee: {},
  grape: {},
  // Chapter 9
  "qr-code": {},
  "qr-anatomy": {},
  "qr-damage": {},
  "qr-picture": { wait: 5000 },
  "qr-build": {},
  barcodes: {},
  "your-book": { wait: 5000 },
  // Chapter 10
  "model-splats": { wait: 5000 },
  "splat-toolkit": { wait: 5000 },
  "splat-equation": {},
};

const want = process.argv.slice(2);
const ids = want.length ? want : Object.keys(STILLS);
// (A picture whose key is not the toy's id names the toy in `id`.)
for (const id of ids) if (!STILLS[id]) throw new Error(`manual-stills: no picture named ${id}`);

const browser = await chromium.launch({
  executablePath: process.env.SPLASHERY_CHROMIUM || undefined,
  args: ["--use-angle=swiftshader", "--enable-unsafe-swiftshader", "--ignore-gpu-blocklist", "--enable-webgl"], // prettier-ignore
});
const page = await browser.newPage({
  viewport: { width: 1000, height: 700 },
  reducedMotion: "reduce",
  colorScheme: "light",
});
page.on("pageerror", (e) => console.error("page error:", e.message));
await page.goto(`${base}?renderer=webgl2&profile=high&adapt=off&geofeed=snapshot`);
await page.waitForSelector("body[data-ready='true']", { timeout: 180_000 });

for (const id of ids) {
  const s = STILLS[id];
  const dataUrl = await page.evaluate(
    async ({ id, s, size, bg }) => {
      const { app, player } = window.__splashery;
      await app.chooseToy(s.id || id);
      if (s.options) await app.setToyOptions(s.options, { quiet: 0 });
      app.setLook({ background: bg });
      for (const [key, value] of Object.entries(s.set || {}))
        player.motion.setControl(key, Number(value), { snap: true });
      player.idle.weight = 0;
      await new Promise((r) => setTimeout(r, s.wait || 2500));
      player.stage.setFixedSize([size, size]);
      player.camera.cur = { ...player.camera.home };
      player.camera.tgt = { ...player.camera.home };
      for (let i = 0; i < 6; i++) await player.stage.captureFrame();
      const shot = await player.stage.captureFrame();
      player.stage.setFixedSize(null);
      return shot.toDataURL("image/png");
    },
    { id, s, size: SIZE, bg: BG },
  );
  const png = PNG.sync.read(Buffer.from(dataUrl.split(",")[1], "base64"));
  const jpg = jpeg.encode({ data: png.data, width: png.width, height: png.height }, 84);
  const file = `r7b-${s.file || id}.jpg`;
  fs.writeFileSync(new URL(file, OUT), jpg.data);
  console.log(file, jpg.data.length);
}
await browser.close();
