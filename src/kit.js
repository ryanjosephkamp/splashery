// The toy kit: shapes that recipes combine into a generated toy. Pure
// JavaScript (no engine imports), so recipes also run in tests and tools.
//
// A recipe describes its toy by adding shapes to a Kit:
//
//   build(k, o) {
//     const ball = k.sphere(0.8);
//     k.add(ball, { color: (c) => (c.v < 0.5 ? "#e8662a" : "#d45a20"), flat: 0.2 });
//     const lid = k.part("lid", { pivot: [0, 0.5, -0.4], axis: [1, 0, 0] });
//     k.add(k.box(1, 0.1, 1), { pos: [0, 0.55, 0], part: lid });
//   }
//
// The kit shares the splat budget between shapes by surface area (times an
// optional weight), so the whole toy has an even density; shapes can also
// ask for an exact share of the budget. When everything is added, the toy
// is centred and scaled to fit a sphere of radius 0.95, and part pivots are
// moved with it. Every choice comes from the seed, so a toy rebuilds exactly.

import { mulberry32, createNoise3, mixSeed } from "./noise.js";
import { SplatBuffer, discRotation, randomDir, hexRgb, clayBudget, norm } from "./generators.js";
import { KINDS } from "./effects.js";

const TAU = Math.PI * 2;
const DEG = Math.PI / 180;
export const FIT_RADIUS = 0.95;

// ---- Vectors and quaternions ------------------------------------------------

const add3 = (a, b) => [a[0] + b[0], a[1] + b[1], a[2] + b[2]];
const sub3 = (a, b) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
const mul3 = (a, s) => [a[0] * s, a[1] * s, a[2] * s];
const dot3 = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
const len3 = (a) => Math.hypot(a[0], a[1], a[2]);
const cross3 = (a, b) => [
  a[1] * b[2] - a[2] * b[1],
  a[2] * b[0] - a[0] * b[2],
  a[0] * b[1] - a[1] * b[0],
];
const unit = (a) => {
  const l = len3(a) || 1;
  return [a[0] / l, a[1] / l, a[2] / l];
};

export const vec = { add: add3, sub: sub3, mul: mul3, dot: dot3, len: len3, cross: cross3, unit };

export function quatMul(a, b) {
  return [
    a[3] * b[0] + b[3] * a[0] + a[1] * b[2] - a[2] * b[1],
    a[3] * b[1] + b[3] * a[1] + a[2] * b[0] - a[0] * b[2],
    a[3] * b[2] + b[3] * a[2] + a[0] * b[1] - a[1] * b[0],
    a[3] * b[3] - a[0] * b[0] - a[1] * b[1] - a[2] * b[2],
  ];
}

export function quatAxisAngle(axis, angle) {
  const a = unit(axis);
  const s = Math.sin(angle / 2);
  return [a[0] * s, a[1] * s, a[2] * s, Math.cos(angle / 2)];
}

// Euler angles in degrees, applied X then Y then Z.
export function quatEuler(x = 0, y = 0, z = 0) {
  const qx = quatAxisAngle([1, 0, 0], x * DEG);
  const qy = quatAxisAngle([0, 1, 0], y * DEG);
  const qz = quatAxisAngle([0, 0, 1], z * DEG);
  return quatMul(qz, quatMul(qy, qx));
}

export function quatRotate(q, v) {
  const u = [q[0], q[1], q[2]];
  const t = mul3(cross3(u, v), 2);
  return add3(add3(v, mul3(t, q[3])), cross3(u, t));
}

// The shortest rotation taking direction a onto direction b.
export function quatFromTo(a, b) {
  const u = unit(a);
  const v = unit(b);
  const d = dot3(u, v);
  if (d < -0.999999) {
    const axis = Math.abs(u[0]) < 0.9 ? cross3(u, [1, 0, 0]) : cross3(u, [0, 1, 0]);
    return quatAxisAngle(axis, Math.PI);
  }
  const c = cross3(u, v);
  const q = [c[0], c[1], c[2], 1 + d];
  const l = Math.hypot(q[0], q[1], q[2], q[3]);
  return [q[0] / l, q[1] / l, q[2] / l, q[3] / l];
}

// Rotation whose columns are the orthonormal basis (x, y, z).
function quatBasis(x, y, z) {
  const m00 = x[0];
  const m11 = y[1];
  const m22 = z[2];
  const tr = m00 + m11 + m22;
  let q;
  if (tr > 0) {
    const s = Math.sqrt(tr + 1) * 2;
    q = [(y[2] - z[1]) / s, (z[0] - x[2]) / s, (x[1] - y[0]) / s, s / 4];
  } else if (m00 > m11 && m00 > m22) {
    const s = Math.sqrt(1 + m00 - m11 - m22) * 2;
    q = [s / 4, (y[0] + x[1]) / s, (z[0] + x[2]) / s, (y[2] - z[1]) / s];
  } else if (m11 > m22) {
    const s = Math.sqrt(1 + m11 - m00 - m22) * 2;
    q = [(y[0] + x[1]) / s, s / 4, (z[1] + y[2]) / s, (z[0] - x[2]) / s];
  } else {
    const s = Math.sqrt(1 + m22 - m00 - m11) * 2;
    q = [(z[0] + x[2]) / s, (z[1] + y[2]) / s, s / 4, (x[1] - y[0]) / s];
  }
  const l = Math.hypot(q[0], q[1], q[2], q[3]) || 1;
  return [q[0] / l, q[1] / l, q[2] / l, q[3] / l];
}

// ---- Colours -------------------------------------------------------------------

