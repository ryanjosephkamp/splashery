// Lane Hands-on H3, the crossbow (docs/HANDS-ON-PLAN.md, Medieval): with the
// ✋ switch on it starts cocked, the string caught on its latch; a tap pulls
// the trigger and the string snaps forward as the bolt flies; pulled back to
// the latch, it clicks cocked again with a new bolt.

import { test, expect } from "@playwright/test";

const APP = "/?renderer=webgl2&adapt=off&profile=mid";

const tick = (page, secs) =>
  page.evaluate(
    (n) => {
      const { player } = window.__splashery;
      const step = player.tickFixed || player.update.bind(player);
      for (let i = 0; i < n; i++) step(1 / 60);
    },
    Math.round(secs * 60),
  );

const state = (page) =>
  page.evaluate(() => {
    const { player } = window.__splashery;
    const j = player.handsOn.joints.list[0];
    const bolt = player.motion.handsParts?.bolt ?? null;
    return { v: j.v, max: j.max, latched: !!j.latched, bolt };
  });

test("crossbow: a tap lets the string go and the bolt fly; drawn back, it clicks cocked", async ({
  page,
}) => {
  await page.goto(APP);
  await page.waitForSelector("body[data-ready='true']", { timeout: 180_000 });
  await page.evaluate(async () => {
    const { app, player } = window.__splashery;
    await app.chooseToy("crossbow");
    player.opts.idleDelay = 1e9;
  });
  await page.waitForTimeout(800);
  await page.click("#hands-toggle");
  // The clock stops: only tick() steps it, so a loaded machine sees the
  // same frames.
  await page.evaluate(() => {
    const { player } = window.__splashery;
    player.handsOn.ensure();
    player.tickFixed ||= player.update.bind(player);
    player.update = () => {};
  });
  await tick(page, 0.1);
  let s = await state(page);
  expect(s.latched).toBe(true);
  expect(s.v).toBeCloseTo(0, 4);
  // A tap: the trigger, not the toy's own shot.
  const key = await page.evaluate(() => window.__splashery.player.act().key);
  expect(key).toBe("trigger");
  await tick(page, 0.15);
  s = await state(page);
  expect(s.latched).toBe(false);
  expect(s.v).toBeGreaterThan(0.5 * s.max);
  expect(s.bolt.visible).toBe(1);
  expect(Math.hypot(...s.bolt.offset)).toBeGreaterThan(0.3); // in flight
  await tick(page, 1);
  s = await state(page);
  expect(s.v).toBeCloseTo(s.max, 2); // at rest, straight across
  expect(s.bolt.visible).toBe(0); // flown
  // Drawn back by the string's middle to the latch: it catches there.
  const px = await page.evaluate(() => {
    const { player } = window.__splashery;
    const j = player.handsOn.joints.list[0];
    const r = player.stage.canvas.getBoundingClientRect();
    // The string's middle now (its turn T applied: q x + t), and where it
    // was built, drawn back to the latch.
    const T = player.handsOn.joints.full(j);
    const mid = j.pc.home.pos;
    const [x, y, z, w] = T.q;
    const u = [2 * (y * mid[2] - z * mid[1]), 2 * (z * mid[0] - x * mid[2]), 2 * (x * mid[1] - y * mid[0])]; // prettier-ignore
    const cr = [y * u[2] - z * u[1], z * u[0] - x * u[2], x * u[1] - y * u[0]];
    const now = [0, 1, 2].map((i) => mid[i] + w * u[i] + cr[i] + T.t[i]);
    const at = (p) => {
      const q = player.screenPoint(p);
      return [r.left + q[0], r.top + q[1]];
    };
    return [at(now), at(mid)];
  });
  // (A real press; the moves go straight to Hands-on, two clock steps each.)
  await page.mouse.move(...px[0]);
  await page.mouse.down();
  await page.waitForFunction(() => {
    const ho = window.__splashery.player.handsOn;
    return !!(ho.press || ho.hold);
  });
  await page.evaluate((px) => {
    const { player } = window.__splashery;
    const r = player.stage.canvas.getBoundingClientRect();
    for (let i = 1; i <= 25; i++) {
      const f = Math.min(1, (i / 20) * 1.1);
      player.handsOn.moveTo(px[0][0] + (px[1][0] - px[0][0]) * f - r.left, px[0][1] + (px[1][1] - px[0][1]) * f - r.top); // prettier-ignore
      player.tickFixed(1 / 60);
      player.tickFixed(1 / 60);
    }
    player.handsOn.release();
  }, px);
  await page.mouse.up();
  await tick(page, 0.6);
  s = await state(page);
  expect(s.latched).toBe(true);
  expect(s.v).toBeCloseTo(0, 4);
  expect(s.bolt.visible).toBe(1); // a new bolt in the groove
});
