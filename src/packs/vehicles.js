// Vehicles: chunky, toy-like things that go. Generic designs only: no makes,
// models, liveries, logos or insignia. Wheels, rotors and propellers are
// parts that turn while the toy is alive; most vehicles have a tap action.
// There is no scene lighting, so colours carry a little baked sunlight.

import {
  mix,
  shade,
  smoothstep,
  clamp,
  spline,
  quatFromTo,
  quatAxisAngle,
  quatRotate,
} from "../kit.js";

const TAU = Math.PI * 2;
const add = (a, b) => [a[0] + b[0], a[1] + b[1], a[2] + b[2]];
const sub = (a, b) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
const mul = (a, s) => [a[0] * s, a[1] * s, a[2] * s];
const len = (a) => Math.hypot(a[0], a[1], a[2]);
const unit = (a) => mul(a, 1 / (len(a) || 1));
const dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
const cross = (a, b) => [
  a[1] * b[2] - a[2] * b[1],
  a[2] * b[0] - a[0] * b[2],
  a[0] * b[1] - a[1] * b[0],
];
const lerp3 = (a, b, t) => [
  a[0] + (b[0] - a[0]) * t,
  a[1] + (b[1] - a[1]) * t,
  a[2] + (b[2] - a[2]) * t,
];
const easeInOut = (x) => (x < 0.5 ? 2 * x * x : 1 - Math.pow(-2 * x + 2, 2) / 2);
const keep = (c, size) => ({ c, keep: true, size });

// Baked sunlight: the sun is high, towards the viewer and a little right.
const SUN = unit([0.3, 0.8, 0.55]);
const sunOf = (n) => n[0] * SUN[0] + n[1] * SUN[1] + n[2] * SUN[2];
const lit = (col, c, amb = 0.72) => shade(col, amb + (1 - amb) * sunOf(c.n));

// Glass that reflects a bright sky above and a dark ground below.
function glass(c, tint = "#2c4a6e", amb = 0.2) {
  const up = c.n[1];
  const sky = mix(tint, "#cfe8ff", smoothstep(-0.1, 0.9, up) * 0.75);
  const streak = Math.abs(c.p[0] * 0.7 + c.p[1] * 1.3 + c.p[2] * 0.4) % 0.6 < 0.05 ? 0.25 : 0;
  return keep(mix(shade(sky, 1 - amb + amb * sunOf(c.n)), "#ffffff", streak));
}

// A round rod (or cone when r1 is given) from a to b.
function rod(k, a, b, r, opts = {}, r1 = r) {
  const d = sub(b, a);
  const shape = k.cone(r, r1, len(d), { caps: opts.caps ?? false });
  return k.add(shape, { ...opts, pos: mul(add(a, b), 0.5), quat: quatFromTo([0, 1, 0], d) });
}

// A flat quad a-b-c-d (planar), sampled evenly.
function quad(k, a, b, c, d, n) {
  const nn = n || unit(cross(sub(b, a), sub(d, a)));
  return k.param((u, v) => lerp3(lerp3(a, b, u), lerp3(d, c, u), v), {
    grid: 6,
    normal: () => nn,
    thick: 0.02,
  });
}

// A plate with thickness: a planar quad outline pushed out both ways.
function slab(k, pts, thick, opts) {
  const [a, b, c, d] = pts;
  const n = unit(cross(sub(b, a), sub(d, a)));
  const o = mul(n, thick / 2);
  const P = pts.map((p) => add(p, o));
  const Q = pts.map((p) => sub(p, o));
  k.add(quad(k, P[0], P[1], P[2], P[3], n), opts);
  k.add(quad(k, Q[0], Q[3], Q[2], Q[1], mul(n, -1)), opts);
  const mid = mul(add(add(a, b), add(c, d)), 0.25);
  for (let i = 0; i < 4; i++) {
    const j = (i + 1) % 4;
    if (len(sub(pts[j], pts[i])) < 1e-6) continue;
    let e = unit(cross(sub(pts[j], pts[i]), n));
    if (dot(e, sub(mul(add(pts[i], pts[j]), 0.5), mid)) < 0) e = mul(e, -1);
    k.add(quad(k, Q[i], Q[j], P[j], P[i], e), opts);
  }
}

// A box with rounded edges and corners, sampled evenly: flat faces, quarter
// cylinders along the edges and sphere corners. (The kit's roundedBox
// crowds its samples towards the edges when it is very boxy.)
function roundBox(sx, sy, sz, r) {
  r = Math.max(1e-4, Math.min(r, sx / 2, sy / 2, sz / 2));
  const h = [sx / 2 - r, sy / 2 - r, sz / 2 - r];
  const faceA = [4 * h[1] * h[2], 4 * h[0] * h[2], 4 * h[0] * h[1]];
  const edgeA = [Math.PI * r * h[0], Math.PI * r * h[1], Math.PI * r * h[2]];
  const cornerA = 4 * Math.PI * r * r;
  const parts = [...faceA.map((a) => 2 * a), ...edgeA.map((a) => 4 * a), cornerA];
  const area = parts.reduce((a, b) => a + b, 0);
  return {
    area,
    thick: Math.min(sx, sy, sz) / 2,
    sample(rand) {
      let x = rand() * area;
      let i = 0;
      while (i < parts.length - 1 && x >= parts[i]) x -= parts[i++];
      const sgn = () => (rand() < 0.5 ? -1 : 1);
      let n;
      let base;
      let face = -1;
      if (i < 3) {
        const s = sgn();
        n = [0, 0, 0];
        n[i] = s;
        base = [0, 0, 0];
        for (let k = 0; k < 3; k++) base[k] = k === i ? s * h[k] : (rand() * 2 - 1) * h[k];
        face = i * 2 + (s > 0 ? 0 : 1);
      } else if (i < 6) {
        const ax = i - 3;
        const a = rand() * Math.PI * 0.5;
        const j = (ax + 1) % 3;
        const k2 = (ax + 2) % 3;
        const sj = sgn();
        const sk = sgn();
        n = [0, 0, 0];
        n[j] = sj * Math.cos(a);
        n[k2] = sk * Math.sin(a);
        base = [0, 0, 0];
        base[ax] = (rand() * 2 - 1) * h[ax];
        base[j] = sj * h[j];
        base[k2] = sk * h[k2];
      } else {
        const z = rand();
        const a = rand() * Math.PI * 0.5;
        const q = Math.sqrt(1 - z * z);
        const s = [sgn(), sgn(), sgn()];
        n = [s[0] * q * Math.cos(a), s[1] * z, s[2] * q * Math.sin(a)];
        base = [s[0] * h[0], s[1] * h[1], s[2] * h[2]];
      }
      const p = [base[0] + n[0] * r, base[1] + n[1] * r, base[2] + n[2] * r];
      return { p, n, u: p[0] / sx + 0.5, v: p[1] / sy + 0.5, face };
    },
  };
}

// A wheel turning about Z: a round tyre, a rim with spokes and a hub.
function wheel(k, pos, r, w, opts = {}) {
  const {
    part,
    tyre = "#262626",
    rim = "#d7d7d2",
    hub = "#9a9a96",
    spokes = 5,
    tread = true,
    rimR = 0.62,
  } = opts;
  const tr = r * (1 - rimR) * 0.62;
  k.add(k.torus(r - tr, tr), {
    pos,
    rot: [90, 0, 0],
    scale: [1, w / (2 * tr), 1],
    part,
    flat: 0.25,
    weight: 1.3,
    pattern: false,
    color: (c) => {
      const lug = tread && Math.abs(c.lp[1]) < tr * 0.75 && (c.u * 72) % 1 < 0.35;
      const side = 0.78 + 0.22 * Math.abs(c.ln[1]);
      return shade(tyre, lug ? 0.7 : side);
    },
  });
  const rw = w * 0.7;
  // The wheel stays metal and rubber under a flag or pattern.
  k.add(k.cylinder(r * rimR + tr * 0.4, rw), {
    pos,
    rot: [90, 0, 0],
    part,
    flat: 0.2,
    weight: 1.5,
    pattern: false,
    color: (c) => {
      if (c.s.side) return shade(rim, 0.55);
      const rr = c.s.radial;
      if (rr < 0.26) return shade(hub, rr < 0.14 ? 1.05 : 0.85);
      if (rr > 0.86) return shade(rim, 0.95);
      if (spokes <= 0) return shade(rim, 0.82);
      const f = (c.u * spokes) % 1;
      const wSp = 0.16 + 0.1 * (1 - rr);
      return f < wSp || f > 1 - wSp ? shade(rim, 0.9) : shade(tyre, 0.55);
    },
  });
}

// A soft contact shadow on the ground.
function shadow(k, y, rx, rz, { x = 0, z = 0, share = 0.012, opacity = 0.32 } = {}) {
  k.cloud({ share, size: 3, pattern: false }, (rand) => {
    const a = rand() * TAU;
    const r = Math.sqrt(rand());
    return {
      p: [x + Math.cos(a) * r * rx, y, z + Math.sin(a) * r * rz],
      n: [0, 1, 0],
      flat: 0.1,
      color: "#141414",
      opacity: opacity * (1 - r * r),
    };
  });
}

// Puffs of smoke or steam that drift up from `from` along `dir`; at rest
// they already trail out into a plume.
function plume(k, from, dir, o = {}) {
  const {
    share = 0.03,
    spread = 0.12,
    size = 2.4,
    color = "#e9e7e2",
    dark = "#8f8b86",
    opacity = 0.35,
    height = 0.7,
    part,
    grow = 3,
  } = o;
  k.cloud({ share, size, pattern: false, part }, (rand) => {
    const s = Math.pow(rand(), 1.4);
    const w = spread * (0.35 + grow * s);
    const q = [(rand() - 0.5) * 2, (rand() - 0.5) * 2, (rand() - 0.5) * 2];
    return {
      p: add(add(from, mul(dir, s)), mul(q, w)),
      color: mix(color, dark, rand() * 0.45 + s * 0.2),
      size: 0.6 + 0.9 * s + 0.4 * rand(),
      opacity: opacity * (1 - 0.55 * s),
      kind: "rise",
      params: [height * (0.6 + 0.6 * rand()), rand()],
    };
  });
}

// Rock (or tilt) a part together with the whole vehicle: a spin `q` about
// the part's own pivot `pv`, then the vehicle's tilt `tq` about the centre
// `centre`, then a lift. Returns the part pose for drive().
function carried(pv, tq, centre, lift = [0, 0, 0], q = [0, 0, 0, 1]) {
  const qq = quatMulLocal(tq, q);
  const off = add(sub(add(centre, quatRotate(tq, sub(pv, centre))), pv), lift);
  return { quat: qq, offset: off };
}
function quatMulLocal(a, b) {
  return [
    a[3] * b[0] + b[3] * a[0] + a[1] * b[2] - a[2] * b[1],
    a[3] * b[1] + b[3] * a[1] + a[2] * b[0] - a[0] * b[2],
    a[3] * b[2] + b[3] * a[2] + a[0] * b[1] - a[1] * b[0],
    a[3] * b[3] - a[0] * b[0] - a[1] * b[1] - a[2] * b[2],
  ];
}
const tilt = (x, z) => quatMulLocal(quatAxisAngle([0, 0, 1], z), quatAxisAngle([1, 0, 0], x));

// A patch of water that ripples, with foam where `foam(x, z)` says.
function water(k, y, rx, rz, o = {}) {
  const { share = 0.12, deep = "#1d5f8a", light = "#5fb3d6", foam = null, amount = 0.012 } = o;
  k.cloud({ share, size: 1.6, pattern: false }, (rand) => {
    const a = rand() * TAU;
    const r = Math.sqrt(rand());
    const x = Math.cos(a) * r * rx;
    const z = Math.sin(a) * r * rz;
    const ripple = 0.5 + 0.5 * Math.sin(x * 9 + z * 6 + Math.sin(z * 3 + x) * 2);
    let col = mix(deep, light, 0.25 + 0.5 * ripple * ripple + 0.15 * rand());
    const f = foam ? foam(x, z) : 0;
    if (f > 0) col = mix(col, "#f4fbff", clamp(f, 0, 1) * (0.6 + 0.4 * rand()));
    const edge = smoothstep(0.82, 1, r);
    return {
      p: [x, y + (rand() - 0.5) * 0.004, z],
      n: [0, 1, 0],
      flat: 0.12,
      color: col,
      opacity: 0.95 * (1 - edge * 0.85),
      kind: "wave",
      params: [amount, rand() * 0.3],
    };
  });
}

// Wheels turn at a steady rate while alive; a pulse adds a burst of whole
// turns (an integer number, so the wheel lands where it would have been).
const burst = (c, turns) => TAU * turns * smoothstep(0, 1, 1 - c);

// ---- Rocket -----------------------------------------------------------------------

const ROCKET_A0 = 0.55; // the side of the rocket that faces the default camera

