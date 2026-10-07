// Lane Fix9: the owner's walkthrough fixes (October 6, 2026). The cherries swing like a small
// Newton's cradle at real speed; the soda can's suds spill over and run down; a tap anywhere in
// Data in 3D's plot box plays its tap.

import { test, expect } from "@playwright/test";

const APP = "/?renderer=webgl2&adapt=off&profile=weak&labs=1";

async function open(page, id) {
  await page.goto(APP);
  await page.waitForSelector("body[data-ready='true']", { timeout: 180_000 });
  await page.evaluate((id) => window.__splashery.app.chooseToy(id), id);
  await page.waitForFunction((id) => window.__splashery.player.toyInfo?.id === id, id);
  await page.waitForTimeout(800);
}

// Taps the canvas at a recipe point; resolves with the actions the tap ran.
async function tapAt(page, p) {
  return page.evaluate(async (p) => {
    const { app, player } = window.__splashery;
    const acts = [];
    const on = (r) => acts.push(r.key);
    player.on("action", on);
    const [x, y] = player.screenPoint(p);
    const r = player.canvas.getBoundingClientRect();
    await app.tapToy({ clientX: r.left + x, clientY: r.top + y });
    const l = player.listeners.action;
    l.splice(l.indexOf(on), 1);
    return acts;
  }, p);
}

test("the cherries knock back and forth at a pendulum's real pace", async () => {
  const src = await import("../src/packs/food.js");
  const r = src.RECIPES.cherries;
  // A 4.5 cm stem swings with a period near 0.43 s, so the knocks come about every 0.21 s
  // (half a period), many of them, each a little softer, the first right after the flick.
  const c = { swing: 0 };
  const knocks = [];
  for (let s = 0; s < 3.6; s += 1 / 120) {
    const o = { parts: {}, cues: [] };
    c.swing = 1 - s / 3.6;
    r.drive(0, c, o, {});
    if (o.cues.length) knocks.push(s);
  }
  expect(knocks.length).toBeGreaterThanOrEqual(8);
  const gaps = knocks.slice(1, 6).map((t, i) => t - knocks[i]);
  for (const g of gaps) {
    expect(g).toBeGreaterThan(0.17);
    expect(g).toBeLessThan(0.26);
  }
  expect(knocks[0]).toBeLessThan(0.3);
});

test("a tap anywhere in Data in 3D's plot box plays its tap", async ({ page }) => {
  await open(page, "data-in-3d");
  const box = await page.evaluate(() => window.__splashery.player.motion.ctx.kit.data.tapBox);
  expect(box).toBeTruthy();
  // High in the box's middle, where no point stands: the drop and rise plays.
  const mid = [0, box.max[1] - 0.45, 0];
  expect(await tapAt(page, mid)).toEqual(["rise"]);
});

test("the soda can's suds show after the tap and are gone at its end", async ({ page }) => {
  await open(page, "soda-can");
  const at = (s) =>
    page.evaluate((s) => {
      const { player } = window.__splashery;
      const r = player.motion.ctx.recipe || player.toyInfo.recipe;
      const out = { parts: {}, cues: [], tokens: null, morph: null };
      r.drive(0, { open: 1 - s / 4.0 }, out, { data: player.motion.ctx.kit.data, view: 0 });
      return { suds: out.parts.suds, spill: out.morph[1] };
    }, s);
  const before = await at(0.5);
  expect(before.suds.visible).toBe(0);
  const mid = await at(2.4);
  expect(mid.suds.visible).toBe(1);
  expect(mid.spill).toBeGreaterThan(0.7);
  const end = await at(3.8);
  expect(end.suds.visible).toBeLessThan(0.01);
});

test("the Fluid lab warns a phone that can't keep up, and offers a lighter mode", async ({
  page,
}) => {
  // On a computer that keeps up: no warning.
  await open(page, "fluid-lab");
  await page.waitForTimeout(2500);
  await expect(page.locator("#fluid-slow")).toHaveCount(0);
  // A slow phone (?slow=1 plays one at 8 frames a second): the warning comes in its first
  // seconds, and Lighter rebuilds it at the lowest tier.
  await page.goto("/?renderer=webgl2&adapt=off&labs=1&slow=1");
  await page.waitForSelector("body[data-ready='true']", { timeout: 180_000 });
  // (from the high tier, so Lighter has somewhere to go)
  await page.evaluate(() => {
    const { app, player } = window.__splashery;
    player.setProfile("high");
    return app.chooseToy("fluid-lab");
  });
  await expect(page.locator("#fluid-slow")).toBeVisible({ timeout: 60_000 });
  await expect(page.locator("#fluid-slow .link-confirm-text")).toHaveText(
    "This lab is running slowly on this phone.",
  );
  await page.click("#fluid-slow-lighter");
  await expect(page.locator("#fluid-slow")).toBeHidden();
  await expect.poll(() => page.evaluate(() => window.__splashery.player.profile)).toBe("low");
});
