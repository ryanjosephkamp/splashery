#!/usr/bin/env node
// npm run serve, then SPLASHERY_CHROMIUM=/path/to/chromium node tools/lifecycle-shots.mjs
import { chromium, expect } from "@playwright/test";
import fs from "node:fs/promises";
import { launchArgs } from "./lifecycle-probe.mjs";

const base = process.argv.slice(2).find((arg) => !arg.startsWith("--")) || "http://127.0.0.1:4173/";
const toastOnly = process.argv.includes("--toast-only");
const source = await fs.readFile(new URL("../src/app.js", import.meta.url), "utf8");
// Isolate the startup fix while keeping the current layout, assets, and all other code identical.
const before = source
  .replace(
    "    // Make can open while the first toy is loading; initialize its controls before that paint.\n" +
      "    this.setGenerator({ count: PROFILES[player.profile].defaultCount }, { rebuild: false });\n",
    "",
  )
  .replace(
    "    const ui = this.ui;\n    ui.setGenerator(this.generator);",
    "    const ui = this.ui;",
  );
if (before === source || before.includes("// Make can open while"))
  throw new Error("The startup fix could not be isolated.");

const browser = await chromium.launch({
  executablePath: process.env.SPLASHERY_CHROMIUM || undefined,
  args: launchArgs,
});
const observations = [];
await fs.mkdir("tests/screenshots", { recursive: true });
try {
  for (const [width, height] of [
    [390, 844],
    [1440, 900],
  ]) {
    for (const version of toastOnly ? ["after"] : ["before", "after"]) {
      const context = await browser.newContext({
        viewport: { width, height },
        colorScheme: "light",
      });
      const page = await context.newPage();
      const cdp = await context.newCDPSession(page);
      let release;
      const held = new Promise((resolve) => {
        release = resolve;
      });
      await page.route("**/assets/toys/cactus/*.sog", async (route) => {
        await held;
        await route.continue();
      });
      if (version === "before")
        await page.route("**/src/app.js", (route) =>
          route.fulfill({ contentType: "application/javascript", body: before }),
        );
      try {
        await cdp.send("Emulation.setCPUThrottlingRate", { rate: toastOnly ? 1 : 6 });
        await cdp.send("Network.enable");
        await cdp.send("Network.setCacheDisabled", { cacheDisabled: true });
        await cdp.send("Network.emulateNetworkConditions", {
          offline: false,
          latency: toastOnly ? 0 : 150,
          downloadThroughput: toastOnly ? -1 : 200000,
          uploadThroughput: toastOnly ? -1 : 90000,
        });
        await page.goto(`${base}?renderer=webgl2&profile=low&labs=1&adapt=off`, {
          waitUntil: "domcontentloaded",
          timeout: 180000,
        });
        await page.waitForFunction(() => !!window.__splashery?.app.ui, null, { timeout: 180000 });
        if (width === 390) await page.locator("#sheet-toggle").click();
        await page.locator("#tab-make").click();
        if (width === 390) await page.locator("#sheet-max").click();
        await page.locator("#gen-noise").scrollIntoViewIfNeeded();
        await expect(page.locator("#gen-count")).toBeVisible();
        const firstOpen = await page.evaluate(() => ({
          ready: window.__splashery.ready,
          values: [...document.querySelectorAll("#pane-make input[type=range]")].map(
            (e) => e.value,
          ),
          rangesInViewport: [...document.querySelectorAll("#pane-make input[type=range]")].every(
            (e) => {
              const r = e.getBoundingClientRect();
              return e.checkVisibility() && r.top >= 0 && r.bottom <= innerHeight;
            },
          ),
        }));
        expect(firstOpen.ready).toBe(false);
        expect(firstOpen.rangesInViewport).toBe(true);
        expect(firstOpen.values).toEqual(
          version === "before" ? ["120000", "50", "50", "50"] : ["60000", "35", "30", "25"],
        );
        const makeShot = `tests/screenshots/cdx-life-make-${version}-${width}x${height}.png`;
        if (!toastOnly) {
          await page.screenshot({ path: makeShot, animations: "disabled" });
          process.stderr.write(`${makeShot}\n`);
          observations.push({ path: makeShot, ...firstOpen });
        }
        release();
        if (version === "after") {
          await cdp.send("Emulation.setCPUThrottlingRate", { rate: 1 });
          await cdp.send("Network.emulateNetworkConditions", {
            offline: false,
            latency: 0,
            downloadThroughput: -1,
            uploadThroughput: -1,
          });
          await page.waitForFunction(() => window.__splashery?.ready, null, { timeout: 180000 });
          // The save-warning regression fixture supplies distinct histories; the real Save action
          // captures, normalizes, downloads, and reports the omitted edits.
          await page.evaluate(async () => {
            const { app, player } = window.__splashery;
            await app.makeToy({ ...app.generator, shape: "torus", count: 10000 });
            player.setPaused(true);
            player.proc.clay = Array.from({ length: 2400 }, (_, i) => ["e", i / 1000, 0, 0, 0.04]);
            player.scene.toy.clay = player.proc.clay.slice();
            player.scene.paint.stamps = Array.from({ length: 4800 }, (_, i) => [
              i / 1000,
              0,
              0,
              0.1,
              "#e63b2e",
              1,
            ]);
          });
          await page.locator("#tab-share").click();
          const download = page.waitForEvent("download");
          await page.locator("#export-json").click();
          await download;
          await expect(page.locator("#toast")).toContainText("400 clay edits and 800 paint stamps");
          const toastShot = `tests/screenshots/cdx-life-save-toast-${width}x${height}.png`;
          await page.screenshot({ path: toastShot, animations: "disabled" });
          process.stderr.write(`${toastShot}\n`);
          observations.push({ path: toastShot, toast: await page.locator("#toast").textContent() });
        }
      } finally {
        release();
        await page.unrouteAll({ behavior: "wait" });
        await context.close();
      }
    }
  }
} finally {
  await browser.close();
}
await fs.mkdir(".cache/lifecycle", { recursive: true });
await fs.writeFile(
  `.cache/lifecycle/screenshots${toastOnly ? "-toast" : ""}.json`,
  JSON.stringify(observations, null, 2) + "\n",
);
process.stdout.write(JSON.stringify(observations, null, 2) + "\n");
