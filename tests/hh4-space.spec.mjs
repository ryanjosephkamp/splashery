// Lane Hands-on H4, Space (docs/handoff/HandsH4.md): with the ✋ switch on,
// a dragged planet swings back into its orbit, the Earth and the pulsar
// spin when flicked, the asteroid's chunks drift back to their places, the
// black hole swallows the star, and the comet comes to rest. Each piece
// measured over time.

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
  await page.waitForTimeout(500);
  await page.click("#hands-toggle");
  await tick(page, 5);
}

// Steps the clock by hand (SwiftShader draws slowly).
const tick = (page, n) =>
  page.evaluate((n) => {
    const { player } = window.__splashery;
    for (let i = 0; i < n; i++) player.update(1 / 60);
  }, n);

// A finger drag through recipe points, two frames a move.
const drag = (page, pts, steps = 6) =>
  page.evaluate(
    ({ pts, steps }) => {
      const { player } = window.__splashery;
      const h = player.handsOn;
      const s = pts.map((p) => player.screenPoint(p));
      h.pressAt(player.fromRecipe(pts[0]), s[0][0], s[0][1]);
      for (let k = 1; k < s.length; k++)
        for (let i = 1; i <= steps; i++) {
          const f = i / steps;
          h.moveTo(s[k - 1][0] + (s[k][0] - s[k - 1][0]) * f, s[k - 1][1] + (s[k][1] - s[k - 1][1]) * f); // prettier-ignore
          for (let j = 0; j < 2; j++) player.update(1 / 60);
        }
      h.release();
    },
    { pts, steps },
  );

// A whole toy pressed at its middle and dragged on screen by (dx, dy).
const shove = (page, dx, dy) =>
  page.evaluate(
    ({ dx, dy }) => {
      const { player } = window.__splashery;
      const h = player.handsOn;
      const c = player.toyInfo.center.slice();
      const s = player.stage.toScreen(c);
      h.pressAt(c, s[0], s[1]);
      for (let k = 1; k <= 30; k++) {
        h.moveTo(s[0] + (dx * k) / 30, s[1] + (dy * k) / 30);
        for (let j = 0; j < 2; j++) player.update(1 / 60);
      }
      const b = h.body;
      const R = player.toyInfo.radius;
      const held = (b.pos[1] - b.home.pos[1]) / R;
      h.release();
      return { held, R };
    },
    { dx, dy },
  );

const joint = (page, i = 0) =>
  page.evaluate((i) => window.__splashery.player.handsOn.joints.state()[i], i);

// The whole toy's offset from home (toy radii) and its tilt from upright.
const whole = (page) =>
  page.evaluate(() => {
    const { player } = window.__splashery;
    const b = player.handsOn.body;
    const R = player.toyInfo.radius;
    const q = b.q;
    const up = [2 * (q[0] * q[1] - q[3] * q[2]), 1 - 2 * (q[0] * q[0] + q[2] * q[2]), 2 * (q[1] * q[2] + q[3] * q[0])]; // prettier-ignore
    return { d: b.pos.map((v, i) => (v - b.home.pos[i]) / R), tilt: Math.acos(Math.min(1, up[1])) };
  });

const reset = async (page) => {
  await page.click("#hands-reset");
  await tick(page, 60);
};

const piece = (page, key) =>
  page.evaluate((key) => window.__splashery.player.motion.hands.piece(key), key);

test("solar system: a planet dragged off its orbit swings back into it", async ({ page }) => {
  await open(page, "solar-system");
  await page.evaluate(() => window.__splashery.player.handsOn.ensure());
  await tick(page, 20);
  const p0 = (await piece(page, "earth")).pos;
  await drag(page, [p0, [p0[0] * 1.4, 0.3, p0[2] * 1.4], [p0[0] * 1.8, 0.2, p0[2] * 1.8]]);
  const r = async (k) => {
    const p = (await piece(page, k)).pos;
    return { r: Math.hypot(p[0], p[2]), y: p[1], th: Math.atan2(p[0], p[2]) };
  };
  const a = await r("earth");
  expect(a.r).toBeGreaterThan(0.8); // off its orbit (0.62)
  const m0 = await r("mars");
  await tick(page, 200);
  const b = await r("earth");
  expect(b.r).toBeCloseTo(0.62, 1);
  expect(Math.abs(b.y)).toBeLessThan(0.02);
  const m1 = await r("mars");
  expect(m1.r).toBeCloseTo(0.76, 2); // the others keep their orbits
  const dth = (((m1.th - m0.th) % (2 * Math.PI)) + 2 * Math.PI) % (2 * Math.PI);
  expect(dth).toBeGreaterThan(0.3); // and keep going round
  // The drive shows each planet where its body is.
  const shown = await page.evaluate(() => {
    const { player } = window.__splashery;
    const d = { energy: 0, parts: {}, body: null, cues: [] };
    player.toyInfo.recipe.drive(player.time, player.motion.state, d, { time: player.time, hands: player.motion.hands, data: {} }); // prettier-ignore
    return d.parts.earth.offset;
  });
  expect(shown.length).toBe(3);
});

