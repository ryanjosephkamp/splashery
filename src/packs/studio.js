// Studio (lane Studio Sound, "Sound you can see"): toys that turn sound into
// something you can see. Two labs toys for now: the song landscape (a real
// spectrogram of a song you open, as a 3D field of splats) and the Chladni
// plate (sand on a bowed metal plate finding the plate's still lines).

import { mix, shade, clamp, ramp } from "../kit.js";
import {
  spectrogram,
  landscapePlan,
  toMono,
  bands,
  DB_FLOOR,
  F_MIN,
  F_MAX,
} from "./studio-audio.js";
// Lane Live input: the microphone (src/live/), only once someone taps for it.
import { live as liveIn, stop as liveStop } from "../live/live.js";
import { bandLevels, noteOf } from "../live/analysis.js";
import { reliefGrid } from "../live/relief.js";
// Lane Live input r2: a long song plays at once and is measured in a worker;
// the measured looks (Ribbons, Tube, Lines, Mesh).
import { Track, SongAnalysis } from "./song-stream.js";
import { LOOKS, buildLook, drawLook, lookMotion, lookVersion, buildLandscapeLong, drawLandscapeLong, landscapeCaps, liveOffset } from "./song-looks.js"; // prettier-ignore
import { HOP as FRAME, F as FIELD, FIELDS } from "./song-analysis.js";
import { MicRecorder, wavBlob, saveBlob, songTransport } from "./song-record.js";
// Lane Live r7: the Chladni plate's sand moves live, every frame.
import { Sand } from "./chladni-sand.js";

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
function sheet(k, { x0, x1, z0, z1, y, cells, color, part = 0, opacity = 1, extra = null }) {
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
        list.push({ p: [x, y, z], n: [0, 1, 0], flat: 0.02, size, opacity, color: color(x, z), part, pattern: false, ...(extra ? extra(x, z) : null) }); // prettier-ignore
      }
  // Exact sizes and colors (no jitter): smooth, not grainy (lane Live input r2).
  k.cloud(
    { share: list.length / k.count, pattern: false, jitter: 0 },
    (rand, i) => list[i] || null,
  );
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
const STIR_SECS = 1.2; // Live r7: a tap on a formed figure stirs the sand this long
const SAND_LIFT = PLATE + 0.06; // the grains' offsets reach this far (recipe units)

// Sound and drive state for the tap (one toy at a time).
const CH = { last: null, taps: 0, bowUntil: 0, stirUntil: 0, frames: 0, amp: new Map(), sorted: -1, unsorted: false }; // prettier-ignore

// Live r7: the live sand and its canvas (the toy's screen: each grain's
// color on the left, its offset from where it rests on the right).
const SAND = { sand: null, cols: 1, rows: 1, home: null, colors: null, img: null, version: 0 };

// The modes' strengths follow the sound within about 80 ms, so the sand
// answers a new note at once and stops when the sound does. want: the
// strengths the sound asks for now ([{ mode, a }]); modes that ring at one
// frequency are one entry. Returns them as the sand takes them.
function followDrive(want, dt) {
  const k = 1 - Math.exp(-dt / 0.08);
  const seen = new Set();
  for (const w of want) {
    const key = w.mode.id;
    seen.add(key);
    const was = CH.amp.get(key) ?? { mode: w.mode, a: 0 };
    was.mode = w.mode;
    was.a += (w.a - was.a) * k;
    CH.amp.set(key, was);
  }
  for (const [key, v] of CH.amp) {
    if (seen.has(key)) continue;
    v.a -= v.a * k;
    if (v.a < 1e-3) CH.amp.delete(key);
  }
  return [...CH.amp.values()].map((v) => ({ n: v.mode.n, m: v.mode.m, s: v.mode.s, a: v.a, mode: v.mode })); // prettier-ignore
}

// The sand's canvas: colors once, offsets on every change.
const sandScreen = {
  get width() {
    return SAND.cols * 2;
  },
  get height() {
    return SAND.rows;
  },
  version: (time) =>
    SAND.sand?.moving ? `${SAND.version}|${Math.floor(time * 60)}` : SAND.version,
  draw(g, time) {
    const { sand, cols, rows, home, colors } = SAND;
    if (!sand) return;
    if (!SAND.img || SAND.img.width !== cols * 2 || SAND.img.height !== rows) {
      SAND.img = g.createImageData(cols * 2, rows);
      const px = SAND.img.data;
      for (let i = 0; i < sand.n; i++) {
        const c = mix("#e9d8ac", "#f8efd2", colors[i]).map((v) => Math.round(v * 255));
        const o = (Math.floor(i / cols) * cols * 2 + (i % cols)) * 4;
        px[o] = c[0];
        px[o + 1] = c[1];
        px[o + 2] = c[2];
        px[o + 3] = 255;
      }
    }
    const px = SAND.img.data;
    const q = 255 / (2 * SAND_LIFT);
    const { X, Y, hop, phase } = sand;
    for (let i = 0; i < sand.n; i++) {
      const o = (Math.floor(i / cols) * cols * 2 + cols + (i % cols)) * 4;
      const up = hop[i] > 0 ? HOP * hop[i] * Math.abs(Math.sin(phase[i] + time * 23)) : 0;
      px[o] = 127.5 + ((X[i] * 2 - 1) * PLATE - home[i * 2]) * q;
      px[o + 1] = 127.5 + up * q;
      px[o + 2] = 127.5 + ((Y[i] * 2 - 1) * PLATE - home[i * 2 + 1]) * q;
      px[o + 3] = 255;
    }
    g.putImageData(SAND.img, 0, 0);
  },
};

function chladniCue(mode, on) {
  const f = modeFreq(mode);
  if (on)
    return [
      { voice: "tone", f, decay: 9, kind: "sine", vol: 0.9 },
      { voice: "tone", f: f * 2, decay: 9, kind: "triangle", vol: 0.12 },
      // Sound B: the sand slides as it settles, not a patter of clicks.
      { voice: "breath", at: 0.1, f: 2600, to: 0.8, decay: 3, vol: 0.25 },
    ];
  return [{ voice: "hiss", f: 3000, decay: 0.7, vol: 0.3 }];
}

