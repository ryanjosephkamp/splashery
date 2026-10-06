// Lane Sound and light lab (prefix sll): two labs toys on the Studio shelf.
//
// - Sound lab: a bench instrument whose screen is a panel of splats, one
//   per pixel, drawn from a canvas each frame: a scrolling spectrogram, the
//   spectrum now with its loudest frequency, an oscilloscope, and a sound
//   level estimate (labeled uncalibrated). It shows the microphone once the
//   person taps "Use my microphone", and otherwise the tone generator's own
//   signal (sine, square, saw or noise; one tone, or two that beat), which
//   plays through the speaker while the site's sound is on. A metronome
//   beside it swings and clicks at the tempo set.
// - Sound recorder: records from the microphone when the person taps
//   Record (the one recording exception in CLAUDE.md: kept in this page's
//   memory, saved only to a file the person chooses), plays it back, trims
//   it, shows its waveform and spectrogram, and saves it as WAV or, where
//   the browser can, a compressed file.
//
// Everything the screens show is measured from samples: the microphone's
// (src/live/mic.js), or the generator's, computed here exactly as the
// speaker plays them (src/labs/sound-dsp.js).

import { mix, shade, clamp } from "../kit.js";
import { live, start as startLive, release as releaseLive } from "../live/live.js";
import { MicRecorder, clock } from "./song-record.js";
import {
  boxSplats,
  faceSplats,
  lit,
  budgetN,
  surfSplats,
  sphereSplats,
  cylinderSplats,
} from "../labs/splat-shapes.js";
import { spectrogram } from "./studio-audio.js";
import { WAVES, F_LO, F_HI, FULL_SCALE_SPL, toneSamples, spectrumDb, peakOf, rmsDb, splEstimate, beatHz, metronome, clickTimes, wavBytes, trimmed, soundSpan, logPos, logHz } from "../labs/sound-dsp.js"; // prettier-ignore

const FONT = "ui-sans-serif, system-ui, -apple-system, Segoe UI, sans-serif";
const N = 4096; // samples in each analysis window
const RATE = 48000; // the generator's rate for the screens
const COLS = 200; // spectrogram history: columns
const ROWS = 120; // and rows (log frequency, 30 Hz to 16 kHz)
const COL_RATE = 25; // columns a second (8 s of history)
const F_AXIS = [30, 16000];

// ---- A panel of screen splats ------------------------------------------------------
// One flat splat per pixel of the panel, colored from the recipe's screen
// canvas at (u, v) (behaviour "screen"). Absolute sizes, so the panel is
// exactly as dense as asked whatever else the toy holds.
function screenPanel(k, { center, width, height, cols, rows, part = 0, u = [0, 1], v = [0, 1] }) {
  const dx = width / cols;
  const dy = height / rows;
  const s = Math.max(dx, dy) * 0.62;
  const list = [];
  for (let j = 0; j < rows; j++)
    for (let i = 0; i < cols; i++) {
      const a = (i + 0.5) / cols;
      const b = (j + 0.5) / rows;
      list.push({
        p: [center[0] + (a - 0.5) * width, center[1] + (0.5 - b) * height, center[2]],
        scales: [s, s, s * 0.04],
        color: "#05070b",
        kind: "screen",
        params: [u[0] + a * (u[1] - u[0]), v[0] + b * (v[1] - v[0])],
        opacity: 1,
        part,
        pattern: false,
      });
    }
  k.cloud(
    { share: list.length / k.count, pattern: false, jitter: 0 },
    (rand, i) => list[i] || null,
  );
}

// The panel's resolution from the toy's budget: `share` of it, at the
// panel's shape, at most one splat per canvas pixel.
function panelSize(k, share, aspect, maxCols) {
  const n = Math.max(6000, Math.min(k.count * share, 150000));
  const cols = Math.min(maxCols, Math.round(Math.sqrt(n * aspect)));
  return { cols, rows: Math.round(cols / aspect) };
}

// ---- Drawing helpers -----------------------------------------------------------------

// The spectrogram's colors: dark blue, violet, orange, pale yellow.
const HEAT = ["#06081a", "#2a1460", "#7b1f7a", "#c8384f", "#f2762b", "#fcd25a", "#fffbe0"];
const HEAT_RGB = HEAT.map((h) => [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16)));
function heat(t) {
  const x = clamp(t, 0, 1) * (HEAT_RGB.length - 1);
  const i = Math.min(HEAT_RGB.length - 2, Math.floor(x));
  const f = x - i;
  const a = HEAT_RGB[i];
  const b = HEAT_RGB[i + 1];
  return [a[0] + (b[0] - a[0]) * f, a[1] + (b[1] - a[1]) * f, a[2] + (b[2] - a[2]) * f];
}
const DB_LO = -90; // the spectrogram's dark end, dB re full scale
const DB_HI = -6;

const hzText = (hz) => (hz >= 1000 ? `${(hz / 1000).toFixed(hz >= 10000 ? 1 : 2)} kHz` : `${hz.toFixed(hz < 100 ? 1 : 0)} Hz`); // prettier-ignore

function label(
  g,
  text,
  x,
  y,
  { size = 13, color = "#9fb2c4", align = "left", weight = "600", base = "alphabetic" } = {},
) {
  g.font = `${weight} ${size}px ${FONT}`;
  g.fillStyle = color;
  g.textAlign = align;
  g.textBaseline = base;
  g.fillText(text, x, y);
}

function box(g, r, title) {
  g.fillStyle = "#0b1017";
  g.fillRect(r.x, r.y, r.w, r.h);
  g.strokeStyle = "#1d2a38";
  g.lineWidth = 1;
  g.strokeRect(r.x + 0.5, r.y + 0.5, r.w - 1, r.h - 1);
  if (title) label(g, title, r.x + 6, r.y + 14, { size: 14, color: "#6f8496" });
}

// ---- The Sound lab --------------------------------------------------------------------

export const SL = {
  tone: { wave: "sine", f: 440, vol: 0.4, two: false, f2: 444 },
  toneOn: false,
  metroOn: false,
  bpm: 100,
  metroT0: 0,
  metroDone: -1,
  view: "all",
  fullScale: FULL_SCALE_SPL,
  // The analysis now.
  source: "quiet", // "mic", "tone" or "quiet"
  rate: RATE,
  buf: new Float32Array(N),
  db: new Float32Array(N / 2 + 1).fill(-120),
  peak: null,
  level: -120,
  hist: new Float32Array(COLS * ROWS).fill(DB_LO),
  head: 0, // the next column to write
  lastCol: null,
  toneT0: 0, // the generator's start (player time)
  version: 0,
  audio: null, // { ctx, gain, osc: [..], noise }
  sound: null,
  lastDrive: 0,
  watchdog: null,
};

// The state a test or a tool reads.
export const soundLabState = () => ({
  source: SL.source,
  peak: SL.peak && { ...SL.peak },
  level: SL.level,
  toneOn: SL.toneOn,
  metroOn: SL.metroOn,
  bpm: SL.bpm,
  tone: { ...SL.tone },
  playing: !!SL.audio,
  histPeakHz: histPeak(),
});

// The spectrogram's newest column's loudest row, as a frequency (Hz).
function histPeak() {
  const c = (SL.head - 1 + COLS) % COLS;
  let best = -1;
  let v = -Infinity;
  for (let r = 0; r < ROWS; r++)
    if (SL.hist[c * ROWS + r] > v) {
      v = SL.hist[c * ROWS + r];
      best = r;
    }
  return v > DB_LO + 1 ? logHz((best + 0.5) / ROWS, ...F_AXIS) : null;
}

