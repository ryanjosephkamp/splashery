// Summarize every retained pose and every unchanged spec; missing evidence stays explicit.
import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import { inputs } from "./cdx-p3d2-r3-common.mjs";

const opt = (n, d) => process.argv.find((a) => a.startsWith(`--${n}=`))?.slice(n.length + 3) ?? d;
const root = opt("root", ".cache/cdx-p3d2/r3");
const read = (file, fallback = null) =>
  fs.existsSync(file) ? JSON.parse(fs.readFileSync(file)) : fallback;
const builds = read(path.join(root, "builds.json"));
const sameBuild = (a, b) =>
  !!(
    a &&
    b &&
    a.commit === b.commit &&
    JSON.stringify(Object.entries(a.files || {}).sort()) ===
      JSON.stringify(Object.entries(b.files || {}).sort())
  );
const staleEvidence = [];
const sweep = (name, build) => {
  const dir = path.join(root, name),
    rows = read(path.join(dir, "rows.json"), []);
  if (rows.length && !sameBuild(read(path.join(dir, "settings.json"))?.build, build)) {
    staleEvidence.push(name);
    return [];
  }
  return rows;
};
const before = sweep(opt("before", "sweep-before"), builds?.before);
const after = sweep(opt("after", "sweep-after"), builds?.after);
const planned = read(path.join(root, opt("after", "sweep-after"), "settings.json"), {
  names: ["phone", "desktop"],
  depths: [1],
  views: ["sharp", "splats"],
  poses: [[0, 0], [-20, 0], [20, 0], [0, -20], [0, 20], [-30, 0], [30, 0], [0, -30], [0, 30]], // prettier-ignore
});
const expectedGroupRows = planned.depths.length * planned.views.length * planned.poses.length;
const extraAfterName = opt("after-extra", "sweep-after-desktop");
const extraAfterSettings = read(path.join(root, extraAfterName, "settings.json"));
if (extraAfterSettings) {
  const compatible =
    JSON.stringify(extraAfterSettings.names) === JSON.stringify(["desktop"]) &&
    ["depths", "views", "poses", "samples", "methodHash", "inputHashes", "capturePolicy"].every(
      (key) => JSON.stringify(extraAfterSettings[key]) === JSON.stringify(planned[key]),
    );
  if (!compatible) throw new Error("The separate desktop target phase uses incompatible settings.");
  const extra = sweep(extraAfterName, builds?.after);
  const keys = new Set(
    after.map((r) => `${r.screen}/${r.id}/${r.depth}/${r.view}/${r.yaw}/${r.pitch}`),
  );
  for (const row of extra) {
    const key = `${row.screen}/${row.id}/${row.depth}/${row.view}/${row.yaw}/${row.pitch}`;
    if (keys.has(key)) throw new Error(`Duplicate target pose across capture phases: ${key}`);
    keys.add(key);
    after.push(row);
  }
}
const beforePlanned = read(path.join(root, opt("before", "sweep-before"), "settings.json"), {
  ...planned,
  views: ["sharp"],
});
const expectedBeforeGroupRows =
  beforePlanned.depths.length * beforePlanned.views.length * beforePlanned.poses.length;
const expectedKeys = new Set(
  planned.depths.flatMap((d) =>
    planned.views.flatMap((v) => planned.poses.map(([y, p]) => `${d}/${v}/${y}/${p}`)),
  ),
);
const beforeKeys = new Set(
  beforePlanned.depths.flatMap((d) =>
    beforePlanned.views.flatMap((v) => beforePlanned.poses.map(([y, p]) => `${d}/${v}/${y}/${p}`)),
  ),
);
const complete = (rows, expected = expectedGroupRows, plannedKeys = expectedKeys) => {
  const keys = rows.map((r) => `${r.depth}/${r.view}/${r.yaw}/${r.pitch}`);
  return (
    rows.length === expected &&
    new Set(keys).size === expected &&
    keys.every((k) => plannedKeys.has(k)) &&
    rows.every(
      (r) =>
        Number.isFinite(r.area) &&
        r.area > 0 &&
        Number.isFinite(r.holes) &&
        r.holes >= 0 &&
        r.holes <= r.area &&
        Number.isFinite(r.holeFraction) &&
        Math.abs(r.holeFraction - r.holes / r.area) < 1e-12,
    )
  );
};
const worst = (rows, key) =>
  rows
    .filter((r) => Number.isFinite(r[key]))
    .reduce((a, b) => (!a || b[key] > a[key] ? b : a), null);
