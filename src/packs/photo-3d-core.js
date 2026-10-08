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
export const FILL = 1.05; // a splat's size against the distance to its neighbors on its surface
export const CUT = 0.015; // a step in the (0..1) disparity between neighbors that cuts the surface
export const SPLAT_OPACITY = 1;
export const SPLAT_FLAT = 0.14;
// Lane Photo fidelity r2: the adaptive grid. The fine grid is made of blocks of 2^LEVELS by 2^LEVELS
// cells; a plain block (its colors within FLAT_VAR of their mean) is one splat, a block with
// detail splits into four, and those again, down to 2 by 2 cells, then to single cells where the
// split takes away the most color error, until the budget is spent. So a page's plain background
// takes a few big splats and its letters many small ones. The fine grid holds between 2.2 and
// FINE_CELLS cells per splat of the budget: the more of the picture is plain, the finer
// (fineCells). (r1 and before: 2.2 cells per splat, in 2 by 2 blocks, SPLIT_SHARE of them split.)
export const FINE_CELLS = 6;
// The small splats are drawn smaller than their cells (single cells 0.45, 2 by 2 blocks 0.6 of
// their size): neighbors of different colors at the same depth draw in no set order, so where
// they overlap much, light ones land on dark strokes and the letters look grainy (the owner's
// reviews of round 2: "sharper and less grainy"). Measured on the text page, mid (SSIM): 0.41 at
// full size, 0.63 at 0.55 and 0.8, 0.72 at 0.45 and 0.6; 0.71 at 0.35 and 0.6. Less color
// sharpening (SHARPEN) measured worse.
export const SMALL_FILL = 0.45;
export const PAIR_FILL = 0.6;
export const BLOCK_BACK = 0.002; // how far behind (picture heights) each level of bigger splat sits
export const FLAT_VAR = 0.002; // a block's mean squared color difference (r, g, b summed, 0..1) that still counts as plain
export const LEVELS = 3;
export const SPLIT_SHARE = 0.28; // (r1's grid; kept for the tools that compare)
export const SHARPEN = 0.5; // unsharp amount on the grid colors, to make up for the splats' overlap
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

