# Operator review follow-up

The Operator requested stress workflow separation, a new commit reverting bbace1372, preservation
of the hit-ordering and close-focus fixes, and completed full-suite results. Main c36c4dcd9 is
merged, without rebasing. Revert commit: 5b9c39d55. Stress isolation: c7f553ac8. Manual receipt and
CI documentation follow-up: a9a1bca4f. Runtime and test code are identical between c7f553ac8 and
a9a1bca4f.

Quartz, after the behavior revert: 30/30 under the original four-worker, two-burner stress recipe,
zero failures, skips, retries, or interruptions. The exact recipe, source hashes, report, and log
are adjacent. Source commit: c7f553ac8.

Related first-pass validation: all 41 cases in heb-engine, hh5-gems, shr, and rec1 passed with two
workers, Chromium 141, Mesa llvmpipe, Xvfb :91, and standard port 4173. The report and complete log
are retained. Generated tracked screenshots are archived with hashes, then restored.

The original final full-run artifacts are in actions-final-full-499501064. These runs predate the
behavior revert. This evidence branch must never merge.

Full preflight on a9a1bca4f, after merging main c36c4dcd9: 271/271 browser cases and all six static gates passed. No quick mode. Complete log and 25 generated tracked PNGs are retained, with hashes; generated outputs were then restored.
