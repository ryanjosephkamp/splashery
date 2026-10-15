// Assemble the review after the fitting merge and the second repair.
// Retention is predeclared; failures and baseline replicates remain in raw evidence.
import assert from "node:assert/strict";
import fs from "node:fs";
import { createHash } from "node:crypto";
import { execFileSync } from "node:child_process";
import { PNG } from "pngjs";
import { detailFraction, detailOptionsSupported } from "../../src/qr-craft/detail-policy.js";
import { encodeQR } from "../../src/qr/encode.js";
import { shapeHalf } from "../../src/qr/circle.js";

const root = ".cache/picture-qr-fidelity",
  directory = "tools/picture-qr-fidelity/results/review-pass";
const partial = process.argv.includes("--partial");
const read = (file) => JSON.parse(fs.readFileSync(file, "utf8"));
const lines = (file) =>
  fs.existsSync(file)
    ? fs.readFileSync(file, "utf8").split("\n").filter(Boolean).map(JSON.parse)
    : [];
const sha = (bytes) => createHash("sha256").update(bytes).digest("hex");
const write = (file, value) => fs.writeFileSync(file, JSON.stringify(value, null, 2) + "\n");
const writeLines = (file, rows) =>
  fs.writeFileSync(file, rows.map(JSON.stringify).join("\n") + (rows.length ? "\n" : ""));
const plan = read(`${directory}/repair-plan.json`),
  corpus = read(`${directory}/corpus.json`),
  payloads = read(`${directory}/payloads.json`);
const expected = corpus.flatMap((p) =>
  payloads.flatMap((_, link) => ["square", "circle"].map((shape) => `${p.id}/${link}/${shape}`)),
);
assert.equal(expected.length, 2000);
const baseProvenance = read(`${root}/paired-${plan.baseComposite}-provenance.json`);
assert.equal(baseProvenance.sourceProof.verifiedFromGit, true);
const base = {},
  fresh = {},
  timing = {};
for (const mode of ["main", "detail"])
  base[mode] = new Map(
    lines(`${root}/browser-${plan.baseComposite}-${mode}-low-0.jsonl`).map((row) => [row.key, row]),
  );
assert.equal(base.main.size, plan.baseCounts.main);
assert.equal(base.detail.size, plan.baseCounts.detail);
timing[plan.baseComposite] = lines(`${root}/paired-${plan.baseComposite}.jsonl`);
const recheck = read(`${directory}/repair-recheck-cases.json`),
  remaining = read(`${directory}/repair-remaining-cases.json`);
const features = read(`${directory}/contrast-features.json`),
  low = new Set();
for (const feature of features) {
  const image = PNG.sync.read(fs.readFileSync(`${root}/review/sources/${feature.picture}.png`));
  assert.equal(sha(image.data), feature.sourceRGBA8Sha256, feature.picture);
  const data = new Float32Array(image.width * image.height * 3);
  for (let i = 0; i < image.width * image.height; i++)
    for (let channel = 0; channel < 3; channel++)
      data[3 * i + channel] = image.data[4 * i + channel] / 255;
  const picture = { w: image.width, h: image.height, data };
  assert.equal(
    detailFraction(picture, "square") === 0.6,
    feature.lowContrastSquare,
    feature.picture,
  );
  assert.equal(detailFraction(picture, "circle"), 0.4);
  if (feature.lowContrastSquare) low.add(feature.picture);
}
assert.equal(features.length, corpus.length);
const changed = [...base.detail.values()]
  .filter(
    (row) =>
      plan.pixelControls.includes(row.key) ||
      (row.shape === "square" && low.has(row.picture)) ||
      row.fallback ||
      row.rendering?.validation !== "capture" ||
      (row.shape === "circle" && row.check.detail.candidates > 4),
  )
  .map((row) => row.key);
assert.deepEqual([...recheck].sort(), changed.sort());
assert.deepEqual([...remaining].sort(), expected.filter((key) => !base.detail.has(key)).sort());
assert.equal(recheck.length, plan.recheckCases);
assert.equal(remaining.length, plan.remainingCases);
const versions = payloads.map((text) => encodeQR(text, "H", { boost: false }).version + 4);
assert(
  Math.max(...versions) <= 13,
  "Long-code fallback must remain disjoint from the fixed corpus",
);
for (const shape of ["square", "circle"])
  assert(
    detailOptionsSupported({
      shape,
      pictureFit: "legacy",
      cropX: 0.5,
      cropY: 0.5,
      cropZoom: 1,
      circleBorder: "legacy",
      eyeShape: "style",
    }),
  );
