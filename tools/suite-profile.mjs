#!/usr/bin/env node
// Read-only cost inventory and comparison of tools/suite.mjs JSON reports.
//
// node tools/suite-profile.mjs --before-jobs1=DIR --before-jobs2=DIR \
//   --after-jobs1=DIR --after-jobs2=DIR --original-specs-dir=BASELINE/tests
//
// Every directory flag is optional: omitted modes remain explicitly unmeasured.
// --original-specs-dir identifies the original coverage, excluding newly added
// runner tests from speed comparisons. Without it, the tool tries a before
// report's config.rootDir; if no original inventory exists, it claims no speedup.

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { parsers } from "prettier/plugins/acorn.mjs";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const modes = ["before-jobs1", "before-jobs2", "after-jobs1", "after-jobs2"];
const terminal = new Set(["passed", "failed", "timedOut", "skipped"]);
const finite = (n) => typeof n === "number" && Number.isFinite(n) && n >= 0;
const seconds = (n) => (finite(n) ? n.toFixed(3) : "unmeasured");
const markdown = (s) => String(s).replace(/\|/g, "\\|").replace(/\r?\n/g, " ");
const list = (files) => (files.length ? files.map((f) => `\`${f}\``).join(", ") : "none");

function specFiles(dir) {
  return fs
    .readdirSync(dir)
    .filter((f) => f.endsWith(".spec.mjs"))
    .map((f) => f.slice(0, -".spec.mjs".length))
    .sort();
}

// Acorn is provided by the repository's pinned Prettier dependency. Parse call
// sites instead of counting comments, quoted examples, or URL text as code.
export async function inventory(source) {
  const out = { waits: 0, literalWaits: 0, literalMs: 0, goto: 0, toys: 0, shots: 0, clips: 0 };
  const ast = await parsers.acorn.parse(source, {});
  const walk = (node) => {
    if (!node || typeof node !== "object") return;
    if (node.type === "CallExpression") {
      const callee = node.callee;
      const member = callee.type === "MemberExpression";
      const name = member
        ? callee.computed
          ? callee.property.value
          : callee.property.name
        : callee.name;
      if (member && name === "waitForTimeout") {
        out.waits++;
        const arg = node.arguments[0];
        if (arg?.type === "Literal" && finite(arg.value)) {
          out.literalWaits++;
          out.literalMs += arg.value;
        }
      }
      if (member && name === "goto") out.goto++;
      if (member && name === "chooseToy") out.toys++;
      if (member && name === "screenshot") out.shots++;
      if (typeof name === "string" && /clip|record|exportGif|exportWebM|exportVideo/i.test(name))
        out.clips++;
    }
    for (const value of Object.values(node)) {
      if (Array.isArray(value)) value.forEach(walk);
      else if (value && typeof value === "object" && value.type) walk(value);
    }
  };
  walk(ast);
  return out;
}

