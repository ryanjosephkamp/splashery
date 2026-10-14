// Lane Arcade's engine PR (docs/handoff/Arcade.md): the game kit in
// src/arcade/. A small stand-in game is attached to a kit toy in the real
// app, and each part of the kit is checked: its splats show where the game
// puts them, the fixed-step clock, pause (and the pause when the tab is
// hidden), keys going to the game, the on-screen pad, play mode, the 2D/3D
// switch's smooth blend, the best score kept on the device, a sprite that
// shatters into pieces that fall and come to rest, and that the toy goes
// back to plain when the game leaves.

import { test, expect } from "@playwright/test";

const APP = "/?renderer=webgl2&adapt=off&watch=off";

async function open(page) {
  await page.goto(APP);
  await page.waitForSelector("body[data-ready='true']", { timeout: 120_000 });
  await page.evaluate(() => window.__splashery.app.chooseToy("heart"));
  // The stand-in game: a ball that moves right while "right" is held, a
  // box that breaks on "fire", a score that grows by one each step.
  await page.evaluate(async () => {
    const { ArcadeRuntime } = await import("/src/arcade/runtime.js");
    const { player } = window.__splashery;
    const recipe = {
      action: { key: "go" },
      arcade: {
        title: "Test game",
        stats: [{ key: "score", label: "Score" }],
        best: "score",
        views: true,
        pad: ["left", "right", "fire"],
        create(api) {
          const ball = api.kitModel((k) => k.add(k.sphere(0.1), { even: true, color: "#ff3300" }), { count: 200 }); // prettier-ignore
          const box = api.kitModel((k) => k.add(k.box(0.3, 0.2, 0.2), { even: true, color: "#3366ff" }), { count: 400 }); // prettier-ignore
          return {
            steps: 0,
            reset() {
              api.sprites.clear();
              this.x = 0;
              this.score = 0;
              this.over = false;
              this.ball = api.sprites.add(ball);
              this.box = api.sprites.add(box, { pos: [0, 0.5, 0] });
              this.broken = false;
            },
            step(dt, ctl) {
              this.steps++;
              if (ctl.demo) return;
              this.score++;
              if (ctl.input.isHeld("right")) this.x += dt;
              if (ctl.pressed.has("fire") && !this.broken) {
                api.sprites.shatter(this.box, 6, { rand: api.rand, kick: 0.5, life: 1.5 });
                this.broken = true;
              }
              if (this.broken) this.pieces = api.stepPieces(this.box, dt, { gravity: 3, floor: -0.5, bounce: 0.3 }); // prettier-ignore
              if (this.score >= 1e9) this.over = true;
            },
            render(view) {
              this.ball.pos = [this.x, view, 0];
            },
            camera(view) {
              return { target: [0, 0, 0], yaw: 0, pitch: view * 0.5, distance: 3 };
            },
            stats() {
              return { score: this.score };
            },
            status() {
              return { over: this.over };
            },
          };
        },
      },
    };
    player.arcade?.destroy();
    player.arcade = new ArcadeRuntime(player, recipe, {}, player.proc.ctx);
    await player.arcade.ready;
    window.__arc = player.arcade;
    // The software renderer draws slowly, so the tests give the game its
    // frames by hand (the player's own frames then pass no time).
    player.frozen = true;
  });
}

const read = (page, fn) => page.evaluate(fn);
// Runs the game for `secs` at 60 frames a second.
const run = (page, secs) =>
  page.evaluate(
    (n) => {
      for (let i = 0; i < n; i++) window.__arc.frame(1 / 60);
    },
    Math.round(secs * 60),
  );

