// Sports balls. Generic designs only: classic panels, seams and stitching,
// no logos or league marks. Seams and stitches are kept out of the pattern
// layer, so a ball in the colours of a flag keeps its seams. Tap a ball to
// make it hop; Move > Bounce keeps it bouncing.

import {
  mix,
  rgb,
  shade,
  smoothstep,
  fibonacciSphere,
  quatFromTo,
  quatAxisAngle,
  quatMul,
  quatRotate,
  clamp,
} from "../kit.js";

const TAU = Math.PI * 2;
const PHI = (1 + Math.sqrt(5)) / 2;
const unit = (v) => {
  const l = Math.hypot(v[0], v[1], v[2]) || 1;
  return [v[0] / l, v[1] / l, v[2] / l];
};
const dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
const cross = (a, b) => [
  a[1] * b[2] - a[2] * b[1],
  a[2] * b[0] - a[0] * b[2],
  a[0] * b[1] - a[1] * b[0],
];
const keep = (c, size) => ({ c, keep: true, size });

// Fine pebbling: a little light and shade at high frequency.
const pebble = (c, col, amount = 0.08, f = 38) =>
  shade(col, 1 - amount * 0.5 + amount * c.noise(c.lp[0] * f, c.lp[1] * f, c.lp[2] * f));

// Soft studio light baked into the colours (splats are unlit): a key light
// from the upper left and a highlight where it glints towards the home view.
// Materials read from this, not from random speckle.
const LIGHT = unit([-0.35, 0.8, 0.5]);
const VIEW = unit([0.5, 0.28, 0.82]);
const HALF = unit([LIGHT[0] + VIEW[0], LIGHT[1] + VIEW[1], LIGHT[2] + VIEW[2]]);
function lit(col, n, { sheen = 0, tight = 30, soft = 0.22 } = {}) {
  const out = shade(col, 1 - soft + soft * (0.5 + 0.5 * dot(n, LIGHT)) + soft * 0.1);
  if (!sheen) return out;
  return mix(out, "#ffffff", sheen * Math.max(0, dot(n, HALF)) ** tight);
}

// The key light's brightness in lit() at normal n, and lit()'s light as
// out = a * base + b (for glossSpin()).
const keyF = (n, soft = 0.22) => 1 - soft + soft * (0.5 + 0.5 * dot(n, LIGHT)) + soft * 0.1;
const litLight =
  ({ sheen = 0, tight = 30, soft = 0.22 } = {}) =>
  (n) => {
    const s = sheen * Math.max(0, dot(n, HALF)) ** tight;
    return { a: keyF(n, soft) * (1 - s), b: [s, s, s] };
  };

// Pebbled grain as real bumps: a cellular pattern of small domes (about
// `f` across the ball's radius). Returns the bumped normal and how deep in a
// crevice between pebbles the point is (0..1).
function hash3(x, y, z, k) {
  let h = Math.imul(x, 374761393) ^ Math.imul(y, 668265263) ^ Math.imul(z, 1440662683) ^ k;
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
}
function pebbled(c, f, depth = 0.5) {
  const x = c.lp[0] * f;
  const y = c.lp[1] * f;
  const z = c.lp[2] * f;
  const ix = Math.floor(x);
  const iy = Math.floor(y);
  const iz = Math.floor(z);
  let best = 9;
  let off = [0, 0, 0];
  for (let dx = -1; dx <= 1; dx++)
    for (let dy = -1; dy <= 1; dy++)
      for (let dz = -1; dz <= 1; dz++) {
        const cx = ix + dx;
        const cy = iy + dy;
        const cz = iz + dz;
        const ox = x - (cx + hash3(cx, cy, cz, 1));
        const oy = y - (cy + hash3(cx, cy, cz, 2));
        const oz = z - (cz + hash3(cx, cy, cz, 3));
        const d = ox * ox + oy * oy + oz * oz;
        if (d < best) {
          best = d;
          off = [ox, oy, oz];
        }
      }
  const d = Math.sqrt(best);
  const n = c.n;
  const along = dot(off, n);
  const t = [off[0] - n[0] * along, off[1] - n[1] * along, off[2] - n[2] * along];
  return {
    n: unit([n[0] + t[0] * depth, n[1] + t[1] * depth, n[2] + t[2] * depth]),
    crevice: smoothstep(0.45, 0.75, d),
  };
}

// A pebbled, lit surface colour.
function grip(
  c,
  col,
  { f = 60, depth = 0.6, crevice = 0.18, sheen = 0, tight = 30, soft = 0.22 } = {},
) {
  const b = pebbled(c, f, depth);
  return lit(shade(col, 1 - crevice * b.crevice), b.n, { sheen, tight, soft });
}

// A faint shell of round, see-through splats just outside a dark toy. Seen
// face on it is almost invisible; at the silhouette the eye looks through a
// long stretch of it, so it adds up to a soft rim of light that lifts a black
// ball off a dark page (and barely shows on a light one).
function rim(k, shape, opts = {}) {
  k.add(shape, {
    part: k.part("rim"),
    flat: 1,
    size: 1.6,
    weight: 0.35,
    opacity: 0.009,
    jitter: 0,
    color: "#aeb8c4",
    pattern: false,
    ...opts,
  });
}

// The seam of a tennis ball or baseball: a curve on the unit sphere made of
// two interlocking lobes (a + b = 1 keeps it on the sphere).
function seamCurve(a = 0.72, n = 360) {
  const b = 1 - a;
  const pts = [];
  for (let i = 0; i < n; i++) {
    const t = (i / n) * TAU;
    pts.push([
      a * Math.cos(t) + b * Math.cos(3 * t),
      a * Math.sin(t) - b * Math.sin(3 * t),
      2 * Math.sqrt(a * b) * Math.sin(2 * t),
    ]);
  }
  const tangents = pts.map((p, i) => unit(sub(pts[(i + 1) % n], pts[(i - 1 + n) % n])));
  // Nearest point: angular distance, curve position (0..1) and which side.
  return (d) => {
    let best = -2;
    let bi = 0;
    for (let i = 0; i < n; i++) {
      const v = dot(d, pts[i]);
      if (v > best) {
        best = v;
        bi = i;
      }
    }
    const side = Math.sign(dot(cross(tangents[bi], pts[bi]), d)) || 1;
    return { dist: Math.acos(clamp(best, -1, 1)), t: bi / n, side };
  };
}
function sub(a, b) {
  return [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
}

// A plain ball body with a darker core for Slice. Colour noise is low: the
// material comes from the colour function.
// The shell is part "ball" and its inside part "core", so a tap can spin
// it (see "Real throws and bounces").
function body(k, color, opts = {}) {
  const ball = k.part("ball");
  const core = k.part("core");
  const look = { flat: 0.18, jitter: 0.012, even: true, color, ...opts };
  const shell = k.add(k.sphere(1), {
    interior: 0.12,
    core: opts.core || "#3b2a22",
    part: (c) => (c.inside ? core : ball),
    ...look,
  });
  // Even placement leaves a tiny swirl at the sphere's two poles, unseen at
  // rest (the top one is edge-on); a spinning ball turns them into view, so
  // two small caps of the same surface cover them. (Surface only: their
  // inside splats would turn with the shell and show as dark dots.)
  for (const s of [1, -1]) k.add(poleCap(k, s), { ...look, interior: 0, part: ball });
  return shell;
}
function poleCap(k, s, a = 0.14) {
  return k.param(
    (u, v) => {
      const th = a * v;
      const ph = TAU * u;
      return [Math.sin(th) * Math.cos(ph), s * Math.cos(th), s * Math.sin(th) * Math.sin(ph)];
    },
    { grid: 16 },
  );
}

// Leather ball with stitched seam (baseball, softball).
function stitchedBall(k, leather, stitch, { a = 0.72, n = 108 } = {}) {
  const seam = seamCurve(a);
  // Its colours and what it is (for the light): groove, stitch, band or
  // leather.
  const part = (c) => {
    const s = seam(c.ln);
    if (s.dist < 0.012) return "groove";
    if (s.dist < 0.075) {
      const across = (s.dist - 0.012) / 0.063;
      const f = (s.t * n + across * 0.6 * s.side + 10) % 1;
      return across > 0.14 && across < 0.92 && f < 0.4 ? "stitch" : "band";
    }
    return "leather";
  };
  const PAINT = {
    groove: (c) => keep(c(shade(leather, 0.72))),
    stitch: (c) => keep(c(stitch), 0.6),
    band: (c) => keep(c(shade(leather, 0.93))),
    leather: (c) => c(leather),
  };
  body(k, (c) => {
    // Smooth leather with a soft sheen; the seam is a fine groove, with two
    // rows of angled stitches, one each side, standing proud of the leather:
    // crisp, small splats and a touch of shine.
    const p = part(c);
    const light = { groove: {}, stitch: { sheen: 0.25, tight: 12 }, band: { sheen: 0.1 }, leather: { sheen: 0.14, tight: 16 } }[p]; // prettier-ignore
    return PAINT[p]((col) => lit(col, c.n, light));
  });
  glossSpin(k, (c) => PAINT[part(c)]((col) => col), litLight({ sheen: 0.14, tight: 16 }));
}

// Truncated icosahedron faces (soccer ball): 12 pentagon and 20 hexagon
// centres; a point belongs to the face its ray meets first.
function soccerFaces() {
  const pent = [];
  for (const s1 of [-1, 1])
    for (const s2 of [-1, 1]) {
      pent.push(unit([0, s1, s2 * PHI]), unit([s1, s2 * PHI, 0]), unit([s2 * PHI, 0, s1]));
    }
  const hex = [];
  for (const x of [-1, 1])
    for (const y of [-1, 1]) for (const z of [-1, 1]) hex.push(unit([x, y, z]));
  const ip = 1 / PHI;
  for (const s1 of [-1, 1])
    for (const s2 of [-1, 1]) {
      // Face centres of the icosahedron above (its dual dodecahedron).
      hex.push(
        unit([0, s1 * PHI, s2 * ip]),
        unit([s2 * ip, 0, s1 * PHI]),
        unit([s1 * PHI, s2 * ip, 0]),
      );
    }
  // Face distances from the centre for edge length 1.
  const faces = [
    ...pent.map((n) => ({ n, h: 2.3274, pent: true })),
    ...hex.map((n) => ({ n, h: 2.2673, pent: false })),
  ];
  return (d) => {
    let t1 = Infinity;
    let t2 = Infinity;
    let f1 = null;
    for (const f of faces) {
      const c = dot(d, f.n);
      if (c <= 0) continue;
      const t = f.h / c;
      if (t < t1) {
        t2 = t1;
        t1 = t;
        f1 = f;
      } else if (t < t2) t2 = t;
    }
    return { pent: f1.pent, edge: (t2 - t1) / t1 };
  };
}

// Volleyball-style strips: three strips on each face of a cube, turning a
// quarter each face so the panels interlock.
function strips(d) {
  const a = [Math.abs(d[0]), Math.abs(d[1]), Math.abs(d[2])];
  const i = a[0] > a[1] ? (a[0] > a[2] ? 0 : 2) : a[1] > a[2] ? 1 : 2;
  const j = (i + 1) % 3;
  const w = d[j] / a[i];
  const strip = Math.min(2, Math.floor((w + 1) * 1.5));
  const edgeStrip = Math.min(Math.abs(w + 1 / 3), Math.abs(w - 1 / 3)) * a[i];
  const sorted = a.slice().sort((x, y) => y - x);
  const edgeFace = sorted[0] - sorted[1];
  return { face: i * 2 + (d[i] > 0 ? 1 : 0), strip, seam: Math.min(edgeStrip, edgeFace) };
}

// A blocky stroke font for pool-ball numbers: segments in a 1 x 2 box.
const DIGITS = {
  0: [
    [0, 0, 1, 0],
    [1, 0, 1, 2],
    [1, 2, 0, 2],
    [0, 2, 0, 0],
  ],
  1: [
    [0.5, 0, 0.5, 2],
    [0.15, 1.6, 0.5, 2],
    [0.15, 0, 0.85, 0],
  ],
  2: [
    [0, 2, 1, 2],
    [1, 2, 1, 1],
    [1, 1, 0, 1],
    [0, 1, 0, 0],
    [0, 0, 1, 0],
  ],
  3: [
    [0, 2, 1, 2],
    [1, 2, 1, 0],
    [1, 0, 0, 0],
    [0.2, 1, 1, 1],
  ],
  4: [
    [0, 2, 0, 1],
    [0, 1, 1, 1],
    [1, 2, 1, 0],
  ],
  5: [
    [1, 2, 0, 2],
    [0, 2, 0, 1],
    [0, 1, 1, 1],
    [1, 1, 1, 0],
    [1, 0, 0, 0],
  ],
  6: [
    [1, 2, 0, 2],
    [0, 2, 0, 0],
    [0, 0, 1, 0],
    [1, 0, 1, 1],
    [1, 1, 0, 1],
  ],
  7: [
    [0, 2, 1, 2],
    [1, 2, 0.35, 0],
  ],
  8: [
    [0, 0, 1, 0],
    [1, 0, 1, 2],
    [1, 2, 0, 2],
    [0, 2, 0, 0],
    [0, 1, 1, 1],
  ],
  9: [
    [1, 1, 0, 1],
    [0, 1, 0, 2],
    [0, 2, 1, 2],
    [1, 2, 1, 0],
    [1, 0, 0, 0],
  ],
};
function segDist(px, py, [x0, y0, x1, y1]) {
  const dx = x1 - x0;
  const dy = y1 - y0;
  const t = clamp(((px - x0) * dx + (py - y0) * dy) / (dx * dx + dy * dy || 1), 0, 1);
  return Math.hypot(px - x0 - dx * t, py - y0 - dy * t);
}
// Distance from (x, y) to the strokes of a number centred at the origin,
// in units where a digit is `h` tall.
function numberDist(text, x, y, h) {
  const s = h / 2;
  const gap = 0.45;
  const width = text.length + (text.length - 1) * gap;
  let best = Infinity;
  for (let i = 0; i < text.length; i++) {
    const ox = -width / 2 + i * (1 + gap);
    for (const seg of DIGITS[text[i]])
      best = Math.min(best, segDist(x / s - ox, y / s + 1, seg) * s);
  }
  return best;
}

const POOL = [
  "#f5f3ec",
  "#f4c20d",
  "#1d4fb4",
  "#d62828",
  "#5b2a86",
  "#f77f00",
  "#0b7a3b",
  "#7f1d1d",
  "#111111",
];

function numberChoices() {
  const out = [{ id: "cue", label: "Cue ball" }];
  for (let i = 1; i <= 15; i++) out.push({ id: `n${i}`, label: `${i}` });
  return out;
}

// A marbled swirl (bowling balls, bouncy balls).
function swirl(c, colors, f = 1.6) {
  const n = c.fbm(c.lp[0] * f, c.lp[1] * f, c.lp[2] * f, 4);
  const v = 0.5 + 0.5 * Math.sin((c.lp[1] * 2 + n * 5) * Math.PI);
  const w = 0.5 + 0.5 * Math.sin((c.lp[0] * 1.5 - n * 4) * Math.PI);
  const a = mix(colors[0], colors[1], smoothstep(0.2, 0.8, v));
  return colors[2] ? mix(a, colors[2], smoothstep(0.7, 0.95, w) * 0.8) : a;
}

// ---- Throws ------------------------------------------------------------------------
// A tap throws the ball the way the real one flies. e is seconds since the
// tap (-1 at rest); the ball goes up and comes back down into place.
const band01 = (x, a, b) => clamp((x - a) / (b - a), 0, 1);
const easeIO = (x) => x * x * (3 - 2 * x);
const sinceTap = (c, key, secs) => (c[key] > 0 ? (1 - c[key]) * secs : -1);
const throwPulse = (key, label, secs) => ({
  controls: [{ key, label, type: "pulse", ease: secs }],
  action: { key, label },
});
// The puck's size in its recipe (the fit maps it to one toy radius).
const PUCK_R = Math.hypot(1.035, 0.185);
// v turned by quaternion q.
const rotate = (q, v) => {
  const [x, y, z, w] = q;
  const ix = w * v[0] + y * v[2] - z * v[1];
  const iy = w * v[1] + z * v[0] - x * v[2];
  const iz = w * v[2] + x * v[1] - y * v[0];
  const iw = -x * v[0] - y * v[1] - z * v[2];
  return [
    ix * w + iw * -x + iy * -z - iz * -y,
    iy * w + iw * -y + iz * -x - ix * -z,
    iz * w + iw * -z + ix * -y - iy * -x,
  ];
};
// Height of a throw (in toy radii) that peaks at `peak` half way through.
const arc = (f, peak) => peak * 4 * f * (1 - f);

// ---- Real throws and bounces (E6a) ------------------------------------------------
// A tap sends a ball along a plan of legs: real arcs under the ball's own
// gravity, bounces that lose height by its restitution, the spin a kick or a
// bounce gives it, and a squash on the floor as soft as the ball.
//
// A moving ball is its own part ("ball"), so it can spin freely. While it is
// turned it culls its far side, which would otherwise draw over its near
// side (splats sort in their built pose: docs/PACKS.md 7b), with splats a
// little bigger to close the gaps the far side filled, and its inside
// ("core", for Slice) hides. The whole toy squashes on the floor (body).

// The home view: across the screen (to the right) and towards the camera,
// both along the floor.
const ACROSS = unit([VIEW[2], 0, -VIEW[0]]);
const TOWARD = unit([VIEW[0], 0, VIEW[2]]);
const UP = [0, 1, 0];
const IDQ = [0, 0, 0, 1];
const CULL_SIZE = 1.15;
const add3 = (a, b) => [a[0] + b[0], a[1] + b[1], a[2] + b[2]];
const scale3 = (a, s) => [a[0] * s, a[1] * s, a[2] * s];
const lerp3 = (a, b, t) => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t]; // prettier-ignore
// A point on the floor plan: x across the screen, z towards the camera, y up.
const at3 = (x, y = 0, z = 0) => add3(add3(scale3(ACROSS, x), scale3(TOWARD, z)), [0, y, 0]);
// The axis a ball rolls about when it moves along d (topspin for d).
const rollAxis = (d) => unit(cross(UP, d));
const easeOut = (x) => 1 - (1 - x) * (1 - x);
const EASE = { linear: (x) => x, out: easeOut, inout: easeIO, in: (x) => x * x };
// Each ball's gravity, in its own radii per second squared: a slowed-down
// real g over the real ball's radius (metres), so a big ball falls slowly
// for its size and a small one snaps.
const grav = (r) => 1.4 / r;
const KICK = [
  { voice: "thud", f: 100, bright: 0.5, vol: 0.8 },
  { voice: "slap", f: 1100, vol: 0.4 },
];

