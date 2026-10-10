# Lane Fix10: the walkthrough's science fixes (prefix `fx10`)

## Brief

You are a Splashery worker session started by the Operator (the coordinating session). Repo:
ryanjosephkamp/splashery.

- Your lane: Fix10 (prefix `fx10`).
- Branches: `claude/lane-fix10`, plus `claude/lane-fix10-engine` for the night sky's camera change.
  That one is a small, additive "Engine: …" PR, merged first.
- PR title: "Phase Fix10: the walkthrough's science fixes".
- Handoff file: docs/handoff/Fix10.md. Create it, starting with this brief word for word under "##
  Brief". Then keep "## State

- October 9, 2026: READY for the owner's marks. Draft PR #467 (`claude/lane-fix10`) and the engine
  PR #475 (`claude/lane-fix10-engine`, merges first). Nine cards in the Fix10 section of Effect
  review page 2.
- 1. Volume viewer sound: tap `pageflip` plus a soft `thud`; Play `action.quiet: ["sweep"]` and two
     `whoom` cues, one per pass; drag silent. In tools/sound-review.json as "ready".
- 2. Electron microscope: zoom on any object (`targets`, `action.at`, `kit.data.zoom`).
- 3. Fruit MRI: `mriDrag`, the Slice slider, no turning, face-on camera, `pausable: false`, brighter
     outline, an amber ring per slice.
- 4. Ripple tank: `PEBBLE` (2.4 cm pale stone from 10 cm in 0.45 s, a shadow, a sink, a bigger
     dent); the drip at 0.43 s.
- 5. Night sky: the day ground at the night's density, every ground splat capped at the skyline; the
     drag in the engine PR.
- 6. Thumbnails at 4x with labs on; the 5-cell's camera 4.1 -> 3.1; the 4D shapes' and the MRI's
     thumbnails re-rendered.
- Tests: tests/fx10.spec.mjs plus the touched files' specs (252 run, 251 passed; the one failure,
  smoke's shelf-grid name check, fails on main too). Engine branch: sky-engine and sky specs, 14
  passed.

## Notes", "## Known issues" and "## For the Operator" current.

- Model: Opus 5.5, at high effort (CLAUDE.md).

### Brief (written by the Operator on October 9, 2026, from the owner's walkthrough)

Read docs/reviews/2026-10-09-walkthrough/triage.md, section "Fix10". It is your list. The details
below come from a read-only research pass; confirm each before you fix it. Each toy's earlier lane
left a handoff in docs/handoff/: VolumeViewer, Imaging, Optics, NightSky and MathR2.

1. **Volume viewer sound** (src/toy-sounds.js "volume-viewer"; the tap in src/packs/volume-viewer.js
   about 494–505; the Play sweep in `driveVolume` 227–251). Today both play a double click plus a
   rising sawtooth hum. The owner wants neither.
   - Tap: a film slid onto a lightbox (for example `pageflip`, with an optional soft settle).
   - Play: its own dark, soft rush (for example two `whoom` cues timed to the cut's two passes,
     pushed from the drive with `action.quiet: ["sweep"]`).
   - Drag: silent.
   - Update tools/toy-plan.json, and run `node tools/sound-lint.mjs --toy volume-viewer` and
     `node tools/sound-check.mjs volume-viewer`.
   - Put the new sounds in tools/sound-review.json as "ready".
2. **Electron microscope: zoom on any object** (src/packs/imaging.js: `semSpecimen` about 1581–1818,
   `buildSEM`, `driveSEM` 1850–1859, recipe 2209–2236).
   - Return a list of targets per image (Pollen: the spiky grain, the lily, the pine with its two
     sacs, three small grains; Diatoms: the centric and the pennate), each with two zoom steps.
   - Add `action.at(point)`, which picks the nearest object's ellipse and returns
     `{ key: "zoom", pick: i }`.
   - Make the drive keep the current target and step:
     - a tap on a new object starts its zoom;
     - the same object steps on;
     - the third tap zooms out.
   - Keep target 0's steps exactly, so tests/img.spec.mjs still passes; add a case with `pick`.
   - Update the action label and the how-to.
