// Moving photo to 3D (lane Live input r3, the owner's idea of October 2,
// 2026): a GIF or a short video played back in 3D, the way the splat
// mirror shows the live camera. Each frame's depth comes from the same
// vendored depth model (Depth Anything V2 Small, in src/live/depth-worker.js),
// worked out on this device when the file is opened; nothing is uploaded.
// The sample, six seconds of Big Buck Bunny (the bunny and the butterfly,
// CC BY 3.0, the Screen toy's clip), ships as two sheets of 24 frames (480
// by 270) with their depth worked out ahead (tools/live3-depth.mjs), so it
// needs no model, and plays with the clip's own sound.
//
// What it takes (r5, the owner's review of October 3, 2026: sharper):
//   - up to MAX_FRAMES (48) frames: a GIF's own frames (evenly thinned if it
//     has more), or a video's first MAX_SECONDS (8 s) at up to 12 a second;
//   - each frame CLIP_SIDES[profile] pixels on its long side: 256 on a low
//     device, 384, 512, and 640 at max (r3 took 256 everywhere, so the
//     picture was blurry even at max: that was the main limit, not the
//     device). The splat grid is as fine as the frame, up to the profile's
//     splat budget;
//   - the depth model sees DEPTH_SIDES[profile] pixels on the long side (196,
//     or 294 on a high or max device). Its depth is smooth (it guesses
//     shapes, not edges), so it is sampled smoothly up to the frame's size
//     and its edges are cut clean (sharpenEdges); a longer clip has its
//     depth worked out on every other frame and the frames between take the
//     mean of their neighbors (half the wait, and steadier depth);
//   - a video plays with its own sound, and its frames follow that sound's
//     clock (pause and scrub with them).
//
// The picture is a grid of relief splats (src/live/relief.js) whose canvas
// holds the frame's colors and depth. Each splat rests at its average depth
// over the clip and moves from there by a signed offset (relief axis 3), so
// the splats sort the way they show (the mirror's flashing, fixed in r3).

import { songTransport } from "./song-record.js";

export const MAX_FRAMES = 48;
export const MAX_SECONDS = 8;
export const CLIP_SIDES = { low: 256, mid: 384, high: 512, max: 640 };
export const DEPTH_SIDES = { low: 196, mid: 196, high: 294, max: 294 };
const profile = () => globalThis.window?.__splashery?.player?.profile || "mid";
export const clipSide = () => CLIP_SIDES[profile()] || CLIP_SIDES.mid;
export const depthSide = () => DEPTH_SIDES[profile()] || DEPTH_SIDES.mid;
export const CLIP_SIDE = CLIP_SIDES.low; // (r3's one size; Node tools)
export const DEPTH_SIDE = DEPTH_SIDES.low;
const LIFT = 0.9; // recipe units at full depth

export const MOVING = {
  sample: null, // the sample clip, once loaded
  custom: null, // a clip the person opened
  want: null, // the clip the next build shows
  clip: null, // the clip on show
  t: 0, // seconds into the clip
  last: null,
  frame: 0,
  full: 0, // the lift at the chosen depth
  grid: null, // { cols, rows, map } of the build
  images: null, // per frame: the canvas data (colors left, offsets right)
  status: "",
};

export const movingState = () => ({
  clip: MOVING.clip ? { name: MOVING.clip.name, n: MOVING.clip.n, w: MOVING.clip.w, h: MOVING.clip.h } : null, // prettier-ignore
  frame: MOVING.frame,
  t: MOVING.t,
  status: MOVING.status,
});

// ---- Frames ------------------------------------------------------------------------

// A GIF's frames, composited with each frame's disposal, as RGBA at full size.
// omggif (vendored) is loaded only here, when a GIF is opened.
export async function gifFrames(bytes) {
  const { GifReader } = await import("../../vendor/omggif/omggif.js");
  const r = new GifReader(bytes);
  const { width, height } = r;
  const count = r.numFrames();
  const px = new Uint8ClampedArray(width * height * 4);
  const out = [];
  let saved = null;
  for (let i = 0; i < count; i++) {
    const prev = i > 0 ? r.frameInfo(i - 1) : null;
    if (prev?.disposal === 2)
      for (let y = prev.y; y < prev.y + prev.height; y++)
        px.fill(0, (y * width + prev.x) * 4, (y * width + prev.x + prev.width) * 4);
    else if (prev?.disposal === 3 && saved) px.set(saved);
    const info = r.frameInfo(i);
    saved = info.disposal === 3 ? px.slice() : null;
    r.decodeAndBlitFrameRGBA(i, px);
    out.push({ data: px.slice(), delay: Math.max(20, (info.delay || 10) * 10) });
  }
  return { w: width, h: height, frames: out };
}

