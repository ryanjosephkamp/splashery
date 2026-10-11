import { test, expect } from "@playwright/test";
import {
  BALLS,
  G,
  STEP,
  trajectory,
  bestAngle,
} from "../src/packs/proto-projectile-drag/physics.js";
import { RECIPES } from "../src/packs/proto-projectile-drag.js";
import { buildRecipe } from "../src/kit.js";
import { TOYS } from "../src/toys.js";

const ID = "projectile-drag";
const RECIPE = RECIPES[ID];

test("drag off agrees with the ideal range, height, and flight time", () => {
  for (const ball of Object.keys(BALLS)) {
    for (const speed of [10, 40, 60]) {
      for (const angle of [10, 30, 45, 75]) {
        const f = trajectory({ ball, speed, angle, drag: false });
        const theta = (angle * Math.PI) / 180;
        const range = (speed ** 2 * Math.sin(2 * theta)) / G;
        const peak = (speed * Math.sin(theta)) ** 2 / (2 * G);
        const time = (2 * speed * Math.sin(theta)) / G;
        expect(Math.abs(f.range / range - 1)).toBeLessThan(0.005);
        expect(Math.abs(f.peak / peak - 1)).toBeLessThan(0.005);
        expect(Math.abs(f.time / time - 1)).toBeLessThan(0.005);
        expect(f.points.at(-1).y).toBe(0);
      }
    }
  }
});

test("baseball at 40 m/s favors an angle below 45 degrees with drag", () => {
  const settings = { ball: "baseball", speed: 40, drag: true };
  const angle = bestAngle(settings);
  expect(angle).toBeGreaterThan(35);
  expect(angle).toBeLessThan(45);
  const best = trajectory({ ...settings, angle });
  expect(best.range).toBeGreaterThan(trajectory({ ...settings, angle: 45 }).range);
  for (const offset of [-1, 1])
    expect(best.range).toBeGreaterThan(trajectory({ ...settings, angle: angle + offset }).range);
  expect(bestAngle({ ...settings, drag: false })).toBe(45);
});

test("the fixed step converges for every ball, including the strongest drag", () => {
  for (const ball of Object.keys(BALLS)) {
    const settings = { ball, speed: 60, angle: 75, drag: true };
    const f = trajectory(settings);
    const finer = trajectory({ ...settings, step: STEP / 2 });
    expect(Math.abs(f.range / finer.range - 1)).toBeLessThan(0.00001);
    expect(Math.abs(f.time / finer.time - 1)).toBeLessThan(0.00001);
    expect(f.range).toBeLessThan(trajectory({ ...settings, drag: false }).range);
    expect(f.points.every((p) => Number.isFinite(p.x) && p.y >= 0)).toBe(true);
    // Full integration steps are fixed; only the ground event is fractional.
    for (let i = 1; i < f.points.length - 1; i++)
      expect(f.points[i].t - f.points[i - 1].t).toBeCloseTo(STEP, 10);
  }
});

test("the kit scene stays modest and belongs only to the Science labs shelf", () => {
  expect(TOYS.find((t) => t.id === ID)).toMatchObject({
    category: "science",
    labs: true,
    kind: "kit",
  });
  for (const options of [{}, { ball: "ping", speed: 60, angle: 75 }, { angle: 10, drag: false }]) {
    const it = buildRecipe(RECIPE, { seed: 1, count: 6000, options }, () => {});
    let result = it.next();
    while (!result.done) result = it.next();
    expect(result.value.buf.count).toBeLessThan(15000);
    expect(result.value.kit.data.tapBox).toBeTruthy();
  }
});

async function openToy(page) {
  await page.goto("/?renderer=webgl2&profile=weak&adapt=off&labs=1");
  await page.waitForSelector("body[data-ready='true']", { timeout: 180000 });
  await page.evaluate(async () => {
    const { app, player } = window.__splashery;
    await app.chooseToy("projectile-drag");
    player.opts.idleDelay = 1e9;
    player.idle.weight = 0;
  });
  await expect(page.locator("#toy-status")).toHaveText(/^Projectile with air drag/);
}

