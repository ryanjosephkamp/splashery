// MIT. Geometry controls only: exact correspondences, not rendered photographs.
import { fitSimilarity, applySimilarity } from "./studio-truth/alignment.mjs";
import { camPosition } from "../vendor/splatjs/src/session.js";
import { makeRng } from "../vendor/splatjs/src/sfm/geometry.js";

const dot = (a, b) => a.reduce((s, v, i) => s + v * b[i], 0);
const cross = (a, b) => [
  a[1] * b[2] - a[2] * b[1],
  a[2] * b[0] - a[0] * b[2],
  a[0] * b[1] - a[1] * b[0],
];
const unit = (v) => v.map((x) => x / Math.hypot(...v));
export const median = (a) => {
  if (!a.length) return null;
  const s = [...a].sort((x, y) => x - y);
  return (s[(s.length - 1) >> 1] + s[s.length >> 1]) / 2;
};

export function makeControl({ count = 24, mixedFocal = false, noise = 0, seed = 104 } = {}) {
  if (!Number.isInteger(count) || count < 8 || count > 60 || !Number.isFinite(noise) || noise < 0)
    throw new Error("Controls require 8–60 cameras and finite, nonnegative noise");
  const rng = makeRng(seed);
  const w = 480,
    h = 360,
    f = 420;
  const points = Array.from({ length: 140 }, () =>
    Array.from({ length: 3 }, () => (rng() - 0.5) * 1.6),
  );
  const descriptors = points.map(() =>
    Uint8Array.from({ length: 128 }, () => Math.floor(rng() * 128)),
  );
  const truth = [],
    images = [],
    feats = [];
  for (let i = 0; i < count; i++) {
    const angle = (i / count) * Math.PI * 2;
    const C = [3.5 * Math.sin(angle), 0.3 + 0.2 * Math.sin(angle * 2), 3.5 * Math.cos(angle)];
    const forward = unit(C.map((v) => -v));
    const right = unit(cross(forward, [0, 1, 0]));
    const down = cross(forward, right);
    const R = [...right, ...down, ...forward],
      t = [right, down, forward].map((r) => -dot(r, C));
    const focal = f * (mixedFocal ? (i % 2 ? 1.35 : 0.75) : 1);
    const x = [],
      y = [],
      desc = [];
    for (let p = 0; p < points.length; p++) {
      const q = [right, down, forward].map((r, j) => dot(r, points[p]) + t[j]);
      const u = w / 2 + (focal * q[0]) / q[2] + noise * (rng() - 0.5);
      const v = h / 2 + (focal * q[1]) / q[2] + noise * (rng() - 0.5);
      if (q[2] > 0 && u > 8 && u < w - 8 && v > 8 && v < h - 8) {
        x.push(u);
        y.push(v);
        desc.push(...descriptors[p]);
      }
    }
    const name = `control-${i}`;
    truth.push({ name, R, t, f: focal, w, h });
    images.push({ name, fw: w, fh: h, gray: new Float32Array(w * h) });
    feats.push({
      id: i,
      n: x.length,
      x: Float32Array.from(x),
      y: Float32Array.from(y),
      xn: new Float32Array(x.length),
      yn: new Float32Array(y.length),
      desc: Uint8Array.from(desc),
      sift: true,
    });
  }
  return { truth, images, feats, sceneSize: Math.sqrt(3) * 1.6, focalPx: f };
}

// One proper similarity for the entire reconstruction, never one alignment per camera.
// Return missing names alongside conditional errors; partial registration cannot pass a gate.
export function scoreCameras(cameras, truth, sceneSize) {
  if (!(sceneSize > 0) || !Number.isFinite(sceneSize)) throw new Error("Invalid scene size");
  const byName = new Map(truth.map((c) => [c.name, c]));
  const valid = (c) => {
    if (
      typeof c.name !== "string" ||
      !c.name ||
      c.R?.length !== 9 ||
      c.t?.length !== 3 ||
      [...c.R, ...c.t].some((v) => !Number.isFinite(v))
    )
      return false;
    const rows = [0, 1, 2].map((i) => Array.from(c.R).slice(i * 3, i * 3 + 3));
    return (
      rows.every((r, i) => rows.every((s, j) => Math.abs(dot(r, s) - +(i === j)) < 1e-3)) &&
      dot(cross(rows[0], rows[1]), rows[2]) > 0.999
    );
  };
  if (byName.size !== truth.length || new Set(cameras.map((c) => c.name)).size !== cameras.length)
    throw new Error("Duplicate camera identity");
  if (truth.some((c) => !valid(c)) || cameras.some((c) => !byName.has(c.name) || !valid(c)))
    throw new Error("Invalid camera");
  const missing = truth.filter((c) => !cameras.some((s) => s.name === c.name)).map((c) => c.name);
  if (cameras.length < 3)
    return {
      registered: cameras.length,
      total: truth.length,
      missing,
      rotationDegMedian: null,
      positionFractionMedian: null,
      pass: false,
    };
  const target = cameras.map((c) => byName.get(c.name));
  const fit = fitSimilarity(cameras.map(camPosition), target.map(camPosition));
  const positions = cameras.map(
    (c, i) =>
      Math.hypot(
        ...applySimilarity(camPosition(c), fit).map((v, j) => v - camPosition(target[i])[j]),
      ) / sceneSize,
  );
  const rotations = cameras.map((c, k) => {
    const aligned = Array.from({ length: 9 }, (_, idx) => {
      const row = Math.floor(idx / 3),
        col = idx % 3;
      return [0, 1, 2].reduce((s, j) => s + c.R[row * 3 + j] * fit.rotation[col][j], 0);
    });
    const trace = aligned.reduce((s, v, i) => s + v * target[k].R[i], 0);
    return (Math.acos(Math.max(-1, Math.min(1, (trace - 1) / 2))) * 180) / Math.PI;
  });
  return {
    registered: cameras.length,
    total: truth.length,
    missing,
    rotationDegMedian: median(rotations),
    rotationDegMax: Math.max(...rotations),
    positionFractionMedian: median(positions),
    positionFractionMax: Math.max(...positions),
    pass: !missing.length && median(rotations) < 2 && median(positions) < 0.02,
    fit,
  };
}
