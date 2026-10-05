// Moving photo to 3D (lane Live input r3, the owner's idea of October 2,
// 2026): a GIF or a short video played back in 3D, the way the splat
// mirror shows the live camera. Each frame's depth comes from the same
// vendored depth model (Depth Anything V2 Small, in src/live/depth-worker.js),
// worked out on this device when the file is opened; nothing is uploaded.
// The sample, six seconds of Big Buck Bunny (the bunny and the butterfly,
// CC BY 3.0, the Screen toy's clip), ships as four sheets of its 48 frames
// (640 by 360, shown at 480 by 270 below a high device) with their depth
// worked out ahead (tools/live3-depth.mjs), so it needs no model, and plays
// with the clip's own sound.
//
// What it takes (r5, the owner's review of October 3, 2026: sharper):
//   - a video's first MAX_SECONDS (8 s), or a GIF's, at its own speed and at
//     up to CLIP_FPS[profile] frames a second (r6: 12 on a low device, 15,
//     then 24; r3 to r5 took at most 48 frames, so 6 a second for 8 s); a
//     GIF's own frames, evenly thinned if it has more;
//   - each frame CLIP_AREAS[profile] pixels in all (r6: 60,000 on a low
//     device, 140,000, 200,000, and 640 by 360 at max), never more than the
//     source. r5 sized the long side (256, 384, 512, 640), which left a
//     phone's portrait video 144 or 216 pixels wide: on a phone it looked
//     grainy beside the video itself. The toy takes a quarter more splats
//     than most (density 1.25), and the splat grid is as fine as the frame;
//   - the depth model sees DEPTH_SIDES[profile] pixels on the long side (196,
//     or 294 on a high or max device). Its depth is smooth (it guesses
//     shapes, not edges), so it is sampled smoothly up to the frame's size
//     and its edges are cut clean (sharpenEdges); the depth is worked out
//     on at most DEPTH_FRAMES[profile] frames, evenly spread, and the frames
//     between blend their neighbors' (r6; the colors carry the motion, and
//     the wait stays about what it was);
//   - a video plays with its own sound, and its frames follow that sound's
//     clock (pause and scrub with them).
//   - each frame's colors are sharpened a little (SHARPEN), to make up for
//     neighboring splats overlapping (r5, the owner's "even sharper?").
//
// The picture is a grid of relief splats (src/live/relief.js) whose canvas
// holds the frame's colors and depth. Each splat rests at its average depth
// over the clip and moves from there by a signed offset (relief axis 3), so
// the splats sort the way they show (the mirror's flashing, fixed in r3).

import { songTransport } from "./song-record.js";

export const MAX_SECONDS = 8;
export const CLIP_FPS = { low: 12, mid: 15, high: 24, max: 24 };
export const DEPTH_FRAMES = { low: 24, mid: 32, high: 48, max: 48 };
export const CLIP_AREAS = { low: 60000, mid: 140000, high: 200000, max: 640 * 360 };
export const DEPTH_SIDES = { low: 196, mid: 196, high: 294, max: 294 };
const profile = () => globalThis.window?.__splashery?.player?.profile || "mid";
export const clipArea = () => CLIP_AREAS[profile()] || CLIP_AREAS.mid;
export const depthSide = () => DEPTH_SIDES[profile()] || DEPTH_SIDES.mid;
export const clipFps = () => CLIP_FPS[profile()] || CLIP_FPS.mid;
export const maxFrames = () => Math.round(MAX_SECONDS * clipFps());
export const DEPTH_SIDE = DEPTH_SIDES.low;
const LIFT = 0.9; // recipe units at full depth

export const MOVING = {
  samples: new Map(), // sample id -> its clip, once loaded
  custom: null, // a clip the person opened
  want: null, // the clip the next build shows
  clip: null, // the clip on show
  t: 0, // seconds into the clip
  last: null,
  anchor: null, // r6: the silent clock, { t, at } (clip and player seconds)
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
    // r6: as browsers show it, a delay of 0 or 1 hundredths is a tenth of a
    // second (it was taken as 20 ms, five times too fast).
    out.push({ data: px.slice(), delay: info.delay > 1 ? info.delay * 10 : 100 });
  }
  return { w: width, h: height, frames: out };
}

