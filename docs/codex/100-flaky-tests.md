# Codex task 100: flaky tests, fixed at the root (a Goal run, up to 12 hours)

**Branch:** `codex/flaky-tests`, cut from `main`. One draft PR against `main`. Raw logs and stress
runs go on `codex/flaky-tests-clips`, never merged. Read `AGENTS.md`, `builders/RULES.md`,
`docs/CI.md`, and `tools/suite.mjs` first.

## Why

Every merge batch waits on a 16-shard run, and the same tests keep failing on a busy runner, then
passing alone. Each one costs a review round and hides real failures. Task 50 (#581, stalled since
October 15) started this; read it, keep what still helps, and say in your PR what you took. The
Operator closes #581 when yours merges.

## The tests

Each failed at least once on GitHub Actions between October 15 and 17, 2026:

| Test                     | What it did                                                                  |
| ------------------------ | ---------------------------------------------------------------------------- |
| `cdx-mir:294`            | measured drift over the baseline (twice); passed alone                       |
| `fl:137`                 | failed in a shard, passed alone                                              |
| `hh1-toys:258`           | teddy bear's arms and head didn't settle in time (three times); passed alone |
| `shr:202`                | the Share preview sheet after Stop (twice); passed alone                     |
| `hh5-gems:154`           | the quartz point didn't click back in time (three times); passed alone       |
| `fx4-engine:79` (webgpu) | timed out at 240 s on a busy runner (a loop over every kit toy)              |
| `img-engine:85` (webgl2) | "bouncy-ball: pixels that changed a lot"; failed alone too, then passed      |
| `sndc-engine:122`        | the dice sample started 59.7 ms after the tap (limit 30), then not at all    |
| `live2:207`              | the click track missed 50 ms once; passed 5 of 5 alone                       |
| `phy:64`                 | on `tools/suite.json`'s known list                                           |

## The work

1. **Reproduce first.** Find a stress recipe that makes each test fail at a measurable rate on this
   container or on Actions (for example, `--repeat-each=30 --workers=4` beside a CPU load, or two
   shards at once). Record each test's failure rate before any fix.
2. **Find each cause.** Common ones: waiting on wall time instead of on state, a camera or physics
   settle that a slow frame stretches, a timer racing a frame, audio scheduled against a clock that
   jumps, or a loop that is simply too long for its timeout. Name the cause for each test.
3. **Fix the cause.**
   - In the test: wait for the state the test means (a settled pose, a ready sample, a finished
     glide) instead of a fixed time.
   - In the code: fix a real race in its own "Engine:" commit, with a test.
   - Split a long loop (`fx4-engine:79`) into one test per toy, or per group. Don't raise its
     timeout.
4. **Prove it.** Each fixed test passes 30 of 30 under the same stress recipe. Then run the whole
   suite twice on Actions: no failure from this list. Take `phy:64` off the known list only if it
   passes too.

## Gates

- No assertion loosened: no wider tolerance, no lower count, no skipped step, and no retry. Changing
  a fixed wait into a wait for state is fine. Every changed `expect` line is listed in the PR with
  why.
- No test removed or quarantined. `tests/taps.spec.mjs` untouched.
- Each test's failure rate, before and after, in one table in the PR body.
- Any test you can't fix within the run: its cause, your evidence, and the fix it needs, as a row in
  Known issues.

## Rules

Test and runner files, plus "Engine:" commits for real code races. No toy behavior changes. American
English and the serial comma. Last, merge `main` and run `node tools/preflight.mjs` (AGENTS.md).
Progress notes in the PR body at 4 and 8 hours ("WORKING: …"). PR body: Summary, Verification,
Deviations, Known issues, and What was cut.
