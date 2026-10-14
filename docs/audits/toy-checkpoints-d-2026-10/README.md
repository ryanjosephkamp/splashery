# Part d checkpoint evidence, October 14, 2026

Codex recorded Picture lab, Your book, and Photo album from the saved source commit
`41b21e74e04ccca178b95ac02b4e5dc0e51b4b45` on
[`claude/checkpoint-toys-2026-10-14`](https://github.com/ryanjosephkamp/splashery/tree/41b21e74e04ccca178b95ac02b4e5dc0e51b4b45).
No runtime files, assets, or tests were changed. This evidence belongs only on
`codex/toy-checkpoints-d-clips`; never merge it. The three guides are on `codex/toy-checkpoints-d`
under `docs/studio/`.

## Phone clips

All clips use Chromium with SwiftShader WebGL2, a 390×844 CSS viewport, `profile=mid`, and
`adapt=off`. `--width=390` keeps the exported GIF at exactly 390×844. Picture lab uses the existing
`tools/bk-clip.mjs` at device scale 2. The book and album use `capture.mjs`, an evidence-only
adapter copied from that tool at the checkpoint, at device scale 1. It uses one
double-requestAnimationFrame draw before and after sheet-readiness waiting instead of three, and
records three book taps without a second album sequence in the book clip. This reduces
software-renderer overhead; the runtime and tests are unchanged. The adapter is retained here for
reproduction, and should be run with the repository as the current directory.

Both recorders advance the clock manually in 1/12-second steps, wait for actual sheet generation,
and encode held frames for pauses. They invoke existing recipe actions and drag APIs. This records
real splat rendering and page animation, but does not measure real-time input latency or frame rate.
These clips do not exercise depth inference, pop-outs, PDF text extraction, or every book style. The
original longer book/album capture was stopped before producing those files; its completed Picture
lab GIF is retained.

- [Picture lab: forward and backward PDF taps](bk-lab-taps.gif), with the default article sample.
- [Your book: one-page reading](bk-one-page.gif), using the controlled
  `tests/fixtures/bk/booklet.pdf`, rather than the default manual.
- [Photo album: short pull returning and long pull committing](bk-album-pull.gif), with sample
  photos.

The matching `*-strip.png` files sample six frames for inspection. No screenshot or clip is added to
the documentation PR's branch. Files over 1 MB stay here.

To reproduce from the source checkpoint, start a local server in that checkout:

```sh
python3 -m http.server 4174 --bind 127.0.0.1
```

Then, in another terminal:

```sh
SPLASHERY_CHROMIUM=/usr/bin/chromium SPLASHERY_URL=http://127.0.0.1:4174/ node tools/bk-clip.mjs .cache/toy-checkpoints-d-evidence --width=390 lab-taps
SPLASHERY_CHROMIUM=/usr/bin/chromium SPLASHERY_URL=http://127.0.0.1:4174/ node docs/audits/toy-checkpoints-d-2026-10/capture.mjs .cache/toy-checkpoints-d-evidence --width=390 one-page album-pull
```

Use the existing browser's path on another machine; do not install a browser as part of this
capture. The original GIFs are retained without re-encoding.

## Sizes and performance method

`source-manifest.json` records byte sizes and SHA-256 hashes for the relevant source, samples,
renderer, optional depth model, and media libraries. All listed files were byte-compared with the
saved Git commit before publication. These are file sizes, not compressed network transfer totals.
The six album images total 567,855 bytes; the lab PDF is 65,800 bytes, its photo is 269,347 bytes,
and the checkpoint manual is 7,792,711 bytes.

`measure.mjs` creates a fresh browser context for each toy, with the same 390×844 viewport and 2×
device scale but **low** detail. It opens the actual default sample. `sampleReadyMs` measures from
starting `app.chooseToy()` until the media exists and all currently requested sheets match their
desired keys, including any prepared sheets. It excludes initial app-shell startup, which is
recorded separately as `shellReadyMs`. It is not a network-throttled phone load benchmark.

The script then counts `Stage.frames` (`frameend` events) for about five wall-clock seconds while
forcing rendering and tapping at the start and at 2.5 seconds. This includes page changes and sheet
work, with no frozen clock, and gives an active cloud frame rate. Idle rendering is on-demand, so an
idle frame rate would be misleading. It records kit, visible-sheet, and cache splat counts
separately, along with errors, sample identity, canvas size, and Chromium version. Photo pop-out
inference is not requested. A single software-rendered cloud run does not establish performance on a
physical phone or a stable performance threshold for later changes.

```sh
SPLASHERY_CHROMIUM=/usr/bin/chromium SPLASHERY_URL=http://127.0.0.1:4174/ node docs/audits/toy-checkpoints-d-2026-10/measure.mjs /tmp/toy-checkpoints-d-measurements.json
```

The six-frame strips were visually inspected. `clip-metadata.json` verifies the GIF dimensions,
frame counts, durations, and file sizes. The book and album clips show turning pages extending
beyond the focused reading area; this is visible checkpoint behavior, without a runtime fix.

## Measured results

Single-run phone-profile measurements, October 14, 2026, using Chromium 151.0.7922.173, SwiftShader
WebGL2, 390×844 CSS pixels, device scale 2, low detail, and adaptation off, without competing
browser jobs. Sample-ready time excludes the app shell and includes matching requested sheets.
Active frame rate counts frameend events over about five wall-clock seconds with two taps and forced
rendering. It can include incomplete turns; it does not measure completed page turns per second or
physical-phone performance. No photo-depth inference ran.

| Toy         | Sample ready | Active frames/s | Settled kit splats | Settled visible sheet splats |
| ----------- | -----------: | --------------: | -----------------: | ---------------------------: |
| picture-lab |       1.93 s |           10.60 |             17,945 |                       31,997 |
| your-book   |      14.29 s |            1.71 |             55,572 |                      119,355 |
| photo-album |      25.02 s |            0.99 |             55,308 |                      265,999 |

Raw records: [measurements.json](measurements.json). All three contexts reported no page errors.

## Verification

The accompanying `verification.txt` records the final commands and results. The broader 64-case run
was stopped after 32 passes, one GIF timing failure (four frames observed, more than four required),
and one interrupted screenshot case; 30 cases did not run. The GIF/video case passed on an isolated
single-case retry after capture jobs ended. The 15 pure pop-out/state checks passed. See
`broad-run-results.txt` for the executed test titles. Existing tests exercise both browser rendering
and pure recipe/state logic; their mock picture APIs are not physical-phone measurements.
Documentation-only scope is checked against the task branch's base. Local standard screenshots
generated by existing specs are restored before the docs commit. The full repository suite is not
run for this documentation-only task. No live external-media endpoint, camera, microphone, or
physical mobile device is tested.

Rule check: none.
