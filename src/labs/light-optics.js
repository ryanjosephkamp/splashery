// Lane Sound and light lab: the sums behind the Light lab, pure and
// testable in Node.
//
//   nmColor(nm)               a wavelength's color on screen (Dan Bruton's approximation)
//   bk7(nm)                   the refractive index of BK7 glass (Schott's Sellmeier fit)
//   prismRay(nm, prism)       a ray traced through a prism (Snell's law at both faces)
//   gratingAngle(nm, d, m)    the angle of order m from a grating of pitch d (normal incidence)
//   GRATINGS                  a CD, a DVD and a 1000-line-per-mm slide
//   lineSpectrum(el, ...)     an element's lines, nearby components merged for the eye
//   profileOf(img, ...)       a band of a picture averaged into a brightness per column
//   calibrate(profile, ...)   pixels to nanometers from two known mercury lines
//   samplePhoto(...)          a made-up photo of a fluorescent lamp's spectrum

import { NIST_LINES } from "./nist-lines.js";

export const NM_LO = 380;
export const NM_HI = 750;

// ---- Color ------------------------------------------------------------------------
// Dan Bruton's piecewise-linear approximation of the visible spectrum
// (Physics and Astronomy, Stephen F. Austin State University, "Approximate
// RGB values for Visible Wavelengths"), with its fade at both ends and its
// gamma of 0.8. Screens can't show pure spectral colors; this is the usual
// stand-in. Returns [r, g, b] in 0..1.
export function nmColor(nm) {
  let r = 0;
  let g = 0;
  let b = 0;
  if (nm >= 380 && nm < 440) {
    r = -(nm - 440) / (440 - 380);
    b = 1;
  } else if (nm >= 440 && nm < 490) {
    g = (nm - 440) / (490 - 440);
    b = 1;
  } else if (nm >= 490 && nm < 510) {
    g = 1;
    b = -(nm - 510) / (510 - 490);
  } else if (nm >= 510 && nm < 580) {
    r = (nm - 510) / (580 - 510);
    g = 1;
  } else if (nm >= 580 && nm < 645) {
    r = 1;
    g = -(nm - 645) / (645 - 580);
  } else if (nm >= 645 && nm <= 780) {
    r = 1;
  }
  let f = 0;
  if (nm >= 380 && nm < 420) f = 0.3 + (0.7 * (nm - 380)) / (420 - 380);
  else if (nm >= 420 && nm <= 700) f = 1;
  else if (nm > 700 && nm <= 780) f = 0.3 + (0.7 * (780 - nm)) / (780 - 700);
  const gam = (c) => (c > 0 ? (c * f) ** 0.8 : 0);
  return [gam(r), gam(g), gam(b)];
}

export const nmHex = (nm, k = 1) =>
  `#${nmColor(nm).map((c) => Math.round(Math.min(1, c * k) * 255).toString(16).padStart(2, "0")).join("")}`; // prettier-ignore

// ---- Glass ------------------------------------------------------------------------
// Schott N-BK7, its Sellmeier coefficients (wavelength in micrometers):
// n² − 1 = Σ Bᵢ λ² / (λ² − Cᵢ). n = 1.5168 at the sodium d line (587.6 nm).
export const BK7 = { B: [1.03961212, 0.231792344, 1.01046945], C: [0.00600069867, 0.0200179144, 103.560653] }; // prettier-ignore
export function bk7(nm) {
  const l2 = (nm / 1000) ** 2;
  let s = 1;
  for (let i = 0; i < 3; i++) s += (BK7.B[i] * l2) / (l2 - BK7.C[i]);
  return Math.sqrt(s);
}

// ---- The prism --------------------------------------------------------------------
// A prism in the x–z plane (a table seen from above): an equilateral
// triangle of side `side`, apex angle A = 60°, its base along x at z = zb
// (the far side), its apex toward +z (the viewer). Light comes in from the
// left; a prism bends it toward its base, so the colors fan out toward the
// card at the back (z = zCard). prismRay returns the entry and exit points,
// the point on the card, and the deviation (radians), or null where the ray
// is totally internally reflected or misses.

const sub = (a, b) => [a[0] - b[0], a[1] - b[1]];
const add = (a, b) => [a[0] + b[0], a[1] + b[1]];
const mul = (a, s) => [a[0] * s, a[1] * s];
const dot = (a, b) => a[0] * b[0] + a[1] * b[1];
const unit = (a) => mul(a, 1 / Math.hypot(a[0], a[1]));

