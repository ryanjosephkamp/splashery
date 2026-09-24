// Procedural toys: seeded generators that build a splat object in the
// browser. Pure JavaScript (no engine imports) so it can run anywhere.
//
// A generator fills a SplatBuffer: positions, anisotropic scales, rotations
// (x, y, z, w) and colours (display RGB plus opacity). Surface splats are
// flat discs lying on the surface; a share of splats fills the inside so the
// slice effect has something to reveal. Clay operations (add or erase blobs)
// are replayed on top, in order, so a saved JSON rebuilds the same toy.

import { mulberry32, createNoise3, mixSeed } from "./noise.js";

export const SHAPES = [
  { id: "sphere", label: "Sphere" },
  { id: "blob", label: "Noise blob" },
  { id: "torus", label: "Torus" },
  { id: "capsule", label: "Capsule" },
  { id: "knot", label: "Knot" },
];

export const PALETTES = [
  {
    id: "candy",
    label: "Candy",
    stops: ["#ff5fa2", "#ffd166", "#7bdff2", "#b388ff"],
    core: "#fff3b0",
  },
  {
    id: "ocean",
    label: "Ocean",
    stops: ["#03256c", "#2541b2", "#1768ac", "#06bee1", "#e8fbff"],
    core: "#ffcf56",
  },
  {
    id: "meadow",
    label: "Meadow",
    stops: ["#1b4332", "#40916c", "#95d5b2", "#f1faee"],
    core: "#f4a259",
  },
  {
    id: "sunset",
    label: "Sunset",
    stops: ["#3d1766", "#b5179e", "#f72585", "#ff9e00", "#ffdd00"],
    core: "#fff1c1",
  },
  { id: "ink", label: "Ink", stops: ["#111111", "#3a3a3a", "#8c8c8c", "#f2f2f2"], core: "#e63b2e" },
  {
    id: "neon",
    label: "Neon",
    stops: ["#00f5d4", "#00bbf9", "#9b5de5", "#f15bb5", "#fee440"],
    core: "#ffffff",
  },
  { id: "planet", label: "Planet (tribute)", stops: [], core: "#ff7b00" },
  { id: "frosting", label: "Frosting", stops: [], core: "#f6dfa4" },
];

export const SHAPE_IDS = SHAPES.map((s) => s.id);
export const PALETTE_IDS = PALETTES.map((p) => p.id);

export const DEFAULT_GENERATOR = Object.freeze({
  shape: "blob",
  palette: "candy",
  seed: 1,
  count: 120000,
  sizeJitter: 0.35,
  roughness: 0.3,
  colorNoise: 0.25,
});

// Splat counts by device tier (see detectProfile in player.js). "weak" and
// "strong" are the tier names before v4, kept for ?profile= and old callers.
export const PROFILES = {
  low: { maxCount: 120000, defaultCount: 60000 },
  mid: { maxCount: 240000, defaultCount: 140000 },
  high: { maxCount: 300000, defaultCount: 200000 },
  max: { maxCount: 400000, defaultCount: 280000 },
};
PROFILES.weak = PROFILES.low;
PROFILES.strong = PROFILES.high;

const INTERIOR = 0.18;
const TAU = Math.PI * 2;

// ---- Buffer -----------------------------------------------------------------

export class SplatBuffer {
  // `anim` adds the per-splat part and behaviour data kit toys carry
  // (see KINDS in effects.js): [part + 16 * flags, kind, a, b].
  constructor(capacity, { anim = false } = {}) {
    this.capacity = capacity;
    this.count = 0;
    this.pos = new Float32Array(capacity * 3);
    this.scale = new Float32Array(capacity * 3);
    this.rot = new Float32Array(capacity * 4);
    this.color = new Float32Array(capacity * 4);
    this.anim = anim ? new Float32Array(capacity * 4) : null;
  }

  push(p, s, q, c, a) {
    if (this.count >= this.capacity) return -1;
    const i = this.count++;
    if (a && this.anim) {
      this.anim[i * 4] = a[0];
      this.anim[i * 4 + 1] = a[1];
      this.anim[i * 4 + 2] = a[2];
      this.anim[i * 4 + 3] = a[3];
    }
    this.pos[i * 3] = p[0];
    this.pos[i * 3 + 1] = p[1];
    this.pos[i * 3 + 2] = p[2];
    this.scale[i * 3] = s[0];
    this.scale[i * 3 + 1] = s[1];
    this.scale[i * 3 + 2] = s[2];
    this.rot[i * 4] = q[0];
    this.rot[i * 4 + 1] = q[1];
    this.rot[i * 4 + 2] = q[2];
    this.rot[i * 4 + 3] = q[3];
    this.color[i * 4] = c[0];
    this.color[i * 4 + 1] = c[1];
    this.color[i * 4 + 2] = c[2];
    this.color[i * 4 + 3] = c[3];
    return i;
  }

