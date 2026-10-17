// Summarize raw runs without dropping failures or treating missing values as zero.
import fs from "node:fs/promises";
import { pathToFileURL } from "node:url";
import { distribution } from "./pages/phone-speed-metrics.js";

const metrics = ["firstViewMs", "idle.median", "idle.p95", "tap.median", "tap.p95"];
const value = (row, metric) => metric.split(".").reduce((o, k) => o?.[k], row);
const setup = (r) =>
  r.completion === "synchronous-readPixels" &&
  r.firstViewReadback === true &&
  r.splats > 0 &&
  r.profile === "low" &&
  r.renderer === "webgl2" &&
  r.deviceScaleFactor === 3 &&
  r.viewport?.[0] === 390 &&
  r.viewport?.[1] === 844 &&
  r.canvas?.length === 2 &&
  r.canvas.every((n) => Number.isFinite(n) && n > 0)
    ? JSON.stringify([r.splats, r.profile, r.renderer, r.deviceScaleFactor, r.viewport, r.canvas])
    : null;
function sampleSet(runs) {
  const mode = runs.every((r) => Number.isInteger(r.pair))
    ? "pair"
    : runs.every((r) => r.pair === undefined && Number.isInteger(r.run))
      ? "run"
      : null;
  const indices = runs.map((r) => r[mode]).sort((a, b) => a - b);
  return { mode, indices, valid: !!mode && indices.every((n, i) => n === i) };
}
function samplingMatches(summary, expected, phase) {
  return (
    summary.runs === expected &&
    summary.samples.valid &&
    summary.samples.mode === "pair" &&
    summary.phases.length === 1 &&
    summary.phases[0] === phase
  );
}
function appearancePass(visual, native = false) {
  const visiblePose = (pose) =>
    Number.isFinite(pose?.ssim) &&
    pose.ssim >= 0.98 &&
    pose.ssim <= 1 &&
    [pose.laplacian, pose.sourceLaplacian].every((n) => Number.isFinite(n) && n > 0);
  return (
    !!visual &&
    !visual.error &&
    !visual.errors?.length &&
    !visual.referenceError &&
    !visual.referenceErrors?.length &&
    visiblePose(visual.rest) &&
    visiblePose(visual.tap) &&
    (!native ||
      ["rest", "tap"].every(
        (pose) =>
          visiblePose(visual.native?.[pose]) &&
          visual.native[pose].width === 1170 &&
          visual.native[pose].height === 1401,
      ))
  );
}

// Resolution changes need an exact declaration before final sampling, plus
// native-size stills. All other setup fields and every undeclared canvas match.
function configurationMatches(old, next, change, visual, selected) {
  if (
    !old ||
    !next ||
    old.configurations.length !== 1 ||
    next.configurations.length !== 1 ||
    old.configurations[0] === null ||
    next.configurations[0] === null
  )
    return false;
  if (!change) return old.configurations[0] === next.configurations[0];
  if (
    !selected ||
    typeof change.reason !== "string" ||
    !change.reason.trim() ||
    !appearancePass(visual, true)
  )
    return false;
  const before = JSON.parse(old.configurations[0]);
  const after = JSON.parse(next.configurations[0]);
  return (
    JSON.stringify(before.slice(0, -1)) === JSON.stringify(after.slice(0, -1)) &&
    JSON.stringify(before.at(-1)) === JSON.stringify(change.beforeCanvas) &&
    JSON.stringify(after.at(-1)) === JSON.stringify(change.afterCanvas) &&
    JSON.stringify(visual.referenceCanvas) === JSON.stringify(change.beforeCanvas) &&
    JSON.stringify(visual.canvas) === JSON.stringify(change.afterCanvas) &&
    visual.referenceSplats === before[0] &&
    visual.splats === after[0]
  );
}
export function summarize(rows) {
  const groups = new Map();
  for (const row of rows) {
    if (!groups.has(row.id)) groups.set(row.id, []);
    groups.get(row.id).push(row);
  }
  return [...groups].map(([id, runs]) => {
    const result = {
      id,
      runs: runs.length,
      failures: runs.filter(
        (r) =>
          r.error ||
          r.errors?.length ||
          metrics.some((m) => !Number.isFinite(value(r, m)) || value(r, m) <= 0) ||
          !(r.idle?.count >= 8) ||
          !(r.tap?.count >= 8),
      ).length,
      configurations: [...new Set(runs.map(setup))],
      samples: sampleSet(runs),
      phases: [...new Set(runs.map((r) => r.phase ?? null))],
    };
    for (const metric of metrics)
      result[metric] = distribution(runs.map((r) => value(r, metric))).median;
    return result;
  });
}

