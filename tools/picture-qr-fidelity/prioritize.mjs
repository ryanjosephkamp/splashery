// Reevaluate every final model-path code; preserve rejected and slower trials.
import fs from "node:fs";
import { createHash } from "node:crypto";
import { PNG } from "pngjs";
const root = ".cache/picture-qr-fidelity";
const read = (f) =>
  fs.readFileSync(`${root}/${f}`, "utf8").trim().split("\n").filter(Boolean).map(JSON.parse);
const json = (f) => JSON.parse(fs.readFileSync(`${root}/${f}`));
const write = (f, rows) =>
  fs.writeFileSync(`${root}/${f}`, rows.map(JSON.stringify).join("\n") + "\n");
const old = read("browser-final-joined-low-0.jsonl"),
  fresh = read("browser-priority-detail-low-0.jsonl"),
  keys = new Set(json("priority-cases.json"));
const byKey = new Map(fresh.map((r) => [r.key, r]));
if (
  old.length !== 1040 ||
  fresh.length !== keys.size ||
  byKey.size !== keys.size ||
  [...keys].some((k) => !byKey.has(k)) ||
  old.some((r) => (r.rendering.validation === "model") !== keys.has(r.key))
)
  throw Error("Incomplete model-path selection");
const fields = [
  "codeSize",
  "mask",
  "rotation",
  "version",
  "margin",
  "rendering",
  "modules",
  "method",
  "kitCount",
];
let maxScoreError = 0;
for (const r of fresh) {
  const b = old.find((b) => b.key === r.key);
  if (!b || fields.some((k) => JSON.stringify(r[k]) !== JSON.stringify(b[k])))
    throw Error("Output changed " + r.key);
  maxScoreError = Math.max(
    maxScoreError,
    ...["phone", "print"].flatMap((scale) =>
      ["ssim", "rmse"].map((metric) => Math.abs(r.scores[scale][metric] - b.scores[scale][metric])),
    ),
  );
  if (
    ["phone", "print"].some((scale) =>
      ["ssim", "rmse"].some(
        (metric) => Math.abs(r.scores[scale][metric] - b.scores[scale][metric]) > 1e-12,
      ),
    )
  )
    throw Error("Captured scores changed " + r.key);
  if (
    !r.check?.ok ||
    !r.check?.stress?.ok ||
    r.check.stage.length !== 2 ||
    r.check.stage.some((s) => !s.ok) ||
    r.scans.length !== 24 ||
    r.scans.some((s) => !s.jsqr || !s.zxingcpp)
  )
    throw Error("Reader/gate regression " + r.key);
}
const diagnosticPixels = [];
for (const [picture, link, shape] of [
  ["cdx-qr-ai-fern", 8, "square"],
  ["met-459968", 8, "circle"],
]) {
  const file = `${picture}-${shape}-${link}-render.png`;
  const hashes = ["qualified-retries", "priority"].map((run) =>
    createHash("sha256")
      .update(PNG.sync.read(fs.readFileSync(`${root}/review/${run}-detail/${file}`)).data)
      .digest("hex"),
  );
  if (hashes[0] !== hashes[1]) throw Error("Diagnostic captured pixels changed " + file);
  diagnosticPixels.push({ picture, link, shape, rgbaSha256: hashes[0] });
}
const oldTimes = read("paired-final-joined.jsonl"),
  times = read("paired-priority.jsonl"),
  byPair = new Map(times.map((r) => [r.pair, r]));
if (times.length !== keys.size || byPair.size !== keys.size)
  throw Error("Incomplete priority timings");
const oldMs = oldTimes
    .filter((r) => keys.has(`${r.picture}/${r.link}/${r.shape}`))
    .reduce((n, r) => n + r.ms, 0),
  newMs = times.reduce((n, r) => n + r.ms, 0);
const decision = {
  kept: true,
  codes: fresh.length,
  originalModelMs: oldMs,
  priorityModelMs: newMs,
  unchangedOutputFields: fields,
  diagnosticPixels,
  maxScoreError,
  allReaderAttemptsPassed: fresh.length * 48,
  notes:
    "Every model-path final row reevaluated; all capture-only rows never enter the changed branch. Last failed model frame is an exact subset of the full matrix. Accepted models still run all 24 conditions with both readers. No stored pixels or payloads in priority memory. Separate isolated series with limited repeats.",
};
if (newMs >= oldMs)
  throw Error("No aggregate speed improvement; review before retaining optimization");
for (const f of [
  "browser-final-joined-low-0.jsonl",
  "paired-final-joined.jsonl",
  "paired-final-joined-provenance.json",
])
  fs.copyFileSync(`${root}/${f}`, `${root}/before-priority-${f}`);
write(
  "browser-final-joined-low-0.jsonl",
  old.map((r) =>
    byKey.has(r.key)
      ? { ...byKey.get(r.key), measurementRun: "priority", qualificationReused: false }
      : r,
  ),
);
write(
  "paired-final-joined.jsonl",
  oldTimes.map((r) =>
    byPair.has(r.pair) ? { ...byPair.get(r.pair), measurementRun: "priority" } : r,
  ),
);
const p = json("paired-final-joined-provenance.json"),
  next = json("paired-priority-provenance.json");
const changedRuntime = new Set([
  "src/qr-craft/scan-pool.js",
  "src/packs/qr-craft.js",
  "src/stage.js",
]);
for (const [file, hash] of Object.entries(p.hashes))
  if (
    !changedRuntime.has(file) &&
    file !== `${root}/retry-cases.json` &&
    next.hashes[file] !== hash
  )
    throw Error("Unexpected runtime/input/protocol change " + file);
decision.currentMainIntegration =
  "Merged ea35f3de. The QR pack adds only main’s no-picture fallback; the measured picture branches retain the same calculations. Stage keeps both hold APIs and retires textures after real draws. Stable capture draws retain the same geometry and shaders. All final model rows were freshly checked for identical output parameters, captured scores, and both readers; unchanged capture-only rows retain their earlier evidence. The final requested suite includes both hold APIs, actual tile draws, current-main Circle scans, and ordinary scene retirement.";

p.beforePriorityHead = p.head;
p.head = next.head;
p.priority = { ...decision, provenance: next };
p.initialAndRetryHashes = p.hashes;
p.hashes = next.hashes;
p.retainedCaptureOnlyRows = 1040 - keys.size;
fs.writeFileSync(`${root}/paired-final-joined-provenance.json`, JSON.stringify(p, null, 2) + "\n");
fs.writeFileSync(`${root}/priority-decision.json`, JSON.stringify(decision, null, 2) + "\n");
for (const f of fs.readdirSync(`${root}/review/priority-detail`))
  if (/-0-(?:render|390x844)\.png$/.test(f))
    fs.copyFileSync(
      `${root}/review/priority-detail/${f}`,
      `${root}/review/final-joined-detail/${f}`,
    );
console.log(decision);
