// Lane Hands-on H3, the Pictures and pages shelf (docs/HANDS-ON-PLAN.md):
// with the ✋ switch on, the picture frame swings on its nail when pushed.
// (The other picture toys stay out of Hands-on, as the plan says.)

import { test, expect } from "@playwright/test";

const APP = "/?renderer=webgl2&adapt=off&profile=mid&labs=1";

async function ready(page, id) {
  await page.goto(APP);
  await page.waitForSelector("body[data-ready='true']", { timeout: 180_000 });
  await page.evaluate(async (id) => {
    const { app, player } = window.__splashery;
    await app.chooseToy(id);
    player.opts.idleDelay = 1e9;
  }, id);
  await page.waitForTimeout(800);
  if (!(await page.evaluate(() => window.__splashery.player.handsOn.on)))
    await page.click("#hands-toggle");
  // (Hands-on builds its world on the first touch: build it now, to read
  // the joints before any drag.)
  // The clock stops: only tick() steps it, so a loaded machine sees the
  // same frames.
  await page.evaluate(() => {
    const { player } = window.__splashery;
    player.handsOn.ensure();
    player.tickFixed ||= player.update.bind(player);
    player.update = () => {};
  });
  await tick(page, 0.1);
}

// Steps the clock by hand (SwiftShader draws slowly).
const tick = (page, secs) =>
  page.evaluate(
    (n) => {
      const { player } = window.__splashery;
      const step = player.tickFixed || player.update.bind(player);
      for (let i = 0; i < n; i++) step(1 / 60);
    },
    Math.round(secs * 60),
  );

// A finger drag through recipe points (each a place on screen): a real
// press (the app picks what is under it and hands it to Hands-on), then the
// moves straight to Hands-on, two clock steps per move (on a loaded machine
// the browser's own moves come late and in bunches).
async function drag(page, points, { steps = 20, hold = false, held = false } = {}) {
  const px = await page.evaluate((pts) => {
    const { player } = window.__splashery;
    const r = player.stage.canvas.getBoundingClientRect();
    return pts.map((p) => {
      const s = player.screenPoint(p);
      return [r.left + s[0], r.top + s[1]];
    });
  }, points);
  if (!held) {
    await page.mouse.move(...px[0]);
    await page.mouse.down();
    await page.waitForFunction(() => {
      const ho = window.__splashery.player.handsOn;
      return !!(ho.press || ho.hold);
    });
  }
  await page.evaluate(
    ({ px, steps }) => {
      const { player } = window.__splashery;
      const r = player.stage.canvas.getBoundingClientRect();
      for (let k = 1; k < px.length; k++)
        for (let i = 1; i <= steps; i++) {
          const f = i / steps;
          const [a, b] = [px[k - 1], px[k]];
          player.handsOn.moveTo(
            a[0] + (b[0] - a[0]) * f - r.left,
            a[1] + (b[1] - a[1]) * f - r.top,
          );
          player.tickFixed(1 / 60);
          player.tickFixed(1 / 60);
        }
    },
    { px, steps },
  );
  if (!hold) {
    await page.evaluate(() => window.__splashery.player.handsOn.release());
    await page.mouse.up();
  }
}

const joints = (page) => page.evaluate(() => window.__splashery.player.handsOn.joints?.state());
const joint = async (page, name) => (await joints(page)).find((j) => j.name === name);
const events = (page) =>
  page.evaluate(() => window.__splashery.player.handsOn.joints.events.map((e) => e.kind));
const parts = (page) => page.evaluate(() => window.__splashery.player.motion.handsParts || {});

async function reset(page) {
  await page.click("#hands-reset");
  await tick(page, 1.2);
}

test("picture frame: pushed, it swings on its nail and settles hanging level", async ({ page }) => {
  await ready(page, "picture-frame");
  await page.waitForTimeout(1500); // (its photo loads)
  await drag(page, [
    [0.3, -0.2, 0.05],
    [0.75, -0.1, 0.05],
  ]);
  const swing = [];
  for (let i = 0; i < 30; i++) {
    await tick(page, 0.1);
    swing.push((await joint(page, "frame")).v);
  }
  expect(Math.max(...swing)).toBeGreaterThan(0.08);
  expect(Math.min(...swing)).toBeLessThan(-0.04);
  await tick(page, 20);
  expect(Math.abs((await joint(page, "frame")).v)).toBeLessThan(0.02);
});

test("pictures: the other picture toys stay out of Hands-on", async ({ page }) => {
  await page.goto(APP);
  await page.waitForSelector("body[data-ready='true']", { timeout: 180_000 });
  for (const id of ["your-book", "photo-album"]) {
    const r = await page.evaluate(async (id) => {
      const { app, player } = window.__splashery;
      await app.chooseToy(id);
      document.getElementById("hands-toggle")?.click();
      return player.handsOn.on;
    }, id);
    expect(r).toBe(false);
  }
});
