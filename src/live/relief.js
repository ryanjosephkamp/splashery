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

import { live } from "./live.js";

// A grid of cols x rows relief splats. at(u, v) gives each one's place at
// rest (u and v 0..1, the texel centers), `axis` (0 x, 1 y, 2 z) and `lift`
// (recipe units at full height) where it rises to. `layers` > 1 adds
// splats lower down each column, lifted less, so a tall ridge reads as a
// wall from the side. `size` is a splat's diameter in recipe units. `v0`
// and `vs` place the grid's rows in part of the canvas (the mirror's
// background layer sits in its lower half, r5).
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
    v0 = 0,
    vs = 1,
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
          params: [u, v0 + v * vs, axis, lift * f],
          part,
          pattern: false,
        });
      }
    }
  // Exact sizes and colors (no jitter), so a live picture stays crisp.
  k.cloud(
    { share: items.length / k.count, pattern: false, jitter: 0 },
    (rand, i) => items[i] || null,
  );
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
  constructor(video, { cols, rows, tier = "mid", mirror = true, depth = true, back = null } = {}) {
    this.video = video;
    // r5: the background layer ({ cols, rows }, coarser than the picture),
    // drawn in the canvas's lower half.
    this.back = back ? new BackPlate(back.cols, back.rows) : null;
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
    // r5: the background layer learns the wall from this same frame, when
    // its depth comes back (the colors of a later frame wouldn't match it).
    if (this.back) this.sent = { w, h, data: data.slice(), crop: this.crop.slice() };
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
        // r5: bilinear (the depth is smaller than the grid; nearest
        // sampling left its edges in steps).
        const fx = Math.max(0, Math.min(m.w - 1, (cx + u * cw) * m.w - 0.5));
        const fy = Math.max(0, Math.min(m.h - 1, (cy + ((j + 0.5) / rows) * ch) * m.h - 0.5));
        const x0 = Math.floor(fx);
        const y0 = Math.floor(fy);
        const x1 = Math.min(m.w - 1, x0 + 1);
        const y1 = Math.min(m.h - 1, y0 + 1);
        const ax = fx - x0;
        const ay = fy - y0;
        const top = m.d[y0 * m.w + x0] * (1 - ax) + m.d[y0 * m.w + x1] * ax;
        const bot = m.d[y1 * m.w + x0] * (1 - ax) + m.d[y1 * m.w + x1] * ax;
        t[j * cols + i] = top * (1 - ay) + bot * ay;
      }
    const sorted = Float32Array.from(t).sort();
    const lo = sorted[Math.floor(sorted.length * 0.02)];
    const hi = sorted[Math.floor(sorted.length * 0.98)];
    this.lo = this.lo === null ? lo : this.lo + (lo - this.lo) * 0.3;
    this.hi = this.hi === null ? hi : this.hi + (hi - this.hi) * 0.3;
    const span = Math.max(1e-6, this.hi - this.lo);
    for (let i = 0; i < t.length; i++) t[i] = Math.max(0, Math.min(1, (t[i] - this.lo) / span));
    // r5: where a near person stands before a far wall, the depth ramps
    // across a few cells, and those cells hung as stretched splats between
    // the two (the owner's "detaching" of October 3): each goes with the near
    // or the far side, whichever it is closer to.
    t.set(snapEdges(t, cols, rows));
    if (this.back && this.sent) this.back.learn(this.sent, t, cols, rows, this.mirror);
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
      // r5: a big jump (a person's edge moving) cuts over at once, so no
      // splat glides through the gap between near and far; small changes
      // ease, which keeps the depth from shimmering.
      if (this.have) hts[i] = Math.abs(t[i] - hts[i]) > 0.3 ? t[i] : hts[i] + (t[i] - hts[i]) * k;
      const o = i * 4;
      px[o] = Math.round(255 * (this.have ? hts[i] * gain : 0));
      px[o + 3] = 255;
    }
    g.putImageData(img, cols, 0);
    if (this.back) this.back.draw(g, cols, rows, gain);
    return true;
  }

  close() {
    this.worker?.terminate();
    this.worker = null;
  }
}

