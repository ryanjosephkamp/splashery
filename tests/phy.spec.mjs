// Lane Physics's showcase toys (docs/handoff/Physics.md): Pebbles, jelly,
// amoeba, cherries, bricks, macarons, spring toy, sushi and the bow. The
// clock is stepped by hand (SwiftShader draws slowly).

import { test, expect } from "@playwright/test";

const APP = "/?renderer=webgl2&adapt=off&profile=mid";

async function open(page, id, options = null) {
  await page.goto(APP);
  await page.waitForSelector("body[data-ready='true']", { timeout: 180_000 });
  await page.evaluate(
    async ({ id, options }) => {
      const { app, player } = window.__splashery;
      await app.chooseToy(id);
      if (options) await app.setToyOptions(options);
      player.opts.idleDelay = 1e9;
      // Steps the clock by hand; moves a held piece from a recipe point to
      // recipe points (as a finger would, through Hands-on).
      window.__run = (secs, step = 1 / 30) => {
        for (let t = 0; t < secs; t += step) player.update(step);
      };
      window.__carry = async (from, to, hold = 0.3) => {
        const h = player.handsOn;
        const s0 = player.screenPoint(from);
        player.pickDirty = true;
        const hit = await player.pickAt(...s0);
        if (!hit || !h.pressAt(hit, ...s0)) return -1;
        const s1 = player.screenPoint(to);
        for (let i = 1; i <= 20; i++) {
          h.moveTo(s0[0] + ((s1[0] - s0[0]) * i) / 20, s0[1] + ((s1[1] - s0[1]) * i) / 20);
          player.update(1 / 30);
        }
        const held = h.hold?.body;
        window.__run(hold);
        h.release();
        window.__run(1.2);
        return h.pieces.findIndex((pc) => pc.body === held);
      };
    },
    { id, options },
  );
  await page.waitForTimeout(500);
}

const finite = (list) => list.every((v) => Number.isFinite(v));

test("Pebbles: stones pick up and stack into a new cairn; a careless one topples", async ({
  page,
}) => {
  await open(page, "rocks", { style: "cairn" });
  expect(await page.evaluate(() => window.__splashery.player.handsOn.on)).toBe(true);
  const r = await page.evaluate(async () => {
    const st = window.__splashery.player.proc.ctx.kit.data.stones;
    const out = [];
    out.push(await window.__carry(st[6].home, [0.5, 0.0, -0.3]));
    out.push(await window.__carry(st[5].home, [0.5, 0.15, -0.3]));
    out.push(await window.__carry(st[4].home, [0.5, 0.4, -0.3]));
    const h = window.__splashery.player.handsOn;
    const ys = out.map((i) => h.pieces[i].body.pos[1]);
    return { out, ys, all: h.pieces.flatMap((p) => [...p.body.pos, ...p.body.q]) };
  });
  expect(r.out).toEqual([6, 5, 4]);
  expect(finite(r.all)).toBe(true);
  // Each rests on the one before.
  expect(r.ys[1]).toBeGreaterThan(r.ys[0] + 0.12);
  expect(r.ys[2]).toBeGreaterThan(r.ys[1] + 0.12);
  // The tap puts every stone home first.
  await page.evaluate(() => window.__splashery.player.act());
  await page.evaluate(() => window.__run(1));
  expect(await page.evaluate(() => window.__splashery.player.handsOn.moved)).toBe(false);
});

test("bricks and macarons stack; a brick snaps onto the studs", async ({ page }) => {
  await open(page, "bricks");
  const b = await page.evaluate(async () => {
    const i = await window.__carry([3.82, 0.6, 4.08], [0.0, 1.2, 5.0]);
    const h = window.__splashery.player.handsOn;
    const p = h.pieces[i].body;
    const yaw = Math.atan2(2 * (p.q[3] * p.q[1]), 1 - 2 * p.q[1] * p.q[1]);
    return { i, pos: p.pos, yaw };
  });
  expect(b.i).toBe(2);
  expect(b.pos[1]).toBeCloseTo(1.8, 1); // one brick up
  expect(Math.abs(b.pos[0])).toBeLessThan(0.05); // on the stud grid of the brick below
  await open(page, "macarons");
  const m = await page.evaluate(async () => {
    const i = await window.__carry([-0.55, 0.255, 0.45], [0.0, 1.42, -0.35]);
    return { i, y: window.__splashery.player.handsOn.pieces[i].body.pos[1] };
  });
  expect(m.i).toBe(3);
  expect(m.y).toBeGreaterThan(1.6); // on top of the stack of three
});

