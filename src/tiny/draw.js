// Small drawing helpers for the Tiny world r2 toys: letters made of splats
// and a few vector sums. (The letters follow lane AI's inkShape in
// src/packs/computing.js: splats only on the ink, one square per font pixel.)

import { BITMAP } from "../font.js";

export const add = (a, b) => [a[0] + b[0], a[1] + b[1], a[2] + b[2]];
export const sub = (a, b) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
export const mul = (a, s) => [a[0] * s, a[1] * s, a[2] * s];
export const len = (a) => Math.hypot(a[0], a[1], a[2]);
export const unit = (a) => mul(a, 1 / (len(a) || 1));
export const lerp = (a, b, t) => add(a, mul(sub(b, a), t));
export const clamp01 = (x) => Math.min(1, Math.max(0, x));
export const ease = (x) => {
  const t = clamp01(x);
  return t * t * (3 - 2 * t);
};
// 0 before a, rising to 1 at b.
export const band = (x, a, b) => clamp01((x - a) / (b - a));

const BITS = { ...BITMAP, "'": BITMAP["'"] };

function inkAt(str, s, t) {
  if (s < 0 || t < 0 || t >= 7) return false;
  const col = Math.floor(s / 6);
  const gx = Math.floor(s - col * 6);
  const g = BITS[str[col]];
  if (!g || gx > 4) return false;
  return ((g[Math.floor(t)] >> (4 - gx)) & 1) === 1;
}

export const textWidth = (str) => str.length * 6 - 1;

// A line of capital letters facing +Z, its top left at the origin, `px` the
// size of one font pixel. Use with even: true.
export function inkShape(str, px) {
  const cells = [];
  const cols = textWidth(str);
  for (let gy = 0; gy < 7; gy++)
    for (let gx = 0; gx < cols; gx++) if (inkAt(str, gx + 0.5, gy + 0.5)) cells.push([gx, gy]);
  const N = Math.max(1, cells.length);
  const at = (k, fu, fv) => {
    const [gx, gy] = cells[Math.min(N - 1, k)] || [0, 0];
    return { p: [(gx + fu) * px, -(gy + fv) * px, 0], n: [0, 0, 1], u: (gx + fu) / cols, v: (gy + fv) / 7 }; // prettier-ignore
  };
  return {
    area: cells.length * px * px,
    thick: px,
    sample: (rand) => at(Math.floor(rand() * N), rand(), rand()),
    sampleEven: (a, b) => {
      const k = Math.floor(a * N);
      return at(k, b, a * N - k);
    },
  };
}

// Adds a centered line of text at `at` (its middle), facing +Z.
export function text(k, str, at, px, color, opts = {}) {
  const W = textWidth(str) * px;
  const H = 7 * px;
  const { weight = 10, ...rest } = opts;
  k.add(inkShape(str, px), {
    pos: [at[0] - W / 2, at[1] + H / 2, at[2]],
    even: true,
    weight,
    size: 0.9,
    flat: 0.15,
    jitter: 0,
    pattern: false,
    ...rest,
    color: () => ({ c: color, keep: true }),
  });
}
