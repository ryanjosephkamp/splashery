// Pure spherical reconstruction. Radial depth is positive distance, never disparity.
// +Y is up, +Z is the initial view, and -X is screen right for the existing
// inside camera; u=0/1 is behind the viewer.
const TAU = Math.PI * 2;
const TAN = Math.tan((110 * Math.PI) / 360);
const dot = (a, b) => a.reduce((s, v, i) => s + v * b[i], 0);
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
export const median = (a) => {
  const b = Array.from(a)
    .filter(Number.isFinite)
    .sort((x, y) => x - y);
  return b.length ? b[Math.floor(b.length / 2)] : 0;
};
export const TILES = [
  { forward: [0, 0, 1], right: [-1, 0, 0], up: [0, 1, 0] },
  { forward: [1, 0, 0], right: [0, 0, 1], up: [0, 1, 0] },
  { forward: [0, 0, -1], right: [1, 0, 0], up: [0, 1, 0] },
  { forward: [-1, 0, 0], right: [0, 0, -1], up: [0, 1, 0] },
  { forward: [0, 1, 0], right: [-1, 0, 0], up: [0, 0, -1] },
  { forward: [0, -1, 0], right: [-1, 0, 0], up: [0, 0, 1] },
];
export function direction(u, v) {
  const lon = ((((u % 1) + 1) % 1) - 0.5) * TAU;
  const lat = (0.5 - v) * Math.PI;
  return [-Math.sin(lon) * Math.cos(lat), Math.sin(lat), Math.cos(lon) * Math.cos(lat)];
}
export function coordinates(ray) {
  return [Math.atan2(-ray[0], ray[2]) / TAU + 0.5, 0.5 - Math.asin(clamp(ray[1], -1, 1)) / Math.PI];
}
export function tileRay(u, v, tile) {
  const x = (2 * u - 1) * TAN,
    y = (1 - 2 * v) * TAN;
  const n = Math.hypot(x, y, 1);
  return {
    ray: tile.forward.map((f, i) => (f + x * tile.right[i] + y * tile.up[i]) / n),
    cosine: 1 / n,
  };
}
export function project(ray, tile) {
  const cosine = dot(ray, tile.forward);
  if (cosine <= 0) return null;
  const x = dot(ray, tile.right) / (cosine * TAN),
    y = dot(ray, tile.up) / (cosine * TAN);
  if (Math.max(Math.abs(x), Math.abs(y)) >= 1) return null;
  return {
    u: (x + 1) / 2,
    v: (1 - y) / 2,
    cosine,
    weight: Math.max(1e-8, (1 - x * x) * (1 - y * y)) ** 2,
  };
}
export function sample(data, w, h, u, v, channels = 1, channel = 0, wrap = true) {
  const x = u * w - 0.5,
    y = clamp(v * h - 0.5, 0, h - 1);
  const x0 = Math.floor(x),
    y0 = Math.floor(y),
    tx = x - x0,
    ty = y - y0;
  const get = (xx, yy) =>
    data[
      (Math.min(h - 1, yy) * w + (wrap ? ((xx % w) + w) % w : clamp(xx, 0, w - 1))) * channels +
        channel
    ];
  return (
    (get(x0, y0) * (1 - tx) + get(x0 + 1, y0) * tx) * (1 - ty) +
    (get(x0, y0 + 1) * (1 - tx) + get(x0 + 1, y0 + 1) * tx) * ty
  );
}
export function perspective(photo, tile, side = 294) {
  const data = new Uint8ClampedArray(side * side * 4);
  for (let y = 0; y < side; y++)
    for (let x = 0; x < side; x++) {
      const { ray } = tileRay((x + 0.5) / side, (y + 0.5) / side, tile);
      const [u, v] = coordinates(ray);
      for (let c = 0; c < 3; c++)
        data[(y * side + x) * 4 + c] = sample(photo.data, photo.w, photo.h, u, v, 4, c);
      data[(y * side + x) * 4 + 3] = 255;
    }
  return { w: side, h: side, data };
}
const read = (t, p) => sample(t.d, t.w, t.h, p.u, p.v, 1, 0, false);
function readGeometry(t, p, minimum) {
  const x = clamp(Math.floor(p.u * t.w - 0.5), 0, t.w - 1);
  const y = clamp(Math.floor(p.v * t.h - 0.5), 0, t.h - 1);
  for (const yy of [y, Math.min(y + 1, t.h - 1)])
    for (const xx of [x, Math.min(x + 1, t.w - 1)])
      if (t.d[yy * t.w + xx] <= minimum || (t.confidence && !t.confidence[yy * t.w + xx]))
        return NaN;
  return read(t, p);
}

