// Lane Arcade r3 (docs/handoff/ArcadeR3.md): the owner's walkthrough notes
// of October 9, 2026, game by game.

import { test, expect } from "@playwright/test";

const APP = "/?renderer=webgl2&adapt=off&watch=off&labs=1&profile=low";

async function open(page, toy, options = {}) {
  await page.goto(APP);
  await page.waitForSelector("body[data-ready='true']", { timeout: 120_000 });
  await page.evaluate(
    async ([toy, options]) => {
      const { app } = window.__splashery;
      await app.chooseToy(toy);
      for (const [k, v] of Object.entries(options)) await app.setToyOption(k, v);
    },
    [toy, options],
  );
  await page.waitForFunction(() => !!window.__splashery.player.arcade?.game, null, { timeout: 60_000 }); // prettier-ignore
  await page.evaluate(() => (window.__arc = window.__splashery.player.arcade));
}

const run = (page, secs) =>
  page.evaluate(
    (n) => {
      for (let i = 0; i < n; i++) {
        window.__arc.frame(1 / 60);
        window.__arc.pose(1 / 60);
      }
    },
    Math.round(secs * 60),
  );
const read = (page, fn, arg) => page.evaluate(fn, arg);

// One game step with these presses (the game's own clock).
const STEP = `(g, pressed = []) => g.step(1 / 120, { input: window.__arc.input.frame(), pressed: new Set(pressed), view: window.__arc.view, demo: false })`; // prettier-ignore

test("Shardball: the dome in 3D is the default; the ground takes the ball", async ({ page }) => {
  await open(page, "shardball");
  await run(page, 1.3);
  const r = await read(
    page,
    ([STEP]) => {
      const step = eval(STEP);
      const g = window.__arc.game;
      window.__arc.wake();
      const start = { style: g.style, view: window.__arc.viewTo, mode3d: g.mode3d, lives: g.lives };
      // A ball falling well away from the dish lands on the ground.
      g.paddle.x = -0.3;
      g.paddle.z = 0;
      g.ball.stuck = false;
      g.ball.off = null;
      g.ball.p = [0.35, -0.5, 0.1];
      g.ball.v = [0, -1, 0];
      let landed = null;
      for (let i = 0; i < 120 && !landed; i++) {
        step(g);
        if (g.downT > 0) landed = { y: g.ball.p[1], lives: g.lives };
      }
      for (let i = 0; i < 120; i++) step(g);
      return { start, landed, lives: g.lives, stuck: g.ball.stuck };
    },
    [STEP],
  );
  expect(r.start).toEqual({ style: "dome", view: 1, mode3d: true, lives: 3 });
  expect(r.landed, "the ball came to rest on the ground").not.toBeNull();
  expect(r.landed.y).toBeLessThan(-0.75);
  expect(r.landed.lives).toBe(3); // it lies there a moment first
  expect(r.lives).toBe(2);
  expect(r.stuck).toBe(true); // a new ball waits on the dish
});

test("Shardball: the dish catches and holds the ball, and a press launches it from there", async ({
  page,
}) => {
  await open(page, "shardball");
  await run(page, 1.3);
  const r = await read(
    page,
    ([STEP]) => {
      const step = eval(STEP);
      const g = window.__arc.game;
      window.__arc.wake();
      g.paddle.x = 0;
      g.paddle.z = 0;
      g.ball.stuck = false;
      g.ball.off = null;
      g.ball.p = [0.1, -0.4, 0];
      g.ball.v = [0, -0.5, 0];
      let caught = false;
      for (let i = 0; i < 200 && !caught; i++) {
        step(g);
        caught = g.ball.stuck;
      }
      // Held: the dish moves and the ball goes with it.
      const off = g.ball.off.slice();
      for (let i = 0; i < 60; i++) {
        g.paddle.x += 0.002;
        step(g);
      }
      const held = { stuck: g.ball.stuck, dx: g.ball.p[0] - g.paddle.x };
      step(g, ["fire"]);
      step(g);
      return { caught, off, held, v: g.ball.v.slice(), stuck: g.ball.stuck };
    },
    [STEP],
  );
  expect(r.caught).toBe(true);
  expect(r.off[0]).toBeGreaterThan(0.05); // where it landed, right of the middle
  expect(r.held.stuck).toBe(true);
  expect(r.held.dx).toBeCloseTo(r.off[0], 3);
  expect(r.stuck).toBe(false);
  expect(r.v[1]).toBeGreaterThan(1.5); // up
  expect(r.v[0]).toBeGreaterThan(0.1); // and outward, toward the side it sat on
});

test("Shardball: the flat board's paddle catches too; Page Breaker's still bounces", async ({
  page,
}) => {
  const drop = ([STEP]) => {
    const step = eval(STEP);
    const g = window.__arc.game;
    window.__arc.wake();
    g.ball.stuck = false;
    g.ball.p = [g.paddle.x + 0.05, g.geo.PADDLE_Y + 0.15, 0];
    g.ball.v = [0, -1.2, 0];
    for (let i = 0; i < 40; i++) step(g);
    return { stuck: g.ball.stuck, vy: g.ball.v[1] };
  };
  await open(page, "shardball", { style: "flat", view: "2d" });
  expect(await read(page, drop, [STEP])).toEqual({ stuck: true, vy: 0 });
  await open(page, "page-breaker");
  await page.waitForFunction(() => window.__arc.game.bricks?.length > 0, null, { timeout: 60_000 });
  const pb = await read(page, drop, [STEP]);
  expect(pb.stuck).toBe(false);
  expect(pb.vy).toBeGreaterThan(0);
});

