// Machines that compute (lane Machines A): kit-built models of the machines
// computing grew from, each following its real rules on what you type. The
// Turing machine reads and writes a tape of tiles; the difference engine
// adds columns of numbered wheels; the Enigma machine enciphers a message
// with the historical rotor wirings; the Bombe searches for the Enigma's
// setting. Every tile, wheel, key, rotor and drum is its own solid piece
// (a token or a part). Loaded on demand.

import { mix, shade, clamp } from "../kit.js";
import { evenBox, evenCylinder, evenDisc, evenTube } from "./even.js";
import { FONT } from "../font.js";
import { compile } from "../equation.js";

const TAU = Math.PI * 2;
const add = (a, b) => [a[0] + b[0], a[1] + b[1], a[2] + b[2]];
const mul = (a, s) => [a[0] * s, a[1] * s, a[2] * s];
const dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
const unit = (a) => mul(a, 1 / (Math.hypot(a[0], a[1], a[2]) || 1));
const keep = (c, size) => ({ c, keep: true, size });
const clamp01 = (x) => (x < 0 ? 0 : x > 1 ? 1 : x);
const ease = (x) => {
  const t = clamp01(x);
  return t * t * (3 - 2 * t);
};
// 0 before a, rising to 1 at b.
const band = (x, a, b) => clamp01((x - a) / (b - a));
// Seconds since the tap for a pulse control that lasts `secs` (-1 at rest).
const since = (v, secs) => (v > 0 ? secs * (1 - v) : -1);
const quatX = (a) => [Math.sin(a / 2), 0, 0, Math.cos(a / 2)];
const quatY = (a) => [0, Math.sin(a / 2), 0, Math.cos(a / 2)];
const quatZ = (a) => [0, 0, Math.sin(a / 2), Math.cos(a / 2)];

// ---- Materials -----------------------------------------------------------------------

// A soft key light from above and the front, with a sheen for gloss, baked
// into the colour (splats are unlit).
const LIGHT = unit([0.35, 0.8, 0.55]);
const HALF = unit(add(LIGHT, [0, 0, 1]));
function lit(col, n, { amb = 0.62, dif = 0.45, spec = 0.25, pow = 28 } = {}) {
  const l = Math.max(0, dot(n, LIGHT));
  let c = shade(col, amb + dif * l);
  if (spec > 0) c = mix(c, [1, 1, 1], spec * Math.pow(Math.max(0, dot(n, HALF)), pow));
  return c;
}
const BRASS = "#c9a04a";
const STEEL = "#a3acb6";
const DARK_STEEL = "#59616b";
const WOOD = "#7a4b27";
const DARK_WOOD = "#4a2c16";
const brass = (c) => keep(lit(BRASS, c.n, { amb: 0.6, dif: 0.45, spec: 0.55, pow: 22 }));
const steel = (c) => keep(lit(STEEL, c.n, { amb: 0.62, dif: 0.4, spec: 0.6, pow: 26 }));
const darkSteel = (c) => keep(lit(DARK_STEEL, c.n, { amb: 0.65, dif: 0.4, spec: 0.45 }));
// Wood with a fine, straight grain along x.
function wood(col = WOOD) {
  return (c) => {
    const g = 0.5 + 0.5 * Math.sin(c.p[1] * 90 + c.noise(c.p[0] * 2, c.p[1] * 12, c.p[2] * 12) * 3); // prettier-ignore
    return keep(lit(mix(col, shade(col, 0.8), g * 0.5), c.n, { amb: 0.66, dif: 0.4, spec: 0.12 }));
  };
}
// A solid block, placed evenly (no hatching on its faces).
const block = (k, size, pos, color, opts = {}) =>
  k.add(evenBox(size[0], size[1], size[2]), { pos, even: true, flat: 0.2, pattern: false, color, ...opts }); // prettier-ignore

// ---- Hardware ------------------------------------------------------------------------

// Rotations that turn a shape's +Y (its cap) to face +Z, +X or +Y.
const FACE_ROT = { z: [90, 0, 0], x: [0, 0, -90], y: [0, 0, 0] };
// A slotted screw head facing `face`, its slot across the head.
function screw(k, p, r = 0.012, face = "z", opts = {}) {
  k.add(evenCylinder(r, r * 0.8, r * 0.5, true), {
    pos: p,
    rot: FACE_ROT[face],
    even: true,
    weight: 3,
    flat: 0.3,
    pattern: false,
    ...opts,
    color: (c) => {
      const slot = c.s.cap === "top" && Math.abs(c.lp[0]) < r * 0.16;
      return keep(
        lit(slot ? "#3b3326" : "#b8a26a", c.n, { amb: 0.62, dif: 0.4, spec: 0.6, pow: 20 }),
      );
    },
  });
}
// A spur gear of radius R with `teeth` teeth, thickness t, lying in the XZ
// plane (turned by `rot`): two toothed faces, the rim round the teeth and a
// hub. Its teeth repeat every 1/teeth of a turn, so a part carrying it can
// turn it by its angle modulo that and never stray far from its built pose.
function gear(k, pos, R, teeth, t, color, opts = {}) {
  const depth = R * 0.12;
  const rOf = (a) => R - depth + depth * (Math.cos(a * teeth) > -0.1 ? 1 : 0);
  const face = (sd) =>
    k.param(
      (u, v) => {
        const a = TAU * u;
        const r = rOf(a) * (0.18 + 0.82 * v);
        return [r * Math.cos(a), (sd * t) / 2, r * Math.sin(a)];
      },
      { grid: 96, normal: () => [0, sd, 0] },
    );
  const rim = k.param(
    (u, v) => {
      const a = TAU * u;
      const r = rOf(a);
      return [r * Math.cos(a), (v - 0.5) * t, r * Math.sin(a)];
    },
    { grid: 128, normal: (u) => [Math.cos(TAU * u), 0, Math.sin(TAU * u)] },
  );
  // A turned groove round the face (round, so turning never shows a jump).
  const col = (c) => {
    const rr = Math.hypot(c.lp[0], c.lp[2]);
    const groove = rr > R * 0.55 && rr < R * 0.62;
    return keep(lit(groove ? shade(color, 0.72) : color, c.n, { amb: 0.62, dif: 0.42, spec: 0.5, pow: 22 })); // prettier-ignore
  };
  for (const sh of [face(1), face(-1), rim]) k.add(sh, { pos, even: true, weight: 1.6, flat: 0.25, pattern: false, ...opts, color: col }); // prettier-ignore
  k.add(evenCylinder(R * 0.2, R * 0.2, t * 1.6, true), { pos, rot: opts.rot, even: true, weight: 2, pattern: false, part: opts.part, color: steel }); // prettier-ignore
}

// A box built face by face, so the faces people see get the splats: each
// face takes its own weight (0 leaves it out), keyed front (+z), back, left
// (-x), right, top and bottom. Faces are placed evenly and lie flat, and a
// darker band along each edge keeps the corners crisp.
function panelBox(k, size, pos, color, weights, opts = {}) {
  const [sx, sy, sz] = size;
  const faces = {
    front: { n: [0, 0, 1], u: [1, 0, 0], v: [0, 1, 0], w: sx, h: sy, d: sz / 2 },
    back: { n: [0, 0, -1], u: [-1, 0, 0], v: [0, 1, 0], w: sx, h: sy, d: sz / 2 },
    right: { n: [1, 0, 0], u: [0, 0, -1], v: [0, 1, 0], w: sz, h: sy, d: sx / 2 },
    left: { n: [-1, 0, 0], u: [0, 0, 1], v: [0, 1, 0], w: sz, h: sy, d: sx / 2 },
    top: { n: [0, 1, 0], u: [1, 0, 0], v: [0, 0, -1], w: sx, h: sz, d: sy / 2 },
    bottom: { n: [0, -1, 0], u: [1, 0, 0], v: [0, 0, 1], w: sx, h: sz, d: sy / 2 },
  };
  const edge = opts.edge ?? 0.012;
  for (const [name, f] of Object.entries(faces)) {
    const weight = weights[name] ?? 0;
    if (!weight) continue;
    // One flat face with an even 2D layout (like evenBox's faces).
    const at = (a, b) => ({
      p: [0, 1, 2].map((i) => pos[i] + f.n[i] * f.d + f.u[i] * (a - 0.5) * f.w + f.v[i] * (b - 0.5) * f.h), // prettier-ignore
      n: f.n,
      u: a,
      v: b,
    });
    // Each even point is nudged by about half a splat's spacing, so the
    // exact lattice doesn't show as a fine hatch (docs/PACKS.md 7c).
    const hash = (x, y) => {
      const q = Math.sin(x * 12.9898 + y * 78.233) * 43758.5453;
      return q - Math.floor(q) - 0.5;
    };
    const nudge = opts.nudge ?? 0.003;
    const shape = {
      area: f.w * f.h,
      thick: Math.min(f.w, f.h) * 0.01,
      sample: (rand) => at(rand(), rand()),
      sampleEven: (a, b) =>
        at(clamp01(a + (hash(a, b) * nudge) / f.w), clamp01(b + (hash(b + 0.37, a) * nudge) / f.h)),
    };
    k.add(shape, {
      even: true,
      flat: 0.12,
      weight,
      size: 1.2,
      pattern: false,
      color: (c) => {
        const out = color(c, name);
        const e = Math.min(f.w / 2 - Math.abs((c.u - 0.5) * f.w), f.h / 2 - Math.abs((c.v - 0.5) * f.h)); // prettier-ignore
        if (!out || e > edge) return out;
        return out.keep ? keep(shade(out.c, 0.8)) : shade(out, 0.8);
      },
    });
  }
}
// Smooth wood: broad, soft grain bands along x (no fine noise, which reads
// as blur at phone size).
function cleanWood(col = WOOD, scale = 1) {
  return (c) => {
    const g =
      0.5 + 0.5 * Math.sin((c.p[1] * 22 + c.p[2] * 9) * scale + Math.sin(c.p[0] * 3.1) * 1.4);
    return keep(lit(mix(col, shade(col, 0.86), g), c.n, { amb: 0.66, dif: 0.4, spec: 0.14 }));
  };
}

// ---- Pixel-font text -----------------------------------------------------------------

const GLYPHS = {
  ...FONT,
  "→": "00000 00100 00010 11111 00010 00100 00000",
  "←": "00000 00100 01000 11111 01000 00100 00000",
  "·": "00000 00000 00000 01100 01100 00000 00000",
  "²": "01100 10010 00100 01000 11110 00000 00000",
  Δ: "00100 00100 01110 01110 11111 11111 00000",
  "(": "00010 00100 01000 01000 01000 00100 00010",
  ")": "01000 00100 00010 00010 00010 00100 01000",
  "/": "00001 00010 00010 00100 01000 01000 10000",
  "³": "11100 00010 01100 00010 11100 00000 00000",
  "+": "00000 00100 00100 11111 00100 00100 00000",
  "=": "00000 00000 11111 00000 11111 00000 00000",
  " ": "00000 00000 00000 00000 00000 00000 00000",
};
const BITS = Object.fromEntries(
  Object.entries(GLYPHS).map(([ch, rows]) => [ch, rows.split(" ").map((r) => parseInt(r, 2))]),
);
const textWidth = (str) => [...str].length * 6 - 1;

// A line of text facing +Z, centred on its origin, `px` the size of one
// font pixel. Its splats go only where the letters' ink is (one square per
// font pixel, sampled evenly), so letters read solid at phone size.
function inkShape(str, px) {
  const chars = [...str];
  const cols = textWidth(str);
  const cells = [];
  chars.forEach((ch, i) => {
    const g = BITS[ch] || BITS[" "];
    for (let gy = 0; gy < 7; gy++)
      for (let gx = 0; gx < 5; gx++) if ((g[gy] >> (4 - gx)) & 1) cells.push([i * 6 + gx, gy]);
  });
  const N = Math.max(1, cells.length);
  const at = (i, fu, fv) => {
    const [gx, gy] = cells[Math.min(N - 1, i)] || [0, 0];
    return {
      p: [(gx + fu - cols / 2) * px, (3.5 - gy - fv) * px, 0],
      n: [0, 0, 1],
      u: (gx + fu) / cols,
      v: (gy + fv) / 7,
    };
  };
  return {
    area: Math.max(1, cells.length) * px * px,
    thick: px,
    sample: (rand) => at(Math.floor(rand() * N), rand(), rand()),
    sampleEven: (a, b) => {
      const i = Math.floor(a * N);
      return at(i, b, a * N - i);
    },
  };
}
// Text centred on `at` (or left- or right-aligned), facing +Z unless `rot`.
function text(k, str, at, px, color, { weight = 8, align = "center", ...rest } = {}) {
  if (!str.trim()) return;
  const W = textWidth(str) * px;
  const x = align === "left" ? at[0] + W / 2 : align === "right" ? at[0] - W / 2 : at[0];
  k.add(inkShape(str, px), {
    pos: [x, at[1], at[2]],
    weight,
    size: Math.sqrt(weight / 4),
    even: true,
    flat: 0.2,
    pattern: false,
    ...rest,
    color: () => keep(color),
  });
}

// ---- Seven-segment digits (tokens) ---------------------------------------------------

const SEGS = [
  [0, 2, 1, 2],
  [1, 2, 1, 1],
  [1, 1, 1, 0],
  [0, 0, 1, 0],
  [0, 1, 0, 0],
  [0, 2, 0, 1],
  [0, 1, 1, 1],
];
const DIGIT_SEGS = ["abcdef", "bc", "abdeg", "abcdg", "bcfg", "acdfg", "acdefg", "abc", "abcdefg", "abcdfg"]; // prettier-ignore
// A seven-segment digit of height h at p, each segment on its own token
// (token .. token + 6), shown only when lit.
function sevenSeg(k, p, h, token, on) {
  const w = h * 0.5;
  const th = h * 0.11;
  SEGS.forEach(([x0, y0, x1, y1], i) => {
    const a = [p[0] + (x0 - 0.5) * w, p[1] + (y0 - 1) * (h / 2)];
    const b = [p[0] + (x1 - 0.5) * w, p[1] + (y1 - 1) * (h / 2)];
    const horiz = y0 === y1;
    const L = Math.hypot(b[0] - a[0], b[1] - a[1]) - th * 0.8;
    k.add(evenBox(horiz ? L : th, horiz ? th : L, th * 0.5), {
      pos: [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2, p[2]],
      even: true,
      flat: 0.2,
      weight: 3,
      pattern: false,
      kind: "token",
      params: [token + i, 0],
      color: () => keep(mix(on, "#ffffff", 0.2)),
    });
  });
}
function showDigit(tokens, token, d) {
  const on = d >= 0 ? DIGIT_SEGS[d] : "";
  for (let i = 0; i < 7; i++) tokens[token + i] = { visible: on.includes("abcdefg"[i]) ? 1 : 0 };
}

// Plays each cue once as the clock `s` passes its time (a list of
// [time, spec]); `m` remembers the last clock between frames.
function cuesAt(m, slot, s, list, out) {
  const was = m[slot] ?? -1;
  m[slot] = s;
  if (s < 0 || s < was) return;
  for (const [at, spec] of list) if (at > was && at <= s) out.cues.push(spec);
}

// ---- The Turing machine --------------------------------------------------------------

