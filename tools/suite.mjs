#!/usr/bin/env node
// The full test run, file by file (docs/OPERATING.md, "Running the suite fast"). Each spec file
// runs in its own single-worker Playwright process with a JSON report of its own, so:
//
// - a run picks up where it stopped: a container restart (or a stop) loses only the files that
//   were running, and the same command carries on with the rest;
// - several files run at once (--jobs), the longest first, so the slow files don't all land at
//   the end;
// - the run can be split across sessions (--shard), each taking an even share of the time.
//
// Nothing in the tests changes: the same files, the same config, no retries.
//
//   node tools/suite.mjs                  # every file, one at a time; resumes .cache/suite
//   node tools/suite.mjs --jobs=2         # two files at once (the Integrators' command)
//   node tools/suite.mjs --fresh          # forget the last run and start over
//   node tools/suite.mjs --shard=1/2      # half of the files by time (another session runs 2/2)
//   node tools/suite.mjs --files=kit,taps # only these files (tests/<name>.spec.mjs)
//   node tools/suite.mjs --out=DIR        # keep this run's reports in DIR (default .cache/suite)
//   node tools/suite.mjs --save-times     # also write each file's time to tools/suite.json
//   node tools/suite.mjs --report         # print the summary of the run in --out, run nothing
//   node tools/suite.mjs --gl=llvmpipe    # WebGL2 on Mesa's llvmpipe in a virtual display
//                                         # (playwright.config.mjs, SPLASHERY_GL)
//   node tools/suite.mjs -- --trace=on    # anything after "--" goes to Playwright as it is
//
// SPLASHERY_CHROMIUM defaults to /opt/pw-browsers/chromium when that exists (the cloud
// container). SPLASHERY_PORT is honored as in playwright.config.mjs. The summary (pass and fail
// lists, the slowest files and tests) is printed at the end and saved as <out>/summary.md; the
// exit code is 1 when any test failed or a file could not run.

import fs from "node:fs";
import path from "node:path";
import http from "node:http";
import { spawn } from "node:child_process";

const root = path.resolve(path.dirname(new URL(import.meta.url).pathname), "..");
// Anything after "--" goes to every Playwright process as it is (e.g. -- --trace=on).
const dash = process.argv.indexOf("--");
const PASS = dash >= 0 ? process.argv.slice(dash + 1) : [];
const OWN = dash >= 0 ? process.argv.slice(0, dash) : process.argv;
const arg = (name, fallback = null) => {
  const a = OWN.find((x) => x === `--${name}` || x.startsWith(`--${name}=`));
  if (!a) return fallback;
  return a.includes("=") ? a.slice(a.indexOf("=") + 1) : true;
};
const OUT = path.resolve(root, arg("out", ".cache/suite"));
const JOBS = Math.max(1, Number(arg("jobs", 1)) || 1);
const PORT = Number(process.env.SPLASHERY_PORT) || 4173;
const PLAN = path.join(root, "tools/suite.json");

const env = { ...process.env };
if (!env.SPLASHERY_CHROMIUM && fs.existsSync("/opt/pw-browsers/chromium"))
  env.SPLASHERY_CHROMIUM = "/opt/pw-browsers/chromium";
const GL = arg("gl", env.SPLASHERY_GL || "swiftshader");
if (!["swiftshader", "llvmpipe"].includes(GL)) {
  console.error("--gl is swiftshader (the default) or llvmpipe");
  process.exit(2);
}
env.SPLASHERY_GL = GL;

// ---- Which files, in which order ---------------------------------------------------------------

const all = fs
  .readdirSync(path.join(root, "tests"))
  .filter((f) => f.endsWith(".spec.mjs"))
  .map((f) => f.slice(0, -".spec.mjs".length))
  .sort();
const timing = fs.existsSync(PLAN) ? JSON.parse(fs.readFileSync(PLAN, "utf8")) : {};
const times = timing.seconds || {};
// Files that check the wall clock (a clip's speed, a swing's timing) and fail when another file
// shares the CPUs: with --jobs above 1 they run at the end, one at a time, with nothing beside them.
const SOLO = new Set(timing.solo || []);
// Files that fail on llvmpipe (a tight wall-clock window, physics that settles differently): they
// run on SwiftShader even in a --gl=llvmpipe run.
const ON_SWIFTSHADER = new Set(timing.swiftshader || []);
// A file with no time yet counts as a slow one, so it starts early.
const timeOf = (f) => times[f] ?? 120;

