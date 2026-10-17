// Task 101: retain the cradle release observation in solo execution.
import { test, expect } from "@playwright/test";

import { loadApp, openToy, screenAt, yaw } from "./f-helpers.mjs";

test.describe("Touch and drag (WebGL2)", () => {
  test.use({ viewport: { width: 1000, height: 760 } });
  test("a Newton's cradle ball dragged out and let go swings the far ball out", async ({
    page,
  }) => {
    await loadApp(page);
    await page.evaluate(() => window.__splashery.player.camera.setTurntable(false));
    await openToy(page, "toys", "newtons-cradle", "Newton's cradle");
    const yaw0 = await yaw(page);
    const angles = () =>
      page.evaluate(() => [0, 1, 2, 3, 4].map((i) => window.__splashery.player.motion.out.parts["ball" + i]?.angle ?? 0)); // prettier-ignore
    // Pull the two left balls out to the left and hold them there.
    const [x0, y0] = await screenAt(page, [-0.3, 0.2, 0.15]);
    const [x1, y1] = await screenAt(page, [-0.75, 0.42, 0.15]);
    await page.mouse.move(x0, y0);
    await page.mouse.down();
    await page.waitForTimeout(400);
    for (let i = 1; i <= 10; i++) await page.mouse.move(x0 + ((x1 - x0) * i) / 10, y0 + ((y1 - y0) * i) / 10); // prettier-ignore
    await page.waitForTimeout(400);
    const held = await angles();
    expect(held[0]).toBeLessThan(-0.3);
    expect(held[1]).toBeCloseTo(held[0], 5);
    expect(held[2]).toBe(0);
    // Let go: two balls fly out on the right.
    await page.mouse.up();
    let most = [0, 0, 0, 0, 0];
    for (let i = 0; i < 40; i++) {
      const a = await angles();
      most = most.map((m, k) => Math.max(m, a[k]));
      if (most[3] > 0.2 && most[4] > 0.2) break;
      await page.waitForTimeout(100);
    }
    expect(most[4]).toBeGreaterThan(0.2);
    expect(most[3]).toBeGreaterThan(0.2);
    expect(await yaw(page)).toBeCloseTo(yaw0, 3);
    // A tap still lifts the end ball and lets it go.
    await page.locator("#toy-action").click();
    await expect.poll(async () => (await angles())[0], { timeout: 30_000 }).toBeLessThan(-0.2);
  });
});