// Rule tables: rules[state][read] = [write, move (-1 left, 1 right, 0 stay),
// next state]. "H" is halt. The busy beavers are the classic champions: the
// two-state machine writes four 1s in 6 steps, the three-state one six 1s
// in 13 steps, the most any machine of their size can write and still halt.
const TM_PROGRAMS = {
  add: {
    label: "Add one",
    title: "ADD ONE",
    blank: false,
    rules: { A: [[1, 0, "H"], [0, -1, "A"]] }, // prettier-ignore
  },
  bb2: {
    label: "Busy beaver, 2 states",
    title: "BUSY BEAVER 2",
    blank: true,
    rules: { A: [[1, 1, "B"], [1, -1, "B"]], B: [[1, -1, "A"], [1, 1, "H"]] }, // prettier-ignore
  },
  bb3: {
    label: "Busy beaver, 3 states",
    title: "BUSY BEAVER 3",
    blank: true,
    rules: {
      A: [[1, 1, "B"], [1, -1, "C"]],
      B: [[1, -1, "A"], [1, 1, "B"]],
      C: [[1, -1, "B"], [1, 0, "H"]],
    }, // prettier-ignore
  },
};
const TM_STATES = ["A", "B", "C", "H"];
const TM_LAMP = { A: "#ffc24a", B: "#46d6c8", C: "#b98cff", H: "#ff5a48" };
const TM_MAX_DIGITS = 12;

// The tape of bits for a typed binary number: its last digit at cell 0,
// the rest to the left.
function tmTape(bits) {
  const tape = {};
  const s = String(bits || "");
  for (let i = 0; i < s.length; i++) tape[i - (s.length - 1)] = s[i] === "1" ? 1 : 0;
  return tape;
}
// The rows of a program's rule card, in order: [state, read, write, move, next].
function tmRows(prog) {
  const rows = [];
  for (const st of Object.keys(prog.rules))
    prog.rules[st].forEach(([w, m, nx], r) => rows.push([st, r, w, m, nx]));
  return rows;
}
// Runs a program from `tape` with the head at cell 0 in state A. Returns
// the steps ({ cell, state, read, write, move, next, row, before }, where
// `before` is the tape before the step) and the final tape.
function tmRun(prog, tape, maxSteps = 60) {
  const rows = tmRows(prog);
  const t = { ...tape };
  const steps = [];
  let state = "A";
  let cell = 0;
  while (state !== "H" && steps.length < maxSteps) {
    const read = t[cell] || 0;
    const [write, move, next] = prog.rules[state][read];
    const row = rows.findIndex((r) => r[0] === state && r[1] === read);
    steps.push({ cell, state, read, write, move, next, row, before: { ...t } });
    t[cell] = write;
    cell += move;
    state = next;
  }
  return { steps, tape: t, halted: state === "H", end: cell };
}
// Reads what someone types: a binary number, or a whole number that is
// turned into binary.
function tmReadBits(text) {
  const raw = String(text ?? "").replace(/[\s_,]/g, "");
  if (!raw) throw new Error("Type a binary number, like 1011.");
  if (/^[01]+$/.test(raw)) {
    if (raw.length > TM_MAX_DIGITS)
      throw new Error(`That has ${raw.length} digits; the tape takes up to ${TM_MAX_DIGITS}.`);
    return raw;
  }
  if (/^\d+$/.test(raw)) {
    const n = Number(raw);
    if (n > 2 ** TM_MAX_DIGITS - 1)
      throw new Error(`That is too big: up to ${2 ** TM_MAX_DIGITS - 1} (${TM_MAX_DIGITS} binary digits).`); // prettier-ignore
    return n.toString(2);
  }
  throw new Error("Use only the digits 0 and 1 (or a whole number, which becomes binary).");
}
const TM_SHOWN = { label: "1011 (eleven)" };

// The tape's layout: tile slots from cell -10 to +6 around the head (17
// slots, two tokens each: the tile showing 0 and the tile showing 1). Cells
// -9 to +5 show; the end ones are inside the reel housings, where a tile
// leaving one end wraps round to come in at the other.
const TM = { pitch: 0.16, w: 0.142, h: 0.2, d: 0.04, lo: -10, slots: 17, E: 10 };
TM.x = (off) => off * TM.pitch;
const TM_ZERO = { face: "#efe6cf", ink: "#1f1c18" };
const TM_ONE = { face: "#221f1c", ink: "#f2c14e" };

// The timeline of a run: steps of dt seconds (a step: the feeler reads,
// the tile flips, the tape slides), the bell, a pause, and the rewind.
function tmTimes(run) {
  const n = run.steps.length;
  const dt = Math.min(0.72, 7.2 / Math.max(1, n));
  const t0 = 0.15;
  const end = t0 + n * dt;
  return { n, dt, t0, end, bell: end + 0.05, rewind: end + 1.25, done: end + 2.15 };
}

// Where each part of the machine is at clock s (seconds since the tap) of
// a run (null at rest): the tape position, each cell's bit and flip angle,
// the lit row, the state, the feeler and the step count.
function tmPose(data, s) {
  const rest = { P: 0, bits: data.tape, flip: null, row: -1, state: "A", pin: 0, bell: 0, count: 0 }; // prettier-ignore
  const run = data.run;
  if (!run || s < 0) return rest;
  const T = tmTimes(run);
  if (s >= T.done) return rest;
  const { steps } = run;
  if (s < T.end) {
    const i = Math.max(0, Math.min(T.n - 1, Math.floor((s - T.t0) / T.dt)));
    const f = s < T.t0 ? 0 : clamp01((s - T.t0) / T.dt - i);
    const st = steps[i];
    const slide = ease(band(f, 0.62, 0.98));
    const flipping = st.write !== st.read;
    return {
      P: st.cell + st.move * slide,
      bits: st.before,
      flip: flipping ? { cell: st.cell, from: st.read, a: ease(band(f, 0.3, 0.6)) } : null,
      row: s < T.t0 ? -1 : st.row,
      state: f < 0.62 ? st.state : st.next,
      pin: Math.sin(Math.PI * band(f, 0.02, 0.3)),
      bell: 0,
      count: i + (f >= 0.62 ? 1 : 0),
    };
  }
  // Halted: the bell rings, the machine holds its answer, then the tape
  // rewinds to the start (a busy beaver's tape is wiped as it goes).
  const back = ease(band(s, T.rewind, T.done - 0.1));
  const wipe = data.prog.blank ? back : 0;
  return {
    P: run.end * (1 - back),
    bits: run.tape,
    wipe,
    row: s < T.rewind ? steps[T.n - 1].row : -1,
    state: back > 0.5 ? "A" : "H",
    pin: 0,
    bell: Math.sin(Math.PI * band(s, T.bell, T.bell + 0.25)),
    count: back > 0.5 ? 0 : T.n,
  };
}

const TM_OPTIONS = [
  {
    key: "program",
    label: "Program",
    type: "select",
    default: "add",
    choices: Object.entries(TM_PROGRAMS).map(([id, p]) => ({ id, label: p.label })),
  },
  // Your binary number, as typed (set from the panel, not shown).
  { key: "bits", label: "Your number", type: "text", default: "1011", hidden: true },
];

function buildTuring(k, o) {
  const prog = TM_PROGRAMS[o.program] || TM_PROGRAMS.add;
  const bits = (() => {
    try {
      return tmReadBits(o.bits || "1011");
    } catch {
      return "1011";
    }
  })();
  TM_SHOWN.label = `${bits} (${parseInt(bits, 2)})`;
  const rows = tmRows(prog);
  k.data = { prog, rows, tape: prog.blank ? {} : tmTape(bits), start: prog.blank ? {} : tmTape(bits), run: null, m: {} }; // prettier-ignore
  const { pitch, w, h, d } = TM;

  // The bench: a wooden plinth, a dark back panel and a steel axle the
  // tiles turn on.
  const x0 = TM.x(-11.2);
  const x1 = TM.x(7.9);
  block(k, [x1 - x0, 0.12, 0.5], [(x0 + x1) / 2, -0.24, 0], wood());
  block(k, [x1 - x0 - 0.1, 0.34, 0.05], [(x0 + x1) / 2, 0.0, -0.12], wood(DARK_WOOD));
  // A brass strip along the plinth's front, and four turned feet.
  block(k, [x1 - x0, 0.022, 0.008], [(x0 + x1) / 2, -0.2, 0.254], brass, { weight: 1.2 });
  for (const fx of [x0 + 0.12, x1 - 0.12])
    for (const fz of [-0.17, 0.17])
      k.add(evenCylinder(0.035, 0.028, 0.05, true), { pos: [fx, -0.325, fz], even: true, weight: 1.5, pattern: false, color: wood(DARK_WOOD) }); // prettier-ignore
  k.add(evenCylinder(0.012, 0.012, TM.x(16.5), true), {
    pos: [TM.x(-2), 0, -0.035],
    rot: [0, 0, 90],
    even: true,
    flat: 0.3,
    weight: 1.5,
    pattern: false,
    color: steel,
  });
  // The tiles: each slot a tile showing 0 and one showing 1 (tokens 2j and
  // 2j + 1), one of them shown. A flip turns the shown tile edge-on, then
  // the other comes round from edge-on, so no tile turns past a quarter
  // turn (splats sort in their built pose).
  for (let j = 0; j < TM.slots; j++) {
    const x = TM.x(TM.lo + j);
    [TM_ZERO, TM_ONE].forEach((look, b) => {
      const tok = { kind: "token", params: [2 * j + b, 0] };
      block(
        k,
        [w, h, d],
        [x, 0, 0],
        (c) => {
          const edge = Math.min(w / 2 - Math.abs(c.p[0] - x), h / 2 - Math.abs(c.p[1]));
          const col = c.s.face === 4 || c.s.face === 5 ? look.face : shade(look.face, 0.85);
          return keep(lit(edge < 0.008 ? shade(col, 0.9) : col, c.n, { amb: 0.7, dif: 0.35, spec: 0.3 })); // prettier-ignore
        },
        { weight: 1.3, ...tok },
      );
      text(k, String(b), [x, 0, d / 2 + 0.012], 0.019, look.ink, { weight: 10, ...tok });
    });
  }
  // The reel housings at each end, with a reel on the front that turns as
  // the tape runs (parts).
  const housings = [
    [TM.x(-10.5) - 0.2, "reelL"],
    [TM.x(6.5) + 0.2, "reelR"],
  ];
  const hw = 0.4 + 0.04;
  for (const [hx, name] of housings) {
    block(k, [hw, 0.4, 0.24], [hx, 0, 0], (c) => keep(lit(c.s.face === 2 ? "#3a4048" : "#2c3138", c.n, { amb: 0.72, dif: 0.35, spec: 0.3 }))); // prettier-ignore
    for (const sx of [-1, 1]) for (const sy of [-1, 1]) screw(k, [hx + sx * 0.18, sy * 0.16, 0.122], 0.011); // prettier-ignore
    const reel = k.part(name, { pivot: [hx, 0, 0.13], axis: [0, 0, 1] });
    k.add(evenDisc(k, 0.15, 0.025, 64), {
      pos: [hx, 0, 0.125],
      rot: [90, 0, 0],
      even: true,
      flat: 0.2,
      weight: 1.8,
      part: reel,
      pattern: false,
      color: (c) => {
        const a = Math.atan2(c.p[1], c.p[0] - hx);
        const r = Math.hypot(c.p[1], c.p[0] - hx);
        const spoke = Math.abs((((a / TAU) * 3 + 10) % 1) - 0.5) > 0.36 && r < 0.12 && r > 0.05;
        if (spoke) return null;
        return keep(lit(r > 0.13 ? shade(BRASS, 0.8) : BRASS, [0, 0, 1], { amb: 0.7, dif: 0.35, spec: 0.5 })); // prettier-ignore
      },
    });
    k.add(evenCylinder(0.025, 0.025, 0.03, true), {
      pos: [hx, 0, 0.14],
      rot: [90, 0, 0],
      even: true,
      weight: 2,
      part: reel,
      pattern: false,
      color: steel,
    });
  }
  // The read-write head: a steel window round the tile under it, a brass
  // block with the feeler (a part that comes down to read), and the state
  // lamp on top: one lit dome per state, with its letter (parts).
  const fw = w + 0.05;
  const fh = h + 0.06;
  for (const [sx, sy, px, py] of [
    [fw + 0.03, 0.025, 0, fh / 2],
    [fw + 0.03, 0.025, 0, -fh / 2],
    [0.025, fh, fw / 2, 0],
    [0.025, fh, -fw / 2, 0],
  ])
    block(k, [sx, sy, 0.03], [px, py, 0.13], steel, { weight: 2 });
  for (const sd of [-1, 1]) block(k, [0.025, 0.03, 0.14], [sd * (fw / 2), fh / 2, 0.06], darkSteel, { weight: 2 }); // prettier-ignore
  block(k, [0.24, 0.14, 0.18], [0, fh / 2 + 0.085, 0.01], brass, { weight: 1.5 });
  for (const sx of [-1, 1]) screw(k, [sx * 0.09, fh / 2 + 0.085, 0.102], 0.01);
  const pin = k.part("pin", { pivot: [0, 0.2, 0] });
  k.add(evenCylinder(0.009, 0.009, 0.07, true), { pos: [0, h / 2 + 0.05, 0], even: true, weight: 3, part: pin, pattern: false, color: steel }); // prettier-ignore
  const lampY = fh / 2 + 0.26;
  k.add(evenCylinder(0.07, 0.07, 0.04, true), { pos: [0, lampY - 0.07, 0.01], even: true, weight: 1.5, pattern: false, color: brass }); // prettier-ignore
  for (const st of TM_STATES) {
    const part = k.part("lamp" + st, { pivot: [0, lampY, 0.01] });
    k.add(k.sphere(0.09), {
      pos: [0, lampY, 0.01],
      scale: [1, 0.85, 1],
      even: true,
      flat: 0.3,
      weight: 1.6,
      part,
      pattern: false,
      color: (c) => keep(mix(TM_LAMP[st], "#ffffff", 0.45 * Math.max(0, c.n[1] + c.n[2]) ** 2 / 2)), // prettier-ignore
    });
    text(k, st, [0, lampY, 0.115], 0.017, "#1a1410", { weight: 12, part });
  }
  text(k, "STATE", [0, lampY + 0.14, 0.02], 0.011, "#e8d9b0", { weight: 6 });
  // The bell on the right housing, and its hammer (a part).
  const bx = housings[1][0];
  const bellAt = [bx, 0.27, 0];
  k.add(k.lathe([[0.001, 0.09], [0.03, 0.088], [0.055, 0.06], [0.07, 0.02], [0.085, 0]], { grid: 40 }), {
    pos: [bellAt[0], 0.2, 0],
    even: true,
    weight: 2,
    pattern: false,
    color: (c) => keep(lit("#d8b24e", c.n, { amb: 0.6, dif: 0.45, spec: 0.7, pow: 18 })),
  }); // prettier-ignore
  const hammer = k.part("hammer", { pivot: [bx + 0.16, 0.2, 0], axis: [0, 0, 1] });
  k.add(evenCylinder(0.008, 0.008, 0.13, true), { pos: [bx + 0.16, 0.265, 0], even: true, weight: 3, part: hammer, pattern: false, color: darkSteel }); // prettier-ignore
  k.add(k.sphere(0.022), { pos: [bx + 0.16, 0.33, 0], even: true, weight: 3, part: hammer, pattern: false, color: darkSteel }); // prettier-ignore

  // The rule card on its stand behind the tape: the program's name, the
  // step counter, and the rule table with a lit bar for the row in use
  // (parts).
  const cw = 1.9;
  const cx = TM.x(-3.2);
  const rowH = 0.175;
  const ch = 0.52 + rows.length * rowH;
  const ctop = 0.84 + ch;
  const cy = ctop - ch / 2;
  for (const sx of [cx - cw / 2 + 0.2, cx + cw / 2 - 0.2])
    k.add(evenCylinder(0.02, 0.02, ctop - ch + 0.25, true), { pos: [sx, (ctop - ch + 0.25) / 2 - 0.15, -0.2], even: true, weight: 1.5, pattern: false, color: brass }); // prettier-ignore
  block(k, [cw + 0.06, ch + 0.06, 0.03], [cx, cy, -0.22], wood(DARK_WOOD));
  block(k, [cw, ch, 0.01], [cx, cy, -0.2], (c) => keep(lit("#efe3c3", c.n, { amb: 0.8, dif: 0.25, spec: 0 }))); // prettier-ignore
  for (const sx of [-1, 1]) for (const sy of [-1, 1]) screw(k, [cx + sx * (cw / 2 - 0.035), cy + sy * (ch / 2 - 0.035), -0.19], 0.012); // prettier-ignore
  const ink = "#2b241c";
  text(k, prog.title, [cx - cw / 2 + 0.08, ctop - 0.11, -0.17], 0.0155, "#7a2a1a", { align: "left", weight: 10 }); // prettier-ignore
  text(k, "STEP", [cx + cw / 2 - 0.42, ctop - 0.11, -0.17], 0.012, ink, { weight: 8 });
  const cols = [0.14, 0.44, 0.68, 0.92, 1.2, 1.5].map((f) => cx - cw / 2 + f * (cw / 1.72));
  const heads = ["STATE", "READ", "", "WRITE", "MOVE", "NEXT"];
  const hy = ctop - 0.3;
  heads.forEach((s, i) => text(k, s, [cols[i], hy, -0.17], 0.0105, "#6b5d48", { weight: 7 }));
  rows.forEach(([st, r, wr, mv, nx], i) => {
    const y = hy - 0.19 - i * rowH;
    // A ruled line under each row.
    block(k, [cw - 0.12, 0.004, 0.004], [cx, y - rowH / 2, -0.192], () => keep("#b9a98a"), { weight: 1.5 }); // prettier-ignore
    const part = k.part("row" + i, { pivot: [cx, y, -0.19] });
    block(k, [cw - 0.08, rowH * 0.86, 0.006], [cx, y, -0.19], () => keep("#ffd46a"), { part, weight: 1.2 }); // prettier-ignore
    const cells = [st, String(r), "→", String(wr), mv < 0 ? "L" : mv > 0 ? "R" : "-", nx === "H" ? "HALT" : nx]; // prettier-ignore
    cells.forEach((s, j) => text(k, s, [cols[j], y, -0.17], j === 5 && nx === "H" ? 0.015 : 0.019, j === 0 || j === 5 ? "#7a2a1a" : ink, { weight: 10 })); // prettier-ignore
  });
  sevenSeg(k, [cx + cw / 2 - 0.24, ctop - 0.11, -0.18], 0.12, 34, "#b0301c");
  sevenSeg(k, [cx + cw / 2 - 0.13, ctop - 0.11, -0.18], 0.12, 41, "#b0301c");
}

