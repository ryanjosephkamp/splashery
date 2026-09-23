// Nature pack: trees, flowers, plants, fungi, coral and stones. Loaded on
// demand. Plants sway gently while the toy is alive; blossom and autumn
// leaves fall; the dandelion blows away and grows back.
//
// Trees grow from a small recursive branching helper (bounded depth, so a
// build stays quick) drawn with tubes; foliage is clouds of flat, leaf-like
// splats around clumps, shaded by a fake light from the upper left.

import {
  mix,
  shade,
  smoothstep,
  spline,
  clamp,
  ramp,
  quatFromTo,
  quatRotate,
  quatAxisAngle,
  quatMul,
  quatEuler,
  vec,
} from "../kit.js";

const TAU = Math.PI * 2;
const GOLDEN = Math.PI * (3 - Math.sqrt(5));
const { add, sub, mul, dot, cross, unit } = vec;
const lerp = (a, b, t) => a + (b - a) * t;
const lerp3 = (a, b, t) => [lerp(a[0], b[0], t), lerp(a[1], b[1], t), lerp(a[2], b[2], t)];

// ---- Light, directions ------------------------------------------------------

// A fake light from the upper left, in front; colour functions shade with it.
const LIGHT = unit([-0.35, 0.85, 0.45]);
const lit = (col, n, k = 0.3) => shade(col, 1 + k * (dot(n, LIGHT) - 0.25));

// Two unit vectors perpendicular to d (and to each other).
function perp(d) {
  const a = Math.abs(d[1]) < 0.9 ? [0, 1, 0] : [1, 0, 0];
  const e1 = unit(cross(d, a));
  return [e1, cross(d, e1)];
}
function randDir(rand) {
  const z = 2 * rand() - 1;
  const a = rand() * TAU;
  const r = Math.sqrt(Math.max(0, 1 - z * z));
  return [r * Math.cos(a), z, r * Math.sin(a)];
}
const sway = (a, base) => ({ kind: "sway", params: [a, base] });

// A point along a polyline at t (0..1).
function along(pts, t) {
  const f = clamp(t, 0, 1) * (pts.length - 1);
  const i = Math.min(pts.length - 2, Math.floor(f));
  return { p: lerp3(pts[i], pts[i + 1], f - i), d: unit(sub(pts[i + 1], pts[i])) };
}

// ---- Trees -----------------------------------------------------------------------

// Grows a branching skeleton. Each level has its own length, spread and
// number of children (per-level arrays, the last entry repeats). Children
// sprout along the upper part of their parent, turned by the golden angle;
// `up` bends growth towards the light (negative droops), `wobble` gnarls it.
function growTree(rand, o) {
  const at = (arr, i) => (Array.isArray(arr) ? arr[Math.min(arr.length - 1, i)] : arr);
  const branches = [];
  const tips = [];
  const grow = (p0, d0, L, r0, level) => {
    const n = 5;
    const pts = [p0];
    let d = d0;
    let p = p0;
    const wob = at(o.wobble, level);
    const up = at(o.up, level);
    for (let i = 1; i < n; i++) {
      d = unit(
        add(d, [(rand() - 0.5) * wob, (rand() - 0.5) * wob * 0.5 + up, (rand() - 0.5) * wob]),
      );
      p = add(p, mul(d, L / (n - 1)));
      pts.push(p);
    }
    const last = level >= o.depth;
    const r1 = r0 * (last ? (o.tipTaper ?? 0.35) : (o.taper ?? 0.7));
    branches.push({ pts, r0, r1, level, len: L });
    if (last) {
      tips.push({ p, d, level, len: L });
      return;
    }
    const [k0, k1] = at(o.kids, level);
    const kids = k0 + Math.floor(rand() * (k1 - k0 + 1));
    const from = at(o.from, level);
    const roll0 = rand() * TAU;
    for (let j = 0; j < kids; j++) {
      const lead = j === kids - 1;
      const t = lead ? 1 : from + (1 - from) * ((j + 0.3 + 0.4 * rand()) / kids);
      const a = along(pts, t);
      const [e1, e2] = perp(a.d);
      const roll = roll0 + j * GOLDEN * 1.7 + (rand() - 0.5) * 0.6;
      const side = add(mul(e1, Math.cos(roll)), mul(e2, Math.sin(roll)));
      const ang = at(o.spread, level) * (lead ? 0.45 : 0.75 + 0.5 * rand());
      const cd = unit(add(mul(a.d, Math.cos(ang)), mul(side, Math.sin(ang))));
      const cl = L * at(o.ratio, level) * (0.8 + 0.4 * rand()) * (lead ? 1 : 0.9);
      grow(a.p, cd, cl, lerp(r0, r1, t) * at(o.radRatio, level), level + 1);
    }
  };
  grow(o.base || [0, 0, 0], o.dir || [0, 1, 0], o.length, o.radius, 0);
  return { branches, tips };
}

// Bark: furrows along the tube (c.u runs around it), fake-lit.
function barkColor(base, dark, { furrows = 7, snow = 0 } = {}) {
  return (c) => {
    const g = c.fbm(c.p[0] * 14, c.p[1] * 5, c.p[2] * 14);
    const ridge = Math.abs(Math.sin((c.u ?? 0) * TAU * furrows + g * 4 + (c.t ?? 0) * 3));
    let col = mix(base, dark, 0.2 + 0.55 * smoothstep(0.55, 1, ridge) + 0.25 * g);
    col = lit(col, c.n, 0.4);
    if (snow && c.n[1] > 0.55 - 0.2 * g) col = mix(col, "#f4f7fb", snow);
    return col;
  };
}

// Draws a skeleton's branches as tubes (thin twigs get coarse grids).
function addBranches(k, branches, opts = {}) {
  const { color, flare = 0, gnarl = 0, extra = {}, minLevel = 0, clip = null } = opts;
  for (const b of branches) {
    if (b.level < minLevel || (clip && b.level >= 2 && !clip(b.pts[b.pts.length - 1]))) continue;
    const curve = spline(b.pts);
    const trunk = b.level === 0;
    const r = (t) => {
      let v = lerp(b.r0, b.r1, t);
      if (trunk && flare) v *= 1 + flare * Math.exp(-t * 10);
      if (trunk && gnarl) v *= 1 + gnarl * Math.sin(t * 17 + b.pts[1][0] * 9);
      return v;
    };
    const big = b.r0 > 0.05;
    k.add(k.tube(curve, r, { samples: big ? 64 : 20, grid: big ? 28 : b.r0 > 0.02 ? 12 : 7 }), {
      flat: 0.3,
      color,
      ...extra,
    });
  }
}

// True for points inside an ellipsoid (for clipping twigs to a canopy).
const within =
  (c, r, s = 1) =>
  (p) =>
    ((p[0] - c[0]) / r[0]) ** 2 + ((p[1] - c[1]) / r[1]) ** 2 + ((p[2] - c[2]) / r[2]) ** 2 < s * s;

// Roots flaring from the foot of a trunk into the ground.
function addRoots(k, count, r, y, color, extra = {}) {
  for (let i = 0; i < count; i++) {
    const a = (i / count) * TAU + k.rand() * 0.5;
    const d = [Math.sin(a), 0, Math.cos(a)];
    const L = r * (2.2 + k.rand() * 1.3);
    const pts = [
      [d[0] * r * 0.3, y + r * 1.4, d[2] * r * 0.3],
      [d[0] * r * 0.9, y + r * 0.5, d[2] * r * 0.9],
      [d[0] * L, y + r * 0.02, d[2] * L],
    ];
    k.add(
      k.tube(spline(pts), (t) => r * 0.55 * (1 - 0.8 * t), { samples: 24, grid: 14 }),
      {
        flat: 0.3,
        color,
        ...extra,
      },
    );
  }
}

// Foliage: flat leaf splats on the shells of clumps (ellipsoids), skipping
// leaves buried inside a neighbouring clump. `color(t, rand, info)` gets a
// light value t (0 dark underside .. 1 sunlit top).
function foliage(k, clumps, o) {
  const cum = [];
  let tot = 0;
  let ymin = Infinity;
  let ymax = -Infinity;
  for (const cl of clumps) {
    const [a, b, c] = cl.r;
    tot += (a * b + b * c + a * c) * (cl.w ?? 1);
    cum.push(tot);
    ymin = Math.min(ymin, cl.c[1] - cl.r[1]);
    ymax = Math.max(ymax, cl.c[1] + cl.r[1]);
  }
  const depthK = o.depth ?? 0.35;
  const nTilt = o.tilt ?? 1.1;
  return k.cloud(
    { share: o.share, size: o.size ?? 1, flat: o.flat ?? 0.2, pattern: o.pattern },
    (rand) => {
      for (let tries = 0; tries < 8; tries++) {
        const x = rand() * tot;
        let lo = 0;
        let hi = cum.length - 1;
        while (lo < hi) {
          const mid = (lo + hi) >> 1;
          if (cum[mid] < x) lo = mid + 1;
          else hi = mid;
        }
        const cl = clumps[lo];
        const d = randDir(rand);
        const depth = 1 - depthK * rand() * rand();
        const p = [
          cl.c[0] + d[0] * cl.r[0] * depth,
          cl.c[1] + d[1] * cl.r[1] * depth,
          cl.c[2] + d[2] * cl.r[2] * depth,
        ];
        if (tries < 7) {
          let buried = false;
          for (const q of clumps) {
            if (q === cl) continue;
            const dx = (p[0] - q.c[0]) / q.r[0];
            const dy = (p[1] - q.c[1]) / q.r[1];
            const dz = (p[2] - q.c[2]) / q.r[2];
            if (dx * dx + dy * dy + dz * dz < 0.8) {
              buried = true;
              break;
            }
          }
          if (buried) continue;
        }
        const h = (p[1] - ymin) / (ymax - ymin || 1);
        const t = clamp(
          0.5 +
            0.32 * dot(d, LIGHT) +
            0.3 * (h - 0.5) -
            (1.1 * (1 - depth)) / depthK +
            0.14 * (rand() - 0.5) +
            (cl.tint ?? 0),
          0,
          1,
        );
        const n = unit([
          d[0] + (rand() - 0.5) * nTilt,
          d[1] + (rand() - 0.5) * nTilt + 0.3,
          d[2] + (rand() - 0.5) * nTilt,
        ]);
        const s = o.color(t, rand, { p, d, cl, h, depth });
        if (s === null) continue;
        return {
          p,
          n,
          color: s,
          size: (o.leaf ?? 1) * (0.7 + 0.6 * rand()),
          kind: o.kind,
          params: o.params,
        };
      }
      return null;
    },
  );
}

// Clumps around the tips of a skeleton (and part way along the last levels).
function tipClumps(tree, rand, { r = 0.22, jitter = 0.3, minLevel = 0, squash = 0.8, extra = 0 }) {
  const out = [];
  for (const t of tree.tips) {
    const s = r * (0.8 + 0.4 * rand());
    out.push({
      c: add(t.p, [(rand() - 0.5) * jitter * s, s * 0.35, (rand() - 0.5) * jitter * s]),
      r: [s, s * squash, s],
      tint: (rand() - 0.5) * 0.12,
    });
  }
  if (extra) {
    for (const b of tree.branches) {
      if (b.level < minLevel) continue;
      for (let i = 0; i < extra; i++) {
        const a = along(b.pts, 0.35 + 0.5 * rand());
        const s = r * (0.6 + 0.3 * rand());
        out.push({ c: add(a.p, [0, s * 0.3, 0]), r: [s, s * squash, s], tint: -0.05 });
      }
    }
  }
  return out;
}

// A grassy turf plug for a plant to stand on: a low grass dome on a band of
// soil, with soil inside for Slice.
function grassMound(k, r, y, o = {}) {
  const h = o.h ?? r * 0.12;
  const d = o.depth ?? r * 0.16;
  const colors = o.colors || ["#3f6e24", "#5c8f33", "#86ad4a"];
  const soil = o.soil || "#5a3d24";
  const snow = o.snow ?? 0;
  k.add(
    k.lathe(
      [
        [0, y - d],
        [r * 0.93, y - d],
        [r, y - d * 0.75],
        [r, y - 0.01],
        [r * 0.88, y + h * 0.5],
        [r * 0.5, y + h * 0.9],
        [0, y + h],
      ],
      { thick: d },
    ),
    {
      flat: 0.3,
      color: (c) => {
        const g = c.fbm(c.p[0] * 9, c.p[1] * 9, c.p[2] * 9);
        if (c.p[1] < y - 0.012 + 0.02 * g) {
          // Soil with pebbles.
          const pb = c.noise(c.p[0] * 40, c.p[1] * 40, c.p[2] * 40);
          let col = mix(soil, shade(soil, 0.6), 0.5 + 0.5 * g);
          if (pb > 0.55) col = mix(col, "#9a8e80", 0.6);
          return lit(col, c.n, 0.35);
        }
        let col = ramp(colors, clamp(0.5 + 0.9 * g + 0.2 * (c.rand() - 0.5), 0, 1));
        if (o.tint) col = o.tint(c, col);
        if (snow) col = mix(col, "#eef3f8", snow * smoothstep(-0.2, 0.3, g + 0.35));
        return lit(col, c.n, 0.25);
      },
    },
  );
  if (o.blades) {
    k.cloud({ share: o.blades, size: 0.7, pattern: o.pattern }, (rand) => {
      const a = rand() * TAU;
      const rr = r * Math.sqrt(rand()) * 0.97;
      const top = y + h * (1 - (rr / r) ** 2) * 0.95;
      const len = (o.bladeLen ?? h) * (0.5 + rand());
      const lean = [(rand() - 0.5) * 0.6, 1, (rand() - 0.5) * 0.6];
      const f = rand();
      return {
        p: add([Math.sin(a) * rr, top, Math.cos(a) * rr], mul(unit(lean), len * f)),
        dir: lean,
        stretch: 2.4,
        color: shade(ramp(colors, 0.3 + 0.7 * f), 0.85 + 0.3 * rand()),
        ...(o.bladeKind || {}),
      };
    });
  }
}

// Clumps spread over a dome-shaped canopy envelope (centre c, radii r), with
// a noisy outline, plus clumps at the skeleton's tips pushed out to it.
function domeClumps(k, { c, r, n = 40, size = [0.2, 0.3], below = -0.4, tips = [] }) {
  const out = [];
  const env = (d) => {
    const w = 1 + 0.16 * k.noise(d[0] * 1.7 + 3, d[1] * 1.7, d[2] * 1.7);
    return [c[0] + d[0] * r[0] * w, c[1] + d[1] * r[1] * w, c[2] + d[2] * r[2] * w];
  };
  const g = Math.PI * (3 - Math.sqrt(5));
  for (let i = 0; i < n; i++) {
    const y = 1 - ((i + 0.5) / n) * 2;
    if (y < below) break;
    const rr = Math.sqrt(1 - y * y);
    const d = [Math.cos(g * i) * rr, y, Math.sin(g * i) * rr];
    const s = lerp(size[0], size[1], k.rand());
    const p = env(d);
    out.push({
      c: [p[0] + (k.rand() - 0.5) * s * 0.4, p[1] - s * 0.3, p[2] + (k.rand() - 0.5) * s * 0.4],
      r: [s, s * 0.85, s],
      tint: (k.rand() - 0.5) * 0.14,
    });
  }
  for (const t of tips) {
    const d = unit(sub(t.p, c));
    if (d[1] < below) continue;
    const s = lerp(size[0], size[1], k.rand()) * 0.8;
    const p = env(d);
    out.push({ c: lerp3(t.p, p, 0.7), r: [s, s * 0.85, s], tint: (k.rand() - 0.5) * 0.14 });
  }
  // A dark core so the canopy never shows daylight through its middle.
  out.push({ c: [c[0], c[1] - r[1] * 0.1, c[2]], r: mul(r, 0.72), tint: -0.3, w: 0.3 });
  return out;
}

// ---- Leaves and petals as small surfaces ---------------------------------------

// A flat-ish blade on a frame (origin, direction along it, direction across
// it): length L, width profile w(v), cupped across by `cup`, bent along by
// `bend(v)` (towards the normal). Returns a param shape.
function blade(k, { L, W, width, cup = 0, bend = null, grid = 16, twist = 0 }) {
  const wf = width || ((v) => Math.sin(Math.PI * Math.min(1, v)) ** 0.8);
  return k.param(
    (u, v) => {
      const x = (u - 0.5) * 2;
      const w = W * wf(v);
      const tw = twist * v;
      const bx = x * w * Math.cos(tw);
      const bz = x * w * Math.sin(tw) + cup * w * x * x + (bend ? bend(v) * L : 0);
      return [bx, v * L, bz];
    },
    { grid },
  );
}

// ---- Recipes ----------------------------------------------------------------------