export function measurement(report) {
  const tests = [];
  const walk = (suite, titles = []) => {
    const here = [...titles, suite.title].filter(Boolean);
    for (const spec of suite.specs || [])
      for (const test of spec.tests || [])
        tests.push({
          key: JSON.stringify([...here, spec.title, test.projectName || test.projectId || ""]),
          expected: test.expectedStatus || "passed",
          results: test.results || [],
          annotations: [
            ...(test.annotations || []),
            ...(test.results || []).flatMap((result) => result.annotations || []),
          ],
        });
    for (const child of suite.suites || []) walk(child, here);
  };
  for (const suite of report.suites || []) walk(suite);
  const results = tests.flatMap((test) => test.results);
  const reportedCount = ["expected", "unexpected", "flaky", "skipped"].reduce(
    (sum, key) => sum + (report.stats?.[key] || 0),
    0,
  );
  const problems = [];
  if (!tests.length) problems.push("no registered tests");
  if (reportedCount !== tests.length)
    problems.push(`count mismatch: stats ${reportedCount}, registered ${tests.length}`);
  if (tests.some((test) => !test.results.length)) problems.push("tests without results");
  if (results.some((result) => !terminal.has(result.status)))
    problems.push("unfinished/interrupted results");
  if (results.some((result) => !finite(result.duration))) problems.push("missing result durations");
  if (report.errors?.length) problems.push(`${report.errors.length} process errors`);
  if (report.config?.projects?.some((project) => (project.repeatEach ?? 1) !== 1))
    problems.push("repeat-each is not 1; a repetition proof is not a clean suite benchmark");
  if (
    tests.some((test) =>
      test.annotations.some((annotation) => annotation.type === "cpu-throttle-requested"),
    )
  )
    problems.push("CPU-throttled proof is not a clean suite benchmark");
  const wall = finite(report.suiteRun?.wall)
    ? report.suiteRun.wall
    : finite(report.stats?.duration)
      ? report.stats.duration / 1000
      : null;
  if (wall === null) problems.push("missing wall measurement");
  const sum = results.every((result) => finite(result.duration))
    ? results.reduce((total, result) => total + result.duration / 1000, 0)
    : null;
  const retried = tests.some(
    (test) => test.results.length !== 1 || test.results.some((result) => result.retry > 0),
  );
  const failures = tests.filter((test) => {
    const final = test.results.at(-1);
    return final && final.status !== "skipped" && final.status !== test.expected;
  }).length;
  const signature = tests
    .map((test) => `${test.key}:${test.expected}:${test.results.at(-1)?.status || "missing"}`)
    .sort()
    .join("\n");
  const coverageSignature = tests
    .map(
      (test) => `${test.key}:${test.expected}:skipped=${test.results.at(-1)?.status === "skipped"}`,
    )
    .sort()
    .join("\n");
  // Fixing a known failure changes its outcome, not its coverage. A complete
  // baseline may fail normally, but a signal, process error, or partial report
  // must never become a convenient slow baseline.
  const baselineComparable =
    !problems.length &&
    !retried &&
    !report.stats?.flaky &&
    (((report.suiteRun?.code ?? 0) === 0 && failures === 0 && !report.stats?.unexpected) ||
      (report.suiteRun?.code === 1 && failures > 0 && report.stats?.unexpected === failures));
  return {
    wall,
    wallSource: finite(report.suiteRun?.wall) ? "suiteRun.wall" : "stats.duration",
    sum,
    residual: wall === null || sum === null ? null : wall - sum,
    tests: tests.length,
    attempts: results.length,
    failures,
    skipped: tests.filter((test) => test.results.at(-1)?.status === "skipped").length,
    signature,
    coverageSignature,
    problems,
    complete: !problems.length,
    baselineComparable,
    comparable:
      !problems.length &&
      !retried &&
      !failures &&
      !report.stats?.unexpected &&
      !report.stats?.flaky &&
      (report.suiteRun?.code ?? 0) === 0,
    retried,
  };
}

function readMode(dir) {
  const out = { dir, reports: new Map(), invalid: [], run: null };
  if (!dir || !fs.existsSync(dir)) return out;
  for (const file of fs.readdirSync(dir).filter((f) => f.endsWith(".json") && f !== "run.json")) {
    try {
      const report = JSON.parse(fs.readFileSync(path.join(dir, file), "utf8"));
      if (!Array.isArray(report.suites)) continue;
      out.reports.set(file.slice(0, -5), { report, ...measurement(report) });
    } catch (error) {
      out.invalid.push(`${file}: ${error.message}`);
    }
  }
  try {
    out.run = JSON.parse(fs.readFileSync(path.join(dir, "run.json"), "utf8"));
  } catch {}
  return out;
}

function cell(measured) {
  if (!measured) return "unmeasured";
  const residual = measured.residual === null ? "unmeasured" : measured.residual.toFixed(3);
  return `${seconds(measured.wall)} / ${seconds(measured.sum)} / ${residual}${measured.comparable ? "" : " ⚠"}`;
}

function sum(rows, key) {
  return rows.length && rows.every((row) => finite(row[key]))
    ? rows.reduce((total, row) => total + row[key], 0)
    : null;
}

