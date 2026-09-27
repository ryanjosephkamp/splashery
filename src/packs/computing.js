// AI and computing: kit-built models where you watch the data move. Each toy
// is a dark display board with glowing parts on it: pulses of light run
// along wires whose thickness shows their weight, layers light up in order,
// and counters and word signs are drawn in a pixel font. Loaded on demand.
//
// Shared pieces (below): the board, wires (whose thickness can change by a
// morph), glowing beads that travel as tokens, lamps, pixel-font signs and
// seven-segment digits.

import { mix, shade, clamp, smoothstep } from "../kit.js";
import { FONT } from "../font.js";

const TAU = Math.PI * 2;
const add = (a, b) => [a[0] + b[0], a[1] + b[1], a[2] + b[2]];
const sub = (a, b) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
const mul = (a, s) => [a[0] * s, a[1] * s, a[2] * s];
const dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
const len = (a) => Math.hypot(a[0], a[1], a[2]);
const unit = (a) => mul(a, 1 / (len(a) || 1));
const lerp3 = (a, b, t) => add(a, mul(sub(b, a), t));
const keep = (c, size) => ({ c, keep: true, size });
const clamp01 = (x) => (x < 0 ? 0 : x > 1 ? 1 : x);
const ease = (x) => {
  const t = clamp01(x);
  return t * t * (3 - 2 * t);
};
// 0 before a, rising to 1 at b.
const band = (x, a, b) => clamp01((x - a) / (b - a));
// Rises from a to b, holds, falls from c to d.
const bump = (x, a, b, c, d) => band(x, a, b) * (1 - band(x, c, d));
// Seconds since the tap for a pulse control that lasts `secs` (-1 at rest).
const since = (v, secs) => (v > 0 ? secs * (1 - v) : -1);

const LIGHT = unit([0.35, 0.8, 0.55]);
const HALF = unit(add(LIGHT, [0, 0, 1]));
function lit(col, n, { amb = 0.62, dif = 0.45, spec = 0.25, pow = 28 } = {}) {
  const l = Math.max(0, dot(n, LIGHT));
  let c = shade(col, amb + dif * l);
  if (spec > 0) c = mix(c, [1, 1, 1], spec * Math.pow(Math.max(0, dot(n, HALF)), pow));
  return c;
}

// ---- The board ---------------------------------------------------------------------

const BOARD = "#141b2b";
const BOARD_RIM = "#2a3550";

// A dark display board in the XY plane, its face at z = 0, with a faint grid
// and a lighter rim, so the glowing parts read against it on any background.
function board(k, w, h, { depth = 0.07, color = BOARD, rim = BOARD_RIM } = {}) {
  k.add(k.box(w, h, depth), {
    pos: [0, 0, -depth / 2],
    flat: 0.3,
    size: 1.25,
    jitter: 0.008,
    color: (c) => {
      const [x, y] = c.p;
      const edge = Math.min(w / 2 - Math.abs(x), h / 2 - Math.abs(y));
      if (c.s.face !== 4) return lit(shade(rim, 0.8), c.n, { amb: 0.7, dif: 0.3, spec: 0 });
      if (edge < 0.035) return lit(rim, c.n, { amb: 0.8, dif: 0.3, spec: 0.1 });
      // A soft light from the top, so the board reads as a lit panel.
      return mix(color, shade(color, 1.35), clamp01(0.5 + y / h));
    },
  });
}

// ---- Wires and pulses --------------------------------------------------------------

// A polyline as a curve of t (0..1), measured by length.
function polyline(pts) {
  const cum = [0];
  for (let i = 1; i < pts.length; i++) cum.push(cum[i - 1] + len(sub(pts[i], pts[i - 1])));
  const L = cum[cum.length - 1] || 1;
  const at = (t) => {
    const d = clamp(t, 0, 1) * L;
    let i = 1;
    while (i < pts.length - 1 && cum[i] < d) i++;
    const f = (d - cum[i - 1]) / (cum[i] - cum[i - 1] || 1);
    return lerp3(pts[i - 1], pts[i], clamp(f, 0, 1));
  };
  at.L = L;
  return at;
}

