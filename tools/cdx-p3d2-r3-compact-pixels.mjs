// Compare the compact and independent topology in real, identically configured browsers.
import fs from "node:fs";
import { chromium } from "@playwright/test";
import { PNG } from "pngjs";
import config from "../playwright.config.mjs";
import { inputs, screens, openR3, selectR3, poseR3 } from "./cdx-p3d2-r3-common.mjs";
const browser = await chromium.launch(config.use.launchOptions);
const rows = [];
try {
  for (const [name, screen] of Object.entries(screens)) {
    const pages = [];
    for (const url of ["http://127.0.0.1:4175/", "http://127.0.0.1:4177/"]) {
      const page = await browser.newPage({
        viewport: { width: screen.width, height: screen.height },
        deviceScaleFactor: screen.deviceScaleFactor,
      });
      await openR3(page, url, screen);
      pages.push(page);
    }
    for (const entry of inputs().filter((s) =>
      ["forest", "street", "dot-dragonfly"].includes(s.id),
    ))
      for (const view of ["sharp", "splats"]) {
        for (const page of pages) await selectR3(page, entry, 1, view);
        for (const [yaw, pitch] of [
          [0, 0],
          [-30, 0],
          [30, 0],
          [0, -30],
          [0, 30],
        ]) {
          const captures = [];
          for (const page of pages)
            captures.push(
              PNG.sync.read(
                Buffer.from((await poseR3(page, yaw, pitch)).image.split(",")[1], "base64"),
              ),
            );
          let sum = 0,
            maximum = 0,
            changed = 0;
          for (let i = 0; i < captures[0].data.length; i += 4) {
            let different = false;
            for (let c = 0; c < 3; c++) {
              const delta = Math.abs(captures[0].data[i + c] - captures[1].data[i + c]);
              sum += delta;
              maximum = Math.max(maximum, delta);
              different ||= delta > 0;
            }
            if (different) changed++;
          }
          const row = {
            name,
            id: entry.id,
            view,
            yaw,
            pitch,
            meanByteError: sum / (captures[0].width * captures[0].height * 3),
            maximumByteError: maximum,
            changedPixels: changed,
          };
          rows.push(row);
          console.log(JSON.stringify(row));
          fs.writeFileSync(
            ".cache/cdx-p3d2/r3/compact-pixels.json",
            JSON.stringify({ browser: browser.version(), rows }, null, 2),
          );
        }
      }
    for (const page of pages) await page.close();
  }
} finally {
  await browser.close();
}
