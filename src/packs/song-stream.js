// The song landscape's player and analysis for an opened song (lane Live
// input r2). Opening a long song used to decode the whole file and measure
// its spectrogram on the page's thread before anything could play (about
// 12 s for a 10-minute song at a 6× slower CPU, the page frozen). Now:
//
// - Track plays the file itself, as soon as the browser can, through an
//   <audio> element routed to the site's speaker button. Nothing is
//   decoded, resampled or re-encoded on the way, so it sounds exactly as
//   the file does. Its clock (time()) is what is being heard: the element's
//   position, smoothed between its updates, less the audio output's latency.
// - SongAnalysis decodes a copy for measuring (an MP3 in pieces of about
//   30 s, so the page never waits on one long decode) and hands it to a
//   worker (song-worker.js) that measures it in two-second chunks, nearest
//   the playhead first. The toy draws each chunk as it arrives.

import { makeFeatures, FIELDS } from "./song-analysis.js";
import { mp3Frames } from "./song-mp3.js";

export class Track {
  constructor(url) {
    const el = new Audio();
    el.preload = "auto";
    el.src = url;
    this.el = el;
    this.src = null;
    this.ctx = null;
    this.blocked = false;
    this.anchor = null;
    this.ready = new Promise((resolve, reject) => {
      el.addEventListener("loadedmetadata", () => resolve(el.duration), { once: true });
      el.addEventListener("error", () => reject(new Error("This browser cannot read that sound file. Try an MP3, WAV, OGG or M4A.")), { once: true }); // prettier-ignore
    });
  }

  get duration() {
    return Number.isFinite(this.el.duration) ? this.el.duration : 0;
  }

  get playing() {
    return !this.el.paused && !this.el.ended;
  }

  // Through the site's sound (its speaker button and volume), once; with the
  // sound off the element plays muted, so the picture still runs.
  route(sound) {
    if (!this.src && sound?.enabled) {
      const ctx = sound.audio?.();
      if (ctx && sound.master) {
        this.src = ctx.createMediaElementSource(this.el);
        this.src.connect(sound.master);
        this.ctx = ctx;
      }
    }
    this.el.muted = !this.src;
  }

  play(sound) {
    this.route(sound);
    if (this.el.ended) this.el.currentTime = 0;
    this.blocked = false;
    this.anchor = null;
    const p = this.el.play();
    p?.catch?.(() => {
      // A phone that wants a fresh tap: the next tap plays it.
      this.blocked = true;
    });
  }

  pause() {
    this.el.pause();
    this.anchor = null;
  }

  // How far the sound is behind the element's position: the audio output's
  // own delay (where the browser reports it).
  latency() {
    const c = this.ctx;
    return c ? (c.outputLatency || 0) + (c.baseLatency || 0) : 0;
  }

  // The audio clock: the second of the song being heard now.
  time() {
    const el = this.el;
    let t = el.currentTime || 0;
    if (this.playing) {
      const now = performance.now();
      // currentTime moves in steps on some browsers: carry on from the last
      // step at the playback rate until the next one.
      if (this.anchor && this.anchor.ct === t)
        t += ((now - this.anchor.at) / 1000) * el.playbackRate;
      else this.anchor = { ct: t, at: now };
      t -= this.latency();
    }
    return Math.max(0, Math.min(this.duration || t, t));
  }

  close() {
    this.el.pause();
    try {
      this.src?.disconnect();
    } catch {
      // Already disconnected.
    }
    this.el.removeAttribute("src");
    this.el.load();
  }
}

// The decoded song as one channel, mixed a slice at a time so the page
// keeps drawing (a 10-minute song is 26 million samples a channel).
async function monoMix(buf, stop) {
  const n = buf.length;
  const nc = buf.numberOfChannels;
  const out = new Float32Array(n);
  const ch = Array.from({ length: nc }, (_, c) => buf.getChannelData(c));
  const SLICE = 1 << 19;
  for (let a = 0; a < n; a += SLICE) {
    const e = Math.min(n, a + SLICE);
    if (nc === 1) out.set(ch[0].subarray(a, e), a);
    else
      for (const c of ch) {
        const k = 1 / nc;
        for (let i = a; i < e; i++) out[i] += c[i] * k;
      }
    await new Promise((r) => setTimeout(r, 0));
    if (stop()) return null;
  }
  return out;
}

// A decoded piece as one channel.
function mixDown(buf) {
  const nc = buf.numberOfChannels;
  if (nc === 1) return buf.getChannelData(0);
  const out = new Float32Array(buf.length);
  for (let c = 0; c < nc; c++) {
    const x = buf.getChannelData(c);
    for (let i = 0; i < out.length; i++) out[i] += x[i] / nc;
  }
  return out;
}

