// Lane Fix9 (engine): a toy whose recipe leaves a tap box in its data (k.data.tapBox, recipe
// coordinates) takes a tap anywhere in that box, not only on a splat (Data in 3D's empty plot
// box between its axes). A toy without one ignores a tap off its splats, as before.

import { test, expect } from "@playwright/test";

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

test("a tap in a toy's tap box plays its effect; without one it does nothing", async ({ page }) => {
  await page.goto("/?renderer=webgl2&profile=weak");
  await page.waitForSelector("body[data-ready='true']", { timeout: 180_000 });
  await page.evaluate(() => window.__splashery.app.chooseToy("cherries"));
  await page.waitForTimeout(800);
  // Well left of the cherries: no splat there.
  const off = [-1.9, 0.2, 0];
  expect(await tapAt(page, off)).toEqual([]);
  await page.evaluate(() => {
    const { player } = window.__splashery;
    (player.motion.ctx.kit.data ||= {}).tapBox = { min: [-2.4, -1, -0.3], max: [-1.5, 1.2, 0.3] };
  });
  expect(await tapAt(page, off)).toEqual(["swing"]);
  // Outside the box (and off the toy), still nothing.
  expect(await tapAt(page, [1.9, 1.3, 0])).toEqual([]);
});
