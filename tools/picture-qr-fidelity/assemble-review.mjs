// Join the interrupted review corpus using the predeclared changed-path rule.
// Raw failed attempts and duplicate baseline measurements remain separate evidence.
import assert from "node:assert/strict";
import fs from "node:fs";
import { createHash } from "node:crypto";
import { execFileSync } from "node:child_process";

const root = ".cache/picture-qr-fidelity";
const directory = "tools/picture-qr-fidelity/results/review-pass";
const read = (file) => JSON.parse(fs.readFileSync(file, "utf8"));
const lines = (file) =>
  fs.existsSync(file)
    ? fs.readFileSync(file, "utf8").split("\n").filter(Boolean).map(JSON.parse)
    : [];
const sha = (bytes) => createHash("sha256").update(bytes).digest("hex");
const write = (file, value) => fs.writeFileSync(file, JSON.stringify(value, null, 2) + "\n");
const writeLines = (file, rows) =>
  fs.writeFileSync(file, rows.map(JSON.stringify).join("\n") + (rows.length ? "\n" : ""));
const partial = process.argv.includes("--partial");
const plan = read(`${directory}/continuation-plan.json`);
const corpus = read(`${directory}/corpus.json`);
const expected = corpus.flatMap((picture) =>
  Array.from({ length: 10 }, (_, link) =>
    ["square", "circle"].map((shape) => `${picture.id}/${link}/${shape}`),
  ).flat(),
);
assert.equal(expected.length, plan.expectedCodesPerMode);
assert.equal(new Set(expected).size, expected.length);
const recheck = read(`${directory}/finder-edge-recheck-cases.json`);
const remaining = read(`${directory}/remaining-cases.json`);
assert.equal(new Set(recheck).size, plan.remeasuredCircleCases);
assert.equal(new Set(remaining).size, plan.remainingCases);
for (const key of [...recheck, ...remaining]) assert(expected.includes(key), key);
const runs = [plan.originalRun, plan.recheckRun, plan.remainingRun];
const components = Object.fromEntries(
  runs.map((run) => [run, read(`${root}/paired-${run}-provenance.json`)]),
);
const original = components[plan.originalRun];
const candidate = components[plan.recheckRun];
assert(original.head.startsWith(plan.originalSource));
assert.equal(
  execFileSync("git", ["rev-parse", original.baseline], { encoding: "utf8" }).trim(),
  plan.baseline,
);
const pictureFile = "src/qr-craft/picture.js";
const gitSource = (revision) =>
  execFileSync("git", ["show", `${revision}:${pictureFile}`], { encoding: "utf8" });
const oldSource = gitSource(original.head);
const newSource = gitSource(candidate.head);
assert.equal(sha(oldSource), plan.sourceGuard.originalPictureSha256);
assert.equal(sha(newSource), plan.sourceGuard.candidatePictureSha256);
const start = newSource.indexOf(
  '        if (t.shape === "circle")\n          for (const edge of [0.4, 0.42])',
);
const end = newSource.indexOf("        for (const build of alternatives)", start);
assert(start >= 0 && end > start, "Circle insertion markers");
assert.equal(sha(newSource.slice(start, end)), plan.sourceGuard.insertionSha256);
assert.equal(newSource.slice(0, start) + newSource.slice(end), oldSource);
const sourceProof = {
  ...plan.sourceGuard,
  verifiedFromGit: true,
  original: original.head,
  candidate: candidate.head,
};
for (const [run, provenance] of Object.entries(components)) {
  assert.equal(provenance.node, "v22.23.3", run);
  assert.equal(provenance.hardwareConcurrency, 4, run);
  assert.equal(provenance.baseline, original.baseline, run);
  assert.deepEqual(provenance.frozenMain, original.frozenMain, run);
  for (const [file, hash] of Object.entries(original.hashes))
    assert.equal(
      provenance.hashes[file],
      file === pictureFile && run !== plan.originalRun ? sha(newSource) : hash,
      `${run}: ${file}`,
    );
  const extras = Object.keys(provenance.hashes).filter((file) => !(file in original.hashes));
  assert.deepEqual(
    extras,
    run === plan.originalRun
      ? []
      : [
          `${directory}/${run === plan.recheckRun ? "finder-edge-recheck" : "remaining"}-cases.json`,
        ],
  );
  for (const file of extras)
    assert.equal(provenance.hashes[file], sha(fs.readFileSync(file)), file);
}
const captures = {},
  timings = {};
