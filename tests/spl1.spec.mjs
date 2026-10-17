// Lane SPL1, part 2 (docs/handoff/SPL1.md): toys honor the labs Splats
// slider. A toy that says it has drawn all it has (k.all) really has: twice
// the budget draws no more. A toy with fixed splat sizes shrinks them by
// k.shrink, so more splats make it sharper rather than thicker. The two
// viewers size their previews from the count the player passes.

import { test, expect } from "@playwright/test";
import { buildRecipe } from "../src/kit.js";
import { applyClay } from "../src/generators.js";
import { TOYS } from "../src/toys.js";
import { resolveOptions } from "../src/player.js";

async function build(id, count, shrink = 1) {
  const def = TOYS.find((t) => t.id === id);
  const recipe = (await import(`../src/packs/${def.pack}.js`)).RECIPES[id];
  const options = resolveOptions(recipe, {});
  await recipe.prepare?.(options, undefined, { profile: "max", count });
  const it = buildRecipe(recipe, { seed: 1, count, options, shrink }, applyClay);
  let r = it.next();
  while (!r.done) r = it.next();
  return r.value;
}

// Toys whose data runs out (a baked scan, a catalog, a map, a chart), and the
// count where it has.
const ALL = {
  "ammonite-agate": 400_000,
  "celestial-globe": 400_000,
  "nearby-stars": 60_000,
  "star-systems": 60_000,
  "powers-of-ten": 60_000,
  "gaussian-splatting": 60_000,
  "solar-orbits": 200_000,
  "baked-chest": 200_000,
  "video-3d": 400_000,
  "specimen-neuron": 200_000,
  "data-in-3d": 200_000,
  "cryoem-map": 400_000,
  "contour-lab": 200_000,
  "splat-equation": 200_000,
};

test("k.all: a toy that says it has drawn all it has draws no more at twice the budget", async () => {
  test.setTimeout(600_000);
  for (const [id, count] of Object.entries(ALL)) {
    const a = await build(id, count);
    expect(a.kit.all, id).toBe(true);
    const b = await build(id, count * 2);
    // (Small shares around the data, a dome or a floor, still grow a little.)
    expect(b.buf.count, `${id}: ${a.buf.count} then ${b.buf.count}`).toBeLessThanOrEqual(a.buf.count * 1.05); // prettier-ignore
  }
});

test("k.all: a toy that follows the count doesn't say it", async () => {
  for (const id of ["clock", "egg", "fish-school"]) {
    const a = await build(id, 400_000);
    expect(a.kit.all, id).toBe(false);
  }
});

test("fish school: its splats shrink by k.shrink, its count about stays", async () => {
  const mean = (buf) => {
    let s = 0;
    for (let i = 0; i < buf.count; i++) s += buf.scale[i * 3];
    return s / buf.count;
  };
  const shrink = Math.sqrt(280 / 400);
  const a = await build("fish-school", 400_000);
  const b = await build("fish-school", 400_000, shrink);
  // (Its bubbles stay as many as on the max tier, so a few hundred fewer splats.)
  expect(Math.abs(b.buf.count - a.buf.count)).toBeLessThan(a.buf.count * 0.002);
  expect(mean(b.buf) / mean(a.buf)).toBeCloseTo(shrink, 2);
});

async function open(page) {
  const errors = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.goto("/?renderer=webgl2&adapt=off&labs=1");
  await page.waitForSelector("body[data-ready='true']", { timeout: 180_000 });
  return errors;
}

async function show(page, id) {
  await page.evaluate((id) => window.__splashery.app.chooseToy(id), id);
  await page.waitForFunction(
    (id) => window.__splashery.player.toyInfo?.id === id && !window.__splashery.app.busy,
    id,
    { timeout: 180_000 },
  );
  return page.evaluate(() => {
    const { player } = window.__splashery;
    return {
      splats: player.toyInfo.splats,
      all: player.proc.ctx.kit.all,
      note: player.toyInfo.splatsNote || "",
    };
  });
}

for (const id of ["point-clouds", "splat-toolkit"]) {
  test(`${id}: its preview follows the slider, or says it shows every splat`, async ({ page }) => {
    const errors = await open(page);
    for (const n of [60_000, 400_000]) {
      await page.evaluate((n) => window.__splashery.app.setSplats(n), n);
      const r = await show(page, id);
      if (r.all) {
        expect(r.splats).toBeLessThanOrEqual(n * 1.02);
        if (r.splats < n * 0.98) expect(r.note).toBe(" (all this toy has)");
      } else {
        // The preview is picked before the build (its 97%, then an even pick
        // by cubes), so it may land a few percent under; the label says so.
        expect(Math.abs(r.splats - n), `${id} at ${n}: ${r.splats}`).toBeLessThanOrEqual(n * 0.06); // prettier-ignore
        if (Math.abs(r.splats - n) > n * 0.02) expect(r.note).toBe(" (the nearest this toy draws)");
      }
    }
    expect(errors).toEqual([]);
  });
}

test("Sound in a box: more beads only with the slider", async () => {
  const { buildRecipeTo } = await import("../src/kit.js");
  const recipe = (await import("../src/packs/studio.js")).RECIPES["chladni-cell"];
  const run = (gen) => {
    let r = gen.next();
    while (!r.done) r = gen.next();
    return r.value.buf.count;
  };
  const options = resolveOptions(recipe, {});
  // The max tier's 400,000 keeps 16,000 beads, as before.
  const tier = run(buildRecipe(recipe, { seed: 1, count: 400_000, options }, applyClay));
  expect(tier).toBe(31_460);
  // The slider's 400,000 lifts them to 28,000 (the label says how near it came).
  const slid = run(buildRecipeTo(recipe, { seed: 1, count: 400_000, options, slider: 400_000 }, applyClay)); // prettier-ignore
  expect(slid).toBe(tier + 12_000);
});

// The Operator's call of October 17, 2026: the slider goes down to 10,000,
// 2,000 a stop below 60,000.
test("the slider's 10k: its stops, its label, and a kit toy at 10,000", async ({ page }) => {
  const errors = await open(page);
  const { SPLATS_STOPS, SPLATS_RANGE } = await import("../src/player.js");
  expect(SPLATS_RANGE.min).toBe(10_000);
  expect(SPLATS_STOPS[0]).toBe(10_000);
  expect(SPLATS_STOPS[1] - SPLATS_STOPS[0]).toBe(2000);
  expect(SPLATS_STOPS.at(-1)).toBe(400_000);
  expect(SPLATS_STOPS).toContain(60_000);
  // Dragging to the first stop sets 10,000.
  await page.evaluate(() => {
    const s = document.getElementById("look-splats");
    s.value = "0";
    s.dispatchEvent(new Event("input"));
    s.dispatchEvent(new Event("change"));
  });
  await page.waitForFunction(() => window.__splashery.player.splats === 10_000);
  expect(await page.locator("#look-splats-value").textContent()).toBe("10k");
  const r = await show(page, "clock");
  expect(Math.abs(r.splats - 10_000)).toBeLessThanOrEqual(200);
  expect(r.note).toBe("");
  // A stored count keeps its place on the slider.
  await page.evaluate(() => window.__splashery.app.setSplats(24_000));
  await page.waitForFunction(() => window.__splashery.player.splats === 24_000);
  expect(await page.locator("#look-splats").inputValue()).toBe("7");
  expect(await page.locator("#look-splats-value").textContent()).toBe("24k");
  expect(errors).toEqual([]);
});
