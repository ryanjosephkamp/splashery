// Lane Baked engine (docs/handoff/BakedEngine.md): the Baked chest (labs) in the app: the budget
// picks its tier, it renders at phone and desktop sizes, and a tap swings its lid open as one
// piece. The format, converter and checker are tested in tests/bkd-format.spec.mjs.

import { test, expect } from "@playwright/test";

const APP = (profile) => `/?renderer=webgl2&adapt=off&profile=${profile}&labs=1`;

async function open(page, profile) {
  const errors = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.goto(APP(profile));
  await page.waitForSelector("body[data-ready='true']", { timeout: 180_000 });
  await page.evaluate(() => window.__splashery.app.chooseToy("baked-chest"));
  await page.waitForFunction(() => window.__splashery.player.toyInfo?.id === "baked-chest" && window.__splashery.player.proc?.ctx?.kit?.data?.tier, null, { timeout: 90_000 }); // prettier-ignore
  await page.evaluate(async () => {
    const { app } = window.__splashery;
    while (app.busy) await new Promise((r) => setTimeout(r, 50));
  });
  return errors;
}

const lidAngle = (page) =>
  page.evaluate(() => window.__splashery.player.motion.out.parts?.lid?.angle ?? 0);

test("the budget picks the tier: 30,000 splats on a low device, 100,001 on a mid one", async ({
  page,
}) => {
  for (const [profile, splats] of [
    ["low", 30000],
    ["mid", 100001],
  ]) {
    const errors = await open(page, profile);
    const tier = await page.evaluate(() => window.__splashery.player.proc.ctx.kit.data.tier);
    expect(tier).toEqual({ splats, used: splats });
    expect(await page.evaluate(() => window.__splashery.player.proc.ctx.buf.count)).toBe(splats);
    expect(errors).toEqual([]);
  }
});

test("renders at 390×844 and 1440×900, and a tap swings the lid open and shut", async ({
  browser,
}) => {
  test.setTimeout(300_000);
  for (const [w, h] of [
    [390, 844],
    [1440, 900],
  ]) {
    const page = await browser.newPage({ viewport: { width: w, height: h } });
    const errors = await open(page, "mid");
    await page.waitForTimeout(800);
    const closed = await page.screenshot();
    await page.screenshot({ path: `tests/screenshots/bkd-baked-chest-${w}x${h}.png` });
    expect(await lidAngle(page)).toBeCloseTo(0, 3);
    await page.evaluate(() => window.__splashery.player.act(null));
    await page.waitForFunction(() => (window.__splashery.player.motion.out.parts?.lid?.angle ?? 0) < -1.84, null, { timeout: 20_000 }); // prettier-ignore
    await page.waitForTimeout(300);
    const opened = await page.screenshot();
    if (w === 390) await page.screenshot({ path: `tests/screenshots/bkd-baked-chest-open-${w}x${h}.png` }); // prettier-ignore
    // The open lid changes the picture (it stands up behind the chest).
    expect(Buffer.compare(closed, opened)).not.toBe(0);
    await page.evaluate(() => window.__splashery.player.act(null));
    await page.waitForFunction(() => Math.abs(window.__splashery.player.motion.out.parts?.lid?.angle ?? 1) < 1e-3, null, { timeout: 20_000 }); // prettier-ignore
    expect(errors).toEqual([]);
    await page.close();
  }
});