  kill(i) {
    this.scale[i * 3] = this.scale[i * 3 + 1] = this.scale[i * 3 + 2] = 0;
    this.color[i * 4 + 3] = 0;
  }

  bounds() {
    const min = [Infinity, Infinity, Infinity];
    const max = [-Infinity, -Infinity, -Infinity];
    for (let i = 0; i < this.count; i++) {
      if (this.color[i * 4 + 3] <= 0) continue;
      for (let k = 0; k < 3; k++) {
        const v = this.pos[i * 3 + k];
        if (v < min[k]) min[k] = v;
        if (v > max[k]) max[k] = v;
      }
    }
    if (min[0] === Infinity) return { min: [-1, -1, -1], max: [1, 1, 1] };
    return { min, max };
  }
}

// ---- Small vector helpers ---------------------------------------------------

export const norm = (v) => {
  const l = Math.hypot(v[0], v[1], v[2]) || 1;
  return [v[0] / l, v[1] / l, v[2] / l];
};
export const cross = (a, b) => [
  a[1] * b[2] - a[2] * b[1],
  a[2] * b[0] - a[0] * b[2],
  a[0] * b[1] - a[1] * b[0],
];
const dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
const lerp = (a, b, t) => a + (b - a) * t;
const clamp01 = (v) => (v < 0 ? 0 : v > 1 ? 1 : v);

export function hexRgb(hex) {
  const n = parseInt(hex.slice(1), 16);
  return [((n >> 16) & 255) / 255, ((n >> 8) & 255) / 255, (n & 255) / 255];
}

// Samples a palette. `sharp` (0..1) keeps more of each pure colour and
// shortens the blends between them, so mixes do not go muddy.
function gradient(stops, t, sharp = 0) {
  t = clamp01(t) * (stops.length - 1);
  const i = Math.min(stops.length - 2, Math.floor(t));
  let f = t - i;
  if (sharp > 0) {
    const e = 0.5 * sharp;
    f = clamp01((f - e * 0.8) / (1 - e * 1.6));
    f = f * f * (3 - 2 * f);
  }
  const a = stops[i];
  const b = stops[i + 1];
  return [lerp(a[0], b[0], f), lerp(a[1], b[1], f), lerp(a[2], b[2], f)];
}

// Quaternion (x, y, z, w) turning +Z onto n, then spun by `spin` around n.
export function discRotation(n, spin) {
  let q;
  if (n[2] < -0.9999) q = [1, 0, 0, 0];
  else q = norm4([-n[1], n[0], 0, 1 + n[2]]);
  const h = spin * 0.5;
  const s = Math.sin(h);
  const r = [n[0] * s, n[1] * s, n[2] * s, Math.cos(h)];
  return quatMul(r, q);
}

function norm4(q) {
  const l = Math.hypot(q[0], q[1], q[2], q[3]) || 1;
  return [q[0] / l, q[1] / l, q[2] / l, q[3] / l];
}

function quatMul(a, b) {
  return [
    a[3] * b[0] + b[3] * a[0] + a[1] * b[2] - a[2] * b[1],
    a[3] * b[1] + b[3] * a[1] + a[2] * b[0] - a[0] * b[2],
    a[3] * b[2] + b[3] * a[2] + a[0] * b[1] - a[1] * b[0],
    a[3] * b[3] - a[0] * b[0] - a[1] * b[1] - a[2] * b[2],
  ];
}

export function tangentFrame(n) {
  const a = Math.abs(n[1]) < 0.9 ? [0, 1, 0] : [1, 0, 0];
  const t1 = norm(cross(a, n));
  const t2 = cross(n, t1);
  return [t1, t2];
}

// ---- Shapes -----------------------------------------------------------------
// Each shape samples a surface point with its outward normal and the local
// thickness (how deep the inside goes). Sampling is close to area-uniform.