// A wire along a polyline. Its thickness can change by a morph: `to` is the
// radius it swells (or thins) to as `channel` goes to 1.
function wire(k, pts, r, { color = "#5b6b8c", to, channel = 0, part, weight = 1.4 } = {}) {
  const curve = polyline(pts);
  const opts = {
    flat: to ? 0.5 : 0.3,
    weight,
    even: true,
    jitter: 0.01,
    pattern: false,
    color: (c) => lit(color, c.n, { amb: 0.75, dif: 0.35, spec: 0.35 }),
  };
  if (part !== undefined) opts.part = part;
  if (to !== undefined) {
    // Each splat moves straight out from (or in towards) the wire's centre
    // line.
    opts.channel = channel;
    opts.to = (c) => {
      const mid = curve(c.t);
      return add(mid, mul(sub(c.p, mid), to / r));
    };
  }
  k.add(k.tube(curve, r, { grid: 48 }), opts);
  return curve;
}

// A glowing bead of light (a token, hidden at rest), built at `p`: a white
// hot core in a coloured halo.
function bead(k, p, r, color, token) {
  k.add(k.sphere(r * 0.6), {
    pos: p,
    flat: 0.5,
    weight: 3,
    pattern: false,
    kind: "token",
    params: [token, 0],
    color: () => keep(mix(color, "#ffffff", 0.7)),
  });
  k.add(k.sphere(r), {
    pos: add(p, [0, 0, 0.004]),
    flat: 0.6,
    weight: 1.2,
    size: 1.6,
    opacity: 0.45,
    pattern: false,
    kind: "token",
    params: [token, 0],
    color: () => keep(color),
  });
}

// A lamp: a dim glass dome on the board, with a bright copy over it that a
// part, a token or a fade channel turns on.
function lamp(k, p, r, { off = "#2c3448", on = "#ffd34d", ...lightOpts } = {}) {
  k.add(k.sphere(r), {
    pos: p,
    scale: [1, 1, 0.55],
    even: true,
    flat: 0.3,
    weight: 1.5,
    pattern: false,
    color: (c) => lit(off, c.n, { amb: 0.7, dif: 0.35, spec: 0.6, pow: 18 }),
  });
  k.add(k.torus(r * 1.05, r * 0.12), {
    pos: add(p, [0, 0, 0.005]),
    rot: [90, 0, 0],
    even: true,
    weight: 1.5,
    flat: 0.3,
    pattern: false,
    color: (c) => lit("#8a95ad", c.n, { amb: 0.7, dif: 0.4, spec: 0.5 }),
  });
  lampLight(k, p, r, on, lightOpts);
}

// The bright light of a lamp (on its own, over a lamp or any other piece).
function lampLight(k, p, r, on, { part, token, channel, halo = true } = {}) {
  const ride = {};
  if (part !== undefined) ride.part = part;
  if (token !== undefined) Object.assign(ride, { kind: "token", params: [token, 0] });
  if (channel !== undefined) Object.assign(ride, { kind: "fade", params: [0, -0.5], channel });
  k.add(k.sphere(r * 1.02), {
    pos: add(p, [0, 0, 0.004]),
    scale: [1, 1, 0.6],
    flat: 0.35,
    weight: 1.5,
    pattern: false,
    ...ride,
    color: (c) => keep(mix(on, "#ffffff", 0.55 * Math.max(0, c.n[2]) ** 2)),
  });
  if (halo)
    k.add(k.disc(r * 1.7, r * 0.9), {
      pos: add(p, [0, 0, 0.002]),
      rot: [90, 0, 0],
      flat: 0.2,
      weight: 0.8,
      size: 1.5,
      opacity: 0.4,
      pattern: false,
      ...ride,
      color: (c) => keep(mix(on, BOARD, 0.25 + 0.6 * c.v)),
    });
}

// ---- Pixel-font signs ---------------------------------------------------------------