export function freezeTargets(rows, expectedIds) {
  const summary = summarize(rows);
  if (
    summary.some(
      (r) =>
        r.failures ||
        r.configurations.length !== 1 ||
        r.configurations.includes(null) ||
        !r.samples.valid ||
        r.samples.mode !== "run" ||
        metrics.some((m) => !(r[m] > 0)),
    ) ||
    expectedIds?.some((id) => !summary.some((r) => r.id === id))
  )
    throw new Error("Finish the complete, error-free baseline before freezing targets.");
  const shaped = summary.map((r) => ({
    ...r,
    idle: { median: r["idle.median"] },
    tap: { median: r["tap.median"] },
  }));
  const loading = [...shaped].sort((a, b) => b.firstViewMs - a.firstViewMs);
  const drawing = [...shaped].sort((a, b) => b.idle.median - a.idle.median);
  return drawing.slice(0, 15).map((r) => {
    const loadRank = loading.findIndex((x) => x.id === r.id) + 1;
    const drawRank = drawing.findIndex((x) => x.id === r.id) + 1;
    return {
      id: r.id,
      metric: "idle.median",
      loadRank,
      drawRank,
    };
  });
}

export function compareRuns(
  before,
  after,
  targets,
  visuals = [],
  expectedIds,
  repetitions = {},
  renderChanges = {},
) {
  const b = new Map(summarize(before).map((r) => [r.id, r]));
  const a = new Map(summarize(after).map((r) => [r.id, r]));
  const selected = new Set(targets.map((t) => t.id));
  const fifteen = targets.length === 15 && selected.size === 15;
  const rows = [...new Set([...(expectedIds || []), ...b.keys(), ...a.keys()])].map((id) => {
    const old = b.get(id),
      next = a.get(id);
    const expectedRuns = repetitions[id] ?? (selected.has(id) ? 5 : 1);
    const changes = Object.fromEntries(
      metrics.map((m) => [m, old?.[m] > 0 && next?.[m] > 0 ? 1 - next[m] / old[m] : null]),
    );
    return {
      id,
      expectedRuns,
      before: old || null,
      after: next || null,
      changes,
      valid:
        !!old &&
        !!next &&
        !old.failures &&
        !next.failures &&
        (selected.has(id) ? expectedRuns === 5 : [1, 5, 10].includes(expectedRuns)) &&
        samplingMatches(old, expectedRuns, "before") &&
        samplingMatches(next, expectedRuns, "after") &&
        old.samples.mode === next.samples.mode &&
        configurationMatches(
          old,
          next,
          renderChanges[id],
          visuals.find((v) => v.id === id),
          selected.has(id),
        ) &&
        metrics.every((m) => changes[m] !== null),
    };
  });
  const optimized = targets.map((t) => {
    const row = rows.find((r) => r.id === t.id);
    const visual = visuals.find((r) => r.id === t.id);
    const gain = row?.valid ? row.changes[t.metric] : null;
    const appearance = appearancePass(visual, !!renderChanges[t.id]);
    return { ...t, gain, appearance, speed: gain !== null && gain >= 0.25 };
  });
  const medianGain = distribution(optimized.map((r) => r.gain)).median;
  const regressions = rows.filter(
    (r) => !selected.has(r.id) && (!r.valid || metrics.some((m) => r.changes[m] < -0.05)),
  );
  return {
    rows,
    optimized,
    regressions,
    medianGain,
    gates: {
      coverage:
        rows.length > 0 &&
        rows.every((r) => r.valid) &&
        Object.keys(renderChanges).every((id) => selected.has(id)),
      speed: fifteen && optimized.every((r) => r.speed) && medianGain >= 0.3,
      appearance: fifteen && optimized.every((r) => r.appearance),
      noRegressions: regressions.length === 0,
    },
  };
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const [
    beforeFile,
    afterFile,
    targetsFile,
    visualsFile,
    outputFile,
    repetitionsFile,
    renderChangesFile,
  ] = process.argv.slice(2);
  const read = async (f) => JSON.parse(await fs.readFile(f, "utf8"));
  const before = await read(beforeFile);
  const { TOYS } = await import("../src/toys.js");
  if (!afterFile)
    console.log(
      JSON.stringify(
        freezeTargets(
          before,
          TOYS.map((t) => t.id),
        ),
        null,
        2,
      ),
    );
  else {
    const report = compareRuns(
      before,
      await read(afterFile),
      await read(targetsFile),
      visualsFile ? (await read(visualsFile)).rows : [],
      TOYS.map((t) => t.id),
      repetitionsFile ? await read(repetitionsFile) : {},
      renderChangesFile ? await read(renderChangesFile) : {},
    );
    const json = JSON.stringify(report, null, 2);
    if (outputFile) await fs.writeFile(outputFile, json);
    else console.log(json);
  }
}