// Changes the generator from the panel (or a test).
export function setTone(partial) {
  Object.assign(SL.tone, partial);
  SL.tone.f = clamp(Number(SL.tone.f) || 440, F_LO, F_HI);
  SL.tone.f2 = clamp(Number(SL.tone.f2) || 444, F_LO, F_HI);
  SL.tone.vol = clamp(Number(SL.tone.vol) || 0, 0, 1);
  if (!WAVES.includes(SL.tone.wave)) SL.tone.wave = "sine";
  syncAudio();
}

export function setMetronome(on, bpm = SL.bpm) {
  SL.bpm = clamp(Math.round(Number(bpm) || 100), 30, 240);
  if (on && !SL.metroOn) {
    SL.metroT0 = null; // starts on the next frame
    SL.metroDone = -1;
  }
  SL.metroOn = !!on;
}

// ---- The speaker: the generator through the site's sound ----------------------------
let NOISE = null;
function noiseBuffer(ctx) {
  if (NOISE?.ctx === ctx) return NOISE.buf;
  const n = ctx.sampleRate * 2;
  const buf = ctx.createBuffer(1, n, ctx.sampleRate);
  buf.copyToChannel(toneSamples({ wave: "noise", vol: 1 }, ctx.sampleRate, 0, n), 0);
  NOISE = { ctx, buf };
  return buf;
}

function startAudio(sound) {
  const ctx = sound?.enabled ? sound.audio() : null;
  if (!ctx || !sound.master) return;
  const gain = ctx.createGain();
  gain.gain.value = 0;
  gain.connect(sound.master);
  SL.audio = { ctx, gain, nodes: [], wave: null, two: null };
  syncAudio();
  gain.gain.setTargetAtTime(SL.tone.two ? SL.tone.vol / 2 : SL.tone.vol, ctx.currentTime, 0.015);
}

function stopAudio() {
  const a = SL.audio;
  if (!a) return;
  SL.audio = null;
  const t = a.ctx.currentTime;
  a.gain.gain.setTargetAtTime(0, t, 0.015);
  for (const n of a.nodes) {
    try {
      n.stop(t + 0.12);
    } catch {
      // Already stopped.
    }
  }
  setTimeout(() => a.gain.disconnect(), 300);
}

// Brings the playing nodes in line with SL.tone.
function syncAudio() {
  const a = SL.audio;
  if (!a) return;
  const { ctx } = a;
  const t = ctx.currentTime;
  const { wave, f, f2, two, vol } = SL.tone;
  if (a.wave !== wave || a.two !== two) {
    for (const n of a.nodes) {
      try {
        n.stop(t + 0.03);
      } catch {
        // Already stopped.
      }
    }
    a.nodes = [];
    if (wave === "noise") {
      const src = ctx.createBufferSource();
      src.buffer = noiseBuffer(ctx);
      src.loop = true;
      src.connect(a.gain);
      src.start(t + 0.02);
      a.nodes.push(src);
    } else {
      for (const hz of two ? [f, f2] : [f]) {
        const o = ctx.createOscillator();
        o.type = wave;
        o.frequency.value = hz;
        o.connect(a.gain);
        o.start(t + 0.02);
        a.nodes.push(o);
      }
    }
    a.wave = wave;
    a.two = two;
  }
  if (wave !== "noise") {
    a.nodes[0]?.frequency.setTargetAtTime(f, t, 0.01);
    a.nodes[1]?.frequency.setTargetAtTime(f2, t, 0.01);
  }
  a.gain.gain.setTargetAtTime(two && wave !== "noise" ? vol / 2 : wave === "noise" ? vol * 0.6 : vol, t, 0.02); // prettier-ignore
}

// The metronome's click: a short knock (a band of noise and a woodblock
// tone), on the beat, scheduled on the audio clock.
function click(ctx, master, at, accent) {
  const o = ctx.createOscillator();
  const g = ctx.createGain();
  o.type = "triangle";
  o.frequency.value = accent ? 1760 : 1320;
  g.gain.setValueAtTime(0, at);
  g.gain.linearRampToValueAtTime(accent ? 0.5 : 0.36, at + 0.001);
  g.gain.exponentialRampToValueAtTime(0.0008, at + 0.05);
  o.connect(g);
  g.connect(master);
  o.start(at);
  o.stop(at + 0.06);
}

// If no frame comes for a while (another toy, a hidden tab), the speaker
// stops; it starts again with the next frame while the tone is on.
function watch() {
  if (SL.watchdog) return;
  SL.watchdog = setInterval(() => {
    if (performance.now() - SL.lastDrive < 400) return;
    stopAudio();
    clearInterval(SL.watchdog);
    SL.watchdog = null;
  }, 200);
}

// ---- The analysis --------------------------------------------------------------------

function analyze(time) {
  const mic = live.on("mic") ? live.mic : null;
  if (mic && mic.written >= N) {
    SL.source = "mic";
    SL.rate = mic.rate;
    mic.recent(N, SL.buf);
  } else if (SL.toneOn) {
    SL.source = "tone";
    SL.rate = RATE;
    toneSamples(SL.tone, RATE, Math.max(0, time - SL.toneT0) - N / RATE, N, SL.buf);
  } else {
    SL.source = mic ? "mic" : "quiet";
    SL.buf.fill(0);
  }
  spectrumDb(SL.buf, SL.db);
  SL.level = rmsDb(SL.buf, N - Math.round(0.05 * SL.rate), N);
  SL.peak = SL.level > -70 ? peakOf(SL.db, SL.rate, N, { lo: 25, hi: Math.min(F_HI, SL.rate / 2 - 100) }) : null; // prettier-ignore
  // New spectrogram columns, COL_RATE a second, each the spectrum now.
  if (SL.lastCol === null || time < SL.lastCol) SL.lastCol = time - 1 / COL_RATE;
  let n = Math.min(COLS, Math.floor((time - SL.lastCol) * COL_RATE));
  if (n > 0) {
    SL.lastCol += n / COL_RATE;
    const bin = SL.rate / N;
    const col = new Float32Array(ROWS);
    for (let r = 0; r < ROWS; r++) {
      const fa = logHz(r / ROWS, ...F_AXIS);
      const fb = logHz((r + 1) / ROWS, ...F_AXIS);
      let m = -120;
      const a = Math.floor(fa / bin);
      const b = Math.max(a, Math.ceil(fb / bin) - 1);
      for (let i = a; i <= Math.min(b, SL.db.length - 1); i++) if (SL.db[i] > m) m = SL.db[i];
      if (b <= a) {
        // Rows finer than a bin: the spectrum at the row's middle.
        const x = Math.sqrt(fa * fb) / bin;
        const i0 = Math.min(SL.db.length - 2, Math.floor(x));
        m = Math.max(m, SL.db[i0] + (SL.db[i0 + 1] - SL.db[i0]) * (x - i0));
      }
      col[r] = Math.max(DB_LO, m);
    }
    while (n-- > 0) {
      SL.hist.set(col, SL.head * ROWS);
      SL.head = (SL.head + 1) % COLS;
    }
  }
  SL.version++;
}

// ---- The screen ------------------------------------------------------------------------

const SW = 640;
const SH = 360;

