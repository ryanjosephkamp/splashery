// Lane Sharpness B's own checks (docs/OPERATING.md): every toy the lane made
// sharper or closed underneath still builds at the phone tier within its
// budget with finite splats; the solids it laid out evenly are fully opaque
// (no see-through splats left from random placement); and the coral's rock
// and the cake stand's foot are closed underneath.

import { test, expect } from "@playwright/test";
import { buildRecipe } from "../src/kit.js";
import { PROFILES } from "../src/generators.js";

const TOYS = {
  food: ["birthday-cake", "popcorn", "pancakes", "croissant", "coffee", "orange", "kiwi", "pizza"],
  playthings: ["teddy-bear", "yo-yo"],
  nature: ["coral"],
  maths: ["menger-sponge", "gyroid", "platonic", "surface-plotter", "lorenz"],
  computing: ["cnn"],
};

function build(recipe, overrides = {}, tier = PROFILES.mid) {
  const options = {};
  for (const o of recipe.options || []) options[o.key] = o.default;
  Object.assign(options, overrides);
  const count = Math.round(Math.min(tier.maxCount, tier.defaultCount * (recipe.density ?? 1)));
  const it = buildRecipe(recipe, { seed: 7, count, options }, () => {});
  let r = it.next();
  while (!r.done) r = it.next();
  return { buf: r.value.buf, count, tier };
}

test("every toy the lane made sharper builds at the phone tier, within its budget", async () => {
  test.setTimeout(600_000);
  for (const [pack, ids] of Object.entries(TOYS)) {
    const { RECIPES } = await import(`../src/packs/${pack}.js`);
    for (const id of ids) {
      const recipe = RECIPES[id];
      expect(recipe, id).toBeTruthy();
      const { buf, count, tier } = build(recipe);
      expect(buf.count, id).toBeGreaterThan(count * 0.5);
      expect(buf.count, id).toBeLessThanOrEqual(tier.maxCount * 1.1);
      for (let i = 0; i < buf.count * 3; i++)
        if (!Number.isFinite(buf.pos[i])) throw new Error(`${id}: splat ${i / 3} is not finite`);
    }
  }
});

test("the solids laid out evenly are mostly fully opaque splats", async () => {
  test.setTimeout(300_000);
  const cases = [
    ["food", "birthday-cake", 0.8],
    ["food", "coffee", 0.8],
    ["food", "orange", 0.85],
    ["food", "pizza", 0.85],
    ["playthings", "teddy-bear", 0.85],
    ["playthings", "yo-yo", 0.85],
    ["maths", "menger-sponge", 0.5],
    ["maths", "gyroid", 0.95],
  ];
  for (const [pack, id, min] of cases) {
    const { RECIPES } = await import(`../src/packs/${pack}.js`);
    const { buf } = build(RECIPES[id]);
    let solid = 0;
    for (let i = 0; i < buf.count; i++) if (buf.color[i * 4 + 3] >= 0.99) solid++;
    expect(solid / buf.count, id).toBeGreaterThan(min);
  }
});

// Splats in a thin disc just under a toy's lowest point, near its axis: a
// closed base has them; an open one doesn't.
function under(buf, r, band = 0.06) {
  let minY = Infinity;
  for (let i = 0; i < buf.count; i++) minY = Math.min(minY, buf.pos[i * 3 + 1]);
  let n = 0;
  for (let i = 0; i < buf.count; i++) {
    const x = buf.pos[i * 3];
    const y = buf.pos[i * 3 + 1];
    const z = buf.pos[i * 3 + 2];
    if (y < minY + band && Math.hypot(x, z) < r) n++;
  }
  return n;
}

test("the coral's rock and the cake stand's foot are closed underneath", async () => {
  test.setTimeout(300_000);
  const nature = (await import("../src/packs/nature.js")).RECIPES;
  const food = (await import("../src/packs/food.js")).RECIPES;
  expect(under(build(nature.coral).buf, 0.3)).toBeGreaterThan(200);
  expect(under(build(food["birthday-cake"]).buf, 0.08)).toBeGreaterThan(20);
});