export function rgb(c) {
  if (Array.isArray(c)) return c;
  if (typeof c === "string") return hexRgb(c.length === 4 ? expandHex(c) : c);
  return [1, 0, 1];
}

function expandHex(h) {
  return "#" + h[1] + h[1] + h[2] + h[2] + h[3] + h[3];
}

export function mix(a, b, t) {
  const x = rgb(a);
  const y = rgb(b);
  return [x[0] + (y[0] - x[0]) * t, x[1] + (y[1] - x[1]) * t, x[2] + (y[2] - x[2]) * t];
}

export function shade(c, f) {
  const x = rgb(c);
  return [clamp01(x[0] * f), clamp01(x[1] * f), clamp01(x[2] * f)];
}

// Samples a list of colour stops at t (0..1).
export function ramp(stops, t) {
  const n = stops.length - 1;
  const x = Math.min(n, Math.max(0, t * n));
  const i = Math.min(n - 1, Math.floor(x));
  return mix(stops[i], stops[i + 1], x - i);
}

const clamp01 = (v) => (v < 0 ? 0 : v > 1 ? 1 : v);
export const clamp = (v, lo, hi) => (v < lo ? lo : v > hi ? hi : v);
export const smoothstep = (a, b, x) => {
  const t = clamp01((x - a) / (b - a));
  return t * t * (3 - 2 * t);
};

// ---- Shapes ------------------------------------------------------------------------
// A shape samples points on its surface in its own coordinates:
// sample(rand) -> { p, n, u, v, t? } with an outward unit normal, and knows
// its area and how deep its inside goes (thick) for interior fill.

function sphereShape(r) {
  return {
    area: 4 * Math.PI * r * r,
    thick: r,
    dims: 2,
    sample(rand) {
      const d = randomDir(rand);
      return {
        p: mul3(d, r),
        n: d,
        u: Math.atan2(d[0], d[2]) / TAU + 0.5,
        v: Math.acos(clamp(d[1], -1, 1)) / Math.PI,
      };
    },
  };
}

function ellipsoidShape(a, b, c) {
  const p = 1.6075;
  const area =
    4 *
    Math.PI *
    Math.pow((Math.pow(a * b, p) + Math.pow(a * c, p) + Math.pow(b * c, p)) / 3, 1 / p);
  const gmax = 1 / Math.min(a, b, c);
  return {
    area,
    thick: Math.min(a, b, c),
    sample(rand) {
      for (;;) {
        const d = randomDir(rand);
        const g = Math.hypot(d[0] / a, d[1] / b, d[2] / c);
        if (rand() * gmax > g) continue;
        return {
          p: [d[0] * a, d[1] * b, d[2] * c],
          n: unit([d[0] / a, d[1] / b, d[2] / c]),
          u: Math.atan2(d[0], d[2]) / TAU + 0.5,
          v: Math.acos(clamp(d[1], -1, 1)) / Math.PI,
        };
      }
    },
  };
}

function boxShape(sx, sy, sz) {
  const hx = sx / 2;
  const hy = sy / 2;
  const hz = sz / 2;
  const faces = [
    { a: sy * sz, n: [1, 0, 0] },
    { a: sy * sz, n: [-1, 0, 0] },
    { a: sx * sz, n: [0, 1, 0] },
    { a: sx * sz, n: [0, -1, 0] },
    { a: sx * sy, n: [0, 0, 1] },
    { a: sx * sy, n: [0, 0, -1] },
  ];
  const area = faces.reduce((s, f) => s + f.a, 0);
  return {
    area,
    thick: Math.min(hx, hy, hz),
    sample(rand) {
      let r = rand() * area;
      let f = faces[5];
      for (const face of faces) {
        if (r < face.a) {
          f = face;
          break;
        }
        r -= face.a;
      }
      const u = rand();
      const v = rand();
      const n = f.n;
      let p;
      if (n[0]) p = [hx * n[0], (u - 0.5) * sy, (v - 0.5) * sz];
      else if (n[1]) p = [(u - 0.5) * sx, hy * n[1], (v - 0.5) * sz];
      else p = [(u - 0.5) * sx, (v - 0.5) * sy, hz * n[2]];
      return { p, n, u, v, face: faces.indexOf(f) };
    },
  };
}

function cylinderShape(r0, r1, h, caps) {
  // A cone frustum from radius r0 at y = -h/2 to r1 at y = +h/2.
  const slant = Math.hypot(h, r0 - r1);
  const side = Math.PI * (r0 + r1) * slant;
  const capB = caps === true || caps === "bottom" ? Math.PI * r0 * r0 : 0;
  const capT = caps === true || caps === "top" ? Math.PI * r1 * r1 : 0;
  const area = side + capB + capT;
  const ny = (r0 - r1) / slant;
  const nr = h / slant;
  return {
    area,
    thick: Math.min(Math.max(r0, r1), h / 2),
    sample(rand) {
      const x = rand() * area;
      const a = rand() * TAU;
      const ca = Math.cos(a);
      const sa = Math.sin(a);
      if (x < side) {
        // Area-uniform along the slant: radius grows linearly.
        let t;
        if (Math.abs(r1 - r0) < 1e-6) t = rand();
        else {
          const q = rand();
          t = (Math.sqrt(r0 * r0 + q * (r1 * r1 - r0 * r0)) - r0) / (r1 - r0);
        }
        const r = r0 + (r1 - r0) * t;
        return {
          p: [r * sa, -h / 2 + h * t, r * ca],
          n: unit([sa * nr, ny, ca * nr]),
          u: a / TAU,
          v: 1 - t,
          side: true,
          thick: r,
        };
      }
      const top = x >= side + capB;
      const R = top ? r1 : r0;
      const rr = R * Math.sqrt(rand());
      return {
        p: [rr * sa, top ? h / 2 : -h / 2, rr * ca],
        n: [0, top ? 1 : -1, 0],
        u: a / TAU,
        v: top ? 0 : 1,
        cap: top ? "top" : "bottom",
        radial: R > 0 ? rr / R : 0,
      };
    },
  };
}

