// Playthings: classic toys to poke, spin, roll, twist and pop. Generic
// designs only (no brands). Parts carry the play: tap a toy to roll the
// dice, swing the cradle, twist the cube or pop the balloon dog.
// Loaded on demand.

import {
  mix,
  shade,
  smoothstep,
  clamp,
  spline,
  quatAxisAngle,
  quatMul,
  quatFromTo,
  quatRotate,
} from "../kit.js";

const TAU = Math.PI * 2;
const add = (a, b) => [a[0] + b[0], a[1] + b[1], a[2] + b[2]];
const sub = (a, b) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
const mul = (a, s) => [a[0] * s, a[1] * s, a[2] * s];
const dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
const cross = (a, b) => [
  a[1] * b[2] - a[2] * b[1],
  a[2] * b[0] - a[0] * b[2],
  a[0] * b[1] - a[1] * b[0],
];
const len = (a) => Math.hypot(a[0], a[1], a[2]);
const unit = (a) => mul(a, 1 / (len(a) || 1));
const keep = (c, size) => ({ c, keep: true, size });
const easeInOut = (x) => (x < 0.5 ? 4 * x * x * x : 1 - Math.pow(-2 * x + 2, 3) / 2);
const easeOut = (x) => 1 - Math.pow(1 - clamp(x, 0, 1), 3);
const bump = (x) => (x <= 0 || x >= 1 ? 0 : Math.sin(Math.PI * x));
const band = (x, a, b) => clamp((x - a) / (b - a), 0, 1);
const rotY = (p, a) => [
  p[0] * Math.cos(a) + p[2] * Math.sin(a),
  p[1],
  -p[0] * Math.sin(a) + p[2] * Math.cos(a),
];

// Baked light: a key light from above, front and right, plus a soft sheen.
const LIGHT = unit([0.4, 0.85, 0.55]);
const VIEW = unit([0.5, 0.35, 0.8]);
const HALF = unit(add(LIGHT, VIEW));
function lit(col, n, { amb = 0.62, dif = 0.45, spec = 0.25, pow = 28 } = {}) {
  const d = Math.max(0, dot(n, LIGHT));
  let c = shade(col, amb + dif * d);
  if (spec > 0) c = mix(c, [1, 1, 1], spec * Math.pow(Math.max(0, dot(n, HALF)), pow));
  return c;
}

function hsv(h, s, v) {
  const f = (n) => {
    const k = (n + h * 6) % 6;
    return v - v * s * Math.max(0, Math.min(k, 4 - k, 1));
  };
  return [f(5), f(3), f(1)];
}

const luminance = (c) => {
  const x = mix(c, c, 0);
  return 0.299 * x[0] + 0.587 * x[1] + 0.114 * x[2];
};

// Per-toy memory for drive(): keyed by the control state object, which is
// new each time a toy loads.
const MEM = new WeakMap();
function mem(c) {
  let m = MEM.get(c);
  if (!m) MEM.set(c, (m = {}));
  return m;
}
// True on the frame a pulse control fires.
function fired(m, key, v) {
  const was = m["p_" + key] ?? 0;
  m["p_" + key] = v;
  return v > was + 0.02;
}
// Integrates a rate over the toy's clock (so speed changes never jump).
function integrate(m, key, t, rate) {
  const last = m["t_" + key];
  m["t_" + key] = t;
  const dt = last === undefined ? 0 : clamp(t - last, 0, 0.25);
  m[key] = (m[key] ?? 0) + dt * rate;
  return m[key];
}

function nlerpQ(a, b, t) {
  const s = dot4(a, b) < 0 ? -1 : 1;
  const q = [0, 1, 2, 3].map((i) => a[i] * (1 - t) + b[i] * s * t);
  const l = Math.hypot(q[0], q[1], q[2], q[3]) || 1;
  return q.map((v) => v / l);
}
const dot4 = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2] + a[3] * b[3];

// A small integer hash for choosing things per roll.
function hashInt(n) {
  n = n ^ 61 ^ (n >>> 16);
  n = (n + (n << 3)) | 0;
  n ^= n >>> 4;
  n = Math.imul(n, 0x27d4eb2d);
  n ^= n >>> 15;
  return n >>> 0;
}

// The kite leans a little to one side; its line runs from the bridle (just in
// front of the spars' crossing) down to the flyer.
const KITE = (() => {
  const a = -0.28;
  const tilt = (p) => [
    p[0] * Math.cos(a) - p[1] * Math.sin(a),
    p[0] * Math.sin(a) + p[1] * Math.cos(a),
    p[2],
  ];
  return { tilt, bridle: tilt([0, 0.1, 0.1]), flyer: [0.85, -1.05, 0.3] };
})();

// ---- Custom shapes ------------------------------------------------------------

// A flat triangle, sampled evenly.
function triShape(a, b, c) {
  const cr = cross(sub(b, a), sub(c, a));
  const n = unit(cr);
  return {
    area: 0.5 * len(cr),
    thick: 0.02,
    // Two random numbers per point, so even: true spreads points evenly.
    dims: 2,
    sample(rand) {
      const r1 = Math.sqrt(rand());
      const r2 = rand();
      const wa = 1 - r1;
      const wb = r1 * (1 - r2);
      const wc = r1 * r2;
      return {
        p: [
          a[0] * wa + b[0] * wb + c[0] * wc,
          a[1] * wa + b[1] * wb + c[1] * wc,
          a[2] * wa + b[2] * wb + c[2] * wc,
        ],
        n,
        u: wb,
        v: wc,
        bary: [wa, wb, wc],
      };
    },
  };
}

// Pushes samples out along the normal a little: fur and fuzz.
function fuzz(shape, amount) {
  return {
    area: shape.area,
    thick: shape.thick,
    sample(rand) {
      const s = shape.sample(rand);
      s.p = add(s.p, mul(s.n, amount * rand() * rand()));
      return s;
    },
  };
}

// A box with rounded edges (a small box grown by radius r), sampled evenly:
// flat faces carry `face` (0..5 for +X, -X, +Y, -Y, +Z, -Z) like k.box,
// rounded edges and corners carry face -1. `bottom: false` leaves out the
// flat underside (for things standing on the floor).
function roundBox(sx, sy, sz, r, { bottom = true } = {}) {
  const h = [sx / 2 - r, sy / 2 - r, sz / 2 - r];
  const L = [h[0] * 2, h[1] * 2, h[2] * 2];
  const parts = [];
  const faceN = [
    [1, 0, 0],
    [-1, 0, 0],
    [0, 1, 0],
    [0, -1, 0],
    [0, 0, 1],
    [0, 0, -1],
  ];
  faceN.forEach((n, f) => {
    if (!bottom && f === 3) return;
    const ax = f >> 1;
    const a1 = (ax + 1) % 3;
    const a2 = (ax + 2) % 3;
    parts.push({ area: L[a1] * L[a2], kind: "face", f, n, ax, a1, a2 });
  });
  for (let ax = 0; ax < 3; ax++) {
    const a1 = (ax + 1) % 3;
    const a2 = (ax + 2) % 3;
    for (const s1 of [-1, 1])
      for (const s2 of [-1, 1])
        parts.push({ area: (Math.PI / 2) * r * L[ax], kind: "edge", ax, a1, a2, s1, s2 });
  }
  for (const sx1 of [-1, 1])
    for (const sy1 of [-1, 1])
      for (const sz1 of [-1, 1])
        parts.push({ area: (Math.PI / 2) * r * r, kind: "corner", sg: [sx1, sy1, sz1] });
  let total = 0;
  for (const q of parts) q.cum = total += q.area;
  return {
    area: total,
    thick: Math.min(sx, sy, sz) / 2,
    sample(rand) {
      const x = rand() * total;
      let q = parts[parts.length - 1];
      for (const it of parts)
        if (x < it.cum) {
          q = it;
          break;
        }
      const p = [0, 0, 0];
      let n;
      if (q.kind === "face") {
        const u = rand();
        const v = rand();
        p[q.ax] = q.n[q.ax] * (h[q.ax] + r);
        p[q.a1] = (u - 0.5) * L[q.a1];
        p[q.a2] = (v - 0.5) * L[q.a2];
        return { p, n: q.n, u, v, face: q.f };
      }
      if (q.kind === "edge") {
        const a = rand() * (Math.PI / 2);
        n = [0, 0, 0];
        n[q.a1] = q.s1 * Math.cos(a);
        n[q.a2] = q.s2 * Math.sin(a);
        p[q.ax] = (rand() - 0.5) * L[q.ax];
        p[q.a1] = q.s1 * h[q.a1] + n[q.a1] * r;
        p[q.a2] = q.s2 * h[q.a2] + n[q.a2] * r;
        return { p, n, u: 0, v: 0, face: -1 };
      }
      const d = [0, 1, 2].map(() => rand() * 2 - 1);
      let dn = Math.hypot(d[0], d[1], d[2]);
      while (dn < 1e-3 || dn > 1) {
        for (let i = 0; i < 3; i++) d[i] = rand() * 2 - 1;
        dn = Math.hypot(d[0], d[1], d[2]);
      }
      n = [0, 1, 2].map((i) => (Math.abs(d[i]) / dn) * q.sg[i]);
      for (let i = 0; i < 3; i++) p[i] = q.sg[i] * h[i] + n[i] * r;
      return { p, n, u: 0, v: 0, face: -1 };
    },
  };
}

// Signed distances for smooth, one-piece bodies.
function sdEll(p, c, r) {
  const x = (p[0] - c[0]) / r[0];
  const y = (p[1] - c[1]) / r[1];
  const z = (p[2] - c[2]) / r[2];
  return (Math.hypot(x, y, z) - 1) * Math.min(r[0], r[1], r[2]);
}
function smin(a, b, k) {
  const h = clamp(0.5 + (0.5 * (b - a)) / k, 0, 1);
  return b + (a - b) * h - k * h * (1 - h);
}

// The outside of an implicit body f(p) < 0 as seen from `origin`: a table
// of distances along directions (first exit) and normals from f, looked up
// per splat so f is only evaluated while building the table.
function implicitShape(k, f, { origin = [0, 0, 0], far = 2, res = 64, grid = 80 } = {}) {
  const nt = res;
  const np = res * 2;
  const W = np + 1;
  const table = new Float32Array((nt + 1) * W);
  const normals = new Float32Array((nt + 1) * W * 3);
  const steps = 44;
  const step = far / steps;
  const e = 0.003;
  const q = [0, 0, 0];
  const F = (x, y, z) => {
    q[0] = x;
    q[1] = y;
    q[2] = z;
    return f(q);
  };
  for (let i = 0; i <= nt; i++) {
    const th = (i / nt) * Math.PI;
    for (let j = 0; j <= np; j++) {
      const ph = (j / np) * TAU;
      const dx = Math.sin(th) * Math.sin(ph);
      const dy = Math.cos(th);
      const dz = Math.sin(th) * Math.cos(ph);
      const at = (s) => F(origin[0] + dx * s, origin[1] + dy * s, origin[2] + dz * s);
      let lo = 0;
      let hi = far;
      for (let s = step; s <= far; s += step) {
        if (at(s) > 0) {
          hi = s;
          break;
        }
        lo = s;
      }
      for (let b = 0; b < 12; b++) {
        const mid = (lo + hi) / 2;
        if (at(mid) < 0) lo = mid;
        else hi = mid;
      }
      const r = (lo + hi) / 2;
      const o = i * W + j;
      table[o] = r;
      const x = origin[0] + dx * r;
      const y = origin[1] + dy * r;
      const z = origin[2] + dz * r;
      const n = unit([
        F(x + e, y, z) - F(x - e, y, z),
        F(x, y + e, z) - F(x, y - e, z),
        F(x, y, z + e) - F(x, y, z - e),
      ]);
      normals[o * 3] = n[0];
      normals[o * 3 + 1] = n[1];
      normals[o * 3 + 2] = n[2];
    }
  }
  const cell = (u, v) => {
    const x = clamp(u, 0, 1) * np;
    const y = clamp(v, 0, 1) * nt;
    const j = Math.min(np - 1, Math.floor(x));
    const i = Math.min(nt - 1, Math.floor(y));
    return [i * W + j, x - j, y - i];
  };
  const lerp4 = (arr, o, fx, fy, stride = 1, k0 = 0) => {
    const a = arr[o * stride + k0] * (1 - fx) + arr[(o + 1) * stride + k0] * fx;
    const b = arr[(o + W) * stride + k0] * (1 - fx) + arr[(o + W + 1) * stride + k0] * fx;
    return a * (1 - fy) + b * fy;
  };
  return k.param(
    (u, v) => {
      const th = v * Math.PI;
      const ph = u * TAU;
      const [o, fx, fy] = cell(u, v);
      const r = lerp4(table, o, fx, fy);
      return [
        origin[0] + Math.sin(th) * Math.sin(ph) * r,
        origin[1] + Math.cos(th) * r,
        origin[2] + Math.sin(th) * Math.cos(ph) * r,
      ];
    },
    {
      grid,
      thick: far * 0.4,
      normal: (u, v) => {
        const [o, fx, fy] = cell(u, v);
        return [
          lerp4(normals, o, fx, fy, 3, 0),
          lerp4(normals, o, fx, fy, 3, 1),
          lerp4(normals, o, fx, fy, 3, 2),
        ];
      },
    },
  );
}

