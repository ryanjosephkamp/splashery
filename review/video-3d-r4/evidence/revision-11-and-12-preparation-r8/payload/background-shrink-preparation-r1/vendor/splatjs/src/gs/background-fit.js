// MIT. Made by Ryan with Codex (GPT-6).
// Three global environment-color coefficients for a FIXED renderer/model, not geometry or detail.
// Inputs must be raw black-render RGBA and the exact loss-eligible packed training targets.

export function backgroundFitMoments() {
  return { denominator: 0, numerator: [0, 0, 0], baseSse: 0, pixels: 0, invalidPixels: 0 };
}

function checkMoments(m) {
  if (!m || !Number.isFinite(m.denominator) || m.denominator < 0 ||
      !Array.isArray(m.numerator) || m.numerator.length !== 3 || !Array.from(m.numerator).every(Number.isFinite) ||
      !Number.isFinite(m.baseSse) || m.baseSse < 0 ||
      !Number.isSafeInteger(m.pixels) || m.pixels < 0 ||
      !Number.isSafeInteger(m.invalidPixels) || m.invalidPixels < 0)
    throw new Error('Invalid background-fit moments');
}

function checkColor(rgb) {
  if (!rgb || rgb.length !== 3 || !Array.from(rgb).every((v) => Number.isFinite(v) && v >= 0 && v <= 1))
    throw new Error('Background RGB must contain three finite values in 0..1');
}

// Compensated sums keep large full-resolution sets stable without retaining the input pictures.
function sum() {
  let value = 0, correction = 0;
  return {
    add(x) {
      const next = value + x;
      correction += Math.abs(value) >= Math.abs(x) ? value - next + x : x - next + value;
      value = next;
    },
    total: () => value + correction,
  };
}

export function accumulateBackgroundFit(moments, rgba, targets, { gain = 1, bias = 0 } = {}) {
  checkMoments(moments);
  if (!(rgba instanceof Float32Array) || !(targets instanceof Uint32Array) || rgba.length !== targets.length * 4)
    throw new Error('Background fit requires matching Float32 RGBA and Uint32 packed targets');
  if (!Number.isFinite(gain) || gain <= 0 || !Number.isFinite(bias))
    throw new Error('Background fit requires finite positive gain and finite bias');
  const denominator = sum(), numerator = [sum(), sum(), sum()], baseSse = sum();
  let pixels = 0, invalidPixels = 0;
  for (let p = 0; p < targets.length; p++) {
    const packed = targets[p], alphaCode = packed >>> 24;
    // The trainer omits invalid undistortion pixels. Their output storage need not be valid.
    if (alphaCode === 0) { invalidPixels++; continue; }
    if (alphaCode !== 255) throw new Error('Background fit does not support soft-alpha targets');
    const alpha = rgba[p * 4 + 3];
    if (!Number.isFinite(alpha) || alpha < 0 || alpha > 1)
      throw new Error('Background fit requires finite rendered opacity in 0..1');
    const coefficient = gain * (1 - alpha);
    denominator.add(coefficient * coefficient);
    for (let c = 0; c < 3; c++) {
      const black = rgba[p * 4 + c];
      if (!Number.isFinite(black)) throw new Error('Background fit requires finite raw black RGB');
      const target = ((packed >>> (c * 8)) & 255) / 255;
      const residual = target - gain * black - bias;
      numerator[c].add(coefficient * residual);
      baseSse.add(residual * residual);
    }
    pixels++;
  }
  const next = {
    denominator: moments.denominator + denominator.total(),
    numerator: moments.numerator.map((value, c) => value + numerator[c].total()),
    baseSse: moments.baseSse + baseSse.total(),
    pixels: moments.pixels + pixels,
    invalidPixels: moments.invalidPixels + invalidPixels,
  };
  // Publish only a whole finite chunk; a rejected input cannot leave a usable partial fit.
  checkMoments(next);
  Object.assign(moments, next);
  return moments;
}

export function solveBackgroundFit(moments) {
  checkMoments(moments);
  if (!moments.pixels || moments.denominator === 0) return null;
  return moments.numerator.map((value) => Math.max(0, Math.min(1, value / moments.denominator)));
}

export function backgroundFitSse(moments, rgb) {
  checkMoments(moments);
  checkColor(rgb);
  const result = sum();
  result.add(moments.baseSse);
  let magnitude = moments.baseSse;
  for (let c = 0; c < 3; c++) {
    const linear = -2 * rgb[c] * moments.numerator[c], quadratic = rgb[c] * rgb[c] * moments.denominator;
    result.add(linear); result.add(quadratic);
    magnitude += Math.abs(linear) + quadratic;
  }
  const sse = result.total();
  if (!Number.isFinite(sse)) throw new Error('Nonfinite background-fit SSE');
  // Only cancellation at floating-point precision may round an otherwise nonnegative SSE below 0.
  if (sse < -32 * Number.EPSILON * magnitude) throw new Error('Inconsistent background-fit SSE');
  return Math.max(0, sse);
}


// Keep the fitted color direction, reducing its magnitude only when the full fit
// regresses an internal validation camera. No evaluation targets enter this rule.
export function constrainBackgroundFit(rgb, validation) {
  checkColor(rgb);
  if (!Array.isArray(validation) || !validation.length)
    throw new Error('Background color constraint requires validation moments');
  for (const moments of validation) checkMoments(moments);
  if (validation.some(m => !m.pixels)) return null;
  if (validation.every(m => backgroundFitSse(m, rgb) <= m.baseSse))
    return { rgb: Array.from(rgb), scale: 1 };
  const norm2 = Array.from(rgb).reduce((s, v) => s + v * v, 0);
  let scale = 1;
  for (const moments of validation) {
    const quadratic = moments.denominator * norm2;
    const linear = -2 * Array.from(rgb).reduce((s, v, c) => s + v * moments.numerator[c], 0);
    if (quadratic === 0) {
      if (linear > 0) return null;
      continue;
    }
    const upper = -linear / quadratic;
    if (!(upper > 0)) return null;
    // Stay inside the nonregressing interval rather than on a cancellation boundary.
    if (upper < 1) scale = Math.min(scale, upper * 0.99);
  }
  if (!(scale > 0 && scale < 1)) return null;
  const bounded = Array.from(rgb, v => v * scale);
  if (validation.some(m => backgroundFitSse(m, bounded) > m.baseSse)) return null;
  return { rgb: bounded, scale };
}
