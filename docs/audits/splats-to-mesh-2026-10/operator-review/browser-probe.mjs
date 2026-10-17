import fs from "node:fs";
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { chromium } from "@playwright/test";
import config from "../../playwright.config.mjs";
import { validateBytes } from "./review-validator/node_modules/gltf-validator/module.mjs";

const output = ".cache/mesh-export/operator-defaults";
fs.mkdirSync(output, { recursive: true });
const browser = await chromium.launch(config.use.launchOptions);
const results = [];
const geometryHash = (bytes) => {
  const dv = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const at = 20 + dv.getUint32(12, true);
  return createHash("sha256")
    .update(bytes.subarray(at + 8))
    .digest("hex");
};
try {
  for (const [width, height] of [
    [1440, 900],
    [390, 844],
  ]) {
    const phone = width < 760;
    const context = await browser.newContext({
      viewport: { width, height },
      screen: { width, height },
      hasTouch: phone,
      acceptDownloads: true,
    });
    try {
      const page = await context.newPage();
      await page.goto("http://127.0.0.1:4173/?renderer=webgl2&adapt=off&profile=low&labs=1");
      await page.waitForFunction(() => !!window.__splashery?.app);
      await page.evaluate(() => window.__splashery.app.chooseToy("splats-to-mesh"));
      if (phone && (await page.locator("#sheet-toggle").getAttribute("aria-expanded")) === "false")
        await page.locator("#sheet-toggle").click();
      await page.locator("#tab-play").click();
      await page.locator("#mesh-panel").waitFor({ state: "visible" });
      const settings = await page.locator("#mesh-panel").evaluate((panel) => {
        const value = (id) => panel.querySelector(`#mesh-${id}`).value;
        return {
          quality: value("quality"),
          resolution: Number(value("resolution")),
          level: Number(value("level")),
          triangleBudget: Number(value("budget")),
          readyToPrint: panel.querySelector("#mesh-print").checked,
          printSize: Number(value("size")),
        };
      });
      assert.deepEqual(settings, {
        quality: phone ? "balanced" : "fine",
        resolution: phone ? 72 : 160,
        level: phone ? 0.5 : 1,
        triangleBudget: phone ? 40000 : 100000,
        readyToPrint: !phone,
        printSize: 100,
      });
      await page.locator("#mesh-convert").click();
      await page.waitForFunction(
        () => document.querySelector("#mesh-status").textContent.includes("Mesh ready"),
        null,
        { timeout: 60000 },
      );
      const downloadPromise = page.waitForEvent("download");
      await page.locator("#mesh-save").click();
      const download = await downloadPromise;
      const name = `default-${phone ? "phone" : "desktop"}`;
      await download.saveAs(`${output}/${name}.glb`);
      const bytes = fs.readFileSync(`${output}/${name}.glb`);
      const dv = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
      const json = JSON.parse(
        new TextDecoder().decode(bytes.subarray(20, 20 + dv.getUint32(12, true))),
      );
      const report = json.asset.extras.report;
      assert.equal(report.resolution, settings.resolution);
      assert.equal(report.level, settings.level);
      assert.equal(report.readyToPrint, settings.readyToPrint);
      assert.equal(report.printSize, phone ? null : 100);
      assert(report.triangles <= settings.triangleBudget);
      assert(json.asset.copyright.includes("CC0 1.0"));
      const validation = await validateBytes(bytes, { uri: `${name}.glb` });
      assert.equal(validation.issues.numErrors, 0);
      assert.equal(validation.issues.numWarnings, 0);
      await page
        .locator("#mesh-preview")
        .evaluate((element) => element.scrollIntoView({ block: "start" }));
      await page.screenshot({ path: `${output}/${name}-${width}x${height}.png` });
      const previous = ".cache/mesh-export/exports/examples/torus/torus.glb";
      const result = {
        viewport: { width, height, hasTouch: phone },
        settings,
        downloadedReport: report,
        copyright: json.asset.copyright,
        validation: {
          errors: validation.issues.numErrors,
          warnings: validation.issues.numWarnings,
        },
        geometryBinSha256: geometryHash(bytes),
        ...(!phone && fs.existsSync(previous)
          ? {
              matchesScoredTorusGeometry:
                geometryHash(bytes) === geometryHash(fs.readFileSync(previous)),
            }
          : {}),
      };
      results.push(result);
      console.log(
        JSON.stringify({
          viewport: result.viewport,
          settings,
          validation: result.validation,
          matchesScoredTorusGeometry: result.matchesScoredTorusGeometry,
        }),
      );
    } finally {
      await context.close();
    }
  }
} finally {
  await browser.close();
}
fs.writeFileSync(
  `${output}/results.json`,
  JSON.stringify(
    {
      purpose:
        "First-use UI defaults verified through downloaded GLB; phone profile on desktop hardware.",
      results,
    },
    null,
    2,
  ) + "\n",
);