let files = all;
const only = arg("files");
if (typeof only === "string") {
  const want = only.split(",").map((s) => s.trim().replace(/\.spec\.mjs$/, ""));
  const missing = want.filter((f) => !all.includes(f));
  if (missing.length) {
    console.error(`No such test files: ${missing.map((f) => `tests/${f}.spec.mjs`).join(", ")}`);
    process.exit(2);
  }
  files = want;
}
const shard = arg("shard");
if (typeof shard === "string") {
  const [i, n] = shard.split("/").map(Number);
  if (!(n >= 1 && i >= 1 && i <= n)) {
    console.error("--shard is i/n, e.g. --shard=1/2");
    process.exit(2);
  }
  // Longest first into the lightest share: every session gets about the same time.
  const shares = Array.from({ length: n }, () => ({ t: 0, files: [] }));
  for (const f of [...files].sort((a, b) => timeOf(b) - timeOf(a) || a.localeCompare(b))) {
    const s = shares.reduce((lo, s) => (s.t < lo.t ? s : lo));
    s.t += timeOf(f);
    s.files.push(f);
  }
  files = shares[i - 1].files;
}
files = [...files].sort((a, b) => timeOf(b) - timeOf(a) || a.localeCompare(b));

// ---- One file's run ----------------------------------------------------------------------------

const reportOf = (f) => path.join(OUT, `${f}.json`);

