// Maths & art: curves, surfaces, solids and fractals, coloured with soft
// gradients. Strange attractors glow along their path, the tesseract turns
// itself inside out, and the solids and the Sierpinski tetrahedron come
// apart when tapped. Loaded on demand.

import {
  mix,
  shade,
  smoothstep,
  clamp,
  ramp,
  quatAxisAngle,
  quatEuler,
  quatMul,
  quatRotate,
} from "../kit.js";

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
const clamp01 = (x) => (x < 0 ? 0 : x > 1 ? 1 : x);
const ease = (x) => x * x * (3 - 2 * x);
// 0 before a, rising to 1 at b.
const band = (x, a, b) => clamp01((x - a) / (b - a));
// Rises from a to b, holds, falls from c to d.
const bump = (x, a, b, c, d) => band(x, a, b) * (1 - band(x, c, d));
// A pulse control's progress: 0 at the tap, 1 when done (and at rest).
const progress = (v) => (v > 0 ? 1 - v : 1);
const rotY = (p, a) => {
  const c = Math.cos(a);
  const s = Math.sin(a);
  return [p[0] * c + p[2] * s, p[1], -p[0] * s + p[2] * c];
};
// The rotation whose columns are the unit vectors x, y and z.
function quatBasis(x, y, z) {
  const tr = x[0] + y[1] + z[2];
  if (tr > 0) {
    const s = Math.sqrt(tr + 1) * 2;
    return [(y[2] - z[1]) / s, (z[0] - x[2]) / s, (x[1] - y[0]) / s, 0.25 * s];
  }
  if (x[0] > y[1] && x[0] > z[2]) {
    const s = Math.sqrt(1 + x[0] - y[1] - z[2]) * 2;
    return [0.25 * s, (y[0] + x[1]) / s, (z[0] + x[2]) / s, (y[2] - z[1]) / s];
  }
  if (y[1] > z[2]) {
    const s = Math.sqrt(1 + y[1] - x[0] - z[2]) * 2;
    return [(y[0] + x[1]) / s, 0.25 * s, (z[1] + y[2]) / s, (z[0] - x[2]) / s];
  }
  const s = Math.sqrt(1 + z[2] - x[0] - y[1]) * 2;
  return [(z[0] + x[2]) / s, (z[1] + y[2]) / s, 0.25 * s, (x[1] - y[0]) / s];
}
// Direction towards a camera at yaw/pitch (see src/camera.js).
const camDir = (yaw, pitch) => [
  Math.sin(yaw) * Math.cos(pitch),
  Math.sin(pitch),
  Math.cos(yaw) * Math.cos(pitch),
];

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
// along the path), the tangent (for stretched splats) and `at`, the place
// along the list of points (2.5 is halfway from the third to the fourth).
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
      return { p: add(p0, mul(nn, rad(t))), n: nn, u: ang / TAU, v: t, t, tangent: T, at: lo + f };
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

// The solid cells of a level-L Menger sponge on a grid of 3^L cells a side;
// at(i, j, k) is 0 outside the grid.
function mengerGrid(level) {
  const n = 3 ** level;
  const occ = new Uint8Array(n * n * n);
  for (let i = 0; i < n; i++)
    for (let j = 0; j < n; j++)
      for (let k = 0; k < n; k++) {
        let a = i;
        let b = j;
        let c = k;
        let solid = 1;
        for (let l = 0; l < level && solid; l++) {
          if ((a % 3 === 1) + (b % 3 === 1) + (c % 3 === 1) >= 2) solid = 0;
          a = Math.floor(a / 3);
          b = Math.floor(b / 3);
          c = Math.floor(c / 3);
        }
        occ[(i * n + j) * n + k] = solid;
      }
  const at = (i, j, k) =>
    i < 0 || j < 0 || k < 0 || i >= n || j >= n || k >= n ? 0 : occ[(i * n + j) * n + k];
  return { n, at };
}

const CUBE_DIRS = [
  [1, 0, 0],
  [-1, 0, 0],
  [0, 1, 0],
  [0, -1, 0],
  [0, 0, 1],
  [0, 0, -1],
];

