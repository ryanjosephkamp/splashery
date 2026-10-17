# Codex task 101: a faster full suite, with nothing dropped (a Goal run, up to 8 hours)

**Branch:** `codex/suite-speed-r2`, cut from `main`. One draft PR against `main`. Read `AGENTS.md`,
`builders/RULES.md`, `docs/CI.md`, and `tools/suite.mjs` first.

## Why

Every merge waits on the full suite: about 41 minutes on 16 shards, and the longest shard takes
about 35. The slowest files on October 16, 2026 were `cdx-qr-themes` (1,429 s), `cdx-pics` (1,222
s), `smoke` (776 s), `scr2` (733 s), `lv7` (615 s), `qr` (569 s), `qr5` (559 s), `cdx-mp2-r4-raster`
(549 s), `qrs-toys` (532 s), and `img-engine` (491 s). Halving the slow files shortens every batch
for every lane.

## The work

1. Profile the ten slowest files: where the time goes (page loads, toy builds, software-GL renders,
   fixed waits, repeated setup).
2. Make them faster without changing what they check:
   - share a page or a built toy across tests where the tests don't change it;
   - wait for state instead of fixed times;
   - render at the size the assertion needs;
   - split a file whose tests are independent, so shards balance.
3. Update `tools/suite.json` seconds from a real Actions run.

Leave the flaky tests of task 100 to task 100 (`cdx-mir`, `fl`, `hh1-toys`, `shr`, `hh5-gems`,
`fx4-engine`, `img-engine`, `sndc-engine`, `live2`, and `phy`), and don't edit `tools/suite.mjs`.
Task 100 may run at the same time.

## Gates

- The whole run on Actions in 25 minutes or less, and the longest shard in 20 or less, measured on
  two runs.
- Every test that existed still exists and checks the same things. The PR lists each changed
  `expect` line; ideally there are none. No threshold widened, no test skipped, and no screenshot
  dropped.
- The same pass and fail results as `main` on the same commit range.

## Rules

Test files and `tools/suite.json` only. No toy or engine changes. American English and the serial
comma. Last, merge `main` and run `node tools/preflight.mjs` (AGENTS.md). PR body: Summary,
Verification (before and after times per file), Deviations, Known issues, and What was cut.
