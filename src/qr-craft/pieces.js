// Lane QR craft: QR codes built from real things. Each module of the code is
// covered by a solid piece that moves like the real thing and comes to rest
// as the code (src/qr-craft/field.js moves them on the GPU):
//
//   dominoes  Every module is under a domino lying flat: ebony over dark
//             modules, ivory over light ones, two modules long where a row
//             has two of the same color side by side (a real domino's 2 : 1),
//             one module where it doesn't. They start standing on end, and a
//             bar pushes the first domino of every row: each row topples in a
//             chain, left to right, each domino knocking the next, and lies
//             down as the code.
//   marbles   First the code's three eyes and its alignment marks, dark
//             wooden frames, drop into the tray; then a dark glass marble
//             rolls in from the right along its row into each other dark
//             module and settles in it, the leftmost first, so none passes
//             another. It turns as it rolls (its distance over its radius).
//             (Round dots alone make jsQR's finder search unreliable; solid
//             eyes and alignment marks read at every size we tried.)
//   tiles     Every module is a square tile, light on one side and dark on
//             the other, all light side up; the dark modules' tiles flip over,
//             each about its own middle, in a wave out from the tap.
//
// Units: one module is 1; the code is centered on the origin in the XY plane,
// facing +Z (up from the table, toward the viewer); row 0 at the top. Each
// splat: { p, scales, quat, color, opacity, params: [a, b], pattern: false }
// with a = 1 + the piece's home module, b = kind + 16 × extra (field.js).

import { QUIET } from "../qr/encode.js";

export const MATERIALS = [
  { id: "dominoes", label: "Dominoes" },
  { id: "marbles", label: "Marbles" },
  { id: "tiles", label: "Flip tiles" },
];
export const materialById = (id) => MATERIALS.find((m) => m.id === id) || MATERIALS[0];

// The build's length on the toy's clock (seconds); each material's timings
// are scaled to end inside it.
export const BUILD_SECS = 6.5;
// Each piece's own motion (seconds).
export const FALL_SECS = 0.42; // a domino from standing to flat
export const ROLL_SECS = 1.5; // a marble from the edge to its module
export const FLIP_SECS = 0.7; // a tile turning over

// A tile's top is kind 5, its bottom 8 and its sides 9: a splat shows from
// both sides, and WebGL2 sorts the splats as they lie at rest, so a turned
// tile's faces are hidden while they face away.
export const KIND = { board: 0, domino: 3, marble: 4, tile: 5, bar: 6, frame: 7, tileBottom: 8, tileSide: 9 }; // prettier-ignore
export const DROP_SECS = 0.55; // a frame dropping into the tray
export const COLORS = {
  board: [0.97, 0.96, 0.93],
  ebony: [0.075, 0.075, 0.085],
  ivory: [0.95, 0.93, 0.87],
  marble: [0.06, 0.08, 0.16],
  swirl: [0.12, 0.2, 0.42],
  tileDark: [0.09, 0.1, 0.13],
  tileLight: [0.98, 0.97, 0.94],
  walnut: [0.085, 0.07, 0.065],
  bar: [0.55, 0.36, 0.2],
};
export const DOMINO_T = 0.3; // a domino's thickness (modules)
export const MARBLE_R = 0.49; // nearly touching, so the eyes read as rings
export const TILE_T = 0.12;

const mul = (c, f) => [c[0] * f, c[1] * f, c[2] * f];
const Q_FLAT = [0, 0, 0, 1];

