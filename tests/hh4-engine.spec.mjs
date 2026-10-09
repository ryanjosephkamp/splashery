// Lane Hands-on H4's engine PR (docs/handoff/HandsH4.md): a recipe's own
// push on its bodies (`hands.force`) and where a piece is, for its drive
// (`info.hands.piece(key)`; `hands.watch`). Measured in the app on the
// flying saucer's cow, with a hands block given here.

import { test, expect } from "@playwright/test";

const APP = "/?renderer=webgl2&adapt=off&profile=mid";

// Opens the saucer with a hands block made in the page (functions can't be
// passed in): `kind` picks the block.
async function open(page, kind) {
  await page.goto(APP);
  await page.waitForSelector("body[data-ready='true']", { timeout: 180_000 });
  await page.evaluate(async (kind) => {
    const { app, player } = window.__splashery;
    await app.chooseToy("ufo");
    player.opts.idleDelay = 1e9;
    const half = [0.42, 0.27, 0.17];
    const points = [];
    for (const x of [-1, 1]) for (const y of [-1, 1]) for (const z of [-1, 1]) points.push([x * half[0], y * half[1], z * half[2]]); // prettier-ignore
    const cow = { part: "cow", pos: [0, -1.45, 0], pivot: [0, -1.45, 0], solid: { type: "box", half }, points, mass: 1, pick: [0.45, 0.32, 0.2] }; // prettier-ignore
    const calls = (window.__hh4 = { n: 0, ctx: null });
    const hands = { floor: -2.35, place: false, pieces: () => [cow] };
    if (kind === "force")
      hands.force = (b, h, ctx) => {
        calls.n++;
        calls.ctx = { part: ctx.piece?.part ?? null, beam: ctx.c.beam, G: ctx.G, R: ctx.R, data: "data" in ctx }; // prettier-ignore
        if (!b.pinned) b.vel[1] += 1.5 * ctx.G * h; // lifts more than its weight
      };
    if (kind === "watch") {
      hands.watch = true;
      // A body with no part or token: a drive reads it by its name.
      const ghost = { name: "ghost", pos: [0.9, -1.9, 0], solid: { type: "sphere", r: 0.1 }, points: [[0, -0.1, 0]] }; // prettier-ignore
      hands.pieces = () => [cow, ghost];
    }
    player.toyInfo.recipe.hands = hands;
    player.handsOn.attach(player.toyInfo);
  }, kind);
  await page.click("#hands-toggle");
}

const frames = (page, n) =>
  page.evaluate((n) => {
    const { player } = window.__splashery;
    for (let i = 0; i < n; i++) player.update(1 / 60);
  }, n);

// Builds the world and lets the cow go where it hangs (as a knock would).
const loosen = (page) =>
  page.evaluate(() => {
    const h = window.__splashery.player.handsOn;
    h.ensure();
    const b = h.pieces[0].body;
    h.free(b);
    h.moved = true;
    h.world.wake();
    return b.pos[1];
  });

const cowY = (page) => page.evaluate(() => window.__splashery.player.handsOn.pieces[0].body.pos[1]); // prettier-ignore

test("hands.force: the recipe's push moves a loose piece each substep", async ({ page }) => {
  await open(page, "force");
  const y0 = await loosen(page);
  await frames(page, 30);
  const y1 = await cowY(page);
  const ctx = await page.evaluate(() => window.__hh4);
  expect(ctx.n).toBeGreaterThan(30 * 5); // once per substep, not per frame
  expect(ctx.ctx.part).toBe("cow");
  expect(ctx.ctx.beam).toBeGreaterThan(0.5); // the toy's eased controls (the beam is on)
  expect(ctx.ctx.G / ctx.ctx.R).toBeCloseTo(26, 0);
  expect(ctx.ctx.data).toBe(true);
  // 1.5 g up against 1 g down: it rises.
  expect(y1).toBeGreaterThan(y0 + 0.3);
});