// Refraction of direction d at a surface with normal nrm (pointing toward
// the incoming side), from index n1 to n2 (Snell's law in vector form).
export function refract(d, nrm, n1, n2) {
  const cosi = -dot(nrm, d);
  const eta = n1 / n2;
  const k = 1 - eta * eta * (1 - cosi * cosi);
  if (k < 0) return null; // total internal reflection
  return unit(add(mul(d, eta), mul(nrm, eta * cosi - Math.sqrt(k))));
}

// Where the ray p + t d meets the segment a–b (t > 0), or null.
function hit(p, d, a, b) {
  const e = sub(b, a);
  const den = d[0] * e[1] - d[1] * e[0];
  if (Math.abs(den) < 1e-12) return null;
  const w = sub(a, p);
  const t = (w[0] * e[1] - w[1] * e[0]) / den;
  const s = (w[0] * d[1] - w[1] * d[0]) / den;
  return t > 1e-9 && s >= 0 && s <= 1 ? add(p, mul(d, t)) : null;
}

export function prismGeometry({ side = 0.9, cx = 0, zb = -0.3 } = {}) {
  const h = (side * Math.sqrt(3)) / 2;
  // x–z points: [x, z]. The base is at the back, the apex toward the viewer.
  return { a: [cx - side / 2, zb], b: [cx + side / 2, zb], apex: [cx, zb + h], side, h };
}

// The beam that passes the prism at minimum deviation for index n (inside,
// it runs parallel to the base), aimed at the middle of the left face:
// { from, dir }, starting `back` before the face.
export function minDeviationBeam(prism, n, back = 1.6) {
  const A = Math.PI / 3;
  const i = Math.asin(n * Math.sin(A / 2)); // from the face's normal
  const ang = i - A / 2; // above the base's direction (toward +z)
  const dir = [Math.cos(ang), Math.sin(ang)];
  const m = [(prism.a[0] + prism.apex[0]) / 2, (prism.a[1] + prism.apex[1]) / 2];
  return { from: [m[0] - dir[0] * back, m[1] - dir[1] * back], dir, mid: m };
}

export function prismRay(
  nm,
  { prism = prismGeometry(), from = [-2, 0], dir = [1, 0], zCard = -1.4, n = bk7(nm) } = {},
) {
  const { a, b, apex } = prism;
  const d0 = unit(dir);
  // The left face (a to apex) and the right face (apex to b); outward normals.
  const p1 = hit(from, d0, a, apex);
  if (!p1) return null;
  const nl = unit([-(apex[1] - a[1]), apex[0] - a[0]]); // left face's outward normal
  const nL = dot(nl, sub(a, [prism.a[0] / 2 + prism.b[0] / 2, (prism.a[1] + prism.b[1] + apex[1]) / 3])) > 0 ? nl : mul(nl, -1); // prettier-ignore
  const d1 = refract(d0, nL, 1, n);
  if (!d1) return null;
  const p2 = hit(p1, d1, apex, b);
  if (!p2) return null;
  const nr = unit([-(b[1] - apex[1]), b[0] - apex[0]]);
  const ctr = [(a[0] + b[0] + apex[0]) / 3, (a[1] + b[1] + apex[1]) / 3];
  const nR = dot(nr, sub(b, ctr)) > 0 ? nr : mul(nr, -1);
  // Leaving the glass: the normal must face the inside (the incoming side).
  const d2 = refract(d1, mul(nR, -1), n, 1);
  if (!d2) return null;
  if (d2[1] >= 0) return null; // never reaches the card
  const t = (zCard - p2[1]) / d2[1];
  const p3 = add(p2, mul(d2, t));
  const dev = Math.acos(Math.max(-1, Math.min(1, dot(d0, d2))));
  return { n, p1, p2, p3, d1, d2, deviation: dev };
}

// The textbook deviation at minimum: δ = 2 asin(n sin(A / 2)) − A, for a
// prism of apex angle A (radians).
export const minDeviation = (n, A = Math.PI / 3) => 2 * Math.asin(n * Math.sin(A / 2)) - A;

