// The math behind the manual's second set of live demos (the 3D Gaussian, the numbers in one splat,
// the bell from 1D to 3D, the projection, sorting and blending, the (u, v) grid and the torus).
// Pure functions, no page, so tests/man4.spec.mjs can check each one against the formulas in the
// manual and against the real code in src/. Matrices are plain arrays in row-major order: a 3 x 3
// is [a, b, c, d, e, f, g, h, i], a 2 x 2 covariance is { a, b, c } (a, b / b, c).

export const TAU = Math.PI * 2;
const RAD = Math.PI / 180;

// ---- Small vector and matrix helpers -----------------------------------------------------------
export const dot = (p, q) => p[0] * q[0] + p[1] * q[1] + p[2] * q[2];
export const sub = (p, q) => [p[0] - q[0], p[1] - q[1], p[2] - q[2]];
export const add = (p, q) => [p[0] + q[0], p[1] + q[1], p[2] + q[2]];
export const scale = (p, s) => [p[0] * s, p[1] * s, p[2] * s];
export const len = (p) => Math.hypot(p[0], p[1], p[2]);
export const unit = (p) => scale(p, 1 / (len(p) || 1));
export const cross = (p, q) => [
  p[1] * q[2] - p[2] * q[1],
  p[2] * q[0] - p[0] * q[2],
  p[0] * q[1] - p[1] * q[0],
];
export const mulMV = (m, v) => [
  m[0] * v[0] + m[1] * v[1] + m[2] * v[2],
  m[3] * v[0] + m[4] * v[1] + m[5] * v[2],
  m[6] * v[0] + m[7] * v[1] + m[8] * v[2],
];
export const mulMM = (a, b) => {
  const out = new Array(9).fill(0);
  for (let i = 0; i < 3; i++)
    for (let j = 0; j < 3; j++)
      for (let k = 0; k < 3; k++) out[i * 3 + j] += a[i * 3 + k] * b[k * 3 + j];
  return out;
};
export const transpose = (m) => [m[0], m[3], m[6], m[1], m[4], m[7], m[2], m[5], m[8]];
export const det3 = (m) =>
  m[0] * (m[4] * m[8] - m[5] * m[7]) -
  m[1] * (m[3] * m[8] - m[5] * m[6]) +
  m[2] * (m[3] * m[7] - m[4] * m[6]);
export function inv3(m) {
  const d = det3(m);
  if (!d) return null;
  const c = (r0, c0, r1, c1) => m[r0 * 3 + c0] * m[r1 * 3 + c1] - m[r0 * 3 + c1] * m[r1 * 3 + c0];
  const adj = [
    c(1, 1, 2, 2), -c(0, 1, 2, 2), c(0, 1, 1, 2),
    -c(1, 0, 2, 2), c(0, 0, 2, 2), -c(0, 0, 1, 2),
    c(1, 0, 2, 1), -c(0, 0, 2, 1), c(0, 0, 1, 1),
  ]; // prettier-ignore
  return adj.map((x) => x / d);
}

// ---- Rotation: a quaternion [x, y, z, w], and its matrix ---------------------------------------
export function quatMul(a, b) {
  return [
    a[3] * b[0] + a[0] * b[3] + a[1] * b[2] - a[2] * b[1],
    a[3] * b[1] - a[0] * b[2] + a[1] * b[3] + a[2] * b[0],
    a[3] * b[2] + a[0] * b[1] - a[1] * b[0] + a[2] * b[3],
    a[3] * b[3] - a[0] * b[0] - a[1] * b[1] - a[2] * b[2],
  ];
}
// Turns about x, then y, then z, in degrees, as the kit's own quatEuler (src/kit.js) does.
export function quatEulerDeg(x = 0, y = 0, z = 0) {
  const half = (d) => [Math.sin(d * RAD * 0.5), Math.cos(d * RAD * 0.5)];
  const [sx, cx] = half(x);
  const [sy, cy] = half(y);
  const [sz, cz] = half(z);
  return quatMul([0, 0, sz, cz], quatMul([0, sy, 0, cy], [sx, 0, 0, cx]));
}
// The rotation matrix of a unit quaternion [x, y, z, w].
export function quatMatrix(q) {
  const l = Math.hypot(...q) || 1;
  const [x, y, z, w] = q.map((v) => v / l);
  return [
    1 - 2 * (y * y + z * z), 2 * (x * y - z * w), 2 * (x * z + y * w),
    2 * (x * y + z * w), 1 - 2 * (x * x + z * z), 2 * (y * z - x * w),
    2 * (x * z - y * w), 2 * (y * z + x * w), 1 - 2 * (x * x + y * y),
  ]; // prettier-ignore
}

