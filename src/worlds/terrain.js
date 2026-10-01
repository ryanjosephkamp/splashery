// The ground of a world: a height field from the world's seed and terrain
// settings, and the splats that cover it (sand, grass, rock and snow by
// height and slope), built chunk by chunk at several levels of detail.
// Pure JavaScript (no engine imports), so tests and tools can use it too.
//
// Coordinates are meters: x east, y up, z south. The height field is the
// one truth for the ground: the splats are laid on it, and collision
// (physics.js) and the camera (camera.js) read it.

import { mulberry32, createNoise3, mixSeed } from "../noise.js";
import { SplatBuffer, discRotation } from "../generators.js";
import { rgb, mix, shade, smoothstep, clamp } from "../kit.js";

const TAU = Math.PI * 2;

// Splats per square meter at each level of detail, before the tier's density.
// Level 0 is the near ground (with grass blades), level 4 the far ground.
export const TERRAIN_LEVELS = [
  { density: 110, size: 0.95 },
  { density: 28, size: 1 },
  { density: 7, size: 1 },
  { density: 1.9, size: 1 },
  { density: 0.5, size: 1 },
];

// Grass blades per square meter on the near ground, before the tier's grass.
export const BLADES = 110;

export class Terrain {
  // t: the world's normalized terrain settings (world-file.js); colors: its
  // colors; seed: the world's seed.
  constructor(t, colors, seed) {
    this.t = t;
    this.colors = {};
    for (const k in colors) this.colors[k] = rgb(colors[k]);
    this.seed = seed >>> 0;
    this.noise = createNoise3(mixSeed(this.seed, "world-terrain"));
    this.detail = createNoise3(mixSeed(this.seed, "world-detail"));
    this.water = t.waterLevel;
    this.half = t.size / 2;
    // Flattened places keep the height their center had.
    this.flats = t.flatten.map((f) => ({ ...f, h: this.rawHeight(f.at[0], f.at[1]) }));
  }

  // The coastline's distance measure: 0 at the island's center, 1 at the
  // shore, bent by noise so the coast wanders.
  shoreDistance(x, z) {
    const t = this.t;
    const dx = x - t.center[0];
    const dz = z - t.center[1];
    const r = Math.hypot(dx / t.radius[0], dz / t.radius[1]);
    const warp = this.noise.fbm(x * 0.035 + 11.3, 0.5, z * 0.035 - 4.1, 3) * t.coast;
    return r * (1 + warp);
  }

  rawHeight(x, z) {
    const t = this.t;
    if (t.shape === "flat") return t.base + this.hills(x, z);
    const d = this.shoreDistance(x, z);
    // 1 well inland, 0 out at sea.
    const land = smoothstep(1.18, 0.62, d);
    const sea = -t.seaDepth;
    // The shore rises from the sea bed to the beach, then the land rises.
    let h = sea + (t.beachHeight - sea) * smoothstep(0, 0.42, land);
    const inland = smoothstep(0.38, 1, land);
    const rough = 0.55 + 0.9 * this.noise.fbm(x * 0.045, 3.7, z * 0.045, 4) * t.roughness * 2;
    h += t.height * Math.pow(inland, 1.4) * Math.max(0.15, rough);
    return h + this.hills(x, z) * smoothstep(0.2, 0.7, land);
  }

  hills(x, z) {
    let h = 0;
    for (const hl of this.t.hills) {
      const d2 = ((x - hl.at[0]) ** 2 + (z - hl.at[1]) ** 2) / (hl.radius * hl.radius);
      h += hl.height * Math.exp(-d2 * 2);
    }
    return h;
  }

  // The ground height at (x, z).
  heightAt(x, z) {
    let h = this.rawHeight(x, z);
    for (const f of this.flats) {
      const d = Math.hypot(x - f.at[0], z - f.at[1]);
      if (d < f.radius) h += (f.h - h) * smoothstep(f.radius, f.radius * 0.55, d);
    }
    return h;
  }

  // The ground's unit normal at (x, z).
  normalAt(x, z, e = 0.35) {
    const hx = this.heightAt(x + e, z) - this.heightAt(x - e, z);
    const hz = this.heightAt(x, z + e) - this.heightAt(x, z - e);
    const n = [-hx / (2 * e), 1, -hz / (2 * e)];
    const l = Math.hypot(n[0], n[1], n[2]);
    return [n[0] / l, n[1] / l, n[2] / l];
  }

