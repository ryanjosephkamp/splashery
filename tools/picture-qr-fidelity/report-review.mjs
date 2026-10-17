// Describe the complete captured corpus without discarding slower or weaker cases.
import assert from "node:assert/strict";
import fs from "node:fs";

const root = ".cache/picture-qr-fidelity";
const directory = "tools/picture-qr-fidelity/results/review-pass";
const read = (file) => JSON.parse(fs.readFileSync(file, "utf8"));
const lines = (file) => fs.readFileSync(file, "utf8").trim().split("\n").map(JSON.parse);
const summary = read(`${directory}/summary.json`);
const timing = read(`${directory}/timing.json`);
assert(summary.complete && timing.complete, "Finish the complete corpus before reporting");
const captures = Object.fromEntries(
  ["main", "detail"].map((mode) => [
    mode,
    new Map(lines(`${root}/browser-review-final-${mode}-low-0.jsonl`).map((r) => [r.key, r])),
  ]),
);
const mean = (values) => values.reduce((sum, value) => sum + value, 0) / values.length;
const fixed = (value, digits = 4) => value.toFixed(digits);
const seconds = (value) => fixed(value / 1000, 3);
const signed = (value, digits = 4) => `${value >= 0 ? "+" : ""}${fixed(value, digits)}`;
const rows = [...captures.detail.values()];
const text = [
  "# Complete review corpus findings",
  "",
  "This is a segmented comparison against frozen main cb8a8315. Some observations precede the fitting merge; affected-path rechecks and continuations use later revisions. This is not one fresh final-head trial. Every result identifies its actual measurement run. The complete raw observations, including superseded failures and baseline replicates, remain in the evidence manifest.",
  "",
  `There are ${rows.length} codes per mode, 100 pictures, ten payloads, and two shapes. Both readers assess 24 conditions per code. Most detail has ${summary.detail.failedCodes.length} independently failing codes, ${summary.detail.failedGate.length} failed runtime gates, ${summary.detail.fallbacks.length} fallbacks, and ${summary.scanRegressions.length} codes that lose a previously passing baseline read.`,
  "",
  "| Region | Shape | Phone main SSIM | Phone detail SSIM | Gain | Print main SSIM | Print detail SSIM | Gain |",
  "| --- | --- | ---: | ---: | ---: | ---: | ---: | ---: |",
];
for (const region of ["scores", "stickerScores"])
  for (const shape of ["square", "circle"]) {
    const selected = rows.filter((r) => r.shape === shape && r[region]);
    if (!selected.length) continue;
    const scores = ["phone", "print"].flatMap((scale) => {
      const before = mean(selected.map((r) => captures.main.get(r.key)[region][scale].ssim));
      const after = mean(selected.map((r) => r[region][scale].ssim));
      return [fixed(before), fixed(after), signed(after - before)];
    });
    text.push(
      `| ${region === "scores" ? "Encoded square" : "Complete sticker (secondary)"} | ${shape} | ${scores.join(" | ")} |`,
    );
  }
text.push(
  "",
  "| Scale | Mean SSIM gain | Smallest picture/shape mean gain | Means gaining less than 0.01 | Nonimproving means | Individual codes without a gain |",
  "| --- | ---: | ---: | ---: | ---: | ---: |",
  ...["phone", "print"].map((scale) => {
    const data = summary.fidelity[scale];
    const minimum = Math.min(...summary.pictures.map((p) => p.scores[scale].gain));
    return `| ${scale} | ${signed(data.meanGain)} | ${signed(minimum)} | ${data.picturesBelowOnePointGain.length}/200 | ${data.nonImprovingPictures.length}/200 | ${data.nonImprovingCodes.length}/2000 |`;
  }),
  "",
  "The [200 picture/shape means and 24 reader conditions](tables.md) retain each before/after value. The [per-code CSV](per-code.csv) retains every individual SSIM loss, RGB error, and reader count. SSIM and RGB error describe different properties; neither substitutes for decoding.",
  "",
  "| Shape | Scale | Mean main RGB RMSE | Mean detail RGB RMSE | Codes with worse RGB RMSE |",
  "| --- | --- | ---: | ---: | ---: |",
);
for (const shape of ["square", "circle"])
  for (const scale of ["phone", "print"]) {
    const selected = rows.filter((r) => r.shape === shape);
    text.push(
      `| ${shape} | ${scale} | ${fixed(mean(selected.map((r) => captures.main.get(r.key).scores[scale].rmse)))} | ${fixed(mean(selected.map((r) => r.scores[scale].rmse)))} | ${selected.filter((r) => r.scores[scale].rmse > captures.main.get(r.key).scores[scale].rmse).length}/${selected.length} |`,
    );
  }
