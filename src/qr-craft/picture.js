// Lane QR craft: a picture woven into a QR code (a halftone QR code).
//
// Each module is cut into k × k small cells. The middle c × c cells keep the
// module's bit (pure dark or pure light), because a reader decides each
// module from a sample at its center; the rest carry the picture, pushed
// toward dark in a dark module and toward light in a light one by as much as
// the contrast asks. The finder, alignment and timing patterns and the format
// information stay plain modules, so a reader finds and sets up the grid as
// on any code. The idea follows Chu, Chang, Lee, Lee and Mitra, "Halftone QR
// Codes" (ACM SIGGRAPH Asia 2013), which keeps a module's center and uses the
// rest for a halftone.
//
// Everything here is plain JavaScript on arrays, so the toy (src/packs/
// qr-craft.js) and the tests (tests/qrc-picture.spec.mjs, in Node with jsQR)
// use the very same layout.

import { weaveDetail, finishDetail, projectHalftone } from "./detail.js";
import { fitPadding } from "../qr/picture-padding.js";
import { fitPictureErrors } from "../qr/picture-errors.js";
import { rotateCode, inversePicture } from "./orientation.js";
import { checkDetailViews } from "./views.js";
import { fidelityScorer } from "./fidelity.js";
import { cropCirclePicture } from "./frame.js";
import { shapeHalf } from "../qr/circle.js";
import { fastBlur } from "./fast-blur.js";
import { fastRaster } from "./fast-raster.js";
import { detailFraction } from "./detail-policy.js";

import { encodeQR, ROLE, QUIET } from "../qr/encode.js";

export { QUIET };
export const FG = [0.07, 0.08, 0.1];
export const BG = [1, 1, 1];

// The center dot: k cells a module, c of them (each way) keep the bit.
export const CENTERS = [
  { id: "small", label: "Small (a third)", k: 3, c: 1 },
  { id: "medium", label: "Medium (three sevenths)", k: 7, c: 3 },
  { id: "big", label: "Big (three fifths)", k: 5, c: 3 },
];
export const centerById = (id) => CENTERS.find((x) => x.id === id) || CENTERS[0];
export const LEVELS = ["L", "M", "Q", "H"];
export const STYLES = [
  { id: "color", label: "Color" },
  { id: "bw", label: "Black and white (dithered)" },
];

// Gray as QR readers see it (Rec. 709 weights on the stored values, as jsQR
// and ZXing do).
export const gray = (c) => 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2];
const grayAt = (c, q) => 0.2126 * c[q] + 0.7152 * c[q + 1] + 0.0722 * c[q + 2];
const clamp01 = (x) => Math.min(1, Math.max(0, x));
// WCAG relative luminance and contrast ratio.
export function luminance(c) {
  const l = (x) => (x <= 0.04045 ? x / 12.92 : Math.pow((x + 0.055) / 1.055, 2.4));
  return 0.2126 * l(c[0]) + 0.7152 * l(c[1]) + 0.0722 * l(c[2]);
}
export const ratio = (a, b) =>
  (Math.max(luminance(a), luminance(b)) + 0.05) / (Math.min(luminance(a), luminance(b)) + 0.05);

// The gray a cell may reach at contrast `a` (0: the picture as it is, 1: the
// plain code): a dark module's cells at most `dark`, a light one's at least
// `light`.
export const limits = (a) => ({ dark: 1 - 0.85 * clamp01(a), light: 0.85 * clamp01(a) });

// Darkens (or lightens) a color just enough to reach a gray, keeping its hue.
export function toDark(c, max) {
  const g = gray(c);
  if (g <= max) return c.slice();
  const f = max / Math.max(g, 1e-6);
  return [c[0] * f, c[1] * f, c[2] * f];
}
export function toLight(c, min) {
  const g = gray(c);
  if (g >= min) return c.slice();
  const f = (1 - min) / Math.max(1 - g, 1e-6);
  return [1 - (1 - c[0]) * f, 1 - (1 - c[1]) * f, 1 - (1 - c[2]) * f];
}

// A picture: { w, h, data } with data Float32Array(w * h * 3), 0..1. The
// middle square of it, averaged down to n × n (area averaging).
export function squareSample(pic, n) {
  const side = Math.min(pic.w, pic.h);
  const x0 = (pic.w - side) / 2;
  const y0 = (pic.h - side) / 2;
  const out = new Float32Array(n * n * 3);
  const step = side / n;
  // Up to 4 × 4 samples a cell (enough to average a big photo down).
  const s = Math.max(1, Math.min(4, Math.ceil(step)));
  for (let j = 0; j < n; j++)
    for (let i = 0; i < n; i++) {
      let r = 0;
      let g = 0;
      let b = 0;
      for (let v = 0; v < s; v++)
        for (let u = 0; u < s; u++) {
          const px = Math.min(pic.w - 1, Math.floor(x0 + (i + (u + 0.5) / s) * step));
          const py = Math.min(pic.h - 1, Math.floor(y0 + (j + (v + 0.5) / s) * step));
          const o = (py * pic.w + px) * 3;
          r += pic.data[o];
          g += pic.data[o + 1];
          b += pic.data[o + 2];
        }
      const q = (j * n + i) * 3;
      out[q] = r / (s * s);
      out[q + 1] = g / (s * s);
      out[q + 2] = b / (s * s);
    }
  return out;
}

