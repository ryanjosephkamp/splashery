# Lane QR: a QR code generator made of splats (prefix `qr`)

## Brief

You are a Splashery worker session, started by the Operator (the coordinating session). Repo:
ryanjosephkamp/splashery. Your lane: QR, "A QR code generator made of splats" (prefix `qr`).
Branches: `claude/lane-qr` (and `claude/lane-qr-engine` only if the engine needs a change). PR
title: "Phase QR: a QR code generator made of splats". Handoff file: docs/handoff/QR.md. Model: Opus
5.5.

### Brief (written by the Operator on October 3, 2026, from the owner's idea of October 1 and his "go hard on it" that night)

The owner's idea, in short: a free QR code generator whose codes are made of Gaussian splats. People
can style them in ways an ordinary generator can't (colors, depth, materials, motion), and turn them
into a GIF or something interactive, while the code still scans to the same URL. He wants to review
the work when he wakes up, so get something real in front of him tonight: working codes, several
styles, scan checks, clips and cards. Function comes first: **a code that doesn't scan is a
failure**, however pretty.

#### What to build

A new toy, **QR code**, on the Studio shelf, behind the labs switch.

1. **Encoding.** Text or a URL in the Toy tab; error correction L, M, Q or H (default M, or Q for
   the fancier styles); version chosen automatically; a quiet zone of 4 modules. Use a small,
   well-known encoder: vendor Project Nayuki's QR Code generator library (MIT) in
   `vendor/qrcodegen/` with its license, or write your own against the standard with test vectors.
   Say which in the PR. Loaded only when the QR toy opens.
2. **Splats.**
   - Each dark module is a crisp, opaque cell of splats with hard edges: no blur, no speckle, no
     see-through (the effect rules).
   - The three finder patterns and the alignment patterns are their own parts.
   - Styles:
     - **Classic** (square cells);
     - **Dots** (round);
     - **Rounded** (cells that merge with their neighbors);
     - **Bricks** (raised 3D blocks with real depth);
     - **Gems** (faceted, with a glint);
     - **Bubbles** (glossy spheres);
     - **Neon** (glowing tubes, dark plate).
   - Colors: foreground and background pickers, linear or radial gradients, and a separate color for
     the finder "eyes".
   - A plate under the code: paper, wood, metal or none.

   Keep a minimum contrast between dark and light modules (warn below it, and say why). Dark on
   light is the safe default; warn that inverted codes don't scan in every reader.

3. **Scan view and a scan check.**
   - A "Scan view" button snaps the camera flat and front-on with the whole quiet zone in view.
   - "Check that it scans" renders that view and decodes it. Use the browser's `BarcodeDetector`
     where it supports `qr_code`; otherwise use a small vendored reader loaded on demand: jsQR,
     Apache-2.0, in `vendor/jsqr/` with its license.
   - Show the decoded text beside the input, with a clear pass or fail. On a fail, say what to
     change (a higher error correction, more contrast, a flatter style).
   - Run the check automatically after each change, with a short debounce.
4. **Motion.** Taps follow the effect rules: separate modules move separately, and they always come
   back to the exact grid.
   - **Assemble**: modules fly in and lock into place.
   - **Flip**: modules turn like tiles in a wave, a different color on the back.
   - **Burst and return**: on tap, the code breaks into its modules, which fall, scatter and fly
     back.

   An idle turntable is fine, but the code always ends flat and still in Scan view.

5. **Sharing.**
   - A `#s=` link holds the text and the style (old links and saved scenes must keep loading).
   - PNG of the scan view at a printable size, with the quiet zone.
   - **Animated GIF** through the existing GIF encoder (`src/exports.js`, `vendor/gifenc/`), whose
     last frames hold the code still long enough to scan.
   - Video through the existing Record export.
   - The splats themselves, through the existing splat export.
6. **Privacy.** The text never leaves the device: no shorteners, no network.

#### Proof

- `tests/qr.spec.mjs`:
  - the encoder against known test vectors;
  - **every style at its default settings decodes** from screenshots at 390×844 and 1440×900 (use
    jsQR as a pinned devDependency, or the vendored copy);
  - the GIF's last frame decodes;
  - a link round-trips;
  - nothing QR-related loads until the toy opens.
- Clips at phone size (`tools/effect-clip.mjs`) for each style and each motion, posted as cards on
  the Effect review page, with **the final frame large enough to scan from the screen**. The owner
  will scan them with his phone in the morning.
