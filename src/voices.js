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

// ---- Voices -----------------------------------------------------------------------
//
// Each voice: (ctx, out, t, p) -> seconds it lasts. p holds the spec's
// parameters with f already resolved (base frequency x pitch, or the note).

const rnd = (lo, hi) => lo + Math.random() * (hi - lo);

export const VOICES = {
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
};
export const VOICE_NAMES = Object.keys(VOICES);

// ---- Specs ------------------------------------------------------------------------

const PARAMS = new Set(
  "voice pitch f decay vol bright at notes step strum n rate to kind".split(" "),
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
  for (const k of ["pitch", "decay", "vol", "bright", "at", "step", "strum", "n", "rate", "to"])
    if (k in spec && !(typeof spec[k] === "number" && Number.isFinite(spec[k])))
      out.push(`${where}: ${k} must be a number`);
  if ("f" in spec) {
    try {
      noteFreq(spec.f);
    } catch (e) {
      out.push(`${where}: ${e.message}`);
    }
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
export function playSpec(ctx, out, t, spec, { pitch = 1, raw = false } = {}) {
  if (!spec) return 0;
  if (typeof spec === "string") {
    const fn = LEGACY[spec];
    return fn ? fn(ctx, out, t, pitch) || 0.3 : 0;
  }
  if (Array.isArray(spec)) {
    let end = 0;
    for (const s of spec) end = Math.max(end, playSpec(ctx, out, t, s, { pitch, raw }));
    return end;
  }
  if ("on" in spec) return playSpec(ctx, out, t, spec.on, { pitch, raw });
  const v = VOICES[spec.voice];
  if (!v) return 0;
  const start = t + (spec.at || 0);
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
    parseNotes(spec.notes).forEach((chord, i) => {
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
