// The character's body, sculpted with the kit (lane Character): a person
// about 7.5 heads tall in a long-sleeved crew-neck top, straight-leg
// trousers and sneakers. Every part is its own rigid splat cloud around
// its joint (character.js lists the joints); the joints hide the way real
// clothes do: a rounded cap of cloth or skin centered on each pivot (the
// same from every angle, so it never opens), sleeves over the elbows and
// wrists, trouser legs over the knees and the shoe tops.
//
// Built in the rest pose in the character's own space (meters, facing +z,
// feet at y = 0), then each part is moved to sit around its pivot.
//
// The surfaces are lofts (rings of superellipses joined smoothly), tubes
// and signed-distance shapes (the head and hair), all with even placement,
// full opacity, flat splats and clean colors lit by one soft light.

import { Kit, mix, shade, rgb, clamp, smoothstep, implicitRadius } from "../kit.js";
import { mixSeed } from "../noise.js";
import { evenTorus } from "../packs/even.js";

const TAU = Math.PI * 2;
const sp = (x, e) => Math.sign(x) * Math.pow(Math.abs(x), e);
const len = (v) => Math.hypot(v[0], v[1], v[2]);
const unit = (v) => {
  const l = len(v) || 1;
  return [v[0] / l, v[1] / l, v[2] / l];
};

// ---- Light -------------------------------------------------------------------------
// One soft key light from above, in front and to the character's right, a
// little sky from above, and ambient occlusion where a caller asks for it.
const KEY = unit([-0.42, 0.78, 0.46]);
export function lit(col, n, ao = 1, k = 1) {
  const d = n[0] * KEY[0] + n[1] * KEY[1] + n[2] * KEY[2];
  const wrap = Math.max(0, (d + 0.4) / 1.4);
  const f = (0.6 + 0.36 * wrap * k + 0.07 * n[1]) * ao;
  return shade(col, f);
}

// ---- Surfaces ----------------------------------------------------------------------

function cr(a, b, c, d, t) {
  return 0.5 * (2 * b + (-a + c) * t + (2 * a - 5 * b + 4 * c - d) * t * t + (-a + 3 * b - 3 * c + d) * t * t * t); // prettier-ignore
}
const KEYS = ["y", "x", "f", "b", "cx", "cz", "p"];
function ringAt(rings, s) {
  const n = rings.length - 1;
  const i = Math.min(n - 1, Math.max(0, Math.floor(s)));
  const t = clamp(s - i, 0, 1);
  const r0 = rings[Math.max(0, i - 1)];
  const r1 = rings[i];
  const r2 = rings[i + 1];
  const r3 = rings[Math.min(n, i + 2)];
  const out = {};
  for (const key of KEYS) {
    const g = (r) => r[key] ?? (key === "p" ? 2 : key === "b" ? r.f : 0);
    out[key] = cr(g(r0), g(r1), g(r2), g(r3), t);
  }
  out.x = Math.max(0, out.x);
  out.f = Math.max(0, out.f);
  out.b = Math.max(0, out.b);
  return out;
}

// A loft: rings (bottom to top) of superellipses with a half-width x, a
// front depth f and a back depth b (along z), centered at (cx, cz), with
// exponent p (2 an ellipse, higher boxier), joined by smooth curves.
// `from`/`to` pick a stretch of the rings (for a piece that overlaps its
// neighbor); `disp(a, y, s)` pushes the surface out along its ring (folds,
// seams). axis "z" lofts along z instead (the shoes): then y is the ring's
// place along z, cx and cz its center in x and y, f its top and b its
// bottom. Its splats carry `ring` (a, y) for color functions.
export function loft(
  k,
  rings,
  { from = 0, to = rings.length - 1, disp = null, grid = 96, axis = "y" } = {},
) {
  const fn = (u, v) => {
    const s = from + v * (to - from);
    const R = ringAt(rings, s);
    const a = u * TAU;
    const e = 2 / R.p;
    let dx = R.x * sp(Math.sin(a), e);
    let dz = (Math.cos(a) >= 0 ? R.f : R.b) * sp(Math.cos(a), e);
    if (disp) {
      const d = disp(a, R.y, s);
      const l = Math.hypot(dx, dz) || 1;
      dx += (dx / l) * d;
      dz += (dz / l) * d;
    }
    return axis === "z" ? [R.cx + dx, R.cz + dz, R.y] : [R.cx + dx, R.y, R.cz + dz];
  };
  return k.param(fn, { grid, flip: axis === "z" });
}

// A capsule-like tube along a curve, its radius r(t) closing smoothly to a
// point at both ends (a closed surface that takes even placement).
export function rodShape(k, curve, r, { cap = 0.12, grid = 48 } = {}) {
  const rad = typeof r === "function" ? r : () => r;
  const end = (t) => {
    const x = Math.min(t, 1 - t) / cap;
    return x >= 1 ? 1 : Math.sqrt(Math.max(0, 1 - (1 - x) * (1 - x)));
  };
  return k.tube(curve, (t) => Math.max(1e-4, rad(t) * end(t)), { grid });
}

// A polyline curve through points, smoothed (Catmull-Rom), t in [0, 1].
export function curveThrough(points) {
  const n = points.length - 1;
  return (t) => {
    const x = clamp(t, 0, 1) * n;
    const i = Math.min(n - 1, Math.floor(x));
    const f = x - i;
    const p0 = points[Math.max(0, i - 1)];
    const p1 = points[i];
    const p2 = points[i + 1];
    const p3 = points[Math.min(n, i + 2)];
    return [0, 1, 2].map((j) => cr(p0[j], p1[j], p2[j], p3[j], f));
  };
}

// An even ellipsoid (k.ellipsoid places its splats at random).
export function ellipsoid(k, a, b, c, grid = 48) {
  return k.param(
    (u, v) => {
      const th = v * Math.PI;
      const ph = u * TAU;
      return [a * Math.sin(th) * Math.sin(ph), b * Math.cos(th), c * Math.sin(th) * Math.cos(ph)];
    },
    { grid, flip: true, thick: Math.min(a, b, c) },
  );
}

// Signed distances.
export const sdEllipsoid = (p, c, r) => {
  const x = (p[0] - c[0]) / r[0];
  const y = (p[1] - c[1]) / r[1];
  const z = (p[2] - c[2]) / r[2];
  const k0 = Math.sqrt(x * x + y * y + z * z);
  const k1 = Math.sqrt((x * x) / (r[0] * r[0]) + (y * y) / (r[1] * r[1]) + (z * z) / (r[2] * r[2]));
  return k1 > 1e-9 ? (k0 * (k0 - 1)) / k1 : -Math.min(r[0], r[1], r[2]);
};
export const sdCapsule = (p, a, b, r) => {
  const pa = [p[0] - a[0], p[1] - a[1], p[2] - a[2]];
  const ba = [b[0] - a[0], b[1] - a[1], b[2] - a[2]];
  const h = clamp((pa[0] * ba[0] + pa[1] * ba[1] + pa[2] * ba[2]) / (ba[0] ** 2 + ba[1] ** 2 + ba[2] ** 2), 0, 1); // prettier-ignore
  const rr = typeof r === "function" ? r(h) : r;
  const dx = pa[0] - ba[0] * h;
  const dy = pa[1] - ba[1] * h;
  const dz = pa[2] - ba[2] * h;
  return Math.sqrt(dx * dx + dy * dy + dz * dz) - rr;
};
export const smin = (a, b, k) => {
  const h = clamp(0.5 + (0.5 * (b - a)) / k, 0, 1);
  return b + (a - b) * h - k * h * (1 - h);
};
export const smax = (a, b, k) => -smin(-a, -b, k);