function torusShape(R, r) {
  return {
    area: 4 * Math.PI * Math.PI * R * r,
    thick: r,
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
        u: u / TAU,
        v: v / TAU,
      };
    },
  };
}

function discShape(r0, r1) {
  const area = Math.PI * (r1 * r1 - r0 * r0);
  return {
    area: area * 2,
    thick: 0.01,
    sample(rand) {
      const a = rand() * TAU;
      const r = Math.sqrt(r0 * r0 + rand() * (r1 * r1 - r0 * r0));
      const up = rand() < 0.5;
      return {
        p: [r * Math.sin(a), 0, r * Math.cos(a)],
        n: [0, up ? 1 : -1, 0],
        u: a / TAU,
        v: (r - r0) / Math.max(1e-6, r1 - r0),
      };
    },
  };
}

// A parametric surface p(u, v) on [0,1]^2, sampled area-uniformly through a
// grid of cells. Normals come from normalFn(u, v, p) when given, otherwise
// from the cross product of the partial derivatives (flip to reverse).
function paramShape(fn, { grid = 64, normal = null, flip = false, thick = 0.1 } = {}) {
  const G = grid;
  const areas = new Float64Array(G * G);
  let total = 0;
  for (let j = 0; j < G; j++) {
    for (let i = 0; i < G; i++) {
      const u0 = i / G;
      const v0 = j / G;
      const u1 = (i + 1) / G;
      const v1 = (j + 1) / G;
      const a = fn(u0, v0);
      const b = fn(u1, v0);
      const c = fn(u1, v1);
      const d = fn(u0, v1);
      const A =
        0.5 * len3(cross3(sub3(b, a), sub3(d, a))) + 0.5 * len3(cross3(sub3(b, c), sub3(d, c)));
      total += A;
      areas[j * G + i] = total;
    }
  }
  const eps = 1e-4;
  // First cell index whose running area reaches x, searching [lo, hi].
  const find = (x, lo, hi) => {
    while (lo < hi) {
      const mid = (lo + hi) >> 1;
      if (areas[mid] < x) lo = mid + 1;
      else hi = mid;
    }
    return lo;
  };
  const cellStart = (i) => (i > 0 ? areas[i - 1] : 0);
  const at = (u, v) => {
    const p = fn(u, v);
    let n;
    if (normal) n = unit(normal(u, v, p));
    else {
      const du = u + eps <= 1 ? sub3(fn(u + eps, v), p) : sub3(p, fn(u - eps, v));
      const dv = v + eps <= 1 ? sub3(fn(u, v + eps), p) : sub3(p, fn(u, v - eps));
      n = unit(flip ? cross3(dv, du) : cross3(du, dv));
    }
    return { p, n, u, v };
  };
  return {
    area: total,
    thick,
    sample(rand) {
      const lo = find(rand() * total, 0, G * G - 1);
      return at(((lo % G) + rand()) / G, (Math.floor(lo / G) + rand()) / G);
    },
    // Even sampling: a point (a, b) of the unit square, warped by area so
    // that an evenly spread set of points stays evenly spread on the surface.
    sampleEven(a, b) {
      const row = Math.floor(find(a * total, 0, G * G - 1) / G);
      const r0 = cellStart(row * G);
      const r1 = areas[row * G + G - 1];
      const fv = r1 > r0 ? (a * total - r0) / (r1 - r0) : 0.5;
      const y = r0 + b * (r1 - r0);
      const cell = find(y, row * G, row * G + G - 1);
      const c0 = cellStart(cell);
      const fu = areas[cell] > c0 ? (y - c0) / (areas[cell] - c0) : 0.5;
      return at(((cell % G) + clamp(fu, 0, 1)) / G, (row + clamp(fv, 0, 1)) / G);
    },
  };
}

// Surface of revolution around Y from a profile of [radius, y] points
// (bottom to top), smoothed with Catmull-Rom.
function latheShape(profile, { grid = 64, thick } = {}) {
  const pts = profile.map(([r, y]) => [Math.max(0, r), y]);
  const seg = pts.length - 1;
  const at = (v) => {
    const x = clamp(v, 0, 1) * seg;
    const i = Math.min(seg - 1, Math.floor(x));
    const t = x - i;
    const p0 = pts[Math.max(0, i - 1)];
    const p1 = pts[i];
    const p2 = pts[i + 1];
    const p3 = pts[Math.min(seg, i + 2)];
    const cr = (a, b, c, d) =>
      0.5 *
      (2 * b +
        (-a + c) * t +
        (2 * a - 5 * b + 4 * c - d) * t * t +
        (-a + 3 * b - 3 * c + d) * t * t * t);
    return [Math.max(0, cr(p0[0], p1[0], p2[0], p3[0])), cr(p0[1], p1[1], p2[1], p3[1])];
  };
  const maxR = Math.max(...pts.map((p) => p[0]));
  const shape = paramShape(
    (u, v) => {
      const [r, y] = at(v);
      const a = u * TAU;
      return [r * Math.sin(a), y, r * Math.cos(a)];
    },
    {
      grid,
      thick: thick ?? maxR,
      normal: (u, v) => {
        const e = 1e-3;
        const a0 = at(Math.max(0, v - e));
        const a1 = at(Math.min(1, v + e));
        const dr = a1[0] - a0[0];
        const dy = a1[1] - a0[1];
        const a = u * TAU;
        // Outward normal of the profile curve (dy, -dr) spun around Y.
        let nr = dy;
        let ny = -dr;
        if (Math.abs(nr) < 1e-9 && Math.abs(ny) < 1e-9) ny = v > 0.5 ? 1 : -1;
        return [nr * Math.sin(a), ny, nr * Math.cos(a)];
      },
    },
  );
  shape.profileAt = at;
  return shape;
}

