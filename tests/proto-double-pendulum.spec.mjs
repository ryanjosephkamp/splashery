import { test, expect } from "@playwright/test";
import { buildRecipe } from "../src/kit.js";
import { resolveOptions } from "../src/player.js";
import { TOYS } from "../src/toys.js";
import { RECIPES } from "../src/packs/proto-double-pendulum.js";
import {
  Experiment,
  STEP,
  angleDistance,
  energy,
  period,
  positions,
} from "../src/packs/proto-double-pendulum/physics.js";

const ID = "double-pendulum";
const recipe = RECIPES[ID];

test.describe("double-pendulum physics", () => {
  test("one arm's measured small-angle period matches 2π√(L/g) within 1%", () => {
    // Measure repeated positive-going zero crossings of the integrated angle;
    // checking only the displayed analytic formula would not test the solver.
    for (const gravity of ["earth", "moon", "mars"]) {
      for (const l1 of [0.25, 1, 1.5]) {
        const sim = new Experiment({ mode: "single", gravity, l1 });
        sim.reset(true);
        const expected = 2 * Math.PI * Math.sqrt(l1 / sim.p.g);
        for (let i = 0; i < Math.ceil((expected * 5) / STEP); i++) sim.step();
        expect(sim.period).not.toBeNull();
        expect(Math.abs(sim.period / expected - 1)).toBeLessThan(0.01);
      }
    }
    expect(period(1, 9.81)).toBeCloseTo(2.00606668, 7);
  });

  test("frame partitioning preserves the fixed-step trajectory and energy", () => {
    const a = new Experiment();
    const b = new Experiment();
    a.reset(true);
    b.reset(true);
    const initial = a.states.map((s) => energy(s, a.p));
    for (let i = 0; i < 600; i++) a.advance(1 / 60);
    for (let i = 0; i < 400; i++) b.advance(1 / 40);
    expect(a.steps).toBe(b.steps);
    expect(a.time).toBeCloseTo(10, 9);
    expect(a.states).toEqual(b.states);
    a.states.forEach((s, i) =>
      expect(Math.abs(energy(s, a.p) - initial[i]) / 30).toBeLessThan(0.00001),
    );
    expect(a.divergedAt).toBeGreaterThan(0);
    expect(a.divergedAt).toBeLessThan(10);
    expect(a.bottomPasses.every((n) => n > 0)).toBe(true);
    expect(a.trails.every((points) => points.length <= 1024)).toBe(true);
    expect(angleDistance(0.01, 2 * Math.PI + 0.01)).toBeLessThan(1e-12);
  });

  test("unequal masses and short arms stay finite and conserve energy for 60 seconds", () => {
    for (const options of [
      { l1: 0.25, l2: 0.25, m1: 0.25, m2: 2, start1: 170, start2: -170 },
      { l1: 1.5, l2: 0.25, m1: 2, m2: 0.25 },
      { l1: 0.25, l2: 1.5, m1: 0.25, m2: 2 },
    ]) {
      const sim = new Experiment(options);
      sim.reset(true);
      const initial = sim.states.map((s) => energy(s, sim.p));
      const scale = (sim.p.m1 + sim.p.m2) * sim.p.g * (sim.p.l1 + sim.p.l2);
      for (let i = 0; i < 60 / STEP; i++) sim.step();
      sim.states.forEach((s, i) => {
        expect(s.every(Number.isFinite)).toBe(true);
        expect(Math.abs(energy(s, sim.p) - initial[i]) / scale).toBeLessThan(0.001);
        const { upper, lower } = positions(s, sim.p);
        expect(Math.hypot(...upper)).toBeCloseTo(sim.p.l1, 10);
        expect(Math.hypot(lower[0] - upper[0], lower[1] - upper[1])).toBeCloseTo(sim.p.l2, 10);
      });
    }
  });

  test("the kit recipe fits the phone budget, and Reset holds the start pose", () => {
    const def = TOYS.find((t) => t.id === ID);
    expect(def.labs).toBe(true);
    expect(def.category).toBe("science");
    expect(recipe.controls.find((c) => c.key === "release").ease).toBeLessThan(5);
    for (const mode of ["double", "single"]) {
      const it = buildRecipe(
        recipe,
        { seed: 1, count: 7200, options: resolveOptions(recipe, { mode, l1: 0.25, l2: 1.5 }) },
        () => {},
      );
      let result = it.next();
      while (!result.done) result = it.next();
      const { kit, buf } = result.value;
      expect(buf.count).toBeLessThanOrEqual(7200 * 1.001); // Kit allocation rounds each shape.
      expect([...buf.pos.slice(0, buf.count * 3)].every(Number.isFinite)).toBe(true);
      const sim = kit.data.experiment;
      const start = structuredClone(sim.states);
      sim.reset(true);
      sim.advance(0.25);
      expect(sim.time).toBeGreaterThan(0);
      sim.reset();
      sim.advance(0.25);
      expect(sim.time).toBe(0);
      expect(sim.states).toEqual(start);
      expect(sim.divergedAt).toBeNull();
      expect(sim.bottomPasses).toEqual([0, 0]);
    }
  });
});

// Advance the player's actual drive clock deterministically for numerical
// readouts and proof. The stage still renders the pose normally afterward.
async function runSeconds(page, seconds) {
  await page.evaluate((seconds) => {
    const { player } = window.__splashery;
    player.frozen = false;
    for (let i = 0; i < seconds * 60; i++) player.update(1 / 60);
    player.frozen = true;
  }, seconds);
  await page.waitForTimeout(250);
}

