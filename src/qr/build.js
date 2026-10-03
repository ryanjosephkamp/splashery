// Lane QR: a QR code as splats. Every dark module is a crisp, opaque cell of
// small flat splats with hard edges (no blur, no speckle, nothing see-through);
// the light modules and the quiet zone are one flat sheet behind them, and a
// plate (paper, wood or metal) can sit under it all. The finder patterns and
// the alignment patterns are their own pieces: each splat carries the piece it
// belongs to, so the toy's motions (src/qr/field.js) move every module, finder
// and alignment pattern as a solid piece of its own.
//
// Units: one module is 1. The code is centered on the origin in the XY plane,
// facing +Z (the viewer), row 0 at the top. Returns a flat list of splats for
// k.cloud: { p, scales, quat, color, opacity, params, pattern: false }.
//
// params [a, b]: a = 0 for a splat that never moves (the sheet, the plate),
// else 1 + the index of the piece's pivot module (row * size + col: the module
// itself, or the center module of its finder or alignment pattern); b = the
// piece's width in modules (1, 5 or 7) + 10 for the finder "eyes" (so a flip
// can turn them their own way).

import { QUIET } from "./encode.js";

export const STYLES = [
  { id: "classic", label: "Classic" },
  { id: "dots", label: "Dots" },
  { id: "rounded", label: "Rounded" },
  { id: "bricks", label: "Bricks" },
  { id: "gems", label: "Gems" },
  { id: "bubbles", label: "Bubbles" },
  { id: "neon", label: "Neon" },
];

// Each style's own colors and plate, set when the style is picked (the colors
// can be changed after). Every one keeps a strong contrast.
export const PRESETS = {
  classic: { fg: "#14161c", bg: "#ffffff", gradient: "none", eyes: "same", plate: "paper" },
  dots: { fg: "#1b2a4a", bg: "#ffffff", gradient: "none", eyes: "own", eye: "#c2372b", plate: "paper" }, // prettier-ignore
  rounded: { fg: "#0f5c4d", bg: "#f7f4ec", gradient: "linear", fg2: "#1d3f73", eyes: "same", plate: "paper" }, // prettier-ignore
  bricks: { fg: "#8f2d1f", bg: "#fbf7f0", gradient: "none", eyes: "own", eye: "#3a3f47", plate: "wood" }, // prettier-ignore
  gems: { fg: "#173f9a", bg: "#ffffff", gradient: "radial", fg2: "#5b1d8c", eyes: "same", plate: "metal" }, // prettier-ignore
  bubbles: { fg: "#7a1f6e", bg: "#fff8f2", gradient: "none", eyes: "same", plate: "paper" },
  neon: { fg: "#38e8ff", bg: "#07080d", gradient: "none", eyes: "own", eye: "#ffd23f", plate: "metal" }, // prettier-ignore
};

export const PLATES = [
  { id: "paper", label: "Paper" },
  { id: "wood", label: "Wood" },
  { id: "metal", label: "Metal" },
  { id: "none", label: "None" },
];

// ---- Color --------------------------------------------------------------------------

export function hexRGB(hex, fallback = [0, 0, 0]) {
  const m = /^#?([0-9a-f]{6})$/i.exec(String(hex || "").trim());
  if (!m) return fallback.slice();
  const n = parseInt(m[1], 16);
  return [((n >> 16) & 255) / 255, ((n >> 8) & 255) / 255, (n & 255) / 255];
}
const clamp01 = (x) => Math.min(1, Math.max(0, x));
const mixc = (a, b, t) => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t]; // prettier-ignore
const mulc = (a, f) => [clamp01(a[0] * f), clamp01(a[1] * f), clamp01(a[2] * f)];
const addc = (a, f) => [clamp01(a[0] + f), clamp01(a[1] + f), clamp01(a[2] + f)];

// Relative luminance and the contrast ratio (WCAG's formula), for the warning.
export function luminance(c) {
  const l = (x) => (x <= 0.04045 ? x / 12.92 : Math.pow((x + 0.055) / 1.055, 2.4));
  return 0.2126 * l(c[0]) + 0.7152 * l(c[1]) + 0.0722 * l(c[2]);
}
export function contrast(a, b) {
  const la = luminance(a);
  const lb = luminance(b);
  return (Math.max(la, lb) + 0.05) / (Math.min(la, lb) + 0.05);
}

