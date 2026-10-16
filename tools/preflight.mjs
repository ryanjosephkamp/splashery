// Preflight: the checks that most often send a Codex PR back, in one command (the owner's yes of
// October 16, 2026, after the Operator's count of three weeks of follow-ups). Run it last, after
// merging main:
//
//   git fetch origin main && git merge origin/main
//   SPLASHERY_CHROMIUM=<path to Chromium> node tools/preflight.mjs
//
// 1. Up to date: origin/main is merged in (half the follow-ups asked for that).
// 2. The Checks job of .github/workflows/tests.yml: prettier, American English on the lines this
//    branch adds, site/ current, the shared lists parse.
// 3. Size: no added or changed file over 1 MB (pass --allow-large=a,b for files the task allows),
//    and each JSON file under docs/audits/ or docs/evidence/ under 300 KB.
// 4. The shelf-wide specs that new toys and layout changes break: toy counts and lists (cdx-t2,
//    evidence-computing), toy dates and What's new (st2, st3), shown text options (cmp2-engine),
//    the tilt lock (vw), credits and the build (bld), the shelf (spg, shb), every toy's help and tap
//    (help, hta, taps), and the unit tests (about 12 minutes with two workers).
//
// --quick skips 4. Exits 1 if anything fails, after a summary of every step.

import { spawnSync } from "node:child_process";
import fs from "node:fs";

const args = process.argv.slice(2);
const quick = args.includes("--quick");
const allowLarge = new Set(
  (args.find((a) => a.startsWith("--allow-large="))?.slice(14) || "").split(",").filter(Boolean),
);
const SPECS = ["cdx-t2", "evidence-computing", "st2", "st3", "cmp2-engine", "vw", "bld", "spg", "shb", "help", "hta", "taps", "unit"]; // prettier-ignore
const JSON_LISTS = ["tools/toy-plan.json", "tools/assets.json", "tools/models.json", "tools/sound-review.json", "tools/suite.json"]; // prettier-ignore
const MB = 1024 * 1024;

const results = [];
const run = (cmd, argv, opts = {}) =>
  spawnSync(cmd, argv, { encoding: "utf8", stdio: opts.quiet ? "pipe" : "inherit", ...opts });
function step(name, fn) {
  process.stdout.write(`\n== ${name}\n`);
  let problem = null;
  try {
    problem = fn();
  } catch (e) {
    problem = e.message;
  }
  results.push({ name, problem });
  console.log(problem ? `FAIL: ${problem}` : "ok");
}
const git = (...a) => run("git", a, { quiet: true }).stdout.trim();

step("main is merged in", () => {
  run("git", ["fetch", "-q", "origin", "main"], { quiet: true });
  const behind = git("rev-list", "--count", "HEAD..origin/main");
  return behind === "0" ? null : `${behind} commits on origin/main are not in this branch: git merge origin/main`; // prettier-ignore
});

step("prettier", () => (run("npx", ["prettier", "--check", "."]).status ? "npx prettier --write <files>, then commit" : null)); // prettier-ignore
step("American English on added lines", () => (run("node", ["tools/us-english.mjs", "--diff=origin/main"]).status ? "see the lines above" : null)); // prettier-ignore
step("site/ is current", () => (run("node", ["tools/site-build.mjs", "--check"]).status ? "node tools/site-build.mjs, then commit site/" : null)); // prettier-ignore
step("shared lists parse", () => {
  const bad = [];
  for (const f of ["src/toys.js", "src/toy-help.js", "src/toy-sounds.js"])
    if (run("node", ["--check", f], { quiet: true }).status) bad.push(f);
  for (const f of JSON_LISTS) {
    try {
      JSON.parse(fs.readFileSync(f, "utf8"));
    } catch {
      bad.push(f);
    }
  }
  return bad.length ? bad.join(", ") : null;
});

step("file sizes", () => {
  const base = git("merge-base", "HEAD", "origin/main");
  const files = git("diff", "--name-only", "--diff-filter=AM", base, "HEAD").split("\n").filter(Boolean); // prettier-ignore
  const bad = [];
  for (const f of files) {
    if (!fs.existsSync(f)) continue;
    const size = fs.statSync(f).size;
    if (size > MB && !allowLarge.has(f)) bad.push(`${f} (${(size / MB).toFixed(1)} MB)`);
    if (/^docs\/(audits|evidence)\/.*\.json$/.test(f) && size > 300 * 1024)
      bad.push(`${f} (${Math.round(size / 1024)} KB of evidence; keep raw data on a clips branch)`);
  }
  return bad.length ? bad.join("; ") : null;
});

if (!quick)
  step(`shelf-wide specs (${SPECS.join(", ")})`, () => {
    const files = SPECS.map((s) => `tests/${s}.spec.mjs`);
    const r = run("npx", ["playwright", "test", ...files, "--workers=2", "--reporter=line"]);
    return r.status ? "a failing test above; fix the cause (never loosen or skip a test)" : null;
  });

console.log("\n== Preflight summary");
for (const { name, problem } of results) console.log(`${problem ? "FAIL" : "ok  "}  ${name}${problem ? `: ${problem}` : ""}`); // prettier-ignore
const failed = results.filter((r) => r.problem).length;
console.log(
  failed ? `\n${failed} step(s) failed.` : "\nAll clear. Say in the PR that preflight passed.",
);
process.exit(failed ? 1 : 0);
