# Full-suite records

These copies preserve GitHub Actions summaries beyond the artifact retention period. A test that
failed in its shard still counts as failed when its automatic isolated recheck passes. No existing
assertion, threshold, retry setting, or skip changed for Task 95.

- [Initial implementation](38878311851-summary.md), commit `dc2bffa`: five Task 95 regressions
  subsequently fixed, four other checks passed alone, and one preexisting Pebbles failure.
  [Run](https://github.com/ryanjosephkamp/splashery/actions/runs/38878311851).
- [Compatibility fixes](38885190255-summary.md), commit `84b10ad`: all five Task 95 regressions
  pass, and Pebbles passes. Five other checks failed their shards and passed alone.
  [Run](https://github.com/ryanjosephkamp/splashery/actions/runs/38885190255).

The [final-source first attempt](38909967302-a1-summary.md) covered all 325 files and 2,852 tests:
2,848 passed, three failed, and one preexisting conditional skip. All three failures passed alone;
they remain failures in that attempt. [Timing data](38909967302-a1-times.json) and
[initial failure excerpts](38909967302-initial-failures.md) are retained. Clean shard reruns were
pending at the Goal deadline; follow
[the run](https://github.com/ryanjosephkamp/splashery/actions/runs/38909967302) for results that
arrive afterward. archived here too.

## Attempt 2 reviewed on October 16

The completed
[run 38909967302](https://github.com/ryanjosephkamp/splashery/actions/runs/38909967302) on
`f5f8cef90` reports 2,849 passed, two failed, and one existing conditional skip across 325 files and
2,852 tests. The printed-front/white-reverse WebGPU check failed both in the shard and alone. The
Settings-panel sizing check failed in the shard and passed alone; it still counts as a failure. The
archived [attempt-2 summary](38909967302-a2-summary.md) and [timings](38909967302-a2-times.json)
supersede the incomplete status recorded at the original Goal handback. Fresh head full-suite
validation is pending the Operator's label after the follow-up push.
