// Pack: pianos (lane Pianos). A grand piano, an upright piano, a harpsichord
// and an electronic keyboard. Every key, hammer, damper, jack and string that
// moves is its own solid piece, moved one by one by the lever kind (docs/PACKS.md
// section 5d). A tap on a key plays that key; a tap anywhere else plays the
// opening of the toy's song, and the song bar plays it all. Each also opens a
// MIDI file of your own, or a tune in ABC.
//
// The built-in songs are public-domain compositions, written out here from
// the scores (checked against the Mutopia Project's public-domain editions):
// no recordings are used.

import { mix, shade, smoothstep, clamp, spline, quatAxisAngle, vec } from "../kit.js";
import { evenBox, evenCylinder, evenRoundBox } from "./even.js";
import { SongPlayer, songControls, makeSong, midiOf, songFromText } from "../songs.js";

const TAU = Math.PI * 2;
const LIGHT = vec.unit([0.3, 0.8, 0.55]);
const VIEW = vec.unit([0.52, 0.27, 0.81]);
const HALF = vec.unit(vec.add(LIGHT, VIEW));
const dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
const band = (x, a, b) => clamp((x - a) / (b - a), 0, 1);

// A colour lit by the key light, with a glossy highlight for lacquer.
function lit(c, col, k = 0.3, gloss = 0, sharp = 24) {
  const d = dot(c.n, LIGHT);
  let out = shade(col, 1 + k * (0.9 * d - 0.15));
  if (gloss) out = mix(out, "#ffffff", gloss * Math.pow(Math.max(0, dot(c.n, HALF)), sharp));
  return out;
}

// Polished brass or steel: a baked reflection of sky and floor.
function metal(c, base, dark) {
  const n = c.n;
  const y = 2 * dot(n, VIEW) * n[1] - VIEW[1];
  let f = 0.25 + 0.55 * smoothstep(-0.25, 0.1, y) + 0.4 * Math.exp(-(((y + 0.02) / 0.1) ** 2));
  if (f < 1) return mix(dark, base, clamp(f, 0, 1));
  return mix(base, "#ffffff", Math.min(0.6, (f - 1) * 1.6));
}

// Wood grain along an axis.
function wood(c, base, p, axis = 2, dark = 0.8) {
  const a = p[(axis + 1) % 3];
  const g = c.fbm(a * 30, p[axis] * 2, p[(axis + 2) % 3] * 30, 3);
  return mix(base, shade(base, dark), 0.35 + 0.35 * g);
}

// Per-toy memory for drive(), keyed by the control state object (new each
// time a toy loads).
const MEM = new WeakMap();
function mem(c) {
  let m = MEM.get(c);
  if (!m) MEM.set(c, (m = {}));
  return m;
}
// True on the frame a pulse control fires.
function fired(m, key, v) {
  const was = m["p_" + key] ?? 0;
  m["p_" + key] = v;
  return v > was + 0.02;
}

// Even placement and clean colours for every shape (docs/PACKS.md 7c): the
// kit's default colour noise reads as grain on lacquer and ivory.
function sharpen(k) {
  const add = k.add.bind(k);
  k.add = (shape, o = {}) =>
    add(shape, { even: true, ...o, jitter: Math.min(o.jitter ?? 0.008, 0.01) });
}

// ---- Keyboards ----------------------------------------------------------------------

const BLACK = new Set([1, 3, 6, 8, 10]);
const isBlack = (n) => BLACK.has(((n % 12) + 12) % 12);

// The keys from MIDI note low to high: each white or black, with the x of
// its middle (white keys `w` apart; a black key sits over the gap).
function keyLayout(low, high, w) {
  const keys = [];
  let whites = 0;
  for (let n = low; n <= high; n++) {
    if (isBlack(n)) keys.push({ n, black: true, x: whites * w });
    else keys.push({ n, black: false, x: (whites++ + 0.5) * w });
  }
  const width = whites * w;
  for (const k of keys) k.x -= width / 2;
  return { keys, width, w, low, high };
}

// Which key a tap at (x, y, z) hits: a black key when it lands high enough
// and far enough back, else the white key under it.
function keyAt(layout, p, { top, blackTop, blackFront, front = 0.02, back = -0.2 }) {
  if (p[2] > front + 0.01 || p[2] < back) return null;
  if (p[1] < top - 0.05 || p[1] > blackTop + 0.03) return null;
  const { keys, w } = layout;
  if (p[1] > top + 0.003 && p[2] < blackFront + 0.004) {
    let best = null;
    for (let i = 0; i < keys.length; i++)
      if (keys[i].black && Math.abs(keys[i].x - p[0]) < w * 0.36) best = i;
    if (best !== null) return best;
  }
  let best = null;
  let bd = Infinity;
  for (let i = 0; i < keys.length; i++) {
    if (keys[i].black) continue;
    const d = Math.abs(keys[i].x - p[0]);
    if (d < bd) ((bd = d), (best = i));
  }
  return bd < w * 0.6 ? best : null;
}

// Builds the keys as levers of `group` (lever i is key i). opts: top (the
// white keys' top), len and blackLen (visible lengths back from the front at
// z = 0), height, white and black colours.
function buildKeys(k, layout, group, o) {
  const { w } = layout;
  const h = o.height ?? 0.02;
  const bh = o.blackHeight ?? 0.012;
  layout.keys.forEach((key, i) => {
    const params = [k.leverParam(group, i), 0];
    if (!key.black) {
      k.add(evenBox(w * 0.93, h, o.len), {
        pos: [key.x, o.top - h / 2, -o.len / 2],
        color: (c) => {
          const f = c.s.face;
          if (f === 3 || f === 5) return null;
          const base = f === 2 ? o.white : shade(o.white, f === 4 ? 0.9 : 0.8);
          return lit(c, base, 0.18, o.whiteGloss ?? 0.15, 30);
        },
        kind: "lever",
        params,
        even: true,
        weight: 2.2,
        flat: 0.12,
        jitter: 0.008,
        pattern: false,
      });
    } else {
      const bl = o.blackLen;
      k.add(evenBox(w * 0.55, bh + h * 0.5, bl), {
        pos: [key.x, o.top + bh / 2 - h * 0.25, -o.len + bl / 2],
        color: (c) => {
          const f = c.s.face;
          if (f === 3 || f === 5) return null;
          const base = f === 2 ? o.black : shade(o.black, 0.85);
          return lit(c, base, 0.3, o.blackGloss ?? 0.35, 40);
        },
        kind: "lever",
        params,
        even: true,
        weight: 2.6,
        flat: 0.12,
        jitter: 0.008,
        pattern: false,
      });
    }
  });
}

const UP = () => [0, 1, 0];
// The outward normal of a case wall drawn along an outline (anticlockwise
// seen from above) with tangent t.
const outward = (t) => [t[2], 0, -t[0]];

// A polyline as a fast curve: t in [0, 1] -> the point that far along it
// (by index, as the spline it was sampled from).
function along(poly) {
  const n = poly.length - 1;
  return (t) => {
    const x = clamp(t, 0, 1) * n;
    const i = Math.min(n - 1, Math.floor(x));
    const f = x - i;
    const a = poly[i];
    const b = poly[i + 1];
    return [a[0] + (b[0] - a[0]) * f, a[1] + (b[1] - a[1]) * f, a[2] + (b[2] - a[2]) * f];
  };
}

// ---- Songs --------------------------------------------------------------------------

// A song written as notes on a grid: "E5,0,1! D#5,1,1! …" is a note, its
// start and its length in steps (div steps to a quarter note); "!" marks the
// melody, played a little louder. pedal: "8,6 14,6" (start and length in
// steps). sections: [[from, to], …] plays those stretches in turn (repeats
// and first and second endings).
function gridSong({
  title,
  composer,
  bpm,
  div,
  notes,
  pedal = "",
  sections = null,
  loud = 0.7,
  soft = 0.48,
}) {
  // prettier-ignore
  const step = 60 / bpm / div;
  const list = notes
    .trim()
    .split(/\s+/)
    .map((tok) => {
      const mel = tok.endsWith("!");
      const [n, s, l] = tok.replace("!", "").split(",");
      return { n: midiOf(n), s: Number(s), l: Number(l), v: mel ? loud : soft };
    });
  const peds = pedal
    ? pedal
        .trim()
        .split(/\s+/)
        .map((p) => p.split(",").map(Number))
    : [];
  const out = [];
  const outPed = [];
  let at = 0;
  for (const [a, b] of sections || [[0, 1e9]]) {
    for (const x of list)
      if (x.s >= a - 1e-6 && x.s < b - 1e-6)
        out.push({ t: (at + x.s - a) * step, d: Math.min(x.l, b - x.s) * step * 0.96, n: x.n, v: x.v, ch: 0, drum: false }); // prettier-ignore
    for (const [ps, pl] of peds)
      if (ps >= a - 1e-6 && ps < b - 1e-6)
        outPed.push([(at + ps - a) * step + 0.04, (at + Math.min(ps + pl, b) - a) * step - 0.06]);
    at += Math.min(b, Math.max(...list.map((x) => x.s + x.l))) - a;
  }
  return makeSong({ title, composer, notes: out, pedal: outPed, bpm });
}

