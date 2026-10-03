// Lane Hands engine C's demo toys (docs/handoff/HandsEngineC.md): the jelly
// blob, the octopus, the yo-yo, the kite, the pizza and the hoodie, each
// played with a finger in Hands-on and measured over time.

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
    // A finger on recipe points: press at `from`, move through `path`
    // (a step of the clock per point), and maybe let go.
    window.__hec = {
      line: (a, b, n) =>
        Array.from({ length: n }, (_, i) => a.map((v, k) => v + ((b[k] - v) * (i + 1)) / n)),
      at(p) {
        const s = player.screenPoint(p);
        return { world: player.fromRecipe(p), x: s[0], y: s[1] };
      },
      drag(from, path, letGo = true) {
        const ho = player.handsOn;
        const a = this.at(from);
        ho.pressAt(a.world, a.x, a.y);
        for (const p of path) {
          const b = this.at(p);
          ho.moveTo(b.x, b.y);
          player.update(1 / 60);
        }
        if (letGo) ho.release();
      },
      run(secs) {
        for (let i = 0; i < secs * 60; i++) player.update(1 / 60);
        return player.handsOn.state();
      },
    };
  }, id);
}

const dist = (a, b) => Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]);

test("jelly blob: drag it and it stretches; let go and it wobbles back", async ({ page }) => {
  await open(page, "blob");
  const r = await page.evaluate(() => {
    const { player } = window.__splashery;
    const c = player.toRecipe(player.toyInfo.center);
    const R = player.toyInfo.radius;
    const s = player.stage.toScreen(player.toyInfo.center);
    const ho = player.handsOn;
    ho.pressAt(player.toyInfo.center.slice(), s[0], s[1]);
    for (let i = 1; i <= 15; i++) {
      ho.moveTo(s[0] + i * 10, s[1] - i * 3);
      player.update(1 / 60);
    }
    // Held still a moment: the pull catches up with the finger.
    for (let i = 0; i < 20; i++) player.update(1 / 60);
    const held = Math.hypot(...player.driver.grab.pull) / R;
    ho.release();
    let crossed = false;
    const x0 = player.driver.grab.pull[0];
    let t = 0;
    for (; t < 4 && player.driver.grab.on; t += 1 / 60) {
      player.update(1 / 60);
      if (player.driver.grab.on && Math.sign(player.driver.grab.pull[0]) !== Math.sign(x0)) crossed = true; // prettier-ignore
    }
    return { held, crossed, t, on: player.driver.grab.on, c };
  });
  expect(r.held).toBeGreaterThan(0.3);
  expect(r.held).toBeLessThanOrEqual(0.81);
  expect(r.crossed).toBe(true); // a wobble through rest
  expect(r.on).toBe(false);
  expect(r.t).toBeLessThan(3);
});

test("octopus: drag the body and the arms trail, then curl back; Reset sends it home", async ({
  page,
}) => {
  await open(page, "octopus");
  const r = await page.evaluate(() => {
    const h = window.__hec;
    h.drag([0, 0.3, 0], h.line([0, 0.3, 0], [0.6, 0.3, 0.3], 20), false);
    const s = window.__splashery.player.handsOn.state();
    const body = s.bodies[0];
    // How far each arm's tip is from where it would be if the arm moved rigidly with the body.
    // Where an arm's tip would be if the arm moved rigidly with the body.
    const rigid = (b, p) => {
      const [x, y, z, w] = b.q;
      const v = p.map((c, k) => c - b.home[k]);
      const t = [2 * (y * v[2] - z * v[1]), 2 * (z * v[0] - x * v[2]), 2 * (x * v[1] - y * v[0])];
      const r = [v[0] + w * t[0] + (y * t[2] - z * t[1]), v[1] + w * t[1] + (z * t[0] - x * t[2]), v[2] + w * t[2] + (x * t[1] - y * t[0])]; // prettier-ignore
      return r.map((c, k) => c + b.pos[k]);
    };
    const lag = s.soft.strands.map((a) => Math.hypot(...a.nodes[5].map((v, k) => v - rigid(body, a.home[5])[k]))); // prettier-ignore
    window.__splashery.player.handsOn.release();
    const later = h.run(4);
    const back = later.soft.strands.map((a) => Math.hypot(...a.nodes[5].map((v, k) => v - rigid(later.bodies[0], a.home[5])[k]))); // prettier-ignore
    window.__splashery.player.handsOn.reset();
    const home = h.run(1);
    return { lag: Math.max(...lag), back: Math.max(...back), moved: home.moved, soft: home.soft.moved, tokens: !!window.__splashery.player.motion.handsTokens }; // prettier-ignore
  });
  expect(r.lag).toBeGreaterThan(0.08); // the tips trail
  expect(r.back).toBeLessThan(0.05); // and curl back into shape
  expect(r.moved).toBe(false);
  expect(r.soft).toBe(false);
  expect(r.tokens).toBe(false); // the recipe's own sway again
});

