# Picture QR fidelity study

## October 15 review pass

Use Node 22, the CI runtime. The review pass freezes 100 pictures and ten payloads in
`results/review-pass/corpus.json` and `results/review-pass/payloads.json`. It compares the locked
candidate against merged main `cb8a8315`. The report separates these measurements from the
historical 52-picture pass below.

The recorded evidence spans four frozen runtime revisions and a merge. Use a separate run name
whenever the source or protocol changes; replaying all commands at one head does not reproduce the
historical measurements.

```sh
mkdir -p .cache/picture-qr-fidelity/review-pass
git archive cb8a8315 src | tar -x -C .cache/picture-qr-fidelity/review-pass
node tools/picture-qr-fidelity/sources.mjs
# Original partial capture: runtime 50d19091.
node tools/picture-qr-fidelity/paired.mjs --name=review-full --baseline=cb8a8315 --baseline-dir=.cache/picture-qr-fidelity/review-pass --corpus=tools/picture-qr-fidelity/results/review-pass/corpus.json --photos=all --links=all --repeats=1 --qualify=1
# First Circle repair: runtime c535bfd6.
node tools/picture-qr-fidelity/paired.mjs --name=review-edge-recheck --baseline=cb8a8315 --baseline-dir=.cache/picture-qr-fidelity/review-pass --corpus=tools/picture-qr-fidelity/results/review-pass/corpus.json --photos=all --links=all --repeats=1 --qualify=1 --modes=detail --cases=tools/picture-qr-fidelity/results/review-pass/finder-edge-recheck-cases.json
node tools/picture-qr-fidelity/paired.mjs --name=review-remaining --baseline=cb8a8315 --baseline-dir=.cache/picture-qr-fidelity/review-pass --corpus=tools/picture-qr-fidelity/results/review-pass/corpus.json --photos=all --links=all --repeats=1 --qualify=1 --cases=tools/picture-qr-fidelity/results/review-pass/remaining-cases.json
node tools/picture-qr-fidelity/assemble-review.mjs --partial --name=review-frozen
# Second repair and merged main: runtime 8abc68ff; test-only head 9b7cf7b6.
node tools/picture-qr-fidelity/paired.mjs --name=review-repair-recheck --baseline=cb8a8315 --baseline-dir=.cache/picture-qr-fidelity/review-pass --corpus=tools/picture-qr-fidelity/results/review-pass/corpus.json --payloads=tools/picture-qr-fidelity/results/review-pass/payloads.json --photos=all --links=all --repeats=1 --qualify=1 --modes=detail --cases=tools/picture-qr-fidelity/results/review-pass/repair-recheck-cases.json --save=cdx-theme-seasons-11-2/9/square
node tools/picture-qr-fidelity/paired.mjs --name=review-repaired --baseline=cb8a8315 --baseline-dir=.cache/picture-qr-fidelity/review-pass --corpus=tools/picture-qr-fidelity/results/review-pass/corpus.json --payloads=tools/picture-qr-fidelity/results/review-pass/payloads.json --photos=all --links=all --repeats=1 --qualify=1 --cases=tools/picture-qr-fidelity/results/review-pass/repair-remaining-cases.json
node tools/picture-qr-fidelity/assemble-repair.mjs --partial
# The immutable review-pre-third snapshot is supplied in repair-evidence/manifest.json.
# Third repair: runtime c696317e; recheck every completed very-flat Square and three controls.
node tools/picture-qr-fidelity/paired.mjs --name=review-third-recheck --baseline=cb8a8315 --baseline-dir=.cache/picture-qr-fidelity/review-pass --corpus=tools/picture-qr-fidelity/results/review-pass/corpus.json --payloads=tools/picture-qr-fidelity/results/review-pass/payloads.json --photos=all --links=all --repeats=1 --qualify=1 --modes=detail --cases=tools/picture-qr-fidelity/results/review-pass/third-recheck-cases.json --save=cdx-theme-space-art-2-1/9/square
node tools/picture-qr-fidelity/paired.mjs --name=review-third-remaining --baseline=cb8a8315 --baseline-dir=.cache/picture-qr-fidelity/review-pass --corpus=tools/picture-qr-fidelity/results/review-pass/corpus.json --payloads=tools/picture-qr-fidelity/results/review-pass/payloads.json --photos=all --links=all --repeats=1 --qualify=1 --cases=tools/picture-qr-fidelity/results/review-pass/third-remaining-cases.json
node tools/picture-qr-fidelity/assemble-third.mjs
node tools/picture-qr-fidelity/summarize.mjs --baseline=cb8a8315 --corpus=tools/picture-qr-fidelity/results/review-pass/corpus.json --main=browser-review-final-main-low --detail=browser-review-final-detail-low --out=tools/picture-qr-fidelity/results/review-pass --bundle=1
node tools/picture-qr-fidelity/timing.mjs --name=review-final --corpus=tools/picture-qr-fidelity/results/review-pass/corpus.json --out=tools/picture-qr-fidelity/results/review-pass/timing.json
node tools/picture-qr-fidelity/report-review.mjs
node tools/picture-qr-fidelity/review.mjs --main=review-final-main --detail=review-final-detail --corpus=tools/picture-qr-fidelity/results/review-pass/corpus.json --summary=tools/picture-qr-fidelity/results/review-pass/summary.json --out=.cache/picture-qr-fidelity/review-export
node tools/picture-qr-fidelity/bundle-review.mjs
node tools/picture-qr-fidelity/clips.mjs --baseline=cb8a8315 --baseline-dir=.cache/picture-qr-fidelity/review-pass --out=.cache/picture-qr-fidelity/review-export/clips
```

