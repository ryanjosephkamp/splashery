// Lane Arcade: crisp shapes for the games (the owner's "please make sharper"
// of October 5, 2026). The kit scatters a shape's splats at random and sizes
// them from its whole budget, so a big flat board gets big soft splats, and
// its edges and thin lines fray into blobs. These shapes lay their splats on
// a regular grid instead, flat against each face: coarse splats fill the
// middle of a face, and a band of fine ones runs along every edge, so the
// edges come out straight and as sharp as the fine step, at a modest cost.
//
//   const m = crispModel((c) => {
//     c.rect(1.5, 2.1, { color: [0.1, 0.4, 0.3] });          // facing +z
//     c.box(0.3, 0.05, 0.06, { pos: [0, -0.9, 0.03], color: (p, n) => ... });
//     c.line([-0.7, 0, 0.001], [0.7, 0, 0.001], 0.012, { color: [1, 1, 1] });
//     c.sphere(0.035, { color });
//   }, { fine: 0.006, coarse: 0.03 });
//
// A color is [r, g, b] or a function (p, n) -> [r, g, b] (p the splat's
// place, n its face's outward normal), baked into the splat as the kit does.
// The result is a model for the layer's sprites (src/arcade/layer.js).
//
// Two layers on one plane (a line painted on a board) sort by their splats'
// centers, so keep them at least 0.005 apart, or the back one shows through.

import { makeModel, qfromto, qmul, qaxis } from "../arcade/layer.js";

const K = 0.6; // a splat's size against its grid cell: a solid fill, no seams
const THIN = 0.12; // its thickness against its cell

const sub = (a, b) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
const add = (a, b) => [a[0] + b[0], a[1] + b[1], a[2] + b[2]];
const mul = (a, s) => [a[0] * s, a[1] * s, a[2] * s];
const len = (a) => Math.hypot(a[0], a[1], a[2]);
const norm = (a) => mul(a, 1 / (len(a) || 1));
const cross = (a, b) => [
  a[1] * b[2] - a[2] * b[1],
  a[2] * b[0] - a[0] * b[2],
  a[0] * b[1] - a[1] * b[0],
];

// The turn that puts a splat's x along u and its z along n.
function frame(u, n) {
  const q1 = qfromto([0, 0, 1], n);
  // where x went after q1, then the turn about n that brings it onto u
  const x = rotate(q1, [1, 0, 0]);
  const y = cross(n, x);
  const a = Math.atan2(dot(u, y), dot(u, x));
  return qmul(qaxis(n, a), q1);
}
const dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
function rotate(q, v) {
  const [x, y, z, w] = q;
  const t = mul(cross([x, y, z], v), 2);
  return add(add(v, mul(t, w)), cross([x, y, z], t));
}

// Cuts a length L into cells: a fine band at each end (wide enough to cover
// the coarse cells' bleed, about a third of a cell) and coarse cells between,
// or all fine when it is short. Returns [center, cell size] pairs. radial:
// only the outer end gets a band (a disc's rim).
function cuts(L, fine, coarse, radial = false) {
  const band = Math.max(fine * 2, coarse * 0.35);
  const ends = radial ? 1 : 2;
  const out = [];
  const run = (a, len, step) => {
    const n = Math.max(1, Math.round(len / step));
    const s = len / n;
    for (let i = 0; i < n; i++) out.push([a + (i + 0.5) * s, s]);
  };
  // The outermost row is half a fine step wide (a rim): a splat's soft
  // falloff scales with its size, so the very edge comes out sharper still.
  const rim = fine / 2;
  const edge = (a, len, atStart) => {
    if (len < fine * 1.5) return run(a, len, fine);
    if (atStart) {
      out.push([a + rim / 2, rim]);
      run(a + rim, len - rim, fine);
    } else {
      run(a, len - rim, fine);
      out.push([a + len - rim / 2, rim]);
    }
  };
  if (coarse <= fine || L <= ends * band + coarse) {
    if (L < fine * 3) run(0, L, fine);
    else if (radial) edge(0, L, false);
    else {
      out.push([rim / 2, rim]);
      run(rim, L - 2 * rim, fine);
      out.push([L - rim / 2, rim]);
    }
    return out;
  }
  const mid = L - ends * band;
  if (!radial) edge(0, band, true);
  run(radial ? 0 : band, mid, coarse);
  edge(radial ? mid : band + mid, band, false);
  return out;
}

