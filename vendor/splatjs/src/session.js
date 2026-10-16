// session.js — layer 2: the one object a UI talks to.
//
//   const s = createSession();
//   s.on('stage',   e => ...)   // { stage, done, total, detail }
//   s.on('metrics', e => ...)   // { iter, splats, itersPerSec, psnrTrain, psnrHold }
//   s.on('event',   e => ...)   // { kind: 'refine' | 'train-complete', ... }
//   s.on('log',     m => ...)   // prose, for consoles
//
//   await s.load(files);        // File[] / Blob[] -> Frames
//   await s.solve();            // SfM: cameras + sparse points
//   await s.seed();             // Gaussians + WebGPU trainer
//   s.start(); s.pause();       // the training loop (policy lives HERE)
//
//   s.view.attach(canvas);      // render target
//   s.view.lookThrough(i);      // camera = training frame i
//   s.view.setCamera(pose);     // free camera
//   await s.exportPlyBlob();    // standard 3DGS .ply (opacity comp baked)
//
// All numeric policy that used to live in the demo page is here: iteration
// batching, auto-stop, refine cadence, blur exclusion, holdout choice, PSNR
// conversion, and the hidden-tab watchdog.

import { decodeFrames } from './io/frames.js';
import { focalPxFrom35 } from './io/exif.js';
import { isEquirect, sliceEquirect, faceSizeFor, probeImageSize, FACE_ROTS } from './io/pano.js';
import { runSfM } from './sfm/sfm.js';
import { initGaussians } from './gs/init.js';
import { buildVisualHull, makeHullTest, makeSplatTest } from './gs/hull.js';
import { GSTrainer } from './gs/trainer.js';
import { createGpu } from './gpu/context.js';
import { gaussiansToPly, bakeOpacityCompensation, unbakeOpacityCompensation } from './io/ply.js';

/** world-space position of a camera pose {R, t} */
export function camPosition({ R, t }) {
  return [
    -(R[0] * t[0] + R[3] * t[1] + R[6] * t[2]),
    -(R[1] * t[0] + R[4] * t[1] + R[7] * t[2]),
    -(R[2] * t[0] + R[5] * t[1] + R[8] * t[2]),
  ];
}

/** Undistort training images in place (bilinear resample) so the pinhole
 *  trainer matches BA's distortion-corrected geometry. Returns true when a
 *  resample actually happened (|k| above the noise floor). Out-of-frame
 *  samples get a -1 sentinel the trainer excludes from the loss. */
export function undistortFrames(frames, recon) {
  const { k1, k2 } = recon;
  // below ~0.01 the estimated distortion is noise (synthetic GT k1=0 comes
  // back as ~0.005) and resampling would only soften the targets
  if (Math.abs(k1) < 0.01 && Math.abs(k2) < 0.01) return false;
  for (const im of frames) {
    const f = recon.fFeat * (im.tw / im.fw);
    const cx = im.tw / 2, cy = im.th / 2;
    const src = im.rgb;
    const dst = new Float32Array(src.length);
    for (let y = 0; y < im.th; y++) {
      for (let x = 0; x < im.tw; x++) {
        const xp = (x + 0.5 - cx) / f, yp = (y + 0.5 - cy) / f;
        const r2 = xp * xp + yp * yp;
        const D = 1 + k1 * r2 + k2 * r2 * r2;
        const rx = f * xp * D + cx - 0.5;
        const ry = f * yp * D + cy - 0.5;
        const o = (y * im.tw + x) * 3;
        if (rx < 0 || ry < 0 || rx > im.tw - 1.001 || ry > im.th - 1.001) {
          dst[o] = -1; dst[o + 1] = -1; dst[o + 2] = -1;
          continue;
        }
        const x0 = rx | 0, y0 = ry | 0;
        const fx = rx - x0, fy = ry - y0;
        const i00 = (y0 * im.tw + x0) * 3, i01 = i00 + 3;
        const i10 = i00 + im.tw * 3, i11 = i10 + 3;
        for (let c = 0; c < 3; c++) {
          dst[o + c] =
            src[i00 + c] * (1 - fx) * (1 - fy) + src[i01 + c] * fx * (1 - fy) +
            src[i10 + c] * (1 - fx) * fy + src[i11 + c] * fx * fy;
        }
      }
    }
    if (im.alpha) {
      // the subject alpha rides along (nearest), or it drifts off the photo
      const adst = new Uint8Array(im.alpha.length);
      for (let y = 0; y < im.th; y++) {
        for (let x = 0; x < im.tw; x++) {
          const xp = (x + 0.5 - cx) / f, yp = (y + 0.5 - cy) / f;
          const r2 = xp * xp + yp * yp;
          const D = 1 + k1 * r2 + k2 * r2 * r2;
          const rx = Math.round(f * xp * D + cx - 0.5), ry = Math.round(f * yp * D + cy - 0.5);
          adst[y * im.tw + x] = (rx < 0 || ry < 0 || rx >= im.tw || ry >= im.th) ? 0 : im.alpha[ry * im.tw + rx];
        }
      }
      im.alpha = adst;
    }
    im.rgb = dst;
  }
  return true;
}

/**
 * @typedef {object} SessionOptions
 * @property {GPUDevice} [device]        host-owned WebGPU device to share
 * @property {number} [maxIters=60000]   auto-stop; trainer schedules scale to it
 * @property {number} [itersPerFrame=15] training batch per animation frame
 * @property {number} [refineStart=1500] first refinement threshold (short browser runs may lower it)
 * @property {number} [initTarget=60000] initial Gaussian count (grows during training)
 * @property {number|'auto'|null} [holdout='auto']  frame excluded from training
 *   and scored as the novel-view metric; 'auto' picks a sharp mid-sequence frame
 * @property {number} [evalHoldEvery=4000]  holdout PSNR cadence (iterations)
 * @property {number} [evalSplit=0]  the standard benchmark protocol: every Nth
 *   frame of the input order is excluded from training and scored together via
 *   evalTestPsnr() (papers use N=8); 0 = off
 * @property {string[]} [evalFrames]  explicit test set by frame name (overrides evalSplit;
 *   a fixed ruler when the frame set itself is what varies, e.g. video extraction variants)
 * @property {object} [sfm]              SfmOptions passed to solve()
 * @property {object} [trainer]          extra GSTrainer options (shDeg, ...)
 * @property {object} [frames]           FrameOptions passed to load()
 */

class Emitter {
  constructor() { this.map = new Map(); }
  on(type, fn) {
    if (!this.map.has(type)) this.map.set(type, new Set());
    this.map.get(type).add(fn);
    return () => this.map.get(type).delete(fn);
  }
  emit(type, e) {
    const s = this.map.get(type);
    if (s) for (const fn of s) fn(e);
  }
}

export class Session {
  /** @param {SessionOptions} [opts] */
  constructor(opts = {}) {
    this.opts = opts;
    this._lifetime = new AbortController();
    this._disposed = false;
    this.frames = [];
    this.recon = null;      // solve() result: { cams, points, k1, k2, ... }
    this.model = null;      // seed() result: { data, n, center, radius }
    this.trainer = null;
    this.gpu = null;
    this.holdout = -1;
    this.testCams = [];
    this.training = false;
    this._trainingFailure = null;
    this.lossHistory = [];  // [iter, psnrTrain]
    this._fences = [];      // in-flight batch fences (see _frameLoop)
    // Per-frame loop timings, recorded by default — the cost is a handful of
    // performance.now() calls and one small array row per submitted batch.
    // opts.perf: false disables.
    this.perf = opts.perf === false ? null : { frames: [], marks: [] };
    this._em = new Emitter();
    this._debug = null;     // solver internals (feats/tracks) for UI beats
    this.view = new SessionView(this);
  }

  on(type, fn) { return this._em.on(type, fn); }
  _log(m) { if (!this._disposed) this._em.emit('log', m); }
  _stage(e) { if (!this._disposed) this._em.emit('stage', e); }

  _assertActive() {
    if (this._disposed) throw new DOMException('Session disposed', 'AbortError');
  }

  async _getGpu() {
    this._assertActive();
    if (this.gpu) return this.gpu;
    const gpu = await createGpu({ device: this.opts.device });
    if (this._disposed) {
      if (gpu.owned) gpu.dispose();
      this._assertActive();
    }
    this.gpu = gpu;
    gpu.onLost = (info) => { if (!this._disposed) this._deviceLost(info); };
    return gpu;
  }

  async _createTrainer(options) {
    this._assertActive();
    const trainer = await GSTrainer.create(options);
    if (this._disposed) {
      trainer.dispose();
      this._assertActive();
    }
    this.trainer = trainer;
    this._trainingFailure = null;
    return trainer;
  }