function drawSpectrogram(g, r) {
  box(g, r, "");
  const img = g.createImageData(COLS, ROWS);
  for (let c = 0; c < COLS; c++) {
    const src = (SL.head + c) % COLS; // the oldest on the left
    for (let row = 0; row < ROWS; row++) {
      const v = SL.hist[src * ROWS + row];
      const [R, G, B] = heat((v - DB_LO) / (DB_HI - DB_LO));
      const o = ((ROWS - 1 - row) * COLS + c) * 4;
      img.data[o] = R;
      img.data[o + 1] = G;
      img.data[o + 2] = B;
      img.data[o + 3] = 255;
    }
  }
  const tmp = scratch(COLS, ROWS);
  tmp.g.putImageData(img, 0, 0);
  g.imageSmoothingEnabled = true;
  const ax = 44;
  g.drawImage(tmp.c, r.x + ax, r.y + 4, r.w - ax - 4, r.h - 22);
  // The frequency axis (log) and the time.
  for (const hz of [50, 100, 200, 500, 1000, 2000, 5000, 10000]) {
    const y = r.y + 4 + (1 - logPos(hz, ...F_AXIS)) * (r.h - 22);
    g.fillStyle = "rgba(255,255,255,0.18)";
    g.fillRect(r.x + ax, Math.round(y), r.w - ax - 4, 1);
    label(g, hz >= 1000 ? `${hz / 1000}k` : String(hz), r.x + ax - 5, y + 4, { size: 13, align: "right", color: "#7d90a2" }); // prettier-ignore
  }
  label(g, "Hz", r.x + 6, r.y + 15, { size: 13, color: "#7d90a2" });
  label(g, `← ${COLS / COL_RATE} s`, r.x + ax + 2, r.y + r.h - 5, { size: 13, color: "#7d90a2" });
  label(g, "now →", r.x + r.w - 6, r.y + r.h - 5, { size: 13, color: "#7d90a2", align: "right" });
}

function drawSpectrum(g, r) {
  box(g, r, "Spectrum now");
  const x0 = r.x + 8;
  const w = r.w - 16;
  const y0 = r.y + 22;
  const h = r.h - 44;
  const bin = SL.rate / N;
  g.beginPath();
  for (let i = 0; i <= w; i++) {
    const hz = logHz(i / w, ...F_AXIS);
    const x = hz / bin;
    const j = Math.min(SL.db.length - 2, Math.floor(x));
    const v = Math.max(SL.db[j], SL.db[j + 1]);
    const y = y0 + h * (1 - clamp((v - DB_LO) / (0 - DB_LO), 0, 1));
    if (i === 0) g.moveTo(x0 + i, y);
    else g.lineTo(x0 + i, y);
  }
  g.lineTo(x0 + w, y0 + h);
  g.lineTo(x0, y0 + h);
  g.closePath();
  g.fillStyle = "rgba(242,118,43,0.35)";
  g.fill();
  g.strokeStyle = "#fcd25a";
  g.lineWidth = 1.5;
  g.stroke();
  for (const hz of [100, 1000, 10000]) {
    const x = x0 + logPos(hz, ...F_AXIS) * w;
    label(g, hz >= 1000 ? `${hz / 1000}k` : String(hz), x, r.y + r.h - 6, { size: 13, align: "center", color: "#7d90a2" }); // prettier-ignore
  }
  if (SL.peak) {
    const x = x0 + logPos(clamp(SL.peak.hz, ...F_AXIS), ...F_AXIS) * w;
    g.fillStyle = "#7fd7ff";
    g.fillRect(Math.round(x), y0, 2, h);
    label(g, `peak ${hzText(SL.peak.hz)}`, r.x + r.w - 8, r.y + 15, { size: 13, align: "right", color: "#bfeaff" }); // prettier-ignore
  }
}

function drawScope(g, r) {
  box(g, r, "Oscilloscope");
  // About four periods of the loudest frequency (2 to 40 ms), from a rising
  // zero crossing so a steady tone stands still.
  const span = clamp(SL.peak ? 4 / SL.peak.hz : 0.02, 0.002, 0.04);
  const n = Math.max(16, Math.round(span * SL.rate));
  let at = N - n - 1;
  for (let i = N - n - 2; i > Math.max(1, N - n - 1 - Math.round(SL.rate * 0.03)); i--)
    if (SL.buf[i - 1] < 0 && SL.buf[i] >= 0) {
      at = i;
      break;
    }
  const x0 = r.x + 8;
  const w = r.w - 16;
  const yc = r.y + r.h / 2 + 6;
  const amp = (r.h - 30) / 2;
  g.fillStyle = "rgba(255,255,255,0.12)";
  g.fillRect(x0, Math.round(yc), w, 1);
  for (let q = 1; q < 4; q++) g.fillRect(Math.round(x0 + (q * w) / 4), r.y + 20, 1, r.h - 26);
  g.beginPath();
  for (let i = 0; i < n; i++) {
    const x = x0 + (i / (n - 1)) * w;
    const y = yc - clamp(SL.buf[at + i], -1, 1) * amp;
    if (i === 0) g.moveTo(x, y);
    else g.lineTo(x, y);
  }
  g.strokeStyle = "#7dffb0";
  g.lineWidth = 2;
  g.stroke();
  const ms = (span * 1000) / 4;
  label(g, `${ms < 1 ? ms.toFixed(2) : ms.toFixed(1)} ms per square`, r.x + r.w - 8, r.y + 15, { size: 14, align: "right", color: "#7d90a2" }); // prettier-ignore
}

function drawLevel(g, r) {
  box(g, r, "Sound level");
  const db = SL.level;
  const on = db > -100;
  label(g, on ? `${db.toFixed(1)} dBFS` : "—", r.x + 10, r.y + 44, { size: 26, color: "#ffe9a8", weight: "700" }); // prettier-ignore
  let sub;
  if (SL.source === "mic")
    sub = on
      ? `about ${Math.round(splEstimate(db, SL.fullScale))} dB SPL, uncalibrated`
      : "listening…";
  else if (SL.source === "tone") sub = "the generator's own level";
  else sub = "tap for a tone, or use the mic";
  label(g, sub, r.x + 10, r.y + 64, { size: 14, color: "#9fb2c4" });
  // A meter from −60 to 0 dBFS.
  const mx = r.x + 10;
  const mw = r.w - 20;
  const my = r.y + 74;
  g.fillStyle = "#18222e";
  g.fillRect(mx, my, mw, 10);
  const f = clamp((db + 60) / 60, 0, 1);
  const grad = g.createLinearGradient(mx, 0, mx + mw, 0);
  grad.addColorStop(0, "#3cc28a");
  grad.addColorStop(0.75, "#e8d24a");
  grad.addColorStop(1, "#e8513c");
  g.fillStyle = grad;
  g.fillRect(mx, my, mw * f, 10);
  // The generator and the metronome.
  const t = SL.tone;
  const tone = t.wave === "noise" ? "noise" : t.two ? `${t.wave} ${hzText(t.f)} + ${hzText(t.f2)}, beats ${beatHz(t.f, t.f2).toFixed(1)} Hz` : `${t.wave} ${hzText(t.f)}`; // prettier-ignore
  label(g, `${SL.toneOn ? "▶" : "■"} ${tone}`, r.x + 10, r.y + 104, { size: 14, color: SL.toneOn ? "#bfeaff" : "#6f8496" }); // prettier-ignore
  label(g, `${SL.metroOn ? "▶" : "■"} metronome ${SL.bpm} bpm`, r.x + 10, r.y + 122, { size: 14, color: SL.metroOn ? "#bfeaff" : "#6f8496" }); // prettier-ignore
}

const SCRATCH = new Map();
function scratch(w, h) {
  const key = `${w}x${h}`;
  if (!SCRATCH.has(key)) {
    const c = typeof OffscreenCanvas !== "undefined" ? new OffscreenCanvas(w, h) : Object.assign(document.createElement("canvas"), { width: w, height: h }); // prettier-ignore
    SCRATCH.set(key, { c, g: c.getContext("2d") });
  }
  return SCRATCH.get(key);
}

function headline() {
  if (SL.source === "mic") return "Microphone";
  if (SL.source === "tone") return SL.sound?.enabled ? "Tone generator" : "Tone generator (sound off: tap the speaker button to hear it)"; // prettier-ignore
  return "Quiet: tap to play a tone";
}