// Dandelion seed groups: twelve directions over the head, and where each
// group flies when it is blown (outwards and downwind, to the right).
const SEED_GROUPS = [];
const BLOW = [];
for (let g = 0; g < 12; g++) {
  const y = 1 - ((g + 0.5) / 12) * 1.8;
  const r = Math.sqrt(1 - y * y);
  const c = [Math.cos(g * GOLDEN) * r, y, Math.sin(g * GOLDEN) * r];
  SEED_GROUPS.push(c);
  BLOW.push(unit(add(mul(c, 0.7), [1, 0.35, 0.25])));
}

// A "Seed" option: each choice grows a different specimen from the same
// recipe (it moves the recipe's random numbers along).
const SEED = {
  key: "seed",
  label: "Seed",
  type: "select",
  default: "1",
  choices: [
    { id: "1", label: "1" },
    { id: "2", label: "2" },
    { id: "3", label: "3" },
    { id: "4", label: "4" },
  ],
};
function reseed(k, o) {
  const n = (parseInt(o.seed, 10) || 1) - 1;
  for (let i = 0; i < n * 97; i++) k.rand();
}

const SEASON = {
  key: "season",
  label: "Season",
  type: "select",
  default: "summer",
  choices: [
    { id: "spring", label: "Spring" },
    { id: "summer", label: "Summer" },
    { id: "autumn", label: "Autumn" },
    { id: "winter", label: "Winter" },
  ],
};

const LEAF_PALETTES = {
  spring: ["#2e5a1c", "#4f8a2a", "#79b23c", "#a9d45a", "#d6ec8a"],
  summer: ["#1c3a14", "#2d5a1e", "#467f2b", "#6fa53b", "#a4c95a"],
  autumn: ["#5a2410", "#9a3a12", "#d0661c", "#e99a2a", "#f5cf5a"],
};

// A palm frond: a rachis arching out and down.
function frond(top, az, { L = 0.95, rise = 0.55, droop = 1.0 }) {
  const h = [Math.sin(az), 0, Math.cos(az)];
  const at = (s) => [
    top[0] + h[0] * L * s,
    top[1] + L * (rise * s - droop * s * s),
    top[2] + h[2] * L * s,
  ];
  return { at, h };
}

