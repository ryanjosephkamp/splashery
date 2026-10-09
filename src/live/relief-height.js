// Lane Photo depth (prefix pdp): the heights of the Sharp picture's relief, in plain JavaScript.
// No DOM, no PlayCanvas: src/live/relief-mesh.js (whose shaders compute the same heights on the
// graphics card) and the tests share it.
//
// The surface: each point takes the depth layer of its piece of surface (the splat build's own
// pieces, so a piece moves as one solid layer, as the splats do) and its height is
//   z = (1 - morph[layer]) * lift * (d - base) + (layer - 1.5) * layers
// where morph[layer] is that layer's tap channel (1 flat, 0 risen).
//
// The backing sheet behind it must stay behind at every moment of the tap's rise and flatten, not
// only at its ends. Its height at a point is the lowest the surface is anywhere near it, now: for
// each layer, the lowest depth of that layer's surface within reach is worked out once, at build
// (backingField), and each frame the backing takes the lowest of the four layers' heights at that
// depth (backingHeight), less a small offset. As each layer's height rises with its depth, that is
// the lowest point of the surface near it, whatever the four channels are doing.

export const NONE = 255; // (a layer with no surface within reach)

// The surface's height at a point of depth d (0..1) in a layer (0..3).
export function surfaceHeight(d, layer, { morph, lift, base, layers = 0 }) {
  return (1 - morph[layer]) * lift * (d - base) + (layer - 1.5) * layers;
}

// The backing's height from its four lowest depths (bytes, 0..254, or NONE): the lowest of the
// four layers' heights, plus `offset` (negative: behind).
export function backingHeight(mins, { morph, lift, base, layers = 0, offset = -0.012 }) {
  let z = Infinity;
  for (let b = 0; b < 4; b++) {
    if (mins[b] >= NONE) continue;
    const h = surfaceHeight(mins[b] / 255, b, { morph, lift, base, layers });
    if (h < z) z = h;
  }
  return (Number.isFinite(z) ? z : 0) + offset;
}

// The depth as the relief's texture holds it (bytes), from 0..1 floats.
export function depthBytes(d) {
  const out = new Uint8Array(d.length);
  for (let i = 0; i < d.length; i++) out[i] = Math.max(0, Math.min(255, Math.round(d[i] * 255)));
  return out;
}

// For each point of the backing's grid ((cols + 1) by (rows + 1) points, over the picture shrunk
// by `inset` about its center, as the backing sheet is), the lowest depth byte of each layer's
// surface within `reach` picture heights, as RGBA bytes (NONE where a layer has none).
//   depth  the relief's depth bytes (gx by gy), band  each cell's layer (gx by gy)
//   rim    the width of the border band (picture heights) where the surface eases into a softened
//          depth; soft  how far that softening reaches. Within reach of the border the backing also
//          stays below the lowest depth that softening can bring (as layer 0, the lowest of all), and
//          below `base` (the flat picture).
export function backingField(
  depth,
  band,
  gx,
  gy,
  { cols, rows, reach = 0.11, inset = 0.96, rim = 0.03, soft = 0.045, base = 0.5 },
) {
  // prettier-ignore
  // Every cell's lowest depth among itself and its eight neighbors (the texture's linear filter
  // mixes those into a point of the cell), kept under its own layer.
  const lo = new Uint8Array(gx * gy);
  for (let j = 0; j < gy; j++)
    for (let i = 0; i < gx; i++) {
      let m = 255;
      for (let dj = -1; dj <= 1; dj++) {
        const y = Math.min(gy - 1, Math.max(0, j + dj));
        for (let di = -1; di <= 1; di++) {
          const x = Math.min(gx - 1, Math.max(0, i + di));
          const v = depth[y * gx + x];
          if (v < m) m = v;
        }
      }
      lo[j * gx + i] = m;
    }
  // Blocks of k by k cells: each layer's lowest, and the lowest of all.
  const k = Math.max(1, Math.round(gy / 96));
  const bx = Math.ceil(gx / k);
  const by = Math.ceil(gy / k);
  const blk = new Uint8Array(bx * by * 4).fill(NONE);
  const all = new Uint8Array(bx * by).fill(255);
  for (let j = 0; j < gy; j++)
    for (let i = 0; i < gx; i++) {
      const c = j * gx + i;
      const q = ((j / k) | 0) * bx + ((i / k) | 0);
      const v = Math.min(254, lo[c]);
      const o = q * 4 + band[c];
      if (v < blk[o]) blk[o] = v;
      if (depth[c] < all[q]) all[q] = depth[c];
    }
  const out = new Uint8Array((cols + 1) * (rows + 1) * 4);
  // (a window in picture heights is this many cells across and down: the cells are square)
  const cellsPer = gy;
  for (let j = 0; j <= rows; j++)
    for (let i = 0; i <= cols; i++) {
      const u = 0.5 + (i / cols - 0.5) * inset;
      const v = 0.5 + (j / rows - 0.5) * inset;
      const ci = u * gx;
      const cj = v * gy;
      const r = reach * cellsPer;
      const x0 = Math.max(0, Math.floor((ci - r) / k));
      const x1 = Math.min(bx - 1, Math.floor((ci + r) / k));
      const y0 = Math.max(0, Math.floor((cj - r) / k));
      const y1 = Math.min(by - 1, Math.floor((cj + r) / k));
      const m = [NONE, NONE, NONE, NONE];
      for (let y = y0; y <= y1; y++)
        for (let x = x0; x <= x1; x++) {
          const q = (y * bx + x) * 4;
          for (let b = 0; b < 4; b++) if (blk[q + b] < m[b]) m[b] = blk[q + b];
        }
      // Near the border the surface eases into a softened depth (an average reaching `soft`
      // further), with its layers blended: below the lowest depth there, and never above the flat
      // picture, it stays behind whatever the channels do.
      const aspect = gx / gy;
      const near = Math.min(u * aspect, (1 - u) * aspect, v, 1 - v) < reach + rim;
      if (near) {
        const s = (reach + soft) * cellsPer;
        let a = 255;
        const sx0 = Math.max(0, Math.floor((ci - s) / k));
        const sx1 = Math.min(bx - 1, Math.floor((ci + s) / k));
        const sy0 = Math.max(0, Math.floor((cj - s) / k));
        const sy1 = Math.min(by - 1, Math.floor((cj + s) / k));
        for (let y = sy0; y <= sy1; y++)
          for (let x = sx0; x <= sx1; x++) if (all[y * bx + x] < a) a = all[y * bx + x];
        m[0] = Math.min(m[0], a, Math.floor(base * 255)); // (at most the flat picture's depth)
      }
      out.set(m, (j * (cols + 1) + i) * 4);
    }
  return out;
}

