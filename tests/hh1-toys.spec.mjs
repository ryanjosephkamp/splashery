// Lane Hands-on H1, Toys (docs/handoff/HandsH1.md): each toy's Hands-on
// line measured from its own hands block: the dice land on a face, the
// paper plane glides, the rubber duck squeezes, the soap bubbles pop, the
// spinning top topples as it slows, the crane flaps, the robot walks and the
// teddy bear's limbs swing and settle.

import { test, expect } from "@playwright/test";

const APP = "/?renderer=webgl2&adapt=off&profile=mid";

async function open(page, id, options) {
  await page.goto(APP);
  await page.waitForSelector("body[data-ready='true']", { timeout: 180_000 });
  await page.evaluate(
    async ({ id, options }) => {
      const { app, player } = window.__splashery;
      await app.chooseToy(id);
      if (options) await app.setToyOptions(options);
      player.opts.idleDelay = 1e9;
      player.handsOn.setOn(true);
    },
    { id, options },
  );
}

const ROT = `(q, v) => { const [x, y, z, w] = q; const cx = y * v[2] - z * v[1] + w * v[0], cy = z * v[0] - x * v[2] + w * v[1], cz = x * v[1] - y * v[0] + w * v[2]; return [v[0] + 2 * (y * cz - z * cy), v[1] + 2 * (z * cx - x * cz), v[2] + 2 * (x * cy - y * cx)]; }`; // prettier-ignore

for (const kind of ["d6", "d20"])
  test(`dice (${kind}): thrown, each tumbles, bounces and lands on a face`, async ({ page }) => {
    await open(page, "dice", { kind });
    const s = await page.evaluate((ROT) => {
      const rot = eval(ROT);
      const { player } = window.__splashery;
      const h = player.handsOn;
      h.ensure();
      for (const [k, pc] of h.pieces.entries()) {
        const b = pc.body;
        h.free(b);
        b.pos[1] += 1.5;
        b.vel = [k ? -1.5 : 1.5, 2, 0.6];
        b.omega = [7, 3 - k * 5, 5];
      }
      h.moved = true;
      h.world.wake();
      let t = 0;
      for (; t < 6; t += 1 / 60) {
        player.update(1 / 60);
        if (h.world.asleep) break;
      }
      const floor = h.world.planes[0].d;
      return {
        t,
        dice: h.pieces.map((pc) => {
          const b = pc.body;
          // The lowest three corners (a d20) or the lowest face (a d6) on the floor.
          const low = pc.def.points.map((p) => rot(b.q, p)[1] + b.pos[1] - floor).sort((a, c) => a - c); // prettier-ignore
          return { low3: low[2], flat: Math.max(...[[1, 0, 0], [0, 1, 0], [0, 0, 1]].map((a) => Math.abs(rot(b.q, a)[1]))) }; // prettier-ignore
        }),
      };
    }, ROT);
    console.log(`dice ${kind}: ${JSON.stringify(s)}`);
    expect(s.t).toBeLessThan(5); // they come to rest
    for (const d of s.dice) {
      expect(d.low3).toBeLessThan(0.06); // three corners (at least) on the floor: a face down
      if (kind === "d6") expect(d.flat).toBeGreaterThan(0.995);
    }
  });

test("paper plane: launched level along its nose, it glides (a long way for its drop)", async ({
  page,
}) => {
  await open(page, "paper-plane");
  const s = await page.evaluate(() => {
    const { player } = window.__splashery;
    const h = player.handsOn;
    h.ensure();
    const b = h.body;
    const R = h.R();
    b.pos[1] += 1.5 * R;
    b.vel = [3 * R, 0, 0];
    h.moved = true;
    h.world.wake();
    let t = 0;
    for (; t < 0.6; t += 1 / 60) player.update(1 / 60);
    return { far: (b.pos[0] - b.home.pos[0]) / R, drop: 1.5 - (b.pos[1] - b.home.pos[1]) / R };
  });
  console.log(`paper plane: ${JSON.stringify(s)}`);
  // Free fall from 1.5 toy radii takes 0.34 s; it is still up after 0.6 s,
  // having gone over three times as far as it dropped.
  expect(s.drop).toBeLessThan(1.4);
  expect(s.far / s.drop).toBeGreaterThan(2.5);
});

