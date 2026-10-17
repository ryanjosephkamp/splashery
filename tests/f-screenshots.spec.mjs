// Task 101: retain every mid-play screenshot and its original clock.
import { test } from "@playwright/test";
import fs from "node:fs";
import path from "node:path";
import { SHOTS, loadApp, drag, waitClock } from "./f-helpers.mjs";

test.describe("Touch and drag (WebGL2)", () => {
  test.use({ viewport: { width: 1000, height: 760 } });
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
