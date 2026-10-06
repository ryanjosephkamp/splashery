// Lane Sound and light lab: flat, crisp splat shapes of an exact size, for
// the cases and stands of the labs' instruments. A kit shape takes its
// splat size from the budget left after the screens, which can leave a
// small case with big, soft splats; these keep a fixed spacing instead.

// The spacing that keeps a shape's splats in step with the toy's budget
// (0.012 at the kit's reference budget of 160,000).
export const budgetGap = (k, at = 0.018) => at * Math.sqrt(160000 / Math.max(20000, k.count));
// A grid size scaled the same way (n at the reference budget).
export const budgetN = (k, n) =>
  Math.max(8, Math.round(n * Math.sqrt(Math.max(20000, k.count) / 160000)));

// A box (full sizes w × h × d, centered at c) covered in flat splats about
// `gap` apart, each face shaded from `color(n)` (n its outward normal).
// `skip` leaves faces out by index (0 +x, 1 −x, 2 +y, 3 −y, 4 +z, 5 −z): the
// back of a case, the underside of a table.
// `tilt` leans it back about x (radians, its top away from the viewer) and
// `turn` turns it about y (radians, counterclockwise seen from above).
export function boxSplats(
  k,
  { c, w, h, d, gap = budgetGap(k), color, part = 0, pattern = false, tilt = 0, turn = 0, skip = [] }, // prettier-ignore
) {
  const ct = Math.cos(tilt);
  const st = Math.sin(tilt);
  const cy = Math.cos(turn);
  const sy = Math.sin(turn);
  // Lean back about x, then turn about y.
  const rot = (v) => {
    const y1 = v[1] * ct + v[2] * st;
    const z1 = -v[1] * st + v[2] * ct;
    return [v[0] * cy + z1 * sy, y1, -v[0] * sy + z1 * cy];
  };
  const list = [];
  const faces = [
    [[1, 0, 0], [0, 0, -1], [0, 1, 0], d, h, w / 2],
    [[-1, 0, 0], [0, 0, 1], [0, 1, 0], d, h, w / 2],
    [[0, 1, 0], [1, 0, 0], [0, 0, -1], w, d, h / 2],
    [[0, -1, 0], [1, 0, 0], [0, 0, 1], w, d, h / 2],
    [[0, 0, 1], [1, 0, 0], [0, 1, 0], w, h, d / 2],
    [[0, 0, -1], [-1, 0, 0], [0, 1, 0], w, h, d / 2],
  ];
  for (const [f, [n, u, v, su, sv, off]] of faces.entries()) {
    if (skip.includes(f)) continue;
    const nu = Math.max(1, Math.round(su / gap));
    const nv = Math.max(1, Math.round(sv / gap));
    const s = Math.max(su / nu, sv / nv) * 0.62;
    const col = typeof color === "function" ? color(n) : color;
    const nr = rot(n);
    const q = quatToNormal(nr);
    for (let i = 0; i < nu; i++)
      for (let j = 0; j < nv; j++) {
        const a = ((i + 0.5) / nu - 0.5) * su;
        const b = ((j + 0.5) / nv - 0.5) * sv;
        list.push({
          p: ((o) => [c[0] + o[0], c[1] + o[1], c[2] + o[2]])(rot([0, 1, 2].map((x) => n[x] * off + u[x] * a + v[x] * b))), // prettier-ignore
          scales: [s, s, s * 0.05],
          quat: q,
          color: col,
          opacity: 1,
          part,
          pattern,
        });
      }
  }
  k.cloud({ share: list.length / k.count, pattern, jitter: 0 }, (rand, i) => list[i] || null);
}

// The rotation taking +z to the unit vector n.
export function quatToNormal(n) {
  const d = n[2];
  if (d < -0.999999) return [1, 0, 0, 0];
  const q = [-n[1], n[0], 0, 1 + d];
  const l = Math.hypot(...q);
  return q.map((x) => x / l);
}

// Soft light from above and the front, for a flat color.
export const lit = (shadeFn, base) => (n) =>
  shadeFn(base, 0.74 + 0.2 * n[1] + 0.1 * n[2] + 0.04 * n[0]);