function driveTuring(t, c, out, info) {
  const data = info?.data;
  if (!data) return;
  const E = TM.E;
  const s = since(c.go, E);
  const m = data.m;
  // A new tap starts a run from the tape as it rests; a tap during a run
  // finishes the old one first.
  if (s >= 0 && (m.lastS === undefined || m.lastS < 0 || s < m.lastS)) {
    if (data.run && m.lastS >= 0) tmCommit(data);
    const from = data.prog.blank ? {} : data.tape;
    data.run = tmRun(data.prog, from);
  }
  if (s >= 0 && data.run && s >= tmTimes(data.run).done) tmCommit(data);
  if (s < 0 && data.run) tmCommit(data);
  m.lastS = s;
  const pose = tmPose(data, data.run ? s : -1);
  // The tiles: each slot shows the cell that is in its stretch of the tape.
  out.tokens = [];
  for (let j = 0; j < TM.slots; j++) {
    const off = TM.lo + j;
    const kk = Math.ceil((pose.P - 10.5 - off) / TM.slots);
    const cell = off + TM.slots * kk;
    const dx = TM.x(cell - pose.P) - TM.x(off);
    let bit = pose.bits[cell] || 0;
    let angle = 0;
    if (pose.flip && pose.flip.cell === cell) {
      // Turns the shown face edge-on, then brings the new face round.
      const a = pose.flip.a;
      bit = a < 0.5 ? pose.flip.from : 1 - pose.flip.from;
      angle = a < 0.5 ? Math.PI * a : Math.PI * (a - 1);
    }
    if (pose.wipe > 0 && bit === 1) {
      // Wiping: tiles turn back to 0 one after another as the tape rewinds.
      const order = clamp01((cell + 4) / 10);
      const a = ease(band(pose.wipe, order * 0.6, order * 0.6 + 0.35));
      if (a >= 0.5) bit = 0;
      angle = a <= 0 || a >= 1 ? 0 : a < 0.5 ? Math.PI * a : Math.PI * (a - 1);
    }
    const q = quatX(-angle);
    const base = [TM.x(off), 0, 0];
    out.tokens[2 * j] = { base, offset: [dx, 0, 0], quat: q, visible: bit ? 0 : 1 };
    out.tokens[2 * j + 1] = { base, offset: [dx, 0, 0], quat: q, visible: bit ? 1 : 0 };
  }
  showDigit(out.tokens, 34, Math.floor(pose.count / 10) || -1);
  showDigit(out.tokens, 41, pose.count % 10);
  data.rows.forEach((_, i) => (out.parts["row" + i] = { visible: i === pose.row ? 1 : 0 }));
  for (const st of TM_STATES) out.parts["lamp" + st] = { visible: st === pose.state ? 1 : 0 };
  out.parts.pin = { offset: [0, -0.022 * pose.pin, 0] };
  out.parts.hammer = { angle: 0.7 * pose.bell };
  const turn = (-pose.P * TM.pitch) / 0.12;
  out.parts.reelL = { angle: turn };
  out.parts.reelR = { angle: turn };
  // Tiles that slide are sorted again where they stand every half tile, so
  // a tile that wrapped round inside a housing draws in its new place.
  const key = Math.round(pose.P * 2);
  out.resort = m.sortKey !== undefined && key !== m.sortKey;
  m.sortKey = key;
  // Sounds that follow the program: a relay click as the feeler reads, a
  // wooden clack as a tile flips, a short whir as the tape slides, and the
  // bell at the halt.
  if (data.run && s >= 0) {
    if (!m.cues || m.cuesFor !== data.run) {
      const T = tmTimes(data.run);
      const list = [];
      data.run.steps.forEach((st, i) => {
        const a = T.t0 + i * T.dt;
        list.push([a + 0.05 * T.dt, { voice: "click", f: 2400, decay: 0.5, vol: 0.5 }]);
        if (st.write !== st.read) list.push([a + 0.6 * T.dt, { voice: "wood", f: st.write ? 700 : 560, decay: 0.5, vol: 0.8 }]); // prettier-ignore
        if (st.move) list.push([a + 0.64 * T.dt, { voice: "whoosh", f: 700, decay: 0.22, vol: 0.25 }]); // prettier-ignore
      });
      list.push([T.bell, { voice: "bell", f: "E6", decay: 1.4, vol: 0.8 }]);
      list.push([T.rewind, { voice: "whoosh", f: 400, to: 1.6, decay: 0.7, vol: 0.3 }]);
      m.cues = list;
      m.cuesFor = data.run;
    }
    cuesAt(m, "cue", s, m.cues, out);
  } else m.cue = -1;
}
// Ends a run: the answer stays on the tape (Add one counts up from there on
// the next tap); a busy beaver's tape is wiped.
function tmCommit(data) {
  if (!data.run) return;
  data.tape = data.prog.blank ? {} : data.run.tape;
  data.run = null;
}

// ---- The difference engine -----------------------------------------------------------

// Columns of figure wheels on upright shafts, units at the bottom as in
// Babbage's Difference Engine No. 2: the x counter (two wheels), the value
// p(x) and the differences Δ1, Δ2 and Δ3 (five wheels each, so values
// count modulo 100,000; a negative one shows as its ten's complement, as in
// Babbage's design). A turn of the crank adds in two phases: first Δ1 into
// the value and Δ3 into Δ2, then Δ2 into Δ1. Like the real engine, the
// columns are set up a half step apart for this (Δ2 holds the second
// difference less the third), so every turn gives the next p(x) exactly.
const DE = { digits: 5, mod: 100000, turn: 4, E: 12, r: 0.13, wh: 0.1, gap: 0.03 };
DE.cols = [
  { id: "x", label: "X", digits: 2, x: -0.98 },
  { id: "v", label: "P(X)", digits: 5, x: -0.5 },
  { id: "d1", label: "Δ1", digits: 5, x: -0.08 },
  { id: "d2", label: "Δ2", digits: 5, x: 0.34 },
  { id: "d3", label: "Δ3", digits: 5, x: 0.76 },
];
DE.pitch = DE.wh + DE.gap;
// Tokens: the wheels (column by column, units first), then the carry
// levers of the three columns that take carries (four each).
{
  let t = 0;
  for (const c of DE.cols) {
    c.token = t;
    t += c.digits;
  }
  DE.leverToken = t;
}
DE.carryCols = ["v", "d1", "d2"];
const DE_EQ_DEFAULT = "x^2";
const DE_SHOWN = { label: "p(x) = x², from x = 1" };

// Reads a polynomial of x (or n) up to x³ with the safe equation reader,
// and checks it gives whole numbers and is of degree 3 at most.
function deRead(text, start = 1) {
  const src = String(text ?? "")
    .trim()
    .replace(/^(p\(x\)|y|f\(x\)|p\(n\)|f\(n\))\s*=/i, "")
    .replace(/(^|[^a-z])n(?![a-z])/gi, "$1x");
  if (!src.trim()) throw new Error("Type a polynomial, like x² or 2x³ − x + 5.");
  const c = compile(src, ["x"]);
  const f = (x) => c.f({ x, a: 1, b: 1 });
  const vals = [];
  for (let i = 0; i < 8; i++) {
    const v = f(start + i);
    if (!Number.isFinite(v)) throw new Error("It has no value at some whole numbers.");
    if (Math.abs(v - Math.round(v)) > 1e-6)
      throw new Error("It gives fractions: the engine only adds whole numbers. Use whole-number coefficients."); // prettier-ignore
    vals.push(Math.round(v));
  }
  // The fourth differences of a polynomial of degree 3 or less are 0.
  let d = vals.slice();
  for (let k = 0; k < 4; k++) d = d.slice(1).map((v, i) => v - d[i]);
  if (d.some((v) => v !== 0))
    throw new Error("The engine takes polynomials up to x³ (like x³ − 2x + 1).");
  return { f, vals };
}
const deMod = (v) => ((v % DE.mod) + DE.mod) % DE.mod;
// The starting columns for p and the start value.
function deSetup(f, start) {
  const v = [0, 1, 2, 3].map((i) => Math.round(f(start + i)));
  const d1 = v[1] - v[0];
  const d2 = v[2] - 2 * v[1] + v[0];
  const d3 = v[3] - 3 * v[2] + 3 * v[1] - v[0];
  return { x: start, v: v[0], d1, d2: d2 - d3, d3 };
}
const deDigits = (value, n) => Array.from({ length: n }, (_, j) => Math.floor(deMod(value) / 10 ** j) % 10); // prettier-ignore

// One addition of `src` into `dst` (five wheels): each wheel of dst turns
// on by its digit of src (all at once, one step every ADD/9 seconds); a wheel
// passing 9 to 0 sets its carry lever, and the carries then run up the
// column one wheel at a time. Returns the wheels' moves over time.
const DE_ADD = 0.8;
const DE_CARRY = 0.12;
function deAdd(dst, src) {
  const t = deDigits(dst, DE.digits);
  const s = deDigits(src, DE.digits);
  const warn = t.map((d, j) => d + s[j] >= 10);
  const after = t.map((d, j) => (d + s[j]) % 10);
  const carries = []; // [wheel that steps, order]
  const carried = after.slice();
  const pending = warn.slice();
  for (let j = 0; j < DE.digits - 1; j++) {
    if (!pending[j]) continue;
    carried[j + 1] = (carried[j + 1] + 1) % 10;
    if (carried[j + 1] === 0) pending[j + 1] = true;
    carries.push(j + 1);
  }
  return { from: t, steps: s, warn, pending, carries, result: deMod(dst + src) };
}
// A turn from state st: the two phases and the new state.
function deTurn(st) {
  const a1 = deAdd(st.v, st.d1);
  const a2 = deAdd(st.d2, st.d3);
  const mid = { ...st, v: a1.result, d2: a2.result };
  const b1 = deAdd(mid.d1, mid.d2);
  const next = { x: st.x + 1, v: a1.result, d1: b1.result, d2: a2.result, d3: st.d3 };
  return { st, phases: [{ at: 0.35, adds: { v: a1, d2: a2 } }, { at: 1.95, adds: { d1: b1 } }], next }; // prettier-ignore
}
// Where every wheel stands (in digit steps, a float) and every lever, at
// time s of a turn.
function dePose(turn, s) {
  const wheels = {};
  const levers = {};
  for (const c of DE.cols) wheels[c.id] = deDigits(turn.st[c.id], c.digits);
  for (const id of DE.carryCols) levers[id] = [0, 0, 0, 0];
  for (const ph of turn.phases) {
    for (const [id, a] of Object.entries(ph.adds)) {
      const w = wheels[id];
      // Adding: each wheel turns on by its digit of the source.
      const u = clamp01((s - ph.at) / DE_ADD) * 9;
      for (let j = 0; j < DE.digits; j++) w[j] = a.from[j] + Math.min(a.steps[j], u);
      // Warning: a lever sets as its wheel passes 9 to 0 ...
      const c0 = ph.at + DE_ADD + 0.08;
      for (let j = 0; j < DE.digits - 1; j++) {
        const setAt = ph.at + (DE_ADD * Math.max(0.5, 10 - a.from[j])) / 9;
        let lv = a.warn[j] ? band(s, setAt, setAt + 0.08) : 0;
        levers[id][j] = Math.max(levers[id][j], lv);
      }
      // ... and the carries run up: each steps the wheel above on by one
      // and knocks its lever back.
      a.carries.forEach((wheel, i) => {
        const at = c0 + i * DE_CARRY;
        const f = ease(band(s, at, at + DE_CARRY * 0.8));
        w[wheel] += f;
        levers[id][wheel - 1] = Math.max(0, levers[id][wheel - 1] * (1 - f));
        // A carry into a wheel that passes 9 sets that wheel's lever too.
        if (wheel < DE.digits - 1 && a.pending[wheel] && !a.warn[wheel]) levers[id][wheel] = Math.max(levers[id][wheel], band(s, at + 0.05, at + 0.1)); // prettier-ignore
      });
    }
  }
  // The x counter moves on one at the end of the turn.
  const xs = ease(band(s, 3.3, 3.6));
  const x0 = deDigits(turn.st.x, 2);
  const x1 = deDigits(turn.next.x, 2);
  wheels.x = x0.map((d, j) => d + ((x1[j] - d + 10) % 10) * xs);
  return { wheels, levers, crank: TAU * ease(band(s, 0.05, 3.7)), bell: Math.sin(Math.PI * band(s, 3.55, 3.8)) }; // prettier-ignore
}

