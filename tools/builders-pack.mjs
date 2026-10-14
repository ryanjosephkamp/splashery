#!/usr/bin/env node
// Builds the builders pack: a ZIP of what an outside builder needs (builders/README.md, "Making the
// ZIP"). It holds builders/, CLAUDE.md, README.md, LICENSE, LICENSES.md, CREDITS.md,
// docs/PACKS.md, docs/SCENE-SCHEMA.md and the Tinkerer's Manual as a PDF, laid out as in the
// repo (so the relative links between them keep working), plus PACK-INFO.txt with the commit the
// pack came from. It uses the system `zip` command, so it runs on a Mac and in a container.
//
//   node tools/builders-pack.mjs                  # writes builders-pack-<YYYY-MM-DD>.zip here
//   node tools/builders-pack.mjs --out=DIR        # write it into DIR instead
//   node tools/builders-pack.mjs --date=2026-10-12   # name it for another date
//   node tools/builders-pack.mjs --root=DIR       # pack another checkout (the tests do)
//
// It refuses to run (exit 1, no ZIP) when it finds a token in what it would pack: a Hugging Face
// token (`hf_…`), a GitHub token, an OpenAI-style key, an AWS key, a Slack token, a Google API key
// or a private key block. Nothing secret belongs in a public repo (builders/RULES.md, E3).

import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { execFileSync } from "node:child_process";

const args = process.argv.slice(2);
const opt = (name, def) => {
  const a = args.find((x) => x.startsWith(`--${name}=`));
  return a ? a.slice(name.length + 3) : def;
};
const root = path.resolve(
  opt("root", path.join(path.dirname(new URL(import.meta.url).pathname), "..")),
);
const outDir = path.resolve(opt("out", "."));
const today = new Date();
const stamp =
  opt("date", "") ||
  `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}-${String(today.getDate()).padStart(2, "0")}`; // prettier-ignore
if (!/^\d{4}-\d{2}-\d{2}$/.test(stamp)) {
  console.error("--date must look like 2026-10-12");
  process.exit(2);
}

// What goes in, relative to the repo root. A folder is copied whole.
const PACK = [
  "builders",
  "CLAUDE.md",
  "README.md",
  "LICENSE",
  "LICENSES.md",
  "CREDITS.md",
  "docs/PACKS.md",
  "docs/SCENE-SCHEMA.md",
  "manual/tinkerers-manual.pdf",
];

// Things that look like secrets. Each is long and specific enough that ordinary prose and code
// don't match (the word "HF_TOKEN" alone is fine).
const TOKENS = [
  [/\bhf_[A-Za-z0-9]{20,}/, "a Hugging Face token (hf_…)"],
  [/\b(?:ghp|gho|ghu|ghs|ghr)_[A-Za-z0-9]{30,}/, "a GitHub token"],
  [/\bgithub_pat_[A-Za-z0-9_]{30,}/, "a GitHub token"],
  [/\bsk-(?:ant-|proj-)?[A-Za-z0-9_-]{30,}/, "an API key (sk-…)"],
  [/\b(?:AKIA|ASIA)[A-Z0-9]{16}\b/, "an AWS access key"],
  [/\bxox[abposr]-[A-Za-z0-9-]{10,}/, "a Slack token"],
  [/\bAIza[A-Za-z0-9_-]{35}\b/, "a Google API key"],
  [/-----BEGIN [A-Z ]*PRIVATE KEY-----/, "a private key"],
];

const fail = (msg) => {
  console.error(msg);
  process.exit(1);
};

// The files a path stands for (a folder becomes all its files), skipping what never ships.
function listFiles(rel) {
  const abs = path.join(root, rel);
  if (!fs.existsSync(abs)) fail(`Missing from the repo: ${rel}`);
  const stat = fs.statSync(abs);
  if (!stat.isDirectory()) return [rel];
  const out = [];
  for (const name of fs.readdirSync(abs).sort()) {
    if (name === ".DS_Store" || name === "node_modules" || name === ".git") continue;
    out.push(...listFiles(path.posix.join(rel.split(path.sep).join("/"), name)));
  }
  return out;
}

const files = [...new Set(PACK.flatMap(listFiles))];

// Look for tokens before anything is written.
const found = [];
for (const rel of files) {
  const text = fs.readFileSync(path.join(root, rel)).toString("latin1");
  for (const [re, what] of TOKENS) {
    const m = re.exec(text);
    if (m) {
      const line = text.slice(0, m.index).split("\n").length;
      found.push(`${rel}:${line}: looks like ${what}`);
    }
  }
}
if (found.length) {
  console.error("Refusing to build the pack: it would contain what looks like a secret.\n");
  for (const f of found) console.error(`  ${f}`);
  console.error(
    "\nTake the secret out of the file (and rotate it if it was ever real), then try again.",
  );
  process.exit(1);
}

const git = (...a) => {
  try {
    return execFileSync("git", ["-C", root, ...a], { encoding: "utf8", stdio: ["ignore", "pipe", "ignore"] }).trim(); // prettier-ignore
  } catch {
    return "";
  }
};
const commit = git("rev-parse", "HEAD");
const branch = git("rev-parse", "--abbrev-ref", "HEAD");
const subject = git("log", "-1", "--format=%s");
const dirty = commit ? git("status", "--porcelain", "--", ...PACK).length > 0 : false;

const info = [
  "Splashery builders pack",
  `Made: ${stamp}`,
  `Repo: https://github.com/ryanjosephkamp/splashery`,
  `Commit: ${commit || "unknown (not a git checkout)"}`,
  `Branch: ${branch || "unknown"}`,
  subject ? `Last commit: ${subject}` : null,
  dirty
    ? "Uncommitted changes in the packed files: yes"
    : "Uncommitted changes in the packed files: no",
  "",
  "Start with builders/README.md. The folder in the repo is always the current version;",
  "this ZIP is a snapshot. Links that point at files not in this ZIP (the manual's chapters, the",
  "other docs) point at the repo: https://github.com/ryanjosephkamp/splashery",
  "",
  "Files:",
  ...files.map((f) => `  ${f}`),
  "",
]
  .filter((x) => x !== null)
  .join("\n");

// Stage the files so PACK-INFO.txt can sit beside them, then zip the staging folder's contents.
const stage = fs.mkdtempSync(path.join(os.tmpdir(), "builders-pack-"));
try {
  for (const rel of files) {
    const to = path.join(stage, rel);
    fs.mkdirSync(path.dirname(to), { recursive: true });
    fs.copyFileSync(path.join(root, rel), to);
  }
  fs.writeFileSync(path.join(stage, "PACK-INFO.txt"), info);
  fs.mkdirSync(outDir, { recursive: true });
  const zip = path.join(outDir, `builders-pack-${stamp}.zip`);
  fs.rmSync(zip, { force: true });
  try {
    execFileSync("zip", ["-r", "-X", "-q", zip, "."], { cwd: stage });
  } catch (err) {
    if (err.code === "ENOENT")
      fail(
        "The `zip` command was not found. Install it (it comes with macOS and most Linux systems).",
      );
    fail(`zip failed: ${err.message}`);
  }
  console.log(
    `${zip} (${(fs.statSync(zip).size / 1024).toFixed(0)} KB, ${files.length + 1} files)`,
  );
  console.log(
    `Commit ${commit ? commit.slice(0, 8) : "unknown"}${dirty ? " (with uncommitted changes)" : ""}`,
  );
} finally {
  fs.rmSync(stage, { recursive: true, force: true });
}
