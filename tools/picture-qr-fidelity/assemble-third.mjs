// Final small correction-budget repair. Preserve every prior observation and source epoch.
import assert from "node:assert/strict";
import fs from "node:fs";
import { createHash } from "node:crypto";
import { execFileSync } from "node:child_process";
import { format, resolveConfig } from "prettier";
import { PNG } from "pngjs";
import { detailFraction } from "../../src/qr-craft/detail-policy.js";

const root = ".cache/picture-qr-fidelity",
  directory = "tools/picture-qr-fidelity/results/review-pass";
const partial = process.argv.includes("--partial");
const read = (file) => JSON.parse(fs.readFileSync(file, "utf8"));
const rows = (file) =>
  fs.existsSync(file)
    ? fs.readFileSync(file, "utf8").split("\n").filter(Boolean).map(JSON.parse)
    : [];
const sha = (value) => createHash("sha256").update(value).digest("hex");
const write = (file, value) => fs.writeFileSync(file, JSON.stringify(value, null, 2) + "\n");
const writeRows = (file, value) =>
  fs.writeFileSync(file, value.map(JSON.stringify).join("\n") + "\n");
const plan = read(`${directory}/third-plan.json`),
  corpus = read(`${directory}/corpus.json`),
  payloads = read(`${directory}/payloads.json`);
const expected = corpus.flatMap((p) =>
  payloads.flatMap((_, link) => ["square", "circle"].map((shape) => `${p.id}/${link}/${shape}`)),
);
const recheck = read(`${directory}/third-recheck-cases.json`),
  remaining = read(`${directory}/third-remaining-cases.json`);
const parent = read(`${root}/paired-${plan.baseComposite}-provenance.json`);
assert.equal(parent.maskProof.outsideInsertionByteIdentical, true);
assert.equal(parent.baseProvenance.sourceProof.verifiedFromGit, true);
assert(parent.pixelControls.every((p) => p.identical));
const base = {},
  timing = {},
  fresh = {},
  components = {};
for (const mode of ["main", "detail"]) {
  base[mode] = new Map(
    rows(`${root}/browser-${plan.baseComposite}-${mode}-low-0.jsonl`).map((r) => [r.key, r]),
  );
  assert.equal(base[mode].size, plan.baseCounts[mode]);
}
timing[plan.baseComposite] = rows(`${root}/paired-${plan.baseComposite}.jsonl`);
assert.equal(timing[plan.baseComposite].length, base.main.size + base.detail.size);
const features = read(`${directory}/contrast-features.json`),
  veryLow = new Set();
