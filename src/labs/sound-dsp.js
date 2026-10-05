// Lane Sound and light lab: the sums behind the Sound lab and the Sound
// recorder, pure and testable in Node (no page, no Web Audio, no
// microphone). The spectra reuse the song landscape's FFT and window
// (src/packs/studio-audio.js).
//
//   toneSamples(tone, rate, t0, n)   what the tone generator plays, sampled
//   spectrumDb(x, rate)              a Hann-windowed spectrum, dB re a full-scale sine
//   peakOf(db, rate, size)           its loudest frequency (parabolic refinement)
//   rmsDb(x)                         the loudness, dB re full scale (dBFS, RMS of a full-scale sine is −3)
//   splEstimate(dbfs, fullScale)     a rough sound level, uncalibrated
//   beatHz(f1, f2)                   the beat of two tones
//   metronome(bpm, t)                the pendulum's angle and the beat count
//   wavBytes / readWav               16-bit PCM WAV files, written and read back
//   trimmed(x, rate, a, b)           a recording cut to a span, with short fades

import { fft, hann } from "../packs/studio-audio.js";

export const WAVES = ["sine", "square", "sawtooth", "noise"];
export const F_LO = 20; // Hz, the generator's range
export const F_HI = 20000;

// A deterministic white noise (xorshift32), so a test and a clip are the
// same every time.
function noiseAt(i) {
  let s = (i * 2654435761) >>> 0 || 1;
  s ^= s << 13;
  s >>>= 0;
  s ^= s >>> 17;
  s ^= s << 5;
  s >>>= 0;
  return (s / 4294967296) * 2 - 1;
}

// One wave's value at phase p (cycles). The square and the saw are the ideal
// shapes; the speaker plays the browser's band-limited ones (OscillatorNode),
// which differ only above the highest harmonic the sample rate can carry.
export function waveAt(wave, p) {
  const f = p - Math.floor(p);
  if (wave === "square") return f < 0.5 ? 1 : -1;
  if (wave === "sawtooth") return 2 * f - 1;
  return Math.sin(2 * Math.PI * f);
}

// The generator's signal: tone = { wave, f, vol, two, f2 }. With `two`, a
// second sine (or the same wave) at f2 adds in at the same volume, and the
// pair beats at |f1 − f2|. Volumes are 0..1 of full scale; two tones are
// each halved so their sum never clips.
export function toneSamples(tone, rate, t0, n, out = new Float32Array(n)) {
  const { wave = "sine", f = 440, vol = 0.5, two = false, f2 = 444 } = tone;
  const i0 = Math.round(t0 * rate);
  const v = two ? vol / 2 : vol;
  for (let i = 0; i < n; i++) {
    const t = (i0 + i) / rate;
    let x;
    if (wave === "noise") x = noiseAt(i0 + i) * 0.6;
    else x = waveAt(wave, f * t);
    if (two) x += wave === "noise" ? 0 : waveAt(wave, f2 * t);
    out[i] = v * x;
  }
  return out;
}

const WIN = new Map();
const windowOf = (n) => {
  if (!WIN.has(n)) {
    const w = hann(n);
    let s = 0;
    for (let i = 0; i < n; i++) s += w[i];
    WIN.set(n, { w, scale: 2 / s });
  }
  return WIN.get(n);
};

// The spectrum of x (its length a power of two): dB per bin, 0 to rate / 2,
// scaled so a full-scale sine reads 0 dB at its bin.
export function spectrumDb(x, out = new Float32Array(x.length / 2 + 1)) {
  const n = x.length;
  const { w, scale } = windowOf(n);
  const re = new Float32Array(n);
  const im = new Float32Array(n);
  for (let i = 0; i < n; i++) re[i] = x[i] * w[i];
  fft(re, im);
  for (let i = 0; i <= n / 2; i++) out[i] = 20 * Math.log10(Math.max(1e-9, Math.hypot(re[i], im[i]) * scale)); // prettier-ignore
  return out;
}

