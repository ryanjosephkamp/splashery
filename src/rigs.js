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
const HORSE_BODY = [0.12, -0.62, 0];
const HORSE_LEGS = [-0.42, 0.28, 0];

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

  // The front legs rub together, then the wings flick.
  "cluster-fly": {
    parts: [
      {
        name: "legA",
        pivot: [0.45, -0.15, -0.1],
        axis: [1, 0, 0],
        regions: [{ at: [0.62, -0.42, -0.18], r: [0.3, 0.26, 0.2], soft: 0.45 }],
      },
      {
        name: "legB",
        pivot: [0.45, -0.15, 0.1],
        axis: [1, 0, 0],
        regions: [{ at: [0.62, -0.42, 0.18], r: [0.3, 0.26, 0.2], soft: 0.45 }],
      },
      {
        name: "wingA",
        pivot: [0.1, 0.25, -0.1],
        axis: [1, 0, 0],
        regions: [{ at: [-0.42, 0.4, -0.3], r: [0.52, 0.2, 0.28], soft: 0.3 }],
      },
      {
        name: "wingB",
        pivot: [0.1, 0.25, 0.1],
        axis: [1, 0, 0],
        regions: [{ at: [-0.42, 0.4, 0.3], r: [0.52, 0.2, 0.28], soft: 0.3 }],
      },
    ],
    controls: [pulse("groom", "Groom", 2.4)],
    action: { key: "groom", label: "Groom" },
    drive(t, c, out, info) {
      const e = since(c, "groom", 2.4);
      if (e < 0) return;
      const rub = env(e, 0, 0.15, 1.1, 1.3);
      const s = Math.sin(e * TAU * 6);
      out.parts.legA = { angle: -0.4 * rub, offset: [0.04 * s * rub, 0.05 * s * rub, 0.08 * rub] };
      out.parts.legB = { angle: 0.4 * rub, offset: [-0.04 * s * rub, -0.05 * s * rub, -0.08 * rub] }; // prettier-ignore
      const flick = bump(e, 1.3, 1.55) + 0.6 * bump(e, 1.6, 1.8);
      const blur = env(e, 1.3, 1.35, 1.9, 2.1) * Math.sin(info.time * TAU * 31) * 0.25;
      out.parts.wingA = { angle: 0.55 * flick + blur };
      out.parts.wingB = { angle: -0.55 * flick - blur };
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

  // The drupelets bounce one by one in a ripple from the top down.
  raspberry: {
    parts: [],
    fx: [
      {
        name: "ripple",
        select: "all",
        origin: [0, 0.02, 0],
        move: { push: true },
        pattern: { band: [0, -1, 0], width: 0.13 },
        color: { brighten: true },
      },
    ],
    controls: [pulse("ripple", "Ripple", 1.8)],
    action: { key: "ripple", label: "Ripple" },
    drive(t, c, out) {
      const e = since(c, "ripple", 1.8);
      if (e < 0) return;
      const s = band(e, 0, 1.5);
      out.fx.ripple = { move: 0.1 * (1 - 0.4 * s), color: 0.45, phase: -0.8 + 1.7 * s };
    },
  },

  // Light runs over the drupelets in a gleaming wave.
  blackberry: {
    parts: [],
    fx: [
      {
        name: "gleam",
        select: "all",
        origin: [0, 0, 0],
        pattern: { band: unit([1, 0.4, 0.5]), width: 0.18 },
        color: { brighten: true },
      },
      {
        name: "glint",
        select: "all",
        origin: [0, 0, 0],
        pattern: { band: unit([1, 0.4, 0.5]), width: 0.3 },
        color: { sparkle: 0.12 },
      },
    ],
    controls: [pulse("gleam", "Gleam", 1.8)],
    action: { key: "gleam", label: "Gleam" },
    drive(t, c, out) {
      const e = since(c, "gleam", 1.8);
      if (e < 0) return;
      const phase = -1.1 + 2.3 * band(e, 0, 1.6);
      out.fx.gleam = { color: 0.9, phase };
      out.fx.glint = { color: 3, phase };
    },
  },

  // The dusty bloom wipes off in a swirl, showing deep blue, then returns.
  blueberry: {
    parts: [],
    fx: [
      {
        name: "bloom",
        select: "all",
        origin: [0, 0, 0],
        pattern: { swirl: [0, 1, 0], width: 0.12, twist: 0.6 },
        color: { recolor: "#1a1f4a", keep: 0.25 },
      },
    ],
    controls: [pulse("polish", "Polish", 3.2)],
    action: { key: "polish", label: "Polish" },
    drive(t, c, out) {
      const e = since(c, "polish", 3.2);
      if (e < 0) return;
      const phase = 1.2 * ease(band(e, 0.05, 1.1)) * (1 - ease(band(e, 2.0, 3.1)));
      out.fx.bloom = { color: 0.8, phase };
      out.body = { quat: quatAxisAngle([0, 1, 0], 0.5 * ease(band(e, 0, 1.1)) * (1 - ease(band(e, 2, 3.1)))) }; // prettier-ignore
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

  // The tomatoes roll and jostle each other, then settle.
  tomatoes: {
    parts: [
      ["t0", [-0.27, 0.1, -0.55], 0.27],
      ["t1", [0.16, 0.04, -0.56], 0.21],
      ["t2", [-0.55, 0.0, -0.2], 0.18],
      ["t3", [-0.1, 0.05, -0.06], 0.22],
      ["t4", [0.13, -0.02, -0.22], 0.13],
      ["t5", [0.4, 0.04, -0.1], 0.21],
      ["t6", [-0.52, -0.02, 0.26], 0.15],
      ["t7", [-0.2, 0.04, 0.45], 0.21],
      ["t8", [0.3, 0.1, 0.45], 0.28],
      ["t9", [0.2, -0.07, 0.06], 0.09],
    ].map(([name, at, r]) => ({
      name,
      pivot: [at[0], at[1] - r * 0.8, at[2]],
      axis: [0, 0, 1],
      regions: [{ at, r: [r * 1.02, r * 1.1, r * 1.02], soft: 0.25 }],
    })),
    controls: [pulse("roll", "Roll", 2.6)],
    action: { key: "roll", label: "Roll" },
    drive(t, c, out, info) {
      const e = since(c, "roll", 2.6);
      if (e < 0) return;
      const push = 0.6 + 0.8 * vary(info.tap);
      for (let i = 0; i < 10; i++) {
        const d = i * 0.06;
        const s = env(e, 0.05 + d, 0.6 + d, 1.3 + d, 2.1 + d * 0.4);
        const a = (i * 2.4 + push * 3) % TAU;
        const dir = [Math.cos(a), 0, Math.sin(a)];
        const dist = 0.12 * s * (1 + (i % 3) * 0.3);
        const roll = dist / 0.2;
        out.parts[`t${i}`] = {
          offset: [dir[0] * dist, 0.05 * bump(e, 0.3 + d, 0.6 + d), dir[2] * dist],
          quat: quatAxisAngle(unit([dir[2], 0, -dir[0]]), -roll),
        };
      }
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

  // The shells hop inside the basket one after another.
  basket: {
    parts: [],
    keys: [{ color: "#e2dccd", tol: 0.4, at: [0, -0.3, 0], r: 0.86 }],
    fx: [
      {
        name: "hop",
        select: "key0",
        origin: [0, 0, 0],
        mask: { half: [0, 1, 0], at: -0.08 },
        move: { hop: [0, 1, 0], cell: 0.14 },
        pattern: { stagger: 0.85, cell: 0.14 },
      },
    ],
    controls: [pulse("hop", "Hop", 2)],
    action: { key: "hop", label: "Hop shells" },
    drive(t, c, out) {
      const e = since(c, "hop", 2);
      if (e < 0) return;
      out.fx.hop = { move: 0.26, phase: band(e, 0, 1.9) };
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

  // The trunk lifts and it rocks on its wooden feet.
  "wooden-elephant": {
    parts: [
      {
        name: "trunk",
        pivot: [-0.62, 0.55, 0.42],
        axis: [0, 0, 1],
        regions: [
          { at: [-0.8, 0.7, 0.46], r: [0.2, 0.2, 0.2], soft: 0.4 },
          { at: [-0.88, 0.48, 0.47], r: [0.12, 0.2, 0.16], soft: 0.4 },
        ],
      },
    ],
    controls: [pulse("trumpet", "Trumpet", 2.6)],
    action: { key: "trumpet", label: "Trumpet" },
    drive(t, c, out) {
      const e = since(c, "trumpet", 2.6);
      if (e < 0) return;
      const up = env(e, 0.05, 0.4, 1.4, 2.0);
      out.parts.trunk = { angle: -0.8 * up };
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
        name: "head",
        pivot: [0, 0.1, 0.05],
        axis: [0, 1, 0],
        regions: [
          { at: [-0.1, 0.46, 0.14], r: [0.5, 0.56, 0.55], soft: 0.2 },
          { at: [-0.02, 0.62, -0.18], r: [0.42, 0.42, 0.36], soft: 0.25 },
        ],
      },
    ],
    addon: {
      count: 12000,
      build(k) {
        const at = [0.8, 0.86, 0.42];
        const part = k.part("bubble", { pivot: [0.42, 0.52, 0.38] });
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
      out.addon = { parts: { bubble: { scale: say } } };
      if (e < 0) return;
      const turn = env(e, 0, 0.55, 2.6, 3.3);
      out.parts.head = {
        quat: quatMul(quatAxisAngle([0, 1, 0], 0.45 * turn), quatAxisAngle([1, 0, 0], 0.05 * turn)),
      };
    },
  },

  // The strings shimmer as it plays a short strum pattern.
  ukulele: {
    parts: [],
    keys: [{ color: "#808080", tol: 2, at: [0, 0.06, 0.13], r: 0.76 }],
    fx: [
      {
        name: "strings",
        select: "key0",
        origin: [0, 0, 0],
        mask: { half: [0, 0, 1], at: 0.108 },
        move: { along: [1, 0, 0] },
        pattern: { wave: [0, 1, 0], k: 26 },
        color: { glow: "#fff1c8" },
      },
    ],
    controls: [pulse("strum", "Strum", 2)],
    action: { key: "strum", label: "Strum" },
    drive(t, c, out, info) {
      const e = since(c, "strum", 2);
      if (e < 0) return;
      // Four strums (down, down, up, down) like the sound.
      let a = 0;
      for (const s of [0, 0.3, 0.45, 0.75]) if (e >= s) a = Math.max(a, Math.exp(-(e - s) * 3));
      out.fx.strings = { move: 0.032 * a, color: 0.7 * a, phase: info.time * 70 };
      // The body rocks a little with each strum.
      out.body = {
        quat: quatAxisAngle([0, 0, 1], 0.07 * a * Math.sin(e * 9)),
        squash: 0.03 * a * a,
      };
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

  // The cat statue: the head turns to one side and back, and the tail
  // (curled on the ground round its right side) flicks its tip up once.
  "cat-statue": {
    parts: [
      {
        name: "head",
        pivot: [0.05, 0.35, 0.4],
        axis: [0, 1, 0],
        regions: [{ at: [0.06, 0.74, 0.5], r: [0.48, 0.5, 0.4], soft: 0.3 }],
      },
      {
        name: "tail",
        pivot: [0.46, -0.84, -0.35],
        axis: [1, 0, 0],
        regions: [
          { at: [0.34, -0.84, -0.55], r: [0.22, 0.11, 0.22], soft: 0.6 },
          { at: [0.48, -0.84, -0.1], r: [0.14, 0.11, 0.32], soft: 0.4 },
          { at: [0.42, -0.84, 0.32], r: [0.16, 0.11, 0.3], soft: 0.4 },
        ],
      },
    ],
    controls: [{ key: "look", label: "Look", type: "pulse", ease: 2.4 }],
    action: { key: "look", label: "Look around" },
    drive(t, c, out) {
      const e = (1 - c.look) * 2.4;
      const on = c.look > 0;
      const turn = on ? Math.sin(Math.PI * band(e, 0, 0.7)) * (1 - band(e, 1.4, 2.2)) : 0;
      const back = on ? Math.sin(Math.PI * band(e, 0.7, 1.4)) : 0;
      out.parts.head = { angle: 0.55 * turn - 0.35 * back };
      out.parts.tail = { angle: on ? -0.45 * Math.sin(Math.PI * band(e, 0.2, 1.0)) : 0 };
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

  // Rears up on its hind legs, pawing the air, then settles.
  "horse-statue": {
    parts: [
      {
        name: "horse",
        pivot: HORSE_BODY,
        axis: [0, 0, 1],
        regions: [{ at: [0, 0.14, 0], r: [0.95, 0.86, 0.6], soft: 0.25 }],
      },
      {
        name: "legs",
        pivot: HORSE_LEGS,
        axis: [0, 0, 1],
        regions: [{ at: [-0.6, 0.16, 0.02], r: [0.26, 0.24, 0.24], soft: 0.4 }],
      },
    ],
    controls: [pulse("rear", "Rear", 2.6)],
    action: { key: "rear", label: "Rear up" },
    drive(t, c, out) {
      const e = since(c, "rear", 2.6);
      if (e < 0) return;
      const up = env(e, 0.05, 0.6, 1.4, 2.3);
      const qh = quatAxisAngle([0, 0, 1], -0.3 * up);
      out.parts.horse = { quat: qh };
      // The front legs paw the air while riding on the rearing body.
      const ql = quatAxisAngle([0, 0, 1], -0.35 * up * (0.6 + 0.4 * Math.sin(e * 11)));
      out.parts.legs = chain(qh, HORSE_BODY, ql, HORSE_LEGS);
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

  // The sprinkles jump off and rain back down.
  donut: {
    parts: [],
    keys: [{ long: 0.42 }],
    fx: [
      {
        name: "jump",
        select: "key0",
        origin: [0, 0, 0],
        move: { hop: [0, 1, 0] },
        pattern: { stagger: 0.55 },
      },
      {
        name: "spread",
        select: "key0",
        origin: [0, 0, 0],
        move: { push: true },
        pattern: { stagger: 0.55 },
      },
    ],
    controls: [pulse("sprinkle", "Sprinkle", 1.8)],
    action: { key: "sprinkle", label: "Toss sprinkles" },
    drive(t, c, out) {
      const e = since(c, "sprinkle", 1.8);
      if (e < 0) return;
      const phase = band(e, 0.02, 1.6);
      out.fx.jump = { move: 0.55, phase };
      out.fx.spread = { move: 0.1, phase };
      out.body = { squash: 0.05 * bump(e, 0, 0.1) };
    },
  },

  // The neon flows along the knot in a new colour and it ties tighter, then relaxes.
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
        name: "flow",
        select: "all",
        origin: [0, 0, 0],
        pattern: { swirl: [0, 0, 1], width: 0.1, twist: 0 },
        color: { recolor: "#ff3df2", keep: 0.4 },
      },
      {
        name: "glow",
        select: "all",
        color: { glow: "#ff9df8" },
      },
    ],
    controls: [pulse("tie", "Tie", 2.8)],
    action: { key: "tie", label: "Tie tighter" },
    drive(t, c, out) {
      const e = since(c, "tie", 2.8);
      if (e < 0) return;
      const tight = env(e, 0.1, 0.7, 1.4, 2.4);
      out.parts.knot = { scale: 1 - 0.16 * tight, angle: 0.5 * tight };
      const phase = 1.12 * ease(band(e, 0, 1.2)) * (1 - ease(band(e, 1.7, 2.7)));
      out.fx.flow = { color: 0.9, phase };
      out.fx.glow = { color: 0.25 * tight };
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
