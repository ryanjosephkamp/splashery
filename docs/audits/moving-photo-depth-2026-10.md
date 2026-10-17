# Moving photo to 3D: depth over time (lane MP1, October 17, 2026)

Lane MP1 (Opus 5.5) measured how Moving photo to 3D's depth holds from frame to frame, why the Max
depth looked weaker than before, and which cheap ways of steadying it keep the relief. It ships the
best one as the default (the Toy tab's "Depth over time") and writes the rest up here for a Codex
follow-up on the depth model's frame-to-frame stability.

## The two numbers

`tools/mp1-depth-study.mjs` scores each way of turning the model's answers into the relief:

- **Contrast**: how much of the Depth slider's range a frame uses (the 5th to 95th percentile spread
  of its nearness, 0 to 1, averaged over the frames). Low contrast is the "steady but flat" look.
- **Jitter**: how far the nearness moves from one frame to the next where the picture holds still
  (pixels whose color barely changed), averaged over the frame pairs inside one shot. High jitter is
  the "bouncing" look.
- **Ratio**: jitter over contrast, the twitch as a share of the relief. A way that is steadier only
  because it is flatter has the same ratio.

The short samples are scored on their stored model answers (the toy's own `.depth` files), so every
way sees the same input. `tools/mp1-long-depth.mjs` scores a baked 30-second film's cache the same
way.

## What changed on October 10, 2026

Before Codex task 32 ("stabilize moving photo depth", commit b2f661ea), each frame was stretched
to its own 2nd to 98th percentile, eased over two frames each side. Task 32 aligned each answer to
the one before on still pixels, added a seven-frame color-gated filter, and set **one range for the
whole clip**. That made the depth far steadier but squeezed any clip whose model scale wanders over
time: the answers drift (a camera move, a face coming closer, a cut), so the whole clip's 2nd to
98th percentile is much wider than any one frame's, and each frame uses a sliver of it. Measured on
the toy's own samples (the shown nearness, before and after that commit):

| Sample                  | Contrast before | Contrast after |
| ----------------------- | --------------- | -------------- |
| Big Buck Bunny (short)  | 0.98            | 0.89           |
| Sintel and the dragon   | 0.79            | 0.27           |
| Galloping horse (GIF)   | 0.54            | 0.46           |

The relief's lift (`LIFT`, 0.9) and the Depth slider are unchanged since the toy began (October 2),
so this is the "Max depth seems weaker" report.

## The ways tried (short samples)

Contrast / jitter / ratio. Lower ratio is better at the same contrast.

| Way                                     | Bunny (1 shot)        | Horse GIF (15 frames) | Sintel (2 shots)      | Bridge (1 shot)       | Machine (1 shot)      |
| --------------------------------------- | --------------------- | --------------------- | --------------------- | --------------------- | --------------------- |
| Each frame (before October 10)          | 0.977 / 0.011 / 0.011 | 0.545 / 0.303 / 0.556 | 0.791 / 0.119 / 0.151 | 0.734 / 0.046 / 0.062 | 0.859 / 0.062 / 0.072 |
| Whole clip (October 10 to now)          | 0.893 / 0.005 / 0.006 | 0.462 / 0.090 / 0.194 | 0.266 / 0.013 / 0.048 | 0.723 / 0.014 / 0.020 | 0.342 / 0.016 / 0.046 |
| Rolling range, 1 s                      | 0.975 / 0.005 / 0.005 | 0.502 / 0.106 / 0.211 | 0.677 / 0.043 / 0.064 | 0.731 / 0.015 / 0.020 | 0.706 / 0.035 / 0.049 |
| Rolling range, 2 s                      | 0.972 / 0.005 / 0.005 | 0.518 / 0.108 / 0.208 | 0.591 / 0.037 / 0.063 | 0.727 / 0.014 / 0.020 | 0.580 / 0.034 / 0.058 |
| **Rolling range in each shot, 1 s**     | 0.975 / 0.005 / 0.005 | 0.502 / 0.106 / 0.211 | 0.726 / 0.046 / 0.063 | 0.731 / 0.015 / 0.020 | 0.706 / 0.035 / 0.049 |
| One range per shot                      | 0.893 / 0.005 / 0.006 | 0.462 / 0.090 / 0.194 | 0.374 / 0.018 / 0.048 | 0.723 / 0.014 / 0.020 | 0.342 / 0.016 / 0.046 |
| One range per shot, filter twice as wide | 0.892 / 0.004 / 0.005 | 0.465 / 0.088 / 0.189 | 0.372 / 0.016 / 0.043 | 0.718 / 0.011 / 0.015 | 0.340 / 0.014 / 0.041 |
| One range per shot, keyframes (every 4th) | 0.924 / 0.005 / 0.005 | 0.709 / 0.013 / 0.019 | 0.474 / 0.022 / 0.046 | 0.730 / 0.012 / 0.017 | 0.299 / 0.011 / 0.037 |

What they show:

- **Normalizing the scale across frames** is the lever. One range for the whole clip (or for each
  shot) is the steadiest but flattest; a frame's own range is the fullest but bounces (three to
  ten times the jitter). A range eased over about a second follows the model's slow drift and not
  its frame-to-frame noise: it gets back most of the old relief (Sintel 0.27 to 0.73, Machine 0.34
  to 0.71) at the same twitch-to-relief ratio as today. Two seconds is a little flatter for no
  steadier ratio.
