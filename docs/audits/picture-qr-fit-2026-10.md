# Picture QR fit

October 14–15, 2026. Codex (GPT-6) built this for Ryan under Splashery's MIT license. Rule check:
none.

## Behavior and compatibility

An opened picture gets a crop preview with touch and mouse dragging, arrow-key movement, a 1×–4×
zoom slider, Reset crop, Cancel, and Use this crop. Fit the square code keeps the whole picture in
the encoded square with light padding, with zoom for a closer crop. Fill the whole circle uses the
same source coordinates for the square and the outer disc. The clear band around the encoded square
remains clear.

Only `cropX`, `cropY`, `cropZoom`, and `pictureFit` are saved. Pixels and file names stay out of the
scene and share link. Reopening the missing picture after loading a saved scene retains its crop.
Choosing another picture in a tab that already has one resets the crop; Reset crop also centers it
at 1×.

Old recipes resolve to `pictureFit: legacy`, `circleBorder: legacy`, and `eyeShape: style`. The
original integer center crop, four-module margin, source colors, and style-dependent eyes remain the
default. The new controls preserve the payload, version policy, and error correction. Explicit new
border and eye choices use mask 0; legacy choices retain the original mask selection. A focused
replay with mask 0 passed all 16 plain-code captures that had failed zxing-js with the previous
selection. The [initial screening data](picture-qr-fit-2026-10-mask-screen.json) retain the
incomplete pre-mask counts and focused replay. The complete qualification below records the final
recipes across the entire grid.

Thinner border candidates use the same deterministic decoration layout at the selected margin. Only
a two-module band beside the code is remapped to `0.94 + 0.06 × color`; the rest of the ring keeps
its original colors. The earlier one-module band passed a 288-capture screening grid but failed the
expanded picture trials. The final band is two modules wide, and new Picture QR geometry starts with
`extra: 0.28` for its reliability nudge. The original nudge limits, scan sizes, blur levels, and
subsequent stage retries are retained. A larger forced center leaves less halftone picture detail in
new Circle geometry. The full-color, four-module border and style-driven eyes remain the
compatibility default.

Square eyes use the original 7×7 finder. Rounded eyes use outer, hole, and center corner radii of 1,
0.65, and 0.5 modules. Circular candidates use concentric radii of 3.5, 2.5, and 1.5 modules. The
latter preserve the axial dark/light center runs but must qualify with all three readers. Every
other functional pattern and every encoded data module is unchanged.

Small Circle budgets use one forced-center tint per module, continuous finder patches, a coarser
backing, and complete decoration, instead of truncating or rejecting an otherwise representable
code. The interface identifies the reduced picture detail. Impossible fine grids are skipped before
allocation. This also addresses the pre-existing circular Picture QR failure in the 8,000-splat kit
check.

The existing built-in scan checks remain in place. A failed or delayed check keeps the previous
frame behind the scanning cover until a successful retry; the time limit no longer unveils a failed
code. The crop editor and code controls remain available for recovery. The QR toys' PNG, GIF, and
full-screen actions refuse a failed check, and a stale check cannot uncover a later build. Switching
to another toy releases only the departing toy's cover; a newly loaded QR keeps its own guard.

## Study protocol

`tools/cdx-qr-fit-study.mjs` uses all 20 payloads and all four error-correction levels from
`tools/cdx-circle-study.mjs`, then all 32 current Picture QR samples with all five payloads from
`tools/cdx-pics-links.mjs` at the existing H/more/color/small-center defaults. There are 80 plain
codes and 160 picture codes per candidate. Pictures use the original sample crop, matching the saved
recipes: the center square for Square, and the original integer crop from the full disc for Circle.
New own-picture crops are checked in the browser evidence and by the built-in check on each build.

Plain codes use classic dark ink and a white backing. Custom colors and other style palettes are
outside this controlled grid; they still have to pass the built-in render check.

Each candidate gets 390 px, 600 px, 8 pixels per module, and 4 pixels per module captures. Every
size is checked clean; with Gaussian blur at 0.12 module; with perspective (8° yaw, 12° pitch, and
5° roll); with that perspective plus 0.12-module blur; and with 0.2- and 0.3-module blur. This
preserves the previous 640-trial margin grid as a subset and adds smaller sizes, softer focus,
pictures, and the C++ reader. Each candidate has 5,760 trials. The 17 candidates include Rounded
eyes at each thinner margin, for 97,920 candidate/trial combinations and 293,760 recorded reader
outcomes. In the CPU rasterizer, Wide pale borders and Square eyes on Circle have identical pixels;
their results are reused explicitly, giving 92,160 distinct image evaluations in a fresh run.

