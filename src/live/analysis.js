// Live input (lane Live input): the sums behind the microphone, pure and
// testable in Node. Nothing here touches the page, the microphone or the
// network.
//
//   detectPitch(samples, rate)  the note being sung or played (YIN)
//   noteOf(hz)                  its name, octave, MIDI number and cents off
//   OnsetDetector               sharp sounds (a clap), not steady noise
//   measureDecay(energy, …)     a room's reverberation time (RT60) from the
//                               decay of a clap's energy (Schroeder)
//   bandLevels(db, …)           an analyser's spectrum pooled into bands

// ---- Pitch -----------------------------------------------------------------------
// YIN (de Cheveigné and Kawahara, 2002): the cumulative mean normalized
// difference d'(τ) of the signal with itself τ samples later dips near 0 at
// the period. The first dip under the threshold is taken (so an octave
// above the note is not mistaken for it), refined by a parabola through its
// neighbors. `clarity` is 1 − d'(τ): near 1 for a clean note, low for noise.
// A quiet frame (RMS under `minRms`) has no pitch.
export function detectPitch(
  x,
  rate,
  { minHz = 55, maxHz = 1800, threshold = 0.15, minRms = 0.004 } = {},
) {
  const n = x.length;
  let sum = 0;
  for (let i = 0; i < n; i++) sum += x[i] * x[i];
  const rms = Math.sqrt(sum / n);
  if (rms < minRms) return null;
  const tauMin = Math.max(2, Math.floor(rate / maxHz));
  const tauMax = Math.min(Math.floor(n / 2), Math.ceil(rate / minHz));
  if (tauMax <= tauMin + 2) return null;
  const w = n - tauMax; // the window compared
  const d = new Float32Array(tauMax + 1);
  for (let tau = 1; tau <= tauMax; tau++) {
    let s = 0;
    for (let i = 0; i < w; i++) {
      const v = x[i] - x[i + tau];
      s += v * v;
    }
    d[tau] = s;
  }
  // Cumulative mean normalized difference.
  const dn = new Float32Array(tauMax + 1);
  dn[0] = 1;
  let run = 0;
  for (let tau = 1; tau <= tauMax; tau++) {
    run += d[tau];
    dn[tau] = run > 0 ? (d[tau] * tau) / run : 1;
  }
  let tau = -1;
  for (let t = tauMin; t < tauMax; t++) {
    if (dn[t] < threshold) {
      while (t + 1 < tauMax && dn[t + 1] < dn[t]) t++;
      tau = t;
      break;
    }
  }
  if (tau < 0) return null;
  // Parabolic interpolation around the dip.
  let better = tau;
  if (tau > 1 && tau < tauMax) {
    const a = dn[tau - 1];
    const b = dn[tau];
    const c = dn[tau + 1];
    const den = a + c - 2 * b;
    if (Math.abs(den) > 1e-12) better = tau + (0.5 * (a - c)) / den;
  }
  const hz = rate / better;
  if (!(hz >= minHz && hz <= maxHz)) return null;
  return { hz, clarity: Math.max(0, Math.min(1, 1 - dn[tau])), rms };
}

const NAMES = ["C", "C♯", "D", "D♯", "E", "F", "F♯", "G", "G♯", "A", "A♯", "B"];
const ASCII = ["C", "C#", "D", "D#", "E", "F", "F#", "G", "G#", "A", "A#", "B"];

// A frequency's nearest note (A4 = 440 Hz): { midi, name ("A♯4"), ascii
// ("A#4"), cents (−50..50: how far sharp of it), hz (the note's own) }.
export function noteOf(hz) {
  if (!(hz > 0)) return null;
  const m = 69 + 12 * Math.log2(hz / 440);
  const midi = Math.round(m);
  const pc = ((midi % 12) + 12) % 12;
  const octave = Math.floor(midi / 12) - 1;
  return {
    midi,
    name: `${NAMES[pc]}${octave}`,
    ascii: `${ASCII[pc]}${octave}`,
    cents: Math.round((m - midi) * 100),
    hz: 440 * 2 ** ((midi - 69) / 12),
  };
}

export const midiHz = (midi) => 440 * 2 ** ((midi - 69) / 12);