// ---- The background behind a person (r5) -------------------------------------------------
// Seen from the side, the wall behind a near person is a hole: one camera
// can't see it. The background layer is a coarser grid of splats just
// behind the picture, showing the wall only: each of its cells remembers
// the colors and depth of the wall from whenever it was last seen (a cell
// is wall where the depth is far), and the cells a person has always
// covered are filled from the wall around them (fillHoles), never from the
// person's own colors, so no second copy of them shows behind.
const FAR = 0.35; // a cell is wall below this (0 far .. 1 near)
export class BackPlate {
  constructor(cols, rows) {
    this.cols = cols;
    this.rows = rows;
    const n = cols * rows;
    this.col = new Float32Array(n * 3); // remembered wall colors (0..255)
    this.dep = new Float32Array(n); // and its depth (0..1)
    this.seen = new Float32Array(n); // 1 where the wall has been seen
    this.vals = new Float32Array(n * 4); // filled: r, g, b, depth
    this.img = null;
  }

  // Learns the wall from a frame the depth model saw (frame: { w, h, data,
  // crop }) and that frame's depth on the picture's grid (d, cols x rows,
  // 0 far .. 1 near): a cell is wall where all of its depth, and its
  // neighbors', is far (so a person's soft edge isn't taken for wall).
  learn(frame, d, cols, rows, mirror) {
    const { cols: bc, rows: br, col, dep, seen, vals } = this;
    const near = new Uint8Array(bc * br);
    const mean = new Float32Array(bc * br);
    for (let y = 0; y < br; y++)
      for (let x = 0; x < bc; x++) {
        const x0 = Math.floor((x * cols) / bc);
        const x1 = Math.max(x0 + 1, Math.floor(((x + 1) * cols) / bc));
        const y0 = Math.floor((y * rows) / br);
        const y1 = Math.max(y0 + 1, Math.floor(((y + 1) * rows) / br));
        let top = 0;
        let sum = 0;
        let m = 0;
        for (let j = y0; j < Math.min(rows, y1); j++)
          for (let i = x0; i < Math.min(cols, x1); i++) {
            const v = d[j * cols + i];
            if (v > top) top = v;
            sum += v;
            m++;
          }
        near[y * bc + x] = top >= FAR ? 1 : 0;
        mean[y * bc + x] = sum / m;
      }
    const [cx, cy, cw, ch] = frame.crop;
    for (let y = 0; y < br; y++)
      for (let x = 0; x < bc; x++) {
        const c = y * bc + x;
        let edge = false;
        for (let j = Math.max(0, y - 1); j <= Math.min(br - 1, y + 1) && !edge; j++)
          for (let i = Math.max(0, x - 1); i <= Math.min(bc - 1, x + 1); i++)
            if (near[j * bc + i]) edge = true;
        if (edge) continue;
        // The cell's colors: the frame's pixels under it (mirrored with the
        // picture, in the same crop).
        const ua = mirror ? 1 - (x + 1) / bc : x / bc;
        const ub = mirror ? 1 - x / bc : (x + 1) / bc;
        const fx0 = Math.floor((cx + ua * cw) * frame.w);
        const fx1 = Math.max(fx0 + 1, Math.floor((cx + ub * cw) * frame.w));
        const fy0 = Math.floor((cy + (y / br) * ch) * frame.h);
        const fy1 = Math.max(fy0 + 1, Math.floor((cy + ((y + 1) / br) * ch) * frame.h));
        let r = 0;
        let g = 0;
        let b = 0;
        let m = 0;
        for (let j = fy0; j < Math.min(frame.h, fy1); j++)
          for (let i = fx0; i < Math.min(frame.w, fx1); i++) {
            const o = (j * frame.w + i) * 4;
            r += frame.data[o];
            g += frame.data[o + 1];
            b += frame.data[o + 2];
            m++;
          }
        if (!m) continue;
        const k = seen[c] ? 0.5 : 1;
        col[c * 3] += (r / m - col[c * 3]) * k;
        col[c * 3 + 1] += (g / m - col[c * 3 + 1]) * k;
        col[c * 3 + 2] += (b / m - col[c * 3 + 2]) * k;
        dep[c] = mean[c];
        seen[c] = 1;
      }
    for (let c = 0; c < bc * br; c++) {
      vals[c * 4] = col[c * 3];
      vals[c * 4 + 1] = col[c * 3 + 1];
      vals[c * 4 + 2] = col[c * 3 + 2];
      vals[c * 4 + 3] = dep[c];
    }
    fillHoles(vals, seen, bc, br, 4);
  }

