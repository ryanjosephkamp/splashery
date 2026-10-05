// Lane QR lab r2 (X2): three codes in one square. Three QR codes of the same
// version share one grid: the first sets each module's red, the second its
// green, the third its blue (a dark module turns its channel off). So a
// module is one of eight colors, white (light in all three) to black (dark
// in all three). Splashery's own reader splits a picture into its red, green
// and blue channels and reads each as an ordinary code: three times the data
// in one square. An ordinary reader sees only the gray of each module (most
// of it from green), so it reads the green code, or nothing.

import { encodeSteps, LEVELS } from "./steps.js";

export const CHANNELS = ["red", "green", "blue"];

// Encodes three texts at one level and one version (the smallest that holds
// all three). Returns { size, version, level, codes: [steps ×3], colors }
// with colors a Float32Array of r, g, b (0..1) per module.
export function encodeRGB(texts, level = "M") {
  if (!LEVELS.includes(level)) level = "M";
  const t = [0, 1, 2].map((i) => String(texts[i] ?? ""));
  const version = Math.max(...t.map((s) => encodeSteps(s, level).version));
  const codes = t.map((s) => encodeSteps(s, level, { version }));
  const size = codes[0].size;
  const colors = new Float32Array(size * size * 3);
  for (let i = 0; i < size * size; i++) for (let c = 0; c < 3; c++) colors[i * 3 + c] = codes[c].modules[i] ? 0 : 1; // prettier-ignore
  return { size, version, level, texts: t, codes, colors };
}

// One channel of an RGBA picture as a gray picture (RGBA again, so any
// reader takes it).
export function channel(img, c) {
  const out = new Uint8ClampedArray(img.width * img.height * 4);
  for (let i = 0; i < out.length; i += 4) {
    const v = img.data[i + c];
    out[i] = out[i + 1] = out[i + 2] = v;
    out[i + 3] = 255;
  }
  return { width: img.width, height: img.height, data: out };
}

// Reads the three codes with `read` (a function from an RGBA picture to text
// or null), one channel at a time: [red, green, blue].
export function readRGB(img, read) {
  return [0, 1, 2].map((c) => read(channel(img, c)));
}

// Channel crosstalk, as a camera's color filters and processing mix them:
// each channel picks up `k` of the other two. Used by the study.
export function crosstalk(img, k) {
  const d = img.data;
  const out = new Uint8ClampedArray(d.length);
  for (let i = 0; i < d.length; i += 4) {
    const [r, g, b] = [d[i], d[i + 1], d[i + 2]];
    out[i] = r * (1 - 2 * k) + (g + b) * k;
    out[i + 1] = g * (1 - 2 * k) + (r + b) * k;
    out[i + 2] = b * (1 - 2 * k) + (r + g) * k;
    out[i + 3] = 255;
  }
  return { width: img.width, height: img.height, data: out };
}