test("hands.force: without it the same cow falls to the grass", async ({ page }) => {
  await open(page, "plain");
  const y0 = await loosen(page);
  await frames(page, 90);
  const y1 = await cowY(page);
  expect(y1).toBeLessThan(y0 - 0.4);
  expect(y1).toBeGreaterThan(-2.35); // on the floor, not through it
});

test("info.hands.piece: a drive reads where a piece is", async ({ page }) => {
  await open(page, "watch");
  const before = await page.evaluate(() => {
    const { player } = window.__splashery;
    return { hands: !!player.motion.hands, piece: player.motion.hands?.piece("cow") };
  });
  expect(before.hands).toBe(true);
  expect(before.piece).toBe(null); // no world yet
  await loosen(page);
  await frames(page, 60);
  const s = await page.evaluate(() => {
    const { player } = window.__splashery;
    const p = player.motion.hands.piece("cow");
    const body = player.handsOn.pieces[0].body.pos;
    return { p, body, none: player.motion.hands.piece("nothing") };
  });
  expect(s.p.off).toBe(true);
  expect(s.p.held).toBe(false);
  expect(s.p.home).toEqual([0, -1.45, 0]);
  expect(s.p.pos[1]).toBeCloseTo(s.body[1], 5);
  expect(s.p.pos[1]).toBeLessThan(-1.6); // it fell
  expect(s.p.quat.length).toBe(4);
  expect(s.none).toBe(null);
  const extra = await page.evaluate(() => {
    const hands = window.__splashery.player.motion.hands;
    return { ghost: hands.piece("ghost"), moved: hands.moved };
  });
  expect(extra.ghost.home).toEqual([0.9, -1.9, 0]);
  expect(extra.moved).toBe(true);
  // ↺ brings it home, pinned again.
  await page.click("#hands-reset");
  await frames(page, 60);
  const back = await page.evaluate(() => window.__splashery.player.motion.hands.piece("cow"));
  expect(back.off).toBe(false);
  expect(back.pos[1]).toBeCloseTo(-1.45, 3);
});

test("a floating toy can be pushed down below where it stands; others can't", async ({ page }) => {
  await page.goto(APP);
  await page.waitForSelector("body[data-ready='true']", { timeout: 180_000 });
  const pushDown = (water) =>
    page.evaluate(async (water) => {
      const { app, player } = window.__splashery;
      await app.chooseToy("submarine");
      player.opts.idleDelay = 1e9;
      player.toyInfo.recipe.hands = water ? { water: { density: 0.62 } } : {};
      const h = player.handsOn;
      h.attach(player.toyInfo);
      h.setOn(true);
      const tick = (n) => {
        for (let i = 0; i < n; i++) player.update(1 / 60);
      };
      tick(5);
      const c = player.toyInfo.center.slice();
      const s = player.stage.toScreen(c);
      h.pressAt(c, s[0], s[1]);
      for (let k = 1; k <= 30; k++) {
        h.moveTo(s[0], s[1] + (150 * k) / 30);
        tick(2);
      }
      tick(20);
      const b = h.body;
      const down = (b.home.pos[1] - b.pos[1]) / player.toyInfo.radius;
      h.release();
      tick(120);
      const after = (b.home.pos[1] - b.pos[1]) / player.toyInfo.radius;
      return { down, after };
    }, water);
  const floats = await pushDown(true);
  expect(floats.down).toBeGreaterThan(0.25); // held well under its line
  expect(Math.abs(floats.after)).toBeLessThan(0.15); // and bobbed back up
  const solid = await pushDown(false);
  expect(solid.down).toBeLessThan(0.05); // not into its floor
});

