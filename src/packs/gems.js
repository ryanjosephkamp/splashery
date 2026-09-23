// Gems and minerals pack: cut stones, crystals, a geode, an opal, a pearl
// and a crystal ball. Splats cannot refract, so sparkle is faked: every facet
// gets a brightness from a pretend studio (bright lights above, dark below),
// edges catch the light, and some splats glint as the camera moves.
// Loaded on demand.

import {
  mix,
  shade,
  smoothstep,
  clamp,
  quatFromTo,
  quatAxisAngle,
  quatEuler,
  quatRotate,
} from "../kit.js";

const TAU = Math.PI * 2;
const DEG = Math.PI / 180;

// ---- Small vector helpers -------------------------------------------------------

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
const lerp = (a, b, t) => add(a, mul(sub(b, a), t));
const keep = (c, size) => ({ c, keep: true, size });

const LIGHT = unit([-0.45, 0.8, 0.45]);
const VIEW = unit([0.5, 0.3, 0.82]);
const HALF = unit(add(LIGHT, VIEW));
const lit = (col, n, amb = 0.62, k = 0.45) => shade(col, amb + k * Math.max(0, dot(n, LIGHT)));
const gloss = (col, n, amt = 0.45, pow = 18) =>
  mix(col, "#ffffff", amt * Math.pow(Math.max(0, dot(n, HALF)), pow));

function randDir(rand) {
  const z = rand() * 2 - 1;
  const a = rand() * TAU;
  const r = Math.sqrt(1 - z * z);
  return [r * Math.cos(a), z, r * Math.sin(a)];
}

function basis(d) {
  const a = Math.abs(d[1]) < 0.9 ? [0, 1, 0] : [1, 0, 0];
  const e1 = unit(cross(d, a));
  return [e1, cross(d, e1)];
}

// A repeatable pseudo-random number for an integer (facet brightness).
function hash(i) {
  let x = Math.imul(i ^ 0x9e3779b9, 0x85ebca6b);
  x ^= x >>> 13;
  x = Math.imul(x, 0xc2b2ae35);
  x ^= x >>> 16;
  return (x >>> 0) / 4294967296;
}

// A rainbow colour for hue h (0..1).
function hue(h, s = 1, v = 1) {
  const f = (n) => {
    const k = (n + h * 6) % 6;
    return v - v * s * Math.max(0, Math.min(k, 4 - k, 1));
  };
  return [f(5), f(3), f(1)];
}

// ---- Convex polytopes -------------------------------------------------------------
// A cut stone is the inside of a set of planes { n, h } (n·p <= h). Each face
// polygon is found by clipping a big square on its plane by all the others,
// then sampled evenly by area. Samples carry the facet (`face`, `tag`) and
// the distance to the facet's edge (`edge`) for bright edges.

function clipPoly(poly, n, h) {
  const out = [];
  for (let i = 0; i < poly.length; i++) {
    const a = poly[i];
    const b = poly[(i + 1) % poly.length];
    const da = dot(n, a) - h;
    const db = dot(n, b) - h;
    if (da <= 0) out.push(a);
    if ((da < 0 && db > 0) || (da > 0 && db < 0)) out.push(lerp(a, b, da / (da - db)));
  }
  return out;
}

function polytope(planes, { thick } = {}) {
  const faces = [];
  planes.forEach((pl, i) => {
    const n = unit(pl.n);
    const h = pl.h;
    const [e1, e2] = basis(n);
    const c = mul(n, h);
    const S = 50;
    let poly = [
      add(c, add(mul(e1, S), mul(e2, S))),
      add(c, add(mul(e1, -S), mul(e2, S))),
      add(c, add(mul(e1, -S), mul(e2, -S))),
      add(c, add(mul(e1, S), mul(e2, -S))),
    ];
    for (let j = 0; j < planes.length && poly.length >= 3; j++) {
      if (j !== i) poly = clipPoly(poly, unit(planes[j].n), planes[j].h);
    }
    if (poly.length < 3) return;
    const tris = [];
    let area = 0;
    for (let t = 1; t < poly.length - 1; t++) {
      const A = len(cross(sub(poly[t], poly[0]), sub(poly[t + 1], poly[0]))) / 2;
      if (A > 0) {
        area += A;
        tris.push({ a: poly[0], b: poly[t], c: poly[t + 1], A });
      }
    }
    if (area < 1e-7) return;
    const edges = poly.map((a, t) => {
      const b = poly[(t + 1) % poly.length];
      return { a, m: unit(cross(n, sub(b, a))) };
    });
    faces.push({ n, tris, area, edges, id: faces.length, plane: i, tag: pl.tag ?? "" });
  });
  const cum = [];
  let total = 0;
  for (const f of faces) {
    total += f.area;
    cum.push(total);
  }
  let inR = Infinity;
  for (const pl of planes) inR = Math.min(inR, pl.h / len(pl.n));
  return {
    area: total,
    thick: thick ?? inR,
    faces,
    sample(rand) {
      const x = rand() * total;
      let lo = 0;
      let hi = cum.length - 1;
      while (lo < hi) {
        const m = (lo + hi) >> 1;
        if (cum[m] < x) lo = m + 1;
        else hi = m;
      }
      const f = faces[lo];
      let y = rand() * f.area;
      let tri = f.tris[f.tris.length - 1];
      for (const t of f.tris) {
        if (y < t.A) {
          tri = t;
          break;
        }
        y -= t.A;
      }
      let r1 = rand();
      let r2 = rand();
      if (r1 + r2 > 1) {
        r1 = 1 - r1;
        r2 = 1 - r2;
      }
      const p = add(tri.a, add(mul(sub(tri.b, tri.a), r1), mul(sub(tri.c, tri.a), r2)));
      let edge = Infinity;
      for (const e of f.edges) {
        const d = dot(sub(p, e.a), e.m);
        if (d < edge) edge = d;
      }
      return { p, n: f.n, u: r1, v: r2, face: f.id, tag: f.tag, edge };
    },
  };
}

