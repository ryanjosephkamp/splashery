# October 16 review follow-up

Made by Ryan with Codex (GPT-6). Recording contributions and original fixtures are CC0; code is MIT.
This evidence-only branch must never be merged.

The owner reported page and mount borders breaking through turning covers. The hidden Gaussian
sheets had supplied the sorter's conservative motion bounds; disabling their drawing also removed
that range. Engine commit `dcfe13e84` retains the same range on the kit without drawing the sheets.
The paired videos compare integrated source `9b9d30d37` with main at `6c38b4f69`. The seven
rendering files, first fixed at `4871ef735`, retain SHA-256
`b0a1770a72504f46abe748c19ff18ec84389b67ca2a2812247dd5ef9a7ecaf22`. The later tests, documentation,
and upstream UI merge preserve these rendering bytes. The paired videos, supplemental turn tours,
and four cover stills were all refreshed at `9b9d30d37` after the UI merge.

The root gallery's three paired videos show the corrected source against unchanged main. The
supplemental turn tours show opening, interior turns, returning, and fully shutting both toys. Their
metadata records the final cover angle explicitly. These use completed actual canvas draws at a
stepped eight frames per second, with preparation waits omitted. They do not measure speed.
Physical-phone performance is unmeasured.

The prospective follow-up benchmark keeps all 12 phone toy/input groups, three adjacent AB/BA/AB
pairs per group, the unchanged measurement tool, and the original strict gates. It is a separate
cohort from the original 118-case Goal archive. Every completed case is retained.

The reproduction scripts belong under `work/pages-r2/` in the implementation checkout, so their
relative imports resolve. Serve the unchanged baseline at 4180 and the implementation at 4173. Use
the cached fixture bytes from the root `fixtures/` archive for both revisions. The benchmark runs
alone, without capture, test, or encoding jobs competing for the renderer.

Rule check: none.

## Turn evidence

| Toy         | Actual-canvas tour               | Capture metadata                   |
| ----------- | -------------------------------- | ---------------------------------- |
| Your book   | [MP4](your-book-turn-tour.mp4)   | [JSON](your-book-turn-tour.json)   |
| Photo album | [MP4](photo-album-turn-tour.mp4) | [JSON](photo-album-turn-tour.json) |

Both tours finish with cover angle exactly zero and no page errors. The book has 81 saved poses; the
album has 121. Album photo zero is on its first inside spread, so the final recorded action is a
real left-page tap to shut the cover. The [dense cover comparisons](cover-frames/) retain opening
frames and end-of-sequence turns at full phone width. The
[turn-tour frame sheets](turn-tour-frames/) include every saved pose, reduced for scanning; the MP4s
preserve full phone width.

## Benchmark result

All 72 planned cases are retained in the [separate benchmark archive](benchmark/README.md). All 12
frame-rate checks and all three phone text-quality targets pass. First page and memory each pass in
11 of 12 groups; ten groups pass every applicable strict gate. Book-chart process memory misses by
9.853 MB, and album-text first page misses by 55.4 ms. These remain failures, without tolerances or
favorable reruns. The [full comparison](benchmark/comparison.md) gives all medians.

The original Goal cohort uses different source revisions and remains a separate historical archive.

## Final integration

Main through `bc7960eb3` is merged into the implementation. All seven measured rendering files
remain byte-identical to `9b9d30d37`. The final mandatory preflight passes all 270 checks across 13
shelf-wide specs, and all static steps pass.
[Final source hashes and artifact checks](final-integration.json) and
[both preflight logs](verification/README.md) are retained. The separate local smoke warning and two
fresh strict benchmark misses remain recorded.
