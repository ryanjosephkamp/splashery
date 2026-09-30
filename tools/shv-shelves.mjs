#!/usr/bin/env node
// Lane Shelves: stills of the gallery's shelves before and after the move,
// on a phone (390×844), side by side, for the Effect review page.
//
//   python3 -m http.server 4173 --bind 127.0.0.1 &   # this branch
//   python3 -m http.server 4174 --bind 127.0.0.1 &   # main, from another checkout
//   SPLASHERY_CHROMIUM=/opt/pw-browsers/chromium node tools/shv-shelves.mjs <out.png> \
//     [--before=http://127.0.0.1:4174/] [--after=http://127.0.0.1:4173/] [--shelves=shapes,food,space,gems,medieval]
//
// Each row is one shelf: the page with that shelf's chip picked, before on the
// left and after on the right, each labeled.

import { chromium } from "@playwright/test";
import fs from "node:fs";

const args = process.argv.slice(2);
const opt = (name, def) => {
  const a = args.find((x) => x.startsWith(`--${name}=`));
  return a ? a.slice(name.length + 3) : def;
};
const [out] = args.filter((a) => !a.startsWith("--"));
if (!out) throw new Error("Usage: node tools/shv-shelves.mjs <out.png>");
const sides = [
  ["Before", opt("before", "http://127.0.0.1:4174/")],
  ["After", opt("after", "http://127.0.0.1:4173/")],
];
const shelves = opt("shelves", "shapes,food,space,gems,medieval").split(",");
const W = 390;
const H = 844;

const browser = await chromium.launch({
  executablePath: process.env.SPLASHERY_CHROMIUM || undefined,
  args: ["--use-angle=swiftshader", "--enable-unsafe-swiftshader", "--ignore-gpu-blocklist", "--enable-webgl"], // prettier-ignore
});
const shots = [];
for (const [label, base] of sides) {
  const page = await browser.newPage({ viewport: { width: W, height: H } });
  await page.goto(`${base}?renderer=webgl2&profile=weak&adapt=off`);
  await page.waitForSelector("body[data-ready='true']", { timeout: 180_000 });
  await page.waitForTimeout(3000);
  for (const shelf of shelves) {
    await page.click(`.chip[data-category='${shelf}']`);
    await page.evaluate(async () => {
      const imgs = [...document.querySelectorAll("#shelf .toy-card img")];
      for (const img of imgs) img.loading = "eager";
      await Promise.all(imgs.map((img) => img.decode().catch(() => {})));
    });
    await page.waitForTimeout(500);
    shots.push({ label, shelf, png: (await page.screenshot()).toString("base64") });
  }
  await page.close();
}
const page = await browser.newPage();
const bytes = await page.evaluate(
  async ({ shots, W, H, shelves }) => {
    const pad = 36;
    const cv = new OffscreenCanvas(W * 2 + 30, (H + pad) * shelves.length);
    const g = cv.getContext("2d");
    g.fillStyle = "#ffffff";
    g.fillRect(0, 0, cv.width, cv.height);
    g.fillStyle = "#1c1c1c";
    g.font = "600 20px sans-serif";
    for (const s of shots) {
      const row = shelves.indexOf(s.shelf);
      const col = s.label === "Before" ? 0 : 1;
      const x = col * (W + 30);
      const y = row * (H + pad);
      g.fillText(`${s.shelf}: ${s.label.toLowerCase()}`, x + 8, y + 25);
      const blob = await (await fetch(`data:image/png;base64,${s.png}`)).blob();
      g.drawImage(await createImageBitmap(blob), x, y + pad, W, H);
    }
    const b = await cv.convertToBlob({ type: "image/png" });
    return Array.from(new Uint8Array(await b.arrayBuffer()));
  },
  { shots, W, H, shelves },
);
fs.writeFileSync(out, Buffer.from(bytes));
console.log(`${out}: ${shots.length} stills`);
await browser.close();