const CHLADNI = {
  // Lane Live input r3: tilt to see the plate from the side (above the stage only).
  tiltLock: false,
  pitchRange: [0.05, 1.35],
  // Live r7: while the sand moves, a tap bows or stirs it, or sound drives it.
  alive: () => !!SAND.sand?.moving || CH.bowUntil > (CH.last ?? 0) || CH.stirUntil > (CH.last ?? 0) || liveIn.on("mic") || !!CHF.song?.track?.playing || CH.amp.size > 0, // prettier-ignore
  screen: sandScreen,
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
  action: {
    key: "bow",
    label: "Bow the plate",
    quiet: ["bow"],
    // Lane Live input r4: with your audio open, a tap plays or pauses it
    // (inside the tap itself, as a phone wants).
    onAct() {
      const t = CHF.song?.track;
      if (!t || liveIn.on("mic")) return;
      if (t.playing) t.pause();
      else t.play(CHF.sound);
    },
  },
  // Lane Live input: sing to the plate; r4, or play your own audio to it.
  input: {
    title: "Sing or play to the plate",
    accept: "audio/*,.mp3,.wav,.ogg,.m4a,.flac,.aac,.opus",
    binary: true,
    maxBytes: 400e6, // as the Song landscape: it plays from the file
    fileButton: "Open your own audio…",
    async read(_text, fileName, file) {
      return openChladniAudio(file, fileName);
    },
    shown: () => chladniShown(),
    live: [
      { render: () => songTransport(chladniTransport) },
      { kind: "mic", rebuild: false, status: singStatus },
    ],
    note: "Tap “Use my microphone” and sing a steady note, or open a song or any sound file. The plate listens as a thinner plate would, with its modes at 75, 150, 195, 255 and 375 Hz: the mode nearest the note rings, and the sand settles into its figure. Change the note and another mode takes over, with fresh sand. A song's strongest pitch, moved by octaves into the plate's range, drives it as it plays; the file stays on your device.",
  },
  drive(t, c, out, info) {
    const g = info?.data?.chladni;
    if (!g) return;
    if (info?.sound) CHF.sound = info.sound; // r4: for a tap's onAct
    const time = info.time ?? t;
    const dt = CH.last === null ? 0 : Math.min(0.1, Math.max(0, time - CH.last));
    CH.last = time;
    // Lane Live input: while the microphone is on, your voice drives the
    // plate; r4: otherwise your audio, while it is open.
    const sung = liveIn.on("mic");
    if (sung && CHF.song?.track?.playing) CHF.song.track.pause();
    const played = !sung && !!CHF.song;
    // Live r7: a tap bows the plate (or, once its figure has formed, stirs
    // the sand up again), but only with no audio and no microphone: then the
    // tap plays or pauses the audio, and the bow never shows (the owner's
    // report of October 5, 2026).
    const n = info.tap?.n ?? 0;
    if (n < CH.taps) CH.taps = 0;
    if (n > CH.taps) {
      CH.taps = n;
      if (!sung && !played) {
        const settled = SAND.sand ? SAND.sand.settled(g.mode) : 0;
        if (settled > 0.6) {
          CH.stirUntil = time + STIR_SECS;
          CH.bowUntil = 0;
          for (const q of chladniCue(g.mode, false)) out.cues.push(q);
        } else {
          CH.bowUntil = time + BOW_SECS;
          CH.stirUntil = 0;
          for (const q of chladniCue(g.mode, true)) out.cues.push(q);
        }
      }
    }
    if (sung || played) CH.bowUntil = CH.stirUntil = 0;
    const bowing = time < CH.bowUntil;
    const stirring = time < CH.stirUntil;
    // The modes as the sound drives them (or the bow, its own mode).
    const want = sung ? singDrive(time, g.mode) : played ? fileDrive(time, g.mode) : null;
    const drive = followDrive(want ?? (bowing ? [{ mode: g.mode, a: 1 }] : []), dt);
    const stir = stirring ? Math.min(1, (CH.stirUntil - time) / 0.4) : 0;
    if (SAND.sand && SAND.sand.step(dt, drive, stir)) {
      SAND.version++;
      // The grains sort where they are now, not where they rest (the engine
      // reads their offsets from the screen), a few times a second while
      // they move and once when they stop.
      if (time - CH.sorted > 0.15) {
        CH.sorted = time;
        out.resortPose = true;
      }
      CH.unsorted = true;
    } else if (CH.unsorted) {
      CH.unsorted = false;
      out.resortPose = true;
    }
    // How settled the sand is on the leading mode (for the status line and
    // the tests), now and then.
    if (SAND.sand && (CH.frames++ % 8 === 0 || !SAND.sand.moving)) {
      const lead = drive.reduce((b, d) => (!b || d.a > b.a ? d : b), null);
      if (lead && lead.a > 0.05) SING.lead = lead.mode;
      SING.p = SAND.sand.settled(SING.lead || g.mode);
    }
    // The bow is drawn along the front edge only while a tap bows or stirs.
    // Its splats fade in by morph channel 1, which is 0 until the drive says
    // so, so a plate just built never shows it either.
    const show = bowing || stirring;
    out.morph = [0, show ? 1 : 0, 0, 0];
    out.parts.bow = {
      visible: show ? 1 : 0,
      offset: [0, 0.38 * Math.sin(t * 7) * (show ? 1 : 0), 0],
    };
    // The plate itself shivers a hair while it rings.
    const ring = drive.reduce((s2, d) => Math.max(s2, d.a), 0);
    out.parts.plate = { offset: [0, 0.006 * Math.sin(t * 90) * ring, 0] };
  },
  build(k, o) {
    const mode = modeById(o.mode);
    // Lane Live input: a new plate's sand starts scattered.
    Object.assign(SING, { p: 0, want: null, asked: false, last: null, lead: null });
    SING.builds++;
    Object.assign(CH, { last: null, bowUntil: 0, stirUntil: 0, frames: 0, amp: new Map(), sorted: -1, unsorted: true }); // prettier-ignore
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
    // Live r7: it fades in by morph channel 1, which stays 0 unless a tap
    // bows the plate, so it never shows by default (not on a rebuild's first
    // frames either).
    const hidden = { kind: "fade", params: [0.5, -0.02], channel: 1 };
    k.add(k.box(0.05, 1.5, 0.05), {
      pos: [0.15, 0.0, PLATE + 0.16],
      rot: [0, 0, 0],
      color: "#6a4a30",
      part: bow,
      share: 0.02,
      ...hidden,
    });
    k.add(k.box(0.012, 1.45, 0.11), {
      pos: [0.15, 0.0, PLATE + 0.06],
      color: "#efe6d0",
      part: bow,
      share: 0.015,
      ...hidden,
    });
    // Live r7: the sand, one relief splat per grain (chladni-sand.js moves
    // them). Each rests a hair from the plate's middle (a different hair for
    // each, so the canvas's steps of 1/255 don't line grains up) and the
    // screen canvas moves it to its place: a signed offset of up to SAND_LIFT.
    const n = Math.max(2500, Math.min(14000, Math.floor(k.count * 0.06)));
    const sand = new Sand(n, () => k.rand());
    const cols = Math.min(256, Math.ceil(Math.sqrt(n * 2)));
    const rows = Math.ceil(n / cols);
    const home = new Float32Array(n * 2);
    const items = [];
    for (let i = 0; i < n; i++) {
      home[i * 2] = (k.rand() - 0.5) * 0.06;
      home[i * 2 + 1] = (k.rand() - 0.5) * 0.06;
      const tone = k.rand();
      items.push({ p: [home[i * 2], GRAIN_LIFT, home[i * 2 + 1]], color: mix("#e9d8ac", "#f8efd2", tone), tone, size: 0.5 + 0.4 * tone, opacity: 0.98, kind: "relief", params: [((i % cols) + 0.5) / cols, (Math.floor(i / cols) + 0.5) / rows, 3, SAND_LIFT], part: plate, pattern: false }); // prettier-ignore
    }
    k.cloud({ share: n / k.count, size: 0.5, pattern: false, jitter: 0 }, (rand, i) => items[i] || null); // prettier-ignore
    Object.assign(SAND, { sand, cols, rows, home, colors: items.map((it) => it.tone), img: null, version: SAND.version + 1 }); // prettier-ignore
    k.reach([0, HOP + 0.3, 0]);
    k.data = { chladni: { mode } };
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
//
// View: Live (lane Song live). The landscape scrolls like an audio tool's waterfall while
// the song plays: the whole landscape slides toward you as one solid piece, so the part
// playing now sits on a fixed line at the front and the next seconds come toward you from
// the back. What has played fades away as it crosses the line (the fade kind, driven by
// morph channel 0 = how far through the song). Loud bands rise at the line: 48 small
// caps (tokens) ride the loudness the song has at that moment.
//
// Live r7: in the browser, Live now grows the land as the song plays instead
// (song-looks.js buildLandscapeLong): it opens on an empty plain, each moment
// rises at the line at the front as it is heard, and what has played
// recedes behind it. The scrolling build below remains for a build without a
// worker (the Node tools); Whole song is unchanged.

export const DB_RANGE = 45;
const W = 2; // width (pitch axis)
const H = 0.75; // the loudest point's height
const SONG = { current: null, sample: null, custom: null, want: null };
// What playing needs from the page: the song's samples, and the sound
// (src/sound.js's Sound, which the drive's info hands over as info.sound).
const PLAY = {
  on: false,
  want: false,
  pos: 0,
  last: null,
  src: null,
  start: 0,
  ctx: null,
  taps: 0,
};

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
export const playState = () => {
  const t = SONG.current?.track;
  if (t) return { on: t.playing, pos: t.time(), audio: !!t.src, long: true }; // lane Live input r2
  return { on: PLAY.on, pos: PLAY.pos, audio: !!PLAY.src };
};

// ---- Lane Live input r2: long songs, measured looks -----------------------------------
// A song longer than SHORT seconds plays from the file itself as soon as it
// opens (song-stream.js Track) and is measured in a worker while it plays;
// a short one (the sample, a clip) is decoded and built at once, as before.
// Every song also gets the worker's frame-by-frame measurements for the
// measured looks (song-looks.js).
export const SHORT = 30;
export const MAX_BYTES = 400e6;
const R2 = { look: null, land: null, an: null, anFor: null, actN: 0, lastShown: "" };

export const songAnalysisStarted = () => R2.an?.started;
// For the sync test: what the look last drew at its "now" mark.
export const songShown = () => R2.look?.shown ?? null;
export const r2Land = () => R2.land;
export const songTest = () => ({
  track: SONG.current?.track ?? null,
  features: R2.an?.features ?? null,
});

// For the tests: how far the song on show has been measured.
export const songAnalysisState = () => {
  const an = R2.an;
  return { progress: an?.progress ?? 0, finished: !!an?.finished, error: an?.error ?? null, doneMs: an?.doneMs ?? 0, marks: an?.marks, look: R2.look?.look ?? null, land: !!R2.land }; // prettier-ignore
};

// The analysis for the song on show (started once per song). A song over
// 12 minutes is measured from a copy at 32 kHz, which halves its memory.
function analysisFor(song) {
  if (!song || typeof Worker === "undefined") return null;
  if (R2.anFor === song && R2.an) return R2.an;
  R2.an?.close();
  const an = new SongAnalysis();
  R2.an = an;
  R2.anFor = song;
  (song.long
    ? an.start(song.file, song.duration > 720 ? 32000 : 44100)
    : an.start(song.samples, song.rate)
  ).catch((err) => {
    an.error = err?.message || String(err);
  });
  return an;
}

// What the song's audio clock says is being heard now (seconds).
function heardNow() {
  const t = SONG.current?.track;
  if (t) return t.time();
  const lat = PLAY.ctx ? (PLAY.ctx.outputLatency || 0) + (PLAY.ctx.baseLatency || 0) : 0;
  return PLAY.on ? Math.max(0, PLAY.pos - lat) : PLAY.pos;
}

// A line under the input panel (the analysis' progress), set straight on the
// panel's own line while it shows.
function setShown(text) {
  if (typeof document === "undefined" || text === R2.lastShown) return;
  const el = document.querySelector("#toy-input .input-shown");
  if (!el) return;
  R2.lastShown = text;
  el.textContent = text;
  el.hidden = !text;
}

function progressLine() {
  const song = SONG.current;
  const an = R2.an;
  if (!song) return "";
  const name = `${song.name} (${Math.round(song.duration)} s)`;
  if (!an || an.finished || (!song.long && R2.look === null)) return name;
  if (an.error)
    return `${name}. The picture couldn't be measured (${an.error}); the sound still plays.`;
  return `${name}. Measuring the picture: ${Math.round(an.progress * 100)}%`;
}

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
      // The song is over: play state resets, so the next tap plays it again.
      PLAY.pos = song.duration;
      PLAY.on = false;
      PLAY.want = false;
      PLAY.src = null;
      PLAY.ctx = null;
    }
  }
  return PLAY.pos;
}