const SONGS = {
  elise: {
    id: "elise",
    title: "Für Elise",
    opening: 5.3,
    make: () =>
      gridSong({
        title: "Für Elise",
        composer: "Ludwig van Beethoven, 1810",
        bpm: 72,
        div: 4,
        // The first eight bars twice (first and second endings), the middle
        // part and the theme again.
        sections: [
          [0, 48],
          [0, 44],
          [48, 136],
        ],
        notes:
          "E5,0,1! D#5,1,1! E5,2,1! D#5,3,1! E5,4,1! B4,5,1! D5,6,1! C5,7,1! A2,8,1 A4,8,2! E3,9,1 " +
          "A3,10,1 C4,11,1! E4,12,1! A4,13,1! E2,14,1 B4,14,2! E3,15,1 G#3,16,1 E4,17,1! G#4,18,1! " +
          "B4,19,1! A2,20,1 C5,20,2! E3,21,1 A3,22,1 E4,23,1! E5,24,1! D#5,25,1! E5,26,1! D#5,27,1! " +
          "E5,28,1! B4,29,1! D5,30,1! C5,31,1! A2,32,1 A4,32,2! E3,33,1 A3,34,1 C4,35,1! E4,36,1! " +
          "A4,37,1! E2,38,1 B4,38,2! E3,39,1 G#3,40,1 E4,41,1! C5,42,1! B4,43,1! A2,44,1 A4,44,4! " +
          "E3,45,1 A3,46,1 A2,48,1 A4,48,2! E3,49,1 A3,50,1 B4,51,1! C5,52,1! D5,53,1! C3,54,1 E5,54,3! " +
          "G3,55,1 C4,56,1 G4,57,1! F5,58,1! E5,59,1! G2,60,1 D5,60,3! G3,61,1 B3,62,1 F4,63,1! " +
          "E5,64,1! D5,65,1! A2,66,1 C5,66,3! E3,67,1 A3,68,1 E4,69,1! D5,70,1! C5,71,1! E2,72,1 " +
          "B4,72,2! E3,73,1 E4,74,1 E4,75,1! E5,76,1! E4,77,1 E5,78,1 E5,79,1! E6,80,1! D#5,81,1 " +
          "E5,82,1 D#5,83,1! E5,84,2! D#5,85,1 E5,86,1 D#5,87,1! E5,88,1! D#5,89,1! E5,90,1! D#5,91,1! " +
          "E5,92,1! B4,93,1! D5,94,1! C5,95,1! A2,96,1 A4,96,2! E3,97,1 A3,98,1 C4,99,1! E4,100,1! " +
          "A4,101,1! E2,102,1 B4,102,2! E3,103,1 G#3,104,1 E4,105,1! G#4,106,1! B4,107,1! A2,108,1 " +
          "C5,108,2! E3,109,1 A3,110,1 E4,111,1! E5,112,1! D#5,113,1! E5,114,1! D#5,115,1! E5,116,1! " +
          "B4,117,1! D5,118,1! C5,119,1! A2,120,1 A4,120,2! E3,121,1 A3,122,1 C4,123,1! E4,124,1! " +
          "A4,125,1! E2,126,1 B4,126,2! E3,127,1 G#3,128,1 E4,129,1! C5,130,1! B4,131,1! A2,132,1 " +
          "A4,132,2! E3,133,1 A3,134,1 B4,135,1!",
        pedal:
          "8,6 14,6 20,6 32,6 38,6 44,4 48,6 54,6 60,6 66,6 72,6 96,6 102,6 108,6 120,6 126,6 132,6",
      }),
  },
  clair: {
    id: "clair",
    title: "Clair de lune",
    opening: 5.6,
    make: () =>
      gridSong({
        title: "Clair de lune",
        composer: "Claude Debussy, Suite bergamasque, 1905",
        bpm: 58,
        div: 2,
        notes:
          "F4,0,8 G#4,0,8 F5,1,4! G#5,1,4! C#5,5,4! F5,5,4! F#4,8,9 A4,8,9 C5,9,1! D#5,9,1! C#5,10,1! " +
          "F5,10,1! C5,11,7! D#5,11,7! F4,17,9 G#4,17,9 A#4,18,1 C#5,18,1! C5,19,1! D#5,19,1! A#4,20,7 " +
          "C#5,20,1.5! F5,21.5,3! C#5,24.5,2.5! D#4,26,9 F#4,26,9 G#4,27,1 C5,27,1! A#4,28,1 C#5,28,1! " +
          "G#4,29,6 C5,29,7! C#4,35,6 D#4,35,6 F#4,35,6 A#4,36,1 C5,37,1! A#4,38,1 D#5,39,1! A#4,40,1 " +
          "C4,41,3 D#4,41,3 F#4,41,3 G#4,41,1 A#4,42,1 G#4,43,2 A#3,44,6 C#4,44,6 D#4,44,6 F#4,45,1 " +
          "G#4,46,1 F#4,47,3 A3,50,3 C4,50,3 D#4,50,3 F4,50,4 G#3,53,6 A#3,53,9 C#4,53,9 F4,54,1 " +
          "F#4,55,1 F4,56,1 A#4,57,1 F4,58,1 F#3,59,3 D#4,59,1 F4,60,1 D#4,61,2 F3,62,6 G#3,62,6 " +
          "A#3,62,6 C#4,63,1 D#4,64,1 C#4,65,3 D#3,68,1.5 F#3,68,3 G#3,68,3 C4,68,3 G#2,69.5,2.5 " +
          "C#2,71,1 F3,72,2 G#3,72,2 F4,73,7 G#4,73,7 F5,74,3! G#5,74,3! C#5,77,3! F5,77,3!",
        pedal: "0,9 9,9 18,9 27,9 36,9 45,9 54,9 63,9 72,8",
        loud: 0.6,
        soft: 0.42,
      }),
  },
  gymnopedie: {
    id: "gymnopedie",
    title: "Gymnopédie No. 1",
    opening: 5.2,
    make: () =>
      gridSong({
        title: "Gymnopédie No. 1",
        composer: "Erik Satie, 1888",
        bpm: 70,
        div: 2,
        notes:
          "G2,0,6 B3,2,4 D4,2,4 F#4,2,4 D2,6,6 A3,8,4 C#4,8,4 F#4,8,4 G2,12,6 B3,14,4 D4,14,4 F#4,14,4 " +
          "D2,18,6 A3,20,4 C#4,20,4 F#4,20,4 G2,24,6 B3,26,4 D4,26,4 F#4,26,4 F#5,26,2! A5,28,2! " +
          "D2,30,6 G5,30,2! A3,32,4 C#4,32,4 F#4,32,4 F#5,32,2! C#5,34,2! G2,36,6 B4,36,2! B3,38,4 " +
          "D4,38,4 F#4,38,4 C#5,38,2! D5,40,2! D2,42,6 A4,42,6! A3,44,4 C#4,44,4 F#4,44,4 G2,48,6 " +
          "F#4,48,2 B3,50,4 D4,50,4 F#4,50,6 D2,54,6 A3,56,4 C#4,56,4 F#4,56,6 G2,60,6 B3,62,4 D4,62,4 " +
          "F#4,62,6 D2,66,6 A3,68,4 C#4,68,4 F#4,68,4 G2,72,6 B3,74,4 D4,74,4 F#4,74,4 F#5,74,2! " +
          "A5,76,2! D2,78,6 G5,78,2! A3,80,4 C#4,80,4 F#4,80,4 F#5,80,2! C#5,82,2! G2,84,6 B4,84,2! " +
          "B3,86,4 D4,86,4 F#4,86,4 C#5,86,2! D5,88,2! D2,90,6 A4,90,6! A3,92,4 C#4,92,4 F#4,92,4 " +
          "F#2,96,6 C#5,96,6! A3,98,4 C#4,98,4 F#4,98,4 B1,102,6 F#5,102,6! B3,104,4 D4,104,4 F#4,104,4 " +
          "E2,108,6 E4,108,18 G3,110,4 B3,110,4 E2,114,6 B3,116,4 D4,116,4 G4,116,4 D2,120,6 F3,122,4 " +
          "A3,122,4 D4,122,4 A1,126,6 A4,126,2! A3,128,4 C4,128,4 E4,128,4 B4,128,2! C5,130,2! D2,132,6 " +
          "E5,132,2! G3,134,4 B3,134,4 E4,134,4 D5,134,2! B4,136,2! D2,138,6 D5,138,2! D3,140,4 " +
          "G3,140,4 B3,140,4 E4,140,4 C5,140,2! B4,142,2! D2,144,6 D5,144,10! C3,146,4 E3,146,4 " +
          "A3,146,4 D4,146,4 D2,150,4 C3,152,2 F#3,152,2 A3,152,2 D4,152,2",
        pedal:
          "0,6 6,6 12,6 18,6 24,6 30,6 36,6 42,6 48,6 54,6 60,6 66,6 72,6 78,6 84,6 90,6 96,6 102,6 108,6 114,6 120,6 126,6 132,6 138,6 144,6 150,6",
        loud: 0.62,
        soft: 0.4,
      }),
  },
  ode: {
    id: "ode",
    title: "Ode to Joy",
    opening: 4.6,
    make: () =>
      songFromText({
        title: "Ode to Joy",
        composer: "Ludwig van Beethoven, Symphony No. 9, 1824",
        bpm: 104,
        text:
          "v0.72 F#4/4 F#4/4 G4/4 A4/4 | A4/4 G4/4 F#4/4 E4/4 | D4/4 D4/4 E4/4 F#4/4 | F#4/8:3 E4/8 E4/2 | " +
          "F#4/4 F#4/4 G4/4 A4/4 | A4/4 G4/4 F#4/4 E4/4 | D4/4 D4/4 E4/4 F#4/4 | E4/8:3 D4/8 D4/2 | " +
          "E4/4 E4/4 F#4/4 D4/4 | E4/4 F#4/8 G4/8 F#4/4 D4/4 | E4/4 F#4/8 G4/8 F#4/4 E4/4 | D4/4 E4/4 A3/2 | " +
          "F#4/4 F#4/4 G4/4 A4/4 | A4/4 G4/4 F#4/4 E4/4 | D4/4 D4/4 E4/4 F#4/4 | E4/8:3 D4/8 D4/2" +
          " && v0.46 " +
          "P D3+A3/2 P D3+A3/2 | P D3+A3/2 P A2+G3/2 | P D3+A3/2 P D3+F#3/2 | P A2+E3/2 P A2+C#3/2 | " +
          "P D3+A3/2 P D3+A3/2 | P D3+A3/2 P A2+G3/2 | P D3+A3/2 P D3+F#3/2 | P A2+G3/2 P D3+A3/2 | " +
          "P A2+E3/2 P D3+F#3/2 | P A2+E3/2 P D3+F#3/2 | P A2+E3/2 P A2+C#3/2 | P D3+F#3/2 P A2+E3/2 | " +
          "P D3+A3/2 P D3+A3/2 | P D3+A3/2 P A2+G3/2 | P D3+A3/2 P D3+F#3/2 | P A2+G3/2 P D3+A3/2 p",
      }),
  },
  entertainer: {
    id: "entertainer",
    title: "The Entertainer",
    opening: 5.2,
    make: () =>
      gridSong({
        title: "The Entertainer",
        composer: "Scott Joplin, 1902",
        bpm: 76,
        div: 4,
        notes:
          "D5,0,1! D6,0,1! E5,1,1! E6,1,1! C5,2,1! C6,2,1! A4,3,2! A5,3,2! B4,5,1! B5,5,1! G4,6,2! " +
          "G5,6,2! D4,8,1 D5,8,1! E4,9,1 E5,9,1! C4,10,1 C5,10,1! A3,11,2 A4,11,2! B3,13,1 B4,13,1! " +
          "G3,14,2 G4,14,2! D3,16,1 D4,16,1! E3,17,1 E4,17,1! C3,18,1 C4,18,1! A2,19,2 A3,19,2 B2,21,1 " +
          "B3,21,1 A2,22,1 A3,22,1 G#2,23,1 G#3,23,1 G2,24,2 G3,24,2 G1,28,2 G2,28,2 G4,28,2! B4,28,2! " +
          "D5,28,2! G5,28,2! G3,30,2 B3,30,2 D4,30,1! D#4,31,1! C3,32,2 E4,32,1! C5,33,2! E3,34,2 " +
          "G3,34,2 C4,34,2 E4,35,1! G2,36,2 G3,36,2 C5,36,2! G3,38,2 A#3,38,2 C4,38,2 E4,38,1! C5,39,6! " +
          "F2,40,2 F3,40,2 A3,42,2 C4,42,2 E2,44,2 E3,44,2 C5,45,1! E5,45,1! C6,45,1! G3,46,2 C4,46,2 " +
          "D5,46,1! F5,46,1! D6,46,1! D#5,47,1! F#5,47,1! D#6,47,1! G2,48,2 E5,48,1! G5,48,1! E6,48,1! " +
          "C5,49,1! E5,49,1! C6,49,1! E3,50,2 G3,50,2 C4,50,2 D5,50,1! F5,50,1! D6,50,1! E5,51,2! " +
          "G5,51,2! E6,51,2! G2,52,2 B4,53,1! D5,53,1! B5,53,1! F3,54,2 G3,54,2 B3,54,2 D5,54,2! " +
          "F5,54,2! D6,54,2! C3,56,2 C5,56,6! E5,56,6! C6,56,6! E3,58,2 G3,58,2 C4,58,2 E3,60,2 G3,60,2 " +
          "C4,60,2 G3,62,2 B3,62,2 D4,62,1! D#4,63,1! C3,64,2 E4,64,1! C5,65,2! E3,66,2 G3,66,2 C4,66,2 " +
          "E4,67,1! G2,68,2 G3,68,2 C5,68,2! G3,70,2 A#3,70,2 C4,70,2 E4,70,1! C5,71,7! F2,72,2 F3,72,2 " +
          "A3,74,2 C4,74,2 E2,76,2 E3,76,2 D#2,78,2 D#3,78,2 A4,78,1! C5,78,1! A5,78,1! G4,79,1! " +
          "C5,79,1! G5,79,1! D2,80,2 D3,80,2 F#4,80,1! C5,80,1! F#5,80,1! A4,81,1! A5,81,1! D3,82,2 " +
          "F#3,82,2 A3,82,2 C4,82,2 C5,82,1! C6,82,1! E5,83,2! E6,83,2! D3,84,2 D5,85,1! D6,85,1! " +
          "F#3,86,2 A3,86,2 C4,86,2 C5,86,1! C6,86,1! A4,87,1! A5,87,1! G3,88,2 B3,88,2 D5,88,6! " +
          "F5,88,6! D6,88,6! G2,90,2 G3,90,2 A2,92,2 A3,92,2 B2,94,2 B3,94,2 D4,94,1! D#4,95,1! C3,96,2 " +
          "E4,96,1! C5,97,2! E3,98,2 G3,98,2 C4,98,2 E4,99,1! G2,100,2 G3,100,2 C5,100,2! G3,102,2 " +
          "A#3,102,2 C4,102,2 E4,102,1! C5,103,6! F2,104,2 F3,104,2 A3,106,2 C4,106,2 E2,108,2 E3,108,2 " +
          "C5,109,1! E5,109,1! C6,109,1! G3,110,2 C4,110,2 D5,110,1! F5,110,1! D6,110,1! D#5,111,1! " +
          "F#5,111,1! D#6,111,1! G2,112,2 E5,112,1! G5,112,1! E6,112,1! C5,113,1! E5,113,1! C6,113,1! " +
          "E3,114,2 G3,114,2 C4,114,2 D5,114,1! F5,114,1! D6,114,1! E5,115,2! G5,115,2! E6,115,2! " +
          "G2,116,2 B4,117,1! D5,117,1! B5,117,1! F3,118,2 G3,118,2 B3,118,2 D5,118,2! F5,118,2! " +
          "D6,118,2! C3,120,2 C5,120,6! E5,120,6! C6,120,6! E3,122,2 G3,122,2 C4,122,2 G3,124,2 " +
          "C4,124,2 E4,124,2 C5,126,1! C6,126,1! D5,127,1! D6,127,1! C3,128,2 C4,128,2 E5,128,1! " +
          "E6,128,1! C5,129,1! C6,129,1! G3,130,2 C4,130,2 E4,130,2 D5,130,1! D6,130,1! E5,131,2! " +
          "E6,131,2! A#2,132,2 A#3,132,2 C5,133,1! C6,133,1! G3,134,2 C4,134,2 E4,134,2 D5,134,1! " +
          "D6,134,1! C5,135,1! C6,135,1! A2,136,2 A3,136,2 E5,136,1! E6,136,1! C5,137,1! C6,137,1! " +
          "A3,138,2 C4,138,2 F4,138,2 D5,138,1! D6,138,1! E5,139,2! E6,139,2! G#2,140,2 G#3,140,2 " +
          "C5,141,1! C6,141,1! G#3,142,2 C4,142,2 F4,142,2 D5,142,1! D6,142,1! C5,143,1! C6,143,1! " +
          "G2,144,2 G3,144,2 E5,144,1! G5,144,1! E6,144,1! C5,145,1! E5,145,1! C6,145,1! G3,146,2 " +
          "C4,146,2 E4,146,2 D5,146,1! F5,146,1! D6,146,1! E5,147,2! G5,147,2! E6,147,2! G2,148,2 " +
          "B4,149,1! D5,149,1! B5,149,1! G3,150,2 B3,150,2 D5,150,2! F5,150,2! D6,150,2! C3,152,2 " +
          "G3,152,2 C4,152,2 C5,152,4! E5,152,4! C6,152,4! G2,154,2 G3,154,2",
        loud: 0.72,
        soft: 0.5,
      }),
  },
  minuet: {
    id: "minuet",
    title: "Minuet in G",
    opening: 5.2,
    make: () =>
      gridSong({
        title: "Minuet in G",
        composer: "From the Notebook for Anna Magdalena Bach, 1725",
        bpm: 112,
        div: 2,
        // Each half twice, as written.
        sections: [
          [0, 96],
          [0, 96],
          [96, 192],
          [96, 192],
        ],
        notes:
          "G3,0,4 B3,0,4 D4,0,4 D5,0,2! G4,2,1! A4,3,1! A3,4,2 B4,4,1! C5,5,1! B3,6,6 D5,6,2! G4,8,2! " +
          "G4,10,2! C4,12,6 E5,12,2! C5,14,1! D5,15,1! E5,16,1! F#5,17,1! B3,18,6 G5,18,2! G4,20,2! " +
          "G4,22,2! A3,24,6 C5,24,2! D5,26,1! C5,27,1! B4,28,1! A4,29,1! G3,30,6 B4,30,2! C5,32,1! " +
          "B4,33,1! A4,34,1! G4,35,1! D4,36,2 F#4,36,2! B3,38,2 G4,38,1! A4,39,1! G3,40,2 B4,40,1! " +
          "G4,41,0.77! B4,41.77,0.22! D4,42,2 A4,42,6! D3,44,1 C4,45,1 B3,46,1 A3,47,1 B3,48,4 D5,48,2! " +
          "G4,50,1! A4,51,1! A3,52,2 B4,52,1! C5,53,1! G3,54,2 D5,54,2! B3,56,2 G4,56,2! G3,58,2 " +
          "G4,58,2! C4,60,6 E5,60,2! C5,62,1! D5,63,1! E5,64,1! F#5,65,1! B3,66,2 G5,66,2! C4,68,1 " +
          "G4,68,2! B3,69,1 A3,70,1 G4,70,2! G3,71,1 A3,72,4 C5,72,2! D5,74,1! C5,75,1! F#3,76,2 " +
          "B4,76,1! A4,77,1! G3,78,4 B4,78,2! C5,80,1! B4,81,1! B3,82,2 A4,82,1! G4,83,1! C4,84,2 " +
          "A4,84,2! D4,86,2 B4,86,1! A4,87,1! D3,88,2 G4,88,1! F#4,89,1! G3,90,4 G4,90,6! G2,94,2 " +
          "G3,96,6 B5,96,2! G5,98,1! A5,99,1! B5,100,1! G5,101,1! F#3,102,6 A5,102,2! D5,104,1! " +
          "E5,105,1! F#5,106,1! D5,107,1! E3,108,2 G5,108,2! G3,110,2 E5,110,1! F#5,111,1! E3,112,2 " +
          "G5,112,1! D5,113,1! A3,114,4 C#5,114,2! B4,116,1! C#5,117,1! A2,118,2 A4,118,2! A3,120,6 " +
          "A4,120,1! B4,121,1! C#5,122,1! D5,123,1! E5,124,1! F#5,125,1! B3,126,2 G5,126,2! D4,128,2 " +
          "F#5,128,2! C#4,130,2 E5,130,2! D4,132,2 F#5,132,2! F#3,134,2 A4,134,2! A3,136,2 C#5,136,2! " +
          "D4,138,2 D5,138,6! D3,140,2 C4,142,2 B3,144,4 D5,144,2! D4,146,4 G4,146,1! F#4,147,1! " +
          "B3,148,2 G4,148,2! C4,150,4 E5,150,2! E4,152,4 G4,152,1! F#4,153,1! C4,154,2 G4,154,2! " +
          "B3,156,2 D5,156,2! A3,158,2 C5,158,2! G3,160,2 B4,160,2! D4,162,4 A4,162,1! G4,163,1! " +
          "F#4,164,1! G4,165,1! A4,166,2! D3,168,6 D4,168,1! E4,169,1! F#4,170,1! G4,171,1! F#3,172,2 " +
          "A4,172,1! B4,173,1! E3,174,2 C5,174,2! G3,176,2 B4,176,2! F#3,178,2 A4,178,2! G3,180,2 " +
          "B4,180,1! D5,181,1! B2,182,2 G4,182,2! D3,184,2 F#4,184,2! G3,186,2 B3,186,6! D4,186,6! " +
          "G4,186,6! D3,188,2 G2,190,2",
        loud: 0.66,
        soft: 0.56,
      }),
  },
  twinkle: {
    id: "twinkle",
    title: "Twinkle, Twinkle, Little Star",
    opening: 5,
    make: () =>
      songFromText({
        title: "Twinkle, Twinkle, Little Star",
        composer: "French folk tune, 1761",
        bpm: 100,
        text:
          "v0.72 C4/4 C4/4 G4/4 G4/4 | A4/4 A4/4 G4/2 | F4/4 F4/4 E4/4 E4/4 | D4/4 D4/4 C4/2 | " +
          "G4/4 G4/4 F4/4 F4/4 | E4/4 E4/4 D4/2 | G4/4 G4/4 F4/4 F4/4 | E4/4 E4/4 D4/2 | " +
          "C4/4 C4/4 G4/4 G4/4 | A4/4 A4/4 G4/2 | F4/4 F4/4 E4/4 E4/4 | D4/4 D4/4 C4/2" +
          " && v0.5 C3+G3/2 C3+E3/2 | F3+A3/2 C3+E3/2 | F3+A3/2 C3+G3/2 | G2+F3/2 C3+E3/2 | " +
          "C3+E3/2 F3+A3/2 | C3+G3/2 G2+F3/2 | C3+E3/2 F3+A3/2 | C3+G3/2 G2+F3/2 | " +
          "C3+G3/2 C3+E3/2 | F3+A3/2 C3+E3/2 | F3+A3/2 C3+G3/2 | G2+F3/2 C3+E3/2",
      }),
  },
  jacques: {
    id: "jacques",
    title: "Frère Jacques",
    opening: 5.3,
    make: () =>
      songFromText({
        title: "Frère Jacques",
        composer: "French round, 1700s",
        bpm: 112,
        text:
          "v0.72 C4/4 D4/4 E4/4 C4/4 | C4/4 D4/4 E4/4 C4/4 | E4/4 F4/4 G4/2 | E4/4 F4/4 G4/2 | " +
          "G4/8 A4/8 G4/8 F4/8 E4/4 C4/4 | G4/8 A4/8 G4/8 F4/8 E4/4 C4/4 | C4/4 G3/4 C4/2 | C4/4 G3/4 C4/2" +
          " && v0.5 C3+G3/2 C3+G3/2 | C3+G3/2 C3+G3/2 | C3+E3/2 C3+G3/2 | C3+E3/2 C3+G3/2 | " +
          "C3+E3/2 C3+G3/2 | C3+E3/2 C3+G3/2 | C3+G3/2 G2+G3/2 | C3+G3/2 C3/2",
      }),
  },
};