export class Crisp {
  constructor({ fine = 0.006, coarse = 0.03 } = {}) {
    this.fine = fine;
    this.coarse = coarse;
    this.pts = [];
    this.opacity = 1; // a shape's opacity: its option `opacity`
    for (const name of ["rect", "box", "line", "sphere", "disc", "cylinder"]) {
      const fn = this[name].bind(this);
      this[name] = (...args) => {
        const o = args.at(-1);
        this.opacity = (o && typeof o === "object" && !Array.isArray(o) && o.opacity) ?? 1;
        fn(...args);
        this.opacity = 1;
      };
    }
  }

  splat(p, color, sx, sy, sz, rot) {
    const a = color[3] ?? this.opacity;
    this.pts.push({ p, c: [color[0], color[1], color[2], a], s: [sx, sy, sz], r: rot });
  }

  // A flat face: the rectangle centered at c with sides w along u and h
  // along v (unit vectors), facing n. Each side is cut into a fine band at
  // each end and coarse cells between (cuts()), and the face is the grid of
  // both: coarse in the middle, fine splats along every edge (long and thin,
  // laid along it) and fine at the corners.
  face(c, u, v, w, h, n, colorIn, o = {}) {
    const color = typeof colorIn === "function" ? colorIn : () => colorIn;
    const fine = o.fine ?? this.fine;
    const coarse = o.coarse ?? this.coarse;
    const rot = frame(u, n);
    const corner = sub(c, add(mul(u, w / 2), mul(v, h / 2)));
    const cu = cuts(w, fine, coarse);
    const cv = cuts(h, fine, coarse);
    for (const [y, sy] of cv)
      for (const [x, sx] of cu) {
        const p = add(corner, add(mul(u, x), mul(v, y)));
        this.splat(p, color(p, n), sx * K, sy * K, Math.min(sx, sy) * THIN, rot);
      }
  }

  // A rectangle in the xy plane facing +z (and its back, with back: true).
  rect(w, h, o = {}) {
    const c = o.pos || [0, 0, 0];
    this.face(c, [1, 0, 0], [0, 1, 0], w, h, [0, 0, 1], o.color || [1, 1, 1], o);
    if (o.back) this.face(c, [-1, 0, 0], [0, 1, 0], w, h, [0, 0, -1], o.color || [1, 1, 1], o);
  }

  // A box centered at pos. `faces` leaves some out (a board seen only from
  // the front needs no back): a string of the faces to keep, "xXyYzZ" (a
  // lower-case letter the − side, upper-case the + side).
  box(sx, sy, sz, o = {}) {
    const c = o.pos || [0, 0, 0];
    const col = o.color || [1, 1, 1];
    const keep = o.faces || "xXyYzZ";
    const F = [
      ["X", [1, 0, 0], [0, 1, 0], [0, 0, 1], sy, sz, sx],
      ["x", [-1, 0, 0], [0, 1, 0], [0, 0, -1], sy, sz, sx],
      ["Y", [0, 1, 0], [0, 0, 1], [1, 0, 0], sz, sx, sy],
      ["y", [0, -1, 0], [0, 0, -1], [1, 0, 0], sz, sx, sy],
      ["Z", [0, 0, 1], [1, 0, 0], [0, 1, 0], sx, sy, sz],
      ["z", [0, 0, -1], [-1, 0, 0], [0, 1, 0], sx, sy, sz],
    ];
    for (const [k, n, u, v, w, h, d] of F) {
      if (!keep.includes(k)) continue;
      this.face(add(c, mul(n, d / 2)), u, v, w, h, n, col, o);
    }
  }

  // A straight bar from a to b, `width` wide, lying flat facing n (+z by
  // default): a line drawn on a board.
  line(a, b, width, o = {}) {
    const n = o.normal || [0, 0, 1];
    const d = sub(b, a);
    const l = len(d);
    if (l < 1e-6) return;
    const u = mul(d, 1 / l);
    const v = norm(cross(n, u));
    this.face(mul(add(a, b), 0.5), u, v, l, width, n, o.color || [1, 1, 1], { fine: Math.min(o.fine ?? this.fine, width / 2), coarse: this.coarse }); // prettier-ignore
  }

