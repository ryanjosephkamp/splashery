import { expect } from "@playwright/test";

const SHOTS = "tests/screenshots";

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

async function screenAt(page, p) {
  const box = await page.locator("#stage").boundingBox();
  const [x, y] = await page.evaluate((p) => window.__splashery.player.screenPoint(p), p);
  return [box.x + x, box.y + y];
}

async function drag(page, a, b, steps = 10) {
  const [x0, y0] = await screenAt(page, a);
  const [x1, y1] = await screenAt(page, b);
  await page.mouse.move(x0, y0);
  await page.mouse.down();
  // (The press waits for the pick to say what is under it.)
  await page.waitForTimeout(400);
  for (let i = 1; i <= steps; i++)
    await page.mouse.move(x0 + ((x1 - x0) * i) / steps, y0 + ((y1 - y0) * i) / steps);
  await page.waitForTimeout(300);
  await page.mouse.up();
}

async function tapAt(page, p) {
  const count = () => page.evaluate(() => window.__splashery.player.motion.tap?.n ?? 0);
  const n = await count();
  const [x, y] = await screenAt(page, p);
  await page.mouse.click(x, y);
  await expect.poll(count, { timeout: 20_000 }).toBeGreaterThan(n);
}

async function waitClock(page, secs) {
  const t0 = await page.evaluate(() => window.__splashery.player.time);
  await expect
    .poll(() => page.evaluate(() => window.__splashery.player.time), { timeout: 60_000 })
    .toBeGreaterThan(t0 + secs);
}

const yaw = (page) => page.evaluate(() => window.__splashery.player.camera.tgt.yaw);
export { SHOTS, WEBGL, loadApp, openToy, screenAt, drag, tapAt, waitClock, yaw };