// The loudest frequency of a spectrum (dB per bin of a `size`-point FFT),
// refined by a parabola through the peak and its neighbors (in dB), and its
// level. `lo` and `hi` limit the search (Hz).
export function peakOf(db, rate, size, { lo = 20, hi = rate / 2 } = {}) {
  const bin = rate / size;
  let best = -1;
  let v = -Infinity;
  const a = Math.max(1, Math.ceil(lo / bin));
  const b = Math.min(db.length - 2, Math.floor(hi / bin));
  for (let i = a; i <= b; i++)
    if (db[i] > v) {
      v = db[i];
      best = i;
    }
  if (best < 0) return null;
  const l = db[best - 1];
  const r = db[best + 1];
  const den = l - 2 * v + r;
  const d = Math.abs(den) > 1e-9 ? (0.5 * (l - r)) / den : 0;
  return { hz: (best + d) * bin, db: v - 0.25 * (l - r) * d };
}

// The RMS level, dB re full scale (a full-scale square reads 0, a
// full-scale sine −3.01).
export function rmsDb(x, from = 0, to = x.length) {
  let s = 0;
  for (let i = from; i < to; i++) s += x[i] * x[i];
  const rms = Math.sqrt(s / Math.max(1, to - from));
  return rms > 0 ? 20 * Math.log10(rms) : -120;
}

// A rough sound pressure level from the microphone's level: dB SPL ≈ dBFS +
// the level that would reach full scale. A typical phone or laptop MEMS
// microphone reads −26 dBFS at 94 dB SPL (a full scale of 120 dB SPL), but
// every device, browser and setting differs, so this is an estimate, not a
// measurement. No frequency weighting (dBZ), 50 ms of sound.
export const FULL_SCALE_SPL = 120;
export const splEstimate = (dbfs, fullScale = FULL_SCALE_SPL) => dbfs + fullScale;

// Two tones close together: the sum swells and fades |f1 − f2| times a
// second (sin a + sin b = 2 cos((a − b) / 2) sin((a + b) / 2)).
export const beatHz = (f1, f2) => Math.abs(f1 - f2);

// The metronome: one click per beat, at each end of the pendulum's swing, so
// a swing from one side to the other takes one beat. angle = A sin(π beats),
// with beats = t × bpm / 60; the click falls where |sin| = 1, half a beat
// after each crossing of the middle. Returns { angle (radians), clicks (how
// many so far), beats (t × bpm / 60) }.
export function metronome(bpm, t, amp = 0.42) {
  const beats = (t * bpm) / 60; // from the middle, swinging right
  return { angle: amp * Math.sin(Math.PI * beats), clicks: Math.floor(beats + 0.5), beats };
}

// The times (seconds from the start) of the clicks in [a, b).
export function clickTimes(bpm, a, b) {
  const per = 60 / bpm;
  const out = [];
  // Clicks at (k + 0.5) beats: the ends of the swing.
  for (let k = Math.max(0, Math.ceil(a / per - 0.5)); (k + 0.5) * per < b; k++) out.push({ k, t: (k + 0.5) * per }); // prettier-ignore
  return out;
}

// ---- WAV ---------------------------------------------------------------------------

// A mono 16-bit PCM WAV file of the samples, as bytes.
export function wavBytes(samples, rate) {
  const n = samples.length;
  const b = new ArrayBuffer(44 + n * 2);
  const v = new DataView(b);
  const str = (at, s) => [...s].forEach((ch, i) => v.setUint8(at + i, ch.charCodeAt(0)));
  str(0, "RIFF");
  v.setUint32(4, 36 + n * 2, true);
  str(8, "WAVEfmt ");
  v.setUint32(16, 16, true);
  v.setUint16(20, 1, true); // PCM
  v.setUint16(22, 1, true); // mono
  v.setUint32(24, rate, true);
  v.setUint32(28, rate * 2, true);
  v.setUint16(32, 2, true);
  v.setUint16(34, 16, true);
  str(36, "data");
  v.setUint32(40, n * 2, true);
  for (let i = 0; i < n; i++) {
    const x = Math.max(-1, Math.min(1, samples[i]));
    v.setInt16(44 + i * 2, Math.round(x * 32767), true);
  }
  return new Uint8Array(b);
}