function rocketBuild(k, o) {
  const red = o.color;
  const white = "#f4f1ea";
  const padTop = 0.18;
  // The pad: a concrete disc with hazard stripes round its edge.
  k.add(k.cylinder(1.3, padTop), {
    pos: [0, padTop / 2, 0],
    flat: 0.2,
    interior: 0.08,
    core: "#6f6b64",
    color: (c) => {
      if (c.s.side) {
        const s = Math.floor(c.u * 56 + (c.lp[1] / padTop) * 1.2) % 2;
        return lit(s ? "#f2c318" : "#26241f", c);
      }
      if (c.s.cap === "bottom") return "#4a4743";
      const r = c.s.radial;
      if (Math.abs(r - 0.82) < 0.025) return keep(lit("#f2c318", c));
      const scorch = smoothstep(0.42, 0.12, r);
      const conc = shade("#b3aea5", 0.92 + 0.12 * c.noise(c.p[0] * 9, 0, c.p[2] * 9));
      return lit(mix(conc, "#2e2b28", scorch * 0.85), c);
    },
  });

  // The rocket: a lathe body with portholes, a red nose and red fins.
  const rocket = k.part("rocket", { pivot: [0, 0, 0] });
  const body = k.lathe(
    [
      [0.17, 0.5],
      [0.29, 0.6],
      [0.37, 0.85],
      [0.4, 1.3],
      [0.4, 1.7],
      [0.37, 2.1],
      [0.31, 2.45],
      [0.22, 2.75],
      [0.11, 2.98],
      [0.0, 3.12],
    ],
    { grid: 72 },
  );
  const holes = [
    [2.02, 0.12],
    [1.6, 0.085],
  ];
  k.add(body, {
    part: rocket,
    flat: 0.2,
    interior: 0.06,
    core: "#9a9a9a",
    color: (c) => {
      const y = c.p[1];
      const r = Math.hypot(c.p[0], c.p[2]);
      let da = c.u * TAU - ROCKET_A0;
      da = ((((da + Math.PI) % TAU) + TAU) % TAU) - Math.PI;
      for (const [y0, R] of holes) {
        const dx = da * r;
        const dy = y - y0;
        const d = Math.hypot(dx, dy);
        if (d < R) {
          const hi = smoothstep(0.2, 0.9, (-dx + dy) / R) * 0.7;
          return keep(mix(mix("#15345e", "#3f86c9", 1 - d / R), "#e9f6ff", hi));
        }
        if (d < R + 0.035) return keep(lit("#d4ab4f", c));
      }
      if (y > 2.52) return lit(Math.abs(y - 2.52) < 0.02 ? shade(red, 0.7) : red, c);
      if (Math.abs(y - 1.15) < 0.07) return lit(red, c);
      if (Math.abs(y - 2.3) < 0.012 || Math.abs(y - 0.92) < 0.012) return lit("#c9c5bc", c);
      return lit(white, c);
    },
  });
  for (let i = 0; i < 3; i++) {
    const a = ROCKET_A0 + Math.PI + (i * TAU) / 3;
    const d = [Math.sin(a), 0, Math.cos(a)];
    const at = (r, y) => add(mul(d, r), [0, y, 0]);
    slab(k, [at(0.27, 0.62), at(0.8, padTop + 0.01), at(0.78, 0.58), at(0.38, 1.4)], 0.07, {
      part: rocket,
      flat: 0.2,
      weight: 1.4,
      color: (c) => lit(red, c, 0.66),
    });
  }
  // The nozzle.
  k.add(k.cone(0.24, 0.16, 0.22, { caps: false }), {
    pos: [0, 0.45, 0],
    part: rocket,
    flat: 0.2,
    color: (c) => shade("#56565c", 0.8 + 0.3 * Math.abs(Math.sin(c.p[1] * 60))),
  });

  // Exhaust: a flame at the nozzle, turned upside down by its part.
  const flame = k.part("flame", { pivot: [0, 0.34, 0] });
  k.cloud({ share: 0.06, size: 1.4, pattern: false, part: flame }, (rand) => {
    const a = rand() * TAU;
    const r = 0.2 * Math.sqrt(rand());
    const hot = 1 - r / 0.2;
    return {
      p: [Math.sin(a) * r, 0.34 + rand() * 0.06, Math.cos(a) * r],
      color: mix("#ff8c2a", "#fff5cf", hot),
      size: 0.8 + 1.2 * hot,
      opacity: 0.85,
      kind: "flame",
      params: [0.55 + 0.6 * hot * rand(), rand()],
    };
  });
  // Clouds of smoke that billow over the pad at lift-off.
  const smoke = k.part("smoke", { pivot: [0, 0, 0] });
  k.cloud({ share: 0.05, size: 3.2, pattern: false, part: smoke }, (rand) => {
    const a = rand() * TAU;
    const r = 0.25 + 1.35 * Math.sqrt(rand());
    return {
      p: [Math.sin(a) * r, padTop + 0.05 + rand() * 0.45 * (1.2 - r / 1.6), Math.cos(a) * r],
      color: shade("#dcd8d1", 0.85 + 0.2 * rand()),
      size: 0.7 + 0.8 * rand(),
      opacity: 0.4,
      kind: "rise",
      params: [0.45 + 0.35 * rand(), rand()],
    };
  });
  // A wisp of cold vapour while the rocket waits.
  const vapour = k.part("vapour", { pivot: [0, 0, 0] });
  k.cloud({ share: 0.0025, size: 2.2, pattern: false, part: vapour }, (rand) => {
    const a = ROCKET_A0 + 0.9 + (rand() - 0.5) * 1.4;
    const r = 0.5 + rand() * 0.25;
    return {
      p: [Math.sin(a) * r, 0.25 + rand() * 0.35, Math.cos(a) * r],
      color: "#f4f8fb",
      opacity: 0.08,
      kind: "rise",
      params: [0.3, rand()],
    };
  });

  // The launch tower: an orange lattice with a swing arm to the rocket.
  const tx = -1.0;
  const tz = -0.25;
  const hw = 0.19;
  const top = 3.45;
  const steel = "#e0701f";
  const member = { flat: 0.2, weight: 2.4, color: (c) => lit(steel, c, 0.62) };
  const corners = [
    [-hw, -hw],
    [hw, -hw],
    [hw, hw],
    [-hw, hw],
  ];
  for (const [cx, cz] of corners)
    k.add(k.box(0.05, top - padTop, 0.05), {
      ...member,
      pos: [tx + cx, (top + padTop) / 2, tz + cz],
    });
  const levels = 11;
  for (let i = 0; i <= levels; i++) {
    const y0 = padTop + ((top - padTop) * i) / levels;
    const y1 = padTop + ((top - padTop) * (i + 1)) / levels;
    for (let s = 0; s < 4; s++) {
      const [ax, az] = corners[s];
      const [bx, bz] = corners[(s + 1) % 4];
      const A = [tx + ax, y0, tz + az];
      const B = [tx + bx, y0, tz + bz];
      k.add(k.box(0.032, 2 * hw, 0.032), {
        ...member,
        pos: mul(add(A, B), 0.5),
        quat: quatFromTo([0, 1, 0], sub(B, A)),
      });
      if (i < levels) {
        const flip = (i + s) % 2 === 0;
        const P = [tx + (flip ? ax : bx), y0, tz + (flip ? az : bz)];
        const Q = [tx + (flip ? bx : ax), y1, tz + (flip ? bz : az)];
        k.add(k.box(0.022, len(sub(Q, P)), 0.022), {
          ...member,
          pos: mul(add(P, Q), 0.5),
          quat: quatFromTo([0, 1, 0], sub(Q, P)),
        });
      }
    }
  }
  k.add(k.box(0.52, 0.05, 0.52), { ...member, weight: 1.2, pos: [tx, top + 0.02, tz] });
  rod(k, [tx, top, tz], [tx, top + 0.55, tz], 0.018, { ...member, weight: 2 });
  k.add(k.sphere(0.04), { pos: [tx, top + 0.57, tz], weight: 3, pattern: false, color: "#ff3b30" });
  // The swing arm, which swings away at ignition.
  const armY = 2.28;
  const pv = [tx + hw, armY, tz];
  const arm = k.part("arm", { pivot: pv, axis: [0, 1, 0] });
  const tip = [-0.36, armY, -0.05];
  k.add(k.box(len(sub(tip, pv)), 0.08, 0.12), {
    part: arm,
    flat: 0.2,
    weight: 1.6,
    pos: mul(add(pv, tip), 0.5),
    quat: quatFromTo([1, 0, 0], sub(tip, pv)),
    color: (c) => lit(steel, c, 0.62),
  });
  k.add(roundBox(0.16, 0.2, 0.2, 0.048), {
    part: arm,
    pos: add(tip, [-0.04, 0.03, 0]),
    flat: 0.2,
    color: (c) => lit("#e9e6df", c),
  });
  // Room above the rocket for the first moments of lift-off.
  k.reach([0, 3.9, 0]);
}

// ---- Helicopter ----------------------------------------------------------------------

const HELI = { rotor: [0.05, 1.86, 0], tail: [-2.3, 1.42, 0.075], centre: [0, 1, 0] };

function helicopterBuild(k, o) {
  const col = o.color;
  // A helipad.
  k.add(k.cylinder(1.55, 0.06), {
    pos: [0, 0.03, 0],
    flat: 0.2,
    color: (c) => {
      if (c.s.side) return "#3a3a3a";
      const [x, , z] = c.p;
      const r = Math.hypot(x, z);
      if (Math.abs(r - 1.3) < 0.045) return keep(lit("#f2c318", c));
      const H =
        (Math.abs(Math.abs(z) - 0.32) < 0.07 && Math.abs(x) < 0.5) ||
        (Math.abs(x) < 0.07 && Math.abs(z) < 0.32);
      if (H && c.s.cap === "top") return keep(lit("#f4f4f0", c));
      return lit(shade("#4a4d52", 0.93 + 0.1 * c.noise(x * 12, 0, z * 12)), c);
    },
  });
  shadow(k, 0.065, 1.1, 0.6, { x: -0.3 });
  const heli = k.part("heli", { pivot: HELI.centre });
  const P = { part: heli, flat: 0.2 };
  // The cabin: a rounded body with a big glass bubble at the front.
  k.add(k.ellipsoid(0.86, 0.62, 0.6), {
    ...P,
    pos: [0.2, 0.95, 0],
    interior: 0.06,
    core: "#555",
    color: (c) => {
      const [x, y, z] = c.lp;
      if (x > 0.12 + 0.35 * Math.max(0, -y) && y > -0.24) return glass(c);
      if (x < 0.02 && x > -0.52 && y > -0.02 && y < 0.36 && Math.abs(z) > 0.3) return glass(c);
      if (Math.abs(y + 0.28) < 0.05) return lit("#f5f3ee", c);
      return lit(col, c);
    },
  });
  // Tail boom, fin and tailplane.
  rod(k, [-0.45, 1.05, 0], [-2.25, 1.3, 0], 0.21, { ...P, color: (c) => lit(col, c) }, 0.075);
  slab(
    k,
    [
      [-2.05, 1.28, 0],
      [-2.42, 1.26, 0],
      [-2.5, 1.85, 0],
      [-2.28, 1.85, 0],
    ],
    0.05,
    { ...P, color: (c) => lit(col, c, 0.66) },
  );
  slab(
    k,
    [
      [-1.72, 1.24, -0.42],
      [-1.95, 1.26, -0.42],
      [-1.95, 1.26, 0.42],
      [-1.72, 1.24, 0.42],
    ],
    0.04,
    { ...P, color: (c) => lit("#f5f3ee", c, 0.66) },
  );
  // Engine housing, mast and hub.
  k.add(roundBox(0.95, 0.3, 0.52, 0.09), {
    ...P,
    pos: [-0.05, 1.56, 0],
    color: (c) => lit(shade(col, 0.82), c),
  });
  k.add(k.cylinder(0.06, 0.2), { ...P, pos: [0.05, 1.76, 0], color: "#5a5a5e" });
  // Skids on struts.
  for (const z of [-0.5, 0.5]) {
    const skid = (t) => {
      const x = -0.75 + 1.75 * t;
      const up = smoothstep(0.82, 1, t);
      return [x - up * 0.05, 0.1 + up * 0.18, z];
    };
    k.add(k.tube(skid, 0.04, { caps: true }), { ...P, weight: 1.6, color: "#3d3f44" });
    for (const x of [-0.35, 0.55])
      rod(k, [x, 0.1, z], [x + 0.05, 0.6, z * 0.55], 0.03, { ...P, weight: 1.6, color: "#3d3f44" });
  }
  // The main rotor: four long blades on a hub.
  const rotor = k.part("rotor", { pivot: HELI.rotor, axis: [0, 1, 0] });
  k.add(k.cylinder(0.13, 0.1), { part: rotor, pos: HELI.rotor, flat: 0.2, color: "#4a4a4e" });
  for (let i = 0; i < 4; i++) {
    const a = (i * TAU) / 4 + 0.35;
    const d = [Math.cos(a), 0, Math.sin(a)];
    k.add(k.box(1.62, 0.035, 0.14), {
      part: rotor,
      pos: add(HELI.rotor, mul(d, 0.9)),
      rot: [0, (-a * 180) / Math.PI, 0],
      flat: 0.2,
      weight: 1.4,
      color: (c) => {
        const r = Math.hypot(c.p[0] - HELI.rotor[0], c.p[2] - HELI.rotor[2]);
        return r > 1.5 ? keep("#f2c318") : shade("#34363b", 0.9 + 0.2 * c.n[1]);
      },
    });
  }
  // The tail rotor.
  const tail = k.part("tailRotor", { pivot: HELI.tail, axis: [0, 0, 1] });
  k.add(k.cylinder(0.05, 0.06), { part: tail, pos: HELI.tail, rot: [90, 0, 0], color: "#4a4a4e" });
  for (const s of [-1, 1])
    k.add(k.box(0.06, 0.3, 0.02), {
      part: tail,
      pos: add(HELI.tail, [0, s * 0.16, 0.01]),
      flat: 0.2,
      weight: 2,
      color: (c) => (Math.abs(c.p[1] - HELI.tail[1]) > 0.24 ? "#f2c318" : "#34363b"),
    });
  k.reach([0, 3.1, 0]);
}

// ---- Hot-air balloon -------------------------------------------------------------------

const BALLOON_C = [0, 1.6, 0];

function balloonBuild(k, o) {
  const cols =
    o.style === "rainbow"
      ? ["#e53935", "#fb8c00", "#fdd835", "#43a047", "#1e88e5", "#8e24aa"]
      : [o.c1, o.c2];
  const balloon = k.part("balloon", { pivot: BALLOON_C });
  const N = 12;
  // The envelope: a teardrop of gores that bulge a little between seams.
  const prof = spline([
    [0.24, 1.05, 0],
    [0.36, 1.32, 0],
    [0.6, 1.72, 0],
    [0.85, 2.16, 0],
    [0.99, 2.6, 0],
    [1.0, 2.98, 0],
    [0.9, 3.34, 0],
    [0.62, 3.6, 0],
    [0.3, 3.72, 0],
    [0.0, 3.75, 0],
  ]);
  const env = k.param(
    (u, v) => {
      const [r, y] = prof(v);
      const bulge = 1 + 0.03 * Math.abs(Math.sin(u * N * Math.PI)) * smoothstep(0.05, 0.4, v);
      const a = u * TAU;
      return [r * bulge * Math.sin(a), y, r * bulge * Math.cos(a)];
    },
    {
      grid: 96,
      normal: (u, v, p) => {
        const e = 0.002;
        const a = prof(Math.max(0, v - e));
        const b = prof(Math.min(1, v + e));
        const ang = u * TAU;
        const nr = b[1] - a[1];
        const ny = -(b[0] - a[0]);
        return [nr * Math.sin(ang), ny, nr * Math.cos(ang)];
      },
    },
  );
  k.add(env, {
    part: balloon,
    flat: 0.2,
    size: 1.2,
    color: (c) => {
      const g = Math.floor(c.u * N);
      const seam = Math.abs(((c.u * N) % 1) - 0.5) > 0.475;
      let base = cols[g % cols.length];
      const v = c.v;
      if (v < 0.06) base = "#efe7d4";
      else if (v > 0.9) base = cols[0];
      const shadeF = 0.8 + 0.22 * sunOf(c.n);
      return seam ? keep(shade(base, shadeF * 0.82)) : shade(base, shadeF);
    },
  });
  // Ropes from the mouth to the basket.
  const bw = 0.29;
  for (let i = 0; i < 8; i++) {
    const a = (i / 8) * TAU + Math.PI / 8;
    const top = [Math.sin(a) * 0.23, 1.08, Math.cos(a) * 0.23];
    const bot = [Math.sign(Math.sin(a)) * bw * 0.85, 0.52, Math.sign(Math.cos(a)) * bw * 0.85];
    rod(k, top, bot, 0.012, { part: balloon, weight: 2.5, color: "#5b4632" });
  }
  // The burner.
  k.add(k.cylinder(0.09, 0.14), {
    part: balloon,
    pos: [0, 0.66, 0],
    color: (c) => lit("#9ea3a8", c),
  });
  k.add(k.torus(0.16, 0.018), { part: balloon, pos: [0, 0.6, 0], weight: 2, color: "#7e8388" });
  k.cloud({ share: 0.03, size: 1.2, pattern: false, part: balloon }, (rand) => {
    const a = rand() * TAU;
    const r = 0.07 * Math.sqrt(rand());
    const hot = 1 - r / 0.07;
    return {
      p: [Math.sin(a) * r, 0.75 + rand() * 0.06, Math.cos(a) * r],
      color: mix("#ff9d2e", "#fff3c4", hot),
      size: 0.7 + hot,
      opacity: 0.9,
      kind: "flame",
      params: [0.18 + 0.12 * hot * rand(), rand()],
    };
  });
  // The wicker basket.
  const wicker = (c) => {
    const f = c.s.face;
    const hu = f === 0 || f === 1 ? c.p[2] : c.p[0];
    const weave = Math.sin(hu * 60) * Math.sin(c.p[1] * 60);
    const base = c.p[1] > 0.47 ? "#6b4424" : mix("#b98a4e", "#8d6433", 0.5 + 0.5 * weave);
    return lit(base, c, 0.66);
  };
  k.add(k.box(2 * bw, 0.36, 2 * bw), {
    part: balloon,
    pos: [0, 0.32, 0],
    flat: 0.2,
    interior: 0.05,
    core: "#6b4424",
    color: (c) => (c.s.face === 2 ? null : wicker(c)),
  });
  k.add(k.box(2 * bw - 0.04, 0.02, 2 * bw - 0.04), {
    part: balloon,
    pos: [0, 0.46, 0],
    color: "#4a2f18",
  });
  // A couple of little clouds for company.
  const puff = (cx, cy, cz, s) => {
    for (let i = 0; i < 5; i++) {
      const r = s * (0.55 + 0.45 * Math.sin(i * 1.7 + 1) ** 2);
      k.add(k.sphere(r), {
        pos: [cx + (i - 2) * s * 0.55, cy + (i % 2) * s * 0.18 + (i === 2 ? s * 0.25 : 0), cz],
        flat: 0.35,
        pattern: false,
        color: (c) => shade("#ffffff", 0.84 + 0.16 * smoothstep(-0.6, 0.8, c.n[1])),
      });
    }
  };
  puff(-1.25, 0.6, -0.4, 0.26);
  puff(1.3, 2.35, -0.6, 0.2);
  k.reach([0, 3.75, 0]);
  k.reach([0, 0.05, 0]);
}

