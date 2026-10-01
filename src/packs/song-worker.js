// The song landscape's analysis worker (lane Live input r2): measures a
// song's frames (song-analysis.js) off the page's thread, in chunks of two
// seconds, nearest the playhead first, so what is about to play is ready
// first and the page never freezes. The samples may come in pieces (an MP3
// decoded piece by piece); a chunk is measured once all the samples its
// frames look at are in. Started by song-stream.js.
//
// In:  { type: "start", total, rate }   a song of `total` mono samples
//      { type: "samples", at, data }     mono samples from sample `at` on
//      { type: "end" }                  no more samples are coming
//      { type: "focus", frame }          the frame playing now
// Out: { type: "info", n, nf }
//      { type: "chunk", i0, i1, bands, feat }   measured frames [i0, i1)
//      { type: "done" }

import { makeAnalyser, makeFeatures, analyzeFrames, frameCount, frameTime, FIELDS, SIZE } from "./song-analysis.js"; // prettier-ignore

const CHUNK = 50; // frames (two seconds)
let job = null;

onmessage = (e) => {
  const m = e.data;
  if (m.type === "start") {
    const n = frameCount(m.total / m.rate);
    const out = makeFeatures(n);
    job = {
      samples: new Float32Array(m.total),
      rate: m.rate,
      have: [], // [start, end) sample ranges in, merged
      out,
      A: makeAnalyser(m.rate),
      focus: 0,
      chunks: new Uint8Array(Math.ceil(n / CHUNK)),
      busy: false,
    };
    postMessage({ type: "info", n, nf: out.nf });
  } else if (m.type === "samples" && job) {
    const end = Math.min(job.samples.length, m.at + m.data.length);
    job.samples.set(m.data.subarray(0, end - m.at), m.at);
    add(job.have, m.at, end);
    wake();
  } else if (m.type === "end" && job) {
    // (A last piece may end a little short of the song's length.)
    job.ended = true;
    wake();
  } else if (m.type === "focus" && job) {
    job.focus = Math.max(0, Math.floor(m.frame / CHUNK));
  }
};

function add(list, s, e) {
  list.push([s, e]);
  list.sort((x, y) => x[0] - y[0]);
  const merged = [];
  for (const r of list) {
    const last = merged[merged.length - 1];
    // (A resampled piece may end a sample or two short of the next.)
    if (last && r[0] <= last[1] + 8) last[1] = Math.max(last[1], r[1]);
    else merged.push(r);
  }
  list.length = 0;
  list.push(...merged);
}

// Whether chunk k's samples are all in: its frames' windows, and the frame
// before it (the flux compares with it).
function ready(k) {
  if (job.ended) return true;
  const { rate, out, samples, have } = job;
  const i0 = k * CHUNK;
  const i1 = Math.min(out.n, i0 + CHUNK);
  const lo = Math.max(0, Math.round(frameTime(Math.max(0, i0 - 1)) * rate) - SIZE);
  const hi = Math.min(samples.length, Math.round(frameTime(i1 - 1) * rate) + SIZE);
  return have.some(([s, e]) => s <= lo && e >= hi);
}

// The next chunk: the one playing now and the next few, then onward from
// there, then the rest from the start (of those whose samples are in).
function next() {
  const c = job.chunks;
  for (let k = job.focus; k < c.length; k++) if (!c[k] && ready(k)) return k;
  for (let k = 0; k < job.focus; k++) if (!c[k] && ready(k)) return k;
  return -1;
}

function wake() {
  if (job && !job.busy) {
    job.busy = true;
    setTimeout(work, 0);
  }
}

function work() {
  job.busy = false;
  const k = next();
  if (k < 0) {
    if (job.chunks.every((x) => x)) postMessage({ type: "done" });
    return; // (more samples will wake it)
  }
  job.chunks[k] = 1;
  const { out, A, samples } = job;
  const i0 = k * CHUNK;
  const i1 = Math.min(out.n, i0 + CHUNK);
  analyzeFrames(A, samples, i0, i1, out);
  const bands = out.bands.slice(i0 * out.nf, i1 * out.nf);
  const feat = out.feat.slice(i0 * FIELDS.length, i1 * FIELDS.length);
  postMessage({ type: "chunk", i0, i1, bands, feat }, [bands.buffer, feat.buffer]);
  wake(); // lets a focus or samples message in between chunks
}