const pose = (r) =>
  r ? `${r.view}, depth ${r.depth}, yaw ${r.yaw}, pitch ${r.pitch}` : "not measured";
const percent = (r) => (r ? `${(100 * r.holeFraction).toFixed(4)}%` : "not measured");
const number = (r, key) => (r ? r[key].toFixed(6) : "not measured");
const comparisons = [];
const captureFailure = read(path.join(root, "capture-failure-proof.json"));
const invalidatedDesktop = new Set(captureFailure?.invalidatedSamples || []);
const completeTarget = (rows) =>
  complete(rows) &&
  rows.every(
    (r) => r.screen !== "desktop" || !invalidatedDesktop.has(r.id) || r.captureValidated === true,
  );
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
      beforeComplete: complete(b, expectedBeforeGroupRows, beforeKeys),
      afterComplete: completeTarget(a),
      complete: complete(b, expectedBeforeGroupRows, beforeKeys) && completeTarget(a),
      beforeHole: worst(b, "holeFraction"),
      afterHole: worst(a, "holeFraction"),
      beforeHalo: worst(b, "haloMean"),
      afterHalo: worst(a, "haloMean"),
      afterContrastLoss: worst(a, "contrastLoss"),
    });
  }
const mainTiming = read(path.join(root, "frame-main-all-phone.json"));
const afterTiming = read(path.join(root, "frame-after-all-phone.json"));
const frameMain = sameBuild(mainTiming?.build, builds?.main) ? mainTiming.rows : [];
const frameAfter = sameBuild(afterTiming?.build, builds?.after) ? afterTiming.rows : [];
if (mainTiming && !frameMain.length) staleEvidence.push("frame-main-all-phone.json");
if (afterTiming && !frameAfter.length) staleEvidence.push("frame-after-all-phone.json");
const timing = inputs().map((entry) => {
  const aa = frameAfter.filter((r) => r.id === entry.id && r.name === "phone");
  const bb = frameMain.filter((r) => r.id === entry.id && r.name === "phone");
  const a = aa.length === 1 ? aa[0] : null,
    b = bb.length === 1 ? bb[0] : null;
  const validFrame = (r) =>
    !!(
      r &&
      r.profile === "low" &&
      r.dpr === 3 &&
      r.ratio === 1.5 &&
      JSON.stringify(r.buffer) === "[585,1266]" &&
      r.frames === 120 &&
      r.times?.length === 120 &&
      r.times.every((t) => Number.isFinite(t) && t > 0) &&
      Number.isFinite(r.meanMs) &&
      r.meanMs > 0 &&
      Number.isFinite(r.p95Ms) &&
      r.p95Ms > 0
    );
  const valid =
    validFrame(a) && validFrame(b) && a.gpu === b.gpu && mainTiming.method === afterTiming.method;
  return {
    id: entry.id,
    main: b,
    after: a,
    valid,
    mainRows: bb.length,
    afterRows: aa.length,
    meanRatio: valid ? a.meanMs / b.meanMs : null,
    p95Ratio: valid ? a.p95Ms / b.p95Ms : null,
  };
});
const validTimings = timing.filter((r) => r.valid);
const geometricMean = (values) =>
  values.length
    ? Math.exp(values.reduce((sum, value) => sum + Math.log(value), 0) / values.length)
    : null;