// ---- Steam train ----------------------------------------------------------------------

const TRAIN = {
  drivers: [-0.72, 0.1, 0.92],
  driverR: 0.36,
  pony: 1.72,
  ponyR: 0.2,
  tender: [-2.55, -1.75],
  tenderR: 0.24,
  crank: 0.17,
  side: 0.47,
};

function trainBuild(k, o) {
  const col = o.color;
  const black = "#1d1e21";
  const brass = "#d6ad4c";
  const red = "#b3261e";
  const P = { flat: 0.2 };
  // Track: rails on sleepers on ballast.
  k.add(k.box(6.4, 0.08, 1.35), {
    pos: [-0.4, -0.04, 0],
    ...P,
    pattern: false,
    color: (c) => lit(shade("#8a847a", 0.85 + 0.25 * c.noise(c.p[0] * 30, 0, c.p[2] * 30)), c),
  });
  for (let x = -3.5; x <= 2.8; x += 0.28)
    k.add(k.box(0.14, 0.05, 1.12), {
      pos: [x, 0.025, 0],
      ...P,
      pattern: false,
      color: (c) => lit("#5d4128", c),
    });
  for (const z of [-TRAIN.side + 0.08, TRAIN.side - 0.08])
    k.add(k.box(6.4, 0.06, 0.05), {
      pos: [-0.4, 0.08, z],
      ...P,
      weight: 1.5,
      pattern: false,
      color: (c) => lit(c.n[1] > 0.5 ? "#c9ccd1" : "#6b6258", c),
    });
  const railTop = 0.11;
  // Wheels: each axle is a part.
  const axle = (name, x, r, spokes) => {
    const pivot = [x, railTop + r, 0];
    const part = k.part(name, { pivot, axis: [0, 0, 1] });
    for (const z of [-1, 1])
      wheel(k, [x, railTop + r, z * (TRAIN.side - 0.08)], r, 0.1, {
        part,
        tyre: "#2a2a2c",
        rim: red,
        hub: "#3a3a3a",
        spokes,
        tread: false,
        rimR: 0.86,
      });
    return part;
  };
  TRAIN.drivers.forEach((x, i) => axle(`driver${i}`, x, TRAIN.driverR, 12));
  axle("pony", TRAIN.pony, TRAIN.ponyR, 8);
  TRAIN.tender.forEach((x, i) => axle(`tender${i}`, x, TRAIN.tenderR, 8));
  // Coupling rods join the crank pins of the driving wheels.
  const rods = k.part("rods", { pivot: [0, 0, 0] });
  const ry = railTop + TRAIN.driverR;
  for (const z of [-1, 1]) {
    const zz = z * (TRAIN.side + 0.02);
    k.add(k.box(TRAIN.drivers[2] - TRAIN.drivers[0] + 0.12, 0.05, 0.03), {
      part: rods,
      pos: [(TRAIN.drivers[0] + TRAIN.drivers[2]) / 2 + TRAIN.crank, ry, zz],
      ...P,
      weight: 2,
      color: (c) => lit("#b9bcc2", c, 0.6),
    });
    for (const x of TRAIN.drivers)
      k.add(k.cylinder(0.035, 0.05), {
        part: rods,
        pos: [x + TRAIN.crank, ry, zz + z * 0.02],
        rot: [90, 0, 0],
        weight: 2,
        color: "#8d9096",
      });
  }
  // Running board and buffer beam.
  const deck = 0.8;
  k.add(k.box(3.45, 0.08, 1.02), {
    pos: [0.5, deck, 0],
    ...P,
    color: (c) => (c.s.face === 4 || c.s.face === 5 ? lit(red, c) : lit(black, c)),
  });
  k.add(k.box(0.12, 0.26, 1.08), { pos: [2.28, 0.62, 0], ...P, color: (c) => lit(red, c) });
  for (const z of [-0.34, 0.34]) {
    k.add(k.cylinder(0.05, 0.14), { pos: [2.4, 0.62, z], rot: [0, 0, 90], color: "#2b2b2b" });
    k.add(k.cylinder(0.09, 0.03), {
      pos: [2.48, 0.62, z],
      rot: [0, 0, 90],
      color: (c) => lit("#b9bcc2", c),
    });
  }
  // Cylinders beside the pony truck.
  for (const z of [-1, 1])
    k.add(k.cylinder(0.16, 0.5), {
      pos: [1.72, 0.62, z * 0.5],
      rot: [0, 0, 90],
      ...P,
      color: (c) => (c.s.cap ? lit("#b9bcc2", c) : lit(black, c)),
    });
  // The boiler.
  const by = 1.22;
  k.add(k.cylinder(0.42, 2.0), {
    pos: [0.95, by, 0],
    rot: [0, 0, 90],
    ...P,
    interior: 0.05,
    core: "#3b3b3b",
    color: (c) => {
      const x = c.p[0];
      const band = [0.25, 0.9, 1.5].some((b) => Math.abs(x - b) < 0.025);
      return lit(band ? brass : col, c);
    },
  });
  k.add(k.cylinder(0.44, 0.38), {
    pos: [2.12, by, 0],
    rot: [0, 0, 90],
    ...P,
    color: (c) => {
      if (c.s.cap === "bottom") {
        const r = c.s.radial;
        if (r < 0.1) return keep(lit(brass, c));
        return lit(r > 0.93 ? "#3a3a3a" : "#26272a", c);
      }
      return lit(black, c);
    },
  });
  k.add(k.sphere(0.07), { pos: [2.33, by + 0.52, 0], pattern: false, weight: 3, color: "#fff4c8" });
  k.add(k.cylinder(0.08, 0.1), { pos: [2.33, by + 0.52, 0], rot: [0, 0, 90], color: "#2b2b2b" });
  // Chimney, dome and whistle.
  k.add(
    k.lathe(
      [
        [0.14, 0],
        [0.13, 0.2],
        [0.15, 0.4],
        [0.2, 0.5],
        [0.2, 0.56],
      ],
      { grid: 48 },
    ),
    { pos: [2.1, by + 0.3, 0], ...P, color: (c) => lit(c.p[1] > by + 0.8 ? "#b87333" : black, c) },
  );
  k.add(k.sphere(0.2), {
    pos: [1.05, by + 0.4, 0],
    scale: [1, 0.8, 1],
    color: (c) => lit(brass, c),
  });
  k.add(k.cylinder(0.035, 0.2), { pos: [0.35, by + 0.5, 0], color: (c) => lit(brass, c) });
  // The cab.
  const cx0 = -1.15;
  const cx1 = -0.1;
  k.add(k.box(cx1 - cx0, 1.05, 1.0), {
    pos: [(cx0 + cx1) / 2, deck + 0.55, 0],
    ...P,
    interior: 0.05,
    core: "#3b3b3b",
    color: (c) => {
      const [x, y, z] = c.p;
      if (c.s.face === 2) return null;
      const side = c.s.face === 4 || c.s.face === 5;
      if (side && y > deck + 0.55 && y < deck + 0.95 && x > cx0 + 0.18 && x < cx1 - 0.2)
        return keep(shade("#1a2430", 0.8 + 0.4 * smoothstep(deck + 0.6, deck + 0.95, y)));
      if (c.s.face === 0 && y > deck + 0.6 && y < deck + 0.9 && Math.abs(Math.abs(z) - 0.25) < 0.14)
        return keep("#1a2430");
      if (Math.abs(y - (deck + 0.18)) < 0.02) return lit(brass, c);
      return lit(col, c);
    },
  });
  k.add(
    k.param(
      (u, v) => {
        const x = cx0 - 0.1 + (cx1 - cx0 + 0.18) * u;
        const a = (v - 0.5) * 1.6;
        return [x, deck + 1.08 + 0.18 * Math.cos(a) - 0.18, (0.62 * Math.sin(a)) / Math.sin(0.8)];
      },
      { grid: 24, flip: true },
    ),
    { ...P, color: (c) => lit("#2a2b2e", c) },
  );
  // The tender with its coal.
  const tx0 = -2.95;
  const tx1 = -1.25;
  k.add(k.box(tx1 - tx0, 0.7, 1.0), {
    pos: [(tx0 + tx1) / 2, deck + 0.28, 0],
    ...P,
    interior: 0.05,
    core: "#222",
    color: (c) => {
      if (c.s.face === 2) return null;
      const y = c.p[1];
      if (Math.abs(y - (deck + 0.5)) < 0.02 || Math.abs(y - (deck + 0.02)) < 0.02)
        return lit(brass, c);
      return lit(col, c);
    },
  });
  k.add(k.box(tx1 - tx0 + 0.04, 0.08, 1.04), {
    pos: [(tx0 + tx1) / 2, deck - 0.1, 0],
    ...P,
    color: (c) => lit(black, c),
  });
  k.add(k.ellipsoid((tx1 - tx0) / 2 - 0.05, 0.2, 0.46), {
    pos: [(tx0 + tx1) / 2, deck + 0.6, 0],
    flat: 0.4,
    color: (c) =>
      c.n[1] < 0
        ? null
        : shade("#1c1c1f", 0.7 + 0.8 * Math.abs(c.noise(c.p[0] * 30, c.p[1] * 30, c.p[2] * 30))),
  });
  // Smoke puffs from the chimney trail back as the train runs.
  plume(k, [2.1, by + 0.95, 0], [-1.7, 1.1, 0], {
    share: 0.04,
    spread: 0.1,
    grow: 3.2,
    color: "#f4f2ee",
    dark: "#9a9692",
    opacity: 0.32,
    height: 0.45,
  });
  // A burst of steam from the whistle when it toots.
  const steam = k.part("steam", { pivot: [0.35, by + 0.62, 0] });
  plume(k, [0.35, by + 0.62, 0], [-0.3, 0.5, 0], {
    share: 0.012,
    spread: 0.05,
    grow: 2,
    color: "#ffffff",
    dark: "#dfe6ea",
    opacity: 0.55,
    height: 0.35,
    part: steam,
  });
  k.reach([0.6, 3.1, 0]);
}

// ---- Ocean liner ----------------------------------------------------------------------

const LINER = {
  L: 6.2,
  B: 0.86,
  D: 0.78,
  water: -0.56,
  centre: [0, -0.4, 0],
  horn: [1.05, 1.6, 0],
};

// Half-beam of a hull at u (0 stern .. 1 bow).
function hullBeam(u, B, bow = 0.24, stern = 0.1) {
  if (u > 1 - bow) {
    const t = (u - (1 - bow)) / bow;
    return (B / 2) * (1 - t * t);
  }
  if (u < stern) {
    const t = (stern - u) / stern;
    return (B / 2) * Math.sqrt(Math.max(0, 1 - t * t));
  }
  return B / 2;
}

function hull(k, { L, B, D, bow, stern, boxy = 0.28, sheer = 0.06, rise = 0.35 }, opts) {
  const x = (u) => (u - 0.5) * L;
  const top = (u) => sheer * (smoothstep(0.6, 1, u) * 1.6 + smoothstep(0.35, 0, u) * 0.6);
  const depth = (u) => D * (1 - rise * smoothstep(0.82, 1, u) - 0.25 * smoothstep(0.12, 0, u));
  const sp = (s, e) => Math.sign(s) * Math.pow(Math.abs(s), e);
  const side = k.param(
    (u, v) => {
      const b = hullBeam(u, B, bow, stern);
      const a = v * Math.PI;
      return [x(u), top(u) - depth(u) * sp(Math.sin(a), boxy), b * sp(Math.cos(a), boxy)];
    },
    { grid: 96, flip: true },
  );
  k.add(side, opts.side);
  const deck = k.param((u, v) => [x(u), top(u), (2 * v - 1) * hullBeam(u, B, bow, stern)], {
    grid: 48,
    normal: () => [0, 1, 0],
  });
  k.add(deck, opts.deck);
  return { top };
}