Serve the repository on port 4173 before starting. Stop all other study and test workers during
timing. The harness checks every served main module against its Git blob, preserves the exact source
hashes and arguments, reports four cores, balances mode order within each new paired segment, and
rejects inactive-page drawing. The explicit corpus and payload files freeze the inputs.

The first partial run stopped after 668 detail codes to repair four Sun Circles. The first
continuation stopped after 196 more detail codes to repair one Ocean Circle and Winter fir's Square
mean. The two assemblers preserve every original failure, interruption, and duplicate baseline
observation. The second plan retains 736 unchanged detail captures, rechecks 128 completed cases,
and initially selected 1,136 missing pairs. That continuation stopped after 319 detail observations
when Crescent moon lost a small mean print SSIM. The third plan rechecks 15 completed cases,
including three controls, and selects 818 keys with either mode missing. One fresh detail replicate
is retained with recheck priority fixed before timing. All nine control observations across the two
repairs must match their earlier capture pixels exactly. The assembler verifies source proofs, the
complete affected-key selection, and the unchanged input and independent assessment hashes.
`--partial` is for progress inspection and labels the result incomplete.

The final comparison is segmented across runtime revisions, including the merge of main after #641.
Its retained timings were not freshly measured on the merged UI. This limitation remains even when
all keys are present. Per-code results identify the actual measurement run; timing output includes
every slower case and cold start. Source archives live only on the clips branch, linked by
`results/revision-sources/manifest.json`.

Most pictures start at a 40% correction share. Low-contrast Square pictures start at 60% when each
RGB channel's population standard deviation is at most 0.1, and at 65% when each is at most 0.05.
All Circles remain at 40%. The original preclassification proposal, the later very-flat policy
decision, all 100 source classifications, and affected-case lists are preserved. This policy was
selected on the fixed study corpus and has no held-out validation. Other 50%/60% and narrow-guard
pilots remain diagnostics, with unsuccessful attempts retained in the evidence.

## Historical first-pass commands

The frozen baseline is main `41b21e74`. The corpus has 32 existing samples and 20 test-only CC0
images in `corpus.json`. That manifest and `tools/assets.json` record live source checks, original
and derivative hashes, resizing, and the two signature-removing crops. No fixture is loaded by the
toy. The six task 58 theme packs were absent at this revision. Payloads are the first ten of the
existing Circle scan study's twenty-link set.

