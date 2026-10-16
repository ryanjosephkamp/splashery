// Preserve the complete segmented series and unsuccessful repair diagnostics.
// Run after captures stop, so archives describe immutable input files.
import fs from "node:fs";
import path from "node:path";
import { createHash } from "node:crypto";
import { gzipSync } from "node:zlib";
import { execFileSync } from "node:child_process";
import assert from "node:assert/strict";

const root = ".cache/picture-qr-fidelity";
const directory = "tools/picture-qr-fidelity/results/review-pass/repair-evidence";
const files = fs
  .readdirSync(root)
  .filter((name) =>
    /^(browser|paired)-(review-(full|edge-recheck|remaining|final|winterfir-six|low-contrast|frozen|repair-recheck|repaired|pre-third|third-recheck|third-remaining|moon-tone|moon-more|moon-65)|theme-[a-z-]+)(-.*)?\.(jsonl|json)$/.test(
      name,
    ),
  )
  .map((name) => path.join(root, name));
const local = path.join(root, "review-pass");
assert.equal(
  JSON.parse(fs.readFileSync(path.join(local, "third-pipeline-status.json"), "utf8")).state,
  "finished",
  "Wait for the final capture pipeline before bundling its evidence",
);
for (const name of fs.readdirSync(local))
  if (
    /^theme-.*probe\.(mjs|json)$/.test(name) ||
    /^moon-.*\.(mjs|js|json|log)$/.test(name) ||
    /^(third-checks|third-smoke-recheck|third-policy-constructor|third-guard-recheck|qualification-equivalence|review-third-recheck|review-third-remaining)\.log$/.test(
      name,
    ) ||
    /^(finder-edge.*|sun-regression.*|theme-.*|edge-recheck|remaining|full|winterfir-six|near-limit-.*|plain-.*|detail-policy-red|detail-repair-green|merged-focused|repair-focused|review-repair-recheck|review-repaired|final-checks|final-smoke-phone|final-runtime-qr|final-budget-style)\.log$/.test(
      name,
    ) ||
    [
      "quarter-experiment.patch",
      "adaptive-plan.proposal.json",
      "merged-pixel-controls.json",
      "final-required-files.json",
      "final-check-status.json",
      "resume-after-checks-status.json",
      "third-check-status.json",
      "third-pipeline-status.json",
      "third-pixel-controls.json",
    ].includes(name)
  )
    files.push(path.join(local, name));