- How-to and About texts, a soft sound for assemble and burst, credits (the libraries in
  `LICENSES.md`), screenshots `qr-*-390x844.png` and `qr-*-1440x900.png`.

#### A second lane works beside you

**QR scan lab** (Sonnet 5.5, `claude/lane-qr-lab`, prefix `qrl`) builds `tools/qr-scan-lab.mjs`. It
renders codes from many angles, sizes, blurs and lighting conditions, decodes them with two readers,
and writes a scorecard that tells you which styles and settings are safe.

- **Push a first working version early** (encoding, Classic and Dots, Scan view, the check), even
  before the rest, so the lab can run against it. It reads your branch.
- Give the toy a small test hook for the lab: set the text, style, error correction and colors, and
  snap to Scan view, from `window.__splashery`. Document it in your handoff file.
- Use the lab's findings to set your defaults and warnings.
- Don't edit its files, and it won't edit yours.

#### You own

- `src/qr/` (new);
- `src/packs/qr.js` (new);
- `vendor/qrcodegen/` and `vendor/jsqr/` (new);
- `assets/toys/qr-code/`;
- your toy's entries in the shared lists (`src/toys.js`, `src/toy-sounds.js`, `src/toy-help.js`,
  `tools/toy-plan.json`, credits, `LICENSES.md`);
- `tests/qr.spec.mjs`, your screenshots, and this handoff file.

Engine changes go only through an engine PR.

#### How this lane runs

- The Operator session runs the lanes. The owner, Ryan, talks only to the Operator. Don't ask him
  anything or wait for him. Put questions and blockers in your final message ("READY:", "WORKING:"
  or "BLOCKED:"), and the Operator answers or relays them. Messages that arrive "From the Operator"
  come from the coordinator on the owner's behalf.
- Model: Opus 5.5 only, at the default effort. Any helper uses the same model, at most one at a
  time. Usage is tight this week: work efficiently, and don't burn turns waiting. Run long test runs
  in the background.
- Merging: the toy is behind the labs switch, so the Operator merges it after a full test run. Never
  merge anything yourself.
- Language: every new text is in American English (color, center, gray, license, -ize endings, dates
  like "October 3, 2026").
- Read first:
  - CLAUDE.md;
  - docs/OPERATING.md ("Steps for a lane");
  - docs/PACKS.md (recipes, budgets, text and small details, "Effect quality");
  - `src/exports.js`;
  - how another Studio toy is built (`src/packs/studio.js`).
- Your handoff file: start it with this brief, word for word, under "## Brief", then keep "## State

