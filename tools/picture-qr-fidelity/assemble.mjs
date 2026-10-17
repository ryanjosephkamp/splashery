// Preserve the complete initial run and replace every potentially affected retry case.
import fs from "node:fs";
import { execFileSync } from "node:child_process";
const root = ".cache/picture-qr-fidelity";
const read = (file) =>
  fs.readFileSync(file, "utf8").trim().split("\n").filter(Boolean).map(JSON.parse);
const json = (file) => JSON.parse(fs.readFileSync(file));
const write = (file, rows) => fs.writeFileSync(file, rows.map(JSON.stringify).join("\n") + "\n");
const oldName = "final-detail",
  newName = "qualified-retries",
  name = "final-joined";
const selected = new Set(json(`${root}/retry-cases.json`));
const before = read(`${root}/browser-${oldName}-detail-low-0.jsonl`);
const after = read(`${root}/browser-${newName}-detail-low-0.jsonl`);
const byKey = new Map(after.map((r) => [r.key, r]));
if (
  before.length !== 1040 ||
  new Set(before.map((r) => r.key)).size !== 1040 ||
  after.length !== selected.size ||
  byKey.size !== selected.size ||
  [...selected].some((key) => !byKey.has(key)) ||
  after.some((r) => !selected.has(r.key))
)
  throw Error("Incomplete or duplicate qualification inputs");
if (before.some((r) => Boolean(r.rejected?.length) !== selected.has(r.key)))
  throw Error("Selection is not the complete rejection-list superset");
const oldProvenance = json(`${root}/paired-${oldName}-provenance.json`);
const newProvenance = json(`${root}/paired-${newName}-provenance.json`);
const allowed = new Set([
  "src/packs/qr-craft.js",
  "src/qr-craft/fast-blur.js",
  "tools/picture-qr-fidelity/paired.mjs",
]);
for (const [file, hash] of Object.entries(oldProvenance.hashes))
  if (!allowed.has(file) && newProvenance.hashes[file] !== hash)
    throw Error(`Unexpected input or runtime change: ${file}`);
const changedSource = execFileSync(
  "git",
  ["diff", "--name-only", oldProvenance.head, newProvenance.head, "--", "src"],
  { encoding: "utf8" },
)
  .trim()
  .split("\n")
  .filter(Boolean);
if (changedSource.some((file) => !allowed.has(file)))
  throw Error("Additional runtime changes need a new qualification plan");
const retained = before.filter((r) => !selected.has(r.key));
if (
  retained.some(
    (r) =>
      r.rendering?.validation !== "capture" ||
      !r.check?.ok ||
      !r.check?.stress?.ok ||
      r.scans.length !== 24 ||
      r.scans.some((s) => !s.jsqr || !s.zxingcpp),
  )
)
  throw Error("An unchanged initial-path row was not qualified");
const annotate = (r, fresh) => ({
  ...r,
  measurementRun: fresh ? newName : oldName,
  qualificationReused: !fresh,
  ...(fresh
    ? {}
    : {
        reuseReason:
          "No actual rejection; the new retry-only forecast guard stays false. Same picture, code construction, initial checks, and rendering. Clamped-buffer arithmetic is unchanged.",
      }),
});
write(
  `${root}/browser-${name}-low-0.jsonl`,
  before.map((r) => annotate(byKey.get(r.key) || r, byKey.has(r.key))),
);
const oldTimes = read(`${root}/paired-${oldName}.jsonl`),
  newTimes = read(`${root}/paired-${newName}.jsonl`);
const byPair = new Map(newTimes.map((r) => [r.pair, r]));
if (
  oldTimes.length !== 1040 ||
  newTimes.length !== selected.size ||
  byPair.size !== selected.size ||
  oldTimes.some((r) => selected.has(`${r.picture}/${r.link}/${r.shape}`) && !byPair.has(r.pair))
)
  throw Error("Incomplete timing inputs");
