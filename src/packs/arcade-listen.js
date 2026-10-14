// Lane Arcade r2: Note Rider's own song from an audio file (the owner: "I
// wonder if we could allow them to upload just any other kind of song, if
// we could have a converter"). The recording is turned into a chart of
// notes on this device, and never leaves it:
//
//   1. The browser decodes the file and resamples it to 22,050 Hz, mono.
//   2. Basic Pitch (Spotify's note transcription model, Apache-2.0, a 230 KB
//      ONNX file in vendor/basic-pitch/) listens to it two seconds at a
//      time on ONNX Runtime Web (already vendored for Photo to 3D; both load
//      only now) and says, for every 11.6 ms and each of the 88 piano keys,
//      how likely a note is sounding and how likely one starts there.
//   3. Notes start at the peaks of the starts and last while the note goes
//      on sounding (the model's own note decoding, without its slow
//      melodia pass).
//   4. The melody: of the notes that start together (within 60 ms) in the
//      singing range (E3 to C6), the loudest; at least 0.12 s apart.
//
// A converter can't hear a full mix perfectly (on a test mix of piano,
// harp, bass and drums it found 80% of the melody's notes, with some extra
// ones), so the game never plays the notes it guessed: each note you catch
// plays its own slice of the real recording, from its start to the next
// note's. Catch them all and you hear the whole song; a missed note's slice
// is silent.

import { SAMPLES, loadSample } from "../voices.js";

const SR = 22050;
const HOP = 256;
const N = SR * 2 - HOP; // the model's window: 43,844 samples
const OLAP = 30; // frames of overlap between windows
const STEP = N - OLAP * HOP;
const FPS = SR / HOP;
const RUNTIME = new URL("../../vendor/onnxruntime-web/", import.meta.url).href;
const MODEL = new URL("../../vendor/basic-pitch/nmp.onnx", import.meta.url).href;
const MAX_SECONDS = 8 * 60;

let opened = 0;

// file: a File or Blob of audio. progress(text): what it is doing now.
// Returns a song for Note Rider: { title, notes: [{ t, d, n, v, slice }],
// audio: the sample key its slices play from }.
export async function songFromAudio(file, progress = () => {}) {
  progress("Opening the recording…");
  const bytes = await file.arrayBuffer();
  const audio = await decode(bytes);
  if (audio.length < SR * 2) throw new Error("That recording is too short (under two seconds).");
  if (audio.length > SR * MAX_SECONDS)
    throw new Error("That recording is too long (more than eight minutes).");
  progress("Loading the listener…");
  const ort = await import("../../vendor/onnxruntime-web/ort.wasm.min.mjs");
  ort.env.wasm.wasmPaths = RUNTIME;
  ort.env.wasm.numThreads = 1;
  const session = await ort.InferenceSession.create(MODEL, { executionProviders: ["wasm"] });
  // Windows of two seconds, overlapping by 30 frames; half the overlap is
  // dropped from each side of each window's answer.
  const padded = new Float32Array((OLAP * HOP) / 2 + audio.length);
  padded.set(audio, (OLAP * HOP) / 2);
  const total = Math.floor((audio.length * FPS) / SR);
  const frames = new Float32Array(total * 88);
  const onsets = new Float32Array(total * 88);
  let at = 0;
  const windows = Math.ceil(padded.length / STEP);
  for (let w = 0, i = 0; i < padded.length; i += STEP, w++) {
    progress(`Listening for the notes… ${Math.round((100 * w) / windows)}%`);
    const x = new Float32Array(N);
    x.set(padded.subarray(i, i + N));
    const out = await session.run({ "serving_default_input_2:0": new ort.Tensor("float32", x, [1, N, 1]) }); // prettier-ignore
    const note = out["StatefulPartitionedCall:1"].data;
    const onset = out["StatefulPartitionedCall:2"].data;
    const rows = note.length / 88;
    for (let r = OLAP / 2; r < rows - OLAP / 2 && at < total; r++, at++) {
      frames.set(note.subarray(r * 88, r * 88 + 88), at * 88);
      onsets.set(onset.subarray(r * 88, r * 88 + 88), at * 88);
    }
    // let the page breathe between windows
    await new Promise((ok) => setTimeout(ok, 0));
  }
  session.release?.();
  progress("Finding the tune…");
  const events = noteEvents(frames, onsets, total);
  const notes = melody(events, audio.length / SR);
  if (notes.length < 8) throw new Error("No tune could be heard in that recording.");
  // The recording itself, for the slices: kept in this page only.
  const key = `own-song-${++opened}`;
  SAMPLES.data[key] = URL.createObjectURL(new Blob([bytes], { type: file.type || "audio/mpeg" }));
  await loadSample(null, key);
  return { title: file.name || "Your song", notes, audio: key };
}