// Legs, in ball radii (the ball rests at [0, 0, 0] with its bottom on the
// floor, so y is its height) and seconds. Each starts where the last ended:
//   { fly: T, to, spin, axis }  a free flight that lands at `to` after T s
//        (or { fly: { h }, ... }: its top h above where it starts); spin
//        in turns per second about axis; `g` for a gravity of its own
//   { hit: w, squash, spin, axis }  w s on the floor, squashing by `squash`
//        (a soft ball's squash rings on: `ring` Hz, dying by `damp` per s)
//   { roll: T, to, ease }  rolls along the floor without slipping
//   { rollPath: T, pos(u) }  rolls along any path on the floor
//   { turn: T, turns, axis, ease }  spins in place
//   { wait: T }
//   { path: T, pos(u, s), spin, axis }  anything else: pos gives the place
//        at u = 0..1 (s in seconds)
// Any leg may also give angle(u, s) (radians about axis), squash(u, s),
// rot(u, s) (its own turn, a quaternion) and tilt(u, s) (a wobble that is
// back to none at both ends).
// The free spin about each axis is scaled so the turns about it come to a
// whole number (rolls and legs marked `fixed` count but keep their angle),
// so the ball comes back to rest as it started.
const axisKey = (a) => {
  const s = Math.abs(a[0]) > 1e-6 ? Math.sign(a[0]) : Math.abs(a[1]) > 1e-6 ? Math.sign(a[1]) : Math.sign(a[2]); // prettier-ignore
  return { key: a.map((v) => (v * s).toFixed(5)).join(","), sign: s };
};
function plan(g, legs) {
  const pass = (scale, fix) => {
    let p = [0, 0, 0];
    let q = IDQ;
    let t = 0;
    const turned = new Map();
    const count = (axis, angle, fixed) => {
      const { key, sign } = axisKey(axis);
      const c = turned.get(key) ?? { pos: 0, neg: 0, fixed: 0 };
      const a = angle * sign;
      if (fixed) c.fixed += a;
      else c[a >= 0 ? "pos" : "neg"] += a;
      turned.set(key, c);
    };
    const segs = legs.map((L) => {
      const p0 = p;
      const s = { L, t0: t, p0, q0: q, axis: L.axis, kscale: 1 };
      if (L.fly !== undefined) {
        const to = L.to ?? p0;
        const gl = L.g ?? g;
        let T = L.fly;
        if (typeof T === "object") {
          const top = p0[1] + T.h;
          T = Math.sqrt((2 * (top - p0[1])) / gl) + Math.sqrt((2 * Math.max(0, top - to[1])) / gl);
        }
        s.T = T;
        s.p1 = to;
        s.vy = (to[1] - p0[1]) / T + 0.5 * gl * T;
        s.pos = (u, e) => {
          const h = lerp3(p0, to, u);
          h[1] = p0[1] + s.vy * e - 0.5 * gl * e * e;
          return h;
        };
      } else if (L.roll !== undefined) {
        const to = L.to;
        const d = [to[0] - p0[0], 0, to[2] - p0[2]];
        const dist = Math.hypot(d[0], d[2]);
        const f = EASE[L.ease ?? "out"];
        s.T = L.roll;
        s.p1 = to;
        s.pos = (u) => lerp3(p0, to, f(u));
        s.rollAxis = dist > 1e-6 ? rollAxis(d) : null;
        s.rollAngle = (u) => dist * f(u);
        if (s.rollAxis) count(s.rollAxis, dist, true);
      } else if (L.rollPath !== undefined) {
        // Rolled step by step: each step turns the ball about the axis
        // across its way, by the distance.
        s.T = L.rollPath;
        const N = 240;
        const pts = [];
        const qs = [IDQ];
        for (let i = 0; i <= N; i++) pts.push(L.pos(i / N));
        for (let i = 1; i <= N; i++) {
          const d = [pts[i][0] - pts[i - 1][0], 0, pts[i][2] - pts[i - 1][2]];
          const len = Math.hypot(d[0], d[2]);
          qs.push(len > 1e-9 ? quatMul(quatAxisAngle(rollAxis(d), len), qs[i - 1]) : qs[i - 1]);
        }
        s.p1 = pts[N];
        s.pos = (u) => L.pos(u);
        s.pathRot = (u) => {
          const x = clamp(u, 0, 1) * N;
          const i = Math.min(N - 1, Math.floor(x));
          return nlerp(qs[i], qs[i + 1], x - i);
        };
      } else if (L.path !== undefined) {
        s.T = L.path;
        s.pos = L.pos;
        s.p1 = L.pos(1, s.T);
      } else {
        s.T = L.hit ?? L.turn ?? L.wait;
        s.p1 = p0;
        s.pos = () => p0;
      }
      s.angle = (u, e) => {
        if (L.angle) return L.angle(u, e) * s.kscale;
        if (L.turns !== undefined) return TAU * L.turns * EASE[L.ease ?? "linear"](u) * s.kscale;
        return TAU * (L.spin ?? 0) * e * s.kscale;
      };
      if (L.axis && !L.fixed) {
        const k = axisKey(L.axis);
        const sc = scale.get(k.key);
        if (sc) s.kscale = s.angle(1, s.T) * k.sign >= 0 ? sc.a : sc.b;
      }
      s.rot = (u, e) => {
        let r = L.rot ? L.rot(u, e) : IDQ;
        if (s.axis) r = quatMul(quatAxisAngle(s.axis, s.angle(u, e)), r);
        if (s.rollAxis) r = quatMul(quatAxisAngle(s.rollAxis, s.rollAngle(u)), r);
        if (s.pathRot) r = quatMul(s.pathRot(u), r);
        if (L.tilt) r = quatMul(L.tilt(u, e), r);
        if (L.absorb && fix) r = quatMul(quatAxisAngle(fix.axis, fix.angle * easeIO(u)), r);
        return r;
      };
      if (s.axis) count(s.axis, s.angle(1, s.T), !!L.fixed);
      s.q1 = quatMul(s.rot(1, s.T), q);
      p = s.p1;
      q = s.q1;
      t += s.T;
      return s;
    });
    return { segs, T: t, turned };
  };
  // Whole turns about each axis: scale the spins one way (or both) by as
  // little as will do.
  const first = pass(new Map());
  const scale = new Map();
  for (const [key, c] of first.turned) {
    const free = c.pos + c.neg;
    if (Math.abs(c.pos) + Math.abs(c.neg) < 1e-9) continue;
    const r = Math.round((free + c.fixed) / TAU);
    let best = null;
    const offer = (a, b) => {
      if (!(a > 0 && b > 0)) return;
      const cost = Math.abs(Math.log(a)) + Math.abs(Math.log(b));
      if (!best || cost < best.cost) best = { a, b, cost };
    };
    for (const n of [r - 1, r, r + 1]) {
      const need = n * TAU - c.fixed;
      if (c.pos > 1e-9) offer((need - c.neg) / c.pos, 1);
      if (c.neg < -1e-9) offer(1, (need - c.pos) / c.neg);
      if (Math.abs(free) > 1e-9) offer(need / free, need / free);
    }
    if (best) scale.set(key, best);
  }
  // A leg marked `absorb` (a last settling roll) takes up what is left, so
  // the ball ends exactly as it started.
  let { segs, T } = pass(scale);
  if (legs.some((L) => L.absorb)) {
    const q = segs[segs.length - 1].q1;
    const w = clamp(q[3], -1, 1);
    const sn = Math.sqrt(Math.max(0, 1 - w * w));
    if (sn > 1e-7) {
      const angle = -2 * Math.atan2(sn, w);
      ({ segs, T } = pass(scale, { axis: [q[0] / sn, q[1] / sn, q[2] / sn], angle }));
    }
  }
  return {
    T,
    segs,
    at(e) {
      if (e < 0 || e >= T) return { p: [0, 0, 0], q: IDQ, squash: 0, seg: null };
      let i = 0;
      while (i + 1 < segs.length && segs[i + 1].t0 <= e) i++;
      const s = segs[i];
      const le = e - s.t0;
      const u = s.T > 0 ? clamp(le / s.T, 0, 1) : 1;
      const p = s.pos(u, le);
      const q = quatMul(s.rot(u, le), s.q0);
      const L = s.L;
      let squash = 0;
      if (L.squash !== undefined)
        squash = typeof L.squash === "function" ? L.squash(u, le) : L.squash * Math.sin(Math.PI * u); // prettier-ignore
      // A soft ball's squash rings on after it leaves the floor.
      const prev = segs[i - 1];
      if (L.hit === undefined && prev?.L.ring) {
        const r = prev.L;
        squash += -(r.squash ?? 0) * 0.5 * Math.sin(TAU * r.ring * le) * Math.exp(-r.damp * le);
      }
      return { p, q, squash, seg: s };
    },
  };
}
const nlerp = (a, b, t) => {
  const d = a[0] * b[0] + a[1] * b[1] + a[2] * b[2] + a[3] * b[3] < 0 ? -1 : 1;
  const q = [0, 1, 2, 3].map((i) => a[i] + (b[i] * d - a[i]) * t);
  const l = Math.hypot(...q) || 1;
  return q.map((v) => v / l);
};

// A flight through air that slows a light ball hard (drag that grows with
// the square of its speed, falling no faster than vt): from the floor up to
// H, then down again, slowly. drift(u) moves it sideways on the way.
function dragFlight(H, g, vt, { drift, ...more } = {}) {
  const phi = Math.atan(Math.sqrt(Math.exp((2 * g * H) / (vt * vt)) - 1));
  const up = (vt * phi) / g;
  const T = up + (vt / g) * Math.acosh(Math.exp((H * g) / (vt * vt)));
  const y = (e) =>
    e < up
      ? ((vt * vt) / g) * Math.log(Math.cos(phi - (g * e) / vt) / Math.cos(phi))
      : H - ((vt * vt) / g) * Math.log(Math.cosh((g * (e - up)) / vt));
  const pos = (u, e) => {
    const p = drift ? drift(u) : [0, 0, 0];
    p[1] = Math.max(0, y(e ?? u * T));
    return p;
  };
  return { path: T, pos, ...more };
}

