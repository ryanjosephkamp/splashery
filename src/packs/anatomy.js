// Anatomy pack: stylised, friendly organs. Loaded when one of its toys is
// picked (see the "kit" entries in src/toys.js).

import {
  mix,
  shade,
  smoothstep,
  implicitRadius,
  spline,
  clamp,
  quatAxisAngle,
  quatMul,
} from "../kit.js";

const TAU = Math.PI * 2;
const add = (a, b) => [a[0] + b[0], a[1] + b[1], a[2] + b[2]];
const sub = (a, b) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
const mul = (a, s) => [a[0] * s, a[1] * s, a[2] * s];
const dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
const len = (a) => Math.hypot(a[0], a[1], a[2]);
const unit = (a) => mul(a, 1 / (len(a) || 1));
const lerp = (a, b, t) => add(a, mul(sub(b, a), t));
const keep = (c) => ({ c, keep: true });
const cross = (a, b) => [
  a[1] * b[2] - a[2] * b[1],
  a[2] * b[0] - a[0] * b[2],
  a[0] * b[1] - a[1] * b[0],
];

// Timing helpers for tap effects.
const clamp01 = (x) => (x < 0 ? 0 : x > 1 ? 1 : x);
const ease = (x) => x * x * (3 - 2 * x);
// 0 before a, rising to 1 at b.
const rise = (x, a, b) => clamp01((x - a) / (b - a));
// Rises from a to b, holds, falls from c to d (eased).
const bump = (x, a, b, c, d) => ease(rise(x, a, b)) * (1 - ease(rise(x, c, d)));
// A pulse control's progress: 0 at the tap, 1 when done (and at rest).
const progress = (v) => (v > 0 ? 1 - v : 1);
// Per-toy memory for drive(), keyed by the control state object (new each
// time a toy loads).
const MEM = new WeakMap();
function mem(c) {
  let m = MEM.get(c);
  if (!m) MEM.set(c, (m = {}));
  return m;
}

// Fake lighting for the organs below (splats are unlit).
const LIGHT = unit([-0.45, 0.8, 0.45]);
const VIEW = unit([0.5, 0.3, 0.82]);
const HALF = unit(add(LIGHT, VIEW));
const lit = (col, n, amb = 0.62, k = 0.45) => shade(col, amb + k * Math.max(0, dot(n, LIGHT)));
const gloss = (col, n, amt = 0.4, pow = 16) =>
  mix(col, "#ffffff", amt * Math.pow(Math.max(0, dot(n, HALF)), pow));

function randDir(rand) {
  const z = rand() * 2 - 1;
  const a = rand() * TAU;
  const r = Math.sqrt(1 - z * z);
  return [r * Math.cos(a), z, r * Math.sin(a)];
}

// A tapering tube whose inside (for Slice) stays within its own radius.
function snugTube(k, curve, radius, opts) {
  const shape = k.tube(curve, radius, opts);
  const inner = shape.sample;
  shape.sample = (rand) => {
    const s = inner(rand);
    s.thick = radius(s.t ?? 0) * 0.9;
    return s;
  };
  return shape;
}

const RED = "#c42f3c";
const DEEP = "#8e1a28";
const BLUE = "#4d6fd0";
const VESSEL = "#d2474f";

// ---- Lungs ------------------------------------------------------------------------------
const LUNG_BREATH = 5; // seconds a deep breath lasts
// How far each point of a lung moves as it empties (channel 0 at 1): the
// outer walls move in, most at the bottom, the base rises and the front
// and back come in; the side by the heart and the tips hardly move.
function lungEmpty(p) {
  const side = p[0] < 0 ? -1 : 1;
  const outer = clamp01((Math.abs(p[0]) - 0.22) / 0.8);
  const low = clamp01((0.9 - p[1]) / 1.5);
  return [-side * 0.14 * outer * (0.5 + 0.5 * low), 0.24 * low * Math.sqrt(low), -0.16 * p[2]];
}
// The deep breath: in over 1.7 s, hold, out past rest by 3.7 s, hold, and back.
const LUNG_KEYS = [
  [0, 0],
  [1.7, -1],
  [2.2, -1],
  [3.7, 0.65],
  [4.1, 0.65],
  [LUNG_BREATH, 0],
];
function lungDeep(s) {
  for (let i = 1; i < LUNG_KEYS.length; i++) {
    const [s1, v1] = LUNG_KEYS[i];
    const [s0, v0] = LUNG_KEYS[i - 1];
    if (s < s1) return v0 + (v1 - v0) * ease(rise(s, s0, s1));
  }
  return 0;
}

// ---- Brain ------------------------------------------------------------------------------
const BRAIN_THINK = 2.8; // seconds a thought lasts
const BRAIN_WIDTH = 0.1; // how long a spark is along its fold
const BRAIN_FRONT = 1.3; // how fast sparks race along the folds (per second)
const BRAIN_SPREAD = 1.5; // how fast the thought moves between lobes
const BRAIN_FLASH = 1.75; // when all the lobes flash at the end
// Regions 0-3 are the near side's frontal, parietal, temporal and occipital
// lobes, 4-7 the far side's, 8 the cerebellum. A lobe and its twin on the
// other side share a channel and fire together; the cerebellum fires with
// the occipital lobes.
const BRAIN_CHANNEL = [0, 1, 2, 3, 0, 1, 2, 3, 3];
// When each channel's sparks run after a tap: the tapped lobe (or the
// frontal lobes for the Play button) first, the others as the thought
// reaches them; then all the lobes flash at once.
function brainPlan(data, point) {
  const { hubs, reach } = data;
  let r0 = 0;
  if (point) {
    let best = Infinity;
    hubs.forEach((h, r) => {
      const d = len(sub(point, h));
      if (d < best) [best, r0] = [d, r];
    });
  }
  const plan = [];
  let end = 0;
  for (let ch = 0; ch < 4; ch++) {
    const rs = BRAIN_CHANNEL.map((c, r) => (c === ch ? r : -1)).filter((r) => r >= 0);
    // The nearest of this channel's hubs to the tapped one.
    const t0 = Math.min(...rs.map((r) => len(sub(hubs[r], hubs[r0])))) / BRAIN_SPREAD;
    const far = Math.max(...rs.map((r) => reach[r]));
    const t1 = t0 + (far + 0.16) / BRAIN_FRONT;
    plan.push({ ch, t0, t1, a0: -0.08, a1: far + 0.08 });
    end = Math.max(end, t1);
  }
  // The flash comes at the same moment whichever lobe was tapped (for the sound).
  const flash = Math.max(BRAIN_FLASH, end + 0.15);
  for (let ch = 0; ch < 4; ch++) plan.push({ ch, t0: flash, t1: flash + 0.6, a0: -0.1, a1: 0.9 });
  return plan;
}

// ---- Tooth ------------------------------------------------------------------------------
const TOOTH_SHINE = 3.5; // seconds a polish lasts
const TOOTH_WIPE = [0.02, 1.1]; // when the sheen crosses the tooth

