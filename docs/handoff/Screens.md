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

September 28, 2026: started. Samples chosen and checked on their live source pages:

- Video: a 6-second scene of Big Buck Bunny (the bunny and the butterfly, 1:44.5 to 1:50.5; no title
  card or logo), © Blender Foundation, CC BY 3.0 (peach.blender.org, "About": "licensed under the
  Creative Commons Attribution 3.0 license"), from download.blender.org/peach. Shipped as
  `assets/toys/screen/bunny.mp4` (H.264 and AAC, 378 KB) and `bunny.webm` (VP9 and Opus, 313 KB).
- GIF: Eadweard Muybridge's galloping horse ("Annie G.", 1887), public domain on Wikimedia Commons
  (File:Muybridge_race_horse_animated.gif), `assets/toys/screen/horse.gif` (300×200, 15 frames).

Building the Screen next, then the Gaussian splat toy.

## Notes

## Known issues

## For the Operator
