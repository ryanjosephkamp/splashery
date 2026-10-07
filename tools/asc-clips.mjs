// Lane AsciiCapture: review clips for the Effect review page. Runs the ASCII
// lab in Chromium, saves each preset's downloaded GIF, and a phone-size
// (390 by 844) sequence of the lab page during a capture as PNG frames.
//
//   node tools/asc-clips.mjs <out dir> [--columns=96] [--color] [--deadline=180]
//
// The server must be running (python3 -m http.server 4173 --bind 127.0.0.1).
// SPLASHERY_CHROMIUM picks the browser. Turn the PNG frames into a clip with
// ffmpeg (OPERATING.md, "Steps for a lane").

import fs from "node:fs/promises";
import path from "node:path";
import { chromium } from "@playwright/test";

const args = process.argv.slice(2);
const out = args.find((a) => !a.startsWith("--"));
if (!out) throw new Error("Usage: node tools/asc-clips.mjs <out dir> [--columns=96] [--color]");
const opt = (name, d) => args.find((a) => a.startsWith(`--${name}=`))?.split("=")[1] ?? d;
const columns = opt("columns", "96");
const color = args.includes("--color");
const deadline = opt("deadline", "180");
const base = process.env.SPLASHERY_URL || "http://127.0.0.1:4173/";

const browser = await chromium.launch({
  executablePath: process.env.SPLASHERY_CHROMIUM || undefined,
  args: ["--use-angle=swiftshader", "--enable-unsafe-swiftshader", "--ignore-gpu-blocklist", "--enable-webgl"], // prettier-ignore
});
try {
  await fs.mkdir(out, { recursive: true });
  const page = await browser.newPage({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2 }); // prettier-ignore
  await page.goto(new URL(`ascii-lab.html?deadline=${deadline}`, base).href);
  await page.waitForSelector("body[data-ready='true']");
  for (const [i, preset] of ["grapes", "orange", "strawberry"].entries()) {
    await page.selectOption("#preset", preset);
    await page.selectOption("#columns", columns);
    await page.locator("#color").setChecked(color);
    await page.click("#capture");
    // The first preset's capture is filmed: one screenshot a second.
    const shots = i === 0 ? path.join(out, "lab-frames") : null;
    if (shots) await fs.mkdir(shots, { recursive: true });
    let n = 0;
    while (!["done", "failed"].includes(await page.getAttribute("body", "data-state"))) {
      if (shots) await page.screenshot({ path: path.join(shots, `${String(n++).padStart(3, "0")}.png`) }); // prettier-ignore
      await page.waitForTimeout(shots ? 1000 : 500);
    }
    if ((await page.getAttribute("body", "data-state")) !== "done")
      throw new Error(`${preset}: ${await page.textContent("#status")}`);
    if (shots) {
      await page.locator("#result").scrollIntoViewIfNeeded();
      for (let k = 0; k < 4; k++)
        await page.screenshot({ path: path.join(shots, `${String(n++).padStart(3, "0")}.png`) });
    }
    const pending = page.waitForEvent("download");
    await page.click("#download");
    const file = await pending;
    await file.saveAs(path.join(out, file.suggestedFilename()));
    console.log(preset, file.suggestedFilename(), await page.textContent("#dev-decode"));
  }
} finally {
  await browser.close();
}
