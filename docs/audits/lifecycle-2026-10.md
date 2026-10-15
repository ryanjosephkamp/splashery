# Lifecycle measurements, October 2026

Codex (GPT-6), October 15, 2026. Task:
[85-lifecycle-measurements](../codex/85-lifecycle-measurements.md).

Raw observations: [lifecycle-2026-10-results.json](lifecycle-2026-10-results.json).

## Scope and method

The original application source is `95da2ddb`. The baseline server used a frozen copy of that
source, with the repository's existing assets and vendor files. Fixes were developed separately; the
baseline server continued serving the original source throughout all three runs. Raw `commit` fields
identify the probe checkout; `baselineSourceCommit` identifies the separately served application
source for the baseline and supplemental baseline cases.

Before publication, the owner approved recreating 16 unpublished commits with GitHub's noreply email
after GitHub rejected the initial push for email privacy. File trees, commit messages, names, and
dates were preserved; commit IDs changed. Raw observations retain the original checkout IDs. Their
published equivalents have identical trees:

| Recorded checkout | Published equivalent |
| ----------------- | -------------------- |
| `f99abb91`        | `16c12782`           |
| `34cbb2fd`        | `532bed39`           |
| `769fa45f`        | `f8e17249`           |
| `e0e3e8ed`        | `af440cd4`           |
| `e0da9c6d`        | `28c91e09`           |
| `26ed9b91`        | `1e3ee702`           |

[The probe](../../tools/lifecycle-probe.mjs) uses Playwright and the Chromium DevTools protocol. It
runs a fresh browser context for each question, at 390 × 844, with the low device profile, WebGL2,
SwiftShader, labs enabled, and adaptation disabled. The browser is Chromium 151.0.7922.173 on the
Linux execution host; Node is 24.19.0. These are accelerated browser workloads, not physical phone
benchmarks.

```sh
npm run serve
SPLASHERY_CHROMIUM=/path/to/chromium node tools/lifecycle-probe.mjs \
  --runs=3 --out=/tmp/lifecycle.json
```

Use `--url=http://127.0.0.1:4174/` to probe a separately served original checkout. `--only=clay`,
`--only=video`, `--only=timers`, and `--only=sliders` select individual questions. The separately
recorded empty-take cases use `--only=emptyRecording --runs=3`. The additional local-file checks use
`--only=fileSource --runs=3`. The complete probe includes both cases. Use `--only=retries --runs=3`
to repeat the busy-readiness QR cases separately.

Heap values are `Runtime.getHeapUsage.usedSize`, collected after `HeapProfiler.collectGarbage`, and
expressed in MiB (1,048,576 bytes). The output also retains backing-store and embedder sizes. These
measurements do not establish total browser, decoder, or GPU memory use. Weak references test
collection of the actual arrays and representative edit objects; they do not keep them alive. The
counters retain handles and call-site strings, rather than callbacks or detached elements.

Headless Chromium keeps the background test targets visible. Hidden UI and ownership tests override
`document.hidden` and `document.visibilityState`, dispatch `visibilitychange`, and leave timers
runnable for 1.1 seconds. This measures application guards and their DOM work, not Chromium's native
background throttling. Recorder cases mark the final take with `document.hidden`: 300 ms for the
stage export, 650 ms for StageRecorder, and the bounded retry period for an empty take. Microphone
cases use Chromium's fake device, started through the normal microphone control. No real device is
accessed. Video to 3D ownership tests use the real flight, walk, credit, and progress helpers with a
small local camera path; they do not reconstruct or train a video.

## 1. Clay and paint

**Verdict: defect in the missing save warning; no edit-history retention defect demonstrated.**

The workload uses a 10,000-splat generated toy. It applies distinct eraser edits through
`app.applyTool()` in batches of 25, and distinct paint stamps through `player.paintAt()` in batches
of 50, yielding to animation frames between batches. Erasing can continue after the clay addition
capacity is reached, so it exercises the unbounded history path. The workload reaches 8,000 clay
edits and 16,000 paint stamps, four times the save caps. Frame intervals are wall-clock intervals
between these batches; JavaScript batch times and paint-history replay times are recorded too.

