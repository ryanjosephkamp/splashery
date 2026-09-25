// Music pack: an acoustic guitar to strum, a snare drum with sticks and a toy
// xylophone with a mallet.

import {
  mix,
  shade,
  smoothstep,
  clamp,
  quatEuler,
  quatRotate,
  quatMul,
  quatAxisAngle,
  vec,
} from "../kit.js";

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
function metal(c, base, dark, floor = 0.2) {
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
const chrome = (c) => metal(c, "#d6dce2", "#3a3f46");

function wood(c, base, p, axis = 1, dark = 0.75) {
  const a = p[(axis + 1) % 3];
  const b = p[(axis + 2) % 3];
  const g = c.fbm(a * 9, p[axis] * 1.2, b * 9, 3);
  const ring = 0.5 + 0.5 * Math.sin((a * 0.7 + b * 0.5) * 40 + g * 7);
  return mix(base, shade(base, dark), 0.3 * ring + 0.3 * (0.5 + 0.5 * g));
}

// A group of shapes moved and turned together.
function group(k, pos = [0, 0, 0], rot = [0, 0, 0]) {
  const q = rot.length === 4 ? rot : quatEuler(...rot);
  return {
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

const line = (a, b) => (t) => vec.add(a, vec.mul(vec.sub(b, a), t));

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

// A drum roll at four speeds: seconds per stroke, how long it lasts after
// the last tap, and how high the sticks lift.
const ROLL = [
  { beat: 0.13, len: 1.7, lift: 0.34 },
  { beat: 0.095, len: 2.2, lift: 0.28 },
  { beat: 0.075, len: 2.6, lift: 0.24 },
  { beat: 0.06, len: 3.0, lift: 0.2 },
];

// The drumsticks, resting over the drum: butt, tip.
const STICKS = [
  { butt: [0.95, 0.62, 0.42], tip: [0.12, 0.33, 0.12], delay: 0 },
  { butt: [-0.9, 0.66, 0.46], tip: [-0.14, 0.34, 0.02], delay: 0.18 },
];
const stickAxis = (s) => vec.unit(vec.cross(vec.sub(s.tip, s.butt), [0, 1, 0]));

// Where the xylophone's mallet head is (so a quick second tap swings on
// from there instead of jumping home first).
const xylo = { head: null, from: null, tap: -1 };

// The xylophone's bars (x, length) and the mallet's resting head.
const XYLO = (() => {
  const bars = [];
  for (let i = 0; i < 8; i++) bars.push({ x: -0.77 + i * 0.22, len: 1.1 - i * 0.065 });
  return { bars, top: 0.08, rest: [0.55, 0.42, 0.55] };
})();

export const RECIPES = {
  // ---- Acoustic guitar ------------------------------------------------------------------
  guitar: {
    alive: true,
    options: [
      {
        key: "finish",
        label: "Finish",
        type: "select",
        default: "sunburst",
        choices: [
          { id: "sunburst", label: "Sunburst" },
          { id: "natural", label: "Natural" },
          { id: "cherry", label: "Cherry" },
        ],
      },
    ],
    controls: [{ key: "strum", label: "Strum", type: "pulse", ease: 3 }],
    action: { key: "strum", label: "Strum" },
    drive(t, c, out) {
      // A down-strum: each string is plucked a moment after the one above
      // and vibrates, bending at its middle and blurring wider, dying away
      // over about three seconds. The guitar rocks, hops and settles, and
      // rings of sound pulse out of the soundhole one after another.
      const e = (1 - c.strum) * 3;
      const on = c.strum > 0;
      for (let i = 0; i < 6; i++) {
        const el = e - 0.035 * i;
        const env = on && el > 0 ? Math.exp(-el * 0.8) * band(el, 0, 0.03) : 0;
        const a = 0.15 * env * Math.cos(TAU * (4.5 + i * 0.6) * el);
        out.parts[`s${i}a`] = { angle: a, visible: 1 + 1.6 * env };
        out.parts[`s${i}b`] = { angle: -a, visible: 1 + 1.6 * env };
      }
      for (let i = 0; i < 3; i++) {
        const a = 0.08 + i * 0.35;
        out.parts[`ring${i}`] = {
          visible: on ? 1.3 * Math.sin(Math.PI * band(e, a, a + 0.9)) : 0,
        };
      }
      if (on) {
        const rock = Math.exp(-e * 1.5) * Math.sin(e * 6);
        const hop = Math.sin(Math.PI * band(e, 0, 0.45));
        out.body = {
          quat: quatAxisAngle([0, 0, 1], -0.34 * rock),
          offset: [0, 0.1 * hop, 0],
          squash: -0.04 * hop + 0.05 * Math.sin(Math.PI * band(e, 0.45, 0.7)),
        };
      }
    },
    build(k, o) {
      const g = group(k, [0.1, -0.05, 0], [-12, 0, 38]);
      const T = 0.22;
      const yb = -0.9;
      const yt = 0.42;
      const smax = (a, b, s = 16) => Math.log(Math.exp(s * a) + Math.exp(s * b)) / s;
      const halfW = (y) => {
        const w1 = Math.sqrt(Math.max(0, 0.43 ** 2 - (y + 0.47) ** 2));
        const w2 = Math.sqrt(Math.max(0, 0.32 ** 2 - (y - 0.1) ** 2));
        const w =
          w1 > 0.001 || w2 > 0.001
            ? smax(w1, w2) - 0.04 * Math.exp(-(((y + 0.13) / 0.08) ** 2))
            : 0;
        return Math.max(0, Math.min(w, Math.max(w1, w2) + 0.02));
      };
      const top = {
        sunburst: ["#f2c278", "#6a2a10"],
        natural: ["#efcf96", "#c89a58"],
        cherry: ["#d8402e", "#5a0e10"],
      }[o.finish];
      const side = o.finish === "natural" ? "#8a4a22" : "#5a2412";
      // Soundboard with a sound hole and rosette.
      const face = (z, flip) =>
        k.param(
          (u, v) => {
            const y = yb + v * (yt - yb);
            return [(u * 2 - 1) * halfW(y), y, z];
          },
          { grid: 64, flip, normal: () => [0, 0, flip ? -1 : 1] },
        );
      g.add(face(T / 2, false), {
        flat: 0.15,
        color: (c) => {
          const [x, y] = c.lp;
          const hole = Math.hypot(x, y + 0.02);
          if (hole < 0.11) return null;
          if (hole < 0.15)
            return keep(Math.abs(fract(hole * 70) - 0.5) < 0.25 ? "#2a1a10" : "#e8d8b8");
          const w = halfW(y) || 1;
          if (Math.abs(x) > w - 0.015) return keep("#f4ead8");
          const edge = Math.max(Math.abs(x) / w, band(Math.abs(y + 0.25), 0.4, 0.66));
          const grain = 0.5 + 0.5 * Math.sin(x * 160 + c.noise(x * 4, y * 20, 0) * 3);
          const col = mix(top[0], top[1], Math.pow(edge, 3));
          return lit(c, shade(col, 0.95 + 0.07 * grain), 0.25, 0.45);
        },
      });
      g.add(face(-T / 2, true), {
        flat: 0.15,
        color: (c) => lit(c, wood(c, side, c.lp, 1), 0.3, 0.3),
      });
      // The dark inside, seen through the sound hole.
      g.add(k.disc(0.12), { pos: [0, -0.02, -T / 2 + 0.02], rot: [90, 0, 0], color: "#140c08" });
      // Ribs round the outline.
      g.add(
        k.param(
          (u, v) => {
            const right = u < 0.5;
            const s = right ? u / 0.5 : (u - 0.5) / 0.5;
            const y = right ? yb + s * (yt - yb) : yt - s * (yt - yb);
            return [(right ? 1 : -1) * halfW(y), y, (v - 0.5) * T];
          },
          { grid: 96 },
        ),
        { flat: 0.15, color: (c) => lit(c, wood(c, side, c.lp, 1), 0.3, 0.3) },
      );
      // Bridge and saddle.
      g.add(k.roundedBox(0.3, 0.06, 0.025, 4), {
        pos: [0, -0.58, T / 2 + 0.012],
        flat: 0.2,
        weight: 2,
        color: (c) => lit(c, "#2a1810", 0.3, 0.3),
      });
      g.add(k.box(0.2, 0.008, 0.012), {
        pos: [0, -0.575, T / 2 + 0.028],
        weight: 3,
        pattern: false,
        color: "#f4efe0",
      });
      // Neck, fingerboard with frets and dots, and the headstock with pegs.
      const nutY = 1.36;
      const L = nutY + 0.575;
      const fret = (n) => nutY - L * (1 - Math.pow(2, -n / 12));
      g.add(k.box(0.1, nutY - 0.38, 0.05), {
        pos: [0, (nutY + 0.38) / 2, T / 2 - 0.035],
        flat: 0.2,
        color: (c) => lit(c, wood(c, "#9a6a3a", c.lp, 1), 0.3),
      });
      g.add(k.box(0.1, nutY - 0.12, 0.018), {
        pos: [0, (nutY + 0.12) / 2, T / 2 + 0.005],
        flat: 0.15,
        weight: 1.5,
        color: (c) => {
          const y = c.p === undefined ? 0 : c.lp[1] + (nutY + 0.12) / 2;
          for (let n = 1; n <= 19; n++)
            if (Math.abs(y - fret(n)) < 0.005) return keep(metal(c, "#e0e4e8"));
          for (const n of [3, 5, 7, 9, 15, 17])
            if (Math.hypot(c.lp[0], y - (fret(n) + fret(n - 1)) / 2) < 0.016)
              return keep("#f4f0e6");
          if (
            Math.abs(y - (fret(12) + fret(11)) / 2) < 0.016 &&
            Math.abs(Math.abs(c.lp[0]) - 0.025) < 0.012
          )
            return keep("#f4f0e6");
          return lit(c, "#2e1e14", 0.25);
        },
      });
      g.add(k.box(0.105, 0.012, 0.022), {
        pos: [0, nutY, T / 2 + 0.012],
        weight: 3,
        pattern: false,
        color: "#f4efe0",
      });
      g.add(k.roundedBox(0.16, 0.34, 0.035, 5), {
        pos: [0, nutY + 0.18, T / 2 - 0.04],
        rot: [-10, 0, 0],
        flat: 0.2,
        color: (c) => lit(c, "#2a1810", 0.3, 0.4),
      });
      for (let i = 0; i < 3; i++)
        for (const s of [-1, 1]) {
          const y = nutY + 0.08 + i * 0.09;
          g.add(k.cylinder(0.016, 0.07), {
            pos: [s * 0.1, y, T / 2 - 0.04],
            rot: [0, 0, 90],
            weight: 3,
            pattern: false,
            color: (c) => chrome(c),
          });
          g.add(k.roundedBox(0.03, 0.05, 0.015, 4), {
            pos: [s * 0.15, y, T / 2 - 0.04],
            weight: 3,
            pattern: false,
            color: (c) => lit(c, "#f0e8d8", 0.3),
          });
        }
      // Rings of sound that pulse out of the soundhole, hidden at rest: three
      // circles of glowing sparks, each wider than the last.
      for (let i = 0; i < 3; i++) {
        const ring = k.part(`ring${i}`, { pivot: g.pt([0, -0.02, T / 2]) });
        const rr = 0.2 + i * 0.15;
        k.cloud({ share: 0.008, size: 1.1 + 0.25 * i, pattern: false }, (rand) => {
          const a = rand() * TAU;
          const r = rr * (0.96 + 0.08 * rand());
          const d = [Math.cos(a), Math.sin(a), 0];
          return {
            p: g.pt([d[0] * r, -0.02 + d[1] * r, T / 2 + 0.07 + 0.03 * i]),
            n: g.dir([0, 0, 1]),
            color: mix("#fff4c8", "#ffc24a", i * 0.4 + 0.3 * rand()),
            opacity: 0.9,
            part: ring,
            kind: "twinkle",
            params: [0.4, rand() * TAU],
          };
        });
      }
      // Six strings that vibrate when strummed. Each is two halves, turned
      // about the bridge and the nut, so it bends at the middle while both
      // ends stay put.
      const zS = T / 2 + 0.03;
      const normal = g.dir([0, 0, 1]);
      for (let i = 0; i < 6; i++) {
        const f = (i - 2.5) / 2.5;
        const a = [f * 0.075, -0.575, zS];
        const b = [f * 0.042, nutY, zS];
        const mid = vec.mul(vec.add(a, b), 0.5);
        const r = 0.005 - i * 0.0004;
        const wound = i < 4;
        for (const [p0, p1, key] of [
          [a, mid, "a"],
          [mid, b, "b"],
        ]) {
          const part = k.part(`s${i}${key}`, { pivot: g.pt(key === "a" ? a : b), axis: normal });
          g.add(k.tube(line(p0, p1), r, { grid: 8, samples: 16 }), {
            part,
            flat: 0.3,
            weight: 6,
            size: 0.6,
            pattern: false,
            color: (c) => lit(c, wound ? "#e8c890" : "#ffffff", 0.15),
          });
        }
      }
    },
  },

  // ---- Snare drum ---------------------------------------------------------------------------
  drum: {
    alive: true,
    options: [{ key: "shell", label: "Shell", type: "color", default: "#c8202e" }],
    controls: [{ key: "hit", label: "Hit", type: "pulse", ease: 3.2 }],
    action: { key: "hit", label: "Play a roll" },
    drive(t, c, out) {
      // A roll: the sticks strike in turn. A tap during a roll speeds it up
      // (four speeds) and makes it last longer; a pause starts over slowly.
      const m = mem(c);
      const e = (1 - c.hit) * 3.2;
      if (fired(m, "hit", c.hit)) {
        m.level = m.rolling && m.gap < 0.9 ? Math.min(3, (m.level ?? 0) + 1) : 0;
        m.fresh = !m.rolling;
        if (m.fresh) m.beats = 0;
        m.last = 0;
      }
      const R = ROLL[m.level ?? 0];
      m.gap = e;
      m.beats = (m.beats ?? 0) + Math.max(0, e - (m.last ?? e)) / R.beat;
      m.last = e;
      const env =
        c.hit > 0 ? (m.fresh ? band(e, 0, 0.08) : 1) * (1 - band(e, R.len - 0.3, R.len)) : 0;
      m.rolling = env > 0;
      const P = m.beats;
      STICKS.forEach((s, i) => {
        const up = Math.sin((Math.PI * (P + i)) / 2) ** 2;
        out.parts[`stick${i}`] = { angle: env * (-0.1 + (R.lift + 0.1) * up) };
      });
      const hitNow = Math.exp(-fract(P) * 5);
      out.amount = 1.2 * env;
      out.body = { squash: 0.03 * env * hitNow };
    },
    build(k, o) {
      const R = 0.7;
      const H = 0.42;
      const shellCol = o.shell;
      k.add(k.cylinder(R, H, { caps: false }), {
        flat: 0.2,
        color: (c) => {
          const sparkle = c.noise(c.p[0] * 90, c.p[1] * 90, c.p[2] * 90) > 0.55;
          return lit(c, sparkle ? mix(shellCol, "#ffffff", 0.45) : shellCol, 0.35, 0.6);
        },
      });
      // Heads: the top one ripples when hit.
      k.add(k.disc(R - 0.01), {
        pos: [0, H / 2 + 0.005, 0],
        flat: 0.2,
        kind: "wave",
        params: (c) => {
          const r = Math.hypot(c.p[0], c.p[2]) / R;
          return [0.08 * (1 - r * r), -r * 16];
        },
        color: (c) => {
          const r = Math.hypot(c.p[0], c.p[2]);
          const n = c.noise(c.p[0] * 30, 0, c.p[2] * 30);
          if (c.n[1] < 0) return "#dcd8cc";
          // A reinforcing dot in the middle and a faint ring pattern, so
          // the ripples show.
          if (r < 0.14) return keep(shade("#3a3a40", 0.9 + 0.2 * n));
          const ring = 0.5 + 0.5 * Math.cos(r * 60);
          return shade("#f3f0e6", 0.93 + 0.05 * n + 0.04 * ring - 0.06 * band(r, 0.5, 0.7));
        },
      });
      k.add(k.disc(R - 0.01), { pos: [0, -H / 2 - 0.005, 0], flat: 0.2, color: "#e8e4da" });
      for (const y of [H / 2 + 0.01, -H / 2 - 0.01])
        k.add(k.torus(R + 0.012, 0.028), {
          pos: [0, y, 0],
          weight: 1.6,
          pattern: false,
          color: (c) => chrome(c),
        });
      // Lugs and tension rods.
      for (let i = 0; i < 8; i++) {
        const a = (i / 8) * TAU + TAU / 16;
        const d = [Math.sin(a), 0, Math.cos(a)];
        k.add(k.roundedBox(0.06, 0.13, 0.05, 4), {
          pos: [d[0] * (R + 0.02), 0, d[2] * (R + 0.02)],
          rot: [0, (a * 180) / Math.PI, 0],
          weight: 2,
          pattern: false,
          color: (c) => chrome(c),
        });
        for (const s of [1, -1])
          k.add(k.cylinder(0.009, 0.12), {
            pos: [d[0] * (R + 0.03), s * 0.14, d[2] * (R + 0.03)],
            weight: 3,
            pattern: false,
            color: (c) => chrome(c),
          });
      }
      // Two drumsticks, resting over the head.
      STICKS.forEach((s, i) => {
        const part = k.part(`stick${i}`, { pivot: s.butt, axis: stickAxis(s) });
        k.add(
          k.tube(line(s.butt, s.tip), (t) => 0.024 - 0.012 * t * t, {
            grid: 16,
            samples: 32,
            caps: true,
          }),
          {
            part,
            flat: 0.2,
            weight: 1.5,
            pattern: false,
            color: (c) => lit(c, wood(c, "#e0b27a", c.p, 0, 0.85), 0.3, 0.3),
          },
        );
        k.add(k.sphere(0.02), {
          pos: s.tip,
          scale: [1, 0.8, 1],
          part,
          weight: 3,
          pattern: false,
          color: (c) => lit(c, "#e8c08a", 0.3, 0.3),
        });
      });
      k.reach([0, 0.9, 0]);
    },
  },

  // ---- Toy xylophone --------------------------------------------------------------------
  xylophone: {
    alive: true,
    controls: [
      { key: "play", label: "Play", type: "pulse", ease: 3 },
      // A tap on one bar strikes just that bar (the sound plays its note).
      { key: "strike", label: "Strike", type: "pulse", ease: 1 },
    ],
    action: {
      key: "play",
      label: "Play a scale",
      // Any tap over the row of bars strikes the nearest bar (fingers are
      // wide); a tap on the mallet, a wheel or the rail ends plays the scale.
      at(p) {
        const X = XYLO;
        if (p[1] < X.top - 0.07 || p[1] > X.top + 0.25) return null;
        let i = -1;
        let best = 0.14;
        X.bars.forEach((b, k) => {
          const d = Math.abs(p[0] - b.x);
          if (d < best && Math.abs(p[2]) < (b.len * 0.86) / 2 + 0.08) [i, best] = [k, d];
        });
        return i < 0 ? null : { key: "strike", pick: i };
      },
    },
    drive(t, c, out, info) {
      const X = XYLO;
      const u = 1 - c.play;
      const first = X.bars[0];
      const last = X.bars[7];
      const at = (s) => {
        const x = first.x + (last.x - first.x) * s;
        const hop = Math.abs(Math.sin(Math.PI * s * 7));
        return [x, X.top + 0.06 + 0.14 * hop, 0.08];
      };
      // A struck bar dips and rings for a moment.
      const dip = X.bars.map(() => 0);
      const ring = (e, a = 0.018) => (e < 0 ? 0 : -a * Math.exp(-e * 6) * Math.cos(e * 45));
      let head = X.rest;
      if (c.play > 0) {
        if (u < 0.1) head = vec.add(X.rest, vec.mul(vec.sub(at(0), X.rest), easeInOut(u / 0.1)));
        else if (u < 0.85) head = at((u - 0.1) / 0.75);
        else head = vec.add(at(1), vec.mul(vec.sub(X.rest, at(1)), easeInOut((u - 0.85) / 0.15)));
        X.bars.forEach((b, k) => (dip[k] = ring((u - 0.1 - (0.75 * k) / 7) * 3)));
      }
      // One bar: the mallet swings over it from wherever it is, strikes at
      // 0.12 s (with the note), bounces up and goes home; the bar jumps.
      const i = info?.tap?.key === "strike" ? info.tap.pick : null;
      if (c.strike > 0 && i !== null && !(c.play > 0)) {
        const e = 1 - c.strike;
        if (xylo.tap !== info.tap.n) {
          xylo.tap = info.tap.n;
          xylo.from = xylo.head;
        }
        const from = xylo.from || X.rest;
        const hit = [X.bars[i].x, X.top + 0.06, 0.08];
        const above = vec.add(hit, [0, 0.24, 0]);
        if (e < 0.07) head = vec.add(from, vec.mul(vec.sub(above, from), easeInOut(e / 0.07)));
        else if (e < 0.12) head = vec.add(above, vec.mul(vec.sub(hit, above), ((e - 0.07) / 0.05) ** 2)); // prettier-ignore
        else if (e < 0.3) head = vec.add(hit, [0, 0.16 * Math.sin(Math.PI * ((e - 0.12) / 0.36)), 0]);
        else head = vec.add(vec.add(hit, [0, 0.16, 0]), vec.mul(vec.sub(X.rest, vec.add(hit, [0, 0.16, 0])), easeInOut((e - 0.3) / 0.7))); // prettier-ignore
        dip[i] = ring(e - 0.12, 0.045);
      }
      xylo.head = head;
      out.parts.mallet = { offset: vec.sub(head, X.rest) };
      X.bars.forEach((b, k) => (out.parts[`bar${k}`] = { offset: [0, dip[k], 0] }));
      out.amount = Math.max(c.play, c.strike * 0.6);
    },
    build(k) {
      const X = XYLO;
      const colors = [
        "#e8352e",
        "#f2862a",
        "#f6d02a",
        "#4cc84a",
        "#2ab8b0",
        "#2f7fe0",
        "#5a4fd8",
        "#b04ad8",
      ];
      // Two wooden rails under the bar ends, closer together to the right.
      const railZ = (x, s) => s * (0.42 - 0.12 * ((x + 0.77) / 1.54));
      for (const s of [-1, 1]) {
        const a = [-0.95, 0, railZ(-0.95, s)];
        const b = [0.95, 0, railZ(0.95, s)];
        k.add(k.tube(line(a, b), 0.05, { grid: 16, samples: 8, caps: true }), {
          flat: 0.2,
          color: (c) => lit(c, wood(c, "#d8a86a", c.p, 0), 0.3, 0.2),
        });
        // Little wheels, for pulling it along.
        for (const x of [-0.8, 0.8])
          k.add(k.cylinder(0.11, 0.05), {
            pos: [x, -0.08, railZ(x, s) + s * 0.07],
            rot: [90, 0, 0],
            flat: 0.2,
            weight: 1.4,
            pattern: false,
            color: (c) =>
              c.s.cap && c.s.radial < 0.4 ? lit(c, "#f4f0e6", 0.3) : lit(c, "#d8262e", 0.3, 0.4),
          });
      }
      // The bars, with a nail at each end.
      X.bars.forEach((b, i) => {
        const half = (b.len / 2) * 0.86;
        const bar = k.part(`bar${i}`, { pivot: [b.x, X.top, 0] });
        k.add(k.roundedBox(0.17, 0.05, b.len * 0.86, 5), {
          pos: [b.x, X.top, 0],
          part: bar,
          flat: 0.18,
          kind: "wave",
          params: [0.012, i * 1.3],
          color: (c) => lit(c, colors[i], 0.35, 0.7),
        });
        for (const s of [-1, 1])
          k.add(k.sphere(0.022), {
            pos: [b.x, X.top + 0.025, s * Math.min(half - 0.06, Math.abs(railZ(b.x, s)))],
            part: bar,
            weight: 3,
            pattern: false,
            color: (c) => chrome(c),
          });
      });
      // The mallet: a stick with a round head.
      const head = X.rest;
      const end = [1.05, 0.62, 0.95];
      const mallet = k.part("mallet", { pivot: head });
      k.add(k.tube(line(head, end), 0.022, { grid: 16, samples: 16, caps: true }), {
        part: mallet,
        flat: 0.2,
        weight: 1.5,
        pattern: false,
        color: (c) => lit(c, wood(c, "#e8c08a", c.p, 0, 0.85), 0.3),
      });
      k.add(k.sphere(0.075), {
        pos: head,
        part: mallet,
        weight: 2,
        pattern: false,
        color: (c) => lit(c, "#d8262e", 0.35, 0.8),
      });
      k.reach([-0.8, 0.45, 0]);
    },
  },
};
