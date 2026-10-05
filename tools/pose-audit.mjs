#!/usr/bin/env node
// Lane Any pose: writes docs/audits/poses-2026-10.md from the sweep
// (tools/pose-sweep.mjs), a verdict per toy.
//
//   node tools/pose-audit.mjs <after.json>[,<after-2.json>...] [--before=<before.json>,...] [--notes=tools/pose-notes.json] [--out=docs/audits/poses-2026-10.md]
//
// pose-notes.json: { "<toy id>": "what was checked by eye, or the fix" },
// shown beside the toy's verdict (and it overrides a "check" verdict).

import fs from "node:fs";

const args = process.argv.slice(2);
const opt = (name, def) => {
  const a = args.find((x) => x.startsWith(`--${name}=`));
  return a ? a.slice(name.length + 3) : def;
};
const read = (list) =>
  Object.assign({}, ...list.split(",").filter(Boolean).map((f) => JSON.parse(fs.readFileSync(f, "utf8")))); // prettier-ignore
const [afterList] = args.filter((a) => !a.startsWith("--"));
const after = read(afterList);
const before = opt("before", "") ? read(opt("before", "")) : {};
const notesFile = opt("notes", "tools/pose-notes.json");
const notes = fs.existsSync(notesFile) ? JSON.parse(fs.readFileSync(notesFile, "utf8")) : {};
const out = opt("out", "docs/audits/poses-2026-10.md");
const { TOYS, categoryLabel } = await import("../src/toys.js");

const OK = 3; // err (0..255) under this: the same as upright, turned
const worst = (r) => Math.max(r?.side?.err ?? 0, r?.down?.err ?? 0);
function verdict(id, r) {
  if (!r) return ["not measured", ""];
  if (r.error) return ["not measured", `the sweep failed: ${r.error}`];
  if (!r.canPlay) return ["never posed", "Hands-on leaves it alone (a picture or turntable toy)"];
  if (r.mode === "pieces") return ["pieces", "plays in pieces in Hands-on; never tossed whole"];
  if (r.move < 2) return ["works", "no tap motion big enough to compare (the pose itself is fine)"];
  if (worst(r) < OK) return ["works", ""];
  if (notes[id]) return ["checked", ""];
  return ["check", ""];
}
const fmt = (r) => (r && !r.error && r.side ? `${r.side.err.toFixed(1)} / ${r.down.err.toFixed(1)}` : "–"); // prettier-ignore

const rows = [];
const counts = {};
for (const t of TOYS) {
  const r = after[t.id];
  const [v, why] = verdict(t.id, r);
  counts[v] = (counts[v] || 0) + 1;
  const note = [why, notes[t.id]].filter(Boolean).join("; ");
  rows.push({ t, v, note, a: fmt(r), b: fmt(before[t.id]), move: r?.move });
}
const shelves = [...new Set(TOYS.map((t) => t.category))];
let md = `# Any pose audit, October 2026

Lane Any pose (docs/handoff/AnyPose.md). Every toy's tap, upright, on its side and upside down,
after the engine change "Engine: tap effects in the toy's own frame, in any pose".

How it was measured (\`tools/pose-sweep.mjs\`, \`tools/pose-measure.js\`): each pose turns the whole
toy about the camera's line of sight, through the point the camera looks at, as Hands-on poses a toy.
Seen down that line, a toy whose effect works in its own frame looks exactly like the upright toy
turned on the screen, frame for frame. Each posed frame (at 0.35, 0.9 and 1.8 seconds after the tap)
is turned back and compared with the upright frame at the same moment: the numbers are the largest
mean color difference (0 to 255, on its side / upside down) above the rendering's own noise. Under
${OK} reads as the same motion. "Before" is main before the engine change (with Hands-on's earlier
kit-only fix, \`poseKitUniforms\`).

Verdicts: **works** (the tap plays the same in any pose), **check** (differs; see the note),
**checked** (differs on purpose, such as a flame that rises toward the real sky, or fixed; see the
note), **pieces** (plays in pieces in Hands-on and is never tossed whole), **never posed** (Hands-on
leaves it alone).

Totals: ${Object.entries(counts)
  .map(([k, n]) => `${n} ${k}`)
  .join(", ")}.
`;
for (const s of shelves) {
  md += `\n## ${categoryLabel(s) || s}\n\n| Toy | Verdict | After (side / down) | Before | Note |\n| --- | --- | --- | --- | --- |\n`;
  for (const r of rows.filter((x) => x.t.category === s))
    md += `| ${r.t.label}${r.t.labs ? " (labs)" : ""} | ${r.v} | ${r.a} | ${r.b} | ${r.note} |\n`;
}
md += `
## Upright is untouched

\`tools/pose-upright.mjs\` rendered 15 toys (heart, grape, candle, toy piano, oak, sports car, hoodie,
solar system, snow globe, basketball, cactus, earth, bee, jelly, chess set) at 5 moments around a
tap, on main and with the engine change: every uniform the effects read was identical (0 of 75
differ), and every frame was pixel-identical except two late heart frames, which also differ
between two runs of the same code (rendering timing).

## Gravity effects

The engine works every effect out in the toy's own frame, except what only makes sense one way up:

- Flames, smoke, steam, embers, bubbles and sparkles (the flame and rise kinds) rise toward the real
  sky, and snow, rain, petals and confetti (the fall kind) fall toward the real floor.
- A scan's break-apart pieces (the blackberry's drupelets, the donut's crumbs) fall toward the real
  floor and land there.
- Toys with no real down keep all of that in their own frame: the space, atoms, tiny world, math and
  computing shelves, and any recipe with \`gravity: false\` (the rocket, gift box, potion bottle,
  tornado, geyser and volcano, whose bursts leave through their own opening).
- A recipe can read the real up as \`about.up\` while its toy is turned (the snow globe and storm
  cloud use it to keep snow and rain from leaving them).
- Never posed whole, so nothing to fix: the Newton's cradle (its own drags), the fluid lab.
- Known, left as is: the lava lamp's wax keeps moving along the lamp; the coffee's steam rises
  through the saucer when the cup lies upside down; the potion bottle's liquid is a still shape; the
  storm cloud's lightning strikes from its own underside.
`;
fs.mkdirSync("docs/audits", { recursive: true });
fs.writeFileSync(out, md);
console.log(`${out}: ${JSON.stringify(counts)}`);
