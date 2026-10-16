import { shapeHalf } from "../../src/qr/circle.js";
// RGB SSIM (equal channel weight) and RMSE after a fixed viewing blur.
// The source and code have identical crops, resolution, and blur. All QR patterns count.
import { squareSample } from "../../src/qr-craft/picture.js";
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
export function fidelity(pic, w, { shape = "square" } = {}) {
  const n = 128;
  const source = squareSample(pic, n),
    code = squareSample({ w: w.G, h: w.G, data: w.cells }, n);
  // At 390px, one pixel of viewing blur; at 900px, one pixel of viewing blur.
  const fraction = w.code.size / (2 * (shapeHalf(w.code, shape) + 1));
  const phone = 128 / (390 * fraction),
    print = 128 / (900 * fraction);
  return Object.fromEntries(
    [
      ["phone", phone],
      ["print", print],
    ].map(([id, s]) => [id, compare(soften(source, n, s), soften(code, n, s), n)]),
  );
}

// The complete circular sticker, including its photo band, mandatory quiet
// square, and all function patterns. Pixels outside the disk are white in both images.
export function stickerFidelity(pic, w, img) {
  const n = 128,
    N = w.code.size,
    H = shapeHalf(N, "circle"),
    total = 2 * (H + 1),
    reference = new Float32Array(n * n * 3);
  const side = Math.min(pic.w, pic.h),
    samples = 4;
  for (let y = 0; y < n; y++)
    for (let x = 0; x < n; x++) {
      const sum = [0, 0, 0];
      for (let v = 0; v < samples; v++)
        for (let u = 0; u < samples; u++) {
          const wx = ((x + (u + 0.5) / samples) / n - 0.5) * total,
            wy = (0.5 - (y + (v + 0.5) / samples) / n) * total;
          if (Math.hypot(wx, wy) > H) {
            for (let ch = 0; ch < 3; ch++) sum[ch]++;
            continue;
          }
          const px = Math.max(
            0,
            Math.min(pic.w - 1, Math.floor((pic.w - side) / 2 + (0.5 + wx / (2 * H)) * side)),
          );
          const py = Math.max(
            0,
            Math.min(pic.h - 1, Math.floor((pic.h - side) / 2 + (0.5 - wy / (2 * H)) * side)),
          );
          const p = (py * pic.w + px) * 3;
          for (let ch = 0; ch < 3; ch++) sum[ch] += pic.data[p + ch];
        }
      for (let ch = 0; ch < 3; ch++)
        reference[(y * n + x) * 3 + ch] = sum[ch] / (samples * samples);
    }
  const rgb = new Float32Array(img.width * img.height * 3);
  for (let i = 0; i < img.width * img.height; i++)
    for (let ch = 0; ch < 3; ch++) rgb[i * 3 + ch] = img.data[i * 4 + ch] / 255;
  const observed = squareSample({ w: img.width, h: img.height, data: rgb }, n);
  return Object.fromEntries(
    [
      ["phone", 128 / 390],
      ["print", 128 / 900],
    ].map(([id, s]) => [id, compare(soften(reference, n, s), soften(observed, n, s), n)]),
  );
}

// The encoded square in a real splat capture, with the same source crop and physical footprint.
export function capturedFidelity(pic, img, size, modules) {
  const n = 128,
    source = squareSample(pic, n),
    observed = new Float32Array(n * n * 3);
  const side = (img.width * size) / modules,
    step = side / n,
    x0 = (img.width - side) / 2,
    y0 = (img.height - side) / 2;
  const samples = Math.max(1, Math.min(4, Math.ceil(step)));
  for (let y = 0; y < n; y++)
    for (let x = 0; x < n; x++) {
      const sum = [0, 0, 0];
      for (let v = 0; v < samples; v++)
        for (let u = 0; u < samples; u++) {
          const px = Math.min(img.width - 1, Math.floor(x0 + (x + (u + 0.5) / samples) * step));
          const py = Math.min(img.height - 1, Math.floor(y0 + (y + (v + 0.5) / samples) * step));
          const q = (py * img.width + px) * 4;
          for (let ch = 0; ch < 3; ch++) sum[ch] += img.data[q + ch] / 255;
        }
      for (let ch = 0; ch < 3; ch++) observed[(y * n + x) * 3 + ch] = sum[ch] / (samples * samples);
    }
  const fraction = size / modules;
  return Object.fromEntries(
    [
      ["phone", 128 / (390 * fraction)],
      ["print", 128 / (900 * fraction)],
    ].map(([id, s]) => [id, compare(soften(source, n, s), soften(observed, n, s), n)]),
  );
}
