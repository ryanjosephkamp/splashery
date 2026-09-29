// Water and sky, as splats. Pure JavaScript.
//
// Water lies flat at the world's water level, chunk by chunk like the
// ground: clear and pale over the shallows (the sand shows through), deep
// blue farther out, with foam where it meets the beach. The sky is a dome
// of large, soft splats around the camera (it moves with the camera, so it
// always looks infinitely far): the sky color overhead fading to the
// horizon's, the sea's color below the horizon, a soft sun and a few
// clouds.

import { mulberry32, mixSeed } from "../noise.js";
import { SplatBuffer, discRotation } from "../generators.js";
import { rgb, mix, smoothstep, clamp } from "../kit.js";

const TAU = Math.PI * 2;

export const WATER_LEVELS = [
  { density: 5.5 },
  { density: 1.6 },
  { density: 0.45 },
  { density: 0.12 },
];

// Builds a chunk's water at a level, relative to (x0, water, z0).
export function buildWater(terrain, chunk, level, { density = 1 } = {}) {
  const d = WATER_LEVELS[level].density * Math.sqrt(density);
  const spacing = 1 / Math.sqrt(d);
  const C = chunk.size;
  const cells = Math.max(1, Math.round(C / spacing));
  const step = C / cells;
  const c = terrain.colors;
  const w = terrain.water;
  const r = mulberry32(mixSeed(terrain.seed, `water-${chunk.id}-${level}`));
  const buf = new SplatBuffer(cells * cells);
  const up = [0, 1, 0];
  for (let b = 0; b < cells; b++) {
    for (let a = 0; a < cells; a++) {
      const x = chunk.x0 + (a + 0.15 + 0.7 * r()) * step;
      const z = chunk.z0 + (b + 0.15 + 0.7 * r()) * step;
      const h = chunk.lo > w + 0.3 ? w + 1 : terrain.heightAt(x, z);
      if (h > w + 0.04) continue;
      const depth = w - h;
      // Pale and clear over the shallows, deep and solid out at sea.
      let col = mix(c.shallow, c.water, smoothstep(0.2, 3.5, depth));
      const ripple = terrain.detail.fbm(x * 0.35, 9.1, z * 0.9, 3);
      col = mix(col, c.horizon, clamp(0.12 + ripple * 0.5, 0, 0.35));
      const foam = smoothstep(0.35, 0.02, depth) * (0.55 + 0.45 * terrain.detail(x * 1.7, 2.2, z * 1.7)); // prettier-ignore
      col = mix(col, c.foam, clamp(foam, 0, 0.9));
      const opacity = clamp(0.35 + depth * 0.28 + foam * 0.5, 0.35, 0.97);
      const s = step * 0.8 * Math.exp((r() - 0.5) * 0.3);
      buf.push(
        [x - chunk.x0, 0.015 + foam * 0.02, z - chunk.z0],
        [s * 1.25, s * 0.75, s * 0.05],
        discRotation(up, r() * 0.4 + (a % 2) * 0.1),
        [col[0], col[1], col[2], opacity],
      );
    }
  }
  return buf;
}

// The open sea around the world's square: rings of ever larger splats out
// to `outer` meters from the center, fading into the horizon's haze.
export function buildOcean(terrain, { outer = 240, count = 4200 } = {}) {
  const c = terrain.colors;
  const inner = terrain.half;
  const r = mulberry32(mixSeed(terrain.seed, "world-ocean"));
  const buf = new SplatBuffer(count);
  const up = [0, 1, 0];
  // Rings from the square's edge outward; spacing grows with distance, so
  // each ring has the same count. Points inside the square are skipped
  // (the chunks cover it), with a splat's overlap at the seam.
  const rings = 26;
  const per = Math.floor(count / rings);
  const ringAt = (k) => inner * 0.97 + (outer - inner * 0.97) * Math.pow(k / (rings - 1), 1.5);
  for (let k = 0; k < rings; k++) {
    const rad = ringAt(k);
    const gap = ringAt(k + 1) - rad;
    const s = Math.max(gap * 0.95, (rad * TAU) / per / 1.5);
    for (let i = 0; i < per; i++) {
      const a = ((i + r()) / per) * TAU;
      const rr = rad + (r() - 0.5) * gap * 0.5;
      const x = Math.cos(a) * rr;
      const z = Math.sin(a) * rr;
      const sq = Math.max(Math.abs(x), Math.abs(z));
      if (sq < inner - s * 0.6) continue;
      const haze = smoothstep(inner, outer * 1.1, rr);
      let col = mix(c.water, c.horizon, 0.1 + 0.55 * haze);
      col = mix(
        col,
        c.horizon,
        clamp(terrain.detail.fbm(x * 0.05, 4.4, z * 0.05, 2) * 0.4, 0, 0.15),
      );
      buf.push([x, 0.01, z], [s * 1.15, s * 0.85, s * 0.04], discRotation(up, r() * TAU), [
        col[0],
        col[1],
        col[2],
        1,
      ]);
    }
  }
  return buf;
}

