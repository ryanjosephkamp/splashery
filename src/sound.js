// Soft sound effects, synthesised with WebAudio (no files). Off until the
// visitor presses the speaker button; the choice is remembered in this
// browser. Embeds never make sound.

const KEY = "splashery.sound";

function remembered() {
  try {
    return localStorage.getItem(KEY) === "on";
  } catch {
    return false;
  }
}

export class Sound {
  constructor() {
    this.enabled = remembered();
    this.ctx = null;
    this.last = {};
  }

  setEnabled(on) {
    this.enabled = !!on;
    try {
      localStorage.setItem(KEY, on ? "on" : "off");
    } catch {
      // Storage can be unavailable (private windows); sound still works now.
    }
    if (on) this.audio();
  }

  audio() {
    if (!this.ctx) {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return null;
      this.ctx = new AC();
      this.master = this.ctx.createGain();
      this.master.gain.value = 0.35;
      this.master.connect(this.ctx.destination);
    }
    if (this.ctx.state === "suspended") this.ctx.resume();
    return this.ctx;
  }

  // Plays a named effect; repeats of the same effect are spaced out.
  play(name, { gap = 0.06, pitch = 1 } = {}) {
    if (!this.enabled) return;
    const ctx = this.audio();
    if (!ctx) return;
    const now = ctx.currentTime;
    if (this.last[name] && now - this.last[name] < gap) return;
    this.last[name] = now;
    const fn = SOUNDS[name];
    if (fn) fn(ctx, this.master, now, pitch);
  }
}

function tone(ctx, out, t, { type = "sine", f0, f1 = f0, dur = 0.2, vol = 0.5, attack = 0.005 }) {
  const o = ctx.createOscillator();
  const g = ctx.createGain();
  o.type = type;
  o.frequency.setValueAtTime(f0, t);
  if (f1 !== f0) o.frequency.exponentialRampToValueAtTime(Math.max(20, f1), t + dur);
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(vol, t + attack);
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  o.connect(g).connect(out);
  o.start(t);
  o.stop(t + dur + 0.02);
}

function noise(ctx, out, t, { dur = 0.2, vol = 0.4, freq = 1200, q = 0.8, type = "bandpass", f1 }) {
  const n = Math.max(1, Math.floor(ctx.sampleRate * dur));
  const buf = ctx.createBuffer(1, n, ctx.sampleRate);
  const d = buf.getChannelData(0);
  for (let i = 0; i < n; i++) d[i] = Math.random() * 2 - 1;
  const src = ctx.createBufferSource();
  src.buffer = buf;
  const f = ctx.createBiquadFilter();
  f.type = type;
  f.frequency.setValueAtTime(freq, t);
  if (f1) f.frequency.exponentialRampToValueAtTime(f1, t + dur);
  f.Q.value = q;
  const g = ctx.createGain();
  g.gain.setValueAtTime(vol, t);
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  src.connect(f).connect(g).connect(out);
  src.start(t);
}

const SOUNDS = {
  poke: (c, o, t, p) => tone(c, o, t, { f0: 420 * p, f1: 180 * p, dur: 0.28, vol: 0.4 }),
  hop: (c, o, t, p) =>
    tone(c, o, t, { f0: 180 * p, f1: 520 * p, dur: 0.22, vol: 0.35, type: "triangle" }),
  bounce: (c, o, t, p) => tone(c, o, t, { f0: 140 * p, f1: 70 * p, dur: 0.12, vol: 0.3 }),
  paint: (c, o, t) => noise(c, o, t, { dur: 0.22, vol: 0.5, freq: 900, f1: 300, q: 1.2 }),
  clay: (c, o, t) => noise(c, o, t, { dur: 0.16, vol: 0.35, freq: 400, q: 2, type: "lowpass" }),
  drop: (c, o, t) => {
    tone(c, o, t, { f0: 90, f1: 45, dur: 0.35, vol: 0.5 });
    noise(c, o, t, { dur: 0.3, vol: 0.25, freq: 300, type: "lowpass" });
  },
  whoosh: (c, o, t) => noise(c, o, t, { dur: 0.6, vol: 0.3, freq: 300, f1: 2400, q: 0.7 }),
  chime: (c, o, t) => {
    [880, 1320, 1760].forEach((f, i) =>
      tone(c, o, t + i * 0.07, { f0: f, dur: 0.5, vol: 0.18, type: "triangle" }),
    );
  },
  open: (c, o, t) => {
    tone(c, o, t, { f0: 160, f1: 260, dur: 0.5, vol: 0.2, type: "sawtooth" });
    [1047, 1319, 1568].forEach((f, i) =>
      tone(c, o, t + 0.25 + i * 0.08, { f0: f, dur: 0.6, vol: 0.12, type: "sine" }),
    );
  },
  close: (c, o, t) => {
    tone(c, o, t, { f0: 240, f1: 150, dur: 0.35, vol: 0.2, type: "sawtooth" });
    tone(c, o, t + 0.32, { f0: 110, f1: 60, dur: 0.18, vol: 0.45 });
  },
  fire: (c, o, t) => {
    noise(c, o, t, { dur: 0.9, vol: 0.35, freq: 500, f1: 1800, q: 0.6 });
    for (let i = 0; i < 5; i++)
      noise(c, o, t + 0.1 + Math.random() * 0.6, { dur: 0.04, vol: 0.4, freq: 3000, q: 3 });
  },
  pop: (c, o, t, p) => tone(c, o, t, { f0: 700 * p, f1: 1400 * p, dur: 0.08, vol: 0.4 }),
  heartbeat: (c, o, t) => {
    tone(c, o, t, { f0: 70, f1: 50, dur: 0.14, vol: 0.6 });
    tone(c, o, t + 0.2, { f0: 65, f1: 45, dur: 0.12, vol: 0.45 });
  },
  click: (c, o, t) => tone(c, o, t, { f0: 1500, f1: 900, dur: 0.03, vol: 0.15, type: "square" }),
};

export const SOUND_NAMES = Object.keys(SOUNDS);
