// Task 51: main's eager scan helpers retain deferred scan payloads.
import { test, expect } from "@playwright/test";

test("unrelated toys retain eager helpers without scan payloads; a scan loads and responds", async ({
  page,
}) => {
  const requests = [];
  page.on("request", (r) => requests.push(new URL(r.url()).pathname));
  const errors = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.goto("/?renderer=webgl2&profile=weak&adapt=off&labs=1");
  await page.waitForSelector("body[data-ready='true']", { timeout: 180000 });
  expect(requests).toContain("/src/packs/real-objects.js");
  expect(requests.some((url) => /\.splats(?:\.gz)?$/.test(url))).toBe(false);
  await page.evaluate(() => window.__splashery.app.chooseToy("pyrite-cubes"));
  await page.waitForFunction(() => window.__splashery.player.toyInfo?.id === "pyrite-cubes");
  expect(requests).toContain("/src/packs/real-objects.js");
  expect(
    await page.evaluate(() => {
      window.__splashery.app.act();
      return window.__splashery.player.motion.tap?.key;
    }),
  ).toBe("tap");
  await expect
    .poll(() =>
      page.evaluate(() =>
        Math.abs(window.__splashery.player.motion.out?.parts.whole?.quat?.[1] || 0),
      ),
    )
    .toBeGreaterThan(0.02);
  expect(errors).toEqual([]);
});

test("an eager museum helper keeps the scan payload deferred until selection", async ({ page }) => {
  await page.goto("/?renderer=webgl2&profile=weak&adapt=off&labs=1");
  await page.waitForSelector("body[data-ready='true']", { timeout: 180000 });
  const scan = page.waitForRequest("**/assets/toys/pyrite-cubes/pyrite-cubes-opening.splats.gz", {
    timeout: 10000,
  });
  const chosen = page.evaluate(() => window.__splashery.app.chooseToy("pyrite-cubes"));
  await scan;
  await chosen;
  expect(await page.evaluate(() => window.__splashery.player.toyInfo.id)).toBe("pyrite-cubes");
});
