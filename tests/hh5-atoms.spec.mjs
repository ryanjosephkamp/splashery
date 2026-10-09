// Lane Hands-on H5, the Atoms shelf (docs/handoff/HandsH5.md): with the ✋
// switch on, each piece measured: a molecule's atom pulled off tugs its
// bonded neighbors and springs back with a wobble; a protein's helix pulled
// out of the fold tugs its chain neighbors and glides back; a slice of a
// crystal pushed along its plane shears its neighbors and rings back.

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

// Piece i's distance from home (recipe units) and the drive's token offsets.
const off = (page, i) =>
  page.evaluate((i) => {
    const b = window.__splashery.player.handsOn.pieces[i].body;
    const h = window.__splashery.player.handsOn.pieces[i].home.pos;
    return Math.hypot(b.pos[0] - h[0], b.pos[1] - h[1], b.pos[2] - h[2]);
  }, i);
const tokenOff = (page, i) =>
  page.evaluate((i) => Math.hypot(...(window.__splashery.player.motion.out.tokens[i].offset || [0, 0, 0])), i); // prettier-ignore
const data = (page) => page.evaluate(() => JSON.parse(JSON.stringify(window.__splashery.player.proc.ctx.kit.data))); // prettier-ignore

test("molecule: an atom pulled off tugs its neighbors, and springs back with a wobble", async ({
  page,
}) => {
  await ready(page, "molecule");
  const D = await data(page);
  const a = D.tokens[0].base;
  const bond = D.bonds.find((b) => b.a === 0 || b.b === 0);
  const nb = bond.a === 0 ? bond.b : bond.a;
  const away = D.bonds.find((b) => b.a !== 0 && b.b !== 0 && b.a !== nb && b.b !== nb && !D.bonds.some((x) => (x.a === 0 && (x.b === b.a || x.b === b.b)) || (x.b === 0 && (x.a === b.a || x.a === b.b))))?.a; // prettier-ignore
  await finger(page, [a, [a[0] + 0.6, a[1] + 0.5, a[2]], [a[0] + 1.2, a[1] + 0.9, a[2]]], { up: false }); // prettier-ignore
  await tick(page, 0.2);
  expect(await off(page, 0)).toBeGreaterThan(0.6);
  // Its bonded neighbor is tugged after it; an atom not bonded to it isn't.
  expect(await tokenOff(page, nb)).toBeGreaterThan(0.15);
  if (away !== undefined) expect(await tokenOff(page, away)).toBeLessThan(0.1);
  await letGo(page);
  // Back past its place (a wobble), then home.
  let least = Infinity;
  let after = 0;
  for (let i = 0; i < 20; i++) {
    await tick(page, 0.05);
    const d = await off(page, 0);
    if (d < least) least = d;
    else if (least < 0.2) after = Math.max(after, d);
  }
  expect(least).toBeLessThan(0.2);
  expect(after).toBeGreaterThan(least + 0.02);
  await tick(page, 3);
  expect(await off(page, 0)).toBeLessThan(0.03);
  expect(await tokenOff(page, nb)).toBeLessThan(0.1);
});

test("protein: a helix pulled out of the fold tugs its chain neighbors and glides back", async ({
  page,
}) => {
  await ready(page, "protein");
  const D = await data(page);
  const i = D.tokens.findIndex(
    (t, k) => t.kind === "H" && k > 0 && D.tokens[k + 1]?.chain === t.chain,
  );
  const at = D.tokens[i].base;
  const out = [at[0] * 2 + 8, at[1] * 2 + 6, at[2]];
  await finger(page, [at, [(at[0] + out[0]) / 2, (at[1] + out[1]) / 2, at[2]], out], { up: false });
  await tick(page, 0.3);
  expect(await off(page, i)).toBeGreaterThan(5);
  expect(await tokenOff(page, i + 1)).toBeGreaterThan(1);
  await letGo(page);
  await tick(page, 0.5);
  const half = await off(page, i);
  expect(half).toBeGreaterThan(0.3);
  await tick(page, 3);
  expect(await off(page, i)).toBeLessThan(0.3);
  expect(await tokenOff(page, i + 1)).toBeLessThan(0.3);
});

test("crystal lattice: a slice pushed along its plane shears the lattice and rings back", async ({
  page,
}) => {
  await ready(page, "crystal-lattice");
  const D = await data(page);
  const g = 7;
  const at = D.slabCenters[g];
  const to = at.map((v, k) => v + D.up[k] * 0.3);
  await finger(page, [at, at.map((v, k) => v + D.up[k] * 0.15), to], { up: false });
  await tick(page, 0.2);
  const lift = (i) => page.evaluate(([i, up]) => window.__splashery.player.motion.out.parts[`slab${i}`].offset.reduce((a, v, k) => a + v * up[k], 0), [i, D.up]); // prettier-ignore
  const held = [];
  for (const i of [g, g + 1, g + 3, g + 6]) held.push(await lift(i));
  // The pushed slice most, its neighbors less and less (a shear).
  expect(held[0]).toBeGreaterThan(0.15);
  expect(held[1]).toBeLessThan(held[0]);
  expect(held[1]).toBeGreaterThan(0.05);
  expect(held[2]).toBeLessThan(held[1]);
  expect(Math.abs(held[3])).toBeLessThan(0.02);
  await letGo(page);
  // It swings back past its place (rings), then settles.
  let least = Infinity;
  for (let i = 0; i < 12; i++) {
    await tick(page, 0.03);
    least = Math.min(least, await lift(g));
  }
  expect(least).toBeLessThan(-0.02);
  await tick(page, 3);
  expect(Math.abs(await lift(g))).toBeLessThan(0.01);
});
