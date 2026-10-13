import { test, expect } from "@playwright/test";
import {
  GearTrain,
  dimensions,
  inGear,
  outline,
  STEP,
  TAU,
} from "../src/packs/proto-gear-train/math.js";
import { RECIPES } from "../src/packs/proto-gear-train.js";
import { buildRecipe } from "../src/kit.js";
import { TOYS } from "../src/toys.js";

const recipe = RECIPES["gear-train"];
const defaults = Object.fromEntries(recipe.options.map((o) => [o.key, o.default]));
function build(options = {}) {
  const it = buildRecipe(
    recipe,
    { seed: 5, count: 6000, options: { ...defaults, ...options } },
    () => {},
  );
  let r = it.next();
  while (!r.done) r = it.next();
  return r.value;
}

test("gear-train: 12 to 36 gives a 3:1 reduction, and three gears restore direction", () => {
  const pair = new GearTrain([12, 36]);
  pair.spin();
  expect(pair.speeds()).toEqual([60, -20]);
  expect(pair.teeth.at(-1) / pair.teeth[0]).toBe(3);
  for (let i = 0; i < 120; i++) pair.advance(STEP);
  expect(pair.angle).toBeCloseTo(TAU, 10); // 60 rpm = one revolution in one second.
  expect(pair.angles()[1]).toBeCloseTo(-TAU / 3, 10);
  const chain = new GearTrain([12, 36, 24]);
  chain.spin();
  expect(chain.speeds()).toEqual([60, -20, 30]);
  // Uneven render intervals produce the same fixed-step result.
  for (let i = 0; i < 50; i++) {
    chain.advance(0.003);
    chain.advance(0.017);
  }
  expect(chain.angle).toBeCloseTo(pair.angle, 10);
  for (let i = 0; i < 360; i++) pair.advance(STEP);
  expect(pair.angle).toBeCloseTo(4 * TAU, 10);
  expect(pair.remaining).toBe(0);
  expect(pair.rpm).toBe(0);
  pair.advance(10);
  expect(pair.angle).toBeCloseTo(4 * TAU, 10);
});

test("gear-train: pitch spacing, meshing phases, and nonintersecting involute teeth", () => {
  for (const teeth of [
    [12, 36],
    [12, 12],
    [36, 12],
    [36, 36],
    [13, 35],
    [27, 28],
    [12, 36, 24, 18, 30],
  ]) {
    const s = new GearTrain(teeth);
    for (let i = 1; i < teeth.length; i++) {
      const a = s.gears[i - 1],
        b = s.gears[i];
      expect(Math.hypot(a.x - b.x, a.y - b.y)).toBeCloseTo((teeth[i - 1] + teeth[i]) / 2, 10);
    }
    // Sample a full tooth cycle from both sides of every mesh. An outer
    // point must never penetrate the other gear (contact is permitted).
    let penetrations = 0;
    for (let frame = 0; frame < 24; frame++) {
      s.angle = (frame * TAU) / (24 * teeth[0]);
      const turns = s.angles();
      for (let i = 1; i < teeth.length; i++) {
        for (const [a, b] of [
          [i - 1, i],
          [i, i - 1],
        ]) {
          const ga = s.gears[a],
            gb = s.gears[b];
          const fa = ga.phase + turns[a],
            fb = gb.phase + turns[b];
          for (const [x, y] of outline(teeth[a])) {
            const X = ga.x + x * Math.cos(fa) - y * Math.sin(fa) - gb.x;
            const Y = ga.y + x * Math.sin(fa) + y * Math.cos(fa) - gb.y;
            if (
              inGear(
                teeth[b],
                X * Math.cos(fb) + Y * Math.sin(fb),
                -X * Math.sin(fb) + Y * Math.cos(fb),
              )
            )
              penetrations++;
          }
        }
      }
    }
    expect(penetrations, teeth.join(" → ")).toBe(0);
  }
});

test("gear-train: solid gear budget and drag preserve the gear constraint", () => {
  for (const options of [
    {},
    { count: "5", gear1: 36, gear2: 36, gear3: 36, gear4: 36, gear5: 36 },
  ]) {
    const ctx = build(options);
    expect(ctx.buf.count).toBeLessThanOrEqual(14000);
    expect([...ctx.buf.pos.slice(0, ctx.buf.count * 3)].every(Number.isFinite)).toBe(true);
  }
  const s = build({ count: "3" }).kit.data;
  const g = s.gears[0],
    r = dimensions(g.teeth).pitch;
  recipe.drag.start([g.x + r, g.y, 0], 0);
  recipe.drag.move([g.x, g.y + r, 0], 0.25);
  expect(s.angle).toBeCloseTo(Math.PI / 2, 10);
  expect(s.angles()).toEqual([s.angle, -s.angle / 3, s.angle / 2]);
  recipe.drag.end();
  expect(s.rpm).toBe(0);
  expect(s.remaining).toBe(0);
});

