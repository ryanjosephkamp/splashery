// Machines that compute (lane Machines A): kit-built models of the machines
// computing grew from, each following its real rules on what you type. The
// Turing machine reads and writes a tape of tiles; the difference engine
// adds columns of numbered wheels; the Enigma machine enciphers a message
// with the historical rotor wirings; the Bombe searches for the Enigma's
// setting. Every tile, wheel, key, rotor and drum is its own solid piece
// (a token or a part). Loaded on demand.

import { mix, shade, clamp } from "../kit.js";
import { evenBox, evenCylinder } from "./even.js";
import { FONT } from "../font.js";

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

// ---- Pixel-font text -----------------------------------------------------------------

const GLYPHS = {
  ...FONT,
  "→": "00000 00100 00010 11111 00010 00100 00000",
  "←": "00000 00100 01000 11111 01000 00100 00000",
  "·": "00000 00000 00000 01100 01100 00000 00000",
  "²": "01100 10010 00100 01000 11110 00000 00000",
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
  k.add(k.cylinder(0.012, TM.x(16.5), { caps: true }), {
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
      block(k, [w, h, d], [x, 0, 0], (c) => {
        const edge = Math.min(w / 2 - Math.abs(c.p[0] - x), h / 2 - Math.abs(c.p[1]));
        const col = c.s.face === 4 || c.s.face === 5 ? look.face : shade(look.face, 0.85);
        return keep(lit(edge < 0.008 ? shade(col, 0.9) : col, c.n, { amb: 0.7, dif: 0.35, spec: 0.3 })); // prettier-ignore
      }, { weight: 1.3, ...tok });
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
    const reel = k.part(name, { pivot: [hx, 0, 0.13], axis: [0, 0, 1] });
    k.add(k.disc(0.15, 0.025), {
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
        const spoke = Math.abs(((a / TAU) * 3 + 10) % 1 - 0.5) > 0.36 && r < 0.12 && r > 0.05;
        if (spoke) return null;
        return keep(lit(r > 0.13 ? shade(BRASS, 0.8) : BRASS, [0, 0, 1], { amb: 0.7, dif: 0.35, spec: 0.5 })); // prettier-ignore
      },
    });
    k.add(k.cylinder(0.025, 0.03), {
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
  const pin = k.part("pin", { pivot: [0, 0.2, 0] });
  k.add(k.cylinder(0.009, 0.07), { pos: [0, h / 2 + 0.05, 0], even: true, weight: 3, part: pin, pattern: false, color: steel }); // prettier-ignore
  const lampY = fh / 2 + 0.26;
  k.add(k.cylinder(0.07, 0.04), { pos: [0, lampY - 0.07, 0.01], even: true, weight: 1.5, pattern: false, color: brass }); // prettier-ignore
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
  k.add(k.cylinder(0.008, 0.13), { pos: [bx + 0.16, 0.265, 0], even: true, weight: 3, part: hammer, pattern: false, color: darkSteel }); // prettier-ignore
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
    k.add(k.cylinder(0.02, ctop - ch + 0.25), { pos: [sx, (ctop - ch + 0.25) / 2 - 0.15, -0.2], even: true, weight: 1.5, pattern: false, color: brass }); // prettier-ignore
  block(k, [cw + 0.06, ch + 0.06, 0.03], [cx, cy, -0.22], wood(DARK_WOOD));
  block(k, [cw, ch, 0.01], [cx, cy, -0.2], (c) => keep(lit("#efe3c3", c.n, { amb: 0.8, dif: 0.25, spec: 0 }))); // prettier-ignore
  const ink = "#2b241c";
  text(k, prog.title, [cx - cw / 2 + 0.08, ctop - 0.11, -0.17], 0.0155, "#7a2a1a", { align: "left", weight: 10 }); // prettier-ignore
  text(k, "STEP", [cx + cw / 2 - 0.42, ctop - 0.11, -0.17], 0.012, ink, { weight: 8 });
  const cols = [0.14, 0.44, 0.68, 0.92, 1.2, 1.5].map((f) => cx - cw / 2 + f * (cw / 1.72));
  const heads = ["STATE", "READ", "", "WRITE", "MOVE", "NEXT"];
  const hy = ctop - 0.3;
  heads.forEach((s, i) => text(k, s, [cols[i], hy, -0.17], 0.0105, "#6b5d48", { weight: 7 }));
  rows.forEach(([st, r, wr, mv, nx], i) => {
    const y = hy - 0.19 - i * rowH;
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

// ---- Recipes -------------------------------------------------------------------------

export const RECIPES = {
  "turing-machine": {
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
};

// Exposed for the lane's tests.
export const TURING = { PROGRAMS: TM_PROGRAMS, run: tmRun, tape: tmTape, readBits: tmReadBits, rows: tmRows, times: tmTimes }; // prettier-ignore
export { clamp, quatY, quatZ };
