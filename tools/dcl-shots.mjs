#!/usr/bin/env node
// Lane Data and climate: screenshots of the two toys at phone and desktop
// size, for checking the charts' labels and for tests/screenshots/.
//
//   python3 -m http.server 4173 --bind 127.0.0.1 &
//   SPLASHERY_CHROMIUM=/opt/pw-browsers/chromium node tools/dcl-shots.mjs <out-dir> \
//     [--sizes=390x844,1440x900] [--yaw=0.6] name=toy[?key=value&key=value] ...
//
// Writes <out-dir>/dcl-<name>-<size>.png for each. Options go through the
// toy's own options (setToyOptions); --yaw turns the camera that far (radians)
// from the toy's home view first.

import { chromium } from "@playwright/test";
import fs from "node:fs";
import path from "node:path";

const base = process.env.SPLASHERY_URL || "http://127.0.0.1:4173/";
const args = process.argv.slice(2);
const opt = (name, def) => args.find((x) => x.startsWith(`--${name}=`))?.slice(name.length + 3) ?? def; // prettier-ignore
const [outDir, ...specs] = args.filter((a) => !a.startsWith("--"));
if (!outDir || !specs.length)
  throw new Error("Usage: node tools/dcl-shots.mjs <out-dir> name=toy[?k=v] ...");
fs.mkdirSync(outDir, { recursive: true });
const sizes = opt("sizes", "390x844,1440x900")
  .split(",")
  .map((s) => s.split("x").map(Number));
const yaw = Number(opt("yaw", 0));
const panel = args.includes("--panel");

const browser = await chromium.launch({
  executablePath: process.env.SPLASHERY_CHROMIUM || undefined,
  args: ["--use-angle=swiftshader", "--enable-unsafe-swiftshader", "--ignore-gpu-blocklist"],
});
for (const [w, h] of sizes) {
  const page = await browser.newPage({ viewport: { width: w, height: h }, deviceScaleFactor: 1 });
  page.on("pageerror", (e) => console.error("page error:", e.message));
  await page.goto(`${base}?renderer=webgl2&profile=${w < 600 ? "low" : "high"}&adapt=off&labs=1`);
  await page.waitForSelector("body[data-ready='true']", { timeout: 180_000 });
  for (const spec of specs) {
    const [name, rest] = spec.split("=", 2).length === 2 ? [spec.slice(0, spec.indexOf("=")), spec.slice(spec.indexOf("=") + 1)] : [spec, spec]; // prettier-ignore
    const [id, query = ""] = rest.split("?");
    const options = Object.fromEntries(new URLSearchParams(query));
    await page.evaluate(
      async ({ id, options, yaw, panel }) => {
        const { app, player } = window.__splashery;
        await app.chooseToy(id);
        if (Object.keys(options).length) await app.setToyOptions(options);
        player.opts.idleDelay = 1e9;
        player.idle.weight = 0;
        player.camera.setTurntable(false);
        const cam = player.camera.getState();
        player.camera.setState({ ...cam, yaw: cam.yaw + yaw }, { snap: true });
        if (panel) document.querySelector('[data-tab="toy"]')?.click();
      },
      { id, options, yaw, panel },
    );
    await page.waitForTimeout(2500);
    const file = path.join(outDir, `dcl-${name}-${w}x${h}.png`);
    await page.screenshot({ path: file });
    console.log(file);
  }
  await page.close();
}
await browser.close();
