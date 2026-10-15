# Task 66: main comparison and upper-tier review

The [October 15 merge-batch investigation](kit-tiers-2026-10-batch-review.md) records the newer
snowman/Eiffel follow-up against current main and the combined task tree. The results below remain
the pinned October 14 comparison.

Made by Ryan with Codex (GPT-6), October 14, 2026. This completes the requested follow-up for
[draft PR 599](https://github.com/ryanjosephkamp/splashery/pull/599). The Math repair remains
unchanged; engine tiers are proposals only.

- Main `6c3764ff9a1aa3fbba202af12d6764ac23ed2d6e`: **170 passed, 38 failed (1 timeout), 1 skipped, 0
  interrupted, and 0 not run**, 209 requested unique titles.
- Branch `4b920ee3cf37236d240de7bc61662f698e67ef7d`: **245 passed, 37 failed (1 timeout), 1 skipped,
  0 interrupted, and 0 not run**, 283 requested unique titles.

[Every test, every failure message, and comparison JSON](https://github.com/ryanjosephkamp/splashery/blob/daa3ee52d8538c3d42c3127df7dbefbe25a5da4e/docs/audits/kit-tiers-2026-10-evidence/review/tests/comparison-results.json).
Timeout failures are included in failed totals. All shared assertions are unchanged, one worker,
zero retries, no max-failure cutoff, Chromium sandbox enabled, and no added launch flags. Existing
per-spec timeouts and fixtures remain unchanged. These are Node and sandboxed desktop Chromium
checks, not physical phone testing.

## High and Max before/after evidence

All four changed toys have fresh pairs at High and Max. Before is main
`6c3764ff9a1aa3fbba202af12d6764ac23ed2d6e`; after is task source
`6785dbdb8c2b2dd700f1fc9c2b2678f6f036ed5a`. Later commits change only review tooling and reports;
the rendered Math source is identical to the tested repair. Each capture uses Auto Detail, forced
profile, adaptation off, default options, player seeds, the home camera, 0.5-second scene clock, and
desktop Chromium 151.0.7922.173 at 390×844, DPR 1. One browser/page at a time; all 16 captures have
no capture/page errors or blank frames.

Pairs use the same crop for both halves, without rescaling; original complete UI/stage frames and
metadata remain alongside them. Stateful warm-up can vary poses. No pixel-identity,
device-performance, or owner-acceptance claim.

| Toy                | High pair                                                                                                                                                                            | Max pair                                                                                                                                                                           | Observation                                                                                |
| ------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------ |
| `graph-plotter`    | [High](https://github.com/ryanjosephkamp/splashery/blob/daa3ee52d8538c3d42c3127df7dbefbe25a5da4e/docs/audits/kit-tiers-2026-10-evidence/review/pairs/graph-plotter-high-pair.png)    | [Max](https://github.com/ryanjosephkamp/splashery/blob/daa3ee52d8538c3d42c3127df7dbefbe25a5da4e/docs/audits/kit-tiers-2026-10-evidence/review/pairs/graph-plotter-max-pair.png)    | Curve and grid retain their shape; the slider label stays complete and readable.           |
| `surface-plotter`  | [High](https://github.com/ryanjosephkamp/splashery/blob/daa3ee52d8538c3d42c3127df7dbefbe25a5da4e/docs/audits/kit-tiers-2026-10-evidence/review/pairs/surface-plotter-high-pair.png)  | [Max](https://github.com/ryanjosephkamp/splashery/blob/daa3ee52d8538c3d42c3127df7dbefbe25a5da4e/docs/audits/kit-tiers-2026-10-evidence/review/pairs/surface-plotter-max-pair.png)  | Surface and grid retain their shape; the label remains readable.                           |
| `unit-circle`      | [High](https://github.com/ryanjosephkamp/splashery/blob/daa3ee52d8538c3d42c3127df7dbefbe25a5da4e/docs/audits/kit-tiers-2026-10-evidence/review/pairs/unit-circle-high-pair.png)      | [Max](https://github.com/ryanjosephkamp/splashery/blob/daa3ee52d8538c3d42c3127df7dbefbe25a5da4e/docs/audits/kit-tiers-2026-10-evidence/review/pairs/unit-circle-max-pair.png)      | Visible terms retain complete, distinct strokes; existing first-term overlap remains.      |
| `pythagoras-proof` | [High](https://github.com/ryanjosephkamp/splashery/blob/daa3ee52d8538c3d42c3127df7dbefbe25a5da4e/docs/audits/kit-tiers-2026-10-evidence/review/pairs/pythagoras-proof-high-pair.png) | [Max](https://github.com/ryanjosephkamp/splashery/blob/daa3ee52d8538c3d42c3127df7dbefbe25a5da4e/docs/audits/kit-tiers-2026-10-evidence/review/pairs/pythagoras-proof-max-pair.png) | Letters and superscripts retain distinct strokes; existing equation/frame contact remains. |

![graph-plotter: main before and task branch after at High](https://raw.githubusercontent.com/ryanjosephkamp/splashery/daa3ee52d8538c3d42c3127df7dbefbe25a5da4e/docs/audits/kit-tiers-2026-10-evidence/review/pairs/graph-plotter-high-pair.png)

![surface-plotter: main before and task branch after at High](https://raw.githubusercontent.com/ryanjosephkamp/splashery/daa3ee52d8538c3d42c3127df7dbefbe25a5da4e/docs/audits/kit-tiers-2026-10-evidence/review/pairs/surface-plotter-high-pair.png)

![unit-circle: main before and task branch after at High](https://raw.githubusercontent.com/ryanjosephkamp/splashery/daa3ee52d8538c3d42c3127df7dbefbe25a5da4e/docs/audits/kit-tiers-2026-10-evidence/review/pairs/unit-circle-high-pair.png)

![pythagoras-proof: main before and task branch after at High](https://raw.githubusercontent.com/ryanjosephkamp/splashery/daa3ee52d8538c3d42c3127df7dbefbe25a5da4e/docs/audits/kit-tiers-2026-10-evidence/review/pairs/pythagoras-proof-high-pair.png)

No new truncation or loss of legibility was found in these default High or Max home renders.
Requested budgets are unchanged. Other options, all effect poses, and Math quality at higher DPR
were not swept.

## Known layout issues already present on main

**Both equation-layout issues were already present on main.** The unit-circle equation's first term
overlaps its panel, and the proof equation touches or is partly covered by its frame. The main
halves of the High and Max pairs show both. Recipe equation coordinates, board geometry, parts,
controls, and timing are unchanged by this PR. They remain known issues rather than expanded into
layout repairs.

## Per-file test results

| Spec                | Main passed | Main failed | Main skipped | Branch passed | Branch failed | Branch skipped |
| ------------------- | ----------- | ----------- | ------------ | ------------- | ------------- | -------------- |
| `cdx-t2.spec.mjs`   | Not present | Not present | Not present  | 74            | 0             | 0              |
| `help.spec.mjs`     | 8           | 6           | 0            | 8             | 6             | 0              |
| `hh5-math.spec.mjs` | 9           | 0           | 0            | 9             | 0             | 0              |
| `hta.spec.mjs`      | 3           | 0           | 0            | 3             | 0             | 0              |
| `kit.spec.mjs`      | 9           | 1           | 0            | 10            | 0             | 0              |
| `math.spec.mjs`     | 22          | 0           | 0            | 22            | 0             | 0              |
| `mt2.spec.mjs`      | 19          | 0           | 0            | 19            | 0             | 0              |
| `smoke.spec.mjs`    | 18          | 31          | 1            | 18            | 31            | 1              |
| `taps.spec.mjs`     | 62          | 0           | 0            | 62            | 0             | 0              |
| `unit.spec.mjs`     | 20          | 0           | 0            | 20            | 0             | 0              |

The 74 task checks are new to this branch and are not present on main. The nine shared spec files
are byte-identical across the compared trees. Main’s Math pack is unchanged from the original task
baseline; its only Math difference from the branch is the text helper. The unchanged embed-transfer
test reported 9.2 MiB on both main and the branch, below its 30 MiB threshold. Test names containing
“phone” refer to desktop viewport emulation. DPR 2 and DPR 3 canvas-size assertions are existing
Smoke checks, not physical-device or Math higher-DPR quality measurements.

## Every failed title in either valid run

| Spec             | Exact test title                                                                                                    | Main     | Branch   | Failure evidence                                                                                                                                                                     |
| ---------------- | ------------------------------------------------------------------------------------------------------------------- | -------- | -------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `help.spec.mjs`  | `toy help: the line > shows on a pick, fades, and '?' brings it back`                                               | failed   | failed   | Console assertion: software-WebGL fallback/readback warnings; full array in JSON                                                                                                     |
| `help.spec.mjs`  | `toy help: the line > shows after a refresh and from a link, old links included`                                    | failed   | failed   | Console assertion: software-WebGL fallback/readback warnings; full array in JSON                                                                                                     |
| `help.spec.mjs`  | `toy help: the line > a saved scene (JSON) still loads and shows its toy's line`                                    | failed   | failed   | Console assertion: software-WebGL fallback/readback warnings; full array in JSON                                                                                                     |
| `help.spec.mjs`  | `the line stays clear of the toy at 390x844`                                                                        | failed   | failed   | TypeError: Cannot read properties of null (reading 'y')                                                                                                                              |
| `help.spec.mjs`  | `the line stays clear of the toy at 1440x900`                                                                       | failed   | failed   | Error: expect(locator).toBeVisible() failed; full expectation/call log in JSON                                                                                                       |
| `help.spec.mjs`  | `toy help: About this toy > shows the toy's text, or the default, at 1440x900`                                      | timedOut | timedOut | Test timeout; last action and full message in JSON                                                                                                                                   |
| `kit.spec.mjs`   | `every kit toy has a recipe that builds deterministically and fits the unit ball`                                   | failed   | passed   | Main: Circular-QR picture detail limit; branch: No failure                                                                                                                           |
| `smoke.spec.mjs` | `Splashery app (WebGL2) > loads with no console errors and shows the shelf`                                         | failed   | failed   | Console assertion: software-WebGL fallback/readback warnings; full array in JSON                                                                                                     |
| `smoke.spec.mjs` | `Splashery app (WebGL2) > the shelf filters by category and search, and Surprise me picks a toy`                    | failed   | failed   | Console assertion: software-WebGL fallback/readback warnings; full array in JSON                                                                                                     |
| `smoke.spec.mjs` | `Splashery app (WebGL2) > generating a procedural toy changes canvas pixels`                                        | failed   | failed   | Console assertion: software-WebGL fallback/readback warnings; full array in JSON                                                                                                     |
| `smoke.spec.mjs` | `Splashery app (WebGL2) > toggling an effect changes canvas pixels`                                                 | failed   | failed   | Console assertion: software-WebGL fallback/readback warnings; full array in JSON                                                                                                     |
| `smoke.spec.mjs` | `Splashery app (WebGL2) > paint and poke tools change the toy where it is touched`                                  | failed   | failed   | Console assertion: software-WebGL fallback/readback warnings; full array in JSON                                                                                                     |
| `smoke.spec.mjs` | `Splashery app (WebGL2) > clay adds and erases blobs on a generated toy and survives a JSON round trip`             | failed   | failed   | Console assertion: software-WebGL fallback/readback warnings; full array in JSON                                                                                                     |
| `smoke.spec.mjs` | `Splashery app (WebGL2) > JSON export then import round-trips the scene`                                            | failed   | failed   | Console assertion: software-WebGL fallback/readback warnings; full array in JSON                                                                                                     |
| `smoke.spec.mjs` | `Splashery app (WebGL2) > the embed page loads a scene from the hash`                                               | failed   | failed   | Console assertion: software-WebGL fallback/readback warnings; full array in JSON                                                                                                     |
| `smoke.spec.mjs` | `Splashery app (WebGL2) > the <splashery-toy> element renders without an iframe`                                    | failed   | failed   | Console assertion: software-WebGL fallback/readback warnings; full array in JSON                                                                                                     |
| `smoke.spec.mjs` | `Splashery app (WebGL2) > bring-your-own PLY, SPLAT, SPZ and SOG files load in the browser`                         | failed   | failed   | Console assertion: software-WebGL fallback/readback warnings; full array in JSON                                                                                                     |
| `smoke.spec.mjs` | `Splashery app (WebGL2) > PNG, GIF and WebM exports produce files`                                                  | failed   | failed   | Console assertion: software-WebGL fallback/readback warnings; full array in JSON                                                                                                     |
| `smoke.spec.mjs` | `Splashery app (WebGL2) > desktop screenshot at 1440x900`                                                           | failed   | failed   | Console assertion: software-WebGL fallback/readback warnings; full array in JSON                                                                                                     |
| `smoke.spec.mjs` | `Splashery v3 engine (WebGL2) > a kit toy loads from its pack, and its action and a tap open and close it`          | failed   | failed   | Console assertion: software-WebGL fallback/readback warnings; full array in JSON                                                                                                     |
| `smoke.spec.mjs` | `Splashery v3 engine (WebGL2) > a kit toy can change shape: the red blood cell curls into a sickle (morph)`         | failed   | failed   | Console assertion: software-WebGL fallback/readback warnings; full array in JSON                                                                                                     |
| `smoke.spec.mjs` | `Splashery v3 engine (WebGL2) > toys move by themselves once motion is on, and any toy can bounce`                  | failed   | failed   | Console assertion: software-WebGL fallback/readback warnings; full array in JSON                                                                                                     |
| `smoke.spec.mjs` | `Splashery v3 engine (WebGL2) > patterns and flags recolour any toy and travel in the link`                         | failed   | failed   | Console assertion: software-WebGL fallback/readback warnings; full array in JSON                                                                                                     |
| `smoke.spec.mjs` | `Splashery v3 engine (WebGL2) > an old version 2 share link still opens`                                            | failed   | failed   | Console assertion: software-WebGL fallback/readback warnings; full array in JSON                                                                                                     |
| `smoke.spec.mjs` | `Splashery v3 engine (WebGL2) > a tap plays the toy's own sound, and a toggle plays its on and off halves`          | failed   | failed   | Console assertion: software-WebGL fallback/readback warnings; full array in JSON                                                                                                     |
| `smoke.spec.mjs` | `Splashery v3 engine (WebGL2) > a scan rig moves a part of a captured toy: the cat statue turns its head`           | failed   | failed   | Main: Console assertion: software-WebGL fallback/readback warnings; full array in JSON; branch: Error: expect(received).toBeGreaterThan(expected); full expectation/call log in JSON |
| `smoke.spec.mjs` | `Splashery v3 engine (WebGL2) > rigs pick splats by colour, run effects and show add-ons; shelf shapes have rigs`   | failed   | failed   | Error: expect(received).toBeGreaterThan(expected); full expectation/call log in JSON                                                                                                 |
| `smoke.spec.mjs` | `Splashery v3 engine (WebGL2) > the chess set plays the Opera Game, and the laptop types what you type`             | failed   | failed   | Console assertion: software-WebGL fallback/readback warnings; full array in JSON                                                                                                     |
| `smoke.spec.mjs` | `Splashery v3 engine (WebGL2) > a stretchy toy stretches when dragged and springs back; a drag off it orbits`       | failed   | failed   | Console assertion: software-WebGL fallback/readback warnings; full array in JSON                                                                                                     |
| `smoke.spec.mjs` | `Splashery v3 engine (WebGL2) > v3 screenshots at 1440x900 and 390x844`                                             | failed   | failed   | Console assertion: software-WebGL fallback/readback warnings; full array in JSON                                                                                                     |
| `smoke.spec.mjs` | `Splashery v3 engine (WebGL2) > an embedded kit toy opens when tapped`                                              | failed   | failed   | Console assertion: software-WebGL fallback/readback warnings; full array in JSON                                                                                                     |
| `smoke.spec.mjs` | `Settings panel (WebGL2) > the Toy tab has the essentials, and Reset everything takes a toy back to how it started` | failed   | failed   | Error: expect(locator).not.toContainText(expected) failed; full expectation/call log in JSON                                                                                         |
| `smoke.spec.mjs` | `Settings panel (WebGL2) > flag colours lie gently over the chess board, and stay with the toy they were chosen on` | failed   | failed   | Console assertion: software-WebGL fallback/readback warnings; full array in JSON                                                                                                     |
| `smoke.spec.mjs` | `Settings panel (WebGL2) > the chess game bar plays, pauses, steps and jumps, and a tap after the end starts again` | failed   | failed   | Console assertion: software-WebGL fallback/readback warnings; full array in JSON                                                                                                     |
| `smoke.spec.mjs` | `Sports balls (WebGL2) > a ball in a country's colours keeps its seams`                                             | failed   | failed   | Console assertion: software-WebGL fallback/readback warnings; full array in JSON                                                                                                     |
| `smoke.spec.mjs` | `Splashery on a phone > has no horizontal overflow at 390px and the sheet opens`                                    | failed   | failed   | Console assertion: software-WebGL fallback/readback warnings; full array in JSON                                                                                                     |
| `smoke.spec.mjs` | `Splashery on a phone > dragging the shelf up opens a grid, and picking a toy folds it back`                        | failed   | failed   | Console assertion: software-WebGL fallback/readback warnings; full array in JSON                                                                                                     |
| `smoke.spec.mjs` | `Splashery on a phone > a panel opened while a toy from the grid is still loading stays open`                       | failed   | failed   | Console assertion: software-WebGL fallback/readback warnings; full array in JSON                                                                                                     |

The Help guards are not assumed to be environment noise. Their current main outcomes are a null
bounding box at 390×844 and a hidden-line visibility timeout at 1440×900; the earlier five-pixel
Fourier-circle error is retained in the historical failure record. The current branch error for each
guard is shown above. Other baseline failures include the main circular-QR detail-limit check, rig
selection, settings reset, and strict console assertions. Every original valid-run failure remains
recorded even if an isolated follow-up passes.

The full cat-statue rig case reached different assertions: console warnings on main, but zero moved
pixels on the branch. One unchanged isolated case on each tree then failed at that same zero-pixel
assertion.
[Both isolated results](https://github.com/ryanjosephkamp/splashery/blob/daa3ee52d8538c3d42c3127df7dbefbe25a5da4e/docs/audits/kit-tiers-2026-10-evidence/review/tests/cat-isolated.json)
are retained alongside the original full-run errors. The cat rig source and assets are unchanged by
this task; no Math helper is used by that scan. No failed full-run result was replaced or counted
twice.

All 37 shared branch failures also failed on main. There are **zero branch-only shared failures**.
Main alone failed the Kit circular-QR detail-limit case; all ten branch Kit checks passed. The 74
task checks, 92 shared Kit/tap/unit checks, 50 Math checks, and 3 HelpTextA checks passed on the
branch. The same six Help failures and 31 Smoke failures remain, including one Help timeout.

## Execution recovery and preserved limits

Main’s exec transport connection terminated its first invocation after 84 completed titles (71
passed and 13 failed). All 84 outcomes were recovered from the list log, and all 13 exact failed
messages from their traces. Initial durations are rounded list-reporter values. An exact-title
selection of the remaining 125 completed unchanged, with results fsynced per test. The final main
totals deduplicate those segments; they do not imply one uninterrupted invocation.

The first branch browser attempt served a tools-directory listing because the task-local config did
not set the automatic server’s working directory. Its 74 Node task checks passed, but browser
results are invalid as application evidence. That attempt (77 passed, 4 failed, 1 interrupted, 201
unfinished) is preserved in
[its record](https://github.com/ryanjosephkamp/splashery/blob/daa3ee52d8538c3d42c3127df7dbefbe25a5da4e/docs/audits/kit-tiers-2026-10-evidence/review/tests/branch-wrong-server.json).
The config now explicitly serves the repository root. One unchanged readiness/help check passed with
that automatic server, and the full valid branch run was repeated. This correction changes serving
paths only; no assertions, timeouts, browser security, or graphics flags were relaxed.

The installed sandbox helper worked. Default ANGLE Vulkan SwiftShader produced the recorded
software-fallback/readback warnings; no unsafe opt-in or blocklist override was used. The unchanged
WebGPU adapter condition accounts for the skipped case. Full traces remain in the ignored cloud
cache, with public failure messages and screenshots on the evidence branch. No generated cache or
private coordination material is committed.

Main later advanced to `4907a003a43be0be97ce25403d94f6f1e9208600` with depth-lab pictures,
generation tools, and documentation. That remote tree was inspected; app source and all selected
specs are unchanged from the pinned main checkpoint. It was not merged into this branch.

The full repository suite was not run. Physical phones, phone frame rate, total memory, load time,
all options, every effect pose, and Math higher-DPR visual quality remain unmeasured. The shared
engine profiles are unchanged. No merge or deployment; the PR remains a draft.
[Builder record](kit-tiers-2026-10-record.md). Rule check: none.
