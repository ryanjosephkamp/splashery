# R12 review queue — prepared, not authorized or launched

MIT. Made by Ryan with Codex (GPT-6). These outside-only scripts prepare diagnostic replay movies from actual strict benchmark artifacts. Root owns all actual process bindings, final authorization, and detached launch. Preparation does not inspect live processes, signal anything, launch a browser/GPU/native case, alter a repository or frozen runtime, or create review movies.

The pending declaration has null authorization, candidate provenance/source hashes, root receipt hash, and timed-work bindings. `root-receipt-template.json` contains null identities/descendants, not invented observations. `root-receipt.schema.json` describes root's future actual receipt. No actual root receipt or launch receipt exists. R11/R12 orchestration scripts and the immutable R12 review/protocol files are recorded in `unchanged-inputs.json` and preserved.

## Inputs and selection

The CPU planner imports the unchanged R12 `v3d-review.mjs` selection checks and frozen benchmark verification exports. It requires the exact R12 manifest, actual `main-master-r1` and `candidate-r12-paired-master-v1`, valid cohort/provenance/input/source inventories, two finished/accounted rows with complete held-out proof and finite scores, identical reference images/times, actual model/evaluation/render/reference artifact hashes, exact `result.json` row identity, and matching model metadata stats. It hash-binds every file in each available paired case; metadata bindings are newly observed, not historical original benchmark hashes. A corrupt/missing artifact rejects the plan rather than silently skipping to another pair.

It selects the first ten available verified phone pairs in manifest order, independent of scores, and passes explicit `--ids`. Every plan remains unranked because baseline harness failures prevent honest full-corpus best/worst ranking. All twenty source statuses/reasons remain in available plan inventories; missing masters yield an explicit waiting record with no inferred rows. Fewer than ten paired successes remain fewer than ten movies. Exact reproduction of every original held-out render remains mandatory inside the unchanged replay tool before any movie capture. No pose fitting, alignment, source-time relabeling, model training, sharpness manipulation, timing recovery, or acceptance claim is introduced.

Plan snapshots resolve master aliases once to actual immutable directories. The render invocation uses those captured directories; receipts retain the logical master input paths. Observed rows and paired case inventories must be append-only and byte-consistent in later plans. Earlier plans remain in `plan-history.jsonl`.

Optional CPU-only planning, without authorization or any process inspection:

```sh
python3 /workspace/v3d-r4-media/queue-r12-review-r1.py --plan
```

Preparation's first actual plan reports `candidate-r12-paired-master-v1` absent and selects no pairs. It is not a fabricated benchmark result.

## Root finalization and launch

1. Root copies `root-receipt-template.json` to a separate ACTUAL receipt and fills the actual R12 paired provenance/source hashes, explicit nonempty authorization, capture timestamp, and all four roles: `main-native`, `r12-coordinator`, `r12-samples`, `r11-remaining`. Every root needs its true `{pid: integer, startTicks: decimal-string, command: original-string-array}` identity from root's actual receipts. Every descendant dictionary must be complete, keys must match child PIDs, and `completeObservedDescendants` must be true. A dead root still requires its actual historical identity; an empty/unbound authorization never suffices. No identities from tests/templates may enter the real receipt. This helper did not inspect or fill root identities.
2. Root finalizes and checks the receipt. These modes do not inspect live PIDs, signal, or launch a browser:

```sh
python3 /workspace/v3d-r4-media/queue-r12-review-r1.py --finalize-root-receipt=/ABSOLUTE/PATH/TO/ACTUAL-ROOT-RECEIPT.json
python3 /workspace/v3d-r4-media/queue-r12-review-r1.py --check
```

Finalization preserves the pending declaration, copies the actual root receipt byte-for-byte, and binds script/test/manifest/unchanged review+five protocol bytes and the complete passing CPU log. Existing final receipt/finalized declaration causes refusal. Root's actual receipt must never be a template.

3. Only root may launch the watcher, with its own detached-launch receipt:

```sh
python3 /workspace/v3d-r4-media/queue-r12-review-r1.py --run
```

The watcher may be started early to retain newly observed descendants, but rendering starts only at or after **2026-10-15 16:15:00 UTC** and after every root-bound identity plus all initially/newly observed descendants has ceased. It polls once per second, retains descendants after their parent/root exits, and discovers later children from retained live descendants. PID reuse and zombies do not block; process-title/exec changes with the same startTicks do not release ownership. Permission/inspection failures fail closed. This queue never signals timed-work roots or descendants; it does not infer external exit causes.

After the quiet gate, a fresh CPU plan is verified and the gate is checked again. No render occurs if there are no verified pairs, if the deadline window closed, or if `review-r12-r1` already exists. A single launch reservation is persisted before spawning; restarts cannot retry or create a second invocation. There is no `--retry`.

The one unchanged tool invocation uses phone panes **390×844**, **5 seconds**, **12 fps**, **90000 ms per case**, main URL **4174**, candidate URL **4183**, and up to ten explicit IDs. Saved timeline receipts disclose actual common source span/movie length. The tool retains mandatory exact held-out RGBA checks and original per-version cleanup behavior. Movies show production replay, not physical-phone or isolated software-GPU timing.

## Deadline and evidence retention

The queue stops accepting a new render at **16:31:25 UTC**. If its own render remains active then, it begins bounded SIGTERM cleanup of only its newly launched, exact-identity-owned render subtree. At **16:31:29 UTC**, it requests SIGKILL for surviving owned identities, leaving a one-second host scheduling margin before the **16:31:30 UTC absolute stop**. Root's original timed-work bindings never enter the owned-render cleanup watch. Partial output and logs remain untouched; no failed/interrupted case becomes a captured movie or strict benchmark pass. If the render process exits before its own browser/encoder descendants, monitoring continues until they cease or the same deadline cleanup applies.

The review tool's existing per-case timeout remains unchanged. Its source verification and other overhead also consume the overall queue deadline. Ten captures are not promised within the available quiet window; the real `review.json` receipts determine how many completed, and any partial artifacts remain evidence.

## CPU verification

`test-queue-r12-review-r1.py` contains 31 controls: pending/empty authorization; complete four-role bindings; descendant key/uniqueness; quiet and cleanup boundaries; title changes, zombies, PID reuse; retained descendants/grandchildren; inspection errors; owned-only TERM/KILL; natural exit without signals; child exit with a surviving browser; one reserved invocation; fresh output; exact CLI parameters; immutable append-only plans; score-independent first-ten selection; absent masters; copied authentic-case validation; false/incomplete proof; mismatched references/provenance; corrupt model/PNG; missing PNG. All process-provider values are memory-only unit fixtures, never observations or launch receipts. Real-case tests copy one authentic old R8 case under an explicitly temporary CPU fixture, use identical frozen protocol bytes, and remove that fixture; they produce no R12 benchmark rows or acceptance evidence.

The initial expanded suite had one fixture-construction error (the test tried reading its pending declaration after replacing the temporary control path). `cpu-tests-initial-fixture-error.log` preserves it. The fixture setup was corrected without changing the assertions. Final results and exact script/input hashes are recorded in `cpu-tests.log` and `preparation-freeze.json`. No repository source owners are delegated to this helper.

Run this preparation-only test suite before finalization. It explicitly refuses a finalized/live declaration before any tests execute. Finalization binds the passing log; use the queue's CPU-only `--check` afterward rather than overwriting or rerunning that evidence.

Rule check: none.
