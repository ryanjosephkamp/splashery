// Lane QR r4 (docs/handoff/QRr4.md): the QR family never "flashes big".
// Each toy's automatic scan check renders at a fixed square size with a
// front-on camera (app.withCapture). With the check on, the test opens each of
// the five toys and changes a setting, and records every frame for 3 s: the
// visible canvas keeps its own shape, or the still cover is up over it.

import { test, expect } from "@playwright/test";

const APP = "/?renderer=webgl2&adapt=off&profile=mid&labs=1";
const TOYS = ["qr-code", "qr-picture", "qr-build", "barcodes", "qr-damage"];

test("the QR family's scan checks never show on screen", async ({ page }) => {
  test.setTimeout(400_000);
  const errors = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.goto(APP);
  await page.waitForSelector("body[data-ready='true']", { timeout: 180_000 });
  // Every animation frame: is the drawing buffer stretched (its shape off the
  // element's by more than a pixel or two), and is the cover up?
  await page.evaluate(() => {
    const stage = window.__splashery.app.player.stage;
    const log = (window.__flash = { frames: 0, fixed: 0, bad: [] });
    const tick = () => {
      const c = stage.canvas;
      const cw = c.clientWidth;
      const ch = c.clientHeight;
      const covered = !!document.querySelector(".stage-cover");
      const stretched = cw > 0 && ch > 0 && Math.abs(c.width / c.height - cw / ch) > 0.02;
      log.frames++;
      if (stage.fixedSize) log.fixed++;
      if ((stage.fixedSize || stretched) && !covered) log.bad.push({ w: c.width, h: c.height, cw, ch }); // prettier-ignore
      requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
  });
  for (const [i, id] of TOYS.entries()) {
    await page.evaluate((id) => window.__splashery.app.chooseToy(id), id);
    await page.waitForFunction((id) => window.__splashery.app.player.toyInfo?.id === id && !window.__splashery.app.busy, id, { timeout: 60_000 }); // prettier-ignore
    await page.waitForTimeout(3000);
    await page.evaluate((t) => window.__splashery.app.player.switchTo({ options: { text: t } }), `FLASH ${i}`); // prettier-ignore
    await page.waitForTimeout(3000);
  }
  const log = await page.evaluate(() => window.__flash);
  // The checks did run (at least one capture per toy), and none showed.
  expect(log.fixed).toBeGreaterThan(TOYS.length);
  expect(log.bad.slice(0, 5)).toEqual([]);
  // The cover is gone once the checks are done.
  await page.waitForTimeout(1500);
  expect(await page.locator(".stage-cover").count()).toBe(0);
  expect(errors).toEqual([]);
});
