// Join measurements by corpus key, retaining cold starts, failures, and slower cases.
// Separate series are explicitly identified and must not be described as balanced pairs.
import fs from "node:fs";
import { SAMPLES } from "../../src/qr-craft/samples.js";
const arg = (key, fallback) =>
  process.argv.find((s) => s.startsWith(`--${key}=`))?.slice(key.length + 3) ?? fallback;
const name = arg("name", "qualified"),
  root = ".cache/picture-qr-fidelity";
const rows = fs
  .readFileSync(`${root}/paired-${name}.jsonl`, "utf8")
  .trim()
  .split("\n")
  .filter(Boolean)
  .map(JSON.parse);
const mainRuns = arg("main-runs", "").split(",").filter(Boolean);
if (mainRuns.length) {
  if (rows.some((row) => row.mode !== "detail"))
    throw Error("Separate-series detail file contains main rows");
  for (const run of mainRuns)
    rows.push(
      ...fs
        .readFileSync(`${root}/paired-${run}.jsonl`, "utf8")
        .trim()
        .split("\n")
        .filter(Boolean)
        .map(JSON.parse)
        .filter((row) => row.mode === "main"),
    );
}
const grouped = new Map();
for (const row of rows) {
  if (!grouped.has(row.pair)) grouped.set(row.pair, {});
  if (grouped.get(row.pair)[row.mode]) throw Error(`Duplicate timing ${row.pair}/${row.mode}`);
  grouped.get(row.pair)[row.mode] = row;
}
const mean = (values) => values.reduce((a, b) => a + b, 0) / values.length;
const quantile = (values, p) => {
  const a = values.slice().sort((a, b) => a - b);
  return a[Math.min(a.length - 1, Math.floor(p * (a.length - 1)))];
};
const pairs = [...grouped]
  .filter(([, p]) => p.main && p.detail)
  .map(([key, p]) => ({
    key,
    picture: p.main.picture,
    shape: p.main.shape,
    link: p.main.link,
    main: p.main.ms,
    detail: p.detail.ms,
    difference: p.detail.ms - p.main.ms,
    ratio: p.detail.ms / p.main.ms,
    order: p.main.order,
  }));
const stats = (selected) => ({
  pairs: selected.length,
  main: mean(selected.map((p) => p.main)),
  detail: mean(selected.map((p) => p.detail)),
  difference: mean(selected.map((p) => p.difference)),
  medianMain: quantile(
    selected.map((p) => p.main),
    0.5,
  ),
  medianDetail: quantile(
    selected.map((p) => p.detail),
    0.5,
  ),
  p95Main: quantile(
    selected.map((p) => p.main),
    0.95,
  ),
  p95Detail: quantile(
    selected.map((p) => p.detail),
    0.95,
  ),
  slowerCases: selected.filter((p) => p.detail > p.main).length,
});
const pictureGroups = new Map();
for (const pair of pairs) {
  const key = `${pair.picture}/${pair.shape}`;
  if (!pictureGroups.has(key)) pictureGroups.set(key, []);
  pictureGroups.get(key).push(pair);
}
const pictures = [...pictureGroups].map(([key, selected]) => ({ key, ...stats(selected) }));
const corpusFile = arg("corpus", "");
const expected = (
  corpusFile
    ? JSON.parse(fs.readFileSync(corpusFile))
    : [...SAMPLES, ...JSON.parse(fs.readFileSync("tools/picture-qr-fidelity/corpus.json"))]
).flatMap((picture) =>
  Array.from({ length: 10 }, (_, link) =>
    ["square", "circle"].map((shape) => `${picture.id}/${link}/${shape}/0`),
  ).flat(),
);
const summary = {
  name,
  series: mainRuns.length
    ? "isolated single-mode detail joined by corpus key to unchanged frozen-main timing segments; not balanced paired trials"
    : "balanced paired",
  mainRuns,
  mainProvenance: mainRuns.map((run) =>
    JSON.parse(fs.readFileSync(`${root}/paired-${run}-provenance.json`)),
  ),
  failedAttempts: fs.existsSync(`${root}/paired-${name}-attempts.jsonl`)
    ? fs
        .readFileSync(`${root}/paired-${name}-attempts.jsonl`, "utf8")
        .trim()
        .split("\n")
        .filter(Boolean)
        .map(JSON.parse)
    : [],
  provenance: JSON.parse(fs.readFileSync(`${root}/paired-${name}-provenance.json`)),
  complete:
    pairs.length === expected.length &&
    rows.length === expected.length * 2 &&
    expected.every((key) => grouped.get(key)?.main && grouped.get(key)?.detail),
  unfinished: [...grouped].filter(([, p]) => !p.main || !p.detail).map(([key]) => key),
  inactiveRenderViolations: rows.filter((r) => r.inactiveFrames !== 0).length,
  all: stats(pairs),
  square: stats(pairs.filter((p) => p.shape === "square")),
  circle: stats(pairs.filter((p) => p.shape === "circle")),
  firstMain: rows.find((r) => r.mode === "main"),
  firstDetail: rows.find((r) => r.mode === "detail"),
  firstMainSegments: mainRuns.map((run) =>
    fs
      .readFileSync(`${root}/paired-${run}.jsonl`, "utf8")
      .trim()
      .split("\n")
      .filter(Boolean)
      .map(JSON.parse)
      .find((row) => row.mode === "main"),
  ),
  slowerPictures: pictures.filter((p) => p.difference > 0).map((p) => p.key),
  pictures,
  pairs,
};
const out = arg("out", `${root}/timing-${name}.json`);
fs.writeFileSync(out, JSON.stringify(summary, null, 2) + "\n");
console.log(
  JSON.stringify(
    {
      name,
      complete: summary.complete,
      inactiveRenderViolations: summary.inactiveRenderViolations,
      all: summary.all,
      slowerPictures: summary.slowerPictures,
    },
    null,
    2,
  ),
);