// A song's measured frames, filled in by the worker. features (makeFeatures)
// holds them; done[i] says which are in; version changes with each chunk.
export class SongAnalysis {
  constructor() {
    this.features = null;
    this.version = 0;
    this.measured = 0;
    this.finished = false;
    this.error = null;
    this.worker = null;
    this.lastFocus = -1;
    this.started = 0;
    this.doneMs = 0;
  }

  get progress() {
    return this.features ? this.measured / this.features.n : 0;
  }

  // From a File (decoded here at `rate`) or mono samples at `rate`. An MP3
  // is decoded in pieces of about 30 s cut between its frames (song-mp3.js),
  // each handed to the worker as it is ready, so the page never waits on one
  // long decode and the picture starts filling in after the first piece.
  // Another format is decoded whole.
  async start(source, rate = 44100) {
    this.started = performance.now();
    if (source instanceof Float32Array) {
      this.open(source.length, rate);
      this.send(0, source.slice());
      this.worker?.postMessage({ type: "end" });
      return;
    }
    const AC = globalThis.OfflineAudioContext || globalThis.webkitOfflineAudioContext;
    const ctx = new AC(1, 1, rate);
    const bytes = new Uint8Array(await source.arrayBuffer());
    this.marks = { read: performance.now() - this.started };
    const fr = mp3Frames(bytes);
    if (!fr) {
      const buf = await ctx.decodeAudioData(bytes.buffer);
      this.marks.decoded = performance.now() - this.started;
      const mono = await monoMix(buf, () => this.closed);
      if (this.closed || !mono) return;
      this.open(mono.length, buf.sampleRate);
      this.send(0, mono);
      this.worker?.postMessage({ type: "end" });
      return;
    }
    // A piece decoded from frame a0 > 0 is exactly its frames' samples, the
    // first of them at a0's place; the first piece (from frame 0) lacks the
    // samples the decoder trims at the start (the encoder's delay and info
    // frame), which sets where the song's sample 0 is: `shift` samples in.
    // A few frames before each piece are decoded and dropped (an MP3 frame
    // may lean on the ones before it).
    const { offsets, samples: spf } = fr;
    const n = offsets.length;
    const k = rate / fr.rate;
    const P = Math.max(64, Math.round((30 * fr.rate) / spf));
    const W = 4;
    let shift = 0;
    let total = 0;
    for (let a = 0; a < n; a += P) {
      const b = Math.min(n, a + P);
      const a0 = Math.max(0, a - W);
      const piece = bytes.slice(a0 === 0 ? 0 : offsets[a0], b < n ? offsets[b] : fr.end);
      const buf = await ctx.decodeAudioData(piece.buffer);
      if (this.closed) return;
      const mono = mixDown(buf);
      if (a === 0) {
        shift = Math.max(0, Math.round(b * spf * k) - mono.length);
        total = Math.round(n * spf * k) - shift;
        this.marks.decoded = performance.now() - this.started;
        this.open(total, buf.sampleRate);
        this.send(0, mono.subarray(0, Math.min(mono.length, total)).slice());
        continue;
      }
      const at = Math.round(a0 * spf * k) - shift; // where mono[0] belongs
      const from = Math.round(a * spf * k) - shift - at; // the warm-up frames dropped
      const len = Math.min(mono.length - from, total - (at + from));
      if (len > 0) this.send(at + from, mono.slice(from, from + len));
    }
    this.worker?.postMessage({ type: "end" });
  }

  // The worker, for a song of `total` samples at `rate`.
  open(total, rate) {
    const w = new Worker(new URL("./song-worker.js", import.meta.url), { type: "module" });
    this.worker = w;
    w.onmessage = (e) => this.onMessage(e.data);
    w.onerror = (e) => (this.error = e.message || "The analysis stopped.");
    w.postMessage({ type: "start", total, rate });
  }

  // Mono samples from sample `at` on.
  send(at, data) {
    this.worker?.postMessage({ type: "samples", at, data }, [data.buffer]);
  }

  onMessage(m) {
    if (m.type === "info") {
      if (this.marks) this.marks.info = performance.now() - this.started;
      this.features = makeFeatures(m.n);
    } else if (m.type === "chunk" && this.features) {
      const f = this.features;
      f.bands.set(m.bands, m.i0 * f.nf);
      f.feat.set(m.feat, m.i0 * FIELDS.length);
      f.done.fill(1, m.i0, m.i1);
      this.measured += m.i1 - m.i0;
      this.version++;
    } else if (m.type === "done") {
      this.finished = true;
      this.doneMs = performance.now() - this.started;
      this.worker?.terminate();
      this.worker = null;
    }
  }

  // The frame playing now, so the worker measures around it first.
  focus(frame) {
    if (!this.worker || Math.abs(frame - this.lastFocus) < 25) return;
    this.lastFocus = frame;
    this.worker.postMessage({ type: "focus", frame });
  }

  close() {
    this.closed = true;
    this.worker?.terminate();
    this.worker = null;
  }
}
