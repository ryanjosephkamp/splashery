// Lane Live input r3's engine hook (docs/handoff/LiveInput.md, "Brief r3"):
// a toy's own tilt range. The Song landscape and the Chladni plate let the
// view tilt up and down, but only between a level look and a look from
// above, never under the stage.

import { test, expect } from "@playwright/test";
import { OrbitCamera } from "../src/camera.js";

const APP = "/?renderer=webgl2&adapt=off&profile=mid&labs=1";

test("a toy's pitch range keeps the tilt inside it, and null gives the usual limits back", () => {
  const cam = new OrbitCamera({ reducedMotion: true });
  cam.viewportHeight = 800;
  cam.setPitchRange([0.1, 1.0]);
  cam.rotateBy(0, 5000);
  expect(cam.tgt.pitch).toBeCloseTo(1.0, 6);
  cam.rotateBy(0, -10000);
  expect(cam.tgt.pitch).toBeCloseTo(0.1, 6);
  // A saved pose outside the range comes back inside it.
  cam.setState({ yaw: 0, pitch: -1, distance: 5 });
  expect(cam.tgt.pitch).toBeCloseTo(0.1, 6);
  // Bad ranges are ignored; null frees it again.
  cam.setPitchRange([0.2, "x"]);
  expect(cam.pitchRange).toBe(null);
  cam.setPitchRange(null);
  cam.rotateBy(0, -10000);
  expect(cam.tgt.pitch).toBeLessThan(-1.4);
});

test("the app gives each toy its own range when it opens, and none to a toy without one", async ({
  page,
}) => {
  await page.goto(APP);
  await page.waitForSelector("body[data-ready='true']", { timeout: 180_000 });
  const range = await page.evaluate(async () => {
    const { player, app } = window.__splashery;
    player.motion.recipe && (player.motion.recipe.pitchRange = undefined);
    await app.chooseToy(player.scene.toy.id);
    return player.camera.pitchRange;
  });
  expect(range).toBe(null);
});

test("a toy that holds still still starts with its tilt locked", async ({ page }) => {
  // (A recipe's tiltLock: false wins over that: the lane's tests check it on
  // the Song landscape and the Chladni plate.)
  await page.goto(APP);
  await page.waitForSelector("body[data-ready='true']", { timeout: 180_000 });
  const lock = await page.evaluate(async () => {
    const { player, app } = window.__splashery;
    await app.chooseToy("graph-plotter");
    return player.camera.tiltLock;
  });
  expect(lock).toBe(true);
});

test("the Live pill never covers a control, on a phone or a desktop", async ({
  playwright,
  baseURL,
}) => {
  const config = (await import("../playwright.config.mjs")).default;
  const use = config.use.launchOptions;
  const browser = await playwright.chromium.launch({ ...use, args: [...use.args, "--use-fake-ui-for-media-stream", "--use-fake-device-for-media-stream"] }); // prettier-ignore
  try {
    for (const [w, h] of [
      [390, 844],
      [1440, 900],
    ]) {
      const page = await browser.newPage({ baseURL, viewport: { width: w, height: h } }); // prettier-ignore
      await page.goto(APP);
      await page.waitForSelector("body[data-ready='true']", { timeout: 180_000 });
      await page.evaluate(() => window.__splashery.app.chooseToy("room-echo"));
      await page.waitForFunction(() => window.__splashery.player.scene.toy.id === "room-echo" && document.getElementById("live-mic"), null, { timeout: 120_000 }); // prettier-ignore
      await page.evaluate(() => document.getElementById("live-mic").click());
      await page.waitForSelector("#live-indicator:not([hidden])");
      const over = await page.evaluate(() => {
        const r = document.getElementById("live-indicator").getBoundingClientRect();
        const hit = [];
        for (const el of document.querySelectorAll(
          "button, select, input, a, [role=button], [role=switch]",
        )) {
          if (el.closest("#live-indicator")) continue;
          const q = el.getBoundingClientRect();
          if (q.width && q.height && q.left < r.right && q.right > r.left && q.top < r.bottom && q.bottom > r.top) hit.push(el.id || el.textContent.trim()); // prettier-ignore
        }
        return hit;
      });
      expect(over, `${w}×${h}`).toEqual([]);
      // UI r5's Record pill and the Physics hands bar don't meet it either.
      await page.evaluate(() => document.getElementById("record-start").click());
      await page.waitForSelector("#rec-pill:not([hidden])", { timeout: 30_000 });
      await page.evaluate(() => (document.getElementById("hands-bar").hidden = false));
      const meet = await page.evaluate(() => {
        const r = (id) => document.getElementById(id).getBoundingClientRect();
        const hit = (a, b) => a.left < b.right && a.right > b.left && a.top < b.bottom && a.bottom > b.top; // prettier-ignore
        const live = r("live-indicator");
        return { rec: hit(live, r("rec-pill")), hands: hit(live, r("hands-bar")), recHands: hit(r("rec-pill"), r("hands-bar")) }; // prettier-ignore
      });
      expect(meet, `${w}×${h}`).toEqual({ rec: false, hands: false, recHands: false });
      await page.screenshot({ path: `tests/screenshots/live3-pill-${w}x${h}.png` });
      await page.close();
    }
  } finally {
    await browser.close();
  }
});
