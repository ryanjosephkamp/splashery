// Live input (lane Live input): live pictures as relief splats (kind
// "relief", src/effects.js). A recipe builds a grid of relief splats once
// (reliefGrid) and draws, on every frame, a canvas twice as wide as the
// grid: the colors on the left half and the heights (red, 0..255) on the
// right. The canvas is the recipe's screen (recipe.screen), which the
// player uploads when its version changes, and the splats take their
// color and lift from it on the GPU. So a picture moves without a rebuild.
//
//   reliefGrid(k, opts)          the splats (the song landscape's waterfall,
//                                the mirror's picture)
//   new CameraDepth(video, opts) a camera's frames and, from the depth model
//                                in a worker, how near each part is
//   drawStill(g, …)              a photo and its depth map, for a toy's
//                                picture before the camera is on

// A grid of cols x rows relief splats. at(u, v) gives each one's place at
// rest (u and v 0..1, the texel centers), `axis` (0 x, 1 y, 2 z) and `lift`
// (recipe units at full height) where it rises to. `layers` > 1 adds
// splats lower down each column, lifted less, so a tall ridge reads as a
// wall from the side. `size` is a splat's diameter in recipe units.
export function reliefGrid(
  k,
  {
    cols,
    rows,
    at,
    axis,
    lift,
    n = [0, 0, 1],
    size,
    layers = 1,
    part = 0,
    flat = 0.08,
    opacity = 1,
  },
) {
  // prettier-ignore
  const items = [];
  for (let j = 0; j < rows; j++)
    for (let i = 0; i < cols; i++) {
      const u = (i + 0.5) / cols;
      const v = (j + 0.5) / rows;
      const p = at(u, v);
      for (let l = 0; l < layers; l++) {
        const f = 1 - l / layers;
        items.push({
          p,
          n: l === 0 ? n : [0, 0, 1],
          size: (size * (l === 0 ? 1.45 : 1.2)) / 0.01,
          flat,
          opacity,
          color: "#808080",
          kind: "relief",
          params: [u, v, axis, lift * f],
          part,
          pattern: false,
        });
      }
    }
  k.cloud({ share: items.length / k.count, pattern: false }, (rand, i) => items[i] || null);
  return items.length;
}

// A canvas for a grid: 2 * cols by rows.
export function reliefCanvas(cols, rows) {
  const c = document.createElement("canvas");
  c.width = cols * 2;
  c.height = rows;
  return c;
}

// Draws a photo ({ w, h, data }) and its depth ({ w, h, d }, higher nearer)
// into a grid's canvas, the depth scaled by `gain` (0 flat .. 1).
export function drawStill(g, cols, rows, photo, depth, { gain = 1, mirror = false } = {}) {
  const img = g.createImageData(cols * 2, rows);
  const px = img.data;
  let lo = Infinity;
  let hi = -Infinity;
  for (const v of depth.d) {
    if (v < lo) lo = v;
    if (v > hi) hi = v;
  }
  const span = hi > lo ? hi - lo : 1;
  for (let j = 0; j < rows; j++)
    for (let i = 0; i < cols; i++) {
      const u = mirror ? 1 - (i + 0.5) / cols : (i + 0.5) / cols;
      const v = (j + 0.5) / rows;
      const sx = Math.min(photo.w - 1, Math.floor(u * photo.w));
      const sy = Math.min(photo.h - 1, Math.floor(v * photo.h));
      const s = (sy * photo.w + sx) * 4;
      const o = (j * cols * 2 + i) * 4;
      px[o] = photo.data[s];
      px[o + 1] = photo.data[s + 1];
      px[o + 2] = photo.data[s + 2];
      px[o + 3] = 255;
      const dx = Math.min(depth.w - 1, Math.floor(u * depth.w));
      const dy = Math.min(depth.h - 1, Math.floor(v * depth.h));
      const h = ((depth.d[dy * depth.w + dx] - lo) / span) * gain;
      const q = (j * cols * 2 + cols + i) * 4;
      px[q] = Math.round(255 * Math.max(0, Math.min(1, h)));
      px[q + 1] = 0;
      px[q + 2] = 0;
      px[q + 3] = 255;
    }
  g.putImageData(img, 0, 0);
}

// The long side the depth model sees, per device tier: smaller is faster.
export const DEPTH_SIDE = { low: 140, mid: 196, high: 252, max: 308 };

// A camera's live picture with depth. Each draw() puts the newest frame's
// colors (mirrored, like a mirror) on the left half of a grid's canvas and
// the depth on the right. The depth model runs in a worker
// (src/live/depth-worker.js), one frame at a time: whenever it is free it
// is given the frame of that moment, so the depth follows the camera as
// fast as the device allows; between answers the heights ease toward the
// newest depth. The depth is scaled by its own 2nd and 98th percentiles,
// eased too, so a person stepping nearer doesn't make the room flicker.
export class CameraDepth {
  constructor(video, { cols, rows, tier = "mid", mirror = true, depth = true } = {}) {
    this.video = video;
    this.cols = cols;
    this.rows = rows;
    this.mirror = mirror;
    this.side = DEPTH_SIDE[tier] || DEPTH_SIDE.mid;
    this.small = document.createElement("canvas");
    this.small.width = cols;
    this.small.height = rows;
    this.sg = this.small.getContext("2d", { willReadFrequently: true });
    this.heights = new Float32Array(cols * rows); // eased, 0..1
    this.target = new Float32Array(cols * rows);
    this.have = false; // any depth yet
    this.lo = null;
    this.hi = null;
    this.busy = false;
    this.status = depth ? "Starting the depth model…" : "";
    this.ms = 0;
    this.answers = 0;
    this.last = 0;
    this.worker = null;
    this.id = 0;
    this.crop = [0, 0, 1, 1]; // the part of the frame the grid shows (fractions)
    if (depth) this.startWorker();
  }