// ---- Kidney -----------------------------------------------------------------------------
const KIDNEY_FLOW = 4.5; // seconds a tap's pulses last
const KIDNEY_HILUM = [-0.28, 0, 0];
const KIDNEY_PULSES = [0, 1.15, 2.3]; // when each pulse enters the artery
// Each pulse's runs: [channel, from, to (seconds after the pulse), and the
// channel's value at those times]. 0 artery, 1 kidney, 2 vein, 3 ureter.
const KIDNEY_RUNS = [
  [0, 0, 0.45, -0.12, 0.74],
  [1, 0.35, 1.1, 0.05, 1.25],
  [2, 0.9, 1.35, -0.12, 0.76],
  [3, 1.0, 2.0, -0.1, 1.19],
];

// ---- Heart timing ----------------------------------------------------------------------
const HEART_RACE = 5; // seconds a tap's race lasts
const HEART_REST = 1.1; // resting beats per second of the toy's clock
const HEART_EXTRA = 5; // whole beats a race adds
// The ventricles squeeze towards their base and wring about their long axis.
const HEART_PIVOT = [-0.14, 0.32, 0];
const HEART_AXIS = unit([0.41, -0.91, 0]);
// Extra beats a race has added s seconds after the tap: the tempo climbs for
// 0.5 s, holds until 2.6 s and calms by 4.6 s (about 66 to 155 beats a
// minute). It adds a whole number of beats.
function heartExtra(s) {
  const h = HEART_EXTRA / 3.35;
  const S = (x) => x * x * x - (x * x * x * x) / 2; // the integral of smoothstep
  if (s <= 0) return 0;
  if (s < 0.5) return h * 0.5 * S(s / 0.5);
  if (s < 2.6) return h * (s - 0.25);
  if (s < 4.6) {
    const x = (s - 2.6) / 2;
    return h * (2.35 + 2 * (x - S(x)));
  }
  return HEART_EXTRA;
}

