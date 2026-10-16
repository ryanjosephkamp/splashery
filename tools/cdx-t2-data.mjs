// Task 66: default-option measurements for the three open shelves.
import { TOYS } from "../src/toys.js";
import { PROFILES, applyClay } from "../src/generators.js";
import { buildRecipe } from "../src/kit.js";
import { resolveOptions } from "../src/player.js";
import { hash32 } from "../src/noise.js";

// Task 44 owns these worlds. The other prototype tasks have no catalog
// entries in the task's baseline; do not add their branches to this audit.
export const EXCLUDED = [
  "real-moon",
  "real-mars",
  "real-earth",
  "real-mercury",
  "real-venus",
  "real-moons",
  "real-small-worlds",
];
export const TIERS = ["low", "mid", "high", "max"];
export const TOYS_T2 = TOYS.filter(
  (t) =>
    t.kind === "kit" &&
    ["science", "space", "maths"].includes(t.category) &&
    !EXCLUDED.includes(t.id),
);

// Match Player.splatBudget with the Detail slider left at Auto.
export function budget(recipe, tier) {
  const p = PROFILES[tier];
  return Math.round(Math.min(p.maxCount, p.defaultCount * (recipe.density ?? 1)));
}

export async function buildToy(def, tier, seed) {
  const { RECIPES } = await import(`../src/packs/${def.pack}.js`);
  const recipe = RECIPES[def.id];
  const options = resolveOptions(recipe, {});
  const count = budget(recipe, tier);
  await recipe.prepare?.(options, undefined, { profile: tier, count });
  const it = buildRecipe(
    recipe,
    { seed: seed ?? recipe.seed ?? hash32(def.id), count, options },
    applyClay,
  );
  let r = it.next();
  while (!r.done) r = it.next();
  return r.value;
}

export function measure(ctx) {
  const { buf, kit } = ctx;
  const arrays = [buf.pos, buf.scale, buf.rot, buf.color, buf.anim];
  let nonFinite = 0;
  for (const a of arrays) {
    const used = buf.count * (a === buf.pos || a === buf.scale ? 3 : 4);
    for (let i = 0; i < used; i++) if (!Number.isFinite(a[i])) nonFinite++;
  }
  return {
    requested: ctx.g.count,
    emitted: buf.count,
    attributeBytes: buf.count * 18 * 4,
    allocatedAttributeBytes: arrays.reduce((n, a) => n + a.byteLength, 0),
    nonFinite,
    parts: kit.parts.map((p) => p.name),
    emptyItems: kit.items.filter((i) => i.end === i.start).length,
  };
}
