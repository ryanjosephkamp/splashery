#!/usr/bin/env node
// The Operator's merge routine in one command (docs/OPERATING.md, "The merge tool"). It makes the
// merge branch from main, merges each PR head in order, settles conflicts in generated files and
// in the sound review, checks the shared lists, regenerates site/ and the other generated files,
// runs the specs the merged PRs touched and writes a ready PR body. Long output goes to a log file;
// the console gets one line per step.
//
//   node tools/op-merge.mjs --topic oct7c --pr 391:<sha> --pr 389:<sha> \
//     --title 391="Phase Space r3: handoff after merge" --title 389="Phase Showcase: …" \
//     --trailer-file .cache/trailers.txt
//
//   --topic <name>       the branch is claude/operator-merge-<name> (required)
//   --pr <n>:<sha>       a PR head, merged in the order given (one or more; use the full sha)
//   --title <n>="…"      the PR's title for the merge message (otherwise the head commit's subject)
//   --trailer-file <f>   lines added to the end of every commit message (Co-Authored-By, Session)
//   --base <ref>         what the branch starts from (default origin/main)
//   --no-fetch           don't fetch the base or missing PR heads from origin
//   --no-tests           skip the specs (the format and spelling checks still run)
//   --spec <file>        a spec to run as well (repeatable)
//   --dry-run            only predict: which merges conflict and how each would be settled
//                        (git merge-tree; no branch or file is touched)
//   --continue           after a stop on a real conflict: resolve and `git add` the files, then
//                        rerun the same command with --continue (on the merge branch)
//   --repo <dir>         the checkout to work in (default: the one you are in)
//
// It never pushes, never opens or merges a PR and never touches a branch other than the merge
// branch. Exit codes: 0 all green, 1 stopped (a real conflict, a broken shared list, bad input),
// 3 finished but a check or spec failed (listed under Known issues in the PR body).
//
// Writes .cache/op-merge/<topic>-pr.md (the PR body) and .cache/op-merge/<topic>.log.

import fs from "node:fs";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { pathToFileURL } from "node:url";

const toolRoot = path.resolve(path.dirname(new URL(import.meta.url).pathname), "..");

// ---- Input ---------------------------------------------------------------------------------

function parseArgs(argv) {
  const o = { prs: [], titles: {}, specs: [], base: "origin/main", fetch: true, tests: true };
  const want = (i) => {
    if (argv[i + 1] === undefined) fail(`${argv[i]} needs a value`);
    return argv[i + 1];
  };
  for (let i = 0; i < argv.length; i++) {
    let a = argv[i];
    let v;
    if (a.startsWith("--") && a.includes("="))
      [a, v] = [a.slice(0, a.indexOf("=")), a.slice(a.indexOf("=") + 1)];
    const val = () => (v !== undefined ? v : want(i++));
    if (a === "--topic") o.topic = val();
    else if (a === "--pr") {
      const m = /^#?(\d+):([0-9a-f]{7,40})$/i.exec(val());
      if (!m) fail(`--pr takes <n>:<sha>, as in --pr 391:3085258a…`);
      o.prs.push({ n: Number(m[1]), sha: m[2].toLowerCase() });
    } else if (a === "--title") {
      const m = /^#?(\d+)=(.*)$/s.exec(val());
      if (!m) fail(`--title takes <n>="…"`);
      o.titles[Number(m[1])] = m[2].trim();
    } else if (a === "--trailer-file") o.trailerFile = val();
    else if (a === "--base") o.base = val();
    else if (a === "--spec") o.specs.push(val());
    else if (a === "--repo") o.repo = val();
    else if (a === "--no-fetch") o.fetch = false;
    else if (a === "--no-tests") o.tests = false;
    else if (a === "--dry-run") o.dryRun = true;
    else if (a === "--continue") o.cont = true;
    else fail(`unknown option ${a} (see the top of tools/op-merge.mjs)`);
  }
  if (!o.topic || !/^[\w.-]+$/.test(o.topic))
    fail("--topic <name> is required (letters, digits, - . _)");
  if (!o.prs.length) fail("give at least one --pr <n>:<sha>");
  return o;
}

function fail(msg) {
  console.error(`op-merge: ${msg}`);
  process.exit(1);
}