test("jelly and amoeba stretch and spring back; cherries swing and knock", async ({ page }) => {
  for (const id of ["jelly", "amoeba"]) {
    await open(page, id);
    const r = await page.evaluate(() => {
      const { player } = window.__splashery;
      const c = player.stage.toScreen(player.toyInfo.center);
      player.grabStart(player.fromRecipe([0, 0.3, 0.3]), c[0], c[1]);
      player.grabAt(c[0] + 60, c[1] - 60);
      window.__run(0.3);
      const pulled = Math.hypot(...player.driver.grab.pull);
      player.grabEnd();
      window.__run(2);
      return { pulled, after: Math.hypot(...player.driver.grab.pull), on: player.driver.grab.on };
    });
    expect(r.pulled).toBeGreaterThan(0.1);
    expect(r.after).toBeLessThan(0.01);
  }
  await open(page, "cherries");
  const c = await page.evaluate(async () => {
    const { player } = window.__splashery;
    const h = player.handsOn;
    const s0 = player.screenPoint([-0.36, -0.42, 0.2]);
    player.pickDirty = true;
    const hit = await player.pickAt(...s0);
    h.pressAt(hit, ...s0);
    for (let i = 1; i <= 15; i++) {
      h.moveTo(s0[0] - i * 6, s0[1] - i * 3);
      player.update(1 / 30);
    }
    h.release();
    const right = h.pieces[1].body;
    let moved = 0;
    for (let i = 0; i < 90; i++) {
      player.update(1 / 30);
      moved = Math.max(moved, Math.hypot(right.pos[0] - right.home.pos[0], right.pos[1] - right.home.pos[1])); // prettier-ignore
    }
    return { moved, z: h.pieces.map((p) => p.body.pos[2] - p.home.pos[2]) };
  });
  // The other cherry was knocked, and both stay in their own plane.
  expect(c.moved).toBeGreaterThan(0.05);
  for (const z of c.z) expect(Math.abs(z)).toBeLessThan(1e-6);
});

test("the spring toy stretches and settles; the bow shoots; sushi picks the tapped piece", async ({
  page,
}) => {
  await open(page, "spring-toy");
  const s = await page.evaluate(() => {
    const { player } = window.__splashery;
    const top = [-0.62, 0.85, 0.36];
    const a = player.screenPoint(top);
    player.grabStart(player.fromRecipe(top), ...a);
    for (let i = 1; i <= 10; i++) {
      player.grabAt(a[0], a[1] - i * 12);
      player.update(1 / 30);
    }
    const parts = () => player.motion.out.parts;
    const tall = parts().c14?.offset?.[1] ?? 0;
    player.grabEnd();
    window.__run(6);
    return { tall, rest: Object.values(parts()).every((p) => !p.offset || Math.hypot(...p.offset) < 0.02) }; // prettier-ignore
  });
  expect(s.tall).toBeGreaterThan(0.2);
  expect(s.rest).toBe(true);

  await open(page, "bow-and-target");
  const b = await page.evaluate(() => {
    const { player } = window.__splashery;
    const nock = [0.98, 0.03, 0];
    const a = player.screenPoint(nock);
    player.grabStart(player.fromRecipe(nock), ...a);
    for (let i = 1; i <= 10; i++) {
      player.grabAt(a[0] + i * 7, a[1]);
      player.update(1 / 30);
    }
    player.grabEnd();
    let stuck = null;
    for (let i = 0; i < 40 && !stuck; i++) {
      player.update(1 / 30);
      const o = player.motion.out.parts.arrow;
      if (o && Math.abs(o.offset[0] - (-0.83 - 0.18)) < 0.12) stuck = o.offset;
    }
    return stuck;
  });
  expect(b).not.toBeNull(); // it reached the target's face

  await open(page, "sushi");
  const pick = await page.evaluate(() => {
    const { player } = window.__splashery;
    player.act(player.fromRecipe([-0.24, 0.2, 0.1]));
    window.__run(2);
    const p = player.motion.out.parts;
    return { nigiri: Math.hypot(...(p.nigiri1?.offset || [0, 0, 0])), roll: Math.hypot(...(p.roll?.offset || [0, 0, 0])) }; // prettier-ignore
  });
  expect(pick.nigiri).toBeGreaterThan(0.1);
  expect(pick.roll).toBeLessThan(1e-6);
});
