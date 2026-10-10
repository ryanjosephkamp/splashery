// Lane Hands-on H3, engine: Level 1 for picture toys and still toys
// (turntable: false) that ask for it (`handsLevel1`, docs/PACKS.md 5f): true,
// or a function that is false while the toy is a live tool; and a toy with
// its own drags that asks keeps them, picked up only off them.

import { test, expect } from "@playwright/test";
import { canPlay, asksLevel1 } from "../src/physics/hands-on.js";

test("canPlay: picture and still toys play Level 1 only when they ask, and not while live", () => {
  let live = false;
  const info = (recipe) => ({ recipe });
  expect(canPlay(info({ pictures: {} }))).toBe(false);
  expect(canPlay(info({ turntable: false }))).toBe(false);
  expect(canPlay(info({ pictures: {}, handsLevel1: true }))).toBe(true);
  expect(canPlay(info({ turntable: false, handsLevel1: true }))).toBe(true);
  const still = { turntable: false, handsLevel1: () => !live };
  expect(canPlay(info(still))).toBe(true);
  live = true;
  expect(canPlay(info(still))).toBe(false);
  expect(asksLevel1(still)).toBe(true); // it asks, live or not
  expect(canPlay(info({ handsOn: false, handsLevel1: true }))).toBe(false);
  expect(canPlay(info({}))).toBe(true); // any other toy, as before
});

const APP = "/?renderer=webgl2&adapt=off&profile=mid";

async function open(page, id, patch) {
  await page.goto(APP);
  await page.waitForSelector("body[data-ready='true']", { timeout: 180_000 });
  await page.evaluate(
    async ({ id, patch }) => {
      const { app, player } = window.__splashery;
      // The snow globe patched into a still toy that asks for Level 1 (while
      // window.__live is false), with its own drag on its left half.
      await app.chooseToy(id);
      player.opts.idleDelay = 1e9;
      if (patch) {
        const r = player.toyInfo.recipe;
        window.__orig = { turntable: r.turntable, handsLevel1: r.handsLevel1, drag: r.drag };
        window.__live = false;
        window.__dragged = 0;
        r.turntable = false;
        r.handsLevel1 = () => !window.__live;
        r.drag = { plane: "view", at: (p) => p[0] < 0, start: () => window.__dragged++, move() {}, end() {} }; // prettier-ignore
        player.handsOn.attach(player.toyInfo);
        app.showHands();
      }
    },
    { id, patch },
  );
  await page.waitForTimeout(600);
}

// (The recipe is shared within the page: put it back.)
test.afterEach(async ({ page }) => {
  if (!page.url().startsWith("http")) return;
  await page.evaluate(() => {
    const r = window.__splashery.player.toyInfo?.recipe;
    if (r && window.__orig) Object.assign(r, window.__orig);
  });
});

const handsShown = (page) =>
  page.evaluate(() => {
    const b = document.getElementById("hands-toggle");
    return !(b.hidden || getComputedStyle(b).display === "none" || b.disabled);
  });

test("a still toy that asks: off at first, its own drag on its pages, picked up off them; off while live", async ({
  page,
}) => {
  await open(page, "snow-globe", true);
  let s = await page.evaluate(() => ({ on: window.__splashery.player.handsOn.on }));
  expect(s.on).toBe(false); // (its own drags work with the switch off, as before)
  expect(await handsShown(page)).toBe(true);
  await page.click("#hands-toggle");
  // Pressed through Hands-on: on its own drag's half, no pick-up; off it, one.
  s = await page.evaluate(() => {
    const { player } = window.__splashery;
    const ho = player.handsOn;
    const c = player.toyInfo.center;
    const at = (dx) => player.fromRecipe([dx, 0.2, 0.3]);
    const left = ho.pressAt(at(-0.4), 0, 0);
    ho.release();
    const right = ho.pressAt(at(0.4), 0, 0);
    ho.release();
    return { left, right, c: !!c };
  });
  expect(s.left).toBe(false);
  expect(s.right).toBe(true);
  // Live: the switch goes off and ✋ goes away; back, it shows again.
  await page.evaluate(() => {
    window.__live = true;
    window.__splashery.player.update(1 / 60);
  });
  s = await page.evaluate(() => ({ on: window.__splashery.player.handsOn.on }));
  expect(s.on).toBe(false);
  expect(await handsShown(page)).toBe(false);
  await page.evaluate(() => {
    window.__live = false;
    window.__splashery.player.update(1 / 60);
  });
  expect(await handsShown(page)).toBe(true);
});
