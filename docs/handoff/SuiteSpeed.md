# Lane Suite speed: a faster full test run

Prefix `spd`. Branch `claude/lane-suite-speed`. Model: Opus 5.5, default effort. Owns this file,
the "Running the suite fast" section of `docs/OPERATING.md`, and small, additive speed changes to
the test files and `playwright.config.mjs`. How lanes work: [OPERATING.md](../OPERATING.md).

## Brief

Written by the Operator on October 7, 2026 (the owner's pick).

The full Playwright suite (`SPLASHERY_CHROMIUM=/opt/pw-browsers/chromium npx playwright test --workers=1`)
takes the Integrators hours on every merge, and that is now the biggest steady cost on the owner's
weekly usage. Make it much faster without weakening any test.

1. Measure first: run the suite (or large slices) with a JSON or line reporter and record per-file
   and per-test wall time. Put the table in this file and find where the time goes (app boot per
   test, waiting on `data-ready`, toy builds, screenshots, fixed sleeps, repeated work).
2. Fix the biggest costs, safest first. Ideas to weigh: share one booted page across a file's tests
   where they don't depend on a fresh page (`test.describe.serial` with a shared page or a
   worker-scoped fixture), replace fixed waits with waits on a real condition, cache built assets
   the tests rebuild, skip duplicate boots, and check whether `--workers=2` or sharding is safe in
   the cloud container (memory, SwiftShader) and document the command. Never loosen an assertion,
   raise a limit, add retries or skip a test; every test still checks what it checked.
3. Never edit `tests/taps.spec.mjs` without a note in the PR explaining why it was needed (if it is
   the big cost, propose the change in "For the Operator" instead of making it).
4. Prove it: before and after wall times for the full suite on the same container, and the same
   pass/fail list before and after (list any flake you see; don't fix flakes here unless they block
   you).
5. Add a short "Running the suite fast" section to docs/OPERATING.md (the Integrators' command).

Shared test helpers you change are engine-like: keep each change small and additive.

## State

WORKING: October 7, 2026, 20:10 UTC. Baseline full run (1,556 tests, 170 files, `--workers=1`)
started at 20:08 UTC on a 4-CPU, 15 GB cloud container.

## Notes

## Known issues

## For the Operator
