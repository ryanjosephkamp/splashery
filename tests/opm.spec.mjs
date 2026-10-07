// Lane Ops merge tool: tools/op-merge.mjs on a small git repo each test builds in a temporary
// folder (node only, no browser). It stands in for main and a few PR branches; its
// tools/site-build.mjs writes site/index.html from src/toys.js, like the real one does.
import { test, expect } from "@playwright/test";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { spawnSync } from "node:child_process";

const tool = path.resolve("tools/op-merge.mjs");
const ENV = {
  ...process.env,
  GIT_AUTHOR_NAME: "opm",
  GIT_AUTHOR_EMAIL: "opm@example.com",
  GIT_COMMITTER_NAME: "opm",
  GIT_COMMITTER_EMAIL: "opm@example.com",
};

const SITE_BUILD = `import fs from "node:fs";
import { TOYS } from "../src/toys.js";

const html = \`<p>\${TOYS.join(", ")}</p>\\n<ul>\\n\${TOYS.map((t) => \`  <li>\${t}</li>\`).join("\\n")}\\n</ul>\\n\`;
if (process.argv.includes("--check")) {
  process.exit(fs.readFileSync("site/index.html", "utf8") === html ? 0 : 1);
}
fs.mkdirSync("site", { recursive: true });
fs.writeFileSync("site/index.html", html);
`;

const toysJs = (toys) =>
  `// prettier-ignore\nexport const TOYS = [\n${toys.map((t) => `  "${t}",\n`).join("\n")}];\n`;
const review = (toys) => JSON.stringify({ round: "test", toys }, null, 2) + "\n";

const made = [];

function makeRepo() {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "opm-"));
  made.push(dir);
  const git = (...args) => {
    const r = spawnSync("git", args, { cwd: dir, env: ENV, encoding: "utf8" });
    if (r.status !== 0) throw new Error(`git ${args.join(" ")}: ${r.stderr}`);
    return r.stdout.trim();
  };
  const write = (files) => {
    for (const [f, text] of Object.entries(files)) {
      fs.mkdirSync(path.dirname(path.join(dir, f)), { recursive: true });
      fs.writeFileSync(path.join(dir, f), text);
    }
  };
  const read = (f) => fs.readFileSync(path.join(dir, f), "utf8");
  // A branch off main with one commit; returns its head.
  const pr = (name, files) => {
    git("checkout", "-q", "-b", name, "main");
    write(files);
    spawnSync("node", ["tools/site-build.mjs"], { cwd: dir });
    git("add", "-A");
    git("commit", "-q", "-m", `${name} work`);
    const sha = git("rev-parse", "HEAD");
    git("checkout", "-q", "main");
    return sha;
  };
  git("init", "-q", "-b", "main");
  write({
    "README.md": "# Test repo\n\nThe first line.\n",
    "src/toys.js": toysJs(["apple", "pear"]),
    "tools/site-build.mjs": SITE_BUILD,
    "tools/sound-review.json": review({
      apple: { note: "crunchy" },
      pear: { note: "soft" },
    }),
    ".gitignore": ".cache/\n",
  });
  spawnSync("node", ["tools/site-build.mjs"], { cwd: dir });
  git("add", "-A");
  git("commit", "-q", "-m", "start");
  const run = (...args) => {
    const r = spawnSync(
      "node",
      [tool, "--repo", dir, "--base", "main", "--no-fetch", "--no-tests", ...args],
      { env: ENV, encoding: "utf8" },
    );
    return { code: r.status, out: r.stdout + r.stderr };
  };
  return { dir, git, write, read, pr, run };
}

