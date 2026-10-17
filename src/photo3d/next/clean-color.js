// MIT. Conservative source-color cleanup at near-side cuts. A thin part with
// no supported interior donor keeps its original color rather than vanishing.
export function cleanForeground(photo, build, band = 3) {
  const { w, h, data } = photo,
    { gx, gy, depth } = build,
    rgba = Uint8Array.from(data);
  const at = (x, y) =>
    depth[
      Math.max(0, Math.min(gy - 1, Math.floor(((y + 0.5) * gy) / h))) * gx +
        Math.max(0, Math.min(gx - 1, Math.floor(((x + 0.5) * gx) / w)))
    ];
  const step = Math.max(1, Math.ceil(Math.max(w / gx, h / gy))),
    reach = band + step;
  let changed = 0;
  for (let y = reach; y < h - reach; y++)
    for (let x = reach; x < w - reach; x++) {
      const d = at(x, y),
        guard = (u, v) =>
          Math.min(at(u - step, v), at(u + step, v), at(u, v - step), at(u, v + step));
      if (d - guard(x, y) < 0.035) continue;
      let best = -1,
        distance = Infinity;
      for (let dy = -band; dy <= band; dy++)
        for (let dx = -band; dx <= band; dx++) {
          const square = dx * dx + dy * dy;
          if (
            square >= distance ||
            Math.abs(at(x + dx, y + dy) - d) > 0.015 ||
            d - guard(x + dx, y + dy) > 0.015
          )
            continue;
          distance = square;
          best = ((y + dy) * w + x + dx) * 4;
        }
      if (best >= 0) {
        const p = (y * w + x) * 4;
        rgba.set(data.subarray(best, best + 3), p);
        changed++;
      }
    }
  return { w, h, data: rgba, cleanedPixels: changed };
}
