// MIT. Made by Ryan with Codex (GPT-6). A conservative multiview surface seed for short runs.
// Sparse geometry supplies local triangles; inverse-depth interpolation supplies candidate 3D
// positions. A second recorded camera must agree photometrically. This is an initialization
// prior, not a dense depth solve: training still fits the resulting Gaussians to the photographs.
import { frameQuat } from "./scene.js";

const dot = (a, b) => a.reduce((s, v, k) => s + v * b[k], 0);
const sub = (a, b) => a.map((v, k) => v - b[k]);
const cross = (a, b) => [
  a[1] * b[2] - a[2] * b[1],
  a[2] * b[0] - a[0] * b[2],
  a[0] * b[1] - a[1] * b[0],
];
const unit = (a) => {
  const n = Math.hypot(...a);
  return n > 1e-9 ? a.map((v) => v / n) : null;
};
const logit = (v) =>
  Math.log(Math.max(1e-4, Math.min(0.9999, v)) / Math.max(1e-4, 1 - Math.min(0.9999, v)));

// Back-project a circular image footprint onto the local plane. Equal world-space tangent
// scales become thin streaks on a sloped surface. The plane-intersection Jacobian supplies
// the two principal world axes and scales whose first-order image covariance is circular.
// Near-grazing planes need unbounded support; keep those uncertain seeds out of the model.
export function surfaceFootprint(camera, position, normal, sigmaPixels, maxStretch = 8) {
  const p = [0, 1, 2].map((k) => dot(camera.R.slice(k * 3, k * 3 + 3), position) + camera.t[k]),
    n = [0, 1, 2].map((k) => dot(camera.R.slice(k * 3, k * 3 + 3), normal));
  if (!(p[2] > 1e-6) || !(sigmaPixels > 0)) return null;
  const ray = p.map((v) => v / p[2]),
    denominator = dot(n, ray),
    fy = camera.fy ?? camera.f;
  if (Math.abs(denominator) < 1e-6) return null;
  const dzdu = (-p[2] * n[0]) / (camera.f * denominator),
    dzdv = (-p[2] * n[1]) / (fy * denominator),
    du = ray.map((v, k) => v * dzdu + (k === 0 ? p[2] / camera.f : 0)),
    dv = ray.map((v, k) => v * dzdv + (k === 1 ? p[2] / fy : 0)),
    world = (v) =>
      [0, 1, 2].map((k) => camera.R[k] * v[0] + camera.R[k + 3] * v[1] + camera.R[k + 6] * v[2]),
    a = world(du),
    b = world(dv),
    aa = dot(a, a),
    ab = dot(a, b),
    bb = dot(b, b),
    discriminant = Math.hypot(aa - bb, 2 * ab),
    large = Math.sqrt(Math.max(0, (aa + bb + discriminant) / 2)) * sigmaPixels,
    small = Math.sqrt(Math.max(0, (aa + bb - discriminant) / 2)) * sigmaPixels,
    reference = (p[2] / Math.sqrt(camera.f * fy)) * sigmaPixels;
  if (!(small > 1e-9) || !Number.isFinite(large) || large > reference * maxStretch) return null;
  const angle = Math.atan2(2 * ab, aa - bb) / 2,
    x = unit(a.map((v, k) => v * Math.cos(angle) + b[k] * Math.sin(angle))),
    y = unit(a.map((v, k) => -v * Math.sin(angle) + b[k] * Math.cos(angle))),
    z = x && y && unit(cross(x, y));
  if (!x || !y || !z) return null;
  return {
    scales: [large, small, small * 0.15],
    quat: frameQuat([0, 1, 2].map((k) => [x[k], y[k], z[k]])),
  };
}

