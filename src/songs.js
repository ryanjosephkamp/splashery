// Songs for the keyboard toys (lane Pianos): a Standard MIDI File reader and
// an ABC notation reader, written here (no library), that both give a song
// as a plain list of notes, and a song player a recipe drives each frame.
// It plays the notes through the site's sound (scheduled a moment ahead, so
// they keep time) and says which keys are down, which were just struck and
// which come next, for the keys, hammers and lights to follow.
//
// A song is
//   { title, composer, notes: [{ t, d, n, v, ch, drum }], pedal: [[t0, t1]], length }
// with times in seconds: t the note's start, d how long its key is held,
// n the MIDI note number (60 is middle C), v the velocity 0..1, ch the MIDI
// channel (0..15) and drum true for channel 10 (percussion). pedal lists
// the spans the sustain pedal (controller 64) is down. length is where the
// song ends (the last note's release).
//
//   import { readMidi, readAbc, fitNotes, SongPlayer } from "../songs.js";
//   const song = fitNotes(readMidi(bytes, "tune.mid"), 21, 108); // into 88 keys
//   const player = new SongPlayer({ low: 21, high: 108 });
//   player.load(song);
//   // in drive(t, c, out, info):
//   player.update(info.time, info.sound, (note, at, ring) => { … play a voice … });
//   const keys = player.keys(); // per key: down, since, ahead, v

export const MAX_NOTES = 20000;
export const MAX_SONG_BYTES = 2e6;

// ---- MIDI ---------------------------------------------------------------------------

