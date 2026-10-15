# Codex task 86: Three tests that fail only on GitHub Actions, and the manual's PDF

**Branch:** `codex/actions-only-failures`, cut from `main`. One draft PR against `main`. Read
`AGENTS.md`, `builders/RULES.md`, CLAUDE.md, `docs/CI.md`, and `docs/handoff/CI.md` (the CI lane's
evidence for each failure).

## Why

Since #634, the whole test suite runs on GitHub Actions for every PR, in 16 shards, and posts one
comment. Three tests pass in the Claude cloud container and on a laptop but fail on Actions, even
when rerun alone: `spg.spec.mjs:138`, `scr2-engine.spec.mjs:10`, and `ui2.spec.mjs:361`. The `ui3`
and `sndc-engine` audio tests behave the same way on busy runs. And `man5.spec.mjs:201` fails
because the shipped manual PDF is out of date. All of these are on the "known" list in
`tools/suite.json`, so the comment marks them "(known on main)". This task makes them pass for real.

## The work

1. **Each Actions-only failure, at its cause.** Reproduce it on Actions (push your branch; the
   Operator adds the `full-suite` label to your PR, so the whole suite runs on each push). Find what
   differs on the runner (timing, the software renderer `SPLASHERY_GL=llvmpipe`, fonts, audio
   devices, the display) and make the test wait for a real ready signal or measure the right thing.
   Never add retries, skip or `fixme` a test, or loosen an assertion to get green; if a test checks
   the wrong thing, say why and fix the check. Never edit `tests/taps.spec.mjs`.
2. **The manual's PDF.** The man5 test compares the shipped PDF with a fresh print, and the print
   needs Chromium's sandbox, which works on Actions. Add a workflow,
   `.github/workflows/manual-pdf.yml`, run by hand (`workflow_dispatch`), that prints the PDF with
   `node tools/manual-pdf.mjs` in the same environment as the suite (same fonts and settings as
   `tests.yml`) and uploads it as an artifact. Read-only permissions; it never commits. Say in the
   PR how the Operator should run it and commit the file.
3. **The known list.** Remove each test you fixed from `tools/suite.json`'s known list, so a later
   failure shows as new.

## Rules

No change to how any toy looks or plays. Never weaken Chromium's sandbox. American English and the
serial comma. Before you push: `npx prettier --check .` and `node tools/us-english.mjs --diff` are
clean. Done means the Actions comment on your PR shows each of these tests passing (a ✅ or only
failures unrelated to this task, each listed). PR body with Summary, Verification, Deviations, Known
issues, and What was cut.
