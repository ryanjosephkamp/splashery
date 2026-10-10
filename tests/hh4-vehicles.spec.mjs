// Lane Hands-on H4, Vehicles (docs/handoff/HandsH4.md): with the ✋ switch
// on, the rotors and propeller flick and coast, the steam engine runs on its
// rails, the liner bobs, the sailboat heels and rights herself, the
// submarine and the balloon float back, the road vehicles roll, and the
// saucer's beam lifts the cow. Each piece measured over time.

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

test("helicopter: a flick spins the main rotor, which coasts down to a stop", async ({ page }) => {
  await open(page, "helicopter");
  await drag(
    page,
    [
      [1.2, 1.86, 0.6],
      [0.2, 1.86, 1.4],
      [-0.9, 1.86, 0.8],
    ],
    4,
  );
  const a = await joint(page);
  expect(a.name).toBe("rotor");
  expect(Math.abs(a.w)).toBeGreaterThan(3); // set spinning
  await tick(page, 60);
  const b = await joint(page);
  await tick(page, 600);
  const c = await joint(page);
  expect(Math.abs(b.w)).toBeLessThan(Math.abs(a.w)); // slowing
  expect(Math.abs(b.w)).toBeGreaterThan(0.5 * Math.abs(a.w)); // but coasting on
  expect(Math.abs(c.w)).toBeLessThan(0.3 * Math.abs(a.w));
  expect(Math.abs(c.v - a.v)).toBeGreaterThan(Math.PI); // turned on round
  // The helicopter itself stays on its pad (only the rotors move).
  const parts = await page.evaluate(() => window.__splashery.player.motion.handsParts);
  expect(parts.heli).toBeUndefined();
  await reset(page);
  expect((await joint(page)).w).toBe(0);
});

test("steam train: pushed along its rails it rolls on, wheels and rods turning, to a buffer stop", async ({
  page,
}) => {
  await open(page, "steam-train");
  await drag(
    page,
    [
      [0, 1.0, 0.5],
      [0.4, 1.0, 0.5],
      [0.8, 1.0, 0.5],
    ],
    4,
  );
  const a = await joint(page);
  expect(a.v).toBeGreaterThan(0.3);
  expect(a.w).toBeGreaterThan(0.5); // still rolling when let go
  await tick(page, 20);
  const b = await joint(page);
  expect(b.v).toBeGreaterThan(a.v); // rolled on by itself
  await tick(page, 240);
  const c = await joint(page);
  expect(c.v).toBeLessThanOrEqual(1.3 + 1e-6); // the buffer stop
  const parts = await page.evaluate(() => window.__splashery.player.motion.handsParts);
  // Every axle rides along and turns by the distance over its own radius.
  expect(parts.loco.offset[0]).toBeCloseTo(c.v, 4);
  expect(parts.driver1.offset[0]).toBeCloseTo(c.v, 4);
  expect(parts.driver1.angle).toBeCloseTo(-c.v / 0.36, 4);
  expect(parts.pony.angle).toBeCloseTo(-c.v / 0.2, 4);
  expect(parts.tender0.angle).toBeCloseTo(-c.v / 0.24, 4);
  expect(parts.rods.offset[0]).toBeGreaterThan(c.v - 0.35);
  expect(parts.runway.visible).toBe(1); // the extra track shows
  await reset(page);
  expect(Math.abs((await joint(page)).v)).toBeLessThan(1e-6);
});

test("ocean liner: pushed down it bobs back up and settles", async ({ page }) => {
  await open(page, "ocean-liner");
  await drag(page, [
    [0, 0.6, 0.3],
    [0, 0.2, 0.3],
    [0, -0.1, 0.3],
  ]);
  const a = await joint(page);
  expect(a.v).toBeLessThan(-0.3); // pushed under
  const tr = [];
  for (let i = 0; i < 12; i++) {
    await tick(page, 10);
    tr.push((await joint(page)).v);
  }
  expect(Math.max(...tr)).toBeGreaterThan(0.02); // bobs past its line
  expect(Math.max(...tr)).toBeLessThan(0.2);
  await tick(page, 180);
  expect(Math.abs((await joint(page)).v)).toBeLessThan(0.02); // settled
});

test("sailboat: the mast pushed over heels her, and she rocks back upright", async ({ page }) => {
  await open(page, "sailboat");
  await drag(page, [
    [0.2, 2.4, 0],
    [0.2, 2.2, 0.8],
    [0.2, 1.8, 1.4],
  ]);
  const a = await joint(page);
  expect(Math.abs(a.v)).toBeGreaterThan(0.3); // heeled
  const tr = [];
  for (let i = 0; i < 20; i++) {
    await tick(page, 8);
    tr.push((await joint(page)).v);
  }
  const crossings = tr.filter((v, i) => i && Math.sign(v) !== Math.sign(tr[i - 1])).length;
  expect(crossings).toBeGreaterThanOrEqual(1); // rocks through upright
  await tick(page, 300);
  expect(Math.abs((await joint(page)).v)).toBeLessThan(0.03);
});