function linerBuild(k, o) {
  const { L, B, D } = LINER;
  const ship = k.part("ship", { pivot: LINER.centre });
  const S = { part: ship, flat: 0.2 };
  const wl = LINER.water;
  const { top } = hull(
    k,
    { L, B, D, bow: 0.2, stern: 0.09, boxy: 0.22, sheer: 0.05, rise: 0.3 },
    {
      side: {
        ...S,
        interior: 0.04,
        core: "#222",
        color: (c) => {
          const [x, y] = c.p;
          if (y < wl + 0.04) return lit("#9b2b22", c);
          if (y > -0.08) return lit("#f2efe6", c);
          if (Math.abs(y + 0.11) < 0.012) return keep(lit("#d6ad4c", c));
          for (const yy of [-0.22, -0.33])
            if (
              Math.abs(y - yy) < 0.017 &&
              Math.abs(((x * 12.5) % 1) - 0.5) < 0.2 &&
              Math.abs(c.n[2]) > 0.5
            )
              return keep("#fff1b8");
          return lit("#1c1c20", c);
        },
      },
      deck: { ...S, color: (c) => lit(shade("#c9a36b", 0.9 + 0.1 * Math.sin(c.p[2] * 90)), c) },
    },
  );
  // The superstructure: white decks stepping up, with rows of windows.
  const white = "#f4f2ec";
  const windows = (x0, x1, h, rows) => (c) => {
    const [x, y] = c.p;
    const f = c.s.face;
    if (f === 4 || f === 5) {
      const fy = (y - h.y0) / h.h;
      for (const r of rows)
        if (
          Math.abs(fy - r) < 0.13 &&
          Math.abs(((x * 9) % 1) - 0.5) < 0.3 &&
          x > x0 + 0.06 &&
          x < x1 - 0.06
        )
          return keep(shade("#27313d", 0.9 + 0.3 * r));
    }
    if (f === 0 && y > h.y0 + h.h * 0.35 && y < h.y0 + h.h * 0.75) {
      const z = c.p[2];
      if (Math.abs(((z * 7) % 1) - 0.5) < 0.32) return keep("#27313d");
    }
    return lit(white, c);
  };
  const tiers = [
    { x0: -2.1, x1: 1.9, w: 0.74, y0: 0.0, h: 0.28 },
    { x0: -1.95, x1: 1.72, w: 0.7, y0: 0.28, h: 0.24 },
    { x0: -1.6, x1: 1.45, w: 0.62, y0: 0.52, h: 0.2 },
  ];
  for (const t of tiers)
    k.add(k.box(t.x1 - t.x0, t.h, t.w), {
      ...S,
      pos: [(t.x0 + t.x1) / 2, t.y0 + t.h / 2 + top(0.5), 0],
      color: windows(t.x0, t.x1, { y0: t.y0 + top(0.5), h: t.h }, [0.5]),
    });
  // The bridge.
  k.add(k.box(0.3, 0.16, 0.78), {
    ...S,
    pos: [1.55, 0.8, 0],
    color: (c) => (c.s.face === 0 && c.p[1] > 0.8 ? keep("#27313d") : lit(white, c)),
  });
  const deckTop = 0.72 + top(0.5);
  // Lifeboats along the top deck.
  for (const z of [-0.33, 0.33])
    for (let i = 0; i < 8; i++) {
      const x = -1.45 + i * 0.36;
      if (Math.abs(x - 0.02) < 0.1) continue;
      k.add(k.ellipsoid(0.12, 0.045, 0.05), {
        ...S,
        pos: [x, deckTop + 0.05, z],
        weight: 1.5,
        color: (c) => lit(c.p[1] > deckTop + 0.06 ? "#f7f5ef" : "#d8d2c4", c),
      });
    }
  // Four funnels, raked back, red with black tops.
  const fcol = o.funnel;
  const funnelX = [1.05, 0.28, -0.5, -1.27];
  const fh = 0.88;
  const rake = 8;
  const rk = (rake * Math.PI) / 180;
  funnelX.forEach((fx) => {
    k.add(k.cylinder(0.17, fh), {
      ...S,
      pos: [fx - Math.sin(rk) * fh * 0.5, deckTop + fh / 2 - 0.05, 0],
      rot: [0, 0, rake],
      scale: [1, 1, 0.8],
      color: (c) => {
        if (c.s.cap === "top") return keep("#0d0d0e");
        const hh = c.lp[1] / fh + 0.5;
        if (hh > 0.8) return lit("#141416", c);
        if (Math.abs(hh - 0.78) < 0.015) return lit("#141416", c);
        return lit(fcol, c);
      },
    });
  });
  // Masts and rigging.
  const mastF = [2.35, deckTop + 1.15, 0];
  const mastA = [-2.35, deckTop + 1.0, 0];
  for (const m of [mastF, mastA])
    rod(k, [m[0], top(0.5) + 0.02, 0], m, 0.022, { ...S, weight: 2, color: "#8a6a45" }, 0.014);
  const bowTip = [L / 2 - 0.02, top(1), 0];
  const sternTip = [-L / 2 + 0.05, top(0), 0];
  for (const [a, b] of [
    [mastF, bowTip],
    [mastF, mastA],
    [mastA, sternTip],
  ])
    rod(k, a, b, 0.006, { ...S, weight: 3, color: "#4a4a4a" });
  // Smoke drifting aft from the first three funnels.
  for (const fx of funnelX.slice(0, 3)) {
    const topP = [fx - Math.sin(rk) * fh - 0.02, deckTop + fh - 0.02, 0];
    plume(k, topP, [-0.9, 0.45, 0], {
      share: 0.014,
      spread: 0.06,
      grow: 2.5,
      size: 2,
      color: "#ebe8e3",
      dark: "#8d8984",
      opacity: 0.26,
      height: 0.35,
      part: ship,
    });
  }
  // A blast of steam from the whistles when the horn sounds.
  const horn = k.part("horn", { pivot: LINER.horn });
  for (const fx of funnelX.slice(0, 2))
    plume(k, [fx - 0.1, deckTop + fh * 0.9, 0.05], [0.1, 0.45, 0], {
      share: 0.006,
      spread: 0.04,
      grow: 2,
      color: "#ffffff",
      dark: "#e3e8ea",
      opacity: 0.6,
      height: 0.3,
      part: horn,
    });
  // The sea: a patch of rippling water with a bow wave and a wake.
  water(k, wl, L / 2 + 0.55, 1.5, {
    share: 0.2,
    deep: "#1b4f7a",
    light: "#4e9cc7",
    foam: (x, z) => {
      const u = x / L + 0.5;
      if (u < -0.15 || u > 1.08) return 0;
      const b = hullBeam(clamp(u, 0, 1), B, 0.2, 0.09);
      const d = Math.abs(z) - b;
      const bow = smoothstep(0.7, 0.98, u) * 0.9;
      const wake = smoothstep(0.1, -0.12, u) * smoothstep(0.35, 0, Math.abs(z)) * 0.8;
      return Math.max(smoothstep(0.1, 0, d) * (0.55 + bow), wake);
    },
  });
  k.reach([0, 2.2, 0]);
}

// ---- Road vehicles ----------------------------------------------------------------------

// A smooth 1D curve through [x, y] points (x ascending), for body lines.
function curve(points) {
  return (x) => {
    if (x <= points[0][0]) return points[0][1];
    for (let i = 1; i < points.length; i++) {
      const [x1, y1] = points[i];
      if (x <= x1) {
        const [x0, y0] = points[i - 1];
        const t = (x - x0) / (x1 - x0);
        return y0 + (y1 - y0) * t * t * (3 - 2 * t);
      }
    }
    return points[points.length - 1][1];
  };
}
const spow = (s, e) => Math.sign(s) * Math.pow(Math.abs(s), e);

// A closed car-body shell along X: top(x) and bottom(x) lines, half-width
// w(x), rounded box sections, rounded ends.
function shell(k, x0, x1, top, bottom, width, { e = 0.5, end = 6, grid = 96 } = {}) {
  return k.param(
    (u, v) => {
      const x = x0 + (x1 - x0) * u;
      const cl = Math.pow(Math.max(0, 1 - Math.pow(Math.abs(2 * u - 1), end)), 1 / end);
      const T = top(x);
      const B = bottom(x);
      const yc = (T + B) / 2;
      const hh = ((T - B) / 2) * Math.pow(cl, 0.35);
      const ww = width(x) * cl;
      const a = v * TAU;
      return [x, yc + hh * spow(Math.sin(a), e), ww * spow(Math.cos(a), e)];
    },
    { grid, flip: false },
  );
}

const CAR = { front: [0.74, 0.26, 0], rear: [-0.74, 0.26, 0], r: 0.26 };

function carBuild(k, o) {
  const col = o.color;
  const hl = 1.18;
  const top = curve([
    [-hl, 0.56],
    [-1.02, 0.66],
    [-0.6, 0.66],
    [0.3, 0.58],
    [0.85, 0.47],
    [hl, 0.38],
  ]);
  const bottom = () => 0.15;
  const width = curve([
    [-hl, 0.5],
    [-0.75, 0.585],
    [-0.2, 0.56],
    [0.6, 0.55],
    [hl, 0.44],
  ]);
  const stripe = (c) => o.stripes && Math.abs(Math.abs(c.p[2]) - 0.085) < 0.045 && c.n[1] > 0.2;
  k.add(shell(k, -hl, hl, top, bottom, width, { e: 0.62, end: 4 }), {
    flat: 0.2,
    interior: 0.06,
    core: "#333",
    color: (c) => {
      const [x, y, z] = c.p;
      for (const w of [CAR.front, CAR.rear])
        if (Math.hypot(x - w[0], y - w[1]) < CAR.r + 0.035 && Math.abs(c.n[2]) > 0.5)
          return keep("#0f0f10");
      if (x > 1.07 && y < 0.3 && Math.abs(z) < 0.3)
        return keep(Math.sin(y * 160) > 0 ? "#1a1a1c" : "#3a3a3e");
      if (x < -1.08 && y > 0.4 && y < 0.54 && Math.abs(z) > 0.2) return keep("#d8202a");
      if (stripe(c)) return keep(lit("#f5f5f2", c));
      if (y < 0.2) return lit(shade(col, 0.55), c);
      if (
        Math.abs(c.n[2]) > 0.6 &&
        (Math.abs(x - 0.36) < 0.008 || Math.abs(x + 0.28) < 0.008) &&
        y > 0.24
      )
        return keep(shade(col, 0.5));
      return lit(col, c);
    },
  });
  // The cabin: a low glass canopy with a roof in body colour.
  const cx0 = -0.86;
  const cx1 = 0.45;
  const cabin = k.param(
    (u, v) => {
      const x = cx0 + (cx1 - cx0) * u;
      const h = 0.31 * smoothstep(0, 0.6, u) * smoothstep(1, 0.72, u);
      const a = v * Math.PI;
      const s = Math.sin(a);
      const w = (0.47 - 0.13 * s) * Math.pow(smoothstep(0, 0.12, u) * smoothstep(1, 0.9, u), 0.3);
      return [x, top(x) - 0.03 + h * Math.pow(s, 0.55), w * Math.cos(a)];
    },
    { grid: 72 },
  );
  k.add(cabin, {
    flat: 0.2,
    color: (c) => {
      const s = Math.sin(c.v * Math.PI);
      const cz = Math.cos(c.v * Math.PI);
      const u = c.u;
      if (stripe(c) && s > 0.9) return keep(lit("#f5f5f2", c));
      if (s > 0.93 && u > 0.2 && u < 0.78) return lit(col, c);
      const side = s > 0.2 && s < 0.9 && u > 0.2 && u < 0.83 && Math.abs(u - 0.52) > 0.025;
      const front = u > 0.8 && Math.abs(cz) < 0.8 && s > 0.2;
      const back = u < 0.26 && Math.abs(cz) < 0.72 && s > 0.25;
      if (side || front || back) return glass(c, "#1b2a3d");
      return lit(col, c);
    },
  });
  // Headlights, spoiler, mirrors and exhausts.
  for (const z of [-0.29, 0.29])
    k.add(k.ellipsoid(0.05, 0.035, 0.09), {
      pos: [1.1, 0.4, z],
      rot: [0, 0, -30],
      weight: 3,
      pattern: false,
      color: (c) => mix("#fff6d6", "#ffffff", smoothstep(0, 1, c.n[1])),
    });
  slab(
    k,
    [
      [-1.2, 0.8, -0.5],
      [-0.98, 0.8, -0.5],
      [-0.98, 0.8, 0.5],
      [-1.2, 0.8, 0.5],
    ],
    0.035,
    { flat: 0.2, weight: 1.4, color: (c) => lit(shade(col, 0.9), c) },
  );
  for (const z of [-0.32, 0.32])
    k.add(k.box(0.06, 0.2, 0.03), {
      pos: [-1.08, 0.7, z],
      flat: 0.2,
      color: (c) => lit("#2a2a2c", c),
    });
  for (const z of [-0.5, 0.5])
    k.add(k.ellipsoid(0.06, 0.035, 0.04), {
      pos: [0.36, 0.6, z * 1.04],
      weight: 2,
      color: (c) => lit(col, c),
    });
  for (const z of [-0.2, 0.2])
    k.add(k.cylinder(0.045, 0.12), {
      pos: [-1.18, 0.2, z],
      rot: [0, 0, 90],
      weight: 2,
      color: (c) => (c.s.cap ? "#111" : lit("#c9ccd1", c)),
    });
  // Wheels.
  for (const [name, w] of [
    ["front", CAR.front],
    ["rear", CAR.rear],
  ]) {
    const part = k.part(name, { pivot: w, axis: [0, 0, 1] });
    for (const z of [-0.5, 0.5])
      wheel(k, [w[0], w[1], z], CAR.r, 0.22, { part, rim: "#d9dadd", hub: "#8e9096", spokes: 5 });
  }
  const puff = k.part("puff", { pivot: [-1.25, 0.2, 0] });
  for (const z of [-0.2, 0.2])
    plume(k, [-1.3, 0.2, z], [-0.55, 0.25, 0], {
      share: 0.008,
      spread: 0.05,
      grow: 2.5,
      opacity: 0.4,
      height: 0.25,
      part: puff,
    });
  shadow(k, 0.004, 1.35, 0.75);
}

// ---- Bus -------------------------------------------------------------------------------

const BUS = {
  school: { front: [1.3, 0.3, 0], rear: [-0.95, 0.3, 0] },
  double: { front: [0.98, 0.3, 0], rear: [-0.95, 0.3, 0] },
};

