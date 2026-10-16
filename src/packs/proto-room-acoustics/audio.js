import { TOY_SOUNDS } from "../../toy-sounds.js";
import { playSpec } from "../../voices.js";
import { CLAP_AT } from "./math.js";

// Deterministic synthesized room response: first-order specular impulses
// and a diffuse broadband tail whose pressure falls 60 dB in RT60.
// https://developer.mozilla.org/en-US/docs/Web/API/ConvolverNode
export function impulseSamples(room, rate) {
  const tail = room.rt60 + 0.12;
  const samples = new Float32Array(Math.ceil(rate * tail));
  samples[0] = 1;
  const direct = room.paths[0];
  for (const p of room.paths.slice(1)) {
    const i = Math.round((p.delay - direct.delay) * rate);
    samples[i] += (Math.sqrt(1 - p.alpha) * direct.length) / p.length;
  }
  const start = Math.max(...room.paths.map((p) => p.delay - direct.delay)) + 0.012;
  const scale = 0.65 * Math.sqrt((2 * Math.log(1000)) / (rate * room.rt60));
  let seed = 731;
  for (let i = Math.ceil(start * rate); i < samples.length; i++) {
    seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
    const noise = (seed / 4294967296 - 0.5) * Math.sqrt(12);
    const t = i / rate;
    const fade = Math.min(1, Math.max(0, (tail - t) / 0.08));
    samples[i] += scale * noise * Math.exp((-Math.log(1000) * t) / room.rt60) * fade;
  }
  return samples;
}

let cached = null;
let playing = null;
export function stopClap() {
  if (!playing) return;
  const { ctx, input, cleanup } = playing;
  input.gain.cancelScheduledValues(ctx.currentTime);
  input.gain.setTargetAtTime(0, ctx.currentTime, 0.015);
  // Repeated taps keep only one audible room and promptly release the old
  // convolver, rather than stacking several seconds of phone CPU work.
  cleanup?.stop(ctx.currentTime + 0.08);
  playing = null;
}

export function playClap(sound, room) {
  if (!sound?.enabled) return;
  const ctx = sound.audio();
  if (!ctx || !sound.master) return;
  stopClap();
  const key = JSON.stringify([
    room.length,
    room.width,
    room.height,
    room.materials.map((m) => m.alpha),
    ctx.sampleRate,
  ]);
  if (!cached || cached.ctx !== ctx || cached.key !== key) {
    const samples = impulseSamples(room, ctx.sampleRate);
    const buffer = ctx.createBuffer(1, samples.length, ctx.sampleRate);
    buffer.copyToChannel(samples, 0);
    cached = { ctx, key, buffer };
  }
  const convolver = ctx.createConvolver();
  convolver.normalize = false;
  convolver.buffer = cached.buffer;
  const input = ctx.createGain();
  input.gain.value = 0.55;
  input.connect(convolver).connect(sound.master);
  const at = ctx.currentTime + CLAP_AT + room.paths[0].delay;
  // The standard toy-sounds clap voice, routed through our computed room.
  playSpec(ctx, input, at, TOY_SOUNDS["room-acoustics"]);
  sound.scheduled++;
  playing = { ctx, input };
  // A silent audio-clock source releases the graph after the convolver's
  // tail, including when the site's Pause suspends the context.
  const cleanup = ctx.createBufferSource();
  cleanup.buffer = ctx.createBuffer(1, 1, ctx.sampleRate);
  cleanup.loop = true;
  const silent = ctx.createGain();
  silent.gain.value = 0;
  cleanup.connect(silent).connect(sound.master);
  const graph = playing;
  graph.cleanup = cleanup;
  cleanup.onended = () => {
    input.disconnect();
    convolver.disconnect();
    cleanup.disconnect();
    silent.disconnect();
    if (playing === graph) playing = null;
  };
  cleanup.start(at);
  cleanup.stop(at + cached.buffer.duration + 0.1);
}