function drawSoundLab(g) {
  g.fillStyle = "#05070b";
  g.fillRect(0, 0, SW, SH);
  label(g, headline(), 10, 20, { size: 15, color: "#e6eef5", weight: "700" });
  label(g, SL.peak ? hzText(SL.peak.hz) : "", SW - 10, 20, { size: 15, color: "#7fd7ff", align: "right", weight: "700" }); // prettier-ignore
  const v = SL.view;
  const full = { x: 6, y: 30, w: SW - 12, h: SH - 36 };
  if (v === "spectrogram") return drawSpectrogram(g, full);
  if (v === "scope") return drawScope(g, full);
  if (v === "spectrum") return drawSpectrum(g, full);
  drawSpectrogram(g, { x: 6, y: 30, w: 390, h: 190 });
  drawSpectrum(g, { x: 402, y: 30, w: 232, h: 190 });
  drawScope(g, { x: 6, y: 226, w: 390, h: 128 });
  drawLevel(g, { x: 402, y: 226, w: 232, h: 128 });
}

// ---- The panel in the Toy tab -------------------------------------------------------

function el(tag, props = {}, ...kids) {
  const e = Object.assign(document.createElement(tag), props);
  e.append(...kids);
  return e;
}

function rangeRow(id, text, { min, max, step, value, log, fmt, set }) {
  const row = el("label", { className: "row" });
  const input = el("input", { type: "range", id, min: String(min), max: String(max), step: String(step) }); // prettier-ignore
  const out = el("output", { htmlFor: id });
  const toPos = (v) => (log ? Math.log(v / log[0]) / Math.log(log[1] / log[0]) : v);
  const fromPos = (p) => (log ? log[0] * (log[1] / log[0]) ** p : p);
  const show = (v) => {
    input.value = String(toPos(v));
    out.value = fmt(v);
  };
  input.addEventListener("input", () => {
    const v = fromPos(Number(input.value));
    set(v);
    out.value = fmt(v);
  });
  row.append(el("span", { textContent: text }), input, out);
  show(value);
  return { row, input, show };
}

function soundLabPanel() {
  const box = el("div", { className: "sll-panel", id: "sll-panel" });
  const row1 = el("div", { className: "button-row" });
  const play = el("button", { type: "button", id: "sll-tone" });
  play.addEventListener("click", () => live.tap?.());
  const wave = el("select", { id: "sll-wave", ariaLabel: "Wave" });
  for (const [id, name] of [["sine", "Sine"], ["square", "Square"], ["sawtooth", "Saw"], ["noise", "Noise"]]) wave.add(new Option(name, id)); // prettier-ignore
  wave.value = SL.tone.wave;
  wave.addEventListener("change", () => setTone({ wave: wave.value }));
  row1.append(play, wave);
  const fA = rangeRow("sll-f1", "Frequency", { min: 0, max: 1, step: 0.001, value: SL.tone.f, log: [F_LO, F_HI], fmt: hzText, set: (v) => setTone({ f: Math.round(v * 10) / 10 }) }); // prettier-ignore
  const num = el("input", { type: "number", id: "sll-f1-hz", min: String(F_LO), max: String(F_HI), step: "0.1", value: String(SL.tone.f), ariaLabel: "Frequency in hertz" }); // prettier-ignore
  num.style.width = "7em";
  num.addEventListener("change", () => {
    setTone({ f: Number(num.value) });
    fA.show(SL.tone.f);
  });
  const vol = rangeRow("sll-vol", "Volume", { min: 0, max: 1, step: 0.01, value: SL.tone.vol, fmt: (v) => `${Math.round(v * 100)}%`, set: (v) => setTone({ vol: v }) }); // prettier-ignore
  const twoRow = el("label", { className: "check-row" });
  const two = el("input", { type: "checkbox", id: "sll-two", className: "switch" });
  two.setAttribute("role", "switch");
  two.checked = SL.tone.two;
  two.addEventListener("change", () => setTone({ two: two.checked }));
  twoRow.append(two, el("span", { textContent: "A second tone (beats)" }));
  const fB = rangeRow("sll-f2", "Second tone", { min: 0, max: 1, step: 0.001, value: SL.tone.f2, log: [F_LO, F_HI], fmt: hzText, set: (v) => setTone({ f2: Math.round(v * 10) / 10 }) }); // prettier-ignore
  const presets = el("div", { className: "button-row" });
  const preset = (text, tone) => {
    const b = el("button", { type: "button", textContent: text });
    b.addEventListener("click", () => {
      setTone(tone);
      fA.show(SL.tone.f);
      fB.show(SL.tone.f2);
      wave.value = SL.tone.wave;
      two.checked = SL.tone.two;
      num.value = String(SL.tone.f);
      if (!SL.toneOn) live.tap?.();
    });
    presets.append(b);
  };
  preset("A4, 440 Hz", { wave: "sine", f: 440, two: false });
  preset("Beats: 440 + 443 Hz", { wave: "sine", f: 440, f2: 443, two: true });
  preset("Square, 220 Hz", { wave: "square", f: 220, two: false });
  preset("Noise", { wave: "noise", two: false });
  const metro = el("button", { type: "button", id: "sll-metro" });
  metro.addEventListener("click", () => setMetronome(!SL.metroOn));
  const bpm = rangeRow("sll-bpm", "Tempo", { min: 30, max: 240, step: 1, value: SL.bpm, fmt: (v) => `${Math.round(v)} bpm`, set: (v) => setMetronome(SL.metroOn, v) }); // prettier-ignore
  const view = el("select", { id: "sll-view", ariaLabel: "Screen" });
  for (const [id, name] of [["all", "All four"], ["spectrogram", "Spectrogram"], ["spectrum", "Spectrum"], ["scope", "Oscilloscope"]]) view.add(new Option(name, id)); // prettier-ignore
  view.value = SL.view;
  view.addEventListener("change", () => {
    SL.view = view.value;
    SL.version++;
    live.wake?.();
  });
  const row3 = el("div", { className: "button-row" }, metro, view);
  const note = el("p", { className: "note", id: "sll-note" });
  box.append(row1, fA.row, el("div", { className: "button-row" }, num), vol.row, twoRow, fB.row, presets, el("h3", { textContent: "Metronome and screen" }), row3, bpm.row, note); // prettier-ignore
  const sync = () => {
    play.textContent = SL.toneOn ? "Stop the tone" : "Play a tone";
    play.classList.toggle("primary", !SL.toneOn);
    metro.textContent = SL.metroOn ? "Stop the metronome" : "Start the metronome";
    fB.row.hidden = !SL.tone.two;
    note.textContent = SL.sound && !SL.sound.enabled ? "The site's sound is off, so the screen shows the tone but the speaker stays quiet. Tap the speaker button to hear it." : ""; // prettier-ignore
    note.hidden = !note.textContent;
  };
  sync();
  const timer = setInterval(() => (box.isConnected ? sync() : clearInterval(timer)), 250);
  return box;
}

const micStatus = () => {
  if (SL.source !== "mic") return "";
  const p = SL.peak ? `, loudest at ${hzText(SL.peak.hz)}` : "";
  return `Listening: ${SL.level.toFixed(1)} dBFS (about ${Math.round(splEstimate(SL.level, SL.fullScale))} dB SPL, uncalibrated)${p}.`; // prettier-ignore
};

