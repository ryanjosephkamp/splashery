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
    spread = 1.45, // Live r7: a splat's diameter over its cell's width
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
          size: (size * (l === 0 ? spread : 1.2)) / 0.01,
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
// newest depth. Task 41 aligns successive answers on unchanged colors and
// keeps one range, so relative depth scale changes do not make the room breathe.
// Live r7: the depth's own grid holds at most this many cells (CameraDepth).
const DEPTH_CELLS = 60000;
// Live r7 (stability, October 6): a cell is still once it has held this long
// (seconds), and a still cell's depth jumps only when HOLD answers agree.
const STILL = 0.6;
const HOLD = 3;

// Task 41: a robust scale/shift fit on the parts whose colors stayed put.
// Reject depth outliers once so a moving object with wall-like colors cannot
// pull the whole room toward it. No correspondence means no invented scale.
export function relativeAlignment(d, reference, colors, oldColors) {
  const identity = { scale: 1, shift: 0, samples: 0 };
  if (!reference || !colors || !oldColors || reference.length !== d.length) return identity;
  let lo = Infinity,
    hi = -Infinity;
  for (const v of reference) {
    lo = Math.min(lo, v);
    hi = Math.max(hi, v);
  }
  const span = Math.max(1e-6, hi - lo);
  let fit = identity;
  for (let pass = 0; pass < 2; pass++) {
    let n = 0,
      sx = 0,
      sy = 0,
      xx = 0,
      xy = 0;
    for (let i = 0; i < d.length; i++) {
      const c = i * 3;
      const change =
        Math.abs(colors[c] - oldColors[c]) +
        Math.abs(colors[c + 1] - oldColors[c + 1]) +
        Math.abs(colors[c + 2] - oldColors[c + 2]);
      if (change > 24 || !Number.isFinite(d[i]) || !Number.isFinite(reference[i])) continue;
      if (pass && Math.abs(d[i] * fit.scale + fit.shift - reference[i]) > span * 0.08) continue;
      n++;
      sx += d[i];
      sy += reference[i];
      xx += d[i] * d[i];
      xy += d[i] * reference[i];
    }
    if (n < Math.max(32, d.length * 0.08)) return identity;
    const variance = xx - (sx * sx) / n;
    const scale = variance > 1e-8 * n ? (xy - (sx * sy) / n) / variance : 1;
    if (!Number.isFinite(scale) || scale < 0.1 || scale > 10) return identity;
    fit = { scale, shift: (sy - scale * sx) / n, samples: n };
  }
  return fit;
}

// Depth is held exactly once the picture is still. A large change without
// visible motion must persist on the SAME side for HOLD answers; alternating
// guesses cannot build up a vote. A visible move has no extra edge delay.
export function holdDepth(next, prev, still, colors, oldColors, jumps, sides) {
  if (!prev || !oldColors) return next;
  for (let i = 0; i < next.length; i++) {
    const c = i * 3;
    const change =
      Math.abs(colors[c] - oldColors[c]) +
      Math.abs(colors[c + 1] - oldColors[c + 1]) +
      Math.abs(colors[c + 2] - oldColors[c + 2]);
    const delta = next[i] - prev[i];
    // The filtered picture's still mask is stronger evidence than a raw
    // sensor pixel. It tolerates noise up to 60 summed channel levels;
    // coherent motion clears that mask in draw() and follows immediately.
    const quiet = change <= 24 || (still[i] && change <= 60);
    if (quiet && Math.abs(delta) > 0.12) {
      const side = delta > 0 ? 1 : -1;
      jumps[i] = sides[i] === side ? Math.min(HOLD, jumps[i] + 1) : 1;
      sides[i] = side;
      if (jumps[i] < HOLD) next[i] = prev[i];
    } else {
      jumps[i] = 0;
      sides[i] = 0;
      const a = quiet && still[i] ? 0 : Math.min(1, 0.15 + Math.max(0, change - 12) / 48);
      next[i] = prev[i] + delta * a;
    }
  }
  return next;
}