// A tube along a curve c(t), t in [0,1], with radius r(t) (number or
// function). Frames are parallel-transported so the tube never twists.
function tubeShape(curve, radius, { closed = false, samples = 256, grid = 64, caps = false } = {}) {
  const N = samples;
  const P = [];
  const T = [];
  for (let i = 0; i <= N; i++) P.push(curve(i / N));
  for (let i = 0; i <= N; i++) {
    const a = P[Math.max(0, i - 1)];
    const b = P[Math.min(N, i + 1)];
    T.push(unit(sub3(b, a)));
  }
  if (closed) T[0] = T[N] = unit(sub3(P[1], P[N - 1]));
  const Nm = [];
  const B = [];
  const seed = Math.abs(T[0][1]) < 0.9 ? [0, 1, 0] : [1, 0, 0];
  let n0 = unit(cross3(cross3(T[0], seed), T[0]));
  for (let i = 0; i <= N; i++) {
    if (i > 0) {
      const b = cross3(T[i - 1], T[i]);
      const bl = len3(b);
      if (bl > 1e-8) {
        const ax = mul3(b, 1 / bl);
        const ang = Math.acos(clamp(dot3(T[i - 1], T[i]), -1, 1));
        n0 = quatRotate(quatAxisAngle(ax, ang), n0);
      }
      n0 = unit(sub3(n0, mul3(T[i], dot3(n0, T[i]))));
    }
    Nm.push(n0);
    B.push(cross3(T[i], n0));
  }
  const rad = typeof radius === "function" ? radius : () => radius;
  const frame = (t) => {
    const x = clamp(t, 0, 1) * N;
    const i = Math.min(N - 1, Math.floor(x));
    const f = x - i;
    const p = add3(mul3(P[i], 1 - f), mul3(P[i + 1], f));
    const nn = unit(add3(mul3(Nm[i], 1 - f), mul3(Nm[i + 1], f)));
    const tt = unit(add3(mul3(T[i], 1 - f), mul3(T[i + 1], f)));
    return { p, n: nn, b: cross3(tt, nn), t: tt };
  };
  let maxR = 0;
  for (let i = 0; i <= 16; i++) maxR = Math.max(maxR, rad(i / 16));
  const shape = paramShape(
    (u, v) => {
      const f = frame(v);
      const a = u * TAU;
      const r = rad(v);
      return add3(f.p, add3(mul3(f.n, r * Math.cos(a)), mul3(f.b, r * Math.sin(a))));
    },
    {
      grid,
      thick: maxR,
      normal: (u, v) => {
        const f = frame(v);
        const a = u * TAU;
        return add3(mul3(f.n, Math.cos(a)), mul3(f.b, Math.sin(a)));
      },
    },
  );
  const withFrame = (s) => {
    s.t = s.v;
    s.tangent = frame(s.v).t;
    return s;
  };
  const inner = shape.sample;
  const innerEven = shape.sampleEven;
  shape.sample = (rand) => withFrame(inner(rand));
  shape.sampleEven = (a, b) => withFrame(innerEven(a, b));
  shape.frame = frame;
  if (caps && !closed) {
    const r0 = rad(0);
    const r1 = rad(1);
    const capA = Math.PI * (r0 * r0 + r1 * r1);
    const body = shape.area;
    const sampleBody = shape.sample;
    // Capped tubes fall back to the plain sampler under even: true.
    shape.sampleEven = null;
    shape.area = body + capA;
    shape.sample = (rand) => {
      if (rand() * shape.area < body) return sampleBody(rand);
      const end = rand() * capA < Math.PI * r0 * r0 ? 0 : 1;
      const f = frame(end);
      const r = rad(end) * Math.sqrt(rand());
      const a = rand() * TAU;
      const p = add3(f.p, add3(mul3(f.n, r * Math.cos(a)), mul3(f.b, r * Math.sin(a))));
      return { p, n: end ? f.t : mul3(f.t, -1), u: a / TAU, v: end, t: end, tangent: f.t };
    };
  }
  return shape;
}

// A rounded box (superellipsoid): half sizes and a roundness exponent (2 is
// an ellipsoid, 8 or more is nearly a box).
function roundedBoxShape(sx, sy, sz, power = 8) {
  const e = 2 / power;
  const sgnpow = (x, k) => Math.sign(x) * Math.pow(Math.abs(x), k);
  return paramShape(
    (u, v) => {
      const th = (v - 0.5) * Math.PI;
      const ph = u * TAU - Math.PI;
      const ct = sgnpow(Math.cos(th), e);
      const st = sgnpow(Math.sin(th), e);
      return [
        (sx / 2) * ct * sgnpow(Math.sin(ph), e),
        (sy / 2) * st,
        (sz / 2) * ct * sgnpow(Math.cos(ph), e),
      ];
    },
    {
      grid: 72,
      thick: Math.min(sx, sy, sz) / 2,
      normal: (u, v, p) => {
        const k = power - 1;
        return [
          (Math.sign(p[0]) * Math.pow(Math.abs((2 * p[0]) / sx), k)) / sx,
          (Math.sign(p[1]) * Math.pow(Math.abs((2 * p[1]) / sy), k)) / sy,
          (Math.sign(p[2]) * Math.pow(Math.abs((2 * p[2]) / sz), k)) / sz,
        ];
      },
    },
  );
}

