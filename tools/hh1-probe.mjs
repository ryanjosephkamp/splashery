#!/usr/bin/env node
// Lane Hands-on H1: runs a snippet in the page with a toy open in Hands-on
// and prints what it returns (for measuring a piece by hand).
//   node tools/hh1-probe.mjs <toy id> <snippet.js>
import { chromium } from "@playwright/test";
import fs from "node:fs";
const [id, file] = process.argv.slice(2);
const code = fs.readFileSync(file, "utf8");
const browser = await chromium.launch({
  executablePath: process.env.SPLASHERY_CHROMIUM || undefined,
  args: ["--use-angle=swiftshader", "--enable-unsafe-swiftshader", "--ignore-gpu-blocklist"],
});
const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
page.on("pageerror", (e) => console.error("page error:", e.message));
page.on("console", (m) => console.log(m.text()));
await page.goto(`http://127.0.0.1:4173/?renderer=webgl2&profile=mid&adapt=off`);
await page.waitForSelector("body[data-ready='true']", { timeout: 180000 });
await page.evaluate(async (id) => {
  const { app, player } = window.__splashery;
  await app.chooseToy(id);
  player.opts.idleDelay = 1e9;
  document.querySelector("#hands-toggle").click();
}, id);
const out = await page.evaluate(new Function("return (async () => {" + code + "})()"));
console.log(JSON.stringify(out, null, 0));
await browser.close();
