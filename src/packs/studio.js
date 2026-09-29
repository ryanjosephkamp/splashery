// Studio (lane Studio Sound, "Sound you can see"): toys that turn sound into
// something you can see. Two labs toys for now: the song landscape (a real
// spectrogram of a song you open, as a 3D field of splats) and the Chladni
// plate (sand on a bowed metal plate finding the plate's still lines).

import { mix, shade, clamp, smoothstep, ramp } from "../kit.js";
import { spectrogram, landscapePlan, toMono, DB_FLOOR, F_MIN, F_MAX } from "./studio-audio.js";

// ---- The Chladni plate ----------------------------------------------------------------
// The classic model of a square plate of side L = 1 (x, y from 0 to 1) in one
// of its modes (n, m):
//
//   w(x, y) = cos(nπx)·cos(mπy) + s·cos(mπx)·cos(nπy),   s = +1 or −1
//
// w is how far the plate is displaced at that point (in units of its
// strongest swing); the nodal lines w = 0 are the parts that stay still. The
// mode's pitch follows n² + m² (a simply supported plate's frequencies go with
// that sum; a real plate's differ a little). Sand hops where |w| is large and
// stays where it is small, so it drifts to the nodal lines.

// A flat, smooth sheet of splats facing up: two staggered lattices of flat
// discs that overlap, so it reads as a solid surface (not a grid of dots).
// `cells` is the number of splats to spend; color(x, z) gives each one's color.
function sheet(k, { x0, x1, z0, z1, y, cells, color, part = 0, opacity = 1 }) {
  const w = x1 - x0;
  const d = z1 - z0;
  const gx = Math.max(4, Math.round(Math.sqrt((cells / 2) * (w / d))));
  const gz = Math.max(4, Math.round(cells / 2 / gx));
  const sx = w / gx;
  const sz = d / gz;
  const size = (0.66 * Math.max(sx, sz)) / 0.01; // a splat reads about 2.5 sizes across
  const list = [];
  for (let layer = 0; layer < 2; layer++)
    for (let i = 0; i < gx - layer; i++)
      for (let j = 0; j < gz - layer; j++) {
        const x = x0 + (i + 0.5 + layer * 0.5) * sx;
        const z = z0 + (j + 0.5 + layer * 0.5) * sz;
        list.push({ p: [x, y, z], n: [0, 1, 0], flat: 0.02, size, opacity, color: color(x, z), part, pattern: false }); // prettier-ignore
      }
  k.cloud({ share: list.length / k.count, pattern: false }, (rand, i) => list[i] || null);
}

export const F0 = 60; // Hz per unit of n² + m²

// The modes on offer: each names its (n, m) and sign.
export const MODES = [
  { id: "1-2-", n: 1, m: 2, s: -1 },
  { id: "1-2+", n: 1, m: 2, s: 1 },
  { id: "1-3-", n: 1, m: 3, s: -1 },
  { id: "1-3+", n: 1, m: 3, s: 1 },
  { id: "2-3-", n: 2, m: 3, s: -1 },
  { id: "2-3+", n: 2, m: 3, s: 1 },
  { id: "1-4-", n: 1, m: 4, s: -1 },
  { id: "3-4+", n: 3, m: 4, s: 1 },
];

export function modeById(id) {
  return MODES.find((m) => m.id === id) || MODES[5];
}
export function modeFreq(mode) {
  return F0 * (mode.n * mode.n + mode.m * mode.m);
}
export function modeLabel(mode) {
  return `Mode ${mode.n}, ${mode.m} (${mode.s > 0 ? "+" : "−"}): ${modeFreq(mode)} Hz`;
}

