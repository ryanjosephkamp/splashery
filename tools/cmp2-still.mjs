#!/usr/bin/env node
// Lane Computing r2: a still of a toy from a set view (a close look at the
// Enigma's rotors), for judging sharpness at phone size.
//
//   SPLASHERY_CHROMIUM=/opt/pw-browsers/chromium node tools/cmp2-still.mjs <out.png> <toy> [--opt="a=b&c=d"] [--cam=yaw,pitch,distance] [--size=390x844] [--profile=high]

import { chromium } from "@playwright/test";

const args = process.argv.slice(2);
const opt = (name, def) => args.find((a) => a.startsWith(`--${name}=`))?.slice(name.length + 3) ?? def; // prettier-ignore
const [out, toy] = args.filter((a) => !a.startsWith("--"));
const [w, h] = opt("size", "390x844").split("x").map(Number);
const base = process.env.SPLASHERY_URL || "http://127.0.0.1:4173/";
const browser = await chromium.launch({
  executablePath: process.env.SPLASHERY_CHROMIUM || undefined,
  args: ["--use-angle=swiftshader", "--enable-unsafe-swiftshader", "--ignore-gpu-blocklist"],
});
const page = await browser.newPage({ viewport: { width: w, height: h } });
await page.goto(`${base}?renderer=webgl2&profile=${opt("profile", "high")}&adapt=off`);
await page.waitForSelector("body[data-ready='true']", { timeout: 180_000 });
await page.evaluate(
  async ({ toy, o, cam }) => {
    const { app, player } = window.__splashery;
    await app.chooseToy(toy);
    if (o) await app.setToyOptions(Object.fromEntries(o.split("&").map((kv) => kv.split("="))));
    if (cam) {
      const [yaw, pitch, distance] = cam.split(",").map(Number);
      player.camera.setState({ yaw, pitch, roll: 0, distance }, { snap: true });
    }
    player.opts.idleDelay = 1e9;
  },
  { toy, o: opt("opt", ""), cam: opt("cam", "") },
);
await page.waitForTimeout(4000);
await page.locator("canvas").first().screenshot({ path: out });
await browser.close();
