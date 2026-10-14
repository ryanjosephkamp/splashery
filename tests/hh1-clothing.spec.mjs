// Lane Hands-on H1, Clothing (docs/handoff/HandsH1.md): the sunglasses'
// arms fold on their hinges and stay, the cap flies off its stand like a disc, a pulled
// lace undoes the shoe's bow and falls outside the shoe (and ↺ ties it), and the hoodie's sleeves
// bend at the elbow and swing back down.

import { test, expect } from "@playwright/test";

const APP = "/?renderer=webgl2&adapt=off&profile=mid";

async function open(page, id) {
  await page.goto(APP);
  await page.waitForSelector("body[data-ready='true']", { timeout: 180_000 });
  await page.evaluate(async (id) => {
    const { app, player } = window.__splashery;
    await app.chooseToy(id);
    player.opts.idleDelay = 1e9;
    player.handsOn.setOn(true);
  }, id);
}

test("sunglasses: an arm folds in on its hinge and stays where it is left", async ({ page }) => {
  await open(page, "sunglasses");
  const s = await page.evaluate(() => {
    const { player } = window.__splashery;
    const h = player.handsOn;
    h.ensure();
    const st = () => Object.fromEntries(h.joints.state().map((j) => [j.name, j.v]));
    const rot = (q, v) => {
      const [x, y, z, w] = q;
      const cx = y * v[2] - z * v[1] + w * v[0];
      const cy = z * v[0] - x * v[2] + w * v[1];
      const cz = x * v[1] - y * v[0] + w * v[2];
      return [v[0] + 2 * (y * cz - z * cy), v[1] + 2 * (z * cx - x * cz), v[2] + 2 * (x * cy - y * cx)]; // prettier-ignore
    };
    // The right arm's tip and a point by the lenses, as the glasses rest
    // (turned 0.5 radians about their middle).
    const q = [0, Math.sin(-0.25), 0, Math.cos(-0.25)];
    const C = [0, 0, 0.3];
    const at = (p) =>
      rot(
        q,
        p.map((v, i) => v - C[i]),
      ).map((v, i) => v + C[i]);
    const P = at([0.52, 0, 0]);
    const T = at([0.1, 0, 0.55]);
    const s0 = player.screenPoint(P);
    const s1 = player.screenPoint(T);
    h.pressAt(player.fromRecipe(P), s0[0], s0[1]);
    for (let k = 1; k <= 30; k++) {
      h.moveTo(s0[0] + ((s1[0] - s0[0]) * k) / 30, s0[1] + ((s1[1] - s0[1]) * k) / 30);
      player.update(1 / 60);
    }
    const held = st();
    h.release();
    for (let k = 0; k < 60; k++) player.update(1 / 60);
    return { held, after: st() };
  });
  expect(s.held.front).toBeCloseTo(-0.5, 5); // the frame keeps its resting turn
  expect(s.held.armR).toBeGreaterThan(0.9); // folded in
  expect(s.after.armR).toBeGreaterThan(0.9); // and it stays there
  expect(s.after.armL).toBeCloseTo(0, 3); // the other arm untouched
});

test("baseball cap: lifted off its stand and thrown, it flies on the cap's own material and lands softly", async ({
  page,
}) => {
  await open(page, "baseball-cap");
  const s = await page.evaluate(() => {
    const { player } = window.__splashery;
    const h = player.handsOn;
    h.ensure();
    const b = h.pieces[0].body;
    const R = h.R();
    h.free(b);
    b.pos[1] += 0.5 * R;
    b.vel = [2.5 * R, 0.5 * R, 0];
    b.omega = [0, 10, 0];
    h.moved = true;
    h.world.wake();
    let t = 0;
    for (; t < 5; t += 1 / 60) {
      player.update(1 / 60);
      if (h.world.asleep) break;
    }
    const m = h.extras.mats.get(b);
    return { lift: m?.lift ?? 0, e: b.restitution, t, away: Math.hypot(b.pos[0] - b.home.pos[0], b.pos[2] - b.home.pos[2]) / R }; // prettier-ignore
  });
  console.log(`cap: ${JSON.stringify(s)}`);
  expect(s.lift).toBeGreaterThan(0); // it glides a little on its brim
  expect(s.e).toBeLessThan(0.2); // a soft landing
  expect(s.t).toBeLessThan(5); // and it comes to rest
  expect(s.away).toBeGreaterThan(0.5); // off its stand
});

test("baseball cap: dropped back over its stand, it lands on the stand, not through it", async ({
  page,
}) => {
  await open(page, "baseball-cap");
  const s = await page.evaluate(() => {
    const { player } = window.__splashery;
    const h = player.handsOn;
    h.ensure();
    const b = h.pieces[0].body;
    const home = b.home.pos.slice();
    h.free(b);
    b.pos = [home[0], home[1] + 1.5, home[2]];
    h.moved = true;
    h.world.wake();
    for (let t = 0; t < 3; t += 1 / 60) player.update(1 / 60);
    return { dy: b.pos[1] - home[1], stand: h.pieces.slice(1).every((pc) => pc.body.pinned) };
  });
  expect(s.stand).toBe(true); // the stand stays put
  expect(s.dy).toBeGreaterThan(-0.1); // resting on the dome, about where it sat
});