// A blocky stroke font for numbers: segments in a 1 x 2 box.
const GLYPHS = {
  0: [
    [0, 0, 1, 0],
    [1, 0, 1, 2],
    [1, 2, 0, 2],
    [0, 2, 0, 0],
  ],
  1: [
    [0.55, 0, 0.55, 2],
    [0.2, 1.65, 0.55, 2],
  ],
  2: [
    [0, 2, 1, 2],
    [1, 2, 1, 1],
    [1, 1, 0, 1],
    [0, 1, 0, 0],
    [0, 0, 1, 0],
  ],
  3: [
    [0, 2, 1, 2],
    [1, 2, 1, 0],
    [1, 0, 0, 0],
    [0.25, 1, 1, 1],
  ],
  4: [
    [0, 2, 0, 1],
    [0, 1, 1, 1],
    [1, 2, 1, 0],
  ],
  5: [
    [1, 2, 0, 2],
    [0, 2, 0, 1],
    [0, 1, 1, 1],
    [1, 1, 1, 0],
    [1, 0, 0, 0],
  ],
  6: [
    [1, 2, 0, 2],
    [0, 2, 0, 0],
    [0, 0, 1, 0],
    [1, 0, 1, 1],
    [1, 1, 0, 1],
  ],
  7: [
    [0, 2, 1, 2],
    [1, 2, 0.4, 0],
  ],
  8: [
    [0, 0, 1, 0],
    [1, 0, 1, 2],
    [1, 2, 0, 2],
    [0, 2, 0, 0],
    [0, 1, 1, 1],
  ],
  9: [
    [1, 1, 0, 1],
    [0, 1, 0, 2],
    [0, 2, 1, 2],
    [1, 2, 1, 0],
    [1, 0, 0, 0],
  ],
};
function segDist(x, y, s) {
  const dx = s[2] - s[0];
  const dy = s[3] - s[1];
  const t = clamp(((x - s[0]) * dx + (y - s[1]) * dy) / (dx * dx + dy * dy || 1), 0, 1);
  return Math.hypot(x - s[0] - dx * t, y - s[1] - dy * t);
}
// Distance from (x, y) to a string drawn centred at the origin, 2 units
// tall; `underline` marks a 6 or a 9.
function textDist(str, x, y, underline = false) {
  const adv = 1.55;
  const w = (str.length - 1) * adv + 1;
  let best = Infinity;
  for (let i = 0; i < str.length; i++) {
    const gx = x + w / 2 - i * adv;
    const gy = y + 1;
    if (gx < -0.6 || gx > 1.6) continue;
    for (const s of GLYPHS[str[i]] || []) best = Math.min(best, segDist(gx, gy, s));
  }
  if (underline) best = Math.min(best, segDist(x + w / 2, y + 1, [0, -0.5, w, -0.5]));
  return best;
}

// ---- Building bricks --------------------------------------------------------------

const BRICK_COLOURS = {
  classic: ["#d6262f", "#1d5fc4", "#f5c318", "#23a04a", "#f3f1ea", "#f2771a", "#2fa4de"],
  pastel: ["#f49ac1", "#8fd3f4", "#fbe38e", "#a8e6a3", "#c9b6f2", "#ffc49b", "#f7f4ef"],
  rainbow: ["#e63946", "#f4a261", "#ffd23f", "#3bb273", "#3a86ff", "#8338ec", "#ff5fa2"],
  ocean: ["#0b3c5d", "#1d7ea8", "#5bc0be", "#b8e1dd", "#f6f5ae", "#328cc1", "#f5f5f0"],
};
// ---- Building bricks -----------------------------------------------------------------
// Units are studs; a brick is BRICK_H tall. Kinds are [studs along x, studs
// along z] as the brick lies unturned.
const BRICK_H = 1.2;
const BRICK_KINDS = { A: [4, 2], B: [2, 2], C: [4, 1], D: [2, 1] };
// Where each brick lies at rest: poured out round the table in two loose
// rings, long bricks pointing outwards.
const BRICKS = (() => {
  const kinds = "AABBDABCABBDAABDDC";
  return [...kinds].map((kind, i) => {
    const t = (i + 0.3 * Math.sin(i * 2.7)) / kinds.length;
    const ang = t * TAU;
    // An ellipse, wider than deep like the models, kept clear of them.
    const r = (i % 2) * 1.3;
    return {
      kind,
      colour: (i * 3) % 7,
      x: (6.6 + r) * Math.sin(ang),
      z: (5 + r) * Math.cos(ang),
      yaw: (ang * 180) / Math.PI + 90 + 14 * Math.sin(i * 5.1),
    };
  });
})();
// The models: each brick's slot as [kind, centre x, centre z, layer, turned]
// (turned: a quarter turn, so a 4x2 runs along z). Built in this order.
const MODELS = [
  {
    name: "tower",
    slots: [
      ["A", 0, -1, 0], ["A", 0, 1, 0],
      ["A", -1, 0, 1, 1], ["A", 1, 0, 1, 1],
      ["A", 0, -1, 2], ["A", 0, 1, 2],
      ["B", -1, -1, 3], ["B", 1, -1, 3], ["B", -1, 1, 3], ["B", 1, 1, 3],
      ["B", -1, -1, 4], ["B", 1, 1, 4], ["D", 1.5, -1, 4, 1], ["D", -1.5, 1, 4, 1],
    ],
  },
  {
    name: "bridge",
    slots: [
      ["B", -3, 0, 0], ["B", 3, 0, 0], ["B", -3, 0, 1], ["B", 3, 0, 1], ["B", -3, 0, 2], ["B", 3, 0, 2],
      ["A", -2, 0, 3], ["A", 2, 0, 3],
      ["A", 0, 0, 4], ["D", -3, -0.5, 4], ["D", -3, 0.5, 4], ["D", 3, -0.5, 4], ["D", 3, 0.5, 4],
      ["C", -2, -0.5, 5], ["C", 2, -0.5, 5],
    ],
  },
  {
    name: "stairs",
    slots: [
      ["A", -3, 0, 0, 1], ["A", -1, 0, 0, 1], ["A", 1, 0, 0, 1], ["A", 3, 0, 0, 1],
      ["B", -1, -1, 1], ["B", -1, 1, 1], ["A", 1, 0, 1, 1], ["A", 3, 0, 1, 1],
      ["B", 1, -1, 2], ["B", 1, 1, 2], ["B", 3, -1, 2], ["B", 3, 1, 2],
      ["C", 2.5, 0, 3, 1], ["C", 3.5, 0, 3, 1],
    ],
  },
  {
    name: "dog",
    slots: [
      ["D", -1.5, 0, 0, 1], ["D", 1.5, 0, 0, 1],
      ["A", 0, 0, 1],
      ["B", 1, 0, 2], ["D", -2, 0.5, 2],
      ["A", 2, 0, 3], ["D", 0.5, 0, 4, 1],
    ],
  },
  {
    name: "tree",
    slots: [
      ["B", 0, 0, 0], ["B", 0, 0, 1], ["B", 0, 0, 2],
      ["A", 0, -1, 3], ["A", 0, 1, 3],
      ["A", -1, 0, 4, 1], ["A", 1, 0, 4, 1],
      ["B", 0, 0, 5],
    ],
  },
]; // prettier-ignore
// A tap's timing: the old model pops apart, then the bricks fly in one at a
// time, each taking FLY seconds.
const BUILD = { secs: 5, pop: 0.9, fly: 0.45 };
const bricks = { at: null, seq: null, model: -1 };
// A brick's place: its centre and yaw (degrees).
const brickHome = (i) => ({ p: [BRICKS[i].x, BRICK_H / 2, BRICKS[i].z], yaw: BRICKS[i].yaw });
function slotPlace(slot, i) {
  const [, x, z, layer, turned] = slot;
  // Of the two ways a brick fits a slot, the one nearer its own yaw.
  let yaw = turned ? 90 : 0;
  const d = ((((BRICKS[i].yaw - yaw) % 180) + 270) % 180) - 90;
  yaw = BRICKS[i].yaw - d;
  return { p: [x, (layer + 0.5) * BRICK_H, z], yaw };
}
// Gives each slot of a model a free brick of its kind, shuffled by seed.
function assignBricks(model, seed) {
  const at = BRICKS.map(() => null);
  const order = BRICKS.map((_, i) => i).sort((a, b) => hashInt(seed * 31 + a) - hashInt(seed * 31 + b)); // prettier-ignore
  const seq = [];
  for (const slot of MODELS[model].slots) {
    const i = order.find((j) => at[j] === null && BRICKS[j].kind === slot[0]);
    if (i === undefined) continue;
    at[i] = slotPlace(slot, i);
    seq.push(i);
  }
  return { at, seq };
}
function brickPose(i, place) {
  const h = brickHome(i);
  const q = quatAxisAngle([0, 1, 0], ((place.yaw - h.yaw) * Math.PI) / 180);
  return { base: h.p, offset: sub(place.p, h.p), quat: q };
}
// A brick's place part way u (0-1) along a hop from a to b.
function brickHop(a, b, u, height) {
  const e = easeInOut(u);
  const p = add(a.p, mul(sub(b.p, a.p), e));
  p[1] += height * Math.sin(Math.PI * u);
  return { p, yaw: a.yaw + (b.yaw - a.yaw) * e };
}
function bricksDrive(c, out, info) {
  const m = mem(c);
  if (!m.bricks) {
    m.bricks = true;
    Object.assign(bricks, { at: BRICKS.map(() => null), seq: null, model: -1 });
  }
  if (fired(m, "snap", c.snap)) {
    // A different model from the last one.
    const seed = hashInt((info.tap?.n ?? 1) * 977 + Math.floor(info.time * 1000));
    let model = seed % MODELS.length;
    if (model === bricks.model) model = (model + 1 + (seed >> 8) % (MODELS.length - 1)) % MODELS.length; // prettier-ignore
    const next = assignBricks(model, seed);
    bricks.seq = { from: bricks.at, to: next.at, order: next.seq, clicks: 0, popped: false };
    bricks.at = next.at;
    bricks.model = model;
  }
  const s = bricks.seq;
  const e = s && c.snap > 0 ? (1 - c.snap) * BUILD.secs : null;
  if (s && e === null) bricks.seq = null;
  const step = s ? (BUILD.secs - BUILD.pop - BUILD.fly - 0.2) / Math.max(1, s.order.length - 1) : 0;
  out.tokens = BRICKS.map((_, i) => {
    const home = brickHome(i);
    if (e === null) return brickPose(i, bricks.at[i] || home);
    const from = s.from[i];
    const to = s.to[i];
    // Popping apart: bricks of the old model hop back to the table.
    if (e < BUILD.pop) {
      if (!from) return brickPose(i, home);
      const u = band(e, 0.05 * (from.p[1] / BRICK_H), BUILD.pop);
      return brickPose(i, brickHop(from, home, u, 2.5));
    }
    if (!to) return brickPose(i, home);
    const k = s.order.indexOf(i);
    const u = band(e, BUILD.pop + k * step, BUILD.pop + k * step + BUILD.fly);
    return brickPose(i, brickHop(home, to, u, 2 + 0.6 * to.p[1]));
  });
  if (e !== null) {
    if (!s.popped && e >= BUILD.pop * 0.8 && s.from.some(Boolean)) {
      s.popped = true;
      out.cues.push({ voice: "clatter", vol: 0.6 });
    }
    // A click as each brick lands.
    while (s.clicks < s.order.length && e >= BUILD.pop + s.clicks * step + BUILD.fly) {
      s.clicks++;
      out.cues.push({ voice: "click", f: 2100 + 90 * (s.clicks % 4), decay: 1.3, vol: 0.9 });
      out.resort = true;
    }
    if (!s.sorted && e >= BUILD.pop) {
      // The old model is back on the table: sort the bricks where they lie.
      s.sorted = true;
      out.resort = true;
    }
  }
}

// ---- Dice ----------------------------------------------------------------------------

const D6_FACES = [
  { n: [1, 0, 0], v: 3 },
  { n: [-1, 0, 0], v: 4 },
  { n: [0, 1, 0], v: 1 },
  { n: [0, -1, 0], v: 6 },
  { n: [0, 0, 1], v: 2 },
  { n: [0, 0, -1], v: 5 },
];
const PQ = 0.26;
const PIPS = {
  1: [[0, 0]],
  2: [
    [-PQ, PQ],
    [PQ, -PQ],
  ],
  3: [
    [-PQ, PQ],
    [0, 0],
    [PQ, -PQ],
  ],
  4: [
    [-PQ, PQ],
    [PQ, PQ],
    [-PQ, -PQ],
    [PQ, -PQ],
  ],
  5: [
    [-PQ, PQ],
    [PQ, PQ],
    [0, 0],
    [-PQ, -PQ],
    [PQ, -PQ],
  ],
  6: [
    [-PQ, PQ],
    [-PQ, 0],
    [-PQ, -PQ],
    [PQ, PQ],
    [PQ, 0],
    [PQ, -PQ],
  ],
};

