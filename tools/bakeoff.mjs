#!/usr/bin/env node
// Helpers for a blind bake-off of AI coding models (.claude/skills/bakeoff/SKILL.md). No
// dependencies. The key (which code is which branch) and the list of who made which branch stay in
// private files OUTSIDE the repository: this tool refuses to write a key or a reveal inside a git
// repository, and it never prints the mapping before the reveal.
//
//   node tools/bakeoff.mjs codes --entries <file> --out <key.tsv> [--seed N] [--avoid <old-key.tsv>] [--force]
//   node tools/bakeoff.mjs cards --judge <dir> --out <batch.json> [--key <key.tsv>] [--partial]
//                                [--recode-from <old-key.tsv>] [--asset-map <map.json>]
//                                [--deny-file <words.txt>] [--at YYYY-MM-DD] [--seed N]
//                                [--chunk 50] [--force]
//   node tools/bakeoff.mjs reveal --key <key.tsv> --verdicts <dir> --who <who.tsv> [--out <file.md>]
//
// codes   Reads the entries file (one branch per line, for example bake/x-t1; blank lines and lines
//         starting with # are skipped). The task number comes from the "-t<N>" at the end of the
//         branch. A branch that has no such ending (a tool named it) takes the task from a second
//         column: "codex/some-name 3". Gives every entry a random two-character code (a capital
//         letter except I and O, then a digit 2 to 9), unique across all entries, and writes a TSV
//         (task, branch, code) to --out with mode 600. It prints only the count. It refuses to run
//         when --out is inside a git repository (the current one, or the one --out is in) and
//         when --out exists (unless --force; a new key would orphan every card already posted).
//         --avoid reads an earlier key and never reuses its codes (a later round, so the owner
//         can't recognize an entry). --seed makes the draw repeatable (for tests).
// cards   Reads the judges' output files in --judge (*.json; each holds one entry
//         {code, task, said, now, asset?, video?} or an array of them) and writes an ArtifactData
//         batch file {writes: [{op: "set", collection: "cards", doc_id: "t<N>-<code>", data: {...}}]}
//         with the entries of each task in a random order. More than --chunk writes (50) go into
//         numbered files (batch-1.json, batch-2.json). It stops on a branch name, a pull request
//         number, a co-author footer, a session link, a tool or company name or an "Entry <letter>"
//         label in a card's text (it names the code and the kind of match, never the text), plus
//         every word in --deny-file (one per line; keep that file outside the repository, since it
//         holds the model names). --force writes anyway. With --key it also checks that every
//         entry in the key has a card (--partial allows missing ones) and no card is stray.
//         --recode-from <old key> with --key <new key> moves files that carry an OLD round's codes
//         to the new codes (matching on the branch), and --asset-map {"<old id>": "<new id>"}
//         rewrites the clip ids of those moved files (their clips were copied to the new page),
//         for a later round.
// reveal  Joins the key, the owner's exported verdicts (--verdicts: a folder of JSON files, either
//         one file per card named t<N>-<code>.json, or lists of {id, verdict, tags, note}) and
//         --who (TSV: branch letter, or a whole branch, then the contestant). It REFUSES unless
//         every card has a verdict, a tag or a note. Prints a table per task (contestant, code,
//         verdict, tags), the owner's notes, and a summary with the "Best in this task" counts.
//         --out saves the same as Markdown (outside the repository, too).
//
// Test: a throwaway folder of made-up branches (bake/x-t1) and temp files, then delete them.

import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import { spawnSync } from "node:child_process";

const LETTERS = "ABCDEFGHJKLMNPQRSTUVWXYZ"; // no I and no O
const DIGITS = "23456789";
const CODE_RE = /^[A-HJ-NP-Z][2-9]$/;
const BEST = "Best in this task";
const SHOWN = { good: "Looks right", fix: "Needs work" };

const die = (msg) => {
  console.error(`bakeoff: ${msg}`);
  process.exit(1);
};

// ---- arguments ------------------------------------------------------------------------------

const VALUE_FLAGS = new Set([
  "entries",
  "out",
  "seed",
  "avoid",
  "judge",
  "key",
  "recode-from",
  "asset-map",
  "deny-file",
  "at",
  "chunk",
  "verdicts",
  "who",
]);
const BOOL_FLAGS = new Set(["force", "partial"]);

