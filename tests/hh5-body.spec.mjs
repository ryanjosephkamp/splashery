// Lane Hands-on H5, the Body shelf (docs/handoff/HandsH5.md): with the ✋
// switch on, each piece measured: the eye rolls to look where the finger
// pulls and glances about again after; the lungs breathe out while squeezed
// and fill past rest when let go, any way up; the anatomy atlas's organs
// lift out only once they show, and click back into their places.

import { test, expect } from "@playwright/test";

const APP = "/?renderer=webgl2&adapt=off&profile=mid";

// Phone size, where the owner plays (and the clips are made).
test.use({ viewport: { width: 390, height: 844 } });

async function ready(page, id) {
  await page.goto(APP);
  await page.waitForSelector("body[data-ready='true']", { timeout: 180_000 });
  await page.evaluate(async (id) => {
    const { app, player } = window.__splashery;
    await app.chooseToy(id);
    player.opts.idleDelay = 1e9;
    if (player.camera) {
      player.camera.turntable = false;
      player.camera.idleDelay = 1e9;
    }
  }, id);
  await page.waitForTimeout(800);
  if (!(await page.evaluate(() => window.__splashery.player.handsOn.on)))
    await page.click("#hands-toggle");
  await page.evaluate(() => window.__splashery.player.handsOn.ensure());
}

const tick = (page, secs) =>
  page.evaluate(
    (n) => {
      const { player } = window.__splashery;
      for (let i = 0; i < n; i++) player.update(1 / 60);
    },
    Math.round(secs * 60),
  );

// A finger on Hands-on itself, through recipe points: a press at the first
// (as the app's own press does, with the world point under it), then moves
// along the rest, a 30th of a second each step; `up` lets go at the end.
async function finger(page, points, { steps = 10, up = true } = {}) {
  await page.evaluate(
    ([pts, steps, up]) => {
      const { player } = window.__splashery;
      const ho = player.handsOn;
      const sp = (p) => player.screenPoint(p);
      ho.pressAt(player.fromRecipe(pts[0]), ...sp(pts[0]));
      player.update(1 / 30);
      for (let k = 1; k < pts.length; k++)
        for (let i = 1; i <= steps; i++) {
          const p = pts[k - 1].map((v, j) => v + ((pts[k][j] - v) * i) / steps);
          ho.moveTo(...sp(p));
          player.update(1 / 30);
        }
      if (up) ho.release();
    },
    [points, steps, up],
  );
}

const letGo = (page) => page.evaluate(() => window.__splashery.player.handsOn.release());

// What the drive last showed (parts, tokens, body, grow).
const shown = (page, what) =>
  page.evaluate((what) => {
    const out = window.__splashery.player.motion.out;
    return JSON.parse(JSON.stringify(what === "all" ? { parts: out.parts, body: out.body, grow: out.grow } : out[what])); // prettier-ignore
  }, what);

// The whole toy's body (Level 1): its tilt from upright (radians), how far
// it is from home (toy radii) and whether it sleeps.
const body = (page) =>
  page.evaluate(() => {
    const ho = window.__splashery.player.handsOn;
    const b = ho.body;
    const dq = [b.q, b.home.q];
    const [x, y, z, w] = b.q;
    const [hx, hy, hz, hw] = b.home.q;
    // The relative turn's up vector.
    const q = [hw * x - hx * w - hy * z + hz * y, hw * y - hy * w - hz * x + hx * z, hw * z - hz * w - hx * y + hy * x, hw * w + hx * x + hy * y + hz * z]; // prettier-ignore
    const up1 = 1 - 2 * (q[0] * q[0] + q[2] * q[2]);
    const d = b.pos.map((v, i) => v - b.home.pos[i]);
    void dq;
    return { tilt: Math.acos(Math.max(-1, Math.min(1, up1))), off: Math.hypot(...d) / ho.R(), up: d[1] / ho.R(), asleep: ho.world.asleep }; // prettier-ignore
  });

// Lays a Level 1 toy down as it might land: tipped by `angle` about x
// (π/2 on its side, π upside down), resting where it is.
const lay = (page, angle) =>
  page.evaluate((angle) => {
    const ho = window.__splashery.player.handsOn;
    const b = ho.body;
    if (b.settled) ho.joints.unsettle(b); // (as a finger's touch would)
    b.q = [Math.sin(angle / 2), 0, 0, Math.cos(angle / 2)];
    b.vel = [0, 0, 0];
    b.omega = [0, 0, 0];
    ho.moved = true;
    ho.world.wake();
  }, angle);

