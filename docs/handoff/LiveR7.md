# Lane Live r7: a clean splat mirror, and a landscape that grows with the song (prefix `lv7`)

## Brief

You are a Splashery worker session, started by the Operator (the coordinating session). Repo:
ryanjosephkamp/splashery. Your lane: Live r7 (id `LiveR7`, prefix `lv7`). Branch:
`claude/lane-live-r7` (and `claude/lane-live-r7-engine` if needed). PR title: "Phase Live r7: a
clean splat mirror, and a landscape that grows with the song". Handoff file: docs/handoff/LiveR7.md.
Model: Opus 5.5.

### Brief (written by the Operator on October 4, 2026, from the owner's push notes that evening)

The owner's notes are in docs/reviews/2026-10-04-push-alignment/notes.md ("All right, so I'm going
to go through the items in the studio"). Read docs/handoff/LiveInput.md first (rounds r1 to r4; r5
and r6 are described in the code comments and HANDOFF.md, and r6 merged as #250).

1. **The Splat mirror, polished** (`splat-mirror`, `src/packs/live.js`). His words: "it still seems
   a little bit too grainy, especially with the hologram view. It's like stuff is kind of put on top
   of the face. We need to polish this out, and this is something that we can really focus on during
   the push because it's another thing that kind of makes our product unique."
   - Find what makes it grainy (splat size and count per pixel, the depth's noise from frame to
     frame, edge splats that straddle the face and the background) and fix it: a face that reads
     cleanly at phone size, steady from frame to frame, with clean edges.
   - The hologram view must not cover the face: its lines, glow or noise go behind or around the
     person, or become subtle enough that the face stays clear.
   - Show before and after side by side as clips at phone size (use a recorded test video for the
     clips, never a real person's face from the web; a CC0 or CC BY talking-head video, or a
     generated mannequin, is fine).
2. **The Song landscape grows as the song plays** (`song-landscape`, `src/packs/studio.js`). Today a
   song of 30 seconds or less (the built-in 20-second sample included) is built whole when the toy
   opens (`SHORT`, studio.js:476), so the landscape is already there before anything plays. He wants
   it drawn as the song plays: the toy opens with an empty plain, and the land rises in step with
   the music, in the Live view, for every song and look. The Whole song view stays as an option.
3. **The Chladni plate's bow** (`chladni-plate`, studio.js 239-272). He hoped "the bow appearing
   every time a tone changes" is fixed. Main has the fix (Live input r4, commit a3824307; tests in
   `tests/live4.spec.mjs` 92-138 and 196-201): the bow shows only while a tap moves the sand. Check
   it on a phone-size clip with tone changes from a tap, the microphone (a recorded tone) and an
   audio file, and post that clip so he can confirm. Fix anything you find.

#### Deliverables

- Tests in `tests/lv7*.spec.mjs`: the mirror's frame-to-frame stability (a measure you define,
  better than main's), nothing drawn over the face region in the hologram view, the landscape empty
  at open and growing with playback, and the bow rule.
- Clips at phone size: the mirror before and after (plain and hologram), the landscape growing from
  silence, the Chladni plate through several tone changes.
- How-to and About texts updated for what changes.

#### You own

The Splat mirror in `src/packs/live.js`, the Song landscape and Chladni plate parts of
`src/packs/studio.js` and `src/packs/song-looks.js`, `tests/lv7*.spec.mjs`, `tools/lv7-*.mjs`, those
toys' lines in the shared lists, and this file. Lane Studio media changes the Moving photo to 3D's
samples in `src/packs/moving-photo.js` beside you; don't touch that file.

#### How this lane runs

- The Operator session runs the lanes. The owner, Ryan, talks only to the Operator. Don't ask him
  anything or wait for him. Put questions and blockers in your final message ("READY:", "WORKING:"
  or "BLOCKED:"), and the Operator answers or relays them. Messages that arrive "From the Operator"
  come from the coordinator on the owner's behalf.