// The 5 x 7 font plus a few signs of our own.
const GLYPHS = {
  ...FONT,
  "+": "00000 00100 00100 11111 00100 00100 00000",
  "=": "00000 00000 11111 00000 11111 00000 00000",
  Σ: "11111 10000 01000 00100 01000 10000 11111",
  θ: "01110 10001 10001 11111 10001 10001 01110",
  "→": "00000 00100 00010 11111 00010 00100 00000",
  " ": "00000 00000 00000 00000 00000 00000 00000",
};
const BITS = Object.fromEntries(
  Object.entries(GLYPHS).map(([ch, rows]) => [ch, rows.split(" ").map((r) => parseInt(r, 2))]),
);
function inkAt(line, s, t) {
  if (s < 0 || t < 0 || t >= 7) return false;
  const col = Math.floor(s / 6);
  const gx = Math.floor(s - col * 6);
  const g = BITS[line[col]];
  if (!g || gx > 4) return false;
  return ((g[Math.floor(t)] >> (4 - gx)) & 1) === 1;
}
// The width of a line of text in font pixels.
const textWidth = (str) => str.length * 6 - 1;

// A line of text facing +Z, centred on `at`, `px` the size of one font pixel.
// Dense, keep-coloured splats, so it stays crisp at phone size.
function text(k, str, at, px, color, { weight = 7, align = "center", ...rest } = {}) {
  const W = textWidth(str) * px;
  const H = 7 * px;
  const x0 = align === "left" ? at[0] : align === "right" ? at[0] - W : at[0] - W / 2;
  const y0 = at[1] - H / 2;
  k.add(
    k.param((u, v) => [x0 + u * W, y0 + (1 - v) * H, at[2]], {
      grid: 48,
      normal: () => [0, 0, 1],
    }),
    {
      weight,
      flat: 0.2,
      pattern: false,
      ...rest,
      color: (c) => (inkAt(str, c.u * textWidth(str), c.v * 7) ? keep(color) : null),
    },
  );
  return { w: W, h: H };
}

// A small dark plate with a line of text on it.
function sign(k, str, at, px, { color = "#e8eefc", plate = "#0b1020", pad = 2.5, ...rest } = {}) {
  const W = (textWidth(str) + 2 * pad) * px;
  const H = (7 + 2 * pad) * px;
  k.add(k.box(W, H, px * 2), {
    pos: [at[0], at[1], at[2] - px],
    even: true,
    flat: 0.15,
    jitter: 0.005,
    pattern: false,
    ...rest,
    color: (c) => {
      const edge = Math.min(W / 2 - Math.abs(c.p[0] - at[0]), H / 2 - Math.abs(c.p[1] - at[1]));
      return keep(edge < px * 0.8 ? BOARD_RIM : plate);
    },
  });
  text(k, str, [at[0], at[1], at[2] + 0.002], px, color, rest);
}

// ---- Seven-segment digits -----------------------------------------------------------

// Segments a..g as [x0, y0, x1, y1] in a 1 x 2 box.
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

// A seven-segment digit of height h at p (its centre): dim segments always,
// and a lit copy of each on its own token (tokens from `token` to token + 6).
function sevenSeg(k, p, h, token, { on = "#ff5a4f", off = "#2a1c24" } = {}) {
  const w = h * 0.5;
  const th = h * 0.1;
  SEGS.forEach(([x0, y0, x1, y1], i) => {
    const a = [p[0] + (x0 - 0.5) * w, p[1] + (y0 - 1) * (h / 2), p[2]];
    const b = [p[0] + (x1 - 0.5) * w, p[1] + (y1 - 1) * (h / 2), p[2]];
    const horiz = y0 === y1;
    const L = len(sub(b, a)) - th * 0.9;
    const size = horiz ? [L, th, th * 0.5] : [th, L, th * 0.5];
    const mid = mul(add(a, b), 0.5);
    k.add(k.box(...size), { pos: mid, flat: 0.2, weight: 3, pattern: false, color: () => keep(off) }); // prettier-ignore
    k.add(k.box(size[0] * 1.08, size[1] * 1.04, size[2]), {
      pos: add(mid, [0, 0, th * 0.4]),
      flat: 0.2,
      weight: 3,
      pattern: false,
      kind: "token",
      params: [token + i, 0],
      color: () => keep(mix(on, "#ffffff", 0.25)),
    });
  });
}