// Lane Live input r2: a measured look (any song), or a long song's
// landscape, filled in from the worker's frames as they come.
function buildR2(k, o, song) {
  stopShort();
  const live = o.view === "live";
  const an = analysisFor(song);
  const nf = an?.features?.nf ?? 104;
  if (LOOKS.includes(o.look)) {
    R2.look = buildLook(k, o.look, { view: o.view, backdrop: o.backdrop, nf });
    R2.look.backdrop = o.backdrop;
  } else {
    R2.land = buildLandscapeLong(k, { nf, duration: song.duration, look: o.look, live, W, H, songColor }); // prettier-ignore
  }
  k.data = { song: { r2: true, song, live, look: o.look, D: R2.land?.D ?? 0 } };
}

// A short song's player, stopped (a new build starts stopped).
function stopShort() {
  const keep = R3.keep; // r3: the same song keeps its place
  try {
    PLAY.src?.stop();
  } catch {
    // Already ended.
  }
  Object.assign(PLAY, {
    on: false,
    want: false,
    pos: 0,
    last: null,
    src: null,
    ctx: null,
    taps: 0,
  });
  if (keep) Object.assign(PLAY, keep);
}

function driveR2(g, out, info) {
  const song = g.song;
  const t = song.track;
  playAfter(song, info.sound); // r3
  // Each tap plays or pauses. A long song's tap already did it inside the
  // gesture (action.onAct); a tap that came some other way does it here.
  const n = info.tap?.n ?? 0;
  if (n < PLAY.taps) PLAY.taps = 0;
  if (n > PLAY.taps) {
    PLAY.taps = n;
    if (R2.actN > 0) R2.actN = 0;
    else if (t) t.playing ? t.pause() : t.play(info.sound);
    else PLAY.want = !PLAY.on;
  }
  if (!t) playStep(song, info.sound, PLAY.want, info.time);
  const now = heardNow();
  R2.an?.focus(Math.floor(now / FRAME));
  const duration = song.duration || 1;
  if (R2.look) {
    const m = lookMotion(R2.look, now, duration);
    out.parts.look = { offset: m.look };
    out.parts.gate = { offset: m.gate };
  } else if (R2.land) {
    const f = clamp01(now / duration);
    if (g.live) {
      // Live r7: the land slides back over the plain, which stays put; splats
      // sort where they were built, so they sort again as it slides (the
      // plain drew over the land otherwise).
      const off = liveOffset(R2.land, now, duration);
      out.parts.look = { offset: [0, 0, off] };
      if (Math.abs(off - (R2.land.sortedAt ?? Infinity)) > 0.02) {
        R2.land.sortedAt = off;
        out.resortPose = true;
      }
      const caps = landscapeCaps(R2.land, R2.an, now);
      if (caps) out.tokens = caps;
    } else out.parts.marker = { offset: [0, 0, -f * g.D] };
  }
  setShown(progressLine());
}

