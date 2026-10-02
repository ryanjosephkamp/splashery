// Moving photo to 3D (lane Live input r3, the owner's idea of October 2,
// 2026): a GIF or a short video played back in 3D, the way the splat
// mirror shows the live camera. Each frame's depth comes from the same
// vendored depth model (Depth Anything V2 Small, in src/live/depth-worker.js),
// worked out on this device when the file is opened; nothing is uploaded.
// The sample, six seconds of Big Buck Bunny (the bunny and the butterfly,
// CC BY 3.0, the Screen toy's clip), ships as a sheet of 48 frames with
// their depth worked out ahead (tools/live3-depth.mjs), so it needs no model.
//
// What it takes, kept modest for a phone (the brief's "say what you chose"):
//   - up to MAX_FRAMES (48) frames: a GIF's own frames (evenly thinned if it
//     has more), or a video's first MAX_SECONDS (8 s) at up to 12 a second;
//   - each frame CLIP_SIDE (256) pixels on its long side, so about 37,000
//     splats for a 16:9 clip;
//   - the depth model sees DEPTH_SIDE (196) pixels on the long side.
//
// The picture is a grid of relief splats (src/live/relief.js) whose canvas
// holds the frame's colors and depth. Each splat rests at its average depth
// over the clip and moves from there by a signed offset (relief axis 3), so
// the splats sort the way they show (the mirror's flashing, fixed in r3).

export const MAX_FRAMES = 48;
export const MAX_SECONDS = 8;
export const CLIP_SIDE = 256;
export const DEPTH_SIDE = 196;
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

