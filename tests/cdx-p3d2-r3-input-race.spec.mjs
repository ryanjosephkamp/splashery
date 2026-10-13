import { test, expect } from "@playwright/test";

test("an invalid read from a replaced file input warns on the current photo panel", async ({
  page,
}) => {
  test.setTimeout(180000);
  await page.goto("/?renderer=webgl2&profile=mid&adapt=off&labs=1");
  await page.waitForSelector("body[data-ready='true']", { timeout: 120000 });
  await page.evaluate(() => window.__splashery.app.chooseToy("photo-3d"));
  const original = await page.locator("#toy-input-file").elementHandle();
  expect(original).not.toBeNull();
  // Playwright can retain an input across the asynchronous panel replacement
  // that finishes a previous upload. Reproduce that ordering explicitly.
  await page.evaluate(() => window.__splashery.app.setToyOptions({ depth: 0.75 }));
  expect(await original.evaluate((input) => input.isConnected)).toBe(false);
  expect(await page.evaluate(() => window.__splashery.player.loading)).toBeFalsy();
  await original.setInputFiles({
    name: "broken.jpg",
    mimeType: "image/jpeg",
    buffer: Buffer.from("not a photo"),
  });
  await expect(page.locator("#toy-input .warning")).toBeVisible({ timeout: 5000 });
  await expect(page.locator("#toy-input .warning")).toContainText("couldn't read");
});
