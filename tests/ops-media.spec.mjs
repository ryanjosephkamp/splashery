// The Operator's engine fix from the owner's review of September 29, 2026: a
// picture toy's web-address box names only what that toy opens (its accept
// list), so the picture frame no longer offers a PDF.

import { test, expect } from "@playwright/test";

const APP = "/?renderer=webgl2&adapt=off&profile=mid&labs=1";

const CASES = [
  ["picture-lab", "https://… a PDF, picture, GIF or video"],
  ["your-book", "https://… a PDF"],
  ["photo-album", "https://… a picture"],
  ["screen", "https://… a video, GIF or picture"],
];

test("the web-address box names only what each picture toy opens", async ({ page }) => {
  test.setTimeout(300_000);
  await page.goto(APP);
  await page.waitForSelector("body[data-ready='true']", { timeout: 180_000 });
  for (const [id, words] of CASES) {
    await page.evaluate((t) => window.__splashery.app.chooseToy(t), id);
    await page.click("#tab-play");
    await expect(page.locator("#toy-media-url")).toHaveAttribute("placeholder", words, {
      timeout: 60_000,
    });
  }
});