The readers are jsQR 1.4.0, zxing-js 0.21.3, and zxing-cpp through zxing-wasm 3.1.4. Success means
exactly the encoded payload. jsQR and zxing-js use the existing full-frame orientation/resampling
retries in `readBoth`; direct-read counts are also retained. zxing-cpp uses its existing defaults.
zxing-js retains `TRY_HARDER`; the C++ wrapper retains its QR-family filter and four-symbol limit,
with default rotation, inversion, and downscaling. There are no crops, finder coordinates, payload
hints, or relaxed thresholds given to a reader.

The encoded square uses the production four-sample-per-axis pixel averaging; Picture QR uses its
actual woven cells. The round decoration uses the production layout and source sampling. The study's
faster Gaussian blur is checked byte-for-byte against the existing simulator's pixels. The CPU
picture loader uses JPEG-js and nearest-neighbor downscaling to 640 px; the browser uses Canvas
decoding and resampling. These are controlled CPU simulations; finished browser renders are checked
separately.

A new border is eligible only when all three readers pass every trial. An alternate eye shape is
eligible only where every reader passes every phone trial (390 px and 8 pixels per module). The full
print and small-size results are retained even when they are not the eye eligibility criterion.
Eligibility is recorded separately for plain QR and Picture QR, and for Square and Circle. Picture
QR retains its original eyes in Square mode because the alternate Square and Rounded candidates fail
the phone grid on some pictures. Circular eyes and the 2- and zero-module borders are withheld. The
2-module band candidate and its Rounded combination each fail zxing-js for the pumpkin sample with
the long botanical-study URL at 8 pixels per module under perspective; the 1-module candidate passes
those captures. Existing legacy defaults are preserved rather than relabeled as newly qualified.

To reproduce the complete qualification from the repository root:

```sh
node tools/cdx-qr-fit-study.mjs --jobs=4
```

`--resume=.cache/picture-qr-fit-rows.jsonl` reuses complete, compatible trial groups after an
interruption. Old crop, band, or geometry settings are rejected when they change the pixels. Resume
assumes unchanged image-generation and reader logic; clear the checkpoint after changing that logic.
The qualification spec rejects quick runs, subsets, incomplete totals, and failed new choices.

## Qualification results

Wide (4 modules, pale band) and Thin (1 module, pale band) each pass all 5,760 trials in all three
readers. Medium (2 modules) fails one zxing-js trial and is unavailable; None also fails. Rounded
eyes qualify on both QR code shapes and on Circle Picture QR. Square Picture QR retains its original
eyes. Circular candidates fail phone trials and are unavailable.

The [complete data](picture-qr-fit-2026-10-study.json) contain 97,920 candidate/trial combinations
and 293,760 recorded reader outcomes (92,160 distinct image evaluations because identical
Wide/Square-on-Circle CPU rasterizations are reused). Every image must return the exact payload.
Counts include the existing orientation and resampling retries; direct counts and every failed
capture are retained in the data.