// Shows digit d (or nothing for -1) on the seven-segment tokens from `token`.
function showDigit(tokens, token, d) {
  const lit = d >= 0 ? DIGIT_SEGS[d] : "";
  for (let i = 0; i < 7; i++) tokens[token + i] = { visible: lit.includes("abcdefg"[i]) ? 1 : 0 };
}

// ---- Recipes -------------------------------------------------------------------------

// The perceptron's inputs, weights before and after it learns, and threshold.
const PERC = {
  inputs: [1, 0, 1],
  before: [0.2, 0.8, 0.15],
  after: [0.7, 0.8, 0.65],
  theta: 1,
  max: 1.6,
};
const percRadius = (w) => 0.012 + 0.036 * w;
const percLevel = (w) => w.reduce((s, x, i) => s + x * PERC.inputs[i], 0) / PERC.max;

export const RECIPES = {
  perceptron: {
    controls: [{ key: "go", label: "Try", type: "pulse", ease: 4 }],
    action: { key: "go", label: "Try an example" },
    // Three inputs (1, 0, 1) send pulses along wires as thick as their
    // weights; the sum fills the gauge but stays under the threshold, so the
    // lamp flashes red. The two live wires thicken (it learns), the pulses
    // go again, the gauge passes the threshold and the lamp snaps on.
    drive(t, c, out) {
      const s = since(c.go, 4);
      const on = s >= 0;
      const P = [
        [-0.98, 0.5, 0],
        [-0.98, 0, 0],
        [-0.98, -0.5, 0],
      ];
      const node = [0.02, 0, 0];
      out.tokens = [];
      // Two rounds of pulses: at 0.3 s and at 2.1 s, 0.7 s along the wires.
      const travel = (x) => (x > 0 && x < 1 ? ease(x) : -1);
      P.forEach((p, i) => {
        const live = on && PERC.inputs[i] === 1;
        out.parts["in" + i] = { visible: live && s > 0.1 && s < 3.6 ? 1 : 0 };
        const f = live ? Math.max(travel((s - 0.3) / 0.7), travel((s - 2.1) / 0.7)) : -1;
        out.tokens[i] = f < 0 ? { visible: 0 } : { offset: mul(sub(node, p), f), visible: 1 };
      });
      // Learning: the live wires thicken between 1.6 s and 2.0 s, and ease
      // back at the end so the next tap starts from the same weights.
      const learn = on ? band(s, 1.6, 2.0) * (1 - band(s, 3.55, 3.95)) : 0;
      // The sum node flashes as the pulses arrive.
      const flash = on ? bump(s, 0.95, 1.05, 1.2, 1.5) + bump(s, 2.75, 2.85, 3.0, 3.3) : 0;
      // The gauge fills to the sum, drains, then fills past the threshold.
      const lv1 = percLevel(PERC.before);
      const lv2 = percLevel(PERC.after);
      let g = 0;
      if (on) {
        g = lv1 * ease(band(s, 1.0, 1.35)) * (1 - ease(band(s, 1.7, 2.05)));
        g += lv2 * ease(band(s, 2.8, 3.15)) * (1 - ease(band(s, 3.6, 3.95)));
      }
      out.grow = g;
      // The lamp: a red flash at 1.4 s (wrong), then on at 3.15 s.
      const wrong = on ? bump(s, 1.4, 1.45, 1.6, 1.8) : 0;
      const lampOn = on ? band(s, 3.15, 3.2) * (1 - band(s, 3.7, 3.8)) : 0;
      out.morph = [learn, flash, lampOn, wrong];
    },
    build(k) {
      board(k, 2.95, 1.75);
      const P = [
        [-0.98, 0.5, 0],
        [-0.98, 0, 0],
        [-0.98, -0.5, 0],
      ];
      const node = [0.02, 0, 0];
      const R = 0.11;
      const z = 0.04;
      // Wires, as thick as their weights; the live ones swell as it learns.
      P.forEach((p, i) => {
        const a = [p[0] + R * 0.9, p[1], z];
        const dir = unit(sub(node, p));
        const b = sub([node[0], node[1], z], mul(dir, 0.2));
        const r0 = percRadius(PERC.before[i]);
        const r1 = percRadius(PERC.after[i]);
        wire(k, [a, b], r0, r0 !== r1 ? { to: r1, channel: 0 } : {});
      });
      // Inputs: lamps that light for a 1, with their labels.
      P.forEach((p, i) => {
        const part = k.part("in" + i, { pivot: p });
        lamp(k, add(p, [0, 0, z]), R, { on: "#57e0ff", part });
        text(k, "X" + (i + 1), [p[0] - 0.32, p[1], 0.003], 0.02, "#9fb0d6");
        bead(k, add(p, [0, 0, z + 0.03]), 0.075, "#8af0ff", i);
      });
      // The sum node: a disc with a sigma, and a flash over it (channel 1).
      k.add(k.cylinder(0.2, 0.06), {
        pos: [node[0], node[1], 0.03],
        rot: [90, 0, 0],
        even: true,
        flat: 0.25,
        weight: 1.3,
        pattern: false,
        color: (c) => lit(c.s.cap ? "#27324d" : "#46557a", c.n, { amb: 0.75, dif: 0.3, spec: 0.3 }),
      });
      text(k, "Σ", [node[0], node[1], 0.064], 0.034, "#dfe8ff");
      k.add(k.disc(0.3, 0.18), {
        pos: [node[0], node[1], 0.066],
        rot: [90, 0, 0],
        flat: 0.2,
        size: 1.4,
        opacity: 0.6,
        pattern: false,
        kind: "fade",
        params: [0, -0.6],
        channel: 1,
        color: (c) => keep(mix("#bff4ff", "#57e0ff", c.v)),
      });
      // The gauge: a glass tube the sum fills (out.grow), with the threshold.
      const gx = 0.6;
      const gh = 1.0;
      const gw = 0.2;
      const g0 = -gh / 2;
      wire(k, [[node[0] + 0.2, 0, z], [gx - gw / 2 - 0.02, 0, z]], percRadius(0.6)); // prettier-ignore
      k.add(k.box(gw + 0.05, gh + 0.05, 0.03), {
        pos: [gx, 0, 0.015],
        even: true,
        flat: 0.2,
        pattern: false,
        color: (c) => {
          const inner = Math.abs(c.p[0] - gx) < gw / 2 && Math.abs(c.p[1]) < gh / 2;
          return keep(inner ? "#0a0f1c" : "#7c89a8");
        },
      });
      k.add(k.box(gw - 0.02, gh - 0.02, 0.02), {
        pos: [gx, 0, 0.04],
        flat: 0.2,
        weight: 1.2,
        pattern: false,
        kind: "grow",
        params: (c) => [clamp01((c.p[1] - g0) / gh) * 0.93, 0],
        color: (c) => keep(mix("#2fb6ff", "#8ff0ff", (c.p[1] - g0) / gh)),
      });
      const thY = g0 + (PERC.theta / PERC.max) * gh;
      k.add(k.box(gw + 0.12, 0.022, 0.02), {
        pos: [gx, thY, 0.06],
        flat: 0.2,
        weight: 3,
        pattern: false,
        color: () => keep("#ffb347"),
      });
      // The output lamp: red for a wrong answer (channel 3), gold when it
      // fires (channel 2).
      const out = [1.05, 0, 0];
      wire(k, [[gx + gw / 2 + 0.03, 0, z], [out[0] - 0.17, 0, z]], percRadius(0.6)); // prettier-ignore
      lamp(k, add(out, [0, 0, z]), 0.17, { on: "#ffd34d", channel: 2 });
      lampLight(k, add(out, [0, 0, z + 0.004]), 0.17, "#ff4d5e", { channel: 3 });
      text(k, "OUT", [out[0], 0.42, 0.003], 0.022, "#9fb0d6");
      text(k, "WANT 1", [out[0] + 0.07, -0.42, 0.003], 0.016, "#ffd34d");
      k.data = {};
    },
  },
};