| Run | Heap: empty → at caps → 4× caps (MiB) | Clay frame median/p95: at caps → 4× (ms) | Paint frame median/p95: at caps → 4× (ms) |
| --- | ------------------------------------- | ---------------------------------------- | ----------------------------------------- |
| 1   | 10.79 → 12.00 → 14.21                 | 35.0/59.8 → 35.5/66.5                    | 60.0/1213.5 → 55.0/100.7                  |
| 2   | 10.79 → 12.01 → 14.22                 | 45.6/48.2 → 37.3/72.6                    | 71.3/1285.4 → 52.1/96.6                   |
| 3   | 10.86 → 12.02 → 14.23                 | 46.6/59.2 → 34.1/55.5                    | 59.6/1235.9 → 52.8/103.1                  |

| Run | Clay batch median/p95 at 4× caps (ms) | Paint batch median/p95 at 4× caps (ms) |
| --- | ------------------------------------- | -------------------------------------- |
| 1   | 1.8/41.8                              | 0.3/0.7                                |
| 2   | 1.8/42.0                              | 0.4/0.8                                |
| 3   | 1.8/38.0                              | 0.4/1.2                                |

The frame intervals include GPU backpressure and, at workload boundaries, replaying the existing
paint history. The accelerated 50-stamp batches are much faster than a normal pointer stream. The
counts and collected histories establish lifetime behavior; these timings are not a phone frame-rate
guarantee.

The exact-cap checkpoints contain only four batches, so their p95 is the maximum of four. The 4×
checkpoints contain 160 batches. The 1.2–1.3-second cap-boundary frames follow bulk paint replay; at
2,400/4,800 edits (16 batches), paint-frame p95 was 1,406.4, 1,395.8, and 1,483.6 ms. These are real
costs of the synthetic software-rendering workload, not evidence that saved-scene caps cause a
live-history lifetime failure. The live histories remain available until the tested cleanup actions.

For each release action, the probe uses an actual sustained editing session, tracks the history
arrays and their first and last entries, performs the action, waits two cleanup periods, and forces
collection. Reset, choosing another toy, generating a different shape, and opening a local splat
file all leave zero clay edits and zero paint stamps. The local file comes from the repository's
small procedural test fixture. The original arrays and representative edits are collectible. A
serialized copy used for the later save checks lives in Node, outside the measured browser heap.

| Run | Action            | Heap before → after (MiB) | Live weak references after GC | Remaining clay/paint |
| --- | ----------------- | ------------------------- | ----------------------------- | -------------------- |
| 1   | reset             | 14.25 → 12.16             | 0/9                           | 0/0                  |
| 1   | toy               | 14.34 → 12.84             | 0/9                           | 0/0                  |
| 1   | source            | 14.97 → 12.97             | 0/9                           | 0/0                  |
| 1   | local file source | 14.12 → 12.16             | 0/9                           | 0/0                  |
| 2   | reset             | 14.23 → 12.17             | 0/9                           | 0/0                  |
| 2   | toy               | 14.34 → 12.84             | 0/9                           | 0/0                  |
| 2   | source            | 14.99 → 12.99             | 0/9                           | 0/0                  |
| 2   | local file source | 14.14 → 12.11             | 0/9                           | 0/0                  |
| 3   | reset             | 14.24 → 12.19             | 0/9                           | 0/0                  |
| 3   | toy               | 14.36 → 12.84             | 0/9                           | 0/0                  |
| 3   | source            | 14.98 → 13.02             | 0/9                           | 0/0                  |
| 3   | local file source | 14.15 → 12.12             | 0/9                           | 0/0                  |

The probe downloads real JSON files, parses their bytes, reopens them through `importJSONFile()`,
and compares the contents. Distinct positions distinguish the oldest entries from the newest.

| Input clay/paint | Saved and reopened, runs 1 / 2 / 3 | Oldest-prefix and reopened-content checks |
| ---------------- | ---------------------------------- | ----------------------------------------- |
| 1900/3800        | 1900/3800 · 1900/3800 · 1900/3800  | All true                                  |
| 2000/4000        | 2000/4000 · 2000/4000 · 2000/4000  | All true                                  |
| 2400/4800        | 2000/4000 · 2000/4000 · 2000/4000  | All true                                  |
| 8000/16000       | 2000/4000 · 2000/4000 · 2000/4000  | All true                                  |

The caps keep the **first** 2,000 valid clay edits and the **first** 4,000 valid paint stamps. Later
edits are dropped. Before the fix, every save, including an 8,000/16,000 session, said only "Scene
saved as JSON." That silently omitted 6,000 clay edits and 12,000 paint stamps.

