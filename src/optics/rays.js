// Lane Optics: the light bench's rays, traced in 2D through real surfaces.
//
// Every optical part is made of surfaces: straight segments and circular
// arcs, each with the refractive index on either side (a glass's, as a
// function of the wavelength) or a mirror. A ray goes straight to the
// nearest surface it meets; there it refracts by Snell's law,
//
//   n₁ sin θ₁ = n₂ sin θ₂,
//
// in vector form, or reflects (a mirror, or total internal reflection when
// sin θ₂ would exceed 1). Spherical surfaces are real circles, so a lens has
// its real aberrations; the numbers the bench prints (focal lengths, image
// distances) come from the paraxial formulas, beside what the rays do.
//
// Glass: Schott N-BK7 and fused silica from their published Sellmeier
// coefficients (wavelength in micrometers):
//
//   n² − 1 = Σ Bᵢ λ² / (λ² − Cᵢ)
//
// Pure JavaScript, no DOM: the tests run it in Node (tests/opt.spec.mjs).

export const SELLMEIER = {
  // Schott N-BK7 data sheet (also refractiveindex.info, "SCHOTT optical
  // glass data sheets 2017"): nd = 1.5168 at 587.6 nm.
  "N-BK7": {
    B: [1.03961212, 0.231792344, 1.01046945],
    C: [0.00600069867, 0.0200179144, 103.560653],
  },
  // Schott N-SF11, a dense flint (the same data sheet): nd = 1.78472.
  "N-SF11": {
    B: [1.73759695, 0.313747346, 1.89878101],
    C: [0.013188707, 0.0623068142, 155.23629],
  },
  // Fused silica, Malitson (1965): nd = 1.4585.
  "fused silica": {
    B: [0.6961663, 0.4079426, 0.8974794],
    C: [0.0684043 ** 2, 0.1162414 ** 2, 9.896161 ** 2],
  },
};

// The refractive index of a named glass at a wavelength in nm.
export function sellmeier(glass, nm) {
  const g = SELLMEIER[glass];
  const l2 = (nm / 1000) ** 2;
  let s = 1;
  for (let i = 0; i < 3; i++) s += (g.B[i] * l2) / (l2 - g.C[i]);
  return Math.sqrt(s);
}

// An index: a number, or a glass name (dispersive).
export function indexOf(medium, nm) {
  if (typeof medium === "number") return medium;
  return sellmeier(medium, nm);
}

// Fraunhofer lines used for the numbers: C (red, hydrogen), d (yellow,
// helium) and F (blue, hydrogen).
export const LINES = { C: 656.3, d: 587.6, F: 486.1 };

// ---- Vector helpers --------------------------------------------------------------------

const dot = (a, b) => a[0] * b[0] + a[1] * b[1];
const sub = (a, b) => [a[0] - b[0], a[1] - b[1]];
const add = (a, b) => [a[0] + b[0], a[1] + b[1]];
const mul = (a, s) => [a[0] * s, a[1] * s];
const len = (a) => Math.hypot(a[0], a[1]);
const unit = (a) => mul(a, 1 / (len(a) || 1));
export const rot = (p, a) => [p[0] * Math.cos(a) - p[1] * Math.sin(a), p[0] * Math.sin(a) + p[1] * Math.cos(a)]; // prettier-ignore

// ---- Snell's law in vector form --------------------------------------------------------

// d: the unit direction, n: the unit normal on the side the ray comes from
// (dot(d, n) < 0), eta = n₁ / n₂. Returns the refracted unit direction, or
// null for total internal reflection.
export function refract(d, n, eta) {
  const c = -dot(d, n);
  const k = 1 - eta * eta * (1 - c * c);
  if (k < 0) return null;
  return unit(add(mul(d, eta), mul(n, eta * c - Math.sqrt(k))));
}
export function reflect(d, n) {
  return sub(d, mul(n, 2 * dot(d, n)));
}

