# Video to 3D: the spike's report

Lane Video 3D (prefix `v3d`), built by Opus 5.5, September 30, 2026. The brief is in
[docs/handoff/Video3D.md](../handoff/Video3D.md). This is a one-week spike: it ends in this report
and a decision, not a polished toy.

## The short answer

Yes, for scenes that stand still, in the browser, with nothing uploaded. Splat.js (MIT, vendored in
`vendor/splatjs/`) picks up the frames Splashery chooses, works out where the camera was for each
one, and trains Gaussian splats on the graphics card through WebGPU. The labs toy "Video to 3D"
(Studio shelf) does the whole thing and shows the result as the toy's own splats, with Replay flight
along the video's camera path and a PLY to save. A walk around a statue and a walk down a street
rebuilt well from the video's own angles; people who walk through the shot turn into ghosts. A drone
flight over a city first failed, because of a bug of ours (see "What fails"), now fixed.

**Recommendation: keep it as a labs experiment for now**, and decide on a toy once the owner has run
it on his own computer and phone (the readout on the page gives every number the report needs). If
those numbers hold (minutes on a laptop, a phone that finishes a short clip), it can become a toy
with the changes listed at the end. It should not become the way showcase scenes are made: the Mac
route below does that far better.

## What was built

- **Splat.js, checked and vendored.** MIT (Copyright (c) 2026 Stratum1 GmbH), commit `88efe9a`
  (September 23, 2026), 20 modules, 544 KB. It needs WebGPU and nothing else: no SharedArrayBuffer,
  no cross-origin isolation, so GitHub Pages serves it as it is. Its own video reader loads
  Mediabunny (MPL-2.0), so it is left out and Splashery reads the video itself: a `<video>` element
  seeks to each moment, and the sharpest of three frames in each window is kept (a Laplacian score).
- **Loaded only here.** `src/video3d/run.js` imports Splat.js with `import()` when a video is opened
  in this toy. The shelf, the other toys, this toy's samples and an embed never fetch it
  (`tests/v3d.spec.mjs` checks).
- **The toy.** Choose the stretch (start, length, frames a second) in the Toy tab, open a video, and
  a card shows each stage as it runs (frames picked, decoded, camera path with each step named,
  seeded, training with a live view, export), then a readout: each stage's seconds, frames picked
  and placed, points, splats, training steps, the setting and the WebGPU adapter. "Save as PLY"
  saves Splat.js's standard file. The splats become kit splats with their own sizes and rotations
  (an additive engine change, `scales` and `quat` on cloud samples), in a frame where the cameras'
  up is up, and the scene is centered on the point the cameras look at when they circle something.
  The toy opens at the video's first view; Replay flight moves the stage's own camera along the path
  at the video's speed, with the video's sound (the speaker on), and a drag roams off it at the end.