  // A sphere of radius r: splats spread evenly (a Fibonacci spiral) lying
  // flat on it, `step` apart.
  sphere(r, o = {}) {
    const c = o.pos || [0, 0, 0];
    const color = typeof o.color === "function" ? o.color : () => o.color || [1, 1, 1];
    const step = o.step ?? Math.min(this.fine * 1.4, r / 3);
    const n = Math.max(12, Math.round((4 * Math.PI * r * r) / (step * step)));
    const ga = Math.PI * (3 - Math.sqrt(5));
    for (let i = 0; i < n; i++) {
      const y = 1 - (2 * (i + 0.5)) / n;
      const rr = Math.sqrt(1 - y * y);
      const nn = [Math.cos(ga * i) * rr, y, Math.sin(ga * i) * rr];
      const p = add(c, mul(nn, r));
      this.splat(p, color(p, nn), step * 0.62, step * 0.62, step * THIN, qfromto([0, 0, 1], nn));
    }
  }

  // A filled disc of radius r in the xy plane facing +z: rings of splats,
  // fine at the rim.
  disc(r, o = {}) {
    const c = o.pos || [0, 0, 0];
    const color = typeof o.color === "function" ? o.color : () => o.color || [1, 1, 1];
    this.rings(c, [1, 0, 0], [0, 1, 0], [0, 0, 1], r, color, o);
  }

  // Rings of splats filling a disc of radius r around c in the plane of e1
  // and e2, facing n.
  rings(c, e1, e2, n, r, color, o = {}) {
    const fine = o.fine ?? this.fine;
    const coarse = o.coarse ?? this.coarse;
    for (const [rad, dr] of cuts(r, fine, coarse, true)) {
      const m =
        rad < dr * 0.75
          ? 1
          : Math.max(3, Math.round((2 * Math.PI * rad) / Math.min(dr * 2.5, coarse)));
      const da = (2 * Math.PI * rad) / m;
      for (let i = 0; i < m; i++) {
        const a = ((i + 0.5) / m) * Math.PI * 2;
        const dir = add(mul(e1, Math.cos(a)), mul(e2, Math.sin(a)));
        const p = add(c, mul(dir, rad));
        const tan = m === 1 ? e1 : add(mul(e1, -Math.sin(a)), mul(e2, Math.cos(a)));
        const sz = m === 1 ? dr : da;
        this.splat(p, color(p, n), sz * K, dr * K, Math.min(sz, dr) * THIN, frame(tan, n));
      }
    }
  }

  // A cylinder of radius r and length l along axis (unit), centered at pos,
  // with its two caps (caps: false leaves them off).
  cylinder(r, l, o = {}) {
    const c = o.pos || [0, 0, 0];
    const ax = norm(o.axis || [0, 0, 1]);
    const color = typeof o.color === "function" ? o.color : () => o.color || [1, 1, 1];
    const fine = o.fine ?? this.fine;
    const coarse = o.coarse ?? this.coarse;
    const ref = Math.abs(ax[0]) < 0.9 ? [1, 0, 0] : [0, 1, 0];
    const e1 = norm(cross(ax, ref));
    const e2 = cross(ax, e1);
    const m = Math.max(8, Math.round((2 * Math.PI * r) / (fine * 2)));
    const ca = (2 * Math.PI * r) / m;
    for (let i = 0; i < m; i++) {
      const a = ((i + 0.5) / m) * Math.PI * 2;
      const nn = add(mul(e1, Math.cos(a)), mul(e2, Math.sin(a)));
      const rot = frame(ax, nn);
      for (const [x, cl] of cuts(l, fine, coarse)) {
        const p = add(c, add(mul(nn, r), mul(ax, x - l / 2)));
        this.splat(p, color(p, nn), cl * K, ca * K, Math.min(ca, cl) * THIN, rot);
      }
    }
    if (o.caps === false) return;
    for (const s of [-1, 1]) this.rings(add(c, mul(ax, (s * l) / 2)), e1, s > 0 ? e2 : mul(e2, -1), mul(ax, s), r, color, o); // prettier-ignore
  }

  model() {
    const m = makeModel(this.pts.length);
    this.pts.forEach((s, i) => {
      m.pos.set(s.p, i * 3);
      m.color.set(s.c, i * 4);
      m.scale.set(s.s, i * 3);
      m.rot.set(s.r, i * 4);
    });
    return m;
  }
}

export function crispModel(build, o = {}) {
  const c = new Crisp(o);
  build(c);
  return c.model();
}