// ---- Surfaces --------------------------------------------------------------------------

// A segment from a to b; its normal points to the "out" side: the left of
// a → b. An arc: center, radius, from angle a0 through the sweep (radians,
// counterclockwise); its normal points away from the center for out: 1 (a
// convex face of glass whose inside is toward the center), toward it for -1.
// Each has { inside, outside } media (a number or a glass name), or
// mirror: true (reflects on both sides; `back: true` only reflects on its
// out side and absorbs on the other), or stop: true (ends the ray there).

export function segment(a, b, opts) {
  return { kind: "seg", a, b, ...opts };
}
export function arc(center, r, a0, sweep, out, opts) {
  return { kind: "arc", c: center, r, a0, sweep, out, ...opts };
}

// Moves a surface by a rotation about the origin, then a translation.
export function place(s, pos, angle) {
  const T = (p) => add(rot(p, angle), pos);
  if (s.kind === "seg") return { ...s, a: T(s.a), b: T(s.b) };
  return { ...s, c: T(s.c), a0: s.a0 + angle };
}

const EPS = 1e-7;

// The nearest hit of a ray (origin o, unit direction d) on a surface beyond
// tMin: { t, p, n } with n the surface's "out" normal there, or null.
export function hit(s, o, d, tMin = 1e-6) {
  if (s.kind === "seg") {
    const e = sub(s.b, s.a);
    const den = d[0] * e[1] - d[1] * e[0];
    if (Math.abs(den) < 1e-12) return null;
    const w = sub(s.a, o);
    const t = (w[0] * e[1] - w[1] * e[0]) / den;
    const u = (w[0] * d[1] - w[1] * d[0]) / den;
    if (t <= tMin || u < -EPS || u > 1 + EPS) return null;
    const n = unit([-e[1], e[0]]);
    return { t, p: add(o, mul(d, t)), n };
  }
  const w = sub(o, s.c);
  const b = dot(w, d);
  const c = dot(w, w) - s.r * s.r;
  const disc = b * b - c;
  if (disc < 0) return null;
  const sq = Math.sqrt(disc);
  for (const t of [-b - sq, -b + sq]) {
    if (t <= tMin) continue;
    const p = add(o, mul(d, t));
    const ang = Math.atan2(p[1] - s.c[1], p[0] - s.c[0]);
    let rel = (ang - s.a0) % (2 * Math.PI);
    if (rel < 0) rel += 2 * Math.PI;
    if (rel > s.sweep + EPS) continue;
    const radial = unit(sub(p, s.c));
    return { t, p, n: mul(radial, s.out) };
  }
  return null;
}

// ---- Tracing ---------------------------------------------------------------------------