const SOUND_LAB = {
  alive: () => SL.toneOn || SL.metroOn || live.on("mic"),
  density: 2, // r2: a higher budget and (labs) a sharper splat edge
  kernel: "sharp",
  render: { cull: "low", dpr: "native" },
  turntable: false,
  options: [
    {
      key: "fullScale",
      label: "Level estimate: full scale is (dB SPL)",
      type: "slider",
      min: 90,
      max: 140,
      step: 1,
      default: FULL_SCALE_SPL,
    },
  ],
  controls: [{ key: "tone", label: "Tone", type: "toggle", default: 0, ease: 0.05 }],
  action: { key: "tone", label: "Play or stop the tone", quiet: ["tone"] },
  input: {
    title: "Sound lab",
    fileButton: false,
    live: [{ render: soundLabPanel }, { kind: "mic", rebuild: false, status: micStatus }],
    note: "Tap “Use my microphone” to see what it hears. The sound goes only to the screen: nothing is recorded, stored or sent.",
  },
  screen: {
    width: SW,
    height: SH,
    version: () => SL.version,
    draw: (g) => drawSoundLab(g),
  },
  drive(t, c, out, info) {
    const time = info.time ?? t;
    SL.lastDrive = performance.now();
    if (info.sound) SL.sound = info.sound;
    const on = (c.tone ?? 0) > 0.5;
    if (on && !SL.toneOn) SL.toneT0 = time;
    SL.toneOn = on;
    const audible = on && !!SL.sound?.enabled;
    if (audible && !SL.audio) {
      startAudio(SL.sound);
      watch();
    } else if (!audible && SL.audio) stopAudio();
    analyze(time);
    // The metronome: its clock starts at the first frame after Start.
    if (SL.metroOn && SL.metroT0 === null) SL.metroT0 = time;
    const mt = SL.metroOn ? time - SL.metroT0 : 0;
    const m = metronome(SL.bpm, mt);
    out.parts.rod = { angle: SL.metroOn ? -m.angle : 0 };
    if (SL.metroOn && SL.sound?.enabled) {
      const ctx = SL.sound.audio();
      if (ctx && SL.sound.master)
        for (const k of clickTimes(SL.bpm, mt, mt + 0.15))
          if (k.k > SL.metroDone) {
            SL.metroDone = k.k;
            click(ctx, SL.sound.master, ctx.currentTime + Math.max(0, k.t - mt), k.k % 4 === 0);
          }
    }
    // The speaker's cone: where it is at this moment (the signal now, scaled
    // up a hundred times so it shows).
    const x = SL.source === "tone" ? SL.buf[N - 1] : 0;
    out.parts.cone = { offset: [0, 0, 0.012 * x] };
    out.parts.lamp = { glow: SL.toneOn ? 0.9 : 0, tint: "#ff6a3d" };
  },
  build(k, o) {
    SL.fullScale = o.fullScale ?? FULL_SCALE_SPL;
    SL.version++;
    // The instrument: a dark case, its screen a panel of splats.
    const W = 2.4;
    const H = (W * SH) / SW;
    const cy = 0.42;
    boxSplats(k, {
      c: [0, cy, -0.085],
      w: W + 0.16,
      h: H + 0.16,
      d: 0.16,
      color: lit(shade, "#2a3038"),
    });
    const { cols, rows } = panelSize(k, 0.5, SW / SH, SW);
    screenPanel(k, { center: [0, cy, 0.002], width: W, height: H, cols, rows });
    // The speaker (left): a cabinet, a cone that moves with the signal and a
    // lamp that lights while the tone plays. r2: every piece of exactly sized
    // splats, so its edges stay crisp at phone size.
    const sx = -0.62;
    const sy = -0.8;
    const wood = (base) => (u, v, n) => shade(mix(base, "#6c472c", 0.5 + 0.5 * Math.sin(v * 46 + u * 5)), 0.74 + 0.2 * n[1] + 0.1 * n[2] + 0.04 * n[0]); // prettier-ignore
    boxSplats(k, { c: [sx, sy, 0], w: 0.78, h: 0.78, d: 0.36, skip: [4, 5], color: lit(shade, "#5a3a24") }); // prettier-ignore
    // Its front, with the hole the driver sits in.
    faceSplats(k, (u, v) => [sx + (u - 0.5) * 0.78, sy + (0.5 - v) * 0.78, 0.18], { nu: budgetN(k, 90), nv: budgetN(k, 90), n: [0, 0, 1], keep: (u, v) => Math.hypot(u - 0.5, v - 0.5) * 0.78 > 0.3, color: shade("#5a3a24", 0.86) }); // prettier-ignore
    const fz = 0.181;
    const ring = (r0, r1, z, color, part = 0) =>
      surfSplats(k, (u, v) => { const r = r0 + (r1 - r0) * v; return [sx + r * Math.cos(u * 2 * Math.PI), sy + r * Math.sin(u * 2 * Math.PI), z]; }, () => [0, 0, 1], { nu: budgetN(k, 90), nv: budgetN(k, Math.max(3, Math.round(((r1 - r0) / 0.29) * 26))), color, part }); // prettier-ignore
    ring(0.29, 0.31, fz, "#141416"); // the rim
    ring(0.25, 0.29, fz + 0.004, (u, v) => shade("#232326", 0.8 + 0.35 * Math.sin(v * Math.PI))); // the rubber surround
    const cone = k.part("cone", { pivot: [sx, sy, 0.19] });
    // The cone: from the voice coil (r 0.07, set back 0.06) out to the surround.
    surfSplats(
      k,
      (u, v) => {
        const r = 0.07 + 0.18 * v;
        return [
          sx + r * Math.cos(u * 2 * Math.PI),
          sy + r * Math.sin(u * 2 * Math.PI),
          fz - 0.06 * (1 - v),
        ];
      },
      (u) => [-0.32 * Math.cos(u * 2 * Math.PI), -0.32 * Math.sin(u * 2 * Math.PI), 0.95],
      { nu: budgetN(k, 96), nv: budgetN(k, 22), part: cone, color: (u, v) => shade("#2b2b2e", 0.72 + 0.3 * v + 0.06 * Math.sin(u * 64)) }, // prettier-ignore
    );
    // The dust cap: a shallow dome over the coil.
    surfSplats(
      k,
      (u, v) => {
        const r = 0.07 * v;
        return [
          sx + r * Math.cos(u * 2 * Math.PI),
          sy + r * Math.sin(u * 2 * Math.PI),
          fz - 0.06 + 0.03 * Math.sqrt(1 - v * v),
        ];
      },
      (u, v) => [0.5 * v * Math.cos(u * 2 * Math.PI), 0.5 * v * Math.sin(u * 2 * Math.PI), 1],
      { nu: budgetN(k, 40), nv: budgetN(k, 8), part: cone, color: (u, v) => shade("#3a3a3e", 0.85 + 0.25 * (1 - v)) }, // prettier-ignore
    );
    const lamp = k.part("lamp", { pivot: [sx + 0.3, sy + 0.3, 0.19] });
    sphereSplats(k, { c: [sx + 0.3, sy + 0.3, 0.19], r: 0.025, n: budgetN(k, 24), part: lamp, color: "#7a2a1a" }); // prettier-ignore
    // The metronome (right): a wooden body and a rod that swings about its
    // foot, with the sliding weight.
    const mx = 0.66;
    const my = -1.2;
    const fr = { w0: 0.56, w1: 0.16, d0: 0.34, d1: 0.12, h: 0.74 };
    const at = (side, u, t) => {
      const w = fr.w0 + (fr.w1 - fr.w0) * t;
      const d = fr.d0 + (fr.d1 - fr.d0) * t;
      const a = u - 0.5;
      if (side === 0) return [mx + a * w, my + t * fr.h, d / 2];
      if (side === 1) return [mx - a * w, my + t * fr.h, -d / 2];
      if (side === 2) return [mx + w / 2, my + t * fr.h, -a * d];
      return [mx - w / 2, my + t * fr.h, a * d];
    };
    const sideN = [
      [0, (fr.d0 - fr.d1) / 2 / fr.h, 1],
      [0, (fr.d0 - fr.d1) / 2 / fr.h, -1],
      [1, (fr.w0 - fr.w1) / 2 / fr.h, 0],
      [-1, (fr.w0 - fr.w1) / 2 / fr.h, 0],
    ].map((v) => { const l = Math.hypot(...v); return v.map((x) => x / l); }); // prettier-ignore
    for (let side = 0; side < 4; side++)
      surfSplats(k, (u, v) => at(side, u, v), () => sideN[side], { nu: budgetN(k, side < 2 ? 48 : 30), nv: budgetN(k, 56), color: wood("#8a5530") }); // prettier-ignore
    boxSplats(k, { c: [mx, my + fr.h + 0.006, 0], w: fr.w1, h: 0.012, d: fr.d1, color: lit(shade, "#9a6236") }); // prettier-ignore
    boxSplats(k, {
      c: [mx, my + 0.38, 0.105],
      w: 0.18,
      h: 0.5,
      d: 0.012,
      color: lit(shade, "#e9dcc0"),
    }); // the scale
    const rod = k.part("rod", { pivot: [mx, my + 0.1, 0.13], axis: [0, 0, 1] });
    boxSplats(k, { c: [mx, my + 0.1 + 0.35, 0.135], w: 0.02, h: 0.7, d: 0.016, gap: 0.006, part: rod, color: lit(shade, "#c9ccd2") }); // prettier-ignore
    boxSplats(k, { c: [mx, my + 0.56, 0.15], w: 0.1, h: 0.07, d: 0.05, gap: 0.008, part: rod, color: lit(shade, "#d8b04a") }); // prettier-ignore
    k.reach([mx - 0.35, my + 0.8, 0.2]);
    k.reach([mx + 0.35, my + 0.8, 0.2]);
    k.data = { soundLab: true };
  },
};

