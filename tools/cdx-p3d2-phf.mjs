#!/usr/bin/env node
// Run the unchanged phf-measure metrics. Suspend the static toy while Node
// analyzes the captured pixels; the next capture resumes its real renderer.
import { chromium } from "@playwright/test";
import path from "node:path";
import { pathToFileURL } from "node:url";
const launch = chromium.launch.bind(chromium);
chromium.launch = async (...args) => {
  const browser = await launch(...args);
  const create = browser.newPage.bind(browser);
  browser.newPage = async (...options) => {
    const page = await create(...options);
    await page.addInitScript(() => {
      let last = performance.now();
      setInterval(() => {
        const pl = window.__splashery?.player;
        if (!pl) return;
        const stage = pl.stage;
        if (!stage.__p3d2Capture) {
          const capture = stage.captureFrame.bind(stage);
          stage.captureFrame = (...a) => {
            last = performance.now();
            pl.setPaused(false);
            // A render can finish before Player's next update after a pause.
            // Keep the original tool's fit iterations tied to this camera,
            // rather than the projection left by the preceding capture.
            stage.setCameraPose(pl.camera.pose());
            return capture(...a).then((f) => {
              last = performance.now();
              pl.setPaused(true);
              return f;
            });
          };
          stage.__p3d2Capture = true;
        }
        if (performance.now() - last > 3000) pl.setPaused(true);
      }, 1000);
    });
    return page;
  };
  return browser;
};
await import(pathToFileURL(path.resolve("tools/phf-measure.mjs")).href);
