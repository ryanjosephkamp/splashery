// Lane Viewers: what the Splat toolkit does to a splat table (src/viewers/splat-io.js): its stats,
// crop with a box, remove floaters, shrink to a count, and a preview for the toy to draw. Plain
// JavaScript (the worker, the browser and the Node tests).

import { SH_COEFFS, FIELDS, boundsOf, tableBytes } from "./splat-io.js";

const sigmoid = (v) => 1 / (1 + Math.exp(-v));
export const fmtCount = (n) => Math.round(n).toLocaleString("en-US");

// Bounds of the middle of the splats: from the `q` to the 1 - `q` quantile on each axis (floaters
// far out don't stretch them). Sampled on large tables.
export function robustBounds(t, q = 0.01, idx = null) {
  const n = idx ? idx.length : t.count;
  if (!n) return { min: [0, 0, 0], max: [0, 0, 0], size: [0, 0, 0] };
  const m = Math.min(n, 100000);
  const step = n / m;
  const min = [];
  const max = [];
  for (const a of [t.x, t.y, t.z]) {
    const s = new Float32Array(m);
    for (let j = 0; j < m; j++) s[j] = a[idx ? idx[Math.floor(j * step)] : Math.floor(j * step)];
    s.sort();
    min.push(s[Math.floor(q * (m - 1))]);
    max.push(s[Math.ceil((1 - q) * (m - 1))]);
  }
  return { min, max, size: [0, 1, 2].map((k) => max[k] - min[k]) };
}

export function splatStats(t, fileBytes = 0) {
  const b = boundsOf(t);
  let op = 0;
  const m = Math.min(t.count, 200000);
  const step = t.count / Math.max(1, m);
  const sizes = new Float32Array(m);
  for (let j = 0; j < m; j++) {
    const i = Math.floor(j * step);
    op += sigmoid(t.opacity[i]);
    sizes[j] = Math.exp(Math.max(t.s0[i], t.s1[i], t.s2[i]));
  }
  sizes.sort();
  return {
    count: t.count,
    shDegree: t.shDegree,
    bounds: b,
    core: robustBounds(t),
    fileBytes,
    memory: tableBytes(t),
    meanOpacity: m ? op / m : 0,
    medianSize: m ? sizes[m >> 1] : 0,
    format: t.format || "",
    compressed: !!t.compressed,
  };
}

// The indices inside the box ({ min, max } in the file's units); `invert` keeps those outside.
export function cropIndex(t, box, { invert = false, from = null } = {}) {
  const n = from ? from.length : t.count;
  const out = new Uint32Array(n);
  let k = 0;
  const [x0, y0, z0] = box.min;
  const [x1, y1, z1] = box.max;
  for (let j = 0; j < n; j++) {
    const i = from ? from[j] : j;
    const x = t.x[i], y = t.y[i], z = t.z[i]; // prettier-ignore
    const inside = x >= x0 && x <= x1 && y >= y0 && y <= y1 && z >= z0 && z <= z1;
    if (inside !== invert) out[k++] = i;
  }
  return out.slice(0, k);
}

