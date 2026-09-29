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

// A tube like k.tube(curve, radius, opts); with caps: true its end caps
// are spread evenly too (the kit's capped tube places its splats at random
// under even: true).
export function evenTube(k, curve, radius, opts = {}) {
  const body = k.tube(curve, radius, { ...opts, caps: false });
  if (!opts.caps || opts.closed) return body;
  const rad = typeof radius === "function" ? radius : () => radius;
  const r0 = rad(0);
  const r1 = rad(1);
  const cap0 = Math.PI * r0 * r0;
  const capA = cap0 + Math.PI * r1 * r1;
  const bodyA = body.area;
  const area = bodyA + capA;
  const cap = (end, q, ang) => {
    const f = body.frame(end);
    const r = rad(end) * Math.sqrt(q);
    const p = [0, 1, 2].map(
      (i) => f.p[i] + f.n[i] * r * Math.cos(ang) + f.b[i] * r * Math.sin(ang),
    );
    const n = end ? f.t : f.t.map((x) => -x);
    return { p, n, u: ang / TAU, v: end, t: end, tangent: f.t };
  };
  return {
    ...body,
    area,
    sample(rand) {
      if (rand() * area < bodyA) return body.sample(rand);
      const end = rand() * capA < cap0 ? 0 : 1;
      return cap(end, rand(), rand() * TAU);
    },
    sampleEven(a, b) {
      const x = Math.min(a, 1 - 1e-9) * area;
      if (x < bodyA) return body.sampleEven(x / bodyA, b);
      const y = x - bodyA;
      if (y < cap0) return cap(0, y / cap0, b * TAU);
      return cap(1, (y - cap0) / (capA - cap0), b * TAU);
    },
  };
}

// A box with rounded edges, like the roundBox() of vehicles.js and
// landmarks.js (the same face numbers, u and v), with an even 2D layout for
// even: true.
export function evenRoundBox(sx, sy, sz, r) {
  r = Math.max(1e-4, Math.min(r, sx / 2, sy / 2, sz / 2));
  const h = [sx / 2 - r, sy / 2 - r, sz / 2 - r];
  // Pieces: 6 faces, 12 edges, 8 corners, each with its own signs.
  const pieces = [];
  for (let i = 0; i < 3; i++)
    for (const s of [1, -1]) {
      const j = (i + 1) % 3;
      const k2 = (i + 2) % 3;
      pieces.push({ kind: 0, i, s, area: 4 * h[j] * h[k2] });
    }
  for (let ax = 0; ax < 3; ax++)
    for (const sj of [1, -1])
      for (const sk of [1, -1]) pieces.push({ kind: 1, ax, sj, sk, area: Math.PI * r * h[ax] });
  for (const a of [1, -1])
    for (const b of [1, -1])
      for (const c of [1, -1]) pieces.push({ kind: 2, s: [a, b, c], area: (Math.PI / 2) * r * r });
  let area = 0;
  for (const q of pieces) q.cum = area += q.area;
  const at = (q, f, g) => {
    let n = [0, 0, 0];
    const base = [0, 0, 0];
    let face = -1;
    if (q.kind === 0) {
      const j = (q.i + 1) % 3;
      const k2 = (q.i + 2) % 3;
      n[q.i] = q.s;
      base[q.i] = q.s * h[q.i];
      base[j] = (f * 2 - 1) * h[j];
      base[k2] = (g * 2 - 1) * h[k2];
      face = q.i * 2 + (q.s > 0 ? 0 : 1);
    } else if (q.kind === 1) {
      const j = (q.ax + 1) % 3;
      const k2 = (q.ax + 2) % 3;
      const a = g * Math.PI * 0.5;
      n[j] = q.sj * Math.cos(a);
      n[k2] = q.sk * Math.sin(a);
      base[q.ax] = (f * 2 - 1) * h[q.ax];
      base[j] = q.sj * h[j];
      base[k2] = q.sk * h[k2];
    } else {
      const a = g * Math.PI * 0.5;
      const w = Math.sqrt(1 - f * f);
      n = [q.s[0] * w * Math.cos(a), q.s[1] * f, q.s[2] * w * Math.sin(a)];
      for (let i = 0; i < 3; i++) base[i] = q.s[i] * h[i];
    }
    const p = [base[0] + n[0] * r, base[1] + n[1] * r, base[2] + n[2] * r];
    return { p, n, u: p[0] / sx + 0.5, v: p[1] / sy + 0.5, face };
  };
  const pick = (a) => {
    const x = Math.min(a, 1 - 1e-9) * area;
    let q = pieces[pieces.length - 1];
    for (const it of pieces)
      if (x < it.cum) {
        q = it;
        break;
      }
    return [q, clamp01((x - (q.cum - q.area)) / q.area)];
  };
  return {
    area,
    thick: Math.min(sx, sy, sz) / 2,
    sample(rand) {
      const [q] = pick(rand());
      return at(q, rand(), rand());
    },
    sampleEven(a, b) {
      const [q, f] = pick(a);
      return at(q, f, b);
    },
  };
}
