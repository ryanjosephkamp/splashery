// The song landscape's analysis, frame by frame (lane Live input r2): pure
// functions shared by the analysis worker (song-worker.js), the tests and
// the Node tools. A song is cut into frames HOP seconds apart; each frame's
// features are measured from the samples around its moment, so every shape
// the toy draws is a measured feature of the sound at that time:
//
//   bands   the landscape's bands (12 a semitone-octave, F_MIN to F_MAX), dB:
//           the loudest bin in each band, as the spectrogram has always
//           measured them (studio-audio.js)
//   six     six bands, bass to treble (SIX_EDGES), as dB of their power
//   rms     the loudness of the HOP around the frame, dB (a sharp envelope:
//           a click shows in its own frame)
//   centroid  the spectrum's center of mass, Hz (the "brightness")
//   f0      the pitch where the sound is voiced (YIN), Hz, else 0
//   flux    how much the spectrum rose since the last frame (onsets)

import { fft, hann, bands, F_MIN, F_MAX, DB_FLOOR } from "./studio-audio.js";

export const HOP = 0.04; // seconds between frames
export const SIZE = 4096; // the spectrum's window
export const SIX_EDGES = [40, 150, 400, 1000, 2500, 6000, 16000];
export const FIELDS = ["rms", "centroid", "f0", "flux", "six0", "six1", "six2", "six3", "six4", "six5"]; // prettier-ignore
const NF = 12;

// How many frames a song of `seconds` has.
export const frameCount = (seconds) => Math.max(1, Math.floor(seconds / HOP));

// A frame's moment (its center), in seconds.
export const frameTime = (i) => (i + 0.5) * HOP;

// Storage for a song's features: { n, nf, bands (n × nf dB), feat (n ×
// FIELDS dB/Hz), done (n bytes, 1 once a frame is measured) }.
export function makeFeatures(n) {
  const nf = bands(NF).nf;
  return {
    n,
    nf,
    bands: new Float32Array(n * nf).fill(DB_FLOOR),
    feat: new Float32Array(n * FIELDS.length),
    done: new Uint8Array(n),
  };
}

const field = Object.fromEntries(FIELDS.map((f, i) => [f, i]));
export const F = field;

// The analyser's scratch (one per worker).
export function makeAnalyser(rate) {
  const { nf, edges, centers } = bands(NF);
  const win = hann(SIZE);
  let wsum = 0;
  for (let i = 0; i < SIZE; i++) wsum += win[i];
  const bin = rate / SIZE;
  const lo = edges.map((e) => Math.max(0, Math.floor(e / bin)));
  const sixBins = SIX_EDGES.map((e) => Math.min(SIZE / 2, Math.round(e / bin)));
  // Pitch: on the sound decimated to about 11 kHz, a 46 ms frame.
  const dec = Math.max(1, Math.round(rate / 11025));
  const prate = rate / dec;
  const PL = 512;
  const tauMax = Math.min(PL - 64, Math.ceil(prate / 60));
  const tauMin = Math.max(2, Math.floor(prate / 1000));
  const W = PL - tauMax;
  return {
    rate,
    nf,
    edges,
    centers,
    win,
    scale: 2 / wsum,
    bin,
    lo,
    sixBins,
    dec,
    prate,
    PL,
    tauMax,
    tauMin,
    W, // prettier-ignore
    re: new Float32Array(SIZE),
    im: new Float32Array(SIZE),
    mag: new Float32Array(SIZE / 2 + 1),
    prev: new Float32Array(SIZE / 2 + 1),
    ar: new Float32Array(1024),
    ai: new Float32Array(1024),
    br: new Float32Array(1024),
    bi: new Float32Array(1024),
    px: new Float32Array(PL),
  };
}

