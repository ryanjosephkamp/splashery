// MIT. Benchmark arithmetic and provenance guards; these do not launch a browser.
import { createHash } from "node:crypto";
export const BENCH_PROFILES = ["phone", "desktop"];
export const RETRY_MODES = ["none", "harness-error", "incomplete", "all"];
const canonical = (v) =>
  Array.isArray(v)
    ? v.map(canonical)
    : v && typeof v === "object"
      ? Object.fromEntries(
          Object.keys(v)
            .sort()
            .map((k) => [k, canonical(v[k])]),
        )
      : v;
export const fingerprint = (v) =>
  createHash("sha256")
    .update(JSON.stringify(canonical(v)))
    .digest("hex");
export const rowKey = (r) => `${r.id}/${r.profile}`;
export function benchmarkCohort(clips, profiles = BENCH_PROFILES) {
  if (
    !clips.length ||
    !profiles.length ||
    new Set(profiles).size !== profiles.length ||
    profiles.some((p) => !BENCH_PROFILES.includes(p))
  )
    throw new Error("Invalid benchmark cohort.");
  const inputs = clips.map(({ id, sha256 }) => ({ id, sha256 }));
  if (
    new Set(inputs.map((r) => r.id)).size !== inputs.length ||
    inputs.some((r) => !r.id || !/^[a-f0-9]{64}$/.test(r.sha256))
  )
    throw new Error("Invalid or duplicate benchmark inputs.");
  return { inputs, profiles: profiles.slice() };
}
export function accountedOutcome(r) {
  return r?.status === "finished"
    ? !r.consoleErrors?.length
    : r?.status === "explained" &&
        !!r.reason?.trim() &&
        r.explanation?.visible === true &&
        !!r.explanation.diagnostic?.trim() &&
        !!r.explanation.advice?.trim() &&
        !r.consoleErrors?.length;
}
export function resumeDecision(previous, provenance, cohort, retry = "none") {
  if (!RETRY_MODES.includes(retry)) throw new Error(`Unknown retry mode: ${retry}.`);
  if (!previous) return { results: [], retryKeys: [], archiveAll: false };
  if (retry === "all") return { results: [], retryKeys: [], archiveAll: true };
  const expected = fingerprint(provenance);
  if (
    !previous.provenance ||
    previous.provenanceSha256 !== expected ||
    fingerprint(previous.provenance) !== expected ||
    fingerprint(previous.cohort) !== fingerprint(cohort)
  )
    throw new Error(
      "Resume provenance changed or is absent. Use a fresh output or --retry=all to archive the prior evidence.",
    );
  const inputs = new Map(cohort.inputs.map((r) => [r.id, r.sha256]));
  const seen = new Set(),
    results = [],
    retryKeys = [];
  for (const row of previous.results || []) {
    const key = rowKey(row);
    if (seen.has(key) || !cohort.profiles.includes(row.profile) || !inputs.has(row.id))
      throw new Error(`Unexpected or duplicate prior input: ${key}.`);
    seen.add(key);
    if (row.sha256 !== inputs.get(row.id) || row.provenanceSha256 !== expected)
      throw new Error(`Changed input or provenance: ${key}. Use --retry=all to archive it.`);
    const retryRow =
      retry === "incomplete"
        ? !accountedOutcome(row)
        : retry === "harness-error" && row.status === "harness-error";
    if (retryRow) retryKeys.push(key);
    else {
      if (!accountedOutcome(row))
        throw new Error(
          `Incomplete prior result: ${key}. Use --retry=incomplete to archive and retry it.`,
        );
      results.push(row);
    }
  }
  return { results, retryKeys, archiveAll: false };
}
// A decoded frame covers a time interval. Conservatively reject a test timestamp within one
// source frame of ANY selected training photograph, including unregistered photographs.
export function assertHeldoutTimes(times, trainingTimes, fps) {
  if (
    !times?.length ||
    !trainingTimes?.length ||
    !Number.isFinite(fps) ||
    fps <= 0 ||
    [...times, ...trainingTimes].some((t) => !Number.isFinite(t))
  )
    throw new Error("Missing held-out/training frame evidence.");
  if (new Set(times).size !== times.length) throw new Error("Duplicate held-out times.");
  for (const t of times)
    if (trainingTimes.some((s) => Math.abs(t - s) <= 1 / fps + 1e-6))
      throw new Error(`Held-out time ${t} overlaps a training photograph.`);
}
export function median(values) {
  if (!values.length || values.some((v) => !Number.isFinite(v))) return null;
  const a = values.slice().sort((a, b) => a - b),
    i = a.length >> 1;
  return a.length % 2 ? a[i] : (a[i - 1] + a[i]) / 2;
}
export function compareRuns(mainRun, candidateRun, { cohort: fixtureCohort } = {}) {
  const arrays = Array.isArray(mainRun) && Array.isArray(candidateRun);
  const main = Array.isArray(mainRun) ? mainRun : mainRun.results;
  const candidate = Array.isArray(candidateRun) ? candidateRun : candidateRun.results;
  const cohort = fixtureCohort || mainRun.cohort,
    candidateCohort = fixtureCohort || candidateRun.cohort;
  const declared = !!cohort && fingerprint(cohort) === fingerprint(candidateCohort);
  const expected = declared
    ? cohort.inputs.flatMap((r) => cohort.profiles.map((profile) => ({ ...r, profile })))
    : [];
  const expectedByKey = new Map(expected.map((r) => [rowKey(r), r]));
  const index = (rows) => {
    const out = new Map();
    for (const r of rows) {
      if (out.has(rowKey(r))) throw new Error("Duplicate benchmark inputs.");
      out.set(rowKey(r), r);
      if (expectedByKey.has(rowKey(r)) && expectedByKey.get(rowKey(r)).sha256 !== r.sha256)
        throw new Error(`Changed input: ${r.id}.`);
    }
    return out;
  };
  const beforeByKey = index(main),
    afterByKey = index(candidate);
  for (const [key, a] of beforeByKey)
    if (afterByKey.has(key) && a.sha256 !== afterByKey.get(key).sha256)
      throw new Error(`Changed input: ${a.id}.`);
  const validProvenance = (run) =>
    !!run.provenance &&
    fingerprint(run.provenance) === run.provenanceSha256 &&
    run.results.every((r) => r.provenanceSha256 === run.provenanceSha256);
  const compatible = arrays
    ? !!fixtureCohort
    : validProvenance(mainRun) &&
      validProvenance(candidateRun) &&
      mainRun.provenance.protocolSha256 === candidateRun.provenance.protocolSha256 &&
      fingerprint(mainRun.provenance.environment) ===
        fingerprint(candidateRun.provenance.environment) &&
      fingerprint(mainRun.provenance.options) === fingerprint(candidateRun.provenance.options) &&
      candidateRun.provenance.reference?.provenanceSha256 === mainRun.provenanceSha256 &&
      candidate.every((row) => {
        const baseline = beforeByKey.get(rowKey(row));
        return (
          !!baseline &&
          row.referenceEvidence?.provenanceSha256 === mainRun.provenanceSha256 &&
          row.referenceEvidence?.resultFingerprint === fingerprint(baseline) &&
          (baseline.status !== "finished" ||
            row.referenceEvidence?.evaluationSha256 === baseline.evaluationSha256)
        );
      });
  const complete =
    declared &&
    compatible &&
    expected.length > 0 &&
    main.length === expected.length &&
    candidate.length === expected.length &&
    expected.every(
      (r) =>
        accountedOutcome(beforeByKey.get(rowKey(r))) && accountedOutcome(afterByKey.get(rowKey(r))),
    );
  const profiles = {};
  for (const profile of cohort?.profiles || BENCH_PROFILES) {
    const before = main.filter((r) => r.profile === profile),
      after = candidate.filter((r) => r.profile === profile);
    const pairs = before.map((a) => [a, afterByKey.get(rowKey(a))]);
    const measurable = (r) =>
      r?.status === "finished" &&
      Number.isFinite(r.mean?.ssim) &&
      Number.isFinite(r.mean?.laplacian) &&
      r.mean.laplacian >= 0;
    const baseline = pairs.filter(([a]) => measurable(a) && a.mean.laplacian > 0);
    const framesMatch = (a, b) =>
      arrays ||
      (a.frames?.length > 0 &&
        a.frames.length === b.frames?.length &&
        a.frames.every(
          (f, i) =>
            f.time === b.frames[i].time && f.referenceSha256 === b.frames[i].referenceSha256,
        ));
    const scored = baseline.filter(([a, b]) => measurable(b) && framesMatch(a, b));
    const coverage = complete && baseline.length > 0 && scored.length === baseline.length;
    const qualityEvidenceComplete =
      scored.length > 0 &&
      scored.every(
        ([a, b]) =>
          arrays || (a.heldoutEvidence?.complete === true && b.heldoutEvidence?.complete === true),
      );
    const sharpnessMain = median(scored.map(([a]) => a.mean.laplacian)),
      sharpnessCandidate = median(scored.map(([, b]) => b.mean.laplacian));
    const sharpnessGain = sharpnessMain > 0 ? sharpnessCandidate / sharpnessMain : null;
    const ssimMain = median(scored.map(([a]) => a.mean.ssim)),
      ssimCandidate = median(scored.map(([, b]) => b.mean.ssim));
    const ssimGain = scored.length ? ssimCandidate - ssimMain : null;
    const timed = pairs.filter(([a]) => a.status === "finished"),
      timing = {};
    let noSlower = complete && timed.length > 0;
    for (const key of ["firstViewMs", "bakeMs"]) {
      const a = timed.map(([r]) => r[key]),
        b = timed.map(([, r]) => (r?.status === "finished" ? r[key] : null));
      const valid =
        a.every((n) => Number.isFinite(n) && n >= 0) &&
        b.every((n) => Number.isFinite(n) && n >= 0);
      timing[key] = {
        mainMedian: valid ? median(a) : null,
        candidateMedian: valid ? median(b) : null,
        mainWorst: valid && a.length ? Math.max(...a) : null,
        candidateWorst: valid && b.length ? Math.max(...b) : null,
      };
      noSlower &&= valid && median(b) <= median(a) && Math.max(...b) <= Math.max(...a);
    }
    profiles[profile] = {
      clips: before.length,
      expectedClips: cohort?.inputs.length ?? null,
      baselineMeasurable: baseline.length,
      pairedMeasurable: scored.length,
      scoreScope: "Paired successful clips only; explained rejections have no image score.",
      scoredIds: scored.map(([a]) => a.id),
      complete,
      coverage,
      sharpnessMain,
      sharpnessCandidate,
      sharpnessGain,
      ssimMain,
      ssimCandidate,
      ssimGain,
      timing,
      noSlower,
      qualityEvidenceComplete,
      quality: coverage && qualityEvidenceComplete && sharpnessGain >= 1.5 && ssimGain >= 0.03,
      outcomes: after.map((r) => ({ id: r.id, status: r.status, reason: r.reason || null })),
    };
  }
  return {
    complete,
    provenanceCompatible: compatible,
    cohort: cohort || null,
    missingMain: expected.filter((r) => !beforeByKey.has(rowKey(r))).map(rowKey),
    missingCandidate: expected.filter((r) => !afterByKey.has(rowKey(r))).map(rowKey),
    unaccounted: [
      ...main.map((r) => ({ ...r, run: "main" })),
      ...candidate.map((r) => ({ ...r, run: "candidate" })),
    ]
      .filter((r) => !accountedOutcome(r))
      .map((r) => ({ run: r.run, key: rowKey(r), status: r.status })),
    neverFails: complete,
    profiles,
  };
}
