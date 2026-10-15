// MIT. Source-backed diagnostics are warnings, not hidden-scene ground truth.
import { colorAtR3, anchoredEdgesR3 } from "../cdx-p3d2-r3-anchored.mjs";
import { streakR4, fringeR4 } from "./artifacts.mjs";
import { cohorts } from "./cohorts.mjs";
import { fitInverseDepth, depthError } from "../studio-truth/metrics.mjs";

export const POSES = [
  [0, 0],
  [-20, 0],
  [20, 0],
  [-30, 0],
  [30, 0],
  [0, -20],
  [0, 20],
  [0, -30],
  [0, 30],
];
export const THRESHOLDS = Object.freeze({
  streaks: 0.15,
  textureLoss: 0.5,
  holes: 0.01,
  halos: 0.04,
  fringes: 0.75,
  missing: 0.2,
  depth: 0.2,
  depthAbsRel: 0.2,
});
const average = (values) =>
  values.length ? values.reduce((a, b) => a + b, 0) / values.length : null;
const distance = (a, b) => Math.hypot(...a.map((v, c) => v - b[c]));

export function cueDepth(photo, field) {
  const { width: w, height: h, data: d } = field;
  let candidates = 0,
    flipped = 0,
    flattened = 0;
  const anchors = [];
  const rgb = (x, y) =>
    colorAtR3(photo, ((x + 0.5) * photo.width) / w - 0.5, ((y + 0.5) * photo.height) / h - 0.5);
  // A strong, persistent contour with a perpendicular line ending on just one side.
  // The uninterrupted side is a foreground hypothesis. Texture can violate it.
  for (let y = 7; y < h - 7; y += 3)
    for (let x = 7; x < w - 7; x += 3)
      for (let axis = 0; axis < 2; axis++) {
        const at = (t, n) => rgb(x + (axis ? n : t), y + (axis ? t : n));
        if ([-4, 0, 4].some((t) => distance(at(t, -2), at(t, 2)) < 64)) continue;
        const side = (n) => distance(at(-2, n), at(2, n));
        const left = side(-4),
          right = side(4);
        if (!((left > 60 && right < 15) || (right > 60 && left < 15))) continue;
        const near = left < right ? -1 : 1;
        const i = (x, y) => Math.max(0, Math.min(h - 1, y)) * w + Math.max(0, Math.min(w - 1, x));
        const zn = d[i(x + (axis ? near * 4 : 0), y + (axis ? 0 : near * 4))] / 255;
        const zf = d[i(x - (axis ? near * 4 : 0), y - (axis ? 0 : near * 4))] / 255;
        const delta = zn - zf;
        candidates++;
        if (delta < -0.03) flipped++;
        if (Math.abs(delta) < 0.02) flattened++;
        if (anchors.length < 200)
          anchors.push({
            u: (x + 0.5) / w,
            v: (y + 0.5) / h,
            axis,
            nearSide: near,
            depthDelta: delta,
          });
      }
  return {
    kind: "T-junction hypothesis; not reference depth",
    candidates,
    flipped,
    flattened,
    flippedFraction: candidates ? flipped / candidates : null,
    flattenedFraction: candidates ? flattened / candidates : null,
    anchors,
  };
}

export function referenceError(prediction, truth, mask) {
  let fit = null,
    error = null,
    fitError = null;
  try {
    fit = fitInverseDepth(prediction, truth, mask);
    error = depthError(prediction, truth, mask, fit);
  } catch (e) {
    fitError = e.message;
  }
  let pairs = 0,
    reversed = 0,
    flat = 0;
  const finite = Array.from(prediction)
    .filter(Number.isFinite)
    .sort((a, b) => a - b);
  const span = finite.length
    ? finite[Math.floor(0.98 * (finite.length - 1))] -
      finite[Math.floor(0.02 * (finite.length - 1))]
    : 0;
  for (let k = 0; k < 8192; k++) {
    const i = (Math.imul(k + 1, 1664525) >>> 0) % truth.length,
      j = (Math.imul(k + 11, 22695477) >>> 0) % truth.length;
    if (
      i === j ||
      mask[i] !== 1 ||
      mask[j] !== 1 ||
      !(truth[i] > 0) ||
      !(truth[j] > 0) ||
      !Number.isFinite(truth[i] + truth[j] + prediction[i] + prediction[j])
    )
      continue;
    if (Math.abs(truth[i] - truth[j]) < 0.1 * Math.min(truth[i], truth[j])) continue;
    pairs++;
    if ((prediction[i] - prediction[j]) * (truth[j] - truth[i]) < 0) reversed++;
    if (Math.abs(prediction[i] - prediction[j]) <= span * 0.02) flat++;
  }
  return {
    kind: "reference optical-axis depth; appearance-ambiguous pixels excluded",
    fit,
    fitError,
    ...error,
    pairs,
    reversedFraction: pairs ? reversed / pairs : null,
    flattenedFraction: pairs ? flat / pairs : null,
  };
}