// A star-shaped surface: the distance from the origin along each direction.
function radialShape(radius, { grid = 72, thick } = {}) {
  let maxR = 0;
  const shape = paramShape(
    (u, v) => {
      const th = v * Math.PI;
      const ph = u * TAU;
      const d = [Math.sin(th) * Math.sin(ph), Math.cos(th), Math.sin(th) * Math.cos(ph)];
      const r = radius(d);
      if (r > maxR) maxR = r;
      return mul3(d, r);
    },
    { grid, thick: 0.5, flip: true },
  );
  shape.thick = thick ?? maxR * 0.9;
  return shape;
}

// Distance to an implicit surface f(p) = 0 (negative inside) along a
// direction, by bisection between 0 and `far`.
export function implicitRadius(f, far = 2, steps = 28) {
  return (d) => {
    let lo = 0;
    let hi = far;
    for (let i = 0; i < steps; i++) {
      const mid = (lo + hi) / 2;
      if (f(mul3(d, mid)) < 0) lo = mid;
      else hi = mid;
    }
    return (lo + hi) / 2;
  };
}

// ---- Kit ---------------------------------------------------------------------------

function kindOf(k) {
  if (typeof k === "number") return k;
  if (!k) return 0;
  const n = KINDS[k];
  if (n === undefined) throw new Error(`Unknown behaviour "${k}"`);
  return n;
}

export class Kit {
  constructor(seed, { count = 120000, options = {}, fit = true } = {}) {
    this.seed = seed >>> 0;
    this.count = count;
    this.fitOn = fit; // false keeps the recipe's coordinates (scan rig add-ons)
    this.options = options;
    this.rand = mulberry32(mixSeed(seed, "kit-recipe"));
    this.noise = createNoise3(mixSeed(seed, "kit-noise"));
    this.items = [];
    this.parts = [{ name: "body", pivot: [0, 0, 0], axis: [0, 1, 0] }];
    this.partIndex = new Map();
    this.reaches = [];
  }

  // Points the toy reaches while it moves (rising flames, an opened lid), so
  // the camera frames them. In recipe coordinates.
  reach(p) {
    this.reaches.push(p.slice());
  }

  // Shapes.
  sphere(r = 0.8) {
    return sphereShape(r);
  }
  ellipsoid(a, b, c) {
    return ellipsoidShape(a, b, c);
  }
  box(sx, sy, sz) {
    return boxShape(sx, sy, sz);
  }
  roundedBox(sx, sy, sz, power = 8) {
    return roundedBoxShape(sx, sy, sz, power);
  }
  cylinder(r, h, { caps = true } = {}) {
    return cylinderShape(r, r, h, caps);
  }
  cone(r0, r1, h, { caps = true } = {}) {
    return cylinderShape(r0, r1, h, caps);
  }
  torus(R, r) {
    return torusShape(R, r);
  }
  disc(r1, r0 = 0) {
    return discShape(r0, r1);
  }
  lathe(profile, opts) {
    return latheShape(profile, opts);
  }
  tube(curve, radius, opts) {
    return tubeShape(curve, radius, opts);
  }
  param(fn, opts) {
    return paramShape(fn, opts);
  }
  radial(radius, opts) {
    return radialShape(radius, opts);
  }

  // A rigid part (for hinges, spins and slides). Returns its index.
  part(name, { pivot = [0, 0, 0], axis = [0, 1, 0] } = {}) {
    if (this.partIndex.has(name)) return this.partIndex.get(name);
    if (this.parts.length >= 16) throw new Error("A toy can have at most 15 parts.");
    this.parts.push({ name, pivot: pivot.slice(), axis: unit(axis) });
    const i = this.parts.length - 1;
    this.partIndex.set(name, i);
    return i;
  }

  // Adds a shape. Options:
  //   pos, rot (degrees, X then Y then Z) or quat, scale (number or [x,y,z])
  //   color: "#hex" | [r,g,b] | (c) => colour, where c = { p, n, lp, ln, u, v,
  //          t, rand, noise, fbm }. A colour function can also return
  //          { c: colour, keep: true, size } to keep one splat out of the
  //          pattern layer (seams, stitches) or resize it, or null to leave
  //          a hole.
  //   weight (density, default 1) | share (fraction of the budget) | count
  //   size (splat size multiplier), flat (thickness 0..1), stretch (length
  //   along the shape's tangent), opacity, jitter (colour noise 0..1)
  //   interior (fraction of this shape's splats that fill its inside), core
  //   part, kind (behaviour name), params ([a, b] or (c) => [a, b])
  //   pattern: false keeps the pattern layer off these splats
  //   even: true spreads the surface splats evenly (a low-discrepancy
  //          sequence) instead of at random; random placement leaves thin
  //          spots where the far side shows through as dark speckle. It
  //          works for spheres, boxes, cylinders, cones, lathes and param
  //          surfaces (shapes that take a fixed number of random numbers
  //          per splat); other shapes are placed at random as before.
  add(shape, opts = {}) {
    const q = opts.quat || (opts.rot ? quatEuler(...opts.rot) : [0, 0, 0, 1]);
    const sc =
      opts.scale === undefined
        ? [1, 1, 1]
        : Array.isArray(opts.scale)
          ? opts.scale
          : [opts.scale, opts.scale, opts.scale];
    const scaleArea = Math.pow(Math.abs(sc[0] * sc[1] * sc[2]), 2 / 3);
    const item = {
      kind: "surface",
      shape,
      opts,
      q,
      sc,
      pos: opts.pos || [0, 0, 0],
      area: shape.area * scaleArea,
    };
    this.items.push(item);
    return item;
  }

