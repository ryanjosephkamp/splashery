#!/usr/bin/env node
// The Operator's upkeep on main after a lane merges (docs/OPERATING.md,
// "Upkeep after a merge"): regenerates docs/TOY-PLAN.md from
// tools/toy-plan.json, rebuilds the Sound Board page file, and refreshes the
// standard screenshots that the smoke tests write.
//
//   node tools/upkeep.mjs                  # all three
//   node tools/upkeep.mjs --no-shots       # the plan and the Sound Board only
//   node tools/upkeep.mjs --full           # the full test suite instead of only
//                                          # the screenshot tests (it writes them too)
//   node tools/upkeep.mjs --restore-shots  # put the standard screenshots back as
//                                          # committed (lanes run this after a full
//                                          # test run, before they commit)
//
// Then republish .cache/pages/sound-board.html to the Sound Board link, and
// commit what changed (it lists them at the end).

import path from "node:path";
import { spawnSync } from "node:child_process";
import fs from "node:fs";

const root = path.resolve(path.dirname(new URL(import.meta.url).pathname), "..");
const has = (flag) => process.argv.includes(flag);

// The screenshots every full test run rewrites (tests/smoke.spec.mjs), and
// the tests that write them. Lanes leave these to the Operator and save
// their own as tests/screenshots/<lane>-*.png.
export const STANDARD_SHOTS = [
  "app-1440x900.png",
  "app-1440x900-dark.png",
  "app-390x844.png",
  "app-390x844-sheet.png",
  "balls-1440x900.png",
  "balls-390x844.png",
  "embed-400x300.png",
  "make-help-390x844.png",
  "shelf-grid-390x844.png",
  "shelf-row-390x844.png",
  "v3-1440x900.png",
  "v3-390x844.png",
];
const SHOT_TESTS = [
  "the embed page loads a scene from the hash",
  "desktop screenshot at 1440x900",
  "v3 screenshots at 1440x900 and 390x844",
  "ball screenshots at 1440x900 and 390x844",
  "has no horizontal overflow at 390px and the sheet opens",
  "dragging the shelf up opens a grid, and picking a toy folds it back",
  "the Make pane explains where to find your own splat",
];

function run(cmd, args, opts = {}) {
  console.log(`\n$ ${[cmd, ...args].join(" ")}`);
  const r = spawnSync(cmd, args, { cwd: root, stdio: "inherit", ...opts });
  if (r.status !== 0) {
    console.error(`upkeep: "${cmd} ${args[0] ?? ""}" failed (exit ${r.status}).`);
    process.exit(r.status || 1);
  }
}

const shotPaths = STANDARD_SHOTS.map((f) => `tests/screenshots/${f}`);

if (has("--restore-shots")) {
  run("git", ["restore", "--source=HEAD", "--staged", "--worktree", "--", ...shotPaths]);
  console.log("The standard screenshots are back as committed.");
  process.exit(0);
}

// 1. The plan page's source.
run("node", ["tools/toy-plan.mjs"]);
run("npx", ["prettier", "--write", "docs/TOY-PLAN.md"]);

// 2. The Sound Board page file.
run("node", ["tools/sound-board.mjs"]);

// 3. The standard screenshots (or the whole suite, which writes them too).
if (!has("--no-shots")) {
  const env = { ...process.env };
  if (!env.SPLASHERY_CHROMIUM && fs.existsSync("/opt/pw-browsers/chromium"))
    env.SPLASHERY_CHROMIUM = "/opt/pw-browsers/chromium";
  const escape = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  if (has("--full")) run("npx", ["playwright", "test"], { env });
  else
    run(
      "npx",
      ["playwright", "test", "tests/smoke.spec.mjs", "-g", SHOT_TESTS.map(escape).join("|")],
      { env },
    );
}

console.log("\nChanged:");
run("git", ["status", "--short", "--", "docs/TOY-PLAN.md", "tests/screenshots"]);
console.log(
  "\nNext: republish .cache/pages/sound-board.html to the Sound Board link " +
    "(docs/OPERATING.md, Pages), then commit the changes above in a small PR.",
);
