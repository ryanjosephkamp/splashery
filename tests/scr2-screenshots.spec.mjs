// Task 101: independent screen checks, with all original cases and sizes.
import { test } from "@playwright/test";

import { openScreen, settle, ON_TIME, OFF_TIME } from "./scr2-helpers.mjs";

test("lane Screens r2 screenshots at 390x844 and 1440x900", async ({ page }) => {
  test.setTimeout(600_000);
  for (const size of [
    { width: 390, height: 844 },
    { width: 1440, height: 900 },
  ]) {
    const tag = `${size.width}x${size.height}`;
    for (const style of ["tv", "flat", "cinema", "hologram"]) {
      await openScreen(page, { style, sample: "gif" }, size);
      await page.evaluate(() => window.__splashery.player.act());
      await settle(page, ON_TIME[style] + 0.4);
      await page.screenshot({ path: `tests/screenshots/scr2-${style}-${tag}.png` });
    }
    // The hologram switched off again.
    await page.evaluate(() => window.__splashery.player.act());
    await settle(page, OFF_TIME.hologram + 0.4);
    await page.screenshot({ path: `tests/screenshots/scr2-hologram-off-${tag}.png` });
  }
});
