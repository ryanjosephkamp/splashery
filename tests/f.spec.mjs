// Lane F's own checks (docs/OPERATING.md): touch and drag play.

import { test, expect } from "@playwright/test";

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

test.describe("Touch and drag (WebGL2)", () => {
  test.use({ viewport: { width: 1000, height: 760 } });

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
});