const reports = {};
const diagnosticDirectory = path.join(root, "review-export", "diagnostics", "review-pass");
fs.mkdirSync(diagnosticDirectory, { recursive: true });
const equivalence = JSON.parse(
  fs.readFileSync("tools/picture-qr-fidelity/results/review-pass/qualification-equivalence.json"),
);
const equivalenceDirectory = path.join(diagnosticDirectory, "qualification-equivalence");
fs.mkdirSync(equivalenceDirectory, { recursive: true });
const equivalenceInputs = equivalence.cases.map((item) => {
  const bytes = fs.readFileSync(item.file),
    file = `${item.mode}-${path.basename(item.file)}`;
  assert.equal(createHash("sha256").update(bytes).digest("hex"), item.pngSha256);
  fs.writeFileSync(path.join(equivalenceDirectory, file), bytes);
  return { ...item, originalPath: item.file, file };
});
fs.writeFileSync(
  path.join(equivalenceDirectory, "inputs.json"),
  JSON.stringify(equivalenceInputs, null, 2) + "\n",
);
fs.writeFileSync(
  path.join(equivalenceDirectory, "README.md"),
  [
    "# Serial and parallel assessment inputs",
    "",
    "These are the 12 original stage PNGs used by the recorded equivalence check. Each PNG is copied without alteration and checked against its recorded SHA-256. The record compares every score, raw capture hash, and all 576 reader outcomes.",
    "",
    "[Verification record](../../../../results/review-pass/qualification-equivalence.json) · [Input paths and hashes](inputs.json) · [All diagnostics](../README.md)",
    "",
    "To repeat the check from the repository root, restore each PNG to its originalPath in inputs.json. Restore the two browser-review-pre-third JSONL files from the compressed repair-evidence manifest, and copy the gallery's source PNGs into .cache/picture-qr-fidelity/review/sources/. Then run tools/picture-qr-fidelity/verify-qualification.mjs under Node 22. The verification record identifies the exact assessment-source hashes. The script rewrites that record only after every comparison passes.",
    "",
    "Source picture credits remain in CREDITS. Captures made by Ryan with Codex (GPT-6).",
    "",
  ].join("\n"),
);
const diagnosticImages = [];
function preserveLongLinkImages(suite) {
  for (const spec of suite.specs || []) {
    if (!spec.title.includes("near-limit")) continue;
    for (const test of spec.tests)
      for (const result of test.results)
        for (const attachment of result.attachments || [])
          if (attachment.name === "near-limit-code" && attachment.body) {
            const shape = spec.title.includes("square") ? "square" : "circle";
            const name = `299-character-${shape}.png`;
            fs.writeFileSync(
              path.join(diagnosticDirectory, name),
              Buffer.from(attachment.body, "base64"),
            );
            diagnosticImages.push({ shape, file: name, testStatus: test.status });
          }
  }
  for (const child of suite.suites || []) preserveLongLinkImages(child);
}
for (const suite of [
  "final-qr-suite",
  "final-budget-suite",
  "final-smoke-phone-suite",
  "final-runtime-qr-suite",
  "final-budget-style-suite",
  "third-focused-suite",
  "third-budget-suite",
  "third-qr-suite",
  "third-smoke-recheck-suite",
  "third-policy-constructor-suite",
  "third-guard-recheck-suite",
]) {
  const source = path.join(local, suite);
  if (!fs.existsSync(source)) continue;
  reports[suite] = {};
  for (const name of fs.readdirSync(source))
    if (/\.(json|log)$/.test(name)) {
      const file = path.join(source, name);
      files.push(file);
      if (name.endsWith(".json")) {
        const report = JSON.parse(fs.readFileSync(file, "utf8"));
        reports[suite][name.slice(0, -5)] = report.stats;
        if (suite === "third-budget-suite") preserveLongLinkImages(report);
      }
    }
}
assert.equal(diagnosticImages.length, 2, "Preserve both near-limit PNG attachments");
assert(diagnosticImages.every((image) => image.testStatus === "expected"));
const winter = {};
for (const mode of ["main", "detail"]) {
  const row = fs
    .readFileSync(path.join(root, `browser-review-final-${mode}-low-0.jsonl`), "utf8")
    .trim()
    .split("\n")
    .map(JSON.parse)
    .find((item) => item.key === "cdx-theme-seasons-11-2/9/square");
  assert(row);
  const name = `winter-fir-payload9-${mode}.png`;
  fs.copyFileSync(
    path.join(
      root,
      "review",
      `${row.measurementRun}-${mode}`,
      `${row.picture}-${row.shape}-${row.link}-render.png`,
    ),
    path.join(diagnosticDirectory, name),
  );
  winter[mode] = { file: name, row };
}
fs.writeFileSync(
  path.join(diagnosticDirectory, "README.md"),
  [
    "# October 15–16 review diagnostics",
    "",
    "[All review diagnostics](../README.md)",
    "",
    "[Original serial/parallel verification PNGs](qualification-equivalence/README.md)",
    "",
    "These actual 720-pixel PNG exports use a 299-character synthetic link, one character below the input limit. Most detail selects its checked black-and-white Standard fallback within the 20-second decision bound. Both codes decode with jsQR and zxing-cpp at 8 and 4 pixels per module, with blur of 0, 0.2, and 0.3 modules: 24 reader attempts across the two codes. These long-link tests use a front view; the separate fixed ten-payload corpus supplies the perspective and brightness matrix.",
    "",
    "The source picture is the existing labeled AI-made farm sample. Its source credit remains in CREDITS. Renders made by Ryan with Codex (GPT-6).",
    "",
    ...diagnosticImages.flatMap((item) => [
      `## ${item.shape}`,
      "",
      `![299-character ${item.shape} fallback](${item.file})`,
      "",
    ]),
    "## Winter fir: the metric's blank-area limitation",
    "",
    "These are the actual 720-pixel captures of Winter fir (soft), Square, payload 9. Main leaves most of the frame blank, which earns a high SSIM on this low-contrast source despite failing the readers. The metric remains fixed. Most detail draws a complete code and has lower RGB error; the individual SSIM loss is retained even though the ten-payload picture mean improves.",
    "",
    "| Main | Most detail |",
    "| --- | --- |",
    `| ![Main capture](${winter.main.file}) | ![Most detail capture](${winter.detail.file}) |`,
    "",
    "| Mode | Phone SSIM | Print SSIM | Phone RGB RMSE | Print RGB RMSE | Independent reads |",
    "| --- | ---: | ---: | ---: | ---: | ---: |",
    ...["main", "detail"].map((mode) => {
      const row = winter[mode].row;
      const passes = row.scans.reduce((sum, s) => sum + Number(s.jsqr) + Number(s.zxingcpp), 0);
      return `| ${mode} | ${row.scores.phone.ssim.toFixed(4)} | ${row.scores.print.ssim.toFixed(4)} | ${row.scores.phone.rmse.toFixed(4)} | ${row.scores.print.rmse.toFixed(4)} | ${passes}/48 |`;
    }),
    "",
  ].join("\n"),
);
const diagnosticsIndex = path.join(diagnosticDirectory, "..", "README.md");
if (fs.existsSync(diagnosticsIndex)) {
  const link = "[Near-limit fallback PNGs and Winter fir comparison](review-pass/README.md)";
  if (!fs.readFileSync(diagnosticsIndex, "utf8").includes(link))
    fs.appendFileSync(diagnosticsIndex, `\n## October 15–16 review pass\n\n${link}.\n`);
}
fs.mkdirSync(directory, { recursive: true });
const seen = new Set();
const manifest = [];
for (const source of files.sort()) {
  const archive = `${path.relative(root, source).replaceAll(path.sep, "__")}.gz`;
  if (seen.has(archive)) throw Error(`Duplicate archive ${archive}`);
  seen.add(archive);
  const bytes = fs.readFileSync(source);
  fs.writeFileSync(path.join(directory, archive), gzipSync(bytes));
  manifest.push({
    source,
    archive,
    uncompressedSha256: createHash("sha256").update(bytes).digest("hex"),
    bytes: bytes.length,
  });
}
fs.writeFileSync(
  path.join(directory, "manifest.json"),
  JSON.stringify(
    {
      note: "The comparison is segmented. Original failed observations, interruptions, and replicates remain. Pilots and constructor probes are diagnostics, not final qualification. Moon pilots used actual local browser module overrides: their separate proposal, loader, and source files describe those overrides; ordinary paired provenance identifies the underlying production tree. The first requested 65% Moon pilot remained clamped to 60% in the fitter and is an identical-pixel control, not a 65% trial. The corrected 65% pilot changed actual correction limits. The guard-four runtime trial was clamped to guard three. The old-source Sun red test was interrupted after two failures; only complete green runs and selected captured rows are acceptance evidence.",
      files: manifest,
    },
    null,
    2,
  ) + "\n",
);
fs.writeFileSync(
  "tools/picture-qr-fidelity/results/review-pass/final-checks.json",
  JSON.stringify(
    {
      node: process.version,
      headWhenBundled: execFileSync("git", ["rev-parse", "HEAD"], { encoding: "utf8" }).trim(),
      runtimeRevision: "ed3ff719",
      broadSuiteInitialRuntimeRevision: "c696317e",
      focusedGuardAndPolicyRevision: "ed3ff719",
      note: "The third suite repeats every required QR file after the very-flat Square change: 302 of 305 cases passed initially, with three failures and no skips. The oversized-request guard failed on c696317e, was restored on ed3ff719 without changing its test, and the complete guard/policy files passed all 13 cases in the focused rerun. The two general smoke gestures passed their exact isolated rerun without test or UI changes. Its 11 wall-clock budget tests run alone on SwiftShader; the broad suite uses four files at once on llvmpipe. These cover 316 distinct cases with the initial failures and recoveries retained, not one clean 316-case run. Earlier suites and the initial smoke phone-sheet failure and isolated recovery remain historical evidence. The earlier qr file started before the Color-return fix and was repeated afterward. Reports retain every attempt; reruns do not add distinct cases.",
      requiredFiles: JSON.parse(fs.readFileSync(path.join(local, "final-required-files.json"))),
      driver: JSON.parse(fs.readFileSync(path.join(local, "third-check-status.json"))),
      previousDriver: JSON.parse(fs.readFileSync(path.join(local, "final-check-status.json"))),
      reports,
      evidenceManifest: "repair-evidence/manifest.json",
    },
    null,
    2,
  ) + "\n",
);
console.log(
  JSON.stringify({
    directory,
    files: manifest.length,
    uncompressedBytes: manifest.reduce((sum, file) => sum + file.bytes, 0),
  }),
);
