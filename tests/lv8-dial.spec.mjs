// Lane Live r8: a toy's depth slider over the stage (the owner's walkthrough
// of October 6, 2026: "a little slider somewhere on the screen ... it should
// be hideable. Maybe it's present by default"). Page controls, not splats;
// it sets the same option as the Toy tab's slider, and hiding it is
// remembered on this device.

import { test, expect } from "@playwright/test";

const APP = "/?renderer=webgl2&adapt=off&profile=low&labs=1";

async function open(page, id) {
  await page.evaluate((id) => window.__splashery.app.chooseToy(id), id);
  await page.waitForFunction((id) => window.__splashery.player.scene.toy.id === id, id);
}

// Every other visible button, link or input the slider overlaps.
function overlaps(page) {
  return page.evaluate(() => {
    const dial = document.getElementById("stage-dial").getBoundingClientRect();
    const hit = [];
    for (const el of document.querySelectorAll("button, a, input, select, .toy-status")) {
      if (el.closest("#stage-dial") || !el.checkVisibility?.()) continue;
      const r = el.getBoundingClientRect();
      if (!r.width || !r.height) continue;
      if (r.right > dial.left && r.left < dial.right && r.bottom > dial.top && r.top < dial.bottom)
        hit.push(el.id || el.className || el.tagName);
    }
    return hit;
  });
}

for (const [w, h] of [
  [390, 844],
  [1440, 900],
]) {
  test.describe(`at ${w}×${h}`, () => {
    test.use({ viewport: { width: w, height: h } });

    test("shows on a depth toy, drives the option both ways, and hides", async ({ page }) => {
      await page.goto(APP);
      await page.waitForSelector("body[data-ready='true']", { timeout: 180_000 });
      // Not on a toy without a stage slider.
      await open(page, "chladni-plate");
      await expect(page.locator("#stage-dial")).toBeHidden();
      await expect(page.locator("#stage-dial-show")).toBeHidden();

      await open(page, "photo-3d");
      const dial = page.locator("#stage-dial");
      await expect(dial).toBeVisible();
      await expect(page.locator("#stage-dial-label")).toHaveText("Depth");
      await expect(page.locator("#stage-dial-input")).toHaveValue("0.5");
      // Upright, at the stage's right, over nothing else.
      const box = await dial.boundingBox();
      expect(box.height).toBeGreaterThan(box.width * 3);
      expect(box.x + box.width).toBeLessThanOrEqual(w);
      expect(await overlaps(page)).toEqual([]);

      // Moved on the stage: the toy's option and the Toy tab follow.
      await page.evaluate(() => {
        const i = document.getElementById("stage-dial-input");
        i.value = "0.8";
        i.dispatchEvent(new Event("input", { bubbles: true }));
        i.dispatchEvent(new Event("change", { bubbles: true }));
      });
      await page.waitForFunction(() => window.__splashery.player.scene.toy.options?.depth === 0.8);
      await expect(page.locator("#toy-options input[type=range]").first()).toHaveValue("0.8");

      // Moved in the Toy tab: the stage slider follows.
      await page.evaluate(() => {
        const i = document.querySelector("#toy-options input[type=range]");
        i.value = "0.25";
        i.dispatchEvent(new Event("change", { bubbles: true }));
      });
      await page.waitForFunction(() => window.__splashery.player.scene.toy.options?.depth === 0.25);
      await expect(page.locator("#stage-dial-input")).toHaveValue("0.25");

      // One tap hides it; its name brings it back; the choice is remembered.
      await page.locator("#stage-dial-hide").click();
      await expect(dial).toBeHidden();
      const show = page.locator("#stage-dial-show");
      await expect(show).toBeVisible();
      await expect(show).toHaveText("Depth");
      await page.reload();
      await page.waitForSelector("body[data-ready='true']", { timeout: 180_000 });
      await open(page, "moving-photo-3d");
      await expect(dial).toBeHidden();
      await expect(show).toBeVisible();
      await show.click();
      await expect(dial).toBeVisible();
      await expect(page.locator("#stage-dial-input")).toHaveValue("0.6");
      expect(await page.evaluate(() => localStorage.getItem("splashery.stageDialHidden"))).toBe(null); // prettier-ignore
    });
  });
}
