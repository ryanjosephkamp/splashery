// Pure clip pixel and depth interpolation shared by the page and its worker.
// Moving these unchanged functions keeps renderer and media code off that worker.
import { cubicDepth } from "../live/clip-stabilize.js";

// RGBA (w by h) to a smaller w2 by h2, by averaging boxes; transparent parts
// as white paper.
export function shrink(data, w, h, w2, h2) {
  const out = new Uint8ClampedArray(w2 * h2 * 4);
  for (let y = 0; y < h2; y++)
    for (let x = 0; x < w2; x++) {
      const x0 = Math.floor((x * w) / w2);
      const x1 = Math.max(x0 + 1, Math.floor(((x + 1) * w) / w2));
      const y0 = Math.floor((y * h) / h2);
      const y1 = Math.max(y0 + 1, Math.floor(((y + 1) * h) / h2));
      let r = 0;
      let g = 0;
      let b = 0;
      let n = 0;
      for (let yy = y0; yy < y1; yy++)
        for (let xx = x0; xx < x1; xx++) {
          const o = (yy * w + xx) * 4;
          const a = data[o + 3] / 255;
          r += data[o] * a + 255 * (1 - a);
          g += data[o + 1] * a + 255 * (1 - a);
          b += data[o + 2] * a + 255 * (1 - a);
          n++;
        }
      const o = (y * w2 + x) * 4;
      out[o] = r / n;
      out[o + 1] = g / n;
      out[o + 2] = b / n;
      out[o + 3] = 255;
    }
  return out;
}

// Lane Photo fidelity r2: the depth (dw by dh, 0..1) enlarged to the frame (w by h) with the
// frame's colors as the guide (a joint bilateral filter, as Photo to 3D's upsampleDepth): each
// pixel takes the depths of the 3 by 3 depth cells around it, weighted by how near they lie and by
// how alike the frame's color there (averaged over the cell) is to the pixel's own, so a near
// thing's outline in the depth snaps to its outline in the picture. Where no cell's color is near
// the pixel's, it falls back to the plain depth. Tables stand in for the exponentials:
// a frame takes a few milliseconds per 100,000 pixels.
const GUIDE_SIGMA = 0.09; // how alike two colors (0..1, summed squares of r, g, b) must be
const GUIDE_LUT = 1024;
const GUIDE_MAX = 0.25; // a color difference (squared) beyond this weighs nothing
const rangeLut = (() => {
  const t = new Float32Array(GUIDE_LUT + 1);
  for (let i = 0; i <= GUIDE_LUT; i++)
    t[i] = i === GUIDE_LUT ? 0 : Math.exp(-((i / GUIDE_LUT) * GUIDE_MAX) / (2 * GUIDE_SIGMA * GUIDE_SIGMA)); // prettier-ignore
  return t;
})();
const GUIDE_MAPS = new Map();
function guideMaps(dw, dh, w, h) {
  const key = `${dw}x${dh}|${w}x${h}`;
  if (GUIDE_MAPS.has(key)) return GUIDE_MAPS.get(key);
  const sp = 1 / (2 * 0.8 * 0.8);
  const axis = (small, size, stride) => {
    const cells = new Int32Array(size * 3),
      weights = new Float32Array(size * 3);
    for (let i = 0; i < size; i++) {
      const value = ((i + 0.5) * small) / size - 0.5,
        center = Math.round(value);
      for (let a = 0; a < 3; a++) {
        const cell = center - 1 + a;
        cells[i * 3 + a] = Math.max(0, Math.min(small - 1, cell)) * stride;
        weights[i * 3 + a] = Math.exp(-((value - cell) ** 2) * sp);
      }
    }
    return { cells, weights };
  };
  const maps = { x: axis(dw, w, 1), y: axis(dh, h, dw) };
  GUIDE_MAPS.set(key, maps);
  if (GUIDE_MAPS.size > 4) GUIDE_MAPS.delete(GUIDE_MAPS.keys().next().value);
  return maps;
}
export function guidedDepth(dn, dw, dh, rgba, w, h) {
  // the frame's colors averaged over each depth cell (0..1)
  const lo = shrink(rgba, w, h, dw, dh);
  const gl = new Float32Array(dw * dh * 3);
  for (let k = 0; k < dw * dh; k++) {
    gl[k * 3] = lo[k * 4] / 255;
    gl[k * 3 + 1] = lo[k * 4 + 1] / 255;
    gl[k * 3 + 2] = lo[k * 4 + 2] / 255;
  }
  const out = new Float32Array(w * h);
  const scale = GUIDE_LUT / GUIDE_MAX;
  // the 3 by 3 depth cells around the nearest one, and their distance weights along each axis
  const maps = guideMaps(dw, dh, w, h);
  const ex = maps.x.weights,
    cx = maps.x.cells,
    ey = maps.y.weights,
    cy = maps.y.cells;
  for (let y = 0; y < h; y++) {
    const yb = y * 3;
    for (let x = 0; x < w; x++) {
      const xb = x * 3;
      const o = (y * w + x) * 4;
      const r = rgba[o] / 255;
      const g = rgba[o + 1] / 255;
      const b = rgba[o + 2] / 255;
      let sum = 0;
      let wsum = 0;
      let plain = 0;
      let psum = 0;
      for (let bj = 0; bj < 3; bj++)
        for (let a = 0; a < 3; a++) {
          const c = cy[yb + bj] + cx[xb + a];
          const dr = gl[c * 3] - r;
          const dg = gl[c * 3 + 1] - g;
          const db = gl[c * 3 + 2] - b;
          const q = (dr * dr + dg * dg + db * db) * scale;
          const s = ex[xb + a] * ey[yb + bj];
          const ws = s * rangeLut[q >= GUIDE_LUT ? GUIDE_LUT : q | 0];
          sum += ws * dn[c];
          wsum += ws;
          plain += s * dn[c];
          psum += s;
        }
      // where no cell's color is near the pixel's: the plain (distance-weighted) depth
      out[y * w + x] = wsum > 1e-3 * psum ? sum / wsum : plain / psum;
    }
  }
  return out;
}

