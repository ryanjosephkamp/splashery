// The torus (lane Shelves): a plain ring shape on the Shapes shelf that can
// be dressed as a donut, a bagel or a swim ring. Every dressing is the same
// ring (only its tube's width and height change) and makes the same move:
// a tap pops it up onto its edge, it wobbles round like a coin spun on a
// table, faster and lower, and clatters down flat.
//
// The surface is a k.param ring sampled evenly (PACKS.md 7c), lit by baked
// light (splats are unlit). The wobble turns the whole toy by at most about
// 60 degrees, well inside a quarter turn, so the draw order holds (7b).

import { mix, shade, clamp, smoothstep, quatAxisAngle } from "../kit.js";

const TAU = Math.PI * 2;
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
const add = (a, b) => [a[0] + b[0], a[1] + b[1], a[2] + b[2]];
const mul = (a, s) => [a[0] * s, a[1] * s, a[2] * s];
const band = (x, a, b) => clamp((x - a) / (b - a), 0, 1);
const ease = (x) => x * x * (3 - 2 * x);

// A key light from the upper left and a gloss toward the home view (as in
// src/packs/balls.js), so a material reads from its colors.
const LIGHT = unit([-0.35, 0.8, 0.5]);
const VIEW = unit([0.5, 0.55, 0.7]);
const HALF = unit(add(LIGHT, VIEW));
function lit(col, n, { sheen = 0, tight = 30, soft = 0.24 } = {}) {
  const out = shade(col, 1 - soft + soft * (0.5 + 0.5 * dot(n, LIGHT)) + soft * 0.1);
  if (!sheen) return out;
  return mix(out, "#ffffff", sheen * Math.max(0, dot(n, HALF)) ** tight);
}

// Each dressing's ring: R the ring's radius, a and b the tube's half width
// and half height.
const RINGS = {
  plain: { R: 1, a: 0.42, b: 0.42 },
  donut: { R: 1, a: 0.5, b: 0.4 },
  bagel: { R: 1, a: 0.58, b: 0.46 },
  ring: { R: 1, a: 0.44, b: 0.44 },
};

// The ring's surface: u goes round the ring, v round the tube (0 at the
// outer equator, a quarter at the top). `bump(A, B)` swells the tube (the
// bagel's hand-rolled lumps, the icing's thickness).
function ringShape(k, { R, a, b }, bump = null, grid = 110) {
  return k.param(
    (u, v) => {
      const A = TAU * u;
      const B = TAU * v;
      const s = bump ? 1 + bump(A, B) : 1;
      const w = R + a * s * Math.cos(B);
      return [w * Math.cos(A), b * s * Math.sin(B), w * Math.sin(A)];
    },
    { grid, thick: Math.min(a, b), flip: true },
  );
}
// A point on the ring and its outward normal, for things laid on it.
function ringPoint({ R, a, b }, A, B, lift = 0) {
  const n = unit([(Math.cos(B) / a) * Math.cos(A), Math.sin(B) / b, (Math.cos(B) / a) * Math.sin(A)]); // prettier-ignore
  const w = R + a * Math.cos(B);
  const p = [w * Math.cos(A), b * Math.sin(B), w * Math.sin(A)];
  return { p: add(p, mul(n, lift)), n };
}
// A random direction along the surface at normal n.
function tangentDir(rand, n) {
  const t1 = unit(cross(n, Math.abs(n[1]) < 0.9 ? [0, 1, 0] : [1, 0, 0]));
  const t2 = cross(n, t1);
  const ang = rand() * TAU;
  return add(mul(t1, Math.cos(ang)), mul(t2, Math.sin(ang)));
}
// ---- The dressings ------------------------------------------------------------------

// A clean ring in satin blue-gray porcelain.
function plain(k) {
  const g = RINGS.plain;
  k.add(ringShape(k, g), {
    even: true,
    flat: 0.3,
    jitter: 0.008,
    interior: 0.1,
    core: "#a9b8c9",
    color: (c) => lit("#9fb4cc", c.n, { sheen: 0.32, tight: 16, soft: 0.3 }),
  });
}