function makeShape(id, noise) {
  switch (id) {
    case "sphere": {
      const r = 0.8;
      return {
        area: 4 * Math.PI * r * r,
        sample(rand) {
          const d = randomDir(rand);
          return { p: [d[0] * r, d[1] * r, d[2] * r], n: d, thick: r };
        },
      };
    }
    case "blob": {
      const base = 0.7;
      const radius = (d) =>
        base * (1 + 0.34 * noise.fbm(d[0] * 1.25 + 7.1, d[1] * 1.25, d[2] * 1.25 - 3.3, 3));
      return {
        area: 4 * Math.PI * base * base * 1.25,
        sample(rand) {
          const d = randomDir(rand);
          const r0 = radius(d);
          const [t1, t2] = tangentFrame(d);
          const e = 0.01;
          const d1 = norm([d[0] + t1[0] * e, d[1] + t1[1] * e, d[2] + t1[2] * e]);
          const d2 = norm([d[0] + t2[0] * e, d[1] + t2[1] * e, d[2] + t2[2] * e]);
          const p0 = [d[0] * r0, d[1] * r0, d[2] * r0];
          const r1 = radius(d1);
          const r2 = radius(d2);
          const p1 = [d1[0] * r1 - p0[0], d1[1] * r1 - p0[1], d1[2] * r1 - p0[2]];
          const p2 = [d2[0] * r2 - p0[0], d2[1] * r2 - p0[1], d2[2] * r2 - p0[2]];
          let n = norm(cross(p1, p2));
          if (dot(n, d) < 0) n = [-n[0], -n[1], -n[2]];
          return { p: p0, n, thick: r0 };
        },
      };
    }
    case "torus": {
      const R = 0.6;
      const r = 0.29;
      return {
        area: 4 * Math.PI * Math.PI * R * r,
        sample(rand) {
          let u;
          let v;
          do {
            u = rand() * TAU;
            v = rand() * TAU;
          } while (rand() > (R + r * Math.cos(v)) / (R + r));
          const cu = Math.cos(u);
          const su = Math.sin(u);
          const cv = Math.cos(v);
          const sv = Math.sin(v);
          return {
            p: [(R + r * cv) * cu, r * sv, (R + r * cv) * su],
            n: [cv * cu, sv, cv * su],
            thick: r,
            v: sv,
          };
        },
      };
    }
    case "capsule": {
      const r = 0.42;
      const h = 0.38;
      const side = 2 * Math.PI * r * 2 * h;
      const caps = 4 * Math.PI * r * r;
      return {
        area: side + caps,
        sample(rand) {
          if (rand() * (side + caps) < side) {
            const a = rand() * TAU;
            const y = (rand() * 2 - 1) * h;
            const n = [Math.cos(a), 0, Math.sin(a)];
            return { p: [n[0] * r, y, n[2] * r], n, thick: r };
          }
          const d = randomDir(rand);
          const y = d[1] >= 0 ? h : -h;
          return { p: [d[0] * r, y + d[1] * r, d[2] * r], n: d, thick: r };
        },
      };
    }
    case "knot":
    default: {
      const k = 0.27;
      const tube = 0.13;
      const c = (t) => [
        k * (Math.sin(t) + 2 * Math.sin(2 * t)),
        k * (Math.cos(t) - 2 * Math.cos(2 * t)),
        k * -Math.sin(3 * t),
      ];
      const d1 = (t) => [
        k * (Math.cos(t) + 4 * Math.cos(2 * t)),
        k * (-Math.sin(t) + 4 * Math.sin(2 * t)),
        k * -3 * Math.cos(3 * t),
      ];
      const d2 = (t) => [
        k * (-Math.sin(t) - 8 * Math.sin(2 * t)),
        k * (-Math.cos(t) + 8 * Math.cos(2 * t)),
        k * 9 * Math.sin(3 * t),
      ];
      let maxSpeed = 0;
      let length = 0;
      const lo = [Infinity, Infinity, Infinity];
      const hi = [-Infinity, -Infinity, -Infinity];
      for (let i = 0; i < 512; i++) {
        const t = (i / 512) * TAU;
        const s = Math.hypot(...d1(t));
        maxSpeed = Math.max(maxSpeed, s);
        length += (s * TAU) / 512;
        const o = c(t);
        for (let k = 0; k < 3; k++) {
          lo[k] = Math.min(lo[k], o[k]);
          hi[k] = Math.max(hi[k], o[k]);
        }
      }
      // Centre the knot on the origin.
      const mid = [0, 1, 2].map((k) => (lo[k] + hi[k]) / 2);
      return {
        area: length * TAU * tube,
        sample(rand) {
          let t;
          do t = rand() * TAU;
          while (rand() * maxSpeed > Math.hypot(...d1(t)));
          const T = norm(d1(t));
          const B = norm(cross(d1(t), d2(t)));
          const N = cross(B, T);
          const a = rand() * TAU;
          const ca = Math.cos(a);
          const sa = Math.sin(a);
          const n = [N[0] * ca + B[0] * sa, N[1] * ca + B[1] * sa, N[2] * ca + B[2] * sa];
          const o = c(t);
          return {
            p: [
              o[0] - mid[0] + n[0] * tube,
              o[1] - mid[1] + n[1] * tube,
              o[2] - mid[2] + n[2] * tube,
            ],
            n,
            thick: tube,
          };
        },
      };
    }
  }
}

