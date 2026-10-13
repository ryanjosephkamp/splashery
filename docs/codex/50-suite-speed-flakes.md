# Codex task 50: a faster full test suite, and the flaky tests fixed for good

**Branch:** `codex/suite-speed`, cut from `main`. One draft PR against `main`.

The full Playwright suite (`tools/suite.mjs`) takes about 4.5 hours on one worker, and a list of
tests fails only under load (docs/OPERATOR.md, "Known flaky tests"; earlier causes in
`docs/audits/test-health-2026-10.md` and task 29's report). Every merge waits on it.

## Goal

1. **Measure:** per spec file, its time on a 4-CPU machine (`--workers=1` and the suite's
   `--jobs=2`). Find where the time goes: fixed waits (`waitForTimeout`), repeated toy loads,
   screenshots, long clips, server start-up.
2. **Make it faster without testing less:** replace fixed sleeps with waits for a real ready signal;
   share one page or server where tests don't need a fresh one; run independent files in parallel
   safely (each with its own server port, so two runs never share port 4173). Target: the full suite
   at least 2× faster on the same machine. Show before and after.
3. **Fix each known flake at its cause** (smoke:734, tpg:204, hl1:75, stm:366, fl7:49 and :95,
   qrs-toys:132, live4:149, phy:64, ui4:42, wd:187 and :210, wdr3:133, smd-moving:101, hh5-gems:119,
   p3d): reproduce it under load (`--repeat-each 10`, or a CPU throttle through CDP), find the race,
   and fix the test or the toy. Each must pass 20 runs in a row under load.
4. **Never** lower a threshold, skip, quarantine, add retries, or edit `tests/taps.spec.mjs`. Never
   change what a toy looks like or does beyond a real bug fix (name it).

## Don't touch

Toys and tests the open PRs change (#560, #562, #566, #570, #576). Ask in the PR if a fix needs
them.

## Report

`docs/audits/suite-speed-2026-10.md`: the per-file times before and after, and for each flake its
root cause, the fix and the 20-run proof. Update `docs/OPERATOR.md`'s flaky list only in the PR
description (the Operator edits that file). Before you push: `npx prettier --check .` and
`node tools/us-english.mjs --diff` are clean.
