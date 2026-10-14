#!/usr/bin/env node
// Lists every NonCommercial (NC) asset on the site, so they can all be taken out in one go if the
// site ever earns money (the owner's call of October 3, 2026: CC BY-NC and CC BY-NC-SA are allowed
// per asset, with the license notice beside it, never ND, and `"nc": true` on the asset).
//
//   node tools/nc-assets.mjs           # id, title, author, license, files, toys that use it
//   node tools/nc-assets.mjs --json    # the same as JSON
//   node tools/nc-assets.mjs --check   # exit 1 if a license that contains NC lacks "nc": true,
//                                      # or an ND (NoDerivatives) license appears anywhere
//
// It reads tools/assets.json and tools/models.json (an entry's `license`, and `nc`), and the
// license in every toy's `credit` in src/toys.js, which also names the toys that use an asset.

import fs from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";

const root = path.resolve(path.dirname(new URL(import.meta.url).pathname), "..");
const args = process.argv.slice(2);
const read = (f) => JSON.parse(fs.readFileSync(path.join(root, f), "utf8"));

// Whether a license name holds the NonCommercial or the NoDerivatives term ("CC BY-NC-SA 4.0").
const term = (license, t) => new RegExp(`(^|[\\s-])${t}(?=$|[\\s-])`, "i").test(license || "");
export const isNC = (license) => term(license, "NC");
export const isND = (license) => term(license, "ND");

const { TOYS } = await import(pathToFileURL(path.join(root, "src/toys.js")).href);

// Every asset record: from assets.json (the captured toys) and models.json (the mesh models).
const records = [];
for (const t of read("tools/assets.json").toys) {
  records.push({
    id: t.id,
    title: t.label,
    author: t.author || "",
    license: t.license || "",
    nc: t.nc === true,
    files: [`assets/toys/${t.id}/${t.id}.sog`, `assets/toys/${t.id}/${t.id}-lite.sog`],
  });
}
for (const m of read("tools/models.json").models) {
  records.push({
    id: m.id,
    title: m.name || m.id,
    author: m.author || "",
    license: m.license || "",
    nc: m.nc === true,
    files: [`assets/toys/${m.id}/${m.id}.sog`, `assets/toys/${m.id}/${m.id}-lite.sog`],
  });
}

// The toys that use an asset: the toy with the asset's id, or whose files live in its folder.
const usedBy = (r) =>
  TOYS.filter((t) => t.id === r.id || (t.url || "").startsWith(`assets/toys/${r.id}/`)).map(
    (t) => t.id,
  );

const problems = [];
for (const r of records) {
  if (isNC(r.license) && !r.nc) problems.push(`${r.id}: license "${r.license}" is NC but has no "nc": true`); // prettier-ignore
  if (r.nc && !isNC(r.license)) problems.push(`${r.id}: tagged nc but its license is "${r.license}"`); // prettier-ignore
  if (isND(r.license)) problems.push(`${r.id}: ND license "${r.license}"`);
}
// A toy's in-app credit must agree with the manifest: an NC license there needs the tag too.
const byId = new Map(records.map((r) => [r.id, r]));
for (const t of TOYS) {
  const lic = t.credit?.license || "";
  if (isND(lic)) problems.push(`toy ${t.id}: ND license "${lic}" in its credit`);
  if (isNC(lic) && !byId.get(t.id)?.nc) problems.push(`toy ${t.id}: NC license "${lic}" in its credit but no tagged asset`); // prettier-ignore
}

if (args.includes("--check")) {
  if (problems.length) {
    console.error(problems.join("\n"));
    process.exit(1);
  }
  console.log(`OK: ${records.filter((r) => r.nc).length} NC assets, all tagged; no ND license.`);
} else {
  const list = records.filter((r) => r.nc).map((r) => ({ ...r, toys: usedBy(r) }));
  if (args.includes("--json")) console.log(JSON.stringify(list, null, 2));
  else {
    for (const r of list) {
      console.log(`${r.id}: ${r.title} by ${r.author}, ${r.license}`);
      console.log(`  files: ${r.files.join(", ")}`);
      console.log(`  toys: ${r.toys.join(", ") || "(none)"}`);
    }
    console.log(`\n${list.length} NonCommercial assets.`);
  }
  if (problems.length) {
    console.error("\nProblems:\n" + problems.join("\n"));
    process.exitCode = 1;
  }
}
