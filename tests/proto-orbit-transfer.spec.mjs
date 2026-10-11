import { test, expect } from "@playwright/test";
import {
  DAY,
  MU,
  TAU,
  PLANETS,
  planTransfer,
  nextWindow,
  signedAngle,
  transferState,
} from "../src/packs/proto-orbit-transfer/math.js";
import {
  RECIPES,
  makePlan,
  simulationAt,
  WAIT_TICKS,
  FLIGHT_TICKS,
  EFFECT_SECONDS,
} from "../src/packs/proto-orbit-transfer.js";
import { TOYS } from "../src/toys.js";

const recipe = RECIPES["orbit-transfer"];
const blank = () => ({ parts: {}, cues: [] });
const draw = (d, c, n = 1) => {
  const out = blank();
  recipe.drive(0, c, out, { data: d, tap: { n } });
  return out;
};

test("orbit-transfer: Earth to Mars reference values and displayed units", () => {
  const d = makePlan("earth", "mars");
  expect(d.plan.seconds / DAY).toBeCloseTo(258.93, 2);
  expect(d.plan.total).toBeCloseTo(5.5965, 4);
  expect(d.plan.burn1).toBeCloseTo(2.945, 2);
  expect(d.plan.burn2).toBeCloseTo(2.65, 2);
  expect((d.plan.phase * 180) / Math.PI).toBeCloseTo(44.36, 2);
  expect(Math.hypot(...simulationAt(d, 0).craft.velocity)).toBeCloseTo(29.7845, 4);
  const text = draw(d, { launch: 0 })
    .legend.items.map((i) => i.text)
    .join("\n");
  expect(text).toContain("Travel: 258.9 days");
  expect(text).toContain("Total Δv: 5.60 km/s");
  expect(text).toContain("Launch phase: 44.4° ahead");
  const atWindow = draw(d, { launch: 1 - WAIT_TICKS / (EFFECT_SECONDS * 120) });
  expect(atWindow.legend.items.map((i) => i.text)).toContain("Next window: 0.0 days");
  expect(TOYS.find((t) => t.id === "orbit-transfer")).toMatchObject({
    category: "space",
    labs: true,
  });
});

test("orbit-transfer: all 56 directions meet the moving destination and conserve energy", () => {
  for (const from of PLANETS) {
    for (const to of PLANETS) {
      if (from === to) continue;
      const d = makePlan(from.id, to.id);
      const p = d.plan;
      const s = simulationAt(d, WAIT_TICKS + FLIGHT_TICKS);
      const position = s.craft.position.map((x) => x * d.scale);
      expect(
        Math.hypot(...position.map((x, i) => x - s.target[i])),
        `${from.id} → ${to.id}`,
      ).toBeLessThan(1e-10);
      expect(d.wait).toBeGreaterThanOrEqual(0);
      expect(d.wait).toBeLessThan(TAU / Math.abs(p.n2 - p.n1));
      expect(Math.abs(signedAngle(d.initialPhase + (p.n2 - p.n1) * d.wait - p.phase))).toBeLessThan(
        1e-10,
      );
      expect(nextWindow(p, p.phase)).toBe(0);
      expect(Math.sign(p.burn1)).toBe(p.outward ? 1 : -1);
      expect(Math.sign(p.burn2)).toBe(p.outward ? 1 : -1);
      for (let i = 0; i <= 64; i++) {
        const state = transferState(p, (p.seconds * i) / 64);
        const r = Math.hypot(...state.position);
        const v = Math.hypot(...state.velocity);
        const energy = (v * v) / 2 - MU / r;
        expect(Math.abs((energy + MU / (2 * p.a)) / (MU / (2 * p.a)))).toBeLessThan(1e-10);
        const h = state.position[0] * state.velocity[1] - state.position[1] * state.velocity[0];
        expect(h).toBeGreaterThan(0); // All transfers are prograde, including inward ones.
      }
    }
  }
  expect(() => planTransfer(1, 1)).toThrow("different planets");
  expect(makePlan("earth", "earth").plan).toBeNull();
});

