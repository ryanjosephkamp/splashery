import { test, expect } from "@playwright/test";
import { PNG } from "pngjs";
import { open } from "../tools/cdx-p3d2-measure.mjs";
import { calibration, calibrationShot, calibrationMetric } from "../tools/cdx-p3d2-r3-edge.mjs";
import { openR3, screens } from "../tools/cdx-p3d2-r3-common.mjs";

test.use({ viewport: { width: 390, height: 844 } });
test("texture filtering keeps each side's own color at a depth cut", async ({ page }) => {
  test.setTimeout(240000);
  await open(page);
  const info = await calibration(page);
  for (const [yaw, pitch] of [
    [-30, 0],
    [30, 0],
    [0, -30],
    [0, 30],
  ]) {
    const shot = await calibrationShot(page, yaw, pitch);
    const metric = calibrationMetric(
      PNG.sync.read(Buffer.from(shot.image.split(",")[1], "base64")),
      shot.corners,
      [info.near, info.far],
    );
    console.log({ yaw, pitch, ...metric });
    expect(metric.edgePixels).toBeGreaterThan(0);
    expect(metric.holeFraction).toBeLessThan(0.002);
    expect(metric.meanError).toBeLessThan(0.03);
  }
});

for (const name of ["phone", "desktop"])
  test(`${name}: soft depth edges retain the source colors at the requested display profile`, async ({
    browser,
  }) => {
    test.setTimeout(240000);
    const screen = screens[name],
      page = await browser.newPage({
        viewport: { width: screen.width, height: screen.height },
        deviceScaleFactor: screen.deviceScaleFactor,
      });
    try {
      await openR3(page, test.info().project.use.baseURL, screen);
      const info = await calibration(page, { soft: true });
      for (const [yaw, pitch] of [
        [-20, 0],
        [20, 0],
        [0, -20],
        [0, 20],
        [-30, 0],
        [30, 0],
        [0, -30],
        [0, 30],
      ]) {
        const shot = await calibrationShot(page, yaw, pitch);
        const metric = calibrationMetric(
          PNG.sync.read(Buffer.from(shot.image.split(",")[1], "base64")),
          shot.corners,
          [info.near, info.far],
        );
        expect(metric.edgePixels).toBeGreaterThan(0);
        expect(metric.meanError).toBeLessThan(0.03);
        expect(metric.holeFraction).toBeLessThan(0.002);
      }
    } finally {
      await page.close();
    }
  });