export const RECIPES = {
  heart: {
    alive: true,
    options: [
      {
        key: "style",
        label: "Style",
        type: "select",
        default: "anatomy",
        choices: [
          { id: "anatomy", label: "Anatomy" },
          { id: "love", label: "Love heart" },
        ],
      },
      { key: "color", label: "Colour", type: "color", default: RED },
    ],
    controls: [
      { key: "strength", label: "Beat", type: "slider", default: 0.6 },
      { key: "race", label: "Race", type: "pulse", ease: HEART_RACE },
    ],
    action: { key: "race", label: "Race and calm" },
    // The heart beats by itself: the atria squeeze, then the ventricles
    // squeeze and wring a little. A tap sets it racing: the beats come faster
    // and stronger with a warm glow on each squeeze, then it calms down to
    // its resting beat.
    drive(t, c, out, info) {
      const m = mem(c);
      const s = progress(c.race) * HEART_RACE;
      // A new tap starts the race on a fresh beat, so its sound keeps time
      // with the squeezes.
      if (m.s !== undefined && s < m.s - 1e-4) {
        const was = HEART_REST * t + (m.off ?? 0) + heartExtra(m.s);
        m.off = Math.round(was) - HEART_REST * t - heartExtra(s);
      }
      m.s = s;
      const phase = HEART_REST * t + (m.off ?? 0) + heartExtra(s);
      const f = phase - Math.floor(phase);
      const env = bump(s, 0, 0.35, 2.6, 4.4);
      const a0 = 0.15 + 0.4 * c.strength;
      const amp = a0 + (1 - a0) * env;
      // Atria first, then the ventricles.
      const A = amp * (f < 0.24 ? Math.sin((Math.PI * f) / 0.24) ** 2 : 0);
      const V = amp * ease(rise(f, 0.2, 0.36)) * (1 - ease(rise(f, 0.42, 0.72)));
      out.morph = [A, V, 0, 0];
      out.glow = [1, 0.4, 0.16, 0.6 * env];
      if (info.data?.love) {
        out.parts.vent = { scale: 1 - 0.1 * V - 0.04 * A };
        return;
      }
      out.parts.vent = { scale: 1 - 0.13 * V, quat: quatAxisAngle(HEART_AXIS, 0.12 * V) };
      out.parts.atriumR = { scale: 1 - 0.17 * A };
      out.parts.atriumL = { scale: 1 - 0.17 * A };
      out.parts.aorta = { scale: 1 + 0.025 * V };
    },
    build(k, o) {
      const base = o.color;
      // The glow of a squeeze: atria on channel 0, ventricles on channel 1.
      const glowA = { kind: "band", channel: 0, params: [1, 0.8] };
      const glowV = { kind: "band", channel: 1, params: [1, 0.8] };
      k.data = { love: o.style === "love" };
      if (o.style === "love") {
        const vent = k.part("vent", { pivot: [0, 0.1, 0] });
        // The classic heart surface, (x² + 9/4 z² + y² - 1)³ - x² y³ - 9/80 z² y³ = 0,
        // with y up and z towards the viewer.
        const f = ([x, y, z]) => {
          const a = x * x + 2.25 * z * z + y * y - 1;
          return a * a * a - x * x * y * y * y - 0.1125 * z * z * y * y * y;
        };
        k.add(k.radial(implicitRadius(f, 1.6)), {
          scale: [1, 1, 0.9],
          flat: 0.2,
          interior: 0.12,
          core: shade(base, 0.7),
          part: vent,
          ...glowV,
          color: (c) =>
            mix(
              base,
              "#ffffff",
              0.18 * smoothstep(0.2, 1.1, c.n[1] + c.n[2] * 0.6) +
                0.04 * c.fbm(c.p[0] * 3, c.p[1] * 3, c.p[2] * 3),
            ),
        });
        return;
      }
      // The ventricles squeeze towards their base, the atria towards their
      // middles, and the aorta swells a little as blood is pushed into it.
      const vent = k.part("vent", { pivot: HEART_PIVOT });
      const atriumR = k.part("atriumR", { pivot: [-0.38, 0.4, 0.02] });
      const atriumL = k.part("atriumL", { pivot: [0.32, 0.44, -0.12] });
      const aorta = k.part("aorta", { pivot: [0.02, 0.36, 0.02] });
      // Ventricles: a rounded teardrop leaning its point down and to one side.
      const body = k.lathe(
        [
          [0, -0.95],
          [0.18, -0.85],
          [0.38, -0.6],
          [0.52, -0.28],
          [0.58, 0.02],
          [0.54, 0.26],
          [0.38, 0.42],
          [0, 0.48],
        ],
        { grid: 72 },
      );
      const vein = (c) => {
        const n = Math.abs(c.fbm(c.p[0] * 2.4 + 3, c.p[1] * 2.4, c.p[2] * 2.4 - 1));
        return n < 0.035;
      };
      k.add(body, {
        rot: [0, 0, 24],
        scale: [1, 1, 0.82],
        flat: 0.2,
        interior: 0.12,
        core: DEEP,
        part: vent,
        ...glowV,
        color: (c) => {
          if (vein(c)) return c.fbm(c.p[0] * 5, 0, c.p[2] * 5) > 0 ? "#6b1622" : "#3d4f9c";
          const groove =
            Math.abs(c.p[0] * 0.9 + c.p[1] * 0.35 - 0.02) < 0.035 && c.p[2] > 0 ? 1 : 0;
          const g = smoothstep(-0.9, 0.4, c.p[1]);
          let col = mix(shade(base, 0.72), base, g);
          if (groove) col = mix(col, "#e9c46a", 0.55);
          return mix(col, "#ffffff", 0.1 * Math.max(0, c.n[2]) * Math.max(0, c.n[1] + 0.3));
        },
      });
      // Atria.
      const atrium = { flat: 0.22, core: DEEP, ...glowA };
      k.add(k.ellipsoid(0.3, 0.26, 0.28), {
        ...atrium,
        part: atriumR,
        pos: [-0.38, 0.4, 0.02],
        color: (c) =>
          mix(shade(base, 0.85), "#7d4a8c", 0.25 + 0.1 * c.fbm(c.p[0] * 4, c.p[1] * 4, c.p[2] * 4)),
      });
      k.add(k.ellipsoid(0.26, 0.22, 0.26), {
        ...atrium,
        part: atriumL,
        pos: [0.32, 0.44, -0.12],
        color: (c) => mix(base, "#a02838", 0.4 + 0.1 * c.fbm(c.p[0] * 4, c.p[1] * 4, c.p[2] * 4)),
      });
      // Great vessels: the aorta arches over, the pulmonary trunk rises in
      // front, the vena cava joins the right atrium.
      const vessel = { flat: 0.25 };
      const artery = { ...vessel, part: aorta, kind: "band", channel: 1, params: [1.2, 0.6] };
      k.add(
        k.tube(
          spline([
            [0.02, 0.3, 0.02],
            [0.04, 0.72, 0.04],
            [0.2, 0.98, -0.04],
            [0.44, 0.86, -0.22],
            [0.5, 0.5, -0.32],
          ]),
          (t) => 0.14 - 0.02 * t,
        ),
        { ...artery, color: (c) => mix(VESSEL, "#f07a7a", 0.2 * Math.max(0, c.n[1])) },
      );
      // Branches off the top of the arch.
      for (const [x, z] of [
        [0.08, 0.02],
        [0.2, -0.06],
        [0.3, -0.12],
      ]) {
        k.add(k.cylinder(0.045, 0.3, { caps: false }), {
          ...artery,
          pos: [x, 1.08, z],
          color: VESSEL,
        });
      }
      k.add(
        k.tube(
          spline([
            [-0.08, 0.2, 0.3],
            [-0.12, 0.55, 0.3],
            [-0.02, 0.78, 0.16],
            [0.22, 0.8, 0.12],
          ]),
          0.115,
        ),
        // The pulmonary trunk leaves the front of the ventricles, so it moves with them.
        { ...vessel, part: vent, color: (c) => mix(BLUE, "#8aa2f0", 0.25 * Math.max(0, c.n[1])) },
      );
      k.add(k.cylinder(0.1, 0.5, { caps: false }), {
        ...vessel,
        pos: [-0.44, 0.78, -0.02],
        color: (c) => mix(BLUE, "#6c86dd", 0.3 * Math.max(0, c.n[2])),
      });
      k.add(k.cylinder(0.09, 0.3, { caps: false }), {
        ...vessel,
        pos: [-0.42, 0.02, -0.08],
        color: BLUE,
      });
    },
  },

  // ---- Brain ----------------------------------------------------------------------------
  brain: {
    alive: true,
    options: [
      {
        key: "colors",
        label: "Colours",
        type: "select",
        default: "lobes",
        choices: [
          { id: "lobes", label: "Lobes" },
          { id: "plain", label: "Plain pink" },
        ],
      },
    ],
    controls: [
      { key: "sparks", label: "Sparks", type: "slider", default: 0.6 },
      { key: "think", label: "Think", type: "pulse", ease: BRAIN_THINK },
    ],
    action: { key: "think", label: "Think" },
    // A tap sparks a thought: sparks of light race out along the folds of the
    // lobe you tapped, then through the lobes next to it and on round the
    // brain, and at the end the whole side lights up at once.
    drive(t, c, out, info) {
      const s = progress(c.think) * BRAIN_THINK;
      const d = info.data;
      const ch = [-5, -5, -5, -5];
      if (d && c.think > 0) {
        const m = mem(c);
        const n = info.tap?.n ?? 0;
        if (m.n !== n || !m.plan) {
          m.n = n;
          m.plan = brainPlan(d, info.tap?.point);
        }
        for (const run of m.plan) {
          if (s < run.t0 || s >= run.t1) continue;
          ch[run.ch] = run.a0 + ((run.a1 - run.a0) * (s - run.t0)) / (run.t1 - run.t0);
        }
      }
      out.morph = ch;
      out.glow = [1, 0.96, 0.78, 1.7];
      out.amount = 0.2 + 1.3 * c.sparks;
    },
    build(k, o) {
      const lobes = o.colors !== "plain";
      // The thought's sparks: splats in the folds glow as their region's
      // channel passes them (`at` is the distance from the region's hub; see
      // BRAIN_CHANNEL for the regions).
      const hubs = [];
      const reach = [];
      const LOBES = ["frontal", "parietal", "temporal", "occipital"];
      const jitter = (p) => 0.06 * k.noise(p[0] * 4 + 7, p[1] * 4, p[2] * 4);
      const sparkAt = (r, p) => [len(sub(p, hubs[r])) + jitter(p), BRAIN_WIDTH];
      const noSpark = [1000, 0.05];
      const PAL = lobes
        ? {
            frontal: "#6fa4e0",
            parietal: "#f4cf5d",
            temporal: "#84d08d",
            occipital: "#f29bb0",
            cerebellum: "#b497e0",
            stem: "#f0ae78",
          }
        : {
            frontal: "#f0a3ad",
            parietal: "#f0a3ad",
            temporal: "#eb9aa6",
            occipital: "#f0a3ad",
            cerebellum: "#e48e9c",
            stem: "#e7a58f",
          };
      // Folds: a meandering pattern of grooves from the zero lines of noise.
      const fold = (p) => {
        const w = k.noise(p[0] * 1.3 + 9, p[1] * 1.3, p[2] * 1.3) * 0.7;
        return k.noise(p[0] * 3.6 + w, p[1] * 3.6 - w, p[2] * 3.6 + 2 * w);
      };
      // One hemisphere (side = +1 right, -1 left), in the brain's frame: x from
      // the front (-) to the back (+), y up, z to the side.
      const hemi = (side) => {
        const cz = side * 0.47;
        const region = (p) => {
          const x = p[0];
          const y = p[1];
          const syl = y - (-0.14 + 0.28 * (x + 0.55));
          if (syl < 0 && x < 0.5 && y < 0.1) return "temporal";
          if (x > 0.58 - 0.12 * y) return "occipital";
          const central = x - (0.02 - 0.34 * (0.72 - y));
          return central < 0 ? "frontal" : "parietal";
        };
        const groove = (p) => {
          const x = p[0];
          const y = p[1];
          const syl = Math.abs(y - (-0.14 + 0.28 * (x + 0.55)));
          const sylG = x > -0.75 && x < 0.45 && y < 0.2 ? smoothstep(0.045, 0.0, syl) : 0;
          const central = Math.abs(x - (0.02 - 0.34 * (0.72 - y)));
          const cenG = y > -0.05 ? smoothstep(0.03, 0.0, central) : 0;
          const f = Math.abs(fold(p));
          const foldG = smoothstep(0.1, 0.01, f);
          return { deep: Math.max(sylG, cenG), fold: foldG };
        };
        const shape = (d) => {
          const ax = d[0] < 0 ? 0.95 : 1.02;
          const ay = d[1] > 0 ? 0.74 : 0.5;
          const az = d[2] * side > 0 ? 0.5 : 0.2;
          let r = 1 / Math.hypot(d[0] / ax, d[1] / ay, d[2] / az);
          // The temporal lobe bulges down and forward.
          const T = [-0.22, -0.78, 0.58 * side];
          const tl = Math.max(0, dot(d, unit(T)));
          r += 0.2 * Math.pow(tl, 6);
          return r;
        };
        const radius = (d) => {
          const r0 = shape(d);
          const p = add(mul(d, r0), [0, 0, cz]);
          const g = groove(p);
          return r0 * (1 - 0.05 * g.deep - 0.03 * g.fold);
        };
        surfaces.push({ radius, cz });
        // Each lobe's hub: the middle of its outer face, on the surface.
        const off = side > 0 ? 0 : 4;
        const sum = LOBES.map(() => [0, 0, 0]);
        const pts = LOBES.map(() => []);
        const M = 1600;
        for (let i = 0; i < M; i++) {
          const y = 1 - (2 * (i + 0.5)) / M;
          const rr = Math.sqrt(1 - y * y);
          const a = i * 2.399963;
          const d = [rr * Math.cos(a), y, rr * Math.sin(a)];
          const p = add(mul(d, radius(d)), [0, 0, cz]);
          const r = LOBES.indexOf(region(p));
          pts[r].push(p);
          if (d[2] * side > 0.2) sum[r] = add(sum[r], d);
        }
        LOBES.forEach((_, r) => {
          const d = unit(sum[r]);
          const hub = add(mul(d, radius(d)), [0, 0, cz]);
          hubs[off + r] = hub;
          reach[off + r] = Math.min(0.85, Math.max(...pts[r].map((p) => len(sub(p, hub)))));
        });
        let lastG = null;
        k.add(k.radial(radius, { grid: 96, thick: 0.3 }), {
          pos: [0, 0, cz],
          flat: 0.2,
          interior: 0.1,
          kind: "band",
          channel: (c) => (c.inside ? 0 : BRAIN_CHANNEL[off + LOBES.indexOf(region(c.p))]),
          // The colour function has just worked out this splat's groove.
          params: (c) => {
            if (c.inside || !lastG || (lastG.fold < 0.25 && lastG.deep < 0.4)) return noSpark;
            return sparkAt(off + LOBES.indexOf(region(c.p)), c.p);
          },
          core: (c) => {
            // Grey matter near the surface, white matter within.
            const q = sub(c.p, [0, 0, cz]);
            const d = unit(q);
            return len(q) > shape(d) * 0.86 ? "#c98e96" : "#f4e4d4";
          },
          color: (c) => {
            const p = c.p;
            const g = groove(p);
            lastG = g;
            let col = PAL[region(p)];
            col = mix(col, shade(col, 0.45), g.fold * 0.85);
            col = mix(col, shade(col, 0.35), g.deep);
            return gloss(lit(col, c.n, 0.62, 0.45), c.n, 0.25, 12);
          },
        });
      };
      const surfaces = [];
      hemi(1);
      hemi(-1);
      // Cerebellum: tucked under the back, finely striped with folia.
      const cereb = (d) => 1 / Math.hypot(d[0] / 0.42, d[1] / 0.3, d[2] / 0.78);
      const cerebAt = [0.58, -0.5, 0];
      const cd = unit([0.25, 0.2, 1]);
      hubs[8] = add(cerebAt, mul(cd, cereb(cd)));
      reach[8] = 0.85;
      const folia = (lp) =>
        Math.sin(
          (lp[1] + 0.25 * lp[0] * lp[0]) * 70 + k.noise(lp[0] * 4, lp[1] * 4, lp[2] * 4) * 2,
        );
      k.add(k.radial(cereb, { grid: 72, thick: 0.22 }), {
        pos: cerebAt,
        flat: 0.2,
        interior: 0.1,
        core: "#f4e4d4",
        kind: "band",
        channel: BRAIN_CHANNEL[8],
        params: (c) => (!c.inside && folia(c.lp) > 0.55 ? sparkAt(8, c.p) : noSpark),
        color: (c) => {
          const lp = c.lp;
          const f = folia(lp);
          let col = PAL.cerebellum;
          if (f > 0.55) col = shade(col, 0.72);
          if (Math.abs(lp[2]) < 0.04) col = shade(col, 0.6);
          return lit(col, c.n, 0.62, 0.45);
        },
      });
      k.data = { hubs, reach };
      // Brainstem: the pons and the medulla reaching down.
      k.add(
        k.tube(
          spline([
            [0.18, -0.2, 0],
            [0.2, -0.55, 0],
            [0.24, -0.85, 0],
            [0.3, -1.1, 0],
          ]),
          (t) => 0.17 - 0.06 * t,
          { grid: 40, samples: 64, caps: true },
        ),
        {
          flat: 0.2,
          color: (c) => {
            const stripe = Math.abs(Math.sin(c.u * TAU * 5)) > 0.9;
            return lit(stripe ? shade(PAL.stem, 0.85) : PAL.stem, c.n, 0.62, 0.45);
          },
        },
      );
      k.add(k.ellipsoid(0.18, 0.16, 0.22), {
        pos: [0.12, -0.52, 0],
        flat: 0.2,
        color: (c) => lit(mix(PAL.stem, "#ffffff", 0.1), c.n, 0.62, 0.45),
      });
      // Little sparks of neurons firing, twinkling over the surface.
      k.cloud({ share: 0.0015, size: 1.2, pattern: false }, (rand) => {
        const s = surfaces[rand() < 0.5 ? 0 : 1];
        const d = randDir(rand);
        const p = add(mul(d, s.radius(d) + 0.012), [0, 0, s.cz]);
        return {
          p,
          color: rand() < 0.6 ? "#fff6b8" : "#d2f7ff",
          opacity: 1,
          kind: "twinkle",
          params: [0.55, rand() * TAU],
        };
      });
    },
  },

  // ---- Eye ------------------------------------------------------------------------------
  eye: {
    alive: true,
    options: [{ key: "iris", label: "Iris", type: "color", default: "#2f7fc1" }],
    controls: [
      { key: "pupil", label: "Pupil", type: "slider", default: 0.35 },
      { key: "light", label: "Blink", type: "pulse", ease: 3.2 },
    ],
    action: { key: "light", label: "Blink" },
    // By itself the eye glances from place to place, with quick jumps and
    // still moments between them. A tap makes it blink, stare at you and
    // snap its pupil small before it goes back to looking round.
    drive(t, c, out) {
      const p = c.light > 0 ? 1 - c.light : 1;
      const look = eyeGlance(t);
      const stare = smoothstep(0.04, 0.12, p) * (1 - smoothstep(0.72, 0.95, p));
      const yaw = look[0] + (EYE_VIEWER[0] - look[0]) * stare;
      const pitch = look[1] + (EYE_VIEWER[1] - look[1]) * stare;
      out.parts.ball = {
        quat: quatMul(quatAxisAngle([0, 1, 0], yaw), quatAxisAngle([1, 0, 0], -pitch)),
      };
      const snap = smoothstep(0.07, 0.11, p) * (1 - smoothstep(0.7, 0.98, p));
      out.grow = clamp(c.pupil * (1 - 0.9 * snap), 0, 1);
      // The lid drops over the eye and lifts again in about a third of a second.
      const shut = c.light > 0 ? smoothstep(0, 0.045, p) * (1 - smoothstep(0.055, 0.12, p)) : 0;
      const lidOn = p < 0.13 && c.light > 0 ? 1 : 0;
      out.parts.lid = { angle: -0.95 + 1.07 * shut, visible: lidOn };
      out.parts.lidLow = { angle: 0.95 - 0.87 * shut, visible: lidOn };
    },
    build(k, o) {
      const ball = k.part("ball", { pivot: [0, 0, 0] });
      const iris = o.iris;
      // The white of the eye, with fine vessels towards the back.
      k.add(k.sphere(1), {
        part: ball,
        flat: 0.15,
        color: (c) => {
          const n = c.ln;
          // Open at the front, where the iris sits.
          if (n[2] > 0.868) return null;
          let col = mix("#f7f4ee", "#e9e1d6", smoothstep(0.3, -0.8, n[2]));
          const vein = Math.abs(c.fbm(n[0] * 3 + 4, n[1] * 3, n[2] * 3, 3));
          if (vein < 0.03 && n[2] < 0.55)
            col = mix(col, "#d9535f", 0.6 * smoothstep(0.55, -0.2, n[2]));
          return lit(col, c.n, 0.66, 0.4);
        },
      });
      // Iris: a shallow cone of radial fibres, a dark rim and a pale ring.
      const irisR = 0.5;
      const iz = Math.sqrt(1 - irisR * irisR) + 0.01;
      k.add(
        k.param(
          (u, v) => {
            const a = u * TAU;
            const r = 0.12 + v * (irisR - 0.12);
            return [r * Math.cos(a), r * Math.sin(a), iz + 0.03 * (1 - v) * (1 - v)];
          },
          { grid: 64, thick: 0.02 },
        ),
        {
          part: ball,
          weight: 2.2,
          flat: 0.1,
          pattern: false,
          color: (c) => {
            const a = c.u * TAU;
            const r = c.v;
            const fibre =
              0.5 + 0.5 * Math.sin(a * 60 + 3 * c.noise(Math.cos(a) * 3, Math.sin(a) * 3, r * 4));
            let col = mix(shade(iris, 0.75), mix(iris, "#ffffff", 0.35), fibre * 0.6);
            col = mix(col, "#e6b35a", 0.45 * smoothstep(0.3, 0.0, r));
            col = mix(col, shade(iris, 0.3), smoothstep(0.82, 1, r));
            return col;
          },
        },
      );
      // The pupil, and a ring of black that grows as the pupil opens.
      k.add(k.disc(0.14), {
        part: ball,
        pos: [0, 0, iz + 0.06],
        rot: [90, 0, 0],
        weight: 3,
        pattern: false,
        color: "#070707",
      });
      k.add(k.disc(0.4, 0.13), {
        part: ball,
        pos: [0, 0, iz + 0.062],
        rot: [90, 0, 0],
        weight: 3,
        pattern: false,
        kind: "grow",
        params: (c) => {
          const r = Math.hypot(c.lp[0], c.lp[2]);
          return [clamp((r - 0.14) / 0.26, 0, 1) * 0.92, 0];
        },
        color: "#070707",
      });
      // The cornea: a clear dome over the iris.
      k.add(
        k.param(
          (u, v) => {
            const a = u * TAU;
            const th = v * 0.62;
            const R = 0.62;
            const cz = iz - R * Math.cos(0.62) + 0.06;
            return [
              R * Math.sin(th) * Math.cos(a),
              R * Math.sin(th) * Math.sin(a),
              cz + R * Math.cos(th),
            ];
          },
          { grid: 40, thick: 0.02 },
        ),
        {
          part: ball,
          flat: 0.1,
          opacity: 0.1,
          pattern: false,
          color: "#eaf6ff",
        },
      );
      // Inside (Slice): the lens behind the iris and the orange retina.
      k.add(k.ellipsoid(0.3, 0.3, 0.13), {
        part: ball,
        pos: [0, 0, iz - 0.2],
        weight: 1.2,
        pattern: false,
        opacity: 0.8,
        color: (c) => lit("#f4e3a1", c.n, 0.8, 0.3),
      });
      k.add(
        k.param(
          (u, v) => {
            const a = u * TAU;
            const th = Math.PI * 0.35 + v * Math.PI * 0.65;
            const R = 0.97;
            return [
              R * Math.sin(th) * Math.cos(a),
              R * Math.sin(th) * Math.sin(a),
              R * Math.cos(th),
            ];
          },
          { grid: 48, thick: 0.02 },
        ),
        {
          part: ball,
          pattern: false,
          color: (c) =>
            Math.abs(c.fbm(c.p[0] * 4, c.p[1] * 4, 2, 2)) < 0.04 ? "#b3262f" : "#e8744f",
        },
      );
      // The optic nerve at the back.
      k.add(
        k.tube(
          spline([
            [0.08, -0.05, -0.9],
            [0.12, -0.08, -1.2],
            [0.2, -0.15, -1.45],
          ]),
          0.16,
          { grid: 32, samples: 32, caps: true },
        ),
        {
          part: ball,
          flat: 0.2,
          color: (c) => lit(mix("#f2d59a", "#e9c27a", 0.5 + 0.5 * Math.sin(c.u * TAU * 8)), c.n),
        },
      );
      // A window highlight on the cornea (it stays put as the eye moves).
      k.add(k.sphere(0.07), {
        pos: [-0.2, 0.26, iz + 0.14],
        scale: [1.2, 0.8, 0.3],
        weight: 3,
        opacity: 0.95,
        pattern: false,
        color: (c) => keep("#ffffff"),
      });
      k.add(k.sphere(0.03), {
        pos: [0.18, -0.2, iz + 0.12],
        weight: 3,
        opacity: 0.8,
        pattern: false,
        color: (c) => keep("#ffffff"),
      });
      // The eyelids (only there while it blinks): skin-coloured shells over
      // the front that close from above and below, with a lash line.
      for (const up of [1, -1]) {
        const lid = k.part(up > 0 ? "lid" : "lidLow", { pivot: [0, 0, 0], axis: [1, 0, 0] });
        // A patch of a sphere: from the lash line at the equator up (or
        // down) over the front.
        const shell = k.param(
          (u, v) => {
            const az = (u - 0.5) * 2.2;
            const el = up * v * 1.15;
            const r = 1.08;
            return [
              r * Math.cos(el) * Math.sin(az),
              r * Math.sin(el),
              r * Math.cos(el) * Math.cos(az),
            ];
          },
          { grid: 32, normal: (u, v, q) => q },
        );
        k.add(shell, {
          part: lid,
          flat: 0.2,
          share: 0.05,
          pattern: false,
          color: (c) =>
            c.v < 0.05 ? "#3a2418" : lit(mix("#e7b394", "#cf8f72", 1 - c.ln[2] / 1.08), c.n),
        });
      }
      k.reach([0.4, 0.3, 1.1]);
      k.reach([-0.4, -0.3, 1.1]);
    },
  },

  // ---- Lungs ----------------------------------------------------------------------------
  lungs: {
    alive: true,
    options: [{ key: "color", label: "Colour", type: "color", default: "#f095a3" }],
    controls: [
      { key: "breath", label: "Breath", type: "slider", default: 0.5 },
      { key: "deep", label: "Deep breath", type: "pulse", ease: LUNG_BREATH },
    ],
    action: { key: "deep", label: "Take a deep breath" },
    // The lungs breathe gently by themselves. A tap takes a deep breath: they
    // fill out sideways and down (the airways stay put), hold, then empty
    // further than usual and settle back to the gentle rhythm.
    drive(t, c, out) {
      const s = progress(c.deep) * LUNG_BREATH;
      // Channel 0 empties the lungs at 1; below 0 it fills them past rest.
      const idle = -(0.07 + 0.26 * c.breath) * Math.sin(t * 1.3);
      const calm = 1 - bump(s, 0, 0.5, LUNG_BREATH - 0.9, LUNG_BREATH);
      out.morph = [idle * calm + lungDeep(s), 0, 0, 0];
    },
    build(k, o) {
      const pink = o.color;
      const empty = (p, w = 1) => add(p, mul(lungEmpty(p), w));
      // Each lung: tall and rounded, pointed at the top, hollowed beneath,
      // flatter on the side facing the heart.
      const lungs = [];
      const lung = (side) => {
        const cx = side * 0.52;
        lungs.push({ cx, shape: (d) => shape(d) });
        const shape = (d) => {
          const medial = d[0] * side < 0;
          const ax = medial ? 0.3 : 0.5;
          const ay = d[1] > 0 ? 1.0 : 0.72;
          let r = 1 / Math.hypot(d[0] / ax, d[1] / ay, d[2] / 0.44);
          r *= 1 - 0.3 * smoothstep(0.3, 1, d[1]);
          // A hollow underneath where the diaphragm rises.
          r *= 1 - 0.18 * smoothstep(-0.6, -1, d[1]);
          // The heart's notch in the left lung.
          if (side > 0) {
            const nd = unit([-0.8, -0.35, 0.5]);
            r *= 1 - 0.28 * Math.pow(Math.max(0, dot(d, nd)), 4);
          }
          return r;
        };
        // Fissures between the lobes, on the surface.
        const fissure = (p) => {
          const x = (p[0] - cx) * side;
          const y = p[1];
          const oblique = Math.abs(y - (0.35 - 0.8 * (p[2] + 0.2) - 0.25 * x));
          let g = smoothstep(0.03, 0.0, oblique);
          if (side < 0 && p[2] > -0.05 && y > -0.1 + 0.8 * 0) {
            const horiz = Math.abs(y - 0.05 - 0.05 * x);
            if (y - (0.35 - 0.8 * (p[2] + 0.2) - 0.25 * x) > 0)
              g = Math.max(g, smoothstep(0.03, 0.0, horiz));
          }
          return g;
        };
        k.add(k.radial(shape, { grid: 96, thick: 0.3 }), {
          pos: [cx, 0, 0],
          flat: 0.2,
          // A little bigger than usual, so the surface stays closed when it
          // stretches in a deep breath.
          size: 1.25,
          interior: 0.08,
          core: shade(pink, 0.96),
          to: (c) => empty(c.p),
          color: (c) => {
            const g = fissure(c.p);
            const mott = c.noise(c.p[0] * 30, c.p[1] * 30, c.p[2] * 30);
            let col = shade(pink, 1 + 0.08 * mott);
            col = mix(col, shade(pink, 0.55), g);
            return gloss(lit(col, c.n, 0.62, 0.42), c.n, 0.3, 14);
          },
        });
      };
      lung(-1);
      lung(1);
      // The windpipe with its rings of cartilage, and the bronchi.
      const ringCol = (c, y) =>
        lit(Math.abs(Math.sin(y * 42)) > 0.55 ? "#f3e2da" : "#dcb8b0", c.n, 0.65, 0.4);
      k.add(k.cylinder(0.13, 0.9, { caps: false }), {
        pos: [0, 0.95, -0.05],
        flat: 0.2,
        color: (c) => ringCol(c, c.p[1]),
      });
      const tree = [];
      const branch = (a, b, r, depth) => {
        const mid = add(lerp(a, b, 0.5), [0, 0.03, 0.02]);
        tree.push({ pts: [a, mid, b], r });
        if (depth <= 0) return;
        const d = unit(sub(b, a));
        for (const s of [-1, 1]) {
          const nd = unit(
            add(d, [
              s * 0.5 + (k.rand() - 0.5) * 0.3,
              -0.25 + (k.rand() - 0.5) * 0.3,
              (k.rand() - 0.5) * 0.4,
            ]),
          );
          branch(b, add(b, mul(nd, len(sub(b, a)) * 0.7)), r * 0.7, depth - 1);
        }
      };
      for (const side of [-1, 1]) branch([0, 0.52, -0.05], [side * 0.34, 0.25, -0.02], 0.08, 3);
      tree.forEach((b, i) => {
        k.add(
          k.tube(spline(b.pts), (t) => b.r * (1 - 0.25 * t), {
            grid: 24,
            samples: 24,
            caps: i < 2,
          }),
          {
            weight: i < 2 ? 1 : 1.3,
            flat: 0.2,
            // The branches inside the lungs move with them; the windpipe
            // end of the tree stays put.
            to: (c) => empty(c.p, clamp01((Math.abs(c.p[0]) - 0.12) / 0.25)),
            pattern: false,
            // Inside the lungs the airways are pinker, so where the
            // surface thins in a deep breath they do not show through as
            // pale flecks.
            color: (c) => {
              const col = ringCol(c, c.t * 3);
              const deep = lungs.some((l) => {
                const q = sub(c.p, [l.cx, 0, 0]);
                return len(q) < l.shape(unit(q)) * 0.97;
              });
              return deep ? mix(col, shade(pink, 0.9), 0.75) : col;
            },
          },
        );
      });
    },
  },

  // ---- Tooth ----------------------------------------------------------------------------
  tooth: {
    alive: true,
    options: [{ key: "color", label: "Enamel", type: "color", default: "#f5f1e6" }],
    controls: [{ key: "shine", label: "Shine", type: "pulse", ease: TOOTH_SHINE }],
    action: { key: "shine", label: "Polish" },
    // A tap polishes it: a bright sheen wipes across from the top left, star
    // sparkles pop where it passes, and the tooth stays bright white for a
    // moment before it settles.
    drive(t, c, out, info) {
      out.amount = 1;
      const s = progress(c.shine) * TOOTH_SHINE;
      const on = c.shine > 0 ? 1 : 0;
      // Channel 0: the sheen's place across the tooth (0..1). Channel 1: the
      // whitening of the dentin that shows through the enamel.
      const wipe = rise(s, TOOTH_WIPE[0], TOOTH_WIPE[1]);
      const white = bump(s, 0.05, 1.2, 2.3, 3.3);
      out.morph = [on ? -0.15 + 1.45 * wipe : -5, on ? -1.3 + 1.45 * white : -5, 0, 0];
      out.glow = [0.9, 0.96, 1, on * (0.7 * (1 - rise(s, 1.05, 1.4)) + 0.45 * white)];
      const stars = info.data?.stars || [];
      out.tokens = stars.map((st) => {
        let v = 0;
        let spin = 0;
        for (const [at, big] of st.pops) {
          const x = (s - at) / 0.5;
          if (x <= 0 || x >= 1 || !on) continue;
          v = Math.max(v, big * Math.pow(Math.sin(Math.PI * x), 0.8));
          spin = 0.9 * x;
        }
        return { base: st.p, quat: quatAxisAngle(VIEW, spin), visible: v };
      });
    },
    build(k, o) {
      const enamel = o.color;
      // The wipe's place (0..1) across the tooth, from top left to bottom right
      // as the camera first sees it.
      const right = unit(cross([0, 1, 0], VIEW));
      const up = cross(VIEW, right);
      const wdir = unit(sub(mul(right, 0.8), up));
      let w0 = Infinity;
      let w1 = -Infinity;
      for (const q of [
        [-0.62, 0.86, -0.56],
        [0.62, 0.86, -0.56],
        [-0.62, 0.86, 0.56],
        [0.62, 0.86, 0.56],
        [-0.62, -0.2, -0.56],
        [0.62, -0.2, -0.56],
        [-0.62, -0.2, 0.56],
        [0.62, -0.2, 0.56],
        [-0.2, -1.0, 0.05],
        [0.2, -1.0, 0.05],
      ]) {
        w0 = Math.min(w0, dot(q, wdir));
        w1 = Math.max(w1, dot(q, wdir));
      }
      const wipeAt = (p) => (dot(p, wdir) - w0) / (w1 - w0);
      // The enamel's surface takes the sheen; the inside whitens.
      const shine = {
        kind: "band",
        channel: (c) => (c.inside ? 1 : 0),
        params: (c) => (c.inside ? [0.3 * wipeAt(c.p), 0.99] : [wipeAt(c.p), 0.045]),
      };
      // The crown: a rounded block with four cusps and grooves between them.
      const cusps = [
        [0.3, 0.3],
        [-0.3, 0.3],
        [0.3, -0.28],
        [-0.3, -0.28],
      ];
      const cy = 0.3;
      const crown = (d) => {
        const p = 3.2;
        const ax = 0.62;
        const az = 0.56;
        const ay = d[1] > 0 ? 0.42 : 0.5;
        let r =
          1 /
          Math.pow(
            Math.abs(d[0] / ax) ** p + Math.abs(d[1] / ay) ** p + Math.abs(d[2] / az) ** p,
            1 / p,
          );
        if (d[1] > 0) {
          const x = d[0] * r;
          const z = d[2] * r;
          let bump = 0;
          for (const [cx, cz] of cusps) bump += Math.exp(-((x - cx) ** 2 + (z - cz) ** 2) / 0.05);
          r += d[1] * (0.14 * bump - 0.05);
        }
        // Narrowing to the neck below.
        if (d[1] < 0) r *= 1 - 0.18 * smoothstep(-0.2, -0.8, d[1]);
        return r;
      };
      const pulp = (p) => {
        const q = sub(p, [0, cy - 0.05, 0]);
        return Math.hypot(q[0] / 0.26, q[1] / 0.22, q[2] / 0.22) < 1;
      };
      k.add(k.radial(crown, { grid: 96, thick: 0.4 }), {
        pos: [0, cy, 0],
        flat: 0.2,
        interior: 0.18,
        ...shine,
        core: (c) => {
          if (pulp(c.p)) return "#e56f7c";
          const d = unit(sub(c.p, [0, cy, 0]));
          return len(sub(c.p, [0, cy, 0])) > crown(d) * 0.84 ? "#fbf7ec" : "#f1d58e";
        },
        color: (c) => {
          const lp = c.lp;
          // The groove between the cusps on the biting surface.
          const top = c.n[1] > 0.3 && lp[1] > 0.25;
          const fis = top && (Math.abs(lp[0]) < 0.035 || Math.abs(lp[2] + 0.01) < 0.03);
          let col = fis ? shade(enamel, 0.72) : enamel;
          col = mix(col, "#eadfca", smoothstep(0.0, -0.35, lp[1]));
          col = lit(col, c.n, 0.55, 0.5);
          return gloss(col, c.n, 0.55, 22);
        },
      });
      // Two roots, curving slightly, with canals down the middle (Slice).
      for (const s of [-1, 1]) {
        const curve = spline([
          [s * 0.3, cy - 0.2, 0],
          [s * 0.34, cy - 0.6, 0],
          [s * 0.3, cy - 1.0, 0.02],
          [s * 0.2, cy - 1.3, 0.04],
        ]);
        k.add(
          snugTube(k, curve, (t) => 0.21 * (1 - 0.75 * Math.pow(t, 1.4)) + 0.015, {
            grid: 48,
            samples: 64,
            caps: true,
          }),
          {
            scale: [1, 1, 1.35],
            flat: 0.2,
            interior: 0.15,
            ...shine,
            core: (c) => {
              const a = curve(c.t ?? 0);
              const q = [c.p[0] - a[0], c.p[1] - a[1], c.p[2] / 1.35 - a[2]];
              return len(q) < 0.05 + 0.03 * (1 - (c.t ?? 0)) ? "#e56f7c" : "#f1d58e";
            },
            color: (c) => {
              const col = mix("#efe2c4", "#e2cfa4", c.t ?? 0);
              return gloss(lit(col, c.n, 0.55, 0.5), c.n, 0.25, 14);
            },
          },
        );
      }
      // Star sparkles (hidden until a tap), just off the crown's faces and
      // edges and on the roots; each is a token that pops as the sheen passes.
      const onCrown = (a, b, lift = 0.03) => {
        const d = unit(add(VIEW, add(mul(right, a), mul(up, b))));
        return add([0, cy, 0], mul(d, crown(d) + lift));
      };
      const spots = [
        onCrown(-0.95, 0.75, 0.02),
        onCrown(-0.3, 0.5),
        onCrown(0.35, 0.62, 0.02),
        onCrown(-0.55, -0.05),
        onCrown(0.15, 0.05),
        onCrown(0.75, -0.2, 0.02),
        [-0.3, cy - 0.7, 0.36],
        [0.36, cy - 0.95, 0.3],
      ];
      const stars = spots.map((p) => {
        const at = TOOTH_WIPE[0] + ((TOOTH_WIPE[1] - TOOTH_WIPE[0]) * (wipeAt(p) + 0.15)) / 1.45;
        return { p, pops: [[at - 0.08, 1]] };
      });
      // A few twinkle again while it gleams.
      stars[1].pops.push([1.75, 0.8]);
      stars[4].pops.push([2.05, 0.7]);
      stars[0].pops.push([2.3, 0.9]);
      stars[5].pops.push([2.55, 0.6]);
      stars.forEach((st, i) => {
        k.cloud({ count: 12, pattern: false }, (rand, j, n) => {
          const role = Math.floor((j * 6) / n);
          const base = { p: st.p, kind: "token", params: [i, 0], opacity: 1 };
          if (role === 0) return { ...base, color: "#dfeeff", size: 14, opacity: 0.3 };
          if (role === 1) return { ...base, color: "#ffffff", size: 5 };
          if (role < 4)
            return {
              ...base,
              color: "#ffffff",
              size: 2.4,
              dir: role === 2 ? right : up,
              stretch: 13,
            };
          const diag = role === 4 ? add(right, up) : sub(right, up);
          return { ...base, color: "#f4f8ff", size: 1.7, dir: diag, stretch: 7, opacity: 0.9 };
        });
      });
      k.data = { stars };
    },
  },

  // ---- Kidney ---------------------------------------------------------------------------
  kidney: {
    alive: true,
    options: [{ key: "color", label: "Colour", type: "color", default: "#c2504a" }],
    controls: [{ key: "flow", label: "Flow", type: "pulse", ease: KIDNEY_FLOW }],
    action: { key: "flow", label: "Pump blood through" },
    // A tap sends three pulses through: each runs in along the artery,
    // spreads through the kidney (which swells a little), leaves along the
    // vein, and a drop runs down the ureter.
    drive(t, c, out) {
      const s = progress(c.flow) * KIDNEY_FLOW;
      const ch = [-5, -5, -5, -5];
      let swell = 0;
      for (const T of KIDNEY_PULSES) {
        for (const [i, t0, t1, a0, a1] of KIDNEY_RUNS)
          if (s >= T + t0 && s < T + t1) ch[i] = a0 + ((a1 - a0) * (s - T - t0)) / (t1 - t0);
        swell = Math.max(swell, bump(s - T, 0.3, 0.55, 0.6, 1.1));
      }
      out.morph = ch;
      out.glow = [1, 0.9, 0.78, 0.85];
      out.parts.kidney = { scale: 1 + 0.008 * Math.sin(t * 1.3) + 0.04 * swell };
    },
    build(k, o) {
      const col = o.color;
      const kidney = k.part("kidney", { pivot: KIDNEY_HILUM });
      // A bean: an ellipsoid with a dent (the hilum) on its inner side.
      const bean = (d) => {
        let r = 1 / Math.hypot(d[0] / 0.58, d[1] / 1.0, d[2] / 0.4);
        const hil = Math.max(0, dot(d, [-1, 0, 0]));
        r *= 1 - 0.42 * Math.pow(hil, 3);
        return r;
      };
      const pelvis = [-0.28, 0, 0];
      const skin = (c) => {
        const n = c.noise(c.p[0] * 12, c.p[1] * 12, c.p[2] * 12);
        const base = shade(col, 1 + 0.06 * n);
        return gloss(lit(base, c.n, 0.6, 0.45), c.n, 0.45, 18);
      };
      // A faint layer just over the surface, coloured as it is, carries a
      // soft flush that spreads out from the hilum with each pulse (channel 1).
      const beanAt = (u, v) => {
        const a = u * TAU;
        const b = v * Math.PI;
        const d = [Math.sin(b) * Math.cos(a), Math.cos(b), Math.sin(b) * Math.sin(a)];
        return mul(d, bean(d) * 1.006);
      };
      k.add(k.param(beanAt, { grid: 96 }), {
        even: true,
        share: 0.08,
        size: 3.2,
        flat: 0.2,
        opacity: 0.24,
        jitter: 0.01,
        part: kidney,
        kind: "band",
        channel: 1,
        params: (c) => [len(sub(c.p, KIDNEY_HILUM)), 0.16],
        color: skin,
      });
      k.add(k.radial(bean, { grid: 96, thick: 0.32 }), {
        flat: 0.2,
        interior: 0.15,
        part: kidney,
        core: (c) => {
          const q = sub(c.p, pelvis);
          const r = Math.hypot(q[0], q[1], q[2] * 1.3);
          if (r < 0.2) return "#f3e3b5";
          const a = Math.atan2(q[1], q[0]);
          const d = unit(c.p);
          const outer = len(c.p) > bean(d) * 0.8;
          if (outer) return mix(col, "#e7907f", 0.4);
          const sector = Math.abs(Math.sin(a * 4.5));
          if (sector > 0.35 && r < 0.62) return Math.sin(r * 80) > 0 ? "#8e2f35" : "#a8434a";
          return mix(col, "#e7907f", 0.3);
        },
        color: skin,
      });
      // Vessels at the hilum: artery (red), vein (blue) and the ureter below.
      // Each carries pulses of light on its own channel: `at` is how far along
      // the flow a point is (in along the artery, out along the vein and down
      // the ureter).
      const vessel = (pts, r, color, channel, at) =>
        k.add(k.tube(spline(pts), r, { grid: 32, samples: 64, caps: true }), {
          flat: 0.2,
          pattern: false,
          kind: "band",
          channel,
          params: (c) => [at(c.t ?? 0), 0.09],
          color: (c) => gloss(lit(color, c.n, 0.62, 0.45), c.n, 0.35, 14),
        });
      vessel(
        [
          [-0.25, 0.12, 0.02],
          [-0.55, 0.2, 0.05],
          [-0.85, 0.26, 0.02],
        ],
        0.075,
        "#e0463e",
        0,
        (t) => (1 - t) * 0.62,
      );
      vessel(
        [
          [-0.25, 0.0, 0.1],
          [-0.55, 0.02, 0.15],
          [-0.88, 0.06, 0.12],
        ],
        0.085,
        "#4d6fd0",
        2,
        (t) => t * 0.64,
      );
      vessel(
        [
          [-0.25, -0.12, 0],
          [-0.42, -0.35, 0.02],
          [-0.45, -0.75, 0.0],
          [-0.4, -1.15, -0.02],
        ],
        0.055,
        "#f1d38a",
        3,
        (t) => t * 1.09,
      );
      // The adrenal gland perched on top.
      k.add(k.ellipsoid(0.32, 0.14, 0.24), {
        pos: [0.06, 0.98, 0],
        rot: [0, 0, -12],
        flat: 0.2,
        part: kidney,
        pattern: false,
        color: (c) =>
          lit(
            mix("#f2c14e", "#e5a93a", 0.5 + 0.5 * c.noise(c.p[0] * 10, c.p[1] * 10, c.p[2] * 10)),
            c.n,
          ),
      });
    },
  },
};

// Where the eye looks by itself at time t, as [yaw, pitch]: it holds a glance
// for a second or two, then jumps quickly to the next one. The first glance is
// straight ahead, so its still look does not change.
const EYE_VIEWER = [0.55, 0.28];
function eyeGlance(t) {
  const hold = 1.7;
  const i = Math.floor(t / hold);
  const f = t / hold - i;
  const at = (j) => {
    if (j <= 0) return [0, 0.17];
    const h = Math.sin(j * 12.9898) * 43758.5453;
    const r = h - Math.floor(h);
    const h2 = Math.sin(j * 78.233) * 12345.678;
    const r2 = h2 - Math.floor(h2);
    return [0.55 * (2 * r - 1), 0.32 * (2 * r2 - 1)];
  };
  const a = at(i);
  const b = at(i + 1);
  const s = smoothstep(0.82, 0.92, f);
  const drift = 0.02 * Math.sin(t * 2.3);
  return [a[0] + (b[0] - a[0]) * s + drift, a[1] + (b[1] - a[1]) * s];
}