const opts = parseArgs(process.argv.slice(2));
const repo = spawnSync("git", ["rev-parse", "--show-toplevel"], {
  cwd: path.resolve(opts.repo || "."),
  encoding: "utf8",
}).stdout?.trim();
if (!repo) fail("not inside a git checkout");
const outDir = path.join(repo, ".cache/op-merge");
fs.mkdirSync(outDir, { recursive: true });
const logFile = path.join(outDir, `${opts.topic}.log`);
fs.writeFileSync(logFile, `op-merge ${new Date().toISOString()}\n`);
const branch = `claude/operator-merge-${opts.topic}`;

// ---- Running things ------------------------------------------------------------------------

function sh(cmd, args, { env, input } = {}) {
  const r = spawnSync(cmd, args, {
    cwd: repo,
    encoding: "utf8",
    maxBuffer: 1 << 28,
    env: { ...process.env, ...env },
    input,
  });
  const plain = (t) => (t || "").replace(/\x1b\[[0-9;]*m/g, "");
  const out = plain(r.stdout) + plain(r.stderr);
  fs.appendFileSync(logFile, `\n$ ${[cmd, ...args].join(" ")}\n${out}(exit ${r.status})\n`);
  return { status: r.status ?? 1, out, stdout: plain(r.stdout) };
}
function git(...args) {
  const r = sh("git", args);
  if (r.status !== 0) stop(`git ${args.join(" ")} failed:\n${tail(r.out)}`);
  return r.stdout.trim();
}
const gitOk = (...args) => sh("git", args).status === 0;
const tail = (s, n = 15) => s.trimEnd().split("\n").slice(-n).join("\n");
const exists = (rel) => fs.existsSync(path.join(repo, rel));
const say = (s) => console.log(s);

const prettierBin = fs.existsSync(path.join(toolRoot, "node_modules/.bin/prettier"))
  ? [path.join(toolRoot, "node_modules/.bin/prettier")]
  : ["npx", "prettier"];
const prettier = (...args) => sh(prettierBin[0], [...prettierBin.slice(1), ...args]);

// ---- What a conflict is --------------------------------------------------------------------

const SOUND_REVIEW = "tools/sound-review.json";
const SHARED_LISTS = ["src/toys.js", "src/toy-help.js", "src/toy-sounds.js"];
// Generated: rebuilt from the sources below, so either side will do. site/assets/ is hand-written.
function isGenerated(f) {
  if (f.startsWith("site/")) return !f.startsWith("site/assets/");
  return ["docs/TOY-PLAN.md", "src/showcase/facts.json", ".cache/pages/sound-board.html"].includes(
    f,
  );
}

const same = (a, b) => JSON.stringify(sortKeys(a)) === JSON.stringify(sortKeys(b));
function sortKeys(v) {
  if (Array.isArray(v)) return v.map(sortKeys);
  if (v && typeof v === "object")
    return Object.fromEntries(
      Object.keys(v)
        .sort()
        .map((k) => [k, sortKeys(v[k])]),
    );
  return v;
}

// A 3-way merge of two objects, key by key. A key both sides changed differently is a conflict,
// except "toys" at the top, which is merged one toy at a time.
function merge3(base, ours, theirs, where, conflicts) {
  const has = (o, k) => o != null && Object.prototype.hasOwnProperty.call(o, k);
  const keys = Object.keys(ours);
  // Keys only theirs has go after the key that precedes them on their side.
  let after = null;
  for (const k of Object.keys(theirs)) {
    if (!keys.includes(k))
      keys.splice(after === null ? keys.length : keys.indexOf(after) + 1, 0, k);
    after = k;
  }
  const out = {};
  for (const k of keys) {
    const [b, o, t] = [base?.[k], ours[k], theirs[k]];
    const [bh, oh, th] = [has(base, k), has(ours, k), has(theirs, k)];
    if (oh === th && (!oh || same(o, t))) {
      if (oh) out[k] = o;
    } else if (bh === oh && (!oh || same(b, o))) {
      if (th) out[k] = t;
    } else if (bh === th && (!th || same(b, t))) {
      if (oh) out[k] = o;
    } else if (where === "" && k === "toys" && [o, t].every((x) => x && typeof x === "object")) {
      out[k] = merge3(b || {}, o, t, "toys.", conflicts);
    } else {
      conflicts.push(where + k);
      if (oh) out[k] = o;
    }
  }
  return out;
}

// Merges three versions of tools/sound-review.json; returns { text } or { conflicts }.
function mergeSoundReview(baseText, oursText, theirsText) {
  let docs;
  try {
    docs = [baseText ?? "{}", oursText, theirsText].map((t) => JSON.parse(t));
  } catch (e) {
    return { conflicts: [`a side doesn't parse (${e.message})`] };
  }
  const conflicts = [];
  const merged = merge3(docs[0], docs[1], docs[2], "", conflicts);
  return conflicts.length ? { conflicts } : { text: JSON.stringify(merged, null, 2) + "\n" };
}

const showStage = (n, f) => {
  const r = sh("git", ["show", `:${n}:${f}`]);
  return r.status === 0 ? r.stdout : null;
};

// Settles what it can in a conflicted merge; returns the files left for a person.
function settle(conflicted, notes) {
  const left = [];
  const gen = [];
  for (const f of conflicted) {
    if (isGenerated(f)) {
      if (showStage(2, f) !== null) git("checkout", "--ours", "--", f);
      else if (showStage(3, f) !== null) git("checkout", "--theirs", "--", f);
      if (exists(f)) git("add", "--", f);
      else git("rm", "-q", "--cached", "--ignore-unmatch", "--", f);
      gen.push(f);
    } else if (f === SOUND_REVIEW) {
      const [o, t] = [showStage(2, f), showStage(3, f)];
      const r =
        o === null || t === null
          ? { conflicts: ["one side deleted it"] }
          : mergeSoundReview(showStage(1, f), o, t);
      if (r.conflicts) {
        notes.push(`${f}: needs a person (${r.conflicts.slice(0, 8).join(", ")})`);
        left.push(f);
      } else {
        fs.writeFileSync(path.join(repo, f), r.text);
        prettier("--write", f);
        git("add", "--", f);
        notes.push(`${f}: merged toy by toy`);
      }
    } else left.push(f);
  }
  if (gen.length) notes.push(`generated, took one side and rebuilt: ${summarize(gen)}`);
  return left;
}

function summarize(files) {
  const site = files.filter((f) => f.startsWith("site/"));
  const rest = files.filter((f) => !f.startsWith("site/"));
  return [
    ...(site.length ? [`site/ (${site.length} file${site.length > 1 ? "s" : ""})`] : []),
    ...rest,
  ].join(", ");
}

// ---- The report ------------------------------------------------------------------------------

const report = {
  merged: [], // { n, sha, title, notes: [] }
  checks: [],
  regen: [],
  rebuild: null,
  specs: null,
  format: null,
  spelling: null,
  issues: [],
  warnings: [],
  cut: [],
};

function stop(msg) {
  console.log(`\nSTOPPED: ${msg}`);
  console.log(`Log: ${path.relative(repo, logFile)}`);
  process.exit(1);
}

// ---- Start -----------------------------------------------------------------------------------

const hasOrigin = gitOk("remote", "get-url", "origin");
if (opts.fetch && hasOrigin && opts.base.startsWith("origin/")) {
  if (!gitOk("fetch", "-q", "origin", opts.base.slice("origin/".length)))
    say(`warning: couldn't fetch ${opts.base}; using the local copy`);
}
const baseSha = git("rev-parse", "--verify", `${opts.base}^{commit}`);

for (const pr of opts.prs) {
  let full = sh("git", ["rev-parse", "--verify", "-q", `${pr.sha}^{commit}`]).stdout.trim();
  if (!full && opts.fetch && hasOrigin) {
    sh("git", ["fetch", "-q", "origin", `pull/${pr.n}/head`]);
    full = sh("git", ["rev-parse", "--verify", "-q", `${pr.sha}^{commit}`]).stdout.trim();
  }
  if (!full) stop(`#${pr.n}: commit ${pr.sha} isn't here (fetch it, or check the sha)`);
  pr.sha = full;
  pr.title = opts.titles[pr.n];
  if (!pr.title) {
    pr.title = git("log", "-1", "--format=%s", full);
    report.warnings.push(
      `#${pr.n}: no --title given, so the merge message uses its head commit's subject.`,
    );
  }
}

const trailers = opts.trailerFile
  ? fs.readFileSync(path.resolve(opts.trailerFile), "utf8").trim()
  : "";
const message = (subject) => (trailers ? `${subject}\n\n${trailers}\n` : `${subject}\n`);
const msgFile = path.join(outDir, `${opts.topic}.msg`);
const prList = opts.prs.map((p) => `#${p.n}`).join(", ");

// The files each PR changes, against where it meets the base.
for (const pr of opts.prs) {
  const mb = sh("git", ["merge-base", baseSha, pr.sha]).stdout.trim() || baseSha;
  pr.files = git("diff", "--name-only", mb, pr.sha).split("\n").filter(Boolean);
  pr.newKit = /^\+.*kind: "kit"/m.test(sh("git", ["diff", "-U0", mb, pr.sha, "--", "src/"]).stdout);
}

if (opts.dryRun) dryRun();

// ---- 1 and 2. The merges -----------------------------------------------------------------------

const dirty = sh("git", ["status", "--porcelain", "--untracked-files=no"]).stdout.trim();
const inMerge = gitOk("rev-parse", "-q", "--verify", "MERGE_HEAD");
if (opts.cont) {
  if (git("rev-parse", "--abbrev-ref", "HEAD") !== branch)
    stop(`--continue runs on ${branch}; check it out first`);
  if (inMerge) {
    const unmerged = git("diff", "--name-only", "--diff-filter=U");
    if (unmerged) stop(`these files still have conflicts:\n  ${unmerged.split("\n").join("\n  ")}`);
    const pending = opts.prs.find((p) => p.sha === git("rev-parse", "MERGE_HEAD"));
    fs.writeFileSync(
      msgFile,
      message(`Merge #${pending?.n ?? "?"} (${pending?.title ?? "resolved by hand"})`),
    );
    git("commit", "-q", "-F", msgFile);
    say(`merge #${pending?.n}: committed the hand-resolved merge`);
  } else if (dirty) stop(`the working tree has changes; commit or stash them first:\n${dirty}`);
} else {
  if (dirty || inMerge)
    stop(
      `the working tree has changes or a merge in progress; finish or stash it first:\n${dirty}`,
    );
  git("checkout", "-q", "-B", branch, baseSha);
  say(`branch ${branch} at ${opts.base} (${baseSha.slice(0, 8)})`);
}

for (const pr of opts.prs) {
  const entry = { ...pr, notes: [] };
  report.merged.push(entry);
  if (gitOk("merge-base", "--is-ancestor", pr.sha, "HEAD")) {
    say(`merge #${pr.n}: already on the branch`);
    continue;
  }
  fs.writeFileSync(msgFile, message(`Merge #${pr.n} (${pr.title})`));
  const r = sh("git", ["merge", "--no-ff", "-q", "-F", msgFile, pr.sha]);
  if (r.status === 0) {
    say(`merge #${pr.n}: clean`);
    continue;
  }
  const conflicted = git("diff", "--name-only", "--diff-filter=U").split("\n").filter(Boolean);
  if (!conflicted.length) stop(`git merge of #${pr.n} failed:\n${tail(r.out)}`);
  const left = settle(conflicted, entry.notes);
  if (left.length) {
    stop(
      `#${pr.n} (${pr.title}) conflicts in files a person must resolve:\n` +
        left.map((f) => `  ${f}`).join("\n") +
        (entry.notes.length ? `\nSettled already: ${entry.notes.join("; ")}` : "") +
        `\nThe merge is left in progress on ${branch}. Either resolve those files, \`git add\` them and` +
        ` rerun this command with --continue, or \`git merge --abort\`.`,
    );
  }
  git("commit", "-q", "-F", msgFile);
  say(`merge #${pr.n}: settled (${entry.notes.join("; ")})`);
}

// ---- 3. The shared lists ---------------------------------------------------------------------

for (const f of SHARED_LISTS) {
  if (!exists(f)) continue;
  const r = sh("node", ["--check", f]);
  if (r.status !== 0) stop(`${f} doesn't parse after the merges:\n${tail(r.out)}`);
  report.checks.push(f);
}
for (const f of ["tools/toy-plan.json", "tools/assets.json", "tools/models.json", SOUND_REVIEW]) {
  if (!exists(f)) continue;
  try {
    JSON.parse(fs.readFileSync(path.join(repo, f), "utf8"));
  } catch (e) {
    stop(`${f} isn't valid JSON after the merges: ${e.message}`);
  }
  report.checks.push(f);
}
say(`checks: ${report.checks.length} shared lists parse`);

// ---- 4. Regenerate ---------------------------------------------------------------------------

const REGEN_PATHS = ["site", "docs/TOY-PLAN.md", "src/showcase/facts.json", "tools/assets.json"];
for (const t of ["tools/toy-plan.mjs", "tools/site-build.mjs", "tools/shw-facts.mjs"]) {
  if (!exists(t)) continue;
  const r = sh("node", [t]);
  if (r.status !== 0) stop(`node ${t} failed after the merges:\n${tail(r.out)}`);
  report.regen.push(`\`node ${t}\``);
}
const toFormat = REGEN_PATHS.filter(exists);
if (toFormat.length) prettier("--write", ...toFormat);
for (const t of ["tools/site-build.mjs", "tools/shw-facts.mjs"]) {
  if (!exists(t)) continue;
  const ok = sh("node", [t, "--check"]).status === 0;
  report.regen.push(`\`${path.basename(t, ".mjs")} --check\` ${ok ? "passes" : "FAILS"}`);
  if (!ok) report.issues.push(`\`node ${t} --check\` fails right after a rebuild (see the log).`);
}
const regenPaths = REGEN_PATHS.filter((p) => exists(p) || gitOk("cat-file", "-e", `HEAD:${p}`));
const changed = regenPaths.length ? git("status", "--porcelain", "--", ...regenPaths) : "";
if (changed) {
  git("add", "-A", "--", ...regenPaths);
  fs.writeFileSync(msgFile, message(`Ops: rebuild site/ after ${prList}`));
  git("commit", "-q", "-F", msgFile);
  report.rebuild = { sha: git("rev-parse", "HEAD"), files: changed.split("\n").length };
  say(`rebuild: committed ${report.rebuild.files} file(s) (${report.rebuild.sha.slice(0, 8)})`);
} else say("rebuild: nothing changed");
const stray = git("status", "--porcelain", "--untracked-files=no");
if (stray)
  report.issues.push(
    `The rebuild left other files changed (not committed): ${stray.replace(/\n/g, "; ")}`,
  );

// ---- 5. Specs, format and spelling -----------------------------------------------------------

const allFiles = [...new Set(opts.prs.flatMap((p) => p.files))];
const specMap = pickSpecs(allFiles);
const specs = [...specMap.keys()];
if (!opts.tests) report.cut.push("The specs (run with --no-tests).");
else if (!specs.length) report.specs = { list: [], why: specMap, counts: {}, failed: [] };
else {
  say(
    `specs: running ${specs.length} (${specs.map((s) => path.basename(s, ".spec.mjs")).join(", ")})`,
  );
  const env = {};
  if (!process.env.SPLASHERY_CHROMIUM && fs.existsSync("/opt/pw-browsers/chromium"))
    env.SPLASHERY_CHROMIUM = "/opt/pw-browsers/chromium";
  const shotsBefore = untrackedShots();
  const r = sh("npx", ["playwright", "test", ...specs, "--workers=1", "--reporter=list"], { env });
  fs.writeFileSync(path.join(outDir, `${opts.topic}-tests.log`), r.out);
  report.specs = { list: specs, why: specMap, ...countResults(r.out) };
  if (r.status !== 0 && !report.specs.counts.failed) report.specs.counts.failed = "?";
  // Put the screenshots back as the merge left them.
  if (exists("tests/screenshots")) {
    sh("git", ["restore", "--source=HEAD", "--staged", "--worktree", "--", "tests/screenshots"]);
    for (const f of untrackedShots()) if (!shotsBefore.has(f)) fs.rmSync(path.join(repo, f));
  }
  const c = report.specs.counts;
  say(`specs: ${c.passed || 0} passed, ${c.failed || 0} failed, ${c.skipped || 0} skipped`);
  if (c.failed)
    report.issues.push(`Specs failed: ${report.specs.failed.join("; ") || "see the test log"}.`);
}

{
  const ignores = exists(".claude/worktrees")
    ? [
        "--ignore-path",
        ".gitignore",
        "--ignore-path",
        ".prettierignore",
        "--ignore-path",
        ".git/info/exclude",
      ]
    : [];
  const r = prettier("--check", ".", ...ignores);
  const bad = r.out
    .split("\n")
    .filter((l) => /^\[warn\] (?!Code style)/.test(l))
    .map((l) => l.slice(7));
  report.format =
    r.status === 0 ? "clean" : bad.length ? `${bad.length} file(s): ${bad.join(", ")}` : "failed";
  if (r.status !== 0) report.issues.push(`\`npx prettier --check .\`: ${report.format}`);
  say(`prettier --check: ${report.format}`);
}
if (exists("tools/us-english.mjs")) {
  const r = sh("node", ["tools/us-english.mjs", `--diff=${baseSha}`]);
  const hits = r.stdout.split("\n").filter((l) => /:\d+:/.test(l));
  report.spelling = r.status === 0 ? "clean" : `${hits.length || "some"} line(s)`;
  if (r.status !== 0)
    report.issues.push(`\`us-english --diff\` lists ${report.spelling}:\n${tail(r.stdout, 10)}`);
  say(`us-english --diff: ${report.spelling}`);
}

// ---- 6. The PR body --------------------------------------------------------------------------

const prFile = path.join(outDir, `${opts.topic}-pr.md`);
fs.writeFileSync(prFile, prBody());
const head = git("rev-parse", "HEAD");
const title = `Ops: merge ${opts.prs.map((p) => shortName(p.title)).join(", ")}`;
say(`\nDone: ${branch} at ${head.slice(0, 8)}. Push it, then open the PR.`);
say(`Title: ${title}`);
say(`Body:  ${path.relative(repo, prFile)}`);
if (report.issues.length) say(`Known issues: ${report.issues.length} (in the body)`);
process.exit(report.issues.length ? 3 : 0);

// ---- Helpers ---------------------------------------------------------------------------------

// The specs to run, each with why: a Map of "tests/x.spec.mjs" → [reasons].
function pickSpecs(files, ref = "HEAD") {
  // The specs in the merged tree (for --dry-run, the simulated merge).
  const specFiles = sh("git", ["ls-tree", "--name-only", ref, "tests/"])
    .stdout.split("\n")
    .map((f) => f.replace(/^tests\//, ""))
    .filter((f) => f.endsWith(".spec.mjs"));
  const picked = new Map();
  const add = (spec, why) => {
    const f = spec.startsWith("tests/") ? spec : `tests/${spec}`;
    if (!specFiles.includes(f.slice(6)) && why !== "--spec") return;
    if (!picked.has(f)) picked.set(f, []);
    if (!picked.get(f).includes(why)) picked.get(f).push(why);
  };
  for (const s of opts.specs) add(s, "--spec");
  for (const f of files) if (/^tests\/[^/]+\.spec\.mjs$/.test(f)) add(f, "changed");
  // A spec's prefix (its name without "-engine") at the start of a changed file's name in src/,
  // tools/ or tests/screenshots/, as in tools/geo-lib.mjs → geo.spec.mjs.
  for (const s of specFiles) {
    const prefix = s.replace(/\.spec\.mjs$/, "").replace(/-engine$/, "");
    if (prefix === "taps" || prefix === "smoke") continue;
    const hit = files.find(
      (f) =>
        /^(src|tools|tests\/screenshots)\//.test(f) &&
        new RegExp(`^${prefix}[-.]`).test(path.basename(f)),
    );
    if (hit) add(s, `prefix of ${hit}`);
  }
  // The shared lists, or a new kit toy: every toy's tap, help text and catalog.
  const lists = files.filter((f) => SHARED_LISTS.includes(f));
  const newKit = opts.prs.filter((p) => p.newKit);
  if (lists.length || newKit.length) {
    const why = [
      ...(lists.length ? [`${lists.join(", ")} changed`] : []),
      ...(newKit.length ? [`a new kit toy (${newKit.map((p) => `#${p.n}`).join(", ")})`] : []),
    ].join("; ");
    for (const s of ["taps", "hta", "help", "unit", "kit"]) add(`${s}.spec.mjs`, why);
  }
  // A pack's recipes: every spec that names one of that pack's toys.
  const packs = files
    .filter((f) => /^src\/packs\/[^/]+\.js$/.test(f))
    .map((f) => path.basename(f, ".js"));
  if (packs.length) {
    const ids = toyIdsByPack();
    const texts = specFiles.map((s) => [s, sh("git", ["show", `${ref}:tests/${s}`]).stdout]);
    for (const pack of packs)
      for (const id of ids.get(pack) || []) {
        const q = id.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
        const named = new RegExp(`["'\`]${q}["'\`]|toy=${q}\\b`);
        for (const [s, text] of texts)
          if (named.test(text)) add(s, `names ${id} (src/packs/${pack}.js)`);
      }
  }
  // Assets: the embed transfer limit and the first load.
  const asset = files.find((f) => f.startsWith("assets/"));
  if (asset) add("smoke.spec.mjs", `assets changed (${asset})`);
  // The preview site's own pages.
  const site = files.find((f) => f.startsWith("site/"));
  if (site) for (const s of ["site", "spg", "tpg"]) add(`${s}.spec.mjs`, `site/ changed (${site})`);
  return new Map([...picked].sort(([a], [b]) => a.localeCompare(b)));
}

// Toy ids by pack, from the checkout's src/toys.js (for --dry-run, the base's).
function toyIdsByPack() {
  const ids = new Map();
  const r = sh("node", [
    "--input-type=module",
    "-e",
    `const { TOYS } = await import(${JSON.stringify(pathToFileURL(path.join(repo, "src/toys.js")).href)});
console.log(JSON.stringify(TOYS.filter((t) => t.pack).map((t) => [t.pack, t.id])));`,
  ]);
  try {
    for (const [pack, id] of JSON.parse(r.stdout)) ids.set(pack, [...(ids.get(pack) || []), id]);
  } catch {
    report.warnings.push("Couldn't read the toy list, so no spec was picked by a pack's toy ids.");
  }
  return ids;
}

function untrackedShots() {
  if (!exists("tests/screenshots")) return new Set();
  const out = sh("git", [
    "ls-files",
    "--others",
    "--exclude-standard",
    "--",
    "tests/screenshots",
  ]).stdout;
  return new Set(out.split("\n").filter(Boolean));
}

function countResults(out) {
  const counts = {};
  for (const m of out.matchAll(
    /^\s+(\d+) (passed|failed|skipped|flaky|did not run|interrupted)\b/gm,
  ))
    counts[m[2]] = Number(m[1]);
  const failed = [];
  const i = out.search(/^\s+\d+ failed\b/m);
  if (i >= 0)
    for (const l of out.slice(i).split("\n").slice(1)) {
      if (!/^\s+\[/.test(l)) break;
      failed.push(l.trim());
    }
  return { counts, failed };
}

function shortName(title) {
  return title
    .replace(/^Phase /, "")
    .split(":")[0]
    .trim();
}

function prBody() {
  const L = [];
  L.push("## Summary", "");
  L.push(
    `Merges ${opts.prs.length} PR${opts.prs.length > 1 ? "s" : ""} into main, in this order:`,
    "",
  );
  for (const p of report.merged) L.push(`- #${p.n} (\`${p.sha.slice(0, 8)}\`): ${p.title}`);
  if (report.rebuild)
    L.push(
      `- Ops: rebuild site/ after ${prList} (\`${report.rebuild.sha.slice(0, 8)}\`, ${report.rebuild.files} file(s))`,
    );
  L.push("", "## Verification", "");
  if (report.checks.length)
    L.push(
      `- The shared lists parse after the merges: ${report.checks.map((f) => `\`${f}\``).join(", ")}.`,
    );
  if (report.regen.length) L.push(`- Regenerated: ${report.regen.join(", ")}.`);
  if (report.specs) {
    const c = report.specs.counts;
    if (!report.specs.list.length) L.push("- Specs: none matched the changed files.");
    else {
      L.push(
        `- Specs the PRs touched (${report.specs.list.length}, \`--workers=1\`): ${c.passed || 0} passed, ` +
          `${c.failed || 0} failed, ${c.skipped || 0} skipped${c.flaky ? `, ${c.flaky} flaky` : ""}. ` +
          "Screenshots restored afterward. Chosen because:",
      );
      for (const [s, why] of report.specs.why)
        L.push(`  - \`${path.basename(s)}\`: ${why.join("; ")}`);
    }
  }
  if (report.format) L.push(`- \`npx prettier --check .\`: ${report.format}.`);
  if (report.spelling) L.push(`- \`node tools/us-english.mjs --diff\`: ${report.spelling}.`);
  L.push("", "## Deviations", "");
  const settled = report.merged.filter((p) => p.notes.length);
  if (!settled.length && !report.warnings.length) L.push("None: every merge was clean.");
  for (const p of settled) L.push(`- #${p.n}: ${p.notes.join("; ")}.`);
  for (const w of report.warnings) L.push(`- ${w}`);
  L.push("", "## Known issues", "");
  L.push(
    report.issues.length
      ? report.issues.map((i) => `- ${i}`).join("\n")
      : "None found by these checks.",
  );
  L.push("", "## What was cut", "");
  L.push(
    [...report.cut, "The full suite (the Integrator's run on main)."]
      .map((c) => `- ${c}`)
      .join("\n"),
    "",
  );
  return L.join("\n");
}

// ---- --dry-run -------------------------------------------------------------------------------

function dryRun() {
  say(`Dry run: ${branch} from ${opts.base} (${baseSha.slice(0, 8)}); nothing is changed.`);
  let cur = baseSha;
  let blocked = false;
  for (const pr of opts.prs) {
    const r = sh("git", [
      "merge-tree",
      "--write-tree",
      "--name-only",
      "--no-messages",
      cur,
      pr.sha,
    ]);
    const lines = r.stdout.split("\n").filter(Boolean);
    if (r.status > 1 || !lines.length) stop(`git merge-tree failed for #${pr.n}:\n${tail(r.out)}`);
    const conflicted = lines.slice(1);
    const notes = [];
    const left = [];
    for (const f of conflicted) {
      if (isGenerated(f)) notes.push(f);
      else if (f === SOUND_REVIEW) {
        const at = (c) => {
          const s = sh("git", ["show", `${c}:${f}`]);
          return s.status === 0 ? s.stdout : null;
        };
        const mb = sh("git", ["merge-base", cur, pr.sha]).stdout.trim();
        const o = at(cur);
        const t = at(pr.sha);
        const m =
          o === null || t === null
            ? { conflicts: ["deleted"] }
            : mergeSoundReview(mb ? at(mb) : null, o, t);
        if (m.conflicts) left.push(`${f} (${m.conflicts.slice(0, 8).join(", ")})`);
        else notes.push(`${f} (toy by toy)`);
      } else left.push(f);
    }
    const gen = notes.filter((f) => isGenerated(f));
    const desc = [
      ...(gen.length ? [`rebuild ${summarize(gen)}`] : []),
      ...notes.filter((f) => !isGenerated(f)).map((f) => `merge ${f}`),
    ];
    if (!conflicted.length)
      say(
        `merge #${pr.n}: clean (${pr.files.length} changed file${pr.files.length === 1 ? "" : "s"})`,
      );
    else if (!left.length) say(`merge #${pr.n}: settles itself: ${desc.join("; ")}`);
    else {
      say(
        `merge #${pr.n}: STOPS on ${left.join(", ")}${desc.length ? ` (would settle: ${desc.join("; ")})` : ""}`,
      );
      blocked = true;
    }
    cur = git("commit-tree", lines[0], "-p", cur, "-p", pr.sha, "-m", `op-merge dry run #${pr.n}`);
  }
  const specs = pickSpecs([...new Set(opts.prs.flatMap((p) => p.files))], cur);
  say(`specs it would run:${specs.size ? "" : " none"}`);
  for (const [s, why] of specs) say(`  ${path.basename(s)}: ${why.join("; ")}`);
  process.exit(blocked ? 1 : 0);
}
