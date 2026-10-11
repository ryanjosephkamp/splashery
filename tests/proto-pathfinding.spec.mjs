import { test, expect } from "@playwright/test";
import { buildRecipe } from "../src/kit.js";
import { RECIPES } from "../src/packs/proto-pathfinding.js";
import {
  CELLS,
  SIDE,
  STEP,
  manhattan,
  maze,
  search,
  spring,
} from "../src/packs/proto-pathfinding/search.js";
import { TOYS, onShelf } from "../src/toys.js";

const recipe = RECIPES.pathfinding;
const controls = () => Object.fromEntries(recipe.controls.map((c) => [c.key, c.default ?? 0]));
function build(seed = 7) {
  const iterator = buildRecipe(recipe, { seed, count: 6000, options: {} }, () => {});
  let result = iterator.next();
  while (!result.done) result = iterator.next();
  return result.value.kit.data;
}
function frame(data, time, c, tap = null) {
  const out = { parts: {}, cues: [] };
  recipe.drive(time, c, out, { time, data, tap });
  return out;
}

// Independent distance oracle: repeatedly relax every open edge until the
// distance field stops changing. It uses no priority queue or toy helpers.
function shortest(walls, goal) {
  const distance = Array(CELLS).fill(Infinity);
  distance[0] = 0;
  for (let pass = 0; pass < CELLS; pass++) {
    for (let i = 0; i < CELLS; i++) {
      if (walls[i]) continue;
      for (const j of [i - 1, i + 1, i - SIDE, i + SIDE]) {
        if (j < 0 || j >= CELLS || walls[j]) continue;
        if (Math.abs(i - j) === 1 && Math.floor(i / SIDE) !== Math.floor(j / SIDE)) continue;
        distance[j] = Math.min(distance[j], distance[i] + 1);
      }
    }
  }
  return Number.isFinite(distance[goal]) ? distance[goal] : null;
}

test("pathfinding: labs shelf, fixed seed, and optimal path math", () => {
  const toy = TOYS.find((t) => t.id === "pathfinding");
  expect(toy).toMatchObject({ category: "computing", labs: true, pack: "proto-pathfinding" });
  expect(onShelf(toy)).toBe(false);
  const walls = maze(7, 0.3);
  const results = [0, 1, 2].map((a) => search(walls, 48, a));
  expect(results.map((r) => r.length)).toEqual([12, 12, 12]);
  expect(results.map((r) => r.visited)).toEqual([35, 35, 14]);
  expect(results[2].visited).toBeLessThanOrEqual(results[1].visited);
  expect(manhattan(0, 48)).toBe(12);
  for (let seed = 1; seed <= 64; seed++) {
    const mask = maze(seed, (seed % 6) / 10);
    const goal = 48;
    for (let a = 0; a < 3; a++) {
      const result = search(mask, goal, a);
      expect(result.length, `seed ${seed}, search ${a}`).toBe(shortest(mask, goal));
      expect(new Set(result.events.map((e) => e.cell)).size).toBe(result.visited);
      result.path.forEach((cell, i) => {
        expect(mask[cell]).toBe(false);
        if (i) expect(manhattan(cell, result.path[i - 1])).toBe(1);
      });
    }
  }
  expect(search(maze(42, 0.3), 48, 2).length).toBeNull();
  for (let a = 0; a < 3; a++) {
    expect(search(Array(CELLS).fill(false), 0, a)).toMatchObject({ length: 0, visited: 1 });
  }
});