function busBuild(k, o) {
  const P = { flat: 0.2 };
  const dark = "#111214";
  const isSchool = o.style !== "double";
  const W = BUS[isSchool ? "school" : "double"];
  if (isSchool) {
    const yellow = "#f5b400";
    const x0 = -1.72;
    const x1 = 1.0;
    k.add(roundBox(x1 - x0, 1.22, 1.04, 0.16), {
      ...P,
      pos: [(x0 + x1) / 2, 0.92, 0],
      interior: 0.05,
      core: "#444",
      color: (c) => {
        const [x, y, z] = c.p;
        const n = c.n;
        if (Math.abs(n[2]) > 0.7) {
          if (z > 0 && x > 0.52 && x < 0.94 && y > 0.4 && y < 1.36) {
            if (Math.abs(x - 0.73) < 0.02 || y < 0.44 || y > 1.33 || x < 0.55 || x > 0.91)
              return keep(dark);
            return glass(c, "#223344");
          }
          if (y > 1.0 && y < 1.33 && x > -1.6 && x < 0.46) {
            const f = (x + 1.6) / 0.31;
            if (f % 1 > 0.12) return glass(c, "#223344");
            return lit(yellow, c);
          }
          if (
            Math.abs(y - 0.62) < 0.022 ||
            Math.abs(y - 0.84) < 0.022 ||
            Math.abs(y - 0.975) < 0.012
          )
            return keep(lit(dark, c));
        }
        if (n[0] > 0.7 && y > 0.98 && y < 1.4 && Math.abs(z) < 0.46)
          return Math.abs(z) < 0.02 ? keep(dark) : glass(c, "#223344");
        if (n[0] < -0.7 && y > 0.95 && y < 1.32 && Math.abs(z) < 0.22) return glass(c, "#223344");
        if (y < 0.36) return lit(dark, c);
        return lit(yellow, c);
      },
    });
    // The bonnet, grille, lights and bumpers.
    k.add(roundBox(0.72, 0.6, 0.92, 0.096), {
      ...P,
      pos: [1.33, 0.64, 0],
      color: (c) => {
        const [x, y, z] = c.p;
        if (c.n[0] > 0.7 && Math.abs(z) < 0.28 && y > 0.42 && y < 0.86)
          return keep(Math.sin(y * 120) > 0 ? "#d8dade" : "#3a3b3f");
        return lit(yellow, c);
      },
    });
    for (const z of [-0.36, 0.36])
      k.add(k.sphere(0.07), { pos: [1.68, 0.74, z], weight: 3, pattern: false, color: "#fff8d8" });
    for (const x of [1.74, -1.76])
      k.add(k.box(0.08, 0.13, 1.04), { ...P, pos: [x, 0.38, 0], color: (c) => lit(dark, c) });
    // Warning lights on the roof corners.
    for (const x of [0.96, -1.66])
      for (const z of [-0.34, 0.34])
        k.add(k.sphere(0.05), {
          pos: [x, 1.5, z],
          weight: 4,
          pattern: false,
          kind: "twinkle",
          params: [0.5, x > 0 ? 0 : 3],
          color: Math.abs(z) > 0.3 && x > 0 ? "#ff3b2f" : "#ffb300",
        });
    for (const z of [-0.6, 0.6])
      rod(k, [0.98, 1.2, z * 0.85], [1.08, 1.2, z], 0.012, { weight: 3, color: dark });
    for (const z of [-0.6, 0.6])
      k.add(k.box(0.04, 0.16, 0.08), { pos: [1.08, 1.2, z], color: dark });
  } else {
    const red = "#cc2229";
    const x0 = -1.55;
    const x1 = 1.55;
    k.add(roundBox(x1 - x0, 1.85, 0.98, 0.16), {
      ...P,
      pos: [0, 1.23, 0],
      interior: 0.05,
      core: "#444",
      color: (c) => {
        const [x, y, z] = c.p;
        const n = c.n;
        const row = (y > 0.8 && y < 1.18) || (y > 1.5 && y < 1.92);
        if (Math.abs(n[2]) > 0.7) {
          if (row && x > -1.42 && x < 1.3) {
            const f = (x + 1.42) / 0.34;
            if (f % 1 > 0.1) return glass(c, "#223344");
          }
          if (y > 1.24 && y < 1.34) return lit("#f1e6c8", c);
        }
        if (n[0] > 0.7) {
          if (y > 1.5 && y < 1.92 && Math.abs(z) > 0.03 && Math.abs(z) < 0.44)
            return glass(c, "#223344");
          if (y > 0.8 && y < 1.2 && Math.abs(z) < 0.44) return glass(c, "#223344");
          if (y > 1.25 && y < 1.4 && Math.abs(z) < 0.3)
            return keep(Math.abs(y - 1.325) < 0.02 && Math.abs(z) < 0.22 ? "#ffd84a" : "#141414");
          if (y > 0.4 && y < 0.7 && Math.abs(z) < 0.26)
            return keep(Math.sin(y * 120) > 0 ? "#d8dade" : "#3a3b3f");
        }
        if (y < 0.4) return lit(shade(red, 0.5), c);
        return lit(red, c);
      },
    });
    for (const z of [-0.36, 0.36])
      k.add(k.sphere(0.065), { pos: [1.55, 0.55, z], weight: 3, pattern: false, color: "#fff8d8" });
    for (const x of [1.58, -1.58])
      k.add(k.box(0.06, 0.12, 0.98), { ...P, pos: [x, 0.36, 0], color: (c) => lit(dark, c) });
  }
  for (const [name, w] of [
    ["front", W.front],
    ["rear", W.rear],
  ]) {
    const part = k.part(name, { pivot: w, axis: [0, 0, 1] });
    for (const z of [-0.47, 0.47])
      wheel(k, [w[0], w[1], z], 0.3, 0.22, { part, rim: "#3b3c40", hub: "#d3d5d9", spokes: 0 });
  }
  shadow(k, 0.004, isSchool ? 1.95 : 1.75, 0.72);
}

// ---- Biplane --------------------------------------------------------------------------

const PLANE = { prop: [1.2, 0, 0] };

function planeBuild(k, o) {
  const col = o.color;
  const wing = o.wings;
  const wood = "#6b4a2b";
  // The fuselage: a lathe turned to lie along X.
  const fus = k.lathe(
    [
      [0.03, -1.8],
      [0.1, -1.6],
      [0.17, -1.0],
      [0.26, -0.3],
      [0.31, 0.3],
      [0.32, 0.75],
      [0.3, 1.0],
      [0.27, 1.12],
    ],
    { grid: 72 },
  );
  k.add(fus, {
    rot: [0, 0, -90],
    flat: 0.2,
    interior: 0.05,
    core: "#555",
    color: (c) => {
      const [x, y, z] = c.p;
      if (x > 0.84) return lit(Math.abs(x - 0.86) < 0.02 ? "#7b7d82" : "#c9ccd1", c);
      if (y > 0.18 && Math.hypot((x + 0.2) / 0.19, z / 0.17) < 1) return keep("#1a1411");
      if (Math.abs(x + 0.9) < 0.05) return lit("#f5f1e6", c);
      return lit(col, c);
    },
  });
  k.add(k.cylinder(0.25, 0.04), {
    pos: [1.13, 0, 0],
    rot: [0, 0, 90],
    color: (c) => (c.s.radial > 0.8 ? "#9a9da3" : "#2a2a2c"),
  });
  // The pilot, with goggles and a scarf that flutters.
  k.add(k.sphere(0.1), { pos: [-0.2, 0.36, 0], weight: 2, color: (c) => lit("#6d4c33", c) });
  for (const z of [-0.045, 0.045])
    k.add(k.sphere(0.035), { pos: [-0.12, 0.38, z], weight: 4, pattern: false, color: "#9fd8ff" });
  k.add(
    k.tube(
      (t) => [-0.28 - 0.5 * t, 0.29 + 0.05 * Math.sin(t * 4), 0.03 * Math.sin(t * 7)],
      (t) => 0.035 * (1 - 0.5 * t),
    ),
    { weight: 2, kind: "sway", params: [0.4, 0.28], color: (c) => lit("#f4f1ea", c) },
  );
  slab(
    k,
    [
      [0.02, 0.26, -0.13],
      [0.02, 0.26, 0.13],
      [-0.04, 0.42, 0.11],
      [-0.04, 0.42, -0.11],
    ],
    0.01,
    { color: (c) => glass(c, "#5d7d99"), opacity: 0.7 },
  );
  // Two wings on struts.
  const wingColor = (c) => {
    const z = Math.abs(c.p[2]);
    if (z > 1.38) return lit(col, c);
    if (Math.abs(((z * 4) % 1) - 0.5) > 0.47) return keep(lit(shade(wing, 0.85), c));
    return lit(wing, c);
  };
  k.add(roundBox(0.62, 0.07, 3.1, 0.021), { pos: [0.3, -0.2, 0], flat: 0.2, color: wingColor });
  k.add(roundBox(0.62, 0.07, 3.3, 0.021), { pos: [0.45, 0.62, 0], flat: 0.2, color: wingColor });
  const strut = { weight: 2.5, color: (c) => lit(wood, c) };
  for (const s of [-1, 1]) {
    const z = 1.15 * s;
    rod(k, [0.16, -0.17, z], [0.3, 0.59, z], 0.022, strut);
    rod(k, [0.52, -0.17, z], [0.66, 0.59, z], 0.022, strut);
    rod(k, [0.26, 0.28, 0.12 * s], [0.34, 0.59, 0.3 * s], 0.018, strut);
    rod(k, [0.56, 0.28, 0.12 * s], [0.64, 0.59, 0.3 * s], 0.018, strut);
    // Rigging wires.
    rod(k, [0.25, -0.17, 0.3 * s], [0.3, 0.59, z], 0.005, { weight: 4, color: "#3a3a3a" });
    rod(k, [0.25, 0.59, 0.3 * s], [0.2, -0.17, z], 0.005, { weight: 4, color: "#3a3a3a" });
  }
  // Tail.
  k.add(roundBox(0.45, 0.04, 1.15, 0.012), { pos: [-1.55, 0.06, 0], flat: 0.2, color: wingColor });
  slab(
    k,
    [
      [-1.3, 0.1, 0],
      [-1.84, 0.06, 0],
      [-1.87, 0.62, 0],
      [-1.62, 0.6, 0],
    ],
    0.04,
    { flat: 0.2, color: (c) => lit(c.p[0] < -1.74 ? "#f5f1e6" : col, c) },
  );
  // Landing gear.
  for (const s of [-1, 1]) {
    const ax = [0.55, -0.72, 0.33 * s];
    rod(k, [0.38, -0.26, 0.1 * s], ax, 0.02, { weight: 2.5, color: "#2f2f31" });
    rod(k, [0.74, -0.26, 0.1 * s], ax, 0.02, { weight: 2.5, color: "#2f2f31" });
    wheel(k, [0.55, -0.72, 0.39 * s], 0.17, 0.08, { rim: "#e6e1d6", hub: "#9a9a96", spokes: 0 });
  }
  rod(k, [0.55, -0.72, -0.35], [0.55, -0.72, 0.35], 0.015, { weight: 3, color: "#2f2f31" });
  rod(k, [-1.6, -0.08, 0], [-1.72, -0.22, 0], 0.015, { weight: 3, color: "#2f2f31" });
  // The propeller and spinner.
  const prop = k.part("prop", { pivot: PLANE.prop, axis: [1, 0, 0] });
  k.add(k.cone(0.11, 0.0, 0.22), {
    part: prop,
    pos: [1.28, 0, 0],
    rot: [0, 0, -90],
    color: (c) => lit(col, c),
  });
  for (const s of [-1, 1])
    k.add(roundBox(0.04, 0.62, 0.1, 0.018), {
      part: prop,
      pos: add(PLANE.prop, [0, s * 0.33, 0]),
      rot: [s * 12, 0, 0],
      weight: 2,
      color: (c) => (Math.abs(c.p[1]) > 0.56 ? keep("#e8c93a") : lit(wood, c)),
    });
}

// ---- Jet -------------------------------------------------------------------------------

function jetBuild(k, o) {
  const tail = o.color;
  const white = "#f6f7f9";
  const fus = k.lathe(
    [
      [0.02, -2.15],
      [0.1, -2.05],
      [0.18, -1.7],
      [0.26, -1.15],
      [0.285, -0.6],
      [0.29, 0.5],
      [0.285, 1.3],
      [0.25, 1.7],
      [0.17, 1.95],
      [0.06, 2.1],
      [0.0, 2.13],
    ],
    { grid: 80 },
  );
  k.add(fus, {
    rot: [0, 0, -90],
    flat: 0.2,
    interior: 0.05,
    core: "#777",
    color: (c) => {
      const [x, y] = c.p;
      const side = Math.abs(c.n[2]) > 0.55;
      if (x > 1.7 && x < 1.93 && y > 0.04 && y < 0.14 && side) return keep("#1f2833");
      if (
        side &&
        y > 0.02 &&
        y < 0.075 &&
        x > -1.45 &&
        x < 1.5 &&
        Math.abs(((x * 9) % 1) - 0.5) < 0.2
      )
        return keep("#27313d");
      if (side && Math.abs(x - 1.58) < 0.06 && y > -0.08 && y < 0.12)
        return keep(shade(white, 0.8));
      if (y > -0.075 && y < -0.035 && x < 1.75) return lit(tail, c);
      if (c.n[1] < -0.35) return lit("#c9ced6", c);
      return lit(white, c);
    },
  });
  const grey = (c) => lit("#dfe3e8", c, 0.66);
  for (const s of [-1, 1]) {
    // Wings with a little dihedral, winglets in the tail colour.
    slab(
      k,
      [
        [0.55, -0.12, 0.2 * s],
        [-0.55, -0.12, 0.2 * s],
        [-1.05, 0.06, 2.25 * s],
        [-0.75, 0.06, 2.25 * s],
      ],
      0.07,
      { flat: 0.2, color: grey },
    );
    slab(
      k,
      [
        [-0.76, 0.06, 2.25 * s],
        [-1.06, 0.06, 2.25 * s],
        [-1.12, 0.36, 2.31 * s],
        [-0.97, 0.36, 2.31 * s],
      ],
      0.035,
      { flat: 0.2, weight: 1.4, color: (c) => lit(tail, c) },
    );
    // Tailplane.
    slab(
      k,
      [
        [-1.5, 0.1, 0.1 * s],
        [-2.0, 0.1, 0.1 * s],
        [-2.16, 0.15, 0.86 * s],
        [-1.98, 0.15, 0.86 * s],
      ],
      0.045,
      { flat: 0.2, color: grey },
    );
    // Engines on pylons.
    const e = [0.18, -0.42, 0.88 * s];
    k.add(k.cylinder(0.16, 0.66, { caps: false }), {
      pos: e,
      rot: [0, 0, -90],
      flat: 0.2,
      color: (c) => lit(c.p[0] > 0.45 ? "#c9ccd1" : white, c),
    });
    k.add(k.disc(0.155), { pos: add(e, [0.33, 0, 0]), rot: [0, 0, -90], color: "#1d1f24" });
    k.add(k.cone(0.06, 0.0, 0.1), {
      pos: add(e, [0.36, 0, 0]),
      rot: [0, 0, -90],
      weight: 3,
      color: "#b9bcc2",
    });
    k.add(k.cone(0.12, 0.08, 0.14, { caps: false }), {
      pos: add(e, [-0.39, 0, 0]),
      rot: [0, 0, 90],
      color: "#6d7078",
    });
    slab(
      k,
      [
        [0.3, -0.28, 0.88 * s],
        [-0.25, -0.28, 0.88 * s],
        [-0.3, -0.07, 0.88 * s],
        [0.1, -0.07, 0.88 * s],
      ],
      0.05,
      { flat: 0.2, color: grey },
    );
  }
  // The fin in the tail colour with a light band.
  slab(
    k,
    [
      [-1.3, 0.2, 0],
      [-2.12, 0.2, 0],
      [-2.24, 1.08, 0],
      [-1.95, 1.08, 0],
    ],
    0.06,
    {
      flat: 0.2,
      color: (c) => {
        const t = (c.p[1] - 0.2) / 0.88;
        const band = Math.abs(c.p[0] + 1.75 + t * 0.45 - 0.2) < 0.05;
        return lit(band ? "#f6f7f9" : tail, c, 0.66);
      },
    },
  );
}

