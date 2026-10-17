# Native cell diagnostic, completed 20 cases

Source `cf10f12f6fd15913059124a40391f3b2df8db5c4`, October 17, 2026,
07:40–08:01 UTC. Four fully parallel workers, two constant CPU burners, Node 22.20.0,
Chromium 141, and Mesa llvmpipe. Same six samples, current-view sort, actual PNG
hold, and original assertions as the combined candidate. Read-only native cell
metadata and accepted-answer observations were added. No acceptance claim.

Still 8/10 passed; low light 10/10 passed. Both still failures were height drift:
0.0006097322875247882 and 0.0005698294370426788 against 0.00055. Their shown
values 0.8761243386243386 and 0.9127314814814815 passed the unchanged 0.95 limit.
All 20 cases completed; zero skips, interruptions, retries, and flaky passes.

Failure 1 includes four neighboring fine cells repeatedly switching between
near and far targets by about 0.675, while native still ages rose from 7.6 to
29.9 seconds and current motion masks were zero. Measured samples spanned
9–12 accepted native depth answers. These are real target changes, not just
unfinished height easing or stale camera sort. The next comparison tests whether
the 20-frame, 1.33-second fake-camera noise loop aliases slow inference.
That hypothesis is not yet proved.

The original byte-exact report, recipe, complete log, probe sources, and both
failure traces are in `original-run.zip`. Expanded JSON may be formatted for
review. `failure-cell-summary.json` extracts all five pairs of each failed case.
