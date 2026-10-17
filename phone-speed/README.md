# Phone speed evidence

**Never merge this branch.** This is the raw evidence branch for Codex task 103. The implementation
and audit belong to `codex/phone-speed`; the task is `docs/codex/103-phone-speed.md`.

The 15 frozen targets pass five-pair speed and appearance checks: minimum improvement 29.6%, median
48.5%, and maximum 55.3%. Thirteen are RGB-identical at both poses and widths. Minimum phone-width
SSIM is 0.995246; minimum native-width SSIM is 0.994008. The full 30-toy phone-page QA passes.
Catalog regression checks, the late main addition, the complete existing suite, and preflight are
still in progress. These target results do not claim the complete task goal is met.

## Publication provenance

GitHub rejected the initial push because the checkout's commit email was private. Existing local
history is preserved, with its original commits reachable under local history refs. A separate
additive branch from public main uses GitHub's noreply address. No original commit was amended,
rebased, or replaced, and no force push was used. The runtime and test inputs match the prepared
source byte for byte; `history-preservation-proof.json` records that check.

The measured local source IDs remain unchanged in the raw records. Original runtime `36f5df601` has
the same app bytes as public main `ceb51de7a015377d7f350119c27a792fc1a8a66d`.
`measured-runtime-072.patch` reconstructs the original measured candidate from that public base
without commit metadata. `measured-runtime-patch-proof.json` verifies every runtime tree/file entry,
and `runtime-manifest.json` supplies per-file SHA-256. The original local commit objects are not
required for this reproduction. The separate Neuron comparison uses publicly available source IDs.

## Source and protocol

- Original runtime: `36f5df601963f418f71b98ee460783ea6191b0bc`, whose app source matches original
  main `ceb51de7a015377d7f350119c27a792fc1a8a66d`.
- Formal candidate runtime: `072f15f3d00150825f36784b504b8b365c892cd7`. The first 465-toy survey,
  frozen selection, controlled stills, and matched comparisons keep those exact source pins.
- Main added Neuron specimen during collection. Its separate comparison will use original main
  `ea9a9d193de529e6c75264123bb04b7e862b7162` and the prepared merged candidate
  `3e058bac5d18eb33b266bac1b30cf175889305bb`. Those samples are never relabeled as part of the older
  465-toy runtime. The target ranking stays frozen.
- `runtime-manifest.json` verifies tracked runtime trees and served critical files. Run metadata
  records tool commits and hashes separately from app source. Later documentation commits do not
  change the measured runtime.
- Both sources use Chromium 151.0.7922.173, software WebGL2 on SwiftShader, a 390×844 CSS viewport,
  device scale 3, the low profile, disabled adaptation, and fresh browser contexts. Formal paired
  samples each use a fresh browser, alternating source order by toy-ID parity and pair index. There
  is no CPU or network throttle. No other GPU job runs beside timing collection.
- First view waits for the loaded toy's first submitted draw and synchronous 1px default-framebuffer
  pixel readback. Every sampled draw also completes a synchronous readback. The shared module
  preserves the previous read binding; old finish-only rows cannot pass the final gates.
- The default Sharp relief photo views use a narrow additive helper because their splat-only app
  startup signal cannot fire with splats disabled. It requires their loaded, visible relief mesh,
  actual mesh draw, and readback. Only during forced sampling does it override duplicate-picture
  suppression. It never switches the toy's view.
- Idle and tap windows each last at least 2.5 seconds and contain at least eight completed-draw
  intervals. Audio, automatic camera rotation, and idle pokes are off. Recipe motion and the real
  tap action remain active. Native animation timers remain active. These intervals include
  synchronization overhead and describe this host, not a physical-phone frame rate.
- Heap is live JS heap, excluding GPU memory; CLI rows also contain CDP heap measurements. Resource
  Timing supplies wire/body bytes and cache counts. Local HTTP bytes differ from compressed public
  hosting. A phone run uses browser-managed caches and may not expose heap measurements.

Two predeclared resolution exceptions bind both visual and timing canvases and unchanged splat
counts: low-tier Video to 3D's default Liberty orbit (1170×1401 → 936×1120) and Photo album (585×700
→ 507×607). Their rest and mid-tap stills must pass SSIM 0.98 at both 390px and 1170px. Ordinary
weak viewing already caps Video to 3D at DPR 1.5; its recipe change addresses the explicit
adaptation override used by the benchmark/page. An ordinary-view speed gain is not inferred.

## Formal evidence

- `before-readback/`: the complete, corrected original 465-toy ranking survey, with positive heap
  and transfer measurements and no errors. Its contexts can share the browser's GPU/shader cache.
- `targets.json`, `freeze-readback.json`, and `phone30.json`: frozen selection, file hashes, and the
  30-toy phone list. The rule selects the largest idle medians; it was declared before target IDs
  were frozen. `all-toys.json` records the original coverage list.
- `paired/`: fresh-browser before/after samples. Five pairs per target are collected first; the full
  matched catalog reuses target pair zero and adds one pair for every other original toy. Aggregate
  history preserves prior target-only arrays.
- `targets-before.json` and `targets-after.json`: canonical 75-row target arrays. The later
  catalog's `paired/before.json` and `paired/after.json` contain pair zero only; final reports must
  overlay the canonical target arrays.
