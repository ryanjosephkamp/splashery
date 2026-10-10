// Lane Hands-on H4, Weather & fire (docs/handoff/HandsH4.md): with the ✋
// switch on, a spare log laid on the campfire makes the flames grow, the
// lava lamp's wax slides over when the lamp is tipped, and the iceberg bobs
// when pushed down and its chunk floats once pulled off. Each piece
// measured. (The snow globe's shake was built by lane Hands engine A.)

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

// Runs the recipe's drive on its own (a fresh controls object, so the
// toy's own memory is left alone) and returns its output.
const driveOnce = (page, extra) =>
  page.evaluate((extra) => {
    const { player } = window.__splashery;
    const c = (window.__hh4c ||= { ...player.motion.state });
    const out = { energy: 0, amount: 1, parts: {}, body: null, cues: [], glow: null, morph: null };
    const info = { time: player.time, hands: player.motion.hands, data: player.motion.ctx?.kit?.data, ...extra }; // prettier-ignore
    player.toyInfo.recipe.drive(player.time, c, out, info);
    return out;
  }, extra);

test("campfire: the spare log laid on the fire makes the flames grow", async ({ page }) => {
  await open(page, "campfire");
  const before = await driveOnce(page, {});
  expect(before.parts.spare.visible).toBe(1); // shown by the stones in Hands-on
  const p0 = await page.evaluate(() => {
    const h = window.__splashery.player.handsOn;
    h.ensure();
    return h.pieces[0].body.pos.slice();
  });
  await page.evaluate((p0) => {
    const { player } = window.__splashery;
    const h = player.handsOn;
    const pts = [p0, [0.4, 0.2, 0.6], [0, -0.5, 0.05]].map((p) => player.screenPoint(p));
    h.pressAt(player.fromRecipe(p0), pts[0][0], pts[0][1]);
    for (let k = 1; k < pts.length; k++)
      for (let i = 1; i <= 8; i++) {
        const f = i / 8;
        h.moveTo(pts[k - 1][0] + (pts[k][0] - pts[k - 1][0]) * f, pts[k - 1][1] + (pts[k][1] - pts[k - 1][1]) * f); // prettier-ignore
        for (let j = 0; j < 2; j++) player.update(1 / 60);
      }
    for (let j = 0; j < 20; j++) player.update(1 / 60);
    h.release();
  }, p0);
  await tick(page, 60);
  const log = await page.evaluate(() => window.__splashery.player.motion.hands.piece("spare"));
  expect(Math.hypot(log.pos[0], log.pos[2])).toBeLessThan(0.48); // on the fire
  // Its own clock: the flames build up over a moment.
  let after = null;
  for (let i = 0; i < 4; i++) {
    await tick(page, 15);
    after = await driveOnce(page, {});
  }
  expect(after.amount - before.amount).toBeGreaterThan(0.5);
  await reset(page);
  const home = await page.evaluate(() => window.__splashery.player.motion.hands.piece("spare"));
  expect(home.pos).toEqual(p0);
});

test("lava lamp: tipped, the wax slides to the glass's upper side, and back when upright", async ({
  page,
}) => {
  await open(page, "lava-lamp");
  const at = async (up) => {
    let out = null;
    for (let i = 0; i < 40; i++) {
      await tick(page, 2);
      out = await driveOnce(page, up ? { up } : {});
    }
    return out.parts;
  };
  const upright = await at(null);
  const tipped = await at([0.7, 0.714, 0]);
  // Every blob is further toward +x (the upper side), within the glass.
  for (let i = 0; i < 6; i++) {
    const a = upright[`blob${i}`].offset[0];
    const b = tipped[`blob${i}`].offset[0];
    expect(b - a).toBeGreaterThan(0.03);
    expect(b).toBeLessThan(0.3);
  }
  const back = await at(null);
  expect(Math.abs(back.blob0.offset[2])).toBeLessThan(0.02);
  expect(Math.abs(back.blob0.offset[0] - upright.blob0.offset[0])).toBeLessThan(0.03);
});

test("iceberg: pushed down it bobs back; the chunk pulled off floats", async ({ page }) => {
  await open(page, "iceberg");
  await drag(page, [
    [0, 0.5, 0.3],
    [0, 0.3, 0.3],
    [0, 0.1, 0.3],
  ]);
  const a = await joint(page, 0);
  expect(a.name).toBe("berg");
  expect(a.v).toBeLessThan(-0.15);
  const tr = [];
  for (let i = 0; i < 10; i++) {
    await tick(page, 6);
    tr.push((await joint(page, 0)).v);
  }
  expect(Math.max(...tr)).toBeGreaterThan(0.02); // bobs up past its line
  await tick(page, 200);
  expect(Math.abs((await joint(page, 0)).v)).toBeLessThan(0.02);
  const c0 = await page.evaluate(() => window.__splashery.player.handsOn.joints.list.find((j) => j.name === "chunk").body.pos.slice()); // prettier-ignore
  await drag(page, [c0, [c0[0] + 0.3, c0[1] + 0.3, c0[2] + 0.2], [c0[0] + 0.7, c0[1] + 0.4, c0[2] + 0.4]], 8); // prettier-ignore
  const ch = await joint(page, 1);
  expect(ch.broken).toBe(true);
  await tick(page, 240);
  const y = await page.evaluate(() => window.__splashery.player.handsOn.joints.list.find((j) => j.name === "chunk").body.pos[1]); // prettier-ignore
  expect(y).toBeGreaterThan(-0.15); // afloat at the sea (y 0), not on the seabed
  expect(y).toBeLessThan(0.12); // mostly under
});