// Reads a Standard MIDI File (format 0 or 1; a format 2 file is read as if
// its tracks played together): notes on and off with their velocity, tempo
// changes and the sustain pedal. Throws an Error with a message for people.
export function readMidi(data, fileName = "") {
  const b = data instanceof Uint8Array ? data : new Uint8Array(data);
  if (b.length > MAX_SONG_BYTES) throw new Error("That file is too big for a song (over 2 MB).");
  const text = (i, n) => String.fromCharCode(...b.subarray(i, i + n));
  // A RIFF wrapper (.rmi) holds the MIDI file in its "data" chunk.
  let at = 0;
  if (text(0, 4) === "RIFF") {
    let i = 12;
    while (i + 8 <= b.length && text(i, 4) !== "data")
      i += 8 + (b[i + 4] | (b[i + 5] << 8) | (b[i + 6] << 16) | (b[i + 7] << 24));
    at = i + 8;
  }
  if (text(at, 4) !== "MThd") throw new Error("That isn't a MIDI file (it has no MIDI header).");
  const u32 = (i) => ((b[i] << 24) | (b[i + 1] << 16) | (b[i + 2] << 8) | b[i + 3]) >>> 0;
  const u16 = (i) => (b[i] << 8) | b[i + 1];
  const hlen = u32(at + 4);
  const format = u16(at + 8);
  const ntrks = u16(at + 10);
  const division = u16(at + 12);
  if (format > 2) throw new Error(`MIDI format ${format} isn't one this reads.`);
  // Ticks per quarter note, or (SMPTE) ticks per second.
  const smpte = division & 0x8000;
  const tpq = smpte ? 0 : division || 480;
  const tps = smpte ? (256 - (division >> 8)) * (division & 0xff) : 0;

  const tempos = []; // [tick, microseconds per quarter]
  const raw = []; // note events: [tick, on (1/0), ch, n, vel, order]
  const ctrl = []; // sustain: [tick, ch, down]
  let title = "";
  let order = 0;
  let p = at + 8 + hlen;
  for (let tr = 0; tr < ntrks && p + 8 <= b.length; tr++) {
    if (text(p, 4) !== "MTrk") {
      // Skip an unknown chunk.
      p += 8 + u32(p + 4);
      tr--;
      if (p > b.length) break;
      continue;
    }
    const end = Math.min(b.length, p + 8 + u32(p + 4));
    let i = p + 8;
    p = end;
    let tick = 0;
    let status = 0;
    const vlq = () => {
      let v = 0;
      for (let k = 0; k < 4 && i < end; k++) {
        const x = b[i++];
        v = (v << 7) | (x & 0x7f);
        if (!(x & 0x80)) break;
      }
      return v;
    };
    while (i < end) {
      tick += vlq();
      if (i >= end) break;
      let s = b[i];
      if (s & 0x80) i++;
      else if (status)
        s = status; // running status
      else throw new Error("That MIDI file is damaged (an event with no status).");
      if (s === 0xff) {
        const type = b[i++];
        const len = vlq();
        if (type === 0x51 && len >= 3)
          tempos.push([tick, (b[i] << 16) | (b[i + 1] << 8) | b[i + 2]]);
        if (type === 0x03 && !title && (format === 0 || tr === 0)) title = decodeText(b.subarray(i, i + len)); // prettier-ignore
        i += len;
        if (type === 0x2f) break;
        continue;
      }
      if (s === 0xf0 || s === 0xf7) {
        i += vlq();
        continue;
      }
      if (s >= 0xf0) continue; // a system message with no data (should not be in a file)
      status = s;
      const hi = s & 0xf0;
      const ch = s & 0x0f;
      const d1 = b[i++];
      if (hi === 0xc0 || hi === 0xd0) continue;
      const d2 = b[i++];
      if (hi === 0x90 && d2 > 0) raw.push([tick, 1, ch, d1, d2, order++]);
      else if (hi === 0x80 || hi === 0x90) raw.push([tick, 0, ch, d1, 0, order++]);
      else if (hi === 0xb0 && d1 === 64) ctrl.push([tick, ch, d2 >= 64]);
      if (raw.length > MAX_NOTES * 2)
        throw new Error("That song has too many notes (over 20,000).");
    }
  }
  if (!raw.length) throw new Error("That MIDI file has no notes in it.");

  // Ticks to seconds through the tempo map.
  tempos.sort((x, y) => x[0] - y[0]);
  const map = [[0, 0, 500000]]; // [tick, seconds, µs per quarter]
  for (const [tk, us] of tempos) {
    const last = map[map.length - 1];
    const sec = last[1] + ((tk - last[0]) * last[2]) / 1e6 / tpq;
    if (tk === last[0]) last[2] = us;
    else map.push([tk, sec, us]);
  }
  const seconds = (tk) => {
    if (smpte) return tk / tps;
    let lo = 0;
    let hi = map.length - 1;
    while (lo < hi) {
      const mid = (lo + hi + 1) >> 1;
      if (map[mid][0] <= tk) lo = mid;
      else hi = mid - 1;
    }
    const m = map[lo];
    return m[1] + ((tk - m[0]) * m[2]) / 1e6 / tpq;
  };

  // Pair each note's on with its off (the first open one of that key).
  raw.sort((x, y) => x[0] - y[0] || x[1] - y[1] || x[5] - y[5]);
  const open = new Map();
  const notes = [];
  let lastTick = 0;
  for (const [tick, on, ch, n, vel] of raw) {
    lastTick = Math.max(lastTick, tick);
    const key = ch * 128 + n;
    if (on) {
      // A key struck again while it is still down releases it first.
      const list = open.get(key) || [];
      list.push({ tick, vel });
      open.set(key, list);
    } else {
      const list = open.get(key);
      const o = list?.shift();
      if (!o) continue;
      notes.push(makeNote(seconds(o.tick), seconds(tick), n, o.vel, ch));
    }
  }
  for (const [key, list] of open)
    for (const o of list) notes.push(makeNote(seconds(o.tick), seconds(Math.max(lastTick, o.tick + (tpq || 1))), key % 128, o.vel, key >> 7)); // prettier-ignore

  // The sustain pedal: down while any channel holds it.
  ctrl.sort((x, y) => x[0] - y[0]);
  const held = new Set();
  const pedal = [];
  let downAt = null;
  for (const [tick, ch, down] of ctrl) {
    if (down) held.add(ch);
    else held.delete(ch);
    if (held.size && downAt === null) downAt = seconds(tick);
    else if (!held.size && downAt !== null) {
      pedal.push([downAt, seconds(tick)]);
      downAt = null;
    }
  }
  if (downAt !== null) pedal.push([downAt, seconds(lastTick)]);
  const name = fileName
    .replace(/\.[^.]*$/, "")
    .replace(/[_-]+/g, " ")
    .trim();
  return makeSong({ title: title.trim() || name || "Your song", notes, pedal });
}

function makeNote(t0, t1, n, vel, ch) {
  return { t: t0, d: Math.max(0.02, t1 - t0), n, v: vel / 127, ch, drum: ch === 9 };
}

// Track names are Latin-1 by the standard, often UTF-8 in practice.
function decodeText(bytes) {
  try {
    return new TextDecoder("utf-8", { fatal: true }).decode(bytes);
  } catch {
    return String.fromCharCode(...bytes);
  }
}

// Sorts the notes, caps their number and measures the song.
export function makeSong({ title = "", composer = "", notes, pedal = [], ...rest }) {
  const list = notes
    .filter((x) => Number.isFinite(x.t) && Number.isFinite(x.d) && x.n >= 0 && x.n <= 127)
    .sort((a, b) => a.t - b.t || a.n - b.n);
  if (list.length > MAX_NOTES) throw new Error("That song has too many notes (over 20,000).");
  if (!list.length) throw new Error("That song has no notes in it.");
  // Start at the first note, not after a long silence.
  const t0 = Math.max(0, list[0].t - 0.2);
  for (const x of list) x.t -= t0;
  const spans = pedal
    .map(([a, b]) => [Math.max(0, a - t0), Math.max(0, b - t0)])
    .filter(([a, b]) => b > a);
  let length = 0;
  for (const x of list) length = Math.max(length, x.t + x.d);
  return { ...rest, title, composer, notes: list, pedal: spans, length: length + 0.3 };
}

