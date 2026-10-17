// Task 101: retain all six book screenshots at their original viewport sizes.
import { test } from "@playwright/test";

import { BK, open, turn } from "./bk-helpers.mjs";
test.describe("your book, the album and the frame (in the app)", () => {
  test.setTimeout(300_000);
  for (const [w, h] of [
    [390, 844],
    [1440, 900],
  ])
    test(`screenshots of the three toys at ${w}x${h}`, async ({ page }) => {
      await page.setViewportSize({ width: w, height: h });
      for (const [id, name, taps] of [
        ["your-book", "book", 2],
        ["photo-album", "album", 2],
        ["picture-frame", "frame", 0],
      ]) {
        await open(page, id, id === "your-book" ? `${BK}booklet.pdf` : null);
        for (let i = 0; i < taps; i++) await turn(page);
        await page.waitForTimeout(500);
        await page.screenshot({ path: `tests/screenshots/bk-${name}-${w}x${h}.png` });
      }
    });
});
