# Live embed teardown: task 86 follow-up

Made by Ryan with Codex (GPT-6), October 15, 2026. Code is MIT. This follows the
[Operator's review of PR 645](https://github.com/ryanjosephkamp/splashery/pull/645#issuecomment-6193151498)
on main `cb8a8315` (which includes Ops 660). Final Actions results belong in the follow-up PR's
Verification section.

## Cause

The restored `spg` check reaches the real strawberry player, changes the viewport from desktop to
phone dimensions, finishes its body, and exceeds the existing 240-second context-teardown limit. The
player submits WebGPU work without waiting for previous frames to finish. In an offscreen iframe,
animation callbacks keep arriving much faster than a software GPU can draw. Shutdown must drain the
accumulated work, even after the page closes.

Instrumenting native `GPUQueue.submit` and `onSubmittedWorkDone` recorded 67 submitted batches and
only 25 completed before close: 42 batches still pending. This instrumented run took about 56
seconds to close overall. The unchanged restored Playwright case timed out during teardown. Native
stack samples found SwiftShader workers executing generated GPU code during the stall. These are
real Chromium 141.0.7390.37 and SwiftShader measurements, without a mocked renderer.

## Controls

| Change to the diagnostic sequence          | Result                               |
| ------------------------------------------ | ------------------------------------ |
| Block the service worker, keep WebGPU      | Closed; about 14.8 seconds overall   |
| Keep the service worker, use WebGL2        | Closed; about 7.4 seconds overall    |
| Unregister the worker after the body       | Close still pending after 60 seconds |
| Destroy the current viewer after the body  | Close still pending after 60 seconds |
| Restore the pre-Share stylesheet           | Close still pending after 60 seconds |
| Keep the original viewport                 | Closed; about 15.6 seconds overall   |
| Complete a native GPU draw before resizing | Screenshot timed out after resizing  |
| Bound pending rendered frames to two       | Closed; about 14.0 seconds overall   |

Diagnostic deadlines stop investigation processes; they do not replace test timeouts or turn
failures into passes. The embed created no audio context. The Share tab's `index.html`, `app.js`,
and `ui.js` are not loaded by this embed; restoring its earlier stylesheet did not fix the hang. The
worker affects the timing, but unregistering it after the queue grows does not remove the work.

## Fix and regression coverage

`Stage` permits at most two unfinished WebGPU frames. Player updates continue on their real clock;
only draws wait for native queue completion. A render requested while the queue is full is retained.
Completion does not extend the keep-alive period or restart a destroyed stage. Captures now resolve
only after a rendered frame, rather than an update that could not draw.

The original live-player check is restored with its final-navigation wait, snippet assertions, phone
resize, screenshot, and existing timeout. A second real-browser case delays delivery of native GPU
completion signals while continuously requesting draws. Old source submits 12 frames where the new
check requires two. With the fix, it holds at two, leaves a requested capture pending while blocked,
and resumes drawing and capture when completion is delivered. The GPU work itself is real; only the
completion notification is controlled in this regression.

The first full local `spg` check passed all nine cases in about 32 seconds. After strengthening the
late-request regression and moving the gate to the final render decision, all nine passed again in
about 1.3 minutes while broader browser checks were running. The standalone Embed player workflow
uses the full suite's pinned setup, fonts, Chromium, and Mesa display, and retains its original
report and traces. The existing full suite also includes the same nine cases. Neither workflow's
original failures are replaced by later passes. No retry, skip, longer timeout, changed renderer
preference, or relaxed assertion is added. `tests/taps.spec.mjs` is unchanged.
