# Quartz and audio evidence

| Observation | Original | Final |
| --- | --- | --- |
| Quartz target assertions | 100/100 passed | 30/30 passed |
| Runs with unintended intact-neighbor unpins | 94/100 | 0/30 |
| Unintended neighbor unpin events | 224 | 0 |
| Target unpin events | 0 | 0 |

Both quartz phases used four fully parallel workers and the same two steady
CPU load threads (PID 1469), pinned Node 22/Chromium 141, Mesa llvmpipe, and
frozen routes overriding only HandsOn source. There were no retries, skips,
or interruptions. The original phase took 580.6 seconds; the final phase
took 163.0 seconds. The raw-backup gap is outside observation.

The natural historical target failure was not reproduced. Its
broken=false,pinned=false state specifically matches generic collision
handling freeing an intact joint: normal snap/hit/spill paths mark it broken
before freeing it, and reseating pins before marking it intact. Native
projectile and queued-hit regressions reproduce the invalid state directly.
Actual quartz neighbor traces establish the same transition naturally. Keep
the target assertion rate distinct from the observed invariant rate.

The queue repair handles impacts before joint reseating. The generic knock
guard preserves intact posed joints while retaining ordinary piece knocks,
socket knock-outs, and opt-in parent impact breaks. All 17 native joint tests
passed. Related native validation passed 52/53 under concurrent root browsers;
the unrelated SoftParts-only timing benchmark measured 1.086 ms against 1 ms.
The unchanged isolated benchmark later passed at 0.410 ms. The full final
Gems browser spec passed 5/5 before stress.

| Audio control | Observed delay | Result at unchanged <30 ms limit |
| --- | --- | --- |
| Old marker, 80 ms after acceptance before return | 5.9 ms | Passed; masked the delay |
| Stored-tap observer, no injected delay | 6.2 ms | Passed |
| Stored-tap observer, same 80 ms stall | 86.3 ms | Failed as required |
| Stored-tap observer, 80 ms Sound.play delay | 103.5 ms | Failed as required |

The accessor timestamps actual MotionDriver tap storage and includes all
remaining action work and audio dispatch. Sample presence passed before both
expected timing failures. Every original sndc expect line and the complete
wall-plus-native-lead formula remain unchanged. The committed spec contains
no injected delays. Its final 30-run proof is pending; the prior old-marker
Actions 30/30 is separate evidence.

No original expect expression changed in sndc, live2, or hh5-gems. Engine
tests add strict regression checks; no original native expectation was
loosened. Native failure trace ZIPs from earlier workspace instances were
lost, while their assertion logs/JSON and complete V8 timelines survived.
The current audio control trace ZIPs are included in these receipts.