  /** Decode photographs into Frames. files: File[]/Blob[]/{source,name}[]
   *  360 equirectangular panos (2:1 aspect) are detected here and sliced
   *  into six-face cubemap rigs — the solver then treats each pano as ONE
   *  camera pose and the trainer sees ordinary pinhole faces. */
  async load(files) {
    this._assertActive();
    this._stage({ stage: 'decode', done: 0, total: files.length });
    const { prepared, rigs, focalNative, faceSize } = await this._slicePanos(files);
    this._assertActive();
    const frames = await decodeFrames(prepared, {
      ...this.opts.frames, signal: this._lifetime.signal, log: (m) => this._log(m),
    });
    this._assertActive();
    this.frames = frames;
    this._stage({ stage: 'decode', done: this.frames.length, total: files.length });
    if (this.frames.length < 2) throw new Error('need at least 2 decodable images');
    if (rigs) {
      // the sliced focal is exact but lives in face-native pixels; the
      // solver works at feature scale
      this.rigInfo = rigs;
      this.rigFocalPx = focalNative * this.frames[0].fw / faceSize;
      this._log(`camera rigs active: ${new Set(rigs.filter(Boolean).map((r) => r.id)).size} panos, ` +
        `focal ${this.rigFocalPx.toFixed(1)}px (known from the slice)`);
    }
    return this.frames;
  }

  /** Detect equirect panos in the input and slice them into rig faces.
   *  Detection reads image HEADERS only (probeImageSize) — a normal photo
   *  set pays nothing here; panos are decoded once, sliced, released. */
  async _slicePanos(files) {
    const meta = [];
    let panos = 0, sized = 0, maxW = 0;
    for (const f of files) {
      this._assertActive();
      const src = f && f.source !== undefined ? f.source : f;
      const name = (f && f.name) || (src && src.name) || `image_${meta.length}`;
      const dims = await probeImageSize(src);
      this._assertActive();
      const pano = !!dims && isEquirect(dims.w, dims.h);
      if (dims) sized++;
      if (pano) { panos++; maxW = Math.max(maxW, dims.w); }
      meta.push({ src, name, pano });
    }
    if (!panos) return { prepared: files, rigs: null };
    if (panos < sized) {
      throw new Error('mixed input: 360 panoramas and regular photos in one set are not ' +
        'supported yet — drop either panos or photos, not both');
    }
    // one shared face size + fov for the whole set (the solver's focal is shared)
    const size = faceSizeFor(maxW);
    this._log(`360 input: slicing ${panos} equirectangular panos into ${size}px cubemap rigs`);
    const prepared = [], rigs = [];
    let f = 0, rigId = 0;
    for (const b of meta) {
      this._assertActive();
      const bmp = await createImageBitmap(b.src);
      let sl;
      try {
        this._assertActive();
        sl = sliceEquirect(bmp, size);
      } finally { bmp.close?.(); }
      f = sl.f;
      const base = b.name.replace(/\.[^.]+$/, '');
      sl.faces.forEach((cv, k) => {
        prepared.push({ source: cv, name: `${base}_f${k}` });
        rigs.push({ id: rigId, R: FACE_ROTS[k] });
      });
      rigId++;
      this._stage({ stage: 'decode', done: rigId, total: meta.length });
      await new Promise((r) => setTimeout(r, 0));
    }
    return { prepared, rigs, focalNative: f, faceSize: size };
  }

  /** Use frames prepared elsewhere (e.g. processSource on fetched bitmaps). */
  useFrames(frames) { this._assertActive(); this.frames = frames; return frames; }

  /** Structure from motion: camera poses + sparse points from the frames.
   *  extra.minCameras optionally rejects an undersized solve before mutating
   *  training pictures or releasing feature frames, so the caller can retry. */
  async solve(extra = {}) {
    this._assertActive();
    const controller = new AbortController();
    const signals = [this._lifetime.signal, extra.signal].filter(Boolean);
    const cancel = () => controller.abort();
    for (const signal of signals) {
      signal.addEventListener('abort', cancel, { once: true });
      if (signal.aborted) cancel();
    }
    try { return await this._solve({ ...extra, signal: controller.signal }); }
    finally { for (const signal of signals) signal.removeEventListener('abort', cancel); }
  }

  async _solve(extra = {}) {
    const opts = { ...this.opts.sfm, ...extra };
    if (opts.minCameras != null && (!Number.isSafeInteger(opts.minCameras) || opts.minCameras < 2))
      throw new RangeError('minCameras must be a safe integer of at least 2');
    if (this.rigInfo && !opts.rigs) {
      opts.rigs = this.rigInfo;
      opts.focalPx = opts.focalPx ?? this.rigFocalPx;
      // sliced faces are bilinear resamples of the pano: the upsampled SIFT octave
      // (desktop default -1 since 2026-09-04) finds "features" in the interpolation.
      // MEASURED bar360 30k 2026-09-06: octave -1 19.90-19.95 vs octave 0 20.64-20.69
      // (aspect and the 8000 budget are neutral) — rigs never search below octave 0.
      if ((opts.siftFirstOctave ?? 0) < 0) opts.siftFirstOctave = 0;
      // and their f, k1 = k2 = 0, square pixel are exact by construction: BA refining
      // them only fits noise. MEASURED bar360 30k: lock +0.29 (old solve 20.69 -> 20.98),
      // +0.22 on the octave -1 solve. sfm.lockIntrinsics: false opts out.
      opts.lockIntrinsics = opts.lockIntrinsics ?? true;
    }
    // EXIF focal prior: when most photos carry the same 35 mm-equivalent
    // focal (one phone, one lens), the solver starts from it and skips the
    // four-candidate focal search (sfm.js keeps the search as the fallback).
    // sfm.exifFocal: false opts out; a rig's exact focal takes precedence.
    if (opts.exifFocal !== false && !opts.focalPx && !opts.focalPrior) {
      const f35s = this.frames.map((f) => f.exif && f.exif.f35).filter((v) => v > 0);
      if (f35s.length >= Math.max(2, 0.6 * this.frames.length)) {
        const sorted = [...f35s].sort((a, b) => a - b);
        const med = sorted[sorted.length >> 1];
        const spread = sorted[sorted.length - 1] / sorted[0];
        if (spread <= 1.1) {
          const fr = this.frames[0];
          opts.focalPrior = focalPxFrom35(med, fr.fw, fr.fh);
          this._log(`EXIF focal ${med} mm (35 mm-equivalent) on ${f35s.length}/${this.frames.length} photos → ` +
            `prior ${opts.focalPrior.toFixed(1)} px at the ${fr.fw} px feature frame`);
          // a VIDEO's 35 mm value names the lens, not the recording: stabilisation and
          // the video sensor crop lengthen the effective focal by up to ~1.5x. The prior
          // is tried first (accepted at >= 60 % registration); the fallback search then
          // runs on a narrow grid of crop factors around it instead of the whole range,
          // which on a person orbit picked three different focals at three feature
          // resolutions (2026-09-15)
          if (this.frames.some((f) => f.exif && f.exif.video)) {
            // a VIDEO's 35 mm value names the lens, not the recording: taken as the
            // focal it is accepted at >= 60 % registration and bent (Tom: 0.37x, 62/65);
            // narrowed to crop factors 1.0-1.55 the search still picked 0.46x (62/65,
            // ghosting) where the free search on every frame finds 0.55x with 65/65
            // and a clean model (2026-09-15). So for video the lens is logged and the
            // focal search keeps its own range; the every-frame search carries it.
            opts.focalPrior = 0;
            this._log(`video lens ${med} mm (35 mm-equivalent): noted, the focal search keeps its full range (a person orbit's effective focal is the lens x an unknown crop)`);
          }
        } else {
          this._log(`EXIF focal varies across the set (${sorted[0]}–${sorted[sorted.length - 1]} mm) — focal search kept`);
        }
      }
    }
    // the GPU matcher shares the session device (created here rather than at
    // seed) — it carries the raised buffer limits big feature sets need
    await this._getGpu();
    this._assertActive();
    const recon = await runSfM(
      this.frames,
      (m) => this._log(m),
      (imgIdx, x, y) => this.frames[imgIdx].sampleColor(x, y),
      {
        gpu: this.gpu,
        ...opts,
        onEvent: (e) => { this._stage(e); if (opts.onEvent) opts.onEvent(e); },
        debug: (d) => { this._debug = d; if (opts.debug) opts.debug(d); },
      });
    this._assertActive();
    if (opts.signal?.aborted) throw new DOMException('SfM aborted', 'AbortError');
    if (opts.minCameras != null && recon.cams.length < opts.minCameras)
      throw new Error(`only ${recon.cams.length} cameras placed; at least ${opts.minCameras} cameras are required`);
    this.recon = recon;
    if (undistortFrames(this.frames, this.recon)) {
      this._log(`undistorted training images (k1 ${this.recon.k1.toFixed(4)}, k2 ${this.recon.k2.toFixed(4)})`);
    }
    if (this.opts.lowMem) {
      // the feature-scale grayscale is solve-only (SIFT + LK); on phones
      // 50 frames of it is ~140MB standing between us and the trainer
      for (const f of this.frames) f.gray = null;
    }
    this._stage({ stage: 'solved', done: 1, total: 1, detail: {
      cams: this.recon.cams.length, points: this.recon.points.length,
      rms: this.recon.rmsBA,
    } });
    return this.recon;
  }