// Traces one ray of wavelength nm through the surfaces. Returns the list of
// points it passes ([origin, hit, hit, …, end]) and what happened at each
// hit ({ type: "refract" | "reflect" | "tir" | "absorb", i1, i2, n1, n2 }).
// The ray ends `far` past its last hit (or where it leaves `bounds`).
export function trace(surfaces, o, d, nm, { maxHits = 80, far = 12, medium = 1 } = {}) {
  const pts = [o];
  const events = [];
  let cur = o;
  let dir = unit(d);
  let n0 = medium;
  for (let k = 0; k < maxHits; k++) {
    let best = null;
    let bs = null;
    for (const s of surfaces) {
      const h = hit(s, cur, dir);
      if (h && (!best || h.t < best.t)) {
        best = h;
        bs = s;
      }
    }
    if (!best) break;
    pts.push(best.p);
    // The normal on the side the ray comes from.
    const fromOut = dot(dir, best.n) < 0;
    const nIn = fromOut ? best.n : mul(best.n, -1);
    const cos1 = -dot(dir, nIn);
    const i1 = Math.acos(Math.min(1, cos1));
    // A stop (a screen, the bench's edge) ends the ray where it lands.
    if (bs.stop) return { pts, events, end: best.p, dir, stopped: { at: best.p, surface: bs } };
    if (bs.mirror) {
      if (bs.back && !fromOut) {
        events.push({ type: "absorb", at: best.p });
        return { pts, events, end: best.p, dir, stopped: true };
      }
      dir = reflect(dir, nIn);
      events.push({ type: "reflect", at: best.p, i1, i2: i1, normal: nIn, surface: bs });
      cur = best.p;
      continue;
    }
    const n1 = indexOf(fromOut ? bs.outside : bs.inside, nm);
    const n2 = indexOf(fromOut ? bs.inside : bs.outside, nm);
    const r = refract(dir, nIn, n1 / n2);
    if (!r) {
      dir = reflect(dir, nIn);
      events.push({ type: "tir", at: best.p, i1, i2: i1, n1, n2, normal: nIn, surface: bs });
    } else {
      events.push({ type: "refract", at: best.p, i1, i2: Math.acos(Math.min(1, -dot(r, nIn))), n1, n2, normal: nIn, surface: bs }); // prettier-ignore
      dir = r;
      n0 = n2;
    }
    cur = best.p;
  }
  const end = add(cur, mul(dir, far));
  pts.push(end);
  return { pts, events, end, dir, medium: n0 };
}

// Where two rays (points p, q with directions u, v) cross, or null.
export function crossing(p, u, q, v) {
  const den = u[0] * v[1] - u[1] * v[0];
  if (Math.abs(den) < 1e-12) return null;
  const w = sub(q, p);
  const t = (w[0] * v[1] - w[1] * v[0]) / den;
  return add(p, mul(u, t));
}

// ---- Parts -----------------------------------------------------------------------------
// Each returns its surfaces in its own frame (its middle at the origin,
// facing +x: light comes from −x), plus an outline for drawing.

// A lens of glass between two spherical faces: R1 the first face's radius
// (positive: its center lies to the right, so the face bulges to the left),
// R2 the second's (negative bulges to the right), t the thickness on the
// axis, h the half height. Infinity is a flat face.
export function lensSurfaces({ R1, R2, t, h, glass = "N-BK7" }) {
  const opts = { inside: glass, outside: 1 };
  const out = [];
  const x1 = -t / 2;
  const x2 = t / 2;
  // Where each face is at the rim (half height h): its sag.
  const sag = (R) => (Number.isFinite(R) ? Math.sign(R) * (Math.abs(R) - Math.sqrt(R * R - h * h)) : 0); // prettier-ignore
  const e1 = x1 + sag(R1);
  const e2 = x2 + sag(R2);
  const face = (x, R, first) => {
    if (!Number.isFinite(R)) {
      // A flat face: its out normal points away from the glass.
      return first ? segment([x, -h], [x, h], opts) : segment([x, h], [x, -h], opts);
    }
    const c = [x + R, 0];
    const half = Math.asin(h / Math.abs(R));
    // The arc's middle points from its center back toward the face.
    const mid = R > 0 ? Math.PI : 0;
    // Its out normal: away from the glass. For the first face the glass is
    // on its right: toward the center if R > 0 (convex), away if R < 0.
    const outSign = first ? (R > 0 ? 1 : -1) : R < 0 ? 1 : -1;
    return arc(c, Math.abs(R), mid - half, 2 * half, outSign, opts);
  };
  out.push(face(x1, R1, true), face(x2, R2, false));
  // The rims, top and bottom, where the faces don't meet.
  if (e2 - e1 > 1e-6) {
    out.push(segment([e1, h], [e2, h], opts), segment([e2, -h], [e1, -h], opts));
  }
  return out;
}

