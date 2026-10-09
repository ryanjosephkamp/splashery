// Lane Hands-on H5, the Math shelf (docs/handoff/HandsH5.md): with the ✋
// switch on, each piece measured: the Lorenz point follows the finger and
// flows from its new start onto the attractor; a Menger sponge's cubes snap
// out and land; the torus knot stretches and springs back; the mandelbulb's
// discs click round by sevenths; the Sierpinski tetrahedra and the Platonic
// faces lift off and click back; the unit circle's point turns by hand with
// its waves; the Pythagoras triangles slide by hand and light c².

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

const joints = (page) => page.evaluate(() => window.__splashery.player.handsOn.joints.state());
const piece = (page, i) =>
  page.evaluate((i) => {
    const pc = window.__splashery.player.handsOn.pieces[i];
    return { pos: pc.body.pos.slice(), home: pc.home.pos.slice() };
  }, i);
const dist = (a, b) => Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]);
const out = (page, what) => page.evaluate((w) => JSON.parse(JSON.stringify(window.__splashery.player.motion.out[w])), what); // prettier-ignore

test("lorenz: the point follows the finger, then flows from there onto the attractor", async ({
  page,
}) => {
  await ready(page, "lorenz");
  await finger(
    page,
    [
      [0, 0, 0],
      [0.6, 0.9, 0.3],
      [1.2, 1.3, 0.5],
    ],
    { up: false },
  );
  await tick(page, 0.2);
  const held = await out(page, "parts");
  expect(held.spark0.visible).toBeGreaterThan(0.9);
  await letGo(page);
  await tick(page, 4);
  const tk = await out(page, "tokens");
  const shown = tk.filter((t) => t.visible > 0.1);
  // A long trail of beads, ending on the attractor (within its box).
  expect(shown.length).toBeGreaterThan(30);
  for (const t of shown.slice(0, 5)) expect(Math.hypot(...t.offset)).toBeLessThan(1.8);
  await tick(page, 7);
  expect((await out(page, "tokens")).every((t) => !t.visible)).toBe(true);
});

test("menger sponge: a cube holds, snaps out under a pull, and lands; the rest stay", async ({
  page,
}) => {
  await ready(page, "menger-sponge");
  // The cube at the top front right corner.
  const c = [1 / 3, 1 / 3, 1 / 3];
  await finger(page, [c, [0.45, 0.5, 0.55], [0.9, 0.7, 0.7]], { steps: 10 });
  await tick(page, 2);
  const st = await joints(page);
  const broken = st.filter((j) => j.broken);
  expect(broken.length).toBe(1);
  const j = broken[0];
  expect(dist(j.pos, j.home)).toBeGreaterThan(0.15);
  // It has come to rest where it was set down (on the floor or on the sponge).
  expect(await page.evaluate(() => window.__splashery.player.handsOn.world.asleep)).toBe(true);
  expect(st.filter((x) => !x.broken).every((x) => dist(x.pos, x.home) < 1e-6)).toBe(true);
});

test("torus knot: pulled, it stretches after the finger and springs back with a wobble", async ({
  page,
}) => {
  await ready(page, "torus-knot");
  await finger(
    page,
    [
      [2.6, 0, 0.3],
      [3.0, 0.4, 0.5],
      [3.4, 0.8, 0.6],
    ],
    { up: false },
  );
  await tick(page, 0.2);
  const s = await page.evaluate(() => window.__splashery.player.handsOn.softParts.state().stretch);
  expect(s.on).toBe(true);
  expect(Math.hypot(...s.pull)).toBeGreaterThan(0.1);
  await letGo(page);
  await tick(page, 3);
  const after = await page.evaluate(
    () => window.__splashery.player.handsOn.softParts.state().stretch,
  );
  expect(Math.hypot(...after.pull)).toBeLessThan(0.01);
});