  /** Load a reconstruction obtained elsewhere ({ cams, points, ... }). */
  useReconstruction(recon) {
    this._assertActive();
    this.recon = { k1: 0, k2: 0, fScale: 1, medErr: 0, rmsBA: null, ...recon };
    // stored/external recons (a resumed run, a GT solve) usually lack fFeat.
    // undistortFrames divides by it — undefined turned EVERY target pixel
    // NaN→invalid, so a continued run trained against emptiness and faded
    // itself to transparency. All cams share the solve's feature-scale
    // focal, so the first one serves.
    if (this.recon.fFeat == null && this.recon.cams && this.recon.cams.length) {
      this.recon.fFeat = this.recon.cams[0].f;
    }
    return this.recon;
  }

  /** Drop sparse-cloud points that the subject masks put in empty space.
   *
   *  Without this, a masked run SEEDS THE THING IT IS TRYING TO REMOVE: the
   *  sparse cloud is mostly room, and a room Gaussian that reaches opacity ~1
   *  can never come back down, because dalpha/d(logit opacity) = o(1-o)(...)
   *  vanishes as o -> 1. Neither the coverage loss nor opacityReg can rescue a
   *  saturated splat; both only govern what grows. So the cure is not to
   *  create it. (Measured 2026-09-11: coverage loss alone, covW 3, left the
   *  room fully opaque at 45% dead splats.)
   *
   *  The masks are already in the frames (frame.alpha), so this needs no
   *  extra input. A point is kept when
   *  it lands on the subject in at least `keep` of the views that see it.
   */
  maskPoints(keep = 0.5) {
    const frames = this.frames;
    if (!frames.some((f) => f.alpha && f.emptyFrac > 0)) return 0;
    const pts = this.recon.points;
    const seen = new Int32Array(pts.length);
    const subj = new Int32Array(pts.length);
    for (const c of this.recon.cams) {
      const im = frames[c.imgIdx];
      const sx = im.tw / im.fw, sy = im.th / im.fh;
      const { R, t } = c;
      for (let i = 0; i < pts.length; i++) {
        const X = pts[i].X;
        const z = R[6] * X[0] + R[7] * X[1] + R[8] * X[2] + t[2];
        if (z <= 1e-6) continue;
        const u = (c.f * (R[0] * X[0] + R[1] * X[1] + R[2] * X[2] + t[0]) / z + c.cx) * sx;
        const v = ((c.fy ?? c.f) * (R[3] * X[0] + R[4] * X[1] + R[5] * X[2] + t[1]) / z + c.cy) * sy;
        if (u < 0 || v < 0 || u >= im.tw || v >= im.th) continue;
        seen[i]++;
        if (im.alpha[(v | 0) * im.tw + (u | 0)] > 64) subj[i]++;   // not known-empty
      }
    }
    const before = pts.length;
    this.recon.points = pts.filter((_, i) => seen[i] > 0 && subj[i] / seen[i] >= keep);
    const dropped = before - this.recon.points.length;
    this._log(`subject mask: seeding from ${this.recon.points.length} of ${before} points `
      + `(${(100 * dropped / before).toFixed(0)}% of the sparse cloud was background)`);
    // a solve that registered the room but not the person (a wrong focal
    // winner: Lisa's 4K orbit put 108 of 13741 points on her once, seeded 14,
    // and trained 2,814 splats for 20k iterations, 2026-09-14) must stop
    // here — nothing downstream can recover a subject that was never seeded
    if (before >= 2000 && this.recon.points.length < Math.max(150, 0.01 * before))
      throw new Error(`the solve missed the person: only ${this.recon.points.length} of ${before} sparse points land on the subject — try again, or shoot a slower orbit at arm's length`);
    return dropped;
  }

  /** Carve the subject hull from the masks and hand it to the trainer, so
   *  refinement treats anything in provably empty space as dead capacity.
   *  No-op when the frames carry no masks. */
  _buildHull(opts = {}) {
    if (opts.hull === false) return null;
    const t0 = Date.now();
    const hull = buildVisualHull(this.recon, this.frames, opts.hullOpts);
    if (!hull) return null;
    this.hull = hull;
    this.hullTest = makeHullTest(hull);
    this.splatTest = makeSplatTest(hull, opts.hullOpts);
    // seed from inside the hull only: the silhouette test alone cannot remove
    // a point that sits along the viewing ray through the subject, and those
    // stragglers are what blow the scene bounds out
    const before = this.recon.points.length;
    const inside = this.recon.points.filter((p) => this.hullTest(p.X[0], p.X[1], p.X[2]));
    this._log(`subject hull: ${hull.dim.join('x')} voxels of ${hull.cell.toFixed(3)} (box ${hull.dim.map((d) => (d * hull.cell).toFixed(2)).join('x')}), ${(hull.fill * 100).toFixed(1)}% solid, `
      + `carved in ${((Date.now() - t0) / 1000).toFixed(1)}s; seeding from `
      + `${inside.length} of ${before} points inside it`);
    // a hull that disagrees with the masks (a bounding box blown out by ray
    // stragglers, a matte that does not line up) would seed NOTHING and
    // kill every splat that grows — the run trained 0 Gaussians in the app,
    // 2026-09-13. Then the masks alone must do: no hull, all mask-filtered points.
    if (inside.length < Math.max(8, 0.05 * before) || hull.fill < 0.002) {
      this._log(`subject hull rejected (${inside.length} of ${before} points, ${(hull.fill * 100).toFixed(2)}% solid) — training on the masks alone`);
      this.hull = null; this.hullTest = null; this.splatTest = null;
      return null;
    }
    this.recon.points = inside;
    return hull;
  }