// Live r7: a depth worked out on a dw by dh grid (d, 0..1, its jumps clean
// steps after snapEdges), brought up to a gw by gh grid. Where the four
// depth cells around a fine cell are one surface it is bilinear; across a
// jump the fine cell takes the side whose cell's colors are nearest its own
// (guide: the fine grid's RGBA colors; the depth cells' colors are their
// means), so the outline is as fine as the picture. No guide: bilinear.
export function upsampleSnap(
  d,
  dw,
  dh,
  gw,
  gh,
  guide = null,
  sourceColors = null,
  out = new Float32Array(gw * gh),
  mask = null,
) {
  let gc = sourceColors;
  if (!gc && guide && guide.length >= gw * gh * 4) {
    gc = new Float32Array(dw * dh * 3);
    const n = new Float32Array(dw * dh);
    for (let j = 0; j < gh; j++) {
      const y = Math.min(dh - 1, Math.floor((j * dh) / gh));
      for (let i = 0; i < gw; i++) {
        const x = Math.min(dw - 1, Math.floor((i * dw) / gw));
        const c = y * dw + x;
        const o = (j * gw + i) * 4;
        gc[c * 3] += guide[o];
        gc[c * 3 + 1] += guide[o + 1];
        gc[c * 3 + 2] += guide[o + 2];
        n[c]++;
      }
    }
    for (let c = 0; c < dw * dh; c++) for (let k = 0; k < 3; k++) gc[c * 3 + k] /= Math.max(1, n[c]); // prettier-ignore
  }
  for (let j = 0; j < gh; j++) {
    const v = Math.max(0, Math.min(dh - 1, ((j + 0.5) * dh) / gh - 0.5));
    const y0 = Math.floor(v);
    const y1 = Math.min(dh - 1, y0 + 1);
    const ay = v - y0;
    for (let i = 0; i < gw; i++) {
      const k = j * gw + i;
      if (mask && !mask[k]) continue;
      const u = Math.max(0, Math.min(dw - 1, ((i + 0.5) * dw) / gw - 0.5));
      const x0 = Math.floor(u);
      const x1 = Math.min(dw - 1, x0 + 1);
      const ax = u - x0;
      const a = d[y0 * dw + x0];
      const b = d[y0 * dw + x1];
      const c = d[y1 * dw + x0];
      const e = d[y1 * dw + x1];
      const lo = Math.min(a, b, c, e);
      const hi = Math.max(a, b, c, e);
      if (hi - lo <= EDGE || !gc) {
        out[k] = (a * (1 - ax) + b * ax) * (1 - ay) + (c * (1 - ax) + e * ax) * ay;
        continue;
      }
      const o = k * 4;
      const r = guide[o];
      const g = guide[o + 1];
      const bl = guide[o + 2];
      let best = Infinity;
      let pick = a;
      for (let corner = 0; corner < 4; corner++) {
        const x = corner & 1 ? x1 : x0;
        const y = corner & 2 ? y1 : y0;
        const q = (y * dw + x) * 3;
        // (The nearer depth cell wins a tie, by a little distance.)
        const dist = (gc[q] - r) ** 2 + (gc[q + 1] - g) ** 2 + (gc[q + 2] - bl) ** 2 + 40 * ((x - u) ** 2 + (y - v) ** 2); // prettier-ignore
        if (dist < best) {
          best = dist;
          pick = d[y * dw + x];
        }
      }
      // Interpolate only WITHIN the chosen surface. Mixed edge colors are
      // anti-aliased by the picture, without making an intermediate depth
      // that stretches a foreground splat across the gap.
      let sum = 0;
      let weight = 0;
      const mid = (lo + hi) / 2;
      const nearSide = pick > mid;
      for (let corner = 0; corner < 4; corner++) {
        const x = corner & 1 ? x1 : x0;
        const y = corner & 2 ? y1 : y0;
        const value = d[y * dw + x];
        if (value > mid !== nearSide) continue;
        const q = (y * dw + x) * 3;
        const color = (gc[q] - r) ** 2 + (gc[q + 1] - g) ** 2 + (gc[q + 2] - bl) ** 2;
        const w = 1 / (1 + 4 * ((x - u) ** 2 + (y - v) ** 2) + color / 200);
        sum += value * w;
        weight += w;
      }
      out[k] = weight ? sum / weight : pick;
    }
  }
  return out;
}

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
    // Live r7 (the mirror's finer grid of October 6): the depth is worked
    // out on a grid of at most DEPTH_CELLS (what its steps were tuned on, and
    // what a phone can do on every answer), then brought up to the picture's
    // grid by upsampleSnap.
    // Do not filter more depth cells than the model can resolve. The
    // picture keeps its full grid; color-guided upsampling supplies edges.
    const ds = Math.min(1, Math.sqrt(Math.min(DEPTH_CELLS, this.side ** 2 * 0.75) / (cols * rows)));
    this.dcols = Math.max(16, Math.round(cols * ds));
    this.drows = Math.max(12, Math.round(rows * ds));
    this.dt = new Float32Array(this.dcols * this.drows);
    // Live r7 (the owner's "Please improve stability", October 6): how long
    // each cell of the picture has held still (seconds; STILL), and for the
    // depth's grid, how many answers in a row a still cell's depth has
    // jumped (a jump is taken only when it holds; HOLD).
    this.stillT = new Float32Array(cols * rows);
    this.dstill = new Uint8Array(this.dcols * this.drows);
    this.djump = new Uint8Array(this.dcols * this.drows);
    this.fjump = new Uint8Array(cols * rows);
    this.dside = new Int8Array(this.dcols * this.drows);
    this.fside = new Int8Array(cols * rows);
    this.moving = 0; // the share of the picture moving now
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
    this.closed = false;
    this.discarded = 0;
    this.mediaFrame = null;
    this.requestedFrame = null;
    this.crop = [0, 0, 1, 1]; // the part of the frame the grid shows (fractions)
    if (video?.requestVideoFrameCallback) {
      const watch = (time, metadata) => {
        if (this.closed) return;
        this.mediaFrame = metadata.presentedFrames;
        this.frameCallback = video.requestVideoFrameCallback(watch);
      };
      this.frameCallback = video.requestVideoFrameCallback(watch);
    }
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
    if (this.closed || !this.worker || this.busy || !v?.videoWidth) return;
    if (this.mediaFrame !== null && this.mediaFrame === this.requestedFrame) return;
    const s = this.side / Math.max(v.videoWidth, v.videoHeight);
    const m = (x) => Math.max(14, Math.round((x * s) / 14) * 14);
    const w = m(v.videoWidth);
    const h = m(v.videoHeight);
    this.frameCanvas ||= document.createElement("canvas");
    const c = this.frameCanvas;
    if (c.width !== w || c.height !== h) {
      c.width = w;
      c.height = h;
    }
    const g = c.getContext("2d", { willReadFrequently: true });
    g.drawImage(v, 0, 0, w, h);
    const data = g.getImageData(0, 0, w, h).data;
    // r5: the background layer learns the wall from this same frame, when
    // its depth comes back (the colors of a later frame wouldn't match it);
    // Live r7: and the depth's edges follow its colors.
    const id = ++this.id;
    this.sent = {
      id,
      w,
      h,
      data: data.slice(),
      crop: this.crop.slice(),
      capturedAt: performance.now(),
      videoWidth: v.videoWidth,
      videoHeight: v.videoHeight,
    };
    this.requestedFrame = this.mediaFrame;
    this.busy = true;
    this.worker.postMessage({ type: "frame", id, w, h, data }, [data.buffer]);
  }

  onAnswer(m) {
    if (this.closed) return;
    if (m.type === "status") {
      this.status = m.text;
      return;
    }
    if (m.type === "error") {
      this.busy = false;
      this.status = "The depth model stopped; the picture stays flat.";
      return;
    }
    if (m.type !== "depth") return;
    const sent = this.sent;
    if (!this.busy || !sent || m.id !== sent.id) {
      this.discarded++;
      return;
    }
    this.busy = false;
    const stale = performance.now() - sent.capturedAt > Math.max(1500, 3 * m.ms);
    const resized =
      sent.videoWidth !== this.video.videoWidth || sent.videoHeight !== this.video.videoHeight;
    const cropChanged = sent.crop.some((v, i) => Math.abs(v - this.crop[i]) > 1e-6);
    if (
      stale ||
      resized ||
      cropChanged ||
      !Number.isInteger(m.w) ||
      !Number.isInteger(m.h) ||
      m.w < 1 ||
      m.h < 1 ||
      m.d?.length !== m.w * m.h ||
      !m.d.every(Number.isFinite)
    ) {
      this.discarded++;
      this.ask();
      return;
    }
    // Apply this answer before the next draw captures a new request. Camera
    // readback here would block the answer's first drawn frame.
    this.ms = m.ms;
    this.answers++;
    this.status = "";
    // Resample to the depth's grid (mirrored with the picture) and find the
    // range.
    const { dcols: cols, drows: rows } = this;
    const t = this.dt;
    for (let j = 0; j < rows; j++)
      for (let i = 0; i < cols; i++) {
        const u = this.mirror ? 1 - (i + 0.5) / cols : (i + 0.5) / cols;
        const [cx, cy, cw, ch] = sent.crop;
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
    const colors = gridColors(sent, cols, rows, this.mirror);
    const oldColors = this.depthColors;
    this.markStill();
    const fit = relativeAlignment(t, this.reference, colors, oldColors);
    if (fit.samples) for (let i = 0; i < t.length; i++) t[i] = t[i] * fit.scale + fit.shift;
    // Keep the first aligned range. Replacing it on every answer was another
    // source of breathing; a whole-scene change starts a new reference.
    let reset = this.lo === null;
    if (!reset && !fit.samples && oldColors) {
      let changed = 0;
      for (let i = 0; i < t.length; i++) {
        const c = i * 3;
        const difference =
          Math.abs(colors[c] - oldColors[c]) +
          Math.abs(colors[c + 1] - oldColors[c + 1]) +
          Math.abs(colors[c + 2] - oldColors[c + 2]);
        if (difference > 60) changed++;
      }
      // Decide from this answer's frame. The latest draw may already be
      // still again by the time a changed view's depth arrives.
      reset = changed > t.length * 0.5;
    }
    if (reset) {
      const sorted = Float32Array.from(t).sort();
      this.lo = sorted[Math.floor(sorted.length * 0.02)];
      this.hi = sorted[Math.floor(sorted.length * 0.98)];
      this.smooth = null;
      this.filtered = null;
      this.djump.fill(0);
      this.dside.fill(0);
    }
    const reference = t.slice();
    if (this.reference && !reset && oldColors)
      for (let i = 0; i < t.length; i++) {
        const c = i * 3;
        const change =
          Math.abs(colors[c] - oldColors[c]) +
          Math.abs(colors[c + 1] - oldColors[c + 1]) +
          Math.abs(colors[c + 2] - oldColors[c + 2]);
        if (this.dstill[i] && change <= 60) reference[i] = this.reference[i];
      }
    this.reference = reference;
    const span = Math.max(1e-6, this.hi - this.lo);
    for (let i = 0; i < t.length; i++) t[i] = Math.max(0, Math.min(1, (t[i] - this.lo) / span));
    if (this.answers <= 2) this.dstill.fill(0);
    // Suppress sensor/model noise before edge detection, so noise cannot
    // manufacture thousands of small edges for snapEdges to process.
    const previous = this.filtered;
    holdDepth(t, previous, this.dstill, colors, oldColors, this.djump, this.dside);
    this.filtered = t.slice();
    t.set(snapEdges(smoothSurface(t, cols, rows), cols, rows, colors));
    this.band = edgeBand(t, cols, rows);
    tidyBand(this.band, t);
    // A held cell also keeps its cleaned depth: filtering around moving
    // neighbors must not reintroduce drift into a stationary surface.
    if (previous && this.smooth)
      for (let i = 0; i < t.length; i++)
        if (this.filtered[i] === previous[i]) t[i] = this.smooth[i];
    this.smooth = t.slice();
    this.depthColors = colors;

    // Learn and hold using the colors of the frame this answer describes.
    // New camera colors are used only when the picture is drawn.
    const oldGuide = this.depthGuide;
    const rgb = gridColors(sent, this.cols, this.rows, this.mirror);
    const guide = new Uint8ClampedArray(this.cols * this.rows * 4);
    for (let i = 0; i < this.target.length; i++) {
      guide[i * 4] = rgb[i * 3];
      guide[i * 4 + 1] = rgb[i * 3 + 1];
      guide[i * 4 + 2] = rgb[i * 3 + 2];
      guide[i * 4 + 3] = 255;
    }
    this.depthGuide = guide;
    const up = upsampleSnap(t, cols, rows, this.cols, this.rows, guide, colors);
    const fine = this.target;
    if (this.have && this.answers > 2 && oldGuide)
      for (let i = 0; i < up.length; i++) {
        const o = i * 4;
        const change =
          Math.abs(guide[o] - oldGuide[o]) +
          Math.abs(guide[o + 1] - oldGuide[o + 1]) +
          Math.abs(guide[o + 2] - oldGuide[o + 2]);
        if (this.stillT[i] < STILL || change > 60) {
          this.fjump[i] = 0;
          this.fside[i] = 0;
          continue;
        }
        const delta = up[i] - fine[i];
        if (Math.abs(delta) > 0.12) {
          const side = delta > 0 ? 1 : -1;
          this.fjump[i] = this.fside[i] === side ? Math.min(HOLD, this.fjump[i] + 1) : 1;
          this.fside[i] = side;
          if (this.fjump[i] < HOLD) up[i] = fine[i];
        } else {
          this.fjump[i] = 0;
          this.fside[i] = 0;
          up[i] = fine[i];
        }
      }
    fine.set(up);
    if (this.back) this.back.learn(sent, fine, this.cols, this.rows, this.mirror);
    if (!this.have) this.heights.set(fine);
    this.have = true;
    this.answerCapturedAt = sent.capturedAt;
  }

  // Draws the frame now (and eases the heights) into g, a grid's canvas.
  // gain scales the depth (0 flat .. 1). dt is the time since the last draw.
  draw(g, { gain = 1, dt = 1 / 60 } = {}) {
    const v = this.video;
    const { cols, rows } = this;
    if (this.closed || !v?.videoWidth) return false;
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
    // Live r7: the frame shrinks with the browser's best filter (its default
    // samples a few pixels per cell, and the camera's noise came through as
    // grain).
    sg.imageSmoothingEnabled = true;
    sg.imageSmoothingQuality = "high";
    sg.drawImage(v, (v.videoWidth - sw) / 2, (v.videoHeight - sh) / 2, sw, sh, 0, 0, cols, rows);
    sg.restore();
    // r6: steadier colors. A small change from the last frame (a camera's
    // noise, which made the picture shimmer) moves only part of the way;
    // a bigger one (something moving) shows at once. Live r7: kept as
    // floats (rounding each step held a pixel a level or two off, then let
    // it jump), and the share follows the size of the change smoothly: a
    // fifth of a change within the noise, all of a clear one.
    const cur = sg.getImageData(0, 0, cols, rows);
    const cp = cur.data;
    let last = this.lastSmooth;
    const still = this.stillT;
    if (!last || last.length !== cp.length) last = this.lastSmooth = Float32Array.from(cp);
    else {
      // Live r7 (stability, October 6): which cells changed clearly (and
      // their neighbors) start over; every other cell has held still a
      // little longer, and the longer it holds, the longer its colors
      // average (a quarter of a second at first, up to two seconds), so the
      // camera's noise stops showing; anything that moves shows at once.
      const n = cols * rows;
      const moved = (this.movedBuf ||= new Uint8Array(n));
      let m = 0;
      for (let k = 0; k < n; k++) {
        const i = k * 4;
        const d = Math.abs(cp[i] - last[i]) + Math.abs(cp[i + 1] - last[i + 1]) + Math.abs(cp[i + 2] - last[i + 2]); // prettier-ignore
        // Isolated sensor noise is not motion. Check the signed change two
        // cells away in four directions, so a moving outline follows on
        // its first frame but one noisy camera pixel cannot release a face.
        let coherent = d;
        if (d > 40 && d <= 80) {
          const x = k % cols;
          const y = Math.floor(k / cols);
          let r = cp[i] - last[i],
            g = cp[i + 1] - last[i + 1],
            b = cp[i + 2] - last[i + 2];
          for (let side = 0; side < 4; side++) {
            const xx = side === 0 ? Math.max(0, x - 2) : side === 1 ? Math.min(cols - 1, x + 2) : x;
            const yy = side === 2 ? Math.max(0, y - 2) : side === 3 ? Math.min(rows - 1, y + 2) : y;
            const q = (yy * cols + xx) * 4;
            r += cp[q] - last[q];
            g += cp[q + 1] - last[q + 1];
            b += cp[q + 2] - last[q + 2];
          }
          coherent = (Math.abs(r) + Math.abs(g) + Math.abs(b)) / 5;
        }
        moved[k] = d > 80 || (d > 40 && coherent > 24) ? 1 : 0;
        m += moved[k];
      }
      this.moving = m / n;
      // An empty motion mask is already its own dilation.
      const near = m === 0 ? moved : grow(moved, cols, rows, 1);
      for (let k = 0; k < n; k++) still[k] = near[k] ? 0 : Math.min(60, still[k] + dt);
      // Once the color average reaches its two-second cap, every held
      // cell has the same weight. Compute that exponential once per draw.
      const heldColor = 1 - Math.exp(-dt / 2);
      for (let i = 0; i < cp.length; i += 4) {
        const d = Math.abs(cp[i] - last[i]) + Math.abs(cp[i + 1] - last[i + 1]) + Math.abs(cp[i + 2] - last[i + 2]); // prettier-ignore
        // (Live r7, the finer grid of October 6: each cell averages fewer of
        // the camera's pixels, so a little steadier: an eighth of a change
        // within the noise, was a fifth. Stability: that eighth is now
        // a quarter-second average at 30 frames a second, longer as the cell
        // holds still.)
        const age = still[i >> 2];
        const calm = age >= 1.75 / 0.9 ? heldColor : 1 - Math.exp(-dt / (0.25 + age * 0.9));
        const a = near[i >> 2]
          ? 1
          : d <= 24
            ? calm
            : d >= 80
              ? 1
              : calm + ((1 - calm) * (d - 24)) / 56;
        last[i] += (cp[i] - last[i]) * a;
        last[i + 1] += (cp[i + 1] - last[i + 1]) * a;
        last[i + 2] += (cp[i + 2] - last[i + 2]) * a;
        cp[i] = last[i];
        cp[i + 1] = last[i + 1];
        cp[i + 2] = last[i + 2];
      }
    }
    if (!this.lastColors || this.lastColors.length !== cp.length)
      this.lastColors = new Uint8ClampedArray(cp.length);
    this.lastColors.set(cp);
    // Follow a moving outline with today's colors and the request's own
    // color/depth pairs. Only changed pixels are revisited; a still face
    // cannot acquire the patches a full per-frame recoloring used to make.
    if (this.have && this.depthColors && this.moving > 0.0005)
      upsampleSnap(
        this.dt,
        this.dcols,
        this.drows,
        cols,
        rows,
        this.lastColors,
        this.depthColors,
        this.target,
        this.movedBuf,
      );
    // Live r7: a light unsharp mask on what is drawn (the colors above stay
    // as they are, for the next frame): each cell moves away from the mean
    // of its 3 by 3 neighborhood by a share of the difference, so edges a cell or
    // two wide read crisply at phone size. The noise is smoothed first.
    // Live r7 polish (the owner's "the toys could still be sharper", October
    // 5): 1.2, held to 28 levels (sharpen); was 0.5.
    // Noise has already averaged out. Keep weak eye and mouth edges crisp
    // with a smaller coring threshold; other callers retain their old one.
    sharpen(cp, cols, rows, 1.35, (this.blurBuf ||= new Float32Array(cols * rows * 3)), 28, 2);
    g.putImageData(cur, 0, 0);
    // Heights ease toward the newest depth (about a fifth of a second).
    const k = 1 - Math.exp(-dt / 0.12);
    const kBig = 1 - Math.exp(-dt / 0.04);
    const hts = this.heights;
    const t = this.target;
    const img = (this.heightImage ||= g.createImageData(cols, rows));
    const px = img.data;
    for (let i = 0; i < hts.length; i++) {
      // r5: a big jump (a person's edge moving) is quick, so no splat
      // lingers in the gap between near and far; r6: quick rather than at
      // once (it flashed), and small changes ease, which keeps the depth
      // from shimmering.
      if (this.have) {
        if (this.movedBuf?.[i]) hts[i] = t[i];
        else hts[i] += (t[i] - hts[i]) * (Math.abs(t[i] - hts[i]) > 0.3 ? kBig : k);
      }
      const o = i * 4;
      px[o] = Math.round(255 * (this.have ? hts[i] * gain : 0));
      px[o + 3] = 255;
    }
    g.putImageData(img, cols, 0);
    if (this.back) this.back.draw(g, cols, rows, gain, hts, dt);
    if (this.answerCapturedAt) this.drawLatencyMs = performance.now() - this.answerCapturedAt;
    // The crop and the colors above are current before a new request starts.
    this.ask();
    return true;
  }

  // Live r7 (stability): a cell of the depth's grid is still where every
  // cell of the picture under it has held still STILL seconds.
  markStill() {
    const { dcols, drows, cols, rows, stillT, dstill } = this;
    dstill.fill(1);
    for (let j = 0; j < rows; j++) {
      const y = Math.min(drows - 1, Math.floor((j * drows) / rows));
      for (let i = 0; i < cols; i++)
        if (stillT[j * cols + i] < STILL) dstill[y * dcols + Math.min(dcols - 1, Math.floor((i * dcols) / cols))] = 0; // prettier-ignore
    }
  }

  close() {
    this.closed = true;
    this.busy = false;
    if (this.frameCallback != null) this.video?.cancelVideoFrameCallback?.(this.frameCallback);
    this.worker?.terminate();
    this.worker = null;
    this.sent =
      this.reference =
      this.filtered =
      this.depthColors =
      this.depthGuide =
      this.heightImage =
      this.lastColors =
      this.lastSmooth =
        null;
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
// Live r7: a mask (w x h, 0 or 1) grown by r cells each way (a box).
export function grow(m, w, h, r) {
  const row = new Uint8Array(w * h);
  for (let y = 0; y < h; y++) {
    let last = -Infinity;
    for (let x = 0; x < w; x++) {
      if (m[y * w + x]) last = x;
      if (x - last <= r) row[y * w + x] = 1;
    }
    last = Infinity;
    for (let x = w - 1; x >= 0; x--) {
      if (m[y * w + x]) last = x;
      if (last - x <= r) row[y * w + x] = 1;
    }
  }
  const out = new Uint8Array(w * h);
  for (let x = 0; x < w; x++) {
    let last = -Infinity;
    for (let y = 0; y < h; y++) {
      if (row[y * w + x]) last = y;
      if (y - last <= r) out[y * w + x] = 1;
    }
    last = Infinity;
    for (let y = h - 1; y >= 0; y--) {
      if (row[y * w + x]) last = y;
      if (last - y <= r) out[y * w + x] = 1;
    }
  }
  return out;
}

const BACK_GAP = 0.06; // r6: how far behind the wall it sits (recipe units)
const GUARD = 4; // Live r7: its cells this near a person never learn the wall
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
    // (Live r7: the cells within GUARD of a near one, by running distances
    // along rows then columns, rather than a box search for each cell.)
    const guard = grow(near, bc, br, GUARD);
    const [cx, cy, cw, ch] = frame.crop;
    for (let y = 0; y < br; y++)
      for (let x = 0; x < bc; x++) {
        const c = y * bc + x;
        // Live r7: GUARD cells clear of the person (was one), so the rim of
        // their outline isn't learned as wall: the depth model draws a
        // person's outline a little inside their hair and ears, and those
        // colors, learned as wall, showed as a ghost of the person beside
        // them, seen from the side.
        if (guard[c]) continue;
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
        // (Live r7, stability: the wall's colors and depth average over
        // several answers once seen; they took half of each, and all of its
        // depth, so the layer's splats moved with the camera's noise.)
        const k = seen[c] ? 0.2 : 1;
        col[c * 3] += (r / m - col[c * 3]) * k;
        col[c * 3 + 1] += (g / m - col[c * 3 + 1]) * k;
        col[c * 3 + 2] += (b / m - col[c * 3 + 2]) * k;
        dep[c] = seen[c] ? dep[c] + (mean[c] - dep[c]) * 0.25 : mean[c];
        seen[c] = 1;
      }
    for (let c = 0; c < bc * br; c++) {
      vals[c * 4] = col[c * 3];
      vals[c * 4 + 1] = col[c * 3 + 1];
      vals[c * 4 + 2] = col[c * 3 + 2];
      vals[c * 4 + 3] = dep[c];
    }
    // Live r7 (the owner's "the splat mirror also needs to improve" of
    // October 6): the wall the person hides is filled along its rows, from
    // the wall seen to the left and right, so a shelf or the line where the
    // wall meets the floor runs on behind them; the coarse fill alone made a
    // soft blob of the colors all round (the door's white edge, the
    // picture's), which showed as a pale ghost of the person, seen turned.
    // (Only its colors: the coarse fill's smooth depth stays, as a row's
    // ends can be the near floor, and those splats stood out below the
    // picture.)
    fillHoles(vals, Float32Array.from(seen), bc, br, 4);
    rowFill(vals, seen, bc, br);
  }

  // Into the canvas's lower half: the colors on the left, the heights (a
  // hair lower than the wall's, so the picture's own wall stays in front)
  // on the right.
  // r6 (the owner's review of October 3: the fill showed over the camera's
  // picture, and as blobs when zoomed out): its splats show only within
  // two of its cells of a near part of the picture (where the person
  // stands and just beside), everywhere else they hide; and they sit
  // BACK_GAP behind the wall (a signed offset, relief axis 3). hts: the
  // picture's heights now (0 far .. 1 near).
  draw(g, cols, rows, gain, hts, dt = 1 / 60) {
    const { cols: bc, rows: br, vals } = this;
    if (!this.img || this.img.width !== cols * 2 || this.img.height !== rows) this.img = g.createImageData(cols * 2, rows); // prettier-ignore
    const px = this.img.data;
    // Which of its cells are near now, then that grown by two cells.
    const near = (this.near ||= new Uint8Array(bc * br));
    near.fill(0);
    const cap = (this.cap ||= new Float32Array(bc * br));
    cap.fill(1);
    const cellKey = `${cols},${rows},${bc},${br}`;
    if (this.cellKey !== cellKey) {
      this.cellKey = cellKey;
      this.cells = new Uint32Array(cols * rows);
      for (let j = 0; j < rows; j++) {
        const y = Math.min(br - 1, Math.floor((j * br) / rows));
        for (let i = 0; i < cols; i++)
          this.cells[j * cols + i] = y * bc + Math.min(bc - 1, Math.floor((i * bc) / cols));
      }
    }
    // The mapping is fixed for this grid; depths and their footprint caps
    // are still recomputed on every draw.
    const cells = this.cells;
    if (hts)
      for (let i = 0; i < hts.length; i++) {
        const b = cells[i];
        const value = hts[i];
        if (value >= FAR) near[b] = 1;
        cap[b] = Math.min(cap[b], value);
      }
    // A coarse splat overlaps adjacent cells. Cap its ENTIRE footprint,
    // not only its center, so it cannot peek through a lower visible wall.
    const safe = (this.safe ||= new Float32Array(bc * br));
    const rowMin = (this.rowMin ||= new Float32Array(bc * br));
    // A 3 by 3 minimum separates into two three-cell passes. It covers
    // the same footprint without rescanning nine neighbors for each cell.
    for (let y = 0; y < br; y++)
      for (let x = 0; x < bc; x++) {
        const row = y * bc;
        rowMin[row + x] = Math.min(
          cap[row + Math.max(0, x - 1)],
          cap[row + x],
          cap[row + Math.min(bc - 1, x + 1)],
        );
      }
    for (let y = 0; y < br; y++) {
      const above = Math.max(0, y - 1) * bc;
      const row = y * bc;
      const below = Math.min(br - 1, y + 1) * bc;
      for (let x = 0; x < bc; x++) {
        safe[row + x] = Math.min(rowMin[above + x], rowMin[row + x], rowMin[below + x]);
      }
    }
    const show = (this.show ||= new Uint8Array(bc * br));
    show.fill(0);
    for (let y = 0; y < br; y++)
      for (let x = 0; x < bc; x++) {
        if (!near[y * bc + x]) continue;
        for (let j = Math.max(0, y - 2); j <= Math.min(br - 1, y + 2); j++)
          for (let i = Math.max(0, x - 2); i <= Math.min(bc - 1, x + 2); i++) show[j * bc + i] = 1;
      }
    // (Live r7, stability: a splat that shows stays a moment, so one along
    // the outline doesn't blink on and off as the person's edge wavers.)
    const hold = (this.hold ||= new Float32Array(bc * br));
    for (let b = 0; b < bc * br; b++) {
      hold[b] = show[b] ? 1 : Math.max(0, hold[b] - dt);
      if (hold[b] > 0) show[b] = 1;
    }
    // Every fine texel under one background cell has the same color and
    // depth. Encode that cell once, then expand it with the cached mapping.
    const encoded = (this.encoded ||= new Uint8ClampedArray(bc * br * 4));
    for (let b = 0; b < bc * br; b++) {
      const c = b * 4;
      encoded[c] = vals[c];
      encoded[c + 1] = vals[c + 1];
      encoded[c + 2] = vals[c + 2];
      const depth = Math.min(vals[c + 3], safe[b]);
      encoded[c + 3] = Math.round(255 * (0.5 + Math.max(0, depth * gain) / 2));
    }
    for (let j = 0; j < rows; j++) {
      for (let i = 0; i < cols; i++) {
        const b = cells[j * cols + i];
        const c = b * 4;
        const o = (j * cols * 2 + i) * 4;
        px[o] = encoded[c];
        px[o + 1] = encoded[c + 1];
        px[o + 2] = encoded[c + 2];
        px[o + 3] = 255;
        const q = o + cols * 4;
        px[q] = px[q + 1] = 128;
        // A previously learned wall may be nearer than the current wall.
        // Clamp each texel to the visible picture so the coarse plate's
        // footprint cannot come through it, including when depth is flat.
        px[q + 2] = encoded[c + 3];
        px[q + 3] = show[b] ? 255 : 0;
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
// Live r7: fills the colors of each unseen cell of a W by H grid of r, g, b,
// depth (vals, 4 a cell; seen 0 or 1) from the seen cells nearest it on its row, left and
// right, the nearer counting more (by the inverse of the distance squared).
// Each end is the mean of the seen cells within a row or two (so one odd cell
// doesn't streak), and the filled cells are then smoothed a little down each
// column. A cell with seen wall on neither side is left for fillHoles.
export function rowFill(vals, seen, W, H) {
  const at = (x, y) => (y < 0 || y >= H || x < 0 || x >= W ? 0 : seen[y * W + x]);
  const filled = new Uint8Array(W * H);
  const out = new Float32Array(W * H * 4);
  const end = (x, y, o) => {
    let n = 0;
    o[0] = o[1] = o[2] = o[3] = 0;
    for (let j = y - 2; j <= y + 2; j++)
      for (let i = x - 1; i <= x + 1; i++) {
        if (!at(i, j)) continue;
        const c = (j * W + i) * 4;
        for (let k = 0; k < 4; k++) o[k] += vals[c + k];
        n++;
      }
    for (let k = 0; k < 4; k++) o[k] /= n;
  };
  const L = [0, 0, 0, 0];
  const R = [0, 0, 0, 0];
  for (let y = 0; y < H; y++) {
    let x = 0;
    while (x < W) {
      if (seen[y * W + x]) {
        x++;
        continue;
      }
      let x1 = x;
      while (x1 < W && !seen[y * W + x1]) x1++;
      const hasL = x > 0;
      const hasR = x1 < W;
      if (hasL) end(x - 1, y, L);
      if (hasR) end(x1, y, R);
      for (let i = x; i < x1; i++) {
        if (!hasL && !hasR) break;
        const dl = i - x + 1;
        const dr = x1 - i;
        const wl = hasL ? 1 / (dl * dl) : 0;
        const wr = hasR ? 1 / (dr * dr) : 0;
        const c = (y * W + i) * 4;
        for (let k = 0; k < 3; k++) out[c + k] = (L[k] * wl + R[k] * wr) / (wl + wr);
        filled[y * W + i] = 1;
      }
      x = x1;
    }
  }
  // Down each column, over the filled cells only (a 5-row mean).
  for (let x = 0; x < W; x++)
    for (let y = 0; y < H; y++) {
      const c = y * W + x;
      if (!filled[c]) continue;
      const acc = [0, 0, 0, 0];
      let n = 0;
      for (let j = Math.max(0, y - 2); j <= Math.min(H - 1, y + 2); j++) {
        const q = j * W + x;
        if (!filled[q]) continue;
        for (let k = 0; k < 4; k++) acc[k] += out[q * 4 + k];
        n++;
      }
      for (let k = 0; k < 3; k++) vals[c * 4 + k] = acc[k] / n;
    }
}

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
//
// Live r7: only where the window holds a steep step (STEP between two
// neighboring cells): a face's own gentle relief (a nose, a cheek) spans
// more than EDGE across nine cells too, and cutting it there made terraces,
// grain once turned. And given the grid's colors (cols x rows, r, g, b), a
// cell goes with the side whose colors are nearer its own as well as its
// depth, so the cut follows the outline in the picture.
const EDGE = 0.15;
const STEP = 0.06;
const REACH = 7; // Live r7: was 4; the model draws an outline a few cells inside the hair
export function snapEdges(d, w, h, colors = null) {
  const out = new Float32Array(d.length);
  // Cells beside a steep step, then grown by REACH (a running count per row,
  // then per column).
  const steep = new Uint8Array(w * h);
  for (let y = 0; y < h; y++)
    for (let x = 0; x < w; x++) {
      const v = d[y * w + x];
      if (x + 1 < w && Math.abs(d[y * w + x + 1] - v) > STEP) steep[y * w + x] = steep[y * w + x + 1] = 1; // prettier-ignore
      if (y + 1 < h && Math.abs(d[(y + 1) * w + x] - v) > STEP) steep[y * w + x] = steep[(y + 1) * w + x] = 1; // prettier-ignore
    }
  const rowNear = new Uint8Array(w * h);
  for (let y = 0; y < h; y++) {
    let last = -Infinity;
    for (let x = 0; x < w; x++) {
      if (steep[y * w + x]) last = x;
      if (x - last <= REACH) rowNear[y * w + x] = 1;
    }
    last = Infinity;
    for (let x = w - 1; x >= 0; x--) {
      if (steep[y * w + x]) last = x;
      if (last - x <= REACH) rowNear[y * w + x] = 1;
    }
  }
  const near = new Uint8Array(w * h);
  for (let x = 0; x < w; x++) {
    let last = -Infinity;
    for (let y = 0; y < h; y++) {
      if (rowNear[y * w + x]) last = y;
      if (y - last <= REACH) near[y * w + x] = 1;
    }
    last = Infinity;
    for (let y = h - 1; y >= 0; y--) {
      if (rowNear[y * w + x]) last = y;
      if (last - y <= REACH) near[y * w + x] = 1;
    }
  }
  for (let y = 0; y < h; y++)
    for (let x = 0; x < w; x++) {
      const v = d[y * w + x];
      if (!near[y * w + x]) {
        out[y * w + x] = v;
        continue;
      }
      let lo = Infinity;
      let hi = -Infinity;
      for (let j = Math.max(0, y - REACH); j <= Math.min(h - 1, y + REACH); j++)
        for (let i = Math.max(0, x - REACH); i <= Math.min(w - 1, x + REACH); i++) {
          const u = d[j * w + i];
          if (u < lo) lo = u;
          if (u > hi) hi = u;
        }
      if (hi - lo <= EDGE) {
        out[y * w + x] = v;
        continue;
      }
      // By depth alone: the nearer of the two sides (0 the far side .. 1).
      let toNear = (v - lo) / (hi - lo);
      if (colors) {
        // How near the cell's colors come to any cell clearly on each side
        // (a person is many colors, so not their mean).
        const pick = sideByColor(d, w, h, colors, x, y, REACH, 1, lo, hi, colors, (y * w + x) * 3);
        if (pick) toNear = toNear * (1 - pick.trust) + pick.near * pick.trust;
      }
      // A cell already on its side, where the depth around it is gentle (a
      // face beside its outline), keeps its own depth: only the ramp of the
      // model's soft edge is cut to the side's far or near value.
      const side = toNear >= 0.5 ? hi : lo;
      const own = toNear >= 0.5 ? v > (lo + hi) / 2 : v <= (lo + hi) / 2;
      out[y * w + x] = own && !steep[y * w + x] ? v : side;
    }
  return out;
}

// Live r7: how a cell's colors (cc[o..o+2]) side with the near or the far
// side of a jump (lo, hi) around (x, y): the nearest color among the cells
// clearly on each side (every `step` cells within `R`). Returns null when a
// side has no cells, else { near: 1 near .. 0 far, trust: 0..1, how clearly
// the colors tell }.
export function sideByColor(d, w, h, colors, x, y, R, step, lo, hi, cc, o) {
  const nearAt = hi - (hi - lo) * 0.25;
  const farAt = lo + (hi - lo) * 0.25;
  let dn = Infinity;
  let df = Infinity;
  const r = cc[o];
  const g = cc[o + 1];
  const b = cc[o + 2];
  for (let j = Math.max(0, y - R); j <= Math.min(h - 1, y + R); j += step)
    for (let i = Math.max(0, x - R); i <= Math.min(w - 1, x + R); i += step) {
      const k = j * w + i;
      if (i === x && j === y) continue;
      const u = d[k];
      if (u < nearAt && u > farAt) continue;
      const e = (colors[k * 3] - r) ** 2 + (colors[k * 3 + 1] - g) ** 2 + (colors[k * 3 + 2] - b) ** 2; // prettier-ignore
      if (u >= nearAt) {
        if (e < dn) dn = e;
      } else if (e < df) df = e;
    }
  if (dn === Infinity || df === Infinity) return null;
  dn = Math.sqrt(dn);
  df = Math.sqrt(df);
  return { near: df / Math.max(1e-6, dn + df), trust: Math.min(1, Math.abs(dn - df) / 30) };
}

// Live r7: the cells within BAND of a jump in the depth (d, after snapEdges,
// so a jump is a clean step), with the depth on each side around them.
const BAND = 8;
export function edgeBand(d, w, h) {
  const jump = new Uint8Array(w * h);
  for (let y = 0; y < h; y++)
    for (let x = 0; x < w; x++) {
      const v = d[y * w + x];
      if (x + 1 < w && Math.abs(d[y * w + x + 1] - v) > EDGE) jump[y * w + x] = jump[y * w + x + 1] = 1; // prettier-ignore
      if (y + 1 < h && Math.abs(d[(y + 1) * w + x] - v) > EDGE) jump[y * w + x] = jump[(y + 1) * w + x] = 1; // prettier-ignore
    }
  // Within BAND of a jump (a box, by running distances along rows then columns).
  const row = new Uint8Array(w * h);
  for (let y = 0; y < h; y++) {
    let last = -Infinity;
    for (let x = 0; x < w; x++) {
      if (jump[y * w + x]) last = x;
      if (x - last <= BAND) row[y * w + x] = 1;
    }
    last = Infinity;
    for (let x = w - 1; x >= 0; x--) {
      if (jump[y * w + x]) last = x;
      if (last - x <= BAND) row[y * w + x] = 1;
    }
  }
  const idx = [];
  const lo = [];
  const hi = [];
  for (let x = 0; x < w; x++) {
    let last = -Infinity;
    const inCol = new Uint8Array(h);
    for (let y = 0; y < h; y++) {
      if (row[y * w + x]) last = y;
      if (y - last <= BAND) inCol[y] = 1;
    }
    last = Infinity;
    for (let y = h - 1; y >= 0; y--) {
      if (row[y * w + x]) last = y;
      if (last - y <= BAND) inCol[y] = 1;
    }
    for (let y = 0; y < h; y++) {
      if (!inCol[y]) continue;
      let a = Infinity;
      let b = -Infinity;
      for (let j = Math.max(0, y - BAND); j <= Math.min(h - 1, y + BAND); j += 2)
        for (let k = Math.max(0, x - BAND); k <= Math.min(w - 1, x + BAND); k += 2) {
          const u = d[j * w + k];
          if (u < a) a = u;
          if (u > b) b = u;
        }
      if (b - a <= EDGE) continue;
      idx.push(y * w + x);
      lo.push(a);
      hi.push(b);
    }
  }
  return { w, h, idx: Int32Array.from(idx), lo: Float32Array.from(lo), hi: Float32Array.from(hi) }; // prettier-ignore
}

// Live r7: no lone cell on the wrong side of an outline (hair the depth
// model took for wall showed as dark specks on it, seen from the side): each
// band cell (edgeBand) takes the side most of its eight neighbors are on.
export function tidyBand(band, d) {
  const { w, h, idx, lo, hi } = band;
  const was = (band.was ||= new Float32Array(idx.length));
  for (let b = 0; b < idx.length; b++) was[b] = d[idx[b]];
  for (let b = 0; b < idx.length; b++) {
    const i = idx[b];
    const x = i % w;
    const y = (i - x) / w;
    if (x === 0 || y === 0 || x === w - 1 || y === h - 1) continue;
    const mid = (lo[b] + hi[b]) / 2;
    let near = 0;
    for (let j = -1; j <= 1; j++)
      for (let k = -1; k <= 1; k++) if ((j || k) && d[i + j * w + k] > mid) near++;
    const self = was[b] > mid;
    if (self && near <= 2) d[i] = lo[b];
    else if (!self && near >= 6) d[i] = hi[b];
  }
}

// Live r7: an unsharp mask on RGBA pixels (w x h) in place: c + amount (c -
// the 3 by 3 box mean), by rows then columns.
const CORE = 4; // levels (sharpen)
export function sharpen(px, w, h, amount, tmp, limit = 28, core = CORE) {
  // Walk the packed RGB cells together. The old channel-at-a-time pass
  // recalculated the same neighbors three times; the arithmetic is identical.
  for (let y = 0; y < h; y++)
    for (let x = 0; x < w; x++) {
      const k = y * w + x;
      const a = (y * w + Math.max(0, x - 1)) * 4;
      const b = k * 4;
      const c = (y * w + Math.min(w - 1, x + 1)) * 4;
      const q = k * 3;
      tmp[q] = (px[a] + px[b] + px[c]) / 3;
      tmp[q + 1] = (px[a + 1] + px[b + 1] + px[c + 1]) / 3;
      tmp[q + 2] = (px[a + 2] + px[b + 2] + px[c + 2]) / 3;
    }
  for (let y = 0; y < h; y++) {
    const y0 = Math.max(0, y - 1);
    const y1 = Math.min(h - 1, y + 1);
    for (let x = 0; x < w; x++) {
      const a = (y0 * w + x) * 3;
      const b = (y * w + x) * 3;
      const c = (y1 * w + x) * 3;
      const q = (y * w + x) * 4;
      for (let ch = 0; ch < 3; ch++) {
        const m = (tmp[a + ch] + tmp[b + ch] + tmp[c + ch]) / 3;
        const o = q + ch;
        // (Live r7 polish: the push is held to 28 levels, so a strong edge
        // (an eye's rim) gets no halo while fine detail still sharpens; and a
        // difference within the camera's leftover noise, a few levels, gets
        // little of it (coring), so the picture is no less steady.)
        const d = px[o] - m;
        const ad = d < 0 ? -d : d;
        const push = amount * (ad < core ? (d * ad) / core : d);
        px[o] = px[o] + (push > limit ? limit : push < -limit ? -limit : push);
      }
    }
  }
}

// Live r7: smooths the depth within each surface and never across a jump (a
// small bilateral filter, 5 by 5): the model's guess wobbles a little from
// cell to cell over a face, and the splats lifted by it read as grain.
const SMOOTH_R = 2;
const SMOOTH_RANGE = 0.05; // depth differences beyond about this count as another surface
export function smoothSurface(d, w, h) {
  const out = new Float32Array(d.length);
  const inv = 1 / (2 * SMOOTH_RANGE * SMOOTH_RANGE);
  for (let y = 0; y < h; y++)
    for (let x = 0; x < w; x++) {
      const v = d[y * w + x];
      let s = 0;
      let n = 0;
      for (let j = Math.max(0, y - SMOOTH_R); j <= Math.min(h - 1, y + SMOOTH_R); j++)
        for (let i = Math.max(0, x - SMOOTH_R); i <= Math.min(w - 1, x + SMOOTH_R); i++) {
          const u = d[j * w + i];
          const k = Math.exp(-(u - v) * (u - v) * inv);
          s += u * k;
          n += k;
        }
      out[y * w + x] = s / n;
    }
  return out;
}

// The colors of a frame the depth model saw ({ w, h, data, crop }) at the
// grid's cells (r, g, b each, mirrored with the picture).
export function gridColors(frame, cols, rows, mirror) {
  const out = new Float32Array(cols * rows * 3);
  const [cx, cy, cw, ch] = frame.crop;
  for (let j = 0; j < rows; j++)
    for (let i = 0; i < cols; i++) {
      const u = mirror ? 1 - (i + 0.5) / cols : (i + 0.5) / cols;
      const fx = Math.min(frame.w - 1, Math.floor((cx + u * cw) * frame.w));
      const fy = Math.min(frame.h - 1, Math.floor((cy + ((j + 0.5) / rows) * ch) * frame.h));
      const o = (fy * frame.w + fx) * 4;
      const c = (j * cols + i) * 3;
      out[c] = frame.data[o];
      out[c + 1] = frame.data[o + 1];
      out[c + 2] = frame.data[o + 2];
    }
  return out;
}

// ---- The live view (the splat mirror, Photo to 3D's live view) -------------------------
// A picture of relief splats facing the viewer: `cols` by `rows`, `width`
// wide, rising toward the viewer by up to `lift` where the depth says it is
// near. Its canvas (the recipe's screen) holds the colors and the depth.

// Live r7 (the owner's "keep making it sharper" of October 5, 2026): a
// picture splat's diameter over its cell's width. 1.45 blurred the picture;
// at 1.2 neighbors still overlap, so no gaps show when it is turned. The
// polish round: 1.1, a little sharper and as steady turned (1.0 was sharper
// still, but less steady turned; docs/handoff/LiveR7.md).
const SPREAD = 1.1;

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
  const n = Math.max(3000, Math.min(140000, Math.floor(count * 0.8)));
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
  // Live r7: the hologram too (turned, it showed a hole beside the person).
  const withBack = wantBack;
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
        items.push({ p: [(u - 0.5) * width, (0.5 - v) * height, full * at(u, v)], n: [0, 0, 1], size: ((width / cols) * SPREAD) / 0.01, flat: 0.08, opacity: 1, color: "#808080", kind: "relief", params: [u, withBack ? v / 2 : v, 3, Math.max(0.001, full)], part, pattern: false }); // prettier-ignore
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
    spread: SPREAD,
    part,
    vs: withBack ? 0.5 : 1,
  });
  // (Live r7: half the depth's grid each way, as before the picture's grid
  // grew finer: the wall it learns is no finer than the depth it learns from.)
  const ds = Math.min(1, Math.sqrt(DEPTH_CELLS / (cols * rows)));
  const back = withBack && live.camera?.video ? { cols: Math.ceil((cols * ds) / 2), rows: Math.ceil((rows * ds) / 2) } : null; // prettier-ignore
  if (back)
    reliefGrid(k, {
      cols: back.cols,
      rows: back.rows,
      at: (u, v) => [(u - 0.5) * width, (0.5 - v) * height, -BACK_GAP],
      axis: 3,
      lift,
      n: [0, 0, 1],
      size: (width / back.cols) * 0.8, // (r6: smaller; they showed as blobs)
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
// brightness.
//
// Live r7 (the owner's push notes of October 4: "especially with the
// hologram view. It's like stuff is kind of put on top of the face"): the
// person (the near part, from the depth) is a clean cyan picture of
// themselves, with no lines or glow on them. The scanlines are only in the
// room behind, which is dimmer, and the glow is a soft rim on the room just
// outside the person's outline, so it lies behind and around them, never
// over them.
const RIM = 4; // cells
export function hologram(g, cols, rows, time) {
  const img = g.getImageData(0, 0, cols, rows);
  const px = img.data;
  const n = cols * rows;
  // How near each cell is (0 far .. 1 near).
  let near = MIRROR.nearNow;
  if (!near || near.length !== n) near = MIRROR.nearNow = new Float32Array(n);
  if (MIRROR.cam?.have) near.set(MIRROR.cam.heights);
  else if (MIRROR.cam) near.fill(0);
  else if (MIRROR.stillAt && MIRROR.near?.length === n) near.set(MIRROR.near);
  else {
    const hgt = g.getImageData(cols, 0, cols, rows).data;
    for (let i = 0; i < n; i++) near[i] = hgt[i * 4] / 255;
  }
  // The person (a soft 0..1), and each room cell's distance (in cells) to
  // them, up to RIM (a chamfer pass each way).
  const person = (MIRROR.personNow ||= new Float32Array(n));
  const dist = (MIRROR.distNow ||= new Float32Array(n));
  for (let i = 0; i < n; i++) {
    const v = near[i];
    person[i] = v <= 0.18 ? 0 : v >= 0.32 ? 1 : (v - 0.18) / 0.14;
    dist[i] = person[i] >= 0.5 ? 0 : RIM + 1;
  }
  for (let j = 0; j < rows; j++)
    for (let i = 0; i < cols; i++) {
      const k = j * cols + i;
      if (i > 0) dist[k] = Math.min(dist[k], dist[k - 1] + 1);
      if (j > 0) dist[k] = Math.min(dist[k], dist[k - cols] + 1);
    }
  for (let j = rows - 1; j >= 0; j--)
    for (let i = cols - 1; i >= 0; i--) {
      const k = j * cols + i;
      if (i < cols - 1) dist[k] = Math.min(dist[k], dist[k + 1] + 1);
      if (j < rows - 1) dist[k] = Math.min(dist[k], dist[k + cols] + 1);
    }
  // (Live r7, stability, October 6: the scanlines stand still; stepping a
  // row six times a second, they made the room flicker.)
  const shift = 0;
  for (let j = 0; j < rows; j++)
    for (let i = 0; i < cols; i++) {
      const k = j * cols + i;
      const o = k * 4;
      const y = (0.3 * px[o] + 0.59 * px[o + 1] + 0.11 * px[o + 2]) / 255;
      const m = person[k];
      // The person: clean, with their own light and shade.
      const vp = 0.12 + 0.88 * y;
      // The room: dimmer, with scanlines, and a glow just outside the outline.
      const scan = (j + shift) % 3 === 0 ? 0.6 : 1;
      const rim = dist[k] > 0 && dist[k] <= RIM ? 0.3 * (1 - (dist[k] - 1) / RIM) ** 2 : 0;
      const vr = (0.08 + 0.55 * y) * scan + rim;
      const v = Math.min(1, m * vp + (1 - m) * vr);
      px[o] = Math.round(255 * v * 0.35);
      px[o + 1] = Math.round(255 * Math.min(1, v * 0.95 + 0.05));
      px[o + 2] = Math.round(255 * Math.min(1, v * 1.1 + 0.1));
    }
  g.putImageData(img, 0, 0);
  // The background layer (in the canvas's lower half, behind the person) is
  // the room: dim cyan, with its scanlines.
  if (MIRROR.back && g.canvas.height >= rows * 2) {
    const bimg = g.getImageData(0, rows, cols, rows);
    const bp = bimg.data;
    for (let j = 0; j < rows; j++)
      for (let i = 0; i < cols; i++) {
        const o = (j * cols + i) * 4;
        const y = (0.3 * bp[o] + 0.59 * bp[o + 1] + 0.11 * bp[o + 2]) / 255;
        const v = (0.08 + 0.55 * y) * ((j + shift) % 3 === 0 ? 0.6 : 1);
        bp[o] = Math.round(255 * v * 0.35);
        bp[o + 1] = Math.round(255 * Math.min(1, v * 0.95 + 0.05));
        bp[o + 2] = Math.round(255 * Math.min(1, v * 1.1 + 0.1));
      }
    g.putImageData(bimg, 0, rows);
  }
}

export function mirrorStatus() {
  const cam = MIRROR.cam;
  if (!cam || !live.on("camera")) return "";
  if (cam.status) return cam.status;
  return cam.answers ? `Depth ${Math.round(1000 / Math.max(1, cam.ms))} times a second or so (${Math.round(cam.ms)} ms each), on this device.` : "Working out the depth…"; // prettier-ignore
}
