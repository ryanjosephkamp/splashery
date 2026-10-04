// Lane Hands engine B's demo toys (docs/handoff/HandsEngineB.md): the chest's
// lid, the music box's lid and crank, the sword in the stone, the orange's
// wedges, the candy cane's snap and the tomatoes, with the ✋ switch on.

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
  await page.click("#hands-toggle");
}

// Steps the clock by hand (SwiftShader draws slowly).
const tick = (page, secs) =>
  page.evaluate(
    (n) => {
      const { player } = window.__splashery;
      for (let i = 0; i < n; i++) player.update(1 / 60);
    },
    Math.round(secs * 60),
  );

// A finger drag through recipe points (each a place on screen).
async function drag(page, points, { steps = 20, hold = false, held = false } = {}) {
  const px = await page.evaluate((pts) => {
    const { player } = window.__splashery;
    const r = player.stage.canvas.getBoundingClientRect();
    return pts.map((p) => {
      const s = player.screenPoint(p);
      return [r.left + s[0], r.top + s[1]];
    });
  }, points);
  if (!held) {
    await page.mouse.move(...px[0]);
    await page.mouse.down();
  }
  for (let k = 1; k < px.length; k++)
    for (let i = 1; i <= steps; i++) {
      const f = i / steps;
      const [a, b] = [px[k - 1], px[k]];
      await page.mouse.move(a[0] + (b[0] - a[0]) * f, a[1] + (b[1] - a[1]) * f);
      await tick(page, 1 / 30);
    }
  if (!hold) await page.mouse.up();
}

const joints = (page) => page.evaluate(() => window.__splashery.player.handsOn.joints?.state());
const events = (page) =>
  page.evaluate(() => window.__splashery.player.handsOn.joints.events.map((e) => e.kind));
const bodies = (page) => page.evaluate(() => window.__splashery.player.handsOn.state().bodies);

async function reset(page) {
  await page.click("#hands-reset");
  await tick(page, 1);
}

test("chest: the lid lifts on its hinge, drops shut from low, stays open from high", async ({
  page,
}) => {
  await ready(page, "chest");
  await drag(page, [
    [0, 0.3, 0.3],
    [0, 0.75, 0.1],
  ]);
  let [lid] = await joints(page);
  expect(lid.v).toBeGreaterThan(0.4);
  expect(lid.v).toBeLessThan(1.5);
  await tick(page, 1.5);
  [lid] = await joints(page);
  expect(lid.v).toBe(0); // dropped shut
  expect(await events(page)).toContain("stop");
  // Lifted past upright, it falls open onto its stop and stays.
  await drag(page, [
    [0, 0.3, 0.3],
    [0, 0.95, -0.2],
    [0, 0.6, -0.9],
  ]);
  await tick(page, 1.5);
  [lid] = await joints(page);
  expect(lid.v).toBeCloseTo(1.95, 3);
  await reset(page);
  [lid] = await joints(page);
  expect(lid.v).toBe(0);
  expect((await page.evaluate(() => window.__splashery.player.handsOn.state())).moved).toBe(false);
});

test("music box: the crank turns round and round, plays the tune and turns the dancer", async ({
  page,
}) => {
  await ready(page, "music-box");
  await page.evaluate(() => {
    window.__cues = [];
    window.__splashery.player.on("cue", (c) => window.__cues.push(...c));
  });
  // Circles drawn round the crank's axis (on the box's side).
  const circle = [];
  for (let i = 0; i <= 32; i++) {
    const a = (i / 32) * Math.PI * 4;
    circle.push([0.56, 0.25 + 0.15 * Math.cos(a), 0.15 * Math.sin(a)]);
  }
  await drag(page, circle, { steps: 2 });
  await tick(page, 2);
  const [lid, crank] = await joints(page);
  expect(lid.v).toBeCloseTo(1.95, 3); // the lid stays open as shown
  expect(Math.abs(crank.v)).toBeGreaterThan(Math.PI * 2.5); // over a turn
  const notes = await page.evaluate(() => window.__cues.filter((c) => c.voice === "tine").length);
  expect(notes).toBeGreaterThan(14); // a note at each click
  const dancer = await page.evaluate(() => window.__splashery.player.motion.handsParts?.dancer);
  expect(Math.abs(dancer.angle)).toBeGreaterThan(1);
  await reset(page);
  expect((await joints(page))[1].v).toBeCloseTo(0, 6);
});

