// Lane Hands-on H1's engine fixes (docs/handoff/HandsH1.md): a material's
// nose turns it nose first only in the air, damped so it doesn't swing past
// over and over (the shuttlecock), and `hands.area` gives a whole toy room
// to roll (the balls). Each test gives a toy the hands block at run time, so
// it measures the engine alone.

import { test, expect } from "@playwright/test";

const APP = "/?renderer=webgl2&adapt=off&profile=mid";

async function open(page, id, hands) {
  await page.goto(APP);
  await page.waitForSelector("body[data-ready='true']", { timeout: 180_000 });
  await page.evaluate(
    async ({ id, hands }) => {
      const { app, player } = window.__splashery;
      await app.chooseToy(id);
      player.opts.idleDelay = 1e9;
      player.toyInfo.recipe.hands = hands;
      player.handsOn.attach(player.toyInfo);
    },
    { id, hands },
  );
  await page.click("#hands-toggle");
}

test("a shuttlecock dropped cork up flips cork first, lands and rests", async ({ page }) => {
  await open(page, "shuttlecock", { material: "shuttlecock" });
  const s = await page.evaluate(() => {
    const { player } = window.__splashery;
    const h = player.handsOn;
    h.ensure();
    const b = h.body;
    const R = h.R();
    const rot = (q, v) => {
      const [x, y, z, w] = q;
      const cx = y * v[2] - z * v[1] + w * v[0];
      const cy = z * v[0] - x * v[2] + w * v[1];
      const cz = x * v[1] - y * v[0] + w * v[2];
      return [v[0] + 2 * (y * cz - z * cy), v[1] + 2 * (z * cx - x * cz), v[2] + 2 * (x * cy - y * cx)]; // prettier-ignore
    };
    b.q = [Math.sin(1.4), 0, 0, Math.cos(1.4)]; // 160 degrees over: cork up
    b.pos[1] += 3 * R;
    h.moved = true;
    h.world.wake();
    const noseAt = [];
    let rest = null;
    let maxSpeed = 0;
    for (let t = 0; t < 4; t += 1 / 60) {
      player.update(1 / 60);
      noseAt.push(rot(b.q, [0, -1, 0])[1]);
      if (t > 1) maxSpeed = Math.max(maxSpeed, Math.hypot(...b.vel) / R);
      if (rest == null && h.world.asleep) rest = t;
    }
    return { start: noseAt[0], at015: noseAt[9], at025: noseAt[15], rest, maxSpeed };
  });
  expect(s.start).toBeGreaterThan(0.8); // cork up
  expect(s.at025).toBeLessThan(-0.8); // cork down within a quarter second
  expect(s.rest).not.toBeNull(); // and it comes to rest
  expect(s.rest).toBeLessThan(3);
  expect(s.maxSpeed).toBeLessThan(1); // lying still a second on, not flipping about on the floor
});

test("hands.area gives a whole toy room to roll; without it the walls stay close", async ({
  page,
}) => {
  const push = async (hands) => {
    await open(page, "tennis-ball", hands);
    return page.evaluate(() => {
      const { player } = window.__splashery;
      const h = player.handsOn;
      h.ensure();
      const b = h.body;
      const R = h.R();
      b.vel = [3 * R, 0, 0];
      h.moved = true;
      h.world.wake();
      let far = 0;
      for (let t = 0; t < 2; t += 1 / 60) {
        player.update(1 / 60);
        far = Math.max(far, (b.pos[0] - b.home.pos[0]) / R);
      }
      return far;
    });
  };
  const wide = await push({ material: "tennis-ball", area: 3 });
  const close = await push({ material: "tennis-ball" });
  expect(wide).toBeGreaterThan(1.5);
  expect(wide).toBeLessThan(2.1); // the wall at 3 toy radii (its middle stops a radius short)
  expect(close).toBeLessThan(0.6);
});

test("hands.view: the view drifts less after a rolling ball, so its roll reads", async ({
  page,
}) => {
  const drift = async (hands) => {
    await open(page, "tennis-ball", hands);
    return page.evaluate(() => {
      const { player } = window.__splashery;
      const h = player.handsOn;
      h.ensure();
      const b = h.body;
      b.pos[0] += h.R();
      h.moved = true;
      return h.follow()[0] / h.R();
    });
  };
  expect(await drift({ material: "tennis-ball", area: 3, view: 0.5 })).toBeCloseTo(0.5, 3);
  expect(await drift({ material: "tennis-ball", area: 3 })).toBeCloseTo(0.8, 3);
});
