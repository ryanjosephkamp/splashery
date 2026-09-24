// Maths & art: curves, surfaces, solids and fractals, coloured with soft
// gradients. Strange attractors glow along their path, the tesseract turns
// itself inside out, and the solids and the Sierpinski tetrahedron come
// apart when tapped. Loaded on demand.

import { mix, shade, smoothstep, clamp, ramp, quatAxisAngle } from "../kit.js";

const TAU = Math.PI * 2;
const PHI = (1 + Math.sqrt(5)) / 2;
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

// Baked light from above, front and right, with a sheen towards the viewer.
const LIGHT = unit([0.4, 0.85, 0.55]);
const VIEW = unit([0.5, 0.35, 0.8]);
const HALF = unit(add(LIGHT, VIEW));
function lit(col, n, { amb = 0.62, dif = 0.45, spec = 0.25, pow = 28, two = false } = {}) {
  const l = dot(n, LIGHT);
  const d = two ? Math.abs(l) : Math.max(0, l);
  let c = shade(col, amb + dif * d);
  if (spec > 0) {
    const h = dot(n, HALF);
    c = mix(c, [1, 1, 1], spec * Math.pow(Math.max(0, two ? Math.abs(h) : h), pow));
  }
  return c;
}

// ---- Custom shapes ---------------------------------------------------------------

// A tube along a polyline, sampled evenly by length; samples carry t (0..1
// along the path) and the tangent (for stretched splats).
function polyTube(pts, radius, { closed = false } = {}) {
  const n = pts.length;
  const segs = closed ? n : n - 1;
  const cum = new Float64Array(segs + 1);
  for (let i = 0; i < segs; i++) cum[i + 1] = cum[i] + len(sub(pts[(i + 1) % n], pts[i]));
  const L = cum[segs];
  const rad = typeof radius === "function" ? radius : () => radius;
  let avg = 0;
  let maxR = 0;
  for (let i = 0; i <= 32; i++) {
    avg += rad(i / 32) / 33;
    maxR = Math.max(maxR, rad(i / 32));
  }
  return {
    area: TAU * avg * L,
    thick: maxR,
    sample(rand) {
      const s = rand() * L;
      let lo = 0;
      let hi = segs - 1;
      while (lo < hi) {
        const mid = (lo + hi + 1) >> 1;
        if (cum[mid] <= s) lo = mid;
        else hi = mid - 1;
      }
      const a = pts[lo];
      const b = pts[(lo + 1) % n];
      const f = (s - cum[lo]) / (cum[lo + 1] - cum[lo] || 1);
      const T = unit(sub(b, a));
      const ref = Math.abs(T[1]) < 0.9 ? [0, 1, 0] : [1, 0, 0];
      const N = unit(cross(T, ref));
      const B = cross(T, N);
      const ang = rand() * TAU;
      const t = s / L;
      const nn = add(mul(N, Math.cos(ang)), mul(B, Math.sin(ang)));
      const p0 = [a[0] + (b[0] - a[0]) * f, a[1] + (b[1] - a[1]) * f, a[2] + (b[2] - a[2]) * f];
      return { p: add(p0, mul(nn, rad(t))), n: nn, u: ang / TAU, v: t, t, tangent: T };
    },
  };
}

// A flat convex polygon, sampled evenly; samples carry the distance to the
// nearest edge.
function polyShape(pts) {
  const n = unit(cross(sub(pts[1], pts[0]), sub(pts[2], pts[0])));
  const tris = [];
  let total = 0;
  for (let i = 1; i < pts.length - 1; i++) {
    total += 0.5 * len(cross(sub(pts[i], pts[0]), sub(pts[i + 1], pts[0])));
    tris.push({ b: pts[i], c: pts[i + 1], cum: total });
  }
  const a = pts[0];
  return {
    area: total,
    thick: 0.05,
    sample(rand) {
      const x = rand() * total;
      let t = tris[tris.length - 1];
      for (const tr of tris)
        if (x < tr.cum) {
          t = tr;
          break;
        }
      const r1 = Math.sqrt(rand());
      const r2 = rand();
      const wa = 1 - r1;
      const wb = r1 * (1 - r2);
      const wc = r1 * r2;
      const p = [
        a[0] * wa + t.b[0] * wb + t.c[0] * wc,
        a[1] * wa + t.b[1] * wb + t.c[1] * wc,
        a[2] * wa + t.b[2] * wb + t.c[2] * wc,
      ];
      let edge = Infinity;
      for (let i = 0; i < pts.length; i++) {
        const e0 = pts[i];
        const e1 = pts[(i + 1) % pts.length];
        const d = sub(e1, e0);
        const q = clamp(dot(sub(p, e0), d) / dot(d, d), 0, 1);
        edge = Math.min(edge, len(sub(p, add(e0, mul(d, q)))));
      }
      return { p, n, u: r1, v: r2, edge };
    },
  };
}

// Many equal triangles sampled as one shape (fractal faces).
function triSoup(tris) {
  const norms = tris.map(([a, b, c]) => unit(cross(sub(b, a), sub(c, a))));
  const area = tris.reduce((s, [a, b, c]) => s + 0.5 * len(cross(sub(b, a), sub(c, a))), 0);
  return {
    area,
    thick: 0.02,
    sample(rand) {
      const i = Math.floor(rand() * tris.length);
      const [a, b, c] = tris[i];
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
        n: norms[i],
        u: wb,
        v: wc,
        bary: [wa, wb, wc],
      };
    },
  };
}

