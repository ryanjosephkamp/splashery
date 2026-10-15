# Native Video 3D color and background review

Made by Ryan with Codex (GPT-6), October 15, 2026. Read-only CPU review; no repository edits, browser launches, GPU work, runtime changes, external requests, or strict-result modifications. Parent's separately authorized background replay is cited as existing evidence.

## Confirmed issue: training background and viewer background differ

Frozen R8 trains ordinary unmasked video against black (`vendor/splatjs/src/gs/trainer.js`, `_camUniform`, public line 804). The forward shader computes `C = Σ(T_i α_i c_i) + T_final × background` (`vendor/splatjs/src/gs/shaders.js`, public lines 823–852). No `randomBg` option is enabled in the frozen Video 3D session options. Evaluation also forces black (`trainer.js`, `_evalPass`, public line 1324). The frozen production viewer starts with page white (`src/state.js:26`, `src/player.js:340`, `src/stage.js:107`); the saved replay receipt observed clear RGBA `[1,1,1,1]`.

A concrete reproduction is the saved R8 `dianthus-phone` PLY: load it through the unchanged frozen production viewer and replay the saved cameras. Parent's `/workspace/v3d-r4-media/background-probe-r1/receipt.json` first reproduced **all four saved render PNGs byte-for-byte**, then changed only the stage clear/background to black. All four black captures completed with no reported errors.

| Same R8 model and camera evidence | Mean PSNR | Mean SSIM | Mean Laplacian variance |
| --- | ---: | ---: | ---: |
| Original strict captures, page white | 11.467200 | 0.112766 | 0.00463243 |
| Separate black-background replay diagnostic | 17.654277 | 0.472900 | 0.00257345 |

The mean RGB white-minus-black lift is about 0.192–0.224 across these frames. For frame 1, mean RGB is white `[0.64485,0.48833,0.54847]`, black `[0.45272,0.29608,0.35621]`, and reference `[0.46883,0.30451,0.36635]`. Black restores much of the overall tone without changing model colors, poses, geometry, or image processing. The loss in Laplacian variance also shows that some white-background contrast was attributable to transparency edges; it is not automatically useful detail.

The strict main result remains PSNR 14.165402 / SSIM 0.270086 / Laplacian 0.000588139. Its row is not re-scored or replaced here. The black R8 replay is a **supplementary diagnostic**, not a new strict cohort comparison or recovered acceptance pass. Training PSNR 24.3 and held-out production PSNR are also different measurements: one is the accumulated training-path readout, while the other uses held-out source images and the exported/viewed model at the evaluation size.

This behavior has an exact compositing explanation without gamma changes. An opaque grayscale 0.2 surface and a color-0.8, alpha-0.25 surface both composite to 0.2 on black. The second composites to 0.95 on white. A black-only photographic loss cannot distinguish these solutions. The stored PLY alpha may additionally differ from trainer alpha because the exporter bakes an approximate nearest-camera Mip compensation; this review did not measure that contribution.

Actionable correction: carry the native bake's actual training background into its production display, or separately constrain photographic opacity during training. Parent already owns a `trainingBackground` product correction in the current public worktree. That is a source change requiring fresh native evidence; old strict scores stay immutable. No opacity forcing, recoloring, or acceptance workaround was introduced by this helper.

## Negative result: no evidence of double gamma encoding in the color chain

The code path is:

1. `vendor/splatjs/src/io/frames.js:256`: canvas bytes become RGB floats by division by 255, with no linearization. These are encoded photographic RGB numbers.
2. `vendor/splatjs/src/gs/trainer.js:333`: targets are packed back to RGBA8; `shaders.js:327` activates sigmoid DC directly, with no gamma conversion. Frozen Video 3D uses SH degree 0 and the sigmoid engine convention.
3. `vendor/splatjs/src/io/ply.js:125`: `gaussiansToPly` writes `(sigmoid(logit) − 0.5) / C0`; the v2 SH-DC branch passes existing coefficients through. This is SH coefficient conversion, not sRGB transfer.
4. `src/video3d/ply.js:51` reconstructs `clamp(0.5 + C0 × f_dc)`. `scene.js:240` and cleanup copy RGB unchanged for surviving rows. `src/packs/video3d.js` passes `s.color` into a kit cloud.
5. `src/kit.js:1083` accepts numeric arrays unchanged; `generators.js:125` stores them; `src/player.js:763` packs them into half-float `dataColor`. The kit/container path does **not** go back through another SH-DC conversion.
6. `src/effects.js:455` applies the ordinary effect exposure multiplier; `src/state.js:30` defaults it to 1, and the Video 3D splats disable pattern effects. No color transfer function is added there.
7. Vendored PlayCanvas's `prepareOutputFromGamma` (`vendor/playcanvas/playcanvas.min.mjs:15010`) explicitly treats input splat RGB as gamma encoded. CPU camera defaults are `GAMMA=SRGB`, `TONEMAP=LINEAR`, `FOG=NONE`. Under those defaults, `decodeGamma` (power 2.2, line 2696), linear tone mapping (`color × exposure`, line 6719), and output power 1/2.2 (line 3007) cancel at default scene exposure 1. The engine's scene constructor sets exposure 1. This is not an extra standalone gamma encode. On a linear/sRGB render target, the engine selects the corresponding decode/output route instead.

The CPU diagnostic uses the actual exporter and production PLY reader on 257 non-grid RGB triplets. Maximum absolute decoded RGB error is **4.2999×10⁻⁸**. The subsequent actual PlayCanvas float-to-half packing adds at most **0.000243962** for those samples. These errors are far smaller than the measured roughly 0.2 RGB lift from the white background. The test does not instantiate a GPU. Its first attempt used a nonexistent half-to-float API; that error log is preserved, and a direct IEEE-754 half decoder was used for the completed check.

Actual live shader defines and framebuffer formats were not queried by this helper, so this is a code/defaults trace and CPU transfer check, not a claim that every renderer configuration has identical blending. Existing white/black PNG deltas are nonnegative at every pixel. Their per-pixel RGB delta spreads reach 9/255, so white-minus-black provides only an approximate opacity diagnostic here, not an exact alpha readback. No exact-opacity claim is made.

## Task 55 opaque/BKD conventions

`tools/cdx-v3d-cpu-train.cpp:454` already documents and implements alternating black and white backgrounds for `opaque` photographic bakes; its optional checkpoint score includes both backgrounds (line 536). `tools/cdx-v3d-cpu-bake.mjs:324` records `raw classic 3DGS; no mip opacity bake` and the background mode. This differs from the native black-only training plus approximate Mip-opacity export.

BKD color packing (`src/baked.js:148`) stores `0.5 + C0 × f_dc` as bytes and alpha as sigmoid bytes. `splatAt` (line 226) divides by 255, and `src/video3d/baked.js` copies those values. There is no extra gamma transfer. Quantization error is at most 1/510 per channel before subsequent viewer packing. Existing opaque samples therefore should not be used as proof that a native black-only model has the same opacity/background behavior.

## Evidence and limits

`cpu-check.json` binds the CPU code, parent's probe receipt, every original/black/reference PNG hash, per-frame strict and diagnostic metrics, transfer errors, camera constructor defaults, and image statistics. `source-hashes.json` compares current public source hashes with frozen R8. The PLY color conversion, kit, effects, state, BKD, and vendored PlayCanvas modules match R8 exactly. Other public module differences were inspected: frame/background ownership changes in the pack, unrelated UI/token changes in player/stage, and the separate SSIM binding fix in trainer/shaders. Those do not change the RGB formulas quoted above. Parent's current new background routing is not attributed to frozen R8.

This review does not establish the cause of the remaining black-replay/photograph error, nor train/test generalization, opacity-export accuracy, camera accuracy, physical-phone cost, or final quality acceptance. It does not recommend source-specific adjustments. All original measurements and error evidence remain intact.

Rule check: none.