// Exposed faces of the solid cells of `grid` (a cube of side 1 about the
// origin) that `want(i, j, k, f)` keeps, sampled evenly. `shade` is the grid
// the occlusion is read from (the filled cells around the one in front of a
// face). Samples carry the face (0..5) and that occlusion.
function cellFaces(grid, want, shade = grid) {
  const { n, at } = grid;
  const faces = [];
  for (let i = 0; i < n; i++)
    for (let j = 0; j < n; j++)
      for (let k = 0; k < n; k++) {
        if (!at(i, j, k)) continue;
        CUBE_DIRS.forEach((d, f) => {
          if (at(i + d[0], j + d[1], k + d[2]) || !want(i, j, k, f)) return;
          let occl = 0;
          const fi = i + d[0];
          const fj = j + d[1];
          const fk = k + d[2];
          for (let a = -1; a <= 1; a++)
            for (let b = -1; b <= 1; b++) {
              const off = d[0] ? [0, a, b] : d[1] ? [a, 0, b] : [a, b, 0];
              occl += shade.at(fi + off[0], fj + off[1], fk + off[2]);
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
      const d = CUBE_DIRS[f];
      const u = rand();
      const v = rand();
      const p = [0, 1, 2].map((a) => (faces[q + a] + 0.5 + d[a] * 0.5) * cell - 0.5);
      p[d[0] ? 1 : 0] += (u - 0.5) * cell;
      p[d[2] ? 1 : 2] += (v - 0.5) * cell;
      return { p, n: d, u, v, face: f, occl: faces[q + 4] };
    },
  };
}

// The sponge's colour at p on a face (0..5) with occlusion occl: warm
// outside, cooler and darker on the walls deep in the holes.
const MENGER_LIGHT = [1.0, 0.62, 1.12, 0.5, 0.88, 0.6];
function mengerLook(p, face, occl) {
  const outer = ramp(["#c8553d", "#f28f3b", "#ffd5a3"], p[1] + 0.5);
  const inner = ramp(["#2b2d6e", "#1b4f8a", "#0f7c8c"], (p[0] + p[2] + 1) / 2);
  const depth = Math.min(0.5 - Math.abs(p[0]), 0.5 - Math.abs(p[1]), 0.5 - Math.abs(p[2]));
  const wall = depth > 0.002 ? 0.55 + 0.45 * smoothstep(0.0, 0.25, depth) : 0;
  const col = mix(outer, inner, wall);
  return shade(col, MENGER_LIGHT[face] * (1 - 0.06 * occl) * (1 - 0.25 * wall));
}

// The plugs of the holes that level k of the sponge carves: the cube (side
// 3^-k) at the middle of each face that level k - 1 leaves exposed. Each is
// { c: centre, f: the face it closes, occl: the occlusion its outer face
// would have in the finished sponge (read from `fine`) }.
function mengerPlugs(k, fine) {
  const g = mengerGrid(k - 1);
  const cell = 1 / g.n;
  const plugs = [];
  for (let i = 0; i < g.n; i++)
    for (let j = 0; j < g.n; j++)
      for (let l = 0; l < g.n; l++) {
        if (!g.at(i, j, l)) continue;
        CUBE_DIRS.forEach((d, f) => {
          if (g.at(i + d[0], j + d[1], l + d[2])) return;
          const mid = [i, j, l].map((x) => (x + 0.5) * cell - 0.5);
          // The fine cell just outside the middle of this face.
          const front = mid.map((x, a) => Math.floor((x + d[a] * cell * 0.5 + 0.5) * fine.n + d[a] * 0.5)); // prettier-ignore
          let occl = 0;
          for (let a = -1; a <= 1; a++)
            for (let b = -1; b <= 1; b++) {
              const off = d[0] ? [0, a, b] : d[1] ? [a, 0, b] : [a, b, 0];
              occl += fine.at(front[0] + off[0], front[1] + off[1], front[2] + off[2]);
            }
          // A hair proud of the face, so the hole's rim never draws over it.
          plugs.push({ c: add(mid, mul(d, cell / 3 + 0.009)), f, occl });
        });
      }
  return plugs;
}

// Faces of plug cubes of side s: the outer one, or the four sides (the
// inner face never shows). Samples carry the face and the plug, and `at`,
// the matching point on the outer face (sides take its colour).
function plugFaces(plugs, s, sides) {
  const per = sides ? 4 : 1;
  return {
    area: plugs.length * per * s * s * (sides ? 1 : 1.3),
    thick: s,
    sample(rand) {
      const plug = plugs[Math.floor(rand() * plugs.length)];
      const d = CUBE_DIRS[plug.f];
      const ax = d[0] ? 0 : d[1] ? 1 : 2;
      const face = sides ? [0, 1, 2, 3, 4, 5].filter((f) => f >> 1 !== ax)[Math.floor(rand() * 4)] : plug.f; // prettier-ignore
      const n = CUBE_DIRS[face];
      const fa = n[0] ? 0 : n[1] ? 1 : 2;
      const u = rand();
      const v = rand();
      // The outer face overlaps the rim of its hole a little, so a closed
      // hole shows no seam.
      const w = sides ? s : s * 1.14;
      const p = add(plug.c, mul(n, s / 2));
      const others = [0, 1, 2].filter((a) => a !== fa);
      p[others[0]] += (u - 0.5) * w;
      p[others[1]] += (v - 0.5) * w;
      const at = p.slice();
      at[ax] = plug.c[ax] + d[ax] * (s / 2);
      return { p, n, u, v, face, occl: plug.occl, at };
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

// The tesseract: 16 corners (x, y, z, w each +-1; corner i has w = +1 when
// i >= 8) and the 32 edges joining corners that differ in one coordinate.
// Seen in perspective from 4D, the w = +1 cube shows at 0.9 and the w = -1
// cube inside it at 0.45.
const TESS = [];
for (let i = 0; i < 16; i++)
  TESS.push([i & 1 ? 1 : -1, i & 2 ? 1 : -1, i & 4 ? 1 : -1, i & 8 ? 1 : -1]);
const TESS_EDGES = [];
for (let i = 0; i < 16; i++)
  for (let b = 0; b < 4; b++) if ((i ^ (1 << b)) > i) TESS_EDGES.push([i, i ^ (1 << b)]);
const tessShow = (v) => mul([v[0], v[1], v[2]], 1.8 / (3 - v[3]));
// A turn by angle a in the plane of X and W.
const tessTurn = (v, a) => {
  const c = Math.cos(a);
  const s = Math.sin(a);
  return [v[0] * c - v[3] * s, v[1], v[2], v[0] * s + v[3] * c];
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

// The Möbius band: half-width MOB_W, tipped by MOB_Q. mobiusPoint(th, w,
// psi) is the point at angle th round the loop and w across it, with the
// cross-section turned an extra psi about the middle line.
const MOB_W = 0.5;
const MOB_Q = quatEuler(38, 0, -8);
const MOB_TWIST = (th) => 0.5 * Math.sin(th);
function mobiusPoint(th, w, psi = 0) {
  const a = th / 2 + psi;
  const r = 1 + w * Math.cos(a);
  return quatRotate(MOB_Q, [r * Math.cos(th), w * Math.sin(a), r * Math.sin(th)]);
}
// Where the middle line is at angle th (not wrapped: after one lap the up
// side is the other face), with the twist m (0..1) applied: position,
// forward and up.
function mobiusFrame(th, m) {
  const R = [Math.cos(th), 0, Math.sin(th)];
  const a = th / 2;
  const b = a + MOB_TWIST(th);
  const d0 = [R[0] * Math.cos(a), Math.sin(a), R[2] * Math.cos(a)];
  const d1 = [R[0] * Math.cos(b), Math.sin(b), R[2] * Math.cos(b)];
  const d = unit(add(mul(d0, 1 - m), mul(d1, m)));
  const fwd = [-Math.sin(th), 0, Math.cos(th)];
  return {
    pos: quatRotate(MOB_Q, R),
    fwd: quatRotate(MOB_Q, fwd),
    up: quatRotate(MOB_Q, unit(cross(fwd, d))),
  };
}
const MOB_VIEW = camDir(0.9, 0.22);
const MOB_START = 0.45;
// The ant's two laps as a function of time (0..1): it hurries while it is
// underneath (out of sight) and takes its time on top.
const MOB_WALK = (() => {
  const N = 512;
  const time = [0];
  for (let i = 1; i <= N; i++) {
    const th = MOB_START + (2 * TAU * (i - 0.5)) / N;
    const seen = dot(mobiusFrame(th, 0).up, MOB_VIEW);
    time.push(time[i - 1] + 1 / (1 + 1.3 * smoothstep(0.05, -0.15, seen)));
  }
  return (x) => {
    const tt = clamp(x, 0, 1) * time[N];
    let i = 1;
    while (i < N && time[i] < tt) i++;
    const f = (tt - time[i - 1]) / (time[i] - time[i - 1]);
    return MOB_START + (2 * TAU * (i - 1 + f)) / N;
  };
})();
// The ant (facing +X, standing on the origin): body parts [centre, radii],
// and its six hips (front, middle, back; left then right).
const ANT = 1.3;
const ANT_BODY = [
  [[-0.075, 0.048, 0], [0.062, 0.04, 0.044]],
  [[-0.01, 0.038, 0], [0.013, 0.012, 0.012]],
  [[0.025, 0.042, 0], [0.04, 0.024, 0.024]],
  [[0.083, 0.048, 0], [0.031, 0.027, 0.029]],
].map(([c, r]) => [mul(c, ANT), mul(r, ANT)]);
const ANT_HIPS = [0.042, 0.042, 0.022, 0.022, 0.002, 0.002].map((x, i) =>
  mul([x, 0.034, i % 2 ? 0.016 : -0.016], ANT),
);
// The two ant copies are built here: in front of the band and behind it
// (for the draw order), inside the band's own reach.
const MOB_ANT_FRONT = mul(MOB_VIEW, 1.15);
const MOB_ANT_BACK = mul(MOB_VIEW, -1.15);

// ---- Recipes ------------------------------------------------------------------------

export const RECIPES = {
  lorenz: {
    alive: true,
    controls: [
      { key: "glow", label: "Glow", type: "slider", default: 0.7 },
      { key: "race", label: "Race", type: "pulse", ease: 4.2 },
    ],
    action: { key: "race", label: "Race along the path" },
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
    density: 1,
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
    controls: [
      { key: "glow", label: "Glow", type: "slider", default: 0.6 },
      { key: "walk", label: "Ant walk", type: "pulse", ease: 5 },
    ],
    action: { key: "walk", label: "Send the ant round" },
    // A tap sets an ant walking along the middle of the band. One lap brings
    // it back underneath where it started (the band has one side); a second
    // lap brings it back on top. Meanwhile the band twists a little and
    // untwists, and the ant rides the twisted surface. The band is built
    // twice: the glowing copy at rest and a copy that can twist (a morph),
    // swapped while the glow is off. The ant is built twice too, in front of
    // and behind everything, and shows the copy that draws right for the
    // face it walks on.
    drive(t, c, out) {
      const T = 5;
      const p = c.walk > 0 ? T * (1 - c.walk) : -1;
      const on = p >= 0;
      const swapped = on && p > 0.25 && p < T - 0.25;
      out.parts.band = { visible: swapped ? 0 : 1 };
      out.parts.twist = { visible: swapped ? 1 : 0 };
      const dim = on ? bump(p, 0, 0.22, T - 0.22, T) : 0;
      out.glow = [1, 1, 0.9, (0.2 + 1.2 * c.glow) * (1 - dim)];
      const m = on ? Math.sin(Math.PI * band(p, 0.3, T - 0.3)) ** 2 : 0;
      out.morph = [m];
      const x = band(p, 0.35, T - 0.45);
      const th = MOB_WALK(x - (0.5 * Math.sin(TAU * x)) / TAU);
      const f = mobiusFrame(th, m);
      const q = quatBasis(f.fwd, f.up, cross(f.fwd, f.up));
      const size = on ? bump(p, 0.18, 0.38, T - 0.42, T - 0.22) : 0;
      const front = dot(f.up, MOB_VIEW) > 0;
      // Tripod gait: legs 0, 3 and 4 swing together, 1, 2 and 5 against them.
      const stride = x * 90;
      const tokens = [];
      [MOB_ANT_FRONT, MOB_ANT_BACK].forEach((base, copy) => {
        const vis = size * ((copy === 0) === front ? 1 : 0);
        tokens.push({ base, quat: q, offset: sub(f.pos, base), visible: vis });
        ANT_HIPS.forEach((hip, i) => {
          const phase = i === 0 || i === 3 || i === 4 ? 0 : Math.PI;
          const swing = 0.38 * Math.sin(stride + phase) * (on ? 1 : 0);
          const at = add(base, hip);
          tokens.push({
            base: at,
            quat: quatMul(q, quatAxisAngle([0, 1, 0], swing)),
            offset: sub(add(f.pos, quatRotate(q, hip)), at),
            visible: vis,
          });
        });
      });
      out.tokens = tokens;
    },
    build(k, o) {
      const pal = PALETTES[o.colors] || PALETTES.sunset;
      const cyc = [pal[1], pal[2], pal[3], pal[4], pal[2], pal[1]];
      const W = MOB_W;
      k.fitMorphs = false; // the twist stays within the frame; keep the rest fit
      const color = (c) => {
        const e = Math.abs(c.v - 0.5) * 2;
        let col = ramp(cyc, c.u);
        if ((c.u * 40) % 1 < 0.08) col = shade(col, 0.85);
        col = lit(col, c.n, { amb: 0.66, dif: 0.42, spec: 0.3, two: true });
        if (e > 0.93) return keep(mix(col, "#fff6d8", 0.75));
        return col;
      };
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
        part: k.part("band"),
        flat: 0.12,
        even: true,
        kind: "pulse",
        params: (c) => [(c.u * 2) % 1, 0],
        color,
      });
      // The copy that twists (hidden at rest): each cross-section turns
      // about the middle line, one way on one side of the loop and the other
      // way opposite.
      k.add(band, {
        rot: [38, 0, -8],
        part: k.part("twist"),
        flat: 0.25,
        even: true,
        to: (c) => mobiusPoint(c.u * TAU, (c.v - 0.5) * 2 * W, MOB_TWIST(c.u * TAU)),
        color,
      });
      // The ant, twice: a body and six legs, each leg a token of its own.
      const antCol = (c) => keep(lit("#2a1810", c.n, { amb: 0.75, dif: 0.55, spec: 0.7, pow: 16 }));
      [MOB_ANT_FRONT, MOB_ANT_BACK].forEach((base, copy) => {
        const tok = copy * 7;
        const body = { kind: "token", params: [tok, 0], flat: 0.5, weight: 6, color: antCol };
        for (const [pos, r] of ANT_BODY)
          k.add(k.sphere(1), { ...body, pos: add(base, pos), scale: r });
        for (const side of [-1, 1])
          k.add(
            polyTube(
              [
                [0.1, 0.06, 0.012 * side],
                [0.13, 0.105, 0.035 * side],
                [0.165, 0.09, 0.055 * side],
              ].map((q) => add(base, mul(q, ANT))),
              0.0055 * ANT,
            ),
            { ...body, flat: 0.8 },
          );
        ANT_HIPS.forEach((hip, i) => {
          const side = Math.sign(hip[2]);
          const reach = [0.035, 0, -0.035][i >> 1];
          const leg = [
            [0, 0, 0],
            [reach * 0.6, 0.03, 0.045 * side],
            [reach * 1.7, -hip[1] / ANT, 0.085 * side],
          ].map((q) => add(add(base, hip), mul(q, ANT)));
          k.add(polyTube(leg, 0.0065 * ANT), {
            kind: "token",
            params: [tok + 1 + i, 0],
            flat: 0.8,
            weight: 6,
            color: antCol,
          });
        });
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
    action: { key: "surge", label: "Send water through" },
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
    controls: [{ key: "carve", label: "Carve", type: "pulse", ease: 3.9 }],
    action: { key: "carve", label: "Close and carve the holes" },
    // A tap plugs every hole with a solid cube (the smallest first), so the
    // sponge closes into a plain cube; then it is carved again as the
    // fractal is made: the six big plugs slide out of the faces, then the
    // next level down, then the smallest, each set fading as it leaves.
    drive(t, c, out) {
      const p = c.carve > 0 ? 3.9 * (1 - c.carve) : 99;
      // How far each level's plugs are out of their holes (1 = in the hole)
      // and how solid they look.
      const levels = [
        [0.15, 0.65, 1.05, 1.75],
        [0.05, 0.45, 1.95, 2.55],
        [0.0, 0.3, 2.75, 3.3],
      ].map(([a, b, d, e]) => {
        const come = ease(band(p, a, b));
        const go = ease(band(p, d, e));
        return { out: 1 - come + go, vis: band(come, 0, 0.6) * (1 - band(go, 0.55, 1)) };
      });
      out.morph = levels.map((l) => l.vis);
      CUBE_DIRS.forEach((d, f) => {
        out.parts["p1-" + f] = { offset: mul(d, 0.45 * levels[0].out) };
        out.parts["p2-" + f] = { offset: mul(d, 0.16 * levels[1].out) };
      });
    },
    build(k, o) {
      const L = o.level === "2" ? 2 : 3;
      const whole = mengerGrid(L);
      k.add(
        cellFaces(whole, () => true),
        { flat: 0.12, color: (c) => mengerLook(c.p, c.s.face, c.s.occl) },
      );
      // The plugs (clear at rest): big ones for level 1, one part per face
      // direction for levels 1 and 2, and the smallest only fade.
      const look = (c) => mengerLook(c.s.at, c.s.face, c.s.occl);
      for (let lv = 1; lv <= L; lv++) {
        const plugs = mengerPlugs(lv, whole);
        const side = 3 ** -lv;
        const fade = { kind: "fade", channel: lv - 1, params: [0, -0.99], flat: 0.12, color: look };
        if (lv === L) {
          k.add(plugFaces(plugs, side, false), fade);
          continue;
        }
        CUBE_DIRS.forEach((d, f) => {
          const part = k.part(`p${lv}-${f}`);
          const mine = plugs.filter((q) => q.f === f);
          k.add(plugFaces(mine, side, false), { ...fade, part });
          k.add(plugFaces(mine, side, true), { ...fade, part, weight: lv === 1 ? 1 : 0.6 });
        });
      }
    },
  },

  hypercube: {
    alive: true,
    controls: [
      { key: "turn", label: "4D turn", type: "slider", default: 0.85 },
      { key: "flip", label: "Turn inside out", type: "pulse", ease: 5 },
    ],
    action: { key: "flip", label: "Turn inside out" },
    // The sixteen corners are tokens placed each frame by a true turn in the
    // plane of X and W, seen in perspective from 4D; every edge is skinned
    // between its two corners, so it stays a straight line. At rest the
    // tesseract rocks gently in 4D. A tap turns it right round: half a turn
    // brings the pink inner cube out to be the outer one while the blue one
    // folds inside (it holds there a moment), and the second half turns it
    // back.
    drive(t, c, out) {
      const p = progress(c.flip);
      const a =
        Math.PI * (ease(band(p, 0.02, 0.44)) + ease(band(p, 0.58, 1))) +
        0.32 * c.turn * Math.sin(t * 1.1);
      out.tokens = TESS.map((v) => ({ offset: sub(tessShow(tessTurn(v, a)), tessShow(v)) }));
      out.body = { quat: quatAxisAngle(unit([0.25, 1, 0.12]), t * 0.28) };
    },
    build(k) {
      const outerCol = "#35c3f0";
      const innerCol = "#f72585";
      const colOf = (i) => (TESS[i][3] > 0 ? outerCol : innerCol);
      const glow = (col, n) => shade(col, 0.85 + 0.35 * Math.max(0, dot(n, LIGHT)));
      // Round splats: skinned splats keep their built orientation.
      for (const [i, j] of TESS_EDGES) {
        const w = TESS[i][3] + TESS[j][3];
        k.add(polyTube([tessShow(TESS[i]), tessShow(TESS[j])], w > 0 ? 0.026 : 0.022), {
          flat: 0.9,
          skin: (c) => [i, j, c.t],
          color: (c) => glow(mix(colOf(i), colOf(j), c.t), c.n),
        });
      }
      TESS.forEach((v, i) => {
        const col = colOf(i);
        k.add(k.sphere(v[3] > 0 ? 0.065 : 0.058), {
          pos: tessShow(v),
          weight: 1.2,
          flat: 0.5,
          kind: "token",
          params: [i, 0],
          pattern: false,
          color: (c) => keep(mix(col, "#ffffff", 0.45 + 0.4 * Math.max(0, dot(c.n, HALF)))),
        });
      });
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
    controls: [
      { key: "glow", label: "Glow", type: "slider", default: 0.6 },
      { key: "twang", label: "Twang", type: "pulse", ease: 4.3 },
    ],
    action: { key: "twang", label: "Pull and let go" },
    // A tap pulls the knot into a looser, swirled shape (its lobes stretch
    // out and turn), then lets go: it springs back past its rest shape into
    // a tight one and wobbles to a stop, like a stretched spring. The knot is
    // built twice: the glowing tube at rest and a copy that can change shape
    // (a morph), swapped while the glow is off.
    drive(t, c, out) {
      const T = 4.3;
      const p = c.twang > 0 ? T * (1 - c.twang) : -1;
      const on = p >= 0;
      const swapped = on && p > 0.2 && p < T - 0.25;
      out.parts.knot = { visible: swapped ? 0 : 1 };
      out.parts.bend = { visible: swapped ? 1 : 0 };
      const dim = on ? bump(p, 0, 0.18, T - 0.25, T) : 0;
      out.glow = [1, 1, 0.92, (0.2 + 1.3 * c.glow) * (1 - dim)];
      const pull = ease(band(p, 0.22, 0.85));
      const s = Math.max(0, p - 0.85);
      const ring = Math.cos((TAU * s) / 1.05) * Math.exp(-s / 0.8);
      out.morph = [on ? (p < 0.85 ? pull : ring * (1 - band(p, 3.4, 3.95))) : 0];
    },
    build(k, o) {
      const [p, q] = o.knot.split("-").map(Number);
      const pal = PALETTES[o.colors] || PALETTES.sunset;
      const cyc = [pal[1], pal[2], pal[3], pal[4], pal[3], pal[2], pal[1]];
      const r = p * q > 12 ? 0.26 : 0.36;
      const N = 1600;
      const tube = polyTube(torusKnot(p, q, N), r, { closed: true });
      const look = {
        flat: 0.25,
        interior: 0.06,
        core: pal[0],
        color: (c) => {
          const col = ramp(cyc, c.t);
          const stripe = (c.t * 90) % 1 < 0.1 ? 0.9 : 1;
          return shade(lit(col, c.n, { amb: 0.6, dif: 0.48, spec: 0.5, pow: 34 }), stripe);
        },
      };
      k.add(tube, {
        ...look,
        part: k.part("knot"),
        kind: "pulse",
        params: (c) => [(c.t * 3) % 1, 0],
      });
      // The knot pulled loose: lobes out further, each turned a little.
      const rest = (a) => {
        const rr = 2 + Math.cos(q * a);
        return [rr * Math.cos(p * a), rr * Math.sin(p * a), -Math.sin(q * a)];
      };
      const loose = (a) => {
        const rr = 2 + 1.3 * Math.cos(q * a);
        const b = p * a + 0.22 * Math.sin(q * a);
        return [rr * Math.cos(b), rr * Math.sin(b), -1.3 * Math.sin(q * a)];
      };
      k.fitMorphs = false; // the pull stays near the frame; keep the rest fit
      k.add(tube, {
        ...look,
        part: k.part("bend"),
        flat: 0.35,
        // Each splat keeps its place round the tube: its offset from the
        // middle line, turned square to the new line.
        to: (c) => {
          const a = (c.s.at / N) * TAU;
          const off = sub(c.p, rest(a));
          const mid = loose(a);
          const tan = unit(sub(loose(a + 1e-3), loose(a - 1e-3)));
          const side = sub(off, mul(tan, dot(off, tan)));
          return add(mid, mul(unit(side), len(off)));
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
    action: { key: "open", label: "Explode" },
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
    action: { key: "open", label: "Explode" },
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