  // Rise over run (0 flat, 1 is 45 degrees).
  slopeAt(x, z) {
    const n = this.normalAt(x, z);
    return Math.sqrt(1 - n[1] * n[1]) / Math.max(1e-3, n[1]);
  }

  // What covers the ground here: "sand", "grass", "rock", "snow" or "seabed".
  surfaceAt(x, z) {
    const h = this.heightAt(x, z);
    const t = this.t;
    if (h < this.water - 0.05) return "seabed";
    if (h > t.snowLine) return "snow";
    if (this.slopeAt(x, z) > t.rockSlope) return "rock";
    if (h < this.water + t.beach) return "sand";
    return "grass";
  }

  // The ground's color at a point (h, n already known), with small variation.
  // `lit: false` leaves out the baked sunlight (hybrid mode's lit ground).
  colorAt(x, z, h, n, r, { lit: bake = true } = {}) {
    const c = this.colors;
    const t = this.t;
    const w = this.water;
    const v = this.detail.fbm(x * 0.6, 1.3, z * 0.6, 3);
    const big = this.detail.fbm(x * 0.07, 7.1, z * 0.07, 2);
    const slope = Math.sqrt(1 - n[1] * n[1]) / Math.max(1e-3, n[1]);
    // Sand: darker and wetter at the water's edge, darker still under it.
    let sand = mix(c.sand, c.wetSand, smoothstep(w + 0.35, w - 0.05, h));
    sand = mix(sand, c.seabed, smoothstep(w - 0.2, w - 2.2, h));
    const grass = mix(mix(c.grass, c.grassDry, clamp(0.25 + big * 1.2, 0, 0.6)), c.grassDark, clamp(0.5 - v * 1.8, 0, 1) * 0.4); // prettier-ignore
    const rock = mix(c.rock, c.rockDark, clamp(0.5 + v * 2, 0, 1));
    // The beach line wanders a little.
    const edge = w + t.beach + big * 0.8;
    let col = mix(sand, grass, smoothstep(edge - 0.25, edge + 0.35, h));
    col = mix(col, rock, smoothstep(t.rockSlope * 0.8, t.rockSlope * 1.15, slope));
    col = mix(col, c.snow, smoothstep(t.snowLine - 0.5, t.snowLine + 0.5, h + v * 2));
    // Fake light from the sun: the kit's toys bake their shading the same way.
    const sun = this.sun || (this.sun = unit3([-0.45, 0.8, 0.35]));
    const lit = bake ? 0.72 + 0.38 * Math.max(0, n[0] * sun[0] + n[1] * sun[1] + n[2] * sun[2]) : 1; // prettier-ignore
    const j = (r() - 0.5) * 0.02;
    return [
      clamp(col[0] * lit + j, 0, 1),
      clamp(col[1] * lit + j, 0, 1),
      clamp(col[2] * lit + j, 0, 1),
    ];
  }

  // ---- Chunks ----------------------------------------------------------------

  // The chunk grid: square cells of `chunk` meters over the world's size.
  // A chunk that lies wholly under deep water has no ground splats.
  chunks() {
    if (this.chunkList) return this.chunkList;
    const t = this.t;
    const C = t.chunk;
    const n = Math.ceil(t.size / C);
    const out = [];
    for (let j = 0; j < n; j++) {
      for (let i = 0; i < n; i++) {
        const x0 = -this.half + i * C;
        const z0 = -this.half + j * C;
        let hi = -Infinity;
        let lo = Infinity;
        for (let b = 0; b <= 8; b++)
          for (let a = 0; a <= 8; a++) {
            const h = this.heightAt(x0 + (a / 8) * C, z0 + (b / 8) * C);
            hi = Math.max(hi, h);
            lo = Math.min(lo, h);
          }
        const ground = hi > this.water - t.clearDepth;
        out.push({
          id: `${i},${j}`,
          i,
          j,
          x0,
          z0,
          size: C,
          center: [x0 + C / 2, (Math.max(lo, this.water - t.clearDepth) + hi) / 2, z0 + C / 2],
          lo,
          hi,
          ground,
        });
      }
    }
    this.chunkList = out;
    return out;
  }

  // How many splats a chunk's ground has at a level (an estimate for the
  // planner; the build may differ by a few percent).
  groundCount(chunk, level, density = 1) {
    if (!chunk.ground) return 0;
    const d = TERRAIN_LEVELS[level].density * density;
    return Math.round(chunk.size * chunk.size * d * groundShare(this, chunk));
  }

