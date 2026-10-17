// Weighted sparse surfaces rasterized into a bounded, dense 10 cm grid.
// No authored room colliders and no infinite fallback floor.
import { eligible } from "./geometry.js";

function footprint(b, i) {
  const j = i * 3,
    k = i * 4;
  let [x, y, z, w] = b.rot ? b.rot.subarray(k, k + 4) : [0, 0, 0, 1];
  const length = Math.hypot(x, y, z, w) || 1;
  x /= length;
  y /= length;
  z /= length;
  w /= length;
  const rowX = [1 - 2 * (y * y + z * z), 2 * (x * y - z * w), 2 * (x * z + y * w)];
  const rowY = [2 * (x * y + z * w), 1 - 2 * (x * x + z * z), 2 * (y * z - x * w)];
  const rowZ = [2 * (x * z - y * w), 2 * (y * z + x * w), 1 - 2 * (x * x + y * y)];
  const largest = Math.max(b.scale[j], b.scale[j + 1], b.scale[j + 2]);
  const factor = Math.min(1.15, 0.22 / largest);
  let xx = 0,
    xz = 0,
    zz = 0,
    axis = 0;
  for (let a = 0; a < 3; a++) {
    const variance = Math.max(1e-10, (b.scale[j + a] * factor) ** 2);
    xx += rowX[a] ** 2 * variance;
    xz += rowX[a] * rowZ[a] * variance;
    zz += rowZ[a] ** 2 * variance;
    if (b.scale[j + a] < b.scale[j + axis]) axis = a;
  }
  return { xx, xz, zz, normal: [rowX[axis], rowY[axis], rowZ[axis]], radius: largest * factor };
}

// Test the projected ellipse against the whole voxel footprint. Minimizing
// its quadratic along each rectangle edge preserves thin, rotated gaps,
// while a tiny splat still contributes to the cell containing its center.
function intersects(u, v, half, a, b, d) {
  if (Math.abs(u) <= half && Math.abs(v) <= half) return true;
  const clamp = (n, low, high) => Math.max(low, Math.min(high, n));
  for (const x of [u - half, u + half]) {
    const z = clamp((-b * x) / d, v - half, v + half);
    if (a * x * x + 2 * b * x * z + d * z * z <= 1) return true;
  }
  for (const z of [v - half, v + half]) {
    const x = clamp((-b * z) / a, u - half, u + half);
    if (a * x * x + 2 * b * x * z + d * z * z <= 1) return true;
  }
  return false;
}