// ---- The grating ------------------------------------------------------------------
// d sin θ = m λ at normal incidence. A CD's tracks are 1.6 µm apart and a
// DVD's about 0.74 µm (about 625 and 1350 tracks per mm); a grating slide of
// 1000 lines per mm is 1 µm. A disc reflects rather than lets the light
// through; at normal incidence the angles are the same.
export const GRATINGS = {
  cd: { label: "A CD (1.6 µm tracks, 625 per mm)", d: 1600 },
  dvd: { label: "A DVD (0.74 µm tracks, about 1350 per mm)", d: 740 },
  slide: { label: "A grating slide (1000 lines per mm)", d: 1000 },
};
export function gratingAngle(nm, dNm, m) {
  const s = (m * nm) / dNm;
  return Math.abs(s) <= 1 ? Math.asin(s) : null;
}

// ---- Lines --------------------------------------------------------------------------
export const ELEMENTS = NIST_LINES.map((e) => e.symbol);
export const element = (sym) => NIST_LINES.find((e) => e.symbol === sym) || null;

// An element's lines for the eye: components closer than `merge` nm (the
// fine structure of hydrogen's lines, for one) become one line at their
// intensity-weighted wavelength with their summed intensity; lines without
// an intensity in NIST's table are left out. Intensities are scaled to the
// element's strongest (1).
export function lineSpectrum(sym, { merge = 0.05 } = {}) {
  const e = element(sym);
  if (!e) return [];
  const out = [];
  for (const [nm, i] of e.lines) {
    if (!(i > 0)) continue;
    const last = out[out.length - 1];
    if (last && nm - last.nm < merge) {
      const s = last.i + i;
      last.nm = (last.nm * last.i + nm * i) / s;
      last.i = s;
    } else out.push({ nm, i });
  }
  const top = Math.max(...out.map((l) => l.i), 1);
  for (const l of out) l.rel = l.i / top;
  return out;
}

// ---- The home spectrometer --------------------------------------------------------
// A fluorescent lamp's mercury lines, the two used to calibrate (NIST, Hg I).
export const HG_BLUE = 435.8328;
export const HG_GREEN = 546.0735;

// The brightness of each column across a band of rows (y0..y1) of an RGBA
// picture: { r, g, b, sum } arrays of the column means (0..255).
export function profileOf(img, y0, y1) {
  const { width: w, height: h, data } = img;
  const a = Math.max(0, Math.min(h - 1, Math.floor(y0)));
  const b = Math.max(a + 1, Math.min(h, Math.ceil(y1)));
  const r = new Float32Array(w);
  const g = new Float32Array(w);
  const bl = new Float32Array(w);
  for (let y = a; y < b; y++)
    for (let x = 0; x < w; x++) {
      const o = (y * w + x) * 4;
      r[x] += data[o];
      g[x] += data[o + 1];
      bl[x] += data[o + 2];
    }
  const n = b - a;
  const sum = new Float32Array(w);
  for (let x = 0; x < w; x++) {
    r[x] /= n;
    g[x] /= n;
    bl[x] /= n;
    sum[x] = r[x] + g[x] + bl[x];
  }
  return { r, g, b: bl, sum, width: w };
}

// The brightest row band of a picture (where the spectrum is): the rows
// whose total brightness is within half of the brightest row's, around it.
export function brightBand(img) {
  const { width: w, height: h, data } = img;
  const rows = new Float32Array(h);
  for (let y = 0; y < h; y++) {
    let s = 0;
    for (let x = 0; x < w; x++) {
      const o = (y * w + x) * 4;
      s += data[o] + data[o + 1] + data[o + 2];
    }
    rows[y] = s;
  }
  let top = 0;
  for (let y = 1; y < h; y++) if (rows[y] > rows[top]) top = y;
  let a = top;
  let b = top;
  while (a > 0 && rows[a - 1] > rows[top] * 0.5) a--;
  while (b < h - 1 && rows[b + 1] > rows[top] * 0.5) b++;
  return [a, b + 1];
}

// A sharp peak's place (a column, refined by a parabola), in [lo, hi).
function peakIn(arr, lo, hi) {
  let best = -1;
  let v = -Infinity;
  for (let x = Math.max(1, lo); x < Math.min(arr.length - 1, hi); x++)
    if (arr[x] > v) {
      v = arr[x];
      best = x;
    }
  if (best < 0) return null;
  const l = arr[best - 1];
  const r = arr[best + 1];
  const den = l - 2 * v + r;
  return best + (Math.abs(den) > 1e-9 ? (0.5 * (l - r)) / den : 0);
}