// ---- Lane Live input r3: the recording and the transport ------------------------------
// While the microphone is on, what it hears is kept in memory (song-record.js);
// when it stops, the recording becomes the song on show, to play back, scrub
// and save. The transport in the Toy tab starts over, plays or pauses, scrubs
// and switches Live and Whole.
const REC = { rec: null, last: null, song: null };
const R3 = { view: "live", playAfter: false };

export const recordState = () => ({
  recording: REC.rec?.seconds ?? 0,
  recorded: REC.last?.duration ?? 0,
  onRecording: !!REC.song && SONG.current === REC.song,
});

// The recording as a song: a short one decoded at once, a long one played
// from a WAV file in memory like an opened song.
async function recordingSong() {
  if (REC.song) return REC.song;
  const r = REC.last;
  const name = "Your recording";
  if (r.duration > SHORT && typeof Audio !== "undefined") {
    const file = new File([wavBlob(r.samples, r.rate)], "recording.wav", { type: "audio/wav" });
    const url = URL.createObjectURL(file);
    const track = new Track(url);
    const duration = await track.ready;
    REC.song = { long: true, file, url, track, name, duration };
  } else REC.song = { samples: r.samples, rate: r.rate, duration: r.duration, name };
  return REC.song;
}

function dropRecording() {
  const s = REC.song;
  if (s?.track) {
    s.track.close();
    URL.revokeObjectURL(s.url);
  }
  REC.song = null;
  REC.last = null;
}

const wake = () => liveIn.wake?.();

function songSeek(sec) {
  const s = SONG.current;
  if (!s) return;
  const x = Math.max(0, Math.min(s.duration || 0, sec));
  if (s.track) {
    s.track.el.currentTime = x;
    s.track.anchor = null;
  } else {
    PLAY.pos = x;
    if (PLAY.on) {
      // Restarted from there on the next frame (want stays on).
      try {
        PLAY.src?.stop();
      } catch {
        // Already ended.
      }
      Object.assign(PLAY, { on: false, src: null, ctx: null });
    }
  }
  wake();
}

const songPlaying = () => {
  const t = SONG.current?.track;
  return t ? t.playing : PLAY.want;
};

function songPlay(on) {
  const t = SONG.current?.track;
  if (t) {
    if (on && !t.playing) t.play(R2.sound);
    if (!on && t.playing) t.pause();
  } else PLAY.want = on;
  wake();
}

export const transport = {
  state() {
    const mic = liveIn.on("mic");
    const s = SONG.current;
    return {
      pos: mic || !s ? 0 : heardNow(),
      length: mic ? 0 : s?.duration || 0,
      playing: !mic && songPlaying(),
      live: R3.view === "live",
      mic,
      ...recordState(),
    };
  },
  toStart() {
    songSeek(0);
    songPlay(true);
  },
  toggle() {
    songPlay(!songPlaying());
  },
  seek: songSeek,
  setLive(on) {
    liveIn.setOptions?.({ view: on ? "live" : "whole" });
  },
  playRecording() {
    if (!REC.last) return;
    if (SONG.current === REC.song && REC.song) {
      songSeek(0);
      return songPlay(true);
    }
    R3.playAfter = true;
    liveIn.setOptions?.({ song: "recording", songName: "Your recording" });
  },
  saveRecording() {
    if (!REC.last) return;
    const d = new Date();
    const p = (n) => String(n).padStart(2, "0");
    const stamp = `${d.getFullYear()}${p(d.getMonth() + 1)}${p(d.getDate())}-${p(d.getHours())}${p(d.getMinutes())}${p(d.getSeconds())}`; // prettier-ignore
    saveBlob(wavBlob(REC.last.samples, REC.last.rate), `splashery-recording-${stamp}.wav`);
  },
};

// A song built with "play after" set starts at once (the recording's button).
function playAfter(song, sound) {
  if (!R3.playAfter || song !== REC.song) return;
  R3.playAfter = false;
  if (song.track) song.track.play(sound);
  else PLAY.want = true;
}