  // Free-form splats: sample(rand, i, n) -> { p, color, size?, opacity?,
  // n?, flat?, part?, kind?, params?, pattern? } in toy coordinates.
  // Sized by share (fraction of the budget) or count.
  cloud(opts, sample) {
    const item = { kind: "cloud", opts, sample, area: 0 };
    this.items.push(item);
    return item;
  }

  // ---- Build ------------------------------------------------------------------------

  // Runs after the recipe: shares out the budget, emits the splats and fits
  // the toy into the unit sphere. Yields progress (0..1).
  *emit() {
    const N = this.count;
    const scaleCount = N / 160000;
    let fixed = 0;
    let weighted = 0;
    for (const it of this.items) {
      const o = it.opts;
      if (o.count !== undefined) it.n = Math.max(1, Math.round(o.count * scaleCount));
      else if (o.share !== undefined) it.n = Math.max(1, Math.round(o.share * N));
      else it.n = -1;
      if (it.n >= 0) fixed += it.n;
      else weighted += it.area * (o.weight ?? 1);
    }
    const rest = Math.max(0, N - fixed);
    for (const it of this.items) {
      if (it.n < 0)
        it.n = Math.max(8, Math.round((rest * it.area * (it.opts.weight ?? 1)) / (weighted || 1)));
    }
    // Base splat size from the density of the weighted surfaces.
    const autoCount = this.items
      .filter((it) => it.opts.count === undefined && it.opts.share === undefined)
      .reduce((s, it) => s + it.n, 0);
    this.baseSize =
      weighted > 0 ? Math.sqrt(weighted / (Math.max(1, autoCount) * Math.PI)) * 1.2 : 0.01;
    const total = this.items.reduce((s, it) => s + it.n, 0);
    const buf = new SplatBuffer(total + clayBudget(total), { anim: true });
    this.buf = buf;
    const rand = mulberry32(mixSeed(this.seed, "kit-splats"));
    const fbm = (x, y, z, o = 3) => this.noise.fbm(x, y, z, o);
    let done = 0;
    let nextYield = 6000;
    for (const it of this.items) {
      if (it.kind === "cloud") this.emitCloud(it, rand);
      else this.emitSurface(it, rand, fbm);
      done += it.n;
      if (done >= nextYield) {
        nextYield = done + 6000;
        yield (done / total) * 0.9;
      }
    }
    if (this.fitOn) this.fit();
    else this.transform = { center: [0, 0, 0], scale: 1 };
    yield 1;
  }

  emitSurface(it, rand, fbm) {
    const o = it.opts;
    const buf = this.buf;
    const w = o.weight ?? 1;
    const size0 = (this.baseSize / Math.sqrt(w)) * (o.size ?? 1);
    const flat = o.flat ?? 0.2;
    const interiorN = Math.round(it.n * (o.interior ?? 0));
    const surfN = it.n - interiorN;
    const kind = kindOf(o.kind);
    const partIdx = o.part ?? 0;
    const flags = o.pattern === false ? 16 : 0;
    const jitter = o.jitter ?? 0.04;
    const opacity = o.opacity ?? 0.95;
    const colorFn = typeof o.color === "function" ? o.color : null;
    const fixedColor = colorFn ? null : rgb(o.color ?? "#cccccc");
    const coreFn = typeof o.core === "function" ? o.core : null;
    const coreColor = o.core && !coreFn ? rgb(o.core) : null;
    const paramsFn = typeof o.params === "function" ? o.params : null;
    const params = paramsFn ? null : o.params || [0, 0];
    const noise = this.noise;
    const c = { rand, noise, fbm, toy: this };
    const sc = it.sc;
    const invSc = [1 / (sc[0] || 1), 1 / (sc[1] || 1), 1 / (sc[2] || 1)];
    const shape = it.shape;
    const even = o.even ? evenRand(rand, shape.sampleEven ? 2 : (shape.dims ?? 3)) : null;
    const pick = (i) => {
      if (!even) return shape.sample(rand);
      const r = even(i);
      return shape.sampleEven ? shape.sampleEven(r(), r()) : shape.sample(r);
    };
    for (let i = 0; i < it.n; i++) {
      const inside = i >= surfN;
      const s = inside ? it.shape.sample(rand) : pick(i);
      let lp = s.p;
      if (inside) {
        const depth = 0.08 + 0.88 * Math.pow(rand(), 0.7);
        lp = sub3(lp, mul3(s.n, depth * (s.thick ?? it.shape.thick)));
      }
      const p = add3(quatRotate(it.q, [lp[0] * sc[0], lp[1] * sc[1], lp[2] * sc[2]]), it.pos);
      const n = unit(quatRotate(it.q, [s.n[0] * invSc[0], s.n[1] * invSc[1], s.n[2] * invSc[2]]));
      c.p = p;
      c.n = n;
      c.lp = s.p;
      c.ln = s.n;
      c.u = s.u;
      c.v = s.v;
      c.t = s.t;
      c.s = s;
      c.inside = inside;
      let col;
      if (inside)
        col = coreFn ? coreFn(c) : coreColor || shade(colorFn ? colorFn(c) : fixedColor, 0.8);
      else col = colorFn ? colorFn(c) : fixedColor;
      if (col === null) continue;
      let splatFlags = flags;
      let sizeMul = 1;
      if (col && !Array.isArray(col) && typeof col === "object") {
        if (col.keep) splatFlags = 16;
        if (col.size) sizeMul = col.size;
        col = col.c;
      }
      col = rgb(col);
      const sz = size0 * sizeMul * Math.exp((rand() - 0.5) * 0.5);
      let scl;
      let q;
      if (inside) {
        const r = sz * 1.5;
        scl = [r, r, r];
        q = [0, 0, 0, 1];
      } else if (o.stretch && s.tangent) {
        const tw = unit(
          quatRotate(it.q, [s.tangent[0] * sc[0], s.tangent[1] * sc[1], s.tangent[2] * sc[2]]),
        );
        const tt = unit(sub3(tw, mul3(n, dot3(tw, n))));
        scl = [sz * o.stretch, sz * 0.8, sz * flat];
        q = quatBasis(tt, cross3(n, tt), n);
      } else {
        scl = [sz, sz * (0.85 + rand() * 0.3), sz * flat];
        q = discRotation(n, rand() * TAU);
      }
      const j = jitter;
      const color = [
        clamp01(col[0] + (rand() - 0.5) * j),
        clamp01(col[1] + (rand() - 0.5) * j),
        clamp01(col[2] + (rand() - 0.5) * j),
        inside ? 0.9 : opacity,
      ];
      const pr = paramsFn ? paramsFn(c) : params;
      buf.push(p, scl, q, color, [partIdx + splatFlags, kind, pr[0] ?? 0, pr[1] ?? 0]);
    }
  }

