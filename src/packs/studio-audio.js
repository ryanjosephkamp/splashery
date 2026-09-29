// Sound analysis for the song landscape (lane Studio Sound): a real
// short-time Fourier transform of decoded samples, pooled into musical bands.
// Pure functions (no page, no Web Audio), so the tests and the Node tools can
// run them on synthetic sounds.

export const F_MIN = 40; // Hz, the bottom of the landscape
export const F_MAX = 16000; // Hz, the top
export const DB_FLOOR = -80; // dB (0 dB is a full-scale sine wave)

// In place radix-2 FFT of re/im (length a power of two).
export function fft(re, im) {
  const n = re.length;
  for (let i = 1, j = 0; i < n; i++) {
    let bit = n >> 1;
    for (; j & bit; bit >>= 1) j ^= bit;
    j ^= bit;
    if (i < j) {
      [re[i], re[j]] = [re[j], re[i]];
      [im[i], im[j]] = [im[j], im[i]];
    }
  }
  for (let len = 2; len <= n; len <<= 1) {
    const ang = (-2 * Math.PI) / len;
    const wr = Math.cos(ang);
    const wi = Math.sin(ang);
    for (let i = 0; i < n; i += len) {
      let cr = 1;
      let ci = 0;
      for (let k = 0; k < len / 2; k++) {
        const a = i + k;
        const b = a + len / 2;
        const tr = re[b] * cr - im[b] * ci;
        const ti = re[b] * ci + im[b] * cr;
        re[b] = re[a] - tr;
        im[b] = im[a] - ti;
        re[a] += tr;
        im[a] += ti;
        const nr = cr * wr - ci * wi;
        ci = cr * wi + ci * wr;
        cr = nr;
      }
    }
  }
}

export function hann(n) {
  const w = new Float32Array(n);
  for (let i = 0; i < n; i++) w[i] = 0.5 - 0.5 * Math.cos((2 * Math.PI * i) / n);
  return w;
}

// The bands: `perOctave` bands per octave from F_MIN up to F_MAX. Returns
// their edges (nf + 1 values in Hz, log-spaced) and centers.
export function bands(perOctave = 12) {
  const nf = Math.max(1, Math.round(Math.log2(F_MAX / F_MIN) * perOctave));
  const edges = Array.from({ length: nf + 1 }, (_, i) => F_MIN * (F_MAX / F_MIN) ** (i / nf));
  const centers = Array.from({ length: nf }, (_, i) => Math.sqrt(edges[i] * edges[i + 1]));
  return { nf, edges, centers };
}

// The band a frequency falls in (-1 outside the landscape).
export function bandOf(hz, perOctave = 12) {
  const { nf, edges } = bands(perOctave);
  if (hz < edges[0] || hz >= edges[nf]) return -1;
  return Math.floor((Math.log(hz / F_MIN) / Math.log(F_MAX / F_MIN)) * nf);
}

// The spectrogram of mono samples: `frames` slices evenly across the sound and
// `perOctave` bands per octave. Each slice is Hann-windowed (`size` samples,
// a power of two), transformed, scaled so a full-scale sine reads 0 dB, and
// pooled into the bands (the loudest bin in the band, or the spectrum at the
// band's center where bands are finer than bins). When slices are further apart
// than a window, the slices in between are pooled by their maximum, so a long
// song keeps its peaks at low detail. Returns { nf, nt, db, freqs, times }
// with db[t * nf + f] in dB (at least DB_FLOOR).
export function spectrogram(samples, rate, { frames = 200, perOctave = 12, size = 4096 } = {}) {
  const { nf, edges, centers } = bands(perOctave);
  const nt = Math.max(1, frames | 0);
  const N = samples.length;
  const win = hann(size);
  let wsum = 0;
  for (let i = 0; i < size; i++) wsum += win[i];
  const scale = 2 / wsum;
  const bin = rate / size;
  const db = new Float32Array(nt * nf).fill(DB_FLOOR);
  const re = new Float32Array(size);
  const im = new Float32Array(size);
  const mag = new Float32Array(size / 2 + 1);
  // Analysis windows: at least one per output frame, and (for long sounds)
  // enough that no more than about `size / 2` samples go unlooked-at.
  const step = N / nt;
  const per = Math.max(1, Math.min(8, Math.ceil(step / (size / 2))));
  const lo = edges.map((e) => Math.max(0, Math.floor(e / bin)));
  for (let t = 0; t < nt; t++) {
    for (let s = 0; s < per; s++) {
      const centre = Math.floor(step * (t + (s + 0.5) / per));
      const start = centre - (size >> 1);
      for (let i = 0; i < size; i++) {
        const j = start + i;
        re[i] = j >= 0 && j < N ? samples[j] * win[i] : 0;
        im[i] = 0;
      }
      fft(re, im);
      for (let i = 0; i <= size / 2; i++) mag[i] = Math.hypot(re[i], im[i]) * scale;
      for (let f = 0; f < nf; f++) {
        let m = 0;
        const a = lo[f];
        const b = Math.max(a, Math.min(size / 2, Math.ceil(edges[f + 1] / bin) - 1));
        for (let i = a; i <= b; i++) if (mag[i] > m) m = mag[i];
        // Bands finer than a bin: read the spectrum at the band's center.
        const x = centers[f] / bin;
        const i0 = Math.min(size / 2 - 1, Math.floor(x));
        const at = mag[i0] + (mag[i0 + 1] - mag[i0]) * (x - i0);
        if (b - a < 1 && at > m) m = at;
        const v = 20 * Math.log10(Math.max(m, 1e-9));
        const k = t * nf + f;
        if (v > db[k]) db[k] = v;
      }
    }
  }
  for (let i = 0; i < db.length; i++) if (db[i] < DB_FLOOR) db[i] = DB_FLOOR;
  const times = Array.from({ length: nt }, (_, t) => ((t + 0.5) / nt) * (N / rate));
  return { nf, nt, db, freqs: centers, times };
}

// How the landscape is sized to a splat budget: the bands (12 per octave
// unless the budget is small) and the slices, at most `perSecond` a second.
export function landscapePlan(duration, budget, { perSecond = 40, maxFrames = 1600 } = {}) {
  let perOctave = 12;
  let nf = bands(perOctave).nf;
  if (budget / nf < 60) {
    perOctave = 6;
    nf = bands(perOctave).nf;
  }
  const frames = Math.max(8, Math.min(maxFrames, Math.floor(duration * perSecond), Math.floor(budget / nf))); // prettier-ignore
  return { perOctave, nf, frames };
}

// A mono mix of decoded channels (an array of Float32Array).
export function toMono(channels) {
  if (channels.length === 1) return channels[0];
  const out = new Float32Array(channels[0].length);
  for (const ch of channels) for (let i = 0; i < out.length; i++) out[i] += ch[i] / channels.length;
  return out;
}