- Model: Opus 5.5 only, at the default effort. Any helper you start uses the same model. At most one
  helper at a time.
- This is the October push (October 5 to 7, 2026): about ten lanes build at once. Edit only the
  files you own and your own toys' lines in the shared lists (`src/toys.js`, `src/toy-sounds.js`,
  `src/toy-help.js`, `tools/toy-plan.json`, `tools/assets.json`, `CREDITS.md`). Merge main into your
  branch whenever it moves (never rebase a pushed branch). Regenerate docs/TOY-PLAN.md with
  `node tools/toy-plan.mjs`; never merge it by hand.
- Engine changes: small, additive and tested, on `<your branch>-engine` with a draft PR titled
  "Engine: …", merged first. Toys that don't use them behave exactly as before.
- Merging: The engine PR merges after a full test run; the toys are labs, so the Operator merges
  them after the full run too, and the owner decides when they go public. Never merge anything
  yourself.
- Everything new is behind the labs switch (`labs: true`) unless this brief says otherwise. Old
  `#s=` links and saved scenes (schema v2 and v3) keep loading.
- Licenses (CLAUDE.md, "Ground rules"): read each asset's or dataset's license on its live source
  page; record it in CREDITS.md, `tools/assets.json` (or `tools/models.json`) and the toy's in-app
  credit; `"nc": true` on NC assets; never ND, unlicensed, personal-use or paid. A new open-source
  library is fine when it's needed (the owner's rule of October 4, 2026): vendor it in `vendor/`,
  load it only when its toy opens, list it in LICENSES.md, and name it in your PR; a copyleft
  license (GPL, AGPL), a library that calls a server, or one over 2 MB goes to the Operator first.
- Effects follow CLAUDE.md, "Effect quality rules": real motion of solid pieces, judged as clips at
  phone size.
