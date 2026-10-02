# Codex task 03: test health

**Branch:** `codex/test-health`, cut from `main`. **Output:** `docs/audits/test-health-2026-10.md`
only. Don't edit any test or source file: the lanes that own them make the fixes.

The Playwright suite (`tests/*.spec.mjs`, about 76 files and 750 tests) is run in full before every
merge, in two halves by two Claude sessions on slow cloud machines. Flaky tests and slow tests cost
those runs hours. The owner wants the suite fast and trustworthy.

1. **Run the whole suite twice** on this Mac. Start the static server with
   `python3 -m http.server 4173 --bind 127.0.0.1`, then run
   `SPLASHERY_CHROMIUM=<path to Chrome or Chromium> npx playwright test --reporter=line`. Use the
   browser already on the Mac rather than installing one if you can, and say which one you used.
   Note each run's wall time and the worker count.
2. **List every test that failed in either run.** Rerun each one alone three times. Then sort them:
   - fails every time (a real failure);
   - fails sometimes (flaky);
   - fails only in the full run (depends on load or order).

   Give each one's first error line.

3. **Find each flaky test's cause.** Read the test and the code it drives. Look for:
   - a fixed wait or timeout;
   - a race with loading or rendering;
   - a pixel threshold too tight for software rendering;
   - shared state between tests;
   - anything that depends on the clock.

   Propose a fix as a short patch in the report, not in the files. `tests/taps.spec.mjs` is never
   edited: if it is flaky, propose the fix in the engine or the toy instead.

4. **The 25 slowest tests** with their times. For each, say whether it could be faster without
   testing less (a smaller scene, fewer frames, sharing one page load, a lighter render profile).
5. **Duplicated coverage.** Find tests that check the same behavior in different files, and say
   which could go.
6. **Write the report.** Open with a summary of at most ten lines, then one section each for steps 2
   to 5. Give file:line for everything you mention.

Run `npx prettier --check docs/audits/test-health-2026-10.md` and `node tools/us-english.mjs --diff`
before you push.