Reproduction: keep erasing or painting past either cap, save JSON, reopen it, and compare the last
edits with the live session. The fix preserves the caps and the live histories, and states the
number of newest edits omitted. JSON downloads show the warning for 10 seconds; link and embed notes
carry it too. The note is captured with the scene before asynchronous encoding, so an edit or toy
switch during compression does not change its counts.

## 2. The video scrub bar

**Verdict: not a defect for the suspected accumulating animation-frame loops.**

The probe warms the Screen toy and its existing local video sample once, then opens the sample as a
local `File` and switches to Basketball 20 times. It counts pending callbacks of the actual scrub
`tick()` function, samples after cycles 1, 10, and 20, forces collection, and weakly tracks the
removed scrub controls.

| Run | Heap before → cycle 1 → cycle 10 → cycle 20 (MiB) | Pending loops after 1/10/20 closes | Retained scrub controls after 1/10/20 closes |
| --- | ------------------------------------------------- | ---------------------------------- | -------------------------------------------- |
| 1   | 12.00 → 12.36 → 13.28 → 13.52                     | 0/0/0                              | 1/1/1                                        |
| 2   | 12.04 → 12.37 → 13.35 → 13.66                     | 0/0/0                              | 1/1/1                                        |
| 3   | 12.11 → 12.38 → 13.32 → 13.56                     | 0/0/0                              | 1/1/1                                        |

One callback is pending while a scrub control is attached; none remain after it leaves the page. The
last panel retains one scrub control, rather than accumulating one per close. Heap growth by itself
is not evidence of live scrub loops. The loop already checks `scrub.isConnected` before rearming
itself, so no production change was made for this question.

## 3. The 250 ms timers

**Verdict: defect in hidden visual updates; no accumulating timer instances demonstrated.**

A source inventory found ten 250 ms interval sites and three bounded repeating timeout sites. The
generator debounce, stage resolution restore, and help-line placement are one-shot timeouts, so they
are outside the repeating-timer question. Sound lab's audio watchdog and recorder-panel watchdog use
200 ms, not 250 ms.

Each control is measured after 20 real toy rebuilds and 20 switches away and back. Timer-only cases
keep the phone layout and use a 96 × 96 stage target to avoid benchmarking rasterization. The song
transport and shared live panel are exercised through Song landscape; the shared game and song bar
is also exercised through Chess set and Toy piano. The probe waits 550 ms after replacement,
allowing two cleanup periods.

| Interval site        | After 20 rebuilds (runs 1/2/3) | After 20 away-and-back switches | After leaving             |
| -------------------- | ------------------------------ | ------------------------------- | ------------------------- |
| ui.js: game/song bar | 1 / 1 / 1                      | 1 / 1 / 1                       | 1 / 1 / 1 (page lifetime) |
| Sound lab            | 1 / 1 / 1                      | 1 / 1 / 1                       | 0 / 0 / 0                 |
| Song transport       | 1 / 1 / 1                      | 1 / 1 / 1                       | 0 / 0 / 0                 |
| Shared live panel    | 1 / 1 / 1                      | 1 / 1 / 1                       | 0 / 0 / 0                 |

| Hidden UI site               | Callbacks in 1.1 s (runs 1/2/3) | Synchronous DOM mutations |
| ---------------------------- | ------------------------------- | ------------------------- |
| Game/song bar                | 4 / 4 / 5                       | 0 / 0 / 0                 |
| Sound lab controls           | 4 / 4 / 4                       | 16 / 16 / 16              |
| Song transport               | 4 / 4 / 4                       | 0 / 0 / 0                 |
| Live controls, microphone on | 4 / 4 / 5                       | 40 / 40 / 50              |

| Toy            | Heap before → after rebuild/switch workload (MiB), runs 1 / 2 / 3 |
| -------------- | ----------------------------------------------------------------- |
| sound-lab      | 27.89 → 13.28 / 27.96 → 13.38 / 29.18 → 13.35                     |
| song-landscape | 20.02 → 17.00 / 19.94 → 16.92 / 20.02 → 16.92                     |
| chess-set      | 17.33 → 17.50 / 17.33 → 17.35 / 17.34 → 17.40                     |
| toy-piano      | 17.94 → 17.77 / 17.82 → 17.46 / 17.74 → 17.49                     |