// ---- Curves ------------------------------------------------------------------------

function lorenzPath() {
  const s = 10;
  const r = 28;
  const b = 8 / 3;
  const f = (x, y, z) => [s * (y - x), x * (r - z) - y, x * y - b * z];
  let p = [0.1, 0, 0];
  const dt = 0.005;
  const pts = [];
  for (let i = 0; i < 12600; i++) {
    const k1 = f(...p);
    const k2 = f(...add(p, mul(k1, dt / 2)));
    const k3 = f(...add(p, mul(k2, dt / 2)));
    const k4 = f(...add(p, mul(k3, dt)));
    p = add(p, mul(add(add(k1, mul(k2, 2)), add(mul(k3, 2), k4)), dt / 6));
    if (i >= 600) pts.push([p[0] / 18, (p[2] - 24) / 18, p[1] / 18]);
  }
  return pts;
}

// The Lorenz path by length, for the racing spark: at(s) is the point a
// fraction s of the way along it.
let lorenzTrackCache = null;
function lorenzTrack() {
  if (!lorenzTrackCache) {
    const pts = lorenzPath();
    const cum = new Float64Array(pts.length);
    for (let i = 1; i < pts.length; i++) cum[i] = cum[i - 1] + len(sub(pts[i], pts[i - 1]));
    const L = cum[pts.length - 1];
    const at = (s) => {
      const x = clamp(s, 0, 1) * L;
      let lo = 0;
      let hi = pts.length - 1;
      while (hi - lo > 1) {
        const m = (lo + hi) >> 1;
        if (cum[m] <= x) lo = m;
        else hi = m;
      }
      const f = (x - cum[lo]) / (cum[hi] - cum[lo] || 1);
      return add(pts[lo], mul(sub(pts[hi], pts[lo]), f));
    };
    lorenzTrackCache = { at };
  }
  return lorenzTrackCache;
}
// How far behind the spark (as a fraction of the path) each tail blob runs.
const LORENZ_SPARKS = [0, 0.004, 0.008, 0.012, 0.016];

function torusKnot(p, q, n = 1600) {
  const pts = [];
  for (let i = 0; i < n; i++) {
    const a = (i / n) * TAU;
    const r = 2 + Math.cos(q * a);
    pts.push([r * Math.cos(p * a), r * Math.sin(p * a), -Math.sin(q * a)]);
  }
  return pts;
}

// ---- Polyhedra -----------------------------------------------------------------

// Faces of a convex polyhedron from its vertices and face normals (the
// dual's vertices): each face is the vertices furthest along its normal.
function facesOf(verts, normals) {
  return normals.map((n0) => {
    const n = unit(n0);
    let best = -Infinity;
    for (const v of verts) best = Math.max(best, dot(v, n));
    const on = verts.filter((v) => dot(v, n) > best - 1e-4);
    const c = mul(
      on.reduce((s, v) => add(s, v), [0, 0, 0]),
      1 / on.length,
    );
    const ref = unit(sub(on[0], c));
    const side = cross(n, ref);
    on.sort(
      (a, b) =>
        Math.atan2(dot(sub(a, c), side), dot(sub(a, c), ref)) -
        Math.atan2(dot(sub(b, c), side), dot(sub(b, c), ref)),
    );
    return { pts: on, n, c };
  });
}

function solid(kind) {
  const P = PHI;
  const Q = 1 / PHI;
  const cube = [];
  for (const x of [-1, 1]) for (const y of [-1, 1]) for (const z of [-1, 1]) cube.push([x, y, z]);
  const cyc = (a, b) => [
    [0, a, b],
    [a, b, 0],
    [b, 0, a],
  ];
  const ring = (a, b) => {
    const out = [];
    for (const s1 of [-1, 1]) for (const s2 of [-1, 1]) out.push(...cyc(a * s1, b * s2));
    return out;
  };
  // Icosahedron and dodecahedron in dual orientations.
  const ico = ring(1, P);
  const icoNormals = cube.concat(ring(P, Q).map(([x, y, z]) => [z, x, y]));
  const dod = cube.concat(ring(Q, P));
  const dodNormals = ring(P, 1);
  const octa = [
    [1, 0, 0],
    [-1, 0, 0],
    [0, 1, 0],
    [0, -1, 0],
    [0, 0, 1],
    [0, 0, -1],
  ];
  const tet = [
    [1, 1, 1],
    [1, -1, -1],
    [-1, 1, -1],
    [-1, -1, 1],
  ];
  const norm = (vs) => vs.map((v) => unit(v));
  if (kind === "tetrahedron")
    return facesOf(
      norm(tet),
      tet.map((v) => mul(v, -1)),
    );
  if (kind === "cube") return facesOf(norm(cube), octa);
  if (kind === "octahedron") return facesOf(norm(octa), cube);
  if (kind === "dodecahedron") return facesOf(norm(dod), dodNormals);
  return facesOf(norm(ico), icoNormals);
}

// ---- Fractals and implicit surfaces --------------------------------------------------