function icosahedron() {
  const P = (1 + Math.sqrt(5)) / 2;
  const raw = [];
  for (const a of [-1, 1])
    for (const b of [-1, 1]) raw.push([0, a, b * P], [a, b * P, 0], [b * P, 0, a]);
  const verts = raw.map(unit);
  const faces = [];
  let minEdge = Infinity;
  for (let i = 0; i < 12; i++)
    for (let j = i + 1; j < 12; j++) minEdge = Math.min(minEdge, len(sub(verts[i], verts[j])));
  const near = (i, j) => Math.abs(len(sub(verts[i], verts[j])) - minEdge) < 1e-6;
  for (let i = 0; i < 12; i++)
    for (let j = i + 1; j < 12; j++)
      for (let l = j + 1; l < 12; l++) {
        if (!near(i, j) || !near(j, l) || !near(i, l)) continue;
        let tri = [verts[i], verts[j], verts[l]];
        const g = mul(add(add(tri[0], tri[1]), tri[2]), 1 / 3);
        if (dot(cross(sub(tri[1], tri[0]), sub(tri[2], tri[0])), g) < 0)
          tri = [tri[0], tri[2], tri[1]];
        faces.push({ tri, g, n: unit(g) });
      }
  // Numbers: opposite faces add up to 21.
  const used = new Set();
  let next = 1;
  const order = faces
    .map((f, i) => ({ f, i, key: f.n[1] * 3 + f.n[0] + f.n[2] * 0.1 }))
    .sort((a, b) => b.key - a.key);
  for (const { f, i } of order) {
    if (used.has(i)) continue;
    const j = faces.findIndex((o) => dot(o.n, f.n) < -0.999);
    f.num = 21 - next;
    faces[j].num = next;
    used.add(i);
    used.add(j);
    next++;
  }
  return faces;
}

const ICO = icosahedron();
const YAWS = [0.35, 1.95, 3.5, 5.05];
// Resting orientations: each face up, at a few turns.
const D6_TARGETS = [];
for (const f of D6_FACES)
  for (const yaw of YAWS)
    D6_TARGETS.push(quatMul(quatAxisAngle([0, 1, 0], yaw), quatFromTo(f.n, [0, 1, 0])));
const D20_TARGETS = [];
for (const f of ICO)
  for (const yaw of YAWS)
    D20_TARGETS.push(quatMul(quatAxisAngle([0, 1, 0], yaw), quatFromTo(f.n, [0, 1, 0])));
const D6_REST = [
  quatMul(quatAxisAngle([0, 1, 0], 0.4), quatFromTo([0, 0, -1], [0, 1, 0])),
  quatMul(quatAxisAngle([0, 1, 0], -0.3), quatFromTo([1, 0, 0], [0, 1, 0])),
];
const D20_REST = quatMul(
  quatAxisAngle([0, 1, 0], 0.5),
  quatFromTo(ICO.find((f) => f.num === 20).n, [0, 1, 0]),
);

// A chrome finish: the environment (bright sky, dark horizon, warm floor)
// seen in the reflection of the view.
function chrome(n) {
  const d = dot(n, VIEW);
  const r = sub(mul(n, 2 * d), VIEW);
  const y = r[1];
  let c =
    y > 0
      ? mix("#9aa3ad", "#f7f9fc", Math.pow(y, 0.5))
      : mix("#6d5a48", "#2e2723", Math.pow(-y, 0.6));
  c = mix(c, "#262a31", 0.75 * smoothstep(0.22, 0, Math.abs(y + 0.04)));
  return mix(c, [1, 1, 1], Math.pow(Math.max(0, dot(n, HALF)), 60));
}

// Soap film: thin-film colours that swirl over the surface.
function film(p, n, c) {
  const sw = c.fbm(p[0] * 3 + 5, p[1] * 3, p[2] * 3, 3);
  const hue = (0.55 + 0.8 * sw + 0.35 * n[1] + 1) % 1;
  const rim = 1 - Math.abs(dot(n, VIEW));
  return mix([1, 1, 1], hsv(hue, 0.55, 1), 0.35 + 0.5 * rim);
}

const YO = { top: 1.0, rest: 0.62, max: 1.1, K: 8 };
YO.seg = YO.max / YO.K;

const SLINKY = { N: 15, R: 0.36, r: 0.028, d: 0.62 };

// Soap bubbles drift from the wand towards the top right.
const WAND = { c: [-0.6, -0.42, 0.1], n: unit([0.55, 0.65, 0.5]), r: 0.2 };
const BUBBLES = [0.22, 0.12, 0.17, 0.08, 0.26, 0.1, 0.15, 0.2, 0.07, 0.13].map((r, i) => {
  const b = {
    r,
    i,
    s0: (i + 0.5) / 10,
    speed: 0.8 + ((i * 37) % 10) * 0.05,
    end: [
      0.55 + 0.35 * Math.sin(i * 2.3),
      0.95 + 0.15 * Math.cos(i * 1.7),
      -0.1 + 0.3 * Math.sin(i * 1.3),
    ],
  };
  b.rest = bubbleAt(b, b.s0);
  return b;
});
function bubbleAt(b, s) {
  const a = add(WAND.c, mul(WAND.n, 0.18));
  const e = s * s * (3 - 2 * s) * 0.4 + s * 0.6;
  return [
    a[0] + (b.end[0] - a[0]) * e + 0.08 * Math.sin(s * 7 + b.i),
    a[1] + (b.end[1] - a[1]) * e + 0.05 * Math.sin(s * 5 + 2 * b.i),
    a[2] + (b.end[2] - a[2]) * e + 0.1 * Math.sin(s * 4 + b.i),
  ];
}

// Directions the balloon scraps fly when it pops.
const BURST = [
  [1, 0.4, 0.2],
  [-1, 0.5, -0.1],
  [0.2, 1, 0.5],
  [-0.3, 0.8, -0.7],
  [0.6, 0.2, -0.9],
  [-0.5, 0.1, 0.9],
].map(unit);

// ---- Recipes ----------------------------------------------------------------------------

// Newton's cradle: how far the end ball is lifted (radians), how long the
// lift takes and when it is let go, the pendulum's period, the swing kept
// at each strike, and how long a tap plays.
const CRADLE = { amp: 0.8, lift: 0.35, release: 0.55, period: 1.3, loss: 0.84, secs: 9 };
const cradle = { hits: 0, grab: null, free: null };
const CRADLE_TOP = 1.0; // where the strings hang from
const CRADLE_Y = 0.2; // the balls' centres at rest
const cradleX = (i) => (i - 2) * 0.3;
// The ball a point is on (or -1).
function cradleBall(p) {
  if (Math.abs(p[1] - CRADLE_Y) > 0.24) return -1;
  const k = clamp(Math.round(p[0] / 0.3 + 2), 0, 4);
  return Math.abs(p[0] - cradleX(k)) < 0.22 ? k : -1;
}
// The pointer's angle about ball k's pivot (0 straight down, + to the right).
const cradlePointer = (k, p) => Math.atan2(p[0] - cradleX(k), CRADLE_TOP - p[1]);
// The balls' angles `s` seconds after m balls were let go from one side at
// angle amp: a quarter swing to the first strike, then half swings, the m
// balls at the far end flying out and back each time, a little lower. A
// clack at each strike; the middle balls twitch with the knock. `e` is the
// time the swing dies away by (it fades over its last two seconds).
function cradleSwing(s, m, left, amp0, out, e = s) {
  const { period, loss } = CRADLE;
  const a = [0, 0, 0, 0, 0];
  const near = (i) => (left ? i < m : i > 4 - m);
  const far = (i) => (left ? i > 4 - m : i < m);
  const dir = left ? -1 : 1;
  const first = period / 4;
  let knock = 0;
  if (s < first) {
    const v = dir * amp0 * Math.cos(((s / first) * Math.PI) / 2);
    for (let i = 0; i < 5; i++) if (near(i)) a[i] = v;
  } else {
    const n = Math.floor((s - first) / (period / 2));
    const f = (s - first - (n * period) / 2) / (period / 2);
    const fade = 1 - Math.min(1, Math.max(0, (e - CRADLE.secs + 2) / 2));
    const amp = amp0 * Math.pow(loss, n + 1) * fade;
    const swing = amp * Math.sin(Math.PI * f);
    // Even half swings: the far balls fly out; odd ones: the near balls.
    for (let i = 0; i < 5; i++) {
      if (n % 2 === 0 && far(i)) a[i] = -dir * swing;
      else if (n % 2 === 1 && near(i)) a[i] = dir * swing;
    }
    knock = Math.exp(-f * 18) * amp;
    const hits = n + 1;
    if (cradle.hits < hits && amp > 0.03) {
      cradle.hits = hits;
      out.cues.push({ voice: "clack", f: 2600, decay: 0.9, vol: Math.min(1, 0.35 + amp * (0.8 + 0.2 * m)) }); // prettier-ignore
    }
  }
  // The knock travels through the balls that stay put.
  for (let i = 0; i < 5; i++) if (!near(i) && !far(i)) a[i] = 0.012 * knock * Math.sin(i * 2.1);
  return a;
}

// ---- Puzzle cube -----------------------------------------------------------------
// The cube is 3 units wide, centred on the origin: 26 cubies, each a token
// turned about the centre by its own quaternion. A turn is { axis (0-2),
// layer (-1, 0 or 1), q (quarter turns, +1 or -1 about the axis) }.

const CUBE_TAP = 4; // seconds a scramble or a solve takes
const CUBE_SNAP = 0.16; // seconds a let-go layer takes to snap into place
// Sticker colours by face (+x, -x, +y, -y, +z, -z).
const CUBE_COLOURS = ["#c41e3a", "#ff6d1f", "#f6f6f1", "#ffd21a", "#0aa04f", "#1b4fc4"];
const CUBIES = [];
for (let x = -1; x <= 1; x++)
  for (let y = -1; y <= 1; y++)
    for (let z = -1; z <= 1; z++) if (x || y || z) CUBIES.push([x, y, z]);
const AXES = [
  [1, 0, 0],
  [0, 1, 0],
  [0, 0, 1],
];
const cube = { c: null };
function cubeReset() {
  Object.assign(cube, {
    q: CUBIES.map(() => [0, 0, 0, 1]),
    pos: CUBIES.map((h) => h.slice()),
    history: [], // turns made since solved, simplified as they come
    seq: null, // a tap's turns: { turns, done }
    live: null, // the layer under the finger: { axis, layer, angle }
    drag: null,
    snap: null, // a let-go layer easing into place: { axis, layer, from, to, at }
    cheer: -100, // when it was last solved by hand
    cues: [],
  });
}
cubeReset();
const cubeBusy = () => !!(cube.seq || cube.snap || cube.live) || cube.lastTime - cube.cheer < 1.2;
const roundV = (v) => v.map((x) => Math.round(x));
// The cubies in a layer.
const layerOf = (axis, layer) => CUBIES.map((_, i) => i).filter((i) => cube.pos[i][axis] === layer); // prettier-ignore
// Makes a turn for good (the state moves on by whole quarter turns).
function cubeApply(t, record = true) {
  const r = quatAxisAngle(AXES[t.axis], (t.q * Math.PI) / 2);
  for (const i of layerOf(t.axis, t.layer)) {
    cube.q[i] = quatMul(r, cube.q[i]);
    const l = Math.hypot(...cube.q[i]);
    cube.q[i] = cube.q[i].map((v) => v / l);
    cube.pos[i] = roundV(quatRotate(r, cube.pos[i]));
  }
  // Sort the cubies again where they now stand (splats sort in the pose
  // they were built in).
  cube.resort = true;
  if (!record) return;
  // The history keeps turns short: a turn undoing the last one cancels it,
  // and turns of the same layer add up (four make none).
  const h = cube.history;
  const last = h[h.length - 1];
  if (last && last.axis === t.axis && last.layer === t.layer) {
    last.q = ((((last.q + t.q) % 4) + 5) % 4) - 1; // -1, 0, 1 or 2
    if (last.q === 0) h.pop();
  } else h.push({ ...t });
}
// Solved when each face shows one colour (the whole cube may have turned).
function cubeSolved() {
  const seen = {};
  for (let i = 0; i < CUBIES.length; i++) {
    const home = CUBIES[i];
    for (let ax = 0; ax < 3; ax++) {
      if (!home[ax]) continue;
      const n = [0, 0, 0];
      n[ax] = home[ax];
      const now = roundV(quatRotate(cube.q[i], n)).join();
      const colour = ax * 2 + (home[ax] > 0 ? 0 : 1);
      if ((seen[now] ??= colour) !== colour) return false;
    }
  }
  return true;
}
// The face a point on the cube is on: its axis, side and normal.
function cubeFace(p) {
  let a = 0;
  for (let i = 1; i < 3; i++) if (Math.abs(p[i]) > Math.abs(p[a])) a = i;
  const s = p[a] < 0 ? -1 : 1;
  const n = [0, 0, 0];
  n[a] = s;
  return { a, s, n };
}
function cubeDragStart(p) {
  cube.drag = cubeBusy() ? null : { p0: p, ...cubeFace(p) };
}
// The finger's path across the face picks the row or column (whichever
// way it moves more), then turns it by the arc it has travelled.
function cubeDragMove(p) {
  const d = cube.drag;
  if (!d) return;
  const dv = sub(p, d.p0);
  if (!cube.live) {
    const [b1, b2] = [0, 1, 2].filter((i) => i !== d.a);
    const b = Math.abs(dv[b1]) >= Math.abs(dv[b2]) ? b1 : b2;
    if (Math.abs(dv[b]) < 0.2) return;
    const axis = 3 - d.a - b;
    // Which way round the axis moves the face's surface along +b.
    const k = cross(AXES[axis], d.n)[b];
    cube.live = { axis, b, k, layer: clamp(Math.round(d.p0[axis]), -1, 1), angle: 0 };
  }
  const L = cube.live;
  L.angle = clamp((dv[L.b] * L.k) / 1.5, -Math.PI, Math.PI);
}
function cubeDragEnd(time) {
  const L = cube.live;
  cube.drag = null;
  if (!L) return;
  cube.live = null;
  const to = Math.round(L.angle / (Math.PI / 2));
  cube.snap = { axis: L.axis, layer: L.layer, from: L.angle, to, at: time };
}
function cubeDrive(c, out, info) {
  const m = mem(c);
  if (!m.cube) {
    // A newly loaded cube starts solved.
    m.cube = true;
    cubeReset();
  }
  const now = info.time;
  cube.lastTime = now;
  const click = (vol = 1) => out.cues.push({ voice: "click", f: 1500 + 300 * Math.random(), decay: 1.4, vol }); // prettier-ignore
  // A tap: scramble a solved cube, or play its turns back to solved.
  if (fired(m, "twist", c.twist)) {
    if (cube.seq) for (const t of cube.seq.turns.slice(cube.seq.done)) cubeApply(t);
    cube.live = cube.drag = cube.snap = null;
    let turns;
    if (!cube.history.length || cubeSolved()) {
      cube.history = [];
      turns = [];
      let seed = (info.tap?.n ?? 1) * 7919 + Math.floor(now * 1000);
      while (turns.length < 14) {
        seed = hashInt(seed);
        const t = { axis: seed % 3, layer: ((seed >> 3) % 3) - 1, q: (seed >> 6) % 2 ? 1 : -1 };
        const last = turns[turns.length - 1];
        if (last && last.axis === t.axis && last.layer === t.layer) continue;
        turns.push(t);
      }
    } else {
      // Undo the history, split into quarter turns.
      turns = [];
      for (const h of cube.history.slice().reverse()) {
        const n = Math.abs(h.q);
        for (let j = 0; j < n; j++) turns.push({ axis: h.axis, layer: h.layer, q: -Math.sign(h.q) }); // prettier-ignore
      }
    }
    cube.seq = { turns, done: 0, solving: !!cube.history.length };
  }
  let anim = null;
  if (cube.seq) {
    const { turns } = cube.seq;
    const slot = c.twist > 0 ? (1 - c.twist) * turns.length : turns.length;
    while (cube.seq.done < Math.min(turns.length, Math.floor(slot))) {
      cubeApply(turns[cube.seq.done++], !cube.seq.solving);
      click(0.8);
    }
    if (cube.seq.done >= turns.length) {
      if (cube.seq.solving) cube.history = [];
      cube.seq = null;
    } else {
      const t = turns[cube.seq.done];
      anim = { axis: t.axis, layer: t.layer, angle: easeInOut(slot - cube.seq.done) * t.q * (Math.PI / 2) }; // prettier-ignore
    }
  } else if (cube.live) anim = cube.live;
  else if (cube.snap) {
    const s = cube.snap;
    const f = band(
      now - s.at,
      0,
      CUBE_SNAP * Math.max(0.5, Math.abs(s.to * (Math.PI / 2) - s.from)),
    );
    if (f >= 1 || now < s.at) {
      cube.snap = null;
      const q = ((s.to % 4) + 4) % 4;
      if (q) {
        cubeApply({ axis: s.axis, layer: s.layer, q: q === 3 ? -1 : q === 2 ? 2 : 1 });
        click();
        if (cubeSolved()) {
          cube.history = [];
          cube.cheer = now;
          out.cues.push({ voice: "ding", f: 1319, decay: 1, vol: 0.8, at: 0.1 });
        }
      }
    } else {
      anim = { axis: s.axis, layer: s.layer, angle: s.from + (s.to * (Math.PI / 2) - s.from) * easeOut(f) }; // prettier-ignore
    }
  }
  out.resort = !!cube.resort;
  cube.resort = false;
  const turning = anim ? new Set(layerOf(anim.axis, anim.layer)) : null;
  const r = anim ? quatAxisAngle(AXES[anim.axis], anim.angle) : null;
  out.tokens = CUBIES.map((_, i) => ({
    base: [0, 0, 0],
    quat: turning?.has(i) ? quatMul(r, cube.q[i]) : cube.q[i],
  }));
  // Solved by hand: a happy hop with a full spin.
  const e = now - cube.cheer;
  if (e >= 0 && e < 1.2) {
    const f = e / 1.2;
    out.body = { offset: [0, 0.18 * bump(f), 0], quat: quatAxisAngle([0, 1, 0], TAU * easeInOut(band(f, 0.05, 0.9))) }; // prettier-ignore
  }
}