3. **MRI of a fruit: the slice control** (imaging.js `cutState`/`cutDrag` 1310–1340, `buildMRI`
   1440–1490, `driveMRI` 1496–1514, recipe 2184–2208; help in src/toy-help.js).
   - Why it "locks up": a tap starts a long sweep, a second tap pauses it, and while paused the
     sweep holds the slice, so every drag is ignored. Make a drag always beat the sweep (stamp the
     drag time), and consider `pausable: false` on `play`.
   - Add `turntable: false`, so the slice stays face-on and the drag works without the ✋ switch.
   - Fit the drag gain to the fruit (one drag over its height covers every slice).
   - Add a Slice slider (`out.slider`, as src/packs/space-r4.js does). The wheel stays zoom.
   - Make the outline brighter, and add a thin contour ring on each slice.
   - Rewrite the how-to without the word "scroll".
4. **Ripple tank's pebble** (src/packs/optics.js 537–539 and its drive 405–438; src/optics/ripple.js
   `pebble`).
   - Make it about 2.4 cm, pale stone, falling from higher and a little slower.
   - Give it a shadow that tightens as it falls, have it sink briefly after landing, and make a
     bigger dent to match.
   - Move the drip's timing to match.
5. **Night sky.**
   - **Daytime blur** (src/packs/night-sky.js: day sky 517–524, day ground 690–700). The day ground
     uses fewer, bigger splats than the night (overlap 1.7 against 1.15), and their soft edges smear
     the skyline.
     - Give the day the night's density near the horizon.
     - Cap each ground splat's size near the skyline so its edge never crosses it.
     - Optionally use more, smaller day-sky splats.
   - **Drag too fast:** src/camera.js `rotateBy` (126–153) uses the orbit sensitivity in the inside
     view; a full-height drag turns 504° over a 72° view. On the engine branch, scale the drag to
     the current field of view when `inside` is set, so the star under the finger stays under it,
     and shorten the coast. Only the night sky uses `inside`. Test in tests/sky-engine.spec.mjs.
6. **The 5-cell's thumbnail.**
   - At 256 px most of its thin splats fall under the 2-px cull, and its rest pose projects to about
     half the others' size.
   - In tools/make-thumbs.mjs, render at 4× and scale down (or turn picture culling on while
     shooting), with labs=1.
   - Bring the 5-cell's camera closer (src/toys.js, about 2655).
   - Re-render the 4D shapes' thumbnails (5-cell, 16-cell, 24-cell, duoprism, hypercube) and check
     they look the same size.
   - Don't re-render every toy's thumbnail.

**Clips** at phone size on Effect review page 2 (card ids `fx10-…`), before and after each:

- the electron microscope zooming on two objects;
- the MRI with a drag and the slider;
- the ripple tank;
- the night sky by day, and a drag;
- the five 4D thumbnails side by side (a still card).

**You own:** the named toys' recipes and helpers in volume-viewer.js, imaging.js, optics.js and
night-sky.js; the 4D shapes' cameras in src/toys.js; tools/make-thumbs.mjs; their lines in the
shared lists; and tests/fx10\*.spec.mjs. Never edit tests/taps.spec.mjs.

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

- October 9, 2026: started on `claude/lane-fix10` from main 8a53aa5c.
- 1. Volume viewer sound: done (tap: `pageflip` plus a soft `thud`; Play: `action.quiet: ["sweep"]`
     and two `whoom` cues from `driveVolume`, one per pass; drag silent). sound-lint and sound-check
     pass.
- 2 to 6: to do.

## Notes

- `tools/fx10-clip.mjs` records phone-sized MP4 clips with the camera free (effect-clip holds it, so
  the microscope's view glides would not show). Before clips come from a worktree of main served on
  port 4174 (`SPLASHERY_URL`).
- From inside, the old drag moved the stars against the finger sideways (and with it vertically);
  the engine fix turns the view with the finger both ways.

## Known issues

- The volume viewer's build is over the 1.5 s check (on main too; this lane does not touch it).

- The night sky at dawn: while the day ground is half faded in, the twilight glow shows through it
  near the skyline (on main too; thinner now).
- The MRI's outline sphere, seen face-on, is a faint speckled disc behind the end slices (as
  before).

## For the Operator

- October 9, 2026, 23:47 UTC: the owner marked all nine Fix10 cards "good" on Effect review page 2.
  Nothing is open on the lane's side; #475 then #467 are ready to merge after the full run.

- Merge #475 (Engine) first, then #467 after the owner's marks (labs toys; the hypercube's thumbnail
  is a public toy's).
- `tests/smoke.spec.mjs` "dragging the shelf up opens a grid…" fails on main too: one toy name is
  cut on the phone shelf (`expect(cut).toBe(0)`, received 1). Not this lane's.
- `node tools/check-packs.mjs volume-viewer` reports the build as too slow (1.7 s) on main too.
