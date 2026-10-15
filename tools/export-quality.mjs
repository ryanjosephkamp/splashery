#!/usr/bin/env node
// Reproducible SwiftShader export evidence. Outputs stay outside the site;
// put >1 MB review files only on codex/export-quality-clips.
// python3 -m http.server 4175 --bind 127.0.0.1
// SPLASHERY_CHROMIUM=/usr/bin/chromium node tools/export-quality.mjs /tmp/export-quality/evidence
import { chromium } from "@playwright/test";
import fs from "node:fs";
import path from "node:path";
import { execFileSync } from "node:child_process";
import { EXPORT_PRESETS } from "../src/export/presets.js";

const out = path.resolve(process.argv[2] || "/tmp/export-quality/evidence");
fs.mkdirSync(out, { recursive: true });
const resultsFile = path.join(out, "measurements.json");
const results = fs.existsSync(resultsFile) ? JSON.parse(fs.readFileSync(resultsFile)) : [];
const saveResults = () => fs.writeFileSync(resultsFile, JSON.stringify(results, null, 2) + "\n");
const browser = await chromium.launch({
  executablePath: process.env.SPLASHERY_CHROMIUM || undefined,
  args: [
    "--use-angle=swiftshader",
    "--enable-unsafe-swiftshader",
    "--ignore-gpu-blocklist",
    "--enable-webgl",
  ],
});
const stillsOnly = process.argv.includes("--stills-only");
const recordsOnly = process.argv.includes("--records-only") || stillsOnly;
const base = process.env.SPLASHERY_URL || "http://127.0.0.1:4175";
try {
  for (const before of [true, false]) {
    if (before && recordsOnly) continue;
    for (const phone of [false, true]) {
      const label = `${before ? "before" : "after"}-${phone ? "phone" : "desktop"}`;
      const context = await browser.newContext({
        viewport: phone ? { width: 390, height: 844 } : { width: 1440, height: 900 },
        deviceScaleFactor: phone ? 3 : 1,
        isMobile: phone,
        hasTouch: phone,
      });
      const page = await context.newPage();
      page.setDefaultTimeout(180_000);
      page.on("pageerror", (e) => console.error(label, e.message));
      if (before)
        for (const file of ["src/app.js", "src/exports.js", "src/ui.js"]) {
          const body = execFileSync("git", ["show", `95da2ddb:${file}`], { encoding: "utf8" });
          await page.route(`**/${file}`, (r) =>
            r.fulfill({ contentType: "text/javascript", body }),
          );
        }
      await page.goto(`${base}/?renderer=webgl2&profile=weak&adapt=off&labs=1`);
      await page.waitForSelector("body[data-ready='true']", { timeout: 180_000 });
      const toys = recordsOnly ? [] : phone ? ["photo-3d"] : ["photo-3d", "chest", "donut"];
      for (const toy of toys) {
        await page.evaluate(async (id) => {
          await window.__splashery.app.chooseToy(id);
          if (window.__splashery.player.toyInfo.id !== id) throw new Error(`Wrong toy: ${id}`);
        }, toy);
        for (const format of ["gif", ...(toy === "photo-3d" ? ["video"] : [])]) {
          const key = `${label}-${toy}-${format}`;
          if (results.some((r) => r.key === key)) continue;
          console.log("START", key);
          const download = page.waitForEvent("download", { timeout: 900_000 });
          const measured = await page.evaluate(
            async ({ format, before }) => {
              const { app } = window.__splashery;
              const t = performance.now();
              const blob = format === "gif" ? await app.exportGIF() : await app.exportWebM();
              if (!blob)
                throw new Error(document.querySelector("#toast")?.textContent || "Export failed");
              return {
                bytes: blob.size,
                type: blob.type,
                wallSeconds: (performance.now() - t) / 1000,
                before,
              };
            },
            { format, before },
          );
          const dl = await download;
          const file = `${key}${path.extname(dl.suggestedFilename())}`;
          await dl.saveAs(path.join(out, file));
          results.push({ key, file, ...measured });
          saveResults();
          console.log("DONE", key, measured);
        }
      }
      // Record a fixed, textured source for a like-for-like decoded-frame comparison.
      await page.evaluate(() => window.__splashery.app.chooseToy("photo-3d"));
      for (const quality of stillsOnly
        ? []
        : before
          ? ["standard"]
          : phone
            ? ["standard", "high"]
            : ["standard", "high", "max"]) {
        const key = `${label}-record-${quality}`;
        if (results.some((r) => r.key === key)) continue;
        console.log("START", key);
        await page.evaluate(async () => {
          const { player } = window.__splashery;
          // Freeze the deterministic clock and snap the camera, while still
          // allowing render/layout work at each recording buffer size.
          await player.renderAt(0, player.camera.getState());
        });
        if (phone && !(await page.locator("#tab-share").isVisible()))
          await page.click("#sheet-toggle");
        await page.click("#tab-share");
        if (!before) await page.selectOption("#record-quality", quality);
        await page.evaluate(() => {
          const { app, player } = window.__splashery;
          const start = app.startRecord.bind(app);
          const stage = player.stage;
          const capture = stage.captureFrame;
          window.recordReference = null;
          // Observe the real live frames startRecord already requests. Keep
          // its last snapshot, with no extra resize, render, or encoded pixels.
          stage.captureFrame = function (...args) {
            return capture.apply(this, args).then((frame) => {
              window.recordReference = frame;
              return frame;
            });
          };
          window.recordStartComplete = false;
          app.startRecord = async (...args) => {
            try {
              return await start(...args);
            } finally {
              window.recordStartComplete = true;
              app.startRecord = start;
              stage.captureFrame = capture;
            }
          };
        });
        const started = Date.now();
        await page.click("#record-start", { noWaitAfter: true });
        await page.waitForFunction(() => window.recordStartComplete, null, { timeout: 180_000 });
        const take = await page.evaluate(async () => {
          const { app, player } = window.__splashery;
          const done = app.recording?.done || Promise.resolve(app.recorded);
          await new Promise((r) => setTimeout(r, 3000));
          app.stopRecord();
          const recorded = await done;
          player.resume();
          const ref = window.recordReference;
          if (!ref) throw new Error("The recording has no live-canvas reference");
          return {
            width: ref.width,
            height: ref.height,
            reference: ref.toDataURL("image/png").split(",")[1],
            bytes: recorded.blob.size,
            type: recorded.blob.type,
            seconds: recorded.seconds,
            reason: recorded.reason,
          };
        });
        const measured = {
          ...take,
          wallSeconds: (Date.now() - started) / 1000,
          before,
        };
        fs.writeFileSync(
          path.join(out, `${key}-reference.png`),
          Buffer.from(measured.reference, "base64"),
        );
        delete measured.reference;
        const download = page.waitForEvent("download");
        if (!before) await page.click("#rec-save");
        else await page.evaluate(() => window.__splashery.app.saveRecord());
        const dl = await download;
        const file = `${key}${path.extname(dl.suggestedFilename())}`;
        await dl.saveAs(path.join(out, file));
        results.push({ key, file, ...measured });
        saveResults();
        if (!before) await page.click("#rec-close");
        else await page.evaluate(() => window.__splashery.app.closeRecord());
        console.log("DONE", key, measured);
      }
      if (!before) {
        const key = `${label}-photo-3d-png`;
        if (!results.some((r) => r.key === key)) {
          const download = page.waitForEvent("download");
          const measured = await page.evaluate(async () => {
            const start = performance.now();
            const blob = await window.__splashery.app.exportPNG();
            return {
              bytes: blob.size,
              type: blob.type,
              wallSeconds: (performance.now() - start) / 1000,
              before: false,
            };
          });
          const dl = await download,
            file = `${key}.png`;
          await dl.saveAs(path.join(out, file));
          results.push({ key, file, ...measured });
          saveResults();
        }
      }
      if (!before) {
        if (phone && !(await page.locator("#tab-share").isVisible()))
          await page.click("#sheet-toggle");
        await page.click("#tab-share");
        await page.selectOption("#record-quality", EXPORT_PRESETS.record.defaults.quality);
        await page.screenshot({
          path: path.join(out, `share-${phone ? "390x844" : "1440x900"}.png`),
        });
      }
      await context.close();
    }
  }
} finally {
  await browser.close();
}