// Bounces that lose height: from the floor, each flight is `e` times shorter
// and e^2 lower than the last. opts: h (the first height), e (restitution),
// n (how many), w (contact time), squash (at the first landing; less as the
// landings soften), spin/axis (turns per second, `keep` of it kept at each
// bounce), to(i) (where flight i lands; home by default), ring/damp, and
// cue(i, k) (the sound of landing i, k = its strength 0..1).
function bounces(g, o) {
  const { h, e, n, w = 0.05, squash = 0.1, spin = 0, axis, keep = 0.7, to, ring, damp, cue } = o;
  const legs = [];
  for (let i = 0; i <= n; i++) {
    const k = e ** i;
    const hit = { hit: w * Math.sqrt(k), squash: squash * k, spin: spin * keep ** i, axis, ring, damp }; // prettier-ignore
    legs.push({ ...hit, cue: cue?.(i, k) });
    if (i === n) break;
    legs.push({ fly: { h: h * k * k }, to: to ? to(i) : [0, 0, 0], spin: spin * keep ** (i + 0.5), axis }); // prettier-ignore
  }
  return legs;
}

// Spin that runs down to a stop in T s from `rate` turns per second.
const spinDown = (T, rate, axis, more = {}) => ({
  turn: T,
  axis,
  angle: (u) => TAU * rate * T * (u - (u * u) / 2),
  ...more,
});

// Shows a ball's pose: its shell and core parts move together, the shell
// culls its far side while turned and the core hides.
function showBall(out, { p, q, squash }, more = {}) {
  const turned = Math.abs(q[3]) < 0.9998;
  out.parts.ball = { offset: p, quat: q, cull: turned, visible: turned ? CULL_SIZE : 1, ...more };
  out.parts.core = { offset: p, visible: turned ? 0 : 1 };
  // A see-through rim shell (dark balls) only moves: it looks the same turned.
  out.parts.rim = { offset: p };
  if (squash) {
    // The squash widens the toy about its centre: keep the ball's place.
    const k = 1 + 0.5 * squash;
    const o = [p[0] / k, p[1], p[2] / k];
    out.parts.ball.offset = out.parts.core.offset = out.parts.rim.offset = o;
    out.body = { squash };
  }
}

// Spinning a glossy ball. Its light is baked into its colours, so a copy
// that spins would carry its highlight round with it (a rolling pool ball
// would look like glass). While it moves it shows instead an unlit copy that
// spins ("spin": built tiny at the centre, so it always sorts behind, and
// grown to size by its part) under a fixed layer of light ("light": a
// see-through shell that darkens and brightens what is under it just as
// the baked light did: out = a * base + b). At rest the ball is itself.
// The unlit copy leaves the flag pattern out (it is built too small to map
// it), so a flag shows only at rest.
const SPIN_R = 0.04;
const SPIN_SCALE = 1 / SPIN_R;
// How many light splats cover a point, as a power (calibrated on renders
// against the ball at rest); more towards the outline, where the eye looks
// along the layer.
const LIGHT_OVERLAP = 3.1;
const lightOverlap = (n) => LIGHT_OVERLAP * (1 + 1.5 * (1 - Math.max(0, dot(n, VIEW))) ** 2);
function glossSpin(k, albedo, light, { weight = 0.5, share = 0.12, size = 2.2, flat = 0.25 } = {}) {
  k.add(k.sphere(SPIN_R), {
    part: k.part("spin"),
    flat,
    even: true,
    pattern: false,
    opacity: 1,
    jitter: 0.008,
    weight: weight / (SPIN_R * SPIN_R),
    color: albedo,
  });
  const pts = fibonacciSphere(Math.max(64, Math.round(share * k.count)));
  k.cloud(
    { count: pts.length * (160000 / k.count), size, part: k.part("light"), pattern: false },
    (rand, i) => {
      const n = pts[i];
      const { a, b } = light(n);
      const alpha = clamp(1 - a, 0, 0.995);
      const col = alpha > 1e-4 ? b.map((v) => clamp(v / alpha, 0, 1)) : [0, 0, 0];
      return {
        p: scale3(n, 1.004),
        n,
        flat: 0.06,
        color: col,
        opacity: 1 - (1 - alpha) ** (1 / lightOverlap(n)),
      };
    },
  );
}
// Shows a glossy ball's pose: the unlit copy spins under the fixed light
// while it moves; at rest the ball shows as itself.
function showGloss(out, pose, moving) {
  const { p, q } = pose;
  const o = out.parts.ball.offset;
  out.parts.ball.visible = moving ? 0 : 1;
  out.parts.core.visible = moving ? 0 : out.parts.core.visible;
  out.parts.spin = { offset: o, quat: q, scale: SPIN_SCALE, cull: true, visible: moving ? CULL_SIZE : 0 }; // prettier-ignore
  out.parts.light = { offset: o, visible: moving ? 1 : 0 };
}

// Per-toy memory for drive() (the sounds' clock), keyed by the control state
// object, which is new each time a toy loads.
const MEM = new WeakMap();
function mem(c) {
  let m = MEM.get(c);
  if (!m) MEM.set(c, (m = {}));
  return m;
}
// Later sounds of a tap: each [at, spec] plays when the effect's clock e
// (seconds since the tap, -1 at rest) passes `at`.
function cuesAt(c, e, list, out) {
  const m = mem(c);
  const was = m.cueE ?? -1;
  m.cueE = e;
  if (e < 0 || e < was) return;
  for (const [at, spec] of list) if (was < at && e >= at) out.cues.push(spec);
}

// A ball's tap: a pulse that lasts the plan, a drive that shows it, and the
// legs' later sounds. `gloss`: the ball spins as glossSpin() built it.
function throwBall(key, label, g, legs, { extra, gloss } = {}) {
  const P = plan(g, legs);
  const secs = P.T + 0.05;
  // A leg's `cue` sounds as it starts (the first is the tap's own sound).
  const cues = P.segs.filter((s) => s.L.cue && s.t0 > 0.02).map((s) => [s.t0, s.L.cue]);
  return {
    ...throwPulse(key, label, secs),
    plan: P,
    drive(t, c, out, info) {
      const e = sinceTap(c, key, secs);
      const pose = P.at(e);
      showBall(out, pose);
      if (gloss) showGloss(out, pose, e >= 0 && e < P.T);
      cuesAt(c, e, cues, out);
      if (extra) extra(e, pose, c, out, info);
    },
  };
}

// ---- The balls' plans ----------------------------------------------------------------

// The lowest point of the ball's outline in the home view (on the ball at
// rest): a fingertip there touches the ball without crossing it.
const LIMB = unit(add3([0, -1, 0], scale3(VIEW, VIEW[1])));
const BOUNCE = (i, k) => [
  { voice: "boing", f: 95, to: 0.8, rate: 30, decay: 0.6, vol: 0.9 * k },
  { voice: "slap", f: 900, vol: 0.6 * k },
];
// One dribble: up from the floor to the hand, which pushes it back down
// harder than it fell.
function dribble(g, H, push = 3) {
  const v0 = Math.sqrt(2 * g * H);
  const up = v0 / g;
  const down = Math.sqrt((2 * H) / (push * g));
  const y = (e) => (e < up ? v0 * e - 0.5 * g * e * e : H - 0.5 * push * g * (e - up) ** 2);
  return { path: up + down, pos: (u, e) => [0, Math.max(0, y(e ?? u * (up + down))), 0] };
}
const BB_G = grav(0.12);
const BB_HIT = (i) => ({ hit: 0.045, squash: 0.1, cue: BOUNCE(i, 1) });
const BB_FINGER_Y = 0.45;
const BASKETBALL = [
  dribble(BB_G, 0.38),
  BB_HIT(0),
  dribble(BB_G, 0.36),
  BB_HIT(1),
  dribble(BB_G, 0.36),
  BB_HIT(2),
  // The toss onto the fingertip, set spinning.
  { fly: { h: 0.7 }, to: [0, BB_FINGER_Y, 0], spin: 1.6, axis: UP },
  {
    path: 0.14,
    pos: (u) => [0, BB_FINGER_Y - 0.05 * Math.sin(Math.PI * u), 0],
    spin: 3.2,
    axis: UP,
  },
  {
    turn: 1.1,
    axis: UP,
    angle: (u, e) => TAU * (3.2 * e - (0.6 / 1.1) * e * e),
    tilt: (u, e) =>
      quatAxisAngle([Math.cos(9 * e), 0, Math.sin(9 * e)], 0.09 * Math.sin(Math.PI * u)),
  },
  { fly: { h: 0.001 }, to: [0, 0, 0], spin: 2.2, axis: UP },
  ...bounces(BB_G, {
    h: BB_FINGER_Y * 0.61,
    e: 0.78,
    n: 2,
    squash: 0.12,
    spin: 2,
    axis: UP,
    keep: 0.8,
    cue: (i, k) => BOUNCE(i, 0.9 * k),
  }),
  spinDown(0.45, 1.2, UP),
];
// When the hand comes up, catches the ball on its fingertip, spins it and
// drops away.
const BASKETBALL_HAND = (() => {
  const P = plan(BB_G, BASKETBALL);
  const toss = P.segs.find((s) => s.L.fly && s.L.axis === UP);
  const spin = P.segs.find((s) => s.L.tilt);
  return {
    rise: toss.t0 + 0.1,
    catch: toss.t0 + toss.T,
    spin: spin.t0,
    spinT: spin.T,
    drop: spin.t0 + spin.T,
  };
})();

// The basketball's robot hand: the index finger points up under the ball,
// the other fingers curl into a fist with the thumb across them, and the
// wrist and forearm come up from below. It is seen from the palm side,
// turned a little towards the thumb. Its own frame: x along the knuckles towards the
// thumb, y up the finger, z out of the palm; sizes in ball radii (times
// HAND_SIZE). It is built at half size inside the ball's sphere (the toy is
// framed by all its splats) and grown and moved into place by its parts,
// hidden at rest.
const HAND_Q = (() => {
  const a = 0.45;
  const thumb = add3(scale3(ACROSS, Math.cos(a)), scale3(TOWARD, Math.sin(a)));
  return quatAxisAngle(UP, Math.atan2(-thumb[2], thumb[0]));
})();
const HAND_SIZE = 1.12;
const handDir = (l) => quatRotate(HAND_Q, scale3(l, HAND_SIZE));
const HAND_BUILT = 0.5;
// The hand's knuckle (its origin) as built: the hand centred in the ball.
const HAND_AT = scale3(handDir([0.14, 0.52, 0]), HAND_BUILT);
const handB = (l) => add3(HAND_AT, scale3(handDir(l), HAND_BUILT));
// The index finger's joints up from its knuckle, its length and its joints
// curled (radians).
const INDEX_J = [0, 0.19, 0.33];
const INDEX_L = 0.44;
const INDEX_CURL = [0.5, 0.8, 0.5];
// How far below its hold the hand comes from and goes to, and how long it
// takes to go.
const HAND_LOW = 2.8;
const HAND_GO = 0.45;

// Shows the hand e s after the tap: it rises as the ball is tossed, its
// index straightening to meet it; holds it through the spin, dipping as it
// catches and swaying with the wobble; and drops away faster than the ball
// falls, the finger relaxing.
function showHand(out, e, pose) {
  const f = BASKETBALL_HAND;
  const names = ["hand", "index1", "index2", "index3"];
  if (!(e > f.rise && e < f.drop + HAND_GO)) {
    for (const n of names) out.parts[n] = { visible: 0 };
    return;
  }
  let lift = 0;
  let curl = 0;
  let sway = IDQ;
  let y = BB_FINGER_Y;
  if (e < f.catch) {
    lift = -HAND_LOW * (1 - easeOut(band01(e, f.rise, f.catch)));
    curl = 1 - easeIO(band01(e, f.catch - 0.3, f.catch));
  } else if (e < f.drop) {
    y = pose.p[1];
    const s = Math.max(0, e - f.spin);
    const w = 0.05 * Math.sin((Math.PI * s) / f.spinT);
    sway = quatAxisAngle([Math.cos(9 * s), 0, Math.sin(9 * s)], w);
  } else {
    const s = e - f.drop;
    lift = -HAND_LOW * (s / HAND_GO) ** 2;
    curl = 0.6 * easeIO(band01(s, 0, 0.25));
  }
  // The straight finger's tip on the ball; the hand turns about it.
  const tip = add3(LIMB, [0, y + lift, 0]);
  let j = sub(tip, quatRotate(sway, handDir([0, INDEX_L, 0])));
  const grow = 1 / HAND_BUILT;
  out.parts.hand = { quat: sway, scale: grow, offset: sub(j, HAND_AT), visible: 1 };
  let a = 0;
  for (let i = 0; i < 3; i++) {
    a += curl * INDEX_CURL[i];
    const q = quatMul(sway, quatAxisAngle(handDir([1, 0, 0]), a));
    const at = handB([0, INDEX_J[i], 0]);
    out.parts[names[i + 1]] = { quat: q, scale: grow, offset: sub(j, at), visible: 1 };
    if (i < 2) j = add3(j, quatRotate(q, handDir([0, INDEX_J[i + 1] - INDEX_J[i], 0])));
  }
}

