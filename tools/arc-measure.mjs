#!/usr/bin/env node
// Lane Arcade: measures each game in both views, as its autopilot plays:
// the splats on its layer, and the game's own work per frame on the CPU
// (its steps, placing its splats, the uploads), at phone size (390x844,
// the mid tier) and desktop size (1440x900, the high tier). The software
// renderer's frame times are printed too, but they only compare games
// with each other: a real GPU draws these splats many times faster.
//
//   python3 -m http.server 4173 --bind 127.0.0.1 &
//   SPLASHERY_CHROMIUM=/opt/pw-browsers/chromium node tools/arc-measure.mjs [toy ...]

import { chromium } from "@playwright/test";
import { TOYS } from "../src/toys.js";

const base = process.env.SPLASHERY_URL || "http://127.0.0.1:4173/";
const want = process.argv.slice(2);
const games = TOYS.filter((t) => t.pack === "arcade" && (!want.length || want.includes(t.id)));
const SIZES = [
  { name: "phone 390x844, mid", w: 390, h: 844, profile: "mid" },
  { name: "desktop 1440x900, high", w: 1440, h: 900, profile: "high" },
];

const browser = await chromium.launch({
  executablePath: process.env.SPLASHERY_CHROMIUM || undefined,
  args: ["--use-angle=swiftshader", "--enable-unsafe-swiftshader", "--ignore-gpu-blocklist"],
});
const rows = [];
for (const size of SIZES) {
  const page = await browser.newPage({ viewport: { width: size.w, height: size.h } });
  await page.goto(`${base}?renderer=webgl2&adapt=off&labs=1&watch=off&profile=${size.profile}`);
  await page.waitForSelector("body[data-ready='true']", { timeout: 180_000 });
  for (const g of games) {
    for (const view of ["2d", "3d"]) {
      const r = await page.evaluate(
        async ([id, view]) => {
          const { app, player } = window.__splashery;
          await app.chooseToy(id);
          await app.setToyOption("view", view);
          for (let i = 0; i < 300 && !player.arcade?.game; i++) await new Promise((r) => setTimeout(r, 100));
          const a = player.arcade;
          a.wake();
          a.autopilot = true;
          // The game's work a frame, timed directly over 120 frames of 1/60 s.
          const t0 = performance.now();
          for (let i = 0; i < 120; i++) a.frame(1 / 60);
          const game = (performance.now() - t0) / 120;
          // A few drawn frames for the software renderer's time.
          const f0 = performance.now();
          for (let i = 0; i < 4; i++) await player.stage.captureFrame();
          const frame = (performance.now() - f0) / 4;
          return { splats: a.sprites.used, slots: a.layer.slots, game, frame };
        },
        [g.id, view],
      );
      rows.push({ size: size.name, game: g.label, view, ...r });
      console.log(`${size.name.padEnd(24)} ${g.label.padEnd(20)} ${view}  ${String(r.splats).padStart(6)} splats  game ${r.game.toFixed(2)} ms a frame  (software frame ${r.frame.toFixed(0)} ms)`); // prettier-ignore
    }
  }
  await page.close();
}
await browser.close();