export const RECIPES = {
  bricks: {
    // Eighteen bricks lie poured out round the table. A tap builds a random
    // model in the middle (a tower, a bridge, stairs, a dog or a tree),
    // brick by brick from the bottom up, each one clicking into place; the
    // next tap pops that model apart and builds another.
    options: [
      {
        key: "colors",
        label: "Colours",
        type: "select",
        default: "classic",
        choices: [
          { id: "classic", label: "Classic" },
          { id: "pastel", label: "Pastel" },
          { id: "rainbow", label: "Rainbow" },
          { id: "ocean", label: "Ocean" },
        ],
      },
    ],
    // More splats for eighteen small bricks and their studs.
    density: 1.5,
    controls: [{ key: "snap", label: "Build", type: "pulse", ease: BUILD.secs }],
    action: { key: "snap", label: "Build something" },
    drive(t, c, out, info) {
      bricksDrive(c, out, info);
    },
    build(k, o) {
      const pal = BRICK_COLOURS[o.colors] || BRICK_COLOURS.classic;
      const H = BRICK_H;
      BRICKS.forEach((b, i) => {
        const [w, d] = BRICK_KINDS[b.kind];
        const col = pal[b.colour % pal.length];
        const opts = { kind: "token", params: [i, 0], flat: 0.15, even: true };
        const yaw = (b.yaw * Math.PI) / 180;
        const centre = [b.x, H / 2, b.z];
        k.add(roundBox(w - 0.04, H - 0.02, d - 0.04, 0.05, { bottom: false }), {
          ...opts,
          pos: centre,
          rot: [0, b.yaw, 0],
          color: (c) => {
            const col2 = lit(col, c.n, { amb: 0.66, dif: 0.42, spec: 0.3, pow: 40 });
            return c.s.face < 0 ? mix(col2, "#ffffff", 0.08) : col2;
          },
        });
        for (let a = 0; a < w; a++)
          for (let e = 0; e < d; e++) {
            const local = [a - (w - 1) / 2, H / 2 + 0.09, e - (d - 1) / 2];
            k.add(k.cylinder(0.29, 0.18, { caps: "top" }), {
              ...opts,
              pos: add(centre, rotY(local, yaw)),
              weight: 1.4,
              color: (c) => {
                if (c.s.cap) {
                  const r = c.s.radial;
                  const ring = Math.abs(r - 0.62) < 0.08 ? 0.93 : 1;
                  return shade(lit(col, [0, 1, 0], { amb: 0.7, dif: 0.4, spec: 0.3 }), ring);
                }
                return lit(col, c.n, { amb: 0.6, dif: 0.45, spec: 0.35, pow: 20 });
              },
            });
          }
      });
      // Room above for the tallest model.
      k.reach([0, 6 * BRICK_H + 0.3, 0]);
    },
  },

  "rubber-duck": {
    alive: true,
    options: [{ key: "color", label: "Colour", type: "color", default: "#ffd21f" }],
    controls: [{ key: "squeak", label: "Squeak", type: "pulse", ease: 1.8 }],
    action: { key: "squeak", label: "Squeak" },
    drive(t, c, out) {
      // A squeeze and a hop in the first 0.9 s, then it bobs and settles.
      const e = (1 - c.squeak) * 1.8;
      const s = c.squeak > 0 ? clamp(1 - e / 0.9, 0, 1) : 0;
      const b = e > 0.5 && c.squeak > 0 ? Math.exp(-(e - 0.5) * 2.4) * Math.sin((e - 0.5) * 9) : 0;
      const q = quatMul(
        quatAxisAngle([1, 0, 0], 0.05 * Math.sin(t * 1.7) + 0.06 * b),
        quatAxisAngle([0, 0, 1], 0.04 * Math.sin(t * 1.3 + 1) + 0.12 * bump(1 - s) * s + 0.1 * b),
      );
      out.body = {
        offset: [0, 0.02 * Math.sin(t * 2.1) + 0.12 * bump((1 - s) * 1.6) + 0.02 * b, 0],
        quat: q,
        squash: 0.28 * Math.pow(s, 3),
      };
    },
    build(k, o) {
      const body = o.color;
      const warm = mix(body, "#e07b00", 0.45);
      const tailAx = unit([-Math.cos(0.7), Math.sin(0.7), 0]);
      const tailUp = [Math.sin(0.7), Math.cos(0.7), 0];
      const f = (p) => {
        let d = sdEll(p, [0, 0, 0], [0.62, 0.36, 0.46]);
        d = smin(d, sdEll(p, [0.22, 0.04, 0], [0.4, 0.34, 0.42]), 0.08);
        const q = sub(p, [-0.5, 0.16, 0]);
        const tl = sdEll([dot(q, tailAx), dot(q, tailUp), q[2]], [0, 0, 0], [0.27, 0.13, 0.17]);
        d = smin(d, tl, 0.12);
        d = smin(d, sdEll(p, [0.3, 0.56, 0], [0.29, 0.28, 0.28]), 0.12);
        return Math.max(d, -(p[1] + 0.27));
      };
      k.add(implicitShape(k, f, { origin: [0.1, 0.18, 0], far: 1.2 }), {
        flat: 0.2,
        interior: 0.08,
        core: shade(body, 0.85),
        color: (c) => {
          const n = c.n;
          let col = lit(body, n, { amb: 0.72, dif: 0.35, spec: 0.35, pow: 24 });
          col = mix(col, warm, 0.45 * smoothstep(0.1, -0.7, n[1]) + 0.12 * (1 - Math.abs(n[2])));
          return col;
        },
      });
      // Wings.
      for (const s of [-1, 1]) {
        k.add(k.ellipsoid(0.3, 0.15, 0.07), {
          pos: [-0.06, 0.1, s * 0.42],
          rot: [s * -8, s * 8, 12],
          flat: 0.2,
          color: (c) =>
            mix(
              lit(body, c.n, { amb: 0.7, dif: 0.35, spec: 0.3 }),
              warm,
              0.25 + 0.3 * (c.lp[1] < -0.05),
            ),
        });
      }
      // Bill.
      const bill = "#ff8a1c";
      k.add(k.ellipsoid(0.19, 0.06, 0.15), {
        pos: [0.58, 0.49, 0],
        rot: [0, 0, -6],
        flat: 0.2,
        weight: 1.5,
        pattern: false,
        color: (c) => lit(bill, c.n, { amb: 0.7, dif: 0.4, spec: 0.35 }),
      });
      k.add(k.ellipsoid(0.15, 0.04, 0.12), {
        pos: [0.55, 0.43, 0],
        rot: [0, 0, -4],
        flat: 0.2,
        weight: 1.5,
        pattern: false,
        color: (c) => lit(shade(bill, 0.85), c.n),
      });
      // Eyes.
      for (const s of [-1, 1]) {
        const dir = unit([0.55, 0.4, s * 0.62]);
        k.add(k.sphere(0.055), {
          pos: add([0.3, 0.56, 0], mul(dir, 0.265)),
          flat: 0.3,
          weight: 3,
          pattern: false,
          color: (c) => (dot(c.n, unit([0.4, 0.7, 0.6])) > 0.8 ? keep("#ffffff") : keep("#141414")),
        });
      }
    },
  },

  "spinning-top": {
    alive: true,
    options: [
      {
        key: "colors",
        label: "Colours",
        type: "select",
        default: "circus",
        choices: [
          { id: "circus", label: "Circus" },
          { id: "ocean", label: "Ocean" },
          { id: "candy", label: "Candy" },
        ],
      },
    ],
    controls: [{ key: "whip", label: "Spin", type: "pulse", ease: 3 }],
    action: { key: "whip", label: "Spin it" },
    drive(t, c, out) {
      const m = mem(c);
      const spin = integrate(m, "spin", t, 9 + 26 * c.whip);
      const prec = integrate(m, "prec", t, 1.4 + 1.5 * c.whip) + 0.6;
      const tilt = 0.16 + 0.1 * c.whip * (0.6 + 0.4 * Math.sin(t * 9));
      const axis = [Math.cos(prec), 0, Math.sin(prec)];
      out.parts.top = { quat: quatMul(quatAxisAngle(axis, tilt), quatAxisAngle([0, 1, 0], spin)) };
    },
    build(k, o) {
      const pals = {
        circus: ["#e63946", "#f1faee", "#1d70b8", "#ffc93c"],
        ocean: ["#0a9396", "#e9d8a6", "#005f73", "#94d2bd"],
        candy: ["#ff70a6", "#fff6fb", "#70d6ff", "#ffd670"],
      };
      const pal = pals[o.colors] || pals.circus;
      const top = k.part("top", { pivot: [0, 0, 0] });
      const body = k.lathe(
        [
          [0, 0],
          [0.035, 0.02],
          [0.14, 0.13],
          [0.33, 0.3],
          [0.52, 0.44],
          [0.63, 0.53],
          [0.62, 0.6],
          [0.5, 0.66],
          [0.26, 0.71],
          [0.08, 0.73],
          [0, 0.735],
        ],
        { grid: 96 },
      );
      k.add(body, {
        part: top,
        flat: 0.2,
        color: (c) => {
          const y = c.lp[1];
          const a = c.u;
          let col;
          if (y < 0.05) col = "#8a8f98";
          else if (y > 0.55) {
            // A star of rays on the shoulder.
            const r = Math.hypot(c.lp[0], c.lp[2]);
            const k8 = (a * 8 + r * 1.5) % 1;
            col = k8 < 0.5 ? pal[0] : pal[1];
            if (r < 0.14) col = pal[3];
          } else {
            // Spiral stripes on the cone.
            const sp = Math.floor((a * 6 + y * 3.2) % 1 < 0.5 ? 0 : 1);
            col = y > 0.44 && y < 0.54 ? pal[3] : sp ? pal[2] : pal[1];
          }
          return lit(col, c.n, { amb: 0.66, dif: 0.42, spec: 0.35, pow: 30 });
        },
      });
      // The rim ring.
      k.add(k.torus(0.62, 0.035), {
        pos: [0, 0.56, 0],
        part: top,
        flat: 0.2,
        weight: 1.5,
        color: (c) => lit(pal[3], c.n, { spec: 0.5 }),
      });
      // Handle and knob.
      k.add(k.cylinder(0.055, 0.34, { caps: false }), {
        pos: [0, 0.9, 0],
        part: top,
        flat: 0.2,
        weight: 1.5,
        color: (c) => lit("#b07a45", c.n, { spec: 0.3 }),
      });
      k.add(k.sphere(0.09), {
        pos: [0, 1.08, 0],
        part: top,
        flat: 0.2,
        weight: 1.6,
        color: (c) => lit(pal[0], c.n, { spec: 0.5 }),
      });
      // A soft shadow on the floor.
      k.cloud({ share: 0.012, size: 3.2, pattern: false }, (rand) => {
        const a = rand() * TAU;
        const r = 0.5 * Math.sqrt(rand());
        return {
          p: [Math.sin(a) * r, -0.005, Math.cos(a) * r],
          n: [0, 1, 0],
          color: "#3a332d",
          opacity: 0.12 * (1 - r / 0.5),
        };
      });
      k.reach([0.3, 1.1, 0.3]);
      k.reach([-0.3, 1.1, -0.3]);
    },
  },

  dice: {
    options: [
      {
        key: "kind",
        label: "Dice",
        type: "select",
        default: "d6",
        choices: [
          { id: "d6", label: "Two d6" },
          { id: "d20", label: "d20" },
        ],
      },
      { key: "color", label: "Colour", type: "color", default: "#c8262e" },
    ],
    controls: [{ key: "roll", label: "Roll", type: "pulse", ease: 1.8 }],
    action: { key: "roll", label: "Roll" },
    drive(t, c, out) {
      // Drives both kinds; only the parts that exist move.
      const m = mem(c);
      // Each die is modelled in its resting pose (splats sort best near the
      // modelled pose), so its part turns by target * rest^-1.
      const dice = [
        { name: "d6a", targets: D6_TARGETS, rest: D6_REST[0], h: 1.2, delay: 0 },
        { name: "d6b", targets: D6_TARGETS, rest: D6_REST[1], h: 1.0, delay: 0.07 },
        { name: "d20", targets: D20_TARGETS, rest: D20_REST, h: 1.3, delay: 0 },
      ];
      const rel = (q, rest) => quatMul(q, [-rest[0], -rest[1], -rest[2], rest[3]]);
      if (!m.cur) {
        m.rolls = 0;
        m.cur = dice.map((d) => d.rest);
        m.prev = m.cur;
      }
      if (fired(m, "roll", c.roll)) {
        m.rolls++;
        m.prev = m.cur;
        m.cur = dice.map((d, i) => d.targets[hashInt(m.rolls * 31 + i * 7 + 5) % d.targets.length]);
      }
      const p = 1 - c.roll;
      dice.forEach((d, i) => {
        if (c.roll <= 0) {
          out.parts[d.name] = { quat: rel(m.cur[i], d.rest) };
          return;
        }
        const pp = clamp((p - d.delay) / (1 - d.delay), 0, 1);
        const e = easeOut(clamp(pp / 0.78, 0, 1));
        const ax = unit([Math.sin(m.rolls * 2.1 + i), 0.5, Math.cos(m.rolls * 1.3 + i * 2)]);
        const q = quatMul(quatAxisAngle(ax, (1 - e) * TAU * 2), nlerpQ(m.prev[i], m.cur[i], e));
        const hop = (a, b, hh) =>
          pp > a && pp < b ? hh * 4 * ((pp - a) / (b - a)) * (1 - (pp - a) / (b - a)) : 0;
        const y = hop(0, 0.42, d.h) + hop(0.42, 0.66, d.h * 0.22) + hop(0.66, 0.8, d.h * 0.06);
        out.parts[d.name] = { quat: rel(q, d.rest), offset: [0, y, 0] };
      });
    },
    build(k, o) {
      const body = o.color;
      const dark = luminance(body) < 0.5;
      const ink = dark ? "#fbfaf5" : "#18181c";
      if (o.kind === "d20") {
        const die = k.part("d20", { pivot: [0, 0, 0] });
        const inv = [-D20_REST[0], -D20_REST[1], -D20_REST[2], D20_REST[3]];
        for (const f of ICO) {
          const [A, B, C] = f.tri;
          // Of the three corners, point the number at the one that is most
          // "up" (or furthest from the viewer on the top face) at rest.
          const nw = quatRotate(D20_REST, f.n);
          let want = nw[1] > 0.9 ? [0, 0, -1] : [0, 1, 0];
          want = quatRotate(inv, want);
          let up = unit(sub(A, f.g));
          for (const V of [B, C]) {
            const d = unit(sub(V, f.g));
            if (dot(d, want) > dot(up, want)) up = d;
          }
          const right = cross(up, f.n);
          const label = String(f.num);
          const under = f.num === 6 || f.num === 9;
          const s = 0.1;
          k.add(triShape(A, B, C), {
            quat: D20_REST,
            part: die,
            flat: 0.15,
            interior: 0.06,
            core: shade(body, 0.6),
            color: (c) => {
              const m = Math.min(c.s.bary[0], c.s.bary[1], c.s.bary[2]);
              const rel = sub(c.lp, f.g);
              const x = dot(rel, right) / s;
              const y = dot(rel, up) / s + 0.15;
              let col = lit(body, c.n, { amb: 0.58, dif: 0.52, spec: 0.45, pow: 16 });
              if (m < 0.02) return shade(col, 0.7);
              if (m < 0.05) col = mix(col, "#ffffff", 0.12);
              if (Math.abs(x) < 2.6 && Math.abs(y) < 1.8 && textDist(label, x, y, under) < 0.22)
                return keep(ink);
              return col;
            },
          });
        }
        // Room for any face to be up.
        for (const d of [
          [1, 0, 0],
          [-1, 0, 0],
          [0, 1, 0],
          [0, -1, 0],
          [0, 0, 1],
          [0, 0, -1],
        ])
          k.reach(d);
        return;
      }
      const pipR = 0.085;
      const places = [
        [-0.64, 0, 0.18],
        [0.66, 0, -0.22],
      ];
      places.forEach((pos, i) => {
        const die = k.part(i ? "d6b" : "d6a", { pivot: pos });
        k.add(roundBox(1, 1, 1, 0.13), {
          pos,
          quat: D6_REST[i],
          part: die,
          flat: 0.15,
          interior: 0.06,
          core: shade(body, 0.7),
          color: (c) => {
            const [x, y, z] = c.lp;
            const n = c.ln;
            const ax =
              Math.abs(n[0]) > Math.abs(n[1])
                ? Math.abs(n[0]) > Math.abs(n[2])
                  ? 0
                  : 2
                : Math.abs(n[1]) > Math.abs(n[2])
                  ? 1
                  : 2;
            const sg = n[ax] > 0 ? 1 : -1;
            const face = D6_FACES.find((fc) => fc.n[ax] === sg);
            const a = ax === 0 ? -sg * z : ax === 1 ? x : sg * x;
            const b = ax === 1 ? -sg * z : y;
            const col = lit(body, c.n, { amb: 0.62, dif: 0.45, spec: 0.35, pow: 22 });
            const r = pipR * (face.v === 1 ? 1.45 : 1);
            for (const [pa, pb] of PIPS[face.v]) {
              const d = Math.hypot(a - pa, b - pb);
              if (d < r) return keep(shade(ink, 0.75 + 0.3 * (d / r)));
            }
            return col;
          },
        });
        k.reach([pos[0], 0.8, pos[2]]);
        k.reach([pos[0], -0.8, pos[2]]);
      });
    },
  },
  "newtons-cradle": {
    // A tap lifts the end ball and lets it go: it strikes the row, the far
    // ball flies out and falls back, and so on, each strike a clack and a
    // little lower, the middle balls twitching as the knock passes through.
    // Or drag a ball out to the side (the balls beside it come along) and
    // let go: as many balls fly out the other side as were let go.
    alive: () => !!(cradle.grab || cradle.free),
    controls: [{ key: "swing", label: "Swing", type: "pulse", ease: CRADLE.secs }],
    action: { key: "swing", label: "Lift and let go" },
    note: "Drag a ball out to the side and let go.",
    drag: {
      at: (p) => cradleBall(p) >= 0,
      plane: [0, 0, 1],
      start(p) {
        const k = cradleBall(p);
        cradle.grab = { k, a0: cradlePointer(k, p), angle: 0 };
      },
      move(p) {
        const g = cradle.grab;
        if (!g) return;
        g.angle = clamp(cradlePointer(g.k, p) - g.a0, -1.1, 1.1);
      },
      end(time) {
        const g = cradle.grab;
        cradle.grab = null;
        if (!g || Math.abs(g.angle) < 0.06) return;
        const left = g.angle < 0;
        cradle.free = { m: left ? g.k + 1 : 5 - g.k, left, amp: Math.abs(g.angle), at: time };
        cradle.hits = 0;
      },
    },
    drive(t, c, out, info) {
      const m = mem(c);
      if (!m.cradle) {
        m.cradle = true;
        cradle.grab = cradle.free = null;
      }
      // A tap takes over from a swing that was let go by hand.
      if (fired(m, "swing", c.swing)) cradle.free = null;
      let a = [0, 0, 0, 0, 0];
      if (cradle.grab) {
        const { k, angle } = cradle.grab;
        for (let i = 0; i < 5; i++) if (angle < 0 ? i <= k : i >= k) a[i] = angle;
      } else if (cradle.free) {
        const f = cradle.free;
        const e = info.time - f.at;
        if (e < 0 || e > CRADLE.secs) cradle.free = null;
        else a = cradleSwing(e, f.m, f.left, f.amp, out);
      } else {
        const e = c.swing > 0 ? (1 - c.swing) * CRADLE.secs : -1;
        if (e < 0) {
          cradle.hits = 0;
          return;
        }
        // Lifted out on its strings and held a moment, then let go.
        const { lift, release } = CRADLE;
        if (e < release) a[0] = -CRADLE.amp * Math.sin((Math.PI / 2) * Math.min(1, e / lift)) ** 2;
        else a = cradleSwing(e - release, 1, true, CRADLE.amp, out, e);
      }
      for (let i = 0; i < 5; i++) out.parts["ball" + i] = { angle: a[i] };
    },
    build(k) {
      const rb = 0.15;
      const top = 1.0;
      const yc = 0.2;
      const zR = 0.36;
      const yb = -0.16;
      const wood = "#5b3a24";
      // Base.
      k.add(roundBox(2.1, 0.13, 0.98, 0.04, { bottom: false }), {
        opacity: 1,
        jitter: 0.015,
        pos: [0, yb - 0.065, 0],
        flat: 0.2,
        color: (c) => {
          const g = c.fbm(c.p[0] * 2, c.p[1] * 30, c.p[2] * 22);
          const col = mix(wood, "#3a2415", 0.5 + 0.4 * g);
          return lit(col, c.n, { amb: 0.7, dif: 0.4, spec: 0.3, pow: 30 });
        },
      });
      // The frame: two chrome arches.
      for (const z of [-zR, zR]) {
        const path = spline([
          [-0.95, yb, z],
          [-0.95, top - 0.2, z],
          [-0.92, top - 0.06, z],
          [-0.82, top, z],
          [0, top, z],
          [0.82, top, z],
          [0.92, top - 0.06, z],
          [0.95, top - 0.2, z],
          [0.95, yb, z],
        ]);
        k.add(k.tube(path, 0.024, { samples: 400 }), {
          opacity: 1,
          jitter: 0.015,
          flat: 0.2,
          weight: 1.5,
          color: (c) => chrome(c.n),
        });
        for (const x of [-0.95, 0.95])
          k.add(k.cylinder(0.05, 0.03, { caps: "top" }), {
            even: true,
            opacity: 1,
            jitter: 0.015,
            pos: [x, yb + 0.015, z],
            flat: 0.2,
            weight: 2,
            color: (c) => chrome(c.n),
          });
      }
      // Balls on strings.
      for (let i = 0; i < 5; i++) {
        const x = (i - 2) * rb * 2;
        const part = k.part("ball" + i, { pivot: [x, top, 0], axis: [0, 0, 1] });
        k.add(k.sphere(rb), {
          even: true,
          opacity: 1,
          jitter: 0.015,
          pos: [x, yc, 0],
          part,
          flat: 0.2,
          interior: 0.08,
          core: "#6b6f75",
          color: (c) => chrome(c.n),
        });
        k.add(k.cylinder(0.025, 0.03, { caps: "top" }), {
          even: true,
          opacity: 1,
          jitter: 0.015,
          pos: [x, yc + rb + 0.005, 0],
          part,
          flat: 0.2,
          weight: 3,
          color: (c) => chrome(c.n),
        });
        for (const z of [-zR, zR]) {
          const a = [x, yc + rb + 0.02, 0];
          const b = [x, top, z];
          k.add(
            k.tube(
              (t) => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t],
              0.005,
              {
                samples: 16,
                grid: 16,
              },
            ),
            {
              opacity: 1,
              jitter: 0.015,
              part,
              share: 0.004,
              size: 0.7,
              flat: 0.5,
              pattern: false,
              color: "#e9e6de",
            },
          );
        }
      }
    },
  },

  "teddy-bear": {
    alive: true,
    options: [{ key: "color", label: "Fur", type: "color", default: "#b5793f" }],
    controls: [{ key: "wave", label: "Wave", type: "pulse", ease: 2.2 }],
    action: { key: "wave", label: "Wave hello" },
    drive(t, c, out) {
      const w = c.wave;
      const p = 1 - w;
      const raise = w > 0 ? smoothstep(0, 0.15, p) * (1 - smoothstep(0.8, 1, p)) : 0;
      out.parts.armR = { angle: 0.05 * Math.sin(t * 1.3) + raise * (2.1 + 0.3 * Math.sin(p * 26)) };
      out.parts.armL = { angle: -0.05 * Math.sin(t * 1.3 + 1) };
      out.parts.head = { angle: 0.07 * Math.sin(t * 0.8) - 0.12 * raise };
    },
    build(k, o) {
      const fur = o.color;
      const light = mix(fur, "#f6e2c6", 0.6);
      const dark = "#2a1a12";
      const furCol = (c, base) => {
        const n = c.fbm(c.p[0] * 9, c.p[1] * 9, c.p[2] * 9);
        const col = shade(base, 0.86 + 0.18 * c.rand() + 0.12 * n);
        return lit(col, c.n, { amb: 0.66, dif: 0.45, spec: 0 });
      };
      const soft = { flat: 0.55, jitter: 0.07, interior: 0.08, core: "#e9dcc3" };
      const head = k.part("head", { pivot: [0, 0.42, 0], axis: [0, 0, 1] });
      const armR = k.part("armR", { pivot: [0.33, 0.3, 0.04], axis: [0, 0, 1] });
      const armL = k.part("armL", { pivot: [-0.33, 0.3, 0.04], axis: [0, 0, 1] });
      // Body with a lighter tummy.
      k.add(fuzz(k.ellipsoid(0.42, 0.47, 0.37), 0.035), {
        ...soft,
        pos: [0, 0, 0],
        color: (c) => {
          const tum = (c.lp[0] / 0.26) ** 2 + ((c.lp[1] + 0.05) / 0.33) ** 2 < 1 && c.lp[2] > 0.15;
          return furCol(c, tum ? light : fur);
        },
      });
      // Head, ears, snout, eyes and nose.
      k.add(fuzz(k.sphere(0.35), 0.035), {
        ...soft,
        pos: [0, 0.7, 0.02],
        part: head,
        color: (c) => furCol(c, fur),
      });
      for (const s of [-1, 1]) {
        k.add(fuzz(k.ellipsoid(0.13, 0.13, 0.075), 0.03), {
          ...soft,
          pos: [s * 0.27, 0.97, -0.02],
          rot: [0, 0, s * -18],
          part: head,
          color: (c) => {
            const inner = c.lp[2] > 0.02 && Math.hypot(c.lp[0], c.lp[1]) < 0.085;
            return furCol(c, inner ? light : fur);
          },
        });
        k.add(k.sphere(0.045), {
          pos: [s * 0.13, 0.79, 0.31],
          part: head,
          flat: 0.3,
          weight: 3,
          pattern: false,
          color: (c) => keep(dot(c.n, unit([0.3, 0.6, 0.75])) > 0.85 ? "#ffffff" : "#120c09"),
        });
      }
      const mouth = [
        [0, 0.62, 0, 0.56],
        [0, 0.56, -0.06, 0.525],
        [0, 0.56, 0.06, 0.525],
      ];
      k.add(fuzz(k.ellipsoid(0.17, 0.13, 0.13), 0.012), {
        ...soft,
        pos: [0, 0.6, 0.29],
        part: head,
        weight: 1.6,
        color: (c) => {
          if (c.p[2] > 0.36) {
            let d = Infinity;
            for (const s of mouth) d = Math.min(d, segDist(c.p[0], c.p[1], s));
            if (d < 0.009) return keep("#3a2418");
          }
          // Running stitches around the snout.
          if (c.lp[2] < 0.05 && c.lp[2] > 0.02) {
            const a = Math.atan2(c.lp[1], c.lp[0]) / TAU + 0.5;
            if ((a * 22) % 1 < 0.5) return keep("#5a3a25");
          }
          return furCol(c, light);
        },
      });
      k.add(k.ellipsoid(0.07, 0.05, 0.045), {
        pos: [0, 0.665, 0.415],
        part: head,
        flat: 0.25,
        weight: 3,
        pattern: false,
        color: (c) => keep(lit(dark, c.n, { amb: 0.8, dif: 0.3, spec: 0.7, pow: 20 })),
      });
      // A ribbon bow.
      for (const s of [-1, 1])
        k.add(k.ellipsoid(0.1, 0.065, 0.03), {
          pos: [s * 0.09, 0.4, 0.33],
          rot: [0, s * -20, s * 18],
          flat: 0.2,
          weight: 2,
          pattern: false,
          color: (c) => lit("#d62839", c.n, { spec: 0.4 }),
        });
      k.add(k.sphere(0.04), {
        pos: [0, 0.4, 0.35],
        flat: 0.2,
        weight: 2,
        pattern: false,
        color: (c) => lit("#b81f30", c.n, { spec: 0.4 }),
      });
      // Arms with paw pads.
      for (const [s, part] of [
        [1, armR],
        [-1, armL],
      ])
        k.add(fuzz(k.ellipsoid(0.12, 0.27, 0.12), 0.03), {
          ...soft,
          pos: [s * 0.44, 0.1, 0.09],
          rot: [18, 0, s * 26],
          part,
          color: (c) => furCol(c, c.lp[1] < -0.16 && c.lp[2] > 0 ? light : fur),
        });
      // Legs with foot pads.
      for (const s of [-1, 1])
        k.add(fuzz(k.ellipsoid(0.15, 0.15, 0.27), 0.03), {
          ...soft,
          pos: [s * 0.22, -0.38, 0.2],
          rot: [0, s * 10, 0],
          color: (c) => furCol(c, c.lp[2] > 0.19 ? light : fur),
        });
      k.reach([0.9, 0.7, 0]);
    },
  },

  "yo-yo": {
    alive: true,
    options: [{ key: "color", label: "Colour", type: "color", default: "#e6392f" }],
    controls: [{ key: "throw", label: "Throw", type: "pulse", ease: 1.8 }],
    action: { key: "throw", label: "Throw" },
    drive(t, c, out) {
      const idle = YO.rest + 0.12 * Math.sin(t * 2.4);
      const p = 1 - c.throw;
      const D = c.throw > 0 ? idle + (YO.max - idle) * Math.pow(bump(p), 0.7) : idle;
      const f = (D - YO.seg) / ((YO.K - 1) * YO.seg);
      for (let j = 1; j < YO.K; j++) out.parts["s" + j] = { offset: [0, j * YO.seg * (1 - f), 0] };
      out.parts.yoyo = { angle: -(D - YO.rest) / 0.06, offset: [0, -(D - YO.rest), 0] };
    },
    build(k, o) {
      const top = YO.top;
      const cy = top - YO.rest;
      const col = o.color;
      const yoyo = k.part("yoyo", { pivot: [0, cy, 0], axis: [0, 0, 1] });
      const half = k.lathe(
        [
          [0.05, 0.012],
          [0.22, 0.016],
          [0.36, 0.035],
          [0.41, 0.075],
          [0.4, 0.115],
          [0.35, 0.145],
          [0.2, 0.155],
          [0, 0.157],
        ],
        { grid: 96 },
      );
      for (const s of [1, -1]) {
        k.add(half, {
          pos: [0, cy, 0],
          rot: [s * 90, 0, 0],
          part: yoyo,
          flat: 0.2,
          color: (c) => {
            const r = Math.hypot(c.lp[0], c.lp[2]);
            const face = c.lp[1] > 0.13;
            let base = col;
            if (face && r < 0.1) base = "#dfe3e8";
            else if (face && r < 0.13) base = shade(col, 0.7);
            else if (face && Math.abs(r - 0.25) < 0.02) base = "#fdfbf5";
            else if (!face && c.lp[1] > 0.06 && c.lp[1] < 0.085) base = "#fdfbf5";
            return lit(base, c.n, { amb: 0.64, dif: 0.45, spec: 0.5, pow: 26 });
          },
        });
      }
      // The string wound on the axle.
      k.add(k.torus(0.075, 0.02), {
        pos: [0, cy, 0],
        rot: [90, 0, 0],
        part: yoyo,
        flat: 0.4,
        weight: 1.5,
        color: (c) => shade("#efe9dc", 0.8 + 0.2 * Math.sin(c.u * 80)),
      });
      // The string: segments that slide over each other as it pays out.
      for (let j = 0; j < YO.K; j++) {
        const part = j ? k.part("s" + j, { pivot: [0, 0, 0] }) : 0;
        k.add(k.cylinder(0.008, YO.seg * 1.08, { caps: false }), {
          pos: [0, top - (j + 0.5) * YO.seg, 0],
          part,
          share: 0.004,
          flat: 0.5,
          pattern: false,
          color: "#f1ede2",
        });
      }
      // Room for most of the throw.
      k.reach([0, top - YO.max - 0.1, 0]);
      // A loop for the finger.
      k.add(k.torus(0.055, 0.011), {
        pos: [0, top + 0.05, 0],
        rot: [90, 0, 0],
        share: 0.006,
        flat: 0.5,
        pattern: false,
        color: "#f1ede2",
      });
    },
  },

  "puzzle-cube": {
    // A real 3x3 cube: 26 cubies (tokens) and the cube state in JavaScript.
    // Swipe across a face to turn that row or column (it follows the finger
    // and snaps to the nearest quarter turn when let go); a tap scrambles a
    // solved cube, or turns a scrambled one back to solved, one layer at a
    // time. Solving it by hand earns a little hop and a chime.
    alive: () => cubeBusy(),
    // More splats: 26 cubies spend half theirs on faces hidden inside.
    density: 1.8,
    controls: [{ key: "twist", label: "Scramble", type: "pulse", ease: CUBE_TAP }],
    action: { key: "twist", label: "Scramble or solve" },
    // For tests: whether each face shows one colour, and the turns since.
    cube: { solved: () => cubeSolved(), turns: () => cube.history.length },
    note: "Swipe across a face to turn a row or a column. Tap to scramble, or to solve it again.",
    drag: {
      at: () => !cubeBusy(),
      plane: (p) => cubeFace(p).n,
      start: (p) => cubeDragStart(p),
      move: (p) => cubeDragMove(p),
      end: (time) => cubeDragEnd(time),
    },
    drive(t, c, out, info) {
      cubeDrive(c, out, info);
    },
    build(k) {
      const plastic = "#141518";
      const lightOf = (col, n) => lit(col, n, { amb: 0.8, dif: 0.22, spec: 0.3, pow: 30 });
      CUBIES.forEach((home, i) => {
        k.add(roundBox(0.97, 0.97, 0.97, 0.09), {
          pos: home,
          kind: "token",
          params: [i, 0],
          flat: 0.15,
          even: true,
          color: (c) => {
            const f = c.s.face;
            if (f < 0) return lightOf(plastic, c.n);
            const ax = f >> 1;
            const sign = f % 2 ? -1 : 1;
            // Only the cube's outside faces carry stickers.
            if (home[ax] !== sign) return lightOf(plastic, c.n);
            const la = Math.abs(c.lp[(ax + 1) % 3]);
            const lb = Math.abs(c.lp[(ax + 2) % 3]);
            const r = 0.1;
            const qa = Math.max(la - (0.41 - r), 0);
            const qb = Math.max(lb - (0.41 - r), 0);
            if (Math.hypot(qa, qb) > r) return lightOf(plastic, c.n);
            const col = lightOf(CUBE_COLOURS[f], c.n);
            return keep(mix(col, "#ffffff", 0.1 * smoothstep(0.2, 0.41, Math.max(la, lb))));
          },
        });
      });
    },
  },

  "spring-toy": {
    alive: true,
    options: [
      {
        key: "style",
        label: "Style",
        type: "select",
        default: "rainbow",
        choices: [
          { id: "rainbow", label: "Rainbow" },
          { id: "metal", label: "Metal" },
          { id: "pastel", label: "Pastel" },
        ],
      },
    ],
    controls: [{ key: "hurry", label: "Hurry", type: "pulse", ease: 2.5 }],
    action: { key: "hurry", label: "Make it walk" },
    drive(t, c, out) {
      const m = mem(c);
      const ph = integrate(m, "walk", t, 0.5 + 1.8 * c.hurry);
      const w = 0.5 + 0.5 * Math.sin(ph);
      const W = 0.42;
      for (let j = 0; j < SLINKY.N; j++) {
        const s = ((SLINKY.N - 1 - j) / (SLINKY.N - 1)) * (1 - W);
        out.parts["c" + j] = { angle: -Math.PI * easeInOut(clamp((w - s) / W, 0, 1)) };
      }
    },
    build(k, o) {
      const { N, R, r, d } = SLINKY;
      const pitch = r * 2.1;
      const h = r + ((N - 1) * pitch) / 2;
      for (let j = 0; j < N; j++) {
        const part = k.part("c" + j, { pivot: [0, h, 0], axis: [0, 0, 1] });
        const hue = (j / N) * 0.82;
        const col =
          o.style === "metal"
            ? null
            : o.style === "pastel"
              ? hsv(hue, 0.35, 1)
              : hsv(hue, 0.78, 0.96);
        k.add(k.torus(R, r), {
          pos: [-d, r + j * pitch, 0],
          part,
          flat: 0.3,
          color: (c) =>
            col ? lit(col, c.n, { amb: 0.66, dif: 0.42, spec: 0.5, pow: 30 }) : chrome(c.n),
        });
      }
      k.reach([0, h + d + R, 0]);
      k.reach([d + R, 0, 0]);
    },
  },

  kite: {
    alive: true,
    density: 0.3,
    options: [
      { key: "c1", label: "Colour 1", type: "color", default: "#e8413c" },
      { key: "c2", label: "Colour 2", type: "color", default: "#f7c948" },
    ],
    controls: [{ key: "gust", label: "Gust", type: "pulse", ease: 2.8 }],
    action: { key: "gust", label: "Gust of wind" },
    drive(t, c, out) {
      // A gust: the kite climbs round a loop, turning once about its bridle,
      // while the tail whips. The line stays tied to the bridle.
      const e = (1 - c.gust) * 2.8;
      const on = c.gust > 0;
      const f = on ? 0.5 - 0.5 * Math.cos(Math.PI * band(e, 0.03, 1.6)) : 0;
      const loop = TAU * f;
      const r = 0.15;
      const lift = on ? 0.12 * bump(e / 2.6) : 0;
      const off = [
        r * Math.sin(loop),
        0.05 * Math.sin(t * 0.9) + r * (1 - Math.cos(loop)) + lift,
        0,
      ];
      out.parts.kite = {
        angle: 0.08 * Math.sin(t * 1.1) + 0.05 * Math.sin(t * 2.3) + loop,
        offset: off,
      };
      const from = sub(KITE.bridle, KITE.flyer);
      const to = add(from, off);
      const dir = unit(to);
      out.parts.line = {
        quat: quatFromTo(unit(from), dir),
        offset: mul(dir, len(to) - len(from)),
      };
      out.amount = 1 + (on ? 4 * bump(band(e, 0, 2.6)) : 0);
    },
    build(k, o) {
      const R = KITE.tilt;
      const kite = k.part("kite", { pivot: KITE.bridle, axis: [0, 0, 1] });
      const T = R([0, 0.78, 0]);
      const L = R([-0.52, 0.22, 0.04]);
      const Rt = R([0.52, 0.22, 0.04]);
      const B = R([0, -0.72, 0]);
      const C = R([0, 0.22, -0.06]);
      const sail = [
        [T, L, C, o.c1],
        [T, C, Rt, o.c2],
        [B, C, L, o.c2],
        [B, Rt, C, o.c1],
      ];
      for (const [a, b, cc, col] of sail) {
        k.add(triShape(a, b, cc), {
          even: true,
          opacity: 1,
          jitter: 0.015,
          part: kite,
          flat: 0.15,
          weight: 1.2,
          color: (c) => {
            const m = Math.min(c.s.bary[0], c.s.bary[1], c.s.bary[2]);
            const n = c.s.n[2] < 0 ? mul(c.s.n, -1) : c.s.n;
            const base = lit(col, n, { amb: 0.72, dif: 0.35, spec: 0.15 });
            if (m < 0.012) return keep("#3a2a20");
            if (m < 0.03) return shade(base, 0.9);
            return base;
          },
        });
      }
      // Tail with bows, rippling in the wind.
      const tail = spline([
        B,
        R([-0.16, -0.95, 0.02]),
        R([-0.42, -1.06, 0.04]),
        R([-0.66, -0.98, 0.02]),
        R([-0.86, -1.08, 0]),
      ]);
      k.add(k.tube(tail, 0.022, { samples: 200 }), {
        opacity: 1,
        jitter: 0.015,
        part: kite,
        share: 0.04,
        flat: 0.4,
        kind: "wave",
        params: (c) => [0.07 * c.t, 0],
        color: (c) => lit(shade(o.c1, 0.85), c.n, { amb: 0.8, dif: 0.3 }),
      });
      for (let i = 1; i <= 5; i++) {
        const tt = i / 5.4;
        const p = tail(tt);
        const q = tail(Math.min(1, tt + 0.01));
        const dir = unit(sub(q, p));
        const side = [-dir[1], dir[0], 0];
        const col = i % 2 ? o.c1 : o.c2;
        for (const s of [-1, 1]) {
          const tip = add(p, add(mul(side, 0.09 * s), mul(dir, 0.03 * s)));
          const tip2 = add(p, add(mul(side, 0.09 * s), mul(dir, -0.03 * s)));
          k.add(triShape(p, tip, tip2), {
            even: true,
            opacity: 1,
            jitter: 0.015,
            part: kite,
            weight: 2.5,
            size: 1.5,
            flat: 0.2,
            kind: "wave",
            params: [0.07 * tt, 0],
            color: (c) => lit(col, [0, 0, 1], { amb: 0.8, dif: 0.3 }),
          });
        }
      }
      // The line down to the flyer, aimed at the bridle as the kite moves.
      const line = k.part("line", { pivot: KITE.flyer });
      const a = KITE.bridle;
      const b = KITE.flyer;
      k.add(
        k.tube(
          (t) => [
            a[0] + (b[0] - a[0]) * t,
            a[1] + (b[1] - a[1]) * t - 0.12 * Math.sin(Math.PI * t),
            a[2] + (b[2] - a[2]) * t,
          ],
          0.006,
          { samples: 64, grid: 24 },
        ),
        {
          opacity: 1,
          jitter: 0.015,
          part: line,
          share: 0.02,
          flat: 0.5,
          pattern: false,
          color: "#9a8f7e",
        },
      );
      // Spars behind the sail.
      for (const [p0, p1] of [
        [T, B],
        [L, Rt],
      ]) {
        const q0 = add(p0, [0, 0, -0.02]);
        const q1 = add(p1, [0, 0, -0.02]);
        k.add(
          k.tube((t) => add(q0, mul(sub(q1, q0), t)), 0.012, { samples: 32, grid: 24 }),
          {
            opacity: 1,
            jitter: 0.015,
            part: kite,
            weight: 1.5,
            flat: 0.3,
            color: (c) => lit("#b8874f", c.n),
          },
        );
      }
    },
  },

  "paper-plane": {
    alive: true,
    density: 0.5,
    options: [
      { key: "color", label: "Paper", type: "color", default: "#cfe6f7" },
      { key: "lines", label: "Lined paper", type: "switch", default: true },
    ],
    controls: [{ key: "loop", label: "Barrel roll", type: "pulse", ease: 1.6 }],
    action: { key: "loop", label: "Barrel roll" },
    drive(t, c, out) {
      const p = 1 - c.loop;
      const roll = c.loop > 0 ? TAU * easeInOut(p) : 0;
      out.parts.plane = {
        quat: quatMul(
          quatAxisAngle([0, 0, 1], 0.06 * Math.sin(t * 1.2)),
          quatAxisAngle([1, 0, 0], roll + 0.08 * Math.sin(t * 0.9)),
        ),
        offset: [0, 0.06 * Math.sin(t * 1.5) + 0.25 * bump(p), 0],
      };
    },
    build(k, o) {
      const plane = k.part("plane", { pivot: [0, 0, 0], axis: [1, 0, 0] });
      const paper = o.color;
      const N = [0.85, 0.02, 0];
      const Tt = [-0.8, 0.02, 0];
      const facets = [];
      for (const s of [-1, 1]) {
        // Keel (the folded fuselage).
        facets.push([N, Tt, [-0.78, -0.2, s * 0.02], [0, 0, s]]);
        // Wing: two facets with a crease.
        const M = [-0.82, 0.07, s * 0.24];
        const W = [-0.84, 0.1, s * 0.6];
        facets.push([N, Tt, M, [0, 1, 0]]);
        facets.push([N, M, W, [0, 1, 0]]);
      }
      for (const [a, b, cc, out] of facets) {
        const sh = triShape(a, b, cc);
        const n =
          dot(sh.sample(() => 0.3).n, out) < 0
            ? mul(sh.sample(() => 0.3).n, -1)
            : sh.sample(() => 0.3).n;
        k.add(sh, {
          even: true,
          opacity: 1,
          jitter: 0.015,
          part: plane,
          flat: 0.12,
          color: (c) => {
            let col = lit(paper, n, { amb: 0.5, dif: 0.5, spec: 0.12 });
            if (n[1] < 0.5) col = shade(col, 0.82);
            const m = Math.min(c.s.bary[0], c.s.bary[1], c.s.bary[2]);
            if (o.lines && Math.abs(n[1]) > 0.5) {
              const z = Math.abs(c.p[2]);
              const line = Math.abs(((z / 0.07) % 1) - 0.5) > 0.44;
              if (line) col = mix(col, "#4f86c6", 0.6);
              if (Math.abs(c.p[0] + 0.55) < 0.008) col = mix(col, "#e0707a", 0.6);
            }
            if (m < 0.012) col = shade(col, 0.7);
            return col;
          },
        });
      }
      k.reach([0, 0.5, 0]);
      k.reach([0, -0.5, 0]);
    },
  },

  "origami-crane": {
    alive: true,
    density: 0.3,
    options: [{ key: "color", label: "Paper", type: "color", default: "#e2474f" }],
    controls: [{ key: "flap", label: "Flap", type: "pulse", ease: 1.8 }],
    action: { key: "flap", label: "Flap the wings" },
    drive(t, c, out) {
      const f = c.flap;
      const a = 0.1 * Math.sin(t * 1.6) + f * 0.55 * Math.sin((1 - f) * 22);
      out.parts.wingR = { angle: -a };
      out.parts.wingL = { angle: a };
      out.body = { offset: [0, 0.03 * Math.sin(t * 1.6 + 1) + 0.1 * bump(1 - f), 0] };
    },
    build(k, o) {
      const paper = o.color;
      const wingR = k.part("wingR", { pivot: [0, 0.05, 0], axis: [1, 0, 0] });
      const wingL = k.part("wingL", { pivot: [0, 0.05, 0], axis: [1, 0, 0] });
      const tri = (a, b, cc, out, part = 0) => {
        const sh = triShape(a, b, cc);
        const n0 = sh.sample(() => 0.4).n;
        const n = dot(n0, out) < 0 ? mul(n0, -1) : n0;
        k.add(sh, {
          even: true,
          opacity: 1,
          jitter: 0.015,
          part,
          flat: 0.12,
          color: (c) => {
            const m = Math.min(c.s.bary[0], c.s.bary[1], c.s.bary[2]);
            const col = lit(paper, n, { amb: 0.62, dif: 0.5, spec: 0.12 });
            return m < 0.01 ? shade(col, 0.82) : col;
          },
        });
      };
      const Top = [0, 0.06, 0];
      const Bot = [0, -0.3, 0];
      const Fn = [0.27, -0.08, 0];
      const Tl = [-0.27, -0.08, 0];
      for (const s of [-1, 1]) {
        const S = [0, -0.07, s * 0.15];
        const out = [0, 0, s];
        tri(Top, Fn, S, add(out, [0, 1, 0]));
        tri(Top, S, Tl, add(out, [0, 1, 0]));
        tri(Bot, S, Fn, add(out, [0, -1, 0]));
        tri(Bot, Tl, S, add(out, [0, -1, 0]));
        // Neck and head.
        const Nb = [0.16, -0.17, 0];
        const Ns = [0.3, -0.03, s * 0.028];
        const Nt = [0.63, 0.43, 0];
        tri(Nb, Ns, Nt, out);
        tri(Nt, [0.66, 0.41, s * 0.014], [0.77, 0.33, 0], out);
        // Tail.
        const Tb = [-0.16, -0.17, 0];
        const Ts = [-0.3, -0.03, s * 0.028];
        tri(Tb, Ts, [-0.68, 0.41, 0], out);
        // Wings, each with a soft crease.
        const Wf = [0.15, 0.05, 0];
        const Wb = [-0.22, 0.05, 0];
        const Wt = [-0.05, 0.36, s * 0.8];
        const Wm = [-0.13, 0.26, s * 0.4];
        const part = s > 0 ? wingR : wingL;
        tri(Wf, Wb, Wm, [0, 1, 0], part);
        tri(Wf, Wm, Wt, [0, 1, 0], part);
      }
      k.reach([0, 0.62, 0.72]);
      k.reach([0, 0.62, -0.72]);
    },
  },
  "balloon-dog": {
    options: [{ key: "color", label: "Balloon", type: "color", default: "#ff4f8b" }],
    controls: [{ key: "pop", label: "Pop", type: "pulse", ease: 2.6 }],
    action: { key: "pop", label: "Pop" },
    drive(t, c, out) {
      const p = 1 - c.pop;
      const on = c.pop > 0;
      out.grow = on ? clamp((p - 0.22) / 0.72, 0, 1) : 1;
      BURST.forEach((d, i) => {
        const f = clamp(p / 0.28, 0, 1);
        const dist = 0.9 * easeOut(f);
        out.parts["bit" + i] = {
          offset: [d[0] * dist, d[1] * dist - 0.5 * f * f, d[2] * dist],
          visible: on && p < 0.3 ? 1 - smoothstep(0.2, 0.3, p) : 0,
        };
      });
    },
    build(k, o) {
      const col = o.color;
      const glossy = (c) => {
        let x = lit(col, c.n, { amb: 0.62, dif: 0.45, spec: 0 });
        x = mix(x, shade(col, 0.6), 0.25 * (1 - Math.abs(dot(c.n, VIEW))));
        x = mix(x, [1, 1, 1], 0.85 * Math.pow(Math.max(0, dot(c.n, HALF)), 70));
        return mix(
          x,
          [1, 1, 1],
          0.25 * Math.pow(Math.max(0, dot(c.n, unit([-0.3, 0.9, 0.3]))), 12),
        );
      };
      const pieces = [
        // [from, to, radius]
        [[0.26, 0.12, 0], [-0.36, 0.12, 0], 0.12],
        [[0.3, 0.15, 0], [0.44, 0.58, 0], 0.1],
        [[0.48, 0.64, 0], [0.9, 0.58, 0], 0.1],
        [[0.44, 0.66, 0.11], [0.24, 0.98, 0.22], 0.085],
        [[0.44, 0.66, -0.11], [0.24, 0.98, -0.22], 0.085],
        [[0.26, 0.06, 0.11], [0.32, -0.52, 0.17], 0.095],
        [[0.26, 0.06, -0.11], [0.32, -0.52, -0.17], 0.095],
        [[-0.36, 0.06, 0.11], [-0.42, -0.52, 0.17], 0.095],
        [[-0.36, 0.06, -0.11], [-0.42, -0.52, -0.17], 0.095],
        [[-0.4, 0.16, 0], [-0.62, 0.58, 0], 0.08],
      ];
      pieces.forEach(([a, b, r], i) => {
        const dir = sub(b, a);
        const L = len(dir);
        k.add(k.ellipsoid(L / 2 + r * 0.25, r, r), {
          pos: mul(add(a, b), 0.5),
          quat: quatFromTo([1, 0, 0], dir),
          flat: 0.2,
          opacity: 0.93,
          kind: "grow",
          params: [(i / pieces.length) * 0.8, 0],
          color: glossy,
        });
      });
      // The knot at the tail.
      k.add(k.sphere(0.035), {
        pos: [-0.65, 0.63, 0],
        weight: 3,
        kind: "grow",
        params: [0.82, 0],
        color: (c) => shade(col, 0.8),
      });
      // Scraps for the pop, hidden until then.
      BURST.forEach((d, i) => {
        const part = k.part("bit" + i, { pivot: [0, 0.3, 0] });
        // Each burst direction carries a few ragged scraps of rubber.
        k.cloud({ share: 0.004, size: 1.4, part, pattern: false }, (rand, j) => {
          const scrap = j % 5;
          const centre = add(
            [0.1, 0.3, 0],
            mul(
              add(d, [
                Math.sin(scrap * 2.1) * 0.5,
                Math.cos(scrap * 1.7) * 0.5,
                Math.sin(scrap * 3.3) * 0.5,
              ]),
              0.3,
            ),
          );
          return {
            p: add(centre, [(rand() - 0.5) * 0.06, (rand() - 0.5) * 0.06, (rand() - 0.5) * 0.06]),
            n: [Math.sin(scrap), 1, Math.cos(scrap * 2)],
            flat: 0.2,
            color: shade(col, 0.8 + 0.3 * rand()),
            opacity: 0.95,
          };
        });
      });
    },
  },

  "soap-bubbles": {
    alive: true,
    density: 0.7,
    options: [{ key: "color", label: "Wand", type: "color", default: "#8e5bd9" }],
    controls: [{ key: "blow", label: "Blow", type: "pulse", ease: 2.5 }],
    action: { key: "blow", label: "Blow bubbles" },
    drive(t, c, out) {
      const m = mem(c);
      const tau = integrate(m, "tau", t, 0.07 + 0.35 * c.blow);
      BUBBLES.forEach((b, i) => {
        const s = (tau * b.speed + b.s0) % 1;
        const p = bubbleAt(b, s);
        out.parts["b" + i] = {
          offset: sub(p, b.rest),
          visible: smoothstep(0, 0.05, s) * (1 - smoothstep(0.94, 1, s)),
        };
      });
    },
    build(k, o) {
      const wand = o.color;
      const ringC = WAND.c;
      const ringN = WAND.n;
      // The wand: a ring on a handle, with a soap film in it.
      const q = quatFromTo([0, 1, 0], ringN);
      k.add(k.torus(WAND.r, 0.022), {
        pos: ringC,
        quat: q,
        flat: 0.25,
        weight: 1.5,
        color: (c) => lit(wand, c.n, { spec: 0.5 }),
      });
      const down = unit(sub([-1.05, -1.0, 0.15], ringC));
      const hStart = add(ringC, mul(down, WAND.r));
      k.add(
        k.tube((t) => add(hStart, mul(down, t * 0.62)), 0.022, {
          caps: true,
          samples: 32,
          grid: 32,
        }),
        {
          flat: 0.25,
          weight: 1.5,
          color: (c) => lit(wand, c.n, { spec: 0.5 }),
        },
      );
      k.add(k.disc(WAND.r - 0.01), {
        pos: ringC,
        quat: q,
        flat: 0.1,
        opacity: 0.35,
        pattern: false,
        color: (c) => film(c.lp, c.n, c),
      });
      // The bubbles.
      BUBBLES.forEach((b, i) => {
        const part = k.part("b" + i, { pivot: b.rest });
        k.add(k.sphere(b.r), {
          pos: b.rest,
          part,
          flat: 0.1,
          opacity: 0.32,
          pattern: false,
          color: (c) => film(c.lp, c.n, c),
        });
        k.cloud({ share: 0.0015 + b.r * 0.004, size: 0.8, part, pattern: false }, (rand) => {
          const big = rand() < 0.7;
          const d = unit(
            add(
              big ? [-0.45, 0.62, 0.64] : [0.5, -0.55, 0.66],
              mul([rand() - 0.5, rand() - 0.5, rand() - 0.5], big ? 0.3 : 0.18),
            ),
          );
          return {
            p: add(b.rest, mul(d, b.r * 1.01)),
            n: d,
            color: "#ffffff",
            opacity: big ? 0.85 : 0.5,
            kind: "glint",
            params: [0.6, 0],
          };
        });
      });
    },
  },

  robot: {
    alive: true,
    options: [{ key: "color", label: "Colour", type: "color", default: "#4f9fdc" }],
    controls: [{ key: "wind", label: "Wind up", type: "pulse", ease: 3 }],
    action: { key: "wind", label: "Wind it up" },
    drive(t, c, out) {
      const m = mem(c);
      const w = c.wind;
      const key = integrate(m, "key", t, 1.2 + 14 * w);
      const walk = integrate(m, "walk", t, 1.6 + 7 * w);
      const swing = 0.22 + 0.45 * w;
      out.parts.armR = { angle: swing * Math.sin(walk) };
      out.parts.armL = { angle: -swing * Math.sin(walk) };
      out.parts.key = { angle: key };
      out.body = {
        quat: quatAxisAngle([0, 0, 1], 0.07 * w * Math.sin(walk)),
        offset: [0, 0.035 * w * Math.abs(Math.sin(walk)), 0],
      };
      out.glow = [1, 0.35, 0.25, 2.2];
    },
    build(k, o) {
      const body = o.color;
      const metal = "#c5cbd3";
      const red = "#e5483a";
      const tin =
        (col, spec = 0.45) =>
        (c) => {
          const brushed = 0.96 + 0.05 * c.noise(c.p[0] * 3, c.p[1] * 60, c.p[2] * 3);
          return lit(shade(col, brushed), c.n, { amb: 0.64, dif: 0.45, spec, pow: 24 });
        };
      // Torso with a chest panel of lights and dials.
      const panel = (c) => {
        if (c.s.face !== 4) return null;
        const [x, y] = c.p;
        if (Math.abs(x) > 0.25 || y < -0.33 || y > 0.08) return null;
        for (const [lx, col] of [
          [-0.12, "#ff4d4d"],
          [0, "#ffd54a"],
          [0.12, "#5cff7a"],
        ])
          if (Math.hypot(x - lx, y - 0.0) < 0.04) return keep(mix(col, "#ffffff", 0.25));
        for (const dx of [-0.1, 0.1]) {
          const r = Math.hypot(x - dx, y + 0.2);
          if (r < 0.075) {
            const ang = Math.atan2(y + 0.2, x - dx);
            const needle = Math.abs(ang - (dx < 0 ? 2.2 : 0.9)) < 0.12 && r < 0.06;
            if (needle) return keep("#222222");
            return keep(r > 0.064 ? "#333a44" : "#f6f3e8");
          }
        }
        const edge = Math.min(0.25 - Math.abs(x), y + 0.33, 0.08 - y);
        return edge < 0.015
          ? shade(metal, 0.6)
          : lit(metal, c.n, { amb: 0.75, dif: 0.3, spec: 0.3 });
      };
      k.add(roundBox(0.72, 0.62, 0.46, 0.07), {
        pos: [0, -0.12, 0],
        flat: 0.15,
        interior: 0.08,
        core: "#4a4f57",
        color: (c) => {
          const p = panel(c);
          if (p) return p;
          const rv = [-0.3, 0.3].some((x) =>
            [0.12, -0.36].some((y) => Math.hypot(c.p[0] - x, c.p[1] - y) < 0.018),
          );
          if (c.s.face === 4 && rv) return keep(shade(metal, 1.05));
          return tin(body)(c);
        },
      });
      // Head, eyes, mouth grille, ear bolts and antenna.
      k.add(roundBox(0.5, 0.36, 0.4, 0.07), {
        pos: [0, 0.42, 0],
        flat: 0.15,
        interior: 0.08,
        core: "#4a4f57",
        color: (c) => {
          if (c.s.face === 4 && Math.abs(c.p[0]) < 0.13 && c.p[1] > 0.29 && c.p[1] < 0.35) {
            const slot = Math.abs((((c.p[0] + 0.13) / 0.037) % 1) - 0.5) < 0.25;
            return keep(slot ? "#20242b" : metal);
          }
          return tin(body)(c);
        },
      });
      k.add(k.cylinder(0.09, 0.08, { caps: false }), {
        pos: [0, 0.215, 0],
        flat: 0.2,
        color: tin(metal),
      });
      for (const s of [-1, 1]) {
        k.add(k.cylinder(0.09, 0.03), {
          pos: [s * 0.12, 0.46, 0.205],
          rot: [90, 0, 0],
          flat: 0.15,
          weight: 2,
          pattern: false,
          color: (c) => {
            if (c.s.cap !== "top") return tin(metal)(c);
            const r = c.s.radial;
            if (r > 0.8) return keep(shade(metal, 0.9));
            if (r < 0.28) return keep("#ffffff");
            return keep(mix("#ffe45c", "#ff9f1c", (r - 0.28) / 0.6));
          },
        });
        k.add(k.cylinder(0.05, 0.06), {
          pos: [s * 0.28, 0.42, 0],
          rot: [0, 0, 90],
          flat: 0.2,
          weight: 2,
          color: tin(red),
        });
      }
      k.add(k.cylinder(0.013, 0.2, { caps: false }), {
        pos: [0, 0.7, 0],
        weight: 2,
        flat: 0.3,
        color: tin(metal),
      });
      k.add(k.sphere(0.05), {
        pos: [0, 0.82, 0],
        weight: 3,
        flat: 0.3,
        pattern: false,
        kind: "pulse",
        params: [0.5, 0],
        color: (c) => keep(lit("#ff3b30", c.n, { amb: 0.8, dif: 0.3, spec: 0.6 })),
      });
      // Arms (parts, swinging from the shoulders) with claw hands.
      for (const s of [-1, 1]) {
        const part = k.part(s > 0 ? "armR" : "armL", {
          pivot: [s * 0.41, 0.04, 0],
          axis: [1, 0, 0],
        });
        k.add(k.sphere(0.075), { pos: [s * 0.41, 0.04, 0], part, flat: 0.2, color: tin(metal) });
        k.add(k.cylinder(0.052, 0.34, { caps: false }), {
          pos: [s * 0.44, -0.15, 0],
          part,
          flat: 0.2,
          color: tin(body),
        });
        k.add(k.torus(0.065, 0.024), {
          pos: [s * 0.44, -0.39, 0],
          rot: [0, 0, 90],
          part,
          flat: 0.2,
          weight: 1.5,
          color: (c) => (c.lp[2] > 0.04 && Math.abs(c.lp[0]) < 0.05 ? null : tin(metal)(c)),
        });
      }
      // Legs and feet.
      for (const s of [-1, 1]) {
        k.add(roundBox(0.18, 0.24, 0.22, 0.04), {
          pos: [s * 0.15, -0.56, 0],
          flat: 0.15,
          color: tin(metal),
        });
        k.add(roundBox(0.24, 0.09, 0.34, 0.035, { bottom: false }), {
          pos: [s * 0.15, -0.72, 0.05],
          flat: 0.15,
          color: tin(red),
        });
      }
      // The wind-up key on the back.
      k.add(k.cylinder(0.022, 0.1), {
        pos: [0, -0.1, -0.28],
        rot: [90, 0, 0],
        color: tin("#c9a548"),
      });
      const key = k.part("key", { pivot: [0, -0.1, -0.34], axis: [0, 0, 1] });
      for (const s of [-1, 1])
        k.add(k.ellipsoid(0.1, 0.062, 0.018), {
          pos: [s * 0.085, -0.1, -0.34],
          part: key,
          flat: 0.2,
          weight: 1.5,
          color: tin("#d8b24e", 0.6),
        });
    },
  },
};
