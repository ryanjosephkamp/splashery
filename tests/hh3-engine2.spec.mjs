// Lane Hands-on H3's second engine pieces (docs/PACKS.md, 5g, "Latches and
// triggers", and 5h, "Strike pieces" and "Strings"): a joint caught on its
// latch holds until a tap pulls its trigger (a crossbow's string); a held
// piece marked `strike` hits the others (a drum's stick), and each hit
// names both pieces; a drag across a toy's strings plucks each one it
// crosses, with a sound per string.

import { test, expect } from "@playwright/test";

const APP = "/?renderer=webgl2&adapt=off&profile=mid";

async function open(page, id) {
  await page.goto(APP);
  await page.waitForSelector("body[data-ready='true']", { timeout: 180_000 });
  await page.evaluate(async (id) => {
    const { app, player } = window.__splashery;
    await app.chooseToy(id);
    player.opts.idleDelay = 1e9;
  }, id);
}

async function handsOn(page) {
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

const lid = (page) =>
  page.evaluate(() => {
    const j = window.__splashery.player.handsOn.joints.list[0];
    return { v: j.v, latched: !!j.latched };
  });

test("latch and trigger: the chest's lid catches on its latch and a tap lets it fall", async ({
  page,
}) => {
  await open(page, "chest");
  // The lid catches a little open (before Hands-on builds its world).
  await page.evaluate(() => {
    const { player } = window.__splashery;
    const hands = player.toyInfo.recipe.hands;
    hands.joints = hands.joints.map((j) => ({ ...j, latch: 1, trigger: true }));
  });
  await handsOn(page);
  await page.evaluate(() => {
    const ho = window.__splashery.player.handsOn;
    ho.ensure();
    // Swung up toward the latch, as a finger would let go of it.
    const j = ho.joints.list[0];
    j.v = 0.9;
    j.w = 8;
    j.awake = true;
    j.moving = true;
    ho.moved = true;
    ho.world.wake();
  });
  await tick(page, 0.5);
  let s = await lid(page);
  expect(s.latched).toBe(true);
  expect(s.v).toBeCloseTo(1, 3);
  // It holds there (its weight doesn't pull it shut).
  await tick(page, 1);
  s = await lid(page);
  expect(s.latched).toBe(true);
  expect(s.v).toBeCloseTo(1, 3);
  // A tap pulls the trigger (not the chest's own tap) and it drops shut.
  const r = await page.evaluate(() => window.__splashery.player.act().key);
  expect(r).toBe("trigger");
  await tick(page, 2);
  s = await lid(page);
  expect(s.latched).toBe(false);
  expect(s.v).toBeLessThan(0.05);
  // With nothing latched, a tap is the toy's own again.
  const r2 = await page.evaluate(() => window.__splashery.player.act().key);
  expect(r2).toBe("open");
  // ↺ from a latch: home, and caught only where home is the latch.
  await page.evaluate(() => {
    const ho = window.__splashery.player.handsOn;
    ho.joints.reset();
  });
  s = await lid(page);
  expect(s.latched).toBe(false);
});

test("strike pieces: a held stick hits the others, and each hit names both", async ({ page }) => {
  await open(page, "orange");
  await handsOn(page);
  const r = await page.evaluate(() => {
    const ho = window.__splashery.player.handsOn;
    ho.ensure();
    const w = ho.world;
    const [a, b] = ho.pieces.map((p) => p.body);
    // (Two wedges pulled out: loose, not pinned in their places.)
    a.pinned = b.pinned = false;
    a.held = true;
    const plain = w.pairs(a, b);
    a.strike = true;
    const strike = w.pairs(a, b);
    a.held = false;
    a.strike = false;
    ho.sounds = [];
    ho.onHit({ body: a, other: b, speed: ho.R() * 3, point: a.pos.slice(), n: [0, 1, 0] });
    const s = ho.sounds[0];
    return { plain, strike, name: s.name, against: s.against, names: ho.pieces.map((p) => ho.nameOf(p.body)) }; // prettier-ignore
  });
  expect(r.plain).toBeFalsy();
  expect(r.strike).toBeTruthy();
  expect(r.name).toBe(r.names[0]);
  expect(r.against).toBe(r.names[1]);
  expect(r.name).not.toBeNull();
});

test("strings: a drag across the guitar's strings plucks each one, in turn", async ({ page }) => {
  await open(page, "guitar");
  // The six strings, from the kit's parts (each string's ends are the
  // pivots of its two halves), back in the recipe's frame.
  await page.evaluate(() => {
    const { player } = window.__splashery;
    const ctx = player.motion.ctx;
    const { center: c, scale: s } = ctx.transform;
    const at = (name) => ctx.parts.find((p) => p.name === name).pivot.map((v, i) => v / s + c[i]);
    const list = [0, 1, 2, 3, 4, 5].map((i) => ({ a: at(`s${i}a`), b: at(`s${i}b`), name: `s${i}` })); // prettier-ignore
    window.__plucks = [];
    player.toyInfo.recipe.hands = {
      strings: { list, reach: 0.04 },
      sound: (h) => {
        if (h.pluck !== undefined) window.__plucks.push(h.pluck);
        return null;
      },
    };
    player.handsOn.attach(player.toyInfo);
    window.__strings = list;
  });
  await handsOn(page);
  // From just outside the low string to just past the high one, across
  // their middles. The view holds still first (Fix11): the turntable starts
  // after 2.5 s without a touch, and on a busy machine it turned the guitar
  // under the drag, so the finger ended short of the high string.
  const px = await page.evaluate(() => {
    const { player } = window.__splashery;
    player.camera.turntable = false;
    player.camera.setState(player.camera.getState(), { snap: true });
    const L = window.__strings;
    const mid = (s, f) => s.a.map((v, i) => v + (s.b[i] - v) * f);
    const p0 = mid(L[0], 0.25);
    const p5 = mid(L[5], 0.25);
    const out = p0.map((v, i) => v - (p5[i] - v) * 0.12);
    const past = p5.map((v, i) => v + (p5[i] - p0[i]) * 0.12);
    const r = player.stage.canvas.getBoundingClientRect();
    return [out, past].map((p) => {
      const s = player.screenPoint(p);
      return [r.left + s[0], r.top + s[1]];
    });
  });
  const before = await page.evaluate(() => window.__splashery.player.handsOn.body?.pos.slice());
  await page.mouse.move(...px[0]);
  await page.mouse.down();
  for (let i = 1; i <= 24; i++) {
    const f = i / 24;
    await page.mouse.move(
      px[0][0] + (px[1][0] - px[0][0]) * f,
      px[0][1] + (px[1][1] - px[0][1]) * f,
    );
    await tick(page, 1 / 60);
  }
  await page.mouse.up();
  await tick(page, 0.1);
  const r = await page.evaluate(() => {
    const ho = window.__splashery.player.handsOn;
    return {
      plucks: window.__plucks,
      ages: ho.extras.about.plucked,
      held: !!ho.hold,
      pos: ho.body?.pos.slice(),
    };
  });
  expect(r.plucks).toEqual([0, 1, 2, 3, 4, 5]);
  // (Low first: the first string plucked is the oldest.)
  for (let i = 1; i < 6; i++) expect(r.ages[i]).toBeLessThanOrEqual(r.ages[i - 1]);
  expect(r.ages[0]).toBeLessThan(5);
  // The strum didn't pick the guitar up.
  expect(r.held).toBe(false);
  if (before && r.pos) for (let i = 0; i < 3; i++) expect(r.pos[i]).toBeCloseTo(before[i], 3);
  // Their ages count up.
  await tick(page, 1);
  const ages = await page.evaluate(() => window.__splashery.player.handsOn.extras.about.plucked);
  for (let i = 0; i < 6; i++) expect(ages[i]).toBeGreaterThan(r.ages[i] + 0.9);
});