// A flat rectangle of splats facing along an axis: two staggered lattices.
// face: "z+", "z-", "x+", "x-", "y+", "y-"; the rectangle spans the other two
// axes over [a0, a1] × [b0, b1] at `at` on its own axis.
const FACE_Q = {
  "z+": [0, 0, 0, 1],
  "z-": [1, 0, 0, 0],
  "x+": [0, Math.SQRT1_2, 0, Math.SQRT1_2],
  "x-": [0, -Math.SQRT1_2, 0, Math.SQRT1_2],
  "y+": [-Math.SQRT1_2, 0, 0, Math.SQRT1_2],
  "y-": [Math.SQRT1_2, 0, 0, Math.SQRT1_2],
};
function face(out, which, at, a0, a1, b0, b1, s, color, params, two = true) {
  const na = Math.max(1, Math.round((a1 - a0) / s));
  const nb = Math.max(1, Math.round((b1 - b0) / s));
  const sa = (a1 - a0) / na;
  const sb = (b1 - b0) / nb;
  const axis = which[0];
  for (let layer = 0; layer < (two ? 2 : 1); layer++)
    for (let j = 0; j < nb - layer; j++)
      for (let i = 0; i < na - layer; i++) {
        const a = a0 + (i + 0.5 + layer * 0.5) * sa;
        const b = b0 + (j + 0.5 + layer * 0.5) * sb;
        const col = typeof color === "function" ? color(a, b) : color;
        // Scales: across the face's two in-plane axes, thin along its normal.
        let p;
        let sc;
        if (axis === "z") {
          p = [a, b, at];
          sc = [0.55 * sa, 0.55 * sb, 0.01];
        } else if (axis === "x") {
          // spans (y, z): a = y, b = z; the quat turns local z to ±x, so the
          // local x axis lies along z and local y along y.
          p = [at, a, b];
          sc = [0.55 * sb, 0.55 * sa, 0.01];
        } else {
          // spans (x, z): a = x, b = z; local x stays x, local y turns to z.
          p = [a, at, b];
          sc = [0.55 * sa, 0.55 * sb, 0.01];
        }
        out.push({ p, scales: sc, quat: FACE_Q[which], color: col, opacity: 1, params, pattern: false }); // prettier-ignore
      }
}

// The board under the pieces: the code's area and its quiet zone, light.
function board(out, N, spacing = 0.34, right = 0) {
  const H = N / 2 + QUIET + 0.6;
  face(out, "z+", -0.02, -H, H + right, -H, H, spacing, COLORS.board, [0, KIND.board]);
}

// A box from (x0, y0, z0) to (x1, y1, z1) with each face's color.
// `fp`: other params for the bottom and the sides ({ bottom, side }), for a
// piece whose faces the GPU program shows only while they face the viewer.
function box(out, x0, y0, z0, x1, y1, z1, s, cols, params, fp = {}) {
  face(out, "z+", z1, x0, x1, y0, y1, s, cols.top, params);
  if (cols.bottom) face(out, "z-", z0, x0, x1, y0, y1, s * 1.3, cols.bottom, fp.bottom || params);
  face(out, "x+", x1, y0, y1, z0, z1, s, cols.side, fp.side || params, false);
  face(out, "x-", x0, y0, y1, z0, z1, s, cols.side, fp.side || params, false);
  face(out, "y+", y1, x0, x1, z0, z1, s, cols.end, fp.side || params, false);
  face(out, "y-", y0, x0, x1, z0, z1, s, cols.end, fp.side || params, false);
}

// ---- Layouts -----------------------------------------------------------------------------