export function randomDir(rand) {
  const z = rand() * 2 - 1;
  const a = rand() * TAU;
  const r = Math.sqrt(1 - z * z);
  return [r * Math.cos(a), z, r * Math.sin(a)];
}

// ---- Colouring --------------------------------------------------------------
// Returns { surface(p, n, rand), core(p, depth, rand), displace(p, n) }.

function makeColoring(paletteId, seed, noise, colorNoise) {
  const pal = PALETTES.find((p) => p.id === paletteId) || PALETTES[0];
  const rand = mulberry32(mixSeed(seed, "palette"));
  const jitter = (c, r, amount) => [
    clamp01(c[0] + (r() - 0.5) * amount),
    clamp01(c[1] + (r() - 0.5) * amount),
    clamp01(c[2] + (r() - 0.5) * amount),
  ];
  const off = [rand() * 50, rand() * 50, rand() * 50];

  if (pal.id === "planet") {
    const ocean = [hexRgb("#0b2e6b"), hexRgb("#1f5fa8"), hexRgb("#4aa3df")];
    const land = [hexRgb("#2f6b2f"), hexRgb("#7a8c3a"), hexRgb("#8a6a43"), hexRgb("#9b9b9b")];
    const mantle = [hexRgb("#ffe066"), hexRgb("#ff7b00"), hexRgb("#b1160c")];
    const elev = (p) => noise.fbm(p[0] * 1.7 + off[0], p[1] * 1.7 + off[1], p[2] * 1.7 + off[2], 5);
    return {
      displace(p, n) {
        const e = elev(p);
        return e > 0.02 ? (e - 0.02) * 0.09 : 0;
      },
      surface(p, n, r) {
        const e = elev(p);
        const lat = Math.abs(n[1]);
        let c;
        if (lat > 0.84 - 0.08 * noise(p[0] * 4, p[1] * 4, p[2] * 4)) c = [0.93, 0.96, 1];
        else if (e < 0.02) c = gradient(ocean, clamp01((e + 0.45) / 0.47));
        else c = gradient(land, clamp01((e - 0.02) / 0.4));
        return jitter(c, r, colorNoise * 0.25);
      },
      core(p, depth, r) {
        return jitter(gradient(mantle, clamp01(depth * 1.1)), r, colorNoise * 0.3);
      },
      clouds: true,
    };
  }

  if (pal.id === "frosting") {
    const icings = ["#ff8fc7", "#6b3e26", "#9fe3c1", "#8ec5ff", "#fff4e0"];
    const icing = hexRgb(icings[Math.floor(rand() * icings.length)]);
    const dough = [hexRgb("#c98a45"), hexRgb("#e7b76a")];
    const sprinkles = ["#ff3b30", "#ffcc00", "#34c759", "#0a84ff", "#ffffff", "#af52de"].map(
      hexRgb,
    );
    const edge = (p) => -0.05 + 0.18 * noise(p[0] * 5 + off[0], p[1] * 5, p[2] * 5 + off[2]);
    return {
      displace(p, n) {
        return n[1] > edge(p) ? 0.012 : 0;
      },
      surface(p, n, r) {
        if (n[1] > edge(p)) {
          if (r() < 0.045)
            return { sprinkle: true, c: sprinkles[Math.floor(r() * sprinkles.length)] };
          return jitter(icing, r, colorNoise * 0.12);
        }
        return jitter(
          gradient(dough, 0.5 + 0.5 * noise(p[0] * 3, p[1] * 3, p[2] * 3)),
          r,
          colorNoise * 0.2,
        );
      },
      core(p, depth, r) {
        return jitter(hexRgb(pal.core), r, colorNoise * 0.15);
      },
    };
  }

  const stops = pal.stops.map(hexRgb);
  const core = hexRgb(pal.core);
  const f = 1.3 + rand() * 0.8;
  return {
    displace() {
      return 0;
    },
    surface(p, n, r) {
      const t = 0.5 + 1.15 * noise.fbm(p[0] * f + off[0], p[1] * f + off[1], p[2] * f + off[2], 3);
      return jitter(gradient(stops, t, 0.8), r, colorNoise * 0.45);
    },
    core(p, depth, r) {
      return jitter(core, r, colorNoise * 0.3);
    },
  };
}

