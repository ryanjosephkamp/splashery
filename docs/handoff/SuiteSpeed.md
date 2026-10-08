# Lane Suite speed: a faster full test run

Prefix `spd`. Branch `claude/lane-suite-speed`. Model: Opus 5.5, default effort. Owns this file, the
"Running the suite fast" section of `docs/OPERATING.md`, and small, additive speed changes to the
test files and `playwright.config.mjs`. How lanes work: [OPERATING.md](../OPERATING.md).

## Brief

Written by the Operator on October 7, 2026 (the owner's pick).

The full Playwright suite
(`SPLASHERY_CHROMIUM=/opt/pw-browsers/chromium npx playwright test --workers=1`) takes the
Integrators hours on every merge, and that is now the biggest steady cost on the owner's weekly
usage. Make it much faster without weakening any test.

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

WORKING: October 8, 2026, 08:30 UTC. Baseline measured; the Worlds boot fixed (50 min to 32 min in
the four Worlds files); tracing the slowest other files next.

## Notes

### The baseline (main at 95610620, October 7 to 8, 2026)

The cloud container: 4 CPUs, 15 GB, Chromium with SwiftShader. Each file ran on its own
(`--workers=1`), because a single run of the whole suite was lost twice to container restarts (the
container restarts when the session sits idle for a while; the first run died at test 797 of 1,556
after 2 h 42 min).

- 170 files, 1,556 tests: 1,551 passed, 5 failed (all flakes or one-offs, below).
- **5 h 24 min** in test files, one after another.
- The time is concentrated: the 10 slowest files take 34% of it, the 20 slowest 50%, the 80 slowest
  88%. The slowest 10% of tests take about 87% of the time. 36 files take under 15 s.
- App boot is cheap: the toy box reaches `data-ready` in 1 to 1.5 s and a toy switch takes about 3
  s. Booting a fresh page per test is not where the time goes.
- One worker already keeps about 3 of the 4 CPUs busy: Chromium's GPU process (SwiftShader) uses
  about 2.3 cores while a test draws.

Failures in the baseline (each passed in the earlier, lost full run, or on a rerun):

- `chs-engine:11` (energy read 0 after a fixed 200 ms wait: timing).
- `hl1:75` (jellyfish rest height: "Level 1 gaps").
- `qrs-toys:37`, `smoke:1504` (the phone shelf grid), `stm:366` (a sample's text).

### Where the time goes

1. **Worlds boot (fixed).** Every `/worlds/` page took about 54 s to `data-ready`, at every tier.
   The build awaits a drawn frame (`requestAnimationFrame`) about 50 times to paint its progress
   bar, and each frame of the loading view takes about a second in SwiftShader at 1280x720 (117 ms
   at 320x240). The main thread sat idle for 51 of the 56 s. `wd`, `wdh`, `wdr3` and `chr` boot it
   dozens of times. With `?clock=manual` (which only the tests and the clip tools use) the build now
   yields with a zero-delay timer instead: the boot takes about 5 s, and those four files went from
   2,992 s to 1,928 s (50 min to 32 min) with all 39 tests passing and their eight screenshots
   pixel-identical to the baseline's.
2. **Tracing** (`trace: "retain-on-failure"`) costs about 5%: a sample of eight files took 909 s
   with `--trace=off` against 983 s. Not worth losing the failure traces.
3. **Two files at once** on one container gives only about 1.2x (the same sample: 13 min against 16
   min), because each file runs about 1.5x slower: SwiftShader already fills the CPUs. Separate
   containers (`--shard`) scale; one container doesn't.

## Known issues

## For the Operator
