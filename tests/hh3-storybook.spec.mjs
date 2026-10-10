// Lane Hands-on H3: the Storybook as a real storybook (the owner's idea of
// October 9, 2026): it opens "The Little Lamp Who Wanted to See the Sea"
// (assets/toys/storybook/storybook.pdf, tools/hh3-storybook.mjs) in Your
// book's pages, and a tap turns them forward.

import { test, expect } from "@playwright/test";

const APP = "/?renderer=webgl2&adapt=off&profile=mid";

test("the Storybook opens its own ten-page book and a tap turns each page", async ({ page }) => {
  await page.goto(APP);
  await page.waitForSelector("body[data-ready='true']", { timeout: 180_000 });
  await page.evaluate(() => window.__splashery.app.chooseToy("book"));
  await page.waitForFunction(() => (window.__splashery.player.pictures?.info?.().count ?? 0) > 1, null, { timeout: 120_000 }); // prettier-ignore
  const info = () => page.evaluate(() => window.__splashery.player.pictures.info());
  let i = await info();
  expect(i.kind).toBe("pdf");
  expect(i.name).toBe("storybook.pdf");
  expect(i.count).toBe(10);
  expect(i.page).toBe(0);
  // ▶ (the toy's tap) turns on, a page at a time, once the book is laid
  // out (its tap finds a page to turn; before that a tap does nothing).
  await page.waitForFunction(
    async () => {
      const { RECIPES } = await import("/src/packs/pictures.js");
      return RECIPES.book.action.at([0, 0, 0])?.key === "turn";
    },
    null,
    { timeout: 120_000 },
  );
  // (Seen whole, the book turns a spread at a time: 0, 1, 3, …; a page at a
  // time on a phone.)
  let at = 0;
  for (let n = 0; n < 2; n++) {
    await page.evaluate(() => window.__splashery.player.act());
    await page.waitForFunction((at) => window.__splashery.player.pictures.info().page > at, at, { timeout: 60_000 }); // prettier-ignore
    at = (await info()).page;
  }
  expect(at).toBeGreaterThanOrEqual(2);
  // No Open a file: it keeps to its own book.
  const input = await page.evaluate(async () => {
    const { RECIPES } = await import("/src/packs/pictures.js");
    return [RECIPES.book.input ?? null, RECIPES["your-book"].input ? "yes" : null];
  });
  expect(input).toEqual([null, "yes"]);
});