test("yo-yo: pull it down, let go: it drops, spins at the end and climbs back", async ({
  page,
}) => {
  await open(page, "yo-yo");
  const r = await page.evaluate(() => {
    const h = window.__hec;
    h.drag([0, 0.38, 0], h.line([0, 0.38, 0], [0, 0.05, 0], 30));
    const len = (s) => Math.hypot(...s.nodes[8].map((v, k) => v - s.nodes[0][k]));
    const out = [];
    for (let i = 0; i < 4 * 6; i++) out.push(len(h.run(1 / 6).soft.strands[0]));
    return out;
  });
  const longest = Math.max(...r);
  expect(longest).toBeGreaterThan(0.95); // down to the end of the string (1.1)
  expect(longest).toBeLessThan(1.16);
  expect(r.at(-1)).toBeLessThan(0.7); // back up to its rest (0.62)
  // It went down first, then climbed.
  expect(r.indexOf(longest)).toBeGreaterThan(0);
  expect(r.indexOf(longest)).toBeLessThan(r.length - 3);
});

test("kite: drag it down and let go: it swoops back up, the tail streaming downwind", async ({
  page,
}) => {
  await open(page, "kite");
  const r = await page.evaluate(() => {
    const h = window.__hec;
    const k0 = [-0.03, 0.12, 0.1];
    h.drag(k0, h.line(k0, [-0.5, -0.4, 0.2], 20));
    const low = h.run(0.05).soft.strands[0].nodes[6].slice();
    const s = h.run(3).soft;
    const kite = s.strands[0].nodes[6];
    const tail = s.strands[1].nodes;
    return { low, kite, home: s.strands[0].home[6], tailEnd: tail[5], tailRoot: tail[0] };
  });
  expect(r.kite[1]).toBeGreaterThan(r.low[1] + 0.2); // it climbed back
  expect(dist(r.kite, r.home)).toBeLessThan(0.35); // near where it flies
  expect(r.tailEnd[0]).toBeLessThan(r.tailRoot[0] - 0.3); // the tail streams out with the wind
});

test("pizza: pull the slice away and the cheese strings stretch and snap; Reset mends them", async ({
  page,
}) => {
  await open(page, "pizza");
  const r = await page.evaluate(() => {
    const h = window.__hec;
    const from = [0.27, 0.06, 0.44];
    h.drag(from, h.line(from, [1.1, 0.06, 0.1], 30), false);
    const mid = h.run(0.8).soft; // still held, the slice catches up with the finger
    const shown = window.__splashery.player.motion.handsTokens.filter((e) => e.token.visible > 0.5).length; // prettier-ignore
    window.__splashery.player.handsOn.release();
    const after = h.run(1).soft;
    window.__splashery.player.handsOn.reset();
    const home = h.run(1);
    return { broken: after.strands.map((s) => s.broken), shown, mendedBroken: home.soft.strands.map((s) => s.broken), moved: home.moved, slice: home.bodies[0], mid: mid.strands.map((s) => s.broken) }; // prettier-ignore
  });
  expect(r.shown).toBeGreaterThan(10); // the strings show once pulled out
  expect(r.broken.filter((b) => b > 0).length).toBeGreaterThanOrEqual(2); // some snapped
  expect(r.mendedBroken.every((b) => b === 0)).toBe(true);
  expect(r.moved).toBe(false);
  expect(dist(r.slice.pos, r.slice.home)).toBeLessThan(1e-6);
});

test("hoodie: pull the hood and it flops forward as one solid piece, then swings back up", async ({
  page,
}) => {
  await open(page, "hoodie");
  const r = await page.evaluate(() => {
    const h = window.__hec;
    const { player } = window.__splashery;
    const crown = [0, 0.78, 0.05];
    h.drag(crown, h.line(crown, [0.05, 0.6, 0.55], 20), false);
    h.run(0.3);
    const held = player.motion.handsParts?.hood;
    const angle = (q) => (q ? 2 * Math.asin(Math.min(1, Math.hypot(q[0], q[1], q[2]))) : 0);
    // The hood turns only about the hinge across the neck (x), and stays
    // there (no slide): a solid piece on its seam.
    const out = {
      held: angle(held?.quat),
      axisX: held
        ? Math.abs(held.quat[0]) / Math.hypot(held.quat[0], held.quat[1], held.quat[2])
        : 0,
      offset: held ? Math.hypot(...held.offset) : 1,
    };
    player.handsOn.release();
    let crossed = false;
    for (let i = 0; i < 4 * 60; i++) {
      player.update(1 / 60);
      const q = player.motion.handsParts?.hood?.quat;
      if (q && q[0] < -1e-3) crossed = true; // it swings back past upright
    }
    const later = player.handsOn.state().soft;
    out.crossed = crossed;
    out.moved = later.moved;
    return out;
  });
  expect(r.held).toBeGreaterThan(0.25); // flopped forward
  expect(r.held).toBeLessThan(0.56); // never past the hinge's limit
  expect(r.axisX).toBeGreaterThan(0.999);
  expect(r.offset).toBeLessThan(1e-6);
  expect(r.crossed).toBe(true);
  expect(r.moved).toBe(false); // home again: the tap's own flip works as before
});