const cadence = {
  measuredInputs: validTimings.length,
  expectedInputs: inputs().length,
  meanTimeRatio: geometricMean(validTimings.map((r) => r.meanRatio)),
  p95TimeRatio: geometricMean(validTimings.map((r) => r.p95Ratio)),
  slowerByMoreThanFivePercent: validTimings.filter((r) => r.meanRatio > 1.05).map((r) => r.id),
  limitation:
    "Sharp software-GPU completed-pose cadence; Fine Splats and physical-phone smoothness are not measured.",
};
const timingRetakes = [];
for (const round of [1, 2]) {
  const mainName = `frame-retake-${round}-main.json`,
    afterName = `frame-retake-${round}-after.json`;
  const main = read(path.join(root, mainName)),
    target = read(path.join(root, afterName));
  const validBuilds =
    sameBuild(main?.build, builds?.main) && sameBuild(target?.build, builds?.after);
  if (main && !sameBuild(main.build, builds?.main)) staleEvidence.push(mainName);
  if (target && !sameBuild(target.build, builds?.after)) staleEvidence.push(afterName);
  for (const id of [
    "dot-train",
    "dot-arch",
    "dot-fallen-log",
    "dot-dragonfly",
    "dot-gears",
    "mushroom",
  ]) {
    const m = main?.rows?.filter((r) => r.id === id && r.name === "phone") || [],
      a = target?.rows?.filter((r) => r.id === id && r.name === "phone") || [];
    const validRow = (r) =>
      r?.frames === 120 &&
      r.times?.length === 120 &&
      r.times.every((t) => Number.isFinite(t) && t > 0) &&
      r.profile === "low" &&
      r.dpr === 3 &&
      r.ratio === 1.5 &&
      JSON.stringify(r.buffer) === "[585,1266]" &&
      Number.isFinite(r.meanMs) &&
      r.meanMs > 0 &&
      Number.isFinite(r.p95Ms) &&
      r.p95Ms > 0;
    const valid =
      validBuilds &&
      m.length === 1 &&
      a.length === 1 &&
      validRow(m[0]) &&
      validRow(a[0]) &&
      m[0].gpu === a[0].gpu &&
      !!main.method &&
      main.method === target.method &&
      main.method === mainTiming?.method;
    timingRetakes.push({
      round,
      id,
      order: round === 1 ? "main then after" : "after then main",
      valid,
      main: valid ? m[0] : null,
      after: valid ? a[0] : null,
      meanRatio: valid ? a[0].meanMs / m[0].meanMs : null,
      p95Ratio: valid ? a[0].p95Ms / m[0].p95Ms : null,
    });
  }
}
const specs = fs
  .readdirSync("tests")
  .filter((f) => f.endsWith(".spec.mjs"))
  .sort();
const suite = opt("suite", path.join(root, "full-suite"));
const rechecks = opt("rechecks", path.join(root, "full-suite-rechecks"));
const recheckMetadata = read(path.join(rechecks, "run-metadata.json"));
const suiteMetadata = read(path.join(suite, "run-metadata.json"));
const supplementalMetadata = read(path.join(suite, "supplemental-metadata.json"));
const expectedBuild = builds?.after;
const inventory = (report) => {
  const items = [];
  const walk = (s) => {
    for (const spec of s.specs || [])
      for (const t of spec.tests || [])
        items.push({ key: `${spec.id}/${t.projectName}`, results: t.results || [] });
    for (const nested of s.suites || []) walk(nested);
  };
  for (const s of report?.suites || []) walk(s);
  return items;
};
const counts = [];
for (const file of specs) {
  const fileMetadata =
    supplementalMetadata?.byFile?.[file] ||
    (supplementalMetadata?.testHashes?.[file] ? supplementalMetadata : suiteMetadata);
  const name = file.replace(".spec.mjs", ".json");
  const original = read(path.join(suite, name));
  const recheck = read(path.join(rechecks, name));
  const originalItems = inventory(original),
    recheckItems = inventory(recheck);
  const membershipMatches =
    originalItems.length > 0 &&
    JSON.stringify(originalItems.map((t) => t.key).sort()) ===
      JSON.stringify(recheckItems.map((t) => t.key).sort());
  const testHash = crypto
    .createHash("sha256")
    .update(fs.readFileSync(`tests/${file}`))
    .digest("hex");
  const provenanceMatches =
    recheckMetadata?.build?.commit === expectedBuild?.commit &&
    JSON.stringify(recheckMetadata?.build?.files) === JSON.stringify(expectedBuild?.files) &&
    recheckMetadata?.testHashes?.[file] === testHash &&
    recheckMetadata?.wholeFiles?.includes(file);
  const acceptedRecheck = !!(
    recheck &&
    membershipMatches &&
    provenanceMatches &&
    Date.parse(recheck.stats?.startTime) >= Date.parse(recheckMetadata?.verifiedAt) &&
    !(recheck.errors || []).length &&
    recheckItems.every((t) => t.results.length === 1 && t.results[0].retry === 0) &&
    recheck.config?.projects?.every((p) => p.retries === 0)
  );
  const report = acceptedRecheck ? recheck : original;
  const items = inventory(report);
  const c = {
    file,
    passed: 0,
    failed: 0,
    skipped: 0,
    missing: !report || items.length === 0 || items.some((t) => !t.results.length),
    rechecked: acceptedRecheck,
    recheckRejected: !!recheck && !acceptedRecheck,
    startupErrors: (report?.errors || []).length,
    attempts: items.reduce((n, t) => n + t.results.length, 0),
    provenance:
      acceptedRecheck ||
      (sameBuild(fileMetadata?.build, expectedBuild) &&
        fileMetadata?.testHashes?.[file] === testHash &&
        Date.parse(original?.stats?.startTime) >= Date.parse(fileMetadata?.verifiedAt))
        ? "final renderer and test hashes"
        : "interim run; no recorded source hashes",
    initialFailures: 0,
  };
  const walk = (s) => {
    for (const spec of s.specs || [])
      for (const t of spec.tests) {
        const r = t.results.at(-1);
        if (r) {
          if (r.status === "passed") c.passed++;
          else if (r.status === "skipped") c.skipped++;
          else c.failed++;
        }
      }
    for (const nested of s.suites || []) walk(nested);
  };
  const initial = (s) => {
    for (const spec of s.specs || [])
      for (const t of spec.tests)
        for (const r of t.results)
          if (!["passed", "skipped"].includes(r.status)) c.initialFailures++;
    for (const nested of s.suites || []) initial(nested);
  };
  if (original) initial(original);
  if (report) walk(report);
  counts.push(c);
}
const anchorSettings = read(path.join(root, "anchored-sweep/settings.json"));
const anchorRows = read(path.join(root, "anchored-sweep/rows.json"), []);
const anchorRun = read(path.join(root, "anchored-sweep/run.json"));
const anchorInterruption = read(path.join(root, "anchored-sweep/interrupted-run.json"));
const anchoredConsoleHistory = {
  latestPhaseErrors: anchorRun?.errors ?? null,
  latestPhaseFinished: !!anchorRun,
  interruptedHistory: anchorInterruption,
  scope: anchorInterruption
    ? "Only errors observed during the resumed phase are recorded; the initial interrupted phase's console history is unavailable."
    : "Errors are recorded when the anchored audit finishes.",
};
const anchorValid =
  sameBuild(anchorSettings?.before, builds?.before) &&
  sameBuild(anchorSettings?.after, builds?.after);