// A uniform grid over points (x, y, z arrays at `idx`) for neighbor searches: cells of `size`,
// points sorted by cell. Returns { size, nx, ny, nz, min, start, order } where the points of cell
// c are order[start[c] .. start[c + 1]).
export function buildGrid(xs, ys, zs, idx, size, maxCells = 1 << 23) {
  const n = idx.length;
  const min = [Infinity, Infinity, Infinity];
  const max = [-Infinity, -Infinity, -Infinity];
  for (let j = 0; j < n; j++) {
    const i = idx[j];
    const p = [xs[i], ys[i], zs[i]];
    for (let k = 0; k < 3; k++) {
      if (p[k] < min[k]) min[k] = p[k];
      if (p[k] > max[k]) max[k] = p[k];
    }
  }
  let s = size;
  let dims;
  for (;;) {
    dims = [0, 1, 2].map((k) => Math.max(1, Math.floor((max[k] - min[k]) / s) + 1));
    if (dims[0] * dims[1] * dims[2] <= maxCells) break;
    s *= 1.5;
  }
  const [nx, ny, nz] = dims;
  const cellOf = new Uint32Array(n);
  const counts = new Uint32Array(nx * ny * nz + 1);
  for (let j = 0; j < n; j++) {
    const i = idx[j];
    const cx = Math.min(nx - 1, Math.floor((xs[i] - min[0]) / s));
    const cy = Math.min(ny - 1, Math.floor((ys[i] - min[1]) / s));
    const cz = Math.min(nz - 1, Math.floor((zs[i] - min[2]) / s));
    const c = (cz * ny + cy) * nx + cx;
    cellOf[j] = c;
    counts[c + 1]++;
  }
  for (let c = 1; c < counts.length; c++) counts[c] += counts[c - 1];
  const start = counts.slice();
  const fill = counts.slice();
  const order = new Uint32Array(n);
  for (let j = 0; j < n; j++) order[fill[cellOf[j]]++] = idx[j];
  return { size: s, nx, ny, nz, min, start, order };
}

// The statistical outlier filter. For each splat, the mean distance to its k nearest neighbors
// (searched in the 27 grid cells around it; neighbors not found there count as two cells away).
// Splats whose mean is more than `strength` standard deviations above the average are floaters.
// Returns { keep, removed, mean, std, threshold } (index lists into the table).
export function floaterFilter(t, idx, { k = 8, strength = 2, onProgress } = {}) {
  const n = idx.length;
  if (n < k + 2) return { keep: idx, removed: new Uint32Array(0), mean: 0, std: 0, threshold: 0 };
  // Cells holding about k/3 splats each where there are splats (scenes are mostly surfaces).
  const core = robustBounds(t, 0.02, idx);
  const vol = Math.max(1e-12, core.size[0] * core.size[1] * core.size[2]);
  let g = buildGrid(t.x, t.y, t.z, idx, Math.cbrt(vol / n) * 3);
  for (let round = 0; round < 4; round++) {
    let filled = 0;
    for (let c = 0; c + 1 < g.start.length; c++) if (g.start[c + 1] > g.start[c]) filled++;
    const occ = n / Math.max(1, filled);
    if (occ < k * 0.6 && round > 0) break;
    if (Math.abs(Math.log(occ / (k / 3))) < 0.5) break;
    g = buildGrid(t.x, t.y, t.z, idx, g.size * Math.pow(k / 3 / occ, 1 / 2.2));
  }
  const dist = new Float32Array(n);
  const best = new Float32Array(k);
  const step = Math.max(1, n >> 6);
  const { nx, ny, nz, start, order, min, size } = g;
  const scan = (x, y, z, i, cx, cy, cz, r) => {
    for (let dz = -r; dz <= r; dz++) {
      const zz = cz + dz;
      if (zz < 0 || zz >= nz) continue;
      for (let dy = -r; dy <= r; dy++) {
        const yy = cy + dy;
        if (yy < 0 || yy >= ny) continue;
        for (let dx = -r; dx <= r; dx++) {
          // Ring r only (the inner cells were searched already).
          if (r > 1 && Math.abs(dx) < r && Math.abs(dy) < r && Math.abs(dz) < r) continue;
          const xx = cx + dx;
          if (xx < 0 || xx >= nx) continue;
          const c = (zz * ny + yy) * nx + xx;
          for (let p = start[c]; p < start[c + 1]; p++) {
            const o = order[p];
            if (o === i) continue;
            const ex = t.x[o] - x, ey = t.y[o] - y, ez = t.z[o] - z; // prettier-ignore
            const d2 = ex * ex + ey * ey + ez * ez;
            if (d2 >= best[k - 1]) continue;
            let q = k - 1;
            while (q > 0 && best[q - 1] > d2) {
              best[q] = best[q - 1];
              q--;
            }
            best[q] = d2;
          }
        }
      }
    }
  };
  for (let j = 0; j < n; j++) {
    const i = idx[j];
    const x = t.x[i], y = t.y[i], z = t.z[i]; // prettier-ignore
    best.fill(Infinity);
    const cx = Math.min(nx - 1, Math.floor((x - min[0]) / size));
    const cy = Math.min(ny - 1, Math.floor((y - min[1]) / size));
    const cz = Math.min(nz - 1, Math.floor((z - min[2]) / size));
    scan(x, y, z, i, cx, cy, cz, 1);
    // Not enough neighbors within a cell: look one and two rings further. Past that a splat
    // counts its missing neighbors as three cells away (it is far from everything).
    for (let r = 2; r <= 3 && best[k - 1] > (size * (r - 1)) ** 2; r++) scan(x, y, z, i, cx, cy, cz, r); // prettier-ignore
    const far2 = (size * 3) ** 2;
    let s = 0;
    for (let q = 0; q < k; q++) s += Math.sqrt(Math.min(best[q], far2));
    dist[j] = s / k;
    if (onProgress && j % step === 0) onProgress(j / n);
  }
  let mean = 0;
  for (let j = 0; j < n; j++) mean += dist[j];
  mean /= n;
  let v = 0;
  for (let j = 0; j < n; j++) v += (dist[j] - mean) ** 2;
  const std = Math.sqrt(v / n);
  const threshold = mean + strength * std;
  const keep = new Uint32Array(n);
  const removed = new Uint32Array(n);
  let a = 0;
  let b = 0;
  for (let j = 0; j < n; j++) {
    if (dist[j] > threshold) removed[b++] = idx[j];
    else keep[a++] = idx[j];
  }
  return { keep: keep.slice(0, a), removed: removed.slice(0, b), mean, std, threshold };
}

