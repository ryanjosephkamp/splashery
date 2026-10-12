// Lane Builders r1 (prefix bld): the builders/ folder and tools/builders-pack.mjs. No browser: the
// docs' relative links resolve, REPO-MAP.md names every top-level folder, no private page link
// slipped in, and the pack tool builds a ZIP and refuses a planted token.

import { test, expect } from "@playwright/test";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { execFileSync, spawnSync } from "node:child_process";

const root = path.resolve(path.dirname(new URL(import.meta.url).pathname), "..");
const builders = path.join(root, "builders");
const docs = fs.readdirSync(builders).filter((f) => f.endsWith(".md"));

// Markdown links outside code fences and code spans: [text](target)
function links(md) {
  const text = md.replace(/```[\s\S]*?```/g, "").replace(/`[^`\n]*`/g, "");
  return [...text.matchAll(/\[[^\]\n]*\]\(([^)\s]+)\)/g)].map((m) => m[1]);
}

test("every relative link in builders/ resolves", () => {
  expect(docs).toContain("README.md");
  const broken = [];
  let checked = 0;
  for (const doc of docs) {
    const md = fs.readFileSync(path.join(builders, doc), "utf8");
    for (const target of links(md)) {
      if (/^[a-z][a-z0-9+.-]*:/i.test(target) || target.startsWith("#")) continue;
      const file = decodeURIComponent(target.split("#")[0]);
      checked++;
      if (!fs.existsSync(path.resolve(builders, file))) broken.push(`${doc} → ${target}`);
    }
  }
  expect(checked).toBeGreaterThan(30);
  expect(broken).toEqual([]);
});

test("the folder has every document the brief lists", () => {
  for (const f of [
    "README.md",
    "RULES.md",
    "REPO-MAP.md",
    "SETUP.md",
    "KIT-GUIDE.md",
    "TOY-PACKAGE.md",
    "WORKSHOP.md",
    "HANDBACK.md",
    "TASKS.md",
    "CREDITS-GUIDE.md",
  ])
    expect(docs, f).toContain(f);
  const tasks = fs.readFileSync(path.join(builders, "TASKS.md"), "utf8");
  for (let n = 1; n <= 12; n++) expect(tasks, `T${n}`).toMatch(new RegExp(`^## T${n}: `, "m"));
});

test("REPO-MAP.md names every top-level folder", () => {
  const map = fs.readFileSync(path.join(builders, "REPO-MAP.md"), "utf8");
  const dirs = fs
    .readdirSync(root, { withFileTypes: true })
    .filter((d) => d.isDirectory() && !d.name.startsWith(".") && d.name !== "node_modules")
    .map((d) => d.name)
    // test output the tools make; not part of the repo's layout
    .filter((n) => !["test-results", "playwright-report"].includes(n));
  const missing = dirs.filter((d) => !map.includes(`\`${d}/\``));
  expect(missing).toEqual([]);
});

test("builders/ holds no private page link", () => {
  for (const doc of docs) {
    const md = fs.readFileSync(path.join(builders, doc), "utf8");
    expect(md, doc).not.toMatch(/claude\.ai\/(artifact|code|chat)\b/);
  }
});

// A tiny checkout with just what the pack tool packs.
function miniRepo() {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "bld-root-"));
  const put = (rel, text) => {
    fs.mkdirSync(path.dirname(path.join(dir, rel)), { recursive: true });
    fs.writeFileSync(path.join(dir, rel), text);
  };
  put("builders/README.md", "# Builders\n");
  put("builders/RULES.md", "# Rules\n");
  for (const f of ["CLAUDE.md", "README.md", "LICENSE", "LICENSES.md", "CREDITS.md"]) put(f, `# ${f}\n`); // prettier-ignore
  put("docs/PACKS.md", "# Packs\n");
  put("docs/SCENE-SCHEMA.md", "# Scenes\n");
  put("manual/tinkerers-manual.pdf", "%PDF-1.4 stand-in\n");
  return dir;
}
const pack = (args) =>
  spawnSync("node", [path.join(root, "tools/builders-pack.mjs"), ...args], { encoding: "utf8" });
