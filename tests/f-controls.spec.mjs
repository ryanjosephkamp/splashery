// Task 101: independent controls keep the original pointer cadence and player clocks.
import { test, expect } from "@playwright/test";

import { loadApp, openToy, screenAt, drag, tapAt, waitClock, yaw } from "./f-helpers.mjs";

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
});