test("the kit draws the game's sprites where it puts them", async ({ page }) => {
  await open(page);
  const st = await read(page, () => {
    const a = window.__arc;
    const s = a.game.ball;
    const c = a.layer.center;
    let x = 0;
    for (let i = s.start; i < s.start + s.n; i++) x += c[i * 4];
    return { n: s.n, used: a.sprites.used, mean: x / s.n, hud: !!document.querySelector(".arc-root .arc-stats") }; // prettier-ignore
  });
  expect(st.n).toBeGreaterThan(100);
  expect(st.used).toBeGreaterThan(st.n);
  expect(Math.abs(st.mean)).toBeLessThan(0.02);
  expect(st.hud).toBe(true);
  // The splats show: the ball's red is on the canvas.
  const red = await page.evaluate(async () => {
    const { player } = window.__splashery;
    const c = await player.stage.captureFrame(200, 200);
    const d = c.getContext("2d").getImageData(0, 0, 200, 200).data;
    let n = 0;
    for (let i = 0; i < d.length; i += 4)
      if (d[i] > 180 && d[i + 1] < 120 && d[i + 2] < 90 && d[i + 3] > 200) n++;
    return n;
  });
  expect(red).toBeGreaterThan(20);
});

test("a tap starts it; the clock steps 120 times a second; P pauses; a hidden tab pauses", async ({
  page,
}) => {
  await open(page);
  expect(await read(page, () => window.__arc.mode)).toBe("attract");
  const box = await page.locator(".arc-surface").boundingBox();
  await page.mouse.click(box.x + box.width / 2, box.y + box.height / 2);
  expect(await read(page, () => window.__arc.mode)).toBe("play");
  const s0 = await read(page, () => window.__arc.game.score);
  await run(page, 1.5);
  // Fixed steps: two a frame at 60 frames a second.
  expect(await read(page, () => window.__arc.game.score)).toBe(s0 + 180);
  // A slow frame (half a second) runs at most ten steps: the game slows
  // rather than jumping.
  await page.evaluate(() => window.__arc.frame(0.5));
  expect(await read(page, () => window.__arc.game.score)).toBe(s0 + 190);
  await page.keyboard.press("KeyP");
  expect(await read(page, () => window.__arc.mode)).toBe("paused");
  const p0 = await read(page, () => window.__arc.game.score);
  await run(page, 0.4);
  expect(await read(page, () => window.__arc.game.score)).toBe(p0);
  await page.keyboard.press("Space");
  expect(await read(page, () => window.__arc.mode)).toBe("play");
  await page.evaluate(() => {
    Object.defineProperty(document, "hidden", { value: true, configurable: true });
    document.dispatchEvent(new Event("visibilitychange"));
  });
  expect(await read(page, () => window.__arc.mode)).toBe("paused");
});

test("keys, the on-screen pad and a controller's buttons reach the game", async ({ page }) => {
  await open(page);
  await page.keyboard.press("Space"); // not active yet: the app keeps it
  expect(await read(page, () => window.__arc.mode)).toBe("attract");
  await page.evaluate(() => window.__arc.wake());
  await page.keyboard.down("ArrowRight");
  await run(page, 0.6);
  await page.keyboard.up("ArrowRight");
  const x = await read(page, () => window.__arc.game.x);
  expect(x).toBeGreaterThan(0.3);
  // The pad (shown on touch screens): its "right" button holds right.
  await page.evaluate(() => window.__arc.input.pad("right", true));
  await run(page, 0.3);
  await page.evaluate(() => window.__arc.input.pad("right", false));
  expect(await read(page, () => window.__arc.game.x)).toBeGreaterThan(x + 0.15);
  // A game controller: button 0 is fire (the box breaks).
  await page.evaluate(() => {
    const pad = { connected: true, axes: [0, 0], buttons: Array.from({ length: 16 }, (_, i) => ({ pressed: i === 0 })) }; // prettier-ignore
    navigator.getGamepads = () => [pad];
  });
  await run(page, 0.1);
  expect(await read(page, () => window.__arc.game.broken)).toBe(true);
});