function parseFlags(argv) {
  const flags = {};
  for (let i = 0; i < argv.length; i++) {
    const m = /^--([\w-]+)(?:=(.*))?$/.exec(argv[i]);
    if (!m) die(`unexpected argument "${argv[i]}"`);
    const [, name, inline] = m;
    if (BOOL_FLAGS.has(name)) flags[name] = true;
    else if (VALUE_FLAGS.has(name)) {
      const v = inline ?? argv[++i];
      if (v === undefined || v.startsWith("--")) die(`--${name} needs a value`);
      flags[name] = v;
    } else die(`unknown option --${name}`);
  }
  return flags;
}

const need = (flags, ...names) => {
  for (const n of names)
    if (!flags[n]) die(`--${n} is required for this command (see the header of tools/bakeoff.mjs)`);
};

// ---- random numbers -------------------------------------------------------------------------

function makeRand(seed) {
  if (seed === undefined) return () => crypto.randomInt(0, 2 ** 32) / 2 ** 32;
  let a = Number(seed) >>> 0; // mulberry32
  if (!Number.isFinite(Number(seed))) die("--seed must be a number");
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function shuffle(list, rand) {
  const a = [...list];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

// ---- files and the private-key rule ---------------------------------------------------------

const readText = (file, what) => {
  try {
    return fs.readFileSync(file, "utf8");
  } catch {
    return die(`cannot read ${what} ${file}`);
  }
};
const readJson = (file, what) => {
  try {
    return JSON.parse(fs.readFileSync(file, "utf8"));
  } catch (e) {
    return die(`cannot read ${what} ${file} as JSON (${e.message})`);
  }
};

function nearestExisting(p) {
  let cur = p;
  while (!fs.existsSync(cur)) {
    const up = path.dirname(cur);
    if (up === cur) break;
    cur = up;
  }
  return cur;
}

function gitTop(dir) {
  const r = spawnSync("git", ["rev-parse", "--show-toplevel"], { cwd: dir, encoding: "utf8" });
  return r.status === 0 && r.stdout.trim() ? fs.realpathSync(r.stdout.trim()) : null;
}

// Stops when `file` would be inside a git repository: the one the command runs in, or the one
// the file's own folder belongs to. Checked before anything is created.
function refuseInsideRepo(file, what) {
  const abs = path.resolve(file);
  const existing = nearestExisting(abs);
  const real = path.join(fs.realpathSync(existing), path.relative(existing, abs));
  const dirReal = nearestExisting(path.dirname(real));
  const tops = new Set([gitTop(process.cwd()), gitTop(dirReal)].filter(Boolean));
  for (const top of tops) {
    const rel = path.relative(top, real);
    if (rel === "" || (!rel.startsWith("..") && !path.isAbsolute(rel)))
      die(
        `refusing to write ${what} inside a git repository (${top}). Pick a private folder outside it.`,
      );
  }
}

function writePrivate(file, text, what, mode = 0o600) {
  refuseInsideRepo(file, what);
  fs.mkdirSync(path.dirname(path.resolve(file)), { recursive: true });
  fs.writeFileSync(file, text, { mode });
  fs.chmodSync(file, mode);
}

// ---- keys -----------------------------------------------------------------------------------

const normTask = (v) => {
  const m = /^t?(\d+)$/i.exec(String(v ?? "").trim());
  return m ? `t${Number(m[1])}` : null;
};

function tsvRows(text) {
  return text
    .split(/\r?\n/)
    .map((l) => l.replace(/\s+$/, ""))
    .filter((l) => l && !l.startsWith("#"))
    .map((l) => l.split("\t"));
}

// The key: [{ task: "t1", branch, code }]
function readKey(file) {
  const rows = tsvRows(readText(file, "the key"));
  const key = [];
  const seenCode = new Set();
  const seenBranch = new Set();
  for (const r of rows) {
    if (String(r[0]).toLowerCase() === "task") continue; // header
    const task = normTask(r[0]);
    const branch = (r[1] || "").trim();
    const code = (r[2] || "").trim();
    if (!task || !branch || !CODE_RE.test(code)) die(`the key ${file} has a malformed row`);
    if (seenCode.has(`${task}-${code}`)) die(`the key ${file} repeats a code in ${task}`);
    if (seenBranch.has(branch)) die(`the key ${file} repeats a branch`);
    seenCode.add(`${task}-${code}`);
    seenBranch.add(branch);
    key.push({ task, branch, code });
  }
  if (!key.length) die(`the key ${file} has no rows`);
  return key;
}

// ---- codes ----------------------------------------------------------------------------------

function cmdCodes(f) {
  need(f, "entries", "out");
  const entries = [];
  const seen = new Set();
  for (const raw of readText(f.entries, "the entries file").split(/\r?\n/)) {
    const line = raw.trim();
    if (!line || line.startsWith("#")) continue;
    const [branch, extra] = line.split(/\s+/);
    let task = extra ? normTask(extra) : null;
    if (extra && !task) die(`bad task "${extra}" (use 3 or t3)`);
    if (!task) {
      const m = /-t(\d+)$/i.exec(branch);
      if (!m) die(`branch "${branch}" has no -t<N> ending; give its task as a second column`);
      task = `t${Number(m[1])}`;
    }
    if (seen.has(branch)) die(`branch "${branch}" is listed twice`);
    seen.add(branch);
    entries.push({ task, branch });
  }
  if (!entries.length) die("the entries file lists no branches");

  const avoid = new Set(f.avoid ? readKey(f.avoid).map((k) => k.code) : []);
  const pool = [];
  for (const l of LETTERS) for (const d of DIGITS) if (!avoid.has(l + d)) pool.push(l + d);
  if (entries.length > pool.length)
    die(`${entries.length} entries need more codes than the ${pool.length} free ones`);

  refuseInsideRepo(f.out, "the key");
  if (fs.existsSync(f.out) && !f.force)
    die(
      `${f.out} already exists. A new key would orphan every card already posted; use --force only for a fresh bake-off.`,
    );

  const codes = shuffle(pool, makeRand(f.seed));
  const rows = entries.map((e, i) => [e.task, e.branch, codes[i]].join("\t"));
  writePrivate(f.out, ["task\tbranch\tcode", ...rows, ""].join("\n"), "the key");
  const tasks = new Set(entries.map((e) => e.task)).size;
  console.log(
    `Wrote ${entries.length} codes for ${tasks} task${tasks === 1 ? "" : "s"} to ${f.out} (mode 600). The mapping is not printed; keep the file private.`,
  );
}

// ---- cards ----------------------------------------------------------------------------------

const LEAKS = [
  ["a branch name", /\bbake\/[\w.-]+|\b[\w.-]+\/[\w.-]*-t\d+\b/i],
  ["a pull request number or link", /\bPRs?\s*#?\d+|pull request\s*#\d+|\(#\d+\)|\/pull\/\d+/i],
  ["a co-author or generated-with footer", /co-authored-by|generated with|\u{1F916}/iu],
  ["a session link", /claude\.ai\/code|\bsession_[0-9A-Za-z]{6,}/i],
  ["a tool or company name", /\b(anthropic|openai|claude|codex|chatgpt|copilot|gemini)\b/i],
  ["an entry's letter label", /\bEntry [A-Z]\b(?!\d)/],
];

function leaksIn(text, deny) {
  const clean = String(text).replace(/\b(CLAUDE|AGENTS)\.md\b/g, "");
  const hits = LEAKS.filter(([, re]) => re.test(clean)).map(([label]) => label);
  if (deny.some((re) => re.test(clean))) hits.push("a word from the deny file");
  return hits;
}

function readJudgeFiles(dir) {
  let names;
  try {
    names = fs
      .readdirSync(dir)
      .filter((n) => n.endsWith(".json"))
      .sort();
  } catch {
    return die(`cannot read the judge folder ${dir}`);
  }
  if (!names.length) die(`no .json files in ${dir}`);
  const out = [];
  for (const n of names) {
    const j = readJson(path.join(dir, n), "a judge file");
    for (const item of Array.isArray(j) ? j : [j]) out.push({ file: n, item });
  }
  return out;
}

function cmdCards(f) {
  need(f, "judge", "out");
  const rand = makeRand(f.seed);
  const at = f.at || new Date().toISOString().slice(0, 10);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(at)) die("--at must look like 2026-10-10");
  const chunk = f.chunk ? Number(f.chunk) : 50;
  if (!Number.isInteger(chunk) || chunk < 1) die("--chunk must be a whole number of 1 or more");
  const deny = f["deny-file"]
    ? tsvRows(readText(f["deny-file"], "the deny file"))
        .map((r) => r[0].trim())
        .filter(Boolean)
        .map((w) => new RegExp(`\\b${w.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\b`, "i"))
    : [];

  const key = f.key ? readKey(f.key) : null;
  let oldKey = null;
  if (f["recode-from"]) {
    if (!key) die("--recode-from needs --key (the NEW key)");
    oldKey = readKey(f["recode-from"]);
  }
  const assetMap = f["asset-map"] ? readJson(f["asset-map"], "the asset map") : null;

  const cards = new Map();
  const problems = [];
  const warnings = [];
  for (const { file, item } of readJudgeFiles(f.judge)) {
    const task = normTask(item?.task);
    let code = String(item?.code ?? "").trim();
    const label = `${file}${code ? ` (${code})` : ""}`;
    if (!task || !CODE_RE.test(code)) {
      problems.push(`${label}: needs a task and a code like R7`);
      continue;
    }
    const oldRow = oldKey?.find((k) => k.task === task && k.code === code);
    if (oldRow) {
      const now = key.find((k) => k.branch === oldRow.branch);
      if (!now) {
        problems.push(`${label}: its entry is not in the new key`);
        continue;
      }
      if (key.some((k) => k.task === task && k.code === code && k.branch !== oldRow.branch)) {
        problems.push(
          `${label}: the old code is also a different entry in the new key (make the new key with --avoid)`,
        );
        continue;
      }
      code = now.code;
    }
    const said = typeof item.said === "string" ? item.said.trim() : "";
    const nowText = typeof item.now === "string" ? item.now.trim() : "";
    if (!said || !nowText) problems.push(`${code}: said and now must both have text`);
    let asset = item.asset ? String(item.asset) : "";
    if (asset && assetMap && oldRow) {
      if (!assetMap[asset]) problems.push(`${code}: its clip is not in the asset map`);
      else asset = assetMap[asset];
    }
    if (asset && !/^[0-9a-f]{32}$/.test(asset))
      problems.push(`${code}: asset must be 32 hex characters`);
    if (item.video !== undefined && typeof item.video !== "boolean")
      problems.push(`${code}: video must be true or false`);
    for (const field of ["said", "now"]) {
      const hits = leaksIn(item[field] ?? "", deny);
      if (hits.length && !f.force) problems.push(`${code}: ${field} holds ${hits.join(", ")}`);
      if (new RegExp(`\\b${code}\\b`).test(item[field] ?? ""))
        warnings.push(
          `${code}: ${field} names its own code (a recoded card in a later round would show the old one)`,
        );
    }
    const extra = Object.keys(item).filter(
      (k) => !["code", "task", "said", "now", "asset", "video"].includes(k),
    );
    if (extra.length)
      warnings.push(`${code}: ignored field${extra.length > 1 ? "s" : ""} ${extra.join(", ")}`);
    const id = `${task}-${code}`;
    if (cards.has(id)) problems.push(`${code}: two files hold a card for ${task}`);
    cards.set(id, { id, task, code, said, now: nowText, asset, video: item.video });
  }

  if (key) {
    const inKey = new Set(key.map((k) => `${k.task}-${k.code}`));
    const stray = [...cards.keys()].filter((id) => !inKey.has(id));
    if (stray.length) problems.push(`cards that are not in the key: ${stray.join(", ")}`);
    const missing = [...inKey].filter((id) => !cards.has(id));
    if (missing.length && !f.partial)
      problems.push(
        `entries in the key with no card: ${missing.join(", ")} (use --partial for a first batch)`,
      );
  }
  if (problems.length) {
    console.error(problems.map((p) => `bakeoff: ${p}`).join("\n"));
    process.exit(1);
  }

  const tasks = [...new Set([...cards.values()].map((c) => c.task))].sort(
    (a, b) => Number(a.slice(1)) - Number(b.slice(1)),
  );
  const writes = [];
  for (const task of tasks) {
    const mine = [...cards.values()]
      .filter((c) => c.task === task)
      .sort((a, b) => a.code.localeCompare(b.code));
    if (new Set(mine.map((c) => c.said)).size > 1)
      warnings.push(`${task}: the "said" text differs between entries (it should be the same)`);
    const lens = mine.map((c) => c.now.length);
    if (Math.max(...lens) > 1.8 * Math.min(...lens))
      warnings.push(
        `${task}: card lengths differ a lot (${Math.min(...lens)} to ${Math.max(...lens)} characters)`,
      );
    shuffle(mine, rand).forEach((c, i) => {
      const data = {
        lane: c.task,
        name: `Entry ${c.code}`,
        said: c.said,
        now: c.now,
        order: i + 1,
        at,
      };
      if (c.asset) data.asset = c.asset;
      if (typeof c.video === "boolean") data.video = c.video;
      writes.push({ op: "set", collection: "cards", doc_id: c.id, data });
    });
  }

  const parts = [];
  for (let i = 0; i < writes.length; i += chunk) parts.push(writes.slice(i, i + chunk));
  const ext = path.extname(f.out);
  const base = f.out.slice(0, f.out.length - ext.length);
  const files =
    parts.length === 1 ? [f.out] : parts.map((_, i) => `${base}-${i + 1}${ext || ".json"}`);
  fs.mkdirSync(path.dirname(path.resolve(f.out)), { recursive: true });
  parts.forEach((p, i) =>
    fs.writeFileSync(files[i], JSON.stringify({ writes: p }, null, 2) + "\n"),
  );
  for (const w of warnings) console.error(`bakeoff: warning: ${w}`);
  console.log(
    `Wrote ${writes.length} card${writes.length === 1 ? "" : "s"} for ${tasks.length} task${tasks.length === 1 ? "" : "s"} to ${files.join(", ")}.`,
  );
}

// ---- reveal ---------------------------------------------------------------------------------

const isCardId = (s) => /^t\d+-[A-HJ-NP-Z][2-9]$/.test(s);

function readVerdicts(dir) {
  let names;
  try {
    names = fs
      .readdirSync(dir)
      .filter((n) => n.endsWith(".json"))
      .sort();
  } catch {
    return die(`cannot read the verdicts folder ${dir}`);
  }
  if (!names.length) die(`no .json files in ${dir}`);
  const docs = new Map();
  const take = (id, data) => {
    if (typeof id === "string" && isCardId(id) && data && typeof data === "object")
      docs.set(id, data.data && typeof data.data === "object" ? data.data : data);
  };
  for (const n of names) {
    const j = readJson(path.join(dir, n), "a verdicts file");
    const list = Array.isArray(j)
      ? j
      : Array.isArray(j?.docs)
        ? j.docs
        : Array.isArray(j?.documents)
          ? j.documents
          : null;
    if (list) for (const d of list) take(d?.id ?? d?.doc_id, d);
    else take(j?.id ?? j?.doc_id ?? path.basename(n, ".json"), j);
  }
  return docs;
}

const isMarked = (m) =>
  !!(
    m &&
    (m.verdict ||
      (Array.isArray(m.tags) && m.tags.some((t) => typeof t === "string" && t)) ||
      String(m.note ?? "").trim())
  );

function cmdReveal(f) {
  need(f, "key", "verdicts", "who");
  if (f.out) refuseInsideRepo(f.out, "the reveal");
  const key = readKey(f.key);
  const verdicts = readVerdicts(f.verdicts);

  const unmarked = key
    .map((k) => `${k.task}-${k.code}`)
    .filter((id) => !isMarked(verdicts.get(id)));
  if (unmarked.length) {
    die(
      `not every card is marked yet (${unmarked.length} of ${key.length} left: ${unmarked.join(", ")}). The reveal waits until the owner has marked them all.`,
    );
  }

  const who = new Map(
    tsvRows(readText(f.who, "the who file")).map((r) => [
      String(r[0]).trim().toLowerCase(),
      String(r[1] ?? "").trim(),
    ]),
  );
  const contestantOf = (branch) => {
    const letter = /^(?:.*\/)?(.+)-t\d+$/i.exec(branch)?.[1];
    return who.get(branch.toLowerCase()) || (letter && who.get(letter.toLowerCase())) || null;
  };
  const unknown = key.filter((k) => !contestantOf(k.branch)).map((k) => `${k.task}-${k.code}`);
  if (unknown.length) die(`the who file does not name a contestant for: ${unknown.join(", ")}`);

  const rows = key.map((k) => {
    const m = verdicts.get(`${k.task}-${k.code}`);
    const tags = Array.isArray(m.tags) ? m.tags.filter((t) => typeof t === "string" && t) : [];
    return {
      ...k,
      who: contestantOf(k.branch),
      verdict: SHOWN[m.verdict] || "(none)",
      tags,
      note: String(m.note ?? "").trim(),
    };
  });
  const byTask = (a, b) => Number(a.task.slice(1)) - Number(b.task.slice(1));
  const tasks = [...new Set(rows.map((r) => r.task))].sort(
    (a, b) => Number(a.slice(1)) - Number(b.slice(1)),
  );
  const cell = (s) => String(s).replace(/\|/g, "\\|").replace(/\n+/g, " ");

  const md = ["# Bake-off reveal", ""];
  const bestBy = {};
  for (const task of tasks) {
    const mine = rows
      .filter((r) => r.task === task)
      .sort((a, b) => a.who.localeCompare(b.who) || a.code.localeCompare(b.code));
    md.push(
      `## ${task}`,
      "",
      "| Contestant | Code | Verdict | Tags |",
      "| --- | --- | --- | --- |",
    );
    for (const r of mine)
      md.push(
        `| ${cell(r.who)} | ${r.code} | ${r.verdict} | ${cell(r.tags.join("; ") || "(none)")} |`,
      );
    const best = mine.filter((r) => r.tags.includes(BEST));
    md.push(
      "",
      `${BEST}: ${best.length ? best.map((r) => `${r.who} (${r.code})`).join(", ") : "nobody"}`,
      "",
    );
    bestBy[task] = best.length;
  }

  const people = [...new Set(rows.map((r) => r.who))].sort();
  md.push(
    "## Summary",
    "",
    `| Contestant | Cards | Looks right | Needs work | ${BEST} |`,
    "| --- | --- | --- | --- | --- |",
  );
  for (const p of people) {
    const mine = rows.filter((r) => r.who === p);
    const n = (fn) => mine.filter(fn).length;
    md.push(
      `| ${cell(p)} | ${mine.length} | ${n((r) => r.verdict === SHOWN.good)} | ${n((r) => r.verdict === SHOWN.fix)} | ${n((r) => r.tags.includes(BEST))} |`,
    );
  }
  const notes = rows.filter((r) => r.note).sort(byTask);
  if (notes.length) {
    md.push("", "## The owner's notes", "");
    for (const r of notes)
      md.push(`- ${r.task}, ${r.who} (${r.code}): ${r.note.replace(/\n+/g, " ")}`);
  }
  const stray = [...verdicts.keys()].filter((id) => !key.some((k) => `${k.task}-${k.code}` === id));
  if (stray.length)
    md.push(
      "",
      `Not in the key (ignored): ${stray.length} verdict document${stray.length === 1 ? "" : "s"}.`,
    );
  md.push("");

  console.log(md.join("\n"));
  if (f.out) {
    writePrivate(f.out, md.join("\n"), "the reveal", 0o600);
    console.error(`Saved to ${f.out}. Share it privately; never put it in the repository.`);
  }
}

// ---- main -----------------------------------------------------------------------------------

const [cmd, ...rest] = process.argv.slice(2);
const COMMANDS = { codes: cmdCodes, cards: cmdCards, reveal: cmdReveal };
if (!cmd || cmd === "--help" || cmd === "-h" || !COMMANDS[cmd]) {
  const src = fs.readFileSync(new URL(import.meta.url), "utf8").split("\n");
  const end = src.findIndex((l, i) => i > 0 && !l.startsWith("//"));
  console.log(
    src
      .slice(1, end)
      .map((l) => l.replace(/^\/\/ ?/, ""))
      .join("\n"),
  );
  process.exit(cmd && !COMMANDS[cmd] && cmd !== "--help" && cmd !== "-h" ? 2 : 0);
}
COMMANDS[cmd](parseFlags(rest));