test.describe("op-merge", () => {
  test.afterEach(() =>
    made.splice(0).forEach((d) => fs.rmSync(d, { recursive: true, force: true })),
  );

  test("a clean merge makes the branch, the merge commits and the PR body", () => {
    const r = makeRepo();
    const a = r.pr("a", { "docs/a.md": "# A\n" });
    const b = r.pr("b", { "docs/b.md": "# B\n" });
    const mainBefore = r.git("rev-parse", "main");
    r.write({ ".cache/trailers.txt": "Co-Authored-By: Someone <x@example.com>\n" });
    // prettier-ignore
    const res = r.run(
      "--topic", "t1", "--pr", `1:${a}`, "--pr", `2:${b}`,
      "--title", "1=Phase A: first", "--title=2=Phase B: second",
      "--trailer-file", path.join(r.dir, ".cache/trailers.txt"),
    );
    expect(res.code, res.out).toBe(0);
    expect(r.git("rev-parse", "--abbrev-ref", "HEAD")).toBe("claude/operator-merge-t1");
    expect(r.git("rev-parse", "main")).toBe(mainBefore);
    const log = r.git("log", "--merges", "--format=%B%x00", "main..HEAD").split("\0");
    expect(log[0]).toContain("Merge #2 (Phase B: second)");
    expect(log[1]).toContain("Merge #1 (Phase A: first)");
    expect(log[1]).toContain("Co-Authored-By: Someone <x@example.com>");
    const body = r.read(".cache/op-merge/t1-pr.md");
    for (const h of ["Summary", "Verification", "Deviations", "Known issues", "What was cut"])
      expect(body).toContain(`## ${h}`);
    expect(body).toContain(`#1 (\`${a.slice(0, 8)}\`): Phase A: first`);
    expect(body).toContain("None: every merge was clean.");
    expect(res.out).toContain("Title: Ops: merge A, B");
  });

  test("a conflict only in site/ takes a side and rebuilds it", () => {
    const r = makeRepo();
    const a = r.pr("a", { "src/toys.js": toysJs(["apple", "pear", "plum"]) });
    const b = r.pr("b", { "src/toys.js": toysJs(["kiwi", "apple", "pear"]) });
    const res = r.run(
      "--topic",
      "t2",
      "--pr",
      `1:${a}`,
      "--pr",
      `2:${b}`,
      "--title",
      "1=A",
      "--title",
      "2=B",
    );
    expect(res.code, res.out).toBe(0);
    expect(res.out).toContain("merge #2: settled");
    const site = r.read("site/index.html");
    for (const t of ["kiwi", "apple", "pear", "plum"]) expect(site).toContain(`<li>${t}</li>`);
    expect(site).not.toContain("<<<<<<<");
    expect(r.git("log", "-1", "--format=%s")).toBe("Ops: rebuild site/ after #1, #2");
    expect(r.read(".cache/op-merge/t2-pr.md")).toContain(
      "#2: generated, took one side and rebuilt: site/ (1 file)",
    );
  });

  test("tools/sound-review.json conflicts merge toy by toy", () => {
    const r = makeRepo();
    const a = r.pr("a", {
      "tools/sound-review.json": review({
        apple: { note: "crunchier" },
        pear: { note: "soft" },
        plum: { note: "new" },
      }),
    });
    const b = r.pr("b", {
      "tools/sound-review.json": review({
        apple: { note: "crunchy" },
        pear: { note: "softer" },
        kiwi: { note: "fuzzy" },
      }),
    });
    const res = r.run(
      "--topic",
      "t3",
      "--pr",
      `1:${a}`,
      "--pr",
      `2:${b}`,
      "--title",
      "1=A",
      "--title",
      "2=B",
    );
    expect(res.code, res.out).toBe(0);
    const toys = JSON.parse(r.read("tools/sound-review.json")).toys;
    expect(toys).toEqual({
      apple: { note: "crunchier" },
      pear: { note: "softer" },
      plum: { note: "new" },
      kiwi: { note: "fuzzy" },
    });
    expect(r.read(".cache/op-merge/t3-pr.md")).toContain(
      "#2: tools/sound-review.json: merged toy by toy",
    );
  });

  test("a real conflict stops with the files named, and --continue finishes it", () => {
    const r = makeRepo();
    const a = r.pr("a", { "README.md": "# Test repo\n\nA's line.\n" });
    const b = r.pr("b", { "README.md": "# Test repo\n\nB's line.\n" });
    const c = r.pr("c", { "docs/c.md": "# C\n" });
    const args = [
      "--topic",
      "t4",
      "--pr",
      `1:${a}`,
      "--pr",
      `2:${b}`,
      "--pr",
      `3:${c}`,
      "--title",
      "2=B",
    ];

    const dry = r.run(...args, "--dry-run");
    expect(dry.code, dry.out).toBe(1);
    expect(dry.out).toContain("merge #2: STOPS on README.md");
    expect(r.git("rev-parse", "--abbrev-ref", "HEAD")).toBe("main");

    const res = r.run(...args);
    expect(res.code, res.out).toBe(1);
    expect(res.out).toContain(
      "STOPPED: #2 (B) conflicts in files a person must resolve:\n  README.md",
    );
    expect(r.git("diff", "--name-only", "--diff-filter=U")).toBe("README.md");

    r.write({ "README.md": "# Test repo\n\nA's line and B's line.\n" });
    r.git("add", "README.md");
    const done = r.run(...args, "--continue");
    expect(done.code, done.out).toBe(0);
    expect(r.git("log", "--merges", "--format=%s", "main..HEAD").split("\n")).toEqual([
      "Merge #3 (c work)",
      "Merge #2 (B)",
      "Merge #1 (a work)",
    ]);
    expect(r.read(".cache/op-merge/t4-pr.md")).toContain("#1: no --title given");
  });
});