// The plate's displacement at (x, y), 0..1 each. Strongest swing is 2.
export function displacement(mode, x, y) {
  const { n, m, s } = mode;
  const P = Math.PI;
  return Math.cos(n * P * x) * Math.cos(m * P * y) + s * Math.cos(m * P * x) * Math.cos(n * P * y);
}
// Its slope along x and y.
function slope(mode, x, y) {
  const { n, m, s } = mode;
  const P = Math.PI;
  return [
    -n * P * Math.sin(n * P * x) * Math.cos(m * P * y) - s * m * P * Math.sin(m * P * x) * Math.cos(n * P * y), // prettier-ignore
    -m * P * Math.cos(n * P * x) * Math.sin(m * P * y) - s * n * P * Math.cos(m * P * x) * Math.sin(n * P * y), // prettier-ignore
  ];
}

// How far a point is from the nearest nodal line, roughly: |w| over the size
// of its slope (one Newton step to the zero). Used by the tests.
export function nodalDistance(mode, x, y) {
  const w = displacement(mode, x, y);
  const [gx, gy] = slope(mode, x, y);
  return Math.abs(w) / Math.max(1e-6, Math.hypot(gx, gy));
}

export const KEYS = 12; // steps of the settling, each a copy of the sand
const SUB = 12; // small moves between two copies

// The sand's journey: KEYS + 1 snapshots of n grains [x, y, hop], the first
// scattered evenly over the plate, the last settled on the nodal lines. Each
// small move a grain (1) jumps in a random direction by an amount that grows
// with the plate's swing where it lies, and (2) slides toward the nearest
// still line (a step of Newton's method on w, the way sand is shaken toward
// the places that do not move). The hop height is the local swing.
export function settle(mode, n, rand) {
  const X = new Float32Array(n);
  const Y = new Float32Array(n);
  for (let i = 0; i < n; i++) {
    X[i] = 0.015 + 0.97 * rand();
    Y[i] = 0.015 + 0.97 * rand();
  }
  const snap = (last) => {
    const out = new Float32Array(n * 3);
    for (let i = 0; i < n; i++) {
      const a = Math.min(1, Math.abs(displacement(mode, X[i], Y[i])) / 1.4);
      out[i * 3] = X[i];
      out[i * 3 + 1] = Y[i];
      out[i * 3 + 2] = last ? 0 : a * (0.35 + 0.65 * rand());
    }
    return out;
  };
  const snaps = [snap(false)];
  for (let k = 0; k < KEYS; k++) {
    for (let s = 0; s < SUB; s++) {
      for (let i = 0; i < n; i++) {
        const w = displacement(mode, X[i], Y[i]);
        const [gx, gy] = slope(mode, X[i], Y[i]);
        const g2 = gx * gx + gy * gy + 1e-3;
        // Slide toward the still line, at most a short way.
        let dx = (-0.045 * w * gx) / g2;
        let dy = (-0.045 * w * gy) / g2;
        const len = Math.hypot(dx, dy);
        if (len > 0.02) {
          dx *= 0.02 / len;
          dy *= 0.02 / len;
        }
        // Jump about, more where the plate swings more.
        const a = 0.012 * Math.min(2, Math.abs(w)) ** 1.5;
        const th = rand() * Math.PI * 2;
        const r = a * (0.3 + rand());
        X[i] = clamp(X[i] + dx + r * Math.cos(th), 0.012, 0.988);
        Y[i] = clamp(Y[i] + dy + r * Math.sin(th), 0.012, 0.988);
      }
    }
    snaps.push(snap(k === KEYS - 1));
  }
  return snaps;
}

const PLATE = 1.0; // half of the plate's side, in recipe units
const PLATE_T = 0.06; // its thickness
const GRAIN_LIFT = 0.012;
const HOP = 0.09; // the highest hop, in recipe units
const BOW_SECS = 3.6;

// Sound and drive state for the tap (one toy at a time).
const CH = { was: 0 };

function chladniCue(mode, on) {
  const f = modeFreq(mode);
  if (on)
    return [
      { voice: "tone", f, decay: 9, kind: "sine", vol: 0.9 },
      { voice: "tone", f: f * 2, decay: 9, kind: "triangle", vol: 0.12 },
      { voice: "patter", at: 0.1, f: 2600, n: 40, decay: 2.2, vol: 0.3 },
    ];
  return [{ voice: "hiss", f: 3000, decay: 0.7, vol: 0.3 }];
}

