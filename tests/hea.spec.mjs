// Lane Hands engine A's demo toys (docs/handoff/HandsEngineA.md): the
// basketball, beach ball, water polo ball, sports car, snow globe and school
// of fish in Hands-on, from their own recipes' hands blocks.

import { test, expect } from "@playwright/test";

const APP = "/?renderer=webgl2&adapt=off&profile=mid";

async function open(page, id) {
  await page.goto(APP);
  await page.waitForSelector("body[data-ready='true']", { timeout: 180_000 });
  await page.evaluate(async (id) => {
    const { app, player } = window.__splashery;
    await app.chooseToy(id);
    player.opts.idleDelay = 1e9;
  }, id);
  await page.click("#hands-toggle");
}

test("basketball: its own bounce, and an upward flick spins it on the fingertip", async ({
  page,
}) => {
  await open(page, "basketball");
  const s = await page.evaluate(() => {
    const { player } = window.__splashery;
    const h = player.handsOn;
    const c = player.stage.toScreen(player.toyInfo.center);
    h.pressAt(player.toyInfo.center.slice(), c[0], c[1]);
    for (let k = 1; k <= 4; k++) {
      h.moveTo(c[0], c[1] - 10 * k);
      player.update(1 / 60);
    }
    // The flick: 100 pixels up in two frames, then the finger stays.
    h.moveTo(c[0], c[1] - 90);
    player.update(1 / 60);
    h.moveTo(c[0], c[1] - 140);
    for (let k = 0; k < 60; k++) player.update(1 / 60);
    const b = h.body;
    const spin = !!h.extras.spin;
    const top = b.toWorld([0, 0, 0])[1] - h.hold.follow[1]; // the ball's middle over the finger
    const q0 = b.q.slice();
    player.update(1 / 60);
    const turned = 2 * Math.acos(Math.min(1, Math.abs(q0[0] * b.q[0] + q0[1] * b.q[1] + q0[2] * b.q[2] + q0[3] * b.q[3]))); // prettier-ignore
    h.release();
    return { spin, top, R: h.R(), turned, wy: b.omega[1], bounce: b.restitution };
  });
  expect(s.bounce).toBeCloseTo(0.82, 2);
  expect(s.spin).toBe(true);
  expect(s.top / s.R).toBeGreaterThan(0.7); // it sits on top of the finger
  expect(s.turned).toBeGreaterThan(0.05); // spinning (radians a frame)
  expect(Math.abs(s.wy)).toBeGreaterThan(4); // and it keeps spinning off it
});

test("beach ball: dropped beside a basketball, it falls slower and drifts", async ({ page }) => {
  const fall = async (id) => {
    await open(page, id);
    return page.evaluate(() => {
      const { player } = window.__splashery;
      const h = player.handsOn;
      h.ensure();
      const b = h.body;
      const R = h.R();
      b.pos[1] += 3 * R;
      h.moved = true;
      h.world.wake();
      let t = 0;
      const x0 = b.pos.slice();
      while (b.pos[1] > b.home.pos[1] + 0.2 * R && t < 3) {
        player.update(1 / 60);
        t += 1 / 60;
      }
      return { t, side: Math.hypot(b.pos[0] - x0[0], b.pos[2] - x0[2]) / R };
    });
  };
  const beach = await fall("beach-ball");
  const basket = await fall("basketball");
  expect(beach.t).toBeGreaterThan(basket.t * 1.15);
  expect(beach.side).toBeGreaterThan(0.03);
  expect(basket.side).toBeLessThan(0.01);
});

test("water polo ball: it floats on the water line, a third under", async ({ page }) => {
  await open(page, "water-polo-ball");
  await page.evaluate(() => window.__splashery.player.update(1 / 60));
  await page.waitForTimeout(300);
  const s = await page.evaluate(() => {
    const { player } = window.__splashery;
    for (let k = 0; k < 3; k++) player.update(1 / 60);
    const h = player.handsOn;
    return { view: !!h.extras.view?.entity?.enabled, above: (h.body.home.pos[1] - h.extras.water.level) / h.R(), asleep: h.world.asleep || !h.moved }; // prettier-ignore
  });
  expect(s.view).toBe(true);
  expect(s.above).toBeGreaterThan(0.55);
  expect(s.above).toBeLessThan(0.75);
  expect(s.asleep).toBe(true); // nothing moves until touched
});