const DE_OPTIONS = [
  { key: "start", label: "Start at x =", type: "slider", min: 0, max: 20, step: 1, default: 1 },
  // Your polynomial, as typed (set from the panel, not shown).
  { key: "eq", label: "Your polynomial", type: "text", default: DE_EQ_DEFAULT, hidden: true },
];

// A figure wheel: a brass drum with its ten digits round the rim (digit k
// at -36k degrees, so turning it by 36k degrees brings k to the front) and
// a darker band top and bottom.
function deWheel(k, p, token, big = false) {
  const { r, wh } = DE;
  const tok = { kind: "token", params: [token, 0] };
  k.add(evenCylinder(r, r, wh, true), {
    pos: p,
    even: true,
    flat: 0.25,
    weight: 1.4,
    pattern: false,
    ...tok,
    color: (c) => {
      const band = Math.abs(c.p[1] - p[1]) > wh * 0.38;
      const col = c.s.cap ? shade(BRASS, 0.82) : band ? shade(BRASS, 0.78) : "#dcc27a";
      return keep(lit(col, c.n, { amb: 0.66, dif: 0.4, spec: 0.45, pow: 20 }));
    },
  });
  for (let d = 0; d < 10; d++) {
    const phi = (-d * 36 * Math.PI) / 180;
    const rr = r + 0.006;
    text(k, String(d), [p[0] + rr * Math.sin(phi), p[1], p[2] + rr * Math.cos(phi)], big ? 0.0115 : 0.0105, "#2a1c0c", { weight: 12, rot: [0, (phi * 180) / Math.PI, 0], ...tok }); // prettier-ignore
  }
}

function buildDifference(k, o) {
  const start = Math.round(clamp(Number(o.start ?? 1), 0, 20));
  let eq = String(o.eq || DE_EQ_DEFAULT);
  let read;
  try {
    read = deRead(eq, start);
  } catch {
    eq = DE_EQ_DEFAULT;
    read = deRead(eq, start);
  }
  const st = deSetup(read.f, start);
  const pretty = deShowEq(eq);
  DE_SHOWN.label = `p(x) = ${pretty.toLowerCase()}, from x = ${start}`;
  k.data = { st, m: {}, queue: 0, clock: 0, turn: null };
  const { r, wh, pitch } = DE;
  const y0 = 0.02;
  const topY = y0 + (DE.digits - 1) * pitch + wh / 2 + 0.05;
  const xl = -1.2;
  const xr = 0.98;
  // The frame: a wooden base, brass bottom and top plates and steel
  // pillars at the corners.
  block(k, [xr - xl + 0.3, 0.1, 0.62], [(xl + xr) / 2, y0 - wh / 2 - 0.12, 0], wood());
  block(k, [xr - xl + 0.1, 0.035, 0.46], [(xl + xr) / 2, y0 - wh / 2 - 0.05, 0], brass, { weight: 1.2 }); // prettier-ignore
  block(k, [xr - xl + 0.1, 0.035, 0.46], [(xl + xr) / 2, topY, 0], brass, { weight: 1.2 });
  for (const px of [xl - 0.02, xr + 0.02])
    for (const pz of [-0.19, 0.19])
      k.add(evenCylinder(0.018, 0.018, topY - y0 + wh / 2 + 0.05, false), { pos: [px, (topY + y0 - wh / 2 - 0.05) / 2, pz], even: true, weight: 1.5, pattern: false, color: steel }); // prettier-ignore
  // The columns: a steel shaft each, its wheels, a label on the top plate
  // and an index mark at the front of each wheel.
  for (const col of DE.cols) {
    const h = col.digits * pitch + 0.08;
    k.add(evenCylinder(0.014, 0.014, h + 0.06, false), { pos: [col.x, y0 + (col.digits - 1) * pitch / 2, 0], even: true, weight: 1.5, pattern: false, color: steel }); // prettier-ignore
    for (let j = 0; j < col.digits; j++) deWheel(k, [col.x, y0 + j * pitch, 0], col.token + j, col.id === "v"); // prettier-ignore
    const lpx = col.id === "v" ? 0.016 : 0.02;
    block(k, [Math.max(0.26, textWidth(col.label) * lpx + 0.07), 0.13, 0.012], [col.x, topY + 0.085, 0.19], brass, { weight: 1.2 }); // prettier-ignore
    text(k, col.label, [col.x, topY + 0.085, 0.21], lpx, "#2a1c0c", { weight: 10 });
    // A brass shield in front of the column with a window at each wheel's
    // front digit, so each wheel shows one digit, like an odometer.
    const sw = 0.28;
    const sh = col.digits * pitch + 0.02;
    const sy = y0 + ((col.digits - 1) * pitch) / 2;
    k.add(evenBox(sw, sh, 0.012), {
      pos: [col.x, sy, r + 0.03],
      even: true,
      flat: 0.2,
      weight: 1.3,
      pattern: false,
      color: (c) => {
        const j = Math.round((c.p[1] - y0) / pitch);
        const dy = c.p[1] - (y0 + j * pitch);
        const win =
          Math.abs(c.p[0] - col.x) < 0.035 && Math.abs(dy) < 0.048 && j >= 0 && j < col.digits;
        if (win && (c.s.face === 4 || c.s.face === 5)) return null;
        // An engraved line round the plate, and a polished bezel round each
        // window.
        const ex = sw / 2 - Math.abs(c.p[0] - col.x);
        const ey = sh / 2 - Math.abs(c.p[1] - sy);
        const line = Math.min(ex, ey) < 0.014;
        const bezel =
          Math.abs(c.p[0] - col.x) < 0.046 && Math.abs(dy) < 0.059 && j >= 0 && j < col.digits;
        const col2 = line ? shade(BRASS, 0.62) : bezel ? mix(BRASS, "#fff1c4", 0.35) : BRASS;
        return keep(lit(col2, c.n, { amb: 0.62, dif: 0.42, spec: 0.5, pow: 22 })); // prettier-ignore
      },
    });
    // Side plates, so the wheels show only through the windows from any
    // side the camera looks.
    for (const sd of [-1, 1])
      block(k, [0.012, sh, r + 0.2], [col.x + (sd * sw) / 2, sy, (r + 0.03) / 2 - 0.08], brass, { weight: 1.1 }); // prettier-ignore
  }
  // The carriage racks behind the columns: toothed steel bars that the
  // adding and carrying sectors run on.
  for (let i = 0; i < DE.cols.length - 1; i++) {
    const x = (DE.cols[i].x + DE.cols[i + 1].x) / 2;
    const top = topY - 0.03;
    const bot = y0 - wh / 2 - 0.03;
    block(k, [0.03, top - bot, 0.03], [x, (top + bot) / 2, -0.14], (c) => {
      const tooth = c.s.face === 4 && Math.sin((c.p[1] - bot) * 70) > 0.2 && Math.abs(c.p[0] - x) > 0.004;
      return keep(lit(tooth ? "#6f7780" : STEEL, c.n, { amb: 0.66, dif: 0.4, spec: 0.45 }));
    }, { weight: 1.6 }); // prettier-ignore
  }
  // The carry levers: a small steel arm to the right of each wheel that
  // takes a carry, pivoting about an upright pin (tokens).
  DE.carryCols.forEach((id, ci) => {
    const col = DE.cols.find((c) => c.id === id);
    for (let j = 0; j < 4; j++) {
      const y = y0 + j * pitch + pitch / 2;
      const px = col.x + 0.15;
      const tok = { kind: "token", params: [DE.leverToken + ci * 4 + j, 0] };
      k.add(evenBox(0.07, 0.016, 0.016), { pos: [px + 0.03, y, r + 0.05], even: true, weight: 3, pattern: false, color: steel, ...tok }); // prettier-ignore
      k.add(evenCylinder(0.012, 0.012, 0.03, true), { pos: [px, y, r + 0.05], even: true, weight: 3, pattern: false, color: darkSteel, ...tok }); // prettier-ignore
    }
  });
  // The polynomial on a plate at the front of the base.
  const eqText = `P(X) = ${pretty}`;
  block(k, [Math.max(0.6, textWidth(eqText) * 0.014 + 0.1), 0.1, 0.01], [-0.12, y0 - wh / 2 - 0.12, 0.315], brass, { weight: 1.2 }); // prettier-ignore
  text(k, eqText, [-0.12, y0 - wh / 2 - 0.12, 0.33], 0.012, "#2a1c0c", { weight: 10 });
  // The crank on the right side (a part turning about x), and the bell on
  // the top plate with its hammer (a part).
  const crank = k.part("crank", { pivot: [xr + 0.1, y0 + pitch, 0], axis: [1, 0, 0] });
  k.add(evenCylinder(0.02, 0.02, 0.14, true), { pos: [xr + 0.08, y0 + pitch, 0], rot: [0, 0, 90], even: true, weight: 2, pattern: false, color: steel }); // prettier-ignore
  k.add(evenBox(0.03, 0.26, 0.04), { pos: [xr + 0.16, y0 + pitch + 0.11, 0], even: true, weight: 2, part: crank, pattern: false, color: steel }); // prettier-ignore
  k.add(evenCylinder(0.024, 0.024, 0.12, true), { pos: [xr + 0.23, y0 + pitch + 0.22, 0], rot: [0, 0, 90], even: true, weight: 2.5, part: crank, pattern: false, color: wood(DARK_WOOD) }); // prettier-ignore
  // The gear train: a big gear on the crank's shaft drives a pinion above
  // it (parts turning about x, each by its angle modulo one tooth).
  const gy = y0 + pitch;
  gear(k, [xr + 0.085, gy, 0], 0.13, 18, 0.025, BRASS, { rot: FACE_ROT.x, part: k.part("gearBig", { pivot: [xr + 0.085, gy, 0], axis: [1, 0, 0] }) }); // prettier-ignore
  const py = gy + 0.13 + 0.075 - 0.02;
  gear(k, [xr + 0.085, py, 0], 0.075, 10, 0.025, "#b08a3a", { rot: FACE_ROT.x, part: k.part("gearSmall", { pivot: [xr + 0.085, py, 0], axis: [1, 0, 0] }) }); // prettier-ignore
  // Finials on the pillars and screws on each column's shield.
  for (const px of [xl - 0.02, xr + 0.02])
    for (const pz of [-0.19, 0.19])
      k.add(k.sphere(0.03), { pos: [px, topY + 0.045, pz], even: true, weight: 2, pattern: false, color: brass }); // prettier-ignore
  for (const col of DE.cols) {
    const sh = col.digits * pitch + 0.02;
    const sy = y0 + ((col.digits - 1) * pitch) / 2;
    for (const sd of [-1, 1]) for (const tb of [-1, 1]) screw(k, [col.x + sd * 0.11, sy + tb * (sh / 2 - 0.02), r + 0.037], 0.008); // prettier-ignore
  }
  const bx = xr + 0.06;
  k.add(k.lathe([[0.001, 0.08], [0.03, 0.078], [0.05, 0.05], [0.062, 0.015], [0.075, 0]], { grid: 40 }), {
    pos: [bx, topY + 0.02, -0.17],
    even: true,
    weight: 2,
    pattern: false,
    color: (c) => keep(lit("#d8b24e", c.n, { amb: 0.6, dif: 0.45, spec: 0.7, pow: 18 })),
  }); // prettier-ignore
  const hammer = k.part("hammer", { pivot: [bx - 0.12, topY + 0.02, -0.17], axis: [0, 0, 1] });
  k.add(evenCylinder(0.007, 0.007, 0.1, true), { pos: [bx - 0.12, topY + 0.07, -0.17], even: true, weight: 3, part: hammer, pattern: false, color: darkSteel }); // prettier-ignore
  k.add(k.sphere(0.018), { pos: [bx - 0.12, topY + 0.12, -0.17], even: true, weight: 3, part: hammer, pattern: false, color: darkSteel }); // prettier-ignore
}
// A typed polynomial in the engine's own letters (the pixel font).
function deShowEq(eq) {
  return String(eq)
    .replace(/\s+/g, "")
    .replace(/\*\*/g, "^")
    .replace(/\^2/g, "²")
    .replace(/\^3/g, "³")
    .replace(/\*/g, "·")
    .replace(/[−–]/g, "-")
    .toUpperCase()
    .replace(/([+-])/g, " $1 ")
    .replace(/^ - /, "-")
    .slice(0, 28);
}

function driveDifference(t, c, out, info) {
  const data = info?.data;
  if (!data) return;
  const m = data.m;
  const go = c.go ?? 0;
  // Each tap queues a turn; the engine turns them one after another. A tap
  // is a new tap number, or the pulse jumping back up.
  const n = info.tap?.n;
  if (n !== undefined && n !== null ? n !== m.lastN && go > 0 : go > (m.lastGo ?? 0) + 1e-4) data.queue++; // prettier-ignore
  m.lastN = n;
  m.lastGo = go;
  const now = info.time ?? 0;
  const dt = m.lastTime === undefined ? 0 : clamp(now - m.lastTime, 0, 0.1);
  m.lastTime = now;
  if (data.queue > 0 && !data.turn) {
    data.turn = deTurn(data.st);
    data.clock = 0;
    m.cue = -1;
  }
  let s = -1;
  if (data.turn) {
    data.clock += dt;
    s = data.clock;
    // The last frames of the tap: finish every queued turn.
    if (go <= 0) s = DE.turn;
    if (s >= DE.turn) {
      data.st = data.turn.next;
      data.turn = null;
      data.queue = go <= 0 ? 0 : data.queue - 1;
      s = -1;
    }
  }
  const pose = data.turn ? dePose(data.turn, s) : null;
  out.tokens = [];
  for (const col of DE.cols) {
    const digits = pose ? pose.wheels[col.id] : deDigits(data.st[col.id], col.digits);
    for (let j = 0; j < col.digits; j++) {
      const y = 0.02 + j * DE.pitch;
      out.tokens[col.token + j] = { base: [col.x, y, 0], quat: quatY((digits[j] * TAU) / 10), visible: 1 }; // prettier-ignore
    }
  }
  DE.carryCols.forEach((id, ci) => {
    const col = DE.cols.find((cc) => cc.id === id);
    for (let j = 0; j < 4; j++) {
      const lv = pose ? pose.levers[id][j] : 0;
      out.tokens[DE.leverToken + ci * 4 + j] = { base: [col.x + 0.15, 0.02 + j * DE.pitch + DE.pitch / 2, DE.r + 0.05], quat: quatZ(0.6 * lv), visible: 1 }; // prettier-ignore
    }
  });
  out.parts.crank = { angle: pose ? -pose.crank : 0 };
  const crank = pose ? -pose.crank : 0;
  out.parts.gearBig = { angle: crank % (TAU / 18) };
  out.parts.gearSmall = { angle: ((-crank * 18) / 10) % (TAU / 10) };
  out.parts.hammer = { angle: pose ? -0.6 * pose.bell : 0 };
  // Turned wheels are sorted again where they stand, a few times a turn.
  // (Also on the first frame: a wheel at rest may be turned past a quarter
  // turn from where it was built.)
  const key = pose ? Math.floor(s / 0.4) : -1;
  out.resort = key !== m.sortKey;
  out.resortPose = out.resort;
  m.sortKey = key;
  // Sounds: the crank's ratchet, a brass click for each wheel step, a
  // sharper snap for each carry, and the bell when the new value is ready.
  if (data.turn && s >= 0) {
    if (m.cuesFor !== data.turn) {
      const list = [[0.05, { voice: "ratchet", f: 900, n: 6, rate: 9, vol: 0.5 }]];
      for (const ph of data.turn.phases) {
        const most = Math.max(...Object.values(ph.adds).flatMap((a) => a.steps));
        for (let i = 0; i < most; i++) list.push([ph.at + (DE_ADD * (i + 0.5)) / 9, { voice: "click", f: 3400, decay: 0.4, vol: 0.45 }]); // prettier-ignore
        const n = Math.max(...Object.values(ph.adds).map((a) => a.carries.length));
        for (let i = 0; i < n; i++) list.push([ph.at + DE_ADD + 0.08 + i * DE_CARRY, { voice: "crack", f: 2600, decay: 0.3, vol: 0.5 }]); // prettier-ignore
      }
      list.push([3.55, { voice: "bell", f: "A6", decay: 0.9, vol: 0.6 }]);
      m.cues = list;
      m.cuesFor = data.turn;
      m.cue = -1;
    }
    cuesAt(m, "cue", s, m.cues, out);
  }
}

