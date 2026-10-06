# Lane Imaging (prefix `img`): cloud lane (moved from local, October 4, 2026)

## Brief

**Moved to the cloud (October 4, 2026, the owner's push).** This lane now runs in a cloud session
that the Operator starts, not on the owner's Mac. Everything below holds, except the local parts:
your checkout is the session's own clone on the branch named below (no worktree), use the default
port 4173 (no `SPLASHERY_PORT`), messages arrive in your session as "From the Operator" (not as PR
comments), you finish every working turn with a final message that starts "READY:", "WORKING:" or
"BLOCKED:" (and keep the same line at the top of "## State

READY: polish round r3 (October 5, 2026, Opus 5.5) on `claude/lane-imaging-polish`. Imaging r2
(#304, 478f39cb) reached main through the Operator's #319, and main is merged here. Done: the
thermal camera keeps one thermal copy plus three of the mug (sharper views); finer splats for the
walnut, MRI and microscope; a finer X-ray fan in How CT works; the airport scanner framed closer.
Six `-r3` cards are on Effect review page 2 beside the r2 ones. Specs run after the merge:
`tests/img.spec.mjs`, `kit`, `taps` (69 passed); Prettier and the American English check clean.

- [x] 1. Airport X-ray scanner (`airport-xray`)
- [x] 2. How CT works (`how-ct`): a kit-built nautilus shell
- [x] 3. A real CT scan (`walnut-ct`): the CWI walnut (Zenodo record 2686726, CC BY 4.0;
     docs/audits/new-sources-2026-10.md, B1)
- [x] 4. MRI of a fruit (`fruit-mri`): kit-built kiwi and orange slices
- [x] 5. Electron microscope (`electron-microscope`): pollen, diatoms, a rimed snowflake
- [x] 6. Thermal camera (`thermal-camera`): tea cooling, a hand warmer, ice water
- [ ] 7. Ideas of my own: not built (candidates: a ship's sonar sweeping a wreck on the seafloor, an
     ultrasound of an egg).

## Notes

- r2: every toy has `kernel: "sharp"` (labs) and `density: 2`. Visions: `VISIONS` and
  `visionColor()` (gray, night, infrared) behind a Vision option (the walnut's Colors option). How
  CT works: `CT_SPECIMENS` (the nautilus and 19 kit toys); `loadSpecimen()` builds the toy at rest
  (parts hidden at rest left out) and `specimenVolume()` voxelizes its splats on a 72³ grid (skin,
  plus a flood fill from the border for the inside).

- The engine piece (#274): kit kind `volume` (`params: [density]`), driven by
  `out.volume = { normal, at, slab, window, glow, glowWidth }` (recipe coordinates). The cut is
  measured at each splat's rest place. Test: `tests/img-engine.spec.mjs`.
- A new shelf, `imaging` ("Imaging"), after Science in `CATEGORIES`. Every toy is `labs: true`.
- `tools/img-walnut.mjs` reads Walnut 1's reconstruction from the 6 GB zip with HTTP range requests
  (run it with `NODE_USE_ENV_PROXY=1` in the cloud; Zenodo needs a user agent of its own) and writes
  `assets/toys/walnut-ct/walnut.vol.gz` (490 KB, loaded only when the toy opens). The recipe
  resamples it to the device's budget (60k to 280k splats).
- The MRI is anisotropic like a real scan: 26 slices, fine in each slice; a slab of the cut shows
  one.
- The electron microscope's zoom steps glide the camera with `out.view`, which needs a `focus` (it
  returns false, so a double-tap does nothing; single taps wait about 0.3 s). `effect-clip.mjs`
  holds the camera, so its clips were recorded in real time by a small script.
- The thermal camera crossfades a visible copy and three thermal copies (hot, warm, cooled tea) on
  the four fade channels.
- October 5, 2026 (the Operator's request): merged main again (#302's `tests/hl1.spec.mjs` change);
  `tests/img.spec.mjs`, `tests/img-engine.spec.mjs`, `tests/hl1.spec.mjs:61` and
  `tests/help.spec.mjs` pass (26 tests), Prettier and the American English check are clean.
- Specs run: `tests/img-engine.spec.mjs` (WebGL2 and WebGPU), `tests/img.spec.mjs`,
  `tests/kit.spec.mjs`, `tests/taps.spec.mjs`. Not the full suite (the Integrators run it).

## Known issues

- r3 tried letting the belt carry the bags in and out of view (the belt running on past the frame,
  `fit: false`), but the player frames kit toys by all their splats (`ctx.buf.bounds()`), not the
  kit's fit, so the scanner came out small. That needs an engine change; the next bag still appears
  just above the belt.

- The airport scanner's next bag is set down from just above the belt and appears there (a short
  pop), and the last bag is lifted out of view; a real person's hands are not shown.
- The electron microscope's pictures are shaded for the view from above; turned far to the side the
  baked edges and shadow no longer match the view.
- How CT works: the drag works only once the shell is scanned.

## For the Operator

- r2 lessons for PACKS.md: a flat panel behind a picture of splats must sit clearly in front of what
  is behind it (the X-ray screen's background z-fought the bezel and showed as static), and a
  picture layer needs a few hundredths of a unit in front of its background, or the sort lets the
  background wash it out. Crossfading two copies of a scene built from different random samples
  looks grainy halfway; keep such blends short.
- For PACKS.md (section 5, after the levers): the `volume` kind and `out.volume`, as in the Notes
  above; and that `out.view` zoom steps need `focus: () => false` when the toy has no focus of its
  own.
- For BACKLOG.md: item 7 (a sonar or an ultrasound toy), and more real CT scans from the sources
  report (the gar fish, the ant), which `tools/img-walnut.mjs` could read the same way.