- **Device settings** (`src/video3d/frames.js`, from the player's tier): a phone ("low" or "mid")
  takes at most 20 or 32 frames at 480 or 640 px, trains at 360 or 480 px for 1,500 or 3,000 steps
  up to 60,000 or 120,000 splats, and uses Splat.js's low-memory mode and quick solve; a computer
  ("high" or "max") takes 60 or 90 frames and trains 7,000 or 12,000 steps up to 250,000 or 350,000
  splats.

## What was measured, and where

Everything below ran in this lane's cloud container, **which has no GPU**: Chromium's WebGPU ran on
SwiftShader (a software GPU on 4 CPU cores), about a hundred times slower than a laptop's graphics
card, and for most runs it shared the CPU with the full test suite. The numbers show that the
pipeline works end to end and how the stages compare; they are not the times anyone will see. The
samples were trained with small settings to fit (360 px, 800 to 1,500 steps).

| Video (CC BY 3.0, Wikimedia Commons)          | Frames picked / placed | Camera path    | Training             | Splats  | PLY     | Result                                      |
| --------------------------------------------- | ---------------------- | -------------- | -------------------- | ------- | ------- | ------------------------------------------- |
| Splat.js's own test set (12 rendered views)   | 12 / 12                | 32 s           | 212 steps, 518 s     | 20,325  | 1.1 MB  | Works                                       |
| Statue orbit (the Dronalist), 20 s at 3:18    | 36 / 24                | 528 s          | 1,504 steps, 88 min  | 30,558  | 1.65 MB | Works from the filmed angles                |
| Statue orbit, 14 s at 3:24 (one shot), 480 px | 27 / 26                | 233 s          | 2,006 steps, 111 min | 38,621  | 2.2 MB  | Works; the r4 card (+44% edge sharpness)    |
| Edinburgh walk (POPtravel), 10 s at 7:32      | 20 / 20                | 62 s           | 800 steps, 59 min    | 30,135  | 1.58 MB | Works; walkers become ghosts                |
| Edinburgh walk, 28 frames, 480 px             | 28 / 28                | 112 s          | 2,006 steps, 109 min | 40,474  | 2.3 MB  | Works; the r4 card (edge sharpness doubled) |
| Edinburgh walk, 28 frames, 640 px             | 28 / 28                | 143 s          | 3,000 steps, 251 min | 49,695  | 2.6 MB  | Works; the r5 card (+49% over r4)           |
| Edinburgh walk, 640 px, splats grown          | 28 / 28                | 225 s          | 3,000 steps, 517 min | 120,000 | 7.9 MB  | Works; the r6 card (+37% over r5)           |
| Nicosia by drone (The Track Record), 0:45     | 20 / –                 | failed, 33 min | –                    | –       | –       | Frames taken for panoramas (a bug, fixed)   |
| Nicosia by drone, 19 s at 1:04 (fixed crop)   | 24 / –                 | failed, 1 min  | –                    | –       | –       | Too little parallax (high, slow flight)     |

Picking the frames took 10 to 17 seconds (seeking a 480p WebM), decoding them under a second.

**On a real device** the owner can run the same test: open
https://ryanjosephkamp.github.io/splashery/?labs=1 (once merged), Studio shelf, Video to 3D, open a
clip, and send the card's readout (it names the adapter, the setting and each stage's seconds). From
Splat.js's own measurements on a desktop graphics card (an RTX 5080), a 251-photo scene solves in
about 3 to 6 minutes and trains 40,000 steps in 10 minutes; a 20- to 60-frame clip at this toy's
settings should take a few minutes on a laptop. Phones: not measured here (no phone in the
container). WebGPU is on in current Chrome, Edge, Safari (iPhones included) and Firefox.

## What fails

- **Moving things.** People walking through the street became smeared ghosts; cars would too. The
  method assumes the scene stands still; true 4D needs a rented GPU (not this lane).
- **A 2:1 picture (fixed).** Splat.js takes any picture within 5% of 2:1 for a 360-degree panorama
  and slices it into six views. The drone clip, cropped to remove a credit line, came out at 2.02:1:
  the first stretch failed the solve ("known-focal reconstruction failed — need more
  parallax/overlap", after 33 minutes) and a second trained 144 "views" from 24 frames. A 2:1 video
  from a visitor would do the same, so the toy now trims such frames to 1.9:1 before Splat.js sees
  them (`panoSafeCrop`, tested).
- **Little parallax.** A drone high over a city sees it from nearly the same angle in every frame;
  expect a slow, high flight to solve poorly. Lower, faster or circling flights work better; so does
  a longer stretch with fewer frames a second. (Not separated from the bug above in this spike.)
- **Angles nobody filmed.** Turning past the filmed arc shows soft, blurry splats (the blue smear
  beside the statue, blobs in the sky). Floaters (loose splats in front of the camera) appear with
  short training.
- **Low texture, water, sky and night.** Blank walls, water and sky give the solve nothing to match,
  and night footage is too noisy; the statue's water and sky trained as soft blurs. Not measured on
  a night clip.
- **Cuts.** A stretch that crosses a cut in the video cannot be solved as one path; choose a stretch
  inside one shot.
- **Size.** The Toy tab refuses files over 40 MB (a limit in `src/ui.js`), so long drone clips must
  be trimmed first.

## What limits sharpness, and what helped

The owner's notes on the first cards (September 30, 2026): "WOW … is there any way to improve
sharpness or the clarity of the darker/blurrier areas?" (the statue smeared into the sky, soft
blobs), and on the street "quite a lot of this looks blurry, but the clearer/sharper parts … look
excellent".

