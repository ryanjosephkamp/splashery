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