const CHLADNI = {
  alive: (c) => c.bow > 0.001 && c.bow < 0.999,
  // Sand grains take most of the budget (in twelve copies of which one shows).
  density: 2,
  options: [
    {
      key: "mode",
      label: "Mode",
      type: "select",
      default: "2-3+",
      choices: MODES.map((m) => ({ id: m.id, label: modeLabel(m) })),
    },
  ],
  controls: [{ key: "bow", label: "Bow the plate", type: "toggle", default: 0, ease: BOW_SECS }],
  action: { key: "bow", label: "Bow the plate", quiet: ["bow"] },
  drive(t, c, out, info) {
    const g = info?.data?.chladni;
    if (!g) return;
    const p = clamp01(c.bow ?? 0);
    // The sound: the hum when the bowing starts, a hiss when it is stirred.
    if (CH.was <= 0.001 && p > 0.001) for (const s of chladniCue(g.mode, true)) out.cues.push(s);
    else if (CH.was >= 0.999 && p < 0.999) for (const s of chladniCue(g.mode, false)) out.cues.push(s); // prettier-ignore
    CH.was = p;
    // Which of the twelve copies of the sand shows, and how far it has
    // moved on toward the next.
    const pos = p * KEYS;
    const j = Math.min(KEYS - 1, Math.floor(pos));
    for (let i = 0; i < KEYS; i++) out.parts[`sand${i}`] = { visible: i === j ? 1 : 0 };
    out.morph = [pos - j, 0, 0, 0];
    // The bow is drawn along the front edge while the sand moves.
    const bowing = p > 0.001 && p < 0.999;
    const ramp = Math.min(smoothstep(0, 0.06, p), 1 - smoothstep(0.94, 1, p));
    out.parts.bow = {
      visible: bowing ? 1 : 0,
      offset: [0, 0.38 * Math.sin(t * 7) * ramp, 0],
    };
    // The plate itself shivers a hair.
    out.parts.plate = { offset: [0, 0.006 * Math.sin(t * 90) * ramp, 0] };
  },
  build(k, o) {
    const mode = modeById(o.mode);
    // The stand: a base, a post, and the plate clamped on top.
    const plate = k.part("plate", { pivot: [0, 0, 0], axis: [0, 1, 0] });
    k.add(k.cylinder(0.5, 0.1, { caps: true }), {
      pos: [0, -1.05, 0],
      color: "#2b3037",
      share: 0.05,
      even: true,
    });
    k.add(k.cylinder(0.09, 1.0, { caps: "bottom" }), {
      pos: [0, -0.55, 0],
      color: (c) => shade("#454c55", 0.8 + 0.3 * Math.abs(c.n[0])),
      share: 0.04,
      even: true,
    });
    // The plate: its top a smooth sheet of overlapping flat discs (brushed
    // steel, a soft light across it), its edge a thin box.
    k.add(k.box(2 * PLATE, PLATE_T, 2 * PLATE), {
      pos: [0, -PLATE_T / 2 - 0.002, 0],
      color: (c) => shade("#56606c", 0.75 + 0.25 * Math.abs(c.n[1])),
      part: plate,
      share: 0.04,
      even: true,
    });
    sheet(k, {
      x0: -PLATE,
      x1: PLATE,
      z0: -PLATE,
      z1: PLATE,
      y: 0.001,
      cells: k.count * 0.16,
      part: plate,
      color: (x, z) => mix("#5d6874", "#7a8593", clamp(0.5 + (0.28 * (x - z)) / PLATE, 0, 1)),
    });
    // The bow: a slim stick with a pale ribbon of hair against the front edge.
    const bow = k.part("bow");
    k.add(k.box(0.05, 1.5, 0.05), {
      pos: [0.15, 0.0, PLATE + 0.16],
      rot: [0, 0, 0],
      color: "#6a4a30",
      part: bow,
      share: 0.02,
    });
    k.add(k.box(0.012, 1.45, 0.11), {
      pos: [0.15, 0.0, PLATE + 0.06],
      color: "#efe6d0",
      part: bow,
      share: 0.015,
    });
    // The sand: one splat per grain in each of the twelve copies.
    const copies = KEYS;
    const n = Math.max(200, Math.floor((k.count * 0.6) / copies));
    const snaps = settle(mode, n, () => k.rand());
    const at = (s, i) => [
      (s[i * 3] * 2 - 1) * PLATE,
      GRAIN_LIFT + s[i * 3 + 2] * HOP,
      (s[i * 3 + 1] * 2 - 1) * PLATE,
    ];
    const tone = Array.from({ length: n }, () => k.rand());
    for (let j = 0; j < copies; j++) {
      const part = k.part(`sand${j}`);
      k.cloud({ share: n / k.count, size: 0.5, pattern: false }, (rand, i) => ({
        p: at(snaps[j], i),
        to: at(snaps[j + 1], i),
        channel: 0,
        color: mix("#e9d8ac", "#f8efd2", tone[i]),
        size: 0.5 + 0.4 * tone[i],
        opacity: 0.98,
        part,
        pattern: false,
      }));
    }
    k.reach([0, HOP + 0.3, 0]);
    k.data = { chladni: { mode, copies } };
  },
};

