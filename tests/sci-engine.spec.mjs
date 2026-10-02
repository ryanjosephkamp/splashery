// Lane Science's engine addition (r2, October 2, 2026): a recipe's
// `closeUp` ({ minDistance } in toy radii) lets the camera come that close,
// so a pinch or the wheel zooms all the way in; the near clip follows the
// camera in, and close up a one-finger drag pans, as on a picture toy. Toys
// without one are unchanged.

import { test, expect } from "@playwright/test";

const APP = "/?renderer=webgl2&adapt=off&profile=mid";

async function open(page) {
  const errors = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.goto(APP);
  await page.waitForSelector("body[data-ready='true']", { timeout: 180_000 });
  return errors;
}

// Zooms in as far as the camera allows and reports the camera's limits.
async function zoomAllTheWay(page, id) {
  return page.evaluate(async (id) => {
    const { app, player } = window.__splashery;
    const idle = async () => {
      while (app.busy) await new Promise((r) => setTimeout(r, 50));
    };
    await idle();
    await app.chooseToy(id);
    await idle();
    const cam = player.camera;
    for (let i = 0; i < 80; i++) cam.zoomBy(0.8);
    cam.cur = { ...cam.tgt };
    await player.stage.captureFrame();
    const R = cam.radius;
    return {
      min: cam.minDistance / R,
      distance: cam.cur.distance / R,
      poseDistance: cam.pose().distance / R,
      near: player.stage.cameraEntity.camera.nearClip,
      pans: player.pansHere(),
    };
  }, id);
}

test("a toy without a closeUp keeps the camera's limits and its near clip", async ({ page }) => {
  const errors = await open(page);
  const r = await zoomAllTheWay(page, "basketball");
  expect(r.min).toBeCloseTo(1.25, 5);
  expect(r.distance).toBeCloseTo(1.25, 5);
  expect(r.poseDistance).toBeCloseTo(r.distance, 5);
  expect(r.near).toBe(0.02);
  expect(r.pans).toBe(false);
  expect(errors).toEqual([]);
});

test("a recipe's closeUp lets the camera come that close; the near clip follows; a drag pans", async ({
  page,
}) => {
  const errors = await open(page);
  // The same module instance the player imports: give one kit toy a closeUp.
  await page.evaluate(async () => {
    const { RECIPES } = await import("/src/packs/balls.js");
    RECIPES.basketball.closeUp = { minDistance: 0.02 };
  });
  const r = await zoomAllTheWay(page, "basketball");
  expect(r.min).toBeCloseTo(0.02, 5);
  expect(r.distance).toBeCloseTo(0.02, 5);
  expect(r.near).toBeLessThan(0.02);
  expect(r.near).toBeGreaterThan(0);
  expect(r.pans).toBe(true);
  // Back out: the near clip is 0.02 again from a distance of 1 on.
  const back = await page.evaluate(async () => {
    const { player } = window.__splashery;
    const cam = player.camera;
    cam.tgt.distance = cam.radius * 3;
    cam.cur = { ...cam.tgt };
    await player.stage.captureFrame();
    return { near: player.stage.cameraEntity.camera.nearClip, pans: player.pansHere() };
  });
  expect(back).toEqual({ near: 0.02, pans: false });
  // Another toy afterwards gets the usual limits back.
  const other = await zoomAllTheWay(page, "soccer-ball");
  expect(other.min).toBeCloseTo(1.25, 5);
  expect(other.near).toBe(0.02);
  expect(errors).toEqual([]);
});