async function decode(bytes) {
  const Ctx = globalThis.OfflineAudioContext || globalThis.webkitOfflineAudioContext;
  if (!Ctx) throw new Error("This browser can't open recordings.");
  const ctx = new Ctx(1, 1, SR);
  let buf;
  try {
    buf = await new Promise((ok, fail) => ctx.decodeAudioData(bytes.slice(0), ok, fail));
  } catch {
    throw new Error("That file isn't a recording this browser can open (try an MP3, M4A or WAV).");
  }
  const out = new Float32Array(buf.length);
  for (let c = 0; c < buf.numberOfChannels; c++) {
    const d = buf.getChannelData(c);
    for (let i = 0; i < d.length; i++) out[i] += d[i] / buf.numberOfChannels;
  }
  return out;
}

// The model's note decoding (basic_pitch/note_creation.py,
// output_to_notes_polyphonic, without its melodia pass): a note starts at
// each peak in time of a key's onset at least 0.5, and lasts while that key
// sounds above 0.3 (allowing 11 frames' dip); notes 11 frames or shorter
// are dropped. Later notes are taken first, as there.
function noteEvents(
  frames,
  onsets,
  T,
  onsetThresh = 0.5,
  frameThresh = 0.3,
  minLen = 11,
  tol = 11,
) {
  // prettier-ignore
  const starts = [];
  for (let k = 0; k < 88; k++)
    for (let t = 1; t < T - 1; t++) {
      const v = onsets[t * 88 + k];
      if (v >= onsetThresh && v > onsets[(t - 1) * 88 + k] && v >= onsets[(t + 1) * 88 + k])
        starts.push([t, k]);
    }
  starts.sort((a, b) => b[0] - a[0]);
  const rem = frames.slice();
  const events = [];
  for (const [t0, k] of starts) {
    let i = t0 + 1;
    let q = 0;
    while (i < T - 1 && q < tol) {
      q = rem[i * 88 + k] < frameThresh ? q + 1 : 0;
      i++;
    }
    i -= q;
    if (i - t0 <= minLen) continue;
    let sum = 0;
    for (let t = t0; t < i; t++) {
      sum += frames[t * 88 + k];
      for (const kk of [k - 1, k, k + 1]) if (kk >= 0 && kk < 88) rem[t * 88 + kk] = 0;
    }
    events.push({ t: t0 / FPS, d: (i - t0) / FPS, n: k + 21, v: sum / (i - t0) });
  }
  return events.sort((a, b) => a.t - b.t);
}

// The tune: one note per moment, the loudest in the singing range, each
// with the slice of the recording it plays (to the next note's start, at
// most 1.5 s).
function melody(events, seconds) {
  const groups = [];
  for (const e of events) {
    const g = groups.at(-1);
    if (g && e.t - g[0].t < 0.06) g.push(e);
    else groups.push([e]);
  }
  const picks = [];
  for (const g of groups) {
    const sung = g.filter((e) => e.n >= 52 && e.n <= 84);
    if (!sung.length) continue;
    const best = sung.reduce((a, b) => (b.v > a.v ? b : a));
    if (picks.length && best.t - picks.at(-1).t < 0.12) continue;
    picks.push(best);
  }
  return picks.map((e, i) => {
    const next = picks[i + 1]?.t ?? seconds;
    return { t: e.t, d: Math.min(e.d, 1.5), n: e.n, v: Math.min(1, e.v * 1.4), ch: 0, slice: Math.min(1.5, next - e.t) }; // prettier-ignore
  });
}
