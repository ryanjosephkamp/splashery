// Lane HelpTextA's own checks (docs/OPERATING.md): every toy on the science
// and nature shelves has a how-to line and an About text in src/toy-help.js,
// and the About tab shows a long one whole (the hta-about screenshots).

import { test, expect } from "@playwright/test";
import fs from "node:fs";
import path from "node:path";
import { TOYS } from "../src/toys.js";
import { TOY_HELP } from "../src/toy-help.js";

const SHOTS = "tests/screenshots";
const WEBGL = "/?renderer=webgl2&profile=weak&help=show";
const SHELVES = [
  "scans",
  "shapes",
  "space",
  "tiny",
  "atoms",
  "gems",
  "anatomy",
  "nature",
  "weather",
  "maths",
];

test("every toy on these shelves has a how-to line and an About text", () => {
  const toys = TOYS.filter((t) => SHELVES.includes(t.category));
  // The 149 toys this lane wrote; new labs toys on these shelves bring their own entries.
  expect(toys.filter((t) => !t.labs).length).toBe(149);
  for (const t of toys) {
    const e = TOY_HELP[t.id];
    expect(e, t.id).toBeTruthy();
    expect(e.howTo, t.id).toMatch(/^[A-Z].*\.$/);
    expect(e.howTo.length, `${t.id}: ${e.howTo}`).toBeLessThanOrEqual(95);
    const paras = e.about.split("\n\n");
    expect(paras.length, t.id).toBe(2);
    for (const p of paras) expect(p, t.id).toMatch(/^[A-Z"].*[.!"]$/);
    const words = e.about.split(/\s+/).length;
    expect(words, t.id).toBeGreaterThanOrEqual(60);
    expect(words, t.id).toBeLessThanOrEqual(140);
  }
});

for (const [w, h] of [
  [390, 844],
  [1440, 900],
]) {
  test(`a long About text shows whole at ${w}x${h}`, async ({ browser }) => {
    const ctx = await browser.newContext({ viewport: { width: w, height: h } });
    const page = await ctx.newPage();
    await page.goto(WEBGL);
    await page.waitForSelector("body[data-ready='true']", { timeout: 180_000 });
    await page.evaluate(() => window.__splashery.app.chooseToy("saguaro"));
    await expect(page.locator("#toy-status")).toHaveText(/^Saguaro cactus/, { timeout: 180_000 });
    await page.click("#help-line-about");
    await expect(page.locator("#pane-about")).toBeVisible();
    await expect(page.locator("#toy-about-name")).toHaveText("Saguaro cactus");
    const paras = TOY_HELP.saguaro.about.split("\n\n");
    await expect(page.locator("#toy-about-text p")).toHaveText(paras);
    await expect(page.locator("#toy-about-howto")).toHaveText(TOY_HELP.saguaro.howTo);
    fs.mkdirSync(SHOTS, { recursive: true });
    await page.screenshot({ path: path.join(SHOTS, `hta-about-${w}x${h}.png`) });
    await ctx.close();
  });
}
