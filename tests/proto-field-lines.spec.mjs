import { test, expect } from "@playwright/test";
import { TOYS, onShelf } from "../src/toys.js";
import { RECIPES } from "../src/packs/proto-field-lines.js";
import {
  K,
  SOURCE_Q,
  TEST_Q,
  TEST_MASS,
  DT,
  RADIUS,
  dipole,
  fieldAt,
  fieldLines,
  verlet,
  norm,
  sub,
} from "../src/packs/proto-field-lines/physics.js";

const recipe = RECIPES["field-lines"];

test("field-lines: Coulomb field at 1 m agrees within 0.5%, and superposition preserves sign", () => {
  const positive = [{ p: [0, 0, 0], q: SOURCE_Q }];
  const e = fieldAt([1, 0, 0], positive);
  expect(Math.abs(norm(e) / (K * SOURCE_Q) - 1)).toBeLessThan(0.005);
  expect(e[0]).toBeGreaterThan(0);
  expect(e[1]).toBe(0);
  expect(norm(fieldAt([2, 0, 0], positive))).toBeCloseTo(norm(e) / 4, 10);
  expect(fieldAt([0, 0, 0], dipole())[0]).toBeGreaterThan(0);
  expect(
    norm(
      fieldAt(
        [0, 0, 0],
        [
          { p: [-1, 0, 0], q: SOURCE_Q },
          { p: [1, 0, 0], q: SOURCE_Q },
        ],
      ),
    ),
  ).toBeCloseTo(0, 10);
});

test("field-lines: dipole strokes start on positive and end on negative, with field-aligned tangents", () => {
  const charges = dipole();
  const lines = fieldLines(charges);
  expect(lines.length).toBe(12);
  for (const line of lines) {
    expect(line.start).toBe(0);
    expect(line.end).toBe(1);
    expect(norm(sub(line.points[0], charges[0].p))).toBeCloseTo(RADIUS, 6);
    expect(norm(sub(line.points.at(-1), charges[1].p))).toBeCloseTo(RADIUS, 6);
    const i = Math.floor(line.points.length / 2);
    const tangent = sub(line.points[i + 1], line.points[i - 1]);
    const field = fieldAt(line.points[i], charges);
    const dot = tangent.reduce((s, x, j) => s + x * field[j], 0);
    expect(dot / (norm(tangent) * norm(field))).toBeGreaterThan(0.999);
  }
  const sameSign = dipole().map((c) => ({ ...c, q: SOURCE_Q }));
  for (const line of fieldLines(sameSign)) expect(line.end).toBeNull();
  // With only negative sources, arrows still point inward.
  const negative = [{ p: [0, 0, 0], q: -SOURCE_Q }];
  for (const line of fieldLines(negative)) {
    expect(line.end).toBe(0);
    expect(norm(line.points[0])).toBeGreaterThan(norm(line.points.at(-1)));
  }
});

test("field-lines: fixed-step Verlet converges and conserves point-charge energy", () => {
  const charges = [{ p: [0, 0, 0], q: SOURCE_Q }];
  const run = (dt) => {
    let state = { p: [1, 0, 0], v: [0, 0, 0] };
    for (let i = 0; i < Math.round(0.5 / dt); i++) state = verlet(state.p, state.v, charges, dt);
    return state;
  };
  const a = run(DT),
    b = run(DT / 2);
  expect(norm(sub(a.p, b.p))).toBeLessThan(1e-6);
  const initial = K * SOURCE_Q * TEST_Q;
  const energy = (TEST_MASS * norm(a.v) ** 2) / 2 + initial / norm(a.p);
  expect(Math.abs(energy / initial - 1)).toBeLessThan(1e-5);
  expect(a.p[0]).toBeGreaterThan(1.1);
  expect(recipe.controls.find((c) => c.key === "release").ease).toBeLessThan(5);
});

async function load(page, viewport) {
  await page.setViewportSize(viewport);
  await page.goto("/?renderer=webgl2&profile=weak&labs=1");
  await page.waitForSelector("body[data-ready='true']", { timeout: 180_000 });
  await page.evaluate(async () => {
    const { app, player } = window.__splashery;
    await app.chooseToy("field-lines");
    player.opts.idleDelay = 1e9;
    player.idle.weight = 0;
  });
  await expect(page.locator("#toy-status")).toHaveText(/^Electric field lines/);
  await expect(page.locator("#toy-legend")).toContainText("N/C");
  expect(
    await page.evaluate(async () => {
      const { labsOn, onShelf, findToy } = await import("/src/toys.js");
      return labsOn() && onShelf(findToy("field-lines"));
    }),
  ).toBe(true);
}

// Project a recipe point to an actual touch position, including stage framing.
async function screenPoint(page, point) {
  return page.evaluate(async (point) => {
    const { player } = window.__splashery;
    const [x, y] = player.screenPoint(point);
    const box = document.querySelector("#stage").getBoundingClientRect();
    return { x: box.x + x, y: box.y + y };
  }, point);
}

async function tap(page, point) {
  const p = await screenPoint(page, point);
  await page.touchscreen.tap(p.x, p.y);
}