// Reads a PCM WAV (8, 16, 24 or 32-bit integer, or 32-bit float; any channel
// count, mixed to mono). Returns { samples, rate, channels, bits }.
export function readWav(bytes) {
  const v = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const tag = (at) => String.fromCharCode(...bytes.subarray(at, at + 4));
  if (tag(0) !== "RIFF" || tag(8) !== "WAVE") throw new Error("Not a WAV file.");
  let at = 12;
  let fmt = null;
  while (at + 8 <= bytes.length) {
    const id = tag(at);
    const size = v.getUint32(at + 4, true);
    const body = at + 8;
    if (id === "fmt ")
      fmt = { format: v.getUint16(body, true), channels: v.getUint16(body + 2, true), rate: v.getUint32(body + 4, true), bits: v.getUint16(body + 14, true) }; // prettier-ignore
    if (id === "data") {
      if (!fmt) throw new Error("A WAV file without its format.");
      const bps = fmt.bits / 8;
      const frames = Math.floor(Math.min(size, bytes.length - body) / (bps * fmt.channels));
      const samples = new Float32Array(frames);
      for (let i = 0; i < frames; i++) {
        let s = 0;
        for (let c = 0; c < fmt.channels; c++) {
          const p = body + (i * fmt.channels + c) * bps;
          let x;
          if (fmt.format === 3 && fmt.bits === 32) x = v.getFloat32(p, true);
          else if (fmt.bits === 16)
            x = Math.max(-1, v.getInt16(p, true) / 32767); // as wavBytes writes it
          else if (fmt.bits === 8) x = (v.getUint8(p) - 128) / 128;
          else if (fmt.bits === 24)
            x = ((v.getUint8(p) | (v.getUint8(p + 1) << 8) | (v.getInt8(p + 2) << 16)) / 8388608); // prettier-ignore
          else if (fmt.bits === 32) x = v.getInt32(p, true) / 2147483648;
          else throw new Error("That WAV file's sample format isn't supported.");
          s += x;
        }
        samples[i] = s / fmt.channels;
      }
      return { samples, rate: fmt.rate, channels: fmt.channels, bits: fmt.bits };
    }
    at = body + size + (size & 1);
  }
  throw new Error("A WAV file without sound data.");
}

// A span of a recording (a and b in seconds), with 5 ms fades at its ends
// so the cut doesn't click.
export function trimmed(x, rate, a, b) {
  const i0 = Math.max(0, Math.min(x.length, Math.round(a * rate)));
  const i1 = Math.max(i0, Math.min(x.length, Math.round(b * rate)));
  const out = x.slice(i0, i1);
  const fade = Math.min(Math.round(0.005 * rate), Math.floor(out.length / 2));
  for (let i = 0; i < fade; i++) {
    const g = i / fade;
    out[i] *= g;
    out[out.length - 1 - i] *= g;
  }
  return out;
}

// The span where a recording is louder than `floorDb` below its loudest
// 20 ms (a suggestion for the trim: the silence before and after cut off).
export function soundSpan(x, rate, floorDb = 40) {
  const hop = Math.max(1, Math.round(rate * 0.02));
  const n = Math.floor(x.length / hop);
  if (!n) return [0, x.length / rate];
  const lv = new Float32Array(n);
  let top = -200;
  for (let i = 0; i < n; i++) {
    lv[i] = rmsDb(x, i * hop, (i + 1) * hop);
    if (lv[i] > top) top = lv[i];
  }
  let a = 0;
  while (a < n - 1 && lv[a] < top - floorDb) a++;
  let b = n - 1;
  while (b > a && lv[b] < top - floorDb) b--;
  return [Math.max(0, (a - 1) * hop) / rate, Math.min(x.length, (b + 2) * hop) / rate];
}

// Where a frequency sits on a log axis from lo to hi (0..1).
export const logPos = (hz, lo = 30, hi = 16000) => Math.log(hz / lo) / Math.log(hi / lo);
export const logHz = (u, lo = 30, hi = 16000) => lo * (hi / lo) ** u;