// ---- Onsets (claps) --------------------------------------------------------------
// Fed the energy (mean square) of short hops of samples, one after another.
// An onset is a hop whose energy jumps well above the background (the
// median of the last half second or so) and above an absolute floor, and
// whose rise is fast: a clap goes from background to its peak within a few
// milliseconds. Steady noise, however loud, has no jump; a hum that swells
// slowly has no fast rise. After an onset the detector waits (`holdMs`)
// before it can fire again.
export class OnsetDetector {
  constructor({ hopMs = 5, jumpDb = 18, floorDb = -42, holdMs = 280, historyMs = 600 } = {}) {
    this.hopMs = hopMs;
    this.jumpDb = jumpDb;
    this.floorDb = floorDb;
    this.hold = Math.round(holdMs / hopMs);
    this.size = Math.max(8, Math.round(historyMs / hopMs));
    this.hist = new Float32Array(this.size).fill(1e-10);
    this.n = 0;
    this.warm = Math.round(200 / hopMs); // hops heard before it may fire
    this.wait = 0;
    this.prev = 1e-10;
    this.prev2 = 1e-10;
  }

  background() {
    const k = Math.min(this.n, this.size);
    if (!k) return 1e-10;
    const a = Array.from(this.hist.subarray(0, k)).sort((p, q) => p - q);
    return Math.max(1e-10, a[Math.floor(k / 2)]);
  }

  // One hop's energy; true when it starts a clap.
  push(energy) {
    const e = Math.max(1e-12, energy);
    const bg = this.background();
    const db = 10 * Math.log10(e);
    const overBg = db - 10 * Math.log10(bg);
    // Fast: at least most of the jump happened within the last two hops.
    const overPrev2 = db - 10 * Math.log10(Math.max(this.prev2, bg));
    let fire = false;
    if (this.wait > 0) this.wait--;
    else if (
      this.n >= this.warm &&
      db > this.floorDb &&
      overBg > this.jumpDb &&
      overPrev2 > this.jumpDb * 0.7
    ) {
      fire = true;
      this.wait = this.hold;
    }
    // A clap's own loud hops stay out of the background.
    if (!fire && this.wait === 0) {
      this.hist[this.n % this.size] = e;
      this.n++;
    }
    this.prev2 = this.prev;
    this.prev = e;
    return fire;
  }
}

// ---- Reverberation time ------------------------------------------------------------
// A room's RT60 is how long a sound takes to fade by 60 dB once it stops.
// From a clap: `energy` holds the mean square of short hops (`hopSec`
// each) from the clap's peak on, and `noise` the background's mean square
// (measured before the clap). The noise is taken away, the energy decay
// curve is Schroeder's backward integral of what is left (cut where the
// decay meets the noise), and a straight line fitted to it gives the slope;
// RT60 is the time for 60 dB at that slope. The fit runs from −5 dB down as
// far as the clap stands above the noise: to −35 dB (T30) when it stands 45
// dB above it, −25 dB (T20) at 35 dB, −15 dB (T10) at `minRangeDb` (r3: 20
// dB, was 25, so an ordinary clap in an ordinary room is enough).
//
// When it can't be measured, `why` says what went wrong (r3), and
// DECAY_HINTS has a line for each:
//   quiet        the clap was too soft (its loudest hop under −40 dB)
//   noisy        the clap stood less than minRangeDb above the background
//   clipped      `clipped` (the share of the clap's first 50 ms samples at
//                full scale, from the analyser) over 2%: it overloaded
//   interrupted  `interrupted`: another loud sound came before it faded
//   short        it faded too fast to fit (under about 0.1 s)
//   uneven       no clear straight fade (the fit explains under 90%)
export const DECAY_HINTS = {
  quiet: "Too quiet: the clap was too soft to measure. Clap louder, or nearer the device.",
  noisy: "Too noisy: the clap didn't stand out enough from the background. Clap louder, or try when it's quieter.", // prettier-ignore
  clipped: "Too loud: the clap overloaded the microphone. Clap a little softer, or farther from the device.", // prettier-ignore
  interrupted: "Interrupted: another sound came before the clap faded. Clap once and keep still for two seconds.", // prettier-ignore
  short: "Too short: the sound died away almost at once. Try the middle of the room, away from cushions and curtains.", // prettier-ignore
  uneven: "No clear fade: the clap's echo didn't fade evenly (a voice or a noise came in?). Clap once more and keep still.", // prettier-ignore
};