  emitCloud(it, rand) {
    const o = it.opts;
    const buf = this.buf;
    const base = (this.baseSize || 0.01) * (o.size ?? 1);
    for (let i = 0; i < it.n; i++) {
      const s = it.sample(rand, i, it.n);
      if (!s) continue;
      const col = rgb(s.color ?? o.color ?? "#ffffff");
      const sz = base * (s.size ?? 1) * Math.exp((rand() - 0.5) * 0.5);
      let scl;
      let q;
      if (s.n) {
        const f = s.flat ?? o.flat ?? 0.3;
        scl = [sz, sz, sz * f];
        q = discRotation(unit(s.n), rand() * TAU);
      } else if (s.dir) {
        const d = unit(s.dir);
        const a = Math.abs(d[1]) < 0.9 ? [0, 1, 0] : [1, 0, 0];
        const y = unit(cross3(a, d));
        scl = [sz * (s.stretch ?? 3), sz * 0.7, sz * 0.7];
        q = quatBasis(d, y, cross3(d, y));
      } else {
        scl = [sz, sz, sz];
        q = [0, 0, 0, 1];
      }
      const kind = kindOf(s.kind ?? o.kind);
      const pr = s.params ?? o.params ?? [0, 0];
      const partIdx = s.part ?? o.part ?? 0;
      const flags = (s.pattern ?? o.pattern) === false ? 16 : 0;
      buf.push(
        s.p,
        scl,
        q,
        [col[0], col[1], col[2], s.opacity ?? o.opacity ?? 0.9],
        [partIdx + flags, kind, pr[0] ?? 0, pr[1] ?? 0],
      );
    }
  }

  // Centres the toy and scales it to fit FIT_RADIUS; moves part pivots too.
  fit() {
    const buf = this.buf;
    const lo = [Infinity, Infinity, Infinity];
    const hi = [-Infinity, -Infinity, -Infinity];
    const see = (x, y, z) => {
      const v = [x, y, z];
      for (let k = 0; k < 3; k++) {
        if (v[k] < lo[k]) lo[k] = v[k];
        if (v[k] > hi[k]) hi[k] = v[k];
      }
    };
    for (let i = 0; i < buf.count; i++) see(buf.pos[i * 3], buf.pos[i * 3 + 1], buf.pos[i * 3 + 2]);
    for (const r of this.reaches) see(r[0], r[1], r[2]);
    if (lo[0] === Infinity) {
      this.transform = { center: [0, 0, 0], scale: 1 };
      return;
    }
    const c = [(lo[0] + hi[0]) / 2, (lo[1] + hi[1]) / 2, (lo[2] + hi[2]) / 2];
    let r2 = 0;
    for (let i = 0; i < buf.count; i++) {
      const dx = buf.pos[i * 3] - c[0];
      const dy = buf.pos[i * 3 + 1] - c[1];
      const dz = buf.pos[i * 3 + 2] - c[2];
      r2 = Math.max(r2, dx * dx + dy * dy + dz * dz);
    }
    for (const r of this.reaches)
      r2 = Math.max(r2, (r[0] - c[0]) ** 2 + (r[1] - c[1]) ** 2 + (r[2] - c[2]) ** 2);
    const s = FIT_RADIUS / (Math.sqrt(r2) || 1);
    const sway = KINDS.sway;
    for (let i = 0; i < buf.count; i++) {
      for (let k = 0; k < 3; k++) {
        buf.pos[i * 3 + k] = (buf.pos[i * 3 + k] - c[k]) * s;
        buf.scale[i * 3 + k] *= s;
      }
      // Sway's base height is given in recipe coordinates; move it too.
      if (buf.anim[i * 4 + 1] === sway) buf.anim[i * 4 + 3] = (buf.anim[i * 4 + 3] - c[1]) * s;
    }
    this.baseSize *= s;
    for (const part of this.parts) part.pivot = mul3(sub3(part.pivot, c), s);
    this.reaches = this.reaches.map((r) => mul3(sub3(r, c), s));
    this.transform = { center: c, scale: s };
  }

  // Recipe coordinates -> toy coordinates (after fit).
  toToy(p) {
    const t = this.transform;
    return mul3(sub3(p, t.center), t.scale);
  }
}