test("pathfinding: stable fixed steps, final counters, and one blip per expanded node", () => {
  let y = 0;
  let v = 0;
  for (let i = 0; i < 120; i++) [y, v] = spring(y, v, 1, STEP, 4);
  // y(t) = 1 - (1 + omega*t) exp(-omega*t), initially y = v = 0.
  expect(y).toBeCloseTo(1 - 5 * Math.exp(-4), 12);
  expect(v).toBeCloseTo(16 * Math.exp(-4), 12);
  const finishes = [];
  for (const fps of [30, 60, 120]) {
    const data = build();
    const c = { ...controls(), speed: 0 };
    expect(frame(data, 0, c).cues).toEqual([]);
    frame(data, 0, c, { n: 1, key: "race" });
    const blips = [];
    let out;
    for (let n = 1; n <= fps * 5; n++) {
      out = frame(data, n / fps, c, { n: 1, key: "race" });
      blips.push(...out.cues.flat());
      expect(out.levers.flat().every(Number.isFinite)).toBe(true);
    }
    expect(data.running).toBe(false);
    expect(data.elapsed).toBeLessThan(4.3);
    expect(data.progress).toEqual([35, 35, 14]);
    expect(out.legend.items.map((i) => i.text).join(" ")).toContain("35 visited · 12 steps");
    expect(blips).toHaveLength(84);
    expect(blips.every((s) => s.voice === "tone" && s.f >= 260 && s.f <= 620 && s.to === 1)).toBe(
      true,
    );
    expect(data.runs.every((r) => r.length === 12)).toBe(true);
    finishes.push(data.lifts.flat());
    // A repeat tap starts a fresh race, without inheriting a finished path.
    frame(data, 5, c, { n: 2, key: "race" });
    expect(data.progress).toEqual([0, 0, 0]);
    expect(data.running).toBe(true);
  }
  finishes[0].forEach((value, i) => expect(value).toBeCloseTo(finishes[2][i], 10));
});

test("pathfinding: wall density and goal dragging reset the comparison", () => {
  const data = build();
  const c = controls();
  frame(data, 0, c);
  const previous = data.walls.slice();
  frame(data, 0.1, { ...c, density: 1 });
  expect(data.walls.filter(Boolean).length).toBeGreaterThan(previous.filter(Boolean).length);
  frame(data, 0.2, { ...c, density: 0 });
  expect(data.walls.some(Boolean)).toBe(false);
  expect(recipe.drag.at([3, 1, 3])).toBe(true);
  recipe.drag.start();
  recipe.drag.move([0, 1, 0]);
  recipe.drag.end();
  expect(data.goal).toBe(24);
  frame(data, 0.3, { ...c, density: 0 }, { n: 1, key: "race" });
  expect(data.runs.map((r) => r.length)).toEqual([6, 6, 6]);
  frame(data, 0.4, { ...c, density: 1 });
  const blocked = data.walls.findIndex(Boolean);
  recipe.drag.start();
  recipe.drag.move([(blocked % SIDE) - 3, 1, Math.floor(blocked / SIDE) - 3]);
  recipe.drag.end();
  expect(data.goal).toBe(24);
  expect(data.runs).toBeNull();
});

