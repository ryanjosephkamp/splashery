// Flat splats must agree on the photo's projection despite their depth offsets.
import { test, expect } from "@playwright/test";
import { engineTextFixture } from "../tools/cdx-p3d2-text.mjs";

test.use({ viewport: { width: 390, height: 844 } });
for (const [font, minimum] of [
  ["sans-serif", 0.93],
  ["DejaVu Sans", 0.9],
]) {
  test(`flattened photo-textured splats retain ${font} text fidelity`, async ({ page }) => {
    const errors = [];
    page.on("pageerror", (e) => errors.push(e.message));
    page.on("console", (m) => {
      if (m.type() === "error") errors.push(m.text());
    });
    await page.goto("/?renderer=webgl2&adapt=off&profile=mid&labs=1");
    await page.waitForSelector("body[data-ready='true']", { timeout: 180000 });
    const fixture = engineTextFixture(font === "sans-serif" ? "" : font);
    await fixture(page, "splats");
    const fine = await fixture(page, "photo");
    expect(fine.photo).toBe(true);
    expect(fine.toyPhoto).toBe(true);
    expect(fine.ncc).toBeGreaterThanOrEqual(minimum);
    expect(errors).toEqual([]);
  });
}
