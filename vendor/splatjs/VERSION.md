# Splat.js, vendored for the Video to 3D spike

- Source: https://github.com/arrival-space/splat.js
- Commit: 88efe9aaf32279b0b9bcb781ea0deb4d60c49dff (September 23, 2026), package version 0.1.0.
- License: MIT, Copyright (c) 2026 Stratum1 GmbH (the full text is in `LICENSE`, checked on the live
  repository page on September 30, 2026).
- Files: 20 upstream modules under `src/`, plus the local `src/sfm/worker-pool.js` helper (21
  modules total). The upstream modules with local patches are `src/session.js`, `src/gs/trainer.js`,
  `src/io/frames.js`, and `src/sfm/sfm.js`; the other 16 retain their vendored bytes. Left out:
  `src/index.js`, `src/io/video.js` and `src/io/qtmeta.js` (the library's own video reader, which
  loads Mediabunny, MPL-2.0), `src/vendor/`, `src/synthetic.js`, `src/gs/gradcheck.js`, the app, the
  data and the tests. Splashery picks the video frames itself (`src/video3d/frames.js`).
- Loaded only by `src/video3d/`, with a dynamic `import()`, when someone opens a video in the Video
  to 3D toy.

## Local patches

- Task 40 (October 12, 2026), commit `ffcc71cc`: `src/session.js` accepts the optional `refineStart`
  threshold. Omitting it preserves the upstream 1,500-step threshold. Task 88's browser wrapper now
  passes an earlier threshold for short runs.
- Task 55 (October 13, 2026), commit `881b8109`: `src/gs/trainer.js` binds the camera-gradient
  buffer required by the optional D-SSIM backward shader. The default MSE loss is unchanged.
- Task 88 (October 15, 2026), made by Ryan with Codex (GPT-6), under MIT: `src/session.js` owns
  cancellation and asynchronous GPU/trainer creation through its lifetime. Disposed sessions reject
  late continuations and release resources that arrive afterward. `src/io/frames.js` stops decoding
  on cancellation and closes bitmaps on failure or cancellation. `src/gs/trainer.js` releases its
  buffers without destroying a host-owned device.
- Task 88 also adds the optional `Session.seed({ seedLimit })` budget. Appended rows reserve
  capacity first, original sparse points cover the full input order, and remaining capacity holds
  clones. Omitting `seedLimit` preserves the previous Gaussian parameter initialization.
  `model.appendedSeedCount` reports how many appended rows reach the trainer.
- Task 88 caps the last training batch at the remaining requested steps, so a short run cannot
  advance past its iteration budget while waiting for the next frame callback.
- Task 88 serializes scheduled training frames across pause and resume. Finishing joins an active
  frame before the final readback, and automatic and requested completion emit only once for the
  same trainer and iteration. A phone's duty-cycle resume cannot queue overlapping training loops.
- Task 88 guards frame and metric continuations with their originating trainer. Readbacks returning
  after disposal or recovery cannot emit stale metrics, render, or add dead-device fences to a new
  trainer's queue. Queued public readbacks reject when their training session changes.
- Task 88's local `src/sfm/worker-pool.js` owns workers through completion, error, or abort.
  `src/sfm/sfm.js` uses it for both feature-extraction passes and pair matching, and propagates
  cancellation through retry paths. The matching jobs, options, and per-pair seeds are retained.

The upstream MIT license remains in `LICENSE`. No external runtime library was added by these
patches.