// Exposed unit faces of a Menger sponge (level L) in a cube of side 1.
function mengerShape(level) {
  const n = 3 ** level;
  const solidAt = (i, j, k) => {
    for (let l = 0; l < level; l++) {
      if ((i % 3 === 1) + (j % 3 === 1) + (k % 3 === 1) >= 2) return false;
      i = Math.floor(i / 3);
      j = Math.floor(j / 3);
      k = Math.floor(k / 3);
    }
    return true;
  };
  const occ = new Uint8Array(n * n * n);
  for (let i = 0; i < n; i++)
    for (let j = 0; j < n; j++)
      for (let k = 0; k < n; k++) occ[(i * n + j) * n + k] = solidAt(i, j, k) ? 1 : 0;
  const at = (i, j, k) =>
    i < 0 || j < 0 || k < 0 || i >= n || j >= n || k >= n ? 0 : occ[(i * n + j) * n + k];
  const dirs = [
    [1, 0, 0],
    [-1, 0, 0],
    [0, 1, 0],
    [0, -1, 0],
    [0, 0, 1],
    [0, 0, -1],
  ];
  const faces = [];
  for (let i = 0; i < n; i++)
    for (let j = 0; j < n; j++)
      for (let k = 0; k < n; k++) {
        if (!at(i, j, k)) continue;
        dirs.forEach((d, f) => {
          if (at(i + d[0], j + d[1], k + d[2])) return;
          // Occlusion: filled cells around the one in front of the face.
          let occl = 0;
          const fi = i + d[0];
          const fj = j + d[1];
          const fk = k + d[2];
          for (let a = -1; a <= 1; a++)
            for (let b = -1; b <= 1; b++) {
              const off = d[0] ? [0, a, b] : d[1] ? [a, 0, b] : [a, b, 0];
              occl += at(fi + off[0], fj + off[1], fk + off[2]);
            }
          faces.push(i, j, k, f, occl);
        });
      }
  const count = faces.length / 5;
  const cell = 1 / n;
  return {
    area: count * cell * cell,
    thick: 0.2,
    faces: count,
    sample(rand) {
      const q = Math.floor(rand() * count) * 5;
      const f = faces[q + 3];
      const d = dirs[f];
      const u = rand();
      const v = rand();
      const c = [
        (faces[q] + 0.5) * cell - 0.5,
        (faces[q + 1] + 0.5) * cell - 0.5,
        (faces[q + 2] + 0.5) * cell - 0.5,
      ];
      const p = [c[0] + d[0] * cell * 0.5, c[1] + d[1] * cell * 0.5, c[2] + d[2] * cell * 0.5];
      const a1 = d[0] ? 1 : 0;
      const a2 = d[2] ? 1 : 2;
      p[a1] += (u - 0.5) * cell;
      p[a2] += (v - 0.5) * cell;
      const depth = Math.min(0.5 - Math.abs(p[0]), 0.5 - Math.abs(p[1]), 0.5 - Math.abs(p[2]));
      return { p, n: d, u, v, face: f, occl: faces[q + 4], depth };
    },
  };
}

// A triply periodic gyroid sin x cos y + sin y cos z + sin z cos x = 0,
// clipped to a ball or a cube: points projected onto the surface, both
// sides offset a little so each can take its own colour.
function gyroidShape(scale, clip) {
  const g = (x, y, z) =>
    Math.sin(x) * Math.cos(y) + Math.sin(y) * Math.cos(z) + Math.sin(z) * Math.cos(x);
  const grad = (x, y, z) => [
    Math.cos(x) * Math.cos(y) - Math.sin(z) * Math.sin(x),
    -Math.sin(x) * Math.sin(y) + Math.cos(y) * Math.cos(z),
    -Math.sin(y) * Math.sin(z) + Math.cos(z) * Math.cos(x),
  ];
  const inside =
    clip === "sphere"
      ? (p) => len(p) < 1
      : (p) => Math.max(Math.abs(p[0]), Math.abs(p[1]), Math.abs(p[2])) < 0.85;
  const vol = clip === "sphere" ? (4 / 3) * Math.PI : 1.7 ** 3;
  // Area per volume of this gyroid is about 3.09 / (2 pi) per unit of scale.
  const area = (3.09 / TAU) * scale * vol * 2;
  return {
    area,
    thick: 0.05,
    sample(rand) {
      for (let tries = 0; tries < 40; tries++) {
        let p = [rand() * 2 - 1, rand() * 2 - 1, rand() * 2 - 1];
        let n = [0, 1, 0];
        for (let it = 0; it < 6; it++) {
          const x = p[0] * scale;
          const y = p[1] * scale;
          const z = p[2] * scale;
          const v = g(x, y, z);
          const gr = grad(x, y, z);
          const l2 = dot(gr, gr) || 1;
          p = sub(p, mul(gr, v / l2 / scale));
          n = gr;
        }
        if (!inside(p)) continue;
        if (Math.abs(g(p[0] * scale, p[1] * scale, p[2] * scale)) > 0.01) continue;
        n = unit(n);
        const side = rand() < 0.5 ? 1 : -1;
        const nn = mul(n, side);
        return { p: add(p, mul(nn, 0.014)), n: nn, u: 0, v: 0, side };
      }
      return { p: [0, 0, 0], n: [0, 1, 0], u: 0, v: 0, side: 1 };
    },
  };
}