// ---- The song landscape ---------------------------------------------------------------
// A song's spectrogram (src/packs/studio-audio.js: a Hann-windowed short-time
// Fourier transform, pooled into musical bands) as a field of splats. Time runs
// away from you (the start is near), pitch runs across on a log scale from
// F_MIN to F_MAX (low on the left), and loudness is height in dB: the loudest
// point of the song is the top and DB_RANGE below it is the floor. Along the
// left edge runs the song's waveform, and a glowing marker line glides along
// the time axis while the song plays.

export const DB_RANGE = 45;
const W = 2; // width (pitch axis)
const H = 0.75; // the loudest point's height
const SONG = { current: null, sample: null, custom: null, want: null };
// What playing needs from the page: the song's samples, and the sound
// (src/sound.js's Sound, which the drive's info hands over as info.sound).
const PLAY = { on: false, pos: 0, last: null, src: null, start: 0, ctx: null };

// A WAV file's samples (16 bit PCM, any channels), for the sample without Web
// Audio (so the Node tools can build it too).
export function parseWav(bytes) {
  const v = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  let p = 12;
  let fmt = null;
  while (p + 8 <= bytes.length) {
    const id = String.fromCharCode(...bytes.subarray(p, p + 4));
    const size = v.getUint32(p + 4, true);
    if (id === "fmt ") fmt = { ch: v.getUint16(p + 10, true), rate: v.getUint32(p + 12, true), bits: v.getUint16(p + 22, true) }; // prettier-ignore
    if (id === "data" && fmt) {
      const n = Math.floor(Math.min(size, bytes.length - p - 8) / (2 * fmt.ch));
      const chans = Array.from({ length: fmt.ch }, () => new Float32Array(n));
      for (let i = 0; i < n; i++)
        for (let c = 0; c < fmt.ch; c++) chans[c][i] = v.getInt16(p + 8 + (i * fmt.ch + c) * 2, true) / 32768; // prettier-ignore
      return { samples: toMono(chans), rate: fmt.rate };
    }
    p += 8 + size + (size & 1);
  }
  throw new Error("That is not a sound file this toy can read.");
}

async function readBytes(rel) {
  const url = new URL(rel, import.meta.url);
  if (url.protocol === "file:") {
    const fs = await import("node:fs/promises");
    return new Uint8Array(await fs.readFile(url));
  }
  const r = await fetch(url);
  if (!r.ok) throw new Error("Could not load the sample song.");
  return new Uint8Array(await r.arrayBuffer());
}

