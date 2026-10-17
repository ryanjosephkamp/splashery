// RGB SSIM after a display-pixel blur ranks Most detail candidates at phone and print size.
import { squareSample } from "./picture.js";
import { shapeHalf } from "../qr/circle.js";
export function soften(rgb, n, sigma) {
  const r = Math.ceil(3 * sigma),
    weights = [];
  let sum = 0;
  for (let i = -r; i <= r; i++) {
    const w = Math.exp((-i * i) / (2 * sigma * sigma));
    weights.push(w);
    sum += w;
  }
  for (let i = 0; i < weights.length; i++) weights[i] /= sum;
  const tmp = new Float32Array(rgb.length),
    out = new Float32Array(rgb.length);
  for (let y = 0; y < n; y++)
    for (let x = 0; x < n; x++)
      for (let c = 0; c < 3; c++) {
        let s = 0;
        for (let i = -r; i <= r; i++)
          s += weights[i + r] * rgb[(y * n + Math.min(n - 1, Math.max(0, x + i))) * 3 + c];
        tmp[(y * n + x) * 3 + c] = s;
      }
  for (let y = 0; y < n; y++)
    for (let x = 0; x < n; x++)
      for (let c = 0; c < 3; c++) {
        let s = 0;
        for (let i = -r; i <= r; i++)
          s += weights[i + r] * tmp[(Math.min(n - 1, Math.max(0, y + i)) * n + x) * 3 + c];
        out[(y * n + x) * 3 + c] = s;
      }
  return out;
}
export function compare(a, b, n) {
  let mse = 0,
    ssim = 0,
    count = 0;
  for (let i = 0; i < a.length; i++) mse += (a[i] - b[i]) ** 2;
  // Overlapping 7x7 windows, every three pixels, population moments.
  for (let y = 0; y + 7 <= n; y += 3)
    for (let x = 0; x + 7 <= n; x += 3)
      for (let c = 0; c < 3; c++) {
        let sa = 0,
          sb = 0,
          saa = 0,
          sbb = 0,
          sab = 0;
        for (let yy = y; yy < y + 7; yy++)
          for (let xx = x; xx < x + 7; xx++) {
            const i = (yy * n + xx) * 3 + c,
              u = a[i],
              v = b[i];
            sa += u;
            sb += v;
            saa += u * u;
            sbb += v * v;
            sab += u * v;
          }
        const ma = sa / 49,
          mb = sb / 49,
          va = saa / 49 - ma * ma,
          vb = sbb / 49 - mb * mb,
          cov = sab / 49 - ma * mb;
        ssim +=
          ((2 * ma * mb + 0.0001) * (2 * cov + 0.0009)) /
          ((ma * ma + mb * mb + 0.0001) * (va + vb + 0.0009));
        count++;
      }
  return { ssim: ssim / count, rmse: Math.sqrt(mse / a.length) };
}

export function scanEstimate(w) {
  return { ...w, cells: soften(w.cells, w.G, 0.12 * w.k) };
}

export function fidelityScorer(pic, size, shape, reference = null) {
  const n = 128,
    source = squareSample(pic, n),
    fraction = size / (2 * (shapeHalf(size, shape) + 1));
  const phoneSigma = n / (390 * fraction),
    printSigma = n / (900 * fraction);
  const phone = soften(source, n, phoneSigma),
    print = soften(source, n, printSigma);
  const evaluate = (w) => {
    // A splat covers neighboring cells in the final render. Model that optical
    // footprint before comparing viewing sizes, so fine halftones are ranked
    // by the picture they form rather than by individual cell edges.
    const cells = soften(w.cells, w.G, 0.17 * w.k);
    const observed = squareSample({ w: w.G, h: w.G, data: cells }, n);
    const p = compare(phone, soften(observed, n, phoneSigma), n).ssim;
    const q = compare(print, soften(observed, n, printSigma), n).ssim;
    return { phone: p, print: q };
  };
  const before = reference ? evaluate(reference) : { phone: 0, print: 0 };
  return (w) => {
    const after = evaluate(w);
    return {
      ...after,
      score: Math.min(after.phone - before.phone, after.print - before.print),
    };
  };
}
