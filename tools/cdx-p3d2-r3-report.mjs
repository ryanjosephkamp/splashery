// Summarize every retained pose and every unchanged spec; missing evidence stays explicit.
import fs from "node:fs";
import path from "node:path";
import { inputs } from "./cdx-p3d2-r3-common.mjs";

const opt = (n, d) => process.argv.find((a) => a.startsWith(`--${n}=`))?.slice(n.length + 3) ?? d;
const root = opt("root", ".cache/cdx-p3d2/r3");
const read = (file, fallback = null) =>
  fs.existsSync(file) ? JSON.parse(fs.readFileSync(file)) : fallback;
const before = read(path.join(root, opt("before", "sweep-before"), "rows.json"), []);
const after = read(path.join(root, opt("after", "sweep-after"), "rows.json"), []);
const worst = (rows, key) =>
  rows
    .filter((r) => Number.isFinite(r[key]))
    .reduce((a, b) => (!a || b[key] > a[key] ? b : a), null);
const pose = (r) =>
  r ? `${r.view}, depth ${r.depth}, yaw ${r.yaw}, pitch ${r.pitch}` : "not measured";
const percent = (r) => (r ? `${(100 * r.holeFraction).toFixed(4)}%` : "not measured");
const number = (r, key) => (r ? r[key].toFixed(6) : "not measured");
const comparisons = [];
for (const entry of inputs())
  for (const screen of ["phone", "desktop"]) {
    const select = (rows) => rows.filter((r) => r.id === entry.id && r.screen === screen);
    const b = select(before),
      a = select(after);
    comparisons.push({
      id: entry.id,
      screen,
      beforeRows: b.length,
      afterRows: a.length,
      beforeHole: worst(b, "holeFraction"),
      afterHole: worst(a, "holeFraction"),
      beforeHalo: worst(b, "haloMean"),
      afterHalo: worst(a, "haloMean"),
      afterContrastLoss: worst(a, "contrastLoss"),
    });
  }
const frameMain = read(path.join(root, "frame-main-all-phone.json"))?.rows || [];
const frameAfter = read(path.join(root, "frame-after-all-phone.json"))?.rows || [];
const timing = frameAfter.map((a) => {
  const b = frameMain.find((b) => b.id === a.id);
  return {
    id: a.id,
    main: b,
    after: a,
    meanRatio: b ? a.meanMs / b.meanMs : null,
    p95Ratio: b ? a.p95Ms / b.p95Ms : null,
  };
});
const specs = fs
  .readdirSync("tests")
  .filter((f) => f.endsWith(".spec.mjs"))
  .sort();
const suite = opt("suite", path.join(root, "full-suite"));
const counts = [];
for (const file of specs) {
  const report = read(path.join(suite, file.replace(".spec.mjs", ".json")));
  const c = { file, passed: 0, failed: 0, skipped: 0, missing: !report };
  const walk = (s) => {
    for (const spec of s.specs || [])
      for (const t of spec.tests)
        for (const r of t.results) {
          if (r.status === "passed") c.passed++;
          else if (r.status === "skipped") c.skipped++;
          else c.failed++;
        }
    for (const nested of s.suites || []) walk(nested);
  };
  if (report) walk(report);
  counts.push(c);
}
const summary = {
  beforeRows: before.length,
  afterRows: after.length,
  comparisons,
  timing,
  specs: counts,
  worstHole: worst(after, "holeFraction"),
  worstHalo: worst(after, "haloMean"),
  holeViolations: after.filter((r) => r.holeFraction >= 0.002),
  errors: {
    before: read(path.join(root, opt("before", "sweep-before"), "run.json"))?.errors,
    after: read(path.join(root, opt("after", "sweep-after"), "run.json"))?.errors,
  },
};
fs.writeFileSync(path.join(root, "summary.json"), JSON.stringify(summary, null, 2));
const text = [
  "# Round 3 retained evidence",
  "",
  `Before: ${before.length} poses. After: ${after.length} poses.`,
  "",
  "The halo column is a source-color transport/filter diagnostic; it does not establish the semantic correctness of hidden background content. Contrast loss uses the transported point-sampled source and includes ordinary minification.",
  "",
  "| Input | Profile | Before worst holes | After worst holes | After hole pose | Before worst halo mean | After worst halo mean | After halo pose |",
  "| --- | --- | ---: | ---: | --- | ---: | ---: | --- |",
];
for (const r of comparisons)
  text.push(
    `| ${r.id} | ${r.screen} | ${percent(r.beforeHole)} | ${percent(r.afterHole)} | ${pose(r.afterHole)} | ${number(r.beforeHalo, "haloMean")} | ${number(r.afterHalo, "haloMean")} | ${pose(r.afterHalo)} |`,
  );
text.push(
  "",
  "## Phone completed-pose cadence",
  "",
  "Includes WebGL2 completion fences and scheduling/polling overhead on a software GPU; physical-phone smoothness is not measured.",
  "",
  "| Input | Main poses/s | Round 3 poses/s | Main p95 ms | Round 3 p95 ms |",
  "| --- | ---: | ---: | ---: | ---: |",
);
for (const r of timing)
  text.push(
    `| ${r.id} | ${r.main?.fps.toFixed(2) ?? "not measured"} | ${r.after.fps.toFixed(2)} | ${r.main?.p95Ms.toFixed(1) ?? "not measured"} | ${r.after.p95Ms.toFixed(1)} |`,
  );
text.push(
  "",
  "## Spec counts",
  "",
  "| Spec | Passed | Failed | Existing conditional skips |",
  "| --- | ---: | ---: | ---: |",
);
for (const c of counts)
  text.push(`| ${c.file} | ${c.missing ? "not run" : c.passed} | ${c.failed} | ${c.skipped} |`);
fs.writeFileSync(path.join(root, "summary.md"), text.join("\n") + "\n");
console.log(
  JSON.stringify(
    {
      beforeRows: before.length,
      afterRows: after.length,
      holeViolations: summary.holeViolations.length,
      completedSpecs: counts.filter((c) => !c.missing).length,
      failedSpecs: counts.filter((c) => c.failed).map((c) => c.file),
      missingSpecs: counts.filter((c) => c.missing).length,
      phoneTimings: timing.length,
    },
    null,
    2,
  ),
);
