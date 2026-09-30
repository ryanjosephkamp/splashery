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

- September 29, 2026: done and posted. The switches (src/sharpness.js, read in src/player.js and
  applied in src/stage.js), tests in tests/shp.spec.mjs, the measuring tool tools/shp-measure.mjs,
  the card tool tools/shp-cards.mjs and the method and results in docs/lab/SHARPNESS.md. 14 toys and
  the test island measured on a local checkout of main with Fidelity A (#77), Fidelity B (#90),
  Worlds (#78) and the toy piano (maker B, #91) merged in (A and B have since merged to main).
- Cards on the Effect review page, lane Sharpness: `shp-summary`, `shp-<toy id>` for the 14 toys,
  `shp-<toy id>-turn` for the sailboat, ocean liner, penguin and Chladni plate, `shp-lamp-drop`,
  `shp-klein-bottle-drop` and `shp-test-island`.

## Notes

- The switches, all labs only: `?cull=low|off|<px>`, `?dpr=<1–3>|native`, `?adapt=drag`, `?aa=1`,
  and `?sharp=1` (cull low, dpr native, adapt drag together). A recipe's `render` field sets them
  for one toy; the URL wins. `?kernel=sharp` is lane Lab's and works alongside.
- With every switch off, `Stage.setSharpness(null)` returns before touching anything, and
  `setPictureCulling` works as before (it now goes through `applyCulling`, which gives the same
  values when no lever is on).
- `setBusy` takes a second argument, whether the view is being dragged (the camera or a paint
  stroke); only `adapt=drag` reads it.
- WebGPU works in this container's Chromium (SwiftShader): the Klein bottle and the lamp were
  measured on it too.
- The software renderer's frame times are relative only; the phone is the real test of cost.

## Known issues

- The CPU estimate of culled splats counts splats hidden under others too, so it overstates what the
  cull takes off the screen (the Klein bottle: 23% estimated on WebGPU, no visible change).
- The frame times come from SwiftShader, which is not fill-bound the way a phone GPU is; the 3x cost
  on a real phone is likely higher for toys than measured here.
- `?adapt=drag` means a slow phone may drop below 40 frames a second while a toy plays on its own.

## For the Operator

Proposal for the owner (nothing is on by default; he decides what leaves labs):

1. **Lift the pixel-ratio cap to 3 on the mid and high tiers**
   (`PIXEL_RATIO = { low: 1.5, mid: 3, high: 3, max: 3 }`, still capped by the device's own ratio).
   The biggest and simplest win: every toy's edges about a third narrower on a 3x phone, speckle
   down 10–60%, shimmer down 15–45%. Cost: 2.25 times the pixels on a 3x phone; a toy is mostly
   per-splat work and stays smooth on a recent phone, and the adaptive drop still catches a phone
   that can't keep up. Battery: more GPU work per frame, but the player renders on demand (nothing
   is drawn while a toy is still), so it costs only while something moves.
2. **Make `adapt=drag` the default.** Today a slow phone draws at two-thirds resolution whenever
   anything moves, including the idle sway, which is where toys look grainiest (and on WebGPU the
   cull then drops most of a toy's splats). Cost: a slow phone's frame rate while a toy plays on its
   own; the tier step-down after slow frames still happens during drags.
3. **Leave the cull as it is** globally (no visible gain at a toy's home view). Lane Pictures' lower
   cull for pages stays.
4. **The sharp kernel stays per toy**: `kernel: "sharp"` in a recipe for toys with big, smooth
   splats (the splat equation toy, the math surfaces), and possibly the clock, the toy piano and the
   book (small gains measured). Not the marble.
5. **No budget change**: more splats per toy made nothing sharper and several toys shimmer more.
6. **Worlds** (lane Worlds owns src/worlds/): `WorldView` caps the ratio at 2
   (`Math.min(devicePixelRatio, 2)` in render.js). At 3x the test island's edges go 0.73 → 0.53 and
   its ground speckle 0.16 → 0.10, but its frame time about doubles (a world is fill-bound). Adopt
   3x only on the high and max world tiers, or with an adaptive drop during movement (the world page
   has none today). The cull made no difference there.
7. **What is left is the toys' build**: the Chladni plate's sand, the white blood cell's membrane,
   the Klein bottle's textured tube, the American football's leather noise, the marble's glass, the
   sailboat's dark hull flecks and the book's frayed cover edge. Items for a fidelity lane.
8. **The owner's marks of September 29, 2026**: 18 of 22 cards "good" (the summary included); four
   "fix". None is the renderer's; each needs the lane that owns the toy (not this lane's files), so
   they wait on the Operator:
   - `shp-clock`, "The minute and hour hands on the clock aren't fully visible": the hands sit 1 to
     3 cm above the dial (`hand()` in src/packs/objects.js: `zf + 0.01`, `0.02`, `0.03`), so from
     the home view the dial's big, flat splats sort in front of a hand pointing up and to the right.
     Reproduced at 1:52 (the hour hand vanishes, both at 2x and 3x). Lifting them to `0.04`, `0.055`
     and `0.07` shows the hand (tested locally, not committed). A small fix in the clock's recipe
     for whichever lane owns objects.js now; this lane can make it if the Operator says so.
   - `shp-marble`, "I can barely see the marble's glass spherical shape": the glass shell is a
     faint, nearly white cloud on a white background at any ratio; the build needs a visible rim (a
     brighter, more opaque edge where the shell turns away).
   - `shp-your-book`, "Background rectangle still looks too grainy. The border/edges aren't
     straight": the cover's edge splats are placed loosely (a frayed edge at any ratio). A build fix
     for the book's cover (lane Books or Pictures).
   - `shp-test-island`, "The person, however, doesn't look right … a polished video game character":
     the character's build (lane Worlds or its Character lane).
9. For the backlog: a toy recipe's `render: { cull, dpr, adapt, aa }` (labs only) lets a lane try
   the levers per toy.
