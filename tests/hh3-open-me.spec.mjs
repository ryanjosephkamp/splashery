// Lane Hands-on H3, the Open me shelf (docs/HANDS-ON-PLAN.md): with the ✋
// switch on, each piece measured as the finger moves it (angles, positions
// over time): the storybook's cover, the alarm clock's hands, the gift box's
// lid and star, the umbrella's runner, the desk fan's head, the desk lamp's
// arms and light, the telescope's tubes, the potion bottle's cork and the
// fountain pen's cap.

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
  // the joints before any drag.) The clock stops: only tick() steps it, so
  // a loaded machine sees the same frames.
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
      for (let i = 0; i < n; i++) player.tickFixed(1 / 60);
    },
    Math.round(secs * 60),
  );

// A finger drag through recipe points, straight to Hands-on (as the app
// hands it a press and its moves), two clock steps per move.
async function drag(page, points, { steps = 20, hold = false, held = false } = {}) {
  await page.evaluate(
    ({ points, steps, hold, held }) => {
      const { player } = window.__splashery;
      const ho = player.handsOn;
      const px = points.map((p) => player.screenPoint(p));
      if (!held) ho.pressAt(player.fromRecipe(points[0]), px[0][0], px[0][1]);
      for (let k = 1; k < px.length; k++)
        for (let i = 1; i <= steps; i++) {
          const f = i / steps;
          const [a, b] = [px[k - 1], px[k]];
          ho.moveTo(a[0] + (b[0] - a[0]) * f, a[1] + (b[1] - a[1]) * f);
          player.tickFixed(1 / 60);
          player.tickFixed(1 / 60);
        }
      if (!hold) ho.release();
    },
    { points, steps, hold, held },
  );
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

test("storybook: the cover shuts from upright, the pages going with it, and opens again", async ({
  page,
}) => {
  await ready(page, "book");
  let c = await joint(page, "cover");
  expect(c.v).toBeCloseTo(Math.PI, 3); // open, as the toy starts
  // Lifted past upright toward shut and let go: it drops shut.
  await drag(page, [
    [-0.55, 0.02, 0.2],
    [-0.25, 0.7, 0.2],
    [0.2, 0.75, 0.2],
    [0.5, 0.5, 0.2],
  ]);
  await tick(page, 2);
  c = await joint(page, "cover");
  expect(c.v).toBe(0);
  expect(await events(page)).toContain("stop");
  // The leaves lay on the cover: they are shut with it.
  let p = await parts(page);
  for (let i = 0; i < 10; i++) expect(p["leaf" + i].angle).toBeLessThan(0.01);
  // Opened past upright: it falls open onto its stop, the leaves with it.
  await drag(page, [
    [0.6, 0.36, 0.2],
    [0.3, 0.75, 0.2],
    [-0.2, 0.8, 0.2],
  ]);
  await tick(page, 2);
  c = await joint(page, "cover");
  expect(c.v).toBeCloseTo(Math.PI, 3);
  p = await parts(page);
  expect(p.leaf0.angle).toBeGreaterThan(3);
  await reset(page);
  c = await joint(page, "cover");
  expect(c.v).toBeCloseTo(Math.PI, 3);
});

test("alarm clock: the minute hand turns under the finger and the hour hand follows a twelfth as fast", async ({
  page,
}) => {
  await ready(page, "clock");
  const m0 = (await joint(page, "minute")).v;
  // Once round the face, clockwise.
  await drag(
    page,
    [
      [0, 0.5, 0.2],
      [0.45, 0.25, 0.2],
      [0.5, -0.2, 0.2],
      [0, -0.5, 0.2],
      [-0.5, -0.15, 0.2],
      [-0.4, 0.35, 0.2],
      [0, 0.5, 0.2],
    ],
    { steps: 12 },
  );
  await tick(page, 1);
  const m = await joint(page, "minute");
  const turned = m.v - m0;
  expect(turned).toBeLessThan(-4); // most of a turn, clockwise (the angle goes negative)
  expect(turned).toBeGreaterThan(-8);
  // Settled on a minute.
  const step = (2 * Math.PI) / 60;
  expect(Math.abs(m.v / step - Math.round(m.v / step))).toBeLessThan(0.05);
  expect(await events(page)).toContain("detent");
  // The hour hand: a twelfth of the minute hand's turn.
  const before = await page.evaluate(() => {
    const d = new Date();
    const m = d.getMinutes() + d.getSeconds() / 60;
    return (-((d.getHours() % 12) + m / 60) / 12) * 2 * Math.PI;
  });
  const p = await parts(page);
  expect(p.hour.angle - before).toBeCloseTo(turned / 12, 1);
  // ↺ winds back to the real time.
  await reset(page);
  const back = await joint(page, "minute");
  expect(Math.abs(back.v - m0)).toBeLessThan(0.05);
});

test("gift box: the lid lifts off and the star springs up; set back on, it clicks home", async ({
  page,
}) => {
  await ready(page, "gift-box");
  const starY = async () =>
    page.evaluate(() => window.__splashery.player.motion.out?.parts?.star?.offset?.[1] ?? null); // prettier-ignore
  await drag(page, [
    [0.2, 0.85, 0.3],
    [0.2, 1.3, 0.3],
    [1.1, 1.0, 0.6],
    [1.2, 0.3, 0.6],
  ]);
  await tick(page, 1.5);
  const b = await page.evaluate(() => window.__splashery.player.handsOn.state().bodies);
  const lid = b[0];
  expect(Math.hypot(lid.pos[0] - lid.home[0], lid.pos[2] - lid.home[2])).toBeGreaterThan(0.6);
  expect(lid.pos[1]).toBeGreaterThan(0.05); // on the table, not in it
  const sy = await starY();
  if (sy !== null) expect(sy).toBeGreaterThan(0.6); // the star stands up out of the box
  // Brought back over the box: it clicks into place.
  await drag(page, [lid.pos, [1.0, 1.2, 0.5], [0.1, 1.1, 0.2], [0.05, 0.95, 0.1]], { steps: 15 });
  await tick(page, 1.5);
  const after = (await page.evaluate(() => window.__splashery.player.handsOn.state().bodies))[0];
  for (let i = 0; i < 3; i++) expect(after.pos[i]).toBeCloseTo(after.home[i], 3);
  expect(await events(page)).toContain("socket");
  await tick(page, 1.5);
  const sy2 = await starY();
  if (sy2 !== null) expect(sy2).toBeLessThan(0.05); // pushed back down
});

test("umbrella: the runner is latched open, then slides down and folds the canopy; pushed up, it opens", async ({
  page,
}) => {
  await ready(page, "umbrella");
  let r = await joint(page, "runner");
  expect(r.stuck).toBe(true);
  await drag(page, [
    [0, -0.05, 0],
    [0, -0.15, 0],
    [0, -0.6, 0],
  ]);
  await tick(page, 1);
  r = await joint(page, "runner");
  expect(r.v).toBeLessThan(-0.35);
  expect(r.stuck).toBe(false);
  let p = await parts(page);
  expect(p.panel0.angle).toBeGreaterThan(0.6); // folded down
  expect(p.panel3.angle).toBeCloseTo(p.panel0.angle, 6); // all eight together
  expect(await events(page)).toContain("free");
  // It stays where it was left.
  const v = r.v;
  await tick(page, 1);
  expect((await joint(page, "runner")).v).toBeCloseTo(v, 3);
  // Pushed back up: open again, on its stop.
  await drag(page, [
    [0, -0.05 + v, 0],
    [0, 0.2, 0],
  ]);
  await tick(page, 1);
  r = await joint(page, "runner");
  expect(r.v).toBeCloseTo(0, 3);
  p = await parts(page);
  expect(p.panel0.angle).toBeLessThan(0.02);
});

test("desk fan: the head tilts up on its hinge and stays, still swinging", async ({ page }) => {
  await ready(page, "desk-fan");
  await drag(page, [
    [0, 0.85, 0.2],
    [0, 1.1, 0.05],
  ]);
  await tick(page, 1);
  const h = await joint(page, "head");
  expect(h.v).toBeLessThan(-0.15); // the front tipped up
  expect(h.v).toBeGreaterThanOrEqual(-0.5);
  await tick(page, 1);
  expect((await joint(page, "head")).v).toBeCloseTo(h.v, 3);
  // The swing goes on: the head's turn changes over time.
  const q1 = (await parts(page)).head.quat;
  await tick(page, 0.6);
  const q2 = (await parts(page)).head.quat;
  expect(Math.abs(q1[1] - q2[1]) + Math.abs(q1[3] - q2[3])).toBeGreaterThan(1e-3);
});

test("desk lamp: the shade turns at its joint and the pool of light moves over the desk", async ({
  page,
}) => {
  await ready(page, "lamp");
  await drag(page, [
    [0.55, 0.9, 0.1],
    [0.7, 1.0, 0.1],
    [0.85, 1.05, 0.1],
  ]);
  await tick(page, 1);
  const h = await joint(page, "head");
  expect(Math.abs(h.v)).toBeGreaterThan(0.2);
  const p = await parts(page);
  expect(Math.hypot(...p.pool.offset)).toBeGreaterThan(0.05);
  expect(p.pool.offset[1]).toBeCloseTo(0, 6); // it stays on the desk
  expect(p.glow.quat).toEqual(p.head.quat); // the glow turns with the shade
  // The upper arm bends at the elbow, carrying the head.
  const before = (await joint(page, "head")).pos;
  await drag(page, [
    [0.2, 1.06, -0.2],
    [0.3, 0.88, -0.2],
  ]);
  await tick(page, 1);
  expect(Math.abs((await joint(page, "upper")).v)).toBeGreaterThan(0.1);
  const after = (await joint(page, "head")).pos;
  expect(Math.hypot(...after.map((v, i) => v - before[i]))).toBeGreaterThan(0.05);
});

test("telescope: the draw tubes push in and pull out, and hold where left", async ({ page }) => {
  await ready(page, "telescope");
  const tele = await page.evaluate(() => {
    const d = [0.72, 0.5, -0.3];
    const l = Math.hypot(...d);
    return d.map((v) => v / l);
  });
  const at = (s) => [0 + tele[0] * s, 0.2 + tele[1] * s, tele[2] * s];
  // Push the eyepiece in: both tubes slide toward the main tube.
  await drag(page, [at(-0.85), at(-0.5), at(-0.2)]);
  await tick(page, 1);
  const t2 = await joint(page, "tube2");
  const t3 = await joint(page, "tube3");
  // Pushed on the eyepiece, the eyepiece tube slides in to its stop.
  expect(t3.v).toBeGreaterThan(0.25);
  expect(t3.v).toBeLessThanOrEqual(0.3 + 1e-6);
  expect(t2.v).toBeGreaterThanOrEqual(0);
  await tick(page, 1);
  expect((await joint(page, "tube3")).v).toBeCloseTo(t3.v, 3);
  // Then the middle tube, carrying it.
  await drag(page, [at(-0.49 + t2.v), at(-0.3), at(-0.15)]);
  await tick(page, 1);
  const t2b = await joint(page, "tube2");
  expect(t2b.v).toBeGreaterThan(t2.v + 0.1);
  expect((await joint(page, "tube3")).v).toBeCloseTo(t3.v, 3); // it rode along
  await reset(page);
  expect((await joint(page, "tube2")).v).toBeCloseTo(0, 3);
  expect((await joint(page, "tube3")).v).toBeCloseTo(0, 3);
});

test("potion bottle: the cork holds, pops out with a puff, and squeaks back in", async ({
  page,
}) => {
  await ready(page, "potion-bottle");
  // A short pull: it wiggles and stays.
  await drag(page, [
    [0, 0.9, 0.05],
    [0, 0.95, 0.05],
  ]);
  await tick(page, 0.5);
  let c = await joint(page, "cork");
  expect(c.broken).toBe(false);
  // Pulled out: it pops, with a puff (seen while the finger pulls).
  const puff = await page.evaluate(() => {
    const { player } = window.__splashery;
    const ho = player.handsOn;
    const [p0, p1] = [
      [0, 0.9, 0.05],
      [0, 1.35, 0.05],
    ].map((p) => player.screenPoint(p));
    ho.pressAt(player.fromRecipe([0, 0.9, 0.05]), p0[0], p0[1]);
    let puff = 0;
    for (let i = 1; i <= 20; i++) {
      ho.moveTo(p0[0], p0[1] + ((p1[1] - p0[1]) * i) / 20);
      player.tickFixed(1 / 60);
      player.tickFixed(1 / 60);
      puff = Math.max(puff, player.motion.out?.parts?.puff?.visible ?? 0);
    }
    return puff;
  });
  expect(await events(page)).toContain("snap");
  expect(puff).toBeGreaterThan(0.5);
  // Carried away, then brought back to the neck.
  await drag(
    page,
    [
      [0, 1.35, 0.05],
      [0.5, 1.35, 0.3],
      [0.45, 1.2, 0.3],
      [0.05, 1.0, 0.05],
    ],
    { held: true },
  );
  await tick(page, 1);
  c = await joint(page, "cork");
  expect(c.broken).toBe(false);
  for (let i = 0; i < 3; i++) expect(c.pos[i]).toBeCloseTo(c.home[i], 3);
  expect(await events(page)).toContain("socket");
});

test("fountain pen: the cap comes off the nib and posts on the back end, turned round", async ({
  page,
}) => {
  await ready(page, "fountain-pen");
  await drag(
    page,
    [
      [-0.55, -0.03, 0.115],
      [-0.75, -0.03, 0.115],
      [-0.95, 0.1, 0.2],
      [0.2, 0.35, 0.3],
      [1.1, 0.1, 0.2],
      [1.1, -0.03, 0.115],
    ],
    { steps: 15 },
  );
  await tick(page, 1);
  const c = await joint(page, "cap");
  expect(c.broken).toBe(false); // held fast again, on the back end
  expect(c.pos[0]).toBeCloseTo(2 * 0.2835 + 0.545 - 0.12, 2);
  expect(await events(page)).toEqual(expect.arrayContaining(["snap", "socket"]));
  await reset(page);
  const h = await joint(page, "cap");
  for (let i = 0; i < 3; i++) expect(h.pos[i]).toBeCloseTo(h.home[i], 4);
});

test("open me: with the switch off, the toys play as before (no hand parts)", async ({ page }) => {
  await page.goto(APP);
  await page.waitForSelector("body[data-ready='true']", { timeout: 180_000 });
  for (const id of [
    "book",
    "clock",
    "gift-box",
    "umbrella",
    "desk-fan",
    "lamp",
    "telescope",
    "potion-bottle",
  ]) {
    // prettier-ignore
    const r = await page.evaluate(async (id) => {
      const { app, player } = window.__splashery;
      await app.chooseToy(id);
      for (let i = 0; i < 30; i++) player.update(1 / 60);
      return { on: player.handsOn.on, parts: player.motion.handsParts };
    }, id);
    expect(r.on).toBe(false);
    expect(r.parts).toBe(null);
  }
});
