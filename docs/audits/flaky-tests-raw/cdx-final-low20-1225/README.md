# Final local mirror stress, October 17, 2026

Immutable clean functional head: 9a16ae2ae7e49b1b792d01985fba3ea61aea2f78. All 60 cases passed: still 30/30 and low light 30/30, zero skips, retries, failures, or interruptions. Four fully parallel workers and two continuous CPU burners ran for the complete cohort. Node 22.20.0, Chromium 141.0.7390.37, Mesa llvmpipe, Xvfb :91, and a four-core CPU quota match the recorded recipe.

Still retains six observations; only low light increases to twenty. Original height limits 0.00055/0.0135, shown limits 0.95/2.2, 600-second timeout, median calculation, noise fixture, and camera motions remain. Every observation enters the original median. This is the first formal cohort on this head; the failed prior six-observation cohort remains separately retained. Independent Actions stress is not represented by these local counts.

The original recipe includes every source hash. Report, log, exit record, and compact summary are unmodified evidence. Passing tests retain no screenshots under the existing retain-on-failure policy. This raw branch must never merge.