// ---- Cuts --------------------------------------------------------------------------------
// Brilliant cut round an outline: outline(phi) is the girdle radius at each
// azimuth (1 for a round stone). Proportions after Tolkowsky's ideal cut.

function brilliant(
  outline = () => 1,
  { table = 0.56, crown = 34.5, pavilion = 40.75, girdle = 0.02 } = {},
) {
  const planes = [];
  const g = girdle;
  const at = (phi, r, y) => [r * Math.cos(phi), y, r * Math.sin(phi)];
  const tilted = (phi, ang, down = false) => [
    Math.sin(ang) * Math.cos(phi),
    down ? -Math.cos(ang) : Math.cos(ang),
    Math.sin(ang) * Math.sin(phi),
  ];
  const through = (n, p, tag) => planes.push({ n, h: dot(n, p), tag });
  // Girdle: many narrow vertical faces.
  for (let i = 0; i < 48; i++) {
    const phi = (i / 48) * TAU;
    const r = outline(phi);
    const e = 0.002;
    // Outward normal of the outline curve at phi.
    const p0 = at(phi - e, outline(phi - e), 0);
    const p1 = at(phi + e, outline(phi + e), 0);
    const tng = unit(sub(p1, p0));
    const n = unit(cross(tng, [0, 1, 0]));
    through(dot(n, at(phi, r, 0)) > 0 ? n : mul(n, -1), at(phi, r, 0), "girdle");
  }
  const crownH = (1 - table) * Math.tan(crown * DEG);
  const top = g + crownH;
  planes.push({ n: [0, 1, 0], h: top, tag: "table" });
  for (let i = 0; i < 8; i++) {
    const phi = (i / 8) * TAU;
    const r = outline(phi);
    through(tilted(phi, crown * DEG), at(phi, r, g), "bezel");
    // Star facets: shallow, meeting the table's edge.
    const ps = phi + TAU / 16;
    through(tilted(ps, (crown - 12) * DEG), at(ps, outline(ps) * (table + 0.06), top), "star");
    // Pavilion mains down to the culet.
    through(tilted(phi, pavilion * DEG, true), at(phi, r, -g), "pavilion");
  }
  for (let i = 0; i < 16; i++) {
    const phi = ((i + 0.5) / 16) * TAU;
    const r = outline(phi);
    through(tilted(phi, (crown + 7) * DEG), at(phi, r, g), "upper");
    through(tilted(phi, (pavilion + 2.5) * DEG, true), at(phi, r * 1.0, -g), "lower");
  }
  planes.push({ n: [0, -1, 0], h: g + Math.tan(pavilion * DEG) * 0.985, tag: "culet" });
  return planes;
}

// Step cut (emerald cut): a rectangle with cut corners, with rows of steps
// on the crown and the pavilion.
function stepCut(A = 1.3, B = 0.92, corner = 0.3) {
  const g = 0.02;
  const dirs = [
    { d: [1, 0, 0], D: A },
    { d: [-1, 0, 0], D: A },
    { d: [0, 0, 1], D: B },
    { d: [0, 0, -1], D: B },
  ];
  for (const sx of [1, -1])
    for (const sz of [1, -1]) dirs.push({ d: unit([sx, 0, sz]), D: (A + B - corner) / Math.SQRT2 });
  const planes = [];
  for (const { d, D } of dirs) planes.push({ n: d, h: D, tag: "girdle" });
  // Crown steps: from steep at the girdle to shallow near the table.
  const crown = [
    [0, 44],
    [0.13, 33],
    [0.25, 22],
  ];
  let y = g;
  let inset = 0;
  crown.forEach(([ins, ang], s) => {
    y += (ins - inset) * Math.tan((crown[Math.max(0, s - 1)][1] * Math.PI) / 180);
    inset = ins;
    for (const { d, D } of dirs) {
      const n = [d[0] * Math.sin(ang * DEG), Math.cos(ang * DEG), d[2] * Math.sin(ang * DEG)];
      const p = [d[0] * (D - ins), y, d[2] * (D - ins)];
      planes.push({ n, h: dot(n, p), tag: `crown${s}` });
    }
  });
  const table = y + (0.4 - inset) * Math.tan(22 * DEG);
  planes.push({ n: [0, 1, 0], h: table, tag: "table" });
  // Pavilion steps.
  const pav = [
    [0, 58],
    [0.18, 48],
    [0.38, 40],
  ];
  y = -g;
  inset = 0;
  pav.forEach(([ins, ang], s) => {
    y -= (ins - inset) * Math.tan((pav[Math.max(0, s - 1)][1] * Math.PI) / 180);
    inset = ins;
    for (const { d, D } of dirs) {
      const n = [d[0] * Math.sin(ang * DEG), -Math.cos(ang * DEG), d[2] * Math.sin(ang * DEG)];
      const p = [d[0] * (D - ins), y, d[2] * (D - ins)];
      planes.push({ n, h: dot(n, p), tag: `pav${s}` });
    }
  });
  return planes;
}

