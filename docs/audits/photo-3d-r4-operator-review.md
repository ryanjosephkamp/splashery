# Photo to 3D r4: Operator review follow-up

Codex (GPT-6) built this follow-up to the
[Operator's October 14 comment](https://github.com/ryanjosephkamp/splashery/pull/622#issuecomment-6172204453)
on draft PR #622. The original twelve-hour quality run ended at 15:29 UTC. This follow-up addresses
review evidence and cleanup; it does not claim that the original universal quality goal was met.

## Startup goal

**The universal 25% first-3D startup goal is missed.** The four-upload study measured reductions of
19.5–25.5% cold and 19.6–35.8% warm. Forest warm is 19.6%, below 25%. The earlier adjacent forest
sequence's 23% cold and 25% warm estimates do not replace those per-input results. The
[original audit](photo-3d-r4-2026-10.md) preserves every timing and its limits.

## Shared stage changes and ordinary swaps

The production stage changes already have separate, small `Engine:` commits:

- `3082fa97`: the render-hold API, with its browser test; two files, 16 stage lines added or
  changed.
- `7a7732d2`: retirement only after actual draws, with its browser test; two files, nine stage lines
  added or changed.
- `deac10db`: the additional ordinary-swap regression test. History is preserved; nothing was
  rebased, squashed, or force-pushed.

The new test runs at CSS 390×844, device scale factor 3, and a 585×1266 native buffer. It alternates
molecule and donut six times. Each handoff must finish drawing and empty its retirement queue
**before any explicit capture can wake it**. It tracks the real owned container, entity, and six
owned or per-instance textures, including each actual texture's destruction and device membership.

[Branch observations](photo-3d-r4/operator-review/ordinary-branch-rows.json) and
[main observations](photo-3d-r4/operator-review/ordinary-main-rows.json) match exactly in every
recorded field, including all six completed RGBA hashes. Both builds retire each old scene after
exactly three actual draws, destroy its entity, container, and each of six textures once, leave no
old texture in the graphics device, and empty the queue. Each resulting view contains foreground
pixels. Repeated donut views keep 20 textures and exactly 51,989,368 tracked texture bytes; molecule
views keep 20 textures and 52,890,280 bytes. This covers owned procedural scenes, not every possible
asset or graphics driver.

The existing three covered-render checks also pass: nested holds preserve updates and explicit
captures, preview completion and leaving Photo to 3D release the cover, and covered updates retain
old GPU resources until actual draws reconcile them. Their synthetic preview fixture is identified
in the test; it is not presented as a real model-conversion test.

## Phone-profile peak memory and cache ownership

[Memory results and all individual peaks](photo-3d-r4/operator-review/memory-summary.json) come from
three fresh Chromium browsers per build. Each browser converts the real forest, lighthouse, and
tulips files, giving nine conversions per build. The model is the original 27,258,801-byte file with
[identical hashes](photo-3d-r4/operator-review/model-identity.json). No new weights ship.

The native profile is 390×844 CSS, device scale factor 3, and a 585×1266 drawing buffer. The tool
samples the sum of proportional resident sets (PSS) of the Chromium process tree every 200 ms, from
picking each file through the new Sharp GPU frame and five further completed frames. All process
accounting was readable. These are sampled desktop Chromium/llvmpipe measurements, not
physical-phone RAM or dedicated GPU memory. Shorter transients can be missed.

| Upload                              | Checkpoint maximum PSS, MiB | Branch maximum PSS, MiB |
| ----------------------------------- | --------------------------: | ----------------------: |
| Forest, cold                        |                     1,214.3 |                 1,341.4 |
| Lighthouse, warm                    |                     1,217.2 |                 1,243.1 |
| Tulips, warm                        |                     1,241.4 |                 1,278.5 |
| Maximum across all nine conversions |                     1,241.4 |                 1,341.4 |

**The measured maximum increases by 100.0 MiB, or 8.1%.** Corresponding summed RSS maxima are
1,560.9 and 1,659.7 MiB; RSS counts shared pages repeatedly, so PSS is the primary comparison. This
is a memory cost of the retained startup approach, not a memory improvement.

The depth table's weights, source indices, and sums have the 64 MiB cap. Their largest observed
allocation was 56.7 MiB. The read-only, measurement-only worker probe found **zero retained depth
weight bytes after all nine candidate builds**. Small axis tables belong to the same released
object. Source-color and edge preparation remains cached for the latest photo, up to 24.7 MiB of
typed-array buffers in this study, for later depth edits; that is separate from the depth-table cap.
Replacing the prepared photo replaces this source cache, and terminating the worker releases its
whole realm. Clearing references makes buffers eligible for garbage collection; it does not force an
immediate fall in RSS.

Review exposed two gaps in the old cleanup: a stale-token fallback and a thrown construction could
retain the depth weights. Commit `c4e21a28` clears them in `finally`. The new test reproduces both
leaks on the original worker while its matching-build case passes; all three paths pass on the fixed
worker. The existing worker test also passes its full returned-field comparison for matching and
stale-token builds. Reconstruction arithmetic, geometry, and GPU shaders were not changed.

The first memory harness omitted the existing upload runner's playback-resume step and timed out; no
peak is claimed for it. Its method and failure remain archived. The corrected harness resumes on
pick and pauses after the actual completed frame. The initial cache test's MIME fixture error is
also retained separately from the real before/after cache results.

## Ownership and main

The branch merged main at `4907a003` in merge commit `9a4680f6`, then merged the later main
`915e6793` in `7815d419`. The sole conflict was the append-only credit section; both contributions
were retained. No history was rebased or rewritten. The second merge adds upstream Video to 3D work
and later audit/ground-truth records. Task 56 arrived after the original twelve-hour run had ended,
so the original 86-input study has not been relabeled as including those later fixtures.

The source guard completed before that second merge. Its only subsequent production-source changes
are 15 upstream Video to 3D files. Photo, the shared stage, live relief, and Moving photo source
remain identical to the bytes used in the affected checks. The
[post-merge source proof](photo-3d-r4/operator-review/post-merge-source.json) records every changed
path and the final source hashes. The baseline comparison worktree remains fixed at `4907a003`.

[Byte-hash checks](photo-3d-r4/operator-review/untouched-owner-files.json) confirm that every
`src/live/relief*.js` file, `src/photo-splats.js`, `src/packs/moving-photo.js`, and every
`src/video3d/` file equals main. There are no edits in those ownership files.

[All 1,283 existing main test files](photo-3d-r4/operator-review/existing-tests-unchanged.json),
including assertions, fixtures, and screenshots, remain unchanged. Only the task's new tests and
fixtures differ from main.

After the merge, [nine further checks passed](photo-3d-r4/operator-review/post-merge-checks.json):
the normal swap, all three hold/preview checks, all three cache-lifetime paths, the complete
returned-field worker comparison, and the original Showcase freshness assertion. Their source guard
also stayed unchanged throughout the run.

## Failure attribution

The original run's 46 failed tests comprise 45 failures in current production test files and one
failure in the newly introduced `cdx-p3d4-wire-render.spec.mjs` for a rejected vertex-color shader.
That shader and its new test were removed together before the first handoff. It has no main
counterpart; no existing main test was removed or weakened. In addition, three production files
failed at the harness/import stage without executing assertions.

The paired follow-up uses main at `4907a003` and selects every originally failed test title, with
unchanged source and assertions, on this branch and main. Files that previously failed before test
collection run in full. Runs are sequential, use the same browser and per-file renderer policy, use
the pinned test font configuration, and serve each checkout on the standard 4173 port where tests
require it. Exact source and test hashes, commands, errors, and source phases accompany each report.
Selected cases passing is not described as a fresh full-file or full-suite pass.

The Showcase file exposed one branch-specific generated-data mismatch: Photo to 3D's recipe had
grown from the recorded 37.9/12.4 KB raw/gzip to 38.4/12.5 KB. Regenerating
`src/showcase/facts.json` changes only those two values. The original freshness assertion passes
after regeneration; all ten other Showcase checks passed in the full branch run, and all eleven
passed on main. This was a metadata failure caused by the photo pack's size change, not a
render-hold failure.

The Pebbles case initially passed on main and failed on the branch. Eight additional unmodified runs
crossed each source checkout with each version of `src/stage.js`. Direct branch runs passed once and
failed once; unchanged main failed twice; branch with main's stage passed once and failed once; main
with the branch's stage failed twice. Every failure was the same line-82 stacking-height assertion.
The original checkpoint probe had also failed it. The initial one-sided failure is preserved; these
are repeated observations of an intermittent baseline issue, not a retry-until-pass claim. No
physics code or assertion was changed. Request records show that no Photo to 3D pack, geometry
worker, ONNX runtime, or depth model was loaded for these controls.

<!-- FAILURE-ATTRIBUTION-TABLE-BEGIN -->

| Test file                       | Main                                                | Branch                                                   | Attribution                                                                                                         |
| ------------------------------- | --------------------------------------------------- | -------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------- |
| `arc.spec.mjs`                  | 2 pass, 0 fail (selected)                           | 2 pass, 0 fail (selected)                                | Original cases pass in isolation.                                                                                   |
| `arc2.spec.mjs`                 | 1 pass, 0 fail (selected)                           | 1 pass, 0 fail (selected)                                | Original cases pass in isolation.                                                                                   |
| `cdx-mir.spec.mjs`              | 1 pass, 0 fail (selected)                           | 1 pass, 0 fail (selected)                                | Original cases pass in isolation.                                                                                   |
| `cdx-pics.spec.mjs`             | 4 pass, 0 fail (selected)                           | 4 pass, 0 fail (selected)                                | Original cases pass in isolation.                                                                                   |
| `e5.spec.mjs`                   | 1 pass, 0 fail (selected)                           | 1 pass, 0 fail (selected)                                | Original cases pass in isolation.                                                                                   |
| `fb.spec.mjs`                   | 6 pass, 0 fail (full)                               | 6 pass, 0 fail (full)                                    | Original harness/import failure cleared; full file passes.                                                          |
| `fx4-engine.spec.mjs`           | 1 pass, 0 fail (selected)                           | 1 pass, 0 fail (selected)                                | Original cases pass in isolation.                                                                                   |
| `fx7.spec.mjs`                  | 20 pass, 0 fail (full)                              | 20 pass, 0 fail (full)                                   | Original harness/import failure cleared; full file passes.                                                          |
| `hea.spec.mjs`                  | 1 pass, 0 fail (selected)                           | 1 pass, 0 fail (selected)                                | Original cases pass in isolation.                                                                                   |
| `hh2-nature.spec.mjs`           | 1 pass, 0 fail (selected)                           | 1 pass, 0 fail (selected)                                | Original cases pass in isolation.                                                                                   |
| `hh4-tiny.spec.mjs`             | 1 pass, 0 fail (selected)                           | 1 pass, 0 fail (selected)                                | Original cases pass in isolation.                                                                                   |
| `hh4-weather.spec.mjs`          | 0 pass, 2 fail (selected)                           | 1 pass, 1 fail (selected)                                | Same failure on main: hh4-weather.spec.mjs:188.                                                                     |
| `hh5-animals.spec.mjs`          | 1 pass, 0 fail (selected)                           | 1 pass, 0 fail (selected)                                | Original cases pass in isolation.                                                                                   |
| `hh5-gems.spec.mjs`             | 1 pass, 0 fail (selected)                           | 1 pass, 0 fail (selected)                                | Original cases pass in isolation.                                                                                   |
| `kit.spec.mjs`                  | 0 pass, 1 fail (selected)                           | 0 pass, 1 fail (selected)                                | Same failure on main: qr-craft.js:395.                                                                              |
| `lab.spec.mjs`                  | 1 pass, 0 fail (selected)                           | 1 pass, 0 fail (selected)                                | Original cases pass in isolation.                                                                                   |
| `live-engine.spec.mjs`          | 1 pass, 0 fail (selected)                           | 1 pass, 0 fail (selected)                                | Original cases pass in isolation.                                                                                   |
| `man5.spec.mjs`                 | 2 pass, 0 fail (selected)                           | 2 pass, 0 fail (selected)                                | Original cases pass in isolation.                                                                                   |
| `man7a.spec.mjs`                | 1 pass, 0 fail (selected)                           | 1 pass, 0 fail (selected)                                | Original cases pass in isolation.                                                                                   |
| `man7b.spec.mjs`                | 1 pass, 0 fail (selected)                           | 1 pass, 0 fail (selected)                                | Original cases pass in isolation.                                                                                   |
| `math.spec.mjs`                 | 0 pass, 1 fail (selected)                           | 1 pass, 0 fail (selected)                                | Selected case passes on branch; main failure retained.                                                              |
| `mt2.spec.mjs`                  | 1 pass, 0 fail (selected)                           | 1 pass, 0 fail (selected)                                | Original cases pass in isolation.                                                                                   |
| `ops-text.spec.mjs`             | 3 pass, 1 fail (selected)                           | 3 pass, 1 fail (selected)                                | Same failure on main: ops-text.spec.mjs:109.                                                                        |
| `phf.spec.mjs`                  | 1 pass, 0 fail (selected)                           | 1 pass, 0 fail (selected)                                | Original cases pass in isolation.                                                                                   |
| `phy.spec.mjs`                  | 1 pass, 0 fail (selected); 2/2 direct controls fail | 0 pass, 1 fail (selected); direct controls 1 pass/1 fail | Same L82 on main and with either stage; eight source-exchange runs retained.                                        |
| `pno.spec.mjs`                  | 1 pass, 0 fail (selected)                           | 1 pass, 0 fail (selected)                                | Original cases pass in isolation.                                                                                   |
| `qr4-craft.spec.mjs`            | 0 pass, 1 fail (selected)                           | 0 pass, 1 fail (selected)                                | Same failure on main: qr4-craft.spec.mjs:153.                                                                       |
| `qr5.spec.mjs`                  | 1 pass, 0 fail (selected)                           | 1 pass, 0 fail (selected)                                | Original cases pass in isolation.                                                                                   |
| `qrc-picture.spec.mjs`          | 1 pass, 0 fail (selected)                           | 1 pass, 0 fail (selected)                                | Original cases pass in isolation.                                                                                   |
| `shw.spec.mjs`                  | 11 pass, 0 fail (full)                              | 10 pass, 1 fail (full); freshness fix 1 pass             | Two generated pack-size values refreshed; original freshness assertion now passes.                                  |
| `smd-moving.spec.mjs`           | 1 pass, 0 fail (selected)                           | 1 pass, 0 fail (selected)                                | Original cases pass in isolation.                                                                                   |
| `smoke.spec.mjs`                | 1 pass, 0 fail (selected)                           | 1 pass, 0 fail (selected)                                | Original cases pass in isolation.                                                                                   |
| `st4.spec.mjs`                  | 1 pass, 0 fail (selected)                           | 1 pass, 0 fail (selected)                                | Original cases pass in isolation.                                                                                   |
| `st5.spec.mjs`                  | 0 pass, 2 fail (selected)                           | 0 pass, 2 fail (selected)                                | Same failure on main: st5.spec.mjs:100, st5.spec.mjs:139.                                                           |
| `stm.spec.mjs`                  | 1 pass, 0 fail (selected)                           | 1 pass, 0 fail (selected)                                | Original cases pass in isolation.                                                                                   |
| `tp2.spec.mjs`                  | 0 pass, 1 fail (selected)                           | 0 pass, 1 fail (selected)                                | Same failure on main: tp2.spec.mjs:100.                                                                             |
| `tpg.spec.mjs`                  | 1 pass, 0 fail (selected)                           | 1 pass, 0 fail (selected)                                | Original cases pass in isolation.                                                                                   |
| `vol.spec.mjs`                  | 0 pass, 1 fail (selected)                           | 0 pass, 1 fail (selected)                                | Same failure on main: vol.spec.mjs:299.                                                                             |
| `cdx-p3d4-wire-render.spec.mjs` | No counterpart                                      | Rejected prototype, absent from retained branch          | Newly introduced shader-cost check failed; its shader and new test were removed together. No existing test removed. |

<!-- FAILURE-ATTRIBUTION-TABLE-END -->

## Current-source Photo, Moving photo, and mirror checks

<!-- AFFECTED-SUITE-RESULTS-BEGIN -->

The initial source-guarded run completed all 15 files: **135 passed, two failed, and none skipped**.
Both failures were in the mirror file. After the diagnostic sequence described below, its one
complete-file recheck passed all ten assertions. Taking the latest complete report for each file
gives 137 passes, zero failures, and zero skips. This is not a clean first-attempt suite, and the
intermittent still-capture cause remains unexplained. Both the original and latest statistics are
retained in the data.

| Test file              | Passed | Failed | Skipped |
| ---------------------- | -----: | -----: | ------: |
| `phf.spec.mjs`         |      7 |      0 |       0 |
| `phf-engine.spec.mjs`  |      5 |      0 |       0 |
| `phf2.spec.mjs`        |      7 |      0 |       0 |
| `psv.spec.mjs`         |      8 |      0 |       0 |
| `psv2.spec.mjs`        |      6 |      0 |       0 |
| `psv3.spec.mjs`        |     16 |      0 |       0 |
| `smd-moving.spec.mjs`  |     16 |      0 |       0 |
| `smd-photo.spec.mjs`   |      4 |      0 |       0 |
| `live-engine.spec.mjs` |     11 |      0 |       0 |
| `live.spec.mjs`        |     13 |      0 |       0 |
| `live3.spec.mjs`       |     11 |      0 |       0 |
| `live5.spec.mjs`       |      5 |      0 |       0 |
| `lv7.spec.mjs`         |     11 |      0 |       0 |
| `lv8.spec.mjs`         |      7 |      0 |       0 |
| `cdx-mir.spec.mjs`     |     10 |      0 |       0 |

[Exact source hashes and raw per-file statistics](photo-3d-r4/operator-review/affected-checks.json)
identify this run. The complete `phf-engine` file includes its original text assertion.

<!-- AFFECTED-SUITE-RESULTS-END -->

The first full mirror file had two failures. Its matched-frame helper hardcodes port 4173, while the
suite was served on 4250; restoring the standard-port server resolved that connection refusal. The
other failure was a live still-camera height-jitter measurement of 0.000601 against the unchanged
0.00055 limit. A predefined main/branch/branch/main diagnostic sequence measured 0.000151,
0.00000554, **0.000593 (failure)**, and 0.000289. Both main controls passed. One subsequent complete
branch-file recheck passed all ten assertions, including the still-camera case at 0.00000397. No
threshold or source assertion changed, and every unsuccessful run is retained.

**The intermittent live-capture cause is not isolated.** The passing complete recheck does not prove
absence of an intermittent regression. The live pipeline's files are unchanged, and the
[extracted depth-input helpers](photo-3d-r4/operator-review/depth-input-helper-identity.json) have
exactly the same function bodies and clamp expression as main, but those source checks alone do not
establish timing equivalence. No speculative live-pipeline fix was made. The
[mirror follow-up](photo-3d-r4/operator-review/mirror-followup-summary.json) records both the
passing recheck and this unresolved limitation.

The original failures, incomplete runs, and later passes remain in the review records. No assertion
or threshold was lowered, and no existing test was skipped or removed. The PR remains a draft and
neither code nor review media is merged.

Rule check: none.