// The colors a style really draws with, from the options: Neon glows in the
// code color on a dark plate (a dark code color glows cyan).
export function palette(o) {
  const style = o.style || "classic";
  let fg = hexRGB(o.fg, [0.07, 0.08, 0.1]);
  let fg2 = hexRGB(o.fg2, [0.1, 0.25, 0.55]);
  let bg = hexRGB(o.bg, [1, 1, 1]);
  let eye = o.eyes === "own" ? hexRGB(o.eye, fg) : null;
  if (style === "neon") {
    const glow = (c) => (luminance(c) < 0.18 ? [0.22, 0.91, 1] : c);
    fg = glow(fg);
    fg2 = glow(fg2);
    if (eye) eye = glow(eye);
    bg = luminance(bg) > 0.1 ? [0.03, 0.035, 0.06] : bg;
  }
  return { fg, fg2, bg, eye, back: hexRGB(o.back, [0.93, 0.45, 0.2]) };
}

// The worst contrast between the code's dark modules and its light ones, over
// the gradient and the eyes, and whether the code is inverted (light modules
// on a dark ground: not every reader reads those).
export function codeContrast(o) {
  const p = palette(o);
  const darks = [p.fg];
  if (o.gradient && o.gradient !== "none") darks.push(p.fg2, mixc(p.fg, p.fg2, 0.5));
  if (p.eye) darks.push(p.eye);
  let worst = Infinity;
  let inverted = false;
  for (const d of darks) {
    worst = Math.min(worst, contrast(d, p.bg));
    if (luminance(d) > luminance(p.bg)) inverted = true;
  }
  return { ratio: worst, inverted };
}

// Gray as QR readers see it (Rec. 709 weights on the stored values, as jsQR
// and ZXing do).
export const gray = (c) => 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2];

// Shading a reader can live with: a face seen front on may stray at most
// `tol` in gray from its module's base color. Readers threshold each small
// patch of the picture against its own neighborhood, so strong light and
// dark detail inside a dark area (a bright bevel, a deep seam, a highlight)
// reads as extra modules. jsQR takes an 8-pixel block whose range is under 24
// levels (about 0.09) as flat, so within ±0.03 a dark area stays one dark area. Sides
// seen only at an angle keep their full shading.
export const SHADE_TOL = 0.03;
export function steady(base, c, tol = SHADE_TOL) {
  const d = gray(c) - gray(base);
  if (Math.abs(d) <= tol) return c;
  return mixc(c, base, 1 - tol / Math.abs(d));
}

// ---- Splats -------------------------------------------------------------------------

const Q_FLAT = [0, 0, 0, 1]; // a flat splat facing +Z (its thin axis is z)

// The rotation that turns +Z to the unit vector n.
function quatTo(n) {
  const d = n[2];
  if (d > 0.999999) return [0, 0, 0, 1];
  if (d < -0.999999) return [1, 0, 0, 0];
  const ax = [-n[1], n[0], 0]; // z cross n
  const s = Math.sqrt((1 + d) * 2);
  return [ax[0] / s, ax[1] / s, ax[2] / s, s / 2];
}

// The light baked into 3D styles: a key light from the upper left, in front.
const LIGHT = (() => {
  const l = [-0.45, 0.55, 0.7];
  const n = Math.hypot(...l);
  return l.map((x) => x / n);
})();
function lit(c, n, { amb = 0.55, dif = 0.55, spec = 0, shine = 30 } = {}) {
  const d = Math.max(0, n[0] * LIGHT[0] + n[1] * LIGHT[1] + n[2] * LIGHT[2]);
  // Blinn-Phong with the eye straight ahead.
  const h = [LIGHT[0], LIGHT[1], LIGHT[2] + 1];
  const hl = Math.hypot(...h);
  const s = Math.pow(Math.max(0, (n[0] * h[0] + n[1] * h[1] + n[2] * h[2]) / hl), shine) * spec;
  return addc(mulc(c, amb + dif * d), s);
}

// ---- The builder ---------------------------------------------------------------------