// The dominoes: per row, runs of one color paired into 2-module dominoes (an
// odd run ends with a 1-module one). Each { r, c (left module), w, dark,
// start (s) }. The bar reaches the top row first (it leans), then each
// domino starts as the one before it hits it.
export function dominoLayout(code) {
  const N = code.size;
  const list = [];
  for (let r = 0; r < N; r++) {
    let t = 0.12 + 0.045 * r;
    let c = 0;
    while (c < N) {
      const dark = code.dark[r * N + c] === 1;
      const pair = c + 1 < N && (code.dark[r * N + c + 1] === 1) === dark;
      const w = pair ? 2 : 1;
      list.push({ r, c, w, dark, start: t });
      // The next one is hit when this one has fallen far enough for its top
      // to reach it (a longer domino reaches it later and harder).
      t += FALL_SECS * (w === 2 ? 0.62 : 0.5);
      c += w;
    }
  }
  return fit(list, FALL_SECS + 0.25);
}
// The marbles: one per dark module outside the eyes and alignment marks; per
// row the leftmost rolls first, after the frames are in.
export function marbleLayout(code) {
  const N = code.size;
  const list = [];
  for (let r = 0; r < N; r++) {
    let j = 0;
    for (let c = 0; c < N; c++)
      if (code.dark[r * N + c] && code.piece[r * N + c] < 0) list.push({ r, c, start: 0.05 * ((r * 7) % N) + 0.16 * j++ }); // prettier-ignore
  }
  fit(list, ROLL_SECS + 0.4 + 0.9);
  for (const m of list) m.start += 0.9;
  return list;
}
// The frames: each eye and alignment mark of the code, one piece each,
// dropping in one after another.
export function frameLayout(code) {
  return code.pieces.map((p, i) => ({ ...p, start: 0.12 * i }));
}
// The tiles: every module; the dark ones flip in a wave from (tx, ty).
export function tileLayout(code, tap = [0, 0]) {
  const N = code.size;
  const list = [];
  for (let r = 0; r < N; r++)
    for (let c = 0; c < N; c++) {
      const x = c - N / 2 + 0.5;
      const y = N / 2 - 0.5 - r;
      const d = Math.hypot(x - tap[0], y - tap[1]);
      const jitter = ((r * 73 + c * 151) % 17) / 17;
      list.push({ r, c, dark: code.dark[r * N + c] === 1, start: 0.13 * d + 0.12 * jitter });
    }
  return fit(list, FLIP_SECS + 0.3);
}
// Scales the start times so the last piece ends inside BUILD_SECS.
function fit(list, tail) {
  const last = Math.max(0, ...list.map((p) => p.start));
  const room = BUILD_SECS - tail;
  if (last > room) {
    const f = room / last;
    for (const p of list) p.start *= f;
  }
  return list;
}

// Start times go into the params' extra as milliseconds (+ flags below).
const ms = (s) => Math.max(0, Math.round(s * 1000));

// ---- Splats --------------------------------------------------------------------------------