test("earth: a flick spins it on its axis, and it slows to still", async ({ page }) => {
  await open(page, "earth");
  await drag(
    page,
    [
      [0.6, 0.3, 0.8],
      [0.0, 0.3, 1.0],
      [-0.6, 0.3, 0.8],
    ],
    3,
  );
  const a = await joint(page);
  expect(Math.abs(a.w)).toBeGreaterThan(0.5);
  const parts = await page.evaluate(() => window.__splashery.player.motion.handsParts);
  const shown = ["globe", "globeB", "globeC", "globeD"].filter((n) => parts[n].visible);
  expect(shown.length).toBe(1); // one quarter shell turns at a time, as the tap's day does
  await tick(page, 600);
  const b = await joint(page);
  expect(Math.abs(b.w)).toBeLessThan(0.05);
  expect(Math.abs(b.v - a.v)).toBeGreaterThan(0.5);
});

test("pulsar: a flick spins it up and the beams sweep faster", async ({ page }) => {
  await open(page, "pulsar");
  await tick(page, 30);
  const idle = await page.evaluate(() => window.__splashery.player.motion.state.spin);
  await drag(
    page,
    [
      [0.3, 0.1, 0.4],
      [0.0, 0.1, 0.5],
      [-0.3, 0.1, 0.4],
    ],
    2,
  );
  const a = await joint(page);
  expect(Math.abs(a.w)).toBeGreaterThan(0.8 + 5 * idle); // faster than its own turn
  const d = await page.evaluate(() => window.__splashery.player.motion.ctx.kit.data.h4);
  expect(d.dial).toBeCloseTo(a.v, 1); // the flashes follow the flicked star
  await tick(page, 120);
  const b = await joint(page);
  expect(Math.abs(b.w)).toBeLessThan(Math.abs(a.w));
});

test("asteroid: a chunk pulled off drifts back to its place", async ({ page }) => {
  await open(page, "asteroid");
  const home = await page.evaluate(() => {
    const h = window.__splashery.player.handsOn;
    h.ensure();
    return h.pieces[3].body.pos.slice();
  });
  await drag(page, [home, [home[0] + 0.5, home[1] + 0.5, home[2] + 0.3], [home[0] + 1, home[1] + 0.8, home[2] + 0.5]]); // prettier-ignore
  const at = () => page.evaluate(() => window.__splashery.player.handsOn.pieces[3].body.pos);
  const a = await at();
  const d = (p) => Math.hypot(p[0] - home[0], p[1] - home[1], p[2] - home[2]);
  expect(d(a)).toBeGreaterThan(0.4); // pulled off
  // (It flies on a little with the let-go's speed, then drifts back.)
  await tick(page, 260);
  expect(d(await at())).toBeLessThan(0.02);
  // The others never moved.
  const others = await page.evaluate(() => window.__splashery.player.handsOn.pieces.filter((p, i) => i !== 3 && !p.body.pinned).length); // prettier-ignore
  expect(others).toBe(0);
});

test("black hole: the star dragged near and let go falls in and is swallowed", async ({ page }) => {
  await open(page, "black-hole");
  await page.evaluate(() => window.__splashery.player.handsOn.ensure());
  const p0 = (await piece(page, "star")).pos;
  expect(Math.hypot(...p0)).toBeGreaterThan(2.5); // waiting out on the right
  await drag(page, [p0, [1.8, 0.4, 1.0], [1.6, 0.2, 0.6]]);
  const tr = [];
  for (let i = 0; i < 14; i++) {
    await tick(page, 20);
    tr.push(Math.hypot(...(await piece(page, "star")).pos));
  }
  expect(tr[tr.length - 1]).toBeLessThan(1.06); // swallowed
  for (let i = 1; i < tr.length; i++) expect(tr[i]).toBeLessThanOrEqual(tr[i - 1] + 1e-6); // only ever in
  const parts = await page.evaluate(() => {
    const { player } = window.__splashery;
    const d = { energy: 0, parts: {}, body: null, cues: [], glow: null };
    player.toyInfo.recipe.drive(player.time, player.motion.state, d, { time: player.time, hands: player.motion.hands, data: player.motion.ctx.kit.data ?? {} }); // prettier-ignore
    return d.parts;
  });
  expect(parts.star.visible).toBe(0);
});

test("comet: tossed, it lands and comes to rest (the L1 sweep's finding)", async ({ page }) => {
  await open(page, "comet");
  const r = await page.evaluate(() => {
    const { player } = window.__splashery;
    const h = player.handsOn;
    const tick = (n) => {
      for (let i = 0; i < n; i++) player.update(1 / 60);
    };
    const c = player.toyInfo.center.slice();
    const s = player.stage.toScreen(c);
    h.pressAt(c, s[0], s[1]);
    for (let k = 1; k <= 20; k++) {
      h.moveTo(s[0] + 4 * k, s[1] - 6 * k);
      tick(1);
    }
    h.release();
    for (let i = 0; i < 240 && !h.world.asleep; i++) tick(1);
    return { asleep: h.world.asleep, t: h.time };
  });
  expect(r.asleep).toBe(true); // within four seconds
});
