// Lane AsciiCapture: levels for a dark toy (the owner's note of October 6,
// 2026: the grapes and strawberry GIFs looked dim). The first frame sets one
// contrast for the whole job, so the toy's brightest parts reach the densest
// characters; a bright toy (the orange) keeps the core's default. In color, the
// drawn characters are lifted by the same gain. Only the core's own options
// change; src/export/ascii.js is as it was.

export const BASE_CONTRAST = 1.3; // the core's default
const MAX_CONTRAST = 3;
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

// A frame whose character colors are lifted by `gain` (each channel scaled,
// clamped to 255, so the hue holds).
export function brighten(frame, gain) {
  if (!(gain > 1)) return frame;
  const lift = (c) => {
    const r = Math.min(255, Math.round(((c >> 16) & 255) * gain));
    const g = Math.min(255, Math.round(((c >> 8) & 255) * gain));
    const b = Math.min(255, Math.round((c & 255) * gain));
    return (r << 16) | (g << 8) | b;
  };
  return { ...frame, colors: frame.colors.map((row) => row.map(lift)) };
}
