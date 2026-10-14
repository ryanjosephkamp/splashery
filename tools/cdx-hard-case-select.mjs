// Task 57: keep the best two per hard case, then the six highest remaining scores.
// Run only after all 40 images have eight measured poses and pass visual screening.
import fs from "node:fs";
import { createHash } from "node:crypto";
const hash = (file) => createHash("sha256").update(fs.readFileSync(file)).digest("hex");
const root = "docs/audits/hard-case-samples-2026-10";
const candidates = JSON.parse(fs.readFileSync("tools/cdx-hard-case-candidates.json", "utf8"));
const rows = JSON.parse(fs.readFileSync(`${root}/photo-scores.json`, "utf8"));
if (candidates.length !== 40 || rows.length !== 40)
  throw Error("Need all 40 candidates and scores.");
const byFile = new Map(candidates.map((r) => [r.file, r]));
for (const r of rows) {
  for (const [ext, digest] of [
    ["jpg", r.sha256],
    ["depth", r.depthSha256],
  ]) {
    const path = `assets/toys/photo-3d/ai/${r.file}.${ext}`;
    if (!fs.existsSync(path) || hash(path) !== digest)
      throw Error(`Missing or changed scored file: ${path}`);
  }
}
const ranked = rows
  .filter((r) => byFile.get(r.file)?.screening.accepted)
  .sort((a, b) => b.score - a.score || a.prompt.localeCompare(b.prompt));
if (rows.some((r) => r.poses.length !== 8 || !Number.isFinite(r.score)))
  throw Error("Incomplete pose measurements.");
const categories = [...new Set(candidates.map((r) => r.category))];
if (categories.length !== 7) throw Error("Need seven hard cases.");
const keep = new Set();
for (const category of categories) {
  const group = ranked.filter((r) => r.category === category);
  if (group.length < 2) throw Error(`Not enough eligible ${category} pictures.`);
  group.slice(0, 2).forEach((r) => keep.add(r.file));
}
for (const r of ranked) {
  if (keep.size === 20) break;
  keep.add(r.file);
}
if (keep.size !== 20) throw Error("Need 20 eligible pictures.");
const pictures = [];
fs.mkdirSync("assets/toys/photo-3d/hard-cases", { recursive: true });
fs.mkdirSync(".cache/hard-case-samples/candidates", { recursive: true });
for (const r of rows) {
  r.kept = keep.has(r.file);
  r.reason = r.kept
    ? "Highest measured score with a two-per-category coverage floor."
    : "Lower measured score after category coverage.";
  if (r.kept) pictures.push({ prompt: r.prompt, file: r.file, name: r.name, category: r.category });
  for (const ext of ["jpg", "depth"]) {
    const file = `${r.file}.${ext}`;
    const from = `assets/toys/photo-3d/ai/${file}`;
    if (!fs.existsSync(from)) throw Error(`Missing candidate ${from}`);
    fs.copyFileSync(from, `.cache/hard-case-samples/candidates/${file}`);
    if (r.kept) fs.copyFileSync(from, `assets/toys/photo-3d/hard-cases/${file}`);
    fs.unlinkSync(from);
  }
}
fs.writeFileSync(
  "src/packs/hard-case-pictures.js",
  "// Task 57: the best 20 measured hard-case pictures; see the scored audit.\nexport const HARD_CASE_PICTURES = " +
    JSON.stringify(
      pictures.sort((a, b) => a.prompt.localeCompare(b.prompt)),
      null,
      2,
    ) +
    ";\n",
);
fs.writeFileSync(`${root}/photo-scores.json`, JSON.stringify(rows, null, 2) + "\n");
console.log("Selected 20 pictures covering all seven hard cases; only kept full-size files ship.");