test.describe("field-lines: browser and touch", () => {
  test.use({ hasTouch: true });

  test("loads behind labs, a center tap releases without errors, and the phone frames stay clear", async ({
    page,
  }) => {
    const problems = [];
    page.on("pageerror", (e) => problems.push(e.message));

    expect(TOYS.find((t) => t.id === "field-lines")).toMatchObject({
      labs: true,
      category: "atoms",
      kind: "kit",
    });
    expect(onShelf(TOYS.find((t) => t.id === "field-lines"))).toBe(false);
    await load(page, { width: 390, height: 844 });
    // Watch runtime errors after load; the permitted file scope excludes a
    // shelf thumbnail, so its missing image request is outside this check.
    page.on("console", (m) => {
      if (m.type() === "error") problems.push(m.text());
    });
    await page.waitForTimeout(800);
    await page.screenshot({ path: "tests/screenshots/proto-field-lines-390x844.png" });
    const before = await page.evaluate(
      () => window.__splashery.player.motion.out.parts.test.offset,
    );
    // Touch the open center, rather than the action button or the bead.
    await tap(page, [0, 0, 0]);
    await expect
      .poll(() => page.evaluate(() => window.__splashery.player.motion.tap?.key))
      .toBe("release");
    await expect
      .poll(() =>
        page.evaluate((before) => {
          const p = window.__splashery.player.motion.out.parts.test.offset;
          return Math.hypot(...p.map((x, i) => x - before[i]));
        }, before),
      )
      .toBeGreaterThan(0.1);
    await page.screenshot({ path: "tests/screenshots/proto-field-lines-390x844-after-tap.png" });
    const legend = await page.locator("#toy-legend").boundingBox();
    const model = await screenPoint(page, [-0.65, 0, 0]);
    expect(legend.y + legend.height).toBeLessThan(model.y - 35);
    const probe = await screenPoint(page, [0, 0.82, 0.18]);
    expect(legend.y + legend.height).toBeLessThan(probe.y - 15);
    const left = await screenPoint(page, [-0.81, 0, 0]);
    const right = await screenPoint(page, [0.81, 0, 0]);
    expect(right.x - left.x).toBeGreaterThan(390 * 0.75);
    expect(await page.locator("#toy-legend li").count()).toBe(3);
    expect(await page.evaluate(() => window.__splashery.player.toyInfo.splats)).toBeLessThan(15000);
    await page.waitForTimeout(4500);
    expect(
      await page.evaluate(() => window.__splashery.player.motion.out.parts.test.offset),
    ).toEqual(before);
    expect(problems).toEqual([]);
  });

  test("the one-charge preset shows 8.988 N/C; charge flips, drags, and drops update the field", async ({
    page,
  }) => {
    const problems = [];
    page.on("pageerror", (e) => problems.push(e.message));
    await load(page, { width: 390, height: 844 });
    await page.evaluate(() => window.__splashery.app.setToyOption("preset", "single"));
    await expect(page.locator("#toy-legend")).toContainText("Probe: 8.988 N/C");
    await tap(page, [0, 0, 0]);
    await expect
      .poll(() => page.evaluate(() => window.__splashery.player.motion.ctx.kit.data.charges[0].q))
      .toBeLessThan(0);
    const start = await screenPoint(page, [0, 0, 0]);
    const end = await screenPoint(page, [0.45, -0.3, 0]);
    const session = await page.context().newCDPSession(page);
    await session.send("Input.dispatchTouchEvent", {
      type: "touchStart",
      touchPoints: [{ x: start.x, y: start.y }],
    });
    for (let i = 1; i <= 8; i++) {
      await session.send("Input.dispatchTouchEvent", {
        type: "touchMove",
        touchPoints: [
          { x: start.x + ((end.x - start.x) * i) / 8, y: start.y + ((end.y - start.y) * i) / 8 },
        ],
      });
      await page.waitForTimeout(35);
    }
    await session.send("Input.dispatchTouchEvent", { type: "touchEnd", touchPoints: [] });
    await expect
      .poll(() =>
        page.evaluate(() => window.__splashery.player.motion.ctx.kit.data.charges[0].p[0]),
      )
      .toBeGreaterThan(0.25);
    await expect
      .poll(() => page.evaluate(() => window.__splashery.player.chunks?.splats() || 0))
      .toBeGreaterThan(0);
    await page.evaluate(() => window.__splashery.app.setToyOption("tool", "positive"));
    await tap(page, [-0.65, -0.45, 0]);
    await expect
      .poll(() => page.evaluate(() => window.__splashery.player.motion.ctx.kit.data.charges.length))
      .toBe(2);
    await page.evaluate(() => window.__splashery.app.setToyOption("tool", "negative"));
    await tap(page, [-0.65, 0.55, 0]);
    await expect
      .poll(() => page.evaluate(() => window.__splashery.player.motion.ctx.kit.data.charges.length))
      .toBe(3);
    await tap(page, [0.65, 0.55, 0]);
    await expect
      .poll(() => page.evaluate(() => window.__splashery.player.motion.ctx.kit.data.charges.length))
      .toBe(4);
    await tap(page, [0, -0.7, 0]);
    expect(
      await page.evaluate(() => window.__splashery.player.motion.ctx.kit.data.charges.length),
    ).toBe(4);
    expect(problems).toEqual([]);
  });

  test("desktop proof at 1440x900", async ({ page }) => {
    await load(page, { width: 1440, height: 900 });
    await page.waitForTimeout(700);
    await page.screenshot({ path: "tests/screenshots/proto-field-lines-1440x900.png" });
  });
});
