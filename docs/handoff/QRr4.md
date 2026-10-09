# Lane QR r4 (`qr4`, Opus 5.5, high effort)

Branches: `claude/lane-qr-r4` (the lane PR, "Phase QR r4: no size flash, a real halftone Picture QR
and crisp barcodes") and `claude/lane-qr-r4-engine` (the engine PR, merged first).

## Brief

### Brief (written by the Operator on October 9, 2026, from the owner's walkthrough)

Read docs/reviews/2026-10-09-walkthrough/triage.md, section "QR r4". It is your list, and it gives
each cause with file pointers from a read-only research pass. Confirm each cause before you fix it.
The owner's own notes are private. The triage is the Operator's summary of them. Anything he didn't
mention stays as it is.

**1. First, and most urgent: the size flash.** The owner wrote that it must be fixed. The QR code
toy, Picture QR, QR from real things, Other barcodes and the QR damage lab "flash big" for about a
second whenever one opens or a setting changes, on desktop and phone.

- Cause: the automatic scan check after every build calls `withCapture` (src/app.js, about
  1645–1667). That sets a fixed square drawing size on the visible stage canvas
  (`stage.setFixedSize`, src/stage.js 275–288) and snaps the camera to a tight front view
  (`player.renderAt`, src/player.js 1926–1931). The browser stretches that square to the stage's
  shape for a few frames.
- Fix, on the engine branch: make `withCapture` never show on screen. Either cover the stage with a
  still of the current frame during the capture and remove it after a restored frame, or render to
  an offscreen target with a second camera. The cover is the smaller change. It also fixes the
  user-started exports (GIF, WebM, PDF).
- Tests: today every QR test sets `autoCheck = false`. Add a test with it on that switches to each
  of the five toys and changes a setting. Every frame for 3 s, assert the visible canvas keeps its
  size, or the cover is up whenever a fixed size is set.
- Open this engine PR as soon as it is ready. The Operator merges it after the full test run.

**2. Other barcodes.**

- Code 128's text is cut off: `textH` is 0 for Code 128 in `barcodeSplats` (src/packs/qr-craft.js,
  703–788). Give it room on the label.
- Data Matrix and Aztec are grainy: each dark module is its own patch, with seams. Reuse the QR code
  toy's crisp builder (src/qr/build.js: `TUNE`, `crisp()`, the padded cells, the underlay). You own
  `src/qr/` in this lane, so move shared helpers into a module both can use. Keep the QR code toy's
  look unchanged; prove it with a before-and-after screenshot diff.
- Every code must still scan: the zxing-cpp tests in tests/qrc-barcodes.spec.mjs.

**3. Picture QR** (src/qr-craft/picture.js and the `PICTURE` recipe in qr-craft.js).

- Remove the seams and the flashing dots:
  - one seamless grid, as build.js does;
  - a light underlay;
  - a tiny constant depth lead for dark splats, so black and white never tie;
  - redraw only while the toy turns (`alive: (c) => c.turn > 0`).
- Then rebuild the weave as a real halftone QR code, so the picture is recognizable:
  - 3×3 cells per module, the middle cell carrying the bit;
  - finders, separators, timing, alignment and format kept plain;
  - error diffusion over the whole grid, with the forced cells passing their error to free
    neighbors;
  - no per-module push; a reliability nudge only where a module would misread, stepped up until the
    existing scan check passes;
  - the mask chosen to fit the picture (`encodeQR` takes `mask`);
  - an optional larger version for more detail;
  - a color halftone for the color style.
- It must still scan. Prove it with the existing read-back tests, plus a check that the picture
  blurred over 3×3 stays close to the photo's gray.

**Clips** at phone size on Effect review page 2 (card ids `qr4-…`):

- opening each QR-family toy and changing one setting (no flash), before and after;
- Picture QR with two sample photos, before and after, in both styles;
- Code 128, Data Matrix and Aztec, before and after.