// Every k-th frame, so there are at most `max` (their delays added up).
export function thin(frames, max = MAX_FRAMES) {
  if (frames.length <= max) return frames;
  const out = [];
  const step = frames.length / max;
  for (let i = 0; i < max; i++) {
    const a = Math.floor(i * step);
    const b = Math.floor((i + 1) * step);
    let delay = 0;
    for (let j = a; j < b; j++) delay += frames[j].delay;
    out.push({ data: frames[a].data, delay });
  }
  return out;
}

// RGBA (w by h) to a smaller w2 by h2, by averaging boxes; transparent parts
// as white paper.
export function shrink(data, w, h, w2, h2) {
  const out = new Uint8ClampedArray(w2 * h2 * 4);
  for (let y = 0; y < h2; y++)
    for (let x = 0; x < w2; x++) {
      const x0 = Math.floor((x * w) / w2);
      const x1 = Math.max(x0 + 1, Math.floor(((x + 1) * w) / w2));
      const y0 = Math.floor((y * h) / h2);
      const y1 = Math.max(y0 + 1, Math.floor(((y + 1) * h) / h2));
      let r = 0;
      let g = 0;
      let b = 0;
      let n = 0;
      for (let yy = y0; yy < y1; yy++)
        for (let xx = x0; xx < x1; xx++) {
          const o = (yy * w + xx) * 4;
          const a = data[o + 3] / 255;
          r += data[o] * a + 255 * (1 - a);
          g += data[o + 1] * a + 255 * (1 - a);
          b += data[o + 2] * a + 255 * (1 - a);
          n++;
        }
      const o = (y * w2 + x) * 4;
      out[o] = r / n;
      out[o + 1] = g / n;
      out[o + 2] = b / n;
      out[o + 3] = 255;
    }
  return out;
}

// The frame's size: `side` on its long side, never larger than the source.
const sizeFor = (w, h, side) => {
  const s = Math.min(1, side / Math.max(w, h));
  return { w: Math.max(2, Math.round(w * s)), h: Math.max(2, Math.round(h * s)) };
};
const modelSize = (w, h, side = DEPTH_SIDE) => {
  const s = side / Math.max(w, h);
  const m = (x) => Math.max(14, Math.round((x * s) / 14) * 14);
  return { w: m(w), h: m(h) };
};

// ---- Depth -------------------------------------------------------------------------

// A frame's depth as 0 (far) .. 1 (near) at the clip's size: the model's
// output scaled by its 2nd and 98th percentiles, those eased across
// neighboring frames so the depth doesn't pump from frame to frame.
export function normalizeDepths(raw, w, h) {
  const ranges = raw.map((d) => {
    const s = Float32Array.from(d.d).sort();
    return [s[Math.floor(s.length * 0.02)], s[Math.floor(s.length * 0.98)]];
  });
  return raw.map((d, i) => {
    let lo = 0;
    let hi = 0;
    let n = 0;
    for (let j = Math.max(0, i - 2); j <= Math.min(raw.length - 1, i + 2); j++) {
      lo += ranges[j][0];
      hi += ranges[j][1];
      n++;
    }
    lo /= n;
    hi /= n;
    const span = Math.max(1e-6, hi - lo);
    const out = new Float32Array(w * h);
    for (let y = 0; y < h; y++)
      for (let x = 0; x < w; x++) {
        // Bilinear (r5): the depth is smaller than the frame; nearest
        // sampling left it in blocks.
        const fx = Math.max(0, Math.min(d.w - 1, ((x + 0.5) / w) * d.w - 0.5));
        const fy = Math.max(0, Math.min(d.h - 1, ((y + 0.5) / h) * d.h - 0.5));
        const x0 = Math.floor(fx);
        const y0 = Math.floor(fy);
        const x1 = Math.min(d.w - 1, x0 + 1);
        const y1 = Math.min(d.h - 1, y0 + 1);
        const ax = fx - x0;
        const ay = fy - y0;
        const top = d.d[y0 * d.w + x0] * (1 - ax) + d.d[y0 * d.w + x1] * ax;
        const bot = d.d[y1 * d.w + x0] * (1 - ax) + d.d[y1 * d.w + x1] * ax;
        const v = top * (1 - ay) + bot * ay;
        out[y * w + x] = Math.max(0, Math.min(1, (v - lo) / span));
      }
    return out;
  });
}