const SONG_LANDSCAPE = {
  // Lane Live input r3: tilt up and down, from a level look to one from above.
  tiltLock: false,
  pitchRange: [0.05, 1.35],
  // Lane Live input: the microphone; r2: a long song's track, and the
  // picture filling in while the song is measured.
  alive: () => PLAY.on || liveIn.on("mic") || !!SONG.current?.track?.playing || !!(R2.an && !R2.an.finished && (R2.look || R2.land)), // prettier-ignore
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
        // Lane Live input r2: the measured looks.
        { id: "ribbons", label: "Ribbons (six bands, bass to treble)" },
        { id: "tube", label: "Tube (loudness, pitch and brightness)" },
        { id: "lines", label: "Lines (the spectrum, frame by frame)" },
        { id: "mesh", label: "Mesh (the spectrum as a wireframe)" },
      ],
    },
    {
      key: "view",
      label: "View",
      type: "select",
      default: "live",
      choices: [
        { id: "live", label: "Live (scrolls with the music)" },
        { id: "whole", label: "Whole song" },
      ],
    },
    {
      // Lane Live input r2: the line looks on a cream paper card, or alone.
      key: "backdrop",
      label: "Background (line looks)",
      type: "select",
      default: "paper",
      choices: [
        { id: "paper", label: "Paper" },
        { id: "none", label: "None" },
      ],
    },
    { key: "song", label: "Song", type: "text", default: "sample", hidden: true },
    { key: "songName", label: "Song name", type: "text", default: "", hidden: true },
  ],
  controls: [{ key: "play", label: "Play", type: "pulse", ease: 0.3 }],
  action: {
    key: "play",
    label: "Play or pause the song",
    quiet: ["play"],
    // Lane Live input r2: a long song's audio starts inside the tap itself
    // (a phone lets a sound start only there); the drive then only follows.
    onAct() {
      const t = SONG.current?.track;
      if (!t || liveIn.on("mic")) return;
      if (t.playing) t.pause();
      else t.play(R2.sound);
      R2.actN++;
    },
  },
  // Your own song: opened with the Toy tab's panel (a file the browser can
  // decode), read on this device.
  input: {
    title: "Your own song",
    accept: "audio/*,.mp3,.wav,.ogg,.m4a,.flac,.aac,.opus",
    binary: true,
    fileButton: "Open a song…",
    note: "Open an MP3, WAV, OGG, M4A or FLAC file. A long song starts playing at once, exactly as the file sounds, while its picture is measured on this device (the line under it shows how far); nothing is uploaded. Tap the picture to pause or play; the buttons above start over, pause, scrub and switch between Live and the whole song.",
    maxBytes: MAX_BYTES, // lane Live input r2: a long song streams from the file
    async read(_text, fileName, file) {
      if (!file) throw new Error("Open a sound file.");
      const name = fileName.replace(/\.[^.]+$/, "");
      // Lane Live input r2: the browser reads the file's header (its length)
      // first, which is quick; a short sound is then decoded and built at
      // once as before, a long one plays from the file while it is measured.
      if (typeof Audio !== "undefined" && typeof URL?.createObjectURL === "function") {
        const url = URL.createObjectURL(file);
        const track = new Track(url);
        let duration;
        try {
          duration = await track.ready;
        } catch (err) {
          track.close();
          URL.revokeObjectURL(url);
          throw err;
        }
        if (duration > SHORT && Number.isFinite(duration)) {
          if (SONG.custom?.url) SONG.custom.track?.close();
          SONG.custom = { long: true, file, url, track, name, duration };
          // It plays now, while the landscape is built around it (a browser
          // that wants a fresh tap first gets it: the next tap plays it).
          track.play(R2.sound);
          return { song: "custom", songName: name };
        }
        track.close();
        URL.revokeObjectURL(url);
      }
      const s = await decodeSound(file);
      if (s.samples.length / s.rate < 0.5) throw new Error("That sound is too short.");
      SONG.custom = { ...s, name };
      return { song: "custom", songName: SONG.custom.name };
    },
    shown: () =>
      liveIn.on("mic") ? "Live: what the microphone hears now is at the front." : SONG.current ? `${SONG.current.name} (${Math.round(SONG.current.duration)} s)` : "", // prettier-ignore
    // Lane Live input: the microphone instead of a file; r3, the transport
    // and the recording (kept in memory, saved only on a tap).
    live: [
      { render: () => songTransport(transport) },
      {
        kind: "mic",
        note: "Stays on this device. While the microphone is on, what it hears is kept in this page's memory so you can play it back. Nothing is sent, and it's saved only if you tap Save the recording.",
      },
    ],
  },
  // Lane Live input: the live landscape's heights and colors; r2: the
  // measured looks' and a long song's landscape's places and colors.
  screen: {
    get width() {
      const L = R2.look || R2.land;
      return L ? L.atlas.cols * 2 : LIVE_SONG.nf * 2;
    },
    get height() {
      const L = R2.look || R2.land;
      return L ? L.atlas.rows : LIVE_SONG.nt;
    },
    version(time) {
      if (liveIn.on("mic")) return Math.floor(time * LIVE_SONG.rate);
      if (R2.look) return lookVersion(R2.look, R2.an, heardNow());
      // Live r7: in Live the land grows with every frame heard.
      if (R2.land) return `${R2.an?.version ?? -1}|${R2.land.live ? Math.floor(heardNow() / FRAME) : 0}`; // prettier-ignore
      return "off";
    },
    draw(g, time) {
      if (liveIn.on("mic")) return liveSongDraw(g, time);
      if (R2.look) return drawLook(g, R2.look, R2.an, heardNow(), { backdrop: R2.look.backdrop });
      if (R2.land) return drawLandscapeLong(g, R2.land, R2.an, heardNow(), SONG.current?.duration || 0); // prettier-ignore
    },
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
    if (o.song === "recording" && REC.last) SONG.want = await recordingSong(); // r3
    if (!SONG.want.duration) SONG.want.duration = SONG.want.samples.length / SONG.want.rate;
  },
  drive(t, c, out, info) {
    if (info?.sound) R2.sound = info.sound; // lane Live input r2: for a tap's onAct
    const g = info?.data?.song;
    if (!g || g.liveMic) return; // lane Live input: the microphone's landscape moves by itself
    if (g.r2) return driveR2(g, out, info); // lane Live input r2
    playAfter(g.song, info.sound); // r3    // Each tap plays or pauses (a song that has ended plays again from the start).
    const n = info.tap?.n ?? 0;
    if (n < PLAY.taps) PLAY.taps = 0;
    if (n > PLAY.taps) {
      PLAY.taps = n;
      PLAY.want = !PLAY.on;
    }
    const pos = playStep(g.song, info.sound, PLAY.want, info.time);
    const f = clamp01(pos / g.song.duration);
    if (g.live) {
      // Live: the whole landscape slides toward you as one piece, by exactly as far as the song
      // has gone, so the part playing now stays on the fixed line at the front. The marker and
      // the loudness caps stay on that line (they move back by what the landscape moved).
      out.body = { offset: [0, 0, (f * g.D * g.fit) / (info.R || 1)] };
      out.morph = [f, 0, 0, 0]; // channel 0 clears what has played
      out.parts.marker = { offset: [0, 0, -f * g.D] };
      const tt = f * g.nt - 0.5;
      const t0 = Math.floor(tt);
      const u = tt - t0;
      out.tokens = g.caps.map((cap) => {
        let h = 0;
        for (let b = cap.f0; b < cap.f1; b++) h = Math.max(h, (1 - u) * g.hAt(t0, b) + u * g.hAt(t0 + 1, b)); // prettier-ignore
        return { offset: [0, h * H, -f * g.D] };
      });
      return;
    }
    // The marker glides along the time axis (from near to far), and the view
    // follows it: the whole landscape slides toward you by half as far as the
    // marker goes, so the marker sweeps only half the landscape's length on
    // screen (the camera glide).
    out.parts.marker = { offset: [0, 0, -f * g.D] };
    out.body = { offset: [0, 0, ((f - 0.5) * 0.5 * g.D * g.fit) / (info.R || 1)] };
  },
  build(k, o) {
    R3.view = o.view;
    // r3: the microphone's recording. A new one starts with the microphone;
    // when it stops, the recording becomes the song on show.
    if (liveIn.on("mic") && liveIn.mic && REC.rec?.mic !== liveIn.mic) {
      REC.rec?.finish();
      REC.rec = new MicRecorder(liveIn.mic);
    } else if (!liveIn.on("mic") && REC.rec) {
      const r = REC.rec.finish();
      REC.rec = null;
      if (r.duration >= 0.5) {
        dropRecording();
        REC.last = r;
        setTimeout(() => liveIn.setOptions?.({ song: "recording", songName: "Your recording" }), 0); // prettier-ignore
      }
    }
    const song = SONG.want || SONG.sample;
    // r3: the same song rebuilt (another view or look) keeps its place, and
    // keeps playing if it was.
    R3.keep = SONG.current === song ? { pos: PLAY.pos, want: PLAY.want } : null;
    if (SONG.current?.track && SONG.current !== song) SONG.current.track.pause(); // lane Live input r2
    SONG.current = song;
    R2.look = null;
    R2.land = null;
    if (liveIn.on("mic")) return liveSongBuild(k, o); // lane Live input
    // Live r7: Live grows the land as the song plays (the owner's push notes
    // of October 4, 2026), for every song: a short one too is measured by
    // the worker and drawn frame by frame as it is heard. (Without a worker,
    // as in the Node tools, it builds whole as before.)
    const grow = o.view === "live" && typeof Worker !== "undefined";
    if (LOOKS.includes(o.look) || song.long || grow) return buildR2(k, o, song); // lane Live input r2
    // A new build (another song, a look) starts stopped.
    try {
      PLAY.src?.stop();
    } catch {
      // Already ended.
    }
    Object.assign(PLAY, {
      on: false,
      want: false,
      pos: 0,
      last: null,
      src: null,
      ctx: null,
      taps: 0,
    });
    if (R3.keep) Object.assign(PLAY, R3.keep); // r3
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
    const live = o.view === "live";
    // Live: what has played clears as it crosses the front line, over about a second and a half.
    const FADE = Math.min(0.12, 1.5 / d.duration);
    const gone = (tf) => (live ? { kind: "fade", params: [clamp01(tf), FADE], channel: 0 } : null);
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
            ...gone((t + 0.5) / nt),
          });
        }
      }
    sheet(k, { x0: -W / 2 - 0.08, x1: W / 2 + 0.08, z0: -D / 2 - 0.08, z1: D / 2 + 0.08, y: -0.005, cells: k.count * 0.08, color: () => "#2a303a", extra: live ? (xx, zz) => gone((D / 2 - zz) / D) : null }); // prettier-ignore
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
        wcells.push({ p: [-W / 2 - 0.18, 0.4 + sgn * a, zz], color: "#d9a520", size: sizeOf(cd * 3), opacity: 1, part: 0, pattern: false, ...gone((D / 2 - zz) / D) }); // prettier-ignore
      wcells.push({ p: [-W / 2 - 0.18, 0.4, zz], color: "#8a93a6", size: sizeOf(cd * 2), opacity: 1, part: 0, pattern: false, ...gone((D / 2 - zz) / D) }); // prettier-ignore
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
    // Live: the loudness caps. The bands are pooled into up to 48 groups (one token each); a cap is a
    // short bright bar across its group, built on the floor at the front line and lifted by drive to
    // the height the song has there, so the loud bands rise at the line as they play.
    const caps = [];
    if (live) {
      const nc = Math.min(48, nf);
      for (let i = 0; i < nc; i++) caps.push({ f0: Math.floor((i * nf) / nc), f1: Math.floor(((i + 1) * nf) / nc) }); // prettier-ignore
      const cx = (i) => (x(caps[i].f0) + x(caps[i].f1 - 1)) / 2;
      const capW = (W / nc) * 1.05;
      const items = [];
      caps.forEach((cap, i) => {
        for (let j = 0; j < 4; j++) {
          const xx = cx(i) + ((j + 0.5) / 4 - 0.5) * capW;
          items.push({ p: [xx, 0.03, D / 2], n: [0, 1, 0], color: "#fff6c8", size: sizeOf(capW / 4) * 1.15, flat: 0.05, opacity: 1, kind: "token", params: [i, 0], pattern: false }); // prettier-ignore
        }
      });
      k.cloud({ share: items.length / k.count, pattern: false }, (rand, i) => items[i] || null);
    }
    k.reach([0, H + 0.2, -D / 2 - 0.1]);
    // The fit's scale (src/kit.js scales the toy to a sphere of radius 0.95
    // about its middle), so drive can turn recipe lengths into toy lengths.
    const yTop = H + 0.2;
    const rmax = Math.hypot(W / 2 + 0.18, (yTop + 0.035) / 2, D / 2 + 0.1);
    k.data = { song: { song, D, nf, nt, top: d.top, fit: 0.95 / rmax, live, caps, hAt } };
  },
};

