// Lane Hands-on H4, Landmarks (docs/handoff/HandsH4.md): with the ✋ switch
// on, the supertall twists and springs back, Galileo's two balls fall and
// land together, the lintels of Stonehenge stack, Big Ben's hands turn and
// strike the bell, the drawbridge swings on its hinge, the pagoda's chimes
// swing and ring, and the windmill's sails spin. Each piece measured.

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

test("supertall: dragged round it twists, each band by its height, and springs back", async ({
  page,
}) => {
  await open(page, "supertall");
  await drag(page, [
    [0.3, 3.0, 0.3],
    [0.0, 3.0, 0.45],
    [-0.35, 3.0, 0.3],
  ]);
  const a = await joint(page);
  expect(Math.abs(a.v)).toBeGreaterThan(0.4);
  const parts = await page.evaluate(() => window.__splashery.player.motion.handsParts);
  // A band halfway up turns about half as far as the top one.
  const yaw = (q) => 2 * Math.atan2(q[1], q[3]);
  expect(yaw(parts.floor5.quat) / yaw(parts.floor11.quat)).toBeCloseTo(5.5 / 11.5, 2);
  const tr = [];
  for (let i = 0; i < 12; i++) {
    await tick(page, 8);
    tr.push((await joint(page)).v);
  }
  expect(tr.some((v) => Math.sign(v) !== Math.sign(a.v))).toBe(true); // sways past straight
  await tick(page, 240);
  expect(Math.abs((await joint(page)).v)).toBeLessThan(0.02);
});

test("leaning tower: the two balls, lifted together and let go, land together", async ({
  page,
}) => {
  await open(page, "leaning-tower");
  const r = await page.evaluate(() => {
    const { player } = window.__splashery;
    const h = player.handsOn;
    const tick = (n) => {
      for (let i = 0; i < n; i++) player.update(1 / 60);
    };
    h.ensure();
    const [b0, b1] = h.pieces.map((p) => p.body);
    const s = player.screenPoint(b0.pos);
    h.pressAt(player.fromRecipe(b0.pos), s[0], s[1]);
    for (let k = 1; k <= 40; k++) {
      h.moveTo(s[0], s[1] - 8 * k);
      tick(2);
    }
    tick(30);
    const up = [b0.pos[1], b1.pos[1]];
    h.release();
    const land = [null, null];
    for (let i = 0; i < 200 && land.includes(null); i++) {
      tick(1);
      [b0, b1].forEach((b, j) => {
        if (land[j] === null && b.pos[1] - b.solid.r < 0.02 + 0.01) land[j] = i;
      });
    }
    tick(120);
    return { up, land, rest: [b0.pos[1], b1.pos[1]], vis: player.motion.handsParts.ball1.visible ?? 1 }; // prettier-ignore
  });
  expect(r.up[0]).toBeGreaterThan(0.8); // lifted high
  expect(Math.abs(r.up[0] - r.up[1])).toBeLessThan(0.15); // side by side
  expect(r.land[0]).not.toBe(null);
  expect(Math.abs(r.land[0] - r.land[1])).toBeLessThanOrEqual(2); // the same moment
  expect(r.rest[0]).toBeCloseTo(0.12, 2); // resting on the lawn
  expect(r.rest[1]).toBeCloseTo(0.086, 2);
  expect(r.vis).toBe(1);
});

test("stonehenge: a lintel lifted off and set on another stacks on it", async ({ page }) => {
  await open(page, "stonehenge");
  const n = await page.evaluate(() => {
    const h = window.__splashery.player.handsOn;
    h.ensure();
    return h.pieces.length;
  });
  expect(n).toBe(13);
  const pos = (i) => page.evaluate((i) => window.__splashery.player.handsOn.pieces[i].body.pos, i); // prettier-ignore
  const place = (i, to) =>
    page.evaluate(
      ({ i, to }) => {
        const { player } = window.__splashery;
        const h = player.handsOn;
        const tick = (n) => {
          for (let k = 0; k < n; k++) player.update(1 / 60);
        };
        const from = h.pieces[i].body.pos.slice();
        const pts = [from, [(from[0] + to[0]) / 2, 0.6, (from[2] + to[2]) / 2], to];
        const s = pts.map((p) => player.screenPoint(p));
        h.pressAt(player.fromRecipe(pts[0]), s[0][0], s[0][1]);
        for (let k = 1; k < s.length; k++)
          for (let j = 1; j <= 8; j++) {
            const f = j / 8;
            h.moveTo(s[k - 1][0] + (s[k][0] - s[k - 1][0]) * f, s[k - 1][1] + (s[k][1] - s[k - 1][1]) * f); // prettier-ignore
            tick(2);
          }
        tick(30);
        h.release();
        tick(90);
      },
      { i, to },
    );
  await place(0, [0.1, 0.3, 0.3]);
  const a = await pos(0);
  expect(a[1]).toBeCloseTo(0.0375, 2); // flat on the grass
  await place(1, a);
  const b = await pos(1);
  expect(b[1]).toBeCloseTo(0.0375 + 0.075, 2); // on top of it
  expect(Math.hypot(b[0] - a[0], b[2] - a[2])).toBeLessThan(0.08);
  await reset(page);
  const back = await pos(0);
  expect(back[1]).toBeGreaterThan(0.4); // home on its uprights
});