test("phone touch launches both balls, shows correct numbers, and resets without errors", async ({
  browser,
}) => {
  const context = await browser.newContext({
    viewport: { width: 390, height: 844 },
    isMobile: true,
    hasTouch: true,
  });
  const page = await context.newPage();
  const errors = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await openToy(page);
  await expect(page.locator('.toy-card[data-toy="projectile-drag"]')).toHaveCount(1);
  await expect(page.locator("#toy-legend li")).toHaveCount(4);
  await expect(page.locator("#projectile-numbers")).toContainText("163.10");
  await expect(page.locator("#projectile-numbers")).toContainText("41.3°");
  await page.screenshot({ path: "tests/screenshots/proto-projectile-drag-first-390x844.png" });
  // The prototype's thumbnail is outside the allowed asset scope. Wait for the shelf's
  // existing blank-card fallback before watching console output from the launch itself.
  await expect(page.locator('.toy-card[data-toy="projectile-drag"] .thumb')).toHaveCount(1);
  page.on("console", (m) => {
    if (m.type() === "error") errors.push(m.text());
  });
  expect(await page.evaluate(() => window.__splashery.app.sound.scheduled)).toBe(0);
  await page.click("#sound-toggle");
  // The existing speaker button plays its own confirmation chime.
  const beforeLaunch = await page.evaluate(() => window.__splashery.app.sound.scheduled);
  expect(await page.evaluate(() => window.__splashery.app.sound.last.toy)).toBeUndefined();
  const stage = await page.locator("#stage").boundingBox();
  await page.touchscreen.tap(stage.x + stage.width / 2, stage.y + stage.height / 2);
  await expect
    .poll(() => page.evaluate(() => window.__splashery.player.motion.state.launch))
    .toBeGreaterThan(0.6);
  await expect
    .poll(() => page.evaluate(() => window.__splashery.player.motion.out.parts.airBall.offset[0]))
    .toBeGreaterThan(0.2);
  await expect
    .poll(() => page.evaluate(() => window.__splashery.player.motion.state.launch))
    .toBeLessThan(0.8);
  expect(await page.evaluate(() => window.__splashery.app.sound.scheduled)).toBe(beforeLaunch + 1);
  const pose = await page.evaluate(() => {
    const { player } = window.__splashery;
    player.frozen = true;
    return player.motion.out.parts;
  });
  expect(pose.airBall.offset[1]).toBeGreaterThan(0);
  expect(pose.idealBall.offset[0]).toBeGreaterThan(pose.airBall.offset[0]);
  await page.screenshot({ path: "tests/screenshots/proto-projectile-drag-390x844.png" });
  await page.evaluate(() => {
    window.__splashery.player.frozen = false;
  });
  await expect
    .poll(() => page.evaluate(() => window.__splashery.player.motion.state.launch), {
      timeout: 12000,
    })
    .toBe(0);
  const reset = await page.evaluate(() => window.__splashery.player.motion.out.parts);
  expect(reset.airBall.offset).toEqual([0, 0, 0]);
  expect(reset.idealBall.offset).toEqual([0, 0, 0]);
  // The actual drag switch rebuilds the shown values, not just the test module.
  await page.evaluate(() => window.__splashery.app.setToyOption("drag", false));
  await expect(page.locator("#projectile-numbers")).toContainText("Drag off");
  const rows = await page.locator("#projectile-numbers tr").allTextContents();
  expect(rows[1]).toContain("163.10");
  expect(rows[2]).toContain("163.10");
  await page.evaluate(() =>
    window.__splashery.app.setToyOptions({ ball: "ping", speed: 20, angle: 30, drag: true }),
  );
  await expect(page.locator("#projectile-numbers")).toContainText(
    "Ping-pong ball: 2.70 g, 40.00 mm, and Cd 0.5",
  );
  expect(errors).toEqual([]);
  await context.close();
});

test("desktop proof frame and labs-off shelf", async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await openToy(page);
  await page.screenshot({ path: "tests/screenshots/proto-projectile-drag-1440x900.png" });
  await page.goto("/?renderer=webgl2&profile=weak&labs=0");
  await page.waitForSelector("body[data-ready='true']", { timeout: 180000 });
  await expect(page.locator('.toy-card[data-toy="projectile-drag"]')).toBeHidden();
});