// A closed surface around `center` from a signed distance (star-shaped as
// seen from the center). The distance along each direction is found once
// on a grid (by bisection) and read back smoothly; normals come from the
// distance field itself, so small features shade crisply.
export function sdfShape(k, sdf, center, { far = 0.3, nu = 320, nv = 160, grid = 128 } = {}) {
  const f = (p) => sdf([p[0] + center[0], p[1] + center[1], p[2] + center[2]]);
  const map = new Float32Array((nu + 1) * (nv + 1));
  const dir = (u, v) => {
    const th = v * Math.PI;
    const ph = u * TAU;
    return [Math.sin(th) * Math.sin(ph), Math.cos(th), Math.sin(th) * Math.cos(ph)];
  };
  const along = (d, r) => f([d[0] * r, d[1] * r, d[2] * r]);
  let prev = far / 2;
  for (let j = 0; j <= nv; j++) {
    for (let i = 0; i <= nu; i++) {
      const d = dir(i / nu, j / nv);
      let lo = Math.max(0, prev - 0.015);
      let hi = Math.min(far, prev + 0.015);
      if (!(along(d, lo) < 0 && along(d, hi) >= 0)) {
        lo = 0;
        hi = far;
      }
      const steps = hi - lo > 0.05 ? 20 : 13;
      for (let s = 0; s < steps; s++) {
        const m = (lo + hi) / 2;
        if (along(d, m) < 0) lo = m;
        else hi = m;
      }
      prev = (lo + hi) / 2;
      map[j * (nu + 1) + i] = prev;
    }
  }
  const at = (i, j) => {
    i = ((i % nu) + nu) % nu;
    j = Math.max(0, Math.min(nv, j));
    return map[j * (nu + 1) + i];
  };
  const radius = (u, v) => {
    const x = u * nu;
    const y = v * nv;
    const i = Math.floor(x);
    const j = Math.floor(y);
    const tx = x - i;
    const ty = y - j;
    const row = (jj) => cr(at(i - 1, jj), at(i, jj), at(i + 1, jj), at(i + 2, jj), tx);
    return cr(row(j - 1), row(j), row(j + 1), row(j + 2), ty);
  };
  const e = 2e-4;
  return k.param(
    (u, v) => {
      const d = dir(u, v);
      const r = radius(u, v);
      return [d[0] * r, d[1] * r, d[2] * r];
    },
    {
      grid,
      thick: far / 3,
      normal: (u, v, p) => [
        f([p[0] + e, p[1], p[2]]) - f([p[0] - e, p[1], p[2]]),
        f([p[0], p[1] + e, p[2]]) - f([p[0], p[1] - e, p[2]]),
        f([p[0], p[1], p[2] + e]) - f([p[0], p[1], p[2] - e]),
      ],
    },
  );
}

// ---- The body ----------------------------------------------------------------------

// Each part's shapes: build(k, ctx) adds them in the character's space.
// `w` is how many splats a square meter of the part gets, relative to the
// clothes (faces and hands are looked at).
export const PARTS = {
  hips: { build: buildPelvis },
  torso: { build: (k, x) => buildShirt(k, x, "torso") },
  chest: { build: (k, x) => buildShirt(k, x, "chest") },
  neck: { build: buildNeck },
  head: { build: buildHead },
  armL: { build: (k, x) => buildUpperArm(k, x, 1) },
  armR: { build: (k, x) => buildUpperArm(k, x, -1) },
  foreL: { build: (k, x) => buildForearm(k, x, 1) },
  foreR: { build: (k, x) => buildForearm(k, x, -1) },
  handL: { build: (k, x) => buildHand(k, x, 1) },
  handR: { build: (k, x) => buildHand(k, x, -1) },
  fingersL: { build: (k, x) => buildFingers(k, x, 1) },
  fingersR: { build: (k, x) => buildFingers(k, x, -1) },
  thighL: { build: (k, x) => buildThigh(k, x, 1) },
  thighR: { build: (k, x) => buildThigh(k, x, -1) },
  shinL: { build: (k, x) => buildShin(k, x, 1) },
  shinR: { build: (k, x) => buildShin(k, x, -1) },
  footL: { build: (k, x) => buildShoe(k, x, 1, "foot") },
  footR: { build: (k, x) => buildShoe(k, x, -1, "foot") },
  toesL: { build: (k, x) => buildShoe(k, x, 1, "toes") },
  toesR: { build: (k, x) => buildShoe(k, x, -1, "toes") },
};

// The look: the world file's five colors, and the colors that follow from
// them (the soles, laces, lips, eyes and brows).
export function palette(look) {
  const skin = rgb(look.skin);
  const hair = rgb(look.hair);
  const lum = (c) => 0.3 * c[0] + 0.59 * c[1] + 0.11 * c[2];
  return {
    skin,
    hair,
    shirt: rgb(look.shirt),
    trousers: rgb(look.trousers),
    shoes: rgb(look.shoes),
    sole: rgb("#ece8df"),
    lace: lum(rgb(look.shoes)) > 0.6 ? rgb("#9a9a9e") : rgb("#f1efe9"),
    lips: mix(skin, "#a4544c", 0.46),
    brow: shade(hair, lum(hair) > 0.45 ? 0.72 : 0.85),
    iris: lum(hair) > 0.42 ? rgb("#4f6f86") : rgb("#4a2f1f"),
    sock: mix(rgb(look.trousers), "#2b2b2e", 0.6),
  };
}

// ---- Clothes: the top ----------------------------------------------------------------

// The top, from its hem to the collar. The abdomen ("torso") takes the
// rings from the hem to the lower ribs, the chest the rest; they overlap
// by 8 cm so a twist of the spine never opens a gap.
const SHIRT = [
  { y: 0.951, x: 0.141, f: 0.099, b: 0.105, p: 2.3 },
  { y: 0.955, x: 0.153, f: 0.109, b: 0.115, p: 2.3 },
  { y: 0.964, x: 0.157, f: 0.113, b: 0.119, p: 2.3 },
  { y: 0.975, x: 0.153, f: 0.109, b: 0.114, p: 2.3 },
  { y: 1.02, x: 0.147, f: 0.103, b: 0.106, p: 2.3 },
  { y: 1.07, x: 0.142, f: 0.099, b: 0.099, p: 2.3 },
  { y: 1.13, x: 0.148, f: 0.105, b: 0.098, p: 2.35 },
  { y: 1.2, x: 0.157, f: 0.115, b: 0.1, p: 2.4 },
  { y: 1.27, x: 0.162, f: 0.12, b: 0.104, p: 2.5 },
  { y: 1.33, x: 0.163, f: 0.114, b: 0.104, p: 2.6 },
  { y: 1.38, x: 0.176, f: 0.096, b: 0.096, p: 2.6 },
  { y: 1.412, x: 0.19, f: 0.08, b: 0.086, p: 2.4 },
  { y: 1.44, x: 0.158, f: 0.07, b: 0.078, p: 2.2 },
  { y: 1.456, x: 0.1, f: 0.062, b: 0.07, p: 2 },
  { y: 1.466, x: 0.066, f: 0.058, b: 0.062, p: 2 },
];