const sizeFor = (w, h, side) => {
  const s = side / Math.max(w, h);
  return { w: Math.max(2, Math.round(w * s)), h: Math.max(2, Math.round(h * s)) };
};
const modelSize = (w, h) => {
  const s = DEPTH_SIDE / Math.max(w, h);
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
        const v = d.d[Math.min(d.h - 1, Math.floor(((y + 0.5) / h) * d.h)) * d.w + Math.min(d.w - 1, Math.floor(((x + 0.5) / w) * d.w))]; // prettier-ignore
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
export async function depthOf(frames, w, h, onStatus) {
  const worker = new Worker(new URL("../live/depth-worker.js", import.meta.url), { type: "module" }); // prettier-ignore
  const ms = modelSize(w, h);
  const out = [];
  try {
    for (let i = 0; i < frames.length; i++) {
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
      onStatus?.(`Working out the depth: frame ${i + 1} of ${frames.length}…`);
    }
  } finally {
    worker.terminate();
  }
  return out;
}

// A clip: { name, n, w, h, delays (ms), colors (RGBA per frame, w by h),
// near (0..1 per frame), mean (each pixel's average nearness) }.
export function makeClip(name, w, h, frames, near) {
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
  const isGif = /\.gif$/i.test(name) || file.type === "image/gif";
  if (isGif) {
    onStatus?.("Reading the GIF…");
    let g;
    try {
      g = await gifFrames(new Uint8Array(await file.arrayBuffer()));
    } catch {
      throw new Error("That GIF couldn't be read. Try another GIF, or an MP4 or WebM video.");
    }
    ({ w, h } = sizeFor(g.w, g.h, CLIP_SIDE));
    frames = thin(g.frames).map((f) => ({ data: shrink(f.data, g.w, g.h, w, h), delay: f.delay }));
  } else {
    onStatus?.("Reading the video…");
    ({ w, h, frames } = await videoFrames(file));
  }
  if (frames.length < 2) throw new Error("That file has only one picture. Open a GIF or a video that moves."); // prettier-ignore
  const raw = await depthOf(frames, w, h, onStatus);
  return makeClip(name, w, h, frames, normalizeDepths(raw, w, h));
}

// A video's first MAX_SECONDS, at up to 12 frames a second (at most
// MAX_FRAMES), each drawn after a seek.
async function videoFrames(file) {
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
    const { w, h } = sizeFor(v.videoWidth, v.videoHeight, CLIP_SIDE);
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
export function frameImages(clip, cols, rows) {
  const map = new Int32Array(cols * rows);
  for (let j = 0; j < rows; j++)
    for (let i = 0; i < cols; i++)
      map[j * cols + i] = Math.min(clip.h - 1, Math.floor(((j + 0.5) / rows) * clip.h)) * clip.w + Math.min(clip.w - 1, Math.floor(((i + 0.5) / cols) * clip.w)); // prettier-ignore
  const W = cols * 2;
  return clip.colors.map((col, f) => {
    const px = new Uint8ClampedArray(W * rows * 4);
    const near = clip.near[f];
    for (let j = 0; j < rows; j++)
      for (let i = 0; i < cols; i++) {
        const s = map[j * cols + i];
        const o = (j * W + i) * 4;
        px[o] = col[s * 4];
        px[o + 1] = col[s * 4 + 1];
        px[o + 2] = col[s * 4 + 2];
        px[o + 3] = 255;
        const q = (j * W + cols + i) * 4;
        px[q] = px[q + 1] = 128;
        px[q + 2] = Math.round(255 * (0.5 + (near[s] - clip.mean[s]) / 2));
        px[q + 3] = 255;
      }
    return px;
  });
}

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

// The sample's sheet: SAMPLE.cols by SAMPLE.rows frames, each SAMPLE.w by
// SAMPLE.h, at SAMPLE.fps (tools/live3-depth.mjs makes it).
export const SAMPLE = { cols: 8, rows: 6, w: 256, h: 144, fps: 8 };

// The sheet (decoded) cut into frames.
export function sheetFrames(photo) {
  const { cols, rows, w, h, fps } = SAMPLE;
  const out = [];
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
  const [jpg, dep, { decodePhoto, unpackDepth }] = await Promise.all([
    readBytes("../../assets/toys/moving-photo-3d/bunny-frames.jpg"),
    readBytes("../../assets/toys/moving-photo-3d/bunny.depth"),
    import("./photo-3d.js"),
  ]);
  const frames = sheetFrames(await decodePhoto(jpg));
  const raw = unpackDepths(dep, unpackDepth);
  MOVING.sample = makeClip("Big Buck Bunny (a six-second scene)", SAMPLE.w, SAMPLE.h, frames, normalizeDepths(raw, SAMPLE.w, SAMPLE.h)); // prettier-ignore
  return MOVING.sample;
}

function setShown(text) {
  MOVING.status = text;
  if (typeof document === "undefined") return;
  const el = document.querySelector("#toy-input .input-shown");
  if (!el) return;
  el.textContent = text;
  el.hidden = !text;
}

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
  action: { key: "play", label: "Play or pause the clip", quiet: ["play"] },
  input: {
    title: "Your GIF or video",
    accept: "image/gif,.gif,video/*,.mp4,.webm,.mov,.m4v",
    binary: true,
    maxBytes: 200e6,
    fileButton: "Open a GIF or video…",
    note: `Open a GIF or a short video. Its first ${MAX_SECONDS} seconds (up to ${MAX_FRAMES} frames) are read on this device, the depth model (about 27 MB, loaded the first time) works out how near each part of every frame is, and the clip plays back in 3D. Nothing is uploaded. Tap to pause or play.`, // prettier-ignore
    async read(_text, fileName, file) {
      if (!file) throw new Error("Open a GIF or a video.");
      const clip = await openClip(file, fileName.replace(/\.[^.]+$/, ""), setShown);
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
    version: () => `${MOVING.clip?.name}|${MOVING.frame}|${MOVING.images ? 1 : 0}`,
    draw(g) {
      const img = MOVING.images?.[MOVING.frame];
      if (!img) return;
      const { cols, rows } = MOVING.grid;
      g.putImageData(new ImageData(img, cols * 2, rows), 0, 0);
    },
  },
  async prepare(o) {
    MOVING.want = o.clip === "custom" && MOVING.custom ? MOVING.custom : await loadSample();
  },
  drive(t, c, out, info) {
    const time = info?.time ?? t;
    const dt = MOVING.last === null ? 0 : Math.max(0, Math.min(0.25, time - MOVING.last));
    MOVING.last = time;
    if (!MOVING.clip) return;
    if ((c.play ?? 1) > 0.5) MOVING.t += dt;
    MOVING.frame = frameAt(MOVING.clip, MOVING.t);
  },
  build(k, o) {
    const clip = MOVING.want;
    if (MOVING.clip !== clip) MOVING.t = 0;
    MOVING.clip = clip;
    MOVING.last = null;
    const { cols, rows } = clipGrid(clip, k.count);
    MOVING.grid = { cols, rows };
    MOVING.images = typeof ImageData === "undefined" ? null : frameImages(clip, cols, rows);
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
        items.push({ p: [(u - 0.5) * width, (0.5 - v) * height, full * mean(u, v)], n: [0, 0, 1], size: ((width / cols) * 1.3) / 0.01, flat: 0.08, opacity: 1, color: "#808080", kind: "relief", params: [u, v, 3, Math.max(0.001, full)], pattern: false }); // prettier-ignore
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
