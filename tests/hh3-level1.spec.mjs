// Lane Hands-on H3, Level 1 for the Hands-on Plan's "Level 1 only" picture,
// Studio and Lab toys that Hands-on used to leave alone (picture toys and
// still toys): with the ✋ switch on, each is picked up whole. The book and
// the photo album stay out (every press on them pulls a page).

import { test, expect } from "@playwright/test";

const APP = "/?renderer=webgl2&adapt=off&profile=mid&labs=1";
const TOYS = [
  "picture-lab",
  "screen",
  "room-echo",
  "splat-mirror",
  "photo-3d",
  "video-3d",
  "fluid-lab",
];

test.setTimeout(600_000);

test("each 'Level 1 only' picture, Studio and Lab toy is picked up whole with ✋ on", async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto(APP);
  await page.waitForSelector("body[data-ready='true']", { timeout: 180_000 });
  for (const id of TOYS) {
    const r = await page.evaluate(async (id) => {
      const { app, player } = window.__splashery;
      await app.chooseToy(id);
      player.opts.idleDelay = 1e9;
      const b = document.getElementById("hands-toggle");
      const shown = !(b.hidden || getComputedStyle(b).display === "none" || b.disabled);
      if (!shown) return { id, shown };
      app.toggleHands();
      // Lifted by its middle, on the fixed clock: press, ten moves up, let go.
      const ho = player.handsOn;
      const step = player.update.bind(player);
      const c = player.toyInfo.center;
      const s = player.screenPoint(player.toRecipe(c));
      const took = ho.pressAt(c.slice(), s[0], s[1]);
      for (let i = 1; i <= 10; i++) {
        ho.moveTo(s[0], s[1] - 12 * i);
        step(1 / 60);
        step(1 / 60);
      }
      const lift = ho.body ? ho.body.pos[1] - ho.body.home.pos[1] : 0;
      ho.release();
      ho.reset();
      for (let i = 0; i < 60; i++) step(1 / 60);
      return { id, shown, took, on: ho.on, lift };
    }, id);
    expect(r.shown, `${id}: ✋ shows`).toBe(true);
    expect(r.took, `${id}: the press takes it`).toBe(true);
    expect(r.lift, `${id}: lifted`).toBeGreaterThan(0.1);
  }
});

test("the book and the photo album stay out: their pages pull as before", async ({ page }) => {
  await page.goto(APP);
  await page.waitForSelector("body[data-ready='true']", { timeout: 180_000 });
  for (const id of ["your-book", "photo-album"]) {
    const shown = await page.evaluate(async (id) => {
      const { app } = window.__splashery;
      await app.chooseToy(id);
      const b = document.getElementById("hands-toggle");
      return !(b.hidden || getComputedStyle(b).display === "none" || b.disabled);
    }, id);
    expect(shown, id).toBe(false);
  }
});
