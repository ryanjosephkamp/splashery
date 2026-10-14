# Codex task 29: the intermittent failures, root causes

**Branch:** `codex/flaky-root-causes`, cut from `main`. **Output:**
`docs/audits/flaky-root-causes-2026-10.md` only. Don't edit any test or source file: the owning
lanes make the fixes.

`docs/HANDOFF.md` lists failures that came back now and then and were never explained (search it for
"flaky", and for "A rare engine warning"): a rare engine warning that shows up as a SwiftShader
warning in the cat statue smoke test, a flaky drag in the stretchy-toy smoke test, and the
strawberry smoke test that was once not settled 3 seconds after its tap. Codex task 03
(`docs/audits/test-health-2026-10.md`) classified 17 failures on `bc1fc54` and found 3 flaky tests
and 2 that fail only in a full run. This task finds why, with evidence, and proposes a fix for each.
Read that report first and don't repeat its work.

## Steps

1. **Build the list.** The three items above, the 3 flaky and 2 full-run-only tests from task 03,
   and any `test.fixme`, `test.skip` or retry comment you find in `tests/*.spec.mjs` that names a
   timing problem (grep for `flaky`, `flake`, `retry`, `waitForTimeout`, `skip`). Give each one's
   file:line.
2. **Reproduce each one.** Run it alone 20 times in a row
   (`SPLASHERY_CHROMIUM=<path> npx playwright test <file> -g "<name>" --repeat-each=20`), once with
   the machine idle and once with the CPU loaded (run a second Playwright process beside it, or a
   busy loop on every core). Record the pass count, the failing error line and the elapsed time of
   each failure. For one that never fails, say so with the count. Keep `test-results/` traces of a
   failure, and say which line of the trace shows the problem.
3. **Find the cause.** Read the test and the code it drives (engine, rig, physics step, loading).
   Test your hypothesis: change a thing in a temporary copy of the test (a longer wait, a fixed
   seed, a fixed clock) and show the failure rate move. Typical causes: a fixed wait; a race with
   loading or a frame; a pixel threshold too tight for software rendering; physics that settles
   later on a slow machine; shared state from the earlier test; a time of day. For the engine
   warning, find its exact text, which call raises it, and what state the engine is in then.
4. **Propose a fix** for each as a short patch in the report (a state-based wait instead of a time,
   a deterministic seed, a looser or smarter threshold, an engine guard). Say which lane owns the
   file (`docs/WORKSTREAMS.md`). `tests/taps.spec.mjs` is never edited: if it is involved, the patch
   is for the engine or the toy.
5. **The report:** a summary of at most ten lines; one section per failure (reproduction table,
   cause, the evidence, the patch, the risk of the patch); then anything you could not reproduce,
   with what you tried.

No web needed. Expect a few hours of machine time: do the 20-run steps one test at a time, and stop
early on one that fails 3 times. Before you push:
`npx prettier --check docs/audits/flaky-root-causes-2026-10.md` and
`node tools/us-english.mjs --diff`. Open a draft PR titled "Codex task 29: the intermittent
failures, root causes".