// ---- Generator ----------------------------------------------------------------

// Normalises generator params (also used when loading JSON).
export function normalizeGenerator(g, profile = "high") {
  const src = g && typeof g === "object" ? g : {};
  const max = PROFILES[profile]?.maxCount ?? PROFILES.high.maxCount;
  const num = (v, d, lo, hi) => {
    const n = Number(v);
    return Number.isFinite(n) ? Math.min(hi, Math.max(lo, n)) : d;
  };
  return {
    shape: SHAPE_IDS.includes(src.shape) ? src.shape : DEFAULT_GENERATOR.shape,
    palette: PALETTE_IDS.includes(src.palette) ? src.palette : DEFAULT_GENERATOR.palette,
    seed: num(src.seed, DEFAULT_GENERATOR.seed, 0, 4294967295) >>> 0,
    count: Math.round(num(src.count, Math.min(DEFAULT_GENERATOR.count, max), 2000, max)),
    sizeJitter: num(src.sizeJitter, DEFAULT_GENERATOR.sizeJitter, 0, 1),
    roughness: num(src.roughness, DEFAULT_GENERATOR.roughness, 0, 1),
    colorNoise: num(src.colorNoise, DEFAULT_GENERATOR.colorNoise, 0, 1),
  };
}

export function clayBudget(count) {
  return Math.max(15000, Math.round(count * 0.2));
}

// Builds the toy. Yields progress (0..1) between chunks so the caller can
// keep the page responsive; the final return value is the context.
export function* generate(params, { clay = [] } = {}) {
  const g = params;
  const noise = createNoise3(mixSeed(g.seed, "shape"));
  const shape = makeShape(g.shape, noise);
  const coloring = makeColoring(
    g.palette,
    g.seed,
    createNoise3(mixSeed(g.seed, "color")),
    g.colorNoise,
  );
  const rand = mulberry32(mixSeed(g.seed, "splats"));
  const buf = new SplatBuffer(g.count + clayBudget(g.count));
  const rough = createNoise3(mixSeed(g.seed, "rough"));

  const interiorCount = Math.round(g.count * INTERIOR);
  const cloudShare = coloring.clouds ? 0.06 : 0;
  const cloudCount = Math.round(g.count * cloudShare);
  const surfaceCount = g.count - interiorCount - cloudCount;
  const base = Math.sqrt(shape.area / (surfaceCount * Math.PI)) * 1.35;

  const ctx = { g, shape, coloring, base, noise: rough, buf };
  const chunk = 8000;
  for (let i = 0; i < g.count; i++) {
    if (i < surfaceCount) emitSurface(ctx, rand);
    else if (i < surfaceCount + cloudCount) emitCloud(ctx, rand);
    else emitInterior(ctx, rand);
    if (i % chunk === chunk - 1) yield (i / g.count) * 0.95;
  }
  for (let k = 0; k < clay.length; k++) applyClay(ctx, clay[k], k);
  yield 1;
  return ctx;
}

// Runs a generator to completion synchronously (tests, tools).
export function generateSync(params, opts) {
  const it = generate(params, opts);
  let r = it.next();
  while (!r.done) r = it.next();
  return r.value;
}

function sizeFor(ctx, rand) {
  const j = ctx.g.sizeJitter;
  return ctx.base * Math.exp((rand() - 0.5) * 1.8 * j);
}

