// Prepare review-only photo/GIF inputs with the application's real depth worker.
import fs from "node:fs";
import path from "node:path";
import { chromium } from "@playwright/test";
import config from "../playwright.config.mjs";
const opt = (n, d) => process.argv.find((a) => a.startsWith(`--${n}=`))?.slice(n.length + 3) ?? d;
const root = opt("dir", ".cache/cdx-p3d2/r3/sources");
const manifest = JSON.parse(fs.readFileSync(path.join(root, "manifest.json")));
const browser = await chromium.launch(config.use.launchOptions);
try {
  const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
  let current;
  await page.route("**/__r3-input", (route) =>
    route.fulfill({
      body: fs.readFileSync(current.file),
      contentType: current.file.endsWith(".gif") ? "image/gif" : "image/jpeg",
    }),
  );
  await page.goto(opt("url", "http://127.0.0.1:4175/"));
  await page.waitForSelector("body[data-ready='true']", { timeout: 180000 });
  await page.evaluate(() => window.__splashery.player.setPaused(true));
  for (const entry of manifest) {
    current = entry;
    const file = path.join(root, `${entry.id}.depth`);
    if (fs.existsSync(file)) continue;
    const result = await page.evaluate(async () => {
      const pack = await import("/src/packs/photo-3d.js");
      const depth = await import("/src/packs/photo-3d-depth.js");
      const photo = await pack.decodePhoto(await (await fetch("/__r3-input")).blob());
      const d = await depth.estimateDepth(photo);
      return {
        w: photo.w,
        h: photo.h,
        depthW: d.w,
        depthH: d.h,
        ms: d.ms,
        bytes: Array.from(pack.packDepth(d)),
      };
    });
    fs.writeFileSync(file, Buffer.from(result.bytes));
    delete result.bytes;
    entry.depthFile = file;
    entry.depthInfo = result;
    fs.writeFileSync(path.join(root, "manifest.json"), JSON.stringify(manifest, null, 2));
    console.log(entry.id, JSON.stringify(result));
  }
} finally {
  await browser.close();
}
