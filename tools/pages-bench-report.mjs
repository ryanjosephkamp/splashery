#!/usr/bin/env node
// node tools/pages-bench-report.mjs <main/results.json> <candidate/results.json> [out.md]
import fs from "node:fs";

const [mainFile, candidateFile, out] = process.argv.slice(2);
if (!mainFile || !candidateFile) throw new Error("Provide main and candidate results.json files.");
const main = JSON.parse(fs.readFileSync(mainFile, "utf8")),
  candidate = JSON.parse(fs.readFileSync(candidateFile, "utf8"));
for (const field of [
  "browser",
  "renderer",
  "isolation",
  "memoryPoint",
  "inputPreparation",
  "motionWindowSeconds",
])
  if (main[field] !== candidate[field]) throw new Error(`Benchmark ${field} differs.`);
const protocolField =
  main.protocolSha256 && candidate.protocolSha256 ? "protocolSha256" : "toolSha256";
if (main[protocolField] !== candidate[protocolField])
  throw new Error("Benchmark measurement implementations differ.");
if (JSON.stringify(main.profiles) !== JSON.stringify(candidate.profiles))
  throw new Error("Benchmark profiles differ.");
if (
  main.fixtures &&
  candidate.fixtures &&
  JSON.stringify(main.fixtures) !== JSON.stringify(candidate.fixtures)
)
  throw new Error("Source fixtures differ.");
const median = (a) => {
  const b = a.filter(Number.isFinite).sort((a, b) => a - b),
    m = b.length >> 1;
  return b.length ? (b.length % 2 ? b[m] : (b[m - 1] + b[m]) / 2) : null;
};
const summarize = (rows) => ({
  runs: rows.length,
  firstPageMs: median(rows.map((r) => r.firstPageMs)),
  fps: median(rows.map((r) => r.motion.fps)),
  memoryBytes: median(rows.map((r) => r.processMemory?.pssBytes ?? r.jsHeap + r.gpuBytes)),
  memoryMethod: rows.every((r) => r.processMemory?.pssBytes)
    ? "PSS"
    : "JS estimate + renderer resources",
  sheetBytes: median(rows.map((r) => r.sheetBytes)),
  ssim: median(rows.map((r) => r.quality?.ssim)),
  edgePreservation: median(
    rows.map((r) =>
      r.quality?.sourceSharpness > 0 ? r.quality.sharpness / r.quality.sourceSharpness : null,
    ),
  ),
  sharpness: median(rows.map((r) => r.quality?.sharpness)),
  width: median(rows.map((r) => r.registration?.W)),
  height: median(rows.map((r) => r.registration?.H)),
  errors: rows.flatMap((r) => r.errors),
});
const key = (r) => [r.profile, r.toy, r.input].join("/");
const groups = (rows) => {
  const m = new Map();
  for (const r of rows) {
    const k = key(r);
    if (!m.has(k)) m.set(k, []);
    m.get(k).push(r);
  }
  return m;
};
const a = groups(main.records),
  b = groups(candidate.records),
  rows = [];
for (const [k, v] of a) {
  if (!b.has(k)) throw new Error(`Candidate has no ${k}.`);
  const x = summarize(v),
    y = summarize(b.get(k));
  if (x.memoryMethod !== y.memoryMethod) {
    x.memoryBytes = median(v.map((r) => r.jsHeap + r.gpuBytes));
    y.memoryBytes = median(b.get(k).map((r) => r.jsHeap + r.gpuBytes));
    x.memoryMethod = y.memoryMethod = "JS estimate + renderer resources";
  }
  const registered =
    (!x.width && !y.width) ||
    (x.width &&
      y.width &&
      Math.abs(y.width / x.width - 1) < 0.02 &&
      Math.abs(y.height / x.height - 1) < 0.02);
  const [profile, toy, input] = k.split("/");
  const edgeGain = x.edgePreservation > 0 ? y.edgePreservation / x.edgePreservation - 1 : null,
    rawEdgeGain = x.sharpness > 0 ? y.sharpness / x.sharpness - 1 : null,
    ssimGain = y.ssim !== null && x.ssim !== null ? y.ssim - x.ssim : null;
  const checks = {
    firstPage: y.firstPageMs <= x.firstPageMs,
    memory: y.memoryBytes <= x.memoryBytes,
    frameRate: y.fps >= x.fps,
    registered,
    errors: y.errors.length === 0,
  };
  if (input === "text" && profile === "phone")
    checks.text = edgeGain >= 0.3 && rawEdgeGain >= 0.3 && ssimGain >= 0.03;
  rows.push({
    profile,
    toy,
    input,
    main: x,
    candidate: y,
    edgeGain,
    rawEdgeGain,
    ssimGain,
    checks,
    pass: Object.values(checks).every(Boolean),
  });
}
const num = (x, n = 2) => (x === null ? "—" : x.toFixed(n)),
  mb = (x) => (x / 1e6).toFixed(1),
  seconds = (x) => (x / 1000).toFixed(2);
const lines = [
  "| Profile | Toy / input | First page, s (main → round 2) | Frames/s | Memory, MB | Edge preservation gain | SSIM gain | Checks |",
  "| --- | --- | ---: | ---: | ---: | ---: | ---: | --- |",
];
for (const r of rows) {
  const x = r.main,
    y = r.candidate;
  lines.push(
    `| ${r.profile} | ${r.toy} / ${r.input} | ${seconds(x.firstPageMs)} → ${seconds(y.firstPageMs)} | ${num(x.fps)} → ${num(y.fps)} | ${mb(x.memoryBytes)} → ${mb(y.memoryBytes)} | ${r.edgeGain === null ? "—" : `${num(r.edgeGain * 100, 1)}%`} | ${num(r.ssimGain, 3)} | ${
      r.pass
        ? "pass"
        : Object.entries(r.checks)
            .filter(([, v]) => !v)
            .map(([k]) => k)
            .join(", ")
    } |`,
  );
}
const result = {
  main: mainFile,
  candidate: candidateFile,
  allMeasuredTargetsPass: rows.every((r) => r.pass),
  rows,
};
const md =
  lines.join("\n") +
  "\n\nMemory uses proportional resident size when both runs include it; otherwise it uses the same JavaScript estimate plus renderer resource counters. Values are medians. Edge preservation is rendered Laplacian variance divided by the source's variance at the displayed size. Phone text inputs require at least 30% more edge preservation, at least 30% more raw Laplacian variance, and 0.03 more SSIM. Registration must match within 2% in both dimensions. Motion inspection and the regression suite are separate requirements.\n";
if (out) {
  fs.writeFileSync(out, md);
  fs.writeFileSync(out.replace(/\.md$/, ".json"), JSON.stringify(result, null, 2) + "\n");
} else console.log(md);
console.log(`${rows.filter((r) => r.pass).length}/${rows.length} measured cases pass.`);
if (!result.allMeasuredTargetsPass) process.exitCode = 1;
