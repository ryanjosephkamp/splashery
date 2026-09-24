// Holidays pack: seasonal toys from many traditions. A jack-o'-lantern, a
// snowman that melts, fireworks, a decorated tree, a patterned egg, a paper
// lantern, a diya and a menorah.

import { mix, shade, smoothstep, clamp, spline, quatAxisAngle, quatMul, vec } from "../kit.js";

const TAU = Math.PI * 2;
const LIGHT = vec.unit([0.3, 0.8, 0.55]);
const VIEW = vec.unit([0.52, 0.27, 0.81]);
const HALF = vec.unit(vec.add(LIGHT, VIEW));
const keep = (c, size) => ({ c, keep: true, size });
const band = (x, a, b) => clamp((x - a) / (b - a), 0, 1);
const dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
const fract = (x) => x - Math.floor(x);
const easeInOut = (x) => {
  const t = clamp(x, 0, 1);
  return t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2;
};

function lit(c, col, k = 0.3, gloss = 0) {
  const d = dot(c.n, LIGHT);
  let out = shade(col, 1 + k * (0.9 * d - 0.15));
  if (gloss) out = mix(out, "#ffffff", gloss * Math.pow(Math.max(0, dot(c.n, HALF)), 24));
  return out;
}

// Polished metal: a baked reflection of sky, horizon and ground.
function metal(c, base, dark, floor = 0.35) {
  const n = c.n;
  const dv = dot(n, VIEW);
  const y = 2 * dv * n[1] - VIEW[1];
  const ground = floor + 0.35 * (1 + Math.min(0, y));
  const sky = 0.8 + 0.15 * Math.max(0, y);
  let f = ground + (sky - ground) * smoothstep(-0.2, 0.05, y);
  f += 0.45 * Math.exp(-(((y + 0.02) / 0.08) ** 2));
  const lo = dark || shade(base, 0.3);
  if (f < 1) return mix(lo, base, clamp(f, 0, 1));
  return mix(base, "#ffffff", Math.min(0.75, (f - 1) * 1.8));
}
const gold = (c) => metal(c, "#f0c24e", "#7a4a14", 0.42);

// A candle flame: splats born at the wick that rise, shrink and redden.
function flame(k, at, { share = 0.05, height = 0.3, width = 0.05, part, size = 1 } = {}) {
  k.cloud({ share, size, pattern: false }, (rand) => {
    const a = rand() * TAU;
    const r = width * Math.sqrt(rand());
    const hot = 1 - r / width;
    return {
      p: [at[0] + Math.sin(a) * r, at[1] + rand() * width, at[2] + Math.cos(a) * r],
      color: mix("#ff9a2a", "#fff0a0", hot * 0.9),
      size: 0.7 + 0.6 * hot,
      opacity: 0.85,
      part,
      kind: "flame",
      params: [height * (0.6 + 0.6 * hot * rand()), rand()],
    };
  });
  // A steady teardrop core, so the flame reads even when still.
  k.cloud({ share: share * 0.5, size: size * 0.8, pattern: false }, (rand) => {
    const f = rand();
    const w = width * 1.1 * Math.sin(Math.PI * Math.pow(f, 0.55));
    const r = w * Math.sqrt(rand());
    const a = rand() * TAU;
    const inner = w > 0 ? 1 - r / w : 1;
    return {
      p: [at[0] + Math.sin(a) * r, at[1] + f * height * 0.6, at[2] + Math.cos(a) * r],
      color: mix("#ff7010", "#fff6c0", clamp(inner * 1.4 - f * 0.4, 0, 1)),
      opacity: 0.9,
      part,
      kind: "twinkle",
      params: [0.15, rand() * TAU],
    };
  });
  // A soft glow round it.
  k.cloud({ share: share * 0.12, size: size * 3.5, pattern: false }, (rand) => {
    const d = vec.unit([rand() - 0.5, rand() - 0.3, rand() - 0.5]);
    return {
      p: vec.add(at, vec.add([0, height * 0.35, 0], vec.mul(d, width * 1.6 * rand()))),
      color: "#ffd27a",
      opacity: 0.07,
      part,
      kind: "twinkle",
      params: [0.25, rand() * TAU],
    };
  });
}

// Per-toy memory for drive(): keyed by the control state object, which is
// new each time a toy loads.
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
// A small integer hash for choosing things per tap.
function hashInt(n) {
  n = n ^ 61 ^ (n >>> 16);
  n = (n + (n << 3)) | 0;
  n ^= n >>> 4;
  n = Math.imul(n, 0x27d4eb2d);
  n ^= n >>> 15;
  return n >>> 0;
}

// The diya's ring of small lamps.
const DIYAS = 8;

// Fireworks: the three launch tubes (x, z, colour), the burst each one
// makes (centre, radius and colours) and the shell types.
const FW = {
  ground: -0.95,
  tubes: [
    { x: -0.13, z: 0.04, col: "#d8342c", c: [-0.34, 0.42, 0.3], a: "#ff3b3b", b: "#ffd8c8" },
    { x: 0.0, z: -0.06, col: "#2f6fd8", c: [0.02, 0.58, 0.3], a: "#3b82ff", b: "#e0f0ff" },
    { x: 0.13, z: 0.05, col: "#f2b61e", c: [0.36, 0.42, 0.3], a: "#ffc21a", b: "#fff6d0" },
  ],
  types: ["peony", "ring", "willow", "star"],
  r: 0.52,
};

// Inside a five-pointed star of radius R (point up).
function starRadius(a, R, ri = 0.42) {
  const seg = TAU / 5;
  const d = Math.abs(fract(a / seg + 0.5) - 0.5) * seg;
  const r2 = R * ri;
  return (R * r2 * Math.sin(seg / 2)) / (R * Math.sin(d) + r2 * Math.sin(seg / 2 - d));
}

