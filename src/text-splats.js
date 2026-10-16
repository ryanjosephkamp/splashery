// Lane PT1: any typed text as splats. A shared module for the toys that
// spell things (Your name in splats, Shape morph): text is split into
// grapheme clusters (Intl.Segmenter), so a flag, a skin tone or a family
// joined by zero-width joiners stays one piece. Each grapheme is drawn on
// its own small canvas with the system's fonts (the color emoji font
// included) and its inked pixels become splats: a front face, a darker back
// face and a rim around the outline, like a letter cut from a thick slab
// (the look of Ryan Kamp's Toy Box name). Color glyphs (emoji) keep their
// own colors; plain glyphs take the caller's color. Placement is seeded
// and deterministic for the same text, font and budget, and each grapheme
// has its own range of splats, so every letter can move by itself.
//
// In Node (the unit tests and the tap checks), where there is no canvas, a
// 5 x 7 bitmap alphabet stands in, with a filled box for anything it lacks.

import { FONT } from "./font.js";

// Rounded faces first (Toy Box uses Fredoka, which the site does not ship),
// then the system's own sans, then the color emoji fonts.
export const TEXT_FONT =
  'ui-rounded, "SF Pro Rounded", "Arial Rounded MT Bold", "Nunito", "Varela Round", "M PLUS Rounded 1c", system-ui, "Segoe UI", Roboto, "Noto Sans", "Helvetica Neue", Arial, sans-serif, "Apple Color Emoji", "Segoe UI Emoji", "Noto Color Emoji"';
const PX = 112; // the size each glyph is drawn at (pixels per em)
const LIGHT = [0.35, 0.7, 0.62];
const LN = Math.hypot(...LIGHT);
const R2 = [0.7548776662466927, 0.5698402909980532];
const frac = (v) => v - Math.floor(v);

// Grapheme clusters, as a person sees characters. Falls back to code points
// where Intl.Segmenter is missing.
let segmenter = null;
export function graphemes(text) {
  const s = String(text ?? "");
  if (segmenter === null)
    segmenter = typeof Intl !== "undefined" && Intl.Segmenter ? new Intl.Segmenter(undefined, { granularity: "grapheme" }) : false; // prettier-ignore
  return segmenter ? Array.from(segmenter.segment(s), (x) => x.segment) : Array.from(s);
}

export const isBlank = (g) => /^[\s\u200b-\u200d\u2060\ufeff]*$/u.test(g);
export const isBreak = (g) => /[\n\r\u2028\u2029]/u.test(g);

// Tidies typed text: line breaks kept (as "\n"), runs of spaces and tabs
// made one space, control characters dropped, ends trimmed.
export function cleanText(text, maxLength = 400) {
  return String(text ?? "")
    .slice(0, maxLength * 4)
    .replace(/\r\n?/g, "\n")
    .replace(/[\u2028\u2029]/g, "\n")
    .replace(/[\u0000-\u0009\u000b-\u001f\u007f]/g, " ")
    .replace(/[ \u00a0]+/g, " ")
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean)
    .join("\n")
    .trim();
}

// How many graphemes would show (spaces and line breaks don't).
export const visibleCount = (text) => graphemes(text).filter((g) => !isBlank(g)).length;

// Rows of graphemes: line breaks as typed, and long lines wrapped at spaces
// to at most `cols` graphemes (a word longer than that is cut).
export function textRows(text, cols = 8) {
  const rows = [];
  for (const line of String(text).split("\n")) {
    let row = [];
    const words = [];
    let word = [];
    for (const g of graphemes(line)) {
      if (g === " ") {
        if (word.length) words.push(word);
        word = [];
      } else word.push(g);
    }
    if (word.length) words.push(word);
    for (let w of words) {
      if (row.length && row.length + 1 + w.length <= cols) {
        row.push(" ", ...w);
        continue;
      }
      if (row.length) rows.push(row);
      row = [];
      while (w.length > cols) {
        rows.push(w.slice(0, cols));
        w = w.slice(cols);
      }
      row = w;
    }
    if (row.length) rows.push(row);
  }
  return rows;
}

// ---- One glyph's pixels --------------------------------------------------------

const glyphCache = new Map();