// A pretend studio: what a facet facing n reflects towards the default
// camera. Bright softboxes above and to the side, a dark floor.
function studio(n) {
  const r = sub(mul(n, 2 * dot(n, VIEW)), VIEW);
  let v = 0.18 + 0.55 * smoothstep(-0.3, 0.8, r[1]);
  v += 0.9 * Math.pow(Math.max(0, dot(r, unit([-0.5, 0.75, 0.4]))), 12);
  v += 0.6 * Math.pow(Math.max(0, dot(r, unit([0.8, 0.35, -0.3]))), 10);
  return v;
}

// Colours a cut stone: each facet a brightness from the studio mixed with a
// facet-dependent "internal reflection", bright edges, and flashes of fire.
function gemColor(
  c,
  base,
  { fire = 0.25, edgeW = 0.012, dark = 0.18, light = "#ffffff", contrast = 0.6 } = {},
) {
  const f = c.s.face;
  const bright = clamp(0.5 * studio(c.n) + contrast * hash(f * 7 + 3) - 0.12, 0, 1.25);
  let col =
    bright < 0.5
      ? mix(shade(base, dark), base, bright / 0.5)
      : mix(base, light, (bright - 0.5) * 0.9);
  if (hash(f * 13 + 1) < fire) {
    const h = hash(f * 31 + 5);
    col = mix(col, hue(h, 0.8, 1), 0.45);
  }
  if (c.s.edge < edgeW) col = mix(col, light, 0.65 * (1 - c.s.edge / edgeW));
  return col;
}

// Adds a cut stone: sparkly surface and a soft inside for Slice.
function addGem(k, planes, base, opts = {}) {
  const shape = polytope(planes);
  k.add(shape, {
    quat: opts.quat,
    scale: opts.scale,
    pos: opts.pos,
    flat: 0.12,
    weight: opts.weight ?? 1,
    interior: 0.06,
    core: mix(base, "#ffffff", 0.25),
    kind: "glint",
    params: (c) => [c.rand() < 0.12 ? 0.8 : 0.05, 0],
    color: (c) => gemColor(c, base, opts),
    part: opts.part,
  });
  return shape;
}

// Little four-pointed stars of light on the facets facing the viewer: two
// crossed streaks each, which flare as the camera moves.
function starGlints(k, shape, quat, n, { scale = [1, 1, 1] } = {}) {
  const spots = [];
  for (let tries = 0; tries < 400 && spots.length < n; tries++) {
    const s = shape.sample(k.rand);
    const nw = quatRotate(quat, s.n);
    if (dot(nw, VIEW) < 0.55 || s.edge > 0.03) continue;
    const p = quatRotate(quat, [s.p[0] * scale[0], s.p[1] * scale[1], s.p[2] * scale[2]]);
    if (spots.some((q) => len(sub(q.p, p)) < 0.35)) continue;
    spots.push({ p: add(p, mul(VIEW, 0.02)), size: 0.6 + 0.8 * k.rand() });
  }
  const right = unit(cross([0, 1, 0], VIEW));
  const up = cross(VIEW, right);
  if (!spots.length) return;
  k.cloud({ count: 30 * spots.length, size: 1, pattern: false }, (rand) => {
    const sp = spots[Math.floor(rand() * spots.length)];
    const dir = rand() < 0.5 ? right : up;
    const f = rand() * 2 - 1;
    return {
      p: add(sp.p, mul(dir, f * 0.09 * sp.size)),
      dir,
      stretch: 3,
      size: sp.size * (1 - 0.8 * Math.abs(f)),
      color: "#ffffff",
      opacity: 0.95,
      kind: "glint",
      params: [0.6, 0],
    };
  });
}

// ---- Crystals (points with six sides) ----------------------------------------------------

// A hexagonal prism with a six-sided point: planes in its own frame (axis +Y,
// base at y = 0).
function crystalPoint(w, L, tipLen, twist = 0) {
  const planes = [];
  for (let i = 0; i < 6; i++) {
    const a = (i / 6) * TAU + twist;
    const d = [Math.cos(a), 0, Math.sin(a)];
    planes.push({ n: d, h: w, tag: "side" });
    const ang = 52 * DEG;
    const n = [d[0] * Math.sin(ang), Math.cos(ang), d[2] * Math.sin(ang)];
    planes.push({ n, h: dot(n, [d[0] * w, L - tipLen, d[2] * w]), tag: "tip" });
  }
  planes.push({ n: [0, -1, 0], h: 0, tag: "base" });
  return planes;
}

