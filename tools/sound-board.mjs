#!/usr/bin/env node
// Builds the "Splashery Sound Board" page: every toy's tap sound, played live
// in the browser by the app's own voice library. The page is
// tools/pages/sound-board.html with src/voices.js (its `export`s removed),
// TOY_SOUNDS from src/toy-sounds.js, and the shelf's toys and categories
// (each with the Sound line from tools/toy-plan.json) put in at its
// @@SOUND-DATA@@ line.
//
//   node tools/sound-board.mjs                 # writes .cache/pages/sound-board.html
//   node tools/sound-board.mjs --out=file.html
//   node tools/sound-board.mjs --label=E5 --out=.cache/pages/sound-board-e5.html
//                                              # a lane's own copy, titled "Splashery Sound Board E5"
//
// Then republish the page to its link with the Artifact tool (the link is in
// docs/OPERATING.md, "Pages"): file_path the written file, url the link.

import fs from "node:fs";
import path from "node:path";
import { execSync } from "node:child_process";
import { TOYS, CATEGORIES } from "../src/toys.js";
import { TOY_SOUNDS } from "../src/toy-sounds.js";

const root = path.resolve(path.dirname(new URL(import.meta.url).pathname), "..");
const arg = (name, fallback) =>
  process.argv.find((a) => a.startsWith(`--${name}=`))?.slice(name.length + 3) ?? fallback;
const out = path.resolve(root, arg("out", ".cache/pages/sound-board.html"));
const label = arg("label", "").replace(/[^\w .-]/g, "");

const template = fs.readFileSync(path.join(root, "tools/pages/sound-board.html"), "utf8");
const plan = JSON.parse(fs.readFileSync(path.join(root, "tools/toy-plan.json"), "utf8")).toys;
const voices = fs.readFileSync(path.join(root, "src/voices.js"), "utf8");
if (/^(import|export \{|export default)/m.test(voices))
  throw new Error("src/voices.js has an import or an export list: update tools/sound-board.mjs");

const toys = TOYS.map((t) => ({ id: t.id, label: t.label, c: t.category, s: plan[t.id]?.sound || "" })); // prettier-ignore
const cats = CATEGORIES.filter((c) => toys.some((t) => t.c === c.id)).map((c) => ({ id: c.id, label: c.label })); // prettier-ignore
const sounds = Object.fromEntries(TOYS.map((t) => [t.id, TOY_SOUNDS[t.id]]));
const missing = TOYS.filter((t) => !TOY_SOUNDS[t.id]).map((t) => t.id);
if (missing.length) throw new Error(`No sound for: ${missing.join(", ")}`);

let commit = "";
try {
  commit = execSync("git rev-parse --short HEAD", { cwd: root, encoding: "utf8" }).trim();
} catch {
  // Not a git checkout: the date alone will do.
}
const built = new Date().toISOString().slice(0, 10) + (commit ? `, ${commit}` : "");

const data = [
  voices.replace(/^export /gm, "").trimEnd(),
  "",
  `const TOY_SOUNDS = ${JSON.stringify(sounds)};`,
  `const TOYS = ${JSON.stringify(toys)};`,
  `const CATS = ${JSON.stringify(cats)};`,
].join("\n");
const lines = template.split("\n");
const at = lines.findIndex((l) => l.trim().startsWith("// @@SOUND-DATA@@"));
if (at < 0 || !template.includes("@@BUILT@@")) throw new Error("The template lost its markers");
lines.splice(at, 1, data);
let html = lines.join("\n").replace("@@BUILT@@", built);
if (label) html = html.replace("<title>Splashery Sound Board</title>", `<title>Splashery Sound Board ${label}</title>`); // prettier-ignore

fs.mkdirSync(path.dirname(out), { recursive: true });
fs.writeFileSync(out, html);
console.log(
  `${path.relative(root, out)}: ${toys.length} toys, ${Object.keys(sounds).length} sounds, ` +
    `${Math.round(html.length / 1024)} KB (built ${built})`,
);
