// Lane Hands-on H3's engine pieces (docs/PACKS.md, 5g, "Reseat", and 5f,
// "A forgiving press"): a broken-off piece with `reseat` clicks back into
// its place (or another seat) and holds fast there again; a press just off
// a thin toy's splats still takes it with the ✋ switch on.

import { test, expect } from "@playwright/test";
import { canPlay } from "../src/physics/hands-on.js";

const APP = "/?renderer=webgl2&adapt=off&profile=mid";

async function ready(page, id, side = null, extra = {}) {
  await page.goto(APP);
  await page.waitForSelector("body[data-ready='true']", { timeout: 180_000 });
  return page.evaluate(
    async ({ id, side, extra }) => {
      const { app, player } = window.__splashery;
      await app.chooseToy(id);
      player.opts.idleDelay = 1e9;
      // Each joint gets `reseat` (before Hands-on builds its world on the
      // first touch): home only, or with a second seat to the cane's side.
      const hands = player.toyInfo.recipe.hands;
      const orig = hands.joints;
      const d = player.proc.ctx.kit.data;
      const pos = side ? d.canes[1].pivot.map((v, i) => v + (i === 0 ? side : 0)) : null;
      hands.joints = (dd, info) =>
        orig(dd, info).map((j) => ({ ...j, reseat: pos ? { snap: 0.3, seats: [{ pos }] } : true, ...extra })); // prettier-ignore
      hands.joints.orig = orig;
      return pos;
    },
    { id, side, extra },
  );
}

async function handsOn(page) {
  await page.waitForTimeout(800);
  if (!(await page.evaluate(() => window.__splashery.player.handsOn.on)))
    await page.click("#hands-toggle");
  // A fixed clock: from here the page's own frames no longer step the toy
  // (on a loaded machine they come late and long, and step the physics
  // between the test's moves); only tick() does, 1/60 s at a time.
  await page.evaluate(() => {
    const { player } = window.__splashery;
    if (player.tickFixed) return;
    player.tickFixed = player.update.bind(player);
    player.update = () => {};
  });
}

// Puts the candy cane's joints back as they were (the recipe is shared).
const unpatch = (page) =>
  page.evaluate(() => {
    const hands = window.__splashery.player.toyInfo?.recipe?.hands;
    if (hands?.joints?.orig) hands.joints = hands.joints.orig;
  });

// Steps the toy n/60 s. (First one animation frame: the browser hands a
// page its mouse moves with its frames, so a move just sent is handled
// before the toy steps, however slow the machine is.)
const tick = (page, secs) =>
  page.evaluate(
    async (n) => {
      await new Promise((ok) => requestAnimationFrame(() => ok()));
      const { player } = window.__splashery;
      const step = player.tickFixed || player.update.bind(player);
      for (let i = 0; i < n; i++) step(1 / 60);
    },
    Math.round(secs * 60),
  );

// After a press: waits until Hands-on has taken it (the app picks first,
// which takes longer on a loaded machine; moves before that are ignored).
const taken = (page) =>
  page.waitForFunction(() => {
    const ho = window.__splashery.player.handsOn;
    return !!(ho.press || ho.hold);
  });

const screen = (page, pts) =>
  page.evaluate((pts) => {
    const { player } = window.__splashery;
    const r = player.stage.canvas.getBoundingClientRect();
    return pts.map((p) => {
      const s = player.screenPoint(p);
      return [r.left + s[0], r.top + s[1]];
    });
  }, pts);

