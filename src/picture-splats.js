// Pictures to splats (lane Pictures): turns a picture's pixels into a flat
// sheet of splats, packed straight into the layout of a kit container's
// textures (dataCenter, dataColor, dataScale, dataRotation, splatAnim), so
// the main thread only copies them in. Pure JavaScript with no imports: it
// runs in src/pictures-worker.js, and Node tools and tests can call it too.
//
// Three methods:
// - "pixels" (photos and frames): one small flat splat per pixel, over a
//   smooth base of the picture's own colors a hair behind it.
// - "ink" (documents): the paper is a smooth sheet in the paper's own color
//   (found per block, so off-white and uneven scanned paper works), and
//   every pixel that differs from the paper under it (ink, figures) gets a
//   small flat splat of its own color, a hair in front of the paper.
// - "screen" (video and GIF frames): the same splats as "pixels", but each
//   takes its color from the sheet's live texture on the GPU (the kit's
//   "screen" behavior), so a new frame only uploads a texture.
//
// Sizes, from the September 28 tests: a detail splat is a flat disc with a
// sigma of 0.6 pixel (neighbors close up to about 96% cover with no blur
// beyond a pixel); the base is two staggered lattices of 8-pixel blocks
// with a sigma of 0.45 block (97% cover, smooth: no grid); the detail sits
// 0.75 block in front of the base, so the paper does not sort over the ink
// until the page is seen from more than about 60 degrees off its face.

export const SHEET_METHODS = ["pixels", "ink", "screen"];

// Behavior kinds, as in KINDS in src/effects.js.
const KIND_SCREEN = 15;
const KIND_LEAF = 21;
const NO_PATTERN = 16;

const BLOCK = 8;
const DETAIL_SIGMA = 0.6;
const BASE_SIGMA = 0.45 * BLOCK;
const LIFT = 0.75 * BLOCK;
// Flat splats: thickness as a share of their width.
const FLAT = 0.02;
// An ink pixel differs from the paper under it by more than this (0..1 in
// any channel).
const INK_TOLERANCE = 0.075;
// The paper's edge: rows of long, thin splats along each edge, from the
// edge inwards (pixel distances and widths across), so the sheet's edge is
// as sharp as a pixel while the paper inside stays coarse.
const EDGE_ROWS = [
  [0.5, 0.6],
  [1.5, 0.6],
  [3, 0.9],
  [5, 1.2],
  [7.5, 1.6],
  [10.5, 2],
];
const EDGE_STEP = 3;
const EDGE_ALONG = 2;

// ---- Half floats ----------------------------------------------------------------

const f32 = new Float32Array(1);
const u32 = new Uint32Array(f32.buffer);
export function toHalf(v) {
  f32[0] = v;
  const x = u32[0];
  const sign = (x >>> 16) & 0x8000;
  let e = ((x >>> 23) & 0xff) - 127 + 15;
  let m = x & 0x7fffff;
  if (e >= 31) return sign | 0x7c00;
  if (e <= 0) {
    if (e < -10) return sign;
    m = (m | 0x800000) >> (1 - e);
    return sign | ((m + 0x1000) >> 13);
  }
  const h = sign | (e << 10) | (m >> 13);
  return m & 0x1000 ? h + 1 : h;
}

// ---- Geometry --------------------------------------------------------------------

const len = (v) => Math.hypot(v[0], v[1], v[2]) || 1;
const unit = (v) => {
  const l = len(v);
  return [v[0] / l, v[1] / l, v[2] / l];
};
const cross = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]]; // prettier-ignore

// Quaternion (x, y, z, w) of the basis whose columns are x, y, z.
function quatBasis(x, y, z) {
  const [m00, m10, m20] = x;
  const [m01, m11, m21] = y;
  const [m02, m12, m22] = z;
  const tr = m00 + m11 + m22;
  let q;
  if (tr > 0) {
    const s = Math.sqrt(tr + 1) * 2;
    q = [(m21 - m12) / s, (m02 - m20) / s, (m10 - m01) / s, 0.25 * s];
  } else if (m00 > m11 && m00 > m22) {
    const s = Math.sqrt(1 + m00 - m11 - m22) * 2;
    q = [0.25 * s, (m01 + m10) / s, (m02 + m20) / s, (m21 - m12) / s];
  } else if (m11 > m22) {
    const s = Math.sqrt(1 + m11 - m00 - m22) * 2;
    q = [(m01 + m10) / s, 0.25 * s, (m12 + m21) / s, (m02 - m20) / s];
  } else {
    const s = Math.sqrt(1 + m22 - m00 - m11) * 2;
    q = [(m02 + m20) / s, (m12 + m21) / s, 0.25 * s, (m10 - m01) / s];
  }
  const l = Math.hypot(...q) || 1;
  return q.map((v) => v / l);
}