// ---- The Enigma machine --------------------------------------------------------------

// The Enigma I: three of its five rotors in any order, reflector B or C,
// ring settings, start positions and up to ten plugboard pairs (lane
// Computing r2; it was rotors I, II and III, reflector B and AR GK OX, still
// the default). The historical wirings and stepping, including the middle
// rotor's double step. Letters are 0..25. Reflector A (the Enigma I's until
// 1937) is here for the proof only (the 1930 manual's message, in
// tests/cmp2-enigma.spec.mjs).
const AZ = "ABCDEFGHIJKLMNOPQRSTUVWXYZ";
const EN_ROTORS = {
  I: { wiring: "EKMFLGDQVZNTOWYHXUSPAIBRCJ", notch: "Q" },
  II: { wiring: "AJDKSIRUXBLHWTMCQGZNPYFVOE", notch: "E" },
  III: { wiring: "BDFHJLCPRTXVZNYEIWGAKMUSQO", notch: "V" },
  IV: { wiring: "ESOVPZJAYQUIRHXLNFTGKDCMWB", notch: "J" },
  V: { wiring: "VZBRGITYUPSDNHLXAWMJQOFECK", notch: "Z" },
};
const EN_REFLECTORS = {
  A: "EJMZALYXVBWFCRQUONTSPIKHGD",
  B: "YRUHQSLDPXNGOKMIEBFZCWVJAT",
  C: "FVPJIAOYEDRZXWGCTKUQSBNMHL",
};
const EN_PLUGS = "AR GK OX";
const EN_DEFAULT = "HELLO";
const EN_MAX = 20;
const idx = (ch) => AZ.indexOf(ch);
const mod26 = (n) => ((n % 26) + 26) % 26;

// A machine: rotor names left to right, ring settings, plugboard pairs.
function enigmaMachine({
  rotors = ["I", "II", "III"],
  rings = [0, 0, 0],
  plugs = EN_PLUGS,
  reflector = "B",
} = {}) {
  // prettier-ignore
  const fwd = rotors.map((r) => [...EN_ROTORS[r].wiring].map(idx));
  const back = fwd.map((w) => {
    const b = [];
    w.forEach((o, i) => (b[o] = i));
    return b;
  });
  const notch = rotors.map((r) => idx(EN_ROTORS[r].notch));
  const refl = [...EN_REFLECTORS[reflector]].map(idx);
  const plug = [...AZ].map((_, i) => i);
  for (const pair of String(plugs).toUpperCase().split(/\s+/).filter(Boolean)) {
    const a = idx(pair[0]);
    const b = idx(pair[1]);
    plug[a] = b;
    plug[b] = a;
  }
  // The rotors step before each letter: the right one always; the middle
  // one when the right one is at its notch, and again (with the left one)
  // when it is at its own notch itself: the double step.
  const step = (p) => {
    const q = p.slice();
    if (q[1] === notch[1]) {
      q[0] = mod26(q[0] + 1);
      q[1] = mod26(q[1] + 1);
    } else if (q[2] === notch[2]) q[1] = mod26(q[1] + 1);
    q[2] = mod26(q[2] + 1);
    return q;
  };
  const through = (c, i, p, table) => mod26(table[i][mod26(c + p[i] - rings[i])] - p[i] + rings[i]);
  const letter = (c, p) => {
    let x = plug[c];
    for (let i = 2; i >= 0; i--) x = through(x, i, p, fwd);
    x = refl[x];
    for (let i = 0; i < 3; i++) x = through(x, i, p, back);
    return plug[x];
  };
  // Types a message from start positions p; returns every key's letter,
  // the rotor positions after it steps, and the lamp that lights.
  const type = (text, start) => {
    let p = start.slice();
    return [...text].map((ch) => {
      p = step(p);
      const k = idx(ch);
      return { key: k, pos: p.slice(), lamp: letter(k, p) };
    });
  };
  return { step, letter, type, plug, notch };
}
const enClean = (text) => String(text ?? "").toUpperCase().replace(/[^A-Z]/g, "").slice(0, EN_MAX); // prettier-ignore
const EN_SHOWN = { label: "HELLO" };

// Lane Computing r2: the setting, from the Toy tab. The rotors (three of I
// to V; a rotor picked twice gives way to the first one not in use, as a
// machine has one of each), the reflector, the ring settings and the start
// positions (letters), and the plugboard: letters taken in pairs, each
// letter in one pair at most, up to ten pairs (as the Enigma I had ten
// cables). A preset sets them all to a published key.
const EN_ROMAN = ["I", "II", "III", "IV", "V"];
const EN_SIDES = [
  ["L", "Left"],
  ["M", "Middle"],
  ["R", "Right"],
];
// The published keys (tests/cmp2-enigma.spec.mjs decodes the whole of both
// parts): Operation Barbarossa, July 7, 1941, a German Army message in two
// parts, as published from the original intercepts by Geoff Sullivan and
// Frode Weierud (cryptocellar.org) and on Franklin Heath's Enigma sample
// messages. Each part is at its message key; the pad takes its first 20
// letters.
const EN_PRESETS = {
  barbarossa1: { rotors: ["II", "IV", "V"], reflector: "B", rings: "BUL", start: "BLA", plugs: "AV BS CG DL FU HZ IN KM OW RX", message: "EDPUDNRGYSZRCXNUYTPO", title: "Operation Barbarossa, 1941, part 1" }, // prettier-ignore
  barbarossa2: { rotors: ["II", "IV", "V"], reflector: "B", rings: "BUL", start: "LSD", plugs: "AV BS CG DL FU HZ IN KM OW RX", message: "SFBWDNJUSEGQOBHKRTAR", title: "Operation Barbarossa, 1941, part 2" }, // prettier-ignore
};
const EN_STATE = { preset: "own" };
function enPlugPairs(text) {
  const letters = String(text ?? "")
    .toUpperCase()
    .replace(/[^A-Z]/g, "");
  const used = new Set();
  const pairs = [];
  for (let i = 0; i + 1 < letters.length && pairs.length < 10; i += 2) {
    const [a, b] = [letters[i], letters[i + 1]];
    if (a === b || used.has(a) || used.has(b)) continue;
    used.add(a);
    used.add(b);
    pairs.push(a + b);
  }
  return pairs;
}
function enSetting(o = {}) {
  const pre = EN_PRESETS[o.preset];
  if (pre) {
    const n = (str) => [...str].map(idx);
    return { rotors: pre.rotors.slice(), reflector: pre.reflector, rings: n(pre.rings), start: n(pre.start), plugs: pre.plugs.split(" "), preset: o.preset }; // prettier-ignore
  }
  const rotors = [];
  for (const [side] of EN_SIDES) {
    const r = o[`rotor${side}`] ?? ["I", "II", "III"][rotors.length];
    rotors.push(EN_ROTORS[r] && !rotors.includes(r) ? r : null);
  }
  for (let i = 0; i < 3; i++) rotors[i] ||= EN_ROMAN.find((x) => !rotors.includes(x));
  const letter = (v) => Math.max(0, idx(String(v ?? "A").toUpperCase()));
  return {
    rotors,
    reflector: o.reflector === "C" ? "C" : "B",
    rings: EN_SIDES.map(([side]) => letter(o[`ring${side}`])),
    start: EN_SIDES.map(([side]) => letter(o[`start${side}`])),
    plugs: enPlugPairs(o.plugs ?? EN_PLUGS),
    preset: "own",
  };
}
// The setting as a key sheet line: II IV V  UKW B  RINGS 02 21 12 …
function enSettingLine(st) {
  const two = (v) => String(v + 1).padStart(2, "0");
  const pos = st.start.map((v) => AZ[v]).join("");
  return `${st.rotors.join(" ")}   UKW ${st.reflector}   RINGS ${st.rings.map(two).join(" ")}   START ${pos}   PLUGS ${st.plugs.join(" ") || "NONE"}`; // prettier-ignore
}
// The Toy tab's setting: a preset, or every part of the key.
const EN_LETTERS = [...AZ].map((ch, i) => ({ id: ch, label: `${ch} (${String(i + 1).padStart(2, "0")})` })); // prettier-ignore
function enOptions() {
  const own = !EN_PRESETS[EN_STATE.preset];
  const hide = own ? {} : { hidden: true };
  return [
    { key: "message", label: "Your message", type: "text", default: EN_DEFAULT, hidden: true },
    {
      key: "preset",
      label: "Setting",
      type: "select",
      default: "own",
      choices: [
        { id: "own", label: "Set it yourself" },
        { id: "barbarossa1", label: "Barbarossa, 1941, part 1" },
        { id: "barbarossa2", label: "Barbarossa, 1941, part 2" },
      ],
    },
    ...EN_SIDES.map(([side, name], i) => ({ key: `rotor${side}`, label: `${name} rotor`, type: "select", default: ["I", "II", "III"][i], choices: EN_ROMAN.map((r) => ({ id: r, label: `Rotor ${r}` })), ...hide })), // prettier-ignore
    { key: "reflector", label: "Reflector", type: "select", default: "B", choices: [{ id: "B", label: "B" }, { id: "C", label: "C" }], ...hide }, // prettier-ignore
    ...EN_SIDES.map(([side, name]) => ({ key: `ring${side}`, label: `${name} ring`, type: "select", default: "A", choices: EN_LETTERS, ...hide })), // prettier-ignore
    ...EN_SIDES.map(([side, name]) => ({ key: `start${side}`, label: `${name} start`, type: "select", default: "A", choices: [...AZ].map((ch) => ({ id: ch, label: ch })), ...hide })), // prettier-ignore
    { key: "plugs", label: "Plugboard", type: "text", default: EN_PLUGS, placeholder: "AR GK OX", maxLength: 40, ...hide }, // prettier-ignore
  ];
}

// Keyboard and lampboard rows (the Enigma's own layout).
const EN_ROWS = ["QWERTZUIO", "ASDFGHJK", "PYXCVBNML"];
const EN = { key: 0.155, E: 9, rotorR: 0.2, step: TAU / 26, index: (35 * Math.PI) / 180 };
function enKeyAt(ch, y, z0, dz) {
  for (let r = 0; r < 3; r++) {
    const i = EN_ROWS[r].indexOf(ch);
    if (i >= 0)
      return [(i - (EN_ROWS[r].length - 1) / 2) * EN.key + (r === 1 ? 0.02 : 0), y, z0 + r * dz];
  }
  return [0, y, z0];
}
const enKeyPos = (ch) => enKeyAt(ch, 0.035, 0.18, 0.15);
const enLampPos = (ch) => enKeyAt(ch, 0.02, -0.4, 0.14);
const EN_ROTOR_X = [-0.22, 0, 0.22];
const EN_ROTOR_C = [0, 0.02, -0.72];

// The timeline of a tap: each letter's key goes down (the rotors step as
// it goes), the lamp lights, the key comes up; then the operator turns the
// rotors back to the start.
function enTimes(n, from = [0, 0, 0], start = [0, 0, 0]) {
  const dt = Math.min(0.5, 6.4 / Math.max(1, n));
  // The rotors are turned back to the start first, if they are not there.
  const t0 = from.some((p, j) => p !== start[j]) ? 0.6 : 0.2;
  const end = t0 + n * dt;
  return { dt, t0, end, back: end + 0.25, done: end + 1.05 };
}

