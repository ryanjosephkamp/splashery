#!/usr/bin/env node
// Render one 256 px WebP per equation gallery entry through the real toy.
// Render the stage at 1,024 px first so small splats survive the downscale.
//
//   npm run serve
//   SPLASHERY_CHROMIUM=/path/to/chrome node tools/cdx-gallery-thumbs.mjs [id ...]

import { chromium } from "@playwright/test";
import fs from "node:fs";
import path from "node:path";

const root = path.resolve(path.dirname(new URL(import.meta.url).pathname), "..");
const base = process.env.SPLASHERY_URL || "http://127.0.0.1:4173/";
const gallery = JSON.parse(fs.readFileSync(path.join(root, "src/equation-gallery.json"), "utf8"));
const requested = process.argv.slice(2);
const selected = requested.length
  ? gallery.filter((entry) => requested.includes(entry.id))
  : gallery;
if (requested.length && selected.length !== new Set(requested).size) {
  const found = new Set(selected.map((entry) => entry.id));
  throw new Error(`Unknown gallery ids: ${requested.filter((id) => !found.has(id)).join(", ")}`);
}

const browser = await chromium.launch({
  executablePath: process.env.SPLASHERY_CHROMIUM || undefined,
  args: [
    "--use-angle=swiftshader",
    "--enable-unsafe-swiftshader",
    "--ignore-gpu-blocklist",
    "--enable-webgl",
  ],
});
try {
  const page = await browser.newPage({
    viewport: { width: 1100, height: 800 },
    reducedMotion: "reduce",
  });
  page.on("pageerror", (error) => console.error("page error:", error.message));
  await page.goto(`${base}?renderer=webgl2&profile=strong`);
  await page.waitForSelector("body[data-ready='true']", { timeout: 180_000 });
  await page.evaluate(async () => {
    const { app, player } = window.__splashery;
    await app.chooseToy("splat-equation");
    app.setLook({ background: "transparent" });
    player.idle.weight = 0;
  });

  for (const entry of selected) {
    const fields = Object.fromEntries(
      entry.program.split("\n").map((line) => {
        const equals = line.indexOf(" = ");
        return [line.slice(0, equals), line.slice(equals + 3)];
      }),
    );
    const data = await page.evaluate(
      async ({ fields }) => {
        const { app, player } = window.__splashery;
        // Fields left out keep what was showing (the toy's own rule), so give every
        // field a value: a blank one falls back to the default (grid spread, no r, g, b).
        const all = {};
        for (const name of [
          "x",
          "y",
          "z",
          "u",
          "v",
          "hue",
          "r",
          "g",
          "b",
          "size",
          "count",
          "spread",
        ])
          all[name] = fields[name] || "";
        await app.setToyOptions({ preset: "custom", ...all }, { quiet: Infinity });
        player.stage.setFixedSize([1024, 1024]);
        // The home view fills the frame edge to edge; step back a little so a shape that
        // reaches past the toy's fitted radius (a box's corners, a tall saddle) is not cut off.
        const view = { ...player.camera.home };
        view.distance *= 1.18;
        player.camera.cur = { ...view };
        player.camera.tgt = { ...view };
        for (let i = 0; i < 6; i++) await player.stage.captureFrame();
        const frame = await player.stage.captureFrame();
        const small = document.createElement("canvas");
        small.width = 256;
        small.height = 256;
        small.getContext("2d").drawImage(frame, 0, 0, 256, 256);
        player.stage.setFixedSize(null);
        return small.toDataURL("image/webp", 0.88);
      },
      { fields },
    );
    const out = path.join(root, "assets/gallery", `${entry.id}.webp`);
    fs.mkdirSync(path.dirname(out), { recursive: true });
    fs.writeFileSync(out, Buffer.from(data.split(",")[1], "base64"));
    console.log(`${entry.id}: ${fs.statSync(out).size} bytes`);
  }
} finally {
  await browser.close();
}
