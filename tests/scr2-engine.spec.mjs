// Lane Screens r2's engine addition (docs/handoff/ScreensR2.md): a picture
// toy can hold a GIF on its frame (pics.hold(true)) and let it play on from
// there (pics.hold(false)), so the Screen's GIF stops behind a switched-off
// set. Other toys are unchanged: a GIF plays by itself unless held.

import { test, expect } from "@playwright/test";

const APP = "/?renderer=webgl2&adapt=off&profile=mid&labs=1";

test("a GIF held on its frame stays there, then plays on from it", async ({ page }) => {
  await page.goto(APP);
  await page.waitForSelector("body[data-ready='true']", { timeout: 180_000 });
  await page.evaluate(async () => {
    const { app } = window.__splashery;
    await app.chooseToy("screen");
    await app.setToyOptions({ sample: "gif" });
  });
  await page.waitForFunction(() => window.__splashery.player.pictures?.media?.kind === "gif", null, { timeout: 120_000 }); // prettier-ignore
  // The frames shown over `sec` seconds of the player's clock (the GIF's
  // clock), however slow the renderer is.
  const frames = async (sec) =>
    page.evaluate(async (sec) => {
      const pl = window.__splashery.player;
      const p = pl.pictures;
      const seen = new Set();
      const t0 = pl.time;
      const w0 = performance.now();
      while (pl.time - t0 < sec && performance.now() - w0 < 60_000) {
        pl.stage.requestRender();
        await new Promise((r) => setTimeout(r, 30));
        seen.add(p.gifFrame);
      }
      return [...seen];
    }, sec);
  // It plays by itself (15 frames over about a second).
  expect((await frames(1.5)).length).toBeGreaterThan(3);
  expect(await page.evaluate(() => window.__splashery.player.pictures.api.playing)).toBe(true);
  // Held: one frame only, and it says so.
  await page.evaluate(() => window.__splashery.player.pictures.api.hold(true));
  const held = await page.evaluate(() => window.__splashery.player.pictures.gifFrame);
  expect(await frames(1.5)).toEqual([held]);
  expect(await page.evaluate(() => window.__splashery.player.pictures.api.held)).toBe(true);
  expect(await page.evaluate(() => window.__splashery.player.pictures.api.playing)).toBe(false);
  // Let go: it goes on from the frame it held.
  await page.evaluate(() => window.__splashery.player.pictures.api.hold(false));
  const next = await page.evaluate(() => {
    const p = window.__splashery.player.pictures;
    p.update(window.__splashery.player.motion.out, p.lastTime);
    return p.gifFrame;
  });
  expect(next).toBe(held);
  expect((await frames(1.5)).length).toBeGreaterThan(3);
  expect(await page.evaluate(() => window.__splashery.player.pictures.api.held)).toBe(false);
});