| Candidate             | jsQR                  | zxing-js              | zxing-cpp             | All three             |
| --------------------- | --------------------- | --------------------- | --------------------- | --------------------- |
| border-4-original     | 5,701/5,760 (98.98%)  | 5,679/5,760 (98.59%)  | 5,712/5,760 (99.17%)  | 5,597/5,760 (97.17%)  |
| border-2-original     | 5,679/5,760 (98.59%)  | 5,682/5,760 (98.65%)  | 5,733/5,760 (99.53%)  | 5,611/5,760 (97.41%)  |
| border-1-original     | 5,683/5,760 (98.66%)  | 5,674/5,760 (98.51%)  | 5,739/5,760 (99.64%)  | 5,601/5,760 (97.24%)  |
| border-0-original     | 1,843/5,760 (32.00%)  | 1,105/5,760 (19.18%)  | 2,472/5,760 (42.92%)  | 999/5,760 (17.34%)    |
| border-4-pale         | 5,760/5,760 (100.00%) | 5,760/5,760 (100.00%) | 5,760/5,760 (100.00%) | 5,760/5,760 (100.00%) |
| border-2-pale         | 5,760/5,760 (100.00%) | 5,759/5,760 (99.98%)  | 5,760/5,760 (100.00%) | 5,759/5,760 (99.98%)  |
| border-1-pale         | 5,760/5,760 (100.00%) | 5,760/5,760 (100.00%) | 5,760/5,760 (100.00%) | 5,760/5,760 (100.00%) |
| border-0-pale         | 5,760/5,760 (100.00%) | 5,702/5,760 (98.99%)  | 5,760/5,760 (100.00%) | 5,702/5,760 (98.99%)  |
| eyes-square-square    | 5,646/5,760 (98.02%)  | 5,691/5,760 (98.80%)  | 5,632/5,760 (97.78%)  | 5,606/5,760 (97.33%)  |
| eyes-square-circle    | 5,760/5,760 (100.00%) | 5,760/5,760 (100.00%) | 5,760/5,760 (100.00%) | 5,760/5,760 (100.00%) |
| eyes-rounded-square   | 5,751/5,760 (99.84%)  | 5,696/5,760 (98.89%)  | 5,632/5,760 (97.78%)  | 5,632/5,760 (97.78%)  |
| eyes-rounded-circle   | 5,760/5,760 (100.00%) | 5,760/5,760 (100.00%) | 5,760/5,760 (100.00%) | 5,760/5,760 (100.00%) |
| eyes-circle-square    | 5,696/5,760 (98.89%)  | 5,696/5,760 (98.89%)  | 4,868/5,760 (84.51%)  | 4,868/5,760 (84.51%)  |
| eyes-circle-circle    | 5,760/5,760 (100.00%) | 5,760/5,760 (100.00%) | 4,889/5,760 (84.88%)  | 4,889/5,760 (84.88%)  |
| eyes-rounded-border-2 | 5,760/5,760 (100.00%) | 5,759/5,760 (99.98%)  | 5,760/5,760 (100.00%) | 5,759/5,760 (99.98%)  |
| eyes-rounded-border-1 | 5,760/5,760 (100.00%) | 5,760/5,760 (100.00%) | 5,760/5,760 (100.00%) | 5,760/5,760 (100.00%) |
| eyes-rounded-border-0 | 5,760/5,760 (100.00%) | 5,700/5,760 (98.96%)  | 5,760/5,760 (100.00%) | 5,700/5,760 (98.96%)  |

Phone eligibility combines 390 px and 8 pixels per module, including every condition. Eligibility is
specific to each toy and shape.

| Toy        | Eyes    | Shape  | jsQR                  | zxing-js              | zxing-cpp             | Eligible |
| ---------- | ------- | ------ | --------------------- | --------------------- | --------------------- | -------- |
| QR code    | square  | square | 960/960 (100.00%)     | 960/960 (100.00%)     | 960/960 (100.00%)     | Yes      |
| Picture QR | square  | square | 1,845/1,920 (96.09%)  | 1,856/1,920 (96.67%)  | 1,856/1,920 (96.67%)  | No       |
| QR code    | square  | circle | 960/960 (100.00%)     | 960/960 (100.00%)     | 960/960 (100.00%)     | Yes      |
| Picture QR | square  | circle | 1,920/1,920 (100.00%) | 1,920/1,920 (100.00%) | 1,920/1,920 (100.00%) | Yes      |
| QR code    | rounded | square | 960/960 (100.00%)     | 960/960 (100.00%)     | 960/960 (100.00%)     | Yes      |
| Picture QR | rounded | square | 1,911/1,920 (99.53%)  | 1,856/1,920 (96.67%)  | 1,856/1,920 (96.67%)  | No       |
| QR code    | rounded | circle | 960/960 (100.00%)     | 960/960 (100.00%)     | 960/960 (100.00%)     | Yes      |
| Picture QR | rounded | circle | 1,920/1,920 (100.00%) | 1,920/1,920 (100.00%) | 1,920/1,920 (100.00%) | Yes      |
| QR code    | circle  | square | 960/960 (100.00%)     | 960/960 (100.00%)     | 801/960 (83.44%)      | No       |
| Picture QR | circle  | square | 1,856/1,920 (96.67%)  | 1,856/1,920 (96.67%)  | 1,574/1,920 (81.98%)  | No       |
| QR code    | circle  | circle | 960/960 (100.00%)     | 960/960 (100.00%)     | 899/960 (93.65%)      | No       |
| Picture QR | circle  | circle | 1,920/1,920 (100.00%) | 1,920/1,920 (100.00%) | 1,478/1,920 (76.98%)  | No       |

Each border requires all 5,760 trials to pass in all three readers. Rounded eyes with thinner
borders are checked as separate candidates. Legacy appearance remains the default for compatibility;
unlightened controls that fail the expanded grid are not described as newly qualified.