function emitSurface(ctx, rand) {
  const { g, shape, coloring, noise } = ctx;
  const s0 = shape.sample(rand);
  let n = s0.n;
  const bump = g.roughness * 0.07 * noise.fbm(s0.p[0] * 5, s0.p[1] * 5, s0.p[2] * 5, 3);
  const lift = coloring.displace(s0.p, n) + bump;
  const p = [s0.p[0] + n[0] * lift, s0.p[1] + n[1] * lift, s0.p[2] + n[2] * lift];
  if (g.roughness > 0) {
    const tilt = g.roughness * 0.6;
    n = norm([
      n[0] + (rand() - 0.5) * tilt,
      n[1] + (rand() - 0.5) * tilt,
      n[2] + (rand() - 0.5) * tilt,
    ]);
  }
  let col = coloring.surface(p, s0.n, rand);
  let s = sizeFor(ctx, rand);
  let sc;
  if (col && col.sprinkle) {
    // Sprinkles: small, bright, elongated along the surface.
    col = col.c;
    s *= 0.9;
    sc = [s * 2.2, s * 0.45, s * 0.35];
  } else {
    const flat = 0.22 + g.roughness * 0.35;
    sc = [s, s * (0.85 + rand() * 0.3), s * flat];
  }
  const q = discRotation(n, rand() * TAU);
  ctx.buf.push(p, sc, q, [col[0], col[1], col[2], 0.93 + rand() * 0.07]);
}

function emitCloud(ctx, rand) {
  const { shape, noise } = ctx;
  const s0 = shape.sample(rand);
  const lift = 0.06 + 0.02 * rand();
  const p = [s0.p[0] + s0.n[0] * lift, s0.p[1] + s0.n[1] * lift, s0.p[2] + s0.n[2] * lift];
  const density = noise.fbm(p[0] * 2.2 + 11, p[1] * 3.5, p[2] * 2.2 - 4, 3);
  const s = ctx.base * (1.6 + rand());
  const q = discRotation(s0.n, rand() * TAU);
  const a = density > 0.05 ? 0.55 : 0;
  ctx.buf.push(p, [s * 1.4, s, s * 0.3], q, [0.97, 0.98, 1, a]);
}

function emitInterior(ctx, rand) {
  const { shape, coloring } = ctx;
  const s0 = shape.sample(rand);
  const depth = 0.08 + 0.9 * Math.pow(rand(), 0.7);
  const d = depth * s0.thick;
  const p = [s0.p[0] - s0.n[0] * d, s0.p[1] - s0.n[1] * d, s0.p[2] - s0.n[2] * d];
  const col = coloring.core(p, depth, rand);
  const s = sizeFor(ctx, rand) * 1.7;
  ctx.buf.push(p, [s, s, s], [0, 0, 0, 1], [col[0], col[1], col[2], 0.9]);
}

// ---- Clay -----------------------------------------------------------------------
// op: ["a" | "e", x, y, z, radius] in the toy's own coordinates. Adds a lump
// of splats around the point, or erases every splat inside the sphere.

export function applyClay(ctx, op, index) {
  const [kind, x, y, z, r] = op;
  const buf = ctx.buf;
  if (kind === "e") {
    const r2 = r * r;
    let n = 0;
    for (let i = 0; i < buf.count; i++) {
      const dx = buf.pos[i * 3] - x;
      const dy = buf.pos[i * 3 + 1] - y;
      const dz = buf.pos[i * 3 + 2] - z;
      if (dx * dx + dy * dy + dz * dz < r2 && buf.color[i * 4 + 3] > 0) {
        buf.kill(i);
        n++;
      }
    }
    return { added: 0, erased: n, start: buf.count, end: buf.count };
  }
  const rand = mulberry32(mixSeed(ctx.g.seed, `clay-${index}`));
  const out = norm([x, y, z]);
  const c = [x + out[0] * r * 0.25, y + out[1] * r * 0.25, z + out[2] * r * 0.25];
  const s = Math.min(ctx.base * 1.1, r / 5);
  const area = 4 * Math.PI * r * r;
  const want = Math.round(Math.min(2500, Math.max(40, (area / (Math.PI * s * s)) * 0.9)));
  const start = buf.count;
  for (let k = 0; k < want; k++) {
    const d = randomDir(rand);
    const inside = k % 6 === 5;
    const depth = inside ? rand() * 0.8 : 0;
    const p = [
      c[0] + d[0] * r * (1 - depth),
      c[1] + d[1] * r * (1 - depth),
      c[2] + d[2] * r * (1 - depth),
    ];
    const col = ctx.coloring.surface(p, norm(p), rand);
    const rgb = col && col.sprinkle ? col.c : col;
    const q = discRotation(d, rand() * TAU);
    const sz = s * Math.exp((rand() - 0.5) * 1.2 * ctx.g.sizeJitter);
    if (buf.push(p, [sz, sz, inside ? sz : sz * 0.3], q, [rgb[0], rgb[1], rgb[2], 0.95]) < 0) break;
  }
  return { added: buf.count - start, erased: 0, start, end: buf.count };
}