const smooth = (a, b, x) => {
  const t = Math.min(1, Math.max(0, (x - a) / (b - a)));
  return t * t * (3 - 2 * t);
};

// The depth texture's value at (u, v), as the graphics card's linear filter reads it (0..1).
export function sampleDepth(depth, gx, gy, u, v) {
  const x = Math.min(gx - 1, Math.max(0, u * gx - 0.5));
  const y = Math.min(gy - 1, Math.max(0, v * gy - 0.5));
  const x0 = Math.floor(x);
  const y0 = Math.floor(y);
  const x1 = Math.min(gx - 1, x0 + 1);
  const y1 = Math.min(gy - 1, y0 + 1);
  const fx = x - x0;
  const fy = y - y0;
  const a = depth[y0 * gx + x0] * (1 - fx) + depth[y0 * gx + x1] * fx;
  const b = depth[y1 * gx + x0] * (1 - fx) + depth[y1 * gx + x1] * fx;
  return (a * (1 - fy) + b * fy) / 255;
}

// The height of a surface point at (u, v), as the vertex shader works it out with pieces (for the
// tests): the depth eased into a softened one near the border, the piece's layer (blended by depth
// there), its channel and the layer spacing. `cols` and `rows` are the surface's grid cells.
export function surfacePoint(
  depth,
  band,
  gx,
  gy,
  u,
  v,
  { cols, rows, aspect, morph, lift, base, layers = 0 },
) {
  // prettier-ignore
  let d = sampleDepth(depth, gx, gy, u, v);
  const rd = Math.min(Math.min(u, 1 - u) * cols, Math.min(v, 1 - v) * rows);
  const pb = band[Math.min(gy - 1, Math.floor(v * gy)) * gx + Math.min(gx - 1, Math.floor(u * gx))];
  let b = pb;
  if (rd < 6) {
    let s = 0;
    const st = 0.02;
    for (let j = -2; j <= 2; j++)
      for (let i = -2; i <= 2; i++) {
        const su = Math.min(1, Math.max(0, u + (i * st) / aspect));
        const sv = Math.min(1, Math.max(0, v + j * st));
        s += sampleDepth(depth, gx, gy, su, sv);
      }
    const w = smooth(2, 6, rd);
    d = (s / 25) * (1 - w) + d * w;
    b = Math.min(3, Math.max(0, d * 4 - 0.5)) * (1 - w) + pb * w;
  }
  const i0 = Math.min(Math.floor(b), 2);
  const f = b - i0;
  const m = morph[i0] * (1 - f) + morph[i0 + 1] * f;
  return (1 - m) * lift * (d - base) + (b - 1.5) * layers;
}
