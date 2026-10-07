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

// The woven code: { code, k, c, G, cells: Float32Array(G * G * 3), plain,
// center (per cell, 1 where it keeps the bit) }. G = size × k (the quiet zone
// is plain light, not in the grid). o: { contrast (0..1), center, style }.
export function weave(code, pic, o = {}) {
  const N = code.size;
  const { k, c } = centerById(o.center);
  const G = N * k;
  const a = o.contrast ?? 0.5;
  const lim = limits(a);
  const plain = plainModules(code);
  const src = pic ? squareSample(pic, G) : null;
  const cells = new Float32Array(G * G * 3);
  const center = new Uint8Array(G * G);
  const lo = (k - c) / 2;
  const bw = o.style === "bw";
  // For dithering: the gray each cell aims at, and the error carried on.
  const err = bw ? new Float32Array(G * G) : null;
  for (let y = 0; y < G; y++)
    for (let x = 0; x < G; x++) {
      const r = Math.floor(y / k);
      const col = Math.floor(x / k);
      const m = r * N + col;
      const dark = code.dark[m] === 1;
      const u = x - col * k;
      const v = y - r * k;
      const mid = u >= lo && u < lo + c && v >= lo && v < lo + c;
      const q = (y * G + x) * 3;
      let out;
      if (plain[m] || !src || mid) {
        out = dark ? FG : BG;
        if (mid) center[y * G + x] = 1;
      } else {
        const p = [src[q], src[q + 1], src[q + 2]];
        out = dark ? toDark(p, lim.dark) : toLight(p, lim.light);
        if (bw) {
          // Floyd–Steinberg on the gray, kept inside the module's limits.
          const want = clamp01(gray(out) + err[y * G + x]);
          const ink = want < 0.5;
          out = ink ? FG : BG;
          const e = want - (ink ? gray(FG) : gray(BG));
          const spread = (dx, dy, w) => {
            const X = x + dx;
            const Y = y + dy;
            if (X >= 0 && X < G && Y < G) err[Y * G + X] += e * w;
          };
          spread(1, 0, 7 / 16);
          spread(-1, 1, 3 / 16);
          spread(0, 1, 5 / 16);
          spread(1, 1, 1 / 16);
        }
      }
      cells[q] = out[0];
      cells[q + 1] = out[1];
      cells[q + 2] = out[2];
    }
  return { code, k, c, G, cells, plain, center, contrast: a, style: bw ? "bw" : "color" };
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
    center: ratio(FG, BG), // the center dots
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
export function rasterize(w, ppm, { quiet = QUIET, samples = 4, blur = 0 } = {}) {
  const N = w.code.size;
  const total = N + 2 * quiet;
  const W = Math.max(1, Math.round(total * ppm));
  const data = new Uint8ClampedArray(W * W * 4);
  const s = samples;
  for (let py = 0; py < W; py++)
    for (let px = 0; px < W; px++) {
      let r = 0;
      let g = 0;
      let b = 0;
      for (let v = 0; v < s; v++)
        for (let u = 0; u < s; u++) {
          // In modules, from the code's top-left corner.
          const mx = ((px + (u + 0.5) / s) / W) * total - quiet;
          const my = ((py + (v + 0.5) / s) / W) * total - quiet;
          if (mx < 0 || my < 0 || mx >= N || my >= N) {
            r += BG[0];
            g += BG[1];
            b += BG[2];
            continue;
          }
          const q = (Math.floor(my * w.k) * w.G + Math.floor(mx * w.k)) * 3;
          r += w.cells[q];
          g += w.cells[q + 1];
          b += w.cells[q + 2];
        }
      const o = (py * W + px) * 4;
      data[o] = (255 * r) / (s * s);
      data[o + 1] = (255 * g) / (s * s);
      data[o + 2] = (255 * b) / (s * s);
      data[o + 3] = 255;
    }
  if (blur > 0) gaussBlur(data, W, W, blur * ppm);
  return { data, width: W, height: W };
}

// A Gaussian blur of `sigma` pixels, in place (a camera slightly out of focus).
export function gaussBlur(data, W, H, sigma) {
  if (sigma < 0.3) return;
  const r = Math.ceil(sigma * 3);
  const kern = [];
  let sum = 0;
  for (let i = -r; i <= r; i++) sum += kern[kern.push(Math.exp(-(i * i) / (2 * sigma * sigma))) - 1]; // prettier-ignore
  for (let i = 0; i < kern.length; i++) kern[i] /= sum;
  const tmp = new Float32Array(W * H * 3);
  for (let y = 0; y < H; y++)
    for (let x = 0; x < W; x++)
      for (let c = 0; c < 3; c++) {
        let v = 0;
        for (let i = -r; i <= r; i++) v += kern[i + r] * data[(y * W + Math.min(W - 1, Math.max(0, x + i))) * 4 + c]; // prettier-ignore
        tmp[(y * W + x) * 3 + c] = v;
      }
  for (let y = 0; y < H; y++)
    for (let x = 0; x < W; x++)
      for (let c = 0; c < 3; c++) {
        let v = 0;
        for (let i = -r; i <= r; i++) v += kern[i + r] * tmp[(Math.min(H - 1, Math.max(0, y + i)) * W + x) * 3 + c]; // prettier-ignore
        data[(y * W + x) * 4 + c] = v;
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

// The options a picture code is made with, tidied.
export function tidy(o = {}) {
  return {
    text: String(o.text ?? ""),
    level: LEVELS.includes(o.level) ? o.level : "H",
    contrast: Number.isFinite(+o.contrast) ? clamp01(+o.contrast) : 0.5,
    center: centerById(o.center).id,
    style: o.style === "bw" ? "bw" : "color",
  };
}

// Encodes and weaves. boost: false keeps the level asked for.
export function makeWoven(pic, o) {
  const t = tidy(o);
  const code = encodeQR(t.text, t.level, { boost: false });
  return weave(code, pic, t);
}

// The closest version that scans: the options asked for first, then a little
// more contrast, a bigger center dot and a higher error correction level, in
// order of how much each changes the look. Returns { options, woven, check,
// tried, changed: [what changed, in words] } or null if none scans.
export function closestScanning(pic, o, read, { maxTries = 40 } = {}) {
  const t = tidy(o);
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
  let tried = 0;
  for (const c of cands.slice(0, maxTries)) {
    tried++;
    const woven = makeWoven(pic, c.o);
    const check = checkWoven(woven, read);
    if (check.ok) return { options: c.o, woven, check, tried, changed: describeChange(t, c.o) };
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
