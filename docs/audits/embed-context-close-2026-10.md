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

## Manual PDF text follow-up

The
[Operator's second follow-up](https://github.com/ryanjosephkamp/splashery/pull/645#issuecomment-6194712162)
belongs in this same PR. The Actions edition `95d730b94fef0ab7` draws the first contents colon with
an Inter contextual alternate that PDF.js extracts as U+E092. The old navigation checker stripped
punctuation when comparing headings and never compared visible contents titles, so it accepted that
edition. It also accepted a deliberately changed web title with a semicolon instead of its colon.
The new checker rejects the actual broken Actions edition at `#splat`, preserving the private-use
character in its error.

The printer disables Inter's `calt` feature for printed text, including descendants and pseudo
elements. Web styling and wording stay as written. The checker associates PDF.js's marked text with
each tagged Link and its actual annotations, so font runs and wrapped links form a complete title
without the adjacent page number. It compares that extracted text with the web title after
normalizing whitespace only. It does not substitute bookmark labels, alternate text, or cleaned
punctuation for the visible text. Existing destination, bookmark-position, and printed-number checks
remain in force. A regression deliberately changes a contents colon to a semicolon and requires
rejection.

Fresh local prints with Inter 3.19 and Inter 4.0 both pass all 108 exact contents titles, 144
internal links, and 188 bookmark checks. Both have 632 literal colons and 699 private-use
characters. The remaining characters are the existing tabular digits and decimal points in the
budget comparison table on pages 22–24, beside the arrows. The arrows themselves extract as U+2192.
Inspection of Inter 3.19's character map identifies U+E071 as `zero.tf`, U+E072 as `one.tf`, and
U+E094 as `period.tf`; the table explicitly requests `font-variant-numeric: tabular-nums`. Disabling
`calt` fixes the new contextual punctuation defect while retaining that existing table styling. The
JSON report records every remaining private-use code point, count, page, font, and text context.

Those fresh editions have 154 pages, with Glossary on 139 and Quick reference on 151. The old
153-page edition put them on 138 and 150. The browser navigation test therefore uses numbers
verified against the PDF's printed contents instead of constants from the previous edition. It still
checks the exact first-link title, clicks the real contents link, follows the real bookmark, types
the printed reference number, and checks the expected heading on each exact destination page.

The manual workflow remains dispatch-only with read-only permissions and Chromium's sandbox on.
After publishing a fresh local edition, it runs the full `cdx-manual-pdf` and `man5` files,
including the unchanged byte-reproducibility assertion. It uploads the edition and rebuilt download
links, plus the original check reports and traces. The Operator can dispatch `manual-pdf.yml` on
this PR's branch, inspect those artifacts, and commit the reviewed edition through the planned Ops
PR. This PR changes the printer and its checks; it does not commit a container-generated replacement
PDF. Final Actions evidence and the workflow artifact's measured character counts belong in the PR.