// Which modules stay plain: the finder (with its separator), alignment and
// timing patterns, and the format and version information.
export function plainModules(code) {
  const N = code.size;
  const plain = new Uint8Array(N * N);
  for (let i = 0; i < N * N; i++) plain[i] = code.role[i] !== ROLE.data ? 1 : 0;
  // The finders' separators (role data in encode.js) stay light and plain too.
  for (const [r0, c0] of [[0, 0], [0, N - 8], [N - 8, 0]]) // prettier-ignore
    for (let r = r0; r < r0 + 8; r++) for (let c = c0; c < c0 + 8; c++) plain[r * N + c] = 1;
  return plain;
}

// Lane QR r4: the weave is a real halftone QR code now (Chu, Chang, Lee,
// Lee and Mitra's method, simplified). Before, every picture cell was pushed
// toward its module's color, so the random pattern of the modules outweighed
// the photo. Now:
//
// - Each module is k × k cells (3 × 3 by default), the middle carrying the
//   bit. The finders, separators, timing, alignment and format information
//   stay plain.
// - Error diffusion (Floyd–Steinberg, serpentine) runs over the whole grid.
//   The forced cells (the plain modules and the middles) keep their color and
//   pass their error on to the free cells next to them, so the picture's
//   tones come out right around them too. Free cells are dark or light: black
//   or white in the black-and-white style, the picture's own color darkened
//   or lightened in the color style (a color halftone).
// - Nothing pushes a module toward its color as such. A reliability nudge
//   turns free cells to the module's color only where a module would misread:
//   where a camera, a little out of focus, would see it on the wrong side of
//   the middle gray by less than `margin`. The contrast sets the margin, and
//   the toy steps it up until the scan check passes (makeWoven with `read`).
// - The mask is the one of the eight whose modules agree best with the
//   picture, and a larger version (more modules) gives more detail.

// The gray the free cells take in the color style: a dark cell's color is the
// picture's, darkened to at most DARK; a light one's lightened to at least
// LIGHT.
const DARK = 0.25;
const LIGHT = 0.78;
// A forced cell's gray in the color style: as dark as the ink, as light as
// the paper nearly.
const FORCED_DARK = 0.1;
const FORCED_LIGHT = 0.9;
// Shifts a color's gray to `to` by adding the same amount to each channel
// (which keeps its colorfulness, where scaling toward black or white washes
// it out), then darkens or lightens what the clamping left.
function shiftTo(c, to) {
  const d = to - gray(c);
  const s = [clamp01(c[0] + d), clamp01(c[1] + d), clamp01(c[2] + d)];
  return d < 0 ? toDark(s, to) : toLight(s, to);
}

// How much each of a module's k × k cells counts in what a camera sees at
// the module's center: a Gaussian blur of SIGMA modules (more than the
// check's blur of a fifth of a module: the pixels, and a camera's own
// softness), normalized over the module.
const SIGMA = 0.28;
const erf = (x) => {
  // Abramowitz and Stegun 7.1.26.
  const t = 1 / (1 + 0.3275911 * Math.abs(x));
  const y = 1 - ((((1.061405429 * t - 1.453152027) * t + 1.421413741) * t - 0.284496736) * t + 0.254829592) * t * Math.exp(-x * x); // prettier-ignore
  return x < 0 ? -y : y;
};
export function cellWeights(k, sigma = SIGMA) {
  const one = [];
  const cdf = (x) => 0.5 * (1 + erf(x / (sigma * Math.SQRT2)));
  for (let i = 0; i < k; i++) one.push(cdf((i + 1) / k - 0.5) - cdf(i / k - 0.5));
  const w = new Float32Array(k * k);
  let sum = 0;
  for (let v = 0; v < k; v++) for (let u = 0; u < k; u++) sum += w[v * k + u] = one[u] * one[v];
  for (let i = 0; i < k * k; i++) w[i] /= sum;
  return w;
}

// The margin a module is kept from the middle gray at contrast a: none at 0
// (the picture as it is, only the middles), 0.1 at the default 0.5, and on
// up to the plain code at 1.
export const marginAt = (a) => (a <= 0 ? -1 : a <= 0.6 ? 0.2 * a : 0.12 + 0.38 * Math.min(1, (a - 0.6) / 0.4)); // prettier-ignore

// The mask whose modules agree best with the picture: the least, over the
// data modules, of how far the picture's gray is from each module's color.
export function fitMask(text, level, pic, { min = 1 } = {}) {
  let best = null,
    sampled = null,
    stencil = null,
    sampledSize = 0;
  for (let mask = 0; mask < 8; mask++) {
    const code = encodeQR(text, level, { boost: false, mask, min });
    if (!pic) return code;
    const N = code.size;
    if (sampledSize !== N) {
      sampled = squareSample(pic, N);
      stencil = plainModules(code);
      sampledSize = N;
    }
    const src = sampled,
      plain = stencil;
    let cost = 0;
    for (let i = 0; i < N * N; i++) {
      if (plain[i]) continue;
      const g = grayAt(src, i * 3);
      cost += Math.abs(g - (code.dark[i] ? 0 : 1));
    }
    if (!best || cost < best.cost) best = { code, cost };
  }
  return best.code;
}