  // Into the canvas's lower half: the colors on the left, the heights (a
  // hair lower than the wall's, so the picture's own wall stays in front)
  // on the right.
  draw(g, cols, rows, gain) {
    const { cols: bc, rows: br, vals } = this;
    if (!this.img || this.img.width !== cols * 2 || this.img.height !== rows) this.img = g.createImageData(cols * 2, rows); // prettier-ignore
    const px = this.img.data;
    for (let j = 0; j < rows; j++) {
      const y = Math.min(br - 1, Math.floor((j * br) / rows));
      for (let i = 0; i < cols; i++) {
        const c = (y * bc + Math.min(bc - 1, Math.floor((i * bc) / cols))) * 4;
        const o = (j * cols * 2 + i) * 4;
        px[o] = vals[c];
        px[o + 1] = vals[c + 1];
        px[o + 2] = vals[c + 2];
        px[o + 3] = 255;
        const q = o + cols * 4;
        px[q] = Math.round(255 * Math.max(0, vals[c + 3] * gain - 0.02));
        px[q + 3] = 255;
      }
    }
    g.putImageData(this.img, 0, rows);
  }
}

// The still picture's layer (its splats rest at their depth): the colors
// and, on the right, the signed offset (blue) that flattens each one as the
// picture flattens (f, 0 at full depth .. 1 flat), as drawStillRested's.
BackPlate.prototype.drawRested = function (g, cols, rows, f) {
  const { cols: bc, rows: br, vals } = this;
  if (!this.img || this.img.width !== cols * 2 || this.img.height !== rows) this.img = g.createImageData(cols * 2, rows); // prettier-ignore
  const px = this.img.data;
  for (let j = 0; j < rows; j++) {
    const y = Math.min(br - 1, Math.floor((j * br) / rows));
    for (let i = 0; i < cols; i++) {
      const c = (y * bc + Math.min(bc - 1, Math.floor((i * bc) / cols))) * 4;
      const o = (j * cols * 2 + i) * 4;
      px[o] = vals[c];
      px[o + 1] = vals[c + 1];
      px[o + 2] = vals[c + 2];
      px[o + 3] = 255;
      const q = o + cols * 4;
      px[q] = px[q + 1] = 128;
      px[q + 2] = Math.round(255 * (0.5 - (vals[c + 3] * f) / 2));
      px[q + 3] = 255;
    }
  }
  g.putImageData(this.img, 0, rows);
};

// Fills the cells whose weight is 0 from their weighted neighbors, coarse
// to fine (push-pull): each coarser level averages the known cells under
// it, and each unknown cell takes the level above it.
export function fillHoles(vals, w, W, H, ch) {
  if (W <= 1 && H <= 1) return;
  const cw = Math.ceil(W / 2);
  const chh = Math.ceil(H / 2);
  const cv = new Float32Array(cw * chh * ch);
  const cwt = new Float32Array(cw * chh);
  for (let y = 0; y < H; y++)
    for (let x = 0; x < W; x++) {
      const a = y * W + x;
      const b = (y >> 1) * cw + (x >> 1);
      const ww = w[a];
      if (!ww) continue;
      cwt[b] += ww;
      for (let k = 0; k < ch; k++) cv[b * ch + k] += vals[a * ch + k] * ww;
    }
  let any = false;
  for (let b = 0; b < cw * chh; b++)
    if (cwt[b] > 0) {
      for (let k = 0; k < ch; k++) cv[b * ch + k] /= cwt[b];
      cwt[b] = Math.min(1, cwt[b]);
      any = true;
    }
  if (!any) return;
  fillHoles(cv, cwt, cw, chh, ch);
  // Each unknown cell takes the coarser level, sampled smoothly (bilinear),
  // so the filled parts don't show its blocks.
  for (let y = 0; y < H; y++)
    for (let x = 0; x < W; x++) {
      const a = y * W + x;
      const ww = Math.min(1, w[a]);
      if (ww >= 1) continue;
      const fx = Math.max(0, Math.min(cw - 1, (x + 0.5) / 2 - 0.5));
      const fy = Math.max(0, Math.min(chh - 1, (y + 0.5) / 2 - 0.5));
      const x0 = Math.floor(fx);
      const y0 = Math.floor(fy);
      const x1 = Math.min(cw - 1, x0 + 1);
      const y1 = Math.min(chh - 1, y0 + 1);
      const ax = fx - x0;
      const ay = fy - y0;
      for (let k = 0; k < ch; k++) {
        const v = (cv[(y0 * cw + x0) * ch + k] * (1 - ax) + cv[(y0 * cw + x1) * ch + k] * ax) * (1 - ay) + (cv[(y1 * cw + x0) * ch + k] * (1 - ax) + cv[(y1 * cw + x1) * ch + k] * ax) * ay; // prettier-ignore
        vals[a * ch + k] = vals[a * ch + k] * ww + v * (1 - ww);
      }
    }
}

