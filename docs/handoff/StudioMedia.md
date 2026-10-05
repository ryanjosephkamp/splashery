# Lane Studio media: more to try, and the original beside the 3D (prefix `smd`)

## Brief

You are a Splashery worker session, started by the Operator (the coordinating session). Repo:
ryanjosephkamp/splashery. Your lane: Studio media (id `StudioMedia`, prefix `smd`). Branch:
`claude/lane-studio-media` (and `claude/lane-studio-media-engine` if you need an engine change). PR
title: "Phase Studio media: more samples, the original beside the 3D". Handoff file:
docs/handoff/StudioMedia.md. Model: Sonnet 5.5 (the owner's split: Studio converters run on Sonnet).

### Brief (written by the Operator on October 4, 2026, from the owner's push notes that evening)

The owner's notes are in docs/reviews/2026-10-04-push-alignment/notes.md (read from "All right, so
I'm going to go through the items in the studio" to "that kind of closes the studio category"). The
Studio is a main area of the push. He wants people "to be able to see really what the hell this tool
can actually do": more samples to pick, chosen because they look striking in 3D, and a way to
compare the original with the 3D result. Every toy here is labs.

1. **Photo to 3D** (`photo-3d`; samples in `src/packs/photo-3d.js` 37-61): two or three more curated
   photos beside the forest path, the York street and the still life, chosen to show depth well
   (deep perspective, layers, an arch or a staircase, a close subject against a far background).
   Precompute each one's depth with `tools/p3d-depth.mjs`, as the three have.
2. **Moving photo to 3D** (`moving-photo-3d`, in `src/packs/moving-photo.js`; only Big Buck Bunny
   today, 686-745 and 878-886):
   - Add the Muybridge horse and rider GIF (`assets/toys/screen/horse.gif`, public domain, already
     in the repo for the Screen toy) and three or four more short videos and GIFs that look great in
     3D. Precompute depth with `tools/live3-depth.mjs`.
   - Speed: he thinks the bunny plays slower than the source. The code is meant to match it (a
     video's frames follow the sound's clock; a GIF keeps its delays; a silent clip runs on a wall
     clock, 399-406, 921-942). Measure each sample: seconds of source against seconds played, on a
     slow and a fast tier, and fix any gap. He also said "even if I turn the speed up, it doesn't
     seem like the speed actually affects the video": find which speed control he means (an app-wide
     speed, if there is one) and make it work for this toy or hide it here.
3. **Model to splats** (`model-splats`; `SAMPLES` in `src/packs/studio-models.js` 51-69, built by
   `tools/stm-samples.mjs`): four to six more default models besides the burger and the vase, picked
   because they turn into good-looking splats (detailed color textures, varied shapes). Small glTF
   or GLB files (under about 10 MB each), not Draco or meshopt compressed (the toy can't read those;
   decompress at build time if needed).
4. **Video to 3D** (`video-3d`; samples in `src/video3d/samples.js` 12-30):
   - **Show the original.** The samples ship only the splats and the camera path. Ship the source
     clip's span for each sample (480p, small, with its credit) and a "Show the original" option
     that plays it in sync with Replay flight, beside or inset.
   - **Answer, in your handoff file:** how long is each source video ("Statue Of Liberty 4k Drone"
     by the Dronalist; "Walking in EDINBURGH…" by POPtravel, both CC BY 3.0 on Wikimedia Commons),
     does the drone fly all the way around the statue, and which spans would make a fuller orbit or
     a longer walk?
   - **Plan longer clips** in `docs/lab/VIDEO3D-LONGER.md`: candidate videos under the allowed
     licenses (a full orbit of a statue or building, a long or looping walk), each with its length
     and license, and what training them would take. The two samples took 431 and 517 minutes for 14
     and 10 seconds in headless Chromium on SwiftShader (software WebGPU), so don't train long clips
     here: estimate the time on a real GPU (the owner's M3 Pro running the toy itself in Chrome, or
     a desktop GPU), and say which the Operator should ask him to run.