  /** Seed Gaussians from the sparse cloud and set up the WebGPU trainer.
   *  extra.seedLimit optionally bounds base + appended rows, reserving append capacity first.
   *  model.appendedSeedCount reports how many appended rows actually fit. */
  async seed(extra = {}) {
    this._assertActive();
    if (!this.recon) throw new Error('solve() first');
    this._stage({ stage: 'seed', done: 0, total: 1 });
    const allPoints = this.recon.points;
    if (!allPoints?.length)
      throw new Error('The camera solve found no 3D points. Try a steadier stretch with more textured detail.');
    // opts.maskTraining === false: the mattes stay on the frames (the hull and
    // the cut after training read them) but training does not see them — no
    // seed filter, no hull kill, no random background, alpha 255 in the
    // targets. The masked recipe drove the needle look on a person (needle
    // ratio 344 vs 15 for the same clip trained as a room, 2026-09-14b).
    const masked = this.opts.maskTraining !== false;
    if (masked && extra.maskPoints !== false) this.maskPoints(extra.maskKeep ?? 0.5);
    if (masked) this._buildHull(extra);
    if (this.recon.points.length < 8) {
      // never seed from nothing: the whole cloud beats an empty model
      this._log(`subject filters left ${this.recon.points.length} points — seeding from the whole cloud instead`);
      this.recon.points = allPoints;
    }
    // default seed scales with the solve's point count: the flat 60k
    // default seed-bound capacity (cap = seed x capMult) on point-rich
    // scenes — garden measured +0.4 dB from lifting it. Explicit
    // initTarget (phones pass one) always wins.
    const target = extra.initTarget || this.opts.initTarget ||
      Math.min(250000, Math.max(60000, this.recon.points.length * 8));
    // The 24 cap suits a scene cloud, where points are plentiful and heavy
    // cloning only duplicates. A masked SUBJECT cloud is the opposite case —
    // a person in dark clothing gives few hundred points — and capping there
    // starves the model (measured: 468 points -> 11.7k seed -> 15.7k splats
    // at 6k cycles, 2 dB down). Lift the cap when the cloud is small so the
    // seed still reaches the target.
    const cloneCap = this.recon.points.length < 5000 ? 200 : 24;
    const desiredClones = Math.min(cloneCap, Math.max(2, Math.round(target / this.recon.points.length) - 1));
    const v2 = this.opts.trainer && this.opts.trainer.engine === 'v2';
    const convention = v2 ? { dc: 'sh', randRot: true } : {};
    if (this.opts.robustSeedBounds === true) convention.robustBounds = true;
    const appended = extra.appendGaussians;
    let appendCount = appended?.n > 0 ? appended.n : 0;
    this._appendedSeed = null;
    if (extra.seedLimit != null) {
      if (!Number.isInteger(extra.seedLimit) || extra.seedLimit < 1)
        throw new Error('seedLimit must be a positive integer');
      const limit = Math.min(extra.seedLimit, extra.trainer?.maxSplats ?? this.opts.trainer?.maxSplats ?? 600000);
      appendCount = Math.min(appendCount, limit);
      const baseLimit = limit - appendCount;
      const all = this.recon.points;
      // Keep coverage of the full cloud if one original per point cannot fit. Never take a
      // prefix: solver ordering is capture-dependent and can otherwise erase a whole region.
      const points = baseLimit > 0 && baseLimit < all.length
        ? Array.from({ length: baseLimit }, (_, i) => all[Math.floor((i + 0.5) * all.length / baseLimit)])
        : all;
      const clones = Math.min(desiredClones, Math.max(0, Math.ceil(baseLimit / points.length) - 1));
      const baseCount = Math.min(baseLimit, points.length * (clones + 1));
      const complete = initGaussians(points, clones, baseCount ? points.length * (clones + 1) : 0, convention);
      if (clones > 0) {
        // initGaussians groups each original with its clones. A prefix cut would lose later
        // originals even when one per point fits, so retain every original before extra copies.
        const data = new Float32Array(baseCount * 16);
        for (let i = 0; i < points.length; i++)
          data.set(complete.data.subarray(i * (clones + 1) * 16, (i * (clones + 1) + 1) * 16), i * 16);
        const extraCount = baseCount - points.length;
        for (let i = 0; i < extraCount; i++) {
          const index = Math.floor((i + 0.5) * points.length * clones / extraCount);
          const row = Math.floor(index / clones) * (clones + 1) + index % clones + 1;
          data.set(complete.data.subarray(row * 16, (row + 1) * 16), (points.length + i) * 16);
        }
        this.model = { ...complete, data, n: baseCount };
      } else this.model = complete;
    } else {
      // Keep the established count, clone cap, and parameter bytes when no limit is requested.
      this.model = initGaussians(this.recon.points, desiredClones, undefined, convention);
    }
    // Ready-made rows use the sigmoid-DC convention. Reserve their capacity before sparse
    // clones so a trainer ceiling cannot silently truncate all appended surface detail.
    this.model.appendedSeedCount = appendCount;
    if (appendCount > 0) {
      const g = appended, m = this.model, merged = new Float32Array((m.n + appendCount) * 16);
      merged.set(m.data.subarray(0, m.n * 16), 0);
      for (let i = 0; i < appendCount; i++) {
        const index = Math.floor((i + 0.5) * g.n / appendCount);
        merged.set(g.data.subarray(index * 16, (index + 1) * 16), (m.n + i) * 16);
      }
      this.model = { ...m, data: merged, n: m.n + appendCount };
      this._appendedSeed = { from: m.n, to: m.n + appendCount, protectIters: g.protectIters || 0, freezePos: !!g.freezePos };
      this._log(`+ ${appendCount} seed Gaussians appended (${g.note || 'ready-made'})${g.protectIters ? `, protected from relocation for ${g.protectIters} iterations` : ''}`);
    }
    this._log(`initialized ${this.model.n} Gaussians (scene radius ${this.model.radius.toFixed(2)})`);

    await this._getGpu();
    this._assertActive();
    const gi = this.gpu.info || {};
    // opts.shHorizontal: SH evaluated on the view direction's horizontal part only —
    // the up axis is the cameras' dominant up (minus each R's second row)
    const shUp = this.opts.shHorizontal ? this._camerasUp() : null;
    if (shUp) this._log(`SH on the horizontal view direction only (up ${shUp.map((v) => v.toFixed(2)).join(', ')})`);
    const trainerOpts = {
      maxIters: this.opts.maxIters ?? 60000,
      ...(shUp ? { shUp } : {}),
      // a masked set trains its empty pixels against a random background by
      // default (gs/shaders.js randBg) — the thing that keeps splats out of
      // the cleared area at full photometric strength
      ...(masked && this.frames && this.frames.some((f) => f.emptyFrac > 0) ? { randomBg: true } : {}),
      ...this.opts.trainer, ...extra.trainer,
      gpu: this.gpu,
    };
    await this._createTrainer(trainerOpts);
    this._assertActive();
    this._log(`GPU: ${gi.vendor || 'unknown'} ${gi.architecture || ''} — ` +
      `${this.trainer.tileGrad ? 'tile-shared' : 'direct'} gradient accumulation`);

    // training-resolution intrinsics (recon poses live at feature scale)
    const cams = this.recon.cams.map((c) => {
      const im = this.frames[c.imgIdx];
      const s = im.tw / im.fw;
      return { ...c, f: c.f * s, ...(c.fy != null ? { fy: c.fy * s } : {}),
        // the principal point is normally the frame centre; a crop camera (a
        // native-resolution window cut out of a larger image, see
        // tests/bench/face_crops.py) carries its own, at feature scale
        cx: c.cx != null ? c.cx * s : im.tw / 2, cy: c.cy != null ? c.cy * s : im.th / 2, w: im.tw, h: im.th };
    });
    // output buffers must fit the largest view the host will ever render —
    // interactive canvases are usually LARGER than the training resolution
    const maxW = Math.max(this.opts.maxViewW ?? 2560, ...cams.map((c) => c.w));
    const maxH = Math.max(this.opts.maxViewH ?? 1440, ...cams.map((c) => c.h));
    this._setupTrainer(cams, this.frames, maxW, maxH, this.model.radius);
    if (this._appendedSeed) {
      const a = this._appendedSeed;
      this.model.appendedSeedCount = Math.max(0, Math.min(a.to, this.trainer.n) - a.from);
      a.to = a.from + this.model.appendedSeedCount;
      if (!this.model.appendedSeedCount) this._appendedSeed = null;
    }
    if (this.opts.lowMem) {
      // targets now live on the GPU (packed RGBA8); the float32 CPU copies
      // are 3x that size and nothing reads them after setup
      for (const f of this.frames) { f.rgb = null; f.sampleColor = () => [0.5, 0.5, 0.5]; }
    }

    this._applyTrainingSplit(extra);

    if (masked && this.splatTest) this.trainer.hullKill = this.splatTest;
    if (this._appendedSeed && this._appendedSeed.protectIters > 0) this.trainer.protect = { from: this._appendedSeed.from, to: this._appendedSeed.to, until: this._appendedSeed.protectIters };
    if (this._appendedSeed && this._appendedSeed.freezePos) { this.trainer.setFreezePos(this._appendedSeed.from, this._appendedSeed.to); this._log(`seed rows ${this._appendedSeed.from}-${this._appendedSeed.to} keep their positions`); }
    this._stage({ stage: 'seed', done: 1, total: 1, detail: { splats: this.model.n } });
    return this.model;
  }

  /** the cameras' dominant up axis (unit, world) */
  _camerasUp() {
    const u = [0, 0, 0];
    for (const c of this.recon.cams) { u[0] -= c.R[3]; u[1] -= c.R[4]; u[2] -= c.R[5]; }
    const l = Math.hypot(u[0], u[1], u[2]) || 1; return [u[0] / l, u[1] / l, u[2] / l];
  }

  /** trainer.setup with the frame alphas hidden when the session trains unmasked
   *  (opts.maskTraining === false): the packed targets then carry alpha 255. */
  _setupTrainer(cams, frames, maxW, maxH, radius) {
    const hide = this.opts.maskTraining === false && frames && frames.some((f) => f.alpha);
    const saved = hide ? frames.map((f) => f.alpha) : null;
    if (hide) for (const f of frames) f.alpha = null;
    try { this.trainer.setup(this.model, cams, frames, maxW, maxH, radius); }
    finally { if (hide) frames.forEach((f, i) => { f.alpha = saved[i]; }); }
  }

  /** After a run with photometric pose optimisation (trainer opts.camOpt): log how far
   *  the cameras moved and write the moved poses back into recon.cams, so everything
   *  after training (hull, cut, landmarks, body fit) sees the frame the model was
   *  trained in. camMeta and recon.cams share their order. */
  _camDriftDone() {
    try {
      const tr = this.trainer; if (!tr || !tr.opts.camOpt || !this.recon || !this.recon.cams) return;
      const dr = tr.camDrift(); if (!dr) return;
      let moved = 0;
      for (let i = 0; i < tr.camMeta.length && i < this.recon.cams.length; i++) {
        const m = tr.camMeta[i], c = this.recon.cams[i]; if (!m || !c) continue;
        c.R = Array.from(m.R); c.t = Array.from(m.t); moved++;
      }
      this._log(`pose optimisation: ${dr.n} cameras moved — rotation median ${dr.rotDegMedian.toFixed(3)}° max ${dr.rotDegMax.toFixed(2)}°, centre median ${dr.trnMedian.toFixed(4)} max ${dr.trnMax.toFixed(3)} scene units; ${moved} poses written back to the reconstruction`);
    } catch (e) { this._log(`pose drift report failed: ${e.message || e}`); }
  }