// The sky dome around the camera, radius R meters. `sun` is the direction
// the light comes from (the same as the ground's fake light).
export function buildSky(colors, { R = 260, seed = 1, clouds = 0.5, count = 5200 } = {}) {
  const c = {};
  for (const k in colors) c[k] = rgb(colors[k]);
  const r = mulberry32(mixSeed(seed, "world-sky"));
  const cloudN = Math.round(count * 0.5 * clouds);
  const buf = new SplatBuffer(count + cloudN + 80);
  const sun = unit([-0.45, 0.5, 0.35]);
  // The dome: rings of splats from below the horizon to overhead.
  const golden = Math.PI * (3 - Math.sqrt(5));
  for (let i = 0; i < count; i++) {
    // Denser near the horizon, where the colors change fastest.
    const f = (i + 0.5) / count;
    const el = -0.35 + 1.92 * Math.pow(f, 1.6); // radians, -20 to 90 degrees
    const az = i * golden;
    const ce = Math.cos(Math.min(el, Math.PI / 2));
    const d = [Math.cos(az) * ce, Math.sin(el), Math.sin(az) * ce];
    let col;
    if (el < 0) col = mix(mix(c.water, c.horizon, 0.25), c.water, smoothstep(0, -0.2, el));
    else col = mix(c.horizon, c.sky, smoothstep(0.0, 0.9, el));
    // A soft glow around the sun.
    const sd = d[0] * sun[0] + d[1] * sun[1] + d[2] * sun[2];
    col = mix(col, [1, 0.98, 0.9], smoothstep(0.9, 1, sd) * 0.6);
    const ring = Math.max(0.2, ce);
    const s = R * 0.07 * Math.sqrt((ring * 1.2) / (0.3 + f * 1.4)) * (0.9 + 0.2 * r());
    buf.push(
      [d[0] * R, d[1] * R, d[2] * R],
      [s, s, s * 0.08],
      discRotation([-d[0], -d[1], -d[2]], r() * TAU),
      [col[0], col[1], col[2], 1],
    );
  }
  // The sun's disc.
  for (let i = 0; i < 80; i++) {
    const p = sun.map((v) => v * R * 0.96);
    const a = r() * TAU;
    const rr = R * 0.02 * Math.sqrt(r());
    const t1 = unit([sun[2], 0, -sun[0]]);
    const t2 = [sun[1] * t1[2] - sun[2] * t1[1], sun[2] * t1[0] - sun[0] * t1[2], sun[0] * t1[1] - sun[1] * t1[0]]; // prettier-ignore
    buf.push(
      [p[0] + (t1[0] * Math.cos(a) + t2[0] * Math.sin(a)) * rr, p[1] + (t1[1] * Math.cos(a) + t2[1] * Math.sin(a)) * rr, p[2] + (t1[2] * Math.cos(a) + t2[2] * Math.sin(a)) * rr], // prettier-ignore
      [R * 0.012, R * 0.012, R * 0.001],
      discRotation(
        sun.map((v) => -v),
        0,
      ),
      [1, 0.99, 0.93, 0.9],
    );
  }
  // Clouds: flattened clusters of soft white splats.
  const puffs = Math.max(0, Math.round(14 * clouds));
  const per = puffs ? Math.floor(cloudN / puffs) : 0;
  for (let p = 0; p < puffs; p++) {
    const az = r() * TAU;
    const el = 0.12 + r() * 0.42;
    const w = 0.05 + r() * 0.07;
    for (let i = 0; i < per; i++) {
      const a2 = az + (r() - 0.5) * w * 2.2;
      const e2 = el + (r() - 0.5) * w * 0.55 + Math.max(0, (r() - 0.5) * w * 0.5);
      const ce = Math.cos(e2);
      const d = [Math.cos(a2) * ce, Math.sin(e2), Math.sin(a2) * ce];
      const R2 = R * 0.9;
      const under = smoothstep(el + w * 0.2, el - w * 0.3, e2);
      const col = mix(c.cloud, mix(c.cloud, c.sky, 0.45), under * 0.8);
      const s = R2 * w * (0.12 + 0.12 * r());
      buf.push(
        [d[0] * R2, d[1] * R2, d[2] * R2],
        [s * 1.4, s, s * 0.3],
        discRotation([-d[0], -d[1], -d[2]], r() * 0.3),
        [col[0], col[1], col[2], 0.55 + 0.3 * r()],
      );
    }
  }
  return buf;
}

function unit(v) {
  const l = Math.hypot(v[0], v[1], v[2]) || 1;
  return [v[0] / l, v[1] / l, v[2] / l];
}