// ---- The Sound recorder -------------------------------------------------------------

export const REC = {
  rec: null, // a MicRecorder while recording
  take: null, // { samples, rate, duration, name }
  a: 0, // the trim, seconds
  b: 0,
  playing: null, // { ctx, src, start, from, to }
  sound: null,
  version: 0,
  spec: null, // the take's spectrogram
  wave: null, // its waveform (min, max per column)
  message: "",
  encoding: false,
  lastDrive: 0,
  watchdog: null,
};

export const recorderState = () => ({
  recording: !!REC.rec,
  take: REC.take && { duration: REC.take.duration, rate: REC.take.rate, name: REC.take.name, n: REC.take.samples.length }, // prettier-ignore
  trim: [REC.a, REC.b],
  playing: !!REC.playing,
  message: REC.message,
});

// The sample before anything is recorded: a little tune the page makes
// (three plucked notes and a chord), so the screens have something to show.
export function sampleTake(rate = 48000) {
  const notes = [
    [0.1, 392],
    [0.45, 523.25],
    [0.8, 659.25],
    [1.25, 523.25],
    [1.25, 659.25],
    [1.25, 783.99],
  ];
  const n = Math.round(rate * 2.6);
  const x = new Float32Array(n);
  for (const [at, f] of notes)
    for (let i = Math.round(at * rate); i < n; i++) {
      const t = i / rate - at;
      const env = Math.exp(-t * 2.4) * Math.min(1, t * 400);
      x[i] += 0.22 * env * (Math.sin(2 * Math.PI * f * t) + 0.35 * Math.sin(4 * Math.PI * f * t) + 0.12 * Math.sin(6 * Math.PI * f * t)); // prettier-ignore
    }
  return { samples: x, rate, duration: n / rate, name: "Sample tune (made by the page)" };
}

// Sets the take (a recording, or a test's samples) and its pictures.
export function setTake(take) {
  stopPlayback();
  REC.take = take;
  REC.a = 0;
  REC.b = take.duration;
  REC.spec = spectrogram(take.samples, take.rate, { frames: 200, perOctave: 12, size: 2048 });
  const cols = 400;
  const w = new Float32Array(cols * 2);
  const per = take.samples.length / cols;
  for (let c = 0; c < cols; c++) {
    let lo = 0;
    let hi = 0;
    for (
      let i = Math.floor(c * per);
      i < Math.min(take.samples.length, Math.floor((c + 1) * per));
      i++
    ) {
      const v = take.samples[i];
      if (v < lo) lo = v;
      if (v > hi) hi = v;
    }
    w[c * 2] = lo;
    w[c * 2 + 1] = hi;
  }
  REC.wave = { cols, w };
  REC.version++;
}

export function setTrim(a, b) {
  if (!REC.take) return;
  const d = REC.take.duration;
  REC.a = clamp(Number(a) || 0, 0, d);
  REC.b = clamp(Number(b) || 0, 0, d);
  if (REC.b < REC.a + 0.05) REC.b = Math.min(d, REC.a + 0.05);
  REC.version++;
}

// The trimmed take, and its WAV file.
export function trimmedTake() {
  const t = REC.take;
  return t ? { samples: trimmed(t.samples, t.rate, REC.a, REC.b), rate: t.rate } : null;
}
export function recordingWav() {
  const t = trimmedTake();
  return t ? wavBytes(t.samples, t.rate) : null;
}

async function startRecording(error) {
  if (REC.rec) return;
  stopPlayback();
  try {
    await startLive("mic", { owner: "sound-recorder" });
  } catch (err) {
    error(err.message);
    return;
  }
  if (!live.mic) return;
  REC.rec = new MicRecorder(live.mic);
  REC.message = "";
  REC.version++;
}

function stopRecording() {
  if (!REC.rec) return;
  const r = REC.rec.finish();
  REC.rec = null;
  releaseLive("sound-recorder");
  if (r.duration >= 0.2) {
    const d = new Date();
    setTake({ ...r, name: `Your recording (${d.toLocaleTimeString()})` });
  } else REC.message = "That was too short to keep. Tap Record and make a sound.";
  REC.version++;
}

function playTake() {
  const t = trimmedTake();
  const sound = REC.sound;
  if (!t || !sound?.enabled) {
    REC.message = "The site's sound is off. Tap the speaker button, then Play.";
    return;
  }
  const ctx = sound.audio();
  if (!ctx || !sound.master) return;
  stopPlayback();
  const buf = ctx.createBuffer(1, t.samples.length, t.rate);
  buf.copyToChannel(t.samples, 0);
  const src = ctx.createBufferSource();
  src.buffer = buf;
  src.connect(sound.master);
  src.start();
  REC.playing = { ctx, src, start: ctx.currentTime, from: REC.a, to: REC.b };
  src.onended = () => {
    if (REC.playing?.src === src) REC.playing = null;
    REC.version++;
  };
  REC.message = "";
  if (!REC.watchdog)
    REC.watchdog = setInterval(() => {
      if (performance.now() - REC.lastDrive < 400) return;
      stopPlayback();
      clearInterval(REC.watchdog);
      REC.watchdog = null;
    }, 200);
}

function stopPlayback() {
  const p = REC.playing;
  REC.playing = null;
  try {
    p?.src.stop();
  } catch {
    // Already ended.
  }
  REC.version++;
}

const stamp = () => {
  const d = new Date();
  const p = (n) => String(n).padStart(2, "0");
  return `${d.getFullYear()}${p(d.getMonth() + 1)}${p(d.getDate())}-${p(d.getHours())}${p(d.getMinutes())}${p(d.getSeconds())}`; // prettier-ignore
};

// Saves to a file the person chooses: the browser's save dialog where it
// has one, else its usual download (which asks or uses its downloads
// folder, as the person has set it).
async function saveFile(blob, name, type) {
  if (typeof window.showSaveFilePicker === "function") {
    try {
      const ext = name.slice(name.lastIndexOf("."));
      const h = await window.showSaveFilePicker({ suggestedName: name, types: [{ description: "Sound", accept: { [type]: [ext] } }] }); // prettier-ignore
      const w = await h.createWritable();
      await w.write(blob);
      await w.close();
      return true;
    } catch (err) {
      if (err?.name === "AbortError") return false;
    }
  }
  const url = URL.createObjectURL(blob);
  const a = el("a", { href: url, download: name, rel: "noopener" });
  document.body.append(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 4000);
  return true;
}