const clamp01 = (x) => (x < 0 ? 0 : x > 1 ? 1 : x);

// ---- Live input (lane Live input): the microphone -------------------------------------
// The song landscape, live: with the microphone on, the landscape is what
// you hear now. The front row is this moment (the analyser's spectrum,
// pooled into bands spaced evenly in pitch, low on the left); every
// ROW_RATE-th of a second the rows move one step back, so the last few
// seconds stretch away from you. Heights are loudness in dB (the loudest
// band heard lately at full height, DB_RANGE below it at the floor). The
// splats are relief splats (src/live/relief.js): they are built once and
// take their height and color from a canvas drawn on each frame.
const LIVE_RANGE = 36; // dB from the floor to the top
const LIVE_SONG = {
  nf: 128,
  nt: 150,
  rate: 30, // rows a second
  top: -40, // dB of the loudest band heard lately
  rows: 0, // rows written
  last: null,
  look: "pitch",
  bands: new Float32Array(128),
};

function liveSongBuild(k, o) {
  const { nf, nt } = LIVE_SONG;
  const D = 3.2;
  LIVE_SONG.look = o.look;
  LIVE_SONG.rows = 0;
  LIVE_SONG.last = null;
  const cw = W / nf;
  const cd = D / nt;
  reliefGrid(k, {
    cols: nf,
    rows: nt,
    at: (u, v) => [(u - 0.5) * W, 0.01, D / 2 - v * D],
    axis: 1,
    lift: H,
    n: [0, 1, 0],
    size: Math.max(cw, cd) * 0.7, // finer (r2): smaller, exact splats
    layers: 3,
  });
  sheet(k, { x0: -W / 2 - 0.08, x1: W / 2 + 0.08, z0: -D / 2 - 0.08, z1: D / 2 + 0.08, y: -0.005, cells: k.count * 0.06, color: () => "#2a303a" }); // prettier-ignore
  // Now: a glowing line across the front.
  const mk = [];
  for (let i = 0; i < 160; i++) {
    const xx = ((i + 0.5) / 160 - 0.5) * (W + 0.1);
    mk.push({ p: [xx, 0.02, D / 2 + 0.03], color: "#fff3b0", size: 1.1, opacity: 1, pattern: false }); // prettier-ignore
  }
  k.cloud({ share: mk.length / k.count, pattern: false }, (rand, i) => mk[i] || null);
  k.reach([0, H + 0.2, -D / 2 - 0.1]);
  k.data = { song: { liveMic: true, nf, nt } };
}