// Every k-th frame, so there are at most `max` (their delays added up).
export function thin(frames, max = maxFrames()) {
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

// The frame's size: `area` pixels in all, never larger than the source.
const sizeFor = (w, h, area) => {
  const s = Math.min(1, Math.sqrt(area / (w * h)));
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
  // r6: the depth on at most DEPTH_FRAMES[profile] frames, evenly spread
  // (with the first and the last); the frames between blend their
  // neighbors' (r5 took every other frame).
  const cap = Math.max(2, DEPTH_FRAMES[profile()] || DEPTH_FRAMES.mid);
  const want = frames.map(() => false);
  const m = Math.min(frames.length, cap);
  for (let k = 0; k < m; k++)
    want[Math.round((k * (frames.length - 1)) / Math.max(1, m - 1))] = true;
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
  const done2 = out.map((d) => !!d);
  for (let i = 0; i < out.length; i++) {
    if (done2[i]) continue;
    let ia = i - 1;
    while (!done2[ia]) ia--;
    let ib = i + 1;
    while (!done2[ib]) ib++;
    const a = out[ia];
    const b = out[ib];
    const f = (i - ia) / (ib - ia);
    const d = new Float32Array(a.d.length);
    for (let j = 0; j < d.length; j++) d[j] = a.d[j] * (1 - f) + b.d[j] * f;
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
  // r6: each frame's nearness kept as bytes (0..255; a quarter of the
  // memory, for a clip at its own frame rate).
  const mean = new Float32Array(w * h);
  near = near.map((d) => {
    const e = sharpenEdges(d, w, h);
    const q = new Uint8Array(e.length);
    for (let i = 0; i < e.length; i++) {
      q[i] = Math.round(255 * e[i]);
      mean[i] += q[i] / 255 / near.length;
    }
    return q;
  });
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
  let source = 0; // the file's own length (s)
  const side = clipArea();
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
    source = g.frames.reduce((t, f) => t + f.delay, 0) / 1000;
    // Its first MAX_SECONDS, at up to clipFps() frames a second.
    let kept = [];
    let at = 0;
    for (const f of g.frames) {
      if (at >= MAX_SECONDS * 1000) break;
      kept.push(f);
      at += f.delay;
    }
    kept = thin(kept, Math.max(2, Math.min(maxFrames(), Math.round((at / 1000) * clipFps()))));
    frames = kept.map((f) => ({ data: shrink(f.data, g.w, g.h, w, h), delay: f.delay }));
  } else {
    onStatus?.("Reading the video…");
    ({ w, h, frames, source } = await videoFrames(file, side, onStatus));
    audio = await soundOf(URL.createObjectURL(file), true);
  }
  if (frames.length < 2) throw new Error("That file has only one picture. Open a GIF or a video that moves."); // prettier-ignore
  const raw = await depthOf(frames, w, h, onStatus, depthSide());
  return { ...makeClip(name, w, h, frames, normalizeDepths(raw, w, h)), audio, source };
}

// A video's first MAX_SECONDS, at clipFps() frames a second, each drawn
// after a seek (its length is the video's own, so it plays at its speed).
async function videoFrames(file, side, onStatus) {
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
    const n = Math.max(2, Math.min(maxFrames(), Math.round(len * clipFps())));
    const { w, h } = sizeFor(v.videoWidth, v.videoHeight, side);
    const c = document.createElement("canvas");
    c.width = w;
    c.height = h;
    const g = c.getContext("2d", { willReadFrequently: true });
    const frames = [];
    const grab = () => frames.push({ data: g.getImageData(0, 0, w, h).data, delay: (len * 1000) / n }); // prettier-ignore
    // r6: played through once, muted, each frame taken as it shows
    // (requestVideoFrameCallback): about the clip's own length. A seek to
    // each frame decodes from the last key frame every time, which took
    // minutes for a phone's video at 24 frames a second.
    if (
      v.requestVideoFrameCallback &&
      (await playedFrames(
        v,
        n,
        len,
        () => {
          g.drawImage(v, 0, 0, w, h);
          grab();
        },
        onStatus,
      ))
    )
      // prettier-ignore
      return { w, h, frames, source: v.duration || len };
    frames.length = 0;
    for (let i = 0; i < n; i++) {
      const at = (i * len) / n;
      await new Promise((resolve) => {
        v.addEventListener("seeked", resolve, { once: true });
        v.currentTime = at;
      });
      g.drawImage(v, 0, 0, w, h);
      grab();
      if (i % 12 === 11) onStatus?.(`Reading the video: frame ${i + 1} of ${n}…`);
    }
    return { w, h, frames, source: v.duration || len };
  } finally {
    v.removeAttribute("src");
    v.load();
    URL.revokeObjectURL(url);
  }
}