test("rubber duck: a held press squeezes it and plays a squeak; let go it springs back", async ({
  page,
}) => {
  await open(page, "rubber-duck");
  const s = await page.evaluate(() => {
    const { player } = window.__splashery;
    const h = player.handsOn;
    const c = player.stage.toScreen(player.toyInfo.center);
    const cues = [];
    const sound = player.toyInfo.recipe.hands.sound;
    h.pressAt(player.toyInfo.center.slice(), c[0], c[1]);
    for (let i = 0; i < 30; i++) player.update(1 / 60);
    const held = h.squishAmp();
    cues.push(sound({ press: true, speed: 3 }, 0.5)?.voice);
    h.release();
    for (let i = 0; i < 90; i++) player.update(1 / 60);
    return { held, end: h.squishAmp(), cue: cues[0] };
  });
  expect(s.held).toBeGreaterThan(0.25);
  expect(Math.abs(s.end)).toBeLessThan(0.01);
  expect(s.cue).toBe("squeak");
});

test("soap bubbles: a poke pops the bubble it touches first, and only that one", async ({
  page,
}) => {
  await open(page, "soap-bubbles");
  const s = await page.evaluate(() => {
    const { player } = window.__splashery;
    const h = player.handsOn;
    for (let i = 0; i < 10; i++) player.update(1 / 60);
    const kit = player.motion.ctx.kit;
    const vis = () => {
      const o = player.motion.out.parts;
      return Object.keys(o)
        .filter((k) => /^b\d$/.test(k))
        .map((k) => o[k].visible ?? 1);
    };
    const before = vis();
    const part = kit.parts.find((p) => p.name === "b0");
    const off = player.motion.out.parts.b0.offset;
    const p = part.pivot.map((v, i) => v + off[i]);
    const sp = player.screenPoint(p);
    h.pressAt(player.fromRecipe(p), sp[0], sp[1]);
    for (let i = 0; i < 12; i++) player.update(1 / 60);
    h.release();
    const after = vis();
    return { gone: before.filter((v, i) => v > 0.5 && after[i] < 0.01).length };
  });
  expect(s.gone).toBe(1);
});

test("spinning top: flicked round, it spins, wobbles wider as it slows and topples onto its side", async ({
  page,
}) => {
  await open(page, "spinning-top");
  const s = await page.evaluate((ROT) => {
    const rot = eval(ROT);
    const { player } = window.__splashery;
    const h = player.handsOn;
    h.ensure();
    const j = h.joints.list[0];
    const P = [0.55, 0.4, 0.3];
    const s0 = player.screenPoint(P);
    h.pressAt(player.fromRecipe(P), s0[0], s0[1]);
    for (let k = 1; k <= 6; k++) {
      h.moveTo(s0[0] - k * 25, s0[1] + k * 2);
      player.update(1 / 60);
    }
    h.release();
    const tilt = [];
    let spin = 0;
    for (let t = 0; t < 12; t += 1 / 60) {
      player.update(1 / 60);
      spin = Math.max(spin, Math.abs(j.w));
      const q = player.motion.handsParts?.top?.quat;
      if (q && Math.round(t * 60) % 60 === 0)
        tilt.push(Math.acos(Math.min(1, rot(q, [0, 1, 0])[1])));
    }
    return { spin, tilt };
  }, ROT);
  console.log(`top: ${JSON.stringify(s)}`);
  expect(s.spin).toBeGreaterThan(3);
  expect(s.tilt[0]).toBeLessThan(0.25); // nearly upright while it spins fast
  expect(s.tilt.at(-1)).toBeCloseTo(Math.atan2(0.53, 0.63), 2); // on its side: tip and rim down
  for (let k = 1; k < s.tilt.length; k++) expect(s.tilt[k]).toBeGreaterThanOrEqual(s.tilt[k - 1] - 0.02); // prettier-ignore
});

