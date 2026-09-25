#!/usr/bin/env node
// Builds kit toys in Node and reports splat counts, build times and any
// non-finite values; fails when a toy is broken or slow.
//
//   node tools/check-packs.mjs              # every kit toy
//   node tools/check-packs.mjs space heart  # a pack, or single toys
//   node tools/check-packs.mjs --count=280000 space
//
// The default count is the high tier's (desktop); see PROFILES.

import { buildRecipe } from "../src/kit.js";
import { applyClay, PROFILES } from "../src/generators.js";
import { TOYS } from "../src/toys.js";
import { resolveOptions } from "../src/player.js";

const args = process.argv.slice(2);
const countArg = args.find((a) => a.startsWith("--count="));
const count = countArg ? Number(countArg.slice(8)) : PROFILES.high.defaultCount;
const only = args.filter((a) => !a.startsWith("--"));
const toys = TOYS.filter(
  (t) => t.kind === "kit" && (!only.length || only.includes(t.id) || only.includes(t.pack)),
);
let failed = 0;
for (const def of toys) {
  const mod = await import(`../src/packs/${def.pack}.js`);
  const recipe = mod.RECIPES?.[def.id];
  if (!recipe) {
    console.log(`${def.id}: missing from src/packs/${def.pack}.js`);
    failed++;
    continue;
  }
  const t0 = performance.now();
  let ctx;
  try {
    const options = resolveOptions(recipe, {});
    await recipe.prepare?.(options);
    const it = buildRecipe(recipe, { seed: 1, count, options }, applyClay);
    let r = it.next();
    while (!r.done) r = it.next();
    ctx = r.value;
  } catch (err) {
    console.log(`${def.id}: ${err.stack}`);
    failed++;
    continue;
  }
  const ms = Math.round(performance.now() - t0);
  let bad = 0;
  for (let i = 0; i < ctx.buf.count * 3; i++) if (!Number.isFinite(ctx.buf.pos[i])) bad++;
  const slow = ms > 1500;
  if (bad || slow) failed++;
  console.log(
    `${def.id.padEnd(24)} ${String(ctx.buf.count).padStart(7)} splats ${String(ms).padStart(5)} ms` +
      (bad ? `  ${bad} non-finite values` : "") +
      (slow ? "  too slow (keep builds under 1.5 s)" : ""),
  );
}
if (failed) {
  console.log(`\n${failed} problem(s).`);
  process.exitCode = 1;
}
