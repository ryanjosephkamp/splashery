// Eight-cubed bricks keep empty space out of the density/color accumulator.
// Only the bounded scalar volume used by surface extraction is dense.
const C0 = 0.28209479177387814;
export class SparseField {
  constructor(size, origin, step) {
    this.size = size;
    this.origin = origin;
    this.step = step;
    this.bricks = new Map();
    this.brickSide = Math.ceil(size / 8);
  }
  address(x, y, z) {
    return (x >> 3) + this.brickSide * ((y >> 3) + this.brickSide * (z >> 3));
  }
  sample(x, y, z) {
    const b = this.bricks.get(this.address(x, y, z));
    const o = ((x & 7) + 8 * ((y & 7) + 8 * (z & 7))) * 4;
    return b ? b.subarray(o, o + 4) : null;
  }
  color(x, y, z) {
    const g = [x, y, z].map((v, k) =>
      Math.max(0, Math.min(this.size - 1, Math.round((v - this.origin[k]) / this.step))),
    );
    let sum = 0,
      r = 0,
      green = 0,
      b = 0;
    // Solidification can move the surface beyond the Gaussian support. Extend
    // outward only when the closer neighborhood has no source color.
    for (let radius = 1; radius <= 8 && !sum; radius++) {
      for (let dz = -radius; dz <= radius; dz++)
        for (let dy = -radius; dy <= radius; dy++)
          for (let dx = -radius; dx <= radius; dx++) {
            if (radius > 1 && Math.max(Math.abs(dx), Math.abs(dy), Math.abs(dz)) !== radius)
              continue;
            const gx = g[0] + dx,
              gy = g[1] + dy,
              gz = g[2] + dz;
            if (gx < 0 || gy < 0 || gz < 0 || gx >= this.size || gy >= this.size || gz >= this.size)
              continue;
            const brick = this.bricks.get(this.address(gx, gy, gz));
            if (!brick) continue;
            const o = ((gx & 7) + 8 * ((gy & 7) + 8 * (gz & 7))) * 4;
            const weight = radius === 1 ? 1 : 1 / (dx * dx + dy * dy + dz * dz);
            sum += brick[o] * weight;
            r += brick[o + 1] * weight;
            green += brick[o + 2] * weight;
            b += brick[o + 3] * weight;
          }
    }
    return sum ? [r / sum, green / sum, b / sum] : [0.65, 0.65, 0.65];
  }
  dense() {
    const n = this.size,
      out = new Float32Array(n ** 3),
      side = this.brickSide;
    for (const [key, b] of this.bricks) {
      const bx = (key % side) * 8,
        by = (Math.floor(key / side) % side) * 8,
        bz = Math.floor(key / side ** 2) * 8;
      for (let z = 0; z < 8 && bz + z < n; z++)
        for (let y = 0; y < 8 && by + y < n; y++)
          for (let x = 0; x < 8 && bx + x < n; x++)
            out[bx + x + n * (by + y + n * (bz + z))] = b[(x + 8 * (y + 8 * z)) * 4];
    }
    return out;
  }
}

