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
  // (they burst away from the ball first, then fall)
  await run(page, 1);
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

test("Longtail: the net folds into a cube; a trail across a face edge carries on onto the next face, and a berry makes it longer", async ({
  page,
}) => {
  await open(page, "longtail");
  const r = await read(page, () => {
    const g = window.__arc.game;
    const W = g.world;
    // Folded, every tile sits on the cube's surface (a face at x, y or z = ±0.5).
    let off = 0;
    for (const c of W.cells) {
      const p = W.pos(c.face, c.a, c.b, 1);
      const m = Math.max(...p.map(Math.abs));
      if (Math.abs(m - 0.5) > 1e-6) off++;
    }
    // Walk straight on from the middle of the front face: four faces later
    // the trail is back where it started (a lap around the cube).
    let c = Math.floor(W.N / 2) * W.N + Math.floor(W.N / 2);
    const start = c;
    let dir = 0;
    const faces = new Set();
    for (let k = 0; k < 4 * W.N; k++) {
      const nx = W.cells[c].next[dir];
      c = nx.to;
      dir = nx.dir;
      faces.add(W.cells[c].face);
    }
    // A berry right ahead: eating it adds two beads.
    g.mouths.clear();
    const len0 = g.body.length + g.grow;
    g.berry = W.cells[g.body[0]].next[g.dir].to;
    g.move();
    return {
      off,
      lap: c === start,
      faces: faces.size,
      grew: g.body.length + g.grow - len0,
      score: g.score,
    };
  });
  expect(r.off).toBe(0);
  expect(r.lap).toBe(true);
  expect(r.faces).toBe(4);
  expect(r.grew).toBe(2);
  expect(r.score).toBe(10);
});

test("Grain Garden: sand piles at a slant, water spreads out flat, and fire burns oil", async ({
  page,
}) => {
  await open(page, "grain-garden");
  const r = await read(page, () => {
    const g = window.__arc.game;
    // An empty box, then a column of sand poured in the middle.
    for (let i = 0; i < g.mat.length; i++) if (g.mat[i]) g.kill(i);
    const x0 = g.GX >> 1;
    for (let k = 0; k < 400; k++) {
      g.put(x0, g.GY - 2, 0, 1);
      g.stepCells();
    }
    for (let k = 0; k < 400; k++) g.stepCells();
    const height = (x) => {
      let h = 0;
      for (let y = 0; y < g.GY; y++)
        for (let z = 0; z < g.GZ; z++) if (g.mat[g.idx(x, y, z)] === 1) h = Math.max(h, y + 1);
      return h;
    };
    const mid = height(x0);
    const side = height(x0 + 8);
    // Water poured in one spot spreads out to a thin layer.
    for (let i = 0; i < g.mat.length; i++) if (g.mat[i]) g.kill(i);
    for (let k = 0; k < 300; k++) {
      g.put(4, g.GY - 2, 0, 2);
      g.stepCells();
    }
    for (let k = 0; k < 1500; k++) g.stepCells();
    let top = 0;
    for (let i = 0; i < g.mat.length; i++)
      if (g.mat[i] === 2) top = Math.max(top, ((i / g.GX) | 0) % g.GY);
    // Oil with a spark: it burns away.
    for (let i = 0; i < g.mat.length; i++) if (g.mat[i]) g.kill(i);
    for (let x = 10; x < 20; x++) for (let z = 0; z < g.GZ; z++) g.put(x, 0, z, 3);
    g.put(15, 1, 0, 4);
    for (let k = 0; k < 900; k++) g.stepCells();
    let oil = 0;
    for (let i = 0; i < g.mat.length; i++) if (g.mat[i] === 3) oil++;
    return { mid, side, waterTop: top, oil, total: 10 * g.GZ };
  });
  expect(r.mid).toBeGreaterThan(5);
  expect(r.side).toBeLessThan(r.mid); // a heap, not a column or a flat sheet
  expect(r.waterTop).toBeLessThan(4); // water lies flat, a few grains deep
  expect(r.oil).toBeLessThan(r.total * 0.3);
});

test("Strata: a full layer crumbles into pieces and the stones above drop into its place", async ({
  page,
}) => {
  await open(page, "strata", { well: "slot" });
  const r = await read(page, () => {
    const g = window.__arc.game;
    const S = window.__arc.sprites;
    const model = g.models[0];
    // Fill the bottom layer but one cell, and put a stone above.
    for (let x = 0; x < g.W - 1; x++) {
      const s = S.add(model);
      s.cell = [x, 0, 0];
      g.grid[g.idx(x, 0, 0)] = s;
    }
    const above = S.add(model);
    above.cell = [0, 1, 0];
    g.grid[g.idx(0, 1, 0)] = above;
    // Drop a pebble into the gap.
    g.piece.sprites.forEach((s) => S.remove(s));
    g.piece = { k: 3, cubes: [[0, 0, 0]], x: g.W - 1, y: 5, z: 0, sprites: [S.add(model)] };
    g.hardDrop();
    return { layers: g.layers, shards: g.shards.length, fell: above.cell[1], score: g.score };
  });
  expect(r.layers).toBe(1);
  expect(r.shards).toBe(8); // every stone of the layer breaks
  expect(r.fell).toBe(0); // the stone above dropped a layer
  expect(r.score).toBeGreaterThan(100);
});