  /** Which cameras train and which are scored: blur exclusions, the chart
   *  holdout and the evaluation split. Shared by seed() and a continuation
   *  (seedFrom with frames), so a resumed run keeps the same test set. */
  _applyTrainingSplit(extra = {}) {
    // blur-aware training: the blurriest frames stay registered (their poses
    // hold the chain together) but are excluded from the loss so the model
    // doesn't learn their motion blur
    // opts.lossCams(cam): which registered cameras carry the loss at all — the
    // others keep their poses (hull, cut, landmarks) but never train. Avatar
    // crops-only training (2026-09-15): the person's native windows train, the
    // room frames do not.
    const inLoss = typeof this.opts.lossCams === 'function' && this.recon && this.recon.cams
      ? this.trainer.camMeta.map((m, i) => !!this.opts.lossCams(this.recon.cams[i], i)) : null;
    const sh = this.trainer.camMeta.map((m) => this.frames[m.imgIdx].sharpness);
    // the blur median is taken per camera GROUP (the frames that solved the scene vs
    // the avatar's crop windows, cams flagged crop): the groups decode at different
    // scales and their sharpness is not comparable — one median over the mix threw
    // out 87 of 519 cameras on a 4K orbit (2026-09-15), 1 of 208 without crops
    const group = this.trainer.camMeta.map((m, i) => (this.recon && this.recon.cams && this.recon.cams[i] && this.recon.cams[i].crop) ? 1 : 0);
    const medOf = (g) => { const v = sh.filter((x, i) => group[i] === g && (!inLoss || inLoss[i])).sort((a, b) => a - b); return v.length ? v[v.length >> 1] : 0; };
    const med = [medOf(0), medOf(1)];
    this.trainer.excluded = new Set();
    const blurry = [0, 0];
    this.trainer.camMeta.forEach((m, i) => {
      if (inLoss && !inLoss[i]) { this.trainer.excluded.add(i); return; }
      if (sh[i] < med[group[i]] * 0.45) { this.trainer.excluded.add(i); blurry[group[i]]++; }
    });
    if (inLoss) this._log(`training loss on ${inLoss.filter(Boolean).length} of ${inLoss.length} cameras (opts.lossCams; the rest keep their poses)`);
    if (blurry[0] + blurry[1]) {
      const nCrop = group.filter((g) => g === 1).length;
      this._log(`excluding ${blurry[0] + blurry[1]} blurry cameras from the training loss ` +
        `(sharpness < 45% of the group median; poses kept)` + (nCrop ? ` — ${blurry[0]} of ${group.length - nCrop} frames, ${blurry[1]} of ${nCrop} crop windows` : ''));
    }

    // holdout: one sharp mid-sequence frame excluded from training and scored
    // as the honest novel-view metric
    const want = extra.holdout ?? this.opts.holdout ?? 'auto';
    if (want === 'auto') {
      let hi = this.trainer.camMeta.length >> 1;
      for (let k = 0; k < this.trainer.camMeta.length && this.trainer.excluded.has(hi); k++) {
        hi = (hi + 1) % this.trainer.camMeta.length;
      }
      this.holdout = hi;
    } else {
      this.holdout = (want == null || want < 0) ? -1 : want;
    }
    this.trainer.holdout = this.holdout;

    // benchmark protocol: every Nth frame joins the test set — excluded from
    // the loss (poses kept, same as the blur exclusions) and scored together
    // by evalTestPsnr(). The single chart holdout follows a mid-set test
    // frame so live progress tracks the same distribution.
    const split = extra.evalSplit ?? this.opts.evalSplit ?? 0;
    this.testCams = [];
    const evalNames = extra.evalFrames ?? this.opts.evalFrames;   // explicit test set by frame name (a fixed ruler across extractions of one video)
    if (evalNames && evalNames.length) {
      const want = new Set(evalNames);
      this.trainer.camMeta.forEach((m, i) => {
        const f = this.frames[m.imgIdx];
        if (f && want.has(f.name)) { this.trainer.excluded.add(i); this.testCams.push(i); }
      });
      if (this.testCams.length && this.holdout < 0) {
        this.holdout = this.testCams[this.testCams.length >> 1];
        this.trainer.holdout = this.holdout;
      }
      this._log(`evaluation set: ${this.testCams.length} of ${this.trainer.camMeta.length} cameras (named) held out of training`);
    } else if (split >= 2) {
      this.trainer.camMeta.forEach((m, i) => {
        if (m.imgIdx % split === 0) { this.trainer.excluded.add(i); this.testCams.push(i); }
      });
      if (this.testCams.length && this.holdout < 0) {
        this.holdout = this.testCams[this.testCams.length >> 1];
        this.trainer.holdout = this.holdout;
      }
      this._log(`evaluation split: ${this.testCams.length} of ${this.trainer.camMeta.length} ` +
        `cameras (every ${split}th) held out of training`);
    }

  }

  /**
   * Attach an ALREADY-TRAINED model instead of seeding from the sparse cloud
   * — the loading half of exportPlyBlob / a saved session.
   *
   * gaussians: { data: Float32Array (n*16, the trainer's raw parameter
   * layout), n, sh?: Float32Array (n*shK*3), shK? }.
   *
   * View-only (no frames needed): pass opts.viewOnly and the trainer is set
   * up with zero training cameras — renders, tours and exports work, training
   * does not. For a full resume call useFrames()/load() first and the normal
   * camera wiring happens exactly like seed(); pass opts.iter to continue the
   * schedules where the saved run stopped.
   */
  async seedFrom(gaussians, opts = {}) {
    this._assertActive();
    if (!this.recon && !opts.viewOnly) throw new Error('useReconstruction() first');
    this._stage({ stage: 'seed', done: 0, total: 1 });
    const radius = opts.sceneRadius ?? this.recon?.sceneRadius ?? 10;
    this.model = { data: gaussians.data, n: gaussians.n, radius, dc: gaussians.dc };

    await this._getGpu();
    this._assertActive();
    const shUp2 = this.opts.shHorizontal && this.recon?.cams?.length ? this._camerasUp() : null;
    const trainerOpts = {
      maxIters: this.opts.maxIters ?? 60000,
      ...(shUp2 ? { shUp: shUp2 } : {}),
      // same masked-set default as seed(): without it a continuation trained
      // its empty pixels against BLACK (2026-09-12: 200 steps from a
      // converged person grew opaque dark needles out of the subject)
      ...(this.opts.maskTraining !== false && this.frames && this.frames.some((f) => f.emptyFrac > 0) ? { randomBg: true } : {}),
      ...this.opts.trainer, ...opts.trainer,
      gpu: this.gpu,
    };
    if (gaussians.shK != null) trainerOpts.shDeg = { 0: 0, 3: 1, 8: 2, 15: 3 }[gaussians.shK] ?? trainerOpts.shDeg;
    await this._createTrainer(trainerOpts);
    this._assertActive();

    let cams = [];
    if (!opts.viewOnly) {
      cams = this.recon.cams.map((c) => {
        const im = this.frames[c.imgIdx];
        const s = im.tw / im.fw;
        return { ...c, f: c.f * s, ...(c.fy != null ? { fy: c.fy * s } : {}),
        // the principal point is normally the frame centre; a crop camera (a
        // native-resolution window cut out of a larger image, see
        // tests/bench/face_crops.py) carries its own, at feature scale
        cx: c.cx != null ? c.cx * s : im.tw / 2, cy: c.cy != null ? c.cy * s : im.th / 2, w: im.tw, h: im.th };
      });
    }
    const maxW = Math.max(this.opts.maxViewW ?? 2560, ...cams.map((c) => c.w));
    const maxH = Math.max(this.opts.maxViewH ?? 1440, ...cams.map((c) => c.h));
    if (opts.unbake && this.trainer.mipComp !== false && this.recon?.cams?.length) {
      // a bare .ply/.sog export carries opacities with the Mip compensation
      // BAKED (exportPlyBlob); this trainer compensates at render time, so
      // undo the bake with the exporter's own f (training scale of the first
      // camera), camera positions and dilate. A state.bin is raw: never unbake it.
      const c0 = this.recon.cams[0];
      const fr0 = (this.frames || this.recon.frames || [])[c0.imgIdx];
      const f0 = cams.length ? cams[0].f : c0.f * (fr0 && fr0.tw && fr0.fw ? fr0.tw / fr0.fw : 1);
      const pos = Float32Array.from(this.recon.cams.flatMap(camPosition));
      this.model.data = unbakeOpacityCompensation(this.model.data, this.model.n, f0, pos, this.trainer.dilate);
      this._log(`unbaked the export's opacity compensation (f ${f0.toFixed(1)}, ${this.recon.cams.length} cams, dilate ${this.trainer.dilate})`);
    }
    this._setupTrainer(cams, this.frames || [], maxW, maxH, radius);
    // setup zero-fills SH (view dependence is normally learned) — a restored
    // model brings its own
    if (gaussians.sh && this.trainer.bufSH) {
      this.trainer.device.queue.writeBuffer(this.trainer.bufSH, 0,
        gaussians.sh.buffer, gaussians.sh.byteOffset, gaussians.n * this.trainer.shK * 3 * 4);
    }
    if (opts.iter) { this.trainer.iter = opts.iter; this.trainer.adamT0 = opts.iter; }
    this.trainer.excluded = new Set();
    this.holdout = -1;
    this.trainer.holdout = -1;
    this.testCams = [];
    // a continuation trains like the run it continues: the same blur
    // exclusions and evaluation split (a resume that trained on the held-out
    // views scored them as train views)
    if (!opts.viewOnly && this.frames && cams.length) this._applyTrainingSplit(opts);
    // a resumed run must not refine on its first frame: the refine timer is
    // not part of the saved state, and lastRefine 0 fired a growth refine
    // (+5 % splats) right after every resume (e2e resume spec, 2026-09-09)
    this.trainer.lastRefine = this.trainer.iter;
    this._log(`restored ${gaussians.n} Gaussians` +
      (opts.viewOnly ? ' (view only)' : ` at iteration ${opts.iter || 0}`));
    this._stage({ stage: 'seed', done: 1, total: 1, detail: { splats: gaussians.n } });
    return this.model;
  }