export const RECIPES = {
  oak: {
    alive: true,
    options: [SEASON, SEED],
    build(k, o) {
      reseed(k, o);
      const rand = k.rand;
      const winter = o.season === "winter";
      const tree = growTree(rand, {
        length: 0.62,
        radius: 0.16,
        depth: 4,
        kids: [
          [4, 5],
          [2, 3],
          [2, 3],
          [2, 2],
        ],
        spread: [1.05, 0.7, 0.65, 0.7],
        ratio: [0.95, 0.66, 0.66, 0.6],
        radRatio: [0.66, 0.66, 0.65, 0.6],
        from: [0.72, 0.4, 0.35, 0.3],
        wobble: [0.12, 0.45, 0.65, 0.8],
        up: [0, 0.06, 0.06, 0.08],
        taper: 0.62,
        tipTaper: 0.4,
      });
      const SW = sway(0.008, 0);
      const bark = barkColor("#5d4632", "#2b1f16", { snow: winter ? 0.9 : 0 });
      addBranches(k, tree.branches, {
        color: bark,
        flare: 0.6,
        gnarl: 0.07,
        extra: SW,
        clip: winter ? null : within([0, 1.28, 0], [1.02, 0.62, 1.02]),
      });
      addRoots(k, 6, 0.1, 0, bark);
      grassMound(k, 1.0, 0, {
        h: 0.1,
        snow: winter ? 0.95 : 0,
        colors: o.season === "autumn" ? ["#5b5a22", "#7a7630", "#9a8a3a"] : undefined,
      });
      if (winter) {
        // Snow resting on the bare crown.
        const clumps = tipClumps(tree, rand, { r: 0.07, squash: 0.45 });
        foliage(k, clumps, {
          share: 0.05,
          size: 1.1,
          depth: 0.2,
          pattern: false,
          ...SW,
          color: (t, r, info) =>
            info.d[1] < 0 ? null : mix("#c9d6e6", "#ffffff", clamp(t + 0.2, 0, 1)),
        });
        return;
      }
      const pal = LEAF_PALETTES[o.season] || LEAF_PALETTES.summer;
      const clumps = domeClumps(k, {
        c: [0, 1.28, 0],
        r: [1.02, 0.62, 1.02],
        n: 46,
        size: [0.24, 0.32],
        below: -0.5,
        tips: tree.tips,
      });
      foliage(k, clumps, {
        share: 0.64,
        size: 1.3,
        tilt: 1.4,
        ...SW,
        color: (t, r) => {
          const col = ramp(pal, t);
          return o.season === "autumn" && r() < 0.15 ? mix(col, "#b8331a", 0.5) : col;
        },
      });
      if (o.season === "autumn") {
        // Leaves that drift down, and a few on the grass.
        k.cloud({ share: 0.012, size: 1.3, pattern: false }, (r) => {
          const a = r() * TAU;
          const rr = 0.95 * Math.sqrt(r());
          return {
            p: [Math.sin(a) * rr, 0.75 + r() * 0.4, Math.cos(a) * rr],
            n: randDir(r),
            color: ramp(pal, 0.3 + 0.7 * r()),
            kind: "fall",
            params: [0.7 + 0.2 * r(), r()],
          };
        });
        k.cloud({ share: 0.02, size: 1.2, flat: 0.15 }, (r) => {
          const a = r() * TAU;
          const rr = 0.25 + 0.72 * Math.sqrt(r());
          return {
            p: [Math.sin(a) * rr, 0.1 * (1 - (rr / 1.0) ** 2) + 0.012, Math.cos(a) * rr],
            n: [(r() - 0.5) * 0.4, 1, (r() - 0.5) * 0.4],
            color: ramp(pal, 0.2 + 0.8 * r()),
          };
        });
      }
    },
  },

  palm: {
    alive: true,
    build(k) {
      const rand = k.rand;
      const SW = sway(0.009, 0);
      const trunkPts = [
        [0, 0, 0],
        [-0.04, 0.45, 0.02],
        [-0.16, 0.95, 0.04],
        [-0.36, 1.4, 0.06],
        [-0.6, 1.78, 0.08],
      ];
      const trunk = spline(trunkPts);
      const trunkR = (t) =>
        0.1 *
        (1 - 0.35 * t) *
        (1 + 0.5 * Math.exp(-t * 14)) *
        (1 + 0.05 * Math.abs(Math.sin(t * Math.PI * 26)));
      k.add(k.tube(trunk, trunkR, { samples: 128, grid: 40 }), {
        flat: 0.3,
        ...SW,
        color: (c) => {
          const ring = Math.abs(((c.t * 26) % 1) - 0.5) * 2;
          const g = c.fbm(c.p[0] * 12, c.p[1] * 12, c.p[2] * 12);
          let col = mix("#a08a68", "#6e5a42", 0.35 + 0.35 * g);
          col = mix(col, "#4a3a2a", smoothstep(0.75, 0.98, ring));
          col = mix(col, "#c3ab85", 0.4 * smoothstep(0.3, 0.05, ring));
          return lit(col, c.n, 0.45);
        },
      });
      const top = trunk(1);
      // The crown: a knob where the fronds spring from.
      k.add(k.ellipsoid(0.11, 0.12, 0.11), {
        pos: [top[0], top[1] + 0.03, top[2]],
        ...SW,
        color: (c) => lit(mix("#6f6a36", "#8a7a44", c.rand()), c.n, 0.4),
      });
      // Coconuts.
      for (let i = 0; i < 5; i++) {
        const a = (i / 5) * TAU + 0.4;
        const nut = i % 2 ? "#5a6b2a" : "#6e5530";
        k.add(k.ellipsoid(0.07, 0.078, 0.07), {
          pos: [
            top[0] + Math.sin(a) * 0.1,
            top[1] - 0.08 - (i % 2) * 0.05,
            top[2] + Math.cos(a) * 0.1,
          ],
          weight: 2,
          interior: 0.1,
          core: "#f4f1e6",
          ...SW,
          color: (c) =>
            lit(
              mix(nut, "#3a2e18", 0.2 + 0.3 * c.fbm(c.p[0] * 30, c.p[1] * 30, c.p[2] * 30)),
              c.n,
              0.5,
            ),
        });
      }
      // Fronds.
      const fronds = [];
      const F = 13;
      for (let i = 0; i < F; i++) {
        const az = (i / F) * TAU + (rand() - 0.5) * 0.3;
        const old = i % 4 === 3;
        const up = i % 3 === 0;
        fronds.push({
          ...frond([top[0], top[1] + 0.06, top[2]], az, {
            L: 0.8 + rand() * 0.25,
            rise: up ? 0.9 : old ? 0.05 : 0.45,
            droop: up ? 0.95 : old ? 1.1 : 0.95,
          }),
          old,
        });
      }
      for (const f of fronds) {
        k.add(
          k.tube(f.at, (t) => 0.018 * (1 - 0.8 * t), { samples: 24, grid: 8 }),
          {
            ...SW,
            color: f.old ? "#8a7a44" : "#7c8a38",
          },
        );
      }
      const greens = ["#2e5a1a", "#3f7a24", "#5d9a30", "#9cc048", "#d4d67a"];
      // Leaflets: separate narrow blades along each side of the rachis,
      // hanging in a V, so the frond looks feathery.
      const PER = 34;
      k.cloud({ share: 0.5, size: 0.9 }, (r) => {
        const f = fronds[Math.floor(r() * F)];
        const j = Math.floor(r() * PER);
        const s = 0.08 + (0.9 * (j + 0.5)) / PER;
        const side = r() < 0.5 ? -1 : 1;
        const p0 = f.at(s);
        const tng = unit(sub(f.at(Math.min(1, s + 0.01)), f.at(Math.max(0, s - 0.01))));
        const across = unit(cross(tng, [0, 1, 0]));
        const len = 0.34 * Math.sin(Math.PI * (0.1 + 0.85 * s)) ** 0.6;
        const u = r();
        const hang = 0.55 + 0.5 * u + 0.25 * Math.sin(j * 2.3);
        const dir = unit(add(add(mul(across, side), mul(tng, 0.6)), [0, -hang, 0]));
        const w = 0.012 * Math.sin(Math.PI * u) * (r() - 0.5);
        const p = add(add(p0, mul(dir, len * u)), mul(tng, w));
        const tone = clamp(
          0.25 + 0.3 * u + 0.3 * dot(dir, LIGHT) + 0.15 * Math.sin(j * 1.7) + 0.1 * (r() - 0.5),
          0,
          1,
        );
        let col = ramp(greens, tone);
        if (f.old) col = mix(col, "#a08040", 0.55);
        return { p, dir, stretch: 2.6, color: col, ...SW };
      });
      grassMound(k, 0.72, 0, {
        h: 0.08,
        colors: ["#d9c089", "#e8d4a2", "#f3e6c2"],
        soil: "#8a6a44",
      });
    },
  },

  "cherry-blossom": {
    alive: true,
    options: [SEED],
    build(k, o) {
      reseed(k, o);
      const rand = k.rand;
      const SW = sway(0.008, 0);
      const tree = growTree(rand, {
        length: 0.55,
        radius: 0.14,
        depth: 4,
        kids: [
          [3, 4],
          [2, 3],
          [2, 3],
          [2, 2],
        ],
        spread: [1.2, 0.75, 0.7, 0.7],
        ratio: [1.1, 0.7, 0.66, 0.6],
        radRatio: [0.64, 0.64, 0.62, 0.6],
        from: [0.75, 0.4, 0.35, 0.3],
        wobble: [0.2, 0.6, 0.8, 0.9],
        up: [0, 0.0, 0.03, 0.05],
        taper: 0.6,
        tipTaper: 0.4,
      });
      const bark = barkColor("#4a3530", "#1f1512", { furrows: 4 });
      addBranches(k, tree.branches, {
        color: bark,
        flare: 0.5,
        gnarl: 0.1,
        extra: SW,
        clip: within([0, 1.12, 0], [1.2, 0.48, 1.2]),
      });
      addRoots(k, 5, 0.09, 0, bark);
      const pinks = ["#a8466c", "#d9789c", "#f0a3bf", "#f9cadb", "#fff0f5"];
      const clumps = domeClumps(k, {
        c: [0, 1.12, 0],
        r: [1.2, 0.48, 1.2],
        n: 50,
        size: [0.2, 0.28],
        below: -0.45,
        tips: tree.tips,
      });
      foliage(k, clumps, {
        share: 0.58,
        size: 1.15,
        tilt: 1.6,
        ...SW,
        color: (t, r) => {
          const col = ramp(pinks, t);
          const u = r();
          if (u < 0.05) return mix(col, "#c2185b", 0.45);
          if (u < 0.1) return mix(col, "#7fae4a", 0.35);
          return col;
        },
      });
      // Petals drifting down all around, and a carpet of them on the grass.
      k.cloud({ share: 0.02, size: 0.9, flat: 0.15, pattern: false }, (r) => {
        const a = r() * TAU;
        const rr = 1.15 * Math.sqrt(r());
        const y = 0.15 + r() * 0.8;
        return {
          p: [Math.sin(a) * rr, y, Math.cos(a) * rr],
          n: randDir(r),
          color: ramp(pinks, 0.5 + 0.5 * r()),
          kind: "fall",
          params: [0.22 + 0.12 * r(), r()],
        };
      });
      grassMound(k, 1.05, 0, {
        h: 0.08,
        tint: (c, col) =>
          c.noise(c.p[0] * 20, 0, c.p[2] * 20) > 0.2 || c.rand() < 0.12
            ? mix(pinks[3], pinks[4], c.rand())
            : col,
      });
    },
  },

  maple: {
    alive: true,
    options: [
      {
        key: "color",
        label: "Leaves",
        type: "select",
        default: "fire",
        choices: [
          { id: "fire", label: "Fiery red" },
          { id: "orange", label: "Orange" },
          { id: "gold", label: "Gold" },
          { id: "green", label: "Summer green" },
        ],
      },
      SEED,
    ],
    build(k, o) {
      reseed(k, o);
      const rand = k.rand;
      const SW = sway(0.008, 0);
      const tree = growTree(rand, {
        length: 0.7,
        radius: 0.12,
        depth: 4,
        kids: [
          [3, 4],
          [2, 3],
          [2, 3],
          [2, 2],
        ],
        spread: [0.8, 0.65, 0.65, 0.7],
        ratio: [0.85, 0.68, 0.66, 0.6],
        radRatio: [0.66, 0.65, 0.62, 0.6],
        from: [0.65, 0.4, 0.35, 0.3],
        wobble: [0.1, 0.35, 0.5, 0.7],
        up: [0, 0.1, 0.1, 0.1],
        taper: 0.62,
        tipTaper: 0.4,
      });
      const bark = barkColor("#6b5a4c", "#3a2e26", { furrows: 5 });
      addBranches(k, tree.branches, {
        color: bark,
        flare: 0.5,
        extra: SW,
        clip: within([0, 1.42, 0], [0.92, 0.78, 0.92]),
      });
      addRoots(k, 5, 0.08, 0, bark);
      const PAL = {
        fire: ["#4a0c0a", "#8e1512", "#c62a18", "#e8561f", "#f7a23a"],
        orange: ["#5a220a", "#a4400f", "#dd6a17", "#f29a2e", "#fbd35a"],
        gold: ["#6a4a0c", "#a87812", "#dca51c", "#f2cb3a", "#fbe98a"],
        green: LEAF_PALETTES.summer,
      };
      const pal = PAL[o.color] || PAL.fire;
      const clumps = domeClumps(k, {
        c: [0, 1.42, 0],
        r: [0.92, 0.78, 0.92],
        n: 48,
        size: [0.22, 0.3],
        below: -0.55,
        tips: tree.tips,
      });
      const autumn = o.color !== "green";
      foliage(k, clumps, {
        share: 0.62,
        size: 1.25,
        tilt: 1.5,
        ...SW,
        color: (t, r, info) => {
          let col = ramp(pal, t);
          // Autumn trees are a mix: the odd clump turns early or late.
          if (autumn && info.cl.tint > 0.05) col = mix(col, ramp(PAL.orange, t), 0.5);
          if (autumn && r() < 0.06) col = mix(col, "#f7d04a", 0.6);
          return col;
        },
      });
      if (autumn) {
        k.cloud({ share: 0.015, size: 1.4, flat: 0.15, pattern: false }, (r) => {
          const a = r() * TAU;
          const rr = 1.0 * Math.sqrt(r());
          return {
            p: [Math.sin(a) * rr, 0.2 + r() * 0.8, Math.cos(a) * rr],
            n: randDir(r),
            color: ramp(pal, 0.3 + 0.7 * r()),
            kind: "fall",
            params: [0.25 + 0.15 * r(), r()],
          };
        });
      }
      grassMound(k, 1.0, 0, {
        h: 0.08,
        tint: autumn
          ? (c, col) =>
              c.noise(c.p[0] * 14, 1, c.p[2] * 14) + 0.4 * (c.rand() - 0.5) > 0
                ? ramp(pal, 0.2 + 0.8 * c.rand())
                : col
          : null,
      });
    },
  },

  bonsai: {
    alive: true,
    options: [{ key: "pot", label: "Pot", type: "color", default: "#2e5f80" }],
    build(k, o) {
      const rand = k.rand;
      const SW = sway(0.004, 0);
      // A shallow glazed pot on little feet.
      const potCol = o.pot;
      const glaze = (c, f = 1) => {
        const g = c.fbm(c.p[0] * 5, c.p[1] * 5, c.p[2] * 5);
        let col = mix(
          shade(potCol, 0.8),
          mix(potCol, "#ffffff", 0.15),
          smoothstep(-0.3, 0, c.p[1]),
        );
        col = shade(col, f * (0.95 + 0.1 * g));
        const hi = Math.pow(Math.max(0, dot(c.n, unit([-0.3, 0.45, 0.85]))), 10);
        return mix(lit(col, c.n, 0.4), "#ffffff", 0.25 * hi);
      };
      k.add(k.box(1.6, 0.28, 1.0), {
        pos: [0, -0.16, 0],
        color: (c) => (c.s.face === 2 ? null : glaze(c)),
      });
      for (const [sx, sz, x, z] of [
        [1.68, 0.06, 0, 0.5],
        [1.68, 0.06, 0, -0.5],
        [0.06, 1.0, 0.81, 0],
        [0.06, 1.0, -0.81, 0],
      ]) {
        k.add(k.box(sx, 0.05, sz), {
          pos: [x, -0.02, z],
          weight: 1.5,
          color: (c) => glaze(c, c.s.face === 3 ? 0.6 : 1.05),
        });
      }
      for (const [x, z] of [
        [-0.62, -0.36],
        [0.62, -0.36],
        [-0.62, 0.36],
        [0.62, 0.36],
      ]) {
        k.add(k.box(0.16, 0.08, 0.12), {
          pos: [x, -0.32, z],
          weight: 2,
          color: (c) => lit(shade(potCol, 0.7), c.n, 0.4),
        });
      }
      // Soil with moss, and a few pebbles.
      k.add(
        k.param((u, v) => [(u - 0.5) * 1.52, -0.015, (v - 0.5) * 0.92], { grid: 8, flip: true }),
        {
          color: (c) => {
            const m = c.fbm(c.p[0] * 6, 0, c.p[2] * 6);
            return m > -0.3
              ? mix("#4c7a2c", "#77a342", 0.5 + 0.5 * c.noise(c.p[0] * 40, 0, c.p[2] * 40))
              : mix("#4a3322", "#2e2016", c.rand());
          },
        },
      );
      for (let i = 0; i < 7; i++) {
        const s = 0.022 + rand() * 0.018;
        k.add(k.ellipsoid(s * 1.3, s * 0.6, s), {
          pos: [0.3 + rand() * 0.4, -0.012, (rand() - 0.5) * 0.7],
          rot: [0, rand() * 180, 0],
          weight: 2,
          color: (c) => lit(mix("#6f6a62", "#a8a296", c.rand() * 0.5 + 0.2), c.n, 0.4),
        });
      }
      // The trunk: a twisting S with a fat foot and surface roots.
      const trunkPts = [
        [-0.1, -0.02, 0],
        [0.1, 0.22, 0.04],
        [-0.12, 0.48, -0.02],
        [-0.02, 0.72, 0.02],
        [0.18, 0.9, -0.02],
        [0.22, 1.02, 0],
      ];
      const bark = barkColor("#6a5444", "#3a2a20", { furrows: 5 });
      const trunk = spline(trunkPts);
      k.add(
        k.tube(trunk, (t) => 0.13 * (1 - 0.72 * t) * (1 + 0.6 * Math.exp(-t * 12)), {
          samples: 96,
          grid: 36,
        }),
        { flat: 0.3, color: bark, ...SW },
      );
      addRoots(k, 6, 0.1, -0.02, bark);
      // Branches reach out sideways to cloud-like foliage pads.
      const limbs = [
        { t: 0.3, dir: [-1, 0.12, 0.25], L: 0.55 },
        { t: 0.45, dir: [0.9, 0.18, 0.3], L: 0.5 },
        { t: 0.6, dir: [-0.5, 0.25, -0.8], L: 0.42 },
        { t: 0.72, dir: [-0.8, 0.35, 0.3], L: 0.38 },
        { t: 0.82, dir: [0.8, 0.3, -0.3], L: 0.36 },
      ];
      const pads = [];
      limbs.forEach((l, i) => {
        const tree = growTree(rand, {
          base: trunk(l.t),
          dir: unit(l.dir),
          length: l.L,
          radius: 0.05 * (1 - 0.35 * l.t),
          depth: 2,
          kids: [
            [2, 2],
            [2, 3],
          ],
          spread: [0.8, 0.8],
          ratio: [0.6, 0.6],
          radRatio: [0.7, 0.7],
          from: [0.4, 0.4],
          wobble: [0.4, 0.5],
          up: [-0.02, 0.02],
          taper: 0.6,
        });
        addBranches(k, tree.branches, { color: bark, extra: SW });
        const end = tree.branches[0].pts[4];
        const rr = 0.24 + 0.05 * (i === 0);
        pads.push({ c: add(end, [0, 0.06, 0]), r: [rr, 0.1, rr * 0.8], tint: 0.05 });
        for (const tp of tree.tips)
          pads.push({
            c: add(tp.p, [0, 0.05, 0]),
            r: [0.16, 0.08, 0.14],
            tint: (rand() - 0.5) * 0.1,
          });
      });
      const top = trunk(1);
      pads.push({ c: add(top, [0, 0.08, 0]), r: [0.26, 0.14, 0.22], tint: 0.1 });
      pads.push({ c: add(top, [-0.18, 0.02, 0.05]), r: [0.2, 0.1, 0.18], tint: 0.05 });
      foliage(k, pads, {
        share: 0.42,
        size: 0.95,
        tilt: 1.2,
        depth: 0.4,
        ...SW,
        color: (t) => ramp(["#10301a", "#1d4a24", "#2f6a2e", "#4f8f3a", "#8cbf5a"], t),
      });
    },
  },

  willow: {
    alive: true,
    options: [SEED],
    build(k, o) {
      reseed(k, o);
      const rand = k.rand;
      const SW = sway(0.014, 0);
      const tree = growTree(rand, {
        length: 0.5,
        radius: 0.15,
        depth: 3,
        kids: [
          [3, 4],
          [2, 3],
          [2, 2],
        ],
        spread: [0.9, 0.7, 0.7],
        ratio: [1.2, 0.7, 0.6],
        radRatio: [0.62, 0.62, 0.6],
        from: [0.8, 0.45, 0.4],
        wobble: [0.15, 0.4, 0.5],
        up: [0, 0.08, 0.02],
        taper: 0.6,
      });
      const bark = barkColor("#5a4a3a", "#2a2018", { furrows: 8 });
      addBranches(k, tree.branches, { color: bark, flare: 0.6, gnarl: 0.08, extra: SW });
      addRoots(k, 6, 0.1, 0, bark);
      const C = [0, 1.18, 0];
      const RX = 1.0;
      const RY = 0.5;
      // A crown of leaves over the top.
      const clumps = domeClumps(k, {
        c: C,
        r: [RX * 0.9, RY, RX * 0.9],
        n: 30,
        size: [0.2, 0.26],
        below: 0.05,
        tips: [],
      });
      const greens = ["#3a5a1c", "#5a7f26", "#86a83a", "#b4cc5c", "#dfe89a"];
      foliage(k, clumps, {
        share: 0.2,
        size: 1.0,
        tilt: 1.4,
        ...SW,
        color: (t) => ramp(greens, t),
      });
      // Strands hang in curtains from the crown, with gaps between them where
      // the trunk shows through; the curtains facing the viewer are shorter.
      const strands = [];
      let tot = 0;
      const CURTAINS = 15;
      for (let ci = 0; ci < CURTAINS; ci++) {
        const ac = (ci / CURTAINS) * TAU + (rand() - 0.5) * 0.2;
        const front = Math.max(0, Math.cos(ac - 0.5));
        const lo = 0.2 + rand() * 0.25 + front * front * 0.35;
        const tone = rand();
        for (let i = 0; i < 30; i++) {
          const y = 0.05 + 0.85 * Math.pow(rand(), 1.3);
          const a = ac + (rand() - 0.5) * 0.3;
          const rr = Math.sqrt(1 - y * y);
          const start = [C[0] + Math.sin(a) * rr * RX, C[1] + y * RY, C[2] + Math.cos(a) * rr * RX];
          const end = lo + rand() * 0.15 + (1 - rr) * 0.3;
          const len = start[1] - end;
          strands.push({ start, a, len, out: 0.08 + 0.12 * rr, tone: tone + 0.3 * (rand() - 0.5) });
          tot += len;
        }
      }
      const cum = [];
      let acc = 0;
      for (const s of strands) cum.push((acc += s.len));
      k.cloud({ share: 0.5, size: 0.85 }, (r) => {
        const x = r() * tot;
        let lo = 0;
        let hi = cum.length - 1;
        while (lo < hi) {
          const mid = (lo + hi) >> 1;
          if (cum[mid] < x) lo = mid + 1;
          else hi = mid;
        }
        const s = strands[lo];
        const u = r();
        const bow = Math.sin(Math.min(1, u * 3) * Math.PI * 0.5);
        const p = [
          s.start[0] + Math.sin(s.a) * s.out * bow + (r() - 0.5) * 0.018,
          s.start[1] - s.len * u,
          s.start[2] + Math.cos(s.a) * s.out * bow + (r() - 0.5) * 0.018,
        ];
        const facing = dot(unit([Math.sin(s.a), 0.2, Math.cos(s.a)]), LIGHT);
        const tone = clamp(0.2 + 0.3 * facing + 0.3 * u + 0.35 * (s.tone - 0.5) + 0.1 * r(), 0, 1);
        return {
          p,
          dir: [
            Math.sin(s.a) * 0.3 + (r() - 0.5) * 0.4,
            -1,
            Math.cos(s.a) * 0.3 + (r() - 0.5) * 0.4,
          ],
          stretch: 2.6,
          color: ramp(greens, tone),
          ...SW,
        };
      });
      grassMound(k, 1.05, 0, { h: 0.07 });
    },
  },

  sunflower: {
    alive: true,
    build(k) {
      const rand = k.rand;
      const SW = sway(0.01, 0);
      const H = [0, 1.28, 0];
      const F = unit([0.28, 0.42, 1]);
      const Q = quatFromTo([0, 1, 0], F);
      const toW = (p) => add(H, quatRotate(Q, p));
      const Rd = 0.34;
      // The seed head: seeds on a golden-angle spiral, florets in the middle.
      const N = 1150;
      const spacing = Rd * Math.sqrt(Math.PI / N);
      k.cloud({ share: 0.2, size: 0.8, flat: 0.3 }, (r) => {
        const j = Math.floor(r() * N);
        const rr0 = Rd * Math.sqrt((j + 0.5) / N);
        const a0 = j * GOLDEN;
        const jr = spacing * 0.42 * Math.sqrt(r());
        const ja = r() * TAU;
        const x = Math.cos(a0) * rr0 + Math.cos(ja) * jr;
        const z = Math.sin(a0) * rr0 + Math.sin(ja) * jr;
        const f = rr0 / Rd;
        const y = 0.05 * (1 - f * f) + 0.006 * (1 - jr / spacing);
        const edge = jr / (spacing * 0.42);
        const seed = ((j * 7919) % 97) / 97;
        let col;
        if (f < 0.26) col = mix("#6f7a22", "#a8a032", seed * 0.6 + 0.4 * (1 - edge));
        else if (f < 0.42)
          col = seed > 0.55 ? mix("#e8a817", "#f6cf3a", r()) : mix("#6a3a12", "#8a5018", seed);
        else if (f > 0.93) col = mix("#b8620e", "#e39a1c", seed);
        else col = mix(mix("#2c1a0c", "#4a2c12", seed), "#140c06", 0.6 * edge);
        const nrm = quatRotate(Q, unit([x * 0.25, 1, z * 0.25]));
        return { p: toW([x, y, z]), n: nrm, color: lit(col, nrm, 0.35), ...SW };
      });
      k.add(k.disc(Rd * 1.02), {
        pos: H,
        quat: Q,
        ...SW,
        color: (c) => (c.n[1] > 0 && dot(c.n, F) > 0 ? "#24160a" : "#4f7a2a"),
      });
      // The back of the head, and green bracts around it.
      k.add(k.ellipsoid(Rd * 1.05, 0.1, Rd * 1.05), {
        pos: toW([0, -0.07, 0]),
        quat: Q,
        ...SW,
        color: (c) =>
          dot(c.n, F) > 0.3 ? null : lit(mix("#3f6a22", "#5f8a30", c.rand()), c.n, 0.4),
      });
      // Two rings of golden ray petals.
      const petal = (L, W) =>
        blade(k, {
          L,
          W,
          cup: -0.35,
          grid: 12,
          width: (v) => Math.sin(Math.PI * Math.pow(Math.min(v, 1), 0.7)) ** 0.8,
          bend: (v) => 0.05 * v * v,
        });
      const rings = [
        { n: 27, L: 0.34, W: 0.07, lift: 12, off: 0, rr: Rd * 0.94, tone: 0.9 },
        { n: 27, L: 0.3, W: 0.068, lift: 24, off: 0.5, rr: Rd * 0.9, tone: 1 },
      ];
      const bracts = blade(k, { L: 0.12, W: 0.04, grid: 6 });
      for (const ring of rings) {
        for (let i = 0; i < ring.n; i++) {
          const th = ((i + ring.off) / ring.n) * TAU + (rand() - 0.5) * 0.08;
          const q = quatMul(
            Q,
            quatEuler(-90 + ring.lift + (rand() - 0.5) * 10, (th * 180) / Math.PI + 180, 0),
          );
          const base = toW([Math.sin(th) * ring.rr, 0.01, Math.cos(th) * ring.rr]);
          const L = ring.L * (0.9 + 0.2 * rand());
          const warm = rand();
          k.add(ring === rings[0] ? petal(L, ring.W) : petal(L * 0.95, ring.W), {
            pos: base,
            quat: q,
            flat: 0.25,
            ...SW,
            color: (c) => {
              const vein = Math.abs(Math.sin(c.u * Math.PI * 9)) < 0.18 ? 0.88 : 1;
              let col = mix("#d9820a", "#f7b818", smoothstep(0, 0.35, c.v));
              col = mix(col, "#ffd84a", 0.5 * smoothstep(0.5, 1, c.v) + 0.15 * warm);
              return lit(shade(col, vein * ring.tone), c.n, 0.3);
            },
          });
        }
      }
      for (let i = 0; i < 22; i++) {
        const th = (i / 22) * TAU;
        k.add(bracts, {
          pos: toW([Math.sin(th) * Rd, -0.05, Math.cos(th) * Rd]),
          quat: quatMul(Q, quatEuler(-120, (th * 180) / Math.PI + 180, 0)),
          weight: 1.5,
          ...SW,
          color: (c) => lit(mix("#3a6a20", "#6a9a38", c.v), c.n, 0.3),
        });
      }
      // The stem, and big heart-shaped leaves.
      const back = toW([0, -0.12, 0]);
      const stemPts = [
        [0.02, 0, 0.02],
        [0.04, 0.35, 0],
        [0.01, 0.75, -0.04],
        [back[0] * 0.5, back[1] - 0.25, back[2] - 0.12],
        back,
      ];
      const stem = spline(stemPts);
      k.add(
        k.tube(stem, (t) => 0.04 * (1 - 0.3 * t), { samples: 64, grid: 20 }),
        {
          flat: 0.3,
          jitter: 0.1,
          ...SW,
          color: (c) => lit(mix("#4a7a26", "#6a9a36", c.fbm(c.p[0] * 30, c.p[1] * 8, 0)), c.n, 0.4),
        },
      );
      const leaf = (L) =>
        blade(k, {
          L,
          W: L * 0.42,
          cup: 0.25,
          grid: 16,
          width: (v) => Math.sin(Math.PI * Math.pow(Math.min(v, 1), 0.6)) ** 0.9 * (1.1 - 0.3 * v),
          bend: (v) => 0.25 * v * v,
        });
      for (const [t, az, L] of [
        [0.28, 1.9, 0.42],
        [0.46, -1.2, 0.46],
        [0.62, 0.9, 0.36],
      ]) {
        const at = stem(t);
        const d = [Math.sin(az), 0, Math.cos(az)];
        const tip = add(at, [d[0] * 0.08, 0.02, d[2] * 0.08]);
        k.add(k.tube(spline([at, tip]), 0.012, { samples: 8, grid: 6 }), {
          ...SW,
          color: "#5a8a30",
        });
        k.add(leaf(L), {
          pos: tip,
          rot: [-62, (az * 180) / Math.PI, 0],
          flat: 0.25,
          ...SW,
          color: (c) => {
            const mid = Math.abs(c.u - 0.5) < 0.025;
            const vein = Math.abs(Math.sin((c.v * 7 + Math.abs(c.u - 0.5) * 5) * Math.PI)) < 0.12;
            const col = mix(
              "#2e5a1c",
              "#4f7f2a",
              0.5 + 0.5 * c.fbm(c.p[0] * 8, c.p[1] * 8, c.p[2] * 8),
            );
            return lit(mid || vein ? mix(col, "#8ab050", 0.5) : col, c.n, 0.35);
          },
        });
      }
      grassMound(k, 0.42, 0, { h: 0.05, blades: 0.02, bladeLen: 0.12 });
    },
  },

  rose: {
    alive: true,
    options: [{ key: "color", label: "Colour", type: "color", default: "#c8102e" }],
    build(k, o) {
      const rand = k.rand;
      const SW = sway(0.008, 0);
      const base = o.color;
      const C = [0, 1.02, 0];
      const A = unit([0.15, 1, 0.62]);
      const Q = quatFromTo([0, 1, 0], A);
      // Petals on a spiral: a tight bud in the middle, cupped petals around
      // it, and outer petals whose rims roll back.
      const N = 30;
      for (let i = 0; i < N; i++) {
        const f = i / (N - 1);
        const th = i * GOLDEN;
        const L = 0.13 + 0.2 * Math.pow(f, 0.6);
        const span = 3.4 - 1.4 * f;
        const rho = 0.008 + 0.045 * f;
        const tilt = 0.03 + 0.34 * Math.pow(f, 1.6);
        const curl = 0.28 * smoothstep(0.45, 1, f);
        const bow = 0.3 * (0.25 + f);
        const h0 = 0.05 * (1 - f) - 0.06 * f;
        const shape = k.param(
          (u, v) => {
            const x = 2 * u - 1;
            const vv = v * (1 - 0.22 * x * x);
            const wf = 0.45 + 0.55 * Math.sin(Math.min(1, vv * 1.7) * Math.PI * 0.5);
            const a = th + x * 0.5 * span * wf;
            const v4 = vv * vv * vv * vv;
            const rad =
              rho + L * (Math.sin(tilt) * vv + bow * Math.sin(Math.PI * vv)) + curl * L * v4;
            const y = h0 + L * Math.cos(tilt) * vv - curl * 0.45 * L * v4;
            return [rad * Math.sin(a), y, rad * Math.cos(a)];
          },
          { grid: 18 },
        );
        const depth = 0.62 + 0.38 * f;
        k.add(shape, {
          pos: C,
          quat: Q,
          flat: 0.22,
          ...SW,
          color: (c) => {
            const x = Math.abs(2 * c.u - 1);
            const top = 1 - 0.22 * x * x;
            const edge = smoothstep(top - 0.14, top, c.v);
            let col = mix(shade(base, 0.45), base, smoothstep(0, 0.5, c.v));
            col = mix(col, mix(base, "#ffe0e6", 0.45), 0.8 * edge);
            const vein = 0.94 + 0.06 * Math.sin(c.u * 40 + c.fbm(c.p[0] * 20, c.p[1] * 20, 0) * 3);
            return lit(shade(col, depth * vein), c.n, 0.35);
          },
        });
      }
      // Sepals curling down under the bloom, and the hip.
      const sepal = blade(k, { L: 0.16, W: 0.03, grid: 8, bend: (v) => -0.3 * v * v });
      for (let i = 0; i < 5; i++) {
        const th = (i / 5) * TAU + 0.3;
        k.add(sepal, {
          pos: add(C, quatRotate(Q, [Math.sin(th) * 0.05, -0.06, Math.cos(th) * 0.05])),
          quat: quatMul(Q, quatEuler(110, (th * 180) / Math.PI, 0)),
          weight: 1.5,
          ...SW,
          color: (c) => lit(mix("#2f5a1e", "#5a8a30", c.v), c.n, 0.3),
        });
      }
      k.add(k.ellipsoid(0.055, 0.07, 0.055), {
        pos: add(C, quatRotate(Q, [0, -0.1, 0])),
        quat: Q,
        ...SW,
        color: (c) => lit("#3f6a22", c.n, 0.4),
      });
      // Stem with thorns and compound leaves.
      const top = add(C, quatRotate(Q, [0, -0.14, 0]));
      const stem = spline([[0.03, 0, 0], [-0.02, 0.35, 0.02], [0.02, 0.7, 0.04], top]);
      k.add(k.tube(stem, 0.022, { samples: 64, grid: 16 }), {
        flat: 0.3,
        ...SW,
        color: (c) =>
          lit(mix("#2f5a1c", "#4f7a2a", c.fbm(c.p[0] * 20, c.p[1] * 20, 0) * 0.5 + 0.5), c.n, 0.4),
      });
      for (let i = 0; i < 9; i++) {
        const t = 0.08 + i * 0.09;
        const p = stem(t);
        const a = i * 2.4;
        const d = [Math.sin(a), 0.4, Math.cos(a)];
        k.add(k.cone(0.012, 0.0005, 0.045, { caps: false }), {
          pos: add(p, mul(unit(d), 0.03)),
          quat: quatFromTo([0, 1, 0], d),
          weight: 3,
          ...SW,
          color: (c) => lit(mix("#6a3a22", "#a05a3a", c.v), c.n, 0.3),
        });
      }
      const leaflet = blade(k, {
        L: 0.13,
        W: 0.045,
        cup: 0.2,
        grid: 10,
        width: (v) =>
          Math.sin(Math.PI * v) ** 0.7 * (1 - 0.1 * Math.abs(Math.sin(v * Math.PI * 7))),
        bend: (v) => 0.1 * v * v,
      });
      for (const [t, az] of [
        [0.32, 1.7],
        [0.55, -1.4],
        [0.74, 0.4],
      ]) {
        const p0 = stem(t);
        const d = [Math.sin(az), 0.35, Math.cos(az)];
        const end = add(p0, mul(unit(d), 0.2));
        k.add(k.tube(spline([p0, end]), 0.006, { samples: 8, grid: 6 }), {
          ...SW,
          color: "#3f6a22",
        });
        // Leaflets in pairs along the petiole, one at the tip.
        for (const [s, side] of [
          [0.4, -1],
          [0.4, 1],
          [0.75, -1],
          [0.75, 1],
          [1, 0],
        ]) {
          const q = lerp3(p0, end, s);
          const yaw = (az + side * 1.1) * (180 / Math.PI);
          k.add(leaflet, {
            pos: q,
            rot: [-70 + 10 * Math.abs(side), yaw, 0],
            ...SW,
            color: (c) => {
              const mid = Math.abs(c.u - 0.5) < 0.04;
              const col = mix(
                "#1f4a1a",
                "#3f7a2a",
                c.fbm(c.p[0] * 30, c.p[1] * 30, c.p[2] * 30) * 0.5 + 0.5,
              );
              return lit(mid ? mix(col, "#7aa04a", 0.4) : col, c.n, 0.4);
            },
          });
        }
      }
      grassMound(k, 0.36, 0, { h: 0.04, blades: 0.015, bladeLen: 0.1 });
    },
  },

  dandelion: {
    alive: true,
    controls: [{ key: "blow", label: "Blow", type: "pulse", ease: 5 }],
    action: { key: "blow", label: "Blow the seeds", sound: "whoosh" },
    drive(t, c, out) {
      const s = 1 - c.blow;
      // A gust bends the stalk while the seeds fly.
      out.amount = 1 + 10 * c.blow * (1 - c.blow);
      for (let g = 0; g < 12; g++) {
        const delay = (g / 12) * 0.22;
        const q = clamp((s - delay) / 0.6, 0, 1);
        const e = 1 - (1 - q) * (1 - q);
        const dir = BLOW[g];
        let vis = 1 - smoothstep(0.55, 0.95, q);
        let off = [dir[0] * 1.6 * e, dir[1] * 1.6 * e + 0.5 * q * q, dir[2] * 1.6 * e];
        if (s > 0.82) {
          // Home again, growing back.
          off = [0, 0, 0];
          vis = smoothstep(0.84, 1, s);
        }
        if (c.blow === 0) {
          off = [0, 0, 0];
          vis = 1;
        }
        const spin = quatAxisAngle(cross(dir, [0, 1, 0]), -1.2 * e);
        out.parts[`seeds${g}`] = { offset: off, quat: spin, visible: vis };
      }
    },
    build(k) {
      const rand = k.rand;
      const SW = sway(0.012, 0);
      const H = [0.05, 1.3, 0];
      const stem = spline([
        [0, 0, 0],
        [0.04, 0.45, 0.02],
        [0.07, 0.9, 0],
        [H[0], H[1] - 0.04, H[2]],
      ]);
      k.add(
        k.tube(stem, (t) => 0.016 * (1 - 0.25 * t), { samples: 48, grid: 12 }),
        {
          flat: 0.3,
          ...SW,
          color: (c) => lit(mix("#6f9a3a", "#a8b870", c.t * 0.6), c.n, 0.4),
        },
      );
      k.add(k.sphere(0.045), {
        pos: H,
        weight: 3,
        ...SW,
        color: (c) => lit(mix("#b89a5a", "#8a6a3a", c.rand()), c.n, 0.3),
      });
      // Seeds on a sphere, in twelve groups that fly off separately.
      const dirs = [];
      const n = 190;
      for (let i = 0; i < n; i++) {
        const y = 1 - ((i + 0.5) / n) * 2;
        if (y < -0.8) continue;
        const r = Math.sqrt(1 - y * y);
        dirs.push([Math.cos(i * GOLDEN) * r, y, Math.sin(i * GOLDEN) * r]);
      }
      const centres = SEED_GROUPS;
      const groupOf = dirs.map((d) => {
        let best = 0;
        let bd = -2;
        centres.forEach((c, g) => {
          const v = dot(c, d);
          if (v > bd) {
            bd = v;
            best = g;
          }
        });
        return best;
      });
      const parts = centres.map((c, g) => k.part(`seeds${g}`, { pivot: H }));
      const R0 = 0.05;
      const R1 = 0.3;
      k.cloud({ share: 0.5, size: 0.55, pattern: false }, (r) => {
        const j = Math.floor(r() * dirs.length);
        const d = dirs[j];
        const part = parts[groupOf[j]];
        const u = r();
        if (u < 0.3) {
          // The beak: a fine stalk from the seed to the tuft.
          const s = R0 + 0.03 + (R1 - R0 - 0.03) * r();
          return {
            p: add(H, mul(d, s)),
            dir: d,
            stretch: 3,
            color: "#f2efe6",
            opacity: 0.8,
            part,
            ...SW,
          };
        }
        if (u < 0.36) {
          // The seed itself.
          return {
            p: add(H, mul(d, R0 + 0.02 * r())),
            dir: d,
            stretch: 2,
            size: 1.3,
            color: "#7a5a32",
            part,
            ...SW,
          };
        }
        // The pappus: fine hairs fanning out from the tip.
        const [e1, e2] = perp(d);
        const a = r() * TAU;
        const spread = 0.35 + 0.6 * r();
        const hair = unit(
          add(
            mul(d, Math.cos(spread)),
            add(mul(e1, Math.cos(a) * Math.sin(spread)), mul(e2, Math.sin(a) * Math.sin(spread))),
          ),
        );
        const along = 0.075 * r();
        return {
          p: add(add(H, mul(d, R1)), mul(hair, along)),
          dir: hair,
          stretch: 2.5,
          color: mix("#ffffff", "#e8e4da", r() * 0.5),
          opacity: 0.55 + 0.35 * r(),
          part,
          ...SW,
        };
      });
      // A few loose seeds drifting away.
      k.cloud({ share: 0.003, size: 1.4, pattern: false }, (r) => ({
        p: add(H, [0.25 + r() * 0.3, (r() - 0.3) * 0.4, (r() - 0.5) * 0.4]),
        color: "#ffffff",
        opacity: 0.7,
        kind: "rise",
        params: [0.9, r()],
      }));
      // A yellow flower still in bloom, lower down.
      const Y = [-0.36, 0.52, 0.12];
      const ystem = spline([[-0.1, 0, 0.05], [-0.2, 0.25, 0.1], [-0.3, 0.45, 0.12], Y]);
      k.add(k.tube(ystem, 0.013, { samples: 32, grid: 10 }), {
        ...SW,
        color: (c) => lit("#6f9a3a", c.n, 0.4),
      });
      const YF = unit([0.25, 0.8, 0.6]);
      const YQ = quatFromTo([0, 1, 0], YF);
      k.cloud({ share: 0.06, size: 0.8, flat: 0.3 }, (r) => {
        const a = r() * TAU;
        const rr = 0.13 * Math.sqrt(r());
        const f = rr / 0.13;
        const local = [Math.sin(a) * rr, 0.05 * (1 - f * f) + 0.02, Math.cos(a) * rr];
        const nrm = quatRotate(YQ, unit([Math.sin(a) * f, 1, Math.cos(a) * f]));
        return {
          p: add(Y, quatRotate(YQ, local)),
          dir: quatRotate(YQ, [Math.sin(a), 0.2, Math.cos(a)]),
          stretch: 1.8,
          color: lit(mix("#e8a810", "#ffe04a", f * 0.8 + 0.2 * r()), nrm, 0.3),
          ...SW,
        };
      });
      k.add(k.ellipsoid(0.07, 0.04, 0.07), {
        pos: add(Y, quatRotate(YQ, [0, -0.02, 0])),
        quat: YQ,
        ...SW,
        color: (c) => lit("#4f7a2a", c.n, 0.4),
      });
      // Toothed leaves in a rosette at the foot.
      const leaf = blade(k, {
        L: 0.42,
        W: 0.07,
        grid: 16,
        width: (v) =>
          Math.sin(Math.PI * Math.pow(v, 0.8)) ** 0.8 *
          (0.45 + 0.55 * Math.abs(Math.sin(v * Math.PI * 4.5))),
        bend: (v) => -0.05 * v,
      });
      for (let i = 0; i < 7; i++) {
        const az = (i / 7) * TAU + rand() * 0.4;
        k.add(leaf, {
          pos: [0, 0.03, 0],
          rot: [-78 + rand() * 10, (az * 180) / Math.PI, 0],
          ...SW,
          color: (c) => {
            const mid = Math.abs(c.u - 0.5) < 0.05;
            return lit(mid ? "#8aa860" : mix("#2f5a1c", "#4a7a2a", c.rand()), c.n, 0.4);
          },
        });
      }
      grassMound(k, 0.55, 0, { h: 0.05, blades: 0.02, bladeLen: 0.1 });
    },
  },

  tulip: {
    alive: true,
    options: [{ key: "color", label: "Colour", type: "color", default: "#d8202e" }],
    build(k, o) {
      const rand = k.rand;
      const SW = sway(0.01, 0);
      const cup = (R, Hh) => (u, v, th, span) => {
        const x = 2 * u - 1;
        const vv = v * (1 - 0.32 * Math.pow(Math.abs(x), 1.6));
        const r =
          R *
          (0.25 + 0.75 * Math.sin(Math.min(1, vv * 1.25) * Math.PI * 0.62)) *
          (1 - 0.12 * vv * vv);
        const a = th + x * span * 0.5;
        return [r * Math.sin(a), Hh * vv, r * Math.cos(a)];
      };
      const flowers = [
        { x: 0, z: 0, h: 1.2, lean: [0.08, 1, 0.12], s: 1 },
        { x: -0.32, z: -0.15, h: 0.95, lean: [-0.3, 1, 0.1], s: 0.9 },
        { x: 0.3, z: -0.05, h: 0.82, lean: [0.3, 1, 0.2], s: 0.85 },
      ];
      flowers.forEach((fl, fi) => {
        const A = unit(fl.lean);
        const Q = quatFromTo([0, 1, 0], A);
        const top = [fl.x + A[0] * 0.3, fl.h, fl.z + A[2] * 0.3];
        const stem = spline([
          [fl.x * 0.3, 0, fl.z * 0.3],
          [fl.x * 0.7, fl.h * 0.5, fl.z * 0.7],
          top,
        ]);
        k.add(k.tube(stem, 0.022 * fl.s, { samples: 48, grid: 14 }), {
          ...SW,
          color: (c) => lit(mix("#4f7f3a", "#7aa050", c.t), c.n, 0.4),
        });
        const R = 0.17 * fl.s;
        const Hh = 0.34 * fl.s;
        const f = cup(R, Hh);
        const tint = fi === 0 ? o.color : mix(o.color, fi === 1 ? "#ffffff" : "#000000", 0.12);
        for (let i = 0; i < 6; i++) {
          const inner = i % 2;
          const th = (i / 6) * TAU + rand() * 0.1;
          const span = inner ? 1.25 : 1.45;
          const shape = k.param((u, v) => f(u, v, th, span), { grid: 16 });
          k.add(shape, {
            pos: top,
            quat: Q,
            scale: inner ? 0.97 : 1,
            flat: 0.22,
            ...SW,
            color: (c) => {
              const x = Math.abs(2 * c.u - 1);
              let col = mix(shade(tint, 0.55), tint, smoothstep(0, 0.35, c.v));
              if (c.v < 0.12) col = mix(col, "#e8c23a", 0.5 * (1 - c.v / 0.12));
              col = mix(
                col,
                mix(tint, "#ffffff", 0.3),
                0.35 * smoothstep(0.2, 0.9, 1 - x) * smoothstep(0.4, 0.9, c.v),
              );
              return lit(shade(col, inner ? 0.85 : 1), c.n, 0.4);
            },
          });
        }
        // Two broad leaves from the base.
        for (let j = 0; j < 2; j++) {
          const az = rand() * TAU;
          const L = 0.55 * fl.s + 0.1 * rand();
          k.add(
            blade(k, {
              L,
              W: 0.085 * fl.s,
              cup: 0.5,
              grid: 16,
              width: (v) => Math.sin(Math.PI * Math.pow(v, 0.75)) ** 0.7,
              bend: (v) => 0.35 * v * v,
            }),
            {
              pos: [fl.x * 0.3, 0.03, fl.z * 0.3],
              rot: [-12 - 12 * rand(), (az * 180) / Math.PI, 0],
              ...SW,
              color: (c) => lit(mix("#3f6f44", "#6a9a5a", c.v * 0.6 + 0.2 * c.rand()), c.n, 0.4),
            },
          );
        }
      });
      grassMound(k, 0.62, 0, { h: 0.05, blades: 0.02, bladeLen: 0.1 });
    },
  },

  daisy: {
    alive: true,
    build(k) {
      const rand = k.rand;
      const SW = sway(0.012, 0);
      const heads = [
        { at: [0.02, 0.95, 0.05], face: [0.2, 0.7, 1], s: 1 },
        { at: [-0.38, 0.7, -0.05], face: [-0.3, 0.8, 1], s: 0.85 },
        { at: [0.36, 0.6, 0.1], face: [0.6, 0.9, 1], s: 0.8 },
      ];
      const ray = blade(k, {
        L: 0.2,
        W: 0.03,
        cup: -0.3,
        grid: 8,
        width: (v) => Math.sin(Math.PI * Math.pow(v, 0.55)) ** 0.5,
      });
      for (const h of heads) {
        const F = unit(h.face);
        const Q = quatFromTo([0, 1, 0], F);
        const toW = (p) => add(h.at, quatRotate(Q, mul(p, h.s)));
        const stem = spline([
          [h.at[0] * 0.4, 0, h.at[2] * 0.4],
          [h.at[0] * 0.8, h.at[1] * 0.5, h.at[2]],
          toW([0, -0.04, 0]),
        ]);
        k.add(k.tube(stem, 0.012, { samples: 32, grid: 10 }), {
          ...SW,
          color: (c) => lit("#5a8a34", c.n, 0.4),
        });
        // The yellow disc of florets.
        k.cloud({ share: 0.035, size: 0.7, flat: 0.35 }, (r) => {
          const a = r() * TAU;
          const rr = 0.075 * Math.sqrt(r());
          const f = rr / 0.075;
          const nrm = quatRotate(Q, unit([Math.sin(a) * f * 0.8, 1, Math.cos(a) * f * 0.8]));
          const dot2 = r();
          return {
            p: toW([Math.sin(a) * rr, 0.03 * (1 - f * f) + 0.005, Math.cos(a) * rr]),
            n: nrm,
            color: lit(mix("#e0a010", "#ffd83a", dot2 * 0.7 + 0.3 * (1 - f)), nrm, 0.35),
            ...SW,
          };
        });
        for (let i = 0; i < 30; i++) {
          const th = (i / 30) * TAU + (rand() - 0.5) * 0.1;
          k.add(ray, {
            pos: toW([Math.sin(th) * 0.065, 0, Math.cos(th) * 0.065]),
            quat: quatMul(Q, quatEuler(-90 + 8 + rand() * 12, (th * 180) / Math.PI + 180, 0)),
            scale: h.s * (0.9 + 0.2 * rand()),
            ...SW,
            color: (c) => {
              let col = mix("#f2eee8", "#ffffff", c.v);
              if (c.v > 0.85) col = mix(col, "#f2b8c8", (0.4 * (c.v - 0.85)) / 0.15);
              return lit(col, c.n, 0.35);
            },
          });
        }
        k.add(k.ellipsoid(0.07, 0.03, 0.07), {
          pos: toW([0, -0.02, 0]),
          quat: Q,
          scale: h.s,
          ...SW,
          color: (c) => lit("#4a7a2a", c.n, 0.4),
        });
      }
      // Spoon-shaped leaves at the foot.
      const leaf = blade(k, {
        L: 0.2,
        W: 0.05,
        cup: 0.2,
        grid: 10,
        width: (v) => Math.sin(Math.PI * Math.pow(v, 0.5)) ** 0.8,
      });
      for (let i = 0; i < 9; i++) {
        const az = (i / 9) * TAU + rand() * 0.3;
        k.add(leaf, {
          pos: [0, 0.04, 0],
          rot: [-70, (az * 180) / Math.PI, 0],
          ...SW,
          color: (c) => lit(mix("#2f5a1c", "#5a8a34", c.v), c.n, 0.4),
        });
      }
      grassMound(k, 0.62, 0, { h: 0.05, blades: 0.03, bladeLen: 0.14 });
    },
  },

  lotus: {
    alive: true,
    build(k) {
      const rand = k.rand;
      const WV = { kind: "wave", params: [0.006, 0] };
      // Still water.
      k.add(k.disc(0.9), {
        pos: [0, 0, 0],
        opacity: 0.6,
        flat: 0.3,
        pattern: false,
        ...WV,
        color: (c) => {
          const r = Math.hypot(c.p[0], c.p[2]) / 0.9;
          const ripple = 0.5 + 0.5 * Math.sin(r * 40 + c.fbm(c.p[0] * 3, 0, c.p[2] * 3) * 4);
          if (c.n[1] < 0) return "#1a3a3a";
          return mix(mix("#2f7f86", "#1f5a66", r), "#bfe6e8", 0.25 * ripple * (1 - r));
        },
      });
      // Lily pads: discs with a notch, veins and a turned-up rim.
      const pad = (R, notch) =>
        k.param(
          (u, v) => {
            const a = notch / 2 + u * (TAU - notch);
            const r = R * Math.sqrt(v);
            const lift = 0.04 * R * Math.pow(v, 6);
            return [Math.sin(a) * r, lift, Math.cos(a) * r];
          },
          { grid: 24, flip: true },
        );
      for (const [x, z, R, rot, red] of [
        [0.04, 0.04, 0.5, 30, 0],
        [-0.52, -0.3, 0.3, 160, 1],
        [0.52, -0.38, 0.25, 250, 0],
        [-0.42, 0.45, 0.22, 80, 1],
      ]) {
        k.add(pad(R, 0.4), {
          pos: [x, 0.012, z],
          rot: [0, rot, 0],
          flat: 0.2,
          ...WV,
          color: (c) => {
            const a = c.u * 22;
            const vein = Math.abs(a - Math.round(a)) < 0.06 && c.v > 0.05;
            let col = mix("#2e6a26", "#4f8f34", 0.5 + 0.5 * c.fbm(c.p[0] * 8, 0, c.p[2] * 8));
            if (vein) col = mix(col, "#8ab85a", 0.5);
            if (c.v > 0.93) col = red ? "#8a3a3a" : "#3f7a2a";
            return lit(col, c.n, 0.3);
          },
        });
      }
      // The flower: three layers of pointed petals around a seed pod.
      const C = [0.05, 0.05, 0.05];
      const petal = (L, W, bend) =>
        blade(k, {
          L,
          W,
          cup: -0.9,
          grid: 14,
          width: (v) => Math.sin(Math.PI * Math.pow(v, 0.85)) ** 0.75,
          bend: (v) => bend * v * v,
        });
      const layers = [
        { n: 8, L: 0.5, W: 0.155, tilt: 66, off: 0, bend: -0.25, tone: 0.9 },
        { n: 8, L: 0.48, W: 0.145, tilt: 44, off: 0.5, bend: -0.15, tone: 1 },
        { n: 7, L: 0.4, W: 0.12, tilt: 22, off: 0.25, bend: -0.05, tone: 1.05 },
      ];
      for (const L of layers) {
        const shape = petal(L.L, L.W, L.bend);
        for (let i = 0; i < L.n; i++) {
          const th = ((i + L.off) / L.n) * 360 + (rand() - 0.5) * 8;
          k.add(shape, {
            pos: C,
            rot: [L.tilt + (rand() - 0.5) * 8, th, 0],
            flat: 0.22,
            ...WV,
            color: (c) => {
              const x = Math.abs(2 * c.u - 1);
              let col = mix("#fbeef0", "#f3a6c0", smoothstep(0.15, 0.7, c.v));
              col = mix(col, "#d8387a", smoothstep(0.7, 1, c.v) * 0.8 + 0.2 * x * c.v);
              const vein = 0.95 + 0.05 * Math.sin(c.u * 50);
              return lit(shade(col, L.tone * vein), c.n, 0.3);
            },
          });
        }
      }
      k.add(k.cone(0.07, 0.1, 0.1), {
        pos: [C[0], C[1] + 0.12, C[2]],
        weight: 2,
        ...WV,
        color: (c) => {
          if (c.s.cap === "top") {
            const pits = c.noise(c.p[0] * 90, 0, c.p[2] * 90) > 0.35;
            return pits ? "#6a6a1a" : "#d8d050";
          }
          return lit("#b8c040", c.n, 0.4);
        },
      });
      k.cloud({ share: 0.02, size: 0.6, pattern: false }, (r) => {
        const a = r() * TAU;
        const rr = 0.1 + 0.05 * r();
        const s = r();
        return {
          p: [
            C[0] + Math.sin(a) * rr * (1 + 0.3 * s),
            C[1] + 0.07 + s * 0.07,
            C[2] + Math.cos(a) * rr * (1 + 0.3 * s),
          ],
          dir: [Math.sin(a) * 0.4, 1, Math.cos(a) * 0.4],
          stretch: 2,
          color: s > 0.8 ? "#ffcf3a" : "#f6e08a",
          ...WV,
        };
      });
      // A closed bud on its own stalk.
      const bud = [-0.45, 0.42, 0.2];
      k.add(
        k.tube(spline([[-0.4, 0, 0.18], [-0.44, 0.2, 0.2], bud]), 0.014, { samples: 24, grid: 8 }),
        {
          ...WV,
          color: "#4f7a2a",
        },
      );
      k.add(
        k.lathe([
          [0, 0],
          [0.06, 0.04],
          [0.075, 0.1],
          [0.05, 0.18],
          [0, 0.26],
        ]),
        {
          pos: bud,
          ...WV,
          color: (c) =>
            lit(mix("#f6c0d0", "#d8387a", smoothstep(0.08, 0.26, c.p[1] - bud[1])), c.n, 0.4),
        },
      );
    },
  },

  mushroom: {
    alive: true,
    options: [{ key: "color", label: "Cap", type: "color", default: "#d21f1a" }],
    build(k, o) {
      const rand = k.rand;
      const shroom = (x, z, h, R, open, lean) => {
        const q = quatFromTo([0, 1, 0], [lean, 1, lean * 0.3]);
        const at = (p) => add([x, 0, z], quatRotate(q, p));
        const sr = R * 0.2;
        // The stem: a bulb with scaly rings at the foot, fibrous above.
        k.add(
          k.lathe([
            [0, 0],
            [sr * 1.5, 0.01],
            [sr * 1.75, h * 0.1],
            [sr * 1.35, h * 0.24],
            [sr * 1.05, h * 0.4],
            [sr, h * 0.75],
            [sr * 0.95, h],
          ]),
          {
            pos: [x, 0, z],
            quat: q,
            interior: 0.1,
            core: "#f6f2ea",
            color: (c) => {
              const y = c.lp[1] / h;
              const fib = c.noise(c.lp[0] * 60, c.lp[1] * 6, c.lp[2] * 60);
              let col = mix("#f6f1e6", "#e0d6c0", 0.3 + 0.3 * fib);
              if (y < 0.28 && Math.abs(Math.sin(y * 70)) > 0.75) col = mix(col, "#cfc3a6", 0.6);
              return lit(col, c.n, 0.4);
            },
          },
        );
        // The ring (annulus), a little skirt under the cap.
        k.add(
          k.lathe([
            [sr * 0.98, h * 0.82],
            [sr * 1.5, h * 0.8],
            [sr * 1.85, h * 0.74],
            [sr * 1.95, h * 0.7],
          ]),
          {
            pos: [x, 0, z],
            quat: q,
            color: (c) => lit(shade("#f3eee0", 0.9 + 0.1 * Math.sin(c.u * TAU * 30)), c.n, 0.4),
          },
        );
        // The cap: a dome, flatter when open.
        const ch = R * (0.78 - 0.42 * open);
        const capShape = k.lathe(
          [
            [R * 0.9, h - 0.01],
            [R, h + ch * 0.06],
            [R * 0.96, h + ch * 0.3],
            [R * 0.78, h + ch * 0.68],
            [R * 0.42, h + ch * 0.95],
            [0, h + ch],
          ],
          { thick: 0.08 },
        );
        const capCol = o.color;
        k.add(capShape, {
          pos: [x, 0, z],
          quat: q,
          flat: 0.2,
          color: (c) => {
            const rr = Math.hypot(c.lp[0], c.lp[2]) / R;
            let col = mix(
              shade(capCol, 0.85),
              mix(capCol, "#f0801a", 0.35),
              smoothstep(0.5, 1, rr),
            );
            col = shade(col, 0.95 + 0.1 * c.fbm(c.lp[0] * 8, c.lp[1] * 8, c.lp[2] * 8));
            const hi = Math.pow(Math.max(0, dot(c.n, unit([-0.4, 0.8, 0.6]))), 18);
            return mix(lit(col, c.n, 0.35), "#ffffff", 0.35 * hi);
          },
        });
        // Gills underneath.
        k.add(
          k.lathe([
            [sr * 0.9, h - 0.005],
            [R * 0.5, h + 0.004],
            [R * 0.9, h - 0.008],
          ]),
          {
            pos: [x, 0, z],
            quat: q,
            flat: 0.2,
            color: (c) => {
              if (c.n[1] > 0.3) return null;
              const g = Math.abs(Math.sin(c.u * Math.PI * 110));
              return mix("#f3ead2", "#b8a684", smoothstep(0.75, 1, g));
            },
          },
        );
        // White warts scattered over the cap.
        const nw = Math.round(60 * R);
        for (let i = 0; i < nw; i++) {
          const f = Math.sqrt((i + 0.5) / nw) * 0.9;
          const [r, y] = capShape.profileAt(1 - f);
          const [r2, y2] = capShape.profileAt(Math.min(1, 1 - f + 0.02));
          const a = i * GOLDEN + rand() * 0.3;
          const nr = unit([y2 - y, -(r2 - r)]);
          const nrm = [Math.sin(a) * nr[0], nr[1], Math.cos(a) * nr[0]];
          const s = R * (0.035 + 0.035 * rand()) * (1 - 0.4 * f);
          k.add(k.ellipsoid(s, s * 0.45, s * (0.8 + 0.4 * rand())), {
            pos: at([Math.sin(a) * r, y, Math.cos(a) * r]),
            quat: quatMul(q, quatFromTo([0, 1, 0], nrm)),
            weight: 2.5,
            flat: 0.3,
            color: (c) => lit(mix("#fbf8ef", "#e8dcc0", c.rand() * 0.5), c.n, 0.3),
          });
        }
      };
      shroom(0.08, 0, 0.78, 0.55, 1, 0.05);
      shroom(-0.56, 0.3, 0.36, 0.24, 0.3, -0.25);
      shroom(0.62, 0.34, 0.2, 0.14, 0, 0.3);
      // Mossy ground with grass and fallen leaves.
      grassMound(k, 0.95, 0, {
        h: 0.06,
        colors: ["#35561e", "#4f7a2a", "#7a9a3a"],
        blades: 0.03,
        bladeLen: 0.12,
        bladeKind: sway(0.03, 0),
      });
      k.cloud({ share: 0.02, size: 1.3, flat: 0.15 }, (r) => {
        const a = r() * TAU;
        const rr = 0.3 + 0.6 * Math.sqrt(r());
        return {
          p: [Math.sin(a) * rr, 0.06 * (1 - (rr / 0.95) ** 2) + 0.012, Math.cos(a) * rr],
          n: [(r() - 0.5) * 0.5, 1, (r() - 0.5) * 0.5],
          color: mix("#8a5a1a", "#d8a040", r()),
        };
      });
    },
  },

  fern: {
    alive: true,
    options: [SEED],
    build(k, o) {
      reseed(k, o);
      const rand = k.rand;
      const SW = sway(0.016, 0);
      const fronds = [];
      const NF = 12;
      for (let i = 0; i < NF; i++) {
        const az = i * GOLDEN * 1.0 + (rand() - 0.5) * 0.4;
        const L = 0.9 + 0.35 * rand();
        const lift = 0.95 + 0.45 * rand();
        const h = [Math.sin(az), 0, Math.cos(az)];
        const at = (s) => [
          h[0] * L * 0.82 * s,
          0.1 + L * (lift * s - 0.75 * s * s),
          h[2] * L * 0.82 * s,
        ];
        const pinnae = [];
        const P = 26;
        for (let j = 0; j < P; j++) {
          const s = 0.1 + (0.88 * (j + 0.5)) / P;
          const T = unit(sub(at(s + 0.01), at(s - 0.01)));
          const Sr = unit(cross(T, [0, 1, 0]));
          const Np = unit(cross(Sr, T));
          const len = 0.3 * L * Math.sin(Math.PI * Math.min(1, s * 1.15)) ** 0.8 * (1 - 0.55 * s);
          for (const side of [-1, 1]) {
            const pd = unit(
              add(add(mul(Sr, side * Math.cos(0.5)), mul(T, Math.sin(0.5))), mul(Np, -0.2)),
            );
            pinnae.push({ base: at(s + side * 0.006), pd, Np, len, s });
          }
        }
        fronds.push({ at, pinnae, L });
        k.add(
          k.tube(at, (t) => 0.012 * (1 - 0.8 * t), { samples: 32, grid: 8 }),
          {
            ...SW,
            color: (c) => lit(mix("#5a6a2a", "#7a9a3a", c.t), c.n, 0.3),
          },
        );
      }
      const greens = ["#1f4a18", "#2f6a22", "#4a8a2e", "#7ab244", "#b0d46a"];
      k.cloud({ share: 0.62, size: 0.62, flat: 0.25 }, (r) => {
        const f = fronds[Math.floor(r() * NF)];
        const pn = f.pinnae[Math.floor(r() * f.pinnae.length)];
        const u = r();
        const side2 = r() < 0.5 ? -1 : 1;
        const pp = unit(add(mul(unit(cross(pn.Np, pn.pd)), side2), mul(pn.pd, 0.55)));
        const lp = 0.32 * pn.len * (1 - 0.75 * u);
        const v = r();
        const across = unit(cross(pp, pn.Np));
        const w = lp * 0.28 * Math.sin(Math.PI * v) * (r() - 0.5) * 2;
        const p = add(add(add(pn.base, mul(pn.pd, pn.len * u)), mul(pp, lp * v)), mul(across, w));
        const tone = clamp(
          0.3 + 0.3 * dot(pn.Np, LIGHT) + 0.25 * v + 0.2 * u - 0.1 * pn.s + 0.12 * (r() - 0.5),
          0,
          1,
        );
        return { p, n: pn.Np, color: ramp(greens, tone), ...SW };
      });
      // Two fiddleheads uncurling in the middle.
      for (const [x, z, a] of [
        [0.06, 0.04, 0.4],
        [-0.07, -0.02, 2.6],
      ]) {
        const pts = [];
        for (let i = 0; i <= 24; i++) {
          const t = i / 24;
          if (t < 0.45) pts.push([x, 0.08 + (t / 0.45) * 0.34, z]);
          else {
            const th = ((t - 0.45) / 0.55) * Math.PI * 3.2;
            const rr = 0.07 * (1 - th / (Math.PI * 3.6));
            const d = [Math.sin(a), 0, Math.cos(a)];
            pts.push([
              x + d[0] * Math.sin(th) * rr,
              0.42 + rr * (1 - Math.cos(th)) * 0.9 - 0.0,
              z + d[2] * Math.sin(th) * rr,
            ]);
          }
        }
        k.add(
          k.tube(spline(pts), (t) => 0.014 * (1 - 0.5 * t), { samples: 64, grid: 10 }),
          {
            ...SW,
            weight: 1.5,
            color: (c) => lit(mix("#6a9a3a", "#9ac050", c.t), c.n, 0.4),
          },
        );
      }
      grassMound(k, 0.72, 0, {
        h: 0.07,
        colors: ["#2f4a1a", "#46662a", "#6a8a3a"],
        soil: "#4a3220",
      });
      for (let i = 0; i < 4; i++) {
        const a = rand() * TAU;
        const s = 0.06 + rand() * 0.05;
        k.add(k.ellipsoid(s * 1.3, s * 0.7, s), {
          pos: [Math.sin(a) * 0.55, 0.03, Math.cos(a) * 0.55],
          rot: [0, rand() * 180, 0],
          color: (c) => {
            const moss = c.n[1] > 0.4 && c.noise(c.p[0] * 30, c.p[1] * 30, c.p[2] * 30) > -0.1;
            return lit(moss ? "#5a7a2a" : mix("#6f6a62", "#9a948a", c.rand()), c.n, 0.4);
          },
        });
      }
    },
  },

  saguaro: {
    options: [
      { key: "arms", label: "Arms", type: "slider", min: 0, max: 4, step: 1, default: 3 },
      { key: "flowers", label: "Flowers", type: "switch", default: true },
      SEED,
    ],
    build(k, o) {
      reseed(k, o);
      const rand = k.rand;
      const H = 1.85;
      const R = 0.19;
      const RIBS = 16;
      const prof = (y) => {
        const top = H - R;
        const d = y > top ? Math.sqrt(Math.max(0, 1 - ((y - top) / R) ** 2)) : 1;
        return d * (1 + 0.06 * (1 - y / H));
      };
      const ribCol = (rib, c) => {
        let col = mix("#2c5a2a", "#5f8f42", smoothstep(-0.6, 0.9, rib));
        col = shade(col, 0.95 + 0.1 * c.noise(c.p[0] * 5, c.p[1] * 30, c.p[2] * 5));
        return lit(col, c.n, 0.45);
      };
      k.add(
        k.param(
          (u, v) => {
            const a = u * TAU;
            const y = v * H;
            const rr = R * prof(y) * (1 + 0.07 * Math.cos(RIBS * a));
            return [Math.sin(a) * rr, y, Math.cos(a) * rr];
          },
          { grid: 72 },
        ),
        {
          interior: 0.1,
          core: "#b8c890",
          color: (c) => ribCol(Math.cos(RIBS * c.u * TAU), c),
        },
      );
      const spines = [];
      for (let i = 0; i < RIBS; i++) {
        for (let y = 0.05; y < H - 0.02; y += 0.055) {
          const a = (i / RIBS) * TAU;
          const rr = R * prof(y) * 1.07;
          if (rr < 0.02) continue;
          const d = [Math.sin(a), 0, Math.cos(a)];
          spines.push({ p: [d[0] * rr, y, d[2] * rr], d });
        }
      }
      const tips = [[0, H + 0.01, 0]];
      const ARM = [
        { a: 1.3, y: 0.62, h: 0.62 },
        { a: -1.9, y: 0.82, h: 0.5 },
        { a: 0.1, y: 1.02, h: 0.38 },
        { a: 3.1, y: 0.5, h: 0.45 },
      ];
      for (let i = 0; i < o.arms; i++) {
        const A = ARM[i];
        const d = [Math.sin(A.a), 0, Math.cos(A.a)];
        const out = 0.36 + 0.04 * rand();
        const pts = [
          [d[0] * 0.05, A.y, d[2] * 0.05],
          [d[0] * 0.25, A.y + 0.02, d[2] * 0.25],
          [d[0] * out, A.y + 0.1, d[2] * out],
          [d[0] * (out + 0.03), A.y + 0.3, d[2] * (out + 0.03)],
          [d[0] * (out + 0.03), A.y + A.h, d[2] * (out + 0.03)],
        ];
        const ar = 0.115;
        const arm = k.tube(spline(pts), ar, { samples: 64, grid: 32 });
        k.add(arm, { color: (c) => ribCol(Math.cos(12 * c.u * TAU), c) });
        const end = pts[4];
        k.add(k.sphere(ar), {
          pos: end,
          scale: [1, 0.9, 1],
          color: (c) => {
            const a = Math.atan2(c.lp[0], c.lp[2]);
            return ribCol(Math.cos(12 * a) * (1 - c.ln[1] * 0.8), c);
          },
        });
        tips.push([end[0], end[1] + ar * 0.85, end[2]]);
        for (let j = 0; j < 12; j++) {
          const al = (j / 12) * TAU;
          for (let t = 0.12; t < 1; t += 0.05) {
            const f = arm.frame(t);
            const dd = add(mul(f.n, Math.cos(al)), mul(f.b, Math.sin(al)));
            spines.push({ p: add(f.p, mul(dd, ar * 1.05)), d: dd });
          }
        }
      }
      k.cloud({ share: 0.015, size: 0.45, pattern: false }, (r) => {
        const s = spines[Math.floor(r() * spines.length)];
        const dd = unit(add(s.d, [(r() - 0.5) * 1.2, (r() - 0.3) * 1.2, (r() - 0.5) * 1.2]));
        return {
          p: add(s.p, mul(dd, 0.012 * r())),
          dir: dd,
          stretch: 3,
          color: r() < 0.3 ? "#8a7a5a" : mix("#c8bc94", "#efe4c0", r()),
        };
      });
      if (o.flowers) {
        for (const tp of tips) {
          for (let f = 0; f < 3; f++) {
            const a = f * 2.1 + rand();
            const c = add(tp, [Math.sin(a) * 0.05, -0.01, Math.cos(a) * 0.05]);
            k.cloud({ share: 0.006, size: 0.7, flat: 0.3, pattern: false }, (r) => {
              const b = r() * TAU;
              const rr = 0.045 * Math.sqrt(r());
              const centre = rr < 0.015;
              return {
                p: add(c, [Math.sin(b) * rr, 0.02 + 0.02 * (rr / 0.045), Math.cos(b) * rr]),
                n: [Math.sin(b) * 0.4, 1, Math.cos(b) * 0.4],
                color: centre ? "#f2c230" : mix("#fbf8ee", "#f0e6cc", r()),
              };
            });
          }
        }
      }
      // A little barrel cactus, stones and desert sand.
      const bx = 0.48;
      const bz = 0.35;
      k.add(
        k.param(
          (u, v) => {
            const a = u * TAU;
            const y = v * 0.2;
            const rr =
              0.13 *
              Math.sin(Math.PI * (0.15 + 0.85 * v * 0.92)) ** 0.5 *
              (1 + 0.08 * Math.cos(14 * a));
            return [bx + Math.sin(a) * rr, y, bz + Math.cos(a) * rr];
          },
          { grid: 36 },
        ),
        { color: (c) => ribCol(Math.cos(14 * c.u * TAU), c) },
      );
      k.cloud({ share: 0.005, size: 0.7, flat: 0.3, pattern: false }, (r) => {
        const b = r() * TAU;
        const rr = 0.05 * Math.sqrt(r());
        return {
          p: [bx + Math.sin(b) * rr, 0.21 + 0.01 * (rr / 0.05), bz + Math.cos(b) * rr],
          n: [0, 1, 0],
          color: rr < 0.015 ? "#f2c230" : mix("#f0508a", "#ff8ab0", r()),
        };
      });
      for (let i = 0; i < 5; i++) {
        const a = rand() * TAU;
        const s = 0.05 + rand() * 0.06;
        k.add(k.ellipsoid(s * 1.3, s * 0.6, s), {
          pos: [Math.sin(a) * (0.45 + rand() * 0.25), 0.02, Math.cos(a) * (0.45 + rand() * 0.25)],
          rot: [0, rand() * 180, 0],
          color: (c) => lit(mix("#9a6a4a", "#c89a6a", c.rand() * 0.6), c.n, 0.4),
        });
      }
      grassMound(k, 0.82, 0, {
        h: 0.06,
        colors: ["#c89a62", "#dcb47a", "#ecd09a"],
        soil: "#9a6a42",
      });
    },
  },

  coral: {
    alive: true,
    options: [SEED],
    build(k, o) {
      reseed(k, o);
      const rand = k.rand;
      // The reef: a lumpy dark base crusted with pink and green.
      k.add(k.ellipsoid(0.95, 0.22, 0.72), {
        pos: [0, 0, 0],
        color: (c) => {
          if (c.n[1] < -0.2) return null;
          const n = c.fbm(c.p[0] * 5, c.p[1] * 5, c.p[2] * 5);
          let col = mix("#4a4250", "#6f6470", 0.5 + 0.5 * n);
          const crust = c.noise(c.p[0] * 9 + 3, c.p[1] * 9, c.p[2] * 9);
          if (crust > 0.35) col = mix(col, "#d86a8a", 0.5);
          else if (crust < -0.4) col = mix(col, "#6a8a3a", 0.5);
          return lit(col, c.n, 0.45);
        },
      });
      for (let i = 0; i < 9; i++) {
        const a = rand() * TAU;
        const rr = 0.3 + 0.5 * rand();
        const s = 0.1 + 0.1 * rand();
        k.add(k.ellipsoid(s * 1.3, s * 0.8, s), {
          pos: [Math.sin(a) * rr * 0.95, 0.1, Math.cos(a) * rr * 0.72],
          color: (c) =>
            lit(
              mix("#4a4250", "#7a6a78", c.fbm(c.p[0] * 8, c.p[1] * 8, c.p[2] * 8) * 0.5 + 0.5),
              c.n,
              0.45,
            ),
        });
      }
      const SW = sway(0.03, 0.15);
      // Staghorn coral: orange branches with pale growing tips.
      for (const [x, z, s, hue] of [
        [0.35, -0.12, 1, 0],
        [0.62, 0.22, 0.7, 0],
        [-0.12, -0.05, 0.8, 1],
      ]) {
        const tree = growTree(rand, {
          base: [x, 0.18, z],
          dir: [0, 1, 0],
          length: 0.22 * s,
          radius: 0.045 * s,
          depth: 3,
          kids: [
            [3, 3],
            [2, 3],
            [2, 2],
          ],
          spread: [0.75, 0.6, 0.55],
          ratio: [1.1, 0.85, 0.8],
          radRatio: [0.85, 0.85, 0.85],
          from: [0.8, 0.5, 0.5],
          wobble: [0.3, 0.4, 0.4],
          up: [0.15, 0.2, 0.2],
          taper: 0.85,
          tipTaper: 0.7,
        });
        for (const b of tree.branches) {
          const last = b.level === 3;
          k.add(
            k.tube(spline(b.pts), (t) => lerp(b.r0, b.r1, t), {
              samples: 16,
              grid: 10,
              caps: last,
            }),
            {
              flat: 0.35,
              color: (c) => {
                const tip = last ? smoothstep(0.55, 1, c.t) : 0;
                let col = mix(
                  "#d8702a",
                  "#f09a4a",
                  c.noise(c.p[0] * 60, c.p[1] * 60, c.p[2] * 60) * 0.5 + 0.5,
                );
                col = mix(col, "#fbe0c0", tip);
                return lit(col, c.n, 0.35);
              },
            },
          );
        }
      }
      // Brain coral.
      k.add(k.sphere(0.3), {
        pos: [-0.32, 0.12, 0.22],
        scale: [1, 0.72, 1],
        interior: 0.08,
        core: "#c8b070",
        color: (c) => {
          if (c.ln[1] < -0.1) return null;
          const g = c.fbm(c.lp[0] * 7, c.lp[1] * 7, c.lp[2] * 7, 3);
          const groove = Math.abs(g) < 0.07;
          return lit(groove ? "#6a6a28" : mix("#b8b850", "#e0dc80", c.rand() * 0.4), c.n, 0.45);
        },
      });
      // A purple sea fan at the back: a lattice of fine branches.
      const fanC = [-0.05, 0.16, -0.4];
      k.add(
        k.param(
          (u, v) => {
            const a = (u - 0.5) * 2.3;
            const r = 0.08 + 0.75 * v;
            return [
              fanC[0] + Math.sin(a) * r,
              fanC[1] + Math.cos(a) * r * 0.95,
              fanC[2] + 0.06 * Math.sin(a * 3) * v,
            ];
          },
          { grid: 48 },
        ),
        {
          flat: 0.3,
          ...SW,
          color: (c) => {
            const n = c.noise(c.u * 9, c.v * 9, 1) * 0.25;
            const ray = Math.abs(((c.u * 26 + n + c.v * 1.5) % 1) - 0.5) > 0.4;
            const ring = Math.abs(((c.v * 18 + n * 2) % 1) - 0.5) > 0.44;
            const edge = c.v > 0.97 && Math.cos((c.u - 0.5) * 7) > 0;
            if (!ray && !ring && !edge) return null;
            return lit(mix("#7a2a8a", "#c060c8", c.v * 0.7 + 0.2 * c.rand()), c.n, 0.3);
          },
        },
      );
      // A sea anemone: a pink column crowned with swaying tentacles.
      const an = [0.1, 0.22, 0.4];
      k.add(k.cylinder(0.09, 0.14, { caps: false }), {
        pos: [an[0], an[1], an[2]],
        color: (c) => lit(mix("#e06080", "#f08aa0", c.rand() * 0.5), c.n, 0.4),
      });
      k.cloud({ share: 0.08, size: 0.7, pattern: false }, (r) => {
        const a = r() * TAU;
        const rr = 0.03 + 0.07 * Math.sqrt(r());
        const t = r();
        const out = [Math.sin(a), 0, Math.cos(a)];
        const p = [
          an[0] + out[0] * (rr + 0.12 * t),
          an[1] + 0.07 + 0.16 * t - 0.08 * t * t * (rr / 0.1),
          an[2] + out[2] * (rr + 0.12 * t),
        ];
        return {
          p,
          dir: [out[0] * 0.8, 1 - t, out[2] * 0.8],
          stretch: 2.2,
          color: mix("#f79ab8", "#b048c0", smoothstep(0.6, 1, t)),
          kind: "sway",
          params: [0.05, an[1]],
        };
      });
      // Yellow tube sponges.
      for (const [x, z, h, r] of [
        [-0.62, -0.15, 0.36, 0.06],
        [-0.5, -0.28, 0.26, 0.05],
        [-0.72, 0.02, 0.22, 0.045],
      ]) {
        k.add(k.cylinder(r, h, { caps: false }), {
          pos: [x, 0.14 + h / 2, z],
          color: (c) => {
            const inner = dot(c.n, [x, 0, z]) < -0.9 * Math.hypot(x, z) ? 1 : 0;
            return lit(mix("#e8b020", "#f7d040", c.rand() * 0.4), c.n, 0.4 + 0.1 * inner);
          },
        });
        k.add(k.disc(r * 0.85), {
          pos: [x, 0.14 + h - 0.02, z],
          color: "#5a3a10",
        });
      }
      // Two little fish circling the reef.
      for (let f = 0; f < 2; f++) {
        const a = f * Math.PI + 0.6;
        const rr = 0.78 - f * 0.1;
        const p = [Math.sin(a) * rr, 0.7 + f * 0.18, Math.cos(a) * rr];
        const tangent = [Math.cos(a), 0, -Math.sin(a)];
        const q = quatFromTo([1, 0, 0], tangent);
        const fish = { kind: "orbit", params: [0.45, 0], pattern: false };
        k.add(k.ellipsoid(0.075, 0.045, 0.025), {
          pos: p,
          quat: q,
          weight: 3,
          ...fish,
          color: (c) => {
            const x = c.lp[0] / 0.075;
            const band = Math.abs(x - 0.3) < 0.12 || Math.abs(x + 0.35) < 0.1;
            if (x > 0.72 && Math.abs(c.lp[2]) > 0.012 && Math.abs(c.lp[1]) < 0.012)
              return "#111111";
            return band ? "#ffffff" : lit("#f2701a", c.n, 0.3);
          },
        });
        k.add(k.ellipsoid(0.03, 0.035, 0.008), {
          pos: add(p, quatRotate(q, [-0.085, 0, 0])),
          quat: q,
          weight: 3,
          ...fish,
          color: "#e85a10",
        });
      }
      // Bubbles.
      k.cloud({ share: 0.004, size: 1.2, pattern: false }, (r) => ({
        p: [0.1 + (r() - 0.5) * 0.15, 0.45, 0.4 + (r() - 0.5) * 0.15],
        color: "#e6f6ff",
        opacity: 0.5,
        kind: "rise",
        params: [1.2, r()],
      }));
      k.reach([0, 1.2, 0]);
    },
  },

  pinecone: {
    build(k) {
      const rand = k.rand;
      const N = 120;
      const Y0 = -0.62;
      const HT = 1.35;
      const radius = (h) => 0.36 * Math.sin(Math.PI * (0.06 + 0.9 * h)) ** 0.7 * (1 - 0.25 * h);
      k.add(k.ellipsoid(0.16, HT * 0.46, 0.16), {
        pos: [0, Y0 + HT * 0.48, 0],
        color: "#3a2412",
      });
      for (let i = 0; i < N; i++) {
        const h = (i + 0.5) / N;
        const th = i * GOLDEN;
        const R = radius(h);
        const e = (-35 + 95 * h) * (Math.PI / 180);
        const len = 0.1 + 0.11 * Math.sin(Math.PI * Math.min(1, 0.1 + h)) ** 0.6;
        const wid = 0.06 + 0.06 * Math.sin(Math.PI * h) ** 0.5;
        const d = [Math.sin(th) * Math.cos(e), Math.sin(e), Math.cos(th) * Math.cos(e)];
        const centre = [
          Math.sin(th) * (R - len * 0.45) + d[0] * len * 0.5,
          Y0 + HT * h + d[1] * len * 0.3,
          Math.cos(th) * (R - len * 0.45) + d[2] * len * 0.5,
        ];
        const rot = [-(e * 180) / Math.PI, (th * 180) / Math.PI, 0];
        const tone = 0.9 + 0.2 * rand();
        k.add(k.ellipsoid(wid, 0.028, len * 0.55), {
          pos: centre,
          rot,
          flat: 0.25,
          color: (c) => {
            const along = c.lp[2] / (len * 0.55);
            let col = mix("#3a2212", "#8a5a2e", smoothstep(-0.8, 0.4, along));
            col = mix(col, "#c09060", smoothstep(0.5, 0.95, along) * (c.lp[1] > 0 ? 1 : 0.5));
            if (along > 0.72 && Math.abs(c.lp[0]) < wid * 0.5 && c.lp[1] > 0)
              col = mix(col, "#5a3a1e", 0.7);
            return lit(shade(col, tone), c.n, 0.5);
          },
        });
      }
      // A short woody stalk.
      k.add(k.cylinder(0.035, 0.12), {
        pos: [0, Y0 - 0.04, 0],
        color: (c) => lit("#4a2e18", c.n, 0.4),
      });
    },
  },

  acorn: {
    options: [
      {
        key: "leaf",
        label: "Leaf",
        type: "select",
        default: "autumn",
        choices: [
          { id: "autumn", label: "Autumn" },
          { id: "green", label: "Green" },
        ],
      },
    ],
    build(k, o) {
      const acorn = (pos, rot, s) => {
        const q = quatEuler(...rot);
        const at = (p) => add(pos, quatRotate(q, mul(p, s)));
        k.add(
          k.lathe([
            [0, -0.56],
            [0.03, -0.52],
            [0.12, -0.44],
            [0.24, -0.3],
            [0.3, -0.1],
            [0.31, 0.08],
            [0.29, 0.18],
          ]),
          {
            pos,
            quat: q,
            scale: s,
            flat: 0.2,
            interior: 0.12,
            core: "#f0e2c0",
            color: (c) => {
              const y = c.lp[1];
              if (y < -0.5) return "#3a2412";
              let col = mix("#5a3212", "#a8642a", smoothstep(-0.5, 0.1, y));
              col = shade(col, 0.94 + 0.06 * Math.sin(c.u * TAU * 16));
              const hi = Math.pow(Math.max(0, dot(c.n, unit([-0.4, 0.5, 0.75]))), 22);
              return mix(lit(col, c.n, 0.4), "#fff4e0", 0.55 * hi);
            },
          },
        );
        k.add(
          k.lathe([
            [0.3, 0.05],
            [0.345, 0.12],
            [0.34, 0.24],
            [0.26, 0.33],
            [0.12, 0.37],
            [0, 0.38],
          ]),
          {
            pos,
            quat: q,
            scale: s,
            flat: 0.3,
            color: (c) => {
              const row = Math.floor(c.v * 9);
              const f = (c.u * 30 + row * 0.5) % 1;
              const g = (c.v * 9) % 1;
              const gap = Math.abs(f - 0.5) > 0.4 || g < 0.12;
              const col = gap ? "#4a3420" : mix("#8a6a42", "#c0a070", g);
              return lit(col, c.n, 0.45);
            },
          },
        );
        const tip = at([0, 0.37, 0]);
        k.add(
          k.tube(spline([tip, at([0.03, 0.46, 0]), at([0.08, 0.52, 0.02])]), 0.025 * s, {
            samples: 12,
            grid: 8,
          }),
          {
            weight: 2,
            color: (c) => lit("#5a3e22", c.n, 0.4),
          },
        );
      };
      // An oak leaf with rounded lobes behind the acorns.
      const autumn = o.leaf === "autumn";
      const L = 1.5;
      const W = 0.42;
      const outline = (v) =>
        (0.42 + 0.58 * Math.abs(Math.sin(v * Math.PI * 3.6 + 0.4)) ** 0.7) *
        Math.sin(Math.PI * Math.min(1, v)) ** 0.55;
      k.add(
        k.param(
          (u, v) => {
            const x = (u - 0.5) * 2 * W;
            return [x, v * L, 0.08 * x * x - 0.12 * Math.sin(v * Math.PI)];
          },
          { grid: 40 },
        ),
        {
          pos: [0.05, -0.5, -0.25],
          rot: [-72, 25, 0],
          flat: 0.2,
          color: (c) => {
            const x = Math.abs(c.u - 0.5) * 2;
            if (x > outline(c.v)) return null;
            if (c.v < 0.02 && x > 0.05) return null;
            const mid = x < 0.03;
            const side =
              Math.abs(Math.sin((c.v * 3.6 + x * 0.9) * Math.PI)) < 0.07 && x < outline(c.v) * 0.85;
            let col = autumn
              ? mix("#b8601a", "#e8a030", 0.5 + 0.5 * c.fbm(c.p[0] * 4, c.p[1] * 4, c.p[2] * 4))
              : mix("#3f6f24", "#5f8f34", 0.5 + 0.5 * c.fbm(c.p[0] * 4, c.p[1] * 4, c.p[2] * 4));
            if (autumn && x > outline(c.v) * 0.8) col = mix(col, "#7a3a12", 0.5);
            if (mid || side) col = mix(col, autumn ? "#f0c070" : "#9ac060", 0.5);
            return lit(col, c.n, 0.3);
          },
        },
      );
      // A leaf stem.
      k.add(
        k.tube(
          spline([
            [0.05, -0.5, -0.25],
            [0.02, -0.6, -0.05],
            [0.0, -0.62, 0.1],
          ]),
          0.015,
          { samples: 12, grid: 6 },
        ),
        {
          color: autumn ? "#8a5a22" : "#4f7a2a",
        },
      );
      acorn([-0.28, -0.08, 0.2], [0, 0, 18], 0.95);
      acorn([0.34, -0.22, 0.28], [0, 40, -35], 0.8);
    },
  },

  succulent: {
    options: [
      {
        key: "tint",
        label: "Tips",
        type: "color",
        default: "#d8607a",
      },
    ],
    build(k, o) {
      const rand = k.rand;
      // A terracotta pot with a rim, and gravel on top.
      k.add(
        k.lathe([
          [0.27, -0.5],
          [0.3, -0.47],
          [0.36, -0.16],
          [0.38, -0.1],
          [0.43, -0.1],
          [0.44, 0.0],
          [0.41, 0.02],
          [0.38, 0.0],
        ]),
        {
          flat: 0.25,
          color: (c) => {
            const g = c.fbm(c.p[0] * 10, c.p[1] * 10, c.p[2] * 10);
            const rim = c.p[1] > -0.13;
            const col = mix("#b85a32", "#d8804a", 0.5 + 0.4 * g);
            return lit(rim ? shade(col, 1.08) : col, c.n, 0.45);
          },
        },
      );
      k.add(k.disc(0.39), {
        pos: [0, -0.02, 0],
        color: (c) =>
          c.n[1] < 0
            ? "#6a3a20"
            : mix("#d8d0c0", "#8a8478", c.noise(c.p[0] * 60, 0, c.p[2] * 60) * 0.5 + 0.5),
      });
      // The rosette: thick pointed leaves on a golden-angle spiral, flat
      // outside and cupped upright in the middle.
      const leafShape = (L, W) =>
        k.param(
          (u, v) => {
            const a = u * TAU;
            const w = W * Math.sin(Math.PI * Math.pow(Math.min(v, 0.999), 0.62)) ** 0.7;
            const t = w * 0.42;
            const y = Math.sin(a) * t + (Math.sin(a) > 0 ? -0.35 * t : 0) + 0.12 * L * v * v;
            return [Math.cos(a) * w, y, L * v];
          },
          { grid: 18 },
        );
      const NL = 52;
      for (let i = 0; i < NL; i++) {
        const f = i / (NL - 1);
        const th = i * GOLDEN;
        const L = 0.6 * (1 - 0.7 * f);
        const W = 0.17 * (1 - 0.5 * f);
        const e = 8 + 72 * Math.pow(f, 0.8);
        const tone = 0.9 + 0.15 * rand();
        k.add(leafShape(L, W), {
          pos: [0, 0.02 + 0.12 * f, 0],
          rot: [-e, (th * 180) / Math.PI, 0],
          flat: 0.25,
          color: (c) => {
            let col = mix("#3f7468", "#6fa08c", smoothstep(0.05, 0.75, c.v));
            col = mix(col, "#a8c8b8", 0.2 * smoothstep(0.3, 1, Math.sin(c.u * TAU)));
            col = mix(col, o.tint, smoothstep(0.72, 1, c.v) * 0.9);
            return lit(shade(col, tone * (0.72 + 0.28 * (1 - f))), c.n, 0.35);
          },
        });
      }
    },
  },

  bamboo: {
    alive: true,
    build(k) {
      const rand = k.rand;
      const SW = sway(0.012, 0);
      const culms = [
        { x: 0, z: 0, h: 2.2, r: 0.055, lean: [0.05, 1, 0.02] },
        { x: -0.2, z: -0.12, h: 1.9, r: 0.05, lean: [-0.12, 1, -0.04] },
        { x: 0.2, z: -0.08, h: 2.05, r: 0.05, lean: [0.1, 1, -0.06] },
        { x: 0.1, z: 0.2, h: 1.55, r: 0.045, lean: [0.08, 1, 0.14] },
        { x: -0.14, z: 0.16, h: 1.35, r: 0.04, lean: [-0.1, 1, 0.12] },
      ];
      const leaves = [];
      for (const cm of culms) {
        const d = unit(cm.lean);
        const base = [cm.x, 0, cm.z];
        const at = (t) =>
          add(base, add(mul(d, cm.h * t), [0.04 * t * t * d[0], 0, 0.04 * t * t * d[2]]));
        const seg = 0.24;
        const nodes = Math.floor(cm.h / seg);
        k.add(
          k.tube(at, (t) => cm.r * (1 - 0.25 * t), { samples: 64, grid: 28, caps: true }),
          {
            flat: 0.3,
            ...SW,
            color: (c) => {
              const y = c.t * cm.h;
              const f = (y / seg) % 1;
              let col = mix(
                "#5a8a2a",
                "#9ab040",
                c.t * 0.6 + 0.2 * c.noise(c.p[0] * 20, c.p[1] * 3, c.p[2] * 20),
              );
              col = shade(col, 0.95 + 0.05 * Math.sin(c.u * TAU * 9));
              if (f < 0.035 || f > 0.985) col = mix(col, "#3a5a1a", 0.7);
              else if (f < 0.07) col = mix(col, "#d8d8a0", 0.5);
              return lit(col, c.n, 0.45);
            },
          },
        );
        // Twigs and leaves from the upper nodes.
        for (let n = Math.floor(nodes * 0.4); n < nodes; n++) {
          const t = (n * seg) / cm.h;
          const p = at(t);
          const tw = 1 + (rand() < 0.5 ? 1 : 0);
          for (let j = 0; j < tw; j++) {
            const a = rand() * TAU;
            const dir = unit([Math.sin(a), 0.9, Math.cos(a)]);
            const L = 0.15 + 0.2 * rand() * (1 - t * 0.3);
            const end = add(p, mul(dir, L));
            k.add(
              k.tube(spline([p, add(p, mul(dir, L * 0.5)), end]), 0.006, { samples: 8, grid: 5 }),
              {
                ...SW,
                color: "#6a8a2a",
              },
            );
            const nl = 3 + Math.floor(rand() * 3);
            for (let m = 0; m < nl; m++) {
              const b = a + (m - nl / 2) * 0.8 + (rand() - 0.5) * 0.4;
              const ld = unit([Math.sin(b), -0.35 - 0.4 * rand(), Math.cos(b)]);
              leaves.push({ p: end, d: ld, L: 0.18 + 0.08 * rand(), W: 0.022, tone: rand() });
            }
          }
        }
      }
      k.cloud({ share: 0.38, size: 0.8, flat: 0.25 }, (r) => {
        const lf = leaves[Math.floor(r() * leaves.length)];
        const u = r();
        const side = unit(cross(lf.d, [0, 1, 0]));
        const w = lf.W * Math.sin(Math.PI * Math.pow(u, 0.7)) * (r() - 0.5) * 2;
        const droop = -0.08 * u * u;
        const p = add(add(add(lf.p, mul(lf.d, lf.L * u)), mul(side, w)), [0, droop, 0]);
        const nrm = unit(cross(side, lf.d));
        const tone = clamp(
          0.3 + 0.35 * lf.tone + 0.2 * u + 0.2 * dot(nrm, LIGHT) * (nrm[1] < 0 ? -1 : 1),
          0,
          1,
        );
        return {
          p,
          n: nrm[1] < 0 ? mul(nrm, -1) : nrm,
          color: ramp(["#2f5a1a", "#4a7f26", "#6fa532", "#a4c850"], tone),
          ...SW,
        };
      });
      grassMound(k, 0.6, 0, {
        h: 0.05,
        colors: ["#4a5a2a", "#6a7a3a", "#8a8a4a"],
        blades: 0.015,
        bladeLen: 0.1,
      });
      for (let i = 0; i < 6; i++) {
        const a = rand() * TAU;
        const s = 0.04 + rand() * 0.04;
        k.add(k.ellipsoid(s * 1.3, s * 0.6, s), {
          pos: [Math.sin(a) * 0.45, 0.02, Math.cos(a) * 0.45],
          rot: [0, rand() * 180, 0],
          color: (c) => lit(mix("#7a7468", "#aaa498", c.rand() * 0.5), c.n, 0.4),
        });
      }
    },
  },

  rocks: {
    options: [
      {
        key: "style",
        label: "Style",
        type: "select",
        default: "pile",
        choices: [
          { id: "pile", label: "Pebble pile" },
          { id: "cairn", label: "Cairn" },
        ],
      },
      SEED,
    ],
    build(k, o) {
      reseed(k, o);
      const rand = k.rand;
      const kinds = [
        { base: "#8a8a86", dark: "#5a5a58", speck: 0.2, vein: 0.1 },
        { base: "#b8a48a", dark: "#8a7458", speck: 0.1, vein: 0 },
        { base: "#9a5a44", dark: "#6a3a2a", speck: 0.05, vein: 0.05 },
        { base: "#6f7a86", dark: "#46505a", speck: 0.1, vein: 0.15 },
        { base: "#d8d2c6", dark: "#a8a296", speck: 0.3, vein: 0 },
        { base: "#4a4a4a", dark: "#2a2a2a", speck: 0.05, vein: 0.3 },
      ];
      const stone = (pos, size, rot, kind) => {
        const kd = kinds[kind % kinds.length];
        const va = randDir(rand);
        k.add(k.sphere(1), {
          pos,
          rot,
          scale: size,
          flat: 0.2,
          interior: 0.1,
          core: shade(kd.base, 0.8),
          color: (c) => {
            const n = c.fbm(c.lp[0] * 2.5, c.lp[1] * 2.5, c.lp[2] * 2.5);
            let col = mix(kd.base, kd.dark, 0.5 + 0.6 * n);
            if (c.noise(c.lp[0] * 40, c.lp[1] * 40, c.lp[2] * 40) > 0.62 - kd.speck)
              col = mix(col, "#2a2a28", 0.5);
            if (kd.vein && Math.abs(Math.sin(dot(c.lp, va) * 9 + n * 3)) < kd.vein * 0.3)
              col = mix(col, "#f2eee6", 0.8);
            const hi = Math.pow(Math.max(0, dot(c.n, unit([-0.4, 0.7, 0.6]))), 14);
            return mix(lit(col, c.n, 0.5), "#ffffff", 0.18 * hi);
          },
        });
      };
      if (o.style === "cairn") {
        let y = 0;
        const n = 7;
        for (let i = 0; i < n; i++) {
          const f = i / (n - 1);
          const w = 0.5 * (1 - 0.6 * f) * (0.9 + 0.2 * rand());
          const h = 0.1 + 0.04 * rand();
          stone(
            [(rand() - 0.5) * 0.08, y + h, (rand() - 0.5) * 0.08],
            [w, h, w * (0.75 + 0.2 * rand())],
            [(rand() - 0.5) * 8, rand() * 180, (rand() - 0.5) * 8],
            i + 1,
          );
          y += h * 1.85;
        }
        for (let i = 0; i < 12; i++) {
          const a = rand() * TAU;
          const rr = 0.45 + rand() * 0.35;
          const s = 0.05 + rand() * 0.07;
          stone(
            [Math.sin(a) * rr, s * 0.5, Math.cos(a) * rr],
            [s * 1.3, s * 0.7, s],
            [0, rand() * 180, 0],
            Math.floor(rand() * 6),
          );
        }
        return;
      }
      // A heap: big pebbles below, smaller ones resting higher.
      const placed = [];
      const heap = (x, z) => 0.78 * Math.max(0, 1 - (x * x + z * z) / 0.6);
      for (let i = 0; i < 34; i++) {
        let best = null;
        for (let t = 0; t < 30; t++) {
          const a = rand() * TAU;
          const rr = Math.sqrt(rand()) * 0.8;
          const x = Math.sin(a) * rr;
          const z = Math.cos(a) * rr;
          const s = (0.12 + 0.14 * rand()) * (1 - 0.4 * (i / 34));
          let ok = true;
          for (const q of placed) {
            if (
              Math.hypot(q.x - x, q.z - z) < (q.s + s) * 0.9 &&
              Math.abs(q.y - heap(x, z)) < (q.s + s) * 0.7
            )
              ok = false;
          }
          if (ok) {
            best = { x, z, s, y: heap(x, z) };
            break;
          }
        }
        if (!best) continue;
        placed.push(best);
        stone(
          [best.x, best.y + best.s * 0.45, best.z],
          [best.s * 1.25, best.s * 0.7, best.s],
          [(rand() - 0.5) * 30, rand() * 180, (rand() - 0.5) * 30],
          Math.floor(rand() * 6),
        );
      }
      k.add(k.disc(1.05), {
        pos: [0, 0.005, 0],
        color: (c) =>
          c.n[1] < 0
            ? "#5a5244"
            : mix("#b8ab90", "#8a7e66", c.noise(c.p[0] * 50, 0, c.p[2] * 50) * 0.5 + 0.5),
      });
    },
  },

  kelp: {
    alive: true,
    build(k) {
      const rand = k.rand;
      const SW = sway(0.04, 0.05);
      // Sandy sea floor with rocks.
      grassMound(k, 0.85, 0, {
        h: 0.06,
        colors: ["#b8a070", "#d0bc8c", "#e2d4aa"],
        soil: "#7a6444",
      });
      for (let i = 0; i < 7; i++) {
        const a = rand() * TAU;
        const s = 0.07 + rand() * 0.08;
        k.add(k.ellipsoid(s * 1.3, s * 0.7, s), {
          pos: [Math.sin(a) * (0.25 + rand() * 0.45), 0.04, Math.cos(a) * (0.25 + rand() * 0.45)],
          rot: [0, rand() * 180, 0],
          color: (c) => {
            const alga = c.n[1] > 0.3 && c.noise(c.p[0] * 25, c.p[1] * 25, c.p[2] * 25) > 0;
            return lit(alga ? "#b0508a" : mix("#5a5650", "#7a766e", c.rand()), c.n, 0.4);
          },
        });
      }
      const amber = ["#22220e", "#3a3a16", "#56521e", "#766c28", "#968834", "#b4a44a"];
      const current = unit([0.8, 1, 0.2]);
      const stipes = [
        { x: 0, z: 0, h: 2.35 },
        { x: -0.16, z: -0.08, h: 2.05 },
        { x: 0.15, z: -0.12, h: 2.15 },
        { x: 0.06, z: 0.16, h: 1.75 },
        { x: -0.12, z: 0.14, h: 1.55 },
        { x: 0.22, z: 0.1, h: 1.35 },
        { x: -0.24, z: 0.02, h: 1.2 },
      ];
      const blades = [];
      for (const st of stipes) {
        const lean = [current[0] * 0.35, 0, current[2] * 0.35];
        const pts = [];
        for (let i = 0; i <= 6; i++) {
          const t = i / 6;
          pts.push([
            st.x + lean[0] * t * t * st.h + 0.035 * Math.sin(t * 8 + st.x * 10),
            0.05 + st.h * t,
            st.z + lean[2] * t * t * st.h + 0.035 * Math.cos(t * 7 + st.z * 10),
          ]);
        }
        const stem = spline(pts);
        k.add(
          k.tube(stem, (t) => 0.014 * (1 - 0.4 * t), { samples: 48, grid: 8 }),
          {
            ...SW,
            color: (c) => lit(amber[2], c.n, 0.3),
          },
        );
        // Holdfast roots.
        for (let r = 0; r < 5; r++) {
          const a = rand() * TAU;
          const b = [st.x, 0.05, st.z];
          const root = spline([
            add(b, [0, 0.06, 0]),
            add(b, [Math.sin(a) * 0.05, 0.02, Math.cos(a) * 0.05]),
            add(b, [Math.sin(a) * 0.11, -0.01, Math.cos(a) * 0.11]),
          ]);
          k.add(k.tube(root, 0.011, { samples: 8, grid: 6 }), { color: amber[1] });
        }
        // Blades along the stipe, each on a gas float, streaming with the
        // current; a spray of them at the top floats in the canopy.
        const nb = Math.floor(st.h / 0.2);
        for (let j = 1; j <= nb; j++) {
          const t = Math.min(1, j / nb);
          const p = stem(t);
          const a = j * 2.4 + rand();
          const out = [Math.sin(a), 0, Math.cos(a)];
          const dir = unit(add(add(mul(out, 0.7), mul(current, 1.1)), [0, 0.2 * t, 0]));
          blades.push({
            p: add(p, mul(out, 0.018)),
            dir,
            L: 0.45 + 0.3 * rand(),
            W: 0.09 + 0.04 * rand(),
          });
          k.add(k.ellipsoid(0.02, 0.028, 0.02), {
            pos: add(p, mul(out, 0.018)),
            weight: 2,
            ...SW,
            color: (c) => lit(amber[4], c.n, 0.4),
          });
        }
      }
      for (const b of blades) {
        const side = unit(vec.cross(b.dir, [0, 1, 0]));
        const nrm = unit(vec.cross(side, b.dir));
        const shape = k.param(
          (u, v) => {
            const x = (u - 0.5) * 2;
            const w = b.W * Math.sin(Math.PI * Math.pow(Math.min(v, 1), 0.55)) ** 0.7;
            const ruffle = 0.018 * Math.sin(v * 26 + x * 2.5) * Math.abs(x) ** 1.5;
            const off = ruffle - 0.12 * b.L * v * v;
            return [
              b.p[0] + side[0] * x * w + b.dir[0] * v * b.L + nrm[0] * off,
              b.p[1] + side[1] * x * w + b.dir[1] * v * b.L + nrm[1] * off,
              b.p[2] + side[2] * x * w + b.dir[2] * v * b.L + nrm[2] * off,
            ];
          },
          { grid: 14 },
        );
        k.add(shape, {
          opacity: 0.9,
          flat: 0.2,
          ...SW,
          color: (c) => {
            const mid = Math.abs(c.u - 0.5) < 0.05;
            const edge = Math.abs(c.u - 0.5) * 2;
            const tone = clamp(
              0.3 + 0.45 * c.v + 0.2 * edge + 0.1 * c.rand() - (mid ? 0.2 : 0),
              0,
              1,
            );
            return lit(ramp(amber, tone), c.n, 0.25);
          },
        });
      }
      // Two bright fish nosing about, and bubbles drifting up.
      for (let f = 0; f < 2; f++) {
        const a = f * 2.8 + 0.4;
        const rr = 0.62 - f * 0.12;
        const p = [Math.sin(a) * rr, 0.9 + f * 0.55, Math.cos(a) * rr];
        const q = quatFromTo([1, 0, 0], [Math.cos(a), 0, -Math.sin(a)]);
        const fish = { kind: "orbit", params: [0.35, 0], pattern: false, weight: 3 };
        k.add(k.ellipsoid(0.07, 0.045, 0.025), {
          pos: p,
          quat: q,
          ...fish,
          color: (c) =>
            c.lp[0] > 0.05 && Math.abs(c.lp[1]) < 0.01 ? "#1a1a1a" : lit("#ff7a1a", c.n, 0.3),
        });
        k.add(k.ellipsoid(0.028, 0.035, 0.008), {
          pos: add(p, quatRotate(q, [-0.08, 0, 0])),
          quat: q,
          ...fish,
          color: "#f06010",
        });
      }
      k.cloud({ share: 0.004, size: 1.1, pattern: false }, (r) => ({
        p: [(r() - 0.5) * 0.5, 0.2 + r() * 0.5, (r() - 0.5) * 0.5],
        color: "#e8f6ff",
        opacity: 0.5,
        kind: "rise",
        params: [1.3, r()],
      }));
    },
  },

  pine: {
    alive: true,
    options: [{ key: "snow", label: "Snow", type: "switch", default: false }],
    build(k, o) {
      const H = 2.3;
      const base = 0.08;
      const SW = sway(0.006, 0);
      // The trunk, visible under the lowest tier.
      k.add(k.cone(0.09, 0.02, H * 0.9, { caps: false }), {
        pos: [0, H * 0.45, 0],
        flat: 0.3,
        ...SW,
        color: barkColor("#5a3b28", "#2a1a10", { furrows: 9 }),
      });
      addRoots(k, 5, 0.06, 0, barkColor("#5a3b28", "#2a1a10"));
      grassMound(k, 0.72, -0.02, {
        h: 0.08,
        snow: o.snow ? 1 : 0,
        colors: ["#46602a", "#5e7a33", "#7a8f44"],
      });
      // Tiers of drooping branches: radius shrinks towards the top.
      const tiers = [];
      const T = 8;
      for (let i = 0; i < T; i++) {
        const f = i / (T - 1);
        tiers.push({
          y: base + 0.35 + f * (H - 0.62),
          R: 0.78 * (1 - f) ** 1.05 + 0.09,
          drop: 0.3 * (1 - f) + 0.1,
          nb: Math.round(9 - 3 * f) + 2,
          phase: k.rand() * TAU,
        });
      }
      const cum = [];
      let tot = 0;
      for (const t of tiers) cum.push((tot += t.R * t.R + 0.02));
      const needles = ["#10301c", "#1a4527", "#285f33", "#3c7a3f", "#6a9a55"];
      k.cloud({ share: 0.7, size: 1.05, flat: 0.25 }, (rand) => {
        const x = rand() * tot;
        let i = 0;
        while (cum[i] < x) i++;
        const t = tiers[i];
        // A branch: pick one of nb spokes, then a point along it.
        const b = Math.floor(rand() * t.nb);
        const a0 = t.phase + (b / t.nb) * TAU;
        const s = Math.sqrt(rand());
        const a = a0 + (rand() - 0.5) * (0.55 + 0.2 * s) * (TAU / t.nb) * 1.6;
        const r = s * t.R * (0.96 + 0.08 * Math.sin(a * 7));
        const sag = t.drop * s * s;
        const layer = (rand() - 0.5) * 0.09 * (1 - 0.4 * s);
        const p = [Math.sin(a) * r, t.y + 0.1 * (1 - s) - sag + layer, Math.cos(a) * r];
        const outward = [Math.sin(a), 0.5 - s, Math.cos(a)];
        const up = layer > 0 ? 1 : 0;
        const light = dot(unit([Math.sin(a), 0.6, Math.cos(a)]), LIGHT);
        let v = 0.25 + 0.3 * s + 0.3 * light + 0.35 * (layer / 0.09) + 0.1 * (rand() - 0.5);
        v += 0.12 * ((t.y - base) / H);
        let col = ramp(needles, clamp(v, 0, 1));
        let keepIt = false;
        if (o.snow && up && s > 0.25 && rand() < 0.75) {
          col = mix("#dfe8f2", "#ffffff", rand());
          keepIt = true;
        }
        return {
          p,
          dir: add(mul(outward, 1), [
            (rand() - 0.5) * 0.8,
            (rand() - 0.5) * 0.8,
            (rand() - 0.5) * 0.8,
          ]),
          stretch: keepIt ? 1.2 : 2.2,
          color: col,
          pattern: keepIt ? false : undefined,
          ...SW,
        };
      });
      // A leader at the very top.
      k.add(k.cone(0.03, 0.001, 0.22, { caps: false }), {
        pos: [0, H - 0.05, 0],
        ...SW,
        color: needles[2],
      });
      if (o.snow) {
        k.cloud({ share: 0.01, size: 0.5, pattern: false }, (rand) => ({
          p: [(rand() - 0.5) * 1.6, 0.4 + rand() * 2.2, (rand() - 0.5) * 1.6],
          color: "#ffffff",
          opacity: 0.9,
          kind: "fall",
          params: [0.9, rand()],
        }));
      }
    },
  },
};