for (const run of runs) {
  timings[run] = lines(`${root}/paired-${run}.jsonl`);
  captures[run] = {};
  for (const mode of ["main", "detail"]) {
    const rows = lines(`${root}/browser-${run}-${mode}-low-0.jsonl`);
    assert.equal(new Set(rows.map((r) => r.key)).size, rows.length, `Duplicate ${run}/${mode}`);
    const allowed =
      run === plan.recheckRun ? recheck : run === plan.remainingRun ? remaining : expected;
    for (const row of rows) assert(allowed.includes(row.key), `${run}/${mode}/${row.key}`);
    captures[run][mode] = new Map(rows.map((row) => [row.key, row]));
  }
  const timingKeys = timings[run].map((row) => `${row.pair}/${row.mode}`);
  assert.equal(new Set(timingKeys).size, timingKeys.length, `Duplicate timing in ${run}`);
  if (!partial) {
    assert.equal(timings[run].length, captures[run].main.size + captures[run].detail.size, run);
    for (const row of timings[run])
      assert(
        captures[run][row.mode]?.has(row.pair.replace(/\/0$/, "")),
        `Unmatched timing ${run}/${row.pair}/${row.mode}`,
      );
  }
}
assert.equal(captures[plan.recheckRun].main.size, 0);
const old = captures[plan.originalRun];
assert.equal(old.main.size, plan.originalCounts.main);
assert.equal(old.detail.size, plan.originalCounts.detail);
const changed = [...old.detail.values()]
  .filter(
    (row) =>
      row.shape === "circle" &&
      (row.fallback ||
        row.rendering?.validation !== "capture" ||
        row.check?.detail?.candidates > 2),
  )
  .map((row) => row.key)
  .sort();
assert.deepEqual([...recheck].sort(), changed);
assert.deepEqual([...remaining].sort(), expected.filter((key) => !old.detail.has(key)).sort());
assert.equal(old.detail.size - recheck.length, plan.retainedDetailCases);
const selected = { main: [], detail: [] },
  selectedTiming = [],
  duplicateMain = [],
  replacedDetail = [];
for (const mode of ["main", "detail"])
  for (const key of expected) {
    const run =
      mode === "main" && old.main.has(key)
        ? plan.originalRun
        : mode === "detail" && recheck.includes(key)
          ? plan.recheckRun
          : mode === "detail" && old.detail.has(key)
            ? plan.originalRun
            : plan.remainingRun;
    const row = captures[run][mode].get(key);
    if (!row) {
      assert(partial, `Missing ${run}/${mode}/${key}`);
      continue;
    }
    const timing = timings[run].find((r) => r.pair === `${key}/0` && r.mode === mode);
    assert(timing, `Missing timing ${run}/${mode}/${key}`);
    assert.equal(timing.ms, row.ms, key);
    selected[mode].push({ ...row, measurementRun: run });
    selectedTiming.push({ ...timing, measurementRun: run });
    if (mode === "main" && run === plan.originalRun && captures[plan.remainingRun].main.has(key))
      duplicateMain.push({
        ...captures[plan.remainingRun].main.get(key),
        measurementRun: plan.remainingRun,
        reason:
          "Original main observation retained under the predeclared rule; continuation observation preserved as a replicate.",
      });
    if (mode === "detail" && run === plan.recheckRun)
      replacedDetail.push({
        ...old.detail.get(key),
        measurementRun: plan.originalRun,
        reason:
          "Changed Circle path requalified after the finder-edge repair; original attempt retained.",
      });
  }
assert(duplicateMain.length <= 1);
const name = process.argv.find((arg) => arg.startsWith("--name="))?.slice(7) || "review-final";
for (const mode of ["main", "detail"]) {
  writeLines(`${root}/browser-${name}-${mode}-low-0.jsonl`, selected[mode]);
  const target = `${root}/review/${name}-${mode}`;
  fs.mkdirSync(target, { recursive: true });
  for (const row of selected[mode].filter((row) => row.link === 0))
    for (const suffix of ["390x844", "render"])
      fs.copyFileSync(
        `${root}/review/${row.measurementRun}-${mode}/${row.picture}-${row.shape}-0-${suffix}.png`,
        `${target}/${row.picture}-${row.shape}-0-${suffix}.png`,
      );
}
writeLines(`${root}/paired-${name}.jsonl`, selectedTiming);
write(`${root}/paired-${name}-provenance.json`, {
  baseline: original.baseline,
  head: candidate.head,
  series:
    "segmented full corpus: original balanced partial run, balanced continuation, and isolated changed-path Circle detail rechecks; not one fresh balanced trial",
  complete: selected.main.length === expected.length && selected.detail.length === expected.length,
  plan,
  sourceProof,
  components,
  interruptions: [
    ...read(`${root}/paired-review-full-interruptions.json`),
    ...(fs.existsSync(`${root}/paired-review-remaining-interruptions.json`)
      ? read(`${root}/paired-review-remaining-interruptions.json`)
      : []),
  ],
  selectedCounts: Object.fromEntries(
    Object.entries(selected).map(([mode, rows]) => [
      mode,
      Object.fromEntries(
        runs.map((run) => [run, rows.filter((row) => row.measurementRun === run).length]),
      ),
    ]),
  ),
  duplicateMainObservations: duplicateMain,
  replacedDetailObservations: replacedDetail,
  rawRuns: runs.map((run) => ({
    run,
    timing: `paired-${run}.jsonl`,
    main: `browser-${run}-main-low-0.jsonl`,
    detail: `browser-${run}-detail-low-0.jsonl`,
  })),
});
console.log(
  JSON.stringify(
    {
      name,
      complete:
        selected.main.length === expected.length && selected.detail.length === expected.length,
      counts: { main: selected.main.length, detail: selected.detail.length },
      duplicateMain: duplicateMain.length,
      replacedDetail: replacedDetail.length,
      sourceProof,
    },
    null,
    2,
  ),
);