5. **The original beside the 3D** (his idea; "not a default view ... its own toy or its own
   setting"): an option on Photo to 3D, Moving photo to 3D and Video to 3D that shows the flat
   original beside the 3D result, playing in sync for videos and GIFs, so a person can turn the 3D
   one and see what the effect did. Reuse the Screen toy's flat picture where you can.

Every sample's license: only CC0, CC BY, CC BY-SA, CC BY-NC (with `"nc": true`), CC BY-NC-SA or
public domain, read on its live source page; good places are Wikimedia Commons, NASA, the Met's and
the Smithsonian's open access collections, Blender's open movies (CC BY), Poly Haven, Kenney and the
Khronos glTF sample models (check each one). Not Pexels, Pixabay's own license, or anything
unlicensed. Samples load only when picked, so the opening download doesn't grow (keep the "embed
transfer ≤ 30 MB" test green).

#### Deliverables

- Tests in `tests/smd*.spec.mjs`: each new sample loads and renders; the GIF keeps its timing; the
  measured play length matches the source within 3%; the original shows and stays in sync.
- Clips at phone size of the best new samples and of the compare view.
- Credits for every sample (CREDITS.md, `tools/assets.json`, the in-app credit), and the toys'
  how-to and About texts updated.

#### You own

The sample lists, sample assets and sample tools of these four toys (`src/packs/photo-3d.js`'s
samples, `src/packs/moving-photo.js`'s samples, `src/packs/studio-models.js`'s `SAMPLES`, the Video
to 3D samples, `tools/p3d-depth.mjs`, `tools/live3-depth.mjs`, `tools/stm-samples.mjs`,
`tools/v3d-sample.mjs`, `src/video3d/samples.js`), the compare option, `tests/smd*.spec.mjs`,
`tools/smd-*.mjs`, `docs/lab/VIDEO3D-LONGER.md`, their lines in the shared lists, and this file.
Lane Live r7 works on the live pack's Splat mirror and the Song landscape beside you; lane Pages r6
imports the Photo to 3D depth modules unchanged.

#### How this lane runs

- The Operator session runs the lanes. The owner, Ryan, talks only to the Operator. Don't ask him
  anything or wait for him. Put questions and blockers in your final message ("READY:", "WORKING:"
  or "BLOCKED:"), and the Operator answers or relays them. Messages that arrive "From the Operator"
  come from the coordinator on the owner's behalf.
- Model: Sonnet 5.5 only, at the default effort. Any helper you start uses the same model. At most
  one helper at a time.
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
- Tests: `tests/smd*.spec.mjs`; never edit `tests/taps.spec.mjs`. Before each push run your own
  specs and the specs of the files you touch (say which in the PR); the Integrators run the full
  suite before a merge. Prettier, `node tools/us-english.mjs --diff`, and for toys
  `node tools/check-packs.mjs <pack>`, a contact sheet and thumbnails (CLAUDE.md, "Before every
  push"). Screenshots `smd-<name>-390x844.png` and `…-1440x900.png`, then
  `node tools/upkeep.mjs --restore-shots`.
- Clips: post every new or changed effect on Effect review page 2
  (https://claude.ai/artifact/BSayVkzQ2FKESesrkrSUMK) as docs/OPERATING.md, "Steps for a lane", says
  (lane record `StudioMedia`), after watching each one. After posting, check the owner's marks about
  once an hour with a scheduled check-in (send_later); stop once your PR is merged or closed.
- Language: American English for every new text (color, center, gray, license, toward, -ize endings,
  dates like "October 5, 2026").
- Your handoff file: start it with this brief, word for word, under "## Brief", then keep "##
  State", "## Notes", "## Known issues" and "## For the Operator" current.
- PR: one draft PR against main (five sections: Summary, Verification, Deviations, Known issues,
  What was cut), opened early and pushed after each finished item. Finish every working turn with a
  final message that starts "READY:", "WORKING:" or "BLOCKED:".

## State

READY (October 5, 2026). Model: Sonnet 5.5. All five items are built, tested and posted.

- Item 1, Photo to 3D: three CC0 photos (spiral staircase, palace staircase, wildflowers up close)
  with depth from `tools/p3d-depth.mjs`; credits done. (A street photo with a shop's brand name in
  it was left out on purpose.)
- Item 2, Moving photo to 3D: four new samples beside the bunny: the Muybridge horse GIF (public
  domain), the dragon (Sintel trailer, CC BY 3.0), the bridge and the robot (Tears of Steel, CC BY
  3.0), the machine (Elephants Dream, CC BY 2.5). A "Clip" choice in the Toy tab (SAMPLES in
  `src/packs/moving-photo.js`; `clip: "sample"` in an old link still means the bunny).
  `tools/live3-depth.mjs <id>` makes a sample from a source kept in `.cache/smd/` (never committed).
  Speed measured and the Speed slider fixed (see Notes). `tests/smd-moving.spec.mjs`, 15 tests.
- Item 3, Model to splats: five more Poly Haven models (CC0): camera, boombox, lantern, bronze whale
  statue, rocking chair (0.4 to 1.4 MB each; color texture only; no Draco or meshopt), made by
  `tools/stm-samples.mjs`. `tests/smd-models.spec.mjs`, 9 tests.
- Item 4, Video to 3D: each sample ships its source's span at 480p (`<id>-source.webm` and `.mp4`, 1
  to 2.6 MB, no sound, cut by `tools/smd-source.mjs`) for "Show the original". The source lengths
  and the orbit answer are in "For the Operator" below. The plan for longer clips is
  `docs/lab/VIDEO3D-LONGER.md`.
- Item 5, the original beside the 3D: a "Show the original" option (off by default) on Photo to 3D,
  Moving photo to 3D and Video to 3D: a small card in the corner (`src/compare.js`, loaded only when
  switched on). A photo shows flat; a clip shows the frame the 3D one shows; a video plays in step
  with Replay flight, holds when it holds, and takes a custom video too.
  `tests/smd-compare.spec.mjs`, 3 tests. A corner card, not the Screen toy's flat picture: that one
  is made of splats inside a toy's own scene, which a trained scene can't share.

Still to do: phone-size clips of the best new samples and of the compare view on Effect review page
2 (the Operator posts them if this session can't), the standard screenshots and thumbnails, the full
test run (the Integrator).

## Notes

- Wikimedia rate-limits fast loops (429 on the API and on upload.wikimedia.org, from this shared
  address); fetch one file at a time with a pause and a User-Agent. The Blender open-movie files
  came from download.blender.org, which did not limit.
- A photo with a visible shop sign (a brand name) was left out on purpose.
- Speed, measured (`tests/smd-moving.spec.mjs`, Chromium on SwiftShader, 4 s of play): on the low
  tier the bunny, the horse and the three videos each play at 99 to 100% of their source's speed
  (for example the bunny 3.55 s of clip in 3.55 s; the horse 3.78 in 3.78). A video's frames follow
  its sound, a GIF's its wall clock, and both held. A fast device that draws only a frame a second
  (the test renderer at max) shows the position a frame late, so that tier is checked against the
  clock each kind follows: the silent clip's clock moves it exactly, and the sound's element runs at
  1.00 times. So no gap was found in the clip's own speed: the bunny sample is 8 frames a second (48
  frames in 6 s), so it can look slower than the 24 a second source even though it lasts as long.
- The Speed control he meant is the Toy tab's Speed slider (the app-wide `motion.speed`). It only
  scaled the turntable and idle moves, so it did nothing here. It now plays the clip from 0.25 to
  1.75 times (the middle, 50%, is the clip's own speed), the sound with it (`speedRate()` in
  `src/packs/moving-photo.js`). The song bar's speed menu is for the song toys and is not shown
  here.
- Show the original keeps the flat video as a blob in memory (it is 1 to 3 MB): a static host
  without range requests (the tests' python server) can't seek a video it hasn't fully downloaded.
- The engine's flight clock steps at most a tenth of a second a frame, so a device under 10 frames a
  second flies slower than real time; the flat video runs on its own clock and is pulled back when
  it has drifted a third of a second (at most once a second).
- Samples load only when picked; nothing new is in the opening download.

## Known issues

- The Speed slider speeds a video's sound by changing the audio element's playback rate (the browser
  keeps the pitch).
- The samples are 16 frames a second, not their sources' 24.
- Show the original on Video to 3D plays the sample's span silently (the samples have no sound).
- The tests here run on a software renderer (about a frame a second at the highest tier), so the
  speed and sync checks that depend on frame timing are made on the low tier or against the clocks.
- No clip of Video to 3D's original: the clip recorder steps a video's seeks too fast for the card
  to catch up, so the card sat still in the recording; `tests/smd-compare.spec.mjs` checks that
  sync.

## For the Operator

**Video to 3D sources (item 4 questions):**

- "Statue Of Liberty 4k Drone" (the Dronalist, CC BY 3.0): 228 s (3 min 48 s), 4K. The sample is 14
  s from 3:24.
- "Walking in EDINBURGH - Scotland (UK) - 4K 60fps (UHD)" (POPtravel, CC BY 3.0): 4,020 s (67
  minutes), 1080p. The sample is 10 s from 7:32.
- Does the drone fly all the way around the statue? No: several partial arcs. The fuller orbits are
  about 0:53 to 1:46 (about three quarters of a circle, looking down on the head) and 0:08 to 0:46
  (about a half circle at a steady distance). The sample's span is the pull-back at the end. (Judged
  from 30 frames 7.6 s apart; times are rough.) Details and the best candidate (the Schloss
  Babelsberg Rundflug, CC BY-SA 4.0, a full circle round a castle in 172 s) are in
  `docs/lab/VIDEO3D-LONGER.md`.
- Training longer clips: not here (SwiftShader took 431 and 517 minutes for 14 and 10 s). Estimate
  on the owner's M3 Pro in Chrome: about 10 to 25 minutes for 60 frames at High, 25 to 60 at
  Highest. **Please ask him to run it** (steps in `docs/lab/VIDEO3D-LONGER.md`), on the Babelsberg
  flight.

**Speed:** no gap found in the clips' own speed; the control he meant was the Toy tab's Speed
slider, now wired to the clip. If he still sees the bunny slow, it is the 8 frames a second of the
sample.

**BY-SA:** I was not waiting on an approval. CC BY-SA is allowed per asset (the notice beside it,
BY-SA kept), and I'd use Babelsberg. The blocker is training: a real GPU is needed (the owner's
Mac), so no Babelsberg sample exists yet.

## r2: the photo spiral (October 5, 2026)

The owner marked `smd-photo-spiral-original` "fix": "Looks good, but appears broken." What looked
broken: turn the 3D spiral and the glass pane on the left (a near part) pulled away from the stairs
behind it and left a wide white band, with the torn pieces of the stairs' edge beside it. The cause
is Photo to 3D itself, not this sample: the relief has nothing behind a near part, and the depth
model puts the pane far in front of the stairs.

Fix (branch `claude/lane-studio-media-r2`, `src/packs/photo-3d.js`, `backingOf()`): a backing layer
of about 3.5% of the splat budget, a coarse grid of splats, each at the deepest depth of the splats
within about a fifth of the picture and in their color, a little behind them, kept inside the
picture so the edges stay crisp. Face-on they are hidden; turned, they fill the gap with the far
side's color. It helps every Photo to 3D sample (the main splats now take 95% of the budget, not
98%). The depth modules in `photo-3d-core.js` are untouched (lane Pages r6 imports them). Test:
`tests/smd-photo.spec.mjs` (4). A thin strip can still show at an extreme turn (about 60 degrees).

