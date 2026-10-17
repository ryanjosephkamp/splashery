// Verify the worker scheduler against the original serial assessment on actual stage PNGs.
import assert from "node:assert/strict";
import fs from "node:fs";
import { createHash } from "node:crypto";
import { qualifyCapture as serial, sourcePicture } from "./qualify.mjs";
import { qualifyCapture as parallel } from "./qualify-parallel.mjs";
const root = ".cache/picture-qr-fidelity";
const directory = "tools/picture-qr-fidelity/results/review-pass";
const records = (file) => fs.readFileSync(file, "utf8").split("\n").filter(Boolean).map(JSON.parse);
const sha = (value) => createHash("sha256").update(value).digest("hex");
const base = ["main", "detail"].flatMap((mode) =>
  records(`${root}/browser-review-pre-third-${mode}-low-0.jsonl`).map((row) => ({ mode, row })),
);
const selected = [];
for (const [picture, shape, link] of [
  ["ai-farm", "square", 0],
  ["ai-farm", "circle", 0],
  ["cdx-qr-ai-fern", "square", 0],
  ["cdx-theme-seasons-11-2", "square", 9],
])
  for (const mode of ["main", "detail"]) {
    const value = base.find(
      (x) =>
        x.mode === mode &&
        x.row.picture === picture &&
        x.row.shape === shape &&
        x.row.link === link,
    );
    assert(value);
    selected.push(value);
  }
for (const mode of ["main", "detail"])
  for (const shape of ["square", "circle"])
    selected.push(
      ...base
        .filter(
          (x) =>
            x.mode === mode &&
            x.row.shape === shape &&
            x.row.version >= 12 &&
            fs.existsSync(
              `${root}/review/${x.row.measurementRun}-${mode}/${x.row.picture}-${shape}-${x.row.link}-render.png`,
            ),
        )
        .slice(0, 2),
    );
const unique = [...new Map(selected.map((x) => [`${x.mode}/${x.row.key}`, x])).values()];
assert(unique.length >= 12);
const evidence = [];
for (const { mode, row } of unique) {
  const file = `${root}/review/${row.measurementRun}-${mode}/${row.picture}-${row.shape}-${row.link}-render.png`;
  const bytes = fs.readFileSync(file),
    result = { ...row, shot: `data:image/png;base64,${bytes.toString("base64")}` };
  const picture = sourcePicture(row.picture);
  const before = await serial(picture, result, row.text, row.shape);
  const after = await parallel(picture, result, row.text, row.shape);
  assert.deepEqual(after, before, `${mode}/${row.key}`);
  evidence.push({
    mode,
    key: row.key,
    version: row.version,
    file,
    pngSha256: sha(bytes),
    captureRGBA8Sha256: before.captureRGBA8Sha256,
    conditions: before.scans.length,
    readers: 2,
    identical: true,
  });
  console.log(mode, row.key, "all values identical");
}
const files = [
  "tools/picture-qr-fidelity/qualify.mjs",
  "tools/picture-qr-fidelity/qualify-parallel.mjs",
  "tools/picture-qr-fidelity/qualify-worker.mjs",
  "tools/picture-qr-fidelity/captures.mjs",
  "tools/qrs-study/readers.mjs",
  "tools/qrc-picture.mjs",
];
fs.writeFileSync(
  `${directory}/qualification-equivalence.json`,
  JSON.stringify(
    {
      node: process.version,
      generated: new Date().toISOString(),
      note: "The parallel scheduler calls the original assessment function on four disjoint condition partitions. All 24 original conditions run with both original readers; scores, raw capture hashes, and every reader boolean match the default serial assessment exactly. No arithmetic, reader setting, threshold, or appearance-clock boundary changed. This is correctness evidence, not a product-speed measurement.",
      hashes: Object.fromEntries(files.map((file) => [file, sha(fs.readFileSync(file))])),
      cases: evidence,
    },
    null,
    2,
  ) + "\n",
);
console.log(
  JSON.stringify({
    cases: evidence.length,
    readerResultsCompared: evidence.length * 48,
    identical: true,
  }),
);