// The packed depths of a clip's frames (the sample's file): a count, then
// each frame's packDepth bytes (src/packs/photo-3d.js) with its length.
export function packDepths(list, pack) {
  const parts = list.map((d) => pack(d));
  const out = new Uint8Array(2 + parts.reduce((s, p) => s + 4 + p.length, 0));
  const v = new DataView(out.buffer);
  v.setUint16(0, parts.length, true);
  let at = 2;
  for (const p of parts) {
    v.setUint32(at, p.length, true);
    out.set(p, at + 4);
    at += 4 + p.length;
  }
  return out;
}

export function unpackDepths(bytes, unpack) {
  const v = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const n = v.getUint16(0, true);
  const out = [];
  let at = 2;
  for (let i = 0; i < n; i++) {
    const len = v.getUint32(at, true);
    out.push(unpack(bytes.subarray(at + 4, at + 4 + len)));
    at += 4 + len;
  }
  return out;
}

// The depth model, in its worker, one frame at a time.
export async function depthOf(frames, w, h, onStatus, side = DEPTH_SIDE) {
  const worker = new Worker(new URL("../live/depth-worker.js", import.meta.url), { type: "module" }); // prettier-ignore
  const ms = modelSize(w, h, side);
  const out = [];
  // r5: a long clip's depth on every other frame (and the last); the frames
  // between take their neighbors' mean.
  const step = frames.length > 24 ? 2 : 1;
  const want = frames.map((_, i) => i % step === 0 || i === frames.length - 1);
  const total = want.filter(Boolean).length;
  let done = 0;
  try {
    for (let i = 0; i < frames.length; i++) {
      if (!want[i]) {
        out.push(null);
        continue;
      }
      const data = shrink(frames[i].data, w, h, ms.w, ms.h);
      const d = await new Promise((resolve, reject) => {
        worker.onmessage = (e) => {
          const m = e.data;
          if (m.type === "status") return m.text && onStatus?.(m.text);
          if (m.type === "error") return reject(new Error(m.text || "The depth model stopped."));
          if (m.type === "depth") resolve(m);
        };
        worker.onerror = () => reject(new Error("The depth model couldn't start in this browser."));
        worker.postMessage({ type: "frame", id: i, w: ms.w, h: ms.h, data }, [data.buffer]);
      });
      out.push(d);
      onStatus?.(`Working out the depth: ${++done} of ${total}…`);
    }
  } finally {
    worker.terminate();
  }
  for (let i = 0; i < out.length; i++) {
    if (out[i]) continue;
    const a = out[i - 1];
    const b = out[i + 1];
    const d = new Float32Array(a.d.length);
    for (let j = 0; j < d.length; j++) d[j] = (a.d[j] + b.d[j]) / 2;
    out[i] = { w: a.w, h: a.h, d };
  }
  return out;
}

