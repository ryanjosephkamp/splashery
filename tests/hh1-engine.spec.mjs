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
  await open(page, "shuttlecock", { material: "shuttlecock", area: 4 });
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
      if (t > 2) maxSpeed = Math.max(maxSpeed, Math.hypot(...b.vel) / R);
      if (rest == null && h.world.asleep) rest = t;
    }
    return { start: noseAt[0], at015: noseAt[9], at025: noseAt[15], rest, maxSpeed };
  });
  expect(s.start).toBeGreaterThan(0.8); // cork up
  expect(s.at025).toBeLessThan(-0.8); // cork down within a quarter second
  expect(s.rest).not.toBeNull(); // and it comes to rest
  expect(s.rest).toBeLessThan(3);
  expect(s.maxSpeed).toBeLessThan(1); // lying still on its side, not flipping about on the floor
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

test("hands.friction: a puck pushed on ice slides on; on the default floor it stops short", async ({
  page,
}) => {
  const slide = async (hands) => {
    await open(page, "hockey-puck", hands);
    return page.evaluate(() => {
      const { player } = window.__splashery;
      const h = player.handsOn;
      h.ensure();
      const b = h.body;
      const R = h.R();
      b.vel = [1.5 * R, 0, 0];
      h.moved = true;
      h.world.wake();
      for (let t = 0; t < 3; t += 1 / 60) player.update(1 / 60);
      return (b.pos[0] - b.home.pos[0]) / R;
    });
  };
  const ice = await slide({ material: "hockey-puck", area: 4, friction: 0.04 });
  const floor = await slide({ material: "hockey-puck", area: 4 });
  expect(ice).toBeGreaterThan(0.9);
  expect(floor).toBeLessThan(0.5);
});

test("a shelf shape with a grab in its shelf entry stretches like the gummy bear", async ({
  page,
}) => {
  await page.goto(APP);
  await page.waitForSelector("body[data-ready='true']", { timeout: 180_000 });
  const s = await page.evaluate(async () => {
    const { app, player } = window.__splashery;
    const { findToy } = await import("/src/toys.js");
    const def = findToy("knot");
    const had = def.grab;
    def.grab = { radius: 0.55, max: 0.8 };
    await app.chooseToy("knot");
    player.opts.idleDelay = 1e9;
    const own = player.canGrab();
    const c = player.stage.toScreen(player.toyInfo.center);
    player.grabStart(player.toyInfo.center.slice(), c[0], c[1]);
    player.grabAt(c[0] + 60, c[1] - 20);
    for (let i = 0; i < 20; i++) player.update(1 / 60);
    const pulled = Math.hypot(...player.driver.grab.pull) / player.toyInfo.radius;
    player.grabEnd();
    for (let i = 0; i < 180; i++) player.update(1 / 60);
    const back = Math.hypot(...player.driver.grab.pull) / player.toyInfo.radius;
    def.grab = had;
    await app.chooseToy("blob");
    return { own, pulled, back, plain: player.canGrab() };
  });
  expect(s.own).toBe(true);
  expect(s.pulled).toBeGreaterThan(0.1);
  expect(s.back).toBeLessThan(0.02); // it springs back
  expect(s.plain).toBe(false); // a shelf shape without one stays as it was
});

test("hands.soft: a toy squishes on landing as much as its hands block says", async ({ page }) => {
  const squish = async (hands) => {
    await open(page, "bouncy-ball", hands);
    return page.evaluate(() => {
      const { player } = window.__splashery;
      const h = player.handsOn;
      h.ensure();
      const b = h.body;
      b.pos[1] += 3 * h.R();
      h.moved = true;
      h.world.wake();
      let peak = 0;
      for (let t = 0; t < 1; t += 1 / 60) {
        player.update(1 / 60);
        peak = Math.max(peak, h.squish?.amp ?? 0);
      }
      return { soft: h.soft, peak };
    });
  };
  const firm = await squish({ material: "bouncy-ball", soft: 0.15 });
  const usual = await squish({ material: "bouncy-ball" });
  expect(firm.soft).toBeCloseTo(0.15, 3);
  expect(usual.soft).toBeCloseTo(0.55, 3); // the list's
  expect(firm.peak).toBeLessThan(usual.peak * 0.5);
});

