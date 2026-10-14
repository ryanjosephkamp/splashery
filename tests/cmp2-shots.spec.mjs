// Lane Computing r2: the screenshots (cmp2-*.png) of the sorting machine's
// new views and the Enigma set to a published key, mid-tap, on a phone and
// on a desktop; and the Enigma's setting typed in the Toy tab.

import { test, expect } from "@playwright/test";
import fs from "node:fs";
import path from "node:path";

const SHOTS = path.resolve("tests/screenshots");

async function open(browser, w, h, toy, label, options) {
  const ctx = await browser.newContext({
    viewport: { width: w, height: h },
    ...(w < 600 ? { hasTouch: true, isMobile: true } : {}),
  });
  const page = await ctx.newPage();
  const problems = [];
  page.on("pageerror", (e) => problems.push(e.message));
  await page.goto("/?renderer=webgl2&profile=weak");
  await page.waitForSelector("body[data-ready='true']", { timeout: 180_000 });
  await page.evaluate((id) => window.__splashery.app.chooseToy(id), toy);
  await expect(page.locator("#toy-status")).toHaveText(new RegExp(`^${label}`), { timeout: 180_000 }); // prettier-ignore
  if (options) await page.evaluate((o) => window.__splashery.app.setToyOptions(o), options);
  await expect(page.locator("#toy-status")).toHaveText(new RegExp(`^${label}`), { timeout: 180_000 }); // prettier-ignore
  await page.waitForTimeout(1500);
  return { ctx, page, problems };
}

for (const [name, toy, label, options, wait] of [
  ["sorting-crates", "sorting-machine", "Sorting machine", { view: "crates", algo: "quick" }, 1700],
  ["sorting-ring", "sorting-machine", "Sorting machine", { view: "ring", algo: "heap" }, 2400],
  ["sorting-dots", "sorting-machine", "Sorting machine", { view: "dots", algo: "insertion" }, 2400],
  ["enigma-barbarossa", "enigma-machine", "Enigma machine", { preset: "barbarossa1" }, 7400],
]) {
  test(`${name}: mid-tap screenshots at 390x844 and 1440x900`, async ({ browser }) => {
    test.setTimeout(300_000);
    fs.mkdirSync(SHOTS, { recursive: true });
    for (const [w, h] of [
      [390, 844],
      [1440, 900],
    ]) {
      const { ctx, page, problems } = await open(browser, w, h, toy, label, options);
      await page.evaluate(() => window.__splashery.player.act(null));
      await page.waitForTimeout(wait);
      await page.screenshot({ path: path.join(SHOTS, `cmp2-${name}-${w}x${h}.png`) });
      expect(problems).toEqual([]);
      await ctx.close();
    }
  });
}

test("the Enigma's setting is set in the Toy tab, plugboard included", async ({ browser }) => {
  test.setTimeout(300_000);
  const { ctx, page, problems } = await open(browser, 1440, 900, "enigma-machine", "Enigma machine"); // prettier-ignore
  await page
    .locator("#tab-play")
    .first()
    .click()
    .catch(() => {});
  const selects = page.locator("#toy-options select");
  // Setting, three rotors, reflector, three rings, three starts.
  await expect(selects).toHaveCount(11);
  await selects.nth(1).selectOption("V");
  await expect(page.locator("#toy-options select").nth(1)).toHaveValue("V", { timeout: 120_000 });
  const plugs = page.locator("#toy-options input.option-text");
  await expect(plugs).toHaveValue("AR GK OX");
  await plugs.fill("QW ER TY");
  await plugs.press("Enter");
  await expect
    .poll(() => page.evaluate(() => window.__splashery.player.motion.ctx?.kit?.data?.line), {
      timeout: 120_000,
    })
    .toBe("V II III   UKW B   RINGS 01 01 01   START AAA   PLUGS QW ER TY");
  // A preset hides the rest of the setting.
  await page.locator("#toy-options select").first().selectOption("barbarossa2");
  await expect(page.locator("#toy-options select")).toHaveCount(1, { timeout: 120_000 });
  await expect(page.locator("#toy-options input.option-text")).toHaveCount(0);
  expect(problems).toEqual([]);
  await ctx.close();
});
