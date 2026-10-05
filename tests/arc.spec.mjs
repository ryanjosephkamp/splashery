// Lane Arcade's games (docs/handoff/Arcade.md). Each game is played in the
// real app with its clock stepped by hand (the software renderer draws
// slowly), and its rules are checked: what moves, what breaks, what counts.

import { test, expect } from "@playwright/test";

const APP = "/?renderer=webgl2&adapt=off&watch=off&labs=1&profile=low";

async function open(page, toy, options = {}) {
  await page.goto(APP);
  await page.waitForSelector("body[data-ready='true']", { timeout: 120_000 });
  await page.evaluate(
    async ([toy, options]) => {
      const { app } = window.__splashery;
      await app.chooseToy(toy);
      for (const [k, v] of Object.entries(options)) await app.setToyOption(k, v);
    },
    [toy, options],
  );
  await page.waitForFunction(() => !!window.__splashery.player.arcade?.game, null, { timeout: 60_000 }); // prettier-ignore
  await page.evaluate(() => {
    window.__arc = window.__splashery.player.arcade;
    window.__splashery.player.frozen = true; // the tests give the frames
  });
}

const run = (page, secs) =>
  page.evaluate(
    (n) => {
      for (let i = 0; i < n; i++) window.__arc.frame(1 / 60);
    },
    Math.round(secs * 60),
  );
const read = (page, fn, arg) => page.evaluate(fn, arg);

test("Shardball: the ball bounces off the paddle, and a broken brick shatters into pieces that fall", async ({
  page,
}) => {
  await open(page, "shardball");
  const s0 = await read(page, () => ({
    bricks: window.__arc.game.bricks.filter((b) => b.alive).length,
    lives: window.__arc.game.lives,
    mode: window.__arc.mode,
  }));
  expect(s0.mode).toBe("attract");
  expect(s0.bricks).toBe(60);
  // Start, launch, and let the autopilot keep the ball in play.
  await page.evaluate(() => {
    window.__arc.wake();
    window.__arc.autopilot = true;
    window.__arc.input.edges.push("fire");
  });
  let shards = null;
  for (let i = 0; i < 40 && !shards; i++) {
    await run(page, 0.25);
    shards = await read(page, () => {
      const sh = window.__arc.game.shards[0];
      return sh ? sh.sprite.pieces.map((p) => ({ y: p.pos[1], vy: p.vel[1], n: p.n })) : null;
    });
  }
  expect(shards, "a brick broke within 10 s").not.toBeNull();
  expect(shards.length).toBeGreaterThanOrEqual(5);
  // Every piece is a solid chunk (many splats), and they fall.
  for (const p of shards) expect(p.n).toBeGreaterThan(8);
  const y0 = shards.map((p) => p.y);
  await run(page, 0.4);
  const y1 = await read(page, () =>
    window.__arc.game.shards[0]?.sprite.pieces.map((p) => p.pos[1]),
  );
  const fell = y1.filter((y, i) => y < y0[i] - 0.05).length;
  expect(fell).toBeGreaterThan(y1.length / 2);
  const s1 = await read(page, () => ({ score: window.__arc.game.score, lives: window.__arc.game.lives })); // prettier-ignore
  expect(s1.score).toBeGreaterThan(0);
});

test("Shardball: the paddle sets the bounce angle; a stone brick takes two hits", async ({
  page,
}) => {
  await open(page, "shardball", { level: 2 });
  const r = await read(page, () => {
    const g = window.__arc.game;
    window.__arc.wake();
    // A ball falling straight down onto the paddle's right end goes up and right.
    g.ball.stuck = false;
    g.ball.p = [g.paddle.x + 0.12, -0.7, 0];
    g.ball.v = [0, -1.2, 0];
    for (let i = 0; i < 40; i++) g.step(1 / 120, { input: window.__arc.input.frame(), pressed: new Set(), view: 0, demo: false }); // prettier-ignore
    const right = g.ball.v.slice();
    const stone = g.bricks.find((b) => b.kind === "stone");
    g.hitBrick(stone, [stone.x, stone.y, 0]);
    const after1 = stone.alive;
    g.hitBrick(stone, [stone.x, stone.y, 0]);
    return { right, after1, after2: stone.alive };
  });
  expect(r.right[1]).toBeGreaterThan(0);
  expect(r.right[0]).toBeGreaterThan(0.3);
  expect(r.after1).toBe(true);
  expect(r.after2).toBe(false);
});

test("Shardball's dome: in 3D the bricks spread over a dome above the dish, and the ball moves in three dimensions", async ({
  page,
}) => {
  await open(page, "shardball", { style: "dome" });
  await page.evaluate(() => {
    window.__arc.wake();
    window.__arc.autopilot = true;
    window.__arc.toggleView();
  });
  await run(page, 1.3);
  const st = await read(page, () => {
    const g = window.__arc.game;
    const pos = g.bricks.filter((b) => b.alive).map((b) => b.sprite.pos);
    const r = pos.map((p) => Math.hypot(...p));
    return { view: window.__arc.view, rMin: Math.min(...r), rMax: Math.max(...r), yMin: Math.min(...pos.map((p) => p[1])), dish: g.dish.sprite.pos, mode3d: g.mode3d }; // prettier-ignore
  });
  expect(st.view).toBe(1);
  expect(st.mode3d).toBe(true);
  // On the sphere (radius 1), at or above its middle.
  expect(st.rMin).toBeGreaterThan(0.9);
  expect(st.rMax).toBeLessThan(1.01);
  expect(st.yMin).toBeGreaterThan(-0.05);
  expect(st.dish[1]).toBeLessThan(-0.7);
  await page.evaluate(() => window.__arc.input.edges.push("fire"));
  const zs = [];
  for (let i = 0; i < 12; i++) {
    await run(page, 0.2);
    zs.push(await read(page, () => window.__arc.game.ball.p.slice()));
  }
  const spread = (k) => Math.max(...zs.map((p) => p[k])) - Math.min(...zs.map((p) => p[k]));
  expect(spread(1)).toBeGreaterThan(0.3); // up and down
  expect(spread(0) + spread(2)).toBeGreaterThan(0.05); // and across, in depth too
});

test("Shardball embeds with its settings, and keys play it once it is clicked", async ({
  page,
}) => {
  await open(page, "shardball", { style: "dome", view: "3d", level: 3 });
  const hash = await page.evaluate(async () => {
    const { encodeSceneHash } = await import("/src/codec.js");
    return encodeSceneHash(window.__splashery.player.scene);
  });
  await page.goto(`/embed/?renderer=webgl2&profile=low#s=${hash}`);
  await page.waitForSelector("body[data-ready='true']", { timeout: 120_000 });
  await page.waitForFunction(() => !!window.__splashery.player.arcade?.game, null, { timeout: 60_000 }); // prettier-ignore
  const st = await read(page, () => {
    const a = window.__splashery.player.arcade;
    return { level: a.game.level, style: a.game.style, view: a.viewTo, hud: !!document.querySelector(".arc-root .arc-view") }; // prettier-ignore
  });
  expect(st).toEqual({ level: 3, style: "dome", view: 1, hud: true });
  const box = await page.locator(".arc-surface").boundingBox();
  await page.mouse.click(box.x + box.width / 2, box.y + box.height / 2);
  expect(await read(page, () => window.__splashery.player.arcade.mode)).toBe("play");
  await page.keyboard.press("KeyP");
  expect(await read(page, () => window.__splashery.player.arcade.mode)).toBe("paused");
});