test("orbit-transfer: fixed ticks, two burn cues per tap, pause, and reset", () => {
  const d = makePlan("mercury", "neptune");
  const c = { launch: 0 };
  draw(d, c, 0);
  expect(draw(d, { launch: 0.1 }, 0).cues).toEqual([]); // No tap, no burn sound.
  for (const n of [1, 2]) {
    const cues = [];
    for (let tick = 0; tick < EFFECT_SECONDS * 120; tick++) {
      c.launch = 1 - tick / (EFFECT_SECONDS * 120);
      const out = draw(d, c, n);
      cues.push(...out.cues);
      for (const token of out.tokens) {
        expect((token.offset || []).every(Number.isFinite)).toBe(true);
        expect((token.quat || []).every(Number.isFinite)).toBe(true);
      }
      if (tick === 150) {
        const paused = draw(d, c, n);
        expect(paused.tokens).toEqual(out.tokens);
        expect(paused.cues).toEqual([]);
      }
    }
    expect(cues).toHaveLength(2);
    const last = draw(d, c, n).tokens;
    c.launch = 0;
    expect(draw(d, c, n).tokens).toEqual(last);
  }
  // Skipping render frames lands at the same physical state as small steps.
  const a = { launch: 1 };
  const b = { launch: 1 };
  draw(d, a);
  draw(d, b);
  for (let tick = 1; tick <= 200; tick++) {
    a.launch = 1 - tick / (EFFECT_SECONDS * 120);
    draw(d, a);
  }
  b.launch = a.launch;
  expect(draw(d, b).tokens).toEqual(draw(d, a).tokens);
});

for (const viewport of [
  { width: 390, height: 844 },
  { width: 1440, height: 900 },
]) {
  test(`orbit-transfer: labs load, touch launch, math, and screenshot at ${viewport.width}x${viewport.height}`, async ({
    browser,
  }) => {
    const context = await browser.newContext({ viewport, hasTouch: true });
    const page = await context.newPage();
    const errors = [];
    let launched = false;
    page.on("pageerror", (e) => errors.push(e.message));
    page.on("console", (m) => {
      // Missing shelf thumbnails at load are outside the allowed asset scope.
      // Capture every console error during launch, including resource errors.
      if (m.type() === "error" && (launched || !m.text().includes("Failed to load resource")))
        errors.push(m.text());
    });
    await page.goto("/?renderer=webgl2&adapt=off&profile=low&labs=1");
    await page.waitForSelector("body[data-ready='true']");
    await page.evaluate(() => window.__splashery.app.chooseToy("orbit-transfer"));
    await expect(page.locator("#toy-legend")).toContainText("Travel: 258.9 days");
    await expect(page.locator("#toy-legend")).toContainText("Total Δv: 5.60 km/s");
    await expect(page.locator('.toy-card[data-toy="orbit-transfer"]')).toBeVisible();
    expect(await page.evaluate(() => window.__splashery.player.proc.ctx.buf.count)).toBeLessThan(
      6000,
    );
    // Turn sound on with a touch; opening the planner schedules no burn audio.
    expect(await page.evaluate(() => window.__splashery.app.sound.scheduled)).toBe(0);
    await page.locator("#sound-toggle").tap();
    const scheduled = await page.evaluate(() => window.__splashery.app.sound.scheduled);
    // Allow the shelf's load-time thumbnail fallback to settle.
    await page.waitForTimeout(500);
    // The actual stage tap uses the enlarged craft's splats, not an app.act shortcut.
    const point = await page.evaluate(() => {
      const { player } = window.__splashery;
      const fit = player.proc.ctx.transform;
      const token = player.motion.out.tokens[2].offset;
      const world = token.map((x, i) => (x - fit.center[i]) * fit.scale);
      return player.stage.toScreen(world);
    });
    launched = true;
    await page.touchscreen.tap(point[0], point[1]);
    await expect
      .poll(
        () => page.evaluate((before) => window.__splashery.app.sound.scheduled - before, scheduled),
        { timeout: 20000 },
      )
      .toBe(2);
    await expect
      .poll(() => page.evaluate(() => window.__splashery.player.motion.state.launch))
      .toBe(0);
    await page.screenshot({
      path: `tests/screenshots/proto-orbit-transfer-${viewport.width}x${viewport.height}.png`,
    });
    // Use the actual planet selectors in the touch-accessible Toy panel.
    if (viewport.width === 390) await page.locator("#sheet-toggle").tap();
    const departure = page.locator("#toy-options select").nth(0);
    const destination = page.locator("#toy-options select").nth(1);
    await departure.selectOption("mars");
    await expect(departure).toHaveValue("mars");
    await destination.selectOption("earth");
    await expect(destination).toHaveValue("earth");
    await expect
      .poll(() =>
        page.evaluate(() =>
          window.__splashery.player.motion.out.legend.items.map((i) => i.text).join(" "),
        ),
      )
      .toContain("retrograde");
    if (viewport.width === 390) await page.locator("#sheet-toggle").tap();
    // Exercise the extreme-radius and no-transfer cases through the options API.
    await page.evaluate(() =>
      window.__splashery.app.setToyOptions({ from: "neptune", to: "mercury" }),
    );
    await expect(page.locator("#toy-legend")).toContainText("Neptune → Mercury");
    await page.evaluate(() => window.__splashery.app.setToyOptions({ from: "earth", to: "earth" }));
    await expect(page.locator("#toy-legend")).toContainText("Choose two different planets");
    expect(errors).toEqual([]);
    await context.close();
  });
}
