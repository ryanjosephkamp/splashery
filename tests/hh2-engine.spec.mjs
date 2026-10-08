// Lane Hands-on H2's engine piece (docs/PACKS.md, 5f, "A flip"): a placed
// piece with `flip: true`, let go from a quick flick up, turns over in the
// air and lands upside down; let go any other way, it is set down level.

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
}

const tick = (page, secs) =>
  page.evaluate(
    (n) => {
      const { player } = window.__splashery;
      for (let i = 0; i < n; i++) player.update(1 / 60);
    },
    Math.round(secs * 60),
  );

const screen = (page, pts) =>
  page.evaluate((pts) => {
    const { player } = window.__splashery;
    const r = player.stage.canvas.getBoundingClientRect();
    return pts.map((p) => {
      const s = player.screenPoint(p);
      return [r.left + s[0], r.top + s[1]];
    });
  }, pts);

async function drag(page, points, { steps = 20, dt = 1 / 30, flick = null } = {}) {
  const px = await screen(page, points);
  await page.mouse.move(...px[0]);
  await page.mouse.down();
  for (let k = 1; k < px.length; k++) {
    // A list gives each leg its own number of steps (a slow lift, a quick flick).
    const n = Array.isArray(steps) ? steps[k - 1] : steps;
    for (let i = 1; i <= n; i++) {
      const f = i / n;
      const [a, b] = [px[k - 1], px[k]];
      await page.mouse.move(a[0] + (b[0] - a[0]) * f, a[1] + (b[1] - a[1]) * f);
      await tick(page, dt);
    }
  }
  // A flick: moves straight to Hands-on, one each 60th of a second (the
  // browser hands a page its moves once a frame, and SwiftShader's frames
  // are slow).
  if (flick)
    await page.evaluate(
      ([a, b, n]) => {
        const { player } = window.__splashery;
        for (let i = 1; i <= n; i++) {
          const p = a.map((v, k) => v + ((b[k] - v) * i) / n);
          player.handsOn.moveTo(...player.screenPoint(p));
          player.update(1 / 60);
        }
      },
      [points[points.length - 1], flick, 6],
    );
  // (The page's own pointer goes there too, so letting go happens there.)
  if (flick) await page.mouse.move(...(await screen(page, [flick]))[0]);
  await page.mouse.up();
}

// The piece's up direction (y of its turned up axis) and its height.
const pose = (page, i) =>
  page.evaluate((i) => {
    const b = window.__splashery.player.handsOn.pieces[i].body;
    const [x, y, z, w] = b.q;
    return { up: 1 - 2 * (x * x + z * z), pos: b.pos, moving: Math.hypot(...b.vel) };
  }, i);

test("a flip piece flicked up turns over and lands upside down; set down, it stays level", async ({
  page,
}) => {
  await ready(page, "macarons");
  // The macarons' pieces, built; the front left one becomes a flip piece.
  const home = await page.evaluate(() => {
    const h = window.__splashery.player.handsOn;
    h.info.recipe.hands.area = 3; // (room: no wall near it in the air)
    h.ensure();
    h.pieces[3].def.flip = true;
    return h.pieces[3].home.pos;
  });
  const lifted = [home[0], home[1] + 0.5, home[2]];
  // Lifted, then flicked up fast: it turns over and lands upside down.
  await drag(page, [home, lifted], { steps: 30, flick: [home[0], home[1] + 2, home[2]] });
  await tick(page, 0.1);
  let p = await pose(page, 3);
  expect(p.up).toBeLessThan(0.98); // turning in the air
  await tick(page, 2.5);
  p = await pose(page, 3);
  expect(p.up).toBeLessThan(-0.9); // landed upside down
  expect(p.moving).toBeLessThan(0.05);
  await page.click("#hands-reset");
  await tick(page, 1);
  p = await pose(page, 3);
  expect(p.up).toBeGreaterThan(0.999);
  // Lifted and set down slowly: level.
  await drag(page, [home, lifted, [home[0], home[1] + 0.3, home[2]]]);
  await tick(page, 2);
  p = await pose(page, 3);
  expect(p.up).toBeGreaterThan(0.95);
});