What limits it in the browser pipeline, most important first:

1. **Too little training.** The samples trained 800 to 1,500 steps at 360 px, on a software GPU
   (about 3 seconds a step here). Splat.js reaches its published quality after 30,000 to 40,000
   steps at full resolution; the median splat in these samples is still faint (opacity 0.1), which
   reads as haze. On a laptop's GPU a few thousand steps at 640 to 960 px take minutes; this is the
   single biggest lever, and it needs a real GPU.
2. **Few, low-resolution frames.** 20 to 36 frames of a 480p transcode. Every detail finer than the
   training pixels is guessed. The Mac route trains on the original 4K frames.
3. **Angles nobody filmed.** A drone arc of about 30 degrees gives the statue's far side and the sky
   behind it nothing to learn from; the splats there take on whatever color the few views allow (the
   blue drape). More of the orbit (a longer stretch) is the only real cure.
4. **Things that move.** People, cars, water and clouds are in a different place in every frame and
   train into smears.
5. **The solve's lens.** Splat.js searches the focal length when the video carries none; a wrong
   guess bends the scene slightly and softens it everywhere. A video with its lens data (a phone's)
   or COLMAP's more careful solve does better.

What this lane changed (r2 and r3 cards on the same samples; r4 retrained):

- **Far things kept.** The water, the sky and the skyline were being cut off at the scene's edge;
  they are now pulled in onto a shell behind the scene (as Mip-NeRF 360 contracts distant space), so
  a flight shows them where the video did.
- **Floaters and smears pruned** near the scene (not in the far shell): splats too faint to matter,
  big faint ones, giants, and ones hanging right in front of the camera path. Liberty: 1,532 of
  24,300 splats; oversized splats near the statue (wider than 3% of the scene) from 890 to 223, the
  big faint ones among them from 658 to 0. Edinburgh: 3,801 of 23,236; oversized from 2,684 to 696.
  Edge sharpness (Laplacian variance) of three of Liberty's flight views: 390 to 438 (+12%).
- **The video's own lens.** The flight uses the solved focal length, so each view frames the scene
  as the video did (the side-by-side cards compare them frame for frame).

- **Retraining at 480 px for 2,006 steps, from one shot** (r4): the statue's stretch began with 6
  seconds of another shot (a close-up), which cost 12 of 36 frames; starting after the cut places 26
  of 27. Edge sharpness in the statue region at phone size, averaged over the turn: 149 (r3) to 215
  (r4), +44%: the skyline's buildings become readable, the blue drape beside the arm goes. This is
  the lever that keeps paying: every doubling of steps and resolution shows. It took 1.9 hours here
  and would take minutes on a laptop's GPU.

Not tried here, and worth trying on a real GPU: training longer and at 640 to 960 px; Splat.js's
opacity and needle regularizers; masking the sky out of training; more frames from a longer part of
the orbit. Each is a setting, not new code.

What the Mac route does better: COLMAP solves the camera path from the original 4K frames with
exhaustive matching and a careful focal and distortion model, and msplat or Brush train 30,000 or
more steps at full resolution on the Mac's GPU in minutes. Expect the difference between the video's
own frame and the side-by-side cards here to mostly close for the parts that were filmed.

## The source videos

- Statue (drone orbit): "Statue Of Liberty 4k Drone" by the Dronalist, CC BY 3.0,
  https://commons.wikimedia.org/wiki/File:Statue_Of_Liberty_4k_Drone.webm (20 seconds from 3:18).
- Street: "Walking in EDINBURGH - Scotland (UK) - 4K 60fps (UHD)" by POPtravel, CC BY 3.0,
  https://commons.wikimedia.org/wiki/File:Walking_in_EDINBURGH_-_Scotland_(UK)_-_4K_60fps_(UHD).webm
  (10 seconds from 7:32).
- Drone over a city: "Central Nicosia drone footage overlooking UN buffer zone" by The Track Record
  - BTS, CC BY 3.0,
    https://commons.wikimedia.org/wiki/File:Central_Nicosia_drone_footage_overlooking_UN_buffer_zone.webm
    (19 seconds from 1:04; the 0:45 stretch failed on the panorama bug above).

Each license was checked on the live Commons page on September 30, 2026.

## How sharp each route can get

The owner's second note (r2): "Still more blurry than I'd prefer." The r3 cards add the Lab lane's
sharper splat falloff (`kernel: "sharp"`, labs only): edge sharpness (Laplacian variance of the same
frames) +25% on the statue's turn and +61% on the street's flight, with round edges showing on the
soft blobs where nothing was filmed. The camera poses are not the limit (reprojection error 0.56 px
on both samples). What is left is training, and that depends on the device, not on the route:

- **The method is the same quality as the Mac tools.** Splat.js's own benchmark (Tanks & Temples
  Truck, 251 photos, every 8th held out, on an RTX 5080): 26.14 dB after 10 minutes and 26.55 dB
  after 30, against Brush's 26.10 dB and LichtFeld Studio's 26.14 dB at comparable budgets, and its
  camera path matches COLMAP's to 0.00% of the path length. So the difference between the browser
  and the Mac is how many steps at what resolution each device can afford, not the algorithm.
