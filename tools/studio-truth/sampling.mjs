// MIT. Color uses area integration; geometry uses the target cell center.
export function sampleTruth(t, w, h) {
  const z = new Float32Array(w * h),
    mask = new Uint8Array(w * h),
    rgba = new Uint8Array(w * h * 4),
    edges = new Uint8Array(w * h);
  const tw = t.pose.width,
    th = t.pose.height;
  for (let y = 0; y < h; y++)
    for (let x = 0; x < w; x++) {
      const i = y * w + x,
        sx = Math.min(tw - 1, Math.floor(((x + 0.5) * tw) / w)),
        sy = Math.min(th - 1, Math.floor(((y + 0.5) * th) / h)),
        j = sy * tw + sx;
      z[i] = t.z[j];
      mask[i] = t.mask[j];
      const left = (x * tw) / w,
        right = ((x + 1) * tw) / w,
        top = (y * th) / h,
        bottom = ((y + 1) * th) / h;
      const sums = [0, 0, 0, 0];
      let area = 0;
      for (let yy = Math.floor(top); yy < Math.ceil(bottom); yy++)
        for (let xx = Math.floor(left); xx < Math.ceil(right); xx++) {
          const weight =
            (Math.min(xx + 1, right) - Math.max(xx, left)) *
            (Math.min(yy + 1, bottom) - Math.max(yy, top));
          const pixel = (Math.min(th - 1, yy) * tw + Math.min(tw - 1, xx)) * 4;
          for (let c = 0; c < 4; c++) sums[c] += t.rgb[pixel + c] * weight;
          area += weight;
        }
      for (let c = 0; c < 4; c++) rgba[i * 4 + c] = Math.round(sums[c] / area);
      for (const d of [-1, 1, -tw, tw])
        if (
          j + d >= 0 &&
          j + d < t.z.length &&
          Number.isFinite(t.z[j + d]) &&
          Math.abs(t.z[j + d] - t.z[j]) > 0.05 * t.z[j]
        )
          edges[i] = 1;
    }
  // Depth discontinuities at the metric grid, expanded by 2 pixels for halo diagnostics.
  for (let y = 1; y < h - 1; y++)
    for (let x = 1; x < w - 1; x++) {
      const i = y * w + x;
      if (!Number.isFinite(z[i])) continue;
      if (
        [i - 1, i + 1, i - w, i + w].some(
          (j) => Number.isFinite(z[j]) && Math.abs(z[j] - z[i]) > 0.05 * z[i],
        )
      )
        for (let dy = -2; dy <= 2; dy++)
          for (let dx = -2; dx <= 2; dx++)
            if (y + dy >= 0 && y + dy < h && x + dx >= 0 && x + dx < w) edges[i + dy * w + dx] = 1;
    }
  const pose = { ...t.pose, K: t.pose.K.map((row) => row.slice()) };
  pose.K[0][0] *= w / tw;
  pose.K[0][2] *= w / tw;
  pose.K[1][1] *= h / th;
  pose.K[1][2] *= h / th;
  return { z, mask, rgba, edges, pose };
}
