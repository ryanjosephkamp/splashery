# Lane Viewers: a splat toolkit and a point cloud viewer (prefix `vwr`)

## Brief

You are a Splashery worker session, started by the Operator (the coordinating session) for the
October push. Repo: ryanjosephkamp/splashery. Your lane: Viewers (id `Viewers`, prefix `vwr`).
Branches: `claude/lane-viewers` (and `claude/lane-viewers-engine` for any engine change). PR title:
"Phase Viewers: a splat toolkit and a point cloud viewer". Handoff file: docs/handoff/Viewers.md
(create it; start it with this brief, word for word, under "## Brief", then keep "## State", "##
Notes", "## Known issues" and "## For the Operator" current). Model: Opus 5.5.

### Brief (written by the Operator on October 5, 2026, from the owner's Push Plan picks S2 and S3)

Two labs tools for files people already have, on the device (nothing uploaded):

1. **Splat toolkit** (S3, "Useful to everyone who makes splats"). Open .ply (3D Gaussian splatting),
   .splat, .spz and .sog files (check what the vendored PlayCanvas 2.22.3 and tools already read;
   add a reader where needed under the library rule). Show the stats (splat count, bounds,
   spherical-harmonics degree, file size, memory). Crop with a box, remove floaters (a statistical
   outlier filter you can tune, with a before/after), shrink (decimate to a target count), convert
   and save to another format (a download the person chooses), and compare two splats side by side
   in step. Fast on large files: work in a worker, show progress.
2. **Point clouds** (S2, "Absolutely, yes ... maybe even a little bit more"). Open LAS, LAZ, PLY,
   XYZ and PTS; draw the points as splats; color by height, intensity, classification or the file's
   own color; measure a distance; crop; thin; export. LAZ needs a library: the owner approved a LAZ
   reader on October 4, 2026. Prefer a permissive license; if the only good one is LGPL, use it (he
   approved it by name) and say so in LICENSES.md and the PR. Load it only when a LAZ file is
   opened. Include two or three small sample files under allowed licenses (USGS 3DEP lidar is public
   domain; OpenTopography lists licenses per dataset), credited.

Both toys on the Studio or Lab shelf (your choice; say why), labs only. Tests in
`tests/vwr*.spec.mjs` with small generated test files (no outside files in tests): each format
opens, crop and filter do what they say, export round-trips. Clips at phone size on Effect review
page 2 (lane record `Viewers`). How-to and About texts.

You own: `src/viewers/` (new), `src/packs/viewers.js` (new), the vendored LAZ reader in `vendor/`,
`tools/vwr-*.mjs`, `tests/vwr*.spec.mjs`, your toys' lines in the shared lists, and your handoff
file. The existing Model to splats toy and the Video to 3D toy belong to other lanes: import from
them, don't edit them.

How this lane runs: exactly as docs/handoff/ScienceR3.md, "How this lane runs", says (read it;
replace the prefix and lane record with yours). Labs: the Operator merges after a full test run.
Finish every working turn with "READY:", "WORKING:" or "BLOCKED:"; Splashery has no CI to wait for;
for a long job, schedule a check-in with send_later instead of going idle.

## State

WORKING (October 5, 2026): started. Plan below.

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

(none yet)

## For the Operator

(nothing yet)