for (const [width, height] of [
  [390, 844],
  [1440, 900],
]) {
  test(`pathfinding: labs load, touch race, controls, and ${width}x${height} screenshot`, async ({
    browser,
  }) => {
    const context = await browser.newContext({
      viewport: { width, height },
      ...(width === 390 ? { hasTouch: true, isMobile: true } : {}),
    });
    const page = await context.newPage();
    const errors = [];
    const pageErrors = [];
    page.on("pageerror", (e) => pageErrors.push(e.message));
    page.on("console", (m) => {
      if (m.type() === "error") errors.push(m.text());
    });
    await page.goto("/?labs=1&renderer=webgl2&profile=low");
    await page.waitForSelector("body[data-ready='true']", { timeout: 180_000 });
    await page.evaluate(() => window.__splashery.app.chooseToy("pathfinding"));
    await expect(page.locator("#toy-status")).toHaveText(/^Pathfinding race/, { timeout: 180_000 });
    await expect(page.locator("#toy-legend")).toContainText("Tap to race");
    expect(await page.evaluate(async () => (await import("/src/toys.js")).labsOn())).toBe(true);
    expect(await page.evaluate(() => window.__splashery.app.sound.ctx === null)).toBe(true);
    await page.waitForTimeout(1000);
    // Loading the shelf can request a missing prototype thumbnail. Check
    // console errors for the tap itself, after shelf requests have settled.
    errors.length = 0;
    await page.locator("#sound-toggle").click();
    const scheduledBefore = await page.evaluate(() => window.__splashery.app.sound.scheduled);
    const tapAt = await page.evaluate(() => window.__splashery.player.screenPoint([0, 0.2, 3]));
    if (width === 390) await page.touchscreen.tap(tapAt[0], tapAt[1]);
    else await page.mouse.click(tapAt[0], tapAt[1]);
    await expect
      .poll(() => page.evaluate(() => window.__splashery.player.motion.ctx.kit.data.progress[0]))
      .toBeGreaterThan(0);
    await expect
      .poll(() => page.evaluate(() => window.__splashery.player.motion.ctx.kit.data.running), {
        timeout: 30_000,
      })
      .toBe(false);
    await expect(page.locator("#toy-legend")).toContainText("35 visited · 12 steps");
    await expect(page.locator("#toy-legend")).toContainText("14 visited · 12 steps");
    await page.screenshot({ path: `tests/screenshots/proto-pathfinding-${width}x${height}.png` });
    // Move the goal one cell left and back through real pointer gestures.
    const drag = async (from, to) => {
      const points = await page.evaluate(
        ([a, b]) => [
          window.__splashery.player.screenPoint(a),
          window.__splashery.player.screenPoint(b),
        ],
        [from, to],
      );
      if (width === 390) {
        const client = await context.newCDPSession(page);
        const event = (type, x, y) =>
          client.send("Input.dispatchTouchEvent", {
            type,
            touchPoints: type === "touchEnd" ? [] : [{ x, y }],
          });
        await event("touchStart", ...points[0]);
        await page.waitForTimeout(250);
        for (let i = 1; i <= 8; i++) {
          await event(
            "touchMove",
            points[0][0] + ((points[1][0] - points[0][0]) * i) / 8,
            points[0][1] + ((points[1][1] - points[0][1]) * i) / 8,
          );
          await page.waitForTimeout(60);
        }
        await event("touchEnd", ...points[1]);
        await client.detach();
      } else {
        await page.mouse.move(...points[0]);
        await page.mouse.down();
        await page.waitForTimeout(250);
        await page.mouse.move(...points[1], { steps: 8 });
        await page.mouse.up();
      }
    };
    await drag([3, 1.1, 3], [2, 1.1, 3]);
    await expect
      .poll(() => page.evaluate(() => window.__splashery.player.motion.ctx.kit.data.goal))
      .toBe(47);
    await drag([2, 1.1, 3], [3, 1.1, 3]);
    await expect
      .poll(() => page.evaluate(() => window.__splashery.player.motion.ctx.kit.data.goal))
      .toBe(48);
    // UI sliders, not only internal hooks, must be reachable on the phone.
    if (width === 390) await page.locator("#sheet-toggle").click();
    await page.locator("#tab-play").click();
    await expect(page.locator("#pathfinding-new-maze")).toBeVisible();
    const generations = await page.evaluate(
      () => window.__splashery.player.motion.ctx.kit.data.generation,
    );
    await page.locator("#pathfinding-new-maze").click();
    await expect
      .poll(() => page.evaluate(() => window.__splashery.player.motion.ctx.kit.data.generation))
      .toBe(generations + 1);
    await page.locator("#ctl-density").evaluate((el) => {
      el.value = "0";
    });
    await page.locator("#ctl-density").dispatchEvent("input");
    await page.locator("#ctl-speed").evaluate((el) => {
      el.value = "50";
    });
    await page.locator("#ctl-speed").dispatchEvent("input");
    await expect
      .poll(() => page.evaluate(() => window.__splashery.player.motion.ctx.kit.data.density))
      .toBe(0);
    // The button also runs the race and keeps its sounds in sync.
    await page.locator("#toy-action").click();
    await expect
      .poll(() => page.evaluate(() => window.__splashery.player.motion.ctx.kit.data.progress[0]))
      .toBeGreaterThan(0);
    await expect
      .poll(() => page.evaluate(() => window.__splashery.player.motion.ctx.kit.data.running), {
        timeout: 30_000,
      })
      .toBe(false);
    expect(
      await page.evaluate(() =>
        window.__splashery.player.motion.ctx.kit.data.runs.map((r) => r.length),
      ),
    ).toEqual([12, 12, 12]);
    expect(await page.evaluate(() => window.__splashery.app.sound.scheduled)).toBeGreaterThan(
      scheduledBefore,
    );
    // Close the Toy tab so the on-stage readout and touch target can be seen.
    if (width === 390) await page.locator("#sheet-toggle").click();
    await expect(page.locator("#toy-legend")).toContainText("49 visited · 12 steps");
    await expect(page.locator("#toy-legend")).toContainText("13 visited · 12 steps");
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(
      true,
    );
    expect(pageErrors).toEqual([]);
    expect(errors).toEqual([]);
    await context.close();
  });
}