// ---- The covariance and the Gaussian ------------------------------------------------------------
// Sigma = R S S^T R^T, from three sizes and a rotation matrix (the manual, "The covariance, built
// from sizes and a rotation").
export function covariance(sizes, R) {
  const S = [sizes[0], 0, 0, 0, sizes[1], 0, 0, 0, sizes[2]];
  const RS = mulMM(R, S);
  return mulMM(RS, transpose(RS));
}
// G(p) = exp(-1/2 (p - mu)^T Sigma^-1 (p - mu)) (the manual, "The Gaussian: a bell in three
// dimensions"), for a displacement d = p - mu.
export function gaussianAt(Sigma, d) {
  const inv = inv3(Sigma);
  if (!inv) return NaN;
  return Math.exp(-0.5 * dot(d, mulMV(inv, d)));
}
// The weight on the shell k sizes out: exp(-k^2 / 2). One size 0.607, two 0.135, three 0.011.
export const weightAtShell = (k) => Math.exp((-k * k) / 2);
// The shell where the weight is w (0 < w <= 1): k = sqrt(-2 ln w).
export const shellForWeight = (w) => Math.sqrt(-2 * Math.log(w));

// A point on the shell k sizes out, in the direction n: R S (k n) (relative to the center).
export function shellPoint(sizes, R, k, n) {
  return mulMV(R, [k * sizes[0] * n[0], k * sizes[1] * n[1], k * sizes[2] * n[2]]);
}
// Three rings (the ellipsoid's cross-sections in its own axes) for drawing a wire shell.
export function shellRings(sizes, R, k, steps = 48) {
  const rings = [];
  for (let axis = 0; axis < 3; axis++) {
    const ring = [];
    for (let i = 0; i <= steps; i++) {
      const a = (TAU * i) / steps;
      const n = [0, 0, 0];
      n[(axis + 1) % 3] = Math.cos(a);
      n[(axis + 2) % 3] = Math.sin(a);
      ring.push(shellPoint(sizes, R, k, n));
    }
    rings.push(ring);
  }
  return rings;
}
// A deterministic cloud of points whose density is the Gaussian (for the "fog" picture).
export function fogPoints(count, sizes, R, seed = 7) {
  let s = seed >>> 0;
  const rand = () => {
    s = (s + 0x6d2b79f5) >>> 0;
    let t = s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  const normal = () => Math.sqrt(-2 * Math.log(1 - rand())) * Math.cos(TAU * rand());
  const out = [];
  for (let i = 0; i < count; i++) out.push(shellPoint(sizes, R, 1, [normal(), normal(), normal()]));
  return out;
}

// ---- The bell from one dimension to three (axis-aligned) ----------------------------------------
// The first `dims` coordinates of the point are used; the others are ignored.
export function bell(dims, p, sigmas) {
  let q = 0;
  for (let i = 0; i < dims; i++) q += (p[i] / sigmas[i]) ** 2;
  return { q, k: Math.sqrt(q), g: Math.exp(-0.5 * q) };
}

// ---- A camera, and the projection from 3D to the screen ----------------------------------------
// An orbit camera looking at the origin from `distance`: yaw turns it around the y axis (0 looks
// from +z), pitch lifts it. W holds the view axes as rows (right, up, forward).
export function orbitCamera({ yaw = 0, pitch = 0, distance = 5, focal = 300, cx = 0, cy = 0 }) {
  const y = yaw * RAD;
  const p = pitch * RAD;
  const eye = [distance * Math.cos(p) * Math.sin(y), distance * Math.sin(p), distance * Math.cos(p) * Math.cos(y)]; // prettier-ignore
  const fwd = unit(scale(eye, -1));
  const right = unit(cross(fwd, [0, 1, 0]));
  const up = cross(right, fwd);
  return { eye, W: [...right, ...up, ...fwd], focal, cx, cy, distance };
}
export const toView = (cam, p) => mulMV(cam.W, sub(p, cam.eye));
// The true perspective map. Screen x grows right and screen y grows down.
export function project(cam, p) {
  const v = toView(cam, p);
  return { x: cam.cx + (cam.focal * v[0]) / v[2], y: cam.cy - (cam.focal * v[1]) / v[2], z: v[2] };
}
// The Jacobian of that map at a view-space point (the manual's J): 2 x 3, row-major.
export function jacobian(cam, v) {
  const f = cam.focal;
  return [f / v[2], 0, (-f * v[0]) / (v[2] * v[2]), 0, -f / v[2], (f * v[1]) / (v[2] * v[2])];
}
// Sigma' = J W Sigma W^T J^T, a 2 x 2 (the manual, "From 3D to the screen").
export function projectCovariance(cam, mu, Sigma) {
  const J = jacobian(cam, toView(cam, mu));
  const S2 = mulMM(mulMM(cam.W, Sigma), transpose(cam.W)); // W Sigma W^T
  const JS = [0, 1].map((i) => [0, 1, 2].map((j) => J[i * 3] * S2[j] + J[i * 3 + 1] * S2[3 + j] + J[i * 3 + 2] * S2[6 + j])); // prettier-ignore
  const m = (i, j) => JS[i][0] * J[j * 3] + JS[i][1] * J[j * 3 + 1] + JS[i][2] * J[j * 3 + 2];
  return { a: m(0, 0), b: m(0, 1), c: m(1, 1) };
}
// The axes of the ellipse a 2 x 2 covariance draws k sizes out: two lengths and the turn, measured
// from screen x toward screen y (the way a canvas turns an ellipse).
export function ellipseOf(cov, k = 1) {
  const { a, b, c } = cov;
  const mean = (a + c) / 2;
  const diff = Math.hypot((a - c) / 2, b);
  const l1 = Math.max(0, mean + diff);
  const l2 = Math.max(0, mean - diff);
  return { rx: k * Math.sqrt(l1), ry: k * Math.sqrt(l2), angle: 0.5 * Math.atan2(2 * b, a - c), l1, l2 }; // prettier-ignore
}
// The true outline of the shell k sizes out under the real perspective map. A convex body in
// front of the camera keeps its outline as the convex hull of its surface points' images.
export function trueOutline(cam, mu, sizes, R, k = 1, steps = 40) {
  const pts = [];
  for (let i = 0; i <= steps; i++) {
    const th = (Math.PI * i) / steps;
    for (let j = 0; j < steps * 2; j++) {
      const ph = (TAU * j) / (steps * 2);
      const n = [Math.sin(th) * Math.cos(ph), Math.cos(th), Math.sin(th) * Math.sin(ph)];
      const s = project(cam, add(mu, shellPoint(sizes, R, k, n)));
      if (s.z > 0.05) pts.push([s.x, s.y]);
    }
  }
  return hull(pts);
}
export function hull(points) {
  const p = points.slice().sort((a, b) => a[0] - b[0] || a[1] - b[1]);
  if (p.length < 3) return p;
  const cr = (o, a, b) => (a[0] - o[0]) * (b[1] - o[1]) - (a[1] - o[1]) * (b[0] - o[0]);
  const lo = [];
  for (const q of p) {
    while (lo.length >= 2 && cr(lo[lo.length - 2], lo[lo.length - 1], q) <= 0) lo.pop();
    lo.push(q);
  }
  const hi = [];
  for (const q of p.slice().reverse()) {
    while (hi.length >= 2 && cr(hi[hi.length - 2], hi[hi.length - 1], q) <= 0) hi.pop();
    hi.push(q);
  }
  return lo.slice(0, -1).concat(hi.slice(0, -1));
}
// How far the ellipse of Sigma' (centered at `center`, k sizes out) is from an outline: the
// largest distance, in pixels along a line through the center, from an outline point to the
// ellipse. It is 0 where the straight-line stand-in is exact.
export function outlineGap(outline, center, cov, k = 1) {
  const { a, b, c } = cov;
  const det = a * c - b * b;
  if (!(det > 0)) return NaN;
  let worst = 0;
  for (const [x, y] of outline) {
    const dx = x - center.x;
    const dy = y - center.y;
    const m = Math.sqrt((c * dx * dx - 2 * b * dx * dy + a * dy * dy) / det); // sizes out
    const d = Math.hypot(dx, dy);
    if (m > 0) worst = Math.max(worst, Math.abs(d - (d * k) / m));
  }
  return worst;
}

// ---- Sorting and blending ---------------------------------------------------------------------
// Layers are { c: [r, g, b], a }. Drawn in the order given (back to front is the right one), each
// is laid over what is already there: C <- a c + (1 - a) C, starting from black.
export function overSteps(layers, bg = [0, 0, 0]) {
  let C = bg.slice();
  let T = 1;
  const steps = [];
  for (const L of layers) {
    C = C.map((x, i) => L.a * L.c[i] + (1 - L.a) * x);
    T *= 1 - L.a;
    steps.push({ color: C.slice(), transmittance: T });
  }
  return steps;
}
// The same pixel written out for all the splats at once, counting from the nearest:
// C = sum_i c_i a_i prod_{j<i} (1 - a_j), over a black background.
export function overClosedForm(nearestFirst) {
  const C = [0, 0, 0];
  let T = 1;
  for (const L of nearestFirst) {
    for (let k = 0; k < 3; k++) C[k] += L.c[k] * L.a * T;
    T *= 1 - L.a;
  }
  return { color: C, transmittance: T };
}

// ---- The (u, v) grid, and the torus --------------------------------------------------------------
// The cell centers of an nu by nv grid across two ranges, as the toy lays out spread = grid.
export function uvGrid(nu, nv, [u0, u1], [v0, v1]) {
  const out = [];
  for (let i = 0; i < nu; i++)
    for (let j = 0; j < nv; j++)
      out.push([u0 + ((u1 - u0) * (i + 0.5)) / nu, v0 + ((v1 - v0) * (j + 0.5)) / nv]);
  return out;
}
// How far along a dot has gone when the dots are carried one at a time: dot i of n starts at
// i / (n - 1) of the first `spread` of the run and takes the rest, eased the way smoothstep is.
export function stagger(progress, i, n, spread = 0.6) {
  const start = (i / Math.max(1, n - 1)) * spread;
  const c = Math.min(1, Math.max(0, (progress - start) / (1 - spread)));
  return c * c * (3 - 2 * c);
}
export const lerp3 = (p, q, s) => [p[0] + (q[0] - p[0]) * s, p[1] + (q[1] - p[1]) * s, p[2] + (q[2] - p[2]) * s]; // prettier-ignore

// A part's turn: a position and a rotation (quaternion [x, y, z, w]) turned by `angle` radians about
// the line through `pivot` along `axis`, as the kit turns a part about its pivot.
export function turnAbout(pivot, axis, angle) {
  const s = Math.sin(angle / 2);
  const q = [axis[0] * s, axis[1] * s, axis[2] * s, Math.cos(angle / 2)];
  const R = quatMatrix(q);
  return (p, rot) => [add(pivot, mulMV(R, sub(p, pivot))), quatMul(q, rot)];
}
