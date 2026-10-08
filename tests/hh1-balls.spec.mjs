// Lane Hands-on H1, Balls (docs/handoff/HandsH1.md): every ball in Hands-on
// has its own material (real numbers where tools/hands-on-materials.json
// confirms them), room to roll and its own landing sound; a sample of the
// effects measured, and a sample of balls tried upright, on their side and
// upside down.

import { test, expect } from "@playwright/test";

const APP = "/?renderer=webgl2&adapt=off&profile=mid";

// The bounce each one keeps (its material's), and the confirmed overrides.
const BALLS = {
  "soccer-ball": 0.75, "american-football": 0.55, "tennis-ball": 0.75, baseball: 0.55,
  softball: 0.45, "golf-ball": 0.78, "rugby-ball": 0.5, volleyball: 0.7, "ping-pong-ball": 0.88,
  "cricket-ball": 0.5, "bowling-ball": 0.12, "pool-ball": 0.5, pickleball: 0.62, dodgeball: 0.6,
  "medicine-ball": 0.08, "lacrosse-ball": 0.68, "squash-ball": 0.25, "bouncy-ball": 0.9,
  marble: 0.55, "hockey-puck": 0.2, shuttlecock: 0.2, "flying-disc": 0.25,
}; // prettier-ignore

async function boot(page) {
  await page.goto(APP);
  await page.waitForSelector("body[data-ready='true']", { timeout: 180_000 });
}

// Opens a toy with Hands-on on, its world built.
const OPEN = async (id) => {
  const { app, player } = window.__splashery;
  await app.chooseToy(id);
  player.opts.idleDelay = 1e9;
  player.handsOn.setOn(true);
  player.handsOn.ensure();
};

test("every ball: its own bounce, room to roll and a landing sound", async ({ page }) => {
  test.setTimeout(300_000);
  await boot(page);
  const out = {};
  for (const id of Object.keys(BALLS)) {
    out[id] = await page.evaluate(
      async ({ id, OPEN }) => {
        await eval(OPEN)(id);
        const { player } = window.__splashery;
        const h = player.handsOn;
        const b = h.body;
        const R = h.R();
        const walls = h.world.planes.filter((p) => Math.abs(p.n[1]) < 0.5);
        const room = Math.min(...walls.map((p) => p.n[0] * b.home.pos[0] + p.n[2] * b.home.pos[2] - p.d)) / R; // prettier-ignore
        const cue = player.toyInfo.recipe.hands.sound({ speed: 3, body: b }, 0.5);
        return { e: b.restitution, room, cue: !!cue?.voice, mass: h.extras.mat.mass };
      },
      { id, OPEN: OPEN.toString() },
    );
  }
  console.log(`balls: ${JSON.stringify(out)}`);
  for (const [id, e] of Object.entries(BALLS)) {
    expect(out[id].e, id).toBeCloseTo(e, 2);
    expect(out[id].room, id).toBeCloseTo(3, 2);
    expect(out[id].cue, id).toBe(true);
  }
  // Confirmed masses (hands-on-materials.json): the 16 lb bowling ball, a
  // 140 g dodgeball.
  expect(out["bowling-ball"].mass).toBeCloseTo(6.8, 2);
  expect(out.dodgeball.mass).toBeCloseTo(0.14, 3);
});

test("dropped from 3 toy radii: each bounces as high as its material says", async ({ page }) => {
  test.setTimeout(240_000);
  await boot(page);
  const peak = {};
  for (const id of ["bouncy-ball", "ping-pong-ball", "tennis-ball", "baseball", "medicine-ball"]) {
    peak[id] = await page.evaluate(
      async ({ id, OPEN }) => {
        await eval(OPEN)(id);
        const { player } = window.__splashery;
        const h = player.handsOn;
        const b = h.body;
        const R = h.R();
        b.pos[1] += 3 * R;
        h.moved = true;
        h.world.wake();
        let landed = false;
        let top = -Infinity;
        for (let t = 0; t < 3; t += 1 / 60) {
          player.update(1 / 60);
          if (b.vel[1] > 0) landed = true;
          if (landed) top = Math.max(top, (b.pos[1] - b.home.pos[1]) / R);
          if (landed && b.vel[1] < 0 && top > -Infinity && t > 0.3) break;
        }
        return top;
      },
      { id, OPEN: OPEN.toString() },
    );
  }
  console.log(`first bounce (toy radii): ${JSON.stringify(peak)}`);
  expect(peak["bouncy-ball"]).toBeGreaterThan(peak["ping-pong-ball"] - 0.2);
  expect(peak["ping-pong-ball"]).toBeGreaterThan(peak["tennis-ball"]);
  expect(peak["tennis-ball"]).toBeGreaterThan(peak.baseball);
  expect(peak.baseball).toBeGreaterThan(peak["medicine-ball"]);
  expect(peak["bouncy-ball"]).toBeGreaterThan(1.7); // loses almost no height
  expect(peak["medicine-ball"]).toBeLessThan(0.1); // a thud, barely a bounce
});

