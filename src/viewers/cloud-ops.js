// Lane Viewers: what the Point clouds toy does to a cloud (src/viewers/cloud-io.js): its stats,
// colors (height, intensity, classification, the file's own), crop, thin, and the nearest point to
// a tap for measuring. Plain JavaScript (the worker, the browser and the Node tests).

import { CLASS_NAMES, cloudBounds, cloudBytes } from "./cloud-io.js";
import { buildGrid, evenShare } from "./splat-ops.js";

export { evenShare };

export function cloudStats(c, fileBytes = 0) {
  const b = cloudBounds(c);
  const classes = {};
  if (c.cls) for (let i = 0; i < c.count; i++) classes[c.cls[i]] = (classes[c.cls[i]] || 0) + 1;
  const area = Math.max(1e-9, b.size[0] * b.size[1]);
  return {
    count: c.count,
    bounds: b,
    origin: c.origin,
    fileBytes,
    memory: cloudBytes(c),
    has: { intensity: !!c.intensity, cls: !!c.cls, color: !!c.r },
    classes,
    density: c.count / area, // points per square unit, seen from above
    format: c.format,
    info: c.info,
  };
}

// The classification colors: ground brown, vegetation greens, buildings red, water blue...
export const CLASS_COLORS = {
  0: [0.62, 0.62, 0.62],
  1: [0.75, 0.75, 0.72],
  2: [0.6, 0.45, 0.28],
  3: [0.62, 0.8, 0.38],
  4: [0.35, 0.66, 0.27],
  5: [0.13, 0.48, 0.18],
  6: [0.86, 0.3, 0.24],
  7: [0.95, 0.2, 0.75],
  8: [0.95, 0.85, 0.2],
  9: [0.2, 0.45, 0.9],
  10: [0.45, 0.35, 0.35],
  11: [0.35, 0.35, 0.38],
  12: [0.8, 0.8, 0.5],
  13: [0.95, 0.75, 0.2],
  14: [1, 0.6, 0.1],
  15: [0.85, 0.85, 0.9],
  16: [1, 0.5, 0.3],
  17: [0.6, 0.55, 0.75],
  18: [0.95, 0.2, 0.75],
  19: [0.55, 0.4, 0.6],
  20: [0.5, 0.4, 0.3],
  21: [0.95, 0.97, 1],
  22: [0.4, 0.4, 0.4],
};
const classColor = (k) => CLASS_COLORS[k] || [((k * 97) % 255) / 255, ((k * 57) % 255) / 255, ((k * 31) % 255) / 255]; // prettier-ignore

// A height ramp from deep blue through green and yellow to white (a hypsometric scale).
const HEIGHT_RAMP = [
  [0, [0.12, 0.22, 0.55]],
  [0.2, [0.1, 0.55, 0.65]],
  [0.4, [0.3, 0.7, 0.3]],
  [0.6, [0.85, 0.82, 0.3]],
  [0.8, [0.75, 0.45, 0.25]],
  [1, [0.97, 0.96, 0.95]],
];
export function heightColor(t) {
  const x = t < 0 ? 0 : t > 1 ? 1 : t;
  for (let i = 1; i < HEIGHT_RAMP.length; i++) {
    const [b, cb] = HEIGHT_RAMP[i];
    if (x <= b) {
      const [a, ca] = HEIGHT_RAMP[i - 1];
      const f = (x - a) / (b - a);
      return [0, 1, 2].map((k) => ca[k] + (cb[k] - ca[k]) * f);
    }
  }
  return HEIGHT_RAMP[HEIGHT_RAMP.length - 1][1];
}

// The q and 1 - q quantiles of a typed array (sampled).
function quantiles(a, idx, q) {
  const n = idx.length;
  const m = Math.min(n, 100000);
  const s = new Float32Array(m);
  for (let j = 0; j < m; j++) s[j] = a[idx[Math.floor((j * n) / m)]];
  s.sort();
  return [s[Math.floor(q * (m - 1))] ?? 0, s[Math.ceil((1 - q) * (m - 1))] ?? 1];
}

// Which coordinate is up: "z" (lidar, survey) or "y".
export const upAxis = (up) => (up === "y" ? 1 : 2);