function buildEnigma(k, o) {
  const st = enSetting(o);
  EN_STATE.preset = st.preset;
  const pre = EN_PRESETS[st.preset];
  // A preset puts its own coded message on the pad, unless one was typed.
  const typed = enClean(o.message);
  const msg = (pre && (!typed || typed === EN_DEFAULT) ? pre.message : typed) || EN_DEFAULT;
  EN_SHOWN.label = msg;
  const mach = enigmaMachine({ rotors: st.rotors, rings: st.rings, plugs: st.plugs.join(" "), reflector: st.reflector }); // prettier-ignore
  const start = st.start.slice();
  const enc = mach.type(msg, start);
  const coded = enc.map((e) => AZ[e.lamp]).join("");
  const dec = mach.type(coded, start);
  EN_KEYS.length = 0;
  k.data = { msg, coded, runs: [enc, dec], mach, m: {}, run: null, key: null, home: null };
  k.data.pad = { plain: msg, coded: "", dec: "", typed: false };
  k.data.rest = start.slice();
  k.data.start = start;
  k.data.setting = st;
  k.data.line = enSettingLine(st);
  k.data.view = [msg, "", ""];
  // The box: a wooden case with a dark crackle-finish top plate.
  const W = 1.62;
  const D = 1.72;
  panelBox(k, [W + 0.12, 0.36, D + 0.12], [0, -0.2, -0.22], cleanWood(), { front: 2.2, top: 1.2, left: 1.8, right: 1.8, back: 0.4 }); // prettier-ignore
  panelBox(k, [W, 0.02, D], [0, -0.01, -0.22], (c) => keep(lit(mix("#2b2d31", "#36393e", clamp01(0.5 - c.p[2] * 0.3)), c.n, { amb: 0.75, dif: 0.3, spec: 0.15 })), { top: 1.6 }); // prettier-ignore
  // The keys: a black cap with a metal rim and a white letter on a short
  // stem (tokens 0..25, by letter).
  for (const ch of AZ) {
    const p = enKeyPos(ch);
    const tok = { kind: "token", params: [idx(ch), 0] };
    k.add(evenCylinder(0.012, 0.012, 0.05, false), { pos: [p[0], p[1] - 0.03, p[2]], even: true, weight: 2, pattern: false, color: darkSteel, ...tok }); // prettier-ignore
    k.add(evenCylinder(0.058, 0.058, 0.03, true), {
      pos: p,
      even: true,
      weight: 1.6,
      flat: 0.25,
      pattern: false,
      ...tok,
      color: (c) => {
        const rr = Math.hypot(c.p[0] - p[0], c.p[2] - p[2]);
        const col = rr > 0.051 || !c.s.cap ? "#b9bec4" : "#161617";
        return keep(lit(col, c.n, { amb: 0.65, dif: 0.4, spec: 0.5, pow: 24 }));
      },
    });
    text(k, ch, [p[0], p[1] + 0.03, p[2]], 0.0115, "#f4f1e8", { weight: 26, size: 0.85, rot: [-90, 0, 0], ...tok }); // prettier-ignore
  }
  // The lampboard: frosted glass windows with stenciled letters, and one
  // glow (token 26) that moves under the lamp that lights.
  for (const ch of AZ) {
    const p = enLampPos(ch);
    k.add(evenCylinder(0.052, 0.052, 0.02, true), { pos: p, even: true, weight: 1.4, flat: 0.25, pattern: false, color: (c) => keep(lit(c.s.cap ? "#d9d6c8" : "#7c7f84", c.n, { amb: 0.8, dif: 0.25, spec: 0.3 })) }); // prettier-ignore
    text(k, ch, [p[0], p[1] + 0.03, p[2]], 0.011, "#2b2a27", {
      // Polish: finer splats, so the letters read at phone size.
      weight: 24,
      size: 0.8,
      rot: [-90, 0, 0],
    });
  }
  // The lampboard's plate: black metal with a round window for each lamp.
  const lampCenters = [...AZ].map((ch) => enLampPos(ch));
  block(k, [W - 0.2, 0.006, 0.44], [0, 0.0, -0.26], (c) => {
    if (c.s.face === 2 && lampCenters.some((q) => Math.hypot(c.p[0] - q[0], c.p[2] - q[2]) < 0.058)) return null; // prettier-ignore
    return keep(lit("#1b1c1e", c.n, { amb: 0.8, dif: 0.3, spec: 0.3 }));
  }, { weight: 1.2 }); // prettier-ignore
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) screw(k, [sx * (W / 2 - 0.05), 0.002, -0.22 + sz * (D / 2 - 0.05)], 0.014, "y"); // prettier-ignore
  const g0 = enLampPos("A");
  k.add(evenDisc(k, 0.056), { pos: [g0[0], g0[1] + 0.016, g0[2]], even: true, weight: 2, flat: 0.2, pattern: false, kind: "token", params: [26, 0], color: (c) => keep(mix("#fff3b0", "#ffb83a", Math.hypot(c.p[0] - g0[0], c.p[2] - g0[2]) / 0.056)) }); // prettier-ignore
  // The rotors in their well behind the lampboard: three drums on one axle
  // (parts, turning about x), each with its letter ring and a ridged thumb
  // wheel, the reflector to their left and the entry wheel to their right.
  const [rcx, rcy, rcz] = EN_ROTOR_C;
  const R = EN.rotorR;
  block(k, [0.95, 0.03, 0.5], [0, -0.1, rcz], darkSteel);
  k.add(evenCylinder(0.02, 0.02, 0.9, true), { pos: [rcx, rcy, rcz], rot: [0, 0, 90], even: true, weight: 1.5, pattern: false, color: steel }); // prettier-ignore
  for (const [x, w] of [[-0.4, 0.07], [0.37, 0.05]]) // prettier-ignore
    k.add(evenCylinder(R * 0.9, R * 0.9, w, true), { pos: [x, rcy, rcz], rot: [0, 0, 90], even: true, weight: 3, jitter: 0, pattern: false, color: darkSteel }); // prettier-ignore
  EN_ROTOR_X.forEach((x, i) => {
    const part = k.part(["rotorL", "rotorM", "rotorR"][i], {
      pivot: [x, rcy, rcz],
      axis: [1, 0, 0],
    });
    const ride = { part, pattern: false, even: true };
    // The letter ring: an ivory band with the 26 letters round it.
    // Lane Computing r2 (the owner's "make wheels sharper"): the rings,
    // their letters and the thumb wheels carry more, smaller splats.
    k.add(evenCylinder(R, R, 0.1, false), { pos: [x, rcy, rcz], rot: [0, 0, 90], weight: 4, flat: 0.25, jitter: 0, ...ride, color: (c) => keep(lit("#e8e0c8", c.n, { amb: 0.7, dif: 0.35, spec: 0.3 })) }); // prettier-ignore
    for (let l = 0; l < 26; l++) {
      const phi = EN.index - l * EN.step;
      const rr = R + 0.004;
      text(k, AZ[l], [x, rcy + rr * Math.cos(phi), rcz + rr * Math.sin(phi)], 0.0092, "#1c1a17", { weight: 26, size: 0.8, rot: [(phi * 180) / Math.PI - 90, 0, 0], ...ride }); // prettier-ignore
    }
    // The ridged thumb wheel on its left side, and the drum's dark faces.
    k.add(evenCylinder(R + 0.035, R + 0.035, 0.035, true), {
      pos: [x - 0.07, rcy, rcz],
      rot: [0, 0, 90],
      weight: 4,
      jitter: 0,
      flat: 0.25,
      ...ride,
      color: (c) => {
        const a = Math.atan2(c.p[2] - rcz, c.p[1] - rcy);
        const ridge = c.s.side && Math.sin(a * 26) > 0.2;
        return keep(lit(ridge ? "#3c3f44" : "#2a2c30", c.n, { amb: 0.7, dif: 0.35, spec: 0.35 }));
      },
    });
    k.add(evenDisc(k, R, 0.02, 64), { pos: [x + 0.05, rcy, rcz], rot: [0, 0, -90], even: true, weight: 2, ...ride, color: (c) => keep(lit("#3a3d42", [1, 0, 0], { amb: 0.8 })) }); // prettier-ignore
  });
  // Lane Computing r2: each rotor's number on the plate in front of it, and
  // the reflector's letter in front of it (left), as the setting has them.
  EN_ROTOR_X.forEach((x, i) => text(k, st.rotors[i], [x, 0.004, rcz + R + 0.05], 0.009, "#efe7cf", { weight: 16, size: 0.85, rot: [-90, 0, 0] })); // prettier-ignore
  text(k, `UKW ${st.reflector}`, [-0.4, 0.004, rcz + R + 0.05], 0.007, "#efe7cf", { weight: 16, size: 0.85, rot: [-90, 0, 0] }); // prettier-ignore
  // The index marks: a small brass pointer at each rotor's reading place.
  EN_ROTOR_X.forEach((x) => {
    const phi = EN.index;
    const rr = R + 0.04;
    k.add(evenCylinder(0.012, 0.0005, 0.03, true), { pos: [x, rcy + rr * Math.cos(phi), rcz + rr * Math.sin(phi)], rot: [(phi * 180) / Math.PI + 180, 0, 0], even: true, weight: 3, pattern: false, color: brass }); // prettier-ignore
  });
  // The plugboard on the front: two sockets per letter, and a cable for
  // each plugged pair.
  const pz = -0.22 + D / 2 + 0.065;
  const plugAt = (ch) => {
    const kp = enKeyAt(ch, 0, 0, 0.0);
    const r = EN_ROWS.findIndex((row) => row.includes(ch));
    return [kp[0], -0.1 - r * 0.1, pz];
  };
  for (const ch of AZ) {
    const p = plugAt(ch);
    for (const dy of [0.018, -0.018])
      k.add(evenDisc(k, 0.011, 0, 16), { pos: [p[0], p[1] + dy, pz + 0.002], rot: [90, 0, 0], even: true, weight: 3, pattern: false, color: () => keep("#0d0d0e") }); // prettier-ignore
    text(k, ch, [p[0] - 0.035, p[1], pz + 0.003], 0.006, "#e8e2d0", { weight: 16, size: 0.7 });
  }
  // The setting's pairs (lane Computing r2): a cable for each.
  st.plugs.forEach((pair, i) => {
    const a = plugAt(pair[0]);
    const b = plugAt(pair[1]);
    const sag = i < 3 ? 0.1 + 0.03 * i : 0.06 + 0.025 * (i - 3);
    const curve = (t) => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t - sag * Math.sin(Math.PI * t), pz + 0.03 + 0.04 * Math.sin(Math.PI * t)]; // prettier-ignore
    k.add(evenTube(k, curve, 0.011, { grid: 48 }), { even: true, weight: 2, flat: 0.35, pattern: false, color: (c) => keep(lit("#2b2b2e", c.n, { amb: 0.7, dif: 0.35, spec: 0.4 })) }); // prettier-ignore
    for (const p of [a, b])
      k.add(evenCylinder(0.017, 0.017, 0.04, true), { pos: [p[0], p[1], pz + 0.02], rot: [90, 0, 0], even: true, weight: 3, pattern: false, color: darkSteel }); // prettier-ignore
  });
  // Brass latches at the front corners, where the lid closes.
  for (const sx of [-1, 1]) {
    block(k, [0.08, 0.1, 0.016], [sx * (W / 2 - 0.1), -0.07, pz - 0.004], brass, { weight: 1.6 });
    screw(k, [sx * (W / 2 - 0.1), -0.09, pz + 0.006], 0.01);
  }
  // A plain brass name plate on the front of the case (no insignia).
  block(k, [0.36, 0.08, 0.01], [0, -0.1 + 0.14, pz - 0.002], brass, { weight: 1.2 });
  // The lid, opened back, with the operator's pad on its inside: the
  // message, the coded letters as they light (fade channel 0) and the
  // decoded letters on the second tap (channel 1).
  const lz = -0.22 - D / 2 - 0.06;
  const lidH = 0.98;
  panelBox(k, [W + 0.12, lidH, 0.05], [0, lidH / 2 - 0.02, lz], cleanWood(DARK_WOOD), { front: 1.8, top: 1.2, left: 1.2, right: 1.2, back: 0.3 }); // prettier-ignore
  // The lid's brass hinges.
  for (const sx of [-0.55, 0.55])
    k.add(evenCylinder(0.02, 0.02, 0.16, true), { pos: [sx, -0.01, lz + 0.03], rot: [0, 0, 90], even: true, weight: 2, pattern: false, color: brass }); // prettier-ignore
  const padW = 1.3;
  const padH = 0.74;
  const pcy = lidH / 2 + 0.02;
  panelBox(k, [padW, padH, 0.01], [0, pcy, lz + 0.03], (c) => keep(lit("#f3ecd8", c.n, { amb: 0.85, dif: 0.2, spec: 0 })), { front: 1.4 }, { edge: 0.006 }); // prettier-ignore
  // The writing on the pad is a live picture (the recipe's `screen`), so it
  // shows whatever is typed: the message, the coded letters as the lamps
  // light them and the decoded ones.
  k.add(enSheet(padW - 0.03, padH - 0.03), {
    pos: [0, pcy, lz + 0.04],
    kind: "screen",
    params: (c) => [c.u, c.v],
    flat: 0.08,
    even: true,
    weight: 6,
    size: 1.05,
    jitter: 0,
    pattern: false,
    color: () => keep("#f3ecd8"),
  });
  EN_PAD.y = pcy;
  EN_PAD.z = lz;
}

// A flat sheet facing the front (+z), with u across and v down from its top.
function enSheet(w, h) {
  return {
    area: w * h,
    thick: 0.004,
    dims: 2,
    sample(rand) {
      const u = rand();
      const v = rand();
      return { p: [(u - 0.5) * w, (0.5 - v) * h, 0], n: [0, 0, 1], u, v, face: 2 };
    },
  };
}

// The pad's picture: three ruled lines (the message, the coded letters and
// the decoded ones) in five-letter groups, as operators wrote them.
// Lane Computing r2: the setting on a line above them, as on a key sheet.
function enDrawPad(g, view, line = "") {
  const [W, H] = [EN_PAD.w, EN_PAD.h];
  const [plain, coded, dec] = view;
  g.fillStyle = "#f3ecd8";
  g.fillRect(0, 0, W, H);
  g.textBaseline = "top";
  let ls = 19;
  g.font = `bold ${ls}px "Courier New", Courier, monospace`;
  const lw = g.measureText(line).width;
  if (lw > W - 52) {
    ls = Math.floor((ls * (W - 52)) / lw);
    g.font = `bold ${ls}px "Courier New", Courier, monospace`;
  }
  g.fillStyle = "#5b3a1e";
  g.fillText(line, 26, 10);
  const rows = [
    ["MESSAGE", plain, "#1f1c18"],
    ["CODED", coded, "#8a1d1d"],
    ["DECODED", dec, "#1d4f8a"],
  ];
  rows.forEach(([label, str, col], i) => {
    const y = 36 + i * 94;
    g.fillStyle = "#8a6d4c";
    g.font = "bold 22px sans-serif";
    g.fillText(label, 26, y);
    g.fillStyle = "#cdbb9c";
    g.fillRect(22, y + 82, W - 44, 3);
    const groups = (str.match(/.{1,5}/g) || []).join(" ");
    let size = 46;
    g.font = `bold ${size}px "Courier New", Courier, monospace`;
    const wide = g.measureText(groups).width;
    if (wide > W - 52) {
      size = Math.floor((size * (W - 52)) / wide);
      g.font = `bold ${size}px "Courier New", Courier, monospace`;
    }
    g.fillStyle = col;
    g.fillText(groups, 26, y + 30);
  });
  g.fillStyle = "#9c825f";
  g.font = "italic 21px sans-serif";
  g.fillText("Tap the keys to type. Tap this pad for a clean sheet.", 26, H - 40);
  g.fillText("Tap the rotors to take the last letter back.", 26, H - 14);
}

// Keys tapped on the machine or typed on a keyboard, waiting their turn.
const EN_KEYS = [];
// The pad's picture size, where it sits (for a tap on it), and the shown
// Enigma's data (its pad's lines are in data.view).
const EN_PAD = { w: 640, h: 364, y: 0.51, z: -1.14, live: null };
const EN_KEY_T = 0.36;
const enBlank = () => ({ plain: "", coded: "", dec: "", typed: true });

// The shortest turn from one rotor setting to another, part of the way.
const enTurn = (from, to, f) =>
  from.map((p, j) => {
    let d = mod26(to[j] - p);
    if (d > 13) d -= 26;
    return p + d * f;
  });

