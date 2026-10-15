// Circular stickers keep the encoded square untouched. Everything outside
// its clear margin is decoration, with no finder-like runs or extra data.
import { QUIET } from "./encode.js";
import { painter } from "./crisp.js";

export const CIRCLE_QUIET = 4; // Legacy default: preserve existing scenes and share links.
export const shapeChoices = [
  { id: "square", label: "Square" },
  { id: "circle", label: "Circle" },
];
// Avoid JavaScript's argument-count limit when a large code has many splats.
export function appendSplats(target, splats, transform = null) {
  for (const splat of splats) target.push(transform ? transform(splat) : splat);
}
const radius = (size, quiet) => Math.ceil(Math.SQRT2 * (size / 2 + quiet) + 2) + 0.5;
export const shapeHalf = (code, shape, quiet = CIRCLE_QUIET) => {
  const size = typeof code === "number" ? code : code.size;
  return shape === "circle" ? radius(size, quiet) : size / 2 + QUIET;
};

export function circleLayout(code, quiet = CIRCLE_QUIET) {
  const N = code.size;
  const half = radius(N, quiet);
  const edge = Math.floor(half);
  const candidates = [];
  for (let y = -edge; y <= edge; y++)
    for (let x = -edge; x <= edge; x++) {
      if (Math.max(Math.abs(x), Math.abs(y)) - 0.5 < N / 2 + quiet) continue;
      if (Math.hypot(x, y) + Math.SQRT1_2 >= half - 0.6) continue;
      candidates.push({ x, y, row: (N - 1) / 2 - y, col: x + (N - 1) / 2 });
    }
  let seed = 2166136261;
  for (const b of code.dark) seed = Math.imul(seed ^ b, 16777619) >>> 0;
  const random = () => {
    seed ^= seed << 13;
    seed ^= seed >>> 17;
    seed ^= seed << 5;
    return (seed >>> 0) / 4294967296;
  };
  for (let i = candidates.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1));
    [candidates[i], candidates[j]] = [candidates[j], candidates[i]];
  }
  const picked = new Set();
  const key = (r, c) => `${r},${c}`;
  const dark = (r, c) => picked.has(key(r, c));
  const bit = (r, c, border) => {
    if (r >= 0 && c >= 0 && r < N && c < N) return code.dark[r * N + c] === 1;
    const x = c - (N - 1) / 2;
    const y = (N - 1) / 2 - r;
    const rr = Math.hypot(x, y);
    return dark(r, c) || (border && rr >= half - 0.65 && rr <= half);
  };
  // Readers allow substantial variation in 1:1:3:1:1. A two-cell center
  // can pass that tolerance too, so check complete runs rather than just
  // rejecting literal seven-cell patterns. Genuine finders remain allowed.
  const safeLine = (r, c, dr, dc, border) => {
    const runs = [];
    const start = Math.floor(N / 2 - half) - 2;
    const end = N - start;
    for (let i = start; i <= end; i++) {
      const rr = dr ? i : r;
      const cc = dc ? i : c;
      const value = bit(rr, cc, border);
      const last = runs[runs.length - 1];
      if (last?.value === value) last.n++;
      else runs.push({ value, n: 1, at: i });
    }
    for (let i = 0; i + 4 < runs.length; i++) {
      if (!runs[i].value) continue;
      const five = runs.slice(i, i + 5);
      const mid = five[2].at + (five[2].n - 1) / 2;
      const rr = dr ? mid : r;
      const cc = dc ? mid : c;
      if (rr >= 0 && cc >= 0 && rr < N && cc < N) continue;
      const unit = five.reduce((a, b) => a + b.n, 0) / 7;
      if (
        five.every(
          (v, j) => Math.abs(v.n - (j === 2 ? 3 : 1) * unit) < (j === 2 ? 1.5 : 0.5) * unit,
        )
      )
        return false;
    }
    return true;
  };
  const target = Math.round(
    (candidates.length * code.dark.reduce((a, b) => a + b, 0)) / code.dark.length,
  );
  const dots = [];
  for (const d of candidates) {
    if (dots.length === target) break;
    const { row: r, col: c } = d;
    picked.add(key(r, c));
    if (
      [false, true].some((border) => !safeLine(r, c, 0, 1, border) || !safeLine(r, c, 1, 0, border))
    ) {
      picked.delete(key(r, c));
      continue;
    }
    dots.push(d);
  }
  return { half, radius: half, quiet, dots, dark, candidates: candidates.length };
}

export function circleSplats(
  code,
  {
    quiet = CIRCLE_QUIET,
    fg = [0.07, 0.08, 0.1],
    bg = [1, 1, 1],
    decorColor = fg,
    scale = 0.8,
    sheet = true,
    dots = true,
    z = 0.14,
    params = [0, 0],
    colorAt = null,
    lightColorAt = null,
    coarse = false,
    sheetSpacing = 0.45,
  } = {},
) {
  // With no dots, only the sticker extent is needed. The decorative layout
  // can be expensive and has no effect on the sheet or annulus.
  const half = radius(code.size, quiet);
  const layout = dots
    ? circleLayout(code, quiet)
    : { half, radius: half, quiet, dots: [], dark: () => false, candidates: 0 };
  const H = layout.half;
  const splats = [];
  const { flat, crisp } = painter(splats, { scale, sp: 0.25 });
  if (sheet)
    flat(
      -H,
      -H,
      H,
      H,
      -0.26,
      sheetSpacing * Math.max(1, scale),
      (x, y) => Math.hypot(x, y) < H - 0.12,
      lightColorAt
        ? (x, y) =>
            Math.max(Math.abs(x), Math.abs(y)) >= code.size / 2 + quiet ? lightColorAt(x, y) : bg
        : bg,
      [0, 0],
      { sigma: 0.6 },
    );
  // A true annulus with narrow edge splats: no segmented or blurry outline.
  const inner = H - 0.65;
  crisp({
    x0: -H,
    y0: -H,
    x1: H,
    y1: H,
    rad: [H, H, H, H],
    hole: { x0: -inner, y0: -inner, x1: inner, y1: inner, rad: [inner, inner, inner, inner] },
    z,
    color: fg,
    params,
  });
  if (dots)
    for (const { x, y } of layout.dots) {
      if (coarse) {
        splats.push({
          p: [x, y, z],
          scales: [0.27, 0.27, 0.01],
          quat: [0, 0, 0, 1],
          color: colorAt ? colorAt(x, y, true) : decorColor,
          opacity: 1,
          params,
          pattern: false,
        });
        continue;
      }
      const a = 0.44;
      crisp({
        x0: x - a,
        y0: y - a,
        x1: x + a,
        y1: y + a,
        rad: [a, a, a, a],
        z,
        color: colorAt ? (px, py) => colorAt(px, py, true) : decorColor,
        params,
      });
    }
  return { splats, half: H, layout };
}
