// The voice library: small synthesised instruments and noises that a toy's
// sound spec plays (no audio files). Pure WebAudio, so it runs in a live
// AudioContext and in an OfflineAudioContext (tools/sound-check.mjs). Nothing
// here touches the page; src/sound.js owns the context and the on/off switch.
//
// A spec is one of:
//   "chime"                                  an old shared sound, by name
//   { voice: "bell", pitch: 0.8, decay: 1.2 } one voice
//   [{ voice: "pluck" }, { voice: "rattle", at: 0.05 }]  layers
//   { on: spec, off: spec }                  a toggle's two sounds
//
// Parameters every voice takes (all optional):
//   pitch  multiplies the voice's frequency (1)
//   f      the frequency itself: Hz or a note name such as "A4" or "C#3"
//   decay  multiplies the voice's length (1)
//   vol    loudness (1)
//   bright 0..1, darker to brighter (each voice has its own default)
//   at     start this many seconds late (0)
//   notes  plays the voice once per note: "C5 E5 G5", "E2+B2+E3" is a chord,
//          "-" a rest; step (seconds between notes, 0.2) and strum (seconds
//          between a chord's notes, 0) set the timing
// Some voices also read n (how many), rate (repeats or wobble per second),
// to (a pitch glide, as a ratio) and kind (a variant); see VOICES below.

// ---- Notes ------------------------------------------------------------------------

const NOTE_INDEX = { C: -9, D: -7, E: -5, F: -4, G: -2, A: 0, B: 2 };