test("Shardball: in the dome a drag on the dome turns the view a little, and a pinch zooms", async ({
  page,
}) => {
  await open(page, "shardball");
  await page.evaluate(() => window.__arc.wake());
  await run(page, 1.5);
  const before = await read(page, () => ({ ...window.__arc.cam }));
  // A finger down on the dome (the top of the stage), dragged right.
  const box = await page.locator(".arc-surface").boundingBox();
  const x = box.x + box.width * 0.5;
  const y = box.y + box.height * 0.25;
  await page.mouse.move(x, y);
  await page.mouse.down();
  for (let i = 1; i <= 6; i++) {
    await page.mouse.move(x + i * 15, y);
    await run(page, 0.05);
  }
  await page.mouse.up();
  await run(page, 0.6);
  const after = await read(page, () => ({ ...window.__arc.cam, look: { ...window.__arc.look } }));
  expect(after.look.yaw).toBeLessThan(-0.2);
  expect(after.look.yaw).toBeGreaterThanOrEqual(-0.75); // a little, not all the way round
  expect(after.yaw).toBeLessThan(before.yaw - 0.15);
  // The wheel (a pinch on a phone) zooms, within its limits.
  await page.mouse.wheel(0, 2000);
  await run(page, 0.6);
  const zoomed = await read(page, () => window.__arc.look.zoom);
  expect(zoomed).toBeCloseTo(Math.log(1.3), 3);
  // Back in 2D the look eases back to straight.
  await page.evaluate(() => window.__arc.toggleView());
  await run(page, 2);
  const flat = await read(page, () => window.__arc.look);
  expect(Math.abs(flat.yaw) + Math.abs(flat.zoom)).toBeLessThan(0.01);
});

test("Strata starts in 2D in the classic 10 by 20 slot", async ({ page }) => {
  await open(page, "strata");
  const r = await read(page, () => {
    const g = window.__arc.game;
    return { W: g.W, D: g.D, H: g.H, view: window.__arc.viewTo };
  });
  expect(r).toEqual({ W: 10, D: 1, H: 20, view: 0 });
});

test.describe("on a phone", () => {
  test.use({ viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true });

  test("Strata: a ⟳ Turn button by the right thumb, and a tap on the stone turns it", async ({
    page,
  }) => {
    await open(page, "strata");
    await page.tap(".arc-enter");
    await expect.poll(() => read(page, () => window.__arc.playMode)).toBe(true);
    // The turn button: plainly labeled, at the bottom right, inside the screen.
    const btn = page.locator(".arc-key", { hasText: "Turn" });
    await expect(btn).toBeVisible();
    const b = await btn.boundingBox();
    expect(b.x + b.width).toBeLessThanOrEqual(390);
    expect(b.x).toBeGreaterThan(390 / 2);
    expect(b.y).toBeGreaterThan(844 * 0.7);
    // The stone under test: a bar lying flat, high in the well.
    const shape = () =>
      read(page, () =>
        JSON.stringify(window.__arc.game.piece.cubes.map((c) => c.slice(0, 2)).sort()),
      );
    await page.evaluate(() => {
      const g = window.__arc.game;
      g.piece.cubes = [[-1, 0, 0], [0, 0, 0], [1, 0, 0]]; // prettier-ignore
      g.piece.x = 4;
      g.piece.y = 15;
      g.dropT = -100; // it waits while we tap
    });
    await run(page, 0.5);
    const s0 = await shape();
    await btn.tap();
    await run(page, 0.1);
    const s1 = await shape();
    expect(s1).not.toBe(s0);
    // A tap on the stone itself turns it back.
    const at = await read(page, async () => {
      const { orbitPose, viewTangents } = await import("/src/arcade/runtime.js");
      const a = window.__arc;
      const p = orbitPose(a.cam);
      const [tx, ty] = viewTangents(a.aspect(), a.cam.fov);
      const h = a.game.piece.sprites[1].pos;
      const d = [0, 1, 2].map((i) => h[i] - p.position[i]);
      const dot = (u, v) => u[0] * v[0] + u[1] * v[1] + u[2] * v[2];
      const z = dot(d, p.forward);
      const r = a.hud.surface.getBoundingClientRect();
      return { x: r.left + ((dot(d, p.right) / z / tx + 1) / 2) * r.width, y: r.top + ((1 - dot(d, p.up) / z / ty) / 2) * r.height }; // prettier-ignore
    });
    await page.touchscreen.tap(at.x, at.y);
    await run(page, 0.1);
    expect(await shape()).toBe(s0);
    // A tap well to the right of it moves it one step right; it doesn't drop.
    const x0 = await read(page, () => window.__arc.game.piece.x);
    await page.touchscreen.tap(at.x + 120, at.y + 60);
    await run(page, 0.1);
    const r = await read(page, () => ({ x: window.__arc.game.piece.x, y: window.__arc.game.piece.y })); // prettier-ignore
    expect(r.x).toBe(x0 + 1);
    expect(r.y).toBe(15);
  });
});
