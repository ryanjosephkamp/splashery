// Seeded randomness and smooth 3D noise for the procedural generators.
// Everything here is deterministic for a given seed.

// Deterministic PRNG (mulberry32). Returns floats in [0, 1).
export function mulberry32(seed) {
  let a = seed >>> 0;
  return function () {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// FNV-1a string hash, used to derive sub-seeds from names.
export function hash32(str) {
  let h = 0x811c9dc5;
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return h >>> 0;
}

export function mixSeed(seed, salt) {
  return (Math.imul((seed >>> 0) ^ hash32(String(salt)), 0x9e3779b1) ^ 0x85ebca6b) >>> 0;
}

export function randomSeed() {
  if (globalThis.crypto && crypto.getRandomValues) {
    const u = new Uint32Array(1);
    crypto.getRandomValues(u);
    return u[0] >>> 0;
  }
  return (Math.random() * 4294967296) >>> 0;
}

// Classic 3D gradient (Perlin) noise with a seeded permutation table.
// Returns values roughly in [-1, 1].
export function createNoise3(seed) {
  const rand = mulberry32(seed);
  const perm = new Uint8Array(512);
  const p = new Uint8Array(256);
  for (let i = 0; i < 256; i++) p[i] = i;
  for (let i = 255; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1));
    const t = p[i];
    p[i] = p[j];
    p[j] = t;
  }
  for (let i = 0; i < 512; i++) perm[i] = p[i & 255];
  const G = [
    [1, 1, 0],
    [-1, 1, 0],
    [1, -1, 0],
    [-1, -1, 0],
    [1, 0, 1],
    [-1, 0, 1],
    [1, 0, -1],
    [-1, 0, -1],
    [0, 1, 1],
    [0, -1, 1],
    [0, 1, -1],
    [0, -1, -1],
  ];
  const fade = (t) => t * t * t * (t * (t * 6 - 15) + 10);
  const grad = (h, x, y, z) => {
    const g = G[h % 12];
    return g[0] * x + g[1] * y + g[2] * z;
  };
  function noise(x, y, z) {
    const X = Math.floor(x);
    const Y = Math.floor(y);
    const Z = Math.floor(z);
    x -= X;
    y -= Y;
    z -= Z;
    const xi = X & 255;
    const yi = Y & 255;
    const zi = Z & 255;
    const u = fade(x);
    const v = fade(y);
    const w = fade(z);
    const A = perm[xi] + yi;
    const AA = perm[A] + zi;
    const AB = perm[A + 1] + zi;
    const B = perm[xi + 1] + yi;
    const BA = perm[B] + zi;
    const BB = perm[B + 1] + zi;
    const l = (a, b, t) => a + t * (b - a);
    return l(
      l(
        l(grad(perm[AA], x, y, z), grad(perm[BA], x - 1, y, z), u),
        l(grad(perm[AB], x, y - 1, z), grad(perm[BB], x - 1, y - 1, z), u),
        v,
      ),
      l(
        l(grad(perm[AA + 1], x, y, z - 1), grad(perm[BA + 1], x - 1, y, z - 1), u),
        l(grad(perm[AB + 1], x, y - 1, z - 1), grad(perm[BB + 1], x - 1, y - 1, z - 1), u),
        v,
      ),
      w,
    );
  }
  // Fractal sum of octaves, normalised back to roughly [-1, 1].
  noise.fbm = function (x, y, z, octaves = 4) {
    let sum = 0;
    let amp = 1;
    let norm = 0;
    let f = 1;
    for (let o = 0; o < octaves; o++) {
      sum += amp * noise(x * f, y * f, z * f);
      norm += amp;
      amp *= 0.5;
      f *= 2.03;
    }
    return sum / norm;
  };
  return noise;
}