// The woven code: { code, k, c, G, cells: Float32Array(G * G * 3), plain,
// center (per cell, 1 where it keeps the bit), forced (per cell, 1 for a
// middle or plain cell, 2 for a nudged one) }. G = size × k (the quiet zone
// is plain light, not in the grid). o: { contrast (0..1), center, style,
// margin (overrides the contrast's) }.
export function weave(code, pic, o = {}) {
  const N = code.size;
  const { k, c } = centerById(o.center);
  const G = N * k;
  const a = o.contrast ?? 0.5;
  const margin = o.margin ?? marginAt(a);
  const plain = plainModules(code);
  const src = pic ? squareSample(pic, G) : null;
  const bw = o.style === "bw";
  const lo = (k - c) / 2;
  const center = new Uint8Array(G * G);
  // forced: 0 free, 1 a middle or plain cell, 2 nudged; fdark: its color.
  const forced = new Uint8Array(G * G);
  const fdark = new Uint8Array(G * G);
  for (let y = 0; y < G; y++)
    for (let x = 0; x < G; x++) {
      const m = Math.floor(y / k) * N + Math.floor(x / k);
      const u = x % k;
      const v = y % k;
      const mid = u >= lo && u < lo + c && v >= lo && v < lo + c;
      if (mid) center[y * G + x] = 1;
      if (mid || plain[m] || !src) {
        forced[y * G + x] = 1;
        fdark[y * G + x] = code.dark[m];
      }
    }
  const cells = new Float32Array(G * G * 3);
  const target = new Float32Array(G * G);
  // A forced cell's color. Lane QR r4 (the owner's note of October 9, 2026,
  // "a little bit easier to see the image"): in the color style a middle or
  // nudged cell keeps the picture's own hue, made as dark as the code's ink
  // or as light as its paper, so the dots carry the picture's color too; the
  // plain patterns stay ink and paper.
  const forcedColor = (j) => {
    const m = Math.floor(Math.floor(j / G) / k) * N + Math.floor((j % G) / k);
    const ink = fdark[j] === 1;
    if (bw || !src || plain[m]) return ink ? FG : BG;
    const p = [src[j * 3], src[j * 3 + 1], src[j * 3 + 2]];
    return shiftTo(p, ink ? FORCED_DARK : FORCED_LIGHT);
  };
  if (src) for (let i = 0; i < G * G; i++) target[i] = grayAt(src,i*3); // prettier-ignore
  const dither = () => {
    const err = new Float32Array(G * G);
    for (let y = 0; y < G; y++) {
      const dir = y % 2 ? -1 : 1;
      const next = [
        [dir, 0, 7],
        [-dir, 1, 3],
        [0, 1, 5],
        [dir, 1, 1],
      ];
      for (let i = 0; i < G; i++) {
        const x = dir > 0 ? i : G - 1 - i;
        const j = y * G + x;
        const want = Math.min(1.5, Math.max(-0.5, target[j] + err[j]));
        const q = j * 3;
        let col;
        if (forced[j]) col = forcedColor(j);
        else {
          const ink = want < 0.5;
          if (bw) col = ink ? FG : BG;
          else {
            const p = [src[q], src[q + 1], src[q + 2]];
            col = ink ? (gray(p) <= DARK ? p : shiftTo(p, DARK)) : gray(p) >= LIGHT ? p : shiftTo(p, LIGHT); // prettier-ignore
          }
        }
        cells[q] = col[0];
        cells[q + 1] = col[1];
        cells[q + 2] = col[2];
        if (!src) continue;
        // The error goes on to the free cells not yet visited (Floyd–
        // Steinberg's weights, shared among those that are free).
        const e = want - gray(col);
        let wsum = 0;
        for (const [dx, dy, w] of next) {
          const X = x + dx;
          const Y = y + dy;
          if (X >= 0 && X < G && Y < G && !forced[Y * G + X]) wsum += w;
        }
        if (!wsum) continue;
        for (const [dx, dy, w] of next) {
          const X = x + dx;
          const Y = y + dy;
          if (X >= 0 && X < G && Y < G && !forced[Y * G + X]) err[Y * G + X] += (e * w) / wsum;
        }
      }
    }
  };
  dither();
  // The nudge: where a module would read too close to the middle gray (or
  // on the wrong side of it), turn its free cells to its color, the ones that
  // count most and stray least from the picture first, until it doesn't.
  // The diffusion runs again after each round, so the cells around carry the
  // tone; a last round fixes any module the rerun moved.
  const W = cellWeights(k);
  // Readers set each part of the picture against its own surroundings (jsQR
  // takes the mean of about 5 × 5 modules around it), so a module is read
  // against the middle gray and the mean gray of the modules around it, half
  // and half.
  const R = 2;
  const localThreshold = () => {
    const mg = new Float32Array(N * N);
    for (let y = 0; y < G; y++)
      for (let x = 0; x < G; x++) {
        const j = y * G + x;
        mg[Math.floor(y / k) * N + Math.floor(x / k)] += grayAt(cells,j*3) / (k * k); // prettier-ignore
      }
    const t = new Float32Array(N * N);
    for (let r = 0; r < N; r++)
      for (let c2 = 0; c2 < N; c2++) {
        let sum = 0;
        let n = 0;
        for (let dr = -R; dr <= R; dr++)
          for (let dc = -R; dc <= R; dc++) {
            const rr = r + dr;
            const cc = c2 + dc;
            if (rr < 0 || cc < 0 || rr >= N || cc >= N) {
              sum += 1; // the quiet zone
              n++;
              continue;
            }
            sum += mg[rr * N + cc];
            n++;
          }
        t[r * N + c2] = 0.5 * (0.5 + sum / n);
      }
    return t;
  };
  let nudged = 0;
  if (src && margin > -1) {
    for (let round = 0; round < 4; round++) {
      let changed = 0;
      const thr = localThreshold();
      for (let m = 0; m < N * N; m++) {
        if (plain[m]) continue;
        const r = Math.floor(m / N);
        const col = m % N;
        const dark = code.dark[m] === 1;
        const list = [];
        let seen = 0;
        for (let v = 0; v < k; v++)
          for (let u = 0; u < k; u++) {
            const j = (r * k + v) * G + col * k + u;
            const g = grayAt(cells, j * 3);
            seen += W[v * k + u] * g;
            if (!forced[j]) list.push({ j, w: W[v * k + u], g, off: Math.abs(target[j] - (dark ? 0 : 1)) }); // prettier-ignore
          }
        const short = () => (dark ? seen - (thr[m] - margin) : thr[m] + margin - seen);
        if (short() <= 0) continue;
        // The cells that move the reading most for the least change in look.
        const to = dark ? FORCED_DARK : FORCED_LIGHT;
        const score = (p) => (p.w * Math.abs(p.g - to)) / (0.05 + p.off);
        list.sort((p, q) => score(q) - score(p));
        for (const it of list) {
          if (short() <= 0) break;
          forced[it.j] = 2;
          fdark[it.j] = dark ? 1 : 0;
          const q = it.j * 3;
          const cc = forcedColor(it.j);
          seen += it.w * (gray(cc) - it.g);
          cells[q] = cc[0];
          cells[q + 1] = cc[1];
          cells[q + 2] = cc[2];
          changed++;
        }
      }
      nudged += changed;
      if (!changed) break;
      if (round < 3) dither();
    }
  }
  return { code, k, c, G, cells, plain, center, forced, nudged, margin, contrast: a, style: bw ? "bw" : "color" }; // prettier-ignore
}

