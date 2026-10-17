# Photo to 3D: stable truth views and a Layered method study

**The Goal is unmet: a clean negative result.** Codex (GPT-6) built this study for task 99. Classic
stays byte-identical, and no Layered option or replacement model is enabled in the app. Two
reconstruction variants failed; that line of attack is closed.

The run started October 16, 2026, at 20:16:54 UTC, with a twelve-hour hard stop on October 17 at
08:16:54 UTC. The evaluation application is frozen at `144cc80ec6f3aee0b248a076fbf6159f6008d84f`.

## Part 1: a verified yardstick

All 12 original scenes were rendered at nine actual finder cameras and both profiles: 216 views. The
one similarity transform is fixed by the source camera and source median-depth plane; no target
pixels or candidate scores fit a camera. Portrait FOV uses the narrower axis, as PlayCanvas does. An
independent test compares Blender with the pinned engine’s projection matrix at 1,152 points over
nine poses and both orientations; maximum error is 0.000103 pixel.

Review rasters are phone 390×844 and desktop 720×450, area-resampled from native app frames. All
methods use Classic’s fixed projected footprint and the same unflagged geometry (`mask == 1`). Error
is `1 - masked SSIM`, with the established fully valid 7×7 luma windows. Boundary error is RGB MAE
in a two-pixel band around true depth changes exceeding 5%. Edge F1 is a diagnostic. All nine poses
enter the primary median; rotated-only results remain in the compressed records. Old flat-depth and
source-cue boundary scores never grant or veto a pass.

Eight-sample raw targets failed a noise control: identical room cameras, independent render seeds,
gave 0.587 masked SSIM error. The final color protocol uses 16 samples and normal/albedo-guided
OpenImageDenoise in the official Blender 4.3.2 build; that control falls to 0.0082. Cameras, exact
depth, and masks are reused unchanged. This one-view control does not certify convergence on every
scene. Target rasters stay outside Git. Classic yardstick rendering and scoring finished within two
hours.

| Method    | Median error | Error gain | Boundary MAE | Boundary gain | Edge F1 |
| --------- | -----------: | ---------: | -----------: | ------------: | ------: |
| Classic   |     0.577103 |          — |       47.013 |             — |  0.6544 |
| layered-a |     0.576916 |    +0.032% |       47.801 |       -1.677% |  0.6546 |
| layered-b |     0.577754 |    -0.113% |       47.888 |       -1.860% |  0.6539 |

Neither method reaches the required 10% error gain or 15% boundary gain. Both preserve the per-scene
5% regression limit. Support is identical across methods; missing values cannot pass.

## Part 2: depth bake-off

Portable rows below use actual vendored WASM outputs on all 12 truth scenes; CPU-only rows use
strictly loaded official FP32 checkpoints. Browser RGB tensors match production decoding and area
resampling byte for byte. The browser baseline also matches actual app worker outputs on all 12
scenes byte for byte. Native and browser kernels differ, so native timing never substitutes for WASM
time. WASM timing is the median of three uncontended room-image forwards at side 518, one thread, on
desktop Chromium 151; model loading and MoGe focal recovery are excluded.

Depth scores use the common 518×294 source grid. A positive affine inverse-depth fit uses one eighth
of valid pixels; the remaining pixels evaluate AbsRel and δ1. Missing predictions count against δ1.
Order error uses fixed pairs, and true-depth-boundary F1 allows a two-pixel match. These are
relative-depth results on this corpus, not absolute-distance or physical-phone claims.

