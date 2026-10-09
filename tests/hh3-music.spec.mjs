// Lane Hands-on H3, the Music shelf (docs/HANDS-ON-PLAN.md): with the ✋
// switch on, a drag across the guitar's strings plucks each one with its own
// note, and a snare drum's stick, picked up, hits the head with a crack.
// (The keyboards and the xylophone were already hands-on.)

import { test, expect } from "@playwright/test";

const APP = "/?renderer=webgl2&adapt=off&profile=mid";

async function ready(page, id) {
  await page.goto(APP);
  await page.waitForSelector("body[data-ready='true']", { timeout: 180_000 });
  await page.evaluate(async (id) => {
    const { app, player } = window.__splashery;
    await app.chooseToy(id);
    player.opts.idleDelay = 1e9;
    // Every sound the toy's hands play, for the test to read.
    window.__heard = [];
    const play = app.sound.play.bind(app.sound);
    app.sound.play = (spec, o) => {
      if (o?.key === "hands") window.__heard.push(spec);
      return play(spec, o);
    };
  }, id);
  await page.waitForTimeout(800);
  if (!(await page.evaluate(() => window.__splashery.player.handsOn.on)))
    await page.click("#hands-toggle");
  await page.evaluate(() => window.__splashery.player.handsOn.ensure());
  await tick(page, 0.1);
}

const tick = (page, secs) =>
  page.evaluate(
    (n) => {
      const { player } = window.__splashery;
      for (let i = 0; i < n; i++) player.update(1 / 60);
    },
    Math.round(secs * 60),
  );

async function drag(page, points, { steps = 20, dt = 1 / 30 } = {}) {
  const px = await page.evaluate((pts) => {
    const { player } = window.__splashery;
    const r = player.stage.canvas.getBoundingClientRect();
    return pts.map((p) => {
      const s = player.screenPoint(p);
      return [r.left + s[0], r.top + s[1]];
    });
  }, points);
  await page.mouse.move(...px[0]);
  await page.mouse.down();
  for (let k = 1; k < px.length; k++)
    for (let i = 1; i <= steps; i++) {
      const f = i / steps;
      const [a, b] = [px[k - 1], px[k]];
      await page.mouse.move(a[0] + (b[0] - a[0]) * f, a[1] + (b[1] - a[1]) * f);
      await tick(page, dt);
    }
  await page.mouse.up();
}

const heard = (page) => page.evaluate(() => window.__heard);

test("guitar: a drag across the strings plucks each, low to high, each its own note", async ({
  page,
}) => {
  await ready(page, "guitar");
  const [from, to] = await page.evaluate(() => {
    const L = window.__splashery.player.toyInfo.recipe.hands.strings.list;
    const at = (s, f) => s.a.map((v, i) => v + (s.b[i] - v) * f);
    const p0 = at(L[0], 0.2);
    const p5 = at(L[5], 0.2);
    return [p0.map((v, i) => v - (p5[i] - v) * 0.08), p5.map((v, i) => v + (p5[i] - p0[i]) * 0.3)];
  });
  await drag(page, [from, to], { steps: 30, dt: 1 / 60 });
  await tick(page, 0.1);
  const plucks = (await heard(page)).filter((s) => s.voice === "pluck").map((s) => s.notes);
  expect(plucks).toEqual(["E2", "A2", "D3", "G3", "B3", "E4"]);
  const r = await page.evaluate(() => {
    const ho = window.__splashery.player.handsOn;
    return { plucked: ho.extras.about.plucked, moved: ho.moved, held: !!ho.hold };
  });
  for (const a of r.plucked) expect(a).toBeLessThan(5);
  // Strummed, not picked up.
  expect(r.held).toBe(false);
  expect(r.moved).toBe(false);
  // A press off the strings (on the body, below the bridge) still picks it up.
  await drag(page, [
    [0.35, -0.75, 0.15],
    [0.35, -0.2, 0.4],
  ]);
  await tick(page, 0.1);
  const moved = await page.evaluate(() => window.__splashery.player.handsOn.moved);
  expect(moved).toBe(true);
});

test("drum: a stick picked up and brought down on the head cracks, and on the rim clicks", async ({
  page,
}) => {
  await ready(page, "drum");
  // Stick 0, by its middle: up, then down hard so its tip meets the head.
  const mid = [0.535, 0.475, 0.27];
  await drag(page, [mid, [0.55, 0.85, 0.3]], { steps: 12 });
  // (It drops when let go; pick it up again where it lies.)
  await tick(page, 1);
  const lie = await page.evaluate(() => {
    const ho = window.__splashery.player.handsOn;
    return ho.pieces[0].body.pos.slice();
  });
  await page.evaluate(() => (window.__heard = []));
  await drag(page, [lie, [lie[0] - 0.2, 0.9, lie[2]], [0.45, 0.3, 0.2]], { steps: 10, dt: 1 / 60 });
  await tick(page, 0.3);
  const voices = (await heard(page)).map((s) => s.voice);
  expect(voices).toContain("snare");
  // The stick moved off its rest; the drum stayed put.
  const st = await page.evaluate(() => {
    const ho = window.__splashery.player.handsOn;
    return ho.pieces.map((p) => ({
      pos: p.body.pos.slice(),
      home: p.home.pos.slice(),
      pinned: p.body.pinned,
    }));
  });
  expect(Math.hypot(...st[0].pos.map((v, i) => v - st[0].home[i]))).toBeGreaterThan(0.05);
  expect(st[2].pinned).toBe(true);
  for (let i = 0; i < 3; i++) expect(st[2].pos[i]).toBeCloseTo(0, 4);
  // ↺ puts the sticks back.
  await page.click("#hands-reset");
  await tick(page, 1.2);
  const back = await page.evaluate(() =>
    window.__splashery.player.handsOn.pieces[0].body.pos.slice(),
  );
  for (let i = 0; i < 3; i++) expect(back[i]).toBeCloseTo(st[0].home[i], 3);
});
