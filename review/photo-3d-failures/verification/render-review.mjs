// MIT. Render a slim public view without changing captured numerical profiles.
// Usage: node render-review.mjs CODE_CHECKOUT NATIVE_CAPTURE SLIM_OUTPUT
import fs from "node:fs";
import path from "node:path";
import assert from "node:assert/strict";
import crypto from "node:crypto";
import { pathToFileURL } from "node:url";

const [code, capture, output] = process.argv.slice(2);
if (!code || !capture || !output)
  throw new Error("Use: node render-review.mjs CODE_CHECKOUT NATIVE_CAPTURE SLIM_OUTPUT");
const { galleryHtml } = await import(pathToFileURL(path.resolve(code, "tools/p3df/gallery.mjs")));
const original = JSON.parse(fs.readFileSync(path.join(capture, "atlas.json")));
const data = structuredClone(original);
assert.equal(data.coverage.completedPoses, 2124);
data.publication = {
  lossy: true,
  maxDimensions: [390, 844],
  note: "Presentation only. Scores and native hashes refer to the original lossless capture. Native PNGs and projected-boundary files are not in this package. The exact original ledger is atlas.json.gz.",
};
const webp = (file) => file.replace(/\.png$/, ".webp");
for (const entry of data.inputs) {
  entry.photoPreview = `previews/${entry.id}-source.webp`;
  entry.record += ".gz";
  for (const [profile, result] of Object.entries(entry.profiles)) {
    result.reviewFiles = {
      poses: Object.fromEntries(
        result.rows.map((row) => [[row.yaw, row.pitch].join(","), webp(row.image)]),
      ),
      depthDiagnostics: `renders/${entry.id}-${profile}-depth-diagnostic.json.gz`,
      anchors: `renders/${entry.id}-${profile}-anchors.json.gz`,
    };
    for (const key of ["front", "worst", "frontPreview", "worstPreview", "depthImage"])
      result[key] = webp(result[key]);
    for (const file of [
      result.front,
      result.worst,
      result.frontPreview,
      result.worstPreview,
      result.depthImage,
      result.reviewFiles.depthDiagnostics,
      result.reviewFiles.anchors,
      ...Object.values(result.reviewFiles.poses),
    ])
      assert.ok(fs.existsSync(path.join(output, file)), file);
  }
  for (const file of [entry.photo, entry.photoPreview, entry.record])
    assert.ok(fs.existsSync(path.join(output, file)), file);
  const raw = original.inputs.find((row) => row.id === entry.id);
  assert.equal(
    crypto
      .createHash("sha256")
      .update(fs.readFileSync(path.join(output, entry.photo)))
      .digest("hex"),
    raw.sha256,
  );
  for (const profile of Object.keys(entry.profiles))
    for (const key of ["values", "summary", "severity", "rows", "memory", "timing"])
      assert.deepEqual(entry.profiles[profile][key], raw.profiles[profile][key]);
}
fs.writeFileSync(path.join(output, "atlas.json"), JSON.stringify(data, null, 2) + "\n");
fs.writeFileSync(path.join(output, "index.html"), galleryHtml(data));
console.log("Rendered 118 rows; all numerical profiles and original photo hashes are unchanged.");