  // ---- the training loop (policy that used to live in the demo page) ----

  start() {
    this._assertActive();
    if (!this.trainer) throw new Error('seed() first');
    if (this.trainingError) throw this.trainingError;
    if (this._backgroundFitTrainer === this.trainer) throw new Error('Wait for background fitting to finish');
    if (this.training || this._finishing) return;
    this.training = true;
    this._stage({ stage: 'train', done: this.trainer.iter, total: this._maxIters() });
    this._ensureScheduler();
    this._scheduleFrame();
  }

  pause() { this.training = false; }

  /** Raise the training horizon by `moreIters` and resume. The trainer's
   *  schedules (pos-lr decay, growth stop) are horizon-relative and stretch
   *  with it — this is a real continued run, not idling at floor lr. */
  continueFor(moreIters) {
    if (!this.trainer) throw new Error('seed() first');
    this.opts.maxIters = (this.opts.maxIters ?? 60000) + moreIters;
    this.trainer.opts.maxIters = this.opts.maxIters;
    this.trainer.horizon = this.opts.maxIters;
    this.start();
    return this.opts.maxIters;
  }

  /** End the run early with the model as it stands: final metrics, then the
   *  same train-complete event an auto-stop emits. */
  async finish() {
    this._assertActive();
    if (!this.trainer) return;
    if (this.trainingError) throw this.trainingError;
    if (this._finishPromise) return this._finishPromise;
    const trainer = this.trainer;
    this.training = false;
    this._finishing = true;
    this._framePending = false;
    const work = (async () => {
      // A phone's duty cycle can pause and resume while a GPU fence or readback
      // is pending. Finish must join that frame before using its staging buffers.
      await this._frameRunning;
      this._assertActive();
      if (this.trainer !== trainer || this._lost) throw new Error('Training device changed while finishing');
      if (this.trainingError) throw this.trainingError;
      if (this._completedTrainer === trainer && this._completedAtIter === trainer.iter) return;
      this._log(`training finished early at ${this.trainer.iter} iterations`);
      await this._emitMetrics(true);
      this._assertActive();
      this._completeTraining(trainer);
    })();
    this._finishPromise = work;
    try {
      await work;
    } finally {
      if (this._finishPromise === work) {
        this._finishPromise = null;
        this._finishing = false;
        if (!this._disposed && this.view._dirty) this._scheduleFrame();
      }
    }
  }

  _completeTraining(trainer) {
    if (this._disposed || this._lost || this.trainer !== trainer ||
        this.trainingError ||
        (this._completedTrainer === trainer && this._completedAtIter === trainer.iter)) return;
    this._completedTrainer = trainer;
    this._completedAtIter = trainer.iter;
    this._camDriftDone();
    this._em.emit('event', { kind: 'train-complete', iter: trainer.iter, splats: trainer.n });
  }

  _maxIters() { return this.opts.maxIters ?? 60000; }

  /** The GPU vanished under us (iOS reclaims WebGPU devices from backgrounded
   *  tabs; drivers reset). Training stops — the splats lived on the dead
   *  device — but frames and reconstruction are CPU-side, so recover() can
   *  rebuild and train again without redoing the solve. */
  _deviceLost(info) {
    if (this._lost) return;
    this._lost = true;
    this.training = false;
    this._fences = [];
    this._log(`GPU device lost (${(info && info.reason) || 'unknown'}) — ` +
      `${(info && info.message) || 'reclaimed by the system'}`);
    this._em.emit('event', { kind: 'device-lost', iter: this.trainer ? this.trainer.iter : 0 });
  }

  get deviceLost() { return !!this._lost; }

  get trainingError() {
    return this._trainingFailure?.trainer === this.trainer ? this._trainingFailure.error : null;
  }

  _trainingFailed(trainer, failure) {
    if (!trainer || !this._currentTrainer(trainer) || this.trainingError) return;
    const error = failure instanceof Error ? failure : new Error(String(failure));
    this._trainingFailure = { trainer, error };
    this.training = false;
    this._framePending = false;
    this._log(`training failed: ${error.message}`);
    this._em.emit('event', { kind: 'train-error', iter: trainer.iter, message: error.message });
  }

  /** Rebuild after device loss: a fresh device and trainer from the CPU-side
   *  reconstruction. Training restarts at iteration 0. */
  async recover() {
    this._assertActive();
    if (!this.recon) throw new Error('nothing to recover — no reconstruction');
    this.training = false;
    this._lost = false;
    this._trainingFailure = null;
    this._fences = [];
    this._ips = null;
    this._thrT = null;
    this._statsGap = 2000;
    this._lastStats = performance.now();
    this._metricsLock = null;    // readbacks on the dead device never resolve
    this._framePending = false;
    this._frameRunning = null;
    this._finishPromise = null;
    this._finishing = false;
    this.lossHistory = [];
    this._lastHold = null;
    this._lastHoldEval = 0;
    this._itersAtStats = 0;
    this.trainer = null;
    if (this.gpu && this.gpu.owned) { try { this.gpu.dispose(); } catch { /* already gone */ } }
    this.gpu = null;
    return this.seed();
  }

  _ensureScheduler() {
    if (this._sched) return;
    // Hidden tabs AND occluded windows get their rAF throttled; worker
    // messages are not. The worker tick drives the loop whenever a scheduled
    // frame is >150ms late.
    let tickWorker = null;
    try {
      const src = 'setInterval(() => postMessage(0), 33);';
      tickWorker = new Worker(URL.createObjectURL(new Blob([src], { type: 'text/javascript' })));
    } catch { /* no Worker: rAF only */ }
    this._framePending = false;
    this._frameScheduledAt = 0;
    const runFrame = () => {
      if (!this._framePending || this._frameRunning || this._finishing || this._disposed ||
          (this._backgroundFitTrainer && this._backgroundFitTrainer === this.trainer)) return;
      this._framePending = false;
      // Encoding/readback errors must stop and explain this trainer's run. A late rejection
      // from a disposed or replaced trainer cannot fail its replacement.
      const trainer = this.trainer;
      const work = this._frameLoop().catch((e) => this._trainingFailed(trainer, e));
      this._frameRunning = work;
      work.finally(() => {
        if (this._frameRunning !== work) return;
        this._frameRunning = null;
        if (this._framePending && !this._disposed && !this._finishing) {
          this._framePending = false;
          this._scheduleFrame();
        }
      });
    };
    if (tickWorker) {
      tickWorker.onmessage = () => {
        if (this._framePending && this.training &&
            performance.now() - this._frameScheduledAt > 150) runFrame();
      };
    }
    this._sched = {
      runFrame, tickWorker,
      raf: typeof requestAnimationFrame === 'function'
        ? (fn) => requestAnimationFrame(fn) : (fn) => setTimeout(fn, 16),
    };
    this._frameCount = 0;
    this._lastStats = performance.now();
    this._itersAtStats = 0;
    this._lastHoldEval = 0;
  }

