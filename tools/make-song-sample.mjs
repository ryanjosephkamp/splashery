#!/usr/bin/env node
// Writes the song landscape's sample: assets/toys/song-landscape/sample.wav,
// a 20 second original tune (a plucked melody, a bass, a kick and a hat, and
// a rising sweep at the end) synthesized here, so it is ours to release under
// CC0. Mono, 22,050 Hz, 16 bits. Deterministic.
//
//   node tools/make-song-sample.mjs

import fs from "node:fs";

const rate = 22050;
const secs = 20;
const bpm = 120;
const beat = 60 / bpm;
const out = new Float32Array(rate * secs);
let seed = 7;
const rnd = () => ((seed = (seed * 1664525 + 1013904223) >>> 0) / 4294967296) * 2 - 1;
const hz = (semi) => 440 * 2 ** ((semi - 9) / 12); // semitones above C4

function add(at, dur, fn, vol) {
  const a = Math.floor(at * rate);
  for (let i = 0; i < dur * rate && a + i < out.length; i++) out[a + i] += vol * fn(i / rate);
}
// Pentatonic-ish tune in C, two bars a phrase.
const melody = [
  [0, 12], [0.5, 16], [1, 19], [1.5, 16], [2, 21], [2.5, 19], [3, 16], [3.5, 14],
  [4, 12], [4.5, 16], [5, 19], [5.5, 24], [6, 21], [6.5, 19], [7, 16], [7.5, 19],
]; // prettier-ignore
const bass = [0, 0, 5, 5, 7, 7, 0, 0];
for (let bar = 0; bar < 10; bar++) {
  const at0 = bar * 4 * beat;
  const shift = bar % 4 === 3 ? 2 : 0;
  for (const [b, semi] of melody.slice(bar % 2 ? 8 : 0, bar % 2 ? 16 : 8)) {
    const f = hz(semi + shift);
    add(
      at0 + (b % 4) * beat,
      1.1,
      (t) => {
        const e = Math.exp(-t * 4.5);
        return e * (Math.sin(2 * Math.PI * f * t) + 0.4 * Math.sin(4 * Math.PI * f * t) + 0.2 * Math.sin(6 * Math.PI * f * t) * Math.exp(-t * 6)); // prettier-ignore
      },
      0.22,
    );
  }
  for (let q = 0; q < 4; q++) {
    const f = hz(-24 + bass[(bar * 4 + q) % 8]);
    add(at0 + q * beat, 0.5, (t) => Math.exp(-t * 3.5) * Math.sin(2 * Math.PI * f * t), 0.34);
    add(at0 + q * beat, 0.25, (t) => Math.sin(2 * Math.PI * (45 * t + 75 * (1 - Math.exp(-t * 30)) / 30)) * Math.exp(-t * 14), 0.5); // prettier-ignore
    add(at0 + q * beat + beat / 2, 0.08, (t) => rnd() * Math.exp(-t * 60), 0.12);
  }
}
// A rising sweep over the last three seconds.
add(17, 3, (t) => Math.sin(2 * Math.PI * (300 * t + (1500 * t * t) / 2 / 3)) * Math.min(1, t) * Math.min(1, (3 - t) * 3), 0.16); // prettier-ignore

const pcm = Buffer.alloc(out.length * 2);
for (let i = 0; i < out.length; i++) pcm.writeInt16LE(Math.round(Math.max(-1, Math.min(1, out[i])) * 32000), i * 2); // prettier-ignore
const head = Buffer.alloc(44);
head.write("RIFF", 0);
head.writeUInt32LE(36 + pcm.length, 4);
head.write("WAVEfmt ", 8);
head.writeUInt32LE(16, 16);
head.writeUInt16LE(1, 20);
head.writeUInt16LE(1, 22);
head.writeUInt32LE(rate, 24);
head.writeUInt32LE(rate * 2, 28);
head.writeUInt16LE(2, 32);
head.writeUInt16LE(16, 34);
head.write("data", 36);
head.writeUInt32LE(pcm.length, 40);
fs.mkdirSync("assets/toys/song-landscape", { recursive: true });
fs.writeFileSync("assets/toys/song-landscape/sample.wav", Buffer.concat([head, pcm]));
console.log("assets/toys/song-landscape/sample.wav", (44 + pcm.length) / 1e6, "MB");