text.push(
  "",
  "| Shape | Mean main (s) | Mean detail (s) | P95 main (s) | P95 detail (s) | Slower codes | Main over 5 s | Detail over 5 s |",
  "| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: |",
  ...["all", "square", "circle"].map((shape) => {
    const t = timing[shape];
    return `| ${shape} | ${seconds(t.main)} | ${seconds(t.detail)} | ${seconds(t.p95Main)} | ${seconds(t.p95Detail)} | ${t.slowerCases}/${t.pairs} | ${t.over5sMain} | ${t.over5sDetail} |`;
  }),
  "",
  `Of the ${timing.all.slowerCases} slower observations, ${timing.pairs.filter((p) => p.difference > 100).length} exceed 100 ms, ${timing.pairs.filter((p) => p.difference > 500).length} exceed 500 ms, and ${timing.pairs.filter((p) => p.difference > 1000).length} exceed one second. These are nested counts; every positive difference remains in the strict slower-case total.`,
  "",
  "The [timing CSV](timing.csv) contains all 2,000 paired keys, their source runs, and recorded preparation and reader-matrix costs. Those costs overlap and describe the last accepted preparation; its candidate counter is not a total retry count. Any positive appearance-time difference counts as a slower observation; a single observation does not establish statistical significance. Cold starts are included. CPU profiling is disabled during this final timing series.",
  "",
  "## The Operator's four slower pilot cases",
  "",
  "These were the four slower observations in the 36-code correction-first pilot. The final corpus measurements below remain primary even when the result is slower. The diagnostic costs are overlapping subsets of total appearance time, not an additive accounting of all work.",
  "",
  "| Key | Pilot main → detail (s) | Final main → detail (s) | Final difference (s) |",
  "| --- | ---: | ---: | ---: |",
);
const explanations = {
  "ai-farm/0/square":
    "This was the pilot's first detail selection, including lazy kernel and reader loading. Its initial candidate passed: preparation took 667 ms and the final captured reader matrix took 295 ms. The 13 ms total excess is retained; that single sample does not isolate the cold-load contribution.",
  "cdx-qr-ai-rainbow/9/circle":
    "The version-13 Circle passed its first candidate. Preparation took 840 ms and the final two-reader matrix took 713 ms. Standard does not run that added matrix. Its pilot excess was 323 ms; the later full-corpus observation is reported independently.",
  "cdx-qr-ai-lotus/1/square":
    "The initial edge-0.24 candidate was rejected on the actual capture. The accepted edge-0.32 repair then ran the full predicted matrix (198 ms) and actual matrix (235 ms). Earlier opposite-orientation repair now avoids that actual rejection on the retained full-corpus capture; its accepted rotation is 180 degrees.",
  "met-459968/8/circle":
    "The initial edge-0.24 candidate was rejected on the actual capture. The accepted version-12 edge-0.32 repair used 1,167 ms of preparation, including a 717 ms predicted matrix, and a further 687 ms actual matrix. This records two accepted-repair reader passes plus the earlier failed capture; it does not infer retry counts from stale rejection lists.",
};
const pilot = lines(`${root}/paired-review-correction-first.jsonl`);
const details = [];
for (const [key, explanation] of Object.entries(explanations)) {
  const old = Object.fromEntries(
    pilot.filter((r) => r.pair === `${key}/0`).map((r) => [r.mode, r]),
  );
  const pair = timing.pairs.find((r) => r.key === `${key}/0`);
  assert(old.main && old.detail && pair);
  text.push(
    `| ${key} | ${seconds(old.main.ms)} → ${seconds(old.detail.ms)} | ${seconds(pair.main)} → ${seconds(pair.detail)} | ${signed(pair.difference / 1000, 3)} |`,
  );
  details.push({
    key,
    explanation,
    pilot: old,
    final: pair,
    finalCapture: captures.detail.get(key),
  });
}
text.push("", ...details.flatMap((d) => [`**${d.key}:** ${d.explanation}`, ""]));
text.push(
  `In the final comparison, ${details.filter((d) => d.final.difference > 0).length} of these four cases remain slower than Standard. These primary observations are retained independently of the earlier pilot and include their recorded cold starts.`,
  "",
  "The final corpus observations have their own recorded costs below. Preparation includes any predicted matrix it ran; these values overlap and must not be added as a complete accounting. A dash means that diagnostic was not recorded. The candidate counter belongs to the last preparation, not the complete retry history.",
  "",
  "| Key | Final last preparation (ms) | Candidates in that preparation | Final accepted predicted matrix (ms) | Final captured matrix (ms) |",
  "| --- | ---: | ---: | ---: | ---: |",
  ...details.map(({ key, final: p }) => {
    const cost = (value) => (value == null ? "—" : fixed(value, 1));
    return `| ${key} | ${cost(p.lastPreparationMs)} | ${p.lastPreparationCandidates ?? "—"} | ${cost(p.acceptedModelMatrixMs)} | ${cost(p.acceptedCaptureMatrixMs)} |`;
  }),
  "",
);
text.push(
  "These observations explain measured costs; they do not prove that strict speed parity is impossible. Reusing a failed capture, omitting the second reader or stronger-blur views, or revealing the code before checks finish would reduce work but would violate the scan gate. Those changes were not made. The remaining slower cases therefore keep goal item 4 open, and Standard remains the default.",
  "",
);
fs.writeFileSync(`${directory}/findings.md`, text.join("\n"));
fs.writeFileSync(`${directory}/operator-four-cases.json`, JSON.stringify(details, null, 2) + "\n");
console.log(
  JSON.stringify({ report: `${directory}/findings.md`, slowerCases: timing.all.slowerCases }),
);