// Colors (0..1, three a point) for the points at idx. mode: "height", "intensity", "class",
// "rgb" (the file's own; height when it has none). range: the height range to stretch over.
export function cloudColors(c, idx, mode, { up = "z", range = null } = {}) {
  const n = idx.length;
  const col = new Float32Array(n * 3);
  let m = mode;
  if (m === "rgb" && !c.r) m = "height";
  if (m === "intensity" && !c.intensity) m = "height";
  if (m === "class" && !c.cls) m = "height";
  if (m === "rgb") {
    for (let j = 0; j < n; j++) {
      const i = idx[j];
      col[j * 3] = c.r[i] / 255;
      col[j * 3 + 1] = c.g[i] / 255;
      col[j * 3 + 2] = c.b[i] / 255;
    }
  } else if (m === "intensity") {
    const [lo, hi] = quantiles(c.intensity, idx, 0.02);
    const span = hi - lo || 1;
    for (let j = 0; j < n; j++) {
      const v = Math.min(1, Math.max(0, (c.intensity[idx[j]] - lo) / span));
      const g = 0.08 + 0.9 * Math.sqrt(v);
      col[j * 3] = col[j * 3 + 1] = col[j * 3 + 2] = g;
    }
  } else if (m === "class") {
    for (let j = 0; j < n; j++) {
      const k = classColor(c.cls[idx[j]]);
      col[j * 3] = k[0];
      col[j * 3 + 1] = k[1];
      col[j * 3 + 2] = k[2];
    }
  } else {
    const h = up === "y" ? c.y : c.z;
    const [lo, hi] = range || quantiles(h, idx, 0.005);
    const span = hi - lo || 1;
    for (let j = 0; j < n; j++) {
      const k = heightColor((h[idx[j]] - lo) / span);
      col[j * 3] = k[0];
      col[j * 3 + 1] = k[1];
      col[j * 3 + 2] = k[2];
    }
  }
  return { col, mode: m };
}

export function cropCloud(c, box, { invert = false, from = null } = {}) {
  const n = from ? from.length : c.count;
  const out = new Uint32Array(n);
  let k = 0;
  for (let j = 0; j < n; j++) {
    const i = from ? from[j] : j;
    const x = c.x[i], y = c.y[i], z = c.z[i]; // prettier-ignore
    const inside = x >= box.min[0] && x <= box.max[0] && y >= box.min[1] && y <= box.max[1] && z >= box.min[2] && z <= box.max[2]; // prettier-ignore
    if (inside !== invert) out[k++] = i;
  }
  return out.slice(0, k);
}

// Thins to one point per cube of `spacing` (the point nearest each cube's middle survives, so the
// result is even, not random).
export function thinCloud(c, idx, spacing) {
  if (!(spacing > 0) || !idx.length) return idx;
  const g = buildGrid(c.x, c.y, c.z, idx, spacing, 1 << 26);
  const s = g.size;
  const out = [];
  for (let cell = 0; cell + 1 < g.start.length; cell++) {
    const a = g.start[cell];
    const b = g.start[cell + 1];
    if (a === b) continue;
    if (b - a === 1) {
      out.push(g.order[a]);
      continue;
    }
    const cz = Math.floor(cell / (g.nx * g.ny));
    const cy = Math.floor(cell / g.nx) % g.ny;
    const cx = cell % g.nx;
    const mx = g.min[0] + (cx + 0.5) * s;
    const my = g.min[1] + (cy + 0.5) * s;
    const mz = g.min[2] + (cz + 0.5) * s;
    let best = g.order[a];
    let bd = Infinity;
    for (let p = a; p < b; p++) {
      const i = g.order[p];
      const d = (c.x[i] - mx) ** 2 + (c.y[i] - my) ** 2 + (c.z[i] - mz) ** 2;
      if (d < bd) {
        bd = d;
        best = i;
      }
    }
    out.push(best);
  }
  return Uint32Array.from(out).sort();
}

// The point of idx nearest to p (in the cloud's relative coordinates).
export function nearestPoint(c, idx, p) {
  let best = -1;
  let bd = Infinity;
  for (let j = 0; j < idx.length; j++) {
    const i = idx[j];
    const d = (c.x[i] - p[0]) ** 2 + (c.y[i] - p[1]) ** 2 + (c.z[i] - p[2]) ** 2;
    if (d < bd) {
      bd = d;
      best = i;
    }
  }
  return best < 0
    ? null
    : { index: best, p: [c.x[best], c.y[best], c.z[best]], dist: Math.sqrt(bd) };
}

// A distance between two points (relative coordinates): straight, along the ground, and up.
export function measure(a, b, up = "z") {
  const d = [b[0] - a[0], b[1] - a[1], b[2] - a[2]];
  const u = up === "y" ? 1 : 2;
  const flat = Math.hypot(...d.filter((_, k) => k !== u));
  return { straight: Math.hypot(...d), flat, rise: d[u] };
}

// An even spacing to thin to, from a share of the cloud's typical spacing (seen from above).
export function typicalSpacing(c) {
  const b = cloudBounds(c);
  const area = Math.max(1e-9, b.size[0] * b.size[1] || b.size[0] * b.size[2] || 1);
  return Math.sqrt(area / Math.max(1, c.count));
}

export function runCloudPipeline(c, s) {
  let idx = Uint32Array.from({ length: c.count }, (_, i) => i);
  let cropped = 0;
  if (s.crop) {
    const before = idx.length;
    idx = cropCloud(c, s.crop, { invert: !!s.crop.invert });
    cropped = before - idx.length;
  }
  const beforeThin = idx.length;
  if (s.spacing > 0) idx = thinCloud(c, idx, s.spacing);
  return { keep: idx, cropped, thinned: beforeThin - idx.length };
}

export { CLASS_NAMES };
