// Sound effects, synthesised with WebAudio (no files; the voices are in
// src/voices.js). Off until the visitor presses the speaker button; the
// choice is remembered in this browser. Embeds never make sound.

import { playSpec, LEGACY_NAMES } from "./voices.js";

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
      this.master = masterChain(this.ctx);
    }
    if (this.ctx.state === "suspended") this.ctx.resume();
    return this.ctx;
  }

  // Plays a sound: an old name ("chime") or a spec from the voice library.
  // Repeats under the same key are spaced out by `gap` seconds. `pick` plays
  // only that note (or chord) of a spec's tune.
  play(spec, { gap = 0.06, pitch = 1, key, pick = null } = {}) {
    if (!this.enabled || !spec) return;
    const ctx = this.audio();
    if (!ctx) return;
    const now = ctx.currentTime;
    const k = key || (typeof spec === "string" ? spec : "spec");
    if (this.last[k] && now - this.last[k] < gap) return;
    this.last[k] = now;
    playSpec(ctx, this.master, now + 0.005, spec, { pitch, pick });
  }
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
