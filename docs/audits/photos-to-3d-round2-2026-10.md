# Photos to 3D: second implementation round

Codex (GPT-6) is implementing the Operator's second-round request on `codex/photos-to-3d`. This
report records the photo-specific module and the measurements from that module. The
[first-round report](photos-to-3d-2026-10.md) remains a separate core diagnostic.

The code is a labs API in `src/photos3d/`, without a shelf entry. It imports the unchanged Splat.js
SIFT, geometric primitives, bundle adjustment, and trainer, and Video to 3D's budgets, refinement
schedule, and surface seeder. All input photographs stay outside git.

## Measurement protocol

The module canonicalizes photo identities before seeded numeric work and proposes every unordered
pair: 276 at 24 photos and 1,770 at 60. Every accepted pair needs at least 25 essential-matrix
inliers and 40% consensus, with no capture-order neighbor exceptions. A bounded worker pool uses the
existing CPU matcher on software adapters; hardware adapters can use the existing WebGPU matcher.
Graph receipts retain components, features, support, accepted pairs, and per-photo reasons.

Features use the existing upsampled SIFT octave at a 960-pixel phone side and a 1,280- or
1,600-pixel desktop side. The training dimensions, seed budget, and splat ceiling come from Video to
3D. Photo inputs have their own 8–60 range, beyond Video to 3D's 16-frame phone input cap.

Here, "phone profile" identifies the borrowed 320-pixel training side, 15,000-point seed,
30,000-splat cap, and 1,200-step horizon. The labs API returns a raw Session to its caller. This
benchmark runs continuously and does not implement Video to 3D's Phone-safe orchestration: its
three-second/two-second duty cycle, visibility pauses, and eight-minute training cutoff.
Full-horizon folds are therefore uncapped phone-size diagnostics, not completion under every
Phone-safe limit.

Every photo's EXIF is inspected. The API supports one camera/lens group within a 10% focal range; it
reports incompatible or incomplete metadata explicitly. Each accepted 35 mm-equivalent focal
calibrates that photo independently. Physical focal lengths can identify a lens group but cannot
calibrate pixels without sensor dimensions. Uncalibrated sets need an explicit, recorded single-lens
assumption and use a shared-focal search. Bundle adjustment uses normalized per-photo observations
on a common virtual sensor. Distortion is not estimated in this module.

Geometry may use all input grayscale, including the held-out view, under the task's solved-camera
protocol. For each appearance fold, sparse colors are rebuilt from at least two training
observations, and held-out RGB, masks, and cameras are physically absent from surface seeding,
trainer inputs, loss, hull filtering, and environment fitting. Each fold starts a fresh trainer.
Camera poses remain fixed during appearance training. These probes use degree-zero spherical
harmonics, no environment fitting, and Video to 3D's horizon-dependent refinement schedule.

The Buddha, die, and skull evaluation masks are approximate manual silhouettes traced from input
photos alone, without camera solutions, renders, or optimizer feedback. The axe and two reliefs use
source-provided approximate object ROIs, converted before reconstruction; their creation method is
not established for the reliefs. A uniform two-pixel erosion at the 320-pixel annotation scale
removes uncertain boundaries. Source exclusions remain: Panel 17 omits part of its upper restoration
band and has 17 small interior holes across its selected masks, including inventory-mark areas.
These are not verified complete silhouettes or ground-truth masks. SSIM uses the existing metric
tool's local 7×7 luma windows entirely inside the mask; PSNR uses RGB squared error over all masked
pixels. Input-photo hashes and mask source identities are checked before evaluation. The latest
probe also checks and records the exact loaded annotation bytes against the frozen asset hash before
browser work; older receipts recorded the annotation hash only at completion. The interrupted batch
lacks that final runtime hash, so its recovered folds retain an explicit provenance caveat. Failed
or unregistered views remain in coverage denominators.

This container has software WebGPU and no attached physical phone. Phone profiles and 390×844
viewports do not establish phone latency, thermal behavior, or peak memory.

## Dataset provenance

Seven frozen selections represent six independent object captures. The 24- and 60-photo Buddha
selections overlap and count once. `tools/assets.json` preserves both `portfolioSpecimens` and
`photos3dBenchmarks`, with the original filenames, pinned URLs, authors, licenses, sizes, and
hashes.

