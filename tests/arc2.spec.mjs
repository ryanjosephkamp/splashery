// Lane Arcade r2 (docs/handoff/ArcadeR2.md): the owner's walkthrough fixes
// for the Arcade games. The controls sit at the thumbs on a phone, the
// whole-page view can always be left, and Longtail steers by a tap and
// turns by a drag.

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
  await page.evaluate(() => (window.__arc = window.__splashery.player.arcade));
}

const run = (page, secs) =>
  page.evaluate(
    (n) => {
      for (let i = 0; i < n; i++) {
        window.__arc.frame(1 / 60);
        window.__arc.pose(1 / 60);
      }
    },
    Math.round(secs * 60),
  );
const read = (page, fn, arg) => page.evaluate(fn, arg);

test.describe("on a phone", () => {
  test.use({ viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true });

  test("2D/3D and play/pause sit at the bottom by the thumbs; one button plays and pauses", async ({
    page,
  }) => {
    await open(page, "shardball");
    const at = await read(page, () => {
      const v = document.querySelector(".arc-view").getBoundingClientRect();
      const p = document.querySelector(".arc-pause").getBoundingClientRect();
      return { view: v.top / innerHeight, pause: p.top / innerHeight, inPad: !!document.querySelector(".arc-pad .arc-view") }; // prettier-ignore
    });
    expect(at.inPad).toBe(true);
    expect(at.view).toBeGreaterThan(0.5);
    expect(at.pause).toBeGreaterThan(0.5);
    // Launch, not Go.
    expect(await page.textContent(".arc-key.arc-fire")).toBe("Launch");
    const label = () => page.getAttribute(".arc-pause", "aria-label");
    expect(await label()).toBe("Play");
    await page.evaluate(() => (window.__arc.autopilot = true));
    await page.tap(".arc-pause");
    await expect.poll(() => read(page, () => window.__arc.mode)).toBe("play");
    await expect.poll(label).toBe("Pause");
    await page.tap(".arc-pause");
    await expect.poll(() => read(page, () => window.__arc.mode)).toBe("paused");
    await expect.poll(label).toBe("Play");
  });

  test("Grain Garden: the ✕ leaves the whole-page view (its materials no longer cover it)", async ({
    page,
  }) => {
    await open(page, "grain-garden");
    await page.tap(".arc-enter");
    await expect.poll(() => read(page, () => window.__arc.playMode)).toBe(true);
    const hit = await read(page, () => {
      const b = document.querySelector(".arc-exit").getBoundingClientRect();
      return document.elementFromPoint(b.x + b.width / 2, b.y + b.height / 2)?.closest(".arc-exit") != null; // prettier-ignore
    });
    expect(hit).toBe(true);
    await page.tap(".arc-exit");
    await expect.poll(() => read(page, () => window.__arc.playMode)).toBe(false);
    expect(await read(page, () => document.documentElement.classList.contains("arc-play"))).toBe(false); // prettier-ignore
  });
});

// Where the head is on the stage (0..1 across and down), from this frame's camera.
const headOnStage = (page) =>
  read(page, async () => {
    const { orbitPose, viewTangents } = await import("/src/arcade/runtime.js");
    const a = window.__arc;
    const p = orbitPose(a.cam);
    const [tx, ty] = viewTangents(a.aspect(), a.cam.fov);
    const h = a.game.head.pos;
    const d = [0, 1, 2].map((i) => h[i] - p.position[i]);
    const dot = (u, v) => u[0] * v[0] + u[1] * v[1] + u[2] * v[2];
    const z = dot(d, p.forward);
    return { x: (dot(d, p.right) / z / tx + 1) / 2, y: (1 - dot(d, p.up) / z / ty) / 2 };
  });

test("Longtail: a tap above or below the head turns it that way, in 2D and in 3D", async ({
  page,
}) => {
  await open(page, "longtail");
  await page.evaluate(() => {
    window.__splashery.player.frozen = true;
    window.__arc.wake();
  });
  await run(page, 0.1);
  // The head starts heading right (+a on its face); in 2D, up on screen is +b.
  const h = await headOnStage(page);
  const turn = async (x, y) => {
    await page.evaluate(([x, y]) => window.__arc.input.tapAt.push({ x, y }), [x, y]);
    await run(page, 0.4);
    return read(page, () => window.__arc.game.dir);
  };
  expect(await read(page, () => window.__arc.game.dir)).toBe(0);
  expect(await turn(h.x, h.y - 0.08)).toBe(2); // above: up
  const h2 = await headOnStage(page);
  expect(await turn(h2.x + 0.1, h2.y)).toBe(0); // beside, ahead: right again
  // In 3D the same: a tap below the head on screen turns it down on screen.
  await page.evaluate(() => window.__arc.toggleView());
  await run(page, 1.6);
  const h3 = await headOnStage(page);
  const before = await read(page, () => window.__arc.game.dir);
  const after = await turn(h3.x, Math.min(0.95, h3.y + 0.12));
  expect(after).not.toBe(before);
  // The move it took goes down on the screen.
  const h4 = await headOnStage(page);
  expect(h4.y).toBeGreaterThan(h3.y);
});

test("Longtail: in 3D a drag turns the world, and it eases back to following the head", async ({
  page,
}) => {
  await open(page, "longtail");
  await page.evaluate(() => {
    window.__splashery.player.frozen = true;
    window.__arc.wake();
    window.__arc.autopilot = true;
    window.__arc.toggleView();
  });
  await run(page, 1.6);
  const yaw0 = await read(page, () => window.__arc.game.camera(1, 0.5).yaw);
  // A drag a third of the way across, to the right.
  await page.evaluate(() => {
    window.__arc.input.drag = [0.33, 0];
  });
  await run(page, 0.1);
  const turned = await read(page, () => window.__arc.game.userTurn.yaw);
  expect(turned).toBeLessThan(-1);
  const yaw1 = await read(page, () => window.__arc.game.camera(1, 0.5).yaw);
  expect(Math.abs(yaw1 - yaw0)).toBeGreaterThan(0.8);
  // In 3D a drag doesn't steer: the swipe it makes is ignored.
  // Some seconds later the view eases back to following the head.
  await run(page, 7);
  expect(Math.abs(await read(page, () => window.__arc.game.userTurn.yaw))).toBeLessThan(0.1);
});