// ---- A keyboard's runtime -------------------------------------------------------------

// What every keyboard toy shares: its song player and song bar, the keys
// tapped, the sound of the song, and per key how far down it is, how long
// since it was struck and how soon it is struck next.
function keyboardRuntime({ low, high, songs, voice, hold = 0.9, drums = false }) {
  const n = high - low + 1;
  const player = new SongPlayer({ low, high, ahead: 0.9 });
  // Built-in songs start after a short lead-in, so the first keys can light
  // up (and the first hammers rise) before they sound.
  const LEAD = 0.5;
  const song = songControls(player, {
    songs: songs.map((x) => ({ ...x, make: () => leadIn(x.make(), LEAD) })),
  });
  const rt = {
    low,
    high,
    n,
    player,
    song,
    voice, // the voice the song plays in (the keyboard switches it)
    drums, // whether it plays a song's drums (the keyboard's pads)
    hold, // how long a tapped key stays down
    strikes: new Float64Array(n).fill(-1e3),
    down: new Float32Array(n),
    since: new Float32Array(n),
    next: new Float32Array(n),
    tapSince: new Float32Array(n),
    pedal: 0,
    voices: null, // src/voices.js, loaded when the sound is first on
    last: null,
  };
  // The song's notes, through the site's sound.
  const play = (sound) => (note, when, ring) => {
    const ctx = sound.audio();
    if (!ctx || !rt.voices) return;
    if (note.drum) {
      if (!rt.drums) return;
      const d = { 35: "kick", 36: "kick", 38: "snare", 40: "snare", 42: "hat", 44: "hat", 46: "hat" }[note.n] || "tom"; // prettier-ignore
      rt.voices.playSpec(ctx, sound.master, when, { voice: d, vol: 0.4 + 0.6 * note.v });
      return;
    }
    const v = typeof rt.voice === "function" ? rt.voice() : rt.voice;
    rt.voices.playSpec(ctx, sound.master, when, { voice: v, f: 440 * 2 ** ((note.n - 69) / 12), vol: 0.5 + 0.6 * note.v, hold: ring }); // prettier-ignore
  };
  // One frame: taps, the opening (the `song` pulse), the song, the keys.
  rt.frame = (c, info) => {
    const m = mem(c);
    const now = info.time;
    if (!m.started) {
      // A fresh toy: forget taps from before.
      m.started = true;
      rt.strikes.fill(-1e3);
      rt.last = null;
    }
    const dt = rt.last === null ? 0 : Math.max(0, Math.min(0.1, now - rt.last));
    rt.last = now;
    const tap = info.tap;
    if (tap && tap.n !== m.tapN) {
      m.tapN = tap.n;
      if (tap.key === "strike" && tap.pick !== null && tap.pick !== undefined)
        rt.strikes[clamp(Math.round(tap.pick), 0, n - 1)] = now;
      rt.onTap?.(tap, info);
    }
    if (fired(m, "song", c.song ?? 0)) {
      const id = song.current();
      player.seek(0);
      song.play({ until: (songs.find((s) => s.id === id)?.opening ?? 4.5) + LEAD });
    }
    const sound = info.sound;
    if (sound?.enabled && !rt.voices && !rt.loading) {
      rt.loading = true;
      import("../voices.js").then((v) => (rt.voices = v));
    }
    player.update(now, sound?.enabled && rt.voices ? sound : null, sound ? play(sound) : null);
    const on = player.playing;
    const k = on ? player.keys() : null;
    for (let i = 0; i < n; i++) {
      const s = now - rt.strikes[i];
      rt.tapSince[i] = s;
      // A tapped key goes down at once and comes up after `hold`.
      const tapDown = s >= 0 && s < hold + 0.06 ? band(s, 0, 0.025) * (1 - band(s, hold, hold + 0.06)) : 0; // prettier-ignore
      let d = tapDown;
      if (k) {
        // A song's key starts down just before its note sounds.
        const pre = k.next[i] < 0.03 ? 1 - k.next[i] / 0.03 : 0;
        d = Math.max(d, k.down[i], pre);
      }
      rt.down[i] = d;
      rt.since[i] = k ? k.since[i] : 1e3;
      rt.next[i] = k ? k.next[i] : 1e3;
    }
    const goal = on && player.pedal() ? 1 : 0;
    rt.pedal += (goal - rt.pedal) * Math.min(1, dt * 22);
    if (rt.pedal < 0.002 && !goal) rt.pedal = 0;
    return rt;
  };
  return rt;
}