## Browser verification

The browser is installed Chromium 151.0.7922.173 on Debian. Original review captures and the
main-versus-branch buffer comparison use the repository's SwiftShader configuration; the AI
background regression selection uses Mesa llvmpipe under Xvfb. Browser work uses the repository's
Playwright workflow. The flow is Picture QR → open a picture → drag or zoom the crop → apply → scan
→ save and reopen its settings. Phone and desktop review sizes are 390×844 and 1440×900. Picture QR
review frames use H and Fit size, and QR code review frames use its default Auto correction.
Separate finished-render tests request and verify H explicitly. The complete picture grid uses the
existing H/More defaults. Desktop editor views use the public Shelf height control to make room for
the preview and actions.

The new regression file covers crop bounds, shared disc coordinates, legacy integer sampling,
encoded data preservation, scene/share metadata, mouse/touch/keyboard editing, reopening a missing
picture with its saved crop, and scan-cover failure and recovery. It also reads finished QR and
Picture QR renders with all three readers after selecting Square and Circle, alternate eyes, and
thinner borders. The cover failure test injects a blank render; scan qualification and render checks
use real readers and actual generated pixels.

## Scope and limitations

No source picture, decoder, library, or tap test is added or replaced. Source sampling and the crop
editor live in new `src/qr-craft/` files. The core halftone implementation in
`src/qr-craft/picture.js` is unchanged, keeping task 79's main work separate. Shared integration
points are the Picture QR build/panel in `src/packs/qr-craft.js`, circular extent helpers in
`src/qr/circle.js`, and the QR builder in `src/qr/build.js`. Task 79 had no open PR when checked
during implementation. Re-run qualification with a fresh checkpoint after integrating halftone or
geometry changes from that task.

The grid is a controlled set of digital captures, not a physical camera or printer study. It does
not prove every possible uploaded picture, color scheme, or camera will scan. A new upload still has
to pass the toy's actual built-in check. The owner's visual review of each new option is required
before merge; the PR remains a draft. Review images go only on the clips branch.

## Implementation record

- Task: Codex 80, Picture QR fit. Toys: `qr-code` and `qr-picture`.
- Status: implemented for review; branch `codex/picture-qr-fit`. Screenshots belong only on
  `codex/picture-qr-fit-clips`.
- Made by Ryan with Codex (GPT-6), under the MIT license. No new library, source asset, or asset
  conversion ships.
- Existing recipe hooks and Kit APIs are retained. Geometry uses one module per unit, +Y up, +Z
  toward the camera, and quaternion order x, y, z, w. Existing module and finder pivots drive their
  existing motions.
- Generation is deterministic. The study uses the existing circular layout, QR encoder, halftone
  weave, capture simulator, and readers.
- Environment: managed Debian container, installed Chromium 151, software WebGL2. The study and
  original verification used Node 24.19.0; review regression checks use Node 22.23.3 to match CI.
  The AI background selection uses Mesa llvmpipe under Xvfb with two Playwright workers.
  Physical-device performance, memory, and frame rate are unmeasured.
- Node pack checks: QR code 158,428 splats and Picture QR 122,602 splats. The compact Circle render
  is also checked at an 8,000-splat budget with all three readers.
- The shared-builder Square fixture retains main's original fingerprint,
  `b3918a78fddc50518d2fef2cecb12cee1cf3b16b05a450e61a166fb39b482144`, and its original comment. That
  fingerprint matches both main and this branch under Node 22, which CI uses. The initial Node 24
  comparison did not justify replacing the fixture; the claim that it was stale was incorrect.
- A second full-output fixture covers raw legacy Circle builds across the same two payloads, seven
  styles, and two plates, with no `eyeShape` or `circleBorder` defaults supplied. Main `c00e1cb8`
  under Node 22 produces `51848ddea445d56959c8558a2dd4682e8d688bae3fde5f232e7c1b51448a95fb`. The
  regression test catches extra decoration dots from an undefined `pale` value; `borderSettings` now
  always returns a boolean for that flag. Explicit new options retain their existing behavior.
- No thresholds were lowered, tap tests were not edited, and source picture pixels are never
  included in saved metadata.

The help overlap fixture refreshes the visible hint through its public button before measuring its
box. This prevents its existing auto-hide timer from expiring between the visibility assertion and
the bounding-box read. The same pixel-overlap assertion remains in place, and the separate auto-hide
tests are retained.