function solve(matrix, rhs) {
  const n = rhs.length,
    a = matrix.map((r, i) => [...r, rhs[i]]);
  for (let k = 0; k < n; k++) {
    let pivot = k;
    for (let j = k + 1; j < n; j++) if (Math.abs(a[j][k]) > Math.abs(a[pivot][k])) pivot = j;
    [a[k], a[pivot]] = [a[pivot], a[k]];
    if (Math.abs(a[k][k]) < 1e-12) return null;
    const d = a[k][k];
    for (let j = k; j <= n; j++) a[k][j] /= d;
    for (let i = 0; i < n; i++)
      if (i !== k) {
        const s = a[i][k];
        for (let j = k; j <= n; j++) a[i][j] -= s * a[k][j];
      }
  }
  return a.map((r) => r[n]);
}

// A constant-color tile supplies no evidence for geometric calibration.
export function tileReliability(photo) {
  const sum = [0, 0, 0],
    squares = [0, 0, 0],
    n = photo.data.length / 4;
  for (let i = 0; i < photo.data.length; i += 4)
    for (let c = 0; c < 3; c++) {
      const v = photo.data[i + c] / 255;
      sum[c] += v;
      squares[c] += v * v;
    }
  const variance = sum.reduce((v, s, c) => v + squares[c] / n - (s / n) ** 2, 0) / 3;
  return variance < 1e-6 ? 0 : 1;
}

// Flat model predictions do not constrain relative geometry. Use RGB evidence
// for calibration only; fusion still preserves the whole photo, including walls.
export function tileConfidence(photo) {
  const { w, h, data } = photo;
  return Uint8Array.from({ length: w * h }, (_, i) => {
    const x = i % w,
      y = Math.floor(i / w),
      sums = [0, 0, 0],
      squares = [0, 0, 0];
    for (const dy of [-2, 0, 2])
      for (const dx of [-2, 0, 2])
        for (let c = 0; c < 3; c++) {
          const xx = Math.max(0, Math.min(w - 1, x + dx)),
            yy = Math.max(0, Math.min(h - 1, y + dy)),
            value = data[(yy * w + xx) * 4 + c] / 255;
          sums[c] += value;
          squares[c] += value * value;
        }
    return sums.reduce((v, sum, c) => v + squares[c] / 9 - (sum / 9) ** 2, 0) / 3 > 1e-6 ? 1 : 0;
  });
}

