// MIT; made by Ryan with Codex (GPT-6). Follow-up gates; no task 99 gate is loosened.
import { median } from "./p3d-next-score.mjs";
import { POSES } from "./p3df/scoring.mjs";

export function compareFillBoundaries(base, candidate) {
  const ids = new Set(base.scenes.map((s) => s.scene)),
    nextIds = new Set(candidate.scenes.map((s) => s.scene));
  const complete = !!(
    base.complete &&
    candidate.complete &&
    base.views === 216 &&
    candidate.views === 216 &&
    base.scenes.length === 12 &&
    candidate.scenes.length === 12 &&
    ids.size === 12 &&
    nextIds.size === 12 &&
    [...ids].every((id) => nextIds.has(id))
  );
  const supportMatches =
    base.boundaryViews > 0 &&
    base.boundaryPixels > 0 &&
    base.boundaryViews === candidate.boundaryViews &&
    base.boundaryPixels === candidate.boundaryPixels;
  const gain =
    Number.isFinite(base.medianBoundaryError) &&
    Number.isFinite(candidate.medianBoundaryError) &&
    base.medianBoundaryError > 0
      ? 1 - candidate.medianBoundaryError / base.medianBoundaryError
      : null;
  return {
    complete,
    supportMatches,
    gain,
    classicBoundaryError: base.medianBoundaryError,
    fillBoundaryError: candidate.medianBoundaryError,
    pass:
      complete &&
      supportMatches &&
      gain !== null &&
      candidate.medianBoundaryError <= base.medianBoundaryError * 1.01,
    truthPass:
      complete &&
      Number.isFinite(base.medianError) &&
      Number.isFinite(candidate.medianError) &&
      candidate.medianError <= base.medianError,
    scenes: base.scenes.map((s) => ({
      scene: s.scene,
      classic: s.boundary,
      fill: candidate.scenes.find((n) => n.scene === s.scene)?.boundary ?? null,
    })),
  };
}

export function compareFillQuality(rows, expectedIds) {
  const issues = [],
    expected = new Set(expectedIds),
    seen = new Set();
  if (expectedIds.length !== 118 || expected.size !== 118 || rows.length !== 472)
    issues.push("Need all 118 inputs, both profiles, and both methods");
  for (const r of rows) {
    const key = [r.id, r.profile, r.candidate].join("/");
    if (
      seen.has(key) ||
      !expected.has(r.id) ||
      !["phone", "desktop"].includes(r.profile) ||
      !["classic", "fill"].includes(r.candidate)
    )
      issues.push("Unexpected or duplicate observation: " + key);
    seen.add(key);
  }
  const profiles = ["phone", "desktop"].map((profile) => {
    const pairs = [],
      unsupported = [],
      supportLost = [],
      thinLosses = [];
    for (const id of expectedIds) {
      const a = rows.find((r) => r.id === id && r.profile === profile && r.candidate === "classic"),
        b = rows.find((r) => r.id === id && r.profile === profile && r.candidate === "fill");
      if (!a || !b) {
        issues.push("Missing pair: " + id + "/" + profile);
        continue;
      }
      const base = a.observation,
        value = b.observation;
      if (
        a.photoHash !== b.photoHash ||
        a.probeSha256 !== b.probeSha256 ||
        base.browser !== value.browser ||
        base.renderer !== value.renderer ||
        JSON.stringify(base.native) !== JSON.stringify(value.native) ||
        JSON.stringify(base.targetCameras) !== JSON.stringify(value.targetCameras)
      )
        issues.push("Unpaired observation: " + id + "/" + profile);
      for (const o of [base, value]) {
        const poses = o.rows.map((r) => r.yaw + "/" + r.pitch);
        if (
          o.errors.length ||
          o.externalRequests.length ||
          o.rows.length !== 9 ||
          new Set(poses).size !== 9 ||
          !POSES.every(([y, p]) => poses.includes(y + "/" + p)) ||
          o.targetCameras.length !== 9
        )
          issues.push("Invalid nine-pose capture: " + id + "/" + profile);
      }
      if (
        base.overlayProof.hits.length ||
        value.overlayProof.hits.length !== 1 ||
        value.overlayProof.hits[0] !== "worker" ||
        !value.overlayProof.fillStats
      )
        issues.push("Fill must execute without a shader overlay: " + id + "/" + profile);
      const binding = value.overlayProof.colorBinding;
      if (
        !binding?.foregroundSeparate ||
        !binding.foregroundMatchesClassic ||
        !binding.backingMatchesFilled
      )
        issues.push("Fill must preserve Classic foreground color bindings: " + id + "/" + profile);
      const supported =
        Number.isFinite(base.values.streaks) && Number.isFinite(value.values.streaks);
      if (!supported) unsupported.push(id);
      for (const key of ["streaks", "textureLoss"])
        if (Number.isFinite(base.values[key]) !== Number.isFinite(value.values[key]))
          supportLost.push({ id, metric: key });
      for (const p of base.rows) {
        const q = value.rows.find((r) => r.yaw === p.yaw && r.pitch === p.pitch);
        if (
          !p.fringe ||
          !q?.fringe ||
          p.fringe.evaluated !== q.fringe.evaluated ||
          (p.fringe.evaluated > 0 &&
            (!Number.isFinite(p.fringe.missing) || !Number.isFinite(q.fringe.missing)))
        ) {
          issues.push("Thin-probe support differs: " + id + "/" + profile);
          continue;
        }
        if (q.fringe.missing > p.fringe.missing)
          thinLosses.push({
            id,
            yaw: p.yaw,
            pitch: p.pitch,
            extraLost: q.fringe.missing - p.fringe.missing,
          });
      }
      pairs.push({ id, classic: base.values, fill: value.values });
    }
    const ribbon = pairs.filter(
        (p) => Number.isFinite(p.classic.streaks) && Number.isFinite(p.fill.streaks),
      ),
      texture = pairs.filter(
        (p) => Number.isFinite(p.classic.textureLoss) && Number.isFinite(p.fill.textureLoss),
      ),
      classicMedian = median(ribbon.map((p) => p.classic.streaks)),
      fillMedian = median(ribbon.map((p) => p.fill.streaks)),
      streakGain = classicMedian > 0 ? 1 - fillMedian / classicMedian : null,
      textureDelta = texture.length
        ? median(texture.map((p) => p.fill.textureLoss)) -
          median(texture.map((p) => p.classic.textureLoss))
        : null;
    return {
      profile,
      inputs: pairs.length,
      ribbonSupport: ribbon.length,
      unsupported,
      supportLost,
      classicMedian,
      fillMedian,
      streakGain,
      textureDelta,
      thinLosses,
      below60Percent: ribbon
        .filter((p) => p.fill.streaks > 0.4 * p.classic.streaks)
        .map((p) => p.id),
      ribbonRegressions: ribbon
        .filter((p) => p.fill.streaks > p.classic.streaks * 1.05)
        .map((p) => p.id),
      pairs,
    };
  });
  const complete = issues.length === 0;
  return {
    complete,
    issues,
    profiles,
    ribbonPass:
      complete &&
      profiles.every(
        (p) =>
          p.supportLost.length === 0 &&
          p.streakGain !== null &&
          p.streakGain >= 0.6 &&
          p.textureDelta !== null &&
          p.textureDelta <= 0 &&
          p.ribbonRegressions.length === 0,
      ),
    everyInputRibbonPass:
      complete &&
      profiles.every(
        (p) =>
          p.supportLost.length === 0 && p.unsupported.length === 0 && p.below60Percent.length === 0,
      ),
    thinPass: complete && profiles.every((p) => p.thinLosses.length === 0),
  };
}