// ---- Paper -----------------------------------------------------------------------

// The paper color of each block: the mean of the block's lighter pixels
// (those at or above its median lightness), then smoothed with its
// neighbors. Dark blocks (a photo inside the page) borrow from the page's
// most common paper color, so a figure does not stain the paper round it.
function paperBlocks(px, w, h) {
  const bw = Math.ceil(w / BLOCK);
  const bh = Math.ceil(h / BLOCK);
  const out = new Float32Array(bw * bh * 3);
  // Lightness in whole numbers (r * 30 + g * 59 + b * 11), so the median
  // and the test against it agree exactly. (With a Float32 copy a flat
  // block could round its median above its own pixels, leave none to
  // average and turn the paper NaN, drawn as a black square.)
  const lum = new Uint32Array(BLOCK * BLOCK);
  const light = (o) => px[o] * 30 + px[o + 1] * 59 + px[o + 2] * 11;
  // The page's most common color (5 bits a channel), for fallback.
  const hist = new Uint32Array(32768);
  for (let i = 0; i < w * h; i += 3) {
    const o = i * 4;
    hist[((px[o] >> 3) << 10) | ((px[o + 1] >> 3) << 5) | (px[o + 2] >> 3)]++;
  }
  let best = 0;
  for (let i = 1; i < hist.length; i++) if (hist[i] > hist[best]) best = i;
  const mode = [((best >> 10) * 8 + 4) / 255, (((best >> 5) & 31) * 8 + 4) / 255, ((best & 31) * 8 + 4) / 255]; // prettier-ignore
  for (let by = 0; by < bh; by++)
    for (let bx = 0; bx < bw; bx++) {
      let n = 0;
      const x0 = bx * BLOCK;
      const y0 = by * BLOCK;
      const x1 = Math.min(w, x0 + BLOCK);
      const y1 = Math.min(h, y0 + BLOCK);
      for (let y = y0; y < y1; y++)
        for (let x = x0; x < x1; x++) {
          const o = (y * w + x) * 4;
          lum[n++] = light(o);
        }
      const sorted = lum.slice(0, n).sort();
      const med = sorted[n >> 1];
      let r = 0;
      let g = 0;
      let b = 0;
      let k = 0;
      for (let y = y0; y < y1; y++)
        for (let x = x0; x < x1; x++) {
          const o = (y * w + x) * 4;
          if (light(o) < med) continue;
          r += px[o];
          g += px[o + 1];
          b += px[o + 2];
          k++;
        }
      const c = k ? [r / k / 255, g / k / 255, b / k / 255] : mode;
      // Much darker than the page's paper: not paper (a figure, a photo).
      const dark = mode[0] + mode[1] + mode[2] - (c[0] + c[1] + c[2]) > 0.45;
      out.set(dark ? mode : c, (by * bw + bx) * 3);
    }
  // Smooth: a 3 x 3 mean, twice.
  let src = out;
  for (let pass = 0; pass < 2; pass++) {
    const dst = new Float32Array(src.length);
    for (let by = 0; by < bh; by++)
      for (let bx = 0; bx < bw; bx++) {
        let r = 0;
        let g = 0;
        let b = 0;
        let k = 0;
        for (let dy = -1; dy <= 1; dy++)
          for (let dx = -1; dx <= 1; dx++) {
            const x = bx + dx;
            const y = by + dy;
            if (x < 0 || y < 0 || x >= bw || y >= bh) continue;
            const o = (y * bw + x) * 3;
            r += src[o];
            g += src[o + 1];
            b += src[o + 2];
            k++;
          }
        const o = (by * bw + bx) * 3;
        dst[o] = r / k;
        dst[o + 1] = g / k;
        dst[o + 2] = b / k;
      }
    src = dst;
  }
  return { colors: src, bw, bh, mode };
}