  _scheduleFrame() {
    if (this._disposed || this._framePending || this._finishing ||
        (this._backgroundFitTrainer && this._backgroundFitTrainer === this.trainer)) return;
    this._framePending = true;
    // Coalesce resume/view requests until the active frame releases its GPU work.
    if (this._frameRunning) return;
    this._frameScheduledAt = performance.now();
    this._sched.raf(this._sched.runFrame);
  }

  _currentTrainer(trainer) {
    return !this._disposed && !this._lost && this.trainer === trainer;
  }

  async _frameLoop() {
    const trainer = this.trainer;
    const current = () => this._currentTrainer(trainer);
    if (!trainer || !trainer.camMeta || !current()) return;
    this._frameCount++;

    if (this.training && trainer.iter >= this._maxIters()) {
      this.training = false;
      this._log(`training complete at ${trainer.iter} iterations`);
      await this._emitMetrics(true);
      if (!current()) return;
      // emitted AFTER the final readback: listeners typically call metrics()
      // right away, which must not interleave with ours on the staging buffer
      this._completeTraining(trainer);
    }

    if (this.training) {
      // Batch enough iterations per frame to keep the GPU busy. The batch
      // adapts to the device: ~120ms of GPU work per frame keeps a desktop
      // GPU saturated with few submits AND keeps metrics/UI alive on a phone
      // where the same 15 iterations could take seconds.
      const batch = Math.min(this._maxIters() - trainer.iter, this.opts.itersPerFrame ??
        Math.max(4, Math.min(64, Math.round(this._batch ?? 15))));
      const t0 = performance.now();
      // true throughput, stall time included: Safari's stale fences hide the
      // GPU's real pace from per-frame dt, and a slow GPU otherwise ends up
      // with many seconds of work queued (chunky metrics, laggy pause)
      if (this._thrT == null) {
        this._thrT = t0; this._thrIter = trainer.iter;
      } else if (t0 - this._thrT > 1000) {
        const ips = (trainer.iter - this._thrIter) / (t0 - this._thrT) * 1000;
        this._ips = this._ips == null ? ips : this._ips * 0.5 + ips * 0.5;
        this._thrT = t0; this._thrIter = trainer.iter;
      }
      for (let k = 0; k < batch; k++) trainer.stepOnce();

      const tEnc = performance.now() - t0;

      // periodic refinement: relocate dead splats + grow capacity (MCMC-lite)
      if (trainer.iter > (this.opts.refineStart ?? 1500) &&
          trainer.iter - (trainer.lastRefine || 0) >= (this.opts.refineEvery ?? 2500)) {
        trainer.lastRefine = trainer.iter;
        const r0 = performance.now();
        // awaited: refine reads six buffers and writes them all back — steps
        // submitted meanwhile would be silently rewound by that write-back,
        // and the six snapshots would come from six different iterations
        const r = await trainer.refine();
        if (!current()) return;
        if (this.perf) {
          this.perf.marks.push({ t: Math.round(r0), kind: 'refine', iter: trainer.iter,
            ms: Math.round(performance.now() - r0), moved: r.moved, grown: r.grown });
        }
        if (r.moved || r.grown) {
          this._log(`refine @${trainer.iter}: relocated ${r.moved}, grew +${r.grown} -> ${r.n} splats`
            + (r.dead != null ? ` (dead ${r.dead}, last round ${r.survived}/${r.lastReloc} survived)` : ''));
          this._em.emit('event', { kind: 'refine', iter: trainer.iter, ...r });
        }
      }

      const now = performance.now();
      let tMet = 0;
      if (now - this._lastStats > (this._statsGap ?? 2000)) {
        const m0 = performance.now();
        await this._emitMetrics();
        if (!current()) return;
        tMet = performance.now() - m0;
      }

      const v0 = performance.now();
      this.view._tick(this._frameCount, this.training);
      const tView = performance.now() - v0;

      // Deep pipelining: keep a RING of fences in flight, not one. Safari
      // resolves onSubmittedWorkDone hundreds of ms late even when the GPU is
      // idle; gating each batch on a single fence made that latency the loop
      // period, and the batch adapter — reading the latency as GPU time —
      // shrank the batch into its floor (an iPhone sat at ~15 it/s on a scene
      // it can train at hundreds). With 4 fences outstanding the late fences
      // overlap; the frame period becomes ~latency/4 and the same adapter now
      // GROWS the batch until real GPU work dominates. Prompt-fence devices
      // (desktop) behave as before.
      const fence = trainer.device.queue.onSubmittedWorkDone();
      // Attach immediately, even while the fence is still waiting its turn in the ring.
      // Keep its rejection intact for the later await and the run's error event.
      fence.catch(() => {});
      this._fences.push(fence);
      const s0 = performance.now();
      // fence ring depth trades UI latency for fence-latency overlap
      // (phones run 2: the compositor shares the GPU with training, and
      // 4 x 0.4s of queued dispatches is the "whole system stalls" feel)
      if (this._fences.length > (this.opts.fenceRing ?? 4)) await this._fences.shift();
      if (!current()) return;
      const tStall = performance.now() - s0;

      // adapt the batch to the measured cadence (steady-state ~= GPU time of
      // one batch); damped so it settles instead of oscillating
      const dt = Math.max(5, performance.now() - t0);
      const ideal = batch * (120 / dt);
      this._batch = Math.max(4, Math.min(64, (this._batch ?? 15) * 0.7 + ideal * 0.3));
      // throughput cap: ~0.4s of measured GPU work per batch. The dt adapter
      // reads 5ms frames when fences resolve stale and pushes the batch to
      // the clamp — fine on a desktop, ten queued seconds on a phone.
      if (this._ips != null) {
        // gpuChunkMs bounds how much GPU work one batch queues — phones run
        // ~120ms so the compositor (which shares the GPU) gets a slot every
        // frame or two instead of stalling behind 0.4s of dispatches
        const chunk = (this.opts.gpuChunkMs ?? 400) / 1000;
        this._batch = Math.min(this._batch, Math.max(8, Math.round(this._ips * chunk)));
      }
      if (this.perf) {
        this.perf.frames.push([Math.round(now), trainer.iter, batch, trainer.n,
          +tEnc.toFixed(1), +tView.toFixed(1), +tStall.toFixed(1), +tMet.toFixed(1), +dt.toFixed(1)]);
      }
    } else {
      this.view._tick(this._frameCount, this.training);
      await trainer.device.queue.onSubmittedWorkDone();
      if (!current()) return;
      this._fences.length = 0;
    }
    if (!this._disposed && (this.training || this.view._dirty)) this._scheduleFrame();
  }

  /** serialize every metric readback: they share the trainer's staging
   *  buffers, and two in flight = "outstanding map pending". On a lost
   *  device readbacks would hang forever — fail fast instead. */
  _locked(fn) {
    const trainer = this.trainer;
    const active = () => {
      this._assertActive();
      if (this._lost) throw new Error('GPU device lost');
      if (this.trainer !== trainer) throw new DOMException('Training session changed', 'AbortError');
    };
    const call = async () => {
      active();
      const result = await fn();
      active();
      return result;
    };
    const run = (this._metricsLock || Promise.resolve()).then(call, call);
    this._metricsLock = run.catch(() => {});
    return run;
  }

  _emitMetrics(final = false) {
    return this._locked(() => this._emitMetricsInner(final));
  }

  async _emitMetricsInner(final = false) {
    const trainer = this.trainer;
    const now = performance.now();
    const itersPerSec = (trainer.iter - this._itersAtStats) / Math.max(1, now - this._lastStats) * 1000;
    const m = { iter: trainer.iter, splats: trainer.n, itersPerSec: Math.round(itersPerSec) };
    this._lastIps = m.itersPerSec;
    const tRead = performance.now();
    const mse = await trainer.readLoss();
    if (!this._currentTrainer(trainer)) return null;
    if (mse != null && mse > 0) {
      m.psnrTrain = -10 * Math.log10(mse);
      this.lossHistory.push([trainer.iter, m.psnrTrain]);
    }
    const holdEvery = this.opts.evalHoldEvery ?? 4000;
    if (this.holdout >= 0 &&
        (final || trainer.iter - this._lastHoldEval >= holdEvery)) {
      this._lastHoldEval = trainer.iter;
      m.psnrHold = await trainer.evalCamPsnr(this.holdout);
      if (!this._currentTrainer(trainer)) return null;
      this._lastHold = m.psnrHold;
    } else if (this._lastHold != null) {
      m.psnrHold = this._lastHold;
    }
    // The readbacks above drain every queued batch first — seconds on a slow
    // GPU. Pace the next readout from COMPLETION and by what this one cost,
    // or a fixed 2s cadence turns into back-to-back queue drains.
    const end = performance.now();
    this._lastStats = end;
    this._itersAtStats = trainer.iter;
    this._statsGap = Math.min(8000, Math.max(2000, (end - tRead) * 2.5));
    this._em.emit('metrics', m);
    return m;
  }

