# Splat.js, vendored for the Video to 3D spike

- Source: https://github.com/arrival-space/splat.js
- Commit: 88efe9aaf32279b0b9bcb781ea0deb4d60c49dff (September 23, 2026), package version 0.1.0.
- License: MIT, Copyright (c) 2026 Stratum1 GmbH (the full text is in `LICENSE`, checked on the live
  repository page on September 30, 2026).
- Files: the 20 modules under `src/` that `src/session.js` and its two workers reach, unmodified.
  Left out: `src/index.js`, `src/io/video.js` and `src/io/qtmeta.js` (the library's own video
  reader, which loads Mediabunny, MPL-2.0), `src/vendor/`, `src/synthetic.js`,
  `src/gs/gradcheck.js`, the app, the data and the tests. Splashery picks the video frames itself
  (`src/video3d/frames.js`).
- Loaded only by `src/video3d/`, with a dynamic `import()`, when someone opens a video in the Video
  to 3D toy.