// Where the depth jumps by more than EDGE within a 9 by 9 neighborhood (the
// model's depth ramps over several cells once it is scaled up to the grid),
// each cell takes the nearer or the farther value, whichever it is closer
// to, so the jump is a clean cut instead of a ramp of hanging splats (r5).
const EDGE = 0.15;
const REACH = 4;
export function snapEdges(d, w, h) {
  const out = new Float32Array(d.length);
  for (let y = 0; y < h; y++)
    for (let x = 0; x < w; x++) {
      let lo = Infinity;
      let hi = -Infinity;
      for (let j = Math.max(0, y - REACH); j <= Math.min(h - 1, y + REACH); j++)
        for (let i = Math.max(0, x - REACH); i <= Math.min(w - 1, x + REACH); i++) {
          const v = d[j * w + i];
          if (v < lo) lo = v;
          if (v > hi) hi = v;
        }
      const v = d[y * w + x];
      out[y * w + x] = hi - lo > EDGE ? (v - lo < hi - v ? lo : hi) : v;
    }
  return out;
}

// ---- The live view (the splat mirror, Photo to 3D's live view) -------------------------
// A picture of relief splats facing the viewer: `cols` by `rows`, `width`
// wide, rising toward the viewer by up to `lift` where the depth says it is
// near. Its canvas (the recipe's screen) holds the colors and the depth.

export const MIRROR = {
  cols: 128,
  rows: 96,
  cam: null, // CameraDepth while the camera is on
  still: null, // { photo, depth } for the picture before the camera
  gain: 0,
  last: 0,
  version: 0,
  back: false, // r5: the camera's picture has a background layer
};

// The grid for a splat budget (4 : 3, like most cameras).
export function mirrorGrid(count) {
  const n = Math.max(3000, Math.min(60000, Math.floor(count * 0.8)));
  const cols = Math.max(64, Math.round(Math.sqrt((n * 4) / 3)));
  return { cols, rows: Math.round((cols * 3) / 4) };
}

// The still picture's normalized depth (0 far .. 1 near) at (u, v).
function stillDepth(depth) {
  let lo = Infinity;
  let hi = -Infinity;
  for (const v of depth.d) {
    if (v < lo) lo = v;
    if (v > hi) hi = v;
  }
  const span = hi > lo ? hi - lo : 1;
  return (u, v) => {
    const dx = Math.min(depth.w - 1, Math.floor(u * depth.w));
    const dy = Math.min(depth.h - 1, Math.floor(v * depth.h));
    return (depth.d[dy * depth.w + dx] - lo) / span;
  };
}

