import { test, expect } from "@playwright/test";
import { upsampleDepth } from "../src/packs/photo-3d-core.js";

// Independent scalar form of the checkpoint's joint bilateral reconstruction.
function reference(d, dw, dh, low, w, h, high, sigma = 0.09) {
  const out = new Float32Array(w * h),
    inv = 1 / (2 * sigma ** 2),
    sp = 1 / (2 * 0.8 ** 2);
  for (let y = 0; y < h; y++)
    for (let x = 0; x < w; x++) {
      const u = ((x + 0.5) * dw) / w - 0.5,
        v = ((y + 0.5) * dh) / h - 0.5,
        i = Math.floor(u),
        j = Math.floor(v),
        p = (y * w + x) * 3;
      let sum = 0,
        weight = 0,
        fallback = 0;
      for (let yy = j - 1; yy <= j + 2; yy++)
        for (let xx = i - 1; xx <= i + 2; xx++) {
          const sx = Math.max(0, Math.min(dw - 1, xx)),
            sy = Math.max(0, Math.min(dh - 1, yy)),
            q = (sy * dw + sx) * 3;
          const dr = low[q] - high[p],
            dg = low[q + 1] - high[p + 1],
            db = low[q + 2] - high[p + 2];
          const w =
            Math.exp(-((u - xx) ** 2 + (v - yy) ** 2) * sp) *
            Math.exp(-(dr * dr + dg * dg + db * db) * inv);
          sum += w * d[sy * dw + sx];
          weight += w;
          fallback +=
            Math.max(0, 1 - Math.abs(u - xx)) * Math.max(0, 1 - Math.abs(v - yy)) * d[sy * dw + sx];
        }
      out[y * w + x] = weight > 1e-4 ? sum / weight : fallback;
    }
  return out;
}

test("depth upsampling preserves the checkpoint's scalar result across colors, borders, and fallback", () => {
  let state = 4731;
  const random = () => (state = (Math.imul(state, 1664525) + 1013904223) >>> 0) / 2 ** 32;
  for (const [dw, dh, w, h] of [
    [17, 13, 47, 31],
    [1, 2, 11, 7],
    [21, 27, 13, 17],
  ]) {
    const d = Float32Array.from({ length: dw * dh }, random),
      low = Float32Array.from({ length: dw * dh * 3 }, random),
      high = Float32Array.from({ length: w * h * 3 }, random);
    const a = upsampleDepth(d, dw, dh, low, w, h, high),
      b = reference(d, dw, dh, low, w, h, high);
    let error = 0;
    for (let i = 0; i < a.length; i++) error = Math.max(error, Math.abs(a[i] - b[i]));
    expect(error).toBeLessThanOrEqual(1e-7);
  }
});
