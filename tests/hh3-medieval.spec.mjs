// Lane Hands-on H3, the Medieval shelf (docs/HANDS-ON-PLAN.md): with the ✋
// switch on, each piece measured over time: the knight's helmet's visor,
// the trebuchet's arm and stone, and the dragon egg's shell pieces.

import { test, expect } from "@playwright/test";

const APP = "/?renderer=webgl2&adapt=off&profile=mid";

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

test("knight's helmet: the visor lifted all the way stays up; let go low, it drops shut", async ({
  page,
}) => {
  await ready(page, "knights-helmet");
  // Halfway up and let go: it falls shut.
  await drag(page, [
    [0, -0.1, 0.62],
    [0, 0.25, 0.7],
  ]);
  await tick(page, 2);
  expect((await joint(page, "visor")).v).toBeCloseTo(0, 3);
  expect(await events(page)).toContain("stop");
  // All the way up: it stays.
  await drag(page, [
    [0, -0.1, 0.62],
    [0, 0.4, 0.6],
    [0, 0.75, 0.25],
    [0, 0.8, 0.05],
  ]);
  await tick(page, 2);
  expect((await joint(page, "visor")).v).toBeGreaterThan(1.3);
  await reset(page);
  expect((await joint(page, "visor")).v).toBeCloseTo(0, 3);
});

test("trebuchet: freed and let go, the weight drops, the arm whips up and the stone flies", async ({
  page,
}) => {
  await ready(page, "trebuchet");
  const tip = await page.evaluate(() => {
    const a = (46 * Math.PI) / 180;
    return [0.05 - Math.cos(a) * 0.8, 0.98 - Math.sin(a) * 0.8, 0];
  });
  await drag(page, [tip, [tip[0] + 0.02, tip[1] - 0.12, 0]], { steps: 10 });
  expect(await events(page)).toContain("free");
  const arm = [];
  let far = 0;
  for (let i = 0; i < 30; i++) {
    await tick(page, 0.05);
    arm.push((await joint(page, "arm")).v);
    const s = (await parts(page)).stone;
    if (s) far = Math.max(far, Math.hypot(s.offset[0], s.offset[1]));
  }
  expect(Math.min(...arm)).toBeLessThan(-2.2); // past the release angle
  expect(far).toBeGreaterThan(1.2); // the stone left the sling
  // It swings and settles hanging (the arm near upright, the weight down).
  await tick(page, 10);
  const v = (await joint(page, "arm")).v;
  expect(v).toBeGreaterThan(-2.6);
  expect(v).toBeLessThan(-2.1);
  await reset(page);
  expect((await joint(page, "arm")).v).toBeCloseTo(0, 3);
  const s = (await parts(page)).stone;
  if (s) expect(Math.hypot(...s.offset)).toBeLessThan(0.01);
});

test("dragon egg: each shell piece bends, snaps off and falls; the dragon rises as they go", async ({
  page,
}) => {
  await ready(page, "dragon-egg");
  const mids = await page.evaluate(() =>
    window.__splashery.player.handsOn.joints.state().map((j) => j.home),
  );
  let shown = [];
  // The two pieces facing the camera (the third is at the back).
  for (const i of [0, 2]) {
    const m = mids[i];
    const out = [m[0] * 3, m[1] + 0.3, m[2] * 3];
    await drag(page, [m, out], { steps: 15 });
    await tick(page, 1.5);
    const p = await parts(page);
    shown.push(p.dragon?.visible ?? 0);
  }
  const js = await joints(page);
  expect(js.filter((j) => j.broken).length).toBe(2);
  for (const j of js.filter((j) => j.broken)) expect(j.pos[1]).toBeLessThan(j.home[1]); // fell
  expect(shown[1]).toBeGreaterThan(0.5);
  expect(await events(page)).toContain("snap");
  await reset(page);
  expect((await joints(page)).every((j) => !j.broken)).toBe(true);
});