export const RECIPES = {
  // ---- Jack-o'-lantern -------------------------------------------------------------------
  "jack-o-lantern": {
    alive: true,
    controls: [{ key: "lid", label: "Lid", type: "toggle", default: 0, ease: 0.9 }],
    action: { key: "lid", label: "Lift the lid", sound: { on: "open", off: "close" } },
    drive(t, c, out) {
      out.parts.lid = { angle: -1.1 * easeInOut(c.lid), offset: [0, 0.12 * easeInOut(c.lid), 0] };
      out.amount = 0.9;
    },
    build(k) {
      const face = 0.3; // the face looks a little towards the viewer
      const S = [1, 0.78, 1];
      const rib = (phi) => 1 - 0.08 * Math.pow(1 - Math.abs(Math.cos(phi * 5)), 1.4);
      const R = (phi, e) => rib(phi) * (1 - 0.3 * Math.max(0, Math.abs(Math.sin(e)) - 0.82));
      const P = (phi, e, s = 1) => {
        const r = R(phi, e) * s;
        return [
          Math.cos(e) * Math.sin(phi) * r * S[0],
          Math.sin(e) * r * S[1],
          Math.cos(e) * Math.cos(phi) * r * S[2],
        ];
      };
      const zig = (x) => Math.abs(fract(x) - 0.5) * 4 - 1;
      const cutE = (phi) => 0.95 + 0.06 * zig((phi / TAU) * 12);
      // The carved face, in (angle, elevation) around the face centre.
      const tri = (X, Y, cx, cy, w, h, g) => {
        const y0 = cy - h / 2 - g;
        const yy = Y - y0;
        return yy > 0 && yy < h + 2 * g && Math.abs(X - cx) < (w / 2 + g) * (1 - yy / (h + 2 * g));
      };
      const carved = (X, Y, g) => {
        if (tri(X, Y, -0.36, 0.26, 0.34, 0.28, g) || tri(X, Y, 0.36, 0.26, 0.34, 0.28, g))
          return true;
        if (tri(X, Y, 0, 0.0, 0.16, 0.14, g)) return true;
        if (Math.abs(X) > 0.66 + g) return false;
        const lo = -0.46 + 0.36 * X * X - g;
        const hi = -0.26 + 0.5 * X * X + g;
        if (Y < lo || Y > hi) return false;
        if (g === 0) {
          if (X > -0.22 && X < -0.08 && Y > hi - 0.09) return false;
          if (X > 0.1 && X < 0.24 && Y < lo + 0.09) return false;
        }
        return true;
      };
      const faceXY = (p) => {
        const phi = Math.atan2(p[0], p[2]) - face;
        const e = Math.asin(clamp(p[1] / (S[1] * Math.hypot(p[0], p[1] / S[1], p[2]) || 1), -1, 1));
        return [Math.atan2(Math.sin(phi), Math.cos(phi)), e];
      };
      const skin = (c) => {
        const phi = Math.atan2(c.p[0], c.p[2]);
        const groove = Math.pow(1 - Math.abs(Math.cos(phi * 5)), 3);
        const n = c.fbm(c.p[0] * 5, c.p[1] * 5, c.p[2] * 5, 2);
        let col = mix("#ee7a12", "#b84a08", 0.7 * groove + 0.2 * n);
        col = mix(col, "#ffb04a", 0.25 * Math.max(0, 1 - groove * 3) * (0.5 + 0.5 * c.n[1]));
        return lit(c, col, 0.35, 0.3);
      };
      // Body, with the face cut out and a band of flesh round each hole.
      k.add(
        k.param(
          (u, v) => {
            const phi = u * TAU;
            return P(phi, -Math.PI / 2 + v * (cutE(phi) + Math.PI / 2));
          },
          { grid: 96 },
        ),
        {
          flat: 0.2,
          color: (c) => {
            const [X, Y] = faceXY(c.p);
            if (Math.abs(X) < 1.2) {
              if (carved(X, Y, 0)) return null;
              if (carved(X, Y, 0.035)) return keep(lit(c, "#c8701e", 0.2));
            }
            return skin(c);
          },
        },
      );
      // The inside glows: warmest near the candle, flickering.
      k.add(
        k.param((u, v) => P(u * TAU, -Math.PI / 2 + v * (Math.PI / 2 + 0.95), 0.9), {
          grid: 64,
          flip: true,
        }),
        {
          flat: 0.3,
          pattern: false,
          kind: "twinkle",
          params: [0.18, 0],
          color: (c) =>
            mix("#fffbe0", "#ffb838", clamp(Math.hypot(c.p[0], c.p[1] + 0.35, c.p[2]) / 1.2, 0, 1)),
        },
      );
      k.add(k.cylinder(0.1, 0.2), {
        pos: [0, -0.6, 0],
        pattern: false,
        weight: 2,
        color: (c) => lit(c, "#f6ecd2", 0.2),
      });
      flame(k, [0, -0.49, 0], { share: 0.05, height: 0.32, width: 0.06 });
      // The lid with its stem and a curly vine.
      const lid = k.part("lid", {
        pivot: [0, Math.sin(0.95) * S[1] * 0.95, -Math.cos(0.95) * 0.95],
        axis: [1, 0, 0],
      });
      k.add(
        k.param(
          (u, v) => {
            const phi = u * TAU;
            const e0 = cutE(phi);
            return P(phi, e0 + v * (Math.PI / 2 - e0));
          },
          { grid: 40 },
        ),
        { part: lid, flat: 0.2, color: skin },
      );
      k.add(k.disc(0.5), {
        pos: [0, Math.sin(0.93) * S[1], 0],
        part: lid,
        flat: 0.3,
        color: "#e8a040",
      });
      const top = [0, S[1] * 0.8, 0];
      k.add(
        k.tube(
          spline([
            vec.add(top, [0, -0.05, 0]),
            vec.add(top, [0.02, 0.12, 0]),
            vec.add(top, [0.08, 0.24, 0.02]),
            vec.add(top, [0.16, 0.28, 0.04]),
          ]),
          (t) => 0.075 - 0.035 * t,
          {
            caps: true,
            grid: 32,
          },
        ),
        {
          part: lid,
          flat: 0.2,
          color: (c) =>
            lit(c, mix("#6b7a2a", "#4a5220", 0.5 + 0.5 * Math.sin(c.u * TAU * 6)), 0.35),
        },
      );
      k.add(
        k.tube(
          (t) => {
            const a = t * TAU * 2.2;
            const r = 0.12 * (1 - 0.6 * t);
            return vec.add(top, [
              -0.08 - t * 0.25 + Math.cos(a) * r * 0.4,
              0.02 + Math.sin(a) * r,
              Math.sin(a) * r * 0.8 + 0.1,
            ]);
          },
          0.014,
          { grid: 12, samples: 96 },
        ),
        { part: lid, weight: 2, color: (c) => lit(c, "#6b8a2a", 0.3) },
      );
      k.reach([0, S[1] + 0.55, -0.6]);
    },
  },

  // ---- Snowman ----------------------------------------------------------------------------
  snowman: {
    alive: true,
    controls: [{ key: "warmth", label: "Warmth", type: "slider", default: 0 }],
    drive(t, c, out) {
      out.energy = c.warmth;
      out.grow = c.warmth;
    },
    build(k) {
      const melt = (a = 1) => ({ kind: "melt", params: [a, 0] });
      const snow = (c) => {
        const d = dot(c.n, LIGHT);
        const n = c.noise(c.p[0] * 40, c.p[1] * 40, c.p[2] * 40);
        let col = mix("#c9d6ea", "#ffffff", clamp(0.55 + 0.5 * d + 0.08 * n, 0, 1));
        if (n > 0.62) col = "#ffffff";
        return col;
      };
      const balls = [
        [0.55, -0.42],
        [0.4, 0.3],
        [0.29, 0.85],
      ];
      for (const [r, y] of balls)
        k.add(k.sphere(r), {
          pos: [0, y, 0],
          flat: 0.25,
          interior: 0.08,
          core: "#e8eef6",
          ...melt(),
          color: snow,
        });
      const coal = (c) => lit(c, "#1d1c1f", 0.3, 0.4);
      for (const s of [-1, 1])
        k.add(k.sphere(0.035), {
          pos: [s * 0.1, 0.94, 0.26],
          weight: 3,
          pattern: false,
          ...melt(0.95),
          color: coal,
        });
      for (let i = 0; i < 5; i++) {
        const a = (i - 2) * 0.22;
        k.add(k.sphere(0.022), {
          pos: [Math.sin(a) * 0.16, 0.76 - Math.cos(a) * 0.04 + 0.03, 0.26],
          weight: 3,
          pattern: false,
          ...melt(0.95),
          color: coal,
        });
      }
      for (const y of [0.45, 0.3, 0.15]) {
        const z = Math.sqrt(0.4 * 0.4 - (y - 0.3) ** 2);
        k.add(k.sphere(0.04), {
          pos: [0, y, z - 0.01],
          weight: 3,
          pattern: false,
          ...melt(0.95),
          color: coal,
        });
      }
      k.add(k.cone(0.045, 0.0, 0.26), {
        pos: [0, 0.86, 0.38],
        rot: [90, 0, 0],
        weight: 2.5,
        pattern: false,
        ...melt(0.95),
        color: (c) => lit(c, fract(c.lp[1] * 22) < 0.2 ? "#d2601a" : "#f28a2a", 0.3),
      });
      // Stick arms.
      for (const s of [-1, 1]) {
        const a = [s * 0.36, 0.38, 0];
        const b = [s * 0.82, 0.68, 0.04];
        const stick = {
          flat: 0.25,
          weight: 2,
          pattern: false,
          ...melt(0.9),
          color: (c) => lit(c, "#5a3a22", 0.3),
        };
        k.add(
          k.tube(
            (t) => vec.add(a, vec.mul(vec.sub(b, a), t)),
            (t) => 0.025 - 0.012 * t,
            { grid: 12, samples: 16, caps: true },
          ),
          stick,
        );
        const m = vec.add(a, vec.mul(vec.sub(b, a), 0.7));
        const f = [m[0] + s * 0.08, m[1] + 0.14, 0.02];
        k.add(
          k.tube((t) => vec.add(m, vec.mul(vec.sub(f, m), t)), 0.012, {
            grid: 10,
            samples: 8,
            caps: true,
          }),
          stick,
        );
      }
      // Scarf.
      k.add(k.torus(0.27, 0.06), {
        pos: [0, 0.6, 0],
        scale: [1, 0.8, 1],
        flat: 0.3,
        pattern: false,
        ...melt(0.9),
        color: (c) =>
          lit(c, fract(Math.atan2(c.p[0], c.p[2]) * 1.6) < 0.5 ? "#d8262e" : "#f4f0e6", 0.3),
      });
      k.add(k.roundedBox(0.12, 0.34, 0.04, 4), {
        pos: [0.14, 0.42, 0.3],
        rot: [-15, 0, 10],
        flat: 0.3,
        pattern: false,
        ...melt(0.9),
        color: (c) => lit(c, fract(c.lp[1] * 7) < 0.5 ? "#d8262e" : "#f4f0e6", 0.3),
      });
      // A top hat.
      k.add(k.cylinder(0.26, 0.02), {
        pos: [0, 1.08, 0],
        rot: [0, 0, -8],
        pattern: false,
        ...melt(0.9),
        color: (c) => lit(c, "#222026", 0.3, 0.3),
      });
      k.add(k.cylinder(0.17, 0.3), {
        pos: [0.02, 1.24, 0],
        rot: [0, 0, -8],
        pattern: false,
        ...melt(0.9),
        color: (c) =>
          c.lp[1] < -0.08 && c.lp[1] > -0.13 ? lit(c, "#c8262e", 0.3) : lit(c, "#222026", 0.3, 0.3),
      });
      // A puddle spreads as it melts.
      k.add(k.disc(1), {
        pos: [0, -0.965, 0],
        pattern: false,
        opacity: 0.6,
        kind: "grow",
        params: (c) => [0.15 + 0.6 * clamp(Math.hypot(c.p[0], c.p[2]), 0, 1), 0],
        color: (c) => mix("#bfe3ff", "#e8f6ff", c.rand()),
      });
      // Snow falling round it.
      k.cloud({ share: 0.004, size: 0.8, pattern: false }, (rand) => ({
        p: [(rand() - 0.5) * 1.7, 0.2 + rand() * 1.2, (rand() - 0.5) * 1.7],
        color: "#ffffff",
        opacity: 0.9,
        kind: "fall",
        params: [1.4, rand()],
      }));
    },
  },

  // ---- Fireworks ----------------------------------------------------------------------------
  fireworks: {
    alive: true,
    controls: [{ key: "launch", label: "Launch", type: "pulse", ease: 3.4 }],
    action: { key: "launch", label: "Launch", sound: "fire" },
    drive(t, c, out) {
      // Each launch picks another tube and another shell type (never the
      // same as the last), so no two in a row look alike. The burst is the
      // colour of the tube that fired it.
      const m = mem(c);
      if (m.tube === undefined) Object.assign(m, { tube: 1, type: 0, n: 0 });
      if (fired(m, "launch", c.launch)) {
        m.n++;
        m.tube = (m.tube + 1 + (hashInt(m.n * 2 + 1) % 2)) % 3;
        m.type = (m.type + 1 + (hashInt(m.n * 2 + 7) % 3)) % 4;
      }
      const u = 1 - c.launch;
      const on = c.launch > 0;
      const T = FW.tubes[m.tube];
      const from = [T.x, FW.ground + 0.4, T.z];
      const rise = easeInOut(band(u, 0, 0.24));
      out.parts.rocket = {
        offset: vec.mul(vec.sub(T.c, from), rise).map((v, i) => v + [T.x, 0, T.z][i]),
        visible: on && u < 0.24 ? 1 : 0,
      };
      out.grow = on ? band(u, 0.24, 0.44) : 0;
      const droop = FW.types[m.type] === "willow" ? 0.3 : 0.16;
      for (let i = 0; i < 3; i++)
        for (let j = 0; j < 4; j++)
          out.parts[`b${i}${j}`] = {
            offset: [0, -droop * band(u, 0.24, 1) ** 2, 0],
            visible: on && i === m.tube && j === m.type ? 1 - band(u, 0.66, 1) : 0,
          };
      out.amount = 0.7 + 0.4 * c.launch;
    },
    build(k) {
      const ground = FW.ground;
      // A crate of launch tubes.
      k.add(k.roundedBox(0.5, 0.2, 0.34, 6), {
        pos: [0, ground + 0.1, 0],
        flat: 0.2,
        color: (c) =>
          lit(
            c,
            mix(
              "#9a6a3a",
              "#7a4e28",
              0.5 + 0.5 * Math.sin(c.p[1] * 60 + c.noise(c.p[0] * 8, 0, c.p[2] * 8) * 3),
            ),
            0.35,
          ),
      });
      for (const { x, z, col } of FW.tubes)
        k.add(k.cylinder(0.05, 0.22, { caps: false }), {
          pos: [x, ground + 0.3, z],
          flat: 0.2,
          weight: 1.5,
          color: (c) => lit(c, fract(c.p[1] * 14) < 0.5 ? col : "#f4efe4", 0.3),
        });
      // Bursts in the sky: rays of sparks, twinkling tips and drooping embers.
      const bursts = [
        { c: [-0.5, 0.28, 0.05], r: 0.52, a: "#ff3b4a", b: "#ffd23a" },
        { c: [0.52, 0.46, -0.12], r: 0.48, a: "#3b82ff", b: "#e8f4ff" },
        { c: [-0.02, 0.98, 0.1], r: 0.42, a: "#34e070", b: "#ff5ad8" },
      ];
      const rays = 64;
      const dirs = [];
      const g = Math.PI * (3 - Math.sqrt(5));
      for (let i = 0; i < rays; i++) {
        const y = 1 - ((i + 0.5) / rays) * 2;
        const rr = Math.sqrt(1 - y * y);
        dirs.push([Math.cos(g * i) * rr, y, Math.sin(g * i) * rr]);
      }
      const burst = (B, share) => {
        k.cloud({ share, size: 0.7, pattern: false }, (rand, i) => {
          const d = dirs[i % rays];
          const t = Math.pow(rand(), 0.6);
          const tip = t > 0.9;
          const p = vec.add(
            B.c,
            vec.add(vec.mul(d, B.r * (0.25 + 0.75 * t)), [0, -0.06 * t * t, 0]),
          );
          return {
            p,
            dir: d,
            stretch: tip ? 1.2 : 2.6,
            size: tip ? 1.5 : 0.9,
            color: mix(B.b, B.a, t),
            opacity: tip ? 1 : 0.4 + 0.5 * t,
            kind: tip ? "twinkle" : undefined,
            params: [0.6, rand() * TAU],
          };
        });
      };
      for (const B of bursts) {
        burst(B, 0.13);
        k.cloud({ share: 0.025, size: 0.8, pattern: false }, (rand) => {
          const a = rand() * TAU;
          const y = rand() * 2 - 1;
          const rr = Math.sqrt(1 - y * y) * B.r;
          return {
            p: vec.add(B.c, [Math.cos(a) * rr, y * B.r, Math.sin(a) * rr]),
            color: B.b,
            opacity: 0.9,
            kind: "fall",
            params: [0.35, rand()],
          };
        });
        // A faint trail from the crate.
        k.cloud({ share: 0.012, size: 0.6, pattern: false }, (rand) => {
          const t = rand();
          const from = [0, ground + 0.4, 0];
          const to = vec.add(B.c, [0, -B.r * 0.3, 0]);
          return {
            p: vec.add(vec.add(from, vec.mul(vec.sub(to, from), t)), [
              (rand() - 0.5) * 0.02,
              0,
              (rand() - 0.5) * 0.02,
            ]),
            color: mix("#f2d8a0", "#ffffff", t),
            opacity: 0.12 + 0.3 * t * t,
          };
        });
      }
      // The launched rocket (moved to whichever tube fires).
      const rocket = k.part("rocket", { pivot: [0, ground + 0.4, 0] });
      k.add(k.cylinder(0.03, 0.14), {
        pos: [0, ground + 0.45, 0],
        part: rocket,
        weight: 3,
        pattern: false,
        color: "#f4efe4",
      });
      k.cloud({ share: 0.01, size: 0.8, pattern: false }, (rand) => ({
        p: [(rand() - 0.5) * 0.03, ground + 0.38 - rand() * 0.02, (rand() - 0.5) * 0.03],
        color: "#ffd27a",
        opacity: 0.9,
        part: rocket,
        kind: "flame",
        params: [-0.25, rand()],
      }));
      // A bright spark trail behind it, so the launch reads at a glance.
      k.cloud({ share: 0.006, size: 1.1, pattern: false }, (rand) => {
        const f = rand();
        return {
          p: [(rand() - 0.5) * 0.02 * (1 + 2 * f), ground + 0.37 - 0.32 * f, (rand() - 0.5) * 0.02],
          dir: [0, 1, 0],
          stretch: 2.5,
          color: mix("#fff6d0", "#ff9a2a", f),
          opacity: 1 - 0.8 * f,
          part: rocket,
        };
      });
      // Its burst: one per tube colour and shell type, each revealed from the
      // centre outwards as it grows. Flat shapes face the home view.
      const e1 = vec.unit(vec.cross([0, 1, 0], VIEW));
      const e2 = vec.cross(VIEW, e1);
      const ringN = vec.unit([0.25, 0.55, 0.8]);
      const r1 = vec.unit(vec.cross([0, 1, 0], ringN));
      const r2 = vec.cross(ringN, r1);
      const shell = {
        peony: (rand, i) => {
          const d = dirs[i % rays];
          const t = Math.pow(rand(), 0.6);
          return { t, p: vec.add(vec.mul(d, 0.25 + 0.75 * t), [0, -0.06 * t * t, 0]), dir: d };
        },
        ring: (rand) => {
          const a = rand() * TAU;
          const d = vec.add(vec.mul(r1, Math.cos(a)), vec.mul(r2, Math.sin(a)));
          const t = rand() < 0.8 ? 0.88 + 0.12 * rand() : 0.2 + 0.6 * rand();
          return { t, p: vec.mul(d, t), dir: d };
        },
        willow: (rand, i) => {
          const d = dirs[((i * 7) % (rays / 2)) + 2];
          const s = Math.pow(rand(), 0.7);
          const p = vec.add(vec.mul(d, 0.8 * s), [0, -0.55 * s * s, 0]);
          return { t: s, p, dir: vec.unit(vec.add(d, [0, -1.1 * s, 0])), long: true };
        },
        star: (rand) => {
          const a = rand() * TAU;
          const out = rand() < 0.8;
          const rr = starRadius(a, 1) * (out ? 0.95 + 0.08 * rand() : rand());
          const d = vec.add(vec.mul(e1, Math.sin(a)), vec.mul(e2, Math.cos(a)));
          return { t: out ? 1 : rr, p: vec.mul(d, rr), dir: d };
        },
      };
      FW.tubes.forEach((T, ti) => {
        FW.types.forEach((type, j) => {
          const part = k.part(`b${ti}${j}`, { pivot: T.c });
          k.cloud({ share: 0.025, size: 0.75, pattern: false }, (rand, i) => {
            const S = shell[type](rand, i);
            const tip = S.t > 0.9 && !S.long;
            let col = mix(T.b, T.a, Math.min(1, S.t * 1.3));
            if (S.long) col = mix(col, "#ffd27a", 0.35 * S.t);
            return {
              p: vec.add(T.c, vec.mul(S.p, FW.r)),
              dir: S.dir,
              stretch: tip ? 1.2 : S.long ? 3.2 : 2.4,
              size: tip ? 1.5 : 0.95,
              color: col,
              opacity: tip ? 1 : 0.45 + 0.5 * S.t,
              part,
              kind: "grow",
              params: [S.t * 0.9, 0],
            };
          });
        });
      });
    },
  },

  // ---- Decorated tree -----------------------------------------------------------------------
  "decorated-tree": {
    alive: true,
    controls: [{ key: "lights", label: "Lights", type: "toggle", default: 0, ease: 1.8 }],
    action: { key: "lights", label: "Lights on or off", sound: "click" },
    drive(t, c, out) {
      // The lights switch on in a sweep up the tree and stay on, playing
      // three patterns in turn: a chase, a slow ripple and all steady. The
      // star glows while they are on.
      const on = c.lights;
      out.grow = on;
      const phase = Math.floor(t / 4) % 3;
      for (let g = 0; g < 3; g++) {
        let v = 1.15;
        if (phase === 0) v = Math.floor(t * 6) % 3 === g ? 1.45 : 0.45;
        else if (phase === 1) v = 0.55 + 0.75 * (0.5 + 0.5 * Math.sin(t * 4 - g * 2.1));
        out.parts[`lights${g}`] = { visible: v * smoothstep(0, 0.3, on) };
      }
      out.parts.halo = { visible: on * (1 + 0.12 * Math.sin(t * 2.6)) };
      out.amount = 0.9 + 1.2 * on;
    },
    build(k) {
      const tiers = 5;
      const tierAt = (i) => ({
        y0: -0.6 + i * 0.3,
        h: 0.5 - i * 0.02,
        r: 0.8 - i * 0.14,
      });
      // Radius of the tree's outer surface at a height (for decorations).
      const coneR = (y, phi) => {
        let best = 0;
        for (let i = 0; i < tiers; i++) {
          const T = tierAt(i);
          const f = (y - T.y0) / T.h;
          if (f < 0 || f > 1) continue;
          best = Math.max(best, T.r * (1 - f) * (1 + 0.07 * Math.cos(phi * 9)) + 0.04);
        }
        return best;
      };
      const needles = (c) => {
        const n = c.noise(c.p[0] * 22, c.p[1] * 22, c.p[2] * 22);
        const tip = band(Math.hypot(c.p[0], c.p[2]), 0.1, 0.8);
        return lit(c, mix(mix("#1f5a2c", "#2f7a38", 0.5 + 0.5 * n), "#4f9a48", 0.3 * tip), 0.4);
      };
      for (let i = 0; i < tiers; i++) {
        const T = tierAt(i);
        k.add(
          k.param(
            (u, v) => {
              const phi = u * TAU;
              const r = T.r * v * (1 + 0.08 * Math.cos(phi * 9) * v);
              const y = T.y0 + T.h * (1 - v) - 0.06 * v * v;
              return [Math.sin(phi) * r, y, Math.cos(phi) * r];
            },
            { grid: 64, flip: true },
          ),
          { flat: 0.3, interior: 0.06, core: "#1a4a24", color: needles },
        );
      }
      // Fluffy needle tufts.
      k.cloud({ share: 0.12, size: 0.8 }, (rand) => {
        const y = -0.62 + rand() * 1.6;
        const phi = rand() * TAU;
        const r = coneR(y, phi) * (0.8 + 0.25 * rand());
        if (r <= 0.02) return null;
        const d = [Math.sin(phi), -0.4, Math.cos(phi)];
        return {
          p: [Math.sin(phi) * r, y, Math.cos(phi) * r],
          dir: d,
          stretch: 2.4,
          color: mix("#1f5a2c", "#5aa84e", rand()),
        };
      });
      // Trunk, a tree skirt and presents.
      k.add(k.cylinder(0.09, 0.2), { pos: [0, -0.7, 0], color: (c) => lit(c, "#6a4226", 0.3) });
      k.add(k.disc(0.62), {
        pos: [0, -0.79, 0],
        flat: 0.3,
        color: (c) => (Math.hypot(c.p[0], c.p[2]) > 0.55 ? "#f4f0e6" : lit(c, "#b8202a", 0.2)),
      });
      const gifts = [
        [0.42, 0.34, 0.2, "#2f6fd8", "#f2c230", 20],
        [-0.46, 0.22, 0.16, "#e8e0d0", "#d8262e", -15],
        [0.05, 0.52, 0.14, "#d8262e", "#2fa05a", 40],
      ];
      for (const [x, z, s, col, rib, rot] of gifts) {
        k.add(k.box(s, s, s), {
          pos: [x, -0.79 + s / 2, z],
          rot: [0, rot, 0],
          flat: 0.2,
          weight: 1.4,
          color: (c) => {
            const l = c.lp;
            const onRib = Math.abs(l[0]) < s * 0.1 || Math.abs(l[2]) < s * 0.1;
            return lit(c, onRib ? rib : col, 0.3, 0.2);
          },
        });
        k.add(k.torus(s * 0.16, s * 0.05), {
          pos: [x, -0.79 + s + 0.02, z],
          rot: [90, rot + 45, 0],
          weight: 3,
          color: (c) => lit(c, rib, 0.3),
        });
      }
      // A golden garland spiralling up.
      k.add(
        k.tube(
          (t) => {
            const y = -0.55 + t * 1.3;
            const phi = t * TAU * 3.2;
            const r = coneR(y, phi) + 0.01;
            return [Math.sin(phi) * r, y, Math.cos(phi) * r];
          },
          0.018,
          { grid: 16, samples: 400 },
        ),
        { weight: 2.2, pattern: false, kind: "glint", params: [0.5, 0], color: (c) => gold(c) },
      );
      // Baubles.
      const bauble = ["#d8262e", "#f2c230", "#2f6fd8", "#c8ccd4", "#b83ad8"];
      for (let i = 0; i < 26; i++) {
        const y = -0.5 + (i / 26) * 1.15 + (k.rand() - 0.5) * 0.06;
        const phi = i * 2.39996 + k.rand() * 0.3;
        const r = coneR(y, phi) + 0.02;
        if (r < 0.1) continue;
        const col = bauble[i % bauble.length];
        const s = 0.045 + 0.02 * k.rand();
        k.add(k.sphere(s), {
          pos: [Math.sin(phi) * r, y - s * 0.6, Math.cos(phi) * r],
          weight: 3,
          pattern: false,
          color: (c) => lit(c, col, 0.45, 0.9),
        });
      }
      // Fairy lights: dim bulbs, and a glow that switches on in three
      // groups (every third bulb), bottom to top.
      const groups = [0, 1, 2].map((g) => k.part(`lights${g}`, { pivot: [0, 0, 0] }));
      const bulbCols = ["#ffe9a8", "#ff6a5a", "#6ac8ff", "#9aff7a", "#ffb0f0"];
      const bulbs = [];
      for (let i = 0; i < 70; i++) {
        const t = i / 70;
        const y = -0.52 + t * 1.2;
        const phi = t * TAU * 4.5 + 1.2;
        const r = coneR(y, phi) + 0.01;
        bulbs.push({
          p: [Math.sin(phi) * r, y, Math.cos(phi) * r],
          col: bulbCols[i % bulbCols.length],
          out: [Math.sin(phi) * (r + 0.03), y, Math.cos(phi) * (r + 0.03)],
          t,
          i,
        });
      }
      k.cloud({ share: 0.004, size: 0.9, pattern: false }, (rand, i) => ({
        p: bulbs[i % bulbs.length].p,
        color: "#5a5a50",
        opacity: 1,
      }));
      groups.forEach((part, g) => {
        const mine = bulbs.filter((b) => b.i % 3 === g);
        // A bright bulb, a little proud of the needles, and a soft halo.
        k.cloud({ share: 0.008, size: 2.6, pattern: false }, (rand, i) => {
          const b = mine[i % mine.length];
          const d = vec.unit([rand() - 0.5, rand() - 0.5, rand() - 0.5]);
          return {
            p: vec.add(b.out, vec.mul(d, 0.025 * rand())),
            color: mix(b.col, "#ffffff", 0.5),
            opacity: 1,
            part,
            kind: "grow",
            params: [b.t * 0.9, 0],
          };
        });
        k.cloud({ share: 0.003, size: 5, pattern: false }, (rand, i) => {
          const b = mine[i % mine.length];
          const d = vec.unit([rand() - 0.5, rand() - 0.5, rand() - 0.5]);
          return {
            p: vec.add(b.out, vec.mul(d, 0.04 * rand())),
            color: b.col,
            opacity: 0.24,
            part,
            kind: "grow",
            params: [b.t * 0.9, 0],
          };
        });
      });
      // The star on top: a faceted, bevelled gold star (each point has a lit
      // and a shaded face), turned to face the home view so its shape reads.
      // It sits above the tip, so its lower points clear the needles (the
      // tufts reach y = 0.98), on a short gold stem.
      const top = [0, 1.17, 0];
      const R = 0.2;
      const seg = TAU / 5;
      k.add(k.cylinder(0.018, 0.2), {
        pos: [0, 0.94, 0],
        weight: 3,
        pattern: false,
        color: (c) => shade("#d9a22a", 0.85 + 0.25 * Math.max(0, c.n[0])),
      });
      for (const side of [1, -1]) {
        k.add(
          k.param(
            (u, v) => {
              const a = u * TAU;
              const r = v * starRadius(a, R);
              return [Math.sin(a) * r, Math.cos(a) * r, side * 0.045 * (1 - v)];
            },
            { grid: 60, flip: side < 0 },
          ),
          {
            pos: top,
            rot: [0, 31.5, 0],
            weight: 4,
            even: true,
            jitter: 0.01,
            flat: 0.15,
            pattern: false,
            kind: "twinkle",
            params: [0.15, 0],
            color: (c) => {
              const a = Math.atan2(c.lp[0], c.lp[1]);
              // Which half of a point the splat is on: one catches the light.
              const d = fract(a / seg + 0.5) - 0.5;
              const facet = d > 0 ? 1.08 : 0.72;
              const ridge = Math.abs(d) < 0.02 ? 1.25 : 1;
              const tip = c.v > 0.93 ? 1.15 : 1;
              return shade(mix("#ffe79a", "#e5a51c", c.v * 0.8), facet * ridge * tip);
            },
          },
        );
      }
      // A faint warm glow behind it, and a bright halo while the lights are on.
      k.cloud({ share: 0.004, size: 2.4, pattern: false }, (rand) => {
        const d = vec.unit([rand() - 0.5, rand() - 0.5, rand() - 0.5]);
        return {
          p: vec.add(top, vec.mul(d, 0.08 + 0.12 * rand())),
          color: "#fff0a0",
          opacity: 0.035,
          kind: "twinkle",
          params: [0.3, rand() * TAU],
        };
      });
      const halo = k.part("halo", { pivot: top });
      const behind = vec.add(top, vec.mul(VIEW, -0.08));
      k.cloud({ share: 0.005, size: 2.6, pattern: false }, (rand) => {
        const d = vec.unit([rand() - 0.5, rand() - 0.5, rand() - 0.5]);
        const r = 0.12 + 0.16 * Math.pow(rand(), 1.5);
        return {
          p: vec.add(behind, vec.mul(d, r)),
          color: mix("#fff6c8", "#ffc840", r * 3),
          opacity: 0.09,
          part: halo,
        };
      });
    },
  },

  // ---- Patterned egg ------------------------------------------------------------------------
  "patterned-egg": {
    alive: true,
    options: [
      {
        key: "pattern",
        label: "Pattern",
        type: "select",
        default: "folk",
        choices: [
          { id: "folk", label: "Folk" },
          { id: "stripes", label: "Stripes" },
          { id: "dots", label: "Dots" },
          { id: "zigzag", label: "Zigzag" },
          { id: "flowers", label: "Flowers" },
          { id: "stars", label: "Stars" },
        ],
      },
      { key: "c1", label: "Colour 1", type: "color", default: "#c8262e" },
      { key: "c2", label: "Colour 2", type: "color", default: "#f2c230" },
    ],
    controls: [{ key: "spin", label: "Spin", type: "pulse", ease: 2.6 }],
    action: { key: "spin", label: "Spin", sound: "whoosh" },
    drive(t, c, out) {
      const u = 1 - c.spin;
      const turns = c.spin > 0 ? 2 * (1 - (1 - u) ** 3) : 0;
      out.parts.egg = { angle: turns * TAU };
    },
    build(k, o) {
      const yc = 0.1;
      const H = 0.85;
      const W = 0.6;
      const prof = [];
      for (let i = 0; i <= 30; i++) {
        const t = -1 + (2 * i) / 30;
        prof.push([W * Math.sqrt(Math.max(0, 1 - t * t)) * (1 - 0.13 * t), yc + H * t]);
      }
      const egg = k.part("egg", { pivot: [0, 0, 0], axis: [0, 1, 0] });
      const c1 = o.c1;
      const c2 = o.c2;
      const white = "#faf6ec";
      const dark = "#241a1e";
      const design = (u, y) => {
        const Y = (y - yc) / H; // -1 .. 1
        switch (o.pattern) {
          case "stripes": {
            const b = Math.floor((Y + 1) * 6);
            const edge = Math.abs(fract((Y + 1) * 6) - 0.5) > 0.44;
            return edge ? white : [c1, c2, white, c2][b % 4];
          }
          case "dots": {
            const row = Math.floor((Y + 1) * 7);
            const cu = fract(u * 10 + (row % 2) * 0.5) - 0.5;
            const cy = fract((Y + 1) * 7) - 0.5;
            const d = Math.hypot(cu, cy * 0.9);
            return d < 0.22 ? (row % 2 ? c2 : white) : c1;
          }
          case "zigzag": {
            const z = Math.abs(fract(u * 8) - 0.5) * 0.25;
            const b = Math.floor((Y + 1 + z) * 5);
            return [c1, white, c2, white][b % 4];
          }
          case "flowers": {
            const row = Math.floor((Y + 1) * 3.5);
            const cu = fract(u * 6 + (row % 2) * 0.5) - 0.5;
            const cy = fract((Y + 1) * 3.5) - 0.5;
            const a = Math.atan2(cy, cu);
            const r = Math.hypot(cu, cy);
            if (r < 0.07) return c2;
            if (r < 0.2 + 0.12 * Math.cos(a * 5)) return white;
            return c1;
          }
          case "stars": {
            const row = Math.floor((Y + 1) * 4);
            const cu = fract(u * 7 + (row % 2) * 0.5) - 0.5;
            const cy = fract((Y + 1) * 4) - 0.5;
            const a = Math.atan2(cu, cy);
            return Math.hypot(cu, cy) < starRadius(a, 0.34) ? c2 : c1;
          }
          default: {
            // Folk: meridian bands, a rosette band round the middle, wavy lines.
            const ab = Math.abs(Y);
            if (Math.abs(ab - 0.36) < 0.03) return dark;
            if (ab < 0.33) {
              const cu = fract(u * 8) - 0.5;
              const a = Math.atan2(Y, cu * 1.6);
              const r = Math.hypot(cu * 1.6, Y);
              if (r < 0.08) return c2;
              if (r < 0.25 + 0.06 * Math.cos(a * 8)) return r > 0.2 ? dark : white;
              return c1;
            }
            const wave = Math.abs(Y - Math.sign(Y) * (0.6 + 0.08 * Math.sin(u * TAU * 8)));
            if (wave < 0.045) return white;
            if (Math.abs(fract(u * 16) - 0.5) < 0.06 && ab > 0.4 && ab < 0.9) return dark;
            return ab > 0.88 ? c2 : c1;
          }
        }
      };
      k.add(k.lathe(prof, { grid: 96 }), {
        part: egg,
        flat: 0.18,
        interior: 0.1,
        core: (c) => (Math.hypot(c.p[0], c.p[1] - 0.0, c.p[2]) < 0.3 ? "#f6c230" : "#fbf4e2"),
        color: (c) => lit(c, design(c.u, c.p[1]), 0.35, 0.55),
      });
      // A little golden stand.
      k.add(
        k.lathe(
          [
            [0.0, -0.95],
            [0.34, -0.94],
            [0.36, -0.9],
            [0.2, -0.86],
            [0.14, -0.8],
            [0.22, -0.74],
            [0.3, -0.7],
          ],
          { grid: 64 },
        ),
        { flat: 0.2, pattern: false, color: (c) => gold(c) },
      );
    },
  },

  // ---- Paper lantern ------------------------------------------------------------------------
  "paper-lantern": {
    alive: true,
    options: [
      {
        key: "color",
        label: "Colour",
        type: "select",
        default: "red",
        choices: [
          { id: "red", label: "Red" },
          { id: "gold", label: "Gold" },
          { id: "teal", label: "Teal" },
          { id: "purple", label: "Purple" },
        ],
      },
    ],
    controls: [{ key: "swing", label: "Swing", type: "pulse", ease: 4 }],
    action: { key: "swing", label: "Swing", sound: "whoosh" },
    drive(t, c, out) {
      const a = 0.05 + 0.25 * c.swing;
      out.parts.lantern = {
        quat: quatMul(
          quatAxisAngle([0, 0, 1], a * Math.sin(t * 1.6)),
          quatAxisAngle([1, 0, 0], 0.6 * a * Math.sin(t * 1.1 + 1)),
        ),
      };
      out.amount = 0.8;
    },
    build(k, o) {
      const paper = { red: "#f2302a", gold: "#f8b020", teal: "#22c0b4", purple: "#a044e8" }[
        o.color
      ];
      const hook = [0, 1.02, 0];
      const lantern = k.part("lantern", { pivot: hook, axis: [0, 0, 1] });
      const L = (shape, opts) => k.add(shape, { part: lantern, ...opts });
      // The glowing paper body with ribs.
      const prof = [];
      for (let i = 0; i <= 24; i++) {
        const t = -1 + (2 * i) / 24;
        prof.push([0.72 * Math.pow(Math.max(0, 1 - t * t), 0.55) + 0.18, 0.05 + 0.55 * t]);
      }
      L(k.lathe(prof, { grid: 96 }), {
        flat: 0.2,
        kind: "twinkle",
        params: [0.06, 0],
        color: (c) => {
          const a = Math.atan2(c.p[0], c.p[2]);
          const rib = Math.abs(fract((a / TAU) * 16) - 0.5) > 0.46;
          const face = Math.max(0, dot(c.n, VIEW));
          const mid = 1 - Math.abs(c.p[1] - 0.05) / 0.6;
          const glow = Math.pow(face, 0.8) * (0.4 + 0.6 * mid);
          let col =
            glow < 0.5
              ? mix(shade(paper, 0.55), paper, glow * 2)
              : mix(paper, mix(paper, "#ffd040", 0.65), (glow - 0.5) * 2);
          if (rib) col = shade(col, 0.72);
          // A simple golden circle motif on the front.
          const m = Math.hypot(Math.atan2(c.p[0], c.p[2]) - 0.35, (c.p[1] - 0.05) * 1.6);
          if (Math.abs(m - 0.28) < 0.025 || (m < 0.16 && Math.abs(fract(m * 12) - 0.5) < 0.2))
            col = mix(col, "#ffd24a", 0.85);
          return keep(col);
        },
      });
      // Golden caps, a cord and a tassel.
      for (const [y, s] of [
        [0.66, 1],
        [-0.56, -1],
      ]) {
        L(k.cylinder(0.26, 0.1), {
          pos: [0, y, 0],
          flat: 0.2,
          pattern: false,
          color: (c) => gold(c),
        });
        L(k.torus(0.26, 0.022), {
          pos: [0, y - s * 0.05, 0],
          weight: 2,
          pattern: false,
          color: (c) => gold(c),
        });
      }
      L(k.cylinder(0.012, 0.3, { caps: false }), {
        pos: [0, 0.86, 0],
        weight: 3,
        pattern: false,
        color: "#8a1c1c",
      });
      L(k.sphere(0.06), { pos: [0, -0.66, 0], weight: 2, pattern: false, color: (c) => gold(c) });
      L(k.cone(0.02, 0.07, 0.08), {
        pos: [0, -0.74, 0],
        weight: 2,
        pattern: false,
        color: (c) => gold(c),
      });
      k.cloud({ share: 0.05, size: 0.7, pattern: false }, (rand) => {
        const a = rand() * TAU;
        const r = 0.055 * Math.sqrt(rand());
        const len = 0.4 + 0.05 * rand();
        const t = rand();
        return {
          p: [Math.sin(a) * r * (1 + t * 0.6), -0.78 - t * len, Math.cos(a) * r * (1 + t * 0.6)],
          dir: [0, 1, 0],
          stretch: 3,
          color: mix(paper, "#8a1010", t * 0.5),
          part: lantern,
        };
      });
      // A little hook it hangs from.
      k.add(k.torus(0.04, 0.012), {
        pos: hook,
        rot: [90, 0, 0],
        weight: 3,
        pattern: false,
        color: (c) => gold(c),
      });
      k.reach([0.5, -1.3, 0]);
      k.reach([-0.5, -1.3, 0]);
    },
  },

  // ---- Diya ---------------------------------------------------------------------------------
  diya: {
    alive: true,
    controls: [
      { key: "size", label: "Flame", type: "slider", default: 0.6 },
      { key: "blow", label: "Blow", type: "pulse", ease: 2 },
      { key: "ring", label: "Light the ring", type: "toggle", default: 0, ease: 3 },
    ],
    action: { key: "ring", label: "Light the diyas", sound: "whoosh" },
    drive(t, c, out) {
      // The flame flares up and grows, then carries its light round a ring
      // of small diyas one by one. They stay lit until the next tap.
      const dip = Math.sin(Math.PI * clamp(c.blow, 0, 1));
      const flare = Math.sin(Math.PI * band(c.ring, 0, 0.3));
      out.amount = (0.45 + 0.9 * c.size) * (1 - 0.75 * dip) * (1 + 0.45 * c.ring + 0.9 * flare);
      out.parts.flame = { visible: 1 + 0.35 * c.ring + 0.5 * flare };
      for (let i = 0; i < DIYAS; i++) {
        const a = 0.12 + i * 0.1;
        out.parts[`d${i}`] = { visible: easeInOut(band(c.ring, a, a + 0.1)) };
      }
    },
    build(k) {
      const base = -0.55;
      // A rangoli of coloured powder under the lamp.
      const rc = ["#ff4f8a", "#ffb020", "#2fbf71", "#3b82ff", "#ff7a2a", "#f4f0e6"];
      k.add(k.disc(1), {
        pos: [0, base - 0.02, 0],
        flat: 0.3,
        color: (c) => {
          const x = c.p[0];
          const z = c.p[2];
          const r = Math.hypot(x, z);
          if (c.n[1] < 0) return "#b8a890";
          const a = Math.atan2(x, z);
          const petal = r - (0.62 + 0.14 * Math.abs(Math.cos(a * 4)));
          if (r > 0.97) return rc[5];
          if (petal > 0.06)
            return Math.abs(fract(((a * 8) / TAU) * 2) - 0.5) < 0.18 && r > 0.82 ? rc[1] : rc[3];
          if (petal > 0.03) return rc[5];
          if (petal > -0.1) return rc[0];
          if (r > 0.42) return Math.abs(fract((a / TAU) * 16) - 0.5) < 0.25 ? rc[2] : rc[1];
          if (r > 0.38) return rc[5];
          return rc[4];
        },
      });
      k.cloud({ share: 0.02, size: 1.2, pattern: false }, (rand) => {
        const a = rand() * TAU;
        const r = 0.75 + rand() * 0.2;
        return {
          p: [Math.sin(a) * r, base, Math.cos(a) * r],
          n: [0, 1, 0],
          color: rand() < 0.5 ? "#ff8a1a" : "#ffd21a",
        };
      });
      // The lamp: a round clay bowl pinched into a pointed spout.
      const spoutA = 1.35;
      const spout = (a) =>
        Math.pow(Math.max(0, Math.cos(Math.atan2(Math.sin(a - spoutA), Math.cos(a - spoutA)))), 8);
      const rimR = (a) => 0.5 * (1 + 0.65 * spout(a));
      const depth = 0.3;
      const bowlAt = (a, v, inner) => {
        const q = (v * Math.PI) / 2;
        const r = rimR(a) * Math.pow(Math.sin(q), 0.85) * (inner ? 0.86 : 1);
        const y =
          base +
          0.02 +
          (inner ? 0.04 : 0) +
          depth * (1 - Math.cos(q)) * (inner ? 0.88 : 1) +
          0.07 * spout(a) * v * v;
        return [Math.sin(a) * r, y, Math.cos(a) * r];
      };
      const bowl = (inner) =>
        k.param((u, v) => bowlAt(u * TAU, v, inner), { grid: 72, flip: inner });
      const zig = (x) => Math.abs(fract(x) - 0.5) * 4 - 1;
      // Burnished terracotta, painted: a row of white dots under the rim, a
      // red line, a band of lotus petals (white outline, saffron fill, a
      // green heart) and a green line at the foot.
      const clay = (c) => {
        const y = c.p[1] - base;
        const n = c.fbm(c.p[0] * 4, c.p[1] * 4, c.p[2] * 4, 3);
        let col = mix("#c9662a", "#a9501f", 0.5 + 0.8 * n);
        const a = Math.atan2(c.p[0], c.p[2]) / TAU;
        const r = Math.hypot(c.p[0], c.p[2]);
        // Dots: round, about the same size all the way round.
        const du = (fract(a * 24) - 0.5) * ((TAU * r) / 24);
        if (Math.hypot(du, y - 0.292) < 0.014) col = "#fbf4e0";
        if (Math.abs(y - 0.262) < 0.008) col = "#d8202f";
        // Petals.
        const h = (y - 0.12) / 0.13;
        if (h > 0 && h < 1) {
          const u = Math.abs(fract(a * 14) - 0.5);
          const w = 0.44 * Math.pow(Math.sin(Math.PI * Math.pow(h, 0.8)), 0.7);
          if (u < w) col = u > w - 0.09 ? "#fbf4e0" : u < 0.1 && h < 0.55 ? "#2f9a5a" : "#f7b21c";
        }
        if (Math.abs(y - 0.105) < 0.008) col = "#2f9a5a";
        return lit(c, col, 0.35, 0.18);
      };
      k.add(bowl(false), { flat: 0.2, weight: 2, even: true, jitter: 0.012, color: clay });
      k.add(bowl(true), {
        flat: 0.2,
        even: true,
        jitter: 0.012,
        color: (c) =>
          lit(c, shade("#8a3a14", 0.95 + 0.1 * c.fbm(c.p[0] * 5, 0, c.p[2] * 5)), 0.3, 0.2),
      });
      // The rounded lip joining outside and inside.
      k.add(
        k.param(
          (u, w) => {
            const a = u * TAU;
            const p = vec.add(vec.mul(bowlAt(a, 1, false), 1 - w), vec.mul(bowlAt(a, 1, true), w));
            return vec.add(p, [0, 0.02 * Math.sin(Math.PI * w), 0]);
          },
          { grid: 64 },
        ),
        {
          flat: 0.2,
          weight: 2,
          even: true,
          jitter: 0.012,
          color: (c) => lit(c, "#c8642a", 0.3, 0.25),
        },
      );
      // Oil, glinting.
      k.add(
        k.param(
          (u, w) => {
            const a = u * TAU;
            const r = rimR(a) * 0.78 * w;
            return [Math.sin(a) * r, base + 0.25, Math.cos(a) * r];
          },
          { grid: 40, normal: () => [0, 1, 0] },
        ),
        {
          flat: 0.3,
          weight: 1.5,
          even: true,
          jitter: 0.008,
          pattern: false,
          color: (c) => {
            // Dark amber oil: rings of a slow ripple, a glossy sheen, and the
            // flame's warm reflection near the wick.
            const r = Math.hypot(c.p[0], c.p[2]);
            const ripple = 0.985 + 0.025 * Math.sin(r * 45);
            const toWick = Math.hypot(
              c.p[0] - Math.sin(spoutA) * 0.36,
              c.p[2] - Math.cos(spoutA) * 0.36,
            );
            let col = shade("#9c5a12", ripple);
            col = mix(col, "#ffe6a0", 0.75 * Math.exp(-((toWick / 0.12) ** 2)));
            col = mix(
              col,
              "#fff4d6",
              0.35 * smoothstep(0.1, 0.5, c.p[0] * -0.5 + c.p[2] * 0.4 + 0.2),
            );
            return lit(c, col, 0.2, 0.9);
          },
        },
      );
      // The wick in the spout, and its flame.
      const tip = [Math.sin(spoutA) * 0.7, base + 0.43, Math.cos(spoutA) * 0.7];
      k.add(
        k.tube(
          spline([
            [Math.sin(spoutA) * 0.3, base + 0.25, Math.cos(spoutA) * 0.3],
            vec.add(tip, [-0.02, -0.08, 0]),
            tip,
          ]),
          0.022,
          { grid: 12, samples: 24, caps: true },
        ),
        {
          weight: 3,
          pattern: false,
          color: (c) => (c.t > 0.85 ? "#2a1a10" : "#f4ecd8"),
        },
      );
      const main = k.part("flame", { pivot: vec.add(tip, [0, 0.02, 0]) });
      flame(k, vec.add(tip, [0, 0.02, 0]), {
        share: 0.08,
        height: 0.55,
        width: 0.08,
        size: 1.2,
        part: main,
      });
      // A ring of small diyas on the rangoli, unlit until the big one
      // passes its light round.
      for (let i = 0; i < DIYAS; i++) {
        const a = spoutA + TAU / 16 + (i / DIYAS) * TAU;
        const at = [Math.sin(a) * 0.84, base, Math.cos(a) * 0.84];
        const small = (u, v, inner) => {
          const q = (v * Math.PI) / 2;
          const r = 0.085 * Math.pow(Math.sin(q), 0.8) * (inner ? 0.85 : 1);
          const y = 0.005 + 0.055 * (1 - Math.cos(q)) * (inner ? 0.85 : 1) + (inner ? 0.008 : 0);
          return [at[0] + Math.sin(u * TAU) * r, at[1] + y, at[2] + Math.cos(u * TAU) * r];
        };
        for (const inner of [false, true])
          k.add(
            k.param((u, v) => small(u, v, inner), { grid: 24, flip: inner }),
            {
              flat: 0.2,
              weight: 2,
              even: true,
              jitter: 0.012,
              color: (c) => {
                if (inner) return lit(c, "#7a3412", 0.3, 0.2);
                const y = c.p[1] - base;
                const dotRow = Math.abs(y - 0.042) < 0.006 && fract(c.u * 12) < 0.4;
                return lit(c, dotRow ? "#fbf4e0" : "#c9662a", 0.35, 0.18);
              },
            },
          );
        k.add(k.disc(0.062), {
          pos: [at[0], base + 0.05, at[2]],
          flat: 0.3,
          weight: 2,
          pattern: false,
          color: (c) => lit(c, "#9c5a12", 0.2, 0.9),
        });
        const wick = [at[0], base + 0.065, at[2]];
        k.add(k.cylinder(0.008, 0.03), {
          pos: wick,
          weight: 4,
          pattern: false,
          color: "#2a1a10",
        });
        const part = k.part(`d${i}`, { pivot: wick });
        flame(k, vec.add(wick, [0, 0.012, 0]), {
          share: 0.007,
          height: 0.22,
          width: 0.03,
          size: 0.8,
          part,
        });
      }
      k.reach(vec.add(tip, [0, 0.75, 0]));
    },
  },

  // ---- Menorah ------------------------------------------------------------------------------
  menorah: {
    alive: true,
    controls: [{ key: "light", label: "Light the candles", type: "toggle", default: 1, ease: 4.5 }],
    action: { key: "light", label: "Light the candles", sound: "chime" },
    drive(t, c, out) {
      // The helper candle first, then the others one by one.
      out.parts.f8 = { visible: band(c.light, 0, 0.08) };
      for (let i = 0; i < 8; i++)
        out.parts[`f${i}`] = { visible: band(c.light, 0.1 + i * 0.11, 0.17 + i * 0.11) };
      out.amount = 0.8;
    },
    build(k) {
      const y0 = 0.35;
      const brass = (c) => gold(c);
      // Foot and stem.
      k.add(
        k.lathe(
          [
            [0, -0.95],
            [0.42, -0.94],
            [0.44, -0.9],
            [0.3, -0.84],
            [0.14, -0.78],
            [0.07, -0.66],
            [0.06, -0.5],
          ],
          { grid: 64 },
        ),
        { flat: 0.2, color: brass },
      );
      k.add(k.cylinder(0.045, y0 + 0.95 + 0.2), {
        pos: [0, (y0 + 0.2 - 0.95) / 2, 0],
        flat: 0.2,
        weight: 1.4,
        color: brass,
      });
      // Branches: four nested arcs.
      for (let i = 1; i <= 4; i++) {
        const R = 0.2 * i;
        k.add(
          k.tube(
            (t) => {
              const a = Math.PI * t;
              return [-Math.cos(a) * R, y0 - Math.sin(a) * R, 0];
            },
            0.028,
            { grid: 16, samples: 96 },
          ),
          { flat: 0.2, weight: 1.4, color: brass },
        );
      }
      // Cups, candles and flames.
      const spots = [];
      for (let i = 1; i <= 4; i++) spots.push([-0.2 * (5 - i), y0], [0.2 * i, y0]);
      spots.sort((a, b) => a[0] - b[0]);
      spots.push([0, y0 + 0.2]);
      const candles = [
        "#f4f0e6",
        "#6aa8ff",
        "#f4f0e6",
        "#6aa8ff",
        "#6aa8ff",
        "#f4f0e6",
        "#6aa8ff",
        "#f4f0e6",
        "#f4f0e6",
      ];
      spots.forEach(([x, y], i) => {
        k.add(k.cylinder(0.06, 0.06), { pos: [x, y + 0.03, 0], weight: 2, color: brass });
        k.add(k.cylinder(0.028, 0.26), {
          pos: [x, y + 0.19, 0],
          weight: 2,
          pattern: false,
          color: (c) =>
            lit(
              c,
              fract(c.lp[1] * 12 + Math.atan2(c.lp[0], c.lp[2]) / TAU) < 0.5
                ? candles[i]
                : mix(candles[i], "#ffffff", 0.5),
              0.25,
            ),
        });
        const part = k.part(`f${i}`, { pivot: [x, y + 0.34, 0] });
        flame(k, [x, y + 0.33, 0], { share: 0.018, height: 0.16, width: 0.025, part, size: 0.7 });
      });
      k.reach([0, y0 + 0.75, 0]);
    },
  },
};