// code: from encodeQR. o: the toy's options. budget: about how many splats to
// use. Returns { splats, half, depth }: half is the half-width of the quiet
// zone's square (modules), depth how far the code stands out in front.
export function buildCode(code, o, budget = 120000) {
  const style = STYLES.some((s) => s.id === o.style) ? o.style : "classic";
  const N = code.size;
  const H = N / 2 + QUIET; // half the width of the code with its quiet zone
  const pal = palette(o);
  const out = [];
  const dark = (r, c) => r >= 0 && c >= 0 && r < N && c < N && code.dark[r * N + c] === 1;
  let nDark = 0;
  for (let i = 0; i < N * N; i++) nDark += code.dark[i];
  // Splats per module edge: as many as the budget allows, 3 to 5 (more,
  // smaller splats give crisper edges; under about two pixels on screen the
  // engine skips them).
  const cost = { classic: 1, dots: 0.8, rounded: 0.95, bricks: 1.9, gems: 1.5, bubbles: 1.6, neon: 2.2 }[style]; // prettier-ignore
  const m = Math.max(3, Math.min(5, Math.floor(Math.sqrt((budget * 0.6) / Math.max(1, nDark * cost))))); // prettier-ignore
  const sp = 1 / m;

  // The color of the code at (x, y): the gradient, or the eye color on a finder.
  const grad = o.gradient || "none";
  const codeColor = (x, y, eye) => {
    if (eye && pal.eye) return pal.eye;
    if (grad === "linear") return mixc(pal.fg, pal.fg2, clamp01(0.5 + (x - y) / (4 * (N / 2))));
    if (grad === "radial") return mixc(pal.fg, pal.fg2, clamp01(Math.hypot(x, y) / (N / 2) / 1.2));
    return pal.fg;
  };
  // Module (r, c)'s center.
  const cx = (c) => c - N / 2 + 0.5;
  const cy = (r) => N / 2 - 0.5 - r;
  // The piece each module moves with.
  const pieceOf = (r, c) => {
    const id = code.piece[r * N + c];
    if (id < 0) return [1 + r * N + c, 1];
    const p = code.pieces[id];
    const h = (p.n - 1) / 2;
    return [1 + (p.row + h) * N + (p.col + h), p.n + (p.kind === "finder" ? 10 : 0)];
  };
  const isEye = (r, c) => {
    const id = code.piece[r * N + c];
    return id >= 0 && code.pieces[id].kind === "finder";
  };

  // A flat patch facing +Z: splats on a grid of spacing s over [x0, x1] x
  // [y0, y1] at depth z, kept where inside(x, y) holds. Each splat reaches
  // about half a spacing past its point, so the points sit half a spacing in
  // from the edge and the patch ends on its edge.
  const flat = (
    x0,
    y0,
    x1,
    y1,
    z,
    s,
    inside,
    color,
    params,
    { opacity = 1, sigma = 0.55, q = Q_FLAT } = {},
  ) => {
    const nx = Math.max(1, Math.round((x1 - x0) / s));
    const ny = Math.max(1, Math.round((y1 - y0) / s));
    const sx = (x1 - x0) / nx;
    const sy = (y1 - y0) / ny;
    const sc = [sigma * sx, sigma * sy, 0.02 * Math.min(sx, sy)];
    // Two staggered lattices: the second fills the low spots between the
    // first's points, so a patch is one even color, not a fine ripple (which
    // reads as speckle up close, and which QR readers' local thresholds can
    // mistake for detail). The second sits only between points of the first,
    // so it never widens the patch.
    for (let layer = 0; layer < 2; layer++)
      for (let j = 0; j < ny - layer; j++)
        for (let i = 0; i < nx - layer; i++) {
          const x = x0 + (i + 0.5 + layer * 0.5) * sx;
          const y = y0 + (j + 0.5 + layer * 0.5) * sy;
          if (inside && !inside(x, y)) continue;
          const col = typeof color === "function" ? color(x, y) : color;
          if (!col) continue;
          out.push({
            p: [x, y, z],
            scales: sc,
            quat: q,
            color: col,
            opacity,
            params,
            pattern: false,
          });
        }
  };
  // A splat with its own normal (3D styles).
  const dot = (p, n, s, col, params, opacity = 1) =>
    out.push({ p, scales: [0.62 * s, 0.62 * s, 0.03 * s], quat: quatTo(n), color: col, opacity, params, pattern: false }); // prettier-ignore

  // ---- The sheet: the light modules and the quiet zone, one flat square.
  const sheetZ = 0;

  // ---- The plate under it.
  buildPlate(o.plate || "paper", H, pal, out, flat, dot);

  // A module's cell, reaching `pad` into each dark neighbor so a run of
  // modules closes up with no seam (each module still moves on its own).
  const cell = (r, c, pad = sp * 0.75) => {
    const x = cx(c);
    const y = cy(r);
    return [
      x - 0.5 - (dark(r, c - 1) ? pad : 0),
      y - 0.5 - (dark(r + 1, c) ? pad : 0),
      x + 0.5 + (dark(r, c + 1) ? pad : 0),
      y + 0.5 + (dark(r - 1, c) ? pad : 0),
    ];
  };
  // A module's cell with its outer corners rounded where neither neighbor on
  // that corner is dark (radius rad), so runs of modules merge.
  const roundCell = (r, c, rad = 0.5) => {
    const x = cx(c);
    const y = cy(r);
    const up = dark(r - 1, c);
    const dn = dark(r + 1, c);
    const lf = dark(r, c - 1);
    const rt = dark(r, c + 1);
    // Corner radii: top-left, top-right, bottom-right, bottom-left.
    const rads = [!up && !lf, !up && !rt, !dn && !rt, !dn && !lf].map((b) => (b ? rad : 0));
    return (px, py) => {
      const dx = px - x;
      const dy = py - y;
      const k = dx < 0 ? (dy > 0 ? 0 : 3) : dy > 0 ? 1 : 2;
      const rr = rads[k];
      if (!rr) return true;
      const qx = Math.max(Math.abs(dx) - (0.5 - rr), 0);
      const qy = Math.max(Math.abs(dy) - (0.5 - rr), 0);
      return Math.hypot(qx, qy) <= rr;
    };
  };
  // The dark setting under a 3D module: the whole cell in a deep shade of
  // its color, so the gaps between stones, bubbles or bricks read dark and a
  // run of modules reads as one dark area (readers need that).
  const setting = (r, c, rad, params, eye) => {
    const [x0, y0, x1, y1] = cell(r, c);
    flat(x0, y0, x1, y1, 0.12, sp, rad ? roundCell(r, c, rad) : null, (px, py) => { const b = codeColor(px, py, eye); return steady(b, mulc(b, 0.55)); }, params); // prettier-ignore
  };

  // A finder or alignment pattern's module in a 3D style: one smooth, solid
  // piece (the pattern moves as one too), raised to height z, its top flat
  // and closed up with its neighbors, with a narrow bevel and sides only on
  // the pattern's outer edges. Readers find a code by the even runs across
  // these patterns (1:1:3:1:1), so nothing breaks them up inside.
  const solidPiece = (r, c, z, base, params, round = 0) => {
    const x = cx(c);
    const y = cy(r);
    const [x0, y0, x1, y1] = cell(r, c);
    const open = { l: !dark(r, c - 1), r: !dark(r, c + 1), t: !dark(r - 1, c), b: !dark(r + 1, c) };
    const bev = 0.12;
    const hi = steady(base, lit(base, [-0.45, 0.5, 0.74], { amb: 0.8, dif: 0.4 }));
    const lo = steady(base, mulc(base, 0.72));
    flat(x0, y0, x1, y1, z, sp, round ? roundCell(r, c, round) : null, (px, py) => {
      const dx = px - x;
      const dy = py - y;
      if ((open.l && dx < -0.5 + bev) || (open.t && dy > 0.5 - bev)) return hi;
      if ((open.r && dx > 0.5 - bev) || (open.b && dy < -0.5 + bev)) return lo;
      return base;
    }, params); // prettier-ignore
    if (z < 0.05) return;
    const rows = Math.max(2, Math.round(z / sp));
    for (const [show, n] of [
      [open.t, [0, 1, 0]],
      [open.b, [0, -1, 0]],
      [open.l, [-1, 0, 0]],
      [open.r, [1, 0, 0]],
    ]) {
      // prettier-ignore
      if (!show) continue;
      const col = mulc(lit(base, n, { amb: 0.6, dif: 0.5 }), 0.8);
      for (let j = 0; j < rows; j++)
        for (let i = 0; i < m; i++) {
          const t = -0.5 + (i + 0.5) / m;
          const zz = ((j + 0.5) / rows) * z;
          dot(n[0] ? [x + n[0] * 0.5, y + t, zz] : [x + t, y + n[1] * 0.5, zz], n, sp, col, params);
        }
    }
  };
  const inPattern = (r, c) => code.piece[r * N + c] >= 0;

  // ---- The dark modules, style by style.
  const shapes = {
    classic() {
      for (let r = 0; r < N; r++)
        for (let c = 0; c < N; c++) {
          if (!dark(r, c)) continue;
          const x = cx(c);
          const y = cy(r);
          const eye = isEye(r, c);
          const [x0, y0, x1, y1] = cell(r, c);
          flat(x0, y0, x1, y1, 0.14, sp, null, (px, py) => codeColor(px, py, eye), pieceOf(r, c)); // prettier-ignore
        }
    },
    dots() {
      // Data modules are round dots; each finder is a rounded ring around a
      // rounded square (one piece); each alignment pattern a rounded ring
      // and a dot.
      for (let r = 0; r < N; r++)
        for (let c = 0; c < N; c++) {
          if (!dark(r, c) || code.piece[r * N + c] >= 0) continue;
          const x = cx(c);
          const y = cy(r);
          flat(x - 0.5, y - 0.5, x + 0.5, y + 0.5, 0.14, sp * 0.85, (px, py) => Math.hypot(px - x, py - y) <= 0.44, (px, py) => codeColor(px, py, false), pieceOf(r, c)); // prettier-ignore
        }
      for (const p of code.pieces) {
        const h = (p.n - 1) / 2;
        const x = cx(p.col + h);
        const y = cy(p.row + h);
        const params = pieceOf(p.row + h, p.col + h);
        const eye = p.kind === "finder";
        const R = p.n / 2;
        const ring = eye ? [R, R - 1, 1.9, 1.25] : [R, R - 1, 1.1, 0.6];
        const inner = eye ? [1.5, 0.75] : [0.5, 0.5];
        const rbox = (px, py, half, rad) => {
          const qx = Math.max(Math.abs(px - x) - (half - rad), 0);
          const qy = Math.max(Math.abs(py - y) - (half - rad), 0);
          return Math.hypot(qx, qy) <= rad;
        };
        const inRing = (px, py) =>
          rbox(px, py, ring[0], ring[2]) && !rbox(px, py, ring[1], ring[3]);
        const inCore = (px, py) => rbox(px, py, inner[0], inner[1]);
        flat(x - R, y - R, x + R, y + R, 0.14, sp * 0.85, (px, py) => inRing(px, py) || inCore(px, py), (px, py) => codeColor(px, py, eye), params); // prettier-ignore
      }
    },
    rounded() {
      // Square cells whose outer corners round off where neither neighbor
      // on that corner is dark, so runs of modules merge into soft shapes.
      for (let r = 0; r < N; r++)
        for (let c = 0; c < N; c++) {
          if (!dark(r, c)) continue;
          const x = cx(c);
          const y = cy(r);
          const inside = roundCell(r, c);
          const eye = isEye(r, c);
          const [x0, y0, x1, y1] = cell(r, c);
          flat(x0, y0, x1, y1, 0.14, sp, inside, (px, py) => codeColor(px, py, eye), pieceOf(r, c)); // prettier-ignore
        }
    },
    bricks() {
      // Raised blocks with real depth: a lit top with a bevel, and sides
      // where the neighbor is light.
      const Hb = 0.5; // height
      const e = 0.03; // the gap between blocks (half)
      const bev = 0.1;
      for (let r = 0; r < N; r++)
        for (let c = 0; c < N; c++) {
          if (!dark(r, c)) continue;
          const x = cx(c);
          const y = cy(r);
          const eye = isEye(r, c);
          const params = pieceOf(r, c);
          const base = codeColor(x, y, eye);
          if (inPattern(r, c)) {
            solidPiece(r, c, Hb, base, params);
            continue;
          }
          const a = 0.5 - e;
          setting(r, c, 0, params, eye);
          // The top: flat, with a lighter bevel on the edges toward the light.
          flat(x - a, y - a, x + a, y + a, Hb, sp, null, (px, py) => {
            const dx = px - x;
            const dy = py - y;
            if (dx < -a + bev || dy > a - bev) return steady(base, lit(base, [-0.5, 0.5, 0.7].map((v) => v / 0.99), { amb: 0.75, dif: 0.45 })); // prettier-ignore
            if (dx > a - bev || dy < -a + bev) return steady(base, mulc(base, 0.7));
            return base;
          }, params); // prettier-ignore
          // The sides that show (the neighbor there is light).
          const sides = [
            [!dark(r - 1, c), [0, 1, 0]],
            [!dark(r + 1, c), [0, -1, 0]],
            [!dark(r, c - 1), [-1, 0, 0]],
            [!dark(r, c + 1), [1, 0, 0]],
          ];
          for (const [show, n] of sides) {
            if (!show) continue;
            const col = mulc(lit(base, n, { amb: 0.6, dif: 0.5 }), 0.8);
            const rows = Math.max(2, Math.round(Hb / sp));
            for (let j = 0; j < rows; j++) {
              const z = ((j + 0.5) / rows) * Hb;
              for (let i = 0; i < m; i++) {
                const t = -a + ((i + 0.5) / m) * 2 * a;
                const p = n[0] ? [x + n[0] * a, y + t, z] : [x + t, y + n[1] * a, z];
                dot(p, n, sp, col, params);
              }
            }
          }
        }
    },
    gems() {
      // Faceted gems: a flat table on top and four sloping facets, each lit
      // at its own angle; the GPU program adds the passing glint.
      const zt = 0.44;
      const zb = 0.14;
      const t = 0.2; // half the table
      const a = 0.47; // half the girdle
      for (let r = 0; r < N; r++)
        for (let c = 0; c < N; c++) {
          if (!dark(r, c)) continue;
          const x = cx(c);
          const y = cy(r);
          const eye = isEye(r, c);
          const params = pieceOf(r, c);
          const base = codeColor(x, y, eye);
          if (inPattern(r, c)) {
            solidPiece(r, c, zt * 0.7, base, params);
            continue;
          }
          setting(r, c, 0.3, params, eye);
          flat(x - t, y - t, x + t, y + t, zt, sp * 0.8, null, steady(base, lit(base, [0, 0, 1], { amb: 0.65, dif: 0.35, spec: 0.08 })), params); // prettier-ignore
          // Four facets: (u along the edge, w from the table out to the girdle).
          const len = Math.hypot(a - t, zt - zb);
          for (const [dx, dy] of [
            [0, 1],
            [0, -1],
            [-1, 0],
            [1, 0],
          ]) {
            // prettier-ignore
            const n = [dx * (zt - zb), dy * (zt - zb), a - t].map((v) => v / len);
            const col = steady(base, lit(base, n, { amb: 0.5, dif: 0.6, spec: 0.12, shine: 18 }));
            const rows = Math.max(2, Math.round(len / (sp * 0.8)));
            for (let j = 0; j < rows; j++) {
              const w = (j + 0.5) / rows;
              const half = t + (a - t) * w; // the facet widens toward the girdle
              const z = zt - (zt - zb) * w;
              const along = Math.max(2, Math.round((2 * half) / (sp * 0.8)));
              for (let i = 0; i < along; i++) {
                const u = -half + ((i + 0.5) / along) * 2 * half;
                const d = t + (a - t) * w;
                const p = dx ? [x + dx * d, y + u, z] : [x + u, y + dy * d, z];
                dot(p, n, sp * 0.85, col, params);
              }
            }
          }
        }
    },
    bubbles() {
      // Glossy spheres: a lit dome per module with a small highlight.
      const R = 0.46;
      for (let r = 0; r < N; r++)
        for (let c = 0; c < N; c++) {
          if (!dark(r, c)) continue;
          const x = cx(c);
          const y = cy(r);
          const eye = isEye(r, c);
          const params = pieceOf(r, c);
          const base = codeColor(x, y, eye);
          if (inPattern(r, c)) {
            solidPiece(r, c, 0.2, base, params, 0.5);
            continue;
          }
          setting(r, c, 0.5, params, eye);
          const s = sp * 0.85;
          const n1 = Math.ceil((2 * R) / s);
          for (let j = 0; j < n1; j++)
            for (let i = 0; i < n1; i++) {
              const dx = -R + (i + 0.5) * ((2 * R) / n1);
              const dy = -R + (j + 0.5) * ((2 * R) / n1);
              const rr = Math.hypot(dx, dy);
              if (rr > R) continue;
              const dz = Math.sqrt(Math.max(0, R * R - rr * rr));
              const n = [dx / R, dy / R, dz / R];
              const col = steady(base, lit(base, n, { amb: 0.5, dif: 0.6, spec: 0.45, shine: 80 }));
              // Splats on the steep rim are stretched by the slope: size them
              // by it so the dome stays closed.
              const tilt = 1 / Math.max(0.6, n[2]);
              out.push({ p: [x + dx, y + dy, 0.17 + dz * 0.6], scales: [0.62 * s * tilt, 0.62 * s * tilt, 0.03 * s], quat: quatTo(n), color: col, opacity: 1, params, pattern: false }); // prettier-ignore
            }
        }
    },
    neon() {
      // Glowing tubes on a dark plate: a tube from each dark module's center
      // to each dark neighbor (half the way: the neighbor draws the rest),
      // a bright core, and a faint glow around it.
      const w = 0.34; // half the tube's width
      for (let r = 0; r < N; r++)
        for (let c = 0; c < N; c++) {
          if (!dark(r, c)) continue;
          const x = cx(c);
          const y = cy(r);
          const eye = isEye(r, c);
          const params = pieceOf(r, c);
          const glow = codeColor(x, y, eye);
          const core = mixc(glow, [1, 1, 1], 0.6);
          if (inPattern(r, c)) {
            // The finders and alignment patterns: solid glowing pieces, one
            // even color with a brighter rim, and no halo in their gaps.
            const [x0, y0, x1, y1] = cell(r, c);
            flat(x0, y0, x1, y1, 0.14, sp, roundCell(r, c, 0.3), steady(glow, mixc(glow, core, 0.5), 0.06), params); // prettier-ignore
            continue;
          }
          const across = (d) => {
            const f = clamp01(1 - d / w);
            return steady(glow, mixc(glow, core, f * f));
          };
          const links = [
            [dark(r, c + 1), 1, 0],
            [dark(r, c - 1), -1, 0],
            [dark(r - 1, c), 0, 1],
            [dark(r + 1, c), 0, -1],
          ];
          // A corner whose three neighbors are dark too is filled, so a
          // solid block (a finder's center) stays solid, not a grid of tubes.
          const full = (sx, sy) => dark(r, c + sx) && dark(r - sy, c) && dark(r - sy, c + sx);
          const quad = { "1,1": full(1, 1), "1,-1": full(1, -1), "-1,1": full(-1, 1), "-1,-1": full(-1, -1) }; // prettier-ignore
          // The node: a round end where nothing joins, square where it does.
          flat(x - 0.5, y - 0.5, x + 0.5, y + 0.5, 0.14, sp * 0.8, (px, py) => {
            const dx = px - x;
            const dy = py - y;
            if (Math.hypot(dx, dy) <= w) return true;
            if (quad[`${dx < 0 ? -1 : 1},${dy < 0 ? -1 : 1}`]) return true;
            for (const [on, lx, ly] of links) {
              if (!on) continue;
              if (lx && Math.sign(dx) === lx && Math.abs(dy) <= w) return true;
              if (ly && Math.sign(dy) === ly && Math.abs(dx) <= w) return true;
            }
            return false;
          }, (px, py) => {
            const dx = px - x;
            const dy = py - y;
            if (quad[`${dx < 0 ? -1 : 1},${dy < 0 ? -1 : 1}`]) return across(Math.min(0.5 - Math.abs(dx), 0.5 - Math.abs(dy), Math.hypot(dx, dy)) * 0.5); // prettier-ignore
            let d = Math.hypot(dx, dy);
            for (const [on, lx, ly] of links) {
              if (!on) continue;
              if (lx && Math.sign(dx) === lx) d = Math.min(d, Math.abs(dy));
              if (ly && Math.sign(dy) === ly) d = Math.min(d, Math.abs(dx));
            }
            return across(d);
          }, params); // prettier-ignore
          // The glow: faint, wider splats behind the tube.
          out.push({ p: [x, y, 0.1], scales: [0.32, 0.32, 0.01], quat: Q_FLAT, color: glow, opacity: 0.22, params, pattern: false }); // prettier-ignore
        }
    },
  };
  shapes[style]();
  // The sheet: the light modules and the quiet zone, in splats as fine as
  // the modules', with the flat styles' modules standing 0.14 of a module in
  // front of it. Seen at an angle, a sheet splat that reached out from under
  // a module sorted in front of it, and the code turned gray and hatched.
  flat(-H, -H, H, H, sheetZ, sp, null, pal.bg, [0, 0], { sigma: 0.6 });
  const depth = { bricks: 0.5, gems: 0.44, bubbles: 0.42, neon: 0.14 }[style] ?? 0.14;
  return { splats: out, half: H, depth, perModule: m };
}