// The measured contrast of a woven code: the mean color of its dark modules'
// cells against its light modules' (what a blurry or distant camera sees),
// and the worst pair among the picture cells (dark module's lightest cell
// against light module's darkest). Ratios as WCAG's.
export function measure(w) {
  const { code, k, G, cells } = w;
  const N = code.size;
  const sum = [
    [0, 0, 0, 0],
    [0, 0, 0, 0],
  ];
  const centerSum = [
    [0, 0, 0, 0],
    [0, 0, 0, 0],
  ];
  let worstDark = 0;
  let worstLight = 1;
  for (let y = 0; y < G; y++)
    for (let x = 0; x < G; x++) {
      const m = Math.floor(y / k) * N + Math.floor(x / k);
      const d = code.dark[m];
      const q = (y * G + x) * 3;
      const col = [cells[q], cells[q + 1], cells[q + 2]];
      const s = sum[d];
      s[0] += col[0];
      s[1] += col[1];
      s[2] += col[2];
      s[3]++;
      if (w.fidelity === "detail" && w.center[y * G + x]) {
        const cs = centerSum[d];
        cs[0] += col[0];
        cs[1] += col[1];
        cs[2] += col[2];
        cs[3]++;
      }
      if (!w.plain[m] && !w.center[y * G + x]) {
        const g = gray(col);
        if (d) worstDark = Math.max(worstDark, g);
        else worstLight = Math.min(worstLight, g);
      }
    }
  const mean = (s) => [s[0] / s[3], s[1] / s[3], s[2] / s[3]];
  const md = mean(sum[1]);
  const ml = mean(sum[0]);
  return {
    module: ratio(md, ml), // whole modules, averaged
    center: w.fidelity === "detail" ? ratio(mean(centerSum[1]), mean(centerSum[0])) : ratio(FG, BG), // the center dots
    darkGray: gray(md),
    lightGray: gray(ml),
    // The gray gap between the lightest dark cell and the darkest light one
    // (negative: some picture cells cross over).
    gap: worstLight - worstDark,
  };
}

// The woven code as an RGBA picture of `ppm` pixels a module (any number),
// with its quiet zone, each pixel the average of 4 × 4 samples (as a camera
// or a downscale averages it). Returns { data: Uint8ClampedArray, width,
// height }.
export function rasterize(
  w,
  ppm,
  { quiet = QUIET, samples = 4, blur = 0, accelerated = true } = {},
) {
  const N = w.code.size;
  const total = N + 2 * quiet;
  const W = Math.max(1, Math.round(total * ppm));
  const data = new Uint8ClampedArray(W * W * 4);
  const s = samples;
  const whiteQuiet = BG.every((channel) => channel === 1);
  if (whiteQuiet) data.fill(255);
  // Pixel positions are shared by every row/column. Keep the original sample
  // order and arithmetic so the legacy raster remains byte-identical.
  const indices = new Int32Array(W * s);
  const active = new Uint8Array(W);
  for (let p = 0; p < W; p++)
    for (let u = 0; u < s; u++) {
      const m = ((p + (u + 0.5) / s) / W) * total - quiet;
      indices[p * s + u] = m < 0 || m >= N ? -1 : Math.floor(m * w.k);
      if (indices[p * s + u] >= 0) active[p] = 1;
    }
  if (!whiteQuiet || !accelerated || !fastRaster(w, indices, active, data, W, s))
    for (let py = 0; py < W; py++) {
      if (whiteQuiet && !active[py]) continue;
      for (let px = 0; px < W; px++) {
        if (whiteQuiet && !active[px]) continue;
        let r = 0,
          g = 0,
          b = 0;
        for (let v = 0; v < s; v++) {
          const y = indices[py * s + v];
          for (let u = 0; u < s; u++) {
            const x = indices[px * s + u];
            if (x < 0 || y < 0) {
              r += BG[0];
              g += BG[1];
              b += BG[2];
            } else {
              const q = (y * w.G + x) * 3;
              r += w.cells[q];
              g += w.cells[q + 1];
              b += w.cells[q + 2];
            }
          }
        }
        const o = (py * W + px) * 4;
        data[o] = (255 * r) / (s * s);
        data[o + 1] = (255 * g) / (s * s);
        data[o + 2] = (255 * b) / (s * s);
        data[o + 3] = 255;
      }
    }
  if (blur > 0) gaussBlur(data, W, W, blur * ppm, null, accelerated);
  return { data, width: W, height: W };
}

