import { test, expect } from "@playwright/test";

for (const [width, height] of [
  [390, 844],
  [1440, 900],
]) {
  test(`Photo to 3D shows progress and its controls respond during inference at ${width}×${height}`, async ({
    browser,
  }) => {
    const page = await browser.newPage({ viewport: { width, height } });
    const errors = [];
    const requests = [];
    page.on("pageerror", (e) => errors.push(e.message));
    page.on("request", (r) => requests.push(r.url()));
    try {
      await page.goto("/?renderer=webgl2&adapt=off&profile=low&labs=1");
      await page.waitForSelector("body[data-ready='true']");
      await expect(page).toHaveTitle(/Splashery/);
      await page.evaluate(() => window.__splashery.app.chooseToy("photo-3d"));
      await page.waitForFunction(
        () => window.__splashery.player.proc?.ctx?.kit?.data?.photo?.splats > 5000,
      );
      expect(requests.filter((u) => /depth-worker|depth-anything|ort-wasm/.test(u))).toEqual([]);
      if (width < 760) await page.locator("#sheet-toggle").click();
      await page.locator("#tab-play").click();
      await page.locator("#toy-input-file").setInputFiles("tests/fixtures/p3d/scene.jpg");
      await expect(page.locator(".input-progress")).toContainText(/Loading|Starting|Working out/);
      await expect(page.locator(".input-progress")).toHaveAttribute("role", "status");
      await page.locator("#tab-look").click();
      await expect(page.locator("#tab-look")).toHaveAttribute("aria-selected", "true");
      await page.waitForFunction(
        () => window.__splashery.player.proc?.ctx?.kit?.data?.photo?.custom === true,
        null,
        { timeout: 150000 },
      );
      await page.locator("#tab-play").click();
      await expect(page.locator(".input-progress")).toBeHidden();
      expect(
        await page.evaluate(() => window.__splashery.player.proc.ctx.kit.data.photo.name),
      ).toBe("scene");
      expect(requests.filter((u) => /depth-worker/.test(u)).length).toBeGreaterThan(0);
      expect(errors).toEqual([]);
      await page.screenshot({ path: `/tmp/cdx-depth-ui-${width}x${height}.png` });
    } finally {
      await page.close();
    }
  });
}