// ---- Sailboat -----------------------------------------------------------------------------

const BOAT = { centre: [0, -0.2, 0] };

function sailboatBuild(k, o) {
  const boat = k.part("boat", { pivot: BOAT.centre });
  const S = { part: boat, flat: 0.2 };
  const wl = -0.3;
  const H = { L: 2.6, B: 0.95, D: 0.5, bow: 0.42, stern: 0.14, boxy: 0.75, sheer: 0.08, rise: 0.3 };
  const { top } = hull(k, H, {
    side: {
      ...S,
      interior: 0.05,
      core: "#555",
      color: (c) => {
        const y = c.p[1];
        if (y < wl + 0.04) return lit("#b33a2e", c);
        if (Math.abs(y + 0.1) < 0.035) return lit(o.stripe, c);
        return lit("#f7f6f1", c);
      },
    },
    deck: { ...S, color: (c) => lit(shade("#c09160", 0.9 + 0.12 * Math.sin(c.p[2] * 70)), c) },
  });
  // A little cabin with portholes, and a lifebuoy.
  k.add(roundBox(0.85, 0.24, 0.56, 0.072), {
    ...S,
    pos: [-0.1, top(0.45) + 0.1, 0],
    color: (c) => {
      if (Math.abs(c.n[2]) > 0.6 && Math.abs(c.p[1] - (top(0.45) + 0.12)) < 0.045) {
        const f = (c.p[0] + 0.5) / 0.25;
        if (Math.abs((f % 1) - 0.5) < 0.2) return keep("#23303d");
      }
      return lit("#f7f6f1", c);
    },
  });
  k.add(k.torus(0.1, 0.03), {
    ...S,
    pos: [-0.72, top(0.2) + 0.2, 0.43],
    rot: [90, 0, 0],
    weight: 2,
    color: (c) => ((c.u * 4) % 1 < 0.5 ? "#e33b2f" : "#f7f6f1"),
  });
  // Mast, boom and stays.
  const mx = 0.3;
  const mTop = 3.3;
  rod(k, [mx, 0, 0], [mx, mTop, 0], 0.035, { ...S, weight: 1.6, color: "#d9d6cf" }, 0.022);
  rod(k, [mx, 0.62, 0], [-1.08, 0.66, 0], 0.024, { ...S, weight: 1.6, color: "#c09160" });
  rod(k, [1.28, top(1), 0], [mx, 2.85, 0], 0.006, { ...S, weight: 4, color: "#555" });
  rod(k, [-1.25, top(0), 0], [mx, mTop - 0.05, 0], 0.006, { ...S, weight: 4, color: "#555" });
  // Sails, filled with wind towards the viewer.
  const sailColor = (c) => {
    const y = c.p[1];
    const seam = Math.abs(((y - 0.6) / 0.34) % 1) < 0.03;
    const f = 0.8 + 0.22 * Math.abs(c.n[2]) + 0.05 * c.n[1];
    const base = shade(o.sails, f);
    return seam ? keep(shade(base, 0.9)) : base;
  };
  const main = k.param(
    (u, v) => {
      const luff = [mx - 0.03, 0.7 + 2.5 * v, 0];
      const leech = [-1.02 + 1.3 * v, 0.72 + 2.48 * v, 0];
      const p = lerp3(luff, leech, u);
      p[2] += 0.26 * Math.sin(Math.PI * u) * (1 - 0.75 * v);
      return p;
    },
    { grid: 48, thick: 0.01 },
  );
  k.add(main, { ...S, color: sailColor });
  const tack = [1.22, top(1) + 0.05, 0];
  const head = [mx + 0.05, 2.8, 0];
  const clew = [-0.1, 0.62, 0.3];
  const jib = k.param(
    (u, v) => {
      const a = lerp3(tack, head, v);
      const p = lerp3(a, clew, u * (1 - v));
      p[2] += 0.12 * Math.sin(Math.PI * u) * (1 - v);
      return p;
    },
    { grid: 40, thick: 0.01 },
  );
  k.add(jib, { ...S, color: sailColor });
  // A pennant at the masthead.
  k.add(
    quad(
      k,
      [mx, mTop - 0.02, 0],
      [mx, mTop - 0.14, 0],
      [mx - 0.4, mTop - 0.08, 0],
      [mx - 0.4, mTop - 0.08, 0],
    ),
    {
      ...S,
      weight: 2,
      kind: "sway",
      params: [0.6, mTop - 0.3],
      color: o.stripe,
    },
  );
  water(k, wl, 2.0, 1.45, {
    share: 0.22,
    deep: "#1c6a8f",
    light: "#63b7d9",
    foam: (x, z) => {
      const u = x / H.L + 0.5;
      if (u < -0.1 || u > 1.06) return 0;
      const b = hullBeam(clamp(u, 0, 1), H.B, H.bow, H.stern);
      const d = Math.abs(z) - b;
      return smoothstep(0.08, 0, d) * (0.5 + 0.6 * smoothstep(0.75, 1, u));
    },
  });
}

// ---- Submarine ---------------------------------------------------------------------------

const SUB = { prop: [-1.62, 0, 0] };

function submarineBuild(k, o) {
  const col = o.color;
  const brass = "#caa04a";
  const prof = [
    [0.0, -1.55],
    [0.2, -1.42],
    [0.38, -1.05],
    [0.5, -0.45],
    [0.52, 0.25],
    [0.49, 0.85],
    [0.38, 1.25],
    [0.2, 1.48],
    [0.0, 1.55],
  ];
  k.add(k.lathe(prof, { grid: 80 }), {
    rot: [0, 0, -90],
    flat: 0.2,
    interior: 0.06,
    core: "#6d5a1a",
    color: (c) => {
      const x = c.p[0];
      if (Math.abs(x + 0.95) < 0.012 || Math.abs(x - 0.95) < 0.012)
        return keep(lit(shade(col, 0.65), c));
      for (const sx of [-0.95, 0.95])
        if (Math.abs(x - sx) < 0.05 && Math.abs(x - sx) > 0.03 && (c.u * 40) % 1 < 0.3)
          return keep(lit(shade(col, 0.72), c));
      return lit(col, c);
    },
  });
  // Portholes with brass rims.
  const rAt = curve(prof.map(([r, y]) => [y, r]));
  for (const px of [-0.55, 0, 0.55]) {
    const z = rAt(px) - 0.01;
    k.add(k.torus(0.13, 0.03), {
      pos: [px, 0.02, z],
      rot: [90, 0, 0],
      weight: 2,
      pattern: false,
      color: (c) => lit(brass, c),
    });
    k.add(k.disc(0.12), {
      pos: [px, 0.02, z - 0.005],
      rot: [90, 0, 0],
      weight: 2,
      pattern: false,
      color: (c) => {
        const d = Math.hypot(c.p[0] - px + 0.04, c.p[1] - 0.06);
        return mix("#0f3d5c", "#bde9ff", smoothstep(0.08, 0.0, d) * 0.9);
      },
    });
  }
  // The conning tower with its planes.
  k.add(roundBox(0.72, 0.46, 0.34, 0.102), {
    pos: [0.12, 0.62, 0],
    flat: 0.2,
    color: (c) => {
      if (Math.abs(c.n[2]) > 0.6 && Math.hypot(c.p[0] - 0.12, c.p[1] - 0.66) < 0.06)
        return keep("#16324a");
      return lit(col, c);
    },
  });
  for (const s of [-1, 1])
    slab(
      k,
      [
        [0.3, 0.66, 0.15 * s],
        [0.12, 0.66, 0.15 * s],
        [0.16, 0.66, 0.42 * s],
        [0.28, 0.66, 0.42 * s],
      ],
      0.03,
      { flat: 0.2, color: (c) => lit(shade(col, 0.9), c) },
    );
  // The periscope, which slides down into the tower.
  const scope = k.part("scope", { pivot: [0.3, 0.85, 0] });
  rod(k, [0.3, 0.7, 0], [0.3, 1.2, 0], 0.035, {
    part: scope,
    weight: 2,
    color: (c) => lit("#8d9096", c),
  });
  k.add(roundBox(0.16, 0.08, 0.08, 0.024), {
    part: scope,
    pos: [0.35, 1.22, 0],
    color: (c) => lit("#8d9096", c),
  });
  k.add(k.disc(0.03), {
    part: scope,
    pos: [0.435, 1.22, 0],
    rot: [0, 0, 90],
    weight: 4,
    pattern: false,
    color: "#9fe0ff",
  });
  // A lamp on the bow.
  k.add(k.sphere(0.07), { pos: [1.28, 0.32, 0], weight: 3, pattern: false, color: "#fff6c9" });
  k.add(k.cylinder(0.08, 0.08), {
    pos: [1.22, 0.3, 0],
    rot: [0, 0, 70],
    color: (c) => lit("#8d9096", c),
  });
  // Tail fins.
  for (const [a, b] of [
    [0, 1],
    [0, -1],
    [1, 0],
    [-1, 0],
  ])
    slab(
      k,
      [
        [-1.05, 0.1 * a, 0.1 * b],
        [-1.42, 0.08 * a, 0.08 * b],
        [-1.5, 0.48 * a, 0.48 * b],
        [-1.32, 0.48 * a, 0.48 * b],
      ],
      0.035,
      { flat: 0.2, color: (c) => lit(shade(col, 0.88), c) },
    );
  // The propeller.
  const prop = k.part("prop", { pivot: SUB.prop, axis: [1, 0, 0] });
  k.add(k.cone(0.08, 0.02, 0.14), {
    part: prop,
    pos: add(SUB.prop, [-0.02, 0, 0]),
    rot: [0, 0, 90],
    color: (c) => lit(brass, c),
  });
  for (let i = 0; i < 4; i++) {
    const a = (i * 90 * Math.PI) / 180;
    k.add(roundBox(0.04, 0.26, 0.1, 0.018), {
      part: prop,
      pos: add(SUB.prop, [0, Math.cos(a) * 0.16, Math.sin(a) * 0.16]),
      rot: [i * 90 + 20, 0, 0],
      weight: 2,
      color: (c) => lit(brass, c),
    });
  }
  // Bubbles.
  k.cloud({ share: 0.018, size: 0.9, pattern: false }, (rand) => {
    const fromProp = rand() < 0.6;
    const s = rand();
    const p = fromProp
      ? [-1.72 - s * 0.3, (rand() - 0.5) * 0.25 + s * 0.6, (rand() - 0.5) * 0.3]
      : [(rand() - 0.5) * 2.2, 0.5 + rand() * 0.55, (rand() - 0.5) * 0.6];
    return {
      p,
      color: mix("#cdf3ff", "#ffffff", rand()),
      size: 0.5 + rand() * 1.1,
      opacity: 0.55,
      kind: "rise",
      params: [0.7 + rand() * 0.6, rand()],
    };
  });
}

// ---- Bicycle ------------------------------------------------------------------------------

const BIKE = {
  front: [1.0, 0.66, 0],
  rear: [-1.0, 0.66, 0],
  bb: [-0.1, 0.6, 0],
  bell: [0.8, 1.79, 0.2],
};

function bicycleBuild(k, o) {
  const col = o.color;
  const tube = { weight: 2.2, flat: 0.25, color: (c) => lit(col, c, 0.62) };
  const metal = { weight: 3, color: (c) => lit("#c5c8cd", c, 0.6) };
  const black = { weight: 2.5, color: (c) => lit("#1f1f21", c, 0.6) };
  const wheelAt = (w, name) => {
    const part = k.part(name, { pivot: w, axis: [0, 0, 1] });
    k.add(k.torus(0.625, 0.038), {
      part,
      pos: w,
      rot: [90, 0, 0],
      weight: 1.6,
      pattern: false,
      color: (c) => shade("#222", 0.8 + 0.25 * Math.abs(c.ln[1])),
    });
    // Rims, hub and spokes stay metal under a flag or pattern.
    const bare = { part, pos: w, rot: [90, 0, 0], pattern: false };
    k.add(k.torus(0.59, 0.016), { ...bare, weight: 2.5, color: "#c9ccd1" });
    k.add(k.cylinder(0.035, 0.13), { ...bare, weight: 3, color: "#aeb1b6" });
    for (let i = 0; i < 24; i++) {
      const a = (i / 24) * TAU;
      const side = i % 2 ? 0.05 : -0.05;
      rod(
        k,
        add(w, [Math.cos(a) * 0.03, Math.sin(a) * 0.03, side]),
        add(w, [Math.cos(a + 0.2) * 0.585, Math.sin(a + 0.2) * 0.585, 0]),
        0.0055,
        {
          part,
          weight: 5,
          pattern: false,
          color: "#d4d6da",
        },
      );
    }
    return part;
  };
  wheelAt(BIKE.front, "front");
  const rearPart = wheelAt(BIKE.rear, "rear");
  k.add(k.cylinder(0.085, 0.02), {
    part: rearPart,
    pos: add(BIKE.rear, [0, 0, 0.1]),
    rot: [90, 0, 0],
    weight: 3,
    color: "#9ea1a6",
  });
  // The frame.
  const BB = BIKE.bb;
  const SC = [-0.36, 1.46, 0];
  const HT = [0.72, 1.5, 0];
  const HB = [0.8, 1.26, 0];
  rod(k, BB, [-0.37, 1.5, 0], 0.035, tube);
  rod(k, [-0.36, 1.4, 0], [0.73, 1.45, 0], 0.03, tube);
  rod(k, BB, HB, 0.04, tube);
  rod(k, HB, [0.715, 1.56, 0], 0.042, tube);
  for (const z of [-0.07, 0.07]) {
    rod(k, [-0.34, 1.38, 0], add(BIKE.rear, [0, 0, z]), 0.018, tube);
    rod(k, BB, add(BIKE.rear, [0, 0, z]), 0.02, tube);
    rod(k, HB, add(BIKE.front, [0, 0, z]), 0.022, tube);
  }
  // Seat, stem and handlebars.
  rod(k, SC, [-0.42, 1.68, 0], 0.02, metal);
  k.add(k.ellipsoid(0.2, 0.05, 0.1), {
    pos: [-0.45, 1.72, 0],
    weight: 2,
    color: (c) => lit("#5a3a24", c),
  });
  k.add(k.ellipsoid(0.12, 0.04, 0.05), {
    pos: [-0.3, 1.71, 0],
    weight: 2,
    color: (c) => lit("#5a3a24", c),
  });
  rod(k, [0.715, 1.56, 0], [0.71, 1.72, 0], 0.022, metal);
  rod(k, [0.71, 1.72, 0], [0.8, 1.74, 0], 0.02, metal);
  const bar = spline([
    [0.7, 1.84, -0.34],
    [0.8, 1.76, -0.27],
    [0.82, 1.74, 0],
    [0.8, 1.76, 0.27],
    [0.7, 1.84, 0.34],
  ]);
  k.add(k.tube(bar, 0.018), metal);
  for (const s of [-1, 1]) rod(k, [0.74, 1.81, 0.31 * s], [0.66, 1.86, 0.36 * s], 0.026, black);
  // The bell.
  const bell = k.part("bell", { pivot: BIKE.bell, axis: [1, 0, 0] });
  k.add(k.sphere(0.045), {
    part: bell,
    pos: BIKE.bell,
    scale: [1, 0.8, 1],
    weight: 4,
    color: (c) => lit("#e3e5e8", c, 0.5),
  });
  // The chain, rear cog and kickstand.
  const chain = spline(
    [
      [-0.1, 0.8, 0.1],
      [-0.55, 0.77, 0.1],
      [-1.0, 0.745, 0.1],
      [-1.085, 0.66, 0.1],
      [-1.0, 0.575, 0.1],
      [-0.55, 0.5, 0.1],
      [-0.1, 0.4, 0.1],
      [0.1, 0.6, 0.1],
    ],
    { closed: true },
  );
  k.add(k.tube(chain, 0.012, { closed: true }), { weight: 3, color: "#4a4b4f" });
  rod(k, [-0.25, 0.58, -0.08], [-0.45, 0.02, -0.22], 0.016, black);
  // The crank: chainring, arms and pedals turn together.
  const crank = k.part("crank", { pivot: BB, axis: [0, 0, 1] });
  k.add(k.torus(0.19, 0.016), {
    part: crank,
    pos: add(BB, [0, 0, 0.1]),
    rot: [90, 0, 0],
    weight: 3,
    color: "#b5b8bd",
  });
  k.add(k.cylinder(0.16, 0.012), {
    part: crank,
    pos: add(BB, [0, 0, 0.1]),
    rot: [90, 0, 0],
    weight: 2,
    color: (c) => (c.s.radial < 0.25 || (c.u * 5) % 1 < 0.22 ? "#b5b8bd" : null),
  });
  for (const s of [-1, 1]) {
    const end = add(BB, [0, -0.34 * s, 0.15 * s]);
    rod(k, add(BB, [0, 0, 0.15 * s]), end, 0.022, { ...metal, part: crank });
    k.add(k.box(0.15, 0.035, 0.1), {
      part: crank,
      pos: add(end, [0, 0, 0.07 * s]),
      weight: 3,
      color: "#28292c",
    });
  }
  shadow(k, 0.004, 1.5, 0.3, { share: 0.008 });
}