test("hands.carry: a held piece carries the other; let go, both fall and land together", async ({
  page,
}) => {
  await page.goto(APP);
  await page.waitForSelector("body[data-ready='true']", { timeout: 180_000 });
  const r = await page.evaluate(async () => {
    const { app, player } = window.__splashery;
    await app.chooseToy("leaning-tower");
    player.opts.idleDelay = 1e9;
    const ball = (part, pos, r, mass) => ({ part, pos, pivot: pos, solid: { type: "sphere", r }, mass, restitution: 0.1, pick: [r * 1.4, r * 1.4, r * 1.4] }); // prettier-ignore
    player.toyInfo.recipe.hands = {
      floor: 0,
      place: false,
      area: 1.2,
      pieces: () => [ball("ball0", [0.9, 0.1, 0.3], 0.1, 3.4), ball("ball1", [0.9, 0.066, 0.6], 0.066, 1)], // prettier-ignore
      carry: { ball0: ["ball1"] },
    };
    const h = player.handsOn;
    h.attach(player.toyInfo);
    h.setOn(true);
    const tick = (n) => {
      for (let i = 0; i < n; i++) player.update(1 / 60);
    };
    tick(3);
    h.ensure();
    const [b0, b1] = h.pieces.map((p) => p.body);
    const s = player.screenPoint(b0.pos);
    h.pressAt(player.fromRecipe(b0.pos), s[0], s[1]);
    for (let k = 1; k <= 40; k++) {
      h.moveTo(s[0], s[1] - 6 * k);
      tick(2);
    }
    tick(30); // held still, up high
    const gap = Math.hypot(...b1.pos.map((v, i) => v - b0.pos[i]));
    const up = [b0.pos[1], b1.pos[1]];
    h.release();
    let land0 = null;
    let land1 = null;
    for (let i = 0; i < 180 && (land0 === null || land1 === null); i++) {
      tick(1);
      if (land0 === null && b0.pos[1] < 0.1 + 0.01) land0 = i;
      if (land1 === null && b1.pos[1] < 0.066 + 0.01) land1 = i;
    }
    return { gap, up, land0, land1, free: !b1.pinned };
  });
  expect(r.up[0]).toBeGreaterThan(0.6); // lifted
  expect(r.up[1]).toBeGreaterThan(0.5); // and the other with it
  expect(r.gap).toBeCloseTo(Math.hypot(0.034, 0.3), 1); // side by side as built
  expect(r.free).toBe(true);
  expect(r.land0).not.toBe(null);
  expect(r.land1).not.toBe(null);
  expect(Math.abs(r.land0 - r.land1)).toBeLessThanOrEqual(3); // within a few frames
});

test("wheels.lift: a drag up the screen lifts the toy; along, it rolls", async ({ page }) => {
  await page.goto(APP);
  await page.waitForSelector("body[data-ready='true']", { timeout: 180_000 });
  const drag = (dx, dy, lift) =>
    page.evaluate(
      async ({ dx, dy, lift }) => {
        const { app, player } = window.__splashery;
        await app.chooseToy("bus");
        player.opts.idleDelay = 1e9;
        player.toyInfo.recipe.hands = { wheels: { axle: [0, 0, 1], r: 0.3, parts: ["front", "rear"], lift } }; // prettier-ignore
        const h = player.handsOn;
        h.attach(player.toyInfo);
        h.setOn(true);
        const tick = (n) => {
          for (let i = 0; i < n; i++) player.update(1 / 60);
        };
        tick(5);
        const c = player.toyInfo.center.slice();
        const s = player.stage.toScreen(c);
        h.pressAt(c, s[0], s[1]);
        for (let k = 1; k <= 20; k++) {
          h.moveTo(s[0] + (dx * k) / 20, s[1] + (dy * k) / 20);
          tick(2);
        }
        const held = !!h.hold && h.mode === "toy";
        const b = h.body;
        const up = (b.pos[1] - b.home.pos[1]) / player.toyInfo.radius;
        h.release();
        return { held, up };
      },
      { dx, dy, lift },
    );
  const lifted = await drag(0, -80, true);
  expect(lifted.held).toBe(true);
  expect(lifted.up).toBeGreaterThan(0.1);
  const rolled = await drag(80, 0, true);
  expect(rolled.held).toBe(false); // along the screen it is pushed, as before
  const plain = await drag(0, -80, false);
  expect(plain.held).toBe(false); // without lift, wheels never lift
});
