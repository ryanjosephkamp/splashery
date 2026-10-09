// Lane Hands-on H5, the Animals shelf (docs/handoff/HandsH5.md): with the ✋
// switch on, each piece measured: the owl's head follows a finger on it and
// a tossed owl comes to rest; the penguin rocks back upright; the
// pufferfish puffs while held and deflates after; the snail hides and comes
// back out on its foot; the jellyfish's tentacles trail behind the bell; the
// butterfly settles back to hovering; the frog turns to its fly and catches
// it; the ladybug's wing cases swing shut; a starfish arm curls back slowly.
// Each Level 1 toy is checked upright, on its side and upside down.

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

// What the drive last showed (parts, tokens, body, grow).
const shown = (page, what) =>
  page.evaluate((what) => {
    const out = window.__splashery.player.motion.out;
    return JSON.parse(JSON.stringify(what === "all" ? { parts: out.parts, body: out.body, grow: out.grow } : out[what])); // prettier-ignore
  }, what);

// The whole toy's body (Level 1): its tilt from upright (radians), how far
// it is from home (toy radii) and whether it sleeps.
const body = (page) =>
  page.evaluate(() => {
    const ho = window.__splashery.player.handsOn;
    const b = ho.body;
    const dq = [b.q, b.home.q];
    const [x, y, z, w] = b.q;
    const [hx, hy, hz, hw] = b.home.q;
    // The relative turn's up vector.
    const q = [hw * x - hx * w - hy * z + hz * y, hw * y - hy * w - hz * x + hx * z, hw * z - hz * w - hx * y + hy * x, hw * w + hx * x + hy * y + hz * z]; // prettier-ignore
    const up1 = 1 - 2 * (q[0] * q[0] + q[2] * q[2]);
    const d = b.pos.map((v, i) => v - b.home.pos[i]);
    void dq;
    return { tilt: Math.acos(Math.max(-1, Math.min(1, up1))), off: Math.hypot(...d) / ho.R(), up: d[1] / ho.R(), asleep: ho.world.asleep }; // prettier-ignore
  });

// Lays a Level 1 toy down as it might land: tipped by `angle` about x
// (π/2 on its side, π upside down), resting where it is.
const lay = (page, angle) =>
  page.evaluate((angle) => {
    const ho = window.__splashery.player.handsOn;
    const b = ho.body;
    if (b.settled) ho.joints.unsettle(b); // (as a finger's touch would)
    b.q = [Math.sin(angle / 2), 0, 0, Math.cos(angle / 2)];
    b.vel = [0, 0, 0];
    b.omega = [0, 0, 0];
    ho.moved = true;
    ho.world.wake();
  }, angle);

const yawOf = (q) => 2 * Math.atan2(q[1], q[3]);

test("owl: its head turns to a finger on it and back; tossed, it comes to rest upright", async ({
  page,
}) => {
  await ready(page, "owl");
  // Pressed on the head and moved to its right (the toy's +x), held there.
  await finger(page, [[0, 0.55, 0.3], [0.9, 0.55, 0.6], [1.2, 0.5, 0.8]], { up: false }); // prettier-ignore
  await tick(page, 0.6);
  const turned = await shown(page, "parts");
  expect(yawOf(turned.head.quat)).toBeGreaterThan(0.4);
  // The owl didn't move: a press on the head is followed, not picked up.
  expect(await page.evaluate(() => window.__splashery.player.handsOn.hold)).toBeNull();
  await letGo(page);
  await tick(page, 1.5);
  expect(Math.abs(yawOf((await shown(page, "parts")).head.quat))).toBeLessThan(0.12);
  // Picked up by the body and tossed (the sweep: it never came to rest).
  await finger(
    page,
    [
      [0, -0.2, 0.3],
      [0.2, 0.6, 0.3],
      [0.8, 0.9, 0.3],
    ],
    { steps: 6 },
  );
  for (let s = 0; s < 8; s++) {
    await tick(page, 1);
    if ((await body(page)).asleep) break;
  }
  const b = await body(page);
  expect(b.asleep).toBe(true);
  expect(b.tilt).toBeLessThan(0.12);
  // On its side and upside down it rights itself onto its branch too.
  for (const a of [Math.PI / 2, Math.PI - 0.2]) {
    await lay(page, a);
    await tick(page, 5);
    expect((await body(page)).tilt).toBeLessThan(0.12);
  }
});

