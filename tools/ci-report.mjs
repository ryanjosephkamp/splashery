#!/usr/bin/env node
// The test suite on GitHub Actions (docs/CI.md). Two steps of .github/workflows/tests.yml:
//
//   node tools/ci-report.mjs recheck DIR --shard=3/16 --started=<epoch seconds>
//       In a suite shard, after `tools/suite.mjs --out=DIR`: runs each failing test once more,
//       alone (its file and line, and its title), and writes DIR/recheck.json; writes the shard's
//       own times to DIR/shard.json. The failures still count.
//
//   node tools/ci-report.mjs summary ROOT [--out=FILE]
//       In the summary job, with every shard's DIR downloaded under ROOT: one Markdown report
//       (the counts, every failure with its file:line and whether it passed alone, the files that
//       never reported, the time per shard, the slowest files). It starts with the line
//       <!-- splashery-ci --> so the workflow can find its PR comment and update it in place.
//       Exit code 1 when any test failed or a file did not report.
//
// The shards share suite.mjs's JSON reports, one per spec file (<file>.json), so nothing in the
// tests or in suite.mjs changes for CI.

import fs from "node:fs";
import path from "node:path";
import { spawn } from "node:child_process";

const root = path.resolve(path.dirname(new URL(import.meta.url).pathname), "..");
const [cmd, dirArg] = process.argv.slice(2);
const arg = (name, fallback = null) => {
  const a = process.argv.find((x) => x.startsWith(`--${name}=`));
  return a ? a.slice(name.length + 3) : fallback;
};
const timing = JSON.parse(fs.readFileSync(path.join(root, "tools/suite.json"), "utf8"));
const ON_SWIFTSHADER = new Set(timing.swiftshader || []);
// Tests known to fail on plain main too, as file:line (docs/OPERATOR.md, "Known flaky tests"):
// marked in the report, still counted.
const KNOWN = new Set(timing.known || []);
const MARK = "<!-- splashery-ci -->";
const bad = (t) => !["passed", "skipped"].includes(t.status);

