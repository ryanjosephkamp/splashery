// Lane Hands-on H4, Tiny world (docs/handoff/HandsH4.md): with the ✋
// switch on, the bacterium pulls apart into two, the red blood cell
// stretches and springs back, the DNA unzips as far as it is pulled, the
// white blood cell catches the bacterium it is given, the diatom's lid lifts
// off and clicks back, and the chromosome's chromatids pull apart and spring
// back. Each piece measured.

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

const grab = (page, pts, o) => drag(page, pts, o?.steps ?? 6);

test("bacterium: pulled a little it snaps back; pulled past the pinch it stays two cells", async ({
  page,
}) => {
  await open(page, "bacterium");
  await grab(page, [
    [0.3, 0.12, -0.17],
    [0.35, 0.14, -0.2],
    [0.4, 0.16, -0.22],
  ]);
  await tick(page, 120);
  expect((await joint(page)).v).toBeLessThan(0.01); // snapped back whole
  await grab(page, [
    [0.3, 0.12, -0.17],
    [0.55, 0.22, -0.31],
    [0.8, 0.33, -0.45],
  ]);
  await tick(page, 120);
  const v = (await joint(page)).v;
  expect(v).toBeGreaterThan(0.2); // the daughters stay apart
  const parts = await page.evaluate(() => window.__splashery.player.motion.handsParts);
  expect(parts.top.offset[0]).toBeCloseTo(-parts.bottom.offset[0], 5); // each half its own way
  await reset(page);
  expect((await joint(page)).v).toBeLessThan(1e-6);
});

test("red blood cell: pinched, it bends and springs back round", async ({ page }) => {
  await open(page, "red-blood-cell");
  const r = await page.evaluate(() => {
    const { player } = window.__splashery;
    const h = player.handsOn;
    const tick = (n) => {
      for (let i = 0; i < n; i++) player.update(1 / 60);
    };
    const c = player.toyInfo.center.slice();
    const s = player.stage.toScreen(c);
    h.pressAt(c, s[0] + 40, s[1]);
    for (let k = 1; k <= 20; k++) {
      h.moveTo(s[0] + 40 + 3 * k, s[1] - 2 * k);
      tick(2);
    }
    const held = JSON.stringify(h.state().soft);
    const stretching = !!h.softParts?.stretch;
    h.release();
    tick(180);
    return { held: held.length, stretching, after: h.state() };
  });
  expect(r.stretching).toBe(true);
  expect(r.after.holding).toBe(false);
});

test("dna: pulled apart near the top it unzips as far as pulled, and zips back", async ({
  page,
}) => {
  await open(page, "dna");
  await grab(
    page,
    [
      [0.1, 1.4, 0.2],
      [0.5, 1.4, 0.2],
      [0.9, 1.4, 0.2],
    ],
    { steps: 6 },
  );
  const a = await joint(page);
  expect(a.v).toBeGreaterThan(0.3);
  const u = await page.evaluate(() => window.__splashery.player.motion.ctx.kit.data.h4.u);
  expect(u).toBeCloseTo(a.v / 0.9, 1);
  await tick(page, 240);
  expect((await joint(page)).v).toBeLessThan(0.01); // zipped back
});

test("white blood cell: the bacterium let go near it is caught and drawn in", async ({ page }) => {
  await open(page, "white-blood-cell");
  const p0 = await page.evaluate(() => {
    const h = window.__splashery.player.handsOn;
    h.ensure();
    return h.pieces[0].body.pos.slice();
  });
  await grab(page, [p0, [p0[0] - 0.2, p0[1] - 0.1, p0[2]], [p0[0] - 0.45, p0[1] - 0.2, p0[2]]], { steps: 8 }); // prettier-ignore
  await tick(page, 200);
  const r = await page.evaluate(() => {
    const { player } = window.__splashery;
    const b = player.handsOn.pieces[0].body;
    return { caught: !!b.caught, pos: b.pos };
  });
  expect(r.caught).toBe(true);
  // At F, just under the front of the membrane.
  const F = [0.6, 0.33, 0.12];
  expect(Math.hypot(...r.pos.map((v, i) => v - F[i]))).toBeLessThan(0.08);
});

test("diatom: the lid lifted off clicks back onto its base", async ({ page }) => {
  await open(page, "diatom");
  const p0 = await page.evaluate(() => {
    const h = window.__splashery.player.handsOn;
    h.ensure();
    return h.pieces[0].body.pos.slice();
  });
  await grab(page, [p0, [p0[0] + 0.3, p0[1] + 0.5, p0[2]], [p0[0] + 0.6, p0[1] + 0.9, p0[2]]], { steps: 8 }); // prettier-ignore
  await tick(page, 30);
  const off = await page.evaluate(() => window.__splashery.player.handsOn.pieces[0].body.pos.slice()); // prettier-ignore
  expect(Math.hypot(...off.map((v, i) => v - p0[i]))).toBeGreaterThan(0.6); // off, and stays (no gravity)
  await grab(page, [off, [p0[0] + 0.3, p0[1] + 0.4, p0[2]], [p0[0] + 0.05, p0[1] + 0.1, p0[2]]], { steps: 8 }); // prettier-ignore
  await tick(page, 60);
  const back = await page.evaluate(() => {
    const h = window.__splashery.player.handsOn;
    return { pos: h.pieces[0].body.pos, ev: h.joints.events.map((e) => e.kind) };
  });
  expect(Math.hypot(...back.pos.map((v, i) => v - p0[i]))).toBeLessThan(0.005);
  expect(back.ev).toContain("socket");
});

test("chromosome: the chromatids pulled apart at the waist spring back together", async ({
  page,
}) => {
  await open(page, "chromosome");
  await grab(page, [
    [0.05, 0.25, 0],
    [0.3, 0.25, 0],
    [0.6, 0.25, 0],
  ]);
  const a = await joint(page);
  expect(a.v).toBeGreaterThan(0.2);
  const pull = await page.evaluate(() => window.__splashery.player.motion.ctx.kit.data.h4.pull);
  expect(pull).toBeCloseTo(a.v / 0.62, 1);
  await tick(page, 200);
  expect((await joint(page)).v).toBeLessThan(0.01);
});