- `target-gates.json`: all 15 five-pair speed and appearance results. `target-diagnosis.json`
  records splat/addon counts, asset bytes, CPU update medians, actual completed draws, and work
  passes. Every unchanged primary goes from three work passes to zero per three diagnostic draws.
- `visual-before/` and `visual-after/`: final rest and mid-tap canvas stills, full phone
  screenshots, difference images, Gaussian luminance SSIM, PSNR, RGB equality, nonblank checks, and
  matching controlled clocks. Scene seed is 103 and the calendar is fixed. Actual original/candidate
  camera, controls, canvas, and splat counts are retained. `visual-review.json` records inspection
  of both resolution exceptions.
- `paired-regressions/`: every unrelated screening flag gets five new pairs. A flag that persists
  gets five further pairs, with all ten included in its median. Screening estimates are retained
  separately. Every declared pair index must occur exactly once in each phase. Failed, missing,
  nonfinite, or incompatible samples cannot pass as zero.
- `early-regression-*`: early collection for the first two flagged completed catalog IDs, at
  explicit browser-closed pause boundaries. Strawberry passes with five pairs. Cactus passes with
  all ten: tap median +3.80%, tap p95 +3.19%, and idle median 39.94% faster. Their samples are
  reused under the identical protocol in the full follow-up; no fastest-sample selection is used.
- `phone-page-qa/`: all 30 actual page measurements, copyable table, matching downloaded JSON,
  checks for copy, download, fallback, Stop, desktop layout, no uploads, and four reviewed
  phone/desktop screenshots. The run has zero application errors. Thirty no-exception browser resize
  notifications remain in JSON. Page-module hashes and tooling revision are recorded.
- `late-main-plan.json` and the eventual `late-main-*` artifacts: the added toy's separate source
  pins, repetitions, served-module proof, and results. The source-labeled combined CSV will identify
  which runtime each row actually measures.

The selected idle gains do not establish that every selected tap metric improves. Sunflower photo's
tap median/p95 increase 5.15%/6.84%, Monkey doll's tap median increases 6.26%, and Desk globe's tap
median/p95 increase 5.84%/6.76%. Those active effects retain the original conservative update path.
The complete unrelated-toy gate checks all five timing metrics for the other toys.

## Retired and diagnostic evidence

`before/`, `finish-only-paired/`, and `initial-*-finish-only.json` are retired timing evidence.
Chromium's exact version implements WebGL `finish()` with `Flush()`, so these timings did not wait
for completed rendering. The opened source excerpt and correction are retained in
`readback-correction/`. Repeating the survey exceeded the task's three-hour screening allocation. No
finish-only timing satisfies a final gate.

The first corrected survey was interrupted by a workspace restart after 29 completed toys; files
persisted, host/browser/CPU quota were checked, and the interrupted toy was repeated. The restart
record is retained with the correction evidence.

Earlier calibration, cache, shader, bounds, polygon, opacity, and resolution directories are
exploratory work. Some use dirty sources or predate clock, draw-count, native-size, or nonblank
checks. They are not final timing or appearance evidence. The fixed-timer calibration produced a GPU
backlog and was stopped; its failure is retained. A later native-timer calibration matched `torus`
and `toy-trex` exactly at rest and mid-tap. No rejected shader or opacity-cutoff change ships.

The retired survey's first 67 setup samples were conservatively archived and repeated after a
stopped browser's orphan GPU process was eliminated. Three later overlapping rows were also archived
and repeated. The two default photo views' startup timeouts are retained. These histories explain
setup work; none contributes to the corrected final timing gates.

The first complete phone-page QA mislabeled Chromium's no-exception resize-delivery notification as
an application error. Its 30 measurements and logs are retained in `phone-page-qa-first-attempt/`.
The same notification was reproduced in the unchanged original app, the candidate, and an iframe,
with stable viewports and no JavaScript exception. The fix retains notifications separately and
still fails real exceptions, including identical-message exceptions. The regression's failing and
passing runs are retained. All full-page QA checks were repeated.

## Reproduction

The runnable measurement tools ship on `codex/phone-speed`. Use that checkout and the original
runtime worktree, copy its current `tools/pages/phone-speed*` measurement modules into each served
runtime, and serve them with the static byte-range server. The audit gives the exact phone-page
before/after commands. For formal timing, use `tools/phone-speed-paired.mjs` with the recorded
sources, URLs, target file, duration, and repetitions. The runner validates served helper hashes;
paired resume validates sources, browser, duration, and all protocol hashes.

The cache scripts retain the collection's exact paths and orchestration for review. They assume its
`/workspace` layout; adapt those paths for another machine. Preserve the source pins and protocol,
and keep GPU jobs sequential. Software-renderer measurements need not reproduce identical wall clock
numbers on another host.

No physical-phone result is inferred. The implementation's local page runs the fixed 30 toys, copies
a table, and downloads JSON without uploading anything.

## Licensing

Measurement and analysis code is made by Ryan with Codex (GPT-6), under Splashery's MIT license.
Screenshots retain the underlying toys' recorded licenses and attribution in the repository's
`CREDITS.md`, `tools/assets.json`, and `tools/models.json`, inherited from main. No new toy asset
was authored for this task.