async function main() {
  const args = new Map();
  for (const arg of process.argv.slice(2)) {
    if (arg === "--help") {
      console.log("Usage: node tools/suite-profile.mjs [--before-jobs1=DIR] [--before-jobs2=DIR] [--after-jobs1=DIR] [--after-jobs2=DIR] [--original-specs-dir=DIR]"); // prettier-ignore
      return;
    }
    const match = /^--([a-z0-9-]+)=(.+)$/.exec(arg);
    if (!match || ![...modes, "original-specs-dir"].includes(match[1]))
      throw new Error(`Unknown argument ${arg}; use --help`);
    args.set(match[1], path.resolve(match[2]));
  }
  const current = specFiles(path.join(root, "tests"));
  const runs = Object.fromEntries(modes.map((mode) => [mode, readMode(args.get(mode))]));
  let originalDir = args.get("original-specs-dir");
  if (!originalDir)
    for (const mode of modes.filter((m) => m.startsWith("before")))
      for (const { report } of runs[mode].reports.values()) {
        const candidate = report.config?.rootDir;
        if (
          candidate &&
          path.resolve(candidate) !== path.join(root, "tests") &&
          fs.existsSync(candidate)
        ) {
          originalDir = candidate;
          break;
        }
      }
  const original = originalDir ? specFiles(originalDir) : null;
  const baseline = original || current;
  const added = original ? current.filter((f) => !original.includes(f)) : [];
  const removed = original ? original.filter((f) => !current.includes(f)) : [];
  const lines = [
    "# Suite timing profile",
    "",
    `Current spec files: ${current.length}. Original inventory: ${original ? `${original.length} files from \`${markdown(originalDir)}\`` : "unavailable; no aggregate speedup is claimed"}.`,
    "",
    "Waits are numeric-literal waitForTimeout call sites in the current source. Literal milliseconds are summed once per call site, ignoring loop counts, branches, helper reuse, and dynamic arguments; they are not runtime estimates. Other columns count member calls named goto, chooseToy, and screenshot, plus calls whose names contain clip/record or exportGif/exportWebM/exportVideo. Comments and quoted examples are excluded.",
    "",
    "Timing cells are measured wall / summed test-result durations / residual seconds. Residual is wall minus test durations: an estimate of process, startup, hook, and teardown time outside reported test durations, not a direct measurement of any one phase. It may be negative with overlapping tests. Wall prefers suiteRun.wall; stats.duration is used when process wall was not recorded. ⚠ marks failed or otherwise ineligible files. Complete, single-attempt baseline test failures can be compared with passing repairs; their cost is explicitly included and reported. Partial, interrupted, or retried baselines and failing final runs are excluded from speedup claims.",
    "",
    "| File | Literal waits | Literal ms | goto | chooseToy | Screenshots | Clip/record calls | Before jobs=1 (w/t/r) | Before jobs=2 (w/t/r) | After jobs=1 (w/t/r) | After jobs=2 (w/t/r) |",
    "| --- | ---: | ---: | ---: | ---: | ---: | ---: | --- | --- | --- | --- |",
  ];
  const costs = [];
  for (const file of current) {
    const cost = await inventory(fs.readFileSync(path.join(root, "tests", `${file}.spec.mjs`), "utf8")); // prettier-ignore
    costs.push(cost);
    lines.push(`| ${file}${added.includes(file) ? " (added)" : ""} | ${cost.literalWaits} | ${cost.literalMs} | ${cost.goto} | ${cost.toys} | ${cost.shots} | ${cost.clips} | ${modes.map((mode) => cell(runs[mode].reports.get(file))).join(" | ")} |`); // prettier-ignore
  }
  const totalCost = Object.fromEntries(Object.keys(costs[0] || {}).map((key) => [key, costs.reduce((n, cost) => n + cost[key], 0)])); // prettier-ignore
  lines.push("", `Current source totals: ${totalCost.literalWaits || 0} literal waits, ${totalCost.literalMs || 0} literal ms, ${(totalCost.waits || 0) - (totalCost.literalWaits || 0)} dynamic wait call sites.`, ""); // prettier-ignore
  if (original) lines.push(`Added files excluded from comparisons: ${list(added)}. Removed original files: ${list(removed)}.`, ""); // prettier-ignore
  lines.push("## Measurement coverage", "");
  for (const mode of modes) {
    const run = runs[mode];
    const rows = baseline.map((f) => run.reports.get(f)).filter(Boolean);
    const missing = baseline.filter((f) => !run.reports.has(f));
    const eligible = (row) => (mode.startsWith("before") ? row.baselineComparable : row.comparable);
    const incomplete = baseline.filter((f) => run.reports.has(f) && !eligible(run.reports.get(f)));
    const extras = [...run.reports.keys()].filter((f) => !baseline.includes(f)).sort();
    lines.push(`### ${mode}`, "", `Directory: ${run.dir ? `\`${markdown(run.dir)}\`${fs.existsSync(run.dir) ? "" : " (missing)"}` : "not supplied"}. ${rows.length}/${baseline.length} original files reported; ${rows.filter(eligible).length} eligible for this mode.`, ""); // prettier-ignore
    const wall = sum(rows, "wall");
    const testTime = sum(rows, "sum");
    const residual =
      wall === null || testTime === null ? "unmeasured" : (wall - testTime).toFixed(3);
    lines.push(`Measured-file sums: ${seconds(wall)} wall seconds, ${seconds(testTime)} test seconds, ${residual} residual seconds, ${rows.reduce((n, r) => n + r.tests, 0)} registered tests, ${rows.reduce((n, r) => n + r.attempts, 0)} attempts, ${rows.reduce((n, r) => n + r.failures, 0)} failures, ${rows.reduce((n, r) => n + r.skipped, 0)} skipped.`, ""); // prettier-ignore
    lines.push(`Whole-run elapsed: ${seconds(run.run?.elapsed)} seconds. Recorded server/display startup: ${seconds(run.run?.startup)} seconds. Whole-run wall cannot be reconstructed by adding concurrent file walls.`, ""); // prettier-ignore
    lines.push(`Missing: ${list(missing)}.`, "", `Excluded or incomplete: ${list(incomplete)}. Reports outside original inventory: ${list(extras)}.`, ""); // prettier-ignore
    for (const file of incomplete) {
      const row = run.reports.get(file);
      lines.push(`- \`${file}\`: ${[...row.problems, ...(row.failures ? [`${row.failures} failures`] : []), ...(row.retried ? ["multiple/missing attempts"] : []), ...(row.report.suiteRun?.code ? [`exit ${row.report.suiteRun.code}`] : [])].join("; ")}.`); // prettier-ignore
    }
    for (const error of run.invalid) lines.push(`- Invalid JSON: ${markdown(error)}.`);
    if (incomplete.length || run.invalid.length) lines.push("");
  }
  lines.push("## Comparable original coverage", "");
  for (const [beforeJobs, afterJobs] of [
    [1, 1],
    [2, 2],
    [1, 2],
  ]) {
    const label =
      beforeJobs === afterJobs
        ? `Jobs=${beforeJobs}`
        : `Before jobs=${beforeJobs} → after jobs=${afterJobs}`;
    const before = runs[`before-jobs${beforeJobs}`];
    const after = runs[`after-jobs${afterJobs}`];
    const absent = baseline.filter((f) => !before.reports.has(f) || !after.reports.has(f));
    const invalid = baseline.filter((f) => before.reports.has(f) && after.reports.has(f) && (!before.reports.get(f).baselineComparable || !after.reports.get(f).comparable)); // prettier-ignore
    const mismatch = baseline.filter((f) => before.reports.has(f) && after.reports.has(f) && before.reports.get(f).coverageSignature !== after.reports.get(f).coverageSignature); // prettier-ignore
    if (!original || absent.length || invalid.length || mismatch.length || removed.length) {
      lines.push(`${label}: no complete-coverage speedup claim. Missing pairs: ${absent.length}; excluded pairs: ${invalid.length}; changed test/project/skip coverage: ${mismatch.length}; removed original files: ${removed.length}.`, ""); // prettier-ignore
      if (mismatch.length) lines.push(`Coverage mismatches: ${list(mismatch)}.`, "");
      continue;
    }
    const beforeWall = sum(
      baseline.map((f) => before.reports.get(f)),
      "wall",
    );
    const afterWall = sum(
      baseline.map((f) => after.reports.get(f)),
      "wall",
    );
    const baselineFailures = baseline.reduce(
      (count, file) => count + before.reports.get(file).failures,
      0,
    );
    lines.push(`${label}: all ${baseline.length} original files have matching test/project/skip coverage and passing final outcomes. Before failures: ${baselineFailures}; after failures: 0. Summed file-wall ratio: ${afterWall > 0 ? `${(beforeWall / afterWall).toFixed(3)}×` : "unavailable"} (${seconds(beforeWall)} → ${seconds(afterWall)} seconds). This ratio measures per-file process cost, not concurrent suite elapsed time.`, ""); // prettier-ignore
    if (baselineFailures)
      lines.push("This comparison includes the cost of baseline failures, including their timeouts. It is not a comparison of two passing suites.", ""); // prettier-ignore
    const sameSchedule = [
      [before, beforeJobs],
      [after, afterJobs],
    ].every(([run, jobs]) => {
      const started = Date.parse(run.run?.started);
      const finished = Date.parse(run.run?.finished);
      return (
        Array.isArray(run.run?.files) &&
        run.run.files.length === baseline.length &&
        new Set(run.run.files).size === baseline.length &&
        run.run.files.every((f) => baseline.includes(f)) &&
        run.run.jobs === jobs &&
        Number.isFinite(started) &&
        Number.isFinite(finished) &&
        baseline.every((file) => {
          const report = run.reports.get(file).report;
          const at = Date.parse(report.stats?.startTime);
          // A resumed run's elapsed time covers only its new files. Earlier
          // cached reports must not make that interval look like a full run.
          return at >= started && at + report.stats.duration <= finished + 1000;
        })
      );
    });
    const sameEnvironment =
      typeof before.run?.gl === "string" &&
      before.run.gl === after.run?.gl &&
      typeof before.run?.browser === "string" &&
      before.run.browser === after.run?.browser;
    if (sameSchedule && sameEnvironment && finite(before.run?.elapsed) && finite(after.run?.elapsed) && after.run.elapsed > 0) // prettier-ignore
      lines.push(`Measured whole-run ratio: ${(before.run.elapsed / after.run.elapsed).toFixed(3)}× (${seconds(before.run.elapsed)} → ${seconds(after.run.elapsed)} seconds).`, ""); // prettier-ignore
    else lines.push("Whole-run speedup unavailable: matching renderer/browser, elapsed metadata, exact original-only coverage, or evidence that every report was produced inside this run's interval is missing.", ""); // prettier-ignore
  }
  console.log(lines.join("\n"));
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url))
  main().catch((error) => {
    console.error(error.message);
    process.exitCode = 2;
  });
