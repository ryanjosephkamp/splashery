#!/usr/bin/env node
// Lane Optics: screenshots of the optics toys with labs on, after letting
// them run, for checking the look while building.
//
//   python3 -m http.server 4173 --bind 127.0.0.1 &
//   SPLASHERY_CHROMIUM=/opt/pw-browsers/chromium node tools/opt-shot.mjs <out.png> <id> [--size=390x844] [--wait=3] [--opt=key=value,…] [--eval=js]

import { chromium } from "@playwright/test";

const base = process.env.SPLASHERY_URL || "http://127.0.0.1:4173/";
const args = process.argv.slice(2);
const opt = (name, def) => {
  const a = args.find((x) => x.startsWith(`--${name}=`));
  return a ? a.slice(name.length + 3) : def;
};
const [out, id] = args.filter((a) => !a.startsWith("--"));
if (!out || !id) throw new Error("Usage: node tools/opt-shot.mjs <out.png> <id>");
const [w, h] = opt("size", "390x844").split("x").map(Number);
const browser = await chromium.launch({
  executablePath: process.env.SPLASHERY_CHROMIUM || undefined,
  args: ["--use-angle=swiftshader", "--enable-unsafe-swiftshader", "--enable-webgl"],
});
const page = await browser.newPage({ viewport: { width: w, height: h } });
page.on("pageerror", (e) => console.error("page error:", e.message));
page.on("console", (m) => m.type() === "error" && console.error("console:", m.text()));
await page.goto(`${base}?renderer=webgl2&profile=high&adapt=off&labs=1`);
await page.waitForSelector("body[data-ready='true']", { timeout: 180_000 });
await page.evaluate(async (id) => window.__splashery.app.chooseToy(id), id);
for (const kv of opt("opt", "").split(",").filter(Boolean)) {
  const [k, v] = kv.split("=");
  await page.evaluate(
    async ([k, v]) => window.__splashery.app.setToyOption(k, isNaN(+v) ? v : +v),
    [k, v],
  );
}
if (opt("eval", "")) await page.evaluate(opt("eval", ""));
await page.waitForTimeout(Number(opt("wait", 3)) * 1000);
await page.screenshot({ path: out });
await browser.close();
