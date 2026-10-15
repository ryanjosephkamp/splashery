# Actions-only failures: task 86

Made by Ryan with Codex (GPT-6), October 15, 2026. Branch: `codex/actions-only-failures`. Test and
measurement changes, exact-output camera draw shortcuts, an exact PDF-search page selection, and
correct looping after an audio element ends between drawn frames. Book layouts, turns, rendering,
and sandbox settings stay the same. The draft PR's Verification section records the final Actions
run.

## Evidence and causes

The task's original evidence is in [the CI handoff](../handoff/CI.md). The
[CI lane's PR](https://github.com/ryanjosephkamp/splashery/pull/634) records the draw-cost failure
and the audio-clock failures. The owner also identified the failures in the docs-only
[PR 638](https://github.com/ryanjosephkamp/splashery/pull/638). Select tests by title: Playwright's
reported lines can differ from the source lines, and adding helpers moves them again.

The GitHub connector retrieved the original reports and traces from
[PR 638's run](https://github.com/ryanjosephkamp/splashery/actions/runs/38659183166), after the
command-line storage redirect initially failed. The original reports show the camera draw cost at
35.242 ms against a 32.386 ms limit, the resumed audio's scheduled count still at 42, and the pad's
leftover amount at 0.177778 against `<0.15`. The PDF search trace changes the selected page from 45
to 46 about 70 ms after the search click, with both pages physically open and no intervening
navigation. Its missing highlight persists for the full assertion timeout. The first revision's
[Actions run](https://github.com/ryanjosephkamp/splashery/actions/runs/38673108892) reproduced that
exact page-label failure, exposing that the earlier Copy-feedback change alone did not fix this
case. Only original shard results count; the existing CI diagnostic runs do not erase them.

| Original test                       | Cause and change                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                       |
| ----------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `hh4-space:147`, `hh4-tiny:206`     | These tests manually step physics, but automatic renderer updates also ran between protocol calls. The joint and its drive were sampled at different simulation times. Stop automatic player updates after setup; retain every manual step and numeric assertion.                                                                                                                                                                                                                                                                                                      |
| `scr2-engine:10`                    | The GIF can advance between releasing its hold and asking for its first resumed frame. Give this API test exclusive control of the real player's clock at 60 Hz. Keep the frame-count, hold, resume-position, and playing-state assertions.                                                                                                                                                                                                                                                                                                                            |
| `ui2:361`                           | After the first submission, the options already start with `pad:`. Waiting for that prefix does not wait for the next rebuild; later strokes can land on the pad that is about to be replaced. Wait for the old pad to disconnect and the build to finish before reading or drawing again.                                                                                                                                                                                                                                                                             |
| `ui3:50`, `ui3:129`                 | The original Actions reports exhaust all 42 notes before Pause: the tune ends at 4.21 audio seconds, while the second driver click takes about five seconds. Pause through the real button in the browser's drawn playing phase, with future notes explicitly required, and retain the same held tune after Resume. Driver latency also permits the effect to decay before the test reads its initial or resumed value. Capture the actual action event, retaining the `>0.95` and `<0.02` limits. Wait for a drawn effect and scheduled audio before changing phases. |
| `sndc-engine:27`, `sndc-engine:142` | A protocol polling deadline is not the audio's silence deadline; fixed sleeps also do not establish rendered or scheduled progress. Observe native context transitions and the audio clock at the click. Keep the 100 ms freeze bound, the 500 ms native resume bound, unchanged paused time, and resumed scheduling checks. Pause an actually ringing note with future notes remaining, in the same browser callback, before driver actionability can consume the tune.                                                                                               |
| `ops-text:41`                       | The actual Actions trace selects page 45, then the book replaces that left-page selection with page 46 of the same spread. Mark an explicit search selection and retain its exact page; ordinary spread navigation is unchanged. Wait for the actual book drive before the original text, highlight, status, and API assertions. Also observe transient Copy feedback in the browser, retaining clipboard and reset checks.                                                                                                                                            |
| `spg:138`                           | The form navigates the live iframe three times. Await only the final URL and its real strawberry player, after both input changes. Waiting for every intermediate GPU startup made the check unnecessarily slow on SwiftShader. Keep all snippet, final URL, and screenshot assertions, strengthen final player readiness, and use the existing timeout.                                                                                                                                                                                                               |
| `cdx-mir:329`                       | The 10% draw-cost bound compared separate browser runs under different load. Replay the same recorded frames and real worker replies into independent before/after filters in one browser, alternate timing order, and finish pending GPU work explicitly. Keep the same 1.1 ratio and every image/depth assertion. Version the benchmark's resume cache.                                                                                                                                                                                                              |
| `live4:149`                         | Node polling can miss a drawn mode, and a transport delay after Start over can move the audio beyond its initial-position check. Capture the actual settled modes per player frame and pause at that observed phase. Read seek/start results in the same browser call. Keep both settledness thresholds and all transport/privacy checks.                                                                                                                                                                                                                              |
| `psv3:146`                          | The old loop window started before the first drive and counted media startup/seeking stalls as playback. Under load it observed only one video wrap, or aliased whole short GIF loops. Sample after each player update, measure 2.7 actual playback periods, and use a phone viewport. Keep recording stopped display frames after startup, retain the two-wrap, first-frame, and last-half-second limits, and also assert the native playback rate.                                                                                                                   |

## Executed local evidence

This environment has Debian Chromium 151 at `/usr/bin/chromium`, not Actions' Playwright
Chromium 141. Browser runs use the existing SwiftShader flags. The committed checks use the real
renderer and audio APIs. The camera tool labels native sort requests and responses, forwards every
request unchanged, and waits for the renderer to apply the current view's returned order. Camera
input is the existing generated fixture; its depth model and worker remain real. The hand-stepped
GIF/physics clocks and recorded depth-worker transport are explicit test controls, not measurements
of real-time speed.

- Five original targets (pulsar, chromosome, GIF hold, pad, and PDF text) passed locally before
  edits. The original embed-guide test also passed locally. This is not an Actions reproduction.
- Deliberately adding 500 ms between the original joint/drive snapshots or GIF resume/read, and
  delaying pad rebuilding by 500 ms, made all four original tests fail. The same probes with the
  fixes passed all four, retaining their assertions.
- The PDF search regression now waits for the requested page to appear in the real book drive's
  visible sheets. Against the original source it fails deterministically: selected index 45 instead
  of 44. The engine regression likewise rejects index 31 instead of the explicitly requested 30. The
  production change distinguishes exact search requests from ordinary steps; its engine regression
  passes for four binding styles, both sides of a spread, and a neighboring selection in the same
  spread. It compares sheets, leaf geometry, and view exactly with the original layout, then checks
  the existing Previous, Next, and tap behavior.
- The original UI/audio tests passed locally without injected latency. With delayed driver replies,
  the original short-effect assertion read `0.9333333333333333` instead of `>0.95`, and the original
  audio poll exceeded 100 ms. The revised four cases passed with the same delayed replies. Both
  complete audio/UI files passed: 14 tests, zero skips.
- A genuine injected 200 ms delay in native audio suspension still fails the revised strict check:
  0.17995 seconds of audio-clock advance against `<0.1`. The test distinguishes real audio delay
  from slow protocol delivery.
- An injected 800 ms native resume delay fails both retained 500 ms checks (0.79169 and 0.78588
  seconds). An 800 ms state-change notification delay passes when native audio resumes promptly.
- The original real-browser loop cases failed under concurrent load: the fast video observed one
  wrap, and the fast GIF observed none. Their other five selected cases passed. The revised complete
  hh4-space, hh4-tiny, ops-text, ui2, scr2-engine, spg, live4, and psv3 files passed all 54 tests,
  with zero skips. After reviewing stopped-frame coverage, the six loop cases also passed. A
  deterministic 2.3-second end stall remains recorded against the original one-second stay limit.
- The first complete camera file passed nine tests, but its paired check exceeded 600 seconds. Its
  trace showed repeated browser screenshots taking five to eight seconds after an already completed
  GPU capture. Reuse that actual captured framebuffer, with the same face crop and output scale, and
  wait for all real splat-sort jobs to be applied after a camera change. The resulting comparison
  completed but still rejected 20.658 ms against the unchanged 20.451 ms cost limit. Profiling and
  exact-output checks address the remaining CPU cost; final evidence is recorded in the draft PR.
- The camera profile attributed about 1.10 ms per held-pose draw to growing an all-zero motion mask.
  That mask already equals its dilation. Reuse it only when its counted motion is zero; moving
  frames retain the original expansion. Twelve recorded frames per clip and a 96-frame browser
  sequence spanning no, partial, and full motion produced exactly identical color/depth pixels and
  filter state. The new regression rejects a deliberately incorrect always-skip shortcut (946 pixel
  and 12,331 height differences, among others). Both exact-output regressions passed after the
  minimal source change. Default-canvas diagnostic timing improved from 15.658 to 15.217 ms for
  still frames, and from 16.925 to 16.500 ms for low-light frames; this is diagnostic evidence, not
  a substitute for the original paired bound.
- The final batch exposed the paired tool's hardcoded port: it requested port 4173 even when the
  suite used 4192. Honor the existing Playwright base URL, retaining the explicit `SPLASHERY_URL`
  override. The next run reached the real camera pipeline and rejected an incorrect sort-idleness
  wait: this toy rebuilds its work buffer every frame, so each rendered frame starts another sort.
  Observe actual submitted jobs and native applied-order events instead. A front, turned, front
  probe rejected each first frame's older order and accepted each current order after it was
  applied, even though a replacement job was already running. The world version must also match.
- The early core batch reproduced the existing `kit:87` failure, "every kit toy has a recipe that
  builds deterministically and fits the unit ball": the circular Picture QR recipe rejects its
  default code as too detailed. Main subsequently fixed that recipe; this branch includes the fix.
  The complete kit file now passes all 10 local tests. This PR does not change its known entry.
- An earlier local batch: 17 complete files, 238 tests, 236 passed, two failed, and zero skipped.
  Its paired-camera failure was the hardcoded-port launch error above; after the base-URL and
  native-sort corrections, the complete paired check passed in 3.8 minutes. Both original
  image/depth checks and the 1.1 cost bound passed: still 21.083/19.975 ms (1.0555), and low light
  21.600/20.233 ms (1.0675). The circular-QR failure was subsequently fixed on main. This batch
  preceded the deterministic search regression and its source fix; the subsequent book/search
  results are recorded in the draft PR. Complete ui3 and sndc-engine files passed all 14 tests;
  every requested test file was exercised on that production revision. The original failed reports
  remain in the ignored cache.

- The complete book, book-link/pop-out, and PDF-text files pass all 49 local tests without skips.
  Actions also passes all 36 book and four PDF-text checks. The changed book file's two measured
  sizes are regenerated with `tools/shw-facts.mjs`; its strict freshness check passes.
- The next [Actions run](https://github.com/ryanjosephkamp/splashery/actions/runs/38677203500)
  passes all 11 camera checks, but exposes the remaining piano precondition in both ui3 and
  sndc-engine. At ui3's first observation, 12 notes are scheduled; its Pause click takes 4.89
  seconds and arrives with all 42 scheduled. The held melody's last event is at 4.21 audio seconds.
  The visual effect is still running because frame deltas are clamped under load. No future event
  exists to satisfy the unchanged post-resume scheduling check. Arm a browser observer before the
  first trusted Play click, then use the actual Pause button once a frame is drawn and notes remain.
  Keep Resume trusted, require the same held tune, and retain every original bound.
- A deliberate six-second driver delay with the same slow-frame load reproduces the old failure: all
  42 notes are queued before Pause, and the strict post-resume predicate fails. The new helper
  pauses at note 3 of 42, holds through the delays, and resumes to note 12 on the same tune. The
  complete revised ui3 and sndc-engine files pass all 14 tests, with zero skips.
- The final local source batch still rejects a 19.100 ms camera draw against an 18.471 ms limit.
  That original failed result remains recorded. Profiling attributes about 40% of draw work to
  sharpening. Process its three fixed RGB channels directly, retaining each arithmetic operation and
  write order. Recorded still and low-light sequences produce zero differing color pixels,
  encoded-depth bytes, or filter-state values. Diagnostic draw medians improve from 26.792 to 23.900
  ms for still frames, and from 36.958 to 35.200 ms for low light under concurrent load. These
  diagnostic timings do not replace the unchanged 1.1 paired check; the final result is in the draft
  PR.
- The Operator requested the same exclusive simulation clock in hh3-engine2, hh4-weather, and
  hh4-landmarks. These files also step the real player manually; automatic updates otherwise age
  plucks, move joints, or advance a drive between those steps and their snapshots. Preserve their
  real pointer input and every original motion, sound, position, and landing assertion. The
  leaning-tower fall itself already runs atomically, but the shared setup and other landmark checks
  still benefit from one clock. Local probe and full-file results are in the draft PR.
- The psv3 loop viewport was Playwright's default 1280×720 and is now 390×844. The explicit
  `profile=mid&adapt=off` keeps clip decoding, depth resolution, frame count, splat budget, and the
  relief mesh budget fixed by profile, independent of viewport. The smaller viewport reduces raster
  work, allowing short loops to be observed without aliasing whole cycles. This is a playback and
  frame-selection regression, not a rendering-throughput measurement. The other 10 psv3 tests retain
  their original viewport. The unchanged two-wrap, first-frame, and one-second end-stall checks
  observe 2.7 media periods after startup and still record stopped display frames.
- A fresh combined batch exposes a real remaining loop bug: the fast sound video's displayed tail
  lasts 1,179.7 ms, failing the unchanged `<1000` check. The trace repeats displayed times 2.22836
  and 2.41809 in a 2.508-second clip. After native audio ends, the silent fallback seeks back to
  that stale displayed time and plays the tail again; its 50 ms end guard does not cover a slow
  frame. When the native element has ended and is not blocked, start the next loop at zero through
  the existing Track play method. Paused, blocked, and normal playing paths stay as they were. Four
  engine regressions using both recorded times and both speeds fail on the original source, then
  pass with the fix; the existing four 30 Hz loop regressions also pass. Native browser verification
  retains every original bound; the final results are in the draft PR.

Temporary fault-injection probes and their logs stay in the ignored local cache. They are not
shipped or added to the suite. No retry, skip, `fixme`, threshold increase, or edit to
`tests/taps.spec.mjs` was added.

## Manual PDF and the known list

[Manual PDF instructions](../CI.md#printing-the-manuals-pdf) describe the new manual-only, read-only
artifact workflow. It uses the suite's pinned actions, Chromium installation, fonts, Inter aliases,
and sandbox setup, runs the existing PDF printer and navigation checks, and packages the PDFs,
edition record, and changed generated pages. It never commits.

The stale shipped PDF remains a real failure until the Operator reviews and commits that artifact.
`man5:201` stays known. The seven known entries covered by the test fixes are removed; unrelated
entries stay in place. Newly reported failures that were never known need no removal.

## Record

Status: implemented for review. No asset, license, book layout, turn behavior, or effect changes.
The PDF search keeps the exact selected page and its text after the book updates. Reused: the
existing application, renderer, clocks, fixtures, depth worker, and PDF printer. New: test
observation/control, matched benchmark timing, an empty-mask shortcut, exact RGB arithmetic, exact
search selection, the artifact workflow, and these instructions. No performance claim about a real
phone is made. The paired cost measurement is software-browser CPU filtering, not a device
frame-rate claim. Final check commands, counts, unresolved failures, and the Actions link are in the
draft PR body. Rule check: none.
