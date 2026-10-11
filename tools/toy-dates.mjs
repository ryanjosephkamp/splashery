#!/usr/bin/env node
// The date every toy first arrived on main (lane Site r3). One pass over the git history finds the
// first merge (or direct commit) that added the toy's id to the shelf (src/toys.js and the packs
// that list toys for it) and stores it in tools/toy-dates.json, which the site build reads.
//
//   node tools/toy-dates.mjs            # adds dates for toys that have none yet (never changes one)
//   node tools/toy-dates.mjs --check    # exits 1 if a toy has no date
//   node tools/toy-dates.mjs --rebuild  # derives every date again from the full history
//
// Run it after a toy is added (the Operator's upkeep does). A shallow clone can't find old dates,
// so the file is only ever added to; `--rebuild` needs `git fetch --unshallow` first. A toy that is
// not on main yet gets the date of the newest commit on this branch until its merge is in.

import fs from "node:fs";
import path from "node:path";
import { execSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { TOYS } from "../src/toys.js";

const root = path.resolve(path.dirname(new URL(import.meta.url).pathname), "..");
const FILE = path.join(root, "tools/toy-dates.json");
const SHELF_FILES = ["src/toys.js", "src/packs/photoreal-r2.js", "src/packs/photoreal-r3.js"];
const args = new Set(process.argv.slice(2));

const git = (cmd) => execSync(`git ${cmd}`, { cwd: root, encoding: "utf8", maxBuffer: 512 * 1024 * 1024 }); // prettier-ignore

export function deriveDates(ids) {
  const want = new Set(ids);
  const found = {};
  // -m --first-parent: a merge shows what it brought into main, so the date is the merge's.
  const log = git(`log -m --first-parent --reverse --format=%x01DATE%cs -p -U0 -- ${SHELF_FILES.join(" ")}`); // prettier-ignore
  let date = "";
  for (const line of log.split("\n")) {
    if (line.startsWith("\x01DATE")) date = line.slice(5);
    else if (line[0] === "+") {
      const m = /^\+ {2,4}"?id"?: "([a-z0-9-]+)"/.exec(line);
      if (m && want.has(m[1]) && !found[m[1]]) found[m[1]] = date;
    }
  }
  // Toys listed another way (a bare id in a pack's list): the first change that mentions the id.
  for (const id of want) {
    if (found[id]) continue;
    const first = git(`log -m --first-parent --reverse --format=%cs -S'"${id}"' -- src/packs src/toys.js`).split("\n").find(Boolean); // prettier-ignore
    if (first) found[id] = first;
  }
  return found;
}

const readStored = () => (fs.existsSync(FILE) ? JSON.parse(fs.readFileSync(FILE, "utf8")) : {});

// Every toy's date: the stored one, or one derived now (the site build uses this, so a toy added
// in a lane has a date on its page before the upkeep stores it).
export function toyDates(ids = TOYS.map((t) => t.id)) {
  const stored = readStored();
  const missing = ids.filter((id) => !stored[id]);
  if (!missing.length) return stored;
  const found = deriveDates(missing);
  const today = git("log -1 --format=%cs HEAD").trim();
  const out = { ...stored };
  for (const id of missing) out[id] = found[id] || today;
  return out;
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const stored = readStored();
  const ids = TOYS.map((t) => t.id);
  const missing = args.has("--rebuild") ? ids : ids.filter((id) => !stored[id]);
  if (args.has("--check")) {
    if (missing.length) {
      console.error(`No stored date for ${missing.length} toy(s): ${missing.slice(0, 8).join(", ")}. Run node tools/toy-dates.mjs`); // prettier-ignore
      process.exit(1);
    }
    console.log(`toy-dates: all ${ids.length} toys have a date.`);
  } else if (missing.length) {
    const found = deriveDates(missing);
    const today = git("log -1 --format=%cs HEAD").trim();
    let fallback = 0;
    for (const id of missing) {
      if (found[id]) stored[id] = found[id];
      else if (!stored[id]) (stored[id] = today), fallback++;
    }
    const sorted = Object.fromEntries(Object.entries(stored).filter(([id]) => ids.includes(id)).sort(([a], [b]) => a.localeCompare(b))); // prettier-ignore
    fs.writeFileSync(FILE, JSON.stringify(sorted, null, 2) + "\n");
    console.log(`toy-dates: ${missing.length - fallback} from history, ${fallback} not on main yet (dated ${today}).`); // prettier-ignore
  } else console.log("toy-dates: nothing to add.");
}
