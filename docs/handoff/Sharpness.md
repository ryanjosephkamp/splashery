# Lane Sharpness: grain out of the renderer

Prefix `shp`. Branch `claude/lane-sharpness`. PR "Engine: sharper splats (labs switches and
measurements)".

## Brief

(Written by the Operator on September 29, 2026, from the owner's marks and his message that morning,
and the second Lab round queued in WORKSTREAMS.md.)

The owner's words: "I almost want to make things so incredible with this that people won't even
realize that they're looking at Gaussian splats … some of the stuff, just, like, the resolution
isn't great. It just looks grainy." This morning, on the Worlds: "still just a bit too grainy." On
Books: "The book itself (not the pages) just seem a little bit blurry or grainy, especially around
the edges." On the blind toy piano, one maker's version was "Too grainy" and the other's was not,
from the same brief, so much of the grain is in how a toy is built. Lanes Fidelity A and B fixed
that side toy by toy (even placement, full opacity, full density, clean colors) and the owner marked
all of it good. Your lane is the other side: the renderer and the engine settings every toy shares.

Find out what grain is left once a toy is built well, and take it out of the engine, measured,
behind switches first:

1. **Measure.** Pick about ten toys the owner has called grainy or that Fidelity A graded worst
   (docs/handoff/FidelityA.md, "## Audit", on main after #77 merges, or on claude/lane-fidelity-a),
   plus the book (`your-book`), a Studio toy (`chladni-plate`) and, once lane Worlds merges (#78),
   the test island. Render each at 390×844 with a device pixel ratio of 2 and 3, the way
   `tools/lab-kernels.mjs` does (docs/lab/KERNELS.md), and record edge width, speckle and shimmer,
   frame time and splats on screen. Say where the grain comes from for each: the cull, the
   pixel-ratio cap, the adaptive drop in resolution while frames are slow, the falloff, the tier's
   budget, or the toy's own build.
2. **The levers**, each as a labs switch (off by default, on with `?labs=1` and a URL switch, like
   `?kernel=sharp`):
   - the cull: `minPixelSize` and `minContribution` (src/stage.js; the engine skips splats under
     about 2 screen pixels; Fidelity A found this hurts dense kit toys), per toy or globally;
   - the pixel-ratio cap per tier (`PIXEL_RATIO` in src/player.js caps phones at 2; many phones
     are 3) and the adaptive drop (src/stage.js), for example holding full resolution while the toy
     is still and only dropping during a drag;
   - the sharp kernel from lane Lab (`src/kernels.js`) on the toys with big, smooth splats, where
     Lab found a real win;
   - anything else your measurements point to (a small sort or blend fix, a budget change on strong
     phones), as long as it stays additive and every other toy looks the same with the switches off.
3. **Show it.** Before-and-after cards at 390×844 ("built by Opus 5.5"), lane record "Sharpness" on
   the Effect review page: `shp-<toy-id>` for each measured toy (a still pair, plus a short turn
   where shimmer matters), and `shp-summary` (a table as an image or text: what each lever does and
   costs). Judge them as motion at phone size.
4. **Propose.** In "For the Operator", say which levers should become the default, for which toys or
   tiers, and at what cost in frame time and battery. The owner decides what leaves labs; don't turn
   anything on by default for public toys.

Write down the method in docs/lab/SHARPNESS.md (like KERNELS.md), and your tests in
tests/shp.spec.mjs (each switch off leaves the renderer exactly as before; each switch on changes
what it should).

### You own

- the render settings in `src/stage.js` (the culling, pixel ratio and adaptive blocks) and
  `src/player.js` (`PIXEL_RATIO` and where it is read), `src/kernels.js`, a new
  `tools/shp-measure.mjs` (or an extension of `tools/lab-kernels.mjs`), docs/lab/SHARPNESS.md,
  tests/shp.spec.mjs, your `shp-*` screenshots and docs/handoff/Sharpness.md.
- Not the toy packs (Fidelity B and other lanes own toys), not `src/worlds/` (lane Worlds owns it;
  say what the Worlds render should adopt instead), not `src/pictures.js` (the picture engine).

This is an "Engine: …" PR: additive, small in each file, with every switch off by default. Lanes
Worlds, Fidelity A, Fidelity B, the toy piano (maker B), Anatomy, Pianos, Books and the Integrator
run at the same time; leave their files alone. The laptop is locked.

## State

Model: Opus 5.5 (claude-opus-5-5), default effort.

- September 29, 2026: the switches are built (src/sharpness.js, read in src/player.js and applied in
  src/stage.js), with tests in tests/shp.spec.mjs and the measuring tool tools/shp-measure.mjs.
  Measuring on a local checkout of main with Fidelity A (#77), Fidelity B (#90), Worlds (#78) and
  the toy piano (#91) merged in, so the toys are measured as they will be built.

## Notes

- The switches, all labs only: `?cull=low|off|<px>`, `?dpr=<1–3>|native`, `?adapt=drag`, `?aa=1`,
  and `?sharp=1` (cull low, dpr native, adapt drag together). A recipe's `render` field sets them
  for one toy; the URL wins. `?kernel=sharp` is lane Lab's and works alongside.

## Known issues

- None yet.

## For the Operator

- To come with the measurements.