| Model / accuracy backend  | Artifact MiB | Source license / weights card                                                                  | WASM seconds | AbsRel |     δ1 | Order error | Boundary F1 |
| ------------------------- | -----------: | ---------------------------------------------------------------------------------------------- | -----------: | -----: | -----: | ----------: | ----------: |
| da2 / WASM                |         26.0 | [Apache-2.0](https://huggingface.co/depth-anything/Depth-Anything-V2-Small/raw/main/README.md) |        1.530 | 0.0480 | 0.9761 |      0.0181 |      0.8133 |
| distill / WASM            |         94.4 | [MIT](https://huggingface.co/xingyang1/Distill-Any-Depth-Small-hf/raw/main/README.md)          |        5.213 | 0.0460 | 0.9869 |      0.0129 |      0.8412 |
| da3-small / WASM          |         95.8 | [Apache-2.0](https://huggingface.co/depth-anything/DA3-SMALL/raw/main/README.md)               |        2.747 | 0.0648 | 0.9712 |      0.0340 |      0.7285 |
| moge-small / WASM         |        134.3 | [MIT](https://huggingface.co/Ruicheng/moge-2-vits-normal/raw/main/README.md)                   |       14.382 | 0.0380 | 0.9926 |      0.0090 |      0.8857 |
| da3-base / CPU            |        516.4 | [Apache-2.0](https://huggingface.co/depth-anything/DA3-BASE/raw/main/README.md)                |          N/A | 0.0603 | 0.9838 |      0.0269 |      0.8250 |
| da3-mono-large / CPU      |       1274.8 | [Apache-2.0](https://huggingface.co/depth-anything/DA3MONO-LARGE/raw/main/README.md)           |          N/A | 0.0819 | 0.9402 |      0.0062 |      0.8954 |
| moge-large / CPU          |       1262.5 | [MIT](https://huggingface.co/Ruicheng/moge-2-vitl-normal/raw/main/README.md)                   |          N/A | 0.0275 | 0.9961 |      0.0031 |      0.9248 |
| moge-small-300-int8 / CPU |         73.0 | [MIT](https://huggingface.co/Ruicheng/moge-2-vits-normal/raw/main/README.md)                   |        3.132 | 0.0623 | 0.9851 |      0.0184 |      0.7060 |

Code licenses were checked live:
[DA2](https://raw.githubusercontent.com/DepthAnything/Depth-Anything-V2/main/LICENSE),
[Distill](https://raw.githubusercontent.com/Westlake-AGI-Lab/Distill-Any-Depth/main/LICENSE),
[MoGe](https://raw.githubusercontent.com/microsoft/MoGe/main/LICENSE), and
[DA3](https://raw.githubusercontent.com/ByteDance-Seed/Depth-Anything-3/3d835ec1a5802d64a8b8b15f817a1ab54809bfe4/LICENSE).
The linked weights cards were also checked live on October 16. No new model is vendored or shipped.

Distill’s portable export needs square padding. DA3 Small’s community export differs from the
official checkpoint by up to 1.46% relative RMS on the two parity probes; that row describes the
tested artifact. The official MoGe ONNX repository has no model card; its source weights are MIT,
and its corresponding outputs pass the two-still parity check. Full-checkpoint equivalence beyond
those probes is unestablished.

C, E, F, and J expectations are separate from metric truth. C records flat-plane span without
inventing a pass threshold. E checks visible uniform front/back ordering only where an occlusion cue
exists. F checks recession and held-out inverse-depth plane residuals. J contains AI-made Studio
inputs with no measured geometry: five predetermined examples were visually reviewed for grouping,
strands, ambiguity, and fine boundaries; full conformance is unestablished. Raw per-case
expectations, coverage, order checks, plane residuals, and the labeled J figure are on the evidence
branch. Reference rows and the optional 300-token quantization use a fixed balanced 20-case lab
subset; portable native sweeps have the exact coverage listed in the summary JSON.

MoGe Small gives the best measured portable truth-depth accuracy, with substantially higher
inference cost. The faster 300-token matrix-quantized configuration loses accuracy and boundary F1.
No phone-model replacement is enabled. The bake-off stayed within its three-hour budget.

## Part 3: Layered variants and the Goal

A uses a three-source-pixel soft band, three PatchMatch passes, and radius-two patches. B uses a
two-pixel band, five passes, radius-three patches, synthesized-patch coherence, and conservative
foreground-color cleanup. Both use our deterministic PatchMatch code, mask estimated foreground out
of patch context, copy the same photo, and expose a complete filled-pixel tint helper. They run
through explicit WebGL2 research overlays; worker/shader hits and frame hashes verify execution.
Their relief geometry and baseline depth model remain fixed. No owner vote is inferred from metrics.

| Gate                                        | Measured result                                                                                   | Status                                            |
| ------------------------------------------- | ------------------------------------------------------------------------------------------------- | ------------------------------------------------- |
| Truth: ≥10% gain, no scene >5% worse        | A +0.032%; B −0.113%; per-scene cap preserved                                                     | Failed                                            |
| Boundaries: ≥15% gain; no added thin losses | A −1.68%; B −1.86%; both add four bamboo losses at −30°                                           | Failed                                            |
| Ribbons, layered-a                          | 20 selected phone inputs; streak gain 79.4%; texture-loss delta -0.417; 0 ribbon regressions >5%  | Full 118-input gate unestablished                 |
| Ribbons, layered-b                          | 20 selected phone inputs; streak gain 89.2%; texture-loss delta +0.045; 0 ribbon regressions >5%  | Full 118-input gate unestablished                 |
| Blind owner preference: ≥14/20              | Twenty anonymous pairs recorded; no owner votes received                                          | Unmeasured                                        |
| Cost: ≤25% time; ≤150 MiB memory            | Five fresh-browser trials on one phone-profile input; A +7.4%, B +49.1%; no observed PSS increase | B fails the screen; device/corpus gate unmeasured |
| Classic and existing specs                  | Final golden: 77 passed; 56 live-input checks passed; full CI below                               | Classic passes; full-suite gate unmet             |

The ribbon scout uses the original atlas probes and verifies source-depth bytes. It is not the
118-input acceptance gate. B also loses one extra pinecone probe at −30° and one train probe at +20°
pitch. Thin checks compare every supported pose’s lost-probe count and support; a median or
unchanged worst pose cannot hide an additional loss. All 20 review pairs use actual 72-frame camera
arcs at 12 fps, with no frame interpolation. Both sides use the same Mesa renderer, native 585×1266
buffers, and 390×844 encoded output. Positions are balanced and identities hidden on the standalone
review page. The Operator can host that page; owner votes and a real phone run remain unmeasured.
The synthetic vote-download smoke test is not an owner review.

## Three blockers and what would remove them

1. **Geometry and occlusion remain wrong in true views.** Color-fill changes leave median error
   essentially unchanged. A camera-calibrated, projective reconstruction must pass the common-camera
   12-scene comparison; another fill tuning does not establish that improvement.
2. **Soft cuts harm true boundaries and narrow parts.** Both bands raise boundary error and lose
   additional bamboo probes. Foreground coverage and color unmixing must preserve thin opacity, then
   pass both true-boundary error and every supported thin-probe comparison.
3. **Phone quality and cost do not yet meet together.** The accurate portable MoGe artifact costs
   far more inference time, its faster configuration regresses, and B’s startup rises 49.1%. A
   verified phone export, adequate quantization or distillation, and device measurements must retain
   accuracy while meeting startup and memory limits.

## Verification, scope, and cuts

Classic golden: initial 77 and final 77 passed; new method tests: 13 passed. Camera checks cover
1,152 points. Moving photo, Splat mirror, and live-input checks: 56 passed across five files, with
no skips. Browser baseline parity: all 12 scenes byte-identical; review-page smoke test passed with
synthetic choices only. Full-suite status: all 393 spec files from 16 completed CI shards; 3,349
passed, 1 failed, 1 skipped. Final preflight: passed. Classic files, golden pins, Moving photo, the
Splat mirror, shared lists, and vendored runtimes are not edited. No shared engine commit is needed.
The retained change is offline evaluation code, tests, and unconnected research prototypes. A
positive shipping result is not claimed.

The CI recording-preview focus case (`shr:202`, assertion at line 351) fails initially and alone.
The same case passes locally on unchanged main with Chromium 141 and 151, and on this branch
with 141. The cause remains unresolved; a fully green regression suite is not claimed. The single CI
skip is the retained real-clip counterexample fixture, which is kept privately outside the
repository and was unavailable.

Excluded pilots include incorrect portrait-FOV targets, unstable eight-sample colors, unexecuted
overlays, 294-side scouts, and native integer-decoder inputs. They do not enter the primary tables.
The Layered UI, replacement-model switch, WebGPU variant, full 118-input audit, and MI-GAN
comparison were cut after the two reconstruction variants failed. No neural inpainter ships.

The main PR has only new files, at most 25 files and 4,000 added lines, one compact summary JSON,
and this report. True target rasters and prediction tensors stay outside Git. Per-pose records,
sources, method evidence, the J figure, and review clips live on `codex/photo-3d-next-clips`, never
merged. Offline tool versions are pinned in `tools/p3d-next-requirements.txt`; Blender’s official
[archive](https://mirrors.ocf.berkeley.edu/blender/release/Blender4.3/blender-4.3.2-linux-x64.tar.xz)
matches its
[published checksum](https://mirrors.ocf.berkeley.edu/blender/release/Blender4.3/blender-4.3.2.sha256).

## Reproduction

Use the frozen application commit and the study tools from this draft PR. Generate C, E, and F with
their existing builders into `.cache/depth-lab`; J is already shipped. Then:

```sh
python3 tools/p3d-next-setup.py
python3 tools/p3d-next-setup.py --blender-only
SPLASHERY_CHROMIUM=/usr/bin/chromium node tools/p3d-next-inputs.mjs
SPLASHERY_CHROMIUM=/usr/bin/chromium node tools/p3d-next-capture.mjs --candidate=classic --out=.cache/photo-3d-next/classic
node tools/p3d-next-truth-batch.mjs .cache/photo-3d-next/classic .cache/photo-3d-next/targets-correct review
.cache/photo-3d-next/blender-4.3.2-linux-x64/blender -b --factory-startup --threads 4 --python-exit-code 1 --python tools/p3d-next-truth.py -- --rerender-from .cache/photo-3d-next/targets-correct --out .cache/photo-3d-next/targets-guided --samples 16
node tools/p3d-next-score.mjs .cache/photo-3d-next/classic .cache/photo-3d-next/targets-guided .cache/photo-3d-next/classic-truth.json
SPLASHERY_CHROMIUM=/usr/bin/chromium node tools/p3d-next-wasm.mjs --out=.cache/photo-3d-next/wasm-quality --runs=1 --save-outputs=true
```

Capture A with `--band=3 --passes=3 --radius=2`; capture B with
`--band=2 --passes=5 --radius=3 --coherent=true --clean=true`, each in a fresh folder. Score the
same targets, and use `tools/p3d-next-compare.mjs`. The compressed source package supplies exact
capture settings and the selection/recording setup. Model manifests, pinned code revisions, hashes,
and every tested configuration are archived with the evidence. Rejected and partial coverage never
grant a pass.

Rule check: none.