  startWorker() {
    this.worker = new Worker(new URL("./depth-worker.js", import.meta.url), { type: "module" });
    this.worker.onmessage = (e) => this.onAnswer(e.data);
    this.worker.onerror = () => {
      this.status = "The depth model couldn't start in this browser; the picture stays flat.";
      this.busy = false;
    };
  }

  // Sends the frame of this moment to the worker, if it is free.
  ask() {
    const v = this.video;
    if (!this.worker || this.busy || !v?.videoWidth) return;
    const s = this.side / Math.max(v.videoWidth, v.videoHeight);
    const m = (x) => Math.max(14, Math.round((x * s) / 14) * 14);
    const w = m(v.videoWidth);
    const h = m(v.videoHeight);
    this.frameCanvas ||= document.createElement("canvas");
    const c = this.frameCanvas;
    c.width = w;
    c.height = h;
    const g = c.getContext("2d", { willReadFrequently: true });
    g.drawImage(v, 0, 0, w, h);
    const data = g.getImageData(0, 0, w, h).data;
    this.busy = true;
    this.worker.postMessage({ type: "frame", id: ++this.id, w, h, data }, [data.buffer]);
  }

  onAnswer(m) {
    if (m.type === "status") {
      this.status = m.text;
      return;
    }
    this.busy = false;
    if (m.type === "error") {
      this.status = "The depth model stopped; the picture stays flat.";
      return;
    }
    if (m.type !== "depth") return;
    this.ms = m.ms;
    this.answers++;
    this.status = "";
    // Resample to the grid (mirrored with the picture) and find the range.
    const { cols, rows } = this;
    const t = this.target;
    for (let j = 0; j < rows; j++)
      for (let i = 0; i < cols; i++) {
        const u = this.mirror ? 1 - (i + 0.5) / cols : (i + 0.5) / cols;
        const [cx, cy, cw, ch] = this.crop;
        const sx = Math.min(m.w - 1, Math.floor((cx + u * cw) * m.w));
        const sy = Math.min(m.h - 1, Math.floor((cy + ((j + 0.5) / rows) * ch) * m.h));
        t[j * cols + i] = m.d[sy * m.w + sx];
      }
    const sorted = Float32Array.from(t).sort();
    const lo = sorted[Math.floor(sorted.length * 0.02)];
    const hi = sorted[Math.floor(sorted.length * 0.98)];
    this.lo = this.lo === null ? lo : this.lo + (lo - this.lo) * 0.3;
    this.hi = this.hi === null ? hi : this.hi + (hi - this.hi) * 0.3;
    const span = Math.max(1e-6, this.hi - this.lo);
    for (let i = 0; i < t.length; i++) t[i] = Math.max(0, Math.min(1, (t[i] - this.lo) / span));
    if (!this.have) this.heights.set(t);
    this.have = true;
  }

  // Draws the frame now (and eases the heights) into g, a grid's canvas.
  // gain scales the depth (0 flat .. 1). dt is the time since the last draw.
  draw(g, { gain = 1, dt = 1 / 60 } = {}) {
    const v = this.video;
    const { cols, rows } = this;
    if (!v?.videoWidth) return false;
    this.ask();
    const sg = this.sg;
    sg.save();
    if (this.mirror) {
      sg.translate(cols, 0);
      sg.scale(-1, 1);
    }
    // The frame, center-cropped to the grid's shape.
    const a = cols / rows;
    const va = v.videoWidth / v.videoHeight;
    let sw = v.videoWidth;
    let sh = v.videoHeight;
    if (va > a) sw = sh * a;
    else sh = sw / a;
    this.crop = [(1 - sw / v.videoWidth) / 2, (1 - sh / v.videoHeight) / 2, sw / v.videoWidth, sh / v.videoHeight]; // prettier-ignore
    sg.drawImage(v, (v.videoWidth - sw) / 2, (v.videoHeight - sh) / 2, sw, sh, 0, 0, cols, rows);
    sg.restore();
    g.drawImage(this.small, 0, 0);
    // Heights ease toward the newest depth (about a fifth of a second).
    const k = 1 - Math.exp(-dt / 0.12);
    const hts = this.heights;
    const t = this.target;
    const img = g.createImageData(cols, rows);
    const px = img.data;
    for (let i = 0; i < hts.length; i++) {
      if (this.have) hts[i] += (t[i] - hts[i]) * k;
      const o = i * 4;
      px[o] = Math.round(255 * (this.have ? hts[i] * gain : 0));
      px[o + 3] = 255;
    }
    g.putImageData(img, cols, 0);
    return true;
  }

  close() {
    this.worker?.terminate();
    this.worker = null;
  }
}