// Splats too faint to see (opacity under `min`).
export function faintFilter(t, idx, min = 0.02) {
  const lo = Math.log(min / (1 - min));
  const keep = [];
  const removed = [];
  for (const i of idx) (t.opacity[i] < lo ? removed : keep).push(i);
  return { keep: Uint32Array.from(keep), removed: Uint32Array.from(removed) };
}

// How much a splat shows: its opacity times its area (the two largest axes).
function importance(t, i) {
  const a = t.s0[i], b = t.s1[i], c = t.s2[i]; // prettier-ignore
  const lo = Math.min(a, b, c);
  return Math.log(sigmoid(t.opacity[i]) + 1e-6) + (a + b + c - lo);
}

// Shrink to `target` splats: keeps the ones that show most (opacity times area), spread over the
// scene (each cell of a coarse grid keeps its share, so small detailed places aren't emptied for
// big soft ones elsewhere).
export function decimateIndex(t, idx, target) {
  const n = idx.length;
  if (target >= n) return idx;
  if (target <= 0) return new Uint32Array(0);
  const core = robustBounds(t, 0.01, idx);
  const cells = Math.max(1, Math.min(4096, Math.round(target / 64)));
  const vol = Math.max(1e-12, core.size[0] * core.size[1] * core.size[2]);
  const g = buildGrid(t.x, t.y, t.z, idx, Math.cbrt(vol / cells));
  const keep = new Uint32Array(target);
  let k = 0;
  const frac = target / n;
  let carry = 0;
  const score = new Float32Array(t.count);
  for (let j = 0; j < n; j++) score[idx[j]] = importance(t, idx[j]);
  for (let c = 0; c + 1 < g.start.length; c++) {
    const a = g.start[c];
    const b = g.start[c + 1];
    if (a === b) continue;
    const want = (b - a) * frac + carry;
    const take = Math.min(b - a, Math.floor(want));
    carry = want - take;
    if (!take) continue;
    const list = g.order.slice(a, b);
    if (take < list.length) list.sort((p, q) => score[q] - score[p]);
    for (let j = 0; j < take && k < target; j++) keep[k++] = list[j];
  }
  return keep.slice(0, k).sort();
}

