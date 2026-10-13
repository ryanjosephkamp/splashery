// Keep a dense strip at the true picture edge. Adaptive interior blocks may
// end several pixels short of that edge after a steep turn.
export function borderSplats(photo, surface) {
  const { gx, gy, aspect, edgeDepth, cellBand, stats } = surface;
  const steps = 64;
  const n = 4 * 3 * steps;
  const pos = new Float32Array(n * 3);
  const rgb = new Float32Array(n * 3);
  const band = new Uint8Array(n);
  const size = new Float32Array(n);
  let k = 0;
  for (const inset of [0.001, 0.012, 0.028])
    for (let side = 0; side < 4; side++)
      for (let i = 0; i < steps; i++, k++) {
        const t = (i + 0.5) / steps;
        const u =
          side === 0 ? t : side === 1 ? 1 - inset / aspect : side === 2 ? 1 - t : inset / aspect;
        const v = side === 0 ? inset : side === 1 ? t : side === 2 ? 1 - inset : 1 - t;
        const x = Math.max(0, Math.min(gx - 1, u * gx - 0.5)),
          y = Math.max(0, Math.min(gy - 1, v * gy - 0.5));
        const x0 = Math.floor(x),
          y0 = Math.floor(y),
          x1 = Math.min(gx - 1, x0 + 1),
          y1 = Math.min(gy - 1, y0 + 1);
        const fx = x - x0,
          fy = y - y0;
        const d =
          (edgeDepth[y0 * gx + x0] * (1 - fx) + edgeDepth[y0 * gx + x1] * fx) * (1 - fy) +
          (edgeDepth[y1 * gx + x0] * (1 - fx) + edgeDepth[y1 * gx + x1] * fx) * fy;
        pos.set([(u - 0.5) * aspect, 0.5 - v, stats.relief * (d - 0.5)], k * 3);
        band[k] = cellBand[y0 * gx + x0];
        size[k] = Math.max(0.01, (side % 2 ? 1 : aspect) / steps);
        const p =
          (Math.min(photo.h - 1, Math.floor(v * photo.h)) * photo.w +
            Math.min(photo.w - 1, Math.floor(u * photo.w))) *
          4;
        rgb.set([photo.data[p] / 255, photo.data[p + 1] / 255, photo.data[p + 2] / 255], k * 3);
      }
  return { n, pos, rgb, band, size };
}