// The nearness (0..1) at the picture's size (w by h) into `out`: depth
// pictures a and b blended by f (0 a .. 1 b), with adjacent answers setting
// their cubic tangents. Missing answers hold the last available depth.
export function blendNear(D, a, b, f) {
  const back = (i) => {
    for (let j = Math.min(i, D.n - 1); j >= 0; j--) if (D.frames[j]) return D.frames[j];
    return null;
  };
  const A = back(a);
  const B = back(b) || A;
  if (!A) return null;
  const P = back(a - 1) || A;
  const N = back(b + 1) || B;
  const { w: dw, h: dh } = D.ms;
  const blend = (D.blend ||= new Float32Array(dw * dh));
  for (let i = 0; i < blend.length; i++)
    blend[i] =
      B === A || f <= 0
        ? A[i] / 255
        : cubicDepth(P[i] / 255, A[i] / 255, B[i] / 255, N[i] / 255, f);
  return blend;
}
export function nearAt(D, a, b, f, w, h, out) {
  const blend = blendNear(D, a, b, f);
  if (!blend) return out.fill(0.5);
  const { w: dw, h: dh } = D.ms;
  for (let y = 0; y < h; y++) {
    const fy = Math.max(0, Math.min(dh - 1, ((y + 0.5) / h) * dh - 0.5));
    const y0 = Math.floor(fy);
    const y1 = Math.min(dh - 1, y0 + 1);
    const ay = fy - y0;
    for (let x = 0; x < w; x++) {
      const fx = Math.max(0, Math.min(dw - 1, ((x + 0.5) / w) * dw - 0.5));
      const x0 = Math.floor(fx);
      const x1 = Math.min(dw - 1, x0 + 1);
      const ax = fx - x0;
      const at = (F) => ((F[y0 * dw + x0] * (1 - ax) + F[y0 * dw + x1] * ax) * (1 - ay) + (F[y1 * dw + x0] * (1 - ax) + F[y1 * dw + x1] * ax) * ay); // prettier-ignore
      out[y * w + x] = at(blend);
    }
  }
  return out;
}
