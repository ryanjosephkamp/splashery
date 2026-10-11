// Manual r7a: crisp demos and pictures for every page. Screenshots man7a-*.png.

import { test, expect } from "@playwright/test";
import path from "node:path";

const SHOTS = path.resolve("tests/screenshots");
const PAGES = ["splat", "language", "toy", "share"];

test.describe("every demo canvas is as sharp as the page text", () => {
  test.use({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 3 });
  for (const name of PAGES) {
    test(`${name}.html: backing width is 3 x CSS width`, async ({ page }) => {
      const errors = [];
      page.on("pageerror", (e) => errors.push(String(e)));
      await page.goto(`/manual/${name}.html`);
      await page.evaluate(() => document.querySelectorAll("details").forEach((d) => (d.open = true)));
      await page.waitForTimeout(800);
      const rows = await page.evaluate(() =>
        [...document.querySelectorAll(".demo-live canvas")].map((c) => ({
          id: c.id,
          css: c.clientWidth,
          backing: c.getContext ? Object.getOwnPropertyDescriptor(HTMLCanvasElement.prototype, "width").get.call(c) : 0,
          pixelated: c.style.imageRendering === "pixelated",
        })),
      );
      expect(rows.length).toBeGreaterThan(0);
      for (const r of rows) {
        if (r.pixelated) continue; // a QR code: square modules, scaled without smoothing
        expect(Math.abs(r.backing - 3 * r.css), `${name} #${r.id}`).toBeLessThanOrEqual(2);
      }
      expect(errors).toEqual([]);
      await page.screenshot({ path: `${SHOTS}/man7a-${name}-dpr3-390x844.png`, fullPage: false });
    });
  }
});