// The mean color of each block (the base under a photo).
function meanBlocks(px, w, h) {
  const bw = Math.ceil(w / BLOCK);
  const bh = Math.ceil(h / BLOCK);
  const out = new Float32Array(bw * bh * 3);
  for (let by = 0; by < bh; by++)
    for (let bx = 0; bx < bw; bx++) {
      let r = 0;
      let g = 0;
      let b = 0;
      let k = 0;
      for (let y = by * BLOCK; y < Math.min(h, by * BLOCK + BLOCK); y++)
        for (let x = bx * BLOCK; x < Math.min(w, bx * BLOCK + BLOCK); x++) {
          const o = (y * w + x) * 4;
          r += px[o];
          g += px[o + 1];
          b += px[o + 2];
          k++;
        }
      out.set([r / k / 255, g / k / 255, b / k / 255], (by * bw + bx) * 3);
    }
  return { colors: out, bw, bh };
}

// Bilinear block color at pixel (x, y).
function blockColor(blocks, x, y, out) {
  const { colors, bw, bh } = blocks;
  const fx = Math.min(bw - 1, Math.max(0, x / BLOCK - 0.5));
  const fy = Math.min(bh - 1, Math.max(0, y / BLOCK - 0.5));
  const x0 = Math.floor(fx);
  const y0 = Math.floor(fy);
  const x1 = Math.min(bw - 1, x0 + 1);
  const y1 = Math.min(bh - 1, y0 + 1);
  const tx = fx - x0;
  const ty = fy - y0;
  for (let c = 0; c < 3; c++) {
    const a = colors[(y0 * bw + x0) * 3 + c] * (1 - tx) + colors[(y0 * bw + x1) * 3 + c] * tx;
    const b = colors[(y1 * bw + x0) * 3 + c] * (1 - tx) + colors[(y1 * bw + x1) * 3 + c] * tx;
    out[c] = a * (1 - ty) + b * ty;
  }
  return out;
}

// ---- Relief (lane Books r5) -------------------------------------------------------

// A map's value at fractional cell (fx, fy), bilinear, clamped at the edges.
function bilinear(d, rw, rh, fx, fy) {
  const x = Math.min(rw - 1, Math.max(0, fx));
  const y = Math.min(rh - 1, Math.max(0, fy));
  const x0 = Math.floor(x);
  const y0 = Math.floor(y);
  const x1 = Math.min(rw - 1, x0 + 1);
  const y1 = Math.min(rh - 1, y0 + 1);
  const tx = x - x0;
  const ty = y - y0;
  const a = d[y0 * rw + x0] * (1 - tx) + d[y0 * rw + x1] * tx;
  const b = d[y1 * rw + x0] * (1 - tx) + d[y1 * rw + x1] * tx;
  return a * (1 - ty) + b * ty;
}

// The lowest value within r cells (a square), in two passes.
function minFilter(d, rw, rh, r) {
  const a = new Float32Array(rw * rh);
  const b = new Float32Array(rw * rh);
  for (let y = 0; y < rh; y++)
    for (let x = 0; x < rw; x++) {
      let m = Infinity;
      for (let k = Math.max(0, x - r); k <= Math.min(rw - 1, x + r); k++) m = Math.min(m, d[y * rw + k]); // prettier-ignore
      a[y * rw + x] = m;
    }
  for (let y = 0; y < rh; y++)
    for (let x = 0; x < rw; x++) {
      let m = Infinity;
      for (let k = Math.max(0, y - r); k <= Math.min(rh - 1, y + r); k++) m = Math.min(m, a[k * rw + x]); // prettier-ignore
      b[y * rw + x] = m;
    }
  return b;
}

// ---- The sheet -------------------------------------------------------------------

// Counts, for sizing: how many splats a sheet of w x h pixels needs (an
// upper bound for "ink", which depends on the page).
export function sheetCount(w, h, method, inkPixels = w * h) {
  const lattice = 2 * Math.ceil(w / BLOCK + 1) * Math.ceil(h / BLOCK + 1);
  const edge = method === "ink" ? EDGE_ROWS.length * Math.ceil((2 * (w + h)) / EDGE_STEP + 8) : 0;
  return lattice + edge + (method === "ink" ? inkPixels : w * h);
}