test("play mode fills the page, and Esc leaves it", async ({ page }) => {
  await open(page);
  await page.click(".arc-enter");
  await page.waitForTimeout(300);
  const on = await read(page, () => {
    const r = document.getElementById("stage").getBoundingClientRect();
    return { cls: document.documentElement.classList.contains("arc-play"), w: r.width, h: r.height, play: window.__arc.playMode, panel: getComputedStyle(document.querySelector(".brand")).visibility }; // prettier-ignore
  });
  const vp = page.viewportSize();
  expect(on.cls).toBe(true);
  expect(on.play).toBe(true);
  expect(on.w).toBeGreaterThanOrEqual(vp.width - 1);
  expect(on.h).toBeGreaterThanOrEqual(vp.height - 1);
  expect(on.panel).toBe("hidden");
  await page.keyboard.press("Escape");
  await page.waitForTimeout(300);
  const off = await read(page, () => ({ cls: document.documentElement.classList.contains("arc-play"), play: window.__arc.playMode, mode: window.__arc.mode })); // prettier-ignore
  expect(off.cls).toBe(false);
  expect(off.play).toBe(false);
  expect(off.mode).toBe("paused");
});

test("the 2D/3D switch slides smoothly, and the game keeps running through it", async ({
  page,
}) => {
  await open(page);
  await page.evaluate(() => window.__arc.wake());
  const s0 = await read(page, () => window.__arc.game.score);
  await page.click(".arc-view");
  const seen = [];
  for (let i = 0; i < 14; i++) {
    await run(page, 0.1);
    seen.push(await read(page, () => window.__arc.view));
  }
  await page.evaluate(() => {
    for (let i = 0; i < 60; i++) window.__arc.pose(1 / 60);
  });
  // Steps of the blend between 0 and 1, never a jump.
  const mids = seen.filter((v) => v > 0.05 && v < 0.95);
  expect(mids.length).toBeGreaterThan(2);
  expect(seen.at(-1)).toBe(1);
  for (let i = 1; i < seen.length; i++) expect(seen[i]).toBeGreaterThanOrEqual(seen[i - 1]);
  expect(await read(page, () => window.__arc.game.score)).toBeGreaterThan(s0 + 60);
  expect(await page.textContent(".arc-view")).toBe("2D");
  // The camera follows the game's wish for the 3D view.
  const pitch = await read(page, () => window.__arc.cam.pitch);
  expect(pitch).toBeGreaterThan(0.4);
});

test("a sprite shatters into pieces that fall, rest and fade; the best score stays on the device", async ({
  page,
}) => {
  await open(page);
  await page.evaluate(() => window.__arc.wake());
  await page.keyboard.press("Space");
  await run(page, 0.1);
  const st = await read(page, () => {
    const b = window.__arc.game.box;
    return { pieces: b.pieces?.length, y: b.pieces?.map((p) => p.pos[1]) };
  });
  expect(st.pieces).toBeGreaterThanOrEqual(4);
  await run(page, 1.3);
  const later = await read(page, () => window.__arc.game.box.pieces.map((p) => ({ y: p.pos[1], fade: p.fade }))); // prettier-ignore
  // They fell onto the floor (y = -0.5) and stopped there.
  for (const p of later) expect(p.y).toBeLessThan(0.2);
  for (const p of later) expect(p.y).toBeGreaterThanOrEqual(-0.5);
  await run(page, 0.8);
  expect(await read(page, () => window.__arc.game.pieces)).toBe(false);
  // Game over keeps the best score.
  await page.evaluate(() => (window.__arc.game.over = true));
  await run(page, 0.1);
  const best = await read(page, () => ({ mode: window.__arc.mode, best: window.__arc.best, saved: Number(localStorage.getItem(window.__arc.bestKey)) })); // prettier-ignore
  expect(best.mode).toBe("over");
  expect(best.best).toBeGreaterThan(100);
  expect(best.saved).toBe(best.best);
});

test("leaving the game puts the toy back as it was", async ({ page }) => {
  await open(page);
  await page.evaluate(() => window.__splashery.app.chooseToy("campfire"));
  await page.waitForTimeout(300);
  const st = await read(page, () => ({
    arcade: !!window.__splashery.player.arcade,
    hud: !!document.querySelector(".arc-root"),
    canvas: document.getElementById("stage").classList.contains("arc-canvas"),
    fov: window.__splashery.player.stage.cameraEntity.camera.fov,
  }));
  expect(st).toEqual({ arcade: false, hud: false, canvas: false, fov: 38 });
});