// Shifts a song later by `lead` seconds.
function leadIn(song, lead) {
  for (const x of song.notes) x.t += lead;
  song.pedal = song.pedal.map(([a, b]) => [a + lead, b + lead]);
  song.length += lead;
  return song;
}

// A hammer: it flies up to the string as the note sounds and falls back.
// Song notes rise just before their time; a tapped key's hammer rises just
// after the tap.
function hammerLift(since, next, tapSince) {
  let h = 0;
  if (next < 0.04) h = Math.pow(1 - next / 0.04, 1.5);
  if (since < 0.25) h = Math.max(h, since < 0.02 ? 1 : 1 - smoothstep(0.02, 0.25, since));
  if (tapSince >= 0 && tapSince < 0.3)
    h = Math.max(h, tapSince < 0.035 ? Math.pow(tapSince / 0.035, 1.5) : 1 - smoothstep(0.05, 0.3, tapSince)); // prettier-ignore
  return h;
}

// A straight tube needs few samples along it (builds stay fast).
const STRAIGHT = { samples: 4, grid: 12 };

const levers = () => [new Float32Array(96), new Float32Array(96), new Float32Array(96)];

// ---- The grand piano ----------------------------------------------------------------

// In metres, the keyboard's front at z = 0 facing the viewer, the tail at
// the back. 88 keys (A0 to C8), a hammer for each and dampers for all but the
// top 18 (as on a real grand).
const G = (() => {
  const layout = keyLayout(21, 108, 0.0235);
  const outline = spline([
    [-0.765, 0, -0.17],
    [-0.765, 0, -0.9],
    [-0.765, 0, -1.7],
    [-0.735, 0, -1.98],
    [-0.6, 0, -2.07],
    [-0.4, 0, -2.02],
    [-0.16, 0, -1.8],
    [0.14, 0, -1.4],
    [0.42, 0, -1.02],
    [0.63, 0, -0.68],
    [0.74, 0, -0.42],
    [0.765, 0, -0.17],
  ]);
  // The outline as a polyline, for the lid, the soundboard and the strings.
  const poly = [];
  for (let i = 0; i <= 400; i++) poly.push(outline(i / 400));
  // How far right the case reaches at depth z, and how far back at x
  // (tables, looked up by position).
  const cross = (axis, v, pick) => {
    let best = null;
    const o = axis === 2 ? 0 : 2;
    for (let i = 0; i < poly.length - 1; i++) {
      const [a, b] = [poly[i], poly[i + 1]];
      if ((a[axis] - v) * (b[axis] - v) <= 0 && a[axis] !== b[axis]) {
        const f = (v - a[axis]) / (b[axis] - a[axis]);
        const w = a[o] + f * (b[o] - a[o]);
        best = best === null ? w : pick(best, w);
      }
    }
    return best;
  };
  const table = (lo, hi, fn) => {
    const t = new Float32Array(513);
    for (let i = 0; i <= 512; i++) t[i] = fn(lo + ((hi - lo) * i) / 512);
    return (v) => {
      const x = clamp((v - lo) / (hi - lo), 0, 1) * 512;
      const i = Math.min(511, Math.floor(x));
      return t[i] + (t[i + 1] - t[i]) * (x - i);
    };
  };
  const rightX = table(-2.08, -0.17, (z) => cross(2, z, Math.max) ?? -0.765);
  const backZ = table(-0.765, 0.765, (x) => cross(0, x, Math.min) ?? -0.17);
  return {
    layout,
    outline: along(poly),
    rightX,
    backZ,
    top: 0.72, // the white keys' top
    rim: [0.5, 0.99], // the case wall's bottom and top
    board: 0.815, // the soundboard and plate
    strings: 0.875, // the strings' height
    strike: -0.315, // where the hammers strike
    lid: 0.8, // how far the lid is raised (radians)
    dampers: 70, // keys with a damper (the top 18 have none)
  };
})();

const LACQUER = "#0d0d10";
const lacquer = (c, g = 0.45, sharp = 48) => lit(c, LACQUER, 0.5, g, sharp);
const IVORY = "#f2ede0";
const EBONY = "#15120f";
const FELT = "#ece6d8";
const BRASS = "#c9a24a";

const grand = keyboardRuntime({
  low: 21,
  high: 108,
  voice: "grand",
  songs: [SONGS.elise, SONGS.clair, SONGS.gymnopedie, SONGS.ode],
});
const grandLevers = levers();

