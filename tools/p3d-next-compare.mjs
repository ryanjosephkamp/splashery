// MIT. Fixed task-99 truth gates. Missing coverage is never a passing result.
import fs from "node:fs";
import { median } from "./p3d-next-score.mjs";
export const gain = (base, value) =>
  Number.isFinite(base) && Number.isFinite(value) && base > 0 ? (base - value) / base : null;
export function compareTruth(base, candidate) {
  const sceneChecks = base.scenes.map((a) => {
    const b = candidate.scenes.find((x) => x.scene === a.scene);
    return { scene: a.scene, gain: b ? gain(a.error, b.error) : null };
  });
  const complete =
    base.complete &&
    candidate.complete &&
    base.views === 216 &&
    candidate.views === 216 &&
    base.scenes.length === 12 &&
    candidate.scenes.length === 12;
  const errorGain = gain(base.medianError, candidate.medianError),
    boundaryGain = gain(base.medianBoundaryError, candidate.medianBoundaryError);
  const supportMatches =
    base.boundaryViews === candidate.boundaryViews &&
    base.boundaryPixels === candidate.boundaryPixels &&
    base.boundaryViews > 0;
  return {
    candidate: candidate.candidate,
    complete,
    errorGain,
    boundaryGain,
    sceneChecks,
    truthPass: !!(
      complete &&
      errorGain !== null &&
      errorGain >= 0.1 &&
      sceneChecks.every((x) => x.gain !== null && x.gain >= -0.05)
    ),
    boundaryPass: !!(complete && supportMatches && boundaryGain !== null && boundaryGain >= 0.15),
    supportMatches,
  };
}
export function compareAtlas(study, candidate) {
  const paired = study.rows
    .filter((r) => r.candidate === candidate)
    .map((r) => {
      const base = study.rows.find((a) => a.candidate === "classic" && a.id === r.id);
      if (
        !base ||
        base.photoHash !== r.photoHash ||
        JSON.stringify(base.targetCameras) !== JSON.stringify(r.targetCameras)
      )
        throw new Error("Unpaired atlas observation");
      return {
        id: r.id,
        base: base.values,
        value: r.values,
        basePoses: base.rows || [],
        poses: r.rows || [],
      };
    });
  const supported = (key) =>
    paired.filter((r) => Number.isFinite(r.base[key]) && Number.isFinite(r.value[key]));
  const ribbon = supported("streaks"),
    texture = supported("textureLoss"),
    thin = supported("missing");
  const baseStreaks = median(ribbon.map((r) => r.base.streaks)),
    valueStreaks = median(ribbon.map((r) => r.value.streaks));
  const worse = ribbon.filter((r) => r.value.streaks > r.base.streaks * 1.05).map((r) => r.id);
  const textureDelta = texture.length
    ? median(texture.map((r) => r.value.textureLoss)) -
      median(texture.map((r) => r.base.textureLoss))
    : null;
  const thinDelta = thin.length
    ? median(thin.map((r) => r.value.missing)) - median(thin.map((r) => r.base.missing))
    : null;
  const unique = new Set(paired.map((r) => r.id));
  const complete =
    study.complete &&
    paired.length === 118 &&
    unique.size === 118 &&
    ribbon.length === 118 &&
    study.selection?.length === 118 &&
    study.selection.every((r) => unique.has(r.id));
  const textureSupportMatches =
    texture.length === paired.filter((r) => Number.isFinite(r.base.textureLoss)).length;
  const thinSupportMatches =
    thin.length === paired.filter((r) => Number.isFinite(r.base.missing)).length;
  let thinPoseSupportMatches = true,
    thinPoseCount = 0;
  const thinLost = [];
  for (const row of paired) {
    if (row.basePoses.length !== 9 || row.poses.length !== 9) {
      thinPoseSupportMatches = false;
      continue;
    }
    for (const base of row.basePoses) {
      const value = row.poses.find((r) => r.yaw === base.yaw && r.pitch === base.pitch);
      if (!base.fringe || !value?.fringe || base.fringe.evaluated !== value.fringe.evaluated) {
        thinPoseSupportMatches = false;
        continue;
      }
      if (base.fringe.evaluated > 0) {
        thinPoseCount++;
        if (!Number.isFinite(base.fringe.missing) || !Number.isFinite(value.fringe.missing)) {
          thinPoseSupportMatches = false;
          continue;
        }
        if (value.fringe.missing > base.fringe.missing)
          thinLost.push({
            id: row.id,
            yaw: base.yaw,
            pitch: base.pitch,
            extraLost: value.fringe.missing - base.fringe.missing,
          });
      }
    }
  }
  const thinWorse = [
    ...new Set([
      ...thin.filter((r) => r.value.missing > r.base.missing).map((r) => r.id),
      ...thinLost.map((r) => r.id),
    ]),
  ];
  const streakGain = gain(baseStreaks, valueStreaks);
  return {
    candidate,
    complete,
    inputs: paired.length,
    ribbonSupport: ribbon.length,
    baseStreaks,
    valueStreaks,
    streakGain,
    worse,
    worseFraction: ribbon.length ? worse.length / ribbon.length : null,
    textureSupport: texture.length,
    textureSupportMatches,
    textureDelta,
    thinSupport: thin.length,
    thinSupportMatches,
    thinPoseSupportMatches,
    thinPoseCount,
    thinLost,
    thinWorse,
    thinDelta,
    ribbonPass: !!(
      complete &&
      streakGain !== null &&
      streakGain >= 0.3 &&
      textureSupportMatches &&
      textureDelta !== null &&
      textureDelta <= 0 &&
      worse.length <= 0.1 * ribbon.length
    ),
    thinPass: !!(
      complete &&
      thinSupportMatches &&
      thinPoseSupportMatches &&
      thinPoseCount > 0 &&
      thin.length > 0 &&
      thinWorse.length === 0
    ),
  };
}
if (process.argv[1]?.endsWith("p3d-next-compare.mjs")) {
  const [base, candidate, out] = process.argv.slice(2),
    result = compareTruth(
      JSON.parse(fs.readFileSync(base)),
      JSON.parse(fs.readFileSync(candidate)),
    );
  fs.writeFileSync(out, JSON.stringify(result, null, 2));
  console.log(JSON.stringify(result));
}
