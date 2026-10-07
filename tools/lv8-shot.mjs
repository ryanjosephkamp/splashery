#!/usr/bin/env node
// Lane Live r8: still shots of a toy at phone size (390 by 844 at 2x), whole
// and as a 3x crop of the middle, for judging grain.
//
//   python3 -m http.server 4173 --bind 127.0.0.1 &
//   SPLASHERY_CHROMIUM=/opt/pw-browsers/chromium node tools/lv8-shot.mjs <out-dir> [--profile=mid] [--query=a=1&b=2] [--settle=4] [--taps=0] [--tag=name] id ...

import { chromium } from "@playwright/test";
import fs from "node:fs";
import path from "node:path";

const args = process.argv.slice(2);
const opt = (name, def) => {
  const a = args.find((x) => x.startsWith(`--${name}=`));
  return a ? a.slice(name.length + 3) : def;
};
const [outDir, ...ids] = args.filter((a) => !a.startsWith("--"));
const base = process.env.SPLASHERY_URL || "http://127.0.0.1:4173/";
const profile = opt("profile", "mid");
const query = opt("query", "");
const settle = Number(opt("settle", 4));
const taps = Number(opt("taps", 0));
const tag = opt("tag", "");
const [VW, VH] = opt("size", "390x844").split("x").map(Number);
const cam = opt("cam", ""); // yaw,pitch,distance
fs.mkdirSync(outDir, { recursive: true });
const browser = await chromium.launch({
  executablePath: process.env.SPLASHERY_CHROMIUM || undefined,
  args: ["--use-angle=swiftshader", "--enable-unsafe-swiftshader", "--ignore-gpu-blocklist"],
});
const page = await browser.newPage({
  viewport: { width: VW, height: VH },
  deviceScaleFactor: Number(opt("dpr", 2)),
});
page.on("pageerror", (e) => console.error("page error:", e.message));
await page.goto(
  `${base}?labs=1&renderer=webgl2&profile=${profile}&adapt=off${query ? "&" + query : ""}`,
);
await page.waitForSelector("body[data-ready='true']", { timeout: 180_000 });
for (const id of ids) {
  await page.evaluate(async (id) => {
    const { app, player } = window.__splashery;
    await app.chooseToy(id);
    player.opts.idleDelay = 1e9;
    player.idle.weight = 0;
  }, id);
  if (cam)
    await page.evaluate((cam) => {
      const [yaw, pitch, distance] = cam.split(",").map(Number);
      const c = window.__splashery.player.camera;
      c.tgt = { ...c.tgt, yaw, pitch, distance };
      c.cur = { ...c.cur, yaw, pitch, distance };
    }, cam);
  for (let i = 0; i < taps; i++) {
    await page.evaluate(() => window.__splashery.player.act(null));
    await page.waitForTimeout(400);
  }
  await page.waitForTimeout(settle * 1000);
  const name = `${id}${tag ? "-" + tag : ""}`;
  const file = path.join(outDir, `${name}-${VW}x${VH}.png`);
  await page.screenshot({ path: file });
  const box = await page.locator("#stage").boundingBox();
  const cw = box.width / 3;
  const ch = box.height / 3;
  await page.screenshot({
    path: path.join(outDir, `${name}-crop.png`),
    clip: {
      x: box.x + box.width / 2 - cw / 2,
      y: box.y + box.height / 2 - ch / 2,
      width: cw,
      height: ch,
    },
  });
  console.log(file);
}
await browser.close();
