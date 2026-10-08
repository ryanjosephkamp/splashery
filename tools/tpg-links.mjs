#!/usr/bin/env node
// Checks tools/toy-links.json (lane Toy pages r2): every key is a public toy, every link is an
// https English Wikipedia (or other https) address with a label, and with --online each address
// opens and is a real article (not a missing page or a disambiguation page).
//
//   node tools/tpg-links.mjs            # the file's shape
//   node tools/tpg-links.mjs --online   # also fetch every address (about 300, a few at a time)

import fs from "node:fs";
import path from "node:path";
import { TOYS } from "../src/toys.js";

const root = path.resolve(path.dirname(new URL(import.meta.url).pathname), "..");
const { links } = JSON.parse(fs.readFileSync(path.join(root, "tools/toy-links.json"), "utf8"));
const problems = [];
const say = (m) => problems.push(m);

for (const [id, l] of Object.entries(links)) {
  const t = TOYS.find((x) => x.id === id);
  if (!t || !t.category) say(`${id}: not a toy`);
  else if (t.labs) say(`${id}: a labs toy (public toys only)`);
  if (!/^https:\/\/[^\s]+$/.test(l.url || "")) say(`${id}: url must be https`);
  if (!l.label || !l.label.trim()) say(`${id}: no label`);
  if (/\b(lego|rubik|frisbee|slinky)\b/i.test(l.label || "")) say(`${id}: brand name in the label`);
}

if (process.argv.includes("--online")) {
  const UA = {
    "user-agent": "splashery-toy-links/1.0 (https://ryanjosephkamp.github.io/splashery/)",
  };
  const ids = Object.keys(links);
  const check = async (id) => {
    const u = new URL(links[id].url);
    const api = u.hostname.endsWith("wikipedia.org")
      ? `https://${u.hostname}/api/rest_v1/page/summary/${u.pathname.replace("/wiki/", "")}?redirect=false`
      : null;
    for (let tries = 0; tries < 5; tries++) {
      try {
        const r = await fetch(api || u, { headers: UA });
        if (r.status === 404) return say(`${id}: ${links[id].url} does not exist`);
        if (!r.ok) {
          await new Promise((res) => setTimeout(res, 2500));
          continue;
        }
        if (api) {
          const j = await r.json();
          if (j.type === "disambiguation") say(`${id}: ${links[id].url} is a disambiguation page`);
        }
        return;
      } catch {
        await new Promise((res) => setTimeout(res, 2500));
      }
    }
    say(`${id}: ${links[id].url} did not answer`);
  };
  for (let i = 0; i < ids.length; i += 3) {
    await Promise.all(ids.slice(i, i + 3).map(check));
    await new Promise((res) => setTimeout(res, 600));
  }
}

console.log(
  `${Object.keys(links).length} links${problems.length ? `, ${problems.length} problems:` : ", all fine"}`,
);
for (const p of problems) console.log(" ", p);
process.exit(problems.length ? 1 : 0);
