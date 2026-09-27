// Lane F's own checks (docs/OPERATING.md): touch and drag play, through
// real pointer input (the mouse): swipe the puzzle cube, drag a Newton's
// cradle ball, tap chess pieces to move them and tap the bricks to build.
// A drag beside a toy still turns the view.

import { test, expect } from "@playwright/test";
import fs from "node:fs";
import path from "node:path";

const SHOTS = "tests/screenshots";

const WEBGL = "/?renderer=webgl2&profile=weak";

async function loadApp(page, url = WEBGL) {
  await page.goto(url);
  await page.waitForSelector("body[data-ready='true']", { timeout: 180_000 });
}

async function openToy(page, category, id, label) {
  await page.click(`.chip[data-category='${category}']`);
  await page.click(`.toy-card[data-toy='${id}']`);
  await expect(page.locator("#toy-status")).toHaveText(new RegExp(`^${label}`), {
    timeout: 180_000,
  });
  await page.waitForTimeout(1500);
}

// Where a recipe point shows on the page.
async function screenAt(page, p) {
  const box = await page.locator("#stage").boundingBox();
  const [x, y] = await page.evaluate((p) => window.__splashery.player.screenPoint(p), p);
  return [box.x + x, box.y + y];
}

// A mouse drag between two recipe points, in steps, as a finger would.
async function drag(page, a, b, steps = 10) {
  const [x0, y0] = await screenAt(page, a);
  const [x1, y1] = await screenAt(page, b);
  await page.mouse.move(x0, y0);
  await page.mouse.down();
  // (The press waits for the pick to say what is under it.)
  await page.waitForTimeout(400);
  for (let i = 1; i <= steps; i++)
    await page.mouse.move(x0 + ((x1 - x0) * i) / steps, y0 + ((y1 - y0) * i) / steps);
  await page.waitForTimeout(300);
  await page.mouse.up();
}

// A tap on the toy at a recipe point; waits until the toy has taken it (a
// tap waits for the pick, which is slow in SwiftShader).
async function tapAt(page, p) {
  const count = () => page.evaluate(() => window.__splashery.player.motion.tap?.n ?? 0);
  const n = await count();
  const [x, y] = await screenAt(page, p);
  await page.mouse.click(x, y);
  await expect.poll(count, { timeout: 20_000 }).toBeGreaterThan(n);
}

// The toy's clock: waits for `secs` of it (SwiftShader draws few frames).
async function waitClock(page, secs) {
  const t0 = await page.evaluate(() => window.__splashery.player.time);
  await expect
    .poll(() => page.evaluate(() => window.__splashery.player.time), { timeout: 60_000 })
    .toBeGreaterThan(t0 + secs);
}

const yaw = (page) => page.evaluate(() => window.__splashery.player.camera.tgt.yaw);

