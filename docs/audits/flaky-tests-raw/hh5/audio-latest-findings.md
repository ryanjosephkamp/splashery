The final uninstrumented dice run passed 29/30, with one 31.100000000093132 ms failure against the unchanged 30 ms limit. It ran four fully parallel workers and two steady CPU burners on pinned Node 22.20/Chromium 141 with SwiftShader. No retries or skips were used. Its trace, report, log, and frozen hashes are preserved under `sndc-final/` and in functionstore. The trace returned only total delay, so its individual wall and native-clock values cannot be recovered.

The subsequent diagnostic batch completed all 30 cases under the same worker/burner/runtime/renderer recipe, adding boundary and scheduler observers. All 30 passed, with delays 0.8–9.8 ms. This does not resolve or replace the earlier failure and is not a fresh acceptance proof.

| Diagnostic measurement | Observed range |
| --- | --- |
| Accepted tap to `Sound.play` entry | 0.2–1.2 ms, median 0.4 ms |
| `Sound.play` entry to original source detector | 0.4–4.9 ms, median 0.7 ms |
| Complete post-acceptance wall interval | Up to 5.3 ms |
| Remaining native scheduling lead | Up to 5 ms |
| Input-panel refresh | 0–0.1 ms |
| Native source creation | 0–1.3 ms |
| Native buffer assignment | 0–0.1 ms |

No native-clock regression appeared. Larger gaps occurred at different small call/observer boundaries. Scheduler counters show contention but cannot identify the earlier failure: actual sampling intervals had a 26.1 ms median, 51.7 ms 95th percentile, and 516.8 ms maximum. Reads can themselves be delayed, and kernel accounting can credit earlier waits later. The observer used 8.655 CPU seconds over 224.189 wall seconds, about 0.97% of the four-CPU budget. Raw counters and sampling cost are preserved in `sndc-boundaries-cpu.jsonl.gz`.

A separate one-worker, no-burner control added an 80 ms synchronous delay before calling the real UI refresh. The original app ordering failed at 88.9 ms (83.9 ms wall plus 5 ms native lead). A cache-only app source that dispatched audio before refreshing UI passed at 5.6 ms (0.6 ms wall plus 5 ms native lead), with the same stall and real decoded/native sample playback. This proves the generic ordering hazard. Dice has no input panel, and its natural refresh measured at most 0.1 ms, so this control does not establish the cause of the natural dice miss. The app candidate remains cache-only.

All existing expectation lines and the first-sample delay formula are unchanged in both diagnostic specs. No production source, committed test, or runner was changed during this phase. Both CPU burners and the scheduler observer stopped after the complete batch. No further browser run is pending.

The dice failure remains unresolved. There is no evidence-supported Engine fix to ship from this diagnostic phase.
