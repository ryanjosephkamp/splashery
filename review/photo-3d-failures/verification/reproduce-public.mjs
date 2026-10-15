// MIT. Build a local manifest from a code checkout and this downloaded media folder.
// Usage: node reproduce-public.mjs REPO MEDIA OUTPUT_MANIFEST
import fs from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";

const [repoArg, mediaArg, outArg] = process.argv.slice(2);
if (!repoArg || !mediaArg || !outArg)
  throw new Error("Use: node reproduce-public.mjs REPO MEDIA OUTPUT_MANIFEST");
const repo = path.resolve(repoArg),
  media = path.resolve(mediaArg),
  out = path.resolve(outArg);
const { inventory } = await import(pathToFileURL(path.join(repo, "tools/p3df/inputs.mjs")));
const additional = JSON.parse(fs.readFileSync(path.join(media, "sources/additional-photos.json")));
const rows = [
  ...inventory(),
  ...additional.map(({ photo, ...entry }) => ({ ...entry, file: path.join(media, photo) })),
];
if (rows.length !== 118 || new Set(rows.map((r) => r.id)).size !== 118)
  throw new Error("This corpus requires the captured 88 repository inputs and 30 added photos.");
for (const row of rows) {
  if (!fs.statSync(row.file).isFile()) throw new Error("Missing source: " + row.id);
}
fs.writeFileSync(out, JSON.stringify(rows, null, 2) + "\n", { flag: "wx" });
console.log(`Wrote ${rows.length} public inputs to ${out}. No photos were uploaded.`);
