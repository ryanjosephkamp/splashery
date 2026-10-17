# Native recording-preview focus, October 17 checkpoint

These completed controls use a real MediaRecorder take, actual saved video, native dialog methods,
and the original complete Share focus predicate. No clock, worker answer, or dialog result is faked.

The first ready-pill hypothesis passed before and after, so it was discarded. The subsequent native
close observer queues a microtask after real `HTMLDialogElement.close()` returns. That microtask runs
after the app's close handler and before the next rendering opportunity. Original code leaves
`rec-save` focused inside the closed preview: Record is hidden, Record is unfocused, and the body is
unfocused. This reproduces the historical predicate. The close-path candidate explicitly blurs only
focus remaining inside that closed preview when Record is unavailable.

The paired native control failed before and passed after. Both unchanged Task 52 preservation
controls passed. The new actual Share regression also failed against original source, then the
repaired full Share file passed 13/13. All 16 original target variants passed cross-family validation;
these one-repetition checks do not count as 30-run stress acceptance.

Code inputs have `.txt` appended to their original names so their bytes remain identical to the
recorded hashes. Restore the original names and cache paths from each recipe to reproduce a probe.
Original traces, clips, run logs, and Actions ZIPs remain byte-exact. JSON whitespace may be formatted.