for (const feature of features) {
  const image = PNG.sync.read(fs.readFileSync(`${root}/review/sources/${feature.picture}.png`));
  assert.equal(sha(image.data), feature.sourceRGBA8Sha256);
  const data = new Float32Array(image.width * image.height * 3);
  for (let i = 0; i < image.width * image.height; i++)
    for (let ch = 0; ch < 3; ch++) data[i * 3 + ch] = image.data[i * 4 + ch] / 255;
  const pic = { w: image.width, h: image.height, data },
    low = Math.max(...feature.rgbPopulationStddev) <= 0.05;
  if (low) veryLow.add(feature.picture);
  assert.equal(
    detailFraction(pic, "square"),
    low ? 0.65 : feature.lowContrastSquare ? 0.6 : 0.4,
    feature.picture,
  );
  assert.equal(detailFraction(pic, "circle"), 0.4);
}
assert.equal(features.length, 100);
assert.deepEqual([...veryLow].sort(), [...plan.veryLowContrastPictures].sort());
assert.deepEqual(
  [...recheck].sort(),
  [...base.detail.values()]
    .filter(
      (r) => (r.shape === "square" && veryLow.has(r.picture)) || plan.pixelControls.includes(r.key),
    )
    .map((r) => r.key)
    .sort(),
);
assert.deepEqual(
  [...remaining].sort(),
  expected.filter((k) => !base.main.has(k) || !base.detail.has(k)).sort(),
);
assert.equal(recheck.length, plan.recheckCases);
assert.equal(remaining.length, plan.remainingCases);
const parentHashes = parent.components["review-repaired"].hashes;
const changedSources = new Set([
  "src/qr-craft/picture.js",
  "src/qr-craft/detail-policy.js",
  "src/qr/picture-errors.js",
  "tools/picture-qr-fidelity/qualify.mjs",
  "tools/picture-qr-fidelity/paired.mjs",
]);
for (const run of [plan.recheckRun, plan.remainingRun]) {
  const file = `${root}/paired-${run}-provenance.json`;
  if (!fs.existsSync(file)) {
    assert(partial, `Missing ${run}`);
    continue;
  }
  const p = (components[run] = read(file));
  assert.equal(p.node, "v22.23.3");
  assert.equal(p.hardwareConcurrency, 4);
  assert.equal(p.baseline, parent.baseline);
  assert.deepEqual(p.frozenMain, parent.components["review-repaired"].frozenMain);
  execFileSync("git", ["merge-base", "--is-ancestor", plan.mergedMain, p.head]);
  for (const [name, hash] of Object.entries(parentHashes))
    if (!name.endsWith("-cases.json") && !changedSources.has(name))
      assert.equal(p.hashes[name], hash, `Unexpected input/source change: ${name}`);
  for (const name of changedSources)
    assert.equal(p.hashes[name], sha(execFileSync("git", ["show", `${p.head}:${name}`])));
  const equivalence = read(`${directory}/qualification-equivalence.json`);
  assert(equivalence.cases.length >= 12 && equivalence.cases.every((c) => c.identical));
  for (const [name, hash] of Object.entries(equivalence.hashes))
    assert.equal(p.hashes[name], hash, `Qualification verification drift: ${name}`);
  assert.equal(
    p.hashes[`${directory}/qualification-equivalence.json`],
    sha(fs.readFileSync(`${directory}/qualification-equivalence.json`)),
  );
  const cases = `${directory}/${run === plan.recheckRun ? "third-recheck" : "third-remaining"}-cases.json`;
  assert.equal(p.hashes[cases], sha(fs.readFileSync(cases)));
  if (run === plan.remainingRun && components[plan.recheckRun])
    for (const [name, hash] of Object.entries(components[plan.recheckRun].hashes))
      if (!name.endsWith("-cases.json"))
        assert.equal(p.hashes[name], hash, `Source drift: ${name}`);
  fresh[run] = {};
  const allowed = run === plan.recheckRun ? recheck : remaining;
  for (const mode of ["main", "detail"]) {
    const values = rows(`${root}/browser-${run}-${mode}-low-0.jsonl`);
    assert.equal(new Set(values.map((r) => r.key)).size, values.length);
    for (const value of values) assert(allowed.includes(value.key));
    fresh[run][mode] = new Map(values.map((r) => [r.key, r]));
  }
  timing[run] = rows(`${root}/paired-${run}.jsonl`);
  assert.equal(new Set(timing[run].map((r) => `${r.pair}/${r.mode}`)).size, timing[run].length);
  if (!partial) assert.equal(timing[run].length, fresh[run].main.size + fresh[run].detail.size);
}
const sourceProof = {};
if (components[plan.recheckRun]) {
  const head = components[plan.recheckRun].head;
  for (const file of [
    "src/qr-craft/picture.js",
    "src/qr/picture-errors.js",
    "tools/picture-qr-fidelity/qualify.mjs",
    "tools/picture-qr-fidelity/paired.mjs",
  ]) {
    const original = execFileSync("git", ["show", `${plan.parentRuntime}:${file}`], {
      encoding: "utf8",
    });
    const candidate = execFileSync("git", ["show", `${head}:${file}`], { encoding: "utf8" });
    let stripped = candidate;
    if (file.endsWith("paired.mjs")) {
      stripped = stripped.replace('from "./qualify-parallel.mjs"', 'from "./qualify.mjs"');
      for (const name of [
        "tools/picture-qr-fidelity/qualify-parallel.mjs",
        "tools/picture-qr-fidelity/qualify-worker.mjs",
        `${directory}/qualification-equivalence.json`,
      ])
        stripped = stripped.replace(`    "${name}",\n`, "");
    } else if (file.endsWith("qualify.mjs")) {
      stripped = stripped
        .replace(/,\s*conditions = CONDITIONS/, "")
        .replace(
          "conditions.filter((c) => c.ppm === ppm)",
          "CONDITIONS.filter((c) => c.ppm === ppm)",
        );
    } else if (file.endsWith("picture.js")) {
      stripped = stripped
        .replace('import { detailFraction } from "./detail-policy.js";\n', "")
        .replace(
          "o.errorFraction === 0.65 && detailFraction(pic, t.shape) === 0.65 ? 0.65 : 0.6",
          "0.6",
        )
        .replace(
          "fitPictureErrors(code, pic, fraction, fraction === 0.65 ? 0.65 : 0.6)",
          "fitPictureErrors(code, pic, fraction)",
        );
    } else {
      stripped = stripped
        .replace(", maximumFraction = 0.6", "")
        .replace("Math.min(Math.min(0.65, maximumFraction), fraction)", "Math.min(0.6, fraction)");
    }
    assert.notEqual(stripped, candidate);
    const options = { ...(await resolveConfig(file)), filepath: file };
    assert.equal(await format(stripped, options), original, `Unchanged algorithm proof: ${file}`);
    sourceProof[file] = {
      parent: plan.parentRuntime,
      head,
      originalSha256: sha(original),
      candidateSha256: sha(candidate),
      outsideExplicitBudgetChangeIdenticalAfterFormatting: true,
    };
  }
}
const selected = { main: [], detail: [] },
  primary = [],
  replaced = [],
  replicates = [];
