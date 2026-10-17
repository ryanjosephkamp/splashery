# Phone speed implementation plan

Latest progress, October 17, 2026, 06:08 UTC (four hours): the corrected original survey has 404/465
toys with no errors. The shared cache and phone page are implemented. All 14 focused tests passed
with the readback correction; the subsequently strengthened nonblank-evidence gate tests also pass.
The final target ranking, five-pair comparisons, final stills, catalog regression check, full
existing suite, and preflight remain pending. Repeating the survey exceeds the initial three-hour
screening allocation; the twelve-hour task clock continues. No retired timing is final gate
evidence.

**Goal:** Measure every toy at phone size, improve the 15 slowest without changing their appearance
or motion, and provide a local real-device check.

**Spec:** `docs/codex/103-phone-speed.md`.

**Architecture:** Use the normal app opening path in a fresh browser context for each toy. Share
draw measurement code between the command-line runner and a same-origin phone page. Keep raw runs,
screenshots, and profiles on `codex/phone-speed-clips`; merge only tools, tests, verified rendering
optimizations, and the audit.

**Constraints:** 390×844, device scale 3, weak profile, Chromium software GL, adaptation disabled
during sampling, no point-count or motion shortcuts, no changes to `tests/taps.spec.mjs`. Each
selected toy must improve at least 25%, with a median improvement of 30%; rest and mid-tap SSIM must
reach 0.98. Other toys may regress at most 5% under the task document's gate. No raw evidence on the
implementation branch.

- [x] Implement `tools/phone-speed.mjs` and shared measurement functions under `tools/pages/`; test
      completed-draw sampling, real-page measurement, cancellation, and percentile calculations in
      `tests/cdx-speed.spec.mjs`.
- [x] Screen all catalog toys, preserving failures and source/environment pins. Rank the idle median
      draw intervals and freeze the 15 targets before their final comparison.
- [ ] Profile each target, implement fixes in recipes/packs, and put any shared fix in a separate
      `Engine:` commit with regression coverage. Compare deterministic rest and mid-tap stills and
      repeated timing pairs against the frozen baseline.
- [ ] Finish the 30-toy phone page: start, stop, progress, copyable table, local export, explicit
      unavailable measurements, and no uploads. Test it at phone and desktop sizes.
- [ ] Measure the complete catalog again, report every gate honestly, and keep unsuccessful visual
      candidates out of the PR.
- [ ] Run required pack specs, the full existing suite, formatting, American English, and final
      preflight after merging main. Publish raw evidence on its separate branch and open one draft
      PR with the five required sections.

Review focus: cold versus warm caches; draw completion versus animation callbacks; deterministic
clocks and camera poses; unsupported heap APIs; interruption and failed toy cleanup. No owner-phone
result will be inferred from software GL.

Target selection, declared while 67/465 baseline rows were collected: rank the 15 largest idle
median draw intervals, and use that metric for their speed gate. Opening and tap measurements remain
in the complete table and regression gates. Three alternating experiments on a heavy scan identified
repeated parameter assignments as unnecessary GPU work; the candidate saves roughly 40–50% on two
scans, with SSIM 1.0 at rest and mid-tap. The target IDs are not selected until the complete
baseline is available. The phone page includes all selected targets plus the worst remaining
opening/tap cases.

The user authorized execution directly; implementation proceeds in this session. This file also
records progress across long measurement runs.

October 17, 2026, 02:51 UTC: 110+ baseline toys measured against the frozen original app. Eight
focused specs pass, including an actual GPU work-pass counter. Review reproduced and fixed SH color
refresh and post-load rig tagging invalidation. The owner page has a passing real-toy run and stop
test. Full catalog coverage, target gates, and final preflight remain pending.

October 17, 2026, 03:31 UTC: the first 67 setup samples were preserved and conservatively repeated
after eliminating a stopped browser's orphan GPU process. There are 227 valid catalog rows so far.
The second review's repeat-coverage, signal-handling, reference-error, and clock-state issues are
fixed. Nine focused tests passed together, the additional paired-resume test passed, and the signal
test reproduced the old failure before passing with the fix. Controlled rest/mid-tap calibration for
a procedural toy and a heavy scan is pixel-identical. Full target and catalog gates remain pending.

October 17, 2026, 04:02 UTC: 415 original-survey attempts collected. The two photo toys' default
Sharp view draws a relief mesh and disables splats, so the app's splat-only first-frame signal never
fires. A separate benchmark-only mesh probe preserves their default view; its regression reproduced
the old timeout and passes for both toys. The immutable shared metric module remains unchanged, and
the timeout rows will be archived and repeated before ranking. The final comparison now requires
paired samples for every toy and exactly five target pairs, closing the review's remaining gate
contract gaps. No new Engine defect was found.

October 17, 2026, 04:31 UTC: froze the original ranking before candidate target comparisons. The
Video to 3D shader experiments preserve native DPR, point count, and replay. Geometry alternatives
were slower. No rejected cutoff experiment is included in production changes.

October 17, 2026, 04:41 UTC: the original plan's equal-resolution constraint is revised for Video to
3D only, before final paired sampling. Task 103 requires phone-size SSIM, unchanged visible look,
and unchanged play, rather than equal internal canvas sizes. Exact shader alternatives did not reach
the speed gate. A DPR2.5 preview retained CSS SSIM0.99674 and full-phone SSIM0.99760. The candidate
caps only the default Liberty sample on the low tier at DPR2.4; native-size rest/Replay stills must
also meet0.98. The exact before/after drawing buffers are declared in raw evidence. Ordinary
weak-profile Video already caps at1.5 through recipe adaptation-off handling; the change addresses
the explicit `?adapt=off` path used by the fixed-resolution benchmark and phone page. Normal/high
tiers, custom scenes, splat data/counts, Replay, and explicit DPR overrides are preserved. The
comparison still rejects every undeclared canvas change.