// The ball's look: its +z turned by q, as a turn across and a tip up.
const lookOf = (q) => {
  const [x, y, z, w] = q;
  return [2 * (x * z + w * y), 2 * (y * z - w * x), 1 - 2 * (x * x + y * y)];
};
const yawOf = (q) => {
  const f = lookOf(q);
  return Math.atan2(f[0], f[2]);
};
const pitchOf = (q) => {
  const f = lookOf(q);
  return Math.atan2(f[1], Math.hypot(f[0], f[2]));
};

test("eye: dragged, it rolls to look where the finger pulls; let go, it glances about again", async ({
  page,
}) => {
  await ready(page, "eye");
  // Pulled to the eye's right (+x) and up.
  await finger(
    page,
    [
      [0, 0, 1],
      [0.8, 0.5, 1.2],
      [1.4, 0.8, 1.2],
    ],
    { up: false },
  );
  await tick(page, 0.6);
  const q = (await shown(page, "parts")).ball.quat;
  expect(yawOf(q)).toBeGreaterThan(0.4);
  expect(pitchOf(q)).toBeGreaterThan(0.15);
  // Pulled down to the left: it rolls that way (the view looks from its
  // right, so measured against where it looked before).
  await page.evaluate(() => {
    const { player } = window.__splashery;
    player.handsOn.moveTo(...player.screenPoint([-1.4, -0.8, 1.2]));
  });
  await tick(page, 0.6);
  const q2 = (await shown(page, "parts")).ball.quat;
  expect(yawOf(q2)).toBeLessThan(yawOf(q) - 0.5);
  expect(pitchOf(q2)).toBeLessThan(pitchOf(q) - 0.3);
  // It stays in its socket (never past about 45 degrees).
  expect(Math.abs(yawOf(q2))).toBeLessThan(0.85);
  await letGo(page);
  await tick(page, 2.5);
  const q3 = (await shown(page, "parts")).ball.quat;
  expect(Math.abs(yawOf(q3))).toBeLessThan(0.6);
});

test("lungs: squeezed they breathe out, let go they fill past rest, any way up", async ({
  page,
}) => {
  await ready(page, "lungs");
  const morph = async () => (await shown(page, "morph"))[0];
  for (const a of [0, Math.PI / 2, Math.PI]) {
    if (a) await lay(page, a);
    await tick(page, 0.5);
    const before = await morph();
    expect(Math.abs(before)).toBeLessThan(0.25);
    await finger(page, [[0.4, 0.2, 0.4]], { up: false });
    await tick(page, 1.5);
    expect(await morph()).toBeGreaterThan(0.75);
    await letGo(page);
    // Filling: past rest (below 0) within a second, then back near rest.
    let least = 1;
    for (let i = 0; i < 12; i++) {
      await tick(page, 0.1);
      least = Math.min(least, await morph());
    }
    expect(least).toBeLessThan(-0.1);
    await tick(page, 2);
    expect(Math.abs(await morph())).toBeLessThan(0.25);
  }
});

test("anatomy atlas: the organs lift out only once they show, and click back into place", async ({
  page,
}) => {
  await ready(page, "anatomy-atlas");
  const heart = [0.016, 1.215, 0.035];
  const state = () => page.evaluate(() => window.__splashery.player.handsOn.state());
  const heartBody = async () => (await state()).bodies[2];
  // Skin on: a press over the heart takes nothing.
  await finger(page, [heart, [0.3, 1.3, 0.3], [0.45, 0.6, 0.35]], { steps: 6 });
  await tick(page, 0.5);
  let hb = await heartBody();
  expect(Math.hypot(...hb.pos.map((v, i) => v - hb.home[i]))).toBeLessThan(1e-3);
  // To the organs: three peels.
  for (let i = 0; i < 3; i++) {
    await page.evaluate(() => window.__splashery.player.act(null));
    await tick(page, 3.6);
  }
  // Lifted out and set down beside the figure, the heart lies on the floor.
  await finger(page, [heart, [0.3, 1.2, 0.3], [0.45, 0.4, 0.35]], { steps: 8 });
  await tick(page, 2);
  hb = await heartBody();
  expect(Math.hypot(...hb.pos.map((v, i) => v - hb.home[i]))).toBeGreaterThan(0.25);
  expect(hb.pos[1]).toBeLessThan(0.25);
  // The others stayed in their places.
  const st = await state();
  for (const [i, b] of st.bodies.entries())
    if (i !== 2) expect(Math.hypot(...b.pos.map((v, k) => v - b.home[k]))).toBeLessThan(1e-3);
  // Brought back near its place, it clicks in.
  await finger(page, [hb.pos, [0.3, 1.0, 0.3], [heart[0] + 0.04, heart[1] + 0.03, heart[2] + 0.04]], { steps: 8 }); // prettier-ignore
  await tick(page, 1.5);
  hb = await heartBody();
  expect(Math.hypot(...hb.pos.map((v, i) => v - hb.home[i]))).toBeLessThan(0.01);
});
