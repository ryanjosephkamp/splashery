# Lane Viewer: whole PDF figures, tilt lock and top-bar settings

Prefix `vw`. Branch `claude/lane-viewer`, PR "Engine: whole PDF figures, a tilt lock, top-bar
settings and flags per toy". An engine lane. How lanes work: [OPERATING.md](../OPERATING.md).
Earlier lessons: [history.md](history.md) and [Pictures.md](Pictures.md).

## Brief

(Written by the Operator on September 28, 2026, from the owner's message that evening)

The owner tried the Picture lab on his phone and sent five notes. His words are quoted; the
Operator's reading follows each.

1. **Black boxes over figures in PDFs.** "It looks like certain things are almost like redacted,
   like blacked out on research articles that I put in here … the black spots kind of change and
   other things that the black spots would normally cover render basically perfectly." His
   screenshots: an open-access Taylor & Francis article (Cogent Arts & Humanities, 2024, CC BY, doi
   10.1080/23311983.2024.2432131). A figure on page 2 is a solid black rectangle; on page 1 the
   journal's cover picture is partly drawn and partly covered by black blocks. The text, vector
   icons and colored headings are all fine. Nothing in our code hides anything on purpose, so this
   is a rendering bug with some embedded raster images, and the black areas change between builds of
   the same page.
   - Reproduce it first. Our container can't download from tandfonline (403), so find or make PDFs
     that show it: open-access publisher PDFs from other hosts, arXiv PDFs, and PDFs you build with
     embedded JPEG 2000 (JPX), CMYK JPEG (DCT with Adobe transform), JBIG2, images with soft masks,
     and large or tiled images. Likely suspects, not conclusions: an image format whose decoder
     fails in the worker (PDF.js's openjpeg, jbig2 and qcms wasm live in vendor/pdfjs/wasm), images
     drawn while a page renders at two detail widths at once, a page being cleaned up while another
     render still uses its images, or a canvas or memory limit on phones.
   - Fix the cause so figures always show whole, at every detail width, on the phone tier too. Add a
     test with a PDF fixture that fails before your fix and passes after (commit only fixtures we
     make ourselves or that are CC0/public domain).
   - If some image truly can't be decoded, draw it as it is, or leave that area as plain paper.
     Never draw a black box.
2. **Pinch should zoom, not turn.** "If I use two fingers to zoom in and zoom out, like I naturally
   would for anything else, because our thing can rotate … it ends up kind of, like, spinning
   something." Today src/camera.js reads a two-finger gesture as pinch and twist together, so
   zooming also rolls the toy. Make a two-finger pinch zoom only, for every toy (a clear two-finger
   twist may still roll a toy whose tilt isn't locked, but only past a dead zone, so a normal pinch
   never rolls).
3. **A tilt lock for flat things.** "Maybe by default we can have rotation locked … allow people to
   kind of spin the thing to the left or to the right, but not rotate it … backwards or forwards,
   or, like, rotate the face of it … They can hit a button somewhere to enable that and to remove
   the rotation locks." So:
   - A toy can declare that it starts with its tilt locked (a recipe flag). With the tilt locked,
     dragging only spins the toy around its vertical axis (yaw). Pitch and roll stay at the toy's
     home pose, and zoom and pan still work.
   - Locked by default: the Pictures and pages shelf (the Picture lab, and the Books and Screens
     toys when they merge). Every other toy stays free, as today.
   - A top-bar button (below) shows the lock for the current toy and toggles it. Remember a change
     per toy for the visit, so a toy you unlocked stays unlocked when you come back to it.
   - Old `#s=` links and saved scenes must keep loading exactly: a link's saved pose wins over the
     lock.
   - Also add a **Reset view** control that eases the camera back to the toy's starting pose (if one
     exists already, make it easy to find).
4. **Top-bar settings next to ? and the speaker button.** "Add a couple of other buttons right where
   the question mark circle and the sound or volume circle is … for things that are global
   controls." Add two round buttons that match the existing ones: **Turntable** (the idle auto-spin;
   global, on or off for every toy, remembered on this device; reduced motion still wins) and **Tilt
   lock** (as above). Give each a clear icon, an accessible label, a pressed state, and a short
   tooltip. Keep the header tidy at 390×844.
