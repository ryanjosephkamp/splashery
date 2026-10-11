// Lane Live r10: the test song for Sound in a box and the Chladni plate, made
// here (no recordings): Beethoven's "Ode to Joy" (the Ninth Symphony, 1824,
// public domain), all four phrases, in A major at about two notes a second,
// with a bass line, a soft hi-hat and dynamics (soft, then louder, a
// crescendo through the third phrase, loud, and a fade). The same song drives
// the before and after clips and the measurements (tools/lv10-measure.mjs),
// so they compare like with like. songSamples(rate) gives mono samples;
// songWav(rate) a 16-bit WAV's bytes.

const STEPS = { C: -9, D: -7, E: -5, F: -4, G: -2, A: 0, B: 2 };
export function hz(name) {
  const m = /^([A-G])([#b]?)(-?\d)$/.exec(name);
  const s = STEPS[m[1]] + (m[2] === "#" ? 1 : m[2] === "b" ? -1 : 0) + 12 * (Number(m[3]) - 4);
  return 440 * 2 ** (s / 12);
}

export const BEAT = 0.42; // seconds
// The melody: [note, beats].
const A1 = [["C#5", 1], ["C#5", 1], ["D5", 1], ["E5", 1], ["E5", 1], ["D5", 1], ["C#5", 1], ["B4", 1], ["A4", 1], ["A4", 1], ["B4", 1], ["C#5", 1]]; // prettier-ignore
const MEL = [
  ...A1,
  ["C#5", 1.5],
  ["B4", 0.5],
  ["B4", 2], // prettier-ignore
  ...A1,
  ["B4", 1.5],
  ["A4", 0.5],
  ["A4", 2], // prettier-ignore
  ["B4", 1],
  ["B4", 1],
  ["C#5", 1],
  ["A4", 1],
  ["B4", 1],
  ["C#5", 0.5],
  ["D5", 0.5],
  ["C#5", 1],
  ["A4", 1], // prettier-ignore
  ["B4", 1],
  ["C#5", 0.5],
  ["D5", 0.5],
  ["C#5", 1],
  ["B4", 1],
  ["A4", 1],
  ["B4", 1],
  ["E4", 2], // prettier-ignore
  ...A1,
  ["B4", 1.5],
  ["A4", 0.5],
  ["A4", 2], // prettier-ignore
];
// The bass: one note a bar (four beats).
const BASS = ["A2", "E2", "A2", "E2", "A2", "E2", "A2", "E2", "E2", "A2", "E2", "E2", "A2", "E2", "A2", "A2"]; // prettier-ignore
// Loudness by bar (a gain on everything): soft, louder, a crescendo, loud.
const DYN = [0.45, 0.45, 0.5, 0.5, 0.7, 0.7, 0.75, 0.75, 0.6, 0.75, 0.9, 1, 1, 1, 0.9, 0.6];

export function songSeconds() {
  return MEL.reduce((a, [, b]) => a + b, 0) * BEAT + 0.6;
}

export function songSamples(rate = 44100) {
  const out = new Float32Array(Math.round(songSeconds() * rate));
  let seed = 12345;
  const noise = () => ((seed = (seed * 16807) % 2147483647) / 2147483647) * 2 - 1;
  const gainAt = (t) => {
    const bar = t / (4 * BEAT);
    const i = Math.min(DYN.length - 1, Math.floor(bar));
    const j = Math.min(DYN.length - 1, i + 1);
    const f = bar - Math.floor(bar);
    return DYN[i] + (DYN[j] - DYN[i]) * f * f; // eased into the next bar
  };
  const voice = (start, dur, f, amp, harm) => {
    const i0 = Math.round(start * rate);
    const len = Math.round(dur * rate);
    const sound = Math.max(0.05, dur - 0.04);
    let ph = 0;
    for (let i = 0; i < len && i0 + i < out.length; i++) {
      const t = i / rate;
      if (t >= sound) break;
      const env = Math.min(1, t / 0.012, (sound - t) / 0.03) * (0.6 + 0.4 * Math.exp(-t / 0.4));
      ph += (2 * Math.PI * f * 2 ** ((7 * Math.sin(2 * Math.PI * 5.2 * t)) / 1200)) / rate;
      let v = 0;
      for (let k = 0; k < harm.length; k++) v += harm[k] * Math.sin((k + 1) * ph);
      out[i0 + i] += amp * env * v * gainAt(start + t);
    }
  };
  let at = 0;
  for (const [n, b] of MEL) {
    voice(at, b * BEAT, hz(n), 0.3, [1, 0.35, 0.15, 0.05]);
    at += b * BEAT;
  }
  BASS.forEach((n, i) => voice(i * 4 * BEAT, 4 * BEAT, hz(n), 0.16, [1, 0.5, 0.2]));
  // A soft hi-hat on the off-beats: a short burst of noise.
  for (let t = BEAT / 2; t < at; t += BEAT) {
    const i0 = Math.round(t * rate);
    for (let i = 0; i < 0.03 * rate && i0 + i < out.length; i++)
      out[i0 + i] += 0.03 * noise() * Math.exp(-i / (0.008 * rate)) * gainAt(t);
  }
  return out;
}

export function songWav(rate = 44100) {
  const s = songSamples(rate);
  const n = s.length;
  const b = new DataView(new ArrayBuffer(44 + n * 2));
  const text = (o, x) => [...x].forEach((c, i) => b.setUint8(o + i, c.charCodeAt(0)));
  text(0, "RIFF");
  b.setUint32(4, 36 + n * 2, true);
  text(8, "WAVEfmt ");
  b.setUint32(16, 16, true);
  b.setUint16(20, 1, true);
  b.setUint16(22, 1, true);
  b.setUint32(24, rate, true);
  b.setUint32(28, rate * 2, true);
  b.setUint16(32, 2, true);
  b.setUint16(34, 16, true);
  text(36, "data");
  b.setUint32(40, n * 2, true);
  for (let i = 0; i < n; i++) b.setInt16(44 + i * 2, Math.round(Math.max(-1, Math.min(1, s[i])) * 32767), true); // prettier-ignore
  return new Uint8Array(b.buffer);
}
