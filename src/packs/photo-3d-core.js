// Photo to 3D (lane Photo to 3D, prefix p3d): the pure part. Given a photo's colors and
// a depth map (how near each part of the picture is), it builds the splats: one on a
// regular grid over the picture, each at its depth, sized to its neighbors so the surface
// closes, and cut away from its neighbors where the depth jumps, so a near object stands
// as its own layer instead of being stretched to the background behind it.
// No DOM, no model: the toy (photo-3d.js) and the Node tools share it.
//
//   photo  { w, h, data }            RGBA bytes (sRGB), any size
//   depth  { w, h, d }               disparity, any scale (higher is nearer): what the model gives
//
// buildPhotoSplats() returns arrays in toy coordinates (picture height 1, +Y up, +Z toward
// the viewer): the relief positions, the flat positions, sizes, colors and layer numbers.

// The tier budgets for the toy's splats (the kit's count: the tier's default count times the
// recipe's density, capped at the tier's maximum). The same as the model toy's.
export const PHOTO_DENSITY = 1.5;
export const TIER_COUNTS = {
  low: { maxCount: 120000, defaultCount: 60000 },
  mid: { maxCount: 240000, defaultCount: 140000 },
  high: { maxCount: 300000, defaultCount: 200000 },
  max: { maxCount: 400000, defaultCount: 280000 },
};
export const PHOTO_BUDGETS = Object.fromEntries(
  Object.entries(TIER_COUNTS).map(([tier, t]) => [
    tier,
    Math.round(Math.min(t.maxCount, t.defaultCount * PHOTO_DENSITY)),
  ]),
);

export const LAYERS = 4; // the depth bands a picture is split into (the four morph channels)
export const FILL = 1.12; // a splat's size against the distance to its neighbors on its surface
export const CUT = 0.015; // a step in the (0..1) disparity between neighbors that cuts the surface
export const SPLAT_OPACITY = 1;
export const SPLAT_FLAT = 0.14;
const MIN_PIECE = 0.0006; // a piece of surface smaller than this share of the picture joins its neighbor

export const clamp = (x, a, b) => Math.min(b, Math.max(a, x));

// Depth-model input size: the long side (a multiple of 14 for the ViT), the short side keeps the shape.
export function modelSize(w, h, long = 518) {
  const s = long / Math.max(w, h);
  const m = (v) => Math.max(14, Math.round((v * s) / 14) * 14);
  return { dw: m(w), dh: m(h) };
}

// Shrinks or enlarges a photo's colors to gw x gh by box averaging (exact coverage of each
// target cell, so no aliasing), returning sRGB floats 0..1 (3 per cell).
export function resampleArea(photo, gw, gh) {
  const { w, h, data } = photo;
  const axis = (n, g) => {
    // for each target index: source start, weights
    const out = [];
    const r = n / g;
    for (let i = 0; i < g; i++) {
      const a = i * r;
      const b = (i + 1) * r;
      if (r <= 1) {
        // enlarging: linear between the two nearest source pixels
        const c = clamp((a + b) / 2 - 0.5, 0, n - 1);
        const i0 = Math.floor(c);
        const i1 = Math.min(n - 1, i0 + 1);
        const t = c - i0;
        out.push({ s: i0, w: i1 === i0 ? [1] : [1 - t, t] });
      } else {
        const s = Math.floor(a);
        const e = Math.min(n, Math.ceil(b));
        const ws = [];
        for (let k = s; k < e; k++) ws.push(Math.min(b, k + 1) - Math.max(a, k));
        const tot = ws.reduce((x, y) => x + y, 0);
        out.push({ s, w: ws.map((x) => x / tot) });
      }
    }
    return out;
  };
  const ax = axis(w, gw);
  const ay = axis(h, gh);
  // horizontal pass: gw x h, three channels (alpha is ignored: a photo is opaque)
  const mid = new Float32Array(gw * h * 3);
  for (let y = 0; y < h; y++) {
    const row = y * w;
    for (let i = 0; i < gw; i++) {
      const { s, w: ws } = ax[i];
      let r = 0;
      let g = 0;
      let b = 0;
      for (let k = 0; k < ws.length; k++) {
        const p = (row + s + k) * 4;
        r += data[p] * ws[k];
        g += data[p + 1] * ws[k];
        b += data[p + 2] * ws[k];
      }
      const q = (y * gw + i) * 3;
      mid[q] = r;
      mid[q + 1] = g;
      mid[q + 2] = b;
    }
  }
  const out = new Float32Array(gw * gh * 3);
  for (let j = 0; j < gh; j++) {
    const { s, w: ws } = ay[j];
    for (let i = 0; i < gw; i++) {
      let r = 0;
      let g = 0;
      let b = 0;
      for (let k = 0; k < ws.length; k++) {
        const p = ((s + k) * gw + i) * 3;
        r += mid[p] * ws[k];
        g += mid[p + 1] * ws[k];
        b += mid[p + 2] * ws[k];
      }
      const q = (j * gw + i) * 3;
      out[q] = r / 255;
      out[q + 1] = g / 255;
      out[q + 2] = b / 255;
    }
  }
  return out;
}

