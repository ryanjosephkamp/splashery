// Retain compact, verifiable still evidence; full captures remain outside Git.
import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";

const option = (key, fallback) =>
  process.argv.find((s) => s.startsWith(`--${key}=`))?.slice(key.length + 3) ?? fallback;
const raw = path.resolve(option("visuals", "../load-time-runs/review-visuals"));
const audit = "docs/audits/load-time-2026-10";
const images = path.join(audit, "images");
const read = (file) => JSON.parse(fs.readFileSync(file));
const rows = read(path.join(raw, "image-diffs.json"));
const visuallyIdenticalBook = (r) =>
  r.id === "your-book" &&
  r.device === "desktop" &&
  r.pose === "rest" &&
  r.differentPixels > 0 &&
  r.differentPixels / r.pixels <= 0.00001 &&
  r.maxChannelDifference <= 1;
const keys = rows.map((r) => `${r.id}:${r.device}:${r.pose}`);
if (
  rows.length !== 50 ||
  new Set(keys).size !== 50 ||
  rows.some(
    (r) =>
      r.captureVersion !== 3 ||
      r.gpuCompletion !== "WebGL gl.finish() immediately before capture" ||
      (r.differentPixels !== 0 && !visuallyIdenticalBook(r)) ||
      r.before.settledFrames < 12 ||
      r.after.settledFrames < 12 ||
      (r.pose === "tap" && !(r.tapChangedPixels > 0)),
  )
)
  throw new Error(
    "Expected 50 complete, visually identical, GPU-finished comparisons and moved tap poses.",
  );
const sources = new Set(rows.map((r) => `${r.frozenMain}:${r.candidateSource}`));
if (sources.size !== 1) throw new Error("Capture sources differ.");
fs.mkdirSync(images, { recursive: true });
const kept = new Set();
const byHash = new Map();
const hash = (file) =>
  crypto
    .createHash("sha256")
    .update(fs.readFileSync(path.join(raw, "images", file)))
    .digest("hex");
function retain(file) {
  const sha = hash(file);
  if (byHash.has(sha)) return byHash.get(sha);
  fs.copyFileSync(path.join(raw, "images", file), path.join(images, file));
  kept.add(file);
  byHash.set(sha, file);
  return file;
}
for (const row of rows) {
  row.before.sha256 = hash(row.before.file);
  row.after.sha256 = hash(row.after.file);
  row.equality = row.differentPixels === 0 ? "pixel-identical" : "visually-identical";
  if (visuallyIdenticalBook(row)) {
    row.note =
      "Visually inspected paired stills; eight pixels differ by at most one RGB level. Original and decoded compressed PDF bytes match exactly.";
    row.previewBefore = retain(row.before.file);
    row.previewAfter = retain(row.after.file);
    row.diffPreview = retain(row.diff);
  }
  if (row.device === "phone" && row.pose === "rest" && row.id !== "cactus") {
    if (row.before.sha256 !== row.after.sha256)
      throw new Error(
        `Exact pixels have different PNG encodings: ${row.id}; retain both explicitly.`,
      );
    row.preview = retain(row.before.file);
  }
}
const lossy = read(path.join(raw, "lossy-options.json"));
for (const row of lossy) {
  if (row.shipped !== false || !(row.differentPixels > 0))
    throw new Error("A lossy option must remain unshipped and visibly different.");
  row.before.sha256 = hash(row.before.file);
  row.after.sha256 = hash(row.after.file);
  row.before.file = retain(row.before.file);
  row.after.file = retain(row.after.file);
  row.diff = retain(row.diff);
}
for (const file of fs.readdirSync(images))
  if (!kept.has(file)) fs.unlinkSync(path.join(images, file));
fs.writeFileSync(path.join(audit, "image-diffs.json"), JSON.stringify(rows, null, 2) + "\n");
fs.writeFileSync(path.join(audit, "lossy-options.json"), JSON.stringify(lossy, null, 2) + "\n");
console.log({
  comparisons: rows.length,
  movedTapPoses: rows.filter((r) => r.pose === "tap").length,
  retainedFiles: kept.size,
});