write(
  `${root}/paired-${name}.jsonl`,
  oldTimes.map((r) => ({
    ...(byPair.get(r.pair) || r),
    measurementRun: byPair.has(r.pair) ? newName : oldName,
  })),
);
const provenance = {
  model: "Codex (GPT-6)",
  baseline: "41b21e74",
  head: newProvenance.head,
  series:
    "Isolated detail series with complete reevaluation of the retry-path superset; unchanged initial-path rows retained. Main timings are separate joined series, not balanced pairs.",
  originalCodes: before.length,
  reevaluatedCodes: after.length,
  retainedInitialPathCodes: retained.length,
  changedSource,
  hashes: newProvenance.hashes,
  guardProof:
    "The only scan-policy change activates when the current options key has an actual rejection. Every original nonempty rejection list was reevaluated, including stale lists from earlier options. An empty original list proves the first source-qualified candidate passed its actual checks: the new branch is never entered. All other runtime source and inputs are unchanged. The Gaussian guard excludes non-clamped buffers; every corpus camera frame is Uint8ClampedArray, with byte-equivalence regressions. Timing rows retain their original measurement run; initial-path timings predate the added retry guard, whose isolated overhead was not separately measured. Strict speed remains an unmet gate.",
  runs: { [oldName]: oldProvenance, [newName]: newProvenance },
};
fs.writeFileSync(
  `${root}/paired-${name}-provenance.json`,
  JSON.stringify(provenance, null, 2) + "\n",
);
const directory = `${root}/review/${name}-detail`;
fs.mkdirSync(directory, { recursive: true });
for (const run of [oldName, newName])
  for (const file of fs.readdirSync(`${root}/review/${run}-detail`))
    if (/-0-(?:render|390x844)\.png$/.test(file))
      fs.copyFileSync(`${root}/review/${run}-detail/${file}`, `${directory}/${file}`);
console.log({
  completeCodes: before.length,
  reevaluated: after.length,
  retained: retained.length,
  failedReads: before
    .map((r) => byKey.get(r.key) || r)
    .reduce((n, r) => n + r.scans.filter((s) => !s.jsqr || !s.zxingcpp).length, 0),
});

const combined = before.map((r) => byKey.get(r.key) || r);
const baseline = new Map(
  [0, 1]
    .flatMap((shard) => read(`${root}/browser-main-all-low-${shard}.jsonl`))
    .map((r) => [r.key, r]),
);
const groups = new Map();
for (const row of combined) {
  const group = `${row.picture}/${row.shape}`;
  if (!groups.has(group)) groups.set(group, []);
  groups.get(group).push(row);
}
const fidelity = [...groups].map(([key, rows]) => ({
  key,
  ...Object.fromEntries(
    ["phone", "print"].map((scale) => [
      scale,
      rows.reduce((n, r) => n + r.scores[scale].ssim - baseline.get(r.key).scores[scale].ssim, 0) /
        rows.length,
    ]),
  ),
}));
const gates = {
  codes: combined.length,
  failedReaderKeys: combined
    .filter((r) => r.scans.some((s) => !s.jsqr || !s.zxingcpp))
    .map((r) => r.key),
  failedGateKeys: combined
    .filter(
      (r) =>
        !r.check?.ok ||
        !r.check?.stress?.ok ||
        r.check?.stage?.length !== 2 ||
        r.check.stage.some((s) => !s.ok),
    )
    .map((r) => r.key),
  belowOnePointGroups: fidelity.filter((r) => r.phone < 0.01 || r.print < 0.01),
  fidelity,
};
fs.writeFileSync(`${root}/${name}-gates.json`, JSON.stringify(gates, null, 2) + "\n");
if (
  gates.failedReaderKeys.length ||
  gates.failedGateKeys.length ||
  gates.belowOnePointGroups.length
)
  throw Error(
    "Updated corpus needs attention before continuing main timings; inspect final-joined-gates.json",
  );
// The optional final rejection-order experiment is a separate, complete model-path rerun.
if (process.argv.includes("--priority"))
  execFileSync("node", ["tools/picture-qr-fidelity/prioritize.mjs"], { stdio: "inherit" });