// A Gaussian blur of `sigma` pixels, in place (a camera slightly out of focus).
export function gaussBlur(data, W, H, sigma, scratch = null, accelerated = true) {
  if (sigma < 0.3) return;
  const r = Math.ceil(sigma * 3);
  const kern = [];
  let sum = 0;
  for (let i = -r; i <= r; i++) sum += kern[kern.push(Math.exp(-(i * i) / (2 * sigma * sigma))) - 1]; // prettier-ignore
  for (let i = 0; i < kern.length; i++) kern[i] /= sum;
  try {
    if (accelerated && fastBlur(data, W, H, kern)) return;
  } catch {
    // A memory limit leaves the original JavaScript check available.
  }
  const tmp = scratch?.length >= W * H * 3 ? scratch : new Float32Array(W * H * 3);
  // Precompute clamped edge offsets, shared by RGB and every pixel on its
  // row/column. Keep each channel's summation order and Float32 intermediate.
  const diameter = kern.length;
  const xs = new Int32Array(W * diameter),
    ys = new Int32Array(H * diameter);
  for (let x = 0; x < W; x++)
    for (let i = -r; i <= r; i++)
      xs[x * diameter + i + r] = Math.min(W - 1, Math.max(0, x + i)) * 4;
  for (let y = 0; y < H; y++)
    for (let i = -r; i <= r; i++)
      ys[y * diameter + i + r] = Math.min(H - 1, Math.max(0, y + i)) * W * 3;
  for (let y = 0; y < H; y++)
    for (let x = 0; x < W; x++) {
      let red = 0,
        green = 0,
        blue = 0;
      const row = y * W * 4,
        start = x * diameter;
      for (let i = 0; i < diameter; i++) {
        const q = row + xs[start + i];
        const weight = kern[i];
        red += weight * data[q];
        green += weight * data[q + 1];
        blue += weight * data[q + 2];
      }
      const q = (y * W + x) * 3;
      tmp[q] = red;
      tmp[q + 1] = green;
      tmp[q + 2] = blue;
    }
  for (let y = 0; y < H; y++)
    for (let x = 0; x < W; x++) {
      let red = 0,
        green = 0,
        blue = 0;
      const col = x * 3,
        start = y * diameter;
      for (let i = 0; i < diameter; i++) {
        const q = col + ys[start + i];
        const weight = kern[i];
        red += weight * tmp[q];
        green += weight * tmp[q + 1];
        blue += weight * tmp[q + 2];
      }
      const q = (y * W + x) * 4;
      data[q] = red;
      data[q + 1] = green;
      data[q + 2] = blue;
    }
}

// The sizes the check reads at: "phone" about as a phone camera sees a code
// held at arm's length (8 pixels a module, as lane QR r3 measured), and a
// smaller one (4 pixels a module, the code a few times further away); each
// a little out of focus (a blur of a fifth of a module), as a camera is. A
// perfectly sharp picture reads at any contrast, because every center dot is
// pure dark or light; the blur mixes the picture into the center, as a real
// camera does.
export const SIZES = [
  { id: "phone", label: "phone size", ppm: 8, blur: 0.2 },
  { id: "small", label: "smaller", ppm: 4, blur: 0.2 },
];

export const STRICT = [...SIZES, { ppm: 8, blur: 0.3 }, { ppm: 4, blur: 0.3 }];

// Reads a woven code at each size with `read(rgba, w, h) => text | null`
// (jsQR). Returns { ok, sizes: [{ id, label, ppm, text, ok }] }.
export function checkWoven(w, read) {
  const want = w.code.text;
  const sizes = SIZES.map((s) => {
    const img = rasterize(w, s.ppm, { blur: s.blur });
    const text = read(img.data, img.width, img.height);
    return { ...s, text, ok: text === want };
  });
  return { ok: sizes.every((s) => s.ok), sizes };
}

// How much bigger than the smallest version that fits: "fit" (as small as
// it fits), "more" and "most" (more modules, so more detail).
export const SIZES_UP = [
  { id: "fit", label: "As small as it fits", up: 0 },
  { id: "more", label: "Bigger (more detail)", up: 4 },
  { id: "most", label: "Biggest (most detail)", up: 8 },
];

// The options a picture code is made with, tidied.
export function tidy(o = {}) {
  return {
    text: String(o.text ?? ""),
    fidelity: o.fidelity === "detail" && o.style !== "bw" ? "detail" : "standard",
    shape: o.shape === "circle" ? "circle" : "square",
    level: LEVELS.includes(o.level) ? o.level : "H",
    contrast: Number.isFinite(+o.contrast) ? clamp01(+o.contrast) : 0.5,
    center: centerById(o.center).id,
    style: o.style === "bw" ? "bw" : "color",
    size: SIZES_UP.some((s) => s.id === o.size) ? o.size : "fit",
  };
}