// Joint robust affine fit in inverse *radial* depth. Anchor only the front scale to
// remove the global gauge; weak priors prevent featureless overlaps collapsing.
export function alignTiles(tiles) {
  if (
    tiles.length !== 6 ||
    tiles.some((t) => t.d.length !== t.w * t.h || !t.d.every(Number.isFinite))
  )
    throw new Error("Six complete, finite depth tiles are required.");
  const med = tiles.map((t) =>
    Math.max(1e-6, median(t.d.filter((v, i) => v > 1e-6 && (!t.confidence || t.confidence[i])))),
  );
  const supported = tiles.map(
    (t) =>
      t.reliability !== 0 && t.d.some((v, i) => v > 1e-6 && (!t.confidence || t.confidence[i])),
  );
  // The front scale fixes a gauge, not an absolute distance. A blank front must
  // not shrink every supported face below fusion's positive-depth threshold.
  const anchor = supported.findIndex(Boolean);
  if (!supported[0] && anchor > 0) med[0] = med[anchor];
  const rows = [];
  for (let y = 0; y < 48; y++)
    for (let x = 0; x < 96; x++) {
      const ray = direction((x + 0.5) / 96, (y + 0.5) / 48);
      const views = tiles
        .map((t, i) => {
          const p = project(ray, t);
          const value = p && t.reliability !== 0 ? readGeometry(t, p, med[i] * 0.1) : NaN;
          return (
            Number.isFinite(value) && {
              i,
              d: (value / med[i]) * p.cosine,
              c: p.cosine,
              w: p.weight,
            }
          );
        })
        .filter(Boolean);
      for (let j = 0; j < views.length; j++)
        for (let k = j + 1; k < views.length; k++) {
          const a = views[j],
            b = views[k],
            r = new Float64Array(11);
          let target = 0;
          for (const [v, sign] of [
            [a, 1],
            [b, -1],
          ]) {
            if (v.i === 0) {
              target -= sign * v.d;
              r[0] = sign * v.c;
            } else {
              r[2 * v.i - 1] = sign * v.d;
              r[2 * v.i] = sign * v.c;
            }
          }
          rows.push({ r, target, weight: Math.sqrt(a.w * b.w) });
        }
    }
  let fit = Array.from({ length: 11 }, (_, i) => (i % 2 ? 1 : 0));
  for (let iteration = 0; iteration < 5; iteration++) {
    const m = Array.from({ length: 11 }, () => new Float64Array(11)),
      b = new Float64Array(11);
    for (const { r, target, weight } of rows) {
      const residual = Math.abs(dot(r, fit) - target);
      const w = weight * Math.min(1, 0.04 / Math.max(1e-8, residual));
      for (let i = 0; i < 11; i++) {
        b[i] += w * r[i] * target;
        for (let j = 0; j < 11; j++) m[i][j] += w * r[i] * r[j];
      }
    }
    for (let i = 0; i < 11; i++) {
      m[i][i] += 0.0001;
      b[i] += 0.0001 * (i % 2 ? 1 : 0);
    }
    const next = solve(m, b) || fit.slice();
    // Projected coordinate descent solves the positive-scale constraint. One
    // inconsistent tile must not discard all the other tiles' corrections.
    for (let i = 1; i < 11; i += 2) next[i] = Math.max(0.05, next[i]);
    for (let sweep = 0; sweep < 300; sweep++)
      for (let i = 0; i < 11; i++) {
        let rhs = b[i];
        for (let j = 0; j < 11; j++) if (i !== j) rhs -= m[i][j] * next[j];
        next[i] = i % 2 ? clamp(rhs / m[i][i], 0.05, 20) : rhs / m[i][i];
      }
    if (next.some((v) => !Number.isFinite(v))) break;
    fit = next;
  }
  const transforms = med.map((v, i) => ({
    a: ((i ? fit[2 * i - 1] : 1) / v) * med[0],
    b: fit[2 * i] * med[0],
  }));
  // A wholly unsupported tile cannot move supported calibration. Register its
  // retained prediction one way to the already calibrated overlap instead.
  tiles.forEach((tile, index) => {
    if (supported[index] || tile.reliability === 0) return;
    const positive = tile.d.filter((value) => value > 1e-6);
    if (!positive.length) return;
    const localMedian = median(positive),
      unmasked = { ...tile, confidence: undefined },
      observations = [];
    // No overlap keeps the same normalized-unit prior instead of the empty1e-6 median.
    transforms[index] = { a: med[0] / localMedian, b: 0 };
    for (let y = 0; y < 48; y++)
      for (let x = 0; x < 96; x++) {
        const ray = direction((x + 0.5) / 96, (y + 0.5) / 48),
          p = project(ray, tile),
          value = p ? readGeometry(unmasked, p, localMedian * 0.1) : NaN;
        if (!Number.isFinite(value)) continue;
        tiles.forEach((other, j) => {
          if (!supported[j]) return;
          const q = project(ray, other),
            raw = q ? readGeometry(other, q, med[j] * 0.1) : NaN;
          if (!Number.isFinite(raw)) return;
          const inverse = (transforms[j].a * raw + transforms[j].b) * q.cosine;
          if (inverse <= 1e-6) return;
          observations.push({
            r: [(value / localMedian) * p.cosine, p.cosine],
            target: inverse / med[0],
            weight: Math.sqrt(p.weight * q.weight),
          });
        });
      }
    if (!observations.length) return;
    let localFit = [1, 0];
    for (let iteration = 0; iteration < 5; iteration++) {
      const matrix = [
          [0.0001, 0],
          [0, 0.0001],
        ],
        rhs = [0.0001, 0];
      for (const { r, target, weight } of observations) {
        const residual = Math.abs(dot(r, localFit) - target),
          w = weight * Math.min(1, 0.04 / Math.max(1e-8, residual));
        for (let i = 0; i < 2; i++) {
          rhs[i] += w * r[i] * target;
          for (let j = 0; j < 2; j++) matrix[i][j] += w * r[i] * r[j];
        }
      }
      const next = solve(matrix, rhs) || localFit.slice();
      next[0] = clamp(next[0], 0.05, 20);
      for (let sweep = 0; sweep < 300; sweep++) {
        next[0] = clamp((rhs[0] - matrix[0][1] * next[1]) / matrix[0][0], 0.05, 20);
        next[1] = (rhs[1] - matrix[1][0] * next[0]) / matrix[1][1];
      }
      if (!next.every(Number.isFinite)) break;
      localFit = next;
    }
    transforms[index] = {
      a: (localFit[0] / localMedian) * med[0],
      b: localFit[1] * med[0],
    };
  });
  const jumps = rows.map(({ r, target }) => Math.abs(dot(r, fit) - target));
  // Report normalized overlap disagreement, not the jump in a feathered image.
  const relative = [];
  for (let y = 0; y < 48; y++)
    for (let x = 0; x < 96; x++) {
      const ray = direction((x + 0.5) / 96, (y + 0.5) / 48);
      const vals = tiles
        .map((t, i) => {
          const p = project(ray, t);
          return p && t.reliability !== 0 && read(t, p) / med[i] > 0.1 && p.weight > 0.003
            ? (transforms[i].a * read(t, p) + transforms[i].b) * p.cosine
            : null;
        })
        .filter((v) => v > 0);
      for (let j = 1; j < vals.length; j++)
        relative.push(Math.abs(vals[0] - vals[j]) / Math.max(1e-6, (vals[0] + vals[j]) / 2));
    }
  return {
    transforms,
    seamMedian: relative.length ? median(relative) : null,
    residual: rows.length ? median(jumps) : null,
  };
}