test("mandelbulb: a disc turns by dragging round it and clicks onto a seventh", async ({
  page,
}) => {
  await ready(page, "mandelbulb");
  const y = -1.15 + (3.5 / 7) * 2.3;
  const pts = [];
  for (let i = 0; i <= 6; i++) {
    const a = 0.3 + (i / 6) * 1.6;
    pts.push([Math.sin(a) * 1.05, y, Math.cos(a) * 1.05]);
  }
  await finger(page, pts, { steps: 4, up: false });
  await tick(page, 0.2);
  const mid = (await joints(page)).find((j) => j.name === "b3");
  expect(Math.abs(mid.v)).toBeGreaterThan(0.5);
  await letGo(page);
  await tick(page, 3);
  const st = await joints(page);
  const v = st.find((j) => j.name === "b3").v;
  const step = (2 * Math.PI) / 7;
  // On a click (where the picture is the same again); the others never moved.
  expect(Math.abs(v - step * Math.round(v / step))).toBeLessThan(0.02);
  expect(st.filter((j) => j.name !== "b3").every((j) => Math.abs(j.v) < 1e-6)).toBe(true);
  // Shown no more than a few degrees off its built pose.
  const q = (await out(page, "parts")).b3.quat;
  expect(Math.abs(2 * Math.atan2(q[1], q[3]))).toBeLessThan(0.05);
});

for (const [id, idx, toFloor] of [
  ["sierpinski", 3, [1.1, 0.6, 0.9]],
  ["platonic", 0, [1.2, 0.2, 0.9]],
]) {
  test(`${id}: a piece lifts off and lands, and clicks back into its place`, async ({ page }) => {
    await ready(page, id);
    const at = (await piece(page, idx)).home;
    await finger(page, [at, [at[0] * 1.5 + 0.3, at[1] + 0.6, at[2] * 1.5 + 0.3], toFloor], { steps: 10 }); // prettier-ignore
    await tick(page, 2);
    const off = await piece(page, idx);
    expect(dist(off.pos, off.home)).toBeGreaterThan(0.5);
    await finger(page, [off.pos, [at[0] + 0.4, at[1] + 0.6, at[2] + 0.4], at.map((v) => v + 0.04)], { steps: 10 }); // prettier-ignore
    await tick(page, 1.5);
    const back = await piece(page, idx);
    expect(dist(back.pos, back.home)).toBeLessThan(0.01);
  });
}

test("unit circle: the point turns round by hand, drawing the waves, and runs on to the end", async ({
  page,
}) => {
  await ready(page, "unit-circle");
  const C = [-0.62, 0.36, 0];
  const R = 0.44;
  const round = [];
  for (let i = 0; i <= 8; i++) {
    const a = (i / 8) * Math.PI;
    round.push([C[0] + R * Math.cos(a), C[1] + R * Math.sin(a), 0.03]);
  }
  await finger(page, round, { steps: 3, up: false });
  await tick(page, 0.1);
  // Half a turn: the point is across the circle, the waves half drawn.
  const tk = await out(page, "tokens");
  expect(tk[0].offset[0]).toBeLessThan(-0.7);
  const m = await out(page, "morph");
  expect(m[0]).toBeGreaterThan(0.4);
  expect(m[0]).toBeLessThan(0.6);
  await letGo(page);
  await tick(page, 2.5);
  expect((await out(page, "morph"))[0]).toBe(0);
});

test("pythagoras proof: the triangles slide by hand, and c² lights once all three are in", async ({
  page,
}) => {
  await ready(page, "pythagoras-proof");
  const D = await page.evaluate(() => window.__splashery.player.handsOn.joints.state());
  expect(D.length).toBe(3);
  for (const j of D) {
    const name = j.name;
    const st = (await joints(page)).find((x) => x.name === name);
    // Its way: from its place along its axis to the end.
    const ax = await page.evaluate((n) => {
      const jj = window.__splashery.player.handsOn.joints.byName.get(n);
      return { axis: jj.axis, max: jj.max };
    }, name);
    const to = st.home.map((v, k) => v + ax.axis[k] * (ax.max + 0.2));
    await finger(page, [st.home, st.home.map((v, k) => v + ax.axis[k] * ax.max * 0.5), to], { steps: 8 }); // prettier-ignore
    await tick(page, 0.5);
    const now = (await joints(page)).find((x) => x.name === name);
    expect(now.v).toBeGreaterThan(ax.max * 0.9);
    if (name !== D[D.length - 1].name) expect((await out(page, "morph"))[2]).toBeLessThan(0.5);
  }
  const m = await out(page, "morph");
  expect(m[1]).toBe(1);
  expect(m[2]).toBe(1);
});

// The lane's screenshots, the ✋ switch on (phone and desktop).
test("screenshots: the menger-sponge, hands-on", async ({ page }) => {
  for (const [w, h] of [
    [390, 844],
    [1440, 900],
  ]) {
    await page.setViewportSize({ width: w, height: h });
    await ready(page, "menger-sponge");
    await page.waitForTimeout(600);
    await page.screenshot({ path: `tests/screenshots/hh5-menger-sponge-${w}x${h}.png` });
  }
});
