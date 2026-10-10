#!/usr/bin/env node
// Renders a thumbnail for every shelf toy with the app itself and saves it
// as assets/toys/<id>/thumb.webp (256 px, transparent background).
// Lane Fix10: each is drawn at four times the size and scaled down, so thin
// splats that would fall under the renderer's 2-pixel cull at 256 px (a
// 4D shape's edges) still show; and the page opens with labs on, so the
// labs toys have their cards too.
//
//   python3 -m http.server 4173 --bind 127.0.0.1 &
//   SPLASHERY_CHROMIUM=/path/to/chrome node tools/make-thumbs.mjs [id or pack ...]
//
// Uses @playwright/test's Chromium API; SwiftShader flags make it work
// without a GPU.

import { chromium } from "@playwright/test";
import fs from "node:fs";
import path from "node:path";
import { TOYS } from "../src/toys.js";

const root = path.resolve(path.dirname(new URL(import.meta.url).pathname), "..");
const base = process.env.SPLASHERY_URL || "http://127.0.0.1:4173/";
// Arguments are toy ids or pack names.
const args = process.argv.slice(2);
const only = TOYS.filter((t) => args.includes(t.id) || args.includes(t.pack)).map((t) => t.id);
if (args.length && !only.length) throw new Error(`No toys match ${args.join(" ")}`);
const size = 256;
const over = 4; // drawn at size × over, then scaled down

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
});
page.on("pageerror", (e) => console.error("page error:", e.message));
await page.goto(`${base}?renderer=webgl2&profile=strong&labs=1`);
await page.waitForSelector("body[data-ready='true']", { timeout: 180_000 });
const ids = await page.evaluate(() =>
  [...document.querySelectorAll(".toy-card")].map((b) => b.dataset.toy),
);

for (const id of ids) {
  if (only.length && !only.includes(id)) continue;
  const dataUrl = await page.evaluate(
    async ({ id, size, over }) => {
      const { app, player } = window.__splashery;
      await app.chooseToy(id);
      app.setLook({ background: "transparent" });
      player.idle.weight = 0;
      await new Promise((r) => setTimeout(r, 2500));
      player.stage.setFixedSize([size * over, size * over]);
      player.camera.cur = { ...player.camera.home };
      player.camera.tgt = { ...player.camera.home };
      // Let the sort settle at the new size, then take the frame.
      for (let i = 0; i < 6; i++) await player.stage.captureFrame();
      let shot = await player.stage.captureFrame();
      player.stage.setFixedSize(null);
      // Halve it in steps (a smooth scale down, no shimmer).
      for (let s = size * over; s > size; ) {
        s /= 2;
        const c = document.createElement("canvas");
        c.width = c.height = s;
        const g = c.getContext("2d");
        g.imageSmoothingQuality = "high";
        g.drawImage(shot, 0, 0, s, s);
        shot = c;
      }
      return shot.toDataURL("image/webp", 0.86);
    },
    { id, size, over },
  );
  const out = path.join(root, "assets/toys", id, "thumb.webp");
  fs.mkdirSync(path.dirname(out), { recursive: true });
  fs.writeFileSync(out, Buffer.from(dataUrl.split(",")[1], "base64"));
  console.log(`${id}: ${out} (${fs.statSync(out).size} bytes)`);
}
await browser.close();
