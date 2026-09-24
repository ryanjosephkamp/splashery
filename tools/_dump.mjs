import { chromium } from "@playwright/test";
import fs from "node:fs";
const [id, out] = process.argv.slice(2);
const browser = await chromium.launch({
  executablePath: "/opt/pw-browsers/chromium",
  args: ["--use-angle=swiftshader", "--enable-unsafe-swiftshader", "--ignore-gpu-blocklist"],
});
const page = await browser.newPage();
await page.goto("http://127.0.0.1:4173/?renderer=webgl2&profile=high&adapt=off");
await page.waitForSelector("body[data-ready='true']", { timeout: 180000 });
const c = await page.evaluate(async (id) => {
  const { app, player } = window.__splashery;
  await app.chooseToy(id);
  return Array.from(player.stage.toy.resource.centers);
}, id);
fs.writeFileSync(out, JSON.stringify({ c }));
await browser.close();