  /** One-shot quality readout (used by tests and the done screen). */
  metrics({ refined = false } = {}) {
    return this._locked(async () => {
      const trainer = this.trainer;
      const out = { iter: trainer.iter, splats: trainer.n };
      if (this.holdout >= 0) {
        out.psnrHold = await trainer.evalCamPsnr(this.holdout);
        if (refined) out.psnrHoldRefined = await trainer.evalCamPsnrRefined(this.holdout);
      }
      return out;
    });
  }

  /** PSNR of one training camera against its own photograph (serialized with
   *  the other metric readbacks; safe to call while training). */
  evalFramePsnr(ci) {
    return this._locked(() => this.trainer.evalCamPsnr(ci));
  }

  /** Mean PSNR over the evalSplit test cameras — the number quality papers
   *  report. Resolves null when no eval split was requested. */
  evalTestPsnr() {
    if (!this.testCams || !this.testCams.length) return Promise.resolve(null);
    return this._locked(async () => {
      const trainer = this.trainer;
      const assertCurrent = () => {
        this._assertActive();
        if (this._lost) throw new Error('GPU device lost');
        if (this.trainer !== trainer) throw new DOMException('Training session changed', 'AbortError');
      };
      const frames = [];
      let sum = 0;
      for (const c of this.testCams) {
        assertCurrent();
        const psnr = await trainer.evalCamPsnr(c);
        assertCurrent();
        frames.push({ cam: c, imgIdx: trainer.camMeta[c].imgIdx, psnr });
        sum += psnr;
      }
      return { psnr: sum / frames.length, frames };
    });
  }

  /** Fit a constant display background without racing preview rasters or optimizer work. */
  async fitBackground({ signal } = {}) {
    this._assertActive();
    if (this.training) throw new Error('Pause or finish training before fitting the background');
    await this._finishPromise;
    const trainer = this.trainer;
    if (!trainer) throw new Error('seed() first');
    if (this.trainingError) throw this.trainingError;
    if (this._backgroundFitTrainer === trainer) throw new Error('Background fitting is already running');
    // The raster shares output buffers with the preview. Join and suppress frames until the
    // serialized fit releases them; a late fit cannot read a replacement trainer's targets.
    this._backgroundFitTrainer = trainer;
    this._framePending = false;
    try {
      await this._frameRunning;
      this._assertActive();
      if (this.trainer !== trainer || this._lost || this.training)
        throw new Error('Training device changed while fitting the background');
      return await this._locked(() => trainer.fitBackground({ signal,
        validationCams: [this.holdout, ...(this.testCams || [])],
        isCurrent: () => this._currentTrainer(trainer) && !this.training }));
    } finally {
      if (this._backgroundFitTrainer === trainer) {
        this._backgroundFitTrainer = null;
        if (this._currentTrainer(trainer) && this.view._dirty) this._scheduleFrame();
      }
    }
  }

  /** Index of the camera the trainer most recently stepped on (UI pulse). */
  get activeCam() { return this.trainer ? this.trainer.lastCam : -1; }

  /** Standard 3DGS .ply with Mip opacity compensation baked (what external
   *  sorted viewers expect). */
  exportPlyBlob() {
    // shares the trainer's staging buffers with the metric readbacks
    return this._locked(async () => {
      const { data, n, sh, shK } = await this.trainer.readGaussians();
      const meta = this.trainer.camMeta[0];
      // a view-only restore has no training cameras — its model came from an
      // export that already baked the compensation, so pass it through.
      // A trainer without Mip compensation (opts.mipComp false) rendered
      // exactly what external rasterizers render: nothing to bake.
      const baked = (meta && this.trainer.mipComp !== false)
        ? bakeOpacityCompensation(data, n, meta.f,
            Float32Array.from(this.trainer.camMeta.flatMap(camPosition)), this.trainer.dilate)
        : data;
      // dead splats — invisible at the smallest 8-bit alpha — are pure
      // file-size and render tax for every viewer. Long classic-era runs
      // accumulated 50%+ of them (opacity-reg ratchet, lab log 2026-09-01):
      // drop them at the door.
      const A_DEAD = Math.log(1 / 254);   // logit of alpha 1/255
      let live = 0;
      for (let i = 0; i < n; i++) if (baked[i * 16 + 13] > A_DEAD) live++;
      let oData = baked, oSh = sh, oN = n;
      if (live < n) {
        oData = new Float32Array(live * 16);
        const shPer = sh ? sh.length / n : 0;
        oSh = sh ? new Float32Array(live * shPer) : sh;
        let w = 0;
        for (let i = 0; i < n; i++) {
          if (baked[i * 16 + 13] <= A_DEAD) continue;
          oData.set(baked.subarray(i * 16, i * 16 + 16), w * 16);
          if (sh) oSh.set(sh.subarray(i * shPer, (i + 1) * shPer), w * shPer);
          w++;
        }
        oN = live;
      }
      return gaussiansToPly(oData, oN, oSh, shK, this.trainer.dcMode);
    });
  }

  /** The trainer's RAW parameter state ({ data, n, sh, shK }) — the exact
   *  floats, no opacity baking or color activation: what seedFrom() takes
   *  back for a bit-identical resume. */
  exportRawState() {
    return this._locked(() => this.trainer.readGaussians());
  }

  dispose() {
    if (this._disposed) return;
    this._disposed = true;
    this._lifetime.abort();
    this.training = false;
    this._framePending = false;
    if (this._sched && this._sched.tickWorker) this._sched.tickWorker.terminate();
    this.trainer?.dispose();
    this.trainer = null;
    this._trainingFailure = null;
    this.view.ctx?.unconfigure?.();
    if (this.gpu) {
      this.gpu.onLost = null;
      if (this.gpu.owned) this.gpu.dispose();
    }
    this.gpu = null;
  }
}

/** The session's render target: one canvas, one camera. */
class SessionView {
  constructor(session) {
    this.s = session;
    this.canvas = null;
    this.ctx = null;
    this.camera = null;   // { R, t, f, cx, cy, w, h } at canvas resolution
    this._dirty = false;
    this._offset = 0;     // training-target offset when looking through a frame
  }

  attach(canvas) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('webgpu');
    this.ctx.configure({
      device: this.s.trainer.device,
      format: this.s.trainer.canvasFormat,
      alphaMode: 'opaque',
    });
    this._dirty = true;
    if (!this.s.training) this.s._ensureScheduler(), this.s._scheduleFrame();
  }

  /** Point the camera at training frame i (exact pose + intrinsics). Returns
   *  the camera meta so the UI can overlay the photograph. */
  lookThrough(i) {
    const meta = this.s.trainer.camMeta[i];
    this.setCamera({ ...meta });
    this._offset = meta.offset;
    return meta;
  }

  /** Free camera: { R, t, f, cx, cy, w, h }. */
  setCamera(cam) {
    this.camera = cam;
    this._offset = 0;
    this._dirty = true;
    if (!this.s.training && this.s._sched) this.s._scheduleFrame();
  }

  renderNow() {
    if (!this.ctx || !this.camera) return;
    if (this.s._backgroundFitTrainer === this.s.trainer) {
      this._dirty = true;
      return;
    }
    this.s.trainer.renderView(this.camera, this.ctx, 0, this._offset);
    this._dirty = false;
    // any render satisfies the auto-refresh — a host that renders on its own
    // cadence keeps pushing this back and the tick below never double-fires
    this._lastAuto = performance.now();
  }

  _tick(frameCount, training) {
    if (!this.ctx || !this.camera) return;
    if (this._dirty) { this.renderNow(); return; }
    // during training, refresh the (unchanged-camera) view sparingly — every
    // render is a full raster pass stolen from the optimiser (~2/s at most,
    // fewer on slow devices: ~25 iterations between refreshes)
    const ips = this.s._itersAtStats && this.s._lastStats
      ? Math.max(1, this.s._lastIps || 100) : 100;
    const interval = Math.max(500, 25000 / ips);
    if (training && performance.now() - (this._lastAuto || 0) > interval) {
      this.renderNow();
    }
  }
}

/** @param {SessionOptions} [opts] */
export function createSession(opts = {}) { return new Session(opts); }
