# Lane Viewers: a splat toolkit and a point cloud viewer (prefix `vwr`)

## Brief

You are a Splashery worker session, started by the Operator (the coordinating session) for the
October push. Repo: ryanjosephkamp/splashery. Your lane: Viewers (id `Viewers`, prefix `vwr`).
Branches: `claude/lane-viewers` (and `claude/lane-viewers-engine` for any engine change). PR title:
"Phase Viewers: a splat toolkit and a point cloud viewer". Handoff file: docs/handoff/Viewers.md
(create it; start it with this brief, word for word, under "## Brief", then keep "## State

READY (October 5, 2026): both toys built, tested and pushed on `claude/lane-viewers` (PR #287).
Five clips are on Effect review page 2 (lane record `Viewers`): `vwr-toolkit-split`,
`vwr-toolkit-compare`, `vwr-clouds-palace`, `vwr-clouds-bridge`, `vwr-clouds-crater`. Waiting for
the owner's marks; the full suite is for the Integrator.

- **Splat toolkit** (`splat-toolkit`, Studio, labs). Opens PLY (binary, text and the compressed PLY
  of SuperSplat and splat-transform), .splat, SPZ 1 to 3 and SOG 2 (zipped, or meta.json with its
  pictures). Shows the count, size (and the middle 98%), harmonics degree, file size, memory, mean
  opacity and median splat size. Crop with a box (outline drawn; keep inside or outside), Remove
  floaters (a statistical outlier filter: mean distance to the k nearest neighbors, removed past
  mean + strength × std; strength and k in the Toy tab), Also remove nearly invisible splats, Shrink
  (keep a share; the most visible splats, spread over the scene), Show the result, the result with
  the removed splats in red, or before and after side by side. Compare puts a second splat (a sample
  or a second file) beside the first. Save writes PLY, SPZ 3, SOG 2 (base colors) or .splat as a
  download. The tap spins each splat once about its own middle, both in step. Defaults: the cactus
  with 0.6% stray splats added, floaters on, before and after.
- **Point clouds** (`point-clouds`, Studio, labs). Opens LAS 1.0 to 1.4 (formats 0 to 10), LAZ
  (laz-perf in the worker), point PLY, XYZ and PTS. Color by height, intensity, classification (with
  a legend) or the file's colors; point size; Measure (two taps drop pins on the nearest drawn
  points; straight, along the ground and the rise, in meters when the file says UTM); Thin (one
  point per 1.5 to 12 typical spacings); Crop; Up is Z or Y; Save PLY, LAS 1.2 or XYZ. The tap
  sweeps a glowing lidar scan line across the points. Samples: USGS 3DEP lidar (public domain): the
  Palace of Fine Arts, the Golden Gate Bridge's south end with Fort Point, Meteor Crater (the Grand
  Canyon project covers only strips of the walls, so it read as a slab).
- Work runs in a module worker (`src/viewers/worker.js` over `src/viewers/engine.js`); the toy gets
  a preview within the device's budget (the most visible splats, a little bigger, for a big splat
  file; an even share of points for a cloud). Readers and edits are plain modules (`splat-io.js`,
  `splat-ops.js`, `cloud-io.js`, `cloud-ops.js`) used by the Node tests too.
- Tests: `tests/vwr.spec.mjs` (21 tests: each format opens, crop, filter, shrink, thin, every save
  round-trips, splat-transform reads our PLY and SOG, LAZ and SOG open in the browser worker, Save
  downloads a file that reads back, two taps measure). Fixtures: `tools/vwr-fixtures.mjs` makes
  `tests/fixtures/vwr/` from our own numbers (splat-transform for compressed PLY and SOG; laspy for
  LAS and LAZ).

## Notes

- Shelf: Studio. It is where files people bring become splats (Model to splats, Video to 3D, the QR
  code); both new toys are tools for files people already have.
- LAZ reader: laz-perf (Hobu, Apache-2.0; npm `laz-perf@0.0.7`, WASM), permissive, so no LGPL
  question. Loaded only when a .laz file is opened.
- SOG: read and written with libwebp compiled to WASM, copied from `@playcanvas/splat-transform`
  3.6.1 (`lib/webp.mjs` and `lib/webp.wasm`, MIT; libwebp BSD-3-Clause). Loaded only when a .sog
  file is opened or saved. The browser's own WebP decoding goes through a premultiplied canvas,
  which changes the packed bytes, so it can't be used.

## Known issues

- In Node (check-packs, the Node tests' recipe builds) Point clouds shows its placeholder: the
  vendored laz-perf is its worker build, so LAZ is read only in a browser worker. The browser tests
  cover it.
- SOG is saved without view-dependent colors (degree 0): the palette of harmonics needs a k-means
  over all splats that is too slow in JavaScript; PLY and SPZ keep them. SPZ 4 (zstd) and KSPLAT are
  not read (clear messages).
- SPZ is read and written in its own right-up-back axes (Niantic's spec; Splashery's file loader
  agrees); splat-transform reads SPZ without turning it, so an SPZ saved here opens upside down
  there.
- Side by side at phone width each splat is small (the pair is wide); turn the phone or zoom in.

## For the Operator

- New libraries under the library rule (both permissive, under 2 MB, no server): laz-perf 0.0.7
  (Apache-2.0, 300 KB) and the WebP codec from splat-transform 3.6.1 (MIT and libwebp BSD-3, 360
  KB). Both load only inside the toys' worker when a .laz or .sog is opened (or SOG saved).
- Build tools added to LICENSES.md: Python laspy, lazrs and pyproj (samples and fixtures).
- Samples add about 11 MB of LAZ under `assets/toys/point-clouds/` (three 450,000-point tiles),
  loaded only when the toy opens.
