// Rigs for captured toys and shelf shapes (see src/rig.js): parts made of
// soft ellipsoid regions in world coordinates, plus controls, an action and
// drive() as in a kit recipe. Place regions with ?rig=show, which tints each
// part (and the colour keys), and with tools/rig-map.mjs.
//
// Beyond parts, a rig can have:
//   keys   up to two colour keys (seeds, jam, strings): { color, tol, at, r }
//          or { long } for long thin splats; see tagRig in src/rig.js
//   fx     up to four whole-body effects (src/rig-fx.js explains them)
//   addon  { build(k), count }: a small kit-built splat cloud in world
//          coordinates (a flame, flowers, a speech bubble) with its own
//          parts; drive() moves it through out.addon = { parts, glow }
//   alive  true (or a function of the controls) while it moves by itself
// A part driven with { tint, glow, bright } lights up; { scale } grows it
// about its pivot.

import { quatAxisAngle, quatMul, quatFromTo, quatRotate, mix, shade } from "./kit.js";
import { inked } from "./font.js";

const TAU = Math.PI * 2;
const clamp = (x, a, b) => Math.min(b, Math.max(a, x));
const band = (x, a, b) => clamp((x - a) / (b - a), 0, 1);
const ease = (x) => x * x * (3 - 2 * x);
const bump = (x, a, b) => Math.sin(Math.PI * band(x, a, b));
// Seconds since a pulse control fired (-1 when idle).
const since = (c, key, secs) => (c[key] > 0 ? (1 - c[key]) * secs : -1);
// 0 -> 1 over [a, b], held, back to 0 over [c, d].
const env = (e, a, b, c, d) => (e < 0 ? 0 : ease(band(e, a, b)) * (1 - ease(band(e, c, d))));
// A damped wobble that starts at 1.
const spring = (e, k = 5, w = 22) => (e < 0 ? 0 : Math.exp(-e * k) * Math.cos(e * w));
const pulse = (key, label, ease) => ({ key, label, type: "pulse", ease });
const add = (a, b) => [a[0] + b[0], a[1] + b[1], a[2] + b[2]];
const mul = (a, s) => [a[0] * s, a[1] * s, a[2] * s];
const unit = (a) => mul(a, 1 / (Math.hypot(a[0], a[1], a[2]) || 1));
const cross = (a, b) => [
  a[1] * b[2] - a[2] * b[1],
  a[2] * b[0] - a[0] * b[2],
  a[0] * b[1] - a[1] * b[0],
];
// Per-tap variety: a small hash of the tap count.
const vary = (tap, salt = 0) => {
  let h = ((tap?.n ?? 0) * 374761393 + salt * 668265263) >>> 0;
  h = Math.imul(h ^ (h >>> 13), 1274126177) >>> 0;
  return (h % 1000) / 1000;
};

// The home camera looks from here (yaw 0.55): effects that show a face turn
// towards it.
const VIEW = [Math.sin(0.55), 0, Math.cos(0.55)];
// The carrot cake's slice lifts out towards the viewer and up.
const SLICE_DIR = unit([VIEW[0] * 0.55, 1, VIEW[2] * 0.55]);

// A part that turns (ql about its own pivot pl) while riding on another part
// (qh about ph): the rotation and offset for the child.
function chain(qh, ph, ql, pl) {
  const d = quatRotate(qh, [pl[0] - ph[0], pl[1] - ph[1], pl[2] - ph[2]]);
  return { quat: quatMul(qh, ql), offset: [ph[0] + d[0] - pl[0], ph[1] + d[1] - pl[1], ph[2] + d[2] - pl[2]] }; // prettier-ignore
}
// A fraction t of the rotation q (from no rotation).
function partial(q, t) {
  const w = clamp(q[3], -1, 1);
  const a = 2 * Math.acos(w);
  const sn = Math.sqrt(1 - w * w);
  if (sn < 1e-6 || a === 0) return [0, 0, 0, 1];
  return quatAxisAngle([q[0] / sn, q[1] / sn, q[2] / sn], a * t);
}
const sub = (a, b) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];

// The cluster fly's front legs: hip, knee and foot of each, and the turns
// that lift the thigh forward and fold the shin so the foot reaches the face.
const conj = (q) => [-q[0], -q[1], -q[2], q[3]];
const FLY = (() => {
  const face = [1.0, 0.06, 0.02];
  const leg = (hip, knee, foot, kneeTo) => {
    const up = add(hip, mul(unit(sub(kneeTo, hip)), Math.hypot(...sub(knee, hip))));
    return {
      hip,
      knee,
      femur: quatFromTo(unit(sub(knee, hip)), unit(sub(up, hip))),
      shin: quatFromTo(unit(sub(foot, knee)), unit(sub(face, up))),
    };
  };
  return {
    A: leg([0.56, -0.12, 0.4], [0.64, -0.4, 0.55], [0.76, -0.63, 0.9], [0.78, -0.02, 0.46]),
    B: leg([0.66, -0.13, -0.24], [0.8, -0.42, -0.4], [0.92, -0.7, -0.78], [0.88, -0.03, -0.3]),
  };
})();

// The tomatoes on their plate: name, x, z, radius (from a top view).
const PLATE_Y = -0.17;
const TOMATOES = [
  ["t0", -0.23, -0.48, 0.3],
  ["t1", 0.27, -0.46, 0.2],
  ["t2", -0.58, -0.1, 0.21],
  ["t3", -0.16, 0.05, 0.23],
  ["t4", 0.11, -0.17, 0.14],
  ["t5", 0.52, -0.06, 0.22],
  ["t6", 0.2, 0.05, 0.11],
  ["t7", -0.54, 0.28, 0.16],
  ["t8", -0.25, 0.52, 0.2],
  ["t9", 0.25, 0.45, 0.3],
];

// The biggest shells in the basket: name, x, z, radius (from a top view).
const SHELLS = [
  ["urchinA", -0.43, -0.51, 0.155],
  ["urchinB", -0.72, 0.01, 0.17],
  ["dollarA", -0.5, 0.02, 0.15],
  ["starA", -0.01, -0.52, 0.26],
  ["urchinC", 0.0, -0.04, 0.16],
  ["scallop", 0.41, -0.04, 0.14],
  ["starB", -0.02, 0.38, 0.26],
  ["urchinD", -0.44, 0.6, 0.15],
  ["urchinE", 0.34, 0.48, 0.13],
  ["clam", -0.66, -0.32, 0.14],
];

// The wooden elephant's trunk: where it is pinned to the face.
const TRUNK = { base: [-0.86, 0.52, 0.45] };

// The marble bust: the neck pivot, the jaw hinge and when each syllable of
// "SALVE, AMICE!" starts (matching its sound).
const BUST = {
  head: [-0.02, 0.05, 0.12],
  jaw: [-0.16, 0.27, 0.16],
  syllables: [0.62, 0.82, 1.1, 1.3, 1.5],
};

// The ukulele's strings: bridge, length up to the nut, where the pick
// strums (over the sound hole's lower edge) and the strums (start, direction).
const UKE = {
  bridge: [0, -0.7, 0.072],
  length: 1.27,
  pickAt: [0, -0.46, 0.09],
  strums: [
    [0.0, 1],
    [0.3, 1],
    [0.45, -1],
    [0.75, 1],
  ],
};

// The cat statue: its neck (the head turns about it), the collar over the
// cut, the bell, and the joint where the tail tip swishes.
const CAT = {
  neck: [0.07, 0.37, 0.44],
  neckAxis: unit([0, 1, 0.2]),
  collarAt: [0.07, 0.37, 0.44],
  collarR: [0.275, 0.245],
  bellAt: [0.07, 0.315, 0.7],
  tailJoint: [0.46, -0.84, 0.12],
};

// The horse statue: where the hind hooves stand, and the foreleg knees.
const HORSE = {
  hooves: [-0.05, -0.72, 0],
  kneeA: [-0.52, 0.42, -0.09],
  kneeB: [-0.54, 0.31, 0.19],
};

// ---- Add-on builders ------------------------------------------------------------

// A small open flower: petals round a centre, facing n.
function flower(k, at, n, part, { petal = "#ff4f9a", heart = "#ffd23f", r = 0.05 } = {}) {
  const q = quatFromTo([0, 0, 1], unit(n));
  const petals = 8;
  k.cloud({ share: 0.1, part, pattern: false }, (rand, i, count) => {
    const pi = i % petals;
    const a = ((pi + 0.5 * rand()) / petals) * TAU;
    const t = Math.sqrt(rand());
    const w = (rand() - 0.5) * 0.5 * Math.sin(Math.PI * t);
    const local = [
      Math.cos(a + w) * r * t,
      Math.sin(a + w) * r * t,
      0.2 * r * t * t, // petals cup upwards
    ];
    return {
      p: add(at, quatRotate(q, local)),
      n: quatRotate(q, [0, 0, 1]),
      color: t < 0.25 ? heart : mix(petal, "#ffd0e6", 0.5 * (1 - t) + 0.15 * rand()),
      size: 0.55 + 0.3 * t,
      opacity: 0.95,
    };
  });
}