// Returns { splats, half, layout }. `budget`: about how many splats to use.
export function buildPieces(code, material, budget = 200000, { tap = [0, 0] } = {}) {
  const N = code.size;
  const H = N / 2 + QUIET;
  const cx = (c) => c - N / 2; // a module's left edge
  const cy = (r) => N / 2 - r; // a module's top edge
  const make = (s) => {
    const out = [];
    // The marbles roll in over the board from its right side.
    board(out, N, 0.34, material === "marbles" ? 1.6 : 0);
    let layout;
    if (material === "marbles") {
      layout = marbleLayout(code);
      // The frames: the dark modules of each eye and alignment mark as one
      // solid walnut piece (its pivot the pattern's middle module).
      for (const f of frameLayout(code)) {
        const h = (f.n - 1) / 2;
        const params = [1 + (f.row + h) * N + (f.col + h), KIND.frame + 16 * ms(f.start)];
        for (let r = f.row; r < f.row + f.n; r++)
          for (let c = f.col; c < f.col + f.n; c++) {
            if (!code.dark[r * N + c]) continue;
            box(out, cx(c), cy(r) - 1, 0, cx(c) + 1, cy(r), 0.6, s, { top: COLORS.walnut, side: mul(COLORS.walnut, 1.7), end: mul(COLORS.walnut, 1.4) }, params); // prettier-ignore
          }
      }
      const n = Math.max(40, Math.round((4 * Math.PI * MARBLE_R * MARBLE_R) / (s * s * 0.55)));
      for (const m of layout) {
        const id = 1 + m.r * N + m.c;
        const params = [id, KIND.marble + 16 * ms(m.start)];
        const x = cx(m.c) + 0.5;
        const y = cy(m.r) - 0.5;
        // Points on the sphere (a Fibonacci lattice), each a small flat
        // splat tangent to it; a swirl band through the glass.
        for (let i = 0; i < n; i++) {
          const zz = 1 - (2 * (i + 0.5)) / n;
          const rr = Math.sqrt(1 - zz * zz);
          const ph = i * 2.399963229728653;
          const nx = rr * Math.cos(ph);
          const ny = rr * Math.sin(ph);
          const band = Math.abs(0.8 * nx + 0.6 * zz) < 0.22;
          const base = band ? COLORS.swirl : COLORS.marble;
          // Lit from the upper left, front (the field relights it as it turns).
          const lit = 0.55 + 0.45 * Math.max(0, -0.45 * nx + 0.5 * ny + 0.74 * zz);
          const sz = Math.sqrt((4 * Math.PI) / n) * MARBLE_R * 0.62;
          out.push({ p: [x + MARBLE_R * nx, y + MARBLE_R * ny, MARBLE_R + MARBLE_R * zz], scales: [sz, sz, 0.01], quat: quatTo([nx, ny, zz]), color: mul(base, lit), opacity: 1, params, pattern: false }); // prettier-ignore
        }
      }
      // A shallow dimple under each dark module: a darker ring on the board
      // reads as the cup each marble settles in (it sits under the marble).
    } else if (material === "tiles") {
      layout = tileLayout(code, tap);
      const g = 0.035; // the gap between tiles
      for (const t of layout) {
        const x0 = cx(t.c) + g;
        const x1 = cx(t.c) + 1 - g;
        const y1 = cy(t.r) - g;
        const y0 = cy(t.r) - 1 + g;
        const up = t.dark ? COLORS.tileDark : COLORS.tileLight;
        const down = t.dark ? COLORS.tileLight : COLORS.tileDark;
        // Only the dark modules' tiles flip; the others lie still.
        const id = 1 + t.r * N + t.c;
        const params = t.dark ? [id, KIND.tile] : [0, KIND.board];
        const fp = t.dark ? { bottom: [id, KIND.tileBottom], side: [id, KIND.tileSide] } : {};
        box(out, x0, y0, 0, x1, y1, TILE_T, s, { top: up, bottom: t.dark ? down : null, side: mul(COLORS.tileLight, 0.86), end: mul(COLORS.tileLight, 0.8) }, params, fp); // prettier-ignore
      }
    } else {
      layout = dominoLayout(code);
      const g = 0.03;
      for (const d of layout) {
        const x0 = cx(d.c) + g;
        const x1 = cx(d.c) + d.w - g;
        const y1 = cy(d.r) - g;
        const y0 = cy(d.r) - 1 + g;
        const top = d.dark ? COLORS.ebony : COLORS.ivory;
        // The line across a domino's middle (at the module edge, never on a
        // module's center).
        const mid = cx(d.c) + 1;
        const line = d.dark ? [0.42, 0.42, 0.42] : [0.62, 0.6, 0.55];
        const topColor = d.w === 2 ? (a) => (Math.abs(a - mid) < 0.035 ? line : top) : top;
        const params = [1 + d.r * N + d.c, KIND.domino + 16 * ms(d.start)];
        box(out, x0, y0, 0, x1, y1, DOMINO_T, s, { top: topColor, bottom: mul(top, d.dark ? 1.4 : 0.92), side: mul(top, d.dark ? 1.8 : 0.85), end: mul(top, d.dark ? 1.5 : 0.8) }, params); // prettier-ignore
      }
    }
    return { out, layout };
  };
  let s = 0.12;
  let r = make(s);
  while (r.out.length > budget && s < 0.4) {
    s *= 1.2;
    r = make(s);
  }
  return { splats: r.out, half: H, layout: r.layout, spacing: s };
}

// A quaternion turning +Z to the unit vector n.
function quatTo(n) {
  const [x, y, z] = n;
  if (z < -0.999999) return [1, 0, 0, 0];
  const w = 1 + z;
  const l = Math.hypot(-y, x, w);
  return [-y / l, x / l, 0, w / l];
}
export { Q_FLAT };