export function revealQuads(field) {
  const { width: w, height: h, data: d } = field,
    result = [];
  for (let y = 1; y < h - 2; y++)
    for (let x = 1; x < w - 2; x++)
      for (let axis = 0; axis < 2; axis++) {
        const i = y * w + x,
          j = i + (axis ? w : 1),
          near = Math.max(d[i], d[j]) / 255,
          far = Math.min(d[i], d[j]) / 255;
        if (near - far < 0.035) continue;
        const u = (x + (axis ? 0.5 : 1)) / w,
          v = (y + (axis ? 1 : 0.5)) / h;
        if (Math.min(u, v, 1 - u, 1 - v) < 0.04) continue;
        const du = axis ? 0.5 / w : 0,
          dv = axis ? 0 : 0.5 / h;
        result.push({
          profile: [
            { u: u - du, v: v - dv, depth: near },
            { u: u + du, v: v + dv, depth: near },
            { u: u + du, v: v + dv, depth: far },
            { u: u - du, v: v - dv, depth: far },
          ],
        });
      }
  return result;
}

export function rasterQuads(quads, w, h) {
  const mask = new Uint8Array(w * h);
  for (const q of quads) {
    if (q.some((p) => !Number.isFinite(p[0] + p[1]) || p[2] <= 0)) continue;
    const xmin = Math.max(0, Math.floor(Math.min(...q.map((p) => p[0])))),
      xmax = Math.min(w - 1, Math.ceil(Math.max(...q.map((p) => p[0]))));
    const ymin = Math.max(0, Math.floor(Math.min(...q.map((p) => p[1])))),
      ymax = Math.min(h - 1, Math.ceil(Math.max(...q.map((p) => p[1]))));
    for (let y = ymin; y <= ymax; y++)
      for (let x = xmin; x <= xmax; x++) {
        let inside = false;
        for (let i = 0, j = q.length - 1; i < q.length; j = i++)
          if (
            q[i][1] > y + 0.5 !== q[j][1] > y + 0.5 &&
            x + 0.5 < ((q[j][0] - q[i][0]) * (y + 0.5 - q[i][1])) / (q[j][1] - q[i][1]) + q[i][0]
          )
            inside = !inside;
        if (inside) mask[y * w + x] = 1;
      }
  }
  return mask;
}

export function coverage(mask, projected) {
  const roi = rasterQuads(projected, mask.width, mask.height);
  let revealed = 0,
    holes = 0;
  for (let i = 0; i < roi.length; i++) {
    const c = mask.data[i * 4 + 1];
    if (!roi[i] || (c >= 8 && c < 96)) continue;
    revealed++;
    if (c < 8) holes++;
  }
  return {
    candidateRevealedPixels: revealed,
    uncoveredPixels: holes,
    holeFraction: revealed ? holes / revealed : null,
    definition:
      "Projected strong-depth-cut slabs, excluding covered foreground; binary coverage >= 0.5. Not hidden-scene truth.",
  };
}

export function poseScores({
  color,
  mask,
  uv,
  field,
  minimum,
  ratio,
  edges,
  thin,
  projectedEdges,
  projectedThin,
  projectedReveal,
  source,
}) {
  const classes = cohorts(mask, uv, field, minimum, ratio),
    streak = streakR4(color, classes);
  const halo = anchoredEdgesR3(color, projectedEdges, edges, source);
  const fringe = fringeR4(color, projectedThin, thin, ratio, { localBackground: true });
  return { streak, holes: coverage(mask, projectedReveal), halo, fringe };
}

export function metrics(row) {
  return {
    streaks: row.streak?.directionalExcess,
    textureLoss: Number.isFinite(row.streak?.textureEnergyRatio)
      ? Math.max(0, 1 - row.streak.textureEnergyRatio)
      : null,
    holes: row.holes?.holeFraction,
    halos: row.halo?.anchoredMAE,
    fringes: row.fringe?.fringeP95,
    missing: row.fringe?.evaluated ? row.fringe.missing / row.fringe.evaluated : null,
    depth: row.depth?.kind?.startsWith("reference")
      ? row.depth?.reversedFraction
      : row.depth?.flippedFraction,
    depthAbsRel: row.depth?.kind?.startsWith("reference") ? row.depth?.absRel : null,
  };
}
export function severity(row) {
  const m = metrics(row);
  return Math.max(
    0,
    ...Object.entries(m)
      .filter(([, v]) => Number.isFinite(v))
      .map(([k, v]) => v / THRESHOLDS[k]),
  );
}
export function summarize(rows) {
  const result = {};
  for (const key of Object.keys(THRESHOLDS)) {
    const found = rows
      .filter((r) => Number.isFinite(metrics(r)[key]))
      .sort((a, b) => metrics(b)[key] - metrics(a)[key]);
    result[key] = {
      value: found.length ? metrics(found[0])[key] : null,
      supportedPoses: found.length,
      worstPose: found.length ? [found[0].yaw, found[0].pitch] : null,
      mean: average(found.map((r) => metrics(r)[key])),
    };
  }
  return result;
}