// A clip: { name, n, w, h, delays (ms), colors (RGBA per frame, w by h),
// near (0..1 per frame), mean (each pixel's average nearness) }.
// Where the depth jumps (a near bunny before a far meadow), the model's
// depth, smaller than the frame and blurred, ramps across a few pixels, and
// those pixels would hang as dots between the two. Each pixel whose 5 by 5
// neighborhood spans more than EDGE goes with the nearer or farther side,
// whichever it is closer to, so the edge is a clean cut.
const EDGE = 0.15;
export function sharpenEdges(d, w, h) {
  const out = new Float32Array(d.length);
  for (let y = 0; y < h; y++)
    for (let x = 0; x < w; x++) {
      let lo = Infinity;
      let hi = -Infinity;
      for (let j = Math.max(0, y - 2); j <= Math.min(h - 1, y + 2); j++)
        for (let i = Math.max(0, x - 2); i <= Math.min(w - 1, x + 2); i++) {
          const v = d[j * w + i];
          if (v < lo) lo = v;
          if (v > hi) hi = v;
        }
      const v = d[y * w + x];
      out[y * w + x] = hi - lo > EDGE ? (v - lo < hi - v ? lo : hi) : v;
    }
  return out;
}

export function makeClip(name, w, h, frames, near) {
  near = near.map((d) => sharpenEdges(d, w, h));
  const mean = new Float32Array(w * h);
  for (const d of near) for (let i = 0; i < mean.length; i++) mean[i] += d[i] / near.length;
  return {
    name,
    n: frames.length,
    w,
    h,
    delays: frames.map((f) => f.delay),
    duration: frames.reduce((s, f) => s + f.delay, 0) / 1000,
    colors: frames.map((f) => f.data),
    near,
    mean,
  };
}

// A GIF or video the person opened: its frames at the clip's size, then the
// depth of each.
export async function openClip(file, name, onStatus) {
  let w;
  let h;
  let frames;
  let audio = null;
  const side = clipSide();
  const isGif = /\.gif$/i.test(name) || file.type === "image/gif";
  if (isGif) {
    onStatus?.("Reading the GIF…");
    let g;
    try {
      g = await gifFrames(new Uint8Array(await file.arrayBuffer()));
    } catch {
      throw new Error("That GIF couldn't be read. Try another GIF, or an MP4 or WebM video.");
    }
    ({ w, h } = sizeFor(g.w, g.h, side));
    frames = thin(g.frames).map((f) => ({ data: shrink(f.data, g.w, g.h, w, h), delay: f.delay }));
  } else {
    onStatus?.("Reading the video…");
    ({ w, h, frames } = await videoFrames(file, side));
    audio = await soundOf(URL.createObjectURL(file), true);
  }
  if (frames.length < 2) throw new Error("That file has only one picture. Open a GIF or a video that moves."); // prettier-ignore
  const raw = await depthOf(frames, w, h, onStatus, depthSide());
  return { ...makeClip(name, w, h, frames, normalizeDepths(raw, w, h)), audio };
}

// A video's first MAX_SECONDS, at up to 12 frames a second (at most
// MAX_FRAMES), each drawn after a seek.
async function videoFrames(file, side) {
  const v = document.createElement("video");
  v.muted = true;
  v.playsInline = true;
  v.preload = "auto";
  const url = URL.createObjectURL(file);
  v.src = url;
  try {
    await new Promise((resolve, reject) => {
      v.addEventListener("loadeddata", resolve, { once: true });
      v.addEventListener("error", () => reject(new Error("This browser can't play that video. MP4 (H.264) and WebM play almost everywhere.")), { once: true }); // prettier-ignore
    });
    const len = Math.min(MAX_SECONDS, v.duration || 0);
    if (!(len > 0.2)) throw new Error("That video is too short.");
    const n = Math.max(2, Math.min(MAX_FRAMES, Math.round(len * 12)));
    const { w, h } = sizeFor(v.videoWidth, v.videoHeight, side);
    const c = document.createElement("canvas");
    c.width = w;
    c.height = h;
    const g = c.getContext("2d", { willReadFrequently: true });
    const frames = [];
    for (let i = 0; i < n; i++) {
      const at = (i * len) / n;
      await new Promise((resolve) => {
        v.addEventListener("seeked", resolve, { once: true });
        v.currentTime = at;
      });
      g.drawImage(v, 0, 0, w, h);
      frames.push({ data: g.getImageData(0, 0, w, h).data, delay: (len * 1000) / n });
    }
    return { w, h, frames };
  } finally {
    v.removeAttribute("src");
    v.load();
    URL.revokeObjectURL(url);
  }
}