// Builds the relief picture: width 2 (recipe units), lift up to `lift`.
//
// r3 (the owner's review of October 2, 2026: the still picture jittered and
// flashed face on, until turned or flattened): the splats are sorted by
// where they rest, and a relief splat is lifted only on the GPU, so a
// picture whose splats all rest at z = 0 sorts as a tie, and the order
// flips from frame to frame where neighbors overlap. The still picture's
// splats now rest at their own depth (the option's depth, MIRROR.depth),
// and a signed offset (axis 3) only brings them back toward the plane as
// it flattens, so they sort the way they show. The camera's picture, whose
// depth isn't known until it arrives, is built as before.
//
// r5: `back` (the splat mirror, plain look) adds the background layer
// behind the camera's picture (BackPlate), with a fifth of the splats.
export function buildMirror(
  k,
  { width = 2, lift = 0.8, part = 0, look = "plain", back: wantBack = false } = {},
) {
  MIRROR.look = look;
  const withBack = wantBack && look === "plain";
  MIRROR.back = withBack;
  const { cols, rows } = mirrorGrid(withBack ? k.count * 0.8 : k.count);
  MIRROR.cols = cols;
  MIRROR.rows = rows;
  const height = (width * rows) / cols;
  MIRROR.stillLift = 0;
  if (!live.camera?.video && MIRROR.still) {
    const at = stillDepth(MIRROR.still.depth);
    const full = lift * Math.max(0, MIRROR.depth ?? 0.6);
    MIRROR.stillLift = full;
    MIRROR.liftUnit = lift;
    MIRROR.stillAt = at;
    const items = [];
    for (let j = 0; j < rows; j++)
      for (let i = 0; i < cols; i++) {
        const u = (i + 0.5) / cols;
        const v = (j + 0.5) / rows;
        items.push({ p: [(u - 0.5) * width, (0.5 - v) * height, full * at(u, v)], n: [0, 0, 1], size: ((width / cols) * 1.45) / 0.01, flat: 0.08, opacity: 1, color: "#808080", kind: "relief", params: [u, withBack ? v / 2 : v, 3, Math.max(0.001, full)], part, pattern: false }); // prettier-ignore
      }
    k.cloud({ share: items.length / k.count, pattern: false, jitter: 0 }, (rand, i) => items[i] || null); // prettier-ignore
    // r5: the still picture's background layer, learned once from the photo.
    MIRROR.stillBack = null;
    if (withBack) {
      const bc = Math.ceil(cols / 2);
      const br = Math.ceil(rows / 2);
      const d = new Float32Array(cols * rows);
      for (let j = 0; j < rows; j++)
        for (let i = 0; i < cols; i++) d[j * cols + i] = at((i + 0.5) / cols, (j + 0.5) / rows);
      const { photo } = MIRROR.still;
      const bp = new BackPlate(bc, br);
      bp.learn({ w: photo.w, h: photo.h, data: photo.data, crop: [0, 0, 1, 1] }, d, cols, rows, false); // prettier-ignore
      MIRROR.stillBack = bp;
      // Like the picture's own splats, each rests at its depth (a hair
      // behind the wall's) and a signed offset flattens it, so they sort
      // the way they show (r3).
      const back = [];
      for (let j = 0; j < br; j++)
        for (let i = 0; i < bc; i++) {
          const u = (i + 0.5) / bc;
          const v = (j + 0.5) / br;
          back.push({ p: [(u - 0.5) * width, (0.5 - v) * height, full * bp.vals[(j * bc + i) * 4 + 3] - 0.02], n: [0, 0, 1], size: ((width / bc) * 1.45) / 0.01, flat: 0.08, opacity: 1, color: "#808080", kind: "relief", params: [u, 0.5 + v / 2, 3, Math.max(0.001, full)], part, pattern: false }); // prettier-ignore
        }
      k.cloud({ share: back.length / k.count, pattern: false, jitter: 0 }, (rand, i) => back[i] || null); // prettier-ignore
    }
    MIRROR.cam?.close();
    MIRROR.cam = null;
    return { cols, rows, height };
  }
  reliefGrid(k, {
    cols,
    rows,
    at: (u, v) => [(u - 0.5) * width, (0.5 - v) * height, 0],
    axis: 2,
    lift,
    n: [0, 0, 1],
    size: width / cols,
    part,
    vs: withBack ? 0.5 : 1,
  });
  const back = withBack && live.camera?.video ? { cols: Math.ceil(cols / 2), rows: Math.ceil(rows / 2) } : null; // prettier-ignore
  if (back)
    reliefGrid(k, {
      cols: back.cols,
      rows: back.rows,
      at: (u, v) => [(u - 0.5) * width, (0.5 - v) * height, -0.006],
      axis: 2,
      lift,
      n: [0, 0, 1],
      size: width / back.cols,
      part,
      v0: 0.5,
      vs: 0.5,
    });
  // Start (or stop) the camera's depth with this build.
  MIRROR.cam?.close();
  MIRROR.cam = null;
  if (live.camera?.video) {
    const tier = k.count > 200000 ? "high" : k.count > 90000 ? "mid" : "low";
    // r3: the back camera shows the right way round, not as a mirror.
    const mirror = live.camera.facing !== "environment";
    MIRROR.cam = new CameraDepth(live.camera.video, { cols, rows, tier, mirror, back });
  }
  return { cols, rows, height };
}

// The screen a live view draws into: the camera and its depth, or the
// still picture, with the depth scaled by MIRROR.gain.
export const mirrorScreen = {
  get width() {
    return MIRROR.cols * 2;
  },
  get height() {
    return MIRROR.rows * (MIRROR.back ? 2 : 1);
  },
  version: (time) =>
    MIRROR.cam || MIRROR.look === "hologram" ? Math.floor(time * 60) : `${MIRROR.still ? 1 : 0}|${MIRROR.gain.toFixed(3)}`, // prettier-ignore
  draw(g, time) {
    const dt = Math.max(0, Math.min(0.1, time - MIRROR.last));
    MIRROR.last = time;
    if (MIRROR.cam && live.camera) MIRROR.cam.draw(g, { gain: MIRROR.gain, dt });
    else if (MIRROR.still && MIRROR.stillAt) drawStillRested(g); // r3
    else if (MIRROR.still) drawStill(g, MIRROR.cols, MIRROR.rows, MIRROR.still.photo, MIRROR.still.depth, { gain: MIRROR.gain }); // prettier-ignore
    if (MIRROR.look === "hologram") hologram(g, MIRROR.cols, MIRROR.rows, time);
  },
};