function buildHand(k) {
  const hand = k.part("hand", { pivot: HAND_AT });
  const index = INDEX_J.map((y, i) => k.part(`index${i + 1}`, { pivot: handB([0, y, 0]) }));
  const metal =
    (col, sheen = 0.45) =>
    (c) =>
      keep(lit(col, c.n, { sheen, tight: 14, soft: 0.4 }));
  const SILVER = metal("#c3c9d1");
  const GRAPHITE = metal("#3d424a", 0.3);
  const JOINT = metal("#858c95", 0.4);
  const BLUE = "#46b4ff";
  const look = { flat: 0.3, pattern: false, weight: 3, even: true, scale: HAND_BUILT * HAND_SIZE }; // prettier-ignore
  // A limb from a to b (in the hand's frame).
  const limb = (a, b, r, part, color = SILVER, r1 = r, caps = false) => {
    const d = sub(b, a);
    k.add(k.cone(r, r1, Math.hypot(...d), { caps }), {
      ...look,
      part,
      color,
      pos: handB(scale3(add3(a, b), 0.5)),
      quat: quatMul(HAND_Q, quatFromTo(UP, unit(d))),
    });
  };
  const ball = (at, r, part, color = GRAPHITE) =>
    k.add(k.sphere(r), { ...look, part, color, pos: handB(at) });
  // A jointed finger along points pts: silver segments, darker joints and a
  // graphite fingertip pad.
  const finger = (pts, r, parts) => {
    for (let i = 0; i + 1 < pts.length; i++) {
      const last = i + 2 === pts.length;
      const b = last ? add3(pts[i + 1], scale3(unit(sub(pts[i], pts[i + 1])), r)) : pts[i + 1];
      limb(pts[i], b, r * (1 - 0.03 * i), parts[i]);
      ball(pts[i], r * (i ? 1.04 : 1.1), i ? parts[i] : hand, JOINT);
      if (last) ball(b, r * 0.97, parts[i]);
    }
  };
  // The index, straight up (its tip pad reaches INDEX_L).
  finger([...INDEX_J.map((y) => [0, y, 0]), [0, INDEX_L, 0]], 0.056, index);
  // The curled fingers: out over the palm, down, and back to it.
  const d1 = unit([0, -0.15, 1]);
  const d2 = unit([0, -1, -0.12]);
  const d3 = unit([0, -0.35, -1]);
  for (const [x, y, r, l] of [
    [-0.125, 0, 0.056, 1.05],
    [-0.245, -0.012, 0.053, 1],
    [-0.355, -0.04, 0.046, 0.8],
  ]) {
    const p0 = [x, y, 0];
    const p1 = add3(p0, scale3(d1, 0.17 * l));
    const p2 = add3(p1, scale3(d2, 0.13 * l));
    const p3 = add3(p2, scale3(d3, 0.085 * l + r));
    finger([p0, p1, p2, p3], r, [hand, hand, hand]);
  }
  // The thumb, across the middle finger.
  finger(
    [
      [0.03, -0.33, 0.04],
      [0.1, -0.225, 0.13],
      [0.05, -0.14, 0.235],
      [-0.085 - 0.058, -0.1, 0.27],
    ],
    0.06,
    [hand, hand, hand],
  );
  // The palm: silver, with a dark pad and a blue ring on its face and a seam
  // across the back of the hand.
  k.add(k.roundedBox(0.43, 0.42, 0.15, 5), {
    ...look,
    part: hand,
    pos: handB([-0.175, -0.2, 0]),
    quat: HAND_Q,
    color: (c) => {
      const [x, y] = c.lp;
      if (c.ln[2] < -0.6 && Math.abs(y - 0.12) < 0.007) return metal("#8a919b")(c);
      if (c.ln[2] > 0.6 && Math.max(Math.abs(x) - 0.16, Math.abs(y + 0.1) - 0.09) < 0) {
        if (Math.abs(Math.hypot(x, y + 0.1) - 0.055) < 0.012) return keep(BLUE);
        return GRAPHITE(c);
      }
      return SILVER(c);
    },
  });
  // The wrist joint, and the forearm: a cuff, a blue band and a seam.
  k.add(k.roundedBox(0.32, 0.09, 0.14, 4), {
    ...look,
    part: hand,
    pos: handB([-0.175, -0.44, 0]),
    quat: HAND_Q,
    color: JOINT,
  });
  const w0 = [-0.175, -0.47, 0];
  const w1 = add3(w0, scale3(unit([0.12, -1, -0.22]), 0.95));
  const forearm = (c) => {
    const from = c.lp[1] + 0.475;
    if (from < 0.05) return JOINT(c);
    if (Math.abs(from - 0.11) < 0.018) return keep(BLUE);
    if (Math.abs(Math.atan2(c.lp[2], c.lp[0]) - 0.6) < 0.03) return metal("#8a919b")(c);
    return SILVER(c);
  };
  limb(w0, w1, 0.14, hand, forearm, 0.175, "bottom");
}

// Tennis: slammed onto the floor, it squashes hard and shoots up high with
// topspin; a tennis ball keeps about 0.75 of its speed at each bounce.
const TN_G = grav(0.033);
const POCK = (f, k) => ({ voice: "pock", f, vol: 0.9 * k });
const TENNIS = [
  { hit: 0.07, squash: 0.3 },
  { fly: { h: 0.72 }, spin: -2.4, axis: TOWARD },
  ...bounces(TN_G, {
    h: 0.72 * 0.56,
    e: 0.75,
    n: 4,
    squash: 0.18,
    w: 0.05,
    spin: -2,
    axis: TOWARD,
    keep: 0.75,
    cue: (i, k) => POCK(820 - 20 * i, k),
  }),
  spinDown(0.35, -0.5, TOWARD),
];
const TENNIS_HITS = plan(TN_G, TENNIS).segs.filter((s) => s.L.hit !== undefined);

// Baseball: a curveball pitched away, spinning hard, that breaks down and
// to the side late; the crack of the bat sends it back in a looping arc to
// land at its spot, where it takes a dead little bounce (0.5 of its speed).
const CURVE_AXIS = unit(add3(scale3(ACROSS, -0.87), scale3(UP, 0.5)));
const BASEBALL = [
  // The wind-up: back towards the camera and up, in the hand.
  { path: 0.24, pos: (u) => lerp3([0, 0, 0], at3(0.08, 0.28, 0.4), easeIO(u)) },
  {
    path: 0.58,
    pos: (u) => add3(lerp3(at3(0.08, 0.28, 0.4), at3(0.12, 0.42, -2.6), u), at3(-0.62 * u * u * u, -0.26 * u * u)), // prettier-ignore
    spin: 5,
    axis: CURVE_AXIS,
  },
  { fly: { h: 0.45 }, to: [0, 0, 0], g: 5.5, spin: -3, axis: ACROSS },
  ...bounces(grav(0.037), {
    h: 0.08,
    e: 0.5,
    n: 2,
    squash: 0.05,
    w: 0.03,
    spin: -1.5,
    axis: ACROSS,
    keep: 0.6,
    cue: (i, k) => ({ voice: "thud", f: 150, bright: 0.5, decay: 0.6, vol: 0.8 * k }),
  }),
  spinDown(0.3, -0.5, ACROSS),
];

// Softball: an underhand pitch: a swing back and through, then a high,
// slow arc away with a little backspin; it lands with a soft thud, barely
// bounces (softballs keep under half their speed) and stops; a softer toss
// brings it back.
const SB_AWAY = at3(-0.55, 0, -1.9);
const SB_RELEASE = at3(0, 0.12, -0.25);
const SB_BACK = unit(scale3(rollAxis(sub(SB_AWAY, SB_RELEASE)), -1));
const THUD_SOFT = (k) => ({ voice: "thud", f: 130, bright: 0.25, decay: 0.8, vol: k });
const SOFTBALL = [
  { path: 0.3, pos: (u) => lerp3([0, 0, 0], at3(0, 0.34, 0.45), easeOut(u)) },
  {
    path: 0.22,
    pos: (u) => {
      const p = lerp3(at3(0, 0.34, 0.45), SB_RELEASE, u);
      p[1] -= 0.28 * Math.sin(Math.PI * u) * (1 - u);
      return p;
    },
  },
  { fly: { h: 0.52 }, to: SB_AWAY, g: 6, spin: 1.1, axis: SB_BACK },
  { hit: 0.06, squash: 0.08, spin: 0.8, axis: SB_BACK },
  { fly: { h: 0.04 }, to: lerp3(SB_AWAY, [0, 0, 0], -0.04), spin: 0.5, axis: SB_BACK },
  { hit: 0.04, squash: 0.03, spin: 0.2, axis: SB_BACK },
  { wait: 0.3 },
  { fly: { h: 0.42 }, to: [0, 0, 0], g: 7, spin: -1, axis: SB_BACK },
  { hit: 0.06, squash: 0.08, spin: -0.6, axis: SB_BACK, cue: THUD_SOFT(0.9) },
  { fly: { h: 0.035 }, to: [0, 0, 0], spin: -0.4, axis: SB_BACK },
  { hit: 0.04, squash: 0.03 },
  spinDown(0.25, -0.3, SB_BACK),
];

// Beach ball: punched up, the air slows it at once (a light ball with a lot
// of drag); it floats down at its slow falling speed, drifting and turning
// lazily, lands soft with a wobble and bobs to a stop.
const BEACH = [
  dragFlight(0.6, 2.5, 0.9, {
    drift: (u) => at3(0.34 * Math.sin(Math.PI * u), 0, -0.12 * Math.sin(TAU * u)),
    spin: 0.3,
    axis: TOWARD,
  }),
  { hit: 0.16, squash: 0.22, ring: 3.2, damp: 4.5, spin: 0.2, axis: TOWARD },
  { fly: { h: 0.1 }, g: 3, spin: 0.2, axis: TOWARD },
  { hit: 0.12, squash: 0.1, ring: 3.2, damp: 5, spin: 0.1, axis: TOWARD, cue: BEACH_BOING(0.5) },
  { fly: { h: 0.03 }, g: 3, spin: 0.1, axis: TOWARD },
  { hit: 0.08, squash: 0.04, ring: 3.2, damp: 6 },
  spinDown(0.35, 0.08, TOWARD),
];
function BEACH_BOING(k) {
  return { voice: "boing", f: 240, to: 1.4, rate: 9, decay: 0.7, vol: k };
}

// Golf: a chip: it pops up with heavy backspin, lands, checks with a tiny
// hop, and the backspin grips and pulls it back to its spot.
const GOLF = [
  { fly: { h: 0.4 }, to: at3(0.5), g: 28, spin: 3.5, axis: TOWARD },
  { hit: 0.03, squash: 0.05, spin: 3, axis: TOWARD, cue: { voice: "clack", f: 2200, decay: 0.6, vol: 0.5 } }, // prettier-ignore
  { fly: { h: 0.07 }, to: at3(0.62), g: 28, spin: 3, axis: TOWARD },
  { hit: 0.025, squash: 0.02, spin: 2.6, axis: TOWARD, cue: { voice: "clack", f: 2400, decay: 0.4, vol: 0.3 } }, // prettier-ignore
  { turn: 0.14, spin: 2.2, axis: TOWARD },
  { roll: 1.0, to: [0, 0, 0], ease: "inout" },
];

// Volleyball: a soft set straight up with no spin (a good set does not
// spin), then a spike drives it down hard with topspin; it slams into the
// floor, kicks up high and bounces out (0.7 of its speed each time).
const VB_G = grav(0.105);
const VB_TOP = at3(0.28, 0.4);
const VOLLEYBALL = [
  { fly: { h: 0.5 }, to: VB_TOP, g: 4.5 },
  {
    path: 0.12,
    pos: (u) => lerp3(VB_TOP, at3(0.1, 0), u * u),
    spin: 5,
    axis: TOWARD,
  },
  { hit: 0.05, squash: 0.22, spin: 4, axis: TOWARD, cue: { voice: "thud", f: 110, bright: 0.6, vol: 0.9 } }, // prettier-ignore
  { fly: { h: 0.48 }, to: at3(-0.05), spin: 3.2, axis: TOWARD },
  ...bounces(VB_G, {
    h: 0.48 * 0.49,
    e: 0.7,
    n: 2,
    squash: 0.12,
    spin: 2,
    axis: TOWARD,
    keep: 0.6,
    cue: (i, k) => ({ voice: "thud", f: 120, bright: 0.5, vol: 0.7 * k }),
  }),
  spinDown(0.3, 0.5, TOWARD),
];

// Ping-pong: flicked up, it bounces on and on (it keeps nearly 0.9 of its
// speed), each bounce lower and quicker, till it buzzes to a stop.
const PP_G = grav(0.02);
const PINGPONG = [
  { fly: { h: 0.55 } },
  ...bounces(PP_G, {
    h: 0.55 * 0.77,
    e: 0.88,
    n: 14,
    squash: 0.04,
    w: 0.012,
    cue: (i, k) => ({ voice: "pock", f: 1900 + 12 * i, bright: 0.7, decay: 0.5, vol: 0.35 + 0.6 * k }), // prettier-ignore
  }),
];

// Lacrosse: hard rubber, the liveliest of the lot (0.83 of its speed kept):
// slammed down, it rockets up and bounces hard and fast.
const LX_G = grav(0.032);
const LACROSSE = [
  { hit: 0.025, squash: 0.08 },
  { fly: { h: 0.72 }, spin: 1.5, axis: TOWARD },
  ...bounces(LX_G, {
    h: 0.72 * 0.69,
    e: 0.83,
    n: 6,
    squash: 0.06,
    w: 0.02,
    spin: 1.3,
    axis: TOWARD,
    keep: 0.8,
    cue: (i, k) => ({ voice: "pock", f: 620, bright: 0.8, vol: 0.3 + 0.7 * k }),
  }),
  spinDown(0.25, 0.4, TOWARD),
];

// Dodgeball: lifted and slammed down, the soft rubber squashes flat and
// wobbles, and it bounces up lively (0.65 of its speed), squashing again.
const DB_G = grav(0.1);
const BWONG = (k) => ({ voice: "boing", f: 150, to: 0.7, rate: 20, decay: 0.6, vol: k });
const DODGEBALL = [
  { path: 0.3, pos: (u) => [0, 0.42 * easeOut(u), 0], spin: 0.3, axis: TOWARD },
  { path: 0.13, pos: (u) => [0, 0.42 * (1 - u * u), 0], spin: 0.6, axis: TOWARD },
  { hit: 0.11, squash: 0.36, ring: 4.5, damp: 4.5, spin: 0.5, axis: TOWARD },
  { fly: { h: 0.55 }, spin: 0.8, axis: TOWARD },
  ...bounces(DB_G, {
    h: 0.55 * 0.42,
    e: 0.65,
    n: 2,
    squash: 0.22,
    w: 0.09,
    ring: 4.5,
    damp: 5,
    spin: 0.6,
    axis: TOWARD,
    keep: 0.6,
    cue: (i, k) => BWONG(0.8 * k),
  }),
  spinDown(0.3, 0.2, TOWARD),
];

// The pool ball's baked light as out = a * base + b: a key light with a
// sharp window highlight (lit()), a soft reflection of the room along the
// top, a broad soft highlight beside the sharp one and a thin rim of
// reflected light at the silhouette (seen from home).
const POOL_ROOM = rgb("#9aa6b4");
const POOL_RIM = rgb("#8d97a3");
function poolLight(n) {
  const F = 0.7 + 0.3 * (0.5 + 0.5 * dot(n, LIGHT)) + 0.03;
  const h = Math.max(0, dot(n, HALF));
  const steps = [
    [[1, 1, 1], 0.95 * h ** 90],
    [POOL_ROOM, 0.16 * smoothstep(0.1, 0.8, n[1]) * (1 - 0.6 * Math.abs(n[2]))],
    [[1, 1, 1], 0.18 * h ** 8],
    [POOL_RIM, 0.22 * (1 - Math.max(0, dot(n, VIEW))) ** 3],
  ];
  let a = F;
  let b = [0, 0, 0];
  for (const [col, t] of steps) {
    a *= 1 - t;
    b = b.map((v, i) => v * (1 - t) + col[i] * t);
  }
  return { a, b };
}