// Pixels to nanometers from a fluorescent lamp's spectrum: the mercury blue
// line (435.8 nm) is the strongest peak of "blue over red", the green line
// (546.1 nm) the strongest of "green over red and blue" (both stand far
// above the phosphors' broad bands). A straight line through the two:
// nm = a x + b (a grating's spread is close to linear across the visible).
// Returns { a, b, blue, green } or null.
export function calibrate(p) {
  const n = p.width;
  const blueness = new Float32Array(n);
  const greenness = new Float32Array(n);
  for (let x = 0; x < n; x++) {
    blueness[x] = p.b[x] - 0.6 * p.r[x] - 0.3 * p.g[x];
    greenness[x] = p.g[x] - 0.5 * p.r[x] - 0.5 * p.b[x];
  }
  const blue = peakIn(blueness, 0, n);
  const green = peakIn(greenness, 0, n);
  if (blue === null || green === null || Math.abs(green - blue) < 4) return null;
  const a = (HG_GREEN - HG_BLUE) / (green - blue);
  return { a, b: HG_BLUE - a * blue, blue, green };
}

export const pxToNm = (cal, x) => cal.a * x + cal.b;
export const nmToPx = (cal, nm) => (nm - cal.b) / cal.a;

// Peaks of a profile (by brightness), as wavelengths with a calibration:
// local maxima at least `prom` above the lowest point within `win` columns.
export function peaksOf(p, cal, { prom = 18, win = 12 } = {}) {
  const s = p.sum;
  const out = [];
  for (let x = 2; x < s.length - 2; x++) {
    if (!(s[x] >= s[x - 1] && s[x] > s[x + 1])) continue;
    let lo = Infinity;
    for (let k = Math.max(0, x - win); k < Math.min(s.length, x + win); k++)
      lo = Math.min(lo, s[k]);
    if (s[x] - lo < prom) continue;
    const nm = pxToNm(cal, peakIn(s, x - 1, x + 2));
    if (nm >= NM_LO && nm <= NM_HI) out.push({ nm, v: s[x] });
  }
  return out;
}

// A made-up photo of a compact fluorescent lamp seen through a grating: a
// dark picture with a bright horizontal band, mercury's lines and the
// phosphors' bands (europium red near 611 nm, terbium green near 543 nm
// and 487 nm) where a calibration of `nmPerPx` with 380 nm at column
// `x380` puts them. Our own picture for the sample and the tests; a real
// lamp's mix of phosphors differs.
export function samplePhoto({
  width = 480,
  height = 270,
  x380 = 40,
  nmPerPx = 0.9,
  flip = false,
} = {}) {
  const data = new Uint8ClampedArray(width * height * 4);
  const lines = [
    [404.6563, 0.55, 1.2],
    [435.8328, 1, 1.2],
    [546.0735, 1, 1.2],
    [576.9598, 0.35, 1.2],
    [579.0663, 0.4, 1.2],
    // The phosphors (broad, approximate centers and widths).
    [487, 0.35, 5],
    [543, 0.7, 3],
    [588, 0.25, 4],
    [611.5, 1, 2.5],
    [620, 0.3, 6],
    [631, 0.25, 3],
    [707, 0.2, 3],
  ];
  const yc = height * 0.5;
  for (let x = 0; x < width; x++) {
    const xx = flip ? width - 1 - x : x;
    const nm = 380 + (xx - x380) * nmPerPx;
    let I = 0;
    for (const [c, a, w] of lines) I += a * Math.exp(-0.5 * ((nm - c) / w) ** 2);
    const col = nmColor(nm);
    for (let y = 0; y < height; y++) {
      const v = Math.exp(-0.5 * ((y - yc) / (height * 0.07)) ** 4);
      const o = (y * width + x) * 4;
      for (let c = 0; c < 3; c++) {
        const lin = Math.min(1, I * v * (col[c] * 0.92 + 0.08));
        data[o + c] = Math.round(10 + 245 * lin);
      }
      data[o + 3] = 255;
    }
  }
  return { width, height, data, truth: { x380, nmPerPx, flip } };
}