Use the repository's installed dependencies and Chromium; do not install another browser.

```sh
mkdir -p .cache/picture-qr-fidelity/main
git archive 41b21e74 src vendor | tar -x -C .cache/picture-qr-fidelity/main
python3 -m http.server 4173 --bind 127.0.0.1
```

In another shell, run the fixed source-pixel matrix. Every code gets 24 captures and both
independent readers, with exact payload equality. `--shards=2 --shard=0` and `--shard=1` divide
pictures without changing the test set. JSONL files resume by key; use a new name whenever pixel
generation changes.

```sh
node tools/picture-qr-fidelity/run.mjs --module=.cache/picture-qr-fidelity/main/src/qr-craft/picture.js --name=main-area
node tools/picture-qr-fidelity/replay-main.mjs
node tools/picture-qr-fidelity/run.mjs --fidelity=detail --name=adaptive
node tools/picture-qr-fidelity/status.mjs --after=adaptive
node tools/picture-qr-fidelity/ablation.mjs
```

The replay reconstructs each main code at its recorded margin, checks every fidelity score against
the original result, and proves Standard produces identical cells for all 1,040 codes. It adds
whole-sticker Circle scores separately from the original encoded-square measure.

The browser matrix uses the actual 720-pixel splat capture and normal automatic checks at 390×844,
WebGL2, the Low phone tier, adaptation off, and reduced motion. Its independent Node-side readers
repeat the entire matrix on the captured pixels. The source simulation never substitutes for this
matrix. The first payload saves every phone screenshot and render; any failed capture is saved too.

```sh
node tools/picture-qr-fidelity/browser.mjs --mode=main --auto=1 --photos=all --links=10
node tools/picture-qr-fidelity/browser.mjs --mode=adaptive --auto=1 --photos=all --links=10 --tiles=1 --fast=1 --channel=weighted --direct=1
```

For appearance timing, stop other study workers. The clock begins when options change and ends only
after ordinary automatic checks finish and the scanning cover disappears. Source picture loading,
app startup, independent post-capture decoding, and writing review images are outside this clock.
The first timed Most detail selection includes its lazy kernel and reader loading. Alternate
main/detail order across repeats. Qualification timings taken under CPU contention are not speed
evidence.

```sh
node tools/picture-qr-fidelity/paired.mjs --name=phone --photos=all --links=all --repeats=1 --qualify=1
```

The paired runner opens two pages and serves every main source module from the frozen archive. Only
the measured page plays; both pages pause during independent capture assessment. Main/detail order
alternates for each pair. `--qualify=1` also saves all 24-condition, two-reader results, RGB scores,
and first-payload phone pairs. It records source hashes and refuses to resume a name with changed
source files or settings. Run it alone, after tests and other study processes stop.

The ordinary Most detail settings use rigid photo tiles and minimum-RGB-error luminance projection.
All four original layout reads run first. Seven predicted views cover the small blurred front, small
yaw and combined lighting, phone yaw and pitch, and phone stronger-blur yaw and lighting.
Independent predictions run on four local workers. Both readers then test all 24 conditions of the
actual rendered code before the cover disappears. Prediction does not replace captured-pixel checks.
After an actual candidate fails, retries also run the complete predicted matrix with both readers.
The `--direct=0` research override runs that full prediction from the first candidate;
`--channel=green` and `--channel=rgb` reproduce alternative color directions. Standard stays
default.

Finder tone 0.32 follows the initial 0.24 tone. After two actual failures of the same continuous
candidate at the exact mask, margin, and orientation, the search tries its independently checked
halftone and correction candidates. Every accepted code still passes all original and actual checks.

`metrics.mjs` is the independent RGB SSIM/RMSE implementation; `captures.mjs` freezes camera
geometry, brightness, and blur. The source and QR have identical crops and viewing footprints. All
function patterns count. Circle's photo band is reported as a secondary whole-sticker measure. The
`ablation.mjs` candidates and `experiments.mjs` prototypes are research tools, never imported by the
toy. Their CPU timings under contention are not phone benchmarks.