// Writes the rows that are due into the landscape's canvas: its colors on
// the left half, heights on the right.
function liveSongDraw(g, time) {
  const { nf, nt } = LIVE_SONG;
  const mic = liveIn.mic;
  const c = g.canvas;
  if (LIVE_SONG.last === null) {
    // Nothing heard yet: every row flat, in the colors of silence.
    for (let f = 0; f < nf; f++) {
      const [r, gg, bb] = songColor(LIVE_SONG.look, f, nf, 0);
      g.fillStyle = `rgb(${Math.round(r * 255)},${Math.round(gg * 255)},${Math.round(bb * 255)})`;
      g.fillRect(f, 0, 1, nt);
    }
    g.fillStyle = "#000";
    g.fillRect(nf, 0, nf, nt);
    LIVE_SONG.last = time;
  }
  let due = Math.min(nt, Math.floor((time - LIVE_SONG.last) * LIVE_SONG.rate));
  if (due <= 0 || !mic) return;
  LIVE_SONG.last += due / LIVE_SONG.rate;
  const b = bandLevels(mic.spectrum, mic.rate, nf, F_MIN, Math.min(F_MAX, mic.rate / 2), LIVE_SONG.bands); // prettier-ignore
  // The loudest band lately sets the top (it sinks 6 dB a second, never
  // below −50 dB, so silence stays low).
  let peak = -120;
  for (const v of b) peak = Math.max(peak, v);
  LIVE_SONG.top = Math.max(peak, LIVE_SONG.top - (6 * due) / LIVE_SONG.rate, -50);
  // Move the old rows back.
  g.drawImage(c, 0, 0, c.width, c.height - due, 0, due, c.width, c.height - due);
  const img = g.createImageData(nf * 2, 1);
  const px = img.data;
  for (let f = 0; f < nf; f++) {
    // A narrower range than a file's (the room's own hum sits under it).
    const h = clamp01((b[f] - (LIVE_SONG.top - LIVE_RANGE)) / LIVE_RANGE) ** 1.5;
    const [r, gg, bb] = songColor(LIVE_SONG.look, f, nf, h);
    px[f * 4] = Math.round(r * 255);
    px[f * 4 + 1] = Math.round(gg * 255);
    px[f * 4 + 2] = Math.round(bb * 255);
    px[f * 4 + 3] = 255;
    px[(nf + f) * 4] = Math.round(h * 255);
    px[(nf + f) * 4 + 3] = 255;
  }
  for (let j = 0; j < due; j++) g.putImageData(img, 0, j);
  LIVE_SONG.rows += due;
}

// The Chladni plate, sung to: with the microphone on, the note you sing
// drives the plate. A plate a quarter as thick as the one on show (a
// plate's frequencies go with its thickness) has its modes where voices
// are: 75, 150, 195, 255 and 375 Hz. The mode nearest your note is the one
// that rings; how strongly follows a resonance curve (half as strong about
// SING_WIDTH cents away), times how loud you sing. While it rings the sand hops
// and drifts to its still lines, as when it is bowed; when you stop, the
// sand stays where it is. Live r7: another note sets the sand off for its
// mode's figure at once, from where it lies (no new plate).
export const SING_F0 = F0 / 4;
// Half strength this many cents off a mode: wide enough that any note from
// about 60 to 450 Hz rings the nearest mode (an ordinary voice lands between
// modes; at 60 cents most notes rang nothing, the owner's October 2 review).
const SING_WIDTH = 150;
export const singFreq = (mode) => SING_F0 * (mode.n * mode.n + mode.m * mode.m);
const SING = { p: 0, want: null, since: 0, last: null, built: 0, note: null, near: null, r: 0, builds: 0 }; // prettier-ignore
export const singState = () => ({ p: SING.p, note: SING.note, mode: SING.near?.mode.id ?? null, lead: SING.lead?.id ?? null, builds: SING.builds }); // prettier-ignore

// The mode nearest a sung frequency (keeping the sign of the one on show
// when the pair shares a frequency), and how strongly it rings (0..1).
export function singMode(hz, current) {
  let best = null;
  for (const m of MODES) {
    const cents = 1200 * Math.log2(hz / singFreq(m));
    const d = Math.abs(cents) - (current && m.n === current.n && m.m === current.m && m.s === current.s ? 1e-6 : 0); // prettier-ignore
    if (!best || d < best.d) best = { mode: m, d, cents };
  }
  const x = best.cents / SING_WIDTH;
  return { ...best, response: 1 / (1 + x * x) };
}

function singStatus() {
  if (!liveIn.on("mic")) return "";
  const n = SING.note;
  if (!n) return "Sing a steady note (an “ooh” works best), low or high.";
  const near = SING.near;
  const hz = Math.round(singFreq(near.mode));
  const side = near.cents > 25 ? " Sing a little lower." : near.cents < -25 ? " Sing a little higher." : ""; // prettier-ignore
  return `You: ${n.name} (${Math.round(n.hz)} Hz). Nearest mode ${near.mode.n}, ${near.mode.m} rings at ${hz} Hz on this plate.${side}`; // prettier-ignore
}

// Live r7: what a pitch (Hz, moved by octaves into the plate's range) at a
// loudness (0..1) asks of the plate: every mode rings by its own resonance
// to it, so the nearest rings most and the sand heads for its figure at
// once; a waver between two modes rings both a little. Modes that share a
// frequency (the + and − of one n, m) ring as the one the Mode choice names,
// else as +.
function modesFor(hz, loud, chosen) {
  const out = [];
  const seen = new Set();
  for (const m of MODES) {
    const key = m.n * m.n + m.m * m.m;
    if (seen.has(key)) continue;
    seen.add(key);
    const pick = MODES.find((q) => q.n === m.n && q.m === m.m && q.s === chosen.s && q.n * q.n + q.m * q.m === key && chosen.n === q.n && chosen.m === q.m) || MODES.find((q) => q.n * q.n + q.m * q.m === key && q.s > 0) || m; // prettier-ignore
    const x = (1200 * Math.log2(hz / singFreq(pick))) / SING_WIDTH;
    const a = loud / (1 + x * x);
    if (a > 0.02) out.push({ mode: pick, a });
  }
  return out;
}

