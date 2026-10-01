// The song landscape's analysis worker (lane Live input r2): measures a
// song's frames (song-analysis.js) off the page's thread, in chunks of two
// seconds, nearest the playhead first, so what is about to play is ready
// first and the page never freezes. Started by song-stream.js.
//
// In:  { type: "start", channels: [Float32Array, …], rate }
//      { type: "focus", frame }   the frame playing now
// Out: { type: "info", n, nf }
//      { type: "chunk", i0, i1, bands, feat }   measured frames [i0, i1)
//      { type: "done" }

import { makeAnalyser, makeFeatures, analyzeFrames, frameCount, FIELDS } from "./song-analysis.js";

const CHUNK = 50; // frames (two seconds)
let job = null;

onmessage = (e) => {
  const m = e.data;
  if (m.type === "start") {
    const ch = m.channels;
    // A mono mix, as the landscape has always analyzed.
    let samples = ch[0];
    if (ch.length > 1) {
      samples = new Float32Array(ch[0].length);
      for (const c of ch) for (let i = 0; i < samples.length; i++) samples[i] += c[i] / ch.length;
    }
    const n = frameCount(samples.length / m.rate);
    const out = makeFeatures(n);
    job = { samples, out, A: makeAnalyser(m.rate), focus: 0, chunks: new Uint8Array(Math.ceil(n / CHUNK)) }; // prettier-ignore
    postMessage({ type: "info", n, nf: out.nf });
    setTimeout(work, 0);
  } else if (m.type === "focus" && job) {
    job.focus = Math.max(0, Math.floor(m.frame / CHUNK));
  }
};

// The next chunk: the one playing now and the next few, then onward from
// there, then the rest from the start.
function next() {
  const c = job.chunks;
  for (let k = job.focus; k < c.length; k++) if (!c[k]) return k;
  for (let k = 0; k < job.focus; k++) if (!c[k]) return k;
  return -1;
}

function work() {
  if (!job) return;
  const k = next();
  if (k < 0) {
    postMessage({ type: "done" });
    return;
  }
  job.chunks[k] = 1;
  const { out, A, samples } = job;
  const i0 = k * CHUNK;
  const i1 = Math.min(out.n, i0 + CHUNK);
  analyzeFrames(A, samples, i0, i1, out);
  const bands = out.bands.slice(i0 * out.nf, i1 * out.nf);
  const feat = out.feat.slice(i0 * FIELDS.length, i1 * FIELDS.length);
  postMessage({ type: "chunk", i0, i1, bands, feat }, [bands.buffer, feat.buffer]);
  setTimeout(work, 0); // lets a focus message in between chunks
}