Flight, walk, and capture-credit helpers are mounted and invalidated 20 times. Hidden sampling
happens while the helpers are still mounted. The progress card is a singleton, so it has one
lifetime timer until its root is removed. Recording timers are scoped to takes, rather than toys;
both recorder implementations are exercised with 20 actual canvas recording attempts. A separate
undrawn canvas exercises the bounded empty-take retry 20 times. QR scan-readiness retries are
measured after 20 switches. An additional fixture holds the real readiness gate with `app.busy`,
observes an active retry before each switch, samples it while hidden, and then leaves it busy until
its attempt limit expires. Ordinary toy-switch listeners remain active. The initial unblocked switch
samples are also retained in the raw results.

| Other interval site            | Open count, runs 1/2/3 | Count after 20 ownership invalidations or takes | Hidden callbacks                   |
| ------------------------------ | ---------------------- | ----------------------------------------------- | ---------------------------------- |
| video3d/flight.js              | 1 / 1 / 1              | 0 / 0 / 0                                       | 4 / 4 / 4                          |
| video3d/walk.js                | 1 / 1 / 1              | 0 / 0 / 0                                       | 4 / 4 / 4                          |
| video3d/credit.js              | 1 / 1 / 1              | 0 / 0 / 0                                       | 4 / 4 / 4                          |
| video3d/panel.js               | 1 / 1 / 1              | 1 / 1 / 1                                       | 4 / 4 / 4                          |
| exports.js: recording          | 1 / 1 / 1              | 0 / 0 / 0                                       | Continues during final hidden take |
| live/record.js: stage recorder | 1 / 1 / 1              | 0 / 0 / 0                                       | Continues during final hidden take |

The progress card remains at one timer while its singleton root remains connected; removing that
root leaves 0 / 0 / 0 timers. Mounted ownership helpers made zero hidden synchronous DOM mutations
in all three runs.

| Recording attempts (20 per run) | Nonempty / empty, runs 1 / 2 / 3 | Pending take intervals after the final stop |
| ------------------------------- | -------------------------------- | ------------------------------------------- |
| Stage export                    | 17/3 / 20/0 / 8/12               | 0 / 0 / 0                                   |
| Live StageRecorder              | 20/0 / 20/0 / 20/0               | 0 / 0 / 0                                   |

Some 300 ms export attempts produced no encoded data on this host; their empty-take retries also
completed and released the recording timer. This is reported as recording-fixture output, rather
than a new timer defect.

| Repeating timeout site              | Pending while busy at cycle 20, runs 1/2/3 | Pending after toy switch | Pending after expiration | Hidden behavior                                  |
| ----------------------------------- | ------------------------------------------ | ------------------------ | ------------------------ | ------------------------------------------------ |
| packs/qr.js                         | 1 / 1 / 1                                  | 0 / 0 / 0                | 0 / 0 / 0                | 5 / 5 / 4 callbacks in 1.1 s                     |
| packs/qr-lab.js                     | 1 / 1 / 1                                  | 0 / 0 / 0                | 0 / 0 / 0                | 4 / 4 / 5 callbacks in 1.1 s                     |
| exports.js: empty-take finish retry | Take-scoped                                | Not toy-owned            | 0 / 0 / 0                | 8 / 8 / 8 callbacks during the final hidden take |

Each dedicated empty-take run made 20 attempts, observed 20 expected empty-take errors, and counted
160 retry callbacks: eight per take, then zero pending retries. The QR limits are 40 readiness
attempts and 60 damage-readiness attempts, respectively.

The game/song bar and song transport already avoid hidden visual refreshes. Flight, walk, credit,
and progress timers perform ownership checks; recording timers preserve the requested recording and
its time limit. Those callbacks can continue while hidden without representing a timer leak. QR
readiness retries perform bounded checks until they expire.

Sound lab refreshed its tone, metronome, and note controls while hidden. The shared live panel also
refreshed microphone status while hidden. These were real DOM writes with no visible consumer. The
fixes guard those visual updates with `document.hidden`, while retaining detached panel cleanup,
recording-stop checks, and other lifetime work.

Reproduction: open Sound lab, turn on the fake microphone, mark the page hidden with the probe, and
inspect the per-site hidden mutation deltas. The regression tests fail on the original unconditional
updates and pass when those updates stop.

## 4. Generator sliders

**Verdict: defect, visible incorrect values during startup.**

