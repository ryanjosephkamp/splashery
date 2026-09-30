// Video to 3D (lane Video 3D, prefix v3d): which moments of a video become photographs for the
// camera solve. Pure functions, no DOM, so the tests run them in Node.
//
// A stretch of the video (its start and length) is sampled a few times a second. Each sample is a
// short window; the sharpest of a few frames in the window is kept (a blurred frame gives the solve
// nothing to match), so a drone clip at 30 frames a second becomes a few sharp photographs a
// second.

// The settings by device tier (player.js detectProfile): phones get fewer frames, a smaller
// picture and fewer splats; the desktop gets more of each.
export const TIERS = {
  low: { maxFrames: 20, frameSide: 480, featSide: 480, trainSide: 360, iters: 1500, splats: 60000 },
  mid: {
    maxFrames: 32,
    frameSide: 640,
    featSide: 640,
    trainSide: 480,
    iters: 3000,
    splats: 120000,
  },
  high: { maxFrames: 60, frameSide: 960, featSide: 960, trainSide: 720, iters: 7000, splats: 250000 }, // prettier-ignore
  max: { maxFrames: 90, frameSide: 1280, featSide: 960, trainSide: 960, iters: 12000, splats: 350000 }, // prettier-ignore
};

export const tierSettings = (tier) => ({ ...(TIERS[tier] || TIERS.mid) });

const round3 = (v) => Math.round(v * 1000) / 1000;

// The stretch and the times to sample in it.
// duration: the video's length (s); start, length: the stretch (s); rate: samples a second;
// maxFrames: the most photographs to keep (a long stretch is sampled more thinly).
// Returns { start, end, rate, step, windows: [{ t, from, to }] }: t is the window's middle, and
// the sharpest frame between from and to is kept.
export function planFrames({ duration, start = 0, length = 10, rate = 3, maxFrames = 60 }) {
  const dur = Math.max(0, Number(duration) || 0);
  if (dur <= 0) return { start: 0, end: 0, rate: 0, step: 0, windows: [] };
  const s = Math.min(Math.max(0, Number(start) || 0), Math.max(0, dur - 0.05));
  const e = Math.min(dur, s + Math.max(0.1, Number(length) || 0));
  const span = e - s;
  const want = Math.max(2, Math.floor(span * Math.max(0.1, rate)));
  const n = Math.max(2, Math.min(want, Math.max(2, maxFrames)));
  const step = span / n;
  const windows = [];
  for (let i = 0; i < n; i++) {
    const from = s + i * step;
    windows.push({ t: round3(from + step / 2), from: round3(from), to: round3(from + step) });
  }
  return { start: round3(s), end: round3(e), rate: round3(n / span), step: round3(step), windows };
}

// The times to look at inside one window: `tries` evenly spaced frames (the window's middle when
// tries is 1).
export function windowTimes(w, tries = 3) {
  if (tries <= 1) return [w.t];
  const out = [];
  const pad = (w.to - w.from) / (2 * tries);
  for (let i = 0; i < tries; i++) out.push(round3(w.from + pad + (i * (w.to - w.from)) / tries));
  return out;
}

// How sharp a grayscale picture is: the variance of its Laplacian (more edges, more contrast in
// them, a higher number). gray: Float32Array or Uint8Array, w x h.
export function sharpness(gray, w, h) {
  let sum = 0;
  let sum2 = 0;
  let n = 0;
  for (let y = 1; y < h - 1; y++) {
    for (let x = 1; x < w - 1; x++) {
      const i = y * w + x;
      const l = gray[i - 1] + gray[i + 1] + gray[i - w] + gray[i + w] - 4 * gray[i];
      sum += l;
      sum2 += l * l;
      n++;
    }
  }
  if (!n) return 0;
  const m = sum / n;
  return sum2 / n - m * m;
}

// The picture size for a frame: the long side at most `side`, even numbers.
export function fitSide(w, h, side) {
  const f = Math.min(1, side / Math.max(w, h));
  return [Math.max(2, 2 * Math.round((w * f) / 2)), Math.max(2, 2 * Math.round((h * f) / 2))];
}

// Splat.js takes any picture close to 2:1 for a 360-degree panorama (a 2:1 video, or one cropped
// to it) and slices it into six views. A frame that close is trimmed at the sides to 1.9:1.
// Returns the part of the video frame to keep: { sx, sw } (sw of the video's width, from sx).
export function panoSafeCrop(w, h) {
  const a = w / h;
  if (Math.abs(a - 2) >= 0.06) return { sx: 0, sw: w };
  const sw = Math.round(h * 1.9);
  return { sx: Math.round((w - sw) / 2), sw };
}