function driveEnigma(t, c, out, info) {
  const data = info?.data;
  if (!data) return;
  EN_PAD.live = data;
  const m = data.m;
  out.cues = out.cues || [];
  // A tap on the pad: a clean sheet, and the rotors turned back to the start.
  const cl = since(c.clear, 0.3);
  if (cl >= 0 && (m.clS === undefined || m.clS < 0 || cl < m.clS)) enClear(data, t, out);
  m.clS = cl;
  // Step back (lane Fix7): the last letter off the pad, the rotors back one.
  const bk = since(c.back, 0.3);
  if (bk >= 0 && (m.bkS === undefined || m.bkS < 0 || bk < m.bkS)) enStepBack(data, t, out);
  m.bkS = bk;
  // A tap anywhere else: type the stored message, or decode what is on the
  // pad (the stored message's code, or the letters you typed).
  const s = since(c.go, EN.E);
  if (s >= 0 && (m.lastS === undefined || m.lastS < 0 || s < m.lastS)) {
    enFlushKeys(data);
    if (data.run) enCommit(data);
    data.run = enNextRun(data);
    data.home = null;
    m.cue = -1;
  }
  m.lastS = s;
  // A key tapped or typed: it finishes a running message at once, then the
  // keys play one after another.
  if (EN_KEYS.length && data.run) enCommit(data);
  if (data.key && t - data.key.t0 >= data.key.dt) enKeyDone(data);
  if (!data.key && EN_KEYS.length) enKeyStart(data, EN_KEYS.shift(), t, out);
  let pose = null;
  if (data.run) {
    const T = enTimes(data.run.list.length, data.run.from, data.start);
    if (s < 0 || s >= T.done) enCommit(data);
    else pose = enPose(data.run, T, s);
  }
  if (data.key) {
    const kk = data.key;
    const f = clamp01((t - kk.t0) / kk.dt);
    const lampOn = f > 0.22 && f < 0.85;
    if (f > 0.22 && !kk.lit) {
      kk.lit = true;
      data.pad.coded += AZ[kk.lamp];
      out.cues.push({ voice: "click", f: 4200, decay: 0.3, vol: 0.25 });
    }
    const rotors = enTurn(kk.from, kk.to, ease(band(f, 0, 0.25)));
    pose = { key: kk.k, down: Math.sin(Math.PI * band(f, 0, 0.8)), lamp: lampOn ? kk.lamp : -1, rotors }; // prettier-ignore
  }
  if (!pose && data.home) {
    const f = ease(band(t - data.home.t0, 0, 0.6));
    if (f >= 1) data.home = null;
    else pose = { key: -1, down: 0, lamp: -1, rotors: enTurn(data.home.from, data.home.to || data.start, f) }; // prettier-ignore
  }
  // The pad's lines: a running message shows its letters as they light.
  const pad = data.pad;
  let view = [pad.plain, pad.coded, pad.dec];
  if (data.run && pose) {
    const r = data.run;
    const lit = r.list
      .slice(0, pose.count)
      .map((e) => AZ[e.lamp])
      .join("");
    view = r.mode === 0 ? [r.plain, lit, ""] : [r.plain, r.coded, lit];
  }
  data.view = view;
  const n = Math.max(1, view[0].length);
  out.morph = [view[1].length / n, view[2].length / n, 0, 0];
  out.tokens = [];
  for (let i = 0; i < 26; i++) out.tokens[i] = { offset: [0, pose && pose.key === i ? -0.03 * pose.down : 0, 0], visible: 1 }; // prettier-ignore
  const g0 = enLampPos("A");
  const lampAt = pose && pose.lamp >= 0 ? enLampPos(AZ[pose.lamp]) : g0;
  out.tokens[26] = { offset: [lampAt[0] - g0[0], 0, lampAt[2] - g0[2]], visible: pose && pose.lamp >= 0 ? 1 : 0 }; // prettier-ignore
  const pos = pose ? pose.rotors : data.rest;
  ["rotorL", "rotorM", "rotorR"].forEach((nm, i) => (out.parts[nm] = { angle: pos[i] * EN.step }));
  // The lamp's glow and the turned rotors are sorted again where they are.
  const key = pose ? `${pose.lamp}:${pos.map((v) => Math.round(v * 4)).join(",")}` : `rest:${data.rest}`; // prettier-ignore
  out.resort = key !== m.sortKey;
  out.resortPose = out.resort;
  m.sortKey = key;
  // Sounds: a heavy clack for each key, the ratchet of the rotors stepping
  // and a faint click as each lamp lights.
  if (data.run && s >= 0) {
    if (m.cuesFor !== data.run) {
      const T = enTimes(data.run.list.length, data.run.from, data.start);
      const list = [];
      if (T.t0 > 0.3) list.push([0.05, { voice: "ratchet", f: 1200, n: 4, rate: 10, vol: 0.4 }]);
      data.run.list.forEach((e, i) => {
        const a = T.t0 + i * T.dt;
        list.push([a, { voice: "clack", f: 420, decay: 0.5, vol: 0.8 }]);
        list.push([a + 0.03, { voice: "ratchet", f: 1500, n: 1, vol: 0.35 }]);
        list.push([a + 0.1, { voice: "click", f: 4200, decay: 0.3, vol: 0.25 }]);
      });
      list.push([T.back, { voice: "ratchet", f: 1200, n: 5, rate: 10, vol: 0.4 }]);
      m.cues = list;
      m.cuesFor = data.run;
    }
    cuesAt(m, "cue", s, m.cues, out);
  }
}
// What the next tap off the keys does: decode the letters typed on the pad,
// or the stored message's code; otherwise type the stored message.
function enNextRun(data) {
  const pad = data.pad;
  const from = data.rest.slice();
  if (pad.typed && pad.coded && !pad.dec) {
    const list = data.mach.type(pad.coded, data.start);
    return { mode: 1, list, plain: pad.plain, coded: pad.coded, typed: true, from, start: data.start }; // prettier-ignore
  }
  if (!pad.typed && pad.coded === data.coded && !pad.dec)
    return { mode: 1, list: data.runs[1], plain: data.msg, coded: data.coded, typed: false, from, start: data.start }; // prettier-ignore
  return { mode: 0, list: data.runs[0], plain: data.msg, coded: data.coded, typed: false, from, start: data.start }; // prettier-ignore
}
// Where the keys, lamp, rotors and pad are at time s of a tap.
function enPose(run, T, s) {
  const n = run.list.length;
  if (s < T.t0) {
    // The rotors are first turned back to the start, if they are not there.
    const rotors = enTurn(run.from, run.start, ease(band(s, 0, T.t0 - 0.05)));
    return { key: -1, down: 0, lamp: -1, rotors, count: 0 };
  }
  if (s < T.end) {
    const i = Math.max(0, Math.min(n - 1, Math.floor((s - T.t0) / T.dt)));
    const f = clamp01((s - T.t0) / T.dt - i);
    const e = run.list[i];
    const prev = i > 0 ? run.list[i - 1].pos : run.start;
    const stepF = ease(band(f, 0.0, 0.25));
    const rotors = [0, 1, 2].map((j) => prev[j] + mod26(e.pos[j] - prev[j]) * stepF);
    const lampOn = f > 0.22 && f < 0.85;
    return { key: e.key, down: Math.sin(Math.PI * band(f, 0, 0.8)), lamp: lampOn ? e.lamp : -1, rotors, count: i + (f > 0.22 ? 1 : 0) }; // prettier-ignore
  }
  // Turned back to the start: each rotor turns the short way home.
  const b = ease(band(s, T.back, T.done - 0.1));
  return { key: -1, down: 0, lamp: -1, rotors: enTurn(run.list[n - 1].pos, run.start, b), count: n }; // prettier-ignore
}
function enCommit(data) {
  const r = data.run;
  if (!r) return;
  const lit = r.list.map((e) => AZ[e.lamp]).join("");
  data.pad = r.mode === 0 ? { plain: r.plain, coded: lit, dec: "", typed: r.typed } : { plain: r.plain, coded: r.coded, dec: lit, typed: r.typed }; // prettier-ignore
  data.rest = data.start.slice();
  data.run = null;
}
// One key: the rotors step, then the lamp lights and the letter is written.
// A key after a finished message (or a full pad) starts a clean sheet, with
// the rotors set back to the start.
function enKeyStart(data, k, t, out) {
  let start = data.rest;
  if (!data.pad.typed || data.pad.dec || data.pad.plain.length >= EN_MAX) {
    data.pad = enBlank();
    start = data.start;
  }
  const to = data.mach.step(start);
  // Where the rotors stood before each letter, so a step back can return them.
  data.hist = data.pad.plain ? data.hist || [] : [];
  data.hist.push(start.slice());
  data.pad.plain += AZ[k];
  const dt = EN_KEYS.length ? 0.22 : EN_KEY_T;
  data.key = { k, lamp: data.mach.letter(k, to), from: data.rest.slice(), to, t0: t, dt, lit: false }; // prettier-ignore
  data.rest = to;
  data.home = null;
  out.cues.push({ voice: "clack", f: 420, decay: 0.5, vol: 0.8 });
  out.cues.push({ voice: "ratchet", f: 1500, n: 1, vol: 0.35 });
}
function enKeyDone(data) {
  const kk = data.key;
  if (!kk) return;
  if (!kk.lit) data.pad.coded += AZ[kk.lamp];
  data.key = null;
}
// Plays every waiting key at once (a tap off the keys comes after them).
function enFlushKeys(data) {
  enKeyDone(data);
  const out = { cues: [] };
  while (EN_KEYS.length) {
    enKeyStart(data, EN_KEYS.shift(), 0, out);
    enKeyDone(data);
  }
}
// Step back (lane Fix7): the real machine had no delete key. An operator who
// pressed a wrong key turned the rotors back by hand, with the thumb wheels,
// to where they stood before it, and crossed the letter out. Here the last
// letter you typed leaves the pad (and its coded letter), and the rotors turn
// back to where they were before it. A stored message or a decoded one has
// nothing typed to take back.
function enStepBack(data, t, out) {
  enFlushKeys(data);
  const pad = data.pad;
  const hist = data.hist || [];
  if (data.run || !pad.typed || pad.dec || !pad.plain || !hist.length) return;
  const prev = hist.pop();
  pad.plain = pad.plain.slice(0, -1);
  pad.coded = pad.coded.slice(0, -1);
  data.home = { from: data.rest.slice(), to: prev.slice(), t0: t };
  data.rest = prev.slice();
  out.cues.push({ voice: "ratchet", f: 1300, n: 1, vol: 0.4 });
}
function enClear(data, t, out) {
  EN_KEYS.length = 0;
  enKeyDone(data);
  data.run = null;
  data.pad = enBlank();
  if (data.rest.some((p, j) => p !== data.start[j])) {
    data.home = { from: data.rest.slice(), t0: t };
    out.cues.push({ voice: "ratchet", f: 1200, n: 4, rate: 10, vol: 0.4 });
  }
  data.rest = data.start.slice();
}

// ---- The Turing-Welchman Bombe --------------------------------------------------------

// One bank of the Bombe: 12 sets of three drums, one set for each letter of
// the crib (the words the codebreakers guessed were in the message). Each
// set stands for an Enigma at the crib letter's place in the message. The
// drums run through the rotor settings like an odometer; at each setting
// the machine checks the crib against the coded text, and it stops on the
// setting where they agree. Simplified: the real Bombe also worked out the
// plugboard from loops in its menu (with Welchman's diagonal board); here
// the plugboard is taken as known (the Enigma toy's own: AR, GK, OX), and
// the fast drums are shown turning far slower than the real ones.
const BO = { sets: 12, E: 8, r: 0.095, dx: 0.19, rows: [1.58, 1.34, 1.1], front: 0.37 };
const BO_DEFAULT = "WEATHERREPORT";
const BO_DRUM_COLORS = ["#b8332a", "#7a2233", "#2f7a3b"];
const BO_SHOWN = { label: "WEATHERREPORT" };
const boX = (c) => (c - (BO.sets - 1) / 2) * BO.dx - 0.08;

// The secret setting the message was sent at (from the message, so a link
// always shows the same search), the coded text, the crib and the search.
function bombeCase(message) {
  const msg = enClean(message) || BO_DEFAULT;
  let h = 2166136261;
  for (const ch of msg) h = Math.imul(h ^ ch.charCodeAt(0), 16777619) >>> 0;
  const secret = [1 + (h % 2), (h >>> 3) % 26, (h >>> 9) % 26];
  const mach = enigmaMachine();
  const coded = mach
    .type(msg, secret)
    .map((e) => AZ[e.lamp])
    .join("");
  const crib = msg.slice(0, Math.min(BO.sets, msg.length));
  const found = bombeSearch(mach, crib, coded);
  const plain = found
    ? mach
        .type(coded, found.pos)
        .map((e) => AZ[e.lamp])
        .join("")
    : "";
  return { msg, secret, coded, crib, found, plain };
}
// Tries every setting from AAA on, the fast rotor first, and stops at the
// first where the crib enciphers to the start of the coded text.
function bombeSearch(mach, crib, coded) {
  for (let i = 0; i < 26 * 26 * 26; i++) {
    const pos = [Math.floor(i / 676), Math.floor(i / 26) % 26, i % 26];
    const out = mach.type(crib, pos);
    if (out.every((e, j) => AZ[e.lamp] === coded[j])) return { i, pos };
  }
  return null;
}

// Drum rows: the top row is the fast rotor, then the middle, then the slow.
// Each set's drums stand at the setting plus its crib letter's place.
function boPose(data, s) {
  const N = data.found ? data.found.i : 0;
  if (s < 0) {
    const i = data.done ? N : 0;
    return { i, top: i % 26, lamp: data.done ? 1 : 0, shown: data.done ? [1, 1] : [0, 0], reset: 0 }; // prettier-ignore
  }
  // Set back to the start (if a search has run), spin, stop, read out.
  const back = data.done ? ease(band(s, 0, 0.45)) : 1;
  const u = ease(band(s, 0.5, 4.3));
  let i = Math.floor(N * u);
  let top = (N % 26) + 26 * 12 * u - 26 * 12; // turns 12 times, landing on its letter
  if (data.done && back < 1) {
    i = Math.round(N * (1 - back));
    top = (N % 26) * (1 - back);
  }
  const lamp = s > 4.35 ? 1 : 0;
  return { i, top, lamp, shown: [band(s, 4.7, 6.2), band(s, 4.45, 4.6)] }; // prettier-ignore
}