// Many small crystal points as one cloud: each point is a pyramid of six
// faces. crystals: [{ base, axis, w, L }]. color(face normal, t 0..1 up).
function crystalCloud(k, crystals, share, color, extra = {}) {
  const faces = [];
  let total = 0;
  for (const cr of crystals) {
    const [e1, e2] = basis(cr.axis);
    const tip = add(cr.base, mul(cr.axis, cr.L));
    const ring = [];
    for (let i = 0; i < 6; i++) {
      const a = (i / 6) * TAU + cr.twist;
      ring.push(add(cr.base, mul(add(mul(e1, Math.cos(a)), mul(e2, Math.sin(a))), cr.w)));
    }
    for (let i = 0; i < 6; i++) {
      const a = ring[i];
      const b = ring[(i + 1) % 6];
      let n = unit(cross(sub(b, a), sub(tip, a)));
      if (dot(n, sub(a, cr.base)) < 0) n = mul(n, -1);
      const A = len(cross(sub(b, a), sub(tip, a))) / 2;
      total += A;
      faces.push({ a, b, tip, n, cum: total, cr });
    }
  }
  k.cloud({ share, size: 0.9, flat: 0.15, ...extra }, (rand) => {
    const x = rand() * total;
    let lo = 0;
    let hi = faces.length - 1;
    while (lo < hi) {
      const m = (lo + hi) >> 1;
      if (faces[m].cum < x) lo = m + 1;
      else hi = m;
    }
    const f = faces[lo];
    let r1 = rand();
    let r2 = rand();
    if (r1 + r2 > 1) {
      r1 = 1 - r1;
      r2 = 1 - r2;
    }
    // r2 runs towards the tip.
    const p = add(f.a, add(mul(sub(f.b, f.a), r1), mul(sub(f.tip, f.a), r2)));
    const out = color(f.n, r2, rand, f.cr);
    return {
      p,
      n: f.n,
      color: out.color,
      opacity: out.opacity ?? 0.95,
      kind: out.kind,
      params: out.params,
      part: f.cr.part,
      pattern: false,
    };
  });
}

// ---- Rocks -------------------------------------------------------------------------------

const rockColor = (c, a = "#8a8178", b = "#4f4943") => {
  const n = c.fbm(c.p[0] * 5, c.p[1] * 5, c.p[2] * 5);
  const speck = c.noise(c.p[0] * 40, c.p[1] * 40, c.p[2] * 40) > 0.62;
  let col = mix(a, b, 0.5 + 0.6 * n);
  if (speck) col = shade(col, 1.1);
  return lit(col, c.n, 0.6, 0.45);
};