// The shelf donut's look, as a ring: fried dough with a pale band round its
// middle, pink icing over the top with a soft wavy edge, and sprinkles.
const ICING = "#ff8fc7";
const SPRINKLES = ["#ff3b30", "#ffcc00", "#34c759", "#0a84ff", "#ffffff", "#af52de"];
const icingEdge = (A) => -0.03 + 0.07 * Math.sin(3 * A + 0.6) + 0.05 * Math.sin(7 * A + 2.1) + 0.03 * Math.sin(13 * A); // prettier-ignore
function donut(k) {
  const g = RINGS.donut;
  const iced = (A, B) => Math.sin(B) > icingEdge(A);
  k.add(
    ringShape(k, g, (A, B) => (iced(A, B) ? 0.035 * smoothstep(0, 0.12, Math.sin(B) - icingEdge(A)) : 0)), // prettier-ignore
    {
      even: true,
      flat: 0.3,
      jitter: 0.01,
      interior: 0.12,
      core: "#f6dfa4",
      color: (c) => {
        const A = TAU * c.u;
        const B = TAU * c.v;
        const up = Math.sin(B);
        if (iced(A, B)) return lit(ICING, c.n, { sheen: 0.45, tight: 14, soft: 0.22 });
        // The pale band where the dough floated in the oil, browner toward the top and bottom.
        const belt = Math.exp(-(((up + 0.02) / 0.16) ** 2)) * smoothstep(-0.2, 0.3, Math.cos(B));
        const crust = mix("#b8722f", "#d69a52", 0.5 + 0.5 * c.noise(c.lp[0] * 3, c.lp[1] * 3, c.lp[2] * 3)); // prettier-ignore
        return lit(mix(crust, "#efcf8e", 0.8 * belt), c.n, { sheen: 0.05, soft: 0.3 });
      },
    },
  );
  // Sprinkles: little rods lying on the icing, each its own color.
  k.cloud({ share: 0.012, size: 1.25, pattern: false }, (rand) => {
    const A = rand() * TAU;
    const B = Math.asin(clamp(icingEdge(A) + 0.06 + rand() * (0.94 - icingEdge(A)), -1, 1));
    const top = rand() < 0.5 ? B : Math.PI - B;
    const s = ringPoint({ ...g, a: g.a * 1.035, b: g.b * 1.035 }, A, top, 0.012);
    return {
      p: s.p,
      dir: tangentDir(rand, s.n),
      stretch: 2.8,
      color: SPRINKLES[Math.floor(rand() * SPRINKLES.length)],
      opacity: 1,
    };
  });
}

// A boiled and baked bagel: a glossy, lumpy golden-brown crust, darker on
// top, paler and matte underneath, with sesame seeds over the top.
const bagelLumps = (A, B) => 0.035 * Math.sin(3 * A + 0.4) + 0.02 * Math.sin(5 * A + 1.7 + B); // prettier-ignore
function bagel(k) {
  const g = RINGS.bagel;
  k.add(ringShape(k, g, bagelLumps), {
    even: true,
    flat: 0.3,
    jitter: 0.01,
    interior: 0.12,
    core: "#f0dcb0",
    color: (c) => {
      const B = TAU * c.v;
      const up = Math.sin(B);
      const top = smoothstep(-0.2, 0.8, up);
      const f = 0.5 + 0.5 * c.noise(c.lp[0] * 4, c.lp[1] * 4, c.lp[2] * 4);
      let col = mix("#d9a766", "#9c5a22", top);
      col = mix(col, "#7d4518", 0.35 * top * f);
      // A pale seam where the dough was joined, and a paler inner wall.
      col = mix(col, "#e6c28a", 0.35 * smoothstep(0.2, 1, -Math.cos(B)) * (1 - top));
      return lit(col, c.n, { sheen: 0.28 * top + 0.05, tight: 16, soft: 0.28 });
    },
  });
  // Sesame seeds: small pale ovals lying on the upper crust.
  k.cloud({ share: 0.007, size: 1.35, pattern: false }, (rand) => {
    const A = rand() * TAU;
    const B = Math.asin(0.05 + 0.95 * Math.sqrt(rand()));
    const top = rand() < 0.5 ? B : Math.PI - B;
    const s1 = 1 + bagelLumps(A, top);
    const s = ringPoint({ ...g, a: g.a * s1, b: g.b * s1 }, A, top, 0.01);
    return {
      p: s.p,
      dir: tangentDir(rand, s.n),
      stretch: 1.8,
      color: mix("#f3e6c4", "#d9bf86", rand() * 0.5),
      opacity: 1,
    };
  });
}

