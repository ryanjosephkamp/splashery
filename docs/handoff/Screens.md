# Lane Screens: the screen and the Gaussian splat toy

Prefix `scr`. Branch `claude/lane-screens`, PR "Phase Screens: the screen and the Gaussian splat
toy". How lanes work: [OPERATING.md](../OPERATING.md). Earlier lessons: [history.md](history.md).

## Brief

(Written by the Operator on September 28, 2026, from the owner's notes and the Pages into Splats
plan he accepted the same day; step 3 of ROADMAP.md, "Pictures and pages")

The owner's words: "If somebody uploads a GIF or a video, what if we created, like, a hologram or a
TV screen that has, like, a video that they've put on there, and it would all be Gaussian splats,
with the audio synchronized? Or it could be like a movie theater, okay? … But we could also have it
just be like a flat 2D sort of hologram where you can just, like, move it around and watch it and
rotate it." And about a second toy: "It would be really cool if we actually had a Gaussian splat
toy. So it would be a Gaussian splat visualization or demo, or something kind of like how we have
the AI or computer science demos made out of Gaussian splats." The laptop is locked, so videos go on
this new screen and never on the laptop.

Build two toys, both `labs: true`:

1. **Screen** (`screen`, on the "Pictures and pages" shelf).
   - Your GIF or video, with its sound on the site's speaker button, on a sheet with
     `method: "screen"`.
   - A "Style" option:
     - old TV: a wooden cabinet, a curved glass face and knobs;
     - flat TV: a thin black panel on a stand with a small standby light;
     - cinema: a wide screen, red curtains and a few rows of seats in front;
     - hologram: a floating sheet of light over a round projector base, with faint scanlines and a
       soft glow. It is light, so it may be see-through, and you can walk the camera round it.
   - The tap switches it on (or plays and pauses once it's on). The old TV's picture opens from a
     bright horizontal line. The flat TV fades up from black as the standby light goes out. The
     cinema's curtains part. The hologram's beam flickers up from the base. Each is under about 2 s,
     and moving parts move as solid pieces.
   - The Toy tab has Play and Pause. Add a way to scrub through the video if the engine allows it;
     if it needs an engine change, ask the Operator first (below).
   - Samples:
     - a short video clip, a few seconds and a few MB at most, under CC BY or public domain, checked
       on the live source page and credited. For example, a scene from a Blender open movie (CC BY
       3.0) without its title card or any logo, or public-domain NASA footage with no insignia;
     - a CC0 GIF.
2. **Gaussian splatting** (`gaussian-splatting`, on the AI and computing shelf beside gradient
   descent and the diffusion model).
   - A toy made of splats that shows how splats work, with a "View" option:
     - **One splat:** one big soft splat drawn as an ellipsoid of many small splats, with its three
       axes as thin rods. Sliders set its three sizes, its turn, its color and its opacity.
     - **Many splats:** a small object (kit-built), then the same object with every splat shrunk to
       a dot, so you see what it's made of, and back.
     - **Training (the default and the tap):** a cloud of random splats slides, stretches and
       recolors, step by step, until a picture appears. It is a real fit: 2D Gaussians fitted to the
       picture by gradient descent in a worker, a few thousand of them. The toy shows the steps
       (keyframes, or live if it's fast enough). "Open your own photo" uses the engine's media
       panel. Each splat moves on its own.
     - **Sorting:** the splats of a small object light up one by one in the back-to-front order they
       are drawn.
   - A short about text explains the idea in plain words: a scan's splats are trained the same way
     until they match the photos.

For each toy: a sound (the TV's click and hum, the curtains, a soft rising chime as the picture
forms), a how-to line and an About text, a toy-plan entry, a thumbnail, and clips on the Effect
review page:

- `scr-screen-tv`, `scr-screen-flat`, `scr-screen-cinema`, `scr-screen-hologram` (each style
  switching on and playing the sample);
- `scr-splat-one`, `scr-splat-many`, `scr-splat-training`, `scr-splat-sorting`.

Show them at 390×844.

You own:

- src/packs/screens.js (new, category of the "Pictures and pages" shelf);
- src/packs/splatting.js (new, category "computing"), plus any helper module or worker it needs
  under src/packs/;
- assets/toys/screen/ and assets/toys/gaussian-splatting/;
- tests/scr.spec.mjs, your `scr-*` screenshots and docs/handoff/Screens.md;
- your lines in the shared lists.

Lane Books (your book, the photo album and the picture frame, in src/packs/pictures.js) and lane
Manual (the splat equation toy and the manual) run at the same time. Leave their files alone.
src/packs/computing.js stays frozen.

### The engine you build on (lane Pictures, PR #64, merged before you start)

Read docs/handoff/Pictures.md first, above all "Design" and "For the Operator: picture sheets". A
recipe shows a PDF, a picture, a GIF or a video on picture sheets:

- `pictures: { sample, accept }` names the media;
- `k.sheet({ id, center, width, height, normal, up, part, method, fit, align, leaf, lift, opacity })`
  places a sheet;
- `out.sheets[id] = { page, visible }` picks its page;
- `k.spine(...)`, `leaf: slot` and `out.leaves[slot] = { angle, curl }` turn and curl a page like
  paper (kind `leaf`; a leaf's sheet stays on part 0);
- `info.data.pictures` gives `page`, `count`, `kind`, `name`, `playing`, `next()`, `prev()`, `go(n)`
  and `togglePlay()`;
- the Toy tab's panel comes from `input: { title, media: { accept }, note }`.

The engine opens files and https addresses, builds each sheet in a worker, sharpens it as you zoom,
frees pages you leave, keeps video sound on the speaker button, and puts `toy.media` in links.
Budgets are per sheet and per device tier (`PICTURE_BUDGETS` in src/pictures.js). A toy that shows
three or four sheets at once shows three or four times one page's splats, so check the splat count
at each tier. The Picture lab (`src/packs/pictures.js`, labs only) is the working example.

Every new toy is `labs: true` in src/toys.js on the new "Pictures and pages" shelf (category as lane
Pictures set it up), except where this brief names another shelf. The owner turns labs on with
`?labs=1` and tries the toys on his phone. The labs switch comes off in a later small Ops change,
when he says so.

The owner's words (docs/reviews/2026-09-28-pictures/review.md, word for word): "It should all still
be Gaussian splats, like the rest of it is." "There needs to be enough resolution for it to still
resemble the original article. It doesn't have to be perfectly legible." "It's okay if we allow the
toys to be bigger than usual, possibly even larger in file size than usual, in order for the
resolution and quality to be better." Samples only under CC0, CC BY or public domain, checked on the
live source page and credited (CREDITS.md and the toy's in-app credit); no logos, brand names or
insignia. The laptop stays exactly as it is.

## State

September 28, 2026: both toys are built (labs only), with their sounds, help, plan entries, credits,
tests (`tests/scr.spec.mjs`) and clips; an engine PR (`claude/lane-screens-engine`, "Engine: seek a
video, and a picture toy's prepare reads its media") adds the two small things they need.

- **Screen** (`src/packs/screens.js`, "Pictures and pages"): Style (Old TV, Flat TV, Cinema,
  Hologram) and Sample (the video or the GIF). The video or GIF is one picture sheet with method
  "screen". The tap switches it on, then plays and pauses; Play in the Toy tab's picture panel
  switches it on too. A "Scrub through the video" slider jumps the video (needs the engine PR's
  `seek`; without it the slider does nothing).
- **Gaussian splatting** (`src/packs/splatting.js`, AI and computing, beside gradient descent): View
  (Training, One splat, Many splats, Sorting). The fit is `src/packs/splat-fit.js`, run in
  `src/packs/splat-fit-worker.js`.
- Samples, checked on their live source pages:
  - Video: a 6-second scene of Big Buck Bunny (the bunny and the butterfly, 1:44.5 to 1:50.5; no
    title card or logo), © Blender Foundation, CC BY 3.0 (peach.blender.org, "About": "licensed
    under the Creative Commons Attribution 3.0 license"), from download.blender.org/peach.
    `assets/toys/screen/bunny.mp4` (H.264 and AAC, 378 KB) and `bunny.webm` (VP9 and Opus, 313 KB);
    the toy picks the MP4 where the browser plays H.264.
  - GIF: Eadweard Muybridge's galloping horse ("Annie G.", 1887), public domain on Wikimedia Commons
    (File:Muybridge_race_horse_animated.gif), `assets/toys/screen/horse.gif` (300×200, 15 frames).
  - Photo: "Strawberry on white background" by Joselodos, CC0 1.0 on Wikimedia Commons, cropped to
    4:3 and scaled to 800×600 (`assets/toys/gaussian-splatting/strawberry.jpg`).

## Design

**The Screen's switching on.** Each style is its own build (the Style option rebuilds). A sheet's
splats stand six of its own pixels in front of its center (lane Pictures' "lift"), so every cover
sits well in front of the sheet (the sheet is set back 0.09 on the old TV and 0.115 on the flat TV).
The state (off, switching on, on) lives in the recipe, timed on the player's clock (`info.time`), so
a pulse control ("power", 2 s) only keeps frames coming.

- Old TV (1.5 s): the power knob and the volume knob turn (parts); a bright line appears in the
  middle, splits into two bars (parts, fading on channel 1) that run to the top and the bottom; the
  dark curved glass (a bulged surface in front of the picture) clears row by row behind them (kind
  "fade" on channel 0, each splat's `at` from its height).
- Flat TV (1.4 s): the glossy black panel face fades (kind "fade", channel 0, one wide band) while
  the red standby light goes out (channel 1).
- Cinema (1.9 s): sixteen curtain pleats are tokens. The leading pleat is pulled to the side and
  pushes the others along; each one turns as it is squeezed, so the curtains bunch into folds at the
  sides. The seats darken (a band with negative glow) as the film starts.
- Hologram (1.5 s): the beam (faint splats in a fan from the lens) rises on channel 0; the picture,
  its edge glow and its scanlines are two parts that flicker on (on, off, on, off, on) and then
  float gently. The sheet's opacity is 0.62: it is light.

**Sounds.** Each style (and each splat view) has its own sound, played as cues from `drive`
(`action.quiet`), so the tap is silent otherwise. `src/toy-sounds.js` holds the old TV's and the
training view's sounds, for the Sound Board.

**The fit.** `fitSplats` fits N flat Gaussians (2,400 by default) to a picture 96 pixels wide by
Adam, 140 steps, keeping 13 keyframes (steps 0, 2, 5, 9, 14, 20, 28, 38, 50, 65, 85, 110, 140). It
draws them exactly as the renderer draws splats: front to back (Gaussian 0 in front), each with
PlayCanvas's kernel (a Gaussian cut where it falls to e^-4 and scaled to reach 0 there:
`(exp(-q/2) - e^-4) / (1 - e^-4)` for q < 8), alpha capped at 0.99, over the picture's border color
(the card's). The backward pass is the 3D Gaussian splatting one in 2D. Measured in Node: 1.5 s for
the strawberry (per step about 11 ms), loss from 0.39 to 0.0004 (mean squared error per pixel).

**Showing the fit.** Each keyframe is a copy of the 2,400 splats on its own part (13 parts), each
splat morphing (channel 0) to its place in the next keyframe; the toy shows one copy at a time and
runs one clock through all of them, so each splat slides on its own and stretches and recolors at
each keyframe. Splat i stands 0.04 × i / N behind the first, so the draw order is the fit's.

The kit gives every splat a random size factor, exp((r − 0.5) / 2). The fitted splats must keep
their fitted sizes, so the recipe builds them first (the kit's random sequence starts with them, one
number per splat) and divides the same factors out: `mulberry32(mixSeed(k.seed, "kit-splats"))`.
With nothing weighted in that view, the kit's base size is 0.01, so a splat's size is exact. A test
checks the sizes the kit gives (they match to 1e-7); if the kit changes its sequence, it fails.

**Open your own photo.** The training view is a picture toy (a small sheet shows the photo it
learns), so the Toy tab's media panel opens a photo. With the engine PR, `prepare(options, help)`
calls `help.media()`, draws that photo at the fit's size and fits it in the worker (cached per
picture). Without it, the fit always learns the sample.

## Notes

- Page screenshots stall in the stepped-clock clip tool once a toy animates, so `tools/scr-clip.mjs`
  captures the stage canvas instead (like `tools/effect-clip.mjs`), at 390×844.
- Kit clouds are sized from a base of 0.01 when a view gives every piece a fixed count; the "many"
  view sizes each piece's splats from its area.
- `pkill -f` with a pattern that appears in the same command line kills that shell too.

## Known issues

- The fitted picture is a little softer on screen than in the fit: the renderer adds a small blur to
  every splat (antialiasing), and depth sorting in buckets can swap two nearby splats.
- The hologram's sheet is see-through, but its two layers (a base and the pixels) make it about 85%
  opaque.
- The Scrub slider doesn't follow the video as it plays (a recipe can't move a slider); it jumps the
  video when moved.

## For the Operator

- Engine PR: "Engine: seek a video, and a picture toy's prepare reads its media"
  (`claude/lane-screens-engine`). It adds `time`, `duration` and `seek(s)` to the pictures API, and
  a second argument to a picture toy's `prepare`: `help.media()`. Both are additive; tests in
  `tests/scr-engine.spec.mjs`. Merge it before this lane's PR.
- Two shared tests count toys exactly and fail with this lane's toys (they would with any new labs
  or computing toy): `tests/pic.spec.mjs:138` expects the Picture lab to be the only labs toy, and
  `tests/ai.spec.mjs:52` expects exactly twelve computing toys (it could count the `computing`
  pack's toys instead). Both are other lanes' files, so they are yours to change.
- `tests/taps.spec.mjs`: no exception needed (both taps end where they rest; the Screen stays on,
  but none of its parts or morph channels move at rest).
- PACKS.md, picture toys: a screen sheet's splats stand six of its pixels in front of its center, so
  anything meant to cover a sheet must be further in front than that at the coarsest level shown.
- New tool: `tools/scr-clip.mjs` (clips of the Screen and the splat toy at 390×844, stepping a video
  by seeking).