// Plays v (muted) from the start and calls take() for frame i at (i * len /
// n) seconds, as the frame on show reaches it (a frame the browser skipped
// takes the next one shown). False if it can't play here (the caller seeks
// instead).
export const READ = { lead: 0, slowed: 1 }; // (how the last video read went; tests)
async function playedFrames(v, n, len, take, onStatus) {
  READ.lead = 0;
  READ.slowed = 1;
  v.currentTime = 0;
  await new Promise((r) => v.addEventListener("seeked", r, { once: true }));
  let i = 0;
  const done = new Promise((resolve) => {
    const end = () => {
      if (i === 0) return resolve(false);
      while (i < n) {
        take();
        i++;
      }
      v.pause();
      resolve(true);
    };
    const watchdog = setInterval(() => {
      if (v.paused || v.ended) {
        clearInterval(watchdog);
        end();
      }
    }, 500);
    const half = len / n / 2;
    const step = (_now, meta) => {
      const at = meta.mediaTime;
      // A frame the browser skipped (it couldn't decode that fast): back to
      // it, at half the speed (a phone decodes in hardware and rarely
      // needs this).
      if (i < n && (i * len) / n < at - half && v.playbackRate > 1 / 16) {
        v.playbackRate /= 2;
        READ.slowed = v.playbackRate;
        v.currentTime = (i * len) / n;
        v.requestVideoFrameCallback(step);
        return;
      }
      while (i < n && (i * len) / n <= at + half) {
        READ.lead = Math.max(READ.lead, at - (i * len) / n);
        take();
        i++;
      }
      if (i % 24 < 2) onStatus?.(`Reading the video: frame ${i} of ${n}…`);
      if (i >= n || at >= len) {
        clearInterval(watchdog);
        end();
      } else v.requestVideoFrameCallback(step);
    };
    v.requestVideoFrameCallback(step);
  });
  try {
    await v.play();
  } catch {
    return false;
  }
  return done;
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
// r5 (the owner's "even sharper?" of October 3): the colors are sharpened
// a little (SHARPEN times their difference from their 3 by 3 neighborhood's
// mean), which makes up for the softening of neighboring splats overlapping.
export const SHARPEN = 0.6;
// r6: built for every frame shown, so it is quick: the spans under each
// splat worked out once per size, the grid's own pixels copied when it is
// as fine as the frame, the 3 by 3 mean taken in two passes, and the
// working arrays kept (it took 40 ms or more a frame at max detail on a slow
// machine, which held the clip to a few frames a second). `out` (optional)
// is filled instead of a new array.
const SCRATCH = { key: "", map: null, avg: null, hs: null };
function spans(clip, cols, rows) {
  const key = `${clip.w}x${clip.h}>${cols}x${rows}`;
  if (SCRATCH.key === key) return SCRATCH.map;
  const cut = (i, n, size) => Math.floor((i * size) / n);
  const x0 = new Int32Array(cols);
  const x1 = new Int32Array(cols);
  const xm = new Int32Array(cols);
  for (let i = 0; i < cols; i++) {
    x0[i] = cut(i, cols, clip.w);
    x1[i] = Math.max(x0[i] + 1, cut(i + 1, cols, clip.w));
    xm[i] = Math.min(clip.w - 1, Math.floor(((i + 0.5) / cols) * clip.w));
  }
  const y0 = new Int32Array(rows);
  const y1 = new Int32Array(rows);
  const ym = new Int32Array(rows);
  for (let j = 0; j < rows; j++) {
    y0[j] = cut(j, rows, clip.h);
    y1[j] = Math.max(y0[j] + 1, cut(j + 1, rows, clip.h));
    ym[j] = Math.min(clip.h - 1, Math.floor(((j + 0.5) / rows) * clip.h));
  }
  SCRATCH.key = key;
  SCRATCH.map = { x0, x1, xm, y0, y1, ym, same: cols === clip.w && rows === clip.h };
  SCRATCH.avg = new Float32Array(cols * rows * 3);
  SCRATCH.hs = new Float32Array(cols * rows * 3);
  return SCRATCH.map;
}

export function frameImage(clip, cols, rows, f, sharpen = SHARPEN, out = null) {
  const W = cols * 2;
  const px = out || new Uint8ClampedArray(W * rows * 4);
  const { x0, x1, xm, y0, y1, ym, same } = spans(clip, cols, rows);
  const avg = SCRATCH.avg;
  const hs = SCRATCH.hs;
  const col = clip.colors[f];
  const near = clip.near[f];
  const mean = clip.mean;
  const cw = clip.w;
  for (let j = 0; j < rows; j++) {
    const row = ym[j] * cw;
    for (let i = 0; i < cols; i++) {
      const a = (j * cols + i) * 3;
      if (same) {
        const o = (j * cw + i) * 4;
        avg[a] = col[o];
        avg[a + 1] = col[o + 1];
        avg[a + 2] = col[o + 2];
      } else {
        let r = 0;
        let g = 0;
        let b = 0;
        let n = 0;
        for (let y = y0[j]; y < y1[j]; y++)
          for (let x = x0[i]; x < x1[i]; x++) {
            const o = (y * cw + x) * 4;
            r += col[o];
            g += col[o + 1];
            b += col[o + 2];
            n++;
          }
        avg[a] = r / n;
        avg[a + 1] = g / n;
        avg[a + 2] = b / n;
      }
      const s2 = row + xm[i];
      const q = (j * W + cols + i) * 4;
      px[q] = px[q + 1] = 128;
      px[q + 2] = 255 * (0.5 + (near[s2] / 255 - mean[s2]) / 2) + 0.5;
      px[q + 3] = 255;
    }
  }
  // The 3 by 3 sums, across then down (edges repeat their last cell).
  for (let j = 0; j < rows; j++)
    for (let i = 0; i < cols; i++) {
      const a = (j * cols + i) * 3;
      const l = i > 0 ? a - 3 : a;
      const r = i < cols - 1 ? a + 3 : a;
      hs[a] = avg[l] + avg[a] + avg[r];
      hs[a + 1] = avg[l + 1] + avg[a + 1] + avg[r + 1];
      hs[a + 2] = avg[l + 2] + avg[a + 2] + avg[r + 2];
    }
  const k = sharpen / 9;
  for (let j = 0; j < rows; j++) {
    const up = (j > 0 ? j - 1 : j) * cols * 3;
    const dn = (j < rows - 1 ? j + 1 : j) * cols * 3;
    const at = j * cols * 3;
    for (let i = 0; i < cols; i++) {
      const a = at + i * 3;
      const u = up + i * 3;
      const d = dn + i * 3;
      const o = (j * W + i) * 4;
      px[o] = avg[a] * (1 + sharpen) - k * (hs[u] + hs[a] + hs[d]);
      px[o + 1] = avg[a + 1] * (1 + sharpen) - k * (hs[u + 1] + hs[a + 1] + hs[d + 1]);
      px[o + 2] = avg[a + 2] * (1 + sharpen) - k * (hs[u + 2] + hs[a + 2] + hs[d + 2]);
      px[o + 3] = 255;
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

// The samples. Each is a few seconds of a clip, tiled into `sheets` sheets of `cols` by `rows`
// frames (`frames` in all), each `w` by `h`, at `fps`, with its depth (assets/toys/moving-photo-3d/
// <file>.depth) and, for a video, its sound. tools/live3-depth.mjs makes them (four sheets for the
// bunny, as a decoded picture is at most 2048 pixels on a side). The first, "sample", is the
// original (a link or a saved scene that says `clip: "sample"` keeps meaning the bunny). r5: 640 by
// 360, the scene's own size, shown so on a high or max device and at 480 wide otherwise
// (SAMPLE_SIDES).
const BLENDER = { license: "CC BY 3.0", licenseUrl: "https://creativecommons.org/licenses/by/3.0/", author: "Blender Foundation" }; // prettier-ignore
export const SAMPLES = [
  {
    id: "sample",
    label: "Big Buck Bunny",
    name: "Big Buck Bunny (a six-second scene)",
    file: "bunny",
    sheets: 4,
    cols: 3,
    rows: 5,
    frames: 48,
    w: 640,
    h: 360,
    fps: 8, // prettier-ignore
    title: "Big Buck Bunny (a six-second scene, the sample clip)",
    source: "https://peach.blender.org/",
    ...BLENDER,
    cut: { src: "assets/toys/screen/bunny.mp4", ss: 0, t: 6 },
  },
  {
    id: "horse",
    label: "Galloping horse (1887)",
    file: "horse",
    sheets: 1,
    cols: 3,
    rows: 5,
    frames: 15,
    w: 300,
    h: 200,
    fps: 10, // prettier-ignore
    title: "Race horse galloping (Muybridge, 1887, a GIF)",
    source: "https://commons.wikimedia.org/wiki/File:Muybridge_race_horse_animated.gif",
    author: "Eadweard Muybridge",
    license: "Public domain",
    licenseUrl:
      "https://commons.wikimedia.org/wiki/Commons:Licensing#Material_in_the_public_domain",
    cut: { src: "assets/toys/screen/horse.gif" },
    gif: true,
  },
  {
    id: "dragon",
    label: "Sintel and the dragon",
    file: "sintel",
    sheets: 3,
    cols: 3,
    rows: 7,
    frames: 48,
    w: 640,
    h: 272,
    fps: 8, // prettier-ignore
    title: "Sintel (trailer, six seconds from 0:29.5)",
    source: "https://durian.blender.org/",
    ...BLENDER,
    sound: "sintel.mp3",
    cut: { src: ".cache/smd/sintel_trailer-720p.mp4", ss: 29.5, t: 6, crop: "1280:544:0:88" },
  },
  {
    id: "bridge",
    label: "The bridge and the robot",
    file: "tears",
    sheets: 3,
    cols: 3,
    rows: 6,
    frames: 48,
    w: 640,
    h: 268,
    fps: 8, // prettier-ignore
    title: "Tears of Steel (six seconds from 8:30.5)",
    source: "https://mango.blender.org/",
    ...BLENDER,
    sound: "tears.mp3",
    cut: { src: ".cache/smd/tears_of_steel_720p.mov", ss: 510.5, t: 6 },
  },
  {
    id: "machine",
    label: "Inside the machine",
    file: "elephants",
    sheets: 4,
    cols: 3,
    rows: 5,
    frames: 48,
    w: 640,
    h: 360,
    fps: 8, // prettier-ignore
    title: "Elephants Dream (six seconds from 5:29.7)",
    source: "https://orange.blender.org/",
    author: "Blender Foundation",
    license: "CC BY 2.5",
    licenseUrl: "https://creativecommons.org/licenses/by/2.5/",
    sound: "elephants.mp3",
    cut: { src: ".cache/smd/ed-cut.mp4", ss: 1.65, t: 6 },
  },
];
export const SAMPLE = SAMPLES[0];
export const SAMPLE_SIDES = { low: 480, mid: 480, high: 640, max: 640 };
// The bunny's sound (the Screen toy's files): MP4, or WebM where the browser can't play MP4 (some
// Chromium builds). The others have an MP3 of their own.
const sampleSound = (s) =>
  s.sound
    ? `../../assets/toys/moving-photo-3d/${s.sound}`
    : globalThis.document?.createElement("audio").canPlayType('audio/mp4; codecs="mp4a.40.2"')
      ? "../../assets/toys/screen/bunny.mp4"
      : "../../assets/toys/screen/bunny.webm";

// The sample's sheets (decoded) cut into frames, in order, each `side` pixels wide (scaled down
// from the sheets' own size when smaller).
export function sheetFrames(photos, side = SAMPLE.w, sample = SAMPLE) {
  const { cols, rows, w, h, fps, frames } = sample;
  const tw = Math.min(w, side);
  const th = Math.round((h * tw) / w);
  const out = [];
  for (let photo of [].concat(photos)) {
    if (tw < w && typeof document !== "undefined") photo = scaledSheet(photo, cols * tw, rows * th);
    else if (tw < w) return sheetFrames(photos, w, sample); // (Node: no canvas to scale with)
    for (let f = 0; f < cols * rows && out.length < frames; f++) {
      const x0 = (f % cols) * tw;
      const y0 = Math.floor(f / cols) * th;
      const data = new Uint8ClampedArray(tw * th * 4);
      for (let y = 0; y < th; y++) {
        const o = ((y0 + y) * photo.w + x0) * 4;
        data.set(photo.data.subarray(o, o + tw * 4), y * tw * 4);
      }
      out.push({ data, delay: 1000 / fps });
    }
  }
  return out;
}

function scaledSheet(photo, w, h) {
  const src = document.createElement("canvas");
  src.width = photo.w;
  src.height = photo.h;
  src.getContext("2d").putImageData(new ImageData(new Uint8ClampedArray(photo.data), photo.w, photo.h), 0, 0); // prettier-ignore
  const c = document.createElement("canvas");
  c.width = w;
  c.height = h;
  const g = c.getContext("2d", { willReadFrequently: true });
  g.imageSmoothingQuality = "high";
  g.drawImage(src, 0, 0, w, h);
  return { w, h, data: g.getImageData(0, 0, w, h).data };
}

export async function loadSample(id = "sample") {
  const s = SAMPLES.find((x) => x.id === id) || SAMPLE;
  if (MOVING.samples.has(s.id)) return MOVING.samples.get(s.id);
  const { decodePhoto, unpackDepth } = await import("./photo-3d.js");
  const sheets = await Promise.all(Array.from({ length: s.sheets }, (_, i) => readBytes(`../../assets/toys/moving-photo-3d/${s.file}-sheet-${i + 1}.jpg`).then(decodePhoto))); // prettier-ignore
  const dep = await readBytes(`../../assets/toys/moving-photo-3d/${s.file}.depth`);
  // (Node, building toys for the tests, has no canvas to scale with.)
  const w = typeof document === "undefined" ? s.w : Math.min(s.w, SAMPLE_SIDES[profile()] || SAMPLE_SIDES.mid); // prettier-ignore
  const h = Math.round((s.h * w) / s.w);
  const frames = sheetFrames(sheets, w, s);
  const raw = unpackDepths(dep, unpackDepth);
  const clip = makeClip(s.name || s.title, w, h, frames, normalizeDepths(raw, w, h));
  clip.sample = s.id;
  clip.audio = typeof Audio === "undefined" || s.gif ? null : await soundOf(new URL(sampleSound(s), import.meta.url).href, false); // prettier-ignore
  MOVING.samples.set(s.id, clip);
  return clip;
}

// r6: the clip's frames and length, and the source's own length when the
// clip is its first MAX_SECONDS.
export function clipLine(c) {
  const fps = Math.round(c.n / c.duration);
  const of = c.source > c.duration + 0.05 ? ` of ${c.source.toFixed(1)} s` : "";
  return `${c.name}: ${c.duration.toFixed(1)} s${of}, ${c.n} frames (${fps} a second)`;
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

// Smd: the Toy tab's Speed slider (0 to 1, the middle is the clip's own speed) sets how fast the
// clip plays, as it does the turntable on other toys: 0.25 to 1.75 times, its sound with it.
export const speedRate = (speed) => 0.25 + 1.5 * Math.min(1, Math.max(0, speed ?? 0.5));
const clipRate = () => speedRate(globalThis.window?.__splashery?.player?.scene?.motion?.speed);

// r6 (the owner's note of October 3: after a pause the sound didn't come
// back): one clock for the frames and the sound. Whether the clip plays is
// the play control's target, set at once by a tap or the transport (its
// eased value lagged a tap by a fifth of a second, and the drive paused the
// sound the tap had just started, then tried to restart it outside the
// tap, which a phone refuses). Pausing keeps the place; playing starts the
// sound from that place, inside the tap.
const playTarget = () => (globalThis.window?.__splashery?.player?.motion?.targets?.play ?? 1) > 0.5; // prettier-ignore
function soundTo(on) {
  const t = track();
  MOVING.anchor = null;
  if (!t) return;
  if (on && !t.playing) {
    if (Math.abs(t.el.currentTime - MOVING.t) > 0.03) t.el.currentTime = MOVING.t;
    t.play(MOVING.sound);
  } else if (!on && t.playing) {
    MOVING.t = Math.min(MOVING.clip?.duration ?? Infinity, t.time());
    t.pause();
  }
}

// Plays or pauses the clip, its sound with it (from a tap, so a phone lets
// the sound start).
function playClip(on) {
  soundTo(on);
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
    MOVING.anchor = null;
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

// Studio media: "Show the original": the clip's own flat frames in a corner card (src/compare.js,
// loaded only when it is switched on), the frame the 3D one shows.
function showOriginal(clip) {
  if (typeof document === "undefined") return;
  const mod = MOVING.compare;
  if (!MOVING.original) {
    if (mod?.original) mod.original("moving-photo-3d").hide();
    MOVING.cardClip = null;
    return;
  }
  if (!mod) {
    MOVING.compare = false;
    import("../compare.js").then((m) => (MOVING.compare = m));
    return;
  }
  if (!mod.original) return;
  const card = mod.original("moving-photo-3d");
  if (MOVING.cardClip !== clip || !card.state.kind) {
    MOVING.cardClip = clip;
    card.frames({ w: clip.w, h: clip.h, frame: (i) => clip.colors[i], label: `Original: ${clip.name}` }); // prettier-ignore
  }
  card.sync({ frame: MOVING.frame });
}

export const MOVING_PHOTO = {
  alive: (c) => (c.play ?? 1) > 0.5 && !!MOVING.clip,
  density: 1.25, // r6: a quarter more splats than most, for a finer picture (see the top)
  turntable: false,
  options: [
    { key: "depth", label: "Depth", type: "slider", min: 0, max: 1, step: 0.05, default: 0.6 },
    {
      key: "clip",
      label: "Clip",
      type: "select",
      default: "sample",
      choices: [
        ...SAMPLES.map((s) => ({ id: s.id, label: s.label })),
        { id: "custom", label: "Your clip (open one below)" },
      ],
    },
    {
      key: "original",
      label: "Show the original",
      type: "select",
      default: "off",
      choices: [
        { id: "off", label: "Off" },
        { id: "on", label: "On: the flat clip in a corner, in step" },
      ],
    },
    { key: "clipName", label: "Clip name", type: "text", default: "", hidden: true },
  ],
  controls: [{ key: "play", label: "Play", type: "toggle", default: 1, ease: 0.2 }],
  action: {
    key: "play",
    label: "Play or pause the clip",
    quiet: ["play"],
    // r5: the sound starts or stops inside the tap itself (a phone wants that).
    onAct() {
      // The tap turns playing off if it was on, else on (the control's
      // target flips right after this).
      soundTo(!playTarget());
    },
  },
  input: {
    title: "Your GIF or video",
    accept: "image/gif,.gif,video/*,.mp4,.webm,.mov,.m4v",
    binary: true,
    maxBytes: 200e6,
    fileButton: "Open a GIF or video…",
    note: `Open a GIF or a short video. Its first ${MAX_SECONDS} seconds are read on this device, at its own speed and up to ${CLIP_FPS.high} frames a second (fewer on a phone), the depth model (about 27 MB, loaded the first time) works out how near each part of every frame is, and the clip plays back in 3D, a video with its own sound. Nothing is uploaded. Tap to pause or play.`, // prettier-ignore
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
    shown: () => MOVING.status || (MOVING.clip ? clipLine(MOVING.clip) : ""),
  },
  credits: SAMPLES.map((s) => ({
    label: s.label,
    title: s.title,
    source: s.source,
    author: s.author,
    license: s.license,
    licenseUrl: s.licenseUrl,
  })),
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
      const size = cols * 2 * rows * 4;
      if (MOVING.px?.length !== size) MOVING.px = new Uint8ClampedArray(size);
      g.putImageData(new ImageData(frameImage(clip, cols, rows, MOVING.frame, SHARPEN, MOVING.px), cols * 2, rows), 0, 0); // prettier-ignore
    },
  },
  async prepare(o) {
    MOVING.want = o.clip === "custom" && MOVING.custom ? MOVING.custom : await loadSample(o.clip === "custom" ? "sample" : o.clip); // prettier-ignore
  },
  drive(t, c, out, info) {
    const time = info?.time ?? t;
    MOVING.last = time;
    if (info?.sound) MOVING.sound = info.sound;
    const clip = MOVING.clip;
    if (!clip) return;
    // r6: the control's target, not its eased value (see playTarget).
    const on = globalThis.window?.__splashery?.player?.motion ? playTarget() : (c.play ?? 1) > 0.5;
    const tr = track();
    const rate = clipRate();
    if (tr) tr.el.playbackRate = rate;
    if (!on) {
      if (tr?.playing) soundTo(false);
      MOVING.anchor = null;
    } else if (tr?.playing) {
      // r5: the frames follow the sound's clock (looping at the clip's end).
      if (tr.time() >= clip.duration - 0.02) {
        tr.el.currentTime = 0;
        tr.anchor = null;
        MOVING.t = 0;
      } else MOVING.t = tr.time();
      MOVING.anchor = null;
    } else {
      // Silent (a GIF, or a browser that wants a tap before sound): real
      // time, so the clip keeps its speed however few frames are drawn (r6:
      // it stepped at most a quarter second a frame, and the player's own
      // clock steps at most a tenth, the engine's cap, so a device drawing
      // four frames a second played a GIF at half speed). In Node (the
      // tests' builds) it is the player's clock, as before.
      const pl = globalThis.window?.__splashery?.player;
      // (tools/live-clip.mjs steps a clock of its own, __clipT.)
      const now = pl ? (globalThis.window.__clipT ?? performance.now() / 1000) : time;
      if (pl?.frozen) MOVING.anchor = null;
      else {
        if (!MOVING.anchor || now < MOVING.anchor.at || MOVING.anchor.rate !== rate) MOVING.anchor = { t: MOVING.t, at: now, rate }; // prettier-ignore
        MOVING.t = (MOVING.anchor.t + (now - MOVING.anchor.at) * rate) % clip.duration;
      }
      if (tr && !tr.blocked && !tr.el.ended) {
        tr.el.currentTime = MOVING.t;
        tr.play(MOVING.sound);
      }
    }
    MOVING.frame = frameAt(clip, MOVING.t);
    showOriginal(clip);
  },
  build(k, o) {
    MOVING.original = o.original === "on";
    const clip = MOVING.want;
    if (MOVING.clip !== clip) {
      if (MOVING.clip?.audio) MOVING.clip.audio.track.pause();
      MOVING.t = 0;
    }
    MOVING.clip = clip;
    MOVING.last = null;
    MOVING.anchor = null;
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