// Lane Photo fidelity: how much of the relief to keep. The model's depth is relative, and it is
// stretched to 0..1 between its 2nd and 98th percentiles, so a flat picture (a page of text, a phone
// screenshot) would get its noise stretched into a full relief, bending its lines and tearing its
// letters. The depth's own span against its nearest (p98 - p2 over p98) tells them apart: 0.21 to
// 0.23 on our text page (and 0.06 on the Muybridge horse, a flat print), 0.51 to 1 on the photos and
// clips of real scenes (October 8, 2026). Full relief from 0.45; at 0.25 or less a picture keeps
// FLAT_KEEP of it (a gentle bend, so a screen recording still has its shape, but no steps that tear
// letters apart); in between in proportion. Only for photos and clips people open: the samples keep
// the relief they were approved with.
export const FLAT_SPAN = [0.25, 0.45];
export const FLAT_KEEP = 0.3;
export function reliefScale(lo, hi) {
  if (!(hi > 0) || !(hi > lo)) return 1;
  const t = clamp(((hi - lo) / hi - FLAT_SPAN[0]) / (FLAT_SPAN[1] - FLAT_SPAN[0]), 0, 1);
  return FLAT_KEEP + (1 - FLAT_KEEP) * t;
}
export function percentiles(d, a = 0.02, b = 0.98) {
  const s = Float32Array.from(d).sort();
  return [s[Math.floor(a * (s.length - 1))], s[Math.floor(b * (s.length - 1))]];
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

// A light unsharp mask on the grid colors (sRGB 0..1, 3 per cell): each splat overlaps its neighbors, so
// the picture the splats draw is a little softer than the photo; this puts the difference back.
export function sharpen(rgb, gx, gy, amount = SHARPEN) {
  const out = new Float32Array(rgb.length);
  for (let j = 0; j < gy; j++)
    for (let i = 0; i < gx; i++) {
      const c = j * gx + i;
      const l = i > 0 ? c - 1 : c;
      const r = i + 1 < gx ? c + 1 : c;
      const u = j > 0 ? c - gx : c;
      const dn = j + 1 < gy ? c + gx : c;
      for (let k = 0; k < 3; k++) {
        const blur = (rgb[l * 3 + k] + rgb[r * 3 + k] + rgb[u * 3 + k] + rgb[dn * 3 + k] + 4 * rgb[c * 3 + k]) / 8; // prettier-ignore
        out[c * 3 + k] = clamp(rgb[c * 3 + k] + amount * (rgb[c * 3 + k] - blur), 0, 1);
      }
    }
  return out;
}

// Builds the splats for a photo and its depth.
//   count   the most splats to make (the tier's budget)
//   depth   how deep the relief is, 0..1 (0.5 is the default)
// Returns { n, gx, gy (the fine grid), aspect, relief (3n), flat (3n), sigma (n), rgb (3n), band (n), gap, stats }.
export function buildPhotoSplats(
  photo,
  depthMap,
  { count = 100000, depth = 0.5, cut = CUT, keepFlat = false } = {},
) {
  // prettier-ignore
  const aspect = photo.w / photo.h;
  // The fine grid: a block of 2 x 2 fine cells is drawn as one splat, or as four where there is detail
  // (SPLIT_SHARE of the blocks), so the splats are spent where they show: on detail, on near things and
  // along depth edges. The fine grid is never finer than the photo itself.
  // (r2: blocks of B by B fine cells, FINE_CELLS fine cells per splat of the budget, never more top
  // blocks than the budget. Where that is finer than the photo, the grid is the photo's own pixels,
  // less the few at its right and bottom edges that don't make up a whole block; fewer levels
  // when a small picture would lose more than 2% of itself that way.)
  let levels = LEVELS;
  let B = 1 << levels;
  const nb = Math.min(count, (fineCells(photo, count) * count) / (B * B));
  let bx = Math.max(1, Math.round(Math.sqrt(nb * aspect)));
  let by = Math.max(1, Math.round(nb / bx));
  if (B * bx > photo.w || B * by > photo.h) {
    const keep = (L) => (Math.floor(photo.w / (1 << L)) * Math.floor(photo.h / (1 << L)) * (1 << (2 * L))) / (photo.w * photo.h); // prettier-ignore
    while (levels > 1 && keep(levels) < 0.98) levels--;
    B = 1 << levels;
    bx = Math.max(1, Math.floor(photo.w / B));
    by = Math.max(1, Math.floor(photo.h / B));
  }
  const gx = B * bx;
  const gy = B * by;
  const rgb = sharpen(resampleArea(photo, gx, gy), gx, gy);
  const { w: dw, h: dh } = depthMap;
  const guideLo = resampleArea(photo, dw, dh);
  const dn = normalizeDepth(depthMap.d);
  const flatness = keepFlat ? reliefScale(...percentiles(depthMap.d)) : 1;
  if (flatness < 1) for (let i = 0; i < dn.length; i++) dn[i] = 0.5 + (dn[i] - 0.5) * flatness;
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
  const z = new Float32Array(n);
  for (let c = 0; c < n; c++) z[c] = R * (d[c] - 0.5);
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
      // beside a cut the splat is a little smaller, so the edge stays crisp
      sigma[c] = FILL * Math.min(base, 1.7 * cell) * (k < 4 ? 0.85 : 1);
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
  const g = adaptiveGrid({ gx, gy, levels, count, rgb, d, m });
  const no = g.n;
  const oRelief = new Float32Array(no * 3);
  const oFlat = new Float32Array(no * 3);
  const oSigma = new Float32Array(no);
  const oRgb = new Float32Array(no * 3);
  const oBand = new Uint8Array(no);
  for (let k = 0; k < no; k++) {
    const x0 = g.x[k];
    const y0 = g.y[k];
    const sz = g.size[k];
    let zz = 0;
    let sg = 0;
    let r = 0;
    let gg = 0;
    let b = 0;
    for (let j = y0; j < y0 + sz; j++)
      for (let i = x0; i < x0 + sz; i++) {
        const c = j * gx + i;
        zz += z[c];
        sg += sigma[c];
        r += rgb[c * 3];
        gg += rgb[c * 3 + 1];
        b += rgb[c * 3 + 2];
      }
    const q = sz * sz;
    const x = ((x0 + sz / 2) / gx - 0.5) * aspect;
    const y = 0.5 - (y0 + sz / 2) / gy;
    oRelief[k * 3] = oFlat[k * 3] = x;
    oRelief[k * 3 + 1] = oFlat[k * 3 + 1] = y;
    // a bigger splat sits a hair behind the smaller ones, so it never draws over their detail
    // (they would sort in any order at the same depth)
    const back = BLOCK_BACK * Math.log2(sz);
    oRelief[k * 3 + 2] = zz / q - back;
    oFlat[k * 3 + 2] = back ? -back : 0;
    oRgb[k * 3] = r / q;
    oRgb[k * 3 + 1] = gg / q;
    oRgb[k * 3 + 2] = b / q;
    // a block of sz by sz cells: sz times its cells' mean size (r1: a 2 x 2 block, twice)
    oSigma[k] = ((sz * sg) / q) * (sz === 1 ? SMALL_FILL : sz === 2 ? PAIR_FILL : 1);
    oBand[k] = band[(y0 + (sz >> 1)) * gx + x0 + (sz >> 1)];
  }
  return {
    n: no,
    gx,
    gy,
    aspect,
    relief: oRelief,
    flat: oFlat,
    sigma: oSigma,
    rgb: oRgb,
    band: oBand,
    depth: d,
    gap: 0.16 * R + 0.06, // how far apart "Layers" pulls the depth bands, in picture heights
    stats: {
      pieces: pc.count,
      bigPieces: big,
      cutEdges: cutCells,
      relief: R,
      flatness,
      joined: joined.moved,
      blocks: bx * by,
      splitBlocks: g.split[levels] || 0,
      levels: g.levels, // splats of each size: [1 cell, 2 by 2, 4 by 4, ...]
    },
  };
}

// Lane Photo fidelity r2: how fine the grid can be for this picture, in cells per splat of the
// budget. A quick look at the picture (its colors in 2 by 2 cells of the finest grid, in blocks of
// 2^LEVELS cells) finds the share p that is plain; the detail takes a splat per 2 by 2 cells and
// the plain a splat per block, and three quarters of the budget goes to that, the rest to single
// cells where the detail is finest.
export function fineCells(photo, count) {
  const aspect = photo.w / photo.h;
  const half = 1 << (LEVELS - 1);
  const area = Math.min(photo.w * photo.h, (FINE_CELLS * count) / 4);
  const pw = Math.max(half, Math.floor(Math.sqrt(area * aspect) / half) * half);
  const ph = Math.max(half, Math.floor(area / pw / half) * half);
  const rgb = resampleArea(photo, pw, ph);
  let plain = 0;
  let blocks = 0;
  for (let by = 0; by + half <= ph; by += half)
    for (let bx = 0; bx + half <= pw; bx += half) {
      let s = 0;
      let s2 = 0;
      const sum = [0, 0, 0];
      for (let y = by; y < by + half; y++)
        for (let x = bx; x < bx + half; x++)
          for (let k = 0; k < 3; k++) {
            const v = rgb[(y * pw + x) * 3 + k];
            sum[k] += v;
            s2 += v * v;
          }
      const q = half * half;
      s = s2 - (sum[0] ** 2 + sum[1] ** 2 + sum[2] ** 2) / q;
      if (s / q <= FLAT_VAR) plain++;
      blocks++;
    }
  const p = blocks ? plain / blocks : 0;
  const b2 = 1 << (2 * LEVELS);
  return clamp(0.75 / ((1 - p) / 4 + p / b2), 2.2, FINE_CELLS);
}

// Lane Photo fidelity r2: the adaptive grid's choice. The fine grid (gx by gy, both multiples of
// 2^levels) starts as blocks of 2^levels cells a side, one splat each; a block splits into its four
// quarters, three splats more, in order of how much color error (the sum of squared differences
// from each splat's mean color) the split takes away, nearer things a little first, until the
// budget (`count` splats) is spent. A block with a depth cut inside it splits first, down to
// cells that have none, so no splat bridges a cut. Returns the splats as blocks: { n, x, y, size
// (in cells), split (blocks split, per level), levels (splats per size) }.
export function adaptiveGrid({ gx, gy, levels, count, rgb, d, m }) {
  // per level k (1..levels): each block's sums of r, g, b, squares and nearness (level 0: the cells)
  const nx = [gx];
  const ny = [gy];
  const S = [null];
  for (let k = 1; k <= levels; k++) {
    nx.push(nx[k - 1] >> 1);
    ny.push(ny[k - 1] >> 1);
    const a = new Float64Array(nx[k] * ny[k] * 5);
    for (let j = 0; j < ny[k]; j++)
      for (let i = 0; i < nx[k]; i++) {
        const o = (j * nx[k] + i) * 5;
        for (let dj = 0; dj < 2; dj++)
          for (let di = 0; di < 2; di++) {
            const ci = 2 * i + di;
            const cj = 2 * j + dj;
            if (k === 1) {
              const c = cj * gx + ci;
              const r = rgb[c * 3];
              const g = rgb[c * 3 + 1];
              const b = rgb[c * 3 + 2];
              a[o] += r;
              a[o + 1] += g;
              a[o + 2] += b;
              a[o + 3] += r * r + g * g + b * b;
              a[o + 4] += d[c];
            } else {
              const p = (cj * nx[k - 1] + ci) * 5;
              for (let t = 0; t < 5; t++) a[o + t] += S[k - 1][p + t];
            }
          }
      }
    S.push(a);
  }
  // the color error of a block left whole (level 0, a cell: none)
  const sse = (k, i, j) => {
    if (k === 0) return 0;
    const a = S[k];
    const o = (j * nx[k] + i) * 5;
    const q = 1 << (2 * k);
    return Math.max(0, a[o + 3] - (a[o] * a[o] + a[o + 1] * a[o + 1] + a[o + 2] * a[o + 2]) / q);
  };
  // whether a depth cut runs inside a block: summed-area tables of the cells cut from their right
  // and lower neighbors
  const W = gx + 1;
  const cr = new Int32Array(W * (gy + 1));
  const cd = new Int32Array(W * (gy + 1));
  for (let j = 0; j < gy; j++)
    for (let i = 0; i < gx; i++) {
      const c = j * gx + i;
      const o = (j + 1) * W + i + 1;
      const r = i + 1 < gx && !(m[c] & 1) ? 1 : 0;
      const dn = j + 1 < gy && !(m[c] & 2) ? 1 : 0;
      cr[o] = r + cr[o - 1] + cr[o - W] - cr[o - W - 1];
      cd[o] = dn + cd[o - 1] + cd[o - W] - cd[o - W - 1];
    }
  const box = (t, x0, y0, x1, y1) => (x1 <= x0 || y1 <= y0 ? 0 : t[y1 * W + x1] - t[y0 * W + x1] - t[y1 * W + x0] + t[y0 * W + x0]); // prettier-ignore
  const cutInside = (k, i, j) => {
    const sz = 1 << k;
    const x0 = i * sz;
    const y0 = j * sz;
    return box(cr, x0, y0, x0 + sz - 1, y0 + sz) + box(cd, x0, y0, x0 + sz, y0 + sz - 1) > 0;
  };
  const priority = (k, i, j) => {
    if (cutInside(k, i, j)) return Infinity;
    let kids = 0;
    for (let dj = 0; dj < 2; dj++)
      for (let di = 0; di < 2; di++) kids += sse(k - 1, 2 * i + di, 2 * j + dj);
    const q = 1 << (2 * k);
    const near = S[k][(j * nx[k] + i) * 5 + 4] / q;
    const gain = (sse(k, i, j) - kids) * (1 + 0.5 * near);
    // a block bigger than 2 by 2 with detail in it splits before any 2 by 2 block does
    return k >= 2 && sse(k, i, j) / q > FLAT_VAR ? 1e9 + gain : gain;
  };
  // a max-heap of the blocks that could split (level >= 1), keyed by priority
  const off = [0];
  for (let k = 1; k <= levels; k++) off.push(off[k - 1] + (k === 1 ? 0 : nx[k - 1] * ny[k - 1]));
  const total = off[levels] + nx[levels] * ny[levels];
  const hk = new Float64Array(total);
  const hv = new Int32Array(total);
  let hn = 0;
  const push = (key, v) => {
    let i = hn++;
    while (i > 0) {
      const p = (i - 1) >> 1;
      if (hk[p] >= key) break;
      hk[i] = hk[p];
      hv[i] = hv[p];
      i = p;
    }
    hk[i] = key;
    hv[i] = v;
  };
  const pop = () => {
    const v = hv[0];
    const key = hk[--hn];
    const val = hv[hn];
    let i = 0;
    for (;;) {
      let c = 2 * i + 1;
      if (c >= hn) break;
      if (c + 1 < hn && hk[c + 1] > hk[c]) c++;
      if (hk[c] <= key) break;
      hk[i] = hk[c];
      hv[i] = hv[c];
      i = c;
    }
    hk[i] = key;
    hv[i] = val;
    return v;
  };
  const idOf = (k, i, j) => off[k] + j * nx[k] + i;
  const fromId = (id) => {
    let k = levels;
    while (k > 1 && id < off[k]) k--;
    const r = id - off[k];
    return [k, r % nx[k], Math.floor(r / nx[k])];
  };
  const isSplit = new Uint8Array(total);
  for (let j = 0; j < ny[levels]; j++)
    for (let i = 0; i < nx[levels]; i++) push(priority(levels, i, j), idOf(levels, i, j));
  let n = nx[levels] * ny[levels];
  const split = new Array(levels + 1).fill(0);
  while (hn > 0 && n + 3 <= count) {
    const id = pop();
    const [k, i, j] = fromId(id);
    isSplit[id] = 1;
    split[k]++;
    n += 3;
    if (k > 1)
      for (let dj = 0; dj < 2; dj++)
        for (let di = 0; di < 2; di++)
          push(priority(k - 1, 2 * i + di, 2 * j + dj), idOf(k - 1, 2 * i + di, 2 * j + dj));
  }
  // the splats: the blocks not split, walked from the top
  const x = new Int32Array(n);
  const y = new Int32Array(n);
  const size = new Int32Array(n);
  const per = new Array(levels + 1).fill(0);
  let o = 0;
  const walk = (k, i, j) => {
    if (k > 0 && isSplit[idOf(k, i, j)]) {
      for (let dj = 0; dj < 2; dj++)
        for (let di = 0; di < 2; di++) walk(k - 1, 2 * i + di, 2 * j + dj);
      return;
    }
    const sz = 1 << k;
    x[o] = i * sz;
    y[o] = j * sz;
    size[o] = sz;
    per[k]++;
    o++;
  };
  for (let j = 0; j < ny[levels]; j++) for (let i = 0; i < nx[levels]; i++) walk(levels, i, j);
  return { n: o, x, y, size, split, levels: per };
}
