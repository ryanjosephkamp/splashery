// Lane Hands-on H3, the Holidays shelf (docs/HANDS-ON-PLAN.md): with the ✋
// switch on, each piece measured over time: the jack-o'-lantern's lid, the
// decorated tree's baubles when shaken, the patterned egg's spin and wobble
// and the paper lantern's swing.

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
  await page.evaluate(() => window.__splashery.player.handsOn.ensure());
  await tick(page, 0.1);
}

// Steps the clock by hand (SwiftShader draws slowly).
const tick = (page, secs) =>
  page.evaluate(
    (n) => {
      const { player } = window.__splashery;
      for (let i = 0; i < n; i++) player.update(1 / 60);
    },
    Math.round(secs * 60),
  );

// A finger drag through recipe points (each a place on screen).
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
  }
  for (let k = 1; k < px.length; k++)
    for (let i = 1; i <= steps; i++) {
      const f = i / steps;
      const [a, b] = [px[k - 1], px[k]];
      await page.mouse.move(a[0] + (b[0] - a[0]) * f, a[1] + (b[1] - a[1]) * f);
      await tick(page, 1 / 30);
    }
  if (!hold) await page.mouse.up();
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

test("jack-o'-lantern: the lid lifts off by its stem, lands, and drops back into place", async ({
  page,
}) => {
  await ready(page, "jack-o-lantern");
  await drag(page, [
    [0, 0.9, 0.2],
    [0, 1.4, 0.2],
    [1.3, 1.0, 0.5],
    [1.4, -0.3, 0.6],
  ]);
  await tick(page, 2);
  const lid = (await page.evaluate(() => window.__splashery.player.handsOn.state().bodies))[0];
  expect(Math.hypot(lid.pos[0] - lid.home[0], lid.pos[2] - lid.home[2])).toBeGreaterThan(0.8);
  expect(lid.pos[1]).toBeGreaterThan(-0.78); // on the table, not in it
  expect(lid.pos[1]).toBeLessThan(-0.4);
  await drag(page, [lid.pos, [1.2, 1.3, 0.4], [0.1, 1.2, 0.1], [0, 0.85, 0]], { steps: 15 });
  await tick(page, 1.5);
  const back = (await page.evaluate(() => window.__splashery.player.handsOn.state().bodies))[0];
  for (let i = 0; i < 3; i++) expect(back.pos[i]).toBeCloseTo(back.home[i], 3);
  expect(await events(page)).toContain("socket");
});

test("decorated tree: shaken, the baubles swing on their hooks, then settle; the lights stay off", async ({
  page,
}) => {
  await page.goto(APP);
  await page.waitForSelector("body[data-ready='true']", { timeout: 180_000 });
  const r = await page.evaluate(async () => {
    const { app, player } = window.__splashery;
    await app.chooseToy("decorated-tree");
    player.opts.idleDelay = 1e9;
    for (let i = 0; i < 30; i++) player.update(1 / 60);
    document.getElementById("hands-toggle").click();
    const h = player.handsOn;
    const c = player.stage.toScreen(player.toyInfo.center);
    h.pressAt(player.toyInfo.center.slice(), c[0], c[1]);
    h.moveTo(c[0], c[1] - 30);
    player.update(1 / 60);
    const angle = (q) => 2 * Math.acos(Math.min(1, Math.abs(q[3])));
    let most = 0;
    const each = new Set();
    for (let k = 1; k <= 60; k++) {
      h.moveTo(c[0] + 60 * Math.sin((k / 60) * 4 * Math.PI), c[1] - 30);
      player.update(1 / 60);
      const t = player.motion.out?.tokens || [];
      t.forEach((x, i) => {
        if (x?.quat && angle(x.quat) > 0.05) each.add(i);
        if (x?.quat) most = Math.max(most, angle(x.quat));
      });
    }
    h.release();
    for (let i = 0; i < 6 * 60; i++) player.update(1 / 60);
    const after = (player.motion.out?.tokens || []).reduce((m, x) => Math.max(m, x?.quat ? angle(x.quat) : 0), 0); // prettier-ignore
    const n = player.motion.ctx.kit.data.baubles.length;
    return { most, swung: each.size, n, after, lights: player.motion.state.lights };
  });
  expect(r.most).toBeGreaterThan(0.2);
  expect(r.most).toBeLessThan(0.9);
  expect(r.swung).toBeGreaterThan(r.n * 0.6); // most of them, each on its own
  expect(r.after).toBeLessThan(0.02); // settled
  expect(r.lights).toBe(0);
});

test("patterned egg: flicked, it spins on its end, slows, wobbles and stops", async ({ page }) => {
  await ready(page, "patterned-egg");
  // A quick sideways flick across its front.
  await drag(
    page,
    [
      [-0.4, 0.1, 0.4],
      [0.4, 0.1, 0.4],
    ],
    { steps: 4 },
  );
  await tick(page, 0.3);
  const w0 = Math.abs((await joint(page, "egg")).w);
  expect(w0).toBeGreaterThan(1);
  // Wobbling as it slows: the egg leans.
  let lean = 0;
  for (let i = 0; i < 12; i++) {
    await tick(page, 0.5);
    const q = (await parts(page)).egg.quat;
    // The lean: how far its own up is from the world's.
    const [x, y, z, w] = q;
    const up = [2 * (x * y - w * z), 1 - 2 * (x * x + z * z), 2 * (y * z + w * x)];
    lean = Math.max(lean, Math.acos(Math.min(1, up[1])));
  }
  expect(lean).toBeGreaterThan(0.02);
  expect(lean).toBeLessThan(0.2);
  await tick(page, 12);
  expect(Math.abs((await joint(page, "egg")).w)).toBeLessThan(0.05);
});

test("paper lantern: pushed, it swings on its string and settles", async ({ page }) => {
  await ready(page, "paper-lantern");
  await drag(page, [
    [0, 0.05, 0.9],
    [0.6, 0.15, 0.9],
  ]);
  const swing = [];
  for (let i = 0; i < 40; i++) {
    await tick(page, 0.1);
    swing.push((await joint(page, "lantern")).v);
  }
  // It goes both ways (a swing, not a lean)…
  expect(Math.max(...swing)).toBeGreaterThan(0.1);
  expect(Math.min(...swing)).toBeLessThan(-0.05);
  // …and dies away.
  await tick(page, 20);
  expect(Math.abs((await joint(page, "lantern")).v)).toBeLessThan(0.03);
});