// The depth as 0 (far) to 1 (near): stretched between its 2nd and 98th percentile so a
// picture with a very near or a very far speck still uses the whole range.
export function normalizeDepth(d) {
  const n = d.length;
  let lo = Infinity;
  let hi = -Infinity;
  for (let i = 0; i < n; i++) {
    if (d[i] < lo) lo = d[i];
    if (d[i] > hi) hi = d[i];
  }
  const out = new Float32Array(n);
  if (!(hi > lo)) return out.fill(0.5);
  const bins = 1024;
  const hist = new Float64Array(bins);
  for (let i = 0; i < n; i++)
    hist[Math.min(bins - 1, Math.floor(((d[i] - lo) / (hi - lo)) * bins))]++;
  const at = (q) => {
    let acc = 0;
    for (let b = 0; b < bins; b++) {
      acc += hist[b];
      if (acc >= q * n) return lo + ((b + 1) / bins) * (hi - lo);
    }
    return hi;
  };
  const p0 = at(0.02);
  const p1 = at(0.98);
  const span = p1 > p0 ? p1 - p0 : hi - lo;
  for (let i = 0; i < n; i++) out[i] = clamp((d[i] - p0) / span, 0, 1);
  return out;
}

// The depth map enlarged to the grid, its edges pulled onto the photo's edges: each cell
// takes the low-resolution depths around it, weighted by how near they lie and how alike
// the photo's color is there and here (a joint bilateral filter), so a near object's outline
// in the depth map lands on its outline in the photo instead of on a soft halo.
export function upsampleDepth(dLo, dw, dh, guideLo, gx, gy, guideHi, sigmaColor = 0.09) {
  const out = new Float32Array(gx * gy);
  const inv = 1 / (2 * sigmaColor * sigmaColor);
  const sp = 1 / (2 * 0.8 * 0.8);
  for (let j = 0; j < gy; j++) {
    const v = ((j + 0.5) * dh) / gy - 0.5;
    const j0 = Math.floor(v);
    for (let i = 0; i < gx; i++) {
      const u = ((i + 0.5) * dw) / gx - 0.5;
      const i0 = Math.floor(u);
      const q = (j * gx + i) * 3;
      const r = guideHi[q];
      const g = guideHi[q + 1];
      const b = guideHi[q + 2];
      let sum = 0;
      let wsum = 0;
      let bil = 0;
      for (let jj = j0 - 1; jj <= j0 + 2; jj++) {
        const y = clamp(jj, 0, dh - 1);
        for (let ii = i0 - 1; ii <= i0 + 2; ii++) {
          const x = clamp(ii, 0, dw - 1);
          const p = (y * dw + x) * 3;
          const dr = guideLo[p] - r;
          const dg = guideLo[p + 1] - g;
          const db = guideLo[p + 2] - b;
          const ds = (u - ii) * (u - ii) + (v - jj) * (v - jj);
          const ws = Math.exp(-ds * sp);
          const w = ws * Math.exp(-(dr * dr + dg * dg + db * db) * inv);
          sum += w * dLo[y * dw + x];
          wsum += w;
          // the plain bilinear value, a fallback where the colors match nothing
          const bw = Math.max(0, 1 - Math.abs(u - ii)) * Math.max(0, 1 - Math.abs(v - jj));
          bil += bw * dLo[y * dw + x];
        }
      }
      out[j * gx + i] = wsum > 1e-4 ? sum / wsum : bil;
    }
  }
  return out;
}

// Which of a cell's neighbors are on its own surface: bit 0 right, 1 down. (A cell to the left
// or above has its own bit.) `cut` is the disparity step between neighbors that separates them.
function links(d, gx, gy, cut) {
  const m = new Uint8Array(gx * gy);
  for (let j = 0; j < gy; j++)
    for (let i = 0; i < gx; i++) {
      const c = j * gx + i;
      if (i + 1 < gx && Math.abs(d[c] - d[c + 1]) <= cut) m[c] |= 1;
      if (j + 1 < gy && Math.abs(d[c] - d[c + gx]) <= cut) m[c] |= 2;
    }
  return m;
}