Most detail's optional Gaussian and raster accelerators are project code under MIT, with complete
sources in `src/qr-craft/{blur,raster,raster-simd}.wat`. They preserve Float64 accumulation, the
Gaussian's Float32 intermediate, and ties-to-even byte rounding. Tests compare every output byte
against the original JavaScript. Tiny local modules load only after selecting Most detail; the
Gaussian also loads in its local scan workers. If unavailable, every check runs in JavaScript.
`build-blur.py` rebuilds all three with the pinned build-only Wasmtime assembler in `LICENSES.md`.

`paired.mjs --modes=main --resume-from=RUN` inherits only completed unchanged frozen-main timing
keys. It checks baseline Git blobs and input/protocol hashes. `--modes=detail` captures a fresh full
Most detail series. `timing.mjs --name=DETAIL --main-runs=OLD,REST` joins separate series by corpus
key and labels the result as separate trials, not balanced pairs; it preserves every slower case.

Most detail also lazily loads the local MIT/Apache-2.0 zxing-cpp WebAssembly reader listed in
`LICENSES.md`. The independent qualification uses the study's full pinned reader, with its original
QR-family settings, so it does not depend on the runtime reader adapter.

`--cases=FILE` selects an immutable JSON array of `picture/link/shape` keys. The run hashes the
selection file. `--save=KEY,KEY` also saves successful diagnostic renders outside the appearance
clock. The final retry comparison preserves the original complete run and reevaluates every row with
a nonempty rejection list, including stale lists from earlier options. This is a superset of all
changed paths; the new forecast activates only after an actual rejection for the current key.

The [audit](../../docs/audits/picture-qr-fidelity-2026-10.md) records every picture/shape mean,
individual losses, reader/condition totals, historical experiments, and remaining goal failures. The
supplied final evidence joins historical series. `assemble.mjs` verifies the complete 303-case retry
selection and unchanged initial-path guards. Its optional `--priority` step invokes `prioritize.mjs`
to verify the complete final model-path selection, identical chosen parameters and captured scores,
and all fresh reader checks. These assemblers expect the raw study filenames in
`.cache/picture-qr-fidelity/`; compressed copies, per-row measurement runs, source hashes, and
limitations are in `results/`. A future runtime change needs a new qualification plan or fresh full
run, rather than blindly reusing these historical guards.

`summarize.mjs` writes every picture/shape mean, reader/condition counts, and individual-code CSV
rows. `review.mjs` assembles native 390×844 before-and-after pairs, and `clips.mjs` captures
deterministic tap motion. Review media belongs on `codex/picture-qr-fidelity-clips`, which is never
merged. Study code and review renders are made by Ryan with Codex (GPT-6); original picture credits
remain in the corpus manifest and CREDITS.

For a new single-revision comparison, check out the final runtime, choose a new run name, and run
`paired.mjs` with the frozen corpus and payload files and without `--cases`. The historical commands
above document recorded segments, including intentional interruptions; running each to completion
does not recreate the recorded boundaries. Extract the immutable raw series and pre-third snapshot
from `results/review-pass/repair-evidence/manifest.json` before reassembling the published series.

The final segment partitions independent post-capture assessment across four local Node workers.
Every original condition runs with both readers, and all jobs finish before another appearance clock
starts. Run `node tools/picture-qr-fidelity/verify-qualification.mjs` before a fresh study to
regenerate the exact serial/parallel comparison recorded in `qualification-equivalence.json`. The
paired harness hashes the worker source and verification file. This speeds study throughput only.

After assembly, independently check every CSV key, SSIM difference, picture mean, reader total,
timing difference, and native phone screenshot with
`python3 tools/picture-qr-fidelity/verify-results.py --out=tools/picture-qr-fidelity/results/review-pass/independent-checks.json`.
Use `--gallery=tools/picture-qr-fidelity/review` when checking the published clips branch. The check
uses Python's standard library and does not run the renderer or alter any primary observation.