export function buildGrid(b, { cell = 0.1 } = {}) {
  const started = performance.now();
  const samples = [[], [], []];
  const stride = Math.max(1, Math.floor(b.count / 12000));
  for (let i = 0; i < b.count; i += stride)
    if (eligible(b, i)) for (let a = 0; a < 3; a++) samples[a].push(b.pos[i * 3 + a]);
  if (samples[0].length < 20)
    throw new Error("Not enough solid splats to make a safe walking area.");
  const min = [],
    max = [];
  for (let a = 0; a < 3; a++) {
    const s = samples[a].sort((a, b) => a - b);
    min[a] = Math.floor(s[Math.floor(s.length * 0.002)] / cell) * cell - cell * 2;
    max[a] = s[Math.min(s.length - 1, Math.floor(s.length * 0.998))] + cell * 2;
  }
  let dims = min.map((v, a) => Math.ceil((max[a] - v) / cell) + 1);
  if (dims.some((v) => v > 1500) || dims.reduce((n, v) => n * v, 1) > 8e6)
    throw new Error(
      "This place is too large for a 10 cm walking grid. Crop it in Splat toolkit, or reduce meters per file unit.",
    );
  const [nx, ny, nz] = dims;
  const size = nx * ny * nz;
  const weight = new Uint16Array(size);
  const floor = new Float32Array(size);
  floor.fill(NaN);
  const slopes = new Uint8Array(size);
  const index = (x, y, z) => x + nx * (z + nz * y);
  let accepted = 0;
  for (let i = 0; i < b.count; i++) {
    if (!eligible(b, i)) continue;
    const j = i * 3,
      x = b.pos[j],
      y = b.pos[j + 1],
      z = b.pos[j + 2];
    const ix = Math.floor((x - min[0]) / cell),
      iy = Math.floor((y - min[1]) / cell),
      iz = Math.floor((z - min[2]) / cell);
    if (ix < 0 || iy < 0 || iz < 0 || ix >= nx || iy >= ny || iz >= nz) continue;
    const shape = footprint(b, i);
    const { radius, xx: covarianceX, xz: covarianceXZ, zz: covarianceZ } = shape;
    const rx = Math.sqrt(covarianceX),
      rz = Math.sqrt(covarianceZ);
    const reachX = Math.ceil(rx / cell),
      reachZ = Math.ceil(rz / cell);
    const determinant = Math.max(1e-24, covarianceX * covarianceZ - covarianceXZ ** 2);
    const a = covarianceZ / determinant,
      cross = -covarianceXZ / determinant,
      d = covarianceX / determinant;
    let n = shape.normal;
    const smallest = Math.min(b.scale[j], b.scale[j + 1], b.scale[j + 2]);
    const largest = Math.max(b.scale[j], b.scale[j + 1], b.scale[j + 2]);
    // Spherical Gaussians have no trustworthy normal. Near the already
    // leveled robust floor, local opacity mass still proves floor support.
    if (largest < smallest * 1.2 && Math.abs(y) < 0.055) n = [0, 1, 0];
    const horizontal = Math.abs(n[1]) > 0.55;
    const w = Math.max(1, Math.round(b.color[i * 4 + 3] * Math.min(1, radius / 0.04) * 16));
    for (let dz = -reachZ; dz <= reachZ; dz++)
      for (let dx = -reachX; dx <= reachX; dx++) {
        const xx = ix + dx,
          zz = iz + dz;
        if (xx < 0 || zz < 0 || xx >= nx || zz >= nz) continue;
        const cx = min[0] + (xx + 0.5) * cell,
          cz = min[2] + (zz + 0.5) * cell;
        if (
          Math.abs(cx - x) > rx + cell * 0.5 ||
          Math.abs(cz - z) > rz + cell * 0.5 ||
          !intersects(cx - x, cz - z, cell / 2, a, cross, d)
        )
          continue;
        const h = horizontal ? y - (n[0] * (cx - x) + n[2] * (cz - z)) / n[1] : y;
        const yy = horizontal ? Math.floor((h - min[1]) / cell) : iy;
        if (yy < 0 || yy >= ny) continue;
        const k = index(xx, yy, zz);
        weight[k] = Math.min(65535, weight[k] + w);
        if (horizontal) {
          floor[k] = Number.isNaN(floor[k]) ? h : Math.max(floor[k], h);
          // Round away from a climbable result; a 35.2 degree slope must
          // never be quantized down to the permitted 35 degrees.
          slopes[k] = Math.ceil((Math.acos(Math.min(1, Math.abs(n[1]))) * 180) / Math.PI - 0.0001);
        }
      }
    accepted++;
  }
  const solid = new Uint8Array(size);
  // A lone cell cannot stop a person. A wall/floor has neighboring support.
  for (let y = 0; y < ny; y++)
    for (let z = 1; z < nz - 1; z++)
      for (let x = 1; x < nx - 1; x++) {
        const k = index(x, y, z);
        if (weight[k] < 12) {
          floor[k] = NaN;
          continue;
        }
        let near = 0;
        for (const d of [-1, 1, -nx, nx, -nx * nz, nx * nz]) if (weight[k + d] >= 12) near++;
        if (near >= 2) solid[k] = 1;
        else floor[k] = NaN;
      }
  return {
    cell,
    min,
    dims,
    solid,
    floor,
    slopes,
    accepted,
    buildMs: performance.now() - started,
    bytes: solid.byteLength + floor.byteLength + slopes.byteLength,
  };
}