export function sampleGaussians(table, settings, progress) {
  const { resolution, maxSplats, maxWork } = settings;
  const n = table.count;
  if (!Number.isInteger(n) || n <= 0) throw new Error("The input is empty: no splats to convert.");
  const keys = ["x", "y", "z", "s0", "s1", "s2", "qw", "qx", "qy", "qz", "r", "g", "b", "opacity"];
  for (const k of keys)
    if (!table[k] || table[k].length !== n) throw new Error(`Invalid splat column: ${k}.`);
  const lo = [Infinity, Infinity, Infinity],
    hi = [-Infinity, -Infinity, -Infinity];
  const stride = Math.max(1, Math.ceil(n / maxSplats));
  let visible = 0;
  for (let i = 0; i < n; i++) {
    for (const k of keys)
      if (!Number.isFinite(table[k][i]))
        throw new Error("Invalid input: all splat values must be finite.");
    if (table.opacity[i] < -6 || i % stride) continue;
    visible++;
    const radius = Math.exp(Math.max(table.s0[i], table.s1[i], table.s2[i])) * 3;
    if (!(radius > 0 && Number.isFinite(radius))) throw new Error("Invalid Gaussian scale.");
    [table.x[i], table.y[i], table.z[i]].forEach((v, k) => {
      lo[k] = Math.min(lo[k], v - radius);
      hi[k] = Math.max(hi[k], v + radius);
    });
  }
  if (!visible) throw new Error("No visible splats remain.");
  const longest = Math.max(...hi.map((v, k) => v - lo[k]));
  if (!(longest > 1e-12 && Number.isFinite(longest)))
    throw new Error("Invalid or zero input size.");
  const step = longest / (resolution - 8);
  const origin = lo.map((v, k) => (v + hi[k] - step * (resolution - 1)) / 2);
  const field = new SparseField(resolution, origin, step);
  let work = 0;
  for (let i = 0; i < n; i += stride) {
    if (i % (stride * 2048) === 0)
      progress(0.08 + (0.46 * i) / n, "Sampling Gaussian density and color…");
    const alpha = 1 / (1 + Math.exp(-table.opacity[i]));
    if (alpha < 0.0025) continue;
    let w = table.qw[i],
      x = table.qx[i],
      y = table.qy[i],
      z = table.qz[i];
    const ql = Math.hypot(w, x, y, z) || 1;
    w /= ql;
    x /= ql;
    y /= ql;
    z /= ql;
    const rot = [
      1 - 2 * (y * y + z * z),
      2 * (x * y - z * w),
      2 * (x * z + y * w),
      2 * (x * y + z * w),
      1 - 2 * (x * x + z * z),
      2 * (y * z - x * w),
      2 * (x * z - y * w),
      2 * (y * z + x * w),
      1 - 2 * (x * x + y * y),
    ];
    const scales = [table.s0[i], table.s1[i], table.s2[i]].map((v) =>
      Math.max(0.6, Math.exp(v) / step),
    );
    const inv = scales.map((v) => 1 / (v * v));
    const a = rot[0] ** 2 * inv[0] + rot[1] ** 2 * inv[1] + rot[2] ** 2 * inv[2];
    const b = rot[3] ** 2 * inv[0] + rot[4] ** 2 * inv[1] + rot[5] ** 2 * inv[2];
    const c = rot[6] ** 2 * inv[0] + rot[7] ** 2 * inv[1] + rot[8] ** 2 * inv[2];
    const d = rot[0] * rot[3] * inv[0] + rot[1] * rot[4] * inv[1] + rot[2] * rot[5] * inv[2];
    const e = rot[0] * rot[6] * inv[0] + rot[1] * rot[7] * inv[1] + rot[2] * rot[8] * inv[2];
    const f = rot[3] * rot[6] * inv[0] + rot[4] * rot[7] * inv[1] + rot[5] * rot[8] * inv[2];
    const center = [
      (table.x[i] - origin[0]) / step,
      (table.y[i] - origin[1]) / step,
      (table.z[i] - origin[2]) / step,
    ];
    const radii = [0, 1, 2].map(
      (k) =>
        3 *
        Math.hypot(rot[k * 3] * scales[0], rot[k * 3 + 1] * scales[1], rot[k * 3 + 2] * scales[2]),
    );
    const low = center.map((v, k) => Math.max(1, Math.ceil(v - radii[k])));
    const high = center.map((v, k) => Math.min(resolution - 2, Math.floor(v + radii[k])));
    work += (high[0] - low[0] + 1) * (high[1] - low[1] + 1) * (high[2] - low[2] + 1);
    if (work > maxWork)
      throw new Error(
        "This density field exceeds the work budget. Lower the resolution, or open fewer splats.",
      );
    const rgb = [table.r[i], table.g[i], table.b[i]].map((v) =>
      Math.max(0, Math.min(1, 0.5 + C0 * v)),
    );
    for (let gz = low[2]; gz <= high[2]; gz++)
      for (let gy = low[1]; gy <= high[1]; gy++)
        for (let gx = low[0]; gx <= high[0]; gx++) {
          const dx = gx - center[0],
            dy = gy - center[1],
            dz = gz - center[2];
          const distance =
            a * dx * dx + b * dy * dy + c * dz * dz + 2 * (d * dx * dy + e * dx * dz + f * dy * dz);
          if (distance > 9) continue;
          const value = alpha * Math.exp(-0.5 * distance);
          const key = field.address(gx, gy, gz);
          let brick = field.bricks.get(key);
          if (!brick) field.bricks.set(key, (brick = new Float32Array(8 * 8 * 8 * 4)));
          const o = ((gx & 7) + 8 * ((gy & 7) + 8 * (gz & 7))) * 4;
          brick[o] += value;
          for (let k = 0; k < 3; k++) brick[o + 1 + k] += value * rgb[k];
        }
  }
  return { field, sampled: Math.ceil(n / stride), work };
}
