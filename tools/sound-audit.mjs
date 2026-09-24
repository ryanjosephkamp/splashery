#!/usr/bin/env node
// Lists which toys still lack their own tap action or their own sound, and
// how the voice library is used. No browser needed.
//
//   node tools/sound-audit.mjs          # summary and the lists
//   node tools/sound-audit.mjs --all    # also one line per toy
//   node tools/sound-audit.mjs --json   # everything as JSON
//
// "Own action" means a kit recipe with an action (captured and procedural
// toys, and kit toys without one, only hop). "Own sound" means an entry in
// src/toy-sounds.js built from the voice library. Exits non-zero when a toy
// has no sound.

import fs from "node:fs";
import path from "node:path";
import { TOYS } from "../src/toys.js";
import { TOY_SOUNDS } from "../src/toy-sounds.js";
import { VOICE_NAMES, specFor } from "../src/voices.js";

const root = path.resolve(path.dirname(new URL(import.meta.url).pathname), "..");
const plan = JSON.parse(fs.readFileSync(path.join(root, "tools/toy-plan.json"), "utf8")).toys;

const voicesIn = (spec) => [...JSON.stringify(spec ?? null).matchAll(/"voice":"(\w+)"/g)].map((m) => m[1]); // prettier-ignore

const rows = [];
for (const t of TOYS) {
  let action = null;
  let rig = t.rig ? "rig" : null;
  if (t.kind === "kit") {
    const r = (await import(`../src/packs/${t.pack}.js`)).RECIPES[t.id];
    if (r?.action?.key) {
      const type = r.controls?.find((c) => c.key === r.action.key)?.type || "?";
      action = `${r.action.key} (${type})`;
    }
  } else if (t.rig?.action?.key) {
    action = `${t.rig.action.key} (rig)`;
  }
  const spec = TOY_SOUNDS[t.id];
  const toggle = spec && specFor(spec, true) !== specFor(spec, false);
  rows.push({
    id: t.id,
    category: t.category,
    kind: t.kind,
    verdict: plan[t.id]?.v || "?",
    action,
    rig,
    sound: spec ? [...new Set(voicesIn(spec))].join("+") : null,
    toggle,
  });
}

const usage = Object.fromEntries(VOICE_NAMES.map((v) => [v, 0]));
for (const id of Object.keys(TOY_SOUNDS))
  for (const v of new Set(voicesIn(TOY_SOUNDS[id]))) usage[v] = (usage[v] || 0) + 1;

if (process.argv.includes("--json")) {
  process.stdout.write(JSON.stringify({ toys: rows, usage }, null, 1) + "\n");
  process.exit(rows.some((r) => !r.sound) ? 1 : 0);
}

const noAction = rows.filter((r) => !r.action);
const noSound = rows.filter((r) => !r.sound);
console.log(`${rows.length} toys`);
console.log(`  own sound:  ${rows.length - noSound.length}  (${rows.filter((r) => r.toggle).length} with on/off halves)`); // prettier-ignore
console.log(`  own action: ${rows.length - noAction.length}  (the rest hop when tapped)`);

if (process.argv.includes("--all")) {
  console.log("");
  for (const r of rows)
    console.log(`${r.id.padEnd(22)} ${r.category.padEnd(10)} ${(r.action || "hop").padEnd(18)} ${r.sound || "-"}`); // prettier-ignore
}

console.log(`\nWithout their own action (${noAction.length}), by category:`);
const byCat = {};
for (const r of noAction) (byCat[r.category] ||= []).push(r.id);
for (const [c, ids] of Object.entries(byCat)) console.log(`  ${c}: ${ids.join(", ")}`);

console.log(`\nWithout their own sound (${noSound.length}):`);
console.log(noSound.length ? `  ${noSound.map((r) => r.id).join(", ")}` : "  none");

console.log("\nVoices by how many toys use them:");
const sorted = Object.entries(usage).sort((a, b) => b[1] - a[1]);
for (let i = 0; i < sorted.length; i += 6)
  console.log(
    "  " +
      sorted
        .slice(i, i + 6)
        .map(([v, n]) => `${v} ${n}`.padEnd(13))
        .join(""),
  );
const unused = sorted.filter(([, n]) => n === 0).map(([v]) => v);
if (unused.length) console.log(`  unused: ${unused.join(", ")}`);

process.exit(noSound.length ? 1 : 0);