function buildGrand(k) {
  sharpen(k);
  grand.player.pause();
  const { layout, outline, rightX, backZ } = G;
  const [y0, y1] = G.rim;
  // Levers: the keys tip about their balance rail, the hammers swing up
  // about their flange rail, the dampers lift off the strings.
  const keys = k.lever({ pivot: [0, 0.69, -0.42], axis: [1, 0, 0], angle: 0.055 });
  const hammers = k.lever({ pivot: [0, 0.8, -0.195], axis: [1, 0, 0], angle: 0.215, channel: 1 }); // prettier-ignore
  const dampers = k.lever({ dir: [0, 1, 0], move: 0.017, channel: 2 });
  const pedal = k.part("pedal", { pivot: [0.045, 0.1, -0.3], axis: [1, 0, 0] });

  // The keys: ivory and ebony.
  buildKeys(k, layout, keys, { top: G.top, len: 0.15, blackLen: 0.095, height: 0.022, white: IVORY, black: EBONY }); // prettier-ignore

  // The case: a black lacquered rim along the curved outline.
  const tangent = (u) => {
    const a = outline(Math.max(0, u - 0.002));
    const b = outline(Math.min(1, u + 0.002));
    return vec.unit([b[0] - a[0], 0, b[2] - a[2]]);
  };
  k.add(
    k.param(
      (u, v) => {
        const p = outline(u);
        return [p[0], y0 + v * (y1 - y0), p[2]];
      },
      { normal: (u) => outward(tangent(u)) },
    ),
    { color: (c) => lacquer(c), even: true, weight: 1.4, flat: 0.06, jitter: 0.006, interior: 0 },
  );
  // Its top edge, with the inside of the rim below it.
  k.add(
    k.param(
      (u, v) => {
        const p = outline(u);
        const t = tangent(u);
        return [p[0] - t[2] * 0.04 * v, y1, p[2] + t[0] * 0.04 * v];
      },
      { grid: 96, normal: UP },
    ),
    { color: (c) => lacquer(c, 0.3), even: true, weight: 1.4, flat: 0.1, jitter: 0.006 },
  );
  // The soundboard and the golden iron plate over it (its round holes show
  // the spruce), behind the hammers.
  const zFront = -0.36;
  const zBack = -2.06;
  k.add(
    k.param(
      (u, v) => {
        const z = zFront + (zBack - zFront) * u;
        const xr = rightX(z) - 0.03;
        const xl = -0.735;
        return [xl + (xr - xl) * v, G.board, z];
      },
      { grid: 80, normal: UP },
    ),
    {
      color: (c) => {
        const [x, , z] = c.p;
        const edge = Math.min(x + 0.735, rightX(z) - 0.03 - x, z - zBack);
        const holes = [
          [-0.35, -0.8],
          [0.02, -0.72],
          [-0.45, -1.35],
          [-0.12, -1.25],
          [-0.5, -1.75],
        ];
        const hole = holes.some(([hx, hz]) => (x - hx) ** 2 + (z - hz) ** 2 < 0.075 ** 2);
        if (edge < 0.05 || hole) return wood(c, "#d9b77c", c.p, 2, 0.82);
        return metal(c, BRASS, "#6f5424");
      },
      even: true,
      weight: 0.9,
      flat: 0.1,
      jitter: 0.01,
    },
  );
  // Under the hammers: the dark action bed, and the flange rail.
  k.add(evenBox(1.3, 0.01, 0.2), { pos: [0, 0.74, -0.26], color: (c) => lit(c, "#2c241c", 0.2), even: true, weight: 0.7 }); // prettier-ignore
  k.add(evenBox(1.26, 0.018, 0.022), { pos: [0, 0.79, -0.195], color: (c) => wood(c, "#6b4a2c", c.p, 0), even: true, weight: 1.4 }); // prettier-ignore

  // The strings: thin steel wires, copper-wound in the bass, from the front
  // of the plate back to the rim. A fixed share of the splats, long and
  // thin, so they read as wires over the plate.
  const runs = layout.keys.map((key) => {
    const x = key.x * 0.98;
    return { x, z1: backZ(x) + 0.08, copper: key.n < 45 };
  });
  const total = runs.reduce((sum, r) => sum + (-0.29 - r.z1), 0);
  for (const r of runs)
    k.add(
      k.tube((t) => [r.x, G.strings, -0.29 + (r.z1 + 0.29) * t], 0.0012, STRAIGHT),
      {
        color: (c) => metal(c, r.copper ? "#d08a4e" : "#eef1f5", r.copper ? "#6a3c18" : "#707782"),
        share: (0.1 * (-0.29 - r.z1)) / total,
        size: 0.3,
        stretch: 7,
        flat: 0.4,
        jitter: 0,
        pattern: false,
      },
    );

  // The hammers: felt heads on thin shanks, one per key.
  layout.keys.forEach((key, i) => {
    const x = key.x * 0.98;
    const params = [k.leverParam(hammers, i), 0];
    k.add(evenBox(0.0115, 0.026, 0.03), {
      pos: [x, 0.829, G.strike],
      color: (c) => (c.lp[1] > -0.004 ? lit(c, FELT, 0.25) : wood(c, "#7a5534", c.p, 1)),
      kind: "lever",
      params,
      even: true,
      weight: 2.2,
      flat: 0.15,
      jitter: 0.006,
      pattern: false,
    });
    k.add(
      k.tube((t) => [x, 0.8 + 0.018 * t, -0.195 - 0.105 * t], 0.0022, STRAIGHT),
      {
        color: (c) => wood(c, "#c9a57a", c.p, 2),
        kind: "lever",
        params,
        weight: 3,
        size: 0.45,
        stretch: 3,
        jitter: 0.004,
        pattern: false,
      },
    );
  });

  // The dampers: felt pads on wooden heads, resting on the strings.
  layout.keys.forEach((key, i) => {
    if (i >= G.dampers) return;
    k.add(evenBox(0.0125, 0.022, 0.026), {
      pos: [key.x * 0.98, G.strings + 0.0012 + 0.011, -0.385],
      color: (c) => (c.lp[1] < -0.005 ? lit(c, FELT, 0.2) : lit(c, "#1b1612", 0.35, 0.2)),
      kind: "lever",
      params: [k.leverParam(dampers, i), 0],
      even: true,
      weight: 2,
      flat: 0.15,
      jitter: 0.006,
      pattern: false,
    });
  });

  // The front: the key bed and slip, the cheek blocks at each end and the
  // nameboard behind the keys.
  const half = layout.width / 2;
  k.add(evenBox(layout.width + 0.02, 0.05, 0.02), { pos: [0, 0.68, 0.011], color: (c) => lacquer(c), even: true, weight: 1.2 }); // prettier-ignore
  k.add(evenBox(layout.width + 0.02, 0.012, 0.2), { pos: [0, 0.692, -0.09], color: (c) => lit(c, "#1c1a18", 0.2), even: true, weight: 0.5 }); // prettier-ignore
  for (const s of [-1, 1])
    k.add(evenRoundBox(0.075, 0.11, 0.2, 0.0225), {
      pos: [s * (half + 0.04), 0.715, -0.085],
      color: (c) => lacquer(c),
      even: true,
      weight: 1.2,
      flat: 0.1,
    });
  k.add(evenBox(layout.width + 0.02, 0.085, 0.018), {
    pos: [0, 0.742, -0.167],
    color: (c) => lacquer(c, 0.4),
    even: true,
    weight: 1.2,
  });
  // The case's bottom, under the keyboard and the rim.
  k.add(
    k.param(
      (u, v) => {
        const z = -0.17 + (zBack - 0.02 + 0.17) * u;
        const xr = rightX(z);
        return [-0.765 + (xr + 0.765) * v, y0, z];
      },
      { grid: 64, normal: UP },
    ),
    { color: (c) => lit(c, "#0a0a0c", 0.3), even: true, weight: 0.35, flat: 0.1 },
  );
  k.add(evenBox(layout.width + 0.18, 0.1, 0.19), { pos: [0, 0.6, -0.08], color: (c) => lacquer(c), even: true, weight: 0.7 }); // prettier-ignore

  // The lid, raised on its hinges along the straight side and held by its
  // prop stick.
  const a = G.lid;
  const hinge = [-0.765, y1 + 0.005];
  const lidPt = (x, z, lift = 0) => {
    const r = x - hinge[0];
    return [hinge[0] + r * Math.cos(a) - lift * Math.sin(a), hinge[1] + r * Math.sin(a) + lift * Math.cos(a), z]; // prettier-ignore
  };
  for (const side of [0, 1])
    k.add(
      k.param(
        (u, v) => {
          const z = -0.2 + (zBack - 0.01 + 0.2) * u;
          const xr = rightX(z);
          return lidPt(-0.765 + (xr + 0.765) * v, z, side * 0.022);
        },
        {
          grid: 72,
          normal: () => (side ? [-Math.sin(a), Math.cos(a), 0] : [Math.sin(a), -Math.cos(a), 0]),
        },
      ),
      { color: (c) => lacquer(c, side ? 0.6 : 0.3), even: true, weight: 1.2, flat: 0.1, jitter: 0.006 }, // prettier-ignore
    );
  const pz = -1.0;
  const px = rightX(pz) - 0.05;
  const top = lidPt(-0.765 + (rightX(pz) + 0.765) * 0.88, pz);
  k.add(
    k.tube((t) => [px + (top[0] - px) * t, y1 + (top[1] - y1) * t, pz], 0.011, STRAIGHT),
    {
      color: (c) => lacquer(c, 0.4),
      weight: 1.4,
    },
  );

  // The legs, on brass casters, and the lyre with its three brass pedals.
  for (const [x, z] of [
    [-0.68, -0.3],
    [0.68, -0.3],
    [-0.42, -1.72],
  ]) {
    k.add(evenCylinder(0.045, 0.062, y0 - 0.05), { pos: [x, (y0 + 0.05) / 2, z], color: (c) => lacquer(c, 0.2, 80), even: true, weight: 1.2 }); // prettier-ignore
    k.add(evenCylinder(0.03, 0.03, 0.05), { pos: [x, 0.025, z], color: (c) => metal(c, BRASS, "#5e4418"), even: true, weight: 1.5 }); // prettier-ignore
  }
  for (const s of [-1, 1])
    k.add(evenBox(0.022, y0 - 0.12, 0.05), { pos: [s * 0.07, (y0 + 0.12) / 2, -0.31], color: (c) => lacquer(c), even: true, weight: 1.2 }); // prettier-ignore
  k.add(evenBox(0.3, 0.06, 0.07), { pos: [0, 0.1, -0.31], color: (c) => lacquer(c), even: true, weight: 1.2 }); // prettier-ignore
  [-0.075, 0, 0.075].forEach((x, i) =>
    k.add(evenBox(0.032, 0.012, 0.11), {
      pos: [x, 0.1, -0.225],
      color: (c) => metal(c, BRASS, "#5e4418"),
      part: i === 2 ? pedal : 0,
      even: true,
      weight: 2.2,
    }),
  );
  k.reach([0, 0.1 - 0.02, -0.17]);
}

function driveGrand(t, c, out, info) {
  const r = grand.frame(c, info);
  const [dip, hammer, damper] = grandLevers;
  for (let i = 0; i < r.n; i++) {
    dip[i] = r.down[i];
    hammer[i] = hammerLift(r.since[i], r.next[i], r.tapSince[i]);
    damper[i] = i < G.dampers ? Math.max(r.down[i], r.pedal) : 0;
  }
  out.levers = grandLevers;
  out.parts.pedal = { angle: 0.16 * r.pedal };
}

// ---- The upright piano --------------------------------------------------------------

// A bar-room upright in walnut with its upper front panel off: the row of
// hammers, the dampers above them and the upright strings behind, all in
// view. 88 keys.
const U = {
  layout: keyLayout(21, 108, 0.0235),
  top: 0.72,
  strings: -0.385, // the strings' plane (z)
  dampers: 66,
};
const WALNUT = "#5a3a22";
const walnut = (c, p = c.p, axis = 1) => lit(c, wood(c, WALNUT, p, axis, 0.86), 0.35, 0.16, 40);

const upright = keyboardRuntime({ low: 21, high: 108, voice: "upright", songs: [SONGS.entertainer] }); // prettier-ignore
const uprightLevers = levers();