**You own:** src/qr/, src/qr-craft/, src/packs/qr\*.js, their lines in the shared lists, and
tests/qr4\*.spec.mjs. Never edit tests/taps.spec.mjs.

How this lane runs: exactly as docs/handoff/ScienceR3.md, "How this lane runs", says (read it;
replace the prefix and lane record with yours).

- **Merging:** the engine PR merges after a full test run. The QR code toy is public, so its changes
  wait for the owner's "good" marks; labs work merges after the tests and his marks.
- **Ending turns:** finish every working turn with "READY:", "WORKING:" or "BLOCKED:". Splashery has
  no CI to wait for. For a long job, schedule a check-in with send_later instead of going idle.
- **Clips:** phone size (390x844; device scale 2 is fine, since SwiftShader is slow). They go on
  Effect review page 2 (https://claude.ai/artifact/BSayVkzQ2FKESesrkrSUMK) as docs/OPERATING.md,
  "Steps for a lane", says (no republish).
- **Marks with pictures:** the owner's marks may carry `images`, screenshots he attached. Read each
  with the Artifact tool's `read` (url the page, path the asset id) before you fix that card.
- **Sounds:** new sounds go in tools/sound-review.json as "ready", not as cards.
- **Before READY:** re-read CLAUDE.md's "Effect quality rules" and check each clip against them at
  phone size.
- **Public text:** American English and the serial comma (CLAUDE.md).
- **Pace:** about eight workers are running. Your Operator is session_012GmKRUMZLir2nb27Bo8Cu2. Aim
  for the engine PR within about three hours and a first READY within about six.

## State

- Engine (`claude/lane-qr-r4-engine`): `Stage.cover()` / `uncover()` put a still of the current
  frame over the canvas while `app.withCapture` renders at a fixed size; `withCapture` covers first
  and uncovers last. tests/qr4-flash.spec.mjs fails without it (reproduced) and passes with it.
- Lane: the crisp builder moved to src/qr/crisp.js (`TUNE`, `painter()` with `flat` and `crisp`,
  `moduleGrid()` with the padded cells); build.js uses it and builds byte-identical splats (a hash
  test in tests/qr4-craft.spec.mjs). Data Matrix and Aztec draw with it. Code 128 has room for its
  text. Picture QR's weave is a real halftone (picture.js) and its splats one seamless grid.

## Notes

- Picture QR's nudge reads each module as a camera would: the module's 3 × 3 cells weighted by a
  Gaussian of 0.28 module (`cellWeights`), against half the middle gray and half the mean of the 5 ×
  5 modules around (jsQR's local threshold). The margin comes from the contrast (`marginAt`, 0.1 at
  the default 0.5); the build steps it up by 0.02 until jsQR reads the layout at the check's two
  sizes and a softer focus too (`STRICT`), and the toy steps it up by 0.04 more (three times at
  most) when its stage check fails while the layout reads.
- On the stage, dark splats sit 0.004 in front and only wholly inside dark cells, and are a little
  tighter (0.48 of the spacing against 0.55): at the full size their soft edges grew every dark dot
  and the black-and-white wildflowers code stopped reading.
- The halftone alone is within about 0.05 of the photo's gray module by module; with the default
  nudge 0.11 to 0.15 (the old weave measured 0.08 to 0.19 at its default).

## Known issues

- Picture QR builds 0.3 to 1 s slower: the build reads its own layout with jsQR while it steps the
  nudge up (measured in Node; longer on SwiftShader).
- While a capture runs, the stage shows a still of the last frame (a few frames on a phone, 2 to 3 s
  on SwiftShader).

## For the Operator

- Engine PR #472 (`claude/lane-qr-r4-engine`): 116 of 119 passed in the 17 spec files I ran with it.
  `vw` ×2 fails fetching an outside site (this container's network); `qrs-toys:37` failed once under
  load. Both are being rerun alone on main and on the engine branch.
- The container restarted once mid-lane; nothing was lost (work committed since).