5. **Country flags per toy, under Look.** "If I set it to a certain country for one toy, and then I
   change to just a different toy, the country flag theme carries over … My preference would
   actually be to make the national or country flag be something that is specific for a given toy …
   I'd almost rather just move it to the look area." Move the country flag choice into the Toy tab's
   Look section. A flag applies only to the toy it was chosen on. Switching toys shows the new toy's
   own default, and coming back to the first toy during the visit shows its flag again (remembered
   in memory or sessionStorage, whichever is lighter). Links and saved scenes that carry a flag must
   keep loading.

Also add **short terms of use** in the About tab (a marked block in index.html) and in README.md, in
plain American English, with this meaning (you may tighten the wording, but keep every point):

- Splashery is free and runs in your browser. Files you open stay on your device; nothing is
  uploaded to us or anyone else.
- You are responsible for what you open, show, link to or share with Splashery. Only use files and
  web addresses you have the right to use. Splashery doesn't inspect, filter or censor what you
  open, and isn't responsible for how people use it.
- A link you share carries settings and, if you choose, the web address of media hosted elsewhere;
  whoever hosts that media is responsible for it.
- Splashery's code is MIT licensed; each toy's assets keep their own licenses (see Credits). It is
  provided as is, without warranty.

### You own

- the engine files these changes need: src/camera.js, src/ui.js, src/app.js, index.html (the header
  buttons, the Look section's flag row, the terms block) and its CSS, src/media.js, src/pictures.js,
  src/picture-splats.js and src/pictures-worker.js (for the figure fix), and src/player.js only if
  the recipe flag needs it;
- one line per picture toy in src/packs/pictures.js to set its tilt lock. Lanes Books and Screens
  own those packs; if their toys aren't on main yet, tell the Operator which line they'll need;
- tests/vw.spec.mjs, test fixtures under tests/fixtures/vw/, your `vw-*` screenshots,
  docs/handoff/Viewer.md, and a short new section in docs/PACKS.md (the tilt-lock flag).

Keep every change small, additive and tested. The laptop is locked: its look and behavior stay
exactly as they are, and its smoke test must stay green. Lanes Books and Screens are finishing.
Books may merge an engine PR that touches the Toy tab's picture panel (a video scrub bar), and
Screens' engine PR #71 touches src/player.js. Merge main into your branch whenever it moves, and
keep both sides of any conflict.

### Clips and cards on the Effect review page

Post at 390×844 (tools/effect-clip.mjs, or tools/pic-clip.mjs for picture toys):

- `vw-pdf-figures`: a PDF page with photos or figures, before and after (a still pair is fine as a
  card);
- `vw-pinch`: a pinch zoom on a flat toy and on a round toy, neither turning;
- `vw-tilt-lock`: a drag on a locked picture toy (it spins only), then the unlock and a free turn;
- `vw-top-bar`: the header with the new buttons, and Reset view;
- `vw-flag`: a flag set on one toy, a switch to another toy (its own look), and back (the flag still
  there).

## State

- September 29, 2026: all five notes and the terms are built and tested (`tests/vw.spec.mjs`, 14
  tests). Draft PR #75.
- Cards on the Effect review page (lane `Viewer`): `vw-pdf-figures` (a still pair), `vw-pinch`,
  `vw-tilt-lock`, `vw-top-bar`, `vw-flag`. Waiting for the owner's marks.
- Full suite: 292 passed, 2 failed on the first run; both fixed (the 200-page test: sheet containers
  get 1.5x room; the smoke chess flag test follows flags per toy).

## Notes

### 1. Black boxes over PDF figures: the cause and the fix

- Reproduced with a PDF we made (`tests/fixtures/vw/figures.pdf`, made by
  `tests/fixtures/vw/make-figures.py`: a JPEG, a CMYK JPEG, a JPEG 2000, a picture with a soft mask,
  an indexed bar chart with flat colors, a 16-bit picture). PDF.js drew every page correctly at
  every width (no black, no transparent pixels), so the fault was after the draw.
- The cause was in `paperBlocks` (`src/picture-splats.js`), which finds the paper color of each 8×8
  block as the mean of the pixels at or above the block's median lightness. The median was stored in
  a `Float32Array`, but each pixel was compared against it in double precision. In a flat-colored
  block (all pixels the same), the Float32 rounding could put the median just above every pixel, so
  no pixel counted: 0 / 0 = NaN. The NaN spread through the 3×3 smoothing (about 5×5 blocks, 40 px
  squares), no pixel counted as ink there (comparisons with NaN are false), and the base splats drew
  with NaN colors, which the GPU shows as black.
- This matches the owner's report: only raster figures with flat areas (a journal cover, a chart)
  were hit, text and vector art never; and the boxes moved between builds, because a block's
  contents change with the detail width.
- 540 of 1,280 flat test colors hit it. The fix: lightness is a whole number
  (`r * 30 + g * 59 + b * 11`), so the median and the test agree exactly, and a block with no
  counted pixels falls back to the page's paper color. No path now yields a NaN color.
- The tests fail before the fix (the unit test, every picture kind at five widths, and the Picture
  lab on screen) and pass after.
- Also seen, not a bug: when a page needs a bigger container, the old sheet stays on show for six
  frames (by design, lane Pictures). In the slow test browser six frames can be a second, so a still
  taken right after a page turn can show both pages.

### 2. Pinch

- `Gestures` (src/camera.js) reads a two-finger gesture by whichever it does first past a threshold:
  a zoom (8% scale), a twist (0.3 rad, about 17°) or a two-finger drag (22 px). Only a twist rolls
  (from past the dead zone, so there is no jump), only a drag turns the toy, and zoom works in every
  mode. `onPinch` gets `mode` (the app and the embed viewer both use it).
- Picture toys still pan with two fingers in any mode (as in a photo viewer).

### 3. The tilt lock and Reset view

- `OrbitCamera.setTiltLock(on)`: locked, `rotateBy` turns only the yaw (a sideways drag, with no
  roll mix-in) and `rollBy` does nothing; locking eases pitch and roll back to the home pose.
- Recipe flag `tiltLock: true` (PACKS.md 5c). Set for the Picture lab. The app's `onToy` applies the
  toy's own default, or the choice made for it earlier in the visit (`App.tiltLocks`, keyed by toy).
  A link's camera is set after `onToy`, so its pose wins and the lock keeps that pitch and roll. The
  embed viewer applies the recipe's default too.
- Reset view: a round button in the top bar (and still in the Tools tab, R and double-tap).

### 4. The top bar

- Three round buttons in a marked block in index.html (`view-button`): Reset view, Tilt lock (a
  padlock, pressed when locked) and Turntable (a turntable, crossed out when off), left of "?" and
  sound. Each has an aria-label, a title and a pressed state.
- The turntable button and the Toy tab's "Turntable when idle" switch are one setting,
  `scene.autoplay.turntable`, now remembered in `localStorage` (`splashery.turntable`). A device
  that chose "off" keeps it off for links too; reduced motion still wins (the button is disabled).
- At 390 px the five buttons sit in a row right of the name; at 380 px and under all five shrink to
  32 px so they still clear "splats you can play with".

### 5. Flags per toy

- The "Flag colors" picker moved from Quick settings to a new Look section in the Toy tab. When a
  toy is chosen, the old toy's flag (or none) is kept in `App.toyFlags` (memory, for the visit) and
  the new toy gets its own: its remembered flag, or none. Other patterns carry over as before. Links
  and saved scenes with a flag load as before.
- The Look tab's Pattern section still offers the flag as a pattern (unchanged).

### Terms of use

- In the About tab (a marked block after Credits) and at the end of README.md, with every point of
  the brief.

### Clips

- Rendered with a scratch recorder (`tools/_vwclip.mjs`, not committed: it drives real touch pinches
  through the Chrome DevTools protocol and shows the fingers as dots).

## Known issues

- The shelf-wide default: only the Picture lab sets `tiltLock` now. The Books and Screens toys need
  one line each when they merge (below).

## For the Operator

- The Books and Screens toys need `tiltLock: true,` in their recipes, next to `turntable: false`:
  `your-book`, `photo-album`, `picture-frame` (src/packs/pictures.js, lane Books) and `screen`
  (src/packs/screens.js, lane Screens). The Gaussian splat toy (AI shelf) stays free.
- README's Controls table: "Two-finger twist | Roll" could read "A clear two-finger twist | Roll
  (not when the tilt is locked)", and a row for the top-bar buttons. I only added the terms there.
- The moved flag label now reads "Flag colors" (American English); the older British labels
  elsewhere wait for the sweep.
- `tests/smoke.spec.mjs`: its chess flag test checked that a flag carries over to the next toy. Note
  5 changes that, so I rewrote that one test (the chess board still lays a flag on from above; a
  flag now stays with its toy). A shared file: please check it.