// The finger, straight through Hands-on (press, moves, let go), stepped on
// the fixed clock in the page: what the engine does, without the browser's
// input timing (on a loaded machine its moves come late and in bunches).
// Points are recipe points; each move is one place on screen.
async function drag(page, points, { steps = 20, hold = false, held = false } = {}) {
  await page.evaluate(
    ({ points, steps, hold, held }) => {
      const { player } = window.__splashery;
      const ho = player.handsOn;
      const step = player.tickFixed || player.update.bind(player);
      const px = points.map((p) => player.screenPoint(p));
      if (!held) ho.pressAt(player.fromRecipe(points[0]), px[0][0], px[0][1]);
      for (let k = 1; k < px.length; k++)
        for (let i = 1; i <= steps; i++) {
          const f = i / steps;
          const [a, b] = [px[k - 1], px[k]];
          ho.moveTo(a[0] + (b[0] - a[0]) * f, a[1] + (b[1] - a[1]) * f);
          step(1 / 60);
          step(1 / 60);
        }
      if (!hold) ho.release();
    },
    { points, steps, hold, held },
  );
}

// Lets go (after a drag with `hold`).
const up = (page) => page.evaluate(() => window.__splashery.player.handsOn.release());

const joints = (page) => page.evaluate(() => window.__splashery.player.handsOn.joints?.state());
const events = (page) =>
  page.evaluate(() => window.__splashery.player.handsOn.joints.events.map((e) => e.kind));

// The front cane's top: a point on its shaft above the break, and the
// joint's own place.
const caneTop = (page) =>
  page.evaluate(() => {
    const cn = window.__splashery.player.proc.ctx.kit.data.canes[1];
    return cn.pivot.map((v, i) => v + cn.axis[i] * 0.45);
  });

// Snaps the front cane's top off and keeps holding it, out at `far`.
async function snapOff(page, a, far) {
  await drag(page, [a, [a[0] + 0.9, a[1] + 0.2, a[2] + 0.3], far], { hold: true });
  const js = await joints(page);
  const j = js.find((x) => x.broken);
  expect(j).toBeTruthy();
  return j;
}

test.afterEach(async ({ page }) => {
  if (page.url().startsWith("http")) await unpatch(page);
});

test("reseat: a snapped-off piece brought back clicks home and holds fast again", async ({
  page,
}) => {
  await ready(page, "candy-cane");
  await handsOn(page);
  const a = await caneTop(page);
  const far = [a[0] + 0.9, a[1] + 0.7, a[2] + 0.3];
  const j = await snapOff(page, a, far);
  // Brought back to where it broke off: it glides in and locks.
  await drag(page, [far, a], { held: true, steps: 30 });
  await up(page);
  await tick(page, 1);
  let now = (await joints(page)).find((x) => x.name === j.name);
  expect(now.broken).toBe(false);
  expect(now.pinned).toBe(true);
  for (let i = 0; i < 3; i++) expect(now.pos[i]).toBeCloseTo(now.home[i], 4);
  expect(await events(page)).toContain("socket");
  // Held fast again: a small pull bends it and it springs back.
  await drag(page, [a, [a[0] + 0.1, a[1], a[2]]]);
  await tick(page, 1);
  now = (await joints(page)).find((x) => x.name === j.name);
  expect(now.broken).toBe(false);
  for (let i = 0; i < 3; i++) expect(now.pos[i]).toBeCloseTo(now.home[i], 4);
  // A hard pull snaps it off again.
  await snapOff(page, a, far);
  await up(page);
});