// A file the visitor opens: decoded by the browser (Web Audio) on this
// device, mixed to mono. Nothing is uploaded.
export async function decodeSound(file) {
  const AC = globalThis.OfflineAudioContext || globalThis.webkitOfflineAudioContext;
  if (!AC) throw new Error("This browser cannot decode sound files.");
  const bytes = await file.arrayBuffer();
  let buf;
  try {
    buf = await new AC(1, 1, 44100).decodeAudioData(bytes);
  } catch {
    throw new Error("This browser cannot read that sound file. Try an MP3, WAV, OGG or M4A.");
  }
  const chans = Array.from({ length: buf.numberOfChannels }, (_, c) => buf.getChannelData(c));
  return { samples: toMono(chans), rate: buf.sampleRate };
}

// The landscape's numbers for a song and a splat budget: the spectrogram, its
// heights (0..1, the loudest point 1) and the shape of the plan.
export function landscapeData(samples, rate, budget) {
  const duration = samples.length / rate;
  const plan = landscapePlan(duration, budget);
  const g = spectrogram(samples, rate, { frames: plan.frames, perOctave: plan.perOctave });
  let top = DB_FLOOR;
  for (const v of g.db) if (v > top) top = v;
  const height = new Float32Array(g.db.length);
  for (let i = 0; i < height.length; i++) height[i] = clamp01((g.db[i] - (top - DB_RANGE)) / DB_RANGE); // prettier-ignore
  return { ...g, duration, top, height };
}

function landscapeLength(duration) {
  return Math.min(8, 1.2 + 0.08 * duration);
}

function songColor(look, f, nf, h) {
  if (look === "loudness") return ramp(["#16224f", "#2b63c9", "#2fc2b8", "#f4e25c", "#ffffff"], h);
  const c = ramp(["#3b6cff", "#22c3d6", "#5ee27a", "#f2d43c", "#ff8a3c", "#ff4f7b"], f / (nf - 1));
  return shade(c, 0.5 + 0.5 * h);
}

// Where the song is (for the tests): playing or not, and the second.
export const playState = () => ({ on: PLAY.on, pos: PLAY.pos, audio: !!PLAY.src });

// The song's sound and the moving marker: one frame's step.
function playStep(song, sound, on, time) {
  const dt = PLAY.last === null ? 0 : Math.min(0.25, Math.max(0, time - PLAY.last));
  PLAY.last = time;
  if (on && !PLAY.on) {
    if (PLAY.pos >= song.duration - 0.05) PLAY.pos = 0;
    PLAY.on = true;
    const ctx = sound?.enabled ? sound.audio() : null;
    if (ctx && sound.master) {
      const buf = ctx.createBuffer(1, song.samples.length, song.rate);
      buf.copyToChannel(song.samples, 0);
      const src = ctx.createBufferSource();
      src.buffer = buf;
      src.connect(sound.master);
      src.start(0, PLAY.pos);
      PLAY.src = src;
      PLAY.ctx = ctx;
      PLAY.start = ctx.currentTime - PLAY.pos;
    }
  } else if (!on && PLAY.on) {
    PLAY.on = false;
    try {
      PLAY.src?.stop();
    } catch {
      // Already ended.
    }
    PLAY.src = null;
    PLAY.ctx = null;
  } else if (PLAY.on) {
    PLAY.pos = PLAY.ctx ? PLAY.ctx.currentTime - PLAY.start : PLAY.pos + dt;
    if (PLAY.pos >= song.duration) {
      PLAY.pos = song.duration;
      PLAY.on = false;
      PLAY.src = null;
      PLAY.ctx = null;
    }
  }
  return PLAY.pos;
}

