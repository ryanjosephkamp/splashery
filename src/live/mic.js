// Live input (lane Live input): the microphone's analyser. Loaded by
// src/live/live.js only once someone has tapped "Use my microphone" and the
// browser has given the stream.
//
// The sound goes into an AnalyserNode (the spectrum) and an AudioWorklet
// (every sample, src/live/capture-worklet.js), and from there nowhere: the
// worklet's output is silenced, so nothing reaches the speakers. About 60
// times a second the analyser works out
//
//   level   0..1 (the last 50 ms's loudness, −60 dBFS to 0)
//   db      the same in dB (full scale)
//   spectrum the analyser's spectrum (dB per bin, 0 Hz to rate / 2)
//   pitch   { hz, clarity, note } of a sung or played note, or null
//
// and on every 5 ms hop it listens for claps (OnsetDetector). Each clap
// also starts a measurement of the room's reverberation (measureDecay):
// the energy of the next 2.5 s, which ends early if another clap comes.

import { detectPitch, noteOf, OnsetDetector, measureDecay } from "./analysis.js";

const WORKLET = new URL("./capture-worklet.js", import.meta.url).href;

export async function startAnalyser(stream) {
  const AC = globalThis.AudioContext || globalThis.webkitAudioContext;
  if (!AC) throw Object.assign(new Error("no Web Audio"), { name: "NotSupportedError" });
  const ctx = new AC({ latencyHint: "interactive" });
  if (ctx.state === "suspended") await ctx.resume().catch(() => {});
  const src = ctx.createMediaStreamSource(stream);
  const analyser = ctx.createAnalyser();
  analyser.fftSize = 4096;
  analyser.smoothingTimeConstant = 0.35;
  src.connect(analyser);
  const mic = new MicAnalyser(ctx, analyser);
  // Every sample, through the worklet (or, where there is none, the
  // analyser's own window read on each frame).
  if (ctx.audioWorklet) {
    try {
      await ctx.audioWorklet.addModule(WORKLET);
      const node = new AudioWorkletNode(ctx, "splashery-capture", { numberOfOutputs: 1 });
      const mute = ctx.createGain();
      mute.gain.value = 0;
      src.connect(node);
      node.connect(mute);
      mute.connect(ctx.destination);
      node.port.onmessage = (e) => mic.samples(e.data);
      mic.node = node;
      mic.mute = mute;
    } catch {
      mic.node = null;
    }
  }
  mic.src = src;
  mic.begin();
  return mic;
}

const RING = 2 ** 17; // about 2.7 s at 48 kHz

export class MicAnalyser {
  constructor(ctx, analyser) {
    this.ctx = ctx;
    this.rate = ctx.sampleRate;
    this.analyser = analyser;
    this.spectrum = new Float32Array(analyser.frequencyBinCount).fill(-120);
    this.ring = new Float32Array(RING);
    this.written = 0; // samples written since the start
    this.hop = Math.max(64, Math.round(this.rate * 0.005));
    this.hopAt = 0; // samples into the current hop
    this.hopSum = 0;
    this.onsets = new OnsetDetector({ hopMs: (this.hop / this.rate) * 1000 });
    this.window = new Float32Array(2048);
    this.level = 0;
    this.db = -120;
    this.pitch = null;
    this.claps = 0; // how many claps so far
    this.clapAt = -1; // the page's time (ms) of the last one
    this.decay = null; // the measurement in progress
    this.lastDecay = null; // the last result: measureDecay's, plus at
    this.frames = 0;
    this.listeners = { frame: new Set(), clap: new Set(), decay: new Set() };
    this.timer = null;
    this.node = null;
  }

  on(what, fn) {
    this.listeners[what].add(fn);
    return () => this.listeners[what].delete(fn);
  }

  emit(what, value) {
    for (const fn of [...this.listeners[what]]) {
      try {
        fn(value);
      } catch (err) {
        console.error(err);
      }
    }
  }

  begin() {
    // About 60 times a second, also while the page's frames are paused.
    this.timer = setInterval(() => this.tick(), 16);
  }

  // A block of samples from the worklet.
  samples(block) {
    const ring = this.ring;
    for (let i = 0; i < block.length; i++) {
      const v = block[i];
      ring[this.written++ & (RING - 1)] = v;
      this.hopSum += v * v;
      if (++this.hopAt === this.hop) this.endHop(this.hopSum / this.hop);
    }
  }

  endHop(energy) {
    this.hopAt = 0;
    this.hopSum = 0;
    if (this.decay) {
      this.decay.energy.push(energy);
      if (this.decay.energy.length >= this.decay.want) this.finishDecay();
    }
    if (this.onsets.push(energy)) {
      if (this.decay) this.finishDecay();
      this.claps++;
      this.clapAt = performance.now();
      this.emit("clap", { n: this.claps, at: this.clapAt });
      // The decay starts with the hop before the clap's (its rise).
      this.decay = {
        energy: [energy],
        noise: this.onsets.background(),
        want: Math.round(2.5 / (this.hop / this.rate)),
      };
    }
  }

  finishDecay() {
    const d = this.decay;
    this.decay = null;
    const r = measureDecay(Float32Array.from(d.energy), this.hop / this.rate, d.noise);
    this.lastDecay = { ...r, at: performance.now(), n: this.claps };
    this.emit("decay", this.lastDecay);
  }

  // The last n samples (a new array).
  recent(n, out = new Float32Array(n)) {
    const end = this.written;
    for (let i = 0; i < n; i++) out[i] = this.ring[(end - n + i) & (RING - 1)];
    return out;
  }

  tick() {
    this.analyser.getFloatFrequencyData(this.spectrum);
    let win;
    if (this.node) {
      if (this.written < this.window.length) return;
      win = this.recent(this.window.length, this.window);
    } else {
      this.analyser.getFloatTimeDomainData(this.window);
      win = this.window;
      // Without the worklet, claps are heard frame by frame.
      let e = 0;
      for (let i = win.length - 800; i < win.length; i++) e += win[i] * win[i];
      this.endHop(e / 800);
    }
    let s = 0;
    const tail = Math.min(win.length, Math.round(this.rate * 0.05));
    for (let i = win.length - tail; i < win.length; i++) s += win[i] * win[i];
    const rms = Math.sqrt(s / tail);
    this.db = rms > 0 ? 20 * Math.log10(rms) : -120;
    this.level = Math.max(0, Math.min(1, (this.db + 60) / 60));
    const p = detectPitch(win, this.rate);
    this.pitch = p && p.clarity > 0.8 ? { ...p, note: noteOf(p.hz) } : null;
    this.frames++;
    this.emit("frame", this);
  }

  close() {
    clearInterval(this.timer);
    this.timer = null;
    for (const set of Object.values(this.listeners)) set.clear();
    try {
      if (this.node) this.node.port.onmessage = null;
      this.src?.disconnect();
      this.node?.disconnect();
      this.mute?.disconnect();
    } catch {
      // Already disconnected.
    }
    this.ctx.close().catch(() => {});
  }
}