test("big ben: the minute hand dragged round; the hour hand follows; the hour strikes", async ({
  page,
}) => {
  await open(page, "big-ben");
  const cues = await page.evaluate(() => {
    const { player } = window.__splashery;
    const list = (window.__cues = []);
    player.on("cue", (c) => list.push(...c.map((x) => x.voice)));
    return true;
  });
  expect(cues).toBe(true);
  // Twice round the dial.
  const c = [0, 4.95, 0.62];
  const ring = [];
  for (let i = 0; i <= 16; i++) {
    const a = (i / 8) * Math.PI * 2;
    ring.push([c[0] + 0.28 * Math.sin(a), c[1] + 0.28 * Math.cos(a), c[2]]);
  }
  await drag(page, ring, 3);
  const s = await page.evaluate(() => {
    const { player } = window.__splashery;
    const p = player.motion.handsParts;
    return { m: p.minute0.angle, h: p.hour0.angle, m2: p.minute2.angle, cues: window.__cues };
  });
  const j = await joint(page);
  expect(Math.abs(j.w)).toBe(0); // a clock hand doesn't coast
  expect(s.m).toBeCloseTo(j.v, 5);
  expect(s.m2).toBeCloseTo(s.m, 5); // every dial agrees
  const now = new Date();
  const mins = now.getMinutes() + now.getSeconds() / 60;
  const real = { m: (-2 * Math.PI * mins) / 60, h: (-2 * Math.PI * ((now.getHours() % 12) + mins / 60)) / 12 }; // prettier-ignore
  expect(s.h - real.h).toBeCloseTo((s.m - real.m) / 12, 2);
  expect(Math.abs(s.m - real.m)).toBeGreaterThan(6); // went round
  expect(s.cues).toContain("bell"); // passed an hour
});

test("castle: the drawbridge swings down and stays where it is let go", async ({ page }) => {
  await open(page, "castle");
  await page.evaluate(() => window.__splashery.player.handsOn.ensure());
  await tick(page, 2);
  const a = await joint(page);
  expect(a.v).toBeCloseTo(-1.45, 2); // up, as the toy starts
  await drag(page, [
    [0, 0.55, 1.12],
    [0, 0.5, 1.4],
    [0, 0.4, 1.6],
  ]);
  await tick(page, 60);
  const b = await joint(page);
  expect(b.v).toBeGreaterThan(-1.2);
  expect(b.v).toBeLessThan(-0.2); // part way
  await tick(page, 120);
  expect((await joint(page)).v).toBeCloseTo(b.v, 3); // held by its chains
});

test("pagoda: a roof's chimes, pushed, swing back and forth and ring", async ({ page }) => {
  await open(page, "pagoda");
  await page.evaluate(() => {
    const list = (window.__cues = []);
    window.__splashery.player.on("cue", (c) => list.push(...c.map((x) => x.voice)));
  });
  await drag(page, [
    [0.9, 1.2, 0.9],
    [1.0, 1.2, 0.8],
    [1.1, 1.2, 0.7],
  ]);
  const tr = [];
  for (let i = 0; i < 20; i++) {
    await tick(page, 4);
    const st = await page.evaluate(() => window.__splashery.player.handsOn.joints.state());
    tr.push(st.find((j) => Math.abs(j.v) > 1e-4 || Math.abs(j.w) > 1e-4)?.v ?? 0);
  }
  const crossings = tr.filter((v, i) => i && Math.sign(v) !== Math.sign(tr[i - 1])).length;
  expect(crossings).toBeGreaterThanOrEqual(2);
  expect(Math.max(...tr.map(Math.abs))).toBeLessThanOrEqual(0.07 + 1e-6);
  expect(await page.evaluate(() => window.__cues)).toContain("chimes");
});

test("windmill: a flick spins the sails, which coast to a stop", async ({ page }) => {
  await open(page, "windmill");
  await drag(
    page,
    [
      [0.9, 2.9, 0.7],
      [0.2, 3.3, 0.6],
      [-0.6, 2.9, 0.4],
    ],
    4,
  );
  const a = await joint(page);
  expect(Math.abs(a.w)).toBeGreaterThan(1);
  await tick(page, 60);
  const b = await joint(page);
  expect(Math.abs(b.w)).toBeLessThan(Math.abs(a.w));
  await tick(page, 900);
  expect(Math.abs((await joint(page)).w)).toBeLessThan(0.1);
});
