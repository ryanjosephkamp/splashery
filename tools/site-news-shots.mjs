#!/usr/bin/env node
// The pictures for What's new's before-and-after fixes (lane Site r3). Each fix in
// tools/site-news.json names two versions of a toy's thumbnail (a git ref and a path); this copies
// them, as they were, into site/assets/news/<id>-before.webp and -after.webp. It only writes
// files that are missing, so a shallow clone is fine once they are committed.
//
//   node tools/site-news-shots.mjs

import fs from "node:fs";
import path from "node:path";
import { execFileSync } from "node:child_process";

const root = path.resolve(path.dirname(new URL(import.meta.url).pathname), "..");
const fixes = JSON.parse(fs.readFileSync(path.join(root, "tools/site-news.json"), "utf8")).fixes;
const out = path.join(root, "site/assets/news");
fs.mkdirSync(out, { recursive: true });
for (const f of fixes) {
  for (const side of ["before", "after"]) {
    const file = path.join(out, `${f.id}-${side}.webp`);
    if (fs.existsSync(file)) continue;
    const { ref, path: p } = f[side];
    const bytes = execFileSync("git", ["show", `${ref}:${p}`], { cwd: root, maxBuffer: 16 * 1024 * 1024 }); // prettier-ignore
    fs.writeFileSync(file, bytes);
    console.log(`wrote site/assets/news/${f.id}-${side}.webp`);
  }
}
