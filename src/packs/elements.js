// Weather and elements pack: fire, storms, ice. Loaded on demand.
//
// Weather toys lean on behaviours: rain and snow fall, sparks and steam
// rise, dust orbits; lightning, blobs of wax and swirling snow are parts
// that drive() shows, hides and moves on a clock.

import {
  mix,
  shade,
  smoothstep,
  clamp,
  ramp,
  spline,
  quatAxisAngle,
  quatMul,
  quatRotate,
  vec,
} from "../kit.js";

const TAU = Math.PI * 2;
const { add, sub, mul, dot, cross, len, unit } = vec;

// Timing for tap effects. A pulse control runs from 1 down to 0 over its
// `ease` seconds, so progress() is 0 at the tap and 1 when it is done.
const clamp01 = (x) => (x < 0 ? 0 : x > 1 ? 1 : x);
const ease = (x) => x * x * (3 - 2 * x);
const easeOut = (x) => 1 - (1 - x) * (1 - x) * (1 - x);
// 0 before a, rising to 1 at b.
const band = (x, a, b) => clamp01((x - a) / (b - a));
// Rises from a to b, holds, falls from c to d.
const bump = (x, a, b, c, d) => band(x, a, b) * (1 - band(x, c, d));
const progress = (v) => (v > 0 ? 1 - v : 1);
// Seconds since the tap (the effect's own clock), or null at rest.
const since = (v, secs) => (v > 0 ? (1 - v) * secs : null);

// Per-toy memory for drive(), keyed by the control state object (new each
// time a toy loads).
const MEM = new WeakMap();
function mem(c) {
  let m = MEM.get(c);
  if (!m) MEM.set(c, (m = {}));
  return m;
}
// True on the frame a pulse control fires.
function fired(m, key, v) {
  const was = m["p_" + key] ?? 0;
  m["p_" + key] = v;
  return v > was + 0.02;
}
// Later sounds of a tap effect: each [at, spec] plays from drive() when the
// effect's clock s (seconds, null at rest) passes `at`.
function cuesAt(m, s, list, out) {
  const was = m.cueS ?? -1;
  m.cueS = s ?? -1;
  if (s === null || s < was) return;
  for (const [at, spec] of list) if (was < at && s >= at) out.cues.push(spec);
}
// The integral of a trapezoid speed boost: 0 to k over [0, r], k until a,
// back to 0 at b. An extra clock for "runs faster for a while" without a
// jump when it ends.
function boostClock(s, k, r, a, b) {
  if (s <= 0) return 0;
  if (s <= r) return (k * s * s) / (2 * r);
  if (s <= a) return (k * r) / 2 + k * (s - r);
  const x = Math.min(s, b) - a;
  return (k * r) / 2 + k * (a - r) + k * (x - (x * x) / (2 * (b - a)));
}
const lerp3 = (a, b, t) => [
  a[0] + (b[0] - a[0]) * t,
  a[1] + (b[1] - a[1]) * t,
  a[2] + (b[2] - a[2]) * t,
];
const keep = (c, size) => ({ c, keep: true, size });
// Spherical interpolation between two rotations.
function slerpQ(a, b, f) {
  let d = a[0] * b[0] + a[1] * b[1] + a[2] * b[2] + a[3] * b[3];
  const sg = d < 0 ? -1 : 1;
  d *= sg;
  if (d > 0.9995) {
    const q = a.map((x, i) => x + (sg * b[i] - x) * f);
    const l = Math.hypot(...q);
    return q.map((x) => x / l);
  }
  const th = Math.acos(d);
  const wa = Math.sin((1 - f) * th) / Math.sin(th);
  const wb = (sg * Math.sin(f * th)) / Math.sin(th);
  return a.map((x, i) => wa * x + wb * b[i]);
}

// A fake light from the upper left, in front.
const LIGHT = unit([-0.35, 0.85, 0.45]);
const lit = (col, n, k = 0.3) => shade(col, 1 + k * (dot(n, LIGHT) - 0.25));

function randDir(rand) {
  const z = 2 * rand() - 1;
  const a = rand() * TAU;
  const r = Math.sqrt(Math.max(0, 1 - z * z));
  return [r * Math.cos(a), z, r * Math.sin(a)];
}

// A repeatable pseudo-random number in 0..1 for an integer (drive() has no
// seeded generator, so schedules hash the time slot).
function hash1(n) {
  const x = Math.sin(n * 127.1 + 311.7) * 43758.5453;
  return x - Math.floor(x);
}

// Straight segments through points, as t in 0..1 -> point (a tube path
// with sharp corners, for lightning).
function polyline(pts) {
  const n = pts.length - 1;
  return (t) => {
    const x = Math.min(n - 1e-6, Math.max(0, t * n));
    const i = Math.floor(x);
    return lerp3(pts[i], pts[i + 1], x - i);
  };
}

// A curve sampled once into a table (quick to evaluate many times).
function baked(curve, n = 256) {
  const pts = [];
  for (let i = 0; i <= n; i++) pts.push(curve(i / n));
  return polyline(pts);
}

// A jagged path from a to b: midpoints pushed sideways, `depth` times.
function jagged(rand, a, b, depth) {
  let pts = [a, b];
  let amp = Math.hypot(b[0] - a[0], b[1] - a[1], b[2] - a[2]) * 0.18;
  for (let d = 0; d < depth; d++) {
    const next = [pts[0]];
    for (let i = 1; i < pts.length; i++) {
      const m = lerp3(pts[i - 1], pts[i], 0.5);
      next.push(
        [
          m[0] + (rand() - 0.5) * 2 * amp,
          m[1] + (rand() - 0.5) * amp * 0.5,
          m[2] + (rand() - 0.5) * amp,
        ],
        pts[i],
      );
    }
    pts = next;
    amp *= 0.55;
  }
  return pts;
}

// Lava lamp blobs: where each sits and how it travels (shared by build and
// drive, so the parts move from where they were built).
const LAVA = [
  { x: 0.02, z: 0.03, r: 0.13, tall: 1.35, lo: 0.2, hi: 1.05, speed: 0.32, phase: 0.6, twin: true },
  { x: -0.05, z: -0.04, r: 0.1, tall: 1.2, lo: 0.15, hi: 1.12, speed: 0.26, phase: 2.4 },
  { x: 0.05, z: -0.02, r: 0.085, tall: 1.5, lo: 0.25, hi: 1.0, speed: 0.4, phase: 4.1 },
  { x: -0.03, z: 0.05, r: 0.075, tall: 1.2, lo: 0.3, hi: 1.15, speed: 0.22, phase: 5.3 },
  { x: 0.04, z: 0.04, r: 0.11, tall: 1.1, lo: 0.12, hi: 0.7, speed: 0.3, phase: 1.3, twin: true },
  { x: -0.05, z: 0.0, r: 0.06, tall: 1.3, lo: 0.4, hi: 1.18, speed: 0.36, phase: 3.3 },
];
const lavaY = (b, t) => b.lo + (b.hi - b.lo) * (0.5 - 0.5 * Math.cos(t * b.speed + b.phase));
const LAVA_SECS = 4.6;
// The lamp's glass: it swells in the middle and tapers into the cap.
const lavaGlassR = (y) =>
  0.2 +
  0.075 * Math.sin(Math.PI * clamp((y + 0.05) / 1.35, 0, 1) * 0.8) -
  0.115 * smoothstep(0.62, 1.3, y);
// Colour sets: wax, liquid, and the glow the wax runs through when heated
// (from its resting glow round to it again). "own" takes the Wax and
// Liquid colours from the pickers and the classic orange-magenta-gold.
const LAVA_SETS = {
  own: { label: "Pick below" },
  ocean: {
    label: "Ocean",
    wax: "#3fd8e8",
    liquid: "#1d3fa8",
    glow: [
      [0.1, 0.3, 0.8],
      [0, 0.65, 0.8],
      [0.4, 0.15, 0.8],
      [0.1, 0.7, 0.7],
      [0.1, 0.3, 0.8],
    ],
  },
  violet: {
    label: "Violet",
    wax: "#ff5fae",
    liquid: "#6b2fc0",
    glow: [
      [0.5, 0.08, 0.8],
      [0.8, 0.15, 0.55],
      [0.8, 0.5, 0.8],
      [0.65, 0.25, 0.8],
      [0.5, 0.08, 0.8],
    ],
  },
  lime: {
    label: "Lime",
    wax: "#62d62a",
    liquid: "#3f86e8",
    glow: [
      [0.3, 0.8, 0.05],
      [0.8, 0.8, 0.1],
      [0.05, 0.8, 0.6],
      [0.4, 0.8, 0.1],
      [0.3, 0.8, 0.05],
    ],
  },
  sunset: {
    label: "Sunset",
    wax: "#ff7a1f",
    liquid: "#d81b60",
    glow: [
      [0.8, 0.35, 0],
      [0.8, 0.08, 0.3],
      [0.8, 0.65, 0.08],
      [0.8, 0.3, 0.08],
      [0.8, 0.35, 0],
    ],
  },
  midnight: {
    label: "Midnight",
    wax: "#f2efe6",
    liquid: "#1d2c78",
    glow: [
      [0.4, 0.55, 0.8],
      [0.15, 0.8, 0.8],
      [0.7, 0.7, 0.8],
      [0.3, 0.55, 0.8],
      [0.4, 0.55, 0.8],
    ],
  },
};
// The blobs for a lamp's options: the six classic ones first, then more
// (each from its own seed, so a blob keeps its path whatever the count),
// scaled by Blob size (smaller as they get many) and shaped. A blob made
// bigger than the classic ones rises less far, so it stays in the glass.
function lavaBlobs(o) {
  const n = clamp(Math.round(o.blobs ?? LAVA.length), 2, 12);
  const size = clamp(o.size ?? 1, 0.5, 1.5) * Math.pow(Math.min(1, LAVA.length / n), 0.35);
  const shape = o.shape || "mixed";
  const list = [];
  for (let i = 0; i < n; i++) {
    let b;
    if (i < LAVA.length) b = { ...LAVA[i] };
    else {
      const r = lcg(701 + 37 * i);
      const a = r() * TAU;
      const d = 0.03 + 0.04 * r();
      const lo = 0.12 + 0.28 * r();
      b = {
        x: Math.sin(a) * d,
        z: Math.cos(a) * d,
        r: 0.055 + 0.06 * r(),
        tall: 1.1 + 0.4 * r(),
        lo,
        hi: Math.min(1.15, lo + 0.45 + 0.5 * r()),
        speed: 0.2 + 0.22 * r(),
        phase: r() * TAU,
        twin: r() < 0.3,
      };
    }
    if (size !== 1) b.r *= size;
    if (shape === "round") {
      b.tall = 1;
      b.twin = false;
    } else if (shape === "tall") {
      b.tall = 1.75;
      b.twin = false;
    }
    if (size > 1 || i >= LAVA.length) {
      const room = (y) => lavaGlassR(y) - Math.hypot(b.x, b.z) + 0.01;
      while (b.hi > b.lo + 0.05 && b.r > room(b.hi + 0.5 * b.r * b.tall)) b.hi -= 0.02;
      b.r = Math.min(b.r, room(b.hi + 0.5 * b.r * b.tall));
    }
    list.push(b);
  }
  return list;
}
const ICE_SECS = 7.6;
// The ice swan (E4 review: "it melts by dripping water and slowly
// breaking decomposing, with the melt speed accelerating a bit as more of
// it melts"). A tap melts it from the tap to ICE_MELT seconds, faster and
// faster, as far as ICE_TOP (1: all but a lump of the body), then it
// refreezes. Each piece is a part that melts by getting smaller about
// where it joins the rest (its pivot) over its window of the melt level
// [start, end]; a piece that breaks off first thins a little, cracks off
// at `detach`, falls (over `fall` of the melt level) to lie in the water
// at `land` (its centre, `centre`, turned by `turn`), and melts away there
// over `gone`. `min` is what is left of it (the body's lump).
const ICE_MELT = 4.4;
const ICE_TOP = 0.93;
// Drops: how long one beads before it falls, and how fast it falls.
const ICE_HANG = 0.3;
const ICE_G = 5.5;
// Where the neck breaks, and the height above which a wing's arched top
// cracks off.
const ICE_NECK_BREAK = 0.8;
const ICE_WING_BREAK = 0.8;
const ICE_PIECES = [
  { name: "body", pivot: [-0.02, 0.3, 0], start: 0.12, end: 1, min: 0.32 },
  { name: "beak", on: "head", pivot: [0.52, 1.155, 0], start: 0.03, end: 0.15 },
  { name: "tail", on: "body", pivot: [-0.3, 0.5, 0], start: 0.1, end: 0.46 },
  { name: "neckLo", on: "body", pivot: [0.27, 0.53, 0], start: 0.36, end: 0.76 },
  { name: "wingNear", on: "body", pivot: [0.02, 0.58, 0.17], start: 0.3, end: 0.72 },
  { name: "wingFar", on: "body", pivot: [0.02, 0.58, -0.17], start: 0.32, end: 0.74 },
  {
    name: "tipNear",
    on: "wingNear",
    pivot: [-0.12, ICE_WING_BREAK, 0.17],
    centre: [-0.12, 0.87, 0.17],
    start: 0.04,
    thin: 0.12,
    detach: 0.14,
    fall: 0.06,
    gone: [0.24, 0.48],
    land: [-0.66, 0.035, 0.2],
    turn: [[0, 0, 1], 1.25, [1, 0, 0], 0.35],
  },
  {
    name: "tipFar",
    on: "wingFar",
    pivot: [-0.12, ICE_WING_BREAK, -0.17],
    centre: [-0.12, 0.87, -0.17],
    start: 0.06,
    thin: 0.12,
    detach: 0.2,
    fall: 0.06,
    gone: [0.3, 0.54],
    land: [-0.62, 0.035, -0.22],
    turn: [[0, 0, 1], 1.35, [1, 0, 0], -0.35],
  },
  {
    name: "head",
    on: "neckHi",
    pivot: [0.4, 1.16, 0],
    centre: [0.47, 1.16, 0],
    start: 0.12,
    thin: 0.1,
    detach: 0.27,
    fall: 0.07,
    gone: [0.36, 0.6],
    land: [0.66, 0.05, -0.1],
    turn: [[0, 0, 1], -1.7, [0, 1, 0], 0.6],
  },
  {
    name: "neckHi",
    on: "neckLo",
    pivot: [0.4, ICE_NECK_BREAK, 0],
    centre: [0.36, 0.99, 0],
    start: 0.14,
    thin: 0.2,
    detach: 0.38,
    fall: 0.09,
    gone: [0.5, 0.74],
    land: [0.72, 0.04, 0.2],
    turn: [[0, 1, 0], -1.1, [0, 0, 1], -1.5],
  },
];
for (const pc of ICE_PIECES) if (pc.gone) pc.end = pc.gone[1];
const ICE_Q0 = [0, 0, 0, 1];
// Where each drop of meltwater beads: [piece, point]. The beak's tip, the
// head's chin, the wing tips' lower edges, the tail's tip, the body's
// underside and the pedestal's top edges (null: it stays).
const ICE_DROPS = [
  ["beak", [0.63, 1.12, 0]],
  ["beak", [0.6, 1.125, 0.01]],
  ["head", [0.47, 1.11, 0.02]],
  ["head", [0.43, 1.12, -0.02]],
  ["tipNear", [-0.3, 0.82, 0.18]],
  ["tipNear", [-0.05, 0.83, 0.18]],
  ["tipNear", [-0.2, 0.84, 0.19]],
  ["tipFar", [-0.28, 0.82, -0.18]],
  ["tail", [-0.5, 0.64, 0]],
  ["tail", [-0.44, 0.55, 0.02]],
  ["neckHi", [0.3, 1.02, 0.03]],
  ["neckLo", [0.33, 0.62, 0.05]],
  ["wingNear", [0.05, 0.6, 0.2]],
  ["wingNear", [-0.2, 0.62, 0.2]],
  ["body", [0.1, 0.32, 0.18]],
  ["body", [-0.2, 0.33, 0.17]],
  ["body", [0.25, 0.34, 0.12]],
  [null, [0.49, 0.3, 0.3]],
  [null, [0.2, 0.3, 0.31]],
  [null, [-0.15, 0.3, 0.31]],
  [null, [-0.45, 0.3, 0.3]],
  [null, [0.5, 0.3, 0.05]],
  [null, [-0.5, 0.3, -0.1]],
  [null, [0.5, 0.3, -0.2]],
  ["beak", [0.62, 1.115, -0.01]],
  ["tipNear", [-0.33, 0.85, 0.17]],
  ["head", [0.5, 1.12, 0.0]],
  ["body", [-0.3, 0.36, 0.14]],
  [null, [0.35, 0.3, 0.31]],
  [null, [-0.3, 0.3, 0.31]],
];
// Where the attached pieces are at melt level L: each melts (gets smaller)
// about its pivot and rides on the piece it grows from ("on"), which
// shrinks about its own pivot, so nothing is left hanging in the air.
// Returns, per piece, a map of points and its total scale.
function iceAttached(L) {
  const at = {};
  const byName = Object.fromEntries(ICE_PIECES.map((pc) => [pc.name, pc]));
  const get = (name) => {
    if (at[name]) return at[name];
    const pc = byName[name];
    const own = pc.detach
      ? 1 - pc.thin * band(L, pc.start, pc.detach)
      : 1 - (1 - (pc.min ?? 0)) * ease(band(L, pc.start, pc.end));
    const up = pc.on ? get(pc.on) : { map: (x) => x, scale: 1 };
    const pv = up.map(pc.pivot);
    const scale = own * up.scale;
    return (at[name] = { map: (x) => add(pv, mul(sub(x, pc.pivot), scale)), scale });
  };
  for (const pc of ICE_PIECES) get(pc.name);
  return at;
}
// Every piece's pose at melt level L. A piece that breaks off falls from
// where it was when it cracked off. `regrow(pc)`: it has melted away and
// the swan is freezing again, so it grows back in place instead of rising
// from where it fell.
function icePose(L, regrow) {
  const now = iceAttached(L);
  const pose = {};
  for (const pc of ICE_PIECES) {
    if (!pc.detach || L < pc.detach || regrow(pc)) {
      // In place: a scale about the pivot plus the ride on its parent.
      let { map, scale } = now[pc.name];
      if (pc.detach && regrow(pc)) {
        const up = pc.on ? now[pc.on] : { map: (x) => x, scale: 1 };
        scale = (1 - ease(band(L, pc.start, pc.end))) * up.scale;
        const pv = up.map(pc.pivot);
        map = (x) => add(pv, mul(sub(x, pc.pivot), scale));
      }
      pose[pc.name] = {
        scale,
        visible: scale > 0.004 ? 1 : 0,
        offset: sub(map(pc.pivot), pc.pivot),
        attached: true,
      };
      continue;
    }
    const then = iceAttached(pc.detach)[pc.name];
    const c0 = then.map(pc.centre);
    const qLand = quatMul(
      quatAxisAngle(pc.turn[2], pc.turn[3]),
      quatAxisAngle(pc.turn[0], pc.turn[1]),
    );
    const f = band(L, pc.detach, pc.detach + pc.fall);
    const sc = then.scale * (1 - ease(band(L, pc.gone[0], pc.gone[1])));
    const q = slerpQ(ICE_Q0, qLand, ease(f));
    // The centre falls (faster and faster) and drifts to where it lands,
    // then the piece melts away about its centre, lying in the water.
    const landY = pc.land[1] * Math.max(0.3, sc);
    const at = [
      c0[0] + (pc.land[0] - c0[0]) * easeOut(f),
      c0[1] + (landY - c0[1]) * f * f,
      c0[2] + (pc.land[2] - c0[2]) * easeOut(f),
    ];
    const offset = sub(sub(at, pc.pivot), mul(quatRotate(q, sub(pc.centre, pc.pivot)), sc));
    pose[pc.name] = { scale: sc, visible: sc > 0.004 ? 1 : 0, offset, quat: q, attached: false };
  }
  return pose;
}