- Buddha: Simone Gasparini, Fabien Castan, and Yann Lanthony, CC BY 4.0;
  [pinned source README](https://github.com/alicevision/dataset_buddha/blob/9067f679eb5a772c3e818b7a12dc35882c071858/README.md)
  and
  [license](https://github.com/alicevision/dataset_buddha/blob/9067f679eb5a772c3e818b7a12dc35882c071858/LICENSE.md).
- Textured die:
  ["Photogrammetry Test Set: Dice - Turntable - Strong Lights - Heavily Textured w Watercolors"](https://gitlab.com/photogrammetry-test-sets/dice-turntable-strong-lights-heavily-textured-w-watercolors),
  by [alansartlog](https://alansartlog.com), CC BY 4.0;
  [pinned license/attribution README](https://gitlab.com/photogrammetry-test-sets/dice-turntable-strong-lights-heavily-textured-w-watercolors/-/blob/78e0a887ba5263da66910fb4f4da0d9763e9177a/README.md).
- Skull:
  ["Photogrammetry Test Set: Skull - Cameramoves - Flash - No Background"](https://gitlab.com/photogrammetry-test-sets/skull-cameramoves-flash-no-background),
  by [alansartlog](https://alansartlog.com), CC BY 4.0;
  [pinned license/attribution README](https://gitlab.com/photogrammetry-test-sets/skull-cameramoves-flash-no-background/-/blob/0f31c229ac289a615b3ae981a5f584856bb24c47/README.md).
- Socketed axe: Andy Bevan, Chiara Bonacchi, Adi Keinan-Schoonbaert, Dan Pett, and Neil Wilkin, CC
  BY 4.0;
  [pinned source README](https://github.com/MicroPasts/socketed-axe-version2/blob/ff6a818b226c73018ce331e38fd2ceea1aa1a0e9/README.md)
  and
  [full license](https://github.com/MicroPasts/socketed-axe-version2/blob/ff6a818b226c73018ce331e38fd2ceea1aa1a0e9/LICENSE.md).
- Nineveh Room R Panel 7 and Room M Panel 17: Daniel Pett, CC BY 4.0;
  [Panel 7 README](https://github.com/ProjectNineveh/panel7RoomR/blob/6afe8ebf3a26274624e7595df083e22da5242cea/README.md),
  [Panel 7 license](https://github.com/ProjectNineveh/panel7RoomR/blob/6afe8ebf3a26274624e7595df083e22da5242cea/LICENSE.md),
  [Panel 17 README](https://github.com/ProjectNineveh/panel17RoomM/blob/add262c56f100d0d32df870db55a082401fa2d0e/README.md),
  and
  [Panel 17 license](https://github.com/ProjectNineveh/panel17RoomM/blob/add262c56f100d0d32df870db55a082401fa2d0e/LICENSE.md).

Live source and license pages were opened on October 17, 2026. The two additional selections each
contain 24 unmodified JPG originals. No identifiable people or readable logos were observed. The
skull source does not establish manufacturing provenance; it is described only as a nonidentifiable
anatomical specimen on a stand. Individual-image attribution appends its image number, as the source
requests. The Creative Commons deed returned HTTP 403; the pinned source READMEs explicitly state CC
BY 4.0 and the attribution above.

The last three selections each contain 12 uniformly spaced original filenames, chosen before any
solve or render. All 36 selected photo/mask pairs passed byte, SHA-256, Git-blob, orientation, and
input-only overlay checks. The reliefs have shallow depth and partial-front coverage, rather than a
complete tabletop orbit. Their READMEs explicitly grant CC BY, badge text says CC BY 4.0, and full
license files grant Attribution 4.0 International; the badge hyperlinks mistakenly target BY-SA. The
records preserve that contradiction and use the explicit full-license grant. Their camera and
appearance benchmarks are pending; obtaining six captures alone does not pass the quality gate. The
axe's 16 named source photo-mask creators are credited separately from its five photography and
access authors in the asset record and evidence; the source README retains their exact names.

## Rendered camera tests

Task 105's [Blender branch](https://github.com/ryanjosephkamp/splashery/pull/701) was available
during this round, so the benchmark includes three actual rendered sets, rather than substituting
numeric correspondences. The renderer is pinned to `f7710637570ce34aa544e53175f5dc7b03b6c11c`, with
Blender 4.5.3. Each set has 24 960×720 orbit views, exact camera matrices, and the model's
bounding-box diagonal as scene size. The inputs are the burger-double, cake-birthday, and
donut-sprinkles models from [Kenney Food Kit](https://kenney.nl/assets/food-kit), whose live source
page states CC0. The archive, source models, embedded-texture models, renderer, and rendered inputs
have recorded hashes. Embedding preserves the models' texture-transform extension. Original beauty
inputs remain outside git.

All three sets returned zero accepted cameras. Burger and cake produced some verified pairs but
failed the minimum of three cameras and eight triangulated points; donut produced no verified pair.
All 24 missing cameras remain in each denominator. Rotation and position medians are undefined, and
all three camera gates fail. These smooth, sparsely textured objects and eight-sample CPU renders
are a limited stress test, not evidence that every synthetic object is unsolvable.

Separate exact-correspondence controls pass for uniform intrinsics at 24 and 60 views and mixed
per-photo intrinsics at 24 views. Those controls isolate the normalized camera adapter and scorer;
they bypass image features and do not count as rendered photo sets. The public photo API still
rejects incompatible lens groups.

## Results and acceptance ledger

The completed solves below use the frozen original images. RMS is bundle-adjustment reprojection
error on the normalized 960-pixel virtual sensor, not a camera-accuracy measurement.

| Selection       | Feature profile | Registered views | Sparse points | Verified pairs | Sorted/shuffled geometry |
| --------------- | --------------- | ---------------: | ------------: | -------------: | ------------------------ |
| Buddha 24       | Phone, 960      |            11/24 |         1,206 |         38/276 | Exactly equal            |
| Buddha 24       | Desktop, 1,600  |            16/24 |         4,339 |         55/276 | Exactly equal            |
| Buddha 60       | Phone, 960      |            60/60 |         9,151 |      193/1,770 | Exactly equal            |
| Textured die 24 | Phone, 960      |            24/24 |         9,590 |         98/276 | One order tested         |
| Skull 24        | Phone, 960      |             0/24 |             — |          5/276 | One order tested         |

The skull's five verified pairs leave 19 graph components and do not produce an accepted seed
reconstruction. Denser Buddha sampling joins all 60 views in one component, while both 24-view
profiles leave inputs unregistered. Sorted and seed-104-shuffled runs have different picker orders
but exactly equal parsed graphs, camera arrays, point counts, and RMS. Remaining desktop solves are
still in progress.

A separate skull calibration sensitivity run reads the JPEG focal-plane resolution tags offline; the
[EXIF tag reference](https://exiftool.org/TagNames/EXIF.html) identifies their units. Every selected
skull and die image implies the same 86.50827 mm-equivalent focal. Supplying that value through the
existing manual-calibration option increases skull verified pairs from five to seven, but still
places 0/24 cameras. The existing browser EXIF reader does not expose those focal-plane tags
automatically. This diagnostic neither supplies camera truth nor replaces the default result.

The first completed appearance protocols are below. Each median is conditional on the listed scored
views; unregistered inputs remain explicit omissions. These 200-step phone-profile diagnostics are
not the desktop 7,000-step acceptance test.

| Selection       | Training protocol               | Scored / registered / input | Median masked SSIM | Median masked PSNR |
| --------------- | ------------------------------- | --------------------------- | -----------------: | -----------------: |
| Buddha 24       | Phone, 200 steps per fresh fold | 11 / 11 / 24                |            0.51175 |        14.53247 dB |
| Textured die 24 | Phone, 200 steps per fresh fold | 24 / 24 / 24                |            0.53617 |        20.56988 dB |
| Skull 24        | Phone                           | 0 / 0 / 24                  |          Undefined |          Undefined |

Buddha's SSIM range is 0.32339–0.69786; the die's is 0.48321–0.60011. The independent 1,200-step
phone fold for Buddha `00010._c.png` completed with 30,000 splats, SSIM 0.55978, and PSNR 19.23417
dB, compared with 0.60195 and 19.75733 dB for that view's 200-step fold. Each run starts fresh, and
Video to 3D's refinement schedule scales with the requested horizon; these are separate configured
runs, not two checkpoints of one training trajectory. The independent 1,200-step die fold for
`01.JPG` completed with 30,000 splats, SSIM 0.18074, and PSNR 9.35928 dB; its separate 200-step
configuration scored 0.55668 and 18.96136 dB. These two full-horizon phone-size folds took 25.65 and
19.91 minutes of training on the shared software adapter, beyond the Phone-safe eight-minute cutoff
that this raw-Session benchmark omits. A desktop diagnostic fold and the 60-photo phone
leave-one-out folds are still running.

Six saved Buddha folds were recovered from an interrupted batch without changing their numeric
values; the raw JSONL, original header, checkpoint, and recovery hashes remain available, with the
missing runtime mask-hash caveat above. The other five Buddha folds and all 24 die folds completed
individually. No score-based rerun selection is used.

| Original gate                                                       | Current evidence                                                                                                                   | Status               |
| ------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------- | -------------------- |
| Desktop median masked SSIM ≥0.80 on six independent captures        | Six captures obtained; complete short phone diagnostics on two selections; desktop quality pending                                 | Unestablished        |
| Phone profile finishes every set                                    | Buddha 24 partially registers; skull has no accepted reconstruction; full training/cooling/time limits not established on all sets | Fails this corpus    |
| Three rendered synthetic camera tests under 2° and 2% of scene size | All three have 24 missing cameras; numeric controls pass separately                                                                | Fails                |
| First view within 180 seconds and memory within phone limits        | Software-adapter container only; no physical phone or peak-memory measurement                                                      | Unestablished        |
| Ten paired phone clips                                              | No physical-phone clips                                                                                                            | Unestablished        |
| Every existing spec passes                                          | 18 photo diagnostics, 40 unchanged Video cases, and full 271-case preflight pass; broader suite not run in full                    | Partial verification |

Software-adapter timings are host diagnostics only. Buddha 24's two phone runs reached a first view
in 160.94 and 124.94 seconds, while the die took 755.53 seconds. Buddha 60 took 1,689.79 and 987.71
seconds. These runs shared the container's four CPU cores with other jobs, so they neither pass nor
fail the physical-phone latency gate. Resumed appearance-fold timers exclude geometry and are never
reported as end-to-end first-view times.

The two earliest Buddha phone receipts used a canvas-copy preview path that saved black PNGs after
presentation. Those previews do not establish a valid displayed-result gate. Their geometry remains
usable, and the later quality runs read the trainer's floating-point raster buffer directly; no
black legacy preview contributes to the SSIM or PSNR results above.

No quality, complete-coverage, or physical-phone gate is claimed from implementation or numeric
controls alone. The current raw receipts, masks, partial exports, and source hashes are published on
the
[separate evidence branch](https://github.com/ryanjosephkamp/splashery/tree/codex/photos-to-3d-clips/photos3d-round2-2026-10).
That branch must never be merged. The published snapshot is labeled incomplete while the remaining
jobs run.

## Reproduction

Use the code branch for execution and the evidence branch for frozen annotations and raw receipts.
`tools/photos3d-fetch.mjs` verifies every downloaded original against `tools/assets.json`. For
example:

```sh
node tools/photos3d-fetch.mjs --dataset=alansartlog-dice-watercolors-24 --out=.cache/photos3d/round2/dice-watercolors
SPLASHERY_CHROMIUM=/usr/bin/chromium node tools/photos3d-probe.mjs --round2 --dataset=alansartlog-dice-watercolors-24 --input=.cache/photos3d/round2/dice-watercolors --profile=phone --assumeSingleLens=true --match=cpu --iterations=2 --out=.cache/photos3d/round2/dice-reproduction.json --timeout=3600000
```

To evaluate an independent fold, supply the resulting `.geometry.json` through `--resume`, the
published dataset's `final-masks.json` through `--masks`, `--iterations=200`, and `--folds=01.JPG`.
`--folds=all` attempts every original input identity and records unregistered views explicitly. Use
`--profile=high --featureSide=1280` or `1600` for desktop geometry, and `--shuffle=104` for the
permuted picker order. Give simultaneous probes distinct ports. Resuming preserves and validates the
checkpoint's originating source hashes; it does not relabel old geometry as newly solved.

The evidence inventory records original and archived byte counts and SHA-256 hashes. Large raw
receipts and checkpoints use deterministic gzip; decompression preserves their exact original bytes.
`audit-report.json` records source validation, fold protocols, omissions, and exact-order
comparisons. Its interrupted-receipt warning is part of the result, not a completed-fold claim.

## Verification so far

All 18 photo diagnostics pass on the current code, including the exact-buffer identity regressions,
CPU-worker parity, EXIF orientation, actual mixed-intrinsics numeric solves, abort handling,
complete failure denominators, and the held-out RGB/mask sentinel through GPU training. Forty
existing Video to 3D cases pass unchanged. Full preflight passes, including all 271 shelf-wide
cases, formatting, American English, site freshness, parsing, and file-size checks. The broader
existing suite was not run in full.

The first preflight attempt had 270 passes and one graph-plotter slider failure while benchmarks and
training contended for the container's four CPU cores. Its trace shows the previous cactus model
still rendered at mouse-down even though `toyInfo` already identified Graph plotter: the fixed
2.5-second settling wait did not establish that the new model had drawn under load. The unchanged
test passed three consecutive repeats after the full-length training job finished, and the complete
preflight passed with the benchmark queue idle. Both logs and the original failure trace are
retained. No existing test or product file was changed to obtain the pass.

Two execution interruptions are recorded. The first ended execution clients while their owned
browsers remained; its completed Buddha JSONL rows were recovered with the caveat above. A later
confirmed managed-environment restart removed all running processes. Completed per-view receipts
survived unchanged; unfinished camera solves and folds were archived and restarted without choosing
scores. The underlying restart cause is unknown. Neither interruption supplies a missing metric or
changes a partial run into a completed one.

Rule check: none.