// The power-8 Mandelbulb (its axis turned to point up): sphere-traced from
// outside along many directions; each hit becomes a small patch of surface.
function mandelDE(x0, y0, z0, out, iters = 6) {
  // Formula axes: X, Z, Y (so the bulb's axis of symmetry is our Y).
  let x = x0;
  let y = z0;
  let z = y0;
  const cx = x;
  const cy = y;
  const cz = z;
  let dr = 1;
  let r = 0;
  let trap = 10;
  for (let i = 0; i < iters; i++) {
    r = Math.sqrt(x * x + y * y + z * z);
    if (r > 2) break;
    trap = Math.min(trap, r);
    const th = Math.acos(clamp(z / (r || 1e-9), -1, 1)) * 8;
    const ph = Math.atan2(y, x) * 8;
    const r7 = r ** 7;
    dr = r7 * 8 * dr + 1;
    const zr = r7 * r;
    const st = Math.sin(th);
    x = zr * st * Math.cos(ph) + cx;
    y = zr * st * Math.sin(ph) + cy;
    z = zr * Math.cos(th) + cz;
  }
  if (out) out.trap = trap;
  return (0.5 * Math.log(Math.max(r, 1e-9)) * r) / dr;
}

function mandelbulbShape(rays = 12000) {
  const hits = [];
  const ga = Math.PI * (3 - Math.sqrt(5));
  const o = {};
  for (let i = 0; i < rays; i++) {
    const yy = 1 - ((i + 0.5) / rays) * 2;
    const rr = Math.sqrt(1 - yy * yy);
    const d = [Math.cos(ga * i) * rr, yy, Math.sin(ga * i) * rr];
    let s = 1.3;
    let steps = 0;
    let hit = false;
    for (; steps < 70; steps++) {
      const de = mandelDE(d[0] * s, d[1] * s, d[2] * s);
      if (de < 0.003) {
        hit = true;
        break;
      }
      s -= Math.max(de * 0.9, 0.002);
      if (s < 0.05) break;
    }
    if (!hit) continue;
    const p = mul(d, s);
    const e = 0.007;
    const n = unit([
      mandelDE(p[0] + e, p[1], p[2]) - mandelDE(p[0] - e, p[1], p[2]),
      mandelDE(p[0], p[1] + e, p[2]) - mandelDE(p[0], p[1] - e, p[2]),
      mandelDE(p[0], p[1], p[2] + e) - mandelDE(p[0], p[1], p[2] - e),
    ]);
    mandelDE(p[0], p[1], p[2], o);
    const a = (4 * Math.PI * s * s) / rays / Math.max(0.4, Math.abs(dot(n, d)));
    hits.push({ p, n, trap: o.trap, steps, a, r: s });
  }
  let total = 0;
  const cum = hits.map((h) => (total += h.a));
  return {
    area: total,
    thick: 0.05,
    sample(rand) {
      const x = rand() * total;
      let lo = 0;
      let hi = hits.length - 1;
      while (lo < hi) {
        const mid = (lo + hi) >> 1;
        if (cum[mid] < x) lo = mid + 1;
        else hi = mid;
      }
      const h = hits[lo];
      const ref = Math.abs(h.n[1]) < 0.9 ? [0, 1, 0] : [1, 0, 0];
      const t1 = unit(cross(h.n, ref));
      const t2 = cross(h.n, t1);
      const rad = Math.sqrt(h.a / Math.PI) * Math.sqrt(rand());
      const ang = rand() * TAU;
      const p = add(h.p, add(mul(t1, rad * Math.cos(ang)), mul(t2, rad * Math.sin(ang))));
      return { p, n: h.n, u: 0, v: 0, trap: h.trap, steps: h.steps, r: h.r };
    },
  };
}

// Sierpinski tetrahedron: the four corner copies, recursively.
function sierpinski(level) {
  const h = 2 * Math.sqrt(2 / 3);
  const base = [
    [0, 0, 2 / Math.sqrt(3)],
    [-1, 0, -1 / Math.sqrt(3)],
    [1, 0, -1 / Math.sqrt(3)],
    [0, h, 0],
  ];
  const mid = (a, b) => mul(add(a, b), 0.5);
  const split = (t) => t.map((v, i) => t.map((w, j) => (i === j ? v : mid(v, w))));
  const groups = split(base).map((t) => {
    let list = [t];
    for (let l = 1; l < level; l++) list = list.flatMap(split);
    const tris = [];
    for (const [a, b, c, d] of list) {
      const cen = mul(add(add(a, b), add(c, d)), 0.25);
      for (const f of [
        [a, b, c],
        [a, b, d],
        [a, c, d],
        [b, c, d],
      ]) {
        const n = cross(sub(f[1], f[0]), sub(f[2], f[0]));
        tris.push(dot(n, sub(f[0], cen)) < 0 ? [f[0], f[2], f[1]] : f);
      }
    }
    return tris;
  });
  const centre = mul(add(add(base[0], base[1]), add(base[2], base[3])), 0.25);
  return { groups, corners: base, centre, height: h };
}

const PALETTES = {
  ocean: ["#1b2a49", "#22577a", "#38a3a5", "#57cc99", "#c7f9cc"],
  sunset: ["#3d1c56", "#8e2c73", "#d64161", "#f28b50", "#ffd27f"],
  jewel: ["#10002b", "#3c096c", "#7b2cbf", "#c77dff", "#e0aaff"],
  candy: ["#ff595e", "#ffca3a", "#8ac926", "#1982c4", "#6a4c93"],
};

// Directions the four corner copies move when the tetrahedron explodes.
const SIER = sierpinski(1);
const SIER_DIRS = SIER.corners.map((v) => unit(sub(v, SIER.centre)));

// Faces grouped (at most 15) for exploding solids: the icosahedron's 20
// faces go in pairs of neighbours.
function groupFaces(faces) {
  if (faces.length <= 15) return faces.map((_, i) => i);
  const group = faces.map(() => -1);
  let g = 0;
  faces.forEach((f, i) => {
    if (group[i] >= 0) return;
    group[i] = g;
    let best = -1;
    let bd = -2;
    faces.forEach((h, j) => {
      if (group[j] >= 0) return;
      const d = dot(f.n, h.n);
      if (d > bd) {
        bd = d;
        best = j;
      }
    });
    if (best >= 0) group[best] = g;
    g++;
  });
  return group;
}