// A small seeded generator for tables that build() and drive() share.
function lcg(seed) {
  let x = seed >>> 0;
  return () => {
    x = (Math.imul(x, 1664525) + 1013904223) >>> 0;
    return x / 4294967296;
  };
}

// Tornado: the funnel's shape, its bands (parts that widen on a tap) and
// the debris lying on the field in front of it, which a tap lifts, whirls
// round the funnel and flings back down where it lay.
const TW_H = 1.9;
const TW_SECS = 5.4;
const twRad = (y) => 0.05 + 0.5 * Math.pow(y / TW_H, 1.7) + 0.02 * Math.sin(y * 7);
const TW_BANDS = 5;
// How much wider each band gets (the foot most, like a wedge tornado).
const TW_GROW = [1.75, 1.6, 1.45, 1.3, 1.04];
const twBand = (y) => Math.max(0, Math.min(TW_BANDS - 1, Math.floor((y / TW_H) * TW_BANDS)));
// The default camera's heading (yaw 0.45), for which debris is in front.
const TW_CAM = [Math.sin(0.45), 0, Math.cos(0.45)];
const TW_RIGHT = [Math.cos(0.45), 0, -Math.sin(0.45)];
const TW_DEBRIS = (() => {
  const r = lcg(41);
  const out = [];
  for (let i = 0; i < 20; i++) {
    const a = 0.45 + (i / 19 - 0.5) * 2.7 + (r() - 0.5) * 0.12;
    const r0 = 0.42 + 0.43 * r();
    const type = i % 5 === 0 || i % 5 === 3 ? "plank" : i % 5 === 1 ? "clod" : "leaf";
    const lag = 0.12 + 0.55 * ((r0 - 0.42) / 0.43) + 0.15 * r();
    out.push({
      a,
      r0,
      type,
      h: type === "plank" ? 0.009 : type === "clod" ? 0.02 : 0.004,
      lag,
      dur: 3.7 + 0.5 * r(),
      top: 0.45 + 1.0 * r(),
      turns: 2 + (r() < 0.4 ? 1 : 0),
      yaw: r() * 360,
      axis: unit([r() - 0.5, r() - 0.5, r() - 0.5]),
      spin: (r() < 0.5 ? -1 : 1) * (2 + Math.floor(3 * r())),
      tone: r(),
    });
  }
  return out;
})();
// Where debris piece d is, s seconds after the tap: [position, u].
function twDebrisAt(d, s, lift) {
  const u = band(s, d.lag, d.lag + d.dur);
  const up = 0.55;
  const y =
    u < up ? d.top * ease(u / up) : d.top * (1 - ((u - up) / (1 - up)) * ((u - up) / (1 - up)));
  const hug = ease(band(u, 0, 0.3)) * (1 - ease(band(u, 0.62, 1)));
  const rIn = twRad(Math.min(TW_H, y)) * (1 + 0.55 * lift) + 0.1;
  const rr = d.r0 + (rIn - d.r0) * hug;
  const a = d.a + TAU * d.turns * ease(u);
  return [[Math.sin(a) * rr, d.h + y, Math.cos(a) * rr], u];
}
// Rainbow: seven bands, red outside. A tap wipes it away (violet first,
// right to left) and draws it again, red first, each colour from left to
// right (a fade on channel 0: the undrawing run backwards). at() is where
// a splat of band i at angle a (0 at the right foot, PI at the left) sits
// along the channel.
const RB_R = 0.82;
const RB_W = 0.2;
const RB_SECS = 5.2;
const RB_COLS = ["#e8302a", "#f58a1f", "#f7d51d", "#4cb748", "#2a8fd8", "#4a4aa8", "#8a3aa0"];
const rbAt = (i, a) => (6 - i + clamp01(a / Math.PI)) / 7;
// The radius of band i's middle.
const rbRadius = (i) => RB_R + (0.5 - (i + 0.5) / 7) * 2 * RB_W;
// The channel over time: wiped by 0.55 s, drawn again from 0.8 s to 3.6 s.
const rbChannel = (s) => (s === null ? 0 : s < 0.7 ? 1.02 * band(s, 0, 0.55) : 1.02 * (1 - band(s, 0.8, 3.6))); // prettier-ignore

// Iceberg: a chunk calves off its front-right shoulder (a cap cut by a
// plane), tips over to the right, falls into the sea with a splash, bobs
// and drifts, melts away, and grows back in place on the berg.
const IB_SECS = 6.4;
const IB_CAM = [Math.sin(0.45), 0, Math.cos(0.45)];
const IB_RIGHT = [Math.cos(0.45), 0, -Math.sin(0.45)];
const IB_OUT = unit(add(mul(IB_RIGHT, 0.75), mul(IB_CAM, 0.66)));
// The chunk is a slab off the side: outside a steep cut (normal IB_N) and
// above a level break at IB_FLOOR, clear of the sea. It tips about the
// view direction (clockwise as seen from the default camera, so the draw
// order holds) and floats at IB_FLOAT.
const IB_N = unit(add(mul(IB_OUT, 0.93), [0, 0.37, 0]));
const IB_FLOOR = 0.2;
const IB_AXIS = mul(IB_CAM, -1);
const IB_FLOAT = 0.02;
const IB_G = 6;

// The chunk's geometry for a berg of radius function shapeR: the cut
// (dot(p, IB_N) > h), the chunk's centre, a point on its broken face, the
// hinge it tips over, and its fall worked out ahead (the time it hits the
// water and how it is moving then).
function icebergChunk(shapeR) {
  const dirs = [];
  const n = 3000;
  for (let i = 0; i < n; i++) {
    const y = 1 - (2 * (i + 0.5)) / n;
    const r = Math.sqrt(1 - y * y);
    const a = i * 2.399963;
    dirs.push([Math.cos(a) * r, y, Math.sin(a) * r]);
  }
  const pts = dirs.map((d) => mul(d, shapeR(d))).filter((p) => p[1] > IB_FLOOR);
  let hmax = -Infinity;
  for (const p of pts) hmax = Math.max(hmax, dot(p, IB_N));
  const h = hmax - 0.27;
  const cap = pts.filter((p) => dot(p, IB_N) > h);
  const mean = (list) => mul(list.reduce(add, [0, 0, 0]), 1 / Math.max(1, list.length));
  // The broken face's middle (the chunk's outside, pressed onto the cut),
  // and the chunk's centre (between that and its outer surface).
  const F = mean(cap.map((p) => sub(p, mul(IB_N, dot(p, IB_N) - h))));
  const C0 = add(mul(mean(cap), 0.65), mul(F, 0.35));
  // It tips over its outer bottom edge, on the right.
  let hinge = F;
  let best = -Infinity;
  for (const p of cap) {
    const v = dot(p, IB_RIGHT) - 3 * p[1];
    if (v > best) [best, hinge] = [v, p];
  }
  // Tipping (0..T1, speeding up), then falling free, still turning.
  const T1 = 0.55;
  const th1 = 0.62;
  const w1 = (2 * th1) / T1;
  const C1 = add(hinge, quatRotate(quatAxisAngle(IB_AXIS, th1), sub(C0, hinge)));
  const V1 = add(mul(cross(IB_AXIS, sub(C1, hinge)), w1), mul(IB_RIGHT, 0.02));
  const tau = (V1[1] + Math.sqrt(V1[1] * V1[1] + 2 * IB_G * Math.max(0, C1[1] - IB_FLOAT))) / IB_G;
  return { h, F, C0, hinge, T1, th1, w1, C1, V1, Ti: T1 + tau };
}

// Where the chunk is at s seconds: { C, th, k } (its centre, how far it has
// turned about IB_AXIS, and its size), or { regrow } while it grows back.
function icebergPose(ch, s) {
  const { T1, th1, w1, C1, V1, Ti, hinge, C0 } = ch;
  if (s < T1) {
    const th = th1 * (s / T1) * (s / T1);
    return { C: add(hinge, quatRotate(quatAxisAngle(IB_AXIS, th), sub(C0, hinge))), th, k: 1 };
  }
  if (s < Ti) {
    const u = s - T1;
    return { C: add(add(C1, mul(V1, u)), [0, -0.5 * IB_G * u * u, 0]), th: th1 + w1 * u, k: 1 };
  }
  if (s > 4.7) return { regrow: ease(band(s, 4.75, 6.1)) };
  // Afloat: it plunges, bobs up, rocks, drifts on and melts away.
  const u = s - Ti;
  const Ci = add(add(C1, mul(V1, Ti - T1)), [0, -0.5 * IB_G * (Ti - T1) * (Ti - T1), 0]);
  const glide = 0.08 * (1 - Math.exp(-u / 0.3)) + 0.015 * u;
  const melt = band(s, 3.3, 4.6);
  const bob = -0.07 * Math.exp(-u / 0.6) * Math.sin((TAU * u) / 1.05);
  const C = add(add(Ci, mul(IB_RIGHT, glide * Math.hypot(V1[0], V1[2]))), [0, bob - Ci[1] + IB_FLOAT - 0.06 * melt, 0]); // prettier-ignore
  const thi = th1 + w1 * (Ti - T1);
  const th = thi + 0.25 * (1 - Math.exp(-u / 0.3)) + 0.12 * Math.exp(-u / 0.7) * Math.sin((TAU * u) / 0.9); // prettier-ignore
  return { C, th, k: 1 - ease(melt) };
}

// Debris is built this far towards the default camera and moved back to
// where it lies, so it sorts in front of the funnel's dust (it is hidden
// while it passes behind the funnel instead).
const TW_AHEAD = mul(TW_CAM, 0.42);
// The heat-up's glow, added over the wax: hot orange, magenta, gold, orange.
const LAVA_GLOW = [
  [0.75, 0.16, 0],
  [0.45, 0, 1],
  [0.35, 0, 1],
  [0.35, 0.45, 0],
  [0.75, 0.18, 0],
];

// Waterfall: the cliff's height, where the river runs over the lip, and
// the falling curtain (u across, v down). A tap sends a surge down: a
// white-water front runs along the river, over the lip and down the
// curtain; the curtain swells wider and thicker, foam spreads over the
// pool and a cloud of mist billows up; then it calms.
const WF_TOP = 1.25;
const WF_LIP = 0.28;
const WF_SECS = 5.2;
const wfFall = (u, v) => [
  (u - 0.5) * 0.6 * (1 + 0.25 * v),
  WF_TOP - v * (WF_TOP - 0.06),
  WF_LIP + 0.2 * Math.sin(Math.min(1, v * 2) * Math.PI * 0.5) - 0.02 * v,
];
// The surge's curtain: wider, thrown further out and thicker (e from -1
// at its back to 1 at its front).
const wfSurge = (u, v, e) => {
  const p = wfFall(u, v);
  const out = 0.07 * Math.sin(Math.min(1, v * 1.6) * Math.PI * 0.5);
  return [p[0] * (1.2 + 0.3 * v), p[1], p[2] + out + e * (0.012 + 0.05 * v)];
};
// When the surge's front reaches a place (seconds after the tap): along
// the river at a steady run, then down the curtain speeding up, then out
// over the pool. The front's channel is the time over WF_FRONT.
const WF_FRONT = 2;
// When it goes over the lip.
const WF_OVER = 0.28;
const wfRiver = (z) => WF_OVER * clamp01((z + 0.34) / (WF_LIP + 0.34));
const wfDrop = (v) => {
  const h = v * (WF_TOP - 0.06);
  return WF_OVER + (-1.2 + Math.sqrt(1.44 + 7 * h)) / 3.5;
};
// How far down the curtain the front is at s seconds (0 at the lip, 1 at
// the foot): wfDrop turned round.
const wfDown = (s) => {
  const t = (s - WF_OVER) * 3.5 + 1.2;
  return s <= WF_OVER ? 0 : Math.min(1, (t * t - 1.44) / 7 / (WF_TOP - 0.06));
};