The Picture QR tap fixture now waits until the ripple actually settles before reading its final
frame. This keeps both exact-payload assertions while avoiding a fixed 4.5-second wall-clock
assumption under software rendering.

## AI background compatibility follow-up

The existing `cdx-pics` five-link browser test reproduced a long-link regression on the Split leaf
background with legacy Square settings. At the normal Mid budget of 240,000 splats, the longest link
makes a 77-module code whose final halftone lattice contains 243,086 splats. Main lets the Kit clip
the last 3,086 samples from that lattice. Task 80 instead replaced it with the compact tier, which
changed the picture and failed the 330-px phone, blurred 900-px print, and 8-pixel-per-module
checks. Its 4-pixel-per-module check passed. The crop, border, and eye defaults were unchanged.

Square now retains its final halftone lattice and the Kit's existing budget clipping. Finer grids
whose encoded points alone exceed the budget are still skipped before allocation. The compact tier
is restricted to Circle, where it keeps the encoded square and complete ring within the budget.

For the short and longest links, the fixed Split leaf render has byte-identical position, color,
animation, and scale buffers to main `c00e1cb8`. Both captures pass all four existing rendered
trials. This comparison used Node 22.23.3, Chromium 151, and SwiftShader. The full five-link browser
selection passed all 24 backgrounds with its original assertions: five links each, four jsQR render
conditions, the production scan, credits, lazy loading, and the actual longest-link PNG export.

`node tools/shw-facts.mjs` regenerated the showcase facts for this checkout, and the existing
measured-facts test passed. No scan threshold, test assertion, splat budget, or source picture
changed.

## Completed checks

The follow-up selected 210 cases across 25 spec files: the 185 required cases, all 24 five-link
background cases, and the measured-facts test. Under Node 22.23.3 and Mesa with two workers, 208
passed, two failed, and none were skipped. The procedural-generator smoke case saved seed 1 instead
of 4242; it passed unchanged in a fresh SwiftShader process. The Damage lab's fixed-set meter test
timed out at its existing 600-second limit under Mesa and again under SwiftShader while the smoke
run was active. Its final quiet, one-worker SwiftShader recheck passed unchanged in 9.5 minutes. All
210 selected cases therefore passed across the main run and unchanged rechecks, with no skips.

Both full-output fingerprints match main. The new raw Circle regression first failed on the
extra-dot output and passed after the boolean fix. The complete kit loop covered all 394 toys and
their choices twice in 8.7 minutes under its original 600-second timeout. The qualification study
completed October 14, 2026, at 8:30 p.m. EDT; its generator, data, and reader thresholds are
unchanged by this follow-up.

The 44-image
[review set](https://github.com/ryanjosephkamp/splashery/blob/codex/picture-qr-fit-clips/tests/screenshots/cdx-qr-fit-review.md)
contains 36 finished-code frames, four crop-editor views, and four option-panel views. Every
finished-code frame passed its built-in check and all three readers at 390 px. The editor views also
verify the crop preview, zoom, and action buttons fit the scrollable panel.

The required specs plus all five-link background cases and the measured-facts check, run with Node
22 to match CI, are:

```sh
DISPLAY=:98 SPLASHERY_GL=llvmpipe SPLASHERY_PORT=4175 SPLASHERY_CHROMIUM=/usr/bin/chromium npx playwright test tests/qr*.spec.mjs tests/cdx-circle-qr.spec.mjs tests/cdx-qr-*.spec.mjs tests/kit.spec.mjs tests/smoke.spec.mjs tests/help.spec.mjs tests/hta.spec.mjs tests/cdx-pics.spec.mjs:119 tests/shw.spec.mjs:34 --workers=2
```

The final standalone meter recheck uses SwiftShader with no other browser job:

```sh
SPLASHERY_GL= SPLASHERY_PORT=4175 SPLASHERY_CHROMIUM=/usr/bin/chromium npx playwright test tests/qrs-toys.spec.mjs:85 --workers=1
```

`node tools/check-packs.mjs qr qr-craft` passed without concurrent browser load; the default QR
build took 605 ms against its 1.5-second limit. `node tools/shw-facts.mjs --check`,
`npx prettier --check .`, and `node tools/us-english.mjs --diff` passed. Thumbnails were
regenerated, and their contact sheet was reviewed. The cover tests retain failed-code protection
through retries, stale checks, and a switch to another toy while preserving any unrelated cover.

Main advanced to `c00e1cb8` with CI tooling and documentation during verification. Those updates
were merged into this branch; the application and required test files are unchanged by that
integration.
