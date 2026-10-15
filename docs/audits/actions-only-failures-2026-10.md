# Actions-only failures: task 86

Made by Ryan with Codex (GPT-6), October 15, 2026. Branch: `codex/actions-only-failures`. Test and
measurement changes only; no toy, renderer, or sandbox behavior changes. The draft PR's Verification
section records the final Actions run.

## Evidence and causes

The task's original evidence is in [the CI handoff](../handoff/CI.md). The
[CI lane's PR](https://github.com/ryanjosephkamp/splashery/pull/634) records the draw-cost failure
and the audio-clock failures. The owner also identified the failures in the docs-only
[PR 638](https://github.com/ryanjosephkamp/splashery/pull/638). Select tests by title: Playwright's
reported lines can differ from the source lines, and adding helpers moves them again.

| Original test                       | Cause and change                                                                                                                                                                                                                                                                                                                                                                                                                                     |
| ----------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `hh4-space:147`, `hh4-tiny:206`     | These tests manually step physics, but automatic renderer updates also ran between protocol calls. The joint and its drive were sampled at different simulation times. Stop automatic player updates after setup; retain every manual step and numeric assertion.                                                                                                                                                                                    |
| `scr2-engine:10`                    | The GIF can advance between releasing its hold and asking for its first resumed frame. Give this API test exclusive control of the real player's clock at 60 Hz. Keep the frame-count, hold, resume-position, and playing-state assertions.                                                                                                                                                                                                          |
| `ui2:361`                           | After the first submission, the options already start with `pad:`. Waiting for that prefix does not wait for the next rebuild; later strokes can land on the pad that is about to be replaced. Wait for the old pad to disconnect and the build to finish before reading or drawing again.                                                                                                                                                           |
| `ui3:50`, `ui3:129`                 | Driver latency permits the effect to decay before the test reads its initial or resumed value. Capture the actual action event, retaining the `>0.95` and `<0.02` limits. Wait for a drawn effect and scheduled audio before changing phases.                                                                                                                                                                                                        |
| `sndc-engine:27`, `sndc-engine:142` | A protocol polling deadline is not the audio's silence deadline; fixed sleeps also do not establish rendered or scheduled progress. Observe native context transitions and the audio clock at the click. Keep the 100 ms freeze bound, the 500 ms native resume bound, unchanged paused time, and resumed scheduling checks. Wait for an actually ringing note before pausing the piano.                                                             |
| `ops-text:41`                       | The Copy feedback lasts 1.8 seconds, independently of driver transport. Observe the actual button mutation in the browser, then verify the real clipboard and the label's reset.                                                                                                                                                                                                                                                                     |
| `spg:138`                           | The form navigates the live iframe three times. The old test neither awaited those players nor verified that a toy actually started before replacing its GPU context. Wait for each URL and the real strawberry player before the next navigation. This strengthens the live-example check; Actions must verify the teardown result.                                                                                                                 |
| `cdx-mir:329`                       | The 10% draw-cost bound compared separate browser runs under different load. Replay the same recorded frames and real worker replies into independent before/after filters in one browser, alternate timing order, and finish pending GPU work explicitly. Keep the same 1.1 ratio and every image/depth assertion. Version the benchmark's resume cache.                                                                                            |
| `live4:149`                         | Node polling can miss a drawn mode, and a transport delay after Start over can move the audio beyond its initial-position check. Capture the actual settled modes per player frame and pause at that observed phase. Read seek/start results in the same browser call. Keep both settledness thresholds and all transport/privacy checks.                                                                                                            |
| `psv3:146`                          | The old loop window started before the first drive and counted media startup/seeking stalls as playback. Under load it observed only one video wrap, or aliased whole short GIF loops. Sample after each player update, measure 2.7 actual playback periods, and use a phone viewport. Keep recording stopped display frames after startup, retain the two-wrap, first-frame, and last-half-second limits, and also assert the native playback rate. |

## Executed local evidence

This environment has Debian Chromium 151 at `/usr/bin/chromium`, not Actions' Playwright
Chromium 141. Browser runs use the existing SwiftShader flags. No rendering or audio APIs are
replaced in the committed tests. Camera input is the existing generated fixture; its depth model and
worker remain real. The hand-stepped GIF/physics clocks and recorded worker transport are explicit
test controls, not measurements of real-time speed.

- Five original targets (pulsar, chromosome, GIF hold, pad, and PDF text) passed locally before
  edits. The original embed-guide test also passed locally. This is not an Actions reproduction.
- Deliberately adding 500 ms between the original joint/drive snapshots or GIF resume/read, and
  delaying pad rebuilding by 500 ms, made all four original tests fail. The same probes with the
  fixes passed all four, retaining their assertions.
- The original UI/audio tests passed locally without injected latency. With delayed driver replies,
  the original short-effect assertion read `0.9333333333333333` instead of `>0.95`, and the original
  audio poll exceeded 100 ms. The revised four cases passed with the same delayed replies. Both
  complete audio/UI files passed: 14 tests, zero skips.
- A genuine injected 200 ms delay in native audio suspension still fails the revised strict check:
  0.17995 seconds of audio-clock advance against `<0.1`. The test distinguishes real audio delay
  from slow protocol delivery.
- The original real-browser loop cases failed under concurrent load: the fast video observed one
  wrap, and the fast GIF observed none. Their other five selected cases passed. The remaining
  changed files and the paired benchmark are verified in the draft PR's test results.

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

Status: implemented for review. No recipe, asset, license, public behavior, or effect changes.
Reused: the existing application, renderer, clocks, fixtures, depth worker, and PDF printer. New:
test observation/control, matched benchmark timing, the artifact workflow, and these instructions.
No performance claim about a real phone is made. The paired cost measurement is software-browser CPU
filtering, not a device frame-rate claim. Final check commands, counts, unresolved failures, and the
Actions link are in the draft PR body. Rule check: none.
