import { test, expect } from "@playwright/test";

test("an invalid photo warning survives a pending photo rebuild", async ({ page }) => {
  await page.goto("/?renderer=webgl2&profile=mid&adapt=off&labs=1");
  await page.waitForSelector("body[data-ready='true']", { timeout: 180000 });
  await page.evaluate(async () => {
    const { app } = window.__splashery;
    await app.chooseToy("photo-3d");
    window.__inputRebuild = app.setToyOptions({ depth: 0.75 });
  });
  await page.waitForFunction(
    () =>
      Math.abs((window.__splashery.player.proc?.ctx?.kit?.data?.photo?.relief || 0) - 0.605) <
      0.001,
    null,
    { timeout: 90000 },
  );
  await page.locator("#toy-input-file").setInputFiles({
    name: "broken.jpg",
    mimeType: "image/jpeg",
    buffer: Buffer.from("not a photo"),
  });
  await page.evaluate(() => window.__inputRebuild);
  await expect(page.locator("#toy-input .warning")).toBeVisible();
  await expect(page.locator("#toy-input .warning")).toContainText("couldn't read");
});