// A video's own sound (r5): a Track (song-stream.js) playing the file,
// routed to the site's speaker button; its clock drives the frames. Null if
// the browser can't play it (the clip then plays silently on its own clock).
async function soundOf(url, own) {
  if (typeof Audio === "undefined") return null;
  const { Track } = await import("./song-stream.js");
  const track = new Track(url);
  try {
    await track.ready;
  } catch {
    track.close();
    if (own) URL.revokeObjectURL(url);
    return null;
  }
  return { track, url, own };
}

function closeSound(audio) {
  if (!audio) return;
  audio.track.close();
  if (audio.own) URL.revokeObjectURL(audio.url);
}

// ---- The picture -------------------------------------------------------------------

// The grid for a clip and a splat budget: the clip's own pixels, or fewer.
export function clipGrid(clip, count) {
  const n = Math.max(3000, Math.min(clip.w * clip.h, Math.floor(count * 0.8)));
  const s = Math.min(1, Math.sqrt(n / (clip.w * clip.h)));
  return { cols: Math.max(16, Math.round(clip.w * s)), rows: Math.max(12, Math.round(clip.h * s)) };
}

// Each frame's canvas data: its colors on the left; on the right, red and
// green a half (no sideways move) and blue a half plus half the frame's
// nearness less the average (the signed offset from where the splat rests).
// One frame's canvas data (r5: built when the frame shows, not all at
// once): its colors on the left, averaged over the frame's pixels under
// each splat when the grid is coarser than the frame; on the right, red and
// green a half (no sideways move) and blue a half plus half the frame's
// nearness less the average (the signed offset from where the splat rests).
export function frameImage(clip, cols, rows, f) {
  const W = cols * 2;
  const px = new Uint8ClampedArray(W * rows * 4);
  const col = clip.colors[f];
  const near = clip.near[f];
  const span = (i, n, size) => [Math.floor((i * size) / n), Math.max(Math.floor((i * size) / n) + 1, Math.floor(((i + 1) * size) / n))]; // prettier-ignore
  for (let j = 0; j < rows; j++) {
    const [y0, y1] = span(j, rows, clip.h);
    const ym = Math.min(clip.h - 1, Math.floor(((j + 0.5) / rows) * clip.h));
    for (let i = 0; i < cols; i++) {
      const [x0, x1] = span(i, cols, clip.w);
      let r = 0;
      let g = 0;
      let b = 0;
      let n = 0;
      for (let y = y0; y < y1; y++)
        for (let x = x0; x < x1; x++) {
          const o = (y * clip.w + x) * 4;
          r += col[o];
          g += col[o + 1];
          b += col[o + 2];
          n++;
        }
      const o = (j * W + i) * 4;
      px[o] = r / n;
      px[o + 1] = g / n;
      px[o + 2] = b / n;
      px[o + 3] = 255;
      const s2 = ym * clip.w + Math.min(clip.w - 1, Math.floor(((i + 0.5) / cols) * clip.w));
      const q = (j * W + cols + i) * 4;
      px[q] = px[q + 1] = 128;
      px[q + 2] = Math.round(255 * (0.5 + (near[s2] - clip.mean[s2]) / 2));
      px[q + 3] = 255;
    }
  }
  return px;
}

export const frameImages = (clip, cols, rows) => clip.colors.map((_, f) => frameImage(clip, cols, rows, f)); // prettier-ignore

// The frame showing t seconds in, looping.
export function frameAt(clip, t) {
  let ms = (((t % clip.duration) + clip.duration) % clip.duration) * 1000;
  for (let i = 0; i < clip.n; i++) {
    ms -= clip.delays[i];
    if (ms < 0) return i;
  }
  return clip.n - 1;
}

// ---- The recipe --------------------------------------------------------------------

async function readBytes(rel) {
  const url = new URL(rel, import.meta.url);
  if (url.protocol === "file:") {
    const fs = await import("node:fs/promises");
    return new Uint8Array(await fs.readFile(url));
  }
  const r = await fetch(url);
  if (!r.ok) throw new Error("Could not load the sample clip.");
  return new Uint8Array(await r.arrayBuffer());
}