- **This container (no GPU)**: about 3 seconds a step at 360 px; the samples got 800 to 1,500 steps.
  That is roughly 1/40 of the training a showcase scene gets, at a third of the resolution: the
  softness on the cards.
- **A computer with a graphics card, in the browser** (estimate): the "high" setting (60 frames at
  960 px, 7,000 steps at 720 px) should take a few minutes on a laptop's GPU and give about what
  Splat.js reports at that budget (around 25 dB on Truck: sharp where the video looked, soft where
  it did not). Raising the steps to 30,000 (a "keep training" button) closes most of the gap to a
  showcase scene. Not measured here: the owner's readout from his computer will say.
- **A phone, in the browser** (estimate): memory caps it at 20 to 32 frames, 360 to 480 px and
  60,000 to 120,000 splats, and a phone's GPU is several times slower than a laptop's. Expect a
  recognizable scene that stays about as soft as these cards, in several minutes, with the phone
  warm. Good for "look what my phone made", not for a showcase.
- **The Mac route** (COLMAP 4.2.1 + msplat or Brush, from the original 4K frames): msplat reports a
  full-resolution Mip-NeRF 360 scene in about 70 seconds on an M4 Max, so 30,000 steps at full
  resolution take minutes on an Apple silicon Mac. Expect it to be as sharp as the video wherever
  the video looked: the difference from these cards is about the same as between the left and right
  halves of the side-by-side cards. Showcase scenes should go through the Mac.

- **Growing splats in a short run** (r6): Splat.js adds splats (splitting them where the picture is
  wrong) and moves dead ones only from step 2,500 on, every 2,500 steps, and stops growing at half
  to three quarters of the run. So every run here of 3,000 steps or fewer trained with the splats it
  was seeded with (r5: 49,695, about 15,000 of them dead by the end). The toy now scales that
  schedule to the run (`src/video3d/run.js`: a refine every 1/30 of the run, at least every 100
  steps, growth until 80% of it); the first refine still waits for step 1,500 (fixed inside
  Splat.js). The same street, frames and steps grew to 120,000 splats: edge sharpness +37% over r5.
  The same change helps on a real GPU: the "high" setting (7,000 steps) got one growth round before.
  What it cost: training slows as the splats grow (5 to 14 s a step here) and the PLY triples. Thin
  bright rays at the edge of the sky grew with it; shortening stretched splats did not remove them
  (tried on the far shell and on all splats), so they come from the training itself.

Brush was not run in this container: it trains on the GPU through wgpu, and on a software Vulkan
device it would take days for one scene; its web build needs WebGPU like Splat.js, so it would be no
faster here. The comparison above uses the tools' own published numbers instead.

## What it costs a phone