October 3, 2026 (Opus 5.5). First working version pushed on `claude/lane-qr` (draft PR "Phase QR: a
QR code generator made of splats"). No engine change was needed.

### What is built

- **The toy**: "QR code" (`qr-code`) on the Studio shelf, labs only (`src/toys.js`), recipe in
  `src/packs/qr.js`, the rest in `src/qr/`:
  - `encode.js`: the encoder. Project Nayuki's QR Code generator library (MIT), vendored in
    `vendor/qrcodegen/` (compiled from its TypeScript, commit `3c6d0b3`, with an ES module export
    added). It marks each module's role and the finder and alignment patterns as their own pieces.
  - `build.js`: the splats. Seven styles (Classic, Dots, Rounded, Bricks, Gems, Bubbles, Neon), each
    with its own preset colors and plate (`PRESETS`); foreground, background, linear or radial
    gradient, eye color, plate (paper, wood, metal, none), the flip's back color.
  - `field.js`: the motions, as a labs GPU program (the toy's `gpuField`, as in the Lab toy): every
    module, finder and alignment pattern moves as one solid piece and ends exactly on its grid.
  - `scan.js`: the reader: `BarcodeDetector` where it reads `qr_code`, else jsQR 1.4.0 (Apache-2.0,
    `vendor/jsqr/`), loaded by a script tag on the first check.
- **The panel** (the Toy tab, through `input.live: [{ render }]`, so no engine change): the text
  box, the style row, what the code is (version, size, level), the contrast and inverted-code
  warnings, Scan view, "Check that it scans" (also run by itself about 0.6 s after each change),
  Save a PNG (1600 px, scan view with the quiet zone) and Save a GIF (the burst, then 1.6 s held
  still). Record and Save splats are the site's own (Share tab).
- **Error correction**: Auto is M for Classic and Q for the other styles; L, M, Q and H can be
  picked. The library may raise the level for free when the text fits the same version (the panel
  says so).
- **Motions** (Toy tab buttons; a tap is Burst): Assemble (3.2 s), Flip (3.4 s), Burst and return
  (3.6 s). Their sounds go out as cues from `drive` (`SOUNDS` in the pack); the tap's own entry in
  `src/toy-sounds.js` is the burst.

### How the codes are kept scannable (what the checks taught)

- **No ripple inside dark areas.** A patch of flat splats on one grid leaves a faint lattice (about
  20 gray levels); jsQR thresholds 8-pixel blocks against their own range, so that ripple became
  speckle. Every patch is two staggered lattices now (`flat()` in `build.js`).
- **No seams between modules.** Each module's patch reaches into its dark neighbors (`cell()`), so a
  run of modules is one dark area.
- **3D shading within limits.** A face seen front on may stray at most 0.03 in gray from its
  module's color (`steady()`, `SHADE_TOL`): jsQR takes an 8-pixel block whose range is under 24 gray
  levels as flat and thresholds anything wider at its own mean, so a highlight inside a big dark
  area turned white. Sides seen only at an angle keep full shading. Neon's tube cores too. Gems,
  bubbles and bricks sit on a dark setting, so their gaps read dark.
- **Solid finders.** In Bricks, Gems, Bubbles and Neon the finder and alignment patterns are smooth
  solid pieces with a bevel only on their outer edges: readers find a code by the 1:1:3:1:1 runs
  across them, and bevels or seams inside broke those runs at desktop size.
- **The sheet has holes under the dark modules**, in splats as fine as the modules'. Seen at an
  angle, a big sheet splat behind a module sorted in front of it and the code turned gray and
  hatched.
- **The check reads at two scales**: the 720 px picture, then half size (as phone readers try
  several scales). The result says which (`reader: "jsQR, at half size"`).
- **One check at a time**: a check asked for cancels the pending automatic one, and a second call
  waits for the running one (the automatic check's capture once landed in a screenshot).
- Neon is an inverted code (light on dark). It reads in jsQR and the panel warns that not every
  reader takes inverted codes.

### The test hook (for the QR scan lab)

With the QR code toy open (`window.__splashery.app.chooseToy("qr-code")`, labs on):

```js
const qr = window.__splashery.qr;
await qr.set({ text, style, ecc, fg, bg, gradient, fg2, eyes, eye, plate, back }); // any subset
// A style alone brings its preset colors and plate; colors given with it win.
// ecc: "auto" | "L" | "M" | "Q" | "H"; style: classic | dots | rounded | bricks | gems | bubbles | neon
// gradient: none | linear | radial; eyes: same | own; plate: paper | wood | metal | none
qr.scanView(); // the camera flat and square to the code, quiet zone in view
qr.scanPose(margin); // that camera state ({ yaw, pitch, roll, distance }), margin in modules
qr.screenRect(); // the code's square with its quiet zone on the page (CSS pixels)
await qr.check(); // renders the scan view at 720 px and reads it back:
// { ok, read, reader, inverted, text }
await qr.png(size); // the scan view as a PNG blob (default 1024 px; not downloaded)
await qr.gif({ motion, size }); // the GIF as a blob ("burst" | "flip" | "assemble" | "alive")
qr.info(); // { text, version, size, ecc, style, options, check, warnings, error }
```

`set` also takes `{ kind, fields: { … } }` for what the code holds (kinds: link, text, wifi,
contact, email, phone, sms, geo; field names in `src/qr/content.js`), and `style: "neon-light"` for
Neon on a pale wall. `qr.autoCheck = false` stops the automatic check after each change (for tools
that step the stage's clock themselves; it can deadlock with them), `qr.fullScreen()` opens Full
screen.

`set` resolves once the toy is rebuilt and in scan view. The automatic check runs after it; call
`check()` yourself for a result you can wait on.

### Proof

- `tests/qr.spec.mjs`: the encoder against segno's codes (`tests/fixtures/qr-vectors.json`, the ISO
  "01234567" 1-M and "HELLO WORLD" 1-Q) and jsQR read-backs of codes from version 1 to 16; nothing
  QR-related loads before the toy opens; every style at its defaults reads back with jsQR from
  screenshots at 390×844 and 1440×900 (framed on the code, as a phone frames it: the page's own
  title over the stage otherwise trips jsQR's finder search) and in the toy's own check; the GIF's
  last frame (and the frame 1.2 s before it) reads back, a frame mid-burst doesn't; the PNG is 1024
  px and reads back; a `#s=` link round-trips the text, style, level and eye color; the warnings.

- On screen, Scan view leaves 3 modules past the quiet zone; the toy opens in that view (camera
  distance 3.1 radii, the same for any screen, since the field of view spans the narrower side).

### Round 2 (October 3, 2026, from the Operator's notes on the clips)

- **Gems**: the glint passes only when the code is seen at an angle (the GPU program reads the
  camera's position, `uSpCam`); front on, in Scan view, in the PNG and in a GIF's still frames, no
  module ever goes pale. It is compiled into the program only for Gems.
- **Neon** is now connected tubes (each module draws half a tube to each dark neighbor) with a
  bright core and a faint halo on the dark wall; the finder and alignment patterns are solid glowing
  pieces. Measured at module centers in the check's 720 px render (default link): tubes 0.80 to 0.88
  gray, gaps 0.03 (halo included), so a margin of 0.76.
- **Neon on a pale wall** (`style: "neon-light"` in the hook; one button in the panel when Neon is
  picked): deep blue tubes and magenta eyes on a pale wall, dark on light, so every reader takes it.
  Measured: tubes 0.26 to 0.37, wall 0.94 (margin 0.58).
- **Alive** (a toggle in the Toy tab, and "Save a looping GIF"): a color wave rolls across the code.
  Each splat's hue moves toward the style's wave color (`wave`, set by each preset) while its gray,
  what a reader sees, stays the same, so every frame scans; the pieces also breathe in depth, which
  shows when the code is turned. The looping GIF is one whole period (44 frames). Every frame of
  every style's loop reads back with jsQR (`tests/qr.spec.mjs`). The eyes don't turn: a finder
  turned partway is no longer a finder, and jsQR lost the code on those frames.
- The check could hand back an earlier check's result (one still running for the code before a
  change); now a check counts only for the code built last.
- The GIF's frame times grew with each frame (each `renderAt` read back the time the last one set);
  they are fixed steps from the start now.

- **What it holds** (`src/qr/content.js`): Link, Text, Wi-Fi network, Contact card (MECARD), Email
  (`mailto:`), Phone (`tel:`), Text message (`SMSTO:`) and Place (`geo:`), each a small form in the
  panel that builds the standard text, with Wi-Fi and MECARD escaping. The form is kept in the
  hidden options `kind` and `fields` (JSON); the **Wi-Fi password is never in the options**, so
  never in a `#s=` link or a saved scene. It stays in the page's memory, and a Wi-Fi code opened
  from a link warns that its password must be typed again. The panel says plainly that a link and a
  saved scene carry what the code holds.
- **Full screen** (a panel button; `qr.fullScreen()` in the hook): the code alone in Scan view on
  its own background, filling the screen, so another phone can scan it. Esc or a tap closes it.
- **Defaults from the scan lab's provisional scorecard** (reference drawings, not this toy; to be
  replaced by its measurements of the toy): Auto error correction is M for Classic and H for the
  shaped styles; the contrast warning is at 4.5:1 for Classic, Dots and Rounded and 7:1 for Bricks,
  Gems, Bubbles and Neon; a warning shows when the code is drawn under about 4 pixels per module on
  the screen.

### Clips and cards

Eleven cards on Effect review page 2 (lane id `QR`, ids `qr-<style>-<motion>`), posted on October 3,
2026: Burst for all seven styles, Flip for Classic and Gems, Assemble for Dots and Neon. Each is a
480 px MP4 seen from a little above while it moves, then a glide into Scan view and 2.5 s held
still, so the last frame can be scanned from the screen. Every last frame (MP4 included) reads back
with jsQR. They were made with a lane script like `tools/effect-clip.mjs` (same stepped clock) but
with labs on (the motions are a labs GPU program, and the shared tool opens the app without labs)
and the scan-view camera; it lives in the session's scratch space, not the repo. There is no
`lanes/QR` record on the page yet (the Operator makes it); the cards show under the id "QR" until
then.

### Next

- The QR scan lab's scorecard: set the defaults and warnings from it.
- The owner's marks on the cards.