test("Stone Belt: a shot splits a big rock into two smaller ones; a small one turns to dust", async ({
  page,
}) => {
  await open(page, "stone-belt");
  const r = await read(page, () => {
    const g = window.__arc.game;
    for (const k of g.rocks) window.__arc.sprites.remove(k.sprite);
    g.rocks = [];
    g.addRock([0.5, 0.5], 0);
    const big = g.rocks[0];
    g.breakRock(big, { p: [0.5, 0.5], v: [1, 0] });
    const sizes = g.rocks.filter((k) => !k.dead).map((k) => k.size);
    const small = {
      p: [0, 0],
      size: 2,
      v: [0, 0],
      sprite: window.__arc.sprites.add(g.models[0][2]),
    };
    g.rocks.push(small);
    const before = g.rocks.filter((k) => !k.dead).length;
    g.breakRock(small, { p: [0, 0], v: [1, 0] });
    return {
      sizes,
      before,
      after: g.rocks.filter((k) => !k.dead).length,
      dust: g.dust.length,
      shapes: g.models.length,
    };
  });
  expect(r.sizes).toEqual([1, 1]);
  expect(r.after).toBe(r.before - 1);
  expect(r.dust).toBe(2);
  expect(r.shapes).toBe(7); // seven real asteroids
});

test("Soft Landing: a slow upright touchdown scores; a fast one breaks the lander apart", async ({
  page,
}) => {
  await open(page, "soft-landing");
  const r = await read(page, () => {
    const g = window.__arc.game;
    const ctl = {
      input: { axis: [0, 0], isHeld: () => false },
      pressed: new Set(),
      view: 0,
      demo: false,
    };
    const pad = g.pads[0];
    const land = (vy) => {
      g.startSite();
      const sh = g.ship;
      const x = (pad.x0 + pad.x1) / 2;
      sh.p = [x, g.groundY(x) + 0.03, 0];
      sh.v = [0, vy, 0];
      sh.a = 0;
      for (let i = 0; i < 60 && sh.state === "fly"; i++) g.step(1 / 120, ctl);
      return { state: sh.state, pieces: !!sh.pieces };
    };
    const soft = land(-0.05);
    const score = g.score;
    const hard = land(-0.6);
    return { pads: g.pads.length, soft, score, hard, site: g.site.name, stretch: g.stretch };
  });
  expect(r.pads).toBeGreaterThan(0);
  expect(r.soft.state).toBe("landed");
  expect(r.score).toBeGreaterThan(0);
  expect(r.hard).toEqual({ state: "crashed", pieces: true });
  expect(r.stretch).toBeGreaterThan(1); // the heights are drawn taller than life, and say so
});

test("Night Owl Pinball: the ball rolls down the slope, and a swinging flipper sends it back up", async ({
  page,
}) => {
  await open(page, "night-owl-pinball");
  const r = await read(page, () => {
    const g = window.__arc.game;
    const still = {
      input: { isHeld: () => false, pointer: null },
      pressed: new Set(),
      view: 0,
      demo: false,
    };
    const b = g.ballBody;
    // On the open table, it rolls toward the player.
    b.pos = [0, 0.028, -0.2];
    b.vel = [0, 0, 0];
    g.inLane = false;
    for (let i = 0; i < 60; i++) g.step(1 / 120, still);
    const rolled = b.pos[2] + 0.2;
    // Resting on the left flipper's paddle, then the flipper swings.
    const f = g.flippers[0];
    b.pos = [f.pivot[0] + 0.1, 0.028, f.pivot[2] - 0.035];
    b.vel = [0, 0, 0.1];
    const hold = { ...still, input: { isHeld: (a) => a === "left", pointer: null } };
    let vz = 0;
    for (let i = 0; i < 30; i++) {
      g.step(1 / 120, hold);
      vz = Math.min(vz, b.vel[2]);
    }
    return { rolled, vz };
  });
  expect(r.rolled).toBeGreaterThan(0.02);
  expect(r.vz).toBeLessThan(-1); // up the table, fast
});

test("Volley Table: a ball past the computer's paddle is your point", async ({ page }) => {
  await open(page, "volley-table");
  const r = await read(page, () => {
    const g = window.__arc.game;
    const ctl = {
      input: { axis: [0, 0], isHeld: () => false, pointer: null },
      pressed: new Set(),
      view: 0,
      demo: false,
    };
    g.them.x = -0.6;
    g.ball.p = [0.5, 0.8];
    g.ball.v = [0, 1.5];
    for (let i = 0; i < 60; i++) g.step(1 / 120, ctl);
    return { you: g.yours, them: g.theirs };
  });
  expect(r).toEqual({ you: 1, them: 0 });
});

test("Note Rider: a note caught in its lane plays and scores; one in another lane is missed", async ({
  page,
}) => {
  await open(page, "note-rider");
  const r = await read(page, () => {
    const g = window.__arc.game;
    const played = [];
    g.api.sound = (s) => played.push(s.f);
    const ctl = {
      input: { axis: [0, 0], isHeld: () => false, pointer: null },
      pressed: [],
      view: 0,
      demo: false,
    };
    const [a, b] = g.notes;
    g.t = a.t - 0.01;
    g.rider.lane = a.lane;
    g.step(1 / 120, ctl);
    g.rider.lane = (b.lane + 1) % 3;
    for (let i = 0; i < 240 && !b.gone && !b.got; i++) g.step(1 / 120, ctl);
    return {
      first: a.got,
      second: b.got,
      caught: g.caught,
      played: played.length,
      score: g.score > 0,
    };
  });
  expect(r).toEqual({ first: true, second: false, caught: 1, played: 1, score: true });
});
