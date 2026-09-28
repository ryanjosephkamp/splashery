#!/usr/bin/env node
// Builds the "Splashery Help Board" page: every shelf toy's how-to line and
// About text from src/toy-help.js, as the app shows them, with its thumbnail,
// so the owner can read them all in one place and mark each toy. A toy
// without its own line shows the line the app builds from its recipe.
//
// The page is tools/pages/help-board.html with the toys, the shelves and the
// texts put in at its @@HELP-DATA@@ line. The owner's marks live in the
// page's database ("verdicts", one document per toy id: { verdict, note }).
//
//   node tools/help-board.mjs                 # writes .cache/pages/help-board.html
//   node tools/help-board.mjs --out=file.html
//
// Then republish the page to its link with the Artifact tool (the link is in
// docs/OPERATING.md, "Pages"): file_path the written file, url the link.

import fs from "node:fs";
import path from "node:path";
import { execSync } from "node:child_process";
import { TOYS, CATEGORIES } from "../src/toys.js";
import { TOY_HELP, defaultHowTo } from "../src/toy-help.js";
import { RIGS } from "../src/rigs.js";

const root = path.resolve(path.dirname(new URL(import.meta.url).pathname), "..");
const arg = (name, fallback) =>
  process.argv.find((a) => a.startsWith(`--${name}=`))?.slice(name.length + 3) ?? fallback;
const out = path.resolve(root, arg("out", ".cache/pages/help-board.html"));

const template = fs.readFileSync(path.join(root, "tools/pages/help-board.html"), "utf8");

// The recipe the app reads for a toy's default line: a kit toy's from its
// pack, a scan's or shape's rig.
const packs = {};
async function recipeFor(t) {
  if (t.kind === "kit" && t.pack) {
    packs[t.pack] ??= (await import(`../src/packs/${t.pack}.js`)).RECIPES || {};
    return packs[t.pack][t.id] || null;
  }
  return RIGS[t.id] || null;
}

const words = (s) => (s.match(/\S+/g) || []).length;
const toys = [];
for (const t of TOYS) {
  const entry = TOY_HELP[t.id] || {};
  const recipe = await recipeFor(t);
  const thumb = path.join(root, `assets/toys/${t.id}/thumb.webp`);
  toys.push({
    id: t.id,
    label: t.label,
    c: t.category,
    img: fs.existsSync(thumb)
      ? `data:image/webp;base64,${fs.readFileSync(thumb).toString("base64")}`
      : "",
    howTo: entry.howTo || "",
    auto: entry.howTo ? "" : defaultHowTo({ id: t.id, kind: t.kind, label: t.label, recipe }),
    about: entry.about ? entry.about.split(/\n\s*\n/) : [],
    words: entry.about ? words(entry.about) : 0,
  });
}
const cats = CATEGORIES.filter((c) => toys.some((t) => t.c === c.id)).map((c) => ({ id: c.id, label: c.label })); // prettier-ignore

let commit = "";
try {
  commit = execSync("git rev-parse --short HEAD", { cwd: root, encoding: "utf8" }).trim();
} catch {
  // Not a git checkout: the date alone will do.
}
const built = new Date().toISOString().slice(0, 10) + (commit ? `, ${commit}` : "");

const data = [`const TOYS = ${JSON.stringify(toys)};`, `const CATS = ${JSON.stringify(cats)};`];
const lines = template.split("\n");
const at = lines.findIndex((l) => l.trim().startsWith("// @@HELP-DATA@@"));
if (at < 0 || !template.includes("@@BUILT@@")) throw new Error("The template lost its markers");
lines.splice(at, 1, ...data);
const html = lines.join("\n").replace("@@BUILT@@", built);

fs.mkdirSync(path.dirname(out), { recursive: true });
fs.writeFileSync(out, html);
const own = toys.filter((t) => t.howTo).length;
const about = toys.filter((t) => t.about.length).length;
console.log(
  `${path.relative(root, out)}: ${toys.length} toys, ${own} how-to lines, ${about} About texts, ` +
    `${Math.round(html.length / 1024)} KB (built ${built})`,
);