### r2 round two: sharper, then polish (the owner's note of October 5, 2026)

Measured with `tools/lab-kernels.mjs` (phone size, device pixel ratio 2, software renderer, 290k
splats):

| Toy                        | View      | Gaussian edge (px) | Sharp edge (px) |
| -------------------------- | --------- | ------------------ | --------------- |
| Photo to 3D (forest)       | home      | 2.72               | 2.36            |
| Photo to 3D                | zoomed in | 3.45               | 2.78            |
| Model to splats (burger)   | home      | 2.37               | 2.03            |
| Moving photo to 3D (bunny) | home      | 2.00               | 1.99            |

- `kernel: "sharp"` (labs only, docs/lab/KERNELS.md) is now on Photo to 3D and Model to splats.
  Video to 3D already had it. Moving photo gained nothing measurable, so it stays as it was. Speckle
  and shimmer rise a little on Photo to 3D (1.00 to 1.35 and 1.20 to 1.51 at home): the owner's eye
  is the judge. The burger zoomed in measures wider with the sharp kernel (2.54 to 3.83) only
  because the measure picks up its texture's edges; the stills show it crisper.
- The splat counts were not the limit: Photo to 3D's grid is already near the photo's own pixels.
- Polish: the original card is a little smaller (34% of the width, 200 px at most; 22% and 320 px on
  a desktop), so it covers less of the 3D picture.
- Six new clips are on page 2 as `smd-r2-*`, beside the old ones. Tests: `p3d`, `smd-photo`,
  `smd-compare`, `stm`, `smd-models`: 46 pass.
