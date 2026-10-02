// The Song landscape's recording and transport (lane Live input r3).
//
// - MicRecorder keeps what the microphone hears, in memory on this device,
//   while the microphone is on (the owner's review of October 2, 2026: say
//   something, then play it back). It copies the analyser's samples
//   (src/live/mic.js, the worklet's blocks in its ring) as they arrive; it
//   asks for nothing itself, and nothing is sent or stored. The recording
//   goes when the page closes, or is saved as a WAV file only when the
//   person taps "Save the recording".
// - songTransport() is the small control under the song in the Toy tab:
//   start over, play or pause, Live or Whole, and a slider to scrub. It sits
//   in the panel, never over the picture: on the picture itself a drag
//   already turns and tilts the view, and a tap plays or pauses.

export const MAX_SECONDS = 600; // ten minutes (about 115 MB of samples)

export class MicRecorder {
  constructor(mic) {
    this.mic = mic;
    this.rate = mic.rate;
    this.read = mic.written;
    this.chunks = [];
    this.n = 0;
    this.full = false;
    this.off = mic.on("frame", () => this.pull());
  }

  // The samples written since the last read (the ring holds about 2.7 s,
  // and frames come about 60 times a second, once a second in a hidden tab).
  pull() {
    const mic = this.mic;
    let n = mic.written - this.read;
    if (n <= 0 || this.full) return;
    n = Math.min(n, mic.ring.length);
    const avail = n;
    const max = MAX_SECONDS * this.rate;
    if (this.n + n > max) {
      n = max - this.n;
      this.full = true;
    }
    const block = mic.recent(avail).subarray(0, n);
    this.chunks.push(block);
    this.n += n;
    this.read = mic.written;
  }

  get seconds() {
    return this.n / this.rate;
  }

  // Stops listening; the recording, one array.
  finish() {
    this.pull();
    this.off?.();
    this.off = null;
    const samples = new Float32Array(this.n);
    let at = 0;
    for (const c of this.chunks) {
      samples.set(c, at);
      at += c.length;
    }
    this.chunks = [];
    return { samples, rate: this.rate, duration: this.n / this.rate };
  }
}

// A mono 16-bit WAV file of the samples.
export function wavBlob(samples, rate) {
  const b = new ArrayBuffer(44 + samples.length * 2);
  const v = new DataView(b);
  const str = (at, s) => [...s].forEach((ch, i) => v.setUint8(at + i, ch.charCodeAt(0)));
  str(0, "RIFF");
  v.setUint32(4, 36 + samples.length * 2, true);
  str(8, "WAVEfmt ");
  v.setUint32(16, 16, true);
  v.setUint16(20, 1, true);
  v.setUint16(22, 1, true);
  v.setUint32(24, rate, true);
  v.setUint32(28, rate * 2, true);
  v.setUint16(32, 2, true);
  v.setUint16(34, 16, true);
  str(36, "data");
  v.setUint32(40, samples.length * 2, true);
  for (let i = 0; i < samples.length; i++) {
    const x = Math.max(-1, Math.min(1, samples[i]));
    v.setInt16(44 + i * 2, Math.round(x * 32767), true);
  }
  return new Blob([b], { type: "audio/wav" });
}

export function saveBlob(blob, name) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = name;
  a.rel = "noopener";
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 4000);
}

export const clock = (sec) => {
  const x = Math.max(0, Math.floor(sec + 1e-6));
  return `${Math.floor(x / 60)}:${String(x % 60).padStart(2, "0")}`;
};

// The transport. `t` gives: state() → { pos, length, playing, live, mic,
// recorded, recording }, and toStart(), toggle(), seek(sec), setLive(on),
// playRecording(), saveRecording().
export function songTransport(t) {
  const box = document.createElement("div");
  box.className = "song-transport";
  box.id = "landscape-transport";
  const row = document.createElement("div");
  row.className = "button-row";
  const button = (id, label, fn) => {
    const b = document.createElement("button");
    b.type = "button";
    b.id = id;
    b.textContent = label;
    b.addEventListener("click", () => {
      fn();
      sync();
    });
    row.append(b);
    return b;
  };
  const start = button("landscape-start", "Start over", () => t.toStart());
  const play = button("landscape-play", "Play", () => t.toggle());
  const view = button("landscape-view", "Whole song", () => t.setLive(!t.state().live));
  const seekRow = document.createElement("label");
  seekRow.className = "row song-seek-row";
  const seek = document.createElement("input");
  seek.type = "range";
  seek.id = "landscape-seek";
  seek.min = "0";
  seek.max = "1000";
  seek.step = "1";
  seek.setAttribute("aria-label", "Where in the song (drag to move there)");
  const at = document.createElement("output");
  at.className = "song-clock";
  seekRow.append(seek, at);
  let seeking = false;
  seek.addEventListener("input", () => {
    seeking = true;
    const s = t.state();
    t.seek((Number(seek.value) / 1000) * s.length);
    sync();
  });
  seek.addEventListener("change", () => {
    seeking = false;
  });
  const rec = document.createElement("div");
  rec.className = "button-row";
  const again = document.createElement("button");
  again.type = "button";
  again.id = "landscape-recording-play";
  again.textContent = "Play back the recording";
  again.addEventListener("click", () => t.playRecording());
  const save = document.createElement("button");
  save.type = "button";
  save.id = "landscape-recording-save";
  save.textContent = "Save the recording";
  save.addEventListener("click", () => t.saveRecording());
  rec.append(again, save);
  const recNote = document.createElement("p");
  recNote.className = "note";
  box.append(row, seekRow, rec, recNote);

  function sync() {
    const s = t.state();
    row.hidden = seekRow.hidden = s.mic;
    play.textContent = s.playing ? "Pause" : "Play";
    play.setAttribute("aria-pressed", String(s.playing));
    view.textContent = s.live ? "Whole song" : "Live view";
    view.title = s.live ? "Show the whole song at once" : "Scroll with the music";
    start.disabled = !s.length;
    if (!seeking) seek.value = String(Math.round((1000 * s.pos) / Math.max(0.01, s.length)));
    at.textContent = `${clock(s.pos)} / ${clock(s.length)}`;
    again.hidden = !s.recorded || s.mic || s.onRecording;
    save.hidden = !s.recorded || s.mic;
    rec.hidden = again.hidden && save.hidden;
    recNote.textContent = s.mic
      ? `Recording in memory: ${clock(s.recording)}${s.recording >= MAX_SECONDS - 1 ? " (the ten-minute limit)" : ""}. Stop the microphone to play it back.` // prettier-ignore
      : s.recorded
        ? `Your recording (${clock(s.recorded)}) stays in this page's memory until you close it or record again; it's saved only if you tap Save.` // prettier-ignore
        : "";
    recNote.hidden = !recNote.textContent;
  }
  sync();
  const timer = setInterval(() => {
    if (!box.isConnected) return clearInterval(timer);
    if (!document.hidden) sync();
  }, 250);
  return box;
}
