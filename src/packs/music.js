// Music pack: an acoustic guitar to strum, a snare drum with sticks, a toy
// xylophone with a mallet and a toy piano with hammers and metal rods.

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
import { evenCylinder, evenTorus, evenTube } from "./even.js";

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

// Lacquered wood (the guitar, lane Fix6): a smooth color lit softly, with one
// broad sheen and no fine grain or noise, so it reads as a glossy finish at
// any size. `bands` gives a faint, wide figure (0 for none).
function lacquer(c, col, gloss = 0.35, bands = 0) {
  const d = dot(c.n, LIGHT);
  let out = shade(col, 0.92 + 0.22 * d);
  if (bands) {
    const [x, y] = c.lp;
    const f = 0.5 + 0.5 * Math.sin(x * 14 + y * 1.5 + 2.5 * c.noise(x * 1.5, y * 0.6, 0.3));
    out = mix(out, shade(out, 0.8), bands * f);
  }
  const h = Math.pow(Math.max(0, dot(c.n, HALF)), 10);
  return keep(mix(out, "#fff8ee", gloss * h));
}
const smooth = { even: true, jitter: 0 };

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

// ---- Toy piano -----------------------------------------------------------------------
//
// An upright toy piano: 18 keys (C5 to F6, black keys raised), and behind
// them, seen through the open back and the raised lid, a hammer and a steel
// rod for each key. A key goes down, its hammer swings up and back and
// strikes its rod, and the rod shivers as the note rings. Keys and hammers
// are tokens 0-17 and 18-35, rods 0-11 are tokens 36-47 and rods 12-17 are
// parts (a toy has 48 tokens and 15 parts).

// The notes of "Twinkle, Twinkle, Little Star" (the opening line), as key
// indices from C5; -1 is a rest. src/toy-sounds.js plays the same notes.
export const TOY_PIANO_SONG = [0, 0, 7, 7, 9, 9, 7, -1, 5, 5, 4, 4, 2, 2, 0];
const TP_SONG = TOY_PIANO_SONG;
const TP_NAMES = "C5 C#5 D5 D#5 E5 F5 F#5 G5 G#5 A5 A#5 B5 C6 C#6 D6 D#6 E6 F6".split(" ");
const TP = (() => {
  const W = 0.108; // white key pitch
  const keys = [];
  let white = 0;
  for (let i = 0; i < 18; i++) {
    const black = [1, 3, 6, 8, 10].includes(i % 12);
    const x = black ? (white - 0.5 - 5) * W : (white - 5) * W;
    if (!black) white++;
    keys.push({ i, black, x, note: TP_NAMES[i] });
  }
  const RS = 0.064; // rod spacing
  const rods = keys.map((k) => ({ x: (k.i - 8.5) * RS, len: 0.44 * 2 ** (-k.i / 24) }));
  return {
    W,
    keys,
    rods,
    keyTop: 0.46, // white key top
    keyFront: 0.44,
    fulcrum: [0.43, 0.02], // y, z of the balance rail
    rodZ: -0.2, // rods stand on a steel block at the back
    rodBase: 0.5,
    rodR: 0.0115,
    // Each hammer leans forward on its rail at rest and swings up and back
    // through about a sixth of a turn to meet its rod.
    hamPivot: [0.52, -0.13], // y, z
    hamHead: [0.632, -0.002], // the head's centre at rest
    headR: 0.025,
    step: 0.28, // seconds between the song's notes
    songAt: 0.2, // the first key starts down
    hit: 0.09, // seconds from a key starting down to its hammer striking
  };
})();
// How far the hammer turns (about X) to bring its head against the rod.
TP.hamHit = (() => {
  const dy = TP.hamHead[0] - TP.hamPivot[0];
  const dz = TP.hamHead[1] - TP.hamPivot[1];
  const target = TP.rodZ + TP.rodR + TP.headR - TP.hamPivot[1];
  return Math.asin(target / Math.hypot(dy, dz)) - Math.atan2(dz, dy);
})();
const TP_ROD_AXIS = vec.unit([0.6, 0, 1]);
TP.songLen = TP.songAt + TP.step * (TP_SONG.length - 1) + 1.6;

// One key's struck note, as a cue: two tine partial sets a hair apart (the
// rod rings in two planes, so it shimmers) and the hammer's tick.
const tpNote = (note) => [
  { voice: "tine", f: note, decay: 0.45, bright: 0.85 },
  { voice: "tine", f: note, pitch: 1.004, decay: 0.38, bright: 0.6, vol: 0.45 },
  { voice: "clack", f: note, pitch: 6.5, decay: 0.6, vol: 0.18 },
];

