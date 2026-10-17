// Task 101: independent screen checks, with all original cases and sizes.
import { test, expect } from "@playwright/test";

import { buildRecipe } from "../src/kit.js";
import { applyClay, PROFILES } from "../src/generators.js";

import { openScreen, settle, tapAt, ON_TIME, OFF_TIME } from "./scr2-helpers.mjs";

test("a GIF holds its frame while the set is off, and plays on when it comes back on", async ({
  page,
}) => {
  await openScreen(page, { style: "flat", sample: "gif" });
  // The frames shown over `sec` seconds of the player's clock (the GIF's
  // clock), however slow the renderer is.
  const frames = (sec) =>
    page.evaluate(async (sec) => {
      const pl = window.__splashery.player;
      const seen = new Set();
      const t0 = pl.time;
      const w0 = performance.now();
      while (pl.time - t0 < sec && performance.now() - w0 < 60_000) {
        pl.stage.requestRender();
        await new Promise((r) => setTimeout(r, 30));
        seen.add(pl.pictures.gifFrame);
      }
      return [...seen];
    }, sec);
  // Off from the start: held.
  expect((await frames(1.5)).length).toBe(1);
  await page.evaluate(() => window.__splashery.player.act());
  await settle(page, ON_TIME.flat + 0.2);
  expect((await frames(2)).length).toBeGreaterThan(2);
  // Off again: it stops on the frame it showed.
  await page.evaluate(() => window.__splashery.player.act());
  await settle(page, 0.3);
  const held = await frames(2);
  expect(held.length).toBe(1);
  expect(await page.evaluate(() => window.__splashery.player.pictures.api.held)).toBe(true);
});

test("a tap on the old TV's power knob switches it off; a tap on the picture plays and pauses", async ({
  page,
}) => {
  await openScreen(page, { style: "tv", sample: "video" });
  const playing = () => page.evaluate(() => window.__splashery.player.pictures.info().playing);
  // Off: a tap anywhere switches it on (here, the picture).
  await tapAt(page, [-0.32, 0.12, 0.3]);
  await page.waitForFunction(() => window.__splashery.player.pictures.info().playing);
  await settle(page, ON_TIME.tv + 0.2);
  // On: a tap on the picture pauses, and again plays.
  await tapAt(page, [-0.32, 0.12, 0.3]);
  await page.waitForFunction(() => !window.__splashery.player.pictures.info().playing);
  await tapAt(page, [-0.1, 0.3, 0.3]);
  await page.waitForFunction(() => window.__splashery.player.pictures.info().playing);
  // The power knob switches it off: the video pauses and the picture hides.
  await tapAt(page, [0.72, 0.42, 0.26]);
  await page.waitForFunction(() => !window.__splashery.player.pictures.info().playing);
  await settle(page, OFF_TIME.tv + 0.2);
  expect(await page.evaluate(() => window.__splashery.player.motion.out.sheets.screen.visible)).toBe(0); // prettier-ignore
  // Paused where it was (the sample loops, so compare with itself).
  const offAt = await page.evaluate(() => window.__splashery.player.pictures.api.time);
  await page.waitForTimeout(1200);
  expect(await page.evaluate(() => window.__splashery.player.pictures.api.time)).toBe(offAt);
  // And on again, playing on from there.
  await tapAt(page, [0.72, 0.42, 0.26]);
  await page.waitForFunction(() => window.__splashery.player.pictures.info().playing);
  expect(await playing()).toBe(true);
});

test("the flat TV's button, the cinema's curtains and the hologram's base switch them off", async ({
  page,
}) => {
  const cases = [
    ["flat", [0.07, -0.453, 0.05]],
    ["cinema", [-1.5, 0.6, -0.4]],
    ["hologram", [0, -0.8, 0.5]],
  ];
  for (const [style, point] of cases) {
    await openScreen(page, { style, sample: "gif" });
    // The Toy tab's button names what it does.
    const label = await page.evaluate(() => window.__splashery.player.toyInfo.recipe.action.label);
    expect(label).toBe(style === "cinema" ? "Open or close the curtains" : "Switch on or off");
    await page.evaluate(() => window.__splashery.player.act());
    await settle(page, ON_TIME[style] + 0.2);
    expect(await page.evaluate(() => window.__splashery.player.motion.out.sheets.screen.visible)).toBe(1); // prettier-ignore
    await tapAt(page, point);
    expect(await page.evaluate(() => window.__splashery.player.motion.tap.pick), style).toBe(1);
    await settle(page, OFF_TIME[style] + 0.2);
    expect(await page.evaluate(() => window.__splashery.player.motion.out.sheets.screen.visible), style).toBe(0); // prettier-ignore
  }
});

test("every style builds within its tier's budget, at full density, quickly", async () => {
  const { RECIPES } = await import("../src/packs/screens.js");
  const r = RECIPES.screen;
  for (const style of ["tv", "flat", "cinema", "hologram"])
    for (const [tier, prof] of Object.entries(PROFILES)) {
      const count = Math.round(Math.min(prof.maxCount, prof.defaultCount * r.density));
      const t0 = Date.now();
      const it = buildRecipe(r, { seed: 5, count, options: { style } }, applyClay);
      let b = it.next();
      while (!b.done) b = it.next();
      const ctx = b.value;
      const what = `${style} at ${tier}`;
      expect(ctx.buf.count, what).toBeLessThanOrEqual(prof.maxCount);
      // Holes (the picture's opening, cut-outs) drop a few of the budget's
      // splats; the rest is used.
      expect(ctx.buf.count, what).toBeGreaterThan(count * 0.75);
      expect(ctx.parts.length, what).toBeLessThanOrEqual(16);
      expect(Date.now() - t0, what).toBeLessThan(4000);
      const pos = ctx.buf.pos.subarray(0, ctx.buf.count * 3);
      expect(pos.every(Number.isFinite), what).toBe(true);
    }
});
