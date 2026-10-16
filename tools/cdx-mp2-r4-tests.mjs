// Preserve every run; the latest complete report for a file wins, even on failure.
import fs from "node:fs/promises";
import path from "node:path";
import { createHash } from "node:crypto";
import { execFileSync } from "node:child_process";
import { option } from "./cdx-mp2-r4-harness.mjs";

const roots = option("runs", "work/r4-suite,work/r4-extra-tests,work/r4-isolated-tests").split(","),
  out = option("out", "work/r4-test-ledger"),
  runs = [],
  latest = new Map(),
  expected = (await fs.readdir("tests")).filter((file) => file.endsWith(".spec.mjs")).sort();
const clean = (text) => text.replace(/\x1b\[[0-9;]*m/g, "");
for (const root of roots) {
  for (const file of await fs.readdir(root).catch(() => [])) {
    if (!file.endsWith(".json")) continue;
    const bytes = await fs.readFile(path.join(root, file)),
      report = JSON.parse(bytes);
    if (!report.stats || !Array.isArray(report.suites)) continue;
    const files = new Map();
    const walk = (suite) => {
      for (const spec of suite.specs || []) {
        const name = path.basename(spec.file),
          row = files.get(name) || {
            file: name,
            passed: 0,
            failed: 0,
            skipped: 0,
            flaky: 0,
            expectedFailures: 0,
            failures: [],
          };
        for (const test of spec.tests) {
          if (test.status === "unexpected") {
            row.failed++;
            row.failures.push({
              title: spec.title,
              line: spec.line,
              errors: test.results.flatMap((result) =>
                (result.errors || []).map((error) => clean(error.message || "").slice(0, 1000)),
              ),
            });
          } else if (test.status === "skipped") row.skipped++;
          else if (test.status === "flaky") row.flaky++;
          else if (test.expectedStatus === "failed") row.expectedFailures++;
          else row.passed++;
        }
        files.set(name, row);
      }
      for (const child of suite.suites || []) walk(child);
    };
    for (const suite of report.suites) walk(suite);
    const run = {
      report: `${path.basename(root)}/${file}`,
      sha256: createHash("sha256").update(bytes).digest("hex"),
      startedAt: report.stats.startTime,
      durationMs: report.stats.duration,
      globalErrors: report.errors || [],
      files: [...files.values()],
    };
    runs.push(run);
    for (const row of run.files) {
      const previous = latest.get(row.file);
      if (!previous || Date.parse(run.startedAt) >= Date.parse(previous.startedAt))
        latest.set(row.file, { ...row, report: run.report, startedAt: run.startedAt });
    }
  }
}
runs.sort((a, b) => Date.parse(a.startedAt) - Date.parse(b.startedAt));
const missing = expected.filter((file) => !latest.has(file)),
  files = expected.flatMap((file) => (latest.has(file) ? [latest.get(file)] : [])),
  totals = Object.fromEntries(
    ["passed", "failed", "skipped", "flaky", "expectedFailures"].map((key) => [
      key,
      files.reduce((sum, row) => sum + row[key], 0),
    ]),
  );
const report = {
  collectedAt: new Date().toISOString(),
  sourceRevisionAtCollection: execFileSync("git", ["rev-parse", "HEAD"], {
    encoding: "utf8",
  }).trim(),
  note: "Individual test-run revisions were not recorded by Playwright. The full run spans branch implementation and upstream merges; affected files are rerun. Latest full-file reports supersede earlier ones, including failures; every earlier report and failure remains below",
  expectedFiles: expected.length,
  complete: !missing.length,
  allLatestExpected:
    !missing.length &&
    !totals.failed &&
    !totals.flaky &&
    !runs.some(
      (run) =>
        run.globalErrors.length &&
        run.files.some((file) => latest.get(file.file)?.report === run.report),
    ),
  totals,
  missing,
  files,
  runs,
};
await fs.mkdir(path.dirname(out), { recursive: true });
await fs.writeFile(out + ".json", JSON.stringify(report, null, 2) + "\n");
const table = files
  .map(
    (row) =>
      `| ${row.file} | ${row.passed} | ${row.failed} | ${row.skipped} | ${row.flaky} | ${row.report} |`,
  )
  .join("\n");
await fs.writeFile(
  out + ".md",
  `# Round 4 test ledger\n\n${report.note}\n\nFiles: ${files.length}/${expected.length}. Latest totals: ${JSON.stringify(totals)}. Missing: ${missing.length}.\n\n| File | Passed | Failed | Skipped | Flaky | Latest report |\n| --- | ---: | ---: | ---: | ---: | --- |\n${table}\n`,
);
console.log(
  JSON.stringify({
    files: files.length,
    expected: expected.length,
    totals,
    missing: missing.length,
    failedFiles: files.filter((row) => row.failed).map((row) => row.file),
  }),
);