const list = (zip) =>
  execFileSync("unzip", ["-l", zip], { encoding: "utf8" })
    .split("\n")
    .map((l) => l.trim().split(/\s+/).pop());

test("builders-pack.mjs builds the ZIP of the real repo", () => {
  const out = fs.mkdtempSync(path.join(os.tmpdir(), "bld-out-"));
  const r = pack(["--out=" + out, "--date=2026-10-12"]);
  expect(r.status, r.stderr).toBe(0);
  const zip = path.join(out, "builders-pack-2026-10-12.zip");
  expect(fs.existsSync(zip)).toBe(true);
  const names = list(zip);
  for (const f of [
    "builders/README.md",
    "builders/RULES.md",
    "builders/TASKS.md",
    "CLAUDE.md",
    "README.md",
    "LICENSE",
    "LICENSES.md",
    "CREDITS.md",
    "docs/PACKS.md",
    "docs/SCENE-SCHEMA.md",
    "manual/tinkerers-manual.pdf",
    "PACK-INFO.txt",
  ])
    expect(names, f).toContain(f);
  const info = execFileSync("unzip", ["-p", zip, "PACK-INFO.txt"], { encoding: "utf8" });
  expect(info).toMatch(/^Commit: [0-9a-f]{40}$/m);
});

test("builders-pack.mjs builds from a small checkout and refuses a planted token", () => {
  const dir = miniRepo();
  const out = fs.mkdtempSync(path.join(os.tmpdir(), "bld-out-"));
  const ok = pack(["--root=" + dir, "--out=" + out, "--date=2026-01-02"]);
  expect(ok.status, ok.stderr).toBe(0);
  expect(fs.existsSync(path.join(out, "builders-pack-2026-01-02.zip"))).toBe(true);

  // A Hugging Face token (built here so this file never holds one) in a packed file.
  const token = "hf_" + "aB3dE5gH7jK9mN1pQ3sT5vW7yZ9bC1dE3fG5"; // 3 + 36 characters
  fs.appendFileSync(path.join(dir, "builders/README.md"), `HF_TOKEN=${token}\n`);
  const out2 = fs.mkdtempSync(path.join(os.tmpdir(), "bld-out-"));
  const bad = pack(["--root=" + dir, "--out=" + out2, "--date=2026-01-02"]);
  expect(bad.status).toBe(1);
  expect(bad.stderr).toMatch(/Refusing to build/);
  expect(bad.stderr).toMatch(/builders\/README\.md:\d+: looks like a Hugging Face token/);
  expect(bad.stderr).not.toContain(token); // it names the place, never prints the secret
  expect(fs.readdirSync(out2)).toEqual([]);

  // Other kinds of secret are caught too, and the plain word HF_TOKEN is not.
  fs.writeFileSync(path.join(dir, "builders/README.md"), "Set HF_TOKEN in your environment.\n");
  expect(pack(["--root=" + dir, "--out=" + out2, "--date=2026-01-02"]).status).toBe(0);
  const ghp = "ghp_" + "A".repeat(36);
  fs.appendFileSync(path.join(dir, "CLAUDE.md"), `${ghp}\n`);
  expect(pack(["--root=" + dir, "--out=" + out2, "--date=2026-01-03"]).status).toBe(1);
});

test("builders-pack.mjs says what is missing", () => {
  const dir = miniRepo();
  fs.rmSync(path.join(dir, "LICENSE"));
  const r = pack(["--root=" + dir, "--out=" + fs.mkdtempSync(path.join(os.tmpdir(), "bld-out-"))]);
  expect(r.status).toBe(1);
  expect(r.stderr).toMatch(/Missing from the repo: LICENSE/);
});
