// The engine addition for lane Anatomy (docs/handoff/Anatomy.md): a kit toy's drive() may set
// out.legend, a list of names shown as page text beside the stage (the anatomy atlas's labels).
// Toys that don't set it show nothing.

import { test, expect } from "@playwright/test";

const APP = "/?renderer=webgl2&adapt=off&profile=mid";

test("a toy's out.legend shows as a list beside the stage, and goes when unset", async ({
  page,
}) => {
  await page.goto(APP);
  await page.waitForSelector("body[data-ready='true']", { timeout: 180_000 });
  await page.evaluate(() => window.__splashery.app.chooseToy("heart"));
  await page.waitForFunction(() => window.__splashery.player.toyInfo?.recipe?.drive, null, { timeout: 120_000 }); // prettier-ignore
  // Toys without labels show no list.
  await expect(page.locator("#toy-legend")).toBeHidden();
  // The heart's drive() now also sets a legend.
  await page.evaluate(() => {
    const r = window.__splashery.player.toyInfo.recipe;
    const drive = r.drive;
    r.__drive = drive;
    r.drive = (t, c, out, info) => {
      drive(t, c, out, info);
      out.legend = {
        title: "Heart",
        items: [
          { text: "Chambers", head: true },
          { text: "Left ventricle", on: true },
          { text: "Right atrium", dim: true },
        ],
      };
    };
  });
  const box = page.locator("#toy-legend");
  await expect(box).toBeVisible();
  await expect(box.locator(".toy-legend-title")).toHaveText("Heart");
  await expect(box.locator("li")).toHaveText(["Chambers", "Left ventricle", "Right atrium"]);
  await expect(box.locator("li.head")).toHaveText("Chambers");
  await expect(box.locator("li.on")).toHaveText("Left ventricle");
  await expect(box.locator("li.dim")).toHaveText("Right atrium");
  // Taps pass through it to the stage.
  expect(await box.evaluate((el) => getComputedStyle(el).pointerEvents)).toBe("none");
  // Unset again: the list goes.
  await page.evaluate(() => {
    const r = window.__splashery.player.toyInfo.recipe;
    r.drive = r.__drive;
  });
  await expect(box).toBeHidden();
});