function buildShirt(k, x, which) {
  const { c } = x;
  const idx = (y) => {
    for (let i = 0; i < SHIRT.length - 1; i++)
      if (y <= SHIRT[i + 1].y) return i + (y - SHIRT[i].y) / (SHIRT[i + 1].y - SHIRT[i].y);
    return SHIRT.length - 1;
  };
  const range = which === "torso" ? [0, idx(1.24)] : [idx(1.16), SHIRT.length - 1];
  // Folds: a few soft ridges where the cloth gathers at the waist's sides,
  // and the hem's turned edge.
  const disp = (a, y) => {
    const side = Math.pow(Math.abs(Math.sin(a)), 3);
    const waist = smoothstep(0.99, 1.04, y) * (1 - smoothstep(1.1, 1.17, y));
    return waist * side * 0.003 * Math.sin(y * 110 + Math.sin(a) * 2);
  };
  k.add(loft(k, SHIRT, { from: range[0], to: range[1], disp, grid: 128 }), {
    even: true,
    opacity: 1,
    flat: 0.22,
    jitter: 0.006,
    color: (s) => {
      const y = s.p[1];
      let col = c.shirt;
      // The hem band and the side seams.
      if (y < 0.972) col = shade(col, 0.92);
      if (s.n[1] < -0.5) col = shade(col, 0.8); // the hem's underside
      // Shade under the chest.
      const ao =
        1 - 0.08 * smoothstep(1.25, 1.17, y) * smoothstep(1.1, 1.16, y) * Math.max(0, s.n[2]);
      return lit(col, s.n, ao);
    },
  });
  if (which === "chest") {
    // The ribbed crew collar, round the neck.
    const collar = [
      { y: 1.446, x: 0.072, f: 0.064, b: 0.068 },
      { y: 1.458, x: 0.073, f: 0.065, b: 0.069 },
      { y: 1.468, x: 0.069, f: 0.061, b: 0.065 },
      { y: 1.473, x: 0.062, f: 0.054, b: 0.058 },
      { y: 1.4745, x: 0.056, f: 0.049, b: 0.053 },
    ].map((r) => ({ ...r, cz: -0.004 + (r.y - 1.446) * 0.1 }));
    k.add(loft(k, collar, { grid: 64 }), {
      even: true,
      weight: 1.6,
      opacity: 1,
      flat: 0.22,
      jitter: 0.004,
      color: (s) => lit(shade(c.shirt, s.n[1] > 0.5 ? 0.86 : 0.95), s.n),
    });
  }
}

// ---- Clothes: the trousers ---------------------------------------------------------

function trouserColor(c, s, extra = 0) {
  // Denim-like cloth: a soft twill tone, no speckle.
  return lit(shade(c.trousers, 1 + extra), s.n);
}

function buildPelvis(k, { c }) {
  const rings = [
    { y: 0.8, x: 0.03, f: 0.03, b: 0.03 },
    { y: 0.822, x: 0.1, f: 0.055, b: 0.065 },
    { y: 0.86, x: 0.155, f: 0.085, b: 0.105 },
    { y: 0.9, x: 0.172, f: 0.097, b: 0.12, p: 2.2 },
    { y: 0.94, x: 0.166, f: 0.099, b: 0.116, p: 2.2 },
    { y: 0.962, x: 0.146, f: 0.094, b: 0.104, p: 2.2 },
    { y: 0.972, x: 0.11, f: 0.07, b: 0.075, p: 2.2 },
  ];
  k.add(loft(k, rings, { grid: 96 }), {
    even: true,
    opacity: 1,
    flat: 0.22,
    jitter: 0.006,
    color: (s) => {
      const [px, py, pz] = s.p;
      let e = 0;
      // The back pockets: two stitched outlines on the seat.
      if (pz < -0.05) {
        const qx = Math.abs(px) - 0.072;
        const qy = py - 0.9;
        const inside = Math.abs(qx) < 0.042 && qy < 0.035 && qy > -0.045 + Math.abs(qx) * 0.35;
        const edge = inside && (Math.abs(Math.abs(qx) - 0.042) < 0.003 || Math.abs(qy - 0.035) < 0.003 || qy < -0.042 + Math.abs(qx) * 0.35); // prettier-ignore
        if (edge) e = -0.14;
        else if (inside) e = 0.03;
      }
      // The center seam.
      if (Math.abs(px) < 0.002 && py < 0.97) e = -0.12;
      return trouserColor(c, s, e);
    },
  });
}

// The trouser legs. Thigh rings are in the leg's own x (0 at the hip
// joint): straight-leg cut, the cloth over the knee in the shin's part.
function buildThigh(k, { c, pivot }, side) {
  const [hx, hy] = [pivot.x, pivot.y];
  const rings = [
    { y: hy - 0.462, x: 0.012, f: 0.012 },
    { y: hy - 0.45, x: 0.05, f: 0.052 },
    { y: hy - 0.43, x: 0.061, f: 0.064, b: 0.06 },
    { y: hy - 0.36, x: 0.066, f: 0.071, b: 0.068 },
    { y: hy - 0.24, x: 0.076, f: 0.079, b: 0.082 },
    { y: hy - 0.11, x: 0.087, f: 0.086, b: 0.093 },
    { y: hy - 0.02, x: 0.092, f: 0.089, b: 0.097 },
    { y: hy + 0.03, x: 0.088, f: 0.085, b: 0.092 },
    { y: hy + 0.06, x: 0.06, f: 0.06, b: 0.06 },
  ].map((r) => ({ ...r, cx: hx + side * 0.006 }));
  // The creases behind the knee and across the lap.
  const disp = (a, y) => {
    const back = Math.max(0, -Math.cos(a));
    const knee = Math.exp(-Math.pow((y - (hy - 0.39)) / 0.035, 2));
    const lap = Math.exp(-Math.pow((y - (hy - 0.08)) / 0.04, 2)) * Math.max(0, Math.cos(a));
    return 0.0028 * Math.sin(y * 170) * (knee * back + lap * 0.6);
  };
  k.add(loft(k, rings, { disp, grid: 96 }), {
    even: true,
    opacity: 1,
    flat: 0.22,
    jitter: 0.006,
    color: (s) => {
      // The outer side seam.
      const out = (s.p[0] - hx) * side;
      const seam = out > 0 && Math.abs(Math.atan2(s.p[2], out)) < 0.03;
      return trouserColor(c, s, seam ? -0.12 : 0);
    },
  });
}