export function measureDecay(
  energy,
  hopSec,
  noise,
  { minRangeDb = 20, clipped = 0, interrupted = false } = {},
) {
  const n = energy.length;
  const fail = (why, rangeDb) => ({ ok: false, why, rangeDb });
  if (interrupted) return fail("interrupted");
  if (n < 8) return fail("short");
  let peak = 0;
  let at = 0;
  for (let i = 0; i < Math.min(n, Math.ceil(0.05 / hopSec) + 1); i++)
    if (energy[i] > peak) {
      peak = energy[i];
      at = i;
    }
  const nz = Math.max(1e-14, noise);
  const range = 10 * Math.log10(peak / nz);
  if (clipped > 0.02) return fail("clipped", range);
  if (!(range >= minRangeDb)) return fail(10 * Math.log10(Math.max(1e-14, peak)) < -40 ? "quiet" : "noisy", range); // prettier-ignore
  // Where the decay reaches the noise: the first point after which a
  // short running mean stays within 3 dB of it.
  const e = energy.subarray ? energy.subarray(at) : energy.slice(at);
  const m = e.length;
  const smooth = new Float32Array(m);
  const k = Math.max(1, Math.round(0.02 / hopSec));
  for (let i = 0; i < m; i++) {
    let s = 0;
    let c = 0;
    for (let j = Math.max(0, i - k); j <= Math.min(m - 1, i + k); j++) {
      s += e[j];
      c++;
    }
    smooth[i] = s / c;
  }
  let end = m;
  for (let i = 0; i < m; i++)
    if (smooth[i] < nz * 2) {
      end = i;
      break;
    }
  if (end < 6) return fail("short", range);
  // Another sound before it faded: the smoothed level rises 8 dB over the
  // lowest it had reached, well above the noise.
  let low = Infinity;
  for (let i = 0; i < end; i++) {
    low = Math.min(low, smooth[i]);
    if (i > 2 * k && smooth[i] > low * 6.3 && smooth[i] > nz * 10) return fail("interrupted", range); // prettier-ignore
  }
  // Schroeder integral of the energy above the noise.
  const edc = new Float64Array(end);
  let acc = 0;
  for (let i = end - 1; i >= 0; i--) {
    acc += Math.max(0, e[i] - nz);
    edc[i] = acc;
  }
  const top = edc[0];
  if (!(top > 0)) return fail("noisy", range);
  const db = Array.from(edc, (v) => 10 * Math.log10(Math.max(1e-30, v / top)));
  const method = range >= 45 && db[end - 1] <= -35 ? "T30" : range >= 35 && db[end - 1] <= -25 ? "T20" : "T10"; // prettier-ignore
  const lo = { T30: -35, T20: -25, T10: -15 }[method];
  if (db[end - 1] > lo) return fail("uneven", range);
  // Least squares over the points between −5 dB and lo.
  let sx = 0;
  let sy = 0;
  let sxx = 0;
  let sxy = 0;
  let syy = 0;
  let c = 0;
  for (let i = 0; i < end; i++) {
    if (db[i] > -5 || db[i] < lo) continue;
    const t = i * hopSec;
    sx += t;
    sy += db[i];
    sxx += t * t;
    sxy += t * db[i];
    syy += db[i] * db[i];
    c++;
  }
  if (c < 4) return fail("short", range);
  const slope = (c * sxy - sx * sy) / (c * sxx - sx * sx);
  if (!(slope < 0)) return fail("uneven", range);
  // How straight the fade is: r² of the fit.
  const r2 = (c * sxy - sx * sy) ** 2 / ((c * sxx - sx * sx) * (c * syy - sy * sy) || 1);
  if (r2 < 0.9) return fail("uneven", range);
  return { ok: true, rt60: -60 / slope, method, rangeDb: range, r2, curve: db };
}

// ---- Bands --------------------------------------------------------------------------
// An analyser's spectrum (dB per bin, from 0 Hz to rate / 2) pooled into `n`
// bands spaced evenly in pitch from fMin to fMax, each the loudest bin in it
// (or the nearest bin, for a band narrower than a bin). Returns dB.
export function bandLevels(db, rate, n, fMin = 50, fMax = 8000, out = new Float32Array(n)) {
  const bins = db.length;
  const hzPerBin = rate / 2 / bins;
  for (let b = 0; b < n; b++) {
    const f0 = fMin * (fMax / fMin) ** (b / n);
    const f1 = fMin * (fMax / fMin) ** ((b + 1) / n);
    const i0 = Math.max(0, Math.min(bins - 1, Math.floor(f0 / hzPerBin)));
    const i1 = Math.max(i0, Math.min(bins - 1, Math.floor(f1 / hzPerBin)));
    let v = -Infinity;
    for (let i = i0; i <= i1; i++) if (db[i] > v) v = db[i];
    out[b] = Number.isFinite(v) ? v : -120;
  }
  return out;
}
