#!/usr/bin/env node
// Real elements (lane Elements): looks at lifted samples from exactly side-on, as the app draws
// them, and finds where the background shows through. For each element and turn it renders the
// lifted sample held at that turn, then the same frame without it; the pixels that change are the
// sample's silhouette, and any unchanged pixel the silhouette encloses (after closing a few pixels
// of its outline) is a place the eye sees through it. Writes a still of each view and prints the
// counts; tests/rel.spec.mjs runs the same check.
//
//   python3 -m http.server 4173 --bind 127.0.0.1 &
//   SPLASHERY_CHROMIUM=/opt/pw-browsers/chromium node tools/rel-side.mjs [out-dir] [El ...]
import { chromium } from "@playwright/test";
import fs from "node:fs";
import path from "node:path";
import { PNG } from "pngjs";
import { seeThrough, SIDE_VIEWS } from "../src/elements-real/see-through.js";

const args = process.argv.slice(2);
const outDir = args[0] && !/^[A-Z]/.test(args[0]) ? args.shift() : ".cache/rel/side";
const els = args.length ? args : ["Cu", "Rn"];
fs.mkdirSync(outDir, { recursive: true });
const base = process.env.SPLASHERY_URL || "http://127.0.0.1:4173/";

const b = await chromium.launch({
  executablePath: process.env.SPLASHERY_CHROMIUM || undefined,
  args: ["--use-angle=swiftshader", "--enable-unsafe-swiftshader", "--ignore-gpu-blocklist"],
});
let worst = 0;
for (const [vw, vh, profile] of [
  [390, 844, "low"],
  [1440, 900, "high"],
]) {
  const page = await b.newPage({ viewport: { width: vw, height: vh } });
  await page.goto(`${base}?labs=1&renderer=webgl2&profile=${profile}&adapt=off`);
  await page.waitForSelector("body[data-ready='true']", { timeout: 180_000 });
  await page.evaluate(() => window.__splashery.app.chooseToy("real-elements"));
  await page.waitForFunction(() => window.__splashery.player.motion?.ctx?.kit?.data, null, { timeout: 120_000 }); // prettier-ignore
  for (const el of els) {
    await page.evaluate(async (el) => {
      const { app, player } = window.__splashery;
      await app.setToyOption("element", el);
      player.motion.setControl("up", 1, { snap: true });
    }, el);
    await page.waitForFunction((el) => window.__splashery.player.motion?.ctx?.kit?.data?.element === el, el, { timeout: 120_000 }); // prettier-ignore
    await page.waitForTimeout(1500);
    for (const [name, spin] of SIDE_VIEWS) {
      const shot = async (hide) => {
        await page.evaluate(
          ({ spin, hide }) => {
            globalThis.__relHideLift = hide;
            const { player } = window.__splashery;
            player.motion.setControl("spin", spin, { snap: true });
            player.stage.requestRender();
          },
          { spin, hide },
        );
        await page.waitForTimeout(900);
        return PNG.sync.read(await page.screenshot());
      };
      const withS = await shot(false);
      const without = await shot(true);
      await page.evaluate(() => (globalThis.__relHideLift = false));
      const r = seeThrough(withS, without);
      worst = Math.max(worst, r.ratio);
      const file = path.join(outDir, `rel-${el}-${name}-${vw}x${vh}.png`);
      fs.writeFileSync(file, PNG.sync.write(r.still));
      console.log(`${el} ${name}° ${vw}x${vh}: silhouette ${r.silhouette} px, see-through ${r.holes} px (${(r.ratio * 100).toFixed(2)}%) -> ${file}`); // prettier-ignore
    }
  }
  await page.close();
}
await b.close();
console.log(`worst see-through: ${(worst * 100).toFixed(2)}%`);
