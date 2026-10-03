// Lane Sharpness A, the storybook (docs/OPERATING.md): it builds at the
// phone tier within its budget; the words on its two open pages are ink
// dots laid on the font's pixels; and it sorts its turned leaves and cover
// where they stand (splats sort in the closed pose they were built in, so
// the turned left page's paper would draw over its words).

import { test, expect } from "@playwright/test";
import fs from "node:fs";
import path from "node:path";
import { buildRecipe } from "../src/kit.js";
import { PROFILES } from "../src/generators.js";

function build(recipe, tier = PROFILES.mid) {
  const options = {};
  for (const o of recipe.options || []) options[o.key] = o.default;
  const count = Math.round(Math.min(tier.maxCount, tier.defaultCount * (recipe.density ?? 1)));
  const it = buildRecipe(recipe, { seed: 7, count, options }, () => {});
  let r = it.next();
  while (!r.done) r = it.next();
  return { buf: r.value.buf, count, tier };
}

test("the storybook builds at the phone tier, within its budget", async () => {
  const { RECIPES } = await import("../src/packs/objects.js");
  const { buf, count, tier } = build(RECIPES.book);
  expect(buf.count).toBeGreaterThan(count * 0.5);
  expect(buf.count).toBeLessThanOrEqual(tier.maxCount * 1.1);
  for (let i = 0; i < buf.count * 3; i++)
    if (!Number.isFinite(buf.pos[i])) throw new Error(`splat ${i / 3} is not finite`);
});

test("the storybook's open pages carry their words as ink dots", async () => {
  const { RECIPES } = await import("../src/packs/objects.js");
  const { buf } = build(RECIPES.book);
  // Ink dots: the ink color at full opacity.
  let ink = 0;
  for (let i = 0; i < buf.count; i++) {
    const r = buf.color[i * 4];
    const g = buf.color[i * 4 + 1];
    const b = buf.color[i * 4 + 2];
    if (Math.abs(r - 0x2f / 255) < 0.01 && Math.abs(g - 0x2a / 255) < 0.01 && Math.abs(b - 0x26 / 255) < 0.01) ink++; // prettier-ignore
  }
  expect(ink).toBeGreaterThan(5000);
});

test("the storybook sorts its turned leaves where they stand", async () => {
  // drive() asks for a sort on the first frame and while the book moves,
  // each time on the frame after too.
  const { RECIPES } = await import("../src/packs/objects.js");
  const info = { data: {} };
  const frame = (open) => {
    const out = { parts: {} };
    RECIPES.book.drive(0, { open }, out, info);
    return !!out.resortPose;
  };
  expect(frame(1)).toBe(true); // first frame, open
  expect(frame(1)).toBe(true); // and the frame after
  expect(frame(1)).toBe(false); // nothing moved
  expect(frame(0.5)).toBe(true); // closing
  expect(frame(0.5)).toBe(true);
  expect(frame(0.5)).toBe(false);
  expect(frame(0)).toBe(true); // closed
});

// Screenshots of the open storybook, at phone and desktop size.
const SHOTS = path.join(path.dirname(new URL(import.meta.url).pathname), "screenshots");
test("storybook screenshots at 390x844 and 1440x900", async ({ browser }) => {
  fs.mkdirSync(SHOTS, { recursive: true });
  for (const [w, h, mobile] of [
    [390, 844, true],
    [1440, 900, false],
  ]) {
    const ctx = await browser.newContext({
      viewport: { width: w, height: h },
      ...(mobile ? { hasTouch: true, isMobile: true } : {}),
    });
    const page = await ctx.newPage();
    const problems = [];
    page.on("pageerror", (e) => problems.push(e.message));
    await page.goto("/?renderer=webgl2&profile=weak");
    await page.waitForSelector("body[data-ready='true']", { timeout: 180_000 });
    await page.evaluate(() => window.__splashery.app.chooseToy("book"));
    await expect(page.locator("#toy-status")).toHaveText(/^Storybook/, { timeout: 180_000 });
    await page.waitForTimeout(2000);
    await page.screenshot({ path: path.join(SHOTS, `sha-book-${w}x${h}.png`) });
    expect(problems).toEqual([]);
    await ctx.close();
  }
});