// The lensmaker's equation for a thick lens in air (paraxial): the focal
// length f and the principal planes' places from the lens's middle.
export function thickLens({ R1, R2, t, glass = "N-BK7" }, nm = LINES.d) {
  const n = indexOf(glass, nm);
  const c1 = Number.isFinite(R1) ? 1 / R1 : 0;
  const c2 = Number.isFinite(R2) ? 1 / R2 : 0;
  const P = (n - 1) * (c1 - c2 + ((n - 1) * t * c1 * c2) / n);
  const f = 1 / P;
  // Principal planes from the vertices (Hecht, Optics, eq. 6.3-6.4).
  const h1 = Number.isFinite(R2) ? (-f * (n - 1) * t) / (R2 * n) : 0;
  const h2 = Number.isFinite(R1) ? (-f * (n - 1) * t) / (R1 * n) : 0;
  return { n, f, H: -t / 2 + h1, H2: t / 2 + h2 };
}

// The thin-lens equation 1/f = 1/do + 1/di, solved for di.
export function imageDistance(f, dObj) {
  if (Math.abs(dObj - f) < 1e-12) return Infinity;
  return 1 / (1 / f - 1 / dObj);
}

// A prism: an isosceles triangle with apex angle A (radians) at the top,
// sides `side` long, its middle at the centroid, light coming in through the
// left face.
export function prismSurfaces({ A = Math.PI / 3, side = 1, glass = "N-BK7" }) {
  const opts = { inside: glass, outside: 1 };
  const hgt = side * Math.cos(A / 2);
  const halfBase = side * Math.sin(A / 2);
  const top = [0, (2 * hgt) / 3];
  const left = [-halfBase, -hgt / 3];
  const right = [halfBase, -hgt / 3];
  // Clockwise, so the out normals (left of each edge) point outward.
  return [segment(top, right, opts), segment(left, top, opts), segment(right, left, opts)];
}
export function prismCorners({ A = Math.PI / 3, side = 1 }) {
  const hgt = side * Math.cos(A / 2);
  const halfBase = side * Math.sin(A / 2);
  return [
    [0, (2 * hgt) / 3],
    [-halfBase, -hgt / 3],
    [halfBase, -hgt / 3],
  ];
}

// The deviation of a ray through a prism of apex angle A and index n, for
// an angle of incidence i on the first face (both radians), from Snell's
// law at each face: δ = i + e − A. null if it is totally reflected inside.
export function prismDeviation(A, n, i) {
  const r1 = Math.asin(Math.sin(i) / n);
  const r2 = A - r1;
  const s = n * Math.sin(r2);
  if (Math.abs(s) > 1) return null;
  return i + Math.asin(s) - A;
}

// A rectangular block w × h (its edges clockwise, out normals outward).
export function blockSurfaces({ w = 1, h = 0.6, glass = "N-BK7" }) {
  const opts = { inside: glass, outside: 1 };
  const c = [
    [-w / 2, -h / 2],
    [w / 2, -h / 2],
    [w / 2, h / 2],
    [-w / 2, h / 2],
  ];
  return c.map((p, i) => segment(c[(i + 1) % 4], p, opts));
}

// A flat mirror `length` long across the x axis (facing −x), or a concave
// one of radius R facing −x (its focus at R/2 in front of it). The back is
// dark: light from behind stops there.
export function mirrorSurfaces({ length = 1, R = Infinity }) {
  const h = length / 2;
  if (!Number.isFinite(R)) return [segment([0, -h], [0, h], { mirror: true, back: true })];
  const half = Math.asin(Math.min(1, h / R));
  // Concave toward −x: the center is at −R, the arc around angle 0, its out
  // normal toward the center (the shiny side).
  return [arc([-R, 0], R, -half, 2 * half, -1, { mirror: true, back: true })];
}

