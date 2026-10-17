// Build-time, deterministic surface and occupancy comparisons in a shared frame.
import { silhouetteIoU } from "./refpack-metrics.mjs";

function surfacePoints(mesh, count = 1800) {
  if (!mesh.indices.length) {
    const n = mesh.positions.length / 3;
    return Array.from({ length: Math.min(n, count) }, (_, i) =>
      Array.from(
        mesh.positions.slice(
          Math.floor((i * n) / Math.min(n, count)) * 3,
          Math.floor((i * n) / Math.min(n, count)) * 3 + 3,
        ),
      ),
    );
  }
  const areas = [],
    triangles = [];
  let total = 0;
  for (let i = 0; i < mesh.indices.length; i += 3) {
    const [a, b, c] = Array.from(mesh.indices.slice(i, i + 3), (j) =>
      Array.from(mesh.positions.slice(j * 3, j * 3 + 3)),
    );
    const u = b.map((x, k) => x - a[k]),
      v = c.map((x, k) => x - a[k]);
    const area =
      Math.hypot(u[1] * v[2] - u[2] * v[1], u[2] * v[0] - u[0] * v[2], u[0] * v[1] - u[1] * v[0]) /
      2;
    if (!area) continue;
    total += area;
    areas.push(total);
    triangles.push([a, b, c]);
  }
  const out = [];
  for (let i = 0; i < count; i++) {
    const at = ((i + 0.5) / count) * total;
    let lo = 0,
      hi = areas.length - 1;
    while (lo < hi) {
      const mid = (lo + hi) >> 1;
      if (areas[mid] < at) lo = mid + 1;
      else hi = mid;
    }
    const [a, b, c] = triangles[lo],
      u = Math.sqrt(((i + 1) * 0.7548776662466927) % 1),
      v = ((i + 1) * 0.5698402909980532) % 1;
    out.push(a.map((x, k) => x * (1 - u) + b[k] * u * (1 - v) + c[k] * u * v));
  }
  return out;
}
export function chamfer(a, b) {
  const aa = surfacePoints(a),
    bb = surfacePoints(b);
  if (!aa.length || !bb.length) throw new Error("Cannot compare an empty surface.");
  const directed = (p, q) =>
    p.reduce((sum, x) => {
      let best = Infinity;
      for (const y of q)
        best = Math.min(best, (x[0] - y[0]) ** 2 + (x[1] - y[1]) ** 2 + (x[2] - y[2]) ** 2);
      return sum + Math.sqrt(best);
    }, 0) / p.length;
  return (directed(aa, bb) + directed(bb, aa)) / 2;
}
// Ray parity at voxel centers, three axes with majority vote. The union AABB
// defines the grid. Open/nonmanifold scans remain approximate; report that.
export function occupancy(mesh, bounds, resolution = 40) {
  if (!mesh.indices.length) return null;
  const votes = new Uint8Array(resolution ** 3),
    N = resolution;
  for (let axis = 0; axis < 3; axis++) {
    const u = (axis + 1) % 3,
      v = (axis + 2) % 3,
      rays = Array.from({ length: N * N }, () => []);
    const step = bounds.max.map((x, k) => (x - bounds.min[k]) / N);
    for (let t = 0; t < mesh.indices.length; t += 3) {
      const p = Array.from(mesh.indices.slice(t, t + 3), (i) =>
        mesh.positions.slice(i * 3, i * 3 + 3),
      );
      const d =
        (p[1][v] - p[2][v]) * (p[0][u] - p[2][u]) + (p[2][u] - p[1][u]) * (p[0][v] - p[2][v]);
      if (Math.abs(d) < 1e-12) continue;
      const low = (k) =>
        Math.max(0, Math.floor((Math.min(...p.map((q) => q[k])) - bounds.min[k]) / step[k]));
      const high = (k) =>
        Math.min(N - 1, Math.floor((Math.max(...p.map((q) => q[k])) - bounds.min[k]) / step[k]));
      for (let j = low(v); j <= high(v); j++)
        for (let i = low(u); i <= high(u); i++) {
          const x = bounds.min[u] + (i + 0.5) * step[u],
            y = bounds.min[v] + (j + 0.5) * step[v];
          const a = ((p[1][v] - p[2][v]) * (x - p[2][u]) + (p[2][u] - p[1][u]) * (y - p[2][v])) / d;
          const b = ((p[2][v] - p[0][v]) * (x - p[2][u]) + (p[0][u] - p[2][u]) * (y - p[2][v])) / d,
            c = 1 - a - b;
          if (Math.min(a, b, c) >= -1e-8)
            rays[j * N + i].push(a * p[0][axis] + b * p[1][axis] + c * p[2][axis]);
        }
    }
    for (let j = 0; j < N; j++)
      for (let i = 0; i < N; i++) {
        const sorted = rays[j * N + i].sort((a, b) => a - b),
          hits = sorted.filter((x, k) => !k || x - sorted[k - 1] > 1e-6);
        for (let k = 0; k < N; k++) {
          const x = bounds.min[axis] + (k + 0.5) * step[axis];
          let n = 0;
          for (const hit of hits) if (hit < x) n++;
          if (n % 2) {
            const p = [];
            p[u] = i;
            p[v] = j;
            p[axis] = k;
            votes[(p[2] * N + p[1]) * N + p[0]]++;
          }
        }
      }
  }
  return Uint8Array.from(votes, (v) => +(v >= 2));
}
export function compare3d(result, truth, resolution = 40) {
  const bounds = { min: [Infinity, Infinity, Infinity], max: [-Infinity, -Infinity, -Infinity] };
  for (const mesh of [result, truth])
    for (let i = 0; i < mesh.positions.length; i++) {
      bounds.min[i % 3] = Math.min(bounds.min[i % 3], mesh.positions[i]);
      bounds.max[i % 3] = Math.max(bounds.max[i % 3], mesh.positions[i]);
    }
  for (let k = 0; k < 3; k++) {
    const pad = Math.max(0.01, (bounds.max[k] - bounds.min[k]) * 0.02);
    bounds.min[k] -= pad;
    bounds.max[k] += pad;
  }
  const a = occupancy(result, bounds, resolution),
    b = occupancy(truth, bounds, resolution);
  const distance = chamfer(result, truth);
  const diag = Math.hypot(...bounds.max.map((x, k) => x - bounds.min[k]));
  return {
    chamferDistance: distance,
    chamferNormalized: distance / diag,
    volumeIoU: a && b ? silhouetteIoU(a, b) : null,
    voxelResolution: resolution,
    bounds,
    alignment: "shared coordinates; no ICP or truth camera fitting",
    note:
      a && b
        ? "Three-axis ray parity; approximate for open or nonmanifold meshes."
        : "Volume is unavailable for a PLY-only point cloud; provide result.glb for volume IoU.",
  };
}
