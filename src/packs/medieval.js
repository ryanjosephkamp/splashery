// Medieval and fantasy pack: a sword in a stone, a heraldic shield, a bow
// and target, a trebuchet, a crossbow, a knight's helmet, a crown, a dragon
// egg and a wizard's orb. Weapons are medieval or fantasy only, and the
// shooting is playful: arrows stick in straw, stones fly off into the sky.

import {
  mix,
  shade,
  smoothstep,
  clamp,
  spline,
  quatEuler,
  quatAxisAngle,
  quatFromTo,
  quatRotate,
  quatMul,
  vec,
} from "../kit.js";

const TAU = Math.PI * 2;
const DEG = Math.PI / 180;
const LIGHT = vec.unit([0.3, 0.8, 0.55]);
const VIEW = vec.unit([0.52, 0.27, 0.81]);
const HALF = vec.unit(vec.add(LIGHT, VIEW));
const keep = (c, size) => ({ c, keep: true, size });
const ease = (x) => {
  const t = clamp(x, 0, 1);
  return t * t * (3 - 2 * t);
};
const band = (x, a, b) => clamp((x - a) / (b - a), 0, 1);
const dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
const fract = (x) => x - Math.floor(x);

// Fake light: brighter towards the light, a little gloss.
function lit(c, col, k = 0.3, gloss = 0) {
  const d = dot(c.n, LIGHT);
  let out = shade(col, 1 + k * (0.9 * d - 0.15));
  if (gloss) out = mix(out, "#ffffff", gloss * Math.pow(Math.max(0, dot(c.n, HALF)), 24));
  return out;
}

// Polished metal: a baked reflection of sky, horizon and ground.
function metal(c, base, glare = 0.45, dark, floor = 0.15) {
  const n = c.n;
  const dv = dot(n, VIEW);
  const y = 2 * dv * n[1] - VIEW[1];
  const ground = floor + 0.35 * (1 + Math.min(0, y));
  const sky = 0.8 + 0.15 * Math.max(0, y);
  let f = ground + (sky - ground) * smoothstep(-0.2, 0.05, y);
  f += glare * Math.exp(-(((y + 0.02) / 0.08) ** 2));
  const lo = dark || shade(base, 0.3);
  if (f < 1) return mix(lo, base, clamp(f, 0, 1));
  return mix(base, "#ffffff", Math.min(0.75, (f - 1) * 1.8));
}
const GOLD_DARK = "#7a4a14";
const gold = (c, base = "#f0c24e", glare) => metal(c, base, glare, GOLD_DARK, 0.42);

// Wood with grain running along one axis of p (0 = x, 1 = y, 2 = z).
function wood(c, base, p, axis = 1, dark = 0.72) {
  const a = p[(axis + 1) % 3];
  const b = p[(axis + 2) % 3];
  const l = p[axis];
  const g = c.fbm(a * 9, l * 1.2, b * 9, 3);
  const ring = 0.5 + 0.5 * Math.sin((a * 0.7 + b * 0.5) * 40 + g * 7);
  return mix(base, shade(base, dark), 0.35 * ring + 0.35 * (0.5 + 0.5 * g));
}

// A group of shapes moved and turned together.
function group(k, pos = [0, 0, 0], rot = [0, 0, 0]) {
  const q = rot.length === 4 ? rot : quatEuler(...rot);
  return {
    kit: k,
    q,
    pt: (p) => vec.add(pos, quatRotate(q, p)),
    dir: (d) => quatRotate(q, d),
    add(shape, o = {}) {
      const oq = o.quat || (o.rot ? quatEuler(...o.rot) : [0, 0, 0, 1]);
      return k.add(shape, {
        ...o,
        rot: undefined,
        quat: quatMul(q, oq),
        pos: vec.add(pos, quatRotate(q, o.pos || [0, 0, 0])),
      });
    },
  };
}

// A square beam of wood from a to b.
function beam(g, a, b, w, color, opts = {}) {
  const d = vec.sub(b, a);
  const len = vec.len(d);
  g.add(g.kit.box(w, len, opts.depth ?? w), {
    pos: vec.mul(vec.add(a, b), 0.5),
    quat: quatFromTo([0, 1, 0], d),
    flat: 0.2,
    color: (c) => lit(c, wood(c, color, c.lp, 1), 0.3),
    ...opts,
  });
}

// Inside a five-pointed star of radius R (point up) centred at the origin.
function inStar(x, y, R) {
  const seg = TAU / 5;
  const a = Math.atan2(x, y);
  const d = Math.abs(fract(a / seg + 0.5) - 0.5) * seg;
  const ri = R * 0.4;
  const edge = (R * ri * Math.sin(seg / 2)) / (R * Math.sin(d) + ri * Math.sin(seg / 2 - d));
  return Math.hypot(x, y) <= edge;
}

// Geometry shared by the bow's build and drive (recipe coordinates).
const BOW = {
  sx: 0.98, // the string's x
  half: 0.74, // half the bow's height
  nockY: 0.03,
  tip: [0.18, 0.03, 0], // arrow tip when nocked
  end: [-0.83, 0.17, 0.02], // arrow tip when stuck in the target
  arc: 0.12,
  target: [-0.85, 0.12, 0],
};

const easeInOut = (x) => {
  const t = clamp(x, 0, 1);
  return t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2;
};

// The trebuchet's arm, cocked (long end down at the back) in the rest pose.
const TREB = (() => {
  const axle = [0.05, 0.98, 0];
  const a = 46 * DEG;
  const dl = [-Math.cos(a), -Math.sin(a), 0];
  const tip = vec.add(axle, vec.mul(dl, 1.05));
  const hinge = vec.add(axle, vec.mul(dl, -0.3));
  const stone = vec.add(tip, vec.mul([-dl[1], dl[0], 0], -0.085));
  const rel = -2.2; // release angle (about +Z)
  const eq = -2.37; // arm straight up, weight hanging
  const tRel = 0.16;
  const tSwing = 0.62;
  const swing = (u) => {
    const tau = (u - tRel) / (tSwing - tRel);
    const w = 3 * Math.PI * tau;
    return eq + ((rel - eq) * Math.cos(w) - 0.7 * Math.sin(w)) * Math.exp(-3.2 * tau);
  };
  const settled = swing(tSwing);
  const angle = (u) => {
    if (u < tRel) return rel * (u / tRel) ** 2;
    if (u < tSwing) return swing(u);
    return settled * (1 - easeInOut(band(u, tSwing, 0.92)));
  };
  return { axle, dl, tip, hinge, stone, rel, tRel, angle };
})();

// The crossbow is built along +Z, then turned to point left of the viewer.
const XBOW = (() => {
  const q = quatEuler(-4, -22, 0);
  const tipL = [-0.62, 0.03, 0.3];
  const tipR = [0.62, 0.03, 0.3];
  const latch = [0, 0.07, -0.16];
  const half = (tip, target) => {
    const d = vec.unit(vec.sub(latch, tip));
    const t = vec.unit(vec.sub(target, tip));
    return {
      tip,
      axis: quatRotate(q, vec.unit(vec.cross(d, t))),
      angle: Math.acos(clamp(vec.dot(d, t), -1, 1)),
    };
  };
  return {
    q,
    tipL,
    tipR,
    latch,
    left: half(tipL, tipR),
    right: half(tipR, tipL),
    up: quatRotate(q, [0, 1, 0]),
    fwd: quatRotate(q, [0, 0, 1]),
    side: quatRotate(q, [1, 0, 0]),
  };
})();

// Remembers which way a toggle is moving (per player: `c` is the player's
// own control state), so a reset can look different from the action.
const motionMemo = new WeakMap();
function direction(c, key) {
  let m = motionMemo.get(c);
  if (!m) motionMemo.set(c, (m = {}));
  const v = c[key] ?? 0;
  const prev = m[key];
  if (prev !== undefined) {
    if (v > prev.v + 1e-5) prev.dir = 1;
    else if (v < prev.v - 1e-5) prev.dir = -1;
    prev.v = v;
    return prev.dir;
  }
  m[key] = { v, dir: v > 0.5 ? 1 : 0 };
  return m[key].dir;
}

const GEMS = { ruby: "#d0183c", sapphire: "#1f55d6", emerald: "#11a35a", amethyst: "#8a3fd1" };

// A faceted gem colour: facets catch the light in steps.
function gem(c, base) {
  const n = c.n;
  const f = Math.floor((Math.atan2(n[0], n[2]) / TAU + 0.5) * 8) / 8;
  const g = Math.floor((n[1] + 1) * 2.5) / 5;
  const s = 0.55 + 0.6 * fract(Math.sin(f * 91.7 + g * 37.3) * 43.1);
  let col = shade(base, s + 0.35 * g);
  if (dot(n, HALF) > 0.93) col = mix(col, "#ffffff", 0.8);
  return col;
}