// A fiber (a light guide): a glass core (half width a) in a cladding of
// lower index (b thick) in air, running along +x for `len1`, bending by
// `bend` radians about a center at radius `R` (to the left, counter-
// clockwise), then running on for `len2`. Returns the surfaces, and the
// far end's middle and direction.
export function fiberSurfaces({
  a = 0.05,
  b = 0.025,
  len1 = 0.8,
  R = 0.6,
  bend = Math.PI / 3,
  len2 = 0.6,
  core = "N-SF11",
  clad = "N-BK7",
}) {
  // prettier-ignore
  const s = [];
  const c = [len1, R];
  const ang = -Math.PI / 2 + bend;
  const dir = [-Math.sin(ang), Math.cos(ang)];
  const radial = [Math.cos(ang), Math.sin(ang)];
  // The walls at half width w, each out normal pointing away from the axis.
  const walls = (w, opts) => {
    s.push(segment([len1, -w], [0, -w], opts));
    s.push(segment([0, w], [len1, w], opts));
    s.push(arc(c, R + w, -Math.PI / 2, bend, 1, opts));
    s.push(arc(c, R - w, -Math.PI / 2, bend, -1, opts));
    const pOut = add(c, mul(radial, R + w));
    const pIn = add(c, mul(radial, R - w));
    s.push(segment(add(pOut, mul(dir, len2)), pOut, opts));
    s.push(segment(pIn, add(pIn, mul(dir, len2)), opts));
  };
  walls(a, { inside: core, outside: clad });
  walls(a + b, { inside: clad, outside: 1 });
  // The ends, flat and polished, facing out into the air: the core's and
  // the cladding's on either side of it.
  const ends = (p0, across, out) => {
    // across: the unit vector across the end; out: its outward normal.
    const at = (w) => add(p0, mul(across, w));
    const seg = (w0, w1, opts) => {
      const A = at(w0);
      const B = at(w1);
      // The left of A → B must be `out`.
      const e = sub(B, A);
      return -e[1] * out[0] + e[0] * out[1] > 0 ? segment(A, B, opts) : segment(B, A, opts);
    };
    s.push(seg(-a, a, { inside: core, outside: 1 }));
    s.push(seg(a, a + b, { inside: clad, outside: 1 }));
    s.push(seg(-a - b, -a, { inside: clad, outside: 1 }));
  };
  ends([0, 0], [0, 1], [-1, 0]);
  const axisEnd = add(add(c, mul(radial, R)), mul(dir, len2));
  ends(axisEnd, radial, dir);
  return { surfaces: s, axisEnd, endDir: dir };
}

// The fiber's critical angle at the core wall, and its acceptance half
// angle in air (numerical aperture NA = √(n₁² − n₂²)).
export function fiberNumbers(core, clad, nm = LINES.d) {
  const n1 = indexOf(core, nm);
  const n2 = indexOf(clad, nm);
  const NA = Math.sqrt(n1 * n1 - n2 * n2);
  return { n1, n2, critical: Math.asin(n2 / n1), NA, accept: Math.asin(Math.min(1, NA)) };
}

// ---- Colors of light -------------------------------------------------------------------

// An sRGB color (0..1) for a wavelength in nm: the visible spectrum after
// Dan Bruton's approximation (1996), with the ends dimmed.
export function wavelengthRGB(nm) {
  let r = 0;
  let g = 0;
  let b = 0;
  if (nm < 440) [r, g, b] = [-(nm - 440) / 60, 0, 1];
  else if (nm < 490) [r, g, b] = [0, (nm - 440) / 50, 1];
  else if (nm < 510) [r, g, b] = [0, 1, -(nm - 510) / 20];
  else if (nm < 580) [r, g, b] = [(nm - 510) / 70, 1, 0];
  else if (nm < 645) [r, g, b] = [1, -(nm - 645) / 65, 0];
  else [r, g, b] = [1, 0, 0];
  const f = nm < 420 ? 0.3 + (0.7 * (nm - 380)) / 40 : nm > 700 ? 0.3 + (0.7 * (780 - nm)) / 80 : 1; // prettier-ignore
  return [r, g, b].map((x) => Math.min(1, Math.max(0, x * f)) ** 0.8);
}
