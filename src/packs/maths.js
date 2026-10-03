// Maths & art: curves, surfaces, solids and fractals, coloured with soft
// gradients. Strange attractors glow along their path, the tesseract turns
// itself inside out, and the solids and the Sierpinski tetrahedron come
// apart when tapped. Loaded on demand.

import { readCurve, readSurface, asciiEquation, EquationError } from "../equation.js";
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
import { evenBox, evenCylinder } from "./even.js";

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
    dims: 2, // two numbers per splat: under even: true, along and around
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
  // For even: true (lane Fidelity B): a fan of triangles from the centre;
  // a runs round the fan by area and b out from the centre.
  const m = pts.length;
  const ctr = [0, 1, 2].map((i) => pts.reduce((s, p) => s + p[i], 0) / m);
  const fan = [];
  let fanTotal = 0;
  for (let i = 0; i < m; i++) {
    const p0 = pts[i];
    const p1 = pts[(i + 1) % m];
    fanTotal += 0.5 * len(cross(sub(p0, ctr), sub(p1, ctr)));
    fan.push({ p0, p1, cum: fanTotal });
  }
  const edgeAt = (p) => {
    let edge = Infinity;
    for (let i = 0; i < m; i++) {
      const e0 = pts[i];
      const e1 = pts[(i + 1) % m];
      const d = sub(e1, e0);
      const q = clamp(dot(sub(p, e0), d) / dot(d, d), 0, 1);
      edge = Math.min(edge, len(sub(p, add(e0, mul(d, q)))));
    }
    return edge;
  };
  return {
    area: total,
    thick: 0.05,
    sampleEven(ea, eb) {
      const x = Math.min(ea, 1 - 1e-9) * fanTotal;
      let t = fan[fan.length - 1];
      let start = 0;
      for (const tr of fan) {
        if (x < tr.cum) {
          t = tr;
          break;
        }
        start = tr.cum;
      }
      const g = clamp((x - start) / (t.cum - start || 1), 0, 1);
      const r = Math.sqrt(eb);
      const rim = add(t.p0, mul(sub(t.p1, t.p0), g));
      const p = add(ctr, mul(sub(rim, ctr), r));
      return { p, n, u: r, v: g, edge: edgeAt(p) };
    },
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
          // Which of the face's four sides is a real edge (the surface turns
          // there) rather than a seam with the next cell's face: bits for
          // -u, +u, -v, +v.
          const ua = d[0] ? 1 : 0;
          const va = d[2] ? 1 : 2;
          let rim = 0;
          [
            [ua, -1],
            [ua, 1],
            [va, -1],
            [va, 1],
          ].forEach(([ax, sgn], b) => {
            const e = [0, 0, 0];
            e[ax] = sgn;
            const on = at(i + e[0], j + e[1], k + e[2]);
            if (!on || at(i + e[0] + d[0], j + e[1] + d[1], k + e[2] + d[2])) rim |= 1 << b;
          });
          faces.push(i, j, k, f, occl, rim);
        });
      }
  const count = faces.length / 6;
  const cell = 1 / n;
  const at3 = (fi, u, v) => {
    const q = fi * 6;
    const f = faces[q + 3];
    const d = CUBE_DIRS[f];
    const p = [0, 1, 2].map((a) => (faces[q + a] + 0.5 + d[a] * 0.5) * cell - 0.5);
    p[d[0] ? 1 : 0] += (u - 0.5) * cell;
    p[d[2] ? 1 : 2] += (v - 0.5) * cell;
    // How far (in cells) to the nearest real edge of the surface.
    const rim = faces[q + 5];
    const edge = Math.min(rim & 1 ? u : 1, rim & 2 ? 1 - u : 1, rim & 4 ? v : 1, rim & 8 ? 1 - v : 1); // prettier-ignore
    return { p, n: d, u, v, face: f, occl: faces[q + 4], edge };
  };
  return {
    area: count * cell * cell,
    thick: 0.2,
    faces: count,
    sample(rand) {
      const fi = Math.floor(rand() * count);
      return at3(fi, rand(), rand());
    },
    // For even: true (lane Sharpness B): a runs through the faces laid end
    // to end (its fraction within a face is u) and b is v, so every face
    // gets its share of splats spread evenly instead of in random clumps.
    sampleEven(a, b) {
      const x = Math.min(a, 1 - 1e-9) * count;
      const fi = Math.floor(x);
      return at3(fi, x - fi, b);
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
const gyroidG = (x, y, z) =>
  Math.sin(x) * Math.cos(y) + Math.sin(y) * Math.cos(z) + Math.sin(z) * Math.cos(x);
const gyroidGrad = (x, y, z) => [
  Math.cos(x) * Math.cos(y) - Math.sin(z) * Math.sin(x),
  -Math.sin(x) * Math.sin(y) + Math.cos(y) * Math.cos(z),
  -Math.sin(y) * Math.sin(z) + Math.cos(z) * Math.cos(x),
];
function gyroidShape(scale, clip) {
  const g = gyroidG;
  const grad = gyroidGrad;
  const inside =
    clip === "sphere"
      ? (p) => len(p) < 1
      : (p) => Math.max(Math.abs(p[0]), Math.abs(p[1]), Math.abs(p[2])) < 0.85;
  const vol = clip === "sphere" ? (4 / 3) * Math.PI : 1.7 ** 3;
  // Area per volume of this gyroid is about 3.09 / (2 pi) per unit of scale.
  const area = (3.09 / TAU) * scale * vol * 2;
  // Under even: true the first four numbers come from an even sequence
  // (dims: 4): a start point spread evenly through the clip (cube or ball)
  // and the side, so the projected points cover the surface evenly instead
  // of in random clumps (lane Sharpness B).
  const start = (a, b, c) => {
    if (clip !== "sphere") return [(a * 2 - 1) * 0.85, (b * 2 - 1) * 0.85, (c * 2 - 1) * 0.85];
    const r = Math.cbrt(a) * 0.99;
    const z = b * 2 - 1;
    const s = Math.sqrt(1 - z * z);
    return [r * s * Math.cos(c * TAU), r * z, r * s * Math.sin(c * TAU)];
  };
  return {
    area,
    thick: 0.05,
    dims: 4,
    sample(rand) {
      for (let tries = 0; tries < 40; tries++) {
        let p = start(rand(), rand(), rand());
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
        return { p: add(p, mul(nn, 0.014)), n: nn, u: 0, v: 0, side, at: p };
      }
      return { p: [0, 0, 0], n: [0, 1, 0], u: 0, v: 0, side: 1, at: [0, 0, 0] };
    },
  };
}

// Where a point p0 of the gyroid (g = 0) goes on the level set g = level,
// and the unit gradient there. Near the clipping cube's faces (or ball) it
// only slides along them, so the outline stays crisp.
function gyroidLevel(p0, level, scale, clip) {
  let p = p0.slice();
  let gr = [0, 1, 0];
  for (let it = 0; it < 5; it++) {
    const sx = Math.sin(p[0] * scale);
    const cx = Math.cos(p[0] * scale);
    const sy = Math.sin(p[1] * scale);
    const cy = Math.cos(p[1] * scale);
    const sz = Math.sin(p[2] * scale);
    const cz = Math.cos(p[2] * scale);
    gr = [cx * cy - sz * sx, -sx * sy + cy * cz, -sy * sz + cz * cx];
    if (it === 4) break;
    const v = sx * cy + sy * cz + sz * cx - level;
    p = sub(p, mul(gr, v / Math.max(dot(gr, gr), 0.3) / scale));
  }
  let d = sub(p, p0);
  if (clip === "sphere") {
    const r0 = len(p0) || 1;
    const rn = mul(p0, 1 / r0);
    d = sub(d, mul(rn, dot(d, rn) * smoothstep(0.88, 0.98, r0)));
  } else d = d.map((v, i) => v * (1 - smoothstep(0.76, 0.84, Math.abs(p0[i]))));
  const dl = len(d);
  if (dl > 0.2) d = mul(d, 0.2 / dl);
  return { p: add(p0, d), n: unit(gr) };
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
  // The splats come in sevens, turned a seventh of a turn apart (the bulb's
  // own symmetry), so a slice turned by a seventh looks exactly as before.
  let copy = 7;
  let last = null;
  return {
    area: total,
    thick: 0.05,
    sample(rand) {
      if (copy < 7) {
        const a = copy++ * BULB_STEP;
        return { ...last, p: rotY(last.p, a), n: rotY(last.n, a) };
      }
      copy = 1;
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
      last = { p, n: h.n, u: 0, v: 0, trap: h.trap, steps: h.steps, r: h.r };
      return last;
    },
  };
}

// The Mandelbulb's discs: BULB_BANDS horizontal slices between -BULB_Y and
// BULB_Y, each turning BULB_STEP (a seventh of a turn, the bulb's symmetry)
// with a little overshoot, like a dial clicking round.
const BULB_BANDS = 7;
const BULB_Y = 1.15;
const BULB_STEP = TAU / 7;
const bulbBand = (y) =>
  clamp(Math.floor(((y + BULB_Y) / (2 * BULB_Y)) * BULB_BANDS), 0, BULB_BANDS - 1);
const click = (x) => {
  if (x <= 0) return 0;
  if (x >= 1) return 1;
  const c1 = 1.4;
  return 1 + (c1 + 1) * (x - 1) ** 3 + c1 * (x - 1) ** 2;
};

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
  [
    [-0.075, 0.048, 0],
    [0.062, 0.04, 0.044],
  ],
  [
    [-0.01, 0.038, 0],
    [0.013, 0.012, 0.012],
  ],
  [
    [0.025, 0.042, 0],
    [0.04, 0.024, 0.024],
  ],
  [
    [0.083, 0.048, 0],
    [0.031, 0.027, 0.029],
  ],
].map(([c, r]) => [mul(c, ANT), mul(r, ANT)]);
const ANT_HIPS = [0.042, 0.042, 0.022, 0.022, 0.002, 0.002].map((x, i) =>
  mul([x, 0.034, i % 2 ? 0.016 : -0.016], ANT),
);
// The two ant copies are built here: in front of the band and behind it
// (for the draw order), inside the band's own reach.
const MOB_ANT_FRONT = mul(MOB_VIEW, 1.15);
const MOB_ANT_BACK = mul(MOB_VIEW, -1.15);

// The riders that can go round the Möbius strip, each facing +X and standing
// on the origin (its up is +Y, its side +Z). A rider is a list of pieces,
// each one token: `hub` is where it turns, `roll` a wheel's (or the ball's)
// radius, so it turns by the distance over that, and `swing` an ant leg's
// phase. build(k, at, token, o) adds its shapes at `at` (its hub); o is the
// toy's options.
const RIDER_TOKENS = 8;
const CAR = 1.6; // the car's size (its numbers are for a car 0.34 long)
const BIKE = 1.5; // the bike's size (its numbers are for a bike 0.3 tall)
const shiny =
  (col, spec = 0.6) =>
  (c) =>
    keep(lit(col, c.n, { amb: 0.66, dif: 0.45, spec, pow: 24 }));
// A wheel in the XY plane: a tyre, a light hub, and marks that show it turn.
function wheelShapes(k, at, token, R, { tyre = 0.3, spokes = 0, rim = "#c9ced6" } = {}) {
  k.add(k.torus(R * (1 - tyre / 2), R * (tyre / 2)), {
    ...token,
    pos: at,
    rot: [90, 0, 0],
    flat: 0.5,
    color: (c) => {
      // A white mark on the sidewall shows the wheel turning.
      const a = Math.atan2(c.lp[2], c.lp[0]);
      const mark = Math.abs(Math.sin(a * 1.5)) < 0.18 && Math.abs(c.ln[1]) > 0.5;
      return keep(lit(mark ? "#f4f4f4" : "#1c1c20", c.n, { amb: 0.7, dif: 0.4, spec: 0.35 }));
    },
  });
  if (spokes) {
    for (let i = 0; i < spokes; i++) {
      const a = (i / spokes) * TAU;
      const d = [Math.cos(a), Math.sin(a), 0];
      k.add(polyTube([at, add(at, mul(d, R * (1 - tyre)))], R * 0.045), {
        ...token,
        flat: 0.8,
        color: shiny(rim, 0.3),
      });
    }
    k.add(k.sphere(R * 0.14), { ...token, pos: at, color: shiny(rim) });
  } else {
    for (const side of [-1, 1])
      k.add(k.disc(R * (1 - tyre) * 1.02), {
        ...token,
        pos: add(at, [0, 0, side * R * tyre * 0.4]),
        rot: [90, 0, 0],
        flat: 0.4,
        color: (c) => {
          const a = Math.atan2(c.lp[2], c.lp[0]);
          const spoke = Math.cos(a * 5) > 0.55;
          return keep(lit(spoke ? rim : "#5a606b", c.n, { amb: 0.7, dif: 0.4, spec: 0.5 }));
        },
      });
  }
}
const RIDERS = {
  // An open-wheel racing car with a white stripe and four spinning wheels,
  // blue (red on the ocean colours, so it always stands out).
  car: [
    {
      hub: [0, 0, 0],
      build(k, at, token, o) {
        const S = CAR;
        const paint = o?.colors === "ocean" ? "#d62424" : "#1f5fe0";
        const body = (c) => {
          const stripe = Math.abs(c.p[2] - at[2]) < 0.012 * S && c.n[1] > 0.3;
          return keep(lit(stripe ? "#f7f7f2" : paint, c.n, { amb: 0.62, dif: 0.45, spec: 0.7, pow: 22 })); // prettier-ignore
        };
        const dark = shiny("#23262e");
        const P = (x, y, z) => add(at, [x * S, y * S, z * S]);
        const add1 = (shape, pos, color, rot) => k.add(shape, { ...token, pos, rot, color });
        add1(k.roundedBox(0.25 * S, 0.05 * S, 0.1 * S, 5), P(-0.01, 0.07, 0), body);
        add1(k.cone(0.032 * S, 0.012 * S, 0.1 * S), P(0.16, 0.062, 0), body, [0, 0, -90]);
        for (const side of [-1, 1])
          add1(k.roundedBox(0.1 * S, 0.035 * S, 0.03 * S, 4), P(-0.03, 0.065, side * 0.062), body);
        // The driver's helmet in the cockpit.
        add1(k.sphere(0.03 * S), P(-0.015, 0.108, 0), shiny("#f2c230", 0.8));
        add1(k.box(0.012 * S, 0.012 * S, 0.05 * S), P(0.008, 0.11, 0), dark);
        // Wings, front and back, on struts.
        add1(k.box(0.045 * S, 0.008 * S, 0.21 * S), P(0.2, 0.03, 0), dark);
        add1(k.box(0.05 * S, 0.012 * S, 0.21 * S), P(-0.155, 0.145, 0), body);
        for (const side of [-1, 1])
          add1(k.box(0.012 * S, 0.05 * S, 0.01 * S), P(-0.15, 0.115, side * 0.05), dark);
      },
    },
    ...[
      [0.12, 0.092],
      [0.12, -0.092],
      [-0.1, 0.095],
      [-0.1, -0.095],
    ].map(([x, z], i) => {
      const r = (i < 2 ? 0.042 : 0.048) * CAR;
      return {
        hub: [x * CAR, r, z * CAR],
        roll: r,
        build(k, at, token) {
          wheelShapes(k, at, token, r, { tyre: 0.42 });
        },
      };
    }),
  ],
  // A beach ball: coloured gores round its own up axis, so it shows it roll.
  ball: [
    {
      hub: [0, 0.16, 0],
      roll: 0.16,
      build(k, at, token) {
        const gores = ["#e63946", "#f8f8f2", "#1d6fd8", "#ffd23f", "#f8f8f2", "#2bb673"];
        k.add(k.sphere(0.16), {
          ...token,
          pos: at,
          flat: 0.3,
          even: true,
          color: (c) => {
            const d = c.ln;
            if (Math.abs(d[1]) > 0.93) return keep(lit("#f8f8f2", c.n, { spec: 0.7 }));
            const g = Math.floor(((Math.atan2(d[2], d[0]) / TAU + 1) % 1) * 6);
            return keep(lit(gores[g], c.n, { amb: 0.62, dif: 0.45, spec: 0.7, pow: 20 }));
          },
        });
      },
    },
  ],
  // A yellow duck riding a bicycle: the frame and the duck, two wheels with
  // spokes, and the pedals.
  bike: [
    {
      hub: [0, 0, 0],
      build(k, at, token) {
        const S = BIKE;
        const P = (x, y, z = 0) => add(at, [x * S, y * S, z * S]);
        const frame = shiny("#1d9bd1", 0.5);
        const tube = (pts, r = 0.007) =>
          k.add(polyTube(pts, r * S), { ...token, flat: 0.8, color: frame });
        const bb = P(0, 0.065);
        const seat = P(-0.035, 0.165);
        const head = P(0.085, 0.16);
        const rear = P(-0.105, 0.065);
        const front = P(0.115, 0.065);
        tube([bb, seat]);
        tube([seat, head]);
        tube([bb, P(0.09, 0.14)]);
        for (const side of [-1, 1]) {
          tube([bb, add(rear, [0, 0, side * 0.012 * S])], 0.005);
          tube([seat, add(rear, [0, 0, side * 0.012 * S])], 0.005);
          tube([head, add(front, [0, 0, side * 0.012 * S])], 0.006);
        }
        tube([head, P(0.08, 0.2)], 0.007);
        tube([P(0.07, 0.2, -0.055), P(0.07, 0.2, 0.055)], 0.006);
        const put = (shape, pos, color, rot) => k.add(shape, { ...token, pos, rot, color });
        put(k.ellipsoid(0.03 * S, 0.01 * S, 0.018 * S), P(-0.04, 0.172), shiny("#23262e"));
        // The duck: a round body on the saddle, a tail, a head, a beak and eyes.
        const duck = shiny("#ffd23f", 0.4);
        put(k.ellipsoid(0.075 * S, 0.058 * S, 0.058 * S), P(-0.03, 0.225), duck);
        put(k.ellipsoid(0.03 * S, 0.02 * S, 0.05 * S), P(-0.1, 0.24), duck, [0, 0, 30]);
        put(k.sphere(0.042 * S), P(0.035, 0.29), duck);
        put(k.ellipsoid(0.03 * S, 0.011 * S, 0.022 * S), P(0.078, 0.283), shiny("#ff8c1a"));
        for (const side of [-1, 1])
          k.add(k.sphere(0.008 * S), { ...token, pos: P(0.06, 0.305, side * 0.027), weight: 12, color: shiny("#141414", 0.9) }); // prettier-ignore
        // Its wings reach to the handlebars.
        for (const side of [-1, 1])
          k.add(polyTube([P(-0.01, 0.235, side * 0.05), P(0.04, 0.215, side * 0.058), P(0.068, 0.203, side * 0.05)], 0.012 * S), { ...token, flat: 0.6, color: duck }); // prettier-ignore
      },
    },
    ...[-0.105, 0.115].map((x) => ({
      hub: [x * BIKE, 0.065 * BIKE, 0],
      roll: 0.065 * BIKE,
      build(k, at, token) {
        wheelShapes(k, at, token, 0.065 * BIKE, { tyre: 0.16, spokes: 8 });
      },
    })),
    {
      // The pedals turn with the back wheel (a gear of about 1 to 1.6).
      hub: [0, 0.065 * BIKE, 0],
      roll: 0.065 * 1.6 * BIKE,
      build(k, at, token) {
        const S = BIKE;
        const dark = shiny("#30343c", 0.5);
        for (const side of [-1, 1]) {
          const end = add(at, [side * 0.035 * S, 0, side * 0.03 * S]);
          k.add(polyTube([add(at, [0, 0, side * 0.03 * S]), end], 0.005 * S), { ...token, flat: 0.8, color: dark }); // prettier-ignore
          k.add(k.box(0.024 * S, 0.006 * S, 0.02 * S), { ...token, pos: add(end, [0, 0, side * 0.012 * S]), color: dark }); // prettier-ignore
        }
        k.add(k.torus(0.022 * S, 0.004 * S), { ...token, pos: add(at, [0, 0, 0.02 * S]), rot: [90, 0, 0], color: dark }); // prettier-ignore
      },
    },
  ],
  // The ant: a body and six legs, each leg a token of its own.
  ant: [
    {
      hub: [0, 0, 0],
      build(k, at, token) {
        const antCol = (c) =>
          keep(lit("#2a1810", c.n, { amb: 0.75, dif: 0.55, spec: 0.7, pow: 16 }));
        const body = { ...token, flat: 0.5, color: antCol };
        for (const [pos, r] of ANT_BODY)
          k.add(k.sphere(1), { ...body, pos: add(at, pos), scale: r });
        for (const side of [-1, 1])
          k.add(
            polyTube(
              [
                [0.1, 0.06, 0.012 * side],
                [0.13, 0.105, 0.035 * side],
                [0.165, 0.09, 0.055 * side],
              ].map((q) => add(at, mul(q, ANT))),
              0.0055 * ANT,
            ),
            { ...body, flat: 0.8 },
          );
      },
    },
    ...ANT_HIPS.map((hip, i) => ({
      hub: hip,
      // Legs 0, 3 and 4 swing together, 1, 2 and 5 against them.
      swing: i === 0 || i === 3 || i === 4 ? 0 : Math.PI,
      build(k, at, token) {
        const side = Math.sign(hip[2]);
        const reach = [0.035, 0, -0.035][i >> 1];
        const leg = [
          [0, 0, 0],
          [reach * 0.6, 0.03, 0.045 * side],
          [reach * 1.7, -hip[1] / ANT, 0.085 * side],
        ].map((q) => add(at, mul(q, ANT)));
        k.add(polyTube(leg, 0.0065 * ANT), {
          ...token,
          flat: 0.8,
          color: (c) => keep(lit("#2a1810", c.n, { amb: 0.75, dif: 0.55, spec: 0.7, pow: 16 })),
        });
      },
    })),
  ],
};

// The seashell's mouth (its last cross-section is a circle in the plane
// z = 0 before the shell is turned 40 degrees about Y): centre, the axis it
// opens along, and radius. And when each of its three ripples sets off.
const SHELL_MOUTH = (() => {
  const q = quatEuler(0, 40, 0);
  const e = Math.E;
  return { c: quatRotate(q, [1 - e, 1 - e * e, 0]), n: quatRotate(q, [0, 0, 1]), r: e - 1 };
})();
const SHELL_WAVES = [0.7, 1.8, 2.9];

// ---- Recipes ------------------------------------------------------------------------

// A surface's even placement with each point nudged a little within its
// cell (a fixed hash, so it rebuilds the same): see-through layers placed
// exactly evenly beat against each other as a fine hatching; nudged, they
// stay even without the pattern.
function nudgedEven(shape, amount) {
  if (!shape.sampleEven) return shape;
  const hash = (x, y) => {
    const h = Math.sin(x * 12.9898 + y * 78.233) * 43758.5453;
    return h - Math.floor(h);
  };
  const wrap = (v) => v - Math.floor(v);
  return {
    ...shape,
    sampleEven(a, b) {
      const da = (hash(a, b) - 0.5) * amount;
      const db = (hash(b + 0.37, a) - 0.5) * amount;
      return shape.sampleEven(wrap(a + da), wrap(b + db));
    },
  };
}

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
        // Small splats drawn out along the path: each strand a clean line
        // (lane Sharpness B; opaque, even ones broke it into dashes).
        size: 0.7,
        flat: 0.6,
        stretch: 3,
        kind: "pulse",
        params: (c) => [(c.t * 6) % 1, 0],
        // The tube is only a few pixels wide, so light and shade round it
        // read as grain: a gentle shade only (lane Sharpness B).
        color: (c) => {
          const col = ramp(stops, c.t);
          return shade(col, 0.92 + 0.12 * Math.max(0, dot(c.n, LIGHT)));
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
      {
        key: "rider",
        label: "Rider",
        type: "select",
        default: "car",
        choices: [
          { id: "car", label: "Race car" },
          { id: "ball", label: "Beach ball" },
          { id: "bike", label: "Duck on a bike" },
          { id: "ant", label: "Ant" },
        ],
      },
    ],
    controls: [
      { key: "glow", label: "Glow", type: "slider", default: 0.6 },
      { key: "walk", label: "Ride", type: "pulse", ease: 5 },
    ],
    action: { key: "walk", label: "Send it round" },
    // A tap sends the rider (a race car, a beach ball, a duck on a bike or
    // an ant) along the middle of the band. One lap brings it back
    // underneath where it started (the band has one side); a second lap
    // brings it back on top. Wheels and the ball roll with the distance. Meanwhile the band twists a little and
    // untwists, and the rider rides the twisted surface. The band is built
    // twice: the glowing copy at rest and a copy that can twist (a morph),
    // swapped while the glow is off. The rider is built twice too, in front
    // of and behind everything, and shows the copy that draws right for the
    // face it is on.
    drive(t, c, out, info) {
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
      // Wheels (and the ball) turn by the distance over their radius; the
      // ant's legs swing in a tripod gait.
      const dist = th - MOB_START;
      const stride = x * 90;
      const pieces = info?.data?.rider || [];
      const tokens = [];
      [MOB_ANT_FRONT, MOB_ANT_BACK].forEach((base, copy) => {
        const vis = size * ((copy === 0) === front ? 1 : 0);
        pieces.forEach((pc, i) => {
          let turn = [0, 0, 0, 1];
          if (pc.roll) turn = quatAxisAngle([0, 0, 1], -dist / pc.roll);
          if (pc.swing !== undefined)
            turn = quatAxisAngle([0, 1, 0], 0.38 * Math.sin(stride + pc.swing) * (on ? 1 : 0));
          const at = add(base, pc.hub);
          tokens[copy * RIDER_TOKENS + i] = {
            base: at,
            quat: quatMul(q, turn),
            offset: sub(add(f.pos, quatRotate(q, pc.hub)), at),
            visible: vis,
          };
        });
      });
      out.tokens = tokens;
      // Sound B: each rider's own sound as it sets off round the band.
      cuesAt(c, p, MOB_RIDER_SOUNDS[info?.data?.riderKind] || [], out);
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
      // The rider, twice: each piece (body, wheels, legs) a token of its own.
      const rider = RIDERS[o.rider] || RIDERS.car;
      k.data = {
        rider: rider.map(({ hub, roll, swing }) => ({ hub, roll, swing })),
        riderKind: RIDERS[o.rider] ? o.rider : "car",
      };
      [MOB_ANT_FRONT, MOB_ANT_BACK].forEach((base, copy) => {
        rider.forEach((pc, i) => {
          // Left out of the fit: the band keeps its size whatever rides it.
          const token = { kind: "token", params: [copy * RIDER_TOKENS + i, 0], weight: 6, fit: false }; // prettier-ignore
          pc.build(k, add(base, pc.hub), token, o);
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
    // The glass is see-through (opacity 0.28, under the pick's 0.3), so a
    // tap on it found nothing; pick it at a lower alpha (lane Fix5).
    pickAlpha: 0.1,
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
      k.add(nudgedEven(k.param(f, { grid: 120 }), 0.0016), {
        even: true,
        jitter: 0.015,
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
        {
          even: true,
          opacity: 1,
          jitter: 0.01,
          size: 1.08,
          flat: 0.12,
          color: (c) => {
            const col = mengerLook(c.p, c.s.face, c.s.occl);
            // Smaller splats along the holes' edges keep them crisp.
            return c.s.edge < 0.18 ? { c: col, size: 0.72 } : col;
          },
        },
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
        // The inside is the tube's own colour, darker (a dark core would
        // show through the thinner half-budget copies as speckle).
        core: (c) => shade(ramp(cyc, c.t), 0.85),
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
        // A little larger: stretched out, the tube's skin would open gaps.
        size: 1.25,
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
    controls: [{ key: "breathe", label: "Breathe", type: "pulse", ease: 3.8 }],
    action: { key: "breathe", label: "Breathe in and out" },
    // A tap makes the sponge breathe: the surface slides along itself to
    // a shifted level of the same equation, so the blue channels swell as
    // the orange ones narrow, then the other way, and it settles back.
    drive(t, c, out) {
      const x = band(progress(c.breathe), 0.02, 0.96);
      const v = Math.sin(TAU * x) * Math.pow(Math.sin(Math.PI * x), 0.6);
      // The blue side's swell is a little smaller: stretched further, the
      // faces start to show through each other.
      out.morph = [v < 0 ? 0.75 * v : v];
    },
    build(k, o) {
      const scale = 4.6;
      k.fitMorphs = false; // the breath stays inside the clip; keep the rest fit
      // Slightly large splats, so each face covers the other (the far face
      // showed through the gaps as specks of the other colour).
      k.add(gyroidShape(scale, o.clip), {
        even: true,
        opacity: 1,
        jitter: 0.01,
        flat: 0.08,
        size: 1.5,
        to: (c) => {
          const q = gyroidLevel(c.s.at, 0.85, scale, o.clip);
          return add(q.p, mul(q.n, c.s.side * 0.014));
        },
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
    controls: [{ key: "twist", label: "Turn", type: "pulse", ease: 4.2 }],
    action: { key: "twist", label: "Turn the discs" },
    // A tap turns the bulb's discs like the dials of a combination lock:
    // stacked horizontal slices click round, neighbours in opposite
    // directions, top to bottom, then back the other way, bottom to top.
    // The power-8 bulb has seven-fold symmetry about its axis (and its
    // splats are laid down seven-fold too), so each slice turns one
    // seventh of a turn and lands on the same picture; it then snaps back
    // to its built pose unseen (splats sort in their built pose, so no
    // slice ever turns much past that).
    drive(t, c, out) {
      const s = c.twist > 0 ? 4.2 * (1 - c.twist) : -1;
      for (let i = 0; i < BULB_BANDS; i++) {
        const dir = i % 2 ? -1 : 1;
        let a = 0;
        if (s >= 0 && s < 1.9) a = dir * click((s - 0.1 - 0.1 * i) / 0.95);
        else if (s >= 1.9) a = -dir * click((s - 2.05 - 0.1 * (BULB_BANDS - 1 - i)) / 0.95);
        out.parts["b" + i] = { angle: a * BULB_STEP };
      }
    },
    build(k) {
      const bands = [];
      for (let i = 0; i < BULB_BANDS; i++) bands.push(k.part("b" + i));
      k.add(mandelbulbShape(), {
        part: (c) => bands[bulbBand(c.p[1])],
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
          even: true,
          opacity: 1,
          jitter: 0.01,
          part,
          flat: 0.12,
          weight: 1.2,
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
    controls: [{ key: "listen", label: "Listen", type: "pulse", ease: 4.5 }],
    action: { key: "listen", label: "Hear the sea" },
    // Hearing the sea in a shell: at a tap, three soft swells of light run
    // down the spiral from the tip to the opening, and as each one reaches
    // it a ripple rolls out of the mouth, widening and fading like a wave.
    drive(t, c, out) {
      const p = c.listen > 0 ? 4.5 * (1 - c.listen) : -1;
      const on = p >= 0;
      // The swells of light: each runs from the tip (0) to the mouth (1).
      const swell = (p % 1.1) / 0.85;
      out.morph = [on && p < 3.3 ? -0.25 + 1.45 * swell : -1];
      out.glow = [0.35, 0.75, 0.92, on ? 0.36 * (1 - band(p, 3.1, 3.4)) : 0];
      SHELL_WAVES.forEach((start, i) => {
        const x = on ? (p - start) / 1.45 : -1;
        const live = x > 0 && x < 1;
        const e = 1 - Math.pow(1 - clamp01(x), 1.6);
        out.parts["wave" + i] = {
          visible: live ? 1 : 0,
          offset: mul(SHELL_MOUTH.n, 2.6 * e),
          scale: 1.25 + 0.95 * e,
        };
        // Channel 1 + i: 1 is clear, 0 is solid.
        out.morph[1 + i] = live ? 1 - band(x, 0, 0.1) * (1 - ease(band(x, 0.5, 0.95))) : 1;
      });
    },
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
        even: true,
        opacity: 1,
        jitter: 0.015,
        rot: [0, 40, 0],
        flat: 0.15,
        // A swell of light passes as channel 0 runs from the tip (u = 0) to
        // the mouth (u = 1).
        kind: "band",
        params: (c) => [c.u, 0.09],
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
      // The ripples (clear at rest): foamy rings the size of the mouth, in
      // its plane, that roll out along its axis, widen and fade.
      const { c: mid, n, r } = SHELL_MOUTH;
      const e1 = unit(cross(n, [0, 1, 0]));
      const e2 = cross(n, e1);
      SHELL_WAVES.forEach((_, i) => {
        const part = k.part("wave" + i, { pivot: mid });
        k.cloud({ share: 0.025, size: 1, pattern: false }, (rand) => {
          // A crest and a fainter ripple just behind it.
          const back = rand() < 0.35;
          const a = rand() * TAU;
          const wob = Math.sin(a * 5 + i * 2);
          // Built a little inside the mouth (hidden pieces count in the fit)
          // and grown by the part's scale.
          const rr = 0.8 * r * (back ? 0.86 : 1) * (0.97 + 0.02 * wob) + (rand() - 0.5) * 0.05;
          const lift = -0.1 - (back ? 0.25 : 0) - rand() * 0.04 + 0.03 * wob;
          const q = add(mid, add(add(mul(e1, rr * Math.cos(a)), mul(e2, rr * Math.sin(a))), mul(n, lift))); // prettier-ignore
          const foam = rand();
          return {
            p: q,
            color: mix("#8fdcec", "#ffffff", foam),
            opacity: (back ? 0.2 : 0.3) + 0.3 * foam,
            size: 0.6 + 0.5 * rand(),
            part,
            kind: "fade",
            params: [0, 0.99],
            channel: 1 + i,
          };
        });
      });
    },
  },
};

// ---- Math you can type (lane Math) --------------------------------------------------
// The graph plotter, the surface plotter, the circle and its waves, the
// Fourier circles and the Pythagoras proof. The plotters read what people
// type with src/equation.js (no eval), and keep the typed text in a hidden
// option, so it is saved in links.

// Per-toy memory for drive() (the sounds' clocks), keyed by the control
// state object, which is new each time a toy loads.
const MEM = new WeakMap();
function mem(c) {
  let m = MEM.get(c);
  if (!m) MEM.set(c, (m = {}));
  return m;
}
// Seconds since the tap of pulse `key` lasting `secs`, or -1 at rest.
const since = (c, key, secs) => (c[key] > 0 ? (1 - c[key]) * secs : -1);
// Sound B: what each Möbius rider sounds like on its ride (0.35 to 4.55 s of
// the effect): a race car's engine revving, a beach ball rolling, a bicycle's
// tires with one soft quack from the duck, and the ant's tiny feet.
const MOB_RIDER_SOUNDS = {
  car: [[0.3, { voice: "motor", f: 55, to: 1.5, kind: "car", bright: 0.6, decay: 2.6, vol: 0.55 }]], // prettier-ignore
  ball: [[0.3, { voice: "rumble", f: 70, rate: 2.5, decay: 2.3, vol: 0.45 }]],
  bike: [
    [0.3, { voice: "roar", f: 180, bright: 0.2, decay: 3, vol: 0.3 }],
    [2.2, { voice: "quack", f: 260, n: 1, vol: 0.45 }],
  ],
  ant: [[0.3, { voice: "patter", f: 3200, n: 70, decay: 7, vol: 0.35 }]],
};
// Plays each [at, spec] once as the effect's clock e passes `at`.
function cuesAt(c, e, list, out, slot = "cue") {
  const m = mem(c);
  const was = m[slot] ?? -1;
  m[slot] = e;
  if (e < 0 || e < was) return;
  for (const [at, spec] of list) if (was < at && e >= at) out.cues.push(spec);
}

// A little lower-case bitmap font (5 x 7, like src/font.js) for the labels
// and Euler's formula.
const GLYPHS = {
  a: "00000 00000 01110 00001 01111 10001 01111",
  b: "10000 10000 10110 11001 10001 10001 11110",
  c: "00000 00000 01110 10000 10000 10001 01110",
  e: "00000 00000 01110 10001 11111 10000 01110",
  i: "00100 00000 01100 00100 00100 00100 01110",
  n: "00000 00000 10110 11001 10001 10001 10001",
  o: "00000 00000 01110 10001 10001 10001 01110",
  s: "00000 00000 01111 10000 01110 00001 11110",
  x: "00000 00000 10001 01010 00100 01010 10001",
  y: "00000 00000 10001 10001 01111 00001 01110",
  z: "00000 00000 11111 00010 00100 01000 11111",
  θ: "01110 10001 10001 11111 10001 10001 01110",
  "=": "00000 00000 11111 00000 11111 00000 00000",
  "+": "00000 00100 00100 11111 00100 00100 00000",
  "(": "00010 00100 01000 01000 01000 00100 00010",
  ")": "01000 00100 00010 00010 00010 00100 01000",
  " ": "00000 00000 00000 00000 00000 00000 00000",
  2: "01110 10001 00001 00010 00100 01000 11111",
};
// The pixel centres of a line of text: `h` is the glyph height; the text's
// left end, baseline middle is at `at` in the XY plane (z = at[2]). Pieces of
// the form "^(...)" are set small and raised (an exponent). Returns
// [{ p, char }] with the index of each character.
function textPixels(text, at, h) {
  const out = [];
  let x = at[0];
  let sup = false;
  let ci = 0;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (ch === "^") {
      sup = true;
      continue;
    }
    if (sup && ch === "}") {
      sup = false;
      continue;
    }
    if (sup && ch === "{") continue;
    const g = GLYPHS[ch];
    const s = h / 7;
    const px = sup ? s * 0.72 : s;
    const y0 = at[1] + (sup ? h * 0.55 : 0) - (sup ? 0 : h / 2);
    if (g) {
      const rows = g.split(" ");
      rows.forEach((row, r) => {
        for (let q = 0; q < 5; q++)
          if (row[q] === "1")
            out.push({ p: [x + (q + 0.5) * px, y0 + (6.5 - r) * px, at[2]], char: ci, px });
      });
    }
    x += 6 * px;
    ci++;
  }
  return { pixels: out, width: x - at[0] };
}
// Splats for text pixels: a few per pixel, so the letters read as solid
// strokes.
function textCloud(k, pixels, opts, look) {
  const per = 4;
  // opts.exact (lane Sharpness B): the four dots of a pixel sit on a 2 x 2
  // grid inside it, with exact sizes, so the letter is crisp.
  const { exact, ...rest } = opts;
  k.cloud({ count: pixels.length * per, pattern: false, ...rest }, (rand, i) => {
    const px = pixels[Math.floor(i / per)];
    if (!px) return null;
    const j = px.px * 0.45;
    if (exact) {
      const q = i % per;
      const d = px.px * 0.25;
      return {
        p: [px.p[0] + (q & 1 ? d : -d), px.p[1] + (q & 2 ? d : -d), px.p[2]],
        n: [0, 0, 1],
        flat: 0.4,
        jitter: 0,
        size: Math.max(0.6, (px.px / 0.014) * 0.6),
        ...look(px, rand),
      };
    }
    return {
      p: [px.p[0] + (rand() - 0.5) * j, px.p[1] + (rand() - 0.5) * j, px.p[2]],
      n: [0, 0, 1],
      flat: 0.4,
      size: Math.max(0.9, (px.px / 0.014) * 1.05),
      ...look(px, rand),
    };
  });
}

// A "nice" grid step for a span: 1, 2 or 5 times a power of ten.
function niceStep(span, lines = 8) {
  const raw = span / lines;
  const p = Math.pow(10, Math.floor(Math.log10(raw)));
  const m = raw / p;
  return (m < 1.5 ? 1 : m < 3.5 ? 2 : m < 7.5 ? 5 : 10) * p;
}
function percentile(sorted, q) {
  if (!sorted.length) return 0;
  const i = Math.min(sorted.length - 1, Math.max(0, Math.round(q * (sorted.length - 1))));
  return sorted[i];
}
// The parameter a over a slider position u in 0..1: lo at 0, a0 at the
// middle, hi at 1 (straight lines in between).
const aAt = (A, u) => (u < 0.5 ? A[0] + (A[1] - A[0]) * (u / 0.5) : A[1] + (A[2] - A[1]) * ((u - 0.5) / 0.5)); // prettier-ignore
// The sweep's knots: a copy of the curve (or surface) is built at each and
// morphs to the next, so the shape bends exactly through each knot.
const SWEEP_KNOTS = 8;

// ---- Graph plotter ------------------------------------------------------------------

// The plot area on the board, in recipe units (4:3).
const PLOT_W = 2.0;
const PLOT_H = 1.5;
const PLOT_Z = 0.045; // the curve's height in front of the board
// Famous curves: the equation (read by src/equation.js, like a typed one),
// the range of x, θ or t, and a's slider [lo, rest, hi]. `cycle`: a is an
// angle and hi − lo a whole period, so the sweep runs one way round.
const CURVES = [
  { id: "sine", label: "Sine wave", eq: "y = a·sin(x)", a: [-1, 1, 2] },
  { id: "bell", label: "Bell curve", eq: "y = exp(−x²/(2a²))/(a·√(2π))", range: [-4, 4], a: [0.5, 1, 1.8] }, // prettier-ignore
  { id: "parabola", label: "Parabola", eq: "y = a·x²", range: [-3, 3], a: [-1, 0.5, 1.5] },
  { id: "cubic", label: "Cubic", eq: "y = x³ − a·x", range: [-2.5, 2.5], a: [-1, 3, 5] },
  { id: "quartic", label: "Double well", eq: "y = x⁴ − a·x²", range: [-2.4, 2.4], a: [-1, 3, 4.5] }, // prettier-ignore
  { id: "tangent", label: "Tangent", eq: "y = tan(a·x)", a: [0.4, 1, 1.4] },
  { id: "hyperbola", label: "Hyperbola", eq: "y = a/x", range: [-5, 5], a: [-2, 1, 3] },
  { id: "exponential", label: "Exponential", eq: "y = e^(a·x)", range: [-3, 3], a: [-1, 1, 1.4] },
  { id: "logarithm", label: "Logarithm", eq: "y = a·ln(x)", range: [-1, 8], a: [-1, 1, 2] },
  { id: "sqrt", label: "Square root", eq: "y = a·√x", range: [-1, 9], a: [-1, 1, 1.5] },
  { id: "sinc", label: "Sinc", eq: "y = sin(a·x)/x", range: [-15, 15], a: [0.5, 1, 2] },
  { id: "damped", label: "Damped wave", eq: "y = e^(−x/5)·cos(a·x)", range: [0, 15], a: [0.5, 2, 3] }, // prettier-ignore
  { id: "square-wave", label: "Square wave (Fourier)", eq: "y = sin x + a(sin 3x/3 + sin 5x/5 + sin 7x/7 + sin 9x/9)", a: [0, 1, 1.5] }, // prettier-ignore
  { id: "beats", label: "Beats", eq: "y = sin(5x) + sin(a·5x)", a: [0.8, 0.9, 1.1] },
  { id: "sigmoid", label: "S-curve (logistic)", eq: "y = 1/(1 + e^(−a·x))", range: [-6, 6], a: [0.3, 1, 4] }, // prettier-ignore
  { id: "catenary", label: "Catenary (hanging chain)", eq: "y = a·cosh(x/a)", range: [-3, 3], a: [0.6, 1, 2] }, // prettier-ignore
  { id: "witch", label: "Witch of Agnesi", eq: "y = 8a³/(x² + 4a²)", range: [-6, 6], a: [0.5, 1, 1.4] }, // prettier-ignore
  { id: "wiggle", label: "x·sin(1/x)", eq: "y = x·sin(a/x)", range: [-1, 1], a: [0.5, 1, 2] },
  { id: "circle", label: "Circle", eq: "r = a", a: [0.5, 1, 1.5] },
  { id: "cardioid", label: "Cardioid", eq: "r = 1 + a·cos θ", a: [0.2, 1, 1.8] },
  { id: "limacon", label: "Limaçon", eq: "r = a + 2cos θ", a: [0.5, 1, 3] },
  { id: "rose", label: "Rose (8 petals)", eq: "r = cos(4θ + a·sin θ)", a: [-1, 0, 1] },
  { id: "rose3", label: "Rose (3 petals)", eq: "r = sin(3θ) + a", range: [0, Math.PI], a: [-0.3, 0, 0.3] }, // prettier-ignore
  { id: "butterfly", label: "Butterfly", eq: "r = e^(sin θ) − 2a·cos(4θ) + sin((2θ − π)/24)^5", range: [0, 12 * Math.PI], a: [0.5, 1, 1.25] }, // prettier-ignore
  { id: "heart", label: "Heart", eq: "x = 16a·sin(t)³, y = a(13cos t − 5cos 2t − 2cos 3t − cos 4t)", a: [0.8, 1, 1.12] }, // prettier-ignore
  { id: "lissajous", label: "Lissajous", eq: "x = sin(3t + a), y = sin(2t)", a: [Math.PI / 2 - Math.PI, Math.PI / 2, Math.PI / 2 + Math.PI], cycle: true }, // prettier-ignore
  { id: "lissajous54", label: "Lissajous 5:4", eq: "x = sin(5t + a), y = sin(4t)", a: [-Math.PI, 0, Math.PI], cycle: true }, // prettier-ignore
  { id: "archimedes", label: "Archimedean spiral", eq: "r = a·θ", range: [0, 6 * Math.PI], a: [0.6, 1, 1.4] }, // prettier-ignore
  { id: "log-spiral", label: "Logarithmic spiral", eq: "r = e^(a·θ)", range: [-4 * Math.PI, 2.5 * Math.PI], a: [0.12, 0.18, 0.22] }, // prettier-ignore
  { id: "hyperbolic-spiral", label: "Hyperbolic spiral", eq: "r = a/θ", range: [0.3, 8 * Math.PI], a: [0.6, 1, 1.4] }, // prettier-ignore
  { id: "lemniscate", label: "Lemniscate (infinity)", eq: "x = cos t/(1 + sin(t)²), y = a·sin t·cos t/(1 + sin(t)²)", a: [-1, 1, 2] }, // prettier-ignore
  { id: "astroid", label: "Astroid", eq: "x = cos(t)³, y = a·sin(t)³", a: [0.3, 1, 1.5] },
  { id: "deltoid", label: "Deltoid", eq: "x = 2cos t + a·cos 2t, y = 2sin t − a·sin 2t", a: [0, 1, 1.5] }, // prettier-ignore
  { id: "nephroid", label: "Nephroid", eq: "x = 3cos t − a·cos 3t, y = 3sin t − a·sin 3t", a: [0, 1, 1.5] }, // prettier-ignore
  { id: "cycloid", label: "Cycloid", eq: "x = t − a·sin t, y = 1 − a·cos t", range: [-2 * Math.PI, 4 * Math.PI], a: [0.3, 1, 1.7] }, // prettier-ignore
  { id: "spirograph", label: "Spirograph", eq: "x = 2cos t + a·cos(2t/3), y = 2sin t − a·sin(2t/3)", range: [0, 6 * Math.PI], a: [1, 2.5, 3.2] }, // prettier-ignore
  { id: "epitrochoid", label: "Epitrochoid", eq: "x = 4cos t − a·cos 4t, y = 4sin t − a·sin 4t", a: [0.5, 1.5, 2.5] }, // prettier-ignore
  { id: "involute", label: "Involute of a circle", eq: "x = cos t + a·t·sin t, y = sin t − a·t·cos t", range: [0, 5 * Math.PI], a: [0.6, 1, 1.4] }, // prettier-ignore
  { id: "conic", label: "Conic sections", eq: "r = 1/(1 + a·cos θ)", a: [0, 0.5, 1.6] },
  { id: "folium", label: "Folium of Descartes", eq: "x = 3a·t/(1 + t³), y = 3a·t²/(1 + t³)", range: [-8, 8], a: [0.6, 1, 1.4], win: [-2.6, 2.2, -2.6, 2.2] }, // prettier-ignore
  { id: "tractrix", label: "Tractrix", eq: "x = t − tanh t, y = a/cosh t", range: [-5, 5], a: [0.5, 1, 1.5] }, // prettier-ignore
  { id: "freeth", label: "Freeth's nephroid", eq: "r = 1 + 2sin(a·θ/2)", range: [0, 4 * Math.PI], a: [0.8, 1, 1.2] }, // prettier-ignore
];
const CURVE_BY_ID = Object.fromEntries(CURVES.map((c) => [c.id, c]));
// A typed equation's ranges and a's slider.
const TYPED_RANGE = { y: [-2 * Math.PI, 2 * Math.PI], polar: [0, 2 * Math.PI], param: [0, 2 * Math.PI] }; // prettier-ignore
const TYPED_A = [0, 1, 2];
const CURVE_SAMPLES = 1600;

// A curve's point at parameter u (x, θ or t) and a, or null.
function curvePoint(parsed, u, a, b) {
  const v = { x: u, t: u, θ: u, a, b, y: 0, r: 0 };
  let x;
  let y;
  if (parsed.kind === "y") {
    x = u;
    y = parsed.y(v);
  } else if (parsed.kind === "polar") {
    const r = parsed.r(v);
    x = r * Math.cos(u);
    y = r * Math.sin(u);
  } else {
    x = parsed.x(v);
    y = parsed.y(v);
  }
  return Number.isFinite(x) && Number.isFinite(y) ? [x, y] : null;
}

// Everything the graph plotter draws for one curve: the window, the knots
// of a and, for each knot, the curve's visible pieces on the board.
const PLOT_CACHE = new Map();
function curvePlot(o) {
  const b = Number.isFinite(o.b) ? o.b : 1;
  const famous = CURVE_BY_ID[o.curve];
  const key = `${o.curve}|${o.curve === "custom" ? o.eq : ""}|${b}`;
  if (PLOT_CACHE.has(key)) return PLOT_CACHE.get(key);
  let spec = famous;
  let parsed = null;
  if (o.curve === "custom") {
    try {
      parsed = readCurve(o.eq);
      spec = { id: "custom", label: "Your curve", eq: o.eq, range: TYPED_RANGE[parsed.kind], a: TYPED_A }; // prettier-ignore
    } catch {
      spec = null;
    }
  }
  if (!spec) spec = CURVES[0];
  if (!parsed) parsed = readCurve(spec.eq);
  const plot = makePlot(parsed, spec, b);
  if (!plot.ok && spec.id === "custom") {
    // Nothing of a typed curve shows (from an old link, say): the sine.
    const fallback = makePlot(readCurve(CURVES[0].eq), CURVES[0], 1);
    PLOT_CACHE.set(key, fallback);
    return fallback;
  }
  if (PLOT_CACHE.size > 40) PLOT_CACHE.clear();
  PLOT_CACHE.set(key, plot);
  return plot;
}

function makePlot(parsed, spec, b) {
  const range = spec.range || TYPED_RANGE[parsed.kind];
  const A = spec.a || TYPED_A;
  const usesA = parsed.usesA;
  const knots = usesA
    ? Array.from({ length: SWEEP_KNOTS + 1 }, (_, j) => aAt(A, j / SWEEP_KNOTS))
    : [A[1]];
  // Samples at every knot (and the rest value).
  const M = CURVE_SAMPLES;
  const us = Array.from({ length: M + 1 }, (_, i) => range[0] + ((range[1] - range[0]) * i) / M);
  const at = (a) => us.map((u) => curvePoint(parsed, u, a, b));
  const rest = at(A[1]);
  const all = usesA ? knots.map((a) => at(a)) : [rest];
  // The window: robust bounds of the curve at rest (a few wild points, near
  // an asymptote, are left off the board), widened a little towards where
  // the sweep takes it, so the curve bends within the board.
  const bounds = (lists, cut) => {
    const xs = [];
    const ys = [];
    for (const list of lists)
      for (const p of list) {
        if (!p) continue;
        xs.push(p[0]);
        ys.push(p[1]);
      }
    if (xs.length < 8) return null;
    xs.sort((p, q) => p - q);
    ys.sort((p, q) => p - q);
    return [percentile(xs, cut), percentile(xs, 1 - cut), percentile(ys, cut), percentile(ys, 1 - cut)]; // prettier-ignore
  };
  const cut = parsed.kind === "y" ? 0.02 : 0.004;
  const R = bounds([rest], cut);
  if (!R) return { ok: false };
  const U = usesA ? bounds(all, cut * 2) : R;
  const widen = (r0, r1, u0, u1) => {
    const span = Math.max(r1 - r0, 1e-6);
    return [Math.min(r0, Math.max(u0, r0 - 0.25 * span)), Math.max(r1, Math.min(u1, r1 + 0.25 * span))]; // prettier-ignore
  };
  let [x0, x1] = widen(R[0], R[1], U[0], U[1]);
  let [y0, y1] = widen(R[2], R[3], U[2], U[3]);
  if (spec.win) [x0, x1, y0, y1] = spec.win;
  if (parsed.kind === "y") {
    x0 = range[0];
    x1 = range[1];
    if (y1 - y0 < 1e-6) {
      y0 -= 1;
      y1 += 1;
    }
    const pad = (y1 - y0) * 0.1;
    y0 -= pad;
    y1 += pad;
  } else {
    const cx = (x0 + x1) / 2;
    const cy = (y0 + y1) / 2;
    // Equal scales, so circles stay round.
    let half = Math.max((x1 - x0) / PLOT_W, (y1 - y0) / PLOT_H) * (spec.win ? 0.5 : 0.56);
    if (!(half > 1e-6)) half = 1;
    x0 = cx - half * PLOT_W;
    x1 = cx + half * PLOT_W;
    y0 = cy - half * PLOT_H;
    y1 = cy + half * PLOT_H;
  }
  const sx = PLOT_W / (x1 - x0);
  const sy = PLOT_H / (y1 - y0);
  const toBoard = (p) => [(p[0] - x0) * sx - PLOT_W / 2, (p[1] - y0) * sy - PLOT_H / 2, PLOT_Z];
  const inside = (P) => Math.abs(P[0]) <= PLOT_W / 2 + 1e-9 && Math.abs(P[1]) <= PLOT_H / 2 + 1e-9;
  // The visible pieces of the curve for one list of samples: a jump across
  // most of the board (an asymptote) or a missing point breaks it.
  const pieces = (list) => {
    const out = [];
    let cur = null;
    list.forEach((p, i) => {
      const P = p && toBoard(p);
      const ok = P && inside(P);
      if (
        ok &&
        cur &&
        Math.hypot(P[0] - cur[cur.length - 1].P[0], P[1] - cur[cur.length - 1].P[1]) < 0.35
      ) {
        // prettier-ignore
        cur.push({ i, P });
        return;
      }
      if (cur && cur.length > 1) out.push(cur);
      cur = ok ? [{ i, P }] : null;
    });
    if (cur && cur.length > 1) out.push(cur);
    return out;
  };
  const restPieces = pieces(rest);
  const knotPieces = usesA ? all.map(pieces) : [];
  const length = (ps) => ps.reduce((s, pc) => s + pc.reduce((t, q, j) => (j ? t + Math.hypot(q.P[0] - pc[j - 1].P[0], q.P[1] - pc[j - 1].P[1]) : 0), 0), 0); // prettier-ignore
  const L = length(restPieces);
  if (!(L > 0.05)) return { ok: false };
  // The pen's path: points along the rest curve by arc length (0..1), with
  // a flag where the pen lifts to jump a gap.
  const path = [];
  let run = 0;
  for (const pc of restPieces) {
    pc.forEach((q, j) => {
      if (j) run += Math.hypot(q.P[0] - pc[j - 1].P[0], q.P[1] - pc[j - 1].P[1]);
      if (j % 4 === 0 || j === pc.length - 1) path.push([run / L, q.P[0], q.P[1], j === 0 ? 1 : 0]); // prettier-ignore
    });
  }
  // The grid.
  const stepX = niceStep(x1 - x0, parsed.kind === "y" ? 10 : 8);
  const stepY = parsed.kind === "y" ? niceStep(y1 - y0, 7) : stepX;
  const grid = [];
  for (let g = Math.ceil(x0 / stepX) * stepX; g <= x1 + 1e-9; g += stepX) {
    const X = (g - x0) * sx - PLOT_W / 2;
    grid.push({ a: [X, -PLOT_H / 2], b: [X, PLOT_H / 2], axis: Math.abs(g) < stepX * 1e-6 });
  }
  for (let g = Math.ceil(y0 / stepY) * stepY; g <= y1 + 1e-9; g += stepY) {
    const Y = (g - y0) * sy - PLOT_H / 2;
    grid.push({ a: [-PLOT_W / 2, Y], b: [PLOT_W / 2, Y], axis: Math.abs(g) < stepY * 1e-6 });
  }
  return {
    ok: true,
    spec,
    parsed,
    b,
    A,
    usesA,
    cycle: !!spec.cycle,
    knots,
    us,
    range,
    rest: restPieces,
    knotPieces,
    L,
    path,
    grid,
    toBoard,
    inside,
    point: (u, a) => curvePoint(parsed, u, a, b),
  };
}

// The pen's place at s (0..1 along the curve): [x, y, lifted].
function penAt(path, s) {
  if (!path.length) return [0, 0];
  let lo = 0;
  let hi = path.length - 1;
  if (s <= path[0][0]) return [path[0][1], path[0][2]];
  if (s >= path[hi][0]) return [path[hi][1], path[hi][2]];
  while (hi - lo > 1) {
    const mid = (lo + hi) >> 1;
    if (path[mid][0] <= s) lo = mid;
    else hi = mid;
  }
  const p = path[lo];
  const q = path[hi];
  if (q[3]) return [q[1], q[2]]; // a jump: the pen hops to the next piece
  const f = (s - p[0]) / (q[0] - p[0] || 1);
  return [p[1] + (q[1] - p[1]) * f, p[2] + (q[2] - p[2]) * f];
}

// Splats along a curve's pieces, evenly by length. Each gets its place, its
// parameter u (interpolated between samples) and its arc fraction s.
function alongPieces(pieces, us, n, rand, i) {
  // Cumulative lengths (cached on the pieces).
  if (!pieces.cum) {
    const cum = [];
    let run = 0;
    for (const pc of pieces)
      pc.forEach((q, j) => {
        if (j) run += Math.hypot(q.P[0] - pc[j - 1].P[0], q.P[1] - pc[j - 1].P[1]);
        cum.push({ run, q, first: j === 0 });
      });
    pieces.cum = cum;
    pieces.total = run;
  }
  const cum = pieces.cum;
  const target = ((i + rand()) / n) * pieces.total;
  let lo = 0;
  let hi = cum.length - 1;
  while (hi - lo > 1) {
    const mid = (lo + hi) >> 1;
    if (cum[mid].run <= target) lo = mid;
    else hi = mid;
  }
  const A = cum[lo];
  const B = cum[hi];
  if (B.first) return { P: A.q.P, u: us[A.q.i], s: A.run / pieces.total, d: [1, 0] };
  const f = (target - A.run) / (B.run - A.run || 1);
  const dl = B.run - A.run || 1;
  return {
    d: [(B.q.P[0] - A.q.P[0]) / dl, (B.q.P[1] - A.q.P[1]) / dl],
    P: [A.q.P[0] + (B.q.P[0] - A.q.P[0]) * f, A.q.P[1] + (B.q.P[1] - A.q.P[1]) * f, PLOT_Z],
    u: us[A.q.i] + (us[B.q.i] - us[A.q.i]) * f,
    s: target / pieces.total,
  };
}

// What the plotter shows (for the input panel).
const PLOT_SHOWN = { label: "" };
// The curve's colour along its parameter (the same on every copy, so the
// copies swap without a flicker).
const CURVE_RAMP = ["#ffd166", "#ff9f43", "#ff6b6b", "#f06595", "#cc5de8"];

const GRAPH_INPUT = {
  title: "Your own curve",
  placeholder: "y = a·sin(b·x), r = 1 + cos θ, or x = cos 3t, y = sin 2t",
  button: "Draw it",
  fileButton: "Open a text file…",
  accept: ".txt",
  note: "Type y = … (x from −2π to 2π), r = … with θ (a polar curve, one turn), or x = …, y = … with t (a curve in t, 0 to 2π). Use + − × ÷ ^, brackets, sin, cos, tan, exp, log, √, abs, pi and e. Put a in it to see it bend when you tap; b is the b slider.",
  async read(text) {
    const parsed = readCurve(text);
    // Kept as plain ASCII (links keep only that).
    const eq = asciiEquation(text);
    readCurve(eq);
    const plot = makePlot(parsed, { id: "custom", eq, a: TYPED_A }, 1);
    if (!plot.ok) throw new EquationError("none of it lands on the grid. Try another.");
    return { curve: "custom", eq };
  },
  shown: () => PLOT_SHOWN.label,
};

// A flat ribbon along a curve's pieces, facing +Z, sampled by length.
// Samples carry u (the curve's parameter there), s (the arc fraction) and
// t (the parameter as a fraction of its range, for colour).
function ribbon(pieces, us, width) {
  alongPieces(pieces, us, 1, () => 0, 0); // fills the cumulative lengths
  const u0 = us[0];
  const u1 = us[us.length - 1];
  return {
    area: pieces.total * width,
    thick: width / 2,
    sample(rand) {
      const q = alongPieces(pieces, us, 1, rand, 0);
      const w = (rand() - 0.5) * width;
      const p = [q.P[0] - q.d[1] * w, q.P[1] + q.d[0] * w, q.P[2]];
      return { p, c0: q.P, n: [0, 0, 1], u: q.u, s: q.s, t: (q.u - u0) / (u1 - u0 || 1), tangent: [q.d[0], q.d[1], 0] }; // prettier-ignore
    },
  };
}
// Straight grid lines as thin ribbons: lines [{ a, b, axis }].
function gridLines(lines, width, z) {
  const lens = lines.map((l) => Math.hypot(l.b[0] - l.a[0], l.b[1] - l.a[1]) * (l.axis ? 2 : 1));
  const total = lens.reduce((s, x) => s + x, 0);
  return {
    area: total * width,
    thick: width,
    sample(rand) {
      let r = rand() * total;
      let i = 0;
      while (i < lines.length - 1 && r > lens[i]) r -= lens[i++];
      const l = lines[i];
      const f = rand();
      const w = (rand() - 0.5) * width * (l.axis ? 2 : 1);
      const horiz = Math.abs(l.b[1] - l.a[1]) < 1e-9;
      const x = l.a[0] + (l.b[0] - l.a[0]) * f + (horiz ? 0 : w);
      const y = l.a[1] + (l.b[1] - l.a[1]) * f + (horiz ? w : 0);
      return { p: [x, y, z], n: [0, 0, 1], axis: l.axis, tangent: horiz ? [1, 0, 0] : [0, 1, 0] };
    },
  };
}

// The slider under a plot: a track with an "a" beside it and a knob that
// slides with a (knob at the middle for a's rest value).
const SLIDER_LEN = 1.1;
// Splats sort where they were built (the knob at the middle), so a knob
// moved along the track drew under it: sort it where it stands as it moves
// (lane Sharpness B).
function sortKnob(out, info, u) {
  const d = info?.data;
  const slot = Math.round(u * 40);
  if (d && slot !== d.knobSlot) {
    d.knobSlot = slot;
    out.resortPose = true;
  }
}

// The a slider's knob can be dragged along its track (lane Sharpness B): the
// toy's a control, and the panel's slider, follow it. Each plotter's build
// says where its slider is (or null when its equation has no a).
const PLOT_SLIDERS = {};
// Where a plotter's a slider is, for the tests (null without one).
export const plotSliderAt = (id) => PLOT_SLIDERS[id] ?? null;
function plotSliderDrag(id) {
  const place = (p) => {
    const s = PLOT_SLIDERS[id];
    return s ? { control: "a", value: clamp01((p[0] - s[0]) / SLIDER_LEN + 0.5) } : null;
  };
  return {
    plane: "view",
    at(p) {
      const s = PLOT_SLIDERS[id];
      return !!s && Math.abs(p[0] - s[0]) < SLIDER_LEN / 2 + 0.1 && Math.abs(p[1] - s[1]) < 0.12 && Math.abs(p[2] - s[2]) < 0.15; // prettier-ignore
    },
    start: place,
    move: place,
  };
}

function plotSlider(k, at, { part = null, exact = false } = {}) {
  const [x, y, z] = at;
  // (Many small splats, lane Sharpness B: a few big ones read as beads.)
  k.add(evenCylinder(0.018, 0.018, SLIDER_LEN), {
    even: true,
    opacity: 1,
    jitter: 0.015,
    pos: [x, y, z],
    rot: [0, 0, 90],
    weight: 4,
    size: 0.8,
    color: (c) => lit("#56637a", c.n, { amb: 0.7, dif: 0.35, spec: 0.3 }),
  });
  // Tick marks at the ends and the middle.
  for (const f of [-0.5, 0, 0.5])
    k.add(evenBox(0.012, 0.07, 0.012),
{
even: true,
opacity: 1,
jitter: 0.015,
pos: [x + f * SLIDER_LEN, y, z - 0.01],
weight: 2,
color: "#8b97ad",
}); // prettier-ignore
  const label = textPixels("a", [x - SLIDER_LEN / 2 - 0.16, y, z], 0.09);
  textCloud(k, label.pixels, { exact }, () => ({ color: "#ffd166" }));
  const knob = part ?? k.part("knob", { pivot: [x, y, z] });
  k.add(evenCylinder(0.055, 0.055, 0.05), {
    even: true,
    opacity: 1,
    jitter: 0.015,
    pos: [x, y, z + 0.03],
    rot: [90, 0, 0],
    part: knob,
    weight: 4,
    size: 0.8,
    pattern: false,
    color: (c) => lit(c.s.cap ? "#ffd166" : "#f0bf52", c.n, { amb: 0.8, dif: 0.25, spec: 0.3 }),
  });
  return knob;
}

// A marker pen, its tip at `tip`, leaning back towards the viewer.
function plotPen(k, tip, part) {
  const dir = unit([0.32, 0.62, 0.72]);
  const q = quatFromDir(dir);
  const at = (d) => add(tip, mul(dir, d));
  k.add(evenCylinder(0.004, 0.02, 0.05, false),
{
even: true,
opacity: 1,
jitter: 0.015,
pos: at(0.025),
quat: q,
part,
weight: 3,
pattern: false,
color: "#ff6b6b",
}); // prettier-ignore
  k.add(evenCylinder(0.02, 0.032, 0.05, false),
{
even: true,
opacity: 1,
jitter: 0.015,
pos: at(0.075),
quat: q,
part,
weight: 3,
pattern: false,
color: (c) => lit("#e8e8ee", c.n),
}); // prettier-ignore
  k.add(evenCylinder(0.033, 0.033, 0.3, "top"),
{
even: true,
opacity: 1,
jitter: 0.015,
pos: at(0.25),
quat: q,
part,
weight: 2,
pattern: false,
color: (c) => lit("#3d6fd6", c.n, { spec: 0.4 }),
}); // prettier-ignore
  k.add(evenCylinder(0.036, 0.036, 0.09, "top"),
{
even: true,
opacity: 1,
jitter: 0.015,
pos: at(0.43),
quat: q,
part,
weight: 2,
pattern: false,
color: (c) => lit("#ff6b6b", c.n, { spec: 0.4 }),
}); // prettier-ignore
}
function quatFromDir(d) {
  // The rotation taking +Y to d.
  const y = [0, 1, 0];
  const axis = cross(y, d);
  const s = len(axis);
  if (s < 1e-9) return d[1] > 0 ? [0, 0, 0, 1] : [1, 0, 0, 0];
  return quatAxisAngle(unit(axis), Math.atan2(s, dot(y, d)));
}

Object.assign(RECIPES, {
  "graph-plotter": {
    alive: true,
    density: 1.2,
    options: [
      {
        key: "curve",
        label: "Curve",
        type: "select",
        default: "sine",
        choices: [
          ...CURVES.map((c) => ({ id: c.id, label: c.label })),
          { id: "custom", label: "Your own (below)" },
        ],
      },
      { key: "b", label: "b (your own curve)", type: "slider", min: 0.25, max: 5, step: 0.25, default: 1 }, // prettier-ignore
      // Your own curve, as typed (set from the panel, not shown).
      { key: "eq", label: "Your curve", type: "text", default: "", hidden: true },
    ],
    input: GRAPH_INPUT,
    drag: plotSliderDrag("graph-plotter"),
    controls: [
      { key: "a", label: "a", type: "slider", default: 0.5 },
      { key: "draw", label: "Draw", type: "pulse", ease: 4.5 },
    ],
    action: { key: "draw", label: "Draw it" },
    // A tap wipes the curve and a pen draws it again across the lit grid,
    // humming a tone that follows its height; then the a slider sweeps up,
    // down and back and the curve bends with it in real time (4.5 s). The
    // curve is built once at rest (it appears behind the pen, channel 0)
    // and once at each of nine values of a; each of those copies morphs
    // exactly into the next (channel 1), and the one for the slider's
    // place is shown.
    drive(t, c, out, info) {
      const g = info?.data?.graph;
      if (!g) return;
      const T = 4.5;
      const e = since(c, "draw", T);
      const on = e >= 0;
      const drawEnd = g.usesA ? 2.45 : 3.6;
      const sPen = on ? easeInOut(band(e, 0.25, drawEnd)) : 1;
      const drawing = on && e < drawEnd + 0.1;
      // The slider: its own place, swept by a tap.
      const base = clamp01(c.a ?? 0.5);
      let u = base;
      let sweeping = false;
      if (on && g.usesA) {
        const x = band(e, drawEnd + 0.2, T - 0.15);
        if (x > 0 && x < 1) {
          sweeping = true;
          const w = easeInOut(x);
          if (g.cycle) u = (base + w) % 1;
          else {
            const s = Math.sin(TAU * w);
            u = s > 0 ? base + (1 - base) * s : base + base * s;
          }
        }
      }
      const showRest = !g.usesA || drawing || (!sweeping && Math.abs(u - 0.5) < 1e-4);
      const j = Math.min(SWEEP_KNOTS - 1, Math.floor(u * SWEEP_KNOTS));
      const frac = clamp01(u * SWEEP_KNOTS - j);
      out.parts.curve = { visible: showRest ? 1 : 0 };
      for (let i = 0; i < g.copies; i++) out.parts[`sweep${i}`] = { visible: !showRest && i === j ? 1 : 0 }; // prettier-ignore
      out.morph = [drawing && sPen < 1 ? 1.002 - sPen : 0, showRest ? 0 : frac, 0, 0];
      if (g.usesA) {
        out.parts.knob = { offset: [(u - 0.5) * SLIDER_LEN, 0, 0] };
        sortKnob(out, info, u);
      }
      // The pen comes down, draws and lifts away.
      const pv = on ? bump(e, 0.02, 0.2, drawEnd, drawEnd + 0.25) : 0;
      const pen = penAt(g.path, sPen);
      out.parts.pen = { offset: [pen[0], pen[1], 0.25 * (1 - pv)], visible: pv };
      // The grid lights up.
      out.glow = [0.35, 0.6, 1, on ? 0.22 * bump(e, 0, 0.3, T - 0.9, T - 0.05) : 0];
      // The tone follows the pen's height, a short glide every 0.09 s.
      if (on && e >= 0.25 && e < drawEnd) {
        const m = mem(c);
        if (m.toneE === undefined || e < m.toneE) m.tone = -1;
        m.toneE = e;
        const step = 0.09;
        const n = Math.floor((e - 0.25) / step);
        if (n > m.tone) {
          m.tone = n;
          const p1 = penAt(g.path, easeInOut(band(e + step, 0.25, drawEnd)));
          const hz = (Y) => 196 * Math.pow(2, 2.2 * clamp01(Y / PLOT_H + 0.5));
          const f0 = hz(pen[1]);
          out.cues.push({ voice: "tone", f: f0, to: hz(p1[1]) / f0, decay: 0.3, vol: 0.4 });
        }
      }
    },
    build(k, o) {
      const g = curvePlot(o);
      PLOT_SHOWN.label = `${g.spec.id === "custom" ? "Your curve" : g.spec.label}: ${g.spec.eq}`;
      const copies = g.usesA ? SWEEP_KNOTS : 0;
      k.data = { graph: { usesA: g.usesA, cycle: g.cycle, copies, path: g.path } };
      // The board: a dark slate panel in a lighter frame.
      const BW = PLOT_W + 0.26;
      const BH = PLOT_H + 0.26;
      k.add(k.box(PLOT_W + 0.04, PLOT_H + 0.04, 0.04), {
        pos: [0, 0, -0.02],
        weight: 0.6,
        flat: 0.15,
        jitter: 0.01,
        color: (c) => {
          if (c.s.face !== 4) return "#141c2c";
          const glow = 0.5 + 0.5 * smoothstep(1.6, 0, Math.hypot(c.p[0] + 0.4, c.p[1] - 0.4));
          return mix("#121a2a", "#1f2b44", glow);
        },
      });
      const frame = (c) => lit("#46557a", c.n, { amb: 0.7, dif: 0.4, spec: 0.35 });
      for (const [w, h, x, y] of [
        [BW, 0.11, 0, (BH - 0.11) / 2],
        [BW, 0.11, 0, -(BH - 0.11) / 2],
        [0.11, BH - 0.22, (BW - 0.11) / 2, 0],
        [0.11, BH - 0.22, -(BW - 0.11) / 2, 0],
      ])
        k.add(k.box(w, h, 0.07), { pos: [x, y, -0.015], weight: 1.4, flat: 0.2, jitter: 0.01, even: true, color: frame }); // prettier-ignore
      // The grid, which lights up (a band on channel 2, held at 0).
      k.add(gridLines(g.grid, 0.008, 0.012), {
        weight: 3,
        size: 0.6,
        flat: 0.3,
        stretch: 2.2,
        kind: "band",
        params: [0, 0.5],
        channel: 2,
        pattern: false,
        color: (c) => (c.s.axis ? "#9fb3d6" : "#3b4d6e"),
      });
      const col = (c) => {
        const t = g.cycle ? 0.5 - 0.5 * Math.cos(TAU * c.s.t) : c.s.t;
        return keep(shade(ramp(CURVE_RAMP, t), 1.05 + 0.1 * Math.sin(c.s.u * 3)));
      };
      // The curve at rest: it appears behind the pen as channel 0 falls.
      k.add(ribbon(g.rest, g.us, 0.026), {
        part: k.part("curve"),
        weight: 2.5,
        size: 1.5,
        flat: 0.5,
        stretch: 1.4,
        kind: "fade",
        params: (c) => [1.002 - c.s.s, 0.004],
        channel: 0,
        pattern: false,
        color: col,
      });
      // The copies for the sweep: copy j is the curve at knot j, morphing
      // to knot j + 1.
      for (let j = 0; j < copies; j++) {
        const next = g.knots[j + 1];
        k.add(ribbon(g.knotPieces[j], g.us, 0.026), {
          part: k.part(`sweep${j}`),
          weight: 2,
          size: 1.5,
          flat: 0.6,
          channel: 1,
          pattern: false,
          to: (c) => {
            const p = g.point(c.s.u, next);
            const P = p && g.toBoard(p);
            if (!P || Math.hypot(P[0] - c.s.c0[0], P[1] - c.s.c0[1]) > 1.2) return null;
            // Past the edge of the board it runs along the edge.
            const X = clamp(P[0] + c.p[0] - c.s.c0[0], -PLOT_W / 2, PLOT_W / 2);
            const Y = clamp(P[1] + c.p[1] - c.s.c0[1], -PLOT_H / 2, PLOT_H / 2);
            return [X, Y, c.p[2]];
          },
          color: col,
        });
      }
      // The pen, built with its tip at the middle of the board (inside the
      // toy, so it doesn't change the framing) and moved to the curve.
      plotPen(k, [0, 0, PLOT_Z + 0.004], k.part("pen", { pivot: [0, 0, PLOT_Z] }));
      PLOT_SLIDERS["graph-plotter"] = g.usesA ? [0.12, -BH / 2 - 0.16, 0.02] : null;
      if (g.usesA) plotSlider(k, PLOT_SLIDERS["graph-plotter"]);
    },
  },
});

// ---- Surface plotter ----------------------------------------------------------------

// The surface spans X and Z in [-1, 1]; heights map into [-SURF_H, SURF_H].
const SURF_H = 0.5;
const SURFACES = [
  { id: "saddle", label: "Saddle", eq: "z = a(x² − y²)", dom: [-2, 2], a: [-1, 1, 1.5] },
  { id: "monkey-saddle", label: "Monkey saddle", eq: "z = r³·cos(3θ + a)", dom: [-2, 2], a: [-Math.PI, 0, Math.PI], cycle: true, move: "twists round" }, // prettier-ignore
  { id: "sombrero", label: "Sombrero", eq: "z = 2cos(2r − a)/(1 + r)", dom: [-6, 6], a: [-Math.PI, 0, Math.PI], cycle: true, move: "ripples outward" }, // prettier-ignore
  { id: "egg-crate", label: "Egg crate", eq: "z = sin(x)·sin(y + a)", dom: [-6, 6], a: [-Math.PI, 0, Math.PI], cycle: true, move: "rolls" }, // prettier-ignore
  { id: "gaussian", label: "Gaussian hill", eq: "z = a·exp(−r²/2)", dom: [-3, 3], a: [-0.6, 1, 1.4], move: "breathes" }, // prettier-ignore
  { id: "banana", label: "Rosenbrock's banana valley", eq: "z = log(1 + (a − x)² + 100(y − x²)²)", dom: [-2, 2], domY: [-1, 3], a: [0, 1, 2], move: "slides its valley" }, // prettier-ignore
  { id: "paraboloid", label: "Paraboloid (bowl)", eq: "z = a(x² + y²)", dom: [-2, 2], a: [-1, 1, 1.5] }, // prettier-ignore
  { id: "waves", label: "Ocean waves", eq: "z = sin(x + a) + 0.5sin(0.7x + 1.3y + 2a)", dom: [-6, 6], a: [-Math.PI, 0, Math.PI], cycle: true, move: "rolls" }, // prettier-ignore
  { id: "interference", label: "Two-source ripples", eq: "z = sin(3√((x + 2)² + y²) − a) + sin(3√((x − 2)² + y²) − a)", dom: [-5, 5], a: [-Math.PI, 0, Math.PI], cycle: true, move: "ripples" }, // prettier-ignore
  { id: "pinwheel", label: "Pinwheel", eq: "z = r·sin(3θ + r − a)/3", dom: [-3, 3], a: [-Math.PI, 0, Math.PI], cycle: true, move: "spins" }, // prettier-ignore
  { id: "twist", label: "Twisted sheet", eq: "z = sin(a·x·y)", dom: [-3, 3], a: [0.15, 0.5, 0.8] },
  { id: "peaks", label: "Three peaks", eq: "z = a(3(1 − x)²e^(−x² − (y + 1)²) − 10(x/5 − x³ − y⁵)e^(−x² − y²) − e^(−(x + 1)² − y²)/3)", dom: [-3, 3], a: [-1, 1, 1.3] }, // prettier-ignore
  { id: "himmelblau", label: "Himmelblau's four valleys", eq: "z = log(1 + (x² + y − a)² + (x + y² − 7)²)", dom: [-5, 5], a: [7, 11, 13] }, // prettier-ignore
  { id: "rastrigin", label: "Bumpy (Rastrigin)", eq: "z = x² + y² − a(10cos(2πx) + 10cos(2πy)) + 20a", dom: [-3, 3], a: [0, 1, 1.5] }, // prettier-ignore
  { id: "volcano", label: "Volcano", eq: "z = 2e^(−(r − 2)²) + (1 − a)e^(−r²)", dom: [-4, 4], a: [-0.5, 1, 2], move: "fills and empties its crater" }, // prettier-ignore
  { id: "ripple-bowl", label: "Cosine bumps", eq: "z = a·cos(x)·cos(y)", dom: [-5, 5], a: [-1, 1, 1.5] }, // prettier-ignore
];
const SURFACE_BY_ID = Object.fromEntries(SURFACES.map((s) => [s.id, s]));
const TYPED_DOM = [-3, 3];
const SURF_RAMP = ["#27348b", "#1d7fc4", "#1fb59a", "#9ccf3a", "#ffc233", "#ff6b3d", "#e8384f"];

const SURF_CACHE = new Map();
function surfacePlot(o) {
  const key = `${o.surface}|${o.surface === "custom" ? o.eq : ""}`;
  if (SURF_CACHE.has(key)) return SURF_CACHE.get(key);
  let spec = SURFACE_BY_ID[o.surface];
  let parsed = null;
  if (o.surface === "custom") {
    try {
      parsed = readSurface(o.eq);
      spec = { id: "custom", label: "Your surface", eq: o.eq, dom: TYPED_DOM, a: TYPED_A };
    } catch {
      spec = null;
    }
  }
  if (!spec) spec = SURFACES[0];
  if (!parsed) parsed = readSurface(spec.eq);
  let plot = makeSurface(parsed, spec);
  if (!plot.ok) plot = makeSurface(readSurface(SURFACES[0].eq), SURFACES[0]);
  if (SURF_CACHE.size > 40) SURF_CACHE.clear();
  SURF_CACHE.set(key, plot);
  return plot;
}

function makeSurface(parsed, spec) {
  const A = spec.a || TYPED_A;
  const usesA = parsed.usesA;
  const knots = usesA
    ? Array.from({ length: SWEEP_KNOTS + 1 }, (_, j) => aAt(A, j / SWEEP_KNOTS))
    : [A[1]];
  const dx = spec.dom || TYPED_DOM;
  const dy = spec.domY || dx;
  const v = { x: 0, y: 0, a: 1, b: 1, r: 0, θ: 0, t: 0 };
  const zAt = (U, V, a) => {
    v.x = dx[0] + (dx[1] - dx[0]) * U;
    v.y = dy[0] + (dy[1] - dy[0]) * V;
    v.a = a;
    return parsed.z(v);
  };
  // Heights over every knot, robustly (a few wild values are cut off).
  const zs = [];
  const N = 60;
  for (const a of usesA ? knots : [A[1]])
    for (let i = 0; i <= N; i++)
      for (let j = 0; j <= N; j++) {
        const z = zAt(i / N, j / N, a);
        if (Number.isFinite(z)) zs.push(z);
      }
  if (zs.length < 40) return { ok: false };
  zs.sort((p, q) => p - q);
  let z0 = percentile(zs, 0.01);
  let z1 = percentile(zs, 0.99);
  if (z1 - z0 < 1e-6) {
    z0 -= 1;
    z1 += 1;
  }
  const pad = (z1 - z0) * 0.04;
  z0 -= pad;
  z1 += pad;
  const hs = (2 * SURF_H) / (z1 - z0);
  const toY = (z) => (z - z0) * hs - SURF_H;
  // The flat sheet it rises from: the level of z = 0 when that is in view.
  const floorY = toY(Math.min(z1, Math.max(z0, 0)));
  // A point of the surface (U, V in 0..1) at a, or null off the plot.
  const point = (U, V, a) => {
    const z = zAt(U, V, a);
    if (!Number.isFinite(z) || z < z0 || z > z1) return null;
    return [U * 2 - 1, toY(z), 1 - V * 2];
  };
  return { ok: true, spec, parsed, A, usesA, knots, cycle: !!spec.cycle, point, floorY, dx, dy }; // prettier-ignore
}

const SURF_SHOWN = { label: "" };
const SURFACE_INPUT = {
  title: "Your own surface",
  placeholder: "z = sin(x)·cos(y), z = a(x² − y²), z = sin(r)/r",
  button: "Plot it",
  fileButton: "Open a text file…",
  accept: ".txt",
  note: "Type z = … with x and y (each from −3 to 3), or r and θ (the distance from the middle and the angle round it). Use + − × ÷ ^, brackets, sin, cos, tan, exp, log, √, abs, pi and e. Put a in it to see it move when you tap.",
  async read(text) {
    readSurface(text);
    const eq = asciiEquation(text);
    const plot = makeSurface(readSurface(eq), { id: "custom", eq, dom: TYPED_DOM, a: TYPED_A });
    if (!plot.ok) throw new EquationError("none of it lands on the plot. Try another.");
    return { surface: "custom", eq };
  },
  shown: () => SURF_SHOWN.label,
};

Object.assign(RECIPES, {
  "surface-plotter": {
    alive: true,
    density: 1.25,
    options: [
      {
        key: "surface",
        label: "Surface",
        type: "select",
        default: "sombrero",
        choices: [
          ...SURFACES.map((s) => ({ id: s.id, label: s.label })),
          { id: "custom", label: "Your own (below)" },
        ],
      },
      // Your own surface, as typed (set from the panel, not shown).
      { key: "eq", label: "Your surface", type: "text", default: "", hidden: true },
    ],
    input: SURFACE_INPUT,
    drag: plotSliderDrag("surface-plotter"),
    controls: [
      { key: "a", label: "a", type: "slider", default: 0.5 },
      { key: "rise", label: "Rise", type: "pulse", ease: 5 },
    ],
    action: { key: "rise", label: "Raise it" },
    // A tap lays the surface flat, then it rises out of the sheet (its
    // colours are its heights) and overshoots a little; then its parameter
    // a plays, so it ripples, twists or breathes, and settles (5 s). As with
    // the graph plotter, the surface is built once at rest (morphing to the
    // flat sheet on channel 0) and once at each of nine values of a, each
    // copy morphing into the next on channel 1.
    drive(t, c, out, info) {
      const g = info?.data?.surface;
      if (!g) return;
      const T = 5;
      const e = since(c, "rise", T);
      const on = e >= 0;
      // Flat: 1. Down fast, a pause, then up with a small overshoot.
      let flat = 0;
      if (on) {
        if (e < 0.25) flat = easeInOut(e / 0.25);
        else if (e < 0.45) flat = 1;
        else {
          const x = band(e, 0.45, 2.1);
          flat = 1 - easeInOut(x) - 0.07 * Math.sin(Math.PI * band(e, 1.6, 2.3));
        }
      }
      const base = clamp01(c.a ?? 0.5);
      let u = base;
      let sweeping = false;
      if (on && g.usesA) {
        const x = band(e, 2.3, T - 0.15);
        if (x > 0 && x < 1) {
          sweeping = true;
          const w = easeInOut(x);
          if (g.cycle) u = (base + w) % 1;
          else {
            const s = Math.sin(TAU * w);
            u = s > 0 ? base + (1 - base) * s : base + base * s;
          }
        }
      }
      const showRest = !g.usesA || (on && e < 2.3) || (!sweeping && Math.abs(u - 0.5) < 1e-4);
      const j = Math.min(SWEEP_KNOTS - 1, Math.floor(u * SWEEP_KNOTS));
      const frac = clamp01(u * SWEEP_KNOTS - j);
      out.parts.surface = { visible: showRest ? 1 : 0 };
      for (let i = 0; i < g.copies; i++) out.parts[`sweep${i}`] = { visible: !showRest && i === j ? 1 : 0 }; // prettier-ignore
      out.morph = [showRest ? flat : 0, showRest ? 0 : frac, 0, 0];
      if (g.usesA) {
        out.parts.knob = { offset: [(u - 0.5) * SLIDER_LEN, 0, 0] };
        sortKnob(out, info, u);
      }
    },
    build(k, o) {
      const g = surfacePlot(o);
      SURF_SHOWN.label = `${g.spec.id === "custom" ? "Your surface" : g.spec.label}: ${g.spec.eq}`;
      const copies = g.usesA ? SWEEP_KNOTS : 0;
      k.data = { surface: { usesA: g.usesA, cycle: g.cycle, copies } };
      const step = niceStep(g.dx[1] - g.dx[0], 12);
      const gridStep = [step / (g.dx[1] - g.dx[0]), step / (g.dy[1] - g.dy[0])];
      const gridOff = [(-g.dx[0] / step) % 1, (-g.dy[0] / step) % 1];
      // Coloured by height, with a fine mesh of darker lines, two-sided. A
      // point off the plot is marked `bad` (a hole).
      const look = (c) => {
        if (c.s.p.bad) return null;
        let col = ramp(SURF_RAMP, (c.p[1] + SURF_H) / (2 * SURF_H));
        // The mesh lines darker, in full-size splats (smaller ones left
        // pinholes that read as grain).
        return lit(col, c.n, { amb: 0.66, dif: 0.42, spec: 0.22, two: true });
      };
      // The mesh lines: thin tubes along the surface, in splats drawn out
      // along them, so each reads as one crisp, unbroken line (lane
      // Sharpness B; as darker splats of the surface they broke into
      // dashes). A tube is cut where the surface has a hole. `next` is the
      // value of a it morphs to (channel 1), or null to flatten (channel 0).
      const lineU = [];
      const lineV = [];
      for (let n = -1; n <= 40; n++) {
        const U = (n + gridOff[0]) * gridStep[0];
        const V = (n + gridOff[1]) * gridStep[1];
        if (U > 0.002 && U < 0.998) lineU.push(U);
        if (V > 0.002 && V < 0.998) lineV.push(V);
      }
      const meshLines = (a, opts, next) => {
        const runs = [];
        const N = 160;
        for (const [fixed, list] of [
          [0, lineU],
          [1, lineV],
        ])
          for (const L of list) {
            let run = [];
            for (let i = 0; i <= N; i++) {
              const w = i / N;
              const [U, V] = fixed === 0 ? [L, w] : [w, L];
              const p = g.point(U, V, a);
              if (p) run.push({ p, U, V });
              if ((!p || i === N) && run.length > 1) runs.push(run);
              if (!p) run = [];
            }
          }
        for (const run of runs) {
          const at = (c) => run[Math.min(run.length - 1, Math.round(c.s.at))];
          k.add(
            polyTube(
              run.map((r) => r.p),
              0.0035,
            ),
            {
              ...opts,
              even: true,
              opacity: 1,
              jitter: 0.01,
              size: 0.65,
              flat: 0.6,
              stretch: 2.5,
              pattern: false,
              to: (c) => {
                const r = at(c);
                const q =
                  next === null ? [r.p[0], g.floorY, r.p[2]] : g.point(r.U, r.V, next) || r.p;
                return add(q, sub(c.p, r.p));
              },
              color: (c) => {
                const y = at(c).p[1];
                const col = shade(ramp(SURF_RAMP, (y + SURF_H) / (2 * SURF_H)), 0.62);
                return lit(col, c.n, { amb: 0.8, dif: 0.25, spec: 0, two: true });
              },
            },
          );
        }
      };
      // Normals from a grid of heights (cheaper than asking the equation
      // twice more for every splat).
      const G = 90;
      const sheet = (a) => {
        const H = new Float64Array((G + 1) * (G + 1));
        for (let j = 0; j <= G; j++)
          for (let i = 0; i <= G; i++)
            H[j * (G + 1) + i] = g.point(i / G, j / G, a)?.[1] ?? g.floorY;
        const h = (i, j) => H[Math.min(G, Math.max(0, j)) * (G + 1) + Math.min(G, Math.max(0, i))];
        const normal = (u, v) => {
          const i = Math.round(u * G);
          const j = Math.round(v * G);
          const dx = (h(i + 1, j) - h(i - 1, j)) / (4 / G); // per unit of X
          const dz = (h(i, j + 1) - h(i, j - 1)) / (4 / G); // per unit of -Z
          return [-dx, 1, dz];
        };
        return k.param(
          (U, V) => {
            const p = g.point(U, V, a);
            if (p) return p;
            const q = [U * 2 - 1, g.floorY, 1 - V * 2];
            q.bad = true;
            return q;
          },
          { grid: G, normal },
        );
      };
      // At rest; it morphs down to the flat sheet on channel 0.
      k.add(sheet(g.A[1]), {
        part: k.part("surface"),
        flat: 0.35,
        even: true,
        opacity: 1,
        jitter: 0.01,
        channel: 0,
        to: (c) => [c.p[0], g.floorY, c.p[2]],
        color: look,
      });
      meshLines(g.A[1], { part: k.part("surface"), channel: 0, weight: 1.2 }, null);
      for (let j = 0; j < copies; j++) {
        const next = g.knots[j + 1];
        k.add(sheet(g.knots[j]), {
          part: k.part(`sweep${j}`),
          weight: 0.9,
          size: 1.2,
          flat: 0.4,
          even: true,
          jitter: 0.01,
          channel: 1,
          to: (c) => g.point(c.u, c.v, next),
          color: look,
        });
        meshLines(g.knots[j], { part: k.part(`sweep${j}`), channel: 1, weight: 1.1 }, next);
      }
      // A dark base plate under it, and the a slider in front.
      const baseY = -SURF_H - 0.12;
      // (Evenly laid and as dense as the rest, so the plate and its rim
      // read crisp.)
      k.add(evenBox(2.2, 0.05, 2.2), {
        pos: [0, baseY, 0],
        weight: 1.6,
        size: 1.1,
        even: true,
        opacity: 1,
        jitter: 0.008,
        flat: 0.2,
        color: (c) => {
          const edge = Math.min(1.1 - Math.abs(c.p[0]), 1.1 - Math.abs(c.p[2]));
          const col = lit(edge < 0.06 ? "#4a5874" : "#1c2536", c.n, { amb: 0.75, dif: 0.3, spec: 0 }); // prettier-ignore
          return col;
        },
      });
      PLOT_SLIDERS["surface-plotter"] = g.usesA ? [0.12, baseY - 0.05, 1.22] : null;
      if (g.usesA) plotSlider(k, PLOT_SLIDERS["surface-plotter"], { exact: true });
    },
  },
});

// A wave (or any path) drawn as a ribbon of splats, sampled by length:
// samples carry f, the fraction along it.
function pathRibbon(fn, n, width) {
  const pts = Array.from({ length: n + 1 }, (_, i) => fn(i / n));
  const cum = [0];
  for (let i = 1; i <= n; i++) cum.push(cum[i - 1] + len(sub(pts[i], pts[i - 1])));
  const L = cum[n];
  return {
    area: L * width,
    thick: width / 2,
    sample(rand) {
      const s = rand() * L;
      let lo = 0;
      let hi = n;
      while (hi - lo > 1) {
        const mid = (lo + hi) >> 1;
        if (cum[mid] <= s) lo = mid;
        else hi = mid;
      }
      const f = (s - cum[lo]) / (cum[hi] - cum[lo] || 1);
      const a = pts[lo];
      const b = pts[hi];
      const d = unit(sub(b, a));
      const w = (rand() - 0.5) * width;
      return {
        p: [a[0] + (b[0] - a[0]) * f - d[1] * w, a[1] + (b[1] - a[1]) * f + d[0] * w, a[2]],
        n: [0, 0, 1],
        f: (lo + f) / n,
        tangent: d,
      };
    },
  };
}

// ---- Circle and waves ---------------------------------------------------------------

// A point runs round a path (the unit circle by default) while its shadows
// unroll as waves: its height is the sine wave, its left-right place the
// cosine wave. In 2D they sit on a wall to its right and a wall below it
// (the classic diagram); in 3D the point also runs back along a helix, and
// its shadows fall on the floor and a side wall. Euler's formula lights up
// term by term (for the circle).
const UC_C = [-0.62, 0.36, 0];
const UC_R = 0.44;
const UC_W = 1.45; // the length of each wave
const UC_SX = UC_C[0] + UC_R + 0.17; // where the sine wave starts
const UC_CY = UC_C[1] - UC_R - 0.17; // where the cosine wave starts
const UC_SIN = "#ff5d73";
const UC_COS = "#4dabf7";
// Euler's formula, and which characters make each term: e^(iθ), cos θ and
// i sin θ light up in turn.
const EULER = "e^{iθ} = cos θ + i sin θ";
const EULER_TERMS = [
  { from: 0, to: 2, at: 0.12, color: "#ffe08a" },
  { from: 6, to: 10, at: 0.42, color: UC_COS },
  { from: 14, to: 20, at: 0.72, color: UC_SIN },
];
// The paths: x(t) and y(t) for t in 0..2π, scaled so the bigger of |x|, |y|
// reaches 1.
const UC_PATHS = [
  { id: "circle", label: "Circle", eq: "x = cos t, y = sin t" },
  { id: "ellipse", label: "Ellipse", eq: "x = cos t, y = 0.6sin t" },
  { id: "eight", label: "Figure eight", eq: "x = sin t, y = sin(2t)" },
  { id: "cardioid", label: "Cardioid", eq: "r = 1 + cos θ" },
  { id: "rose", label: "Rose", eq: "r = cos(2θ)" },
];
const UC_SHOWN = { label: "" };
function ucPath(o) {
  let spec = UC_PATHS.find((p) => p.id === o.path) || UC_PATHS[0];
  let parsed = null;
  if (o.path === "custom") {
    try {
      parsed = readCurve(o.eq);
      spec = { id: "custom", label: "Your path", eq: o.eq };
    } catch {
      spec = UC_PATHS[0];
    }
  }
  const made = ucMake(parsed || readCurve(spec.eq));
  if (made) return { ...made, spec, circle: spec.id === "circle" };
  return { ...ucMake(readCurve(UC_PATHS[0].eq)), spec: UC_PATHS[0], circle: true };
}
// A path's x(t) and y(t), scaled; null when it can't go round.
function ucMake(parsed) {
  if (parsed.kind === "y") return null;
  const raw = (t) => {
    const p = curvePoint(parsed, t, 1, 1);
    return p || [NaN, NaN];
  };
  let m = 0;
  for (let i = 0; i <= 720; i++) {
    const p = raw((TAU * i) / 720);
    if (!Number.isFinite(p[0] + p[1])) return null;
    m = Math.max(m, Math.abs(p[0]), Math.abs(p[1]));
  }
  if (!(m > 1e-6)) return null;
  return { x: (t) => raw(t)[0] / m, y: (t) => raw(t)[1] / m };
}
const UC_INPUT = {
  title: "Your own path",
  placeholder: "x = cos t, y = sin 2t, or r = 1 + cos θ",
  button: "Go round it",
  fileButton: "Open a text file…",
  accept: ".txt",
  note: "Type a path the point runs round: x = …, y = … with t from 0 to 2π, or r = … with θ. Its height draws the red wave and its left-right place the blue one. Use + − × ÷ ^, brackets, sin, cos, tan, exp, log, √, abs, pi and e.",
  async read(text) {
    const parsed = readCurve(text);
    if (parsed.kind === "y")
      throw new EquationError("type a path that goes round: x = …, y = … with t, or r = … with θ.");
    if (!ucMake(parsed))
      throw new EquationError("it has to stay finite all the way round (t from 0 to 2π).");
    return { path: "custom", eq: asciiEquation(text) };
  },
  shown: () => UC_SHOWN.label,
};

// The 3D view's layout, before it is turned to face the camera.
const UC3_R = 0.5;
const UC3_D = 1.9; // how far back the helix runs
const UC3_FLOOR = -UC3_R - 0.14;
const UC3_WALL = UC3_R + 0.14;
const UC3_Q = quatMul(quatAxisAngle([1, 0, 0], 0.32), quatAxisAngle([0, 1, 0], 0.75));
const uc3 = (p) => quatRotate(UC3_Q, [p[0], p[1] - 0.05, p[2] + UC3_D / 2]);

// A path as a ribbon lying in a plane with normal N (or, for a path in
// space, facing N), sampled by length: samples carry f, the fraction along.
function ribbon3(fn, n, width, N) {
  const pts = Array.from({ length: n + 1 }, (_, i) => fn(i / n));
  const cum = [0];
  for (let i = 1; i <= n; i++) cum.push(cum[i - 1] + len(sub(pts[i], pts[i - 1])));
  const L = cum[n];
  return {
    area: L * width,
    thick: width / 2,
    sample(rand) {
      const s = rand() * L;
      let lo = 0;
      let hi = n;
      while (hi - lo > 1) {
        const mid = (lo + hi) >> 1;
        if (cum[mid] <= s) lo = mid;
        else hi = mid;
      }
      const f = (s - cum[lo]) / (cum[hi] - cum[lo] || 1);
      const a = pts[lo];
      const b = pts[hi];
      const d = unit(sub(b, a));
      let side = cross(N, d);
      if (len(side) < 1e-6) side = cross([0, 1, 0], d);
      side = unit(side);
      const w = (rand() - 0.5) * width;
      return { p: add(add(a, mul(sub(b, a), f)), mul(side, w)), n: N, f: (lo + f) / n, tangent: d };
    },
  };
}

Object.assign(RECIPES, {
  "unit-circle": {
    alive: true,
    options: [
      {
        key: "view",
        label: "View",
        type: "select",
        default: "2d",
        choices: [
          { id: "2d", label: "2D diagram" },
          { id: "3d", label: "3D helix" },
        ],
      },
      {
        key: "path",
        label: "Path",
        type: "select",
        default: "circle",
        choices: [...UC_PATHS.map((p) => ({ id: p.id, label: p.label })), { id: "custom", label: "Your own (below)" }], // prettier-ignore
      },
      { key: "turns", label: "Turns", type: "slider", min: 1, max: 3, step: 1, default: 1 },
      // Your own path, as typed (set from the panel, not shown).
      { key: "eq", label: "Your path", type: "text", default: "", hidden: true },
    ],
    input: UC_INPUT,
    controls: [{ key: "turn", label: "Turn", type: "pulse", ease: 5 }],
    action: { key: "turn", label: "Go round" },
    // A tap sends the point round the path (the Turns option: once to three
    // times), its radius sweeping with it; its height draws the sine wave
    // and its left-right place the cosine wave, and for the circle
    // e^(iθ) = cos θ + i sin θ lights up term by term in the waves' colors
    // (5 s). In 3D the point also runs back along a helix whose shadows are
    // the two waves, on the floor and the side wall. The point, the heads
    // and the middle are tokens; the radius and the dotted guides are
    // skinned between them, and the waves appear behind their heads on
    // channel 0.
    drive(t, c, out, info) {
      const d = info?.data?.uc;
      if (!d) return;
      const T = 5;
      const e = since(c, "turn", T);
      const on = e >= 0;
      const f = on ? easeInOut(band(e, 0.3, 4.1)) : 0;
      const end = TAU * d.turns;
      const th = end * f;
      const running = on && e < 4.15;
      // The heads ride the waves; at rest they wait at the far end (where
      // the turns leave them).
      const hth = on ? th : end;
      const P = d.place;
      out.tokens = [
        { offset: sub(P.point(th), P.point(0)) },
        { offset: sub(P.a(hth), P.a(end)) },
        { offset: sub(P.b(hth), P.b(end)) },
        {},
        { offset: d.three ? sub(P.c(hth), P.c(end)) : [0, 0, 0] },
      ];
      // Channel 0 wipes and redraws the waves; channel 3 lights the terms.
      out.morph = [running && f < 1 ? 1.002 - f : 0, 0, 0, on ? band(e, 0.35, 3.2) * (1 - band(e, 4.3, 4.95)) : 0]; // prettier-ignore
      // In 3D the heads travel in depth: sorted again as they go.
      if (d.three) {
        const m = mem(c);
        const step = on ? Math.floor(e * 4) : -1;
        if (step !== m.sortStep) {
          if (m.sortStep !== undefined) out.resort = true;
          m.sortStep = step;
        }
      }
    },
    build(k, o) {
      const path = ucPath(o);
      UC_SHOWN.label = `${path.spec.label}: ${path.spec.eq}`;
      const turns = Math.max(1, Math.min(3, Math.round(o.turns ?? 1)));
      const three = o.view === "3d";
      const end = TAU * turns;
      // Where things are, as functions of θ: the point, the heads of the
      // waves (a: sine, b: cosine, c: the helix in 3D) and the middle.
      let place;
      if (!three) {
        const [cx, cy] = UC_C;
        place = {
          mid: [cx, cy, 0.035],
          point: (th) => [cx + UC_R * path.x(th), cy + UC_R * path.y(th), 0.03],
          a: (th) => [UC_SX + (UC_W * th) / end, cy + UC_R * path.y(th), 0.03],
          b: (th) => [cx + UC_R * path.x(th), UC_CY - (UC_W * th) / end, 0.03],
          c: () => [0, 0, 0],
        };
      } else {
        const z = (th) => (-UC3_D * th) / end;
        place = {
          mid: uc3([0, 0, 0.01]),
          point: (th) => uc3([UC3_R * path.x(th), UC3_R * path.y(th), 0.01]),
          a: (th) => uc3([UC3_WALL - 0.01, UC3_R * path.y(th), z(th)]),
          b: (th) => uc3([UC3_R * path.x(th), UC3_FLOOR + 0.01, z(th)]),
          c: (th) => uc3([UC3_R * path.x(th), UC3_R * path.y(th), z(th)]),
        };
      }
      k.data = { uc: { three, turns, place } };
      const P = place;
      const faceN = three ? quatRotate(UC3_Q, [0, 0, 1]) : [0, 0, 1];
      const line = (a, b, col, N = faceN, w = 0.008) =>
        k.add(ribbon3((f) => add(a, mul(sub(b, a), f)), 8, w, N), { weight: 2, flat: 0.3, stretch: 2, pattern: false, color: col }); // prettier-ignore
      if (!three) {
        // Two walls and the circle's own panel, dark slate.
        const panel = (x0, x1, y0, y1) =>
          k.add(k.box(x1 - x0, y1 - y0, 0.04), {
            pos: [(x0 + x1) / 2, (y0 + y1) / 2, -0.03],
            weight: 0.5,
            flat: 0.15,
            jitter: 0.01,
            color: (c) =>
              c.s.face === 4 ? mix("#151d2e", "#1f2a42", 0.5 + 0.5 * c.p[1]) : "#2f3b55",
          });
        const [cx, cy] = UC_C;
        panel(cx - UC_R - 0.12, cx + UC_R + 0.12, cy - UC_R - 0.12, cy + UC_R + 0.12);
        panel(UC_SX - 0.06, UC_SX + UC_W + 0.06, cy - UC_R - 0.12, cy + UC_R + 0.12);
        panel(cx - UC_R - 0.12, cx + UC_R + 0.12, UC_CY - UC_W - 0.06, UC_CY + 0.06);
        // Axes: through the circle, and each wave's middle line, with a
        // tick every quarter turn.
        const g = "#56688c";
        line([cx - UC_R - 0.08, cy, 0.01], [cx + UC_R + 0.08, cy, 0.01], g);
        line([cx, cy - UC_R - 0.08, 0.01], [cx, cy + UC_R + 0.08, 0.01], g);
        line([UC_SX, cy, 0.01], [UC_SX + UC_W, cy, 0.01], g);
        line([cx, UC_CY, 0.01], [cx, UC_CY - UC_W, 0.01], g);
        for (let q = 1; q <= 4 * turns; q++) {
          const x = UC_SX + (UC_W * q) / (4 * turns);
          line([x, cy - 0.03, 0.01], [x, cy + 0.03, 0.01], g);
          const y = UC_CY - (UC_W * q) / (4 * turns);
          line([cx - 0.03, y, 0.01], [cx + 0.03, y, 0.01], g);
        }
      } else {
        // The floor and the side wall the shadows fall on, and the axes.
        const floorN = quatRotate(UC3_Q, [0, 1, 0]);
        const wallN = quatRotate(UC3_Q, [-1, 0, 0]);
        const slab = (size, at, N) =>
          k.add(k.box(...size), {
            pos: uc3(at),
            quat: UC3_Q,
            weight: 0.5,
            flat: 0.15,
            jitter: 0.01,
            color: (c) => (dot(c.n, N) > 0.9 ? mix("#151d2e", "#22304c", 0.5 + 0.4 * c.p[1]) : "#2f3b55"), // prettier-ignore
          });
        const x0 = -UC3_R - 0.14;
        const zs = [-UC3_D - 0.12, 0.14];
        slab([UC3_WALL - x0, 0.03, zs[1] - zs[0]], [(UC3_WALL + x0) / 2, UC3_FLOOR - 0.015, (zs[0] + zs[1]) / 2], floorN); // prettier-ignore
        slab([0.03, UC3_R + 0.2 - UC3_FLOOR, zs[1] - zs[0]], [UC3_WALL + 0.015, (UC3_R + 0.2 + UC3_FLOOR) / 2, (zs[0] + zs[1]) / 2], wallN); // prettier-ignore
        const g = "#56688c";
        line(uc3([-UC3_R - 0.08, 0, 0]), uc3([UC3_R + 0.08, 0, 0]), g);
        line(uc3([0, -UC3_R - 0.08, 0]), uc3([0, UC3_R + 0.08, 0]), g);
        line(uc3([0, 0, 0]), uc3([0, 0, -UC3_D]), g, faceN, 0.006);
        line(uc3([0, UC3_FLOOR + 0.005, 0]), uc3([0, UC3_FLOOR + 0.005, -UC3_D]), g, floorN);
        line(uc3([UC3_WALL - 0.005, 0, 0]), uc3([UC3_WALL - 0.005, 0, -UC3_D]), g, wallN);
      }
      // The path (the circle).
      k.add(
        ribbon3((f) => P.point(TAU * f), 200, 0.022, faceN),
        {
          weight: 2,
          size: 1.5,
          flat: 0.4,
          stretch: 1.5,
          pattern: false,
          color: (c) => keep(mix("#e9ecf5", "#ffffff", 0.3 + 0.3 * Math.sin(c.s.f * TAU))),
        },
      );
      // The radius, from the middle (token 3) to the point (token 0).
      k.add(
        ribbon3((f) => add(P.mid, mul(sub(P.point(0), P.mid), f)), 20, 0.014, faceN),
        {
          weight: 2,
          size: 1.4,
          flat: 0.6,
          skin: (c) => [3, 0, c.s.f],
          pattern: false,
          color: "#ffe08a",
        },
      );
      // The waves (and the helix), drawn behind their heads on channel 0.
      const wave = (fn, col, N) =>
        k.add(
          ribbon3((f) => fn(end * f), 240 * turns, 0.024, N),
          {
            weight: 2.5,
            size: 1.4,
            flat: 0.5,
            stretch: 1.4,
            kind: "fade",
            params: (c) => [1.002 - c.s.f, 0.004],
            channel: 0,
            pattern: false,
            color: (c) => keep(shade(col, 0.95 + 0.15 * Math.sin(c.s.f * 20))),
          },
        );
      wave(P.a, UC_SIN, three ? quatRotate(UC3_Q, [-1, 0, 0]) : faceN);
      wave(P.b, UC_COS, three ? quatRotate(UC3_Q, [0, 1, 0]) : faceN);
      if (three) wave(P.c, "#ffe08a", faceN);
      // The point, the heads and the middle (tokens 0 to 4).
      const bead = (at, i, col, r) =>
        k.add(k.sphere(r), {
          pos: at,
          weight: 4,
          kind: "token",
          params: [i, 0],
          pattern: false,
          color: (c) => keep(mix(col, "#ffffff", 0.35 * Math.max(0, dot(c.n, HALF)))),
        });
      bead(P.point(0), 0, "#ffe08a", 0.042);
      bead(P.a(end), 1, UC_SIN, 0.034);
      bead(P.b(end), 2, UC_COS, 0.034);
      bead(P.mid, 3, "#c9d3e8", 0.016);
      if (three) bead(P.c(end), 4, "#ffe08a", 0.036);
      // Dotted guides between them (skinned).
      const guide = (a, b, i, j, col) =>
        k.cloud({ count: 70, pattern: false }, (rand, n, N) => {
          const s = (n + 0.5) / N;
          return { p: add(a, mul(sub(b, a), s)), color: col, opacity: 0.8, size: 1.1, skin: [i, j, s] }; // prettier-ignore
        });
      if (!three) {
        guide(P.point(0), P.a(end), 0, 1, "#ff9aa8");
        guide(P.point(0), P.b(end), 0, 2, "#9dd0ff");
      } else {
        guide(P.point(0), P.c(end), 0, 4, "#ffe9a8");
        guide(P.c(end), P.a(end), 4, 1, "#ff9aa8");
        guide(P.c(end), P.b(end), 4, 2, "#9dd0ff");
      }
      // Euler's formula (for the circle): dim, with a bright copy of each
      // term that fades in on channel 3.
      if (!path.circle) return;
      const h = 0.1;
      const { pixels, width } = textPixels(EULER, [0, 0, 0], h);
      const at = three
        ? (p) => uc3([p[0] - width / 2 - 0.1, p[1] + UC3_FLOOR - 0.2, 0.3 + p[2]])
        : (p) => [p[0] + UC_SX + (UC_W - width) / 2 + 0.02, p[1] + UC_CY - 0.62, 0.02 + p[2]];
      const placed = pixels.map((px) => ({ ...px, p: at(px.p) }));
      textCloud(k, placed, {}, () => ({ color: "#5d6b88", n: faceN }));
      EULER_TERMS.forEach((term) => {
        const lit3 = pixels
          .filter((px) => px.char >= term.from && px.char <= term.to)
          .map((px) => ({ ...px, p: at([px.p[0], px.p[1], 0.01]) }));
        textCloud(k, lit3, {}, () => ({ color: term.color, n: faceN, kind: "fade", params: [term.at, -0.06], channel: 3 })); // prettier-ignore
      });
    },
  },
});

// ---- Fourier circles ----------------------------------------------------------------

// Chains of spinning circles, each riding on the rim of the one before; the
// tip of each chain draws a shape. One chain draws a heart, a star, a square
// wave or your own curve; for words, each letter has its own chain.
const FOURIER_MAX = 60;
const FOURIER_TOKENS = 46; // circles 0..45 are tokens, the rest parts
const FOURIER_TIP = 46; // the glowing tip of a single chain (a token)
const FOURIER_HEAD = 47; // the wave's head (a token)
const FOURIER_WORD_MAX = 6; // letters in a word
// Letters as single strokes on a grid 4 wide and 6 tall (a stroke may run
// back over itself); a chain draws the stroke there and back.
const STROKES = {
  A: [
    [0, 0],
    [2, 6],
    [4, 0],
    [3.33, 2],
    [0.67, 2],
  ],
  B: [
    [0, 0],
    [0, 6],
    [3, 6],
    [4, 5],
    [4, 4],
    [3, 3],
    [0, 3],
    [3, 3],
    [4, 2],
    [4, 1],
    [3, 0],
    [0, 0],
  ],
  C: [
    [4, 5],
    [3, 6],
    [1, 6],
    [0, 5],
    [0, 1],
    [1, 0],
    [3, 0],
    [4, 1],
  ],
  D: [
    [0, 0],
    [0, 6],
    [2.5, 6],
    [4, 4.5],
    [4, 1.5],
    [2.5, 0],
    [0, 0],
  ],
  E: [
    [4, 6],
    [0, 6],
    [0, 3],
    [3, 3],
    [0, 3],
    [0, 0],
    [4, 0],
  ],
  F: [
    [4, 6],
    [0, 6],
    [0, 3],
    [3, 3],
    [0, 3],
    [0, 0],
  ],
  G: [
    [4, 5],
    [3, 6],
    [1, 6],
    [0, 5],
    [0, 1],
    [1, 0],
    [3, 0],
    [4, 1],
    [4, 3],
    [2, 3],
  ],
  H: [
    [0, 6],
    [0, 0],
    [0, 3],
    [4, 3],
    [4, 6],
    [4, 0],
  ],
  I: [
    [1, 6],
    [3, 6],
    [2, 6],
    [2, 0],
    [1, 0],
    [3, 0],
  ],
  J: [
    [1, 6],
    [4, 6],
    [3, 6],
    [3, 1],
    [2, 0],
    [1, 0],
    [0, 1],
  ],
  K: [
    [0, 6],
    [0, 0],
    [0, 2],
    [4, 6],
    [1.5, 3.5],
    [4, 0],
  ],
  L: [
    [0, 6],
    [0, 0],
    [4, 0],
  ],
  M: [
    [0, 0],
    [0, 6],
    [2, 3],
    [4, 6],
    [4, 0],
  ],
  N: [
    [0, 0],
    [0, 6],
    [4, 0],
    [4, 6],
  ],
  O: [
    [1, 0],
    [0, 1],
    [0, 5],
    [1, 6],
    [3, 6],
    [4, 5],
    [4, 1],
    [3, 0],
    [1, 0],
  ],
  P: [
    [0, 0],
    [0, 6],
    [3, 6],
    [4, 5],
    [4, 4],
    [3, 3],
    [0, 3],
  ],
  Q: [
    [3, 0],
    [1, 0],
    [0, 1],
    [0, 5],
    [1, 6],
    [3, 6],
    [4, 5],
    [4, 1],
    [3, 0],
    [4, -0.8],
  ],
  R: [
    [0, 0],
    [0, 6],
    [3, 6],
    [4, 5],
    [4, 4],
    [3, 3],
    [0, 3],
    [1.5, 3],
    [4, 0],
  ],
  S: [
    [4, 5],
    [3, 6],
    [1, 6],
    [0, 5],
    [0, 4],
    [1, 3],
    [3, 3],
    [4, 2],
    [4, 1],
    [3, 0],
    [1, 0],
    [0, 1],
  ],
  T: [
    [0, 6],
    [4, 6],
    [2, 6],
    [2, 0],
  ],
  U: [
    [0, 6],
    [0, 1],
    [1, 0],
    [3, 0],
    [4, 1],
    [4, 6],
  ],
  V: [
    [0, 6],
    [2, 0],
    [4, 6],
  ],
  W: [
    [0, 6],
    [1, 0],
    [2, 4],
    [3, 0],
    [4, 6],
  ],
  X: [
    [0, 6],
    [4, 0],
    [2, 3],
    [0, 0],
    [4, 6],
  ],
  Y: [
    [0, 6],
    [2, 3],
    [4, 6],
    [2, 3],
    [2, 0],
  ],
  Z: [
    [0, 6],
    [4, 6],
    [0, 0],
    [4, 0],
  ],
  0: [
    [1, 0],
    [0, 1],
    [0, 5],
    [1, 6],
    [3, 6],
    [4, 5],
    [4, 1],
    [3, 0],
    [1, 0],
    [0, 1],
    [4, 5],
  ],
  1: [
    [1, 5],
    [2, 6],
    [2, 0],
    [1, 0],
    [3, 0],
  ],
  2: [
    [0, 5],
    [1, 6],
    [3, 6],
    [4, 5],
    [4, 4],
    [0, 0],
    [4, 0],
  ],
  3: [
    [0, 5],
    [1, 6],
    [3, 6],
    [4, 5],
    [4, 4],
    [3, 3],
    [1.5, 3],
    [3, 3],
    [4, 2],
    [4, 1],
    [3, 0],
    [1, 0],
    [0, 1],
  ],
  4: [
    [3, 0],
    [3, 6],
    [0, 2],
    [4, 2],
  ],
  5: [
    [4, 6],
    [0, 6],
    [0, 3.5],
    [3, 3.5],
    [4, 2.5],
    [4, 1],
    [3, 0],
    [1, 0],
    [0, 1],
  ],
  6: [
    [4, 5],
    [3, 6],
    [1, 6],
    [0, 5],
    [0, 1],
    [1, 0],
    [3, 0],
    [4, 1],
    [4, 2],
    [3, 3],
    [0, 3],
  ],
  7: [
    [0, 6],
    [4, 6],
    [1.5, 0],
  ],
  8: [
    [1, 3],
    [0, 4],
    [0, 5],
    [1, 6],
    [3, 6],
    [4, 5],
    [4, 4],
    [3, 3],
    [1, 3],
    [0, 2],
    [0, 1],
    [1, 0],
    [3, 0],
    [4, 1],
    [4, 2],
    [3, 3],
  ],
  9: [
    [4, 3],
    [1, 3],
    [0, 4],
    [0, 5],
    [1, 6],
    [3, 6],
    [4, 5],
    [4, 1],
    [3, 0],
    [1, 0],
    [0, 1],
  ],
};
// Typed text as it is kept: capitals, digits and spaces; hearts are "#" and
// stars "*" (so the text stays plain ASCII in links).
function fourierWord(text) {
  const t = String(text ?? "")
    .normalize("NFKC")
    .replace(/[❤♥💖💗💕💘💝💓💞🧡💛💚💙💜🤍🖤🤎❣]️?/gu, "#")
    .replace(/<3/g, "#")
    .replace(/[★☆⭐🌟✨✩✪✫✬✭✮✯✰]️?/gu, "*")
    .toUpperCase()
    .replace(/\s+/g, " ")
    .trim();
  return t;
}
// The closed path a character's chain draws (points in letter units, about
// 4 wide and 6 tall), or null for a character it can't draw.
function charPath(ch, M) {
  if (ch === "#")
    return fourierPath("heart", M).map(([x, y]) => [2 + x * 2.6, 3 + (y - 0.1) * 2.6]);
  if (ch === "*") return fourierPath("star", M).map(([x, y]) => [2 + x * 2.4, 3 + y * 2.4]);
  const s = STROKES[ch];
  if (!s) return null;
  // There and back again, evenly by length.
  const loop = [...s, ...s.slice(0, -1).reverse()];
  const cum = [0];
  for (let i = 1; i < loop.length; i++) cum.push(cum[i - 1] + Math.hypot(loop[i][0] - loop[i - 1][0], loop[i][1] - loop[i - 1][1])); // prettier-ignore
  const L = cum[cum.length - 1] || 1;
  const out = [];
  let j = 1;
  for (let i = 0; i < M; i++) {
    const d = (L * i) / M;
    while (j < cum.length - 1 && cum[j] < d) j++;
    const f = (d - cum[j - 1]) / (cum[j] - cum[j - 1] || 1);
    const a = loop[j - 1];
    const b = loop[j];
    out.push([a[0] + (b[0] - a[0]) * f, a[1] + (b[1] - a[1]) * f]);
  }
  return out;
}
// The shapes, as closed paths sampled evenly (heart and star), scaled to
// about 0.8 across.
function fourierPath(shape, M) {
  if (shape === "star") {
    const corners = [];
    for (let i = 0; i < 10; i++) {
      const a = Math.PI / 2 + (i * Math.PI) / 5;
      const r = i % 2 ? 0.36 : 0.9;
      corners.push([r * Math.cos(a), r * Math.sin(a)]);
    }
    const out = [];
    for (let i = 0; i < M; i++) {
      const f = (i / M) * 10;
      const k = Math.floor(f);
      const a = corners[k];
      const b = corners[(k + 1) % 10];
      out.push([a[0] + (b[0] - a[0]) * (f - k), a[1] + (b[1] - a[1]) * (f - k)]);
    }
    return out;
  }
  // The heart (the classic curve), traced from its top notch.
  return Array.from({ length: M }, (_, i) => {
    const t = (i / M) * TAU;
    const x = 16 * Math.sin(t) ** 3;
    const y = 13 * Math.cos(t) - 5 * Math.cos(2 * t) - 2 * Math.cos(3 * t) - Math.cos(4 * t);
    return [x / 19, y / 19 + 0.1];
  });
}
// The circles that draw a closed path (points evenly spaced in time):
// [{ r, f, ph }] biggest first, and the centre they hang from.
function fourierOf(pts, n) {
  const M = pts.length;
  const coef = [];
  for (let f = -M / 2; f < M / 2; f++) {
    let re = 0;
    let im = 0;
    for (let i = 0; i < M; i++) {
      const a = (-TAU * f * i) / M;
      const c = Math.cos(a);
      const s = Math.sin(a);
      re += pts[i][0] * c - pts[i][1] * s;
      im += pts[i][0] * s + pts[i][1] * c;
    }
    coef.push({ f, re: re / M, im: im / M });
  }
  const c0 = coef.find((c) => c.f === 0);
  const circles = coef
    .filter((c) => c.f !== 0)
    .map((c) => ({ r: Math.hypot(c.re, c.im), f: c.f, ph: Math.atan2(c.im, c.re) }))
    .sort((p, q) => q.r - p.r)
    .slice(0, n);
  return { circles, centre: [c0.re, c0.im] };
}
// A typed curve's closed path (t or θ from 0 to 2π), scaled to about 0.9
// across; null when it doesn't stay finite.
function fourierCurvePath(eq, M) {
  let parsed;
  try {
    parsed = readCurve(eq);
  } catch {
    return null;
  }
  if (parsed.kind === "y") return null;
  const pts = [];
  for (let i = 0; i < M; i++) {
    const p = curvePoint(parsed, (TAU * i) / M, 1, 1);
    if (!p) return null;
    pts.push(p);
  }
  const xs = pts.map((p) => p[0]);
  const ys = pts.map((p) => p[1]);
  const cx = (Math.max(...xs) + Math.min(...xs)) / 2;
  const cy = (Math.max(...ys) + Math.min(...ys)) / 2;
  const half = Math.max(Math.max(...xs) - Math.min(...xs), Math.max(...ys) - Math.min(...ys)) / 2;
  if (!(half > 1e-9)) return null;
  return pts.map(([x, y]) => [((x - cx) / half) * 0.9, ((y - cy) / half) * 0.9]);
}
// Everything a Fourier build draws: its chains ({ circles, centre }), and
// whether it is the square wave.
const FOURIER_CACHE = new Map();
function fourierSet(o) {
  const n = Math.max(3, Math.min(FOURIER_MAX, Math.round(o.circles ?? 12)));
  const key = `${o.shape}|${n}|${o.shape === "custom" ? o.eq : ""}|${o.shape === "words" ? o.words : ""}`; // prettier-ignore
  if (FOURIER_CACHE.has(key)) return FOURIER_CACHE.get(key);
  let set = null;
  if (o.shape === "wave") {
    // A square wave: odd harmonics with radii 4/(πk), riding on the left.
    const circles = Array.from({ length: n }, (_, i) => {
      const f = 2 * i + 1;
      return { r: (4 / (Math.PI * f)) * 0.3, f, ph: 0 };
    });
    set = { chains: [{ circles, centre: [-0.75, 0] }], wave: true, label: "Square wave" };
  } else if (o.shape === "custom") {
    const pts = fourierCurvePath(o.eq, 512);
    if (pts) set = { chains: [fourierOf(pts, n)], label: `Your curve: ${o.eq}` };
  } else if (o.shape === "words") {
    const word = fourierWord(o.words).slice(0, FOURIER_WORD_MAX + 4);
    const chars = [...word].filter((ch) => ch !== " ").slice(0, FOURIER_WORD_MAX);
    if (chars.length && chars.every((ch) => charPath(ch, 8))) {
      // Each letter gets its own chain; together at most 60 circles. A long
      // word (or words) goes on two lines.
      const per = Math.max(3, Math.min(n, Math.floor(FOURIER_MAX / chars.length)));
      const U = 0.14; // letter units to toy units
      let lines = word.split(" ").filter(Boolean);
      if (lines.length === 1 && chars.length > 3) {
        const cut = Math.ceil(chars.length / 2);
        lines = [chars.slice(0, cut).join(""), chars.slice(cut).join("")];
      } else if (lines.length > 2) lines = [lines[0], lines.slice(1).join("")];
      const chains = [];
      lines.forEach((line, row) => {
        const w = (line.length * 6 - 2) * U;
        const y = (lines.length - 1) * 4.5 - row * 9;
        [...line].forEach((ch, i) => {
          const pts = charPath(ch, 256).map(([px, py]) => [(i * 6 + px) * U - w / 2, (py - 3 + y) * U]); // prettier-ignore
          chains.push(fourierOf(pts, per));
        });
      });
      set = { chains, label: `Your words: ${word.replace(/#/g, "♥").replace(/\*/g, "★")}` };
    }
  }
  if (!set) {
    const shape = o.shape === "star" ? "star" : "heart";
    set = { chains: [fourierOf(fourierPath(shape, 512), n)], label: shape === "star" ? "Star" : "Heart" }; // prettier-ignore
  }
  if (FOURIER_CACHE.size > 40) FOURIER_CACHE.clear();
  FOURIER_CACHE.set(key, set);
  return set;
}
// Where each circle's centre is, and the tip, at θ (0..2π for one round).
function fourierChain(F, th) {
  let x = F.centre[0];
  let y = F.centre[1];
  const centres = [];
  for (const c of F.circles) {
    centres.push([x, y]);
    const a = c.f * th + c.ph;
    x += c.r * Math.cos(a);
    y += c.r * Math.sin(a);
  }
  return { centres, tip: [x, y] };
}
const WAVE_X0 = 0.05; // where the wave's trace starts
const WAVE_W = 1.35;
// The 3D view: circle i of a chain sits a little further forward than the
// one it rides on, and the whole is turned to face the camera from the side.
const FC3_Q = quatMul(quatAxisAngle([1, 0, 0], 0.3), quatAxisAngle([0, 1, 0], 0.5));
const FOURIER_SHOWN = { label: "" };
const FOURIER_INPUT = {
  title: "Your own shape",
  placeholder: "a word like RYAN, or x = cos t, y = sin 3t",
  button: "Draw it",
  fileButton: "Open a text file…",
  accept: ".txt",
  note: `Type a word (up to ${FOURIER_WORD_MAX} letters or digits; ♥ and ★ draw a heart and a star), and each letter gets its own chain of circles. Or type a closed curve: x = …, y = … with t from 0 to 2π, or r = … with θ.`,
  async read(text) {
    const typed = String(text ?? "").trim();
    if (typed.includes("=")) {
      const parsed = readCurve(typed);
      if (parsed.kind === "y")
        throw new EquationError("type a closed curve: x = …, y = … with t, or r = … with θ.");
      const eq = asciiEquation(typed);
      if (!fourierCurvePath(eq, 64))
        throw new EquationError("it has to stay finite all the way round (t from 0 to 2π).");
      return { shape: "custom", eq };
    }
    const word = fourierWord(typed);
    const chars = [...word].filter((ch) => ch !== " ");
    if (!chars.length) throw new Error("Type a word, or a curve like x = cos t, y = sin 3t.");
    const bad = chars.find((ch) => !charPath(ch, 8));
    if (bad) throw new Error(`“${bad}” can't be drawn: use letters, digits, ♥ and ★.`);
    if (chars.length > FOURIER_WORD_MAX)
      throw new Error(`That's more than ${FOURIER_WORD_MAX} letters; try a shorter word.`);
    return { shape: "words", words: word };
  },
  shown: () => FOURIER_SHOWN.label,
};

Object.assign(RECIPES, {
  "fourier-circles": {
    alive: true,
    options: [
      {
        key: "shape",
        label: "Shape",
        type: "select",
        default: "heart",
        choices: [
          { id: "heart", label: "Heart" },
          { id: "star", label: "Star" },
          { id: "wave", label: "Square wave" },
          { id: "words", label: "Your words (below)" },
          { id: "custom", label: "Your own curve (below)" },
        ],
      },
      {
        key: "view",
        label: "View",
        type: "select",
        default: "2d",
        choices: [
          { id: "2d", label: "2D" },
          { id: "3d", label: "3D (stacked)" },
        ],
      },
      { key: "circles", label: "Circles", type: "slider", min: 3, max: FOURIER_MAX, step: 1, default: 12 }, // prettier-ignore
      // Your own words or curve, as typed (set from the panel, not shown).
      { key: "words", label: "Your words", type: "text", default: "HELLO", hidden: true },
      { key: "eq", label: "Your curve", type: "text", default: "", hidden: true },
    ],
    input: FOURIER_INPUT,
    controls: [{ key: "spin", label: "Spin", type: "pulse", ease: 5 }],
    action: { key: "spin", label: "Spin the circles" },
    // A tap wipes the drawing and spins every chain of circles once round:
    // each circle turns at its own whole number of turns, riding on the rim
    // of the one before, and each chain's tip draws its shape again behind
    // it (for the square wave, the tip's height is carried across and drawn
    // out to the right). Few circles draw a wobbly shape, many a crisp one
    // (5 s). A word gives each letter its own chain. In 3D each circle sits
    // a step in front of the one it rides on. Circles 0 to 45 (over all the
    // chains) are tokens, the rest parts; the drawing appears on channel 0.
    drive(t, c, out, info) {
      const d = info?.data?.fourier;
      if (!d) return;
      const T = 5;
      const e = since(c, "spin", T);
      const on = e >= 0;
      const f = on ? easeInOut(band(e, 0.3, 4.6)) : 0;
      const th = TAU * f;
      const Q = d.three ? FC3_Q : [0, 0, 0, 1];
      const axis = quatRotate(Q, [0, 0, 1]);
      const tokens = [];
      let gi = 0;
      let restTip = null;
      let nowTip = null;
      d.set.chains.forEach((F) => {
        const now = fourierChain(F, th);
        const rest = fourierChain(F, 0);
        F.circles.forEach((ci, i) => {
          const off = quatRotate(Q, [now.centres[i][0] - rest.centres[i][0], now.centres[i][1] - rest.centres[i][1], 0]); // prettier-ignore
          const base = quatRotate(Q, [rest.centres[i][0], rest.centres[i][1], d.depth(i)]);
          if (gi < FOURIER_TOKENS)
            tokens[gi] = { base, quat: quatAxisAngle(axis, ci.f * th), offset: off }; // prettier-ignore
          else out.parts[`c${gi}`] = { angle: ci.f * th, offset: off };
          gi++;
        });
        restTip = rest.tip;
        nowTip = now.tip;
      });
      if (d.single) {
        tokens[FOURIER_TIP] = { offset: quatRotate(Q, [nowTip[0] - restTip[0], nowTip[1] - restTip[1], 0]) }; // prettier-ignore
        if (d.set.wave) {
          const head = [WAVE_X0 + WAVE_W * f, nowTip[1]];
          tokens[FOURIER_HEAD] = { offset: quatRotate(Q, [head[0] - WAVE_X0, head[1] - restTip[1], 0]) }; // prettier-ignore
        }
      }
      out.tokens = tokens;
      out.morph = [on && e < 4.65 && f < 1 ? 1.002 - f : 0, 0, 0, 0];
      // In 3D the rings turn out of the view's plane: sorted again as they go.
      if (d.three) {
        const m = mem(c);
        const step = on ? Math.floor(e * 4) : -1;
        if (step !== m.sortStep) {
          if (m.sortStep !== undefined) out.resort = true;
          m.sortStep = step;
        }
      }
    },
    build(k, o) {
      const set = fourierSet(o);
      FOURIER_SHOWN.label = set.label;
      const three = o.view === "3d";
      const Q = three ? FC3_Q : [0, 0, 0, 1];
      const N = quatRotate(Q, [0, 0, 1]);
      const single = set.chains.length === 1;
      // In 3D, circle i sits DZ in front of circle i - 1 (the drawing in
      // front of them all); flat in 2D.
      const most = Math.max(...set.chains.map((F) => F.circles.length));
      const DZ = three ? Math.min(0.03, 0.32 / most) : 0;
      const depth = (i) => (i - most) * DZ;
      k.data = { fourier: { set, three, single, depth } };
      const at = (p) => quatRotate(Q, p);
      const Z = 0.02;
      // A dark board behind it all, well behind the rings: they turn a long
      // way from where they were built (and sorted).
      const xs = [];
      const ys = [];
      for (const F of set.chains)
        for (let i = 0; i <= 64; i++) {
          const tip = fourierChain(F, (TAU * i) / 64).tip;
          xs.push(tip[0]);
          ys.push(tip[1]);
          const r = F.circles[0]?.r ?? 0;
          xs.push(F.centre[0] - r, F.centre[0] + r);
          ys.push(F.centre[1] - r, F.centre[1] + r);
        }
      if (set.wave) xs.push(WAVE_X0 + WAVE_W);
      // In 3D the drawing stands in front of the board: a wider board.
      if (three) xs.push(Math.max(...xs) + 0.25);
      const span = [Math.min(...xs) - 0.12, Math.max(...xs) + 0.12, Math.min(...ys) - 0.12, Math.max(...ys) + 0.12]; // prettier-ignore
      k.add(k.box(span[1] - span[0], span[3] - span[2], 0.04), {
        pos: at([
          (span[0] + span[1]) / 2,
          (span[2] + span[3]) / 2,
          depth(0) - (three ? 0.1 : 0.16),
        ]),
        quat: Q,
        weight: 0.4,
        flat: 0.15,
        jitter: 0.01,
        color: (c) => (dot(c.n, N) > 0.9 ? mix("#10172a", "#1b2540", 0.5 + 0.4 * c.p[1]) : "#2b3651"), // prettier-ignore
      });
      // Each circle: a thin ring and its arm (to where the next circle
      // rides, a step forward in 3D), built at rest; the last arm carries
      // the tip.
      let gi = 0;
      set.chains.forEach((F) => {
        const rest = fourierChain(F, 0);
        F.circles.forEach((ci, i) => {
          const [cx, cy] = rest.centres[i];
          const z = depth(i);
          const opt =
            gi < FOURIER_TOKENS
              ? { kind: "token", params: [gi, 0] }
              : { part: k.part(`c${gi}`, { pivot: at([cx, cy, z]), axis: N }) };
          const hue = ramp(["#7dd3fc", "#a5b4fc", "#c4b5fd", "#f0abfc"], Math.min(1, i / 20));
          const w = Math.max(0.004, Math.min(0.01, ci.r * 0.06));
          k.add(ribbon3((f) => at([cx + ci.r * Math.cos(TAU * f), cy + ci.r * Math.sin(TAU * f), z]), 96, w, N), { ...opt, weight: 1.6, size: 1.3, flat: 0.4, opacity: 0.7, pattern: false, color: shade(hue, 0.8) }); // prettier-ignore
          const a = at([cx, cy, z + 0.004]);
          const last = i === F.circles.length - 1;
          const b = at([cx + ci.r * Math.cos(ci.ph), cy + ci.r * Math.sin(ci.ph), last ? Z : depth(i + 1)]); // prettier-ignore
          k.add(ribbon3((f) => add(a, mul(sub(b, a), f)), 4, w * 1.4, N), { ...opt, weight: 2, size: 1.3, flat: 0.5, pattern: false, color: "#f1f5ff" }); // prettier-ignore
          // Several chains: each tip rides on its chain's last arm.
          if (last && !single)
            k.add(k.sphere(0.022), { ...opt, pos: add(b, mul(N, 0.01)), weight: 4, pattern: false, color: "#ffd166" }); // prettier-ignore
          gi++;
        });
      });
      // The drawings: the paths the tips really trace (so few circles draw
      // a wobbly shape), appearing behind them on channel 0.
      set.chains.forEach((F) => {
        const trace = set.wave
          ? (f) => at([WAVE_X0 + WAVE_W * f, fourierChain(F, TAU * f).tip[1], Z])
          : (f) => at([...fourierChain(F, TAU * f).tip, Z]);
        k.add(ribbon3(trace, 700, 0.026, N), {
          weight: 2.5,
          size: 1.4,
          flat: 0.5,
          stretch: 1.4,
          kind: "fade",
          params: (c) => [1.002 - c.s.f, 0.004],
          channel: 0,
          pattern: false,
          color: (c) => keep(ramp(["#ff6b6b", "#ff8fab", "#ffd166"], 0.5 - 0.5 * Math.cos(TAU * c.s.f))), // prettier-ignore
        });
      });
      if (!single) return;
      // One chain: its tip (a token), and for the wave its head and the
      // guide between them.
      const rest = fourierChain(set.chains[0], 0);
      const tip = at([...rest.tip, Z + 0.01]);
      k.add(k.sphere(0.03), { pos: tip, weight: 4, kind: "token", params: [FOURIER_TIP, 0], pattern: false, color: "#ffd166" }); // prettier-ignore
      if (set.wave) {
        const head = at([WAVE_X0, rest.tip[1], Z + 0.01]);
        k.add(k.sphere(0.026), { pos: head, weight: 4, kind: "token", params: [FOURIER_HEAD, 0], pattern: false, color: "#ff6b6b" }); // prettier-ignore
        k.cloud({ count: 60, pattern: false }, (rand, i, n) => {
          const s = (i + 0.5) / n;
          return { p: add(tip, mul(sub(head, tip), s)), color: "#ffd9a0", opacity: 0.7, skin: [FOURIER_TIP, FOURIER_HEAD, s] }; // prettier-ignore
        });
        // The wave's middle line.
        k.add(ribbon3((f) => at([WAVE_X0 + WAVE_W * f, 0, Z - 0.01]), 8, 0.006, N), { weight: 2, pattern: false, color: "#3b4d6e" }); // prettier-ignore
      }
    },
  },
});

// ---- Pythagoras proof ---------------------------------------------------------------

// Legs a = 3 and b = 4 (so c = 5) in a square of side a + b, scaled to 2
// across. The four right triangles first sit as two rectangles, leaving the
// squares a² and b² empty; slid into the corners they leave the tilted
// square c². In this arrangement no triangle needs to turn: three slide and
// one stays put.
const PY_A = 3;
const PY_B = 4;
const PY_S = PY_A + PY_B;
const PY_U = 2 / PY_S;
const pyP = (x, y, z = 0) => [(x - PY_S / 2) * PY_U, (y - PY_S / 2) * PY_U, z];
// Each triangle at rest: its right-angle corner R, the end of leg a (A) and
// of leg b (B); `move` slides it to its corner; `go` and `back` are when.
const PY_TRIS = [
  { R: [PY_A, 0], A: [PY_A, PY_A], B: [PY_S, 0], move: [-PY_A, 0], go: 0.3, back: 3.8, col: "#e8a33d" }, // prettier-ignore
  { R: [PY_S, PY_A], A: [PY_S, 0], B: [PY_A, PY_A], move: [0, PY_B], go: 1.3, back: 2.9, col: "#d9534f" }, // prettier-ignore
  { R: [PY_A, PY_A], A: [0, PY_A], B: [PY_A, PY_S], move: [PY_B, -PY_A], go: 0.8, back: 3.35, col: "#4a90d9" }, // prettier-ignore
  { R: [0, PY_S], A: [PY_A, PY_S], B: [0, PY_A], move: [0, 0], go: -1, back: -1, col: "#5cb85c" }, // prettier-ignore
];
const PY_SLIDE = 0.45;
const PY_THICK = 0.07;
const PY_CUES = [];
const PY_SORTS = [];
for (const tri of PY_TRIS) {
  if (tri.go < 0) continue;
  for (const [at, f] of [
    [tri.go, 700],
    [tri.back, 620],
  ]) {
    PY_CUES.push([at, { voice: "scrape", f, rate: 9, decay: 0.35, vol: 0.35 }]);
    PY_CUES.push([at + PY_SLIDE, { voice: "wood", f: 1100, decay: 0.6 }]);
    for (const f of [0.02, 0.2, 0.4, 0.6, 0.8, 1]) PY_SORTS.push(at + PY_SLIDE * f);
  }
}

Object.assign(RECIPES, {
  "pythagoras-proof": {
    alive: true,
    controls: [{ key: "prove", label: "Prove", type: "pulse", ease: 4.5 }],
    action: { key: "prove", label: "Rearrange" },
    // A tap slides the triangles one at a time, as solid wooden pieces
    // lifted a little off the board, from the two rectangles into the four
    // corners: the empty squares a² and b² fade and the tilted square c²
    // lights up in their place, with a² + b² = c² below; then they slide
    // back (4.5 s). Each landing clicks.
    drive(t, c, out) {
      const T = 4.5;
      const e = since(c, "prove", T);
      const on = e >= 0;
      const tokens = [];
      PY_TRIS.forEach((tri, i) => {
        let m = 0;
        if (on && tri.go >= 0) m = easeInOut(band(e, tri.go, tri.go + PY_SLIDE)) - easeInOut(band(e, tri.back, tri.back + PY_SLIDE)); // prettier-ignore
        const lift = on && tri.go >= 0 ? 0.07 * (Math.sin(Math.PI * band(e, tri.go, tri.go + PY_SLIDE)) + Math.sin(Math.PI * band(e, tri.back, tri.back + PY_SLIDE))) : 0; // prettier-ignore
        tokens[i] = { offset: [tri.move[0] * PY_U * m, tri.move[1] * PY_U * m, lift] };
      });
      out.tokens = tokens;
      // Sorted again where they stand a few times on each slide (they
      // cross the board, which would otherwise draw over them).
      const m = mem(c);
      const was = m.sortE ?? -1;
      m.sortE = e;
      if (e >= 0 && e >= was && PY_SORTS.some((at) => was < at && e >= at)) out.resort = true;
      if (!on && was >= 0) out.resort = true;
      // Channel 1 clears a² and b²; channel 2 shows c² and the equation.
      out.morph = [0, on ? band(e, 0.3, 0.6) * (1 - band(e, 4.0, 4.35)) : 0, on ? band(e, 1.75, 2.05) * (1 - band(e, 2.75, 2.95)) : 0, 0]; // prettier-ignore
      cuesAt(c, e, PY_CUES, out);
    },
    build(k) {
      const z0 = 0;
      // The board and a raised wooden frame round the big square.
      const wood = (c, base) => lit(mix(base, shade(base, 0.85), 0.5 + 0.5 * Math.sin(c.p[0] * 40 + 3 * c.noise(c.p[0] * 3, c.p[1] * 8, 0))), c.n, { amb: 0.7, dif: 0.35, spec: 0.15 }); // prettier-ignore
      k.add(evenBox(2, 2, 0.04), {
        even: true,
        opacity: 1,
        pos: [0, 0, z0 - 0.02],
        weight: 0.7,
        flat: 0.15,
        jitter: 0.01,
        color: (c) =>
          c.s.face === 4
            ? mix("#f4ecd8", "#efe3c6", 0.5 + 0.5 * c.noise(c.p[0] * 4, c.p[1] * 4, 0))
            : "#c9b48a",
      });
      const F = 0.09;
      for (const [w, h, x, y] of [
        [2 + 2 * F, F, 0, 1 + F / 2],
        [2 + 2 * F, F, 0, -1 - F / 2],
        [F, 2, 1 + F / 2, 0],
        [F, 2, -1 - F / 2, 0],
      ])
        k.add(evenBox(w, h, 0.12),
{
opacity: 1,
pos: [x, y, z0 + 0.02],
weight: 1.2,
flat: 0.2,
jitter: 0.01,
even: true,
color: (c) => wood(c, "#8b5a2b"),
}); // prettier-ignore
      // The empty squares, tinted: a² and b² (fading on channel 1), and
      // the tilted c² (appearing on channel 2).
      const zt = z0 + 0.003;
      k.add(polyShape([pyP(0, 0, zt), pyP(PY_A, 0, zt), pyP(PY_A, PY_A, zt), pyP(0, PY_A, zt)]), {
        even: true,
        opacity: 1,
        weight: 1.2,
        flat: 0.15,
        jitter: 0.01,
        kind: "fade",
        params: [0.5, 0.3],
        channel: 1,
        pattern: false,
        // prettier-ignore
        color: (c) => (c.s.edge < 0.015 ? "#3d6fb0" : "#b9d3f2"),
      });
      k.add(
        polyShape([
          pyP(PY_A, PY_A, zt),
          pyP(PY_S, PY_A, zt),
          pyP(PY_S, PY_S, zt),
          pyP(PY_A, PY_S, zt),
        ]),
        {
          even: true,
          opacity: 1,
          // prettier-ignore
          weight: 1.2,
          flat: 0.15,
          jitter: 0.01,
          kind: "fade",
          params: [0.5, 0.3],
          channel: 1,
          pattern: false,
          // prettier-ignore
          color: (c) => (c.s.edge < 0.015 ? "#3f8f4a" : "#c3e6c3"),
        },
      );
      k.add(
        polyShape([
          pyP(PY_B, 0, zt + 0.002),
          pyP(PY_S, PY_B, zt + 0.002),
          pyP(PY_A, PY_S, zt + 0.002),
          pyP(0, PY_A, zt + 0.002),
        ]),
        {
          even: true,
          opacity: 1,
          // prettier-ignore
          weight: 1.2,
          flat: 0.15,
          jitter: 0.01,
          kind: "fade",
          params: [0.4, -0.3],
          channel: 2,
          pattern: false,
          // prettier-ignore
          color: (c) => (c.s.edge < 0.015 ? "#b8860b" : "#ffe7a3"),
        },
      );
      // Labels in the squares.
      const label = (text, x, y, col, fade) => {
        const { pixels, width } = textPixels(text, [0, 0, 0], 0.16);
        const placed = pixels.map((px) => ({ ...px, p: [px.p[0] + x - width / 2, px.p[1] + y, zt + 0.006] })); // prettier-ignore
        textCloud(k, placed, {}, () => ({ color: col, ...fade }));
      };
      label("a^{2}", ...pyP(PY_A / 2, PY_A / 2).slice(0, 2), "#23466f", { kind: "fade", params: [0.5, 0.3], channel: 1 }); // prettier-ignore
      label("b^{2}", ...pyP(PY_A + PY_B / 2, PY_A + PY_B / 2).slice(0, 2), "#2d5f33", { kind: "fade", params: [0.5, 0.3], channel: 1 }); // prettier-ignore
      label("c^{2}", 0, 0, "#7a5500", { kind: "fade", params: [0.4, -0.3], channel: 2 });
      // The equation under the board: dim, lit on channel 2.
      const eq = textPixels("a^{2} + b^{2} = c^{2}", [0, 0, 0], 0.13);
      const eqPx = eq.pixels.map((px) => ({ ...px, p: [px.p[0] - eq.width / 2, px.p[1] - 1.28, 0.02] })); // prettier-ignore
      textCloud(k, eqPx, {}, () => ({ color: "#6b6150" }));
      textCloud(k, eqPx.map((px) => ({ ...px, p: [px.p[0], px.p[1], 0.03] })), {}, () => ({ color: "#ffcf4a", kind: "fade", params: [0.4, -0.3], channel: 2 })); // prettier-ignore
      // The triangles: wooden slabs, each its own part, with a, b and c on
      // their sides.
      PY_TRIS.forEach((tri, i) => {
        const part = { kind: "token", params: [i, 0] };
        const zb = z0 + 0.01;
        const zt2 = zb + PY_THICK;
        const pts = [tri.R, tri.A, tri.B];
        // Shrunk a hair about their middle, so neighbours show a seam.
        const mid = [(pts[0][0] + pts[1][0] + pts[2][0]) / 3, (pts[0][1] + pts[1][1] + pts[2][1]) / 3]; // prettier-ignore
        const inset = (p) => [mid[0] + (p[0] - mid[0]) * 0.985, mid[1] + (p[1] - mid[1]) * 0.985];
        const P = pts.map(inset);
        const top = P.map((p) => pyP(p[0], p[1], zt2));
        // Wind the top towards the viewer.
        const n = cross(sub(top[1], top[0]), sub(top[2], top[0]));
        const topPts = n[2] > 0 ? top : [top[0], top[2], top[1]];
        k.add(polyShape(topPts), {
          even: true,
          opacity: 1,
          ...part,
          weight: 2,
          flat: 0.15,
          jitter: 0.01,
          color: (c) => {
            const col = mix(
              tri.col,
              shade(tri.col, 0.9),
              0.5 + 0.5 * Math.sin(c.p[0] * 30 + c.p[1] * 12),
            );
            return c.s.edge < 0.02 ? mix(col, "#ffffff", 0.35) : col;
          },
        });
        for (let j = 0; j < 3; j++) {
          const p = P[j];
          const q = P[(j + 1) % 3];
          const quad = [pyP(p[0], p[1], zb), pyP(q[0], q[1], zb), pyP(q[0], q[1], zt2), pyP(p[0], p[1], zt2)]; // prettier-ignore
          k.add(polyShape(quad),
{
even: true,
opacity: 1,
...part,
weight: 2,
flat: 0.15,
jitter: 0.01,
color: shade(tri.col, 0.7),
}); // prettier-ignore
        }
        // Side letters, just inside each side's middle.
        const place = (u, v, text) => {
          const m = [(u[0] + v[0]) / 2, (u[1] + v[1]) / 2];
          const at = [m[0] + (mid[0] - m[0]) * 0.32, m[1] + (mid[1] - m[1]) * 0.32];
          const { pixels, width } = textPixels(text, [0, 0, 0], 0.1);
          const w = pyP(at[0], at[1], zt2 + 0.004);
          const placed = pixels.map((px) => ({ ...px, p: [px.p[0] + w[0] - width / 2, px.p[1] + w[1], w[2]] })); // prettier-ignore
          textCloud(k, placed, {}, () => ({ color: "#ffffff", ...part }));
        };
        place(tri.R, tri.A, "a");
        place(tri.R, tri.B, "b");
        place(tri.A, tri.B, "c");
      });
    },
  },
});