const anchored = anchorValid ? anchorRows : [];
if (anchorRows.length && !anchorValid) staleEvidence.push("anchored-sweep");
const anchoredComparisons = [];
for (const entry of inputs())
  for (const screen of ["phone", "desktop"]) {
    const select = (build) =>
      anchored.filter((r) => r.id === entry.id && r.screen === screen && r.build === build);
    const b = select("before"),
      a = select("after");
    anchoredComparisons.push({
      id: entry.id,
      screen,
      beforeRows: b.length,
      afterRows: a.length,
      candidates: a[0]?.candidates ?? null,
      stableAnchors: a[0]?.stableAnchors ?? null,
      before: worst(b, "anchoredMAE"),
      after: worst(a, "anchoredMAE"),
    });
  }
const errorsFor = (name) =>
  read(path.join(root, name, "errors.json")) ?? read(path.join(root, name, "run.json"))?.errors;
const afterPhaseNames = [
  opt("after", "sweep-after"),
  ...(extraAfterSettings ? [extraAfterName] : []),
];
const afterPhaseErrors = afterPhaseNames.map(errorsFor);
const summary = {
  plannedDepths: planned.depths,
  expectedGroupRows,
  expectedBeforeGroupRows,
  expectedBeforeRows: inputs().length * beforePlanned.names.length * expectedBeforeGroupRows,
  expectedAfterRows: inputs().length * planned.names.length * expectedGroupRows,
  baselineViews: beforePlanned.views,
  targetViews: planned.views,
  beforeRows: before.length,
  afterRows: after.length,
  comparisons,
  completeGroups: comparisons.filter((r) => r.complete).length,
  completeBeforeGroups: comparisons.filter((r) => r.beforeComplete).length,
  completeAfterGroups: comparisons.filter((r) => r.afterComplete).length,
  expectedGroups: inputs().length * 2,
  anchoredRows: anchored.length,
  anchoredComparisons,
  anchoredConsoleHistory,
  staleEvidence,
  sharpHaloRows: {
    before: before.filter((r) => Number.isFinite(r.haloMean)).length,
    after: after.filter((r) => Number.isFinite(r.haloMean)).length,
    expectedPerBuild: inputs().length * 2 * 9,
  },
  timing,
  cadence,
  timingRetakes,
  specs: counts,
  worstHole: worst(after, "holeFraction"),
  worstHalo: worst(after, "haloMean"),
  holeViolations: after.filter((r) => r.holeFraction >= 0.002),
  errors: {
    before: errorsFor(opt("before", "sweep-before")),
    after: afterPhaseErrors.every(Array.isArray) ? afterPhaseErrors.flat() : null,
  },
  targetCapturePhases: afterPhaseNames.map((name) => ({
    name,
    finished: !!read(path.join(root, name, "run.json")),
    phoneScopeComplete:
      name === opt("after", "sweep-after") &&
      read(path.join(root, "target-phone-complete.json"))?.phoneRows === 882,
    recordedErrors: errorsFor(name),
  })),
  captureFailure,
};
fs.writeFileSync(path.join(root, "summary.json"), JSON.stringify(summary, null, 2));
const text = [
  "# Round 3 retained evidence",
  "",
  `Before: ${before.length}/${summary.expectedBeforeRows} poses (${beforePlanned.views.join(", ")}). After: ${after.length}/${summary.expectedAfterRows} poses (${planned.views.join(", ")}). Depth settings: ${planned.depths.join(", ")}. Complete required input/profile groups: ${summary.completeGroups}/${summary.expectedGroups}. Sharp has paired baseline and target coverage; Fine Splats has target coverage.`,
  "",
  "The halo column is a Sharp-only source-color transport/filter diagnostic (882 Sharp poses per build expected); Fine Splats has hole counts. The required review clips cover Sharp; the gallery identifies any optional Fine Splats clips. This diagnostic does not establish the semantic correctness of hidden background content. Contrast loss uses the transported point-sampled source and includes ordinary minification.",
  `Stale evidence excluded: ${staleEvidence.length ? staleEvidence.join(", ") : "none"}.`,
  `Target capture phases: ${summary.targetCapturePhases.map((p) => `${p.name} (process finished: ${p.finished ? "yes" : "no"}; phone scope checkpoint: ${p.phoneScopeComplete ? "complete" : "not recorded"}; recorded errors: ${p.recordedErrors?.length ?? "history unavailable"})`).join("; ")}. Persistent error histories are preferred over any older completed-run snapshot.`,
  "",
  `| Input | Profile | Before / after poses (${expectedBeforeGroupRows} / ${expectedGroupRows} expected) | Before worst holes | Before hole pose | After worst holes | After hole pose | Before worst halo mean | Before halo pose | After worst halo mean | After halo pose |`,
  "| --- | --- | ---: | ---: | --- | ---: | --- | ---: | --- | ---: | --- |",
];
for (const r of comparisons)
  text.push(
    `| ${r.id} | ${r.screen} | ${r.beforeRows} / ${r.afterRows} | ${percent(r.beforeHole)} | ${pose(r.beforeHole)} | ${percent(r.afterHole)} | ${pose(r.afterHole)} | ${number(r.beforeHalo, "haloMean")} | ${pose(r.beforeHalo)} | ${number(r.afterHalo, "haloMean")} | ${pose(r.afterHalo)} |`,
  );