for (let version = 1; version <= 40; version++) {
  const size = 17 + 4 * version;
  assert.equal(shapeHalf(size, "square"), size / 2 + 4);
  assert.equal(shapeHalf(size, "circle"), Math.ceil(Math.SQRT2 * (size / 2 + 4) + 2) + 0.5);
}
const components = {};
for (const run of [plan.recheckRun, plan.remainingRun]) {
  const file = `${root}/paired-${run}-provenance.json`;
  if (!fs.existsSync(file)) {
    assert(partial, `Missing ${run} provenance`);
    continue;
  }
  const provenance = (components[run] = read(file));
  assert.equal(provenance.node, "v22.23.3");
  assert.equal(provenance.hardwareConcurrency, 4);
  assert.equal(provenance.baseline, baseProvenance.baseline);
  assert.deepEqual(provenance.frozenMain, baseProvenance.components["review-full"].frozenMain);
  execFileSync("git", ["merge-base", "--is-ancestor", plan.mergedMain, provenance.head]);
  const selectionFile = `${directory}/${run === plan.recheckRun ? "repair-recheck" : "repair-remaining"}-cases.json`;
  assert.equal(provenance.hashes[selectionFile], sha(fs.readFileSync(selectionFile)));
  assert.equal(
    provenance.hashes[`${directory}/payloads.json`],
    sha(fs.readFileSync(`${directory}/payloads.json`)),
  );
  assert.equal(
    provenance.hashes[`${directory}/corpus.json`],
    sha(fs.readFileSync(`${directory}/corpus.json`)),
  );
  for (const [file, hash] of Object.entries(baseProvenance.components["review-full"].hashes))
    if (
      file.startsWith("assets/") ||
      file.startsWith("tools/picture-qr-fidelity/fixtures/") ||
      file.startsWith(`${root}/review/sources/`) ||
      [
        "tools/picture-qr-fidelity/qualify.mjs",
        "tools/picture-qr-fidelity/metrics.mjs",
        "tools/picture-qr-fidelity/captures.mjs",
        "tools/qrs-study/readers.mjs",
        "tools/qrc-picture.mjs",
        "tools/qr-scan-lab/sim.mjs",
        "vendor/jsqr/jsQR.js",
        "package-lock.json",
      ].includes(file)
    )
      assert.equal(provenance.hashes[file], hash, `Assessment/input changed: ${file}`);
  if (components[plan.recheckRun] && run === plan.remainingRun) {
    const earlier = components[plan.recheckRun].hashes;
    for (const [file, hash] of Object.entries(earlier))
      if (!file.endsWith("-cases.json"))
        assert.equal(provenance.hashes[file], hash, `Fresh source drift: ${file}`);
  }
  fresh[run] = {};
  const allowed = run === plan.recheckRun ? recheck : remaining;
  for (const mode of ["main", "detail"]) {
    const rows = lines(`${root}/browser-${run}-${mode}-low-0.jsonl`);
    assert.equal(new Set(rows.map((r) => r.key)).size, rows.length, `${run}/${mode}`);
    for (const row of rows) assert(allowed.includes(row.key), row.key);
    fresh[run][mode] = new Map(rows.map((row) => [row.key, row]));
  }
  timing[run] = lines(`${root}/paired-${run}.jsonl`);
  assert.equal(
    new Set(timing[run].map((row) => `${row.pair}/${row.mode}`)).size,
    timing[run].length,
    `Duplicate timing in ${run}`,
  );
  if (!partial) assert.equal(timing[run].length, fresh[run].main.size + fresh[run].detail.size);
}
let maskProof = null;
if (components[plan.recheckRun]) {
  const revision = components[plan.recheckRun].head;
  const file = "src/qr-craft/picture.js";
  const source = execFileSync("git", ["show", `${revision}:${file}`], { encoding: "utf8" });
  const parent = execFileSync("git", ["show", `${baseProvenance.head}:${file}`], {
    encoding: "utf8",
  });
  const start = source.indexOf(
    '        if (t.shape === "circle")\n          for (const mask of [0, 1, 2, 3, 4, 5, 6, 7])',
  );
  const end = source.indexOf("        for (const build of alternatives)", start);
  assert(start >= 0 && end > start);
  assert.equal(source.slice(0, start) + source.slice(end), parent);
  assert.equal(sha(source), components[plan.recheckRun].hashes[file]);
  maskProof = {
    revision,
    parent: baseProvenance.head,
    file,
    insertionSha256: sha(source.slice(start, end)),
    outsideInsertionByteIdentical: true,
  };
}
const selected = { main: [], detail: [] },
  primaryTiming = [],
  replaced = [],
  replicates = [];