// "A4" -> 440. Numbers pass through as Hz.
export function noteFreq(note) {
  if (typeof note === "number") return note;
  const m = /^([A-G])([#b]?)(-?\d)$/.exec(String(note).trim());
  if (!m) throw new Error(`Unknown note: ${note}`);
  const semis = NOTE_INDEX[m[1]] + (m[2] === "#" ? 1 : m[2] === "b" ? -1 : 0);
  return 440 * 2 ** ((semis + (Number(m[3]) - 4) * 12) / 12);
}

// "C4 E4+G4 - A4" -> [["C4"], ["E4", "G4"], [], ["A4"]]
export function parseNotes(notes) {
  return String(notes)
    .trim()
    .split(/\s+/)
    .map((s) => (s === "-" ? [] : s.split("+")));
}

// ---- Building blocks --------------------------------------------------------------

const TAIL = 0.0001;
const noiseCache = new WeakMap();
const pluckCache = new WeakMap();

// Two seconds of white noise per audio context, shared by every noisy voice.
function noiseBuffer(ctx) {
  let buf = noiseCache.get(ctx);
  if (!buf) {
    const n = Math.floor(ctx.sampleRate * 2);
    buf = ctx.createBuffer(1, n, ctx.sampleRate);
    const d = buf.getChannelData(0);
    let seed = 12345;
    for (let i = 0; i < n; i++) {
      seed = (seed * 1664525 + 1013904223) >>> 0;
      d[i] = (seed / 4294967296) * 2 - 1;
    }
    noiseCache.set(ctx, buf);
  }
  return buf;
}

// An attack-decay envelope on a new gain node: rises to `vol` over `attack`,
// holds, then falls away exponentially until `t + dur`.
function envGain(ctx, t, { vol = 0.5, attack = 0.005, hold = 0, dur = 0.3 }) {
  const g = ctx.createGain();
  g.gain.setValueAtTime(TAIL, t);
  g.gain.exponentialRampToValueAtTime(Math.max(TAIL * 2, vol), t + attack);
  if (hold > 0) g.gain.setValueAtTime(Math.max(TAIL * 2, vol), t + attack + hold);
  g.gain.exponentialRampToValueAtTime(TAIL, t + Math.max(attack + hold + 0.01, dur));
  return g;
}

// A swell: rises over `attack`, falls over the rest (breath, pads, wind).
function swellGain(ctx, t, { vol = 0.5, attack = 0.3, dur = 1 }) {
  const g = ctx.createGain();
  g.gain.setValueAtTime(0, t);
  g.gain.linearRampToValueAtTime(vol, t + attack);
  g.gain.linearRampToValueAtTime(0, t + dur);
  return g;
}

function filter(ctx, t, { type = "lowpass", f = 1000, to, q = 0.7, dur = 0.3 }) {
  const b = ctx.createBiquadFilter();
  b.type = type;
  b.frequency.setValueAtTime(Math.max(20, f), t);
  if (to && to !== f) b.frequency.exponentialRampToValueAtTime(Math.max(20, to), t + dur);
  b.Q.value = q;
  return b;
}

// An oscillator gliding from f to `to` (Hz), with optional vibrato.
function osc(ctx, t, { wave = "sine", f, to, dur, glide = dur, vib = 0, vibRate = 6, detune = 0 }) {
  const o = ctx.createOscillator();
  o.type = wave;
  o.frequency.setValueAtTime(f, t);
  if (to && to !== f) o.frequency.exponentialRampToValueAtTime(Math.max(20, to), t + glide);
  o.detune.value = detune;
  if (vib > 0) {
    const lfo = ctx.createOscillator();
    const depth = ctx.createGain();
    lfo.frequency.value = vibRate;
    depth.gain.value = f * vib;
    lfo.connect(depth).connect(o.frequency);
    lfo.start(t);
    lfo.stop(t + dur + 0.05);
  }
  o.start(t);
  o.stop(t + dur + 0.05);
  return o;
}

// A plain tone with an envelope, straight to `out`.
function tone(ctx, out, t, o) {
  const { dur = 0.2, vol = 0.4, attack = 0.005, hold = 0 } = o;
  osc(ctx, t, { ...o, dur })
    .connect(envGain(ctx, t, { vol, attack, hold, dur }))
    .connect(out);
  return dur;
}

// Filtered noise with an envelope. `am` beats it on and off (rotors, flutter).
function noise(ctx, out, t, o) {
  const {
    dur = 0.3,
    vol = 0.4,
    attack = 0.004,
    hold = 0,
    type = "bandpass",
    f = 1200,
    to,
    q = 0.8,
    swell = false,
    am = 0,
    amDepth = 0.8,
    amWave = "sine",
    offset = Math.random() * 1.5,
  } = o;
  const src = ctx.createBufferSource();
  src.buffer = noiseBuffer(ctx);
  src.loop = true;
  const flt = filter(ctx, t, { type, f, to, q, dur });
  const g = swell
    ? swellGain(ctx, t, { vol, attack, dur })
    : envGain(ctx, t, { vol, attack, hold, dur });
  let node = src.connect(flt).connect(g);
  if (am > 0) {
    const beat = ctx.createGain();
    beat.gain.value = 1 - amDepth / 2;
    const lfo = ctx.createOscillator();
    lfo.type = amWave;
    lfo.frequency.value = am;
    const depth = ctx.createGain();
    depth.gain.value = amDepth / 2;
    lfo.connect(depth).connect(beat.gain);
    lfo.start(t);
    lfo.stop(t + dur + 0.05);
    node = node.connect(beat);
  }
  node.connect(out);
  src.start(t, offset);
  src.stop(t + dur + 0.05);
  return dur;
}

// A struck object: sine partials at `ratios` of f, higher ones quieter and
// shorter, plus a short noise strike. Bells, bars, glass, wood and metal.
const MODES = {
  bell: { ratios: [0.5, 1, 1.19, 1.5, 2, 2.5, 3, 4.2, 5.4], amps: [0.35, 1, 0.5, 0.3, 0.45, 0.25, 0.2, 0.12, 0.08], len: 2.6, strike: 0.15 }, // prettier-ignore
  bar: { ratios: [1, 3, 6.1], amps: [1, 0.35, 0.12], len: 0.7, strike: 0.25 },
  marimba: { ratios: [1, 4, 9.9], amps: [1, 0.25, 0.06], len: 0.9, strike: 0.15 },
  glass: { ratios: [1, 2.32, 4.25, 6.63], amps: [1, 0.5, 0.25, 0.12], len: 1.3, strike: 0.1 },
  tine: { ratios: [1, 6.27, 17.55], amps: [1, 0.2, 0.05], len: 1.6, strike: 0.08 },
  tube: { ratios: [1, 2.76, 5.4, 8.93], amps: [1, 0.55, 0.3, 0.15], len: 2.2, strike: 0.1 },
  metal: { ratios: [1, 1.47, 2.09, 2.56, 3.37, 4.11, 5.2], amps: [1, 0.7, 0.6, 0.45, 0.35, 0.25, 0.2], len: 1.1, strike: 0.5 }, // prettier-ignore
  wood: { ratios: [1, 2.57, 4.2], amps: [1, 0.35, 0.12], len: 0.14, strike: 0.5 },
  hollow: { ratios: [1, 2.02, 3.1], amps: [1, 0.4, 0.15], len: 0.3, strike: 0.35 },
  stone: { ratios: [1, 1.83, 3.2, 4.7], amps: [1, 0.6, 0.35, 0.2], len: 0.09, strike: 0.9 },
  clack: { ratios: [1, 2.4, 3.9], amps: [1, 0.5, 0.3], len: 0.05, strike: 0.7 },
  ding: { ratios: [1, 2, 3], amps: [1, 0.15, 0.04], len: 1.6, strike: 0.02 },
  shell: { ratios: [1, 1.6, 2.7], amps: [1, 0.5, 0.3], len: 0.06, strike: 0.8 },
};

function modal(ctx, out, t, { f, kind = "bell", decay = 1, vol = 0.5, bright = 0.5 }) {
  const m = MODES[kind] || MODES.bell;
  const len = m.len * decay;
  const bus = ctx.createGain();
  bus.gain.value = vol / Math.sqrt(m.ratios.length);
  bus.connect(out);
  m.ratios.forEach((r, i) => {
    const fr = f * r;
    if (fr > ctx.sampleRate * 0.45) return;
    const amp = m.amps[i] * (i === 0 ? 1 : 0.4 + 1.2 * bright);
    const d = len / (1 + i * (1.2 - bright));
    tone(ctx, bus, t, { f: fr, dur: d, vol: Math.min(1, amp), attack: 0.002 });
  });
  if (m.strike > 0)
    noise(ctx, bus, t, {
      dur: 0.025,
      vol: m.strike * (0.5 + bright),
      f: Math.min(9000, f * 3),
      q: 1.5,
    });
  return len;
}

// A plucked string (Karplus-Strong), rendered into a buffer and cached.
function pluckBuffer(ctx, f, len, bright) {
  let cache = pluckCache.get(ctx);
  if (!cache) pluckCache.set(ctx, (cache = new Map()));
  const key = `${f.toFixed(2)}|${len.toFixed(2)}|${bright.toFixed(2)}`;
  if (cache.has(key)) return cache.get(key);
  const sr = ctx.sampleRate;
  const n = Math.floor(sr * len);
  const buf = ctx.createBuffer(1, n, sr);
  const y = buf.getChannelData(0);
  const D = sr / f - 0.5;
  const di = Math.floor(D);
  const frac = D - di;
  const g = 10 ** (-3 / (f * len));
  const a = 0.5 + 0.45 * bright;
  let seed = Math.floor(f * 1000);
  let prev = 0;
  const soft = 1 - 0.8 * bright;
  for (let i = 0; i < n; i++) {
    let v;
    if (i <= di) {
      seed = (seed * 1664525 + 1013904223) >>> 0;
      const w = (seed / 4294967296) * 2 - 1;
      prev = prev * soft + w * (1 - soft);
      v = prev;
    } else {
      const j = i - di;
      const d0 = y[j] * (1 - frac) + (j > 0 ? y[j - 1] : 0) * frac;
      const d1 = j > 0 ? y[j - 1] * (1 - frac) + (j > 1 ? y[j - 2] : 0) * frac : 0;
      v = g * (a * d0 + (1 - a) * d1);
    }
    y[i] = v;
  }
  let peak = 0;
  for (let i = 0; i < n; i++) peak = Math.max(peak, Math.abs(y[i]));
  if (peak > 0) for (let i = 0; i < n; i++) y[i] /= peak;
  if (cache.size > 96) cache.delete(cache.keys().next().value);
  cache.set(key, buf);
  return buf;
}

function pluck(ctx, out, t, { f, decay = 1, vol = 0.5, bright = 0.5, body = 0 }) {
  const len = Math.min(4, 1.4 * decay);
  const src = ctx.createBufferSource();
  src.buffer = pluckBuffer(ctx, f, len, bright);
  const g = ctx.createGain();
  g.gain.value = vol;
  let node = src.connect(g);
  if (body) {
    const b = filter(ctx, t, { type: "peaking", f: 180 + 120 * body, q: 1.2 });
    b.gain.value = 6 * body;
    node = node.connect(b);
  }
  node.connect(out);
  src.start(t);
  return len;
}

// Many small events spread over `dur`: rattles, crunches, patter, crackle,
// sparkles, drips and bubbles. `grain(t, i, r)` plays one; r is 0..1 random.
function grains(ctx, out, t, { n = 8, dur = 0.4, accel = 0, grain }) {
  let at = 0;
  for (let i = 0; i < n; i++) {
    const r = Math.random();
    // accel > 0 packs the events towards the start (a burst that thins out).
    const u = (i + 0.5 * Math.random()) / n;
    at = dur * (accel >= 0 ? u ** (1 + accel) : 1 - (1 - u) ** (1 - accel));
    grain(t + at, i, r);
  }
  return dur + 0.1;
}

// A vocal-ish sound: a buzzy source through formant filters.
function formant(ctx, out, t, o) {
  const {
    f,
    to = f,
    dur = 0.25,
    vol = 0.5,
    attack = 0.01,
    wave = "sawtooth",
    formants,
    formantsTo,
    vib = 0,
    vibRate = 6,
    breath = 0,
  } = o;
  const src = osc(ctx, t, { wave, f, to, dur, vib, vibRate });
  const g = envGain(ctx, t, { vol, attack, hold: dur * 0.4, dur });
  g.connect(out);
  formants.forEach(([F, q, amp], i) => {
    const target = formantsTo?.[i]?.[0];
    const b = filter(ctx, t, { type: "bandpass", f: F, to: target, q, dur });
    const a = ctx.createGain();
    a.gain.value = amp;
    src.connect(b).connect(a).connect(g);
  });
  if (breath > 0)
    noise(ctx, out, t, {
      dur,
      vol: breath * vol,
      f: formants[1]?.[0] || 1500,
      q: 1,
      attack,
    });
  return dur;
}

// ---- Keyboards (lane Pianos) ------------------------------------------------------
// A piano, an upright, a harpsichord, an organ, a synth and vibes. Each note
// is one or a few oscillators on a harmonic spectrum (a PeriodicWave, made
// once per context), a filter that darkens as the note dies, and an
// envelope. `hold` is how long the key is held (seconds): then the damper
// stops the note (a piano's soft stop, an organ's quick release). Without
// it a note rings for the voice's own time.

const waveCache = new WeakMap();
function spectrumWave(ctx, name, amps) {
  let m = waveCache.get(ctx);
  if (!m) waveCache.set(ctx, (m = new Map()));
  if (!m.has(name)) {
    const re = new Float32Array(amps.length + 1);
    const im = new Float32Array(amps.length + 1);
    amps.forEach((a, i) => (im[i + 1] = a));
    m.set(name, ctx.createPeriodicWave(re, im));
  }
  return m.get(name);
}

// Harmonic amplitudes: a string struck (or plucked) at 1/strike of its
// length loses the harmonics with a node there.
function stringSpectrum(n, tilt, strike) {
  const out = [];
  for (let k = 1; k <= n; k++) out.push(Math.abs(Math.sin((Math.PI * k) / strike)) / k ** tilt);
  return out;
}
const KEY_SPECTRA = {
  grand: stringSpectrum(24, 1.05, 7.5),
  upright: stringSpectrum(24, 0.85, 8),
  harpsichord: stringSpectrum(32, 0.55, 9),
  organ: [1, 0.85, 0.35, 0.55, 0, 0.3, 0, 0.35, 0, 0, 0, 0.12, 0, 0, 0, 0.1],
  vibes: [1],
};

// One keyboard note. o: { f, vol, bright, decay, hold, spectrum, strings
// (detunes in cents), ring (seconds to fade at the middle), fall (how much
// faster high notes die), bright filter, thump, click, release, sustain }.
function keyNote(ctx, out, t, o) {
  const f = o.f;
  const vol = o.vol ?? 0.5;
  const bright = o.bright ?? 0.5;
  // High notes die sooner, low ones later (C4 at `ring`).
  const ring = Math.min(9, Math.max(0.5, o.ring * (o.decay ?? 1) * (262 / f) ** o.fall));
  const stop = o.hold !== undefined ? Math.min(ring, Math.max(0.06, o.hold)) : ring;
  const release = o.release ?? 0.12;
  const end = t + stop + release;
  const bus = ctx.createGain();
  const peak = Math.max(TAIL * 4, vol);
  const g = bus.gain;
  g.setValueAtTime(TAIL, t);
  g.exponentialRampToValueAtTime(peak, t + (o.attack ?? 0.004));
  if (o.sustain) {
    // An organ: steady while held.
    g.linearRampToValueAtTime(peak * o.sustain, t + (o.attack ?? 0.004) + 0.05);
  } else {
    // A struck or plucked string: a quick first drop, then a long fade.
    const knee = Math.min(stop, 0.08 + 0.1 * (262 / f) ** 0.3);
    g.exponentialRampToValueAtTime(peak * (o.knee ?? 0.55), t + (o.attack ?? 0.004) + knee);
    g.setTargetAtTime(TAIL, t + knee, ring / 6.9);
  }
  g.cancelScheduledValues(t + stop);
  g.setTargetAtTime(TAIL, t + stop, release / 3);
  // The filter: bright at the strike, darker as it rings.
  const lp = ctx.createBiquadFilter();
  lp.type = "lowpass";
  lp.Q.value = o.q ?? 0.5;
  const top = Math.min(ctx.sampleRate * 0.45, f * (o.open ?? 6) * (0.6 + 1.6 * bright));
  lp.frequency.setValueAtTime(top, t);
  if (!o.sustain)
    lp.frequency.setTargetAtTime(Math.max(f * 1.5, top * (o.close ?? 0.3)), t + 0.01, ring / 4);
  bus.connect(lp).connect(out);
  const wave = spectrumWave(ctx, o.spectrum, KEY_SPECTRA[o.spectrum]);
  const strings = o.strings || [0];
  for (const cents of strings) {
    const osc = ctx.createOscillator();
    osc.setPeriodicWave(wave);
    osc.frequency.value = f;
    osc.detune.value = cents;
    const a = ctx.createGain();
    a.gain.value = 1 / Math.sqrt(strings.length);
    osc.connect(a).connect(bus);
    if (o.trem) {
      // The vibes' motor: a slow swell and fade.
      const lfo = ctx.createOscillator();
      const depth = ctx.createGain();
      lfo.frequency.value = o.trem;
      depth.gain.value = 0.35;
      a.gain.value *= 0.7;
      lfo.connect(depth).connect(a.gain);
      lfo.start(t);
      lfo.stop(end + 0.05);
    }
    osc.start(t);
    osc.stop(end + 0.05);
  }
  // The felt hammer's thump, a quill's click or an organ's key click.
  if (o.thump)
    noise(ctx, out, t, {
      dur: 0.05,
      vol: o.thump * vol,
      f: Math.min(3000, f * 1.2 + 120),
      q: 0.9,
      type: "bandpass",
    });
  if (o.click)
    noise(ctx, out, t, { dur: 0.012, vol: o.click * vol, f: 5200, q: 1.4, type: "bandpass" });
  // A damper falling back on the strings: a very soft felt stop.
  if (o.damp && o.hold !== undefined && o.hold < ring)
    noise(ctx, out, t + stop, { dur: 0.04, vol: o.damp * vol, f: 400, q: 0.8, type: "lowpass" });
  return stop + release;
}

// ---- Voices -----------------------------------------------------------------------
//
// Each voice: (ctx, out, t, p) -> seconds it lasts. p holds the spec's
// parameters with f already resolved (base frequency x pitch, or the note).

const rnd = (lo, hi) => lo + Math.random() * (hi - lo);

export const VOICES = {
  // Keyboards (lane Pianos): f is the note; hold is how long its key is down.
  grand: {
    // A warm concert grand: two strings a hair apart, a felt thump, a long
    // ring that darkens, and the damper's soft stop.
    f: 262,
    bright: 0.45,
    play: (c, o, t, p) =>
      keyNote(c, o, t, { ...p, spectrum: "grand", strings: [-1.2, 1.3], ring: 3.2, fall: 0.75, thump: 0.25, damp: 0.05, release: 0.16, open: 5, close: 0.35 }), // prettier-ignore
  },
  upright: {
    // A brighter bar-room upright: three strings a little out of tune with
    // each other (the honky-tonk), a shorter ring and a woody knock.
    f: 262,
    bright: 0.7,
    play: (c, o, t, p) =>
      keyNote(c, o, t, { ...p, spectrum: "upright", strings: [-9, 0, 8], ring: 1.9, fall: 0.7, thump: 0.35, damp: 0.07, release: 0.1, open: 8, close: 0.45, knee: 0.45 }), // prettier-ignore
  },
  harpsichord: {
    // A quill plucks a bright wire: a crisp click, a thin bright ring and a
    // damper that stops it when the key comes up.
    f: 262,
    bright: 0.85,
    play: (c, o, t, p) =>
      keyNote(c, o, t, { ...p, spectrum: "harpsichord", strings: [0, 2.5], ring: 2.2, fall: 0.6, click: 0.5, damp: 0.08, release: 0.07, open: 14, close: 0.5, knee: 0.7, attack: 0.002 }), // prettier-ignore
  },
  organ: {
    // Drawbars: steady while the key is held, a key click, a quick release.
    f: 262,
    bright: 0.5,
    play: (c, o, t, p) =>
      keyNote(c, o, t, { hold: 0.9, ...p, spectrum: "organ", strings: [0, 3], ring: 6, fall: 0, click: 0.25, sustain: 0.9, release: 0.06, open: 12, attack: 0.01 }), // prettier-ignore
  },
  synth: {
    // Two detuned saws through a filter that opens with each note.
    f: 262,
    bright: 0.5,
    play: (c, o, t, p) => {
      const hold = p.hold ?? 0.7;
      const dur = hold + 0.25;
      const lp = filter(c, t, { f: p.f * (2 + 8 * p.bright), to: p.f * 2.5, q: 3, dur: 0.4 });
      const g = envGain(c, t, { vol: 0.5 * p.vol, attack: 0.012, hold: hold * 0.9, dur });
      lp.connect(g).connect(o);
      for (const d of [-7, 7]) osc(c, t, { wave: "sawtooth", f: p.f, dur, detune: d }).connect(lp);
      return dur;
    },
  },
  vibes: {
    // Metal bars tuned 1:4:10 over a tube, with the motor's slow tremolo.
    f: 523,
    bright: 0.4,
    play: (c, o, t, p) => {
      const end = keyNote(c, o, t, { ...p, spectrum: "vibes", ring: 3.5, fall: 0.35, knee: 0.8, release: 0.3, open: 3, close: 0.9, trem: 5.2 }); // prettier-ignore
      tone(c, o, t, {
        f: p.f * 4,
        dur: 0.5 * (p.decay ?? 1),
        vol: 0.12 * p.vol * (0.5 + p.bright),
      });
      tone(c, o, t, { f: p.f * 10, dur: 0.12, vol: 0.05 * p.vol * (0.5 + p.bright) });
      return end;
    },
  },

  // Strings.
  pluck: { f: 196, bright: 0.5, play: (c, o, t, p) => pluck(c, o, t, { ...p, body: 0.6 }) },
  nylon: { f: 262, bright: 0.25, play: (c, o, t, p) => pluck(c, o, t, { ...p, body: 1 }) },
  harp: {
    f: 392,
    bright: 0.35,
    play: (c, o, t, p) => pluck(c, o, t, { ...p, decay: 1.6 * p.decay, body: 0.3 }),
  },
  sitar: {
    f: 147,
    bright: 0.85,
    play: (c, o, t, p) => {
      // A buzzing bridge: the pluck, plus a thin bright drone that bends.
      pluck(c, o, t, { ...p, decay: 1.5 * p.decay });
      tone(c, o, t, {
        wave: "sawtooth",
        f: p.f * 2,
        to: p.f * 2.02,
        dur: 1.2 * p.decay,
        vol: 0.035 * p.vol,
        attack: 0.01,
      });
      return 1.5 * p.decay;
    },
  },
  twang: {
    // A stretched rubber band or bowstring: a pluck that bends down.
    f: 110,
    bright: 0.6,
    play: (c, o, t, p) => {
      tone(c, o, t, {
        wave: "triangle",
        f: p.f * 1.5,
        to: p.f,
        glide: 0.08,
        dur: 0.5 * p.decay,
        vol: 0.4 * p.vol,
        vib: 0.03,
        vibRate: 14,
      });
      return pluck(c, o, t, { ...p, decay: 0.5 * p.decay, vol: 0.6 * p.vol });
    },
  },

  // Struck things.
  bell: { f: 523, bright: 0.5, play: (c, o, t, p) => modal(c, o, t, { ...p, kind: "bell" }) },
  chimes: {
    // Wind or tubular chimes: n tubes struck in a loose run.
    f: 880,
    bright: 0.5,
    n: 5,
    play: (c, o, t, p) => {
      const scale = [1, 1.125, 1.26, 1.5, 1.68, 2, 2.25];
      for (let i = 0; i < p.n; i++)
        modal(c, o, t + i * 0.09 * p.decay + rnd(0, 0.04), {
          ...p,
          f: p.f * scale[(i * 3) % scale.length],
          kind: "tube",
          vol: p.vol * 0.6,
        });
      return 2.2 * p.decay + p.n * 0.1;
    },
  },
  bar: { f: 1047, bright: 0.5, play: (c, o, t, p) => modal(c, o, t, { ...p, kind: "bar" }) },
  marimba: { f: 523, bright: 0.4, play: (c, o, t, p) => modal(c, o, t, { ...p, kind: "marimba" }) },
  glass: { f: 1568, bright: 0.6, play: (c, o, t, p) => modal(c, o, t, { ...p, kind: "glass" }) },
  tine: { f: 1047, bright: 0.5, play: (c, o, t, p) => modal(c, o, t, { ...p, kind: "tine" }) },
  metal: { f: 330, bright: 0.5, play: (c, o, t, p) => modal(c, o, t, { ...p, kind: "metal" }) },
  wood: { f: 700, bright: 0.5, play: (c, o, t, p) => modal(c, o, t, { ...p, kind: "wood" }) },
  hollow: { f: 330, bright: 0.4, play: (c, o, t, p) => modal(c, o, t, { ...p, kind: "hollow" }) },
  stone: { f: 420, bright: 0.3, play: (c, o, t, p) => modal(c, o, t, { ...p, kind: "stone" }) },
  clack: { f: 2600, bright: 0.6, play: (c, o, t, p) => modal(c, o, t, { ...p, kind: "clack" }) },
  ding: { f: 1319, bright: 0.3, play: (c, o, t, p) => modal(c, o, t, { ...p, kind: "ding" }) },
  sparkle: {
    // High glassy pings scattered over a moment.
    f: 2637,
    bright: 0.6,
    n: 7,
    play: (c, o, t, p) =>
      grains(c, o, t, {
        n: p.n,
        dur: 0.6 * p.decay,
        grain: (at, i, r) =>
          modal(c, o, at, { f: p.f * (0.8 + r * 0.9), kind: "glass", decay: 0.35, vol: 0.25 * p.vol, bright: p.bright }), // prettier-ignore
      }),
  },

  // Drums and hits.
  kick: {
    f: 110,
    play: (c, o, t, p) => {
      // The body, a triangle so phone speakers hear its overtones, and a
      // beater click.
      tone(c, o, t, { wave: "triangle", f: p.f * 1.6, to: p.f * 0.4, glide: 0.12, dur: 0.35 * p.decay, vol: 0.9 * p.vol }); // prettier-ignore
      noise(c, o, t, { f: 2500, q: 1, dur: 0.015, vol: 0.3 * p.vol });
      return 0.35 * p.decay;
    },
  },
  snare: {
    f: 190,
    bright: 0.5,
    play: (c, o, t, p) => {
      tone(c, o, t, { wave: "triangle", f: p.f, to: p.f * 0.8, dur: 0.12, vol: 0.45 * p.vol });
      noise(c, o, t, { type: "highpass", f: 1500 + 2500 * p.bright, q: 0.5, dur: 0.22 * p.decay, vol: 0.5 * p.vol }); // prettier-ignore
      return 0.22 * p.decay;
    },
  },
  tom: {
    f: 130,
    play: (c, o, t, p) => {
      tone(c, o, t, { wave: "triangle", f: p.f, to: p.f * 0.7, dur: 0.4 * p.decay, vol: 0.7 * p.vol }); // prettier-ignore
      noise(c, o, t, { type: "lowpass", f: 800, dur: 0.08, vol: 0.2 * p.vol });
      return 0.4 * p.decay;
    },
  },
  hat: {
    f: 8000,
    play: (c, o, t, p) =>
      noise(c, o, t, { type: "highpass", f: p.f, q: 0.7, dur: 0.06 * p.decay, vol: 0.35 * p.vol }),
  },
  clap: {
    f: 1200,
    play: (c, o, t, p) => {
      for (let i = 0; i < 3; i++)
        noise(c, o, t + i * 0.012, { f: p.f, q: 1.2, dur: 0.03, vol: 0.5 * p.vol });
      noise(c, o, t + 0.036, { f: p.f, q: 1.2, dur: 0.18 * p.decay, vol: 0.45 * p.vol });
      return 0.22 * p.decay;
    },
  },
  thud: {
    // A soft heavy object landing: low body and a muffled slap.
    f: 90,
    bright: 0.3,
    play: (c, o, t, p) => {
      tone(c, o, t, { wave: "triangle", f: p.f * 1.4, to: p.f * 0.6, glide: 0.1, dur: 0.25 * p.decay, vol: 0.8 * p.vol }); // prettier-ignore
      noise(c, o, t, { type: "lowpass", f: 300 + 1500 * p.bright, q: 0.7, dur: 0.12 * p.decay, vol: 0.4 * p.vol }); // prettier-ignore
      return 0.25 * p.decay;
    },
  },
  boing: {
    // A springy wobble that settles: a rubber ball, a spring, a jelly.
    f: 180,
    rate: 14,
    to: 1.6,
    play: (c, o, t, p) =>
      tone(c, o, t, {
        wave: "triangle",
        f: p.f,
        to: p.f * p.to,
        glide: 0.12,
        dur: 0.45 * p.decay,
        vol: 0.5 * p.vol,
        vib: 0.12,
        vibRate: p.rate,
      }),
  },
  pock: {
    // A hollow ball struck by a bat or racket.
    f: 900,
    bright: 0.5,
    play: (c, o, t, p) => {
      tone(c, o, t, { f: p.f, to: p.f * 0.85, dur: 0.07 * p.decay, vol: 0.6 * p.vol });
      noise(c, o, t, { f: p.f * 2, q: 2, dur: 0.02, vol: 0.4 * p.vol * (0.5 + p.bright) });
      return 0.08 * p.decay;
    },
  },
  crack: {
    // A sharp crack: a bat, a breaking shell, splitting ice or rock.
    f: 2200,
    bright: 0.6,
    play: (c, o, t, p) => {
      noise(c, o, t, { type: "highpass", f: p.f * 0.6, q: 0.6, dur: 0.06 * p.decay, vol: 0.7 * p.vol }); // prettier-ignore
      noise(c, o, t + 0.004, { f: p.f, q: 3, dur: 0.12 * p.decay, vol: 0.35 * p.vol * (0.4 + p.bright) }); // prettier-ignore
      tone(c, o, t, { f: p.f / 8, to: p.f / 16, dur: 0.1, vol: 0.3 * p.vol });
      return 0.14 * p.decay;
    },
  },
  slap: {
    f: 1400,
    play: (c, o, t, p) => {
      noise(c, o, t, { f: p.f, q: 0.9, dur: 0.07 * p.decay, vol: 0.7 * p.vol });
      tone(c, o, t, { f: 160, to: 90, dur: 0.08, vol: 0.3 * p.vol });
      return 0.08 * p.decay;
    },
  },
  click: {
    f: 1500,
    play: (c, o, t, p) =>
      tone(c, o, t, { wave: "square", f: p.f, to: p.f * 0.6, dur: 0.03 * p.decay, vol: 0.15 * p.vol }), // prettier-ignore
  },
  switch: {
    // A light switch: two tiny clicks.
    f: 3000,
    play: (c, o, t, p) => {
      noise(c, o, t, { f: p.f, q: 4, dur: 0.012, vol: 0.6 * p.vol });
      noise(c, o, t + 0.035 * p.decay, { f: p.f * 0.7, q: 4, dur: 0.015, vol: 0.4 * p.vol });
      return 0.06 * p.decay;
    },
  },

  // Rattles, crunches and many-small-things.
  rattle: {
    f: 2400,
    n: 8,
    play: (c, o, t, p) =>
      grains(c, o, t, {
        n: p.n,
        dur: 0.35 * p.decay,
        grain: (at, i, r) => noise(c, o, at, { f: p.f * (0.6 + r), q: 5, dur: 0.02, vol: 0.4 * p.vol }), // prettier-ignore
      }),
  },
  clatter: {
    // Hard little objects tumbling: dice, pebbles, shells, pins.
    f: 1400,
    n: 9,
    kind: "stone",
    play: (c, o, t, p) =>
      grains(c, o, t, {
        n: p.n,
        dur: 0.55 * p.decay,
        accel: 0.8,
        grain: (at, i, r) =>
          modal(c, o, at, { f: p.f * (0.7 + 0.8 * r), kind: p.kind, vol: 0.4 * p.vol * (1 - i / (p.n + 2)), bright: 0.5 }), // prettier-ignore
      }),
  },
  crunch: {
    f: 1800,
    n: 14,
    bright: 0.5,
    play: (c, o, t, p) =>
      grains(c, o, t, {
        n: p.n,
        dur: 0.22 * p.decay,
        grain: (at, i, r) =>
          noise(c, o, at, { f: p.f * (0.5 + r * (0.5 + p.bright)), q: 1.5, dur: 0.015 + 0.02 * r, vol: 0.5 * p.vol }), // prettier-ignore
      }),
  },
  patter: {
    // Soft light taps: sprinkles, many feet, petals, rain.
    f: 1600,
    n: 12,
    play: (c, o, t, p) =>
      grains(c, o, t, {
        n: p.n,
        dur: 0.6 * p.decay,
        grain: (at, i, r) =>
          noise(c, o, at, { f: p.f * (0.7 + 0.6 * r), q: 3, dur: 0.012, vol: 0.3 * p.vol * (0.5 + r) }), // prettier-ignore
      }),
  },
  crackle: {
    // Fire, static and ice: sharp random ticks.
    f: 3200,
    n: 14,
    play: (c, o, t, p) =>
      grains(c, o, t, {
        n: p.n,
        dur: 0.8 * p.decay,
        grain: (at, i, r) =>
          noise(c, o, at, { type: "highpass", f: p.f * (0.6 + r), q: 1, dur: 0.004 + 0.012 * r, vol: 0.5 * p.vol * (0.3 + r) }), // prettier-ignore
      }),
  },
  ratchet: {
    // Evenly spaced clicks: a wind-up key, a zipper, a ticking pulsar.
    f: 2200,
    n: 10,
    rate: 16,
    to: 1,
    play: (c, o, t, p) => {
      let at = 0;
      for (let i = 0; i < p.n; i++) {
        noise(c, o, t + at, { f: p.f, q: 6, dur: 0.012, vol: 0.5 * p.vol });
        // `to` above 1 speeds the clicks up as they go.
        at += 1 / (p.rate * p.to ** (i / Math.max(1, p.n - 1)));
      }
      return at + 0.05;
    },
  },
  drip: {
    // Water drops: plinks that rise quickly in pitch.
    f: 900,
    n: 2,
    rate: 3,
    play: (c, o, t, p) => {
      for (let i = 0; i < p.n; i++) {
        const at = t + (i / p.rate) * rnd(0.85, 1.15);
        const f = p.f * rnd(0.85, 1.2);
        tone(c, o, at, { f, to: f * 2.4, glide: 0.04, dur: 0.09 * p.decay, vol: 0.45 * p.vol });
      }
      return p.n / p.rate + 0.1;
    },
  },
  bubbles: {
    f: 500,
    n: 7,
    play: (c, o, t, p) =>
      grains(c, o, t, {
        n: p.n,
        dur: 0.7 * p.decay,
        grain: (at, i, r) => {
          const f = p.f * (0.6 + 1.2 * r);
          tone(c, o, at, { f, to: f * 1.7, dur: 0.05 + 0.07 * (1 - r), vol: 0.3 * p.vol });
        },
      }),
  },
  pop: {
    f: 700,
    play: (c, o, t, p) =>
      tone(c, o, t, { f: p.f, to: p.f * 2, dur: 0.08 * p.decay, vol: 0.45 * p.vol }),
  },
  squish: {
    // Something soft and wet squashed: a low gloop with a slurpy squelch.
    f: 220,
    bright: 0.4,
    play: (c, o, t, p) => {
      tone(c, o, t, { f: p.f, to: p.f * 0.55, dur: 0.18 * p.decay, vol: 0.4 * p.vol, vib: 0.08, vibRate: 30 }); // prettier-ignore
      noise(c, o, t + 0.02, { f: 600 + 1400 * p.bright, to: 300 + 700 * p.bright, q: 3, dur: 0.16 * p.decay, vol: 0.3 * p.vol }); // prettier-ignore
      return 0.2 * p.decay;
    },
  },
  gloop: {
    // A slow thick blob: a bubble that wobbles down.
    f: 160,
    play: (c, o, t, p) =>
      tone(c, o, t, {
        f: p.f,
        to: p.f * 1.8,
        glide: 0.1,
        dur: 0.4 * p.decay,
        vol: 0.5 * p.vol,
        vib: 0.15,
        vibRate: 9,
        attack: 0.02,
      }),
  },
  tear: {
    // Tearing, peeling, flaking: a crackly noise that slides.
    f: 1200,
    to: 2.2,
    bright: 0.5,
    play: (c, o, t, p) => {
      noise(c, o, t, { f: p.f, to: p.f * p.to, q: 1.2, dur: 0.3 * p.decay, vol: 0.35 * p.vol, am: 38, amDepth: 0.9, amWave: "square" }); // prettier-ignore
      return 0.3 * p.decay;
    },
  },

  // Air and water.
  whoosh: {
    f: 300,
    to: 8,
    play: (c, o, t, p) =>
      noise(c, o, t, { f: p.f, to: p.f * p.to, q: 0.7, dur: 0.6 * p.decay, vol: 0.35 * p.vol, attack: 0.12 * p.decay, swell: true }), // prettier-ignore
  },
  wind: {
    f: 500,
    rate: 0.7,
    play: (c, o, t, p) =>
      noise(c, o, t, { type: "bandpass", f: p.f, to: p.f * 1.5, q: 1.5, dur: 1.6 * p.decay, vol: 0.4 * p.vol, attack: 0.5 * p.decay, swell: true, am: p.rate, amDepth: 0.6 }), // prettier-ignore
  },
  roar: {
    // A big steady rush: rocket, burner, jet, sun, waterfall.
    f: 180,
    bright: 0.4,
    play: (c, o, t, p) => {
      const dur = 1.4 * p.decay;
      noise(c, o, t, { type: "lowpass", f: p.f * 3 * (0.5 + p.bright), q: 0.5, dur, vol: 0.55 * p.vol, attack: 0.15, swell: true }); // prettier-ignore
      noise(c, o, t, { f: p.f * 10 * (0.4 + p.bright), q: 0.8, dur, vol: 0.2 * p.vol * p.bright, attack: 0.1, swell: true }); // prettier-ignore
      return dur;
    },
  },
  rumble: {
    // Thunder and earth: a low noise that swells and grumbles.
    f: 90,
    rate: 5,
    play: (c, o, t, p) =>
      noise(c, o, t, { type: "lowpass", f: p.f * 5, to: p.f * 2, q: 0.9, dur: 1.8 * p.decay, vol: 0.9 * p.vol, attack: 0.08, am: p.rate, amDepth: 0.7 }), // prettier-ignore
  },
  hiss: {
    f: 4000,
    play: (c, o, t, p) =>
      noise(c, o, t, { type: "highpass", f: p.f, q: 0.6, dur: 0.6 * p.decay, vol: 0.3 * p.vol, attack: 0.03 }), // prettier-ignore
  },
  sizzle: {
    f: 5000,
    play: (c, o, t, p) => {
      noise(c, o, t, { type: "highpass", f: p.f, q: 0.6, dur: 0.9 * p.decay, vol: 0.2 * p.vol, am: 23, amDepth: 0.6 }); // prettier-ignore
      return VOICES.crackle.play(c, o, t, { ...p, f: p.f * 0.8, n: 10, vol: 0.5 * p.vol });
    },
  },
  breath: {
    // A breath out (to > 1 rises, like a breath in).
    f: 900,
    to: 0.7,
    play: (c, o, t, p) =>
      noise(c, o, t, { f: p.f, to: p.f * p.to, q: 0.9, dur: 0.7 * p.decay, vol: 0.35 * p.vol, attack: 0.25 * p.decay, swell: true }), // prettier-ignore
  },
  splash: {
    f: 1500,
    bright: 0.5,
    play: (c, o, t, p) => {
      noise(c, o, t, { f: p.f, to: p.f * 0.4, q: 0.6, dur: 0.5 * p.decay, vol: 0.5 * p.vol, attack: 0.01 }); // prettier-ignore
      VOICES.drip.play(c, o, t + 0.12, { ...p, f: 700 + 600 * p.bright, n: 4, rate: 12, vol: 0.5 * p.vol }); // prettier-ignore
      return 0.55 * p.decay;
    },
  },
  wave: {
    // A wave: a rushing swell that crashes and hisses away.
    f: 600,
    play: (c, o, t, p) => {
      noise(c, o, t, { type: "lowpass", f: p.f, to: p.f * 4, q: 0.5, dur: 2 * p.decay, vol: 0.55 * p.vol, attack: 0.7 * p.decay, swell: true }); // prettier-ignore
      noise(c, o, t + 0.6 * p.decay, { type: "highpass", f: 2500, q: 0.5, dur: 1.4 * p.decay, vol: 0.25 * p.vol, attack: 0.1, swell: true }); // prettier-ignore
      return 2 * p.decay;
    },
  },
  scrape: {
    // Stone grinding on stone, a skate on ice.
    f: 700,
    rate: 17,
    play: (c, o, t, p) =>
      noise(c, o, t, { f: p.f, to: p.f * 0.8, q: 2.5, dur: 0.5 * p.decay, vol: 0.4 * p.vol, attack: 0.05, am: p.rate, amDepth: 0.7, amWave: "sawtooth" }), // prettier-ignore
  },
  flutter: {
    // Wings, paper, fabric: noise beating quickly.
    f: 1800,
    rate: 22,
    play: (c, o, t, p) =>
      noise(c, o, t, { f: p.f, q: 0.8, dur: 0.45 * p.decay, vol: 0.35 * p.vol, attack: 0.03, am: p.rate, amDepth: 0.95, amWave: "square" }), // prettier-ignore
  },
  chop: {
    // Helicopter rotor: heavy low beats.
    f: 400,
    rate: 11,
    play: (c, o, t, p) =>
      noise(c, o, t, { type: "lowpass", f: p.f, q: 1, dur: 1.2 * p.decay, vol: 0.8 * p.vol, attack: 0.05, am: p.rate, amDepth: 1, amWave: "square" }), // prettier-ignore
  },

  // Tones.
  tone: {
    f: 440,
    to: 1,
    play: (c, o, t, p) =>
      tone(c, o, t, { wave: p.kind || "sine", f: p.f, to: p.f * p.to, dur: 0.4 * p.decay, vol: 0.4 * p.vol, attack: 0.01 }), // prettier-ignore
  },
  blip: {
    f: 880,
    to: 1.5,
    play: (c, o, t, p) =>
      tone(c, o, t, { wave: "square", f: p.f, to: p.f * p.to, dur: 0.07 * p.decay, vol: 0.12 * p.vol }), // prettier-ignore
  },
  zap: {
    f: 1800,
    to: 0.08,
    play: (c, o, t, p) => {
      tone(c, o, t, { wave: "sawtooth", f: p.f, to: p.f * p.to, dur: 0.18 * p.decay, vol: 0.2 * p.vol }); // prettier-ignore
      noise(c, o, t, { type: "highpass", f: 3000, dur: 0.05, vol: 0.2 * p.vol });
      return 0.18 * p.decay;
    },
  },
  squeak: {
    // A rubber squeak: a quick high whistle that bends.
    f: 1800,
    to: 1.35,
    play: (c, o, t, p) => {
      const d = 0.16 * p.decay;
      const s = osc(c, t, { wave: "triangle", f: p.f, to: p.f * p.to, glide: d * 0.4, dur: d, vib: 0.04, vibRate: 28 }); // prettier-ignore
      s.frequency.exponentialRampToValueAtTime(p.f * 0.9, t + d);
      s.connect(envGain(c, t, { vol: 0.3 * p.vol, attack: 0.015, hold: d * 0.5, dur: d })).connect(o); // prettier-ignore
      return d;
    },
  },
  whistle: {
    // A breathy whistle with vibrato; kind "steam" plays a three-note chord.
    f: 1200,
    to: 1,
    play: (c, o, t, p) => {
      const d = 0.8 * p.decay;
      const chord = p.kind === "steam" ? [1, 1.26, 1.5] : [1];
      for (const r of chord)
        tone(c, o, t, { f: p.f * r, to: p.f * r * p.to, dur: d, vol: (0.25 * p.vol) / chord.length ** 0.5, attack: 0.05, hold: d * 0.5, vib: 0.012, vibRate: 5.5 }); // prettier-ignore
      noise(c, o, t, { f: p.f, q: 3, dur: d, vol: 0.12 * p.vol, attack: 0.05, hold: d * 0.5 });
      return d;
    },
  },
  theremin: {
    f: 520,
    to: 1.5,
    play: (c, o, t, p) =>
      tone(c, o, t, { f: p.f, to: p.f * p.to, dur: 1.1 * p.decay, vol: 0.3 * p.vol, attack: 0.1, hold: 0.5 * p.decay, vib: 0.03, vibRate: 6 }), // prettier-ignore
  },
  hum: {
    // A steady electric or motor hum; `to` above 1 powers it up.
    f: 120,
    to: 1,
    play: (c, o, t, p) => {
      const d = 1 * p.decay;
      const bus = filter(c, t, { f: 400 + 3000 * (p.bright ?? 0.3), q: 0.7 });
      bus.connect(o);
      for (const [r, a] of [[1, 0.5], [2, 0.3], [3, 0.15]]) // prettier-ignore
        tone(c, bus, t, { wave: "sawtooth", f: p.f * r, to: p.f * r * p.to, dur: d, vol: a * 0.35 * p.vol, attack: 0.08, hold: d * 0.5, detune: r * 4 }); // prettier-ignore
      return d;
    },
  },
  drone: {
    // Deep slow detuned tones: black holes, gas giants, standing stones.
    f: 55,
    to: 1,
    play: (c, o, t, p) => {
      const d = 2 * p.decay;
      const bus = filter(c, t, { f: 200 + 800 * (p.bright ?? 0.3), to: 150, dur: d, q: 1 });
      bus.connect(o);
      for (const det of [-9, 0, 7])
        tone(c, bus, t, { wave: "sawtooth", f: p.f, to: p.f * p.to, dur: d, vol: 0.3 * p.vol, attack: 0.4 * p.decay, hold: d * 0.3, detune: det }); // prettier-ignore
      return d;
    },
  },
  pad: {
    // A soft chord (notes: "C4+E4+G4") that swells in and out.
    f: 262,
    play: (c, o, t, p) => {
      const d = 2 * p.decay;
      for (const det of [-6, 6])
        tone(c, o, t, { wave: "triangle", f: p.f, to: p.f * (p.to || 1), dur: d, vol: 0.18 * p.vol, attack: 0.5 * p.decay, hold: 0.4 * d, detune: det }); // prettier-ignore
      return d;
    },
  },
  shimmer: {
    // A chord that twinkles: tones trembling quickly (opals, auroras,
    // magic). `to` glides the whole chord.
    f: 1047,
    rate: 9,
    play: (c, o, t, p) => {
      const d = 1.2 * p.decay;
      for (const r of [1, 1.25, 1.5, 2])
        tone(c, o, t + r * 0.05, { f: p.f * r, to: p.f * r * p.to, dur: d, vol: 0.1 * p.vol, attack: 0.08, vib: 0.01, vibRate: p.rate * r }); // prettier-ignore
      return d + 0.1;
    },
  },
  sonar: {
    f: 1180,
    play: (c, o, t, p) => {
      for (let i = 0; i < 4; i++)
        tone(c, o, t + i * 0.32 * p.decay, { f: p.f, to: p.f * 0.985, dur: 0.5 * p.decay, vol: 0.4 * p.vol * 0.45 ** i, attack: 0.004 }); // prettier-ignore
      return 1.5 * p.decay;
    },
  },
  horn: {
    // Car and bus horns (two tones); kind "ship" or "fog" for deep ones.
    f: 400,
    play: (c, o, t, p) => {
      const deep = p.kind === "ship" || p.kind === "fog";
      const d = (deep ? 1.6 : 0.35) * p.decay;
      const ratios = deep ? [1, 1.5, 2.01] : [1, 1.26];
      const bus = filter(c, t, { f: deep ? 600 : 2200, q: 0.8 });
      bus.connect(o);
      for (const r of ratios)
        tone(c, bus, t, { wave: "sawtooth", f: p.f * r, dur: d, vol: 0.22 * p.vol, attack: deep ? 0.12 : 0.01, hold: d * 0.7, vib: p.kind === "fog" ? 0.01 : 0, vibRate: 4 }); // prettier-ignore
      return d;
    },
  },
  brass: {
    // A trumpet-ish note: the filter opens with the attack.
    f: 523,
    play: (c, o, t, p) => {
      const d = 0.28 * p.decay;
      const bus = filter(c, t, { f: p.f * 1.5, to: p.f * 5, dur: 0.06, q: 1.5 });
      bus.connect(o);
      tone(c, bus, t, { wave: "sawtooth", f: p.f, dur: d, vol: 0.3 * p.vol, attack: 0.02, hold: d * 0.6, vib: 0.008, vibRate: 5 }); // prettier-ignore
      return d;
    },
  },
  engine: {
    // A piston engine: a low buzz that revs (to) and falls back.
    f: 45,
    to: 2.2,
    bright: 0.4,
    play: (c, o, t, p) => {
      const d = 1 * p.decay;
      const bus = filter(c, t, { f: 300 + 1500 * p.bright, q: 2 });
      bus.connect(o);
      const s = osc(c, t, { wave: "sawtooth", f: p.f, to: p.f * p.to, glide: d * 0.4, dur: d });
      s.frequency.exponentialRampToValueAtTime(p.f * 1.1, t + d);
      s.connect(envGain(c, t, { vol: 0.5 * p.vol, attack: 0.03, hold: d * 0.6, dur: d })).connect(bus); // prettier-ignore
      noise(c, bus, t, { type: "lowpass", f: 500, dur: d, vol: 0.25 * p.vol, am: p.f, amDepth: 0.9 }); // prettier-ignore
      return d;
    },
  },
  chirp: {
    // A bird's tweet: quick rising sweeps.
    f: 2600,
    n: 2,
    play: (c, o, t, p) => {
      for (let i = 0; i < p.n; i++)
        tone(c, o, t + i * 0.09, { f: p.f, to: p.f * 1.5, dur: 0.06 * p.decay, vol: 0.25 * p.vol });
      return p.n * 0.09 + 0.06;
    },
  },
  buzz: {
    // Insect wings: a buzzy tone with wing-beat wobble. f is the wing rate.
    f: 220,
    rate: 11,
    bright: 0.5,
    play: (c, o, t, p) => {
      const d = 0.8 * p.decay;
      const bus = filter(c, t, { type: "bandpass", f: p.f * (3 + 5 * p.bright), q: 1.2 });
      bus.connect(o);
      const s = osc(c, t, { wave: "sawtooth", f: p.f, to: p.f * 1.04, dur: d, vib: 0.04, vibRate: p.rate }); // prettier-ignore
      s.connect(swellGain(c, t, { vol: 0.9 * p.vol, attack: 0.08, dur: d })).connect(bus);
      return d;
    },
  },

  // Voices of creatures.
  quack: {
    f: 260,
    n: 1,
    play: (c, o, t, p) => {
      for (let i = 0; i < p.n; i++)
        formant(c, o, t + i * 0.22 * p.decay, {
          f: p.f,
          to: p.f * 0.72,
          dur: 0.17 * p.decay,
          vol: 0.55 * p.vol,
          formants: [[1000, 6, 1], [1650, 8, 0.8], [2600, 6, 0.4]], // prettier-ignore
          formantsTo: [[700], [1300], [2400]],
          breath: 0.3,
        });
      return p.n * 0.22 * p.decay;
    },
  },
  squawk: {
    f: 420,
    play: (c, o, t, p) =>
      formant(c, o, t, {
        f: p.f,
        to: p.f * 0.8,
        dur: 0.3 * p.decay,
        vol: 0.5 * p.vol,
        formants: [[900, 4, 1], [2000, 5, 0.7], [3200, 4, 0.4]], // prettier-ignore
        vib: 0.05,
        vibRate: 30,
        breath: 0.5,
      }),
  },
  mew: {
    f: 650,
    play: (c, o, t, p) =>
      formant(c, o, t, {
        f: p.f,
        to: p.f * 0.75,
        dur: 0.35 * p.decay,
        vol: 0.35 * p.vol,
        wave: "triangle",
        formants: [[900, 5, 1], [2400, 6, 0.6]], // prettier-ignore
        formantsTo: [[700], [1500]],
      }),
  },
  hoot: {
    f: 360,
    play: (c, o, t, p) => {
      tone(c, o, t, { f: p.f, to: p.f * 0.93, dur: 0.4 * p.decay, vol: 0.4 * p.vol, attack: 0.06, hold: 0.1 }); // prettier-ignore
      noise(c, o, t, { f: p.f * 2, q: 2, dur: 0.4 * p.decay, vol: 0.08 * p.vol, attack: 0.06 });
      return 0.4 * p.decay;
    },
  },
  ribbit: {
    f: 320,
    play: (c, o, t, p) => {
      for (const [at, len] of [[0, 0.1], [0.14, 0.14]]) // prettier-ignore
        formant(c, o, t + at * p.decay, {
          f: p.f * 0.4,
          to: p.f * 0.38,
          dur: len * p.decay,
          vol: 0.6 * p.vol,
          wave: "square",
          formants: [[p.f, 5, 1], [p.f * 3.2, 5, 0.4]], // prettier-ignore
        });
      return 0.3 * p.decay;
    },
  },
  whinny: {
    // A high wavering neigh, as a whistle.
    f: 1100,
    play: (c, o, t, p) =>
      formant(c, o, t, {
        f: p.f,
        to: p.f * 0.6,
        dur: 0.7 * p.decay,
        vol: 0.3 * p.vol,
        wave: "triangle",
        formants: [[p.f * 1.2, 3, 1], [p.f * 2.4, 4, 0.4]], // prettier-ignore
        vib: 0.06,
        vibRate: 13,
      }),
  },
  roarlet: {
    // A tiny creature's roar: a small growl that rises.
    f: 180,
    play: (c, o, t, p) =>
      formant(c, o, t, {
        f: p.f,
        to: p.f * 1.4,
        dur: 0.45 * p.decay,
        vol: 0.5 * p.vol,
        formants: [[700, 3, 1], [1200, 4, 0.6]], // prettier-ignore
        vib: 0.08,
        vibRate: 35,
        breath: 0.6,
      }),
  },
  murmur: {
    // A low voice-like hum with a vowel that changes.
    f: 120,
    play: (c, o, t, p) =>
      formant(c, o, t, {
        f: p.f,
        to: p.f * 0.9,
        dur: 0.6 * p.decay,
        vol: 0.4 * p.vol,
        attack: 0.08,
        formants: [[500, 5, 1], [900, 6, 0.5]], // prettier-ignore
        formantsTo: [[350], [1800]],
      }),
  },
  cheer: {
    // A crowd: many voices on an open vowel, rising, with claps.
    f: 200,
    n: 10,
    play: (c, o, t, p) => {
      const d = 1.6 * p.decay;
      for (let i = 0; i < p.n; i++) {
        const f = p.f * rnd(0.7, 1.8);
        formant(c, o, t + rnd(0, 0.25), {
          f,
          to: f * rnd(1.1, 1.4),
          dur: d * rnd(0.7, 1),
          vol: (0.5 * p.vol) / Math.sqrt(p.n),
          attack: 0.2,
          formants: [[rnd(700, 850), 4, 1], [rnd(1100, 1300), 5, 0.6], [2600, 4, 0.2]], // prettier-ignore
          vib: 0.02,
          vibRate: rnd(4, 7),
          breath: 0.3,
        });
      }
      noise(c, o, t, { f: 1500, q: 0.5, dur: d, vol: 0.2 * p.vol, attack: 0.25, swell: true });
      VOICES.patter.play(c, o, t + 0.3, { ...p, f: 1200, n: 16, decay: 1.8 * p.decay, vol: 0.9 * p.vol }); // prettier-ignore
      return d;
    },
  },
  chuckle: {
    // A tiny giggle: a quick run of falling vowel blips.
    f: 520,
    n: 4,
    play: (c, o, t, p) => {
      for (let i = 0; i < p.n; i++)
        formant(c, o, t + i * 0.085, {
          f: p.f * (1 - i * 0.04),
          to: p.f * (0.9 - i * 0.04),
          dur: 0.06 * p.decay,
          vol: 0.35 * p.vol,
          wave: "triangle",
          formants: [[900, 4, 1], [1700, 5, 0.5]], // prettier-ignore
        });
      return p.n * 0.085 + 0.06;
    },
  },

  // Special: heartbeat and the old shared sounds (kept so old names work).
  heartbeat: {
    f: 70,
    n: 1,
    rate: 1.2,
    play: (c, o, t, p) => {
      let at = 0;
      for (let i = 0; i < p.n; i++) {
        tone(c, o, t + at, { wave: "triangle", f: p.f, to: p.f * 0.7, dur: 0.14, vol: 0.7 * p.vol }); // prettier-ignore
        tone(c, o, t + at + 0.2, { wave: "triangle", f: p.f * 0.93, to: p.f * 0.65, dur: 0.12, vol: 0.5 * p.vol }); // prettier-ignore
        // `to` above 1 speeds the beats up.
        at += 1 / (p.rate * (p.to || 1) ** (i / Math.max(1, p.n - 1)));
      }
      return at + 0.2;
    },
  },
};

// ---- Recorded samples (lane Sound A) -----------------------------------------------
// The `sample` voice plays a short recorded file from assets/sounds/ (CC0 or
// public domain, credited in tools/assets.json). Nothing is fetched until a
// sound that names the file first plays; each file is then decoded once and
// kept for the session. If a file can't load, the layer's `fallback` (a synth
// spec) plays instead, or nothing. src/sound.js waits (briefly) for a spec's
// files before playing it, so a sample stays in time with its other layers;
// offline tools call loadSamples() before rendering.
//
//   { voice: "sample", file: "cat-statue-meow.mp3" }
//   { voice: "sample", file: ["a.mp3", "b.mp3"], pitch: 0.9, from: 0.1, len: 1.2,
//     vol: 0.8, at: 0.3, fallback: { voice: "mew" } }
//
// file: one file name, or a list to pick one from at random on each play;
// pitch: playback rate (also the pitch); from: start this far into the file;
// len: play at most this long (with a short fade); decay multiplies the length.

// Where the files are: `base` (src/sound.js sets it beside the module) and
// `data`, file name -> data: URL, for pages that carry their own files (the
// Sound Board).
export const SAMPLES = { base: "assets/sounds/", data: {} };
const sampleCache = new Map(); // file -> { buf, failed, promise }

// `ctx` may be null (lane Sound C): a toy's samples load when it opens, before
// the site's AudioContext may start, so they decode in a small offline context
// (a decoded AudioBuffer plays in any context).
let decoder = null;
function offlineDecoder() {
  const OAC = globalThis.OfflineAudioContext || globalThis.webkitOfflineAudioContext;
  if (!decoder && OAC) decoder = new OAC(1, 1, 48000);
  return decoder;
}

export function loadSample(ctx, file) {
  let e = sampleCache.get(file);
  if (!e) {
    ctx = ctx || offlineDecoder();
    if (!ctx) return Promise.resolve(null);
    e = { buf: null, failed: false, promise: null };
    const entry = e;
    e.promise = fetch(SAMPLES.data[file] || SAMPLES.base + file)
      .then((r) => {
        if (!r.ok) throw new Error(`${file}: ${r.status}`);
        return r.arrayBuffer();
      })
      // The callback form, for older Safari.
      .then((bytes) => new Promise((ok, fail) => ctx.decodeAudioData(bytes, ok, fail)))
      .then((buf) => (entry.buf = buf))
      .catch(() => {
        entry.failed = true;
        return null;
      });
    sampleCache.set(file, e);
  }
  return e.promise;
}

// Every sample file a spec names (both halves of a toggle, and fallbacks).
// With `voices`, also the files a sampled instrument voice (the concert
// grand) may play: the Sound Board carries them and the About tab credits
// them, but a tap doesn't wait for them (the voice loads its own).
export function samplesIn(spec, out = [], voices = false) {
  if (!spec || typeof spec !== "object") return out;
  if (Array.isArray(spec)) spec.forEach((s) => samplesIn(s, out, voices));
  else if ("on" in spec || "off" in spec)
    [spec.on, spec.off].forEach((s) => samplesIn(s, out, voices));
  else {
    if (spec.voice === "sample") for (const f of [].concat(spec.file || [])) out.push(f);
    if (voices && VOICES[spec.voice]?.samples) out.push(...VOICES[spec.voice].samples);
    if (spec.fallback) samplesIn(spec.fallback, out, voices);
  }
  return [...new Set(out)];
}

// True when every file a spec names is decoded (or has failed for good).
export function samplesReady(spec) {
  return samplesIn(spec).every((f) => {
    const e = sampleCache.get(f);
    return e && (e.buf || e.failed);
  });
}

// Loads a spec's files, and a sampled voice's too (offline tools hear them).
export function loadSamples(ctx, spec) {
  return Promise.all(samplesIn(spec, [], true).map((f) => loadSample(ctx, f)));
}

function playSample(c, o, t, p) {
  const files = [].concat(p.file || []);
  const file = files[Math.floor(Math.random() * files.length)];
  const e = file && sampleCache.get(file);
  const fallback = () => (p.fallback ? playSpec(c, o, t, p.fallback, { pitch: p.f }) : 0);
  if (!e || !e.buf) {
    if (!file || e?.failed) return fallback();
    // An offline render that didn't load its samples first (loadSamples)
    // hears the fallback.
    if (typeof OfflineAudioContext !== "undefined" && c instanceof OfflineAudioContext)
      return fallback();
    // Not loaded yet (a page that plays specs directly): load it, then play
    // it late if it arrives within a second.
    loadSample(c, file).then((buf) => {
      const late = c.currentTime - t;
      if (late < 1) (buf ? playSample : fallback)(c, o, Math.max(t, c.currentTime + 0.01), p);
    });
    return 0.5;
  }
  const rate = Math.max(0.25, Math.min(4, p.f || 1));
  const from = Math.max(0, Math.min(e.buf.duration - 0.01, p.from || 0));
  const len = Math.min(e.buf.duration - from, p.len ?? Infinity) * (p.decay || 1);
  const dur = len / rate;
  const src = c.createBufferSource();
  src.buffer = e.buf;
  src.playbackRate.value = rate;
  const g = c.createGain();
  const vol = Math.max(TAIL * 2, p.vol);
  // A short fade in when starting mid-file, and out when cut short, so the
  // edges never click.
  g.gain.setValueAtTime(from > 0 ? 0 : vol, t);
  if (from > 0) g.gain.linearRampToValueAtTime(vol, t + 0.006);
  if (len < e.buf.duration - from - 0.01) {
    g.gain.setValueAtTime(vol, t + Math.max(0.007, dur - 0.05));
    g.gain.linearRampToValueAtTime(0, t + dur);
  }
  src.connect(g).connect(o);
  src.start(t, from, len);
  return dur;
}

VOICES.sample = { f: 1, play: playSample };

// The concert grand (the owner's mark of September 30, 2026: the synth
// "grand" sounded like an electronic keyboard): recorded notes of a real
// acoustic piano (CC0, TEDAgame on Freesound), one every four semitones, each
// note played from the nearest one at its pitch. The key's `hold` lets the
// damper fall. Until its files arrive (fetched on its first note), a note
// plays the synth grand; a song note scheduled far enough ahead waits for its
// file and plays on time. The electronic keyboard's PIANO keeps the synth.
const GRAND_NOTES = "A0 C#1 F1 A1 C#2 F2 A2 C#3 F3 A3 C#4 F4 A4 C#5 F5 A5 C#6 F6 A6 C#7 F7 A7 C8".split(" "); // prettier-ignore
const grandFile = (n) => `grand-piano-${n.toLowerCase().replace("#", "s")}.mp3`;

function playConcert(c, o, t, p) {
  const f = p.f || 262;
  let note = GRAND_NOTES[0];
  for (const n of GRAND_NOTES)
    if (Math.abs(Math.log2(f / noteFreq(n))) < Math.abs(Math.log2(f / noteFreq(note)))) note = n;
  const file = grandFile(note);
  const synth = (at) =>
    VOICES.grand.play(c, o, at, { ...p, bright: VOICES.grand.bright, vol: (p.vol * LEVEL.grand) / LEVEL.concert }); // prettier-ignore
  const e = sampleCache.get(file);
  if (!e?.buf) {
    const live = typeof OfflineAudioContext === "undefined" || !(c instanceof OfflineAudioContext);
    VOICES.concert.samples.forEach((s) => loadSample(c, s));
    if (!live || e?.failed || t - c.currentTime < 0.15) return synth(t);
    loadSample(c, file).then((buf) => {
      if (buf && c.currentTime < t - 0.005) playConcert(c, o, t, p);
      else synth(Math.max(t, c.currentTime + 0.005));
    });
    return 2;
  }
  const rate = f / noteFreq(note);
  // Low notes ring longer; the recording's own decay does the rest.
  const ring = Math.min(e.buf.duration / rate, 3.2 * (262 / f) ** 0.5 * (p.decay ?? 1));
  const stop = p.hold !== undefined ? Math.min(ring, Math.max(0.06, p.hold)) : ring;
  const release = 0.16;
  const src = c.createBufferSource();
  src.buffer = e.buf;
  src.playbackRate.value = rate;
  const g = c.createGain();
  const vol = Math.max(TAIL * 2, p.vol);
  g.gain.setValueAtTime(vol, t);
  g.gain.setTargetAtTime(0, t + stop, release / 3);
  // A little darker when played softly, as a real hammer is.
  const lp = c.createBiquadFilter();
  lp.type = "lowpass";
  lp.frequency.value = Math.min(
    c.sampleRate * 0.45,
    2500 + 9000 * Math.min(1, p.vol / LEVEL.concert),
  );
  src.connect(lp).connect(g).connect(o);
  src.start(t);
  src.stop(t + stop + release * 2);
  return stop + release;
}

VOICES.concert = { f: 262, samples: GRAND_NOTES.map(grandFile), play: playConcert };

// The twelve original shared sounds (and "click" and "heartbeat"), exactly as
// they were: recipes and the effect switches still name them.
const LEGACY = {
  poke: (c, o, t, p) => tone(c, o, t, { f: 420 * p, to: 180 * p, dur: 0.28, vol: 0.4 }),
  hop: (c, o, t, p) =>
    tone(c, o, t, { f: 180 * p, to: 520 * p, dur: 0.22, vol: 0.35, wave: "triangle" }),
  bounce: (c, o, t, p) => tone(c, o, t, { f: 140 * p, to: 70 * p, dur: 0.12, vol: 0.3 }),
  paint: (c, o, t) => noise(c, o, t, { dur: 0.22, vol: 0.5, f: 900, to: 300, q: 1.2 }),
  clay: (c, o, t) => noise(c, o, t, { dur: 0.16, vol: 0.35, f: 400, q: 2, type: "lowpass" }),
  drop: (c, o, t) => {
    tone(c, o, t, { f: 90, to: 45, dur: 0.35, vol: 0.5 });
    return noise(c, o, t, { dur: 0.3, vol: 0.25, f: 300, type: "lowpass" });
  },
  whoosh: (c, o, t) => noise(c, o, t, { dur: 0.6, vol: 0.3, f: 300, to: 2400, q: 0.7 }),
  chime: (c, o, t) => {
    [880, 1320, 1760].forEach((f, i) =>
      tone(c, o, t + i * 0.07, { f, dur: 0.5, vol: 0.18, wave: "triangle" }),
    );
    return 0.64;
  },
  open: (c, o, t) => {
    tone(c, o, t, { f: 160, to: 260, dur: 0.5, vol: 0.2, wave: "sawtooth" });
    [1047, 1319, 1568].forEach((f, i) =>
      tone(c, o, t + 0.25 + i * 0.08, { f, dur: 0.6, vol: 0.12 }),
    );
    return 1.01;
  },
  close: (c, o, t) => {
    tone(c, o, t, { f: 240, to: 150, dur: 0.35, vol: 0.2, wave: "sawtooth" });
    return 0.32 + tone(c, o, t + 0.32, { f: 110, to: 60, dur: 0.18, vol: 0.45 });
  },
  fire: (c, o, t) => {
    noise(c, o, t, { dur: 0.9, vol: 0.35, f: 500, to: 1800, q: 0.6 });
    for (let i = 0; i < 5; i++)
      noise(c, o, t + 0.1 + Math.random() * 0.6, { dur: 0.04, vol: 0.4, f: 3000, q: 3 });
    return 0.9;
  },
  pop: (c, o, t, p) => tone(c, o, t, { f: 700 * p, to: 1400 * p, dur: 0.08, vol: 0.4 }),
  heartbeat: (c, o, t) => {
    tone(c, o, t, { f: 70, to: 50, dur: 0.14, vol: 0.6 });
    return 0.2 + tone(c, o, t + 0.2, { f: 65, to: 45, dur: 0.12, vol: 0.45 });
  },
  click: (c, o, t) => tone(c, o, t, { f: 1500, to: 900, dur: 0.03, vol: 0.15, wave: "square" }),
};

export const LEGACY_NAMES = Object.keys(LEGACY);

// Each voice's level, so that one voice at its defaults is about as loud as
// another: measured by `node tools/sound-check.mjs --voices` (a mix of its
// loudest 50 ms and its peak). Re-measure after changing a voice.
const LEVEL = {
  grand: 0.43,
  upright: 0.47,
  harpsichord: 0.61,
  organ: 0.44,
  synth: 0.59,
  vibes: 0.52,
  pluck: 0.78,
  nylon: 0.76,
  harp: 0.85,
  sitar: 0.88,
  twang: 1.02,
  bell: 0.98,
  chimes: 0.87,
  bar: 0.92,
  marimba: 0.97,
  glass: 0.85,
  tine: 0.94,
  metal: 0.94,
  wood: 1.3,
  hollow: 1.11,
  stone: 1.78,
  clack: 1.66,
  ding: 0.97,
  sparkle: 3.85,
  kick: 0.91,
  snare: 1.47,
  tom: 1.08,
  hat: 12,
  clap: 4.45,
  thud: 1.06,
  boing: 1.55,
  pock: 1.66,
  crack: 1.6,
  slap: 2.11,
  click: 7.72,
  switch: 8.51,
  rattle: 11.29,
  clatter: 2.8,
  crunch: 4.03,
  patter: 11.55,
  crackle: 3.18,
  ratchet: 10.74,
  drip: 2.17,
  bubbles: 2.99,
  pop: 2.25,
  squish: 2.11,
  gloop: 1.41,
  tear: 7.23,
  whoosh: 4.32,
  wind: 5.09,
  roar: 2.81,
  rumble: 2.72,
  hiss: 3.64,
  sizzle: 5.47,
  breath: 3.73,
  splash: 2.66,
  wave: 1.54,
  scrape: 12,
  flutter: 5.99,
  chop: 3.52,
  tone: 1.75,
  blip: 7.84,
  zap: 4.21,
  squeak: 2.15,
  whistle: 1.96,
  theremin: 1.86,
  hum: 2.3,
  drone: 1.04,
  pad: 1.73,
  shimmer: 2.64,
  sonar: 1.67,
  horn: 1.74,
  brass: 2.08,
  engine: 1.14,
  chirp: 4.25,
  buzz: 1.38,
  quack: 3.68,
  squawk: 2.47,
  mew: 6.41,
  hoot: 1.36,
  ribbit: 3.48,
  whinny: 3.13,
  roarlet: 2.47,
  murmur: 5.55,
  cheer: 2.24,
  chuckle: 10.14,
  heartbeat: 1.7,
  sample: 1,
  concert: 0.75,
};
export const VOICE_NAMES = Object.keys(VOICES);

// ---- Specs ------------------------------------------------------------------------

const PARAMS = new Set(
  "voice pitch f decay vol bright at pickAt notes step strum n rate to kind hold file from len fallback".split(
    " ",
  ),
);

// Checks a spec and returns a list of problems (empty when it is fine).
export function specProblems(spec, where = "sound") {
  const out = [];
  if (typeof spec === "string") {
    if (!LEGACY[spec]) out.push(`${where}: unknown sound "${spec}"`);
    return out;
  }
  if (Array.isArray(spec)) {
    if (!spec.length) out.push(`${where}: empty layer list`);
    spec.forEach((s, i) => {
      if (Array.isArray(s) || typeof s !== "object" || s?.on)
        out.push(`${where}[${i}]: a layer must be one voice`);
      else out.push(...specProblems(s, `${where}[${i}]`));
    });
    return out;
  }
  if (!spec || typeof spec !== "object") return [`${where}: not a sound spec`];
  if ("on" in spec || "off" in spec) {
    for (const k of Object.keys(spec))
      if (k !== "on" && k !== "off") out.push(`${where}: unexpected key "${k}" in on/off`);
    if (!spec.on || !spec.off) out.push(`${where}: a toggle needs both on and off`);
    for (const k of ["on", "off"])
      if (spec[k]) {
        if (spec[k].on) out.push(`${where}.${k}: nested on/off`);
        else out.push(...specProblems(spec[k], `${where}.${k}`));
      }
    return out;
  }
  if (!VOICES[spec.voice]) out.push(`${where}: unknown voice "${spec.voice}"`);
  for (const k of Object.keys(spec)) if (!PARAMS.has(k)) out.push(`${where}: unknown key "${k}"`);
  for (const k of [
    "pitch",
    "decay",
    "vol",
    "bright",
    "at",
    "pickAt",
    "step",
    "strum",
    "n",
    "rate",
    "to",
    "hold",
    "from",
    "len",
  ])
    if (k in spec && !(typeof spec[k] === "number" && Number.isFinite(spec[k])))
      out.push(`${where}: ${k} must be a number`);
  if ("f" in spec) {
    try {
      noteFreq(spec.f);
    } catch (e) {
      out.push(`${where}: ${e.message}`);
    }
  }
  if (spec.voice === "sample") {
    const files = [].concat(spec.file ?? []);
    if (!files.length) out.push(`${where}: a sample needs a file`);
    for (const f of files)
      if (typeof f !== "string" || !/^[a-z0-9][a-z0-9-]*\.(mp3|m4a)$/.test(f))
        out.push(`${where}: bad sample file "${f}" (a name like toy-what.mp3 in assets/sounds/)`);
    if ("f" in spec) out.push(`${where}: a sample takes pitch, not f`);
  } else
    for (const k of ["file", "from", "len", "fallback"])
      if (k in spec) out.push(`${where}: "${k}" is only for the sample voice`);
  if (spec.fallback) {
    if (samplesIn(spec.fallback).length) out.push(`${where}: a fallback must be synth voices`);
    out.push(...specProblems(spec.fallback, `${where}.fallback`));
  }
  if ("notes" in spec) {
    try {
      parseNotes(spec.notes).flat().forEach(noteFreq);
    } catch (e) {
      out.push(`${where}: ${e.message}`);
    }
  }
  return out;
}

// Picks the half of a toggle spec for a tap that switched it on (or off).
export function specFor(spec, on = true) {
  if (spec && typeof spec === "object" && !Array.isArray(spec) && ("on" in spec || "off" in spec))
    return on ? spec.on : spec.off;
  return spec;
}

// Plays a spec at time t into `out`. Returns the seconds it lasts.
// `raw` skips the voice's level (tools/sound-check.mjs --voices measures it).
// `pick` plays only that note (or chord) of a tune, at the tune's start (or
// at the spec's `pickAt`): a tap on one xylophone bar plays that bar.
export function playSpec(ctx, out, t, spec, { pitch = 1, raw = false, pick = null } = {}) {
  if (!spec) return 0;
  if (typeof spec === "string") {
    const fn = LEGACY[spec];
    return fn ? fn(ctx, out, t, pitch) || 0.3 : 0;
  }
  if (Array.isArray(spec)) {
    let end = 0;
    for (const s of spec) end = Math.max(end, playSpec(ctx, out, t, s, { pitch, raw, pick }));
    return end;
  }
  if ("on" in spec) return playSpec(ctx, out, t, spec.on, { pitch, raw, pick });
  const v = VOICES[spec.voice];
  if (!v) return 0;
  const start = t + (pick !== null && spec.pickAt !== undefined ? spec.pickAt : spec.at || 0);
  const base = {
    pitch: 1,
    decay: 1,
    bright: v.bright ?? 0.5,
    n: v.n ?? 1,
    rate: v.rate ?? 1,
    to: v.to ?? 1,
    kind: v.kind,
    ...spec,
    vol: (spec.vol ?? 1) * (raw ? 1 : (LEVEL[spec.voice] ?? 1)),
  };
  const at = (fr) => ({ ...base, f: fr * base.pitch * pitch });
  if (spec.notes) {
    const step = spec.step ?? 0.2;
    const strum = spec.strum ?? 0;
    let end = 0;
    let chords = parseNotes(spec.notes);
    if (pick !== null) chords = [chords[Math.abs(Math.round(pick)) % chords.length]];
    chords.forEach((chord, i) => {
      chord.forEach((note, j) => {
        const s = start + i * step + j * strum;
        end = Math.max(end, s - t + v.play(ctx, out, s, at(noteFreq(note))));
      });
    });
    return end;
  }
  const f = spec.f !== undefined ? noteFreq(spec.f) : v.f;
  return (spec.at || 0) + v.play(ctx, out, start, at(f));
}

// ---- Sound B (lane Sound B, September 30, 2026) -----------------------------------
// Real-world sound effects, synthesised, for the owner's sound review of
// September 28 (docs/PACKS.md 7e): fire like the volcano's, leaves, pages,
// bites, dice, engines, rotors, creaking wood, scissors, fireworks, hooves, a
// crowd, water in a bottle, a fly, a frog, an owl, keys and more. Each aims at
// the sound the real thing makes: no clicks, whistles or rising "vroom"
// unless the real thing makes them. Soft attacks (a few ms) keep grains from
// reading as clicks.

// A slow random wobble added to an AudioParam: noise low-passed to `rate` Hz,
// scaled so it swings by about `depth` either way.
function wander(ctx, param, t, dur, { rate = 3, depth = 1 }) {
  const src = ctx.createBufferSource();
  src.buffer = noiseBuffer(ctx);
  src.loop = true;
  const lp = ctx.createBiquadFilter();
  lp.type = "lowpass";
  lp.frequency.value = rate;
  lp.Q.value = 0.5;
  const g = ctx.createGain();
  g.gain.value = depth / (0.577 * Math.sqrt((2 * rate) / ctx.sampleRate)) / 2;
  src.connect(lp).connect(g).connect(param);
  src.start(t, Math.random() * 1.5);
  src.stop(t + dur + 0.1);
}

// A rich pulse wave (harmonics falling as 1/n^0.8): engines and brass.
const pulseCache = new WeakMap();
function pulseWave(ctx) {
  let w = pulseCache.get(ctx);
  if (!w) {
    const n = 48;
    const re = new Float32Array(n);
    const im = new Float32Array(n);
    for (let k = 1; k < n; k++) im[k] = 1 / k ** 0.8;
    w = ctx.createPeriodicWave(re, im);
    pulseCache.set(ctx, w);
  }
  return w;
}

// A bank of resonances (Hz, q, gain) that impulses excite: wood, dough, a
// bow's limbs. Returns the node to feed.
function body(ctx, out, t, dur, modes) {
  const input = ctx.createGain();
  for (const [f, q, a] of modes) {
    const b = filter(ctx, t, { type: "bandpass", f, q });
    const g = ctx.createGain();
    g.gain.value = a;
    input.connect(b).connect(g).connect(out);
  }
  return input;
}

// Stick-slip: irregular tiny impulses, `rate` a second rising by `to`, into
// a resonant body. Creaking wood, stretching dough and cheese, a crawl.
function stickSlip(ctx, into, t, dur, { rate, to = 1, vol, jitter = 0.35 }) {
  let at = 0;
  let i = 0;
  while (at < dur && i < 400) {
    const u = at / dur;
    const env = Math.sin(Math.PI * Math.min(1, u * 1.1)) ** 0.6;
    noise(ctx, into, t + at, { type: "highpass", f: 300, dur: 0.003, vol: vol * (0.4 + 0.6 * env) * rnd(0.5, 1), attack: 0.0005 }); // prettier-ignore
    at += rnd(1 - jitter, 1 + jitter) / (rate * (1 + (to - 1) * u));
    i++;
  }
  return dur;
}

const SOUND_B = {
  flame: {
    // Fire, from the volcano's flame: a low rush that flickers unevenly, and
    // a few soft pops of wood (n). bright adds the flames' hiss.
    f: 80,
    rate: 5,
    n: 3,
    bright: 0.4,
    play: (c, o, t, p) => {
      const d = 1.6 * p.decay;
      const flick = c.createGain();
      flick.gain.value = 0.75;
      wander(c, flick.gain, t, d, { rate: p.rate, depth: 0.3 });
      flick.connect(o);
      noise(c, flick, t, { type: "lowpass", f: p.f * 6, q: 0.5, dur: d, vol: 0.6 * p.vol, attack: 0.18, swell: true }); // prettier-ignore
      noise(c, flick, t, { f: p.f * 22, q: 0.6, dur: d, vol: 0.14 * p.vol * p.bright, attack: 0.25, swell: true }); // prettier-ignore
      for (let i = 0; i < p.n; i++) {
        const at = t + rnd(0.15, 0.9) * d;
        noise(c, o, at, { f: rnd(600, 1400), q: 1.4, dur: rnd(0.03, 0.06), vol: 0.22 * p.vol, attack: 0.003 }); // prettier-ignore
        tone(c, o, at, { f: rnd(130, 170), to: 90, dur: 0.05, vol: 0.08 * p.vol, attack: 0.003 });
      }
      return d;
    },
  },
  rustle: {
    // Leaves, dry grass or paper: many soft brushes (n) over a faint bed.
    f: 3000,
    n: 30,
    bright: 0.5,
    play: (c, o, t, p) => {
      const d = 1.2 * p.decay;
      grains(c, o, t, {
        n: p.n,
        dur: d,
        grain: (at, i, r) =>
          noise(c, o, at, { f: p.f * (0.5 + r * (0.5 + p.bright)), q: 0.9, dur: 0.025 + 0.05 * r, vol: 0.13 * p.vol * (0.4 + r), attack: 0.008 }), // prettier-ignore
      });
      noise(c, o, t, { f: p.f * 0.7, q: 0.5, dur: d, vol: 0.05 * p.vol, attack: d * 0.4, swell: true }); // prettier-ignore
      return d;
    },
  },
  pageflip: {
    // A book's page turning: a papery swish that lifts and settles, and the
    // soft slap as it lands.
    f: 1800,
    play: (c, o, t, p) => {
      const d = 0.45 * p.decay;
      noise(c, o, t, { f: p.f, to: p.f * 2, q: 0.7, dur: d, vol: 0.3 * p.vol, attack: d * 0.6, swell: true, am: 17, amDepth: 0.35 }); // prettier-ignore
      noise(c, o, t + d * 0.2, { type: "highpass", f: 3500, q: 0.5, dur: d * 0.7, vol: 0.06 * p.vol, attack: d * 0.3, swell: true }); // prettier-ignore
      noise(c, o, t + d * 0.92, { type: "lowpass", f: 1400, q: 0.6, dur: 0.06, vol: 0.22 * p.vol, attack: 0.004 }); // prettier-ignore
      return d + 0.06;
    },
  },
  bite: {
    // A bite of something crisp (an apple): a crunch of tiny fractures, the
    // juicy snap as the piece comes away, then a few chews of the break.
    f: 3000,
    play: (c, o, t, p) => {
      const k = p.f / 3000;
      grains(c, o, t, {
        n: 26,
        dur: 0.14 * p.decay,
        accel: 1,
        grain: (at, i, r) =>
          noise(c, o, at, { f: rnd(2000, 6500) * k, q: 1.2, dur: 0.004 + 0.01 * r, vol: 0.34 * p.vol * (1 - i / 30), attack: 0.0015 }), // prettier-ignore
      });
      noise(c, o, t, { type: "lowpass", f: 1600 * k, q: 0.6, dur: 0.12, vol: 0.3 * p.vol, attack: 0.002 }); // prettier-ignore
      noise(c, o, t + 0.05, { f: 900 * k, to: 500 * k, q: 2, dur: 0.18, vol: 0.12 * p.vol, attack: 0.01 }); // prettier-ignore
      grains(c, o, t + 0.2 * p.decay, {
        n: 10,
        dur: 0.12 * p.decay,
        grain: (at, i, r) =>
          noise(c, o, at, { f: rnd(1500, 4500) * k, q: 1.2, dur: 0.006 + 0.01 * r, vol: 0.18 * p.vol, attack: 0.002 }), // prettier-ignore
      });
      return 0.35 * p.decay;
    },
  },
  shellcrack: {
    // Something brittle breaking: the snap and its fragments (n). kind "ice"
    // adds the deep groan and glassy tinkle of cracking ice.
    f: 2500,
    n: 5,
    play: (c, o, t, p) => {
      noise(c, o, t, { type: "highpass", f: p.f * 0.4, q: 0.5, dur: 0.03, vol: 0.55 * p.vol, attack: 0.001 }); // prettier-ignore
      noise(c, o, t, { f: p.f, q: 2, dur: 0.08 * p.decay, vol: 0.28 * p.vol, attack: 0.001 });
      noise(c, o, t, { type: "lowpass", f: 700, q: 0.7, dur: 0.06, vol: 0.25 * p.vol, attack: 0.002 }); // prettier-ignore
      grains(c, o, t + 0.04, {
        n: p.n,
        dur: 0.35 * p.decay,
        accel: 0.6,
        grain: (at, i, r) =>
          noise(c, o, at, { f: p.f * rnd(0.6, 1.6), q: 2.5, dur: 0.01 + 0.02 * r, vol: 0.28 * p.vol * (1 - i / (p.n + 1)), attack: 0.001 }), // prettier-ignore
      });
      if (p.kind === "ice") {
        tone(c, o, t, { f: 95, to: 55, dur: 0.6 * p.decay, vol: 0.16 * p.vol, attack: 0.02, vib: 0.05, vibRate: 23 }); // prettier-ignore
        for (let i = 0; i < 3; i++)
          modal(c, o, t + 0.12 + i * rnd(0.07, 0.14), { f: rnd(2500, 4200), kind: "glass", decay: 0.25, vol: 0.06 * p.vol, bright: 0.4 }); // prettier-ignore
      }
      return 0.45 * p.decay;
    },
  },
  kernel: {
    // Dry popping corn: each pop a short papery bang with a little thump,
    // spread over the time like a pan of kernels (n pops, faster in the middle).
    f: 1400,
    n: 1,
    play: (c, o, t, p) => {
      const d = p.n > 1 ? 1.4 * p.decay : 0.05;
      for (let i = 0; i < p.n; i++) {
        const u = p.n > 1 ? (i + Math.random() * 0.8) / p.n : 0;
        const at = t + d * (0.5 - 0.5 * Math.cos(Math.PI * u));
        noise(c, o, at, { f: p.f * rnd(0.7, 1.4), q: 0.9, dur: 0.018, vol: 0.42 * p.vol * rnd(0.6, 1), attack: 0.001 }); // prettier-ignore
        noise(c, o, at, { type: "lowpass", f: 500, q: 0.7, dur: 0.03, vol: 0.22 * p.vol, attack: 0.001 }); // prettier-ignore
        tone(c, o, at, { f: rnd(190, 260), to: 150, dur: 0.025, vol: 0.1 * p.vol, attack: 0.001 });
      }
      return d + 0.05;
    },
  },
  dice: {
    // Dice thrown on a wooden table: each die (n) bounces with quicker and
    // quieter knocks, tumbles and settles.
    f: 2300,
    n: 2,
    play: (c, o, t, p) => {
      let end = 0;
      for (let k = 0; k < p.n; k++) {
        let at = rnd(0, 0.05);
        let gap = rnd(0.1, 0.13);
        for (let i = 0; i < 6; i++) {
          const v = p.vol * 0.75 ** i;
          modal(c, o, t + at, { f: p.f * rnd(0.85, 1.2), kind: "clack", decay: 0.7, vol: 0.32 * v, bright: 0.5 }); // prettier-ignore
          noise(c, o, t + at, { type: "lowpass", f: 450, q: 0.8, dur: 0.035, vol: 0.28 * v, attack: 0.001 }); // prettier-ignore
          at += gap;
          gap *= rnd(0.55, 0.7);
        }
        for (let i = 0; i < 5; i++) {
          noise(c, o, t + at, { f: p.f * rnd(0.8, 1.3), q: 3, dur: 0.01, vol: 0.08 * p.vol * (1 - i / 6), attack: 0.001 }); // prettier-ignore
          at += rnd(0.025, 0.04);
        }
        end = Math.max(end, at);
      }
      return end + 0.1;
    },
  },
  chug: {
    // A steam engine: the chuffs of exhaust (n), two strong and two soft, over
    // the rumble of the wheels. rate is chuffs a second.
    f: 600,
    n: 8,
    rate: 4,
    play: (c, o, t, p) => {
      const d = p.n / p.rate;
      for (let i = 0; i < p.n; i++) {
        const acc = i % 2 ? 0.6 : 1;
        const at = t + i / p.rate + rnd(-0.01, 0.01);
        noise(c, o, at, { f: p.f, q: 0.8, dur: 0.2, vol: 0.45 * p.vol * acc, attack: 0.01 });
        noise(c, o, at, { type: "lowpass", f: 260, q: 0.7, dur: 0.15, vol: 0.4 * p.vol * acc, attack: 0.008 }); // prettier-ignore
        noise(c, o, at + 0.02, { type: "highpass", f: 2500, q: 0.5, dur: 0.12, vol: 0.05 * p.vol * acc, attack: 0.02 }); // prettier-ignore
      }
      noise(c, o, t, { type: "lowpass", f: 140, q: 0.7, dur: d + 0.3, vol: 0.25 * p.vol, attack: 0.2, am: p.rate / 2, amDepth: 0.4 }); // prettier-ignore
      return d + 0.3;
    },
  },
  motor: {
    // A real piston engine: f is the firing rate (Hz); `to` revs it (a blip
    // of the throttle: up and back, not a rising sweep). kind "car" (a sports
    // car's growl), "tractor" (a slow diesel), "prop" (a plane's engine and
    // propeller) or "idle".
    f: 30,
    to: 1,
    bright: 0.5,
    play: (c, o, t, p) => {
      const d = 1.6 * p.decay;
      const kind = p.kind || "idle";
      const s = c.createOscillator();
      s.setPeriodicWave(pulseWave(c));
      s.frequency.setValueAtTime(p.f, t);
      if (p.to !== 1) {
        s.frequency.setTargetAtTime(p.f * p.to, t + 0.05, d * 0.12);
        s.frequency.setTargetAtTime(p.f * 1.05, t + d * 0.45, d * 0.15);
      }
      wander(c, s.frequency, t, d, { rate: 9, depth: p.f * 0.025 });
      const lp = filter(c, t, { f: (kind === "tractor" ? 500 : 900) + 2200 * p.bright, q: 0.7 });
      const res = filter(c, t, { type: "peaking", f: kind === "car" ? 180 : 110, q: 1.2 });
      res.gain.value = 6;
      const g = envGain(c, t, { vol: 0.42 * p.vol, attack: 0.06, hold: d * 0.75, dur: d });
      s.connect(res).connect(lp).connect(g).connect(o);
      s.start(t);
      s.stop(t + d + 0.05);
      noise(c, o, t, { type: "lowpass", f: kind === "tractor" ? 700 : 1400, q: 0.6, dur: d, vol: 0.16 * p.vol, attack: 0.06, hold: d * 0.75, am: p.f * (p.to > 1 ? 1.3 : 1), amDepth: 0.8 }); // prettier-ignore
      if (kind === "tractor")
        for (let at = 0.05; at < d; at += 2 / p.f)
          noise(c, o, t + at, { f: 1800, q: 2, dur: 0.012, vol: 0.05 * p.vol, attack: 0.002 });
      if (kind === "prop")
        noise(c, o, t, { type: "lowpass", f: 500, q: 0.8, dur: d, vol: 0.3 * p.vol, attack: 0.3, hold: d * 0.6, am: p.f * 0.75, amDepth: 0.7 }); // prettier-ignore
      return d;
    },
  },
  rotor: {
    // Helicopter blades: the heavy whump of each blade (rate a second) over
    // the turbine's hush.
    f: 320,
    rate: 9,
    play: (c, o, t, p) => {
      const d = 1.6 * p.decay;
      for (let at = 0; at < d; at += 1 / p.rate) {
        const u = at / d;
        const env = Math.min(1, u * 5, (1 - u) * 5);
        noise(c, o, t + at, { type: "lowpass", f: p.f, q: 1.2, dur: 0.1, vol: 0.55 * p.vol * env, attack: 0.012 }); // prettier-ignore
        tone(c, o, t + at, { f: 75, to: 55, dur: 0.08, vol: 0.18 * p.vol * env, attack: 0.012 });
      }
      noise(c, o, t, { f: 1500, q: 0.6, dur: d, vol: 0.05 * p.vol, attack: 0.3, swell: true });
      return d;
    },
  },
  creak: {
    // Wood under strain: a creak of stick-slip grating that tightens (to).
    f: 380,
    rate: 38,
    to: 1.3,
    play: (c, o, t, p) => {
      const d = 0.8 * p.decay;
      const into = body(c, o, t, d, [[p.f, 9, 1], [p.f * 2.3, 7, 0.6], [p.f * 4.1, 5, 0.25]]); // prettier-ignore
      stickSlip(c, into, t, d, { rate: p.rate, to: p.to, vol: 0.9 * p.vol });
      return d;
    },
  },
  snip: {
    // Scissors: the blades' short metal slide and the snap as they cut.
    f: 5000,
    play: (c, o, t, p) => {
      noise(c, o, t, { f: p.f * 0.6, to: p.f, q: 3, dur: 0.07, vol: 0.2 * p.vol, attack: 0.01 });
      noise(c, o, t + 0.065, { f: 1500, q: 1, dur: 0.025, vol: 0.28 * p.vol, attack: 0.001 });
      noise(c, o, t + 0.07, { f: p.f, q: 6, dur: 0.02, vol: 0.35 * p.vol, attack: 0.001 });
      tone(c, o, t + 0.07, { f: p.f * 0.5, dur: 0.05, vol: 0.03 * p.vol, attack: 0.001 });
      return 0.12;
    },
  },
  trumpet: {
    // A natural trumpet (fanfares): the lips scoop up to the note, the tone
    // brightens with the breath, and vibrato comes in late.
    f: 523,
    play: (c, o, t, p) => {
      const d = 0.4 * p.decay;
      const bus = filter(c, t, { f: p.f * 1.5, q: 1 });
      bus.frequency.linearRampToValueAtTime(p.f * 7, t + 0.05);
      bus.frequency.linearRampToValueAtTime(p.f * 4.5, t + d);
      const form = filter(c, t, { type: "peaking", f: 1300, q: 1.4 });
      form.gain.value = 5;
      const g = envGain(c, t, { vol: 0.3 * p.vol, attack: 0.03, hold: d * 0.65, dur: d });
      bus.connect(form).connect(g).connect(o);
      const s = c.createOscillator();
      s.setPeriodicWave(pulseWave(c));
      s.frequency.setValueAtTime(p.f * 0.96, t);
      s.frequency.exponentialRampToValueAtTime(p.f, t + 0.04);
      wander(c, s.frequency, t, d, { rate: 6, depth: p.f * 0.004 });
      s.connect(bus);
      s.start(t);
      s.stop(t + d + 0.05);
      noise(c, g, t, { f: p.f * 3, q: 1, dur: 0.06, vol: 0.08, attack: 0.01 });
      return d;
    },
  },
  bowstring: {
    // A bow let go: the string's thump against the limbs, a brief flutter
    // and the arrow's hiss away. No note rings on.
    f: 110,
    play: (c, o, t, p) => {
      tone(c, o, t, { f: p.f * 1.6, to: p.f * 0.7, glide: 0.05, dur: 0.12, vol: 0.55 * p.vol, attack: 0.002 }); // prettier-ignore
      noise(c, o, t, { type: "lowpass", f: 900, q: 0.7, dur: 0.05, vol: 0.35 * p.vol, attack: 0.001 }); // prettier-ignore
      noise(c, o, t, { f: 420, q: 2, dur: 0.15, vol: 0.12 * p.vol, attack: 0.002, am: 55, amDepth: 0.5 }); // prettier-ignore
      noise(c, o, t + 0.02, { f: 900, to: 500, q: 1, dur: 0.3 * p.decay, vol: 0.12 * p.vol, attack: 0.03, swell: true }); // prettier-ignore
      return 0.32 * p.decay;
    },
  },
  slosh: {
    // Water moving in a bottle: a wash swinging back and forth (rate a
    // second), lapping, and a glug or two (n).
    f: 500,
    rate: 2.2,
    n: 2,
    play: (c, o, t, p) => {
      const d = 1.4 * p.decay;
      noise(c, o, t, { type: "lowpass", f: p.f, q: 0.9, dur: d, vol: 0.3 * p.vol, attack: d * 0.3, swell: true, am: p.rate, amDepth: 0.8 }); // prettier-ignore
      noise(c, o, t, { f: p.f * 1.8, q: 2, dur: d, vol: 0.08 * p.vol, attack: d * 0.3, swell: true, am: p.rate * 2, amDepth: 0.8 }); // prettier-ignore
      for (let i = 0; i < p.n; i++) {
        const at = t + d * rnd(0.2, 0.8);
        const f = p.f * rnd(0.45, 0.8);
        tone(c, o, at, {
          f,
          to: f * 1.25,
          glide: 0.05,
          dur: 0.08,
          vol: 0.16 * p.vol,
          attack: 0.006,
        });
      }
      return d;
    },
  },
  launch: {
    // A firework leaving its tube: the thump and a rushing trail (no whistle).
    f: 90,
    play: (c, o, t, p) => {
      tone(c, o, t, { f: p.f, to: p.f * 0.55, dur: 0.12, vol: 0.45 * p.vol, attack: 0.002 });
      noise(c, o, t, { type: "lowpass", f: 700, q: 0.7, dur: 0.07, vol: 0.3 * p.vol, attack: 0.001 }); // prettier-ignore
      noise(c, o, t + 0.03, { f: 500, to: 1300, q: 0.7, dur: 0.8 * p.decay, vol: 0.2 * p.vol, attack: 0.2 * p.decay, swell: true }); // prettier-ignore
      return 0.85 * p.decay;
    },
  },
  bang: {
    // A firework's burst (or any explosion): a deep boom with a rolling echo;
    // n adds a soft crackling tail of stars.
    f: 60,
    n: 0,
    bright: 0.5,
    play: (c, o, t, p) => {
      const d = 1.4 * p.decay;
      tone(c, o, t, { f: p.f * 2, to: p.f * 0.6, glide: 0.15, dur: 0.9 * p.decay, vol: 0.85 * p.vol, attack: 0.003 }); // prettier-ignore
      noise(c, o, t, { type: "lowpass", f: 700 + 1200 * p.bright, q: 0.6, dur: 0.5 * p.decay, vol: 0.75 * p.vol, attack: 0.002 }); // prettier-ignore
      noise(c, o, t + 0.05, { type: "lowpass", f: 260, q: 0.7, dur: d, vol: 0.4 * p.vol, attack: 0.05 }); // prettier-ignore
      noise(c, o, t + 0.28, { type: "lowpass", f: 400, q: 0.7, dur: 0.6 * p.decay, vol: 0.18 * p.vol, attack: 0.03 }); // prettier-ignore
      if (p.n > 0)
        grains(c, o, t + 0.3, {
          n: p.n,
          dur: 1.1 * p.decay,
          grain: (at, i, r) =>
            noise(c, o, at, { f: rnd(3000, 6000), q: 1, dur: 0.02, vol: 0.08 * p.vol * (1 - i / (p.n + 4)), attack: 0.004 }), // prettier-ignore
        });
      return d + 0.2;
    },
  },
  hooves: {
    // Horses' hooves on packed sand: a trot's two-beat clops (n strides,
    // rate a second).
    f: 520,
    n: 6,
    rate: 2.6,
    play: (c, o, t, p) => {
      for (let i = 0; i < p.n; i++)
        for (const off of [0, 0.1]) {
          const at = t + i / p.rate + off + rnd(-0.01, 0.01);
          const v = p.vol * rnd(0.7, 1) * (off ? 0.75 : 1);
          modal(c, o, at, { f: p.f * rnd(0.9, 1.1), kind: "hollow", decay: 0.35, vol: 0.3 * v, bright: 0.2 }); // prettier-ignore
          noise(c, o, at, { type: "lowpass", f: 900, q: 0.7, dur: 0.04, vol: 0.28 * v, attack: 0.002 }); // prettier-ignore
        }
      return p.n / p.rate + 0.2;
    },
  },
  crowd: {
    // A crowd in the stands: a babble of many voices (n) over a broad murmur;
    // `to` above 1 lifts it into a cheer.
    f: 200,
    n: 14,
    to: 1,
    play: (c, o, t, p) => {
      const d = 2 * p.decay;
      for (const [f, q, a] of [
        [500, 2, 0.14],
        [1400, 3, 0.07],
        [2700, 3, 0.03],
      ]) {
        const g = c.createGain();
        g.gain.value = 0.7;
        wander(c, g.gain, t, d, { rate: 4, depth: 0.3 });
        g.connect(o);
        noise(c, g, t, { f, to: f * p.to, q, dur: d, vol: a * p.vol, attack: d * 0.3, swell: true }); // prettier-ignore
      }
      for (let i = 0; i < p.n; i++) {
        const f = p.f * rnd(0.6, 1.9);
        const len = rnd(0.2, 0.5);
        formant(c, o, t + rnd(0.05, d - len), {
          f,
          to: f * rnd(0.85, 1.15) * p.to,
          dur: len,
          vol: (0.35 * p.vol) / Math.sqrt(p.n),
          attack: 0.05,
          formants: [[rnd(400, 850), 4, 1], [rnd(900, 1900), 5, 0.5], [2600, 4, 0.15]], // prettier-ignore
          formantsTo: [[rnd(350, 800)], [rnd(900, 2100)], [2500]],
          breath: 0.4,
        });
      }
      return d;
    },
  },
  pebble: {
    // Stones knocking: a hard bright tock with a dull body (n knocks).
    f: 2600,
    n: 1,
    play: (c, o, t, p) => {
      let at = 0;
      for (let i = 0; i < p.n; i++) {
        const v = p.vol * (i ? rnd(0.5, 0.8) : 1);
        noise(c, o, t + at, { f: p.f * rnd(0.8, 1.3), q: 4, dur: 0.02, vol: 0.45 * v, attack: 0.0008 }); // prettier-ignore
        noise(c, o, t + at, { f: p.f * 0.35, q: 3, dur: 0.014, vol: 0.3 * v, attack: 0.0008 });
        tone(c, o, t + at, { f: p.f * 0.23, dur: 0.018, vol: 0.14 * v, attack: 0.001 });
        at += rnd(0.06, 0.12);
      }
      return at + 0.05;
    },
  },
  spintop: {
    // A spinning top on a table: a soft steady whirr that wobbles as it
    // precesses (rate) and sinks slowly as it slows (to below 1).
    f: 180,
    rate: 5,
    to: 0.85,
    play: (c, o, t, p) => {
      const d = 2.4 * p.decay;
      const wob = c.createGain();
      wob.gain.value = 0.7;
      const lfo = c.createOscillator();
      lfo.frequency.value = p.rate;
      const dep = c.createGain();
      dep.gain.value = 0.3;
      lfo.connect(dep).connect(wob.gain);
      lfo.start(t);
      lfo.stop(t + d + 0.05);
      wob.connect(o);
      for (const [r, a] of [[1, 0.12], [2, 0.05], [3.01, 0.02]]) // prettier-ignore
        tone(c, wob, t, { wave: "triangle", f: p.f * r, to: p.f * r * p.to, dur: d, vol: a * p.vol, attack: 0.25, hold: d * 0.6 }); // prettier-ignore
      noise(c, wob, t, { f: 2200, q: 1.2, dur: d, vol: 0.05 * p.vol, attack: 0.25, hold: d * 0.6 });
      return d;
    },
  },
  yoyo: {
    // A yo-yo: the string unwinding down, the whirr as it sleeps at the
    // bottom and the soft smack as it winds back into the hand.
    f: 140,
    play: (c, o, t, p) => {
      const d = p.decay;
      noise(c, o, t, { f: 1800, to: 900, q: 2, dur: 0.35 * d, vol: 0.14 * p.vol, attack: 0.03 });
      const wob = c.createGain();
      wob.gain.value = 0.7;
      wander(c, wob.gain, t, 1.2 * d, { rate: 20, depth: 0.25 });
      wob.connect(o);
      tone(c, wob, t + 0.3 * d, { wave: "triangle", f: p.f, dur: 0.7 * d, vol: 0.12 * p.vol, attack: 0.08, hold: 0.3 * d }); // prettier-ignore
      noise(c, wob, t + 0.3 * d, { f: 700, q: 3, dur: 0.7 * d, vol: 0.06 * p.vol, attack: 0.08 });
      noise(c, o, t + 0.85 * d, { f: 1200, to: 2200, q: 2, dur: 0.3 * d, vol: 0.1 * p.vol, attack: 0.03 }); // prettier-ignore
      tone(c, o, t + 1.15 * d, { f: 170, to: 90, dur: 0.06, vol: 0.3 * p.vol, attack: 0.002 });
      noise(c, o, t + 1.15 * d, { type: "lowpass", f: 1400, q: 0.7, dur: 0.035, vol: 0.28 * p.vol, attack: 0.001 }); // prettier-ignore
      return 1.25 * d;
    },
  },
  twist: {
    // A puzzle cube's layer turning: a plastic slide over its ridges and the
    // soft clack as it seats.
    f: 1800,
    play: (c, o, t, p) => {
      const d = 0.09 * p.decay;
      noise(c, o, t, { f: p.f, q: 1.5, dur: d, vol: 0.24 * p.vol, attack: 0.012, am: 90, amDepth: 0.5 }); // prettier-ignore
      modal(c, o, t + d, {
        f: p.f * 0.62,
        kind: "clack",
        decay: 0.8,
        vol: 0.22 * p.vol,
        bright: 0.3,
      });
      noise(c, o, t + d, { type: "lowpass", f: 900, q: 0.7, dur: 0.02, vol: 0.2 * p.vol, attack: 0.001 }); // prettier-ignore
      return d + 0.06;
    },
  },
  sproing: {
    // A metal coil spring: the dispersive "pew" of the coil ringing back (n
    // echoes) and a short metallic wobble. Not a rubber band.
    f: 300,
    n: 4,
    play: (c, o, t, p) => {
      for (let k = 0; k < p.n; k++)
        tone(c, o, t + k * 0.085 * p.decay, { f: p.f * 9, to: p.f, glide: 0.06, dur: 0.08, vol: 0.2 * p.vol * 0.62 ** k, attack: 0.002 }); // prettier-ignore
      modal(c, o, t, { f: p.f * 2.2, kind: "metal", decay: 0.45, vol: 0.12 * p.vol, bright: 0.3 });
      tone(c, o, t, { wave: "triangle", f: p.f * 0.7, dur: 0.5 * p.decay, vol: 0.1 * p.vol, vib: 0.07, vibRate: 9 }); // prettier-ignore
      return 0.5 * p.decay;
    },
  },
  balloonpop: {
    // A balloon bursting: a sharp bang, a low thump and the rubber flapping.
    f: 90,
    play: (c, o, t, p) => {
      noise(c, o, t, { type: "highpass", f: 400, q: 0.5, dur: 0.045, vol: 0.8 * p.vol, attack: 0.0005 }); // prettier-ignore
      noise(c, o, t, { type: "lowpass", f: 1800, q: 0.6, dur: 0.09, vol: 0.45 * p.vol, attack: 0.001 }); // prettier-ignore
      tone(c, o, t, { f: p.f * 1.5, to: p.f, dur: 0.06, vol: 0.35 * p.vol, attack: 0.001 });
      noise(c, o, t + 0.02, { f: 700, q: 2, dur: 0.06, vol: 0.1 * p.vol, attack: 0.003, am: 120, amDepth: 0.6 }); // prettier-ignore
      return 0.12;
    },
  },
  flybuzz: {
    // A real fly: a raspy wingbeat hum (f) that wanders in pitch and loudness
    // as it flies nearer and away.
    f: 200,
    bright: 0.6,
    play: (c, o, t, p) => {
      const d = 1.2 * p.decay;
      const s = osc(c, t, { wave: "sawtooth", f: p.f, dur: d });
      wander(c, s.frequency, t, d, { rate: 1.5, depth: p.f * 0.07 });
      const near = c.createGain();
      near.gain.value = 0.6;
      wander(c, near.gain, t, d, { rate: 2, depth: 0.35 });
      const b1 = filter(c, t, { type: "bandpass", f: p.f * (3 + 3 * p.bright), q: 1 });
      const b2 = filter(c, t, { type: "bandpass", f: p.f * 9, q: 1.5 });
      const g = swellGain(c, t, { vol: 0.8 * p.vol, attack: 0.1, dur: d });
      s.connect(b1).connect(near);
      s.connect(b2).connect(near);
      near.connect(g).connect(o);
      return d;
    },
  },
  croak: {
    // A frog's croak: a low rasp of fast vocal pulses (rate a second), n times.
    f: 280,
    n: 1,
    rate: 32,
    play: (c, o, t, p) => {
      for (let i = 0; i < p.n; i++) {
        const at = t + i * 0.55 * p.decay;
        const d = 0.35 * p.decay;
        const gate = c.createGain();
        gate.gain.value = 0.5;
        const lfo = c.createOscillator();
        lfo.type = "triangle";
        lfo.frequency.value = p.rate;
        const dep = c.createGain();
        dep.gain.value = 0.5;
        lfo.connect(dep).connect(gate.gain);
        lfo.start(at);
        lfo.stop(at + d + 0.05);
        gate.connect(o);
        formant(c, gate, at, { f: p.f * 0.5, to: p.f * 0.44, dur: d, vol: 0.6 * p.vol, attack: 0.02, formants: [[p.f * 2, 3, 1], [p.f * 4.5, 4, 0.4]] }); // prettier-ignore
      }
      return p.n * 0.55 * p.decay;
    },
  },
  owlhoot: {
    // A great horned owl: "hoo, h-hoo, hooo, hoo", low and breathy.
    f: 330,
    play: (c, o, t, p) => {
      const calls = [[0, 0.3, 0.8], [0.45, 0.12, 0.5], [0.62, 0.36, 0.9], [1.08, 0.38, 0.7], [1.55, 0.34, 0.6]]; // prettier-ignore
      for (const [at, len, v] of calls) {
        const d = len * p.decay;
        tone(c, o, t + at * p.decay, { f: p.f * 1.02, to: p.f * 0.94, dur: d, vol: 0.4 * v * p.vol, attack: 0.05, hold: d * 0.4 }); // prettier-ignore
        tone(c, o, t + at * p.decay, { f: p.f * 2.04, to: p.f * 1.88, dur: d, vol: 0.03 * v * p.vol, attack: 0.05, hold: d * 0.4 }); // prettier-ignore
        noise(c, o, t + at * p.decay, { f: p.f * 2.5, q: 1.5, dur: d, vol: 0.05 * v * p.vol, attack: 0.05 }); // prettier-ignore
      }
      return 1.95 * p.decay;
    },
  },
  melt: {
    // Something soft melting: a thick slow ooze and heavy drops (n) that plop
    // down, not bubbles.
    f: 220,
    n: 4,
    play: (c, o, t, p) => {
      const d = 1.8 * p.decay;
      noise(c, o, t, { type: "lowpass", f: 650, q: 0.7, dur: d, vol: 0.09 * p.vol, attack: d * 0.4, swell: true, am: 1.5, amDepth: 0.5 }); // prettier-ignore
      noise(c, o, t + d * 0.3, { f: 900, to: 500, q: 3, dur: 0.3, vol: 0.07 * p.vol, attack: 0.05 }); // prettier-ignore
      for (let i = 0; i < p.n; i++) {
        const at = t + d * (0.2 + (0.7 * (i + Math.random() * 0.5)) / p.n);
        const f = p.f * rnd(0.8, 1.2);
        tone(c, o, at, { f, to: f * 0.7, glide: 0.08, dur: 0.12, vol: 0.2 * p.vol, attack: 0.01 });
        noise(c, o, at, { type: "lowpass", f: 600, q: 0.7, dur: 0.05, vol: 0.1 * p.vol, attack: 0.004 }); // prettier-ignore
      }
      return d;
    },
  },
  stretch: {
    // Dough or cheese pulled: a wet, squeaky stick-slip that slows as it
    // gives (to below 1), over a soft sticky tearing.
    f: 700,
    rate: 55,
    to: 0.75,
    play: (c, o, t, p) => {
      const d = 0.7 * p.decay;
      const into = body(c, o, t, d, [
        [p.f, 5, 0.8],
        [p.f * 2.1, 4, 0.35],
      ]);
      stickSlip(c, into, t, d, { rate: p.rate, to: p.to, vol: 0.55 * p.vol, jitter: 0.45 });
      noise(c, o, t, { f: p.f * 1.3, to: p.f * 0.8, q: 2, dur: d, vol: 0.07 * p.vol, attack: d * 0.4, swell: true }); // prettier-ignore
      return d;
    },
  },
  peel: {
    // A fruit peel pulled back: soft fibrous tearing (n fibers) that
    // deepens as it goes, then the flop of the loose peel. Not a zipper.
    f: 1400,
    n: 26,
    play: (c, o, t, p) => {
      const d = 0.45 * p.decay;
      grains(c, o, t, {
        n: p.n,
        dur: d,
        accel: -0.3,
        grain: (at, i, r) =>
          noise(c, o, at, { f: p.f * (1 - (0.4 * i) / p.n) * rnd(0.8, 1.2), q: 1.4, dur: 0.015 + 0.02 * r, vol: 0.18 * p.vol * (0.6 + 0.4 * r), attack: 0.003 }), // prettier-ignore
      });
      noise(c, o, t, { f: p.f * 0.8, to: p.f * 0.5, q: 1, dur: d, vol: 0.08 * p.vol, attack: d * 0.4, swell: true }); // prettier-ignore
      noise(c, o, t + d, { type: "lowpass", f: 500, q: 0.7, dur: 0.06, vol: 0.14 * p.vol, attack: 0.004 }); // prettier-ignore
      return d + 0.08;
    },
  },
  gurgle: {
    // Liquid bubbling: low soft bubbles in thick water (n), over a slosh.
    f: 260,
    n: 10,
    play: (c, o, t, p) => {
      const d = 1 * p.decay;
      grains(c, o, t, {
        n: p.n,
        dur: d,
        grain: (at, i, r) => {
          const f = p.f * (0.6 + 0.7 * r);
          tone(c, o, at, { f, to: f * 1.15, glide: 0.03, dur: 0.06 + 0.06 * r, vol: 0.14 * p.vol, attack: 0.008 }); // prettier-ignore
          noise(c, o, at, { type: "lowpass", f: 500, q: 0.7, dur: 0.08, vol: 0.05 * p.vol, attack: 0.008 }); // prettier-ignore
        },
      });
      noise(c, o, t, { type: "lowpass", f: 400, q: 0.7, dur: d, vol: 0.06 * p.vol, attack: d * 0.3, swell: true, am: 6, amDepth: 0.6 }); // prettier-ignore
      return d + 0.1;
    },
  },
  swim: {
    // Swimming through water: each stroke (n, rate a second) a soft push of
    // water and a low bloop.
    f: 350,
    n: 2,
    rate: 1.2,
    play: (c, o, t, p) => {
      for (let i = 0; i < p.n; i++) {
        const at = t + i / p.rate;
        noise(c, o, at, { type: "lowpass", f: p.f, to: p.f * 0.6, q: 0.8, dur: 0.6 * p.decay, vol: 0.3 * p.vol, attack: 0.08, swell: true }); // prettier-ignore
        tone(c, o, at + 0.05, { f: 95, to: 70, dur: 0.25, vol: 0.12 * p.vol, attack: 0.03 });
      }
      return (p.n - 1) / p.rate + 0.6 * p.decay;
    },
  },
  keytap: {
    // A real keyboard key: the keycap's light tick, the thock as it bottoms
    // out and the quieter tick of its return.
    f: 2400,
    play: (c, o, t, p) => {
      noise(c, o, t, { f: p.f, q: 2, dur: 0.006, vol: 0.2 * p.vol, attack: 0.0005 });
      noise(c, o, t + 0.012, { type: "lowpass", f: 900, q: 0.7, dur: 0.025, vol: 0.32 * p.vol, attack: 0.001 }); // prettier-ignore
      tone(c, o, t + 0.012, { f: 380, to: 300, dur: 0.02, vol: 0.1 * p.vol, attack: 0.001 });
      noise(c, o, t + 0.09, { f: p.f * 0.8, q: 2, dur: 0.005, vol: 0.08 * p.vol, attack: 0.0005 });
      return 0.1;
    },
  },
  fan: {
    // A fan or propeller: air thrumming at the blade rate (rate a second)
    // that swells in as it starts, over a faint motor hum.
    f: 600,
    rate: 14,
    play: (c, o, t, p) => {
      const d = 1.6 * p.decay;
      noise(c, o, t, { type: "lowpass", f: p.f, q: 0.5, dur: d, vol: 0.2 * p.vol, attack: d * 0.4, swell: true, am: p.rate, amDepth: 0.4 }); // prettier-ignore
      tone(c, o, t, { wave: "triangle", f: 100, dur: d, vol: 0.03 * p.vol, attack: d * 0.3, hold: d * 0.4 }); // prettier-ignore
      return d;
    },
  },
  hit: {
    // A deep cinematic impact: a sub drop, a dark rush and a long low tail.
    f: 55,
    play: (c, o, t, p) => {
      const d = 1.6 * p.decay;
      tone(c, o, t, { f: p.f * 1.6, to: p.f * 0.6, glide: 0.3, dur: d, vol: 0.7 * p.vol, attack: 0.004 }); // prettier-ignore
      noise(c, o, t, { type: "lowpass", f: 900, to: 200, q: 0.6, dur: d * 0.8, vol: 0.4 * p.vol, attack: 0.005 }); // prettier-ignore
      return d;
    },
  },
  glow: {
    // A warm, slowly moving pad (notes as a chord, "A2+E3+A3"): detuned tones
    // through a filter that breathes, for the grand and mathematical.
    f: 110,
    bright: 0.4,
    play: (c, o, t, p) => {
      const d = 2.4 * p.decay;
      const lp = filter(c, t, { f: 300 + 1200 * p.bright, q: 0.9 });
      wander(c, lp.frequency, t, d, { rate: 0.8, depth: 200 + 600 * p.bright });
      const g = swellGain(c, t, { vol: 0.3 * p.vol, attack: d * 0.35, dur: d });
      lp.connect(g).connect(o);
      for (const det of [-8, 0, 7]) {
        const s = osc(c, t, { wave: "sawtooth", f: p.f, dur: d, detune: det });
        s.connect(lp);
      }
      return d;
    },
  },
  arc: {
    // Electricity: a crackling arc that buzzes at mains-like rate (rate) and
    // snaps; for neurons, circuits and sparks. Not a rising tone.
    f: 2500,
    rate: 90,
    play: (c, o, t, p) => {
      const d = 0.35 * p.decay;
      noise(c, o, t, { f: p.f, q: 0.8, dur: d, vol: 0.28 * p.vol, attack: 0.004, am: p.rate, amDepth: 0.9, amWave: "sawtooth" }); // prettier-ignore
      noise(c, o, t, { type: "lowpass", f: 400, q: 0.7, dur: d * 0.6, vol: 0.18 * p.vol, attack: 0.004, am: p.rate, amDepth: 0.8 }); // prettier-ignore
      return d;
    },
  },
  whoom: {
    // A great slow pass through the air: a dark rush that swells and falls
    // (a turning giant, a pass-by), without a rising pitch.
    f: 250,
    play: (c, o, t, p) => {
      const d = 1.4 * p.decay;
      noise(c, o, t, { type: "lowpass", f: p.f, q: 1.2, dur: d, vol: 0.4 * p.vol, attack: d * 0.5, swell: true }); // prettier-ignore
      tone(c, o, t, { f: 55, dur: d, vol: 0.15 * p.vol, attack: d * 0.5, hold: 0 });
      return d;
    },
  },
  chessmove: {
    // A chess piece set down on a wooden board: a felted, woody thock with
    // the board's low knock. kind "lift" is the lighter tap of picking one up.
    f: 520,
    play: (c, o, t, p) => {
      const lift = p.kind === "lift";
      const v = p.vol * (lift ? 0.45 : 1);
      noise(c, o, t, { type: "lowpass", f: lift ? 2200 : 1500, q: 0.7, dur: 0.03, vol: 0.4 * v, attack: 0.0015 }); // prettier-ignore
      modal(c, o, t, {
        f: p.f,
        kind: "wood",
        decay: lift ? 0.5 : 0.8,
        vol: 0.35 * v,
        bright: 0.25,
      });
      if (!lift) tone(c, o, t, { f: 170, to: 130, dur: 0.07, vol: 0.2 * v, attack: 0.002 });
      return 0.12;
    },
  },
  clockwork: {
    // A wind-up toy running down: gears whirring as the spring unwinds and
    // its tin feet clanking at `rate` steps a second, slowing as it goes.
    f: 2600,
    rate: 2.7,
    play: (c, o, t, p) => {
      const d = 2.6 * p.decay;
      noise(c, o, t, { f: p.f, q: 2, dur: d, vol: 0.12 * p.vol, attack: 0.05, am: 38, amDepth: 0.5 }); // prettier-ignore
      let at = 0.1;
      for (let i = 0; at < d - 0.1; i++) {
        modal(c, o, t + at, { f: 1300 * rnd(0.9, 1.1), kind: "metal", decay: 0.12, vol: 0.2 * p.vol * (1 - (0.5 * at) / d), bright: 0.3 }); // prettier-ignore
        noise(c, o, t + at, { type: "lowpass", f: 800, q: 0.7, dur: 0.03, vol: 0.12 * p.vol, attack: 0.002 }); // prettier-ignore
        at += 1 / (p.rate * (1 - (0.45 * at) / d));
      }
      return d;
    },
  },
  alarmbell: {
    // A wind-up alarm clock ringing: the hammer rattling between two bells
    // (rate strikes a second).
    f: 2100,
    rate: 18,
    play: (c, o, t, p) => {
      const d = 0.9 * p.decay;
      let i = 0;
      for (let at = 0; at < d; at += 1 / p.rate, i++)
        modal(c, o, t + at, { f: p.f * (i % 2 ? 1.09 : 1), kind: "bell", decay: 0.2, vol: 0.3 * p.vol, bright: 0.4 }); // prettier-ignore
      return d + 0.4;
    },
  },
  jingle: {
    // Sleigh bells shaken: bursts (n) of tiny bright jingles.
    f: 3200,
    n: 2,
    play: (c, o, t, p) => {
      for (let k = 0; k < p.n; k++)
        grains(c, o, t + k * 0.28 * p.decay, {
          n: 7,
          dur: 0.12,
          grain: (at, i, r) =>
            modal(c, o, at, { f: p.f * (0.8 + 0.5 * r), kind: "metal", decay: 0.18, vol: 0.18 * p.vol * (1 - i / 9), bright: 0.3 }), // prettier-ignore
        });
      return p.n * 0.28 * p.decay + 0.25;
    },
  },
};
Object.assign(VOICES, SOUND_B);
// Each Sound B voice's level, measured like the others (`node tools/sound-check.mjs --voices`);
// glow is set lower than measured (1.35), so a sustained pad stays under the tap's main sound.
Object.assign(LEVEL, {
  flame: 2.79, rustle: 8.05, pageflip: 3.48, bite: 3.72, shellcrack: 2.97, kernel: 7.55,
  dice: 4.03, chug: 4.26, motor: 1.35, rotor: 3.37, creak: 12, snip: 10.38, trumpet: 2.3,
  bowstring: 1.54, slosh: 5.05, launch: 1.77, bang: 0.64, hooves: 4.51, crowd: 7.54,
  pebble: 6.5, spintop: 3.75, yoyo: 3.07, twist: 8.18, sproing: 3.62, balloonpop: 1.56,
  flybuzz: 1.34, croak: 3.78, owlhoot: 1.47, melt: 4.26, stretch: 12, peel: 10.92,
  gurgle: 5.78, swim: 4.07, keytap: 7.55, fan: 6.84, hit: 0.75, glow: 0.75, arc: 5.73,
  whoom: 2.43, jingle: 5.71, chessmove: 2.82, clockwork: 6.53, alarmbell: 4.19,
}); // prettier-ignore
VOICE_NAMES.push(...Object.keys(SOUND_B));

// ---- Sound C (lane Sound C, October 2, 2026) --------------------------------------
// For the owner's review of October 2 (docs/reviews/sounds-2026-10-02.md).
const SOUND_C = {
  glide: {
    // A soft, continuous tone that falls the way a curve settles (from f to
    // f * to, most of the fall early, as a loss curve drops), swelling in
    // and fading out over 3 s * decay. Two sines a hair apart, lowpassed, so
    // it sounds warm rather than electronic.
    f: 660,
    to: 0.5,
    play: (c, o, t, p) => {
      const d = 3 * p.decay;
      const lp = c.createBiquadFilter();
      lp.type = "lowpass";
      lp.frequency.value = p.f * 2.5;
      lp.Q.value = 0.5;
      const g = c.createGain();
      g.gain.setValueAtTime(0, t);
      g.gain.linearRampToValueAtTime(0.3 * p.vol, t + Math.min(0.5, d * 0.15));
      g.gain.setValueAtTime(0.3 * p.vol, t + d * 0.7);
      g.gain.linearRampToValueAtTime(0, t + d);
      lp.connect(g).connect(o);
      for (const cents of [-4, 4]) {
        const s = c.createOscillator();
        s.frequency.setValueAtTime(p.f, t);
        s.frequency.setTargetAtTime(Math.max(20, p.f * p.to), t, d * 0.22);
        s.detune.value = cents;
        s.connect(lp);
        s.start(t);
        s.stop(t + d + 0.05);
      }
      return d;
    },
  },
};
Object.assign(VOICES, SOUND_C);
// Levels (node tools/sound-check.mjs --voices).
Object.assign(LEVEL, { glide: 1 });
VOICE_NAMES.push(...Object.keys(SOUND_C));
