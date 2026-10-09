// Lane Hands-on H5, the Gems shelf (docs/handoff/HandsH5.md): with the ✋
// switch on, each piece measured: the geode's half and the oyster's lid
// swing on their hinges by hand and stay where they are left (the shut and
// open copies swap halfway); the pearl lifts out, rolls, and settles back
// into its place; the crystal ball lifts off its stand, rolls on the table
// and settles back into its cup, its mist and bottom going with it.

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

const joint = (page, n) => page.evaluate((n) => window.__splashery.player.handsOn.joints.state().find((j) => j.name === n).v, n); // prettier-ignore
const parts = (page) => page.evaluate(() => JSON.parse(JSON.stringify(window.__splashery.player.motion.out.parts))); // prettier-ignore
const piece = (page, i = 0) =>
  page.evaluate((i) => {
    const pc = window.__splashery.player.handsOn.pieces[i];
    return { pos: pc.body.pos.slice(), home: pc.home.pos.slice(), pinned: !!pc.body.pinned };
  }, i);
const dist = (a, b) => Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]);

test("amethyst geode: the front half swings shut and open by hand, and stays", async ({ page }) => {
  await ready(page, "amethyst-geode");
  const open = await joint(page, "lidShut");
  expect(open).toBeGreaterThan(2);
  // The open half lies on the left (toward -x); swung back over the stone.
  const lying = [-1.6, 0, -0.5];
  await finger(page, [lying, [-1.3, 0.3, 0.6], [-0.4, 0.2, 1.1], [0.2, 0, 0.9]], { steps: 12, up: false }); // prettier-ignore
  await tick(page, 0.4);
  const v = await joint(page, "lidShut");
  expect(v).toBeLessThan(open - 1);
  await letGo(page);
  await tick(page, 1);
  // It stays near where it was left (no spring, no weight).
  expect(Math.abs((await joint(page, "lidShut")) - v)).toBeLessThan(0.15);
  const p = await parts(page);
  // The shut copy shows once it is past halfway shut.
  if (v < 1.25) expect(p.lidShut.visible).toBe(1);
});

test("pearl: the pearl lifts out of its shell, and clicks back into its place", async ({
  page,
}) => {
  await ready(page, "pearl");
  const home = (await piece(page, 0)).home;
  await finger(page, [home, [home[0] + 0.4, home[1] + 0.6, home[2] + 0.3], [1.1, 0.3, 0.7]], { steps: 10 }); // prettier-ignore
  await tick(page, 2);
  const out = await piece(page, 0);
  expect(dist(out.pos, out.home)).toBeGreaterThan(0.6);
  // It lies on the table, as low as a pearl on the floor sits.
  expect(out.pos[1]).toBeLessThan(0);
  // Brought back near its place: it settles in.
  await finger(page, [out.pos, [0.6, 0.4, 0.5], [home[0] + 0.05, home[1] + 0.05, home[2] + 0.05]], { steps: 10 }); // prettier-ignore
  await tick(page, 1.5);
  const back = await piece(page, 0);
  expect(dist(back.pos, back.home)).toBeLessThan(0.01);
});

test("crystal ball: lifted off its stand, it rolls off the stand's base onto the table; brought back, it settles in its cup", async ({
  page,
}) => {
  await ready(page, "crystal-ball");
  const home = (await piece(page, 0)).home;
  await finger(page, [home, [0.3, 1.2, 0.3], [1.0, 0.4, 0.5]], { steps: 10 });
  await tick(page, 0.2);
  let p = await parts(page);
  // The mist and the cap under the glass go with it.
  const at = await piece(page, 0);
  const off = at.pos.map((v, i) => v - at.home[i]);
  expect(Math.hypot(...p.mist.offset.map((v, i) => v - off[i]))).toBeLessThan(1e-6);
  expect(p.cap.visible).toBe(1);
  await tick(page, 2.5);
  const rest = await piece(page, 0);
  // On the table (its radius above the floor), off its stand.
  expect(rest.pos[1]).toBeLessThan(0.2);
  expect(dist(rest.pos, rest.home)).toBeGreaterThan(0.6);
  // Clear of the stand's base (a fixed piece): never sunk into it.
  expect(Math.hypot(rest.pos[0], rest.pos[2])).toBeGreaterThan(1.7);
  await finger(page, [rest.pos, [0.5, 1.3, 0.3], [home[0] + 0.1, home[1] + 0.2, home[2] + 0.1]], { steps: 10 }); // prettier-ignore
  await tick(page, 1.5);
  const back = await piece(page, 0);
  expect(dist(back.pos, back.home)).toBeLessThan(0.01);
  p = await parts(page);
  expect(p.cap.visible).toBe(0);
});

// The lane's screenshots, the ✋ switch on (phone and desktop).
test("screenshots: the pearl, hands-on", async ({ page }) => {
  for (const [w, h] of [
    [390, 844],
    [1440, 900],
  ]) {
    await page.setViewportSize({ width: w, height: h });
    await ready(page, "pearl");
    await page.waitForTimeout(600);
    await page.screenshot({ path: `tests/screenshots/hh5-pearl-${w}x${h}.png` });
  }
});
