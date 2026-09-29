// Shapes for even: true (lane Fidelity B). k.box and k.cylinder take three
// random numbers per splat, so under even: true the kit spreads them with a
// 3D sequence, which shows as diagonal hatching on each flat face. These
// shapes give the same surfaces a 2D even layout (sampleEven), so a box or a
// cylinder built with even: true looks smooth. They sample exactly like the
// kit's (the same face, side, cap, u and v fields), so colour functions work
// unchanged: k.add(evenBox(1, 2, 3), { even: true, ... }).

const TAU = Math.PI * 2;
const clamp01 = (x) => Math.min(1, Math.max(0, x));

// A box centred at the origin, like k.box(sx, sy, sz).
export function evenBox(sx, sy, sz) {
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
  const point = (fi, u, v) => {
    const n = faces[fi].n;
    let p;
    if (n[0]) p = [hx * n[0], (u - 0.5) * sy, (v - 0.5) * sz];
    else if (n[1]) p = [(u - 0.5) * sx, hy * n[1], (v - 0.5) * sz];
    else p = [(u - 0.5) * sx, (v - 0.5) * sy, hz * n[2]];
    return { p, n, u, v, face: fi };
  };
  // Where a lies along the faces laid end to end by area.
  const pick = (a) => {
    let x = a * area;
    for (let i = 0; i < 6; i++) {
      if (x < faces[i].a || i === 5) return [i, clamp01(x / faces[i].a)];
      x -= faces[i].a;
    }
    return [5, 0.5];
  };
  return {
    area,
    thick: Math.min(hx, hy, hz),
    sample(rand) {
      const [fi] = pick(rand());
      return point(fi, rand(), rand());
    },
    sampleEven(a, b) {
      const [fi, u] = pick(a);
      return point(fi, u, b);
    },
  };
}

// A cone frustum from radius r0 at y = -h/2 to r1 at y = +h/2, like
// k.cylinder(r0, h) or k.cone(r0, r1, h); caps true, false, "top" or
// "bottom" (default true).
export function evenCylinder(r0, r1, h, caps = true) {
  const slant = Math.hypot(h, r0 - r1);
  const side = Math.PI * (r0 + r1) * slant;
  const capB = caps === true || caps === "bottom" ? Math.PI * r0 * r0 : 0;
  const capT = caps === true || caps === "top" ? Math.PI * r1 * r1 : 0;
  const area = side + capB + capT;
  const ny = (r0 - r1) / slant;
  const nr = h / slant;
  const at = (x, q, ang) => {
    const ca = Math.cos(ang);
    const sa = Math.sin(ang);
    if (x < side) {
      let t;
      if (Math.abs(r1 - r0) < 1e-6) t = q;
      else t = (Math.sqrt(r0 * r0 + q * (r1 * r1 - r0 * r0)) - r0) / (r1 - r0);
      const r = r0 + (r1 - r0) * t;
      return {
        p: [r * sa, -h / 2 + h * t, r * ca],
        n: [sa * nr, ny, ca * nr],
        u: ang / TAU,
        v: 1 - t,
        side: true,
        thick: r,
      };
    }
    const top = x >= side + capB;
    const R = top ? r1 : r0;
    const rr = R * Math.sqrt(q);
    return {
      p: [rr * sa, top ? h / 2 : -h / 2, rr * ca],
      n: [0, top ? 1 : -1, 0],
      u: ang / TAU,
      v: top ? 0 : 1,
      cap: top ? "top" : "bottom",
      radial: R > 0 ? rr / R : 0,
    };
  };
  // The fraction q of the way through the part of the surface that a picks.
  const frac = (x) => {
    if (x < side) return x / side;
    if (x < side + capB) return (x - side) / capB;
    return (x - side - capB) / capT;
  };
  return {
    area,
    thick: Math.min(Math.max(r0, r1), h / 2),
    sample(rand) {
      const x = rand() * area;
      const ang = rand() * TAU;
      return at(x, rand(), ang);
    },
    sampleEven(a, b) {
      const x = Math.min(a, 1 - 1e-9) * area;
      return at(x, clamp01(frac(x)), b * TAU);
    },
  };
}

// A torus in the XZ plane, like k.torus(R, r), as a parametric surface (the
// kit places a torus's splats at random).
export function evenTorus(k, R, r, grid = 96) {
  return k.param(
    (u, v) => {
      const a = TAU * u;
      const b = TAU * v;
      const w = R + r * Math.cos(b);
      return [w * Math.cos(a), r * Math.sin(b), w * Math.sin(a)];
    },
    { grid, thick: r, flip: true },
  );
}

// A one-sided disc in the XZ plane facing +Y, like k.disc(r1, r0).
export function evenDisc(k, r1, r0 = 0, grid = 48) {
  return k.param(
    (u, v) => {
      const a = TAU * u;
      const r = r0 + (r1 - r0) * v;
      return [r * Math.sin(a), 0, r * Math.cos(a)];
    },
    { grid, normal: () => [0, 1, 0], thick: 0.01 },
  );
}

// An ellipsoid with semi-axes a, b, c, like k.ellipsoid (which places its
// splats by rejection, so it can't take even: true).
export function evenEllipsoid(k, a, b, c, grid = 64) {
  return k.param(
    (u, v) => {
      const th = v * Math.PI;
      const ph = u * TAU;
      return [a * Math.sin(th) * Math.sin(ph), b * Math.cos(th), c * Math.sin(th) * Math.cos(ph)];
    },
    {
      grid,
      flip: true,
      thick: Math.min(a, b, c),
    },
  );
}

// The i-th of n points spread evenly over a spherical cap round direction
// d (a unit vector) of angular radius th0 (a sunflower spiral), and how far
// out it is (0 at the center, 1 at the edge).
export function capPoint(d, th0, i, n) {
  const e1 = Math.abs(d[1]) < 0.9 ? norm([d[2], 0, -d[0]]) : [1, 0, 0];
  const e2 = [
    d[1] * e1[2] - d[2] * e1[1],
    d[2] * e1[0] - d[0] * e1[2],
    d[0] * e1[1] - d[1] * e1[0],
  ];
  const f = (i + 0.5) / n;
  const th = th0 * Math.sqrt(f);
  const ph = i * 2.399963229728653;
  const s = Math.sin(th);
  const p = [0, 1, 2].map(
    (j) => d[j] * Math.cos(th) + (e1[j] * Math.cos(ph) + e2[j] * Math.sin(ph)) * s,
  );
  return { p, f };
}

function norm(v) {
  const l = Math.hypot(v[0], v[1], v[2]) || 1;
  return [v[0] / l, v[1] / l, v[2] / l];
}