test("pushed along the floor: a puck slides on, a marble rolls far, a medicine ball stops", async ({
  page,
}) => {
  test.setTimeout(240_000);
  await boot(page);
  const far = {};
  for (const id of ["hockey-puck", "marble", "medicine-ball"]) {
    far[id] = await page.evaluate(
      async ({ id, OPEN }) => {
        await eval(OPEN)(id);
        const { player } = window.__splashery;
        const h = player.handsOn;
        const b = h.body;
        const R = h.R();
        b.vel = [1.5 * R, 0, 0];
        h.moved = true;
        h.world.wake();
        for (let t = 0; t < 3; t += 1 / 60) player.update(1 / 60);
        return (b.pos[0] - b.home.pos[0]) / R;
      },
      { id, OPEN: OPEN.toString() },
    );
  }
  console.log(`slid or rolled (toy radii): ${JSON.stringify(far)}`);
  expect(far["hockey-puck"]).toBeGreaterThan(1.2);
  expect(far.marble).toBeGreaterThan(1.2);
  expect(far["medicine-ball"]).toBeLessThan(far.marble * 0.6);
});

test("a squash ball gets livelier with each throw", async ({ page }) => {
  await boot(page);
  const e = await page.evaluate(async (OPEN) => {
    await eval(OPEN)("squash-ball");
    const { player } = window.__splashery;
    const h = player.handsOn;
    const b = h.body;
    const out = [b.restitution];
    for (let k = 0; k < 4; k++) {
      const c = player.stage.toScreen(b.pos);
      const hit = [b.pos[0], b.pos[1], b.pos[2] + 0.9 * h.R()];
      h.pressAt(hit, c[0], c[1]);
      for (let i = 1; i <= 10; i++) {
        h.moveTo(c[0] + i * 10, c[1] - i * 8);
        player.update(1 / 60);
      }
      h.release();
      for (let i = 0; i < 90; i++) player.update(1 / 60);
      out.push(b.restitution);
      h.reset();
      for (let i = 0; i < 60; i++) player.update(1 / 60);
    }
    return out;
  }, OPEN.toString());
  console.log(`squash ball bounce by throw: ${JSON.stringify(e)}`);
  for (let k = 1; k < e.length; k++) expect(e[k]).toBeGreaterThan(e[k - 1]);
});

test("upright, on its side and upside down: the football, puck and shuttlecock keep their material and rest", async ({
  page,
}) => {
  test.setTimeout(300_000);
  await boot(page);
  const out = {};
  for (const id of ["american-football", "hockey-puck", "shuttlecock"]) {
    for (const pose of ["up", "side", "down"]) {
      out[`${id}:${pose}`] = await page.evaluate(
        async ({ id, pose, OPEN }) => {
          await eval(OPEN)(id);
          const { posePreset } = await import("/src/effects-pose.js");
          const { player } = window.__splashery;
          const h = player.handsOn;
          const b = h.body;
          const R = h.R();
          const p = posePreset(h, pose);
          b.pos = p.pos;
          b.q = p.q;
          b.pos[1] += 2 * R; // dropped from there
          b.vel = [0.8 * R, 0, 0];
          h.moved = true;
          h.world.wake();
          let rest = null;
          for (let t = 0; t < 5; t += 1 / 60) {
            player.update(1 / 60);
            if (h.world.asleep) {
              rest = t;
              break;
            }
          }
          return { rest, e: b.restitution, low: (b.pos[1] - b.home.pos[1]) / R };
        },
        { id, pose, OPEN: OPEN.toString() },
      );
    }
  }
  console.log(`poses: ${JSON.stringify(out)}`);
  for (const [k, v] of Object.entries(out)) {
    expect(v.rest, k).not.toBeNull(); // comes to rest within 5 s
    expect(v.e, k).toBeCloseTo(BALLS[k.split(":")[0]], 2);
    expect(v.low, k).toBeGreaterThan(-1.2); // on the floor, not through it
  }
});
