#!/usr/bin/env node
// Draws the project's lane loop (docs/lane-loop.grooph.json) for the draft page "The loop a lane
// follows" (lane Site r2): a picture of the graph, made by the GROOPH command line (MIT, by the
// owner), plus the link that opens the same graph, interactive and in 3D, in the GROOPH app.
// GROOPH is a build tool: nothing of it ships. Only its SVG and the link are committed.
//
//   node tools/site-loop.mjs            # needs network once (npx fetches grooph@0.4.0)
//   GROOPH=/path/to/grooph.js node tools/site-loop.mjs   # use a local copy instead
//
// Writes site/assets/lane-loop.svg and site/assets/lane-loop-link.txt. The page is built by
// tools/site-build.mjs from those two files and is linked from nowhere yet.

import { execFileSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";

const root = path.resolve(path.dirname(new URL(import.meta.url).pathname), "..");
const graph = path.join(root, "docs/lane-loop.grooph.json");
const svg = path.join(root, "site/assets/lane-loop.svg");
const link = path.join(root, "site/assets/lane-loop-link.txt");
const run = (args) =>
  process.env.GROOPH
    ? execFileSync("node", [process.env.GROOPH, ...args], { encoding: "utf8" })
    : execFileSync("npx", ["--yes", "grooph@0.4.0", ...args], { encoding: "utf8" });

run(["validate", graph]);
run(["image", graph, "--out", svg]);
const shared = run(["share", graph]);
const url = /https:\/\/\S+#\/open\?d=\S+/.exec(shared)?.[0];
if (!url) throw new Error("grooph share printed no link");
fs.writeFileSync(link, url + "\n");
console.log(`wrote ${path.relative(root, svg)} and ${path.relative(root, link)}`);