test.describe("Touch and drag (WebGL2)", () => {
  test.use({ viewport: { width: 1000, height: 760 } });

  test("the puzzle cube turns a layer under a swipe, scrambles and solves", async ({ page }) => {
    await loadApp(page);
    await page.evaluate(() => window.__splashery.player.camera.setTurntable(false));
    await openToy(page, "toys", "puzzle-cube", "Puzzle cube");
    const action = page.locator("#toy-action");
    await expect(action).toHaveText("Scramble or solve");
    const solved = () =>
      page.evaluate(() => window.__splashery.player.toyInfo.recipe.cube.solved());
    expect(await solved()).toBe(true);
    // Cubies are pieces: 26 of them.
    expect(await page.evaluate(() => window.__splashery.player.motion.out.tokens.length)).toBe(26); // prettier-ignore
    const yaw0 = await yaw(page);
    // A swipe across the top face turns the front layer a quarter turn:
    // the cube is no longer solved, and the view did not turn.
    await drag(page, [-0.6, 1.5, 1], [1.8, 1.5, 1]);
    await expect.poll(solved, { timeout: 30_000 }).toBe(false);
    expect(await yaw(page)).toBeCloseTo(yaw0, 3);
    await waitClock(page, 0.5);
    // Every cubie of the front layer turned a quarter turn about z; the
    // rest stayed.
    const turned = await page.evaluate(() =>
      window.__splashery.player.motion.out.tokens.map((t) => Math.abs(t.quat[2]) > 0.6),
    );
    expect(turned.filter(Boolean).length).toBe(9);
    // Swiping it back solves it.
    await drag(page, [1.4, 1.5, 1], [-1.0, 1.5, 1]);
    await expect.poll(solved, { timeout: 30_000 }).toBe(true);
    // A drag beside the cube turns the view.
    const box = await page.locator("#stage").boundingBox();
    await page.mouse.move(box.x + 60, box.y + box.height - 60);
    await page.mouse.down();
    for (let i = 1; i <= 8; i++)
      await page.mouse.move(box.x + 60 + i * 25, box.y + box.height - 60);
    await page.mouse.up();
    expect(Math.abs((await yaw(page)) - yaw0)).toBeGreaterThan(0.05);
    // The Scramble button scrambles; pressed again it solves.
    await action.click();
    await waitClock(page, 4.5);
    expect(await solved()).toBe(false);
    await action.click();
    await waitClock(page, 4.5);
    expect(await solved()).toBe(true);
  });

  test("a Newton's cradle ball dragged out and let go swings the far ball out", async ({
    page,
  }) => {
    await loadApp(page);
    await page.evaluate(() => window.__splashery.player.camera.setTurntable(false));
    await openToy(page, "toys", "newtons-cradle", "Newton's cradle");
    const yaw0 = await yaw(page);
    const angles = () =>
      page.evaluate(() => [0, 1, 2, 3, 4].map((i) => window.__splashery.player.motion.out.parts["ball" + i]?.angle ?? 0)); // prettier-ignore
    // Pull the two left balls out to the left and hold them there.
    const [x0, y0] = await screenAt(page, [-0.3, 0.2, 0.15]);
    const [x1, y1] = await screenAt(page, [-0.75, 0.42, 0.15]);
    await page.mouse.move(x0, y0);
    await page.mouse.down();
    await page.waitForTimeout(400);
    for (let i = 1; i <= 10; i++) await page.mouse.move(x0 + ((x1 - x0) * i) / 10, y0 + ((y1 - y0) * i) / 10); // prettier-ignore
    await page.waitForTimeout(400);
    const held = await angles();
    expect(held[0]).toBeLessThan(-0.3);
    expect(held[1]).toBeCloseTo(held[0], 5);
    expect(held[2]).toBe(0);
    // Let go: two balls fly out on the right.
    await page.mouse.up();
    let most = [0, 0, 0, 0, 0];
    for (let i = 0; i < 40; i++) {
      const a = await angles();
      most = most.map((m, k) => Math.max(m, a[k]));
      if (most[3] > 0.2 && most[4] > 0.2) break;
      await page.waitForTimeout(100);
    }
    expect(most[4]).toBeGreaterThan(0.2);
    expect(most[3]).toBeGreaterThan(0.2);
    expect(await yaw(page)).toBeCloseTo(yaw0, 3);
    // A tap still lifts the end ball and lets it go.
    await page.locator("#toy-action").click();
    await expect.poll(async () => (await angles())[0], { timeout: 30_000 }).toBeLessThan(-0.2);
  });

  test("chess: tap a piece and a square to move; the Opera Game still plays", async ({ page }) => {
    await loadApp(page);
    await page.evaluate(() => window.__splashery.player.camera.setTurntable(false));
    await openToy(page, "toys", "chess-set", "Chess set");
    const S = 0.2;
    const sq = (s) => ["abcdefgh".indexOf(s[0]), Number(s[1]) - 1];
    const at = (s) => [(sq(s)[0] - 3.5) * S, 0.03, (3.5 - sq(s)[1]) * S];
    const state = () => page.evaluate(() => window.__splashery.player.toyInfo.recipe.game.state());
    // A black piece cannot move first; a white pawn can go two squares.
    await tapAt(page, at("e7"));
    await tapAt(page, at("e5"));
    await waitClock(page, 1);
    expect((await state()).n).toBe(17 * 2 - 1);
    // A square the picked pawn cannot reach puts it down again.
    await tapAt(page, at("e2"));
    await tapAt(page, at("e5"));
    await waitClock(page, 0.5);
    expect((await state()).n).toBe(33);
    await tapAt(page, at("e2"));
    await tapAt(page, at("e4"));
    await expect.poll(async () => (await state()).played, { timeout: 30_000 }).toBe(1);
    expect((await state()).n).toBe(1);
    await expect(page.locator("#game-bar-title")).toContainText("Your game, from the Opera Game");
    await expect(page.locator("#game-bar-move")).toContainText("Move 1 of 1");
    // Black answers, then the game bar steps back through your moves.
    await tapAt(page, at("e7"));
    await tapAt(page, at("e5"));
    await expect.poll(async () => (await state()).played, { timeout: 30_000 }).toBe(2);
    await page.click("#game-back");
    await expect.poll(async () => (await state()).played, { timeout: 30_000 }).toBe(1);
    // Back to the Opera Game, which plays from its own button.
    await page.click("#game-reset");
    await expect(page.locator("#toy-action")).toHaveText("Play the Opera Game");
    await page.click("#toy-action");
    await expect.poll(async () => (await state()).played, { timeout: 60_000 }).toBeGreaterThan(1);
    expect((await state()).n).toBe(33);
  });

  test("each tap on the bricks builds a model, brick by brick", async ({ page }) => {
    await loadApp(page);
    await page.evaluate(() => window.__splashery.player.camera.setTurntable(false));
    await openToy(page, "toys", "bricks", "Building bricks");
    const placed = () =>
      page.evaluate(() => window.__splashery.player.motion.out.tokens.filter((t) => Math.hypot(...t.offset) > 0.5).length); // prettier-ignore
    expect(await placed()).toBe(0);
    const box = await page.locator("#stage").boundingBox();
    await page.mouse.click(box.x + box.width / 2, box.y + box.height / 2);
    // Part way through, some bricks are in and some are not yet.
    await waitClock(page, 2.5);
    const some = await placed();
    await waitClock(page, 3);
    const all = await placed();
    expect(all).toBeGreaterThanOrEqual(7);
    expect(some).toBeLessThan(all);
    // Every brick of the model sits on the table or on another brick.
    const heights = await page.evaluate(() =>
      window.__splashery.player.motion.out.tokens.map((t) => t.base[1] + t.offset[1]),
    );
    for (const h of heights) expect(Math.abs(h / 1.2 - 0.5 - Math.round(h / 1.2 - 0.5))).toBeLessThan(1e-6); // prettier-ignore
  });

  test("tokens can be sorted again where they stand", async ({ page }) => {
    await loadApp(page);
    await page.evaluate(() => window.__splashery.player.camera.setTurntable(false));
    await openToy(page, "toys", "chess-set", "Chess set");
    const r = await page.evaluate(() => {
      const { player } = window.__splashery;
      const { buf } = player.proc.ctx;
      const container = player.proc.container;
      const kinds = buf.anim;
      // A splat of token 0 and one that is not a token.
      let tok = -1;
      let other = -1;
      for (let i = 0; i < buf.count; i++) {
        const token = Math.round(kinds[i * 4 + 1]) === 14;
        if (token && Math.round(kinds[i * 4 + 2]) === 0 && tok < 0) tok = i;
        if (!token && other < 0) other = i;
      }
      const version = container.centersVersion;
      // Token 0 moved one unit along x and turned half a turn about y.
      const td = player.motion.tokenData;
      td.set([1, 0, 0, 1, 0, 1, 0, 0], 0);
      const n = player.resortTokens();
      const c = container.centers;
      const p = buf.pos;
      return {
        n,
        bumped: container.centersVersion > version,
        tok: [c[tok * 3] - (1 - p[tok * 3]), c[tok * 3 + 1] - p[tok * 3 + 1], c[tok * 3 + 2] + p[tok * 3 + 2]], // prettier-ignore
        other: [0, 1, 2].map((k) => c[other * 3 + k] - p[other * 3 + k]),
        resort: player.motion.out.resort,
      };
    });
    expect(r.n).toBeGreaterThan(1000);
    expect(r.bumped).toBe(true);
    // (x, y, z) -> (1 - x, y, -z): each difference is 0.
    for (const d of r.tok) expect(Math.abs(d)).toBeLessThan(1e-4);
    for (const d of r.other) expect(d).toBe(0);
    // Recipes ask for it with out.resort; it is off unless a recipe sets it.
    expect(r.resort).toBe(false);
  });

  test("the game panel follows a game that changes on the board", async ({ page }) => {
    await loadApp(page);
    await openToy(page, "toys", "chess-set", "Chess set");
    await expect(page.locator("#game-reset")).toBeHidden();
    // Not through the panel: straight through the toy's game.
    await page.evaluate(() =>
      window.__splashery.player.toyInfo.recipe.game.load('[White "A"]\n[Black "B"]\n\n1. e4 e5 *'),
    );
    await expect(page.locator("#toy-game .game-title")).toContainText("On the board: A v B");
    await expect(page.locator("#game-reset")).toBeVisible();
    await page.click("#game-reset");
    await expect(page.locator("#toy-game .game-title")).toContainText("Opera Game");
    await expect(page.locator("#game-reset")).toBeHidden();
  });

  test("a finger swipe turns the cube on a phone", async ({ browser }) => {
    const phone = await browser.newContext({
      viewport: { width: 390, height: 844 },
      hasTouch: true,
      isMobile: true,
    });
    const page = await phone.newPage();
    await loadApp(page);
    await page.evaluate(() => window.__splashery.player.camera.setTurntable(false));
    await page.evaluate(() => window.__splashery.app.chooseToy("puzzle-cube"));
    await expect(page.locator("#toy-status")).toHaveText(/^Puzzle cube/, { timeout: 180_000 });
    await page.waitForTimeout(1500);
    const solved = () =>
      page.evaluate(() => window.__splashery.player.toyInfo.recipe.cube.solved());
    const yaw0 = await yaw(page);
    // A touch swipe across the top face, through real touch events.
    const cdp = await phone.newCDPSession(page);
    const [x0, y0] = await screenAt(page, [-0.6, 1.5, 1]);
    const [x1, y1] = await screenAt(page, [1.8, 1.5, 1]);
    const touch = (type, x, y) =>
      cdp.send("Input.dispatchTouchEvent", { type, touchPoints: type === "touchEnd" ? [] : [{ x, y }] }); // prettier-ignore
    await touch("touchStart", x0, y0);
    await page.waitForTimeout(400);
    for (let i = 1; i <= 10; i++) await touch("touchMove", x0 + ((x1 - x0) * i) / 10, y0 + ((y1 - y0) * i) / 10); // prettier-ignore
    await page.waitForTimeout(300);
    await touch("touchEnd");
    await expect.poll(solved, { timeout: 30_000 }).toBe(false);
    expect(await yaw(page)).toBeCloseTo(yaw0, 3);
    await phone.close();
  });

  test("lane F screenshots at 1440x900 and 390x844", async ({ browser }) => {
    fs.mkdirSync(SHOTS, { recursive: true });
    // Each toy mid-play: the cube scrambled, the cradle let go, a chess
    // piece picked up, the bricks built.
    const play = {
      "puzzle-cube": async (page) => {
        await page.evaluate(() => window.__splashery.player.act());
        await waitClock(page, 4.3);
      },
      "newtons-cradle": async (page) => {
        await page.evaluate(() => {
          const p = window.__splashery.player;
          const d = p.toyInfo.recipe.drag;
          d.start([0.3, 0.2, 0.15]);
          d.move([0.8, 0.45, 0.15]);
        });
        await waitClock(page, 0.3);
      },
      "chess-set": async (page) => {
        await page.evaluate(() => {
          const p = window.__splashery.player;
          p.act(p.fromRecipe([0.1, 0.03, 0.5]));
        });
        await waitClock(page, 0.5);
      },
      bricks: async (page) => {
        await page.evaluate(() => window.__splashery.player.act());
        await waitClock(page, 5.3);
      },
    };
    const names = { "puzzle-cube": "cube", "newtons-cradle": "cradle", "chess-set": "chess", bricks: "bricks" }; // prettier-ignore
    for (const [w, h, opts] of [
      [1440, 900, {}],
      [390, 844, { hasTouch: true, isMobile: true }],
    ]) {
      const ctx = await browser.newContext({ viewport: { width: w, height: h }, ...opts });
      const page = await ctx.newPage();
      await loadApp(page);
      await page.evaluate(() => window.__splashery.player.camera.setTurntable(false));
      for (const [id, fn] of Object.entries(play)) {
        await page.evaluate((id) => window.__splashery.app.chooseToy(id), id);
        await page.waitForFunction((id) => window.__splashery.player.scene.toy.id === id, id);
        await page.waitForTimeout(2500);
        await fn(page);
        await page.screenshot({ path: path.join(SHOTS, `f-${names[id]}-${w}x${h}.png`) });
      }
      await ctx.close();
    }
  });
});