function buildUpright(k) {
  sharpen(k);
  upright.player.pause();
  const { layout } = U;
  const half = layout.width / 2;
  const keys = k.lever({ pivot: [0, 0.69, -0.38], axis: [1, 0, 0], angle: 0.058 });
  // The hammers stand on their butts and swing back onto the strings.
  const hammers = k.lever({ pivot: [0, 0.86, -0.295], axis: [1, 0, 0], angle: -0.18, channel: 1 }); // prettier-ignore
  const dampers = k.lever({ dir: [0, 0, 1], move: 0.014, channel: 2 });
  const pedal = k.part("pedal", { pivot: [0.06, 0.07, -0.2], axis: [1, 0, 0] });

  buildKeys(k, layout, keys, { top: U.top, len: 0.14, blackLen: 0.088, height: 0.022, white: IVORY, black: EBONY }); // prettier-ignore

  // The case: two tall sides, the top, the back, the key bed and the lower
  // front board, in walnut.
  const W = layout.width + 0.1;
  for (const s of [-1, 1]) {
    k.add(evenBox(0.05, 1.28, 0.62), { pos: [s * (W / 2 + 0.025), 0.64, -0.31], color: (c) => walnut(c, c.p, 1), even: true, weight: 1.3, flat: 0.06 }); // prettier-ignore
    // The arm (cheek) beside the keys, with a rounded end.
    k.add(evenRoundBox(0.06, 0.1, 0.24, 0.018), { pos: [s * (half + 0.035), 0.72, -0.07], color: (c) => walnut(c, c.p, 2), even: true, weight: 1.2, flat: 0.1 }); // prettier-ignore
    // A turned leg under each arm, on a toe block.
    k.add(k.lathe([[0.022, 0], [0.03, 0.08], [0.02, 0.2], [0.032, 0.34], [0.026, 0.52], [0.03, 0.6]]), { pos: [s * (half + 0.035), 0.06, -0.02], color: (c) => walnut(c, c.p, 1), even: true, weight: 1.2 }); // prettier-ignore
    k.add(evenBox(0.07, 0.06, 0.34), { pos: [s * (half + 0.035), 0.03, -0.14], color: (c) => walnut(c, c.p, 2), even: true, weight: 1 }); // prettier-ignore
  }
  k.add(evenBox(W + 0.12, 0.035, 0.66), { pos: [0, 1.3, -0.32], color: (c) => walnut(c, c.p, 0), even: true, weight: 1.2, flat: 0.06 }); // prettier-ignore
  k.add(evenBox(W, 1.28, 0.03), { pos: [0, 0.64, -0.61], color: (c) => lit(c, "#3b2616", 0.3), even: true, weight: 0.4 }); // prettier-ignore
  k.add(evenBox(W, 0.6, 0.03), { pos: [0, 0.32, -0.18], color: (c) => walnut(c, c.p, 0), even: true, weight: 1.2, flat: 0.06 }); // prettier-ignore
  k.add(evenBox(W, 0.055, 0.2), { pos: [0, 0.665, -0.08], color: (c) => walnut(c, c.p, 0), even: true, weight: 1 }); // prettier-ignore
  k.add(evenBox(layout.width + 0.01, 0.045, 0.018), { pos: [0, 0.683, 0.01], color: (c) => walnut(c, c.p, 0), even: true, weight: 1.4 }); // prettier-ignore
  // The fallboard, folded back against the action's foot.
  k.add(evenBox(layout.width + 0.01, 0.06, 0.016), { pos: [0, 0.76, -0.152], color: (c) => walnut(c, c.p, 0), even: true, weight: 1.2 }); // prettier-ignore

  // Behind the action: the golden plate with its tuning pins at the top,
  // and the spruce soundboard showing through its opening.
  k.add(evenBox(W - 0.02, 0.9, 0.012), {
    pos: [0, 0.8, U.strings - 0.03],
    color: (c) => {
      const [x, y] = c.p;
      const open = y > 0.55 && y < 1.1 && Math.abs(x) < W / 2 - 0.1 && !(Math.abs(x + 0.18) < 0.03);
      return open ? wood(c, "#d6b27a", c.p, 1, 0.84) : metal(c, BRASS, "#6f5424");
    },
    even: true,
    weight: 1,
    flat: 0.1,
  });
  k.cloud({ share: 0.012, size: 0.42 }, (rand, i, n) => {
    const col = i % 88;
    const row = Math.floor(i / 88) % 2;
    return {
      p: [layout.keys[col].x * 0.98 + (row - 0.5) * 0.006, 1.16 + row * 0.02, U.strings + 0.004],
      color: "#c9ced6",
      n: [0, 0, 1],
      pattern: false,
    };
  });
  // The strings, upright, steel and copper-wound.
  const total = layout.keys.length;
  layout.keys.forEach((key) => {
    const copper = key.n < 45;
    k.add(
      k.tube((t) => [key.x * 0.98, 0.45 + 0.72 * t, U.strings], 0.0012, STRAIGHT),
      {
        color: (c) => metal(c, copper ? "#d08a4e" : "#eef1f5", copper ? "#6a3c18" : "#707782"),
        share: 0.07 / total,
        size: 0.3,
        stretch: 7,
        flat: 0.4,
        jitter: 0,
        pattern: false,
      },
    );
  });

  // The action: the hammer rail, and per key a hammer (butt, shank and felt
  // head facing the strings) and a damper above it.
  k.add(evenBox(layout.width, 0.02, 0.02), { pos: [0, 0.905, -0.29], color: (c) => lit(c, "#7b1f24", 0.25), even: true, weight: 1.2 }); // prettier-ignore
  k.add(evenBox(layout.width, 0.025, 0.03), { pos: [0, 0.845, -0.3], color: (c) => wood(c, "#8a6440", c.p, 0), even: true, weight: 1.2 }); // prettier-ignore
  k.add(evenBox(layout.width, 0.018, 0.02), { pos: [0, 1.105, -0.345], color: (c) => wood(c, "#8a6440", c.p, 0), even: true, weight: 1.2 }); // prettier-ignore
  for (const s of [-1, 1])
    k.add(evenBox(0.02, 0.4, 0.04), { pos: [s * (half + 0.005), 0.92, -0.32], color: (c) => metal(c, "#9aa0a8", "#3a3f46"), even: true, weight: 1.2 }); // prettier-ignore
  layout.keys.forEach((key, i) => {
    const x = key.x * 0.98;
    const params = [k.leverParam(hammers, i), 0];
    k.add(evenBox(0.012, 0.03, 0.028), { pos: [x, 0.868, -0.297], color: (c) => wood(c, "#b58a5c", c.p, 1), kind: "lever", params, even: true, weight: 1.6, pattern: false }); // prettier-ignore
    k.add(k.tube((t) => [x, 0.88 + 0.1 * t, -0.3 - 0.02 * t], 0.0024, STRAIGHT), { color: (c) => wood(c, "#d1b184", c.p, 1), kind: "lever", params, weight: 3, size: 0.45, stretch: 3, pattern: false }); // prettier-ignore
    k.add(evenBox(0.012, 0.036, 0.034), {
      pos: [x, 0.99, -0.34],
      color: (c) => (c.lp[1] > -0.012 ? lit(c, FELT, 0.25) : wood(c, "#7a5534", c.p, 1)),
      kind: "lever",
      params,
      even: true,
      weight: 2.2,
      flat: 0.15,
      jitter: 0.006,
      pattern: false,
    });
    if (i < U.dampers)
      k.add(evenBox(0.012, 0.03, 0.02), {
        pos: [x, 1.07, U.strings + 0.0012 + 0.01],
        color: (c) => (c.lp[2] < -0.004 ? lit(c, FELT, 0.2) : lit(c, "#2a1d14", 0.3, 0.1)),
        kind: "lever",
        params: [k.leverParam(dampers, i), 0],
        even: true,
        weight: 2,
        flat: 0.15,
        pattern: false,
      });
  });

  // Two brass pedals under the keys; the right one holds the dampers off.
  [-0.06, 0.06].forEach((x, i) =>
    k.add(evenBox(0.034, 0.012, 0.11), {
      pos: [x, 0.07, -0.13],
      color: (c) => metal(c, BRASS, "#5e4418"),
      part: i === 1 ? pedal : 0,
      even: true,
      weight: 2.2,
    }),
  );
  k.reach([0, 0.05, -0.08]);
}

function driveUpright(t, c, out, info) {
  const r = upright.frame(c, info);
  const [dip, hammer, damper] = uprightLevers;
  for (let i = 0; i < r.n; i++) {
    dip[i] = r.down[i];
    hammer[i] = hammerLift(r.since[i], r.next[i], r.tapSince[i]);
    damper[i] = i < U.dampers ? Math.max(r.down[i], r.pedal) : 0;
  }
  out.levers = uprightLevers;
  out.parts.pedal = { angle: 0.16 * r.pedal };
}

// ---- The harpsichord ----------------------------------------------------------------

// A French-style harpsichord: a painted green wing-shaped case on a turned
// stand, black naturals and bone sharps, 61 keys (F1 to F6). A key lifts its
// jack, whose quill plucks the string; the string quivers until the key comes
// up and the jack's felt damps it.
const HC = (() => {
  const layout = keyLayout(29, 89, 0.0222);
  const outline = spline([
    [-0.47, 0, -0.13],
    [-0.47, 0, -1.2],
    [-0.47, 0, -2.08],
    [-0.43, 0, -2.25],
    [-0.3, 0, -2.27],
    [-0.12, 0, -1.98],
    [0.12, 0, -1.5],
    [0.33, 0, -1.02],
    [0.45, 0, -0.58],
    [0.47, 0, -0.3],
    [0.47, 0, -0.13],
  ]);
  const poly = [];
  for (let i = 0; i <= 400; i++) poly.push(outline(i / 400));
  const cross = (axis, v, pick) => {
    let best = null;
    const o = axis === 2 ? 0 : 2;
    for (let i = 0; i < poly.length - 1; i++) {
      const [a, b] = [poly[i], poly[i + 1]];
      if ((a[axis] - v) * (b[axis] - v) <= 0 && a[axis] !== b[axis]) {
        const f = (v - a[axis]) / (b[axis] - a[axis]);
        const w = a[o] + f * (b[o] - a[o]);
        best = best === null ? w : pick(best, w);
      }
    }
    return best;
  };
  const table = (lo, hi, fn) => {
    const t = new Float32Array(513);
    for (let i = 0; i <= 512; i++) t[i] = fn(lo + ((hi - lo) * i) / 512);
    return (v) => {
      const x = clamp((v - lo) / (hi - lo), 0, 1) * 512;
      const i = Math.min(511, Math.floor(x));
      return t[i] + (t[i + 1] - t[i]) * (x - i);
    };
  };
  return {
    layout,
    outline: along(poly),
    rightX: table(-2.28, -0.13, (z) => cross(2, z, Math.max) ?? -0.47),
    backZ: table(-0.47, 0.47, (x) => cross(0, x, Math.min) ?? -0.13),
    top: 0.78,
    rim: [0.62, 0.93],
    board: 0.86,
    strings: 0.885,
    jacks: -0.262,
    lid: 0.78,
  };
})();
const GREEN = "#1f4636";
const GILT = "#c9a44e";
const BONE = "#efe8d6";
const painted = (c, col = GREEN, g = 0.25) => lit(c, col, 0.4, g, 40);

const harpsichord = keyboardRuntime({ low: 29, high: 89, voice: "harpsichord", songs: [SONGS.minuet] }); // prettier-ignore
const harpsichordLevers = levers();

