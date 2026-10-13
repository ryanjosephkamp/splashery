// Exact gzip copies of existing code/data. No minification, bundling, or source changes.
import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import { gzipSync, gunzipSync } from "node:zlib";

const copies = [
  [
    "vendor/playcanvas/playcanvas.min.mjs",
    "vendor/playcanvas/playcanvas.min.mjs.gz",
    "MIT; existing PlayCanvas 2.22.3 notices",
  ],
  ["src/toy-help.js", "assets/opening/toy-help.mjs.gz", "MIT; existing Splashery code"],
  [
    "manual/tinkerers-manual.pdf",
    "manual/tinkerers-manual.pdf.gz",
    "Original manual and enclosed asset notices, unchanged",
  ],
];
const sha = (bytes) => crypto.createHash("sha256").update(bytes).digest("hex");
const records = [];
for (const [source, file, license] of copies) {
  const bytes = fs.readFileSync(source),
    compressed = gzipSync(bytes, { level: 9 });
  if (!gunzipSync(compressed).equals(bytes)) throw new Error(`Gzip copy differs: ${source}`);
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, compressed);
  records.push({
    source,
    file,
    sourceBytes: bytes.length,
    bytes: compressed.length,
    sourceSha256: sha(bytes),
    sha256: sha(compressed),
    license,
    transformation:
      "Exact gzip copy made by Ryan with Codex (GPT-6); no source or decoded-byte changes",
  });
}
fs.writeFileSync(
  "docs/audits/load-time-2026-10/compressed-opening.json",
  JSON.stringify(records, null, 2) + "\n",
);
console.log(records.map(({ source, sourceBytes, bytes }) => ({ source, sourceBytes, bytes })));