export class CollisionGrid {
  constructor(data) {
    Object.assign(this, data);
  }
  index(x, y, z) {
    const [nx, ny, nz] = this.dims;
    return x < 0 || y < 0 || z < 0 || x >= nx || y >= ny || z >= nz ? -1 : x + nx * (z + nz * y);
  }
  coords(x, y, z) {
    return [x, y, z].map((v, a) => Math.floor((v - this.min[a]) / this.cell));
  }
  support(x, z, ceiling, drop = 0.5) {
    const [ix, iy, iz] = this.coords(x, ceiling, z);
    const low = Math.floor((ceiling - drop - this.min[1]) / this.cell);
    let best = null;
    for (let y = Math.min(iy, this.dims[1] - 1); y >= Math.max(0, low); y--) {
      const k = this.index(ix, y, iz);
      if (k < 0 || !this.solid[k] || !Number.isFinite(this.floor[k])) continue;
      const h = this.floor[k];
      if (h <= ceiling + 0.001 && h >= ceiling - drop && (!best || h > best.height))
        best = { height: h, slope: this.slopes[k] };
    }
    return best;
  }
  clear(pos, radius = 0.28, height = 1.7) {
    const [x, y, z] = pos,
      c = this.cell;
    const lo = this.coords(x - radius, y + Math.min(0.06, height / 4), z - radius);
    const hi = this.coords(x + radius, y + height - Math.min(0.03, height / 4), z + radius);
    // Upright capsule: horizontal radius shrinks around the top/bottom hemispheres.
    for (let iy = lo[1]; iy <= hi[1]; iy++) {
      const cy = this.min[1] + (iy + 0.5) * c;
      const dy = Math.max(0, y + radius - (cy + c / 2), cy - c / 2 - (y + height - radius));
      const rr = Math.sqrt(Math.max(0, radius * radius - dy * dy));
      for (let iz = lo[2]; iz <= hi[2]; iz++)
        for (let ix = lo[0]; ix <= hi[0]; ix++) {
          const k = this.index(ix, iy, iz);
          if (k < 0 || !this.solid[k]) continue;
          // The standing surface is not a wall, even when it falls into this voxel.
          if (Number.isFinite(this.floor[k]) && this.floor[k] <= y + 0.055) continue;
          const dx = Math.max(0, Math.abs(this.min[0] + (ix + 0.5) * c - x) - c / 2);
          const dz = Math.max(0, Math.abs(this.min[2] + (iz + 0.5) * c - z) - c / 2);
          if (dx * dx + dz * dz < rr * rr - 1e-8) return false;
        }
    }
    return true;
  }
  safeSupport(x, z, ceiling, radius = 0.28, drop = 0.5) {
    let high = -Infinity,
      slope = 0;
    for (const [dx, dz] of [
      [0, 0],
      [radius, 0],
      [-radius, 0],
      [0, radius],
      [0, -radius],
    ]) {
      const s = this.support(x + dx, z + dz, ceiling, drop);
      if (!s) return null;
      high = Math.max(high, s.height);
      slope = Math.max(slope, s.slope);
    }
    return { height: high, slope };
  }
  spawn(preferred = [0, 0, 0]) {
    for (let ring = 0; ring < 70; ring++)
      for (let j = 0; j < Math.max(1, ring * 8); j++) {
        const angle = (j / Math.max(1, ring * 8)) * Math.PI * 2;
        const x = preferred[0] + Math.cos(angle) * ring * this.cell;
        const z = preferred[2] + Math.sin(angle) * ring * this.cell;
        const s = this.safeSupport(x, z, preferred[1] + 0.4, 0.28, 1.2);
        if (s && s.slope <= 35 && this.clear([x, s.height, z])) return [x, s.height, z];
      }
    throw new Error(
      "No safe standing area found. Adjust the scale or level, or open a capture with more floor.",
    );
  }
  edgeDistance(pos, radius = 0.28) {
    for (let d = 0.1; d <= 1; d += 0.1)
      for (let i = 0; i < 8; i++) {
        const a = (i * Math.PI) / 4;
        if (
          !this.support(
            pos[0] + Math.cos(a) * (d + radius),
            pos[2] + Math.sin(a) * (d + radius),
            pos[1] + 0.26,
            0.6,
          )
        )
          return d;
      }
    return 1;
  }
}