test("origami crane: pulling its tail flaps the wings, and they flap on as it springs back", async ({
  page,
}) => {
  await open(page, "origami-crane");
  const s = await page.evaluate(() => {
    const { player } = window.__splashery;
    const h = player.handsOn;
    // The view eases in on the clock's frames first (how far it has come
    // depends on how loaded the machine is), so it settles here, and the
    // tail is pulled up to a point on the toy, not by screen pixels. The
    // turntable stays off (Fix11): those two seconds of clock start it (it
    // waits 2.5 s without a touch), and it turned the crane under the pull
    // by an amount that depended on the machine's load.
    player.camera.turntable = false;
    for (let i = 0; i < 120; i++) player.update(1 / 60);
    const p = [-0.45, 0.14, 0];
    const sp = player.screenPoint(p);
    const to = player.screenPoint([p[0], p[1] + 0.45, p[2]]);
    h.pressAt(player.fromRecipe(p), sp[0], sp[1]);
    for (let k = 1; k <= 12; k++) {
      h.moveTo(sp[0] + ((to[0] - sp[0]) * k) / 12, sp[1] + ((to[1] - sp[1]) * k) / 12);
      player.update(1 / 60);
    }
    const held = player.motion.handsParts.wingR.angle;
    h.release();
    const w = [];
    for (let k = 1; k <= 60; k++) {
      player.update(1 / 60);
      w.push(player.motion.handsParts?.wingR?.angle ?? 0);
    }
    let flips = 0;
    for (let k = 1; k < w.length; k++) if (Math.sign(w[k]) !== Math.sign(w[k - 1])) flips++;
    return { held, flips, end: Math.abs(w.at(-1)) };
  });
  expect(Math.abs(s.held)).toBeGreaterThan(0.5);
  expect(s.flips).toBeGreaterThanOrEqual(2); // flaps back and forth
});

test("wind-up robot: wound by its key, it walks off as the key unwinds, arms swinging", async ({
  page,
}) => {
  await open(page, "robot");
  const s = await page.evaluate(() => {
    const { player } = window.__splashery;
    const h = player.handsOn;
    const c = player.screenPoint([0, -0.1, 0.23]);
    const s0 = player.screenPoint([0.15, -0.1, 0.23]);
    h.pressAt(player.fromRecipe([0.15, -0.1, 0.23]), s0[0], s0[1]);
    const a0 = Math.atan2(s0[1] - c[1], s0[0] - c[0]);
    const r = Math.hypot(s0[0] - c[0], s0[1] - c[1]);
    for (let k = 1; k <= 120; k++) {
      h.moveTo(c[0] + r * Math.cos(a0 - k * 0.15), c[1] + r * Math.sin(a0 - k * 0.15));
      player.update(1 / 60);
    }
    const wound = h.joints.state()[0].v;
    h.release();
    let swing = 0;
    for (let k = 1; k <= 240; k++) {
      player.update(1 / 60);
      const q = player.motion.handsParts?.armR?.quat;
      if (q) swing = Math.max(swing, 2 * Math.acos(Math.min(1, Math.abs(q[3]))));
    }
    return {
      wound,
      walked: player.motion.handsParts.walker.offset[2],
      swing,
      left: h.joints.state()[0].v,
    };
  });
  console.log(`robot: ${JSON.stringify(s)}`);
  expect(s.wound).toBeGreaterThan(10); // nearly three turns
  expect(s.left).toBeLessThan(s.wound * 0.5); // unwinding
  expect(s.walked).toBeGreaterThan(0.3); // walked forward
  expect(s.swing).toBeGreaterThan(0.2);
});

test("teddy bear: swung and dropped, its arms and head swing on it and settle", async ({
  page,
}) => {
  await open(page, "teddy-bear");
  const s = await page.evaluate(() => {
    const { player } = window.__splashery;
    const h = player.handsOn;
    const ang = (q) => (q ? 2 * Math.acos(Math.min(1, Math.abs(q[3]))) : 0);
    const P = [0, 0, 0.36];
    const sp = player.screenPoint(P);
    h.pressAt(player.fromRecipe(P), sp[0], sp[1]);
    let swing = 0;
    for (let k = 1; k <= 30; k++) {
      h.moveTo(sp[0] + 8 * k * Math.sin(k / 3), sp[1] - 4 * k);
      player.update(1 / 60);
      const p = player.motion.handsParts || {};
      swing = Math.max(swing, Math.abs(ang(p.armL?.quat) - ang(p.torso?.quat)));
    }
    h.release();
    for (let k = 1; k <= 150; k++) player.update(1 / 60);
    const a = [];
    for (let k = 1; k <= 30; k++) {
      player.update(1 / 60);
      a.push(ang(player.motion.handsParts?.armR?.quat));
    }
    return { swing, settled: Math.max(...a) - Math.min(...a) };
  });
  console.log(`teddy: ${JSON.stringify(s)}`);
  expect(s.swing).toBeGreaterThan(0.15); // an arm swings on the body
  expect(s.settled).toBeLessThan(0.08); // still, two seconds after it lands
});
