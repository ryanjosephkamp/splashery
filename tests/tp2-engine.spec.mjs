// Lane Toy pages r2 (engine): an embed made with ?sound=on plays the toy's tap
// sound and shows a mute button; every other embed stays silent, with no button.

import { test, expect } from "@playwright/test";

async function ready(page, url) {
  await page.goto(url);
  await page.waitForFunction(() => window.__splashery?.ready, null, { timeout: 120_000 });
  await page.waitForTimeout(1500); // the first pick needs a rendered frame
}
const tapMiddle = async (page) => {
  const box = await page.locator("#stage").boundingBox();
  await page.mouse.click(box.x + box.width / 2, box.y + box.height / 2);
  await page.waitForTimeout(500);
};
const scheduled = (page) => page.evaluate(() => window.__splashery.viewer.sound.scheduled);

test("?sound=on plays the tap sound and the button mutes it", async ({ page }) => {
  await ready(page, "/embed/?toy=strawberry&renderer=webgl2&sound=on");
  const button = page.locator("#sound-toggle");
  await expect(button).toBeVisible();
  await expect(button).toHaveAttribute("aria-pressed", "true");
  await tapMiddle(page);
  // A first pick is slow without a GPU: wait for the tap to land.
  await expect.poll(() => scheduled(page), { timeout: 30_000 }).toBeGreaterThan(0);
  // A long tune keeps scheduling notes while it plays, so read the count once the mute has
  // stopped it, then tap again and wait for that tap to land: nothing more may sound.
  await button.click();
  await expect(button).toHaveAttribute("aria-pressed", "false");
  await page.waitForTimeout(1000);
  const heard = await scheduled(page);
  await page.evaluate(() => {
    window.__taps = 0;
    window.__splashery.player.on("action", () => window.__taps++);
  });
  await tapMiddle(page);
  await expect.poll(() => page.evaluate(() => window.__taps), { timeout: 30_000 }).toBeGreaterThan(0); // prettier-ignore
  await page.waitForTimeout(1000);
  expect(await scheduled(page)).toBe(heard);
  // The choice is not remembered: the app's own speaker setting stays as it was.
  expect(await page.evaluate(() => localStorage.getItem("splashery.sound"))).toBeNull();
});

test("an embed without sound=on stays silent, with no button", async ({ page }) => {
  await ready(page, "/embed/?toy=strawberry&renderer=webgl2");
  await expect(page.locator("#sound-toggle")).toHaveCount(0);
  await tapMiddle(page);
  expect(await page.evaluate(() => window.__splashery.viewer.sound ?? null)).toBeNull();
});
