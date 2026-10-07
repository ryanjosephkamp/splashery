# Lane Live r8: a sharper Chladni plate, a 3D look, and a depth slider (prefix `lv8`)

## Brief

You are a Splashery worker session, started by the Operator (the coordinating session). Repo:
ryanjosephkamp/splashery. Your lane: Live r8 (id `LiveR8`, prefix `lv8`). Branch:
`claude/lane-live-r8` (and `claude/lane-live-r8-engine` for any change to the app outside your own
files, as an "Engine: …" PR merged first). PR title: "Phase Live r8: a sharper Chladni plate, a 3D
look, and a depth slider". Handoff file: docs/handoff/LiveR8.md (create it; start it with this
brief, word for word, under "## Brief", then keep "## State", "## Notes", "## Known issues" and "##
For the Operator" current). Model: Opus 5.5, at the default effort.

### Brief (written by the Operator on October 7, 2026, from the owner's walkthrough review)

Read the owner's own words first: docs/reviews/2026-10-06-walkthrough/notes.md (the Chladni plate
and splat mirror paragraphs), then the Operator's triage in
docs/reviews/2026-10-06-walkthrough/triage.md, "Elsewhere", "Live r8". Read docs/handoff/LiveR7.md
(its "For the Operator" has Live r7's notes for you) and docs/handoff/LiveInput.md. The owner loves
the Chladni plate ("one of the coolest things here"): keep how it works and how it looks, and change
only what follows.

Build in this order:

1. **The Chladni plate, sharper.** The plate still looks grainy; the sand is fine but may get a
   little sharper too. Sharpen the way the Fidelity and Sharpness lanes did (finer, denser splats
   where it shows, no speckle, no blur, solid opaque metal). Keep it smooth on a phone. Before-and-
   after clips at 390×844.
2. **A depth slider on screen.** For the splat mirror and the other toys where people set depth
   (find them: the settings' depth control), a small vertical slider over the stage, drawn as normal
   page UI (not splats), present by default, hideable with one tap, and remembered per device. It
   drives the same setting as the one in the settings panel and never covers the face or the main
   controls on a phone. This is app UI, so it goes in an "Engine: …" PR on
   `claude/lane-live-r8-engine`, small and additive, with its own tests.
3. **A 3D look, only if the physics holds.** Find out whether a true 3D version is honest physics:
   particles settling on the nodal surfaces of a 3D standing wave (for example a cube or a sphere's
   resonant modes). If it is, build it as a labs view or a labs toy next to the plate (2D plate
   untouched), with a short About line on the physics and its source. If it isn't honest, write a
   short note in your handoff saying why, and build nothing for it. Never fake it.

You own: the Chladni parts of src/packs/studio.js and its helpers, the Splat mirror's depth hook in
src/packs/live.js, the new slider's files (via the engine PR), tests/lv8\*.spec.mjs, and your
handoff file. Their lines in the shared lists.

How this lane runs: exactly as docs/handoff/ScienceR3.md, "How this lane runs", says (read it;
replace the prefix and lane record with yours). The plate and the mirror are toys the public sees,
so the Operator merges them after a full test run (the Integrators run it) and the owner's "good"
marks on your cards; a 3D view, if any, stays in labs. Finish every working turn with "READY:",
"WORKING:" or "BLOCKED:"; Splashery has no CI to wait for; for a long job, schedule a check-in with
send_later instead of going idle. Clips at phone size go on Effect review page 2
(https://claude.ai/artifact/BSayVkzQ2FKESesrkrSUMK) as docs/OPERATING.md, "Steps for a lane", says
(no republish), ids lv8-…. Sound changes, if any, go in tools/sound-review.json, not as cards.
Before READY, re-read CLAUDE.md's "Effect quality rules" and check each clip against them at phone
size. Aim for a first READY within about six hours, then polish rounds on the owner's marks. Your
Operator is session_012GmKRUMZLir2nb27Bo8Cu2.

## State

October 7, 2026, 06:30 UTC (Opus 5.5): first round READY. The specs of the files I touch and the
toys the slider reaches pass (92 + 61, none failed); details in #384.

Cards on Effect review page 2 (lane record `LiveR8`): `lv8-chladni-plate` (before and after, side by
side, the camera sweeping down to the side), `lv8-depth-slider` (a still of the mirror with the
slider), `lv8-cell-cube`, `lv8-cell-cube-122`, `lv8-cell-flask-shells`, `lv8-cell-flask-cones`.

1. **The plate, sharper** (`src/packs/studio.js`). Where the grain was: the plate's top was already
   smooth at phone size; the grain was in the stand (its base and post were sampled at random over a
   cylinder, a fuzz of specks from the side), and in the rim (its discs, centered 3 mm from the
   edge, read 2.5 sizes across, so they spilled a soft fringe 16 mm past the edge and a spike at
   each corner). Now: the stand in fine discs in rows (`column()`), the rim's discs smaller and set
   inside the edges with a column at each corner, a finer top (a fifth of the budget, was 0.16 less
   the rim), and each sand grain a little smaller and fully opaque. How it works and looks from
   above is unchanged.
2. **The depth slider**: Engine PR #383 (`claude/lane-live-r8-engine`): a slider option marked
   `stage: true` also shows as a small vertical slider over the stage's right edge, × hides it, a
   "Depth" button brings it back, remembered on the device. Photo to 3D and Moving photo to 3D opt
   in there; the Splat mirror opts in on this lane's PR once #383 merges.
3. **The 3D look: honest, built** as a labs toy, "Sound in a box" (`chladni-cell`,
   `src/packs/chladni-3d.js`). See Notes. The beads are dyed amber (labs often use colored or
   fluorescent beads): white ones vanished on the light stage.

## Notes

- Why the 3D version is honest physics: small particles in a liquid under an ultrasonic standing
  wave move under the acoustic radiation force, F = −∇U, with U the Gor'kov potential (Gor'kov 1962;
  H. Bruus, "Acoustofluidics 7: The acoustic radiation force on small particles", Lab Chip 12, 1014,
  2012, doi:10.1039/C2LC21068A). This is acoustophoresis, used in labs to sort cells and beads. For
  a standing mode p = P φ cos ωt, U ∝ f1 φ² − (3/2) f2 |∇φ|²/k²; for polystyrene in water f1 ≈ 0.44
  and f2 ≈ 0.034 (from the compressibilities and densities), so the beads gather where φ = 0: the
  pressure-nodal surfaces. Beads that small move at a speed in step with the force (Stokes drag), so
  each slides down U; they sink only micrometers a second, so gravity is left out (said in About).
- The cell's modes are the textbook ones: a rigid-walled cube (cosines, f = c/2L √(l²+m²+n²)) and a
  rigid round flask (j_l(kr) P_l(cos θ), k from the zeros of j_l′: 3.3421, 7.2899 for l = 2, 7.7253
  for l = 0). "Mixed" cube modes are sums of the degenerate permutations, as the plate's (n, m) and
  (m, n) mix. A 1 cm cell of water rings at about 100 to 370 kHz; the toy plays each mode eight
  octaves down (said in About).
- What the toy does not claim: the beads' speed is scaled so a figure forms in a few seconds (a real
  cell takes seconds to tens of seconds, depending on the power); the cell's glass walls are not
  drawn, only their edges, so the beads stay in view; acoustic streaming (which moves beads smaller
  than about 2 µm) is left out, as it is for beads of about 10 µm.
- Tools: `tools/lv8-shot.mjs` (stills at phone size, any camera, crops).

## Known issues

- None yet.

## For the Operator

- PRs: Engine #383 (merge first), lane #384 (has #383 merged in). Labs: Sound in a box. Public once
  out of labs: the plate's sharpening and the mirror's slider wait on the owner's marks.
- Engine PR #383 changes `src/packs/photo-3d.js` and `src/packs/moving-photo.js` by one field each
  (`stage: true` on their depth option); those files belong to other lanes.
