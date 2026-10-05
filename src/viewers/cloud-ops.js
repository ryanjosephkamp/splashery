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

// Shaded relief for the drawn points, so a surface of flat-colored dots reads as a shape (the
// eye-dome and hillshade shading point-cloud viewers use). The highest point in each cell of a
// plan-view grid makes a height map; each point is lit by the slope there (light from the
// northwest and above), and points well below their cell's top (under a canopy, at a wall's foot)
// are darkened a little. Returns a factor (about 0.45 to 1.1) per point of idx.
export function reliefShade(c, idx, { up = "z", cell } = {}) {
  const n = idx.length;
  const out = new Float32Array(n).fill(1);
  if (!n || !(cell > 0)) return out;
  const [ax, ay, az] = up === "y" ? [c.x, c.z, c.y] : [c.x, c.y, c.z];
  let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity; // prettier-ignore
  for (let j = 0; j < n; j++) {
    const i = idx[j];
    if (ax[i] < x0) x0 = ax[i];
    if (ax[i] > x1) x1 = ax[i];
    if (ay[i] < y0) y0 = ay[i];
    if (ay[i] > y1) y1 = ay[i];
  }
  let s = cell;
  let nx = Math.floor((x1 - x0) / s) + 1;
  let ny = Math.floor((y1 - y0) / s) + 1;
  while (nx * ny > 4e6) {
    s *= 1.5;
    nx = Math.floor((x1 - x0) / s) + 1;
    ny = Math.floor((y1 - y0) / s) + 1;
  }
  const top = new Float32Array(nx * ny).fill(-Infinity);
  const cellOf = new Uint32Array(n);
  for (let j = 0; j < n; j++) {
    const i = idx[j];
    const k = Math.floor((ay[i] - y0) / s) * nx + Math.floor((ax[i] - x0) / s);
    cellOf[j] = k;
    if (az[i] > top[k]) top[k] = az[i];
  }
  // Fill empty cells from their neighbors (a few rounds), so slopes at gaps stay calm.
  for (let round = 0; round < 3; round++)
    for (let y = 0; y < ny; y++)
      for (let x = 0; x < nx; x++) {
        const k = y * nx + x;
        if (top[k] !== -Infinity) continue;
        let sum = 0;
        let cnt = 0;
        for (const [dx, dy] of [
          [1, 0],
          [-1, 0],
          [0, 1],
          [0, -1],
        ]) {
          const xx = x + dx, yy = y + dy; // prettier-ignore
          if (xx < 0 || yy < 0 || xx >= nx || yy >= ny) continue;
          const v = top[yy * nx + xx];
          if (v !== -Infinity) {
            sum += v;
            cnt++;
          }
        }
        if (cnt) top[k] = sum / cnt - 1e-6; // marked as filled, not measured
      }
  const at = (x, y) => {
    const v = top[Math.min(ny - 1, Math.max(0, y)) * nx + Math.min(nx - 1, Math.max(0, x))];
    return v === -Infinity ? 0 : v;
  };
  // Light from the northwest (-x, +y in plan) and 50 degrees up.
  const L = [-0.45, 0.45, 0.77];
  const shadeOf = new Float32Array(nx * ny);
  for (let y = 0; y < ny; y++)
    for (let x = 0; x < nx; x++) {
      const gx = (at(x + 1, y) - at(x - 1, y)) / (2 * s);
      const gy = (at(x, y + 1) - at(x, y - 1)) / (2 * s);
      const len = Math.hypot(gx, gy, 1);
      const lambert = (-gx * L[0] - gy * L[1] + L[2]) / len;
      shadeOf[y * nx + x] = 0.5 + 0.6 * Math.max(0, lambert);
    }
  for (let j = 0; j < n; j++) {
    const k = cellOf[j];
    const below = top[k] - az[idx[j]];
    const under = below > 2 * s ? Math.max(0.75, 1 - (below / (12 * s)) * 0.25) : 1;
    out[j] = shadeOf[k] * under;
  }
  return out;
}