// Ocean wave: the face's profile (x across, y up), from the sea in front up
// the concave face, over the crest and curling down into a barrel. A tap
// throws the lip forward (a morph towards OW_THROWN, the same profile with
// its lip flung out and down to the water in front), it crashes, turns to
// white water and falls flat, spray bursts up, foam spreads, and the lip
// curls over again from the crest.
const OW_Z0 = -0.85;
const OW_Z1 = 0.85;
const OW_SECS = 5.4;
const OW_HIT = 0.72;
const OW_PTS = [
  [1.05, 0],
  [0.62, 0.015],
  [0.34, 0.1],
  [0.16, 0.32],
  [0.1, 0.58],
  [0.18, 0.82],
  [0.36, 0.97],
  [0.58, 0.96],
  [0.76, 0.84],
  [0.84, 0.64],
  [0.8, 0.48],
  [0.7, 0.42],
];
const OW_FACE = baked(spline(OW_PTS));
const OW_THROWN = baked(
  spline([
    ...OW_PTS.slice(0, 7),
    [0.63, 0.99],
    [0.88, 0.9],
    [1.05, 0.66],
    [1.13, 0.36],
    [1.16, 0.05],
  ]),
);
// Where the lip starts (the face runs a little past it, so they overlap)
// and how much of the throw each place along the profile takes.
const OW_LIP = 0.62;
const owThrow = (s) => smoothstep(OW_LIP, 0.74, s);
// The wave peels along z: tall and hollow at the front (towards the
// viewer), fading into the sea behind.
const owGrow = (z) => smoothstep(OW_Z0, OW_Z0 + 0.9, z);
function owAt(curve, s, v) {
  const z = OW_Z0 + (OW_Z1 - OW_Z0) * v;
  const g = owGrow(z);
  const p = curve(s);
  // Behind, the lip has not formed yet: pull it back towards the crest.
  const x = p[0] * (0.55 + 0.45 * g) + 0.2 * (1 - g);
  return [x, p[1] * (0.2 + 0.8 * g), z];
}
// The lip thrown out: its place at s, v once it has landed.
function owThrown(s, v) {
  const a = owAt(OW_FACE, s, v);
  return lerp3(a, owAt(OW_THROWN, s, v), owThrow(s));
}
// Spray: clumps of drops (tokens) thrown up from along the line where the
// lip lands, each on its own path, falling back into the foam.
const OW_G = 5.5;
const OW_SPRAY = (() => {
  const r = lcg(77);
  const out = [];
  for (let i = 0; i < 44; i++) {
    const v = 0.3 + 0.68 * ((i + r()) / 44);
    const g = owGrow(OW_Z0 + (OW_Z1 - OW_Z0) * v);
    const base = add(owThrown(1, v), [0.02 - 0.12 * r(), 0.04, 0]);
    const vy = (1.7 + 1.5 * r()) * (0.4 + 0.6 * g);
    out.push({
      base,
      at: OW_HIT - 0.02 + 0.12 * r(),
      vel: [(0.55 * r() - 0.35) * g, vy, 0.5 * (r() - 0.5)],
      dur: (2 * vy) / OW_G,
      axis: unit([r() - 0.5, r() - 0.5, r() - 0.5]),
      spin: 4 + 6 * r(),
      size: 0.035 + 0.035 * r(),
    });
  }
  return out;
})();