// Encodes (the mask that fits the picture best) and weaves. boost: false
// keeps the level asked for. With `read` (jsQR), the nudge's margin steps up
// from the contrast's until the woven code reads at both of the check's
// sizes, and a little more out of focus (at most to the plain code). extra:
// a step more to start from (the toy's, when its stage didn't read).
export function* detailCandidates(pic, o) {
  const t = tidy(o);
  const smallest = encodeQR(t.text, t.level, { boost: false }).version;
  const up = SIZES_UP.find((s) => s.id === t.size).up;
  let min = Math.min(40, smallest + up + Math.max(0, Math.round(o.detailUp || 0)));
  // The unchanged jsQR reader has an incorrect alignment-center entry for
  // version 23 (74 rather than 78). Keep this optional encoding readable.
  if (min === 23) min++;
  if (t.shape === "circle") pic = cropCirclePicture(pic, 17 + 4 * min);
  let code = fitMask(t.text, t.level, pic, { min });
  const baseCode = code;
  code = fitPadding(code, pic);
  let margin =
    o.margin ??
    Math.max(o.channel === "green" || o.channel === "weighted" ? 0.16 : 0.1, marginAt(t.contrast)) +
      (o.extra || 0);
  let finderEdge = 0.24,
    finderCore = 0.08;
  let score = null;
  const decorate = (candidate, rank = true) => {
    if (rank) {
      score ||= fidelityScorer(
        pic,
        code.size,
        t.shape,
        weave(baseCode, pic, { ...t, margin: marginAt(t.contrast) }),
      );
      candidate.fidelityScore = score(candidate);
    }
    if (o.texture === "tiles") {
      candidate.rendering.texture = "tiles";
      candidate.rendering.textureBlur = o.textureBlur || 0;
      candidate.rendering.textureGuard = o.textureGuard || 0;
      candidate.rendering.validation = o.captureValidation ? "capture" : "model";
    }
    return candidate;
  };
  const create = function* () {
    const options = {
      ...t,
      margin,
      finderEdge,
      finderCore,
      channel: o.channel,
      finderGuard: o.finderGuard,
    };
    if (o.preferContinuous) {
      let fraction =
        o.preferCorrection && o.texture === "tiles" && code.ecc === "H"
          ? Math.max(
              0,
              Math.min(
                o.errorFraction === 0.65 && detailFraction(pic, t.shape) === 0.65 ? 0.65 : 0.6,
                Number.isFinite(o.errorFraction) ? o.errorFraction : 0.4,
              ),
            )
          : 0;
      // Restore more correction reserve after an actual failure of this family,
      // before spending another capture on finder-tone changes.
      if (
        fraction > 0.4 &&
        o.rejected?.some((key) => {
          try {
            const failed = JSON.parse(key),
              center = centerById(t.center);
            return (
              Array.isArray(failed) &&
              failed[1] === code.version &&
              failed[2] === code.ecc &&
              failed[3] === code.mask &&
              failed[4] === center.k &&
              failed[5] === center.c &&
              failed[6] === margin
            );
          } catch {
            return false;
          }
        })
      )
        fraction = 0.4;
      const method = fraction ? "correction" : "continuous";
      const base = weaveDetail(
        fraction ? fitPictureErrors(code, pic, fraction, fraction === 0.65 ? 0.65 : 0.6) : code,
        pic,
        {
          ...options,
          method,
        },
      );
      const tones =
        o.texture === "tiles" ? [finderEdge, 0.32, 0.16, 0.08, 0.2, 0.28] : [finderEdge];
      const continuous = [];
      for (const tone of new Set(tones)) {
        const candidate = decorate(
          finishDetail(
            { ...base, cells: base.cells.slice() },
            { ...options, method, finderEdge: tone },
          ),
          false,
        );
        if (fraction) candidate.rendering.fraction = fraction;
        continuous.push(candidate);
      }
      // Two actual failures at this exact margin/mask/orientation make further
      // finder-only changes a poor next choice. Try independently checked
      // halftones and correction fits before rebuilding more of that family.
      if (continuous.filter((w) => o.rejected?.includes(renderingKey(w))).length < 2)
        yield* continuous.filter((w) => !o.rejected?.includes(renderingKey(w)));
    }
    const halftone = finishDetail(weave(code, pic, options), { ...options, method: "halftone" });
    const candidates = [
      ...(!o.preferContinuous || o.preferCorrection ? [weaveDetail(code, pic, options)] : []),
      halftone,
      projectHalftone(halftone, options),
      ...(o.texture === "tiles" ? [0.6, 0.4, 0.25] : []).map((fraction) => {
        const corrected = weaveDetail(fitPictureErrors(code, pic, fraction), pic, {
          ...options,
          method: "correction",
        });
        corrected.rendering.fraction = fraction;
        return corrected;
      }),
    ];
    yield* candidates
      .map((candidate) => decorate(candidate))
      .filter((w) => !o.rejected?.includes(renderingKey(w)))
      .sort((a, b) => b.fidelityScore.score - a.fidelityScore.score);
  };
  const initial = margin;
  const variants = [
    [0, 0.24, 0.08, 0],
    [0.02, 0.24, 0.08, 0],
    [0, 0.32, 0.08, 0],
    [0.02, 0.16, 0.16, 0],
    [0, 0.24, 0.08, 2],
    [0.02, 0.24, 0.08, 2],
    [0, 0.32, 0.08, 2],
    [0.02, 0.24, 0.08, 1],
    [0, 0.24, 0.08, 3],
    [0.04, 0.24, 0.08, 3],
    [0.08, 0.24, 0.08, 0],
    [0.12, 0.24, 0.08, 2],
  ];
  const physical = 720 / (2 * (shapeHalf(code, t.shape) + 1));
  const edgeCorrection =
    o.texture === "tiles" ? 0 : Math.min(0.08, Math.max(0, 8 - physical) * 0.04);
  let fallback = null,
    orientation = 0,
    tested = 0;
  const seen = new Set();
  for (let step = 0; step < variants.length; step++) {
    const [increase, edge, core, turns] = variants[step];
    margin = Math.min(0.5, initial + increase);
    finderEdge = edge === 0.24 ? edge + edgeCorrection : Math.min(0.36, edge + edgeCorrection / 2);
    finderCore = core;
    if (turns !== orientation) {
      code = turns
        ? rotateCode(fitPadding(baseCode, inversePicture(pic, baseCode.size, turns)), turns)
        : fitPadding(baseCode, pic);
      orientation = turns;
    }
    for (const w of create()) {
      const key = renderingKey(w);
      if (seen.has(key)) continue;
      seen.add(key);
      tested++;
      fallback ||= w;
      const check = yield w;
      w.detailCheck = { ...check, tried: step + 1, candidates: tested };
      if (check?.ok) return w;
      // A different spatial pattern can repair a failed first forecast without
      // cycling every finder tone. Accepted candidates retain the same checks.
      if (
        tested === 1 &&
        step === 0 &&
        !o.rejected?.length &&
        o.preferContinuous &&
        o.texture === "tiles"
      ) {
        const initialOptions = {
          ...t,
          margin: initial,
          finderEdge: 0.24,
          finderCore: 0.08,
          channel: o.channel,
          finderGuard: o.finderGuard,
        };
        const opposite = () =>
          decorate(
            weaveDetail(
              rotateCode(fitPadding(baseCode, inversePicture(pic, baseCode.size, 2)), 2),
              pic,
              initialOptions,
            ),
            false,
          );
        const backup = () => {
          const candidate = decorate(
            weaveDetail(fitPictureErrors(code, pic, 0.4), pic, {
              ...initialOptions,
              method: "correction",
            }),
            false,
          );
          candidate.rendering.fraction = 0.4;
          return candidate;
        };
        const higherBudget = w.rendering.method === "correction" && w.rendering.fraction > 0.4;
        const perspective = check?.preflight && [1, 2, 5].includes(check.view);
        const alternatives = higherBudget
          ? perspective
            ? [opposite, backup]
            : [backup, opposite]
          : [opposite];
        if (t.shape === "circle")
          for (const edge of [0.4, 0.42])
            alternatives.push(() => {
              const fraction = w.rendering.fraction || 0;
              const candidate = decorate(
                weaveDetail(fraction ? fitPictureErrors(code, pic, fraction) : code, pic, {
                  ...initialOptions,
                  finderEdge: edge,
                  method: fraction ? "correction" : "continuous",
                }),
                false,
              );
              if (fraction) candidate.rendering.fraction = fraction;
              return candidate;
            });
        if (t.shape === "circle")
          for (const mask of [0, 1, 2, 3, 4, 5, 6, 7])
            for (const edge of [0.4, 0.42])
              alternatives.push(() => {
                const fraction = w.rendering.fraction || 0;
                const alternateCode = fitPadding(
                  encodeQR(t.text, t.level, { boost: false, min: code.version, mask }),
                  pic,
                );
                const candidate = decorate(
                  weaveDetail(
                    fraction ? fitPictureErrors(alternateCode, pic, fraction) : alternateCode,
                    pic,
                    {
                      ...initialOptions,
                      finderEdge: edge,
                      method: fraction ? "correction" : "continuous",
                    },
                  ),
                  false,
                );
                if (fraction) candidate.rendering.fraction = fraction;
                return candidate;
              });
        for (const build of alternatives) {
          const alternative = build(),
            alternativeKey = renderingKey(alternative);
          if (seen.has(alternativeKey)) continue;
          seen.add(alternativeKey);
          tested++;
          const alternativeCheck = yield alternative;
          alternative.detailCheck = { ...alternativeCheck, tried: 1, candidates: tested };
          if (alternativeCheck?.ok) return alternative;
        }
      }
    }
  }
  fallback.detailCheck = {
    ...(fallback.detailCheck || {}),
    ok: false,
    exhausted: true,
    tried: variants.length,
    candidates: tested,
  };
  return fallback;
}