test("running shoe: a lace end pulled out undoes the bow; ↺ ties it again", async ({ page }) => {
  await open(page, "running-shoe");
  const s = await page.evaluate(() => {
    const { player } = window.__splashery;
    const h = player.handsOn;
    h.ensure();
    const sp = h.softParts;
    const d = (n) => Math.hypot(...n.x.map((v, i) => v - n.home[i]));
    for (let k = 0; k < 30; k++) player.update(1 / 60);
    const still = d(sp.nodes[5]);
    const end = sp.nodes[21];
    const P = end.x.slice();
    const s0 = player.screenPoint(P);
    h.pressAt(player.fromRecipe(P), s0[0], s0[1]);
    for (let k = 1; k <= 30; k++) {
      h.moveTo(s0[0] + 3 * k, s0[1] + 2 * k);
      player.update(1 / 60);
    }
    h.release();
    for (let k = 0; k < 120; k++) player.update(1 / 60);
    // How far each lace's loop and tail fell from the bow (the most any of it moved).
    const loopA = Math.max(...sp.nodes.slice(1, 22).map(d));
    const loopB = Math.max(...sp.nodes.slice(23, 44).map(d));
    // Lace inside the shoe: under the scan's own top, in columns 0.1 across.
    const kit = player.motion.ctx.kit;
    const T = kit.transform;
    const pos = kit.buf.pos;
    const cols = new Map();
    for (let i = 0; i < kit.count * 0.82; i++) {
      const [x, y, z] = [0, 1, 2].map((k) => pos[3 * i + k] / T.scale + T.center[k]);
      const key = `${Math.round(x / 0.1)},${Math.round(z / 0.1)}`;
      (cols.get(key) || cols.set(key, []).get(key)).push(y);
    }
    const top = (x, z) => {
      const ys = cols.get(`${Math.round(x / 0.1)},${Math.round(z / 0.1)}`);
      return ys?.length > 30 ? ys.sort((a, b) => a - b)[Math.floor(ys.length * 0.9)] : -Infinity;
    };
    // (Below the lacing: on it, the laces lie between the collar's flaps.)
    const through = sp.nodes.filter(({ x }) => x[1] < Math.min(-0.1, top(x[0], x[2]) - 0.05)).length; // prettier-ignore
    const low = Math.min(...sp.nodes.map((n) => n.x[1]));
    h.reset();
    for (let k = 0; k < 90; k++) player.update(1 / 60);
    return { still, loopA, loopB, through, low, tied: d(sp.nodes[5]) };
  });
  expect(s.still).toBeLessThan(0.005); // the bow holds by itself
  expect(s.loopA).toBeGreaterThan(0.3); // pulled lace: it falls loose
  expect(s.loopB).toBeGreaterThan(0.3); // and the other lace too
  expect(s.low).toBeLessThan(-0.4); // down the shoe's side to the floor
  expect(s.through).toBe(0); // over and outside the shoe, never through it
  expect(s.tied).toBeLessThan(0.01); // ↺ ties it again
});

test("hoodie: a sleeve lifted by its cuff bends at the elbow, swings back down and settles", async ({
  page,
}) => {
  await open(page, "hoodie");
  const s = await page.evaluate(() => {
    const { player } = window.__splashery;
    const h = player.handsOn;
    h.ensure();
    const sp = h.softParts;
    const st = sp.strands.find((x) => x.name === "forearmR");
    const cuff = sp.nodes[st.first + 1];
    const P = cuff.x.slice();
    const s0 = player.screenPoint(P);
    const ang = () => {
      const q = player.motion.handsParts?.forearmR?.quat;
      return q ? 2 * Math.acos(Math.min(1, Math.abs(q[3]))) : 0;
    };
    h.pressAt(player.fromRecipe(P), s0[0], s0[1]);
    for (let k = 1; k <= 20; k++) {
      h.moveTo(s0[0] + 5 * k, s0[1] - 6 * k);
      player.update(1 / 60);
    }
    const held = ang();
    const upper = player.motion.handsParts?.sleeveR;
    h.release();
    for (let k = 0; k < 240; k++) player.update(1 / 60);
    return { held, upper: !!upper, end: ang() };
  });
  expect(s.held).toBeGreaterThan(0.2); // lifted out
  expect(s.upper).toBe(false); // the upper sleeve stays as it hangs, joined at shoulder and armpit
  expect(s.end).toBeLessThan(0.12); // hanging again
});