// One frame of the sung plate (Live r7: no more switching plates; the modes
// follow the voice, see modesFor). Returns the modes it drives.
function singDrive(time, mode) {
  SING.last = time;
  const pitch = liveIn.mic?.pitch;
  const loud = clamp01((liveIn.mic?.db ?? -120) / 30 + 1.8); // −54 dBFS nothing, −24 full
  if (pitch && loud > 0) {
    SING.note = pitch.note && { name: pitch.note.name, hz: pitch.hz };
    SING.near = singMode(foldHz(pitch.hz), mode);
    SING.r = SING.near.response * loud;
    return modesFor(foldHz(pitch.hz), loud, mode);
  }
  SING.r = 0;
  return [];
}
// ---- Lane Live input r4: the Chladni plate plays your audio ---------------------------
// A song or any sound file opened on the plate plays from the file itself
// (song-stream.js Track, as the Song landscape plays it) and is measured in
// the Song landscape's worker (song-analysis.js: pitch and loudness every
// 40 ms). Each moment's strongest pitch (the voiced pitch where there is
// one, else the loudest band) is moved by octaves into the plate's range
// and rings the modes as a sung note does (Live r7: at once, every frame,
// the sand moving on from where it lies; until r7 a running score picked a
// mode and a new plate with fresh sand). Nothing is uploaded.
const CHF = { song: null, an: null, sound: null, score: new Map(), now: null };
const BAND_HZ = bands(12).centers; // the analysis' bands (song-analysis.js NF)

// For the clip tool: the open audio's track (its clock is stepped with the clip's).
export const chladniTest = () => ({ track: CHF.song?.track ?? null });

export const chladniFileState = () => ({
  name: CHF.song?.name ?? null,
  playing: !!CHF.song?.track?.playing,
  pos: CHF.song ? CHF.song.track.time() : 0,
  measured: CHF.an?.progress ?? 0,
  now: CHF.now,
  p: SING.p,
  builds: SING.builds,
  lead: SING.lead?.id ?? null, // Live r7: the mode the sand is settling on
});

// Live r7: the sand, for the tests: how many grains, and whether they move.
export const chladniSand = () => ({ n: SAND.sand?.n ?? 0, moving: !!SAND.sand?.moving, steps: SAND.sand?.steps ?? 0, x0: SAND.sand?.X[0] ?? null, y0: SAND.sand?.Y[0] ?? null }); // prettier-ignore

// Into the plate's range, by octaves (60 to 400 Hz).
export function foldHz(hz) {
  let x = hz;
  while (x >= 400) x /= 2;
  while (x < 60) x *= 2;
  return x;
}

// Frame i's strongest pitch (Hz) and loudness (dBFS), or null if not measured.
function strongest(i) {
  const f = CHF.an?.features;
  if (!f || i < 0 || i >= f.n || !f.done[i]) return null;
  const nfi = FIELDS.length;
  const db = f.feat[i * nfi + FIELD.rms];
  let hz = f.feat[i * nfi + FIELD.f0];
  if (!(hz > 0)) {
    let top = -Infinity;
    for (let b = 0; b < f.nf; b++) {
      const v = f.bands[i * f.nf + b];
      if (v > top) {
        top = v;
        hz = BAND_HZ[b];
      }
    }
  }
  return hz > 0 ? { hz, db } : null;
}

// Live r7: the audio's strongest pitch now drives the modes as a voice
// does (modesFor), frame by frame; no running score, no switching plates.
function fileDrive(time, mode) {
  SING.last = time;
  const t = CHF.song.track;
  if (!t.playing) {
    SING.r = 0;
    return [];
  }
  const i = Math.floor(t.time() / FRAME);
  CHF.an?.focus(i);
  const s = strongest(i);
  if (!s) {
    SING.r = 0;
    return [];
  }
  const hz = foldHz(s.hz);
  const loud = clamp01((s.db + 54) / 30);
  SING.note = { name: noteOf(s.hz).name, hz: s.hz };
  SING.near = singMode(hz, mode);
  SING.r = SING.near.response * loud;
  CHF.now = { hz: s.hz, folded: hz, loud, lead: SING.near.mode.id };
  return modesFor(hz, loud, mode);
}

function closeChladniAudio() {
  const s = CHF.song;
  if (s) {
    s.track.close();
    URL.revokeObjectURL(s.url);
  }
  CHF.an?.close();
  CHF.song = null;
  CHF.an = null;
  CHF.now = null;
  CHF.score.clear();
}

async function openChladniAudio(file, fileName) {
  if (!file) throw new Error("Open a sound file.");
  if (liveIn.on("mic")) liveStop("mic");
  closeChladniAudio();
  const url = URL.createObjectURL(file);
  const track = new Track(url);
  let duration;
  try {
    duration = await track.ready;
  } catch (err) {
    track.close();
    URL.revokeObjectURL(url);
    throw err;
  }
  const an = new SongAnalysis();
  an.start(file, 44100).catch((err) => (an.error = err?.message || String(err)));
  CHF.song = { name: fileName.replace(/\.[^.]+$/, ""), url, track, duration };
  CHF.an = an;
  track.play(CHF.sound);
  return {};
}

function chladniShown() {
  const s = CHF.song;
  if (!s) return "";
  const an = CHF.an;
  const left =
    an && !an.finished ? ` Listening through it: ${Math.round(an.progress * 100)}%.` : "";
  return `${s.name} (${Math.round(s.duration)} s).${left}`;
}

const chladniTransport = {
  prefix: "chladni",
  state() {
    const s = CHF.song;
    return {
      hidden: !s,
      pos: s ? s.track.time() : 0,
      length: s?.duration || 0,
      playing: !!s?.track?.playing,
      mic: liveIn.on("mic"),
      live: false,
      recorded: 0,
      recording: 0,
    };
  },
  toStart() {
    const t = CHF.song?.track;
    if (!t) return;
    t.el.currentTime = 0;
    t.anchor = null;
    if (!t.playing) t.play(CHF.sound);
    liveIn.wake?.();
  },
  toggle() {
    const t = CHF.song?.track;
    if (!t) return;
    if (t.playing) t.pause();
    else t.play(CHF.sound);
    liveIn.wake?.();
  },
  seek(sec) {
    const t = CHF.song?.track;
    if (!t) return;
    t.el.currentTime = Math.max(0, Math.min(t.duration || 0, sec));
    t.anchor = null;
    liveIn.wake?.();
  },
  close() {
    closeChladniAudio();
    liveIn.wake?.();
  },
  // Another toy: the audio stops (a rebuild of the plate keeps it playing).
  gone() {
    setTimeout(() => {
      if (globalThis.window?.__splashery?.player?.scene?.toy?.id !== "chladni-plate") CHF.song?.track?.pause(); // prettier-ignore
    }, 300);
  },
};
// ---- End of live input ----------------------------------------------------------------

export const RECIPES = {
  "song-landscape": SONG_LANDSCAPE,
  "chladni-plate": CHLADNI,
};
