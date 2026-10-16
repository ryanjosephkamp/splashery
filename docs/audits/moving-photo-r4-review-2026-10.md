# Moving photo round 4: Operator review follow-up

October 16, 2026. Codex built this follow-up to the
[Operator's review of 421ec876](https://github.com/ryanjosephkamp/splashery/pull/677#issuecomment-6219580556).
The original twelve-hour results and source pins remain in the
[implementation audit](moving-photo-r4-2026-10.md) and
[measurement tables](moving-photo-r4-measurements-2026-10.md).

## Cache size and quality cost

The four caches now contain standard gzip streams. The browser's native `DecompressionStream`
restores the original MP2D stream once, when a long sample opens. Raw MP2D also remains supported.
No runtime library, network service, or new model is involved.

| Cache           | Before, bytes | After, bytes | Reduction |
| --------------- | ------------: | -----------: | --------: |
| Bunny           |    15,805,452 |    4,451,116 |     71.8% |
| Sintel          |    11,854,092 |    2,521,449 |     78.7% |
| Elephants Dream |    15,805,452 |    6,871,822 |     56.5% |
| Tears of Steel  |    10,668,684 |    4,070,112 |     61.8% |
| Total           |    54,133,680 |   17,914,499 |     66.9% |

Including the unchanged 6,515,057 bytes of original films, these assets take **24,429,556 bytes** in
the current checkout, versus **60,648,737 bytes** before. These are current file and download sizes.
Pushed history still retains the original files; this is a new replacement commit, with no history
rewrite.

The quality cost is **zero changed depth bytes**. Every decoded file matches the SHA-256 of the
entire corresponding cache at reviewed head `421ec876`, in both actual Chromium and Node 22. This
covers all 2,808 stored source-frame answers, including their headers. Resolution, eight-bit
precision, normalization, frame times, interpolation, and the original film bytes are unchanged. The
original before/after quality movies and measures therefore retain their original source pins; they
are not relabeled as a new quality sweep. The changing-depth test still applies its original
uniqueness and decoded-size thresholds, and additionally checks the encoded size. Five additional
cache tests check the four complete decoded hashes and reject damaged gzip in both runtimes.

This saves transfer and checkout size, not the decoded depth working set. It adds one-time inflate
work and transient allocations while opening a sample; those allocations were not independently
profiled. No inflate work occurs during playback. The default short sample does not fetch these
caches. `tools/cdx-mp2-r4-bake.mjs` now writes gzip directly, and `tools/cdx-mp2-r4-compress.mjs`
reproducibly replaces existing raw caches using Node 22.14.0. Asset records retain both encoded and
decoded hashes and the existing film licenses.

The unchanged first-completed-surface startup observer was rerun for all four long films, three
fresh contexts each, with phone emulation, page CPU slowdown 4, and no competing browser or test.
All 12 launches completed without errors. New application hash:
`3cb44054172a73cc811a8ffe75daa4bfe610c372d2267690f4902d11e0a9cd7a`.

| Long sample     | Compressed-cache startup median, ms |       Range, ms | Recorded main median, ms |
| --------------- | ----------------------------------: | --------------: | -----------------------: |
| Bunny           |                             1,355.3 | 1,144.4–1,574.6 |                  3,838.9 |
| Sintel          |                             1,038.7 |   918.9–1,175.4 |                  3,971.0 |
| Elephants Dream |                             1,554.1 | 1,298.8–1,810.5 |                  4,056.9 |
| Tears of Steel  |                               979.4 |   967.7–1,130.3 |                  3,787.7 |

These follow-up medians remain below main's original medians. They are higher than this branch's
original uncompressed-cache medians (1,043.9, 991.8, 1,216.7, and 856.4 ms, respectively); this
follow-up was not an interleaved raw-versus-gzip experiment, so that difference cannot be assigned
solely to inflate cost. The new raw startup report includes the compressed input hashes. The
original main report and its source pin remain unchanged.

## Playback limits retained

The Operator explicitly allowed retaining the remaining deficits with their numbers in the PR. This
follow-up changes cache storage and opening only. It does not change playback construction, worker
scheduling, or the presentation clock.

On the original clean, paired phone pass at application hash
`79ff139b207d8ca57abdddfbd8a59f9c1908cdc81e24737bb36d64cdc18e2109`:

- Short Bunny's update median is **54.3 ms**; short Bridge's is **60.0 ms**, against the requested
  **50 ms** ceiling. Main's corresponding medians are 70.5 ms and 63.0 ms.
- Bridge's bound-picture-clock rate is **13.92/s**, versus main's **15.08/s**.
- Long Bunny's bound-picture-clock rate is **9.93/s**, versus main's **10.60/s**.

These rates count bound-source-clock changes at postrender. They do not establish independent pixel
uniqueness or physical-device frame rate. The original universal temporal-stability gaps also remain
explicit in the original audit.

## Suite scheduling

Every `cdx-mp2*` spec has a measured whole-file duration in `tools/suite.json` `seconds`. `cdx-mp2`
and `cdx-mp2-r4` also run alone: their first-picture and playback assertions depend on wall-clock
timing. The `known` list is unchanged. The original changing-depth spec now reads the decoded cache
before applying every original assertion; no threshold was lowered, skip added, or test removed.

## Main and verification

Merged `main` at `94216d772`, then merged the newer `6c38b4f69` release UI and isolated test
displays with another normal merge commit. The shared release UI files match that main tip. The
original private branch, checkpoint branches, and clips branch are preserved. PR #677 remains a
draft.

The startup, cadence, and whole quality sweeps above precede that second main merge. Their source
pins and original browser conditions remain unchanged. The cache-only decoded-data equality proof
still covers every depth byte; the complete performance and quality sweep was not repeated against
the new release UI. A fresh Moving photo regression run and full CI verify integration.

After merging the latest release UI, the isolated Node 22 run passes **71/71 tests in all eight
Moving photo files**, with zero failures, skips, or flaky outcomes. The schedule records their
actual whole-file durations:

| File                | Tests passed | Seconds in suite.json |
| ------------------- | -----------: | --------------------: |
| `cdx-mp2-cache`     |            5 |                    10 |
| `cdx-mp2-decode`    |            7 |                     2 |
| `cdx-mp2-mobile`    |            2 |                   140 |
| `cdx-mp2-pixels`    |            7 |                     2 |
| `cdx-mp2-r3`        |           16 |                   114 |
| `cdx-mp2-r4-raster` |            7 |                   320 |
| `cdx-mp2-r4`        |           13 |                   496 |
| `cdx-mp2`           |           14 |                   309 |

The original full Actions run on reviewed head `421ec876` reports 331/331 files, 2,879 passed, 24
failed, and one existing skip. Twenty-three failures are in Moving photo; `ui4:90` passes alone. Its
full failed-case table and original reports remain in the evidence archive. Actions exposed a shared
test-helper defect: `openRender` defaulted to port 4388, while the Playwright config and suite serve
port 4173. The local measurement URL override had hidden it. Nineteen cases across the R3, R4, and
raster files failed with `ERR_CONNECTION_REFUSED`, including their isolated CI rechecks. The helper
now follows `SPLASHERY_PORT` or the standard 4173 default, while retaining an explicit
`SPLASHERY_URL`. These setup failures are separate from the earlier machine run's fifteen failures.
The CI excerpts retain their original head and job links.

The complete R3 file passes **16/16 without `SPLASHERY_URL`** against the existing range server. The
next custom-port check exposed the remaining server difference: Python's simple server cannot seek
these videos. A focused R3 render and the original delayed-callback R4 assertion both fail with
Python, and both pass with the new default byte-range server. The full R4 file then passes **13/13
with no measurement URL override**, through the suite's newly started server.

The first CI upload timeout also persists alone. Its original trace stops on the first MP4. A
matching Chromium 141.0.7390.37 probe reports empty H.264/AAC capability strings and rejects the
unchanged MP4 with `DEMUXER_ERROR_NO_SUPPORTED_STREAMS`; local Chromium 151.0.7922.173 reports both
codecs and decodes it. Moving photo therefore runs in `chromium-media`, using Chrome unless an
explicit executable is provided. Its standalone measurement helpers make the same choice. The
original run also reports failures in the legacy paused-video and upload-stability assertions; both
pass in the 71-test local run. The new full CI run checks them again under the corrected media
setup. Every other spec retains the original bundled Chromium project. The Actions image already
[includes Chrome](https://github.com/actions/runner-images/blob/ubuntu24/20261012.334/images/ubuntu/Ubuntu2404-Readme.md).
No codec skip, alternate fixture, or reduced assertion is used.

The project-list check finds **332 files, each in exactly one project**: 2850 non-Moving-photo cases
in `chromium`, and 71 cases in `chromium-media`. The static test server and browser routing are in a
separate **Engine:** commit. Application hash
`3cb44054172a73cc811a8ffe75daa4bfe610c372d2267690f4902d11e0a9cd7a` remains unchanged.

For a concrete main control,
[Actions run 38894472165](https://github.com/ryanjosephkamp/splashery/actions/runs/38894472165) on
`94216d772` reports 323/323 files, 2,826 passed, one failed, and one skipped. Its single failure,
`smoke:1053` (the shelf-resize assertion), passes alone. The follow-up's full Actions outcome is
recorded in PR #677; the original machine results remain historical evidence rather than a new CI
verdict. The `known` list remains unchanged.

The
[follow-up evidence archive](https://github.com/ryanjosephkamp/splashery/tree/codex/moving-photo-r4-clips/ledgers/operator-review)
retains original startup and test reports with stored and decoded hashes. Rechecks and the focused
case are identified separately. Full-repository Prettier, the American-English diff check, the site
build check pass before pushing. The unchanged Node pack checker reports 3,058 ms against its 1,500
ms limit on this branch; the same check on main reports 3,371 ms. Both build 208,806 splats without
a non-finite-value warning. This existing ceiling failure remains documented, with no checker or
limit change. The clips branch also passes whole-branch Prettier and the primary American-English
prose rules. No pushed history, checkpoint branch, existing threshold, or `known` entry is
rewritten.

### The full-suite reconstruction and refinement failures

The completed
[Actions run on 1299a32b](https://github.com/ryanjosephkamp/splashery/actions/runs/38941184339)
reports **332/332 files, 2,915 passed, five failed, and one existing skip**. Four initial failures
pass alone: man7a:67, img-engine:85, hh1-toys:258, and phy:64. The remaining failure is the legacy
Sintel reconstruction: height jitter is 0.0168414 against the unchanged 0.0152188 ceiling, including
its isolated recheck. The other 70 Moving photo cases pass. Every original report is retained.

The test-video generator omitted its color matrix and output frame clock. Native Chromium 151
interprets the exact CI video as BT.709. The explicit BT.601 reconstruction preserves the original
sheet colors more closely. Six decoded CI pictures differ from their source tiles by mean RGB errors
of 1.634–3.843 levels. Explicit output frame rate, limited range, and BT.601 bring those errors to
0.828–0.910. The corrected video retains 96 source pictures and 72 phone depth answers. The old
local encoder default gave 5.938 seconds and only 71 answers; the corrected clock gives 6.001
seconds. The [fixture proof](moving-photo-r4-fixture-2026-10.json) retains the browser color spaces
and raw results.

A new browser regression compares six decoded pictures with their original sheet tiles and checks
the intended duration and number of phone answers. It fails before the encoding correction and
passes afterward. The original upload regression also checks that it retains the intended answer
count. Corrected Sintel passes its original bounds on the earlier application source, without a
geometry change. YUV420 color conversion remains approximate; the four gzip depth caches remain a
separate, exact byte-equality proof.

The complete regression then exposes Bridge's 72-answer edge flips: **4.04214 per thousand** against
the unchanged **3.73191** limit. Its mean-jitter calibration score overlooks rare large pops and
samples only every fourth row and column. It can also carry a rejected fitted reference into the
next pass after selecting whole-clip normalization. The retained correction evaluates RMS jitter at
every pixel, including the border, and carries the selected calibration and its range forward. It
selects between the same two real model calibrations, with the existing cut penalty. It adds no
depth averaging, source crop, reduced precision, dropped answer, or motion reduction. The reported
mean-jitter and edge-flip measures and their test thresholds are unchanged.

The rare-pop regression fails with the old selector and passes with the new one. The complete legacy
file passes **16/16**, including the unchanged Bunny, Machine, Bridge, Sintel, and Horse bounds.
Bridge's measured mean jitter is **0.0114675** and cut share is **0.0727106**, within its original
bounds. Its existing flip assertion passes. Sintel retains **0.0142369** mean jitter and
**0.00481516** cut share. The other seven Moving photo files pass **57/57**: **73/73 total**, with
no failures, skips, or flaky outcomes. Each complete file runs alone, through the default range
server with no measurement URL override. The schedule records their actual whole-file times; known
is unchanged.

The frozen application hash is 9c18bf46aef4fc7de4a0f9668ff0b81ba2b75e15cc3faf514f7677e52c69e3a4.
This differs from 3cb44054, used by the earlier compressed-cache startup and color diagnostics. Only
the opened-clip calibration choice changes; sample depth bytes, picture binding, decoder ownership,
and mesh-construction code keep their existing paths. The full paired quality and performance sweep
is not repeated. Its original source pins, reconstruction hashes, and remaining cadence and
stability deficits remain explicit.

Native-grid averaging, alternate point fits, and overlapping range fits missed the existing bounds
and were discarded. Their negative measurements remain separate from retained-source verification.

Main advanced again during verification. A normal merge brings 0b6f4bf26 into this branch in
f05ff3c52, including its Photo research tests and Shape morph integration. This main merge changes
no Photo or Moving photo reconstruction module. The complete 73-test local rerun follows that merge.
Neither Photo checkpoint branch is touched. A fresh full-suite run verifies the published head; the
final outcome is recorded in PR #677.

The
[first follow-up CI evidence](https://github.com/ryanjosephkamp/splashery/tree/codex/moving-photo-r4-clips/ledgers/operator-review/actions-1299a32b)
keeps all initial reports and rechecks. The
[color and calibration evidence](https://github.com/ryanjosephkamp/splashery/tree/codex/moving-photo-r4-clips/ledgers/operator-review/color-and-calibration)
keeps the RGB proof, frozen-source local runs, and discarded trials under separate roles.

Rule check: none.
