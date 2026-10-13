// sRGB transfer, XYZ matrix, and CIELAB equations:
// https://www.w3.org/TR/css-color-4/#color-conversion-code
// This toy deliberately uses sRGB's D65 reference white, not CSS Lab's D50.
const XYZ = [
  [506752 / 1228815, 87881 / 245763, 12673 / 70218],
  [87098 / 409605, 175762 / 245763, 12673 / 175545],
  [7918 / 409605, 87881 / 737289, 1001167 / 1053270],
];
const WHITE = [0.3127 / 0.329, 1, (1 - 0.3127 - 0.329) / 0.329];

export function rgbToLab(rgb) {
  const linear = rgb.map((v) => (v <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4));
  const f = XYZ.map((row, i) => {
    const q = row.reduce((sum, v, j) => sum + v * linear[j], 0) / WHITE[i];
    return q > 216 / 24389 ? Math.cbrt(q) : ((24389 / 27) * q + 16) / 116;
  });
  return [116 * f[1] - 16, 500 * (f[0] - f[1]), 200 * (f[1] - f[2])];
}

export function rgbToHsv([r, g, b]) {
  const v = Math.max(r, g, b);
  const d = v - Math.min(r, g, b);
  let h = 0;
  if (d) {
    if (v === r) h = ((g - b) / d) % 6;
    else if (v === g) h = (b - r) / d + 2;
    else h = (r - g) / d + 4;
    h = (h * 60 + 360) % 360;
  }
  return [h, v ? d / v : 0, v];
}

export function hsvToRgb(h, s, v) {
  const c = v * s;
  const x = c * (1 - Math.abs(((h / 60) % 2) - 1));
  const sector = Math.floor(h / 60) % 6;
  const rgb = [
    [c, x, 0],
    [x, c, 0],
    [0, c, x],
    [0, x, c],
    [x, 0, c],
    [c, 0, x],
  ][sector];
  return rgb.map((q) => q + v - c);
}

export function colorPoint(rgb, space) {
  if (space === "lab") {
    const [L, a, b] = rgbToLab(rgb);
    // Equal scale on all three Lab axes; these are dimensionless coordinates.
    return [a * 0.009, (L - 50) * 0.009, b * 0.009];
  }
  if (space === "hsv") {
    const [h, s, v] = rgbToHsv(rgb);
    const theta = (h * Math.PI) / 180;
    return [0.85 * s * v * Math.cos(theta), 1.6 * (v - 0.5), 0.85 * s * v * Math.sin(theta)];
  }
  return rgb.map((v) => 1.6 * (v - 0.5));
}

export const STEP = 1 / 120; // seconds
export const OMEGA = 7; // inverse seconds

// Exact critical-damping step of x'' + 2ωx' + ω²(x - target) = 0.
// https://en.wikipedia.org/wiki/Harmonic_oscillator#Damped_harmonic_oscillator
// Running this exact solution on a fixed clock is stable at any frame rate.
export function springStep(x, velocity, target) {
  const e = x - target;
  const j = velocity + OMEGA * e;
  const decay = Math.exp(-OMEGA * STEP);
  return [target + (e + j * STEP) * decay, (velocity - OMEGA * j * STEP) * decay];
}

export const SWATCHES = [
  { name: "Red", rgb: [1, 0, 0] },
  { name: "Green", rgb: [0, 1, 0] },
  { name: "Blue", rgb: [0, 0, 1] },
  { name: "White", rgb: [1, 1, 1] },
  { name: "Black", rgb: [0, 0, 0] },
];

export function testPattern() {
  const width = 40;
  const height = 48;
  const pixels = [];
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      if (y < 8) pixels.push([...SWATCHES[Math.floor(x / 8)].rgb]);
      else {
        const row = (y - 8) / 39;
        // Two full hue sweeps: saturation above, value below.
        const h = (x / width) * 360;
        pixels.push(hsvToRgb(h, row < 0.5 ? row * 2 : 1, row < 0.5 ? 1 : 2 * (1 - row)));
      }
    }
  }
  return { width, height, pixels, name: "Generated test pattern" };
}