// Builds a sheet. job: {
//   pixels (RGBA8, w * h * 4; for "screen" it may be null), w, h, method,
//   origin: [x, y, z] the top-left corner in toy coordinates,
//   right: [x, y, z] one pixel to the right, down: one pixel down,
//   normal: the side the picture faces (unit),
//   part: the kit part index (0: the body),
//   leaf: null, or { slot, spine: [x, y, z] (a point on the spine), dir:
//     [x, y, z] (unit, from the spine along the page) } for a page that
//     bends (kind "leaf"),
//   opacity (default 0.99),
//   relief: null, or { w, h, d (w * h values, 0 at the sheet to 1 at the
//     most raised), amount (toy units at 1) } to raise the picture off the
//     sheet toward its facing (lane Books r5: a figure that pops out). The
//     base under the detail takes the lowest relief round it, so it never
//     shows in front of the detail.
// }
// Returns { count, center (Float32 x4), color, scale, rotation (Uint16 half
// x4), anim (Float32 x4), centers (Float32 x3), ink (the detail count) }.
export function buildSheet(job) {
  const { w, h, method } = job;
  const px = job.pixels;
  const right = job.right;
  const down = job.down;
  const pitch = len(right);
  const xh = unit(right);
  const nz = unit(job.normal);
  const yh = cross(nz, xh);
  const q = quatBasis(xh, yh, nz);
  const qh = [toHalf(q[3]), toHalf(q[0]), toHalf(q[1]), toHalf(q[2])];
  const opacity = job.opacity ?? 0.99;
  const screen = method === "screen";
  const part = (job.part || 0) + NO_PATTERN;
  const leaf = job.leaf || null;
  const kind = screen ? KIND_SCREEN : leaf ? KIND_LEAF : 0;

  // Base colors, and which pixels get a detail splat.
  let blocks = null;
  let inkMask = null;
  let inkCount = w * h;
  if (!screen) {
    if (method === "ink") {
      blocks = paperBlocks(px, w, h);
      inkMask = new Uint8Array(w * h);
      inkCount = 0;
      const paper = [0, 0, 0];
      const tol = INK_TOLERANCE * 255;
      for (let y = 0; y < h; y++)
        for (let x = 0; x < w; x++) {
          const i = y * w + x;
          const o = i * 4;
          blockColor(blocks, x + 0.5, y + 0.5, paper);
          if (
            Math.abs(px[o] - paper[0] * 255) > tol ||
            Math.abs(px[o + 1] - paper[1] * 255) > tol ||
            Math.abs(px[o + 2] - paper[2] * 255) > tol
          ) {
            inkMask[i] = 1;
            inkCount++;
          }
        }
    } else blocks = meanBlocks(px, w, h);
  }

  const cap = sheetCount(w, h, method, inkCount);
  const center = new Float32Array(cap * 4);
  const centers = new Float32Array(cap * 3);
  const color = new Uint16Array(cap * 4);
  const scale = new Uint16Array(cap * 4);
  const rotation = new Uint16Array(cap * 4);
  const anim = new Float32Array(cap * 4);
  let n = 0;
  const [ox, oy, oz] = job.origin;
  const lift = LIFT * pitch;
  const one = toHalf(1);
  const alpha = toHalf(opacity);
  const lo = [Infinity, Infinity, Infinity];
  const hi = [-Infinity, -Infinity, -Infinity];
  // Lane Books r5: the relief, sampled at a pixel of the picture.
  const rel = job.relief?.d && job.relief.amount && job.relief.w > 0 && job.relief.h > 0 ? job.relief : null; // prettier-ignore
  const relLow = rel ? minFilter(rel.d, rel.w, rel.h, Math.max(1, Math.ceil((2.2 * BASE_SIGMA * rel.w) / w))) : null; // prettier-ignore
  const raise = (map, x, y) => rel.amount * Math.max(0, Math.min(1, bilinear(map, rel.w, rel.h, (x / w) * rel.w - 0.5, (y / h) * rel.h - 0.5))); // prettier-ignore

  // One splat at pixel coordinates (x, y), `up` world units in front of
  // the sheet, with sigmas sx, sy in pixels and color rgb (0..1), or for a
  // screen, uv at its center.
  const emit = (x, y, up, sx, sy, r, g, b) => {
    // (The detail sits `lift` up; the base and the edge at 0 take the low relief.)
    if (rel) up += up > 0 ? raise(rel.d, x, y) : raise(relLow, x, y);
    const i4 = n * 4;
    const i3 = n * 3;
    const px0 = ox + right[0] * x + down[0] * y + nz[0] * up;
    const py0 = oy + right[1] * x + down[1] * y + nz[1] * up;
    const pz0 = oz + right[2] * x + down[2] * y + nz[2] * up;
    center[i4] = centers[i3] = px0;
    center[i4 + 1] = centers[i3 + 1] = py0;
    center[i4 + 2] = centers[i3 + 2] = pz0;
    if (px0 < lo[0]) lo[0] = px0;
    if (py0 < lo[1]) lo[1] = py0;
    if (pz0 < lo[2]) lo[2] = pz0;
    if (px0 > hi[0]) hi[0] = px0;
    if (py0 > hi[1]) hi[1] = py0;
    if (pz0 > hi[2]) hi[2] = pz0;
    if (screen) {
      color[i4] = color[i4 + 1] = color[i4 + 2] = one;
    } else {
      color[i4] = toHalf(r);
      color[i4 + 1] = toHalf(g);
      color[i4 + 2] = toHalf(b);
    }
    color[i4 + 3] = alpha;
    const s0 = sx * pitch;
    const s1 = sy * pitch;
    scale[i4] = toHalf(s0);
    scale[i4 + 1] = toHalf(s1);
    scale[i4 + 2] = toHalf(Math.min(s0, s1) * FLAT);
    rotation[i4] = qh[0];
    rotation[i4 + 1] = qh[1];
    rotation[i4 + 2] = qh[2];
    rotation[i4 + 3] = qh[3];
    anim[i4] = part;
    anim[i4 + 1] = kind;
    if (screen) {
      anim[i4 + 2] = x / w;
      anim[i4 + 3] = y / h;
    } else if (leaf) {
      // How far along the page from its spine, and the leaf's slot.
      const d = leaf.dir;
      anim[i4 + 2] = (px0 - leaf.spine[0]) * d[0] + (py0 - leaf.spine[1]) * d[1] + (pz0 - leaf.spine[2]) * d[2]; // prettier-ignore
      anim[i4 + 3] = leaf.slot;
    }
    n++;
  };

  // The base: two staggered lattices of blocks. For "ink" it stays clear of
  // the edges (the edge rows finish them); for pixels the detail covers the
  // edge, so the base only keeps its soft rim inside.
  const inset = method === "ink" ? EDGE_ROWS[EDGE_ROWS.length - 1][0] + 1 : 2.2 * BASE_SIGMA;
  const c = [0, 0, 0];
  for (let pass = 0; pass < 2; pass++) {
    const off = pass * BLOCK * 0.5;
    for (let y = inset + off; y <= h - inset; y += BLOCK)
      for (let x = inset + off; x <= w - inset; x += BLOCK) {
        if (!screen) blockColor(blocks, x, y, c);
        emit(x, y, 0, BASE_SIGMA, BASE_SIGMA, c[0], c[1], c[2]);
      }
  }

  // The paper's edge rows ("ink" only).
  if (method === "ink") {
    const edges = [
      // start, direction along, direction inwards, length
      [[0, 0], [1, 0], [0, 1], w],
      [[0, h], [1, 0], [0, -1], w],
      [[0, 0], [0, 1], [1, 0], h],
      [[w, 0], [0, 1], [-1, 0], h],
    ];
    for (const [s, a, inw, L] of edges)
      for (const [d, across] of EDGE_ROWS) {
        const steps = Math.ceil(L / EDGE_STEP);
        for (let k = 0; k <= steps; k++) {
          const t = Math.min(L, k * EDGE_STEP);
          const x = s[0] + a[0] * t + inw[0] * d;
          const y = s[1] + a[1] * t + inw[1] * d;
          blockColor(blocks, x, y, c);
          // Along x: wide in x; along y: wide in y.
          const sx = a[0] ? EDGE_ALONG : across;
          const sy = a[0] ? across : EDGE_ALONG;
          emit(x, y, 0, sx, sy, c[0], c[1], c[2]);
        }
      }
  }

  // The detail: one splat per pixel (every pixel, or the ink).
  for (let y = 0; y < h; y++)
    for (let x = 0; x < w; x++) {
      const i = y * w + x;
      if (inkMask && !inkMask[i]) continue;
      const o = i * 4;
      if (screen) emit(x + 0.5, y + 0.5, lift, DETAIL_SIGMA, DETAIL_SIGMA, 1, 1, 1);
      else emit(x + 0.5, y + 0.5, lift, DETAIL_SIGMA, DETAIL_SIGMA, px[o] / 255, px[o + 1] / 255, px[o + 2] / 255); // prettier-ignore
    }

  return {
    count: n,
    ink: inkCount,
    center,
    centers,
    color,
    scale,
    rotation,
    anim,
    aabb: { min: lo, max: hi },
    paper: blocks?.mode || null,
  };
}