const COMPRESSED = ["audio/webm;codecs=opus", "audio/ogg;codecs=opus", "audio/mp4;codecs=mp4a.40.2", "audio/mp4", "audio/webm"]; // prettier-ignore
export const compressedType = () =>
  typeof MediaRecorder === "undefined" ? null : COMPRESSED.find((t) => MediaRecorder.isTypeSupported(t)) || null; // prettier-ignore

// A compressed copy (Opus or AAC, as the browser can): the trimmed take is
// played, silently, into the browser's recorder, so it takes as long as the
// sound itself.
async function compress() {
  const type = compressedType();
  const t = trimmedTake();
  if (!type || !t) return null;
  const AC = window.AudioContext || window.webkitAudioContext;
  const ctx = new AC({ sampleRate: t.rate });
  try {
    const dest = ctx.createMediaStreamDestination();
    const buf = ctx.createBuffer(1, t.samples.length, t.rate);
    buf.copyToChannel(t.samples, 0);
    const src = ctx.createBufferSource();
    src.buffer = buf;
    src.connect(dest);
    const rec = new MediaRecorder(dest.stream, { mimeType: type, audioBitsPerSecond: 128000 });
    const chunks = [];
    rec.ondataavailable = (e) => e.data.size && chunks.push(e.data);
    const done = new Promise((r) => (rec.onstop = r));
    rec.start();
    src.start();
    await new Promise((r) => (src.onended = r));
    await new Promise((r) => setTimeout(r, 150));
    rec.stop();
    await done;
    return { blob: new Blob(chunks, { type: type.split(";")[0] }), ext: type.includes("mp4") ? "m4a" : type.includes("ogg") ? "ogg" : "webm" }; // prettier-ignore
  } finally {
    ctx.close().catch(() => {});
  }
}

function recorderPanel() {
  const box = el("div", { className: "sll-panel", id: "sll-recorder" });
  const error = el("div", { className: "warning", role: "alert", hidden: true });
  const say = (m) => {
    error.textContent = m;
    error.hidden = !m;
  };
  const rec = el("button", { type: "button", id: "sll-record" });
  rec.addEventListener("click", async () => {
    say("");
    if (REC.rec) stopRecording();
    else await startRecording(say);
    sync();
  });
  const play = el("button", { type: "button", id: "sll-play" });
  play.addEventListener("click", () => {
    if (REC.playing) stopPlayback();
    else playTake();
    sync();
  });
  const status = el("p", { className: "note", id: "sll-rec-status" });
  const trimA = rangeRow("sll-trim-a", "Start", { min: 0, max: 1, step: 0.001, value: 0, fmt: (v) => `${(v * (REC.take?.duration || 0)).toFixed(2)} s`, set: (v) => setTrim(v * REC.take.duration, REC.b) }); // prettier-ignore
  const trimB = rangeRow("sll-trim-b", "End", { min: 0, max: 1, step: 0.001, value: 1, fmt: (v) => `${(v * (REC.take?.duration || 0)).toFixed(2)} s`, set: (v) => setTrim(REC.a, v * REC.take.duration) }); // prettier-ignore
  const fit = el("button", { type: "button", id: "sll-trim-fit", textContent: "Trim the silence" });
  fit.addEventListener("click", () => {
    if (!REC.take) return;
    const [a, b] = soundSpan(REC.take.samples, REC.take.rate);
    setTrim(a, b);
    showTrim();
  });
  const all = el("button", { type: "button", id: "sll-trim-all", textContent: "Keep it all" });
  all.addEventListener("click", () => {
    if (!REC.take) return;
    setTrim(0, REC.take.duration);
    showTrim();
  });
  const wav = el("button", { type: "button", id: "sll-save-wav", textContent: "Save as WAV" });
  wav.addEventListener("click", () => {
    const bytes = recordingWav();
    if (bytes) saveFile(new Blob([bytes], { type: "audio/wav" }), `splashery-recording-${stamp()}.wav`, "audio/wav"); // prettier-ignore
  });
  const small = el("button", { type: "button", id: "sll-save-small" });
  const type = compressedType();
  small.textContent = type?.includes("mp4") ? "Save as M4A (smaller)" : type?.includes("ogg") ? "Save as Ogg (smaller)" : "Save as WebM (smaller)"; // prettier-ignore
  small.hidden = !type;
  small.addEventListener("click", async () => {
    if (REC.encoding) return;
    REC.encoding = true;
    sync();
    try {
      const r = await compress();
      if (r) await saveFile(r.blob, `splashery-recording-${stamp()}.${r.ext}`, r.blob.type);
    } catch (err) {
      say(`The smaller file couldn't be made (${err.message}). The WAV file works everywhere.`);
    } finally {
      REC.encoding = false;
      sync();
    }
  });
  function showTrim() {
    const d = REC.take?.duration || 1;
    trimA.show(REC.a / d);
    trimB.show(REC.b / d);
  }
  box.append(
    el("div", { className: "button-row" }, rec, play),
    status,
    el("h3", { textContent: "Trim" }),
    trimA.row,
    trimB.row,
    el("div", { className: "button-row" }, fit, all),
    el("h3", { textContent: "Save" }),
    el("div", { className: "button-row" }, wav, small),
    el("p", { className: "note", textContent: "Recording stays in this page's memory on this device. Nothing is sent anywhere, and it's saved only to a file you choose. To show the Operator a sound, attach the file to a message in the chat." }), // prettier-ignore
    error,
  );
  let lastTake = null;
  function sync() {
    rec.textContent = REC.rec ? "Stop recording" : "Record";
    rec.classList.toggle("primary", true);
    rec.classList.toggle("sll-recording", !!REC.rec);
    play.textContent = REC.playing ? "Stop" : "Play";
    play.disabled = !!REC.rec || !REC.take;
    const off = !REC.take || !!REC.rec;
    for (const b of [fit, all, wav, small, trimA.input, trimB.input])
      b.disabled = off || REC.encoding;
    if (REC.take !== lastTake) {
      lastTake = REC.take;
      showTrim();
    }
    status.textContent = REC.rec
      ? `Recording: ${clock(REC.rec.seconds)} (up to 10 minutes). Tap Stop recording when you're done.`
      : REC.encoding
        ? "Making the smaller file: it takes as long as the sound."
        : REC.message || (REC.take ? `${REC.take.name}: ${REC.take.duration.toFixed(2)} s, keeping ${REC.a.toFixed(2)} to ${REC.b.toFixed(2)} s.` : ""); // prettier-ignore
  }
  sync();
  const timer = setInterval(() => {
    if (!box.isConnected) {
      clearInterval(timer);
      return;
    }
    if (REC.rec && !live.on("mic")) stopRecording(); // the Live pill's Stop
    sync();
  }, 200);
  return box;
}