- Tests: `tests/lv7*.spec.mjs`; never edit `tests/taps.spec.mjs`. Before each push run your own
  specs and the specs of the files you touch (say which in the PR); the Integrators run the full
  suite before a merge. Prettier, `node tools/us-english.mjs --diff`, and for toys
  `node tools/check-packs.mjs <pack>`, a contact sheet and thumbnails (CLAUDE.md, "Before every
  push"). Screenshots `lv7-<name>-390x844.png` and `…-1440x900.png`, then
  `node tools/upkeep.mjs --restore-shots`.
- Clips: post every new or changed effect on Effect review page 2
  (https://claude.ai/artifact/BSayVkzQ2FKESesrkrSUMK) as docs/OPERATING.md, "Steps for a lane", says
  (lane record `LiveR7`), after watching each one. After posting, check the owner's marks about once
  an hour with a scheduled check-in (send_later); stop once your PR is merged or closed.
- Language: American English for every new text (color, center, gray, license, toward, -ize endings,
  dates like "October 5, 2026").
- Your handoff file: start it with this brief, word for word, under "## Brief", then keep "##
  State", "## Notes", "## Known issues" and "## For the Operator" current.
- PR: one draft PR against main (five sections: Summary, Verification, Deviations, Known issues,
  What was cut), opened early and pushed after each finished item. Finish every working turn with a
  final message that starts "READY:", "WORKING:" or "BLOCKED:".

## State

October 5, 2026, 17:00 UTC (Opus 5.5): **the polish round** (the Operator's brief of 15:40 UTC: the
owner's "the toys could still be sharper"), on `claude/lane-live-r7-polish` (from the lane's head;
#263 and #284 are frozen for the Integrator's run). No PR yet: it opens as "Phase Live r7 polish: …"
once #263 merges and main is merged in. No engine change was needed. Hourly check-ins stopped.

- **Chladni plate** (`lv7-chladni-plate-r3`): the labs' sharp kernel, so each grain is a crisp speck
  (up to 14,000 grains was tried and taken back: on a loaded machine the sand settled too slowly for
  `live4`'s audio test). The plate's rim and sides are fine strips of small discs, so its edge is
  straight and clean (was a box whose edge showed as beads). Its top is a denser sheet that stops
  short of the rim (the sharp kernel showed a faint dotted texture). The bow is drawn like a real
  one: a round stick with a little camber, a ribbon of hair, a frog and a tip.
- **Song landscape** (`lv7-song-landscape-r2`): the sharp kernel on half as many splats again
  (density 1.5).
  - Live (the long-song path) has three splats a cell, the top and two down the wall to near the
    floor. Whole song (the sample's path) has up to four layers, the lowest near the floor. The dark
    floor no longer shows as specks between tall peaks.
  - The waveform is a smooth envelope, so its lines are clean curves (they were scattered beads).
  - The floor's edge, the marker and its glow are clean straight lines (they were soft,
    round-cornered or dotted).
- **Splat mirror** (`lv7-splat-mirror-r3`, `lv7-splat-mirror-hologram-r3`): sharper colors.
  - The unsharp mask is 1.2 (was 0.5), its push held to 28 levels so a strong edge gets no halo,
    with coring so the camera's leftover noise isn't sharpened. The splats are 1.0 cells across (was
    1.2).
  - Measured on the mannequin camera, with `sharpness` new in `tools/lv7-mirror-measure.mjs` (how
    much of the camera's own edges reach the drawn face; 1 = as sharp as the camera): 0.51 to 0.52
    on the r7 branch, 0.58 to 0.59 now.
  - Steadiness is the same within this container's run-to-run spread. Measured back to back in both
    orders: face on 0.8 to 1.2 on both branches; turned 2.7 to 3.3 here against 2.8 to 3.1 on r7.
    The lane's mirror tests pass (turned 1.63, hologram over the face 8.3).
- Photo to 3D's live view shares the mirror's picture (`src/live/relief.js`), so it gets the sharper
  colors and the 1.0 splats too.
- Tests: `tests/lv7.spec.mjs` checks the sharpness (over 0.57), the two toys' sharp kernel and
  density, and the waveform's envelope. The landscape, Chladni and mirror tests pass on this branch.
- **Tried and dropped for the mirror:**
  - The sharp kernel: sharpness 0.60, but turned jitter doubled (5.3).
  - A denser grid (383 by 287): sharpness 0.61, but the color noise doubled. A 640 by 480 camera has
    little more to give.
  - Sorting the picture at its depth (the camera picture as 3D-offset relief splats and a resort a
    few times a second): face-on jitter rose from 1.1 to 5.1, as the order of nearly equal neighbors
    kept changing.

October 5, 2026, 06:10 UTC (Opus 5.5): **all marks good.** `lv7-splat-mirror-r2`,
`lv7-splat-mirror-hologram-r2` and `lv7-chladni-plate-r2` are marked good, after
`lv7-song-landscape` and `lv7-chladni-plate` earlier. Main (through #292) is merged into both
branches. READY for the Integrator's full run; the engine PR #284 merges first, then #263. The
hourly check-ins merge main as it moves (last: through #291, 14:36 UTC); both PRs are clean.

October 5, 2026, 04:50 UTC (Opus 5.5): the owner's marks: `lv7-song-landscape` and
`lv7-chladni-plate` good; both mirror cards "fix" ("keep making it sharper ... a little bit more
seamless"). Round 2 is posted as `lv7-splat-mirror-r2` and `lv7-splat-mirror-hologram-r2` (the old
cards marked replaced):

- Tighter picture splats (1.2 cells across, was 1.45) and a light unsharp mask on the colors.
- A frame of clean flat sheets.
- The background layer's guard is 4 of its cells (the hair and ear edge showed as a ghost).
- A face beside its outline keeps its own depth (a REACH of 7 cuts only the soft ramp).
- The per-frame outline follow from round 1 is gone: it left patches on a moving face.

READY (October 5, 2026, 04:15 UTC; Opus 5.5). Items 1 to 3 are posted (four `lv7-*` cards on page
2). Then the Operator's routine of 02:24 UTC came in: the owner tested the Chladni plate with his
own long song and the microphone, and the bow and the restart cycle were still there. That is item
4, now built:

4. **Chladni plate, live sand** (`src/packs/chladni-sand.js`, new; the plate in
   `src/packs/studio.js`): every grain moves on every frame, the plate's modes driven as strongly as
   the sound drives them. A new note sets the sand off at once, from where it lies, with no new
   plate. Silence leaves the sand put. The bow shows only for a tap with no audio open. It also
   fades in by a morph channel, so it can't show on a rebuild's first frames, the likely way it came
   back for the owner. The engine PR #284 (`claude/lane-live-r7-engine`, "Engine: relief splats sort
   where their screen moves them") is merged into this branch: without it the grains in the near
   half of the plate drew under it. Tests: `tests/lv7.spec.mjs` ("the Chladni plate": tap, audio
   file, microphone) and `tests/lv7-engine.spec.mjs`. The Chladni checks in `tests/live3.spec.mjs`
   and `tests/live4.spec.mjs` now expect the sand to move on the same plate, not a new plate per
   note. Speed: on the low profile at 4× CPU throttle, 7,200 grains take 2.8 ms a frame to move and
   0.4 ms to draw. The mid profile is capped at 10,000 grains.

Earlier items: the Song landscape grows as the song plays; the Splat mirror is cleaner and steadier,
with a clean hologram; the Chladni bow check (superseded by item 4).

The state before item 4, for the record:

READY (October 5, 2026, 03:00 UTC; Opus 5.5, default effort, no helpers). Draft PR #263, main merged
in (through #264). All three items are built, tested and posted on Effect review page 2:

- `lv7-splat-mirror`: before and after, plain look.
- `lv7-splat-mirror-hologram`: before and after, hologram look.
- `lv7-song-landscape`: the land growing from an empty plain.
- `lv7-chladni-plate`: taps and mode changes, the microphone, an audio file.

There is no `LiveR7` lane record on the page yet, so the cards show under the id. A send_later
check-in reads the owner's marks hourly.

1. **Song landscape**: Live opens on an empty plain. Each moment rises at the line at the front as
   it is heard and recedes behind it, for every song and look. The 20-second sample is now measured
   by the worker like a long song; the measured looks already grew from their gate. Whole song is
   unchanged. The plain stays put while the land slides over it, so the splats are sorted again as
   it slides (`out.resortPose`, every 0.02 units).
2. **Splat mirror**: see Notes.
3. **Chladni bow**: the bow shows only while a tap moves the sand. Clip and test cover tone (mode)
   changes from the Toy tab, the microphone and an audio file. Nothing needed fixing: the bug was
   already fixed on main (Live input r4).

Tests run on this branch: `lv7`, `live`, `live2`, `live3`, `live4`, `live5`, `live6`, `p3d`, `sng`,
`sts`. All pass (58 + 24 + the lv7 and live5 runs).

## Notes

- **The mannequin camera.** `tools/lv7-mannequin.mjs` renders a talking mannequin (a sphere-traced
  head, hair, neck and shirt before a room's wall, a camera's noise in every frame) into a Y4M for
  Chromium's fake camera; `--still` holds one pose, for measuring. No real face is used.
- **The measures** (`tools/lv7-mirror-measure.mjs`, still mannequin, 10 depth answers, mid profile,
  390 by 844 at 2x, the middle of the face), main → this branch:

  | Measure                                | Main  | Live r7 |
  | -------------------------------------- | ----- | ------- |
  | Color jitter (0..255)                  | 3.58  | 0.75    |
  | Height jitter (0..1)                   | 0.013 | 0.012   |
  | Shown jitter, face on (0..255)         | 1.41  | 0.78    |
  | Shown jitter, turned 0.35 rad          | 3.23  | 2.18    |
  | Hologram: added over the face (0..255) | 37.4  | 7.6     |
  | Hologram: shown jitter, face on        | 9.6   | 1.9     |

  The depth model's own guess wanders a little between answers on a still picture; per answer the
  face's depth moves 0.016 (median) on main and 0.005 here.

- **What made it grainy, and the fixes** (`src/live/relief.js`):
  - The camera's noise came through the colors: each frame shrank with the browser's default filter
    and only changes under 20 (of 765) were halved. Now the best filter, floats, and a share that
    rises smoothly with the change (a fifth within the noise, all of a clear move).
  - The depth's cut at edges (`snapEdges`) also cut a face's own relief into terraces (a nose and
    cheeks span more than 0.15 in nine cells): now only where two neighboring cells step by more
    than 0.06, and the surfaces are smoothed within themselves first (`smoothSurface`, a 5 by 5
    bilateral filter).
  - The cut now follows the outline in the picture: a cell at a jump goes with the side whose colors
    it has (the nearest color among each side's cells, `sideByColor`).
  - Between depth answers a moving person moves in the picture but not in depth, so their leading
    edge lies on the wall (a ghost of their outline from the side). A per-frame fix by each frame's
    colors (round 1) left patches on a moving face and was taken out in round 2; lone cells at an
    outline are still tidied (`edgeBand`, `tidyBand`).
  - The depth's range and each cell's depth ease more where they only wobble (a range change under
    5%, a depth change under 0.03), and as before where something really moves.
  - The background layer learns the wall two cells clear of the person (was one).
  - The hologram: the person (near, from the depth) is a clean cyan picture of themselves; the
    scanlines and a soft rim glow are only on the room behind (and its background layer, which the
    hologram now has too: turned, it showed a hole).
- Photo to 3D's live view uses the same `CameraDepth`, so it gets the steadier colors and depth too
  (not the hologram, which it doesn't have).

## Known issues

- **Chladni plate, what is simplified:** the classic square-plate model (cos·cos ± cos·cos, pitch
  growing with n² + m²), a quarter-thickness plate for voices. Each mode's resonance is 150 cents
  wide, broader than a real plate's, so a voice between modes still rings one. The sand isn't
  ballistic: a grain hops at random by the local swing and slides toward the still lines (the rule
  `settle()` always used). Modes ringing at once act on the sand through their time-averaged energy
  (each weighted by its strength squared). The hop height is drawn, not simulated. A grain's place
  reaches the GPU in steps of about 0.008 of a recipe unit (0.4% of the plate), dithered per grain.
  When the note changes, the new figure first has gaps where the old one had no sand nearby; a
  little shaking everywhere fills them in over a few seconds.

- A person who moves fast still leaves a little of their outline on the wall behind, seen from the
  side, until the next depth answer. The depth can't move with the picture where the person's colors
  are close to the wall's (skin and a beige wall). In this container a depth answer takes 0.3 to 0.5
  s, against about 0.1 s on a laptop, so the clips show more of it than a computer would.
- The depth model's own guess wanders a little on a still picture. Per answer, the face's depth
  moves about 0.005 (median) here, against 0.016 on main.
- The Song landscape's shelf thumbnail is kept as it was (the Whole song look). A thumbnail made now
  would show the empty plain Live opens on.
- `node tools/check-packs.mjs live` reports Moving photo to 3D's build at 2.5 s (over 1.5 s). That
  is not this lane's toy (Studio media and Live input own it), and this lane didn't change its
  build.

## For the Operator

- `src/live/relief.js` is the Live input lane's file (finished); the mirror's fixes are there. Its
  `CameraDepth` is shared with Photo to 3D's live view (Studio media changes that toy's samples, not
  this file).
- Tests of other lanes changed: `tests/sng.spec.mjs` (Song live) now follows the growing land (the
  look part's offset, not the body's). `tests/sts.spec.mjs` (Studio Sound) opens its beep in Whole
  song, which still builds at once and reports its `top`. The Node-only tests in sng.spec still
  build the old scrolling Live, which remains for a build without a worker.
- The cards are under lane id `LiveR7`; the page has no record for it yet.
