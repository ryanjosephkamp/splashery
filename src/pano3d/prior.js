// Global context from four yaw rotations of the shipped relative-depth model.
// No true depth, camera height, or external service enters this module.
import { sample, median } from "./core.js";

export function rotatePhoto(photo, offset, scratch) {
  const shift = ((Math.round(photo.w * offset) % photo.w) + photo.w) % photo.w;
  if (!shift) return { photo, offset: 0 };
  const data =
    scratch?.length === photo.data.length && scratch !== photo.data
      ? scratch
      : new Uint8ClampedArray(photo.data.length);
  for (let y = 0; y < photo.h; y++)
    for (let x = 0; x < photo.w; x++) {
      const from = (y * photo.w + ((x + shift) % photo.w)) * 4;
      data.set(photo.data.subarray(from, from + 4), (y * photo.w + x) * 4);
    }
  return { photo: { ...photo, data }, offset: shift / photo.w };
}

function textureMask(photo, w, h) {
  return Uint8Array.from({ length: w * h }, (_, i) => {
    const x = (((i % w) + 0.5) / w) * photo.w,
      y = ((Math.floor(i / w) + 0.5) / h) * photo.h;
    const sums = [0, 0, 0],
      squares = [0, 0, 0];
    for (const dy of [-4, 0, 4])
      for (const dx of [-4, 0, 4])
        for (let c = 0; c < 3; c++) {
          const xx = (Math.floor(x + dx) + photo.w) % photo.w;
          const yy = Math.max(0, Math.min(photo.h - 1, Math.floor(y + dy)));
          const v = photo.data[(yy * photo.w + xx) * 4 + c] / 255;
          sums[c] += v;
          squares[c] += v * v;
        }
    return sums.reduce((v, s, c) => v + squares[c] / 9 - (s / 9) ** 2, 0) / 3 > 1e-6 ? 1 : 0;
  });
}

export function panoramaPrior(photo, observations, cube) {
  if (
    observations.length !== 4 ||
    observations.some((t) => t.d.length !== t.w * t.h || !t.d.every(Number.isFinite))
  )
    throw new Error("Four complete, finite panorama predictions are required.");
  const w = 384,
    h = 192,
    n = w * h,
    texture = textureMask(photo, w, h);
  if (!texture.some(Boolean)) return { depth: cube, calibration: { supported: false } };
  const q = observations.map((t) =>
    Float64Array.from({ length: n }, (_, i) =>
      sample(t.d, t.w, t.h, ((i % w) + 0.5) / w - t.offset, (Math.floor(i / w) + 0.5) / h),
    ),
  );
  const med = q.map((a) => Math.max(1e-6, median(a.filter((v, i) => v > 1e-6 && texture[i]))));
  const area = (i) => Math.sin((Math.PI * (Math.floor(i / w) + 0.5)) / h);
  const fits = [{ a: 1, b: 0 }];
  for (let j = 1; j < 4; j++) {
    let a = med[0] / med[j],
      b = 0;
    for (let iteration = 0; iteration < 5; iteration++) {
      let sw = 0,
        sx = 0,
        sy = 0,
        sxx = 0,
        sxy = 0;
      for (let i = 0; i < n; i += 3) {
        const x = q[j][i],
          y = q[0][i];
        if (!texture[i] || x < med[j] * 0.1 || y < med[0] * 0.1) continue;
        const weight =
          area(i) * Math.min(1, (med[0] * 0.1) / Math.max(1e-9, Math.abs(a * x + b - y)));
        sw += weight;
        sx += weight * x;
        sy += weight * y;
        sxx += weight * x * x;
        sxy += weight * x * y;
      }
      const variance = sxx - (sx * sx) / sw;
      if (sw <= 0 || !Number.isFinite(variance) || variance < 1e-8) break;
      a = Math.max(0.05, Math.min(20, (sxy - (sx * sy) / sw) / variance));
      b = (sy - a * sx) / sw;
    }
    fits.push({ a, b });
  }
  const radial = Float64Array.from({ length: n }, (_, i) => {
    const u = ((i % w) + 0.5) / w;
    let sum = 0,
      weights = 0;
    for (let j = 0; j < 4; j++) {
      const value = fits[j].a * q[j][i] + fits[j].b;
      if (q[j][i] < med[j] * 0.1 || value <= 1e-6) continue;
      const v = (((u - observations[j].offset) % 1) + 1) % 1,
        weight = Math.sin(Math.PI * v) ** 2;
      sum += value * weight;
      weights += weight;
    }
    return weights ? weights / sum : NaN;
  });
  const normalization = median(Array.from(radial, (v, i) => (texture[i] ? v : NaN)));
  if (!(normalization > 0)) return { depth: cube, calibration: { supported: false } };
  const scale = 3 / normalization;
  for (let i = 0; i < n; i++)
    radial[i] = Number.isFinite(radial[i]) ? Math.max(0.6, Math.min(30, radial[i] * scale)) : 30;
  const local = Float64Array.from({ length: n }, (_, i) =>
    sample(cube.d, cube.w, cube.h, ((i % w) + 0.5) / w, (Math.floor(i / w) + 0.5) / h),
  );
  const cubeScale =
    median(Array.from(local, (v, i) => (texture[i] && radial[i] < 30 ? radial[i] / v : NaN))) || 1;
  const d = Float32Array.from(radial, (v, i) => 1 / (0.625 / v + 0.375 / (local[i] * cubeScale)));
  return { depth: { w, h, d }, calibration: { supported: true, fits, cubeScale } };
}