function buildShin(k, { c, pivot }, side) {
  const [kx, ky] = [pivot.x, pivot.y];
  // The knee: a ball of cloth centered on the joint.
  k.add(ellipsoid(k, 0.062, 0.062, 0.064), {
    pos: [kx + side * 0.004, ky, 0],
    even: true,
    opacity: 1,
    flat: 0.22,
    jitter: 0.006,
    color: (s) => trouserColor(c, s),
  });
  const hem = 0.098; // the hem's height above the ground
  const rings = [
    { y: hem - 0.004, x: 0.052, f: 0.056, b: 0.06 },
    { y: hem, x: 0.059, f: 0.063, b: 0.066 },
    { y: hem + 0.02, x: 0.059, f: 0.063, b: 0.066 },
    { y: hem + 0.09, x: 0.056, f: 0.06, b: 0.062 },
    { y: 0.26, x: 0.056, f: 0.059, b: 0.063 },
    { y: 0.36, x: 0.058, f: 0.06, b: 0.066 },
    { y: ky - 0.02, x: 0.06, f: 0.062, b: 0.064 },
    { y: ky + 0.03, x: 0.058, f: 0.06, b: 0.06 },
    { y: ky + 0.055, x: 0.03, f: 0.03, b: 0.03 },
  ].map((r) => ({ ...r, cx: kx + side * 0.004, cz: -0.004 }));
  // The cloth stacks a little above the shoe.
  const disp = (a, y) => 0.0024 * Math.sin(y * 210 + Math.sin(a) * 1.5) * smoothstep(0.26, 0.14, y) * smoothstep(0.1, 0.13, y); // prettier-ignore
  k.add(loft(k, rings, { disp, grid: 96 }), {
    even: true,
    opacity: 1,
    flat: 0.22,
    jitter: 0.006,
    color: (s) => {
      const y = s.p[1];
      let e = 0;
      if (y < hem + 0.012) e = -0.1; // the hem
      if (y < hem - 0.001 && s.n[1] < -0.3) e = -0.45; // inside the hem
      const out = (s.p[0] - kx) * side;
      if (out > 0 && Math.abs(Math.atan2(s.p[2], out)) < 0.03) e = -0.12;
      return trouserColor(c, s, e);
    },
  });
}

// ---- Clothes: sleeves ---------------------------------------------------------------

function buildUpperArm(k, { c, pivot }, side) {
  const [sx, sy, sz] = [pivot.x, pivot.y, pivot.z];
  // The shoulder: a rounded cap of cloth centered on the joint.
  k.add(ellipsoid(k, 0.049, 0.04, 0.052), {
    pos: [sx + side * 0.006, sy - 0.018, sz],
    even: true,
    opacity: 1,
    flat: 0.22,
    jitter: 0.006,
    color: (s) => lit(c.shirt, s.n),
  });
  const rings = [
    { y: sy - 0.33, x: 0.01, f: 0.01 },
    { y: sy - 0.315, x: 0.035, f: 0.037 },
    { y: sy - 0.295, x: 0.041, f: 0.043 },
    { y: sy - 0.22, x: 0.043, f: 0.047 },
    { y: sy - 0.12, x: 0.047, f: 0.05 },
    { y: sy - 0.05, x: 0.049, f: 0.051 },
    { y: sy - 0.02, x: 0.045, f: 0.047 },
    { y: sy + 0.005, x: 0.02, f: 0.02 },
  ].map((r) => ({ ...r, cx: sx + side * 0.004, cz: sz }));
  // Folds at the inside of the elbow.
  const disp = (a, y) => 0.0025 * Math.sin(y * 190) * Math.max(0, Math.cos(a)) * Math.exp(-Math.pow((y - (sy - 0.27)) / 0.03, 2)); // prettier-ignore
  k.add(loft(k, rings, { disp, grid: 80 }), {
    even: true,
    opacity: 1,
    flat: 0.22,
    jitter: 0.006,
    color: (s) => lit(c.shirt, s.n),
  });
}

function buildForearm(k, { c, pivot }, side) {
  const [ex, ey, ez] = [pivot.x, pivot.y, pivot.z];
  k.add(ellipsoid(k, 0.041, 0.041, 0.043), {
    pos: [ex + side * 0.004, ey, ez],
    even: true,
    opacity: 1,
    flat: 0.22,
    jitter: 0.006,
    color: (s) => lit(c.shirt, s.n),
  });
  const w = ey - 0.25; // the wrist
  const rings = [
    { y: w - 0.002, x: 0.025, f: 0.027 },
    { y: w + 0.001, x: 0.031, f: 0.033 },
    { y: w + 0.012, x: 0.033, f: 0.035 },
    { y: w + 0.034, x: 0.033, f: 0.035 },
    { y: w + 0.05, x: 0.034, f: 0.037 },
    { y: w + 0.11, x: 0.036, f: 0.04 },
    { y: w + 0.19, x: 0.041, f: 0.044 },
    { y: ey - 0.01, x: 0.041, f: 0.043 },
    { y: ey + 0.02, x: 0.03, f: 0.03 },
  ].map((r) => ({ ...r, cx: ex + side * 0.004, cz: ez }));
  // The cuff's ribs and the cloth bunched above it.
  const disp = (a, y) => {
    const rel = y - w;
    let d = 0;
    d += 0.0028 * Math.sin(rel * 200 + Math.sin(a) * 2) * smoothstep(0.036, 0.05, rel) * smoothstep(0.12, 0.07, rel); // prettier-ignore
    return d;
  };
  k.add(loft(k, rings, { disp, grid: 96 }), {
    even: true,
    opacity: 1,
    flat: 0.22,
    jitter: 0.006,
    color: (s) => {
      const rel = s.p[1] - w;
      let col = c.shirt;
      if (rel < 0.034) col = shade(col, 0.92);
      if (s.n[1] < -0.5) col = shade(col, 0.55); // the cuff's edge, inside
      return lit(col, s.n);
    },
  });
}

// ---- Skin ----------------------------------------------------------------------------

function buildNeck(k, { c, pivot }) {
  const [, ny, nz] = [pivot.x, pivot.y, pivot.z];
  const rings = [
    { y: ny - 0.02, x: 0.05, f: 0.05, b: 0.055 },
    { y: ny + 0.03, x: 0.053, f: 0.052, b: 0.056 },
    { y: ny + 0.08, x: 0.051, f: 0.05, b: 0.055 },
    { y: ny + 0.12, x: 0.05, f: 0.047, b: 0.055 },
    { y: ny + 0.15, x: 0.03, f: 0.03, b: 0.03 },
  ].map((r) => ({ ...r, cz: nz + (r.y - ny) * 0.2 }));
  k.add(loft(k, rings, { grid: 64 }), {
    even: true,
    opacity: 1,
    flat: 0.22,
    jitter: 0.004,
    color: (s) => {
      // Shade under the jaw.
      const ao = 1 - 0.14 * smoothstep(ny + 0.05, ny + 0.1, s.p[1]) * Math.max(0, s.n[2]);
      return lit(c.skin, s.n, ao);
    },
  });
}

