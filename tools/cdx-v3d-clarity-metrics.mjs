// MIT. Build-only clarity measurements. No image is resized, sharpened, masked, or aligned.
import { sharpness } from "../src/video3d/frames.js";

export function imageMetrics(render, reference) {
  const { width: w, height: h } = reference;
  if (render.width !== w || render.height !== h || w < 11 || h < 11)
    throw new Error("Score equal-size images, at least 11 pixels on each side.");
  const n = w * h;
  const a = new Float64Array(n);
  const b = new Float64Array(n);
  let mse = 0;
  for (let i = 0; i < n; i++) {
    for (let k = 0; k < 3; k++)
      mse += ((render.data[i * 4 + k] - reference.data[i * 4 + k]) / 255) ** 2;
    a[i] =
      (0.299 * render.data[i * 4] +
        0.587 * render.data[i * 4 + 1] +
        0.114 * render.data[i * 4 + 2]) /
      255;
    b[i] =
      (0.299 * reference.data[i * 4] +
        0.587 * reference.data[i * 4 + 1] +
        0.114 * reference.data[i * 4 + 2]) /
      255;
  }
  mse /= n * 3;
  const kernel = Array.from({ length: 11 }, (_, i) => Math.exp(-((i - 5) ** 2) / (2 * 1.5 ** 2)));
  const weight = kernel.reduce((sum, v) => sum + v, 0);
  for (let i = 0; i < kernel.length; i++) kernel[i] /= weight;
  const blur = (input) => {
    const tmp = new Float64Array(n);
    const out = new Float64Array(n);
    for (let y = 0; y < h; y++)
      for (let x = 5; x < w - 5; x++) {
        const i = y * w + x;
        for (let k = -5; k <= 5; k++) tmp[i] += input[i + k] * kernel[k + 5];
      }
    for (let y = 5; y < h - 5; y++)
      for (let x = 5; x < w - 5; x++) {
        const i = y * w + x;
        for (let k = -5; k <= 5; k++) out[i] += tmp[i + k * w] * kernel[k + 5];
      }
    return out;
  };
  const ma = blur(a),
    mb = blur(b);
  const aa = blur(a.map((v) => v * v)),
    bb = blur(b.map((v) => v * v));
  const ab = blur(a.map((v, i) => v * b[i]));
  let ssim = 0;
  for (let y = 5; y < h - 5; y++)
    for (let x = 5; x < w - 5; x++) {
      const i = y * w + x;
      const va = Math.max(0, aa[i] - ma[i] ** 2),
        vb = Math.max(0, bb[i] - mb[i] ** 2);
      ssim +=
        ((2 * ma[i] * mb[i] + 0.01 ** 2) * (2 * (ab[i] - ma[i] * mb[i]) + 0.03 ** 2)) /
        ((ma[i] ** 2 + mb[i] ** 2 + 0.01 ** 2) * (va + vb + 0.03 ** 2));
    }
  const laplacian = sharpness(a, w, h),
    sourceLaplacian = sharpness(b, w, h);
  return {
    psnr: mse === 0 ? null : -10 * Math.log10(mse),
    exact: mse === 0,
    ssim: ssim / ((w - 10) * (h - 10)),
    laplacian,
    sourceLaplacian,
    sharpnessRatio: sourceLaplacian > 0 ? laplacian / sourceLaplacian : null,
  };
}

// Interpolation stays in the existing reconstruction's coordinate system. It does not solve
// new cameras; that limitation is carried in the measurement ledger and the report.
export function interpolateCamera(a, b, time) {
  if (!(b.time > a.time && time >= a.time && time <= b.time))
    throw new Error("Invalid camera interval.");
  const t = (time - a.time) / (b.time - a.time);
  const mix = (x, y) => x + (y - x) * t;
  // Normalized interpolation of the forward and up axes followed by Gram-Schmidt gives an
  // orthonormal rotation even when rounded legacy R matrices are not exactly orthogonal.
  const unit = (v) => {
    const n = Math.hypot(...v);
    return v.map((x) => x / n);
  };
  const z = unit(a.R.slice(6, 9).map((v, k) => mix(v, b.R[k + 6])));
  const u = a.R.slice(3, 6).map((v, k) => mix(v, b.R[k + 3]));
  const dot = u.reduce((sum, v, k) => sum + v * z[k], 0);
  const y = unit(u.map((v, k) => v - dot * z[k]));
  const x = [y[1] * z[2] - y[2] * z[1], y[2] * z[0] - y[0] * z[2], y[0] * z[1] - y[1] * z[0]];
  const center = (c) =>
    [0, 1, 2].map((k) => -(c.R[k] * c.t[0] + c.R[k + 3] * c.t[1] + c.R[k + 6] * c.t[2]));
  const ca = center(a),
    cb = center(b),
    p = ca.map((v, k) => mix(v, cb[k]));
  const R = [...x, ...y, ...z];
  return {
    ...a,
    time,
    R,
    t: [x, y, z].map((r) => -r.reduce((sum, v, k) => sum + v * p[k], 0)),
    f: mix(a.f, b.f),
    fy: mix(a.fy ?? a.f, b.fy ?? b.f),
    cx: mix(a.cx ?? a.w / 2, b.cx ?? b.w / 2),
    cy: mix(a.cy ?? a.h / 2, b.cy ?? b.h / 2),
    poseSource: "interpolated legacy cameras",
  };
}

export function evaluationCameras(cams) {
  const out = [];
  for (let i = 0; i < cams.length; i++) {
    out.push({ ...cams[i], poseSource: "recorded camera", heldOut: false });
    if (i + 1 < cams.length)
      out.push({
        ...interpolateCamera(cams[i], cams[i + 1], (cams[i].time + cams[i + 1].time) / 2),
        heldOut: i % 4 === 1,
      });
  }
  return out;
}

export function meetsClarityGoal(main, candidate) {
  return (
    Number.isFinite(main.ssim) &&
    Number.isFinite(candidate.ssim) &&
    Number.isFinite(main.laplacian) &&
    main.laplacian > 0 &&
    Number.isFinite(candidate.laplacian) &&
    candidate.ssim - main.ssim >= 0.05 &&
    candidate.laplacian / main.laplacian >= 1.5
  );
}