// The R_d low-discrepancy sequence (Roberts, 2018), randomly offset: even(i)
// returns a rand() stand-in whose first `dims` calls give the i-th point's
// coordinates (later calls fall back to rand). Shapes whose sample() uses a
// fixed number of rand() calls then spread their points evenly.
function evenRand(rand, dims) {
  let g = 2;
  for (let k = 0; k < 30; k++) g = Math.pow(1 + g, 1 / (dims + 1));
  const alpha = [];
  const off = [];
  for (let k = 0; k < dims; k++) {
    alpha.push(1 / Math.pow(g, k + 1));
    off.push(rand());
  }
  return (i) => {
    let k = 0;
    return () => {
      if (k >= dims) return rand();
      const v = off[k] + alpha[k] * i;
      k++;
      return v - Math.floor(v);
    };
  };
}

// A smooth curve through points (Catmull-Rom), as t in [0, 1] -> point.
// Handy as the path of k.tube().
export function spline(points, { closed = false } = {}) {
  const pts = closed ? [...points, points[0]] : points;
  const n = pts.length - 1;
  const at = (i) => (closed ? pts[((i % n) + n) % n] : pts[Math.min(n, Math.max(0, i))]);
  return (t) => {
    const x = Math.min(n - 1e-6, Math.max(0, t * n));
    const i = Math.floor(x);
    const f = x - i;
    const p0 = at(i - 1);
    const p1 = at(i);
    const p2 = at(i + 1);
    const p3 = at(i + 2);
    return [0, 1, 2].map(
      (k) =>
        0.5 *
        (2 * p1[k] +
          (-p0[k] + p2[k]) * f +
          (2 * p0[k] - 5 * p1[k] + 4 * p2[k] - p3[k]) * f * f +
          (-p0[k] + 3 * p1[k] - 3 * p2[k] + p3[k]) * f * f * f),
    );
  };
}

// n directions spread evenly over the sphere (a Fibonacci lattice).
export function fibonacciSphere(n) {
  const out = [];
  const g = Math.PI * (3 - Math.sqrt(5));
  for (let i = 0; i < n; i++) {
    const y = 1 - ((i + 0.5) / n) * 2;
    const r = Math.sqrt(1 - y * y);
    out.push([Math.cos(g * i) * r, y, Math.sin(g * i) * r]);
  }
  return out;
}

// Mean brightness of a buffer (the pattern layer keeps shading relative to it).
export function meanLuminance(buf) {
  let sum = 0;
  let n = 0;
  const step = Math.max(1, Math.floor(buf.count / 20000));
  for (let i = 0; i < buf.count; i += step) {
    if (buf.color[i * 4 + 3] <= 0) continue;
    sum += 0.299 * buf.color[i * 4] + 0.587 * buf.color[i * 4 + 1] + 0.114 * buf.color[i * 4 + 2];
    n++;
  }
  return n ? sum / n : 0.5;
}

// Clay on kit toys takes its colour from the nearest existing splat.
export function nearestColoring(buf) {
  const G = 24;
  let grid = null;
  const cell = (v) => Math.min(G - 1, Math.max(0, Math.floor(((v + 1) / 2) * G)));
  const build = () => {
    grid = new Map();
    for (let i = 0; i < buf.count; i++) {
      if (buf.color[i * 4 + 3] <= 0) continue;
      const key =
        cell(buf.pos[i * 3]) + G * (cell(buf.pos[i * 3 + 1]) + G * cell(buf.pos[i * 3 + 2]));
      let list = grid.get(key);
      if (!list) grid.set(key, (list = []));
      if (list.length < 64) list.push(i);
    }
  };
  return {
    surface(p) {
      if (!grid) build();
      const cx = cell(p[0]);
      const cy = cell(p[1]);
      const cz = cell(p[2]);
      let best = -1;
      let bd = Infinity;
      for (let r = 0; r <= 3 && best < 0; r++) {
        for (let z = cz - r; z <= cz + r; z++)
          for (let y = cy - r; y <= cy + r; y++)
            for (let x = cx - r; x <= cx + r; x++) {
              if (x < 0 || y < 0 || z < 0 || x >= G || y >= G || z >= G) continue;
              const list = grid.get(x + G * (y + G * z));
              if (!list) continue;
              for (const i of list) {
                const d =
                  (buf.pos[i * 3] - p[0]) ** 2 +
                  (buf.pos[i * 3 + 1] - p[1]) ** 2 +
                  (buf.pos[i * 3 + 2] - p[2]) ** 2;
                if (d < bd) {
                  bd = d;
                  best = i;
                }
              }
            }
      }
      if (best < 0) return [0.8, 0.8, 0.8];
      return [buf.color[best * 4], buf.color[best * 4 + 1], buf.color[best * 4 + 2]];
    },
    core(p) {
      return this.surface(p);
    },
    displace() {
      return 0;
    },
  };
}

// Builds a recipe into a toy context the player can show. Yields progress;
// returns { g, buf, base, coloring, parts, recipe, lum }.
export function* buildRecipe(recipe, { seed, count, options = {}, clay = [] }, applyClay) {
  const k = new Kit(seed, { count, options });
  recipe.build(k, options);
  const it = k.emit();
  let r = it.next();
  while (!r.done) {
    yield r.value * 0.95;
    r = it.next();
  }
  const ctx = {
    g: { seed, count, sizeJitter: 0.3 },
    buf: k.buf,
    base: k.baseSize,
    coloring: nearestColoring(k.buf),
    parts: k.parts,
    reaches: k.reaches,
    transform: k.transform,
    recipe,
    kit: k,
  };
  for (let i = 0; i < clay.length; i++) applyClay(ctx, clay[i], i);
  ctx.lum = meanLuminance(k.buf);
  yield 1;
  return ctx;
}

export { norm };