// ---- The head ------------------------------------------------------------------------
// Head coordinates: origin at the head's pivot (the top of the neck), so
// the chin is at y -0.035, the eyes at 0.08 and the crown at 0.19.

const EYE = { x: 0.0318, y: 0.079, z: 0.066, r: 0.0118 };
const LIP_U = [
  [0, 0.0178, 0.0842],
  [0.0195, 0.0046, 0.0064],
];
const LIP_L = [
  [0, 0.0062, 0.0828],
  [0.0175, 0.0055, 0.0068],
];

export function headSdf(p) {
  let d = sdEllipsoid(p, [0, 0.1, -0.012], [0.074, 0.09, 0.097]); // cranium
  d = smin(d, sdEllipsoid(p, [0, 0.055, 0.03], [0.06, 0.068, 0.064]), 0.03); // midface
  d = smin(d, sdEllipsoid(p, [0, 0.009, 0.033], [0.053, 0.036, 0.055]), 0.03); // jaw
  d = smin(d, sdEllipsoid(p, [0, -0.021, 0.064], [0.019, 0.017, 0.018]), 0.018); // chin
  for (const sx of [-1, 1])
    d = smin(d, sdEllipsoid(p, [sx * 0.045, 0.064, 0.056], [0.018, 0.013, 0.018]), 0.018); // cheekbones
  d = smin(d, sdEllipsoid(p, [0, 0.1, 0.07], [0.056, 0.012, 0.019]), 0.018); // brow ridge
  // The face's small features, only near the face.
  if (p[2] < 0.04 || Math.abs(p[0]) > 0.065 || p[1] < -0.012 || p[1] > 0.125)
    return backSkull(p, d);
  // The eye sockets, cut back (the eyes sit in them).
  for (const sx of [-1, 1]) d = smax(d, -sdEllipsoid(p, [sx * EYE.x, EYE.y, 0.083], [0.019, 0.0128, 0.014]), 0.006); // prettier-ignore
  // The nose: a bridge, the tip and the wings.
  d = smin(
    d,
    sdCapsule(p, [0, 0.092, 0.08], [0, 0.052, 0.101], (h) => 0.0055 + 0.0035 * h),
    0.008,
  );
  d = smin(d, sdEllipsoid(p, [0, 0.046, 0.1], [0.0105, 0.0098, 0.0098]), 0.006);
  for (const sx of [-1, 1]) d = smin(d, sdEllipsoid(p, [sx * 0.0118, 0.042, 0.092], [0.0078, 0.0068, 0.0078]), 0.005); // prettier-ignore
  // The lips, and the mouth's line between them.
  d = smin(d, sdEllipsoid(p, ...LIP_U), 0.005);
  d = smin(d, sdEllipsoid(p, ...LIP_L), 0.005);
  d = smax(d, -sdEllipsoid(p, [0, 0.0118, 0.091], [0.017, 0.001, 0.006]), 0.0015);
  return backSkull(p, d);
}
// The back of the skull meets the neck.
function backSkull(p, d) {
  if (p[2] > 0.03) return d;
  return smin(d, sdCapsule(p, [0, -0.01, -0.035], [0, 0.07, -0.05], 0.045), 0.03);
}

function buildHead(k, { c, pivot, seed }) {
  const at = [pivot.x, pivot.y, pivot.z];
  const center = [0, 0.075, 0.0];
  const pos = [at[0] + center[0], at[1] + center[1], at[2] + center[2]];
  const local = (p) => [p[0] - at[0], p[1] - at[1], p[2] - at[2]];
  k.add(sdfShape(k, headSdf, center, { far: 0.25 }), {
    pos,
    even: true,
    weight: 3.2,
    opacity: 1,
    flat: 0.2,
    jitter: 0.003,
    color: (s) => {
      const q = local(s.p);
      const ax = Math.abs(q[0]);
      let col = c.skin;
      let ao = 1;
      // Lips.
      const lip = Math.min(sdEllipsoid(q, ...LIP_U), sdEllipsoid(q, ...LIP_L));
      if (lip < 0.0015 && q[2] > 0.075 && ax < 0.022) col = mix(c.skin, c.lips, smoothstep(0.0015, -0.0003, lip)); // prettier-ignore
      if (Math.abs(q[1] - 0.0118) < 0.001 && ax < 0.017 && q[2] > 0.08) col = shade(c.lips, 0.62);
      // Brows: an arched stroke above each eye, thinner toward the temple.
      const bx = (ax - 0.034) / 0.021;
      const by = q[1] - (0.1035 + 0.0035 * (1 - bx * bx) - 0.0015 * bx);
      const bw = 0.0028 - Math.max(0, bx) * 0.0013;
      if (Math.abs(bx) < 1 && q[2] > 0.05) col = mix(col, c.brow, smoothstep(bw + 0.0012, bw - 0.0006, Math.abs(by))); // prettier-ignore
      // Nostrils, under the tip.
      if (s.n[1] < -0.15 && q[2] > 0.087 && q[1] < 0.043) {
        const nd = Math.hypot((ax - 0.0074) / 0.0042, (q[2] - 0.0955) / 0.0027);
        col = mix(col, shade(c.skin, 0.35), smoothstep(1.15, 0.8, nd));
      }
      // Shade in the eye sockets, under the brows and the nose and jaw; a
      // little warmth on the cheeks, nose and lips.
      const eyeD = Math.hypot((ax - EYE.x) / 0.02, (q[1] - EYE.y) / 0.016);
      if (q[2] > 0.04) ao *= 1 - 0.12 * smoothstep(1.4, 0.6, eyeD);
      const cheek = Math.exp(-(((ax - 0.046) / 0.017) ** 2) - ((q[1] - 0.05) / 0.015) ** 2);
      const noseTip = Math.exp(-((ax / 0.012) ** 2) - ((q[1] - 0.047) / 0.01) ** 2);
      col = mix(col, mix(c.skin, "#c8685a", 0.5), 0.12 * cheek + 0.08 * noseTip);
      ao *= 1 - 0.1 * smoothstep(-0.012, -0.035, q[1]) * Math.max(0, -s.n[1]);
      // Under the hair: the scalp takes the hair's color, fading at the
      // short sides and the nape.
      const h = hairAmount(q);
      if (h > 0) col = mix(col, shade(c.hair, 0.72), h);
      return lit(col, s.n, ao);
    },
  });
  // The eyes: whites, irises, pupils and a catch light, under lids.
  for (const sx of [-1, 1]) {
    const e = [at[0] + sx * EYE.x, at[1] + EYE.y, at[2] + EYE.z];
    const gaze = unit([sx * -0.03, -0.02, 1]);
    k.add(k.sphere(EYE.r), {
      pos: e,
      even: true,
      weight: 14,
      opacity: 1,
      flat: 0.2,
      jitter: 0.002,
      color: (s) => {
        const d = unit([s.p[0] - e[0], s.p[1] - e[1], s.p[2] - e[2]]);
        if (d[2] < 0.2) return null;
        const ang = Math.acos(clamp(d[0] * gaze[0] + d[1] * gaze[1] + d[2] * gaze[2], -1, 1));
        // A catch light up and to the side, then the pupil.
        const cl = Math.hypot(d[0] - gaze[0] + 0.2, d[1] - gaze[1] - 0.24);
        if (cl < 0.09) return rgb("#f4f2ee");
        if (ang < 0.2) return rgb("#0d0a09");
        if (ang < 0.52) {
          const t = (ang - 0.2) / 0.32;
          const fleck = 0.9 + 0.12 * Math.sin(Math.atan2(d[1], d[0]) * 11);
          return shade(mix(shade(c.iris, 1.2), shade(c.iris, 0.75), t), fleck);
        }
        if (ang < 0.56) return shade(c.iris, 0.4);
        // The white, a touch darker toward the corners.
        return shade(mix("#efe9e2", "#cfc3ba", smoothstep(0.6, 1.2, ang)), 0.95);
      },
    });
    // The lids: the upper over the top of the iris, with the lash line; the
    // lower lid's rim.
    k.add(k.sphere(EYE.r * 1.07), {
      pos: e,
      even: true,
      weight: 10,
      opacity: 1,
      flat: 0.2,
      jitter: 0.002,
      color: (s) => {
        const d = unit([s.p[0] - e[0], s.p[1] - e[1], s.p[2] - e[2]]);
        if (d[2] < 0.55) return null;
        const out = d[0] * sx; // toward the temple
        const lidUp = 0.36 - 0.1 * out - 0.2 * out * out;
        const lidLo = -0.44 + 0.08 * out;
        if (d[1] > lidUp) {
          if (d[1] < lidUp + 0.08) return shade(mix(c.hair, "#120c0a", 0.7), 0.9);
          return lit(c.skin, d, 0.9);
        }
        if (d[1] < lidLo) {
          if (d[1] > lidLo - 0.06) return lit(mix(c.skin, c.lips, 0.35), d, 0.92);
          return lit(c.skin, d, 1);
        }
        return null;
      },
    });
  }
  // The ears.
  for (const sx of [-1, 1]) {
    const e = [at[0] + sx * 0.075, at[1] + 0.07, at[2] - 0.006];
    k.add(ellipsoid(k, 0.009, 0.029, 0.018, 40), {
      pos: e,
      rot: [-12, sx * -18, 0],
      even: true,
      weight: 3,
      opacity: 1,
      flat: 0.2,
      jitter: 0.003,
      color: (s) => {
        const d = Math.hypot((s.p[1] - e[1]) / 0.02, (s.p[2] - e[2]) / 0.011);
        const inner = (s.p[0] - e[0]) * sx > 0 && d < 1;
        return lit(mix(c.skin, "#c9705f", 0.12), s.n, inner ? 0.78 + 0.2 * d : 1);
      },
    });
  }
  buildHair(k, { c, at, seed });
}

