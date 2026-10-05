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
    // its depth comes back (the colors of a later frame wouldn't match it);
    // Live r7: and the depth's edges follow its colors.
    this.sent = { w, h, data: data.slice(), crop: this.crop.slice() };
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
    // (Live r7: the range wobbles a percent or two with the model's guess, and
    // every height with it, so a change within 5% of the span eases by 0.04
    // an answer; a bigger one, someone stepping nearer, by 0.3 as before.)
    const warm = this.answers <= 6; // the first answers settle quickly
    const ease = (was, now) => {
      if (was === null) return now;
      const span = Math.max(1e-6, (this.hi ?? hi) - (this.lo ?? lo));
      if (warm) return was + (now - was) * 0.5;
      return was + (now - was) * (Math.abs(now - was) < span * 0.05 ? 0.04 : 0.3);
    };
    const nlo = ease(this.lo, lo);
    this.hi = ease(this.hi, hi);
    this.lo = nlo;
    const span = Math.max(1e-6, this.hi - this.lo);
    for (let i = 0; i < t.length; i++) t[i] = Math.max(0, Math.min(1, (t[i] - this.lo) / span));
    // r5: where a near person stands before a far wall, the depth ramps
    // across a few cells, and those cells hung as stretched splats between
    // the two (the owner's "detaching" of October 3): each goes with the near
    // or the far side, whichever it is closer to.
    // r6 (the owner's "too flashy and too kind of grainy" of October 3):
    // each answer blends with the last where they differ a little (the
    // model's guess wanders from frame to frame), and keeps a real move
    // (over a quarter) as it is; then the edges are cut. Cells along an
    // outline used to flip between near and far from one answer to the next.
    //
    // Live r7 (the owner's push notes of October 4: "still a little bit too
    // grainy"): a steadier blend (0.15 of a change within the model's
    // wobble, rising smoothly to all of a clear move; was 0.4 below a quarter,
    // which let the wobble through and held a move back); then each
    // surface is smoothed within itself (smoothSurface: the model's guess
    // wobbles from cell to cell, and the splats, lifted by it, showed that
    // wobble as grain once turned), and only real jumps are cut, each cell
    // going with the side whose colors it has (snapEdges with the frame's
    // colors), so the cut follows the person's outline in the picture.
    const prev = this.smooth;
    if (prev && prev.length === t.length)
      for (let i = 0; i < t.length; i++) {
        const d = Math.abs(t[i] - prev[i]);
        const a = warm ? 0.6 : d <= 0.03 ? 0.15 : d >= 0.25 ? 1 : 0.15 + (0.85 * (d - 0.03)) / 0.22;
        t[i] = prev[i] + (t[i] - prev[i]) * a;
      }
    this.smooth = Float32Array.from(t);
    const colors = this.sent ? gridColors(this.sent, cols, rows, this.mirror) : null;
    t.set(snapEdges(smoothSurface(t, cols, rows), cols, rows, colors));
    // Live r7: the cells near an outline, with no lone cell on the wrong side.
    // (A per-frame step that moved the outline by each frame's colors between
    // answers was tried and left patches on a moving face; it is gone.)
    this.band = colors ? edgeBand(t, cols, rows) : null;
    if (this.band) tidyBand(this.band, t);
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
    if (!last || last.length !== cp.length) last = this.lastSmooth = Float32Array.from(cp);
    else
      for (let i = 0; i < cp.length; i += 4) {
        const d = Math.abs(cp[i] - last[i]) + Math.abs(cp[i + 1] - last[i + 1]) + Math.abs(cp[i + 2] - last[i + 2]); // prettier-ignore
        const a = d <= 18 ? 0.2 : d >= 72 ? 1 : 0.2 + (0.8 * (d - 18)) / 54;
        last[i] += (cp[i] - last[i]) * a;
        last[i + 1] += (cp[i + 1] - last[i + 1]) * a;
        last[i + 2] += (cp[i + 2] - last[i + 2]) * a;
        cp[i] = last[i];
        cp[i + 1] = last[i + 1];
        cp[i + 2] = last[i + 2];
      }
    this.lastColors = cp.slice();
    // Live r7: a light unsharp mask on what is drawn (the colors above stay
    // as they are, for the next frame): each cell moves away from the mean
    // of its 3 by 3 neighborhood by a share of the difference, so edges a cell or
    // two wide read crisply at phone size. The noise is smoothed first.
    // Live r7 polish (the owner's "the toys could still be sharper", October
    // 5): 1.2, held to 28 levels (sharpen); was 0.5.
    sharpen(cp, cols, rows, 1.2, (this.blurBuf ||= new Float32Array(cols * rows * 3)));
    g.putImageData(cur, 0, 0);
    // Heights ease toward the newest depth (about a fifth of a second).
    const k = 1 - Math.exp(-dt / 0.12);
    const kBig = 1 - Math.exp(-dt / 0.04);
    const hts = this.heights;
    const t = this.target;
    const img = g.createImageData(cols, rows);
    const px = img.data;
    for (let i = 0; i < hts.length; i++) {
      // r5: a big jump (a person's edge moving) is quick, so no splat
      // lingers in the gap between near and far; r6: quick rather than at
      // once (it flashed), and small changes ease, which keeps the depth
      // from shimmering.
      if (this.have) hts[i] += (t[i] - hts[i]) * (Math.abs(t[i] - hts[i]) > 0.3 ? kBig : k);
      const o = i * 4;
      px[o] = Math.round(255 * (this.have ? hts[i] * gain : 0));
      px[o + 3] = 255;
    }
    g.putImageData(img, cols, 0);
    if (this.back) this.back.draw(g, cols, rows, gain, hts);
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
    const [cx, cy, cw, ch] = frame.crop;
    for (let y = 0; y < br; y++)
      for (let x = 0; x < bc; x++) {
        const c = y * bc + x;
        // Live r7: GUARD cells clear of the person (was one), so the rim of
        // their outline isn't learned as wall: the depth model draws a
        // person's outline a little inside their hair and ears, and those
        // colors, learned as wall, showed as a ghost of the person beside
        // them, seen from the side.
        let edge = false;
        for (let j = Math.max(0, y - GUARD); j <= Math.min(br - 1, y + GUARD) && !edge; j++)
          for (let i = Math.max(0, x - GUARD); i <= Math.min(bc - 1, x + GUARD); i++)
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
  // r6 (the owner's review of October 3: the fill showed over the camera's
  // picture, and as blobs when zoomed out): its splats show only within
  // two of its cells of a near part of the picture (where the person
  // stands and just beside), everywhere else they hide; and they sit
  // BACK_GAP behind the wall (a signed offset, relief axis 3). hts: the
  // picture's heights now (0 far .. 1 near).
  draw(g, cols, rows, gain, hts) {
    const { cols: bc, rows: br, vals } = this;
    if (!this.img || this.img.width !== cols * 2 || this.img.height !== rows) this.img = g.createImageData(cols * 2, rows); // prettier-ignore
    const px = this.img.data;
    // Which of its cells are near now, then that grown by two cells.
    const near = (this.near ||= new Uint8Array(bc * br));
    near.fill(0);
    if (hts)
      for (let j = 0; j < rows; j++) {
        const y = Math.min(br - 1, Math.floor((j * br) / rows));
        for (let i = 0; i < cols; i++) if (hts[j * cols + i] >= FAR) near[y * bc + Math.min(bc - 1, Math.floor((i * bc) / cols))] = 1; // prettier-ignore
      }
    const show = (this.show ||= new Uint8Array(bc * br));
    show.fill(0);
    for (let y = 0; y < br; y++)
      for (let x = 0; x < bc; x++) {
        if (!near[y * bc + x]) continue;
        for (let j = Math.max(0, y - 2); j <= Math.min(br - 1, y + 2); j++)
          for (let i = Math.max(0, x - 2); i <= Math.min(bc - 1, x + 2); i++) show[j * bc + i] = 1;
      }
    for (let j = 0; j < rows; j++) {
      const y = Math.min(br - 1, Math.floor((j * br) / rows));
      for (let i = 0; i < cols; i++) {
        const b = y * bc + Math.min(bc - 1, Math.floor((i * bc) / cols));
        const c = b * 4;
        const o = (j * cols * 2 + i) * 4;
        px[o] = vals[c];
        px[o + 1] = vals[c + 1];
        px[o + 2] = vals[c + 2];
        px[o + 3] = 255;
        const q = o + cols * 4;
        px[q] = px[q + 1] = 128;
        px[q + 2] = Math.round(255 * (0.5 + Math.max(0, vals[c + 3] * gain) / 2));
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
export function sharpen(px, w, h, amount, tmp) {
  for (let ch = 0; ch < 3; ch++) {
    for (let y = 0; y < h; y++)
      for (let x = 0; x < w; x++) {
        const a = px[(y * w + Math.max(0, x - 1)) * 4 + ch];
        const b = px[(y * w + x) * 4 + ch];
        const c = px[(y * w + Math.min(w - 1, x + 1)) * 4 + ch];
        tmp[(y * w + x) * 3 + ch] = (a + b + c) / 3;
      }
  }
  for (let y = 0; y < h; y++) {
    const y0 = Math.max(0, y - 1);
    const y1 = Math.min(h - 1, y + 1);
    for (let x = 0; x < w; x++)
      for (let ch = 0; ch < 3; ch++) {
        const m = (tmp[(y0 * w + x) * 3 + ch] + tmp[(y * w + x) * 3 + ch] + tmp[(y1 * w + x) * 3 + ch]) / 3; // prettier-ignore
        const o = (y * w + x) * 4 + ch;
        // (Live r7 polish: the push is held to 28 levels, so a strong edge
        // (an eye's rim) gets no halo while fine detail still sharpens; and a
        // difference within the camera's leftover noise, a few levels, gets
        // little of it (coring), so the picture is no less steady.)
        const d = px[o] - m;
        const ad = d < 0 ? -d : d;
        const push = amount * (ad < CORE ? (d * ad) / CORE : d);
        px[o] = px[o] + (push > 28 ? 28 : push < -28 ? -28 : push);
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
  const back = withBack && live.camera?.video ? { cols: Math.ceil(cols / 2), rows: Math.ceil(rows / 2) } : null; // prettier-ignore
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
// themselves, with no lines or glow on them. The scanlines (drifting slowly
// upward) are only in the room behind, which is dimmer, and the glow is a
// soft rim on the room just outside the person's outline, so it lies behind
// and around them, never over them.
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
  const shift = Math.floor(time * 6) % 3;
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