text.push(
  "",
  "## Source-anchored edge profiles",
  "",
  "These profiles use the original source RGB and a fitted, inferred depth-plane surrogate, independent of rendered UVs or generated background colors. Stable high-contrast patches only: unmeasured edges remain unproven. Color errors include minification and uncertain hidden content. Read the retained per-pose JSON for displacement, transition width and missing crossings; distances use drawing-buffer pixels.",
  `Console history: ${anchoredConsoleHistory.scope} Latest phase finished: ${anchoredConsoleHistory.latestPhaseFinished ? "yes" : "no"}; latest-phase recorded errors: ${anchoredConsoleHistory.latestPhaseErrors?.length ?? "not available"}.${anchorInterruption ? ` Initial history unavailable for ${anchorInterruption.completedRows} retained rows (${anchorInterruption.completedGroups} complete groups); see anchored-sweep/interrupted-run.json.` : ""}`,
  "",
  "| Input | Profile | Before / after poses | Stable anchors / candidates | Before worst MAE | Before worst pose | After worst MAE | After worst pose |",
  "| --- | --- | ---: | ---: | ---: | --- | ---: | --- |",
);
for (const r of anchoredComparisons)
  text.push(
    `| ${r.id} | ${r.screen} | ${r.beforeRows} / ${r.afterRows} | ${r.stableAnchors ?? "pending"} / ${r.candidates ?? "pending"} | ${number(r.before, "anchoredMAE")} | ${r.before ? `depth ${r.before.depth}, yaw ${r.before.yaw}, pitch ${r.before.pitch}` : "not measured"} | ${number(r.after, "anchoredMAE")} | ${r.after ? `depth ${r.after.depth}, yaw ${r.after.yaw}, pitch ${r.after.pitch}` : "not measured"} |`,
  );