function buildHarpsichord(k) {
  sharpen(k);
  harpsichord.player.pause();
  const { layout, outline, rightX, backZ } = HC;
  const [y0, y1] = HC.rim;
  const half = layout.width / 2;
  const keys = k.lever({ pivot: [0, 0.75, -0.36], axis: [1, 0, 0], angle: 0.05 });
  const jacks = k.lever({ dir: [0, 1, 0], move: 0.013, channel: 1 });
  const hum = k.lever({ dir: [0.8, 0.6, 0], vibrate: 0.0028, channel: 2 });

  // Black naturals and bone sharps.
  buildKeys(k, layout, keys, { top: HC.top, len: 0.13, blackLen: 0.08, height: 0.02, blackHeight: 0.01, white: "#1d1915", black: BONE, whiteGloss: 0.3, blackGloss: 0.2 }); // prettier-ignore

  // The case: painted green with a gilded band along its top edge.
  const tangent = (u) => {
    const a = outline(Math.max(0, u - 0.002));
    const b = outline(Math.min(1, u + 0.002));
    return vec.unit([b[0] - a[0], 0, b[2] - a[2]]);
  };
  k.add(
    k.param(
      (u, v) => {
        const p = outline(u);
        return [p[0], y0 + v * (y1 - y0), p[2]];
      },
      { normal: (u) => outward(tangent(u)) },
    ),
    {
      color: (c) =>
        c.p[1] > y1 - 0.035 && c.p[1] < y1 - 0.02 ? metal(c, GILT, "#6b5220") : painted(c),
      even: true,
      weight: 1.3,
      flat: 0.06,
      jitter: 0.006,
    },
  );
  k.add(
    k.param(
      (u, v) => {
        const p = outline(u);
        const t = tangent(u);
        return [p[0] - t[2] * 0.03 * v, y1, p[2] + t[0] * 0.03 * v];
      },
      { grid: 96, normal: UP },
    ),
    { color: (c) => metal(c, GILT, "#6b5220"), even: true, weight: 1.2, flat: 0.08 },
  );
  // The soundboard, with a gilded rose, and the wrest plank at the front.
  k.add(
    k.param(
      (u, v) => {
        const z = -0.29 + (-2.24 + 0.29) * u;
        const xr = rightX(z) - 0.02;
        return [-0.45 + (xr + 0.45) * v, HC.board, z];
      },
      { grid: 80, normal: UP },
    ),
    {
      color: (c) => {
        const [x, , z] = c.p;
        const r = Math.hypot(x + 0.05, z + 1.25);
        if (r < 0.06) return metal(c, GILT, "#6b5220");
        if (r < 0.068) return lit(c, "#7b5a2a", 0.2);
        return wood(c, "#e4c690", c.p, 2, 0.88);
      },
      even: true,
      weight: 1,
      flat: 0.1,
      jitter: 0.008,
    },
  );
  k.add(evenBox(0.9, 0.02, 0.1), { pos: [0, 0.86, -0.19], color: (c) => wood(c, "#9b7040", c.p, 0), even: true, weight: 1 }); // prettier-ignore
  // The bridge on the soundboard, curving with the bentside.
  k.add(
    k.tube(
      (t) => {
        const x = -0.4 + 0.8 * t;
        return [x, HC.board + 0.008, backZ(x * 0.98) + 0.12];
      },
      0.006,
      { samples: 32, grid: 16 },
    ),
    { color: (c) => wood(c, "#8a5f34", c.p, 0), weight: 1.6 },
  );

  // The strings, brass in the bass and steel above, from the wrest plank's
  // pins to the back.
  const runs = layout.keys.map((key) => {
    const x = key.x * 1.02;
    return { x, z1: backZ(x) + 0.06, brass: key.n < 53 };
  });
  const total = runs.reduce((sum, r) => sum + (-0.17 - r.z1), 0);
  runs.forEach((r, i) =>
    k.add(
      k.tube((t) => [r.x, HC.strings, -0.17 + (r.z1 + 0.17) * t], 0.001, STRAIGHT),
      {
        color: (c) => metal(c, r.brass ? "#e2b865" : "#eef1f5", r.brass ? "#6d5220" : "#707782"),
        share: (0.05 * (-0.17 - r.z1)) / total,
        size: 0.3,
        stretch: 7,
        flat: 0.4,
        jitter: 0,
        kind: "lever",
        params: (c) => [k.leverParam(hum, i), c.t ?? 0],
        pattern: false,
      },
    ),
  );
  // Tuning pins along the wrest plank.
  k.cloud({ share: 0.006, size: 0.45 }, (rand, i) => {
    const key = layout.keys[i % layout.keys.length];
    return { p: [key.x * 1.02, 0.874, -0.16 - 0.012 * (i % 2)], color: "#c3c8cf", n: [0, 1, 0], pattern: false }; // prettier-ignore
  });
  // The jacks: thin wooden slips standing in the gap, each with a red felt
  // damper at its top, rising with its key.
  layout.keys.forEach((key, i) => {
    k.add(evenBox(0.0055, 0.07, 0.012), {
      pos: [key.x * 1.02, 0.875, HC.jacks],
      color: (c) => (c.lp[1] > 0.022 ? lit(c, "#a3262a", 0.25) : wood(c, "#6b4a2a", c.p, 1)),
      kind: "lever",
      params: [k.leverParam(jacks, i), 0],
      even: true,
      weight: 2.4,
      flat: 0.15,
      pattern: false,
    });
  });
  // The jack rail's ends, and the dark gap they stand in.
  k.add(evenBox(0.88, 0.006, 0.03), { pos: [0, 0.846, HC.jacks], color: (c) => lit(c, "#1b140e", 0.2), even: true, weight: 0.8 }); // prettier-ignore

  // The keywell: the cheeks and the nameboard, painted and gilded.
  for (const s of [-1, 1])
    k.add(evenBox(0.05, 0.13, 0.19), { pos: [s * (half + 0.03), 0.78, -0.06], color: (c) => painted(c), even: true, weight: 1.3, flat: 0.08 }); // prettier-ignore
  k.add(evenBox(layout.width + 0.02, 0.06, 0.016), { pos: [0, 0.8, -0.135], color: (c) => (Math.abs(c.lp[1]) < 0.006 ? metal(c, GILT, "#6b5220") : painted(c)), even: true, weight: 1.4 }); // prettier-ignore
  k.add(evenBox(layout.width + 0.1, 0.05, 0.2), { pos: [0, 0.725, -0.06], color: (c) => painted(c), even: true, weight: 1.1 }); // prettier-ignore
  // The case's bottom.
  k.add(
    k.param(
      (u, v) => {
        const z = -0.13 + (-2.26 + 0.13) * u;
        const xr = rightX(z);
        return [-0.47 + (xr + 0.47) * v, y0, z];
      },
      { grid: 64, normal: UP },
    ),
    { color: (c) => painted(c, "#173628", 0.1), even: true, weight: 0.35 },
  );

  // The lid, raised: green outside, painted cream inside with a gilded line.
  const a = HC.lid;
  const hinge = [-0.47, y1 + 0.004];
  const lidPt = (x, z, lift = 0) => {
    const r = x - hinge[0];
    return [hinge[0] + r * Math.cos(a) - lift * Math.sin(a), hinge[1] + r * Math.sin(a) + lift * Math.cos(a), z]; // prettier-ignore
  };
  for (const side of [0, 1])
    k.add(
      k.param(
        (u, v) => {
          const z = -0.16 + (-2.26 + 0.16) * u;
          const xr = rightX(z);
          return lidPt(-0.47 + (xr + 0.47) * v, z, side * 0.018);
        },
        {
          grid: 72,
          normal: () => (side ? [-Math.sin(a), Math.cos(a), 0] : [Math.sin(a), -Math.cos(a), 0]),
        },
      ),
      {
        color: (c) => {
          if (side) return painted(c, GREEN, 0.4);
          const [x, , z] = c.p;
          const r = hinge[0] + (rightX(z) + 0.47) * Math.cos(a);
          const edge = Math.min(Math.abs(x - r) / Math.cos(a), z + 2.26, -0.16 - z);
          return edge > 0.04 && edge < 0.05 ? metal(c, GILT, "#6b5220") : lit(c, "#efe4c9", 0.2);
        },
        even: true,
        weight: 1.3,
        flat: 0.1,
        jitter: 0.006,
      },
    );
  const pz = -1.05;
  const px = rightX(pz) - 0.04;
  const tip = lidPt(-0.47 + (rightX(pz) + 0.47) * 0.86, pz);
  k.add(k.tube((t) => [px + (tip[0] - px) * t, y1 + (tip[1] - y1) * t, pz], 0.008, STRAIGHT), { color: (c) => painted(c), weight: 1.4 }); // prettier-ignore

  // The stand: turned legs joined by stretchers near the floor.
  const legs = [[-0.42, -0.2], [0.42, -0.2], [-0.42, -1.1], [0.3, -1.1], [-0.42, -2.05], [-0.2, -2.05]]; // prettier-ignore
  const profile = [[0.026, 0], [0.035, 0.05], [0.022, 0.12], [0.04, 0.24], [0.028, 0.4], [0.034, 0.52], [0.03, 0.6]]; // prettier-ignore
  for (const [x, z] of legs)
    k.add(k.lathe(profile), { pos: [x, 0.02, z], color: (c) => (c.p[1] > 0.23 && c.p[1] < 0.27 ? metal(c, GILT, "#6b5220") : painted(c)), even: true, weight: 1.2 }); // prettier-ignore
  for (const [[xa, za], [xb, zb]] of [[legs[0], legs[1]], [legs[0], legs[4]], [legs[2], legs[3]], [legs[4], legs[5]]]) // prettier-ignore
    k.add(k.tube((t) => [xa + (xb - xa) * t, 0.1, za + (zb - za) * t], 0.014, STRAIGHT), { color: (c) => painted(c), weight: 1 }); // prettier-ignore
}

function driveHarpsichord(t, c, out, info) {
  const r = harpsichord.frame(c, info);
  const [dip, jack, ring] = harpsichordLevers;
  for (let i = 0; i < r.n; i++) {
    const d = r.down[i];
    dip[i] = d;
    // The jack rises a moment ahead of the key's full dip: it plucks on the
    // way up.
    jack[i] = Math.min(1, d * 1.3);
    // The plucked string rings while the key is down, then the jack's felt
    // stops it.
    const s = Math.min(r.since[i], r.tapSince[i] >= 0 ? r.tapSince[i] : 1e3);
    ring[i] = d > 0.5 && s < 3 ? Math.exp(-s * 1.4) : 0;
  }
  out.levers = harpsichordLevers;
}

// ---- The electronic keyboard --------------------------------------------------------

// A home keyboard with 61 keys (C2 to C7) that light up just ahead of each
// note of its song, a little screen that scrolls the song's title, four voice
// buttons (piano, organ, synth, vibes) and four drum pads that light with the
// beat. No names or logos on it.
const EK = {
  layout: keyLayout(36, 96, 0.0225),
  top: 0.088,
  buttons: [
    { voice: "grand", name: "PIANO", color: "#e9e4d8", x: 0.16 },
    { voice: "organ", name: "ORGAN", color: "#e0a93e", x: 0.205 },
    { voice: "synth", name: "SYNTH", color: "#cf4f86", x: 0.25 },
    { voice: "vibes", name: "VIBES", color: "#4a95d6", x: 0.295 },
  ],
  buttonZ: -0.215,
  pads: [
    [-0.335, -0.195],
    [-0.285, -0.195],
    [-0.335, -0.25],
    [-0.285, -0.25],
  ],
  screen: { x: -0.02, z: -0.225, w: 0.2, d: 0.07 },
  FIRST_BUTTON: 61, // lever indices after the keys
  FIRST_PAD: 65,
};
const PLASTIC = "#26282d";

const keyboardState = { voice: 0, title: "", playing: false, shown: "" };
const ekRt = keyboardRuntime({
  low: 36,
  high: 96,
  voice: () => EK.buttons[keyboardState.voice].voice,
  songs: [SONGS.ode, SONGS.twinkle, SONGS.jacques],
  drums: true,
});
const ekLevers = levers();
const DRUMS = { 36: "kick", 38: "snare", 42: "hat", 45: "tom" };
// Which pad a drum note lights: kick, snare, hi-hat, tom.
const padOf = (n) => (n === 35 || n === 36 ? 0 : n === 38 || n === 40 ? 1 : n === 42 || n === 44 || n === 46 ? 2 : 3); // prettier-ignore

// A simple beat under a song with no drums of its own: kick on beats 1 and
// 3, snare on 2 and 4, hi-hat on every half beat and a tom at the end of
// every fourth bar.
function addBeat(song) {
  if (song.beat) return song;
  song.beat = true;
  if (song.notes.some((x) => x.drum)) return song;
  const beat = 60 / (song.bpm || 100);
  const t0 = song.notes[0]?.t ?? 0;
  const end = song.notes.reduce((m, x) => Math.max(m, x.t + x.d), 0);
  for (let i = 0, t = t0; t < end - 0.05; i++, t = t0 + (i * beat) / 2) {
    const b = i / 2;
    const add = (n, v) => song.notes.push({ t, d: 0.08, n, v, ch: 9, drum: true });
    add(42, i % 2 ? 0.28 : 0.4);
    if (i % 2 === 0 && b % 2 === 0) add(36, 0.8);
    if (i % 2 === 0 && b % 2 === 1) add(38, 0.6);
    if (i % 32 === 31) add(45, 0.55);
  }
  song.notes.sort((a, b) => a.t - b.t || a.n - b.n);
  return song;
}

ekRt.onTap = (tap, info) => {
  if (tap.key === "voice" && tap.pick !== null && tap.pick !== undefined) {
    keyboardState.voice = clamp(Math.round(tap.pick), 0, EK.buttons.length - 1);
    keyboardState.pressAt = info.time;
    keyboardState.pressed = keyboardState.voice;
  }
  // A key plays in the chosen voice (so the app keeps quiet for it).
  const sound = info.sound;
  if (!sound?.enabled || !ekRt.voices) return;
  const ctx = sound.audio();
  if (!ctx) return;
  if (tap.key === "strike" && tap.pick !== null && tap.pick !== undefined) {
    const n = EK.layout.keys[clamp(Math.round(tap.pick), 0, EK.layout.keys.length - 1)].n;
    ekRt.voices.playSpec(ctx, sound.master, ctx.currentTime + 0.005, { voice: EK.buttons[keyboardState.voice].voice, f: 440 * 2 ** ((n - 69) / 12), vol: 1, hold: ekRt.hold }); // prettier-ignore
  } else if (tap.key === "voice") {
    ekRt.voices.playSpec(ctx, sound.master, ctx.currentTime + 0.005, { voice: "click", f: 2400, vol: 0.7 }); // prettier-ignore
  }
};

// The screen: the song's title scrolling past, and the voice.
function drawKeyboardScreen(g, time) {
  const { width: w, height: h } = g.canvas;
  g.fillStyle = "#0f2b2a";
  g.fillRect(0, 0, w, h);
  const glow = "#8ef0d0";
  g.fillStyle = glow;
  g.font = `bold ${Math.round(h * 0.34)}px monospace`;
  g.textBaseline = "middle";
  const text = `♪ ${keyboardState.title || "Tap a key"}   `;
  const tw = g.measureText(text).width;
  const x = keyboardState.playing ? -((time * 60) % tw) : w * 0.04;
  g.fillText(text, x, h * 0.36);
  if (keyboardState.playing) g.fillText(text, x + tw, h * 0.36);
  g.font = `${Math.round(h * 0.22)}px monospace`;
  g.fillStyle = "#5fbfa2";
  g.fillText(`VOICE ${EK.buttons[keyboardState.voice].name}`, w * 0.04, h * 0.78);
}