for (const mode of ["main", "detail"])
  for (const key of expected) {
    const run =
      mode === "main" && base.main.has(key)
        ? plan.baseComposite
        : mode === "detail" && recheck.includes(key)
          ? plan.recheckRun
          : mode === "detail" && base.detail.has(key)
            ? plan.baseComposite
            : plan.remainingRun;
    const row = run === plan.baseComposite ? base[mode].get(key) : fresh[run]?.[mode].get(key);
    if (!row) {
      assert(partial, `Missing ${run}/${mode}/${key}`);
      continue;
    }
    const observation = timing[run].find((r) => r.mode === mode && r.pair === `${key}/0`);
    assert(observation, `Missing timing ${run}/${mode}/${key}`);
    assert.equal(observation.ms, row.ms);
    assert.equal(row.text, payloads[row.link]);
    const measurementRun = run === plan.baseComposite ? row.measurementRun : run;
    selected[mode].push({ ...row, measurementRun });
    primaryTiming.push({ ...observation, measurementRun });
    if (mode === "detail" && run === plan.recheckRun) replaced.push(base.detail.get(key));
    if (mode === "main" && run === plan.baseComposite && fresh[plan.remainingRun]?.main.has(key))
      replicates.push({
        ...fresh[plan.remainingRun].main.get(key),
        measurementRun: plan.remainingRun,
      });
  }
const controlRows = new Map(selected.detail.map((r) => [r.key, r]));
const pixelControls = plan.pixelControls
  .filter((key) => controlRows.has(key))
  .map((key) => ({
    key,
    before: base.detail.get(key).captureRGBA8Sha256,
    after: controlRows.get(key).captureRGBA8Sha256,
    identical: base.detail.get(key).captureRGBA8Sha256 === controlRows.get(key).captureRGBA8Sha256,
  }));
if (!partial)
  assert(
    pixelControls.length === plan.pixelControls.length && pixelControls.every((r) => r.identical),
    "Merged default-path pixels changed",
  );
for (const mode of ["main", "detail"]) {
  writeLines(`${root}/browser-review-final-${mode}-low-0.jsonl`, selected[mode]);
  fs.mkdirSync(`${root}/review/review-final-${mode}`, { recursive: true });
  for (const row of selected[mode].filter((r) => r.link === 0))
    for (const suffix of ["render", "390x844"])
      fs.copyFileSync(
        `${root}/review/${row.measurementRun}-${mode}/${row.picture}-${row.shape}-0-${suffix}.png`,
        `${root}/review/review-final-${mode}/${row.picture}-${row.shape}-0-${suffix}.png`,
      );
}
writeLines(`${root}/paired-review-final.jsonl`, primaryTiming);
write(`${root}/paired-review-final-provenance.json`, {
  baseline: baseProvenance.baseline,
  head: components[plan.remainingRun]?.head || components[plan.recheckRun]?.head || null,
  series:
    "segmented corpus across source revisions: retained unchanged capture paths, isolated affected-path rechecks, and balanced remaining pairs; not one fresh balanced trial",
  complete: selected.main.length === 2000 && selected.detail.length === 2000,
  plan,
  baseProvenance,
  components,
  maskProof,
  pixelControls,
  independentContrastRecords: features,
  fixedPayloadVersions: versions,
  retentionLimit:
    "Retained rows and their timings were captured before the fitting merge. Their parameter paths are unchanged under Original geometry; six post-merge controls require identical captured RGBA. They are not freshly rendered or retimed at the final head. Per-row measurementRun identifies the observation.",
  interruptions: baseProvenance.interruptions,
  duplicateMainObservations: [...baseProvenance.duplicateMainObservations, ...replicates],
  replacedDetailObservations: [...baseProvenance.replacedDetailObservations, ...replaced],
  counts: Object.fromEntries(Object.entries(selected).map(([mode, rows]) => [mode, rows.length])),
});
console.log(
  JSON.stringify(
    {
      complete: selected.main.length === 2000 && selected.detail.length === 2000,
      counts: { main: selected.main.length, detail: selected.detail.length },
      rechecked: replaced.length,
      replicates: replicates.length,
      pixelControls,
    },
    null,
    2,
  ),
);