function camerasAtTrainingScale(recon, frames) {
  return recon.cams.flatMap((c) => {
    const image = frames[c.imgIdx];
    if (!image?.rgb || image.rgb.length !== image.tw * image.th * 3 || !image.fw) return [];
    const scale = image.tw / image.fw;
    return [
      {
        ...c,
        image,
        f: c.f * scale,
        fy: (c.fy ?? c.f) * scale,
        cx: c.cx == null ? image.tw / 2 : c.cx * scale,
        cy: c.cy == null ? image.th / 2 : c.cy * scale,
      },
    ];
  });
}

function project(c, p) {
  const v = [0, 1, 2].map((k) => dot(c.R.slice(k * 3, k * 3 + 3), p) + c.t[k]);
  if (!(v[2] > 1e-6)) return null;
  const u = (c.f * v[0]) / v[2] + c.cx,
    y = (c.fy * v[1]) / v[2] + c.cy;
  return u >= 0.5 && y >= 0.5 && u < c.image.tw - 0.5 && y < c.image.th - 0.5 ? [u, y, v[2]] : null;
}

function sample(c, u, v) {
  const x = u - 0.5,
    y = v - 0.5,
    ix = Math.floor(x),
    iy = Math.floor(y);
  if (ix < 0 || iy < 0 || ix + 1 >= c.image.tw || iy + 1 >= c.image.th) return null;
  const dx = x - ix,
    dy = y - iy,
    rgb = c.image.rgb,
    width = c.image.tw;
  const out = [0, 0, 0];
  for (const [xx, yy, weight] of [
    [0, 0, (1 - dx) * (1 - dy)],
    [1, 0, dx * (1 - dy)],
    [0, 1, (1 - dx) * dy],
    [1, 1, dx * dy],
  ]) {
    const offset = ((iy + yy) * width + ix + xx) * 3;
    if (rgb[offset] < 0) return null; // outside the undistorted source
    for (let k = 0; k < 3; k++) out[k] += rgb[offset + k] * weight;
  }
  return out.every(Number.isFinite) ? out : null;
}

function triangleAt(nearest, u, v, maxEdge) {
  const n = Math.min(8, nearest.length);
  for (let a = 0; a < n - 2; a++)
    for (let b = a + 1; b < n - 1; b++)
      for (let c = b + 1; c < n; c++) {
        const points = [nearest[a], nearest[b], nearest[c]],
          [p, q, r] = points;
        if (Math.max(...points.map((p) => p.z)) > Math.min(...points.map((p) => p.z)) * 1.3)
          continue;
        if (
          Math.max(
            Math.hypot(p.u - q.u, p.v - q.v),
            Math.hypot(p.u - r.u, p.v - r.v),
            Math.hypot(q.u - r.u, q.v - r.v),
          ) > maxEdge
        )
          continue;
        const det = (q.v - r.v) * (p.u - r.u) + (r.u - q.u) * (p.v - r.v);
        if (Math.abs(det) < 2) continue;
        const x = ((q.v - r.v) * (u - r.u) + (r.u - q.u) * (v - r.v)) / det;
        const y = ((r.v - p.v) * (u - r.u) + (p.u - r.u) * (v - r.v)) / det;
        const z = 1 - x - y;
        if (Math.min(x, y, z) < -1e-5) continue;
        return { points, weights: [x, y, z] };
      }
  return null;
}