// The sample's sheets: SAMPLE.sheets sheets of SAMPLE.cols by SAMPLE.rows
// frames, each SAMPLE.w by SAMPLE.h, at SAMPLE.fps (tools/live3-depth.mjs
// makes them; two, as a decoded picture is at most 2048 pixels wide).
export const SAMPLE = { sheets: 2, cols: 4, rows: 6, w: 480, h: 270, fps: 8 };
// The same scene with its sound (the Screen toy's files): MP4, or WebM where
// the browser can't play MP4 (some Chromium builds).
const SAMPLE_SOUND = () =>
  globalThis.document?.createElement("audio").canPlayType('audio/mp4; codecs="mp4a.40.2"')
    ? "../../assets/toys/screen/bunny.mp4"
    : "../../assets/toys/screen/bunny.webm";

// The sheets (decoded) cut into frames, in order.
export function sheetFrames(photos) {
  const { cols, rows, w, h, fps } = SAMPLE;
  const out = [];
  for (const photo of [].concat(photos))
    for (let f = 0; f < cols * rows; f++) {
      const x0 = (f % cols) * w;
      const y0 = Math.floor(f / cols) * h;
      const data = new Uint8ClampedArray(w * h * 4);
      for (let y = 0; y < h; y++) {
        const o = ((y0 + y) * photo.w + x0) * 4;
        data.set(photo.data.subarray(o, o + w * 4), y * w * 4);
      }
      out.push({ data, delay: 1000 / fps });
    }
  return out;
}

export async function loadSample() {
  if (MOVING.sample) return MOVING.sample;
  const { decodePhoto, unpackDepth } = await import("./photo-3d.js");
  const sheets = await Promise.all(Array.from({ length: SAMPLE.sheets }, (_, i) => readBytes(`../../assets/toys/moving-photo-3d/bunny-sheet-${i + 1}.jpg`).then(decodePhoto))); // prettier-ignore
  const dep = await readBytes("../../assets/toys/moving-photo-3d/bunny.depth");
  const frames = sheetFrames(sheets);
  const raw = unpackDepths(dep, unpackDepth);
  const clip = makeClip("Big Buck Bunny (a six-second scene)", SAMPLE.w, SAMPLE.h, frames, normalizeDepths(raw, SAMPLE.w, SAMPLE.h)); // prettier-ignore
  clip.audio = typeof Audio === "undefined" ? null : await soundOf(new URL(SAMPLE_SOUND(), import.meta.url).href, false); // prettier-ignore
  MOVING.sample = clip;
  return clip;
}

function setShown(text) {
  MOVING.status = text;
  if (typeof document === "undefined") return;
  const el = document.querySelector("#toy-input .input-shown");
  if (!el) return;
  el.textContent = text;
  el.hidden = !text;
}

// The clip's sound (r5), if it has one.
const track = () => MOVING.clip?.audio?.track ?? null;

// Plays or pauses the clip, its sound with it (from a tap, so a phone lets
// the sound start).
function playClip(on) {
  const t = track();
  if (t) {
    if (on && !t.playing) {
      if (Math.abs(t.el.currentTime - MOVING.t) > 0.1) t.el.currentTime = MOVING.t;
      t.play(MOVING.sound);
    } else if (!on && t.playing) t.pause();
  }
  globalThis.window?.__splashery?.app?.setControl?.("play", on ? 1 : 0);
  liveWake();
}
const liveWake = () => globalThis.window?.__splashery?.player?.stage?.requestRender?.();

export const movingTransport = {
  prefix: "moving",
  state() {
    const clip = MOVING.clip;
    const c = globalThis.window?.__splashery?.player?.motion?.targets?.play ?? 1;
    // With sound, playing means the sound plays (a browser that wanted a tap
    // first shows Play until there is one).
    const t = track();
    const playing = t ? t.playing : c > 0.5;
    return { hidden: !clip, pos: MOVING.t, length: clip?.duration || 0, playing, mic: false, live: false, recorded: 0, recording: 0 }; // prettier-ignore
  },
  toStart() {
    this.seek(0);
    playClip(true);
  },
  toggle() {
    playClip(!this.state().playing);
  },
  seek(sec) {
    const clip = MOVING.clip;
    if (!clip) return;
    MOVING.t = Math.max(0, Math.min(clip.duration - 0.01, sec));
    const t = track();
    if (t) {
      t.el.currentTime = MOVING.t;
      t.anchor = null;
    }
    MOVING.frame = frameAt(clip, MOVING.t);
    liveWake();
  },
  // Another toy: the sound stops.
  gone() {
    setTimeout(() => {
      if (globalThis.window?.__splashery?.player?.scene?.toy?.id !== "moving-photo-3d") track()?.pause(); // prettier-ignore
    }, 300);
  },
};

