// Lane Arcade r2's engine PR (docs/handoff/ArcadeR2.md): the ▶ over the
// stage plays and pauses a game, and shows pause while the game plays.

import { test, expect } from "@playwright/test";

const APP = "/?renderer=webgl2&adapt=off&watch=off&labs=1";

test("the play button over the stage shows pause while a game plays", async ({ page }) => {
  await page.goto(APP);
  await page.waitForSelector("body[data-ready='true']", { timeout: 120_000 });
  await page.evaluate(() => window.__splashery.app.chooseToy("shardball"));
  await page.waitForFunction(() => !!window.__splashery.player.arcade?.game, null, { timeout: 60_000 }); // prettier-ignore
  const label = () => page.getAttribute("#hands-play", "aria-label");
  const mode = () => page.evaluate(() => window.__splashery.player.arcade.mode);
  // The game plays itself, so it isn't lost while the test waits.
  await page.evaluate(() => (window.__splashery.player.arcade.autopilot = true));
  expect(await label()).toBe("Play");
  await page.click("#hands-play");
  await expect.poll(mode).toBe("play");
  await expect.poll(label).toBe("Pause");
  await page.click("#hands-play");
  await expect.poll(mode).toBe("paused");
  await expect.poll(label).toBe("Play");
  // A toy that isn't a game keeps its plain ▶.
  await page.evaluate(() => window.__splashery.app.chooseToy("heart"));
  await expect.poll(label).toBe("Play");
});
