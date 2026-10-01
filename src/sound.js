// Sound effects, synthesised with WebAudio (no files; the voices are in
// src/voices.js). Off until the visitor presses the speaker button; the
// choice is remembered in this browser. Embeds never make sound.

import { playSpec, parseNotes, LEGACY_NAMES } from "./voices.js";

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
    this.held = {}; // UI r3: long taps' sounds, by key (see playHeld)
    this.scheduled = 0; // UI r3: sound events handed to WebAudio (the tests read it)
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
      this.master = masterChain(this.ctx);
    }
    if (this.ctx.state === "suspended") this.ctx.resume();
    return this.ctx;
  }

  // Plays a sound: an old name ("chime") or a spec from the voice library.
  // Repeats under the same key are spaced out by `gap` seconds. `pick` plays
  // only that note (or chord) of a spec's tune. `held` plays it through the
  // pausable scheduler below (UI r3).
  play(spec, { gap = 0.06, pitch = 1, key, pick = null, held = false } = {}) {
    if (held) return this.playHeld(spec, { key: key || "toy", pitch }); // UI r3
    if (!this.enabled || !spec) return;
    const ctx = this.audio();
    if (!ctx) return;
    const now = ctx.currentTime;
    const k = key || (typeof spec === "string" ? spec : "spec");
    if (this.last[k] && now - this.last[k] < gap) return;
    this.last[k] = now;
    this.scheduled++;
    playSpec(ctx, this.master, now + 0.005, spec, { pitch, pick });
  }

  // ---- UI r3: a long tap's sound pauses and resumes ---------------------------------
  // A long tap (a tune, a long demo) plays through a small look-ahead
  // scheduler: its notes are handed to WebAudio a moment before they sound,
  // so a pause stops the notes to come (the ones sounding just ring out) and
  // a resume carries on from the same place. A new play under the same key
  // stops the old one first, so one toy's tune never overlaps itself.
  playHeld(spec, { key = "toy", pitch = 1 } = {}) {
    this.stopHeld(key);
    if (!this.enabled || !spec) return;
    const ctx = this.audio();
    if (!ctx) return;
    const out = ctx.createGain();
    out.connect(this.master);
    const h = { events: soundEvents(spec), i: 0, out, pitch, start: ctx.currentTime + 0.01, pos: 0, timer: 0 }; // prettier-ignore
    this.held[key] = h;
    this.runHeld(h);
  }

  runHeld(h) {
    const ctx = this.ctx;
    const pump = () => {
      const until = ctx.currentTime + LOOK_AHEAD - h.start;
      while (h.i < h.events.length && h.events[h.i].t <= until) {
        const ev = h.events[h.i++];
        this.scheduled++;
        playSpec(ctx, h.out, Math.max(ctx.currentTime, h.start + ev.t), ev.spec, { pitch: h.pitch }); // prettier-ignore
      }
      if (h.i >= h.events.length) clearInterval(h.timer);
    };
    clearInterval(h.timer);
    h.timer = setInterval(pump, 40);
    pump();
  }

  pauseHeld(key = "toy") {
    const h = this.held[key];
    if (!h || h.paused || !this.ctx) return;
    clearInterval(h.timer);
    h.paused = true;
    h.pos = this.ctx.currentTime - h.start;
  }

  resumeHeld(key = "toy") {
    const h = this.held[key];
    if (!h || !h.paused || !this.ctx) return;
    h.paused = false;
    h.start = this.ctx.currentTime + 0.01 - h.pos;
    this.runHeld(h);
  }

  // Stops a held sound: the notes to come never play and the rest fade out.
  stopHeld(key = "toy") {
    const h = this.held[key];
    if (!h) return;
    delete this.held[key];
    clearInterval(h.timer);
    const t = this.ctx.currentTime;
    h.out.gain.setValueAtTime(h.out.gain.value, t);
    h.out.gain.linearRampToValueAtTime(0, t + 0.08);
    setTimeout(() => h.out.disconnect(), 200);
  }
}

// UI r3: how far ahead of time a held sound's notes are scheduled (seconds).
const LOOK_AHEAD = 0.12;

// A spec as a list of single sounds by start time: each note of a tune is
// its own event ({ t, spec }), so a scheduler can hand them out one by one.
export function soundEvents(spec, list = []) {
  if (!spec) return list;
  if (typeof spec === "string") list.push({ t: 0, spec });
  else if (Array.isArray(spec)) spec.forEach((s) => soundEvents(s, list));
  else if ("on" in spec) soundEvents(spec.on, list);
  else if (spec.notes) {
    const step = spec.step ?? 0.2;
    const strum = spec.strum ?? 0;
    parseNotes(spec.notes).forEach((chord, i) =>
      chord.forEach((note, j) => {
        const one = { ...spec, f: note, at: 0 };
        delete one.notes;
        list.push({ t: (spec.at || 0) + i * step + j * strum, spec: one });
      }),
    );
  } else list.push({ t: spec.at || 0, spec: { ...spec, at: 0 } });
  return list.sort((a, b) => a.t - b.t);
}

// The output stage every sound goes through: a gentle level and a limiter,
// so layered voices never clip. Shared with tools/sound-check.mjs.
export function masterChain(ctx) {
  const master = ctx.createGain();
  master.gain.value = 0.35;
  const limit = ctx.createDynamicsCompressor();
  limit.threshold.value = -10;
  limit.knee.value = 6;
  limit.ratio.value = 8;
  limit.attack.value = 0.003;
  limit.release.value = 0.2;
  master.connect(limit).connect(ctx.destination);
  return master;
}

export const SOUND_NAMES = LEGACY_NAMES;
