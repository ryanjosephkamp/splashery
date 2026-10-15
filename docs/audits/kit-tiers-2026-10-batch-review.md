# Task 66: merge-batch regression review

Made by Ryan with Codex (GPT-6), October 15, 2026. Code is MIT. This follow-up investigates the
snowman and Eiffel Tower failures reported after
[Ops PR 637](https://github.com/ryanjosephkamp/splashery/pull/637) and
[Actions run 38658583011](https://github.com/ryanjosephkamp/splashery/actions/runs/38658583011). The
existing Math repair is unchanged.

## Current main combined with this PR

Current main was pinned at `d1f300b412f7776efd00cbb852d065af66232cc9`; task source was
`f23f1961c3677d0356de50bed9dbe2906b35351b`. `git merge-tree --write-tree` combined them without
conflicts, yielding tree `fe9a4682a8b70df213c53e7e9fbe5c1934522a43`. A temporary detached,
single-parent snapshot materialized that exact tree for testing. No merge was published and no
branch history was rewritten. Only `src/packs/maths.js` differs in application source between
current main and the combined tree.

Main later advanced to `3d43af200836da2c78a7547ef7c2d202fba8c963`. Its only application-source
change from the tested pin is `src/powers/stops.js` (Powers-of-ten labels), alongside documentation,
site output, and owned screenshots. Both reported toys, their shared engine/framing code, and the
requested specs remain unchanged. This later inspection is not an additional test run.

Each requested case ran alone, on main and then on the combined tree, with one worker, zero retries,
the existing assertions and timeouts, and sandboxed Chromium 151.0.7922.173 with no added launch
arguments. The actual shared spec files are byte-identical. These are desktop Chromium checks at
390×844, not physical phone testing.

| Tree                 | Snowman head/restack test | Help clear-of-toy test at 390×844     |
| -------------------- | ------------------------- | ------------------------------------- |
| Current main         | Passed                    | Failed at the final console assertion |
| Current main plus T2 | Passed                    | Failed at the final console assertion |

Both Help runs completed all seven toys' bounding-box, background, and zero-toy-pixel assertions,
including Eiffel Tower. Both then rejected the same software-WebGL fallback and ReadPixels warnings.
Those are recorded failures; the assertions were not filtered or loosened. Neither reported CI
assertion reproduced in this main/combined comparison.

## Does T2 change Eiffel Tower's tier, size, or framing?

**No.** Engine `PROFILES`, `Player`, the camera, the Kit builder, the tower recipe, its catalog
entry, and the snowman recipe are unchanged by T2. The text helper is private to the Math pack. Its
callers are the four already documented Math toys. Neither Holidays nor Landmarks imports it.

An independent Node comparison built both toys at all four tiers in each tree, using the real player
budgets, default options, and player seeds. All **eight toy/tier pairs match exactly**: every used
position, scale, rotation, color, and animation-buffer byte; emitted count; bounds; base size;
fitting transform; parts; reaches; camera settings; recipe; hands definitions; and recipe data. This
is source/build evidence, not a performance or visual-quality measurement.

At the Help test's `weak` alias for Low, Eiffel Tower requests 60,000 splats and emits 60,002 in
both trees. Its bounds are `[-0.4565971196, -0.7028776407, -0.4565971196]` to
`[0.4565971196, 0.7028776407, 0.4565971196]`; fitting scale is `0.4348544117`; and the catalog
camera remains yaw `0.55`, pitch `0.22`, roll `0`, and distance `4.2`. The same radius and camera
inputs therefore reach the same unchanged framing code. T2's engine-tier recommendations remain
proposals, not implemented tier changes.

## Original batch controls

The Actions run tested batch head `118d7a54dccddd36669988b83e1e1743b10356f4`, which included five
PRs. That batch was fetched and tested separately. A first control restored only the Math helper to
main's version. A second control reversed all 24 T2 paths, including all four changed thumbnails,
while preserving every other batch path. Controls were temporary detached snapshots and were never
pushed. Each run retained its original result.

Across the current-main checks and batch controls, **12 isolated executions completed: 7 passed and
5 failed, with no skips, interruptions, or selected cases left unrun**. These are repeated
executions of two shared titles, not 12 unique tests.

| Batch condition                          | Snowman                                                                                   | Help at 390×844                                                    |
| ---------------------------------------- | ----------------------------------------------------------------------------------------- | ------------------------------------------------------------------ |
| Original batch, first run                | Failed: head stayed at `0.8498530383`, expected below `-0.6` after dragging to the ground | Failed: null bounding box at the first Cactus check, before Eiffel |
| Batch with only the Math helper restored | Passed                                                                                    | Failed: the same null bounding box at Cactus, before Eiffel        |
| Batch with all 24 T2 paths reversed      | 2 passed                                                                                  | Not selected for the bounded repeats                               |
| Original batch, bounded repeats          | 2 passed                                                                                  | Not selected for the bounded repeats                               |

The original snowman failure occurred at `toBeLessThan`, earlier than CI's reported `toBeCloseTo`.
Its later two passes and all control outcomes are preserved alongside that failure; the extra runs
do not replace it. No assertion, threshold, or gesture was changed.

The failed batch snowman trace records **93 local requests and zero requests for any of T2's 24
changed paths**. In particular, neither the Math pack nor the four Math thumbnails was loaded. The
application files actually exercised by that failed page are unchanged by this PR. The original
batch's Help failure also occurs with the Math helper removed. The new tests therefore do not
establish a T2 source or tier regression.

A separate direct-Eiffel diagnostic selected the tower in the batch and in the complete T2 reversal,
bypassing the unrelated Cactus failure. At 390×844, DPR 1, both measured **zero toy pixels** in the
same padded Help-line crop, using the original test's visibility mask, white background check, and
pixel threshold. The line was already visible on both; neither needed its Help button reopened.
These are diagnostic measurements, not passes substituted for the failed Help spec.

Both had Help box `{x:14,y:113,width:306,height:46}`, 60,002 emitted splats, radius `0.7028776407`,
actual camera distance `2.9520860910`, and a 390×613 canvas inside the 390×844 viewport. Generator,
camera, canvas, and toy state match exactly. Full UI and cropped pixel images are preserved. The
tower is visible in both full images; the crop is not evidence from a blank render.

The batch includes accessibility changes from
[PR 594](https://github.com/ryanjosephkamp/splashery/pull/594), including different Help-line layout
rules. This investigation does not assign ownership of the batch failures to another PR or change
its files. Its purpose is to test whether T2 changes the two reported toys and to preserve the
observed failures for the next batch.

## Evidence and reproduction

[Immutable results, source/build comparisons, trace hashes, and screenshots](https://github.com/ryanjosephkamp/splashery/tree/2a43784479ad41f028c6046e373ea931784d8fbf/docs/audits/kit-tiers-2026-10-evidence/ops-review).
Evidence branch: `codex/t2-open-shelves-clips`, never merge.

The evidence contains every isolated outcome and failure message, trace hashes, public failure
screenshots, both source trees' exact build measurements, shared-file hashes, and the failing
snowman's loaded-path inventory. Original traces and logs remain in the ignored cloud cache. No
previous reported pass substitutes for these fresh results.

The two unchanged test selections were:

```sh
SPLASHERY_CHROMIUM=/usr/bin/chromium npx playwright test \
  --config <task-safe-config-for-checkout> hh3-holidays.spec.mjs \
  --grep 'snowman: the head lifts off with its face and hat, and stacks back up$' \
  --workers=1 --retries=0
SPLASHERY_CHROMIUM=/usr/bin/chromium npx playwright test \
  --config <task-safe-config-for-checkout> help.spec.mjs \
  --grep 'the line stays clear of the toy at 390x844$' --workers=1 --retries=0
```

The task-safe config uses the installed browser with `chromiumSandbox: true` and `args: []`, the
same fixture timeouts, and an explicit server/test directory for each checkout. The bounded snowman
repeats additionally used `--repeat-each=2 --trace=on`; they are separate observations, not
replacements for earlier failures.

## Limits and remaining issues

The CI snowman `toBeCloseTo` failure and exact Eiffel Tower ten-pixel overlap were not reproduced in
this secure Chromium environment. The full batch Help checks stopped at Cactus before reaching
Eiffel; the direct Eiffel probes measured zero pixels on both trees. The one batch snowman failure
stopped at the earlier ground-placement assertion listed above. CI uses a different
browser/rendering setup; this work did not opt into unsafe graphics, bypass GPU blocklists, disable
the sandbox, or relax a test to imitate it. The sandbox helper works here. Artifact archive
downloads from the Actions run were denied; its public run logs and summary were read, and the fresh
local failures are preserved.

This follow-up reran the two requested cases and bounded snowman controls, not the full repository
suite or the previous broad Help/Smoke/Math comparison. The older results remain dated and pinned in
the [October 14 review](kit-tiers-2026-10-review.md). No app-source fix was made for the two
unrelated toys. The existing Math equation/panel and equation/frame overlaps remain known issues
already documented on main. No physical device test, merge, or deployment was performed.

Rule check: none.