// Every solid's faces, groups and group directions (drive() sees only part
// names, so it moves the groups of whichever solid was built).
const SOLID_KINDS = ["tetrahedron", "cube", "octahedron", "dodecahedron", "icosahedron"];
const SOLIDS = {};
for (const kind of SOLID_KINDS) {
  const faces = solid(kind);
  const groups = groupFaces(faces);
  const dirs = [];
  faces.forEach((f, i) => {
    dirs[groups[i]] = add(dirs[groups[i]] || [0, 0, 0], f.n);
  });
  SOLIDS[kind] = { faces, groups, dirs: dirs.map(unit) };
}

// ---- Recipes ------------------------------------------------------------------------

export const RECIPES = {
  lorenz: {
    alive: true,
    controls: [
      { key: "glow", label: "Glow", type: "slider", default: 0.7 },
      { key: "race", label: "Race", type: "pulse", ease: 4.2 },
    ],
    action: { key: "race", label: "Race along the path", sound: "whoosh" },
    // A tap sends a bright spark racing round the attractor; it draws the
    // path afresh in white-gold light behind it, which then fades.
    drive(t, c, out) {
      const p = c.race > 0 ? 1 - c.race : 1;
      const on = c.race > 0 ? 1 : 0;
      const s = clamp(p / 0.7, 0, 1);
      const path = lorenzTrack();
      LORENZ_SPARKS.forEach((lag, i) => {
        out.parts[`spark${i}`] = {
          offset: sub(path.at(Math.max(0, s - lag)), path.at(0)),
          visible: on * smoothstep(0, 0.03, p) * (1 - smoothstep(0.72, 0.8, p)),
        };
      });
      out.grow = on * s * 1.08;
      out.parts.trace = { visible: on * (1 - smoothstep(0.78, 1, p)) };
      out.glow = [1, 0.92, 0.72, 0.3 + 1.5 * c.glow];
    },
    build(k) {
      const pts = lorenzPath();
      const stops = ["#1d2671", "#4b2c91", "#8f3bb3", "#d6479a", "#ff7a59", "#ffc15e"];
      k.add(polyTube(pts, 0.011), {
        flat: 0.6,
        stretch: 2.2,
        kind: "pulse",
        params: (c) => [(c.t * 6) % 1, 0],
        color: (c) => {
          const col = ramp(stops, c.t);
          return shade(col, 0.82 + 0.3 * Math.max(0, dot(c.n, LIGHT)));
        },
      });
      // The racing spark and its tail, and the bright trace it draws (all
      // hidden until a tap).
      const start = pts[0];
      LORENZ_SPARKS.forEach((lag, i) => {
        const part = k.part(`spark${i}`);
        const f = 1 - i / LORENZ_SPARKS.length;
        k.cloud({ share: 0.004 * f, size: 1.3 * f, pattern: false }, (rand, j, n) => {
          const halo = j < n * 0.4;
          return {
            p: add(
              start,
              mul(
                unit([rand() - 0.5, rand() - 0.5, rand() - 0.5]),
                (halo ? 0.16 : 0.06) * f * Math.cbrt(rand()),
              ),
            ),
            color: halo ? "#ffd98a" : "#ffffff",
            opacity: halo ? 0.35 : 1,
            size: halo ? 2.4 : 1,
            part,
          };
        });
      });
      k.add(polyTube(pts, 0.022), {
        part: k.part("trace"),
        share: 0.08,
        flat: 0.6,
        stretch: 2.2,
        pattern: false,
        kind: "grow",
        params: (c) => [c.t, 0],
        color: (c) => mix("#fff4d0", "#ffd36b", 0.5 + 0.5 * Math.sin(c.t * 40)),
      });
    },
  },

  mobius: {
    alive: true,
    density: 0.7,
    options: [
      {
        key: "colors",
        label: "Colours",
        type: "select",
        default: "sunset",
        choices: [
          { id: "sunset", label: "Sunset" },
          { id: "ocean", label: "Ocean" },
          { id: "jewel", label: "Jewel" },
        ],
      },
    ],
    controls: [{ key: "glow", label: "Glow", type: "slider", default: 0.6 }],
    drive(t, c, out) {
      out.glow = [1, 1, 0.9, 0.2 + 1.2 * c.glow];
    },
    build(k, o) {
      const pal = PALETTES[o.colors] || PALETTES.sunset;
      const cyc = [pal[1], pal[2], pal[3], pal[4], pal[2], pal[1]];
      const W = 0.5;
      const band = k.param(
        (u, v) => {
          const th = u * TAU;
          const w = (v - 0.5) * 2 * W;
          const r = 1 + w * Math.cos(th / 2);
          return [r * Math.cos(th), w * Math.sin(th / 2), r * Math.sin(th)];
        },
        { grid: 120 },
      );
      k.add(band, {
        rot: [38, 0, -8],
        flat: 0.12,
        kind: "pulse",
        params: (c) => [(c.u * 2) % 1, 0],
        color: (c) => {
          const e = Math.abs(c.v - 0.5) * 2;
          let col = ramp(cyc, c.u);
          if ((c.u * 40) % 1 < 0.08) col = shade(col, 0.85);
          col = lit(col, c.n, { amb: 0.66, dif: 0.42, spec: 0.3, two: true });
          if (e > 0.93) return keep(mix(col, "#fff6d8", 0.75));
          return col;
        },
      });
    },
  },

  "klein-bottle": {
    alive: true,
    density: 0.8,
    options: [{ key: "color", label: "Glass", type: "color", default: "#3fb6c9" }],
    controls: [
      { key: "glow", label: "Glow", type: "slider", default: 0.5 },
      { key: "surge", label: "Surge", type: "pulse", ease: 4.5 },
    ],
    action: { key: "surge", label: "Send water through", sound: "drop" },
    // A tap pours a surge of glowing water in at the base: its front runs up
    // the body, through the neck and round into the bottom, then it fades.
    drive(t, c, out) {
      const p = c.surge > 0 ? 1 - c.surge : 1;
      const on = c.surge > 0 ? 1 : 0;
      out.grow = on * 1.1 * (1 - Math.pow(1 - clamp(p / 0.45, 0, 1), 2));
      out.parts.water = { visible: on * (1 - smoothstep(0.6, 0.95, p)) };
      out.glow = [0.85, 0.95, 1, 0.2 + 1.0 * c.glow + 0.5 * c.surge];
    },
    build(k, o) {
      const f = (U, V) => {
        const u = U * Math.PI;
        const v = V * TAU;
        const cu = Math.cos(u);
        const su = Math.sin(u);
        const cv = Math.cos(v);
        const sv = Math.sin(v);
        const x =
          (-2 / 15) *
          cu *
          (3 * cv - 30 * su + 90 * cu ** 4 * su - 60 * cu ** 6 * su + 5 * cu * cv * su);
        const y =
          (-1 / 15) *
          su *
          (3 * cv -
            3 * cu ** 2 * cv -
            48 * cu ** 4 * cv +
            48 * cu ** 6 * cv -
            60 * su +
            5 * cu * cv * su -
            5 * cu ** 3 * cv * su -
            80 * cu ** 5 * cv * su +
            80 * cu ** 7 * cv * su);
        const z = (2 / 15) * (3 + 5 * cu * su) * sv;
        return [x, -y, z];
      };
      const glass = o.color;
      const violet = "#8a5cf6";
      k.add(k.param(f, { grid: 120 }), {
        rot: [0, 0, 0],
        flat: 0.12,
        opacity: 0.28,
        kind: "pulse",
        params: (c) => [c.u, 0],
        color: (c) => {
          const rim = 1 - Math.abs(dot(c.n, VIEW));
          const col = mix(glass, violet, smoothstep(0.1, 0.9, c.u));
          return mix(
            lit(col, c.n, { amb: 0.7, dif: 0.35, spec: 0.6, pow: 30, two: true }),
            "#ffffff",
            0.45 * rim * rim,
          );
        },
      });
      // The water (hidden until a tap): a slimmer copy of the surface inside
      // the glass, drawn in along the tube as the surge advances.
      const mids = [];
      for (let i = 0; i <= 256; i++) {
        const m = [0, 0, 0];
        for (let j = 0; j < 12; j++) {
          const q = f(i / 256, j / 12);
          for (let l = 0; l < 3; l++) m[l] += q[l] / 12;
        }
        mids.push(m);
      }
      const mid = (U) => {
        const x = clamp(U, 0, 1) * 256;
        const i = Math.min(255, Math.floor(x));
        return add(mids[i], mul(sub(mids[i + 1], mids[i]), x - i));
      };
      k.add(
        k.param(
          (U, V) => {
            const m = mid(U);
            return add(m, mul(sub(f(U, V), m), 0.9));
          },
          { grid: 96 },
        ),
        {
          part: k.part("water"),
          share: 0.14,
          flat: 0.3,
          opacity: 1,
          pattern: false,
          kind: "grow",
          params: (c) => [c.u, 0],
          color: (c) => {
            // Bright ripples across the flow, so the moving front reads.
            const ripple = Math.pow(0.5 + 0.5 * Math.sin(c.u * 90 + 2 * Math.sin(c.v * TAU)), 3);
            const col = mix("#1640d8", "#e6fbff", ripple);
            return lit(col, c.n, { amb: 0.8, dif: 0.3, spec: 0.5, pow: 20, two: true });
          },
        },
      );
    },
  },

  "menger-sponge": {
    options: [
      {
        key: "level",
        label: "Level",
        type: "select",
        default: "3",
        choices: [
          { id: "2", label: "Level 2" },
          { id: "3", label: "Level 3" },
        ],
      },
    ],
    build(k, o) {
      const shape = mengerShape(o.level === "2" ? 2 : 3);
      const light = [1.0, 0.62, 1.12, 0.5, 0.88, 0.6];
      k.add(shape, {
        flat: 0.12,
        color: (c) => {
          const s = c.s;
          const outer = ramp(["#c8553d", "#f28f3b", "#ffd5a3"], c.p[1] + 0.5);
          const inner = ramp(["#2b2d6e", "#1b4f8a", "#0f7c8c"], (c.p[0] + c.p[2] + 1) / 2);
          // Walls inside the holes are cooler and darker the deeper they go.
          const wall = s.depth > 0.002 ? 0.55 + 0.45 * smoothstep(0.0, 0.25, s.depth) : 0;
          let col = mix(outer, inner, wall);
          col = shade(col, light[s.face] * (1 - 0.06 * s.occl) * (1 - 0.25 * wall));
          return col;
        },
      });
    },
  },

  hypercube: {
    alive: true,
    controls: [{ key: "turn", label: "4D turn", type: "slider", default: 0.85 }],
    drive(t, c, out) {
      out.amount = c.turn;
      out.body = { quat: quatAxisAngle(unit([0.25, 1, 0.12]), t * 0.28) };
    },
    build(k) {
      const a = 0.9;
      const s = 0.5;
      const A = 0.3;
      const outerCol = "#35c3f0";
      const innerCol = "#f72585";
      const corners = [];
      for (const x of [-1, 1])
        for (const y of [-1, 1]) for (const z of [-1, 1]) corners.push([x, y, z]);
      const edges = [];
      for (let i = 0; i < 8; i++)
        for (let j = i + 1; j < 8; j++) {
          const d = sub(corners[i], corners[j]);
          if (Math.abs(d[0]) + Math.abs(d[1]) + Math.abs(d[2]) === 2) edges.push([i, j]);
        }
      const glowTube = (col) => (c) => shade(col, 0.85 + 0.35 * Math.max(0, dot(c.n, LIGHT)));
      for (const [i, j] of edges) {
        k.add(polyTube([mul(corners[i], a), mul(corners[j], a)], 0.028), {
          flat: 0.4,
          stretch: 1.6,
          kind: "breathe",
          params: [-A, 0],
          color: glowTube(outerCol),
        });
        k.add(polyTube([mul(corners[i], a * s), mul(corners[j], a * s)], 0.024), {
          flat: 0.4,
          stretch: 1.6,
          kind: "breathe",
          params: [A, 0],
          color: glowTube(innerCol),
        });
      }
      for (const v of corners) {
        // A connector from the inner corner to the outer one stays straight
        // while each end swells with its own cube.
        k.add(polyTube([mul(v, a * s), mul(v, a)], 0.02), {
          flat: 0.4,
          stretch: 1.6,
          kind: "breathe",
          params: (c) => [(A * ((1 - c.t) * s - c.t)) / ((1 - c.t) * s + c.t), 0],
          color: (c) => glowTube(mix(innerCol, outerCol, c.t))(c),
        });
        for (const [r, amp, col] of [
          [0.065, -A, outerCol],
          [0.055, A, innerCol],
        ])
          k.add(k.sphere(r), {
            pos: mul(v, amp < 0 ? a : a * s),
            weight: 1.2,
            flat: 0.3,
            kind: "breathe",
            params: [amp, 0],
            pattern: false,
            color: (c) => keep(mix(col, "#ffffff", 0.45 + 0.4 * Math.max(0, dot(c.n, HALF)))),
          });
      }
      k.reach([1.2, 1.2, 1.2]);
      k.reach([-1.2, -1.2, -1.2]);
    },
  },

  "torus-knot": {
    alive: true,
    options: [
      {
        key: "knot",
        label: "Knot",
        type: "select",
        default: "2-3",
        choices: [
          { id: "2-3", label: "Trefoil (2, 3)" },
          { id: "2-5", label: "Cinquefoil (2, 5)" },
          { id: "3-4", label: "(3, 4)" },
          { id: "3-5", label: "(3, 5)" },
          { id: "2-7", label: "(2, 7)" },
        ],
      },
      {
        key: "colors",
        label: "Colours",
        type: "select",
        default: "sunset",
        choices: [
          { id: "sunset", label: "Sunset" },
          { id: "ocean", label: "Ocean" },
          { id: "jewel", label: "Jewel" },
          { id: "candy", label: "Candy" },
        ],
      },
    ],
    controls: [{ key: "glow", label: "Glow", type: "slider", default: 0.6 }],
    drive(t, c, out) {
      out.glow = [1, 1, 0.92, 0.2 + 1.3 * c.glow];
    },
    build(k, o) {
      const [p, q] = o.knot.split("-").map(Number);
      const pal = PALETTES[o.colors] || PALETTES.sunset;
      const cyc = [pal[1], pal[2], pal[3], pal[4], pal[3], pal[2], pal[1]];
      const r = p * q > 12 ? 0.26 : 0.36;
      k.add(polyTube(torusKnot(p, q), r, { closed: true }), {
        flat: 0.25,
        kind: "pulse",
        params: (c) => [(c.t * 3) % 1, 0],
        interior: 0.06,
        core: pal[0],
        color: (c) => {
          const col = ramp(cyc, c.t);
          const stripe = (c.t * 90) % 1 < 0.1 ? 0.9 : 1;
          return shade(lit(col, c.n, { amb: 0.6, dif: 0.48, spec: 0.5, pow: 34 }), stripe);
        },
      });
    },
  },

  gyroid: {
    options: [
      {
        key: "clip",
        label: "Shape",
        type: "select",
        default: "cube",
        choices: [
          { id: "cube", label: "Cube" },
          { id: "sphere", label: "Ball" },
        ],
      },
    ],
    build(k, o) {
      k.add(gyroidShape(4.6, o.clip), {
        flat: 0.08,
        color: (c) => {
          const h = (c.p[1] + 1) / 2;
          const col =
            c.s.side > 0
              ? ramp(["#0b3d91", "#1f8ac0", "#46d6c8"], h)
              : ramp(["#b5179e", "#f15b5b", "#ffc15e"], h);
          return lit(col, c.n, { amb: 0.55, dif: 0.55, spec: 0.3 });
        },
      });
    },
  },

  mandelbulb: {
    build(k) {
      k.add(mandelbulbShape(), {
        flat: 0.45,
        color: (c) => {
          const col = ramp(
            ["#2a1457", "#6d2e9e", "#d9587d", "#ffb36b", "#fff0c9"],
            clamp((c.s.r - 0.55) / 0.6, 0, 1),
          );
          const ao = 1 - clamp((c.s.steps - 10) / 45, 0, 0.5);
          return shade(lit(col, c.n, { amb: 0.5, dif: 0.6, spec: 0.35 }), ao);
        },
      });
    },
  },

  sierpinski: {
    options: [
      {
        key: "level",
        label: "Level",
        type: "select",
        default: "4",
        choices: [
          { id: "3", label: "Level 3" },
          { id: "4", label: "Level 4" },
          { id: "5", label: "Level 5" },
        ],
      },
    ],
    controls: [{ key: "open", label: "Explode", type: "toggle", default: 0, ease: 1.2 }],
    action: { key: "open", label: "Explode", sound: { on: "whoosh", off: "click" } },
    drive(t, c, out) {
      const e = easeInOut(c.open);
      SIER_DIRS.forEach((d, i) => {
        out.parts["g" + i] = { offset: mul(d, 0.55 * e) };
      });
    },
    build(k, o) {
      const s = sierpinski(Number(o.level));
      const stops = ["#5a189a", "#c9184a", "#ff8c42", "#ffd166"];
      s.groups.forEach((tris, i) => {
        const part = k.part("g" + i, { pivot: s.centre });
        k.add(triSoup(tris), {
          part,
          flat: 0.12,
          color: (c) => {
            const m = Math.min(c.s.bary[0], c.s.bary[1], c.s.bary[2]);
            const col = lit(ramp(stops, c.p[1] / s.height), c.n, { amb: 0.6, dif: 0.5, spec: 0.3 });
            return m < 0.04 ? shade(col, 0.72) : col;
          },
        });
      });
    },
  },

  platonic: {
    options: [
      {
        key: "solid",
        label: "Solid",
        type: "select",
        default: "dodecahedron",
        choices: [
          { id: "tetrahedron", label: "Tetrahedron" },
          { id: "cube", label: "Cube" },
          { id: "octahedron", label: "Octahedron" },
          { id: "dodecahedron", label: "Dodecahedron" },
          { id: "icosahedron", label: "Icosahedron" },
        ],
      },
      {
        key: "colors",
        label: "Colours",
        type: "select",
        default: "ocean",
        choices: [
          { id: "ocean", label: "Ocean" },
          { id: "sunset", label: "Sunset" },
          { id: "jewel", label: "Jewel" },
          { id: "candy", label: "Candy" },
        ],
      },
    ],
    controls: [{ key: "open", label: "Explode", type: "toggle", default: 0, ease: 1 }],
    action: { key: "open", label: "Explode", sound: { on: "whoosh", off: "click" } },
    drive(t, c, out) {
      const e = easeInOut(c.open);
      for (const kind of SOLID_KINDS)
        SOLIDS[kind].dirs.forEach((d, g) => {
          out.parts[kind + g] = { offset: mul(d, 0.32 * e) };
        });
    },
    build(k, o) {
      const { faces, groups } = SOLIDS[o.solid] || SOLIDS.dodecahedron;
      const pal = PALETTES[o.colors] || PALETTES.ocean;
      const rim = 0.035 * (o.solid === "dodecahedron" || o.solid === "icosahedron" ? 0.8 : 1);
      faces.forEach((f, i) => {
        const part = k.part(o.solid + groups[i], { pivot: [0, 0, 0] });
        const tint = ramp(pal.slice(1), (i * 0.618 + 0.1) % 1);
        k.add(polyShape(f.pts), {
          part,
          flat: 0.12,
          color: (c) => {
            const col = lit(tint, f.n, { amb: 0.6, dif: 0.5, spec: 0.4, pow: 20 });
            if (c.s.edge < rim) return keep(mix(col, "#fffaf0", 0.85));
            if (c.s.edge < rim * 2) return shade(col, 0.88);
            return col;
          },
        });
      });
    },
  },

  "seashell-spiral": {
    density: 0.85,
    build(k) {
      const f = (U, V) => {
        const u = U * 6 * Math.PI;
        const v = V * TAU;
        const e6 = Math.exp(u / (6 * Math.PI));
        const c2 = Math.cos(v / 2) ** 2;
        return [
          2 * (1 - e6) * Math.cos(u) * c2,
          1 - Math.exp(u / (3 * Math.PI)) - Math.sin(v) + e6 * Math.sin(v),
          2 * (-1 + e6) * Math.sin(u) * c2,
        ];
      };
      k.add(k.param(f, { grid: 140 }), {
        rot: [0, 40, 0],
        flat: 0.15,
        color: (c) => {
          const u = c.u * 6 * Math.PI;
          // Growth lines and zigzag bands, like a cone shell.
          const zig = Math.abs(((c.v * 14 + 0.5 * Math.sin(u * 5)) % 1) - 0.5);
          const growth = Math.abs((((u * 4) / Math.PI) % 1) - 0.5) < 0.06;
          let col = mix("#fbf0de", "#f3cfa7", 0.5 + 0.5 * Math.sin(c.v * TAU * 2));
          if (zig < 0.09) col = mix(col, "#a0582f", 0.75);
          if (growth) col = shade(col, 0.9);
          return lit(col, c.n, { amb: 0.66, dif: 0.42, spec: 0.4, two: true });
        },
      });
    },
  },
};