// How much hair covers a point of the head (q in head space): 1 under the
// hair, 0 on bare skin, fading at the short sides and the nape.
function hairAmount(q) {
  const [x, y, z] = q;
  const ax = Math.abs(x);
  const front = 0.137 - 0.03 * smoothstep(0.02, 0.068, ax) - 0.003 * Math.cos(x * 70);
  const back = 0.098 - 0.074 * smoothstep(-0.03, -0.085, z);
  const wF = smoothstep(0.018, 0.05, z);
  const yb = wF * front + (1 - wF) * Math.min(0.099, back + (0.099 - back) * smoothstep(-0.03, 0.0, z)); // prettier-ignore
  const band = wF * 0.0035 + (1 - wF) * 0.011;
  return smoothstep(yb - band, yb + band, y);
}

// Hair with volume: short at the sides and back, longer on top with a
// fringe swept to one side. A darker inner layer so no scalp shows, and an
// outer layer of long splats laid along the hair's flow from the crown;
// soft clumps give the top a little texture.
function buildHair(k, { c, at, seed }) {
  const crown = [0.012, 0.172, -0.05];
  const n = k.noise;
  const thick = (p) => {
    const top = smoothstep(0.09, 0.15, p[1]);
    const front = smoothstep(0.0, 0.06, p[2]) * smoothstep(0.11, 0.15, p[1]);
    return 0.0035 + 0.015 * top + 0.007 * front;
  };
  const clumps = (p) => 0.0028 * smoothstep(0.1, 0.16, p[1]) * n.fbm(p[0] * 38, p[1] * 38, p[2] * 38, 2); // prettier-ignore
  const hairSdf = (pad) => (p) => headSdf(p) - thick(p) - pad - clumps(p);
  const flow = (p) => {
    const d = [p[0] - crown[0], p[1] - crown[1], p[2] - crown[2]];
    // The fringe sweeps to the character's left and forward.
    const fringe = smoothstep(0.0, 0.06, p[2]) * smoothstep(0.09, 0.13, p[1]);
    return [d[0] * (1 - fringe) + fringe * 0.9, d[1] * (1 - fringe) - fringe * 0.25, d[2] * (1 - fringe) + fringe * 0.45]; // prettier-ignore
  };
  const center = [0, 0.09, -0.01];
  const pos = [at[0] + center[0], at[1] + center[1], at[2] + center[2]];
  for (const layer of [0, 1]) {
    const base = sdfShape(k, hairSdf(layer ? 0 : -0.003), center, { far: 0.25, nu: 256, nv: 128 });
    // Give each splat the flow's direction (in the shape's space) so it
    // lies along the hair.
    const withFlow = (s) => {
      const q = [s.p[0] + center[0], s.p[1] + center[1], s.p[2] + center[2]];
      const f = flow(q);
      const nn = s.n;
      const dt = f[0] * nn[0] + f[1] * nn[1] + f[2] * nn[2];
      s.tangent = unit([f[0] - dt * nn[0], f[1] - dt * nn[1], f[2] - dt * nn[2]]);
      return s;
    };
    const shape = { ...base, sample: (r) => withFlow(base.sample(r)), sampleEven: (a, b) => withFlow(base.sampleEven(a, b)) }; // prettier-ignore
    k.add(shape, {
      pos,
      even: true,
      weight: layer ? 2.6 : 0.9,
      stretch: layer ? 2.4 : 1.3,
      size: layer ? 0.9 : 1.1,
      opacity: 1,
      flat: 0.3,
      jitter: 0.004,
      color: (s) => {
        const q = [s.p[0] - at[0], s.p[1] - at[1], s.p[2] - at[2]];
        const h = hairAmount(q);
        if (h < (layer ? 0.6 : 0.3)) return null;
        const f = unit(flow(q));
        // Strands: stripes across the flow, and clumps a shade apart.
        const across = [f[1] * s.n[2] - f[2] * s.n[1], f[2] * s.n[0] - f[0] * s.n[2], f[0] * s.n[1] - f[1] * s.n[0]]; // prettier-ignore
        const w = q[0] * across[0] + q[1] * across[1] + q[2] * across[2];
        const strand = Math.sin(w * 700 + n(q[0] * 30, q[1] * 30, q[2] * 30) * 5);
        const clump = n.fbm(q[0] * 26 + 3.1, q[1] * 26, q[2] * 26, 2);
        let col = shade(c.hair, (layer ? 1 : 0.72) * (1 + 0.14 * clump + 0.07 * strand * layer));
        // A soft sheen where the light grazes the top.
        const sheen = Math.max(0, s.n[0] * KEY[0] + s.n[1] * KEY[1] + s.n[2] * KEY[2]);
        col = mix(
          col,
          shade(mix(c.hair, "#d8c3a8", 0.2), 1.5),
          0.22 * sheen * sheen * sheen * layer,
        );
        // The short sides fade toward the skin.
        col = mix(shade(mix(c.skin, c.hair, 0.55), 0.8), col, smoothstep(0.3, 0.85, h));
        return lit(col, s.n, 1, 0.85);
      },
    });
  }
  void seed;
}

