// Deterministic robust plane estimation. Faint/tiny outliers do not vote.
import { quatFromTo, quatEuler, quatMul, quatRotate } from "../kit.js";
import { SplatBuffer } from "../generators.js";

export function eligible(b, i) {
  const p = i * 3,
    c = i * 4;
  return (
    b.color[c + 3] >= 0.05 &&
    Number.isFinite(b.scale[p] + b.scale[p + 1] + b.scale[p + 2]) &&
    (!b.rot || Number.isFinite(b.rot[c] + b.rot[c + 1] + b.rot[c + 2] + b.rot[c + 3])) &&
    Math.min(b.scale[p], b.scale[p + 1], b.scale[p + 2]) > 0 &&
    Math.max(b.scale[p], b.scale[p + 1], b.scale[p + 2]) >= 1e-5 &&
    Number.isFinite(b.pos[p] + b.pos[p + 1] + b.pos[p + 2]) &&
    Math.max(Math.abs(b.pos[p]), Math.abs(b.pos[p + 1]), Math.abs(b.pos[p + 2])) < 1e5
  );
}

export function splatNormal(b, i) {
  const j = i * 3,
    q = i * 4;
  let axis = 0;
  if (b.scale[j + 1] < b.scale[j]) axis = 1;
  if (b.scale[j + 2] < b.scale[j + axis]) axis = 2;
  const n = [0, 0, 0];
  n[axis] = 1;
  if (!b.rot) return n;
  return quatRotate(Array.from(b.rot.subarray(q, q + 4)), n);
}

export function fitFloor(b) {
  const pts = [];
  const stride = Math.max(1, Math.floor(b.count / 5000));
  for (let i = 0; i < b.count; i += stride)
    if (eligible(b, i) && b.color[i * 4 + 3] >= 0.2)
      pts.push([b.pos[i * 3], b.pos[i * 3 + 1], b.pos[i * 3 + 2]]);
  if (pts.length < 30)
    throw new Error(
      "Too few dense, opaque splats to find a floor. Open a place with a visible floor.",
    );
  const ys = pts.map((p) => p[1]).sort((a, b) => a - b);
  const low = ys[Math.floor(ys.length * 0.45)];
  let best = null;
  let seed = 115;
  const rand = () => {
    seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
    return seed % pts.length;
  };
  for (let trial = 0; trial < 180; trial++) {
    const a = pts[rand()],
      b = pts[rand()],
      c = pts[rand()];
    const u = b.map((v, k) => v - a[k]),
      v = c.map((v, k) => v - a[k]);
    let n = [u[1] * v[2] - u[2] * v[1], u[2] * v[0] - u[0] * v[2], u[0] * v[1] - u[1] * v[0]];
    const len = Math.hypot(...n);
    if (len < 0.05) continue;
    n = n.map((v) => (v / len) * (n[1] < 0 ? -1 : 1));
    if (n[1] < 0.65) continue;
    const d = n.reduce((s, v, k) => s + v * a[k], 0);
    const height = d / n[1];
    if (height > low + 0.15) continue;
    let inliers = 0;
    for (const p of pts)
      if (Math.abs(n[0] * p[0] + n[1] * p[1] + n[2] * p[2] - d) < 0.055) inliers++;
    const score = inliers * (0.7 + n[1] * 0.3);
    if (!best || score > best.score) best = { normal: n, d, height, inliers, score };
  }
  if (!best || best.inliers < Math.max(20, pts.length * 0.035))
    throw new Error(
      "No reliable floor found. Try Flip up, or adjust the level, then find the floor again.",
    );
  best.confidence = best.inliers / pts.length;
  return best;
}

export function levelBuffer(
  source,
  { flip = false, pitch = 0, roll = 0, meters = 1, auto = true } = {},
) {
  if (!(meters >= 0.01 && meters <= 100))
    throw new Error("Scale must be between 0.01 and 100 meters per file unit.");
  const manual = quatEuler(pitch, 0, roll + (flip ? 180 : 0));
  let b = transform(source, manual, meters);
  const floor = fitFloor(b);
  const q = auto ? quatFromTo(floor.normal, [0, 1, 0]) : [0, 0, 0, 1];
  b = transform(b, q, 1);
  const offset = auto ? floor.d : floor.height;
  for (let i = 0; i < b.count; i++) b.pos[i * 3 + 1] -= offset;
  return { buffer: b, floor, rotation: quatMul(q, manual) };
}

export function transform(b, q, factor) {
  const out = new SplatBuffer(b.count);
  out.count = b.count;
  for (let i = 0; i < b.count; i++) {
    const j = i * 3,
      k = i * 4;
    const p = quatRotate(q, [b.pos[j], b.pos[j + 1], b.pos[j + 2]]);
    for (let a = 0; a < 3; a++) {
      out.pos[j + a] = p[a] * factor;
      out.scale[j + a] = b.scale[j + a] * factor;
    }
    out.rot.set(quatMul(q, Array.from(b.rot.subarray(k, k + 4))), k);
    out.color.set(b.color.subarray(k, k + 4), k);
  }
  return out;
}