// ---- Plates -------------------------------------------------------------------------

// A plate under the code: a slab a little bigger than the quiet zone. Paper is
// a thin card in the code's light color; wood a board with grain around a
// light print; metal a brushed plate with a bevel. None: the sheet alone.
function buildPlate(kind, H, pal, out, flat, dot) {
  if (kind === "none") return;
  const M = kind === "paper" ? 0.6 : 1.6; // the border around the quiet zone
  const T = kind === "paper" ? 0.25 : 1.1; // thickness
  const E = H + M;
  const s = 0.5;
  const P = [0, 0];
  let face;
  let side;
  if (kind === "paper") {
    face = () => pal.bg;
    side = mulc(pal.bg, 0.82);
  } else if (kind === "wood") {
    const a = [0.55, 0.36, 0.2];
    const b = [0.42, 0.26, 0.13];
    face = (x, y) => {
      const g =
        0.5 +
        0.5 * Math.sin(y * 1.7 + Math.sin(x * 0.23) * 2.2 + Math.sin(x * 0.07 + y * 0.11) * 4);
      return mixc(a, b, g * g);
    };
    side = [0.36, 0.22, 0.11];
  } else {
    face = (x, y) => {
      const brush = 0.5 + 0.5 * Math.sin(y * 13.1 + Math.sin(y * 3.7) * 1.3);
      const sheen = clamp01(0.5 + (x - y) / (4 * E));
      return mixc([0.6, 0.62, 0.65], [0.8, 0.82, 0.85], 0.55 * sheen + 0.15 * brush);
    };
    side = [0.48, 0.5, 0.53];
  }
  // The border ring (behind the sheet's plane, so the sheet draws over it).
  const inBorder = (x, y) => Math.max(Math.abs(x), Math.abs(y)) > H - 0.25;
  flat(-E, -E, E, E, -0.01, s, inBorder, face, P, { sigma: 0.6 });
  // Metal: a lighter bevel along the outer edge.
  if (kind === "metal") {
    flat(-E, -E, E, E, -0.005, 0.25, (x, y) => Math.max(Math.abs(x), Math.abs(y)) > E - 0.3, (x, y) => (x < -E + 0.3 || y > E - 0.3 ? [0.9, 0.91, 0.93] : [0.42, 0.44, 0.47]), P); // prettier-ignore
  }
  // The four sides and the back.
  const rows = Math.max(2, Math.round(T / s));
  for (const n of [
    [1, 0, 0],
    [-1, 0, 0],
    [0, 1, 0],
    [0, -1, 0],
  ]) {
    // prettier-ignore
    const along = Math.round((2 * E) / s);
    for (let j = 0; j < rows; j++)
      for (let i = 0; i < along; i++) {
        const t = -E + (i + 0.5) * ((2 * E) / along);
        const z = -((j + 0.5) / rows) * T;
        const p = n[0] ? [n[0] * E, t, z] : [t, n[1] * E, z];
        dot(p, n, s * 1.1, side, P);
      }
  }
  flat(-E, -E, E, E, -T, 0.6, null, mulc(side, 0.8), P, { q: [1, 0, 0, 0], sigma: 0.6 });
}