for (const mode of ["main", "detail"])
  for (const key of expected) {
    const run =
      mode === "detail" && recheck.includes(key)
        ? plan.recheckRun
        : base[mode].has(key)
          ? plan.baseComposite
          : plan.remainingRun;
    const value = run === plan.baseComposite ? base[mode].get(key) : fresh[run]?.[mode].get(key);
    if (!value) {
      assert(partial, `Missing ${run}/${mode}/${key}`);
      continue;
    }
    const time = timing[run].find((r) => r.mode === mode && r.pair === `${key}/0`);
    assert(time);
    assert.equal(time.ms, value.ms);
    assert.equal(value.text, payloads[value.link]);
    const measurementRun = run === plan.baseComposite ? value.measurementRun : run;
    selected[mode].push({ ...value, measurementRun });
    primary.push({ ...time, measurementRun });
    if (mode === "detail" && run === plan.recheckRun) replaced.push(base.detail.get(key));
    const duplicate = fresh[plan.remainingRun]?.[mode].get(key);
    if (duplicate && run !== plan.remainingRun)
      replicates.push({ mode, ...duplicate, measurementRun: plan.remainingRun });
  }
const map = new Map(selected.detail.map((r) => [r.key, r]));
const pixelControls = plan.pixelControls
  .filter((k) => map.has(k))
  .map((key) => ({
    key,
    before: base.detail.get(key).captureRGBA8Sha256,
    after: map.get(key).captureRGBA8Sha256,
    identical: base.detail.get(key).captureRGBA8Sha256 === map.get(key).captureRGBA8Sha256,
  }));
if (!partial) assert(pixelControls.length === 3 && pixelControls.every((r) => r.identical));
for (const mode of ["main", "detail"]) {
  writeRows(`${root}/browser-review-final-${mode}-low-0.jsonl`, selected[mode]);
  fs.mkdirSync(`${root}/review/review-final-${mode}`, { recursive: true });
  for (const row of selected[mode].filter((r) => r.link === 0))
    for (const suffix of ["render", "390x844"])
      fs.copyFileSync(
        `${root}/review/${row.measurementRun}-${mode}/${row.picture}-${row.shape}-0-${suffix}.png`,
        `${root}/review/review-final-${mode}/${row.picture}-${row.shape}-0-${suffix}.png`,
      );
}
writeRows(`${root}/paired-review-final.jsonl`, primary);
write(`${root}/paired-review-final-provenance.json`, {
  baseline: parent.baseline,
  head: components[plan.remainingRun]?.head || components[plan.recheckRun]?.head || null,
  series:
    "segmented corpus across source revisions, proved unchanged paths, affected-domain rechecks, and balanced remaining pairs; not one fresh balanced trial",
  complete: selected.main.length === 2000 && selected.detail.length === 2000,
  plan,
  parent,
  components,
  sourceProof,
  pixelControls,
  retentionLimit:
    "Retained captures and timings precede the final source. All correction shares except the 11 very-flat Squares are unchanged; the default helper cap remains 60%, and only that selected domain opts into 65%. Three fresh controls cover higher-contrast Square, 60% Square, and Circle. These retained timings are not fresh final-head measurements.",
  interruptions: [
    ...parent.interruptions,
    ...read(`${root}/paired-review-repaired-interruptions.json`),
  ],
  duplicateMainObservations: parent.duplicateMainObservations,
  duplicateFreshObservations: replicates,
  replacedDetailObservations: [...parent.replacedDetailObservations, ...replaced],
  counts: Object.fromEntries(
    Object.entries(selected).map(([mode, values]) => [mode, values.length]),
  ),
});
console.log(
  JSON.stringify({
    complete: selected.main.length === 2000 && selected.detail.length === 2000,
    main: selected.main.length,
    detail: selected.detail.length,
    rechecked: replaced.length,
    replicates: replicates.length,
    pixelControls,
  }),
);
