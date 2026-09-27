// AI and computing: kit-built models where you watch the data move. Each toy
// is a dark display board with glowing parts on it: pulses of light run
// along wires whose thickness shows their weight, layers light up in order,
// and counters and word signs are drawn in a pixel font. Loaded on demand.
//
// Shared pieces (below): the board, wires (whose thickness can change by a
// morph), glowing beads that travel as tokens, lamps, pixel-font signs and
// seven-segment digits.

import { mix, shade, clamp, ramp } from "../kit.js";
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
function board(k, w, h, { depth = 0.07, color = BOARD, rim = BOARD_RIM, at = [0, 0] } = {}) {
  k.add(k.box(w, h, depth), {
    pos: [at[0], at[1], -depth / 2],
    flat: 0.3,
    size: 1.25,
    jitter: 0.008,
    color: (c) => {
      const x = c.p[0] - at[0];
      const y = c.p[1] - at[1];
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
function text(k, str, at, px, color, { weight = 4, align = "center", ...rest } = {}) {
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

// A seven-segment digit of height h at p (its centre): each segment on its
// own token (tokens from `token` to token + 6), shown only when lit. Unlit
// segments are not drawn at all, so a counter never reads as a dim "8".
function sevenSeg(k, p, h, token, { on = "#ff5a4f" } = {}) {
  const w = h * 0.5;
  const th = h * 0.1;
  SEGS.forEach(([x0, y0, x1, y1], i) => {
    const a = [p[0] + (x0 - 0.5) * w, p[1] + (y0 - 1) * (h / 2), p[2]];
    const b = [p[0] + (x1 - 0.5) * w, p[1] + (y1 - 1) * (h / 2), p[2]];
    const horiz = y0 === y1;
    const L = len(sub(b, a)) - th * 0.9;
    const size = horiz ? [L, th, th * 0.5] : [th, L, th * 0.5];
    const mid = mul(add(a, b), 0.5);
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

// ---- Draw order ----------------------------------------------------------------------

// True once per step of `dt` seconds while s runs from `from` to `to`, and
// once more just after: pieces that travel across the board ask the player
// to sort them again where they are (out.resort; docs/PACKS.md 7b).
function resortSteps(self, key, s, from, to, dt) {
  const slot = s < from ? -1 : s > to ? -2 : Math.floor((s - from) / dt);
  const last = (self.lastSort ||= {})[key];
  self.lastSort[key] = slot;
  return last !== undefined && slot !== last && !(slot === -1 && last === -2);
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
// Where the inputs and the sum node sit, on the poster and in the 3D model.
const PERC2D = {
  P: [
    [-0.98, 0.5, 0],
    [-0.98, 0, 0],
    [-0.98, -0.5, 0],
  ],
  node: [0.02, 0, 0],
};
const PERC3D = {
  P: [
    [-0.98, 0.5, -0.3],
    [-0.98, 0, 0],
    [-0.98, -0.5, 0.3],
  ],
  node: [0.02, 0, 0],
};
const percRadius = (w) => 0.012 + 0.036 * w;
const percLevel = (w) => w.reduce((s, x, i) => s + x * PERC.inputs[i], 0) / PERC.max;

// The neural network: three layers (3, 4 and 2 neurons), its weights and a
// real forward pass (sigmoid), so each neuron glows as bright as it fires.
const MLP = (() => {
  const x = [0.9, 0.2, 0.75];
  const W1 = [
    [1.6, -0.8, 0.9],
    [-1.2, 1.4, -0.6],
    [0.7, 0.5, 1.8],
    [-0.4, -1.5, 1.1],
  ];
  const W2 = [
    [1.5, -1.1, 1.7, 0.6],
    [-1.3, 0.9, -1.4, -0.8],
  ];
  const sig = (v) => 1 / (1 + Math.exp(-v));
  const h = W1.map((row) => sig(row.reduce((s, w, j) => s + w * x[j], 0) - 0.6));
  const y = W2.map((row) => sig(row.reduce((s, w, j) => s + w * h[j], 0) - 0.8));
  const X = [-0.95, 0, 0.95];
  const ys = [
    [0.5, 0, -0.5],
    [0.6, 0.2, -0.2, -0.6],
    [0.3, -0.3],
  ];
  const acts = [x, h, y];
  const pos = ys.map((col, l) => col.map((yy) => [X[l], yy, 0]));
  // Wires: [layer, from, to, weight]; the backprop nudge per wire (+ or -).
  const wires = [];
  W1.forEach((row, i) => row.forEach((w, j) => wires.push({ l: 0, a: j, b: i, w })));
  W2.forEach((row, i) => row.forEach((w, j) => wires.push({ l: 1, a: j, b: i, w })));
  wires.forEach((wr, i) => {
    wr.p0 = pos[wr.l][wr.a];
    wr.p1 = pos[wr.l + 1][wr.b];
    wr.sig = acts[wr.l][wr.a] * Math.min(1, Math.abs(wr.w) / 1.8);
    wr.nudge = (i * 7) % 3 === 0 ? -1 : 1;
  });
  return { acts, pos, wires };
})();
const mlpRadius = (w) => 0.008 + 0.014 * Math.abs(w);
// The 3D model's neurons: each layer a ring (a triangle, a square, a pair)
// standing across the way the signal flows, and its wires between them.
const MLP3D = (() => {
  const X = [-1.05, 0, 1.05];
  const radius = { 2: 0.42, 3: 0.55, 4: 0.7 };
  // The flow runs toward the front right (turned 0.7 rad about the up axis),
  // so the rings are seen at a slant from the front.
  const turn = (p) => [p[0] * Math.cos(0.7) - p[2] * Math.sin(0.7), p[1], p[0] * Math.sin(0.7) + p[2] * Math.cos(0.7)]; // prettier-ignore
  const pos = MLP.acts.map((col, l) =>
    col.map((_, i) => {
      const n = col.length;
      const a = Math.PI / 2 + (i * TAU) / n + (n === 2 ? Math.PI / 2 : n === 4 ? Math.PI / 4 : 0);
      return turn([X[l], 0.25 + radius[n] * Math.sin(a), radius[n] * Math.cos(a)]);
    }),
  );
  const wires = MLP.wires.map((w) => ({ ...w, p0: pos[w.l][w.a], p1: pos[w.l + 1][w.b] }));
  // Where each layer's label stands: on the stand, in front of its ring.
  const foot = X.map((x) => add(turn([x, -0.55, 0]), [0, 0, 0.75]));
  return { pos, wires, foot };
})();
// The two views every model toy has: the flat poster and the 3D model.
const VIEW_OPTION = {
  key: "view",
  label: "View",
  type: "select",
  default: "poster",
  choices: [
    { id: "poster", label: "Poster (2D)" },
    { id: "model", label: "3D model" },
  ],
};
// A dark round stand under a 3D model, so its glowing parts read on any
// background.
function stand(k, r, y, { color = BOARD } = {}) {
  k.add(k.cylinder(r, 0.08), {
    pos: [0, y - 0.04, 0],
    even: true,
    flat: 0.25,
    color: (c) => {
      if (c.s.cap && c.n[1] > 0) {
        const d = Math.hypot(c.p[0], c.p[2]);
        return keep(
          d > r - 0.05 ? BOARD_RIM : mix(color, shade(color, 1.35), 0.5 + 0.5 * (1 - d / r)),
        );
      }
      return lit(BOARD_RIM, c.n, { amb: 0.75, dif: 0.3, spec: 0.1 });
    },
  });
}

// The convolutional network: a handwritten 7 (7 x 7 pixels), one 3 x 3
// filter that finds strokes running down to the left, the feature map it
// stamps (5 x 5, after ReLU), 2 x 2 max pooling (3 x 3) and the scores for
// the digits 0 to 9.
const CNN = (() => {
  const img = ["0111111", "0000021", "0000120", "0001200", "0012000", "0021000", "0010000"].map(
    (r) => [...r].map((ch) => Number(ch) / 2),
  );
  // Brighter where the picture lies along the down-left diagonal.
  const F = [
    [-0.5, -0.5, 1],
    [-0.5, 1, -0.5],
    [1, -0.5, -0.5],
  ];
  const feat = [];
  for (let r = 0; r < 5; r++)
    for (let c = 0; c < 5; c++) {
      let v = 0;
      for (let i = 0; i < 3; i++) for (let j = 0; j < 3; j++) v += F[i][j] * img[r + i][c + j];
      feat.push(Math.max(0, v));
    }
  const top = Math.max(...feat);
  const fmap = feat.map((v) => v / top);
  const pool = [];
  for (let r = 0; r < 3; r++)
    for (let c = 0; c < 3; c++) {
      let m = 0;
      for (let i = 2 * r; i < Math.min(5, 2 * r + 2); i++)
        for (let j = 2 * c; j < Math.min(5, 2 * c + 2); j++) m = Math.max(m, fmap[i * 5 + j]);
      pool.push(m);
    }
  const scores = [0.08, 0.3, 0.14, 0.22, 0.12, 0.09, 0.06, 1, 0.18, 0.34];
  return { img, fmap, pool, scores };
})();
// Where the grids sit on the board, and their cell sizes.
const CNN_AT = {
  img: [-0.98, 0.3],
  feat: [0.06, 0.3],
  pool: [0.98, 0.3],
  cell: 0.13,
  pcell: 0.17,
  bars: -0.88,
  barH: 0.62,
};
// The centre of cell (r, c) of an n x n grid centred at g.
const cellAt = (g, n, cell, r, c) => [g[0] + (c - (n - 1) / 2) * cell, g[1] - (r - (n - 1) / 2) * cell, g[2] ?? 0]; // prettier-ignore
// The 3D model: the maps are slabs of little cubes standing one behind
// another (the picture in front, the feature map behind it, the pooled map
// behind that), over the scores' columns on a stand.
const CNN_AT3D = {
  img: [-0.95, 0.35, 0.4],
  feat: [0.1, 0.35, 0],
  pool: [0.95, 0.35, -0.4],
  cell: 0.13,
  pcell: 0.17,
  floor: -0.78,
  barZ: 0.62,
  barH: 0.5,
};
const featColor = (v) => mix("#16305a", "#7ff6ff", Math.pow(v, 0.8));

// The recurrent network: three words go into the cell one at a time, and
// the hidden state (an orb) comes out, loops back round and goes in again
// with each one, its colour mixing in each word's colour.
const RNN = (() => {
  const words = ["THE", "CAT", "SAT"];
  const wordColors = ["#36d6c3", "#a66bff", "#ff9a3c"];
  const orbColors = ["#7f8aa8"];
  wordColors.forEach((c, i) => orbColors.push(mix(orbColors[i], c, i === 0 ? 0.9 : 0.55)));
  // The cell, the orb's home and the loop above it (an arc of an ellipse).
  const cell = { c: [0, 0.05], w: 0.84, h: 0.56 };
  const orbY = 0.13;
  const loop = { c: [0, 0.36], rx: 0.72, ry: 0.5, a0: -0.42, a1: Math.PI + 0.42 };
  const arc = (a) => [loop.c[0] + loop.rx * Math.cos(a), loop.c[1] + loop.ry * Math.sin(a), 0];
  const zOrb = 0.2;
  // The orb's path: out of the cell's right side, round the loop, and back
  // in from the left to the middle (t 0..1).
  const pts = [[0, orbY, zOrb]];
  const right = arc(loop.a0);
  pts.push([right[0], orbY, zOrb]);
  for (let i = 0; i <= 40; i++) {
    const p = arc(loop.a0 + ((loop.a1 - loop.a0) * i) / 40);
    pts.push([p[0], p[1], zOrb]);
  }
  pts.push([-right[0], orbY, zOrb], [0, orbY, zOrb]);
  const path = polyline(pts);
  const slots = [-0.62, 0, 0.62].map((x) => [x, -0.62, 0]);
  const entry = [0, cell.c[1] - cell.h / 2 + 0.02, 0];
  // Each word's way in: up out of the row, then across and into the cell.
  const feed = slots.map((p) => polyline([p, [p[0], -0.32, 0], entry]));
  return { words, wordColors, orbColors, cell, orbY, loop, arc, path, slots, entry, feed, zOrb };
})();
const RNN_STEP = 1.2;

// The LSTM's three gates on the cell's face, and their slats' centres.
const RNN_GATES = [
  { label: "F", color: "#ff6b8a" },
  { label: "I", color: "#6be38f" },
  { label: "O", color: "#ffd34d" },
].map((g, i) => {
  const c = [(i - 1) * 0.27, -0.075, 0];
  return { ...g, c, slats: [0.06, 0, -0.06].map((dy) => [c[0], c[1] + dy, 0.16]) };
});
const quatX = (a) => [Math.sin(a / 2), 0, 0, Math.cos(a / 2)];
// The 3D model: a glass cell on a stand, the loop arching over it on a
// slant (turned 0.7 rad about the up axis, so it runs from back right to
// front left), and the words in front, rising up into the cell from below.
const RNN3D = (() => {
  const a = 0.7;
  const turn = (x, y) => [x * Math.cos(a), y, -x * Math.sin(a)];
  const cell = { c: [0, 0.05, 0], w: 0.84, h: 0.56, d: 0.5 };
  const orbY = 0.13;
  const { loop } = RNN;
  const arc = (t) => turn(loop.c[0] + loop.rx * Math.cos(t), loop.c[1] + loop.ry * Math.sin(t));
  const right = loop.c[0] + loop.rx * Math.cos(loop.a0);
  // The orb waits just in front of the cell's face.
  const home = [0, orbY, cell.d / 2 + 0.13];
  const pts = [home, turn(right, orbY)];
  for (let i = 0; i <= 40; i++) pts.push(arc(loop.a0 + ((loop.a1 - loop.a0) * i) / 40));
  pts.push(turn(-right, orbY), home);
  const path = polyline(pts);
  const track = pts.slice(1, -1);
  const slots = [-0.62, 0, 0.62].map((x) => [x, -0.46, 0.66]);
  const entry = [0, cell.c[1] - cell.h / 2 + 0.02, 0];
  const feed = slots.map((p) => polyline([p, [p[0], -0.36, p[2]], [0, -0.36, 0], entry]));
  const gates = RNN_GATES.map((g) => ({
    ...g,
    c: [g.c[0], g.c[1], cell.d / 2 + 0.01],
    slats: g.slats.map((b) => [b[0], b[1], cell.d / 2 + 0.02]),
  }));
  return { cell, orbY, path, track, slots, entry, feed, gates };
})();

// The transformer: four word tiles, two layers (attention, then a
// feed-forward block), two attention heads a layer, and the next word.
const TF = (() => {
  const words = ["THE", "CAT", "SAT", "ON"];
  const next = "MAT";
  const xs = [-1.04, -0.52, 0, 0.52, 1.04];
  const row = -0.85;
  const levels = [row, 0.12, 1.1];
  const ffn = [-0.25, 0.72];
  // Attention arcs a layer: [from, to, weight] for head A and head B.
  const heads = [
    [
      [
        [1, 0, 0.9],
        [2, 1, 0.8],
        [3, 2, 0.55],
        [3, 0, 0.25],
      ],
      [
        [2, 0, 0.5],
        [3, 1, 0.75],
        [1, 3, 0.3],
      ],
    ],
    [
      [
        [0, 2, 0.45],
        [3, 1, 0.9],
        [2, 3, 0.35],
      ],
      [
        [1, 2, 0.8],
        [0, 3, 0.6],
        [2, 0, 0.3],
      ],
    ],
  ];
  return { words, next, xs, row, levels, ffn, heads };
})();
const TF_HEADS = ["#4fe3ff", "#ff5ad1"];
const TF_TILE = [0.42, 0.22];

// A word tile: a dark block with a coloured rim and its word, on a token.
function wordTile(k, word, p, color, token, { w = TF_TILE[0], h = TF_TILE[1], px = 0.02 } = {}) {
  const ride = token === undefined ? {} : { kind: "token", params: [token, 0] };
  k.add(k.box(w, h, 0.05), {
    pos: p,
    flat: 0.2,
    weight: 1.5,
    pattern: false,
    ...ride,
    color: (c) => {
      const edge = Math.min(w / 2 - Math.abs(c.p[0] - p[0]), h / 2 - Math.abs(c.p[1] - p[1]));
      return keep(edge < 0.014 ? color : "#10172a");
    },
  });
  if (word) text(k, word, add(p, [0, 0, 0.028]), px, color, ride);
}

// The looped transformer: one block with a track looping through it. Five
// tiles ride round the loop three times; each time a tile passes through
// the block, its mark resolves one step: noise, a coarse mosaic, nearly
// right, then exact.
const LOOP = (() => {
  const marks = ["3", "+", "4", "=", "7"];
  const tile = 0.22;
  const gap = 0.26;
  const half = 0.62; // half the straight's length
  const r = 0.42; // the bends' radius
  const P = 4 * half + 2 * Math.PI * r;
  // A point at distance d along the loop: along the bottom to the right,
  // up round the right bend, left along the top, down round the left bend.
  const at = (d) => {
    let x = ((d % P) + P) % P;
    const S = 2 * half;
    const B = Math.PI * r;
    if (x < S) return [-half + x, -r, 0];
    x -= S;
    if (x < B) {
      const a = -Math.PI / 2 + x / r;
      return [half + r * Math.cos(a), r * Math.sin(a), 0];
    }
    x -= B;
    if (x < S) return [half - x, r, 0];
    x -= S;
    const a = Math.PI / 2 + x / r;
    return [-half + r * Math.cos(a), r * Math.sin(a), 0];
  };
  const start = half - ((marks.length - 1) * gap) / 2; // the first tile's place
  const rest = marks.map((_, i) => start + i * gap);
  const block = 2 * half + Math.PI * r + half; // the top straight's middle
  // Each mark at four levels: pixel strengths on the 5 x 7 grid.
  let seed = 7;
  const rnd = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
  const levels = marks.map((m, i) => {
    const g = GLYPHS[m].split(" ").map((row) => [...row].map(Number));
    const exact = g.map((row) => row.slice());
    const near = g.map((row) => row.slice());
    for (let n = 0; n < 3; n++) {
      const y = Math.floor(rnd() * 7);
      const x = Math.floor(rnd() * 5);
      near[y][x] = near[y][x] ? 0.35 : 0.5;
    }
    const coarse = g.map((row, y) =>
      row.map((_, x) => {
        const bx = x - (x % 2);
        const by = y - (y % 2);
        let s = 0;
        let n = 0;
        for (let yy = by; yy < Math.min(7, by + 2); yy++)
          for (let xx = bx; xx < Math.min(5, bx + 2); xx++) {
            s += g[yy][xx];
            n++;
          }
        return s / n;
      }),
    );
    const noise = g.map((row) => row.map((v) => clamp01(0.25 * v + 0.9 * rnd() - 0.2)));
    return [noise, coarse, near, exact];
  });
  return { marks, tile, gap, half, r, P, at, rest, block, levels };
})();

// The diffusion model: a small rubber duck (ellipsoids) whose splats rest
// as a cloud of random specks. Each denoising step moves every speck part of
// the way to its place on the duck (a morph on channel 0) and clears some of
// the loose coloured specks (a fade on channel 1), while the counter runs
// down from 50 to 0.
const DUCK = [
  // [centre, radii, colour]
  [[0, 0, 0], [0.62, 0.36, 0.46], "#ffd21f"],
  [[0.22, 0.04, 0], [0.4, 0.34, 0.42], "#ffd21f"],
  [[0.3, 0.56, 0], [0.28, 0.28, 0.28], "#ffd21f"],
  [[-0.5, 0.2, 0], [0.24, 0.14, 0.17], "#ffc414"],
  [[0.58, 0.49, 0], [0.19, 0.06, 0.15], "#ff8a1c"],
  [[0.55, 0.43, 0], [0.15, 0.04, 0.12], "#e67512"],
];
const DUCK_EYES = [-1, 1].map((sd) => add([0.3, 0.56, 0], mul(unit([0.55, 0.4, sd * 0.62]), 0.27)));
const DIFF = { steps: 10, t0: 0.2, dt: 0.3, turn: -0.5, scale: 0.62, c: [0, 0.18, 0.45] };
// Recipe coordinates of a point on the duck (turned to three-quarters).
function duckPlace(p, g = DIFF) {
  const a = DIFF.turn;
  const x = p[0] * Math.cos(a) + p[2] * Math.sin(a);
  const z = -p[0] * Math.sin(a) + p[2] * Math.cos(a);
  return add(g.c, mul([x - 0.05, p[1] - 0.12, z], g.scale));
}
// The 3D model's duck: bigger, floating over a stand, in a round cloud.
const DIFF3D = { c: [0, 0.12, 0], scale: 0.85, spread: [0.42, 0.36, 0.42] };
// The denoising progress after `s` seconds: a quick move at each step, then
// a hold (0 at 50 steps to go, 1 at 0).
function diffStep(s) {
  const k = (s - DIFF.t0) / DIFF.dt;
  if (k < 0) return { w: 0, n: 0 };
  const i = Math.min(DIFF.steps, Math.floor(k) + 1);
  const f = i >= DIFF.steps && k >= DIFF.steps ? 1 : ease(clamp01((k - (i - 1)) / 0.45));
  const at = (j) => 1 - Math.pow(1 - j / DIFF.steps, 1.6);
  return { w: at(i - 1) + (at(i) - at(i - 1)) * f, n: i };
}

// Gradient descent: a hilly loss landscape (a slope down to a deep valley,
// with a trough across it) and the steps of gradient descent with momentum
// from a hillside, for three learning rates. Each step is a hop of the ball.
const GD = (() => {
  const h = (x) => 0.5 * (x - 0.3) ** 2 - 0.3 * Math.exp(-((x - 0.3) ** 2) / 0.04) + 0.05 * Math.sin(5 * x); // prettier-ignore
  const f = (x, z) => h(x) + 0.7 * z * z;
  const grad = (x, z) => {
    const e = 1e-4;
    return [(f(x + e, z) - f(x - e, z)) / (2 * e), (f(x, z + e) - f(x, z - e)) / (2 * e)];
  };
  const H = 0.62; // height per unit of loss
  const R = 0.085; // the ball's radius
  const rates = { low: [0.035, 0.3], good: [0.17, 0.5], high: [0.95, 0] };
  const paths = {};
  for (const [key, [eta, beta]] of Object.entries(rates)) {
    let x = -0.85;
    let z = 0.45;
    let vx = 0;
    let vz = 0;
    const pts = [];
    for (let i = 0; i < 22; i++) {
      pts.push([x, f(x, z) * H + R, z]);
      const [gx, gz] = grad(x, z);
      vx = beta * vx - eta * gx;
      vz = beta * vz - eta * gz;
      x = clamp(x + vx, -0.95, 0.95);
      z = clamp(z + vz, -0.95, 0.95);
    }
    paths[key] = pts;
  }
  return { f, H, R, paths, t0: 0.3, dt: 0.165 };
})();

// Word vectors: real word embeddings (GloVe, 50 dimensions, built into
// assets/toys/word-vectors/words.txt by tools/word-vectors.mjs). A − B + C
// is worked out over all 50 dimensions, and the nearest of the 10,000 most
// common words (leaving out A, B and C) is the answer. The toy shows a 3-D
// slice through the words: two axes along A − B and C − B, so the
// parallelogram of arrows is exact, and the third along the step from the
// sum to the answer, so the answer's true distance from the sum shows.
const WV_SHOWN = { label: "king − man + woman ≈ queen" };
const WORDS = { list: null, vec: null, index: null, common: 10000, dims: 50 };
async function readAsset(rel) {
  const url = new URL(rel, import.meta.url);
  if (url.protocol === "file:") {
    const fs = await import("node:fs/promises");
    return fs.readFile(url, "utf8");
  }
  const r = await fetch(url);
  if (!r.ok) throw new Error(`Could not load ${rel.split("/").pop()}.`);
  return r.text();
}
async function loadWords() {
  if (WORDS.list) return;
  const [line, data] = (await readAsset("../../assets/toys/word-vectors/words.txt")).split("\n");
  const bin = atob(data.trim());
  const vec = new Float32Array(bin.length);
  for (let i = 0; i < bin.length; i++) vec[i] = ((bin.charCodeAt(i) << 24) >> 24) / 127;
  WORDS.list = line.trim().split(" ");
  WORDS.index = new Map(WORDS.list.map((w, i) => [w, i]));
  WORDS.vec = vec;
}
const wordVec = (i) => Array.from(WORDS.vec.subarray(i * WORDS.dims, (i + 1) * WORDS.dims));
const nsub = (a, b) => a.map((x, i) => x - b[i]);
const nadd = (a, b) => a.map((x, i) => x + b[i]);
const ndot = (a, b) => a.reduce((s, x, i) => s + x * b[i], 0);
const nunit = (a) => {
  const l = Math.sqrt(ndot(a, a)) || 1;
  return a.map((x) => x / l);
};
// The words of a typed sum: "king - man + woman", "king man woman" or
// "king minus man plus woman".
function parseSum(text) {
  const words = String(text || "")
    .toLowerCase()
    .replace(/\b(minus|plus)\b|[-+−=,]/g, " ")
    .split(/\s+/)
    .filter(Boolean);
  if (words.length !== 3) throw new Error("Type three words, like: king - man + woman.");
  for (const w of words)
    if (!WORDS.index.has(w))
      throw new Error(`"${w}" is not one of the 24,000 words it knows. Try a more common word.`);
  if (new Set(words).size < 3) throw new Error("Use three different words.");
  return words;
}
// A − B + C: the sum, the answer (nearest common word by cosine) and the
// runner-up.
function analogy(a, b, c) {
  const [va, vb, vc] = [a, b, c].map((w) => wordVec(WORDS.index.get(w)));
  const r = nunit(nadd(nsub(va, vb), vc));
  const best = [];
  const n = Math.min(WORDS.common, WORDS.list.length);
  for (let i = 0; i < n; i++) {
    const w = WORDS.list[i];
    if (w === a || w === b || w === c) continue;
    const s = ndot(r, WORDS.vec.subarray(i * WORDS.dims, (i + 1) * WORDS.dims));
    if (best.length < 2 || s > best[1][0]) {
      best.push([s, w]);
      best.sort((p, q) => q[0] - p[0]);
      best.length = Math.min(2, best.length);
    }
  }
  return { answer: best[0][1], score: best[0][0], runner: best[1][1] };
}
// Scene places for the words: B at the origin of the slice, the slice's
// axes turned so the default (king, man, woman) looks as it always has.
function wvLayout(a, b, c) {
  const { answer, runner } = analogy(a, b, c);
  const V = Object.fromEntries([a, b, c, answer, runner].map((w) => [w, wordVec(WORDS.index.get(w))])); // prettier-ignore
  const sum = nadd(nsub(V[a], V[b]), V[c]);
  // The slice: u1 along A − B, u2 along C − B, u3 along answer − sum.
  const u1 = nunit(nsub(V[a], V[b]));
  const cb = nsub(V[c], V[b]);
  const u2 = nunit(
    nsub(
      cb,
      u1.map((x) => x * ndot(cb, u1)),
    ),
  );
  let off = nsub(V[answer], sum);
  off = nsub(
    off,
    u1.map((x) => x * ndot(off, u1)),
  );
  off = nsub(
    off,
    u2.map((x) => x * ndot(off, u2)),
  );
  const u3 = nunit(off);
  const slice = (v) => {
    const d = nsub(v, V[b]);
    return [ndot(d, u1), ndot(d, u2), ndot(d, u3)];
  };
  const e1 = unit([0.45, 0.54, 0.08]);
  const e2 = unit(sub([0.8, 0.06, -0.52], mul(e1, dot([0.8, 0.06, -0.52], e1))));
  const e3 = [e1[1] * e2[2] - e1[2] * e2[1], e1[2] * e2[0] - e1[0] * e2[2], e1[0] * e2[1] - e1[1] * e2[0]]; // prettier-ignore
  // Each axis is scaled to fit (a linear map, so the parallelogram stays
  // exact): A − B and C − B come out the same length.
  const qa = slice(V[a]);
  const qc = slice(V[c]);
  const sa = Math.abs(qa[0]) || 1;
  const sc = Math.hypot(qc[0] / sa, qc[1]) > 1e-6 ? Math.abs(qc[1]) || 1 : 1;
  const map = (q) => add(add(mul(e1, q[0] / sa), mul(e2, q[1] / sc)), mul(e3, q[2] / sc));
  const raw = {};
  for (const [key, w] of [
    ["a", a],
    ["b", b],
    ["c", c],
  ])
    raw[key] = map(slice(V[w]));
  raw.sum = add(raw.a, sub(raw.c, raw.b));
  // The answer and the runner-up sit off the sum by their true offset from
  // it, measured on A − B's scale (the same on every axis).
  const qs = slice(sum);
  for (const [key, w] of [
    ["answer", answer],
    ["runner", runner],
  ]) {
    const d = nsub(slice(V[w]), qs).map((x) => x / sa);
    raw[key] = add(raw.sum, add(add(mul(e1, d[0]), mul(e2, d[1])), mul(e3, d[2])));
  }
  const s = 1.0;
  const pts = Object.values(raw);
  const lo = [0, 1, 2].map((i) => Math.min(...pts.map((p) => p[i])));
  const hi = [0, 1, 2].map((i) => Math.max(...pts.map((p) => p[i])));
  const mid = [(lo[0] + hi[0]) / 2, lo[1] + 0.35, (lo[2] + hi[2]) / 2];
  const place = (p) => add(sub(mul(p, s), mid), [0, -0.1, 0]);
  const at = Object.fromEntries(Object.entries(raw).map(([k, p]) => [k, place(p)]));
  const words = { a, b, c, answer, runner };
  const span = [hi[0] - lo[0], hi[2] - lo[2]];
  return { at, words, floor: -0.45, span };
}

// An arrow from a to b (a tube and a cone), drawn from a to b as its
// channel rises.
function arrow(k, a, b, r, color, channel) {
  const d = sub(b, a);
  const L = len(d);
  const dir = mul(d, 1 / L);
  const head = Math.min(0.1, L * 0.3);
  const tip = sub(b, mul(dir, head));
  const opts = { flat: 0.4, weight: 2.2, pattern: false, kind: "fade", channel };
  k.add(
    k.tube((t) => lerp3(a, tip, t), r, { grid: 32 }),
    {
      ...opts,
      params: (c) => [c.t * 0.8 * (1 - head / L), -0.06],
      color: (c) => keep(mix(color, "#ffffff", 0.35 * Math.max(0, c.n[1]))),
    },
  );
  k.add(k.cone(r * 2.6, 0, head), {
    quat: quatFromY(dir),
    pos: add(tip, mul(dir, head / 2)),
    ...opts,
    params: [0.8, -0.1],
    color: () => keep(color),
  });
}
// The rotation taking +Y to the unit direction d.
function quatFromY(d) {
  const c = [d[2], 0, -d[0]];
  const w = 1 + d[1];
  if (w < 1e-6) return [1, 0, 0, 0];
  const l = Math.hypot(c[0], c[2], w);
  return [c[0] / l, 0, c[2] / l, w / l];
}

// The sorting machine: eight bars (heights 1 to 8), shuffled, and the
// arrangements each algorithm passes through. Bubble sort and quicksort
// swap two bars at a time; merge sort merges runs, moving one bar at a time
// into place while the rest shift over.
const SORT = (() => {
  const start = [5, 2, 7, 0, 6, 3, 1, 4];
  const steps = {};
  // Bubble sort: every swap.
  {
    const a = start.slice();
    const out = [];
    for (let n = a.length; n > 1; n--)
      for (let i = 0; i < n - 1; i++)
        if (a[i] > a[i + 1]) {
          [a[i], a[i + 1]] = [a[i + 1], a[i]];
          out.push(a.slice());
        }
    steps.bubble = out;
  }
  // Quicksort (Lomuto partition, last bar as pivot): every real swap.
  {
    const a = start.slice();
    const out = [];
    const swap = (i, j) => {
      if (i === j) return;
      [a[i], a[j]] = [a[j], a[i]];
      out.push(a.slice());
    };
    const qs = (lo, hi) => {
      if (lo >= hi) return;
      const p = a[hi];
      let i = lo;
      for (let j = lo; j < hi; j++) if (a[j] < p) swap(i++, j);
      swap(i, hi);
      qs(lo, i - 1);
      qs(i + 1, hi);
    };
    qs(0, a.length - 1);
    steps.quick = out;
  }
  // The swap sorts: each records the arrangement after every swap.
  const swaps = (sort) => {
    const a = start.slice();
    const out = [];
    const swap = (i, j) => {
      if (i === j) return;
      [a[i], a[j]] = [a[j], a[i]];
      out.push(a.slice());
    };
    sort(a, swap);
    return out;
  };
  // Insertion sort: each bar swaps down past the bigger ones before it.
  steps.insertion = swaps((a, swap) => {
    for (let i = 1; i < a.length; i++)
      for (let j = i; j > 0 && a[j - 1] > a[j]; j--) swap(j - 1, j);
  });
  // Selection sort: the smallest bar left swaps to the front.
  steps.selection = swaps((a, swap) => {
    for (let i = 0; i < a.length - 1; i++) {
      let m = i;
      for (let j = i + 1; j < a.length; j++) if (a[j] < a[m]) m = j;
      swap(i, m);
    }
  });
  // Cocktail shaker sort: bubble sort passes left to right, then back.
  steps.cocktail = swaps((a, swap) => {
    let lo = 0;
    let hi = a.length - 1;
    while (lo < hi) {
      for (let i = lo; i < hi; i++) if (a[i] > a[i + 1]) swap(i, i + 1);
      hi--;
      for (let i = hi; i > lo; i--) if (a[i - 1] > a[i]) swap(i - 1, i);
      lo++;
    }
  });
  // Shell sort (gaps 4, 2, 1): insertion sort over bars a gap apart.
  steps.shell = swaps((a, swap) => {
    for (const gap of [4, 2, 1])
      for (let i = gap; i < a.length; i++)
        for (let j = i; j >= gap && a[j - gap] > a[j]; j -= gap) swap(j - gap, j);
  });
  // Heap sort: build a max-heap, then swap the top to the end and sift.
  steps.heap = swaps((a, swap) => {
    const sift = (i, n) => {
      for (;;) {
        let m = i;
        const l = 2 * i + 1;
        const r = l + 1;
        if (l < n && a[l] > a[m]) m = l;
        if (r < n && a[r] > a[m]) m = r;
        if (m === i) return;
        swap(i, m);
        i = m;
      }
    };
    for (let i = Math.floor(a.length / 2) - 1; i >= 0; i--) sift(i, a.length);
    for (let n = a.length - 1; n > 0; n--) {
      swap(0, n);
      sift(0, n);
    }
  });
  // Merge sort (bottom up, in place): each bar taken from the right run
  // ahead of the left run's bars is one move.
  {
    const a = start.slice();
    const out = [];
    for (let w = 1; w < a.length; w *= 2)
      for (let lo = 0; lo < a.length; lo += 2 * w) {
        let i = lo;
        let mid = Math.min(lo + w, a.length);
        const hi = Math.min(lo + 2 * w, a.length);
        while (i < mid && mid < hi) {
          if (a[i] <= a[mid]) i++;
          else {
            const v = a[mid];
            a.splice(mid, 1);
            a.splice(i, 0, v);
            out.push(a.slice());
            i++;
            mid++;
          }
        }
      }
    steps.merge = out;
  }
  const colors = ["#e8413c", "#f07a2c", "#f5b72a", "#b8d63a", "#46c46a", "#2fb3c9", "#3d78e0", "#8a55d9"]; // prettier-ignore
  const x = (slot) => (slot - 3.5) * 0.24;
  const height = (v) => 0.2 + v * 0.13;
  const names = {
    bubble: "BUBBLE SORT",
    quick: "QUICKSORT",
    merge: "MERGE SORT",
    insertion: "INSERTION SORT",
    selection: "SELECTION SORT",
    cocktail: "COCKTAIL SORT",
    shell: "SHELL SORT",
    heap: "HEAP SORT",
  };
  return { start, steps, names, colors, x, height, t0: 0.25, t1: 3.85 };
})();

// The half adder: switches A and B, wires to an XOR gate (the sum) and an
// AND gate (the carry), and a lamp for each. 1 + 1 = 10 in binary.
const HA = (() => {
  const A = [-1.02, 0.45, 0];
  const B = [-1.02, -0.45, 0];
  const xorC = [0.08, 0.45, 0];
  const andC = [0.08, -0.45, 0];
  const sum = [1.0, 0.45, 0];
  const carry = [1.0, -0.45, 0];
  const inX = -0.14;
  const z = 0.04;
  const P = (x, y) => [x, y, z];
  // Input wires: each switch feeds both gates (upper and lower inputs).
  const inputs = [
    [P(A[0] + 0.12, A[1]), P(inX, A[1] + 0.07)].map((p, i) => (i ? p : p)),
    [P(-0.62, A[1]), P(-0.62, andC[1] + 0.07), P(inX, andC[1] + 0.07)],
    [P(B[0] + 0.12, B[1]), P(inX, B[1] - 0.07)],
    [P(-0.44, B[1]), P(-0.44, xorC[1] - 0.07), P(inX, xorC[1] - 0.07)],
  ];
  inputs[0] = [P(A[0] + 0.12, A[1]), P(-0.3, A[1]), P(-0.3, A[1] + 0.07), P(inX, A[1] + 0.07)];
  inputs[2] = [P(B[0] + 0.12, B[1]), P(-0.3, B[1]), P(-0.3, B[1] - 0.07), P(inX, B[1] - 0.07)];
  const sumWire = [P(xorC[0] + 0.2, xorC[1]), P(sum[0] - 0.16, sum[1])];
  const carryWire = [P(andC[0] + 0.19, andC[1]), P(carry[0] - 0.16, carry[1])];
  // Gate outlines (closed polylines) and the XOR's extra back curve.
  const arc = (c, r, a0, a1, n = 16) =>
    Array.from({ length: n + 1 }, (_, i) => {
      const a = a0 + ((a1 - a0) * i) / n;
      return P(c[0] + r * Math.cos(a), c[1] + r * Math.sin(a));
    });
  const H = 0.17;
  const andPts = [P(-0.12, andC[1] + H), P(0.04, andC[1] + H), ...arc([0.04, andC[1]], H, Math.PI / 2, -Math.PI / 2).slice(1), P(-0.12, andC[1] - H), P(-0.12, andC[1] + H)]; // prettier-ignore
  const xorPts = [];
  const tip = [0.28, xorC[1]];
  const back = (t) => [-0.12 + 0.06 * Math.sin(Math.PI * t), xorC[1] + H - 2 * H * t]; // top to bottom
  for (let i = 0; i <= 12; i++) {
    const t = i / 12;
    xorPts.push(P(-0.12 + (tip[0] + 0.12) * t, xorC[1] + H * (1 - t * t)));
  }
  for (let i = 1; i <= 12; i++) {
    const t = i / 12;
    xorPts.push(P(tip[0] - (tip[0] + 0.12) * t, xorC[1] - H * (1 - (1 - t) ** 2)));
  }
  for (let i = 1; i <= 12; i++) {
    const [x, y] = back(1 - i / 12);
    xorPts.push(P(x, y));
  }
  const xorBack = Array.from({ length: 13 }, (_, i) => {
    const [x, y] = back(i / 12);
    return P(x - 0.07, y);
  });
  return { A, B, xorC, andC, sum, carry, inputs, sumWire, carryWire, andPts, xorPts, xorBack, z };
})();
// Is (x, y) inside a closed polyline?
function insidePoly(pts, x, y) {
  let hit = false;
  for (let i = 0, j = pts.length - 1; i < pts.length; j = i++) {
    const [xi, yi] = pts[i];
    const [xj, yj] = pts[j];
    if (yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) hit = !hit;
  }
  return hit;
}
// A lit copy of a wire that fills with light from its start as `channel`
// passes `from` .. `to`.
function wireLight(k, pts, r, color, channel, from = 0, to = 1) {
  const curve = polyline(pts);
  k.add(k.tube(curve, r, { grid: 40 }), {
    flat: 0.35,
    weight: 1.6,
    pattern: false,
    kind: "fade",
    params: (c) => [from + (to - from) * c.t * 0.94, -0.06],
    channel,
    color: (c) => keep(mix(color, "#ffffff", 0.4 * Math.max(0, c.n[2]))),
  });
}

// The neural network as a 3D model: glass neurons in rings on a round stand,
// each with a golden core that grows as it fires, and wires between them.
function buildMlp3D(k) {
  const { pos, wires } = MLP3D;
  k.data = { view: "model", wires };
  stand(k, 1.05, -0.72);
  const R = 0.13;
  const n = wires.length;
  wires.forEach((w, i) => {
    const dir = unit(sub(w.p1, w.p0));
    const a = add(w.p0, mul(dir, R * 0.95));
    const b = sub(w.p1, mul(dir, R * 0.95));
    const r0 = mlpRadius(w.w);
    wire(k, [a, b], r0, {
      to: r0 * (1 + 0.6 * w.nudge),
      channel: 0,
      weight: 1.6,
      color: "#6d7fa6",
    });
    bead(k, w.p0, 0.04 + 0.04 * w.sig, "#ffb000", i);
    bead(k, w.p1, 0.045, "#ff3b4e", n + i);
  });
  pos.forEach((col, l) =>
    col.forEach((p, i) => {
      // Glass: see-through, so the core shows inside.
      k.add(k.sphere(R), {
        pos: p,
        even: true,
        flat: 0.35,
        weight: 1.5,
        opacity: 0.42,
        pattern: false,
        color: (c) => keep(lit("#3b4a74", c.n, { amb: 0.75, dif: 0.35, spec: 0.8, pow: 24 })),
      });
      const part = k.part(`n${l}${i}`, { pivot: p });
      k.add(k.sphere(R * 0.8), {
        pos: p,
        flat: 0.4,
        weight: 2,
        part,
        pattern: false,
        color: (c) => keep(lit("#ffb400", c.n, { amb: 0.95, dif: 0.25, spec: 0.5 })),
      });
      k.add(k.sphere(R * 1.25), {
        pos: p,
        flat: 0.5,
        size: 1.5,
        opacity: 0.25,
        part,
        pattern: false,
        color: () => keep("#ffe28a"),
      });
      // A post down to the stand.
      const h = p[1] + 0.72;
      k.add(k.cylinder(0.008, h - R), {
        pos: [p[0], -0.72 + (h - R) / 2, p[2]],
        flat: 0.4,
        weight: 1.2,
        pattern: false,
        color: () => keep("#4a5778"),
      });
    }),
  );
  ["IN", "HIDDEN", "OUT"].forEach((label, l) =>
    sign(k, label, add(MLP3D.foot[l], [0, 0.0, 0]), 0.022, { color: "#9fb0d6" }),
  );
}

// A light in 3D: a bright sphere and a soft halo round it, turned on by a
// part, a token or a fade channel.
function glow3D(k, p, r, color, { part, token, channel } = {}) {
  const ride = {};
  if (part !== undefined) ride.part = part;
  if (token !== undefined) Object.assign(ride, { kind: "token", params: [token, 0] });
  if (channel !== undefined) Object.assign(ride, { kind: "fade", params: [0, -0.5], channel });
  k.add(k.sphere(r), {
    pos: p,
    flat: 0.4,
    weight: 1.8,
    pattern: false,
    ...ride,
    color: (c) => keep(lit(mix(color, "#ffffff", 0.35), c.n, { amb: 0.95, dif: 0.2, spec: 0.5 })),
  });
  k.add(k.sphere(r * 1.45), {
    pos: p,
    flat: 0.5,
    size: 1.5,
    opacity: 0.22,
    pattern: false,
    ...ride,
    color: () => keep(color),
  });
}
// A glass bulb on a post down to the stand.
function bulb(k, p, r, floor, { post = true } = {}) {
  k.add(k.sphere(r), {
    pos: p,
    even: true,
    flat: 0.35,
    weight: 1.5,
    opacity: 0.45,
    pattern: false,
    color: (c) => keep(lit("#3b4a74", c.n, { amb: 0.75, dif: 0.35, spec: 0.8, pow: 24 })),
  });
  if (post) {
    const h = p[1] - r - floor;
    k.add(k.cylinder(0.018, h), {
      pos: [p[0], floor + h / 2, p[2]],
      even: true,
      flat: 0.35,
      weight: 1.3,
      pattern: false,
      color: (c) => lit("#6d7896", c.n, { amb: 0.7, dif: 0.35, spec: 0.4 }),
    });
  }
}

// The perceptron as a 3D model on a round stand: glass bulbs on posts for
// the inputs, wires through the air to a metal sum node, a glass gauge the
// sum fills, and a bulb for the output.
function buildPerceptron3D(k) {
  const { P, node } = PERC3D;
  k.data = { view: "model" };
  const floor = -0.62;
  stand(k, 1.2, floor);
  const R = 0.11;
  P.forEach((p, i) => {
    const dir = unit(sub(node, p));
    const a = add(p, mul(dir, R));
    const b = sub(node, mul(dir, 0.19));
    const r0 = percRadius(PERC.before[i]);
    const r1 = percRadius(PERC.after[i]);
    wire(
      k,
      [a, b],
      r0,
      r0 !== r1 ? { to: r1, channel: 0, color: "#6d7fa6" } : { color: "#6d7fa6" },
    );
    bulb(k, p, R, floor);
    glow3D(k, p, R * 0.75, "#3fd8ff", { part: k.part("in" + i, { pivot: p }) });
    bead(k, p, 0.075, "#3fd8ff", i);
    sign(k, "X" + (i + 1), add(p, [-0.26, 0, 0]), 0.018, { color: "#9fb0d6" });
  });
  // The sum node: a metal ball with Σ on a plate, and a flash (channel 1).
  k.add(k.sphere(0.18), {
    pos: node,
    even: true,
    flat: 0.3,
    weight: 1.4,
    pattern: false,
    color: (c) => keep(lit("#56648a", c.n, { amb: 0.6, dif: 0.45, spec: 0.7, pow: 20 })),
  });
  sign(k, "Σ", add(node, [0, 0, 0.2]), 0.03, { color: "#dfe8ff" });
  k.add(k.cylinder(0.02, node[1] - 0.18 - floor), {
    pos: [node[0], (node[1] - 0.18 + floor) / 2, node[2]],
    flat: 0.35,
    pattern: false,
    color: () => keep("#4a5778"),
  });
  k.add(k.sphere(0.27), {
    pos: node,
    flat: 0.5,
    size: 1.4,
    opacity: 0.35,
    pattern: false,
    kind: "fade",
    params: [0, -0.6],
    channel: 1,
    color: () => keep("#8ff0ff"),
  });
  // The gauge: a glass tube standing on the stand; the liquid rises with
  // the sum (out.grow); an orange ring marks the threshold.
  const gx = 0.6;
  const gh = 1.0;
  const g0 = floor + 0.02;
  wire(k, [add(node, [0.18, 0, 0]), [gx - 0.12, 0, 0]], percRadius(0.6), { color: "#6d7fa6" });
  k.add(k.cylinder(0.11, gh, { caps: false }), {
    pos: [gx, g0 + gh / 2, 0],
    even: true,
    flat: 0.3,
    weight: 0.5,
    opacity: 0.14,
    pattern: false,
    color: (c) => keep(lit("#7d90b8", c.n, { amb: 0.7, dif: 0.3, spec: 0.9, pow: 30 })),
  });
  k.add(k.cylinder(0.085, gh - 0.04), {
    pos: [gx, g0 + gh / 2, 0],
    flat: 0.3,
    weight: 1.3,
    pattern: false,
    kind: "grow",
    params: (c) => [clamp01((c.p[1] - g0) / gh) * 0.93, 0],
    color: (c) => keep(lit(mix("#1f8fe0", "#8ff0ff", (c.p[1] - g0) / gh), c.n, { amb: 0.85, dif: 0.3, spec: 0.4 })), // prettier-ignore
  });
  const thY = g0 + (PERC.theta / PERC.max) * gh;
  k.add(k.torus(0.125, 0.014), {
    pos: [gx, thY, 0],
    weight: 3,
    flat: 0.4,
    pattern: false,
    color: () => keep("#ffb347"),
  });
  // The output bulb: red for a wrong answer (channel 3), gold when it fires
  // (channel 2).
  const out = [1.05, 0, 0];
  wire(
    k,
    [
      [gx + 0.12, 0, 0],
      [out[0] - 0.17, 0, 0],
    ],
    percRadius(0.6),
    { color: "#6d7fa6" },
  );
  bulb(k, out, 0.17, floor);
  glow3D(k, out, 0.13, "#ffc934", { channel: 2 });
  glow3D(k, out, 0.13, "#ff4d5e", { channel: 3 });
  sign(k, "OUT", add(out, [0, 0.32, 0]), 0.02, { color: "#9fb0d6" });
  sign(k, "WANT 1", add(out, [0, -0.3, 0.1]), 0.016, { color: "#ffd34d" });
}

// The recurrent network as a 3D model: a glass cell with lit edges on a
// stand, the loop arching over it on a slant, and word blocks in front.
function buildRnn3D(k, lstm) {
  const G = RNN3D;
  const { cell } = G;
  k.data = { view: "model" };
  const floor = -0.6;
  stand(k, 1.1, floor);
  wire(k, G.track, 0.028, { color: "#6d7fa6" });
  // The cell: a dark block with lit edges, and a glow that flashes
  // (channel 0) as a word goes in.
  const [cx, cy, cz] = cell.c;
  k.add(k.box(cell.w, cell.h, cell.d), {
    pos: cell.c,
    even: true,
    flat: 0.25,
    pattern: false,
    color: (c) => keep(lit("#26324f", c.n, { amb: 0.8, dif: 0.3, spec: 0.4 })),
  });
  const hx = cell.w / 2;
  const hy = cell.h / 2;
  const hz = cell.d / 2;
  for (const [
    a,
    b,
  ] of [
    [[-hx, -hy, -hz], [hx, -hy, -hz]], [[-hx, hy, -hz], [hx, hy, -hz]],
    [[-hx, -hy, hz], [hx, -hy, hz]], [[-hx, hy, hz], [hx, hy, hz]],
    [[-hx, -hy, -hz], [-hx, hy, -hz]], [[hx, -hy, -hz], [hx, hy, -hz]],
    [[-hx, -hy, hz], [-hx, hy, hz]], [[hx, -hy, hz], [hx, hy, hz]],
    [[-hx, -hy, -hz], [-hx, -hy, hz]], [[hx, -hy, -hz], [hx, -hy, hz]],
    [[-hx, hy, -hz], [-hx, hy, hz]], [[hx, hy, -hz], [hx, hy, hz]],
  ]) // prettier-ignore
    wire(k, [add(cell.c, a), add(cell.c, b)], 0.014, { color: "#9fb0d6", weight: 2 });
  k.add(k.box(cell.w + 0.06, cell.h + 0.06, cell.d + 0.06), {
    pos: cell.c,
    flat: 0.3,
    size: 1.3,
    weight: 0.5,
    opacity: 0.16,
    pattern: false,
    kind: "fade",
    params: [0, -0.7],
    channel: 0,
    color: () => keep("#7d94e0"),
  });
  sign(k, lstm ? "LSTM CELL" : "RNN CELL", [cx, cy + hy + 0.1, cz + hz], 0.018, {
    color: "#9fb0d6",
  });
  k.add(k.cylinder(0.03, cy - hy - floor), {
    pos: [cx - hx + 0.08, (cy - hy + floor) / 2, cz - hz + 0.08],
    flat: 0.35,
    pattern: false,
    color: () => keep("#4a5778"),
  });
  k.add(k.cylinder(0.03, cy - hy - floor), {
    pos: [cx + hx - 0.08, (cy - hy + floor) / 2, cz - hz + 0.08],
    flat: 0.35,
    pattern: false,
    color: () => keep("#4a5778"),
  });
  // The gates (LSTM): slats on the cell's front that turn open.
  if (lstm)
    G.gates.forEach((g, gi) => {
      g.slats.forEach((b, j) =>
        k.add(k.box(0.2, 0.058, 0.012), {
          pos: b,
          flat: 0.3,
          weight: 2.5,
          pattern: false,
          kind: "token",
          params: [7 + gi * 3 + j, 0],
          color: (c) => keep(lit(g.color, c.n, { amb: 0.8, dif: 0.3, spec: 0.3 })),
        }),
      );
      text(k, g.label, [g.c[0], g.c[1] - 0.155, g.c[2] + 0.02], 0.016, g.color);
    });
  // The orb: four copies, one per colour (tokens 3 to 6), in front of the
  // cell.
  RNN.orbColors.forEach((col, j) => {
    const p = G.path(0);
    k.add(k.sphere(0.095), {
      pos: p,
      flat: 0.4,
      weight: 2.5,
      pattern: false,
      kind: "token",
      params: [3 + j, 0],
      color: (c) => keep(lit(mix(col, "#ffffff", 0.2), c.n, { amb: 0.9, dif: 0.25, spec: 0.6 })),
    });
    k.add(k.sphere(0.13), {
      pos: p,
      flat: 0.5,
      size: 1.4,
      opacity: 0.25,
      pattern: false,
      kind: "token",
      params: [3 + j, 0],
      color: () => keep(col),
    });
  });
  // The words: blocks on the stand in front (tokens 0 to 2).
  RNN.words.forEach((w, i) => {
    const p = G.slots[i];
    k.add(k.box(0.5, 0.22, 0.14), {
      pos: p,
      even: true,
      flat: 0.25,
      weight: 1.5,
      pattern: false,
      kind: "token",
      params: [i, 0],
      color: (c) => {
        if (c.s.face !== 4) return keep(lit(shade(RNN.wordColors[i], 0.55), c.n, { amb: 0.8, dif: 0.3, spec: 0.2 })); // prettier-ignore
        const edge = Math.min(0.25 - Math.abs(c.p[0] - p[0]), 0.11 - Math.abs(c.p[1] - p[1]));
        return keep(edge < 0.014 ? RNN.wordColors[i] : "#10172a");
      },
    });
    text(k, w, add(p, [0, 0, 0.073]), 0.024, RNN.wordColors[i], { kind: "token", params: [i, 0] });
  });
}

// The convolutional network as a 3D model (see CNN_AT3D).
function buildCnn3D(k) {
  const A = CNN_AT3D;
  k.data = { view: "model" };
  stand(k, 1.35, A.floor);
  const cube = (p, size, depth, color, opts = {}) =>
    k.add(k.box(size, size, depth), {
      pos: p,
      flat: 0.25,
      weight: 1.6,
      pattern: false,
      color: (c) => keep(lit(color, c.n, { amb: 0.78, dif: 0.35, spec: 0.2 })),
      ...opts,
    });
  // The picture of a 7: a slab of cubes, the inked ones white.
  CNN.img.forEach(
    (row, r) =>
    row.forEach((v, c) => cube(cellAt(A.img, 7, A.cell, r, c), A.cell * 0.92, 0.07, mix("#1c2542", "#f4f7ff", v))), // prettier-ignore
  );
  // Empty slots for the feature map and the pooled map.
  for (let r = 0; r < 5; r++)
    for (let c = 0; c < 5; c++)
      cube(cellAt(A.feat, 5, A.cell, r, c), A.cell * 0.92, 0.05, "#1a2238");
  for (let r = 0; r < 3; r++)
    for (let c = 0; c < 3; c++)
      cube(cellAt(A.pool, 3, A.pcell, r, c), A.pcell * 0.92, 0.05, "#1a2238");
  // Feature tiles (tokens 1 to 25) and pooled tiles (26 to 34), in front of
  // their slots.
  CNN.fmap.forEach(
    (v, j) =>
    cube(add(cellAt(A.feat, 5, A.cell, Math.floor(j / 5), j % 5), [0, 0, 0.045]), A.cell * 0.9, 0.04, featColor(v), { kind: "token", params: [1 + j, 0] }), // prettier-ignore
  );
  CNN.pool.forEach(
    (v, j) =>
    cube(add(cellAt(A.pool, 3, A.pcell, Math.floor(j / 3), j % 3), [0, 0, 0.045]), A.pcell * 0.9, 0.04, featColor(v), { kind: "token", params: [26 + j, 0] }), // prettier-ignore
  );
  // The filter: a glowing 3 x 3 frame in front of the picture (token 0),
  // and the marker on the tile it stamps (token 35).
  const f0 = add(cellAt(A.img, 7, A.cell, 1, 1), [0, 0, 0.12]);
  const fs = A.cell * 3;
  const frame = (c, size, token, color, th) => {
    for (const [dx, dy, w, h] of [
      [0, size / 2, size + th, th],
      [0, -size / 2, size + th, th],
      [size / 2, 0, th, size],
      [-size / 2, 0, th, size],
    ])
      k.add(k.box(w, h, th), {
        pos: add(c, [dx, dy, 0]),
        flat: 0.3,
        weight: 3,
        pattern: false,
        kind: "token",
        params: [token, 0],
        color: () => keep(color),
      });
  };
  frame(f0, fs, 0, "#ffd34d", 0.025);
  const m0 = add(cellAt(A.feat, 5, A.cell, 0, 0), [0, 0, 0.12]);
  frame(m0, A.cell, 35, "#ffd34d", 0.018);
  // The receptive field: lines from the filter's four corners to the
  // marker's, each end following its token (skin).
  for (const [sx, sy] of [
    [-1, -1],
    [1, -1],
    [1, 1],
    [-1, 1],
  ]) {
    // prettier-ignore
    const a = add(f0, [(sx * fs) / 2, (sy * fs) / 2, 0]);
    const b = add(m0, [(sx * A.cell) / 2, (sy * A.cell) / 2, 0]);
    k.cloud({ count: 220, size: 0.7, pattern: false }, (rand, i, n) => {
      const t = (i + rand()) / n;
      return {
        p: lerp3(a, b, t),
        color: mix("#ffd34d", "#fff4c2", 0.4),
        opacity: 0.75,
        skin: [0, 35, t],
      };
    });
  }
  sign(k, "FILTER", add(A.img, [0, 0.58, 0]), 0.018, { color: "#9fb0d6" });
  sign(k, "MAP", add(A.feat, [0, 0.46, 0]), 0.018, { color: "#9fb0d6" });
  sign(k, "POOL", add(A.pool, [0, 0.4, 0]), 0.018, { color: "#9fb0d6" });
  // The scores: columns on the stand that rise together (out.grow), each
  // stopping at its own height, 7 in gold.
  const y0 = A.floor;
  CNN.scores.forEach((v, d) => {
    const x = (d - 4.5) * 0.22;
    const h = A.barH * v;
    const top = d === 7;
    k.add(k.box(0.13, h, 0.13), {
      pos: [x, y0 + h / 2, A.barZ],
      flat: 0.25,
      weight: 1.5,
      pattern: false,
      kind: "grow",
      params: (c) => [clamp01((c.p[1] - y0) / A.barH) * 0.92, 0],
      color: (c) =>
        keep(lit(top ? mix("#ffb400", "#fff1a8", (c.p[1] - y0) / h) : mix("#2a6fd6", "#7fd0ff", (c.p[1] - y0) / A.barH), c.n, { amb: 0.85, dif: 0.3, spec: 0.3 })), // prettier-ignore
    });
    text(k, String(d), [x, y0 + 0.07, A.barZ + 0.1], 0.02, top ? "#ffd34d" : "#9fb0d6");
  });
}

// A box outline (12 edges) as wires, for blocks the tiles pass through.
function wireBox(k, c, size, r, color, opts = {}) {
  const [hx, hy, hz] = size.map((v) => v / 2);
  const corners = [
    [[-hx, -hy, -hz], [hx, -hy, -hz]], [[-hx, hy, -hz], [hx, hy, -hz]],
    [[-hx, -hy, hz], [hx, -hy, hz]], [[-hx, hy, hz], [hx, hy, hz]],
    [[-hx, -hy, -hz], [-hx, hy, -hz]], [[hx, -hy, -hz], [hx, hy, -hz]],
    [[-hx, -hy, hz], [-hx, hy, hz]], [[hx, -hy, hz], [hx, hy, hz]],
    [[-hx, -hy, -hz], [-hx, -hy, hz]], [[hx, -hy, -hz], [hx, -hy, hz]],
    [[-hx, hy, -hz], [-hx, hy, hz]], [[hx, hy, -hz], [hx, hy, hz]],
  ]; // prettier-ignore
  for (const [a, b] of corners) wire(k, [add(c, a), add(c, b)], r, { color, weight: 2, ...opts });
}
// A word tile as a solid block, its word on the front face.
function block3D(k, word, p, color, token, { w = 0.42, h = 0.22, d = 0.14, px = 0.02 } = {}) {
  const ride = token === undefined ? {} : { kind: "token", params: [token, 0] };
  k.add(k.box(w, h, d), {
    pos: p,
    even: true,
    flat: 0.25,
    weight: 1.5,
    pattern: false,
    ...ride,
    color: (c) => {
      if (c.s.face !== 4)
        return keep(lit(shade(color, 0.45), c.n, { amb: 0.8, dif: 0.3, spec: 0.2 }));
      const edge = Math.min(w / 2 - Math.abs(c.p[0] - p[0]), h / 2 - Math.abs(c.p[1] - p[1]));
      return keep(edge < 0.014 ? color : "#10172a");
    },
  });
  if (word) text(k, word, add(p, [0, 0, d / 2 + 0.003]), px, color, ride);
}

// The transformer as a 3D model: word blocks on a plinth, glass-edged
// feed-forward blocks above them, and attention arcs in the air: head A's
// upright, head B's leaning back.
function buildTransformer3D(k) {
  k.data = { view: "model" };
  const floor = TF.row - TF_TILE[1] / 2 - 0.02;
  k.add(k.box(3.0, 0.08, 0.9), {
    pos: [0, floor - 0.04, 0],
    even: true,
    flat: 0.25,
    color: (c) =>
      c.n[1] > 0.5 ? keep(BOARD) : lit(BOARD_RIM, c.n, { amb: 0.75, dif: 0.3, spec: 0.1 }),
  });
  // The feed-forward blocks: box outlines the tiles rise through, and a lit
  // copy of each (a part).
  TF.ffn.forEach((fy, i) => {
    const size = [2.12, 0.26, 0.5];
    const c = [-0.26, fy, 0];
    wireBox(k, c, size, 0.016, "#6d7fa6");
    wireBox(k, c, size, 0.024, "#9fe8ff", { part: k.part("ffn" + i, { pivot: c }) });
    sign(k, "FFN", [-1.55, fy, 0.25], 0.019, { color: "#9fb0d6" });
  });
  for (const y of [TF.row, TF.levels[1]])
    sign(k, "ATTN", [-1.55, y + 0.26, 0.25], 0.019, { color: "#9fb0d6" });
  // Attention arcs: head A's stand upright, head B's lean back.
  TF.heads.forEach((layer, l) =>
    layer.forEach((arcs, h) =>
      arcs.forEach(([a, b, w]) => {
        const y0 = TF.levels[l] + TF_TILE[1] / 2;
        const xa = TF.xs[a] + (h ? 0.05 : -0.05);
        const xb = TF.xs[b] + (h ? 0.05 : -0.05);
        const lift = 0.1 + 0.08 * Math.abs(a - b);
        const lean = h ? 0.9 : 0;
        const curve = (t) => {
          const up = lift * Math.sin(Math.PI * t);
          return [xa + (xb - xa) * t, y0 + up * Math.cos(lean), 0.02 - up * Math.sin(lean)];
        };
        k.add(k.tube(curve, 0.007 + 0.02 * w, { grid: 40 }), {
          flat: 0.4,
          weight: 1.6,
          pattern: false,
          kind: "fade",
          params: (c) => [c.t * 0.82, -0.18],
          channel: l * 2 + h,
          color: (c) => keep(lit(TF_HEADS[h], c.n, { amb: 0.95, dif: 0.2, spec: 0.5 })),
        });
      }),
    ),
  );
  // The word blocks (tokens 0 to 3), and the next word (token 4), built
  // where it lands.
  TF.words.forEach((w, i) => block3D(k, w, [TF.xs[i], TF.row, 0], "#e8eefc", i));
  block3D(k, TF.next, [TF.xs[4], TF.row, 0], "#ffd34d", 4);
  k.reach([TF.xs[4], TF.levels[2] + 0.15, 0]);
}

// The looped transformer as a 3D model: the loop leans back (its bottom
// straight in front, the block at the back), the block is a box outline,
// and the tiles are blocks that ride round it facing you.
const LOOP_TILT = 0.65;
const loopTilt = (p) => [p[0], 0.1 + p[1] * Math.cos(LOOP_TILT), -p[1] * Math.sin(LOOP_TILT)];
function buildLoop3D(k) {
  const L = LOOP;
  k.data = { view: "model" };
  const floor = loopTilt([0, -L.r, 0])[1] - L.tile / 2 - 0.02;
  stand(k, 1.2, floor);
  const track = [];
  for (let i = 0; i <= 160; i++) track.push(add(loopTilt(L.at((L.P * i) / 160)), [0, -L.tile / 2 - 0.03, 0])); // prettier-ignore
  wire(k, track, 0.022, { color: "#6d7fa6" });
  // The block: a box outline round the top straight, and a lit copy.
  const c = add(loopTilt([0, L.r, 0]), [0, 0.02, 0]);
  const size = [2 * L.half + 0.2, L.tile + 0.2, 0.42];
  wireBox(k, c, size, 0.016, "#6d7fa6");
  wireBox(k, c, size, 0.024, "#9fe8ff", { part: k.part("block", { pivot: c }) });
  sign(k, "BLOCK", add(c, [0, size[1] / 2 + 0.1, 0]), 0.018, { color: "#9fb0d6" });
  // Posts holding up the loop's back.
  for (const x of [-L.half - L.r * 0.7, L.half + L.r * 0.7]) {
    const top = loopTilt([x > 0 ? L.half + L.r * 0.7 : -L.half - L.r * 0.7, 0, 0]);
    k.add(k.cylinder(0.018, top[1] - floor), {
      pos: [x, (top[1] + floor) / 2, top[2]],
      flat: 0.35,
      pattern: false,
      color: () => keep("#4a5778"),
    });
  }
  // The tiles: a block each (tokens 20 to 24) and each mark at four levels
  // (token i * 4 + level) on its front face.
  const T = L.tile;
  const px = 0.028;
  L.rest.forEach((d0, i) => {
    const p = loopTilt(L.at(d0));
    k.add(k.box(T, T, 0.1), {
      pos: p,
      even: true,
      flat: 0.25,
      weight: 1.5,
      pattern: false,
      kind: "token",
      params: [20 + i, 0],
      color: (cc) => {
        if (cc.s.face !== 4) return keep(lit("#3a4768", cc.n, { amb: 0.8, dif: 0.3, spec: 0.2 }));
        const edge = Math.min(T / 2 - Math.abs(cc.p[0] - p[0]), T / 2 - Math.abs(cc.p[1] - p[1]));
        return keep(edge < 0.012 ? "#6b7ca6" : "#0d1324");
      },
    });
    const answer = i === L.marks.length - 1;
    L.levels[i].forEach((grid, v) => {
      const x0 = p[0] - 2.5 * px;
      const y0 = p[1] + 3.5 * px;
      k.add(
        k.param((u, w) => [x0 + u * 5 * px, y0 - w * 7 * px, p[2] + 0.053], {
          grid: 24,
          normal: () => [0, 0, 1],
        }),
        {
          weight: 3.5,
          flat: 0.2,
          pattern: false,
          kind: "token",
          params: [i * 4 + v, 0],
          color: (cc) => {
            const val = grid[Math.min(6, Math.floor(cc.v * 7))][Math.min(4, Math.floor(cc.u * 5))];
            if (val < 0.12) return null;
            return keep(mix("#1e3558", v === 3 && answer ? "#ffd34d" : "#7ff6ff", val));
          },
        },
      );
    });
  });
}

export const RECIPES = {
  perceptron: {
    options: [VIEW_OPTION],
    controls: [{ key: "go", label: "Try", type: "pulse", ease: 4 }],
    action: { key: "go", label: "Try an example" },
    // Three inputs (1, 0, 1) send pulses along wires as thick as their
    // weights; the sum fills the gauge but stays under the threshold, so the
    // lamp flashes red. The two live wires thicken (it learns), the pulses
    // go again, the gauge passes the threshold and the lamp snaps on.
    drive(t, c, out, info) {
      const s = since(c.go, 4);
      const on = s >= 0;
      const model = info.data?.view === "model";
      const { P, node } = model ? PERC3D : PERC2D;
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
      if (model) out.resort = resortSteps(this, "perc", on ? s : -1, 0.3, 3.0, 0.15);
    },
    build(k, o) {
      if (o.view === "model") return buildPerceptron3D(k);
      k.data = { view: "poster" };
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
  "neural-network": {
    options: [VIEW_OPTION],
    controls: [{ key: "go", label: "Train", type: "pulse", ease: 4.5 }],
    action: { key: "go", label: "Forward and back" },
    // A forward pass: the inputs light, pulses of light run along the wires
    // (as big as the signal they carry) into the hidden layer, whose neurons
    // glow as bright as they fire, then on to the outputs, where one wins.
    // Then red pulses run back from the outputs (backpropagation), and the
    // wires thicken or thin a little as they pass.
    drive(t, c, out, info) {
      const s = since(c.go, 4.5);
      const on = s >= 0;
      const wires = info.data?.wires || MLP.wires;
      const fade = on ? 1 - ease(band(s, 3.95, 4.45)) : 0;
      // Each layer lights when the pulses reach it.
      const lightAt = [0.05, 1.1, 2.1];
      MLP.acts.forEach((col, l) => {
        const g = on ? ease(band(s, lightAt[l], lightAt[l] + 0.3)) * fade : 0;
        col.forEach((a, i) => {
          const v = g * (0.25 + 0.75 * a);
          out.parts[`n${l}${i}`] = { scale: v, visible: v > 0.01 ? 1 : 0 };
        });
      });
      out.tokens = [];
      const n = wires.length;
      const go = (x) => (x > 0 && x < 1 ? ease(x) : -1);
      wires.forEach((w, i) => {
        const d = sub(w.p1, w.p0);
        // Forward: layer 0 wires at 0.35 s, layer 1 at 1.4 s.
        const f = on ? go((s - (w.l === 0 ? 0.35 : 1.4)) / 0.7) : -1;
        out.tokens[i] = f < 0 ? { visible: 0 } : { offset: mul(d, f), visible: 1 };
        // Back: layer 1 wires at 2.5 s, layer 0 at 3.2 s (built at the far end).
        const b = on ? go((s - (w.l === 1 ? 2.5 : 3.2)) / 0.7) : -1;
        out.tokens[n + i] = b < 0 ? { visible: 0 } : { offset: mul(d, -b), visible: 1 };
      });
      // The weights shift as the red pulses pass, and ease back at the end.
      out.morph = [on ? ease(band(s, 2.6, 3.9)) * fade : 0];
      // In the 3D model the pulses pass in front of and behind each other.
      if (info.data?.view === "model") out.resort = resortSteps(this, "mlp", on ? s : -1, 0.35, 4.0, 0.12); // prettier-ignore
    },
    build(k, o) {
      if (o.view === "model") return buildMlp3D(k);
      k.data = { view: "poster", wires: MLP.wires };
      board(k, 2.9, 1.8);
      const z = 0.04;
      const R = 0.13;
      const n = MLP.wires.length;
      MLP.wires.forEach((w, i) => {
        const dir = unit(sub(w.p1, w.p0));
        const a = add(add(w.p0, mul(dir, R * 0.9)), [0, 0, z]);
        const b = add(sub(w.p1, mul(dir, R * 0.9)), [0, 0, z]);
        const r0 = mlpRadius(w.w);
        wire(k, [a, b], r0, { to: r0 * (1 + 0.6 * w.nudge), channel: 0, weight: 1.6 });
        const br = 0.04 + 0.04 * w.sig;
        bead(k, add(w.p0, [0, 0, z + 0.03]), br, "#ffe680", i);
        bead(k, add(w.p1, [0, 0, z + 0.035]), 0.04, "#ff4b5c", n + i);
      });
      // Neurons: dark glass, with a glowing core that grows with how
      // strongly the neuron fires (a part each).
      MLP.pos.forEach((col, l) =>
        col.forEach((p, i) => {
          k.add(k.sphere(R), {
            pos: add(p, [0, 0, z]),
            scale: [1, 1, 0.5],
            even: true,
            flat: 0.3,
            weight: 1.4,
            pattern: false,
            color: (c) => lit("#2c3654", c.n, { amb: 0.7, dif: 0.35, spec: 0.6, pow: 18 }),
          });
          k.add(k.torus(R * 1.02, R * 0.1), {
            pos: add(p, [0, 0, z + 0.004]),
            rot: [90, 0, 0],
            even: true,
            weight: 1.4,
            pattern: false,
            color: (c) => lit("#7d8aab", c.n, { amb: 0.7, dif: 0.4, spec: 0.5 }),
          });
          const part = k.part(`n${l}${i}`, { pivot: add(p, [0, 0, z + 0.06]) });
          lampLight(k, add(p, [0, 0, z + 0.06]), R * 0.95, "#ffd34d", { part });
        }),
      );
      ["IN", "HIDDEN", "OUT"].forEach((label, l) =>
        text(k, label, [MLP.pos[l][0][0], -0.8, 0.003], 0.02, "#9fb0d6"),
      );
    },
  },
  cnn: {
    options: [VIEW_OPTION],
    controls: [{ key: "go", label: "Read", type: "pulse", ease: 5 }],
    action: { key: "go", label: "Read the digit" },
    // A glowing 3 x 3 filter slides across the handwritten 7, stamping the
    // feature map one tile at a time; the tiles then slide together into
    // the pooled map (2 x 2 max pooling), and the digit scores rise, 7 on
    // top.
    drive(t, c, out, info) {
      const s = since(c.go, 5);
      const on = s >= 0;
      const model = info.data?.view === "model";
      const A = model ? CNN_AT3D : CNN_AT;
      out.tokens = [];
      // The scan: 25 steps from 0.25 s to 2.35 s.
      const step = 0.084;
      const k = on ? (s - 0.25) / step : -1;
      const scanning = on && k >= 0 && k < 25.5;
      const i = clamp(Math.floor(k), 0, 24);
      // The filter slides quickly to each spot and rests there a moment.
      const from = Math.max(0, i - 1);
      const f = ease(band(k - i, 0, 0.45));
      const spot = (j) => cellAt(A.img, 7, A.cell, Math.floor(j / 5) + 1, (j % 5) + 1);
      const home = spot(0);
      const at = i === 0 ? home : lerp3(spot(from), spot(i), f);
      out.tokens[0] = scanning ? { offset: sub(at, home), visible: 1 } : { visible: 0 };
      // Feature tiles: stamped as the filter lands, then pooled.
      const pooling = on ? ease(band(s, 2.55, 3.05)) : 0;
      const shown = on && s < 4.4;
      for (let j = 0; j < 25; j++) {
        const r = Math.floor(j / 5);
        const cc = j % 5;
        const stamped = on && k >= j + 0.4;
        const home = cellAt(A.feat, 5, A.cell, r, cc);
        const to = cellAt(A.pool, 3, A.pcell, Math.floor(r / 2), Math.floor(cc / 2));
        const gone = pooling >= 1;
        out.tokens[1 + j] =
          stamped && shown && !gone ? { offset: mul(sub(to, home), pooling), visible: 1 } : { visible: 0 }; // prettier-ignore
      }
      for (let j = 0; j < 9; j++) out.tokens[26 + j] = { visible: shown && pooling >= 1 ? 1 : 0 };
      // The 3D model's marker on the tile being stamped (token 35): the
      // lines from the filter's corners to it follow both.
      if (model) {
        const cell = (j) => cellAt(A.feat, 5, A.cell, Math.floor(j / 5), j % 5);
        const m = i === 0 ? cell(0) : lerp3(cell(from), cell(i), f);
        out.tokens[35] = scanning ? { offset: sub(m, cell(0)), visible: 1 } : { visible: 0 };
      }
      // The scores rise (out.grow), then drop at the end.
      out.grow = on ? ease(band(s, 3.15, 3.9)) * (1 - ease(band(s, 4.4, 4.9))) : 0;
      // Tiles that fly across the board are sorted again as they go
      // (docs/PACKS.md 7b, draw order), and once more when they are hidden.
      out.resort = model
        ? resortSteps(this, "cnn3d", on ? s : -1, 0.25, 3.2, 0.17)
        : resortSteps(this, "cnn", on ? s : -1, 2.55, 3.2, 0.11);
    },
    build(k, o) {
      if (o.view === "model") return buildCnn3D(k);
      k.data = { view: "poster" };
      board(k, 3.0, 2.1);
      const A = CNN_AT;
      const z = 0.012;
      const tile = (p, size, color, opts = {}) =>
        k.add(k.box(size, size, 0.02), {
          pos: add(p, [0, 0, z]),
          flat: 0.2,
          weight: 2,
          pattern: false,
          color: () => keep(color),
          ...opts,
        });
      // The picture of a 7.
      CNN.img.forEach((row, r) =>
        row.forEach((v, c) =>
          tile(cellAt(A.img, 7, A.cell, r, c), A.cell * 0.9, mix("#1c2542", "#f4f7ff", v)),
        ),
      );
      // The filter: a glowing 3 x 3 frame (token 0).
      const f0 = cellAt(A.img, 7, A.cell, 1, 1);
      const fs = A.cell * 3;
      for (const [dx, dy, w, h] of [
        [0, fs / 2, fs + 0.03, 0.025],
        [0, -fs / 2, fs + 0.03, 0.025],
        [fs / 2, 0, 0.025, fs],
        [-fs / 2, 0, 0.025, fs],
        [0, A.cell / 2, fs, 0.008],
        [0, -A.cell / 2, fs, 0.008],
        [A.cell / 2, 0, 0.008, fs],
        [-A.cell / 2, 0, 0.008, fs],
      ])
        k.add(k.box(w, h, 0.02), {
          pos: add(f0, [dx, dy, 0.05]),
          flat: 0.3,
          weight: 3,
          pattern: false,
          kind: "token",
          params: [0, 0],
          color: () => keep("#ffd34d"),
        });
      // Empty cells where the feature map and the pooled map go.
      for (let r = 0; r < 5; r++)
        for (let c = 0; c < 5; c++) tile(cellAt(A.feat, 5, A.cell, r, c), A.cell * 0.9, "#1a2238");
      for (let r = 0; r < 3; r++)
        for (let c = 0; c < 3; c++)
          tile(cellAt(A.pool, 3, A.pcell, r, c), A.pcell * 0.9, "#1a2238");
      // Feature tiles (tokens 1 to 25) and pooled tiles (26 to 34).
      CNN.fmap.forEach((v, j) =>
        tile(cellAt(A.feat, 5, A.cell, Math.floor(j / 5), j % 5), A.cell * 0.9, featColor(v), {
          pos: add(cellAt(A.feat, 5, A.cell, Math.floor(j / 5), j % 5), [0, 0, z + 0.02]),
          kind: "token",
          params: [1 + j, 0],
        }),
      );
      CNN.pool.forEach((v, j) =>
        tile(cellAt(A.pool, 3, A.pcell, Math.floor(j / 3), j % 3), A.pcell * 0.9, featColor(v), {
          pos: add(cellAt(A.pool, 3, A.pcell, Math.floor(j / 3), j % 3), [0, 0, z + 0.02]),
          kind: "token",
          params: [26 + j, 0],
        }),
      );
      text(k, "→", [(A.img[0] + A.feat[0]) / 2 + 0.07, A.img[1], 0.003], 0.024, "#6f7fa6");
      text(k, "→", [(A.feat[0] + A.pool[0]) / 2 + 0.03, A.img[1], 0.003], 0.024, "#6f7fa6");
      text(k, "FILTER", [A.img[0], 0.87, 0.003], 0.018, "#9fb0d6");
      text(k, "MAP", [A.feat[0], 0.87, 0.003], 0.018, "#9fb0d6");
      text(k, "POOL", [A.pool[0], 0.87, 0.003], 0.018, "#9fb0d6");
      // The scores: bars that rise together as out.grow runs, each stopping
      // at its own height.
      const y0 = A.bars + 0.12;
      CNN.scores.forEach((v, d) => {
        const x = (d - 4.5) * 0.25;
        const h = A.barH * v;
        const top = d === 7;
        k.add(k.box(0.15, 0.012, 0.02), {
          pos: [x, y0 - 0.01, z],
          flat: 0.2,
          pattern: false,
          color: () => keep("#34405e"),
        });
        k.add(k.box(0.15, h, 0.03), {
          pos: [x, y0 + h / 2, z + 0.01],
          flat: 0.2,
          weight: 1.5,
          pattern: false,
          kind: "grow",
          params: (c) => [clamp01((c.p[1] - y0) / A.barH) * 0.92, 0],
          color: (c) =>
            keep(top ? mix("#ffb400", "#fff1a8", (c.p[1] - y0) / h) : mix("#2a6fd6", "#7fd0ff", (c.p[1] - y0) / A.barH)), // prettier-ignore
        });
        text(k, String(d), [x, A.bars, 0.003], 0.022, top ? "#ffd34d" : "#9fb0d6");
      });
    },
  },
  rnn: {
    options: [
      {
        key: "style",
        label: "Style",
        type: "select",
        default: "simple",
        choices: [
          { id: "simple", label: "Simple" },
          { id: "lstm", label: "LSTM" },
        ],
      },
      VIEW_OPTION,
    ],
    controls: [{ key: "go", label: "Read", type: "pulse", ease: 4.5 }],
    action: { key: "go", label: "Read a sentence" },
    // Each word rises into the cell; the cell flashes and the orb (the hidden
    // state) takes on the word's colour mixed with what it carried, runs out
    // of the cell, round the loop and back in, ready for the next word. The
    // LSTM style also opens and shuts its forget, input and output gates.
    drive(t, c, out, info) {
      const s = since(c.go, 4.5);
      const on = s >= 0;
      const G = info.data?.view === "model" ? RNN3D : RNN;
      const gates = info.data?.view === "model" ? RNN3D.gates : RNN_GATES;
      out.tokens = [];
      let flash = 0;
      let orb = 0;
      let f = 0;
      RNN.words.forEach((_, i) => {
        const t0 = 0.15 + i * RNN_STEP;
        const x = on ? (s - t0) / 0.4 : -1;
        // The word: rises from its place into the cell's bottom and is
        // taken in; all three come back at the end.
        const back = on ? band(s, 4.0, 4.3) : 1;
        const inside = x >= 1 && back <= 0;
        const at = sub(G.feed[i](ease(x)), G.slots[i]);
        out.tokens[i] =
          on && x > 0 && !inside ? { offset: back > 0 ? [0, 0, 0] : at, visible: back > 0 ? back : 1 } : { visible: inside ? 0 : 1 }; // prettier-ignore
        if (on && s >= t0 + 0.4) orb = i + 1;
        flash = Math.max(flash, on ? bump(s, t0 + 0.35, t0 + 0.42, t0 + 0.5, t0 + 0.75) : 0);
        const run = on ? (s - (t0 + 0.5)) / 0.7 : -1;
        if (run > 0 && run < 1) f = run;
      });
      if (on && s > 4.0) orb = 0;
      // The orb: one copy per colour, one shown.
      const p = G.path(ease(f));
      const home = G.path(0);
      for (let j = 0; j < 4; j++)
        out.tokens[3 + j] = { offset: sub(p, home), visible: j === orb ? 1 : 0 };
      out.morph = [flash];
      // The LSTM's gates: forget (half open), input (opens as a word comes
      // in) and output (opens as the orb goes out).
      const gate = (g) => {
        let v = 0;
        RNN.words.forEach((_, i) => {
          const t0 = 0.15 + i * RNN_STEP;
          if (!on) return;
          if (g === 0) v = Math.max(v, 0.55 * bump(s, t0 + 0.1, t0 + 0.3, t0 + 0.55, t0 + 0.8));
          if (g === 1) v = Math.max(v, bump(s, t0 + 0.05, t0 + 0.25, t0 + 0.45, t0 + 0.7));
          if (g === 2) v = Math.max(v, bump(s, t0 + 0.4, t0 + 0.55, t0 + 0.8, t0 + 1.0));
        });
        return v;
      };
      for (let g = 0; g < 3; g++)
        for (let j = 0; j < 3; j++)
          out.tokens[7 + g * 3 + j] = { quat: quatX(-1.35 * gate(g)), base: gates[g].slats[j] };
      out.resort = resortSteps(this, "rnn", on ? s : -1, 0.15, 4.35, 0.2);
    },
    build(k, o) {
      if (o.view === "model") return buildRnn3D(k, o.style === "lstm");
      k.data = { view: "poster" };
      board(k, 2.3, 1.85);
      const lstm = o.style === "lstm";
      const { cell } = RNN;
      const z = 0.05;
      // The loop, with arrowheads showing its way round.
      const track = [];
      const right = RNN.arc(RNN.loop.a0);
      track.push([cell.w / 2, RNN.orbY, z], [right[0], RNN.orbY, z]);
      for (let i = 0; i <= 40; i++) {
        const p = RNN.arc(RNN.loop.a0 + ((RNN.loop.a1 - RNN.loop.a0) * i) / 40);
        track.push([p[0], p[1], z]);
      }
      track.push([-right[0], RNN.orbY, z], [-cell.w / 2, RNN.orbY, z]);
      wire(k, track, 0.028, { color: "#56688f" });
      text(k, "→", [0, RNN.loop.c[1] + RNN.loop.ry, z + 0.035], 0.02, "#c7d3f0", { weight: 5 });
      // The cell: a raised block that flashes (channel 0) as a word goes in.
      const cy = cell.c[1];
      k.add(k.box(cell.w, cell.h, 0.14), {
        pos: [0, cy, 0.07],
        even: true,
        flat: 0.2,
        pattern: false,
        color: (c) => {
          const edge = Math.min(cell.w / 2 - Math.abs(c.p[0]), cell.h / 2 - Math.abs(c.p[1] - cy));
          const base = c.s.face === 4 ? (edge < 0.03 ? "#8190b8" : "#2a3656") : "#3a4768";
          return keep(lit(base, c.n, { amb: 0.8, dif: 0.3, spec: 0.2 }));
        },
      });
      k.add(k.box(cell.w - 0.06, cell.h - 0.06, 0.01), {
        pos: [0, cy, 0.145],
        flat: 0.2,
        opacity: 0.7,
        pattern: false,
        kind: "fade",
        params: [0, -0.7],
        channel: 0,
        color: () => keep("#5d74b8"),
      });
      text(k, lstm ? "LSTM CELL" : "RNN CELL", [0, 0.56, 0.003], 0.02, "#9fb0d6");
      // The gates (LSTM): each a window of three slats that turn open.
      if (lstm)
        RNN_GATES.forEach((g, gi) => {
          k.add(k.box(0.22, 0.2, 0.01), {
            pos: [g.c[0], g.c[1], 0.15],
            flat: 0.2,
            pattern: false,
            color: () => keep("#0d1324"),
          });
          g.slats.forEach((b, j) =>
            k.add(k.box(0.2, 0.058, 0.012), {
              pos: b,
              flat: 0.3,
              weight: 2.5,
              pattern: false,
              kind: "token",
              params: [7 + gi * 3 + j, 0],
              color: (c) => keep(lit(g.color, c.n, { amb: 0.8, dif: 0.3, spec: 0.3 })),
            }),
          );
          text(k, g.label, [g.c[0], g.c[1] - 0.155, 0.152], 0.016, g.color);
        });
      // The orb: four copies, one per colour (tokens 3 to 6).
      RNN.orbColors.forEach((col, j) => {
        const p = RNN.path(0);
        k.add(k.sphere(0.085), {
          pos: p,
          flat: 0.4,
          weight: 2.5,
          pattern: false,
          kind: "token",
          params: [3 + j, 0],
          color: (c) => keep(mix(col, "#ffffff", 0.45 * Math.max(0, c.n[2]) ** 3)),
        });
        k.add(k.disc(0.14, 0.07), {
          pos: add(p, [0, 0, -0.01]),
          rot: [90, 0, 0],
          flat: 0.2,
          size: 1.4,
          opacity: 0.35,
          pattern: false,
          kind: "token",
          params: [3 + j, 0],
          color: (c) => keep(mix(col, BOARD, 0.2 + 0.6 * c.v)),
        });
      });
      // The words, in a row under the cell (tokens 0 to 2).
      RNN.words.forEach((w, i) => {
        const p = RNN.slots[i];
        k.add(k.box(0.54, 0.24, 0.05), {
          pos: add(p, [0, 0, 0.09]),
          flat: 0.2,
          weight: 1.5,
          pattern: false,
          kind: "token",
          params: [i, 0],
          color: (c) => {
            const edge = Math.min(0.27 - Math.abs(c.p[0] - p[0]), 0.12 - Math.abs(c.p[1] - p[1]));
            return keep(edge < 0.014 ? RNN.wordColors[i] : "#10172a");
          },
        });
        text(k, w, add(p, [0, 0, 0.118]), 0.025, RNN.wordColors[i], {
          kind: "token",
          params: [i, 0],
        });
      });
      text(k, "→", [0, -0.35, 0.003], 0.02, "#6f7fa6");
    },
  },
  transformer: {
    options: [VIEW_OPTION],
    controls: [{ key: "go", label: "Predict", type: "pulse", ease: 5 }],
    action: { key: "go", label: "Predict the next word" },
    // Arcs of light jump between the word tiles (thicker where attention is
    // stronger, a colour for each head); the tiles rise through the
    // feed-forward block to the next layer, where new arcs jump, then up
    // through its block to the top; the next word drops into place at the
    // end of the row.
    drive(t, c, out) {
      const s = since(c.go, 5);
      const on = s >= 0;
      const draw = (a, b, e0, e1) => (on ? ease(band(s, a, b)) * (1 - ease(band(s, e0, e1))) : 0);
      out.morph = [draw(0.05, 0.45, 0.75, 0.95), draw(0.3, 0.7, 0.8, 1.0), draw(1.6, 2.0, 2.3, 2.5), draw(1.85, 2.25, 2.35, 2.55)]; // prettier-ignore
      // The tiles rise level by level and drop back home at the end.
      const L = TF.levels;
      let y = 0;
      if (on) {
        y = (L[1] - L[0]) * ease(band(s, 0.95, 1.5));
        y += (L[2] - L[1]) * ease(band(s, 2.5, 3.05));
        y *= 1 - ease(band(s, 3.55, 4.1));
      }
      out.tokens = [];
      for (let i = 0; i < 4; i++) out.tokens[i] = { offset: [0, y, 0], visible: 1 };
      // The next word: appears at the top at 3.1 s and drops into the row.
      const drop = ease(band(s, 3.35, 3.95));
      const pop = on ? band(s, 3.1, 3.2) * (1 - band(s, 4.6, 4.9)) : 0;
      out.tokens[4] = pop > 0 ? { offset: [0, (L[2] - L[0]) * (1 - drop), 0], visible: pop } : { visible: 0 }; // prettier-ignore
      // The feed-forward blocks glow as the tiles pass through.
      out.parts.ffn0 = { visible: on && s > 1.05 && s < 1.5 ? 1 : 0 };
      out.parts.ffn1 = { visible: on && s > 2.6 && s < 3.05 ? 1 : 0 };
      out.resort = resortSteps(this, "tf", on ? s : -1, 0.95, 4.15, 0.15);
    },
    build(k, o) {
      if (o.view === "model") return buildTransformer3D(k);
      board(k, 3.3, 2.4, { at: [-0.23, 0.12] });
      const z = 0.1;
      // The feed-forward blocks: frames the tiles rise through, and a lit
      // copy of each (a part).
      TF.ffn.forEach((fy, i) => {
        const w = 2.12;
        const h = 0.26;
        const cx = -0.26;
        const part = k.part("ffn" + i, { pivot: [cx, fy, 0] });
        for (const [lit_, opts] of [
          [false, { color: "#56688f" }],
          [true, { color: "#9fe8ff", part }],
        ])
          for (const [dx, dy, sx, sy] of [
            [0, h / 2, w, 0.035],
            [0, -h / 2, w, 0.035],
            [w / 2, 0, 0.035, h],
            [-w / 2, 0, 0.035, h],
          ])
            k.add(k.box(sx, sy, 0.03), {
              pos: [cx + dx, fy + dy, 0.02 + (lit_ ? 0.012 : 0)],
              flat: 0.3,
              weight: 1.6,
              size: lit_ ? 1.2 : 1,
              pattern: false,
              ...opts,
              color: () => keep(opts.color),
            });
        text(k, "FFN", [-1.4, fy, 0.003], 0.019, "#9fb0d6", { align: "right" });
      });
      for (const y of [TF.row, TF.levels[1]])
        text(k, "ATTN", [-1.4, y + 0.26, 0.003], 0.019, "#9fb0d6", { align: "right" });
      // Attention arcs: tubes that draw from one tile to another as their
      // channel rises (layer 1: channels 0 and 1; layer 2: 2 and 3).
      TF.heads.forEach((layer, l) =>
        layer.forEach((arcs, h) =>
          arcs.forEach(([a, b, w]) => {
            const y0 = TF.levels[l] + TF_TILE[1] / 2 + 0.01;
            const xa = TF.xs[a] + (h ? 0.05 : -0.05);
            const xb = TF.xs[b] + (h ? 0.05 : -0.05);
            const lift = 0.08 + 0.07 * Math.abs(a - b) + (h ? 0.04 : 0);
            const zz = z + 0.03 + 0.01 * h;
            const curve = (t) => [xa + (xb - xa) * t, y0 + lift * Math.sin(Math.PI * t), zz];
            k.add(k.tube(curve, 0.007 + 0.02 * w, { grid: 40 }), {
              flat: 0.4,
              weight: 1.6,
              pattern: false,
              kind: "fade",
              params: (c) => [c.t * 0.82, -0.18],
              channel: l * 2 + h,
              color: (c) => keep(mix(TF_HEADS[h], "#ffffff", 0.3 * Math.max(0, c.n[2]))),
            });
          }),
        ),
      );
      // The word tiles (tokens 0 to 3), their row's slots, and the next word
      // (token 4), built where it lands.
      TF.xs.forEach((x) =>
        k.add(k.box(TF_TILE[0] + 0.04, TF_TILE[1] + 0.04, 0.01), {
          pos: [x, TF.row, 0.005],
          flat: 0.2,
          pattern: false,
          color: () => keep("#232c45"),
        }),
      );
      TF.words.forEach((w, i) => wordTile(k, w, [TF.xs[i], TF.row, z], "#e8eefc", i));
      wordTile(k, TF.next, [TF.xs[4], TF.row, z], "#ffd34d", 4);
      k.reach([TF.xs[4], TF.levels[2] + 0.15, z]);
    },
  },
  "looped-transformer": {
    options: [VIEW_OPTION],
    controls: [{ key: "go", label: "Think", type: "pulse", ease: 5 }],
    action: { key: "go", label: "Loop until it's sure" },
    // The row of tiles rides round the loop three times. Each pass through
    // the block sharpens every tile's mark one step (noise, a coarse mosaic,
    // nearly right, exact), until "3 + 4 = 7" settles; then the marks go
    // back to noise for the next go.
    drive(t, c, out, info) {
      const s = since(c.go, 5);
      const on = s >= 0;
      const L = LOOP;
      const at = info.data?.view === "model" ? (d) => loopTilt(L.at(d)) : L.at;
      // Distance travelled: three laps between 0.2 s and 4.0 s, easing in
      // and out.
      const D = on ? 3 * L.P * ease(band(s, 0.2, 4.0)) : 0;
      const blur = on ? band(s, 4.45, 4.9) : 0;
      out.tokens = [];
      let inBlock = false;
      L.rest.forEach((d0, i) => {
        const d = d0 + D;
        const p = L.at(d);
        const off = sub(at(d), at(d0));
        let level = clamp(Math.floor((d - L.block) / L.P) + 1, 0, 3);
        if (blur > 0) level = Math.min(level, 3 - Math.min(3, Math.floor(blur * 4)));
        for (let v = 0; v < 4; v++) out.tokens[i * 4 + v] = { offset: off, visible: v === level ? 1 : 0 }; // prettier-ignore
        out.tokens[20 + i] = { offset: off, visible: 1 };
        if (p[1] > 0 && Math.abs(p[0]) < L.half) inBlock = true;
      });
      out.parts.block = { visible: on && inBlock && s < 4.1 ? 1 : 0 };
      out.resort = resortSteps(this, "loop", on ? s : -1, 0.2, 4.05, 0.12);
    },
    build(k, o) {
      if (o.view === "model") return buildLoop3D(k);
      const L = LOOP;
      board(k, 2.5, 1.8, { at: [0, 0.03] });
      const z = 0.04;
      // The track.
      const track = [];
      for (let i = 0; i <= 160; i++) track.push(add(L.at((L.P * i) / 160), [0, 0, z]));
      wire(k, track, 0.022, { color: "#56688f" });
      // The block: a frame round the top straight, and a lit copy (a part).
      const bw = 2 * L.half + 0.12;
      const bh = L.tile + 0.2;
      const part = k.part("block", { pivot: [0, L.r, 0] });
      for (const [glow, color] of [
        [false, "#6b7ca6"],
        [true, "#9fe8ff"],
      ])
        for (const [dx, dy, sx, sy] of [
          [0, bh / 2, bw, 0.035],
          [0, -bh / 2, bw, 0.035],
          [bw / 2, 0, 0.035, bh],
          [-bw / 2, 0, 0.035, bh],
        ])
          k.add(k.box(sx, sy, 0.03), {
            pos: [dx, L.r + dy, 0.03 + (glow ? 0.012 : 0)],
            flat: 0.3,
            weight: 1.6,
            size: glow ? 1.2 : 1,
            pattern: false,
            ...(glow ? { part } : {}),
            color: () => keep(color),
          });
      text(k, "BLOCK", [0, L.r + bh / 2 + 0.07, 0.003], 0.018, "#9fb0d6");
      text(k, "→", [0, -L.r - 0.19, 0.003], 0.02, "#6f7fa6");
      // The tiles: a backing (tokens 20 to 24) and each mark at four levels
      // (token i * 4 + level), pixels as bright as they are sure.
      const T = L.tile;
      const px = 0.028;
      L.rest.forEach((d0, i) => {
        const p = add(L.at(d0), [0, 0, 0.1]);
        k.add(k.box(T, T, 0.04), {
          pos: p,
          flat: 0.2,
          weight: 1.5,
          pattern: false,
          kind: "token",
          params: [20 + i, 0],
          color: (c) => {
            const edge = Math.min(T / 2 - Math.abs(c.p[0] - p[0]), T / 2 - Math.abs(c.p[1] - p[1]));
            return keep(edge < 0.012 ? "#6b7ca6" : "#0d1324");
          },
        });
        const answer = i === L.marks.length - 1;
        L.levels[i].forEach((grid, v) => {
          const x0 = p[0] - 2.5 * px;
          const y0 = p[1] + 3.5 * px;
          k.add(
            k.param((u, w) => [x0 + u * 5 * px, y0 - w * 7 * px, p[2] + 0.022], {
              grid: 24,
              normal: () => [0, 0, 1],
            }),
            {
              weight: 3.5,
              flat: 0.2,
              pattern: false,
              kind: "token",
              params: [i * 4 + v, 0],
              color: (c) => {
                const gx = Math.min(4, Math.floor(c.u * 5));
                const gy = Math.min(6, Math.floor(c.v * 7));
                const val = grid[gy][gx];
                if (val < 0.12) return null;
                const hi = v === 3 && answer ? "#ffd34d" : "#7ff6ff";
                return keep(mix("#1e3558", hi, val));
              },
            },
          );
        });
      });
    },
  },
  "diffusion-model": {
    options: [VIEW_OPTION],
    controls: [{ key: "go", label: "Denoise", type: "pulse", ease: 5 }],
    action: { key: "go", label: "Denoise" },
    // A cloud of random specks clears in ten steps into a crisp rubber
    // duck while the step counter runs down from 50 to 0; then the noise
    // washes back over it.
    drive(t, c, out, info) {
      const s = since(c.go, 5);
      const on = s >= 0;
      let w = 0;
      let n = 0;
      if (on) {
        const st = diffStep(s);
        const back = ease(band(s, 4.0, 4.8));
        w = st.w * (1 - back);
        n = Math.round(st.n * (1 - back));
      }
      out.morph = [w, w];
      // The 3D model: once the specks have landed (step 0), a solid copy of
      // the duck, sorted as it stands, takes their place (specks sort where
      // they rested, so from all round the duck's far side would show).
      if (info.data?.view === "model") {
        const solid = w > 0.97;
        out.parts.solid = { visible: solid ? 1 : 0 };
        out.parts.specks = { visible: solid ? 0 : 1 };
      }
      out.tokens = [];
      const left = 50 - 5 * n;
      showDigit(out.tokens, 0, left >= 10 ? Math.floor(left / 10) : -1);
      showDigit(out.tokens, 7, left % 10);
    },
    build(k, o) {
      const model = o.view === "model";
      const G = model ? DIFF3D : DIFF;
      k.data = { view: model ? "model" : "poster" };
      if (model) stand(k, 0.95, -0.82);
      else board(k, 2.1, 2.2, { at: [0, 0.05] });
      // Where the specks rest: a Gaussian cloud about the duck, clipped.
      const gauss = (rand) => {
        for (;;) {
          const v = [0, 1, 2].map(() => {
            const u = 1 - rand();
            return Math.sqrt(-2 * Math.log(u)) * Math.cos(TAU * rand());
          });
          if (len(v) < 2.3) return v;
        }
      };
      const spread = G.spread || [0.36, 0.3, 0.22];
      const cloudAt = (rand) => {
        const g = gauss(rand);
        return add(G.c, [g[0] * spread[0], g[1] * spread[1], g[2] * spread[2]]);
      };
      // The duck's surface, shared out between its ellipsoids by area, with
      // points inside another ellipsoid left out.
      const inside = (p, skip) =>
        DUCK.some(([c, r], j) => j !== skip && ((p[0] - c[0]) / r[0]) ** 2 + ((p[1] - c[1]) / r[1]) ** 2 + ((p[2] - c[2]) / r[2]) ** 2 < 0.97); // prettier-ignore
      const shapes = DUCK.map(([, r]) => k.ellipsoid(r[0], r[1], r[2]));
      const areas = shapes.map((sh) => sh.area);
      const total = areas.reduce((a, b) => a + b, 0);
      // A point on the duck, its normal and its colour.
      const duckPoint = (rand) => {
        for (let tries = 0; tries < 40; tries++) {
          let x = rand() * total;
          let j = 0;
          while (x > areas[j]) x -= areas[j++];
          const [c, r, col] = DUCK[Math.min(j, DUCK.length - 1)];
          const sm = shapes[Math.min(j, DUCK.length - 1)].sample(rand);
          const p = add(c, sm.p);
          if (p[1] < -0.27 || inside(p, j)) continue;
          const eye = DUCK_EYES.some((e) => len(sub(p, e)) < 0.062);
          const glint = DUCK_EYES.some((e) => len(sub(p, add(e, [0.02, 0.025, 0]))) < 0.022);
          const q = duckPlace(p, G);
          const n = unit(sub(duckPlace(add(p, sm.n), G), duckPlace([0, 0, 0], G)));
          const color = glint
            ? "#ffffff"
            : eye
              ? "#141414"
              : lit(col, n, { amb: 0.72, dif: 0.38, spec: 0.35, pow: 24 });
          return { q, n, color };
        }
        return null;
      };
      const specks = model ? k.part("specks", { pivot: G.c }) : 0;
      k.cloud({ share: model ? 0.36 : 0.45, size: 0.95, pattern: false }, (rand) => {
        const d = duckPoint(rand);
        if (!d) return null;
        const g = cloudAt(rand);
        // On the poster the specks keep their depth on the duck: splats sort
        // by where they rest, so its far side stays behind its near side.
        const p = model ? g : [g[0], g[1], d.q[2] + (g[2] - G.c[2]) * 0.15];
        return { p, to: d.q, n: d.n, flat: 0.45, color: d.color, channel: 0, part: specks };
      });
      if (model) {
        const solid = k.part("solid", { pivot: G.c });
        k.cloud({ share: 0.36, size: 0.95, pattern: false }, (rand) => {
          const d = duckPoint(rand);
          return d && { p: d.q, n: d.n, flat: 0.45, color: d.color, part: solid };
        });
      }
      // Loose coloured specks that clear, step by step, on channel 1.
      k.cloud({ share: model ? 0.2 : 0.22, size: 0.9, pattern: false }, (rand) => ({
        p: cloudAt(rand),
        color: [rand(), rand(), rand()],
        kind: "fade",
        params: [0.05 + 0.9 * rand(), 0.06],
        channel: 1,
      }));
      // The step counter (in the 3D model, a little display on the stand).
      const cy = -0.82 + (model ? 0.25 : 0);
      const cz = model ? 0.62 : 0;
      k.add(k.box(1.0, 0.36, model ? 0.12 : 0.03), {
        pos: [0, cy, cz + (model ? -0.045 : 0.015)],
        flat: 0.2,
        even: model,
        pattern: false,
        color: (c) =>
          keep(c.s.face !== 4 && model ? BOARD_RIM : Math.abs(c.p[1] - cy) > 0.16 || Math.abs(c.p[0]) > 0.48 ? BOARD_RIM : "#0b1020"), // prettier-ignore
      });
      text(k, "STEP", [-0.24, cy, cz + 0.034], 0.022, "#9fb0d6");
      sevenSeg(k, [0.16, cy, cz + 0.034], 0.22, 0);
      sevenSeg(k, [0.34, cy, cz + 0.034], 0.22, 7);
    },
  },
  "gradient-descent": {
    options: [
      {
        key: "rate",
        label: "Learning rate",
        type: "select",
        default: "good",
        choices: [
          { id: "low", label: "Too low" },
          { id: "good", label: "Just right" },
          { id: "high", label: "Too high" },
        ],
      },
    ],
    controls: [{ key: "go", label: "Descend", type: "pulse", ease: 4.5 }],
    action: { key: "go", label: "Roll downhill" },
    // The ball takes 21 steps of gradient descent, each a hop downhill,
    // leaving a trail of dots: just right, it overshoots the valley and
    // settles in it; too low, it creeps; too high, it bounces from wall to
    // wall. Then it flies back to the start.
    drive(t, c, out, info) {
      const s = since(c.go, 4.5);
      const on = s >= 0;
      const pts = info.data?.path || GD.paths.good;
      const N = pts.length - 1;
      const k = on ? (s - GD.t0) / GD.dt : -1;
      let p = pts[0];
      if (on && k > 0) {
        const i = Math.min(N - 1, Math.floor(k));
        const f = k >= N ? 1 : ease(k - i);
        const a = pts[i];
        const b = pts[i + 1];
        const d = Math.hypot(b[0] - a[0], b[2] - a[2]);
        p = add(lerp3(a, b, f), [0, (0.03 + 0.35 * d) * Math.sin(Math.PI * f), 0]);
      }
      // Back to the start at the end, in one high arc.
      const home = on ? ease(band(s, 3.95, 4.45)) : 0;
      if (home > 0) p = add(lerp3(pts[N], pts[0], home), [0, 0.45 * Math.sin(Math.PI * home), 0]);
      out.tokens = [{ offset: sub(p, pts[0]), visible: 1 }];
      out.morph = [on ? clamp01((k + 0.5) / N) * (1 - band(s, 3.95, 4.3)) : 0];
      out.resort = resortSteps(this, "gd", on ? s : -1, GD.t0, 4.5, GD.dt);
    },
    build(k, o) {
      const { f, H, R } = GD;
      const pts = GD.paths[o.rate] || GD.paths.good;
      k.data = { path: pts };
      const loss = ["#1b3a8a", "#1f8fb3", "#3cc48a", "#d9d24a", "#f08a3c", "#d94a3c"];
      const shade01 = (v) => clamp01((v + 0.3) / 1.25);
      // The landscape, coloured by height with contour lines.
      k.add(
        k.param((u, v) => {
          const x = -1 + 2 * u;
          const z = -1 + 2 * v;
          return [x, f(x, z) * H, z];
        }, { grid: 90, flip: true }), // prettier-ignore
        {
          even: true,
          flat: 0.25,
          jitter: 0.01,
          color: (c) => {
            const val = f(c.p[0], c.p[2]);
            const line = Math.abs(((val * 10) % 1) + 1) % 1;
            let col = ramp(loss, shade01(val));
            if (Math.min(line, 1 - line) < 0.06) col = shade(col, 0.72);
            return lit(col, c.n, { amb: 0.65, dif: 0.45, spec: 0.15 });
          },
        },
      );
      // Its sides, down to a flat base.
      const base = -0.45;
      const sides = [
        (t) => [-1 + 2 * t, 1],
        (t) => [1, 1 - 2 * t],
        (t) => [1 - 2 * t, -1],
        (t) => [-1, -1 + 2 * t],
      ];
      sides.forEach((edge) =>
        k.add(
          k.param((u, v) => {
            const [x, z] = edge(u);
            return [x, base + (f(x, z) * H - base) * v, z];
          }, { grid: 40, flip: true }), // prettier-ignore
          {
            flat: 0.3,
            weight: 1.6,
            even: true,
            color: (c) => lit(mix("#1b2438", "#2d3a5a", (c.p[1] - base) / 0.8), c.n, { amb: 0.7, dif: 0.35, spec: 0 }), // prettier-ignore
          },
        ),
      );
      // The trail: a dot at each step, shown as the ball lands (channel 0).
      const N = pts.length - 1;
      pts.forEach((p, i) =>
        k.add(k.sphere(0.018), {
          pos: [p[0], p[1] - R + 0.012, p[2]],
          flat: 0.4,
          weight: 4,
          pattern: false,
          kind: "fade",
          params: [i / N - 0.02, -0.02],
          channel: 0,
          color: () => keep("#ffffff"),
        }),
      );
      // The ball: glossy red, lit from a fixed light (it hops, it does not
      // spin), on token 0.
      k.add(k.sphere(R), {
        pos: pts[0],
        even: true,
        flat: 0.35,
        weight: 3,
        pattern: false,
        kind: "token",
        params: [0, 0],
        color: (c) => keep(lit("#e0283c", c.n, { amb: 0.6, dif: 0.5, spec: 0.8, pow: 30 })),
      });
      k.reach([0, 0.9, 0]);
    },
  },
  "word-vectors": {
    options: [
      { key: "a", label: "Word A", type: "text", default: "king", hidden: true },
      { key: "b", label: "Word B", type: "text", default: "man", hidden: true },
      { key: "c", label: "Word C", type: "text", default: "woman", hidden: true },
    ],
    async prepare() {
      await loadWords();
    },
    input: {
      title: "Your own words",
      placeholder: "king - man + woman",
      button: "Add them",
      fileButton: "Open a text file…",
      accept: ".txt",
      note: "Type A - B + C with three common English words (24,000 are built in, from GloVe). It works out A − B + C over all 50 dimensions and shows the nearest of the 10,000 most common words, with the runner-up in gray. A text file with the sum in it works too.",
      async read(text) {
        await loadWords();
        const [a, b, c] = parseSum(text);
        return { a, b, c };
      },
      shown: () => WV_SHOWN.label,
    },
    credits: [
      {
        label: "Word vectors",
        title:
          "GloVe: Global Vectors for Word Representation (Wikipedia 2014 + Gigaword 5, 50 dimensions)",
        source: "https://nlp.stanford.edu/projects/glove/",
        author: "Jeffrey Pennington, Richard Socher and Christopher D. Manning",
        license: "ODC Public Domain Dedication and License 1.0",
        licenseUrl: "https://opendatacommons.org/licenses/pddl/1.0/",
      },
    ],
    controls: [{ key: "go", label: "Add", type: "pulse", ease: 4 }],
    action: { key: "go", label: "A − B + C" },
    // A pink arrow runs from B to A (A − B) and a blue one from B to C; the
    // same two steps run on from C and from A, closing the parallelogram at
    // A − B + C, which lands next to the answer, and the answer lights up.
    drive(t, c, out) {
      const s = since(c.go, 4);
      const on = s >= 0;
      const draw = (a) => (on ? ease(band(s, a, a + 0.55)) * (1 - ease(band(s, 3.35, 3.8))) : 0);
      out.morph = [draw(0.15), draw(0.85), draw(1.55), on ? band(s, 2.25, 2.35) * (1 - band(s, 3.4, 3.8)) : 0]; // prettier-ignore
    },
    build(k, o) {
      let a = String(o.a || "king").toLowerCase();
      let b = String(o.b || "man").toLowerCase();
      let c = String(o.c || "woman").toLowerCase();
      if (![a, b, c].every((w) => WORDS.index?.has(w)) || new Set([a, b, c]).size < 3)
        [a, b, c] = ["king", "man", "woman"];
      const L = wvLayout(a, b, c);
      const { at, words } = L;
      WV_SHOWN.label = `${a} − ${b} + ${c} ≈ ${words.answer}`;
      const F = L.floor;
      // The floor: a dark plate with a grid, under all the words.
      const fw = Math.max(2.1, (L.span[0] * 1.25) / 1.25 + 0.9);
      k.add(k.box(fw, 0.04, 1.7), {
        pos: [0, F - 0.02, 0],
        even: true,
        flat: 0.25,
        color: (cc) => {
          if (cc.s.face !== 2) return keep(BOARD_RIM);
          const gx = Math.abs(((cc.p[0] / 0.2) % 1) + 1) % 1;
          const gz = Math.abs(((cc.p[2] / 0.2) % 1) + 1) % 1;
          return keep(Math.min(gx, 1 - gx, gz, 1 - gz) < 0.05 ? "#2d3a5c" : BOARD);
        },
      });
      // The words: a glowing point, a stem down to the floor and a sign.
      const colors = {
        a: "#ffc93c",
        b: "#5fb4ff",
        c: "#5fb4ff",
        answer: "#ffc93c",
        runner: "#9aa3b5",
      };
      for (const key of ["a", "b", "c", "answer", "runner"]) {
        const p = at[key];
        const col = colors[key];
        k.add(k.sphere(0.045), {
          pos: p,
          flat: 0.4,
          weight: 3,
          pattern: false,
          color: (cc) => keep(mix(col, "#ffffff", 0.5 * Math.max(0, cc.n[1]))),
        });
        const h = Math.max(0.02, p[1] - F);
        k.add(k.cylinder(0.006, h), {
          pos: [p[0], F + h / 2, p[2]],
          flat: 0.4,
          weight: 1.5,
          pattern: false,
          color: () => keep(mix(col, BOARD, 0.5)),
        });
        k.add(k.disc(0.05), {
          pos: [p[0], F + 0.003, p[2]],
          flat: 0.2,
          pattern: false,
          color: () => keep(mix(col, BOARD, 0.55)),
        });
        const lift = key === "runner" ? -0.13 : 0.13;
        sign(k, words[key].toUpperCase(), add(p, [0, lift, 0]), 0.015, { color: col });
      }
      // The answer lights up (channel 3): a halo round its point and a lit
      // sign.
      k.add(k.sphere(0.075), {
        pos: at.answer,
        flat: 0.5,
        size: 1.3,
        opacity: 0.4,
        pattern: false,
        kind: "fade",
        params: [0, -0.5],
        channel: 3,
        color: () => keep("#fff1a8"),
      });
      const qw = (textWidth(words.answer) + 5) * 0.015;
      k.add(k.box(qw + 0.04, 12 * 0.015 + 0.04, 0.01), {
        pos: add(at.answer, [0, 0.13, -0.03]),
        flat: 0.2,
        pattern: false,
        kind: "fade",
        params: [0, -0.5],
        channel: 3,
        color: () => keep("#ffd34d"),
      });
      // The arrows: B to A, B to C, then the same two steps from C and from
      // A, meeting at A − B + C.
      arrow(k, at.b, at.a, 0.014, "#ff6fb5", 0);
      arrow(k, at.b, at.c, 0.014, "#4fc3ff", 1);
      arrow(k, at.a, at.sum, 0.014, "#4fc3ff", 2);
      arrow(k, at.c, at.sum, 0.014, "#ff6fb5", 2);
      // Where the sum lands: a small white point.
      k.add(k.sphere(0.03), {
        pos: at.sum,
        flat: 0.4,
        weight: 3,
        pattern: false,
        kind: "fade",
        params: [0, -0.5],
        channel: 3,
        color: () => keep("#ffffff"),
      });
      k.data = { words };
    },
  },
  "sorting-machine": {
    options: [
      {
        key: "algo",
        label: "Algorithm",
        type: "select",
        default: "bubble",
        choices: [
          { id: "bubble", label: "Bubble sort" },
          { id: "quick", label: "Quicksort" },
          { id: "merge", label: "Merge sort" },
          { id: "insertion", label: "Insertion sort" },
          { id: "selection", label: "Selection sort" },
          { id: "cocktail", label: "Cocktail shaker sort" },
          { id: "shell", label: "Shell sort" },
          { id: "heap", label: "Heap sort" },
        ],
      },
    ],
    controls: [{ key: "go", label: "Sort", type: "pulse", ease: 5 }],
    action: { key: "go", label: "Sort the bars" },
    // The bars sort themselves, each swap or move a solid bar gliding to its
    // new place (bars going right pass in front, bars going left behind),
    // and the counter counts them; then the bars shuffle back.
    drive(t, c, out, info) {
      const s = since(c.go, 5);
      const on = s >= 0;
      const list = info.data?.steps || SORT.steps.bubble;
      const n = list.length;
      const dt = Math.min(0.34, (SORT.t1 - SORT.t0) / n);
      const k = on ? (s - SORT.t0) / dt : -1;
      const i = on && k > 0 ? Math.min(n, Math.floor(k) + 1) : 0;
      const f = on && k > 0 && k < n ? ease(clamp01((k - (i - 1)) / 0.85)) : 1;
      const from = i > 0 ? (i > 1 ? list[i - 2] : SORT.start) : SORT.start;
      const to = i > 0 ? list[i - 1] : SORT.start;
      const back = on ? ease(band(s, 4.3, 4.9)) : 0;
      const sorted = list[n - 1];
      out.tokens = [];
      for (let v = 0; v < 8; v++) {
        const home = SORT.x(SORT.start.indexOf(v));
        let x;
        let y = 0;
        let z = 0;
        if (back > 0) {
          const a = SORT.x(sorted.indexOf(v));
          x = a + (home - a) * back;
          y = 0.08 * Math.sin(Math.PI * back);
          z = Math.sign(home - a) * (0.12 + 0.03 * v) * Math.sin(Math.PI * back);
        } else {
          const a = SORT.x(from.indexOf(v));
          const b = SORT.x(to.indexOf(v));
          x = a + (b - a) * f;
          z = Math.sign(b - a) * 0.2 * Math.sin(Math.PI * f);
        }
        out.tokens[v] = { offset: [x - home, y, z], visible: 1 };
      }
      const count = back > 0 ? 0 : i;
      showDigit(out.tokens, 8, count >= 10 ? Math.floor(count / 10) : -1);
      showDigit(out.tokens, 15, count % 10);
      out.resort = resortSteps(this, "sort", on ? s : -1, SORT.t0, 4.95, dt);
    },
    build(k, o) {
      const algo = SORT.steps[o.algo] ? o.algo : "bubble";
      k.data = { steps: SORT.steps[algo] };
      // The base: a dark plinth with a slot for each bar.
      k.add(k.box(2.2, 0.12, 0.7), {
        pos: [0, -0.06, 0],
        even: true,
        flat: 0.25,
        color: (c) => lit(c.s.face === 2 ? "#1e2740" : "#2a3552", c.n, { amb: 0.75, dif: 0.35, spec: 0.15 }), // prettier-ignore
      });
      for (let slot = 0; slot < 8; slot++)
        k.add(k.box(0.2, 0.004, 0.2), {
          pos: [SORT.x(slot), 0.002, 0],
          flat: 0.2,
          pattern: false,
          color: () => keep("#141b2b"),
        });
      // The bars (token = the bar's height, 0 to 7), in their shuffled order.
      SORT.start.forEach((v, slot) => {
        const h = SORT.height(v);
        k.add(k.box(0.17, h, 0.17), {
          pos: [SORT.x(slot), 0.004 + h / 2, 0],
          even: true,
          flat: 0.25,
          weight: 1.3,
          pattern: false,
          kind: "token",
          params: [v, 0],
          color: (c) => keep(lit(SORT.colors[v], c.n, { amb: 0.7, dif: 0.4, spec: 0.3 })),
        });
      });
      // The algorithm's name and the counter, on a panel behind the bars.
      const cy = 1.34;
      const pw = 1.7;
      const ph = 0.6;
      k.add(k.box(pw, ph, 0.05), {
        pos: [0, cy + 0.12, -0.3],
        flat: 0.2,
        even: true,
        pattern: false,
        color: (c) =>
          keep(Math.abs(c.p[1] - cy - 0.12) > ph / 2 - 0.03 || Math.abs(c.p[0]) > pw / 2 - 0.03 ? BOARD_RIM : "#0b1020"), // prettier-ignore
      });
      k.add(k.box(0.05, 1.1, 0.05), { pos: [0, 0.55, -0.3], flat: 0.3, pattern: false, color: () => keep(BOARD_RIM) }); // prettier-ignore
      text(k, SORT.names[algo], [0, cy + 0.27, -0.255], 0.018, "#ffd34d");
      text(k, algo === "merge" ? "MOVES" : "SWAPS", [-0.22, cy, -0.255], 0.022, "#9fb0d6");
      sevenSeg(k, [0.26, cy, -0.27], 0.22, 8);
      sevenSeg(k, [0.44, cy, -0.27], 0.22, 15);
    },
  },
  "half-adder": {
    controls: [{ key: "go", label: "Add", type: "pulse", ease: 3.5 }],
    action: { key: "go", label: "Add 1 + 1" },
    // Both switches flip to 1; light runs along the wires into the XOR and
    // AND gates, which glow as they fire; the XOR gives 0 (the sum lamp
    // stays dark), the AND gives 1 and lights the carry lamp: 1 + 1 = 10.
    drive(t, c, out) {
      const s = since(c.go, 3.5);
      const on = s >= 0;
      const off = on ? band(s, 2.85, 3.0) : 1;
      const flipA = on ? ease(band(s, 0.1, 0.25)) * (1 - ease(band(s, 2.85, 3.0))) : 0;
      const flipB = on ? ease(band(s, 0.35, 0.5)) * (1 - ease(band(s, 2.95, 3.1))) : 0;
      out.parts.leverA = { angle: -1.0 * flipA };
      out.parts.leverB = { angle: -1.0 * flipB };
      const aOn = flipA > 0.5;
      const bOn = flipB > 0.5;
      const carryOn = on && s > 2.0 && s < 3.0;
      out.parts.lampA = { visible: aOn ? 1 : 0 };
      out.parts.lampB = { visible: bOn ? 1 : 0 };
      out.parts.carryLamp = { visible: carryOn ? 1 : 0 };
      out.parts.sumLamp = { visible: 0 };
      out.parts.equation = { visible: carryOn ? 1 : 0 };
      out.tokens = [
        { visible: aOn ? 0 : 1 },
        { visible: aOn ? 1 : 0 },
        { visible: bOn ? 0 : 1 },
        { visible: bOn ? 1 : 0 },
        { visible: carryOn ? 0 : 1 },
        { visible: carryOn ? 1 : 0 },
      ];
      const flow = on ? band(s, 0.5, 1.2) * (1 - off) : 0;
      const carryFlow = on ? band(s, 1.5, 2.0) * (1 - off) : 0;
      const xorFlash = on ? bump(s, 1.2, 1.3, 1.45, 1.75) : 0;
      const andGlow = on ? band(s, 1.2, 1.3) * (1 - off) : 0;
      out.morph = [flow, carryFlow, xorFlash, andGlow];
    },
    build(k) {
      board(k, 2.75, 1.75);
      const { z } = HA;
      const dim = "#56688f";
      const glow = "#ffd34d";
      // Wires, each with a lit copy that fills with light.
      HA.inputs.forEach((pts) => {
        wire(k, pts, 0.018, { color: dim });
        wireLight(k, pts, 0.022, glow, 0);
      });
      for (const [x, y] of [[-0.62, HA.A[1]], [-0.44, HA.B[1]]]) // prettier-ignore
        k.add(k.sphere(0.03), { pos: [x, y, z], flat: 0.4, weight: 3, pattern: false, color: () => keep(dim) }); // prettier-ignore
      wire(k, HA.sumWire, 0.018, { color: dim });
      wire(k, HA.carryWire, 0.018, { color: dim });
      wireLight(k, HA.carryWire, 0.022, glow, 1);
      // The gates: a dark body inside an outline, and a lit outline over it
      // (the XOR flashes on channel 2, the AND glows on channel 3).
      const gate = (outline, label, c, channel, extra = []) => {
        const xs = outline.map((p) => p[0]);
        const ys = outline.map((p) => p[1]);
        const x0 = Math.min(...xs);
        const y0 = Math.min(...ys);
        const w = Math.max(...xs) - x0;
        const h = Math.max(...ys) - y0;
        k.add(k.param((u, v) => [x0 + u * w, y0 + v * h, z - 0.01], { grid: 32, normal: () => [0, 0, 1] }), {
          flat: 0.2,
          weight: 1.5,
          pattern: false,
          color: (cc) => (insidePoly(outline, cc.p[0], cc.p[1]) ? keep("#222c47") : null),
        }); // prettier-ignore
        for (const pts of [outline, ...extra]) {
          wire(k, pts, 0.02, { color: "#9aa8c8", weight: 2 });
          k.add(k.tube(polyline(pts), 0.026, { grid: 48 }), {
            flat: 0.35,
            weight: 2,
            pattern: false,
            kind: "fade",
            params: [0, -0.5],
            channel,
            color: () => keep(glow),
          });
        }
        text(k, label, [c[0] + 0.01, c[1], z + 0.01], 0.012, "#c7d3f0");
      };
      gate(HA.xorPts, "XOR", HA.xorC, 2, [HA.xorBack]);
      gate(HA.andPts, "AND", HA.andC, 3);
      // The switches: a plate, a lever that flips (a part), an input lamp
      // (a part) and its value, 0 or 1 (tokens).
      [HA.A, HA.B].forEach((p, i) => {
        const name = i ? "B" : "A";
        k.add(k.box(0.26, 0.16, 0.04), {
          pos: [p[0], p[1] - 0.04, 0.02],
          even: true,
          flat: 0.25,
          pattern: false,
          color: (c) => keep(lit("#3a4768", c.n, { amb: 0.8, dif: 0.3, spec: 0.2 })),
        });
        const pivot = [p[0], p[1] - 0.06, 0.05];
        const lever = k.part("lever" + name, { pivot, axis: [0, 0, 1] });
        k.add(k.tube((t) => [pivot[0] - 0.12 * t * Math.sin(0.5), pivot[1] + 0.2 * t, pivot[2]], 0.022, { grid: 20 }), {
          part: lever,
          flat: 0.35,
          weight: 2,
          pattern: false,
          color: (c) => keep(lit("#c9d2e6", c.n, { amb: 0.7, dif: 0.4, spec: 0.5 })),
        }); // prettier-ignore
        k.add(k.sphere(0.045), {
          pos: [pivot[0] - 0.12 * Math.sin(0.5), pivot[1] + 0.2, pivot[2]],
          part: lever,
          flat: 0.4,
          weight: 2.5,
          pattern: false,
          color: (c) => keep(lit("#e8413c", c.n, { amb: 0.7, dif: 0.4, spec: 0.6 })),
        });
        text(k, name, [p[0] - 0.24, p[1] + 0.02, 0.003], 0.024, "#9fb0d6");
        const lp = [p[0] + 0.02, p[1] - 0.24, z];
        const part = k.part("lamp" + name, { pivot: lp });
        lampLight(k, add(lp, [0, 0, 0.004]), 0.07, glow, { part, halo: false });
        text(k, "0", [lp[0], lp[1], z + 0.04], 0.016, "#9fb0d6", {
          kind: "token",
          params: [i * 2, 0],
        });
        text(k, "1", [lp[0], lp[1], z + 0.05], 0.016, "#1a1405", {
          kind: "token",
          params: [i * 2 + 1, 0],
        });
      });
      // The lamps: sum (stays dark: 1 XOR 1 is 0) and carry (lights), each
      // showing its bit.
      lamp(k, add(HA.sum, [0, 0, z]), 0.15, {
        on: glow,
        part: k.part("sumLamp", { pivot: HA.sum }),
      });
      lamp(k, add(HA.carry, [0, 0, z]), 0.15, { on: glow, part: k.part("carryLamp", { pivot: HA.carry }) }); // prettier-ignore
      text(k, "0", add(HA.sum, [0, 0, z + 0.1]), 0.024, "#9fb0d6");
      text(k, "0", add(HA.carry, [0, 0, z + 0.1]), 0.024, "#9fb0d6", {
        kind: "token",
        params: [4, 0],
      });
      text(k, "1", add(HA.carry, [0, 0, z + 0.11]), 0.024, "#1a1405", {
        kind: "token",
        params: [5, 0],
      });
      text(k, "SUM", add(HA.sum, [0, 0.26, 0.003 - z]), 0.018, "#9fb0d6");
      text(k, "CARRY", add(HA.carry, [0, 0.26, 0.003 - z]), 0.018, "#9fb0d6");
      // "1 + 1 = 10", shown as the carry lamp lights.
      const eq = k.part("equation", { pivot: [0.1, 0, 0] });
      sign(k, "1+1=10", [0.1, 0.0, 0.03], 0.022, { color: glow, part: eq });
    },
  },
};