The probe disables the network cache, throttles the CPU by 6×, and applies 150 ms network latency,
200,000 bytes/s download throughput, and 90,000 bytes/s upload throughput. Before application
scripts run, a frame sampler is installed. It tries the ordinary More and Make actions as soon as
their handlers respond, while the first toy can still be loading. It records range values only with
an explicit visibility and viewport-intersection check.

| Run | First visible values: splats/jitter/roughness/noise | Correct values | Observed incorrect-value window (ms) |
| --- | --------------------------------------------------- | -------------- | ------------------------------------ |
| 1   | 120000/50/50/50                                     | 60000/35/30/25 | 9983.4                               |
| 2   | 120000/50/50/50                                     | 60000/35/30/25 | 10183.5                              |
| 3   | 120000/50/50/50                                     | 60000/35/30/25 | 10233.0                              |

The visible controls initially showed 120,000 splats and 50/50/50, then jumped to the low profile's
60,000 splats and 35/30/25. Waiting for `data-ready` before opening Make would miss this window. The
fix initializes the generator and controls immediately after the device profile is known, before the
first toy load can yield another paint. The regression holds the first toy's asset response, opens
Make through the phone controls, and checks all values before releasing the asset.

## Fixes and verification

| Fixed behavior                       | Run 1          | Run 2          | Run 3          |
| ------------------------------------ | -------------- | -------------- | -------------- |
| First visible generator values       | 60000/35/30/25 | 60000/35/30/25 | 60000/35/30/25 |
| Observed incorrect-value window (ms) | 0.0            | 0.0            | 0.0            |
| Hidden Sound lab DOM mutations       | 0              | 0              | 0              |
| Hidden live-panel DOM mutations      | 0              | 0              | 0              |

The download regression checks 2,400/4,800 edits, the exact retained prefix, the 400/800 omission
warning, the unchanged live history, and the reopened contents. It also checks link/embed warnings
while live counts change during asynchronous compression, and verifies that saving exactly at the
caps produces no warning.

A separate regression holds the next toy's asset response and checks that saving during the
transition does not label the previous toy's discarded clay as capped. The warning counts only
history included in the captured scene.

Every defect has a regression in [cdx-life.spec.mjs](../../tests/cdx-life.spec.mjs), observed
failing before its fix and passing afterward. Engine changes use commits titled "Engine: …"; the
Sound lab change is a separate pack commit. No toy geometry, sound, behavior, scene schema, save
cap, or vendored code was changed.

The branch incorporated `main` at `ea35f3de` after the measurements, then `d4df5998` before
publication. Final focused checks ran on merge `765cee97`; the baseline numbers continue to describe
the frozen `95da2ddb` application source, not the later stage implementations.

All browser checks used `SPLASHERY_CHROMIUM=/usr/bin/chromium`:

- `tests/cdx-life.spec.mjs` and `tests/cdx-p3d4-scene-swap.spec.mjs`: six passed in 52.6 seconds
  after the latest merge. This covers all five lifecycle regressions and the ordinary scene-swap
  retirement check.
- `tests/sll.spec.mjs`, `tests/live-engine.spec.mjs`, `tests/smoke.spec.mjs`, `tests/kit.spec.mjs`,
  `tests/taps.spec.mjs`, `tests/help.spec.mjs`, and `tests/hta.spec.mjs`: 165 passed, with one
  trace-artifact failure, in 32.0 minutes. A concurrent focused run had removed files from the
  shared Playwright output directory. The affected 360-pixel overflow case passed alone after the
  latest merge in 9.4 seconds, using a separate output directory. No assertion failure remains
  unresolved.
- `tests/unit.spec.mjs`: 20 passed in 10.1 seconds.
- The original four lifecycle cases also passed three consecutive repetitions: 12 passes in 2.8
  minutes. The asynchronous save-snapshot and pending-toy cases were each reproduced failing before
  their fixes, then passed individually and in the final lifecycle run.

`node tools/check-packs.mjs sound-lab` passed for Sound lab and Sound recorder. The embed-transfer
check measured 9.2 MB. Phone and desktop screenshots were inspected, then generated changes to the
repository's standard screenshots were restored. `npx prettier --check .`,
`node tools/us-english.mjs --diff`, and `git diff --check` passed before the push.

No requested measurement was cut. The full repository suite was not run locally; task 85 reserves it
for the Operator's merge PR or the `full-suite` label.

Rule check: E1 — the owner approved recreating the 16 unpublished commits solely to replace the
private email with the GitHub noreply email. No force-push.