// A flame of rising, shrinking, reddening splats with a soft glow.
function flameAt(k, at, { h = 0.2, r = 0.05, share = 0.5, part = 0, glowPart = 0 } = {}) {
  k.cloud({ share, part, pattern: false }, (rand) => {
    const a = rand() * TAU;
    const rr = r * Math.sqrt(rand());
    const hot = 1 - rr / r;
    return {
      p: [at[0] + Math.sin(a) * rr, at[1] + rand() * 0.03, at[2] + Math.cos(a) * rr],
      color: mix("#ffb347", "#fff6cf", hot * 0.9),
      size: 0.9 + 0.9 * hot,
      opacity: 0.85,
      kind: "flame",
      params: [h * (0.6 + 0.6 * hot * rand()), rand()],
    };
  });
  // A soft warm halo.
  k.cloud({ share: 0.08, part: glowPart, pattern: false }, (rand) => {
    const d = [rand() - 0.5, rand() - 0.5, rand() - 0.5];
    return {
      p: add(add(at, [0, h * 0.4, 0]), mul(d, h * 0.9)),
      color: "#ffcf7a",
      size: 4 + 3 * rand(),
      opacity: 0.08,
    };
  });
}

// A flat panel of splats: fn(u, v) -> colour or null, over a w x h
// rectangle centred at `at`, facing n (up is roughly +y).
function panel(k, at, n, w, h, share, part, fn, { size = 0.6 } = {}) {
  const nz = unit(n);
  const x = unit(cross([0, 1, 0], nz));
  const y = cross(nz, x);
  k.cloud({ share, part, pattern: false }, (rand) => {
    const u = rand();
    const v = rand();
    const col = fn(u, v, rand);
    if (!col) return null;
    const lx = (u - 0.5) * w;
    const ly = (0.5 - v) * h;
    return {
      p: add(at, add(mul(x, lx), mul(y, ly))),
      n: nz,
      color: col,
      size,
      opacity: 0.97,
    };
  });
}

// ---- Rigs -----------------------------------------------------------------------

