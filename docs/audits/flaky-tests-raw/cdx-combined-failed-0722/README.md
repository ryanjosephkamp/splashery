# Combined mirror candidate: retained failure

Source: `cf10f12f6fd15913059124a40391f3b2df8db5c4`. October 17, 2026,
07:22–07:40 UTC. This is a failed candidate, not acceptance.

Four fully parallel browser workers, two constant CPU burners, pinned Node 22.20.0,
Chromium 141, and Mesa llvmpipe. Same observer wrappers as the original local
baseline; the source repair adds consumed native draw time, actual current-view
sort readiness, and a rendered-canvas hold only while the actual PNG is copied.
Native video, player updates, and the real depth worker continue. All six samples
and original assertions are unchanged.

The run completed 16 cases: still 7/8 passed, and low light 8/8 passed.
The failed still clip measured height drift 0.0010682912006437242 against the
unchanged 0.00055 limit. Its shown drift 0.9390542328042328 passed the
unchanged 0.95 limit.

Stopped with SIGINT to run a materially different cell-level cause diagnostic.
Four interrupted and 40 unstarted cases are separate; they are not passes or
assertion failures. Playwright lists these together in its aggregate skipped
field; inspect individual result statuses. Zero retries and zero flaky passes.

The report, exact recipe, complete log, probe sources, and finalized failure trace
are retained. Interrupted browser traces were large incomplete diagnostic files
and are not published. No successful-run or 30/30 claim is made.

`original-run.zip` preserves exact byte copies of the recipe, report, log,
probe sources, and failure trace. Expanded JSON copies may be formatted for review.