- **Cuts**: easing the range only inside a shot (a frame starts a shot when more than 60% of its
  picture changed at once, `shotStarts`) keeps one shot's scale from leaking into the next. It
  matters for Sintel's short clip (two shots; 0.68 to 0.73) and costs nothing elsewhere.
- **Temporal smoothing** (the color-gated filter twice as wide) lowers jitter by 10 to 20% on
  every clip but doesn't touch the contrast; it would also smear fast motion. Not worth it alone.
- **Keyframes** (the model on every fourth frame, the frames between blended) look steadiest on the
  horse only because 15 frames become four answers blended: the legs would slide between poses
  instead of galloping. On the others they change little. Not shipped. A long video already works
  this way on a phone (a few answers a second), so the trade is known there.
- **The horse GIF** (the control the owner likes) has the highest jitter of all on this measure,
  because almost nothing in it is still from one frame to the next at 10 frames a second; its
  numbers barely move between the ways (0.46 to 0.50 contrast), so it looks as it did.

## What shipped

`STEADY.mode` in `src/packs/moving-photo.js`, the Toy tab's "Depth over time":

- **"Full relief, steady in each shot"** (the default): `rollingRanges` in
  `src/live/clip-stabilize.js`, each frame's own range eased over a second each side, inside its
  shot. It applies to the short samples (normalized when they load), to clips people open (their
  refinement passes), and to the 30-second films (baked into their caches by
  `tools/cdx-mp2-r4-bake.mjs`).
- **"Steadiest: one range for the whole clip (flatter)"**: the October 10 way, kept. It applies to
  the short samples and to clips opened while it is picked; the 30-second films keep what was baked.

The 30-second films' caches (re-baked by lane MP1 from 960-pixel films), old and new:

LONG_TABLE

## For a Codex follow-up

- **The model itself.** Depth Anything V2 Small answers each frame alone; its scale and offset drift
  and fine parts flicker. A video depth model (temporal attention, or one that takes the previous
  answer as a hint) would remove the drift at its source. Measure it with
  `tools/mp1-depth-study.mjs` (add it as a way) and `tools/mp1-long-depth.mjs`.
- **Motion-aware blending.** Today's filter rejects moving pixels by color difference alone. Optical
  flow (or the clip's own motion vectors) would let still parts of a moving shot blend over more
  frames and moving parts keep their own answers.
- **Uploaded long videos** (`streamDepth`, the live long-video path) still use their own running
  range fit, not `rollingRanges`; they were not measured here.
- **A shot detector** better than "60% of the picture changed": a slow dissolve or a flash isn't a
  cut and a cut between similar shots can be missed. The study's numbers didn't depend on it for
  these clips (Sintel's short clip is the only one with a cut).
- **Higher-frame-rate clips.** At 30 or 60 frames a second the frame-to-frame noise is the same per
  answer but there are more answers a second, so a range eased over a fixed time (one second, as
  shipped) is the right unit; a filter radius counted in frames (the seven-frame filter) is shorter
  in time at a higher rate. A radius in seconds is worth trying.
