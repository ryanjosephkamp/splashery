# Task 66: main comparison and upper-tier review

Made by Ryan with Codex (GPT-6), October 14, 2026. This follows the review of
[draft PR 599](https://github.com/ryanjosephkamp/splashery/pull/599). Recipe code remains unchanged
from the tested repair; no engine or layout implementation is added.

Main is pinned to `6c3764ff9a1aa3fbba202af12d6764ac23ed2d6e`, and the task branch to
`6785dbdb8c2b2dd700f1fc9c2b2678f6f036ed5a`. The nine shared spec files are byte-identical across
those trees. Main's Math pack is unchanged from the original task baseline; the text helper is the
only Math difference on the task branch.

## High and Max before/after renders

All four changed toys have fresh pairs at both High and Max. Each half uses sandboxed Chromium
151.0.7922.173, desktop 390×844 at DPR 1, Auto Detail, default options, adaptation off, player
seeds, the home camera, and the stabilized 0.5-second scene clock. One browser/page at a time. No
added launch flags, unsafe graphics opt-in, or GPU blocklist override. These are desktop renders,
not physical phone tests. All 16 captures completed without capture/page errors or blank stage
frames.

The pair images use the same crop for both halves, without rescaling. Original complete UI and stage
images and metadata remain alongside them. Stateful warm-up can vary a pose; no pixel-identity claim
is made.

| Toy                | High pair                                                                                                                                                                            | Max pair                                                                                                                                                                           | Observation                                                                                            |
| ------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------ |
| `graph-plotter`    | [High](https://github.com/ryanjosephkamp/splashery/blob/48d70c80768d5c803a99bcd316d7d1cadd87367e/docs/audits/kit-tiers-2026-10-evidence/review/pairs/graph-plotter-high-pair.png)    | [Max](https://github.com/ryanjosephkamp/splashery/blob/48d70c80768d5c803a99bcd316d7d1cadd87367e/docs/audits/kit-tiers-2026-10-evidence/review/pairs/graph-plotter-max-pair.png)    | The curve and grid retain their shape; the slider label stays complete and readable.                   |
| `surface-plotter`  | [High](https://github.com/ryanjosephkamp/splashery/blob/48d70c80768d5c803a99bcd316d7d1cadd87367e/docs/audits/kit-tiers-2026-10-evidence/review/pairs/surface-plotter-high-pair.png)  | [Max](https://github.com/ryanjosephkamp/splashery/blob/48d70c80768d5c803a99bcd316d7d1cadd87367e/docs/audits/kit-tiers-2026-10-evidence/review/pairs/surface-plotter-max-pair.png)  | The surface and grid retain their shape; the label remains readable at both budgets.                   |
| `unit-circle`      | [High](https://github.com/ryanjosephkamp/splashery/blob/48d70c80768d5c803a99bcd316d7d1cadd87367e/docs/audits/kit-tiers-2026-10-evidence/review/pairs/unit-circle-high-pair.png)      | [Max](https://github.com/ryanjosephkamp/splashery/blob/48d70c80768d5c803a99bcd316d7d1cadd87367e/docs/audits/kit-tiers-2026-10-evidence/review/pairs/unit-circle-max-pair.png)      | The visible equation terms have continuous, distinct strokes; the existing first-term overlap remains. |
| `pythagoras-proof` | [High](https://github.com/ryanjosephkamp/splashery/blob/48d70c80768d5c803a99bcd316d7d1cadd87367e/docs/audits/kit-tiers-2026-10-evidence/review/pairs/pythagoras-proof-high-pair.png) | [Max](https://github.com/ryanjosephkamp/splashery/blob/48d70c80768d5c803a99bcd316d7d1cadd87367e/docs/audits/kit-tiers-2026-10-evidence/review/pairs/pythagoras-proof-max-pair.png) | Letters and superscripts retain distinct strokes; the existing equation/frame contact remains.         |

![graph-plotter: main before and task branch after at High](https://raw.githubusercontent.com/ryanjosephkamp/splashery/48d70c80768d5c803a99bcd316d7d1cadd87367e/docs/audits/kit-tiers-2026-10-evidence/review/pairs/graph-plotter-high-pair.png)

![surface-plotter: main before and task branch after at High](https://raw.githubusercontent.com/ryanjosephkamp/splashery/48d70c80768d5c803a99bcd316d7d1cadd87367e/docs/audits/kit-tiers-2026-10-evidence/review/pairs/surface-plotter-high-pair.png)

![unit-circle: main before and task branch after at High](https://raw.githubusercontent.com/ryanjosephkamp/splashery/48d70c80768d5c803a99bcd316d7d1cadd87367e/docs/audits/kit-tiers-2026-10-evidence/review/pairs/unit-circle-high-pair.png)

![pythagoras-proof: main before and task branch after at High](https://raw.githubusercontent.com/ryanjosephkamp/splashery/48d70c80768d5c803a99bcd316d7d1cadd87367e/docs/audits/kit-tiers-2026-10-evidence/review/pairs/pythagoras-proof-high-pair.png)

No new truncation or loss of legibility was found in these default High or Max home renders. This is
a visual comparison of captured states, not a claim about every option, every effect pose, phone
performance, or the owner's acceptance. Requested budgets are unchanged.

## Known issues already present on main

**Both equation-layout issues were already present on main.** The unit-circle equation's first term
overlaps its panel, and the proof equation touches or is partly covered by its frame. The main
halves of the High and Max pairs show both issues. The equation coordinates and board geometry are
identical on main and this branch; only text sampling and radii differ. This PR retains those
existing layout issues rather than expanding into layout repairs.

## Test comparison

The full requested comparison is in progress, with one runner and one worker at a time, zero
retries, and no max-failure cutoff. Main runs the nine shared spec files (209 registered titles);
the branch runs the same files plus the 74 task checks (283 registered titles). Shared assertions
and browser security are unchanged. The old stopped-run results remain historical evidence; they do
not substitute for these reruns.

The main Help guards both failed again. The current 390×844 error is a null bounding box; the
1440×900 error is a hidden-line visibility timeout, rather than the earlier five-pixel
Fourier-circle overlap. These distinct failures will be named in the completed result matrix; they
are not assumed to be environment noise.

The cloud exec transport terminated the main runner after 84 completed titles: 71 passed and 13
failed. Its list log and failure traces survive; the remaining 125 titles will run in a
continuation. A task-local checkpoint reporter now flushes each test begin and result immediately,
without changing assertions or browser settings. It was verified with one existing unit check, which
passed in 9.4 seconds including startup. These are execution checkpoints, not a claim that either
full comparison is complete.

The first branch browser attempt was invalid: the task-local server started in `tools/` after the
manually started server was gone, so it returned a directory listing instead of the app. Its 74 Node
task checks passed, but browser readiness timeouts are not application-regression evidence. The run
and its interrupted case are preserved separately. The configuration now explicitly serves the
repository root; one existing readiness/help check passed with that automatic server, and the full
283-title branch run will be repeated.

[Original tier audit](kit-tiers-2026-10.md). Rule check: none. Draft PR only; no merge or
deployment.