// { w, h, alpha (Uint8Array w*h), rgb (Uint8Array w*h*3) or null for a plain
// glyph, advance, ox, oy } in pixels: (ox, oy) is the pen's origin on the
// baseline, advance its width, PX pixels to the em.
export function glyphRaster(g) {
  const key = `${typeof document !== "undefined" ? "c" : "b"}|${g}`;
  let r = glyphCache.get(key);
  if (!r) {
    r = typeof document !== "undefined" ? canvasGlyph(g) : bitmapGlyph(g);
    if (glyphCache.size > 600) glyphCache.delete(glyphCache.keys().next().value);
    glyphCache.set(key, r);
  }
  return r;
}

let scratch = null;
function canvasGlyph(g) {
  if (!scratch) {
    const c = document.createElement("canvas");
    scratch = { canvas: c, ctx: null };
  }
  const font = `700 ${PX}px ${TEXT_FONT}`;
  const probe = scratch.canvas.getContext("2d", { willReadFrequently: true });
  probe.font = font;
  const m = probe.measureText(g);
  const pad = Math.ceil(PX * 0.18);
  const left = Math.ceil(Math.max(0, m.actualBoundingBoxLeft || 0));
  const right = Math.ceil(Math.max(m.width, m.actualBoundingBoxRight || 0));
  const up = Math.ceil(Math.max(PX * 0.95, m.actualBoundingBoxAscent || 0));
  const down = Math.ceil(Math.max(PX * 0.25, m.actualBoundingBoxDescent || 0));
  const w = Math.min(4096, left + right + pad * 2);
  const h = Math.min(4096, up + down + pad * 2);
  const ox = pad + left;
  const oy = pad + up;
  const draw = (fill) => {
    const c = scratch.canvas;
    c.width = w;
    c.height = h;
    const ctx = c.getContext("2d", { willReadFrequently: true });
    ctx.clearRect(0, 0, w, h);
    ctx.font = font;
    ctx.textBaseline = "alphabetic";
    ctx.fillStyle = fill;
    ctx.fillText(g, ox, oy);
    return ctx.getImageData(0, 0, w, h).data;
  };
  const white = draw("#ffffff");
  const black = draw("#000000");
  // A color glyph (an emoji) draws in its own colors whatever the fill; a
  // plain one follows the fill.
  let inked = 0,
    same = 0;
  for (let i = 0; i < white.length; i += 4) {
    if (white[i + 3] < 128) continue;
    inked++;
    const d =
      Math.abs(white[i] - black[i]) +
      Math.abs(white[i + 1] - black[i + 1]) +
      Math.abs(white[i + 2] - black[i + 2]);
    if (d < 60) same++;
  }
  const color = inked > 0 && same > inked * 0.5;
  const alpha = new Uint8Array(w * h);
  let rgb = null;
  if (color) {
    rgb = new Uint8Array(w * h * 3);
    for (let i = 0, j = 0; j < alpha.length; i += 4, j++) {
      const a = white[i + 3];
      alpha[j] = a;
      // Un-premultiply nothing: getImageData is already straight alpha.
      rgb[j * 3] = white[i];
      rgb[j * 3 + 1] = white[i + 1];
      rgb[j * 3 + 2] = white[i + 2];
    }
  } else {
    // A plain glyph again, with a round-joined outline: rounder, bolder
    // letters in any font, closer to Toy Box's rounded face.
    const c = scratch.canvas;
    const ctx = c.getContext("2d", { willReadFrequently: true });
    ctx.clearRect(0, 0, w, h);
    ctx.font = font;
    ctx.fillStyle = "#ffffff";
    ctx.strokeStyle = "#ffffff";
    ctx.lineJoin = "round";
    ctx.lineCap = "round";
    ctx.lineWidth = PX * 0.075;
    ctx.fillText(g, ox, oy);
    ctx.strokeText(g, ox, oy);
    const d = ctx.getImageData(0, 0, w, h).data;
    for (let i = 3, j = 0; j < alpha.length; i += 4, j++) alpha[j] = d[i];
  }
  return { w, h, alpha, rgb, advance: m.width + PX * 0.03, ox, oy };
}

