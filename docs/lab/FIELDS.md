# Lab: splat fields on the GPU

Lane Lab, September 29, 2026 (Opus 5.5). Background in [LITERATURE.md](LITERATURE.md) ("4D and
time-varying splats").

## The idea

A splat field is a toy whose splats carry only their own coordinates (u, v), while a small program
on the graphics chip works out every splat's place, tilt and color from (u, v) and the time, every
frame. Nothing moves on the CPU, so a toy can move hundreds of thousands of splats smoothly. It is
the hand-written cousin of the 4D Gaussian papers: there a trained network deforms the splats over
time; here a formula does.

## How it works

- **The engine hook** (additive, in the engine PR): `stage.setToy({ …, modifier })` takes a
  work-buffer program (`{ glsl, wgsl }`) in place of the kit's own, and the player passes a recipe's
  `gpuField(options, fit)` there, with labs on only. Without labs, or for any other toy, nothing
  changes. The work-buffer pass already runs for every splat every frame
  (`WORKBUFFER_UPDATE_ALWAYS`), so the field adds no pass of its own.
- **The toy** (`src/packs/lab.js`, the "Splat field" on the labs-only Lab shelf): the recipe emits
  about 297,000 splats (on the high profile) with (u, v) from an even R2 sequence, stored in each
  splat's `splatAnim` stream. Its GPU program reads them back with `loadSplatAnim()`, reads the
  kit's clock (`uSpKit.x`), the splat scale and exposure (`uSpClock`) and the tap's progress
  (`uSpMorph.x`, set by the recipe's `drive`), and computes the field. The same field at t = 0 in
  JavaScript places the splats for the kit's fit and the first sort, and colors them for the frozen
  fallback.
- **Three fields:**
  - **Galaxy**: stars on ellipses that turn a little more at each radius, and every star orbits
    along its own ellipse (faster inside). The ellipses crowd into two spiral arms that keep their
    shape while every star moves: the density-wave picture of spiral arms, drawn directly. A tap
    sends a bright ring out from the core.
  - **Ocean**: a round patch of sea from four Gerstner waves; each splat is tilted to the water's
    slope (from the waves' derivatives), lit and tinted by height, with light foam on the crests. A
    tap drops a stone in the middle: rings run out and die away.
  - **Knot**: a flow along a (2, 3) torus knot tube, six colored bands riding with it. A tap pushes
    the whole flow once more around the knot, so it ends where a lap would have.
- **Sorting.** On WebGPU the engine sorts on the GPU from the moved splats, so the order is right
  every frame. On WebGL2 it sorts on the CPU from the stored (t = 0) places, so the order goes stale
  as a field moves. On these three fields it doesn't show at phone size (small, nearly opaque
  splats, or a surface seen from above), but a field whose splats cross in depth would need a
  refresh.

## Measured

`node tools/lab-fields.mjs` (and `--labs=0` for the same toy frozen), 390×844 at a device pixel
ratio of 2, high profile, WebGL2 in Chromium's software renderer:

| Field  | Splats  | Frame, field on (ms) | Frame, frozen (ms) | CPU to move them in JavaScript (ms per frame) |
| ------ | ------- | -------------------- | ------------------ | --------------------------------------------- |
| Galaxy | 297,000 | 647                  | 771                | 44–48                                         |
| Ocean  | 297,000 | 515                  | 581                | 77–95                                         |
| Knot   | 297,000 | 489                  | 597                | 98–166                                        |

- The software renderer emulates the GPU on the CPU, so its frame times say only one thing: the
  field costs no more than the same toy frozen (both run the same per-splat pass every frame; the
  difference is noise). On a phone's GPU, a few hundred arithmetic operations for 300,000 splats is
  well under a millisecond; the owner's phone is the real test.
- Moving the same splats from JavaScript would cost 44–166 ms of CPU per frame on this machine
  before uploading anything, far over a 16 ms frame. That is why the splat equation toy today
  precomputes twelve copies of at most 10,000 splats and morphs between them; a field moves 30 times
  as many, exactly, every frame.

## What it would take for Worlds and the Studio

- **Worlds.** Oceans, lakes, grass, clouds, flags, crowds of birds or fish, falling leaves and rain
  are all fields: a patch of splats whose program moves them. A world would add a field as a prop (a
  recipe with `gpuField`) and give it the world's clock and wind as uniforms. Two things to build: a
  field per prop rather than per toy (the hook is per gsplat entity, so it fits; the world engine
  would pass the modifier when it places the prop), and level of detail (fewer splats far away,
  which the u, v layout makes easy: draw the first N of an R2 sequence). WebGL2's stale CPU sort
  matters more in a world (splats cross in depth as the view flies), so a world should prefer
  WebGPU's GPU sort, or re-sort from a coarse JavaScript copy of the field every few frames.
- **The Studio.** The song landscape and the Chladni plate are fields: the spectrogram is a height
  field over (time, frequency) and the plate's sand settles toward a mode's nodal lines. Feeding a
  field live data needs one more piece: a small data texture (the latest spectrum, or a mode's
  numbers) bound to the program as a uniform, as the kit already does for its screen and pattern
  textures.
- **Typed programs.** The splat equation toy's language (lane Math's safe reader) could compile to
  this GPU program instead of twelve JavaScript copies: the reader already accepts only numbers, a
  fixed set of functions and u, v, t, so a small code generator from its parse tree to GLSL and WGSL
  would stay just as safe. That needs the reader to hand back its tree (today it returns JavaScript
  closures), a change in `src/equation.js` for the lane that owns it.