const linkedRight = (m, c) => (m[c] & 1) !== 0;
const linkedDown = (m, c) => (m[c] & 2) !== 0;

// Smooths the depth along each surface only (a cell averages with its linked neighbors), so
// the model's noise goes and the cuts stay sharp.
function smoothOnSurface(d, m, gx, gy, passes = 2) {
  let a = d;
  for (let p = 0; p < passes; p++) {
    const b = new Float32Array(a.length);
    for (let j = 0; j < gy; j++)
      for (let i = 0; i < gx; i++) {
        const c = j * gx + i;
        let s = a[c] * 2;
        let w = 2;
        if (i > 0 && linkedRight(m, c - 1)) ((s += a[c - 1]), w++);
        if (i + 1 < gx && linkedRight(m, c)) ((s += a[c + 1]), w++);
        if (j > 0 && linkedDown(m, c - gx)) ((s += a[c - gx]), w++);
        if (j + 1 < gy && linkedDown(m, c)) ((s += a[c + gx]), w++);
        b[c] = s / w;
      }
    a = b;
  }
  return a;
}

// Labels the connected pieces of surface. Returns { label, count, mean, size }.
function pieces(m, d, gx, gy) {
  const n = gx * gy;
  const label = new Int32Array(n).fill(-1);
  const stack = new Int32Array(n);
  const mean = [];
  const size = [];
  let count = 0;
  for (let s = 0; s < n; s++) {
    if (label[s] >= 0) continue;
    let sp = 0;
    stack[sp++] = s;
    label[s] = count;
    let sum = 0;
    let cnt = 0;
    while (sp) {
      const c = stack[--sp];
      sum += d[c];
      cnt++;
      const i = c % gx;
      const j = (c - i) / gx;
      let t;
      if (i + 1 < gx && linkedRight(m, c) && label[(t = c + 1)] < 0) (label[t] = count), (stack[sp++] = t); // prettier-ignore
      if (j + 1 < gy && linkedDown(m, c) && label[(t = c + gx)] < 0) (label[t] = count), (stack[sp++] = t); // prettier-ignore
      if (i > 0 && linkedRight(m, c - 1) && label[(t = c - 1)] < 0) (label[t] = count), (stack[sp++] = t); // prettier-ignore
      if (j > 0 && linkedDown(m, c - gx) && label[(t = c - gx)] < 0) (label[t] = count), (stack[sp++] = t); // prettier-ignore
    }
    mean.push(sum / cnt);
    size.push(cnt);
    count++;
  }
  return { label, count, mean, size };
}

// A tiny piece of surface is usually a flying pixel (a cell whose depth the model got wrong
// beside an edge) or a hair-thin structure. Each takes the depth of the nearby cell of a large piece
// whose photo color is most like its own, so it joins that surface instead of floating apart.
function joinSmallPieces(d, pc, rgb, gx, gy, minCells, reach = 2) {
  const out = Float32Array.from(d);
  let moved = 0;
  for (let j = 0; j < gy; j++)
    for (let i = 0; i < gx; i++) {
      const c = j * gx + i;
      if (pc.size[pc.label[c]] >= minCells) continue;
      let best = -1;
      let bd = Infinity;
      for (let dj = -reach; dj <= reach; dj++) {
        const y = j + dj;
        if (y < 0 || y >= gy) continue;
        for (let di = -reach; di <= reach; di++) {
          const x = i + di;
          if (x < 0 || x >= gx) continue;
          const q = y * gx + x;
          if (pc.size[pc.label[q]] < minCells) continue;
          const e =
            (rgb[q * 3] - rgb[c * 3]) ** 2 +
            (rgb[q * 3 + 1] - rgb[c * 3 + 1]) ** 2 +
            (rgb[q * 3 + 2] - rgb[c * 3 + 2]) ** 2 +
            0.002 * (di * di + dj * dj);
          if (e < bd) ((bd = e), (best = q));
        }
      }
      if (best >= 0) ((out[c] = d[best]), moved++);
    }
  return { d: out, moved };
}

