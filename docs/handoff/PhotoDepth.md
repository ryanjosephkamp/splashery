# Lane Photo depth (`pdp`)

Model: Opus 5.5, at high effort. Branches: `claude/lane-photo-depth` (PR "Phase Photo depth: …") and
`claude/lane-photo-depth-engine` (PR #468, "Engine: …", merged first).

## Brief

You are a Splashery worker session started by the Operator (the coordinating session). Repo:
ryanjosephkamp/splashery.

- Your lane: Photo depth (prefix `pdp`).
- Branches: `claude/lane-photo-depth`, plus `claude/lane-photo-depth-engine` for changes to shared
  UI or the app. That one is a small, additive "Engine: …" PR, merged first.
- PR title: "Phase Photo depth: a clean depth animation in the Sharp view, a movable depth slider
  and the depth sound".
- Handoff file: docs/handoff/PhotoDepth.md. Create it, starting with this brief word for word under
  "## Brief". Then keep "## State

October 9, 2026: first READY. Both PRs are drafts, and the clips are on Effect review page 2 (lane
record `PhotoDepth`), waiting for the owner's marks.

- **Engine PR #468** (`claude/lane-photo-depth-engine`): the movable slider (drag, remember, clamp,
  reset, arrow keys, `user-select: none`), focus mode's `--panel-w: 0px` on computers, and the
  recipe hook `toySound(options)` in `src/app.js` and `src/viewer.js`. Ready for the full run, then
  merge.
- **Lane PR #471** (`claude/lane-photo-depth`, built on #468): fixes A and B in the Sharp picture,
  the splats' backing, the Sound choice, tests, and the clip tool (`tools/pdp-clip.mjs`).
- **Tests run (72):** pdp, pdp-engine, psv, psv2, psv3, p3d, phf, phf2, and phf-engine all pass. 64
  ran in one go before a container restart, and the other 8, with pdp again after the border change,
  ran afterward. lv8-dial and lv8 pass on the engine branch. The full suite is for the Integrator.
- **Clips (cards `pdp-…`):** the portrait and Wildflowers before and after, the slider on a phone
  and in full screen on a computer, and the sound choice (with sound).

## Notes", "## Known issues" and "## For the Operator" current.

- Model: Opus 5.5, at high effort (CLAUDE.md).

### Brief (written by the Operator on October 9, 2026, from the owner's walkthrough)

Read docs/reviews/2026-10-09-walkthrough/triage.md, section "Photo depth". It is your list, with
each cause from a read-only research pass. Confirm each cause before you fix it. Also read
docs/PHOTO-VIEWS.md and docs/handoff/ for the Photo sharp view (psv) and Photo fidelity (phf) lanes,
which built what you are changing.

**1. Sharp picture view: parts pop out during the depth animation.** It happens only in the middle
of the tap's 3.2 s rise or flatten, mostly on the owner's own photos (portraits), even at low depth.
The Splats view doesn't do it.

- Cause: in src/live/relief-mesh.js (GLSL vertex shader about 65–117, and the WGSL copy about
  190–249), the backing sheet's height uses the farthest layer's morph value (`uMorph.x`, which
  rises first) and a 7×7 minimum depth. Mid-transition it ends up in front of a near surface that
  hasn't risen yet: stepped slabs, with texture smeared along edges. A second cause is that blending
  four layer values per vertex lets a near feature sink behind a farther one mid-change.
- Fix A (essential): base the backing on the surface's current height (the same height function as
  the surface, the lowest over the 7×7 taps, minus a small offset), so it is always behind, at every
  moment.
