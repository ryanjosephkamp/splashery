// MIT. Round 4 revealed/nearby-visible cohorts, with support retained.
export function cohorts(mask, uv, field, minimum, ratio) {
  const { width: w, height: h } = mask,
    result = new Uint8Array(w * h),
    near = new Uint8Array(w * h),
    radius = Math.ceil(24 * ratio);
  for (let i = 0; i < result.length; i++) {
    const p = i * 4,
      type = mask.data[p + 1];
    if (type < 8) continue;
    const u = (uv.data[p] * 16 + Math.floor(uv.data[p + 1] / 16)) / 4095,
      v = ((uv.data[p + 1] % 16) * 256 + uv.data[p + 2]) / 4095,
      x = Math.min(field.width - 1, Math.floor(u * field.width)),
      y = Math.min(field.height - 1, Math.floor(v * field.height)),
      k = y * field.width + x;
    if (Math.min(u, v, 1 - u, 1 - v) < 0.04) continue;
    const hidden = field.data[k] / 255 - minimum[k] > 0.03;
    if (type > 96 && hidden) result[i] = 1;
    else if (type < 96 && !hidden) result[i] = 2;
  }
  // Visible controls must be near a revealed region in this same rendered pose.
  for (let y = 0; y < h; y++) {
    let last = -1e9;
    for (let x = 0; x < w; x++) {
      if (result[y * w + x] === 1) last = x;
      if (x - last <= radius) near[y * w + x] = 1;
    }
    last = 1e9;
    for (let x = w - 1; x >= 0; x--) {
      if (result[y * w + x] === 1) last = x;
      if (last - x <= radius) near[y * w + x] = 1;
    }
  }
  for (let x = 0; x < w; x++) {
    let last = -1e9;
    for (let y = 0; y < h; y++) {
      if (near[y * w + x]) last = y;
      if (result[y * w + x] === 2 && y - last > radius) result[y * w + x] = 3;
    }
    last = 1e9;
    for (let y = h - 1; y >= 0; y--) {
      if (near[y * w + x]) last = y;
      if (result[y * w + x] === 3) result[y * w + x] = last - y <= radius ? 2 : 0;
    }
  }
  return result;
}