export function fuseDepth(tiles, alignment, w = 512, h = 256, { normalize = true } = {}) {
  const d = new Float32Array(w * h);
  for (let y = 0; y < h; y++)
    for (let x = 0; x < w; x++) {
      const ray = direction((x + 0.5) / w, (y + 0.5) / h);
      let sum = 0,
        weights = 0;
      tiles.forEach((t, i) => {
        const p = project(ray, t);
        if (!p || t.reliability === 0) return;
        const a = alignment.transforms[i],
          inv = (a.a * read(t, p) + a.b) * p.cosine;
        if (inv > 1e-6) {
          sum += p.weight * inv;
          weights += p.weight;
        }
      });
      d[y * w + x] = weights ? weights / sum : NaN;
    }
  const scale = normalize ? 3 / Math.max(1e-6, median(d)) : 1;
  for (let i = 0; i < d.length; i++)
    d[i] = Number.isFinite(d[i])
      ? clamp(d[i] * scale, normalize ? 0.6 : 0.001, normalize ? 30 : 10000)
      : 30;
  return { w, h, d, seamMedian: alignment.seamMedian };
}

export function buildShell(photo, depth, budget, heading = 0) {
  if (!Number.isFinite(budget) || budget < 100 || budget > 400000)
    throw new Error("Choose a finite splat budget from 100 to 400,000.");
  const points = [],
    rows = Math.max(8, Math.floor(Math.sqrt(budget / 1.55)));
  // Latitude rings give closed, evenly sampled polar caps. The extra front
  // hemisphere samples use the same rings, without a density boundary.
  for (let y = 0; y < rows; y++) {
    const v = (y + 0.5) / rows,
      lat = (0.5 - v) * Math.PI;
    const count = Math.max(1, Math.floor(2 * rows * Math.cos(lat)));
    for (let x = 0; x < count; x++) {
      const u = (x + 0.5) / count,
        ray = direction(u, v);
      points.push([u, v, ray, 1]);
      const front = Math.max(0, ray[0] * Math.sin(heading) + ray[2] * Math.cos(heading));
      if (front > 0.35 && (x % 3) / 3 < front * 0.55) {
        const uu = (x + 1) / count,
          vv = v + 0.25 / rows;
        points.push([uu, vv, direction(uu, vv), 0.8]);
      }
    }
  }
  const n = Math.min(Math.floor(budget), points.length),
    pos = new Float32Array(n * 3),
    rgb = new Float32Array(n * 3),
    sigma = new Float32Array(n);
  for (let i = 0; i < n; i++) {
    const [u, v, ray, density] = points[i];
    const r = depth ? sample(depth.d, depth.w, depth.h, u, v) : 3;
    sigma[i] = ((r * Math.PI) / rows) * 0.63 * density;
    for (let c = 0; c < 3; c++) {
      pos[3 * i + c] = ray[c] * r;
      rgb[3 * i + c] = sample(photo.data, photo.w, photo.h, u, v, 4, c) / 255;
    }
  }
  return { n, pos, rgb, sigma };
}
export function movement(requested, near = 3) {
  const len = Math.hypot(...requested),
    scale = len > 1 ? 1 / len : 1;
  const position = requested.map((v) => v * scale);
  return { position, warning: Math.hypot(...position) > Math.min(0.6, near * 0.2) };
}