function collect(report) {
  const tests = [];
  const walk = (suite, titles) => {
    for (const spec of suite.specs || [])
      for (const t of spec.tests)
        for (const r of t.results)
          tests.push({
            title: [...titles, spec.title].join(" › "),
            line: spec.line,
            status: r.status,
            seconds: r.duration / 1000,
            error: (r.error?.message || "").replace(/\x1b\[[0-9;]*m/g, "").split("\n")[0],
          });
    for (const s of suite.suites || []) walk(s, [...titles, s.title]);
  };
  // The top suites are the files; the ones inside them are describe() blocks.
  for (const file of report.suites || []) walk(file, []);
  return tests;
}

function runFile(f) {
  return new Promise((done) => {
    const tmp = path.join(OUT, `${f}.json.part`);
    const started = Date.now();
    const pattern = `[\\\\/]${f.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\.spec\\.mjs$`;
    const child = spawn(
      "npx",
      ["playwright", "test", pattern, "--workers=1", "--reporter=json", `--output=${path.join(OUT, "results", f)}`, ...PASS], // prettier-ignore
      { cwd: root, env: { ...env, PLAYWRIGHT_JSON_OUTPUT_NAME: tmp, ...(ON_SWIFTSHADER.has(f) ? { SPLASHERY_GL: "swiftshader" } : {}) }, stdio: ["ignore", "pipe", "pipe"] }, // prettier-ignore
    );
    const log = fs.createWriteStream(path.join(OUT, `${f}.log`));
    child.stdout.pipe(log);
    child.stderr.pipe(log);
    child.on("close", (code) => {
      const wall = (Date.now() - started) / 1000;
      let report = null;
      try {
        report = JSON.parse(fs.readFileSync(tmp, "utf8"));
      } catch {}
      if (report) {
        report.suiteRun = { wall, code };
        fs.writeFileSync(reportOf(f), JSON.stringify(report));
        fs.rmSync(tmp, { force: true });
      }
      done({ f, wall, code, ok: !!report });
    });
  });
}

// ---- The test server ---------------------------------------------------------------------------

const answers = () =>
  new Promise((ok) => {
    const req = http.get(`http://127.0.0.1:${PORT}/`, (res) => (res.resume(), ok(true)));
    req.on("error", () => ok(false));
    req.setTimeout(3000, () => (req.destroy(), ok(false)));
  });

async function serve() {
  // Every Playwright process would start its own server otherwise, all at once on one port.
  if (await answers()) return null;
  const server = spawn("python3", ["-m", "http.server", String(PORT), "--bind", "127.0.0.1"], {
    cwd: root,
    stdio: "ignore",
  });
  for (let i = 0; i < 100 && !(await answers()); i++) await new Promise((ok) => setTimeout(ok, 100)); // prettier-ignore
  return server;
}

// The virtual display a headed browser needs for llvmpipe: one Xvfb for the whole run.
async function display() {
  if (GL !== "llvmpipe" || env.DISPLAY) return null;
  for (let n = 90; n < 110; n++) {
    if (fs.existsSync(`/tmp/.X${n}-lock`)) continue;
    const x = spawn("Xvfb", [`:${n}`, "-screen", "0", "1920x1080x24", "-nolisten", "tcp"], { stdio: "ignore" }); // prettier-ignore
    await new Promise((ok) => setTimeout(ok, 1000));
    if (x.exitCode === null) {
      env.DISPLAY = `:${n}`;
      return x;
    }
  }
  console.error("Could not start Xvfb for --gl=llvmpipe.");
  process.exit(2);
}

// ---- The summary -------------------------------------------------------------------------------

const fmt = (s) => (s >= 3600 ? `${Math.floor(s / 3600)} h ${Math.round((s % 3600) / 60)} min` : s >= 60 ? `${Math.round(s / 60)} min` : `${Math.round(s)} s`); // prettier-ignore

function summary(list, elapsed) {
  const rows = [];
  const tests = [];
  for (const f of list) {
    if (!fs.existsSync(reportOf(f))) continue;
    const report = JSON.parse(fs.readFileSync(reportOf(f), "utf8"));
    const ts = collect(report).map((t) => ({ ...t, file: f }));
    tests.push(...ts);
    rows.push({ f, wall: report.suiteRun?.wall ?? report.stats.duration / 1000, n: ts.length, bad: ts.filter((t) => !["passed", "skipped"].includes(t.status)).length }); // prettier-ignore
  }
  const missing = list.filter((f) => !fs.existsSync(reportOf(f)));
  const failed = tests.filter((t) => !["passed", "skipped"].includes(t.status));
  const skipped = tests.filter((t) => t.status === "skipped");
  const fileTime = rows.reduce((s, r) => s + r.wall, 0);
  const out = [];
  out.push(`# Suite run`, "");
  out.push(`- ${rows.length} of ${list.length} files, ${tests.length} tests: ${tests.length - failed.length - skipped.length} passed, ${failed.length} failed, ${skipped.length} skipped.`); // prettier-ignore
  out.push(`- Time in files (one after another): ${fmt(fileTime)}.${elapsed ? ` Wall time of this run: ${fmt(elapsed)} (${JOBS} at once).` : ""}`); // prettier-ignore
  if (missing.length) out.push(`- Not run yet: ${missing.join(", ")}.`);
  out.push("", "## Failed", "");
  if (!failed.length) out.push("None.");
  for (const t of failed) out.push(`- \`${t.file}:${t.line}\` ${t.title}: ${t.status}. ${t.error}`);
  out.push("", "## Slowest files", "", "| File | Seconds | Tests |", "| --- | ---: | ---: |");
  for (const r of [...rows].sort((a, b) => b.wall - a.wall).slice(0, 25))
    out.push(`| ${r.f} | ${Math.round(r.wall)} | ${r.n} |`);
  out.push("", "## Slowest tests", "", "| Test | Seconds |", "| --- | ---: |");
  for (const t of [...tests].sort((a, b) => b.seconds - a.seconds).slice(0, 25))
    out.push(`| \`${t.file}:${t.line}\` ${t.title.slice(0, 90)} | ${Math.round(t.seconds)} |`);
  out.push("");
  return { text: out.join("\n"), rows, failed, missing };
}

// ---- Run ---------------------------------------------------------------------------------------

if (arg("report")) {
  const s = summary(files);
  console.log(s.text);
  process.exit(s.failed.length || s.missing.length ? 1 : 0);
}

if (arg("fresh")) fs.rmSync(OUT, { recursive: true, force: true });
fs.mkdirSync(OUT, { recursive: true });
const todo = files.filter((f) => !fs.existsSync(reportOf(f)));
console.log(`${files.length - todo.length} of ${files.length} files already done in ${path.relative(root, OUT) || "."}; running ${todo.length}, ${JOBS} at once, WebGL2 on ${GL}.`); // prettier-ignore

const server = await serve();
const xvfb = await display();
const t0 = Date.now();
let finished = 0;
async function lane(queue) {
  while (queue.length) {
    const f = queue.shift();
    const r = await runFile(f);
    finished++;
    const s = r.ok ? summary([f]) : null;
    const note = !r.ok
      ? "no report (see its .log)"
      : s.failed.length
        ? `${s.failed.length} failed`
        : "ok";
    console.log(`[${finished}/${todo.length}] ${f} ${Math.round(r.wall)} s: ${note}`);
  }
}
const shared = JOBS > 1 ? todo.filter((f) => !SOLO.has(f)) : [...todo];
const alone = JOBS > 1 ? todo.filter((f) => SOLO.has(f)) : [];
await Promise.all(Array.from({ length: Math.min(JOBS, shared.length) }, () => lane(shared)));
await lane(alone);
server?.kill();
xvfb?.kill();

const s = summary(files, (Date.now() - t0) / 1000);
fs.writeFileSync(path.join(OUT, "summary.md"), s.text);
console.log("\n" + s.text);
if (arg("save-times") && !s.missing.length) {
  const seconds = { ...times };
  for (const r of s.rows) seconds[r.f] = Math.round(r.wall);
  const sorted = Object.fromEntries(Object.keys(seconds).filter((f) => all.includes(f)).sort().map((f) => [f, seconds[f]])); // prettier-ignore
  fs.writeFileSync(PLAN, JSON.stringify({ ...timing, seconds: sorted }, null, 2) + "\n");
}
process.exit(s.failed.length || s.missing.length ? 1 : 0);
