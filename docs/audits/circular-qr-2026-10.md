# Circular QR codes: task 69

October 13, 2026. Made by Ryan with Codex (GPT-6). Code is offered under Splashery's MIT license;
original procedural circle geometry is CC0. Proof images and thumbnails retain the licenses of their
underlying toy and sample assets.

## Result and limits

Circle is available in QR code, Picture QR, How a QR code works, QR damage lab, and the marble and
flip-tile builds. The encoded square remains separate from a clear margin and decorative modules on
the same grid. Square remains the default. PNG, GIF, and saved scene recipes retain the Circle
option.

**No tested quiet zone reached the requested 100% threshold across both decoders and all
conditions.** Four modules remain the conservative default. This is a deviation from the requested
minimum-margin selection; these results do not certify arbitrary circular codes for printing.
**Phone camera apps were not tested in the cloud.**

The anatomy modules now use crisp splat contours, and pop-out is enabled by default. RGB modules use
the same crisp contours and inside-corner clipping. The broad stationary white stripes described in
the brief were not reproducible in Chromium WebGL2; the measured improvement is edge sharpness and
reduced lattice scalloping, not a demonstrated fix for those broad stripes.

## Quiet-zone study

The [QR sizing guide](https://www.qrcode.com/en/howto/code.html), opened on October 13, 2026,
specifies a clear four-module margin on each side. The study tests 1, 2, 3, and 4 modules, including
the intentionally nonstandard candidates.

Readers: the unchanged vendored jsQR 1.4.0, and the existing pinned test dependency `@zxing/library`
0.21.3. ZXing is already listed in `LICENSES.md`; its
[versioned license](https://github.com/zxing-js/library/blob/v0.21.3/LICENSE) was opened and checked
as Apache-2.0. No decoder dependency, library update, or new vendor file was shipped.

The corpus contains 20 distinct links, listed completely in
[the results JSON](circular-qr-2026-10-study.json). Each is encoded at L, M, Q, and H with ECC
boosting disabled. Every margin has 640 trials: 20 links × 4 levels × 2 sizes × 4 conditions. Total:
2,560 complete images tested with two independent readers.

Phone size is 390 × 390 pixels. Print size is a 600 × 600-pixel image, corresponding to a two-inch
print at 300 dpi; no physical prints were made. Conditions are clean, Gaussian blur with sigma 0.12
module, a perspective projection with yaw 8°, pitch 12°, and roll 5°, and that projection plus the
same blur. The model is a raster of the shared Classic module layout and border; it does not
simulate glare, camera exposure, ink spread, or every artistic style.

The direct columns use one decoder pass. The retry columns allow whole-image rotations by 90°, 180°,
and 270° and resampling at 0.875, 1.125, and 1.5 times the input resolution when a reader returns no
result. The complete decoration and border stay in every image. No crop, known text, module
coordinates, or known finder locations are passed to either reader. The fallback processing is
test-only and is not added to the application's scanner.

| Quiet zone | Direct jsQR      | Direct ZXing     | jsQR with retries | ZXing with retries | Both with retries |
| ---------- | ---------------- | ---------------- | ----------------- | ------------------ | ----------------- |
| 1          | 630/640 (98.44%) | 503/640 (78.59%) | 634/640 (99.06%)  | 621/640 (97.03%)   | 621/640 (97.03%)  |
| 2          | 637/640 (99.53%) | 533/640 (83.28%) | 640/640 (100.00%) | 634/640 (99.06%)   | 634/640 (99.06%)  |
| 3          | 617/640 (96.41%) | 536/640 (83.75%) | 622/640 (97.19%)  | 616/640 (96.25%)   | 616/640 (96.25%)  |
| 4          | 634/640 (99.06%) | 567/640 (88.59%) | 640/640 (100.00%) | 634/640 (99.06%)   | 634/640 (99.06%)  |

| Quiet zone | Phone: both readers with retries | Print: both readers with retries |
| ---------- | -------------------------------- | -------------------------------- |
| 1          | 310/320 (96.88%)                 | 311/320 (97.19%)                 |
| 2          | 320/320 (100.00%)                | 314/320 (98.12%)                 |
| 3          | 302/320 (94.38%)                 | 314/320 (98.12%)                 |
| 4          | 320/320 (100.00%)                | 314/320 (98.12%)                 |

For both the two- and four-module candidates, the remaining six failed trials were ZXing on level-H
print-size perspective images and their blurred counterparts, at corpus indices 9, 12, and 13. jsQR
read all four-module images after the stated retries. Single-pass ZXing is substantially less
reliable; the retry figures must not be presented as its single-pass performance.

Reproduce with `node tools/cdx-circle-study.mjs`.

## Geometry and toy behavior

- Decoration stays outside the clear square margin and inside the circular border. Its occupied-cell
  fraction targets the encoded code's dark-to-light fraction. Tests check the margin, border
  clearance, and balance across 20 independent inputs. Full horizontal and vertical runs are
  screened for the finder ratio, including the reader's approximate ratio tolerance, with and
  without the border. This prevents a decorative square finder and finder-like runs along the real
  finder axes; the decoder study still reveals the practical limits of that protection.
- QR code paints decorative cells through each of its existing style builders. Its circular paper,
  wood, and metal backing retain the chosen material. Scan and export cameras include the circular
  extent; the scene JSON retains `shape: "circle"`.
- Picture QR samples one picture across the entire sticker: the square weave uses the matching
  center crop, while dark and light decorative regions use the same picture coordinates. Only the
  true quiet zone is painted plain white. Code splats have priority over decoration in the budget;
  large circles coarsen the decorative paper and dots first. If a complete picture grid still cannot
  fit, the toy gives a clear capacity error rather than silently dropping data modules. A
  300-character/H regression checks every emitted module at the large circular extent; overlong
  saved text keeps the existing encoder fallback.
- Anatomy has a teal decoration key beside the quiet-zone key, with the exact text “decoration:
  carries no data.” Modules use narrow contour splats and an opaque interior; pop-out is enabled by
  default.
- Damage keeps the normal tools aimed at the encoded square. “Erase decoration” removes only
  decorative dots: both readers still decode the same text, and the module analysis reports zero
  changed bits. Covering a finder prevents the jsQR read and produces incorrect modules. Four-level
  comparison circles coarsen their paper and decoration to preserve their data budget; the decoder
  proof here covers the single-code Circle view.
- The marble and flip-tile builds use their own physical pieces for decoration. Decorative pieces
  stay still. Incoming marbles start in the clear margin, inside the decoration. **Dominoes stay
  Square:** their rectangular chain cannot form the supported circular build, and the panel explains
  that when Circle is selected. This is the build omission permitted by the brief.

## Anatomy and RGB investigation

The lab builder used separate round-splat lattices for module patches. Their open edges were soft
and scalloped; neighboring tiles with different RGB colors could not use the equal-color padding.
The new lab-only painter reuses `src/qr/crisp.js` for narrow contour splats, an opaque interior, and
inside-corner clipping. Every module still moves as its own solid part, and the existing depth
separation between RGB layers and their cards is retained. No engine, renderer, or vendor code
changed.

Lowering RGB culling alone did not change the apparent artifacts. Recoloring the cards exposed
undercoverage, but a held real frame did not reproduce broad non-data white stripes. Tests sample
both the solid finder centers and different-color row boundaries that share a dark channel. The
baseline passed those tests too, so they are coverage regressions rather than proof of the reported
stripe defect.

| Shared dark-channel row boundaries, 354 samples | Baseline p95 / maximum | After p95 / maximum |
| ----------------------------------------------- | ---------------------- | ------------------- |
| 390 × 844                                       | 10 / 12                | 7 / 10              |
| 1440 × 900                                      | 7 / 8                  | 10 / 11             |

Values are 8-bit channel brightness; lower is darker. These figures do not establish an
across-the-board improvement. The before-and-after stills and clips are the visual evidence for
sharper edges.

| Toy/view     | Phone before                                                                   | Phone after                                                                  | Desktop before                                                                  | Desktop after                                                                 |
| ------------ | ------------------------------------------------------------------------------ | ---------------------------------------------------------------------------- | ------------------------------------------------------------------------------- | ----------------------------------------------------------------------------- |
| Anatomy      | [before](../../tests/screenshots/cdx-circle-qr-anatomy-before-390x844.png)     | [after](../../tests/screenshots/cdx-circle-qr-anatomy-after-390x844.png)     | [before](../../tests/screenshots/cdx-circle-qr-anatomy-before-1440x900.png)     | [after](../../tests/screenshots/cdx-circle-qr-anatomy-after-1440x900.png)     |
| RGB together | [before](../../tests/screenshots/cdx-circle-qr-three-before-390x844.png)       | [after](../../tests/screenshots/cdx-circle-qr-three-after-390x844.png)       | [before](../../tests/screenshots/cdx-circle-qr-three-before-1440x900.png)       | [after](../../tests/screenshots/cdx-circle-qr-three-after-1440x900.png)       |
| RGB apart    | [before](../../tests/screenshots/cdx-circle-qr-three-apart-before-390x844.png) | [after](../../tests/screenshots/cdx-circle-qr-three-apart-after-390x844.png) | [before](../../tests/screenshots/cdx-circle-qr-three-apart-before-1440x900.png) | [after](../../tests/screenshots/cdx-circle-qr-three-apart-after-1440x900.png) |

## Verification and motion proof

Chromium is `/usr/bin/chromium`, using the repository's SwiftShader WebGL2 configuration. The new
Circle and lab files passed **20 tests**:

```sh
SPLASHERY_CHROMIUM=/usr/bin/chromium npx playwright test tests/cdx-circle-qr.spec.mjs tests/cdx-circle-lab.spec.mjs
```

The required regression selection contains 216 tests in 20 files:

```sh
SPLASHERY_CHROMIUM=/usr/bin/chromium npx playwright test tests/qr*.spec.mjs tests/taps.spec.mjs tests/help.spec.mjs tests/unit.spec.mjs tests/smoke.spec.mjs
```

The selection was completed across group runs and targeted retries: **215 of 216 requested cases
passed, with one existing failure and no skipped or missing cases**. This was not a single clean
suite run. Comparing the listed cases with the completed logs confirms coverage of every requested
case.

| Group                    | Final result across runs and retries                                      |
| ------------------------ | ------------------------------------------------------------------------- |
| New Circle and lab tests | 20 passed                                                                 |
| Existing `qr*` tests     | 69 passed; 1 existing snapshot failure                                    |
| `taps`                   | 62 passed                                                                 |
| `help`                   | 14 passed after targeted retries                                          |
| `unit`                   | 20 passed                                                                 |
| `smoke`                  | 50 passed after a targeted retry; WebGPU and embed transfer checks passed |

The initial process ended after 81 cases, so the remaining groups were run separately. Three help
checks failed initially and passed on targeted retries; the phone help-line check also failed on the
immutable pre-change baseline. A shared-server shutdown interrupted the first remainder run, causing
connection-refused failures. The dedicated-port run was later interrupted with 19 smoke cases
unfinished; only those cases were restarted, together with four checks of incoming main changes.
That final run passed all 23 cases. A procedural-seed smoke check failed once and passed on both
targeted retries. `main` was incorporated through `acaebd19`; its updated About panel passed at both
sizes, and loading, seed generation, and the remaining rendering checks passed after that update.
The QR implementation did not change during these follow-ups.

The existing `qr4-craft` shared-builder snapshot assertion fails on this branch and on unmodified
`main` (`acaebd19`). Both produce SHA-256
`d98ad9f651252c2f37ce6d6530dc7aa8c45fca762319a496421846fec9788eb6`; the test expects
`b3918a78fddc50518d2fef2cecb12cee1cf3b16b05a450e61a166fb39b482144`. The protected assertion is
unchanged. This existing failure prevents claiming a completely green regression selection.

Before publication, `npx prettier --check .`, `node tools/us-english.mjs --diff`, and
`git diff --check` passed. Standard screenshots were restored; the task's proof captures and
before-and-after stills remain committed.

The new tests read actual Chromium WebGL2 captures of all five Circle toys with both decoders, check
exports and decoration invariance, check the anatomy default and legend, and exercise the reported
review edge cases. Square splat output was also compared directly with immutable `main` for all
seven QR styles and all three build materials; missing shape and explicit Square match the baseline.

Pack checks passed for QR, QR lab, and QR craft. An earlier cold run exceeded the 1.5-second Picture
QR build target while multiple browser jobs ran; a comparison with the immutable baseline produced
the same 122,602 splats, with baseline 1,105 ms and current 840 ms. The later combined pack check
passed, including Picture QR at 501 ms. Timing varies with concurrent cloud rendering.

All six changed thumbnails were regenerated and
[the contact sheet](../../tests/screenshots/cdx-circle-contact-sheet.png) was inspected. Motion
clips use the existing `tools/effect-clip.mjs` capture pipeline through a temporary task-only
wrapper: 390-pixel captures, 390 × 844 page viewport, eight frames per second, Circle selected, and
flip tiles for the circular build. Automatic scan jobs are disabled during manual clock stepping to
avoid competing captures. The temporary wrapper changes no committed tool or engine file.

The
[six motion clips](https://github.com/ryanjosephkamp/splashery/tree/codex/circular-qr-clips/docs/audits/circular-qr-clips)
are published only on `codex/circular-qr-clips`, which is never merged. The draft PR links every
clip.
[Separate default-setting captures](https://github.com/ryanjosephkamp/splashery/blob/codex/circular-qr-clips/docs/audits/circular-qr-clips/default-reads.json)
also decoded all five Circle toys with both readers at phone size.

## Scope and handback

No files owned by the protected open PRs were edited. In particular, `src/qr-craft/samples.js`,
`LICENSES.md`, `CREDITS.md`, `src/toy-help.js`, `tests/taps.spec.mjs`, the engine, and `vendor/` are
unchanged. No new asset source or library was added. Standard screenshots produced by the regression
suite are restored before the implementation commit.

Remaining review items: the requested 100% margin gate was not reached, phone camera apps and
physical prints were not tested, and the broad RGB stripe defect could not be reproduced. Circle
remains behind the existing labs switch. No merge or change to the public shelf is requested.

Rule check: none.