export const RIGS = {
  // ---- Scans ----------------------------------------------------------------------

  // Tiny magenta flowers open in a ring round the crown, then close.
  cactus: {
    parts: [],
    controls: [pulse("bloom", "Bloom", 3.4)],
    action: { key: "bloom", label: "Bloom" },
    addon: {
      count: 9000,
      build(k) {
        for (let i = 0; i < 9; i++) {
          const a = (i / 9) * TAU + 0.3;
          const ring = i % 2 ? 0.19 : 0.23;
          const y = i % 2 ? 0.93 : 0.87;
          const at = [Math.sin(a) * ring, y, Math.cos(a) * ring];
          const part = k.part(`f${i}`, { pivot: at });
          flower(k, at, [at[0], y - 0.68, at[2]], part, { r: 0.06 + 0.012 * (i % 3) });
        }
      },
    },
    drive(t, c, out) {
      const e = since(c, "bloom", 3.4);
      const parts = {};
      for (let i = 0; i < 9; i++) {
        const d = ((i * 4) % 9) * 0.07;
        const open = env(e, 0.15 + d, 0.65 + d, 2.2 + d * 0.5, 2.9 + d * 0.5);
        parts[`f${i}`] = { scale: open, angle: 0.4 * (1 - open) };
      }
      out.addon = { parts };
      if (e >= 0) out.body = { squash: -0.02 * bump(e, 0, 0.3) };
    },
  },

  // Seeds pop out and sparkle, then settle; the berry blushes redder.
  strawberry: {
    parts: [],
    keys: [
      { color: "#c9b25a", tol: 0.2 },
      { color: "#c8453c", tol: 0.3 },
    ],
    fx: [
      {
        name: "seeds",
        select: "key0",
        origin: [-0.05, 0, -0.05],
        move: { push: true },
        pattern: { stagger: 0.6 },
        color: { glow: "#fff3a0" },
      },
      {
        name: "blush",
        select: "key1",
        color: { recolor: "#d8141f", keep: 0.75 },
      },
    ],
    controls: [pulse("pop", "Pop", 2.2)],
    action: { key: "pop", label: "Pop seeds" },
    drive(t, c, out) {
      const e = since(c, "pop", 2.2);
      if (e < 0) return;
      out.fx.seeds = { move: 0.09, color: 0.6, phase: band(e, 0.02, 1.2) };
      out.fx.blush = { color: 0.7 * env(e, 0.1, 0.6, 1.4, 2.2) };
      out.body = { squash: 0.06 * spring(e, 7, 24) * band(e, 0, 0.05) };
    },
  },

  // The jam heart glows and throbs twice like a heartbeat.
  cookie: {
    parts: [],
    keys: [{ color: "#7a1c1c", tol: 0.3, at: [0, 0.05, 0.1], r: 0.45 }],
    fx: [
      {
        name: "beat",
        select: "key0",
        origin: [0, 0.05, 0.1],
        move: { push: true },
        color: { glow: "#ff2a3a" },
      },
    ],
    controls: [pulse("beat", "Beat", 1.6)],
    action: { key: "beat", label: "Heartbeat" },
    drive(t, c, out) {
      const e = since(c, "beat", 1.6);
      if (e < 0) return;
      const b = Math.exp(-(((e - 0.25) / 0.07) ** 2)) + 0.8 * Math.exp(-(((e - 0.55) / 0.08) ** 2));
      out.fx.beat = { move: 0.05 * b, color: 0.35 + 0.5 * b * (1 - band(e, 1.0, 1.6)) };
      out.fx.beat.color *= 1 - band(e, 1.1, 1.6);
    },
  },

  // The wings buzz in a blur and the bee lifts off a little, then lands.
  bee: {
    parts: [
      {
        name: "wingA",
        pivot: [0.25, 0.06, -0.1],
        axis: [1, 0, 0],
        regions: [{ at: [0.5, 0.06, -0.58], r: [0.45, 0.1, 0.5], soft: 0.35 }],
      },
      {
        name: "wingB",
        pivot: [0.25, 0.06, 0.1],
        axis: [1, 0, 0],
        regions: [{ at: [0.42, 0.06, 0.62], r: [0.42, 0.1, 0.45], soft: 0.35 }],
      },
    ],
    controls: [pulse("fly", "Fly", 2.2)],
    action: { key: "fly", label: "Fly" },
    drive(t, c, out, info) {
      const e = since(c, "fly", 2.2);
      if (e < 0) return;
      const buzz = env(e, 0, 0.08, 1.8, 2.1);
      const flap = 0.45 * buzz * Math.sin(info.time * TAU * 27);
      out.parts.wingA = { angle: flap };
      out.parts.wingB = { angle: -flap };
      const lift = env(e, 0.15, 0.7, 1.3, 1.9);
      out.body = {
        offset: [0, 0.22 * lift, 0],
        quat: quatAxisAngle([0, 0, 1], 0.12 * lift + 0.04 * lift * Math.sin(e * 9)),
      };
    },
  },

  // Grooming like a real fly: the front legs rub together, then reach up and
  // wipe the face while the head dips, and it gives a little shake. The legs
  // and head are cut with hard edges and move as solid pieces (found from
  // the splat positions, since the legs splay far out to the sides).
  "cluster-fly": {
    parts: [
      {
        name: "femurA",
        pivot: FLY.A.hip,
        regions: [
          { at: [0.6, -0.18, 0.46], r: 0.075 },
          { at: [0.63, -0.32, 0.52], r: 0.07 },
        ],
      },
      {
        name: "shinA",
        pivot: FLY.A.knee,
        regions: [
          { at: [0.66, -0.48, 0.6], r: 0.085, over: true },
          { at: [0.72, -0.58, 0.78], r: 0.11, over: true },
          { at: [0.76, -0.63, 0.9], r: 0.09, over: true },
        ],
      },
      {
        name: "femurB",
        pivot: FLY.B.hip,
        regions: [
          { at: [0.71, -0.2, -0.3], r: 0.075 },
          { at: [0.78, -0.34, -0.37], r: 0.07 },
        ],
      },
      {
        name: "shinB",
        pivot: FLY.B.knee,
        regions: [
          { at: [0.84, -0.48, -0.45], r: 0.085, over: true },
          { at: [0.91, -0.6, -0.66], r: 0.12, over: true },
          { at: [0.92, -0.7, -0.78], r: 0.08, over: true },
        ],
      },
      {
        name: "head",
        pivot: [0.6, -0.02, 0],
        axis: [0, 0, 1],
        regions: [{ at: [0.8, 0.04, 0], r: [0.2, 0.26, 0.33] }],
      },
    ],
    controls: [pulse("groom", "Groom", 3)],
    action: { key: "groom", label: "Groom" },
    drive(t, c, out) {
      const e = since(c, "groom", 3);
      if (e < 0) return;
      // Reach: 0 = standing, 1 = foot on the face. The thigh lifts forward
      // and the shin folds at the knee, like a real fly's leg.
      const rub = env(e, 0.05, 0.3, 0.95, 1.15);
      const wipe = env(e, 1.0, 1.25, 2.1, 2.35);
      const scrub = Math.sin(e * TAU * 5);
      const reach = [0.45 * rub + (0.8 + 0.15 * scrub) * wipe, 0.45 * rub + (0.8 - 0.15 * scrub) * wipe]; // prettier-ignore
      // While rubbing, the feet cross towards each other and back.
      const cross = 0.25 * rub * scrub;
      ["A", "B"].forEach((k, i) => {
        const L = FLY[k];
        const qf = quatMul(
          quatAxisAngle([1, 0, 0], i ? -cross : cross),
          partial(L.femur, reach[i]),
        );
        const qs = partial(L.shin, reach[i]);
        out.parts[`femur${k}`] = { quat: qf };
        out.parts[`shin${k}`] = chain(qf, L.hip, quatMul(conj(qf), qs), L.knee);
      });
      out.parts.head = { angle: -0.14 * wipe * (0.7 + 0.3 * scrub) };
      const shake = Math.sin(e * 40) * env(e, 2.35, 2.4, 2.6, 2.75);
      out.body = { quat: quatAxisAngle([1, 0, 0], 0.03 * shake) };
    },
  },

  // The wing cases lift and the fanned antennae spread, then fold.
  "may-beetle": {
    parts: [
      {
        name: "caseA",
        pivot: [0.32, 0.45, -0.04],
        axis: [0, 0, 1],
        regions: [{ at: [-0.08, 0.36, -0.2], r: [0.52, 0.22, 0.22], soft: 0.3 }],
      },
      {
        name: "caseB",
        pivot: [0.32, 0.45, 0.04],
        axis: [0, 0, 1],
        regions: [{ at: [-0.08, 0.36, 0.2], r: [0.52, 0.22, 0.22], soft: 0.3 }],
      },
      {
        name: "antA",
        pivot: [0.8, 0.02, -0.05],
        axis: [0, 1, 0],
        regions: [{ at: [0.88, 0.02, -0.1], r: [0.1, 0.14, 0.09], soft: 0.4 }],
      },
      {
        name: "antB",
        pivot: [0.8, 0.02, 0.05],
        axis: [0, 1, 0],
        regions: [{ at: [0.88, 0.02, 0.1], r: [0.1, 0.14, 0.09], soft: 0.4 }],
      },
    ],
    controls: [pulse("open", "Open", 2.6)],
    action: { key: "open", label: "Open wings" },
    drive(t, c, out, info) {
      const e = since(c, "open", 2.6);
      if (e < 0) return;
      const lift = env(e, 0.05, 0.55, 1.7, 2.4);
      const shake = 0.03 * lift * Math.sin(info.time * TAU * 11);
      const up = 0.75 * lift + shake;
      const out1 = 0.45 * lift;
      out.parts.caseA = { quat: quatMul(quatAxisAngle([1, 0, 0], -out1), quatAxisAngle([0, 0, 1], -up)) }; // prettier-ignore
      out.parts.caseB = { quat: quatMul(quatAxisAngle([1, 0, 0], out1), quatAxisAngle([0, 0, 1], -up)) }; // prettier-ignore
      const fan = env(e, 0.2, 0.6, 1.6, 2.2);
      out.parts.antA = { angle: 0.5 * fan };
      out.parts.antB = { angle: -0.5 * fan };
    },
  },

  // A leg wave ripples down the body while it stretches and curls.
  millipede: {
    parts: [],
    keys: [{ color: "#c2643c", tol: 0.25 }],
    fx: [
      {
        name: "legs",
        select: "key0",
        origin: [0, 0, -0.4],
        move: { along: [0, 1, 0] },
        pattern: { wave: [0, 1, 0], k: 18 },
      },
      {
        name: "curl",
        select: "all",
        origin: [0, 0, -0.4],
        move: { bend: [1, 0, 0], along: [0, 1, 0] },
      },
    ],
    controls: [pulse("crawl", "Crawl", 2.8)],
    action: { key: "crawl", label: "Crawl" },
    drive(t, c, out) {
      const e = since(c, "crawl", 2.8);
      if (e < 0) return;
      const on = env(e, 0, 0.2, 2.3, 2.8);
      out.fx.legs = { move: 0.035 * on, phase: e * 16 };
      // Stretch out (uncurl), then curl tighter, then relax.
      const bend = -0.35 * env(e, 0.1, 0.7, 0.8, 1.3) + 0.3 * env(e, 1.2, 1.8, 2.1, 2.7);
      out.fx.curl = { move: bend };
      out.body = { squash: -0.06 * env(e, 0.1, 0.7, 0.8, 1.3) };
    },
  },

  // The fuzzy body shivers and the wings hum: a slow, clumsy hover.
  bumblebee: {
    parts: [
      {
        name: "wingA",
        pivot: [0.2, 0.7, -0.1],
        axis: [0, 0, 1],
        regions: [{ at: [0.42, 0.72, -0.5], r: [0.25, 0.22, 0.5], soft: 0.3 }],
      },
      {
        name: "wingB",
        pivot: [-0.2, 0.7, -0.1],
        axis: [0, 0, 1],
        regions: [{ at: [-0.42, 0.72, -0.5], r: [0.25, 0.22, 0.5], soft: 0.3 }],
      },
    ],
    fx: [{ name: "fuzz", select: "all", move: { shiver: 55 } }],
    controls: [pulse("hover", "Hover", 3)],
    action: { key: "hover", label: "Hover" },
    drive(t, c, out, info) {
      const e = since(c, "hover", 3);
      if (e < 0) return;
      const on = env(e, 0, 0.15, 2.5, 3);
      const hum = 0.55 * on * Math.sin(info.time * TAU * 19);
      out.parts.wingA = { angle: hum };
      out.parts.wingB = { angle: -hum };
      out.fx.fuzz = { move: 0.008 * on };
      const lift = env(e, 0.3, 1.0, 2.0, 2.9);
      out.body = {
        offset: [0.08 * lift * Math.sin(e * 3.1), 0.3 * lift + 0.04 * lift * Math.sin(e * 5), 0],
        quat: quatMul(
          quatAxisAngle([0, 0, 1], 0.16 * lift * Math.sin(e * 2.3)),
          quatAxisAngle([1, 0, 0], 0.07 * lift * Math.sin(e * 3.7 + 1)),
        ),
      };
    },
  },

  // Drupelets break off one after another, tumble down to the table and
  // hop back into place.
  raspberry: {
    parts: [],
    fx: [
      {
        name: "drop",
        select: "all",
        origin: [0, 0.05, 0],
        move: { fall: [0, -1, 0], cell: 0.2, voronoi: true, pop: 0.35, spin: 2.5, share: 0.55 },
        pattern: { ramp: 0.75 },
      },
    ],
    controls: [pulse("drop", "Drop", 3.2)],
    action: { key: "drop", label: "Drop drupelets" },
    drive(t, c, out) {
      const e = since(c, "drop", 3.2);
      if (e < 0) return;
      // Each piece falls over about 0.5 s of its own; they come back together.
      const phase = e < 2.2 ? band(e, 0.02, 1.5) : 1 - ease(band(e, 2.2, 3.1));
      out.fx.drop = { move: 1.6, phase };
    },
  },

  // The glossy drupelets burst off all round, bounce on the table, glint,
  // and spring back.
  blackberry: {
    parts: [],
    fx: [
      {
        name: "burst",
        select: "all",
        origin: [0, 0, 0],
        move: { fall: [0, -1, 0], cell: 0.24, voronoi: true, pop: 0.55, spin: 3, share: 0.5 },
        pattern: { ramp: 0.25 },
      },
      {
        name: "glint",
        select: "all",
        origin: [0, 0, 0],
        color: { sparkle: 0.15 },
      },
    ],
    controls: [pulse("burst", "Burst", 2.8)],
    action: { key: "burst", label: "Burst" },
    drive(t, c, out) {
      const e = since(c, "burst", 2.8);
      if (e < 0) return;
      const phase = e < 1.7 ? band(e, 0.02, 0.9) : 1 - ease(band(e, 1.7, 2.6));
      // A small bounce as the pieces land.
      out.fx.burst = { move: 1.2 * (1 - 0.12 * Math.sin(Math.PI * band(e, 0.9, 1.3))), phase };
      out.fx.glint = { color: 2.5 * env(e, 0.8, 1.0, 1.4, 1.8) };
    },
  },

  // Like the grape: the dark skin peels back towards you in five strips to
  // show the pale green flesh, then closes.
  blueberry: {
    parts: [],
    fx: [
      {
        name: "flesh",
        select: "all",
        origin: [0, 0, 0],
        mask: { half: VIEW, at: -0.15 },
        color: { recolor: "#cfd8ac", keep: 0.6 },
      },
      {
        name: "peel",
        select: "all",
        origin: [0, 0, 0],
        mask: { stripes: VIEW, n: 5 },
        move: { peel: VIEW, hinge: -0.1 },
        color: { recolor: "#2a3160", keep: 0.8 },
      },
    ],
    controls: [pulse("peel", "Peel", 3.2)],
    action: { key: "peel", label: "Peel" },
    drive(t, c, out) {
      const e = since(c, "peel", 3.2);
      if (e < 0) return;
      const open = env(e, 0.05, 0.9, 2.2, 3.0);
      out.fx.flesh = { color: 0.8 * open };
      out.fx.peel = { move: 1.35 * open, color: 0.9 * open };
    },
  },

  // The skin peels back in strips to show the pale flesh, then closes.
  grape: {
    parts: [],
    fx: [
      {
        name: "flesh",
        select: "all",
        origin: [0, 0, 0],
        mask: { half: [0, 0, -1], at: -0.15 },
        color: { recolor: "#f1f6cf", keep: 0.55 },
      },
      {
        name: "peel",
        select: "all",
        origin: [0, 0, 0],
        mask: { stripes: [0, 0, 1], n: 4 },
        move: { peel: [0, 0, -1], hinge: -0.1 },
        color: { recolor: "#7c8a26", keep: 0.6 },
      },
    ],
    controls: [pulse("peel", "Peel", 3.2)],
    action: { key: "peel", label: "Peel" },
    drive(t, c, out) {
      const e = since(c, "peel", 3.2);
      if (e < 0) return;
      const open = env(e, 0.05, 0.9, 2.2, 3.0);
      out.fx.flesh = { color: 0.8 * open };
      out.fx.peel = { move: 1.35 * open, color: 0.8 * open };
    },
  },

  // Crumbles into pieces and crumbs, then puts itself back together.
  "star-cookie": {
    parts: [],
    fx: [
      {
        name: "crumble",
        select: "all",
        origin: [0, 0, 0],
        move: { scatter: -0.4, cell: 0.24 },
        pattern: { ramp: 0.5, cell: 0.24 },
      },
    ],
    controls: [pulse("crumble", "Crumble", 2.8)],
    action: { key: "crumble", label: "Crumble" },
    drive(t, c, out) {
      const e = since(c, "crumble", 2.8);
      if (e < 0) return;
      const apart = band(e, 0.05, 0.8);
      const back = ease(band(e, 1.6, 2.6));
      out.fx.crumble = { move: 0.28 * (1 - back), phase: apart };
      out.body = { squash: 0.05 * bump(e, 0, 0.12) };
    },
  },

  // Each tomato is its own solid piece (hard regions split by the nearest
  // centre, the white plate left out): they hop in turn, roll a little and
  // bump against each other, then settle.
  tomatoes: {
    parts: TOMATOES.map(([name, x, z, r]) => ({
      name,
      pivot: [x, PLATE_Y + r, z],
      regions: [{ at: [x, PLATE_Y + r, z], r: [r * 1.15, r * 1.35, r * 1.15], notColor: "#eeeeea", tol: 0.2 }], // prettier-ignore
    })),
    controls: [pulse("roll", "Roll", 2.6)],
    action: { key: "roll", label: "Roll" },
    drive(t, c, out, info) {
      const e = since(c, "roll", 2.6);
      if (e < 0) return;
      const spin = vary(info.tap) > 0.5 ? 1 : -1;
      TOMATOES.forEach(([name, x, z, r], i) => {
        // Small tomatoes hop higher and later; big ones rock.
        const d = 0.08 * ((i * 7) % 10);
        const hop = Math.max(0, Math.sin(Math.PI * band(e, 0.1 + d, 0.45 + d + r)));
        const settle = spring(e - (0.45 + d + r), 6, 20) * band(e, 0.45 + d + r, 0.5 + d + r);
        const h = (0.34 - 0.5 * r) * hop;
        // Roll round the plate a little, like being shaken.
        const a = Math.atan2(z, x) + Math.PI / 2;
        const slide = 0.09 * Math.sin(Math.PI * band(e, 0.1 + d, 1.4 + d)) * spin;
        const dir = [Math.cos(a), 0, Math.sin(a)];
        out.parts[name] = {
          offset: [dir[0] * slide, Math.max(0, h) + 0.01 * settle, dir[2] * slide],
          quat: quatMul(
            quatAxisAngle([dir[2], 0, -dir[0]], (-slide / r) * 1.2),
            quatAxisAngle([1, 0, 0], 0.25 * hop * ((i % 2) * 2 - 1)),
          ),
        };
      });
    },
  },

  // Rings of the fractal turn opposite ways in bands, then lock back.
  mandeltorus: {
    parts: [],
    fx: [
      {
        name: "bands",
        select: "all",
        origin: [0, 0, 0],
        move: { bands: [0, 0, 1], width: 0.19, by: "radius" },
        color: { glow: "#5fe0ff" },
      },
    ],
    controls: [pulse("spin", "Spin", 3)],
    action: { key: "spin", label: "Counter-spin" },
    drive(t, c, out) {
      const e = since(c, "spin", 3);
      if (e < 0) return;
      const turn = ease(band(e, 0.05, 1.3)) * (1 - ease(band(e, 1.6, 2.9)));
      out.fx.bands = { move: 1.05 * turn, color: 0.12 * bump(e, 0, 2.9) };
    },
  },

  // The basket gives a shake and the biggest shells (urchins, sand dollars,
  // starfish, a scallop) bounce up one after another, spinning, and drop
  // back into place. The blurry fringe the capture left under the basket
  // is hidden.
  basket: {
    parts: [
      {
        name: "fringe",
        pivot: [0, -0.5, 0],
        regions: [{ at: [0, -0.54, 0], r: [1.5, 0.46, 1.5] }],
      },
      ...SHELLS.map(([name, x, z, r]) => ({
        name,
        pivot: [x, 0.07, z],
        regions: [{ at: [x, 0.07, z], r: [r, 0.1, r] }],
      })),
    ],
    controls: [pulse("shake", "Shake", 2.6)],
    action: { key: "shake", label: "Shake" },
    drive(t, c, out) {
      out.parts.fringe = { visible: 0 };
      const e = since(c, "shake", 2.6);
      if (e < 0) return;
      const shake = Math.sin(e * 26) * Math.exp(-e * 4) * band(e, 0, 0.05);
      out.body = {
        offset: [0.04 * shake, 0, 0],
        quat: quatAxisAngle([0, 1, 0], 0.05 * shake),
      };
      SHELLS.forEach(([name, x, z], i) => {
        // A wave round the basket: each shell hops in turn.
        const d = 0.15 + 0.12 * ((Math.atan2(z, x) / TAU + 0.5) * SHELLS.length);
        const hop = band(e, d, d + 0.55);
        const up = hop > 0 && hop < 1 ? Math.sin(Math.PI * hop) : 0;
        const land = spring(e - d - 0.55, 8, 26) * band(e, d + 0.55, d + 0.6);
        out.parts[name] = {
          offset: [0, 0.2 * up + 0.012 * land, 0],
          quat: quatMul(
            quatAxisAngle([0, 1, 0], (i % 2 ? 1 : -1) * 1.2 * ease(hop)),
            quatAxisAngle([1, 0, 0], 0.3 * up * (i % 3 ? 1 : -1)),
          ),
        };
      });
    },
  },

  // The lantern lights with a warm glow and the gnome gives a little hop.
  "garden-gnome": {
    parts: [
      {
        name: "lantern",
        pivot: [-0.34, 0.02, 0.26],
        axis: [0, 0, 1],
        regions: [{ at: [-0.34, -0.12, 0.26], r: [0.18, 0.2, 0.18], soft: 0.3 }],
      },
    ],
    addon: {
      count: 4000,
      build(k) {
        const part = k.part("flame", { pivot: [-0.34, -0.16, 0.27] });
        const glow = k.part("glow", { pivot: [-0.34, -0.1, 0.27] });
        flameAt(k, [-0.34, -0.17, 0.27], { h: 0.07, r: 0.022, share: 0.7, part, glowPart: glow });
      },
    },
    controls: [pulse("light", "Light", 3.2)],
    action: { key: "light", label: "Light lantern" },
    drive(t, c, out) {
      const e = since(c, "light", 3.2);
      const lit = env(e, 0.4, 0.6, 2.6, 3.2);
      out.addon = { parts: { flame: { visible: lit }, glow: { visible: lit } } };
      if (e < 0) return;
      const hop = bump(e, 0.05, 0.4);
      out.body = { offset: [0, 0.08 * hop, 0], squash: 0.05 * bump(e, 0, 0.06) + 0.04 * bump(e, 0.4, 0.5) }; // prettier-ignore
      out.parts.lantern = { tint: "#ffb040", glow: 0.45 * lit, bright: 0.6 * lit, angle: 0.15 * spring(e - 0.35, 4, 12) * band(e, 0.35, 0.4) }; // prettier-ignore
    },
  },

  // The trunk is one solid carved piece pinned where it meets the face (a
  // hard cut, like a wooden toy's jointed trunk): it swings up and forward to
  // trumpet with a few toots, and the elephant rocks on its feet.
  "wooden-elephant": {
    parts: [
      {
        name: "trunk",
        pivot: TRUNK.base,
        axis: [0, 0, 1],
        regions: [
          { at: [-0.88, 0.68, 0.43], r: [0.13, 0.17, 0.14] },
          { at: [-0.86, 0.83, 0.4], r: [0.11, 0.08, 0.13] },
          { at: [-0.72, 0.85, 0.33], r: [0.1, 0.07, 0.12] },
          { at: [-0.61, 0.84, 0.19], r: [0.07, 0.07, 0.1] },
        ],
      },
    ],
    controls: [pulse("trumpet", "Trumpet", 2.6)],
    action: { key: "trumpet", label: "Trumpet" },
    drive(t, c, out) {
      const e = since(c, "trumpet", 2.6);
      if (e < 0) return;
      const up = env(e, 0.05, 0.4, 1.4, 2.0);
      const toot = 0.06 * Math.sin(e * 28) * env(e, 0.35, 0.45, 1.1, 1.3);
      out.parts.trunk = { angle: 0.38 * up + toot };
      // Rocks forward and back on its feet (about the front and back feet in turn).
      const rock = 0.13 * Math.sin(e * 7) * Math.exp(-e * 1.3) * band(e, 0, 0.1);
      const pivot = rock > 0 ? [-0.6, -0.85, 0] : [0.6, -0.85, 0];
      const q = quatAxisAngle([0, 0, 1], rock);
      const moved = quatRotate(q, pivot);
      out.body = { quat: q, offset: [pivot[0] - moved[0], pivot[1] - moved[1], 0] };
    },
  },

  // The head turns to look at you and a speech bubble says a Latin hello.
  "marble-bust": {
    parts: [
      {
        // Cut straight across the neck (hard edge): the head turns on it
        // like a real neck, so nothing bends.
        name: "head",
        pivot: BUST.head,
        axis: [0, 1, 0],
        regions: [{ at: [-0.08, 0.6, 0.12], r: [0.75, 0.62, 0.8] }],
      },
      {
        // The lower lip and chin, hinged below the ear.
        name: "jaw",
        pivot: BUST.jaw,
        axis: [1, 0, 0],
        regions: [{ at: [-0.16, 0.15, 0.44], r: [0.1, 0.07, 0.09], over: true }],
      },
    ],
    addon: {
      count: 12000,
      build(k) {
        const at = [0.8, 0.86, 0.42];
        const part = k.part("bubble", { pivot: [0.42, 0.52, 0.38] });
        // The dark inside of the mouth, behind the lips (seen when the jaw drops).
        const mouth = k.part("mouth", { pivot: BUST.head });
        k.cloud({ share: 0.08, part: mouth, pattern: false }, (rand) => {
          const d = [rand() * 2 - 1, rand() * 2 - 1, rand() * 2 - 1];
          if (d[0] * d[0] + d[1] * d[1] + d[2] * d[2] > 1) return null;
          return {
            p: [-0.16 + d[0] * 0.085, 0.205 + d[1] * 0.035, 0.425 + d[2] * 0.04],
            color: mix("#2a1d18", "#4a2c26", rand()),
            size: 1.2,
            opacity: 1,
          };
        });
        const lines = ["SALVE,", "AMICE!"];
        const W = 0.5;
        const H = 0.3;
        panel(k, at, VIEW, W, H, 0.85, part, (u, v) => {
          // A rounded box with a dark rim and two lines of text.
          const x = (u - 0.5) * W;
          const y = (0.5 - v) * H;
          const rr = 0.08;
          const qx = Math.max(Math.abs(x) - (W / 2 - rr), 0);
          const qy = Math.max(Math.abs(y) - (H / 2 - rr), 0);
          const d = Math.hypot(qx, qy) - rr;
          if (d > 0) return null;
          if (d > -0.012) return "#5d5750";
          const px = 0.0115;
          const s = (x + 18 * px) / px;
          const t = (H / 2 - y - 0.05) / px;
          return inked(lines, s, t) ? "#2c2620" : "#fbf8f0";
        });
        // The tail points at the mouth.
        panel(
          k,
          add(at, [-0.21, -0.19, -0.1]),
          VIEW,
          0.12,
          0.12,
          0.05,
          part,
          (u, v) =>
          u > 1 - v * 0.9 && u < 1 - v * 0.3 ? (u > 1 - v * 0.9 + 0.08 ? "#fbf8f0" : "#5d5750") : null, // prettier-ignore
        );
      },
    },
    controls: [pulse("speak", "Speak", 3.4)],
    action: { key: "speak", label: "Speak" },
    drive(t, c, out) {
      const e = since(c, "speak", 3.4);
      const say = env(e, 0.55, 0.8, 2.7, 3.0);
      const turn = e < 0 ? 0 : env(e, 0, 0.55, 2.6, 3.3);
      const qh = quatMul(quatAxisAngle([0, 1, 0], 0.4 * turn), quatAxisAngle([1, 0, 0], 0.04 * turn)); // prettier-ignore
      // SAL-VE, A-MI-CE: the jaw drops once per syllable, with the murmur.
      let open = 0;
      for (const s of BUST.syllables)
        open = Math.max(open, Math.sin(Math.PI * band(e, s, s + 0.17)));
      out.addon = {
        parts: { bubble: { scale: say }, mouth: { quat: qh, visible: e < 0 ? 0 : 1 } },
      };
      if (e < 0) return;
      out.parts.head = { quat: qh };
      out.parts.jaw = chain(qh, BUST.head, quatAxisAngle([1, 0, 0], 0.13 * open), BUST.jaw);
    },
  },

  // Played like a real ukulele: a pick sweeps across the four strings on each
  // strum (down, down, up, down, like the sound) and the strings shake in a
  // standing wave between the nut and the bridge, then ring down.
  ukulele: {
    parts: [],
    keys: [{ color: "#b9b8b2", tol: 0.2, at: [0, -0.07, 0.09], r: 0.72 }],
    fx: [
      {
        name: "strings",
        select: "key0",
        origin: UKE.bridge,
        mask: { half: [0, 0, 1], at: 0.0 },
        move: { vibrate: [1, 0, 0], freq: 70, along: [0, 1, 0], length: UKE.length },
        color: { glow: "#fff4d6" },
      },
    ],
    addon: {
      count: 2500,
      build(k) {
        // A tortoiseshell pick: a rounded triangle, held flat over the strings.
        const part = k.part("pick", { pivot: UKE.pickAt });
        k.cloud({ share: 1, part, pattern: false }, (rand) => {
          const u = rand();
          const v = rand() * (1 - u);
          const x = (u - v) * 0.05;
          const y = 0.045 - (u + v) * 0.075;
          if (Math.hypot(x, y - 0.012) > 0.05) return null;
          return {
            p: add(UKE.pickAt, [x, y, 0.035]),
            n: [0, 0, 1],
            color: mix("#7a3a14", "#d08a3c", 0.5 + 0.5 * Math.sin(x * 90 + y * 60)),
            size: 0.7,
            opacity: 0.98,
          };
        });
      },
    },
    controls: [pulse("strum", "Strum", 2.2)],
    action: { key: "strum", label: "Strum" },
    drive(t, c, out, info) {
      const e = since(c, "strum", 2.2);
      // The pick rests beside the strings, then sweeps across them.
      let x = 0.12;
      let a = 0;
      UKE.strums.forEach(([s, dir]) => {
        const f = band(e, s - 0.05, s + 0.04);
        if (e >= s - 0.05) x = dir > 0 ? -0.12 + 0.24 * f : 0.12 - 0.24 * f;
        if (e >= s) a = Math.max(a, Math.exp(-(e - s) * 2.8));
      });
      const shown = env(e, -0.2, 0.0, 1.3, 1.6);
      out.addon = { parts: { pick: { offset: [x, 0, 0], visible: shown } } };
      if (e < 0) return;
      out.fx.strings = { move: 0.016 * a, color: 0.5 * a };
      out.body = { quat: quatAxisAngle([0, 0, 1], 0.02 * a * Math.sin(e * 9)) };
    },
  },

  // The second hand ticks all the time; a tap makes it ring and rattle.
  "alarm-clock": {
    alive: true,
    parts: [
      {
        name: "second",
        pivot: [0, -0.18, 0.4],
        axis: [0, 0, -1],
        regions: [{ at: [0, -0.18, 0.4], r: [0.66, 0.66, 0.3], soft: 0.05, color: "#d84a34", tol: 0.45 }], // prettier-ignore
      },
      {
        name: "bells",
        pivot: [0, 0.62, 0],
        axis: [0, 0, 1],
        regions: [
          { at: [-0.42, 0.62, 0], r: [0.22, 0.14, 0.24], soft: 0.3 },
          { at: [0.42, 0.62, 0], r: [0.22, 0.14, 0.24], soft: 0.3 },
        ],
      },
    ],
    controls: [pulse("ring", "Ring", 2.4)],
    action: { key: "ring", label: "Ring" },
    drive(t, c, out, info) {
      // One tick a second with a little overshoot.
      const s = Math.floor(t);
      const f = t - s;
      const tick = s + 1 - Math.exp(-f * 30) * Math.cos(f * 40);
      out.parts.second = { angle: (tick / 60) * TAU };
      const e = since(c, "ring", 2.4);
      if (e < 0) return;
      const ring = env(e, 0, 0.05, 1.8, 2.3);
      const buzz = Math.sin(info.time * TAU * 17);
      out.parts.bells = { angle: 0.05 * ring * buzz, offset: [0, 0.01 * ring * Math.abs(buzz), 0] };
      // Rattles across the table in little hops.
      const hop = Math.abs(Math.sin(e * 22)) * ring;
      out.body = {
        offset: [0.09 * ring * Math.sin(e * 3), 0.07 * hop, 0],
        quat: quatAxisAngle([0, 0, 1], 0.08 * ring * Math.sin(e * 29)),
      };
    },
  },

  // A flash bursts from the camera and the view whites out for a moment.
  "vintage-camera": {
    parts: [],
    fx: [{ name: "flash", select: "all", color: { glow: "#ffffff" } }],
    addon: {
      count: 5000,
      build(k) {
        const at = [-0.12, 0.2, 0.12];
        const part = k.part("burst", { pivot: at });
        k.cloud({ share: 0.7, part, pattern: false }, (rand) => {
          // Rays and a bright core.
          const ray = Math.floor(rand() * 10);
          const a = (ray / 10) * TAU + 0.2;
          const t = Math.pow(rand(), 1.6);
          const len = 0.6 * (ray % 2 ? 0.65 : 1);
          const dir = unit([Math.cos(a), Math.sin(a), 0.35]);
          const core = rand() < 0.3;
          const p = core ? add(at, mul([rand() - 0.5, rand() - 0.5, rand() - 0.5], 0.08)) : add(at, mul(dir, t * len)); // prettier-ignore
          return {
            p,
            color: core ? "#ffffff" : mix("#ffffff", "#bfe6ff", t),
            size: core ? 3 : 1.6 * (1 - t) + 0.4,
            opacity: core ? 0.6 : 0.8 * (1 - t),
          };
        });
      },
    },
    controls: [pulse("snap", "Snap", 1.6)],
    action: { key: "snap", label: "Take a photo" },
    drive(t, c, out) {
      const e = since(c, "snap", 1.6);
      const burst = e < 0 ? 0 : band(e, 0.08, 0.12) * (1 - band(e, 0.12, 0.6));
      out.addon = { parts: { burst: { scale: burst > 0 ? 0.5 + burst : 0, visible: burst } } };
      if (e < 0) return;
      out.fx.flash = { color: 1.4 * band(e, 0.08, 0.1) * Math.exp(-Math.max(0, e - 0.1) * 5) };
      out.body = { squash: 0.03 * bump(e, 0, 0.1) };
    },
  },

  // The speakers pump to the beat and the tape reels turn.
  boombox: {
    parts: [
      {
        name: "left",
        pivot: [-0.62, -0.08, 0.18],
        axis: [0, 0, 1],
        regions: [{ at: [-0.62, -0.08, 0.1], r: [0.24, 0.24, 0.2], soft: 0.3 }],
      },
      {
        name: "right",
        pivot: [0.62, -0.08, 0.18],
        axis: [0, 0, 1],
        regions: [{ at: [0.62, -0.08, 0.1], r: [0.24, 0.24, 0.2], soft: 0.3 }],
      },
      {
        name: "reelA",
        pivot: [0.15, -0.09, 0.18],
        axis: [0, 0, 1],
        regions: [{ at: [0.15, -0.09, 0.17], r: [0.045, 0.045, 0.06], soft: 0.3 }],
      },
      {
        name: "reelB",
        pivot: [0.29, -0.09, 0.18],
        axis: [0, 0, 1],
        regions: [{ at: [0.29, -0.09, 0.17], r: [0.045, 0.045, 0.06], soft: 0.3 }],
      },
    ],
    controls: [pulse("play", "Play", 2.6)],
    action: { key: "play", label: "Play" },
    drive(t, c, out) {
      const e = since(c, "play", 2.6);
      if (e < 0) return;
      // The same pattern as the sound: kicks on steps 0, 2, 3 and 6 of 8 (0.15 s).
      let k = 0;
      for (let r = 0; r < 2; r++) {
        for (const s of [0, 2, 3, 6]) {
          const at = (r * 8 + s) * 0.15;
          if (e >= at) k = Math.max(k, Math.exp(-(e - at) * 14));
        }
      }
      const on = 1 - band(e, 2.3, 2.6);
      const pump = { offset: [0, 0, 0.06 * k * on], scale: 1 + 0.12 * k * on, tint: "#4a7dff", glow: 0.35 * k * on }; // prettier-ignore
      out.parts.left = pump;
      out.parts.right = pump;
      const reel = -e * 5 * on;
      out.parts.reelA = { angle: reel };
      out.parts.reelB = { angle: reel };
      out.body = { squash: 0.012 * k * on };
    },
  },

  // Tears in half and a puff of steam comes out.
  "croissant-real": {
    parts: [
      {
        name: "left",
        pivot: [0, -0.3, 0],
        axis: [0, 0, 1],
        regions: [{ at: [-0.55, 0, 0], r: [0.58, 0.45, 0.45], soft: 0.12 }],
      },
      {
        name: "right",
        pivot: [0, -0.3, 0],
        axis: [0, 0, 1],
        regions: [{ at: [0.55, 0, 0], r: [0.58, 0.45, 0.45], soft: 0.12 }],
      },
    ],
    addon: {
      count: 9000,
      build(k) {
        // The soft, layered inside of each half.
        const face = (sign, part) =>
          k.cloud({ share: 0.35, part, pattern: false }, (rand) => {
            const a = rand() * TAU;
            const r = Math.sqrt(rand());
            const y = -0.02 + Math.sin(a) * 0.26 * r;
            const z = -0.02 + Math.cos(a) * 0.28 * r;
            const spiral = Math.sin(r * 22 + a * 1.0);
            const edge = r > 0.9;
            return {
              p: [sign * 0.004, y, z],
              n: [sign, 0, 0],
              color: edge ? "#b8712c" : mix("#f4dba6", "#d9a45a", 0.5 + 0.5 * spiral),
              size: 1.1,
              opacity: 0.97,
            };
          });
        face(-1, k.part("left", { pivot: [0, -0.3, 0], axis: [0, 0, 1] }));
        face(1, k.part("right", { pivot: [0, -0.3, 0], axis: [0, 0, 1] }));
        const steam = k.part("steam", { pivot: [0, 0.2, 0] });
        k.cloud({ share: 0.08, part: steam, pattern: false }, (rand) => ({
          p: [(rand() - 0.5) * 0.1, 0.02 + rand() * 0.08, (rand() - 0.5) * 0.3],
          color: "#f4f1ea",
          size: 2 + 2.5 * rand(),
          opacity: 0.07,
          kind: "rise",
          params: [0.55 + 0.3 * rand(), rand()],
        }));
      },
    },
    controls: [pulse("tear", "Tear", 3)],
    action: { key: "tear", label: "Tear" },
    drive(t, c, out) {
      const e = since(c, "tear", 3);
      const open = env(e, 0.05, 0.45, 2.1, 2.9);
      out.addon = {
        parts: {
          left: { angle: 0.3 * open, offset: [-0.2 * open, 0, 0], visible: open > 0.02 ? 1 : 0 },
          right: { angle: -0.3 * open, offset: [0.2 * open, 0, 0], visible: open > 0.02 ? 1 : 0 },
          steam: { visible: env(e, 0.3, 0.6, 1.8, 2.6) },
        },
      };
      if (e < 0) return;
      out.parts.left = { angle: 0.3 * open, offset: [-0.2 * open, 0, 0] };
      out.parts.right = { angle: -0.3 * open, offset: [0.2 * open, 0, 0] };
    },
  },

  // A slice cuts out and lifts away, showing the layers inside.
  "carrot-cake": {
    parts: [],
    fx: [
      {
        name: "slice",
        select: "all",
        origin: [0, 0, 0],
        mask: { wedge: [0, 1, 0], toward: VIEW, angle: 0.34 },
        move: { along: SLICE_DIR },
      },
    ],
    addon: {
      count: 12000,
      build(k) {
        const slice = k.part("slice");
        const gap = k.part("gap");
        const base = Math.atan2(VIEW[0], VIEW[2]);
        const crumb = (rand, y) => {
          if (y > 0.27) return mix("#f6ecd6", "#e9dcc0", rand());
          if (y > 0.235) return "#e4cfa6";
          const fleck = rand();
          if (fleck < 0.05) return "#b85a20";
          if (fleck < 0.1) return "#4a2f18";
          return mix("#6e4326", "#8a5530", rand());
        };
        const face = (a, part) =>
          k.cloud({ share: 0.25, part, pattern: false }, (rand) => {
            const y = -0.35 + rand() * 0.69;
            const rOut = 0.9 - 0.12 * band(y, -0.2, 0.34);
            const r = 0.31 + rand() * (rOut - 0.31);
            const d = [Math.sin(a), 0, Math.cos(a)];
            return {
              p: [d[0] * r, y, d[2] * r],
              n: [Math.cos(a), 0, -Math.sin(a)],
              color: crumb(rand, y),
              size: 1.5,
              opacity: 0.98,
            };
          });
        face(base - 0.33, slice);
        face(base + 0.33, slice);
        face(base - 0.335, gap);
        face(base + 0.335, gap);
      },
    },
    controls: [pulse("slice", "Slice", 3.2)],
    action: { key: "slice", label: "Cut a slice" },
    drive(t, c, out) {
      const e = since(c, "slice", 3.2);
      const cut = env(e, 0.25, 0.9, 2.2, 3.0);
      const shown = e >= 0.2 && e < 3.0 ? 1 : 0;
      out.addon = { parts: { slice: { offset: mul(SLICE_DIR, 0.5 * cut), visible: shown }, gap: { visible: shown } } }; // prettier-ignore
      if (e < 0) return;
      out.fx.slice = { move: 0.5 * cut };
    },
  },

  // Splits open to show glowing red seeds that spill a little.
  pomegranate: {
    parts: [
      {
        name: "left",
        pivot: [0, -0.82, 0],
        axis: [0, 0, 1],
        regions: [{ at: [-0.5, 0, 0], r: [0.52, 1.0, 1.0], soft: 0.1 }],
      },
      {
        name: "right",
        pivot: [0, -0.82, 0],
        axis: [0, 0, 1],
        regions: [{ at: [0.5, 0, 0], r: [0.52, 1.0, 1.0], soft: 0.1 }],
      },
    ],
    addon: {
      count: 14000,
      build(k) {
        // Seeds packed on each cut face, with pale pith between them.
        const seeds = [];
        for (let i = 0; i < 150; i++) {
          const a = i * 2.39996;
          const r = 0.76 * Math.sqrt((i + 0.5) / 150);
          seeds.push([Math.sin(a) * r, Math.cos(a) * r]);
        }
        const face = (sign, part) =>
          k.cloud({ share: 0.4, part, pattern: false }, (rand) => {
            const a = rand() * TAU;
            const r = 0.8 * Math.sqrt(rand());
            const y = Math.sin(a) * r;
            const z = Math.cos(a) * r;
            let best = 9;
            for (const s of seeds) best = Math.min(best, Math.hypot(s[0] - y, s[1] - z));
            const inSeed = best < 0.045;
            const col = inSeed
              ? mix("#ff3552", "#8e0a1e", best / 0.045)
              : r > 0.74
                ? "#b01e2a"
                : "#f1dcaa";
            return {
              p: [sign * (inSeed ? 0.012 * (1 - best / 0.045) : 0), y - 0.02, z],
              n: [sign, 0, 0],
              color: col,
              size: 1.1,
              opacity: 0.98,
            };
          });
        face(-1, k.part("left", { pivot: [0, -0.82, 0], axis: [0, 0, 1] }));
        face(1, k.part("right", { pivot: [0, -0.82, 0], axis: [0, 0, 1] }));
        // A few seeds that tumble out.
        const spill = k.part("spill", { pivot: [0, -0.2, 0] });
        k.cloud({ share: 0.2, part: spill, pattern: false }, (rand) => {
          const s = Math.floor(rand() * 14);
          const c = [((s * 37) % 14) / 14 - 0.5, -0.2 + ((s * 5) % 7) * 0.05, ((s * 11) % 13) / 13 - 0.5]; // prettier-ignore
          const d = unit([rand() - 0.5, rand() - 0.5, rand() - 0.5]);
          return {
            p: add([c[0] * 0.3, c[1], c[2] * 0.6], mul(d, 0.04)),
            n: d,
            color: mix("#ff4a60", "#a0102a", rand() * 0.6),
            size: 1.3,
            opacity: 0.98,
          };
        });
      },
    },
    controls: [pulse("split", "Split", 3.4)],
    action: { key: "split", label: "Split open" },
    drive(t, c, out) {
      const e = since(c, "split", 3.4);
      const open = env(e, 0.05, 0.5, 2.4, 3.3);
      const vis = open > 0.02 ? 1 : 0;
      const fall = band(e, 0.4, 1.1);
      out.addon = {
        parts: {
          left: { angle: 0.5 * open, visible: vis },
          right: { angle: -0.5 * open, visible: vis },
          spill: { offset: [0, -0.55 * fall * fall, 0.15 * fall], visible: env(e, 0.35, 0.45, 2.2, 2.6) }, // prettier-ignore
        },
        glow: [1, 0.2, 0.3, 0.6 * open],
      };
      if (e < 0) return;
      out.parts.left = { angle: 0.5 * open };
      out.parts.right = { angle: -0.5 * open };
    },
  },

  // A flame lights inside with a warm glow and flicker; tap again to put it out.
  lantern: {
    alive: (c) => c.lit > 0,
    parts: [
      {
        name: "glass",
        pivot: [0, -0.2, 0],
        axis: [0, 1, 0],
        regions: [{ at: [0, -0.15, 0], r: [0.3, 0.3, 0.3], soft: 0.5 }],
      },
    ],
    addon: {
      count: 5000,
      build(k) {
        const part = k.part("flame", { pivot: [0, -0.33, 0] });
        const glow = k.part("glow", { pivot: [0, -0.2, 0] });
        flameAt(k, [0, -0.33, 0], { h: 0.2, r: 0.04, share: 0.75, part, glowPart: glow });
      },
    },
    controls: [{ key: "lit", label: "Lit", type: "toggle", ease: 0.6 }],
    action: { key: "lit", label: "Light" },
    drive(t, c, out) {
      const lit = c.lit ?? 0;
      const flicker = 1 + 0.12 * Math.sin(t * 13) * Math.sin(t * 7.3 + 1);
      out.addon = { parts: { flame: { visible: lit, scale: 0.4 + 0.6 * lit }, glow: { visible: lit } } }; // prettier-ignore
      out.parts.glass = { tint: "#ffa640", glow: 0.35 * lit * flicker, bright: 0.25 * lit };
    },
  },

  // The head turns on its neck (a hard cut, hidden under a red collar with a
  // bell, so nothing bends), looks at you, and the tip of the tail swishes
  // along the ground.
  "cat-statue": {
    parts: [
      {
        name: "head",
        pivot: CAT.neck,
        axis: [0, 1, 0],
        regions: [{ at: [0.08, 0.81, 0.52], r: [0.52, 0.47, 0.52] }],
      },
      {
        name: "tail",
        pivot: CAT.tailJoint,
        axis: [0, 1, 0],
        regions: [{ at: [0.42, -0.84, 0.36], r: [0.16, 0.12, 0.24] }],
      },
    ],
    addon: {
      count: 5000,
      build(k) {
        // The collar sits on the cut, tilted like the neck.
        const collar = k.part("collar", { pivot: CAT.neck });
        const q = [0, 0, 0, 1];
        k.cloud({ share: 0.8, part: collar, pattern: false }, (rand) => {
          const a = rand() * TAU;
          const band = (rand() - 0.5) * 0.045;
          const ring = [Math.cos(a) * CAT.collarR[0], band, Math.sin(a) * CAT.collarR[1]];
          const n = unit([Math.cos(a), 0, Math.sin(a)]);
          return {
            p: add(CAT.collarAt, quatRotate(q, ring)),
            n: quatRotate(q, n),
            color: Math.abs(band) > 0.018 ? "#6e1414" : mix("#b0201e", "#d33a2c", rand() * 0.5),
            size: 0.8,
            opacity: 1,
          };
        });
        // A little brass bell at the front.
        k.cloud({ share: 0.2, part: collar, pattern: false }, (rand) => {
          const d = unit([rand() - 0.5, rand() - 0.5, rand() - 0.5]);
          const shade = 0.55 + 0.45 * Math.max(0, d[1] * 0.6 + d[2] * 0.5);
          return {
            p: add(CAT.bellAt, mul(d, 0.042)),
            n: d,
            color: mix("#6b4a12", "#f3cf5a", shade),
            size: 0.7,
            opacity: 1,
          };
        });
      },
    },
    controls: [pulse("look", "Look", 2.6)],
    action: { key: "look", label: "Look around" },
    drive(t, c, out) {
      const e = since(c, "look", 2.6);
      const turn = e < 0 ? 0 : env(e, 0.05, 0.6, 1.7, 2.4);
      const nod = e < 0 ? 0 : 0.08 * Math.sin(Math.PI * band(e, 0.6, 1.2));
      const qh = quatMul(quatAxisAngle(CAT.neckAxis, 0.42 * turn), quatAxisAngle([1, 0, 0], nod));
      // The collar turns with the head; the bell swings a little.
      out.addon = { parts: { collar: { quat: qh } } };
      if (e < 0) return;
      out.parts.head = { quat: qh };
      const swish =
        Math.sin(Math.PI * band(e, 0.4, 0.9)) - 0.7 * Math.sin(Math.PI * band(e, 0.9, 1.5));
      out.parts.tail = { angle: 0.4 * swish };
    },
  },

  // Squeezed flat, then it springs back with a wobble (a whole-toy effect:
  // no parts, just out.body).
  "rubber-duck-real": {
    parts: [],
    controls: [{ key: "squeeze", label: "Squeeze", type: "pulse", ease: 1.4 }],
    action: { key: "squeeze", label: "Squeeze" },
    drive(t, c, out) {
      if (!(c.squeeze > 0)) return;
      const e = (1 - c.squeeze) * 1.4;
      const press = Math.sin((Math.PI / 2) * band(e, 0, 0.14));
      const spring = e < 0.3 ? 0 : Math.exp(-(e - 0.3) * 5) * Math.cos((e - 0.3) * 22);
      out.body = { squash: e < 0.3 ? 0.42 * press : 0.42 * spring };
    },
  },

  // Until Phase F plays a real game: the pieces bob in a wave across the board.
  "chess-set": {
    parts: [],
    fx: [
      {
        name: "wave",
        select: "all",
        origin: [0, 0, 0],
        mask: { half: [0, 1, 0], at: -0.05 },
        move: { hop: [0, 1, 0], cell: 0.19 },
        pattern: { stagger: 0.8, cell: 0.19 },
      },
    ],
    controls: [pulse("wave", "Wave", 2.2)],
    action: { key: "wave", label: "Wave" },
    drive(t, c, out) {
      const e = since(c, "wave", 2.2);
      if (e < 0) return;
      out.fx.wave = { move: 0.12, phase: band(e, 0, 2.1) };
    },
  },

  // The whole horse (everything above the base, one solid piece) rears
  // higher about its hind hooves, the way a horse rears from its hind legs,
  // while the lower forelegs paw the air from the knees (hard cuts).
  "horse-statue": {
    parts: [
      {
        name: "horse",
        pivot: HORSE.hooves,
        axis: [0, 0, 1],
        regions: [{ at: [0, 0.45, 0], r: [3, 1.18, 3] }],
      },
      {
        name: "shinA",
        pivot: HORSE.kneeA,
        axis: [0, 0, 1],
        regions: [
          { at: [-0.62, 0.32, -0.09], r: 0.09, over: true },
          { at: [-0.72, 0.22, -0.09], r: 0.08, over: true },
          { at: [-0.79, 0.18, -0.09], r: 0.065, over: true },
        ],
      },
      {
        name: "shinB",
        pivot: HORSE.kneeB,
        axis: [0, 0, 1],
        regions: [
          { at: [-0.56, 0.2, 0.19], r: 0.09, over: true },
          { at: [-0.6, 0.04, 0.19], r: 0.08, over: true },
          { at: [-0.62, -0.03, 0.19], r: 0.065, over: true },
        ],
      },
    ],
    controls: [pulse("rear", "Rear", 2.6)],
    action: { key: "rear", label: "Rear up" },
    drive(t, c, out) {
      const e = since(c, "rear", 2.6);
      if (e < 0) return;
      const up = env(e, 0.05, 0.55, 1.5, 2.3);
      const qh = quatAxisAngle([0, 0, 1], -0.13 * up);
      out.parts.horse = { quat: qh };
      // The forelegs paw in turn, riding on the rearing body.
      const pawA = 0.35 * up * Math.sin(e * 9);
      const pawB = 0.35 * up * Math.sin(e * 9 + 2);
      out.parts.shinA = chain(qh, HORSE.hooves, quatAxisAngle([0, 0, 1], pawA), HORSE.kneeA);
      out.parts.shinB = chain(qh, HORSE.hooves, quatAxisAngle([0, 0, 1], pawB), HORSE.kneeB);
    },
  },

  // ---- Shelf shapes (procedural) ------------------------------------------------------

  // Splits into three little blobs that wobble and merge back.
  blob: {
    parts: [],
    fx: [
      {
        name: "split",
        select: "all",
        origin: [0, 0, 0],
        move: { split: [0, 1, 0], n: 3, spread: 0.62 },
      },
    ],
    controls: [pulse("split", "Split", 2.8)],
    action: { key: "split", label: "Split" },
    drive(t, c, out) {
      const e = since(c, "split", 2.8);
      if (e < 0) return;
      const apart = ease(band(e, 0.05, 0.55)) * (1 - ease(band(e, 1.5, 2.1)));
      out.fx.split = { move: apart + 0.06 * apart * Math.sin(e * 16) };
      out.body = { squash: 0.12 * spring(e - 2.1, 4, 16) * band(e, 2.05, 2.15) };
    },
  },

  // The donut snaps into chunks (the dough shows inside) that fly apart and
  // tumble, the sprinkles spray off, then it all flies back together.
  donut: {
    parts: [],
    keys: [{ long: 0.42 }],
    fx: [
      {
        name: "chunks",
        select: "all",
        origin: [0, 0, 0],
        move: { fall: [0, -1, 0], cell: 0.34, voronoi: true, pop: 0.75, spin: 1.6 },
        pattern: { ramp: 0.3 },
      },
      {
        name: "spray",
        select: "key0",
        origin: [0, 0, 0],
        move: { hop: [0, 1, 0] },
        pattern: { stagger: 0.6 },
      },
    ],
    controls: [pulse("snap", "Snap", 2.8)],
    action: { key: "snap", label: "Break apart" },
    drive(t, c, out) {
      const e = since(c, "snap", 2.8);
      if (e < 0) return;
      const phase = e < 1.6 ? band(e, 0.02, 0.8) : 1 - ease(band(e, 1.6, 2.5));
      out.fx.chunks = { move: 0.7, phase };
      out.fx.spray = { move: 0.45, phase: band(e, 0.02, 1.4) };
      out.body = { squash: 0.06 * bump(e, 0, 0.1) };
    },
  },

  // The knot contorts: waves of swelling loops run round it, lifting and
  // twisting the tube, then it settles back into its trefoil.
  knot: {
    parts: [
      {
        name: "knot",
        pivot: [0, 0, 0],
        axis: [0, 0, 1],
        regions: [{ at: [0, 0, 0], r: [2, 2, 2], soft: 0.01 }],
      },
    ],
    fx: [
      {
        name: "writhe",
        select: "all",
        origin: [0, 0, 0],
        move: { writhe: [0, 0, 1], k: 3, lift: 0.9 },
      },
      {
        name: "ripple",
        select: "all",
        origin: [0, 0, 0],
        move: { writhe: [0, 0, 1], k: 5, lift: -0.6 },
      },
      {
        name: "glow",
        select: "all",
        color: { glow: "#ff9df8" },
      },
    ],
    controls: [pulse("writhe", "Writhe", 3)],
    action: { key: "writhe", label: "Contort" },
    drive(t, c, out) {
      const e = since(c, "writhe", 3);
      if (e < 0) return;
      const on = env(e, 0.05, 0.5, 2.2, 2.9);
      out.fx.writhe = { move: 0.16 * on, phase: e * 7 };
      out.fx.ripple = { move: 0.05 * on, phase: -e * 11 };
      out.fx.glow = { color: 0.2 * on };
      out.parts.knot = { scale: 1 - 0.1 * on * (0.5 + 0.5 * Math.sin(e * 5)), angle: 0.25 * on * Math.sin(e * 3) }; // prettier-ignore
    },
  },

  // Clouds race round and a night band sweeps over it.
  planet: {
    parts: [],
    keys: [{ color: "#f4f6ff", tol: 0.2 }],
    fx: [
      {
        name: "clouds",
        select: "key0",
        origin: [0, 0, 0],
        move: { turn: [0, 1, 0] },
      },
      {
        name: "night",
        select: "all",
        origin: [0, 0, 0],
        pattern: { band: unit([1, 0, -0.3]), width: 0.38 },
        color: { darken: true },
      },
    ],
    controls: [pulse("spin", "Spin", 2.8)],
    action: { key: "spin", label: "Day and night" },
    drive(t, c, out) {
      const e = since(c, "spin", 2.8);
      if (e < 0) return;
      out.fx.clouds = { move: TAU * ease(band(e, 0, 2.6)) };
      out.fx.night = { color: 0.8, phase: -1.4 + 2.8 * band(e, 0.1, 2.5) };
    },
  },
};