// ---- Hands ---------------------------------------------------------------------------
// Hands hang palm in (toward the thigh), thumb forward. `side` 1 is the
// left hand (at +x), whose palm faces -x.

function skinOpts(c, weight = 2.6, ao = null) {
  return {
    even: true,
    weight,
    opacity: 1,
    flat: 0.2,
    jitter: 0.003,
    color: (s) => lit(c.skin, s.n, ao ? ao(s) : 1),
  };
}

function buildHand(k, { c, pivot }, side) {
  const [wx, wy, wz] = [pivot.x, pivot.y, pivot.z];
  // The wrist, reaching up into the cuff.
  const rings = [
    { y: wy - 0.1, x: 0.017, f: 0.042, b: 0.038, cx: wx - side * 0.002, cz: wz + 0.002, p: 2.3 },
    { y: wy - 0.085, x: 0.0165, f: 0.043, b: 0.04, cx: wx, cz: wz + 0.002, p: 2.4 },
    { y: wy - 0.045, x: 0.0165, f: 0.041, b: 0.038, cx: wx, cz: wz, p: 2.4 },
    { y: wy - 0.015, x: 0.018, f: 0.028, b: 0.028, cx: wx, cz: wz },
    { y: wy + 0.01, x: 0.02, f: 0.024, b: 0.024, cx: wx, cz: wz },
    { y: wy + 0.045, x: 0.022, f: 0.025, b: 0.025, cx: wx, cz: wz },
    { y: wy + 0.055, x: 0.01, f: 0.01, b: 0.01, cx: wx, cz: wz },
  ];
  k.add(loft(k, rings, { grid: 72 }), skinOpts(c));
  // The knuckles' end of the palm, rounded.
  k.add(ellipsoid(k, 0.0165, 0.012, 0.041, 40), { pos: [wx - side * 0.002, wy - 0.098, wz + 0.002], ...skinOpts(c) }); // prettier-ignore
  // The thumb: from the heel of the hand, forward and down, curving in.
  const tb = (x, y, z) => [wx - side * x, wy + y, wz + z];
  const curve = curveThrough([tb(0.004, -0.03, 0.03), tb(0.012, -0.05, 0.05), tb(0.02, -0.07, 0.058), tb(0.028, -0.086, 0.056)]); // prettier-ignore
  k.add(
    rodShape(k, curve, (t) => 0.0125 - 0.0035 * t, { cap: 0.18 }),
    skinOpts(c),
  );
  // A thumbnail.
  k.add(ellipsoid(k, 0.006, 0.007, 0.0025, 24), {
    pos: tb(0.022, -0.082, 0.061),
    rot: [20, 0, 0],
    even: true,
    weight: 4,
    opacity: 1,
    flat: 0.3,
    jitter: 0.002,
    color: (s) => lit(mix(c.skin, "#f0d8cc", 0.4), s.n),
  });
}

// The four fingers, one rigid group that curls at the knuckles. Each
// finger is its own rounded rod with a gentle bend, and a nail.
function buildFingers(k, { c, pivot }, side) {
  const [kx, ky, kz] = [pivot.x, pivot.y, pivot.z];
  const fingers = [
    { z: 0.03, l: 0.074, r: 0.0092 },
    { z: 0.0105, l: 0.082, r: 0.0094 },
    { z: -0.0095, l: 0.077, r: 0.0088 },
    { z: -0.028, l: 0.062, r: 0.0078 },
  ];
  for (const f of fingers) {
    const pts = [];
    // From inside the palm, down and curling toward the palm (-side x).
    for (let i = 0; i <= 6; i++) {
      const t = i / 6;
      const ang = t * 0.65; // radians of bend along the finger
      const l = -0.012 + t * (f.l + 0.012);
      pts.push([kx - side * (Math.sin(ang) * l * 0.45), ky - Math.cos(ang * 0.5) * l, kz + f.z * (1 - t * 0.12)]); // prettier-ignore
    }
    const curve = curveThrough(pts);
    k.add(
      rodShape(k, curve, (t) => f.r * (1 - 0.18 * t), { cap: 0.1 }),
      {
        even: true,
        weight: 2.8,
        opacity: 1,
        flat: 0.2,
        jitter: 0.003,
        color: (s) => lit(c.skin, s.n),
      },
    );
    const tip = curve(0.9);
    k.add(ellipsoid(k, 0.0022, 0.0075, f.r * 0.8, 20), {
      pos: [tip[0] + side * f.r * 0.62, tip[1] + 0.001, tip[2]],
      even: true,
      weight: 4,
      opacity: 1,
      flat: 0.3,
      jitter: 0.002,
      color: (s) => lit(mix(c.skin, "#f2dcd0", 0.45), s.n),
    });
  }
}

// ---- Shoes ---------------------------------------------------------------------------
// A sneaker: a rubber sole with a rounded toe, an upper with a padded
// collar round the ankle, a tongue and laces, and a toe cap. The foot's
// part holds the heel to the ball; the toes' part the rest, hinged at the
// ball (a cylinder of shoe centered on the hinge closes the crease).