test("hands.floor may be a function of the build", async ({ page }) => {
  await open(page, "dice", null);
  const d = await page.evaluate(() => {
    const { player } = window.__splashery;
    player.toyInfo.recipe.hands = {
      floor: (data, info) => (info.options?.kind === "d20" ? -0.8 : -0.5),
      pieces: () => [{ part: "d6a", pos: [-0.64, 0, 0.18], solid: { type: "box", half: [0.5, 0.5, 0.5] } }], // prettier-ignore
    };
    const h = player.handsOn;
    h.attach(player.toyInfo);
    h.setOn(true);
    h.ensure();
    return h.world.planes[0].d;
  });
  expect(d).toBeCloseTo(-0.5, 5);
});

test("hands.press: a press held still squeezes a whole toy, and it springs back when let go", async ({
  page,
}) => {
  await open(page, "rubber-duck", { press: { amount: 0.3 } });
  const s = await page.evaluate(() => {
    const { player } = window.__splashery;
    const h = player.handsOn;
    const c = player.stage.toScreen(player.toyInfo.center);
    h.pressAt(player.toyInfo.center.slice(), c[0], c[1]);
    const amp = [];
    for (let i = 0; i < 30; i++) {
      player.update(1 / 60);
      amp.push(h.squishAmp());
    }
    h.release();
    let min = Infinity;
    for (let i = 0; i < 90; i++) {
      player.update(1 / 60);
      min = Math.min(min, h.squishAmp());
      amp.push(h.squishAmp());
    }
    return { early: amp[5], held: amp[29], min, end: amp.at(-1), lifted: !!h.hold };
  });
  expect(s.early).toBeLessThan(0.01); // a tap's worth of time: nothing yet
  expect(s.held).toBeCloseTo(0.3, 2); // squeezed while held
  expect(s.min).toBeLessThan(-0.02); // springs back through rest (a wobble)
  expect(Math.abs(s.end)).toBeLessThan(0.01);
  expect(s.lifted).toBe(false);
});

test("a fixed piece is never knocked loose or picked up (a stand to land on)", async ({ page }) => {
  await open(page, "dice", null);
  const s = await page.evaluate(async () => {
    const { player } = window.__splashery;
    const { surfacePoints } = await import("/src/physics/world.js");
    const box = { type: "box", half: [0.5, 0.5, 0.5] };
    const points = surfacePoints(box, 2);
    player.toyInfo.recipe.hands = {
      floor: -0.5,
      pieces: () => [
        { part: "d6a", pos: [-0.64, 0, 0.18], solid: box, points, mass: 1 },
        { pos: [0.66, 0, -0.22], solid: box, points, fixed: true },
      ],
    };
    const h = player.handsOn;
    h.attach(player.toyInfo);
    h.setOn(true);
    h.ensure();
    const [a, b] = h.pieces.map((pc) => pc.body);
    h.free(b); // as a hard knock would
    const picked = h.pieceAt([0.66, 0, -0.22]);
    // Dropped onto it from above, the loose die lands on it and stays up there.
    h.free(a);
    a.pos = [0.66, 1.6, -0.22];
    h.moved = true;
    h.world.wake();
    for (let t = 0; t < 2; t += 1 / 60) player.update(1 / 60);
    return { pinned: b.pinned, picked: picked === b, standY: b.pos[1], dieY: a.pos[1] };
  });
  expect(s.pinned).toBe(true);
  expect(s.picked).toBe(false);
  expect(s.standY).toBeCloseTo(0, 5);
  expect(s.dieY).toBeGreaterThan(0.9); // resting on top of it
});
