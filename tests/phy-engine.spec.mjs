// Lane Physics's engine PR (docs/handoff/Physics.md): the XPBD engine in
// src/physics/world.js, Hands-on play in src/physics/hands-on.js and the
// Play / Hands-on / Reset buttons.

import { test, expect } from "@playwright/test";
import { World, Body, surfacePoints, quat, v3 } from "../src/physics/world.js";

const APP = "/?renderer=webgl2&adapt=off&profile=mid";

const run = (w, secs) => {
  for (let t = 0; t < secs && !w.asleep; t += 1 / 60) w.step(1 / 60);
};

test("the engine: a box lands flat and sleeps", () => {
  const w = new World({ gravity: [0, -30, 0] });
  w.plane([0, 1, 0], 0);
  const solid = { type: "box", half: [0.5, 0.3, 0.4] };
  const b = w.add(new Body({ pos: [0, 2, 0], quat: quat.axisAngle([1, 0.3, 0.2], 0.7), solid, points: surfacePoints(solid, 1) })); // prettier-ignore
  run(w, 6);
  expect(w.asleep).toBe(true);
  // It rests on one of its faces: its centre is one half-extent up.
  expect([0.3, 0.4, 0.5].some((h) => Math.abs(b.pos[1] - h) < 0.02)).toBe(true);
});

test("the engine: a stack of boxes stands; a careless one falls", () => {
  const stack = (off) => {
    const w = new World({ gravity: [0, -30, 0] });
    w.plane([0, 1, 0], 0);
    const solid = { type: "box", half: [0.5, 0.2, 0.5] };
    const bs = [];
    for (let i = 0; i < 4; i++) bs.push(w.add(new Body({ pos: [off * i, 0.2 + 0.4 * i, 0], solid, points: surfacePoints(solid, 2) }))); // prettier-ignore
    run(w, 6);
    return bs[3].pos[1];
  };
  expect(stack(0.05)).toBeGreaterThan(1.35);
  expect(stack(0.45)).toBeLessThan(1.0);
});

test("the engine: a ball rolls; a pendulum keeps its length", () => {
  const w = new World({ gravity: [0, -30, 0] });
  w.plane([0, 1, 0], 0);
  const ball = w.add(new Body({ pos: [0, 0.5, 0], solid: { type: "sphere", r: 0.5 } }));
  ball.vel = [3, 0, 0];
  for (let i = 0; i < 30; i++) w.step(1 / 60);
  expect(ball.pos[0]).toBeGreaterThan(0.5);
  expect(Math.abs(ball.pos[1] - 0.5)).toBeLessThan(0.02);
  expect(v3.len(ball.omega)).toBeGreaterThan(1); // rolling, not sliding
  const p = new World({ gravity: [0, -30, 0] });
  const bob = p.add(new Body({ pos: [1, 3, 0], solid: { type: "sphere", r: 0.2 } }));
  p.joint(bob, [0, 0, 0], null, [0, 3, 0], { length: 1 });
  let low = 3;
  for (let i = 0; i < 60; i++) {
    p.step(1 / 60);
    low = Math.min(low, bob.pos[1]);
    expect(Math.abs(v3.len(v3.sub(bob.pos, [0, 3, 0])) - 1)).toBeLessThan(0.01);
  }
  expect(low).toBeLessThan(2.1); // it swung through the bottom
});

async function ready(page, id) {
  await page.goto(APP);
  await page.waitForSelector("body[data-ready='true']", { timeout: 180_000 });
  await page.evaluate(async (id) => {
    const { app, player } = window.__splashery;
    await app.chooseToy(id);
    player.opts.idleDelay = 1e9;
  }, id);
  await page.waitForTimeout(800);
}

// Drags with the mouse from the toy's middle, `dx`, `dy` pixels.
async function drag(page, dx, dy, steps = 12) {
  const at = await page.evaluate(() => {
    const { player } = window.__splashery;
    const r = player.stage.canvas.getBoundingClientRect();
    const p = player.stage.toScreen(player.toyInfo.center);
    return [r.left + p[0], r.top + p[1]];
  });
  await page.mouse.move(at[0], at[1]);
  await page.mouse.down();
  for (let i = 1; i <= steps; i++) {
    await page.mouse.move(at[0] + (dx * i) / steps, at[1] + (dy * i) / steps);
    await page.waitForTimeout(20);
  }
  await page.mouse.up();
}

const hands = (page) => page.evaluate(() => window.__splashery.player.handsOn.state());