test("penguin: tipped any way, it rocks back upright", async ({ page }) => {
  await ready(page, "penguin");
  for (const a of [0.6, Math.PI / 2, Math.PI - 0.2]) {
    await lay(page, a);
    await tick(page, 4.4);
    const b = await body(page);
    expect(b.tilt).toBeLessThan(0.08);
  }
  // A push near the top tips it a little; it rocks and rights itself.
  const tipped = await page.evaluate(() => {
    const { player } = window.__splashery;
    const ho = player.handsOn;
    const top = player.fromRecipe([0, 0.7, 0.3]);
    const s = player.screenPoint([0, 0.7, 0.3]);
    ho.pressAt(top, ...s);
    let most = 0;
    for (let i = 1; i <= 6; i++) {
      ho.moveTo(s[0] + 3.5 * i, s[1]);
      player.update(1 / 60);
    }
    ho.release();
    for (let i = 0; i < 60; i++) {
      player.update(1 / 60);
      const b = ho.body;
      const [x, , z] = b.q;
      most = Math.max(most, Math.acos(1 - 2 * (x * x + z * z)));
    }
    return most;
  });
  expect(tipped).toBeGreaterThan(0.02);
  await tick(page, 4);
  expect((await body(page)).tilt).toBeLessThan(0.08);
});

test("pufferfish: puffs while held, any way up; deflates slowly once let go", async ({ page }) => {
  await ready(page, "pufferfish");
  for (const a of [0, Math.PI / 2, Math.PI]) {
    if (a) await lay(page, a);
    await finger(page, [[0.3, 0.2, 0.6]], { up: false });
    await tick(page, 0.8);
    expect(await shown(page, "grow")).toBeGreaterThan(0.95);
    await tick(page, 1);
    expect(await shown(page, "grow")).toBeGreaterThan(0.95);
    await letGo(page);
    await tick(page, 1.2);
    // Still puffed a moment after, then slowly down.
    expect(await shown(page, "grow")).toBeGreaterThan(0.9);
    await tick(page, 1.3);
    const half = await shown(page, "grow");
    expect(half).toBeLessThan(0.9);
    expect(half).toBeGreaterThan(0.1);
    await tick(page, 1.2);
    expect(await shown(page, "grow")).toBeLessThan(0.15);
  }
});

test("snail: a poke hides it; let go, it comes back out only on its foot", async ({ page }) => {
  await ready(page, "snail");
  const head = async () => (await shown(page, "tokens"))[8].visible;
  expect(await head()).toBeGreaterThan(0.9);
  await finger(page, [[-0.1, 0.1, 0.2]], { up: false });
  await tick(page, 1.2);
  expect(await head()).toBeLessThan(0.05);
  await letGo(page);
  await tick(page, 2);
  expect(await head()).toBeLessThan(0.05);
  await tick(page, 4.5);
  expect(await head()).toBeGreaterThan(0.9);
  // Laid on its side or upside down it stays in, rolls back onto its foot,
  // and only then comes out.
  for (const a of [Math.PI / 2, Math.PI - 0.2]) {
    await lay(page, a);
    await tick(page, 0.3);
    await tick(page, 1);
    expect(await head()).toBeLessThan(0.3);
    await tick(page, 8);
    expect((await body(page)).tilt).toBeLessThan(0.15);
    expect(await head()).toBeGreaterThan(0.9);
  }
});

test("jellyfish: dragged, the tentacles trail behind the bell; let go, it hovers and they hang again", async ({
  page,
}) => {
  await ready(page, "jellyfish");
  await finger(page, [[0, 0.7, 0.2], [0.5, 0.7, 0.2], [1.0, 0.7, 0.2]], { steps: 6, up: false }); // prettier-ignore
  const s = await page.evaluate(() => window.__splashery.player.handsOn.state());
  const bell = s.bodies[0].pos;
  const unit = await page.evaluate(() => window.__splashery.player.handsOn.units());
  // Each tentacle's tip is behind the bell's move (to its -x), the root on it.
  const strands = s.soft.strands.slice(0, 6);
  for (const st of strands) {
    const tip = st.nodes[st.nodes.length - 1];
    const tipHome = st.home[st.home.length - 1];
    expect(tip[0] - tipHome[0]).toBeLessThan(bell[0] / unit - 0.15);
  }
  await letGo(page);
  await tick(page, 4);
  const after = await page.evaluate(() => window.__splashery.player.handsOn.state());
  // It hovers near its height (it doesn't fall), and the tips hang below the bell.
  expect(Math.abs(after.bodies[0].pos[1] - after.bodies[0].home[1]) / unit).toBeLessThan(0.15);
  for (const st of after.soft.strands.slice(0, 6)) {
    const root = st.nodes[0];
    const tip = st.nodes[st.nodes.length - 1];
    expect(root[1] - tip[1]).toBeGreaterThan(0.9);
  }
});

