// Task 51: scan code stays deferred until its toy opens.
import { test, expect } from "@playwright/test";

test("unrelated toys defer the scan helpers; a scan still loads and responds", async ({ page }) => {
  const requests = [];
  page.on("request", (r) => requests.push(new URL(r.url()).pathname));
  const errors = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.goto("/?renderer=webgl2&profile=weak&adapt=off&labs=1");
  await page.waitForSelector("body[data-ready='true']", { timeout: 180000 });
  expect(requests).not.toContain("/src/packs/real-objects.js");
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

test("a museum scan starts fetching while its deferred helpers are still loading", async ({
  page,
}) => {
  await page.goto("/?renderer=webgl2&profile=weak&adapt=off&labs=1");
  await page.waitForSelector("body[data-ready='true']", { timeout: 180000 });
  let release;
  const held = new Promise((resolve) => (release = resolve));
  await page.route("**/src/packs/real-objects.js", async (route) => {
    await held;
    await route.continue();
  });
  const scan = page.waitForRequest("**/assets/toys/pyrite-cubes/pyrite-cubes-opening.splats.gz", {
    timeout: 10000,
  });
  const chosen = page.evaluate(() => window.__splashery.app.chooseToy("pyrite-cubes"));
  try {
    await scan;
  } finally {
    release();
    await chosen;
  }
  expect(await page.evaluate(() => window.__splashery.player.toyInfo.id)).toBe("pyrite-cubes");
});