// Each test of a Playwright JSON report (the same walk as tools/suite.mjs).
function collect(report, file) {
  const tests = [];
  const walk = (suite, titles) => {
    for (const spec of suite.specs || [])
      for (const t of spec.tests)
        for (const r of t.results)
          tests.push({
            file,
            line: spec.line,
            name: spec.title,
            title: [...titles, spec.title].join(" › "),
            status: r.status,
            seconds: r.duration / 1000,
            error: (r.error?.message || "").replace(/\x1b\[[0-9;]*m/g, "").split("\n")[0],
          });
    for (const s of suite.suites || []) walk(s, [...titles, s.title]);
  };
  for (const f of report.suites || []) walk(f, []);
  return tests;
}

const reports = (dir) =>
  fs
    .readdirSync(dir)
    .filter((f) => f.endsWith(".json") && !["shard.json", "recheck.json"].includes(f))
    .map((f) => {
      const file = f.slice(0, -".json".length);
      const report = JSON.parse(fs.readFileSync(path.join(dir, f), "utf8"));
      return { file, wall: report.suiteRun?.wall ?? report.stats.duration / 1000, tests: collect(report, file) }; // prettier-ignore
    });

const fmt = (s) => (s >= 3600 ? `${Math.floor(s / 3600)} h ${Math.round((s % 3600) / 60)} min` : s >= 60 ? `${Math.round(s / 60)} min` : `${Math.round(s)} s`); // prettier-ignore
const esc = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

// ---- recheck -----------------------------------------------------------------------------------

function rerun(t, dir) {
  return new Promise((done) => {
    const out = path.join(dir, `${t.file}-${t.line}.json`);
    const env = { ...process.env, PLAYWRIGHT_JSON_OUTPUT_NAME: out };
    if (ON_SWIFTSHADER.has(t.file)) env.SPLASHERY_GL = "swiftshader";
    // By file and exact title, not by line: a line can name every test a loop declares on it, and
    // the report's lines for hh5-gems came out shifted on Actions (133 for the test at 119). A
    // file's titles are unique, and the grep runs over the whole title path, so " <title>$" picks one.
    const args = ["playwright", "test", `tests/${t.file}.spec.mjs`, "-g", ` ${esc(t.name)}$`, "--workers=1", "--reporter=json", `--output=${path.join(dir, "results", `${t.file}-${t.line}`)}`]; // prettier-ignore
    const child = spawn("npx", args, { cwd: root, env, stdio: ["ignore", "ignore", "pipe"] });
    child.stderr.resume();
    child.on("close", () => {
      try {
        const ts = collect(JSON.parse(fs.readFileSync(out, "utf8")), t.file).filter((x) => x.name === t.name); // prettier-ignore
        done(ts.length ? (ts.some(bad) ? "failed" : "passed") : "not found");
      } catch {
        done("no report");
      }
    });
  });
}

if (cmd === "recheck") {
  const dir = path.resolve(dirArg);
  fs.mkdirSync(dir, { recursive: true });
  const runs = reports(dir);
  const failed = runs.flatMap((r) => r.tests.filter(bad));
  const started = Number(arg("started")) || null;
  const shardTime = { shard: arg("shard"), files: runs.length, wall: started ? Date.now() / 1000 - started : null }; // prettier-ignore
  // Enough to tell a flake from a real failure without a broken branch keeping a runner for hours.
  const BUDGET = Number(arg("budget", 1200)) * 1000;
  const t0 = Date.now();
  const recheck = {};
  for (const t of failed) {
    const key = `${t.file}:${t.line} ${t.name}`;
    if (key in recheck) continue;
    if (Date.now() - t0 > BUDGET) {
      recheck[key] = "not rerun (time budget)";
      continue;
    }
    recheck[key] = await rerun(t, path.join(dir, "recheck"));
    console.log(`${key}: ${recheck[key]} alone`);
  }
  fs.writeFileSync(path.join(dir, "recheck.json"), JSON.stringify(recheck, null, 2) + "\n");
  fs.writeFileSync(path.join(dir, "shard.json"), JSON.stringify(shardTime) + "\n");
  console.log(`${failed.length} failed in this shard; ${Object.keys(recheck).length} rechecked.`);
  process.exit(0);
}

// ---- summary -----------------------------------------------------------------------------------

if (cmd === "summary") {
  const base = path.resolve(dirArg);
  // A run whose shards all died before uploading leaves no folder: every file then counts as missing.
  fs.mkdirSync(base, { recursive: true });
  const shardDirs = fs.existsSync(base)
    ? fs.readdirSync(base).map((d) => path.join(base, d)).filter((d) => fs.statSync(d).isDirectory()) // prettier-ignore
    : [];
  // suite-<shard>-a<attempt>: a rerun of the failed jobs adds a newer attempt of some shards, and
  // the newest report of each spec file wins.
  const attempt = (d) => Number(/-a(\d+)$/.exec(d)?.[1] || 0);
  shardDirs.sort((a, b) => attempt(a) - attempt(b));
  const byFile = new Map();
  const byShard = new Map();
  const recheck = {};
  for (const d of shardDirs) {
    for (const r of reports(d)) byFile.set(r.file, r);
    if (fs.existsSync(path.join(d, "shard.json"))) {
      const s = JSON.parse(fs.readFileSync(path.join(d, "shard.json"), "utf8"));
      byShard.set(s.shard, s);
    }
    if (fs.existsSync(path.join(d, "recheck.json")))
      Object.assign(recheck, JSON.parse(fs.readFileSync(path.join(d, "recheck.json"), "utf8")));
  }
  const runs = [...byFile.values()];
  const shards = [...byShard.values()];
  const all = fs.readdirSync(path.join(root, "tests")).filter((f) => f.endsWith(".spec.mjs")).map((f) => f.slice(0, -".spec.mjs".length)); // prettier-ignore
  const seen = new Set(runs.map((r) => r.file));
  const missing = all.filter((f) => !seen.has(f)).sort();
  const tests = runs.flatMap((r) => r.tests);
  const failed = tests.filter(bad);
  const skipped = tests.filter((t) => t.status === "skipped");
  const passed = tests.length - failed.length - skipped.length;
  const env = process.env;
  const sha = (env.HEAD_SHA || env.GITHUB_SHA || "").slice(0, 7);
  const runUrl = env.GITHUB_RUN_ID ? `${env.GITHUB_SERVER_URL}/${env.GITHUB_REPOSITORY}/actions/runs/${env.GITHUB_RUN_ID}` : null; // prettier-ignore
  const wall = env.RUN_STARTED ? Date.now() / 1000 - new Date(env.RUN_STARTED).getTime() / 1000 : null; // prettier-ignore
  const ok = !failed.length && !missing.length && runs.length > 0;

  const out = [MARK];
  out.push(`## ${ok ? "✅" : "❌"} Test suite on GitHub Actions${sha ? ` (\`${sha}\`)` : ""}`, "");
  out.push(`- ${runs.length} of ${all.length} spec files, ${tests.length} tests: ${passed} passed, ${failed.length} failed, ${skipped.length} skipped.`); // prettier-ignore
  const longest = shards.reduce((m, s) => Math.max(m, s.wall || 0), 0);
  out.push(`- ${shards.length} shard${shards.length === 1 ? "" : "s"}; the longest took ${fmt(longest)}${wall ? `; the whole run about ${fmt(wall)} so far` : ""}.${runUrl ? ` [The run](${runUrl}) has the reports and failure screenshots (kept 7 days).` : ""}`); // prettier-ignore
  if (missing.length) out.push(`- **No report** (the file crashed, timed out, or its shard was canceled): ${missing.map((f) => `\`${f}\``).join(", ")}.`); // prettier-ignore
  out.push("", "### Failed", "");
  if (!failed.length) out.push("None.");
  else {
    out.push("| Test | Alone | Error |", "| --- | --- | --- |");
    for (const t of failed.sort((a, b) => a.file.localeCompare(b.file) || a.line - b.line)) {
      const again = recheck[`${t.file}:${t.line} ${t.name}`] || "not rerun";
      const alone = again === "passed" ? "**passed alone**" : again;
      const flaky = KNOWN.has(`${t.file}:${t.line}`) ? " (known on main)" : "";
      const cell = (s) => s.replace(/\|/g, "\\|").replace(/\s+/g, " ").slice(0, 160);
      out.push(`| \`${t.file}:${t.line}\`${flaky} ${cell(t.title)} | ${alone} | ${t.status}: ${cell(t.error)} |`); // prettier-ignore
    }
    out.push("", "A failure that passed alone is likely a flake (a busy runner); it still counts. One that failed alone too is real."); // prettier-ignore
  }
  if (shards.length) {
    out.push("", "<details><summary>Time per shard</summary>", "", "| Shard | Files | Time |", "| --- | ---: | ---: |"); // prettier-ignore
    for (const s of shards.sort(
      (a, b) => Number(a.shard.split("/")[0]) - Number(b.shard.split("/")[0]),
    ))
      out.push(`| ${s.shard} | ${s.files} | ${s.wall ? fmt(s.wall) : "?"} |`);
    out.push("", "</details>");
  }
  out.push("", "<details><summary>Slowest files</summary>", "", "| File | Seconds | Tests |", "| --- | ---: | ---: |"); // prettier-ignore
  for (const r of [...runs].sort((a, b) => b.wall - a.wall).slice(0, 20))
    out.push(`| ${r.file} | ${Math.round(r.wall)} | ${r.tests.length} |`);
  out.push("", "</details>", "");
  let text = out.join("\n");
  // A PR comment holds 65,536 characters.
  if (text.length > 60000) text = text.slice(0, 60000) + "\n\n… cut; the job summary of the run has the rest.\n"; // prettier-ignore
  const file = arg("out");
  if (file) fs.writeFileSync(file, text);
  console.log(text);
  // The seconds per file, for tuning the shards (tools/suite.json, "seconds").
  fs.writeFileSync(path.join(base, "times.json"), JSON.stringify(Object.fromEntries(runs.map((r) => [r.file, Math.round(r.wall)]).sort()), null, 2) + "\n"); // prettier-ignore
  process.exit(ok ? 0 : 1);
}

console.error("usage: node tools/ci-report.mjs recheck DIR --shard=i/n --started=SECONDS | summary ROOT [--out=FILE]"); // prettier-ignore
process.exit(2);