function buildKeyboard(k) {
  sharpen(k);
  ekRt.player.pause();
  const { layout } = EK;
  const half = layout.width / 2;
  // Keys tip about a rail near their back and light up by their second
  // amount; the panel buttons and the drum pads press down and glow.
  const keys = k.lever({ pivot: [0, 0.075, -0.2], axis: [1, 0, 0], angle: 0.045, glow: "#3fb6ff", glowChannel: 1 }); // prettier-ignore
  const buttons = k.lever({ dir: [0, -1, 0], move: 0.004, glow: "#fff4d0", glowChannel: 1 });
  const pads = k.lever({ dir: [0, -1, 0], move: 0.004, glow: "#ff8a3a", glowChannel: 1 });

  buildKeys(k, layout, keys, { top: EK.top, len: 0.13, blackLen: 0.082, height: 0.018, blackHeight: 0.01, white: "#f4f4f2", black: "#121214", whiteGloss: 0.25, blackGloss: 0.45 }); // prettier-ignore

  // The body: a charcoal slab with a rounded front lip under the keys and
  // the panel behind them.
  const body = (c, g = 0.25) => lit(c, PLASTIC, 0.45, g, 50);
  k.add(evenBox(0.97, 0.07, 0.36), { pos: [0, 0.035, -0.16], color: (c) => body(c), even: true, weight: 1.1, flat: 0.06 }); // prettier-ignore
  k.add(evenBox(0.95, 0.012, 0.19), { pos: [0, 0.076, -0.235], color: (c) => lit(c, "#1d1e22", 0.3, 0.15, 50), even: true, weight: 1.2 }); // prettier-ignore
  for (const sgn of [-1, 1])
    k.add(evenBox(0.04, 0.024, 0.15), { pos: [sgn * (half + 0.02), 0.082, -0.07], color: (c) => body(c, 0.3), even: true, weight: 1.4 }); // prettier-ignore
  k.add(evenBox(layout.width, 0.012, 0.012), { pos: [0, 0.086, -0.137], color: (c) => lit(c, "#8a1d2a", 0.2), even: true, weight: 1.6 }); // prettier-ignore
  // A silver line along the panel's front edge.
  k.add(evenBox(0.95, 0.003, 0.004), { pos: [0, 0.0825, -0.143], color: (c) => lit(c, "#b8bec6", 0.3, 0.5), weight: 2 }); // prettier-ignore

  // The screen, in its dark bezel.
  const S = EK.screen;
  k.add(evenBox(S.w + 0.024, 0.006, S.d + 0.02), { pos: [S.x, 0.084, S.z], color: (c) => lit(c, "#0b0c0e", 0.2, 0.3), even: true, weight: 1.6 }); // prettier-ignore
  k.add(
    k.param((u, v) => [S.x - S.w / 2 + S.w * u, 0.0875, S.z - S.d / 2 + S.d * v], { grid: 24, normal: UP }), // prettier-ignore
    {
      color: "#1a3a36",
      kind: "screen",
      params: (c) => [c.u, c.v],
      flat: 0.08,
      even: true,
      weight: 9,
      size: 1,
      jitter: 0,
      pattern: false,
    },
  );
  // The voice buttons, each its own colour.
  EK.buttons.forEach((b, i) =>
    k.add(evenRoundBox(0.034, 0.01, 0.024, 0.003), {
      pos: [b.x, 0.086, EK.buttonZ],
      color: (c) => lit(c, b.color, 0.35, 0.25),
      kind: "lever",
      params: [k.leverParam(buttons, EK.FIRST_BUTTON + i), 0],
      even: true,
      weight: 2.4,
      pattern: false,
    }),
  );
  // The drum pads: rubber squares in the panel.
  EK.pads.forEach(([x, z], i) =>
    k.add(evenRoundBox(0.042, 0.008, 0.042, 0.0024), {
      pos: [x, 0.085, z],
      color: (c) => lit(c, ["#3a3d44", "#40434a", "#3a3d44", "#40434a"][i], 0.4, 0.1),
      kind: "lever",
      params: [k.leverParam(pads, EK.FIRST_PAD + i), 0],
      even: true,
      weight: 2.2,
      pattern: false,
    }),
  );
  // Two speaker grilles and a green power light.
  for (const sgn of [-1, 1])
    k.add(evenCylinder(0.042, 0.042, 0.004), {
      pos: [sgn * 0.405, 0.083, -0.225],
      color: (c) => {
        const [x, , z] = c.lp;
        const hole = (Math.round(x / 0.006) + Math.round(z / 0.006)) % 2 === 0;
        return lit(c, hole ? "#0c0d10" : "#3c3f46", 0.3);
      },
      even: true,
      weight: 2,
      pattern: false,
    });
  k.add(k.sphere(0.004), { pos: [0.37, 0.085, -0.155], color: "#6dff8a", weight: 3, pattern: false }); // prettier-ignore
  // Rubber feet.
  for (const [x, z] of [
    [-0.43, -0.03],
    [0.43, -0.03],
    [-0.43, -0.3],
    [0.43, -0.3],
  ])
    k.add(evenCylinder(0.018, 0.018, 0.008), { pos: [x, -0.003, z], color: "#101012", weight: 1 });
}

function driveKeyboard(t, c, out, info) {
  const r = ekRt.frame(c, info);
  const player = r.player;
  const song = player.song;
  if (song && !song.beat) addBeat(song);
  keyboardState.title = song?.title ?? "";
  keyboardState.playing = player.playing;
  const [dip, light, hit] = ekLevers;
  // Each key lights up a moment before it is played (the next note to
  // come glows brighter as it nears) and stays lit while it is down.
  for (let i = 0; i < r.n; i++) {
    dip[i] = r.down[i];
    const ahead = player.playing && r.next[i] < 0.7 ? Math.pow(1 - r.next[i] / 0.7, 1.4) : 0;
    light[i] = Math.max(ahead, player.playing ? 0.85 * r.down[i] : 0);
  }
  // The voice buttons: the chosen one is lit; a press dips it.
  const since = info.time - (keyboardState.pressAt ?? -10);
  EK.buttons.forEach((b, i) => {
    const j = EK.FIRST_BUTTON + i;
    dip[j] = keyboardState.pressed === i && since < 0.25 ? 1 - band(since, 0.1, 0.25) : 0;
    light[j] = keyboardState.voice === i ? 0.5 : 0;
  });
  // The drum pads flash with each hit of the beat.
  for (let i = 0; i < 4; i++) {
    const j = EK.FIRST_PAD + i;
    dip[j] = 0;
    light[j] = 0;
  }
  if (player.playing)
    for (const d of player.drums(player.pos - 0.3, player.pos + 1e-6)) {
      const j = EK.FIRST_PAD + padOf(d.n);
      const s = player.pos - d.t;
      const f = Math.exp(-s * 9);
      dip[j] = Math.max(dip[j], s < 0.12 ? 1 : f);
      light[j] = Math.max(light[j], f);
    }
  hit.fill(0);
  out.levers = ekLevers;
}

// ---- The recipes --------------------------------------------------------------------

// A keyboard toy's tap: a key plays that key; anywhere else plays the
// opening of its song (the song bar plays it all).
function keyboardRecipe({ rt, keyAtPoint, drive, build, density = 1.7, opening = 6.5 }) {
  return {
    alive: true,
    density,
    song: rt.song,
    controls: [
      { key: "song", label: "Play the opening", type: "pulse", ease: opening },
      { key: "strike", label: "Play a key", type: "pulse", ease: 1.2 },
    ],
    action: {
      key: "song",
      label: "Play the opening",
      // The opening's notes come from the recipe (its song), not the app.
      quiet: ["song"],
      at(point) {
        const i = keyAtPoint(point);
        return i === null ? null : { key: "strike", pick: i };
      },
    },
    drive,
    build,
  };
}

// Where key i's top is, in the recipe's own coordinates (for tools and tests).
const KEYBOARDS = {
  "grand-piano": () => ({ layout: G.layout, top: G.top }),
  "upright-piano": () => ({ layout: U.layout, top: U.top }),
  harpsichord: () => ({ layout: HC.layout, top: HC.top }),
  "electronic-keyboard": () => ({ layout: EK.layout, top: EK.top }),
};
export function keyPoint(id, i) {
  const { layout, top } = KEYBOARDS[id]();
  const key = layout.keys[i];
  return key.black ? [key.x, top + 0.011, -0.12] : [key.x, top, -0.04];
}

// Where the electronic keyboard's voice button i is (for tools and tests).
export function panelPoint(id, i) {
  return [EK.buttons[i].x, 0.091, EK.buttonZ];
}

export const RECIPES = {
  "grand-piano": keyboardRecipe({
    rt: grand,
    keyAtPoint: (p) => keyAt(G.layout, p, { top: G.top, blackTop: G.top + 0.011, blackFront: -0.055 }), // prettier-ignore
    drive: driveGrand,
    build: buildGrand,
  }),
  "upright-piano": keyboardRecipe({
    rt: upright,
    keyAtPoint: (p) => keyAt(U.layout, p, { top: U.top, blackTop: U.top + 0.011, blackFront: -0.052 }), // prettier-ignore
    drive: driveUpright,
    build: buildUpright,
  }),
  harpsichord: keyboardRecipe({
    rt: harpsichord,
    keyAtPoint: (p) => keyAt(HC.layout, p, { top: HC.top, blackTop: HC.top + 0.01, blackFront: -0.05 }), // prettier-ignore
    drive: driveHarpsichord,
    build: buildHarpsichord,
  }),
  "electronic-keyboard": {
    ...keyboardRecipe({
      rt: ekRt,
      keyAtPoint: (p) => keyAt(EK.layout, p, { top: EK.top, blackTop: EK.top + 0.01, blackFront: -0.048, back: -0.14 }), // prettier-ignore
      drive: driveKeyboard,
      build: buildKeyboard,
      density: 1.5,
    }),
    controls: [
      { key: "song", label: "Play the opening", type: "pulse", ease: 6.5 },
      { key: "strike", label: "Play a key", type: "pulse", ease: 1.2 },
      { key: "voice", label: "Voice", type: "pulse", ease: 0.5 },
    ],
    action: {
      key: "song",
      label: "Play the opening",
      // Keys, buttons and the song all sound from the recipe (in the voice
      // chosen on the panel).
      quiet: ["song", "strike", "voice"],
      at(point) {
        const b = EK.buttons.findIndex((x) => Math.abs(point[0] - x.x) < 0.022 && Math.abs(point[2] - EK.buttonZ) < 0.018); // prettier-ignore
        if (b >= 0 && point[1] > 0.075) return { key: "voice", pick: b };
        const i = keyAt(EK.layout, point, { top: EK.top, blackTop: EK.top + 0.01, blackFront: -0.048, back: -0.14 }); // prettier-ignore
        return i === null ? null : { key: "strike", pick: i };
      },
    },
    screen: {
      width: 320,
      height: 112,
      reset() {
        keyboardState.voice = 0;
      },
      version(time) {
        const st = keyboardState;
        return `${st.title}|${st.voice}|${st.playing ? Math.floor(time * 20) : "-"}`;
      },
      draw(g, time) {
        drawKeyboardScreen(g, time);
      },
    },
  },
};