export const RECIPES = {
  campfire: {
    alive: true,
    controls: [
      { key: "size", label: "Fire size", type: "slider", default: 0.55 },
      { key: "stoke", label: "Stoke", type: "pulse", ease: 1.6 },
    ],
    action: { key: "stoke", label: "Stoke the fire" },
    drive(t, c, out) {
      out.amount = 0.45 + 0.9 * c.size + 0.7 * c.stoke;
    },
    build(k) {
      const ground = -0.55;
      // A ring of stones.
      const stones = 11;
      for (let i = 0; i < stones; i++) {
        const a = (i / stones) * Math.PI * 2 + k.rand() * 0.2;
        const r = 0.78 + k.rand() * 0.06;
        const s = 0.12 + k.rand() * 0.06;
        const grey = 0.42 + k.rand() * 0.22;
        k.add(k.ellipsoid(s * 1.3, s * 0.8, s), {
          pos: [Math.sin(a) * r, ground + s * 0.5, Math.cos(a) * r],
          rot: [0, (a * 180) / Math.PI + k.rand() * 40, 0],
          flat: 0.3,
          color: (c) => {
            const n = c.fbm(c.p[0] * 9, c.p[1] * 9, c.p[2] * 9);
            return mix([grey, grey * 0.97, grey * 0.92], "#2c2a27", 0.35 + 0.35 * n);
          },
        });
      }
      // Logs leaning together.
      const logs = 5;
      for (let i = 0; i < logs; i++) {
        const a = (i / logs) * Math.PI * 2 + 0.3;
        const lean = 38 + k.rand() * 8;
        const len = 0.95;
        const base = [Math.sin(a) * 0.46, ground + 0.08, Math.cos(a) * 0.46];
        // A cylinder along Y, tipped towards the centre.
        k.add(k.cylinder(0.075, len), {
          pos: [
            base[0] * 0.55,
            base[1] + (Math.cos((lean * Math.PI) / 180) * len) / 2,
            base[2] * 0.55,
          ],
          rot: [lean * Math.cos(a) * -1, 0, lean * Math.sin(a)],
          flat: 0.25,
          color: (c) => {
            const char = Math.max(0, Math.min(1, (c.p[1] - ground - 0.12) / 0.45));
            const bark = mix(
              "#6b4526",
              "#3a2413",
              0.5 + 0.5 * c.fbm(c.p[0] * 14, c.p[1] * 14, c.p[2] * 14),
            );
            return mix(bark, "#1a1512", char * 0.85);
          },
        });
      }
      // A bed of embers that glows and flickers.
      k.add(k.disc(0.42), {
        pos: [0, ground + 0.03, 0],
        flat: 0.4,
        kind: "twinkle",
        params: (c) => [0.35, c.rand() * 6.28],
        pattern: false,
        color: (c) =>
          mix(
            "#ff6a1a",
            "#7a1a08",
            Math.min(1, Math.hypot(c.p[0], c.p[2]) / 0.42 + 0.3 * c.rand()),
          ),
      });
      // Flames: splats born at the base that rise, shrink and redden.
      k.cloud({ share: 0.3, size: 1.25, pattern: false }, (rand) => {
        const a = rand() * Math.PI * 2;
        const r = 0.3 * Math.sqrt(rand());
        const hot = 1 - r / 0.3;
        return {
          p: [Math.sin(a) * r, ground + 0.12 + rand() * 0.1, Math.cos(a) * r],
          color: mix("#ffb347", "#fff4c2", hot * 0.9),
          size: 0.8 + 0.8 * hot,
          opacity: 0.8,
          kind: "flame",
          params: [0.55 + 0.6 * hot * rand(), rand()],
        };
      });
      // Sparks drifting up.
      k.cloud({ share: 0.015, size: 0.45, pattern: false }, (rand) => ({
        p: [(rand() - 0.5) * 0.4, ground + 0.2, (rand() - 0.5) * 0.4],
        color: "#ffc062",
        opacity: 1,
        kind: "rise",
        params: [1.5 + rand(), rand()],
      }));
      // A thin wisp of smoke.
      k.cloud({ share: 0.008, size: 2.2, pattern: false }, (rand) => ({
        p: [(rand() - 0.5) * 0.2, ground + 0.7, (rand() - 0.5) * 0.2],
        color: shade("#8a8580", 0.9 + rand() * 0.2),
        opacity: 0.1,
        kind: "rise",
        params: [1.2, rand()],
      }));
      // Room for the flames at their tallest.
      k.reach([0, ground + 1.35, 0]);
    },
  },

  "storm-cloud": {
    alive: true,
    controls: [
      { key: "rain", label: "Rain", type: "slider", default: 0.7 },
      { key: "thunder", label: "Thunder", type: "pulse", ease: 1.3 },
    ],
    action: { key: "thunder", label: "Thunder" },
    drive(t, c, out) {
      // Lightning on a random-looking schedule: each slot of time may
      // strike one of three bolts, with a quick double flash.
      const slot = Math.floor(t / 1.7);
      const f = t / 1.7 - slot;
      const which = slot === 0 ? 0 : Math.floor(hash1(slot) * 5);
      const on = which < 3 && (f < 0.07 || (f > 0.11 && f < 0.16));
      const big = c.thunder > 0.3 && Math.sin(c.thunder * 36) > -0.4;
      for (let b = 0; b < 3; b++) out.parts[`bolt${b}`] = { visible: on && which === b ? 1 : 0 };
      out.parts.bolt3 = { visible: big ? 1 : 0 };
      out.parts.flash = { visible: on || big ? 1 : 0 };
      out.parts.rain = { visible: 0.15 + 0.85 * c.rain };
      out.amount = 1;
    },
    build(k) {
      const rand = k.rand;
      // The cloud: overlapping soft puffs, lit on top and dark underneath.
      const puffs = [];
      for (let i = 0; i < 26; i++) {
        const a = rand() * TAU;
        const rr = Math.sqrt(rand());
        const x = Math.cos(a) * rr * 0.95;
        const z = Math.sin(a) * rr * 0.55;
        const top = 1 - rr * rr;
        const s = 0.26 + 0.18 * rand() + 0.12 * top;
        puffs.push({ c: [x, 0.1 + top * 0.35 * rand() + s * 0.4, z], s });
      }
      for (let i = 0; i < 9; i++) {
        const x = (i / 8 - 0.5) * 1.8;
        puffs.push({ c: [x, 0.05, (rand() - 0.5) * 0.4], s: 0.28 + 0.06 * rand() });
      }
      const ymin = -0.2;
      const ymax = 1.0;
      for (const pf of puffs) {
        k.add(k.sphere(pf.s), {
          pos: pf.c,
          scale: [1, 0.82, 1],
          size: 2.2,
          flat: 0.9,
          opacity: 0.82,
          jitter: 0.03,
          color: (c) => {
            const h = clamp((c.p[1] - ymin) / (ymax - ymin), 0, 1);
            const l = dot(c.n, LIGHT);
            const v = clamp(
              0.25 + 0.55 * h + 0.25 * l + 0.1 * c.fbm(c.p[0] * 3, c.p[1] * 3, c.p[2] * 3),
              0,
              1,
            );
            return ramp(["#23262e", "#3c414c", "#5e6470", "#8e94a0", "#c4c8d0"], v);
          },
        });
      }
      // Flash: a bright veil over the cloud that lights up with a strike.
      const flash = k.part("flash", { pivot: [0, 0.2, 0] });
      k.cloud({ share: 0.05, size: 2.6, pattern: false }, (r) => {
        const pf = puffs[Math.floor(r() * puffs.length)];
        const d = randDir(r);
        return {
          p: add(pf.c, [d[0] * pf.s * 1.02, d[1] * pf.s * 0.84, d[2] * pf.s * 1.02]),
          color: mix("#dfe8ff", "#ffffff", r()),
          opacity: 0.22,
          part: flash,
        };
      });
      // Rain: streaks through the whole column, each falling a short way.
      const rain = k.part("rain", { pivot: [0, -0.6, 0] });
      k.cloud({ share: 0.08, size: 0.55, pattern: false }, (r) => {
        const a = r() * TAU;
        const rr = Math.sqrt(r());
        return {
          p: [Math.cos(a) * rr * 0.9, -1.35 + r() * 1.35, Math.sin(a) * rr * 0.42],
          dir: [0.08, -1, 0],
          stretch: 4.5,
          color: mix("#7a92b0", "#b4c4d8", r()),
          opacity: 0.45,
          kind: "fall",
          params: [0.35, r()],
          part: rain,
        };
      });
      // Lightning: jagged bolts with a blue glow, each its own part.
      const bolts = [
        { x: -0.3, z: 0.56, len: 1.45 },
        { x: 0.45, z: 0.5, len: 1.25 },
        { x: 0.05, z: 0.52, len: 1.35 },
        { x: 0.1, z: 0.6, len: 1.5 },
      ];
      bolts.forEach((b, i) => {
        const part = k.part(`bolt${i}`, { pivot: [b.x, -0.1, b.z] });
        const main = jagged(
          rand,
          [b.x, -0.05, b.z],
          [b.x + (rand() - 0.5) * 0.5, -0.05 - b.len, b.z + (rand() - 0.5) * 0.2],
          5,
        );
        const paths = [main];
        // A fork or two branching off.
        for (let f = 0; f < 2; f++) {
          const at = main[2 + f * 2 + Math.floor(rand() * 2)];
          const dx = (rand() < 0.5 ? -1 : 1) * (0.2 + 0.2 * rand());
          paths.push(jagged(rand, at, add(at, [dx, -0.3 - 0.2 * rand(), (rand() - 0.5) * 0.2]), 3));
        }
        paths.forEach((pts, pi) => {
          const w = (pi === 0 ? 0.026 : 0.014) * (i === 3 ? 1.35 : 1);
          k.add(
            k.tube(polyline(pts), (t) => w * (1 - 0.5 * t), { samples: 64, grid: 8 }),
            {
              part,
              weight: 8,
              flat: 0.6,
              pattern: false,
              color: (c) => mix("#fff2a8", "#ffffff", c.rand() * 0.6),
            },
          );
        });
        k.cloud({ share: 0.0015, size: 3, pattern: false }, (r) => {
          const pts = paths[r() < 0.75 ? 0 : 1 + Math.floor(r() * (paths.length - 1))];
          const p = polyline(pts)(r());
          return {
            p: add(p, [(r() - 0.5) * 0.12, (r() - 0.5) * 0.12, (r() - 0.5) * 0.12]),
            color: "#fff0a0",
            opacity: 0.12,
            part,
          };
        });
      });
    },
  },

  "lava-lamp": {
    alive: true,
    options: [
      {
        key: "set",
        label: "Colour set",
        type: "select",
        default: "own",
        choices: Object.entries(LAVA_SETS).map(([id, v]) => ({ id, label: v.label })),
      },
      { key: "wax", label: "Wax", type: "color", default: "#e8341c" },
      { key: "liquid", label: "Liquid", type: "color", default: "#f2b632" },
      { key: "metal", label: "Base", type: "color", default: "#b8bcc4" },
      { key: "blobs", label: "Blobs", type: "slider", min: 2, max: 12, step: 1, default: 6 },
      {
        key: "size",
        label: "Blob size",
        type: "slider",
        min: 0.5,
        max: 1.5,
        step: 0.1,
        default: 1,
      },
      {
        key: "shape",
        label: "Blob shape",
        type: "select",
        default: "mixed",
        choices: [
          { id: "mixed", label: "Mixed" },
          { id: "round", label: "Round" },
          { id: "tall", label: "Tall" },
        ],
      },
    ],
    controls: [
      { key: "heat", label: "Heat up", type: "pulse", ease: LAVA_SECS },
      { key: "flow", label: "Flow", type: "slider", default: 0.5 },
      { key: "glow", label: "Glow", type: "slider", default: 0 },
    ],
    action: { key: "heat", label: "Heat it up" },
    // A tap heats the lamp: the blobs run about three and a half times as
    // fast for a few seconds, the wax glows and shifts through its colour
    // set's glow (orange, magenta, gold for the classic lamp), and the
    // liquid brightens; then it all eases back. The extra speed is an extra
    // clock (the boost's integral), kept when the effect ends so the blobs
    // never jump. Flow sets how fast the blobs drift (a quarter as fast to
    // one and three quarters, through the same kind of clock), and Glow
    // lights the wax and the liquid from within at rest.
    drive(t, c, out, info) {
      const m = mem(c);
      const blobs = info?.data?.blobs || LAVA;
      const flow = 0.25 + 1.5 * (c.flow ?? 0.5);
      if (m.lastT === undefined) m.flowT = t;
      else if (t >= m.lastT) m.flowT += (t - m.lastT) * flow;
      m.lastT = t;
      const s = since(c.heat, LAVA_SECS);
      const extra = s === null ? 0 : boostClock(s, 2.5, 0.3, 2.7, 3.9);
      if (fired(m, "heat", c.heat)) m.base = (m.base ?? 0) + (m.run ?? 0);
      if (s !== null) m.run = extra;
      else if (m.run) {
        m.base = (m.base ?? 0) + m.run;
        m.run = 0;
      }
      const tt = m.flowT + (m.base ?? 0) + extra;
      blobs.forEach((b, i) => {
        const y = lavaY(b, tt);
        out.parts[`blob${i}`] = {
          offset: [Math.sin(tt * b.speed * 0.8 + b.phase) * 0.02, y - lavaY(b, 0), 0],
        };
      });
      const hot = s === null ? 0 : ease(band(s, 0, 0.3)) * (1 - ease(band(s, 3.1, 4.5)));
      const lit = clamp(c.glow ?? 0, 0, 1);
      const col = ramp(info?.data?.glow || LAVA_GLOW, band(s ?? 0, 0.2, 3.2));
      out.glow = [col[0], col[1], col[2], 0.75 * hot + 0.45 * lit * (1 - hot)];
      out.morph = [0, Math.max(hot, 0.7 * lit)];
    },
    build(k, o) {
      const set = LAVA_SETS[o.set] || LAVA_SETS.own;
      const wax = set.wax || o.wax;
      const liquid = set.liquid || o.liquid;
      const glassR = lavaGlassR;
      // The metal base and cap, with bright reflections.
      const chrome = (c) => {
        const n = c.n;
        const env = smoothstep(-0.3, 0.9, -0.6 * n[0] + 0.4 * n[1] + 0.3 * n[2]);
        const band = 0.5 + 0.5 * Math.sin(n[0] * 6 + n[2] * 3);
        return mix(shade(o.metal, 0.35), mix(o.metal, "#ffffff", 0.5), env * 0.8 + band * 0.2);
      };
      k.add(
        k.lathe([
          [0.36, -0.62],
          [0.37, -0.58],
          [0.33, -0.4],
          [0.26, -0.18],
          [0.215, -0.02],
          [0.2, 0.0],
        ]),
        { flat: 0.2, even: true, jitter: 0.015, color: chrome },
      );
      k.add(
        k.lathe([
          [0.14, 1.27],
          [0.135, 1.35],
          [0.1, 1.5],
          [0.085, 1.56],
          [0.0, 1.57],
        ]),
        { flat: 0.2, even: true, jitter: 0.015, color: chrome },
      );
      // Rolled metal collars where the glass sits in the base and under the
      // cap: a lip slightly proud of the glass, with a dark seam against it.
      const collar = (y0, y1, r) =>
        k.add(
          k.lathe([
            [r - 0.012, y0],
            [r + 0.006, y0 + 0.004],
            [r + 0.012, (y0 + y1) / 2],
            [r + 0.006, y1 - 0.004],
            [r - 0.012, y1],
          ]),
          {
            flat: 0.2,
            weight: 2,
            even: true,
            jitter: 0.015,
            color: (c) => {
              const edge = Math.min(c.lp[1] - y0, y1 - c.lp[1]);
              return edge < 0.005 ? shade(o.metal, 0.3) : chrome(c);
            },
          },
        );
      collar(-0.035, 0.03, glassR(0));
      collar(1.24, 1.3, glassR(1.27));
      // The glass: faint, tinted by the liquid, with a highlight streak.
      k.add(
        k.lathe(
          Array.from({ length: 9 }, (_, i) => {
            const y = -0.02 + (i / 8) * 1.32;
            return [glassR(y), y];
          }),
        ),
        {
          opacity: 0.13,
          flat: 0.3,
          even: true,
          jitter: 0.01,
          pattern: false,
          color: (c) => mix(liquid, "#ffffff", 0.2 + 0.3 * Math.max(0, c.n[2])),
        },
      );
      k.cloud({ share: 0.012, size: 1.2, pattern: false }, (r) => {
        const y = 0.05 + r() * 1.15;
        const a = -0.55 + (r() - 0.5) * 0.12;
        const rr = glassR(y) + 0.004;
        return {
          p: [Math.sin(a) * rr, y, Math.cos(a) * rr],
          color: "#ffffff",
          opacity: 0.35,
        };
      });
      // The liquid itself, a faint glow inside.
      k.cloud({ share: 0.03, size: 3, pattern: false }, (r) => {
        const y = r() * 1.28;
        const a = r() * TAU;
        const rr = glassR(y) * 0.85 * Math.sqrt(r());
        return {
          p: [Math.sin(a) * rr, y, Math.cos(a) * rr],
          color: mix(liquid, "#ffb070", 0.3 * (1 - y / 1.3)),
          opacity: 0.06,
        };
      });
      // More glow in the liquid while it is heated (fades in on channel 1).
      k.cloud({ share: 0.02, size: 3.4, pattern: false }, (r) => {
        const y = 0.02 + Math.pow(r(), 2.2) * 1.1;
        const a = r() * TAU;
        const rr = glassR(y) * 0.8 * Math.sqrt(r());
        return {
          p: [Math.sin(a) * rr, y, Math.cos(a) * rr],
          color: mix(liquid, "#fff4c8", 0.35 + 0.3 * (1 - y / 1.3)),
          opacity: 0.1,
          kind: "fade",
          channel: 1,
          params: [0, -0.99],
        };
      });
      // Wax: a pool at the bottom and blobs that rise and sink. The wax
      // takes the heat-up's glow (a band that sits on channel 0).
      const waxCol = (c) => {
        const facing = Math.max(0, dot(c.n, unit([0.3, 0.2, 1])));
        return mix(shade(wax, 0.75), mix(wax, "#ffe090", 0.6), facing * facing);
      };
      const waxy = {
        weight: 1.5,
        pattern: false,
        color: waxCol,
        kind: "band",
        channel: 0,
        params: [0, 0.5],
      };
      k.add(k.ellipsoid(0.22, 0.1, 0.22), { pos: [0, 0.04, 0], ...waxy });
      k.add(k.ellipsoid(0.1, 0.04, 0.1), { pos: [0, 1.25, 0], ...waxy });
      const blobs = lavaBlobs(o);
      blobs.forEach((b, i) => {
        const part = k.part(`blob${i}`, { pivot: [b.x, lavaY(b, 0), b.z] });
        k.add(k.ellipsoid(b.r, b.r * b.tall, b.r), {
          pos: [b.x, lavaY(b, 0), b.z],
          part,
          ...waxy,
        });
        if (b.twin) {
          k.add(k.ellipsoid(b.r * 0.6, b.r * 0.7, b.r * 0.6), {
            pos: [b.x + b.r * 0.5, lavaY(b, 0) - b.r * 1.1, b.z],
            part,
            ...waxy,
          });
        }
      });
      // The warm bulb glow at the foot of the glass.
      k.add(k.disc(0.16), {
        pos: [0, -0.005, 0],
        pattern: false,
        color: (c) => mix("#fff2c0", "#ffb040", Math.hypot(c.p[0], c.p[2]) / 0.16),
      });
      k.data = { blobs, glow: set.glow || LAVA_GLOW };
    },
  },

  "snow-globe": {
    alive: true,
    options: [{ key: "base", label: "Base", type: "color", default: "#8a2a1e" }],
    controls: [{ key: "shake", label: "Shake", type: "pulse", ease: 3.5 }],
    action: { key: "shake", label: "Shake the globe" },
    drive(t, c, out) {
      const s = c.shake;
      out.parts.swirl = {
        quat: quatAxisAngle([0, 1, 0], t * 2.4),
        offset: [0, 0.03 * Math.sin(t * 3), 0],
        visible: smoothstep(0, 0.25, s),
      };
      const wob = s * s * Math.sin(t * 22);
      out.body = { quat: quatAxisAngle([0, 0, 1], 0.1 * wob) };
    },
    build(k, o) {
      const rand = k.rand;
      const G = [0, 0.38, 0];
      const RG = 0.6;
      const floor = -0.1;
      // The base, with a gold band.
      k.add(
        k.lathe(
          [
            [0, -0.52],
            [0.6, -0.52],
            [0.64, -0.46],
            [0.6, -0.36],
            [0.52, -0.22],
            [0.47, -0.12],
            [0.45, -0.1],
          ],
          { thick: 0.2 },
        ),
        {
          flat: 0.2,
          interior: 0.06,
          core: shade(o.base, 0.6),
          color: (c) => {
            const y = c.p[1];
            if (y > -0.3 && y < -0.24)
              return lit(mix("#c8a040", "#f0d070", Math.max(0, c.n[2])), c.n, 0.4);
            const hi = Math.pow(Math.max(0, dot(c.n, unit([-0.3, 0.6, 0.75]))), 12);
            return mix(lit(o.base, c.n, 0.45), "#ffffff", 0.3 * hi);
          },
        },
      );
      // The snowy ground inside.
      k.add(
        k.lathe([
          [0.47, floor - 0.02],
          [0.46, floor + 0.02],
          [0.3, floor + 0.06],
          [0, floor + 0.08],
        ]),
        {
          flat: 0.3,
          color: (c) => lit(mix("#e6eef8", "#ffffff", c.rand() * 0.6), c.n, 0.25),
        },
      );
      // A snowy fir tree.
      const tx = -0.2;
      const tz = -0.12;
      k.add(k.cylinder(0.025, 0.1), { pos: [tx, floor + 0.1, tz], color: "#5a3a22" });
      for (let i = 0; i < 4; i++) {
        const y0 = floor + 0.12 + i * 0.1;
        const r0 = 0.17 - i * 0.035;
        k.add(k.cone(r0, 0.01, 0.16, { caps: "bottom" }), {
          pos: [tx, y0 + 0.08, tz],
          color: (c) => {
            if (c.s.cap) return "#1f4a2a";
            const snow = c.noise(c.p[0] * 40, c.p[1] * 40, c.p[2] * 40) > 0.1 - 0.3 * c.v;
            return snow
              ? mix("#eef4fb", "#ffffff", c.rand())
              : lit(mix("#1f5a30", "#2f7a3e", c.rand()), c.n, 0.4);
          },
        });
      }
      k.add(k.sphere(0.02), {
        pos: [tx, floor + 0.55, tz],
        weight: 3,
        pattern: false,
        color: "#ffd84a",
      });
      // A snowman with a hat, scarf and carrot nose.
      const sx = 0.16;
      const sz = 0.12;
      const snow = (c) => lit(mix("#f2f6fb", "#ffffff", c.rand() * 0.5), c.n, 0.3);
      k.add(k.sphere(0.1), { pos: [sx, floor + 0.15, sz], color: snow });
      k.add(k.sphere(0.075), { pos: [sx, floor + 0.3, sz], color: snow });
      k.add(k.sphere(0.055), { pos: [sx, floor + 0.42, sz], color: snow });
      k.add(k.cylinder(0.04, 0.06), { pos: [sx, floor + 0.5, sz], weight: 2, color: "#1a1a1e" });
      k.add(k.cylinder(0.06, 0.008), { pos: [sx, floor + 0.47, sz], weight: 2, color: "#1a1a1e" });
      k.add(k.torus(0.062, 0.016), {
        pos: [sx, floor + 0.36, sz],
        weight: 2,
        pattern: false,
        color: (c) => (Math.sin(c.u * TAU * 8) > 0 ? "#c8202a" : "#f2f2f2"),
      });
      k.add(k.cone(0.012, 0.001, 0.07), {
        pos: [sx + 0.02, floor + 0.43, sz + 0.075],
        rot: [90, 0, 0],
        weight: 3,
        pattern: false,
        color: "#f07a1a",
      });
      for (const [dx, dy] of [
        [-0.02, 0.445],
        [0.025, 0.445],
        [0.0, 0.32],
        [0.0, 0.29],
        [0.0, 0.2],
      ]) {
        k.add(k.sphere(0.009), {
          pos: [sx + dx, floor + dy, sz + (dy > 0.4 ? 0.05 : dy > 0.25 ? 0.074 : 0.098)],
          weight: 4,
          pattern: false,
          color: "#16161a",
        });
      }
      // Falling snow: each flake falls only as far as the ground under it.
      const inside = (r) => {
        for (;;) {
          const p = [(r() - 0.5) * 2 * RG, floor + r() * (RG + G[1] - floor), (r() - 0.5) * 2 * RG];
          if (Math.hypot(p[0] - G[0], p[1] - G[1], p[2] - G[2]) < RG * 0.93 && p[1] > floor + 0.08)
            return p;
        }
      };
      k.cloud({ share: 0.03, size: 0.5, pattern: false }, (r) => {
        const p = inside(r);
        return {
          p,
          color: "#ffffff",
          opacity: 0.95,
          kind: "fall",
          params: [Math.min(0.35, (p[1] - floor - 0.08) * 0.8), r()],
        };
      });
      // Snow swirling about after a shake.
      const swirl = k.part("swirl", { pivot: G });
      k.cloud({ share: 0.035, size: 0.55, pattern: false }, (r) => ({
        p: inside(r),
        color: "#ffffff",
        opacity: 0.95,
        kind: "twinkle",
        params: [0.4, r() * 6],
        part: swirl,
      }));
      // The glass dome, with a bright reflection.
      k.add(k.sphere(RG), {
        pos: G,
        opacity: 0.16,
        flat: 0.3,
        pattern: false,
        color: (c) =>
          c.p[1] < -0.11 ? null : mix("#dff0ff", "#ffffff", Math.max(0, dot(c.n, LIGHT))),
      });
      k.cloud({ share: 0.01, size: 1.2, pattern: false }, (r) => {
        const a = 0.9 + r() * 0.8;
        const b = -0.55 + (r() - 0.5) * 0.25;
        const d = [Math.sin(b) * Math.sin(a), Math.cos(a), Math.cos(b) * Math.sin(a)];
        return { p: add(G, mul(d, RG * 1.005)), color: "#ffffff", opacity: 0.5 };
      });
    },
  },

  volcano: {
    alive: true,
    controls: [{ key: "erupt", label: "Erupt", type: "pulse", ease: 4 }],
    action: { key: "erupt", label: "Erupt" },
    drive(t, c, out) {
      out.amount = 0.55 + 1.6 * c.erupt;
      out.parts.burst = { visible: smoothstep(0, 0.2, c.erupt) };
    },
    build(k) {
      const rand = k.rand;
      const RIM = 0.9;
      const cone = k.lathe(
        [
          [1.02, 0],
          [0.95, 0.05],
          [0.78, 0.18],
          [0.56, 0.4],
          [0.4, 0.62],
          [0.28, RIM - 0.06],
          [0.24, RIM],
          [0.2, RIM - 0.02],
          [0.14, RIM - 0.1],
          [0, RIM - 0.12],
        ],
        { grid: 96, thick: 0.12 },
      );
      k.add(cone, {
        flat: 0.25,
        interior: 0.1,
        core: "#7a2a10",
        color: (c) => {
          const y = c.p[1];
          const a = Math.atan2(c.p[0], c.p[2]);
          const g = c.fbm(c.p[0] * 4, c.p[1] * 4, c.p[2] * 4);
          // Lava rivers running down from the rim.
          const river =
            Math.abs(Math.sin(a * 2.5 + g * 2.2 + 0.4)) < 0.1 * (0.4 + y) &&
            y > 0.08 &&
            y < RIM - 0.05;
          if (river) return keep(mix("#ff4a0a", "#ffc040", c.rand() * 0.6));
          const crater = Math.hypot(c.p[0], c.p[2]) < 0.21 && y > RIM - 0.15;
          if (crater) return keep(mix("#ff6a10", "#ffd060", c.rand()));
          let col = mix("#5a4a42", "#2a2220", smoothstep(0.1, 0.8, y) + 0.3 * g);
          if (y < 0.14)
            col = mix(
              col,
              mix("#4a6a2a", "#6a8a3a", c.rand()),
              smoothstep(0.14, 0.04, y + 0.03 * g),
            );
          const ridge = Math.abs(Math.sin(a * 11 + g * 5));
          col = shade(col, 0.85 + 0.25 * ridge);
          return lit(col, c.n, 0.45);
        },
      });
      // Lava bubbling in the crater, glowing.
      k.add(k.disc(0.15), {
        pos: [0, RIM - 0.105, 0],
        pattern: false,
        kind: "twinkle",
        params: (c) => [0.4, c.rand() * 6],
        color: (c) => mix("#fff0a0", "#ff5a10", Math.hypot(c.p[0], c.p[2]) / 0.15),
      });
      k.cloud({ share: 0.02, size: 3, pattern: false }, (r) => ({
        p: [(r() - 0.5) * 0.3, RIM + 0.05 + r() * 0.15, (r() - 0.5) * 0.3],
        color: "#ff8a30",
        opacity: 0.12,
        kind: "twinkle",
        params: [0.5, r() * 6],
      }));
      // Sparks and lava bombs flying up, and a plume of smoke.
      k.cloud({ share: 0.05, size: 0.6, pattern: false }, (r) => ({
        p: [(r() - 0.5) * 0.18, RIM - 0.05, (r() - 0.5) * 0.18],
        color: mix("#ffd060", "#ff5a10", r()),
        opacity: 1,
        kind: "rise",
        params: [0.6 + 0.6 * r(), r()],
      }));
      k.cloud({ share: 0.1, size: 3.2, pattern: false }, (r) => {
        const y = RIM + 0.15 + r() * 0.3;
        return {
          p: [(r() - 0.5) * 0.2, y, (r() - 0.5) * 0.2],
          color: shade(mix("#6a6460", "#2a2624", r()), 0.9 + 0.2 * r()),
          opacity: 0.28,
          kind: "rise",
          params: [0.9 + 0.5 * r(), r()],
        };
      });
      const burst = k.part("burst", { pivot: [0, RIM, 0] });
      k.cloud({ share: 0.04, size: 1.2, pattern: false }, (r) => ({
        p: [(r() - 0.5) * 0.2, RIM, (r() - 0.5) * 0.2],
        color: mix("#ffe070", "#ff3a08", r()),
        opacity: 1,
        kind: "rise",
        params: [0.8 + 0.8 * r(), r()],
        part: burst,
      }));
      // The sea around the island.
      k.add(k.disc(1.25, 1.0), {
        pos: [0, 0.01, 0],
        pattern: false,
        kind: "wave",
        params: [0.006, 0],
        color: (c) => {
          const r = Math.hypot(c.p[0], c.p[2]);
          if (c.n[1] < 0) return "#12324a";
          return r < 1.04 ? "#e8f4f8" : mix("#2a7fb0", "#1a5a8a", (r - 1) / 0.25);
        },
      });
      k.reach([0, RIM + 1.1, 0]);
    },
  },

  "ice-statue": {
    alive: true,
    controls: [
      { key: "temp", label: "Temperature", type: "slider", default: 0 },
      { key: "thaw", label: "Thaw", type: "pulse", ease: ICE_SECS },
    ],
    action: { key: "thaw", label: "Melt and refreeze" },
    // A tap melts the swan like real ice, faster and faster as it goes:
    // water beads and drips from the beak, the wings and the pedestal's
    // edges into a spreading puddle; the thin beak wears away first; the
    // wing tips crack off and fall into the water, then the head and the
    // top of the neck; the tail, the rest of the neck and the wings wear
    // away, and the body wears down to a lump, each piece solid ice getting
    // smaller (never squashing). The fallen pieces melt away in the puddle.
    // Then it refreezes, the pieces growing back from the body out in the
    // reverse order, the puddle drawing in, and a white band of frost
    // sweeps up it from the foot to the beak. Temperature melts it to the
    // same point and back (lowered after a piece has melted away on the
    // ground, the piece grows back in place). Frost specks drift about it
    // while it is cold.
    drive(t, c, out, info) {
      const m = mem(c);
      const s = since(c.thaw, ICE_SECS);
      const tap =
        s === null
          ? 0
          : ICE_TOP * Math.pow(band(s, 0.1, ICE_MELT), 1.6) * (1 - ease(band(s, ICE_MELT + 0.3, ICE_MELT + 1.6))); // prettier-ignore
      const e = Math.max(clamp(c.temp ?? 0, 0, 1), tap);
      if (e < 0.002) m.maxL = 0;
      else m.maxL = Math.max(m.maxL ?? 0, e);
      const cooling = e < (m.maxL ?? 0) - 0.004;
      const pieces = icePose(e, (pc) => cooling && (m.maxL ?? 0) >= pc.end);
      for (const [name, st] of Object.entries(pieces)) {
        const { attached, ...part } = st;
        out.parts[name] = part;
      }
      // Water: a puddle spreading out from under the pedestal, and drops
      // (tokens) that bead at the low points and fall while it melts, more
      // of them the more it has melted.
      const pool = smoothstep(0.01, 0.8, e);
      out.parts.puddle = { scale: 0.3 + 0.7 * pool, visible: pool > 0.002 ? 1 : 0 };
      const melting = e > 0.02 && !cooling;
      const drops = info?.data?.drops || [];
      out.tokens = drops.map((d, i) => {
        const pc = pieces[d.piece];
        const onIt = !pc || (pc.attached && (pc.scale ?? 1) > 0.25);
        if (!melting || !onIt || i / drops.length > 0.25 + 1.3 * e)
          return { base: d.p, visible: 0 };
        const u = (((t + d.phase * d.period) % d.period) + d.period) % d.period;
        const from = pc ? add(add(d.pv, pc.offset ?? [0, 0, 0]), mul(sub(d.p, d.pv), pc.scale ?? 1)) : d.p; // prettier-ignore
        if (u < ICE_HANG) {
          // Beading up at the edge.
          return { base: d.p, offset: sub(from, d.p), visible: 0.35 + 0.65 * (u / ICE_HANG) };
        }
        const f = u - ICE_HANG;
        const drop = 0.5 * ICE_G * f * f;
        if (drop > from[1] - d.to) return { base: d.p, visible: 0 };
        return { base: d.p, offset: [from[0] - d.p[0], from[1] - drop - d.p[1], from[2] - d.p[2]] };
      });
      out.parts.frost = { visible: 1 - smoothstep(0, 0.3, e) };
      // The frost front: the coat shows (coloured as the ice) just before
      // it and the band of light runs up it on channel 0.
      const F = ICE_MELT + 1.5;
      const front = s === null ? 0 : bump(s, F, F + 0.15, F + 1.4, F + 1.6);
      out.parts.coat = { visible: e < 0.01 ? front : 0 };
      out.morph = [s === null ? -0.3 : -0.25 + 1.5 * band(s, F + 0.15, F + 1.35)];
      const g = s === null ? 0 : bump(s, F + 0.1, F + 0.25, F + 1.15, F + 1.4);
      out.glow = [0.72, 0.9, 1, 1.1 * g];
      // A crack as each piece breaks off, and the crackle of refreezing.
      if (s !== null) {
        const at = (L) => 0.1 + (ICE_MELT - 0.1) * Math.pow(L / ICE_TOP, 1 / 1.6);
        const cues = ICE_PIECES.filter((pc) => pc.fall).map((pc, n) => [
          at(pc.detach),
          { voice: "crack", f: 2400 - 250 * n, decay: 0.35, vol: 0.75 },
        ]);
        cues.push([ICE_MELT + 0.35, { voice: "crackle", f: 4600, n: 14, decay: 1.2, vol: 0.6 }]);
        cues.push([F + 0.1, { voice: "sparkle", f: 3400, n: 8, decay: 1.3 }]);
        cuesAt(m, s, cues, out);
      } else cuesAt(m, null, [], out);
    },
    build(k) {
      const V = unit([0.15, 0.25, 1]);
      const iceCol = (deep) => (c) => {
        const rim = 1 - Math.abs(dot(c.n, V));
        const g = c.fbm(c.p[0] * 5, c.p[1] * 5, c.p[2] * 5);
        const l = clamp(0.5 + 0.45 * dot(c.n, LIGHT) + 0.2 * g - deep, 0, 1);
        let col = ramp(["#3f8fc0", "#7cc0e4", "#bfe6f7", "#f2fbff"], l);
        col = mix(col, "#ffffff", 0.55 * Math.pow(rim, 3));
        if (Math.abs(g) < 0.018) col = mix(col, "#ffffff", 0.6);
        return col;
      };
      const ice = (deep = 0) => ({ flat: 0.25, opacity: 0.9, color: iceCol(deep) });
      // Each piece of the swan is a part that melts (gets smaller about
      // where it joins the rest) and may break off (ICE_PIECES).
      const P = Object.fromEntries(
        ICE_PIECES.map((pc) => [pc.name, k.part(pc.name, { pivot: pc.pivot })]),
      );
      // The frost coat: fewer, bigger splats over the same surfaces,
      // coloured as the ice there, that glow as the frost front (channel
      // 0, by height) passes. Hidden except while it runs, when the swan is
      // whole again.
      const coat = k.part("coat", { pivot: [0, 0.5, 0] });
      const both = (shape, opts) => {
        k.add(shape, opts);
        const { interior, core, part, ...rest } = opts;
        k.add(shape, {
          ...rest,
          weight: 0.3,
          size: 1.5,
          flat: 0.4,
          part: coat,
          opacity: 0.45,
          kind: "band",
          channel: 0,
          params: (c) => [clamp(c.p[1] / 1.25, 0, 1), 0.12],
        });
      };
      // The pedestal: a thick slab of ice.
      both(k.box(1.0, 0.3, 0.62), {
        pos: [0, 0.15, 0],
        interior: 0.08,
        core: "#a8dcf4",
        ...ice(0.1),
      });
      // The swan: a full body with a lifted tail, arched wings and an S neck.
      both(k.ellipsoid(0.38, 0.19, 0.21), {
        pos: [-0.02, 0.47, 0],
        interior: 0.08,
        core: "#bfe8fa",
        part: P.body,
        ...ice(),
      });
      both(
        k.tube(
          spline([
            [-0.3, 0.5, 0],
            [-0.42, 0.56, 0],
            [-0.5, 0.66, 0],
          ]),
          (t) => 0.11 * (1 - 0.8 * t),
          { samples: 24, grid: 14, caps: true },
        ),
        { part: P.tail, ...ice() },
      );
      const neck = spline([
        [0.26, 0.52, 0],
        [0.36, 0.64, 0],
        [0.4, 0.8, 0],
        [0.33, 0.95, 0],
        [0.3, 1.07, 0],
        [0.36, 1.16, 0],
        [0.45, 1.17, 0],
      ]);
      // The neck breaks where it is thinnest between its curves.
      both(
        k.tube(neck, (t) => 0.075 - 0.035 * t, { samples: 96, grid: 24 }),
        {
          part: (c) => (c.p[1] < ICE_NECK_BREAK ? P.neckLo : P.neckHi),
          ...ice(),
        },
      );
      both(k.ellipsoid(0.075, 0.058, 0.052), { pos: [0.46, 1.165, 0], part: P.head, ...ice() });
      both(k.cone(0.032, 0.004, 0.13), {
        pos: [0.57, 1.14, 0],
        rot: [0, 0, -105],
        part: P.beak,
        ...ice(),
      });
      for (const side of [-1, 1]) {
        const near = side > 0;
        both(
          k.param(
            (u, v) => {
              // u runs along the wing (front to back), v from its root up
              // to the feathered edge.
              const x = 0.18 - 0.55 * u;
              const lift = 0.36 * v * Math.sin(Math.PI * (0.25 + 0.75 * u)) + 0.12 * v * u;
              const feather = 0.035 * Math.abs(Math.sin(u * Math.PI * 6)) * v * v;
              return [
                x - 0.1 * v * u,
                0.55 + lift + feather,
                side * (0.17 + 0.1 * v - 0.12 * v * v),
              ];
            },
            { grid: 24 },
          ),
          {
            // The arched top of the wing is what cracks off.
            part: (c) =>
              c.p[1] > ICE_WING_BREAK
                ? P[near ? "tipNear" : "tipFar"]
                : P[near ? "wingNear" : "wingFar"],
            ...ice(),
          },
        );
      }
      // Frost specks drifting about it while it is cold.
      const frost = k.part("frost", { pivot: [0, 0.5, 0] });
      k.cloud({ share: 0.003, size: 0.6, pattern: false }, (r) => ({
        p: [(r() - 0.5) * 1.1, 0.3 + r() * 0.9, (r() - 0.5) * 0.7],
        color: "#ffffff",
        opacity: 0.85,
        kind: "rise",
        params: [0.14, r()],
        part: frost,
      }));
      // Drops of meltwater: each a token that beads at a low point of a
      // piece (or the pedestal's edge) and falls to the pedestal's top or
      // the ground. Big enough to show on a phone.
      const r = lcg(33);
      const byName = Object.fromEntries(ICE_PIECES.map((pc) => [pc.name, pc]));
      const drops = ICE_DROPS.map(([piece, p], i) => {
        const over = Math.abs(p[0]) < 0.49 && Math.abs(p[2]) < 0.3 && p[1] > 0.31;
        const tok = { kind: "token", params: [i, 0], pattern: false };
        k.add(k.ellipsoid(0.017, 0.026, 0.017), {
          ...tok,
          pos: p,
          weight: 3,
          size: 1.3,
          color: (c) => mix("#e4f6ff", "#ffffff", Math.max(0, dot(c.n, LIGHT))),
          opacity: 0.85,
        });
        return {
          p,
          piece,
          pv: byName[piece]?.pivot || p,
          to: over ? 0.31 : 0.01,
          period: 0.7 + 0.5 * r(),
          phase: r(),
        };
      });
      // The puddle: flat splats lying on the ground in a sunflower spiral
      // (evenly spread, so it is smooth water, not blotches), a little
      // uneven at its rim, spread out by its part's scale.
      const puddle = k.part("puddle", { pivot: [0, 0, 0] });
      k.cloud({ share: 0.012, size: 8, pattern: false }, (r2, i, n) => {
        const a = i * 2.399963;
        const rr = 0.86 * Math.sqrt((i + 0.5) / n) * (0.93 + 0.07 * Math.sin(a * 5 + 1));
        return {
          p: [Math.cos(a) * rr, 0.004, Math.sin(a) * rr * 0.9],
          n: [0, 1, 0],
          flat: 0.2,
          color: mix("#cdeefb", "#86c6e4", rr / 0.86),
          opacity: 0.32,
          part: puddle,
        };
      });
      k.data = { drops };
    },
  },

  candle: {
    alive: true,
    options: [{ key: "wax", label: "Wax", type: "color", default: "#f3ead6" }],
    controls: [{ key: "lit", label: "Lit", type: "toggle", default: 1, ease: 0.5 }],
    action: { key: "lit", label: "Blow out or light" },
    drive(t, c, out) {
      out.parts.flame = { visible: c.lit };
      out.parts.smoke = { visible: 1 - c.lit };
      out.amount = 0.6 + 0.4 * c.lit;
    },
    build(k, o) {
      const wax = o.wax;
      const H = 0.95;
      const R = 0.26;
      const waxCol = (c) => {
        const glow = smoothstep(H - 0.35, H, c.p[1]);
        const col = mix(wax, mix(wax, "#ffcf8a", 0.6), glow);
        return lit(col, c.n, 0.35);
      };
      k.add(
        k.lathe(
          [
            [R, 0],
            [R, H - 0.06],
            [R * 0.97, H - 0.01],
            [R * 0.85, H],
            [R * 0.4, H - 0.03],
            [0, H - 0.04],
          ],
          { thick: 0.1 },
        ),
        { flat: 0.25, interior: 0.1, core: shade(wax, 0.92), color: waxCol },
      );
      // Drips of wax down the side.
      for (let i = 0; i < 8; i++) {
        const a = (i / 8) * TAU + k.rand() * 0.5;
        const len = 0.15 + 0.3 * k.rand();
        const d = [Math.sin(a), 0, Math.cos(a)];
        const top = [d[0] * R * 1.0, H - 0.02, d[2] * R * 1.0];
        const bot = [d[0] * R * 1.02, H - len, d[2] * R * 1.02];
        k.add(
          k.tube(spline([top, lerp3(top, bot, 0.5), bot]), (t) => 0.022 + 0.012 * t * t, {
            samples: 16,
            grid: 10,
            caps: true,
          }),
          {
            color: waxCol,
          },
        );
      }
      // The wick.
      k.add(
        k.tube(
          spline([
            [0, H - 0.04, 0],
            [0.005, H + 0.02, 0],
            [0.015, H + 0.06, 0],
          ]),
          0.008,
          { samples: 8, grid: 6 },
        ),
        {
          weight: 3,
          color: "#1a1410",
        },
      );
      // The flame: a steady core, flickering tongues and a warm halo.
      const flame = k.part("flame", { pivot: [0, H + 0.05, 0] });
      k.add(
        k.lathe([
          [0, 0],
          [0.03, 0.03],
          [0.038, 0.07],
          [0.028, 0.13],
          [0.012, 0.19],
          [0, 0.23],
        ]),
        {
          pos: [0, H + 0.03, 0],
          part: flame,
          weight: 3,
          pattern: false,
          kind: "twinkle",
          params: [0.15, 0],
          color: (c) => {
            const y = (c.p[1] - (H + 0.03)) / 0.2;
            return y < 0.2
              ? mix("#3a6aff", "#ffe8a0", y / 0.2)
              : mix("#fff6d0", "#ffb030", smoothstep(0.5, 1, y));
          },
        },
      );
      k.cloud({ share: 0.03, size: 0.7, pattern: false }, (r) => {
        const a = r() * TAU;
        const rr = 0.028 * Math.sqrt(r());
        return {
          p: [Math.sin(a) * rr, H + 0.08 + r() * 0.04, Math.cos(a) * rr],
          color: mix("#ffb040", "#fff2c0", 1 - rr / 0.028),
          opacity: 0.8,
          kind: "flame",
          params: [0.12 + 0.08 * r(), r()],
          part: flame,
        };
      });
      k.cloud({ share: 0.008, size: 4, pattern: false }, (r) => {
        const d = randDir(r);
        const rr = 0.1 + 0.14 * r();
        return {
          p: [d[0] * rr, H + 0.15 + d[1] * rr * 1.3, d[2] * rr],
          color: "#ffc070",
          opacity: 0.04,
          kind: "twinkle",
          params: [0.3, r() * 6],
          part: flame,
        };
      });
      // A wisp of smoke when it is blown out.
      const smoke = k.part("smoke", { pivot: [0, H + 0.06, 0] });
      k.cloud({ share: 0.01, size: 1.8, pattern: false }, (r) => ({
        p: [0.015 + (r() - 0.5) * 0.02, H + 0.07, (r() - 0.5) * 0.02],
        color: "#bdb8b2",
        opacity: 0.25,
        kind: "rise",
        params: [0.5, r()],
        part: smoke,
      }));
      // A brass dish with a finger ring.
      const brass = (c) => {
        const env = smoothstep(-0.3, 0.9, -0.5 * c.n[0] + 0.6 * c.n[1] + 0.3 * c.n[2]);
        return mix("#6a4a1a", "#f8dc8a", env);
      };
      k.add(
        k.lathe([
          [0, -0.04],
          [0.42, -0.04],
          [0.47, -0.02],
          [0.48, 0.04],
          [0.45, 0.03],
          [0.3, 0.0],
          [0, 0.0],
        ]),
        { flat: 0.2, color: brass },
      );
      k.add(k.torus(0.08, 0.018), { pos: [0.55, 0.02, 0], rot: [90, 0, 0], color: brass });
      k.reach([0, H + 0.45, 0]);
    },
  },

  tornado: {
    alive: true,
    controls: [
      { key: "power", label: "Power", type: "slider", default: 0.6 },
      { key: "whirl", label: "Spin up", type: "pulse", ease: TW_SECS },
    ],
    action: { key: "whirl", label: "Spin it up" },
    // A tap spins the tornado up: each band of the funnel widens about its
    // own middle (the foot most) and the whole funnel turns two extra
    // times, faster and faster, while the dust at its foot boils up. The
    // planks, leaves and clods lying on the field in front are lifted one
    // by one, whirl up round the funnel and are flung back out as it
    // weakens, landing where they lay.
    drive(t, c, out) {
      const s = since(c.whirl, TW_SECS);
      const grow = s === null ? 0 : ease(band(s, 0.05, 1.0)) * (1 - ease(band(s, 2.9, 4.3)));
      const weak = s === null ? 0 : bump(s, 3.8, 4.3, 4.7, 5.3);
      const q = quatAxisAngle([0, 1, 0], s === null ? 0 : TAU * 2 * ease(band(s, 0.05, 4.6)));
      for (let i = 0; i < TW_BANDS; i++)
        out.parts[`band${i}`] = { quat: q, scale: 1 + (TW_GROW[i] - 1) * grow - 0.14 * weak };
      out.parts.dust = { scale: 1 + 0.5 * grow };
      out.amount = 0.4 + 1.2 * c.power + 0.5 * grow;
      out.tokens = TW_DEBRIS.map((d) => {
        const rest = [Math.sin(d.a) * d.r0, d.h, Math.cos(d.a) * d.r0];
        const base = add(rest, TW_AHEAD);
        if (s === null) return { base, offset: mul(TW_AHEAD, -1) };
        const [p, u] = twDebrisAt(d, s, grow);
        // Hidden while it passes behind the funnel (seen from the front).
        const y = p[1];
        const fr = twRad(Math.min(TW_H, y)) * (1 + (TW_GROW[twBand(y)] - 1) * grow);
        const behind = smoothstep(0.04, -0.06, dot(p, TW_CAM));
        const across = smoothstep(fr * 1.05, fr * 0.8, Math.abs(dot(p, TW_RIGHT)));
        return {
          base,
          offset: sub(p, base),
          quat: quatAxisAngle(d.axis, TAU * d.spin * ease(u)),
          visible: 1 - behind * across,
        };
      });
    },
    build(k) {
      const H = TW_H;
      const rad = twRad;
      // The funnel: dust whirling fastest near the ground, in five bands
      // (parts) that widen and spin up on a tap. The bottom band grows up
      // from the ground and the top one down from the cloud.
      const bands = Array.from({ length: TW_BANDS }, (_, i) => {
        const y = i === 0 ? 0 : i === TW_BANDS - 1 ? H : ((i + 0.5) / TW_BANDS) * H;
        return k.part(`band${i}`, { pivot: [0, y, 0] });
      });
      k.cloud({ share: 0.55, size: 2.3, pattern: false }, (r) => {
        const y = H * Math.pow(r(), 0.8);
        const a = r() * TAU;
        const rr = rad(y) * (0.82 + 0.22 * Math.sqrt(r()));
        const streak = 0.5 + 0.5 * Math.sin(a * 3 + y * 9);
        const v = clamp(0.25 + 0.5 * (y / H) + 0.25 * streak + 0.1 * (r() - 0.5), 0, 1);
        return {
          p: [Math.sin(a) * rr, y, Math.cos(a) * rr],
          dir: [Math.cos(a), 0.15, -Math.sin(a)],
          stretch: 1.8,
          color: ramp(["#4a3e34", "#66584a", "#847a70", "#a09a94", "#c0bcb8"], v),
          opacity: 0.55 + 0.3 * (1 - y / H),
          kind: "orbit",
          params: [2.2, 0.6],
          part: bands[twBand(y)],
        };
      });
      // Debris caught in the wind.
      k.cloud({ share: 0.0006, size: 1.0, pattern: false }, (r) => {
        const y = 0.1 + r() * (H - 0.3);
        const a = r() * TAU;
        const rr = rad(y) * (1.1 + 0.5 * r());
        return {
          p: [Math.sin(a) * rr, y, Math.cos(a) * rr],
          n: randDir(r),
          color: mix("#2a2018", "#5a4a38", r()),
          kind: "orbit",
          params: [1.3, 0.3],
          part: bands[twBand(y)],
        };
      });
      // Dust boiling up around the foot.
      const dust = k.part("dust", { pivot: [0, 0, 0] });
      k.cloud({ share: 0.025, size: 2.2, pattern: false }, (r) => {
        const a = r() * TAU;
        const rr = 0.06 + 0.26 * r();
        return {
          p: [Math.sin(a) * rr, 0.03, Math.cos(a) * rr],
          color: mix("#8a7866", "#b8a894", r()),
          opacity: 0.2,
          kind: "rise",
          params: [0.4 + 0.3 * r(), r()],
          part: dust,
        };
      });
      // Planks, clods and leaves lying on the field in front, each a token
      // (built ahead of the funnel for the draw order; see TW_AHEAD).
      TW_DEBRIS.forEach((d, i) => {
        const pos = add([Math.sin(d.a) * d.r0, d.h, Math.cos(d.a) * d.r0], TW_AHEAD);
        const token = { kind: "token", params: [i, 0], pattern: false, fit: false, flat: 0.3 };
        if (d.type === "plank")
          k.add(k.box(0.13, 0.018, 0.036), {
            ...token,
            pos,
            rot: [0, d.yaw, 0],
            count: 110,
            color: (c) =>
              lit(
                mix("#8a5a30", "#5a3a1e", 0.5 + 0.5 * Math.sin(c.lp[0] * 90 + 3 * d.tone)),
                c.n,
                0.4,
              ),
          });
        else if (d.type === "clod")
          k.add(k.sphere(0.024), {
            ...token,
            pos,
            scale: [1.2, 0.8, 1],
            count: 60,
            color: (c) => lit(mix("#4a3624", "#6a5238", c.rand()), c.n, 0.4),
          });
        else
          k.add(k.ellipsoid(0.036, 0.005, 0.021), {
            ...token,
            pos,
            rot: [0, d.yaw, 0],
            count: 50,
            color: (c) => lit(ramp(["#4a8a2a", "#9aa830", "#e0a020", "#c8601a"], d.tone), c.n, 0.3),
          });
      });
      // The storm cloud it hangs from, turning slowly: soft puffs, lit on top.
      const puffs = [];
      for (let i = 0; i < 34; i++) {
        const a = i * 2.39996;
        const rr = 1.05 * Math.sqrt((i + 0.5) / 34);
        const s = 0.2 + 0.12 * ((i * 0.37) % 1) + 0.08 * (1 - rr);
        puffs.push({
          c: [
            Math.sin(a) * rr,
            H + 0.05 + 0.12 * (1 - rr) + 0.05 * Math.cos(i * 1.7),
            Math.cos(a) * rr,
          ],
          s,
        });
      }
      for (const pf of puffs) {
        k.add(k.sphere(pf.s), {
          pos: pf.c,
          scale: [1, 0.7, 1],
          size: 2.4,
          flat: 1,
          opacity: 0.75,
          pattern: false,
          kind: "orbit",
          params: [0.25, 0],
          color: (c) => {
            for (const q of puffs) {
              if (q === pf) continue;
              const d = Math.hypot(c.p[0] - q.c[0], (c.p[1] - q.c[1]) / 0.7, c.p[2] - q.c[2]);
              if (d < q.s * 0.85) return null;
            }
            const v = clamp(
              0.3 +
                0.35 * c.n[1] +
                0.25 * dot(c.n, LIGHT) +
                0.12 * c.fbm(c.p[0] * 3, c.p[1] * 3, c.p[2] * 3),
              0,
              1,
            );
            return ramp(["#1e2026", "#34373f", "#50545e", "#7a7f8a", "#a8acb4"], v);
          },
        });
      }
      // Flat fields below.
      k.add(k.disc(1.05), {
        pos: [0, 0, 0],
        color: (c) => {
          if (c.n[1] < 0) return "#3a2e20";
          const r = Math.hypot(c.p[0], c.p[2]);
          const g = c.fbm(c.p[0] * 5, 0, c.p[2] * 5);
          let col = mix("#5a7a2a", "#8a9a3a", 0.5 + 0.5 * g);
          if (Math.abs(Math.sin(c.p[0] * 14)) < 0.15) col = mix(col, "#6a5a3a", 0.4);
          return mix(col, "#6a5a44", smoothstep(0.45, 0.1, r));
        },
      });
    },
  },

  rainbow: {
    alive: true,
    controls: [{ key: "draw", label: "Draw", type: "pulse", ease: RB_SECS }],
    action: { key: "draw", label: "Draw the rainbow" },
    // A tap wipes the arc away in a blink (violet first), then draws it
    // again colour by colour, red first, each band from the left cloud to
    // the right one behind a bright little pen of its own colour. When the
    // last band is in, sparkles burst from both clouds, which puff up, and
    // drift down as they fade.
    drive(t, c, out) {
      const s = since(c.draw, RB_SECS);
      const ch = rbChannel(s);
      out.morph = [ch];
      // The pen rides the drawing front: band i, from the left foot (f = 1)
      // to the right (f = 0).
      const x = ch * 7;
      const drawing = s !== null && s > 0.8 && s < 3.6;
      out.tokens = RB_COLS.map((_, i) => {
        const base = [0, rbRadius(i), 0.075];
        const f = x - (6 - i);
        if (!drawing || f < 0 || f > 1) return { base, visible: 0 };
        const a = Math.PI * f;
        const r = rbRadius(i);
        return {
          base,
          offset: sub([Math.cos(a) * r, Math.sin(a) * r, 0.075], base),
          visible: smoothstep(0, 0.05, f) * smoothstep(1, 0.95, f),
        };
      });
      const burst = s === null ? 0 : band(s, 3.5, 4.7);
      const grow = 1 + 6 * easeOut(burst);
      const fade = s === null || s < 3.5 ? 0 : 1 - band(s, 4.1, 4.8);
      for (const side of ["L", "R"]) {
        out.parts[`burst${side}`] = {
          scale: grow,
          offset: [0, -0.12 * burst * burst, 0],
          visible: fade / grow,
        };
        out.parts[`cloud${side}`] = {
          scale: 1 + 0.1 * (s === null ? 0 : bump(s, 3.45, 3.65, 3.8, 4.6)),
        };
      }
      out.parts.glitter = { visible: 1 - clamp01(ch) };
    },
    build(k) {
      const bands = RB_COLS;
      const R = RB_R;
      const w = RB_W;
      // The arc: each splat fades out as channel 0 passes its place (its
      // band, then how far along it is).
      k.add(k.torus(R, w), {
        rot: [90, 0, 0],
        scale: [1, 0.3, 1],
        flat: 0.25,
        kind: "fade",
        channel: 0,
        params: (c) => {
          const d = Math.hypot(c.p[0], c.p[1]) - R;
          const f = clamp(0.5 - d / (2 * w), 0, 0.999);
          return [rbAt(Math.floor(f * 7), Math.atan2(c.p[1], c.p[0])), 0.012];
        },
        color: (c) => {
          if (c.p[1] < -0.02) return null;
          const d = Math.hypot(c.p[0], c.p[1]) - R;
          const f = clamp(0.5 - d / (2 * w), 0, 0.999);
          const col = ramp(bands, f);
          return lit(col, c.n, 0.2);
        },
      });
      // Fluffy clouds at both feet (a part each, to puff up).
      for (const side of [-1, 1]) {
        const cloud = k.part(side < 0 ? "cloudL" : "cloudR", { pivot: [side * R, 0.02, 0] });
        for (let i = 0; i < 7; i++) {
          const s = 0.13 + 0.07 * k.rand();
          const pos = [
            side * R + (k.rand() - 0.5) * 0.45,
            0.02 + k.rand() * 0.12,
            (k.rand() - 0.5) * 0.25,
          ];
          k.add(k.sphere(s), {
            pos,
            size: 1.8,
            flat: 0.8,
            kind: "breathe",
            params: [0.015, side],
            part: cloud,
            color: (c) =>
              mix("#c8d4e4", "#ffffff", clamp(0.4 + 0.6 * dot(c.n, LIGHT) + 0.3 * c.n[1], 0, 1)),
          });
        }
      }
      // Sparkles (they go while the arc is wiped).
      const glitter = k.part("glitter", { pivot: [0, 0.5, 0] });
      k.cloud({ share: 0.01, size: 0.9, pattern: false }, (r) => {
        const a = r() * Math.PI;
        const rr = R + (r() - 0.5) * 0.7;
        return {
          p: [Math.cos(a) * rr, Math.sin(a) * rr + 0.05, (r() - 0.5) * 0.2],
          color: "#ffffff",
          opacity: 0.9,
          kind: "twinkle",
          params: [0.45, r() * 6],
          part: glitter,
        };
      });
      // The pens, one per band (token i), built at the top of the arc just
      // in front of it: a bright core and a soft halo.
      RB_COLS.forEach((col, i) => {
        const at = [0, rbRadius(i), 0.075];
        k.cloud({ count: 70, size: 0.8, pattern: false }, (r) => {
          const d = randDir(r);
          const rr = 0.022 * Math.cbrt(r());
          return {
            p: add(at, mul(d, rr)),
            color: mix(col, "#ffffff", 0.55 + 0.4 * (1 - rr / 0.022)),
            opacity: 1,
            kind: "token",
            params: [i, 0],
          };
        });
        k.cloud({ count: 16, size: 3.2, pattern: false }, (r) => ({
          p: add(at, mul(randDir(r), 0.02 * r())),
          color: mix(col, "#ffffff", 0.35),
          opacity: 0.25,
          kind: "token",
          params: [i, 0],
        }));
      });
      // Bursts of sparkles from both clouds, built packed at each foot and
      // spread by their part's scale.
      for (const side of [-1, 1]) {
        // In front of the cloud, so they draw over it.
        const foot = [side * (R - 0.02), 0.2, 0.3];
        const part = k.part(side < 0 ? "burstL" : "burstR", { pivot: foot });
        k.cloud({ share: 0.0016, size: 1.9, pattern: false }, (r) => {
          const d = randDir(r);
          const up = [d[0] * 1.1, Math.abs(d[1]) * 0.8 + 0.55, d[2] * 0.3];
          return {
            p: add(foot, mul(up, 0.06 * (0.3 + 0.7 * r()))),
            color: r() < 0.6 ? "#ffffff" : mix(RB_COLS[Math.floor(r() * 7)], "#ffffff", 0.35),
            opacity: 1,
            part,
          };
        });
      }
    },
  },

  iceberg: {
    alive: true,
    controls: [{ key: "calve", label: "Calve", type: "pulse", ease: IB_SECS }],
    action: { key: "calve", label: "Break off a chunk" },
    // A tap cracks a chunk off the berg's shoulder (a part cut by a plane,
    // with fresh pale ice on both broken faces). It tips over to the right,
    // falls into the sea with a crown of spray and a ring of ripples, bobs
    // and drifts, then melts away as one piece; the berg, lighter, bobs up
    // and rocks, and the chunk grows back in place from its broken face.
    drive(t, c, out, info) {
      const ch = info?.data?.chunk;
      if (!ch) return;
      const s = since(c.calve, IB_SECS);
      const m = mem(c);
      cuesAt(m, s, [[ch.Ti, { voice: "splash", f: 1100, decay: 1.6, vol: 0.9 }]], out);
      const P = ch.hinge;
      if (s === null) {
        out.parts.chunk = {};
        out.parts.berg = {};
        out.parts.splash = { visible: 0 };
        out.parts.ripple = { visible: 0 };
        out.morph = [0, 0];
        return;
      }
      const pose = icebergPose(ch, s);
      if (pose.regrow !== undefined) {
        const k = pose.regrow;
        out.parts.chunk = { scale: k, offset: mul(sub(ch.F, P), 1 - k), visible: k > 0.01 ? 1 : 0 };
      } else {
        const q = quatAxisAngle(IB_AXIS, pose.th);
        const off = sub(sub(pose.C, P), quatRotate(q, mul(sub(ch.C0, P), pose.k)));
        // A jolt as it cracks, before it starts to tip.
        const jolt = 0.012 * bump(s, 0, 0.03, 0.06, 0.12);
        out.parts.chunk = {
          quat: q,
          scale: pose.k,
          offset: add(off, mul(IB_OUT, jolt)),
          visible: pose.k > 0.01 ? 1 : 0,
        };
      }
      // The berg, lighter, bobs up and rocks after the chunk goes.
      const u = Math.max(0, s - 0.45);
      const damp = Math.exp(-u / 1.0) * (1 - band(s, 3.6, 4.6)) * (s > 0.45 ? 1 : 0);
      const rockAxis = unit(cross([0, 1, 0], IB_OUT));
      out.parts.berg = {
        offset: [0, 0.035 * damp * Math.sin((TAU * u) / 1.4), 0],
        quat: quatAxisAngle(rockAxis, -0.07 * damp * Math.sin((TAU * u) / 1.7)),
      };
      // The splash: a crown of drops thrown up from where it lands, and
      // rings of ripples and foam spreading on the sea (channel 1 fades
      // them in and out).
      const w = s - ch.Ti;
      if (w > 0 && w < 0.85) {
        const kk = w / 0.06;
        out.parts.splash = {
          scale: kk,
          offset: add(mul(IB_CAM, -0.3), [0, -0.5 * IB_G * w * w, 0]),
          visible: (Math.min(1, kk * 0.3) / kk) * (1 - band(w, 0.55, 0.8)),
        };
      } else out.parts.splash = { visible: 0 };
      const kr = 1 + 11 * easeOut(band(w, 0, 1.6));
      out.parts.ripple = { scale: kr, visible: w > 0 && w < 1.8 ? Math.pow(kr, -0.45) : 0 };
      out.morph = [0, w > 0 ? band(w, 0, 0.12) * (1 - ease(band(w, 0.5, 1.7))) : 0];
    },
    build(k) {
      const n = k.noise;
      const shapeR = (d) => {
        const up = smoothstep(-0.25, 0.25, d[1]);
        const a = 0.82 - 0.3 * up;
        const b = 1.0 - 0.25 * smoothstep(-0.1, 0.1, d[1]);
        const base = 1 / Math.hypot(Math.hypot(d[0], d[2]) / a, d[1] / b);
        const bump = Math.max(0, n(d[0] * 1.6 + 5, d[1] * 1.6, d[2] * 1.6));
        const peaks = 0.9 * bump * bump * Math.max(0, d[1]);
        return base * (1 + 0.1 * n.fbm(d[0] * 2, d[1] * 2, d[2] * 2, 3) + peaks);
      };
      const shape = k.radial(shapeR, { grid: 96 });
      const ch = icebergChunk(shapeR);
      k.data = { chunk: ch };
      const inChunk = (p) => dot(p, IB_N) > ch.h && p[1] > IB_FLOOR;
      const berg = k.part("berg", { pivot: [0, 0, 0] });
      const chunk = k.part("chunk", { pivot: ch.hinge });
      k.add(shape, {
        flat: 0.25,
        interior: 0.12,
        // The chunk is hollow (its inside would draw over it as it turns).
        core: (c) => (inChunk(c.p) ? null : "#8fd0ee"),
        part: (c) => (inChunk(c.p) ? chunk : berg),
        color: (c) => {
          const y = c.p[1];
          const g = c.fbm(c.p[0] * 5, c.p[1] * 5, c.p[2] * 5);
          if (y < 0) {
            const depth = clamp(-y / 1.1, 0, 1);
            return mix(mix("#5fb8d8", "#2a7fae", depth), "#1a4a78", 0.4 * depth + 0.15 * g);
          }
          const crack = Math.abs(g) < 0.04;
          let col = mix("#a8dcf2", "#ffffff", clamp(0.45 + 0.6 * dot(c.n, LIGHT) + 0.2 * g, 0, 1));
          if (crack) col = mix(col, "#6ab8e0", 0.6);
          return col;
        },
      });
      // The broken faces, on the two cuts, inside until it breaks: fresh
      // ice, paler and glassier than the weathered surface. One set stays
      // on the berg and one goes with the chunk.
      const e1 = unit(cross(IB_N, [0, 1, 0]));
      const e2 = cross(IB_N, e1);
      const Q = mul(IB_N, ch.h);
      const inside = (p) => len(p) < shapeR(unit(p)) * 0.995;
      // A point on the steep cut (above the floor) or on the floor (outside
      // the cut), with the face's normal out of the berg.
      const onCut = (r) => {
        for (let tries = 0; tries < 80; tries++) {
          if (r() < 0.7) {
            const p = add(Q, add(mul(e1, (r() - 0.5) * 1.4), mul(e2, (r() - 0.5) * 1.4)));
            if (p[1] > IB_FLOOR && inside(p)) return [p, IB_N];
          } else {
            const p = [(r() - 0.5) * 1.8, IB_FLOOR, (r() - 0.5) * 1.8];
            if (dot(p, IB_N) > ch.h && inside(p)) return [p, [0, 1, 0]];
          }
        }
        return null;
      };
      for (const side of [1, -1]) {
        k.cloud({ share: 0.03, size: 1.15, pattern: false }, (r) => {
          const hit = onCut(r);
          if (!hit) return null;
          const p = hit[0];
          const nn = mul(hit[1], side);
          const vein = n(p[0] * 7, p[1] * 7, p[2] * 7);
          const col = mix("#e6f7ff", "#9fd6f2", 0.5 + 0.5 * vein);
          return {
            p: add(p, mul(nn, 0.004)),
            n: nn,
            flat: 0.2,
            color: lit(Math.abs(vein) < 0.05 ? "#ffffff" : col, nn, 0.35),
            opacity: 0.97,
            part: side > 0 ? berg : chunk,
          };
        });
      }
      // The sea: see-through and rippling, with foam at the waterline,
      // fading out towards its edge.
      k.cloud({ share: 0.14, size: 1.7, flat: 0.3, pattern: false }, (r) => {
        const a = r() * TAU;
        const rr = Math.sqrt(0.2 + r() * (1.9 - 0.2));
        const x = Math.sin(a) * rr;
        const z = Math.cos(a) * rr;
        const g = n.fbm(x * 3, 0, z * 3, 3);
        const foam = rr < 0.64 + 0.06 * g;
        return {
          p: [x, 0, z],
          n: [0, 1, 0],
          color: foam ? "#f2fbff" : mix("#6cc0e0", "#2a86b8", clamp(rr / 1.3 + 0.3 * g, 0, 1)),
          opacity: foam ? 0.85 : 0.5 * (1 - smoothstep(0.75, 1.38, rr)) + 0.04,
          kind: "wave",
          params: [0.006, 0],
        };
      });
      // Where the chunk lands.
      const fall = ch.Ti - ch.T1;
      const Ci = add(add(ch.C1, mul(ch.V1, fall)), [0, -0.5 * IB_G * fall * fall, 0]);
      const W = [Ci[0], 0.012, Ci[2]];
      // The splash: drops built packed at the landing point (a little
      // towards the camera, to draw over the chunk) and thrown up by their
      // part's scale; the drive adds the fall (see splash in drive).
      const W1 = add(W, mul(IB_CAM, 0.3));
      const splash = k.part("splash", { pivot: W1 });
      k.cloud({ share: 0.008, size: 1.15, pattern: false }, (r) => {
        const a = r() * TAU;
        // A crown thrown out and up, and a jet up the middle.
        const crown = r() < 0.65;
        const vr = crown ? 0.55 + 0.4 * r() : 0.25 * r();
        const vy = crown ? 1.5 + 0.5 * r() : 1.9 + 0.5 * r();
        const v = [Math.cos(a) * vr, vy, Math.sin(a) * vr];
        return {
          p: add(W1, mul(v, 0.06)),
          color: mix("#d8f2ff", "#ffffff", r()),
          opacity: 0.9,
          part: splash,
        };
      });
      // Ripples: two rings and a patch of foam, built small and spread by
      // their part's scale, fading in and out on channel 1.
      const ripple = k.part("ripple", { pivot: W });
      k.cloud({ share: 0.005, size: 0.8, pattern: false }, (r) => {
        const a = r() * TAU;
        const pick = r();
        const rr = pick < 0.4 ? 0.05 : pick < 0.7 ? 0.03 : 0.018 * Math.sqrt(r());
        const ring = pick < 0.7;
        return {
          p: add(W, [Math.cos(a) * rr, 0, Math.sin(a) * rr]),
          dir: ring ? [-Math.sin(a), 0, Math.cos(a)] : undefined,
          n: ring ? undefined : [0, 1, 0],
          stretch: 2.5,
          color: mix("#e2f5ff", "#ffffff", r()),
          opacity: ring ? 0.75 : 0.85,
          kind: "fade",
          channel: 1,
          params: [0, -0.99],
          part: ripple,
        };
      });
      // Two little floes.
      for (const [x, z, s] of [
        [0.95, 0.35, 0.12],
        [-0.85, 0.6, 0.09],
      ]) {
        k.add(k.ellipsoid(s * 1.4, s * 0.45, s), {
          pos: [x, 0.0, z],
          kind: "wave",
          params: [0.006, 0],
          color: (c) => (c.p[1] < 0 ? "#6ab8d8" : lit("#f2fbff", c.n, 0.3)),
        });
      }
    },
  },

  waterfall: {
    alive: true,
    controls: [{ key: "surge", label: "Surge", type: "pulse", ease: WF_SECS }],
    action: { key: "surge", label: "Send a surge" },
    // A tap sends a surge of water over the falls. A white-water front runs
    // along the river, over the lip and down the curtain (a band on channel
    // 0, keyed on when the front gets there). Behind it a wider, thicker
    // sheet of white water unrolls down the curtain from the lip (a morph on
    // channel 1: built rolled up along the lip), with streaks pouring down
    // it; foam spreads over the pool and a big cloud of mist billows up
    // from it (channel 2); then it all calms.
    drive(t, c, out) {
      const s = since(c.surge, WF_SECS);
      if (s === null) {
        out.morph = [-0.3, 0, 0, 0];
        out.parts.surge = { visible: 0 };
        out.parts.streaks = { visible: 0 };
        out.parts.foam = {};
        out.parts.mist = {};
        return;
      }
      const calm = 1 - ease(band(s, 3.0, 4.4));
      const pool = band(s, 0.82, 1.5) * (1 - band(s, 3.2, 4.9));
      out.morph = [s / WF_FRONT, wfDown(s), pool, 0];
      out.glow = [0.8, 0.9, 0.95, 1.2 * (1 - band(s, 1.9, 2.3))];
      out.parts.surge = { visible: band(s, 0.26, 0.34) * calm };
      out.parts.streaks = { visible: ease(band(s, 0.62, 1.0)) * calm };
      const gone = band(s, 4.95, 5.15);
      out.parts.foam = { scale: 1 + 0.85 * easeOut(band(s, 0.82, 2.7)) * (1 - gone) };
      const billow = easeOut(band(s, 0.85, 4.6));
      out.parts.mist = {
        scale: 1 + 1.6 * billow * (1 - gone),
        offset: [0, 0.3 * billow * (1 - gone), 0.04 * billow * (1 - gone)],
        quat: quatAxisAngle([0, 1, 0], 0.5 * billow * (1 - gone)),
      };
    },
    build(k) {
      const rand = k.rand;
      const TOP = WF_TOP;
      const LIP = WF_LIP;
      // The cliff: a rock wall with strata and moss on its ledges.
      const rock = (c) => {
        const g = c.fbm(c.p[0] * 4, c.p[1] * 4, c.p[2] * 4);
        const strata = Math.abs(Math.sin(c.p[1] * 22 + g * 3));
        let col = mix("#6a6258", "#3e3832", 0.4 + 0.5 * g);
        col = shade(col, 0.85 + 0.2 * strata);
        if (c.n[1] > 0.6) col = mix(col, mix("#3f6a24", "#6a8a34", c.rand()), 0.85);
        return lit(col, c.n, 0.5);
      };
      k.add(k.box(1.6, TOP, 0.6), {
        pos: [0, TOP / 2, -0.05],
        color: (c) => (c.s.face === 3 ? null : rock(c)),
      });
      for (let i = 0; i < 12; i++) {
        const x = (rand() - 0.5) * 1.7;
        if (Math.abs(x) < 0.35) continue;
        const s = 0.12 + 0.12 * rand();
        k.add(k.ellipsoid(s * 1.2, s, s * 0.8), {
          pos: [x, rand() * TOP, 0.25 + rand() * 0.05],
          color: rock,
        });
      }
      // The surge's front glows white as it passes (channel 0: the time
      // it gets there over WF_FRONT).
      const front = (at) => ({ kind: "band", channel: 0, params: [at / WF_FRONT, 0.045] });
      // The river on top, running to the lip.
      k.add(
        k.param((u, v) => [(u - 0.5) * 0.6, TOP + 0.005, -0.34 + v * (LIP + 0.34)], {
          grid: 12,
          flip: true,
        }),
        {
          pattern: false,
          color: (c) => mix("#4aa0c8", "#bfe8f6", 0.5 + 0.5 * Math.sin(c.p[2] * 40 + c.p[0] * 5)),
          ...front(0),
          params: (c) => [wfRiver(c.p[2]) / WF_FRONT, 0.045],
        },
      );
      // The falling curtain, curving out from the lip. It swells in a surge
      // (wider, further out and thicker: its splats spread to the front and
      // back of the thicker sheet).
      const sheet = (c) => {
        const s = 0.5 + 0.5 * Math.sin(c.u * 70 + c.noise(c.u * 8, c.v * 3, 0) * 4);
        return mix("#7ec4e4", "#ffffff", 0.35 + 0.5 * s);
      };
      k.add(k.param(wfFall, { grid: 24 }), {
        opacity: 0.8,
        flat: 0.25,
        pattern: false,
        color: sheet,
        ...front(0),
        params: (c) => [wfDrop(c.v) / WF_FRONT, 0.045],
      });
      // The surge's sheet: built rolled up along the lip and unrolled down
      // the curtain by channel 1, wider, further out and thicker than it.
      const surge = k.part("surge", { pivot: [0, TOP, LIP] });
      k.cloud({ share: 0.05, size: 1.25, pattern: false }, (r) => {
        const u = r();
        const v = r();
        const q = wfSurge(u, v, 2 * r() - 1);
        const s = 0.5 + 0.5 * Math.sin(u * 70 + 3 * r());
        return {
          p: [q[0], TOP - 0.004, LIP + 0.01],
          to: q,
          channel: 1,
          n: unit([0, 0.2, 1]),
          flat: 0.35,
          // Softer towards its foot, so its leading edge is ragged water.
          size: 1 + 0.6 * smoothstep(0.75, 1, v),
          color: mix("#a8dcf2", "#ffffff", 0.5 + 0.5 * s),
          opacity: 0.55 * (1 - 0.65 * smoothstep(0.8, 1, v + 0.1 * (r() - 0.5))),
          part: surge,
        };
      });
      k.cloud({ share: 0.12, size: 0.8, pattern: false }, (r) => {
        const u = r();
        const v = r() * 0.92;
        const p = wfFall(u, v);
        return {
          p: [p[0], p[1], p[2] + 0.015],
          dir: [0, -1, 0.1],
          stretch: 4,
          color: mix("#dff4ff", "#ffffff", r()),
          opacity: 0.8,
          kind: "fall",
          params: [0.22, r()],
        };
      });
      // Streaks pouring down the surge's sheet once it is down (falling
      // streaks cannot morph).
      const streaks = k.part("streaks", { pivot: [0, TOP, LIP] });
      k.cloud({ share: 0.04, size: 0.95, pattern: false }, (r) => {
        const p = wfSurge(r(), r() * 0.94, 2 * r() - 1);
        return {
          p: [p[0], p[1], p[2] + 0.02],
          dir: [0, -1, 0.12],
          stretch: 5,
          color: mix("#e6f7ff", "#ffffff", r()),
          opacity: 0.85,
          kind: "fall",
          params: [0.28, r()],
          part: streaks,
        };
      });
      // The pool, with foam where the water lands and drifting mist.
      k.add(k.disc(0.75), {
        pos: [0, 0.04, 0.55],
        scale: [1.1, 1, 0.75],
        pattern: false,
        kind: "wave",
        params: [0.005, 0],
        color: (c) => {
          const d = Math.hypot(c.p[0], (c.p[2] - 0.5) * 1.6);
          if (d < 0.32 + 0.06 * c.noise(c.p[0] * 12, 0, c.p[2] * 12))
            return mix("#e8f6ff", "#ffffff", c.rand());
          return mix("#2a8ab8", "#15557a", clamp(d / 0.9, 0, 1));
        },
      });
      k.cloud({ share: 0.05, size: 2.8, pattern: false }, (r) => ({
        p: [(r() - 0.5) * 0.7, 0.08 + r() * 0.1, 0.45 + (r() - 0.5) * 0.25],
        color: "#f4fbff",
        opacity: 0.22,
        kind: "rise",
        params: [0.45 + 0.3 * r(), r()],
      }));
      // The surge's foam: built over the foam patch at the curtain's foot
      // and spread by its part's scale, coming and going in lacy patches
      // (channel 2, as the mist).
      const foot = [0, 0.05, 0.44];
      const foamPart = k.part("foam", { pivot: foot });
      k.cloud({ share: 0.02, size: 1.5, pattern: false }, (r) => {
        const a = r() * TAU;
        const rr = Math.sqrt(r());
        const x = Math.cos(a) * rr * 0.34;
        const z = 0.52 + Math.sin(a) * rr * 0.2;
        const lace = k.noise(x * 9, 3, z * 9);
        return {
          p: [x, 0.047 + 0.004 * r(), z],
          n: [0, 1, 0],
          flat: 0.2,
          color: mix("#e2f4fc", "#ffffff", r()),
          opacity: 0.85,
          kind: "fade",
          channel: 2,
          params: [clamp01(0.45 * rr + 0.35 * (0.5 + 0.5 * lace)), -0.12],
          part: foamPart,
        };
      });
      // A cloud of mist that billows up from the pool: built small at the
      // foot and grown by its part (channel 2 brings it in and out).
      const mist = k.part("mist", { pivot: [0, 0.06, 0.5] });
      // Faint, so the rocks and the pool show through it.
      k.cloud({ share: 0.012, size: 3.6, pattern: false }, (r) => {
        const d = randDir(r);
        const rr = Math.cbrt(r());
        const p = [d[0] * 0.2 * rr, 0.06 + Math.abs(d[1]) * 0.14 * rr, 0.52 + d[2] * 0.12 * rr];
        return {
          p,
          color: mix("#e4f2fa", "#ffffff", r()),
          opacity: 0.09 + 0.06 * rr,
          kind: "fade",
          channel: 2,
          params: [0.75 * r() * (0.4 + 0.6 * rr), -0.2],
          part: mist,
        };
      });
      // Mossy boulders around the pool.
      for (let i = 0; i < 9; i++) {
        const a = -0.4 + (i / 8) * (Math.PI + 0.8);
        const s = 0.08 + 0.08 * rand();
        k.add(k.ellipsoid(s * 1.3, s * 0.8, s), {
          pos: [Math.cos(a) * 0.85, 0.05, 0.55 + Math.sin(a) * 0.55],
          rot: [0, rand() * 180, 0],
          color: rock,
        });
      }
      k.add(k.box(2.0, 0.08, 1.7), {
        pos: [0, 0, 0.2],
        color: (c) =>
          c.s.face === 2 ? lit(mix("#4a6a2a", "#6a8a34", c.rand()), c.n, 0.3) : "#4a3a2a",
      });
    },
  },

  "ocean-wave": {
    alive: true,
    controls: [{ key: "crash", label: "Crash", type: "pulse", ease: OW_SECS }],
    action: { key: "crash", label: "Break the wave" },
    // A tap breaks the wave. The lip pitches forward and down (a morph on
    // channel 1) and crashes into the flat water in front; there it turns
    // to white water that falls flat (a copy built where the lip lands,
    // morphing down on channel 0), clumps of spray burst up and fall back
    // (tokens), and foam spreads down the face and over the water (a fade
    // on channel 2). Then the foam thins away and the lip curls over again
    // from the crest (a copy of the lip fading back in on channel 3).
    drive(t, c, out) {
      const s = since(c.crash, OW_SECS);
      const hide = { visible: 0 };
      if (s === null) {
        out.morph = [0, 0, 0, 0];
        out.parts.lip = hide;
        out.parts.wash = hide;
        out.parts.spray = {};
        out.tokens = OW_SPRAY.map((d) => ({ base: d.base, visible: 0 }));
        return;
      }
      // The lip is thrown, speeding up, and lands at OW_HIT.
      const thrown = Math.pow(band(s, 0, OW_HIT), 1.4);
      // The white water falls flat on the water.
      const flat = Math.pow(band(s, OW_HIT + 0.03, OW_HIT + 0.55), 1.6);
      const foam = band(s, OW_HIT, 1.7) * (1 - band(s, 2.7, 4.8));
      // The lip comes back from the crest out to its tip.
      const curl = 1 - ease(band(s, 1.5, 3.9));
      out.morph = [flat, thrown, foam, curl];
      out.parts.lip = { visible: 1 - band(s, OW_HIT + 0.02, OW_HIT + 0.12) };
      out.parts.wash = {
        visible: band(s, OW_HIT - 0.04, OW_HIT + 0.04) * (1 - band(s, 1.7, 2.3)),
      };
      // The spray off the lip goes as it is thrown and comes back once the
      // lip has curled over again, rising off it (the behaviours' amount
      // grows back from 0, so it starts on the lip).
      out.parts.spray = { visible: s < 0.05 ? 1 - band(s, 0, 0.05) : ease(band(s, 3.9, 4.5)) };
      out.amount = s < 0.4 ? 1 - band(s, 0, 0.4) : ease(band(s, 3.9, 5.2));
      out.tokens = OW_SPRAY.map((d) => {
        const u = s - d.at;
        if (u < 0 || u > d.dur) return { base: d.base, visible: 0 };
        const off = [d.vel[0] * u, d.vel[1] * u - 0.5 * OW_G * u * u, d.vel[2] * u];
        return {
          base: d.base,
          offset: off,
          quat: quatAxisAngle(d.axis, d.spin * u),
          visible: band(u, 0, 0.04) * (1 - band(u, d.dur - 0.1, d.dur)),
        };
      });
    },
    build(k) {
      const water = (c, s, isBack) => {
        const hgt = clamp(c.p[1] / 0.95, 0, 1);
        const g = c.fbm(c.p[0] * 4, c.p[1] * 4, c.p[2] * 4);
        let tone = hgt * 0.95 + (isBack ? -0.25 : 0.05) + 0.1 * g;
        let col = ramp(["#062f58", "#0b4f82", "#1582a4", "#35b2c2", "#8ae0dc"], clamp(tone, 0, 1));
        const foamN = c.noise(c.p[0] * 12, c.p[1] * 12, c.p[2] * 5);
        if (!isBack && s > 0.62 && foamN > 0.35 - (s - 0.62) * 3)
          return keep(mix("#e4f6ff", "#ffffff", c.rand()));
        if (isBack && s < 0.14 && foamN > -0.1) return keep("#eef9ff");
        if (foamN > 0.5) col = mix(col, "#dff4ff", 0.55);
        return lit(col, c.n, 0.25);
      };
      const back = baked(
        spline([
          [0.3, 0.96],
          [0.08, 0.9],
          [-0.2, 0.62],
          [-0.48, 0.28],
          [-0.75, 0.07],
          [-0.95, 0.0],
        ]),
      );
      // The face up to where the lip starts (and a little past).
      const lipS = (u) => OW_LIP + (1 - OW_LIP) * u;
      const top = OW_LIP + 0.02;
      k.add(
        k.param((u, v) => owAt(OW_FACE, u * top, v), { grid: 80 }),
        {
          flat: 0.25,
          color: (c) => water(c, c.u * top, false),
        },
      );
      // The lip, twice. The one that is thrown (hidden at rest) morphs out
      // to where it lands on channel 1; it is denser, since it stretches.
      // The one shown at rest fades out on a tap and back in from the
      // crest to the tip as the wave re-forms (channel 3).
      const lip = k.part("lip", { pivot: [0.6, 0.9, 0] });
      k.add(
        k.param((u, v) => owAt(OW_FACE, lipS(u), v), { grid: 64 }),
        {
          flat: 0.35,
          weight: 2.2,
          size: 1.3,
          color: (c) => water(c, lipS(c.u), false),
          part: lip,
          channel: 1,
          to: (c) => owThrown(lipS(c.u), c.v),
        },
      );
      k.add(
        k.param((u, v) => owAt(OW_FACE, lipS(u), v), { grid: 64 }),
        {
          flat: 0.25,
          color: (c) => water(c, lipS(c.u), false),
          kind: "fade",
          channel: 3,
          params: (c) => [0.85 * (1 - c.u), 0.14],
        },
      );
      k.add(
        k.param((u, v) => owAt(back, u, v), { grid: 48 }),
        {
          flat: 0.25,
          color: (c) => water(c, c.u, true),
        },
      );
      // White water: the lip where it lands, built there (hidden until it
      // crashes), falling flat onto the water on channel 0.
      // It churns: its splats sit a little off the sheet, in and out, and
      // scatter as it falls.
      const wash = k.part("wash", { pivot: [1, 0.3, 0] });
      k.add(
        k.param((u, v) => owThrown(OW_LIP + (1 - OW_LIP) * u, v), { grid: 48 }),
        {
          flat: 0.9,
          size: 1.5,
          weight: 0.9,
          opacity: 0.85,
          pattern: false,
          part: wash,
          color: (c) => {
            const l = 0.5 + 0.5 * c.noise(c.p[0] * 14, c.p[1] * 14, c.p[2] * 6);
            if (l < 0.25) return null;
            return mix("#cfeaf5", "#ffffff", l);
          },
          channel: 0,
          to: (c) => {
            const p = c.p;
            const g = owGrow(p[2]);
            const f = p[1] / 0.97;
            return [
              p[0] + 0.24 * f + 0.3 * f * (c.rand() - 0.5),
              (0.015 + 0.04 * c.rand()) * (0.2 + 0.8 * g),
              p[2] + 0.16 * f * (c.rand() - 0.5),
            ];
          },
        },
      );
      // Spray flying off the lip, foam churning where it lands (the spray
      // goes while the lip is thrown).
      const spray = k.part("spray", { pivot: [0.7, 0.7, 0] });
      k.cloud({ share: 0.04, size: 0.8, pattern: false }, (r) => {
        const v = 0.35 + 0.65 * r();
        const p = owAt(OW_FACE, 0.6 + 0.32 * r(), v);
        return {
          p: [p[0] + 0.02, p[1] + 0.02, p[2]],
          color: "#ffffff",
          opacity: 0.8,
          kind: "rise",
          params: [0.2 + 0.2 * r(), r()],
          part: spray,
        };
      });
      k.cloud({ share: 0.03, size: 1.4, pattern: false }, (r) => {
        const v = r();
        const g = owGrow(OW_Z0 + (OW_Z1 - OW_Z0) * v);
        return {
          p: [
            0.66 + 0.2 * r() + 0.08 * Math.sin(v * 17),
            0.02 + 0.07 * r() * g,
            OW_Z0 + (OW_Z1 - OW_Z0) * v,
          ],
          color: mix("#dff4ff", "#ffffff", r()),
          opacity: 0.75,
          kind: "twinkle",
          params: [0.3, r() * 6],
        };
      });
      // The crash's foam: lace over the face (spreading down it from the
      // crest) and over the water in front (spreading out from where the
      // lip lands), faded in and out on channel 2.
      const lace = (p) => 0.5 + 0.5 * k.noise(p[0] * 9, p[1] * 9, p[2] * 4);
      k.cloud({ share: 0.05, size: 1.5, pattern: false }, (r) => {
        const v = r();
        const g = owGrow(OW_Z0 + (OW_Z1 - OW_Z0) * v);
        if (r() > 0.25 + 0.75 * g) return null;
        let p;
        let n;
        let at;
        if (r() < 0.62) {
          const s = 0.63 * Math.sqrt(r());
          const a = owAt(OW_FACE, s, v);
          const b = owAt(OW_FACE, s + 0.004, v);
          const tn = unit(sub(b, a));
          n = [tn[1], -tn[0], 0];
          p = add(a, mul(n, 0.01));
          at = 0.04 + 0.5 * ((0.63 - s) / 0.63);
        } else {
          const x = 1.02 + 0.28 * r();
          p = [x, 0.008, OW_Z0 + (OW_Z1 - OW_Z0) * v];
          n = [0, 1, 0];
          at = 0.05 + (0.45 * Math.abs(x - 1.1)) / 0.25;
        }
        const l = lace(p);
        if (l < 0.25) return null;
        return {
          p,
          n,
          flat: 0.2,
          color: mix("#d4eef8", "#ffffff", l),
          opacity: 0.9,
          kind: "fade",
          channel: 2,
          params: [clamp01(at + 0.3 * (1 - l)), -0.12],
        };
      });
      // Clumps of spray, one per token, built where they are thrown from.
      OW_SPRAY.forEach((d, i) => {
        k.cloud({ count: 28, size: 0.9, pattern: false }, (r) => {
          const d0 = randDir(r);
          // Drawn out a little along its flight.
          const q = [d0[0] * 0.8, d0[1] * 1.5, d0[2] * 0.8];
          return {
            p: add(d.base, mul(q, 1.6 * d.size * Math.sqrt(r()))),
            color: mix("#d8f0fa", "#ffffff", r()),
            size: 0.6 + 0.8 * r(),
            opacity: 0.95,
            kind: "token",
            params: [i, 0],
          };
        });
      });
      // Calmer sea in front, rippling.
      k.add(
        k.param((u, v) => [1.05 + 0.25 * u, 0, OW_Z0 + (OW_Z1 - OW_Z0) * v], {
          grid: 12,
          flip: true,
        }),
        {
          pattern: false,
          kind: "wave",
          params: [0.01, 0],
          color: (c) => lit(mix("#08457a", "#0f5a8e", c.rand()), c.n, 0.2),
        },
      );
    },
  },

  geyser: {
    alive: true,
    controls: [{ key: "erupt", label: "Erupt", type: "pulse", ease: 5 }],
    action: { key: "erupt", label: "Erupt" },
    drive(t, c, out) {
      // It bubbles on its own, with a big eruption on a slow cycle.
      const cycle = Math.max(0, Math.sin(t * 0.45)) ** 6;
      out.amount = 0.6 + 0.5 * cycle + 1.2 * c.erupt;
    },
    build(k) {
      // Terraced sinter mound with coloured mats around a blue pool.
      const mound = k.lathe(
        [
          [1.0, 0],
          [0.95, 0.04],
          [0.8, 0.06],
          [0.74, 0.1],
          [0.55, 0.12],
          [0.5, 0.16],
          [0.34, 0.18],
          [0.3, 0.19],
        ],
        { thick: 0.1 },
      );
      k.add(mound, {
        flat: 0.25,
        interior: 0.08,
        core: "#b8a890",
        color: (c) => {
          const r = Math.hypot(c.p[0], c.p[2]);
          const g = c.fbm(c.p[0] * 6, c.p[1] * 6, c.p[2] * 6);
          let col = ramp(
            ["#e8a030", "#d8702a", "#c8b8a0", "#e8e0d0", "#b8a890"],
            clamp((r - 0.3) / 0.7 + 0.1 * g, 0, 1),
          );
          if (c.n[1] < 0.7) col = shade(col, 0.8);
          return lit(col, c.n, 0.4);
        },
      });
      k.add(k.disc(0.3), {
        pos: [0, 0.185, 0],
        pattern: false,
        kind: "wave",
        params: [0.004, 0],
        color: (c) => {
          const r = Math.hypot(c.p[0], c.p[2]) / 0.3;
          return ramp(["#0a3a7a", "#1a6ab8", "#3ab0d8", "#8ad8d0", "#e8d070"], r);
        },
      });
      // The plume: water shooting up, steam billowing around it.
      k.cloud({ share: 0.18, size: 0.8, pattern: false }, (r) => {
        const a = r() * TAU;
        const rr = 0.05 * Math.sqrt(r());
        return {
          p: [Math.sin(a) * rr, 0.2, Math.cos(a) * rr],
          dir: [0, 1, 0],
          stretch: 2.5,
          color: mix("#cfeaf8", "#ffffff", r()),
          opacity: 0.85,
          kind: "rise",
          params: [1.6 + 1.2 * r(), r()],
        };
      });
      k.cloud({ share: 0.14, size: 3.4, pattern: false }, (r) => {
        const a = r() * TAU;
        const rr = 0.12 * Math.sqrt(r());
        return {
          p: [Math.sin(a) * rr, 0.25 + r() * 0.3, Math.cos(a) * rr],
          color: mix("#e8eef2", "#ffffff", r()),
          opacity: 0.2,
          kind: "rise",
          params: [1.2 + 1.0 * r(), r()],
        };
      });
      // Rocks around the rim.
      for (let i = 0; i < 8; i++) {
        const a = (i / 8) * TAU + k.rand() * 0.5;
        const s = 0.05 + 0.05 * k.rand();
        k.add(k.ellipsoid(s * 1.3, s * 0.7, s), {
          pos: [Math.sin(a) * 0.85, 0.05, Math.cos(a) * 0.85],
          color: (c) => lit(mix("#8a8070", "#b8ac98", c.rand()), c.n, 0.4),
        });
      }
      k.reach([0, 1.5, 0]);
    },
  },
};