// Pickleball: popped up twice off an unseen paddle, the light holed ball
// slows fast in the air (a lot of drag for its weight) and knuckles,
// wobbling without much spin; it lands with a hollow click and a small, dead
// plastic bounce.
const PICKLE = (() => {
  const knuckle = (k) => (u, e) =>
    quatAxisAngle([Math.cos(5 * e + k), 0.3, Math.sin(5 * e + k)], 0.35 * Math.sin(Math.PI * u));
  const pop = { voice: "pock", f: 1250, bright: 0.2, decay: 1.3, vol: 0.8 };
  return [
    dragFlight(0.55, 10, 1.6, { tilt: knuckle(0) }),
    dragFlight(0.42, 10, 1.6, { tilt: knuckle(2), cue: pop }),
    ...bounces(grav(0.037), {
      h: 0.42 * 0.3,
      e: 0.55,
      n: 2,
      squash: 0.07,
      w: 0.035,
      cue: (i, k) => ({ voice: "pock", f: 1100, bright: 0.2, decay: 0.8, vol: k }),
    }),
  ];
})();

// Pool: a draw shot. The cue strikes low: it slides forward spinning
// backwards, friction stops it, and the backspin pulls it back till it rolls
// cleanly home. (The backspin is k times its speed, chosen so it turns
// exactly once backwards in all.)
const POOL_SHOT = (() => {
  const D = 0.42;
  const t0 = 0.95;
  const a = (2 * D) / (t0 * t0);
  const v0 = a * t0;
  // Slides until its backspin has turned into rolling back (a solid ball:
  // friction slows it by a and its spin by 2.5 a).
  const shot = (k) => {
    const ts = ((1 + k) * v0) / (3.5 * a);
    const xs = v0 * ts - 0.5 * a * ts * ts;
    return { ts, xs, turn: -k * v0 * ts + 1.25 * a * ts * ts - xs };
  };
  let lo = 2.6;
  let hi = 40;
  for (let i = 0; i < 60; i++) {
    const m = (lo + hi) / 2;
    if (shot(m).turn > -TAU) lo = m;
    else hi = m;
  }
  const k = lo;
  const { ts, xs } = shot(k);
  const vs = v0 - a * ts;
  const ar = (vs * vs) / (2 * xs);
  const tr = Math.abs(vs) / ar;
  const TOP = rollAxis(ACROSS);
  return [
    {
      path: ts,
      pos: (u, e) => at3(v0 * (e ?? u * ts) - 0.5 * a * (e ?? u * ts) ** 2),
      axis: TOP,
      angle: (u, e) => -k * v0 * e + 1.25 * a * e * e,
      fixed: true,
    },
    {
      path: tr,
      pos: (u, e) => at3(xs + vs * (e ?? u * tr) + 0.5 * ar * (e ?? u * tr) ** 2),
      axis: TOP,
      angle: (u, e) => vs * e + 0.5 * ar * e * e,
      fixed: true,
    },
  ];
})();

// Cricket: flicked up seam-up, as a bowler does: it turns so the seam
// stands upright and spins backwards about the seam's own axis (the seam
// stays still while the stitches run round), comes down level, and skids on
// low with its backspin till the spin grips and rolls it home.
const NACROSS = scale3(ACROSS, -1);
const KNOCK = (vol) => ({ voice: "wood", f: 900, decay: 0.8, vol });
const CRICKET = [
  {
    fly: { h: 0.55 },
    to: at3(0, 0, 0.1),
    g: 12,
    rot: (u) => {
      const s1 = easeIO(band01(u, 0, 0.2));
      const s2 = easeIO(band01(u, 0.8, 1));
      const spin = quatAxisAngle(ACROSS, -TAU * 2 * band01(u, 0.2, 0.8));
      return quatMul(quatAxisAngle(TOWARD, (-Math.PI / 2) * s2), quatMul(spin, quatAxisAngle(TOWARD, (Math.PI / 2) * s1))); // prettier-ignore
    },
  },
  { hit: 0.03, squash: 0.04, cue: [KNOCK(0.8), { voice: "scrape", f: 1400, rate: 30, decay: 0.6, vol: 0.3 }] }, // prettier-ignore
  { path: 0.4, pos: (u) => lerp3(at3(0, 0, 0.1), at3(0, 0, 0.45), easeOut(u)), spin: 2.2, axis: NACROSS }, // prettier-ignore
  { roll: 0.85, to: [0, 0, 0], ease: "inout" },
];

// Bowling: a heavy roll with a hook. It drops onto the lane with a thud,
// rolls away straight, then hooks across as its spin bites; the pins crash
// far off, and it rolls back home.
const BW_FAR = at3(0.3 - 0.95, 0, -3.65);
const BOWLING = [
  { fly: { h: 0.1 }, to: at3(0, 0, -0.35) },
  { hit: 0.07, squash: 0.035, cue: { voice: "thud", f: 60, bright: 0.2, decay: 1.2, vol: 0.9 } },
  {
    rollPath: 1.7,
    pos: (u) => {
      const s = 1 - (1 - u) ** 1.3;
      return at3(0.3 * s - 0.95 * s * s * s, 0, -0.35 - 3.3 * s);
    },
  },
  { wait: 0.3 },
  {
    rollPath: 1.5,
    pos: (u) => lerp3(BW_FAR, [0, 0, 0], easeOut(u)),
    absorb: true,
    cue: { voice: "rumble", f: 60, rate: 10, decay: 0.8, vol: 0.5 },
  },
];

// Squash: a cold squash ball is dead: dropped, it hardly bounces. Hit over
// and over (by an unseen racket), it warms, glows faintly and bounces higher
// and faster; let go, it bounces out and cools.
const SQ_G = 45;
const THOCK = (i, vol = 1) => ({ voice: "pock", f: 380 + 25 * i, bright: 0.1, decay: 1.2, vol });
const SQUASH = [
  { fly: { h: 0.22 } },
  { hit: 0.08, squash: 0.3 },
  { fly: { h: 0.012 } },
  { hit: 0.03, squash: 0.05 },
  dribble(SQ_G, 0.14),
  { hit: 0.06, squash: 0.27, cue: THOCK(1) },
  dribble(SQ_G, 0.22),
  { hit: 0.06, squash: 0.26, cue: THOCK(2) },
  dribble(SQ_G, 0.32),
  { hit: 0.06, squash: 0.25, cue: THOCK(3) },
  dribble(SQ_G, 0.44),
  { hit: 0.06, squash: 0.24, cue: THOCK(4), warm: true },
  { fly: { h: 0.52 } },
  { hit: 0.06, squash: 0.2, cue: THOCK(5, 0.8) },
  { fly: { h: 0.13 } },
  { hit: 0.05, squash: 0.1, cue: THOCK(5, 0.5) },
  { fly: { h: 0.035 } },
  { hit: 0.04, squash: 0.04 },
  { wait: 0.6 },
];
const SQUASH_WARM = (() => {
  const P = plan(SQ_G, SQUASH);
  const first = P.segs.find((s) => s.L.path !== undefined);
  const hot = P.segs.find((s) => s.L.warm);
  return { start: first.t0, hot: hot.t0 };
})();

// Medicine ball: heavy: heaved up only a little, slowly, it drops with a
// thud and a big, slow squash, no bounce at all, and a puff of dust.
const MB_G = grav(0.17);
const MEDICINE = [
  {
    path: 0.5,
    pos: (u) => [0, 0.22 * easeIO(u), 0],
    tilt: (u) => quatAxisAngle(ACROSS, 0.06 * Math.sin(Math.PI * u)),
  },
  { path: 0.06, pos: () => [0, 0.22, 0] },
  { fly: { h: 0.001 }, to: [0, 0, 0] },
  {
    hit: 0.24,
    squash: 0.22,
    ring: 2.3,
    damp: 6,
    dust: true,
  },
  { wait: 0.6 },
];
const MB_DUST = plan(MB_G, MEDICINE).segs.find((s) => s.L.dust).t0;

// Bouncy ball: a superball keeps nearly all its speed, and its spin flips at
// every bounce, so it ricochets all over, then comes home and settles.
const BY_G = 55;
const BOUNCY = (() => {
  const pts = [
    at3(0.55, 0, 0.3),
    at3(-0.5, 0, -0.35),
    at3(0.4, 0, -0.6),
    at3(-0.45, 0, 0.35),
    at3(0.28, 0, 0.42),
    at3(-0.15, 0, -0.15),
    [0, 0, 0],
  ];
  const hs = [0.62, 0.58, 0.54, 0.5, 0.45, 0.4, 0.34];
  const boing = (i, k = 1) => ({ voice: "boing", f: 260 + 30 * i, to: 2.6, rate: 16, decay: 0.5, vol: k }); // prettier-ignore
  const legs = [{ hit: 0.02, squash: 0.1 }];
  let from = [0, 0, 0];
  pts.forEach((p, i) => {
    const axis = rollAxis(sub(p, from));
    legs.push({ fly: { h: hs[i] }, to: p, spin: (i % 2 ? -1 : 1) * 3, axis });
    legs.push({ hit: 0.02, squash: 0.08, cue: boing(i + 1, 1 - 0.07 * i) });
    from = p;
  });
  legs.push(...bounces(BY_G, { h: 0.2, e: 0.75, n: 3, squash: 0.06, w: 0.02, cue: (i, k) => boing(9 + i, 0.4 * k) })); // prettier-ignore
  // (the first landing of those is the one already there)
  legs.splice(-7, 1);
  return legs;
})();

// Water polo: tossed up, it plunges into the water with a splash, pops back
// up and bobs on the water line, each bob sending out a ripple.
const WP_G = 12;
const WATER_Y = -0.45;
const WATERPOLO = (() => {
  const w = TAU / 0.6;
  const vin = WP_G * Math.sqrt(0.9 / WP_G);
  const A = vin / w;
  const T = 2.6;
  const env = (e) => Math.exp(-2 * e) * (1 - smoothstep(2.1, T, e));
  return [
    { fly: { h: 0.45 } },
    {
      path: T,
      pos: (u, e) => [0, -A * env(e ?? u * T) * Math.sin(w * (e ?? u * T)), 0],
      tilt: (u, e) => quatAxisAngle(ACROSS, 0.16 * env(e) * Math.sin(w * e + 0.7)),
    },
  ];
})();
const WP_PLUNGE = plan(WP_G, WATERPOLO).segs[1].t0;
const WP_RINGS = [0, 0.3, 0.9];

// Marble: it rolls round a little circle as wide as itself, turning about
// the way it rolls and with it (so after one lap it is back exactly as it
// was), the swirl inside turning as it goes.
// The marble's glass (lane Fix4): the two shells' opacities and the
// highlight's angular radius.
const GLASS = {
  edge: 0.12,
  band: 0.08,
  tint: 0.015,
  fin: 0.02,
  size: 0.45,
  count: 30000,
  spot: 0.1,
};

const MARBLE = (() => {
  const a0 = rollAxis(ACROSS);
  const turn = (u) => TAU * easeIO(u);
  return [
    {
      path: 2.4,
      pos: (u) => {
        const f = turn(u);
        return at3(Math.sin(f), 0, Math.cos(f) - 1);
      },
      rot: (u) => quatMul(quatAxisAngle(UP, turn(u)), quatAxisAngle(a0, turn(u))),
    },
  ];
})();

