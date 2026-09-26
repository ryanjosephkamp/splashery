// Food pack: sweets, fruit and dinners, many of them doing something. Ice
// cream melts as it warms, popcorn pops, jelly wobbles, candles blow out,
// pancakes flip. There is no lighting in a splat toy, so colour functions
// fake it: a soft light from the upper left front, a painted highlight on
// glossy things, and noise for crumb, peel and grain. Seeds, sprinkles,
// flames, steam, stems and leaves are kept out of the pattern layer.

import {
  mix,
  shade,
  smoothstep,
  clamp,
  spline,
  implicitRadius,
  quatAxisAngle,
  quatEuler,
  quatFromTo,
  quatMul,
  quatRotate,
  rgb,
  vec,
} from "../kit.js";

const TAU = Math.PI * 2;
const { add, sub, mul, dot, len, cross, unit } = vec;

// ---- Light and colour helpers --------------------------------------------------

const LIGHT = unit([-0.45, 0.8, 0.55]);
const VIEW = unit([0.5, 0.32, 0.8]);
const HALF = unit(add(LIGHT, VIEW));

const keep = (c, size) => (size ? { c, keep: true, size } : { c, keep: true });

// Ambient plus a soft direct light.
function lit(c, col, amb = 0.74, dif = 0.36) {
  return shade(col, amb + dif * Math.max(0, dot(c.n, LIGHT)));
}
// A painted specular highlight (0..1).
function spec(c, pow = 40) {
  return Math.pow(Math.max(0, dot(c.n, HALF)), pow);
}
const WHITE = [1, 1, 1];
function glossy(c, col, g = 0.75, pow = 40, amb, dif) {
  return mix(lit(c, col, amb, dif), WHITE, clamp(g * spec(c, pow), 0, 1));
}
// Darker where the surface turns away from the viewer (rims of translucent things).
function rim(c) {
  return 1 - Math.abs(dot(c.n, VIEW));
}

// Integer hash to 0..1 for cell patterns (seeds, crumbs).
function hash3(x, y, z) {
  let h = (x * 374761393 + y * 668265263 + z * 2147483647) | 0;
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  h ^= h >>> 16;
  return (h >>> 0) / 4294967296;
}

// A smooth profile through [r, y] points (bottom to top): v in 0..1 -> [r, y].
function profile(points) {
  const seg = points.length - 1;
  return (v) => {
    const x = clamp(v, 0, 1) * seg;
    const i = Math.min(seg - 1, Math.floor(x));
    const t = x - i;
    const p0 = points[Math.max(0, i - 1)];
    const p1 = points[i];
    const p2 = points[i + 1];
    const p3 = points[Math.min(seg, i + 2)];
    const cr = (a, b, c, d) =>
      0.5 *
      (2 * b +
        (-a + c) * t +
        (2 * a - 5 * b + 4 * c - d) * t * t +
        (-a + 3 * b - 3 * c + d) * t * t * t);
    return [Math.max(0, cr(p0[0], p1[0], p2[0], p3[0])), cr(p0[1], p1[1], p2[1], p3[1])];
  };
}

// A surface of revolution whose radius can also vary with the angle:
// rmod(angle, y, v) multiplies the profile radius (flutes, pleats, wobbly edges).
function revolve(k, points, rmod = null, opts = {}) {
  const at = profile(points);
  const [a0, a1] = opts.arc || [0, TAU];
  return k.param(
    (u, v) => {
      const [r0, y] = at(v);
      const a = a0 + u * (a1 - a0);
      const r = rmod ? r0 * rmod(a, y, v) : r0;
      return [r * Math.sin(a), y, r * Math.cos(a)];
    },
    { grid: 72, ...opts },
  );
}

// Radius of a revolved profile at height y (profiles must rise steadily).
function radiusAt(points, n = 256) {
  const at = profile(points);
  const table = [];
  for (let i = 0; i <= n; i++) table.push(at(i / n));
  return (y) => {
    if (y <= table[0][1]) return table[0][0];
    for (let i = 1; i <= n; i++) {
      if (table[i][1] >= y) {
        const a = table[i - 1];
        const b = table[i];
        const f = (y - a[1]) / (b[1] - a[1] || 1);
        return a[0] + (b[0] - a[0]) * f;
      }
    }
    return table[n][0];
  };
}

// Rotates a point about Y by `deg` degrees (for placing things in rings).
function turnY(p, deg) {
  const a = (deg * Math.PI) / 180;
  const c = Math.cos(a);
  const s = Math.sin(a);
  return [p[0] * c + p[2] * s, p[1], -p[0] * s + p[2] * c];
}

// Tabulates a radial function (direction -> distance) on a longitude and
// latitude grid once, then interpolates, so implicit shapes stay fast.
function tabulate(radius, nu = 144, nv = 72) {
  const table = new Float32Array((nu + 1) * (nv + 1));
  for (let j = 0; j <= nv; j++) {
    const th = (j / nv) * Math.PI;
    for (let i = 0; i <= nu; i++) {
      const ph = (i / nu) * TAU - Math.PI;
      const d = [Math.sin(th) * Math.sin(ph), Math.cos(th), Math.sin(th) * Math.cos(ph)];
      table[j * (nu + 1) + i] = radius(d);
    }
  }
  return (d) => {
    const u = ((Math.atan2(d[0], d[2]) + Math.PI) / TAU) * nu;
    const v = (Math.acos(clamp(d[1], -1, 1)) / Math.PI) * nv;
    const i = Math.min(nu - 1, Math.floor(u));
    const j = Math.min(nv - 1, Math.floor(v));
    const fu = u - i;
    const fv = v - j;
    const a = table[j * (nu + 1) + i];
    const b = table[j * (nu + 1) + i + 1];
    const c = table[(j + 1) * (nu + 1) + i];
    const e = table[(j + 1) * (nu + 1) + i + 1];
    return (a + (b - a) * fu) * (1 - fv) + (c + (e - c) * fu) * fv;
  };
}

// Frames along a mostly level curve: level side n and b roughly up.
// Frames are tabulated once along the curve and interpolated.
function levelFrames(curve, steps = 256) {
  const e = 1e-3;
  const table = [];
  for (let i = 0; i <= steps; i++) {
    const v = i / steps;
    const p = curve(v);
    const t = unit(sub(curve(Math.min(1, v + e)), curve(Math.max(0, v - e))));
    const n = unit(cross([0, 1, 0], t));
    table.push({ p, n, b: cross(t, n) });
  }
  const lerp = (a, b, f) => [
    a[0] + (b[0] - a[0]) * f,
    a[1] + (b[1] - a[1]) * f,
    a[2] + (b[2] - a[2]) * f,
  ];
  return (v) => {
    const x = clamp(v, 0, 1) * steps;
    const i = Math.min(steps - 1, Math.floor(x));
    const f = x - i;
    const A = table[i];
    const B = table[i + 1];
    return { p: lerp(A.p, B.p, f), n: lerp(A.n, B.n, f), b: lerp(A.b, B.b, f) };
  };
}

// Random unit vector from a seeded rand.
function randDir(rand) {
  const z = rand() * 2 - 1;
  const a = rand() * TAU;
  const r = Math.sqrt(1 - z * z);
  return [r * Math.cos(a), z, r * Math.sin(a)];
}

// A random direction tangent to the normal n.
function tangentDir(rand, n) {
  const a = Math.abs(n[1]) < 0.9 ? [0, 1, 0] : [1, 0, 0];
  const t1 = unit(cross(n, a));
  const t2 = cross(n, t1);
  const ang = rand() * TAU;
  return add(mul(t1, Math.cos(ang)), mul(t2, Math.sin(ang)));
}

const SPRINKLES = ["#ff5c8a", "#ffd23f", "#4cc9f0", "#7bd88f", "#b28dff", "#fffaf0", "#ff9f43"];

// Sprinkles scattered over a surface given by place(rand) -> { p, n }.
function sprinkles(k, share, place, extra = {}) {
  k.cloud({ share, size: 0.62, pattern: false }, (rand) => {
    const s = place(rand);
    if (!s) return null;
    return {
      p: add(s.p, mul(s.n, 0.012)),
      dir: tangentDir(rand, s.n),
      stretch: 2.7,
      color: SPRINKLES[Math.floor(rand() * SPRINKLES.length)],
      opacity: 1,
      ...extra,
    };
  });
}

// Wobble for jelly-like things: a gentle idle jiggle while alive, and a
// bigger one after a poke that dies away. Returns { tilt, squash }.
function jiggle(t, time, poke, { idle = 1, big = 1 } = {}) {
  const env = poke * poke;
  const a = Math.sin(t * 5.2) * 0.012 * idle + Math.sin(time * 11) * 0.085 * env * big;
  const b = Math.sin(t * 4.1 + 1.3) * 0.01 * idle + Math.sin(time * 9.3 + 1.1) * 0.06 * env * big;
  const squash =
    Math.sin(t * 5.2 + 0.8) * 0.02 * idle + Math.sin(time * 11 + 0.9) * 0.12 * env * big;
  return { tilt: [b, 0, a], squash };
}

// A pointed leaf along +X from its stalk end, folded along the midrib and
// curling up towards the tip. c.u runs along it, c.v across (0.5 = midrib).
function leafShape(k, length, width, curl = 0.25) {
  return k.param(
    (u, v) => {
      const w = width * Math.pow(Math.sin(Math.PI * Math.min(1, u * 1.02)), 0.85);
      const s = v * 2 - 1;
      return [u * length, curl * length * u * u + 0.18 * width * Math.abs(s), s * w];
    },
    { grid: 32 },
  );
}
function leafColor(base = "#3f8f2f", light = "#8cc65a") {
  return (c) => {
    const s = Math.abs(c.v * 2 - 1);
    let col = mix(base, shade(base, 0.8), s);
    if (s < 0.05) col = light;
    else {
      const vein = (c.u * 7 - s * 1.6) % 1;
      if (vein < 0.07 && s < 0.85) col = mix(col, light, 0.5);
    }
    return keep(glossy(c, col, 0.5, 20, 0.74, 0.38));
  };
}

const easeInOut = (x) => (x < 0.5 ? 2 * x * x : 1 - Math.pow(-2 * x + 2, 2) / 2);
const hop = (s) => 4 * s * (1 - s);

// ---- Tap effect helpers (E5) -------------------------------------------------------

const band = (x, a, b) => clamp((x - a) / (b - a), 0, 1);
// Rises from a to b, holds, falls from c to d.
const bump = (x, a, b, c, d) => band(x, a, b) * (1 - band(x, c, d));
const easeOut = (x) => 1 - (1 - x) ** 3;
const easeIn = (x) => x * x * x;
const smooth = (x) => x * x * (3 - 2 * x);
// Seconds since the tap of a pulse control that runs `secs`, or -1 at rest.
const since = (v, secs) => (v > 0 ? (1 - v) * secs : -1);
// A damped wobble that starts at s = 0 and dies away over `len` seconds.
const wobble = (s, len, freq = 14) =>
  s <= 0 || s >= len ? 0 : Math.sin(s * freq) * (1 - s / len) ** 2;
const lerp3 = (a, b, t) => [
  a[0] + (b[0] - a[0]) * t,
  a[1] + (b[1] - a[1]) * t,
  a[2] + (b[2] - a[2]) * t,
];
const IDQ = [0, 0, 0, 1];
// Spherical blend of two rotations.
function slerpQ(a, b, t) {
  let d = a[0] * b[0] + a[1] * b[1] + a[2] * b[2] + a[3] * b[3];
  const s = d < 0 ? -1 : 1;
  d *= s;
  if (d > 0.9995) {
    const q = a.map((x, i) => x + (s * b[i] - x) * t);
    const l = Math.hypot(...q);
    return q.map((x) => x / l);
  }
  const th = Math.acos(d);
  const wa = Math.sin((1 - t) * th) / Math.sin(th);
  const wb = (s * Math.sin(t * th)) / Math.sin(th);
  return a.map((x, i) => wa * x + wb * b[i]);
}
// Per-toy memory for drive() (keyed by the controls object, new each time a
// toy loads), for sounds that play as the effect passes a moment.
const MEM = new WeakMap();
function mem(c) {
  let m = MEM.get(c);
  if (!m) MEM.set(c, (m = {}));
  return m;
}
// Pushes each [at, spec] sound whose moment the effect clock s (seconds, -1
// at rest) has just passed.
function cuesAt(c, key, s, list, out) {
  const m = mem(c);
  const was = m[key] ?? -1;
  m[key] = s;
  if (s < 0 || s < was) return;
  for (const [at, spec] of list) if (was < at && s >= at) out.cues.push(spec);
}
// A ball dropped at s = 0 from `h` above the floor with upward speed `v0`,
// bouncing with restitution `e` under gravity `g`: its height above the
// floor, and how many times it has landed.
function bounce(s, h, v0 = 0, g = 12, e = 0.4) {
  let y = h;
  let v = v0;
  let t = s;
  let n = 0;
  for (let i = 0; i < 6 && t > 0; i++) {
    // Time to reach the floor from height y with upward speed v.
    const land = (v + Math.sqrt(v * v + 2 * g * y)) / g;
    if (t < land) return { y: y + v * t - 0.5 * g * t * t, n };
    t -= land;
    n++;
    v = e * (g * land - v);
    y = 0;
    if (v < 0.25) return { y: 0, n };
  }
  return { y: 0, n };
}
// Time of the n-th landing of bounce(…) (for sounds).
function landings(h, v0 = 0, g = 12, e = 0.4, max = 3) {
  const out = [];
  let y = h;
  let v = v0;
  let t = 0;
  for (let i = 0; i < max; i++) {
    const land = (v + Math.sqrt(v * v + 2 * g * y)) / g;
    t += land;
    out.push(t);
    v = e * (g * land - v);
    y = 0;
    if (v < 0.25) break;
  }
  return out;
}
// A hop from a to b over f = 0..1, peaking `h` above the higher end.
function hopTo(a, b, f, h) {
  const p = lerp3(a, b, f);
  p[1] += (Math.max(a[1], b[1]) - (a[1] + b[1]) / 2 + h) * hop(f);
  return p;
}

// ---- Ice cream ---------------------------------------------------------------------

// How many rings the coffee's surface is cut into (each a part).
const COFFEE_RINGS = 12;
const ICE_RIM = 1.15; // height of the cone's rim above its tip
const ICE_MELT = 0.48; // how easily the scoops melt (the melt behaviour's a)

const FLAVOURS = {
  strawberry: { label: "Strawberry", base: "#f6a8ba", deep: "#e57d97", bits: "#c7304f", bit: 0.5 },
  vanilla: { label: "Vanilla", base: "#fbf0cf", deep: "#eedcaa", bits: "#3d2a1c", bit: 0.66 },
  chocolate: { label: "Chocolate", base: "#7b4a2d", deep: "#5b331d", bits: "#3a1f10", bit: 0.6 },
  mint: { label: "Mint choc chip", base: "#bff0dc", deep: "#93d9bf", bits: "#3a2317", bit: 0.44 },
  pistachio: { label: "Pistachio", base: "#d3e6a4", deep: "#b3cc7e", bits: "#7a9a36", bit: 0.5 },
  blueberry: { label: "Blueberry", base: "#baa6e4", deep: "#9681cb", bits: "#4a2b7c", bit: 0.5 },
  lemon: { label: "Lemon", base: "#fcec94", deep: "#f2d661", bits: "#fff9d9", bit: 0.62 },
  cookies: {
    label: "Cookies & cream",
    base: "#f3efe8",
    deep: "#ddd6cb",
    bits: "#2b2522",
    bit: 0.42,
  },
};
// Parsed once, so colour functions do not re-read hex strings per splat.
for (const f of Object.values(FLAVOURS))
  for (const key of ["base", "deep", "bits"]) f[key] = rgb(f[key]);
const flavourChoices = () => Object.entries(FLAVOURS).map(([id, f]) => ({ id, label: f.label }));

function scoopColor(f, seed) {
  return (c) => {
    const [x, y, z] = c.lp;
    const d = unit(c.lp);
    let col = mix(f.base, f.deep, 0.3 + 0.3 * c.fbm(x * 5 + seed, y * 5, z * 5, 2));
    if (c.noise(x * 20 + seed, y * 20, z * 20) > f.bit) col = f.bits;
    col = lit(c, col, 0.8, 0.3);
    // The ruffled lip where the scoop was pressed: its underside is in shade.
    col = shade(col, 1 - 0.3 * smoothstep(-0.22, -0.46, d[1]));
    return mix(col, WHITE, 0.16 * spec(c, 14));
  };
}

function scoopShape(k, R, seed) {
  const radius = tabulate(
    (d) => {
      const ang = Math.atan2(d[0], d[2]);
      const lipY = -0.3;
      const lip =
        Math.exp(-(((d[1] - lipY) / 0.1) ** 2)) *
        (0.11 + 0.04 * Math.sin(ang * 9 + seed) + 0.025 * Math.sin(ang * 4 + seed * 2));
      const lumps = 0.035 * k.noise(d[0] * 2.4 + seed, d[1] * 2.4, d[2] * 2.4);
      let r = 1 + lip + lumps;
      if (d[1] < lipY - 0.1) r *= 1 - 0.38 * smoothstep(lipY - 0.1, -1, d[1]);
      return R * r;
    },
    120,
    90,
  );
  return k.radial(radius, { grid: 72 });
}

// ---- Watermelon --------------------------------------------------------------------

const MELON = {
  dark: "#2d6a2b",
  light: "#93c45d",
  pith: "#eef4cf",
  flesh: "#f0404f",
  deep: "#d9283f",
  seed: "#1a1210",
};

function melonSkin(c, theta, along) {
  const n = c.fbm(c.p[0] * 2.2, c.p[1] * 2.2, c.p[2] * 2.2, 3);
  const s = Math.sin(theta * 8 + n * 2.2 + 0.4 * Math.sin(along * 7));
  const jag = 0.35 * c.noise(c.p[0] * 11, c.p[1] * 11, c.p[2] * 11);
  let col = s + jag > -0.1 ? MELON.dark : MELON.light;
  col = mix(col, shade(col, 0.8), 0.5 + 0.5 * c.noise(c.p[0] * 30, c.p[1] * 30, c.p[2] * 30));
  return glossy(c, col, 0.35, 18, 0.72, 0.4);
}

// Flesh colour at relative radius rho (0 centre, 1 skin).
function melonFlesh(rho, c) {
  if (rho > 0.965) return MELON.dark;
  if (rho > 0.9) return mix(MELON.pith, "#b8dc86", smoothstep(0.92, 0.965, rho));
  if (rho > 0.84) return mix("#f8a2a6", MELON.pith, smoothstep(0.84, 0.9, rho));
  const grain = 0.08 * c.noise(c.p[0] * 25, c.p[1] * 25, c.p[2] * 25);
  return shade(mix(MELON.deep, MELON.flesh, smoothstep(0, 0.8, rho)), 1 + grain);
}

// The cherries' swing (E5): two pendulums hung from one joint that touch
// at rest, played once at load. A tap flicks them apart; each swings on
// its own stem, and when they meet they knock and bounce apart again.
const CHERRY_SECS = 3.6;
// The macarons: which one hops onto the stack when, and when it hops back
// down; the two in front keep their turn about the vertical as they go.
const MAC_HOPS = [
  [3, 0.1, 2.9],
  [4, 0.75, 2.25],
];
const MAC_YAW = { 3: 20, 4: 60 };
const MAC_SECS = 3.55;
// The cupcake: when the cherry leaves, how long it flies and how high, how
// far the frosting squashes and how far down that brings its top.
const CUP_LAUNCH = 0.14;
const CUP_FLIGHT = 0.78;
const CUP_HIGH = 0.8;
const CUP_SQUASH = 0.22;
const CUP_TOP = 0.76 * CUP_SQUASH;
const CUP_SECS = 2.3;
// The lollipop's whirl: up to speed by LOLLY_RAMP[0] s, full speed until
// [1], slowing to a stop at [2], for a whole number of extra turns.
const LOLLY_RAMP = [0.45, 1.7, 3.0];
const LOLLY_TURNS = 6;
const LOLLY_SECS = 3.05;
// The candy canes: how far the hook turns in the twist, when each snaps
// and mends (seconds after it starts), and how far behind the second is.
const CANE_TWIST = 1.1;
const CANE_SNAP = 0.8;
const CANE_JOIN = 2.35;
const CANE_LAG = 0.16;
const CANE_SECS = 2.85;
const PRETZEL_SECS = 3.3;
// The croissant: the oven dings when it has risen; the flakes hop home.
const CRO_DING = 1.2;
const CRO_BACK = 2.45;
const CRO_SECS = 3.4;
// The taco: how far each half swings open, and when the bits hop back.
const TACO_TURN = 0.8;
const TACO_BACK = 1.85;
const TACO_SECS = 3.1;
// The sushi: the chopsticks are up by lift, pinch the roll at grab, let
// it go at drop and lie back down by lay.
const SUSHI_T = { lift: 0.55, grab: 0.95, drop: 3.65, lay: 4.15 };
const SUSHI_SECS = 4.7;
const ORANGE_SECS = 3.0;
// The kiwi: its long axis at right angles to the view, and how far each
// half turns to show its face.
const KIWI_YAW = 121.5;
const KIWI_TURN = 1.1;
const KIWI_SECS = 2.8;
const PINE_RINGS = 5;
const PINE_GAP = 0.16;
const PINE_SECS = 3.0;
// The watermelon: the whole one's turn, when the knife chops (first chop
// and the time between chops) and when the slices fan out.
const WM_YAW = -20;
const WM_CHOP0 = 0.1;
const WM_CHOP = 0.24;
const WM_FAN = 1.35;
const WM_SECS = 3.6;
const APPLE_SECS = 2.9;
// The banana: where its peel splits (along the banana, from its neck), and
// how far each strip's two pieces bend back.
const BANANA_HINGE = 0.42;
const BANANA_BEND = [1.25, 0.9];
const BANANA_SECS = 3.1;
// The avocado's stone flies over and back.
const AVO_SECS = 3.1;
const mix1 = (a, b, t) => a + (b - a) * t;
// The grapes: when the fallen grapes start to hop home, and the effect's length.
const GRAPE_BACK = 2.1;
const GRAPE_SECS = 3.9;
const CHERRY_SIM = (() => {
  const dt = 1 / 240;
  const w = TAU / 1.05;
  const damp = 1.2;
  let a = [0, 0];
  let v = [-3.2, 1.6];
  const frames = [];
  const hits = [];
  for (let i = 0; i * dt <= CHERRY_SECS + dt; i++) {
    frames.push([a[0], a[1]]);
    for (let j = 0; j < 2; j++) {
      v[j] += (-w * w * Math.sin(a[j]) - damp * v[j]) * dt;
      a[j] += v[j] * dt;
    }
    // The left one cannot swing right past the right one.
    if (a[0] > a[1] && v[0] > v[1]) {
      const m = (v[0] + v[1]) / 2;
      const d = ((v[0] - v[1]) / 2) * 0.8;
      if (d > 0.12) hits.push({ t: i * dt, v: d });
      v = [m - d, m + d];
      a = [(a[0] + a[1]) / 2, (a[0] + a[1]) / 2];
    }
  }
  return { dt, frames, hits };
})();

// ---- Recipes -------------------------------------------------------------------------