// The still picture built at its depth (buildMirror): its colors on the
// left, and on the right the signed offset (blue, about a half) that brings
// each splat back toward the plane as the picture flattens.
function drawStillRested(g) {
  const { cols, rows, still, stillAt } = MIRROR;
  const full = MIRROR.stillLift;
  // How flat (0 the full relief the splats rest at .. 1 flat).
  const f = full > 0 ? 1 - Math.max(0, Math.min(1, (MIRROR.gain * MIRROR.liftUnit) / full)) : 1;
  const key = `${cols}x${rows}`;
  if (MIRROR.colorsFor !== key) {
    // The colors, once per build.
    const c = document.createElement("canvas");
    c.width = cols * 2;
    c.height = rows;
    const cg = c.getContext("2d");
    drawStill(cg, cols, rows, still.photo, still.depth, { gain: 0 });
    MIRROR.colors = cg.getImageData(0, 0, cols, rows);
    MIRROR.near = new Float32Array(cols * rows);
    for (let j = 0; j < rows; j++)
      for (let i = 0; i < cols; i++) MIRROR.near[j * cols + i] = stillAt((i + 0.5) / cols, (j + 0.5) / rows); // prettier-ignore
    MIRROR.colorsFor = key;
  }
  g.putImageData(MIRROR.colors, 0, 0);
  const img = g.createImageData(cols, rows);
  const px = img.data;
  for (let i = 0; i < cols * rows; i++) {
    const o = i * 4;
    px[o] = px[o + 1] = 128;
    px[o + 2] = Math.round(255 * (0.5 - (MIRROR.near[i] * f) / 2));
    px[o + 3] = 255;
  }
  g.putImageData(img, cols, 0);
  MIRROR.stillBack?.drawRested(g, cols, rows, f);
}

// r3: the hologram look (the owner's idea of October 2, 2026; the plain
// look stays the default). The colors turn a cool cyan by their
// brightness, every other row dims (scanlines that drift slowly upward),
// and edges where the depth jumps glow.
export function hologram(g, cols, rows, time) {
  const img = g.getImageData(0, 0, cols * 2, rows);
  const px = img.data;
  const W = cols * 2;
  const shift = Math.floor(time * 6) % 3;
  for (let j = 0; j < rows; j++)
    for (let i = 0; i < cols; i++) {
      const o = (j * W + i) * 4;
      const y = (0.3 * px[o] + 0.59 * px[o + 1] + 0.11 * px[o + 2]) / 255;
      // Depth jumps (the height channel, red, on the right half).
      const h = (x, yy) => px[(Math.min(rows - 1, Math.max(0, yy)) * W + cols + Math.min(cols - 1, Math.max(0, x))) * 4 + (MIRROR.stillAt && !MIRROR.cam ? 2 : 0)]; // prettier-ignore
      const edge = Math.min(1, (Math.abs(h(i + 1, j) - h(i - 1, j)) + Math.abs(h(i, j + 1) - h(i, j - 1))) / 40); // prettier-ignore
      const scan = (j + shift) % 3 === 0 ? 0.55 : 1;
      const v = Math.min(1, (0.15 + 0.85 * y) * scan + 0.7 * edge);
      px[o] = Math.round(255 * v * 0.35);
      px[o + 1] = Math.round(255 * Math.min(1, v * 0.95 + 0.05));
      px[o + 2] = Math.round(255 * Math.min(1, v * 1.1 + 0.1));
    }
  g.putImageData(img, 0, 0, 0, 0, cols, rows);
}

export function mirrorStatus() {
  const cam = MIRROR.cam;
  if (!cam || !live.on("camera")) return "";
  if (cam.status) return cam.status;
  return cam.answers ? `Depth ${Math.round(1000 / Math.max(1, cam.ms))} times a second or so (${Math.round(cam.ms)} ms each), on this device.` : "Working out the depth…"; // prettier-ignore
}