export const MOVING_PHOTO = {
  alive: (c) => (c.play ?? 1) > 0.5 && !!MOVING.clip,
  density: 1,
  turntable: false,
  options: [
    { key: "depth", label: "Depth", type: "slider", min: 0, max: 1, step: 0.05, default: 0.6 },
    { key: "clip", label: "Clip", type: "text", default: "sample", hidden: true },
    { key: "clipName", label: "Clip name", type: "text", default: "", hidden: true },
  ],
  controls: [{ key: "play", label: "Play", type: "toggle", default: 1, ease: 0.2 }],
  action: {
    key: "play",
    label: "Play or pause the clip",
    quiet: ["play"],
    // r5: the sound starts or stops inside the tap itself (a phone wants that).
    onAct() {
      const t = track();
      if (!t) return;
      // The tap turns playing off if it was on, else on.
      const on = (globalThis.window?.__splashery?.player?.motion?.targets?.play ?? 1) > 0.5;
      if (on) t.pause();
      else {
        t.el.currentTime = MOVING.t;
        t.play(MOVING.sound);
      }
    },
  },
  input: {
    title: "Your GIF or video",
    accept: "image/gif,.gif,video/*,.mp4,.webm,.mov,.m4v",
    binary: true,
    maxBytes: 200e6,
    fileButton: "Open a GIF or video…",
    note: `Open a GIF or a short video. Its first ${MAX_SECONDS} seconds (up to ${MAX_FRAMES} frames) are read on this device, the depth model (about 27 MB, loaded the first time) works out how near each part of every frame is, and the clip plays back in 3D, a video with its own sound. Nothing is uploaded. Tap to pause or play.`, // prettier-ignore
    live: [{ render: () => songTransport(movingTransport) }],
    async read(_text, fileName, file) {
      if (!file) throw new Error("Open a GIF or a video.");
      const clip = await openClip(file, fileName.replace(/\.[^.]+$/, ""), setShown);
      track()?.pause();
      if (MOVING.custom) closeSound(MOVING.custom.audio);
      MOVING.custom = clip;
      setShown("");
      return { clip: "custom", clipName: clip.name };
    },
    shown: () =>
      MOVING.status || (MOVING.clip ? `${MOVING.clip.name}: ${MOVING.clip.n} frames, ${MOVING.clip.duration.toFixed(1)} s` : ""), // prettier-ignore
  },
  credits: [
    {
      label: "Moving photo to 3D",
      title: "Big Buck Bunny (a six-second scene, the sample clip)",
      source: "https://peach.blender.org/",
      author: "Blender Foundation",
      license: "CC BY 3.0",
      licenseUrl: "https://creativecommons.org/licenses/by/3.0/",
    },
  ],
  screen: {
    get width() {
      return (MOVING.grid?.cols || 16) * 2;
    },
    get height() {
      return MOVING.grid?.rows || 12;
    },
    version: () => `${MOVING.clip?.name}|${MOVING.frame}|${MOVING.grid?.cols}`,
    draw(g) {
      const clip = MOVING.clip;
      if (!clip || !MOVING.grid) return;
      const { cols, rows } = MOVING.grid;
      g.putImageData(new ImageData(frameImage(clip, cols, rows, MOVING.frame), cols * 2, rows), 0, 0); // prettier-ignore
    },
  },
  async prepare(o) {
    MOVING.want = o.clip === "custom" && MOVING.custom ? MOVING.custom : await loadSample();
  },
  drive(t, c, out, info) {
    const time = info?.time ?? t;
    const dt = MOVING.last === null ? 0 : Math.max(0, Math.min(0.25, time - MOVING.last));
    MOVING.last = time;
    if (info?.sound) MOVING.sound = info.sound;
    const clip = MOVING.clip;
    if (!clip) return;
    const on = (c.play ?? 1) > 0.5;
    const tr = track();
    if (tr?.playing) {
      // r5: the frames follow the sound's clock (looping at the clip's end).
      if (!on) tr.pause();
      else if (tr.time() >= clip.duration - 0.02) {
        tr.el.currentTime = 0;
        tr.anchor = null;
        MOVING.t = 0;
      } else MOVING.t = tr.time();
    } else if (on) {
      // Silent (a GIF, or before the first tap lets the sound start).
      MOVING.t = (MOVING.t + dt) % clip.duration;
      if (tr && !tr.blocked && !tr.el.ended) {
        tr.el.currentTime = MOVING.t;
        tr.play(MOVING.sound);
      }
    }
    MOVING.frame = frameAt(clip, MOVING.t);
  },
  build(k, o) {
    const clip = MOVING.want;
    if (MOVING.clip !== clip) {
      if (MOVING.clip?.audio) MOVING.clip.audio.track.pause();
      MOVING.t = 0;
    }
    MOVING.clip = clip;
    MOVING.last = null;
    const { cols, rows } = clipGrid(clip, k.count);
    MOVING.grid = { cols, rows };
    MOVING.frame = frameAt(clip, MOVING.t);
    const width = 2;
    const height = (width * rows) / cols;
    const full = LIFT * Math.max(0, o.depth ?? 0.6);
    MOVING.full = full;
    // Each splat rests at its average depth over the clip (see the top).
    const mean = (u, v) => clip.mean[Math.min(clip.h - 1, Math.floor(v * clip.h)) * clip.w + Math.min(clip.w - 1, Math.floor(u * clip.w))]; // prettier-ignore
    const items = [];
    for (let j = 0; j < rows; j++)
      for (let i = 0; i < cols; i++) {
        const u = (i + 0.5) / cols;
        const v = (j + 0.5) / rows;
        items.push({ p: [(u - 0.5) * width, (0.5 - v) * height, full * mean(u, v)], n: [0, 0, 1], size: ((width / cols) * 1.2) / 0.01, flat: 0.08, opacity: 1, color: "#808080", kind: "relief", params: [u, v, 3, Math.max(0.001, full)], pattern: false }); // prettier-ignore
      }
    // A backing layer at the farthest depth near each place, in the frame's
    // own colors: where a near part stands forward, what it uncovers from
    // the side (no splats were there) shows the frame's color instead of
    // gaps. It barely moves (its lift is a thousandth).
    const far = (u, v) => {
      let lo = 1;
      for (let dy = -3; dy <= 3; dy++)
        for (let dx = -3; dx <= 3; dx++) lo = Math.min(lo, mean(Math.min(1, Math.max(0, u + dx / cols)), Math.min(1, Math.max(0, v + dy / rows)))); // prettier-ignore
      return lo;
    };
    for (let j = 0; j < rows; j += 2)
      for (let i = 0; i < cols; i += 2) {
        const u = (i + 1) / cols;
        const v = (j + 1) / rows;
        items.push({ p: [(u - 0.5) * width, (0.5 - v) * height, -0.02], n: [0, 0, 1], size: ((width / cols) * 2.8) / 0.01, flat: 0.08, opacity: 1, color: "#808080", kind: "relief", params: [u, v, 3, 0.001], pattern: false }); // prettier-ignore
      }
    k.cloud({ share: items.length / k.count, pattern: false, jitter: 0 }, (rand, i) => items[i] || null); // prettier-ignore
    // A thin dark frame, like a screen's.
    const f = 0.05;
    const w = 1 + f;
    const h = height / 2 + f;
    const bar = (x, y, sx, sy) =>
      k.add(k.box(sx, sy, 0.05), { pos: [x, y, -0.03], color: "#22262c", share: 0.008, even: true }); // prettier-ignore
    bar(0, h - f / 2, 2 * w, f);
    bar(0, -h + f / 2, 2 * w, f);
    bar(-w + f / 2, 0, f, 2 * h);
    bar(w - f / 2, 0, f, 2 * h);
    k.reach([0, 0, 0.9]);
    k.data = { moving: { cols, rows, n: clip.n } };
  },
};