// The recorder's screen: the waveform over the spectrogram, the kept span
// bright and the rest dimmed, the play head, and while recording, the live
// level and the time so far.
function drawRecorder(g) {
  g.fillStyle = "#05070b";
  g.fillRect(0, 0, SW, SH);
  const t = REC.take;
  if (REC.rec) {
    label(g, "● Recording", 12, 24, { size: 18, color: "#ff6a5a", weight: "700" });
    label(g, clock(REC.rec.seconds), SW - 12, 24, { size: 18, color: "#ffe9a8", weight: "700", align: "right" }); // prettier-ignore
    const mic = live.mic;
    if (mic && mic.written > 4096) {
      const x = mic.recent(4096);
      const r = { x: 8, y: 40, w: SW - 16, h: SH - 48 };
      box(g, r, "");
      g.beginPath();
      for (let i = 0; i < 4096; i += 4) {
        const px = r.x + (i / 4096) * r.w;
        const py = r.y + r.h / 2 - clamp(x[i], -1, 1) * (r.h / 2 - 8);
        if (i === 0) g.moveTo(px, py);
        else g.lineTo(px, py);
      }
      g.strokeStyle = "#ff8a7a";
      g.lineWidth = 2;
      g.stroke();
      const db = rmsDb(x, 4096 - 2400, 4096);
      label(g, `${db.toFixed(1)} dBFS`, r.x + r.w - 8, r.y + 18, { size: 14, color: "#ffe9a8", align: "right" }); // prettier-ignore
    }
    return;
  }
  if (!t) return;
  label(g, t.name, 12, 22, { size: 15, color: "#e6eef5", weight: "700" });
  label(g, `${t.duration.toFixed(2)} s · ${t.rate} Hz`, SW - 12, 22, { size: 15, color: "#9fb2c4", align: "right" }); // prettier-ignore
  const wr = { x: 8, y: 32, w: SW - 16, h: 120 };
  const sr = { x: 8, y: 158, w: SW - 16, h: SH - 166 };
  box(g, wr, "");
  box(g, sr, "");
  const { cols, w } = REC.wave;
  const xa = (sec) => wr.x + (sec / t.duration) * wr.w;
  for (let c = 0; c < cols; c++) {
    const sec = ((c + 0.5) / cols) * t.duration;
    const kept = sec >= REC.a && sec <= REC.b;
    g.fillStyle = kept ? "#7dffb0" : "#2f4a3c";
    const x = wr.x + (c / cols) * wr.w;
    const y0 = wr.y + wr.h / 2 - w[c * 2 + 1] * (wr.h / 2 - 6);
    const y1 = wr.y + wr.h / 2 - w[c * 2] * (wr.h / 2 - 6);
    g.fillRect(x, y0, Math.max(1, wr.w / cols), Math.max(1, y1 - y0));
  }
  // The spectrogram (30 Hz to 16 kHz, log), the dropped span dimmed.
  const S = REC.spec;
  const img = g.createImageData(S.nt, S.nf);
  for (let ti = 0; ti < S.nt; ti++)
    for (let f = 0; f < S.nf; f++) {
      const [R, G, B] = heat((S.db[ti * S.nf + f] - DB_LO) / (DB_HI - DB_LO));
      const o = ((S.nf - 1 - f) * S.nt + ti) * 4;
      img.data[o] = R;
      img.data[o + 1] = G;
      img.data[o + 2] = B;
      img.data[o + 3] = 255;
    }
  const tmp = scratch(S.nt, S.nf);
  tmp.g.putImageData(img, 0, 0);
  g.drawImage(tmp.c, sr.x + 2, sr.y + 2, sr.w - 4, sr.h - 4);
  g.fillStyle = "rgba(5,7,11,0.7)";
  g.fillRect(sr.x, sr.y, xa(REC.a) - wr.x, sr.h);
  g.fillRect(xa(REC.b), sr.y, wr.x + wr.w - xa(REC.b), sr.h);
  for (const hz of [100, 1000, 10000]) {
    const y = sr.y + 2 + (1 - Math.log(hz / 40) / Math.log(16000 / 40)) * (sr.h - 4);
    g.fillStyle = "rgba(255,255,255,0.2)";
    g.fillRect(sr.x, Math.round(y), sr.w, 1);
    label(g, hz >= 1000 ? `${hz / 1000} kHz` : `${hz} Hz`, sr.x + 6, y - 3, { size: 13, color: "#9fb2c4" }); // prettier-ignore
  }
  // The trim marks and the play head.
  g.fillStyle = "#ffe9a8";
  for (const s of [REC.a, REC.b]) g.fillRect(Math.round(xa(s)) - 1, wr.y, 2, sr.y + sr.h - wr.y);
  if (REC.playing) {
    const p = REC.playing;
    const at = p.from + (p.ctx.currentTime - p.start);
    if (at <= p.to) {
      g.fillStyle = "#ffffff";
      g.fillRect(Math.round(xa(at)) - 1, wr.y, 3, sr.y + sr.h - wr.y);
    }
  }
}

const SOUND_RECORDER = {
  alive: () => !!REC.rec || !!REC.playing,
  density: 2, // r2: a higher budget and (labs) a sharper splat edge
  kernel: "sharp",
  render: { cull: "low", dpr: "native" },
  turntable: false,
  controls: [{ key: "play", label: "Play", type: "pulse", ease: 0.3 }],
  action: { key: "play", label: "Play or stop the recording", quiet: ["play"] },
  input: {
    title: "Sound recorder",
    fileButton: false,
    live: [{ render: recorderPanel }],
    note: "",
  },
  screen: {
    width: SW,
    height: SH,
    version: (time) => (REC.rec || REC.playing ? `${REC.version}|${Math.floor(time * 30)}` : REC.version), // prettier-ignore
    draw: (g) => drawRecorder(g),
  },
  drive(t, c, out, info) {
    REC.lastDrive = performance.now();
    if (info.sound) REC.sound = info.sound;
    const n = info.tap?.n ?? 0;
    if (REC.taps === undefined || n < REC.taps) REC.taps = n;
    if (n > REC.taps) {
      REC.taps = n;
      if (REC.rec) stopRecording();
      else if (REC.playing) stopPlayback();
      else playTake();
    }
    out.parts.lamp = { glow: REC.rec ? 0.6 + 0.4 * Math.sin((info.time ?? t) * 6) : 0, tint: "#ff3b2f" }; // prettier-ignore
  },
  build(k) {
    if (!REC.take) setTake(sampleTake());
    REC.version++;
    const W = 2.4;
    const H = (W * SH) / SW;
    const cy = 0.4;
    boxSplats(k, {
      c: [0, cy, -0.085],
      w: W + 0.16,
      h: H + 0.16,
      d: 0.16,
      color: lit(shade, "#2a3038"),
    });
    const { cols, rows } = panelSize(k, 0.5, SW / SH, SW);
    screenPanel(k, { center: [0, cy, 0.002], width: W, height: H, cols, rows });
    // A studio microphone on a short stand, its lamp red while it records.
    const my = -1.18;
    // r2: the microphone of exactly sized splats (a weighted base, a satin
    // stem, the body and a wire-mesh grille), crisp at phone size.
    const metal =
      (base, k1 = 0.3) =>
      (u, v, n) =>
        shade(base, 0.82 + k1 * n[1] + 0.14 * n[2] + 0.08 * n[0]);
    cylinderSplats(k, { c: [0, my, 0], r: 0.2, h: 0.035, n: budgetN(k, 120), color: metal("#2c2e33") }); // prettier-ignore
    cylinderSplats(k, { c: [0, my + 0.18, 0], r: 0.018, h: 0.34, n: budgetN(k, 20), caps: "none", color: metal("#8a8f98", 0.1) }); // prettier-ignore
    cylinderSplats(k, { c: [0, my + 0.44, 0], r: 0.085, h: 0.2, n: budgetN(k, 72), color: metal("#3a3d44", 0.15) }); // prettier-ignore
    // The grille: a fine mesh of bright wires on a darker cage.
    sphereSplats(k, {
      c: [0, my + 0.6, 0],
      r: 0.1,
      n: budgetN(k, 96),
      color: (u, v, n) => {
        const wire =
          Math.abs(Math.sin(u * Math.PI * 28)) < 0.3 || Math.abs(Math.sin(v * Math.PI * 16)) < 0.3;
        return shade(wire ? "#d5dae2" : "#5d636c", 0.85 + 0.25 * n[1] + 0.1 * n[2]);
      },
    });
    const lamp = k.part("lamp", { pivot: [0, my + 0.44, 0.088] });
    sphereSplats(k, { c: [0, my + 0.44, 0.088], r: 0.018, n: budgetN(k, 20), part: lamp, color: "#5a1a14" }); // prettier-ignore
    k.data = { recorder: true };
  },
};

export const RECIPES = {
  "sound-lab": SOUND_LAB,
  "sound-recorder": SOUND_RECORDER,
};
