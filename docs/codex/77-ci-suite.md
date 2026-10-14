# Codex task 77: run the test suite on GitHub Actions, in parallel, for every PR

**Branch:** `codex/ci-suite`, cut from `main`. One draft PR against `main`.

Read `AGENTS.md`, `builders/RULES.md`, `playwright.config.*`, `tools/suite.mjs`, and the open PR
#581 (task 50: per-run servers on free ports, which this builds on if it has merged).

## Why

Today the Operator runs the merge tests in its own cloud session, where the full suite takes hours
and uses scarce Claude usage. Running the suite on GitHub Actions for every PR and every push to
`main` makes the results visible on the PR itself, in about 20 minutes, at no cost (the repository
is public).

## Goal

1. `.github/workflows/suite.yml`: on `pull_request` and on `push` to `main`, install the pinned dev
   dependencies, install Playwright's Chromium in CI (fine in CI; the "never `playwright install`"
   rule is for cloud sessions that already have Chromium), and run the suite sharded across enough
   jobs (for example 12 to 16) to finish in about 20 minutes. Software WebGL, as the suite already
   uses.
2. Also run `npx prettier --check .` and `node tools/us-english.mjs --diff` as a quick separate job.
3. Upload each shard's report and failure screenshots as artifacts; post one summary (passed,
   failed, flaky per spec file) in the job summary.
4. No secrets and no deployment: the workflow only reads the code and runs tests. Pin every action
   by commit SHA.
5. Run the workflow on this PR and report the timings and any test that behaves differently in CI
   than in the cloud sessions. Don't skip or loosen any test to make CI green; list them.

## Don't touch

Tests, `src/`, and `vendor/`. Only the workflow, a short `docs/CI.md` on how to read the results,
and, if needed, a small change to `tools/suite.mjs` to support sharding.

Before you push: `npx prettier --check .` and `node tools/us-english.mjs --diff` are clean.