// Moves every note outside low..high (MIDI numbers) in by octaves, so a
// song for a bigger keyboard plays on a smaller one. Drum notes stay.
export function fitNotes(song, low, high) {
  const notes = song.notes.map((x) => {
    if (x.drum) return { ...x };
    let n = x.n;
    while (n < low) n += 12;
    while (n > high) n -= 12;
    if (n < low) n = low; // a range narrower than an octave
    return { ...x, n };
  });
  return { ...song, notes };
}

// When each note stops sounding: at its key's release, or later if the
// sustain pedal is down then (until the pedal lifts).
export function ringEnd(song, note) {
  const off = note.t + note.d;
  for (const [a, b] of song.pedal) if (off >= a && off < b) return b;
  return off;
}

// Is the sustain pedal down at time t?
export function pedalAt(song, t) {
  for (const [a, b] of song.pedal) if (t >= a && t < b) return true;
  return false;
}

// ---- ABC notation -------------------------------------------------------------------

const ABC_KEYS = { C: 0, G: 1, D: 2, A: 3, E: 4, B: 5, "F#": 6, "C#": 7, F: -1, Bb: -2, Eb: -3, Ab: -4, Db: -5, Gb: -6, Cb: -7 }; // prettier-ignore
const MODES = { maj: 0, ion: 0, min: -3, m: -3, aeo: -3, mix: -1, dor: -2, phr: -4, lyd: 1, loc: -5 }; // prettier-ignore
const SHARP_ORDER = "FCGDAEB";
const LETTER = { C: 0, D: 2, E: 4, F: 5, G: 7, A: 9, B: 11 };

// Reads a tune in ABC notation (the plain-text folk tune format): the
// header (T: title, C: composer, M: meter, L: unit note length, Q: tempo,
// K: key) and the tune's notes, chords, rests, ties, broken rhythms,
// triplets, repeats and first and second endings. Only the first tune in
// the text is read, and only its first voice. Decorations, grace notes,
// slurs and chord names are skipped.
export function readAbc(input) {
  const src = String(input || "").replace(/\r\n?/g, "\n");
  if (!src.trim()) throw new Error("Paste a tune in ABC first.");
  const head = { T: "", C: "", M: "4/4", L: "", Q: "", K: "" };
  const body = [];
  let started = false;
  let inTune = false;
  for (const line0 of src.split("\n")) {
    const line = line0.replace(/%.*$/, "");
    const field = /^\s*([A-Za-z]):(.*)$/.exec(line);
    if (field && !/^[|\]]/.test(line.trim())) {
      const [, f, v] = field;
      if (f === "X") {
        if (inTune && started) break; // the next tune
        inTune = true;
        continue;
      }
      if (f === "V" && started) break; // a second voice
      if (!started) {
        if (f === "T" && head.T) continue;
        if (f in head) head[f] = v.trim();
        if (f === "K") started = true;
      } else if (f === "K" || f === "M" || f === "L" || f === "Q") body.push({ field: f, value: v.trim() }); // prettier-ignore
      continue;
    }
    if (!started && line.trim()) {
      // A tune with no K: line (pasted without its header) starts here.
      if (!/[A-Ga-gz]/.test(line)) continue;
      started = true;
    }
    if (started && line.trim()) body.push(line);
  }
  if (!body.length) throw new Error("There are no notes after the K: line.");

  const frac = (s, def) => {
    const m = /^\s*(\d+)\s*\/\s*(\d+)/.exec(s || "");
    return m ? Number(m[1]) / Number(m[2]) : def;
  };
  const meter = /^C\|/.test(head.M) ? 1 : head.M === "C" ? 1 : frac(head.M, 1);
  let unit = frac(head.L, meter < 0.75 ? 1 / 16 : 1 / 8);
  // Q: "1/4=120", "120" (unit notes per minute) or "C=120".
  const tempoOf = (q) => {
    const m = /(?:(\d+)\/(\d+)\s*=\s*)?(\d+)/.exec(q.replace(/"[^"]*"/g, ""));
    if (!m) return null;
    const beat = m[1] ? Number(m[1]) / Number(m[2]) : unit;
    return { beat, bpm: Number(m[3]) };
  };
  let tempo = tempoOf(head.Q) || { beat: 1 / 4, bpm: meter >= 1 && unit <= 1 / 8 ? 120 : 110 };
  const secsPer = () => 60 / tempo.bpm / tempo.beat; // seconds per whole note
  let keyAcc = keySignature(head.K);

  // Tokens first, with repeats expanded.
  const text = body.map((x) => (typeof x === "string" ? x : `[${x.field}:${x.value}]`)).join("\n");
  const events = abcTokens(text);
  const played = expandRepeats(events);

  const notes = [];
  let time = 0;
  let barAcc = {};
  let tuplet = null; // { left, factor }
  let broken = 1; // length factor for the next note after > or <
  const ties = new Map(); // midi -> note waiting for its tie
  let prevNotes = [];
  for (const ev of played) {
    if (ev.type === "bar") {
      barAcc = {};
      continue;
    }
    if (ev.type === "field") {
      if (ev.field === "K") keyAcc = keySignature(ev.value);
      if (ev.field === "L") unit = frac(ev.value, unit);
      if (ev.field === "Q") tempo = tempoOf(ev.value) || tempo;
      continue;
    }
    if (ev.type === "tuplet") {
      const p = ev.p;
      const q = ev.q || (p === 3 || p === 6 ? 2 : p === 2 || p === 4 || p === 8 ? 3 : meter % 0.75 === 0 && meter > 0.5 ? 3 : 2); // prettier-ignore
      tuplet = { left: ev.r || p, factor: q / p };
      continue;
    }
    if (ev.type === "broken") {
      // The note before gets longer or shorter; the next one the other way.
      const f = ev.dots === 1 ? 0.5 : ev.dots === 2 ? 0.25 : 0.125;
      const longer = ev.dir === ">";
      const prevLen = prevNotes.len || 0;
      const change = prevLen * f * (longer ? 1 : -1);
      for (const x of prevNotes) x.d += change * secsPer();
      time += change * secsPer();
      broken = longer ? 1 - f : 1 + f;
      continue;
    }
    if (ev.type !== "note") continue;
    let len = ev.len * unit * broken;
    broken = 1;
    if (tuplet) {
      len *= tuplet.factor;
      if (--tuplet.left <= 0) tuplet = null;
    }
    const dur = len * secsPer();
    const made = [];
    made.len = len;
    for (const p of ev.pitches) {
      const letter = p.letter.toUpperCase();
      let octave = p.letter === letter ? 4 : 5;
      octave += p.octave;
      const key = letter + octave;
      let acc;
      if (p.acc !== null) {
        barAcc[key] = p.acc;
        acc = p.acc;
      } else acc = barAcc[key] ?? keyAcc[letter] ?? 0;
      const n = 12 * (octave + 1) + LETTER[letter] + acc;
      const tied = ties.get(n);
      if (tied && Math.abs(tied.t + tied.d - time) < 1e-6) {
        tied.d += dur;
        ties.delete(n);
        if (p.tie) ties.set(n, tied);
        made.push(tied);
        continue;
      }
      const note = { t: time, d: dur, n, v: 0.72, ch: 0, drum: false };
      notes.push(note);
      made.push(note);
      if (p.tie || ev.tie) ties.set(n, note);
    }
    prevNotes = made;
    time += dur;
    if (notes.length > MAX_NOTES) throw new Error("That tune has too many notes (over 20,000).");
  }
  if (!notes.length) throw new Error("That tune has no notes that can be played.");
  // A little space between repeated notes, as a player lifts the key.
  for (const x of notes) x.d = Math.max(0.03, x.d * 0.94);
  return makeSong({ title: head.T || "Your tune", composer: head.C, notes, pedal: [] });
}