export const RECIPES = {
  // ---- Sword in the stone ---------------------------------------------------
  "sword-in-stone": {
    alive: true,
    controls: [{ key: "pull", label: "Pull the sword", type: "toggle", default: 0, ease: 1.6 }],
    action: { key: "pull", label: "Pull", sound: { on: "chime", off: "drop" } },
    drive(t, c, out) {
      const p = easeInOut(c.pull);
      // It sticks at first, wiggles, then slides free.
      const stuck = Math.sin(Math.PI * clamp(c.pull * 2.5, 0, 1));
      const wig = stuck * 0.05 * Math.sin(t * 38 + c.pull * 40);
      const bob = p * 0.025 * Math.sin(t * 2.2);
      const lift = 0.5 * easeInOut(band(c.pull, 0.25, 1)) + bob;
      out.parts.sword = { offset: [0, lift, 0], quat: quatAxisAngle([0, 0, 1], wig) };
      out.parts.aura = {
        offset: [0, lift, 0],
        visible: smoothstep(0.7, 1, c.pull),
      };
      out.amount = 0.5 + 0.5 * p;
    },
    build(k) {
      const top = 0.02;
      // The rock: a lumpy boulder with a flat underside, mossy on top.
      const rockR = (d) => {
        const n = k.noise.fbm(d[0] * 1.5 + 3, d[1] * 1.5, d[2] * 1.5, 3);
        const n2 = k.noise(d[0] * 4.5, d[1] * 4.5 + 7, d[2] * 4.5);
        let r = 1 + 0.2 * n + 0.06 * n2 + 0.12 * Math.max(0, d[1]) ** 3;
        if (d[1] < 0) r /= Math.sqrt(1 + 10 * d[1] * d[1]);
        return r;
      };
      k.add(k.radial(rockR, { grid: 72 }), {
        pos: [0, -0.46, 0],
        scale: [0.98, 0.6, 0.82],
        flat: 0.25,
        interior: 0.1,
        core: "#57534e",
        color: (c) => {
          const p = c.p;
          const n = c.fbm(p[0] * 2.6, p[1] * 2.6, p[2] * 2.6, 4);
          let col = mix("#9a958c", "#5e5a55", clamp(0.5 + 0.8 * n, 0, 1));
          const cr = Math.abs(c.fbm(p[0] * 2 + 5, p[1] * 4, p[2] * 2, 3));
          if (cr < 0.03) col = shade(col, 0.55);
          const lichen = c.noise(p[0] * 9, p[1] * 9 + 3, p[2] * 9);
          if (lichen > 0.55) col = mix(col, "#c9c48f", 0.5);
          const up = c.n[1] + 0.45 * c.fbm(p[0] * 3 + 9, p[1] * 3, p[2] * 3, 3);
          const moss = smoothstep(0.62, 0.9, up);
          const tuft = 0.5 + 0.5 * c.noise(p[0] * 22, p[1] * 22, p[2] * 22);
          col = mix(col, mix("#4f7a2a", "#9cbf4a", tuft), moss);
          // A dark slit where the blade goes in.
          if (Math.abs(p[0]) < 0.09 && Math.abs(p[2]) < 0.035 && p[1] > top - 0.1) col = "#2a2724";
          return lit(c, col, 0.35);
        },
      });
      // Tufts of grass at the foot.
      const tufts = [];
      for (let i = 0; i < 16; i++) tufts.push([k.rand() * TAU, 0.8 + k.rand() * 0.1]);
      k.cloud({ share: 0.025, size: 0.9 }, (rand) => {
        const [a0, r0] = tufts[Math.floor(rand() * tufts.length)];
        const a = a0 + (rand() - 0.5) * 0.25;
        const r = r0 + (rand() - 0.5) * 0.1;
        const x = Math.sin(a) * r;
        const z = Math.cos(a) * r * 0.85;
        const h = rand() * 0.16;
        return {
          p: [x + (rand() - 0.5) * 0.03, -0.63 + h, z],
          dir: [(rand() - 0.5) * 0.4, 1, (rand() - 0.5) * 0.4],
          stretch: 2.5,
          color: mix("#3f6b25", "#a3c255", h / 0.14 + (rand() - 0.5) * 0.3),
          kind: "sway",
          params: [0.35, -0.63],
        };
      });

      // The sword, stuck in point first.
      const sword = k.part("sword", { pivot: [0, 0.9, 0], axis: [0, 0, 1] });
      const tip = -0.12;
      const base = 0.9;
      const W = 0.088;
      const T = 0.024;
      const halfW = (s) => W * (1 - 0.22 * (1 - s)) * Math.min(1, s / 0.09) ** 0.85;
      for (const side of [1, -1]) {
        const face = k.param(
          (u, v) => {
            const y = tip + v * (base - tip);
            const w = halfW(v);
            const x = (u * 2 - 1) * w;
            return [x, y, side * T * (1 - Math.abs(x / (w || 1)) ** 1.4)];
          },
          { grid: 48, flip: side < 0 },
        );
        k.add(face, {
          part: sword,
          flat: 0.15,
          weight: 1.6,
          pattern: false,
          kind: "glint",
          params: [0.12, 0],
          color: (c) => {
            const s = c.v;
            const w = halfW(s) || 1;
            const x = c.p[0] / w;
            let col = metal(c, "#e1e8ee");
            if (Math.abs(x) < 0.16 && s > 0.12 && s < 0.9) col = shade(col, 0.72);
            if (Math.abs(x) > 0.82) col = mix(col, "#ffffff", 0.35);
            return col;
          },
        });
      }
      // Cross-guard, grip and pommel.
      k.add(
        k.tube(
          spline([
            [-0.3, base + 0.07, 0],
            [-0.14, base + 0.015, 0],
            [0, base + 0.01, 0],
            [0.14, base + 0.015, 0],
            [0.3, base + 0.07, 0],
          ]),
          (t) => 0.03 + 0.012 * Math.abs(t - 0.5),
          { caps: true },
        ),
        { part: sword, flat: 0.2, weight: 1.6, pattern: false, color: (c) => gold(c) },
      );
      for (const x of [-0.3, 0.3])
        k.add(k.sphere(0.042), {
          pos: [x, base + 0.08, 0],
          part: sword,
          weight: 2,
          pattern: false,
          color: (c) => gold(c),
        });
      k.add(k.roundedBox(0.1, 0.1, 0.07, 4), {
        pos: [0, base + 0.02, 0],
        part: sword,
        weight: 2,
        pattern: false,
        color: (c) => gold(c),
      });
      for (const z of [0.036, -0.036])
        k.add(k.ellipsoid(0.028, 0.034, 0.012), {
          pos: [0, base + 0.02, z],
          part: sword,
          weight: 4,
          pattern: false,
          kind: "glint",
          params: [1, 0],
          color: (c) => gem(c, GEMS.ruby),
        });
      k.add(k.cylinder(0.034, 0.3, { caps: false }), {
        pos: [0, base + 0.22, 0],
        part: sword,
        weight: 1.5,
        pattern: false,
        color: (c) => {
          const a = Math.atan2(c.lp[0], c.lp[2]) / TAU;
          const wrap = fract(c.lp[1] * 16 + a) < 0.18;
          return lit(c, wrap ? "#3a2112" : "#6b3f22", 0.35);
        },
      });
      k.add(k.sphere(0.058), {
        pos: [0, base + 0.42, 0],
        part: sword,
        weight: 2,
        pattern: false,
        color: (c) => gold(c),
      });
      // Sparkles that gather round the sword once it is free.
      const aura = k.part("aura", { pivot: [0, 0.9, 0] });
      k.cloud({ share: 0.004, size: 1.3, pattern: false }, (rand) => {
        const y = tip + rand() * (base + 0.45 - tip);
        const a = rand() * TAU;
        const r = 0.08 + rand() * 0.14;
        return {
          p: [Math.sin(a) * r, y, Math.cos(a) * r * 0.6],
          color: mix("#ffd84a", "#fff3a8", rand()),
          opacity: 1,
          part: aura,
          kind: "twinkle",
          params: [0.5, rand() * TAU],
        };
      });
    },
  },

  // ---- Heraldic shield ---------------------------------------------------------
  shield: {
    options: [
      {
        key: "design",
        label: "Design",
        type: "select",
        default: "quarterly",
        choices: [
          { id: "quarterly", label: "Quarterly" },
          { id: "chevron", label: "Chevron" },
          { id: "cross", label: "Cross" },
          { id: "saltire", label: "Saltire" },
          { id: "bend", label: "Bend" },
          { id: "pale", label: "Per pale" },
          { id: "stars", label: "Stars" },
        ],
      },
      { key: "field", label: "Field", type: "color", default: "#1f4fa3" },
      { key: "charge", label: "Charge", type: "color", default: "#e8b93a" },
    ],
    build(k, o) {
      const W = 0.78;
      const yt = 0.92;
      const ys = 0.18;
      const yb = -1.08;
      const halfW = (y) => {
        if (y >= ys) return W;
        const t = (ys - y) / (ys - yb);
        return W * Math.pow(Math.max(0, 1 - Math.pow(t, 1.7)), 0.95);
      };
      const bow = (x, y) => 0.2 * (1 - (x / W) ** 2) + 0.05 * (1 - (y + 0.1) ** 2);
      const design = (X, Y) => {
        const f = o.field;
        const h = o.charge;
        switch (o.design) {
          case "chevron":
            return Math.abs(Y - (0.32 - 0.85 * Math.abs(X))) < 0.15 ? h : f;
          case "cross":
            return Math.abs(X) < 0.17 || Math.abs(Y - 0.2) < 0.15 ? h : f;
          case "saltire":
            return Math.abs(Y - 0.02 - 0.9 * X) < 0.2 || Math.abs(Y - 0.02 + 0.9 * X) < 0.2 ? h : f;
          case "bend":
            return Math.abs(Y - 0.05 + 0.95 * X) < 0.24 ? h : f;
          case "pale":
            return X < 0 ? f : h;
          case "stars":
            return inStar(X * W + 0.36, Y - 0.5, 0.2) ||
              inStar(X * W - 0.36, Y - 0.5, 0.2) ||
              inStar(X * W, Y + 0.28, 0.2)
              ? h
              : f;
          default:
            return X < 0 !== Y > 0.12 ? f : h;
        }
      };
      const g = group(k, [0, 0, 0], [-8, 0, 0]);
      const face = k.param(
        (u, v) => {
          const y = yb + v * (yt - yb);
          const x = (u * 2 - 1) * halfW(y);
          return [x, y, bow(x, y)];
        },
        { grid: 64 },
      );
      g.add(face, {
        flat: 0.15,
        interior: 0.05,
        core: "#6b4a2b",
        color: (c) => {
          const x = c.lp[0];
          const y = c.lp[1];
          let col = design(x / W, y);
          // Brush strokes and wear.
          const stroke = c.fbm(x * 3, y * 26, 0, 2);
          col = shade(col, 0.94 + 0.1 * stroke);
          const wear = c.noise(x * 12, y * 12, 3);
          if (wear > 0.62) col = mix(col, "#c9a77a", 0.35);
          return lit(c, col, 0.35, 0.25);
        },
      });
      // The wooden back with leather straps.
      const back = k.param(
        (u, v) => {
          const y = yb + v * (yt - yb);
          const x = (u * 2 - 1) * halfW(y);
          return [x, y, bow(x, y) - 0.06];
        },
        { grid: 48, flip: true },
      );
      g.add(back, {
        flat: 0.15,
        color: (c) => {
          const x = c.lp[0];
          const y = c.lp[1];
          if ((Math.abs(y - 0.35) < 0.05 || Math.abs(y + 0.2) < 0.05) && Math.abs(x) < 0.4)
            return keep(lit(c, "#5a3418", 0.3));
          return lit(c, wood(c, "#8a6038", [x, y, 0], 1), 0.3);
        },
      });
      // Iron rim and rivets.
      const pts = [];
      const N = 60;
      for (let i = 0; i <= 8; i++) pts.push([-W + (2 * W * i) / 8, yt]);
      for (let i = 1; i < N; i++) {
        const y = yt - (i / N) * (yt - yb);
        pts.push([halfW(y), y]);
      }
      pts.push([0, yb]);
      for (let i = N - 1; i >= 1; i--) {
        const y = yt - (i / N) * (yt - yb);
        pts.push([-halfW(y), y]);
      }
      const rim = pts.map(([x, y]) => [x, y, bow(x, y) - 0.02]);
      g.add(k.tube(spline(rim, { closed: true }), 0.042, { closed: true, samples: 400 }), {
        flat: 0.2,
        weight: 1.4,
        pattern: false,
        kind: "glint",
        params: [0.12, 0],
        color: (c) => metal(c, "#a9b0b8"),
      });
      for (let i = 0; i < 18; i++) {
        const [x, y] = pts[Math.floor(((i + 0.5) / 18) * pts.length)];
        const px = x * (1 - 0.09 / W);
        const py = y > yt - 0.01 ? y - 0.08 : y < -0.85 ? y + 0.07 : y;
        g.add(k.sphere(0.022), {
          pos: [px, py, bow(px, py) + 0.008],
          weight: 3,
          pattern: false,
          color: (c) => metal(c, "#b8bec6"),
        });
      }
    },
  },

  // ---- Bow and target -----------------------------------------------------------
  "bow-and-target": {
    alive: true,
    controls: [{ key: "shot", label: "Shoot", type: "toggle", default: 0, ease: 1.3 }],
    action: { key: "shot", label: "Shoot", sound: { on: "whoosh", off: "click" } },
    drive(t, c, out) {
      const G = BOW;
      const dir = direction(c, "shot");
      const v = c.shot;
      let draw = 0;
      let s = 0;
      let vis = 1;
      let wob = 0;
      let twang = 0;
      if (dir === -1) {
        // A fresh arrow on the string.
        vis = smoothstep(1, 0.55, v);
      } else if (dir === 0) {
        s = v > 0.5 ? 1 : 0;
      } else {
        draw = 0.17 * ease(v / 0.28) * (1 - band(v, 0.3, 0.33));
        s = band(v, 0.32, 0.78);
        if (v > 0.32) twang = 0.05 * Math.sin((v - 0.32) * 90) * Math.exp(-(v - 0.32) * 10);
        if (v > 0.78) wob = 0.12 * Math.sin((v - 0.78) * 70) * Math.exp(-(v - 0.78) * 16);
      }
      const d = vec.sub(G.end, G.tip);
      const p = vec.add(vec.mul(d, s), [draw, 4 * G.arc * s * (1 - s), 0]);
      const tan = vec.add(d, [0, 4 * G.arc * (1 - 2 * s), 0]);
      const q = quatMul(quatAxisAngle([0, 0, 1], wob), quatFromTo([-1, 0, 0], tan));
      out.parts.arrow = { offset: p, quat: q, visible: vis };
      const pull = draw + twang;
      out.parts.stringUp = { angle: Math.atan2(pull, G.half) };
      out.parts.stringDown = { angle: -Math.atan2(pull, G.half) };
    },
    build(k) {
      const G = BOW;
      const ground = -0.74;
      // A patch of grass under both.
      k.add(k.disc(1), {
        pos: [0, ground, 0],
        scale: [1.5, 1, 0.78],
        flat: 0.3,
        color: (c) => {
          const r = Math.hypot(c.p[0] / 1.5, c.p[2] / 0.78);
          if (r > 0.86 + 0.12 * c.noise(c.p[0] * 5, 0, c.p[2] * 5)) return null;
          if (c.n[1] < 0) return "#3d5a22";
          const n = c.fbm(c.p[0] * 6, 0, c.p[2] * 6, 3);
          return mix("#5f8f31", "#8fb947", clamp(0.5 + 0.6 * n, 0, 1));
        },
      });
      k.cloud({ share: 0.03, size: 0.8 }, (rand) => {
        const a = rand() * TAU;
        const r = Math.sqrt(rand()) * 0.85;
        const h = rand() * 0.07;
        return {
          p: [Math.sin(a) * r * 1.5, ground + h, Math.cos(a) * r * 0.78],
          dir: [(rand() - 0.5) * 0.5, 1, (rand() - 0.5) * 0.5],
          stretch: 2.2,
          color: mix("#4f7f2a", "#b3d160", h / 0.07),
          kind: "sway",
          params: [0.25, ground],
        };
      });

      // The target: a straw boss with painted rings, on an easel.
      const TC = G.target;
      const ringCols = ["#f5c93c", "#e0453a", "#3c8fdc", "#2a2a2a", "#f3efe4"];
      k.add(k.cylinder(0.5, 0.16), {
        pos: TC,
        rot: [0, 0, -90],
        flat: 0.2,
        interior: 0.08,
        core: "#b8934f",
        color: (c) => {
          if (c.s.cap === "top") {
            const r = c.s.radial * 10;
            const i = Math.min(4, Math.floor(r / 2));
            let col = ringCols[i];
            if (Math.abs(r - Math.round(r)) < 0.07 && r > 0.5 && r < 9.7)
              col = i === 3 ? "#8a8a8a" : "#262626";
            return keep(lit(c, col, 0.2));
          }
          const straw = c.fbm(c.p[0] * 30, c.p[1] * 8, c.p[2] * 30, 2);
          const coil = fract(Math.atan2(c.lp[0], c.lp[2]) * 3 + c.lp[1] * 4) < 0.1;
          return lit(c, mix(coil ? "#9c7a3b" : "#d9b36a", "#b28a45", 0.5 + 0.5 * straw), 0.3);
        },
      });
      const leg = (a, b) =>
        k.add(
          k.tube((t) => vec.add(a, vec.mul(vec.sub(b, a), t)), 0.028, { grid: 16, samples: 8 }),
          {
            flat: 0.2,
            color: (c) => lit(c, wood(c, "#7a5230", c.p, 1), 0.3),
          },
        );
      leg([TC[0] + 0.16, ground, 0.36], [TC[0] - 0.02, TC[1] + 0.52, 0.1]);
      leg([TC[0] + 0.16, ground, -0.36], [TC[0] - 0.02, TC[1] + 0.52, -0.1]);
      leg([TC[0] - 0.45, ground, 0], [TC[0] - 0.1, TC[1] + 0.4, 0]);
      leg([TC[0] + 0.06, TC[1] - 0.46, -0.32], [TC[0] + 0.06, TC[1] - 0.46, 0.32]);

      // The bow: a stave in the XY plane, its back towards the target.
      const stave = spline([
        [G.sx, -G.half - 0.02, 0],
        [G.sx - 0.07, -0.5, 0],
        [G.sx - 0.18, -0.2, 0],
        [G.sx - 0.21, 0, 0],
        [G.sx - 0.18, 0.2, 0],
        [G.sx - 0.07, 0.5, 0],
        [G.sx, G.half + 0.02, 0],
      ]);
      k.add(
        k.tube(stave, (t) => 0.018 + 0.024 * Math.pow(1 - Math.abs(2 * t - 1), 1.5), {
          caps: true,
        }),
        {
          flat: 0.2,
          weight: 1.6,
          color: (c) => {
            if (Math.abs(c.p[1]) < 0.09) {
              const wrap = fract(c.p[1] * 40) < 0.25;
              return lit(c, wrap ? "#3b2414" : "#5c3a22", 0.3);
            }
            return lit(c, wood(c, "#b8773a", c.p, 1, 0.8), 0.3, 0.3);
          },
        },
      );
      // The string, in two halves hinged at the tips.
      const up = k.part("stringUp", { pivot: [G.sx, G.half, 0], axis: [0, 0, 1] });
      const down = k.part("stringDown", { pivot: [G.sx, -G.half, 0], axis: [0, 0, 1] });
      const str = { flat: 0.3, weight: 3, pattern: false, color: "#f1ead6" };
      const hu = G.half - G.nockY;
      const hd = G.half + G.nockY;
      k.add(k.cylinder(0.01, hu, { caps: false }), {
        ...str,
        pos: [G.sx, G.nockY + hu / 2, 0],
        part: up,
      });
      k.add(k.cylinder(0.01, hd, { caps: false }), {
        ...str,
        pos: [G.sx, G.nockY - hd / 2, 0],
        part: down,
      });

      // The arrow, nocked: its tip is the pivot of its flight.
      const arrow = k.part("arrow", { pivot: G.tip });
      const len = G.sx - G.tip[0];
      k.add(k.cylinder(0.016, len - 0.08, { caps: false }), {
        part: arrow,
        pos: [G.tip[0] + (len + 0.08) / 2, G.tip[1], 0],
        rot: [0, 0, 90],
        flat: 0.25,
        weight: 2,
        pattern: false,
        color: (c) => lit(c, wood(c, "#c79a5a", c.p, 0), 0.25),
      });
      k.add(k.cone(0.034, 0, 0.1), {
        part: arrow,
        pos: [G.tip[0] + 0.05, G.tip[1], 0],
        rot: [0, 0, 90],
        weight: 3,
        pattern: false,
        color: (c) => metal(c, "#9aa3ad"),
      });
      for (let i = 0; i < 3; i++) {
        const a = (i / 3) * TAU + 0.5;
        const vane = k.param(
          (u, v) => {
            const x = G.sx - 0.04 - v * 0.17;
            const h = 0.012 + u * 0.05 * Math.sin(Math.PI * Math.min(1, v * 1.15)) ** 0.7;
            return [x, G.tip[1] + Math.sin(a) * h, Math.cos(a) * h];
          },
          { grid: 16 },
        );
        k.add(vane, {
          part: arrow,
          flat: 0.2,
          weight: 3,
          pattern: false,
          color: (c) => lit(c, i === 0 ? "#d8342c" : "#f4f1ea", 0.2),
        });
      }
    },
  },

  // ---- Trebuchet ------------------------------------------------------------------
  trebuchet: {
    alive: true,
    controls: [{ key: "launch", label: "Launch", type: "pulse", ease: 4.2 }],
    action: { key: "launch", label: "Launch", sound: "whoosh" },
    drive(t, c, out) {
      const T = TREB;
      const u = 1 - c.launch;
      const th = T.angle(u);
      const q = quatAxisAngle([0, 0, 1], th);
      const swing = (p) => vec.sub(vec.add(T.axle, quatRotate(q, vec.sub(p, T.axle))), p);
      out.parts.arm = { angle: th };
      // The weight hangs straight down from its hinge, swaying a little.
      const sway = u > T.tRel && u < 0.7 ? 0.25 * Math.sin((u - T.tRel) * 30) * (0.7 - u) : 0;
      out.parts.weight = { offset: swing(T.hinge), quat: quatAxisAngle([0, 0, 1], sway) };
      let stone = swing(T.stone);
      let vis = 1;
      if (u >= T.tRel && u < 0.5) {
        const tau = (u - T.tRel) / (0.5 - T.tRel);
        const qr = quatAxisAngle([0, 0, 1], T.rel);
        const pr = vec.add(T.axle, quatRotate(qr, vec.sub(T.stone, T.axle)));
        const p = vec.add(pr, [2.3 * tau, 0.9 * tau - 1.3 * tau * tau, -1.4 * tau]);
        stone = vec.sub(p, T.stone);
        vis = 1 - tau ** 1.4;
      } else if (u >= 0.5) vis = smoothstep(0.86, 0.98, u);
      out.parts.stone = { offset: stone, visible: vis };
    },
    build(k) {
      const T = TREB;
      const oak = "#a0703f";
      const dark = "#6f4a27";
      const iron = "#5d6167";
      const g = group(k);
      const plank = (a, b, w, col = oak, extra = {}) =>
        beam(g, a, b, w, col, { weight: 1.2, ...extra });
      // Base frame and wheels.
      for (const z of [-0.3, 0.3]) {
        plank([-0.85, 0.1, z], [0.85, 0.1, z], 0.085);
        plank([-0.42, 0.14, z], [0.05, 0.98, z], 0.07);
        plank([0.52, 0.14, z], [0.05, 0.98, z], 0.07);
        plank([0.05, 0.14, z], [0.05, 0.98, z], 0.06, dark);
        plank([-0.2, 0.55, z], [0.3, 0.55, z], 0.05, dark);
        k.add(k.cylinder(0.14, 0.05), {
          pos: [-0.62, 0.14, z * 1.3],
          rot: [90, 0, 0],
          flat: 0.2,
          color: (c) => spokes(c),
        });
        k.add(k.cylinder(0.14, 0.05), {
          pos: [0.62, 0.14, z * 1.3],
          rot: [90, 0, 0],
          flat: 0.2,
          color: (c) => spokes(c),
        });
      }
      function spokes(c) {
        if (c.s.cap) {
          const r = c.s.radial;
          const a = c.u * 6;
          if (r > 0.82) return lit(c, "#3f3a36", 0.3);
          if (r < 0.22) return lit(c, iron, 0.3);
          if (Math.abs(a - Math.round(a)) < 0.09) return lit(c, oak, 0.3);
          return null;
        }
        return lit(c, "#3f3a36", 0.3);
      }
      for (const x of [-0.8, 0, 0.8]) plank([x, 0.1, -0.36], [x, 0.1, 0.36], 0.08, dark);
      k.add(k.cylinder(0.035, 0.74), {
        pos: T.axle,
        rot: [90, 0, 0],
        flat: 0.2,
        weight: 1.5,
        color: (c) => metal(c, "#8b9097"),
      });
      // A few spare stones on the ground.
      for (const [x, z, s] of [
        [0.7, 0.5, 0.07],
        [0.84, 0.44, 0.06],
        [0.76, 0.36, 0.065],
      ])
        k.add(k.sphere(s), {
          pos: [x, s * 0.9, z],
          flat: 0.3,
          weight: 1.6,
          color: (c) =>
            lit(
              c,
              mix("#8e8a84", "#62605c", 0.5 + c.noise(c.p[0] * 30, c.p[1] * 30, c.p[2] * 30)),
              0.35,
            ),
        });

      // The throwing arm, on the axle.
      const arm = k.part("arm", { pivot: T.axle, axis: [0, 0, 1] });
      const ag = { kit: k, add: (s, o) => k.add(s, { ...o, part: arm }) };
      beam(ag, T.hinge, T.tip, 0.075, oak, { weight: 1.3, depth: 0.09 });
      for (const f of [0.15, 0.55, 0.9]) {
        const p = vec.add(T.hinge, vec.mul(vec.sub(T.tip, T.hinge), f));
        k.add(k.box(0.09, 0.03, 0.105), {
          pos: p,
          quat: quatFromTo([0, 1, 0], T.dl),
          part: arm,
          flat: 0.2,
          weight: 2,
          color: (c) => lit(c, iron, 0.3),
        });
      }
      // The sling's pouch at the long end.
      k.add(k.sphere(0.1), {
        pos: T.stone,
        scale: [1, 0.6, 1],
        part: arm,
        flat: 0.25,
        color: (c) => (c.lp[1] > 0.02 ? null : lit(c, "#8a6a45", 0.3)),
      });
      // The counterweight: a box of stones hanging from a hinge.
      const weight = k.part("weight", { pivot: T.hinge, axis: [0, 0, 1] });
      const box = vec.add(T.hinge, [0, -0.3, 0]);
      for (const z of [-0.07, 0.07])
        k.add(k.box(0.03, 0.2, 0.03), {
          pos: vec.add(T.hinge, [0, -0.09, z]),
          part: weight,
          weight: 2,
          color: (c) => lit(c, iron, 0.3),
        });
      k.add(k.box(0.3, 0.26, 0.26), {
        pos: box,
        part: weight,
        flat: 0.2,
        interior: 0.1,
        core: "#77736d",
        color: (c) => {
          const b = Math.abs(c.lp[1]) > 0.1 || Math.abs(c.lp[0]) > 0.13;
          return lit(c, b ? iron : wood(c, dark, c.lp, 0), 0.3);
        },
      });
      // The stone.
      const stone = k.part("stone", { pivot: T.stone });
      k.add(k.sphere(0.075), {
        pos: T.stone,
        part: stone,
        flat: 0.3,
        weight: 1.6,
        pattern: false,
        color: (c) => {
          const n = c.fbm(c.p[0] * 25, c.p[1] * 25, c.p[2] * 25, 2);
          return lit(c, mix("#a19c95", "#66625d", 0.5 + 0.7 * n), 0.4);
        },
      });
      k.reach([T.axle[0], T.axle[1] + 0.75, 0]);
    },
  },

  // ---- Crossbow ---------------------------------------------------------------------
  crossbow: {
    alive: true,
    controls: [{ key: "shoot", label: "Shoot", type: "pulse", ease: 2.6 }],
    action: { key: "shoot", label: "Shoot", sound: "whoosh" },
    drive(t, c, out) {
      const X = XBOW;
      const u = 1 - c.shoot;
      let rel = 0;
      if (u > 0.04 && u < 0.72) rel = band(u, 0.04, 0.08);
      else if (u >= 0.72) rel = 1 - easeInOut(band(u, 0.72, 0.9));
      const buzz = u > 0.08 && u < 0.5 ? 0.05 * Math.sin(u * 160) * Math.exp(-(u - 0.08) * 12) : 0;
      const r = rel + buzz * rel;
      out.parts.stringL = { quat: quatAxisAngle(X.left.axis, X.left.angle * r) };
      out.parts.stringR = { quat: quatAxisAngle(X.right.axis, X.right.angle * r) };
      let dz = 0;
      let vis = 1;
      if (u > 0.05 && u < 0.3) {
        const f = band(u, 0.05, 0.3);
        dz = 3.2 * f ** 1.3;
        vis = 1 - f;
      } else if (u >= 0.3) vis = smoothstep(0.86, 0.98, u);
      out.parts.bolt = { offset: vec.mul(X.fwd, dz), visible: vis };
      out.parts.trigger = { angle: u < 0.12 ? 0.35 * Math.sin((u / 0.12) * Math.PI) : 0 };
    },
    build(k) {
      const X = XBOW;
      const g = group(k, [0, 0, 0], X.q);
      const walnut = "#7b4b26";
      const steel = "#8d949c";
      // Stock: a shoulder butt and the long tiller with the bolt groove.
      g.add(k.roundedBox(0.16, 0.27, 0.42, 5), {
        pos: [0, -0.1, -0.68],
        rot: [12, 0, 0],
        flat: 0.2,
        interior: 0.1,
        core: "#5a3517",
        color: (c) => lit(c, wood(c, walnut, c.lp, 2), 0.35, 0.2),
      });
      g.add(k.roundedBox(0.13, 0.12, 1.1, 6), {
        pos: [0, 0, 0.02],
        flat: 0.2,
        interior: 0.1,
        core: "#5a3517",
        color: (c) => {
          if (c.lp[1] > 0.045 && Math.abs(c.lp[0]) < 0.018) return keep(lit(c, "#3b220f", 0.2));
          return lit(c, wood(c, walnut, c.lp, 2), 0.35, 0.2);
        },
      });
      for (const z of [0.3, -0.3])
        g.add(k.roundedBox(0.125, 0.125, 0.05, 6), {
          pos: [0, 0, z],
          flat: 0.2,
          weight: 2,
          pattern: false,
          color: (c) => metal(c, steel),
        });
      // The prod (bow) across the front, and a stirrup.
      const prod = spline([
        [X.tipL[0], X.tipL[1], X.tipL[2]],
        [-0.32, 0.03, 0.43],
        [0, 0.03, 0.48],
        [0.32, 0.03, 0.43],
        [X.tipR[0], X.tipR[1], X.tipR[2]],
      ]);
      g.add(
        k.tube(prod, (t) => 0.022 + 0.026 * (1 - Math.abs(2 * t - 1)), { caps: true }),
        {
          flat: 0.2,
          weight: 1.5,
          pattern: false,
          kind: "glint",
          params: [0.12, 0],
          color: (c) => metal(c, "#6f767e"),
        },
      );
      g.add(
        k.tube(
          spline([
            [-0.07, 0.0, 0.52],
            [-0.1, -0.05, 0.64],
            [0, -0.07, 0.7],
            [0.1, -0.05, 0.64],
            [0.07, 0.0, 0.52],
          ]),
          0.014,
        ),
        { flat: 0.2, weight: 2, pattern: false, color: (c) => metal(c, steel) },
      );
      // The latch that holds the string, and the trigger below.
      g.add(k.cylinder(0.035, 0.06), {
        pos: X.latch,
        rot: [0, 0, 90],
        weight: 2,
        pattern: false,
        color: (c) => metal(c, "#b09a6a"),
      });
      const trigger = k.part("trigger", { pivot: g.pt([0, -0.05, -0.2]), axis: X.side });
      g.add(
        k.tube(
          spline([
            [0, -0.04, -0.2],
            [0, -0.14, -0.26],
            [0, -0.26, -0.36],
            [0, -0.34, -0.5],
          ]),
          (t) => 0.016 - 0.006 * t,
          { caps: true },
        ),
        { part: trigger, flat: 0.2, weight: 2, pattern: false, color: (c) => metal(c, steel) },
      );
      // The string, cocked back to the latch, in two halves hinged at the tips.
      for (const [name, tip] of [
        ["stringL", X.tipL],
        ["stringR", X.tipR],
      ]) {
        const part = k.part(name, { pivot: g.pt(tip) });
        const a = tip;
        const b = X.latch;
        g.add(
          k.tube((s) => vec.add(a, vec.mul(vec.sub(b, a), s)), 0.009, { grid: 12, samples: 8 }),
          { part, flat: 0.3, weight: 3, pattern: false, color: "#efe6cf" },
        );
      }
      // The bolt: a short heavy arrow in the groove.
      const bolt = k.part("bolt", { pivot: g.pt([0, 0.085, 0.2]) });
      g.add(k.cylinder(0.018, 0.66, { caps: false }), {
        part: bolt,
        pos: [0, 0.085, 0.22],
        rot: [90, 0, 0],
        flat: 0.25,
        weight: 2,
        pattern: false,
        color: (c) => lit(c, wood(c, "#c49a62", c.lp, 1), 0.3),
      });
      g.add(k.cone(0.036, 0, 0.12), {
        part: bolt,
        pos: [0, 0.085, 0.61],
        rot: [90, 0, 0],
        weight: 3,
        pattern: false,
        color: (c) => metal(c, "#9aa3ad"),
      });
      for (const a of [-0.6, 0.6]) {
        const vane = k.param(
          (uu, v) => {
            const h = 0.012 + uu * 0.04 * Math.sin(Math.PI * Math.min(1, v * 1.2)) ** 0.7;
            return [Math.sin(a) * h, 0.085 + Math.cos(a) * h, -0.08 + v * 0.13];
          },
          { grid: 12 },
        );
        g.add(vane, {
          part: bolt,
          flat: 0.2,
          weight: 3,
          pattern: false,
          color: (c) => lit(c, "#2f5f9e", 0.25),
        });
      }
    },
  },

  // ---- Knight's helmet --------------------------------------------------------------
  "knights-helmet": {
    alive: true,
    options: [{ key: "plume", label: "Plume", type: "color", default: "#c8262e" }],
    controls: [{ key: "visor", label: "Visor", type: "toggle", default: 0, ease: 0.9 }],
    action: { key: "visor", label: "Open the visor", sound: { on: "open", off: "close" } },
    drive(t, c, out) {
      out.parts.visor = { angle: -1.5 * easeInOut(c.visor) };
      out.amount = 0.8;
    },
    build(k, o) {
      const steel = "#bcc5cf";
      const brass = "#c9a045";
      const prof = [
        [0.45, -0.74],
        [0.49, -0.69],
        [0.44, -0.6],
        [0.46, -0.46],
        [0.5, -0.26],
        [0.53, 0.0],
        [0.53, 0.18],
        [0.5, 0.38],
        [0.42, 0.55],
        [0.28, 0.68],
        [0.12, 0.745],
        [0, 0.76],
      ];
      const skull = k.lathe(prof, { grid: 80 });
      // The profile's radius at a height (the profile rises monotonically).
      const table = [];
      for (let i = 0; i <= 400; i++) table.push(skull.profileAt(i / 400));
      const rAt = (y) => {
        let lo = 0;
        let hi = 400;
        while (hi - lo > 1) {
          const m = (lo + hi) >> 1;
          if (table[m][1] < y) lo = m;
          else hi = m;
        }
        const a = table[lo];
        const b = table[hi];
        return a[0] + (b[0] - a[0]) * clamp((y - a[1]) / (b[1] - a[1] || 1), 0, 1);
      };
      const front = (c) => {
        const a = Math.atan2(c.lp[0], c.lp[2]);
        return Math.abs(a) < 62 * DEG && c.lp[1] > -0.4 && c.lp[1] < 0.3;
      };
      k.add(skull, {
        flat: 0.18,
        interior: 0,
        core: "#2a2a2e",
        kind: "glint",
        params: [0.08, 0],
        color: (c) => {
          if (front(c)) return null;
          let col = metal(c, steel);
          if (c.lp[1] < -0.62 && c.lp[1] > -0.66) col = gold(c, brass);
          return col;
        },
      });
      // Dark inside.
      k.add(
        k.lathe(
          prof.map(([r, y]) => [r * 0.92, y * 0.97]),
          { grid: 48 },
        ),
        {
          flat: 0.3,
          pattern: false,
          color: (c) => shade("#17161a", 0.8 + 0.4 * Math.max(0, c.lp[1])),
        },
      );
      // A comb along the crown.
      k.add(
        k.tube((t) => {
          // Up the back of the profile, over the top, down to the brow.
          const back = t < 0.5;
          const s = back ? 0.2 + 0.8 * (t / 0.5) : 1 - 0.23 * ((t - 0.5) / 0.5);
          const [r, y] = skull.profileAt(s);
          return [0, y + 0.012, (back ? -1 : 1) * (r + 0.012)];
        }, 0.018),
        { flat: 0.2, weight: 1.4, pattern: false, color: (c) => gold(c, brass) },
      );
      // Rivets round the rim.
      for (let i = 0; i < 16; i++) {
        const a = (i / 16) * TAU;
        const r = rAt(-0.52) + 0.005;
        k.add(k.sphere(0.018), {
          pos: [Math.sin(a) * r, -0.52, Math.cos(a) * r],
          weight: 3,
          pattern: false,
          color: (c) => gold(c, brass),
        });
      }
      // The visor: a pointed shell over the face with an eye slit and
      // breathing holes, hinged at the sides.
      const visor = k.part("visor", { pivot: [0, 0.1, 0], axis: [1, 0, 0] });
      const A = 70 * DEG;
      const vis = k.param(
        (u, v) => {
          const a = (u * 2 - 1) * A;
          const y = -0.44 + v * 0.8;
          const bulge = Math.pow(Math.max(0, 1 - Math.abs(a) / A), 1.6);
          const prof = Math.sin(Math.PI * clamp((y + 0.44) / 0.8, 0, 1)) ** 0.8;
          const r = rAt(y) + 0.035 + 0.13 * bulge * prof;
          return [Math.sin(a) * r, y, Math.cos(a) * r];
        },
        { grid: 64 },
      );
      k.add(vis, {
        part: visor,
        flat: 0.18,
        weight: 1.2,
        kind: "glint",
        params: [0.08, 0],
        color: (c) => {
          const a = c.u * 2 - 1;
          const y = -0.44 + c.v * 0.8;
          if (y > 0.07 && y < 0.14 && Math.abs(a) < 0.72) return null;
          if (Math.abs(a) > 0.93 || c.v > 0.95 || c.v < 0.04) return keep(gold(c, brass));
          if (y < -0.08 && y > -0.34 && a > 0.12 && a < 0.7) {
            const gx = fract(a * 11);
            const gy = fract(y * 16);
            if (Math.hypot(gx - 0.5, gy - 0.5) < 0.24) return keep("#141316");
          }
          return metal(c, steel);
        },
      });
      for (const s of [-1, 1])
        k.add(k.sphere(0.04), {
          pos: [s * (rAt(0.1) + 0.02), 0.1, 0],
          weight: 3,
          pattern: false,
          color: (c) => gold(c, brass),
        });
      // A plume of feathers that sways.
      const holder = [0, 0.66, -0.3];
      k.add(k.cylinder(0.045, 0.14), {
        pos: holder,
        rot: [-35, 0, 0],
        weight: 2,
        pattern: false,
        color: (c) => gold(c, brass),
      });
      for (let i = 0; i < 9; i++) {
        const s = (i - 4) / 4;
        const lift = 1 - Math.abs(s) * 0.35;
        const curve = spline([
          vec.add(holder, [0, 0.04, 0]),
          [s * 0.1, 0.84 + 0.12 * lift, -0.36],
          [s * 0.22, 0.98 + 0.12 * lift, -0.52],
          [s * 0.3, 0.92 + 0.1 * lift, -0.78],
          [s * 0.34, 0.7 + 0.06 * lift, -0.98],
        ]);
        const white = i % 2 === 1;
        k.add(
          k.tube(curve, (t) => 0.018 + 0.05 * Math.sin(Math.PI * Math.min(1, t * 1.1)) ** 0.8),
          {
            flat: 0.35,
            weight: 0.8,
            kind: "sway",
            params: [0.3, 0.6],
            color: (c) => {
              const base = white ? "#f3eee6" : o.plume;
              const barb = 0.85 + 0.25 * Math.abs(Math.sin(c.t * 90 + c.u * 3));
              return shade(lit(c, base, 0.3), barb);
            },
          },
        );
      }
    },
  },

  // ---- Crown ------------------------------------------------------------------------
  crown: {
    alive: true,
    options: [{ key: "velvet", label: "Velvet", type: "color", default: "#8e1430" }],
    build(k, o) {
      const R = (y) => 0.6 + 0.07 * (y + 0.3);
      const top = (u) => {
        const x = fract(u * 8 + 0.5) - 0.5;
        const d = Math.abs(x) * 2;
        const big = d < 0.5 ? 0.52 * Math.pow(1 - d / 0.5, 1.25) : 0;
        const small = d > 0.78 ? 0.2 * (1 - (1 - d) / 0.22) : 0;
        return 0.06 + Math.max(big, small);
      };
      const bandShape = (inset) =>
        k.param(
          (u, v) => {
            const a = u * TAU;
            const y = -0.3 + v * (top(u) + 0.3);
            const r = R(y) - inset;
            return [Math.sin(a) * r, y, Math.cos(a) * r];
          },
          { grid: 96, flip: inset > 0 },
        );
      k.add(bandShape(0), {
        flat: 0.15,
        kind: "glint",
        params: [0.1, 0],
        interior: 0,
        color: (c) => {
          const y = c.lp[1];
          let col = gold(c, undefined, 0.4);
          if (Math.abs(y - 0.04) < 0.012 || Math.abs(y + 0.26) < 0.012)
            col = keep(shade(col, 0.75));
          return col;
        },
      });
      k.add(bandShape(0.03), { flat: 0.15, color: (c) => shade(gold(c), 0.7) });
      // Pearls on every point, and a string of small ones round the band.
      for (let i = 0; i < 16; i++) {
        const u = i / 16;
        const a = u * TAU;
        const y = top(u) + (i % 2 ? 0.02 : 0.035);
        const r = R(y);
        k.add(k.sphere(i % 2 ? 0.032 : 0.048), {
          pos: [Math.sin(a) * r, y, Math.cos(a) * r],
          weight: 3,
          pattern: false,
          kind: "glint",
          params: [0.6, 0],
          color: (c) => lit(c, "#f6efe2", 0.35, 0.6),
        });
      }
      // Gems set round the band.
      const gemCols = [GEMS.ruby, GEMS.sapphire, GEMS.emerald, GEMS.sapphire];
      for (let i = 0; i < 8; i++) {
        const a = (i / 8) * TAU;
        const r = R(-0.13) + 0.012;
        k.add(k.ellipsoid(0.066, 0.08, 0.035), {
          pos: [Math.sin(a) * r, -0.13, Math.cos(a) * r],
          rot: [0, (a * 180) / Math.PI, 0],
          weight: 4,
          pattern: false,
          kind: "glint",
          params: [1.1, 0],
          color: (c) => gem(c, gemCols[i % 4]),
        });
        k.add(k.torus(0.075, 0.012), {
          pos: [Math.sin(a) * r, -0.13, Math.cos(a) * r],
          rot: [90, (a * 180) / Math.PI, 0],
          scale: [1, 1, 1.15],
          weight: 2,
          pattern: false,
          color: (c) => gold(c),
        });
        const a2 = a + TAU / 16;
        const r2 = R(-0.12) + 0.01;
        k.add(k.sphere(0.03), {
          pos: [Math.sin(a2) * r2, -0.12, Math.cos(a2) * r2],
          weight: 3,
          pattern: false,
          color: (c) => lit(c, "#f6efe2", 0.35, 0.6),
        });
      }
      // The velvet cap and a golden orb on top.
      k.add(k.ellipsoid(0.56, 0.5, 0.56), {
        pos: [0, -0.08, 0],
        flat: 0.3,
        color: (c) => {
          if (c.lp[1] < 0.1) return null;
          const a = Math.atan2(c.lp[0], c.lp[2]);
          const fold = 0.78 + 0.3 * Math.abs(Math.sin(a * 4));
          return lit(c, shade(o.velvet, fold), 0.4, 0.15);
        },
      });
      k.add(k.sphere(0.09), {
        pos: [0, 0.46, 0],
        weight: 2,
        kind: "glint",
        params: [0.5, 0],
        color: (c) => gold(c),
      });
      k.add(k.sphere(0.035), {
        pos: [0, 0.575, 0],
        weight: 3,
        pattern: false,
        color: (c) => lit(c, "#f6efe2", 0.35, 0.6),
      });
      // Ermine trim.
      k.add(k.torus(0.62, 0.075), {
        pos: [0, -0.33, 0],
        flat: 0.35,
        pattern: false,
        color: (c) => {
          const a = (Math.atan2(c.lp[0], c.lp[2]) / TAU + 0.5) * 18;
          const odd = Math.floor(a) % 2 === 1;
          const row = odd ? Math.sin(c.v * TAU) : Math.cos(c.v * TAU);
          if (Math.abs(fract(a) - 0.5) < 0.07 && Math.abs(row - 0.75) < 0.2) return "#16161a";
          const fur = c.noise(c.p[0] * 60, c.p[1] * 60, c.p[2] * 60);
          return lit(c, shade("#f7f5ef", 0.92 + 0.08 * fur), 0.3);
        },
      });
    },
  },

  // ---- Dragon egg ---------------------------------------------------------------------
  "dragon-egg": {
    alive: true,
    options: [
      {
        key: "egg",
        label: "Egg",
        type: "select",
        default: "emerald",
        choices: [
          { id: "emerald", label: "Emerald" },
          { id: "ruby", label: "Ruby" },
          { id: "sapphire", label: "Sapphire" },
          { id: "gold", label: "Gold" },
        ],
      },
    ],
    controls: [{ key: "hatch", label: "Hatch", type: "toggle", default: 0, ease: 1.8 }],
    action: { key: "hatch", label: "Hatch", sound: { on: "pop", off: "close" } },
    drive(t, c, out) {
      const o = easeInOut(c.hatch);
      for (let i = 0; i < 3; i++) out.parts[`shell${i}`] = { angle: 1.75 * o };
      const up = easeInOut(band(c.hatch, 0.25, 1));
      out.parts.dragon = {
        offset: [0, 0.2 * up, 0],
        quat: quatAxisAngle([1, 0, 0], up * 0.12 * Math.sin(t * 2.4)),
        visible: smoothstep(0.08, 0.35, c.hatch),
      };
      out.amount = 0.3 + 0.7 * up;
    },
    build(k, o) {
      const pal = {
        emerald: ["#1c8a5a", "#5fd39a", "#0e4f3a"],
        ruby: ["#b2203a", "#ff7a7a", "#5e0f22"],
        sapphire: ["#2350b8", "#7fb0ff", "#15245e"],
        gold: ["#c99522", "#ffe08a", "#6e4a10"],
      }[o.egg];
      const yc = 0.05;
      const H = 0.68;
      const r = (y) => {
        const t = clamp((y - yc) / H, -1, 1);
        return 0.5 * Math.sqrt(Math.max(0, 1 - t * t)) * (1 - 0.14 * t);
      };
      const ybot = yc - H;
      const ytop = yc + H;
      const zig = (x) => Math.abs(fract(x) - 0.5) * 4 - 1;
      const crack = (u) => 0.18 + 0.045 * zig(u * 15);
      const at = (u, y, s = 1) => {
        const a = u * TAU;
        const rr = r(y) * s;
        return [Math.sin(a) * rr, y, Math.cos(a) * rr];
      };
      const scales = (c, u, y) => {
        const j = Math.floor(y * 16);
        const cu = fract(u * 22 + (j % 2 ? 0.5 : 0));
        const cy = fract(y * 16);
        const e = Math.hypot((cu - 0.5) * 2, cy);
        const shine = 0.5 + 0.5 * Math.sin(u * TAU * 2 + y * 4);
        let col = mix(pal[0], pal[1], 0.25 + 0.45 * shine * (1 - e));
        if (e > 0.88) col = mix(col, pal[2], 0.7);
        return lit(c, col, 0.35, 0.35);
      };
      const cream = (c) =>
        lit(c, mix("#fbf1d6", "#e8d2a0", 0.5 + 0.5 * c.noise(c.p[0] * 20, c.p[1] * 20, 0)), 0.2);
      // The bottom of the shell stays in the nest.
      const cup = (s) =>
        k.param(
          (u, v) => {
            const y = ybot + v * (crack(u) - ybot);
            return at(u, y, s);
          },
          { grid: 64, flip: s < 1 },
        );
      k.add(cup(1), {
        flat: 0.18,
        kind: "glint",
        params: [0.1, 0],
        color: (c) => scales(c, c.u, c.p[1]),
      });
      k.add(cup(0.95), { flat: 0.2, color: cream });
      // Three pieces of the top open like petals.
      for (let i = 0; i < 3; i++) {
        const am = ((i + 0.5) / 3) * TAU;
        const pivot = at((i + 0.5) / 3, 0.18);
        const part = k.part(`shell${i}`, { pivot, axis: [Math.cos(am), 0, -Math.sin(am)] });
        const petal = (s) =>
          k.param(
            (su, w) => {
              const u0 = (i + su) / 3;
              const y0 = crack(u0) + w * (ytop - crack(u0));
              const u = u0 + 0.012 * zig(y0 * 9) * Math.min(1, w * 6);
              const y = crack(u) + w * (ytop - crack(u));
              return at(u, y, s);
            },
            { grid: 48, flip: s < 1 },
          );
        k.add(petal(1), {
          part,
          flat: 0.18,
          kind: "glint",
          params: [0.1, 0],
          color: (c) => scales(c, Math.atan2(c.p[0], c.p[2]) / TAU + 0.5, c.p[1]),
        });
        k.add(petal(0.95), { part, flat: 0.2, color: cream });
      }
      // The nest: a ring of twigs on a bed of straw.
      k.add(k.disc(0.62), {
        pos: [0, ybot + 0.04, 0],
        flat: 0.3,
        color: (c) => mix("#c9a55a", "#8a6a30", 0.5 + 0.5 * c.fbm(c.p[0] * 12, 0, c.p[2] * 12, 2)),
      });
      for (let i = 0; i < 38; i++) {
        const phi = (i / 38) * TAU + k.rand() * 0.3;
        const R0 = 0.52 + k.rand() * 0.18;
        const y0 = ybot + 0.02 + k.rand() * 0.2;
        const dy = (k.rand() - 0.5) * 0.14;
        const len = 0.45 + k.rand() * 0.3;
        const bend = (k.rand() - 0.5) * 0.12;
        const col = mix("#6d4a28", "#a8804f", k.rand());
        k.add(
          k.tube(
            (t) => {
              const a = phi + (t - 0.5) * len;
              const rr = R0 + bend * Math.sin(t * Math.PI) + 0.04 * (t - 0.5);
              return [Math.sin(a) * rr, y0 + dy * (t - 0.5) * 2, Math.cos(a) * rr];
            },
            0.022 + k.rand() * 0.01,
            { grid: 20, samples: 24, caps: true },
          ),
          {
            flat: 0.25,
            color: (c) => lit(c, shade(col, 0.85 + 0.3 * c.noise(c.t * 20, i, 0)), 0.35),
          },
        );
      }
      // The baby dragon, curled up inside until it hatches.
      const dragon = k.part("dragon", { pivot: [0, -0.1, 0], axis: [1, 0, 0] });
      const skin = { emerald: "#46c08c", ruby: "#e0605a", sapphire: "#5b8ee8", gold: "#e8b33a" }[
        o.egg
      ];
      const belly = "#f6dc8c";
      const wing = { emerald: "#8a5cc4", ruby: "#f2a03a", sapphire: "#43c2c9", gold: "#d2553a" }[
        o.egg
      ];
      const D = (shape, opts) =>
        k.add(shape, { part: dragon, pattern: false, flat: 0.25, ...opts });
      D(k.ellipsoid(0.22, 0.24, 0.2), {
        pos: [0, -0.2, 0],
        color: (c) => lit(c, c.lp[2] > 0.08 ? belly : skin, 0.35),
      });
      D(k.sphere(0.2), {
        pos: [0, 0.2, 0.02],
        color: (c) => lit(c, mix(skin, "#ffffff", 0.12 * Math.max(0, c.n[1])), 0.35, 0.2),
      });
      D(k.ellipsoid(0.13, 0.1, 0.12), {
        pos: [0, 0.14, 0.18],
        color: (c) => {
          const nos =
            Math.hypot(Math.abs(c.lp[0]) - 0.045, c.lp[1] - 0.03) < 0.018 && c.lp[2] > 0.09;
          return nos ? "#1e2a22" : lit(c, mix(skin, belly, 0.35), 0.35);
        },
      });
      for (const s of [-1, 1]) {
        D(k.sphere(0.062), {
          pos: [s * 0.095, 0.25, 0.15],
          weight: 3,
          color: (c) => {
            const hl = Math.hypot(c.lp[0] + 0.02, c.lp[1] - 0.025) < 0.018 && c.lp[2] > 0;
            return hl ? "#ffffff" : c.lp[2] > 0.035 ? "#141414" : lit(c, "#ffffff", 0.2);
          },
        });
        D(k.cone(0.04, 0.005, 0.14), {
          pos: [s * 0.1, 0.38, -0.04],
          rot: [-30, 0, s * -25],
          weight: 2,
          color: (c) => lit(c, "#f4e7c6", 0.3),
        });
        D(k.ellipsoid(0.045, 0.035, 0.07), {
          pos: [s * 0.2, 0.0, 0.16],
          weight: 2,
          color: (c) => lit(c, skin, 0.35),
        });
        const wingShape = k.param(
          (u, v) => {
            const a = u * 1.3 + 0.2;
            const scal = 1 - 0.18 * Math.abs(Math.sin(u * Math.PI * 3));
            const rr = v * 0.3 * scal;
            return [s * Math.cos(a) * rr, Math.sin(a) * rr, -0.08 * v];
          },
          { grid: 24 },
        );
        D(wingShape, {
          pos: [s * 0.12, 0.02, -0.14],
          weight: 1.5,
          color: (c) => lit(c, fract(c.u * 3) < 0.08 ? skin : wing, 0.25),
        });
      }
      // Magic sparkles once the egg is open.
      k.cloud({ share: 0.004, size: 0.9, pattern: false }, (rand) => {
        const a = rand() * TAU;
        const rr = 0.2 + rand() * 0.35;
        return {
          p: [Math.sin(a) * rr, 0.25 + rand() * 0.2, Math.cos(a) * rr],
          color: "#ffd23a",
          opacity: 1,
          part: dragon,
          kind: "rise",
          params: [0.6, rand()],
        };
      });
      k.reach([0, ytop + 0.1, 0.9]);
      k.reach([0, ytop + 0.1, -0.9]);
    },
  },

  // ---- Wizard's orb -----------------------------------------------------------------------
  "wizards-orb": {
    alive: true,
    options: [{ key: "magic", label: "Magic", type: "color", default: "#b04dff" }],
    controls: [{ key: "cast", label: "Cast a spell", type: "pulse", ease: 2.5 }],
    action: { key: "cast", label: "Cast", sound: "chime" },
    drive(t, c, out) {
      out.amount = 0.55 + 1.2 * c.cast;
      out.glow = [0.75, 0.55, 1, 0.7 + 0.9 * c.cast];
    },
    build(k, o) {
      const C = [0, 0.18, 0];
      const R = 0.52;
      const bronze = "#9a6a3a";
      // The stand.
      k.add(
        k.lathe(
          [
            [0.0, -0.96],
            [0.5, -0.95],
            [0.55, -0.9],
            [0.5, -0.84],
            [0.3, -0.79],
            [0.17, -0.7],
            [0.11, -0.56],
            [0.13, -0.46],
            [0.22, -0.39],
            [0.32, -0.33],
            [0.3, -0.29],
          ],
          { grid: 72 },
        ),
        {
          flat: 0.2,
          interior: 0,
          core: "#4a3320",
          color: (c) => metal(c, bronze, 0.35),
        },
      );
      // Runes round the foot that light up one after another.
      for (let i = 0; i < 12; i++) {
        const a = (i / 12) * TAU;
        const rr = 0.5;
        k.add(k.box(0.035, 0.035, 0.012), {
          pos: [Math.sin(a) * rr, -0.87, Math.cos(a) * rr],
          rot: [-18, (a * 180) / Math.PI, i % 2 ? 45 : 0],
          weight: 6,
          pattern: false,
          kind: "pulse",
          params: [i / 12, 0],
          color: mix(o.magic, "#ffffff", 0.35),
        });
      }
      // Claws holding the orb.
      for (let i = 0; i < 4; i++) {
        const a = (i / 4) * TAU + TAU / 8;
        const pt = (r, y) => [Math.sin(a) * r, y, Math.cos(a) * r];
        k.add(
          k.tube(
            spline([
              pt(0.28, -0.32),
              pt(0.46, -0.22),
              pt(0.56, -0.02),
              pt(0.58, 0.16),
              pt(0.53, 0.3),
            ]),
            (t) => 0.035 - 0.022 * t,
            { caps: true },
          ),
          { flat: 0.2, weight: 1.6, color: (c) => metal(c, bronze, 0.35) },
        );
      }
      // The glass: faint, brighter at the rim, with a highlight.
      k.add(k.sphere(R), {
        pos: C,
        flat: 0.2,
        opacity: 0.2,
        share: 0.1,
        pattern: false,
        color: (c) => {
          const f = 1 - Math.abs(dot(c.n, VIEW));
          return mix(mix(o.magic, "#ffffff", 0.7), "#ffffff", f * f);
        },
      });
      k.cloud({ share: 0.012, size: 0.7, pattern: false }, (rand) => {
        const d = vec.unit([-0.45 + (rand() - 0.5) * 0.35, 0.6 + (rand() - 0.5) * 0.25, 0.65]);
        return { p: vec.add(C, vec.mul(d, R * 1.01)), color: "#ffffff", opacity: 0.55, n: d };
      });
      // Swirling magic inside: twisting ribbons of light round a glowing
      // heart, turning faster near the middle.
      const deep = shade(o.magic, 0.6);
      const pale = mix(o.magic, "#ffffff", 0.55);
      const other = mix(o.magic, "#3fd0ff", 0.75);
      k.cloud({ share: 0.22, size: 1.25, pattern: false }, (rand, i) => {
        const strand = i % 5;
        const h = rand() * 2 - 1;
        const rr =
          (0.12 + 0.3 * (1 - h * h) * (0.7 + 0.3 * Math.sin(strand * 2.1))) *
          (0.92 + 0.16 * rand());
        const a = (strand / 5) * TAU + h * 2.6 + (rand() - 0.5) * 0.35;
        const y = h * R * 0.72 + (rand() - 0.5) * 0.05;
        const col = mix(strand % 2 ? other : pale, deep, 0.6 * Math.abs(h) + 0.25 * rand());
        return {
          p: [C[0] + Math.sin(a) * rr, C[1] + y, C[2] + Math.cos(a) * rr],
          color: col,
          opacity: 0.55,
          kind: "orbit",
          params: [1.1, 0.6],
        };
      });
      k.cloud({ share: 0.08, size: 2.2, pattern: false }, (rand) => {
        const d = vec.unit([rand() - 0.5, rand() - 0.5, rand() - 0.5]);
        const rr = R * 0.8 * Math.cbrt(rand());
        return {
          p: vec.add(C, vec.mul(d, rr)),
          color: mix(deep, o.magic, rand()),
          opacity: 0.18,
          kind: "orbit",
          params: [0.5, 0.3],
        };
      });
      k.cloud({ share: 0.03, size: 1.3, pattern: false }, (rand) => {
        const d = vec.unit([rand() - 0.5, rand() - 0.5, rand() - 0.5]);
        const rr = 0.1 * Math.cbrt(rand());
        return {
          p: vec.add(C, vec.mul(d, rr)),
          color: mix("#ffffff", pale, rr * 6),
          opacity: 0.9,
          kind: "twinkle",
          params: [0.3, rand() * TAU],
        };
      });
      k.cloud({ share: 0.015, size: 0.55, pattern: false }, (rand) => {
        const d = vec.unit([rand() - 0.5, rand() - 0.5, rand() - 0.5]);
        const rr = R * 0.85 * Math.cbrt(rand());
        return {
          p: vec.add(C, vec.mul(d, rr)),
          color: rand() < 0.5 ? "#ffffff" : "#bff3ff",
          opacity: 1,
          kind: "twinkle",
          params: [0.45, rand() * TAU],
        };
      });
      // Motes circling outside, and sparks rising from the top.
      k.cloud({ share: 0.01, size: 0.7, pattern: false }, (rand) => {
        const a = rand() * TAU;
        const rr = 0.68 + rand() * 0.1;
        return {
          p: [
            Math.sin(a) * rr,
            C[1] + (rand() - 0.5) * 0.2 + 0.1 * Math.sin(a * 3),
            Math.cos(a) * rr,
          ],
          color: mix(pale, "#ffffff", rand()),
          opacity: 0.9,
          kind: "orbit",
          params: [0.6, 0],
        };
      });
      k.cloud({ share: 0.006, size: 0.6, pattern: false }, (rand) => ({
        p: [(rand() - 0.5) * 0.3, C[1] + R * 0.9, (rand() - 0.5) * 0.3],
        color: mix(pale, "#ffffff", 0.5),
        opacity: 1,
        kind: "rise",
        params: [0.45, rand()],
      }));
      k.reach([0, C[1] + R + 0.35, 0]);
    },
  },
};