export const RECIPES = {
  // ---- Diamond --------------------------------------------------------------------------
  diamond: {
    alive: true,
    options: [{ key: "color", label: "Tint", type: "color", default: "#dbe9ff" }],
    build(k, o) {
      const q = quatEuler(6, 12, 0);
      const shape = addGem(k, brilliant(), o.color, {
        quat: q,
        fire: 0.22,
        dark: 0.12,
        contrast: 0.8,
        light: "#ffffff",
      });
      starGlints(k, shape, q, 7);
    },
  },

  // ---- Ruby -----------------------------------------------------------------------------
  ruby: {
    alive: true,
    options: [{ key: "color", label: "Colour", type: "color", default: "#d0103a" }],
    build(k, o) {
      addGem(
        k,
        brilliant(() => 1, { table: 0.54, crown: 36, pavilion: 42 }),
        o.color,
        {
          scale: [1.32, 1, 1],
          quat: quatEuler(10, 25, 0),
          fire: 0.08,
          dark: 0.25,
          light: "#ffd6de",
        },
      );
    },
  },

  // ---- Emerald --------------------------------------------------------------------------
  emerald: {
    alive: true,
    options: [{ key: "color", label: "Colour", type: "color", default: "#119a5b" }],
    build(k, o) {
      addGem(k, stepCut(), o.color, {
        quat: quatEuler(24, 22, 0),
        fire: 0.04,
        dark: 0.3,
        light: "#d8ffe9",
        edgeW: 0.01,
      });
    },
  },

  // ---- Sapphire -------------------------------------------------------------------------
  sapphire: {
    alive: true,
    options: [{ key: "color", label: "Colour", type: "color", default: "#1f4fd1" }],
    build(k, o) {
      // A cushion: a square with softly rounded sides.
      const cushion = (phi) => {
        const c = Math.abs(Math.cos(phi));
        const s = Math.abs(Math.sin(phi));
        return 1 / Math.pow(Math.pow(c, 3.2) + Math.pow(s, 3.2), 1 / 3.2);
      };
      addGem(k, brilliant(cushion, { table: 0.55, crown: 35, pavilion: 42 }), o.color, {
        quat: quatEuler(10, 30, 0),
        fire: 0.08,
        dark: 0.22,
        light: "#dfe8ff",
      });
    },
  },

  // ---- Amethyst geode ---------------------------------------------------------------------
  "amethyst-geode": {
    alive: true,
    options: [{ key: "color", label: "Crystals", type: "color", default: "#8e44c9" }],
    controls: [{ key: "open", label: "Open", type: "toggle", default: 1, ease: 1.4 }],
    action: { key: "open", label: "Open or close", sound: { on: "open", off: "close" } },
    // Splats are depth-sorted in the pose they are built in, so the front half
    // is built twice, shut and lying open, and whichever copy is nearer its
    // current pose is shown as it swings.
    drive(t, c, out) {
      const e = c.open * c.open * (3 - 2 * c.open);
      const openNow = e >= 0.5 ? 1 : 0;
      out.parts.lidShut = { angle: -GEODE_SWING * e, visible: 1 - openNow };
      out.parts.lidOpen = { angle: GEODE_SWING * (1 - e), visible: openNow };
      out.amount = 1;
    },
    build(k, o) {
      const R = 1;
      const rock = (d) =>
        R *
        (1 + 0.07 * k.noise.fbm(d[0] * 2 + 7, d[1] * 2, d[2] * 2, 3)) *
        (d[1] < -0.6 ? 0.96 : 1);
      const cav = (phi) => 0.62 + 0.06 * k.noise(Math.cos(phi) * 2, Math.sin(phi) * 2, 3);
      const hinge = [-R * 1.02, 0, 0];
      const lidShut = k.part("lidShut", { pivot: hinge, axis: [0, 1, 0] });
      const lidOpen = k.part("lidOpen", { pivot: hinge, axis: [0, 1, 0] });
      const openQ = quatAxisAngle([0, 1, 0], -GEODE_SWING);
      const purple = o.color;
      const halves = [
        { side: -1, part: 0, open: false, crystals: true },
        { side: 1, part: lidShut, open: false, crystals: false },
        { side: 1, part: lidOpen, open: true, crystals: true },
      ];
      for (const half of halves) {
        const { side, part } = half;
        const inPart = part;
        // The open copy of the front half is turned to its open place.
        const T = (p) => (half.open ? add(hinge, quatRotate(openQ, sub(p, hinge))) : p);
        const TV = (v) => (half.open ? quatRotate(openQ, v) : v);
        // The rough outside: a half shell.
        const shell = k.param(
          (u, v) => {
            const phi = u * TAU;
            const th = v * (Math.PI / 2);
            const d = [
              Math.sin(th) * Math.cos(phi),
              Math.sin(th) * Math.sin(phi),
              side * Math.cos(th),
            ];
            return T(mul(d, rock(d)));
          },
          { grid: 64, thick: 0.35, flip: side > 0 },
        );
        k.add(shell, {
          part,
          flat: 0.2,
          // (Only the back half is solid: the front one closes over it.)
          interior: side > 0 ? 0 : 0.1,
          core: "#cfd3dc",
          color: (c) => rockColor(c),
        });
        // The cut face: bands of agate round the cavity.
        const ring = k.param(
          (u, v) => {
            const phi = u * TAU;
            const d = [Math.cos(phi), Math.sin(phi), 0];
            const r0 = cav(phi);
            const r1 = rock(d) * 0.995;
            const r = r0 + (r1 - r0) * v;
            return T([r * Math.cos(phi), r * Math.sin(phi), side * 0.001]);
          },
          { grid: 64, thick: 0.02, flip: side < 0 },
        );
        k.add(ring, {
          part: inPart,
          flat: 0.15,
          color: (c) => {
            const v = c.v;
            const wob = 0.04 * c.noise(c.p[0] * 6, c.p[1] * 6, 1);
            const x = v + wob;
            let col;
            if (x > 0.9) col = "#6b6259";
            else if (x > 0.72) col = mix("#f4f1ec", "#d8d2ca", c.rand() * 0.4);
            else if (x > 0.55) col = "#9fb3c8";
            else if (x > 0.42) col = "#ece8f2";
            else if (x > 0.2) col = mix("#b9a8cf", "#d9cfe6", 0.5 + 0.5 * Math.sin(x * 60));
            else col = shade(purple, 0.8);
            return keep(shade(col, 0.95 + 0.1 * c.rand()));
          },
        });
        // The cavity wall, deep purple, and crystal points growing inwards.
        const wall = k.param(
          (u, v) => {
            const phi = u * TAU;
            const th = v * (Math.PI / 2);
            const r = cav(phi) * (0.92 + 0.08 * Math.cos(th));
            return T([
              r * Math.sin(th) * Math.cos(phi),
              r * Math.sin(th) * Math.sin(phi),
              side * r * 0.75 * Math.cos(th),
            ]);
          },
          { grid: 48, thick: 0.02, flip: side < 0 },
        );
        k.add(wall, {
          part: inPart,
          flat: 0.2,
          color: (c) => lit(shade(purple, 0.45), c.n, 0.7, 0.3),
        });
        if (!half.crystals) continue;
        const crystals = [];
        for (let i = 0; i < 170; i++) {
          const phi = k.rand() * TAU;
          const th = Math.acos(1 - k.rand() * 0.97) * 0.98;
          const r = cav(phi) * (0.92 + 0.08 * Math.cos(th));
          const base = [
            r * Math.sin(th) * Math.cos(phi),
            r * Math.sin(th) * Math.sin(phi),
            side * r * 0.75 * Math.cos(th),
          ];
          const inward = unit(add(mul(base, -1), [0, 0, side * 0.35]));
          const axis = unit(add(inward, mul(randDir(k.rand), 0.25)));
          const L = 0.12 + 0.16 * k.rand();
          crystals.push({
            base: T(add(base, mul(axis, -0.02))),
            axis: TV(axis),
            w: L * 0.3,
            L,
            twist: k.rand(),
            part: inPart,
          });
        }
        crystalCloud(k, crystals, 0.22, (n, t, rand) => {
          const col = mix(shade(purple, 0.55), mix(purple, "#f3e3ff", 0.6), Math.pow(t, 1.3));
          const b = 0.55 + 0.5 * studio(n);
          return {
            color: shade(col, clamp(b, 0.4, 1.3)),
            kind: "glint",
            params: [rand() < 0.3 ? 1 : 0.2, 0],
          };
        });
      }
      // Room for the front half as it swings shut.
      k.reach([0, 0, R * 1.05]);
    },
  },

  // ---- Quartz cluster ---------------------------------------------------------------------
  "quartz-cluster": {
    alive: true,
    options: [{ key: "color", label: "Tint", type: "color", default: "#cfd8ee" }],
    build(k, o) {
      const tint = o.color;
      // A lumpy rock base.
      k.add(
        k.radial((d) => 1 + 0.12 * k.noise.fbm(d[0] * 2, d[1] * 2 + 3, d[2] * 2, 3), { grid: 48 }),
        {
          scale: [1, 0.36, 0.85],
          pos: [0, -0.62, 0],
          flat: 0.2,
          interior: 0.1,
          core: "#6d655c",
          color: (c) => rockColor(c, "#8d8274", "#5d544b"),
        },
      );
      // Crystals: long six-sided prisms with points, leaning out from the rock.
      const list = [
        [0, 1.25, 0.2, 0, 0],
        [0.4, 0.95, 0.15, -22, 12],
        [-0.42, 1.0, 0.16, 20, -8],
        [0.2, 0.7, 0.12, -10, -32],
        [-0.15, 0.62, 0.11, 8, 30],
        [0.62, 0.6, 0.11, -40, 5],
        [-0.65, 0.55, 0.1, 42, 10],
        [0.05, 0.5, 0.09, -5, 45],
        [-0.35, 0.45, 0.09, 30, 38],
        [0.45, 0.42, 0.08, -35, -35],
      ];
      list.forEach(([x, L, w, rz, rx], i) => {
        const planes = crystalPoint(w, L, w * 1.6, k.rand() * 0.5);
        k.add(polytope(planes), {
          pos: [x, -0.55, (i % 3) * 0.08 - 0.08],
          rot: [rx, k.rand() * 40, rz],
          flat: 0.12,
          weight: 1.3,
          opacity: 0.9,
          kind: "glint",
          params: (c) => [c.rand() < 0.15 ? 0.9 : 0.05, 0],
          pattern: false,
          color: (c) => {
            const t = clamp((c.lp[1] + 0) / L, 0, 1);
            const base = mix(shade(tint, 0.75), tint, t);
            let col = gemColor(c, base, { fire: 0.06, dark: 0.45, edgeW: 0.01 });
            if (c.s.tag === "side") {
              // Fine growth lines across the prism faces.
              if (Math.abs(Math.sin(c.lp[1] * 90)) > 0.93) col = shade(col, 0.9);
            }
            return col;
          },
        });
      });
    },
  },

  // ---- Opal -----------------------------------------------------------------------------
  opal: {
    alive: true,
    options: [
      {
        key: "type",
        label: "Opal",
        type: "select",
        default: "white",
        choices: [
          { id: "white", label: "White opal" },
          { id: "black", label: "Black opal" },
          { id: "fire", label: "Fire opal" },
        ],
      },
    ],
    build(k, o) {
      const body = { white: "#e6edf5", black: "#1b2340", fire: "#f28c28" }[o.type] || "#e6edf5";
      const hues = {
        white: [0.33, 0.5, 0.6, 0.08, 0.9],
        black: [0.33, 0.5, 0.62, 0.02, 0.8],
        fire: [0.0, 0.05, 0.1, 0.14, 0.95],
      }[o.type] || [0.33, 0.5];
      // A cabochon: a smooth oval dome on a flat back.
      const prof = [];
      for (let i = 0; i <= 16; i++) {
        const a = (i / 16) * (Math.PI / 2);
        prof.push([Math.cos(a) * (i === 16 ? 0 : 1), -0.05 + 0.5 * Math.sin(a)]);
      }
      prof.unshift([0.96, -0.1], [0.6, -0.12], [0, -0.12]);
      prof.sort((a, b) => a[1] - b[1] || a[0] - b[0]);
      // Patches of colour: cells round random points.
      const cells = [];
      for (let i = 0; i < 120; i++) {
        cells.push({
          p: [(k.rand() * 2 - 1) * 1.4, k.rand() * 0.5 - 0.1, (k.rand() * 2 - 1) * 1.05],
          h: hues[Math.floor(k.rand() * hues.length)] + (k.rand() - 0.5) * 0.06,
          s: 0.5 + 0.5 * k.rand(),
        });
      }
      k.add(k.lathe(prof, { grid: 72, thick: 0.25 }), {
        scale: [1.35, 1, 1],
        quat: quatEuler(24, 20, 0),
        flat: 0.15,
        interior: 0.08,
        core: body,
        kind: "glint",
        params: (c) => [c.rand() < 0.5 ? 1 : 0.3, 0],
        color: (c) => {
          const lp = [c.lp[0] * 1.35, c.lp[1], c.lp[2]];
          let b1 = Infinity;
          let b2 = Infinity;
          let cell = cells[0];
          for (const cl of cells) {
            const d = (lp[0] - cl.p[0]) ** 2 + (lp[1] - cl.p[1]) ** 2 * 3 + (lp[2] - cl.p[2]) ** 2;
            if (d < b1) {
              b2 = b1;
              b1 = d;
              cell = cl;
            } else if (d < b2) b2 = d;
          }
          const edge = smoothstep(0, 0.02, Math.sqrt(b2) - Math.sqrt(b1));
          // Play of colour: the hue shifts with the facing, as if with the light.
          const h = (cell.h + 0.08 * c.n[0] + 0.05 * c.n[2] + 1) % 1;
          const flash = hue(h, 0.85, 1);
          const glow =
            0.35 + 0.65 * smoothstep(-0.3, 0.6, c.noise(lp[0] * 7, lp[1] * 7, lp[2] * 7));
          const amount = cell.s * glow * (0.3 + 0.7 * edge);
          let col = mix(body, flash, clamp(amount * (o.type === "black" ? 0.95 : 0.7), 0, 0.9));
          col = lit(col, c.n, 0.72, 0.35);
          return gloss(col, c.n, 0.5, 30);
        },
      });
    },
  },

  // ---- Pearl ----------------------------------------------------------------------------
  pearl: {
    alive: true,
    options: [
      { key: "color", label: "Pearl", type: "color", default: "#f3ede4" },
      { key: "shell", label: "Oyster shell", type: "switch", default: true },
    ],
    controls: [{ key: "open", label: "Open", type: "toggle", default: 1, ease: 1.2 }],
    action: { key: "open", label: "Open or close", sound: { on: "open", off: "close" } },
    // Like the geode, the lid is built twice (shut and open, since splats sort
    // in their built pose) and the copy nearer its current pose is shown.
    drive(t, c, out) {
      const e = c.open * c.open * (3 - 2 * c.open);
      const openNow = e >= 0.5 ? 1 : 0;
      out.parts.lidShut = { angle: -PEARL_SWING * e, visible: 1 - openNow };
      out.parts.lidOpen = { angle: PEARL_SWING * (1 - e), visible: openNow };
    },
    build(k, o) {
      const pearlCol = o.color;
      const pearlAt = o.shell ? [0, -0.02, 0.1] : [0, 0, 0];
      const pr = o.shell ? 0.31 : 1;
      k.add(k.sphere(pr), {
        pos: pearlAt,
        flat: 0.15,
        weight: o.shell ? 2 : 1,
        interior: 0.1,
        core: "#efe4d4",
        pattern: false,
        kind: "glint",
        params: (c) => [c.rand() < 0.25 ? 0.8 : 0.1, 0],
        color: (c) => {
          // Lustre: soft shading, a pink and green orient, a crisp highlight.
          const f = dot(c.n, VIEW);
          let col = mix(shade(pearlCol, 0.78), pearlCol, smoothstep(-0.2, 0.9, dot(c.n, LIGHT)));
          col = mix(
            col,
            hue((0.9 + 0.3 * f + 0.1 * c.n[1]) % 1, 0.25, 1),
            0.18 * (1 - Math.abs(f)),
          );
          col = mix(col, "#ffffff", 0.9 * Math.pow(Math.max(0, dot(c.n, HALF)), 60));
          col = mix(col, "#ffffff", 0.25 * Math.pow(Math.max(0, dot(c.n, HALF)), 6));
          return col;
        },
      });
      if (!o.shell) return;
      // An oyster: a rough cupped lower shell and a hinged lid, pearly inside.
      const hinge = [0, 0.02, -0.72];
      const lidShut = k.part("lidShut", { pivot: hinge, axis: [1, 0, 0] });
      const lidOpen = k.part("lidOpen", { pivot: hinge, axis: [1, 0, 0] });
      const openQ = quatAxisAngle([1, 0, 0], -PEARL_SWING);
      const valve = (up, lift, open) => {
        const outline = (a) => 1 + 0.08 * Math.sin(a * 5 + 1) + 0.05 * Math.sin(a * 11);
        return k.param(
          (u, v) => {
            const a = u * TAU;
            const r = v * outline(a);
            const x = r * Math.cos(a) * 1.05;
            const z = r * Math.sin(a) * 0.82;
            const depth = 0.3 * (1 - v * v) + 0.015 * Math.sin(a * 22) * v;
            const p = [x, (up ? depth * 1.05 : -depth) + lift, z];
            return open ? add(hinge, quatRotate(openQ, sub(p, hinge))) : p;
          },
          { grid: 64, thick: 0.05, flip: up },
        );
      };
      // Patterns from the shell's own (u, v): angle round it and distance out.
      const outside = (c) => {
        const rib = Math.abs(Math.sin(c.u * TAU * 22));
        const ring = Math.abs(Math.sin(c.v * 30 + c.fbm(c.u * 20, 0, c.v * 3) * 3));
        const col = mix("#7d746a", "#b3a898", 0.5 * rib + 0.3 * ring);
        return lit(col, mul(c.n, -1), 0.6, 0.45);
      };
      const nacre = (c) => {
        const r = c.v;
        let col = mix("#f6f3f8", "#c9d6ea", smoothstep(0.2, 0.9, r));
        col = mix(col, hue((Math.cos(c.u * TAU) * 0.6 + r * 0.8 + 2) % 1, 0.35, 1), 0.24);
        if (r > 0.92) col = mix(col, "#5c544b", 0.6);
        return gloss(col, c.n, 0.3, 12);
      };
      for (const [up, part, open] of [
        [false, 0, false],
        [true, lidShut, false],
        [true, lidOpen, true],
      ]) {
        // Inside (pearly) and outside (rough) of the same shell.
        k.add(valve(up, 0, open), { part, flat: 0.2, color: nacre });
        k.add(valve(up, up ? 0.025 : -0.025, open), { part, flat: 0.2, color: outside });
      }
    },
  },

  // ---- Crystal ball ------------------------------------------------------------------------
  "crystal-ball": {
    alive: true,
    options: [{ key: "color", label: "Mist", type: "color", default: "#b061ff" }],
    controls: [
      { key: "swirl", label: "Sparkle", type: "slider", default: 0.5 },
      { key: "gaze", label: "Gaze", type: "pulse", ease: 2.5 },
    ],
    action: { key: "gaze", label: "Gaze into the ball", sound: "chime" },
    drive(t, c, out) {
      out.amount = 0.4 + 1.2 * c.swirl + 1.5 * c.gaze;
      out.glow = [0.9, 0.6, 1, 1.4 * c.gaze];
    },
    build(k, o) {
      const R = 1;
      const cy = 0.35;
      const mist = o.color;
      // The glass: nearly clear, bright at the rim, with a window highlight.
      k.add(k.sphere(R), {
        pos: [0, cy, 0],
        flat: 0.1,
        opacity: 0.22,
        share: 0.22,
        pattern: false,
        color: (c) => {
          // (Hidden where it sits down in its cup.)
          if (c.ln[1] < -0.82) return null;
          const f = Math.abs(dot(c.n, VIEW));
          let col = mix("#e8f1ff", "#ffffff", 0.4);
          col = mix(shade("#b8c8e8", 0.9), col, 1 - f);
          const hl = Math.pow(Math.max(0, dot(c.n, unit([-0.35, 0.6, 0.72]))), 40);
          return keep(mix(col, "#ffffff", hl));
        },
      });
      k.add(k.sphere(R * 1.002), {
        pos: [0, cy, 0],
        share: 0.02,
        opacity: 0.9,
        pattern: false,
        kind: "glint",
        params: [1, 0],
        color: (c) => {
          const hl = Math.pow(Math.max(0, dot(c.n, unit([-0.35, 0.6, 0.72]))), 50);
          const rim = Math.pow(1 - Math.abs(dot(c.n, VIEW)), 6);
          if (hl < 0.2 && rim < 0.35) return null;
          return keep("#ffffff");
        },
      });
      // Swirling mist inside: slow turns, faster near the middle.
      // Three spiral arms of mist that curl up and down as they wind round.
      k.cloud({ share: 0.26, size: 1.7, pattern: false }, (rand) => {
        const arm = Math.floor(rand() * 3);
        const s = Math.pow(rand(), 0.8);
        const spread = 0.35 * (1 - 0.4 * s);
        const a =
          arm * (TAU / 3) +
          s * 4.6 +
          spread * Math.sqrt(-2 * Math.log(1 - rand())) * Math.cos(TAU * rand());
        const r = 0.08 + 0.74 * s + 0.05 * (rand() - 0.5);
        const y = 0.36 * Math.sin(a * 2 + s * 3 + arm) * s + 0.16 * (rand() - 0.5);
        const tint = [mist, "#ff8fd8", "#8fc8ff"][arm];
        return {
          p: [r * Math.cos(a), cy + y, r * Math.sin(a)],
          color: mix(tint, "#ffffff", 0.15 + 0.35 * (1 - s) * rand()),
          opacity: 0.1 + 0.14 * (1 - s),
          kind: "orbit",
          params: [0.5 + 0.2 * rand(), 0.8],
        };
      });
      // Motes of light: a glow rises through them when you gaze into the ball.
      k.cloud({ share: 0.008, size: 0.9, pattern: false }, (rand) => {
        const p = mul(randDir(rand), 0.85 * Math.cbrt(rand()));
        return {
          p: add(p, [0, cy, 0]),
          color: mix(mist, "#ffffff", 0.6),
          opacity: 0.9,
          kind: "pulse",
          params: [clamp((p[1] + 0.85) / 1.7, 0, 1), 0],
        };
      });
      k.cloud({ share: 0.004, size: 0.9, pattern: false }, (rand) => ({
        p: add(mul(randDir(rand), 0.85 * Math.cbrt(rand())), [0, cy, 0]),
        color: "#fff6d6",
        opacity: 1,
        kind: "twinkle",
        params: [0.45, rand() * TAU],
      }));
      // The stand: a turned base in gold, its cup just below the glass.
      const stand = k.lathe(
        [
          [0, -1.0],
          [0.75, -1.0],
          [0.78, -0.94],
          [0.68, -0.88],
          [0.4, -0.84],
          [0.24, -0.76],
          [0.3, -0.7],
          [0.46, -0.64],
          [0.58, -0.56],
          [0.66, -0.48],
          [0.64, -0.44],
        ],
        { grid: 72, thick: 0.12 },
      );
      k.add(stand, {
        flat: 0.2,
        color: (c) => {
          const b = Math.abs(Math.sin(c.p[1] * 40)) > 0.9;
          return gloss(lit(b ? "#a8841e" : "#d4ad3a", c.n, 0.55, 0.55), c.n, 0.6, 14);
        },
      });
      // A velvet lining in the cup, under the ball.
      k.add(
        k.param(
          (u, v) => {
            const a = u * TAU;
            const th = v * 0.63;
            const r = R * 1.01;
            return [
              r * Math.sin(th) * Math.cos(a),
              cy - r * Math.cos(th),
              r * Math.sin(th) * Math.sin(a),
            ];
          },
          { grid: 32, thick: 0.02 },
        ),
        { flat: 0.2, color: (c) => lit("#5b2a86", mul(c.n, -1), 0.7, 0.3) },
      );
      // Little claws holding the ball.
      for (let i = 0; i < 4; i++) {
        const a = (i / 4) * TAU + TAU / 8;
        const d = [Math.cos(a), 0, Math.sin(a)];
        k.add(k.ellipsoid(0.07, 0.2, 0.05), {
          pos: [d[0] * 0.8, -0.28, d[2] * 0.8],
          quat: quatFromTo([0, 1, 0], unit([-d[0] * 0.4, 1, -d[2] * 0.4])),
          weight: 1.5,
          color: (c) => gloss(lit("#d4ad3a", c.n, 0.55, 0.55), c.n, 0.6, 14),
        });
      }
    },
  },
};

// How far the geode's front half and the oyster's lid swing open (radians).
const GEODE_SWING = 0.8 * Math.PI;
const PEARL_SWING = 1.15;