// A flat surface f(u, v) (u, v in 0..1) covered by an nu × nv grid of flat
// splats facing `n` (one normal for the whole face); `keep(u, v)` can cut
// it to a shape (a triangle).
export function faceSplats(
  k,
  f,
  { nu, nv, n, color, opacity = 1, kind, params, part = 0, keep = null },
) {
  const q = quatToNormal(n);
  const p00 = f(0, 0);
  const du = Math.hypot(...f(1, 0).map((x, i) => x - p00[i])) / nu;
  const dv = Math.hypot(...f(0, 1).map((x, i) => x - p00[i])) / nv;
  const s = Math.max(du, dv) * 0.62;
  const list = [];
  for (let i = 0; i < nu; i++)
    for (let j = 0; j < nv; j++) {
      const u = (i + 0.5) / nu;
      const v = (j + 0.5) / nv;
      if (keep && !keep(u, v)) continue;
      list.push({ p: f(u, v), scales: [s, s, s * 0.05], quat: q, color, opacity, kind, params, part, pattern: false }); // prettier-ignore
    }
  k.cloud(
    { share: list.length / k.count, pattern: false, jitter: 0 },
    (rand, i) => list[i] || null,
  );
}

// A curved surface f(u, v) (u, v in 0..1) covered by an nu × nv grid of flat
// splats, each facing nrm(u, v) and sized to its own cell (so a sphere's
// splats shrink toward its poles); `color(u, v, n)` colors it.
export function surfSplats(k, f, nrm, { nu, nv, color, opacity = 1, part = 0, keep = null }) {
  const list = [];
  const dist = (a, b) => Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]);
  for (let i = 0; i < nu; i++)
    for (let j = 0; j < nv; j++) {
      const u = (i + 0.5) / nu;
      const v = (j + 0.5) / nv;
      if (keep && !keep(u, v)) continue;
      const p = f(u, v);
      const du = dist(f(u - 0.5 / nu, v), f(u + 0.5 / nu, v));
      const dv = dist(f(u, v - 0.5 / nv), f(u, v + 0.5 / nv));
      const s = Math.max(1e-4, Math.max(du, dv) * 0.62);
      const n = nrm(u, v);
      list.push({ p, scales: [s, s, s * 0.05], quat: quatToNormal(n), color: typeof color === "function" ? color(u, v, n) : color, opacity, part, pattern: false }); // prettier-ignore
    }
  k.cloud(
    { share: list.length / k.count, pattern: false, jitter: 0 },
    (rand, i) => list[i] || null,
  );
}

const unit3 = (v) => {
  const l = Math.hypot(v[0], v[1], v[2]) || 1;
  return [v[0] / l, v[1] / l, v[2] / l];
};

// A cylinder along the axis `dir` ("y" or "z") at c, radius r, length h,
// with its end caps (`caps`: "both", "front" for +axis only, or "none").
export function cylinderSplats(k, { c, r, h, axis = "y", n = 48, caps = "both", color, part = 0 }) {
  const toWorld = (x, a, y) => (axis === "y" ? [c[0] + x, c[1] + a, c[2] + y] : [c[0] + x, c[1] + y, c[2] + a]); // prettier-ignore
  const toN = (x, a, y) => (axis === "y" ? [x, a, y] : [x, y, a]);
  const around = Math.max(12, n);
  const along = Math.max(2, Math.round((around * h) / (2 * Math.PI * r)));
  surfSplats(k, (u, v) => toWorld(r * Math.cos(u * 2 * Math.PI), (v - 0.5) * h, r * Math.sin(u * 2 * Math.PI)), (u) => toN(Math.cos(u * 2 * Math.PI), 0, Math.sin(u * 2 * Math.PI)), { nu: around, nv: along, color, part }); // prettier-ignore
  for (const side of caps === "none" ? [] : caps === "front" ? [1] : [1, -1]) {
    const rings = Math.max(2, Math.round(around / 6));
    surfSplats(k, (u, v) => toWorld(r * v * Math.cos(u * 2 * Math.PI), (side * h) / 2, r * v * Math.sin(u * 2 * Math.PI)), () => toN(0, side, 0), { nu: around, nv: rings, color, part }); // prettier-ignore
  }
}

// A sphere at c of radius r (n splats around its equator).
export function sphereSplats(k, { c, r, n = 48, color, part = 0 }) {
  const at = (u, v) => {
    const th = u * 2 * Math.PI;
    const ph = v * Math.PI;
    return [Math.sin(ph) * Math.cos(th), Math.cos(ph), Math.sin(ph) * Math.sin(th)];
  };
  surfSplats(k, (u, v) => at(u, v).map((x, i) => c[i] + r * x), (u, v) => unit3(at(u, v)), { nu: n, nv: Math.max(6, Math.round(n / 2)), color, part }); // prettier-ignore
}