// The whole pipeline: crop, then floaters (and faint splats), then shrink. `s` (settings):
// { crop: { min, max, invert } | null, floaters: { k, strength } | null, faint: 0..1 | 0,
//   target: count | 0 }. Returns { keep, removed, cropped, floater } with index lists.
export function runPipeline(t, s, onProgress) {
  let idx = Uint32Array.from({ length: t.count }, (_, i) => i);
  let cropped = 0;
  if (s.crop) {
    const before = idx.length;
    idx = cropIndex(t, s.crop, { invert: !!s.crop.invert });
    cropped = before - idx.length;
  }
  let removed = [];
  let floater = null;
  if (s.faint) {
    const f = faintFilter(t, idx, s.faint);
    idx = f.keep;
    removed.push(f.removed);
  }
  if (s.floaters) {
    floater = floaterFilter(t, idx, { ...s.floaters, onProgress });
    idx = floater.keep;
    removed.push(floater.removed);
  }
  const total = removed.reduce((a, r) => a + r.length, 0);
  const rem = new Uint32Array(total);
  let o = 0;
  for (const r of removed) {
    rem.set(r, o);
    o += r.length;
  }
  if (s.target && s.target < idx.length) idx = decimateIndex(t, idx, s.target);
  return {
    keep: idx,
    removed: rem,
    cropped,
    floater: floater && { mean: floater.mean, std: floater.std, threshold: floater.threshold },
  };
}

// An even, stable share of `idx` (at most `max`): a fixed scatter so a preview doesn't flicker
// as settings change.
export function evenShare(idx, max, seed = 1) {
  const n = idx.length;
  if (n <= max) return idx;
  const out = new Uint32Array(max);
  let s = seed >>> 0 || 1;
  const step = n / max;
  for (let j = 0; j < max; j++) {
    s = (Math.imul(s, 1664525) + 1013904223) >>> 0;
    const at = Math.min(n - 1, Math.floor((j + s / 4294967296) * step));
    out[j] = idx[at];
  }
  return out;
}

// What the toy draws: positions, linear sizes, rotations (x, y, z, w), base colors 0..1 and
// opacities 0..1 for the splats at idx. `tint` mixes a color in (the removed floaters in red).
export function previewArrays(t, idx, tint = null) {
  const n = idx.length;
  const pos = new Float32Array(n * 3);
  const scl = new Float32Array(n * 3);
  const quat = new Float32Array(n * 4);
  const col = new Float32Array(n * 3);
  const op = new Float32Array(n);
  const C0 = 0.28209479177387814;
  const cl = (v) => (v < 0 ? 0 : v > 1 ? 1 : v);
  for (let j = 0; j < n; j++) {
    const i = idx[j];
    pos[j * 3] = t.x[i];
    pos[j * 3 + 1] = t.y[i];
    pos[j * 3 + 2] = t.z[i];
    scl[j * 3] = Math.exp(t.s0[i]);
    scl[j * 3 + 1] = Math.exp(t.s1[i]);
    scl[j * 3 + 2] = Math.exp(t.s2[i]);
    quat[j * 4] = t.qx[i];
    quat[j * 4 + 1] = t.qy[i];
    quat[j * 4 + 2] = t.qz[i];
    quat[j * 4 + 3] = t.qw[i];
    let r = cl(0.5 + C0 * t.r[i]);
    let g = cl(0.5 + C0 * t.g[i]);
    let b = cl(0.5 + C0 * t.b[i]);
    let o = sigmoid(t.opacity[i]);
    if (tint) {
      r = r * 0.25 + tint[0] * 0.75;
      g = g * 0.25 + tint[1] * 0.75;
      b = b * 0.25 + tint[2] * 0.75;
      o = Math.max(o, 0.6);
    }
    col[j * 3] = r;
    col[j * 3 + 1] = g;
    col[j * 3 + 2] = b;
    op[j] = o;
  }
  return { count: n, pos, scl, quat, col, op };
}

export { FIELDS, SH_COEFFS };