// A key signature from a K: field ("G", "Dm", "A mix", "Bb", "none", with
// explicit accidentals like "D ^c"): letter -> -1, 0 or 1.
function keySignature(k) {
  const acc = {};
  const m = /^\s*([A-G][#b]?)\s*([A-Za-z]*)/.exec(k || "");
  if (m) {
    const tonic = m[1];
    const mode = (m[2] || "").slice(0, 3).toLowerCase();
    let sharps = ABC_KEYS[tonic] ?? 0;
    sharps += MODES[mode] ?? (mode.startsWith("m") ? -3 : 0);
    if (!(tonic in ABC_KEYS) && tonic.length === 2) sharps += tonic[1] === "#" ? 7 : -7;
    if (sharps > 0) for (const L of SHARP_ORDER.slice(0, Math.min(7, sharps))) acc[L] = 1;
    if (sharps < 0) for (const L of [...SHARP_ORDER].reverse().slice(0, Math.min(7, -sharps))) acc[L] = -1; // prettier-ignore
  }
  // Explicit accidentals after the key: "^f _b =c".
  for (const x of (k || "").matchAll(/(\^{1,2}|_{1,2}|=)([A-Ga-g])/g))
    acc[x[2].toUpperCase()] = x[1] === "=" ? 0 : x[1][0] === "^" ? x[1].length : -x[1].length;
  return acc;
}

// Splits a tune's body into notes, chords, rests, bars, repeats and fields.
function abcTokens(s) {
  const out = [];
  let i = 0;
  const num = () => {
    const m = /^\d+/.exec(s.slice(i));
    if (!m) return null;
    i += m[0].length;
    return Number(m[0]);
  };
  // A note length: "2", "/2", "/", "//", "3/2".
  const length = () => {
    let a = num() ?? 1;
    let b = 1;
    while (s[i] === "/") {
      i++;
      const d = num();
      b *= d ?? 2;
    }
    return a / b;
  };
  const pitch = () => {
    let acc = null;
    const m = /^(\^\^|\^|__|_|=)/.exec(s.slice(i));
    if (m) {
      i += m[0].length;
      acc = m[0] === "=" ? 0 : m[0][0] === "^" ? m[0].length : -m[0].length;
    }
    const letter = s[i];
    if (!/[A-Ga-g]/.test(letter || "")) return null;
    i++;
    let octave = 0;
    while (s[i] === "'" || s[i] === ",") octave += s[i++] === "'" ? 1 : -1;
    return { letter, acc, octave };
  };
  while (i < s.length) {
    const c = s[i];
    if (/\s/.test(c) || c === "\\") {
      i++;
      continue;
    }
    if (c === '"') {
      // A chord name or an annotation.
      const j = s.indexOf('"', i + 1);
      i = j < 0 ? s.length : j + 1;
      continue;
    }
    if (c === "!" || c === "+") {
      // A decoration: !trill! or +trill+.
      const j = s.indexOf(c, i + 1);
      const nl = s.indexOf("\n", i + 1);
      i = j < 0 || (nl >= 0 && nl < j) ? i + 1 : j + 1;
      continue;
    }
    if (c === "{") {
      // Grace notes: skipped.
      const j = s.indexOf("}", i);
      i = j < 0 ? s.length : j + 1;
      continue;
    }
    if (c === "[" && /^\[[A-Za-z]:/.test(s.slice(i, i + 3))) {
      const j = s.indexOf("]", i);
      const body = s.slice(i + 1, j < 0 ? s.length : j);
      out.push({ type: "field", field: body[0], value: body.slice(2).trim() });
      i = j < 0 ? s.length : j + 1;
      continue;
    }
    if (c === "[" && /^\[\d/.test(s.slice(i, i + 2))) {
      i++;
      out.push({ type: "ending", n: num() });
      while (s[i] === "," || s[i] === "-") {
        i++;
        num();
      }
      continue;
    }
    if (c === "|" || c === ":" || (c === "[" && s[i + 1] === "|") || (c === "]" && out.length)) {
      // Bars and repeats: | || |] [| |: :| :: and endings |1 :|2.
      const m = /^(:*)(\[?\|+\]?|\]|::)(:*)/.exec(s.slice(i));
      if (!m) {
        i++;
        continue;
      }
      i += m[0].length;
      const tok = m[0];
      if (tok === "::" || (m[1] && m[3])) out.push({ type: "bar", close: true, open: true });
      else out.push({ type: "bar", close: !!m[1], open: !!m[3] });
      const n = /^\s?(\d)/.exec(s.slice(i));
      if (n && !/^\s?\d\s*\//.test(s.slice(i))) {
        i += n[0].length;
        out.push({ type: "ending", n: Number(n[1]) });
      }
      continue;
    }
    if (c === "(" && /\d/.test(s[i + 1] || "")) {
      i++;
      const p = num();
      let q = null;
      let r = null;
      if (s[i] === ":") {
        i++;
        q = num();
        if (s[i] === ":") {
          i++;
          r = num();
        }
      }
      out.push({ type: "tuplet", p, q, r });
      continue;
    }
    if (c === ">" || c === "<") {
      let dots = 0;
      while (s[i] === c) {
        dots++;
        i++;
      }
      out.push({ type: "broken", dir: c, dots });
      continue;
    }
    if (c === "[") {
      // A chord: [CEG]2
      i++;
      const pitches = [];
      let inner = 1;
      while (i < s.length && s[i] !== "]") {
        const p = pitch();
        if (!p) {
          i++;
          continue;
        }
        const l = /^[\d/]/.test(s[i]) ? length() : 1;
        inner = pitches.length ? inner : l;
        p.tie = s[i] === "-";
        if (p.tie) i++;
        pitches.push(p);
      }
      i++;
      const len = length() * inner;
      const tie = s[i] === "-";
      if (tie) i++;
      if (pitches.length) out.push({ type: "note", pitches, len, tie });
      continue;
    }
    if (c === "z" || c === "x" || c === "Z") {
      i++;
      const len = length();
      out.push({ type: "note", pitches: [], len: c === "Z" ? len * 8 : len });
      continue;
    }
    const at = i;
    const p = pitch();
    if (p) {
      const len = length();
      const tie = s[i] === "-";
      if (tie) i++;
      p.tie = tie;
      out.push({ type: "note", pitches: [p], len, tie });
      continue;
    }
    i = at + 1; // anything else (slurs, decorations like ~ . H T u v)
  }
  return out;
}

// Plays repeats and first and second endings out in full.
function expandRepeats(events) {
  const out = [];
  let start = 0; // where the current repeat starts
  let i = 0;
  let pass = 1;
  let ending = 0; // the ending we are in (0: none)
  let guard = 0;
  while (i < events.length && guard++ < 200000) {
    const ev = events[i];
    if (ev.type === "ending") {
      ending = ev.n;
      if (ending !== pass) {
        // Skip to the next ending or the end of the repeat.
        let j = i + 1;
        while (j < events.length && !(events[j].type === "ending" && events[j].n === pass) && !(events[j].type === "bar" && events[j].open)) j++; // prettier-ignore
        i = j;
        continue;
      }
      i++;
      continue;
    }
    if (ev.type === "bar") {
      out.push(ev);
      if (ev.close && pass === 1) {
        pass = 2;
        i = start;
        continue;
      }
      if (ev.close) {
        pass = 1;
        ending = 0;
      }
      if (ev.open) {
        start = i + 1;
        pass = 1;
        ending = 0;
      }
      i++;
      continue;
    }
    out.push(ev);
    i++;
  }
  return out;
}

// ---- The song player ----------------------------------------------------------------

// Plays a song for a keyboard toy: keeps its place, speed and loop, plays
// its notes through the site's sound a little ahead of time, and tells the
// toy which keys are down, how long since each was struck and how soon each
// is struck next. Keys are numbered from `low` (a MIDI note number).
export class SongPlayer {
  constructor({ low = 21, high = 108, ahead = 0.8 } = {}) {
    this.low = low;
    this.high = high;
    this.count = high - low + 1;
    this.ahead = ahead; // how far ahead keys() reports the next strike
    this.song = null;
    this.pos = 0;
    this.playing = false;
    this.speed = 1;
    this.loop = false;
    this.stopAt = null; // stop here (the opening a tap plays)
    this.last = null; // the last frame's time
    this.sched = 0; // notes before this song time are scheduled
    this.anchor = null; // audio time of song time 0 (at the current speed)
    this.onEnd = null;
    this.down = new Float32Array(this.count);
    this.since = new Float32Array(this.count);
    this.next = new Float32Array(this.count);
    this.vel = new Float32Array(this.count);
  }

  load(song) {
    this.song = song;
    this.pos = 0;
    this.playing = false;
    this.stopAt = null;
    this.resync();
  }

  play({ until = null } = {}) {
    if (!this.song) return;
    if (this.pos >= this.song.length - 0.05) this.pos = 0;
    this.stopAt = until;
    this.playing = true;
    this.last = null; // the first frame after a pause moves nothing
    this.resync();
  }

  pause() {
    this.playing = false;
    this.stopAt = null;
    this.resync();
  }

  toStart() {
    this.seek(0);
  }

  seek(pos) {
    this.pos = Math.max(0, Math.min(this.song?.length ?? 0, pos));
    this.resync();
  }

  setSpeed(s) {
    this.speed = Math.max(0.25, Math.min(2, Number(s) || 1));
    this.resync();
  }

  setLoop(on) {
    this.loop = !!on;
  }

  // Forget what was scheduled: the next update schedules from here.
  resync() {
    this.sched = this.pos;
    this.anchor = null;
  }

  // Moves the song on to `time` (seconds, drive's info.time) and schedules
  // its notes on the site's sound: play(note, when, ring) is called once
  // per note, `when` in the audio context's time and `ring` how long it
  // sounds (to its key's release, or the pedal's). Without sound the song
  // still moves (the keys play silently).
  update(time, sound = null, play = null) {
    const dt = this.last === null ? 0 : Math.max(0, Math.min(0.25, time - this.last));
    this.last = time;
    const song = this.song;
    if (!song || !this.playing) return this.pos;
    this.pos += dt * this.speed;
    const end = this.stopAt ?? song.length;
    if (this.pos >= end) {
      if (this.loop && this.stopAt === null) {
        this.pos = this.pos - song.length;
        this.resync();
      } else {
        this.pos = Math.min(this.pos, song.length);
        this.playing = false;
        this.stopAt = null;
        this.onEnd?.();
        return this.pos;
      }
    }
    const ctx = sound?.enabled && play ? sound.audio?.() : null;
    if (!ctx) {
      this.sched = this.pos;
      this.anchor = null;
      return this.pos;
    }
    // Audio time for a song time; re-anchored if the clocks drift apart.
    const now = ctx.currentTime;
    const want = now - this.pos / this.speed;
    if (this.anchor === null || Math.abs(this.anchor - want) > 0.06) this.anchor = want;
    const horizon = Math.min(end, this.pos + 0.25 * this.speed);
    const notes = song.notes;
    let i = firstAtOrAfter(notes, this.sched);
    for (; i < notes.length && notes[i].t < horizon; i++) {
      const x = notes[i];
      const when = Math.max(now, this.anchor + x.t / this.speed);
      const ring = (ringEnd(song, x) - x.t) / this.speed;
      play(x, when, ring);
    }
    this.sched = Math.max(this.sched, horizon);
    return this.pos;
  }

  // The keys at song time `pos` (the player's place by default): per key
  // (index from `low`), down 0..1 (1 while held), since (seconds since it
  // was last struck, 1e3 if not yet), next (seconds until it is struck
  // next, 1e3 if not soon) and vel (the last strike's velocity). The arrays
  // are reused from call to call.
  keys(pos = this.pos) {
    const { down, since, next, vel } = this;
    down.fill(0);
    since.fill(1e3);
    next.fill(1e3);
    vel.fill(0);
    const song = this.song;
    if (!song) return this;
    const notes = song.notes;
    const back = song.maxHold ?? (song.maxHold = notes.reduce((m, x) => Math.max(m, x.d), 0));
    let i = firstAtOrAfter(notes, pos - Math.min(back, 30) - 0.01);
    for (; i < notes.length; i++) {
      const x = notes[i];
      if (x.t > pos + this.ahead) break;
      if (x.drum) continue;
      const k = x.n - this.low;
      if (k < 0 || k >= this.count) continue;
      if (x.t <= pos) {
        const s = pos - x.t;
        if (s < since[k]) {
          since[k] = s;
          vel[k] = x.v;
        }
        if (pos < x.t + x.d) down[k] = 1;
      } else next[k] = Math.min(next[k], x.t - pos);
    }
    return this;
  }

  // Drum hits between song times a and b (for drum pads): [{ t, n, v }].
  drums(a, b) {
    const out = [];
    const notes = this.song?.notes || [];
    for (let i = firstAtOrAfter(notes, a); i < notes.length && notes[i].t < b; i++)
      if (notes[i].drum) out.push(notes[i]);
    return out;
  }

  // Is the sustain pedal down now?
  pedal(pos = this.pos) {
    return this.song ? pedalAt(this.song, pos) : false;
  }
}

function firstAtOrAfter(notes, t) {
  let lo = 0;
  let hi = notes.length;
  while (lo < hi) {
    const mid = (lo + hi) >> 1;
    if (notes[mid].t < t) lo = mid + 1;
    else hi = mid;
  }
  return lo;
}

// ---- Writing songs out --------------------------------------------------------------

// Builds a song from compact text, for the built-in songs written out in
// the packs: "E5/8 D#5/8 | E5+A3/4 …". Each entry is a note (or a chord
// joined by +) and its length after a slash: /8 an eighth, /4 a quarter,
// /16:3 three sixteenths (a dotted eighth); "r/4" is a rest. "v0.6" sets the loudness
// from there on, "P" puts the sustain pedal down and "p" lifts it, "|" is
// just a bar line for the reader. Several voices (a melody and its bass) go
// in parallel, separated by "&&", each starting at time 0.
export function songFromText({ title, composer = "", text, bpm = 100, beat = 1 / 4, ...rest }) {
  const voices = text.split("&&");
  const notes = [];
  const pedal = [];
  const whole = 60 / bpm / beat;
  for (const voice of voices) {
    let t = 0;
    let v = 0.7;
    let down = null;
    for (const tok of voice.trim().split(/\s+/)) {
      if (!tok || tok === "|") continue;
      if (/^v[\d.]+$/.test(tok)) {
        v = Number(tok.slice(1));
        continue;
      }
      if (tok === "P") {
        if (down !== null) pedal.push([down, t - 0.02]);
        down = t + 0.02;
        continue;
      }
      if (tok === "p") {
        if (down !== null) pedal.push([down, t - 0.02]);
        down = null;
        continue;
      }
      const parts = /^(.+?)\/(\d+)(?::(\d+))?$/.exec(tok);
      if (!parts) throw new Error(`Can't read "${tok}" in ${title}.`);
      const [, what, den, num] = parts;
      const len = (Number(num) || 1) / Number(den);
      const dur = len * whole;
      if (what !== "r") {
        for (const name of what.split("+")) {
          const n = midiOf(name);
          notes.push({ t, d: dur * 0.92, n, v, ch: 0, drum: false });
        }
      }
      t += dur;
    }
    if (down !== null) pedal.push([down, t]);
  }
  return makeSong({ title, composer, notes, pedal, ...rest });
}

// "C4" -> 60, "F#5" -> 78, "Bb2" -> 46.
export function midiOf(name) {
  const m = /^([A-G])([#b]?)(-?\d)$/.exec(name);
  if (!m) throw new Error(`Unknown note: ${name}`);
  return 12 * (Number(m[3]) + 1) + LETTER[m[1]] + (m[2] === "#" ? 1 : m[2] === "b" ? -1 : 0);
}

// 60 -> "C4" (sharps).
export function noteName(n) {
  const names = ["C", "C#", "D", "D#", "E", "F", "F#", "G", "G#", "A", "A#", "B"];
  return names[((n % 12) + 12) % 12] + (Math.floor(n / 12) - 1);
}

// A song's length as "1:05".
export function clock(sec) {
  const s = Math.max(0, Math.floor(sec + 1e-6));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
}

// ---- Writing a MIDI file ------------------------------------------------------------

// Writes a song as a Standard MIDI File (format 0, one track, 480 ticks per
// quarter at 120 per minute, so a tick is a millisecond and a bit): for the
// sample files made from our own songs, and the tests.
export function writeMidi(song, { tempo = 500000 } = {}) {
  const tpq = 480;
  const tick = (sec) => Math.round((sec * 1e6 * tpq) / tempo);
  const ev = [];
  for (const x of song.notes) {
    const ch = x.drum ? 9 : x.ch || 0;
    const vel = Math.max(1, Math.min(127, Math.round((x.v ?? 0.7) * 127)));
    ev.push([tick(x.t), 1, [0x90 | ch, x.n, vel]]);
    ev.push([tick(x.t + x.d), 0, [0x80 | ch, x.n, 0]]);
  }
  for (const [a, b] of song.pedal || []) {
    ev.push([tick(a), 2, [0xb0, 64, 127]]);
    ev.push([tick(b), -1, [0xb0, 64, 0]]);
  }
  ev.sort((a, b) => a[0] - b[0] || a[1] - b[1]);
  const bytes = [];
  const vlq = (v) => {
    const out = [v & 0x7f];
    while ((v >>= 7)) out.unshift((v & 0x7f) | 0x80);
    bytes.push(...out);
  };
  const name = new TextEncoder().encode(song.title || "");
  vlq(0);
  bytes.push(0xff, 0x03);
  vlq(name.length);
  bytes.push(...name);
  vlq(0);
  bytes.push(0xff, 0x51, 0x03, (tempo >> 16) & 0xff, (tempo >> 8) & 0xff, tempo & 0xff);
  let last = 0;
  for (const [t, , data] of ev) {
    vlq(t - last);
    last = t;
    bytes.push(...data);
  }
  vlq(0);
  bytes.push(0xff, 0x2f, 0x00);
  const head = [0x4d, 0x54, 0x68, 0x64, 0, 0, 0, 6, 0, 0, 0, 1, tpq >> 8, tpq & 0xff];
  const len = bytes.length;
  const trk = [0x4d, 0x54, 0x72, 0x6b, (len >>> 24) & 0xff, (len >> 16) & 0xff, (len >> 8) & 0xff, len & 0xff]; // prettier-ignore
  return new Uint8Array([...head, ...trk, ...bytes]);
}

// ---- A recipe's song -------------------------------------------------------------

// What a keyboard toy gives the song bar and the Toy tab's song panel as
// its recipe's `song` (src/ui.js): its built-in songs, a song of your own
// (a MIDI file or an ABC tune), and play, pause, back to the start, speed,
// loop and seek on the toy's SongPlayer.
//   songs: [{ id, title, composer, make: () => song }] (made on first use)
export function songControls(player, { songs = [] } = {}) {
  const made = new Map();
  let id = songs[0]?.id ?? null;
  let own = null;
  const get = (x) => {
    if (x === "own") return own;
    if (!made.has(x)) {
      const s = songs.find((y) => y.id === x);
      if (!s) return null;
      made.set(x, fitNotes(s.make(), player.low, player.high));
    }
    return made.get(x);
  };
  const ensure = () => {
    if (!player.song && id) player.load(get(id));
  };
  const api = {
    list: () => [
      ...songs.map((s) => ({ id: s.id, title: s.title })),
      ...(own ? [{ id: "own", title: own.title }] : []),
    ],
    current: () => id,
    choose(x) {
      const s = get(x);
      if (!s) return;
      id = x;
      const wasPlaying = player.playing;
      player.load(s);
      if (wasPlaying) player.play();
    },
    song: () => (ensure(), player.song),
    title: () => (ensure(), player.song?.title ?? ""),
    setTitle(t) {
      ensure();
      if (!player.song) return;
      player.song.title = t || songs.find((s) => s.id === id)?.title || "Your song";
    },
    info: () => (ensure(), player.song?.composer || ""),
    isDefault: () => id === songs[0]?.id,
    state() {
      ensure();
      return {
        pos: player.pos,
        length: player.song?.length ?? 0,
        playing: player.playing,
        speed: player.speed,
        loop: player.loop,
        notes: player.song?.notes.length ?? 0,
      };
    },
    play: (o) => (ensure(), player.play(o)),
    pause: () => player.pause(),
    toStart: () => player.toStart(),
    seek: (pos) => player.seek(pos),
    setSpeed: (s) => player.setSpeed(s),
    setLoop: (on) => player.setLoop(on),
    // A MIDI file's bytes, or ABC text. Returns what was read, for a toast.
    async load(data, fileName = "") {
      const raw = typeof data === "string" ? readAbc(data) : readMidi(data, fileName);
      const song = fitNotes(raw, player.low, player.high);
      let moved = 0;
      raw.notes.forEach((x, i) => (moved += x.n !== song.notes[i].n ? 1 : 0));
      own = song;
      id = "own";
      player.load(song);
      return { title: song.title, notes: song.notes.length, length: song.length, moved };
    },
  };
  return api;
}