// One key's press at s seconds after it starts down: how far the key has
// turned, the hammer's turn, and the rod's shiver (radians).
function tpPress(s) {
  if (!(s >= 0) || s > 1.6) return { key: 0, ham: 0, rod: 0 };
  const key = 0.13 * (s < 0.06 ? easeInOut(s / 0.06) : s < 0.24 ? 1 : 1 - easeInOut((s - 0.24) / 0.14)); // prettier-ignore
  let ham = 0;
  const h = TP.hamHit;
  if (s < TP.hit) ham = h * ((s - 0.01) / (TP.hit - 0.01)) ** 2 * (s > 0.01 ? 1 : 0);
  else if (s < 0.34) ham = h * (1 - easeInOut((s - TP.hit) / (0.34 - TP.hit)) * 1.08);
  else if (s < 0.46) ham = h * -0.08 * (1 - easeInOut((s - 0.34) / 0.12));
  const r = s - TP.hit;
  const rod =
    r > 0 ? 0.06 * Math.exp(-r * 3.2) * Math.sin(TAU * 11 * r) * (1 - band(r, 1.1, 1.45)) : 0;
  return { key, ham, rod };
}

// A flat rectangle in the XY plane facing +Z, sampled evenly (two random
// numbers per splat, so even: true spreads it without a lattice).
// A long, thin rectangle folds the even square into m strips laid end to
// end, so its splats stay evenly spaced both ways (a plain stretch spaces
// them m² times closer along the short side, which shows as a hatch).
function rect(w, h) {
  const n = [0, 0, 1];
  const long = w >= h;
  const m = Math.max(1, Math.round(Math.sqrt(long ? w / h : h / w)));
  return {
    area: w * h,
    thick: 0.01,
    dims: 2,
    sample(rand) {
      const a = rand();
      const b = rand() * m;
      const j = Math.min(m - 1, Math.floor(b));
      const along = (j + a) / m;
      const across = b - j;
      const u = long ? along : across;
      const v = long ? across : along;
      return { p: [(u - 0.5) * w, (v - 0.5) * h, 0], n, u, v };
    },
  };
}
// A box as six even rectangles; `skip` names faces to leave out ("x" +X,
// "X" -X, "y" top, "Y" bottom, "z" front, "Z" back).
const FACES = [
  ["x", [1, 0, 0], [0, 90, 0]],
  ["X", [-1, 0, 0], [0, -90, 0]],
  ["y", [0, 1, 0], [-90, 0, 0]],
  ["Y", [0, -1, 0], [90, 0, 0]],
  ["z", [0, 0, 1], [0, 0, 0]],
  ["Z", [0, 0, -1], [0, 180, 0]],
];
// Smaller splats along a face's edges, so they stop at the edge instead of
// spilling past it as a fuzzy rim.
function crisp(color, w, h) {
  const fn = typeof color === "function" ? color : () => color ?? "#cccccc";
  return (c) => {
    const col = fn(c);
    if (col === null) return null;
    const d = Math.min(c.u * w, (1 - c.u) * w, c.v * h, (1 - c.v) * h);
    if (d >= 0.008) return col;
    const size = 0.5 + (0.5 * d) / 0.008;
    return col && typeof col === "object" && !Array.isArray(col) ? { ...col, size: (col.size ?? 1) * size } : { c: col, size }; // prettier-ignore
  };
}
// `opts.quat` turns the whole box about its centre.
function box6(k, at, size, opts = {}, skip = "") {
  const [sx, sy, sz] = size;
  const q = opts.quat || [0, 0, 0, 1];
  for (const [id, n, rot] of FACES) {
    if (skip.includes(id)) continue;
    const w = n[0] ? sz : sx;
    const h = n[1] ? sz : sy;
    const d = quatRotate(q, [(n[0] * sx) / 2, (n[1] * sy) / 2, (n[2] * sz) / 2]);
    const quat = quatMul(q, quatEuler(...rot));
    k.add(rect(w, h), { even: true, opacity: 1, jitter: 0.01, ...opts, pos: vec.add(at, d), quat, color: crisp(opts.color, w, h) }); // prettier-ignore
  }
}
// A rod standing up from its base: an even parametric tube with a round top.
function rodShape(k, base, r, len, opts) {
  k.add(
    k.param((u, v) => [base[0] + r * Math.cos(TAU * u), base[1] + v * len, base[2] + r * Math.sin(TAU * u)], { grid: 48, thick: r }), // prettier-ignore
    { even: true, opacity: 1, jitter: 0.01, ...opts },
  );
  k.add(
    k.param(
      (u, v) => {
        const a = TAU * u;
        const b = (Math.PI / 2) * v;
        return [base[0] + r * Math.cos(b) * Math.cos(a), base[1] + len + r * Math.sin(b), base[2] + r * Math.cos(b) * Math.sin(a)]; // prettier-ignore
      },
      { grid: 16, thick: r },
    ),
    { even: true, opacity: 1, jitter: 0.01, ...opts },
  );
}
// Softly lit steel: a smooth gradient with the light and one broad sheen, so
// a thin rod reads as polished metal without per-splat speckle.
function steel(c) {
  const d = dot(c.n, LIGHT);
  const h = Math.pow(Math.max(0, dot(c.n, HALF)), 6);
  return mix(mix("#6f7780", "#e2e7ec", 0.5 + 0.5 * d), "#ffffff", 0.7 * h);
}

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
      // Soundboard with a sound hole and rosette. (Each face is a flat sheet
      // whose rows are spaced by the outline's width, so its splats are
      // spread alike everywhere: no rows, no lattice.)
      const ROWS = 256;
      const cum = [0];
      for (let i = 0; i < ROWS; i++)
        cum.push(cum[i] + 2 * halfW(yb + ((i + 0.5) / ROWS) * (yt - yb)));
      const yAt = (v) => {
        const want = v * cum[ROWS];
        let i = 0;
        while (i < ROWS - 1 && cum[i + 1] < want) i++;
        const f = (want - cum[i]) / Math.max(1e-9, cum[i + 1] - cum[i]);
        return yb + ((i + f) / ROWS) * (yt - yb);
      };
      const face = (z, flip) => {
        const n = [0, 0, flip ? -1 : 1];
        return {
          area: (cum[ROWS] / ROWS) * (yt - yb),
          thick: 0.01,
          dims: 2,
          sample(rand) {
            const u = rand();
            const v = rand();
            const y = yAt(v);
            return { p: [(u * 2 - 1) * halfW(y), y, z], n, u, v, face: flip ? 3 : 2 };
          },
        };
      };
      g.add(face(T / 2, false), {
        flat: 0.15,
        ...smooth,
        color: (c) => {
          const [x, y] = c.lp;
          const hole = Math.hypot(x, y + 0.02);
          if (hole < 0.11) return null;
          if (hole < 0.15) {
            const dark = hole < 0.117 || (hole > 0.127 && hole < 0.133) || hole > 0.143;
            return keep(dark ? "#2a1a10" : "#e8d8b8");
          }
          const w = halfW(y) || 1;
          if (Math.abs(x) > w - 0.02) return keep("#f4ead8");
          const edge = Math.max(Math.abs(x) / w, band(Math.abs(y + 0.25), 0.4, 0.66));
          return lacquer(c, mix(top[0], top[1], Math.pow(edge, 3)), 0.4);
        },
      });
      g.add(face(-T / 2, true), {
        flat: 0.15,
        ...smooth,
        color: (c) => lacquer(c, side, 0.3, 0.12),
      });
      // The dark inside, seen through the sound hole.
      g.add(k.disc(0.12), { pos: [0, -0.02, -T / 2 + 0.02], rot: [90, 0, 0], ...smooth, color: () => keep("#140c08") }); // prettier-ignore
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
        // The cream binding wraps over the top edge of the ribs.
        { flat: 0.15, ...smooth, color: (c) => (c.v > 0.86 ? keep("#f4ead8") : lacquer(c, side, 0.3, 0.1)) }, // prettier-ignore
      );
      // Bridge and saddle.
      g.add(k.roundedBox(0.3, 0.06, 0.025, 4), {
        pos: [0, -0.58, T / 2 + 0.012],
        flat: 0.2,
        weight: 2,
        ...smooth,
        color: (c) => lacquer(c, "#2a1810", 0.3),
      });
      g.add(k.box(0.2, 0.008, 0.012), {
        pos: [0, -0.575, T / 2 + 0.028],
        weight: 3,
        pattern: false,
        ...smooth,
        color: () => keep("#f4efe0"),
      });
      // Neck, fingerboard with frets and dots, and the headstock with pegs.
      const nutY = 1.36;
      const L = nutY + 0.575;
      const fret = (n) => nutY - L * (1 - Math.pow(2, -n / 12));
      g.add(k.box(0.1, nutY - 0.38, 0.05), {
        pos: [0, (nutY + 0.38) / 2, T / 2 - 0.035],
        flat: 0.2,
        ...smooth,
        color: (c) => lacquer(c, "#9a6a3a", 0.3, 0.1),
      });
      g.add(k.box(0.1, nutY - 0.12, 0.018), {
        pos: [0, (nutY + 0.12) / 2, T / 2 + 0.005],
        flat: 0.15,
        weight: 1.5,
        ...smooth,
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
          return lacquer(c, "#2e1e14", 0.2);
        },
      });
      g.add(k.box(0.105, 0.012, 0.022), {
        pos: [0, nutY, T / 2 + 0.012],
        weight: 3,
        pattern: false,
        ...smooth,
        color: () => keep("#f4efe0"),
      });
      g.add(k.roundedBox(0.16, 0.34, 0.035, 5), {
        pos: [0, nutY + 0.18, T / 2 - 0.04],
        rot: [-10, 0, 0],
        flat: 0.2,
        ...smooth,
        color: (c) => lacquer(c, "#2a1810", 0.4),
      });
      for (let i = 0; i < 3; i++)
        for (const s of [-1, 1]) {
          const y = nutY + 0.08 + i * 0.09;
          g.add(k.cylinder(0.016, 0.07), {
            pos: [s * 0.1, y, T / 2 - 0.04],
            rot: [0, 0, 90],
            weight: 3,
            pattern: false,
            ...smooth,
            color: (c) => keep(chrome(c)),
          });
          g.add(k.roundedBox(0.03, 0.05, 0.015, 4), {
            pos: [s * 0.15, y, T / 2 - 0.04],
            weight: 3,
            pattern: false,
            ...smooth,
            color: (c) => lacquer(c, "#f0e8d8", 0.3),
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
        const r = 0.0026 - i * 0.00026;
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
            // Splats drawn out along the string, so it reads as one line.
            stretch: 3,
            pattern: false,
            ...smooth,
            // Clean lines: one even color along each string, lit softly.
            color: (c) => keep(lit(c, wound ? "#dcbc84" : "#eef1f4", 0.12)),
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
      k.add(evenCylinder(R, R, H, false), {
        even: true,
        opacity: 1,
        jitter: 0.015,
        flat: 0.2,
        color: (c) => {
          const sparkle = c.noise(c.p[0] * 90, c.p[1] * 90, c.p[2] * 90) > 0.55;
          return lit(c, sparkle ? mix(shellCol, "#ffffff", 0.16) : shellCol, 0.35, 0.6);
        },
      });
      // Heads: the top one ripples when hit.
      k.add(k.disc(R - 0.01), {
        opacity: 1,
        jitter: 0.015,
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
      k.add(k.disc(R - 0.01), {
        opacity: 1,
        jitter: 0.015,
        pos: [0, -H / 2 - 0.005, 0],
        flat: 0.2,
        color: "#e8e4da",
      });
      for (const y of [H / 2 + 0.01, -H / 2 - 0.01])
        k.add(evenTorus(k, R + 0.012, 0.028), {
          even: true,
          opacity: 1,
          jitter: 0.015,
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
          even: true,
          opacity: 1,
          jitter: 0.015,
          pos: [d[0] * (R + 0.02), 0, d[2] * (R + 0.02)],
          rot: [0, (a * 180) / Math.PI, 0],
          weight: 2,
          pattern: false,
          color: (c) => chrome(c),
        });
        for (const s of [1, -1])
          k.add(evenCylinder(0.009, 0.009, 0.12), {
            even: true,
            opacity: 1,
            jitter: 0.015,
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
          evenTube(k, line(s.butt, s.tip), (t) => 0.024 - 0.012 * t * t, {
            grid: 16,
            samples: 32,
            caps: true,
          }),
          {
            even: true,
            opacity: 1,
            jitter: 0.015,
            part,
            flat: 0.2,
            weight: 1.5,
            pattern: false,
            color: (c) => lit(c, wood(c, "#e0b27a", c.p, 0, 0.85), 0.3, 0.3),
          },
        );
        k.add(k.sphere(0.02), {
          even: true,
          opacity: 1,
          jitter: 0.015,
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
        k.add(evenTube(k, line(a, b), 0.05, { grid: 16, samples: 8, caps: true }), {
          even: true,
          opacity: 1,
          jitter: 0.015,
          flat: 0.2,
          color: (c) => lit(c, wood(c, "#d8a86a", c.p, 0), 0.3, 0.2),
        });
        // Little wheels, for pulling it along.
        for (const x of [-0.8, 0.8])
          k.add(evenCylinder(0.11, 0.11, 0.05), {
            even: true,
            opacity: 1,
            jitter: 0.015,
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
          even: true,
          opacity: 1,
          jitter: 0.015,
          pos: [b.x, X.top, 0],
          part: bar,
          flat: 0.18,
          kind: "wave",
          params: [0.012, i * 1.3],
          color: (c) => lit(c, colors[i], 0.35, 0.7),
        });
        for (const s of [-1, 1])
          k.add(k.sphere(0.022), {
            even: true,
            opacity: 1,
            jitter: 0.015,
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
      k.add(evenTube(k, line(head, end), 0.022, { grid: 16, samples: 16, caps: true }), {
        even: true,
        opacity: 1,
        jitter: 0.015,
        part: mallet,
        flat: 0.2,
        weight: 1.5,
        pattern: false,
        color: (c) => lit(c, wood(c, "#e8c08a", c.p, 0, 0.85), 0.3),
      });
      k.add(k.sphere(0.075), {
        even: true,
        opacity: 1,
        jitter: 0.015,
        pos: head,
        part: mallet,
        weight: 2,
        pattern: false,
        color: (c) => lit(c, "#d8262e", 0.35, 0.8),
      });
      k.reach([-0.8, 0.45, 0]);
    },
  },
  // ---- Toy piano ----------------------------------------------------------------------
  "toy-piano": {
    alive: true,
    options: [{ key: "case", label: "Color", type: "color", default: "#c8202e" }],
    controls: [
      { key: "play", label: "Play", type: "pulse", ease: TP.songLen },
      // A tap on one key (or its hammer or rod) plays just that key; its
      // note is a cue, so it sounds as the hammer lands.
      { key: "strike", label: "Strike", type: "pulse", ease: 1.6 },
    ],
    action: {
      key: "play",
      label: "Play Twinkle, Twinkle",
      quiet: ["strike"],
      // A tap on a key, a hammer or a rod strikes that key; a tap anywhere
      // else on the piano plays the song.
      at(p) {
        const [x, y, z] = p;
        let best = -1;
        let far = Infinity;
        if (z > 0.09 && z < 0.5 && y > TP.keyTop - 0.1 && y < TP.keyTop + 0.1) {
          // The black keys stand higher and end sooner.
          if (z < 0.32 && y > TP.keyTop - 0.01)
            TP.keys.forEach((k) => {
              const d = Math.abs(x - k.x);
              if (k.black && d < 0.036 && d < far) [best, far] = [k.i, d];
            });
          if (best < 0)
            TP.keys.forEach((k) => {
              const d = Math.abs(x - k.x);
              if (!k.black && d < TP.W / 2 + 0.02 && d < far) [best, far] = [k.i, d];
            });
        } else if (z > -0.32 && z < 0.08 && y > 0.44 && y < 1.02 && Math.abs(x) < 0.62) {
          TP.rods.forEach((r, i) => {
            const d = Math.abs(x - r.x);
            if (d < far) [best, far] = [i, d];
          });
        }
        return best < 0 ? null : { key: "strike", pick: best };
      },
    },
    drive(t, c, out, info) {
      const m = mem(c);
      if (!m.hits) m.hits = new Map();
      const now = info?.time ?? 0;
      const tap = info?.tap;
      if (tap && tap.n !== m.n) {
        m.n = tap.n;
        if (tap.key === "strike" && tap.pick !== null && c.strike > 0)
          m.hits.set(tap.pick, { at: now, sounded: false });
      }
      // How long ago each key started down (the latest press wins).
      const since = TP.keys.map(() => Infinity);
      if (c.play > 0) {
        const e = (1 - c.play) * TP.songLen;
        TP_SONG.forEach((k, j) => {
          const s = e - (TP.songAt + j * TP.step);
          if (k >= 0 && s >= 0 && s < since[k]) since[k] = s;
        });
      }
      for (const [k, h] of m.hits) {
        const s = now - h.at;
        if (s > 1.6 || s < 0) {
          m.hits.delete(k);
          continue;
        }
        if (s < since[k]) since[k] = s;
        if (!h.sounded && s >= TP.hit) {
          h.sounded = true;
          out.cues.push(tpNote(TP.keys[k].note));
        }
      }
      const tokens = [];
      TP.keys.forEach((k, i) => {
        const p = tpPress(since[i]);
        const rod = TP.rods[i];
        tokens[i] = { base: [k.x, TP.fulcrum[0], TP.fulcrum[1]], quat: quatAxisAngle([1, 0, 0], p.key) }; // prettier-ignore
        tokens[18 + i] = { base: [rod.x, TP.hamPivot[0], TP.hamPivot[1]], quat: quatAxisAngle([1, 0, 0], p.ham) }; // prettier-ignore
        if (i < 12)
          tokens[36 + i] = { base: [rod.x, TP.rodBase, TP.rodZ], quat: quatAxisAngle(TP_ROD_AXIS, p.rod) }; // prettier-ignore
        else out.parts[`rod${i}`] = { angle: p.rod };
      });
      out.tokens = tokens;
    },
    build(k, o) {
      const body = o.case;
      const lacquer = (c) => lit(c, body, 0.32, 0.55);
      const inside = (c) => lit(c, wood(c, "#e2c192", c.p, 0, 0.88), 0.25, 0.1);
      const gold = "#e9c35a";
      // Ivory keys, their top edges a touch darker so neighbours stay apart.
      const ivory = (c) => {
        const edge = c.n[1] > 0.9 ? Math.min(c.u, 1 - c.u) * 0.096 : 1;
        return lit(c, edge < 0.005 ? "#d9d2c2" : "#f8f4ea", 0.16, 0.35);
      };
      const ebony = (c) => lit(c, "#1c1b20", 0.5, 0.6);
      // A lacquered panel with a gold pinstripe inset from its edge (only on
      // the face that looks out along `face`).
      const striped =
        (face, w, h, inset = 0.035) =>
        (c) => {
          if (dot(c.n, face) < 0.9) return lacquer(c);
          const du = Math.min(c.u, 1 - c.u) * w;
          const dv = Math.min(c.v, 1 - c.v) * h;
          const d = Math.min(du, dv);
          if (Math.abs(d - inset) < 0.008) return keep(lit(c, gold, 0.2, 0.6));
          return lacquer(c);
        };

      // Plinth, cheeks, the lower front board and the keybed.
      box6(k, [0, 0.025, -0.08], [1.44, 0.05, 0.54], { color: lacquer, flat: 0.15 }, "Y");
      for (const s of [-1, 1]) {
        box6(
          k,
          [s * 0.655, 0.525, -0.09],
          [0.05, 0.95, 0.42],
          {
            flat: 0.15,
            color: (c) => (dot(c.n, [-s, 0, 0]) > 0.9 ? inside(c) : lacquer(c)),
          },
          "Y",
        );
        // The arms beside the keys.
        box6(k, [s * 0.655, 0.265, 0.28], [0.05, 0.43, 0.32], { flat: 0.15, color: lacquer }, "ZY");
      }
      box6(k, [0, 0.19, 0.06], [1.26, 0.3, 0.03], { flat: 0.15, color: striped([0, 0, 1], 1.26, 0.3) }, "xXYZ"); // prettier-ignore
      box6(
        k,
        [0, 0.37, 0.12],
        [1.26, 0.06, 0.64],
        {
          flat: 0.15,
          color: (c) => (c.n[1] > 0.9 ? lit(c, "#4a1418", 0.2) : lacquer(c)),
        },
        "xXYZ",
      );
      // The fallboard over the keys: a gold stripe and a painted star.
      box6(
        k,
        [0, 0.545, 0.09],
        [1.26, 0.09, 0.035],
        {
          flat: 0.15,
          weight: 3,
          color: (c) => {
            if (c.n[2] > 0.9) {
              const x = (c.u - 0.5) * 1.26;
              const y = (c.v - 0.5) * 0.09;
              const a = Math.atan2(y, x);
              const r = Math.hypot(x, y);
              const star = 0.03 * (0.55 + 0.45 * Math.cos(5 * (a - Math.PI / 2)));
              if (r < star + 0.004) return keep(lit(c, gold, 0.2, 0.6));
            }
            if (c.n[2] < -0.9) return inside(c);
            return striped([0, 0, 1], 1.26, 0.09, 0.02)(c);
          },
        },
        "xXY",
      );
      // The lid, raised: hinged at the back of the top, standing up behind.
      const hinge = [0, 1.0, -0.3];
      const lidQ = quatEuler(-145, 0, 0);
      box6(k, vec.add(hinge, quatRotate(lidQ, [0, 0.015, 0.23])), [1.36, 0.03, 0.46], {
        quat: lidQ,
        flat: 0.15,
        color: striped(quatRotate(lidQ, [0, -1, 0]), 1.36, 0.46, 0.04),
      });
      // Where the rods stand, and the rail the hammers turn on.
      box6(
        k,
        [0, 0.47, TP.rodZ],
        [1.26, 0.06, 0.08],
        {
          flat: 0.15,
          color: (c) => lit(c, "#474b52", 0.35, 0.4),
        },
        "xXY",
      );
      box6(k, [0, TP.hamPivot[0] - 0.012, TP.hamPivot[1]], [1.26, 0.024, 0.045], { flat: 0.15, color: inside }, "xXY"); // prettier-ignore

      // The keys: tokens 0-17, each turning about the balance rail.
      TP.keys.forEach((key) => {
        const tok = { kind: "token", params: [key.i, 0], pattern: false, flat: 0.15 };
        if (key.black) {
          box6(k, [key.x, TP.keyTop + 0.022, 0.21], [0.058, 0.05, 0.2], { ...tok, weight: 4, color: ebony }, "Y"); // prettier-ignore
          box6(k, [key.x, TP.keyTop - 0.02, -0.02], [0.028, 0.024, 0.34], { ...tok, color: inside }, "Y"); // prettier-ignore
        } else {
          box6(k, [key.x, TP.keyTop - 0.022, 0.275], [0.096, 0.044, 0.33], { ...tok, weight: 4, color: ivory }, "Y"); // prettier-ignore
          box6(k, [key.x, TP.keyTop - 0.03, -0.02], [0.03, 0.024, 0.26], { ...tok, color: inside }, "Y"); // prettier-ignore
        }
      });
      // The hammers (tokens 18-35) and the rods (tokens 36-47, then parts).
      TP.rods.forEach((rod, i) => {
        const tok = { kind: "token", params: [18 + i, 0], pattern: false };
        const a = [rod.x, TP.hamPivot[0], TP.hamPivot[1]];
        const b = [rod.x, TP.hamHead[0], TP.hamHead[1]];
        k.add(k.tube(line(a, b), 0.009, { grid: 8, samples: 16 }), {
          ...tok,
          flat: 0.3,
          weight: 3,
          size: 1.3,
          opacity: 1,
          color: (c) => lit(c, "#6b3f22", 0.3, 0.2),
        });
        k.add(
          k.param(
            (u, v) => {
              const r = TP.headR;
              const w = 0.044;
              // A felt head: a short cylinder along X with flat ends.
              const ang = TAU * u;
              const q = v * 4;
              const rr = q < 1 ? r * q : q > 3 ? r * (4 - q) : r;
              const xx = q < 1 ? -w / 2 : q > 3 ? w / 2 : -w / 2 + (w * (q - 1)) / 2;
              return [b[0] + xx, b[1] + rr * Math.cos(ang), b[2] + rr * Math.sin(ang)];
            },
            { grid: 32, thick: TP.headR },
          ),
          { ...tok, even: true, opacity: 1, jitter: 0.01, flat: 0.25, weight: 3, color: (c) => lit(c, "#e3a93a", 0.3, 0.15) }, // prettier-ignore
        );
        const base = [rod.x, TP.rodBase, TP.rodZ];
        const rodOpt =
          i < 12
            ? { kind: "token", params: [36 + i, 0] }
            : { part: k.part(`rod${i}`, { pivot: base, axis: TP_ROD_AXIS }) };
        rodShape(k, base, TP.rodR, rod.len, {
          ...rodOpt,
          pattern: false,
          flat: 0.3,
          weight: 3,
          color: steel,
        });
        // The screw that holds it.
        k.add(k.sphere(0.012), {
          pos: [rod.x, TP.rodBase, TP.rodZ + 0.042],
          even: true,
          weight: 3,
          pattern: false,
          color: steel,
        });
      });
      k.reach([0, 1.46, -0.4]);
    },
  },
};