export const RECIPES = {
  "ice-cream": {
    alive: true,
    options: [
      { key: "scoops", label: "Scoops", type: "slider", min: 1, max: 3, step: 1, default: 2 },
      {
        key: "f1",
        label: "First scoop",
        type: "select",
        default: "mint",
        choices: flavourChoices(),
      },
      {
        key: "f2",
        label: "Second scoop",
        type: "select",
        default: "strawberry",
        choices: flavourChoices(),
      },
      {
        key: "f3",
        label: "Third scoop",
        type: "select",
        default: "chocolate",
        choices: flavourChoices(),
      },
      { key: "sprinkles", label: "Sprinkles", type: "switch", default: true },
      { key: "cherry", label: "Cherry", type: "switch", default: true },
    ],
    controls: [
      { key: "warmth", label: "Warmth", type: "slider", default: 0 },
      { key: "thaw", label: "Melt", type: "pulse", ease: 5 },
    ],
    action: { key: "thaw", label: "Melt and refreeze" },
    drive(t, c, out) {
      // A tap warms it up quickly, so the scoops slump and drips run down the
      // cone, holds for a moment, then it refreezes.
      const p = c.thaw > 0 ? 1 - c.thaw : 1;
      const warm = 1 - Math.pow(1 - clamp(p / 0.28, 0, 1), 2);
      const tap = c.thaw > 0 ? 0.85 * warm * (1 - smoothstep(0.55, 0.95, p)) : 0;
      const w = Math.max(c.warmth, tap);
      out.energy = w;
      out.grow = w;
      // Melt slumps everything towards the floor (the cone's tip), so the
      // scoops rise by what the rim would sink: they flatten onto the cone
      // and ooze over its edge instead of sinking through it.
      out.parts.scoops = { offset: [0, ICE_RIM * 0.895 * ICE_MELT * w, 0] };
    },
    build(k, o) {
      const H = ICE_RIM;
      const R = 0.47;
      const coneR = (y) => 0.025 + (R - 0.025) * (y / H);
      const flavours = [o.f1, o.f2, o.f3].map((f) => FLAVOURS[f] || FLAVOURS.vanilla);
      const n = clamp(Math.round(o.scoops), 1, 3);
      // The waffle cone: a diamond lattice of grooves on a toasted cone.
      k.add(k.cone(0.025, R, H, { caps: false }), {
        pos: [0, H / 2, 0],
        flat: 0.22,
        interior: 0.08,
        core: flavours[0].deep,
        color: (c) => {
          const y = c.lp[1] + H / 2;
          const f1 = c.u * 11 + y * 5.2;
          const f2 = c.u * 11 - y * 5.2;
          const g = Math.min(Math.abs(f1 - Math.round(f1)), Math.abs(f2 - Math.round(f2)));
          let col = mix("#e4ad66", "#c98a44", 0.5 + 0.6 * c.noise(c.p[0] * 9, y * 9, c.p[2] * 9));
          if (g < 0.075) col = mix("#9a5a26", col, (g / 0.075) * 0.5);
          else col = shade(col, 0.96 + 0.16 * smoothstep(0.1, 0.45, g));
          return lit(c, col, 0.74, 0.38);
        },
      });
      // Its rolled rim.
      k.add(k.torus(R + 0.005, 0.045), {
        pos: [0, H, 0],
        flat: 0.25,
        weight: 1.5,
        color: (c) =>
          lit(c, mix("#eab676", "#c78a45", 0.5 + 0.5 * c.noise(c.p[0] * 30, 0, c.p[2] * 30))),
      });
      // Scoops stacked on the cone, each with a ruffled lip.
      const radii = [0.5, 0.46, 0.42];
      const scoops = k.part("scoops", { pivot: [0, H, 0] });
      const melt = (c) => [ICE_MELT + 0.2 * c.noise(c.p[0] * 3, c.p[1] * 3, c.p[2] * 3), 0];
      let y = H + 0.2;
      let top = null;
      for (let i = 0; i < n; i++) {
        const r = radii[i];
        const seed = 3 + i * 7.3;
        const shape = scoopShape(k, r, seed);
        const pos = [0.015 * (i % 2 ? 1 : -1), y, 0];
        k.add(shape, {
          pos,
          rot: [0, i * 47, 0],
          flat: 0.3,
          interior: 0.1,
          core: flavours[i].base,
          part: scoops,
          kind: "melt",
          params: melt,
          color: scoopColor(flavours[i], seed),
        });
        top = { pos, r };
        y += r * 1.28;
      }
      const tipY = top.pos[1] + top.r * 1.02;
      if (o.sprinkles) {
        sprinkles(
          k,
          0.018,
          (rand) => {
            const d = randDir(rand);
            if (d[1] < 0.15) return null;
            return { p: add(top.pos, mul(d, top.r * 1.04)), n: d };
          },
          { kind: "melt", params: [ICE_MELT + 0.05, 0], part: scoops },
        );
      }
      if (o.cherry) {
        const cp = [top.pos[0], tipY + 0.09, top.pos[2]];
        k.add(k.sphere(0.12), {
          pos: cp,
          scale: [1, 0.92, 1],
          flat: 0.25,
          weight: 2.5,
          pattern: false,
          part: scoops,
          kind: "melt",
          params: [ICE_MELT + 0.05, 0],
          color: (c) =>
            glossy(c, mix("#d0102a", "#8e0718", smoothstep(0.3, -0.8, c.n[1])), 0.9, 36),
        });
        k.add(
          k.tube(
            spline([add(cp, [0, 0.09, 0]), add(cp, [0.03, 0.2, 0.01]), add(cp, [0.1, 0.29, 0.02])]),
            0.014,
          ),
          {
            flat: 0.3,
            weight: 3,
            pattern: false,
            part: scoops,
            kind: "melt",
            params: [ICE_MELT + 0.05, 0],
            color: (c) => lit(c, "#6b8a2a"),
          },
        );
      }
      // A melted collar round the rim and drips that run down the cone as it
      // warms (they grow in with Warmth).
      const drip = (c) => glossy(c, flavours[0].base, 0.5, 20, 0.78, 0.3);
      const ph = k.rand() * TAU;
      k.add(
        k.param(
          (u, v) => {
            const a = u * TAU;
            const depth = 0.13 + 0.05 * Math.sin(a * 5 + ph) + 0.03 * Math.sin(a * 11);
            const yy = H + 0.03 - v * depth;
            const rr = coneR(yy) + 0.018;
            return [rr * Math.sin(a), yy, rr * Math.cos(a)];
          },
          { grid: 48 },
        ),
        {
          flat: 0.3,
          weight: 1.5,
          kind: "grow",
          params: (c) => [0.04 + 0.3 * c.v, 0],
          color: drip,
        },
      );
      const drips = 11;
      for (let i = 0; i < drips; i++) {
        const a0 = (i / drips) * TAU + k.rand() * 0.4;
        const L = 0.25 + k.rand() * 0.55;
        const y0 = H - 0.06;
        const curve = (t) => {
          const yy = y0 - L * t;
          const a = a0 + 0.06 * Math.sin(t * 5 + i);
          const rr = coneR(yy) + 0.02;
          return [rr * Math.sin(a), yy, rr * Math.cos(a)];
        };
        k.add(
          k.tube(curve, (t) => 0.03 + 0.022 * smoothstep(0.7, 0.97, t) * (1 - t * 0.3), {
            caps: true,
            samples: 64,
            grid: 24,
          }),
          {
            flat: 0.3,
            weight: 2,
            kind: "grow",
            params: (c) => [0.15 + 0.8 * (c.t ?? 0) * (L / 0.8), 0],
            color: drip,
          },
        );
      }
    },
  },

  watermelon: {
    options: [
      {
        key: "style",
        label: "Style",
        type: "select",
        default: "slice",
        choices: [
          { id: "slice", label: "Melon and wedge" },
          { id: "whole", label: "Whole" },
          { id: "wedge", label: "Wedge" },
        ],
      },
    ],
    controls: [{ key: "chop", label: "Chop into slices", type: "pulse", ease: WM_SECS }],
    action: { key: "chop", label: "Chop into slices" },
    // A tap brings down a big knife: it chops the whole melon five times,
    // right to left. Then the six slices fan open on their bottoms like an
    // accordion, showing the red flesh, the pale rind and the black seeds on
    // their cut faces, and fold shut again. (A lone wedge just rocks.)
    drive(t, c, out, info) {
      const s = since(c.chop, WM_SECS);
      const d = info.data;
      if (!d) return;
      const on = s >= 0;
      const fan = on ? easeOut(band(s, WM_FAN, WM_FAN + 0.5)) * (1 - smooth(band(s, 2.8, 3.4))) : 0;
      const n = d.slices.length;
      out.tokens = d.slices.map((sl, i) => {
        const f = (i - (n - 1) / 2) / ((n - 1) / 2);
        const settle = on ? 0.05 * wobble(s - WM_FAN - 0.5, 0.6, 13) * f : 0;
        const q = quatAxisAngle(d.hinge, -f * 0.75 * fan - settle);
        return { base: sl.foot, quat: q, offset: mul(d.axis, f * 0.18 * fan) };
      });
      // The knife: one copy per cut (each drawn in its own place), shown in
      // turn as it chops.
      d.knives.forEach((kn, i) => {
        const t0 = WM_CHOP0 + WM_CHOP * i;
        const u = on ? s - t0 : -1;
        const down = u < 0 ? 0 : u < 0.1 ? easeIn(u / 0.1) : u < 0.14 ? 1 : 1 - smooth((u - 0.14) / 0.1); // prettier-ignore
        // One knife at a time: each shows from its own chop until the next.
        const last = i === d.knives.length - 1;
        const shown = on && u >= (i ? 0 : -0.06) && (last ? u < 0.4 : u < WM_CHOP);
        const up = i === d.knives.length - 1 && u > 0.24 ? 0.6 * smooth(band(u, 0.24, 0.4)) : 0;
        out.parts[`knife${i}`] = {
          offset: [0, (1 - down) * kn.lift + up, 0],
          visible: shown ? 1 : 0,
        };
      });
      out.parts.wedge = { quat: quatAxisAngle([1, 0, 0], d.slices.length ? 0 : 0.1 * wobble(s, 1.2, 9)) }; // prettier-ignore
      const list = d.knives.map((kn, i) => [WM_CHOP0 + WM_CHOP * i + 0.09, [{ voice: "slap", f: 800 + 60 * i, vol: 0.8 }, { voice: "crack", f: 1200, bright: 0.2, decay: 0.7, vol: 0.4 }]]); // prettier-ignore
      if (d.slices.length) list.push([WM_FAN + 0.05, { voice: "squish", pitch: 1.1, bright: 0.7, decay: 1.2 }]); // prettier-ignore
      cuesAt(c, "watermelon", s, list, out);
    },
    build(k, o) {
      // Seeds: one teardrop per cell of a grid, in a band of the flesh.
      const seedAt = (p, rho) => {
        if (rho < 0.35 || rho > 0.74) return false;
        const S = 0.16;
        const ix = Math.floor(p[0] / S);
        const iy = Math.floor(p[1] / S);
        const iz = Math.floor(p[2] / S);
        if (hash3(ix, iy, iz) > 0.55) return false;
        const sc = [
          (ix + 0.3 + 0.4 * hash3(iy, iz, ix)) * S,
          (iy + 0.3 + 0.4 * hash3(iz, ix, iy)) * S,
          (iz + 0.3 + 0.4 * hash3(ix + 7, iy, iz)) * S,
        ];
        const dp = sub(p, sc);
        const r = unit(sc);
        const along = dot(dp, r);
        const perp = len(sub(dp, mul(r, along)));
        return (along / 0.05) ** 2 + (perp / 0.028) ** 2 < 1;
      };
      // The whole melon is six slices (pieces) across its length, each its
      // band of rind and its cut faces; a knife (one copy per cut) chops it.
      const slices = [];
      const knives = [];
      let hinge = [0, 0, 1];
      let axis = [1, 0, 0];
      const whole = (pos, yaw) => {
        const A = 1.2;
        const B = 0.92;
        const q = quatEuler(0, yaw, 0);
        const qi = [-q[0], -q[1], -q[2], q[3]];
        const local = (p) => quatRotate(qi, sub(p, pos));
        hinge = quatRotate(q, [0, 0, 1]);
        axis = quatRotate(q, [1, 0, 0]);
        const n = 6;
        const xs = [];
        for (let i = 0; i <= n; i++) xs.push(-A + (2 * A * i) / n);
        const rAt = (x) => B * Math.sqrt(Math.max(0, 1 - (x / A) ** 2));
        const flesh = (c) => {
          const lp = local(c.p);
          const rho = Math.hypot(lp[0] / A, lp[1] / B, lp[2] / B);
          if (seedAt(lp, rho)) return keep(MELON.seed);
          const col = melonFlesh(rho, c);
          return c.noise(c.p[0] * 40, c.p[1] * 40, c.p[2] * 40) > 0.55 ? mix(col, "#ffffff", 0.3) : col; // prettier-ignore
        };
        for (let i = 0; i < n; i++) {
          const token = slices.length;
          const piece = { kind: "token", params: [token, 0] };
          const [x0, x1] = [xs[i], xs[i + 1]];
          slices.push({ foot: add(pos, quatRotate(q, [(x0 + x1) / 2, -B * 0.98, 0])) });
          k.add(
            k.param(
              (u, v) => {
                const x = x0 + u * (x1 - x0);
                const r = rAt(x);
                const th = v * TAU;
                return [x, r * Math.cos(th), r * Math.sin(th)];
              },
              {
                grid: 40,
                normal: (u, v) => {
                  const x = x0 + u * (x1 - x0);
                  const r = rAt(x);
                  const th = v * TAU;
                  return unit([x / (A * A), (r * Math.cos(th)) / (B * B), (r * Math.sin(th)) / (B * B)]); // prettier-ignore
                },
              },
            ),
            {
              pos,
              quat: q,
              flat: 0.2,
              ...piece,
              color: (c) => {
                const [x, y, z] = c.lp;
                let col = melonSkin(c, Math.atan2(z, y), x);
                col = mix(col, "#d8d27c", 0.7 * smoothstep(-0.7, -0.95, c.ln[1]));
                if (x > A * 0.97) col = mix(col, "#6b5a2a", smoothstep(0.97, 0.995, x / A));
                return col;
              },
            },
          );
          for (const [x, sgn] of [
            [x0, -1],
            [x1, 1],
          ]) {
            if ((i === 0 && sgn < 0) || (i === n - 1 && sgn > 0)) continue;
            const r = rAt(x) * 0.995;
            k.add(
              k.param(
                (u, v) => {
                  const a = u * TAU;
                  return [x, Math.cos(a) * v * r, Math.sin(a) * v * r];
                },
                { grid: 40, normal: () => [sgn, 0, 0] },
              ),
              { pos, quat: q, flat: 0.15, weight: 1.3, ...piece, color: flesh },
            );
          }
        }
        // The knife: a steel blade across the melon with a dark handle
        // towards you, built down in each cut and lifted clear at rest.
        const lift = B * 2 + 0.12;
        const H = 0.5;
        for (let i = 0; i < n - 1; i++) {
          const x = xs[n - 1 - i];
          const part = k.part(`knife${i}`, { pivot: add(pos, quatRotate(q, [x, 0, 0])) });
          knives.push({ lift });
          k.add(
            k.param((u, v) => [x, -B + v * H, (u - 0.5) * 1.95], {
              grid: 24,
              normal: () => [1, 0, 0],
            }),
            {
              pos,
              quat: q,
              part,
              share: 0.02,
              flat: 0.3,
              size: 1.3,
              jitter: 0.005,
              opacity: 1,
              pattern: false,
              fit: false,
              // Brushed steel, bright along the edge and the spine.
              color: (c) => {
                const h = c.v;
                const col = h < 0.1 ? "#eef1f4" : h > 0.94 ? "#b8bec6" : mix("#aeb4bc", "#d5d9de", 0.5 + 0.5 * Math.sin(c.u * 9)); // prettier-ignore
                return keep(col);
              },
            },
          );
          k.add(k.cylinder(0.055, 0.45), {
            pos: add(pos, quatRotate(q, [x, -B + H * 0.75, 1.2])),
            quat: quatMul(q, quatEuler(90, 0, 0)),
            part,
            share: 0.002,
            flat: 0.3,
            pattern: false,
            fit: false,
            color: (c) => keep(lit(c, mix("#3a2418", "#24160e", c.rand()), 0.8, 0.35)),
          });
        }
        // (No reach for the raised knife: it may pass the frame's top for a
        // moment rather than shrink the melon at rest.)
      };
      // A wedge cut from a round slice: apex up, rind at the bottom.
      const wedge = (pos, yaw, R, T, span = 1.05) => {
        const a0 = -span / 2;
        const q = quatEuler(0, yaw, 0);
        const place = { pos, quat: q, part: k.part("wedge", { pivot: add(pos, [0, -R, 0]) }) };
        const rows = [
          [0.5, 4, 0.1],
          [0.66, 5, 0.0],
        ];
        const seed = (rho, a) => {
          for (const [rr, cnt, off] of rows) {
            const dr = (rho - rr) * R;
            if (Math.abs(dr) > 0.06) continue;
            const step = span / cnt;
            const j = Math.round((a - a0) / step - 0.5 - off);
            const aj = a0 + (j + 0.5 + off) * step;
            const dt = (a - aj) * rho * R;
            const w = 0.022 * (1 - 0.45 * clamp(dr / 0.045, -1, 1));
            if ((dr / 0.045) ** 2 + (dt / w) ** 2 < 1) return true;
          }
          return false;
        };
        const face = (rho, a, c) => {
          if (seed(rho, a)) return keep(mix(MELON.seed, "#4a3326", 0.3 * c.rand()));
          const col = melonFlesh(rho, c);
          // Juicy glints on the cut face.
          return c.noise(c.p[0] * 40, c.p[1] * 40, c.p[2] * 40) > 0.55
            ? mix(col, "#ffffff", 0.3)
            : col;
        };
        for (const side of [1, -1]) {
          k.add(
            k.param(
              (u, v) => {
                const a = a0 + u * span;
                return [v * R * Math.sin(a), -v * R * Math.cos(a), (side * T) / 2];
              },
              { grid: 48, normal: () => [0, 0, side], thick: T },
            ),
            {
              ...place,
              flat: 0.15,
              interior: side > 0 ? 0.12 : 0,
              core: (c) => melonFlesh(c.v, c),
              color: (c) => face(c.v, a0 + c.u * span, c),
            },
          );
        }
        // The rind along the arc, striped like the whole melon.
        k.add(
          k.param(
            (u, v) => {
              const a = a0 + u * span;
              return [R * Math.sin(a), -R * Math.cos(a), (v - 0.5) * T];
            },
            { grid: 48, normal: (u) => [Math.sin(a0 + u * span), -Math.cos(a0 + u * span), 0] },
          ),
          { ...place, flat: 0.2, color: (c) => melonSkin(c, (a0 + c.u * span) * 1.6, 0) },
        );
        // The two cut sides.
        for (const [a, s] of [
          [a0, -1],
          [-a0, 1],
        ]) {
          k.add(
            k.param((u, v) => [u * R * Math.sin(a), -u * R * Math.cos(a), (v - 0.5) * T], {
              grid: 32,
              normal: () => [s * Math.cos(a), s * Math.sin(a), 0],
            }),
            { ...place, flat: 0.15, color: (c) => melonFlesh(c.u, c) },
          );
        }
      };
      // The whole melon lies at an angle, so its cut faces turn towards you.
      if (o.style === "whole") whole([0, 0, 0], WM_YAW);
      else if (o.style === "wedge") wedge([0, 0.3, 0], 28, 1.1, 0.34);
      else {
        whole([-0.45, 0, -0.6], WM_YAW);
        wedge([0.72, -0.92 + 0.78, 0.6], 30, 0.78, 0.26);
      }
      k.data = { slices, knives, hinge, axis };
    },
  },

  "birthday-cake": {
    alive: true,
    options: [
      { key: "frosting", label: "Frosting", type: "color", default: "#f7a9c4" },
      { key: "drip", label: "Drip", type: "color", default: "#5a2e1a" },
      {
        key: "sponge",
        label: "Sponge",
        type: "select",
        default: "vanilla",
        choices: [
          { id: "vanilla", label: "Vanilla" },
          { id: "chocolate", label: "Chocolate" },
          { id: "velvet", label: "Red velvet" },
          { id: "strawberry", label: "Strawberry" },
        ],
      },
      { key: "candles", label: "Candles", type: "slider", min: 1, max: 9, step: 1, default: 5 },
    ],
    controls: [{ key: "out", label: "Blown out", type: "toggle", default: 0, ease: 0.6 }],
    action: { key: "out", label: "Blow out" },
    drive(t, c, out) {
      out.parts.flames = { visible: 1 - smoothstep(0, 0.55, c.out) };
      out.parts.smoke = { visible: smoothstep(0.25, 1, c.out) };
    },
    build(k, o) {
      const R = 0.8;
      const H = 0.7;
      const sponge = {
        vanilla: "#f3d28c",
        chocolate: "#5e3522",
        velvet: "#a8232f",
        strawberry: "#f6b3b8",
      }[o.sponge];
      // Cake stand: a plate on a pedestal.
      k.add(
        revolve(k, [
          [0.42, -0.5],
          [0.4, -0.47],
          [0.16, -0.42],
          [0.1, -0.3],
          [0.1, -0.14],
          [0.2, -0.08],
          [0.9, -0.05],
          [1.02, -0.02],
          [1.04, 0],
          [0.9, 0.0],
          [0, 0.0],
        ]),
        {
          flat: 0.2,
          color: (c) => glossy(c, "#f3f1ee", 0.8, 50, 0.76, 0.3),
        },
      );
      // Drips of ganache from the top edge.
      const drips = [];
      for (let i = 0; i < 17; i++) {
        drips.push({
          a: (i / 17) * TAU + (k.rand() - 0.5) * 0.2,
          L: 0.1 + k.rand() * 0.28,
          w: 0.035 + k.rand() * 0.02,
        });
      }
      const dripAt = (a, y) => {
        const d = H - y;
        if (d < 0.07) return true;
        for (const dr of drips) {
          let da = Math.abs(a - dr.a);
          da = Math.min(da, TAU - da) * R;
          if (da > dr.w) continue;
          const end = dr.L - dr.w + Math.sqrt(Math.max(0, dr.w * dr.w - da * da));
          if (d < end) return true;
        }
        return false;
      };
      k.add(k.cylinder(R, H), {
        pos: [0, H / 2, 0],
        flat: 0.2,
        interior: 0.12,
        color: (c) => {
          const y = c.lp[1] + H / 2;
          if (c.s.cap === "top") return glossy(c, o.drip, 0.6, 30);
          if (c.s.cap) return o.frosting;
          const a = c.u * TAU;
          if (dripAt(a, y)) return glossy(c, o.drip, 0.8, 30, 0.8, 0.3);
          const swirl = 0.04 * Math.sin(y * 60 + 2 * c.noise(a * 3, y * 4, 0));
          return lit(c, shade(o.frosting, 1 + swirl), 0.76, 0.34);
        },
        core: (c) => {
          const y = c.p[1];
          const r = Math.hypot(c.p[0], c.p[2]);
          if (r > R * 0.94) return o.frosting;
          if (y > H - 0.04) return o.drip;
          for (const ly of [0.24, 0.47]) {
            if (Math.abs(y - ly) < 0.012) return "#d6344d";
            if (Math.abs(y - ly) < 0.035) return "#fff4e4";
          }
          return shade(sponge, 0.92 + 0.14 * c.noise(c.p[0] * 30, y * 30, c.p[2] * 30));
        },
      });
      // Whipped rosettes around the top edge.
      const rosette = revolve(
        k,
        [
          [0.1, 0],
          [0.105, 0.03],
          [0.075, 0.075],
          [0.035, 0.11],
          [0, 0.125],
        ],
        (a, y) => 1 + 0.2 * Math.cos(a * 8 + y * 30),
        { grid: 40 },
      );
      const ros = 14;
      for (let i = 0; i < ros; i++) {
        const a = (i / ros) * TAU;
        k.add(rosette, {
          pos: [Math.sin(a) * (R - 0.1), H - 0.005, Math.cos(a) * (R - 0.1)],
          rot: [0, i * 23, 0],
          flat: 0.3,
          weight: 1.6,
          color: (c) => lit(c, "#fff8f0", 0.8, 0.3),
        });
      }
      // A beaded border at the foot.
      k.add(
        k.tube(
          (t) => [Math.sin(t * TAU) * (R + 0.01), 0.04, Math.cos(t * TAU) * (R + 0.01)],
          (t) => 0.035 + 0.018 * Math.abs(Math.sin(t * Math.PI * 34)),
          { closed: true },
        ),
        { flat: 0.3, weight: 1.4, color: (c) => lit(c, "#fff8f0", 0.8, 0.3) },
      );
      // Sprinkles on the top.
      sprinkles(k, 0.02, (rand) => {
        const a = rand() * TAU;
        const r = (R - 0.2) * Math.sqrt(rand());
        return { p: [Math.sin(a) * r, H, Math.cos(a) * r], n: [0, 1, 0] };
      });
      // Candles, with flames on one part and smoke on another.
      const flames = k.part("flames");
      const smoke = k.part("smoke");
      const n = clamp(Math.round(o.candles), 1, 9);
      const colours = ["#6ec6ff", "#ffd23f", "#ff7eb6", "#8be38b", "#b28dff"];
      const ch = 0.3;
      for (let i = 0; i < n; i++) {
        const a = (i / n) * TAU + 0.4;
        const rr = n === 1 ? 0 : n <= 4 ? 0.3 : 0.4;
        const x = Math.sin(a) * rr;
        const z = Math.cos(a) * rr;
        const stripe = colours[i % colours.length];
        k.add(k.cylinder(0.032, ch), {
          pos: [x, H + ch / 2, z],
          flat: 0.3,
          weight: 2.5,
          color: (c) => {
            const f = (c.u * 2 + (c.lp[1] + ch / 2) * 9) % 1;
            return lit(c, f < 0.45 ? stripe : "#fffdf6", 0.8, 0.35);
          },
        });
        const wick = [x, H + ch + 0.02, z];
        k.add(k.cylinder(0.007, 0.04), {
          pos: wick,
          weight: 3,
          pattern: false,
          color: "#2a211c",
        });
        k.cloud({ share: 0.012, size: 0.75, pattern: false, part: flames }, (rand) => {
          const hot = rand();
          const r = 0.022 * Math.sqrt(rand()) * (1 - 0.5 * hot);
          const aa = rand() * TAU;
          return {
            p: [
              wick[0] + Math.sin(aa) * r,
              wick[1] + 0.01 + rand() * 0.02,
              wick[2] + Math.cos(aa) * r,
            ],
            color: mix("#ff9d2e", "#fff6c8", hot),
            opacity: 0.9,
            kind: "flame",
            params: [0.07 + 0.08 * hot, rand()],
          };
        });
        k.cloud({ share: 0.0025, size: 1.1, pattern: false, part: smoke }, (rand) => ({
          p: [wick[0] + (rand() - 0.5) * 0.02, wick[1] + 0.03, wick[2] + (rand() - 0.5) * 0.02],
          color: shade("#c9c4bf", 0.9 + rand() * 0.2),
          opacity: 0.1,
          kind: "rise",
          params: [0.55 + rand() * 0.2, rand()],
        }));
      }
      k.reach([0, H + ch + 0.3, 0]);
    },
  },

  popcorn: {
    alive: true,
    controls: [{ key: "pop", label: "Pop", type: "pulse", ease: 1.5 }],
    action: { key: "pop", label: "Pop!" },
    drive(t, c, out) {
      const p = 1 - c.pop;
      for (let j = 0; j < POPS.length; j++) {
        const k = POPS[j];
        // Idle: now and then a kernel hops.
        const q = (t / k.period + k.phase) % 1;
        let y = q < 0.12 ? 0.09 * hop(q / 0.12) : 0;
        let ang = 0;
        // Pop: every kernel jumps high and tumbles, one after another.
        const s = clamp((p - k.delay) / 0.5, 0, 1);
        if (s > 0 && s < 1) {
          y += k.height * hop(s);
          ang = k.spin * easeInOut(s) * TAU;
        }
        out.parts[`k${j}`] = { offset: [0, y, 0], quat: quatAxisAngle(k.axis, ang) };
      }
      out.body = { squash: p < 0.2 ? -0.05 * Math.sin((p / 0.2) * Math.PI) : 0 };
    },
    build(k) {
      const H = 1.1;
      const R0 = 0.5;
      const R1 = 0.7;
      // The striped paper bucket, with a star badge on the front.
      const badgeA = 0.09;
      const starDist = (x, y) => {
        const a = Math.atan2(x, y);
        const r = Math.hypot(x, y);
        const seg = TAU / 5;
        const f = Math.abs((((a % seg) + seg) % seg) - seg / 2) / (seg / 2);
        const edge = 0.1 + 0.11 * f * f;
        return r - edge;
      };
      k.add(k.cone(R0, R1, H, { caps: "bottom" }), {
        pos: [0, H / 2, 0],
        flat: 0.2,
        color: (c) => {
          const y = c.lp[1] + H / 2;
          if (c.s.cap) return "#c9c1b4";
          const u = (c.u + 1) % 1;
          const r = R0 + (R1 - R0) * (y / H);
          let du = u - badgeA;
          du -= Math.round(du);
          const sd = starDist(du * TAU * r, y - 0.55);
          if (sd < 0) return keep(lit(c, sd > -0.02 ? "#f08a1c" : "#ffd23f", 0.82, 0.3));
          const stripe = Math.floor(u * 16) % 2;
          const edge = Math.abs(((u * 16) % 1) - 0.5) > 0.47;
          let col = stripe ? "#d9252f" : "#fbf6ec";
          if (edge) col = shade(col, 0.9);
          if (y > H - 0.05) col = "#fbf6ec";
          return lit(
            c,
            shade(col, 0.95 + 0.05 * c.noise(c.p[0] * 12, y * 3, c.p[2] * 12)),
            0.72,
            0.4,
          );
        },
      });
      k.add(k.torus(R1, 0.02), {
        pos: [0, H, 0],
        flat: 0.3,
        weight: 2,
        color: (c) => lit(c, "#fbf6ec"),
      });
      // A buttery heap under the kernels, so gaps never show the inside.
      const heapTop = (r) => H + 0.05 + 0.42 * Math.max(0, 1 - (r / 0.82) ** 2);
      k.add(
        k.param(
          (u, v) => {
            const a = u * TAU;
            const r = v * 0.78;
            return [Math.sin(a) * r, heapTop(r) - 0.08, Math.cos(a) * r];
          },
          { grid: 40 },
        ),
        {
          flat: 0.4,
          size: 1.3,
          color: (c) =>
            shade("#f3dfa6", 0.75 + 0.2 * c.noise(c.p[0] * 12, c.p[1] * 12, c.p[2] * 12)),
        },
      );
      // Kernels: fluffy clusters of lobes, packed over the heap and spilled around.
      const kernels = [];
      const place = (p, r) => {
        for (const q of kernels) if (len(sub(p, q.p)) < (r + q.r) * 0.82) return false;
        const lobes = [];
        const m = 5 + Math.floor(k.rand() * 3);
        for (let j = 0; j < m; j++) {
          const d = randDir(k.rand);
          lobes.push({
            c: add(p, mul(d, r * (j ? 0.5 : 0.1))),
            r: r * (j ? 0.5 + k.rand() * 0.15 : 0.62),
          });
        }
        const hull = randDir(k.rand);
        kernels.push({ p, r, lobes, hull, tint: k.rand(), part: 0 });
        return true;
      };
      for (let i = 0; i < 4000 && kernels.length < 120; i++) {
        const a = k.rand() * TAU;
        const r = 0.84 * Math.sqrt(k.rand());
        const s = 0.085 + k.rand() * 0.03;
        const y = heapTop(r) - 0.02 - k.rand() * 0.09;
        place([Math.sin(a) * r, y, Math.cos(a) * r], s);
      }
      for (let i = 0; i < 400 && kernels.length < 128; i++) {
        const a = 0.2 + (k.rand() - 0.5) * 2.4;
        const r = 0.82 + k.rand() * 0.35;
        const s = 0.08 + k.rand() * 0.02;
        place([Math.sin(a) * r, s * 0.8, Math.cos(a) * r], s);
      }
      // The highest kernels are parts that pop.
      const order = kernels
        .map((q, i) => ({ i, y: q.p[1] + 0.05 * k.rand() }))
        .sort((a, b) => b.y - a.y);
      for (let j = 0; j < POPS.length; j++) {
        const q = kernels[order[j * 2].i];
        q.part = k.part(`k${j}`, { pivot: q.p });
      }
      // Kernels deeper in the heap are in shade.
      for (const q of kernels) {
        const top = heapTop(Math.hypot(q.p[0], q.p[2]));
        q.ao = q.p[1] < 0.5 ? 1 : 0.86 + 0.14 * smoothstep(top - 0.12, top - 0.02, q.p[1]);
      }
      const K = kernels.length;
      const areas = kernels.map((q) => {
        let s = 0;
        const acc = q.lobes.map((l) => (s += l.r * l.r));
        return { acc, s };
      });
      // A point on a kernel's outer skin (a few tries to miss the hidden
      // parts where lobes overlap).
      const onKernel = (rand, q, ar) => {
        for (let tries = 0; tries < 4; tries++) {
          const x = rand() * ar.s;
          let li = 0;
          while (li < q.lobes.length - 1 && ar.acc[li] < x) li++;
          const l = q.lobes[li];
          const d = randDir(rand);
          const p = add(l.c, mul(d, l.r));
          let hidden = false;
          for (let j = 0; j < q.lobes.length && !hidden; j++) {
            if (j !== li && len(sub(p, q.lobes[j].c)) < q.lobes[j].r * 0.92) hidden = true;
          }
          if (!hidden) return { li, d, p };
        }
        return null;
      };
      k.cloud({ share: 0.5, flat: 0.45 }, (rand, i, n) => {
        const ki = Math.min(K - 1, Math.floor((i / n) * K));
        const q = kernels[ki];
        const hit = onKernel(rand, q, areas[ki]);
        if (!hit) return null;
        const { li, d, p } = hit;
        // Light on each lobe, shade in the creases between lobes (closer to
        // the kernel's middle) and deeper in the heap, buttery yellow in the folds.
        const light = Math.max(0, dot(d, LIGHT));
        const crease = smoothstep(1.05, 0.62, len(sub(p, q.p)) / q.r);
        let col = mix("#fffdf5", "#fbeab8", 0.15 + 0.5 * q.tint);
        col = mix(col, "#f4cf6a", crease * (0.35 + 0.4 * q.tint));
        if (li === 0 && dot(d, q.hull) > 0.6) col = mix("#c98a3a", "#8a5a22", rand() * 0.5);
        col = shade(col, (0.8 + 0.28 * light) * (1 - 0.14 * crease) * q.ao);
        return { p, n: d, color: col, part: q.part, opacity: 0.97 };
      });
      k.reach([0, heapTop(0) + 0.4, 0]);
    },
  },

  jelly: {
    alive: true,
    options: [
      {
        key: "flavour",
        label: "Flavour",
        type: "select",
        default: "strawberry",
        choices: [
          { id: "strawberry", label: "Strawberry" },
          { id: "lime", label: "Lime" },
          { id: "orange", label: "Orange" },
          { id: "blueberry", label: "Blueberry" },
          { id: "grape", label: "Grape" },
          { id: "rainbow", label: "Rainbow" },
        ],
      },
      { key: "fruit", label: "Fruit inside", type: "switch", default: true },
    ],
    controls: [{ key: "poke", label: "Poke", type: "pulse", ease: 2.4 }],
    action: { key: "poke", label: "Poke" },
    drive(t, c, out, info) {
      const w = jiggle(t, info.time, c.poke);
      out.parts.jelly = {
        quat: quatEuler((w.tilt[0] * 180) / Math.PI, 0, (w.tilt[2] * 180) / Math.PI),
      };
      out.body = { squash: w.squash };
    },
    build(k, o) {
      const JELLY = {
        strawberry: "#e8233f",
        lime: "#52c832",
        orange: "#ff8a1a",
        blueberry: "#4863e6",
        grape: "#8e32c4",
      };
      const BANDS = ["#e8233f", "#ff8a1a", "#ffd21f", "#52c832", "#4863e6", "#8e32c4"];
      const H = 1.0;
      const colAt = (y) =>
        o.flavour === "rainbow"
          ? BANDS[clamp(Math.floor((y / (H + 0.02)) * BANDS.length), 0, BANDS.length - 1)]
          : JELLY[o.flavour] || JELLY.strawberry;
      // A plate.
      k.add(
        revolve(
          k,
          [
            [0, -0.02],
            [0.75, -0.02],
            [1.0, 0.01],
            [1.12, 0.07],
            [1.15, 0.08],
          ],
          null,
          { flip: true },
        ),
        {
          flat: 0.2,
          color: (c) => {
            const r = Math.hypot(c.p[0], c.p[2]);
            const band = Math.abs(r - 1.06) < 0.02;
            return glossy(c, band ? "#7fb3e6" : "#f1f4f7", 0.6, 40, 0.8, 0.25);
          },
        },
      );
      const jelly = k.part("jelly", { pivot: [0, 0, 0] });
      const pts = [
        [0.8, 0.0],
        [0.84, 0.1],
        [0.82, 0.26],
        [0.72, 0.42],
        [0.6, 0.52],
        [0.58, 0.6],
        [0.6, 0.72],
        [0.55, 0.86],
        [0.42, 0.96],
        [0.22, 1.01],
        [0, 1.02],
      ];
      const flute = (a, y) => 1 + 0.075 * Math.cos(a * 10) * (1 - smoothstep(0.86, 1.0, y));
      const shape = revolve(k, pts, flute, { grid: 96 });
      // A see-through skin: faint where it faces you, denser (bigger splats)
      // and deeper in colour where it turns away, like light through jelly.
      k.add(shape, {
        part: jelly,
        flat: 0.2,
        opacity: 0.3,
        color: (c) => {
          const base = colAt(c.p[1]);
          const r = rim(c);
          const col = mix(lit(c, base, 0.86, 0.3), shade(base, 0.55), 0.6 * r);
          return { c: mix(col, "#ffffff", 0.3 * spec(c, 10)), size: 1 + 0.7 * r * r };
        },
      });
      // Bright highlights on the glossy surface.
      k.add(shape, {
        part: jelly,
        share: 0.1,
        scale: [1.012, 1.006, 1.012],
        flat: 0.2,
        size: 1.25,
        opacity: 0.9,
        color: (c) => {
          const s = spec(c, 14);
          if (s > 0.55) return keep(mix("#ffffff", colAt(c.p[1]), 0.3 * (1 - s)));
          // A soft sheen along the lit side of each flute.
          const fl = Math.cos(Math.atan2(c.p[0], c.p[2]) * 10 - 0.5);
          if (fl > 0.86 && c.p[1] > 0.1 && c.p[1] < 0.85 && dot(c.n, VIEW) > 0.15)
            return keep(mix("#ffffff", colAt(c.p[1]), 0.4));
          return null;
        },
      });
      // The jelly's body: faint splats through the volume.
      const rAt = radiusAt(pts);
      const inside = (rand, shrink) => {
        const y = rand() * H;
        const a = rand() * TAU;
        const r = rAt(y) * flute(a, y) * shrink * Math.sqrt(rand());
        return [Math.sin(a) * r, y, Math.cos(a) * r];
      };
      k.cloud({ share: 0.14, size: 1.8, part: jelly }, (rand) => {
        const p = inside(rand, 0.95);
        return { p, color: shade(colAt(p[1]), 0.7), opacity: 0.08 };
      });
      if (o.fruit) {
        const FRUIT = [
          { c: "#b5102a", r: 0.075 }, // cherries
          { c: "#ffb020", r: 0.07, s: [1.4, 0.7, 0.8] }, // orange pieces
          { c: "#a7d84a", r: 0.065, s: [1, 1.2, 1] }, // grapes
          { c: "#2c2f7a", r: 0.05 }, // blueberries
          { c: "#fff0d8", r: 0.06, s: [1.3, 0.6, 1] }, // pear
        ];
        const pieces = [];
        for (let i = 0; i < 24; i++) {
          const y = 0.12 + k.rand() * 0.72;
          const a = k.rand() * TAU;
          const r = rAt(y) * (0.55 + 0.28 * k.rand());
          const f = FRUIT[i % FRUIT.length];
          pieces.push({ p: [Math.sin(a) * r, y, Math.cos(a) * r], f: { ...f, r: f.r * 1.25 } });
        }
        k.cloud({ share: 0.12, part: jelly, flat: 0.35, pattern: false }, (rand, i, n) => {
          const q = pieces[Math.floor((i / n) * pieces.length)];
          const d = randDir(rand);
          const s = q.f.s || [1, 1, 1];
          const off = [d[0] * s[0] * q.f.r, d[1] * s[1] * q.f.r, d[2] * s[2] * q.f.r];
          const light = Math.max(0, dot(d, LIGHT));
          return {
            p: add(q.p, off),
            n: d,
            color: shade(q.f.c, 0.7 + 0.45 * light),
            opacity: 0.95,
          };
        });
      }
    },
  },

  pancakes: {
    alive: true,
    options: [
      { key: "count", label: "Pancakes", type: "slider", min: 2, max: 7, step: 1, default: 5 },
    ],
    controls: [
      { key: "syrup", label: "Syrup", type: "slider", default: 0.8 },
      { key: "flip", label: "Flip", type: "pulse", ease: 1.3 },
    ],
    action: { key: "flip", label: "Flip the top one" },
    drive(t, c, out) {
      out.grow = c.syrup;
      const s = 1 - c.flip;
      const lift = s < 1 ? hop(s) : 0;
      out.parts.top = {
        offset: [0, 0.6 * lift, 0],
        quat: quatAxisAngle([1, 0, 0.25], TAU * easeInOut(s < 1 ? s : 0)),
      };
    },
    build(k, o) {
      const n = clamp(Math.round(o.count), 2, 7);
      const T = 0.15;
      const R = 0.8;
      // A plate.
      k.add(
        revolve(
          k,
          [
            [0, 0],
            [0.82, 0],
            [1.05, 0.04],
            [1.15, 0.09],
            [1.17, 0.1],
          ],
          null,
          { flip: true },
        ),
        {
          flat: 0.2,
          color: (c) => {
            const r = Math.hypot(c.p[0], c.p[2]);
            return glossy(c, Math.abs(r - 1.1) < 0.02 ? "#3d7cc9" : "#f5f3ee", 0.6, 40, 0.8, 0.25);
          },
        },
      );
      const cake = [
        [0, -T / 2],
        [0.55, -T / 2],
        [0.72, -T / 2 + 0.008],
        [0.785, -T / 4],
        [0.8, 0],
        [0.785, T / 4],
        [0.72, T / 2 - 0.008],
        [0.55, T / 2],
        [0, T / 2],
      ];
      const top = k.part("top", { pivot: [0, 0.02 + (n - 0.5) * T * 0.93, 0], axis: [1, 0, 0] });
      let topY = 0;
      for (let i = 0; i < n; i++) {
        const ph = k.rand() * TAU;
        const ph2 = k.rand() * TAU;
        const shape = revolve(
          k,
          cake,
          (a) => 1 + 0.02 * Math.sin(a * 3 + ph) + 0.012 * Math.sin(a * 7 + ph2),
          { grid: 64 },
        );
        const y = 0.02 + (i + 0.5) * T * 0.93;
        const last = i === n - 1;
        k.add(shape, {
          pos: [(k.rand() - 0.5) * 0.03, y, (k.rand() - 0.5) * 0.03],
          rot: [0, k.rand() * 360, 0],
          flat: 0.22,
          interior: 0.1,
          part: last ? top : 0,
          core: (c) =>
            Math.abs(c.lp[1]) > T * 0.38
              ? "#c98a45"
              : shade("#f4dfa6", 0.92 + 0.12 * c.noise(c.p[0] * 40, c.p[1] * 40, c.p[2] * 40)),
          color: (c) => {
            const face = Math.abs(c.ln[1]) > 0.6;
            const r = Math.hypot(c.lp[0], c.lp[2]) / R;
            let col;
            if (face) {
              const m = smoothstep(-0.3, 0.5, c.fbm(c.p[0] * 4 + i, c.p[2] * 4, i * 3, 4));
              col = mix("#e2ad62", "#a9642a", m * (1 - 0.5 * smoothstep(0.7, 1, r)));
            } else {
              const pore = c.noise(c.p[0] * 60, c.p[1] * 60, c.p[2] * 60) > 0.45;
              col = pore ? "#d6ac66" : "#f2d69c";
              col = mix(col, "#c98a45", smoothstep(0.55, 0.9, Math.abs(c.lp[1]) / (T / 2)));
            }
            return lit(c, col, 0.74, 0.38);
          },
        });
        topY = y + T / 2;
      }
      // A pat of butter.
      k.add(k.roundedBox(0.3, 0.1, 0.26, 5), {
        pos: [0.04, topY + 0.045, -0.02],
        rot: [3, 28, -4],
        part: top,
        flat: 0.25,
        weight: 2,
        pattern: false,
        color: (c) => glossy(c, "#fbe28a", 0.7, 30, 0.82, 0.25),
      });
      // A pool of syrup on top that spills into drips down the sides.
      const drips = [];
      for (let i = 0; i < 7; i++) {
        drips.push({ a: (i / 7) * TAU + 0.3 + k.rand() * 0.4, L: 0.18 + k.rand() * 0.55 });
      }
      const poolR = (a) => {
        let r = 0.56 + 0.04 * Math.sin(a * 5 + 1) + 0.03 * Math.sin(a * 9);
        for (const d of drips) {
          let da = Math.abs(a - d.a);
          da = Math.min(da, TAU - da);
          r = Math.max(r, 0.8 - da * 1.8);
        }
        return r;
      };
      const syrup = (c) =>
        mix(
          glossy(c, "#a2541a", 0.9, 30, 0.8, 0.35),
          "#5e2a0a",
          0.3 * smoothstep(0.3, -0.5, c.n[1]),
        );
      k.add(
        k.param(
          (u, v) => {
            const a = u * TAU;
            const r = v * poolR(a);
            return [Math.sin(a) * r, topY + 0.012 + 0.018 * (1 - v * v), Math.cos(a) * r];
          },
          { grid: 64 },
        ),
        {
          part: top,
          flat: 0.2,
          opacity: 0.92,
          pattern: false,
          kind: "grow",
          params: [0.02, 0],
          color: syrup,
        },
      );
      const sideR = (y) => {
        const i = clamp(Math.floor((y - 0.02) / (T * 0.93)), 0, n - 1);
        const yl = y - (0.02 + (i + 0.5) * T * 0.93);
        return R * Math.pow(Math.max(0, 1 - (yl / (T * 0.55)) ** 2), 0.18) + 0.022;
      };
      for (const d of drips) {
        const curve = (t) => {
          if (t < 0.15) {
            const f = t / 0.15;
            const r = 0.74 + 0.08 * f;
            const y = topY + 0.01 - 0.04 * f * f;
            return [Math.sin(d.a) * r, y, Math.cos(d.a) * r];
          }
          const f = (t - 0.15) / 0.85;
          const y = topY - 0.03 - d.L * f;
          const r = sideR(y);
          return [Math.sin(d.a) * r, y, Math.cos(d.a) * r];
        };
        k.add(
          k.tube(curve, (t) => 0.03 + 0.022 * smoothstep(0.75, 0.97, t), { caps: true }),
          {
            flat: 0.25,
            weight: 2,
            pattern: false,
            kind: "grow",
            params: (c) => [0.05 + 0.9 * (c.t ?? 0) * (d.L / 0.73), 0],
            color: syrup,
          },
        );
      }
      k.reach([0, topY + 0.5, 0]);
    },
  },

  cupcake: {
    options: [
      { key: "frosting", label: "Frosting", type: "color", default: "#f7a6c6" },
      { key: "liner", label: "Liner", type: "color", default: "#6fc3e6" },
      {
        key: "cake",
        label: "Cake",
        type: "select",
        default: "vanilla",
        choices: [
          { id: "vanilla", label: "Vanilla" },
          { id: "chocolate", label: "Chocolate" },
          { id: "velvet", label: "Red velvet" },
        ],
      },
      {
        key: "topping",
        label: "Topping",
        type: "select",
        default: "both",
        choices: [
          { id: "both", label: "Sprinkles and cherry" },
          { id: "sprinkles", label: "Sprinkles" },
          { id: "cherry", label: "Cherry" },
          { id: "none", label: "Plain" },
        ],
      },
    ],
    controls: [{ key: "flick", label: "Flick the cherry", type: "pulse", ease: CUP_SECS }],
    action: { key: "flick", label: "Flick the cherry" },
    // A tap presses the frosting, which springs and flicks the cherry up;
    // it tumbles and drops back on top with a plop. The frosting squashes
    // and wobbles under it, and the sprinkles jump off and rain back down.
    drive(t, c, out) {
      const s = since(c.flick, CUP_SECS);
      const on = s >= 0;
      const land = CUP_LAUNCH + CUP_FLIGHT;
      const u = s - land;
      // Channel 0 squashes the frosting (negative stretches it).
      const press = on ? 0.35 * hop(band(s, 0, CUP_LAUNCH + 0.04)) : 0;
      const squash = on && u > 0 ? Math.sin(u * 16) * Math.exp(-u / 0.24) : 0;
      const m0 = press + squash;
      const jump = (at) => (on ? hop(band(s, at, at + 0.55)) : 0);
      out.morph = [m0, jump(land), jump(land + 0.04), jump(land + 0.08)];
      // The cherry rides the frosting's top, and flies in between.
      let y = -CUP_TOP * m0;
      let tilt = 0;
      if (on && s > CUP_LAUNCH && s < land) {
        const f = (s - CUP_LAUNCH) / CUP_FLIGHT;
        y = 4 * CUP_HIGH * f * (1 - f);
        tilt = 0.5 * Math.sin(Math.PI * f);
      } else if (on && u > 0) tilt = 0.25 * wobble(u, 0.8, 13);
      out.parts.cherry = { offset: [0, y, 0], quat: quatAxisAngle([0, 0, 1], tilt) };
      cuesAt(
        c,
        "cupcake",
        s,
        [
          [land, { voice: "thud", f: 150, bright: 0.5, decay: 0.6 }],
          [land + 0.5, { voice: "patter", f: 2900, n: 10, decay: 0.5, vol: 0.6 }],
        ],
        out,
      );
    },
    build(k, o) {
      const cake = { vanilla: "#e7b466", chocolate: "#6a3b22", velvet: "#9c2530" }[o.cake];
      const LH = 0.62;
      // A pleated paper liner (the pleats catch the light on alternate faces).
      k.add(
        revolve(
          k,
          [
            [0, 0],
            [0.38, 0],
            [0.44, LH * 0.5],
            [0.55, LH],
          ],
          (a) => 1 + 0.035 * Math.abs((((a * 22) / TAU) % 1) - 0.5) * 2,
          { grid: 120, thick: 0.45 },
        ),
        {
          flat: 0.2,
          interior: 0.1,
          core: cake,
          color: (c) =>
            lit(c, mix(o.liner, "#ffffff", 0.12 * c.noise(0, c.p[1] * 30, 0)), 0.7, 0.45),
        },
      );
      // The muffin top peeking over the liner.
      k.add(
        revolve(k, [
          [0.55, LH - 0.03],
          [0.6, LH + 0.05],
          [0.53, LH + 0.13],
          [0.3, LH + 0.19],
          [0, LH + 0.2],
        ]),
        {
          flat: 0.3,
          color: (c) =>
            lit(c, shade(cake, 0.9 + 0.2 * c.noise(c.p[0] * 25, c.p[1] * 25, c.p[2] * 25))),
        },
      );
      // A piped swirl of frosting: a star-tipped rope winding up to a peak.
      const turns = 2.7;
      const curve = (t) => {
        const a = t * turns * TAU;
        const rr = 0.4 * Math.pow(1 - t, 0.85) + 0.015;
        return [Math.sin(a) * rr, LH + 0.2 + t * 0.52, Math.cos(a) * rr];
      };
      const rope = (t) => 0.145 * (1 - 0.72 * Math.pow(t, 1.3)) + 0.012;
      const swirl = k.tube(curve, rope, { caps: true, samples: 420, grid: 96 });
      // The frosting squashes about its base on channel 0: lower and wider.
      const y0 = LH + 0.06;
      const squash = (p) => {
        const h = clamp((p[1] - y0) / 0.8, 0, 1);
        const wide = 1 + CUP_SQUASH * 0.7 * (1 - 0.4 * h);
        return [p[0] * wide, y0 + (p[1] - y0) * (1 - CUP_SQUASH), p[2] * wide];
      };
      k.add(swirl, {
        flat: 0.35,
        interior: 0.06,
        core: o.frosting,
        to: (c) => squash(c.p),
        channel: 0,
        color: (c) => {
          const ridge = Math.cos(c.u * TAU * 8);
          const col = lit(c, shade(o.frosting, 1 + 0.07 * ridge), 0.8, 0.32);
          return mix(col, "#ffffff", 0.35 * spec(c, 20));
        },
      });
      if (o.topping === "both" || o.topping === "sprinkles") {
        // Each sprinkle jumps straight up by its own height (channels 1 to 3,
        // a little apart) and falls back.
        k.cloud({ share: 0.03, size: 0.62, pattern: false }, (rand) => {
          const t = rand() * 0.95;
          const f = swirl.frame(t);
          const a = rand() * TAU;
          const d = add(mul(f.n, Math.cos(a)), mul(f.b, Math.sin(a)));
          if (d[1] < -0.1) return null;
          const p = add(f.p, mul(d, rope(t) + 0.012));
          const h = 0.05 + 0.12 * rand();
          const out = unit([p[0], 0, p[2]]);
          const jumps = rand() < 0.35;
          return {
            p,
            dir: tangentDir(rand, d),
            stretch: 2.7,
            color: SPRINKLES[Math.floor(rand() * SPRINKLES.length)],
            opacity: 1,
            ...(jumps
              ? { to: add(p, [out[0] * h * 0.3, h, out[2] * h * 0.3]), channel: 1 + Math.floor(rand() * 3) } // prettier-ignore
              : {}),
          };
        });
      }
      if (o.topping === "both" || o.topping === "cherry") {
        const cp = add(curve(1), [0, 0.1, 0]);
        const cherry = k.part("cherry", { pivot: cp, axis: [0, 0, 1] });
        k.add(k.sphere(0.12), {
          pos: cp,
          part: cherry,
          flat: 0.25,
          weight: 2.5,
          pattern: false,
          color: (c) =>
            glossy(c, mix("#d0102a", "#7e0616", smoothstep(0.3, -0.8, c.n[1])), 0.9, 36),
        });
        k.add(
          k.tube(
            spline([add(cp, [0, 0.1, 0]), add(cp, [0.04, 0.22, 0]), add(cp, [0.12, 0.3, 0])]),
            0.014,
          ),
          { part: cherry, flat: 0.3, weight: 3, pattern: false, color: (c) => lit(c, "#6b8a2a") },
        );
        k.reach(add(cp, [0, CUP_HIGH + 0.05, 0]));
      }
    },
  },

  lollipop: {
    alive: true,
    options: [
      {
        key: "colors",
        label: "Colours",
        type: "select",
        default: "rainbow",
        choices: [
          { id: "rainbow", label: "Rainbow" },
          { id: "strawberry", label: "Strawberry" },
          { id: "blueberry", label: "Blueberry" },
          { id: "citrus", label: "Citrus" },
        ],
      },
    ],
    controls: [{ key: "spin", label: "Spin fast", type: "pulse", ease: LOLLY_SECS }],
    action: { key: "spin", label: "Spin fast" },
    // A tap whirls the swirl up to nearly three turns a second, so the
    // spiral seems to pour inwards, then it slows back to its idle turn.
    // It spins a whole number of extra turns, so it ends as it began.
    drive(t, c, out) {
      const s = since(c.spin, LOLLY_SECS);
      const [a, b, e] = LOLLY_RAMP;
      const w = (TAU * LOLLY_TURNS) / (a / 2 + (b - a) + (e - b) / 2);
      let extra = 0;
      if (s >= 0) {
        const x = Math.min(s, e);
        if (x < a) extra = (w * x * x) / (2 * a);
        else if (x < b) extra = (w * a) / 2 + w * (x - a);
        else {
          const y = x - b;
          extra = (w * a) / 2 + w * (b - a) + w * (y - (y * y) / (2 * (e - b)));
        }
      }
      out.parts.swirl = { angle: -t * 0.5 - extra };
    },
    build(k, o) {
      const cols = {
        rainbow: ["#ff3b5c", "#ff9f1c", "#ffe14d", "#4cd964", "#38b6ff", "#a66bff"],
        strawberry: ["#ff3b5c", "#fff4f4", "#ff8fab", "#fff4f4"],
        blueberry: ["#3b5bff", "#f3f6ff", "#8fb8ff", "#f3f6ff"],
        citrus: ["#ffd400", "#fff8e0", "#ff8a00", "#8ee000"],
      }[o.colors];
      const swirl = k.part("swirl", { pivot: [0, 0, 0], axis: [0, 0, 1] });
      const turns = 4.2;
      const pitch = 0.21;
      const curve = (t) => {
        const a = t * turns * TAU;
        const r = 0.05 + pitch * t * turns;
        return [Math.cos(a) * r, Math.sin(a) * r, 0];
      };
      const R = pitch * 0.58;
      k.add(
        k.tube(curve, (t) => R * (0.55 + 0.45 * smoothstep(0, 0.04, t)), {
          caps: true,
          samples: 700,
          grid: 110,
        }),
        {
          part: swirl,
          flat: 0.25,
          interior: 0.05,
          core: cols[0],
          color: (c) => {
            const f = (((c.u + c.t * 60) % 1) + 1) % 1;
            const col = cols[Math.floor(f * cols.length) % cols.length];
            return glossy(c, col, 0.85, 28, 0.8, 0.32);
          },
        },
      );
      // The stick (its end hidden inside the bottom coils) and a ribbon bow.
      const top = -0.82;
      const L = 1.1;
      k.add(k.cylinder(0.05, L), {
        pos: [0, top - L / 2, 0],
        flat: 0.25,
        weight: 1.6,
        color: (c) =>
          lit(c, shade("#f6f2ea", 0.95 + 0.08 * c.noise(0, c.p[1] * 20, c.p[0] * 20)), 0.78, 0.35),
      });
      const bowY = top - 0.42;
      const ribbon = (c) => glossy(c, "#e8336d", 0.6, 16, 0.75, 0.4);
      for (const s of [-1, 1]) {
        k.add(k.torus(0.13, 0.035), {
          pos: [s * 0.14, bowY + 0.02, 0.03],
          rot: [90, 0, s * 18],
          scale: [1, 1, 0.6],
          flat: 0.3,
          weight: 1.6,
          pattern: false,
          color: ribbon,
        });
        k.add(
          k.tube(
            spline([
              [0.02 * s, bowY - 0.02, 0.05],
              [0.1 * s, bowY - 0.15, 0.06],
              [0.16 * s, bowY - 0.3, 0.04],
            ]),
            (t) => 0.035 * (1 - 0.3 * t),
          ),
          { flat: 0.3, weight: 1.6, pattern: false, scale: [1, 1, 0.5], color: ribbon },
        );
      }
      k.add(k.sphere(0.06), { pos: [0, bowY, 0.05], weight: 2, pattern: false, color: ribbon });
    },
  },

  "candy-cane": {
    options: [
      {
        key: "style",
        label: "Style",
        type: "select",
        default: "pair",
        choices: [
          { id: "pair", label: "Pair with a bow" },
          { id: "single", label: "Single" },
        ],
      },
      { key: "stripe", label: "Stripes", type: "color", default: "#d7192a" },
    ],
    controls: [{ key: "snap", label: "Twist and snap", type: "pulse", ease: CANE_SECS }],
    action: { key: "snap", label: "Twist and snap" },
    // A tap twists each cane: the hook turns and the stripes wind tighter
    // up the shaft, until it snaps in two with a crack. The top half springs
    // back, jumps clear and leans out, showing the white candy inside the
    // break, and a few sugar chips fly. Then the halves come back together
    // and mend with a glint (the second cane a moment after the first).
    drive(t, c, out, info) {
      const s = since(c.snap, CANE_SECS);
      const d = info.data;
      if (!d) return;
      const morph = [0, 0, 0, 0];
      out.tokens = [];
      d.canes.forEach((cn, i) => {
        const u = s - CANE_LAG * i;
        const on = s >= 0 && u >= 0;
        // The twist (channel i), which springs back when it snaps.
        let tw = 0;
        if (on && u < CANE_SNAP) tw = easeIn(u / CANE_SNAP) * 0.7 + 0.3 * smooth(u / CANE_SNAP);
        else if (on) tw = Math.exp(-(u - CANE_SNAP) / 0.12) * Math.cos((u - CANE_SNAP) * 26);
        morph[i] = tw;
        // The top half: out after the snap, back to mend.
        const out1 = on ? easeOut(band(u, CANE_SNAP, CANE_SNAP + 0.3)) : 0;
        const back = on ? smooth(band(u, CANE_JOIN - 0.45, CANE_JOIN)) : 0;
        const apart = out1 * (1 - back);
        const bob = on ? 0.03 * Math.sin((u - CANE_SNAP) * 7) * apart : 0;
        const qTwist = quatAxisAngle(cn.axis, CANE_TWIST * tw);
        const qLean = quatAxisAngle([0, 0, 1], cn.lean * 0.26 * apart);
        out.parts[cn.top] = {
          quat: quatMul(qLean, qTwist),
          offset: add(mul(cn.axis, (0.2 + bob) * apart), mul(cn.out, 0.06 * apart)),
        };
        const kick = on ? 0.06 * wobble(u - CANE_SNAP, 0.7, 16) : 0;
        out.parts[cn.low] = { quat: quatAxisAngle([0, 0, 1], -cn.lean * kick) };
        // Sugar chips fly out of the break and back in as it mends.
        cn.chips.forEach((ch) => {
          const f = on ? band(u, CANE_SNAP, CANE_SNAP + 0.55) : 0;
          const r = on ? 1 - smooth(band(u, CANE_JOIN - 0.4, CANE_JOIN - 0.05)) : 0;
          const g = Math.min(f, 1) * r;
          const fl = f < 1 ? f : 1;
          const p = add(mul(ch.dir, 0.35 * g), [
            0,
            (0.25 * hop(Math.min(fl, 1)) - 0.25 * fl) * r,
            0,
          ]);
          out.tokens[ch.token] = {
            base: cn.pivot,
            offset: p,
            quat: quatAxisAngle(ch.spin, 3 * g),
            visible: on && u > CANE_SNAP && u < CANE_JOIN - 0.06 ? 1 : 0,
          };
        });
        // The mend glints as the halves meet (channel 2 passes 0.5).
        if (i === 0) morph[2] = on ? band(u, CANE_JOIN - 0.1, CANE_JOIN + 0.25) : 0;
        if (i === 1) morph[3] = on ? band(u, CANE_JOIN - 0.1, CANE_JOIN + 0.25) : 0;
      });
      out.morph = morph;
      out.glow = [1, 0.97, 0.9, 0.9];
      const list = [];
      d.canes.forEach((cn, i) => {
        list.push([CANE_LAG * i + CANE_SNAP, { voice: "crack", f: 3000 - 400 * i, bright: 0.9, decay: 0.6 }]); // prettier-ignore
        list.push([CANE_LAG * i + CANE_JOIN, { voice: "glass", f: i ? "E7" : "C7", decay: 0.5, vol: 0.5 }]); // prettier-ignore
      });
      cuesAt(c, "cane", s, list, out);
    },
    build(k, o) {
      const L1 = 1.8;
      const Rh = 0.32;
      const L2 = Math.PI * Rh;
      const L3 = 0.1;
      const total = L1 + L2 + L3;
      const path = (t) => {
        const s = t * total;
        if (s < L1) return [0, -1.3 + s, 0];
        if (s < L1 + L2) {
          const f = (s - L1) / Rh;
          return [-Rh + Rh * Math.cos(f), -1.3 + L1 + Rh * Math.sin(f), 0];
        }
        return [-2 * Rh, -1.3 + L1 - (s - L1 - L2), 0];
      };
      const shape = k.tube(path, 0.1, { caps: true, samples: 360, grid: 96 });
      const stripe = (u, t) => {
        const f = (((u + (t * total) / 0.42) % 1) + 1) % 1;
        if (f < 0.3) return o.stripe;
        if (f > 0.42 && f < 0.47) return o.stripe;
        if (f > 0.53 && f < 0.56) return "#2f9e44";
        return "#fbf8f2";
      };
      // It breaks a little above the middle of the shaft, along a jagged
      // line; everything above goes with the hook.
      const yb = -0.25;
      const tb = (yb + 1.3) / total;
      const fb = shape.frame(tb);
      const jag = (a) => 0.025 * (Math.abs((((a / TAU) * 7) % 1) - 0.5) * 4 - 1);
      const angleAt = (lp, f) => {
        const d = sub(lp, f.p);
        return Math.atan2(dot(d, f.b), dot(d, f.n));
      };
      const canes = [];
      let chipToken = 0;
      const cane = (quat, pos, lean) => {
        const i = canes.length;
        const pivot = add(pos, quatRotate(quat, [0, yb, 0]));
        const axis = quatRotate(quat, [0, 1, 0]);
        const top = `top${i}`;
        const low = `low${i}`;
        const partTop = k.part(top, { pivot, axis });
        const partLow = k.part(low, { pivot: add(pos, quatRotate(quat, [0, -1.3, 0])) });
        const along = (c) => (c.t ?? (c.lp[1] < -1.2 ? 0 : 1)) * total;
        const above = (c) => {
          const sAl = along(c);
          if (sAl > L1) return true;
          return c.lp[1] > yb + jag(angleAt(c.lp, fb));
        };
        // The twist: the shaft turns about its axis, more the higher it is;
        // the top half also turns as a whole with the hook (CANE_TWIST).
        const twist = (c) => {
          if (along(c) > L1 + 0.01) return null;
          const y = clamp(c.lp[1], -1.3, 0.5);
          let a = (CANE_TWIST * (y + 1.3)) / 1.8;
          if (above(c)) a -= CANE_TWIST;
          const q = quatAxisAngle([0, 1, 0], a);
          const lq = quatRotate(q, c.lp);
          return add(pos, quatRotate(quat, lq));
        };
        k.add(shape, {
          quat,
          pos,
          flat: 0.3,
          interior: 0.05,
          core: "#fbf8f2",
          part: (c) => (above(c) ? partTop : partLow),
          to: twist,
          channel: i,
          color: (c) => glossy(c, stripe(c.u, c.t ?? 0), 0.9, 30, 0.8, 0.3),
        });
        // The mend's glint: a ring of splats just below the break, coloured
        // as the cane is there, that glows as channel 2 (or 3) passes 0.5.
        k.add(k.cylinder(0.104, 0.03, { caps: false }), {
          quat,
          pos: add(pos, quatRotate(quat, [0, yb - 0.042, 0])),
          share: 0.004,
          size: 1.3,
          part: partLow,
          kind: "band",
          params: [0.5, 0.18],
          channel: 2 + i,
          pattern: false,
          color: (c) => {
            const d = [c.lp[0], 0, c.lp[2]];
            const a = Math.atan2(dot(d, fb.b), dot(d, fb.n));
            const u = (((a / TAU) % 1) + 1) % 1;
            return glossy(c, stripe(u, tb + (c.lp[1] - 0.042) / total), 0.9, 30, 0.8, 0.3);
          },
        });
        // The broken ends: white candy with the stripes round the rim.
        for (const [dir, part] of [
          [1, partLow],
          [-1, partTop],
        ]) {
          k.add(
            k.param(
              (u, v) => {
                const a = u * TAU;
                const r = 0.098 * Math.sqrt(v);
                const d = add(mul(fb.n, r * Math.cos(a)), mul(fb.b, r * Math.sin(a)));
                return [d[0], yb + jag(a) * v - 0.004 * dir, d[2]];
              },
              { grid: 24, normal: () => [0, dir, 0] },
            ),
            {
              quat,
              pos,
              part,
              share: 0.006,
              flat: 0.3,
              pattern: false,
              color: (c) => {
                if (c.v < 0.8) return keep(lit(c, mix("#ffffff", "#f1ebe0", c.rand() * 0.5), 0.9, 0.15)); // prettier-ignore
                return keep(stripe(c.u, tb));
              },
            },
          );
        }
        // A few chips of sugar, hidden inside the break until it snaps.
        const chips = [];
        for (let j = 0; j < 4; j++) {
          const token = chipToken++;
          const a = (j / 4) * TAU + 0.4;
          const dirL = [Math.cos(a), 0.3, Math.sin(a)];
          chips.push({ token, dir: unit(quatRotate(quat, dirL)), spin: unit([Math.sin(a), 1, Math.cos(a)]) }); // prettier-ignore
          k.cloud({ count: 26, pattern: false, size: 0.7 }, (rand) => ({
            p: add(pivot, mul(randDir(rand), 0.02)),
            color: rand() < 0.35 ? o.stripe : "#fbf8f2",
            n: randDir(rand),
            flat: 0.4,
            opacity: 1,
            kind: "token",
            params: [token, 0],
          }));
        }
        canes.push({
          top,
          low,
          pivot,
          axis,
          lean,
          out: unit([lean < 0 ? 1 : -1, 0.2, 0]),
          chips,
        });
      };
      if (o.style === "single") {
        cane(quatEuler(0, 0, -8), [0.2, 0, 0], 1);
      } else {
        cane(quatEuler(0, 0, 16), [-0.12, 0, -0.07], 1);
        cane(quatEuler(0, 180, -16), [0.12, 0, 0.07], -1);
      }
      k.data = { canes };
      if (o.style === "single") return;
      // A satin bow where they cross.
      const bowY = -0.62;
      const satin = (c) => glossy(c, "#23823a", 0.55, 14, 0.72, 0.42);
      for (const s of [-1, 1]) {
        k.add(k.torus(0.16, 0.045), {
          pos: [s * 0.17, bowY + 0.05, 0.16],
          rot: [90, 0, s * 22],
          scale: [1, 1, 0.55],
          flat: 0.3,
          weight: 1.5,
          pattern: false,
          color: satin,
        });
        k.add(
          k.tube(
            spline([
              [0.02 * s, bowY - 0.02, 0.18],
              [0.12 * s, bowY - 0.2, 0.2],
              [0.2 * s, bowY - 0.4, 0.17],
            ]),
            (t) => 0.045 * (1 - 0.3 * t),
          ),
          { flat: 0.3, weight: 1.5, pattern: false, scale: [1, 1, 0.5], color: satin },
        );
      }
      k.add(k.sphere(0.07), { pos: [0, bowY, 0.18], weight: 2, pattern: false, color: satin });
    },
  },

  macarons: {
    options: [
      {
        key: "flavours",
        label: "Flavours",
        type: "select",
        default: "pastel",
        choices: [
          { id: "pastel", label: "Pastel mix" },
          { id: "raspberry", label: "Raspberry" },
          { id: "pistachio", label: "Pistachio" },
          { id: "chocolate", label: "Chocolate" },
          { id: "lemon", label: "Lemon" },
        ],
      },
    ],
    controls: [{ key: "stack", label: "Stack up", type: "pulse", ease: MAC_SECS }],
    action: { key: "stack", label: "Stack up" },
    // A tap sends the two in front hopping, one after the other, up onto
    // the stack: each rises clear of the stack's rim, comes over and lands
    // level on top with a soft tap. The tower of five sways, then they hop
    // back down to where they lay, the top one first.
    drive(t, c, out, info) {
      const s = since(c.stack, MAC_SECS);
      const d = info.data;
      if (!d) return;
      const { homes, quats, tower, base } = d;
      // Where each is (centre) and how it has turned from its built pose.
      const at = homes.map((h) => h.slice());
      const turn = homes.map(() => IDQ);
      if (s >= 0) {
        MAC_HOPS.forEach(([who, up, down], n) => {
          const to = tower[3 + n];
          const level = quatMul(quatEuler(0, MAC_YAW[who], 0), [-quats[who][0], -quats[who][1], -quats[who][2], quats[who][3]]); // prettier-ignore
          let f = 0;
          let from = homes[who];
          let goal = to;
          if (s >= up && s < up + 0.5) f = band(s, up, up + 0.5);
          else if (s >= up + 0.5 && s < down) f = 1;
          else if (s >= down && s < down + 0.5) {
            f = band(s, down, down + 0.5);
            [from, goal] = [to, homes[who]];
          }
          if (f <= 0) return;
          // It rises clear of the stack's rim before it comes over.
          const peak = Math.max(from[1], goal[1]) + 0.35;
          const fh = smooth(band(f, 0.25, 1));
          const y = f < 0.55 ? mix1(from[1], peak, easeOut(f / 0.55)) : mix1(peak, goal[1], easeIn((f - 0.55) / 0.45)); // prettier-ignore
          at[who] = [from[0] + (goal[0] - from[0]) * fh, y, from[2] + (goal[2] - from[2]) * fh];
          const onTop = goal === to ? smooth(f) : 1 - smooth(f);
          turn[who] = slerpQ(IDQ, level, onTop);
          // A little bounce as it lands.
          const land = goal === to ? up + 0.5 : down + 0.5;
          at[who][1] += 0.05 * Math.max(0, Math.sin((Math.PI * (s - land)) / 0.2)) * (s > land && s < land + 0.2 ? 1 : 0); // prettier-ignore
        });
        // The tower of five sways once the last one is on.
        const sway = 0.05 * wobble(s - MAC_HOPS[1][1] - 0.5, 1.1, 8);
        if (sway) {
          const q = quatAxisAngle([Math.sin(0.55), 0, Math.cos(0.55)], sway);
          for (let i = 0; i < homes.length; i++) {
            if (Math.hypot(at[i][0] - base[0], at[i][2] - base[2]) > 0.1) continue;
            at[i] = add(base, quatRotate(q, sub(at[i], base)));
            turn[i] = quatMul(q, turn[i]);
          }
        }
      }
      out.tokens = homes.map((h, i) => ({ base: h, offset: sub(at[i], h), quat: turn[i] }));
      cuesAt(
        c,
        "macarons",
        s,
        MAC_HOPS.flatMap(([who, up, down], n) => [
          [up + 0.5, { voice: "wood", f: n ? "G6" : "E6", decay: 0.5, vol: 0.6 }],
          [down + 0.5, { voice: "wood", f: n ? "D6" : "C6", decay: 0.5, vol: 0.5 }],
        ]),
        out,
      );
    },
    build(k, o) {
      const ONE = {
        raspberry: ["#f27ba2", "#fff1f5"],
        pistachio: ["#a8d47e", "#f3fae6"],
        chocolate: ["#7a4b35", "#4a2a1c"],
        lemon: ["#f6d95c", "#fff9df"],
        lavender: ["#b9a3e8", "#fbf7ff"],
        blue: ["#8ecbec", "#f1faff"],
      };
      const set =
        o.flavours === "pastel"
          ? [ONE.raspberry, ONE.pistachio, ONE.lavender, ONE.lemon]
          : [ONE[o.flavours], ONE[o.flavours], ONE[o.flavours], ONE[o.flavours]];
      // A shell: flat base, ruffled "foot", smooth domed top.
      const shell = revolve(
        k,
        [
          [0, 0],
          [0.44, 0],
          [0.5, 0.012],
          [0.52, 0.04],
          [0.5, 0.075],
          [0.46, 0.1],
          [0.37, 0.155],
          [0.2, 0.19],
          [0, 0.2],
        ],
        (a, y) => (y < 0.085 ? 1 + 0.045 * k.noise(Math.sin(a) * 6, Math.cos(a) * 6, y * 60) : 1),
        { grid: 80, thick: 0.1 },
      );
      const filling = revolve(k, [
        [0.4, -0.055],
        [0.445, -0.03],
        [0.455, 0],
        [0.445, 0.03],
        [0.4, 0.055],
      ]);
      // Each macaron is a piece (a token) that can hop about.
      const homes = [];
      const quats = [];
      const macaron = (q, pos, [col, fill]) => {
        const token = { kind: "token", params: [homes.length, 0] };
        homes.push(pos);
        quats.push(q);
        const put = (off, flip) => ({
          quat: flip ? quatMul(q, quatEuler(180, 0, 0)) : q,
          pos: add(pos, quatRotate(q, [0, off, 0])),
          ...token,
        });
        const shellColor = (c) => {
          const y = c.lp[1];
          if (y < 0.085 && Math.abs(c.ln[1]) < 0.9) {
            const bump = c.noise(c.p[0] * 70, c.p[1] * 70, c.p[2] * 70);
            return lit(c, shade(mix(col, "#ffffff", 0.18), 0.85 + 0.25 * bump), 0.8, 0.3);
          }
          return mix(lit(c, col, 0.78, 0.34), "#ffffff", 0.18 * spec(c, 18));
        };
        k.add(shell, {
          ...put(0.055, false),
          flat: 0.2,
          interior: 0.08,
          core: fill,
          color: shellColor,
        });
        k.add(shell, {
          ...put(-0.055, true),
          flat: 0.2,
          interior: 0.08,
          core: fill,
          color: shellColor,
        });
        k.add(filling, {
          ...put(0, false),
          flat: 0.3,
          weight: 1.3,
          color: (c) => lit(c, shade(fill, 0.95 + 0.1 * c.noise(c.p[0] * 30, c.p[1] * 30, 0))),
        });
      };
      const h = 0.51;
      for (let i = 0; i < 3; i++) {
        const q = quatEuler(0, i * 40 + 10, (k.rand() - 0.5) * 4);
        macaron(q, [(k.rand() - 0.5) * 0.04, 0.255 + i * h, -0.35], set[i]);
      }
      // Two more lying in front, one tipped against the other.
      macaron(quatEuler(0, MAC_YAW[3], 0), [-0.55, 0.255, 0.45], set[3]);
      macaron(quatEuler(-14, MAC_YAW[4], 12), [0.5, 0.33, 0.5], set[o.flavours === "pastel" ? 0 : 3]); // prettier-ignore
      // The tower they build: five high on the stack.
      const top = homes[2];
      const tower = [0, 1, 2, 3, 4].map((i) =>
        i < 3 ? homes[i] : [top[0], 0.255 + i * h, top[2]],
      );
      k.data = { homes, quats, tower, base: [top[0], 0, top[2]] };
      k.reach([top[0], 0.255 + 4 * h, top[2]]);
    },
  },

  "gummy-bear": {
    alive: true,
    // Drag it to stretch it; let go and it springs back (src/player.js).
    grab: { radius: 0.55, max: 0.9 },
    options: [
      {
        key: "color",
        label: "Flavour",
        type: "select",
        default: "red",
        choices: [
          { id: "red", label: "Cherry red" },
          { id: "orange", label: "Orange" },
          { id: "yellow", label: "Lemon" },
          { id: "green", label: "Apple green" },
          { id: "clear", label: "Pineapple (clear)" },
          { id: "pink", label: "Raspberry pink" },
        ],
      },
    ],
    controls: [{ key: "squish", label: "Squish", type: "pulse", ease: 2 }],
    action: { key: "squish", label: "Squish" },
    drive(t, c, out, info) {
      const w = jiggle(t, info.time, c.squish, { idle: 0.6 });
      out.body = {
        squash: w.squash,
        quat: quatEuler((w.tilt[0] * 180) / Math.PI, 0, (w.tilt[2] * 180) / Math.PI),
      };
    },
    build(k, o) {
      const base = {
        red: "#e3122d",
        orange: "#ff7a0a",
        yellow: "#ffcf1a",
        green: "#48c21f",
        clear: "#f2eee0",
        pink: "#ff4f9a",
      }[o.color];
      const parts = [
        [[0, -0.12, 0], [0.45, 0.55, 0.34], 0],
        [[0, -0.2, 0.12], [0.32, 0.36, 0.26], 0],
        [[0, 0.55, 0], [0.4, 0.34, 0.31], 0],
        [[0, 0.45, 0.25], [0.17, 0.12, 0.11], 0],
        [[-0.27, 0.84, -0.02], [0.13, 0.13, 0.1], 0],
        [[0.27, 0.84, -0.02], [0.13, 0.13, 0.1], 0],
        [[-0.42, 0.1, 0.08], [0.14, 0.24, 0.14], -0.55],
        [[0.42, 0.1, 0.08], [0.14, 0.24, 0.14], 0.55],
        [[-0.24, -0.62, 0.08], [0.18, 0.2, 0.18], 0],
        [[0.24, -0.62, 0.08], [0.18, 0.2, 0.18], 0],
      ];
      const ell = (p, [c, r, rz]) => {
        let x = p[0] - c[0];
        let y = p[1] - c[1];
        if (rz) {
          const cs = Math.cos(rz);
          const sn = Math.sin(rz);
          [x, y] = [x * cs + y * sn, -x * sn + y * cs];
        }
        const z = p[2] - c[2];
        return (Math.hypot(x / r[0], y / r[1], z / r[2]) - 1) * Math.min(r[0], r[1], r[2]);
      };
      const smin = (a, b, kk) => {
        const h = clamp(0.5 + (0.5 * (b - a)) / kk, 0, 1);
        return b + (a - b) * h - kk * h * (1 - h);
      };
      const f = (p) => {
        let d = ell(p, parts[0]);
        for (let i = 1; i < parts.length; i++) d = smin(d, ell(p, parts[i]), 0.09);
        return d;
      };
      const radius = tabulate(implicitRadius(f, 1.6, 22));
      const shape = k.radial(radius, { grid: 120 });
      const face = (c) => {
        const [x, y, z] = c.p;
        if (z < 0.1) return false;
        if (Math.hypot(Math.abs(x) - 0.13, y - 0.64) < 0.035) return true;
        return Math.hypot(x, y - 0.5) < 0.03 && z > 0.3;
      };
      k.add(shape, {
        flat: 0.2,
        opacity: 0.42,
        color: (c) => {
          if (face(c)) return keep(shade(base, 0.45));
          const r = rim(c);
          const col = mix(lit(c, base, 0.9, 0.3), shade(base, 0.55), 0.55 * r);
          return { c: mix(col, "#ffffff", 0.3 * spec(c, 12)), size: 1 + 0.9 * r * r };
        },
      });
      k.add(shape, {
        share: 0.03,
        flat: 0.2,
        size: 0.8,
        opacity: 0.9,
        color: (c) => (spec(c, 30) > 0.42 ? keep(mix("#ffffff", base, 0.1)) : null),
      });
      k.cloud({ share: 0.22, size: 1.8 }, (rand) => {
        const d = randDir(rand);
        const p = mul(d, radius(d) * 0.94 * Math.cbrt(rand()));
        return { p, color: shade(base, 0.8), opacity: 0.14 };
      });
    },
  },

  pretzel: {
    controls: [{ key: "untwist", label: "Untwist", type: "pulse", ease: PRETZEL_SECS }],
    action: { key: "untwist", label: "Untwist" },
    // A tap undoes the pretzel the way it was made, backwards: the ends lift
    // off the bottom, the twist unwinds and the loops open, until it is a
    // U of dough rope (one end passing in front of the other). It hangs a
    // moment, then folds and twists back into a pretzel and settles.
    drive(t, c, out) {
      const s = since(c.untwist, PRETZEL_SECS);
      let m = 0;
      if (s >= 0) {
        const open = smooth(band(s, 0, 1.1));
        const close = smooth(band(s, 1.9, 2.95));
        m = open * (1 - close) + 0.035 * Math.sin((s - 1.1) * 6) * bump(s, 1.1, 1.3, 1.7, 1.9);
        m -= 0.06 * wobble(s - 2.95, 0.3, 20);
      }
      out.morph = [m, 0, 0, 0];
      cuesAt(c, "pretzel", s, [[1.9, { voice: "squish", pitch: 0.8, bright: 0.2, decay: 1.6 }]], out); // prettier-ignore
    },
    build(k) {
      const pts = [
        [-0.46, -0.42, 0.08],
        [-0.26, -0.2, 0.08],
        [-0.02, 0.06, 0.1],
        [0.26, 0.32, 0.04],
        [0.5, 0.52, 0],
        [0.78, 0.5, 0],
        [0.93, 0.2, 0],
        [0.86, -0.22, 0],
        [0.55, -0.55, 0],
        [0, -0.68, 0],
        [-0.55, -0.55, 0],
        [-0.86, -0.22, 0],
        [-0.93, 0.2, 0],
        [-0.78, 0.5, 0],
        [-0.5, 0.52, 0],
        [-0.26, 0.32, -0.04],
        [0.02, 0.06, -0.1],
        [0.26, -0.2, 0.08],
        [0.46, -0.42, 0.08],
      ];
      const rad = (t) => 0.085 + 0.06 * Math.exp(-(((t - 0.5) / 0.17) ** 2));
      const P = spline(pts);
      const shape = k.tube(P, rad, { caps: true, samples: 480, grid: 110 });
      const q = quatEuler(-16, 0, 0);
      const qi = [-q[0], -q[1], -q[2], q[3]];
      // The U of rope it untwists into: the bottom of the loop stays, and
      // each end rises in a straight arm (the first half's arm in front).
      const U = (t) => {
        if (t >= 0.35 && t <= 0.65) return P(t);
        const side = t < 0.5 ? 1 : -1;
        const a = t < 0.5 ? (0.35 - t) / 0.35 : (t - 0.65) / 0.35;
        return [side * (0.93 + 0.08 * a), 0.08 + 0.92 * a, side * 0.35 * a];
      };
      const tangent = (f, t) => unit(sub(f(Math.min(1, t + 1e-3)), f(Math.max(0, t - 1e-3))));
      const frame = (f, t) => {
        const T = tangent(f, t);
        const B = unit(sub([0, 0, 1], mul(T, T[2])));
        return { T, B, N: cross(B, T) };
      };
      // A point on the pretzel (recipe coordinates) and where it goes: the
      // same place across the rope, at the same point along it.
      const untwisted = (p, t) => {
        const lp = quatRotate(qi, p);
        const r = frame(P, t);
        const d = sub(lp, P(t));
        const [dn, db, dt] = [dot(d, r.N), dot(d, r.B), dot(d, r.T)];
        const u = frame(U, t);
        const to = add(U(t), add(add(mul(u.N, dn), mul(u.B, db)), mul(u.T, dt)));
        return quatRotate(q, to);
      };
      const along = (c) => c.t ?? (quatRotate(qi, c.p)[0] < 0 ? 0 : 1);
      k.add(shape, {
        quat: q,
        flat: 0.4,
        interior: 0.1,
        core: "#f0d4a0",
        to: (c) => untwisted(c.p, along(c)),
        channel: 0,
        color: (c) => {
          // The scored belly splits open along its top, showing pale dough.
          const belly = Math.exp(-(((c.t - 0.5) / 0.1) ** 2));
          const up = dot(c.n, unit([0, 0.8, 0.6]));
          const jag = 0.08 * c.noise(c.t * 80, 0, 0);
          if (belly > 0.35 && up > 0.72 + jag)
            return lit(c, mix("#f3d59a", "#e2b36a", c.rand() * 0.6), 0.85, 0.25);
          const col = mix(
            "#96501c",
            "#5e2b0c",
            0.45 + 0.4 * c.fbm(c.p[0] * 6, c.p[1] * 6, c.p[2] * 6, 3),
          );
          return glossy(c, col, 0.55, 22, 0.72, 0.42);
        },
      });
      // Coarse salt on the top side, carried along with the dough.
      k.cloud({ share: 0.012, size: 0.9, flat: 0.7, pattern: false }, (rand) => {
        const t = rand();
        const f = shape.frame(t);
        const a = rand() * TAU;
        const d = add(mul(f.n, Math.cos(a)), mul(f.b, Math.sin(a)));
        const dw = quatRotate(q, d);
        if (dw[2] < 0.25 || rand() < 0.4) return null;
        const p = quatRotate(q, add(f.p, mul(d, rad(t) * 1.02)));
        return {
          p,
          n: dw,
          color: mix("#ffffff", "#e8e4dc", rand()),
          opacity: 1,
          to: untwisted(p, t),
          channel: 0,
        };
      });
    },
  },

  croissant: {
    controls: [{ key: "bake", label: "Bake", type: "pulse", ease: CRO_SECS }],
    action: { key: "bake", label: "Bake" },
    // A tap bakes it: the croissant rises on its tray in a warm oven glow,
    // the oven dings, and flakes of crust spring off and scatter over the
    // tray. The glow fades, it sinks back a little, and the flakes hop home.
    drive(t, c, out, info) {
      const s = since(c.bake, CRO_SECS);
      const d = info.data;
      if (!d) return;
      const on = s >= 0;
      const rise = on ? smooth(band(s, 0, CRO_DING)) * (1 - smooth(band(s, 1.7, 2.5))) : 0;
      const scale = 1 + 0.17 * rise;
      out.parts.dough = { scale };
      const heat = on ? bump(s, 0.05, CRO_DING, 1.5, 2.4) : 0;
      out.morph = [heat, 0, 0, 0];
      out.glow = [1, 0.5, 0.12, 0.55];
      out.tokens = d.flakes.map((f) => {
        const seat = add(f.home, mul(sub(f.home, d.pivot), scale - 1));
        const t0 = CRO_DING + f.lag;
        const back = CRO_BACK + f.lag;
        if (!on || s < t0 || s >= back + 0.4)
          return { base: f.home, offset: sub(seat, f.home), visible: 0 };
        let p;
        let q;
        if (s < t0 + 0.55) {
          const g = (s - t0) / 0.55;
          p = hopTo(seat, f.land, g, 0.28);
          q = quatAxisAngle(f.axis, f.spin * g);
        } else {
          const b = s - t0 - 0.55;
          p = add(f.land, [0, 0.03 * Math.max(0, Math.sin((Math.PI * b) / 0.18)) * (b < 0.18 ? 1 : 0), 0]); // prettier-ignore
          q = quatAxisAngle(f.axis, f.spin);
        }
        let shown = 1;
        if (s >= back) {
          const g = smooth(band(s, back, back + 0.4));
          p = hopTo(f.land, f.home, g, 0.25);
          q = slerpQ(q, IDQ, g);
          // It melts back into the crust as it lands.
          shown = 1 - smooth(band(g, 0.7, 1));
        }
        return { base: f.home, offset: sub(p, f.home), quat: q, visible: shown };
      });
      cuesAt(
        c,
        "croissant",
        s,
        [
          [CRO_DING, { voice: "ding", f: "A6", decay: 1.3 }],
          [CRO_DING + 0.5, { voice: "crackle", f: 2600, n: 10, decay: 0.5, vol: 0.5 }],
          [CRO_BACK + 0.35, { voice: "patter", f: 1800, n: 6, decay: 0.4, vol: 0.4 }],
        ],
        out,
      );
    },
    build(k) {
      // A crescent of rolled dough: plump rolls in the middle, thin tips
      // curling in, each roll wrapping slightly on the slant.
      const curve = (t) => {
        const a = (t - 0.5) * 4.0;
        const dip = 0.12 * Math.pow(1 - Math.sin(Math.PI * t), 1.5);
        return [Math.sin(a) * 0.9, -dip, Math.cos(a) * 0.62 - 0.3];
      };
      const bulge = (t, u) =>
        Math.pow(0.5 + 0.5 * Math.cos(TAU * 5 * (t - 0.5 + 0.035 * Math.cos(u * TAU))), 0.6);
      const env = (t) => 0.3 * Math.pow(Math.sin(Math.PI * t), 1.1) + 0.02;
      const frame = levelFrames(curve);
      const shape = k.param(
        (u, v) => {
          const f = frame(v);
          const a = u * TAU;
          const r = env(v) * (0.62 + 0.38 * bulge(v, u));
          const off = add(mul(f.n, Math.cos(a) * r), mul(f.b, Math.sin(a) * r * 0.8));
          return add(f.p, off);
        },
        { grid: 100, thick: 0.25 },
      );
      // The dough rises about the middle of its underside; it glows (band,
      // channel 0) in the oven's heat.
      const pivot = [0, -0.2, -0.12];
      const dough = k.part("dough", { pivot });
      k.add(shape, {
        part: dough,
        kind: "band",
        params: [1, 0.45],
        channel: 0,
        flat: 0.25,
        interior: 0.1,
        core: (c) => {
          // Keep the crumb inside the thin tips.
          if (len(sub(c.p, c.lp)) > env(c.v) * 0.9) return null;
          return c.noise(c.p[0] * 30, c.p[1] * 30, c.p[2] * 30) > 0.1 ? "#f6e2b0" : "#e2bd7c";
        },
        color: (c) => crust(c, c.v, c.u),
      });
      // The crust's colour at (v along, u around).
      function crust(c, cv, cu) {
        const b = bulge(cv, cu);
        const under = smoothstep(-0.2, -0.7, c.n[1]);
        const tip = smoothstep(0.3, 0.05, Math.min(cv, 1 - cv));
        let col = mix("#f4d08e", "#c26a1f", smoothstep(0.2, 0.85, b));
        col = mix(col, "#9a5418", 0.5 * tip);
        col = mix(col, "#e9bb72", under * 0.7);
        col = shade(col, 0.93 + 0.12 * c.noise(c.p[0] * 40, c.p[1] * 40, c.p[2] * 40));
        return glossy(c, col, 0.55 * (1 - under), 20, 0.72, 0.42);
      }
      // A baking tray lined with paper.
      const trayY = -0.33;
      k.add(k.box(2.3, 0.05, 1.5), {
        pos: [0, trayY - 0.03, -0.1],
        flat: 0.2,
        weight: 0.6,
        color: (c) => (c.n[1] > 0.5 ? lit(c, "#5a5f66", 0.8, 0.3) : lit(c, "#3c4046", 0.8, 0.3)),
      });
      k.add(
        k.param((u, v) => [(u - 0.5) * 1.9, trayY + 0.004, (v - 0.5) * 1.2 - 0.1], {
          grid: 48,
          normal: () => [0, 1, 0],
        }),
        {
          flat: 0.15,
          weight: 0.7,
          kind: "band",
          params: [1.4, 0.45],
          channel: 0,
          color: (c) => {
            const crinkle = c.noise(c.p[0] * 9, c.p[2] * 9, 1.3);
            return lit(c, shade("#efe6d2", 0.94 + 0.1 * crinkle), 0.84, 0.2);
          },
        },
      );
      // Flakes of crust on the top, each a piece that can spring off.
      const flakes = [];
      for (let i = 0; i < 16; i++) {
        const v = 0.12 + 0.76 * ((i * 0.618 + 0.1) % 1);
        const u = 0.12 + 0.3 * k.rand();
        const f = frame(v);
        const a = u * TAU;
        const r = env(v) * (0.62 + 0.38 * bulge(v, u));
        const n = unit(add(mul(f.n, Math.cos(a)), mul(f.b, Math.sin(a))));
        if (n[1] < 0.2) continue;
        const home = add(add(f.p, add(mul(f.n, Math.cos(a) * r), mul(f.b, Math.sin(a) * r * 0.8))), mul(n, 0.012)); // prettier-ignore
        const out = unit([home[0], 0, home[2] + 0.12]);
        const reach = 0.35 + 0.3 * k.rand();
        const land = [clamp(home[0] + out[0] * reach, -0.88, 0.88), trayY + 0.02, clamp(home[2] + out[2] * reach, -0.66, 0.46)]; // prettier-ignore
        const token = flakes.length;
        flakes.push({ home, land, axis: randDir(k.rand), spin: 2 + 2 * k.rand(), lag: 0.03 * token }); // prettier-ignore
        const t1 = tangentDir(k.rand, n);
        const t2 = cross(n, t1);
        const w = 0.05 + 0.03 * k.rand();
        k.add(
          k.param((x, y) => add(mul(t1, (x - 0.5) * w * 1.6), add(mul(t2, (y - 0.5) * w), mul(n, 0.008 * Math.sin(Math.PI * x)))), { grid: 8, normal: () => n }), // prettier-ignore
          {
            pos: home,
            share: 0.001,
            flat: 0.3,
            kind: "token",
            params: [token, 0],
            // Hidden until it springs off (it would not glow with the crust);
            // golden like fresh crust, with a ragged edge.
            color: (c) => {
              const e = Math.hypot((c.u - 0.5) * 2, (c.v - 0.5) * 2);
              if (e > 0.8 + 0.25 * c.noise(c.u * 6 + token, c.v * 6, 0)) return null;
              return keep(mix(crust(c, v, u), "#ffc15a", 0.45));
            },
          },
        );
      }
      k.data = { flakes, pivot };
      k.reach([0, 0.6, 0]);
    },
  },

  pizza: {
    options: [
      {
        key: "topping",
        label: "Topping",
        type: "select",
        default: "pepperoni",
        choices: [
          { id: "pepperoni", label: "Pepperoni" },
          { id: "margherita", label: "Margherita" },
          { id: "veggie", label: "Veggie" },
          { id: "cheese", label: "Cheese" },
        ],
      },
    ],
    controls: [{ key: "serve", label: "Take a slice", type: "toggle", default: 0, ease: 1.1 }],
    action: { key: "serve", label: "Take a slice" },
    drive(t, c, out) {
      // Linear in the eased value, so the cheese strings (which grow in with
      // it) always reach the slice.
      const s = c.serve;
      out.grow = s;
      out.parts.slice = { offset: [PIZZA_OUT[0] * s, PIZZA_OUT[1] * s, PIZZA_OUT[2] * s] };
    },
    build(k, o) {
      const R = 0.9;
      const Rc = 0.95;
      const top = 0.06;
      const slices = 8;
      const span = TAU / slices;
      const a0 = PIZZA_AZ - span / 2;
      const slice = k.part("slice");
      const marg = o.topping === "margherita";
      const inSlice = (a) => {
        let d = a - PIZZA_AZ;
        d -= Math.round(d / TAU) * TAU;
        return Math.abs(d) < span / 2;
      };
      // A wooden board underneath.
      k.add(k.cylinder(1.13, 0.06), {
        pos: [0, -0.035, 0],
        flat: 0.2,
        color: (c) => {
          if (c.s.cap === "bottom") return "#6b4a2a";
          const g = c.fbm(c.p[0] * 2, c.p[2] * 14, 0.5, 3);
          return lit(c, mix("#c89660", "#9c6a3a", 0.5 + 0.5 * g), 0.74, 0.34);
        },
      });
      const cheese = (c, r, a) => {
        const n = c.fbm(c.p[0] * 6, c.p[2] * 6, 1.7, 4);
        const sauceEdge = smoothstep(R - 0.1, R - 0.02, r) * 0.8;
        let col;
        if (marg) {
          col = mix("#c7331f", "#a8261a", 0.5 + 0.5 * n);
        } else {
          col = mix("#fbd872", "#f4b53e", smoothstep(-0.1, 0.5, n));
          // Blistered golden spots.
          const b = c.noise(c.p[0] * 14, c.p[2] * 14, 3.3);
          if (b > 0.42) col = mix(col, "#c97a2a", smoothstep(0.42, 0.62, b));
          col = mix(
            col,
            "#c7331f",
            sauceEdge + (c.noise(c.p[0] * 9, c.p[2] * 9, 7) > 0.5 ? 0.6 : 0),
          );
        }
        // The cuts between slices.
        let d = (a - PIZZA_AZ) / span + 0.5;
        d = Math.abs(d - Math.round(d)) * span * r;
        if (d < 0.009 && r > 0.03) return keep(shade(col, 0.55));
        return mix(lit(c, col, 0.8, 0.28), "#ffffff", 0.25 * spec(c, 20));
      };
      const crust = (c) => {
        const n = c.noise(c.p[0] * 10, c.p[1] * 10, c.p[2] * 10);
        let col = mix("#e7b56a", "#c78638", smoothstep(-0.2, 0.6, c.n[1] + 0.3 * n));
        if (c.noise(c.p[0] * 22, c.p[1] * 22, c.p[2] * 22) > 0.5) col = "#8a5424";
        return lit(c, col, 0.75, 0.38);
      };
      // Each piece: the cheesy top, the puffy crust, the base and the cut sides.
      const piece = (from, to, part) => {
        const w = to - from;
        k.add(
          k.param(
            (u, v) => {
              const a = from + u * w;
              const r = v * R;
              return [Math.sin(a) * r, top + 0.006 * Math.sin(a * 17 + r * 23), Math.cos(a) * r];
            },
            { grid: 64, normal: () => [0, 1, 0], thick: 0.05 },
          ),
          {
            part,
            flat: 0.15,
            interior: 0.08,
            core: (c) => (c.p[1] > 0.035 ? "#c7331f" : "#f1d9a6"),
            color: (c) => cheese(c, c.v * R, from + c.u * w),
          },
        );
        k.add(
          k.param(
            (u, v) => {
              const a = from + u * w;
              const ph = v * TAU;
              const rr = 0.075 * (1 + 0.14 * k.noise(Math.sin(a) * 5, Math.cos(a) * 5, ph));
              const r = Rc + rr * Math.cos(ph);
              return [Math.sin(a) * r, 0.045 + rr * Math.sin(ph) * 0.85, Math.cos(a) * r];
            },
            { grid: 64 },
          ),
          { part, flat: 0.2, color: crust },
        );
        k.add(
          k.param(
            (u, v) => {
              const a = from + u * w;
              const r = v * Rc;
              return [Math.sin(a) * r, 0.0, Math.cos(a) * r];
            },
            { grid: 32, normal: () => [0, -1, 0] },
          ),
          { part, flat: 0.15, color: "#d9a55c" },
        );
        for (const [a, s] of [
          [from, -1],
          [to, 1],
        ]) {
          k.add(
            k.param((u, v) => [Math.sin(a) * u * Rc, v * top, Math.cos(a) * u * Rc], {
              grid: 24,
              normal: () => [s * Math.cos(a), 0, -s * Math.sin(a)],
            }),
            {
              part,
              flat: 0.15,
              color: (c) =>
                c.p[1] > top * 0.7 ? "#f6c75a" : c.p[1] > top * 0.5 ? "#c7331f" : "#efd6a0",
            },
          );
        }
      };
      piece(a0, a0 + span, slice);
      piece(a0 + span, a0 + TAU, 0);
      // Toppings, each on the slice part when it sits on the slice.
      const spots = [];
      const rings = [
        [0, 1],
        [0.36, 6],
        [0.66, 11],
      ];
      for (const [r, n] of rings) {
        for (let i = 0; i < n; i++) {
          const a = (i / n) * TAU + k.rand() * 0.3 + r;
          const rr = r ? r + (k.rand() - 0.5) * 0.08 : 0.05;
          spots.push([Math.sin(a) * rr, Math.cos(a) * rr, a]);
        }
      }
      const partAt = (x, z) => (inSlice(Math.atan2(x, z)) ? slice : 0);
      const leaf = k.param(
        (u, v) => {
          const x = (u - 0.5) * 0.2;
          const w = 0.055 * Math.pow(Math.max(0, 1 - ((2 * x) / 0.2) ** 2), 0.6);
          const z = (v - 0.5) * 2 * w;
          return [x, 0.012 * (1 - (z / 0.06) ** 2), z];
        },
        { grid: 24, normal: () => [0, 1, 0] },
      );
      const basil = (x, z, rot) =>
        k.add(leaf, {
          pos: [x, top + 0.02, z],
          rot: [0, rot, 0],
          part: partAt(x, z),
          flat: 0.15,
          weight: 2,
          pattern: false,
          color: (c) =>
            Math.abs(c.lp[2]) < 0.004
              ? "#7fbf5a"
              : glossy(
                  c,
                  mix("#2f8a32", "#1e6b25", smoothstep(0, 0.05, Math.abs(c.lp[2]))),
                  0.6,
                  20,
                ),
        });
      if (o.topping === "pepperoni") {
        const pep = k.cylinder(0.1, 0.018);
        for (const [x, z] of spots) {
          k.add(pep, {
            pos: [x, top + 0.012, z],
            part: partAt(x, z),
            flat: 0.2,
            weight: 1.3,
            color: (c) => {
              if (c.s.side) return "#7d1510";
              const r = c.s.radial ?? 0;
              let col = mix("#c02a1c", "#7d1510", smoothstep(0.75, 1, r));
              if (c.noise(c.p[0] * 60, c.p[2] * 60, 2) > 0.45) col = mix(col, "#e8836a", 0.6);
              return glossy(c, col, 0.5, 20);
            },
          });
        }
        for (let i = 0; i < 5; i++) {
          const a = i * 1.3 + 0.4;
          basil(Math.sin(a) * (0.2 + i * 0.12), Math.cos(a) * (0.2 + i * 0.12), a * 57);
        }
      } else if (marg) {
        for (const [x, z] of spots) {
          if (k.rand() < 0.25) continue;
          const s = 0.09 + k.rand() * 0.05;
          k.add(k.ellipsoid(s, 0.025, s * (0.8 + k.rand() * 0.3)), {
            pos: [x, top + 0.01, z],
            rot: [0, k.rand() * 180, 0],
            part: partAt(x, z),
            flat: 0.3,
            color: (c) =>
              lit(
                c,
                mix(
                  "#fffaf0",
                  "#e9c27a",
                  0.35 * smoothstep(0.3, 0.9, c.fbm(c.p[0] * 12, c.p[2] * 12, 0, 2) + 0.5),
                ),
                0.84,
                0.2,
              ),
          });
        }
        for (let i = 0; i < 9; i++) {
          const a = i * 2.1 + 0.2;
          const r = 0.15 + ((i * 0.37) % 1) * 0.6;
          basil(Math.sin(a) * r, Math.cos(a) * r, a * 80);
        }
      } else if (o.topping === "veggie") {
        for (let i = 0; i < spots.length; i++) {
          const [x, z, a] = spots[i];
          const part = partAt(x, z);
          const kind = i % 4;
          if (kind === 0) {
            k.add(k.torus(0.06, 0.012), {
              pos: [x, top + 0.012, z],
              part,
              weight: 2,
              flat: 0.3,
              color: (c) => glossy(c, "#1e1a1a", 0.6, 20),
            });
          } else if (kind === 1) {
            k.add(k.torus(0.09, 0.014), {
              pos: [x, top + 0.012, z],
              scale: [1, 1, 0.7],
              rot: [0, a * 57, 0],
              part,
              weight: 2,
              flat: 0.3,
              color: (c) => glossy(c, "#3f9a2c", 0.5, 20),
            });
          } else if (kind === 2) {
            k.add(k.ellipsoid(0.08, 0.018, 0.06), {
              pos: [x, top + 0.014, z],
              rot: [0, a * 57, 0],
              part,
              weight: 2,
              color: (c) =>
                lit(
                  c,
                  mix(
                    "#d9c2a0",
                    "#8a6a48",
                    smoothstep(0.6, 1, Math.hypot(c.lp[0] / 0.08, c.lp[2] / 0.06)),
                  ),
                ),
            });
          } else {
            k.add(k.torus(0.075, 0.01), {
              pos: [x, top + 0.012, z],
              scale: [1, 1, 0.8],
              part,
              weight: 2,
              flat: 0.3,
              color: (c) => lit(c, "#8a3a7a"),
            });
          }
        }
      }
      // Strings of melted cheese that stretch as the slice comes away.
      for (let i = 0; i < 5; i++) {
        const side = i % 2 ? a0 : a0 + span;
        const r = 0.25 + i * 0.13;
        const start = [Math.sin(side) * r, top + 0.005, Math.cos(side) * r];
        const end = add(start, PIZZA_OUT);
        const curve = (t) => {
          const p = add(start, mul(sub(end, start), t));
          return [p[0], p[1] - 0.05 * Math.sin(Math.PI * t), p[2]];
        };
        k.add(
          k.tube(curve, (t) => 0.011 * (1 - 0.5 * Math.sin(Math.PI * t)), {
            samples: 64,
            grid: 32,
          }),
          {
            flat: 0.4,
            weight: 3,
            kind: "grow",
            params: (c) => [0.02 + 0.97 * (c.t ?? 0), 0],
            color: "#f9d77a",
          },
        );
      }
      k.reach(add([Math.sin(PIZZA_AZ) * 1.0, top, Math.cos(PIZZA_AZ) * 1.0], PIZZA_OUT));
    },
  },

  burger: {
    controls: [{ key: "explode", label: "Explode view", type: "toggle", default: 0, ease: 1.2 }],
    action: { key: "explode", label: "Explode view" },
    drive(t, c, out) {
      const e = easeInOut(c.explode);
      BURGER_LAYERS.forEach((name, i) => {
        out.parts[name] = { offset: [0, e * 0.24 * (i + 1), 0] };
      });
    },
    build(k) {
      const [patty, cheese, lettuce, tomato, topBun] = BURGER_LAYERS.map((n) =>
        k.part(n, { pivot: [0, 0.5, 0] }),
      );
      const crumb = (c) =>
        shade("#f3dcae", 0.9 + 0.15 * c.noise(c.p[0] * 40, c.p[1] * 40, c.p[2] * 40));
      // Bottom bun: toasted sides, pale cut face on top.
      k.add(
        revolve(k, [
          [0, 0],
          [0.7, 0],
          [0.8, 0.04],
          [0.84, 0.13],
          [0.82, 0.21],
          [0.76, 0.25],
          [0.4, 0.255],
          [0, 0.255],
        ]),
        {
          flat: 0.22,
          interior: 0.1,
          core: crumb,
          color: (c) =>
            c.n[1] > 0.85 && c.p[1] > 0.2
              ? crumb(c)
              : lit(c, mix("#d59a4a", "#b8752e", smoothstep(0.1, -0.8, c.n[1]))),
        },
      );
      // The patty.
      k.add(
        revolve(
          k,
          [
            [0, 0.25],
            [0.8, 0.25],
            [0.88, 0.29],
            [0.9, 0.35],
            [0.88, 0.41],
            [0.8, 0.45],
            [0, 0.45],
          ],
          (a) => 1 + 0.025 * Math.sin(a * 5 + 1) + 0.015 * Math.sin(a * 11),
        ),
        {
          part: patty,
          flat: 0.3,
          interior: 0.1,
          core: "#7a4428",
          color: (c) => {
            const n = c.fbm(c.p[0] * 14, c.p[1] * 14, c.p[2] * 14, 3);
            let col = mix("#6e3f22", "#3d2012", smoothstep(-0.3, 0.5, n));
            if (c.noise(c.p[0] * 45, c.p[1] * 45, c.p[2] * 45) > 0.45) col = "#9a6238";
            return glossy(c, col, 0.3, 16, 0.72, 0.42);
          },
        },
      );
      // A slice of cheese melting over the edge.
      const S = 0.76;
      k.add(
        k.param(
          (u, v) => {
            const x = (u - 0.5) * 2 * S;
            const z = (v - 0.5) * 2 * S;
            const r = Math.hypot(x, z);
            const droop = 0.3 * Math.pow(smoothstep(0.84, 1.08, r), 1.2);
            const pull = 1 - 0.1 * smoothstep(0.84, 1.08, r);
            return [x * pull, 0.462 - droop, z * pull];
          },
          { grid: 64, flip: true },
        ),
        {
          rot: [0, 22, 0],
          part: cheese,
          flat: 0.2,
          weight: 1.2,
          color: (c) => glossy(c, "#f8b62a", 0.55, 22, 0.8, 0.3),
        },
      );
      // Frilly lettuce.
      k.add(
        k.param(
          (u, v) => {
            const a = u * TAU;
            const r = (0.3 + 0.66 * v) * (1 + 0.05 * v * Math.sin(a * 7));
            const y = 0.5 + v * v * (0.035 * Math.sin(a * 13 + v * 4) - 0.02);
            return [Math.sin(a) * r, y, Math.cos(a) * r];
          },
          { grid: 72, flip: true },
        ),
        {
          part: lettuce,
          flat: 0.2,
          color: (c) => {
            const r = Math.hypot(c.p[0], c.p[2]);
            const vein = Math.abs(Math.sin(Math.atan2(c.p[0], c.p[2]) * 18)) < 0.08;
            const col = mix("#4f9d2c", "#b7e06a", smoothstep(0.6, 0.97, r));
            return lit(c, vein ? mix(col, "#d8f0a0", 0.5) : col, 0.78, 0.35);
          },
        },
      );
      // Tomato slices.
      for (let i = 0; i < 3; i++) {
        const a = (i / 3) * TAU + 0.5;
        k.add(k.cylinder(0.34, 0.07), {
          pos: [Math.sin(a) * 0.33, 0.57, Math.cos(a) * 0.33],
          rot: [0, i * 40, 0],
          part: tomato,
          flat: 0.2,
          color: (c) => {
            if (c.s.side) return glossy(c, "#d8291c", 0.6, 20);
            const r = c.s.radial ?? 0;
            const ang = c.u * TAU;
            if (r > 0.86) return "#cc2418";
            const chamber = r > 0.3 && r < 0.78 && Math.cos(ang * 4) > -0.2;
            if (chamber) {
              const seed = c.noise(c.p[0] * 50, c.p[2] * 50, 1) > 0.35;
              return seed ? "#f2c46a" : "#f26a4c";
            }
            return lit(c, "#e8402a", 0.85, 0.2);
          },
        });
      }
      // The top bun, glossy with sesame seeds.
      const dome = revolve(k, [
        [0, 0.63],
        [0.8, 0.63],
        [0.87, 0.68],
        [0.88, 0.76],
        [0.82, 0.9],
        [0.66, 1.03],
        [0.4, 1.11],
        [0, 1.14],
      ]);
      k.add(dome, {
        part: topBun,
        flat: 0.22,
        interior: 0.1,
        core: crumb,
        color: (c) => {
          if (c.n[1] < -0.85) return crumb(c);
          const col = mix("#e0a24e", "#b7671f", smoothstep(0.7, 1.12, c.p[1]));
          return glossy(c, col, 0.5, 18, 0.74, 0.4);
        },
      });
      const domeAt = radiusAt([
        [0.88, 0.76],
        [0.82, 0.9],
        [0.66, 1.03],
        [0.4, 1.11],
        [0, 1.14],
      ]);
      k.cloud({ share: 0.02, size: 0.8, part: topBun, pattern: false }, (rand) => {
        const y = 0.8 + rand() * 0.33;
        const r = domeAt(y);
        const a = rand() * TAU;
        const p = [Math.sin(a) * r, y + 0.006, Math.cos(a) * r];
        const n = unit([p[0], 0.9, p[2]]);
        return {
          p,
          dir: tangentDir(rand, n),
          stretch: 1.9,
          color: mix("#fbf0d2", "#e8d2a0", rand()),
          opacity: 1,
        };
      });
      k.reach([0, 1.14 + 0.6, 0]);
    },
  },

  sushi: {
    controls: [{ key: "dip", label: "Pick up and dip", type: "pulse", ease: SUSHI_SECS }],
    action: { key: "dip", label: "Pick up and dip" },
    // A tap lifts the chopsticks off the board as if by an invisible hand.
    // They open over a roll, come down and pinch it (click), carry it over
    // to the soy sauce and dip it twice, bring it back and set it down
    // (click), and lie back down on the board.
    drive(t, c, out, info) {
      const s = since(c.dip, SUSHI_SECS);
      const d = info.data;
      if (!d) return;
      const on = s >= 0;
      const roll = d.roll;
      // The roll's centre over time (it rides between the tips when held).
      const above = add(roll, [0, 0.34, 0]);
      const overDish = [d.dish[0], 0.45, d.dish[2]];
      const inDish = [d.dish[0], d.dish[1] + 0.13, d.dish[2]];
      const keys = [
        [SUSHI_T.grab, roll],
        [SUSHI_T.grab + 0.55, above],
        [SUSHI_T.grab + 1.05, overDish],
        [SUSHI_T.grab + 1.3, inDish],
        [SUSHI_T.grab + 1.45, overDish],
        [SUSHI_T.grab + 1.62, inDish],
        [SUSHI_T.grab + 1.8, overDish],
        [SUSHI_T.grab + 2.4, above],
        [SUSHI_T.drop, roll],
      ];
      let at = roll;
      let swing = 0;
      if (on && s > keys[0][0] && s < keys[keys.length - 1][0]) {
        for (let i = 1; i < keys.length; i++) {
          if (s <= keys[i][0]) {
            const f = smooth(band(s, keys[i - 1][0], keys[i][0]));
            at = lerp3(keys[i - 1][1], keys[i][1], f);
            swing = 0.12 * Math.sin(Math.PI * f) * (keys[i][1][0] < keys[i - 1][1][0] ? 1 : -1);
            break;
          }
        }
      }
      out.parts.roll = {
        offset: sub(at, roll),
        quat: quatAxisAngle([Math.cos(0.45), 0, -Math.sin(0.45)], swing * 0.5),
      };
      // The chopsticks: lying on the board, or held in the invisible hand
      // (tips either side of the roll, open or closed).
      const S = [Math.cos(0.45), 0, -Math.sin(0.45)];
      const D = unit([0.6, 0.5, 0.3]);
      const spread = 0.26 - 0.07 * (on ? bump(s, SUSHI_T.grab - 0.15, SUSHI_T.grab, SUSHI_T.drop, SUSHI_T.drop + 0.15) : 0); // prettier-ignore
      const low = on ? bump(s, SUSHI_T.lift, SUSHI_T.grab - 0.15, SUSHI_T.drop + 0.15, SUSHI_T.lay) : 0; // prettier-ignore
      const tipsAt = add(at, [0, 0.22 * (1 - low), 0]);
      const held = on ? smooth(bump(s, 0, SUSHI_T.lift, SUSHI_T.lay, SUSHI_SECS - 0.2)) : 0;
      d.sticks.forEach((st, i) => {
        const sign = i ? 1 : -1;
        const tip = add(tipsAt, mul(S, sign * spread));
        const base = add(add(tipsAt, mul(D, st.len)), mul(S, sign * 0.04));
        const hc = mul(add(tip, base), 0.5);
        const hq = quatFromTo([1, 0, 0], unit(sub(tip, base)));
        const lift = 0.35 * hop(held);
        const cen = add(lerp3(st.center, hc, held), [0, lift, 0]);
        out.parts[`stick${i}`] = { offset: sub(cen, st.center), quat: slerpQ(IDQ, hq, held) };
      });
      cuesAt(
        c,
        "sushi",
        s,
        [
          [SUSHI_T.grab, { voice: "wood", f: "B6", decay: 0.4 }],
          [SUSHI_T.grab + 1.3, { voice: "drip", f: 900, n: 1, vol: 0.4 }],
          [SUSHI_T.grab + 1.62, { voice: "drip", f: 1000, n: 1, vol: 0.4 }],
          [SUSHI_T.drop, { voice: "wood", f: "A6", decay: 0.4 }],
          [SUSHI_SECS - 0.15, { voice: "clack", f: 2200, decay: 0.5, vol: 0.5 }],
        ],
        out,
      );
    },
    build(k) {
      // A wooden board.
      // (A plain box: the rounded box left a thin band across its middle.)
      k.add(k.box(2.6, 0.12, 1.3), {
        pos: [0, -0.06, 0],
        flat: 0.2,
        color: (c) => {
          const g = c.fbm(c.p[0] * 1.5, c.p[2] * 18, 0.3, 3);
          return lit(c, mix("#d7ae78", "#a97b48", 0.5 + 0.5 * g), 0.74, 0.34);
        },
      });
      const grain = (c) => {
        const n = c.noise(c.p[0] * 70, c.p[1] * 70, c.p[2] * 70);
        return lit(c, shade("#f8f5ee", 0.86 + 0.14 * Math.abs(n) * 2), 0.8, 0.3);
      };
      // Nigiri: a pillow of rice and a draped slice of fish.
      const nigiri = (x, z, yaw, fish) => {
        k.add(k.roundedBox(0.52, 0.2, 0.3, 3.2), {
          pos: [x, 0.1, z],
          rot: [0, yaw, 0],
          flat: 0.35,
          interior: 0.08,
          core: "#f4f0e6",
          color: grain,
        });
        const slab = bentSlab(k, 0.66, 0.06, 0.36, 3.5, 0.28);
        k.add(slab, {
          pos: [x, 0.225, z],
          rot: [0, yaw, 0],
          flat: 0.25,
          interior: 0.06,
          core: fish === "salmon" ? "#f48a5e" : "#b81c34",
          color: (c) => {
            if (fish === "salmon") {
              const f = (c.lp[0] * 1.2 + c.lp[2] * 0.7) * 14;
              const line = Math.abs(f - Math.round(f)) < 0.12;
              return glossy(c, line ? "#fde2d0" : "#f47a4d", 0.7, 30, 0.8, 0.3);
            }
            const s = c.noise(c.p[0] * 12, c.p[2] * 30, 0);
            return glossy(c, mix("#c21f3a", "#9c1428", 0.5 + 0.5 * s), 0.8, 30, 0.8, 0.3);
          },
        });
      };
      nigiri(-0.82, 0.02, 8, "salmon");
      nigiri(-0.24, 0.1, -6, "tuna");
      // Maki rolls: nori outside, rice, and a filling.
      const fills = [
        ["#f47a4d", "#f47a4d"],
        ["#7cc242", "#b8e07a"],
        ["#ffd23f", "#7cc242"],
      ];
      const rollPart = k.part("roll", { pivot: [0.36, 0.11, 0.12] });
      [
        [0.36, 0.12],
        [0.74, 0.02],
        [1.08, 0.16],
      ].forEach(([x, z], i) => {
        const [f1, f2] = fills[i];
        k.add(k.cylinder(0.18, 0.22), {
          pos: [x, 0.11, z],
          rot: [0, i * 50, 0],
          part: i === 0 ? rollPart : 0,
          flat: 0.25,
          interior: 0.08,
          core: "#f4f0e6",
          color: (c) => {
            if (c.s.side) {
              const n = c.noise(c.p[0] * 40, c.p[1] * 40, c.p[2] * 40);
              return glossy(c, shade("#23301f", 0.9 + 0.2 * n), 0.35, 16, 0.75, 0.4);
            }
            const r = c.s.radial ?? 0;
            if (r > 0.93) return "#1c2619";
            if (r > 0.42) return grain(c);
            const a = c.u * TAU;
            return keep(lit(c, Math.sin(a * 2) > 0 ? f1 : f2, 0.85, 0.25));
          },
        });
      });
      // Wasabi and pickled ginger.
      k.add(
        revolve(
          k,
          [
            [0.16, 0],
            [0.15, 0.05],
            [0.1, 0.11],
            [0.03, 0.15],
            [0, 0.16],
          ],
          (a, y) => 1 + 0.12 * Math.sin(a * 3 + y * 20),
        ),
        {
          pos: [1.0, 0, -0.38],
          flat: 0.3,
          weight: 1.5,
          color: (c) =>
            lit(c, shade("#9cc43c", 0.9 + 0.2 * c.noise(c.p[0] * 30, c.p[1] * 30, c.p[2] * 30))),
        },
      );
      for (let i = 0; i < 5; i++) {
        const petal = k.param(
          (u, v) => {
            const a = (u - 0.5) * 2.2;
            const r = 0.12 * v;
            return [Math.sin(a) * r, 0.02 + v * v * 0.06 + 0.02 * Math.cos(a * 2), Math.cos(a) * r];
          },
          { grid: 20 },
        );
        k.add(petal, {
          pos: [0.55 + (i % 3) * 0.07, 0.01 + i * 0.012, -0.38 + (i % 2) * 0.06],
          rot: [0, i * 70, 0],
          flat: 0.2,
          weight: 1.5,
          opacity: 0.85,
          color: (c) => lit(c, mix("#f9c9c4", "#f3a6a6", c.v), 0.85, 0.25),
        });
      }
      // A little dish of soy sauce at the front, with nothing in front of it.
      const dish = [-0.98, 0, 0.42];
      k.add(
        revolve(
          k,
          [
            [0, 0.005],
            [0.15, 0.005],
            [0.19, 0.02],
            [0.215, 0.06],
            [0.228, 0.075],
          ],
          null,
          { flip: true, grid: 64 },
        ),
        {
          pos: dish,
          flat: 0.2,
          weight: 1.2,
          color: (c) => glossy(c, "#f6f3ec", 0.8, 40, 0.76, 0.3),
        },
      );
      k.add(topDisc(k, 0.2), {
        pos: add(dish, [0, 0.045, 0]),
        flat: 0.15,
        weight: 1.5,
        color: (c) => glossy(c, "#2e1608", 0.9, 50, 0.8, 0.3),
      });
      // Chopsticks along the front, each a part the invisible hand moves.
      const sticks = [];
      for (const dz of [0, 0.07]) {
        const center = [0.42, 0.025, 0.5 + dz];
        sticks.push({ center, len: 2.0 });
        k.add(k.cone(0.024, 0.013, 2.0), {
          pos: center,
          part: k.part(`stick${sticks.length - 1}`, { pivot: center }),
          rot: [0, 0, -90],
          flat: 0.3,
          weight: 1.5,
          color: (c) =>
            c.lp[1] > 0.72 ? lit(c, "#1d1a18") : glossy(c, "#b5262e", 0.6, 24, 0.75, 0.4),
        });
      }
      k.data = { roll: [0.36, 0.11, 0.12], dish, sticks };
      k.reach([0.3, 0.8, 0]);
    },
  },

  taco: {
    controls: [{ key: "snap", label: "Break in half", type: "pulse", ease: TACO_SECS }],
    action: { key: "snap", label: "Break in half" },
    // A tap snaps the shell across the middle with a crunch. The halves
    // pull apart and swing open like a book, showing the filling packed in
    // each break (meat, lettuce, cheese and tomato), and bits spill out onto
    // the plate and bounce. Then the bits hop back in and the halves close.
    drive(t, c, out, info) {
      const s = since(c.snap, TACO_SECS);
      const d = info.data;
      if (!d) return;
      const on = s >= 0;
      const open = on ? easeOut(band(s, 0.08, 0.65)) * (1 - smooth(band(s, 2.2, 2.8))) : 0;
      const jolt = on ? 0.03 * wobble(s, 0.3, 30) : 0;
      for (const [name, side] of [
        ["tacoL", -1],
        ["tacoR", 1],
      ]) {
        const turn = side < 0 ? -TACO_TURN : TACO_TURN;
        out.parts[name] = {
          quat: quatAxisAngle([0, 1, 0], turn * open),
          offset: [side * (0.42 * open + jolt), 0.08 * open, 0.1 * open],
        };
      }
      out.tokens = d.bits.map((bt) => {
        if (!on || s < bt.t0) return { base: bt.home };
        const u = s - bt.t0;
        const back = TACO_BACK + bt.lag;
        const fall = bounce(u, bt.h, 0.4, 12, 0.3);
        const f = Math.min(1, u / bt.t1);
        let p = [bt.home[0] + bt.dx * f, bt.floor + fall.y, bt.home[2] + bt.dz * f];
        let q = quatAxisAngle(bt.axis, bt.spin * f);
        if (s >= back) {
          const g = smooth(band(s, back, back + 0.4));
          p = hopTo(p, bt.home, g, 0.2);
          q = slerpQ(q, IDQ, g);
        }
        return { base: bt.home, offset: sub(p, bt.home), quat: q };
      });
      const list = [
        [2.78, { voice: "crunch", f: 1800, n: 6, decay: 0.5, vol: 0.5 }],
        ...d.bits.map((bt, i) => [bt.t0 + bt.t1, { voice: "thud", f: 180 + 30 * (i % 4), bright: 0.3, decay: 0.3, vol: 0.35 }]), // prettier-ignore
      ];
      cuesAt(c, "taco", s, list, out);
    },
    build(k) {
      const R = 0.95;
      const rho = 0.46;
      const yaw = 0;
      const xb = 0.02;
      const L = k.part("tacoL", { pivot: [xb, 0, 0] });
      const Rt = k.part("tacoR", { pivot: [xb, 0, 0] });
      // The shell cracks along a jagged line across the middle.
      const jag = (p) => {
        const ph = Math.atan2(p[2], rho - p[1]);
        return 0.045 * (Math.abs((((ph / TAU) * 9 + 20) % 1) - 0.5) * 4 - 1);
      };
      const side = (p) => (p[0] < xb + jag(p) ? L : Rt);
      const shellAt = (u, v, off = 0) => {
        const x = (u * 2 - 1) * R;
        const W = Math.sqrt(Math.max(0, R * R - x * x)) * 0.985;
        const w = (v * 2 - 1) * W;
        const ph = w / rho;
        const rr = rho - off;
        return [x, rho - rr * Math.cos(ph), rr * Math.sin(ph)];
      };
      const shellColor = (inner) => (c) => {
        const n = c.fbm(c.p[0] * 5, c.p[1] * 5, c.p[2] * 5, 3);
        let col = mix("#f0c255", "#d9982e", smoothstep(-0.2, 0.6, n));
        if (c.noise(c.p[0] * 40, c.p[1] * 40, c.p[2] * 40) > 0.5) col = "#b97822";
        if (inner) col = shade(col, 0.85);
        return lit(c, col, 0.74, 0.38);
      };
      for (const inner of [false, true]) {
        k.add(
          k.param((u, v) => shellAt(u, v, inner ? 0.025 : 0), { grid: 72, flip: inner }),
          {
            rot: [0, yaw, 0],
            flat: 0.2,
            part: (c) => side(c.p),
            color: shellColor(inner),
          },
        );
      }
      // The filling, packed between the walls; heights are relative to the
      // rim at each point along the taco, so it peeks just over the edge.
      const q = quatEuler(0, yaw, 0);
      const inU = (rand, lo, hi, spread = 0.86, reach = 0.8) => {
        const x = (rand() * 2 - 1) * reach;
        const W = Math.sqrt(R * R - x * x);
        const top = rho * (1 - Math.cos(W / rho));
        const y = Math.max(0.06, top + lo + rand() * (hi - lo));
        const ph = Math.acos(clamp(1 - Math.min(y, top) / rho, -1, 1));
        const z = (rand() * 2 - 1) * rho * Math.sin(ph) * spread;
        return quatRotate(q, [x, y, z]);
      };
      const byX = (p) => (p[0] < xb ? L : Rt);
      k.cloud({ share: 0.16, size: 1.5, flat: 0.6 }, (rand) => {
        const p = inU(rand, -0.4, -0.02, 0.8);
        const n = randDir(rand);
        const l = Math.max(0, dot(n, LIGHT));
        return {
          p,
          n,
          part: byX(p),
          color: shade(mix("#7a4322", "#4a2512", rand()), 0.7 + 0.5 * l),
        };
      });
      k.cloud({ share: 0.12, size: 0.95, pattern: false }, (rand) => {
        const p = inU(rand, -0.1, 0.07, 0.95, 0.84);
        const d = unit([rand() - 0.5, (rand() - 0.1) * 0.9, (rand() - 0.5) * 0.6]);
        return {
          p,
          dir: d,
          stretch: 3.5,
          part: byX(p),
          color: shade(mix("#b5e35f", "#62b52f", rand()), 0.85 + 0.25 * rand()),
          opacity: 1,
        };
      });
      k.cloud({ share: 0.04, size: 0.8, pattern: false }, (rand) => {
        const p = inU(rand, 0.0, 0.09, 0.85, 0.75);
        return {
          p,
          dir: unit([rand() - 0.5, rand() * 0.3, rand() - 0.5]),
          stretch: 3.2,
          part: byX(p),
          color: mix("#ffc23a", "#f58f1a", rand()),
          opacity: 1,
        };
      });
      // The filling seen in each break: meat below, then lettuce, cheese and
      // tomato near the rim, inside a thin edge of shell.
      const top0 = rho * (1 - Math.cos((R * 0.985) / rho));
      const face = (c, y, z) => {
        const wall = rho - Math.hypot(z, rho - y);
        if (wall < 0.028) return keep(lit(c, mix("#e2a843", "#c98a2e", c.rand()), 0.8, 0.3));
        const h = y - (top0 - 0.12);
        const n = c.noise(z * 30, y * 30, 0.5);
        if (h > 0.02 && n > 0.35) return keep(mix("#e8321f", "#f0654c", c.rand()));
        if (h > -0.02 && n < -0.25) return keep(mix("#ffc23a", "#f58f1a", c.rand()));
        if (h > -0.07) return keep(mix("#b5e35f", "#62b52f", 0.5 + 0.5 * n));
        // Seasoned mince, with bits of tomato and melted cheese through it.
        const g = c.noise(z * 45, y * 45, 2.5);
        const bit = c.noise(z * 22, y * 22, 7.1);
        if (bit > 0.5) return keep(mix("#d8452a", "#b83220", c.rand()));
        if (bit < -0.55) return keep(mix("#f6b73a", "#e89a24", c.rand()));
        return keep(shade(mix("#9a5a32", "#5e3018", 0.5 + 0.5 * g), 0.95 + 0.25 * c.rand()));
      };
      for (const [part, dx, nx] of [
        [L, -0.004, 1],
        [Rt, 0.004, -1],
      ]) {
        k.add(
          k.param(
            (u, v) => {
              const z = (u * 2 - 1) * rho * 0.995;
              const yb = rho - Math.sqrt(Math.max(0, rho * rho - z * z));
              return [xb + dx, yb + v * Math.max(0, top0 + 0.02 - yb), z];
            },
            { grid: 48, normal: () => [nx, 0, 0] },
          ),
          {
            part,
            share: 0.03,
            flat: 0.3,
            pattern: false,
            color: (c) => face(c, c.p[1], c.p[2]),
          },
        );
      }
      // Tomato cubes: those near the break spill out (tokens), the others
      // go with their half.
      const bits = [];
      for (let i = 0; i < 16; i++) {
        const p = inU(k.rand, 0.0, 0.06, 0.7, 0.7);
        const near = Math.abs(p[0] - xb) < 0.28 && bits.length < 7;
        const rot = [k.rand() * 90, k.rand() * 90, 0];
        k.add(k.box(0.075, 0.07, 0.075), {
          pos: p,
          rot,
          flat: 0.3,
          weight: 2,
          pattern: false,
          ...(near ? { kind: "token", params: [bits.length, 0] } : { part: byX(p) }),
          color: (c) => glossy(c, c.s.face % 2 ? "#e8321f" : "#f0654c", 0.4, 16),
        });
        if (near) bits.push({ home: p });
      }
      // Crumbles of meat and shreds of lettuce that spill too.
      for (let i = 0; i < 9; i++) {
        const token = bits.length;
        const lettuce = i % 3 === 2;
        const p = quatRotate(q, [xb + (k.rand() - 0.5) * 0.3, top0 - 0.08 - 0.12 * k.rand(), (k.rand() - 0.5) * 0.3]); // prettier-ignore
        bits.push({ home: p });
        k.cloud({ count: lettuce ? 70 : 90, size: lettuce ? 0.9 : 1.2, pattern: false }, (rand) => {
          const d = randDir(rand);
          const pp = add(p, mul(d, (lettuce ? 0.05 : 0.04) * Math.cbrt(rand())));
          return lettuce
            ? { p: pp, dir: randDir(rand), stretch: 3, color: mix("#b5e35f", "#62b52f", rand()), opacity: 1, kind: "token", params: [token, 0] } // prettier-ignore
            : { p: pp, n: d, flat: 0.6, color: shade(mix("#7a4322", "#4a2512", rand()), 0.8 + 0.4 * rand()), kind: "token", params: [token, 0] }; // prettier-ignore
        });
      }
      // Where each bit falls to: out of the break, onto the plate in front.
      const floor = -0.01;
      bits.forEach((bt, i) => {
        const a = 0.2 + (i / bits.length) * 2.6 + 0.3 * k.rand();
        const r = 0.25 + 0.3 * k.rand();
        bt.dx = Math.cos(a) * r * 0.9;
        bt.dz = 0.35 + Math.sin(a) * r * 0.6;
        bt.h = bt.home[1] - floor - 0.03;
        bt.floor = floor + 0.03;
        bt.t0 = 0.18 + 0.035 * i;
        bt.t1 = landings(bt.h, 0.4, 12, 0.3, 1)[0];
        bt.axis = randDir(k.rand);
        bt.spin = 1 + 2 * k.rand();
        bt.lag = 0.03 * (bits.length - i);
      });
      k.data = { bits };
      // A plate underneath.
      k.add(
        revolve(
          k,
          [
            [0, -0.05],
            [0.9, -0.05],
            [1.12, -0.02],
            [1.22, 0.04],
            [1.26, 0.06],
          ],
          null,
          { flip: true, grid: 96 },
        ),
        {
          flat: 0.2,
          weight: 0.8,
          color: (c) => {
            const r = Math.hypot(c.p[0], c.p[2]);
            const band2 = r > 1.02 && r < 1.07 ? 0.85 : 1;
            return glossy(c, shade("#f4f1ea", band2), 0.7, 40, 0.78, 0.3);
          },
        },
      );
    },
  },

  egg: {
    options: [
      {
        key: "shell",
        label: "Shell",
        type: "select",
        default: "brown",
        choices: [
          { id: "brown", label: "Brown" },
          { id: "white", label: "White" },
        ],
      },
      { key: "cup", label: "Egg cup", type: "color", default: "#8fd6c8" },
    ],
    controls: [{ key: "crack", label: "Cracked open", type: "toggle", default: 0, ease: 0.9 }],
    action: { key: "crack", label: "Crack" },
    drive(t, c, out) {
      const e = easeInOut(c.crack);
      out.parts.cap = { angle: -2.0 * e, offset: [0, 0.06 * Math.sin(Math.PI * e), 0] };
      out.grow = c.crack;
    },
    build(k, o) {
      const shellCol = o.shell === "white" ? "#f5efe3" : "#d9a06c";
      const eggPts = [
        [0, -0.6],
        [0.25, -0.56],
        [0.42, -0.4],
        [0.5, -0.16],
        [0.49, 0.1],
        [0.42, 0.34],
        [0.3, 0.53],
        [0.15, 0.65],
        [0, 0.69],
      ];
      const eggR = radiusAt(eggPts);
      const crackY = (a) => {
        const f = (a / TAU) * 13;
        return 0.29 + 0.035 * (Math.abs(f - Math.floor(f) - 0.5) * 4 - 1);
      };
      const shellColor = (c, below) => {
        const a = Math.atan2(c.p[0], c.p[2]);
        const cy = crackY(a);
        if (below ? c.p[1] > cy : c.p[1] < cy) return null;
        let col = shade(shellCol, 0.94 + 0.1 * c.noise(c.p[0] * 20, c.p[1] * 20, c.p[2] * 20));
        if (o.shell !== "white" && c.noise(c.p[0] * 70, c.p[1] * 70, c.p[2] * 70) > 0.5)
          col = shade(col, 0.75);
        return glossy(c, col, 0.3, 18, 0.74, 0.38);
      };
      const egg = revolve(k, eggPts, null, { grid: 96, thick: 0.45 });
      const cutY = 0.27;
      k.add(egg, {
        flat: 0.2,
        interior: 0.1,
        core: (c) =>
          c.p[1] > cutY - 0.01
            ? null
            : Math.hypot(c.p[0], c.p[1] - 0.1, c.p[2]) < 0.22
              ? "#ffb81c"
              : "#fbf8f0",
        color: (c) => shellColor(c, true),
      });
      const cap = k.part("cap", { pivot: [0, 0.3, -0.44], axis: [1, 0, 0] });
      k.add(egg, { part: cap, flat: 0.2, color: (c) => shellColor(c, false) });
      // Inside: the white and a runny golden yolk, and the cap's white underside.
      k.add(topDisc(k, eggR(cutY) - 0.012), {
        pos: [0, cutY, 0],
        flat: 0.2,
        color: (c) => lit(c, "#fbf8f0", 0.85, 0.2),
      });
      k.add(k.ellipsoid(0.21, 0.11, 0.21), {
        pos: [0, cutY, 0],
        flat: 0.25,
        weight: 1.5,
        pattern: false,
        color: (c) => (c.lp[1] < 0 ? null : glossy(c, "#ffb21a", 0.9, 30, 0.82, 0.3)),
      });
      k.add(topDisc(k, eggR(0.31) - 0.01), {
        pos: [0, 0.31, 0],
        rot: [180, 0, 0],
        part: cap,
        flat: 0.2,
        color: "#f6f2e8",
      });
      // A drip of yolk down the shell once it is open.
      const dripA = 0.5;
      k.add(
        k.tube(
          (t) => {
            const y = cutY + 0.02 - t * 0.3;
            const r = eggR(y) + 0.015;
            return [Math.sin(dripA) * r, y, Math.cos(dripA) * r];
          },
          (t) => 0.03 + 0.018 * smoothstep(0.7, 0.95, t),
          { caps: true, samples: 64, grid: 32 },
        ),
        {
          flat: 0.3,
          weight: 2,
          pattern: false,
          kind: "grow",
          params: (c) => [0.55 + 0.4 * (c.t ?? 0), 0],
          color: (c) => glossy(c, "#ffb21a", 0.8, 24),
        },
      );
      // The egg cup.
      k.add(
        revolve(k, [
          [0, -0.97],
          [0.42, -0.97],
          [0.46, -0.93],
          [0.42, -0.88],
          [0.2, -0.8],
          [0.16, -0.68],
          [0.2, -0.58],
          [0.38, -0.48],
          [0.5, -0.3],
          [0.54, -0.1],
          [0.54, -0.04],
        ]),
        {
          flat: 0.2,
          color: (c) => {
            // White polka dots on the glaze.
            const a = Math.atan2(c.p[0], c.p[2]);
            const row = Math.round((c.p[1] + 0.1) / 0.13);
            const n = 10;
            const f = (a / TAU) * n + (row % 2) * 0.5;
            const du = (f - Math.round(f)) * (TAU / n) * Math.hypot(c.p[0], c.p[2]);
            const dv = c.p[1] + 0.1 - row * 0.13;
            const spot = row >= -3 && row <= 0 && Math.hypot(du, dv) < 0.032;
            return glossy(c, spot ? "#fffdf8" : o.cup, 0.8, 40, 0.74, 0.34);
          },
        },
      );
      // Toast soldiers.
      for (let i = 0; i < 2; i++) {
        k.add(k.roundedBox(0.22, 0.86, 0.2, 6), {
          pos: [0.8 + i * 0.28, -0.56 + i * 0.02, 0.2 - i * 0.25],
          rot: [0, 20 + i * 15, -16 + i * 7],
          flat: 0.25,
          interior: 0.08,
          core: "#f3dfae",
          color: (c) => {
            const ax = Math.abs(c.ln[0]);
            const az = Math.abs(c.ln[2]);
            const crustSide = ax > az ? 1 : 0;
            const n = c.noise(c.p[0] * 30, c.p[1] * 30, c.p[2] * 30);
            const col = crustSide
              ? mix("#a8642a", "#7d4418", 0.5 + 0.5 * n)
              : mix("#e8b667", "#c98a3e", 0.5 + 0.5 * n);
            return lit(c, col, 0.74, 0.38);
          },
        });
      }
      k.reach([0, 0.75, -1.0]);
    },
  },

  coffee: {
    alive: true,
    options: [
      {
        key: "art",
        label: "Latte art",
        type: "select",
        default: "heart",
        choices: [
          { id: "heart", label: "Heart" },
          { id: "rosetta", label: "Rosetta" },
          { id: "tulip", label: "Tulip" },
        ],
      },
      { key: "cup", label: "Cup", type: "color", default: "#f4f1ec" },
    ],
    controls: [
      { key: "hot", label: "Steam", type: "slider", default: 0.7 },
      { key: "stir", label: "Stir", type: "pulse", ease: 3.2 },
    ],
    action: { key: "stir", label: "Stir" },
    // A stir spins the coffee twice round and twists the latte art into a
    // swirl (the middle turns further than the edge) that relaxes back as it
    // stops, while a puff of steam curls up.
    drive(t, c, out) {
      const p = 1 - c.stir;
      const turn = TAU * 2 * easeInOut(p);
      const twist = c.stir > 0 ? 3.2 * Math.sin(Math.PI * smoothstep(0, 0.9, p)) : 0;
      for (let i = 0; i < COFFEE_RINGS; i++)
        out.parts[`coffee${i}`] = { angle: turn + twist * (1 - (i + 0.5) / COFFEE_RINGS) };
      out.parts.puff = {
        visible: c.stir > 0 ? smoothstep(0, 0.1, p) * (1 - smoothstep(0.7, 1, p)) : 0,
      };
      out.amount = 0.3 + c.hot + 0.8 * c.stir;
    },
    build(k, o) {
      const cup = o.cup;
      const ceramic = (c) => glossy(c, cup, 0.85, 45, 0.76, 0.3);
      // Saucer.
      k.add(
        revolve(
          k,
          [
            [0, 0.0],
            [0.33, 0.0],
            [0.36, 0.02],
            [0.4, 0.015],
            [0.75, 0.045],
            [0.93, 0.09],
            [0.98, 0.105],
          ],
          null,
          { flip: true },
        ),
        { flat: 0.2, color: ceramic },
      );
      // The cup: outside, inside wall above the coffee, rim and handle.
      k.add(
        revolve(k, [
          [0.24, 0.02],
          [0.33, 0.04],
          [0.42, 0.12],
          [0.51, 0.33],
          [0.57, 0.53],
          [0.6, 0.66],
        ]),
        {
          flat: 0.2,
          interior: 0.06,
          core: (c) => (c.p[1] > 0.54 ? null : Math.hypot(c.p[0], c.p[2]) > 0.5 ? cup : "#5a3418"),
          color: ceramic,
        },
      );
      k.add(
        revolve(
          k,
          [
            [0.53, 0.55],
            [0.56, 0.6],
            [0.585, 0.66],
          ],
          null,
          { flip: true },
        ),
        { flat: 0.2, color: (c) => shade(cup, 0.9) },
      );
      k.add(k.torus(0.592, 0.014), { pos: [0, 0.662, 0], flat: 0.3, weight: 1.5, color: ceramic });
      k.add(
        k.tube(
          spline([
            [0.54, 0.5, 0],
            [0.74, 0.55, 0],
            [0.84, 0.42, 0],
            [0.74, 0.24, 0],
            [0.48, 0.18, 0],
          ]),
          0.045,
        ),
        { scale: [1, 1, 0.8], flat: 0.25, weight: 1.3, color: ceramic },
      );
      // The coffee with latte art, on a part that turns when stirred.
      // It is made of rings, each a part, so a stir can twist the art.
      const art = LATTE[o.art] || LATTE.heart;
      for (let i = 0; i < COFFEE_RINGS; i++) {
        const r0 = (0.545 * i) / COFFEE_RINGS;
        const r1 = (0.545 * (i + 1)) / COFFEE_RINGS;
        const ring = k.param(
          (u, v) => {
            const a = u * TAU;
            const r = r0 + (r1 - r0) * v;
            return [Math.sin(a) * r, 0, Math.cos(a) * r];
          },
          { grid: i < 2 ? 24 : 48, normal: () => [0, 1, 0] },
        );
        k.add(ring, {
          pos: [0, 0.58, 0],
          part: k.part(`coffee${i}`, { pivot: [0, 0.58, 0], axis: [0, 1, 0] }),
          flat: 0.15,
          weight: 1.6,
          color: (c) => {
            const x = c.lp[0] / 0.545;
            const z = c.lp[2] / 0.545;
            const r = Math.hypot(x, z);
            let col = mix("#c98d52", "#7a4520", smoothstep(0.62, 1.0, r));
            col = mix(col, "#a86a36", 0.3 * c.noise(x * 8, z * 8, 1));
            const a = art(x, -z);
            if (a > 0) col = mix(col, "#fbf3e4", smoothstep(0, 0.06, a));
            return keep(mix(col, "#ffffff", 0.2 * spec(c, 30)));
          },
        });
      }
      // A thicker puff of steam that curls up while it is stirred.
      const puff = k.part("puff");
      k.cloud({ share: 0.012, size: 2.6, pattern: false }, (rand) => {
        const a = rand() * TAU;
        const r = 0.3 * Math.sqrt(rand());
        return {
          p: [Math.sin(a) * r, 0.64 + rand() * 0.05, Math.cos(a) * r],
          color: "#ffffff",
          opacity: 0.16,
          kind: "rise",
          params: [0.9 + rand() * 0.4, rand()],
          part: puff,
        };
      });
      // Steam curling up.
      k.cloud({ share: 0.02, size: 2.4, pattern: false }, (rand) => {
        const a = rand() * TAU;
        const r = 0.25 * Math.sqrt(rand());
        return {
          p: [Math.sin(a) * r, 0.64 + rand() * 0.05, Math.cos(a) * r],
          color: "#ffffff",
          opacity: 0.08,
          kind: "rise",
          params: [0.7 + rand() * 0.3, rand()],
        };
      });
      // A teaspoon on the saucer.
      const q = quatEuler(0, 58, 0);
      k.add(k.ellipsoid(0.12, 0.03, 0.08), {
        quat: q,
        pos: add([0, 0.07, 0], quatRotate(q, [0.3, 0, 0.62])),
        flat: 0.25,
        weight: 1.5,
        color: (c) => glossy(c, mix("#aeb4bd", "#e4e8ee", 0.5 + 0.5 * c.n[1]), 0.9, 30),
      });
      k.add(k.cone(0.022, 0.014, 0.62), {
        quat: quatMul(q, quatEuler(0, 0, 90)),
        pos: add([0, 0.08, 0], quatRotate(q, [0.3, 0, 0.62 - 0.4])),
        flat: 0.3,
        weight: 1.6,
        color: (c) => glossy(c, "#c3c8cf", 0.9, 30),
      });
      k.reach([0, 1.4, 0]);
    },
  },

  apple: {
    options: [
      {
        key: "variety",
        label: "Apple",
        type: "select",
        default: "red",
        choices: [
          { id: "red", label: "Red" },
          { id: "green", label: "Green" },
          { id: "golden", label: "Golden" },
        ],
      },
    ],
    controls: [{ key: "bite", label: "Take a bite", type: "toggle", default: 0, ease: APPLE_SECS }], // prettier-ignore
    action: { key: "bite", label: "Take a bite" },
    // A tap takes a bite: the chunk comes away and vanishes, leaving a
    // scalloped bite of pale flesh (it stays bitten). The next tap brings a
    // little worm out of the bite: it looks about, ducks back in, and the
    // apple grows whole again.
    drive(t, c, out, info) {
      const d = info.data;
      if (!d) return;
      const m = mem(c);
      const v = c.bite;
      if (v > (m.v ?? 0) + 1e-6) m.dir = 1;
      else if (v < (m.v ?? 0) - 1e-6) {
        if (m.dir !== -1) m.v0 = m.v ?? 1;
        m.dir = -1;
      }
      m.v = v;
      // Leaving the bitten state plays the worm and the healing over the
      // way back down (all of it, even if the bite had not quite settled).
      const leaving = m.dir === -1 && v > 0;
      const s = leaving ? (1 - v / Math.max(m.v0 ?? 1, 1e-3)) * APPLE_SECS : -1;
      // The chunk: gone once bitten, back as it heals at the end.
      let gone = v > 0 ? smooth(band(v * APPLE_SECS, 0, 0.18)) : 0;
      if (leaving) gone = 1 - smooth(band(s, APPLE_SECS - 0.75, APPLE_SECS - 0.1));
      const away = m.dir === 1 ? gone : 0;
      out.morph = [gone, 0, 0, 0];
      out.parts.bite = { offset: mul(d.out, 0.3 * away) };
      // The worm, out of the bite while the apple is leaving its bitten state.
      const head = leaving ? 0.34 * bump(s, 0.15, 0.65, 1.75, 2.15) : 0;
      const look = leaving ? 0.5 * Math.sin((s - 0.65) * 5.5) * bump(s, 0.6, 0.8, 1.55, 1.75) : 0;
      const nod = leaving ? 0.25 * Math.sin((s - 0.65) * 9) * bump(s, 0.6, 0.8, 1.55, 1.75) : 0;
      out.tokens = d.worm.map((w, i) => {
        const sg = head - w.at;
        const p = d.path(sg, look);
        const q = i === 0 ? quatMul(quatAxisAngle([0, 1, 0], look * 1.2), quatAxisAngle(d.side, -nod)) : IDQ; // prettier-ignore
        return { base: w.home, offset: sub(p, w.home), quat: q, visible: sg > 0.005 ? 1 : 0 };
      });
      cuesAt(c, "apple", s, [[0.3, { voice: "squeak", f: 1300, to: 1.4, decay: 0.5, vol: 0.4 }]], out); // prettier-ignore
    },
    build(k, o) {
      const [skin, blush, deep] = {
        red: ["#c81d2a", "#f2b13e", "#7a0d17"],
        green: ["#8cc63f", "#e2e66a", "#4c8a22"],
        golden: ["#f1cc48", "#f59a38", "#c29522"],
      }[o.variety];
      const pts = [
        [0, -0.37],
        [0.1, -0.43],
        [0.36, -0.45],
        [0.6, -0.3],
        [0.72, -0.02],
        [0.7, 0.24],
        [0.56, 0.43],
        [0.33, 0.49],
        [0.14, 0.41],
        [0.03, 0.34],
        [0, 0.33],
      ];
      // The bite: a few overlapping spheres (the teeth) on the side towards
      // you. Skin and flesh inside them are the chunk that comes away (it
      // fades on channel 0); under it lies the bitten surface.
      const rAt = radiusAt(pts);
      const inApple = (p) => Math.hypot(p[0], p[2]) < rAt(p[1]) * 0.995 && p[1] > -0.42 && p[1] < 0.45; // prettier-ignore
      const az = 0.9;
      const nOut = [Math.sin(az), 0, Math.cos(az)];
      const tang = [Math.cos(az), 0, -Math.sin(az)];
      const surf = add(mul(nOut, 0.72), [0, 0.02, 0]);
      const teeth = [-0.17, 0, 0.17].map((d, i) => ({
        at: add(add(surf, mul(nOut, 0.14)), add(mul(tang, d), [0, 0.04 * (i === 1 ? -1 : 1), 0])),
        r: 0.29,
      }));
      const inBite = (p) => teeth.some((t) => len(sub(p, t.at)) < t.r);
      const coreColor = (c) => {
        const [x, y, z] = c.p;
        const r = Math.hypot(x, z);
        const a = Math.atan2(x, z);
        if (Math.abs(y) < 0.2 && r < 0.17 * (0.55 + 0.45 * Math.abs(Math.cos(a * 2.5)))) {
          for (let i = 0; i < 5; i++) {
            const sa = (i / 5) * TAU;
            if (
              Math.hypot(x - Math.sin(sa) * 0.1, (y + 0.02) * 0.7, z - Math.cos(sa) * 0.1) < 0.035
            )
              return keep("#4a2a14");
          }
          return "#efe0b2";
        }
        return shade("#f8f0cf", 0.95 + 0.08 * c.noise(x * 20, y * 20, z * 20));
      };
      const skinColor = (c) => {
        const [x, y, z] = c.p;
        const a = Math.atan2(x, z);
        const streak = c.fbm(Math.sin(a) * 2.5, y * 10, Math.cos(a) * 2.5, 3);
        let col = mix(
          skin,
          blush,
          clamp(0.35 * smoothstep(-0.1, 0.5, streak) + 0.35 * smoothstep(0.1, -0.5, y), 0, 1),
        );
        col = mix(col, deep, 0.35 * smoothstep(0.2, 0.8, c.fbm(x * 3, y * 3, z * 3, 2) + 0.4));
        // Around the stalk the skin turns yellowish and shaded.
        const r = Math.hypot(x, z);
        if (y > 0.28 && r < 0.3) col = mix(col, shade(blush, 0.7), 0.5 * (1 - r / 0.3));
        if (c.noise(x * 80, y * 80, z * 80) > 0.62) col = mix(col, "#fff2c8", 0.3);
        return glossy(c, col, 0.8, 38, 0.72, 0.4);
      };
      k.add(
        revolve(k, pts, (a) => 1 + 0.012 * Math.sin(a * 5 + 0.5), { grid: 96, thick: 0.6 }),
        {
          flat: 0.2,
          interior: 0.12,
          core: (c) => (inBite(c.p) ? null : coreColor(c)),
          color: (c) => (inBite(c.p) ? null : skinColor(c)),
        },
      );
      const bite = k.part("bite", { pivot: surf });
      // The chunk's skin (a window of the surface round the bite) and its flesh.
      const wob = (a) => 1 + 0.012 * Math.sin(a * 5 + 0.5);
      k.add(
        k.param(
          (u, v) => {
            const a = az - 0.55 + u * 1.1;
            const y = -0.3 + v * 0.66;
            const r = rAt(y) * wob(a);
            return [Math.sin(a) * r, y, Math.cos(a) * r];
          },
          {
            grid: 40,
            normal: (u, v) => {
              const a = az - 0.55 + u * 1.1;
              const y = -0.3 + v * 0.66;
              const dr = (rAt(y + 0.01) - rAt(y - 0.01)) / 0.02;
              return unit([Math.sin(a), -dr, Math.cos(a)]);
            },
          },
        ),
        {
          part: bite,
          kind: "fade",
          params: [0.2, 0.5],
          channel: 0,
          flat: 0.2,
          color: (c) => (inBite(c.p) ? skinColor(c) : null),
        },
      );
      k.cloud({ share: 0.02, part: bite, kind: "fade", params: [0.2, 0.5], channel: 0 }, (rand) => {
        const p = add(surf, [(rand() - 0.5) * 0.7, (rand() - 0.5) * 0.7, (rand() - 0.5) * 0.7]);
        if (!inApple(p) || !inBite(p)) return null;
        return { p, color: shade("#f8f0cf", 0.95 + 0.08 * rand()), opacity: 0.9, size: 1.4 };
      });
      // The bitten surface: the insides of the teeth spheres, within the
      // apple, pale flesh with a thin line of skin at its rim.
      for (const t of teeth) {
        k.add(k.sphere(t.r), {
          pos: t.at,
          share: 0.04,
          size: 1.25,
          flat: 0.3,
          jitter: 0.01,
          color: (c) => {
            if (!inApple(c.p)) return null;
            if (teeth.some((o2) => o2 !== t && len(sub(c.p, o2.at)) < o2.r * 0.999)) return null;
            const edge = Math.hypot(c.p[0], c.p[2]) / rAt(c.p[1]);
            if (edge > 0.975) return keep(skinColor(c));
            // Deeper in, a little yellower; lit as a hollow (inward normal),
            // with a shadow under the top edge.
            const depth = clamp((1 - edge) / 0.25, 0, 1);
            const fibre = c.noise(c.p[0] * 30, c.p[1] * 30, c.p[2] * 30);
            let col = mix("#fbf4dc", "#eedcaa", 0.6 * depth + 0.3 * (0.5 + 0.5 * fibre));
            col = mix(col, "#d9c07e", 0.35 * smoothstep(0.93, 0.975, edge));
            const l = dot(mul(c.n, -1), LIGHT);
            return keep(shade(col, 0.86 + 0.2 * l - 0.08 * depth));
          },
        });
      }
      // The worm: a head with eyes and six body beads, each a piece that
      // follows the path out of the bite. They are built where they are
      // when it is all the way out.
      const E = add(surf, mul(nOut, -0.12));
      const up = [0, 1, 0];
      const path = (sg, look = 0) => {
        if (sg <= 0) return add(E, mul(nOut, sg));
        const sway = mul(tang, look * sg * sg * 1.6);
        return add(add(add(E, mul(nOut, sg * 0.75)), mul(up, sg * sg * 2.2)), sway);
      };
      const worm = [];
      const full = 0.34;
      for (let i = 0; i < 7; i++) {
        const at = i * 0.048;
        const home = path(full - at);
        const token = i;
        worm.push({ at, home });
        const r = i === 0 ? 0.06 : 0.048 - 0.003 * i;
        k.add(k.sphere(r), {
          pos: home,
          share: i === 0 ? 0.006 : 0.003,
          flat: 0.3,
          pattern: false,
          kind: "token",
          params: [token, 0],
          color: (c) => keep(glossy(c, mix("#9fd35a", "#6fae33", 0.5 + 0.5 * c.noise(c.p[0] * 60, c.p[1] * 60, 0)), 0.6, 20)), // prettier-ignore
        });
        if (i === 0) {
          // Eyes and a smile, facing out of the bite.
          const face = unit(add(nOut, [0, 0.35, 0]));
          for (const sd of [-1, 1]) {
            const eye = add(add(home, mul(face, 0.05)), add(mul(tang, sd * 0.025), [0, 0.02, 0]));
            k.add(k.sphere(0.018), {
              pos: eye,
              share: 0.0015,
              pattern: false,
              kind: "token",
              params: [0, 0],
              color: (c) => keep(dot(c.n, face) > 0.5 ? "#141414" : "#ffffff"),
            });
          }
          k.cloud({ count: 60, pattern: false, size: 0.5 }, (rand) => {
            const a = (rand() - 0.5) * 1.6;
            const p = add(add(home, mul(face, 0.057)), add(mul(tang, Math.sin(a) * 0.025), [0, -0.012 - 0.008 * Math.cos(a), 0])); // prettier-ignore
            return { p, color: "#2a3a14", opacity: 1, kind: "token", params: [0, 0] };
          });
        }
      }
      k.data = { worm, path, side: tang, out: nOut };
      k.add(
        k.tube(
          spline([
            [0, 0.32, 0],
            [0.015, 0.45, 0],
            [0.06, 0.6, 0.01],
          ]),
          (t) => 0.03 - 0.01 * t,
          { caps: true },
        ),
        { flat: 0.3, weight: 2.5, pattern: false, color: (c) => lit(c, "#6b4524") },
      );
      k.add(leafShape(k, 0.56, 0.17, 0.35), {
        pos: [0.03, 0.52, 0],
        rot: [8, -40, 20],
        flat: 0.2,
        weight: 1.6,
        pattern: false,
        color: leafColor("#3f8f2f", "#9fd06a"),
      });
    },
  },

  banana: {
    options: [
      {
        key: "ripe",
        label: "Ripeness",
        type: "select",
        default: "ripe",
        choices: [
          { id: "green", label: "Green" },
          { id: "ripe", label: "Just right" },
          { id: "spotty", label: "Spotty" },
        ],
      },
    ],
    controls: [{ key: "peel", label: "Peel one", type: "pulse", ease: BANANA_SECS }],
    action: { key: "peel", label: "Peel one" },
    // A tap peels the front banana from its tip: its skin splits into three
    // strips that curl back one after another (each bending at two places),
    // showing the pale fruit inside; then they fold back up around it.
    drive(t, c, out, info) {
      const s = since(c.peel, BANANA_SECS);
      const d = info.data;
      if (!d) return;
      const on = s >= 0;
      out.tokens = [];
      d.strips.forEach((st, j) => {
        const t0 = 0.08 + 0.22 * j;
        const close = on ? smooth(band(s, 2.1 + 0.05 * j, 2.75 + 0.05 * j)) : 0;
        const fa = on ? easeOut(band(s, t0, t0 + 0.5)) * (1 - close) : 0;
        const fb = on ? easeOut(band(s, t0 + 0.12, t0 + 0.62)) * (1 - close) : 0;
        const qa = quatAxisAngle(st.axisA, BANANA_BEND[0] * fa);
        const qb = quatMul(qa, quatAxisAngle(st.axisB, BANANA_BEND[1] * fb));
        const offB = sub(add(quatRotate(qa, sub(st.hingeB, st.hingeA)), st.hingeA), st.hingeB);
        out.tokens[st.a] = { base: st.hingeA, quat: qa };
        out.tokens[st.b] = { base: st.hingeB, quat: qb, offset: offB };
      });
      cuesAt(
        c,
        "banana",
        s,
        [1, 2].map((j) => [0.08 + 0.22 * j, { voice: "tear", f: 900 + 150 * j, to: 1.5, decay: 0.7, vol: 0.7 }]), // prettier-ignore
        out,
      );
    },
    build(k, o) {
      const yellow = o.ripe === "green" ? "#a9c93a" : "#f6d43a";
      const Rb = 1.0;
      // One banana: a smiling arc from its neck (t = 0) to its tip.
      const arc = (t) => {
        const a = -1.05 + t * 1.9;
        return [Math.sin(a) * Rb, Rb - Math.cos(a) * Rb, 0];
      };
      const rad = (t) =>
        t < 0.1
          ? 0.05 + 0.06 * smoothstep(0.02, 0.1, t)
          : 0.03 + 0.14 * Math.pow(Math.sin(Math.PI * clamp((t - 0.04) / 0.98, 0, 1)), 0.55);
      const shape = k.tube(arc, rad, { caps: true, samples: 200, grid: 80 });
      const color = (c) => {
        const t = c.t ?? 0.5;
        const edge = smoothstep(0.8, 1, Math.cos(c.u * TAU * 5));
        let col = mix(
          yellow,
          "#8fae2e",
          smoothstep(0.25, 0.04, t) * (o.ripe === "green" ? 0.3 : 1),
        );
        if (t > 0.97) col = "#3a2716";
        if (t < 0.035) col = "#6b5a2a";
        if (o.ripe === "spotty" && c.noise(c.p[0] * 22, c.p[1] * 22, c.p[2] * 22) > 0.35)
          col = mix(col, "#6b4520", 0.8);
        else if (c.noise(c.p[0] * 60, c.p[1] * 60, c.p[2] * 60) > 0.62)
          col = mix(col, "#8a6a2a", 0.5);
        col = shade(col, 1 - 0.12 * edge);
        return glossy(c, col, 0.35, 20, 0.74, 0.38);
      };
      const bananas = [
        { rot: [0, -24, -6], pos: [0, 0, -0.18] },
        { rot: [0, 4, 4], pos: [0, 0.02, 0] },
        { rot: [0, 30, 12], pos: [0, 0.05, 0.18] },
      ];
      for (const b of bananas.slice(0, 2)) {
        k.add(shape, {
          ...b,
          flat: 0.22,
          interior: 0.1,
          core: "#f8ecc4",
          color,
        });
      }
      // The front banana peels: its skin from BANANA_HINGE to the tip is
      // three strips (two pieces each, bending where they meet), with a
      // pale inside, over the fruit.
      const front = bananas[2];
      const qf = quatEuler(...front.rot);
      const toW = (p) => add(front.pos, quatRotate(qf, p));
      const dirW = (v) => quatRotate(qf, v);
      const th = BANANA_HINGE;
      const tm = (th + 1) / 2;
      const around = (t, a, r) => {
        const f = shape.frame(t);
        const d = add(mul(f.n, Math.cos(a)), mul(f.b, Math.sin(a)));
        return { p: add(f.p, mul(d, r)), d, f };
      };
      // A strip of the tube's surface: t from t0 to t1, angle a0 to a1.
      const skinPatch = (t0, t1, a0, a1, scale, inward) =>
        k.param(
          (u, v) => {
            const t = t0 + v * (t1 - t0);
            return around(t, a0 + u * (a1 - a0), rad(t) * scale).p;
          },
          {
            grid: 40,
            normal: (u, v) => {
              const t = t0 + v * (t1 - t0);
              const d = around(t, a0 + u * (a1 - a0), 1).d;
              return inward ? mul(d, -1) : d;
            },
          },
        );
      const skinAt = (c, t, a) => color(Object.assign({}, c, { t, u: a / TAU }));
      k.add(skinPatch(0, th, 0, TAU, 1, false), {
        quat: qf,
        pos: front.pos,
        flat: 0.22,
        color: (c) => skinAt(c, c.v * th, c.u * TAU),
      });
      // The fruit.
      k.add(
        k.param(
          (u, v) => {
            const t = th - 0.02 + v * (0.995 - th + 0.02);
            return around(t, u * TAU, rad(t) * 0.84).p;
          },
          { grid: 64, normal: (u, v) => around(th + v * (1 - th), u * TAU, 1).d },
        ),
        {
          quat: qf,
          pos: front.pos,
          flat: 0.3,
          weight: 1.2,
          pattern: false,
          color: (c) => {
            const ridge = 0.5 + 0.5 * Math.cos(c.u * TAU * 5);
            const col = mix("#f7ebbf", "#efdca0", 0.35 * ridge + 0.2 * c.noise(c.p[0] * 20, c.p[1] * 20, c.p[2] * 20)); // prettier-ignore
            return keep(glossy(c, col, 0.35, 18, 0.8, 0.3));
          },
        },
      );
      const strips = [];
      let tok = 0;
      for (let j = 0; j < 3; j++) {
        const a0 = (j / 3) * TAU + 0.35;
        const a1 = ((j + 1) / 3) * TAU + 0.35;
        const am = (a0 + a1) / 2;
        const ta = tok++;
        const tb = tok++;
        const ha = around(th, am, rad(th));
        const hb = around(tm, am, rad(tm));
        strips.push({
          a: ta,
          b: tb,
          hingeA: toW(ha.p),
          hingeB: toW(hb.p),
          axisA: unit(dirW(cross(ha.f.t, ha.d))),
          axisB: unit(dirW(cross(hb.f.t, hb.d))),
        });
        for (const [t0, t1, token] of [
          [th, tm, ta],
          [tm, 1, tb],
        ]) {
          k.add(skinPatch(t0, t1, a0, a1, 1, false), {
            quat: qf,
            pos: front.pos,
            flat: 0.22,
            kind: "token",
            params: [token, 0],
            color: (c) => skinAt(c, t0 + c.v * (t1 - t0), a0 + c.u * (a1 - a0)),
          });
          k.add(skinPatch(t0, t1, a0 + 0.04, a1 - 0.04, 0.93, true), {
            quat: qf,
            pos: front.pos,
            flat: 0.22,
            weight: 0.8,
            pattern: false,
            kind: "token",
            params: [token, 0],
            color: (c) => keep(lit(c, mix("#f3e6c0", "#e8d7a6", c.rand() * 0.5), 0.84, 0.25)),
          });
        }
      }
      k.data = { strips };
      k.reach(add(toW(arc(1)), [0, 0.5, 0.3]));
      // The crown where the stalks meet.
      const top = arc(0);
      k.add(
        k.tube(
          spline([
            add(top, [0.02, 0.0, 0]),
            add(top, [-0.08, 0.06, 0]),
            add(top, [-0.18, 0.08, 0]),
          ]),
          0.065,
          { caps: true },
        ),
        { flat: 0.3, weight: 1.5, color: (c) => lit(c, mix("#7a6a2e", "#4a3a1a", c.t ?? 0)) },
      );
    },
  },

  orange: {
    options: [
      {
        key: "style",
        label: "Style",
        type: "select",
        default: "cut",
        choices: [
          { id: "cut", label: "Whole and half" },
          { id: "whole", label: "Whole" },
          { id: "half", label: "Half" },
        ],
      },
    ],
    controls: [{ key: "open", label: "Open into wedges", type: "pulse", ease: ORANGE_SECS }],
    action: { key: "open", label: "Open into wedges" },
    // A tap opens the whole orange like a flower: it is cut into eight
    // wedges from the top, and they fall open outwards on their bottoms, one
    // just after another, showing the juicy cut faces, while juice squirts
    // up out of the middle. Then they close up into a whole orange again.
    // (A lone half squeezes and squirts.)
    drive(t, c, out, info) {
      const s = since(c.open, ORANGE_SECS);
      const d = info.data;
      if (!d) return;
      const on = s >= 0;
      out.tokens = [];
      d.wedges.forEach((w, i) => {
        const t0 = 0.05 + 0.03 * i;
        const open = on ? easeOut(band(s, t0, t0 + 0.5)) * (1 - smooth(band(s, 2.0, 2.6))) : 0;
        const settle = on
          ? 0.08 * wobble(s - t0 - 0.5, 0.6, 14) + 0.05 * wobble(s - 2.6, 0.4, 16)
          : 0;
        out.tokens[w.token] = { base: w.pivot, quat: quatAxisAngle(w.axis, 0.66 * open + settle) };
      });
      d.drops.forEach((dr) => {
        const u = on ? s - dr.t0 : -1;
        const g = clamp(u / dr.life, 0, 1);
        const p = [dr.v[0] * u, dr.v[1] * u - 6 * u * u, dr.v[2] * u];
        out.tokens[dr.token] = {
          base: dr.from,
          offset: u > 0 && g < 1 ? p : [0, 0, 0],
          visible: u > 0 && g < 1 ? 1 - smooth(band(g, 0.7, 1)) : 0,
        };
      });
      const squeeze = on && d.halfOnly ? 0.08 * hop(band(s, 0, 0.35)) : 0;
      out.parts.half = { scale: 1 - squeeze };
      cuesAt(c, "orange", s, [[2.55, { voice: "slap", f: 900, vol: 0.4 }]], out);
    },
    build(k, o) {
      const R = 0.72;
      const peel = (c) => {
        const n = c.noise(c.lp[0] * 45, c.lp[1] * 45, c.lp[2] * 45);
        const col = shade(
          mix("#f7931e", "#ee7a12", 0.5 + 0.5 * c.fbm(c.lp[0] * 3, c.lp[1] * 3, c.lp[2] * 3, 2)),
          0.93 + 0.12 * n,
        );
        return glossy(c, col, 0.55, 30, 0.74, 0.38);
      };
      // Segments seen in a cut: angle a around the core, rho 0 centre .. 1 peel.
      const flesh = (a, rho, c) => {
        if (rho > 0.965) return "#ec7a14";
        if (rho > 0.88) return "#fbeed6";
        if (rho < 0.09) return "#fbeed6";
        const seg = (a / TAU) * 11;
        const e = Math.abs(seg - Math.floor(seg) - 0.5);
        if (e > 0.465) return "#fde3b8";
        const juice = c.noise(Math.cos(a) * 3 + a * 6, rho * 9, 0.5);
        const col = mix("#fb9c1f", "#f57e0f", 0.5 + 0.5 * juice + 0.4 * (e - 0.25));
        return c.noise(a * 30, rho * 30, 3) > 0.55 ? mix(col, "#ffd9a0", 0.5) : col;
      };
      // The whole orange is eight wedges (pieces), each its peel and two cut
      // faces, hinged at the bottom so it can fall open outwards.
      const wedges = [];
      const drops = [];
      let tokens = 0;
      const H = R * 0.94;
      const cutFace = (c, rho, y) => {
        const x = Math.sqrt(Math.max(0, rho * rho - (y / H) ** 2));
        if (rho > 0.965) return "#ec7a14";
        if (rho > 0.88) return "#fbeed6";
        if (x < 0.07) return "#fbeed6";
        // Juice sacs run out from the core towards the peel.
        const sacs = c.noise(Math.atan2(y / H, x) * 18, rho * 4, 0.5);
        const col = mix("#fb9c1f", "#f57e0f", 0.5 + 0.5 * c.noise(x * 9, y * 9, 1.5));
        return sacs > 0.3 ? mix(col, "#ffcf8a", 0.55) : col;
      };
      const whole = (pos) => {
        const n = 8;
        for (let i = 0; i < n; i++) {
          const a0 = (i / n) * TAU;
          const a1 = ((i + 1) / n) * TAU;
          const am = (a0 + a1) / 2;
          const m = [Math.sin(am), 0, Math.cos(am)];
          const token = tokens++;
          const piece = { kind: "token", params: [token, 0] };
          const pivot = add(pos, add([0, -H * 0.92, 0], mul(m, 0.18)));
          wedges.push({ token, pivot, axis: unit(cross([0, 1, 0], m)) });
          k.add(
            k.param(
              (u, v) => {
                const a = a0 + u * (a1 - a0);
                const th = v * Math.PI;
                return [Math.sin(th) * Math.sin(a) * R, Math.cos(th) * H, Math.sin(th) * Math.cos(a) * R]; // prettier-ignore
              },
              {
                grid: 40,
                normal: (u, v) => {
                  const a = a0 + u * (a1 - a0);
                  const th = v * Math.PI;
                  return unit([Math.sin(th) * Math.sin(a) / R, Math.cos(th) / H, Math.sin(th) * Math.cos(a) / R]); // prettier-ignore
                },
              },
            ),
            {
              pos,
              flat: 0.2,
              ...piece,
              color: (c) => {
                const top = c.ln[1];
                if (top > 0.985) return keep(lit(c, "#6b7a2a"));
                if (top > 0.965) return keep(lit(c, "#c8a03a"));
                return peel(c);
              },
            },
          );
          for (const [a, sgn] of [
            [a0, -1],
            [a1, 1],
          ]) {
            const dir = [Math.sin(a), 0, Math.cos(a)];
            const nrm = mul([Math.cos(a), 0, -Math.sin(a)], sgn);
            k.add(
              k.param(
                (u, v) => {
                  const th = u * Math.PI;
                  return add(mul(dir, Math.sin(th) * v * R * 0.995), [0, Math.cos(th) * v * H * 0.995, 0]); // prettier-ignore
                },
                { grid: 32, normal: () => nrm },
              ),
              {
                pos,
                flat: 0.15,
                weight: 1.2,
                ...piece,
                color: (c) => {
                  const rho = c.v;
                  const col = cutFace(c, rho, c.lp[1]);
                  return keep(mix(col, "#ffffff", 0.3 * spec(c, 30)));
                },
              },
            );
          }
          if (i === n - 3) {
            // The stalk and leaf ride on one wedge (at the back).
            const cap = add(pos, [0, H, 0]);
            k.add(k.cylinder(0.018, 0.08), {
              pos: add(cap, [0, 0.03, 0]),
              weight: 3,
              pattern: false,
              ...piece,
              color: "#5a4a22",
            });
            k.add(leafShape(k, 0.5, 0.15, 0.2), {
              pos: add(cap, [0.01, 0.02, 0]),
              rot: [0, -60, 16],
              flat: 0.2,
              weight: 1.5,
              pattern: false,
              ...piece,
              color: leafColor("#2f7a2a", "#7fbf5a"),
            });
          }
        }
        // Drops of juice that squirt up out of the middle as it opens.
        for (let j = 0; j < 12; j++) {
          const token = tokens++;
          const a = k.rand() * TAU;
          const from = add(pos, [0, H * 0.6, 0]);
          const sp = 0.5 + 0.8 * k.rand();
          drops.push({
            token,
            from,
            v: [Math.sin(a) * sp, 2.2 + 1.4 * k.rand(), Math.cos(a) * sp],
            t0: 0.12 + 0.3 * k.rand(),
            life: 0.55 + 0.2 * k.rand(),
          });
          k.cloud({ count: 30, size: 0.9, pattern: false }, (rand) => ({
            p: add(from, mul(randDir(rand), 0.025 * Math.cbrt(rand()))),
            color: mix("#ffb347", "#ff9a1f", rand()),
            opacity: 0.85,
            kind: "token",
            params: [token, 0],
          }));
        }
      };
      const half = (pos, yaw, tilt) => {
        const q = quatMul(quatEuler(0, yaw, 0), quatEuler(tilt, 0, 0));
        const part = k.part("half", { pivot: add(pos, [0, -R * 0.6, 0]) });
        k.add(halfEllipsoid(k, R * 0.95, R * 0.95, R * 0.95), {
          quat: q,
          pos,
          part,
          flat: 0.2,
          color: peel,
        });
        k.add(
          k.param(
            (u, v) => {
              const a = u * TAU;
              const r = v * R * 0.95;
              return [Math.cos(a) * r, Math.sin(a) * r, 0];
            },
            { grid: 64, normal: () => [0, 0, 1], thick: R * 0.9 },
          ),
          {
            quat: q,
            pos,
            part,
            flat: 0.15,
            interior: 0.08,
            core: "#f98d1c",
            color: (c) => {
              const col = flesh(c.u * TAU, c.v, c);
              return keep(mix(col, "#ffffff", 0.35 * spec(c, 30)));
            },
          },
        );
      };
      if (o.style === "whole") whole([0, 0, 0]);
      else if (o.style === "half") half([0, 0, 0], 32, -35);
      else {
        whole([-0.42, 0, -0.35]);
        half([0.55, -0.1, 0.45], 32, -42);
      }
      k.data = { wedges, drops, halfOnly: o.style === "half" };
      if (wedges.length) k.reach(add(wedges[0].pivot, [0, 1.6, 0]));
    },
  },

  kiwi: {
    options: [
      {
        key: "style",
        label: "Style",
        type: "select",
        default: "cut",
        choices: [
          { id: "cut", label: "Whole and half" },
          { id: "whole", label: "Whole" },
          { id: "half", label: "Half" },
        ],
      },
    ],
    controls: [{ key: "open", label: "Cut open", type: "pulse", ease: KIWI_SECS }],
    action: { key: "open", label: "Cut open" },
    // A tap cuts the whole kiwi across the middle: the halves slide apart
    // and turn to show their green faces with the ring of black seeds, then
    // they turn back and close up. (A lone half rocks.)
    drive(t, c, out, info) {
      const s = since(c.open, KIWI_SECS);
      const d = info.data;
      if (!d) return;
      const on = s >= 0;
      const open = on ? easeOut(band(s, 0.08, 0.6)) * (1 - smooth(band(s, 1.9, 2.5))) : 0;
      const settle = on ? 0.05 * wobble(s - 0.6, 0.5, 15) : 0;
      out.tokens = [];
      for (const h of d.halves) {
        const q = slerpQ(h.back, IDQ, clamp(open + settle, 0, 1.2));
        const offset = mul(sub(h.closed, h.open), 1 - open);
        out.tokens[h.token] = { base: h.open, quat: q, offset };
        out.tokens[h.face] = { base: h.open, quat: q, offset, visible: open > 0.15 ? 1 : 0 };
      }
      out.parts.half = { quat: quatAxisAngle([1, 0, 0], d.halves.length ? 0 : 0.12 * wobble(s, 1.2, 9)) }; // prettier-ignore
      cuesAt(c, "kiwi", s, [[2.45, { voice: "squish", pitch: 1.6, bright: 0.3, decay: 0.3, vol: 0.4 }]], out); // prettier-ignore
    },
    build(k, o) {
      const A = 0.46;
      const B = 0.42;
      const C = 0.62;
      const skin = (c) => {
        const n = c.noise(c.lp[0] * 60, c.lp[1] * 60, c.lp[2] * 60);
        const col = mix(
          "#8b6a3e",
          "#6a4a26",
          0.5 + 0.5 * c.fbm(c.lp[0] * 4, c.lp[1] * 4, c.lp[2] * 4, 2),
        );
        return lit(c, shade(col, 0.9 + 0.2 * n), 0.74, 0.4);
      };
      // The cut face: x, y across the fruit scaled to the unit disc.
      const face = (x, y, c) => {
        const rho = Math.hypot(x, y);
        const a = Math.atan2(y, x);
        if (rho > 0.97) return "#6f5230";
        if (rho > 0.92) return "#b8d86a";
        const streak = 0.5 + 0.5 * Math.sin(a * 70 + 3 * c.noise(x * 6, y * 6, 0));
        if (rho < 0.2) return mix("#f5f3d2", "#e7ecb0", smoothstep(0.1, 0.2, rho));
        if (rho < 0.44) {
          // A ring of small black seeds pointing outwards.
          const n = 46;
          const s = (a / TAU) * n;
          const j = Math.round(s);
          const da = (s - j) * (TAU / n) * rho;
          const r0 = 0.33 + 0.05 * (hash3(j, 3, 7) - 0.5);
          const dr = rho - r0;
          if ((dr / 0.05) ** 2 + (da / 0.02) ** 2 < 1) return keep("#1d1a12");
          return mix("#d9e89a", "#9ccf2a", smoothstep(0.2, 0.44, rho) * (0.6 + 0.4 * streak));
        }
        return mix("#7fb80f", "#a6d83c", 0.35 * streak + 0.2 * smoothstep(0.6, 0.9, rho));
      };
      // The whole kiwi is two halves (pieces) that part and turn to show
      // their faces. Each is built open (so it draws right open) and turned
      // back at rest; its face is a piece of its own, hidden when closed.
      const halves = [];
      let tokens = 0;
      const whole = (pos, rot) => {
        const qk = quatEuler(...rot);
        const axis = quatRotate(qk, [0, 0, 1]);
        for (const side of [-1, 1]) {
          const turn = quatAxisAngle([0, 1, 0], side * KIWI_TURN);
          const open = add(pos, mul(axis, side * 0.42));
          const q = quatMul(turn, side > 0 ? quatMul(qk, quatEuler(0, 180, 0)) : qk);
          const token = tokens++;
          const faceToken = tokens++;
          const back = [-turn[0], -turn[1], -turn[2], turn[3]];
          halves.push({ token, face: faceToken, open, closed: pos, back });
          k.add(halfEllipsoid(k, A, B, C), {
            quat: q,
            pos: open,
            flat: 0.55,
            jitter: 0.08,
            kind: "token",
            params: [token, 0],
            // Lit as it lies at rest (closed), so the two halves match.
            color: (c) => {
              const cc = Object.assign({}, c, { n: quatRotate(back, c.n) });
              return c.v < 0.03 ? keep(lit(cc, "#4a3218")) : skin(cc);
            },
          });
          k.add(
            k.param(
              (u, v) => {
                const a = u * TAU;
                return [Math.cos(a) * v * A * 0.99, Math.sin(a) * v * B * 0.99, 0];
              },
              { grid: 72, normal: () => [0, 0, 1] },
            ),
            {
              quat: q,
              pos: open,
              flat: 0.15,
              weight: 1.3,
              kind: "token",
              params: [faceToken, 0],
              color: (c) => {
                const col = face(c.lp[0] / A, c.lp[1] / B, c);
                if (col.keep) return col;
                return keep(mix(col, "#ffffff", 0.4 * spec(c, 30)));
              },
            },
          );
        }
        k.reach(add(pos, mul(axis, 0.42 + C * 0.3)));
        k.reach(add(pos, mul(axis, -0.42 - C * 0.3)));
      };
      const half = (pos, yaw, tilt) => {
        const q = quatMul(quatEuler(0, yaw, 0), quatEuler(tilt, 0, 0));
        const part = k.part("half", { pivot: add(pos, [0, -0.3, 0]) });
        k.add(halfEllipsoid(k, A, B, C * 0.9), {
          quat: q,
          pos,
          part,
          flat: 0.55,
          jitter: 0.08,
          color: skin,
        });
        k.add(
          k.param(
            (u, v) => {
              const a = u * TAU;
              return [Math.cos(a) * v * A, Math.sin(a) * v * B, 0];
            },
            { grid: 72, normal: () => [0, 0, 1], thick: 0.4 },
          ),
          {
            quat: q,
            pos,
            part,
            flat: 0.15,
            weight: 1.3,
            interior: 0.06,
            core: "#8cc41a",
            color: (c) => {
              const col = face(c.lp[0] / A, c.lp[1] / B, c);
              if (col.keep) return col;
              return keep(mix(col, "#ffffff", 0.4 * spec(c, 30)));
            },
          },
        );
      };
      // The whole one lies side on to the viewer, so its halves part
      // across the view.
      if (o.style === "whole") whole([0, 0, 0], [0, KIWI_YAW, 0]);
      else if (o.style === "half") half([0, 0, 0], 30, -30);
      else {
        whole([-0.55, 0, -0.5], [0, KIWI_YAW, 0]);
        half([0.5, 0.02, 0.4], 32, -36);
      }
      k.data = { halves };
    },
  },

  pineapple: {
    controls: [{ key: "slice", label: "Slice into rings", type: "pulse", ease: PINE_SECS }],
    action: { key: "slice", label: "Slice into rings" },
    // A tap chops the pineapple into five rings, top first: with each chop
    // everything above lifts a little and leans towards you, until the
    // rings stand apart in a leaning stack showing their golden faces and
    // pale cores. Then they drop back down onto each other.
    drive(t, c, out) {
      const s = since(c.slice, PINE_SECS);
      const on = s >= 0;
      const lean = [Math.cos(0.55), 0, -Math.sin(0.55)];
      const side = [Math.sin(0.55 + Math.PI / 2), 0, Math.cos(0.55 + Math.PI / 2)];
      let y = 0;
      let x = 0;
      for (let i = 0; i < PINE_RINGS; i++) {
        if (i > 0 && on) {
          // Cut i (under ring i) is chopped top first, then all close again.
          const t0 = 0.1 + 0.17 * (PINE_RINGS - 1 - i);
          const g = easeOut(band(s, t0, t0 + 0.3)) * (1 - easeIn(band(s, 2.0 + 0.06 * i, 2.45 + 0.06 * i))); // prettier-ignore
          y += PINE_GAP * g;
          x += 0.1 * g;
        }
        const tilt = on && i > 0 ? (0.32 * y) / (PINE_GAP * (PINE_RINGS - 1)) : 0;
        out.parts[`ring${i}`] = {
          offset: add([0, y, 0], mul(side, x)),
          quat: quatAxisAngle(lean, tilt),
        };
      }
      const list = [];
      for (let i = 1; i < PINE_RINGS; i++) {
        if (i < PINE_RINGS - 1)
          list.push([0.1 + 0.17 * (PINE_RINGS - 1 - i), [{ voice: "slap", f: 700 + 50 * i, vol: 0.7 }, { voice: "crunch", f: 1100, n: 5, decay: 0.4, vol: 0.5 }]]); // prettier-ignore
        list.push([2.45 + 0.06 * i, { voice: "wood", f: 330 - 20 * i, decay: 0.9, vol: 0.5 }]);
      }
      cuesAt(c, "pineapple", s, list, out);
    },
    build(k) {
      const pts = [
        [0, -0.86],
        [0.34, -0.83],
        [0.52, -0.64],
        [0.6, -0.3],
        [0.61, 0.02],
        [0.57, 0.32],
        [0.47, 0.56],
        [0.3, 0.71],
        [0.12, 0.77],
        [0, 0.78],
      ];
      const N = 12;
      const M = 3.6;
      const cell = (a, y) => {
        const fa = (a / TAU) * N + y * M;
        const fb = (a / TAU) * N - y * M;
        const da = fa - Math.round(fa);
        const db = fb - Math.round(fb);
        return { d: Math.max(Math.abs(da), Math.abs(db)), da, db };
      };
      // Five rings, each a part; the crown goes with the top one.
      const cuts = [];
      for (let i = 0; i <= PINE_RINGS; i++) cuts.push(-0.86 + (1.64 * i) / PINE_RINGS);
      const ringOf = (y) => clamp(Math.floor(((y + 0.86) / 1.64) * PINE_RINGS), 0, PINE_RINGS - 1);
      const rings = [];
      for (let i = 0; i < PINE_RINGS; i++)
        rings.push(k.part(`ring${i}`, { pivot: [0, (cuts[i] + cuts[i + 1]) / 2, 0] }));
      const radius = radiusAt(pts);
      k.add(
        revolve(
          k,
          pts,
          (a, y) => {
            const { d } = cell(a, y);
            return 1 + 0.045 * (0.5 - d) * 2;
          },
          { grid: 120, thick: 0.6 },
        ),
        {
          part: (c) => rings[ringOf(c.p[1])],
          flat: 0.25,
          interior: 0.12,
          core: (c) =>
            Math.hypot(c.p[0], c.p[2]) < 0.14
              ? "#f5ebb4"
              : shade("#f8d85a", 0.94 + 0.1 * c.noise(c.p[0] * 20, c.p[1] * 20, c.p[2] * 20)),
          color: (c) => {
            const a = Math.atan2(c.p[0], c.p[2]);
            const { d, da, db } = cell(a, c.p[1]);
            let col;
            if (d > 0.43) col = "#4d3a14";
            else col = mix("#f0b534", "#a0601c", smoothstep(0.1, 0.43, d));
            // A little spike near the top of each eye.
            if (Math.hypot(da + db * 0 - 0.12, db - 0.12) < 0.07) col = "#3a2a0e";
            const ends = smoothstep(0.35, 0.75, Math.abs(c.p[1] + 0.05));
            col = mix(col, "#7a8a2a", 0.35 * ends);
            return lit(c, col, 0.72, 0.42);
          },
        },
      );
      // The cut faces on top of each ring (all but the top one): golden
      // flesh with fibres running out from a pale core, inside the skin.
      for (let i = 0; i < PINE_RINGS - 1; i++) {
        const y = cuts[i + 1];
        const R = radius(y) * 0.99;
        k.add(topDisc(k, R), {
          pos: [0, y - 0.004, 0],
          part: rings[i],
          flat: 0.15,
          weight: 1.4,
          pattern: false,
          color: (c) => {
            const r = c.v;
            const a = c.u * TAU;
            if (r > 0.93) return keep(lit(c, mix("#7a5a1c", "#4d3a14", c.rand()), 0.8, 0.3));
            if (r > 0.86) return keep(mix("#f3e39a", "#e8c85a", c.rand() * 0.5));
            if (r < 0.2) return keep(mix("#f7efc4", "#efe2a2", c.rand() * 0.4));
            const fibre = c.noise(Math.cos(a) * 3 + a * 9, r * 2.5, 0.7 + i);
            const col = mix("#f9d24a", "#f3bd2c", 0.5 + 0.5 * fibre);
            return keep(mix(col, "#ffffff", 0.25 * spec(c, 30)));
          },
        });
      }
      // A crown of spiky leaves.
      const leaves = 30;
      for (let i = 0; i < leaves; i++) {
        const f = i / leaves;
        const az = i * 2.39996;
        const el = (80 - 55 * f) * (Math.PI / 180);
        const L = 0.45 + 0.4 * (1 - Math.abs(f - 0.45) * 1.4) + k.rand() * 0.08;
        const hor = [Math.sin(az), 0, Math.cos(az)];
        const side = [Math.cos(az), 0, -Math.sin(az)];
        const base = add([0, 0.74, 0], mul(hor, 0.05 + 0.1 * f));
        const p1 = add(base, add(mul(hor, 0.12 * L), [0, 0.45 * L, 0]));
        const p2 = add(base, add(mul(hor, Math.cos(el) * L), [0, Math.sin(el) * L, 0]));
        const bez = (t) =>
          add(add(mul(base, (1 - t) * (1 - t)), mul(p1, 2 * t * (1 - t))), mul(p2, t * t));
        const blade = k.param(
          (u, v) => {
            const s = v * 2 - 1;
            const w = (0.06 * Math.pow(1 - u, 0.9) + 0.004) * s;
            const fold = 0.02 * Math.abs(s) * (1 - u);
            return add(bez(u), add(mul(side, w), mul(hor, -fold)));
          },
          { grid: 20 },
        );
        k.add(blade, {
          part: rings[PINE_RINGS - 1],
          flat: 0.2,
          weight: 1.4,
          pattern: false,
          color: (c) => {
            const s = Math.abs(c.v * 2 - 1);
            const col = mix("#2f6b3a", "#86bf5c", smoothstep(0.1, 1, c.u));
            return lit(c, s < 0.1 ? shade(col, 0.8) : col, 0.74, 0.38);
          },
        });
      }
      k.reach([0.3, 1.6 + 0.1 * (PINE_RINGS - 1), 0]);
    },
  },

  cherries: {
    controls: [{ key: "swing", label: "Swing", type: "pulse", ease: CHERRY_SECS }],
    action: { key: "swing", label: "Swing" },
    // A tap flicks the pair: each cherry swings out on its own stem from the
    // joint, and they swing back and knock together (a plink each time),
    // bouncing apart again until they settle. The joint bobs as they go.
    drive(t, c, out) {
      const s = since(c.swing, CHERRY_SECS);
      let [a, b] = [0, 0];
      let bob = 0;
      let side = [0, 0];
      if (s >= 0) {
        const f = CHERRY_SIM.frames[Math.min(CHERRY_SIM.frames.length - 1, Math.round(s / CHERRY_SIM.dt))]; // prettier-ignore
        const end = 1 - smooth(band(s, CHERRY_SECS - 0.7, CHERRY_SECS - 0.05));
        [a, b] = [f[0] * end, f[1] * end];
        bob = 0.05 * wobble(s, 1.4, 17) * end;
        const fade = Math.exp(-1.1 * s) * end;
        side = [0.1 * Math.sin(s * 6.3 + 0.4) * fade, -0.08 * Math.sin(s * 5.7 + 1.9) * fade];
      }
      const turn = (z, x) => quatMul(quatAxisAngle([0, 0, 1], z), quatAxisAngle([1, 0, 0], x));
      out.parts.left = { quat: turn(a, side[0]), offset: [0, bob, 0] };
      out.parts.right = { quat: turn(b, side[1]), offset: [0, bob, 0] };
      out.parts.leaf = { quat: quatAxisAngle([0, 0, 1], 0.4 * (a + b) * 0.5), offset: [0, bob, 0] };
      cuesAt(
        c,
        "cherries",
        s,
        CHERRY_SIM.hits.map((h, i) => [
          h.t,
          { voice: "pop", f: i % 2 ? "C6" : "G5", decay: 1.1, vol: Math.min(1, 0.35 + h.v) },
        ]),
        out,
      );
    },
    build(k) {
      const shape = revolve(
        k,
        [
          [0, -0.36],
          [0.18, -0.34],
          [0.33, -0.2],
          [0.38, 0],
          [0.34, 0.19],
          [0.2, 0.29],
          [0.06, 0.25],
          [0, 0.22],
        ],
        null,
        { grid: 80, thick: 0.35 },
      );
      const joint = [0.06, 1.0, 0];
      const parts = ["left", "right"].map((n) => k.part(n, { pivot: joint, axis: [0, 0, 1] }));
      const cherries = [
        { pos: [-0.36, -0.42, 0.05], rot: [0, 0, 8] },
        { pos: [0.34, -0.5, -0.06], rot: [0, 40, -6] },
      ];
      const glow = (c) => {
        const col = mix(
          "#d0132e",
          "#6e0615",
          smoothstep(0.4, -0.7, c.n[1]) * 0.8 + 0.2 * smoothstep(0, 1, rim(c)),
        );
        return glossy(c, col, 1, 36, 0.72, 0.4);
      };
      cherries.forEach((ch, i) => {
        k.add(shape, {
          ...ch,
          part: parts[i],
          flat: 0.2,
          interior: 0.1,
          core: (c) => (len(sub(c.p, ch.pos)) < 0.1 ? "#e8d0a0" : "#8a0f1e"),
          color: glow,
        });
        k.add(shape, {
          ...ch,
          part: parts[i],
          share: 0.01,
          size: 0.7,
          pattern: false,
          kind: "glint",
          params: [0.8, 0],
          color: (c) => (spec(c, 36) > 0.5 ? keep("#ffffff") : null),
        });
      });
      const stems = [
        [
          add(cherries[0].pos, [0.02, 0.24, 0]),
          add(cherries[0].pos, [0.06, 0.55, 0.02]),
          [-0.12, 0.78, 0.02],
          joint,
        ],
        [
          add(cherries[1].pos, [-0.02, 0.24, 0]),
          add(cherries[1].pos, [-0.04, 0.6, -0.02]),
          [0.14, 0.82, -0.02],
          joint,
        ],
      ];
      stems.forEach((st, i) => {
        k.add(
          k.tube(spline(st), (t) => 0.024 - 0.006 * t, { caps: true }),
          {
            part: parts[i],
            flat: 0.3,
            weight: 2,
            pattern: false,
            color: (c) => lit(c, mix("#7a9a2a", "#6b4a22", smoothstep(0.6, 1, c.t ?? 0))),
          },
        );
      });
      k.add(leafShape(k, 0.62, 0.2, 0.25), {
        pos: add(joint, [0, -0.02, 0]),
        rot: [20, -20, -14],
        part: k.part("leaf", { pivot: joint, axis: [0, 0, 1] }),
        flat: 0.2,
        weight: 1.4,
        pattern: false,
        color: leafColor("#3f8f2f", "#9fd06a"),
      });
      // They swing out about a third of a turn each way.
      k.reach([-1.0, -0.2, 0]);
      k.reach([1.0, -0.2, 0]);
    },
  },

  grapes: {
    options: [
      {
        key: "color",
        label: "Grapes",
        type: "select",
        default: "purple",
        choices: [
          { id: "purple", label: "Purple" },
          { id: "green", label: "Green" },
          { id: "red", label: "Red" },
        ],
      },
    ],
    controls: [{ key: "drop", label: "Drop grapes", type: "pulse", ease: GRAPE_SECS }],
    action: { key: "drop", label: "Drop grapes" },
    // A tap shakes the bunch: one after another, a dozen grapes on the
    // front come off, drop and bounce on the table and roll a little, each
    // on its own path. Then they hop back up to their places, one by one.
    drive(t, c, out, info) {
      const s = since(c.drop, GRAPE_SECS);
      const d = info.data;
      if (!d) return;
      out.tokens = d.drops.map((g) => {
        if (s < g.t0) return { base: g.home };
        const back = GRAPE_BACK + g.lag;
        if (s >= back + 0.45) return { base: g.home };
        const u = s - g.t0;
        // Falling and bouncing, then rolling out a little.
        const fall = bounce(u, g.h, 0.7, 12, 0.35);
        const first = g.t1;
        const out1 = g.vh * Math.min(u, first) + (u > first ? 0.08 * (1 - Math.exp(-(u - first) / 0.22)) : 0); // prettier-ignore
        let p = [g.home[0] + g.dir[0] * out1, g.land + fall.y, g.home[2] + g.dir[2] * out1];
        // It tumbles as it falls, then rolls (turning by distance / radius).
        const roll = u < first ? g.spin * (u / first) : g.spin + (out1 - g.vh * first) / 0.16;
        let q = quatAxisAngle(cross([0, 1, 0], g.dir), roll);
        if (s >= back) {
          const f = smooth(band(s, back, back + 0.45));
          const rest = [p[0], p[1], p[2]];
          p = hopTo(rest, g.home, f, 0.22);
          q = slerpQ(q, IDQ, f);
        }
        return { base: g.home, offset: sub(p, g.home), quat: q };
      });
      const list = [];
      d.drops.forEach((g, i) => {
        landings(g.h, 0.7, 12, 0.35, 2).forEach(
          (x, n) =>
          list.push([g.t0 + x, { voice: "pop", f: 260 + 40 * (i % 5), decay: 0.9, vol: n ? 0.35 : 0.8 }]), // prettier-ignore
        );
        list.push([GRAPE_BACK + g.lag + 0.44, { voice: "pop", f: 700 + 50 * (i % 4), decay: 0.5, vol: 0.4 }]); // prettier-ignore
      });
      cuesAt(c, "grapes", s, list, out);
    },
    build(k, o) {
      const [base, bloom, dark] = {
        purple: ["#4e2464", "#9b86b8", "#2a0f38"],
        green: ["#a8cf52", "#e5f2a8", "#6c9a2a"],
        red: ["#9c2b4b", "#d28aa0", "#5a0f25"],
      }[o.color];
      const grape = k.ellipsoid(0.15, 0.175, 0.15);
      const grapeColor = (c) => {
        const haze = 0.5 + 0.5 * c.fbm(c.p[0] * 9, c.p[1] * 9, c.p[2] * 9, 2);
        let col = mix(base, bloom, 0.35 * haze);
        col = mix(col, dark, 0.45 * smoothstep(0.2, -0.8, c.n[1]));
        return glossy(c, col, 0.55, 30, 0.72, 0.42);
      };
      // The grapes that fall: a dozen on the front (towards the viewer),
      // from the second row down, each a piece on its own path.
      const view = [Math.sin(0.45), 0, Math.cos(0.45)];
      const floor = -0.97;
      const drops = [];
      const rows = 7;
      for (let j = 0; j < rows; j++) {
        const y = 0.5 - j * 0.21;
        const rr = 0.46 * (1 - j / rows) + 0.06;
        const n = Math.max(1, Math.round((TAU * rr) / 0.27));
        for (let i = 0; i < n; i++) {
          const a = (i / n) * TAU + j * 0.7 + k.rand() * 0.2;
          const p = [Math.sin(a) * rr, y + (k.rand() - 0.5) * 0.06, Math.cos(a) * rr];
          const dir = [Math.sin(a), 0, Math.cos(a)];
          const front = dot(dir, view);
          let token = null;
          if (j >= 1 && j <= 5 && front > 0.2 && drops.length < 10 && (j + i) % 3 !== 1) {
            token = drops.length;
            const h = p[1] - (floor + 0.16);
            drops.push({ home: p, h, land: floor + 0.16, spin: 0.3 + 0.3 * k.rand() });
          }
          // A falling grape tumbles, so it has no inside to show through.
          k.add(grape, {
            pos: p,
            rot: [k.rand() * 30, a * 57, 0],
            flat: 0.2,
            ...(token === null
              ? { interior: 0.06, core: mix(bloom, "#dfe8a8", 0.5) }
              : { kind: "token", params: [token, 0] }),
            color: grapeColor,
          });
        }
        if (rr > 0.2) {
          k.add(grape, {
            pos: [0, y - 0.03, 0],
            flat: 0.2,
            color: grapeColor,
          });
        }
      }
      // They come off one after another, top first; each lands after its
      // first fall (t1) and later hops home a little after the one before.
      // Each lands on its own spot of an arc in front of the bunch (two
      // rows, so they do not pile up), the spot nearest its side.
      const side = (g) => Math.atan2(g.home[0], g.home[2]) - 0.45;
      drops.sort((x, y) => side(x) - side(y));
      drops.forEach((g, i) => {
        const a = 0.45 + (-1.25 + (2.5 * i) / (drops.length - 1));
        const r = i % 2 ? 0.86 : 0.62;
        const to = [Math.sin(a) * r, g.land, Math.cos(a) * r];
        const flat = [to[0] - g.home[0], 0, to[2] - g.home[2]];
        g.dir = unit(flat);
        g.t1 = landings(g.h, 0.7, 12, 0.35, 1)[0];
        g.vh = len(flat) / g.t1;
        k.reach(add(to, mul(g.dir, 0.25)));
      });
      drops.sort((x, y) => y.home[1] - x.home[1]);
      drops.forEach((g, i) => {
        g.t0 = 0.06 + 0.1 * i;
        g.lag = 0.1 * (drops.length - 1 - i);
      });
      k.data = { drops };
      // The stalk, a curly tendril and a leaf.
      k.add(
        k.tube(
          spline([
            [0, 0.45, 0],
            [0.02, 0.68, 0],
            [0.08, 0.86, 0],
          ]),
          (t) => 0.035 - 0.012 * t,
          { caps: true },
        ),
        { flat: 0.3, weight: 2, pattern: false, color: (c) => lit(c, "#6b5a2a") },
      );
      k.add(
        k.tube((t) => {
          const a = t * TAU * 2.2;
          const r = 0.07 * (1 - 0.5 * t);
          return [-0.08 - t * 0.25 + Math.cos(a) * r, 0.78 + Math.sin(a) * r, 0.02];
        }, 0.009),
        { flat: 0.3, weight: 3, pattern: false, color: (c) => lit(c, "#8a9a3a") },
      );
      k.add(
        k.param(
          (u, v) => {
            const th = u * TAU;
            const lobes = 0.72 + 0.28 * Math.pow(Math.abs(Math.cos(2.5 * th)), 0.6);
            const notch = 1 - 0.55 * Math.exp(-(((th - Math.PI * 1.5) / 0.3) ** 2));
            const r = 0.36 * lobes * notch * v;
            return [Math.cos(th) * r, Math.sin(th) * r, 0.05 * v * v];
          },
          { grid: 48 },
        ),
        {
          pos: [0.22, 0.85, -0.12],
          rot: [-35, 20, -20],
          flat: 0.2,
          weight: 1.3,
          pattern: false,
          color: (c) => {
            const th = c.u * TAU;
            const vein = Math.abs(Math.cos(2.5 * th)) > 0.985 || c.v < 0.06;
            const col = mix("#4f8f30", "#6fb043", c.v);
            return keep(lit(c, vein ? "#a6d67a" : col, 0.74, 0.36));
          },
        },
      );
    },
  },

  avocado: {
    options: [
      {
        key: "style",
        label: "Style",
        type: "select",
        default: "both",
        choices: [
          { id: "both", label: "Both halves" },
          { id: "pit", label: "Half with the stone" },
        ],
      },
    ],
    controls: [{ key: "pop", label: "Pop the stone", type: "pulse", ease: AVO_SECS }],
    action: { key: "pop", label: "Pop the stone" },
    // A tap pops the stone out of its half: it flies over and drops into
    // the empty half with a thock, rocking it, then pops back home and the
    // first half rocks. (With one half, it pops up and drops back in.)
    drive(t, c, out, info) {
      const s = since(c.pop, AVO_SECS);
      const d = info.data;
      if (!d) return;
      const rock = (name, from) => {
        const h = d.halves[name];
        if (!h) return IDQ;
        const a = 0.12 * wobble(s - from, 1.1, 11);
        const q = quatAxisAngle(h.axis, a);
        out.parts[name] = { quat: q };
        return q;
      };
      const two = !!d.halves.b;
      const qa = rock("a", two ? d.back + 0.75 : 0.8);
      const qb = two ? rock("b", 0.75) : IDQ;
      // Where the stone sits in a (rocking) half.
      const seat = (name, q) => {
        const h = d.halves[name];
        return add(h.pivot, quatRotate(q, sub(h.seat, h.pivot)));
      };
      let p = seat("a", qa);
      let spin = IDQ;
      if (s >= 0) {
        const flights = two
          ? [
              [0.05, "a", "b"],
              [d.back, "b", "a"],
            ]
          : [[0.05, "a", "a"]];
        for (const [t0, from, to] of flights) {
          if (s < t0) break;
          const f = band(s, t0, t0 + 0.7);
          const qf = from === "a" ? qa : qb;
          const qt = to === "a" ? qa : qb;
          p = hopTo(seat(from, qf), seat(to, qt), f, 0.55);
          spin = quatAxisAngle([1, 0, 0.3], 0.9 * Math.sin(Math.PI * f));
          if (f >= 1) {
            // A little bounce as it lands.
            const b = s - t0 - 0.7;
            p[1] += 0.06 * Math.max(0, Math.sin((Math.PI * b) / 0.22)) * (b < 0.22 ? 1 : 0);
          }
        }
      }
      // Two copies of the stone: one built in each half, so each draws
      // over the flesh of the half it sits in. The one built in the empty
      // half flies; they swap just after it leaves home and just before it
      // is back, while it moves fast.
      const away = two && s >= 0.12 && s < d.back + 0.62;
      for (const [name, at] of [
        ["stone", d.stones.a],
        ["stoneB", d.stones.b],
      ]) {
        if (!at) continue;
        const shown = name === "stone" ? !away : away;
        out.parts[name] = { offset: sub(p, at), quat: spin, visible: shown ? 1 : 0 };
      }
      const list = two
        ? [
            [0.75, { voice: "wood", f: 240, decay: 1.6, bright: 0.2 }],
            [d.back, { voice: "pop", f: 300, decay: 1, vol: 0.7 }],
            [d.back + 0.7, { voice: "wood", f: 210, decay: 1.6, bright: 0.2 }],
          ]
        : [[0.75, { voice: "wood", f: 230, decay: 1.6, bright: 0.2 }]];
      cuesAt(c, "avocado", s, list, out);
    },
    build(k, o) {
      const pts = [
        [0, -0.62],
        [0.3, -0.58],
        [0.46, -0.4],
        [0.5, -0.15],
        [0.45, 0.12],
        [0.33, 0.35],
        [0.21, 0.52],
        [0.1, 0.62],
        [0, 0.65],
      ];
      const rAt = radiusAt(pts);
      const pitY = -0.17;
      const skin = (c) => {
        const n = c.noise(c.lp[0] * 40, c.lp[1] * 40, c.lp[2] * 40);
        return glossy(c, mix("#2f3d1a", "#4f5f28", smoothstep(0.1, 0.6, n)), 0.35, 20, 0.72, 0.4);
      };
      const flesh = (x, y, hollow) => {
        const r = rAt(y);
        const q = Math.max(
          Math.abs(x) / Math.max(r, 1e-3),
          smoothstep(0.5, 0.65, y),
          smoothstep(-0.5, -0.62, y),
        );
        if (q > 0.965) return "#2f3d1a";
        let col = mix("#f0e89c", "#c8dc62", smoothstep(0.45, 0.8, q));
        col = mix(col, "#6fa832", smoothstep(0.8, 0.95, q));
        const dp = Math.hypot(x, y - pitY);
        if (hollow && dp < 0.25) {
          // The hollow left by the stone: shaded like a dip.
          const s = (y - pitY) / 0.25;
          col = shade(mix(col, "#d9d070", 0.5), 0.8 + 0.25 * s * (1 - dp / 0.25));
          if (dp > 0.225) col = shade(col, 0.85);
        }
        return col;
      };
      // Each half is a part that can rock on its back; the stone is its own
      // part. It is built where it lands in the empty half (so it draws
      // over that half's flesh) and moved to its own half at rest.
      const halves = {};
      const half = (name, pos, yaw, hollow) => {
        const q = quatMul(quatEuler(0, yaw, 0), quatEuler(-52, 0, 0));
        const pivot = add(pos, quatRotate(q, [0, pitY, -0.4]));
        const axis = quatRotate(q, [0, 1, 0]);
        const part = k.part(name, { pivot, axis });
        halves[name] = { pivot, axis, seat: add(pos, quatRotate(q, [0, pitY, 0.02])), q };
        k.add(revolve(k, pts, null, { grid: 80, arc: [Math.PI / 2, (3 * Math.PI) / 2] }), {
          quat: q,
          pos,
          part,
          flat: 0.3,
          color: skin,
        });
        k.add(
          k.param(
            (u, v) => {
              const y = -0.62 + u * 1.27;
              const r = rAt(y);
              return [(v * 2 - 1) * r, y, 0];
            },
            { grid: 64, normal: () => [0, 0, 1], thick: 0.35 },
          ),
          {
            quat: q,
            pos,
            part,
            flat: 0.15,
            interior: 0.08,
            core: "#d6e07a",
            color: (c) => keep(lit(c, flesh(c.lp[0], c.lp[1], hollow), 0.82, 0.25)),
          },
        );
      };
      if (o.style === "pit") half("a", [0, 0, 0], 30, false);
      else {
        half("a", [-0.36, 0, -0.1], 18, false);
        half("b", [0.42, -0.02, 0.26], 42, true);
      }
      const stones = {};
      for (const [name, h] of [
        ["stone", halves.a],
        ["stoneB", halves.b],
      ]) {
        if (!h) continue;
        stones[name === "stone" ? "a" : "b"] = h.seat;
        k.add(k.sphere(0.235), {
          quat: halves.a.q,
          pos: h.seat,
          part: k.part(name, { pivot: h.seat }),
          flat: 0.2,
          weight: name === "stone" ? 1.4 : 0.8,
          color: (c) =>
            glossy(
              c,
              mix(
                "#8a5226",
                "#5e3316",
                0.5 + 0.5 * c.fbm(c.lp[0] * 8, c.lp[1] * 8, c.lp[2] * 8, 2),
              ),
              0.8,
              30,
            ),
        });
      }
      k.data = { halves, stones, back: 1.45 };
      k.reach(add(halves.a.seat, [0, 0.9, 0]));
    },
  },
};