test("reseat: a second seat takes it, and ↺ brings it home from there", async ({ page }) => {
  const seatPos = await ready(page, "candy-cane", -0.55);
  await handsOn(page);
  const seat = { pos: seatPos };
  const a = await caneTop(page);
  const far = [a[0] + 0.9, a[1] + 0.9, a[2] + 0.3];
  const j = await snapOff(page, a, far);
  // (Low, so the finger's ray never points at its home on the way.)
  const over = [far[0], seat.pos[1], seat.pos[2] + 0.3];
  await drag(page, [far, over, seat.pos], { held: true, steps: 30 });
  await up(page);
  await tick(page, 1);
  let now = (await joints(page)).find((x) => x.name === j.name);
  expect(now.broken).toBe(false);
  for (let i = 0; i < 3; i++) expect(now.pos[i]).toBeCloseTo(seat.pos[i], 4);
  // It stays there (held fast, not falling).
  await tick(page, 1.5);
  now = (await joints(page)).find((x) => x.name === j.name);
  for (let i = 0; i < 3; i++) expect(now.pos[i]).toBeCloseTo(seat.pos[i], 4);
  // Pulled off the seat again, it starts from there (not from home).
  const g = a.map((v, i) => v + seat.pos[i] - now.home[i]); // the same grip, at the seat
  const away = [g[0] - 0.9, g[1] + 0.2, g[2] + 0.3];
  let at = null;
  for (let i = 1; i <= 30 && !at; i++) {
    const p = g.map((v, k) => v + ((away[k] - v) * i) / 30);
    await drag(page, i === 1 ? [g, p] : [p, p], { steps: 1, hold: true, held: i > 1 });
    now = (await joints(page)).find((x) => x.name === j.name);
    if (now.broken) at = now.pos;
  }
  expect(at).toBeTruthy();
  // (The frame it snaps, it is still by the seat.)
  expect(Math.hypot(...at.map((v, i) => v - seat.pos[i]))).toBeLessThan(0.3);
  await drag(page, [away, over, seat.pos], { held: true, steps: 20 });
  await up(page);
  await tick(page, 1);
  now = (await joints(page)).find((x) => x.name === j.name);
  for (let i = 0; i < 3; i++) expect(now.pos[i]).toBeCloseTo(seat.pos[i], 4);
  // ↺: home from the seat, along the way.
  await page.click("#hands-reset");
  await tick(page, 0.2);
  now = (await joints(page)).find((x) => x.name === j.name);
  const d0 = Math.hypot(...now.pos.map((v, i) => v - now.home[i]));
  expect(d0).toBeGreaterThan(0.01);
  expect(d0).toBeLessThan(Math.hypot(...seat.pos.map((v, i) => v - now.home[i])));
  await tick(page, 1);
  now = (await joints(page)).find((x) => x.name === j.name);
  for (let i = 0; i < 3; i++) expect(now.pos[i]).toBeCloseTo(now.home[i], 4);
  expect(now.broken).toBe(false);
});

// A piece snapped off, held still for 1.5 s more: how far it has turned
// from its turn at home.
async function heldTurn(page, steady) {
  await ready(page, "candy-cane", null, { steady, reseat: false });
  await handsOn(page);
  const a = await caneTop(page);
  const far = [a[0] + 0.9, a[1] + 0.7, a[2] + 0.3];
  const j = await snapOff(page, a, far);
  const q = (n) =>
    page.evaluate((n) => {
      const jj = window.__splashery.player.handsOn.joints.list.find((x) => x.name === n);
      return jj.body.q.slice();
    }, n);
  // (From its turn at home: it snaps barely bent, then hangs, unless steady.)
  const q0 = await page.evaluate((n) => {
    const jj = window.__splashery.player.handsOn.joints.list.find((x) => x.name === n);
    return jj.pc.home.q.slice();
  }, j.name);
  await tick(page, 1.5);
  const q1 = await q(j.name);
  await up(page);
  const d = Math.abs(q0.reduce((s, v, i) => s + v * q1[i], 0));
  return 2 * Math.acos(Math.min(1, d));
}

test("steady: a piece snapped off is held at its turn, not swinging", async ({ page }) => {
  // (About its bend when it snapped, 0.2 rad.)
  expect(await heldTurn(page, true)).toBeLessThan(0.4);
});

test("without steady, a piece snapped off swings from the finger", async ({ page }) => {
  expect(await heldTurn(page, false)).toBeGreaterThan(1);
});