test("sword in the stone: stuck, then drawn out along its line; stays; clanks back in", async ({
  page,
}) => {
  await ready(page, "sword-in-stone");
  await drag(page, [
    [0, 1.0, 0],
    [0, 1.05, 0],
  ]);
  let [sw] = await joints(page);
  expect(sw.stuck).toBe(true);
  expect(sw.v).toBe(0);
  await drag(page, [
    [0, 1.0, 0],
    [0, 1.7, 0],
  ]);
  await tick(page, 1);
  [sw] = await joints(page);
  expect(sw.stuck).toBe(false);
  expect(sw.v).toBeGreaterThan(0.3);
  expect(sw.v).toBeLessThanOrEqual(0.55);
  expect(Math.abs(sw.pos[0]) + Math.abs(sw.pos[2])).toBeLessThan(1e-6); // straight up its line
  const aura = await page.evaluate(() => window.__splashery.player.motion.handsParts?.aura);
  expect(aura.offset[1]).toBeCloseTo(sw.v, 6);
  // Pushed back down, it goes in with a clank.
  await drag(page, [
    [0, 1.0 + sw.v, 0],
    [0, 0.6, 0],
  ]);
  await tick(page, 0.5);
  [sw] = await joints(page);
  expect(sw.v).toBe(0);
  expect(await events(page)).toContain("stop");
});

test("orange: a wedge pulled out stays out; brought back, it clicks home", async ({ page }) => {
  await ready(page, "orange");
  const w = await page.evaluate(() => window.__splashery.player.proc.ctx.kit.data.wedges.map((w) => w.mid)); // prettier-ignore
  await drag(page, [
    [w[6][0] - 0.05, 0.55, w[6][2]],
    [-1.1, -0.5, 0.5],
  ]);
  await tick(page, 1.5);
  let b = await bodies(page);
  const out = b.findIndex((x) => !x.pinned);
  expect(out).toBeGreaterThanOrEqual(0);
  expect(Math.hypot(b[out].pos[0] - b[out].home[0], b[out].pos[2] - b[out].home[2])).toBeGreaterThan(0.4); // prettier-ignore
  expect(b[out].pos[1]).toBeGreaterThan(-0.7); // on the table, not through it
  await drag(page, [
    [b[out].pos[0], b[out].pos[1] + 0.05, b[out].pos[2]], // its middle, however it settled
    [w[out][0], 0.3, w[out][2]],
  ]);
  await tick(page, 0.6);
  b = await bodies(page);
  expect(b[out].pinned).toBe(true);
  expect(b[out].pos).toEqual(b[out].home);
  expect(await events(page)).toContain("socket");
});

test("candy cane: pulled, the hook bends, snaps off, lands; reset mends it", async ({ page }) => {
  await ready(page, "candy-cane");
  // A point on the front cane's shaft, above the break.
  const a = await page.evaluate(() => {
    const cn = window.__splashery.player.proc.ctx.kit.data.canes[1];
    return cn.pivot.map((v, i) => v + cn.axis[i] * 0.45);
  });
  await drag(page, [a, [a[0] + 0.2, a[1], a[2] + 0.06]], { hold: true });
  let js = await joints(page);
  expect(js.every((j) => !j.broken)).toBe(true); // bent, not broken yet
  expect(js.some((j) => j.held)).toBe(true);
  // Pulled on, further: it snaps.
  await drag(
    page,
    [
      [a[0] + 0.2, a[1], a[2] + 0.06],
      [a[0] + 0.9, a[1] + 0.2, a[2] + 0.3],
    ],
    { held: true },
  );
  await tick(page, 2);
  js = await joints(page);
  const broke = js.find((j) => j.broken);
  expect(broke).toBeTruthy();
  expect(await events(page)).toContain("snap");
  expect(broke.pos[1]).toBeLessThan(-0.9); // fell to the table
  expect(broke.pos[1]).toBeGreaterThan(-1.35); // and not through it
  await reset(page);
  js = await joints(page);
  expect(js.every((j) => !j.broken)).toBe(true);
  for (const j of js) for (let i = 0; i < 3; i++) expect(j.pos[i]).toBeCloseTo(j.home[i], 6);
});

test("tomatoes: each tomato picks up on its own and sets down on the plate", async ({ page }) => {
  await ready(page, "tomatoes");
  await drag(page, [
    [0.27, 0.0, -0.46],
    [0.15, 0.1, 0.62],
  ]);
  await tick(page, 1.5);
  const b = await bodies(page);
  expect(b.length).toBe(10);
  const moved = b.filter((x) => Math.hypot(x.pos[0] - x.home[0], x.pos[2] - x.home[2]) > 0.2);
  expect(moved.length).toBe(1); // one tomato, the others stay
  expect(moved[0].pos[1]).toBeGreaterThan(-0.17); // on the plate
  // The lifted tomato is its kit-built stand-in, and so is the pile.
  const addon = await page.evaluate(() => window.__splashery.player.motion.handsAddon || {});
  expect(addon.kt1?.visible).toBe(1);
  await reset(page);
  for (const x of await bodies(page)) expect(x.pos).toEqual(x.home);
});