- Fix B (recommended, the owner's rule "parts move as solid pieces"): move each connected piece with
  one layer value, as the splats do. Return the per-cell layer grid from the splat build
  (photo-3d-core.js, about 419–424), upload it as a nearest-filtered texture, and use one morph per
  piece. Cut where neighbors' layers differ, all computed once at build.
- The splats' own backing has a milder form of the same flaw (src/packs/photo-3d.js, about 523–536).
  Fix it the same way.
- Tests: none check the middle of the transition. Add a pure test of the height function (backing ≤
  surface − 0.01 for r from 0.1 to 0.9) on a sample with stairs and on a synthetic portrait, and a
  browser test frozen mid-transition.
- **Photos:** don't add photos of real people to the repo. Use a synthetic portrait, or a CC0 photo
  of a statue or mannequin, for tests and clips.

**2. The depth slider.** Shared UI: index.html about 61–76, styles.css about 2998–3089, src/ui.js
about 2717–2774. It is used by Photo to 3D, Moving photo to 3D and the splat mirror. On the engine
branch:

- make the slider panel draggable, and the small Depth button left after closing it;
- remember the position per device and per layout, in localStorage with try/catch, relative to the
  stage canvas;
- clamp it to the canvas and re-anchor on resize, panel changes, focus mode and full screen (a
  ResizeObserver on #stage);
- give it a reset (double-click or Home) and arrow keys;
- fix full screen on desktop: focus mode hides the panel but leaves `--panel-w` set. The quick fix
  is `body.focus{--panel-w:0px}` on desktop widths, which also re-centers #toy-slider.
- Keep tests/lv8-dial.spec.mjs and tests/lv8.spec.mjs green, and add tests for dragging,
  remembering, focus mode and storage that throws.

**3. Choosing the depth sound on Photo to 3D.**

- A "Sound" choice in its input panel:
  - Paper (today's default);
  - a soft chime;
  - pop-up layers (four plucks timed to the layers);
  - a water drop;
  - none;
  - "Use my own sound…".
- No wind and no whoosh (tools/sound-review.json has the owner's note).
- Your own sound file stays in memory on the device: never uploaded, never saved in the scene, the
  link or storage. A scene that says "custom" falls back to Paper.
- The choice is saved in the scene as an option.
- A tiny additive hook in src/app.js lets a recipe pick its sound from its options (about lines 890
  and 1276), on the engine branch. Or push the cue from `drive` with `action.quiet`, if that avoids
  an engine change.
- List the new built-in sounds in tools/sound-review.json as "ready", so the owner hears them on the
  Sound Board.

**Not yours:** src/packs/moving-photo.js. Codex task 32 (docs/codex/32-moving-photo-stability.md) is
changing it now. Making the Sharp view take depth for the exact video frame comes after that lands.

**Clips** at phone size on Effect review page 2 (card ids `pdp-…`):

- the depth rise and flatten in the Sharp view on two photos with depth edges, before and after;
- the slider dragged, and in full screen on desktop;
- the sound choice.

**You own:** src/live/relief-mesh.js, src/packs/photo-sharp.js, Photo to 3D's sound and options and
its splat backing in src/packs/photo-3d.js and photo-3d-core.js, their lines in the shared lists,
and tests/pdp\*.spec.mjs. Never edit tests/taps.spec.mjs.

How this lane runs: exactly as docs/handoff/ScienceR3.md, "How this lane runs", says (read it;
replace the prefix and lane record with yours).

- **Merging:** the engine PR merges after a full test run. Changes to public toys wait for the
  owner's "good" marks; labs work merges after the tests and his marks.
- **Ending turns:** finish every working turn with "READY:", "WORKING:" or "BLOCKED:". Splashery has
  no CI to wait for. For a long job, schedule a check-in with send_later instead of going idle.
- **Clips:** phone size (390x844; device scale 2 is fine). They go on Effect review page 2
  (https://claude.ai/artifact/BSayVkzQ2FKESesrkrSUMK) as docs/OPERATING.md, "Steps for a lane", says
  (no republish).
- **Marks with pictures:** the owner's marks may carry `images`, screenshots he attached. Read each
  with the Artifact tool's `read` (url the page, path the asset id) before you fix that card.
- **Before READY:** re-read CLAUDE.md's "Effect quality rules" and check each clip against them at
  phone size.
- **Public text:** American English and the serial comma (CLAUDE.md).
- **Pace:** your Operator is session_012GmKRUMZLir2nb27Bo8Cu2. Aim for a first READY within about
  six hours.

## State

- Engine PR #468 (`claude/lane-photo-depth-engine`): the movable slider, focus mode's `--panel-w`,
  and the recipe hook `toySound(options)`. `tests/pdp-engine.spec.mjs`, lv8-dial and lv8 are green.
- Lane branch: the Sharp view's pieces and backing (fixes A and B), the splats' backing, and the
  Sound choice. In progress.

## Notes

- **Causes confirmed.** In the Sharp view, the backing's height was
  `mix(lift·(min d − base) + offset, backFlat, uMorph.x)`. Channel 0 rises first, so mid-tap the
  backing stood at the far depth's full height while a near face's channel was still nearly flat.
  Around a portrait, where all the depth within reach is the face's, the backing came out in front
  of the face. The surface blended four channels by depth per vertex, so one piece had several
  morphs at once. The splats' backing rode channel 0 with the same flaw wherever everything within
  reach was nearer than the flat picture.
- **Fix A, exact rather than the 7×7 taps.** At build, `backingField` (`src/live/relief-height.js`)
  stores the lowest depth of each layer's surface within reach of each backing point (an RGBA8
  texture, 255 for none). Each frame, the shader takes the lowest of the four layers' current
  heights, less 0.012. A layer's height rises with its depth, so this is the lowest point of the
  surface near there at every moment. The texture's linear filter (a 3×3 minimum) and the border's
  softened depth (as layer 0, capped at the flat picture) are counted too.
- **Fix B.** `buildPhotoSplats` returns `cellBand` (each fine cell's layer, from its piece, as the
  splats use). The relief uploads it as a nearest-filtered R8 texture, so each point takes its
  piece's one morph and Layers offset. The vertex cut also drops a point beside another layer. Six
  cells from the border, the layer eases back into the blend by depth, so the outline stays straight
  (nothing is cut there).
- **The splats' backing.** A splat morphs along a straight line on one channel. A backing splat
  whose surface within reach lies behind the flat picture keeps channel 0. One whose surface lies in
  front of it now rides channel 3, the last to rise. Either way it stays behind at every moment
  (worst gap +0.004 on the portrait).
- Moving photo to 3D's relief is unchanged: no pieces texture, and the old path in the shader.
- **The border.** Within 3% of the picture's edge (and two to six cells of it), the layers blend by
  depth as before and nothing is cut between layers. The backing is inset 2%, so a cut there would
  leave a hole. `pdpDeep` in both shaders, and `surfacePoint` in relief-height.js mirrors it.
- **The Sound choice.** It is the toy option `sound`, written straight into the scene (no rebuild),
  as the view switch is. Your own sound is an object URL in `SAMPLES.data` (`src/voices.js`) under a
  new key each time. `tools/pdp-clip.mjs sound` renders the sounds offline into the clip.
- **The browser test** (`pdp.spec.mjs`, "frozen mid-tap") draws the backing in magenta
  (`window.__psv.tint`) and freezes the tap with `motion.setControl("flat", v, { snap: true })`.

## Known issues

- **Ragged holes along a photo's edges mid-tap** (forest, Wildflowers): cut bands near the border
  where no backing lies behind. They are the same on main (checked frame for frame), so they come
  from earlier work, not this lane. A fix would extend the backing to the edge or stop the depth cut
  near it. Left for a later round unless the owner asks.
- The browser test's mid-tap check couldn't be run against the old code, which has no magenta hook.
  The pure test does check the old formula fails on the portrait.
- WebGPU: the WGSL copy is written to match the GLSL, but the tests run on WebGL2 only.
- The new sounds are synthesized (bell, harp, drip). I haven't listened to them here. The owner
  hears them on the Sound Board and in the clip.

## For the Operator

- Merge #468 first (a full run), then #471 after the owner's marks (labs).
- TOY-PLAN.md was regenerated on the lane branch. Regenerate it again after merging, as usual.
- The Sound Board page needs `tools/upkeep.mjs` after the merge, so the three "ready" sounds show.