test("sports car: pushed, it rolls on with its wheels turning; Reset rolls it home", async ({
  page,
}) => {
  await open(page, "sports-car");
  const s = await page.evaluate(() => {
    const { player } = window.__splashery;
    const h = player.handsOn;
    const c = player.stage.toScreen(player.toyInfo.center);
    h.pressAt(player.toyInfo.center.slice(), c[0], c[1]);
    for (let k = 1; k <= 20; k++) {
      h.moveTo(c[0] + k * 6, c[1]);
      player.update(1 / 60);
    }
    const d0 = Math.hypot(...h.body.pos.map((v, i) => v - h.body.home.pos[i]));
    const a0 = player.motion.handsParts.front.angle;
    h.release();
    for (let k = 0; k < 60; k++) player.update(1 / 60);
    const d1 = Math.hypot(...h.body.pos.map((v, i) => v - h.body.home.pos[i]));
    const a1 = player.motion.handsParts.front.angle;
    const front = player.motion.handsParts.front.angle === player.motion.handsParts.rear.angle;
    return { d0, d1, a0, a1, front, R: h.R() };
  });
  expect(s.d0 / s.R).toBeGreaterThan(0.1);
  expect(s.d1).toBeGreaterThan(s.d0 * 1.3);
  expect(Math.abs(s.a1 - s.a0)).toBeGreaterThan(0.5);
  expect(s.front).toBe(true);
  await page.click("#hands-reset");
  const back = await page.evaluate(() => {
    const { player } = window.__splashery;
    for (let k = 0; k < 60; k++) player.update(1 / 60);
    const h = player.handsOn;
    return { d: Math.hypot(...h.body.pos.map((v, i) => v - h.body.home.pos[i])), a: player.motion.handsParts.front.angle }; // prettier-ignore
  });
  expect(back.d).toBeLessThan(1e-6);
  expect(Math.abs(back.a)).toBeLessThan(0.05); // the wheels rolled back too
});

test("snow globe: shaking it swirls the snow", async ({ page }) => {
  await open(page, "snow-globe");
  const s = await page.evaluate(() => {
    const { player } = window.__splashery;
    const h = player.handsOn;
    const c = player.stage.toScreen(player.toyInfo.center);
    h.pressAt(player.toyInfo.center.slice(), c[0], c[1]);
    h.moveTo(c[0], c[1] - 40);
    player.update(1 / 60);
    const still = player.motion.out?.parts?.swirl?.visible ?? 0;
    for (let k = 1; k <= 60; k++) {
      h.moveTo(c[0] + 70 * Math.sin((k / 60) * 4 * Math.PI), c[1] - 40);
      player.update(1 / 60);
    }
    const level = player.motion.hands.shake;
    const swirl = player.motion.out?.parts?.swirl?.visible ?? null;
    h.release();
    return { still, level, swirl, key: player.motion.tap?.key };
  });
  expect(s.still).toBe(0);
  expect(s.level).toBeGreaterThan(0.4);
  expect(s.key).toBe("shake");
  expect(s.swirl).toBeGreaterThan(0.9);
});

test("school of fish: the fish near the finger dart away; the school stays put", async ({
  page,
}) => {
  await open(page, "fish-school");
  const s = await page.evaluate(() => {
    const { player } = window.__splashery;
    const h = player.handsOn;
    const fish = player.motion.ctx.kit.data.fish;
    const n = fish.length;
    const hands = player.motion.hands;
    player.update(1 / 60);
    // Where the last fish swims now (the drive's own latest place for it).
    const w = player.fromRecipe(h.extras.flee.items.get(n - 1).pos);
    const c = player.stage.toScreen(w);
    h.pressAt(w, c[0], c[1]);
    h.moveTo(c[0] + 2, c[1]);
    for (let k = 0; k < 10; k++) player.update(1 / 60);
    // Each fish's dart, from the drive's own calls (keyed by fish).
    const offs = fish.map((f, i) => Math.hypot(...hands.flee(i, [0, 0, 0]).offset));
    const near = offs[n - 1];
    const darted = offs.filter((d) => d > 0.05).length;
    h.release();
    for (let k = 0; k < 300; k++) player.update(1 / 60);
    let back = 0;
    for (let i = 0; i < n; i++)
      back = Math.max(back, Math.hypot(...hands.flee(i, [0, 0, 0]).offset));
    return { moved: h.moved, near, darted, n, back };
  });
  expect(s.moved).toBe(false); // the school itself stayed put
  expect(s.near).toBeGreaterThan(0.08); // the fish under the finger darted
  expect(s.darted).toBeLessThan(s.n / 2); // the far ones didn't
  expect(s.back).toBeLessThan(0.01); // all back in place
});