// The sole's outline along z (from the heel to the toe): half-width, the
// center's shift toward the outer side, and how far the bottom lifts (the
// heel's bevel and the toe spring).
const SOLE = [
  { y: -0.074, x: 0.012, lift: 0.012, cx: 0 },
  { y: -0.07, x: 0.03, lift: 0.006, cx: 0 },
  { y: -0.055, x: 0.041, lift: 0.002, cx: 0 },
  { y: -0.02, x: 0.045, lift: 0, cx: 0.001 },
  { y: 0.03, x: 0.044, lift: 0, cx: 0.003 },
  { y: 0.08, x: 0.049, lift: 0, cx: 0.002 },
  { y: 0.125, x: 0.052, lift: 0, cx: 0 },
  { y: 0.16, x: 0.05, lift: 0.002, cx: -0.001 },
  { y: 0.19, x: 0.043, lift: 0.006, cx: -0.003 },
  { y: 0.207, x: 0.03, lift: 0.011, cx: -0.004 },
  { y: 0.214, x: 0.012, lift: 0.015, cx: -0.004 },
];
// The upper's height along z (its top), over the sole.
const UPPER_TOP = [
  [-0.07, 0.07],
  [-0.06, 0.098],
  [-0.03, 0.106],
  [0.0, 0.1],
  [0.03, 0.088],
  [0.08, 0.07],
  [0.125, 0.058],
  [0.16, 0.05],
  [0.19, 0.042],
  [0.207, 0.036],
  [0.212, 0.03],
];
const SOLE_TOP = 0.026;

function buildShoe(k, { c, pivot, jointAt }, side, which) {
  const foot = which === "foot" ? pivot : jointAt("foot", side);
  const fx = foot.x;
  const hingeZ = 0.125;
  const idx = (list, z) => {
    for (let i = 0; i < list.length - 1; i++)
      if (z <= list[i + 1].y) return i + (z - list[i].y) / (list[i + 1].y - list[i].y);
    return list.length - 1;
  };
  const cut = (list) =>
    which === "foot"
      ? [0, idx(list, hingeZ + 0.012)]
      : [idx(list, hingeZ - 0.008), list.length - 1];
  // The sole: a boxy slab of rubber.
  const soleRings = SOLE.map((r) => {
    const bot = r.lift;
    return { y: r.y, x: r.x, f: (SOLE_TOP - bot) / 2, cx: fx - side * r.cx, cz: (SOLE_TOP + bot) / 2, p: 5 }; // prettier-ignore
  });
  k.add(loft(k, soleRings, { from: cut(SOLE)[0], to: cut(SOLE)[1], axis: "z", grid: 96 }), {
    even: true,
    weight: 1.5,
    opacity: 1,
    flat: 0.2,
    jitter: 0.003,
    color: (s) => {
      const py = s.p[1];
      const edge = Math.abs(py - 0.012) < 0.0012 && Math.abs(s.n[1]) < 0.5;
      return lit(shade(c.sole, edge ? 0.84 : s.n[1] < -0.5 ? 0.72 : 1), s.n, 1, 0.6);
    },
  });
  // The upper, sitting in the sole.
  const upperRings = SOLE.map((r) => {
    const top = interp(UPPER_TOP, r.y);
    const bot = 0.016;
    return { y: r.y, x: Math.max(0.006, r.x - 0.0045), f: (top - bot) / 2, cx: fx - side * r.cx, cz: (top + bot) / 2, p: 2.3 }; // prettier-ignore
  });
  upperRings[0] = { ...upperRings[0], y: -0.066 };
  upperRings[upperRings.length - 1] = { ...upperRings[upperRings.length - 1], y: 0.209 };
  k.add(loft(k, upperRings, { from: cut(SOLE)[0], to: cut(SOLE)[1], axis: "z", grid: 112 }), {
    even: true,
    weight: 1.6,
    opacity: 1,
    flat: 0.2,
    jitter: 0.004,
    color: (s) => {
      const [px, py, pz] = s.p;
      const lx = (px - fx) * side;
      let col = c.shoes;
      // Laces across the top, between two rows of eyelets.
      const onTop = s.n[1] > 0.5 && pz > -0.004 && pz < 0.108;
      if (onTop && Math.abs(lx) < 0.021) {
        const lz = (pz + 0.004) % 0.0224;
        if (lz < 0.0062) return lit(shade(c.lace, 1 - (0.1 * Math.abs(lx)) / 0.021), s.n, 1, 0.6);
        col = shade(col, 0.8); // the tongue between them
      }
      if (onTop && Math.abs(Math.abs(lx) - 0.025) < 0.0026 && (pz + 0.004) % 0.0224 < 0.006) col = shade(col, 0.5); // prettier-ignore
      // A toe cap and a heel counter a shade apart, and a stitched line
      // round the upper above the sole.
      if (pz > 0.158 || pz < -0.048) col = shade(col, 1.14);
      if (Math.abs(py - (SOLE_TOP + 0.007)) < 0.0009) col = shade(col, 0.72);
      return lit(col, s.n, 1, 0.8);
    },
  });
  if (which === "foot") {
    // The padded collar round the ankle, the tongue and the sock.
    k.add(evenTorus(k, 0.036, 0.0085, 48), {
      pos: [fx, 0.1, -0.018],
      rot: [-12, 0, 0],
      scale: [1.02, 1, 1.28],
      even: true,
      weight: 1.8,
      opacity: 1,
      flat: 0.3,
      jitter: 0.004,
      color: (s) => lit(shade(c.shoes, 0.88), s.n, 1, 0.8),
    });
    k.add(ellipsoid(k, 0.022, 0.024, 0.008, 32), {
      pos: [fx, 0.106, 0.024],
      rot: [-24, 0, 0],
      even: true,
      opacity: 1,
      flat: 0.22,
      jitter: 0.004,
      color: (s) => lit(shade(c.shoes, 0.86), s.n),
    });
    const sock = [
      { y: 0.06, x: 0.031, f: 0.034 },
      { y: 0.1, x: 0.033, f: 0.035 },
      { y: 0.15, x: 0.033, f: 0.034 },
      { y: 0.16, x: 0.015, f: 0.015 },
    ].map((r) => ({ ...r, cx: fx, cz: -0.006 }));
    k.add(loft(k, sock, { grid: 48 }), {
      even: true,
      opacity: 1,
      flat: 0.22,
      jitter: 0.004,
      color: (s) => lit(c.sock, s.n),
    });
  } else {
    // The crease at the ball: a short cylinder of shoe centered on the
    // hinge, so bending the toes never opens a gap.
    const hy = pivot.y;
    const hinge = [
      { y: hingeZ - 0.016, x: 0.036, f: 0.018 },
      { y: hingeZ - 0.01, x: 0.047, f: 0.023 },
      { y: hingeZ + 0.01, x: 0.047, f: 0.023 },
      { y: hingeZ + 0.016, x: 0.036, f: 0.018 },
    ].map((r) => ({ ...r, cx: fx, cz: hy, p: 3 }));
    k.add(loft(k, hinge, { axis: "z", grid: 48 }), {
      even: true,
      opacity: 1,
      flat: 0.22,
      jitter: 0.004,
      color: (s) => lit(c.shoes, s.n),
    });
  }
}

function interp(list, z) {
  if (z <= list[0][0]) return list[0][1];
  for (let i = 0; i < list.length - 1; i++)
    if (z <= list[i + 1][0]) {
      const t = (z - list[i][0]) / (list[i + 1][0] - list[i][0]);
      return list[i][1] + (list[i + 1][1] - list[i][1]) * t;
    }
  return list[list.length - 1][1];
}