  // Builds a chunk's ground splats at a level into a SplatBuffer.
  // Positions are relative to the chunk's corner (x0, water, z0), so the
  // numbers stay small; the renderer places the chunk there.
  // `carpet: false` leaves out the ground itself and keeps the grass blades
  // (hybrid mode draws the ground as a model).
  buildGround(chunk, level, { density = 1, grass = 1, carpet = true } = {}) {
    const t = this.t;
    const L = TERRAIN_LEVELS[level];
    const d = L.density * density;
    const spacing = 1 / Math.sqrt(d);
    const C = chunk.size;
    const cells = carpet ? Math.max(1, Math.round(C / spacing)) : 0;
    const step = C / cells;
    const r = mulberry32(mixSeed(this.seed, `ground-${chunk.id}-${level}`));
    const blades = level === 0 ? Math.round(C * C * BLADES * grass) : 0;
    const buf = new SplatBuffer(cells * cells + blades);
    const floor = this.water - t.clearDepth;
    const size = step * 0.72 * L.size;
    for (let b = 0; b < cells; b++) {
      for (let a = 0; a < cells; a++) {
        const x = chunk.x0 + (a + 0.1 + 0.8 * r()) * step;
        const z = chunk.z0 + (b + 0.1 + 0.8 * r()) * step;
        const h = this.heightAt(x, z);
        if (h < floor) continue;
        const n = this.normalAt(x, z);
        const col = this.colorAt(x, z, h, n, r);
        // Flat, nearly round, nearly the same size: an even carpet reads
        // as solid ground (uneven sizes and shapes read as grain).
        const s = size * Math.exp((r() - 0.5) * 0.14);
        buf.push(
          [x - chunk.x0, h - this.water, z - chunk.z0],
          [s, s * (0.92 + 0.1 * r()), s * 0.12],
          discRotation(n, r() * TAU),
          [col[0], col[1], col[2], 1],
        );
      }
    }
    // Grass blades on the near ground: thin upright splats, a few shades.
    const c = this.colors;
    for (let i = 0; i < blades; i++) {
      const x = chunk.x0 + r() * C;
      const z = chunk.z0 + r() * C;
      const h = this.heightAt(x, z);
      if (h < this.water + t.beach + 0.15 || h > t.snowLine - 0.5) continue;
      const n = this.normalAt(x, z);
      if (n[1] < 0.8) continue;
      const tall = 0.06 + 0.08 * r();
      const lean = r() * TAU;
      const dir = unit3([Math.cos(lean) * 0.35, 1, Math.sin(lean) * 0.35]);
      // A blade takes the ground's own color, a little lighter or darker,
      // so blades read as texture rather than as flecks.
      const base = this.colorAt(x, z, h, n, r);
      const col =
        r() < 0.75 ? mix(base, c.grassLight, 0.12 + 0.22 * r()) : shade(base, 0.82 + 0.1 * r());
      buf.push(
        [
          x - chunk.x0 + dir[0] * tall,
          h - this.water + dir[1] * tall,
          z - chunk.z0 + dir[2] * tall,
        ],
        [tall, 0.007 + 0.005 * r(), 0.007],
        fromTo([1, 0, 0], dir),
        [col[0], col[1], col[2], 0.95],
      );
    }
    return buf;
  }
}

// The share of a chunk that has ground splats (under the clear depth there
// are none). Attached to chunk records by the planner.
export function groundShare(terrain, chunk) {
  if (chunk.share !== undefined) return chunk.share;
  const floor = terrain.water - terrain.t.clearDepth;
  let n = 0;
  for (let b = 0; b < 6; b++)
    for (let a = 0; a < 6; a++)
      if (terrain.heightAt(chunk.x0 + ((a + 0.5) / 6) * chunk.size, chunk.z0 + ((b + 0.5) / 6) * chunk.size) >= floor) n++; // prettier-ignore
  chunk.share = n / 36;
  return chunk.share;
}

function unit3(v) {
  const l = Math.hypot(v[0], v[1], v[2]) || 1;
  return [v[0] / l, v[1] / l, v[2] / l];
}

// The shortest rotation taking a onto b (both unit), as [x, y, z, w].
function fromTo(a, b) {
  const d = a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
  const c = [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
  const q = [c[0], c[1], c[2], 1 + d];
  const l = Math.hypot(q[0], q[1], q[2], q[3]) || 1;
  return [q[0] / l, q[1] / l, q[2] / l, q[3] / l];
}

export { unit3, fromTo };