// Measures frames [i0, i1) of mono `samples` into `out` (makeFeatures).
export function analyzeFrames(A, samples, i0, i1, out) {
  const { rate, nf, edges, centers, win, scale, bin, lo, sixBins, re, im, mag, prev } = A;
  const N = samples.length;
  const hopN = rate * HOP;
  const nfi = FIELDS.length;
  // The flux compares each frame with the one before it, so a chunk starts
  // from the spectrum of the frame just before it.
  if (i0 > 0) {
    spectrum(A, samples, Math.round(frameTime(i0 - 1) * rate));
    prev.set(mag);
  } else prev.fill(0);
  for (let t = i0; t < Math.min(i1, out.n); t++) {
    const c = Math.round(frameTime(t) * rate);
    // The spectrum.
    const start = c - (SIZE >> 1);
    for (let i = 0; i < SIZE; i++) {
      const j = start + i;
      re[i] = j >= 0 && j < N ? samples[j] * win[i] : 0;
      im[i] = 0;
    }
    fft(re, im);
    let pw = 0;
    let pf = 0;
    let flux = 0;
    for (let i = 0; i <= SIZE / 2; i++) {
      const m = Math.hypot(re[i], im[i]) * scale;
      mag[i] = m;
      const hz = i * bin;
      if (hz >= F_MIN && hz <= F_MAX) {
        pw += m * m;
        pf += m * m * hz;
      }
    }
    // The landscape's bands (the same pooling as spectrogram()).
    for (let f = 0; f < nf; f++) {
      let m = 0;
      const a = lo[f];
      const b = Math.max(a, Math.min(SIZE / 2, Math.ceil(edges[f + 1] / bin) - 1));
      for (let i = a; i <= b; i++) if (mag[i] > m) m = mag[i];
      const x = centers[f] / bin;
      const i0b = Math.min(SIZE / 2 - 1, Math.floor(x));
      const at = mag[i0b] + (mag[i0b + 1] - mag[i0b]) * (x - i0b);
      if (b - a < 1 && at > m) m = at;
      out.bands[t * nf + f] = Math.max(DB_FLOOR, 20 * Math.log10(Math.max(m, 1e-9)));
    }
    // Six bands' power, and the flux (rises only) against the last frame
    // measured just before (or 0).
    const o = t * nfi;
    for (let k = 0; k < 6; k++) {
      let s = 0;
      for (let i = sixBins[k]; i < sixBins[k + 1]; i++) s += mag[i] * mag[i];
      out.feat[o + field.six0 + k] = Math.max(DB_FLOOR, 10 * Math.log10(Math.max(s, 1e-12)));
    }
    if (t > 0) {
      for (let i = 1; i <= SIZE / 2; i++) {
        const d = Math.log1p(mag[i] * 1000) - Math.log1p(prev[i] * 1000);
        if (d > 0) flux += d;
      }
    }
    prev.set(mag);
    out.feat[o + field.flux] = flux / (SIZE / 2);
    out.feat[o + field.centroid] = pw > 1e-12 ? pf / pw : 0;
    // The loudness of the hop around the frame.
    let e = 0;
    let cnt = 0;
    for (
      let j = Math.max(0, Math.round(c - hopN / 2));
      j < Math.min(N, Math.round(c + hopN / 2));
      j++
    ) {
      e += samples[j] * samples[j];
      cnt++;
    }
    out.feat[o + field.rms] = Math.max(DB_FLOOR, 10 * Math.log10(Math.max(e / Math.max(1, cnt), 1e-12)) + 3.01); // prettier-ignore
    out.feat[o + field.f0] = pitchAt(A, samples, c);
    out.done[t] = 1;
  }
}

// The window's magnitudes around sample c (into A.mag).
function spectrum(A, samples, c) {
  const { re, im, win, mag, scale } = A;
  const N = samples.length;
  const start = c - (SIZE >> 1);
  for (let i = 0; i < SIZE; i++) {
    const j = start + i;
    re[i] = j >= 0 && j < N ? samples[j] * win[i] : 0;
    im[i] = 0;
  }
  fft(re, im);
  for (let i = 0; i <= SIZE / 2; i++) mag[i] = Math.hypot(re[i], im[i]) * scale;
}

// YIN (de Cheveigné and Kawahara) on the sound decimated to about 11 kHz
// around sample c, the difference function from FFT cross-correlation.
// Returns Hz, or 0 where the sound isn't voiced.
function pitchAt(A, samples, c) {
  const { dec, prate, PL, tauMax, tauMin, W, ar, ai, br, bi, px } = A;
  const N = samples.length;
  const s0 = c - ((PL * dec) >> 1);
  let energy = 0;
  for (let i = 0; i < PL; i++) {
    let v = 0;
    for (let k = 0; k < dec; k++) {
      const j = s0 + i * dec + k;
      if (j >= 0 && j < N) v += samples[j];
    }
    px[i] = v / dec;
    energy += px[i] * px[i];
  }
  if (energy / PL < 1e-6) return 0;
  // Cross-correlation of the first W samples with the whole frame.
  ar.fill(0);
  ai.fill(0);
  br.fill(0);
  bi.fill(0);
  for (let i = 0; i < W; i++) ar[i] = px[i];
  for (let i = 0; i < PL; i++) br[i] = px[i];
  fft(ar, ai);
  fft(br, bi);
  // conj(A) * B, then the inverse (a forward FFT of the conjugate).
  for (let i = 0; i < 1024; i++) {
    const r = ar[i] * br[i] + ai[i] * bi[i];
    const im2 = ar[i] * bi[i] - ai[i] * br[i];
    ar[i] = r;
    ai[i] = -im2;
  }
  fft(ar, ai);
  // d(τ) = e(0..W) + e(τ..τ+W) - 2 c(τ), then its cumulative mean normalized form.
  let e0 = 0;
  for (let i = 0; i < W; i++) e0 += px[i] * px[i];
  let et = e0;
  let run = 0;
  let best = -1;
  let prevD = 1;
  let prevD2 = 1;
  let shift = 0;
  for (let tau = 1; tau <= tauMax; tau++) {
    et += px[tau + W - 1] * px[tau + W - 1] - px[tau - 1] * px[tau - 1];
    const cc = ar[tau] / 1024;
    const d = Math.max(0, e0 + et - 2 * cc);
    run += d;
    const dn = run > 0 ? (d * tau) / run : 1;
    if (tau > tauMin + 1 && prevD < 0.2 && prevD <= dn && prevD <= prevD2) {
      best = tau - 1;
      // A parabola through the dip and its neighbors places it between samples.
      const den = prevD2 + dn - 2 * prevD;
      if (Math.abs(den) > 1e-9) shift = Math.max(-0.5, Math.min(0.5, (0.5 * (prevD2 - dn)) / den));
      break;
    }
    prevD2 = prevD;
    prevD = dn;
  }
  return best > 0 ? prate / (best + shift) : 0;
}

// The pitch to show for a frame: F0 where voiced, else the spectral centroid.
export const pitchOf = (feat, t) => {
  const o = t * FIELDS.length;
  return feat[o + field.f0] || feat[o + field.centroid] || 0;
};