test.describe("double-pendulum in the browser", () => {
  test.use({ viewport: { width: 390, height: 844 }, hasTouch: true });

  test("labs loads, touch releases without console errors, sound waits for a tap, and screenshots", async ({
    page,
  }) => {
    const errors = [];
    page.on("pageerror", (e) => errors.push(e.message));
    await page.goto("/?renderer=webgl2&profile=low&adapt=off&labs=1");
    await page.waitForSelector("body[data-ready='true']");
    await expect(page.locator(`[data-toy='${ID}']`)).toHaveCount(1);
    await page.evaluate(() => window.__splashery.app.chooseToy("double-pendulum"));
    await page.waitForLoadState("networkidle");
    // The allowed-file scope excludes a shelf thumbnail; its 404 fallback is
    // complete before checking console errors from the toy's tap and motion.
    page.on("console", (m) => {
      // This prototype cannot add assets/toys/.../thumb.webp under the task's
      // file allowlist. Accept only that known shelf-image fallback, including
      // its retry when the responsive shelf changes; keep all other errors.
      const thumbnail = /\/assets\/toys\/double-pendulum\/thumb\.webp(?:\?|$)/.test(
        m.location().url,
      );
      if (m.type() === "error" && !(thumbnail && m.text().includes("404"))) errors.push(m.text());
    });
    expect(
      await page.evaluate(() => window.__splashery.player.motion.ctx.kit.data.experiment.running),
    ).toBe(false);
    expect(await page.evaluate(() => window.__splashery.app.sound.scheduled)).toBe(0);
    await page.locator("#sound-toggle").tap();
    // The global sound switch has its own confirmation sound. Count only the
    // experiment's bottom ticks after that UI feedback.
    const scheduled = await page.evaluate(() => window.__splashery.app.sound.scheduled);
    await page.locator("#hands-play").tap();
    await expect
      .poll(() =>
        page.evaluate(() => window.__splashery.player.motion.ctx.kit.data.experiment.steps),
      )
      .toBeGreaterThan(0);
    await runSeconds(page, 6);
    const proof = await page.evaluate(() => {
      const { player, app } = window.__splashery;
      const sim = player.motion.ctx.kit.data.experiment;
      return {
        time: sim.time,
        divergedAt: sim.divergedAt,
        passes: sim.bottomPasses,
        scheduled: app.sound.scheduled,
        count: player.motion.ctx.buf.count,
        trails: sim.trails.map((a) => a.length),
      };
    });
    expect(proof.time).toBeGreaterThan(5);
    expect(proof.divergedAt).toBeGreaterThan(0);
    expect(proof.passes.every((n) => n > 0)).toBe(true);
    expect(proof.trails.every((n) => n > 100)).toBe(true);
    expect(proof.scheduled - scheduled).toBe(proof.passes[0] + proof.passes[1]);
    expect(proof.count).toBeLessThanOrEqual(7200 * 1.001);
    await expect(page.locator("#toy-legend")).toContainText("> 10° at");
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBe(390);
    await page.screenshot({ path: "tests/screenshots/proto-double-pendulum-390x844.png" });

    await page.setViewportSize({ width: 1440, height: 900 });
    await page.waitForTimeout(350);
    await page.screenshot({ path: "tests/screenshots/proto-double-pendulum-1440x900.png" });
    await page.setViewportSize({ width: 390, height: 844 });
    await page.locator("#sheet-toggle").tap();
    await page.locator("#tab-play").tap();
    await page.locator("#double-pendulum-reset").tap();
    const reset = await page.evaluate(() => {
      const sim = window.__splashery.player.motion.ctx.kit.data.experiment;
      return { time: sim.time, running: sim.running, divergedAt: sim.divergedAt };
    });
    expect(reset).toEqual({ time: 0, running: false, divergedAt: null });
    // Real native controls rebuild the experiment; both endpoint values work.
    const diff = page
      .getByText("Starting difference (rad)", { exact: true })
      .locator("..")
      .locator("input");
    await diff.fill("0.0001");
    await diff.dispatchEvent("change");
    await expect
      .poll(() =>
        page.evaluate(() => window.__splashery.player.motion.ctx.kit.data.experiment.p.difference),
      )
      .toBe(0.0001);
    await diff.fill("0.1");
    await diff.dispatchEvent("change");
    await expect
      .poll(() =>
        page.evaluate(() => window.__splashery.player.motion.ctx.kit.data.experiment.p.difference),
      )
      .toBe(0.1);
    expect(errors).toEqual([]);
  });

  test("one-arm mode shows a measured Earth period within 1% of 2.00607 seconds", async ({
    page,
  }) => {
    await page.goto("/?renderer=webgl2&profile=low&adapt=off&labs=1");
    await page.waitForSelector("body[data-ready='true']");
    await page.evaluate(() => window.__splashery.app.chooseToy("double-pendulum"));
    await page.locator("#sheet-toggle").tap();
    await page.locator("#tab-play").tap();
    await page
      .getByText("Experiment", { exact: true })
      .locator("..")
      .locator("select")
      .selectOption("single");
    await expect
      .poll(() =>
        page.evaluate(() => window.__splashery.player.motion.ctx.kit.data.experiment.p.mode),
      )
      .toBe("single");
    await page.locator("#toy-action").tap();
    await runSeconds(page, 5);
    await expect(page.locator("#double-pendulum-readout")).toContainText(
      "T = 2π√(L/g) = 2.00607 s",
    );
    await expect(page.locator("#double-pendulum-readout")).toContainText("Measured A: 2.00608 s");
    const measured = await page.evaluate(
      () => window.__splashery.player.motion.ctx.kit.data.experiment.period,
    );
    expect(Math.abs(measured / 2.00606668 - 1)).toBeLessThan(0.01);
  });
});
