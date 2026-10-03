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
- Your handoff file: start it with this brief, word for word, under "## Brief", then keep "## State"
  current.
- Before every push: CLAUDE.md, "Before every push".

## State

Starting, October 3, 2026.
