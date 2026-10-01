# Lane Video 3D: your video, rebuilt as splats (prefix `v3d`)

## Brief

You are a Splashery worker session, started by the Operator (the coordinating session). Repo:
ryanjosephkamp/splashery. Your lane: Video to 3D, "A one-week spike: your video, rebuilt as splats"
(prefix `v3d`). Branch: claude/lane-video-3d. PR title: "Phase Video 3D: the video-to-3D spike".
Handoff file: docs/handoff/Video3D.md.

## Brief (written by the Operator on September 30, 2026, from the owner's question and his answer that morning)

The owner asked, word for word: "videos are a bunch of image frames in a sequence with perhaps an
audio track in sync with the frames, right? So, if someone uploaded a video shot from, say, a drone
that's flying though a city or something, couldn't we use that footage to create a 4D video (3
spatial dimensions + time), kind of like our Photo to 3D toy, but maybe the user can move through it
or it does that automatically or something? Can you tell me if that's possible?"

The Operator's answer, which he approved (call 18): yes for scenes that stand still, the classic use
of Gaussian splats. A program works out where the camera was for each frame (structure from motion),
then fits splats until the scene looks right from each of those spots. Moving cars and people blur
or vanish. True 4D (things that move) needs a rented GPU and comes later, not in this lane. The
route for Splashery is **Splat.js** (MIT, https://github.com/arrival-space/splat.js): plain
JavaScript on WebGPU that picks sharp frames, finds features and solves the camera path in the page,
trains splats in the tab and exports a PLY, with nothing uploaded. The owner approved vendoring it
like PDF.js: in `vendor/`, behind the labs switch, loaded only when someone opens a video in this
toy.

This lane is a **spike**: one week at most, ending in a report and a decision. Don't polish a toy
before the report. In order:

1. **Check and vendor.** Read Splat.js's license on its live repo page, pin a release or commit, and
   vendor it in `vendor/splatjs/` with its LICENSE, its version and where it came from (LICENSES.md,
   CREDITS.md if it ships assets). Note its size and what it needs (WebGPU, WebCodecs, workers,
   SharedArrayBuffer or cross-origin isolation: GitHub Pages can't set COOP/COEP headers, so if it
   needs them, say so at once in your message, and look for a fallback). Import it only through a
   small wrapper of your own (`src/video3d/`), loaded with a dynamic `import()` when a video is
   opened.
2. **A labs prototype** on the Studio shelf, "Video to 3D": open a video from the Toy tab (files
   stay on the device), choose a stretch of it (start and length; long drone clips are trimmed to a
   few frames a second), watch the progress (frames picked, camera path, training), then see the
   result as splats in the normal stage: turn, zoom, and a **Replay flight** button that flies the
   video's own camera path with its sound. The result converts from Splat.js's PLY into the kit's
   format (read how Studio Models and the scan loaders get splats in; reuse, don't rebuild) and can
   be saved as a PLY to the device. Phones get a lighter setting (fewer frames, fewer splats, lower
   resolution) chosen by the device tier.
3. **Measure.** Three test videos under CC0, CC BY or public domain (checked on their live source
   pages, credited): a walk around one object, a street, and a drone flight. Wikimedia Commons and
   the Internet Archive have some; Pexels, Pixabay and similar custom licenses are not allowed. The
   container has no GPU: Chromium's WebGPU may run on SwiftShader (`--enable-unsafe-webgpu`,
   `--enable-unsafe-swiftshader`), slowly. Use it to prove the pipeline end to end on a tiny clip
   and to make your clips, and put a timing readout on the page (each stage's seconds, frames used,
   splats, the device's WebGPU adapter) so the owner can run the real test on his computer and phone
   and send the numbers; the Operator relays them. Say plainly what you measured and where.
4. **Report**, in docs/lab/VIDEO3D.md: what works, times and sizes per video and device, what fails
   (moving things, low texture, water, night), what it costs a phone (memory, heat, time), and a
   recommendation: become a toy (and what it needs), stay a labs experiment, or stop. Add the **Mac
   route** for showcase scenes, as step-by-step instructions the owner can follow on his Apple
   silicon Mac: COLMAP 4.2 (BSD) for the camera path, msplat (Apache 2.0, Apple's GPU) or Brush
   (Apache 2.0) to train, then PlayCanvas's converter to our format, with each tool's license
   checked on its live page. Off limits under our rules (don't use or suggest them): MASt3R and
   DUSt3R (CC BY-NC-SA), VGGT (its own license), Depth Anything 3's splat head and most "instant"
   feed-forward splat models (non-commercial weights), and OpenSplat as a shipped part (AGPL; a
   build-only tool is acceptable only if the owner agrees).

Nothing loads until this toy opens a video: keep the "embed transfer ≤ 30 MB" test green, and check
that Splat.js isn't fetched on any other page.

Cards (each labeled "built by Opus 5.5", in the lane record `Video3D` on the Effect review page; ask
the Operator in your message if the record is missing):

- `v3d-object`: the walk-around video's result, turning (390×844).
- `v3d-street`: the street, with Replay flight (390×844).
- `v3d-drone`: the drone clip, flying its path, then roaming off it (1440×900), if the pipeline
  manages it; otherwise a card that shows where it fails.
- `v3d-progress`: opening a video and the progress stages (390×844).

Tests in tests/v3d.spec.mjs: Splat.js loads only on this toy; the PLY reader turns a tiny known PLY
into the right splat count, positions and colors; the stretch and frame-rate choice picks the right
frames; the page says clearly when WebGPU is missing (no crash); screenshots at 390×844 and
1440×900.

## You own

`vendor/splatjs/` (new), `src/video3d/` (new), your toy's recipe in a new pack file
`src/packs/video3d.js`, `tools/v3d-*.mjs`, `tests/v3d.spec.mjs`, your `v3d-*` screenshots,
docs/lab/VIDEO3D.md, docs/handoff/Video3D.md, your toy's entries in the shared lists, and
LICENSES.md and CREDITS.md lines for what you add. If you need an engine change (a loader hook, a
way to add splats after build), put it in a small, additive "Engine: …" PR first and tell me.

Lanes UI r2, Books r4, Fluids, Worlds, Science, Fix4, Sound A and B and the Integrators may run at
the same time; leave their files alone. The laptop is locked.

HOW THIS LANE RUNS

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
  "## State

Model: Opus 5.5 (the lane's assigned model), default effort, the whole lane.

- PRs: #137 "Engine: kit clouds take a trained splat's own sizes and rotation" (merge first) and
  #133 "Phase Video 3D: the video-to-3D spike" (draft).
- Splat.js vendored in `vendor/splatjs/` (MIT, commit 88efe9a, 20 modules, 544 KB; its own video
  reader, which needs Mediabunny under MPL-2.0, is left out). It needs WebGPU and nothing else: no
  SharedArrayBuffer, no cross-origin isolation, so GitHub Pages serves it as is.
- `src/video3d/`: frames (the stretch, the frame rate and the sharpest frame of each window),
  extract (the frames through a `<video>` element), run (the pipeline, timed per stage), ply (the
  trained PLY through `src/loaders.js`'s reader), scene (the toy's frame: up, the view, the middle
  where an orbit's views meet), flight (Replay flight and the opening view, on the stage's own orbit
  camera), panel (the progress card and the timing readout), samples.
- `src/packs/video3d.js`: the labs toy "Video to 3D" on the Studio shelf, with three samples
  (Liberty orbit, Edinburgh street, Nicosia drone) trained here by `tools/v3d-sample.mjs`.
- Report: `docs/lab/VIDEO3D.md` (measurements, what fails, phones, recommendation, the Mac route).
- Cards (Effect review page 1, then page 2 from 20:26 UTC on September 30): `v3d-object` → r2 → r3 →
  `v3d-object-r4` (page 2, good); `v3d-street` → r2 → r3 → `v3d-street-r4` (page 2);
  `v3d-object-compare` and `v3d-street-compare` (the source video beside the splat flight, good);
  `v3d-drone` (where it fails, page 2, good); `v3d-progress` (page 2, good).
- r2: the far water, sky and skyline kept (pulled in onto a shell between radius 1 and 2, built as a
  `fit: false` cloud); floaters and smears pruned near the subject; the flight uses the video's own
  lens. r3: the Lab lane's `kernel: "sharp"`. r4: both samples retrained at 480 px for 2,006 steps
  (the statue from one shot, after the cut): edge sharpness +44% (statue) and more than double
  (street).

## Notes

- The container has no GPU. Chromium's WebGPU runs on SwiftShader here: Splat.js's synthetic set (12
  photos) solved in 32 s and trained 212 steps in 518 s. The samples were trained with small
  settings (360 px, 800 to 1,500 steps), one to one and a half hours each.
- The Commons API rate-limits this container (HTTP 429); the file pages and upload.wikimedia.org
  work. Clips were trimmed with a pip-installed ffmpeg (imageio-ffmpeg) in the scratchpad only.
- The drone clip, cropped to remove a credit line, was 2.02:1, and Splat.js takes anything within 5%
  of 2:1 for a 360-degree panorama: the first run failed after 33 minutes and a second "solved" 144
  cube-face views. `panoSafeCrop` now trims such frames to 1.9:1. With that, the drone stretch fails
  honestly in a minute (too little parallax from a high, slow flight): the v3d-drone card.
- The container restarted once (October 1, about 23:00 UTC on September 30); the street retrain was
  started again. The first full suite (557 passed, 8 failed) ran while samples trained on the same
  CPU; the lane's own three failures were fixed, and a second full run went on a quiet CPU.
- Replay flight drives `player.camera` (target, yaw, pitch, roll, distance) from the recipe's drive
  through `k.data.flight`; the toy opens at the video's first view until the visitor turns or zooms
  (the app puts its own camera back after a load).

## Known issues

- The Toy tab refuses files over 40 MB (ui.js, not this lane's): long drone clips must be trimmed
  first.
- A stretch length must be one of the choices (5, 10, 20, 40 s).
- Turning past the filmed arc shows soft splats and floaters (short training on a software GPU).

## For the Operator

- Merge #137 (engine) first, then #133 is labs-only.
- The owner can run the real test on his computer and phone with `?labs=1`, Studio, Video to 3D, and
  send the card's readout.
