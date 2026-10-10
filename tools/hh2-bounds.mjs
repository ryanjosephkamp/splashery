#!/usr/bin/env node
// Lane Hands-on H2: builds kit toys in Node and prints where each part's
// splats (and each token's) lie, in recipe units: the 1st and 99th
// percentile on each axis and the middle. For sizing a toy's Hands-on pieces
// (their solids, picks and homes) from the toy itself.
//
//   node tools/hh2-bounds.mjs croissant egg
//   node tools/hh2-bounds.mjs --opt=scoops:3 ice-cream

import { buildRecipe } from "../src/kit.js";
import { applyClay } from "../src/generators.js";
import { TOYS } from "../src/toys.js";
import { resolveOptions } from "../src/player.js";

const args = process.argv.slice(2);
const opts = Object.fromEntries(
  args
    .filter((a) => a.startsWith("--opt="))
    .map((a) => a.slice(6).split(":"))
    .map(([k, v]) => [k, Number.isNaN(Number(v)) ? v : Number(v)]),
);
const ids = args.filter((a) => !a.startsWith("--"));
const TOKEN = (await import("../src/effects.js")).KINDS.token;

for (const id of ids) {
  const def = TOYS.find((t) => t.id === id);
  const recipe = (await import(`../src/packs/${def.pack}.js`)).RECIPES[id];
  const options = resolveOptions(recipe, opts);
  await recipe.prepare?.(options);
  const it = buildRecipe(recipe, { seed: 1, count: 60000, options }, applyClay);
  let r = it.next();
  while (!r.done) r = it.next();
  const ctx = r.value;
  const { buf } = ctx;
  const names = ctx.kit?.parts?.map((p) => p.name) || [];
  // Back from toy coordinates (fitted) to the recipe's own.
  const tf = ctx.transform || { center: [0, 0, 0], scale: 1 };
  const back = (v, k) => v / tf.scale + tf.center[k];
  const groups = new Map();
  for (let i = 0; i < buf.count; i++) {
    const a = buf.anim ? buf.anim[i * 4] : 0;
    const part = Math.round(a) % 16;
    const kind = buf.anim ? Math.round(buf.anim[i * 4 + 1]) : 0;
    const key = TOKEN >= 0 && kind === TOKEN ? `token ${Math.round(buf.anim[i * 4 + 2])}` : names[part] || `part ${part}`; // prettier-ignore
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push([0, 1, 2].map((k) => back(buf.pos[i * 3 + k], k)));
  }
  console.log(`${id}${Object.keys(opts).length ? " " + JSON.stringify(opts) : ""}`);
  for (const [key, pts] of groups) {
    const lo = [];
    const hi = [];
    for (let k = 0; k < 3; k++) {
      const v = pts.map((p) => p[k]).sort((x, y) => x - y);
      lo.push(v[Math.floor(v.length * 0.01)]);
      hi.push(v[Math.floor(v.length * 0.99)]);
    }
    const f = (a) => `[${a.map((v) => v.toFixed(2)).join(", ")}]`;
    const mid = lo.map((v, k) => (v + hi[k]) / 2);
    console.log(`  ${key.padEnd(12)} ${String(pts.length).padStart(6)}  lo ${f(lo)}  hi ${f(hi)}  mid ${f(mid)}`); // prettier-ignore
  }
}