Not measured on a phone. What is known: the low and mid settings keep 20 to 32 frames at 360 to 480
px on the graphics card (a few tens of MB of training targets), 60,000 to 120,000 splats, and
Splat.js's low-memory mode (it frees the CPU copies once the graphics card has them). Training keeps
the GPU busy for the whole run, so the phone warms up and the battery drains; iOS takes the GPU away
from a tab in the background, and Splat.js stops the run (the card says so). A phone run should stay
on screen, plugged in, and short (5 to 10 seconds of video).

## To become a toy

- The owner's numbers from a laptop and a phone, from the readout.
- A higher file limit for this toy (or reading only the chosen stretch), so a long drone clip can be
  opened as it is.
- Samples trained on a real GPU (the Mac route below, or a laptop), so the samples look like what a
  visitor will get.
- A "keep training" button (Splat.js can continue a run), and a warning before a long run on a
  phone.
- The effect-quality bar: the result is a scan, not a kit toy, so its tap is the camera flight;
  decide whether that is enough of an effect for a public toy.

## The Mac route, for showcase scenes

For a scene worth showing off (a long drone flight, a big building), train on the owner's Apple
silicon Mac instead of in the browser: the camera path is more careful, the training runs for many
more steps on the Mac's GPU, and the result comes back to Splashery as a SOG file like any scan.
Each tool's license was checked on its live page on September 30, 2026:

| Step        | Tool                                                                         | License                 |
| ----------- | ---------------------------------------------------------------------------- | ----------------------- |
| Camera path | [COLMAP](https://github.com/colmap/colmap) 4.2.1                             | BSD ("new BSD license") |
| Training    | [msplat](https://github.com/rayanht/msplat) (Metal, Apple's GPU)             | Apache 2.0              |
| or training | [Brush](https://github.com/ArthurBrussee/brush)                              | Apache 2.0              |
| To our file | [SplatTransform](https://github.com/playcanvas/splat-transform) (PlayCanvas) | MIT                     |

Off limits under Splashery's rules (not used, not suggested): MASt3R and DUSt3R (CC BY-NC-SA), VGGT
(its own license), Depth Anything 3's splat head and most "instant" feed-forward splat models
(non-commercial weights), and OpenSplat as a shipped part (AGPL; a build-only tool only if the owner
agrees).

### Steps

You need macOS 14 or later on an Apple silicon Mac, [Homebrew](https://brew.sh) and Python 3.

1. **Install the tools** (once), in Terminal:

   ```sh
   brew install colmap ffmpeg node
   python3 -m pip install "msplat[cli]"
   npm install -g @playcanvas/splat-transform
   ```

2. **Pick the frames.** Put the video in a new folder, then take three frames a second from the
   stretch you want (here 40 seconds starting at 1:05):

   ```sh
   mkdir -p scene/images
   ffmpeg -ss 65 -t 40 -i flight.mp4 -vf "fps=3,scale=1600:-2" -q:v 2 scene/images/%04d.jpg
   ```

   Look through `scene/images` and delete blurry frames and any frame with a person close to the
   camera.

3. **Work out the camera path** with COLMAP (15 to 60 minutes for a few hundred frames):

   ```sh
   colmap automatic_reconstructor --workspace_path scene --image_path scene/images \
     --data_type video --quality high --single_camera 1 --dense 0
   ```

   It writes `scene/sparse/0/` (the cameras and a cloud of points). If it writes several numbered
   folders, the video broke into pieces that do not connect: use the biggest (most images) or pick a
   steadier stretch.

4. **Train the splats** with msplat on the Mac's GPU (a few minutes for 30,000 steps):

   ```sh
   msplat-train scene -n 30000
   ```

   It reads COLMAP's folder layout from step 3 and writes a PLY of the trained splats; its README
   documents the training flags but not where the CLI saves the PLY, so run `msplat-train --help`
   once to see the output option of the installed version. Brush does the same with a window to
   watch: build it once with `cargo run --release` in its repository (Rust 1.88 or later), open the
   `scene` folder in it, and export the PLY when the picture looks sharp.

5. **Convert it for Splashery**:

   ```sh
   splat-transform scene.ply scene.sog
   ```

   Open `scene.sog` on the site (drop it on the page) to check it, then send it to the Operator with
   the video's source and license, so a lane can add it as a scene.
