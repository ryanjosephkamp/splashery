// Lane Kit lab (docs/handoff/KitLab.md): the Detail slider, labs only. It sets
// a kit toy's splat count directly; the nearest tier sets the rest; it never
// goes into links; with labs off it is hidden and ignored.

import { test, expect } from "@playwright/test";

async function open(page, query) {
  const errors = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.goto(`/?renderer=webgl2&adapt=off${query}`);
  await page.waitForSelector("body[data-ready='true']", { timeout: 180_000 });
  await page.evaluate(() => window.__splashery.app.chooseToy("clock"));
  return errors;
}

const info = (page) =>
  page.evaluate(() => {
    const { player } = window.__splashery;
    return {
      splats: player.toyInfo.splats,
      profile: player.profile,
      slider: player.splats,
      stored: localStorage.getItem("splashery.splats"),
      hash: location.hash,
    };
  });

test("labs off: the slider is hidden and a stored count is ignored", async ({ page }) => {
  await page.addInitScript(() => localStorage.setItem("splashery.splats", "300000"));
  const errors = await open(page, "&profile=mid");
  await expect(page.locator("#look-splats-row")).toBeHidden();
  const r = await info(page);
  expect(r.slider).toBeNull();
  expect(r.splats).toBeGreaterThan(130_000);
  expect(r.splats).toBeLessThan(150_000);
  expect(errors).toEqual([]);
});

test("labs on: the slider sets the count, stays out of links, and a button clears it", async ({
  page,
}) => {
  const errors = await open(page, "&labs=1");
  await expect(page.locator("#look-splats-row")).toBeAttached();
  expect(await page.locator("#look-splats-row").getAttribute("hidden")).toBeNull();
  const before = await info(page);

  await page.evaluate(() => window.__splashery.app.setSplats(260_000));
  await page.waitForFunction(() => window.__splashery.player.toyInfo?.splats > 240_000);
  const slid = await info(page);
  expect(slid.slider).toBe(260_000);
  expect(slid.profile).toBe("max"); // 280,000 is the nearest tier's usual count
  expect(slid.splats).toBeGreaterThan(250_000);
  expect(slid.splats).toBeLessThan(270_000);
  expect(slid.stored).toBe("260000");
  expect(slid.hash).not.toContain("260");
  expect(await page.locator("#look-splats-value").textContent()).toBe("260k");
  for (const b of await page.locator("#look-detail button").all())
    expect(await b.getAttribute("aria-pressed")).toBe("false");

  // A Detail button puts the tiers back.
  await page.evaluate(() => window.__splashery.app.setDetail("auto"));
  await page.waitForFunction(() => !window.__splashery.player.splats);
  await page.waitForFunction(() => window.__splashery.player.toyInfo?.splats < 240_000);
  const back = await info(page);
  expect(back.stored).toBeNull();
  expect(back.profile).toBe(before.profile);
  expect(back.splats).toBe(before.splats);
  expect(errors).toEqual([]);
});

test("labs on with a forced tier: the count changes, the tier does not", async ({ page }) => {
  const errors = await open(page, "&labs=1&profile=low");
  await page.evaluate(() => window.__splashery.app.setSplats(200_000));
  await page.waitForFunction(() => window.__splashery.player.toyInfo?.splats > 180_000);
  const r = await info(page);
  expect(r.profile).toBe("low");
  expect(r.splats).toBeLessThan(210_000);
  // The nearest tier, by usual count.
  const tiers = await page.evaluate(async () => {
    const { nearestTier } = await import("/src/player.js");
    return [60_000, 100_000, 101_000, 170_000, 171_000, 240_000, 241_000, 400_000].map(nearestTier);
  });
  expect(tiers).toEqual(["low", "low", "mid", "mid", "high", "high", "max", "max"]);
  expect(errors).toEqual([]);
});

// The gloss (docs/lab/GLOSS.md): its own shader variant, only with labs on and
// only for a toy that asks (a recipe's gloss, or ?gloss=).
test("gloss: the kit's program is untouched; the variant only where asked", async ({ page }) => {
  const { MODIFIER_KIT, MODIFIER_KIT_GLOSS } = await import("../src/effects.js");
  for (const lang of ["glsl", "wgsl"]) {
    expect(MODIFIER_KIT[lang]).not.toContain("uSpGloss");
    expect(MODIFIER_KIT_GLOSS[lang]).toContain("uSpGloss");
  }
  // pickGloss is read in the page (player.js needs a browser).
  const errors = await open(page, "&labs=1&profile=mid&gloss=0.9,250");
  const r = await page.evaluate(async () => {
    const { pickGloss, GLOSS_DEFAULT } = await import("/src/player.js");
    const q = (s) => new URLSearchParams(s);
    return {
      on: window.__splashery.player.stage.toy.gloss,
      cases: [
        pickGloss(q("")),
        pickGloss(q("gloss=1")),
        pickGloss(q("gloss=0.6,120")),
        pickGloss(q("gloss=0"), { strength: 1 }),
        pickGloss(q(""), { strength: 1 }),
      ],
      def: GLOSS_DEFAULT,
    };
  });
  expect(r.on).toBe(true);
  expect(r.cases[0]).toBeNull();
  expect(r.cases[1]).toEqual(r.def);
  expect(r.cases[2]).toEqual({ strength: 0.6, sharpness: 120 });
  expect(r.cases[3]).toBeNull();
  expect(r.cases[4]).toEqual({ ...r.def, strength: 1 });
  expect(errors).toEqual([]);
});

test("gloss: off without labs, even with ?gloss=", async ({ page }) => {
  const errors = await open(page, "&profile=mid&gloss=1");
  expect(await page.evaluate(() => window.__splashery.player.stage.toy.gloss)).toBe(false);
  expect(errors).toEqual([]);
});

// The reader takes a longer limit only when its caller asks (the splat
// equation toy's 240 characters); everyone else keeps 120.
test("compile: maxLength is the caller's, 120 by default", async () => {
  const { compile } = await import("../src/equation.js");
  const long = Array.from({ length: 40 }, () => "x+1").join("+");
  expect(() => compile(long)).toThrow(/over 120 characters/);
  expect(compile(long, ["x"], { maxLength: 240 }).f({ x: 1 })).toBe(80);
  expect(() => compile(long + "+x".repeat(60), ["x"], { maxLength: 240 })).toThrow(/over 240/);
});