// Builds the splats for a photo and its depth.
//   count   the most splats to make (the tier's budget)
//   depth   how deep the relief is, 0..1 (0.5 is the default)
// Returns { n, gx, gy, aspect, relief (3n), flat (3n), sigma (n), rgb (3n), band (n), gap, stats }.
export function buildPhotoSplats(photo, depthMap, { count = 100000, depth = 0.5, cut = CUT } = {}) {
  const aspect = photo.w / photo.h;
  // The grid: about `count` cells in the photo's shape, never finer than the photo itself.
  let gx = Math.max(2, Math.round(Math.sqrt(count * aspect)));
  let gy = Math.max(2, Math.round(count / gx));
  if (gx > photo.w || gy > photo.h) {
    const f = Math.min(photo.w / gx, photo.h / gy);
    gx = Math.max(2, Math.floor(gx * f));
    gy = Math.max(2, Math.floor(gy * f));
  }
  const rgb = resampleArea(photo, gx, gy);
  const { w: dw, h: dh } = depthMap;
  const guideLo = resampleArea(photo, dw, dh);
  const dn = normalizeDepth(depthMap.d);
  let d = upsampleDepth(dn, dw, dh, guideLo, gx, gy, rgb);
  const minCells = Math.max(6, Math.round(MIN_PIECE * gx * gy));
  let m = links(d, gx, gy, cut);
  d = smoothOnSurface(d, m, gx, gy, 1);
  m = links(d, gx, gy, cut);
  // pieces of surface, and the depth band each belongs to
  let pc = pieces(m, d, gx, gy);
  const joined = joinSmallPieces(d, pc, rgb, gx, gy, minCells);
  d = joined.d;
  m = links(d, gx, gy, cut);
  d = smoothOnSurface(d, m, gx, gy, 1);
  pc = pieces(m, d, gx, gy);
  const band = new Uint8Array(gx * gy);
  const bandOf = (v) => Math.min(LAYERS - 1, Math.floor(clamp(v, 0, 0.9999) * LAYERS));
  for (let c = 0; c < gx * gy; c++) {
    const L = pc.label[c];
    band[c] = bandOf(pc.size[L] >= minCells ? pc.mean[L] : d[c]);
  }
  let big = 0;
  for (let L = 0; L < pc.count; L++) if (pc.size[L] >= minCells) big++;

  // Geometry: picture height 1, centered; relief scales with the Depth option.
  const R = 0.08 + 0.7 * clamp(depth, 0, 1);
  const cell = 1 / gy;
  const n = gx * gy;
  const relief = new Float32Array(n * 3);
  const flat = new Float32Array(n * 3);
  const z = new Float32Array(n);
  for (let j = 0; j < gy; j++)
    for (let i = 0; i < gx; i++) {
      const c = j * gx + i;
      const x = ((i + 0.5) / gx - 0.5) * aspect;
      const y = 0.5 - (j + 0.5) / gy;
      z[c] = R * (d[c] - 0.5);
      relief[c * 3] = flat[c * 3] = x;
      relief[c * 3 + 1] = flat[c * 3 + 1] = y;
      relief[c * 3 + 2] = z[c];
      flat[c * 3 + 2] = 0;
    }
  // Sizes: FILL times the mean distance to the neighbors on the same surface (a cell with
  // none takes a plain cell's size), never more than 1.7 cells so a steep slope stays sharp.
  const sigma = new Float32Array(n);
  const cw = cell * aspect * (gy / gx); // the cell's width (equal to `cell` for a square grid)
  for (let j = 0; j < gy; j++)
    for (let i = 0; i < gx; i++) {
      const c = j * gx + i;
      let sum = 0;
      let k = 0;
      const add = (dz, step) => {
        sum += Math.hypot(step, dz);
        k++;
      };
      if (i > 0 && linkedRight(m, c - 1)) add(z[c] - z[c - 1], cw);
      if (i + 1 < gx && linkedRight(m, c)) add(z[c] - z[c + 1], cw);
      if (j > 0 && linkedDown(m, c - gx)) add(z[c] - z[c - gx], cell);
      if (j + 1 < gy && linkedDown(m, c)) add(z[c] - z[c + gx], cell);
      const base = k ? sum / k : cell * 1.15;
      sigma[c] = FILL * Math.min(base, 1.7 * cell);
    }
  const cutCells = (() => {
    let e = 0;
    for (let c = 0; c < n; c++) {
      const i = c % gx;
      if (i + 1 < gx && !linkedRight(m, c)) e++;
      if (c + gx < n && !linkedDown(m, c)) e++;
    }
    return e;
  })();
  return {
    n,
    gx,
    gy,
    aspect,
    relief,
    flat,
    sigma,
    rgb,
    band,
    depth: d,
    gap: 0.16 * R + 0.06, // how far apart "Layers" pulls the depth bands, in picture heights
    stats: {
      pieces: pc.count,
      bigPieces: big,
      cutEdges: cutCells,
      relief: R,
      joined: joined.moved,
    },
  };
}