export function surfaceSeed(recon, frames, { maxPoints = 10000, stride = null } = {}) {
  const empty = { data: new Float32Array(0), n: 0, candidates: 0, supported: 0 };
  if (!(maxPoints > 0) || recon.points.length < 3) return empty;
  maxPoints = Math.floor(maxPoints);
  const cameras = camerasAtTrainingScale(recon, frames);
  if (cameras.length < 2) return empty;
  const selected = [
    ...new Set(
      Array.from({ length: Math.min(4, cameras.length) }, (_, i) =>
        Math.round((i * (cameras.length - 1)) / Math.max(1, Math.min(4, cameras.length) - 1)),
      ),
    ),
  ];
  const rows = [],
    seen = new Set();
  let candidates = 0,
    supported = 0,
    random = 777;
  const rng = () => (random = (1664525 * random + 1013904223) >>> 0) / 4294967296;
  for (const cameraIndex of selected) {
    const camera = cameras[cameraIndex],
      { tw: width, th: height } = camera.image;
    const step =
      stride ??
      Math.max(2, Math.ceil(Math.sqrt((width * height * selected.length) / (maxPoints * 2))));
    const cell = Math.max(4, Math.max(width, height) / 32),
      grid = new Map();
    for (
      let i = 0;
      i < recon.points.length;
      i += Math.max(1, Math.ceil(recon.points.length / 4000))
    ) {
      const point = recon.points[i],
        p = project(camera, point.X);
      if (!p || !point.X.every(Number.isFinite)) continue;
      const key = `${Math.floor(p[0] / cell)},${Math.floor(p[1] / cell)}`;
      if (!grid.has(key)) grid.set(key, []);
      grid.get(key).push({ u: p[0], v: p[1], z: p[2], X: point.X });
    }
    for (let v = step / 2 + 0.5; v < height - 1; v += step)
      for (let u = step / 2 + 0.5; u < width - 1; u += step) {
        const near = [],
          gx = Math.floor(u / cell),
          gy = Math.floor(v / cell);
        for (let y = -2; y <= 2; y++)
          for (let x = -2; x <= 2; x++)
            for (const point of grid.get(`${gx + x},${gy + y}`) || [])
              near.push({ ...point, distance: (point.u - u) ** 2 + (point.v - v) ** 2 });
        near.sort((a, b) => a.distance - b.distance);
        const triangle = triangleAt(near, u, v, Math.max(width, height) * 0.25);
        if (!triangle) continue;
        candidates++;
        const depth = 1 / triangle.weights.reduce((sum, w, i) => sum + w / triangle.points[i].z, 0);
        const local = [
          ((u - camera.cx) / camera.f) * depth - camera.t[0],
          ((v - camera.cy) / camera.fy) * depth - camera.t[1],
          depth - camera.t[2],
        ];
        const position = [0, 1, 2].map(
          (k) => camera.R[k] * local[0] + camera.R[k + 3] * local[1] + camera.R[k + 6] * local[2],
        );
        const color = sample(camera, u, v);
        if (!color) continue;
        let agreeing = null,
          best = Infinity;
        for (let i = 0; i < cameras.length; i++) {
          if (i === cameraIndex) continue;
          const p = project(cameras[i], position),
            other = p && sample(cameras[i], p[0], p[1]);
          if (!other) continue;
          const error = Math.sqrt(other.reduce((s, v, k) => s + (v - color[k]) ** 2, 0) / 3);
          if (error < best) {
            best = error;
            agreeing = other;
          }
        }
        if (best > 0.08 || !agreeing) continue;
        const canonical = project(cameras[0], position);
        const key =
          canonical &&
          `${Math.floor(canonical[0] / 2)},${Math.floor(canonical[1] / 2)},${Math.floor(Math.log(canonical[2]) * 50)}`;
        if (key && seen.has(key)) continue;
        if (key) seen.add(key);
        const [a, b, c] = triangle.points.map((p) => p.X);
        const normal = unit(cross(sub(b, a), sub(c, a)));
        if (!normal) continue;
        const footprint = surfaceFootprint(camera, position, normal, step * 0.35);
        if (!footprint) continue;
        const q = footprint.quat;
        const row = [
          ...position,
          ...footprint.scales.map(Math.log),
          q[3],
          q[0],
          q[1],
          q[2],
          ...color.map((v, k) => logit((v + agreeing[k]) / 2)),
          logit(0.8),
          0,
          0,
        ];
        if (!row.every(Number.isFinite)) continue;
        supported++;
        if (rows.length < maxPoints) rows.push(row);
        else {
          const index = Math.floor(rng() * supported);
          if (index < maxPoints) rows[index] = row;
        }
      }
  }
  return { data: Float32Array.from(rows.flat()), n: rows.length, candidates, supported };
}
