// Lane Hands-on H5, the AI and computing shelf (docs/handoff/HandsH5.md):
// with the ✋ switch on, each piece measured: a tap on a perceptron's input
// lamp flips it and the output answers; the multilayer perceptron answers
// XOR; the gradient-descent ball rolls from where it is dropped into the
// nearest valley; the sorting machine's pieces swap by hand and count; the
// half adder's levers flip by hand and add. With the switch off, a tap
// still runs each toy's own effect.

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

const out = (page, w) => page.evaluate((w) => JSON.parse(JSON.stringify(window.__splashery.player.motion.out[w])), w); // prettier-ignore
// A tap on a recipe point, as the app's tap runs it.
const tapAt = (page, p) =>
  page.evaluate((p) => window.__splashery.player.act(window.__splashery.player.fromRecipe(p)), p);

test("perceptron: a tap on an input lamp flips it, and the output answers at once", async ({
  page,
}) => {
  await ready(page, "perceptron");
  await tick(page, 0.1);
  // Inputs 1 and 3 on: 0.7 + 0.65 = 1.35 passes the threshold (1).
  await tapAt(page, [-0.98, 0.5, 0.04]);
  await tick(page, 0.1);
  let p = await out(page, "parts");
  expect(p.in0.visible).toBe(1);
  expect((await out(page, "morph"))[2]).toBe(0);
  await tapAt(page, [-0.98, -0.5, 0.04]);
  await tick(page, 0.1);
  expect((await out(page, "morph"))[2]).toBe(1);
  expect(await out(page, "grow")).toBeGreaterThan(0.6);
  // Input 1 off again: 0.65 alone stays under.
  await tapAt(page, [-0.98, 0.5, 0.04]);
  await tick(page, 0.1);
  expect((await out(page, "morph"))[2]).toBe(0);
  // A tap off the lamps runs the toy's own example.
  await tapAt(page, [0.6, 0.6, 0.04]);
  await tick(page, 0.5);
  expect(await page.evaluate(() => window.__splashery.player.motion.state.go)).toBeGreaterThan(0);
});

test("multilayer perceptron: flipped by hand, the inputs give XOR", async ({ page }) => {
  await ready(page, "multilayer-perceptron");
  await tick(page, 0.1);
  const P = [[-1.07, 0.38, 0.04], [-1.07, -0.38, 0.04]]; // prettier-ignore
  const y = async () => (await out(page, "parts")).out.visible;
  await tapAt(page, P[0]);
  await tick(page, 0.1);
  expect(await y()).toBe(1); // 1, 0
  await tapAt(page, P[1]);
  await tick(page, 0.1);
  expect(await y()).toBe(0); // 1, 1
  await tapAt(page, P[0]);
  await tick(page, 0.1);
  expect(await y()).toBe(1); // 0, 1
  // The truth table marks the row (01 is the second).
  const tk = await out(page, "tokens");
  expect(tk[8].visible).toBe(1);
  expect(tk[7].visible).toBe(0);
});

test("gradient descent: let go anywhere, the ball rolls into the nearest valley", async ({
  page,
}) => {
  await ready(page, "gradient-descent");
  const ball = async () => {
    const tk = await out(page, "tokens");
    const start = await page.evaluate(() => window.__splashery.player.proc.ctx.kit.data.path[0]);
    return tk[0].offset.map((v, i) => v + start[i]);
  };
  await finger(
    page,
    [
      [0, 0.5, 0],
      [-0.4, 0.4, -0.5],
      [-0.75, 0.4, -0.7],
    ],
    { up: false },
  );
  await tick(page, 0.3);
  const held = await ball();
  await letGo(page);
  await tick(page, 10);
  const rest = await ball();
  // It has moved downhill and stopped: lower than where it was let go, on
  // a spot where the slope is (near) level.
  expect(rest[1]).toBeLessThan(held[1] - 0.1);
  await tick(page, 1);
  const later = await ball();
  expect(Math.hypot(...later.map((v, i) => v - rest[i]))).toBeLessThan(0.01);
});

test("sorting machine: a piece dropped on another place swaps with it, and the count goes up", async ({
  page,
}) => {
  await ready(page, "sorting-machine");
  const x = (s) => (s - 3.5) * 0.24;
  await finger(
    page,
    [
      [x(0), 0.3, 0],
      [x(1), 0.6, 0.2],
      [x(3), 0.3, 0],
    ],
    { up: false },
  );
  await tick(page, 0.1);
  await letGo(page);
  await tick(page, 0.6);
  const tk = await out(page, "tokens");
  // Value 5 (in place 0) and value 0 (in place 3) have swapped.
  expect(tk[5].offset[0]).toBeCloseTo(x(3) - x(0), 3);
  expect(tk[0].offset[0]).toBeCloseTo(x(0) - x(3), 3);
  // The counter shows 1 (its ones digit lights segments b and c only).
  const ones = tk.slice(15, 22).map((t) => t.visible);
  expect(ones).toEqual([0, 1, 1, 0, 0, 0, 0]);
});

test("half adder: the levers flip by hand and the lamps add the bits", async ({ page }) => {
  await ready(page, "half-adder");
  const lever = async (name, on) => {
    const st = (await page.evaluate(() => window.__splashery.player.handsOn.joints.state())).find((j) => j.name === name); // prettier-ignore
    const p = st.pos;
    await finger(page, [p, [p[0] + (on ? 0.12 : -0.12), p[1] - 0.02, p[2]], [p[0] + (on ? 0.25 : -0.25), p[1] - 0.06, p[2]]]); // prettier-ignore
    await tick(page, 0.4);
  };
  const parts = () => out(page, "parts");
  await lever("leverA", true);
  let p = await parts();
  expect(p.lampA.visible).toBe(1);
  expect(p.sumLamp.visible).toBe(1);
  expect(p.carryLamp.visible).toBe(0);
  await lever("leverB", true);
  p = await parts();
  expect(p.sumLamp.visible).toBe(0);
  expect(p.carryLamp.visible).toBe(1);
  expect(p.equation.visible).toBe(1);
});