test("submarine: pushed under she bobs back up to the surface, upright", async ({ page }) => {
  await open(page, "submarine");
  const r = await shove(page, 0, 150);
  expect(r.held).toBeLessThan(-0.25);
  await tick(page, 30);
  const tr = [];
  for (let i = 0; i < 8; i++) {
    await tick(page, 20);
    tr.push(await whole(page));
  }
  const end = tr[tr.length - 1];
  expect(Math.abs(end.d[1])).toBeLessThan(0.1); // back at the surface
  expect(Math.max(...tr.map((s) => s.tilt))).toBeLessThan(0.25); // never rolled over
});

test("hot-air balloon: pulled down by the basket, it floats back up", async ({ page }) => {
  await open(page, "hot-air-balloon");
  const r = await shove(page, 0, 150);
  expect(r.held).toBeLessThan(-0.3);
  const tr = [];
  for (let i = 0; i < 8; i++) {
    await tick(page, 30);
    tr.push(await whole(page));
  }
  expect(Math.abs(tr[tr.length - 1].d[1])).toBeLessThan(0.05);
  expect(Math.max(...tr.map((s) => s.tilt))).toBeLessThan(0.1); // basket under it
});

test("tractor: pushed, it rolls, the small front wheels turning faster", async ({ page }) => {
  await open(page, "tractor");
  const r = await shove(page, 140, 0);
  await tick(page, 30);
  const s = await whole(page);
  expect(Math.hypot(s.d[0], s.d[2])).toBeGreaterThan(0.3);
  expect(Math.abs(s.d[1])).toBeLessThan(0.02); // on its wheels
  const parts = await page.evaluate(() => {
    const { player } = window.__splashery;
    const out = { parts: {}, body: null };
    const d = { energy: 0, parts: {}, body: null };
    player.toyInfo.recipe.drive(0, player.motion.state, d, { time: 0, hands: player.motion.hands, data: {} }); // prettier-ignore
    return { rear: d.parts.rear.angle, front: d.parts.front.angle, rolled: player.motion.hands.rolled, out }; // prettier-ignore
  });
  expect(Math.abs(parts.rolled)).toBeGreaterThan(0.3);
  // (Whole turns aside: the chug's burst is a whole number of turns.)
  const turns = (a) => Math.abs(a / (2 * Math.PI) - Math.round(a / (2 * Math.PI)));
  expect(turns(parts.rear + parts.rolled)).toBeLessThan(1e-6);
  expect(turns(parts.front + (parts.rolled * 0.62) / 0.36)).toBeLessThan(1e-6);
  expect(r.R).toBeGreaterThan(0);
});

test("bicycle: pushed, it rolls on its wheels and stays upright", async ({ page }) => {
  await open(page, "bicycle");
  await shove(page, 140, 0);
  const tr = [];
  for (let i = 0; i < 4; i++) {
    await tick(page, 30);
    tr.push(await whole(page));
  }
  expect(Math.hypot(tr[3].d[0], tr[3].d[2])).toBeGreaterThan(0.3);
  expect(Math.max(...tr.map((s) => s.tilt))).toBeLessThan(0.12);
});

test("flying saucer: off the beam the cow stands on the grass; under it, it floats up", async ({
  page,
}) => {
  await open(page, "ufo");
  const cow = () =>
    page.evaluate(() => window.__splashery.player.motion.hands.piece("cow")?.pos ?? null);
  await drag(
    page,
    [
      [0, -1.45, 0],
      [0.8, -1.6, 0.6],
      [1.35, -1.95, 0.2],
    ],
    8,
  );
  await tick(page, 180);
  const a = await cow();
  expect(Math.hypot(a[0], a[2])).toBeGreaterThan(0.95); // out at the edge of the light
  expect(a[1]).toBeLessThan(-2.0); // standing on the grass
  await drag(page, [a, [0.7, -1.8, 0], [0.1, -1.9, 0]], 8);
  await tick(page, 150);
  const b = await cow();
  expect(b[1]).toBeGreaterThan(-1.55); // up in the beam
  expect(Math.hypot(b[0], b[2])).toBeLessThan(0.2);
  // The beam off: it drops.
  await page.evaluate(() => {
    const { player } = window.__splashery;
    player.motion.act(player.time, null, { key: "beam" });
  });
  await tick(page, 150);
  const c = await cow();
  expect(c[1]).toBeLessThan(-2.0);
});