// The pizza slice slides out towards the viewer.
const PIZZA_AZ = 0.55;
const PIZZA_OUT = [Math.sin(PIZZA_AZ) * 0.5, 0.16, Math.cos(PIZZA_AZ) * 0.5];

const BURGER_LAYERS = ["patty", "cheese", "lettuce", "tomato", "top"];

// Latte art: signed amounts (> 0 inside the foam) on the unit disc, with
// y pointing away from the viewer.
const LATTE = {
  heart(x, y) {
    const X = x / 0.42;
    const Y = (y - 0.05) / 0.4;
    const a = X * X + Y * Y - 1;
    return -(a * a * a - X * X * Y * Y * Y) * 0.6;
  },
  rosetta(x, y) {
    const inLeaf = 1 - Math.hypot(x / 0.36, (y - 0.02) / 0.62);
    if (inLeaf < 0) return inLeaf;
    const stem = 0.03 - Math.abs(x);
    const band = Math.sin((y * 7 - Math.abs(x) * 5) * Math.PI);
    return Math.max(stem, band * 0.1 * Math.min(1, inLeaf * 4));
  },
  // Stacked cups: each a disc with a crescent bitten out of its top.
  tulip(x, y) {
    let best = -1;
    [
      [0.36, 0.22, false],
      [0.02, 0.3, true],
      [-0.36, 0.36, true],
    ].forEach(([cy, r, cup]) => {
      let d = r - Math.hypot(x, (y - cy) * 1.2);
      if (cup) d = Math.min(d, Math.hypot(x, (y - cy - r * 0.62) * 1.2) - r * 0.8);
      best = Math.max(best, d);
    });
    const stem = y > -0.6 && y < 0.4 ? 0.02 - Math.abs(x) : -1;
    return Math.max(best, stem);
  },
};