text.push(
  "",
  "## Phone Sharp completed-pose cadence",
  "",
  "Includes WebGL2 completion fences and scheduling/polling overhead on a software GPU; physical-phone smoothness is not measured.",
  `Paired inputs: ${cadence.measuredInputs}/${cadence.expectedInputs}. Geometric mean of round-3/main mean-time ratios: ${cadence.meanTimeRatio?.toFixed(6) ?? "not measured"}; p95-time ratios: ${cadence.p95TimeRatio?.toFixed(6) ?? "not measured"}. Inputs slower by more than 5% in this run: ${cadence.slowerByMoreThanFivePercent.join(", ") || "none measured"}. All initial timing rows remain retained.`,
  "",
  "| Input | Main poses/s | Round 3 poses/s | Main p95 ms | Round 3 p95 ms |",
  "| --- | ---: | ---: | ---: | ---: |",
);
for (const r of timing)
  text.push(
    `| ${r.id} | ${r.main?.fps.toFixed(2) ?? "not measured"} | ${r.after?.fps.toFixed(2) ?? "not measured"} | ${r.main?.p95Ms.toFixed(1) ?? "not measured"} | ${r.after?.p95Ms.toFixed(1) ?? "not measured"} |`,
  );
text.push(
  "",
  "Six timing outliers were selected for two isolated retakes with reversed build order. These repeat measurements supplement the initial 49-input run; no initial result is replaced.",
  "",
  "| Round | Input | Planned build order | Main poses/s | Round 3 poses/s | Mean time ratio | p95 time ratio |",
  "| ---: | --- | --- | ---: | ---: | ---: | ---: |",
);
for (const r of timingRetakes)
  text.push(
    `| ${r.round} | ${r.id} | ${r.order} | ${r.main?.fps.toFixed(2) ?? "not measured"} | ${r.after?.fps.toFixed(2) ?? "not measured"} | ${r.meanRatio?.toFixed(6) ?? "not measured"} | ${r.p95Ratio?.toFixed(6) ?? "not measured"} |`,
  );
text.push(
  "",
  "## Spec counts",
  "",
  "Initial failures remain recorded. Where a whole file was rechecked, the final columns use that separate run; tests and thresholds are unchanged.",
  "",
  "| Spec | Passed | Failed | Existing conditional skips | Initial failures | Whole-file recheck | Startup errors | Attempts | Source provenance |",
  "| --- | ---: | ---: | ---: | ---: | --- | ---: | ---: | --- |",
);
for (const c of counts)
  text.push(
    `| ${c.file} | ${c.missing ? "not run" : c.passed} | ${c.failed} | ${c.skipped} | ${c.initialFailures} | ${c.rechecked ? "yes" : c.recheckRejected ? "rejected" : "no"} | ${c.startupErrors} | ${c.attempts} | ${c.missing ? "pending" : c.provenance} |`,
  );
fs.writeFileSync(path.join(root, "summary.md"), text.join("\n") + "\n");
console.log(
  JSON.stringify(
    {
      beforeRows: before.length,
      afterRows: after.length,
      holeViolations: summary.holeViolations.length,
      completedSpecs: counts.filter((c) => !c.missing).length,
      failedSpecs: counts
        .filter((c) => c.failed || c.startupErrors || c.recheckRejected)
        .map((c) => c.file),
      missingSpecs: counts.filter((c) => c.missing).length,
      phoneTimings: timing.filter((r) => r.valid).length,
    },
    null,
    2,
  ),
);