test("on its side or upside down, the soft parts hang toward the world's down and Reset still works", async ({
  page,
}) => {
  const out = {};
  for (const [id, grab, to] of [
    ["yo-yo", [0, 0.38, 0], [0.1, 0.3, 0]],
    ["octopus", [0.89, -0.27, 0.37], [1.0, -0.1, 0.5]],
    ["kite", [-0.03, 0.12, 0.1], [-0.2, 0.0, 0.1]],
    ["hoodie", [0, 0.78, 0.05], [0.05, 0.7, 0.3]],
  ]) {
    for (const turn of ["side", "upside-down"]) {
      await open(page, id);
      out[`${id} ${turn}`] = await page.evaluate(
        ({ grab, to, turn }) => {
          const h = window.__hec;
          const { player } = window.__splashery;
          const s = Math.SQRT1_2;
          const q = turn === "side" ? [0, 0, s, s] : [1, 0, 0, 0];
          player.stage.setToyPose({ pivot: player.toyInfo.center, q, t: [0, 0, 0] });
          // Nudge it so the soft parts wake, then let go and watch.
          h.drag(grab, h.line(grab, to, 8));
          const st = h.run(4).soft;
          const finite = st.strands.every((x) => x.nodes.every((p) => p.every(Number.isFinite)));
          // The world's down in the toy's own coordinates.
          const a = player.toRecipe([0, 0, 0]);
          const b = player.toRecipe([0, -1, 0]);
          const down = b.map((v, k) => v - a[k]);
          const L = Math.hypot(...down);
          const first = st.strands[0];
          const d = first.nodes.at(-1).map((v, k) => v - first.nodes[0][k]);
          const along =
            (d[0] * down[0] + d[1] * down[1] + d[2] * down[2]) / (L * Math.hypot(...d) || 1);
          player.handsOn.reset();
          // Right after the glide home (the kite's wind moves it on at once).
          const home = h.run(0.5).soft;
          const back = home.strands.every((x) => x.nodes.every((p, i) => Math.hypot(...p.map((v, k) => v - x.home[i][k])) < 0.02)); // prettier-ignore
          player.stage.setToyPose(null);
          return { finite, along, back };
        },
        { grab, to, turn },
      );
    }
  }
  console.log(`any pose: ${JSON.stringify(out)}`);
  for (const [k, r] of Object.entries(out)) {
    expect(r.finite, k).toBe(true);
    expect(r.back, k).toBe(true);
  }
  // The yo-yo's string hangs toward the world's down however the toy lies.
  expect(out["yo-yo side"].along).toBeGreaterThan(0.95);
  expect(out["yo-yo upside-down"].along).toBeGreaterThan(0.95);
});

test("the soft parts' step time stays small with each demo toy in play", async ({ page }) => {
  const out = {};
  for (const [id, from, to] of [
    ["octopus", [0.8, -0.35, 0.35], [1.1, -0.1, 0.6]],
    ["kite", [-0.03, 0.12, 0.1], [-0.5, -0.4, 0.2]],
    ["hoodie", [0, 0.78, 0.05], [0.05, 0.6, 0.55]],
    ["pizza", [0.27, 0.06, 0.44], [1.1, 0.06, 0.1]],
    ["yo-yo", [0, 0.38, 0], [0, 0.05, 0]],
  ]) {
    await open(page, id);
    out[id] = await page.evaluate(
      ({ from, to }) => {
        const h = window.__hec;
        const ho = window.__splashery.player.handsOn;
        h.drag(from, h.line(from, to, 10), false);
        const t0 = performance.now();
        for (let i = 0; i < 120; i++) ho.step(1 / 60);
        return (performance.now() - t0) / 120;
      },
      { from, to },
    );
  }
  console.log(`hands-on step (ms per frame): ${JSON.stringify(out)}`);
  for (const ms of Object.values(out)) expect(ms).toBeLessThan(2);
});

test("screenshots: the octopus held up, its arms trailing (390x844 and 1440x900)", async ({
  page,
}) => {
  for (const [w, hgt] of [
    [390, 844],
    [1440, 900],
  ]) {
    await page.setViewportSize({ width: w, height: hgt });
    await open(page, "octopus");
    await page.evaluate(() => {
      const h = window.__hec;
      h.drag([0, 0.3, 0], h.line([0, 0.3, 0], [0.5, 0.3, 0.3], 12), false);
    });
    await page.waitForTimeout(400);
    await page.screenshot({ path: `tests/screenshots/hec-octopus-${w}x${hgt}.png` });
  }
});
