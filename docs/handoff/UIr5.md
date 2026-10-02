# Lane UI r5: site fixes from the October 2 review

## Brief

You are a Splashery worker session, started by the Operator (the coordinating session). Repo:
ryanjosephkamp/splashery. Your lane: UI r5, "Site fixes from the October 2 review" (prefix `ui5`).
Branches: `claude/lane-ui-r5-engine` (small, additive "Engine: …" PR for anything in player.js,
app.js, ui.js, exports.js or styles.css, merged first) and `claude/lane-ui-r5` (toy-level changes).
PR titles: "Engine: a Record button, bigger models, and the gallery button" and "Phase UI r5:
rotation defaults and the piano bar". Handoff file: docs/handoff/UIr5.md.

### Brief (written by the Operator on October 2, 2026, from the owner's review of that day and his "start now")

The owner's review of October 2, word for word, is docs/reviews/2026-10-02-mega-review/review.md.
Read docs/handoff/UIr2.md, UIr3.md and UIr4.md first (the last UI rounds). Your items, his words in
quotes:

1. **The Gallery chip** sits in the category row ("gallery is not a category … if I scroll past it,
   then I can't just click a gallery button"). Move Gallery out of the category row to a button
   that's always reachable, for example with the top buttons (flag, full screen, reset, focus …).
   Leave the search where it is unless a better place is obvious; say what you chose and why.
2. **Rotation defaults**: the storybook with no rotation lock by default ("we don't need to have any
   default locks on that"); the umbrella with full rotation; the xylophone unlocked by default or a
   slightly higher default angle ("so that people can kind of change the angle a little bit"); the
   upright piano unlockable so you can look from above. Don't change other toys' defaults.
3. **The grand piano's song bar covers the piano on a phone** ("you can't see all of the piano
   without zooming out … I shouldn't have to"). The bar is the shared `#game-bar` (song-bar class),
   fixed above the dock on phones (styles.css:1765-1770, about the bottom 115 px of the stage), and
   the camera framing doesn't account for it. Make the toy's framing leave room for the bar whenever
   the bar shows (for every toy with a song bar, not just the grand piano), or move the bar; check
   all the pianos and the chess bar at 390×844.
4. **Model to splats takes big files** (his note: "I tried to find a GLB file, but … it was
   apparently too big"). Today the cap is 40 MB for all files together (`input.maxBytes || 40e6`,
   ui.js:1539-1541) plus 4,000,000 triangles (studio-models-core.js:51, 160), with no
   simplification. Raise the caps as far as phones and computers handle well (aim for files of a few
   hundred MB on a computer), read big files without copying them more than needed, and simplify
   very large meshes on the device before sampling (the toy already has vertex clustering for its
   wireframe, core :1571-1577; reuse our own code; a new library would need the owner's OK first).
   Show progress and a clear message if a file is still too big for the device.
5. **A Record button** (his idea, approved: "I'd like to have the ability to somehow record a video
   of, like, how I'm using this"). Record the stage while you play (drags, taps, the effect, the
   turning view) with the toy's sound, then save the video (MediaRecorder from the canvas's
   captureStream plus a MediaStreamAudioDestinationNode from the site's audio). MP4 where the
   browser supports it, otherwise WebM. Put it in the Share tab next to the existing exports, with a
   clear stop and a time limit (say 60 s). It must work on a phone (iOS Safari and Android Chrome)
   and a computer. The existing "save video" exports stay.

Clips for every item in your lane record "UIr5" on Effect review page 2, at 390×844 (and 1440×900
where the layout matters), "built by Opus 5.5". The gallery button and rotation defaults change what
the public sees, so those parts merge after the owner's good marks; the engine PR merges after the
full test run.

### You own

- The Gallery control, the song bar's layout and framing, the share/export code for Record
  (src/exports.js and the Share tab), the input size caps and mesh simplification in the model
  loader (src/ui.js and src/packs/studio-models\*.js for these parts only), and the rotation
  defaults of the four named toys (their entries in src/toys.js or their recipes).
- tests/ui5\*.spec.mjs, your `ui5-*` screenshots and docs/handoff/UIr5.md.

Lanes Sound C (it changes src/sound.js and the pause hooks), Fix7, Physics (it adds Hands-on
controls to the stage: coordinate placement with it through the Operator), Sharpness A, Photoreal
(research), Fluids, Video 3D, Live input, Science and the Integrators run at the same time; leave
their files alone and keep your engine changes small and additive. The laptop is locked.

### How this lane runs

- The Operator session runs the lanes. The owner, Ryan, talks only to the Operator; he reviews clips
  and marks them. Don't ask him anything or wait for him. Put questions and blockers in your final
  message, and the Operator answers or relays them. Messages that arrive in this session "From the
  Operator" come from the coordinator on the owner's behalf.
- Model: Opus 5.5 only, at the default effort (the owner's assignment of September 29, 2026: Opus
  5.5 builds the engine, the toys, sounds and fidelity; Sonnet 5.5 builds the Worlds content, the
  Studio converters, the docs and the Integrator). Any helper you start uses the same model. Use at
  most one helper at a time.
- Merging (the owner's rules of September 29, 2026): the Operator merges Ops PRs, anything behind
  the labs switch, and additive engine PRs once the full test run passes. Changes to toys the public
  already sees wait for the owner's "good" marks. Never merge anything yourself.
- Language: every new public-facing text is in American English (color, center, gray, math, license,
  toward, -ize endings, dates like "September 29, 2026"). Leave code identifiers, file names and
  anything stored in links as they are.
- Read first: CLAUDE.md (the ground rules and "Effect quality rules" are binding),
  docs/OPERATING.md, docs/PACKS.md, docs/WORKSTREAMS.md and docs/handoff/history.md (lessons from
  earlier lanes).
- Your handoff file: create it. Start it with this brief, word for word, under "## Brief", then keep
  "## State", "## Notes", "## Known issues" and "## For the Operator" current. Note your model at
  the top of "## State" (the blog post compares the two models).
- Shared lists: edit only your own entries in src/toys.js, src/toy-sounds.js, src/toy-help.js (a
  how-to line and an About text per toy, following docs/handoff/Help.md), tools/toy-plan.json,
  CREDITS.md and tools/assets.json. Regenerate docs/TOY-PLAN.md with `node tools/toy-plan.mjs`;
  never merge it by hand.
- Never edit tests/taps.spec.mjs. Your own tests go in tests/<prefix>.spec.mjs. If a finished lane's
  test breaks because of a count or a list your work changes, don't edit it: say which test and why
  in your message, and the Operator fixes it.
- Assets: CC0, CC BY or public domain, checked on the live source page and credited (CREDITS.md,
  tools/assets.json and the toy's in-app credit). Since the owner's call of October 2, 2026, CC
  BY-SA is allowed too, per asset, with its notice beside it; anything made from a BY-SA asset (a
  splat converted from it) stays BY-SA (the Operator's Ops PR updates CLAUDE.md; anatomy BY-SA
  sources still go to the owner first). Never NC, and never unlicensed or "personal use" files in
  the repository. No logos, brand names or insignia.
- Review: post clips and cards to the Effect review page,
  https://claude.ai/artifact/BSayVkzQ2FKESesrkrSUMK (Effect review page 2), as OPERATING.md's "Steps
  for a lane" says. Judge every effect as motion at phone size against the effect quality rules
  before you post it. The Operator has made your lane's record. Don't republish the page, and never
  write to "verdicts".
- Push your work in progress to your branch about every hour, so it isn't only in your container,
  and open your draft PR early. Many lanes run at once now, so main moves often: merge it into your
  branch before each push (never rebase a pushed branch) and keep both sides of any conflict.
- Before every push, follow "Before every push" in CLAUDE.md: the full Playwright suite
  (SPLASHERY_CHROMIUM=/opt/pw-browsers/chromium npx playwright test), prettier,
  `node tools/us-english.mjs --diff`, `node tools/check-packs.mjs <pack>` for new or changed toys, a
  contact sheet and thumbnails, and your own screenshots at 390×844 and 1440×900. Then put back the
  standard screenshots (`node tools/upkeep.mjs --restore-shots`) and any other lane's screenshots
  your branch didn't change.
- PR: one draft PR per branch against main with the five sections (Summary, Verification,
  Deviations, Known issues, What was cut), and the model that built it in the Summary. When main
  moves, merge it into your branch.
- After you post your cards, check the owner's marks (the "verdicts" collection, ids starting with
  your prefix) about once an hour with a scheduled check-in (send_later). Fix every "fix" in the
  same PR, post the new clip as a "-r2" card, and set replacedBy on the old one. Stop the check-ins
  once your PRs are merged or closed.
- Finish every working turn with a short final message that starts with "READY:" (PR link, card ids,
  test results, anything for the Operator), "WORKING:" (what's left), or "BLOCKED:" (exactly what
  you need).

## State

- Model: Opus 5.5 (claude-opus-5-5), default effort.
- October 2, 2026: all five items built.
  - Engine (`claude/lane-ui-r5-engine`): the gallery button in the top row (and the G key); the
    stage ends above the song or game bar on a phone (`body.bar-up`, `--bar-h`); a toy entry's
    `tilt: "free"`; Record (src/exports.js `startRecording`, the Share tab's Record row and the pill
    on the stage); a recipe input's own cap (`input.maxBytes`, `input.tooBig`) and a progress
    callback (input.read's fifth argument). `tests/ui5-engine.spec.mjs` (7 tests).
  - Toys (`claude/lane-ui-r5`, on the engine): `tilt: "free"` on the storybook, umbrella, xylophone
    (pitch 0.5 → 0.62) and upright piano; Model to splats with device caps, progress, fewer copies
    and on-device simplification (`simplifyMesh` in studio-models-core.js).
    `tools/ui5-big-model.mjs` (a big textured GLB for testing). `tests/ui5.spec.mjs` (3 tests).

- October 2, 2026, evening: #177 (engine) merged. The owner's marks: "good" on ui5-gallery,
  ui5-gallery-desktop-r2, ui5-songbar, ui5-rotation, ui5-record and ui5-record-output; "fix" with no
  note on ui5-model-big. Posted ui5-model-big-r2 (and -r2-desktop): a real CC0 scan (Poly Haven's
  Boulder 01, glTF + .bin + 8K textures, 151 MB) opened on a phone and a computer at the high
  profile (the first clip showed a test sphere at the lowest profile). The scan is not in the
  repository; `UI5_MODEL_DIR=<folder> node tools/ui5-clip.mjs <out> model-real-390` records it.

## Notes

- **Gallery**: a round grid button in the top row, left of the flag (G on a keyboard). On a computer
  it opens the gallery page (Escape, G or a pick closes it); on a phone it opens the full grid and a
  second press puts the toy row back. Eight round buttons fit beside "Splashery" at 390 px (32 px
  buttons, 35 px apart, the name at 16 px); on screens narrower than 389 px the name hides (the
  toy's name still shows on the line below). The search stays where it is: on a phone it is the
  first chip (the magnifier) and on a computer the full-width field at the top of the panel, both
  already one tap away, so moving it would only take room from the top row.
- **Song bar**: rather than moving the bar, the stage (and so the canvas and the camera's framing)
  ends 8 px above the bar whenever it shows on a phone. Every bar toy (the four pianos, the chess
  set) gets it; nothing changes on a computer or while the sheet is open.
- **Rotation**: the four toys keep the turntable off (their shelves' default) but start with the
  tilt free. The xylophone got both (free tilt and a slightly higher view).
- **Big models**: caps by device (`modelLimits()` in studio-models.js): a computer 600 MB of files
  and 40 million triangles (300 MB and 15 million with 4 GB of memory or less, where Chrome reports
  it); a phone 250 MB and 12 million (120 MB and 6 million at 3 GB or less). A mesh over 1.25 times
  the target is simplified first: vertex clustering on a grid sized from the surface area (one or
  two passes), with each vertex's color baked first from the material, the texture at its own UV and
  its vertex color, so UV seams never smear; duplicate triangles are dropped with a hash. Target 1.2
  million triangles on a computer (texture detail for scans) and 400,000 on a phone (under the
  450,000 where crisp-edge analysis runs). In Node a 440 MB, 20-million-triangle GLB reads in about
  2 s and simplifies in about 5 s; the stripe colors of the test model match the unsimplified model
  to within 1/255.
- Fewer copies: a single-mesh glTF keeps its own position, normal, UV and index arrays (no merge
  copy), positions and normals are transformed in place, tight index lists are read with one typed
  copy, and prepareModel's per-triangle lists are typed arrays (a 6-million-triangle model no longer
  builds JS arrays of 18 million numbers).
- **Record**: `canvas.captureStream(0)` with a frame handed over after each drawn frame (the stage's
  `frameend`) and at least four a second, so a still toy still records; the sound comes from
  `sound.master` through a copy of the site's limiter into a MediaStreamAudioDestinationNode (the
  audio context is made in the tap, so sound switched on mid-take is in the video). MP4 only with
  H.264 (phones' photo libraries take it), else WebM. 60 s at most, 8 Mb/s, at most 1920 px on the
  long side, no drop in resolution while dragging. The Share tab starts it and closes the sheet on a
  phone; a pill on the stage shows the time and Stop, then Save video (and Share, the phone's share
  sheet, where the browser can share files) and a close button. It stays visible in focus mode, so a
  take can be only the toy.

## Known issues

- Record captures the canvas only (the stage), not the page's HTML (the song bar, the help line).
- If the stage changes size mid-take (the sheet opened, the phone turned), the video's size changes
  too; Chrome copes, other browsers may scale.
- Not tested on a real iPhone or Android phone here (headless Chromium only, which records WebM;
  real Chrome and Safari pick MP4).

## For the Operator

- Tests (October 2, 2026, at c34acff): the full suite was stopped twice by container restarts (130
  passed, none failed, before that). The affected files (ui2, ui3, ui4, ui5, vw, help, stm, pno, fb,
  chs, smoke, taps): 213 of 215 passed; `help.spec.mjs:261` (1440x900) and `stm.spec.mjs:366` failed
  only with three workers and pass alone. The rest of the suite (bk to wdr3, apart from those) is
  for the Integrator's combined run.
- Standard screenshots with the top row (ui2, ui3, vw, help) change: the gallery button shows there
  now. Restored on the branch, not committed.

- Engine PR touches index.html (the gallery button moved, the Record row and pill), src/app.js
  (`startRecord` and friends, the G key, the `tilt: "free"` check), src/ui.js, src/exports.js and
  styles.css (a UI r5 block at the end). No other lane's files.
- tests/ui2.spec.mjs clicks `#gallery-open`; the id is kept, so it still passes.
