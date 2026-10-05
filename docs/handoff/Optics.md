# Lane Waves and optics (Optics, prefix `opt`)

## Brief

You are a Splashery worker session, started by the Operator (the coordinating session) for the October push. Repo: ryanjosephkamp/splashery. Your lane: Waves and optics (id `Optics`, prefix `opt`). Branch: `claude/lane-optics` (and `claude/lane-optics-engine` for any change to the app outside your own files, as an "Engine: …" PR merged first). PR title: "Phase Waves and optics: a ripple tank and a light bench". Handoff file: docs/handoff/Optics.md (create it; start it with this brief, word for word, under "## Brief", then keep "## State", "## Notes", "## Known issues" and "## For the Operator" current). Model: Opus 5.5.

### Brief (written by the Operator on October 5, 2026, from the owner's Push Plan picks)

Push Plan S9 (yes). Everything physically right, with sources you open, and plain words where it simplifies.

1. **Ripple tank**: a real 2D wave equation solved on a grid (finite differences, stable time step, absorbing edges), drawn as a water surface of splats lit so the crests read. One or two point sources, a plane wave, a barrier with one or two slits of adjustable width and spacing, frequency and speed controls. The double slit's bright fringes must land where d·sin θ = m·λ says (test it numerically), and single-slit diffraction must widen as the slit narrows. A tap drops a pebble.
2. **Light bench**: rays traced through parts you drag on a bench: thin and thick lenses (real spherical surfaces with Snell's law), plane and curved mirrors, a prism with real dispersion (a named glass, such as BK7, with its published Sellmeier coefficients), a glass block, and total internal reflection in a fiber. Show the numbers (angles, focal length, the lens equation's image distance). Rays are thin bright splat lines; white light splits into a spectrum through the prism.
3. **Evidence**: docs/evidence/<toy id>.json for each toy, with tests: refraction angles against Snell's law, a lens's image position against 1/f = 1/d_o + 1/d_i, the fringe spacing, the prism's deviation for a wavelength.

New labs toys on the Science shelf. The Sound and light lab lane owns emission spectra and the home spectrometer: don't build those; the bench's prism splits white light only. Tests in `tests/opt*.spec.mjs`; clips at phone size on Effect review page 2 (lane record `Optics`); how-to and About texts; a sound for a tap if it fits (src/voices.js).

You own: `src/optics/` (new), `src/packs/optics.js` (new), `tools/opt-*.mjs`, `tests/opt*.spec.mjs`, your toys' evidence files, their lines in the shared lists, and your handoff file.

How this lane runs: exactly as docs/handoff/ScienceR3.md, "How this lane runs", says (read it; replace the prefix and lane record with yours). Labs: the Operator merges after a full test run. Finish every working turn with "READY:", "WORKING:" or "BLOCKED:"; Splashery has no CI to wait for; for a long job, schedule a check-in with send_later instead of going idle. Before READY, re-read CLAUDE.md's "Effect quality rules" and check each clip against them at phone size.

## State

WORKING (October 5, 2026): design settled, building the ripple tank first, then the light bench.

## Notes

- No engine change is needed. Both toys draw live data with the kit's own `relief` kind (kind 24,
  lane Live input): the recipe's `screen` canvas holds each splat's color (left half) and lift
  (right half), redrawn when `screen.version()` changes. It runs in the kit's own program, so it
  works on WebGL2 and WebGPU, with labs on or off.
- The ripple tank: the wave equation runs on the CPU (`src/optics/ripple.js`), one relief splat per
  grid cell, lifted by the height and lit on the CPU so the crests read.
- The light bench: the parts are kit tokens (dragged); the rays are relief splats on a fine lattice
  (each sample of a ray goes to a free splat of the lattice cell it falls in, moved within the cell
  by the 3D offset), so rays redraw live while a part is dragged.

## Known issues

None yet.

## For the Operator

Nothing yet.