test("Hands-on is off on a scan: a drag turns the view; on, it picks the toy up", async ({
  page,
}) => {
  await ready(page, "cactus");
  await expect(page.locator("#hands-bar")).toBeVisible();
  await expect(page.locator("#hands-toggle")).toHaveAttribute("aria-pressed", "false");
  await expect(page.locator("#hands-reset")).toBeHidden();
  const yaw = await page.evaluate(() => window.__splashery.player.camera.tgt.yaw);
  await drag(page, 120, 0);
  expect(await page.evaluate(() => window.__splashery.player.camera.tgt.yaw)).not.toBeCloseTo(yaw, 2); // prettier-ignore
  expect((await hands(page)).moved).toBe(false);

  await page.click("#hands-toggle");
  await expect(page.locator("#hands-toggle")).toHaveAttribute("aria-pressed", "true");
  await expect(page.locator("#hands-reset")).toBeVisible();
  await drag(page, 60, -160);
  let s = await hands(page);
  expect(s.mode).toBe("toy");
  expect(s.moved).toBe(true);
  // It lands and settles away from home, with every number finite.
  // (The clock is stepped by hand: SwiftShader draws a big scan slowly.)
  await page.evaluate(() => {
    const { player } = window.__splashery;
    for (let i = 0; i < 900 && !player.handsOn.state().asleep; i++) player.update(1 / 60);
  });
  expect((await hands(page)).asleep).toBe(true);
  s = await hands(page);
  const b = s.bodies[0];
  expect([...b.pos, ...b.q].every(Number.isFinite)).toBe(true);
  expect(v3.len(v3.sub(b.pos, b.home))).toBeGreaterThan(0.05);
  // The toy's entity moved with it.
  const moved = await page.evaluate(() => {
    const e = window.__splashery.player.stage.toy.entity;
    return !!e.spBase;
  });
  expect(moved).toBe(true);

  // Reset sends it home and puts the entity back.
  await page.click("#hands-reset");
  await page.evaluate(() => {
    const { player } = window.__splashery;
    for (let i = 0; i < 60; i++) player.update(1 / 60);
  });
  expect((await hands(page)).moved).toBe(false);
  s = await hands(page);
  expect(v3.len(v3.sub(s.bodies[0].pos, s.bodies[0].home))).toBeLessThan(1e-6);
  expect(await page.evaluate(() => !!window.__splashery.player.stage.toy.entity.spBase)).toBe(false); // prettier-ignore
});

test("with Hands-on on, a tap still plays the toy, and Play does too", async ({ page }) => {
  await ready(page, "campfire");
  await page.click("#hands-toggle");
  const n0 = await page.evaluate(() => window.__splashery.player.motion.tap?.n ?? 0);
  const at = await page.evaluate(() => {
    const { player } = window.__splashery;
    const r = player.stage.canvas.getBoundingClientRect();
    const p = player.stage.toScreen(player.toyInfo.center);
    return [r.left + p[0], r.top + p[1]];
  });
  await page.mouse.click(at[0], at[1]);
  await expect.poll(() => page.evaluate(() => window.__splashery.player.motion.tap?.n ?? 0)).toBe(n0 + 1); // prettier-ignore
  expect((await hands(page)).moved).toBe(false);
  await page.click("#hands-play");
  await expect.poll(() => page.evaluate(() => window.__splashery.player.motion.tap?.n ?? 0)).toBe(n0 + 2); // prettier-ignore
});

test("toys that are hands-on already start on and keep their drags", async ({ page }) => {
  await ready(page, "gummy-bear");
  await expect(page.locator("#hands-toggle")).toHaveAttribute("aria-pressed", "true");
  // The gummy bear's own stretch, not a pick-up.
  await page.evaluate(() => {
    const { player } = window.__splashery;
    player.driver.grab.everOn = false;
    const g = player.driver.grabStart.bind(player.driver);
    player.driver.grabStart = (...a) => {
      player.driver.grab.everOn = true;
      return g(...a);
    };
  });
  await drag(page, 40, -40);
  expect(await page.evaluate(() => window.__splashery.player.driver.grab.everOn)).toBe(true);
  expect((await hands(page)).moved).toBe(false);
  // Off: the same drag turns the view.
  await page.click("#hands-toggle");
  const yaw = await page.evaluate(() => window.__splashery.player.camera.tgt.yaw);
  await drag(page, 120, 0);
  expect(await page.evaluate(() => window.__splashery.player.camera.tgt.yaw)).not.toBeCloseTo(yaw, 2); // prettier-ignore
});

test("a soft toy squishes when it lands; a link and a saved scene don't change", async ({
  page,
}) => {
  await ready(page, "blob");
  const before = await page.evaluate(() => JSON.stringify(window.__splashery.app.sceneJSON?.() ?? window.__splashery.player.scene)); // prettier-ignore
  await page.evaluate(() => window.__splashery.app.toggleHands());
  const squish = await page.evaluate(async () => {
    const { player } = window.__splashery;
    const h = player.handsOn;
    const c = player.stage.toScreen(player.toyInfo.center);
    player.pickDirty = true;
    const hit = await player.pickAt(c[0], c[1]);
    if (!h.pressAt(hit, c[0], c[1])) return -1;
    for (let i = 1; i <= 20; i++) {
      h.moveTo(c[0], c[1] - i * 12);
      player.update(1 / 60);
    }
    for (let i = 0; i < 10; i++) player.update(1 / 60);
    h.release();
    let most = 0;
    for (let i = 0; i < 120; i++) {
      player.update(1 / 60);
      const s = h.squishUniforms();
      if (s) most = Math.max(most, s.amount);
    }
    return most;
  });
  expect(squish).toBeGreaterThan(0.05);
  const after = await page.evaluate(() => JSON.stringify(window.__splashery.app.sceneJSON?.() ?? window.__splashery.player.scene)); // prettier-ignore
  expect(after).toBe(before);
});