// An inflatable swim ring: red and white panels with soft plastic gloss,
// a thin welded seam round the inside, and a small valve on top.
function swimRing(k) {
  const g = RINGS.ring;
  k.add(ringShape(k, g), {
    even: true,
    flat: 0.3,
    jitter: 0.006,
    color: (c) => {
      const A = TAU * c.u;
      const B = TAU * c.v;
      const panel = Math.floor(((A / TAU) * 8 + 8) % 8);
      const x = ((A / TAU) * 8 + 8) % 1;
      let col = panel % 2 ? "#f3efe6" : "#e2402b";
      // The welded seams between panels and round the inner wall.
      const seam = Math.min(x, 1 - x) < 0.012 || Math.abs(Math.cos(B) + 1) < 0.004;
      if (seam) col = shade(col, 0.82);
      return lit(col, c.n, { sheen: 0.7, tight: 12, soft: 0.2 });
    },
  });
  // The valve: a short stub and its cap, on top of a white panel.
  const A = TAU * (1.5 / 8);
  const s = ringPoint(g, A, Math.PI / 2 - 0.25);
  const c = add(s.p, mul(s.n, 0.02));
  k.add(k.cylinder(0.06, 0.06, { caps: "top" }), {
    pos: c,
    rot: [0, 0, 0],
    weight: 3,
    flat: 0.4,
    color: (cc) => lit("#f4f1ea", cc.n, { sheen: 0.4, tight: 10 }),
  });
}

const DRESS = { plain, donut, bagel, ring: swimRing };

// ---- The wobble ---------------------------------------------------------------------

// A tap pops the ring onto its edge, then it wobbles down like a coin spun
// on a table (Euler's disk): the tilt falls while the lowest point runs
// round the rim faster and faster, until it lies flat with a little bounce.
const SECS = 3.6;
const UP = 0.42; // seconds to pop up
const DOWN = 3.05; // lies flat
const TILT = 1.05; // radians at the top (about 60 degrees)
const tiltAt = (e) => {
  if (e < UP) return TILT * ease(band(e, 0.02, UP));
  return TILT * (1 - band(e, UP, DOWN)) ** 1.35;
};
// The angle round the rim of the lowest point: its speed grows as the tilt
// falls (Euler's disk), integrated once into a table.
const STEPS = 400;
const SPIN = (() => {
  const out = new Float64Array(STEPS + 1);
  let phi = 0;
  for (let i = 1; i <= STEPS; i++) {
    const e = (i / STEPS) * SECS;
    const dt = SECS / STEPS;
    const th = tiltAt(e);
    const rate = e < UP ? 2 * band(e, 0, UP) : 2.6 / Math.sqrt(Math.max(0.12, Math.sin(th)));
    phi += rate * dt * (e < DOWN ? 1 : 0);
    out[i] = phi;
  }
  return out;
})();
const spinAt = (e) => {
  const x = clamp(e / SECS, 0, 1) * STEPS;
  const i = Math.min(STEPS - 1, Math.floor(x));
  return SPIN[i] + (SPIN[i + 1] - SPIN[i]) * (x - i);
};

// The toy's pose e seconds after the tap: a turn and an offset (in toy
// radii) that keep the ring's lowest point near the table it rests on.
export function torusPose(e, dress = "plain") {
  const g = RINGS[dress] || RINGS.plain;
  const th = tiltAt(e);
  const phi = spinAt(e);
  // Tilt about a level axis that turns with phi: the ring leans toward the
  // viewer first, then its low side runs round.
  const axis = [Math.cos(phi), 0, -Math.sin(phi)];
  const q = quatAxisAngle(axis, th);
  const size = g.R + g.a;
  // The lowest point sits R sin(tilt) + b cos(tilt) below the center; at
  // rest it is b below. A little of that lift, so the ring stays in frame.
  const lift = (g.R * Math.sin(th) + g.b * Math.cos(th) - g.b) * 0.62;
  // A hop onto the edge, and a bounce as it lands flat.
  const hop = 0.16 * Math.sin(Math.PI * band(e, 0.02, UP + 0.1));
  const land = e > DOWN ? Math.exp(-(e - DOWN) * 9) * Math.sin((e - DOWN) * 26) * (1 - band(e, SECS - 0.15, SECS)) : 0; // prettier-ignore
  return {
    quat: q,
    offset: [0, (lift / size) * 0.95 + hop * 0.5, 0],
    squash: 0.07 * land,
  };
}

export const RECIPES = {
  torus: {
    alive: false,
    options: [
      {
        key: "dress",
        label: "Dress it as",
        type: "select",
        default: "plain",
        choices: [
          { id: "plain", label: "Plain torus" },
          { id: "donut", label: "Donut" },
          { id: "bagel", label: "Bagel" },
          { id: "ring", label: "Swim ring" },
        ],
      },
    ],
    controls: [{ key: "roll", label: "Roll", type: "pulse", ease: SECS }],
    action: { key: "roll", label: "Spin it on its edge" },
    drive(t, c, out, info) {
      const e = c.roll > 0 ? (1 - c.roll) * SECS : -1;
      if (e < 0) return;
      const pose = torusPose(e, info.data?.dress);
      out.body = pose;
    },
    build(k, o) {
      const dress = DRESS[o.dress] ? o.dress : "plain";
      k.data = { dress };
      DRESS[dress](k);
    },
  },
};
