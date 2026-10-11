import { test, expect } from "@playwright/test";
import { buildRecipe } from "../src/kit.js";
import { TOYS } from "../src/toys.js";
import {
  RECIPES,
  DOUBLINGS,
  PERIOD_THREE,
  DURATION,
  logistic,
  orbit,
  orbitNote,
  period,
} from "../src/packs/proto-logistic-map.js";

const recipe = RECIPES["logistic-map"];
test.use({ hasTouch: true });

test("logistic-map: exact recurrence, stability thresholds, and period-3 window", () => {
  expect(logistic(4, 0.2)).toBeCloseTo(0.64, 12);
  expect(logistic(4, logistic(4, 0.2))).toBeCloseTo(0.9216, 12);
  expect(Math.abs(DOUBLINGS[0] - 3)).toBeLessThan(0.005);
  expect(Math.abs(DOUBLINGS[1] - 3.449)).toBeLessThan(0.005);
  for (const [r, p] of [
    [2.99, 1],
    [3.01, 2],
    [3.44, 2],
    [3.46, 4],
    [3.835, 3],
  ]) {
    expect(period(r), `period at r=${r}`).toBe(p);
  }
  expect(PERIOD_THREE[0]).toBeCloseTo(3.828427, 6);
  expect(PERIOD_THREE[1]).toBeCloseTo(3.841499, 6);
  const xs = orbit(3.835, 12);
  for (let n = 3; n < xs.length; n++) expect(xs[n]).toBeCloseTo(xs[n - 3], 8);
  expect(orbitNote(0).f).toBe(220);
  expect(orbitNote(1).f).toBe(880);
});

test("logistic-map: a fixed modest budget and a repeatable tap sweep", () => {
  const it = buildRecipe(recipe, { count: 280000, seed: 5 }, () => {});
  let next = it.next();
  while (!next.done) next = it.next();
  const data = next.value.kit.data;
  expect(next.value.buf.count).toBeLessThan(15000);
  const c = { sweep: 0 };
  const frame = (elapsed, active = true) => {
    c.sweep = active ? 1 - elapsed / DURATION : 0;
    const out = { parts: {}, cues: [] };
    recipe.drive(elapsed, c, out, { data });
    return out;
  };
  expect(frame(0, false).cues).toEqual([]);
  expect(frame(0).cues).toHaveLength(1);
  expect(data.readout.r).toBe(2.5);
  frame(1.8);
  expect(data.readout.r).toBeCloseTo(3.4, 10);
  frame(3);
  expect(data.readout.r).toBe(4);
  const last = frame(4.19);
  const rest = frame(4.2, false);
  expect(last.parts).toEqual(rest.parts);
  expect(last.tokens).toEqual(rest.tokens);
  expect(rest.morph).toEqual([0, 0, 0, 0]);
  expect(data.readout.period).toBe(3);
});

for (const size of [
  { width: 390, height: 844 },
  { width: 1440, height: 900 },
]) {
  test(`logistic-map: labs, center touch, sound, and slider at ${size.width}x${size.height}`, async ({
    page,
  }) => {
    const errors = [];
    page.on("pageerror", (e) => errors.push(e.message));
    page.on("console", (m) => {
      // The task excludes assets/toys/. Report the missing shelf thumbnail
      // separately in the PR; every other console error fails this test.
      if (
        m.type() === "error" &&
        !m.location().url.includes("/assets/toys/logistic-map/thumb.webp")
      )
        errors.push(m.text());
    });
    await page.setViewportSize(size);
    await page.goto(
      `/?labs=1&renderer=webgl2&profile=${size.width === 390 ? "weak" : "high"}&adapt=off`,
    );
    await page.waitForSelector("body[data-ready='true']", { timeout: 180000 });
    await page.evaluate(async () => {
      const { app, player } = window.__splashery;
      await app.chooseToy("logistic-map");
      app.setLook({ background: "#f5f2eb" });
      player.opts.idleDelay = 1e9;
      player.idle.weight = 0;
    });
    await expect(page.locator("#toy-status")).toHaveText(/^Logistic map/);
    const def = TOYS.find((t) => t.id === "logistic-map");
    expect(def).toMatchObject({ category: "maths", labs: true, kind: "kit" });
    expect(
      await page.evaluate(async () => {
        const { onShelf, findToy } = await import("/src/toys.js");
        return onShelf(findToy("logistic-map"));
      }),
    ).toBe(true);
    await expect(page.locator("#toy-slider-label")).toHaveText("r = 3.835");
    const before = await page.evaluate(() => {
      const { app, player } = window.__splashery;
      return {
        scheduled: app.sound.scheduled,
        splats: player.motion.ctx.buf.count,
        readout: player.motion.ctx.kit.data.readout,
      };
    });
    expect(before.scheduled).toBe(0);
    expect(before.splats).toBeLessThan(15000);
    expect(before.readout.doublings[0]).toBeCloseTo(3, 3);
    expect(before.readout.doublings[1]).toBeCloseTo(3.449, 2);
    await page.waitForTimeout(800);
    await page.screenshot({
      path: `tests/screenshots/proto-logistic-map-${size.width}x${size.height}.png`,
    });
    await page.evaluate(() => window.__splashery.app.sound.setEnabled(true));
    const canvas = await page.locator("#stage").boundingBox();
    await page.touchscreen.tap(canvas.x + canvas.width / 2, canvas.y + canvas.height / 2);
    await expect
      .poll(() => page.evaluate(() => window.__splashery.player.motion.tap?.n ?? 0))
      .toBeGreaterThan(0);
    await expect
      .poll(() =>
        page.evaluate(() => window.__splashery.player.motion.ctx.kit.data.readout.running),
      )
      .toBe(true);
    await expect
      .poll(() => page.evaluate(() => window.__splashery.app.sound.scheduled))
      .toBeGreaterThan(before.scheduled);
    if (size.width === 390) {
      await page.screenshot({ path: "tests/screenshots/proto-logistic-map-390x844-after-tap.png" });
    }
    await expect
      .poll(
        () => page.evaluate(() => window.__splashery.player.motion.ctx.kit.data.readout.running),
        { timeout: 15000 },
      )
      .toBe(false);
    await page.locator("#toy-slider-input").fill("200");
    await page.locator("#toy-slider-input").dispatchEvent("input");
    await expect(page.locator("#toy-slider-label")).toHaveText("r = 2.800");
    expect(
      await page.evaluate(() => window.__splashery.player.motion.ctx.kit.data.readout.period),
    ).toBe(1);
    expect(errors).toEqual([]);
  });
}