test("butterfly: let go anywhere, it settles back to hovering upright at its height", async ({
  page,
}) => {
  await ready(page, "butterfly");
  await finger(
    page,
    [
      [0, 0, 0.05],
      [0.3, 0.8, 0.05],
      [0.6, 1.2, 0.05],
    ],
    { steps: 8 },
  );
  await tick(page, 0.2);
  // It beats its wings hard while flying.
  await tick(page, 4);
  const b = await body(page);
  expect(Math.abs(b.up)).toBeLessThan(0.12);
  expect(b.tilt).toBeLessThan(0.15);
  // On its side or upside down (a bad landing), it rights itself in the air.
  for (const a of [Math.PI / 2, Math.PI - 0.2]) {
    await lay(page, a);
    await tick(page, 4);
    expect((await body(page)).tilt).toBeLessThan(0.15);
  }
});

test("frog: it turns to the fly on the finger, and catches it when let go", async ({ page }) => {
  await ready(page, "frog");
  await finger(
    page,
    [
      [0, 0.2, 0.4],
      [0.6, 0.3, 0.6],
      [1.0, 0.4, 0.6],
    ],
    { up: false },
  );
  await tick(page, 1);
  const tracking = await shown(page, "all");
  expect(tracking.parts.fly.visible).toBe(1);
  // Turned toward the fly, on its right: the frog's catch side (front left)
  // has come round to it.
  expect(yawOf(tracking.body.quat)).toBeGreaterThan(0.45);
  await letGo(page);
  await tick(page, 1.2);
  const catching = await shown(page, "all");
  expect(catching.parts.jaw.angle).toBeGreaterThan(0.2);
  await tick(page, 0.6);
  expect((await shown(page, "parts")).fly.visible).toBe(0);
  await tick(page, 4);
  expect(Math.abs(yawOf((await shown(page, "body"))?.quat ?? [0, 0, 0, 1]))).toBeLessThan(0.1);
});

test("frog: a finger over the frog's own head keeps the fly in front of the frog, never behind it", async ({
  page,
}) => {
  await ready(page, "frog");
  await finger(
    page,
    [
      [0.3, 0.3, 0.6],
      [0, 0.75, 0.2],
      [0, 0.8, -0.1],
    ],
    { up: false },
  );
  await tick(page, 0.5);
  const p = await page.evaluate(() => {
    const { player } = window.__splashery;
    return player.motion.out.parts.fly.offset;
  });
  // The fly's place (built at z 0.45, its offset added): in front (+z).
  expect(p[2] + 0.45).toBeGreaterThan(0.2);
  expect((await shown(page, "parts")).fly.visible).toBe(1);
  await letGo(page);
});

test("ladybug: a wing case lifts open on its hinge, its wing stays folded away under it, and it swings shut", async ({
  page,
}) => {
  await ready(page, "ladybug");
  const joint = (n) => page.evaluate((n) => window.__splashery.player.handsOn.joints.state().find((j) => j.name === n).v, n); // prettier-ignore
  await finger(
    page,
    [
      [0.26, 0.32, -0.08],
      [0.32, 0.7, -0.08],
      [0.3, 0.9, -0.08],
    ],
    { up: false },
  );
  await tick(page, 0.3);
  expect(await joint("shellR")).toBeGreaterThan(0.6);
  expect(await joint("shellL")).toBeLessThan(0.05);
  // The spread (flying) wing doesn't poke out through the lifted case.
  let p = await shown(page, "parts");
  expect(p.wingR.visible).toBe(0);
  await letGo(page);
  await tick(page, 2);
  expect(await joint("shellR")).toBeLessThan(0.05);
  p = await shown(page, "parts");
  expect(p.wingR.visible).toBe(0);
});

test("starfish: an arm bends up from its root and curls back slowly", async ({ page }) => {
  await ready(page, "starfish");
  const joint = () => page.evaluate(() => window.__splashery.player.handsOn.joints.state().find((j) => j.name === "arm0").v); // prettier-ignore
  await finger(
    page,
    [
      [0, 0.06, 0.72],
      [0, 0.4, 0.68],
      [0, 0.65, 0.6],
    ],
    { up: false },
  );
  await tick(page, 0.3);
  const up = await joint();
  expect(up).toBeGreaterThan(0.6);
  await letGo(page);
  await tick(page, 0.4);
  // Slowly: still well up a moment later, down after a couple of seconds.
  expect(await joint()).toBeGreaterThan(0.25);
  await tick(page, 2.6);
  expect(await joint()).toBeLessThan(0.1);
});

// The lane's screenshots, the ✋ switch on (phone and desktop).
test("screenshots: the owl, hands-on", async ({ page }) => {
  for (const [w, h] of [
    [390, 844],
    [1440, 900],
  ]) {
    await page.setViewportSize({ width: w, height: h });
    await ready(page, "owl");
    await page.waitForTimeout(600);
    await page.screenshot({ path: `tests/screenshots/hh5-owl-${w}x${h}.png` });
  }
});