function buildBombe(k, o) {
  const cs = bombeCase(o.message);
  BO_SHOWN.label = cs.msg;
  k.data = { ...cs, done: false, m: {}, run: false };
  const W = 2.5;
  const H = 2.05;
  const D = 0.74;
  const fz = BO.front;
  // The cabinet: a dark painted steel case on a plinth, with brass edges.
  panelBox(k, [W, H, D], [0, H / 2, 0], (c) => keep(lit(mix("#2a2e33", "#353a40", clamp01(c.p[1] / H)), c.n, { amb: 0.72, dif: 0.35, spec: 0.12 })), { front: 2.2, left: 1.4, right: 1.4, top: 1.2, back: 0.3 }); // prettier-ignore
  block(k, [W + 0.08, 0.08, D + 0.08], [0, 0.04, 0], (c) =>
    keep(lit("#1d2023", c.n, { amb: 0.75 })),
  );
  panelBox(k, [W - 0.1, 0.72, 0.012], [-0.08 + 0.02, 1.34, fz + 0.006], (c) => keep(lit("#1f2226", c.n, { amb: 0.8, dif: 0.25 })), { front: 1.6 }, { edge: 0 }); // prettier-ignore
  // Raised frames round the drum panel and the readout, rivets along the
  // cabinet's front edges, handles and vents on its sides.
  const frame = (w, h, cx, cy) => {
    for (const [sx, sy, px, py] of [[w + 0.04, 0.03, 0, h / 2], [w + 0.04, 0.03, 0, -h / 2], [0.03, h, w / 2, 0], [0.03, h, -w / 2, 0]]) // prettier-ignore
      block(k, [sx, sy, 0.025], [cx + px, cy + py, fz + 0.012], (c) => keep(lit("#3d434a", c.n, { amb: 0.7, dif: 0.35, spec: 0.35 })), { weight: 1.4 }); // prettier-ignore
  };
  frame(W - 0.1, 0.72, -0.06, 1.34);
  frame(2.1, 0.46, -0.08, 0.62);
  for (let i = 0; i <= 12; i++) for (const sx of [-1, 1]) screw(k, [sx * (W / 2 - 0.035), 0.12 + (i * (H - 0.2)) / 12, fz + 0.002], 0.01); // prettier-ignore
  for (const sx of [-1, 1]) {
    for (const hy of [0.85, 1.25]) block(k, [0.03, 0.05, 0.03], [sx * (W / 2 + 0.015), hy, 0.12], darkSteel, { weight: 2 }); // prettier-ignore
    block(k, [0.03, 0.03, 0.3], [sx * (W / 2 + 0.035), 1.05, 0.12], steel, { weight: 2 }); // handle bar
    for (let v = 0; v < 8; v++) block(k, [0.006, 0.018, 0.4], [sx * (W / 2 + 0.003), 0.35 + v * 0.05, -0.1], () => keep("#15181b"), { weight: 1.5 }); // prettier-ignore
  }
  // The drums (tokens 0..35): a coloured drum with a cream letter ring, a
  // steel hub and a white index notch, turning about its own axle.
  for (let set = 0; set < BO.sets; set++) {
    const x = boX(set);
    BO.rows.forEach((y, row) => {
      const tok = { kind: "token", params: [set * 3 + row, 0] };
      const z = fz + 0.05;
      k.add(evenCylinder(BO.r, BO.r, 0.07, true), {
        pos: [x, y, z],
        rot: [90, 0, 0],
        even: true,
        weight: 1.3,
        flat: 0.25,
        pattern: false,
        ...tok,
        color: (c) => {
          const rr = Math.hypot(c.p[0] - x, c.p[1] - y);
          const face = c.s.cap === "top";
          let col = BO_DRUM_COLORS[row];
          if (face && rr > BO.r * 0.62 && rr < BO.r * 0.94) {
            // The letter ring, with a red mark at A so the turn reads at a
            // glance (26 letters are too small to read at phone size).
            const ang = Math.atan2(c.p[1] - y, c.p[0] - x);
            const f = ((Math.PI / 2 - ang) / TAU) * 26;
            const isA = Math.abs((((f % 26) + 26) % 26) - 13) > 12.55;
            col = isA && rr > BO.r * 0.68 ? "#c21d12" : "#e9dfc6";
          }
          if (face && rr < BO.r * 0.22) col = STEEL;
          return keep(lit(col, face ? [0, 0, 1] : c.n, { amb: 0.66, dif: 0.4, spec: 0.35 }));
        },
      });
      // Three bolt heads round the hub.
      for (let b = 0; b < 3; b++) {
        const a = (b * TAU) / 3;
        k.add(evenCylinder(0.008, 0.008, 0.008, true), { pos: [x + 0.035 * Math.cos(a), y + 0.035 * Math.sin(a), z + 0.04], rot: [90, 0, 0], even: true, weight: 3, pattern: false, color: darkSteel, ...tok }); // prettier-ignore
      }
      // The notch at the top of the drum face shows which letter is set.
      k.add(evenBox(0.012, 0.03, 0.01), { pos: [x, y + BO.r * 0.45, z + 0.04], even: true, weight: 3, pattern: false, color: () => keep("#ffffff"), ...tok }); // prettier-ignore
    });
    // The menu above each set: its crib letter over its coded letter.
    const used = set < cs.crib.length;
    text(k, used ? cs.crib[set] : "-", [x, BO.rows[0] + 0.28, fz + 0.02], 0.013, used ? "#f1e6c4" : "#5a6068", { weight: 12 }); // prettier-ignore
    text(k, used ? cs.coded[set] : "-", [x, BO.rows[0] + 0.18, fz + 0.02], 0.013, used ? "#ff8d7a" : "#5a6068", { weight: 12 }); // prettier-ignore
  }
  text(k, "CRIB", [boX(0) - 0.17, BO.rows[0] + 0.28, fz + 0.02], 0.007, "#b9b09a", { weight: 8 });
  text(k, "CODED", [boX(0) - 0.17, BO.rows[0] + 0.18, fz + 0.02], 0.007, "#b9b09a", { weight: 8 });
  // The readout board below the drums: the coded text, and, when it stops,
  // the setting found (fade channel 1) and the plain text (channel 0).
  const ry = 0.62;
  panelBox(k, [2.1, 0.46, 0.02], [-0.08, ry, fz + 0.01], (c) => keep(lit("#efe6cc", c.n, { amb: 0.85, dif: 0.2, spec: 0 })), { front: 1.6 }, { edge: 0 }); // prettier-ignore
  const px = 0.0155;
  const lx = -0.08 - 1.0;
  const line = (label, str, y, color, ch) => {
    text(k, label, [lx + 0.03, y, fz + 0.035], 0.008, "#7c6a52", { weight: 8, align: "left" });
    [...str].forEach((l, i) => {
      const opts = ch === undefined ? {} : { kind: "fade", params: [(i + 0.5) / str.length, -0.4 / str.length], channel: ch }; // prettier-ignore
      text(k, l, [lx + 0.42 + i * px * 6.4, y, fz + 0.035], px, color, { weight: 10, ...opts });
    });
  };
  line("CODED", cs.coded, ry + 0.14, "#8a1d1d");
  line("SETTING", cs.found ? cs.found.pos.map((p) => AZ[p]).join(" ") : "", ry, "#1f1c18", 1);
  line("PLAIN", cs.plain, ry - 0.14, "#1d4f8a", 0);
  // The stop lamp on the right side of the cabinet (a part that lights).
  const lp = [W / 2 + 0.02, 1.62, 0.12];
  k.add(evenCylinder(0.06, 0.06, 0.04, true), { pos: [lp[0], lp[1], lp[2]], rot: [0, 0, 90], even: true, weight: 1.5, pattern: false, color: brass }); // prettier-ignore
  k.add(k.sphere(0.06), { pos: [lp[0] + 0.03, lp[1], lp[2]], scale: [0.6, 1, 1], even: true, weight: 1.5, pattern: false, color: (c) => keep(lit("#5b2a22", c.n, { amb: 0.7, spec: 0.5 })) }); // prettier-ignore
  const lampPart = k.part("lamp", { pivot: lp });
  k.add(k.sphere(0.064), { pos: [lp[0] + 0.032, lp[1], lp[2]], scale: [0.62, 1, 1], even: true, weight: 1.5, part: lampPart, pattern: false, color: (c) => keep(mix("#ffd76a", "#fff6d8", Math.max(0, c.n[0]) ** 2)) }); // prettier-ignore
  // A lamp in the same place on the front, so the stop reads from the
  // front too.
  const fl = [W / 2 - 0.12, 1.84, fz + 0.01];
  k.add(evenCylinder(0.045, 0.045, 0.02, true), { pos: fl, rot: [90, 0, 0], even: true, weight: 1.5, pattern: false, color: brass }); // prettier-ignore
  k.add(k.sphere(0.042), { pos: [fl[0], fl[1], fl[2] + 0.02], scale: [1, 1, 0.6], even: true, weight: 1.5, part: lampPart, pattern: false, color: (c) => keep(mix("#ffd76a", "#fff6d8", Math.max(0, c.n[2]) ** 2)) }); // prettier-ignore
  text(k, "STOP", [fl[0], fl[1] - 0.08, fz + 0.02], 0.007, "#b9b09a", { weight: 8 });
}

function driveBombe(t, c, out, info) {
  const data = info?.data;
  if (!data) return;
  const m = data.m;
  const s = since(c.go, BO.E);
  if (s >= 0 && (m.lastS === undefined || m.lastS < 0 || s < m.lastS)) {
    if (data.run) data.done = true;
    data.run = true;
    m.cue = -1;
  }
  if (data.run && (s < 0 || s >= BO.E - 0.3)) {
    data.run = false;
    data.done = !!data.found;
  }
  m.lastS = s;
  const pose = boPose(data, data.run ? s : -1);
  const fast = data.run ? pose.top : pose.i % 26;
  const mid = Math.floor(pose.i / 26) % 26;
  const slow = Math.floor(pose.i / 676);
  out.tokens = [];
  for (let set = 0; set < BO.sets; set++) {
    const vals = [fast + set, mid, slow];
    BO.rows.forEach((y, row) => {
      out.tokens[set * 3 + row] = { base: [boX(set), y, BO.front + 0.05], quat: quatZ((-vals[row] * TAU) / 26), visible: 1 }; // prettier-ignore
    });
  }
  out.parts.lamp = { visible: pose.lamp };
  out.morph = [pose.shown[0], pose.shown[1], 0, 0];
  // Sounds: a dense clatter of drums while it searches (Sound B: no motor
  // buzz, the owner's note), then a sharp stop and a bell when a setting is
  // found.
  if (data.run && s >= 0) {
    cuesAt(m, "cue", s, [
      [0.5, { voice: "clatter", f: 900, n: 30, rate: 8, decay: 3.6, vol: 0.4 }],
      [4.3, { voice: "crack", f: 1800, decay: 0.4, vol: 0.8 }],
      [4.35, { voice: "bell", f: "C6", decay: 1.6, vol: 0.8 }],
    ], out); // prettier-ignore
  }
}

// ---- Recipes -------------------------------------------------------------------------

export const RECIPES = {
  "turing-machine": {
    density: 2,
    options: TM_OPTIONS,
    input: {
      title: "Your own number",
      placeholder: "1011, or a whole number like 11",
      button: "Put it on the tape",
      note: "Type a binary number of up to 12 digits (or a whole number up to 4095, which becomes binary). Add one works on it, and each tap adds one more, so it counts up. The busy beavers always start from a blank tape.",
      read(text) {
        return { bits: tmReadBits(text) };
      },
      shown: () => TM_SHOWN.label,
    },
    controls: [{ key: "go", label: "Run", type: "pulse", ease: TM.E }],
    action: { key: "go", label: "Run the program" },
    drive: driveTuring,
    build: buildTuring,
  },
  "difference-engine": {
    density: 2,
    options: DE_OPTIONS,
    input: {
      title: "Your own polynomial",
      placeholder: "x², 2x³ − x + 5, or n(n+1)/2",
      button: "Set up the engine",
      note: "Type a polynomial in x (or n) up to x³ that gives whole numbers, like x², x³ or n(n + 1)/2. The engine works out its differences and then finds each next value by adding alone. Set the starting x in the Toy tab. Each tap turns the crank once; tap again to keep cranking.",
      read(text) {
        deRead(text, 1);
        return { eq: text.trim().slice(0, 60) };
      },
      shown: () => DE_SHOWN.label,
    },
    controls: [{ key: "go", label: "Turn the crank", type: "pulse", ease: DE.E }],
    action: { key: "go", label: "Turn the crank" },
    drive: driveDifference,
    build: buildDifference,
  },
  "enigma-machine": {
    density: 2,
    // The owner's "make wheels sharper" (lane Computing r2): the crisper
    // splat kernel, so the rotors' letters, ridges and edges stay sharp.
    kernel: "sharp",
    // Your message, as typed (set from the panel, not shown), and the
    // machine's setting (lane Computing r2).
    get options() {
      return enOptions();
    },
    input: {
      title: "Type your own message",
      placeholder: "HELLO",
      button: "Put it on the pad",
      fileButton: false,
      note: "Or tap the machine's keys (or type on a keyboard) to code a message letter by letter, then tap the machine off the keys to decode it. A message you put on the pad here, up to 20 letters (spaces and anything that isn't a letter are left out, as Enigma operators did), is typed with a tap off the keys; the next tap decodes it. Set the machine above, as an operator did from the day's key sheet: three of its five rotors in any order, reflector B or C, the rings, the start letters and up to ten plugboard pairs. Or pick Barbarossa, 1941, and tap to decode a real message of the German Army.",
      read(text) {
        const msg = enClean(text);
        if (!msg) throw new Error("Type a message with some letters in it, like HELLO.");
        return { message: msg };
      },
      shown: () => EN_SHOWN.label,
    },
    controls: [
      // A tap off the keys always types or decodes (the next tap starts the
      // next message), so it never pauses (UI r3's long-effect pause).
      { key: "go", label: "Type it", type: "pulse", ease: EN.E, pausable: false },
      { key: "type", label: "Key", type: "pulse", ease: 0.2 },
      { key: "clear", label: "Clean sheet", type: "pulse", ease: 0.3 },
      // Lane Fix7: step back one letter (a tap on the rotors' thumb wheels,
      // the Backspace key, or this button).
      { key: "back", label: "Step back", type: "pulse", ease: 0.3 },
    ],
    action: {
      key: "go",
      label: "Type the message",
      // A key makes its own clack (cues), and so does a clean sheet.
      quiet: ["type", "clear", "back"],
      at(p) {
        // A key of the keyboard (its cap or letter, above the top plate).
        if (p[1] > 0.015 && p[2] > 0.08 && p[2] < 0.58) {
          let best = -1;
          let near = 0.075;
          for (const ch of AZ) {
            const q = enKeyPos(ch);
            const d = Math.hypot(p[0] - q[0], p[2] - q[2]);
            if (d < near) [best, near] = [idx(ch), d];
          }
          if (best >= 0) {
            EN_KEYS.push(best);
            return { key: "type", pick: best };
          }
        }
        // The rotors' thumb wheels: step back a letter, as an operator
        // turned the rotors back by hand to correct a mistake.
        const [, rcy, rcz] = EN_ROTOR_C;
        if (Math.abs(p[0]) < 0.34 && Math.abs(p[2] - rcz) < EN.rotorR + 0.04 && p[1] > rcy - 0.02) return { key: "back" }; // prettier-ignore
        // The operator's pad on the lid: a clean sheet.
        if (
          Math.abs(p[0]) < 0.66 &&
          Math.abs(p[1] - EN_PAD.y) < 0.38 &&
          p[2] > EN_PAD.z - 0.01 &&
          p[2] < EN_PAD.z + 0.09
        )
          // prettier-ignore
          return { key: "clear" };
        return null;
      },
    },
    // A keyboard's letters type on the machine too. Plain p and r stay the
    // site's shortcuts (poke, reset the view): hold Shift for those two.
    typeKey(ch) {
      if (ch === "Backspace") return { key: "back" };
      if (!/^[a-z]$/i.test(ch) || ch === "p" || ch === "r") return null;
      const k = idx(ch.toUpperCase());
      EN_KEYS.push(k);
      return { key: "type", pick: k };
    },
    screen: {
      width: EN_PAD.w,
      height: EN_PAD.h,
      version: () => `${EN_PAD.live?.line || ""}|${(EN_PAD.live?.view || []).join("|")}`,
      draw: (g) => enDrawPad(g, EN_PAD.live?.view || ["", "", ""], EN_PAD.live?.line || ""),
    },
    drive: driveEnigma,
    build: buildEnigma,
  },
  bombe: {
    density: 2,
    options: [
      // The message to break, as typed (set from the panel, not shown).
      {
        key: "message",
        label: "Message to break",
        type: "text",
        default: BO_DEFAULT,
        hidden: true,
      },
    ],
    input: {
      title: "A message to break",
      placeholder: "WEATHERREPORT",
      button: "Code it and search",
      note: "Type a message of up to 20 letters. The Enigma codes it at a setting the Bombe isn't told; its first 12 letters are the crib, the words the codebreakers guessed. The Bombe searches every rotor setting for the one where the crib fits, then reads the whole message.",
      read(text) {
        const msg = enClean(text);
        if (msg.length < 4)
          throw new Error("Type a message of at least 4 letters, like WEATHERREPORT.");
        return { message: msg };
      },
      shown: () => BO_SHOWN.label,
    },
    controls: [{ key: "go", label: "Search", type: "pulse", ease: BO.E }],
    action: { key: "go", label: "Start the search" },
    drive: driveBombe,
    build: buildBombe,
  },
};

// Exposed for the lane's tests.
export const DIFFERENCE = { read: deRead, setup: deSetup, turn: deTurn, digits: deDigits, DE };
export const ENIGMA = { machine: enigmaMachine, clean: enClean, AZ };
export const BOMBE = { crack: bombeCase, search: bombeSearch };
export const TURING = { PROGRAMS: TM_PROGRAMS, run: tmRun, tape: tmTape, readBits: tmReadBits, rows: tmRows, times: tmTimes }; // prettier-ignore