// ---- Tractor ----------------------------------------------------------------------------

const TRACTOR = { rear: [-0.55, 0.62, 0], front: [1.05, 0.36, 0], rr: 0.62, fr: 0.36 };

function tractorBuild(k, o) {
  const col = o.color;
  const P = { flat: 0.2 };
  const grey = "#3a3b3e";
  // Wheels with deep chevron treads.
  const chevronTyre = (w, r, wid, part) => {
    const tr = r * 0.3;
    k.add(k.torus(r - tr, tr), {
      part,
      pos: w,
      rot: [90, 0, 0],
      scale: [1, wid / (2 * tr), 1],
      flat: 0.25,
      weight: 1.2,
      pattern: false,
      color: (c) => {
        const out = Math.hypot(c.lp[0], c.lp[2]) > r - tr * 0.6;
        const f = (c.u * 26 + (Math.abs(c.lp[1]) / tr) * 0.45) % 1;
        const lug = out && f < 0.42;
        return shade("#262628", lug ? 1.25 : 0.7 + 0.2 * Math.abs(c.ln[1]));
      },
    });
    k.add(k.cylinder(r * 0.62, wid * 0.75), {
      part,
      pos: w,
      rot: [90, 0, 0],
      flat: 0.2,
      pattern: false,
      color: (c) => {
        if (c.s.side) return "#9a927f";
        const rr = c.s.radial;
        if (rr < 0.28) return shade("#e9dfc4", 0.8);
        const bolt = Math.abs(rr - 0.45) < 0.06 && (c.u * 8) % 1 < 0.2;
        return shade("#e9dfc4", bolt ? 0.6 : 0.95 - 0.1 * rr);
      },
    });
  };
  for (const [name, w, r, wid, zz] of [
    ["rear", TRACTOR.rear, TRACTOR.rr, 0.38, 0.58],
    ["front", TRACTOR.front, TRACTOR.fr, 0.2, 0.44],
  ]) {
    const part = k.part(name, { pivot: w, axis: [0, 0, 1] });
    for (const z of [-zz, zz]) chevronTyre([w[0], w[1], z], r, wid, part);
  }
  // Chassis, bonnet and grille.
  k.add(k.box(1.9, 0.26, 0.44), { ...P, pos: [0.25, 0.58, 0], color: (c) => lit(grey, c) });
  k.add(k.box(0.14, 0.18, 0.8), { ...P, pos: [1.3, 0.55, 0], color: (c) => lit(grey, c) });
  k.add(roundBox(1.28, 0.56, 0.56, 0.09), {
    ...P,
    pos: [0.62, 0.98, 0],
    interior: 0.05,
    core: "#555",
    color: (c) => {
      const [x, y, z] = c.p;
      if (c.n[0] > 0.7 && Math.abs(z) < 0.2 && y > 0.78 && y < 1.2)
        return keep(Math.sin(y * 110) > 0 ? "#cfd2d6" : "#1c1c1e");
      if (
        Math.abs(c.n[2]) > 0.7 &&
        x > 0.55 &&
        x < 1.1 &&
        y > 0.88 &&
        y < 1.1 &&
        Math.sin(x * 70) > 0.3
      )
        return keep(lit(shade(col, 0.45), c));
      return lit(col, c);
    },
  });
  for (const z of [-0.22, 0.22])
    k.add(k.sphere(0.06), { pos: [1.22, 1.15, z], weight: 3, pattern: false, color: "#fff7d6" });
  // Exhaust stack and air intake.
  rod(k, [0.88, 1.22, 0.12], [0.88, 1.95, 0.12], 0.045, {
    weight: 2,
    color: (c) => lit("#1f1f21", c),
  });
  rod(k, [0.5, 1.22, -0.12], [0.5, 1.55, -0.12], 0.04, {
    weight: 2,
    color: (c) => lit("#bfc2c7", c),
  });
  k.add(k.cylinder(0.06, 0.06), { pos: [0.5, 1.58, -0.12], color: (c) => lit("#bfc2c7", c) });
  // A light, thinning wisp of exhaust (it was a heavy cloud).
  plume(k, [0.88, 2.0, 0.12], [-0.55, 0.45, 0], {
    share: 0.007,
    spread: 0.04,
    grow: 2.2,
    color: "#e6e3de",
    dark: "#9a958f",
    opacity: 0.08,
    height: 0.45,
  });
  // The cab: posts, roof, windows, a seat and a steering wheel.
  const cx0 = -1.05;
  const cx1 = -0.08;
  k.add(k.box(cx1 - cx0 + 0.1, 0.08, 0.9), {
    ...P,
    pos: [(cx0 + cx1) / 2, 0.94, 0],
    color: (c) => lit(grey, c),
  });
  for (const x of [cx0 + 0.05, cx1 - 0.05])
    for (const z of [-0.42, 0.42])
      rod(k, [x, 0.95, z], [x, 2.0, z], 0.035, { weight: 2, color: (c) => lit(grey, c) });
  k.add(roundBox(cx1 - cx0 + 0.25, 0.09, 1.02, 0.03), {
    ...P,
    pos: [(cx0 + cx1) / 2, 2.04, 0],
    color: (c) => lit(col, c),
  });
  const pane = (a, b, cc, d) =>
    k.add(quad(k, a, b, cc, d), {
      opacity: 0.2,
      pattern: false,
      even: true,
      jitter: 0.01,
      // Clear glass with a soft diagonal reflection (it was random static).
      color: (c) => {
        const t = (c.p[0] * 0.6 + c.p[1] * 1.4 + c.p[2] * 0.5) * 1.3;
        const f = t - Math.floor(t);
        return mix("#bcd6ea", "#ffffff", 0.8 * smoothstep(0, 0.06, f) * smoothstep(0.32, 0.1, f));
      },
    });
  pane(
    [cx1 - 0.05, 1.05, -0.4],
    [cx1 - 0.05, 1.05, 0.4],
    [cx1 - 0.05, 1.96, 0.4],
    [cx1 - 0.05, 1.96, -0.4],
  );
  pane(
    [cx0 + 0.05, 1.05, 0.42],
    [cx1 - 0.05, 1.05, 0.42],
    [cx1 - 0.05, 1.96, 0.42],
    [cx0 + 0.05, 1.96, 0.42],
  );
  k.add(roundBox(0.3, 0.35, 0.4, 0.09), { pos: [-0.72, 1.2, 0], color: (c) => lit("#1e1e20", c) });
  k.add(k.torus(0.13, 0.018), {
    pos: [-0.3, 1.45, 0],
    rot: [0, 0, 60],
    weight: 3,
    color: "#1e1e20",
  });
  rod(k, [-0.3, 1.45, 0], [-0.08, 1.1, 0], 0.02, { weight: 3, color: "#1e1e20" });
  // Mudguards over the big wheels.
  for (const s of [-1, 1]) {
    const guard = k.param(
      (u, v) => {
        const a = Math.PI * (0.05 + 0.9 * u);
        const R = TRACTOR.rr + 0.08;
        return [
          TRACTOR.rear[0] + Math.cos(a) * R,
          TRACTOR.rear[1] + Math.sin(a) * R,
          s * (0.36 + 0.44 * v),
        ];
      },
      { grid: 32, flip: s < 0 },
    );
    k.add(guard, { ...P, weight: 1.2, color: (c) => lit(col, c) });
  }
  shadow(k, 0.004, 1.45, 0.95);
}

// ---- Flying saucer ----------------------------------------------------------------------

const UFO = { centre: [0, 0.1, 0] };

function ufoBuild(k) {
  const saucer = k.part("saucer", { pivot: UFO.centre });
  const S = { part: saucer, flat: 0.2 };
  const hull = k.lathe(
    [
      [0.0, -0.3],
      [0.55, -0.27],
      [1.05, -0.16],
      [1.42, -0.03],
      [1.5, 0.03],
      [1.42, 0.09],
      [1.02, 0.2],
      [0.62, 0.29],
      [0.44, 0.31],
    ],
    { grid: 96, thick: 0.14 },
  );
  k.add(hull, {
    ...S,
    interior: 0.05,
    core: "#6c7078",
    color: (c) => {
      const r = Math.hypot(c.p[0], c.p[2]);
      const up = c.n[1];
      let base = mix("#8a9099", "#eef1f5", smoothstep(-0.6, 0.9, up));
      if (Math.abs(c.p[1] - 0.03) < 0.035 && r > 1.4) base = "#5d636c";
      if ((Math.abs(r - 0.95) < 0.01 || Math.abs(r - 0.7) < 0.01) && up > 0)
        base = shade(base, 0.75);
      if (up > 0 && r > 0.6 && r < 1.35 && Math.abs(((c.u * 12) % 1) - 0.5) > 0.485)
        base = shade(base, 0.8);
      const spec = Math.pow(Math.max(0, sunOf(c.n)), 12) * 0.35;
      return mix(base, "#ffffff", spec);
    },
  });
  // The pilot: a small green friend under a glass dome.
  k.add(k.sphere(0.17), { ...S, pos: [0, 0.47, 0], weight: 1.5, color: (c) => lit("#6fd35a", c) });
  for (const s of [-1, 1]) {
    k.add(k.ellipsoid(0.045, 0.06, 0.03), {
      ...S,
      pos: [Math.sin(0.55 + s * 0.35) * 0.15, 0.5, Math.cos(0.55 + s * 0.35) * 0.15],
      rot: [0, ((0.55 + s * 0.35) * 180) / Math.PI, 0],
      weight: 4,
      pattern: false,
      color: (c) => (c.lp[1] > 0.03 && c.lp[0] < 0 ? "#ffffff" : "#111111"),
    });
    rod(k, [s * 0.06, 0.6, 0], [s * 0.12, 0.75, 0], 0.01, { ...S, weight: 4, color: "#5fbf4c" });
    k.add(k.sphere(0.03), {
      ...S,
      pos: [s * 0.12, 0.76, 0],
      weight: 4,
      pattern: false,
      color: "#fff26b",
    });
  }
  k.add(k.sphere(0.46), {
    ...S,
    pos: [0, 0.3, 0],
    scale: [1, 0.95, 1],
    opacity: 0.4,
    pattern: false,
    color: (c) => (c.lp[1] < 0 ? null : glass(c, "#4aa8c8").c),
  });
  // A glowing ring underneath.
  k.add(k.torus(0.5, 0.06), {
    ...S,
    pos: [0, -0.28, 0],
    weight: 2,
    pattern: false,
    kind: "twinkle",
    params: [0.25, 0],
    color: "#8ff7ff",
  });
  // Coloured lights that run round the rim.
  const lights = k.part("lights", { pivot: UFO.centre, axis: [0, 1, 0] });
  const bulbs = ["#ff4d6d", "#ffd23f", "#3ee6ff", "#7cff6b", "#c77dff"];
  for (let i = 0; i < 16; i++) {
    const a = (i / 16) * TAU;
    k.add(k.sphere(0.055), {
      part: lights,
      pos: [Math.sin(a) * 1.46, 0.035, Math.cos(a) * 1.46],
      weight: 4,
      pattern: false,
      kind: "twinkle",
      params: [0.45, i * 1.3],
      color: bulbs[i % bulbs.length],
    });
  }
  // The tractor beam, a cow in it, and the grass below.
  const ground = -2.35;
  const beam = k.part("beam", { pivot: [0, 0, 0] });
  k.cloud({ share: 0.1, size: 2.2, pattern: false, part: beam }, (rand) => {
    const t = rand();
    const y = -0.32 + (ground + 0.32) * t;
    const R = 0.36 + 0.7 * t;
    const a = rand() * TAU;
    const edge = rand() < 0.65;
    const r = edge ? R * (0.92 + 0.08 * rand()) : R * Math.sqrt(rand());
    return {
      p: [Math.sin(a) * r, y, Math.cos(a) * r],
      color: mix("#b9fff0", "#e9fffb", rand()),
      opacity: edge ? 0.1 : 0.06,
      size: 0.8 + 0.6 * rand(),
      kind: "rise",
      params: [0.25 + 0.3 * rand(), rand()],
    };
  });
  k.add(k.disc(1.08), {
    part: beam,
    pos: [0, ground + 0.012, 0],
    pattern: false,
    opacity: 0.6,
    color: (c) => (c.n[1] < 0 ? null : mix("#e8fff9", "#8ff0d4", c.v)),
  });
  k.add(k.cylinder(1.45, 0.08), {
    pos: [0, ground - 0.04, 0],
    flat: 0.2,
    color: (c) => {
      if (c.s.side) return lit("#6b4a2c", c);
      return lit(shade("#58a845", 0.85 + 0.25 * c.noise(c.p[0] * 8, 0, c.p[2] * 8)), c);
    },
  });
  const cow = k.part("cow", { pivot: [0, -1.45, 0], axis: [0, 1, 0] });
  const C = { part: cow, flat: 0.25, weight: 1.6 };
  const spots = (c) => (c.noise(c.p[0] * 9, c.p[1] * 9, c.p[2] * 9) > 0.25 ? "#1d1d1d" : "#f7f5f0");
  k.add(roundBox(0.5, 0.26, 0.26, 0.117), {
    ...C,
    pos: [0, -1.45, 0],
    color: (c) => lit(spots(c), c),
  });
  k.add(roundBox(0.16, 0.15, 0.14, 0.063), {
    ...C,
    pos: [0.3, -1.36, 0],
    color: (c) => lit(c.p[0] > 0.36 ? "#f2a7a7" : "#f7f5f0", c),
  });
  for (const s of [-1, 1]) {
    k.add(k.sphere(0.022), {
      ...C,
      pos: [0.34, -1.31, 0.07 * s],
      weight: 4,
      pattern: false,
      color: "#111",
    });
    k.add(k.ellipsoid(0.05, 0.02, 0.03), { ...C, pos: [0.27, -1.3, 0.1 * s], color: "#f7f5f0" });
    for (const x of [-0.17, 0.17])
      rod(k, [x, -1.55, 0.08 * s], [x, -1.72, 0.08 * s], 0.03, { ...C, color: "#f7f5f0" });
  }
  rod(k, [-0.25, -1.4, 0], [-0.34, -1.58, 0], 0.012, { ...C, color: "#1d1d1d" });
}

