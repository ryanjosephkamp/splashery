// Lane AsciiCapture: levels for a dark toy (the owner's note of October 6,
// 2026: the grapes and strawberry GIFs looked dim). The first frame sets one
// contrast for the whole job, so the toy's brightest parts reach the densest
// characters; a bright toy (the orange) keeps the core's default. In color, the
// drawn characters are lifted by the same gain. Only the core's own options
// change; src/export/ascii.js is as it was.

export const BASE_CONTRAST = 1.3; // the core's default
const MAX_CONTRAST = 1.6; // higher looked grainy (the owner, October 6, 2026)
const BLACK = 17; // the core's default black point (the #111111 background)

// The contrast for a job, from its first frame's RGBA pixels: the 95th
// percentile of the lit pixels' luminance maps to 95% of the character ramp.
export function jobContrast(rgba) {
  const lit = [];
  for (let i = 0; i < rgba.length; i += 4) {
    const l = 0.2126 * rgba[i] + 0.7152 * rgba[i + 1] + 0.0722 * rgba[i + 2];
    if (l > BLACK + 12) lit.push(l);
  }
  if (lit.length < 64) return BASE_CONTRAST;
  lit.sort((a, b) => a - b);
  const p95 = lit[Math.floor(lit.length * 0.95)];
  const c = (0.95 * (255 - BLACK)) / Math.max(1, p95 - BLACK);
  return Math.round(Math.min(MAX_CONTRAST, Math.max(BASE_CONTRAST, c)) * 100) / 100;
}

// The color gain that goes with a contrast (1 for the default).
export function colorGain(contrast) {
  return Math.min(2.5, contrast / BASE_CONTRAST);
}

// A frame whose character colors are lifted: each color is scaled (so the
// hue holds) by at least `gain`, and far enough that its brightest channel
// reaches LIFT_TO, at most 3 times, then mixed WHITE_MIX of the way toward
// white (a lighter tint of the same hue); channels clamp at 255. Cells drawn
// as a space have no glyph, so their colors don't show.
export const LIFT_TO = 250;
export const WHITE_MIX = 0; // a white tint flattened the colors

export function brighten(frame, gain = 1) {
  const lift = (c) => {
    const r = (c >> 16) & 255;
    const g = (c >> 8) & 255;
    const b = c & 255;
    const top = Math.max(r, g, b);
    if (!top) return c;
    const k = Math.min(3, Math.max(gain, LIFT_TO / top, 1));
    const ch = (v) => Math.round(Math.min(255, v * k) * (1 - WHITE_MIX) + 255 * WHITE_MIX);
    return (ch(r) << 16) | (ch(g) << 8) | ch(b);
  };
  return { ...frame, colors: frame.colors.map((row) => row.map(lift)) };
}
