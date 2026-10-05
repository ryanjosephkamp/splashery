// Lane QR lab r2: a grid of modules as splats, with the knobs that make a
// splat code different from a printed one (how many splats per module, how
// soft they are, the gaps between modules, opacity, colors and gradients,
// the module's shape). The labs toys (src/packs/qr-lab.js) and the study's
// tools (tools/qrs-*.mjs) build their codes with it, so the study measures
// the codes the toys show.
//
// Units: one module is 1. The code is centered on the origin in the XY
// plane, facing +Z, row 0 at the top. Each splat is
//   { p: [x, y, z], scales: [sx, sy, sz], quat: [x, y, z, w], color: [r, g, b],
//     opacity, mod, dark }
// with mod the module's index (row * size + col), or -1 for the sheet (the
// quiet zone and, without light tiles, the light modules).

export const QUIET = 4;
const Q_FLAT = [0, 0, 0, 1];

export function hexRGB(hex, fallback = [0, 0, 0]) {
  const m = /^#?([0-9a-f]{6})$/i.exec(String(hex || "").trim());
  if (!m) return fallback.slice();
  const n = parseInt(m[1], 16);
  return [((n >> 16) & 255) / 255, ((n >> 8) & 255) / 255, (n & 255) / 255];
}
export const rgbHex = (c) =>
  "#" + c.map((v) => Math.round(Math.min(1, Math.max(0, v)) * 255).toString(16).padStart(2, "0")).join(""); // prettier-ignore
const mixc = (a, b, t) => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t]; // prettier-ignore

export const DEFAULTS = {
  per: 3, // splats per module edge (two staggered lattices of them)
  soft: 0.55, // each splat's spread (its standard deviation) over its spacing
  gap: 0, // the share of a module's edge left empty
  opacity: 1,
  shape: "square", // "square" | "dot" | "rounded"
  fg: [0.07, 0.08, 0.1],
  bg: [1, 1, 1],
  fg2: null, // a gradient's second color (top left to bottom right)
  lightTiles: false, // light modules as tiles of their own (to move or flip)
  quiet: QUIET,
};

// modules: Uint8Array(size * size), 1 dark. Returns the splats.
export function codeSplats(modules, size, o = {}) {
  const k = { ...DEFAULTS, ...o };
  const out = [];
  const N = size;
  const H = N / 2 + k.quiet;
  const cx = (c) => c - N / 2 + 0.5;
  const cy = (r) => N / 2 - 0.5 - r;
  const fgAt = (x, y) => (k.fg2 ? mixc(k.fg, k.fg2, Math.min(1, Math.max(0, 0.5 + (x - y) / (2 * N)))) : k.fg); // prettier-ignore
  // A patch of flat splats over [x0, x1] × [y0, y1], kept where inside()
  // holds: two staggered lattices, so a patch is one even color.
  const patch = (
    x0,
    y0,
    x1,
    y1,
    z,
    per,
    inside,
    color,
    mod,
    dark,
    soft = k.soft,
    opacity = k.opacity,
  ) => {
    const nx = Math.max(1, Math.round((x1 - x0) * per));
    const ny = Math.max(1, Math.round((y1 - y0) * per));
    const sx = (x1 - x0) / nx;
    const sy = (y1 - y0) / ny;
    const scales = [soft * sx, soft * sy, 0.02 * Math.min(sx, sy)];
    for (let layer = 0; layer < 2; layer++)
      for (let j = 0; j < ny - layer; j++)
        for (let i = 0; i < nx - layer; i++) {
          const x = x0 + (i + 0.5 + layer * 0.5) * sx;
          const y = y0 + (j + 0.5 + layer * 0.5) * sy;
          if (inside && !inside(x, y)) continue;
          out.push({ p: [x, y, z], scales, quat: Q_FLAT, color: typeof color === "function" ? color(x, y) : color, opacity, mod, dark }); // prettier-ignore
        }
  };
  // The sheet: the whole square with its quiet zone, a little behind.
  // The sheet: the whole square with its quiet zone, a little behind (light
  // modules show it, unless they are tiles of their own).
  patch(-H, -H, H, H, -0.02, Math.min(k.per, 2), null, k.bg, -1, 0, 0.55, 1);
  const g = k.gap / 2;
  for (let r = 0; r < N; r++)
    for (let c = 0; c < N; c++) {
      const i = r * N + c;
      const d = modules[i] === 1;
      if (!d && !k.lightTiles) continue;
      const x = cx(c);
      const y = cy(r);
      let inside = null;
      const h = 0.5 - g;
      if (k.shape === "dot") inside = (px, py) => Math.hypot(px - x, py - y) <= h + 1e-6;
      else if (k.shape === "rounded")
        inside = (px, py) => {
          const rr = h * 0.6;
          const qx = Math.max(Math.abs(px - x) - (h - rr), 0);
          const qy = Math.max(Math.abs(py - y) - (h - rr), 0);
          return Math.hypot(qx, qy) <= rr + 1e-6;
        };
      patch(x - h, y - h, x + h, y + h, d ? 0.01 : 0, k.per, inside, d ? fgAt : k.bg, i, d ? 1 : 0); // prettier-ignore
    }
  return out;
}

// The center of module (row, col) in code units.
export const moduleCenter = (size, row, col) => [col - size / 2 + 0.5, size / 2 - 0.5 - row, 0];