// ---- Recipes ----------------------------------------------------------------------------

export const RECIPES = {
  rocket: {
    alive: true,
    options: [{ key: "color", label: "Colour", type: "color", default: "#d62d2d" }],
    controls: [{ key: "launch", label: "Launch", type: "pulse", ease: 7 }],
    action: { key: "launch", label: "Launch", sound: "whoosh" },
    drive(t, c, out, info) {
      const on = c.launch > 0.001;
      const p = on ? 1 - c.launch : 1;
      const s = Math.max(0, p - 0.05) / 0.69;
      const flying = on && p < 0.74;
      const lift = flying ? 9 * s * s : 0;
      const shake = flying && s < 0.35 ? 0.012 * Math.sin(info.time * 70) * (1 - s / 0.35) : 0;
      const vis = !on ? 1 : flying ? 1 : smoothstep(0.86, 1, p);
      out.parts.rocket = { offset: [shake, lift, 0], visible: vis };
      out.parts.flame = {
        quat: [0, 0, 1, 0],
        offset: [shake, lift, 0],
        visible: flying ? smoothstep(0, 0.05, p) : 0,
      };
      out.parts.smoke = {
        visible: on ? smoothstep(0.01, 0.1, p) * (1 - smoothstep(0.7, 0.95, p)) : 0,
      };
      out.parts.vapour = { visible: on ? smoothstep(0.85, 1, p) : 1 };
      out.parts.arm = { angle: -1.35 * (smoothstep(0, 0.1, p) - smoothstep(0.86, 1, p)) };
      out.amount = 0.45 + 0.55 * smoothstep(0, 1.2, lift);
    },
    build: rocketBuild,
  },

  helicopter: {
    alive: true,
    options: [{ key: "color", label: "Colour", type: "color", default: "#e8452c" }],
    controls: [{ key: "fly", label: "Fly", type: "toggle", default: 0, ease: 2.4 }],
    action: { key: "fly", label: "Take off or land", sound: "whoosh" },
    drive(t, c, out) {
      const f = easeInOut(c.fly);
      const bob = 0.04 * Math.sin(t * 1.9) * f;
      const lift = [0, 1.1 * f + bob, 0];
      const tq = tilt(0, -0.1 * f + 0.02 * Math.sin(t * 1.3) * f);
      out.parts.heli = carried(HELI.centre, tq, HELI.centre, lift);
      out.parts.rotor = carried(
        HELI.rotor,
        tq,
        HELI.centre,
        lift,
        quatAxisAngle([0, 1, 0], -t * 11),
      );
      out.parts.tailRotor = carried(
        HELI.tail,
        tq,
        HELI.centre,
        lift,
        quatAxisAngle([0, 0, 1], -t * 17),
      );
    },
    build: helicopterBuild,
  },

  "hot-air-balloon": {
    alive: true,
    options: [
      {
        key: "style",
        label: "Style",
        type: "select",
        default: "stripes",
        choices: [
          { id: "stripes", label: "Stripes" },
          { id: "rainbow", label: "Rainbow" },
        ],
      },
      { key: "c1", label: "Colour 1", type: "color", default: "#e8412f" },
      { key: "c2", label: "Colour 2", type: "color", default: "#f6c945" },
    ],
    controls: [{ key: "burn", label: "Burner", type: "pulse", ease: 3 }],
    action: { key: "burn", label: "Fire the burner", sound: "fire" },
    drive(t, c, out) {
      const up = Math.sin(Math.PI * clamp(1 - c.burn, 0, 1)) * (c.burn > 0.001 ? 1 : 0);
      const lift = [0, 0.08 * Math.sin(t * 0.8) + 0.35 * up, 0];
      const tq = tilt(0.03 * Math.sin(t * 0.6 + 1), 0.04 * Math.sin(t * 0.7));
      out.parts.balloon = carried(BALLOON_C, tq, BALLOON_C, lift);
      out.amount = 1 + 2.2 * c.burn;
    },
    build: balloonBuild,
  },

  "steam-train": {
    alive: true,
    options: [{ key: "color", label: "Colour", type: "color", default: "#1f6b43" }],
    controls: [{ key: "toot", label: "Whistle", type: "pulse", ease: 2 }],
    action: { key: "toot", label: "Blow the whistle", sound: "chime" },
    drive(t, c, out) {
      const w = t * 2.2;
      const a = -(w + burst(c.toot, 2));
      TRAIN.drivers.forEach((x, i) => (out.parts[`driver${i}`] = { angle: a }));
      const small = (r) => -((w * TRAIN.driverR) / r + burst(c.toot, 3));
      out.parts.pony = { angle: small(TRAIN.ponyR) };
      TRAIN.tender.forEach((x, i) => (out.parts[`tender${i}`] = { angle: small(TRAIN.tenderR) }));
      const r = TRAIN.crank;
      out.parts.rods = { offset: [r * Math.cos(a) - r, r * Math.sin(a), 0] };
      out.parts.steam = { visible: c.toot > 0.02 ? smoothstep(0, 0.25, c.toot) : 0 };
      out.amount = 1 + 1.2 * c.toot;
    },
    build: trainBuild,
  },

  "ocean-liner": {
    alive: true,
    options: [{ key: "funnel", label: "Funnels", type: "color", default: "#c0392b" }],
    controls: [{ key: "horn", label: "Horn", type: "pulse", ease: 2.5 }],
    action: { key: "horn", label: "Sound the horn", sound: "chime" },
    drive(t, c, out) {
      const tq = tilt(0.025 * Math.sin(t * 0.9), 0.012 * Math.sin(t * 0.63 + 1));
      out.parts.ship = carried(LINER.centre, tq, LINER.centre, [0, 0.015 * Math.sin(t * 1.1), 0]);
      const h = carried(LINER.horn, tq, LINER.centre);
      out.parts.horn = { ...h, visible: c.horn > 0.02 ? smoothstep(0, 0.2, c.horn) : 0 };
      out.amount = 1 + 0.8 * c.horn;
    },
    build: linerBuild,
  },
  "sports-car": {
    alive: true,
    options: [
      { key: "color", label: "Colour", type: "color", default: "#e3242b" },
      { key: "stripes", label: "Stripes", type: "switch", default: true },
    ],
    controls: [{ key: "vroom", label: "Rev", type: "pulse", ease: 1.8 }],
    action: { key: "vroom", label: "Rev the engine", sound: "whoosh" },
    drive(t, c, out) {
      const a = -(t * 2.5 + burst(c.vroom, 3));
      out.parts.front = { angle: a };
      out.parts.rear = { angle: a };
      const v = c.vroom > 0.001 ? Math.sin(Math.PI * (1 - c.vroom)) : 0;
      out.parts.puff = { visible: smoothstep(0, 0.2, c.vroom) };
      out.body = { quat: quatAxisAngle([0, 0, 1], 0.035 * v) };
      out.amount = 1 + c.vroom;
    },
    build: carBuild,
  },

  bus: {
    alive: true,
    options: [
      {
        key: "style",
        label: "Style",
        type: "select",
        default: "school",
        choices: [
          { id: "school", label: "School bus" },
          { id: "double", label: "Double-decker" },
        ],
      },
    ],
    controls: [{ key: "beep", label: "Beep", type: "pulse", ease: 1.5 }],
    action: { key: "beep", label: "Beep beep", sound: "pop" },
    drive(t, c, out) {
      const a = -(t * 2 + burst(c.beep, 2));
      out.parts.front = { angle: a };
      out.parts.rear = { angle: a };
      out.body = { squash: 0.05 * Math.sin(Math.PI * 2 * (1 - c.beep)) * c.beep };
      out.amount = 1 + 1.5 * c.beep;
    },
    build: busBuild,
  },

  "propeller-plane": {
    alive: true,
    options: [
      { key: "color", label: "Body", type: "color", default: "#d7322a" },
      { key: "wings", label: "Wings", type: "color", default: "#f4c542" },
    ],
    controls: [{ key: "loop", label: "Loop", type: "pulse", ease: 3 }],
    action: { key: "loop", label: "Loop the loop", sound: "whoosh" },
    drive(t, c, out) {
      out.parts.prop = { angle: t * 20 + burst(c.loop, 4) };
      const th = c.loop > 0.001 ? TAU * smoothstep(0, 1, 1 - c.loop) : 0;
      const R = 0.45;
      out.body = {
        quat: quatMulLocal(
          quatAxisAngle([0, 0, 1], th),
          quatAxisAngle([1, 0, 0], 0.05 * Math.sin(t * 0.8)),
        ),
        offset: [R * Math.sin(th), R * (1 - Math.cos(th)) + 0.03 * Math.sin(t * 1.2), 0],
      };
    },
    build: planeBuild,
  },

  jet: {
    alive: true,
    options: [{ key: "color", label: "Tail", type: "color", default: "#1f5fae" }],
    controls: [{ key: "climb", label: "Climb", type: "pulse", ease: 3 }],
    action: { key: "climb", label: "Climb", sound: "whoosh" },
    drive(t, c, out) {
      const v = c.climb > 0.001 ? Math.sin(Math.PI * (1 - c.climb)) : 0;
      out.body = {
        quat: quatMulLocal(
          quatAxisAngle([0, 0, 1], 0.22 * v),
          quatAxisAngle([1, 0, 0], 0.06 * Math.sin(t * 0.5)),
        ),
        offset: [0, 0.03 * Math.sin(t * 0.9) + 0.25 * v, 0],
      };
    },
    build: jetBuild,
  },

  sailboat: {
    alive: true,
    options: [
      { key: "sails", label: "Sails", type: "color", default: "#f8f6ef" },
      { key: "stripe", label: "Stripe", type: "color", default: "#1f5fae" },
    ],
    controls: [{ key: "gust", label: "Gust", type: "pulse", ease: 3 }],
    action: { key: "gust", label: "A gust of wind", sound: "whoosh" },
    drive(t, c, out) {
      const g = c.gust > 0.001 ? Math.sin(Math.PI * (1 - c.gust)) : 0;
      const tq = tilt(0.05 * Math.sin(t * 0.9) + 0.22 * g, 0.03 * Math.sin(t * 0.7 + 1));
      out.parts.boat = carried(BOAT.centre, tq, BOAT.centre, [0, 0.02 * Math.sin(t * 1.1), 0]);
      out.amount = 1 + g;
    },
    build: sailboatBuild,
  },

  submarine: {
    alive: true,
    options: [{ key: "color", label: "Colour", type: "color", default: "#f5c21b" }],
    controls: [{ key: "scope", label: "Periscope", type: "toggle", default: 1, ease: 1.2 }],
    action: { key: "scope", label: "Raise or lower the periscope", sound: "click" },
    drive(t, c, out) {
      out.parts.prop = { angle: t * 9 };
      out.parts.scope = { offset: [0, -0.34 * (1 - easeInOut(c.scope)), 0] };
      out.body = {
        offset: [0, 0.03 * Math.sin(t * 0.9), 0],
        quat: quatAxisAngle([0, 0, 1], 0.03 * Math.sin(t * 0.7)),
      };
    },
    build: submarineBuild,
  },

  bicycle: {
    alive: true,
    options: [{ key: "color", label: "Frame", type: "color", default: "#1e88e5" }],
    controls: [{ key: "ring", label: "Bell", type: "pulse", ease: 1 }],
    action: { key: "ring", label: "Ring the bell", sound: "chime" },
    drive(t, c, out, info) {
      const a = -t * 2.4;
      out.parts.front = { angle: a };
      out.parts.rear = { angle: a };
      out.parts.crank = { angle: a * 0.42 };
      out.parts.bell = { angle: 0.35 * Math.sin(info.time * 40) * c.ring };
    },
    build: bicycleBuild,
  },

  tractor: {
    alive: true,
    options: [{ key: "color", label: "Colour", type: "color", default: "#c8322b" }],
    controls: [{ key: "chug", label: "Chug", type: "pulse", ease: 2 }],
    action: { key: "chug", label: "Chug chug", sound: "pop" },
    drive(t, c, out, info) {
      out.parts.rear = { angle: -(t * 1.2 + burst(c.chug, 1)) };
      out.parts.front = { angle: -((t * 1.2 * TRACTOR.rr) / TRACTOR.fr + burst(c.chug, 2)) };
      out.body = { squash: 0.03 * Math.sin(info.time * 18) * c.chug };
      out.amount = 1 + 1.6 * c.chug;
    },
    build: tractorBuild,
  },

  ufo: {
    alive: true,
    controls: [{ key: "beam", label: "Beam", type: "toggle", default: 1, ease: 1.6 }],
    action: { key: "beam", label: "Beam on or off", sound: "whoosh" },
    drive(t, c, out) {
      const b = easeInOut(c.beam);
      const bob = [0, 0.05 * Math.sin(t * 1.3), 0];
      const tq = tilt(0.03 * Math.sin(t * 0.9), 0.03 * Math.sin(t * 0.7 + 2));
      out.parts.saucer = carried(UFO.centre, tq, UFO.centre, bob);
      out.parts.lights = carried(
        UFO.centre,
        tq,
        UFO.centre,
        bob,
        quatAxisAngle([0, 1, 0], t * 1.2),
      );
      out.parts.beam = { visible: smoothstep(0, 0.3, c.beam) };
      out.parts.cow = {
        quat: quatAxisAngle([0, 1, 0], 0.6 * Math.sin(t * 0.5) * b),
        offset: [0, -0.6 * (1 - b) + 0.05 * Math.sin(t * 1.7) * b, 0],
      };
    },
    build: ufoBuild,
  },
};
