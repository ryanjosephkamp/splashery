# Busy-runner flaky tests — October 17, 2026

## Summary

Codex built this task 100 repair and stress harness. **WORKING:** started October 17, 2026, about
02:06 UTC; deadline 14:06 UTC. The PR stays a draft. The goal is every variant 30/30 under recorded
load, followed by two clean full Actions runs.

The published repairs observe real native audio output and accepted motion, wait for the fitted
camera and its rendered projection, split each shader comparison by toy without increasing its
240-second deadline, and fix two real physics collision races in separate Engine commits.
Resource-observer and lossless pixel-transport repairs are being recovered and verified for
publication.

Task 50 [#581](https://github.com/ryanjosephkamp/splashery/pull/581) supplied the explicit turntable
shutdown and camera-fit readiness check. The camera repair also requires an actual completed frame
to refresh the cached projection. Its unrelated runner and test changes were not copied.

## Verification

Baseline: immutable main `ceb51de7a015377d7f350119c27a792fc1a8a66d`.
[Focused Actions baseline](https://github.com/ryanjosephkamp/splashery/actions/runs/38997782641): 10
repetitions, four workers, two constant CPU burners, Node 22, Chromium 141. Each split toy and both
mirror/preview variants require separate 30/30 results.

| Original case   |                                                                   Before failures / completed |                          After passes / completed | Cause and status                                                                                                                                                                              |
| --------------- | --------------------------------------------------------------------------------------------: | ------------------------------------------------: | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| cdx-mir:294     |                                                                    Still 0/10; low-light 0/10 |                                           Pending | Historical still drift 0.981 against 0.95; render/sampling cause still under investigation.                                                                                                   |
| fl:137          |                                                     0/10 CPU stress; 1/1 filled timing buffer |                     1/1 filled buffer; 30 pending | The bounded Resource Timing buffer drops late module entries. Full request observation retains the same assertions.                                                                           |
| hh1-toys:258    |                                           0/10 CPU stress; earlier controlled camera failures |                                           Pending | Unfinished camera fit and stale projection alter the unchanged throw.                                                                                                                         |
| shr:202         |                                                                              Baseline running |                                           Pending | Preview missing after Stop; native recorder and dialog lifecycle diagnosis pending.                                                                                                           |
| hh5-gems:154    | 0/10 Actions and 0/10 initial local stress; native causal regressions fail before each repair | Native 17/17; browser gems 5/5; target 30 pending | Queued impacts can undo a later reseat; generic impacts can also free an intact joint without breaking it. Real collision controls preserve ordinary knock-out and configured joint breaking. |
| fx4-engine:79   |                                                                               10/10 timed out |                                   Pending per toy | Three old/new/new comparisons shared one deadline. Split by toy; assertions and deadlines unchanged.                                                                                          |
| img-engine:85   |                                                                                8/10 timed out |                                   Pending per toy | Loop deadline reproduced; the historical bouncy-ball pixel failure still needs its own cause proof.                                                                                           |
| sndc-engine:122 |                         0/10 Actions; local busy-runner failures before workspace replacement |                                           Pending | Test timestamp precedes motion acceptance; a running native context can still be at time zero. Require the decoded sample and actual clock progress.                                          |
| live2:207       |                                                                                  4/10 Actions |                            Pending retained proof | Wall-origin matching loses/misidentifies clicks when native audio progresses differently. Measure actual samples and draws on native output time.                                             |
| phy:64          |                                                                                         10/10 |                                           Pending | Turntable prevents the fit wait from settling; stale projection sends drag rays to the wrong coordinates.                                                                                     |

The earlier local song repair passed 30/30 twice, and delayed-playback controls failed the unchanged
limits. Those raw caches were lost in a workspace replacement, so they do not count as final
acceptance.
[The independent 30-run campaign](https://github.com/ryanjosephkamp/splashery/actions/runs/38999164406)
for song, sample, physics, and teddy is queued on immutable published source.

The native physics regressions use the actual world, joints, and Hands-on modules. The same real
4.041312-radius-per-second collision fails with old processing order and passes after the repair. A
real projectile also reproduces the intact-joint state violation; ordinary pieces, sockets, and
configured parent-impact breaking retain their behavior. All 17 Hands engine B native tests and all
five browser gem tests passed. One unrelated SoftParts-only wall-time benchmark failed under
competing load and is being checked in a quiet interval.

Prettier, American English, and the required browser gem gate passed before the published physics
commits. Full acceptance, final main merge, preflight, and two clean full Actions runs remain
pending. `phy:64` remains known; `tests/taps.spec.mjs` is untouched.

Changed existing expect expressions in the pending fluid repair: the three empty-list checks call
the complete request collector instead of a page Resource Timing query. The matchers and empty lists
stay identical. Shader expect lines only moved with the per-toy split; expressions are unchanged.
Audio and camera assertions are unchanged. New Engine assertions are strict regressions and
preservation controls.

## Deviations

The execution environment disconnected and returned as a fresh checkout twice, at about 03:25 and
03:43 UTC. Published source and independent Actions receipts survived; unpublished candidates are
reconstructed, and lost acceptance receipts must be repeated. Completed helper reports are also
backed up outside the execution workspace.

Native Git publication first failed with transport errors and then GitHub email-privacy protection.
The official GitHub API published identical verified file bytes with separate logical commit
boundaries, a checked expected branch head, and no force update. Public source and test blob
identities were fetched back and verified. No published history was replaced.

## Known issues

Remaining: establish the mirror and bouncy-ball pixel causes, diagnose the recording preview,
complete paired stress measurements and 30/30 proofs for all variants, preserve the raw evidence
branch, and complete both full Actions runs and preflight. The quartz historical symptom is matched
by native invariant failures; longer original/candidate quartz stress is pending.

## What was cut

Nothing. No tolerance, count, gesture, comparison, sample, or deadline was weakened. No target test
was skipped, removed, quarantined, or retried. Existing adapter guards remain; selected acceptance
renderers must actually be available. Raw logs and stress evidence belong only on
`codex/flaky-tests-clips`, which must never be merged.

Rule check: none.