export function renderingKey(w) {
  return JSON.stringify([
    w.rendering.method,
    w.code.version,
    w.code.ecc,
    w.code.mask,
    w.k,
    w.c,
    w.margin,
    w.rendering.seedMargin ?? w.margin,
    w.code.rotation || 0,
    w.rendering.edge,
    w.rendering.core,
    w.rendering.fraction || 0,
    w.rendering.channel || "rgb",
    w.rendering.finderGuard ?? null,
  ]);
}

export function checkStrict(w, read, only = null) {
  return STRICT.filter(
    (s) => !only || ((!only.ppm || s.ppm === only.ppm) && (!only.blur || s.blur === only.blur)),
  ).every((s) => {
    const img = rasterize(w, s.ppm, { blur: s.blur });
    return read(img.data, img.width, img.height) === w.code.text;
  });
}

export async function makeWovenAsync(pic, o, validate, { isCurrent = () => true } = {}) {
  const started = performance.now();
  const current = () => {
    if (!isCurrent()) throw new DOMException("The picture changed.", "AbortError");
  };
  current();
  const t = tidy(o);
  if (t.fidelity !== "detail" || !pic) return makeWoven(pic, o);
  const candidates = detailCandidates(pic, o);
  let state = candidates.next();
  while (!state.done) {
    const candidateStarted = performance.now();
    const check = await validate(state.value, pic, t.shape);
    if (o.trace)
      console.log(
        "Picture QR candidate",
        JSON.stringify({
          rendering: state.value.rendering,
          margin: state.value.margin,
          ms: performance.now() - candidateStarted,
          check,
        }),
      );
    current();
    if (!check?.ok) {
      await new Promise((resolve) => setTimeout(resolve, 0));
      current();
    }
    state = candidates.next(check);
  }
  state.value.detailCheck.preparationMs = performance.now() - started;
  return state.value;
}