const SONG_LANDSCAPE = {
  alive: (c) => c.play > 0.5,
  density: 1,
  options: [
    {
      key: "look",
      label: "Color follows",
      type: "select",
      default: "pitch",
      choices: [
        { id: "pitch", label: "Pitch (a rainbow across)" },
        { id: "loudness", label: "Loudness (dark to bright)" },
      ],
    },
    { key: "song", label: "Song", type: "text", default: "sample", hidden: true },
    { key: "songName", label: "Song name", type: "text", default: "", hidden: true },
  ],
  controls: [{ key: "play", label: "Play", type: "toggle", default: 0, ease: 0.3 }],
  action: { key: "play", label: "Play or pause the song", quiet: ["play"] },
  // Your own song: opened with the Toy tab's panel (a file the browser can
  // decode), read on this device.
  input: {
    title: "Your own song",
    accept: "audio/*,.mp3,.wav,.ogg,.m4a,.flac,.aac,.opus",
    binary: true,
    fileButton: "Open a song…",
    note: "Open an MP3, WAV, OGG, M4A or FLAC file. It is decoded on this device; nothing is uploaded. A long song makes a longer landscape at lower detail.",
    async read(_text, fileName, file) {
      if (!file) throw new Error("Open a sound file.");
      const s = await decodeSound(file);
      if (s.samples.length / s.rate < 0.5) throw new Error("That sound is too short.");
      SONG.custom = { ...s, name: fileName.replace(/\.[^.]+$/, "") };
      return { song: "custom", songName: SONG.custom.name };
    },
    shown: () =>
      SONG.current ? `${SONG.current.name} (${Math.round(SONG.current.duration)} s)` : "",
  },
  credits: [
    {
      label: "Song landscape",
      title: "Sample song (our own tune, made by tools/make-song-sample.mjs)",
      source: "https://github.com/ryanjosephkamp/splashery/blob/main/tools/make-song-sample.mjs",
      author: "Splashery",
      license: "CC0 1.0",
      licenseUrl: "https://creativecommons.org/publicdomain/zero/1.0/",
    },
  ],
  async prepare(o) {
    if (!SONG.sample) {
      const { samples, rate } = parseWav(await readBytes("../../assets/toys/song-landscape/sample.wav")); // prettier-ignore
      SONG.sample = { samples, rate, duration: samples.length / rate, name: "Sample tune" };
    }
    SONG.want = o.song === "custom" && SONG.custom ? SONG.custom : SONG.sample;
    if (!SONG.want.duration) SONG.want.duration = SONG.want.samples.length / SONG.want.rate;
  },
  drive(t, c, out, info) {
    const g = info?.data?.song;
    if (!g) return;
    const on = (c.play ?? 0) > 0.5;
    const pos = playStep(g.song, info.sound, on, info.time);
    const f = clamp01(pos / g.song.duration);
    // The marker glides along the time axis (from near to far), and the view
    // follows it: the whole landscape slides toward you by half as far as the
    // marker goes, so the marker sweeps only half the landscape's length on
    // screen (the camera glide).
    out.parts.marker = { offset: [0, 0, -f * g.D] };
    out.body = { offset: [0, 0, ((f - 0.5) * 0.5 * g.D * g.fit) / (info.R || 1)] };
  },
  build(k, o) {
    const song = SONG.want || SONG.sample;
    SONG.current = song;
    const budget = Math.floor(k.count * 0.3); // cells rise in up to three layers
    const d = landscapeData(song.samples, song.rate, budget);
    const D = landscapeLength(d.duration);
    const { nf, nt } = d;
    const cw = W / nf;
    const cd = D / nt;
    const sizeOf = (span) => (span * 1.5) / 0.025;
    const x = (f) => (f / (nf - 1) - 0.5) * W;
    const z = (t) => D / 2 - ((t + 0.5) / nt) * D;
    const hAt = (t, f) => d.height[Math.min(nt - 1, Math.max(0, t)) * nf + Math.min(nf - 1, Math.max(0, f))]; // prettier-ignore
    // The landscape's splats: the top of every cell, and (for a cell that rises)
    // one or two lower down, so a ridge seen from the side is a wall.
    const cells = [];
    for (let t = 0; t < nt; t++)
      for (let f = 0; f < nf; f++) {
        const h = hAt(t, f);
        // Slopes give the surface its normal, for a little light and shade.
        const sx = ((hAt(t, f + 1) - hAt(t, f - 1)) * H) / (2 * cw);
        const sz = ((hAt(t - 1, f) - hAt(t + 1, f)) * H) / (2 * cd);
        const nl = Math.hypot(sx, 1, sz);
        const nrm = [(-sx * 0.4) / nl, 1 / nl, (-sz * 0.4) / nl];
        const col = songColor(o.look, f, nf, h);
        const layers = h > 0.06 ? 1 + Math.min(2, Math.floor((h * H) / 0.12)) : 1;
        for (let l = 0; l < layers; l++) {
          const y = h * H * (1 - l / layers) + 0.01;
          cells.push({
            p: [x(f), y, z(t)],
            n: l === 0 ? nrm : [0, 0, 1],
            color: l === 0 ? col : shade(col, 0.8),
            size: sizeOf(Math.max(cw, cd * (l === 0 ? 1 : 1.5))),
            flat: 0.05,
            opacity: 0.98,
            part: 0,
          });
        }
      }
    sheet(k, { x0: -W / 2 - 0.08, x1: W / 2 + 0.08, z0: -D / 2 - 0.08, z1: D / 2 + 0.08, y: -0.005, cells: k.count * 0.08, color: () => "#2a303a" }); // prettier-ignore
    const share = Math.min(0.85, cells.length / k.count);
    k.cloud({ share, pattern: false }, (rand, i) => cells[i] || null);
    // The waveform runs along the left edge: the song's swing (from where
    // the samples are) at every slice, mirrored about a line at mid-height.
    const wave = [];
    const stepN = Math.max(1, Math.floor(song.samples.length / (nt * 2)));
    for (let t = 0; t < nt * 2; t++) {
      let peak = 0;
      for (let i = t * stepN; i < Math.min(song.samples.length, (t + 1) * stepN); i++) peak = Math.max(peak, Math.abs(song.samples[i])); // prettier-ignore
      wave.push(peak);
    }
    const wmax = Math.max(1e-6, ...wave);
    const wcells = [];
    for (let t = 0; t < wave.length; t++) {
      const zz = D / 2 - ((t + 0.5) / wave.length) * D;
      const a = (wave[t] / wmax) * 0.3;
      for (const sgn of [1, -1])
        wcells.push({ p: [-W / 2 - 0.18, 0.4 + sgn * a, zz], color: "#d9a520", size: sizeOf(cd * 3), opacity: 1, part: 0, pattern: false }); // prettier-ignore
      wcells.push({ p: [-W / 2 - 0.18, 0.4, zz], color: "#8a93a6", size: sizeOf(cd * 2), opacity: 1, part: 0, pattern: false }); // prettier-ignore
    }
    k.cloud({ share: wcells.length / k.count, pattern: false }, (rand, i) => wcells[i] || null);
    // The marker: a glowing line across the landscape at the start of the song.
    const marker = k.part("marker");
    const mk = [];
    for (let i = 0; i < 160; i++) {
      const xx = ((i + 0.5) / 160 - 0.5) * (W + 0.1);
      mk.push({ p: [xx, 0.02, D / 2], color: "#fff3b0", size: 1.1, opacity: 1, part: marker, pattern: false }); // prettier-ignore
      if (i % 4 === 0) mk.push({ p: [xx, 0.5 * H, D / 2], color: "#ffe680", size: 0.9, opacity: 0.55, part: marker, pattern: false }); // prettier-ignore
    }
    k.cloud({ share: mk.length / k.count, pattern: false }, (rand, i) => mk[i] || null);
    k.reach([0, H + 0.2, -D / 2 - 0.1]);
    // The fit's scale (src/kit.js scales the toy to a sphere of radius 0.95
    // about its middle), so drive can turn recipe lengths into toy lengths.
    const yTop = H + 0.2;
    const rmax = Math.hypot(W / 2 + 0.18, (yTop + 0.035) / 2, D / 2 + 0.1);
    k.data = { song: { song, D, nf, nt, top: d.top, fit: 0.95 / rmax } };
  },
};

const clamp01 = (x) => (x < 0 ? 0 : x > 1 ? 1 : x);

export const RECIPES = {
  "song-landscape": SONG_LANDSCAPE,
  "chladni-plate": CHLADNI,
};