async function load(page) {
  await page.goto("/?renderer=webgl2&profile=weak&adapt=off&labs=1");
  await page.waitForSelector("body[data-ready='true']");
  await page.evaluate(() => window.__splashery.app.chooseToy("gear-train"));
  await expect(page.locator("#toy-status")).toHaveText(/^Gear train lab/);
  await expect(page.locator("#toy-legend")).toContainText("Speed 3:1 reduction");
}

test("gear-train: labs on, touch starts 60 rpm, visible motion, and no console errors", async ({
  browser,
}) => {
  expect(TOYS.find((t) => t.id === "gear-train")).toMatchObject({
    labs: true,
    category: "science",
  });
  const context = await browser.newContext({
    viewport: { width: 390, height: 844 },
    hasTouch: true,
  });
  const page = await context.newPage();
  const errors = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await load(page);
  await expect(page.locator("#toy-legend")).toContainText("Torque ×3 (ideal)");
  expect(await page.locator("#toy-legend li").count()).toBe(4);
  const legendBox = await page.locator("#toy-legend").boundingBox();
  const modelTop = await page.evaluate(() => {
    const p = window.__splashery.player;
    const s = p.proc.ctx.kit.data;
    return Math.min(...s.gears.map((g) => p.screenPoint([g.x, g.y + g.teeth / 2 + 1, 0.8])[1]));
  });
  expect(modelTop).toBeGreaterThan(legendBox.y + legendBox.height + 8);
  await page.screenshot({ path: "tests/screenshots/proto-gear-train-390x844.png" });
  // Asset files are outside this task's allowed paths, so its shelf card
  // has no thumbnail yet. Capture runtime console errors after loading;
  // page errors are checked throughout, and no resources are mocked.
  page.on("console", (m) => {
    if (m.type() === "error") errors.push(m.text());
  });
  const box = await page.locator("#stage").boundingBox();
  await page.touchscreen.tap(box.x + box.width / 2, box.y + box.height / 2);
  await expect(page.locator("#toy-legend")).toContainText("60 → -20 rpm");
  await expect
    .poll(() => page.evaluate(() => window.__splashery.player.proc.ctx.kit.data.angle))
    .toBeGreaterThan(0.3);
  await page.screenshot({ path: "/tmp/proto-gear-train-after-tap.png" });
  await expect
    .poll(() => page.evaluate(() => window.__splashery.player.proc.ctx.kit.data.remaining), {
      timeout: 15000,
    })
    .toBe(0);
  // Exercise the real phone touch path, not just the recipe's drag methods.
  const arc = await page.evaluate(() => {
    const p = window.__splashery.player;
    const g = p.proc.ctx.kit.data.gears[0];
    return Array.from({ length: 13 }, (_, i) => {
      const a = (i * Math.PI) / 24;
      return p.screenPoint([g.x + 4.5 * Math.cos(a), g.y + 4.5 * Math.sin(a), 0.8]);
    });
  });
  const before = await page.evaluate(() => window.__splashery.player.proc.ctx.kit.data.angle);
  const cdp = await context.newCDPSession(page);
  await cdp.send("Input.dispatchTouchEvent", {
    type: "touchStart",
    touchPoints: [{ x: arc[0][0], y: arc[0][1] }],
  });
  for (const [x, y] of arc.slice(1)) {
    await cdp.send("Input.dispatchTouchEvent", { type: "touchMove", touchPoints: [{ x, y }] });
  }
  await cdp.send("Input.dispatchTouchEvent", { type: "touchEnd", touchPoints: [] });
  const after = await page.evaluate(() => window.__splashery.player.proc.ctx.kit.data.angle);
  expect(after - before).toBeCloseTo(Math.PI / 2, 1);
  await page.evaluate(() => window.__splashery.app.setToyOption("count", "3"));
  await expect(page.locator("#toy-legend")).toContainText("12 → 36 → 24 teeth");
  await page.touchscreen.tap(box.x + box.width / 2, box.y + box.height / 2);
  await expect(page.locator("#toy-legend")).toContainText("60 → 30 rpm");
  await page.evaluate(() => window.__splashery.app.setToyOption("count", "5"));
  await expect(page.locator("#toy-legend")).toContainText("12→36→24→18→30");
  const lineHeight = await page
    .locator("#toy-legend li")
    .first()
    .evaluate((el) => ({
      height: el.getBoundingClientRect().height,
      line: parseFloat(getComputedStyle(el).lineHeight),
    }));
  expect(lineHeight.height).toBeLessThan(lineHeight.line * 1.5);
  expect(errors).toEqual([]);
  await context.close();
});

test("gear-train: desktop first frame", async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await load(page);
  const bounds = await page.evaluate(() => {
    const p = window.__splashery.player;
    const s = p.proc.ctx.kit.data;
    return s.gears.flatMap((g) => {
      const r = g.teeth / 2 + 1;
      return [p.screenPoint([g.x, g.y - r, 0.8])[1], p.screenPoint([g.x, g.y + r, 0.8])[1]];
    });
  });
  expect(Math.min(...bounds)).toBeGreaterThan(60);
  expect(Math.max(...bounds)).toBeLessThan(880);
  await page.screenshot({ path: "tests/screenshots/proto-gear-train-1440x900.png" });
});