export function makeWoven(pic, o, read = null) {
  const t = tidy(o);
  if (t.fidelity === "detail" && pic) {
    const candidates = detailCandidates(pic, o);
    let state = candidates.next();
    if (!read) return state.value;
    while (!state.done) {
      const w = state.value;
      const check = checkStrict(w, read)
        ? checkDetailViews(w, read, t.shape, pic)
        : { ok: false, layout: true };
      state = candidates.next(check);
    }
    return state.value;
  }
  const smallest = encodeQR(t.text, t.level, { boost: false }).version;
  const up = SIZES_UP.find((s) => s.id === t.size).up;
  const code = fitMask(t.text, t.level, pic, { min: Math.min(40, smallest + up) });
  // Lane PIC2: at no contrast (a margin of -1, the picture as it is) a stage
  // step starts from the step itself, so each step still adds margin.
  const base = marginAt(t.contrast);
  let margin = o.margin ?? (base < 0 && o.extra > 0 ? o.extra : base + (o.extra || 0));
  let w = weave(code, pic, { ...t, margin });
  if (!read || !pic) return w;
  for (let step = 0; step < 16 && !checkStrict(w, read) && margin < 0.5; step++) {
    margin = margin < 0 ? 0.02 : Math.min(0.5, margin + 0.02);
    w = weave(code, pic, { ...t, margin });
  }
  return w;
}

// The closest version that scans: the options asked for first, then a little
// more contrast, a bigger center dot and a higher error correction level, in
// order of how much each changes the look. Returns { options, woven, check,
// tried, changed: [what changed, in words] } or null if none scans.
export function closestScanning(pic, o, read, { maxTries = 40 } = {}) {
  const t = tidy(o);
  let tried = 0;
  for (const c of repairOptions(t).slice(0, maxTries)) {
    tried++;
    const woven = makeWoven(pic, c.o, t.fidelity === "detail" ? read : null);
    const check = checkWoven(woven, read);
    if (check.ok && woven.detailCheck?.ok !== false)
      return { options: c.o, woven, check, tried, changed: describeChange(t, c.o) };
  }
  return null;
}

function repairOptions(t) {
  const ci = CENTERS.findIndex((x) => x.id === t.center);
  const li = LEVELS.indexOf(t.level);
  const cands = [];
  for (let da = 0; da <= 10; da++) {
    const a = Math.round((t.contrast + da * 0.1) * 100) / 100;
    if (a > 1.0001) break;
    for (let dc = 0; ci + dc < CENTERS.length; dc++)
      for (let dl = 0; li + dl < LEVELS.length; dl++)
        cands.push({ cost: da + 2.5 * dc + 3 * dl, o: { ...t, contrast: Math.min(1, a), center: CENTERS[ci + dc].id, level: LEVELS[li + dl] } }); // prettier-ignore
  }
  cands.sort((x, y) => x.cost - y.cost);
  return cands;
}

export async function closestScanningAsync(
  pic,
  o,
  read,
  validate,
  { maxTries = 40, isCurrent = () => true } = {},
) {
  const t = tidy(o);
  let tried = 0;
  for (const c of repairOptions(t).slice(0, maxTries)) {
    // Give input and navigation a turn between repair options, including when
    // worker support is unavailable.
    await new Promise((resolve) => setTimeout(resolve, 0));
    const woven = await makeWovenAsync(
      pic,
      { ...o, ...c.o, extra: o.extra || 0, rejected: o.rejected || [] },
      validate,
      { isCurrent },
    );
    tried++;
    const check = checkWoven(woven, read);
    if (check.ok && woven.detailCheck?.ok !== false)
      return { options: c.o, woven, check, tried, changed: describeChange(t, c.o) };
  }
  return null;
}

export function describeChange(a, b) {
  const out = [];
  if (b.contrast > a.contrast + 1e-6) out.push(`contrast ${Math.round(a.contrast * 100)}% → ${Math.round(b.contrast * 100)}%`); // prettier-ignore
  if (b.center !== a.center) out.push(`center dot ${centerById(a.center).id} → ${centerById(b.center).id}`); // prettier-ignore
  if (b.level !== a.level) out.push(`error correction ${a.level} → ${b.level}`);
  return out;
}