export const RECIPES = {
  basketball: {
    // A few more splats (as far as the device allows) for the robot hand, so
    // the ball at rest keeps its own.
    density: 1.13,
    options: [{ key: "color", label: "Colour", type: "color", default: "#d9632b" }],
    // Dribble: four fast, low bounces, each pushed back down by an unseen
    // hand; then a toss onto the fingertip of a robot hand that comes up
    // from below, where it spins with a slight wobble, and it drops off,
    // bouncing lower each time (about 0.78 of its speed kept), still
    // spinning down.
    ...throwBall("dribble", "Dribble and spin", grav(0.12), BASKETBALL, {
      extra(e, pose, c, out) {
        showHand(out, e, pose);
      },
    }),
    build(k, o) {
      buildHand(k);
      const w = 0.026;
      body(k, (c) => {
        const [x, y] = c.ln;
        const seam = Math.abs(x) < w || Math.abs(y) < w || Math.abs(Math.abs(x) - 0.71) < w * 1.05;
        // Clean black channels in small, crisp splats.
        if (seam) return keep("#16100d", 0.7);
        return grip(c, o.color, { f: 55, depth: 0.7, crevice: 0.22, sheen: 0.08 });
      });
    },
  },

  "soccer-ball": {
    options: [
      { key: "panels", label: "Panels", type: "color", default: "#151515" },
      { key: "base", label: "Base", type: "color", default: "#f4f4f2" },
    ],
    // Keepy-uppy: three small kicks from an unseen foot, each with a little
    // backspin, the last one higher; then it drops, bounces lower and lower
    // (a soccer ball keeps about 0.78 of its speed) and settles.
    ...throwBall("kick", "Keepy-uppy", grav(0.11), [
      { fly: { h: 0.5 }, to: at3(0.12, 0.2), spin: -1.1, axis: TOWARD },
      { fly: { h: 0.42 }, to: at3(-0.1, 0.2), spin: 1.4, axis: TOWARD, cue: KICK },
      { fly: { h: 0.55 }, to: at3(0.06, 0), spin: -1.7, axis: TOWARD, cue: KICK },
      ...bounces(grav(0.11), {
        h: 0.42,
        e: 0.78,
        n: 4,
        squash: 0.12,
        spin: -1.2,
        axis: TOWARD,
        keep: 0.55,
        to: (i) => at3(0.06 * (1 - (i + 1) / 4)),
        cue: (i, k) => ({ voice: "thud", f: 100 + 10 * i, bright: 0.4, vol: 0.9 * k }),
      }),
      spinDown(0.3, -0.15, TOWARD),
    ]),
    build(k, o) {
      const face = soccerFaces();
      body(k, (c) => {
        const f = face(c.ln);
        // Smooth, slightly glossy panels; the seams are clean grooves.
        if (f.edge < 0.011) return keep(lit("#6f6f6f", c.n), 0.6);
        return lit(f.pent ? o.panels : o.base, c.n, { sheen: 0.22, tight: 24 });
      });
    },
  },

  "american-football": {
    // Twice the splats (as far as the device allows): it is built twice.
    density: 2,
    options: [{ key: "color", label: "Leather", type: "color", default: "#7a3b1a" }],
    // A spiral pass: it flies up nose first, spinning fast about its long
    // axis (six whole turns, so it lands laces up as it started), the nose
    // tipping over at the top, and lands with a wobble. Splats sort in their
    // built pose, so the ball is built twice (PACKS.md 7b, rule 1): the
    // second copy half a turn round about its long axis, coloured as the
    // first would be there, and whichever copy is within a quarter turn of
    // its built pose is shown. Its inside hides while it spins.
    ...throwPulse("pass", "Throw a spiral", 2.4),
    drive(t, c, out) {
      const e = sinceTap(c, "pass", 2.4);
      const f = e < 0 ? 0 : band01(e, 0.05, 1.65);
      const flying = f > 0 && f < 1;
      const spin = 2 * Math.PI * 6 * easeIO(f);
      const turn = ((spin % TAU) + TAU) % TAU;
      const useB = turn > Math.PI / 2 && turn < (3 * Math.PI) / 2;
      out.parts.ballA = { quat: quatAxisAngle([1, 0, 0], spin), visible: useB ? 0 : 1 };
      out.parts.ballB = { quat: quatAxisAngle([1, 0, 0], spin - Math.PI), visible: useB ? 1 : 0 };
      out.parts.core = { visible: flying ? 0 : 1 };
      if (e < 0) return;
      const pitch = flying ? 0.6 * Math.cos(Math.PI * f) : 0;
      const land = Math.exp(-(e - 1.65) * 5) * Math.sin((e - 1.65) * 18) * band01(e, 1.65, 1.7);
      out.body = {
        offset: [0, arc(f, 0.65), 0],
        quat: quatAxisAngle([0, 0, 1], pitch + 0.12 * land),
      };
    },
    build(k, o) {
      const L = 1.45;
      const prof = [];
      for (let i = 0; i <= 24; i++) {
        const y = -L + (2 * L * i) / 24;
        prof.push([0.86 * Math.pow(Math.max(0, 1 - (y / L) ** 2), 0.78), y]);
      }
      const look = (turned) => (c) => {
        const a = (c.u * TAU + (turned ? Math.PI : 0)) % TAU;
        const y = c.lp[1];
        // Four panels meet along four meridians.
        const seamA = Math.abs(Math.sin(2 * a));
        // The laces sit on the seam at a = 90 degrees (turned to the top).
        const d90 = Math.abs(a - Math.PI / 2);
        // Crisp white laces: a spine along the seam and eight cross bars.
        const lace = "#f5f2e8";
        if (Math.abs(y) < 0.55 && d90 < 0.045) return keep(lit(lace, c.n, { sheen: 0.12 }), 0.85);
        if (Math.abs(y) < 0.48 && d90 < 0.19) {
          const bar = Math.abs((((y + 0.48) / 0.12) % 1) - 0.5) > 0.3;
          if (bar) return keep(lit(lace, c.n, { sheen: 0.12 }), 0.85);
        }
        // Darker, stitched seams between the four panels.
        if (seamA < 0.026) return keep(lit(shade(o.color, 0.34), c.n, { soft: 0.4 }), 0.8);
        // Pebbled pigskin with a soft sheen: fine, shallow pebbles (at phone
        // size they read as grain, not noise) and fuller light on its form.
        return grip(c, o.color, {
          f: 90,
          depth: 0.28,
          crevice: 0.1,
          sheen: 0.16,
          tight: 9,
          soft: 0.4,
        });
      };
      const shape = k.lathe(prof, { grid: 80 });
      const core = k.part("core");
      k.add(shape, {
        rot: [0, 0, 90],
        part: (c) => (c.inside ? core : k.part("ballA", { axis: [1, 0, 0] })),
        flat: 0.18,
        interior: 0.12,
        jitter: 0.012,
        even: true,
        core: "#3b1d0c",
        color: look(false),
      });
      k.add(shape, {
        rot: [0, 0, 90],
        part: k.part("ballB", { axis: [1, 0, 0] }),
        flat: 0.18,
        jitter: 0.012,
        even: true,
        color: look(true),
      });
    },
  },

  "tennis-ball": {
    options: [{ key: "color", label: "Felt", type: "color", default: "#cfe23b" }],
    // Slammed onto the floor: it squashes hard and shoots up high with
    // topspin, the felt's fuzz fluffing out at each hit, then bounces lower
    // and lower (0.75 of its speed each time).
    ...throwBall("slam", "Bounce it hard", TN_G, TENNIS, {
      extra(e, pose, c, out) {
        // The fuzz stands up at each hit and lies back down.
        let f = 0;
        for (const s of TENNIS_HITS)
          if (e >= s.t0) f = Math.max(f, (s.L.squash / 0.3) * Math.exp(-(e - s.t0) / 0.22));
        out.morph = [Math.min(1, f), 0, 0, 0];
      },
    }),
    build(k, o) {
      const seam = seamCurve(0.72);
      // Felt: soft, round splats with gentle mottling and no shine.
      const felt = (c) =>
        lit(shade(o.color, 0.97 + 0.06 * c.fbm(c.lp[0] * 7, c.lp[1] * 7, c.lp[2] * 7)), c.n, {
          soft: 0.26,
        });
      body(
        k,
        (c) => {
          const s = seam(c.ln);
          // The clean white rubber seam, slightly sunk into the felt.
          if (s.dist < 0.03) return keep(lit("#f4f6ea", c.n), 0.65);
          return felt(c);
        },
        { flat: 0.55, size: 1.15, jitter: 0.01, core: "#4a4a3a" },
      );
      // A fuzz of fine hairs standing off the felt, which also softens the
      // silhouette. None grow on the seam. They spin with the ball, and a
      // hit fluffs them out (channel 0; the fluffed hairs stay out of the
      // fit, so the ball keeps its size at rest).
      k.fitMorphs = false;
      k.cloud({ share: 0.2, size: 0.55, opacity: 0.5, part: k.part("ball") }, (rand) => {
        const z = rand() * 2 - 1;
        const a = rand() * TAU;
        const r = Math.sqrt(1 - z * z);
        const d = [r * Math.cos(a), z, r * Math.sin(a)];
        if (seam(d).dist < 0.05) return null;
        const h = 1 + rand() * 0.035;
        // Hairs lean at random, mostly along the surface.
        const t = unit(cross(d, [rand() - 0.5, rand() - 0.5, rand() - 0.5]));
        const dir = unit([t[0] + d[0] * 0.6, t[1] + d[1] * 0.6, t[2] + d[2] * 0.6]);
        const tone = 0.9 + rand() * 0.2;
        const out = h + 0.035 + 0.04 * rand();
        return {
          p: [d[0] * h, d[1] * h, d[2] * h],
          to: [d[0] * out, d[1] * out, d[2] * out],
          channel: 0,
          dir,
          stretch: 2.6,
          color: lit(shade(o.color, tone * (0.96 + (h - 1) * 2)), d, { soft: 0.26 }),
        };
      });
    },
  },

  baseball: {
    // Twice the splats (as far as the device allows): the unlit copy and the
    // light for its spin (glossSpin) take a share, and the ball at rest keeps
    // its own.
    density: 2,
    // A curveball: pitched away, spinning hard, it breaks down and to the
    // side late; the crack of the bat sends it back in a looping arc to its
    // spot, where it takes a dead little bounce.
    ...throwBall("pitch", "Pitch a curveball", grav(0.037), BASEBALL, { gloss: true }),
    build(k) {
      stitchedBall(k, "#f3eee2", "#c8102e");
    },
  },

  softball: {
    // Twice the splats (as far as the device allows): the unlit copy and the
    // light for its spin (glossSpin) take a share, and the ball at rest keeps
    // its own.
    density: 2,
    // An underhand pitch: a swing back and through, a high, slow arc away
    // with a little backspin, a soft thud and hardly a bounce; then a softer
    // toss brings it back.
    ...throwBall("pitch", "Pitch underhand", grav(0.048), SOFTBALL, { gloss: true }),
    build(k) {
      stitchedBall(k, "#e6e44a", "#c8102e", { n: 88 });
    },
  },

  "beach-ball": {
    options: [
      { key: "c1", label: "Colour 1", type: "color", default: "#e63946" },
      { key: "c2", label: "Colour 2", type: "color", default: "#f4d35e" },
      { key: "c3", label: "Colour 3", type: "color", default: "#1d70b8" },
    ],
    // Punched up, the air slows it at once; it floats down slowly, drifting
    // and turning lazily, lands soft with a wobble and bobs to a stop.
    ...throwBall("toss", "Toss it up", 2.5, BEACH),
    build(k, o) {
      const gores = [o.c1, "#fafafa", o.c2, "#2a9d8f", o.c3, "#f77f00"];
      body(
        k,
        (c) => {
          const [x, y, z] = c.ln;
          if (Math.abs(y) > 0.94) return keep(Math.abs(y) > 0.975 ? "#fafafa" : shade(o.c1, 0.9));
          const a = (Math.atan2(x, z) / TAU + 1) % 1;
          const g = a * 6;
          const edge = Math.abs(g - Math.round(g));
          if (edge < 0.015) return keep("#d8d8d8", 0.8);
          return gores[Math.floor(g) % 6];
        },
        { core: "#f0e6d0", interior: 0.04 },
      );
    },
  },

  "golf-ball": {
    // A chip: it pops up with heavy backspin, lands, checks with a tiny hop,
    // and the backspin grips and pulls it back to its spot.
    ...throwBall("chip", "Chip it", 28, GOLF),
    build(k) {
      const dimples = fibonacciSphere(336);
      const R = 0.088;
      const cosR = Math.cos(R);
      // Fibonacci neighbours within a dimple's radius sit within ~R*n/2
      // indices of the point's own latitude, so only those are checked.
      const n = dimples.length;
      const span = Math.ceil((R * n) / 2) + 6;
      const nearest = (d) => {
        const i0 = Math.round(((1 - d[1]) / 2) * n - 0.5);
        let best = -2;
        for (let i = Math.max(0, i0 - span); i <= Math.min(n - 1, i0 + span); i++) {
          const p = dimples[i];
          const v = d[0] * p[0] + d[1] * p[1] + d[2] * p[2];
          if (v > best) best = v;
        }
        return best;
      };
      const depth = (d) => {
        const v = nearest(d);
        if (v < cosR) return 0;
        const t = Math.acos(clamp(v, -1, 1)) / R;
        return 1 - t * t;
      };
      const ball = k.part("ball");
      const core = k.part("core");
      const color = (c) => {
        const dd = depth(unit(c.lp));
        return shade("#f6f6f3", 1 - 0.2 * dd + 0.04 * c.n[1]);
      };
      const r = (d) => 1 - 0.035 * depth(d);
      k.add(k.radial(r, { grid: 160 }), {
        flat: 0.2,
        even: true,
        interior: 0.1,
        core: "#c9c9c9",
        part: (c) => (c.inside ? core : ball),
        color,
      });
      // Caps over the poles of the sampling (see body()).
      for (const sy of [1, -1])
        k.add(
          k.param(
            (u, v) => {
              const th = 0.14 * v;
              const d = [Math.sin(th) * Math.cos(TAU * u), sy * Math.cos(th), sy * Math.sin(th) * Math.sin(TAU * u)]; // prettier-ignore
              return scale3(d, r(d));
            },
            { grid: 16 },
          ),
          { flat: 0.2, even: true, part: ball, color },
        );
    },
  },

  "rugby-ball": {
    options: [{ key: "color", label: "Bands", type: "color", default: "#1d4e89" }],
    // A punt: it tumbles end over end up and down, then lands on a point and
    // takes an awkward, lopsided bounce before settling.
    ...throwPulse("kick", "Punt", 2.6),
    drive(t, c, out) {
      const e = sinceTap(c, "kick", 2.6);
      if (e < 0) return;
      const f = band01(e, 0.05, 1.45);
      const g = band01(e, 1.45, 2.05);
      const tumble = 2 * Math.PI * 2.25 * easeIO(f) + 0.75 * Math.PI * easeIO(g);
      const hop = arc(g, 0.18);
      const yaw = 0.6 * Math.sin(Math.PI * g);
      out.body = {
        offset: [0.06 * Math.sin(Math.PI * g), arc(f, 0.6) + hop, 0],
        quat: quatMul(quatAxisAngle([0, 1, 0], yaw), quatAxisAngle([0, 0, 1], tumble)),
      };
    },
    build(k, o) {
      const L = 1.3;
      const prof = [];
      for (let i = 0; i <= 24; i++) {
        const y = -L + (2 * L * i) / 24;
        prof.push([0.8 * Math.pow(Math.max(0, 1 - (y / L) ** 2), 0.6), y]);
      }
      k.add(k.lathe(prof, { grid: 80 }), {
        rot: [0, 0, 90],
        flat: 0.18,
        interior: 0.12,
        jitter: 0.012,
        even: true,
        core: "#8a8270",
        color: (c) => {
          const a = c.u * TAU;
          const y = c.lp[1];
          if (Math.abs(Math.sin(2 * a)) < 0.02) return keep(lit("#9e998b", c.n), 0.7);
          const band = Math.abs(Math.abs(y) - 0.78) < 0.12;
          // A pebbled grip in fine, even bumps.
          return grip(c, band ? o.color : "#f2efe6", { f: 60, depth: 0.55, crevice: 0.14 });
        },
      });
    },
  },

  volleyball: {
    options: [
      { key: "c1", label: "Colour 1", type: "color", default: "#f7c948" },
      { key: "c2", label: "Colour 2", type: "color", default: "#1f4e9c" },
    ],
    // A soft set straight up with no spin, then a spike drives it down hard
    // with topspin; it slams into the floor, kicks up and bounces out.
    ...throwBall("spike", "Set and spike", VB_G, VOLLEYBALL),
    build(k, o) {
      body(k, (c) => {
        const s = strips(c.ln);
        // Smooth leather panels; clean, fine seams.
        if (s.seam < 0.016) return keep(lit("#7d838d", c.n), 0.6);
        const cols = [o.c1, "#fbfbf8", o.c2];
        return lit(cols[(s.strip + s.face) % 3], c.n, { sheen: 0.14, tight: 18 });
      });
    },
  },

  "water-polo-ball": {
    // Tossed up, it plunges into the water with a splash, pops back up and
    // bobs on the water line, each bob sending out a ripple.
    ...throwBall("toss", "Toss it in", WP_G, WATERPOLO, {
      extra(e, pose, c, out) {
        const m = [0, 0, 0, 0];
        const s = e - WP_PLUNGE;
        const splash = s >= 0 && s < 0.6;
        out.parts.splash = { visible: splash ? 1 : 0, scale: 1.5 };
        m[0] = splash ? Math.sin(Math.PI * band01(s, 0, 0.6)) : 0;
        WP_RINGS.forEach((r, i) => {
          const on = s >= r && s < r + 1.4;
          out.parts[`ring${i}`] = { visible: on ? 1 : 0, scale: 1 + 1.9 * easeOut(band01(s, r, r + 1.4)) }; // prettier-ignore
          m[i + 1] = on ? band01(s, r + 0.15, r + 1.4) : 0;
        });
        out.morph = m;
      },
    }),
    build(k) {
      body(k, (c) => {
        const s = strips(c.ln);
        if (s.seam < 0.02) return keep("#23304f", 0.8);
        const grip = c.noise(c.lp[0] * 90, c.lp[1] * 90, c.lp[2] * 90);
        return shade((s.strip + s.face) % 2 ? "#1c4fa1" : "#f2cf1d", 0.92 + 0.12 * grip);
      });
      // The splash and the ripples on the water line, hidden at rest. They
      // are built small, inside the ball (the toy is framed by all its
      // splats), and spread by their parts.
      const water = [0, WATER_Y, 0];
      const splash = k.part("splash", { pivot: water });
      k.cloud({ share: 0.012, size: 0.9, part: splash, pattern: false }, (rand) => {
        const a = rand() * TAU;
        const r = 0.5 + 0.25 * rand();
        const up = 0.25 + 0.35 * rand() * rand();
        const out = 1.2 + 0.1 * rand();
        return {
          p: [r * Math.cos(a), WATER_Y, r * Math.sin(a)],
          to: [r * out * Math.cos(a), WATER_Y + up, r * out * Math.sin(a)],
          channel: 0,
          color: mix("#d6eefc", "#ffffff", rand()),
          opacity: 0.85,
        };
      });
      WP_RINGS.forEach((_, i) => {
        const ring = k.part(`ring${i}`, { pivot: water });
        k.cloud({ share: 0.015, size: 1.2, part: ring, pattern: false }, (rand) => {
          const a = rand() * TAU;
          const r = 0.84 + 0.012 * (rand() - 0.5);
          return {
            p: [r * Math.cos(a), WATER_Y, r * Math.sin(a)],
            color: mix("#cfeaff", "#ffffff", rand()),
            opacity: 0.45,
            kind: "fade",
            params: [0, 1],
            channel: 1 + i,
          };
        });
      });
    },
  },

  "ping-pong-ball": {
    // Flicked up, it bounces on and on, each bounce lower and quicker, till
    // it buzzes to a stop.
    ...throwBall("flick", "Drop it", PP_G, PINGPONG),
    options: [
      {
        key: "color",
        label: "Colour",
        type: "select",
        default: "white",
        choices: [
          { id: "white", label: "White" },
          { id: "orange", label: "Orange" },
        ],
      },
    ],
    build(k, o) {
      const col = o.color === "orange" ? "#f7892b" : "#f7f7f4";
      body(k, (c) => (Math.abs(c.ln[1]) < 0.01 ? keep(shade(col, 0.9)) : col), {
        core: "#e8e8e8",
        interior: 0.03,
      });
    },
  },

  "cricket-ball": {
    // Twice the splats (as far as the device allows): the unlit copy and the
    // light for its spin (glossSpin) take a share, and the ball at rest keeps
    // its own.
    density: 2,
    // Flicked up seam-up: the seam stands upright and the ball spins
    // backwards about it, comes down level and skids on with its backspin
    // till the spin grips and rolls it home.
    ...throwBall("flick", "Seam-up flick", grav(0.036), CRICKET, { gloss: true }),
    build(k) {
      const leather = "#8f1d1d";
      // lit: (colour, normal, light) => colour. Unlit (for the spinning
      // copy), the seam keeps the shading of its ridge.
      const paint = (c, lit) => {
        const [x, y] = c.ln;
        const a = Math.atan2(c.ln[0], c.ln[2]);
        if (Math.abs(y) < 0.075) {
          // The raised seam: six rows of stitching, lit as a ridge.
          const row = Math.floor(((y + 0.075) / 0.15) * 6);
          const ridge = unit([c.n[0], c.n[1] + (y / 0.075) * 0.5, c.n[2]]);
          if (row === 2 || row === 3) return keep(lit(shade(leather, 0.62), ridge), 0.7);
          const dash = ((a / TAU) * 180 + row * 0.5) % 1 < 0.6;
          return keep(lit(dash ? "#f2ead4" : shade(leather, 0.8), ridge, { sheen: 0.3 }), 0.6);
        }
        if (Math.abs(x) < 0.008) return keep(lit(shade(leather, 0.7), c.n));
        // Polished red leather: deep colour and a bright, tight shine.
        return lit(leather, c.n, { sheen: 0.6, tight: 40, soft: 0.3 });
      };
      body(k, (c) => paint(c, lit));
      glossSpin(
        k,
        (c) => paint(c, (col, n) => shade(col, keyF(n) / keyF(c.n))),
        litLight({ sheen: 0.6, tight: 40, soft: 0.3 }),
      );
    },
  },

  "bowling-ball": {
    options: [
      { key: "c1", label: "Colour 1", type: "color", default: "#3a1f78" },
      { key: "c2", label: "Colour 2", type: "color", default: "#d946ef" },
    ],
    // A heavy roll with a hook: it drops onto the lane, rolls away straight
    // and hooks across; the pins crash far off, and it rolls back home.
    ...throwBall("bowl", "Bowl it", grav(0.109), BOWLING),
    build(k, o) {
      const holes = [
        { d: unit([-0.2, 0.95, 0.22]), r: 0.1 },
        { d: unit([0.2, 0.95, 0.22]), r: 0.1 },
        { d: unit([0, 0.8, -0.6]), r: 0.12 },
      ];
      // The finger holes are painted on the shell: a dark well with a dimmer
      // wall at its edge. (Bored as cylinders into the ball, they drew over
      // the shell as black spots once the roll turned them away.)
      body(
        k,
        (c) => {
          for (const h of holes) {
            const a = Math.acos(clamp(dot(c.ln, h.d), -1, 1));
            if (a < h.r) return keep(a > h.r - 0.02 ? "#2b2338" : "#0e0b13");
          }
          return swirl(c, [o.c1, o.c2, "#f5f0ff"]);
        },
        { core: "#1e1633", interior: 0.08 },
      );
    },
  },

  "pool-ball": {
    // Twice the splats (as far as the device allows): the unlit copy and the
    // light for its spin (glossSpin) take a share, and the ball at rest keeps
    // its own.
    density: 2,
    options: [
      { key: "number", label: "Number", type: "select", default: "n8", choices: numberChoices() },
    ],
    // A draw shot: struck low, it slides forward spinning backwards, stops,
    // and the backspin pulls it back till it rolls cleanly home. Its window
    // highlight and the room's reflection stay put while it turns.
    ...throwBall("shot", "Draw shot", 10, POOL_SHOT, { gloss: true }),
    build(k, o) {
      const n = o.number === "cue" ? 0 : Number(String(o.number).slice(1)) || 8;
      const col = POOL[n > 8 ? n - 8 : n];
      const stripe = n > 8;
      const text = String(n);
      // Polished phenolic resin: fully opaque, lit, with a sharp window
      // highlight and a soft reflection of the room along the top, so even the
      // black 8 reads as a solid shiny ball on a dark page.
      const gloss = (base, c) => {
        const { a, b } = poolLight(c.n);
        const x = rgb(base);
        return [0, 1, 2].map((i) => clamp(x[i] * a + b[i], 0, 1));
      };
      // Its colours, before the light: the number circle on the front and
      // back, the stripe or the solid colour.
      const paint = (c) => {
        const [x, y, z] = c.ln;
        if (n > 0 && Math.abs(z) > 0.93) {
          const px = z > 0 ? x : -x;
          const d = numberDist(text, px, y, 0.2);
          return { c: d < 0.024 ? "#141414" : "#f7f5ee", size: d < 0.024 ? 0.7 : 1, keep: true };
        }
        if (n > 0 && Math.abs(z) > 0.9) return { c: n === 8 ? "#f7f5ee" : col, keep: true };
        if (stripe) return Math.abs(y) < 0.46 ? col : "#f7f5ee";
        return col;
      };
      body(
        k,
        (c) => {
          const p = paint(c);
          return p.c ? { ...p, c: gloss(p.c, c) } : gloss(p, c);
        },
        { core: n === 8 ? "#111111" : col, interior: 0.2, opacity: 1, flat: 0.25, weight: 1.4 },
      );
      glossSpin(k, paint, poolLight);
    },
  },

  pickleball: {
    options: [{ key: "color", label: "Colour", type: "color", default: "#dce83a" }],
    // Popped up twice, the light holed ball slows fast in the air and
    // knuckles, then lands with a hollow click and a small, dead bounce.
    ...throwBall("pop", "Pop it up", 10, PICKLE),
    build(k, o) {
      const holes = fibonacciSphere(40);
      const R = 0.12;
      const inHole = (d) => holes.some((h) => dot(d, h) > Math.cos(R));
      body(
        k,
        (c) =>
          inHole(c.ln) ? null : Math.abs(c.ln[1]) < 0.01 ? keep(shade(o.color, 0.85)) : o.color,
        {
          interior: 0,
        },
      );
      // The hollow inside, seen through the holes.
      k.add(k.sphere(0.9), {
        part: k.part("ball"),
        flat: 0.3,
        weight: 0.5,
        color: shade(o.color, 0.45),
        pattern: false,
      });
    },
  },

  dodgeball: {
    options: [{ key: "color", label: "Colour", type: "color", default: "#d7263d" }],
    // Lifted and slammed down: the soft rubber squashes flat and wobbles,
    // and it bounces up lively, squashing again.
    ...throwBall("slam", "Slam it down", DB_G, DODGEBALL),
    build(k, o) {
      body(k, (c) => pebble(c, o.color, 0.14, 55), { flat: 0.3, core: shade(o.color, 0.5) });
    },
  },

  "medicine-ball": {
    // Heaved up only a little, slowly, it drops with a thud and a big, slow
    // squash, no bounce at all, and a puff of dust.
    ...throwBall("heave", "Heave and drop", MB_G, MEDICINE, {
      extra(e, pose, c, out) {
        const d = band01(e, MB_DUST, MB_DUST + 0.72);
        const on = e >= MB_DUST && e < MB_DUST + 0.72;
        out.parts.dust = { scale: 1 + 3 * easeOut(d), visible: on ? 1 : 0 };
        out.morph = [0, on ? band01(e, MB_DUST + 0.08, MB_DUST + 0.72) : 0, 0, 0];
      },
    }),
    build(k) {
      const w = 0.035;
      body(k, (c) => {
        const [x, y] = c.ln;
        if (Math.abs(x) < w || Math.abs(y) < w || Math.abs(Math.abs(x) - 0.71) < w)
          return keep(lit("#8a8a8a", c.n), 0.7);
        // Matte rubber grip: low, even bumps and no shine.
        return grip(c, "#34343a", { f: 45, depth: 0.5, crevice: 0.2 });
      });
      // A thinner, even rim shell: a crisp edge of light without the gray
      // haze over the face.
      rim(k, k.sphere(1.012), { even: true, size: 1, opacity: 0.012 });
      // A puff of dust where it lands: a ring of soft puffs under the ball,
      // built small (inside the ball) and spread by its part, fading out on
      // channel 1.
      const dust = k.part("dust", { pivot: [0, -0.93, 0] });
      k.cloud({ share: 0.005, size: 2.4, part: dust, pattern: false }, (rand) => {
        const a = rand() * TAU;
        const r = 0.24 + 0.12 * rand();
        return {
          p: [r * Math.cos(a), -0.95 + 0.08 * rand(), r * Math.sin(a)],
          color: mix("#9b9284", "#c4bcae", rand()),
          opacity: 0.2,
          kind: "fade",
          params: [0, 1],
          channel: 1,
        };
      });
    },
  },

  "lacrosse-ball": {
    options: [{ key: "color", label: "Colour", type: "color", default: "#f4f3ef" }],
    // Slammed down, the hard rubber ball rockets up and bounces hard and
    // fast, the liveliest ball on the shelf.
    ...throwBall("slam", "Slam it down", LX_G, LACROSSE),
    build(k, o) {
      body(k, (c) => pebble(c, o.color, 0.05, 20), { core: shade(o.color, 0.8) });
    },
  },

  "squash-ball": {
    // Cold, it is dead: dropped, it hardly bounces. Hit over and over, it
    // warms, glows faintly and bounces higher and faster; let go, it bounces
    // out and cools.
    ...throwBall("warm", "Warm it up", SQ_G, SQUASH, {
      extra(e, pose, c, out) {
        const w = SQUASH_WARM;
        const heat =
          e < 0 ? 0 : band01(e, w.start, w.hot) * Math.exp(-Math.max(0, e - w.hot) * 2.2);
        out.glow = [1, 0.42, 0.12, 0.28 * heat];
      },
    }),
    build(k) {
      const dots = [unit([0.35, 0.3, 0.88]), unit([-0.35, 0.3, 0.88])];
      body(
        k,
        (c) => {
          for (const d of dots) if (dot(c.ln, d) > Math.cos(0.09)) return keep("#f5d312");
          // Matte black rubber, with a little sheen so the shape reads.
          return grip(c, "#1c1c1e", { f: 50, depth: 0.4, crevice: 0.15, sheen: 0.12, tight: 10 });
        },
        // It warms with a faint glow (out.glow, a band on channel 3 that is
        // always on: the glow's strength does the work).
        { core: "#202020", kind: "band", params: [0, 4], channel: 3 },
      );
      // A thinner, even rim shell: a crisp edge of light without the gray
      // haze over the face.
      rim(k, k.sphere(1.012), { even: true, size: 1, opacity: 0.012 });
    },
  },

  "bouncy-ball": {
    options: [
      { key: "c1", label: "Colour 1", type: "color", default: "#ff2e88" },
      { key: "c2", label: "Colour 2", type: "color", default: "#27e1c1" },
      { key: "c3", label: "Colour 3", type: "color", default: "#ffe14d" },
    ],
    // Thrown down hard, it ricochets all over, its spin flipping at every
    // bounce, then comes home and settles.
    ...throwBall("throw", "Throw it down", BY_G, BOUNCY),
    build(k, o) {
      body(k, (c) => swirl(c, [o.c1, o.c2, o.c3], 2.4), { core: o.c2, interior: 0.2 });
    },
  },

  marble: {
    // The glass's fins need numbers to read as one clean edge (lane Fix4).
    density: 2,
    options: [{ key: "color", label: "Swirl", type: "color", default: "#1e88e5" }],
    // It rolls round a little circle, the swirl inside turning as it goes,
    // and is back exactly as it was after one lap.
    ...throwBall("roll", "Roll it", grav(0.008), MARBLE, {
      extra(e, pose, c, out) {
        // The clear glass stays as it is (it looks the same turned); only
        // the swirl inside turns, and it keeps its far side.
        out.parts.ball.cull = false;
        out.parts.ball.visible = 1;
        out.parts.glass = { offset: pose.p };
      },
    }),
    build(k, o) {
      // Clear glass that glints, with twisted vanes of colour inside. The
      // vanes turn when it rolls (part "ball"); the glass only moves.
      const glass = k.part("glass");
      const ball = k.part("ball");
      // The glass (lane Fix4). Real glass is clear face on and shows a bright,
      // crisp edge where it turns away. Splats can't see the camera, so the
      // edge is built from "fins": thin splats standing on edge across the
      // surface, each in a plane through the centre. Face on, the eye sees
      // every fin edge on, as a hairline, so the glass is nearly clear; at
      // the rim it sees them side on, stacked along its line of sight, so
      // they add up to a solid edge from any side. A dark fin layer outside
      // (a thin dark line on a light page) and a bright one inside it (a
      // bright edge on a dark page).
      // The same fine fins on every device: a smaller budget makes every
      // splat bigger and gives fewer fins, so they are sized back down and
      // made more opaque to add up to the same edge.
      const tier = k.count / 200000;
      const fins = (r, col, opacity, count) => {
        let dirs = [];
        k.cloud({ count, part: glass, pattern: false, jitter: 0 }, (rand, i, n) => {
          // (The kit may scale the count to the toy's budget.)
          if (dirs.length !== n) dirs = fibonacciSphere(n);
          // A little scatter, so the fins' even rows never show as rings.
          const g = 0.8 / Math.sqrt(n);
          const d = unit(dirs[i].map((x) => x + (rand() - 0.5) * g));
          const a = unit(cross(d, Math.abs(d[1]) < 0.9 ? [0, 1, 0] : [1, 0, 0]));
          const b = cross(d, a);
          const t = rand() * TAU;
          return {
            p: d.map((x) => x * r),
            n: [0, 1, 2].map((j) => a[j] * Math.cos(t) + b[j] * Math.sin(t)),
            flat: GLASS.fin,
            size: GLASS.size * Math.sqrt(Math.min(1, tier)),
            color: col,
            opacity: Math.min(0.6, opacity / Math.min(1, tier)),
          };
        });
      };
      fins(0.99, "#2c4452", GLASS.edge, GLASS.count);
      fins(0.965, "#f6fcff", GLASS.band, GLASS.count);
      // A faint tint over the whole ball, face on.
      k.add(k.sphere(1), {
        even: true,
        jitter: 0,
        part: glass,
        flat: 0.05,
        opacity: GLASS.tint,
        pattern: false,
        color: "#cfe6ea",
      });
      // A highlight up and to the left, crisp at its edge, and its small
      // reflection low on the right (the light coming back off the far
      // side of the glass): discs of splats on the shell.
      const spot = (dir, radius, count, peak) => {
        const L = unit(dir);
        const e1 = unit(cross(L, [0, 1, 0]));
        const e2 = cross(e1, L);
        k.cloud({ count, part: glass, pattern: false, flat: 0.15 }, (rand, i, n) => {
          const f = (i + 0.5) / n;
          const th = radius * Math.sqrt(f);
          const ph = i * 2.399963229728653;
          const d = [0, 1, 2].map(
            (j) =>
              L[j] * Math.cos(th) + (e1[j] * Math.cos(ph) + e2[j] * Math.sin(ph)) * Math.sin(th),
          );
          return {
            p: d.map((x) => x * 1.004),
            n: d,
            color: "#ffffff",
            size: 0.7,
            opacity: peak * (1 - smoothstep(0.1, 1, f)),
          };
        });
      };
      spot([0.21, 0.68, 1], GLASS.spot, 500, 0.95);
      spot([0.85, -0.28, 0.7], GLASS.spot * 0.45, 120, 0.75);
      for (let v = 0; v < 3; v++) {
        const base = (v / 3) * TAU;
        const vane = k.param(
          (u, w) => {
            const y = (w - 0.5) * 1.7;
            const r = (u - 0.5) * 1.6 * Math.sqrt(Math.max(0, 1 - (y / 0.95) ** 2));
            const a = base + y * 2.4;
            return [r * Math.cos(a), y, r * Math.sin(a)];
          },
          { grid: 48 },
        );
        k.add(vane, {
          even: true,
          opacity: 1,
          jitter: 0.015,
          part: ball,
          weight: 1.6,
          flat: 0.3,
          color: (c) => mix(o.color, v === 1 ? "#ffffff" : shade(o.color, 0.6), 0.25 + 0.25 * c.u),
        });
      }
    },
  },

  "hockey-puck": {
    density: 2,
    // A slap shot: ice chips spray from the stick, and the puck glides flat
    // across the ice, spinning fast, runs round a wide loop as it slows and
    // slides back to its spot.
    ...throwPulse("shoot", "Slap shot", 3),
    drive(t, c, out) {
      const e = sinceTap(c, "shoot", 3);
      out.parts.spray = { visible: 0 };
      if (e < 0) return;
      // Friction: fast at first, easing to a stop.
      const f = 1 - (1 - band01(e, 0.04, 2.8)) ** 2;
      const loop = 2 * Math.PI * f;
      const spin = 2 * Math.PI * 6 * f;
      // The slap tips it on edge for a moment, then it lies flat.
      const tip = 0.22 * Math.sin(Math.PI * band01(e, 0, 0.18)) * (1 - band01(e, 0.12, 0.3));
      const off = [0.75 * Math.sin(loop), 0.04 * Math.sin(Math.PI * band01(e, 0, 0.2)), -0.45 * (1 - Math.cos(loop))]; // prettier-ignore
      const q = quatMul(quatAxisAngle([0, 0, 1], tip), quatAxisAngle([0, 1, 0], -spin));
      out.body = { offset: off, quat: q };
      // The ice spray stays where the stick hit: undo the puck's motion.
      const inv = [-q[0], -q[1], -q[2], q[3]];
      // (Body offsets are in toy radii; part offsets in recipe units.)
      const back = rotate(
        inv,
        off.map((v) => -v * PUCK_R),
      );
      const burst = band01(e, 0, 0.45);
      out.parts.spray = {
        quat: inv,
        offset: back,
        scale: 0.35 + 1.1 * Math.sqrt(burst),
        visible: 1 - band01(e, 0.25, 0.75),
      };
    },
    build(k) {
      // The spray of ice chips (hidden until the shot).
      const spray = k.part("spray", { pivot: [0, 0, 0] });
      k.cloud({ count: 900, part: spray, pattern: false }, (rand) => {
        const a = Math.PI + (rand() - 0.5) * 1.6;
        const r = 1.05 + rand() * 0.55;
        return {
          p: [Math.cos(a) * r, -0.15 + rand() * 0.35 * rand(), Math.sin(a) * r * 0.8],
          color: mix("#dff3ff", "#ffffff", rand()),
          size: 0.35 + 0.4 * rand(),
          opacity: 0.95,
          kind: "twinkle",
          params: [0.7, rand()],
        };
      });
      // Vulcanized rubber: smooth, matte faces with a soft sheen, a knurled
      // band round the side and a crisp lighter edge where the faces meet
      // the side (no noise, and no see-through shell round the outline).
      k.add(k.cylinder(1, 0.34), {
        flat: 0.15,
        jitter: 0.006,
        even: true,
        opacity: 1,
        interior: 0.1,
        core: "#19191b",
        color: (c) => {
          if (c.s.side) {
            const y = Math.abs(c.lp[1]);
            // The edge: a thin bevel that catches the light.
            if (y > 0.155) return keep(lit("#3a3a3d", c.n, { sheen: 0.25, tight: 6 }));
            const a = Math.atan2(c.lp[0], c.lp[2]);
            // A diamond knurl: two sets of fine grooves crossing, smoothed so
            // they don't flicker at phone size.
            const g1 = Math.cos(TAU * ((a / TAU) * 90 + c.lp[1] * 14));
            const g2 = Math.cos(TAU * ((a / TAU) * 90 - c.lp[1] * 14));
            const band = smoothstep(0.125, 0.11, y);
            const k1 = band * 0.5 * (smoothstep(0.2, 0.8, g1) + smoothstep(0.2, 0.8, g2));
            return keep(lit(mix("#1c1c1e", "#29292c", k1), c.n, { sheen: 0.14, tight: 8 }));
          }
          const r = c.s.radial ?? 0;
          if (r > 0.975) return keep(lit("#3a3a3d", c.n, { sheen: 0.25, tight: 6 }));
          if (Math.abs(r - 0.72) < 0.012) return keep(lit("#343436", c.n));
          return lit(shade("#1c1c1e", 1 + 0.04 * r), c.n, { sheen: 0.14, tight: 10 });
        },
      });
    },
  },

  shuttlecock: {
    // Hit up: it flips over cork first and flies up spinning, turns over at
    // the top and floats back down cork first, spinning slower as it falls.
    ...throwPulse("hit", "Hit it", 3),
    drive(t, c, out) {
      const e = sinceTap(c, "hit", 3);
      if (e < 0) return;
      const up = band01(e, 0.05, 0.6);
      const down = band01(e, 0.95, 2.7);
      const h = e < 0.6 ? 0.7 * (1 - (1 - up) ** 2) : e < 0.95 ? 0.7 : 0.7 * (1 - easeIO(down));
      const flip = Math.PI * (easeIO(band01(e, 0.05, 0.3)) - easeIO(band01(e, 0.65, 1.05)));
      const spin = 2 * Math.PI * (3 * easeIO(band01(e, 0.05, 1.0)) + 2.2 * down);
      out.body = {
        offset: [0.05 * Math.sin(e * 3), h, 0],
        quat: quatMul(quatAxisAngle([1, 0, 0], flip), quatAxisAngle([0, 1, 0], spin)),
      };
    },
    build(k) {
      // The cork: a rounded base under a short band.
      k.add(k.sphere(0.3), {
        even: true,
        opacity: 1,
        jitter: 0.015,
        pos: [0, -0.62, 0],
        scale: [1, 0.85, 1],
        flat: 0.25,
        interior: 0.1,
        color: (c) => (c.lp[1] > 0 ? null : pebble(c, "#e9dcc2", 0.1, 30)),
      });
      k.add(k.cylinder(0.3, 0.14, { caps: "top" }), {
        even: true,
        opacity: 1,
        jitter: 0.015,
        pos: [0, -0.55, 0],
        flat: 0.25,
        color: (c) => (c.s.cap ? "#f1ece3" : keep("#233a8f")),
      });
      // The skirt of sixteen feathers, scalloped at the top.
      const H = 1.25;
      // A lathe rather than k.cone: its even placement has no lattice.
      const skirt = k.lathe(
        [
          [0.27, -H / 2],
          [0.465, 0],
          [0.66, H / 2],
        ],
        { grid: 96 },
      );
      k.add(skirt, {
        opacity: 1,
        jitter: 0.015,
        pos: [0, -0.48 + H / 2, 0],
        even: true,
        flat: 0.25,
        color: (c) => {
          const a = Math.atan2(c.lp[0], c.lp[2]);
          const f = ((a / TAU) * 16 + 16) % 1;
          const t = (c.lp[1] + H / 2) / H;
          const scallop = 1 - 0.1 * Math.pow(Math.abs(f - 0.5) * 2, 2);
          if (t > scallop) return null;
          if (f < 0.05 || f > 0.95) return keep("#d9d6cf", 0.8);
          if (Math.abs(t - 0.28) < 0.02 || Math.abs(t - 0.5) < 0.02) return keep("#1b1b1b", 0.8);
          return "#fbfbf8";
        },
      });
    },
  },

  "flying-disc": {
    options: [{ key: "color", label: "Colour", type: "color", default: "#ff5a36" }],
    // A throw: it spins fast and flat, banks into a curve, glides round a
    // loop like a returning throw and settles back, still spinning down.
    ...throwPulse("throw", "Throw", 3),
    drive(t, c, out) {
      const e = sinceTap(c, "throw", 3);
      if (e < 0) return;
      const f = band01(e, 0.05, 2.4);
      const loop = 2 * Math.PI * easeIO(f);
      const spin = 2 * Math.PI * 7 * (1 - (1 - band01(e, 0, 2.9)) ** 2);
      const bank = 0.35 * Math.sin(Math.PI * f);
      out.body = {
        offset: [0.42 * Math.sin(loop), arc(f, 0.35), 0.28 * (1 - Math.cos(loop)) * -0.5],
        quat: quatMul(
          quatAxisAngle([Math.cos(loop), 0, -Math.sin(loop)], -bank),
          quatAxisAngle([0, 1, 0], -spin),
        ),
      };
    },
    build(k, o) {
      const prof = [
        [0.0, 0.02],
        [0.7, 0.0],
        [0.88, -0.06],
        [0.9, -0.13],
        [0.97, -0.12],
        [1.0, -0.05],
        [0.96, 0.02],
        [0.85, 0.06],
        [0.5, 0.09],
        [0.0, 0.1],
      ];
      k.add(k.lathe(prof, { grid: 96 }), {
        flat: 0.2,
        jitter: 0.01,
        even: true,
        color: (c) => {
          const r = Math.hypot(c.lp[0], c.lp[2]);
          const top = c.lp[1] > 0.06;
          // Moulded flight rings: two low ridges, lit on one side and shaded
          // on the other, and a groove.
          if (top && Math.abs(r - 0.55) < 0.02) return keep(lit(shade(o.color, 0.72), c.n), 0.7);
          let n = c.n;
          if (top) {
            for (const rr of [0.62, 0.68]) {
              const d = (r - rr) / 0.018;
              if (Math.abs(d) < 1) {
                const out = [c.lp[0] / (r || 1), 0, c.lp[2] / (r || 1)];
                const tilt = -d * 1.2;
                n = unit([n[0] + out[0] * tilt, n[1], n[2] + out[2] * tilt]);
              }
            }
          }
          // Glossy plastic: a clear highlight and a faint milky lift on top.
          const base = mix(o.color, "#ffffff", 0.06 * Math.max(0, c.n[1]));
          const out = lit(base, n, { sheen: 0.55, tight: 28, soft: 0.28 });
          return mix(out, "#ffffff", 0.22 * Math.max(0, dot(n, HALF)) ** 4);
        },
      });
    },
  },
};