// The 5 x 7 alphabet, each bit a 14-pixel round dot: for Node only.
function bitmapGlyph(g) {
  const ch = g.toUpperCase();
  const rows = (FONT[ch] || null)?.split(" ");
  const cell = 14;
  const pad = 8;
  const w = 5 * cell + pad * 2;
  const h = 7 * cell + pad * 2 + 20;
  const alpha = new Uint8Array(w * h);
  const on = (bx, by) => (rows ? rows[by]?.[bx] === "1" : true); // no glyph: a filled box
  for (let y = 0; y < h; y++)
    for (let x = 0; x < w; x++) {
      const bx = Math.floor((x - pad) / cell);
      const by = Math.floor((y - pad) / cell);
      if (bx < 0 || by < 0 || bx > 4 || by > 6 || !on(bx, by)) continue;
      alpha[y * w + x] = 255;
    }
  return { w, h, alpha, rgb: null, advance: 6 * cell, ox: pad, oy: pad + 7 * cell };
}

// ---- Text to splats --------------------------------------------------------------

function rng(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function hashText(s) {
  let h = 2166136261;
  for (const ch of s) h = Math.imul(h ^ ch.codePointAt(0), 16777619) >>> 0;
  return h;
}

// The layout alone (cheap): every visible grapheme's place in em units,
// centered on the origin, rows `line` apart. glyphs: [{ g, row, x, y (the
// pen's origin), box: [x0, y0, x1, y1], center }].
export function layoutText(text, { cols = 8, line = 1.08 } = {}) {
  const rows = textRows(text, cols);
  const glyphs = [];
  const widths = [];
  rows.forEach((row, r) => {
    let x = 0;
    for (const g of row) {
      const ras = glyphRaster(g);
      const adv = ras.advance / PX;
      if (g === " " || isBlank(g)) {
        x += Math.max(adv, 0.28);
        continue;
      }
      glyphs.push({ g, row: r, x, y: -r * line, ras });
      x += adv;
    }
    widths.push(x);
  });
  // Ink bounds per glyph (from its raster), then center everything.
  let lo = [Infinity, Infinity],
    hi = [-Infinity, -Infinity];
  for (const gl of glyphs) {
    const { w, h, alpha, ox, oy } = gl.ras;
    let x0 = w,
      x1 = -1,
      y0 = h,
      y1 = -1;
    for (let y = 0; y < h; y++)
      for (let x = 0; x < w; x++)
        if (alpha[y * w + x] >= 128) {
          if (x < x0) x0 = x;
          if (x > x1) x1 = x;
          if (y < y0) y0 = y;
          if (y > y1) y1 = y;
        }
    if (x1 < 0) {
      gl.empty = true;
      continue;
    }
    // Rows are centered on their own width.
    const shift = -widths[gl.row] / 2;
    gl.x += shift;
    gl.box = [gl.x + (x0 - ox) / PX, gl.y + (oy - y1 - 1) / PX, gl.x + (x1 + 1 - ox) / PX, gl.y + (oy - y0) / PX]; // prettier-ignore
    lo = [Math.min(lo[0], gl.box[0]), Math.min(lo[1], gl.box[1])];
    hi = [Math.max(hi[0], gl.box[2]), Math.max(hi[1], gl.box[3])];
  }
  const shown = glyphs.filter((gl) => !gl.empty);
  if (!shown.length) return { glyphs: [], width: 0, height: 0, rows: rows.length };
  const mid = [(lo[0] + hi[0]) / 2, (lo[1] + hi[1]) / 2];
  for (const gl of shown) {
    gl.x -= mid[0];
    gl.y -= mid[1];
    gl.box = [gl.box[0] - mid[0], gl.box[1] - mid[1], gl.box[2] - mid[0], gl.box[3] - mid[1]];
    gl.center = [(gl.box[0] + gl.box[2]) / 2, (gl.box[1] + gl.box[3]) / 2, 0];
    gl.color = !!gl.ras.rgb;
  }
  return { glyphs: shown, width: hi[0] - lo[0], height: hi[1] - lo[1], rows: rows.length };
}

const splatCache = new Map();

// Splats for the text. options: count (the budget), seed, cols, line,
// depth (half the slab's thickness, in ems; 0 for a flat sheet: front face
// only), colorOf(glyphIndex) -> [r, g, b] for plain glyphs, back (the back
// face's share of a face's splats, 0..1).
// Returns { layout, n, pos, nrm, col, sigma, glyph (Uint16Array: which
// glyph each splat belongs to), face (Uint8Array: 0 front, 1 back, 2 rim),
// ranges: [[start, end)] per glyph, ink: true per glyph that has color }.
// Positions are in ems with z toward the viewer; the caller scales them.
export function textSplats(text, opts = {}) {
  const { count = 24000, seed = 1999, cols = 8, line = 1.08, depth = 0.17, back = 0.35 } = opts;
  const colorOf = opts.colorOf || (() => [1, 0.86, 0.1]);
  const layout = layoutText(text, { cols, line });
  const glyphs = layout.glyphs;
  const key = `${text}|${count}|${seed}|${cols}|${line}|${depth}|${back}|${opts.colorKey ?? ""}|${typeof document !== "undefined"}`; // prettier-ignore
  const hit = splatCache.get(key);
  if (hit) return hit;
  // Each glyph's outline and ink, and its share of the budget by area.
  const parts = glyphs.map((gl) => {
    const { w, h, alpha } = gl.ras;
    const a = (x, y) => (x < 0 || y < 0 || x >= w || y >= h ? 0 : alpha[y * w + x]);
    const ink = [];
    const edges = [];
    for (let y = 0; y < h; y++)
      for (let x = 0; x < w; x++) {
        if (a(x, y) < 128) continue;
        ink.push(y * w + x);
        if (a(x - 1, y) < 128 || a(x + 1, y) < 128 || a(x, y - 1) < 128 || a(x, y + 1) < 128)
          edges.push(y * w + x);
      }
    const faceArea = ink.length / (PX * PX);
    const rimArea = depth > 0 ? (edges.length / PX) * 2 * depth : 0;
    return {
      ink,
      edges,
      faceArea,
      rimArea,
      weight: faceArea * (1 + (depth > 0 ? back : 0)) + rimArea,
    };
  });
  const total = parts.reduce((s, p) => s + p.weight, 0) || 1;
  // Whole splats per glyph, adding up to the budget.
  const shares = parts.map((p) => (count * p.weight) / total);
  const ns = shares.map(Math.floor);
  let left = count - ns.reduce((s, x) => s + x, 0);
  shares
    .map((s, i) => [s - Math.floor(s), i])
    .sort((a, b) => b[0] - a[0] || a[1] - b[1])
    .forEach(([, i]) => {
      if (left-- > 0) ns[i]++;
    });
  const n = count;
  const pos = new Float32Array(n * 3);
  const nrm = new Float32Array(n * 3);
  const col = new Float32Array(n * 3);
  const sigma = new Float32Array(n);
  const glyph = new Uint16Array(n);
  const face = new Uint8Array(n);
  const ranges = [];
  let i = 0;
  const put = (x, y, z, nx, ny, nz, c, k, s, gi, f) => {
    const j = i * 3;
    pos[j] = x;
    pos[j + 1] = y;
    pos[j + 2] = z;
    nrm[j] = nx;
    nrm[j + 1] = ny;
    nrm[j + 2] = nz;
    // Toy Box's light, baked: a face at k, lit from the upper front.
    const l = Math.max(0, (nx * LIGHT[0] + ny * LIGHT[1] + nz * LIGHT[2]) / LN);
    const lit = k * (0.74 + 0.3 * l);
    col[j] = Math.min(1, c[0] * lit);
    col[j + 1] = Math.min(1, c[1] * lit);
    col[j + 2] = Math.min(1, c[2] * lit);
    sigma[i] = s;
    glyph[i] = gi;
    face[i] = f;
    i++;
  };
  glyphs.forEach((gl, gi) => {
    const p = parts[gi];
    const start = i;
    const end = start + ns[gi];
    const { w, alpha, rgb, ox, oy } = gl.ras;
    const rand = rng((seed ^ hashText(gl.g) ^ Math.imul(gi + 1, 2654435761)) >>> 0);
    const plain = colorOf(gi);
    const colorAt = (pix) =>
      rgb ? [rgb[pix * 3] / 255, rgb[pix * 3 + 1] / 255, rgb[pix * 3 + 2] / 255] : plain;
    const ux = (x) => gl.x + (x - ox) / PX;
    const uy = (y) => gl.y + (oy - y) / PX;
    const a = (x, y) => (x < 0 || y < 0 || x >= w || y >= gl.ras.h ? 0 : alpha[y * w + x]);
    const want = end - start;
    const share = p.weight || 1;
    const nRim = depth > 0 ? Math.round((want * p.rimArea) / share) : 0;
    const nFront = depth > 0 ? Math.round(((want - nRim) * 1) / (1 + back)) : want;
    const nBack = want - nRim - nFront;
    // Sigma from each part's own spacing, so every surface closes.
    const sF = Math.sqrt(p.faceArea / Math.max(1, nFront)) * 0.95;
    const sB = Math.sqrt(p.faceArea / Math.max(1, nBack)) * 0.95;
    const sR = Math.sqrt(p.rimArea / Math.max(1, nRim)) * 0.95;
    const reach = Math.max(0.02, depth - sR * 0.35);
    // The rim: outline pixels in turn, spread evenly through the depth.
    for (let k = 0; k < nRim && p.edges.length; k++) {
      const pix = p.edges[Math.floor(frac(0.5 + k * R2[0]) * p.edges.length)];
      const x = pix % w;
      const y = (pix / w) | 0;
      const gx = a(x + 1, y) - a(x - 1, y);
      const gy = a(x, y + 1) - a(x, y - 1);
      const len = Math.hypot(gx, gy) || 1;
      put(ux(x + rand()), uy(y + rand()), (frac(0.5 + k * R2[1]) * 2 - 1) * reach,
        -gx / len, gy / len, 0, colorAt(pix), 0.74 * (0.98 + 0.035 * rand()), sR * (0.85 + 0.3 * rand()), gi, 2); // prettier-ignore
    }
    // The faces: Toy Box's even (R2) sequence over the glyph's box, kept
    // where it lands on ink.
    const ink = p.ink;
    let bx0 = w,
      bx1 = 0,
      by0 = gl.ras.h,
      by1 = 0;
    for (const pix of ink) {
      const x = pix % w;
      const y = (pix / w) | 0;
      if (x < bx0) bx0 = x;
      if (x > bx1) bx1 = x;
      if (y < by0) by0 = y;
      if (y > by1) by1 = y;
    }
    const bw = bx1 - bx0 + 1;
    const bh = by1 - by0 + 1;
    const faces = [
      [nFront, depth, 1, 1, sF, 0],
      [nBack, -depth, -1, 0.55, sB, 1],
    ];
    for (const [m, z, nz, k0, s0, f] of faces) {
      let got = 0;
      for (let k = 0; got < m && ink.length && k < m * 40; k++) {
        const fx = bx0 + frac(0.5 + f * 0.31 + k * R2[0]) * bw;
        const fy = by0 + frac(0.5 + f * 0.17 + k * R2[1]) * bh;
        const pix = Math.floor(fy) * w + Math.floor(fx);
        if (alpha[pix] < 128) continue;
        got++;
        put(ux(fx), uy(fy), z, (rand() - 0.5) * 0.06, (rand() - 0.5) * 0.06, nz,
          colorAt(pix), k0 * (0.98 + 0.035 * rand()), s0 * (0.85 + 0.3 * rand()), gi, f); // prettier-ignore
      }
    }
    // (Rounding can leave a splat or two over; they are front-face splats.)
    while (i < end) {
      const pix = ink[Math.floor(rand() * ink.length)] ?? 0;
      put(
        ux((pix % w) + 0.5),
        uy(((pix / w) | 0) + 0.5),
        depth,
        0,
        0,
        1,
        colorAt(pix),
        1,
        sF,
        gi,
        0,
      );
    }
    ranges.push([start, end]);
  });
  const out = { layout, n: i, pos, nrm, col, sigma, glyph, face, ranges };
  if (splatCache.size > 6) splatCache.delete(splatCache.keys().next().value);
  splatCache.set(key, out);
  return out;
}

// Flat ink points for a cloud that only needs the shape and colors of the
// text (Shape morph's word forms): { layout, pos (x, y pairs, ems), col
// (rgb or null per point for plain glyphs), glyph }.
export function textInk(text, opts = {}) {
  const s = textSplats(text, { ...opts, depth: 0, colorOf: () => [-1, -1, -1], colorKey: "ink" });
  return s;
}