// A superellipsoid slab bent down at its ends (a slice of fish on rice).
function bentSlab(k, sx, sy, sz, power, bend) {
  const e = 2 / power;
  const sp = (x, kk) => Math.sign(x) * Math.pow(Math.abs(x), kk);
  return k.param(
    (u, v) => {
      const th = (v - 0.5) * Math.PI;
      const ph = u * TAU - Math.PI;
      const ct = sp(Math.cos(th), e);
      const x = (sx / 2) * ct * sp(Math.sin(ph), e);
      const y = (sy / 2) * sp(Math.sin(th), e);
      const z = (sz / 2) * ct * sp(Math.cos(ph), e);
      return [x, y - bend * x * x, z];
    },
    { grid: 64, thick: sy / 2 },
  );
}

// Half an ellipsoid: the dome towards -Z, the open rim on z = 0 (for cut fruit).
function halfEllipsoid(k, a, b, c) {
  return k.param(
    (u, v) => {
      const ph = u * TAU;
      const th = (v * Math.PI) / 2;
      return [a * Math.sin(th) * Math.cos(ph), b * Math.sin(th) * Math.sin(ph), -c * Math.cos(th)];
    },
    {
      grid: 64,
      thick: Math.min(a, b, c),
      normal: (u, v) => {
        const ph = u * TAU;
        const th = (v * Math.PI) / 2;
        return [
          (Math.sin(th) * Math.cos(ph)) / a,
          (Math.sin(th) * Math.sin(ph)) / b,
          -Math.cos(th) / c,
        ];
      },
    },
  );
}

// A one-sided disc facing up (k.disc has two sides at the same place).
function topDisc(k, r) {
  return k.param(
    (u, v) => {
      const a = u * TAU;
      return [Math.sin(a) * r * v, 0, Math.cos(a) * r * v];
    },
    { grid: 48, normal: () => [0, 1, 0] },
  );
}

// The kernels that pop (their parts are made in the popcorn recipe).
const POPS = [];
{
  let s = 12345;
  const r = () => (s = (s * 16807) % 2147483647) / 2147483647;
  for (let j = 0; j < 14; j++) {
    POPS.push({
      period: 2.6 + r() * 3.5,
      phase: r(),
      delay: (j / 14) * 0.45 + r() * 0.05,
      height: 0.28 + r() * 0.3,
      spin: 1 + Math.floor(r() * 2),
      axis: unit([r() - 0.5, r() * 0.3, r() - 0.5]),
    });
  }
}