test("a forgiving press: off the lava lamp's splats, Hands-on still lifts it", async ({ page }) => {
  await page.goto(APP);
  await page.waitForSelector("body[data-ready='true']", { timeout: 180_000 });
  await page.evaluate(async () => {
    const { app, player } = window.__splashery;
    // (The lava lamp: one of the L1 sweep's center misses, picked up whole.
    // The desk lamp, its first test, now plays its joints piece by piece.)
    await app.chooseToy("lava-lamp");
    player.opts.idleDelay = 1e9;
  });
  await page.waitForTimeout(800);
  // A point inside the toy's box where the pick buffer finds nothing.
  const at = await page.evaluate(async () => {
    const { player } = window.__splashery;
    const r = player.stage.canvas.getBoundingClientRect();
    const info = player.toyInfo;
    const c = player.screenPoint(player.toRecipe(info.center));
    for (const [dx, dy] of [
      [0, 0],
      [10, 0],
      [-10, 0],
      [0, 10],
      [0, -10],
      [20, 20],
      [-20, 20],
      [20, -20],
      [-20, -20],
    ]) {
      // prettier-ignore
      player.pickDirty = true;
      if (!(await player.pickAt(c[0] + dx, c[1] + dy))) return { x: c[0] + dx, y: c[1] + dy, left: r.left, top: r.top }; // prettier-ignore
    }
    return null;
  });
  expect(at).toBeTruthy();
  // Off: nothing to take there.
  expect(await page.evaluate(({ x, y }) => window.__splashery.player.handsOn.nearPress(x, y), at)).toBe(null); // prettier-ignore
  await page.click("#hands-toggle");
  const p = await page.evaluate(({ x, y }) => window.__splashery.player.handsOn.nearPress(x, y), at); // prettier-ignore
  expect(p).toBeTruthy();
  // A drag from there picks the lava lamp up.
  await page.mouse.move(at.left + at.x, at.top + at.y);
  await page.mouse.down();
  await taken(page);
  for (let i = 1; i <= 20; i++) {
    await page.mouse.move(at.left + at.x, at.top + at.y - 6 * i);
    await tick(page, 1 / 30);
  }
  const lifted = await page.evaluate(() => {
    const b = window.__splashery.player.handsOn.body;
    return b ? b.pos[1] - b.home.pos[1] : 0;
  });
  await page.mouse.up();
  expect(lifted).toBeGreaterThan(0.1);
});

test("a shake with fire: false only reads as info.hands.shake (no tap fires)", async ({ page }) => {
  await page.goto(APP);
  await page.waitForSelector("body[data-ready='true']", { timeout: 180_000 });
  const r = await page.evaluate(async () => {
    const { app, player } = window.__splashery;
    await app.chooseToy("snow-globe");
    player.opts.idleDelay = 1e9;
    for (let i = 0; i < 30; i++) player.update(1 / 60);
    document.getElementById("hands-toggle").click();
    const hands = player.toyInfo.recipe.hands;
    const was = hands.shake;
    hands.shake = { fire: false };
    const h = player.handsOn;
    const c = player.stage.toScreen(player.toyInfo.center);
    h.pressAt(player.toyInfo.center.slice(), c[0], c[1]);
    h.moveTo(c[0], c[1] - 40);
    player.update(1 / 60);
    let felt = 0;
    let fired = 0;
    for (let k = 1; k <= 60; k++) {
      h.moveTo(c[0] + 70 * Math.sin((k / 60) * 4 * Math.PI), c[1] - 40);
      player.update(1 / 60);
      felt = Math.max(felt, player.motion.hands?.shake ?? 0);
      fired = Math.max(fired, player.motion.state.shake ?? 0);
    }
    h.release();
    hands.shake = was;
    return { felt, fired };
  });
  expect(r.felt).toBeGreaterThan(0.3);
  expect(r.fired).toBe(0);
});

test("a picture toy stays out of Hands-on unless it asks for joints", () => {
  const frame = { pictures: {}, turntable: false };
  expect(canPlay({ recipe: frame })).toBe(false);
  expect(canPlay({ recipe: { ...frame, hands: { joints: [] } } })).toBe(true);
  expect(canPlay({ recipe: { ...frame, hands: { joints: [] }, handsOn: false } })).toBe(false);
  expect(canPlay({ recipe: { turntable: false } })).toBe(false);
  expect(canPlay({ recipe: {} })).toBe(true);
});