October 17, 2026, 05:02 UTC: direct inspection of Chromium's WebGL implementation established that
`finish()` is intentionally `Flush()`. All original survey and early paired timings are retained but
retired. The corrected first-view and frame probes perform synchronous1px RGBA readback from the
default framebuffer and restore the prior read binding. Final gates require a readback completion
marker and a readback first view, rejecting old rows. The full corrected survey and automatic
ranking will replace the initial freeze. This correction exceeds the original three-hour screening
allocation; the overall twelve-hour clock continues.

October 17, 2026, 06:08 UTC, four-hour progress note: 404/465 corrected original rows are complete
without errors. Source-only review verified readback ordering, actual diagnostic draw counts, and
strict nonblank CSS/native evidence. A workspace restart preserved 29 completed rows; the
interrupted sample was repeated after confirming the same browser, CPU profile, CPU quota, and
memory limit. Candidate timing, final appearance, unrelated regressions, and the full existing suite
are not yet claimed. The next step freezes the completed corrected ranking and runs the sequential
evidence pipeline, with every screening and follow-up sample retained.

October 17, 2026, 06:17 UTC: the corrected original survey completed all 465 toys with no errors,
positive heap/transfer measurements, readback first views, and at least eight completed intervals in
each window. The automatic idle-median ranking is frozen, with its source and raw-file hashes. It
selects 13 captured toys, Video to 3D, and Photo album. The 30-toy phone list is updated from this
freeze. Photo album's primary surface was conservatively excluded with all picture toys; source
review found its live media on separate sheets, which retain unconditional updates. A new
real-browser regression reproduces repeated primary invalidation before that narrow eligibility fix.

October 17, 2026, 06:25 UTC: Photo album's primary-body regression failed before the eligibility fix
and passed afterward, including camera/turn invalidation and continued sheet/face writes. The
cache-only three-pair pilot improved16.6%, so its low-tier recipe now caps DPR at1.3; higher tiers
retain their defaults. Both this507×607 buffer and Video to 3D's936×1120 buffer were declared before
final paired sampling and require native-width SSIM in addition to the phone comparison. Photo
album's five formal alternating pairs give659.55ms before and464.35ms after, a29.6% improvement. The
remaining 14 targets' final pairs and all15 final appearance checks are still pending.

October 17, 2026, 07:27 UTC: all 15 targets pass their five-pair timing and appearance gates.
Idle-median gains range from29.6% to55.3%, with a48.5% median. Thirteen targets have exact RGB
matches at rest and mid-tap at both widths. The lowest CSS SSIM is0.995246; the lowest native SSIM
is0.994008. Actual unchanged primary work passes fall from3 to0 per three diagnostic draws. The
full30 phone-page QA has started. The matched catalog, unrelated regressions, full suite, and
preflight are still pending. The isolated pre-suite probe confirms Mesa llvmpipe (LLVM19.1.7).

October 17, 2026, 07:39 UTC: the first complete 30-toy page run retained actual numbers, but every
row was marked as an error because Chromium emitted a resize-delivery notification without an
exception. The unchanged original app emits the same notification with a stable viewport. The page
now retains these separately in JSON, while actual exceptions, including an identical-message
exception, remain fatal. The new regression failed before the fix. All first-attempt rows and logs
are retained; the full page QA will repeat. Production rendering and the frozen timing protocol are
unchanged.

October 17, 2026, 07:47 UTC: the repeated30-toy phone-page QA passes with zero application errors
and no upload requests. Copy, JSON download, clipboard fallback, Stop retaining a completed row, and
desktop layout all pass. Thirty no-exception resize notifications are retained in JSON. All four
phone/desktop screenshots were inspected. The matched catalog is now running sequentially. Main has
added one toy since the465-toy freeze. An isolated merge preserves both credits sections and
refreshes generated site pages. After pinned timing completes, that merge and a separate five-pair
Neuron specimen check will precede the full suite, covering the466-toy catalog without reranking
targets or relabeling earlier source pins.

October 17, 2026, 08:00 UTC: early follow-ups were collected for the first two flagged catalog IDs
at explicit browser-closed pause boundaries, using the unchanged formal protocol. Strawberry passes
after five pairs. Cactus remains over5% after five pairs, then passes using all ten: tap median
+3.80%, tap p95+3.19%, and idle median39.94% faster. All initial, five-pair, and ten-pair data are
retained; these exact follow-up samples are reusable in the later complete-catalog follow-up. This
is an early diagnosis, not a claim that the remaining catalog passes. The original matched survey
resumed at07:59:59 UTC.

October 17, 2026, 09:11 UTC: draft PR #708 is open, the raw snapshot is published separately, and
the complete399-spec CI run is queued on public source3e058bac5. The original local history remains
reachable under local history refs; a separate additive public branch uses noreply metadata. Its
runtime and test inputs match the prepared source byte for byte. The source patch reconstructs all
measured runtime entries exactly without private commit metadata. The matched catalog has125
complete pairs and no measurement errors at this checkpoint.

During an active host observation,2800 of4133 CPU quota periods report throttling (67.75%). The host
exposes five CPUs with a four-core quota. At08:58:03 UTC, between complete toy pairs with no browser
open, future benchmark parents were restricted to CPUs0–3. Completed groups keep their original
CPUs0–4 configuration. Subsequent observation reports32 of2048 throttled periods (1.56%). Every new
sample records observed parent affinity; direct browser observations are retained where available.
The final report now requires consistent CPU configuration across each toy's before and after
repetition group. No samples, timing thresholds, point counts, or rendering settings were removed or
relaxed.
