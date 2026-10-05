// Lane Sound and light lab: flat, crisp splat shapes of an exact size, for
// the cases and stands of the labs' instruments. A kit shape takes its
// splat size from the budget left after the screens, which can leave a
// small case with big, soft splats; these keep a fixed spacing instead.

// A box (full sizes w × h × d, centered at c) covered in flat splats about
// `gap` apart, each face shaded from `color(n)` (n its outward normal).
// `tilt` leans it back about x (radians, its top away from the viewer) and
// `turn` turns it about y (radians, counterclockwise seen from above).
export function boxSplats(
  k,
  { c, w, h, d, gap = 0.012, color, part = 0, pattern = false, tilt = 0, turn = 0 },
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
  for (const [n, u, v, su, sv, off] of faces) {
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
  k.cloud({ count: list.length, pattern, jitter: 0 }, (rand, i) => list[i] || null);
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
  k.cloud({ count: list.length, pattern: false, jitter: 0 }, (rand, i) => list[i] || null);
}
