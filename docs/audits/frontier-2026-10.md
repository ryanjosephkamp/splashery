# The next browser 3D interactions

October 17, 2026. Codex (GPT-6), task 108, `codex/frontier-research`.

**Recommendation:** build a depth-guided light brush and budgeted progressive detail first. The two
linked prototypes run their core CPU stages without models, libraries, or external requests. Next: a
triangle viewer, small joint geometry estimation, and assisted object cutting. These are engineering
recommendations, not a benchmark ranking of research quality.

## Scope and evidence

The survey covers 2024–2026 publications and releases, including 2026 triangle splatting, Universal
Beta Splatting, MoGe-3, Inpaint360GS, and Mobile-GS/Flux-GS. A 2023 preprint with a 2024 conference
release is included. Each candidate links to its live repository or documentation; license links
were opened separately, as were the listed model cards and file manifests. Checks were made on
October 17, 2026. Primary-source snapshots, hashes, browser results, screenshots, and the
verification script belong on `codex/frontier-research-clips`, never merged.

**Reading the table:** P = the named code/model components use MIT, Apache-2.0, or BSD; this is not
clearance for every dependency or demo asset. R = reference only under task 108's narrower shipping
rule. U = unresolved permission, also reference only. Weights “scene-specific” means no general
pretrained network is needed; it does **not** clear the authors' downloadable scenes. No research
scene was reused. Phone feasibility, effort, and proposed features are my estimates; person-days
include a first integration, not production training. “View” and “generate/train” are assessed
separately.

**Runtime honesty:** NR means no ONNX Runtime Web/WebGPU inference measured here. Apart from the two
original probes, no implementation was executed. PyTorch/CUDA kernels are not automatically browser
operators. Model bytes below are published artifact sizes, not runtime RAM; additional encoders,
activations, copies, and sort buffers can dominate. ORT documents
[WebGPU operator coverage and CPU fallback](https://onnxruntime.ai/docs/tutorials/web/ep-webgpu.html),
[WASM/WebGPU setup](https://onnxruntime.ai/docs/tutorials/web/), and
[large-model limits](https://onnxruntime.ai/docs/tutorials/web/large-models.html). Do not turn
desktop paper FPS into phone FPS.

## Candidate survey

| Candidate and period                                                                                                                                                                                   | Code and weights checked; disposition                                                                                                                                                                                                                                                                                                                                                           | Size and browser runtime                                                                                                                                                                                     | Phone judgment and the interaction it enables                                                                                                                                       | Main risks; estimated effort                                                                                                      |
| ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------- |
| [2D Gaussian surfels, 2024](https://raw.githubusercontent.com/hbb1/2d-gaussian-splatting/main/README.md)                                                                                               | Code [Inria research license](https://raw.githubusercontent.com/hbb1/2d-gaussian-splatting/main/LICENSE.md), R; weights scene-specific, demo permissions unconfirmed.                                                                                                                                                                                                                           | No universal network; per-scene CUDA training; ORT N/A, browser port NR.                                                                                                                                     | Small exported surfel scenes plausible; train off device. Let a person inspect a thin reconstructed surface with meaningful normals.                                                | Grazing-angle holes, depth ordering, and restricted rasterizer; original renderer plus own geometry 7–12 days.                    |
| [Triangle Splatting, 2025 / 3DV 2026](https://raw.githubusercontent.com/trianglesplatting/triangle-splatting/main/README.md)                                                                           | Root [Apache-2.0](https://raw.githubusercontent.com/trianglesplatting/triangle-splatting/main/LICENSE.md) and [triangle rasterizer Apache-2.0](https://raw.githubusercontent.com/trianglesplatting/diff-triangle-rasterization/main/LICENSE.md), P for those components; training dependencies and scene weights not cleared.                                                                   | Scene-specific triangles, no universal model; CUDA reference, WebGPU/CPU port NR.                                                                                                                            | View plausible using hardware triangles; train off device. Let a person orbit, cut, or inspect a crisp reconstructed object.                                                        | Transparency, visibility, SH appearance, and a new file adapter; viewer 5–8 days.                                                 |
| [Deformable Beta Splatting, 2025](https://raw.githubusercontent.com/RongLiu-Leo/beta-splatting/main/README.md)                                                                                         | Root [Apache-2.0](https://raw.githubusercontent.com/RongLiu-Leo/beta-splatting/main/LICENSE), but [retained Gaussian license](https://raw.githubusercontent.com/RongLiu-Leo/beta-splatting/main/LICENSE_GAUSSIAN_SPLATTING.md) prevents blanket clearance, R for full pipeline; scene weights unconfirmed.                                                                                      | Scene-specific bounded kernels; CUDA/PyTorch reference, ORT N/A, browser NR.                                                                                                                                 | A small baked viewer might fit. Let a person change bounded primitive sharpness and inspect fine surfaces.                                                                          | Extra kernel/color parameters and shader work; 8–15 days after component audit.                                                   |
| [Universal Beta Splatting, ICLR 2026](https://raw.githubusercontent.com/RongLiu-Leo/universal-beta-splatting/main/README.md)                                                                           | [CC BY-NC 4.0 code](https://raw.githubusercontent.com/RongLiu-Leo/universal-beta-splatting/main/LICENSE), R; scene checkpoint terms not independently cleared.                                                                                                                                                                                                                                  | Joint spatial/angular/temporal kernels, scene-dependent size; browser NR.                                                                                                                                    | Rendering a small bake is plausible, not approved. Let a person explore motion and view-dependent appearance in one representation.                                                 | More dimensions increase bandwidth; no eligible drop-in runtime; 12–20 days for an original experiment.                           |
| [3DGRT / 3DGUT, 2024–2025; 2026 NHT extension](https://raw.githubusercontent.com/nv-tlabs/3dgrut/main/README.md)                                                                                       | Root [Apache-2.0](https://raw.githubusercontent.com/nv-tlabs/3dgrut/main/LICENSE), P for root code; SDK/dependency and scene licenses need separate checks.                                                                                                                                                                                                                                     | No universal network for base method; CUDA/OptiX reference; ORT N/A, browser NR.                                                                                                                             | Full ray tracer unsuitable now; rasterized camera approximation potentially portable. Let a person see distorted lenses, reflections, or secondary-ray effects.                     | Dedicated ray-tracing hardware in reference, absent direct WebGPU equivalent, and acceleration structures; 15–25 days.            |
| [TripoSR, 2024](https://raw.githubusercontent.com/VAST-AI-Research/TripoSR/main/README.md)                                                                                                             | [MIT code](https://raw.githubusercontent.com/VAST-AI-Research/TripoSR/main/LICENSE), [MIT weights](https://huggingface.co/stabilityai/TripoSR/raw/main/README.md), P; preprocessing dependencies still need audit.                                                                                                                                                                              | [1,677.25 MB checkpoint](https://huggingface.co/api/models/stabilityai/TripoSR?blobs=true); reference <0.5 s on A100 and ~6 GB VRAM, **not browser timing**; ORT NR.                                         | Generation unsuitable for the default phone path; exported mesh viewing fits. Let the owner make a complete object from one image off device.                                       | Invented hidden surfaces, extraction, and large weights; offline import spike 3–5 days, browser inference 15+ days.               |
| [TRELLIS, 2024](https://raw.githubusercontent.com/microsoft/TRELLIS/main/README.md)                                                                                                                    | [MIT majority/code and models](https://raw.githubusercontent.com/microsoft/TRELLIS/main/LICENSE), [MIT card](https://huggingface.co/microsoft/TRELLIS-image-large/raw/main/README.md); README explicitly excludes some render submodules, R for unmodified full stack.                                                                                                                          | [1,203.76 MB + 1,130.77 MB flow weights alone](https://huggingface.co/api/models/microsoft/TRELLIS-image-large?blobs=true), plus decoders/conditioning; ≥16 GB reference GPU; ORT NR.                        | Generate off device, view baked output. Let a person import an image-generated mesh or splat.                                                                                       | Iterative rectified flow, **not single-pass inference**, sparse CUDA ops, and mixed dependency licenses; offline 5–8 days.        |
| [TRELLIS.2, 2025](https://raw.githubusercontent.com/microsoft/TRELLIS.2/main/README.md)                                                                                                                | [MIT code](https://raw.githubusercontent.com/microsoft/TRELLIS.2/main/LICENSE), [MIT model](https://huggingface.co/microsoft/TRELLIS.2-4B/raw/main/README.md), P for those; separate renderer licenses called out by authors.                                                                                                                                                                   | [~2,584.6 MB per selected flow checkpoint](https://huggingface.co/api/models/microsoft/TRELLIS.2-4B?blobs=true), multiple stages plus encoders/decoders; ORT NR.                                             | No default phone generation; compact output may be viewed. Let the owner create textured material-aware objects off device.                                                         | Iterative multi-stage synthesis and large memory; offline 5–10 days.                                                              |
| [SHARP, 2025](https://raw.githubusercontent.com/apple/ml-sharp/main/README.md)                                                                                                                         | [Custom code license](https://raw.githubusercontent.com/apple/ml-sharp/main/LICENSE), [research-only model license](https://raw.githubusercontent.com/apple/ml-sharp/main/LICENSE_MODEL), R.                                                                                                                                                                                                    | [2,809.74 MB checkpoint, HEAD checked](https://ml-site.cdn-apple.com/models/sharp/sharp_2572gikvuh.pt); single feed-forward image-to-Gaussians, browser NR.                                                  | Generation unsuitable now; viewing a lawfully made compatible output is a separate question. Let a person move slightly around a photograph.                                        | Disocclusions, restricted weights, and model size; study only, 10–20-day port estimate.                                           |
| [Stable Fast 3D, 2024](https://raw.githubusercontent.com/Stability-AI/stable-fast-3d/main/README.md)                                                                                                   | [Stability community code license](https://raw.githubusercontent.com/Stability-AI/stable-fast-3d/main/LICENSE.md), [custom weight terms in official metadata](https://huggingface.co/api/models/stabilityai/stable-fast-3d?blobs=true), R; full card text returned HTTP 401.                                                                                                                    | [4,024.29 MB checkpoint](https://huggingface.co/api/models/stabilityai/stable-fast-3d?blobs=true); README ~6 GB reference VRAM; ORT NR.                                                                      | No default phone generation. Let an off-device author make a UV-unwrapped object with material estimates.                                                                           | Revenue-conditioned terms fail task allowlist, gated model, and hidden-surface errors; offline 4–7 days if separately authorized. |
| [Hunyuan3D-2, 2025](https://raw.githubusercontent.com/Tencent-Hunyuan/Hunyuan3D-2/main/README.md)                                                                                                      | [Tencent community code license](https://raw.githubusercontent.com/Tencent-Hunyuan/Hunyuan3D-2/main/LICENSE), [custom weight terms](https://huggingface.co/tencent/Hunyuan3D-2/raw/main/README.md), R.                                                                                                                                                                                          | [~4,928 MB shape checkpoint](https://huggingface.co/api/models/tencent/Hunyuan3D-2?blobs=true), plus paint/delight; README 6 GB shape / 16 GB combined VRAM; ORT NR.                                         | Generate off device only. Let an author synthesize a textured object from one or several views.                                                                                     | Multi-stage diffusion, large working set, and custom terms; offline 5–10 days if separately authorized.                           |
| [TripoSG, 2025](https://raw.githubusercontent.com/VAST-AI-Research/TripoSG/main/README.md)                                                                                                             | [MIT code](https://raw.githubusercontent.com/VAST-AI-Research/TripoSG/main/LICENSE), [MIT main weights](https://huggingface.co/VAST-AI/TripoSG/raw/main/README.md), but default [RMBG-1.4 weights have custom terms](https://huggingface.co/briaai/RMBG-1.4/raw/main/README.md), R for default pipeline.                                                                                        | [5,758.28 MB transformer](https://huggingface.co/api/models/VAST-AI/TripoSG?blobs=true), plus ~1,217.52 MB encoder and ~970.69 MB VAE; ≥8 GB reference GPU; ORT NR.                                          | No default phone inference. Let an author turn an image or drawing into a detailed shape off device.                                                                                | Iterative rectified flow and restricted default background remover; replace preprocessing, offline 5–8 days.                      |
| **1. [Depth Anything V2 Small → normal-guided light, 2024](https://raw.githubusercontent.com/DepthAnything/Depth-Anything-V2/main/README.md)**                                                         | [Apache-2.0 code](https://raw.githubusercontent.com/DepthAnything/Depth-Anything-V2/main/LICENSE), [Apache-2.0 Small weights](https://huggingface.co/depth-anything/Depth-Anything-V2-Small/raw/main/README.md), P; Base/Large/Giant are NC and excluded. Probe uses original code and no weights.                                                                                              | Small 24.8M; [99.22 MB official PyTorch file](https://huggingface.co/api/models/depth-anything/Depth-Anything-V2-Small?blobs=true). Neural ORT runtime NR here; geometric stage measured below.              | Promising for on-demand lighting after depth, not live camera inference proven. Let a person drag a light across a photo's estimated surface.                                       | Relative depth is not metric geometry or albedo; texture/shadow leakage, edge halos, and unlit hidden surfaces; 2–4 days.         |
| [Depth Anything 3 Small/Base, 2025](https://raw.githubusercontent.com/ByteDance-Seed/Depth-Anything-3/main/README.md)                                                                                  | [Apache-2.0 code](https://raw.githubusercontent.com/ByteDance-Seed/Depth-Anything-3/main/LICENSE), [Small](https://huggingface.co/depth-anything/DA3-SMALL/raw/main/README.md) / [Base](https://huggingface.co/depth-anything/DA3-BASE/raw/main/README.md) Apache-2.0, P; Large/Giant NC excluded.                                                                                              | [Small 137.25 MB](https://huggingface.co/api/models/depth-anything/DA3-SMALL?blobs=true), [Base 541.52 MB](https://huggingface.co/api/models/depth-anything/DA3-BASE?blobs=true); PyTorch reference, ORT NR. | Small merits an export probe; multi-view attention may exceed phone RAM. Let a person align a few photos with jointly predicted depth and cameras.                                  | Small lacks the Giant GS head; dynamic view count, export, and memory; 7–12 days.                                                 |
| **4. [MoGe-2 Small with normals, 2025/2026](https://raw.githubusercontent.com/microsoft/MoGe/main/README.md)**                                                                                         | [MIT code](https://raw.githubusercontent.com/microsoft/MoGe/main/LICENSE), DINOv2 portion Apache-2.0 per README, [MIT Small normal weights](https://huggingface.co/Ruicheng/moge-2-vits-normal/raw/main/README.md), P.                                                                                                                                                                          | 35M per README; [140.55 MB model.pt](https://huggingface.co/api/models/Ruicheng/moge-2-vits-normal?blobs=true); no measured ORT export.                                                                      | Plausible quantized still-image experiment; not phone-proven. Let a person get normals, depth, and field of view together for better lighting and camera motion.                    | Point-map postprocessing, metric failures, operator parity, and quantization; 7–12 days.                                          |
| [MoGe-3, 2026](https://raw.githubusercontent.com/microsoft/MoGe/main/README.md)                                                                                                                        | Same [MIT root code](https://raw.githubusercontent.com/microsoft/MoGe/main/LICENSE); [MIT ViT-L model card](https://huggingface.co/Ruicheng/moge-3-vitl/raw/main/README.md), P for those components.                                                                                                                                                                                            | [1,481.33 MB ViT-L checkpoint](https://huggingface.co/api/models/Ruicheng/moge-3-vitl?blobs=true), README 370M; sparse volumetric refinement, browser NR.                                                    | Not a default phone model; offline quality reference. Let an author recover finer geometry from one image.                                                                          | Sparse refinement and memory, not just a larger depth head; 12–20 days for browser feasibility.                                   |
| [DSINE, CVPR 2024](https://raw.githubusercontent.com/baegwangbin/DSINE/main/README.md)                                                                                                                 | [Custom Imperial software agreement](https://raw.githubusercontent.com/baegwangbin/DSINE/main/LICENSE), R; separate checkpoint permission and byte size unconfirmed.                                                                                                                                                                                                                            | Learned normals with ray conditioning; PyTorch reference; ORT NR.                                                                                                                                            | A distillation/export study might fit, current package excluded. Let a person inspect crisp surface orientation from one image.                                                     | Restricted code, ray/intrinsic conventions, and missing approved export; 8–15 days.                                               |
| [Depth Pro, 2024/ICLR 2025](https://raw.githubusercontent.com/apple/ml-depth-pro/main/README.md)                                                                                                       | [Custom code and weight terms](https://raw.githubusercontent.com/apple/ml-depth-pro/main/LICENSE), R.                                                                                                                                                                                                                                                                                           | [1,904.45 MB official checkpoint, HEAD checked](https://ml-site.cdn-apple.com/models/depth-pro/depth_pro.pt); reference depth and focal prediction; ORT NR.                                                  | Too large for default phone path. Let an author recover camera-aware metric depth from an image.                                                                                    | License allowlist, multi-scale memory, and false metric confidence; 10–20-day port estimate.                                      |
| [VGGT, 2025](https://raw.githubusercontent.com/facebookresearch/vggt/main/README.md)                                                                                                                   | [Custom VGGT code license](https://raw.githubusercontent.com/facebookresearch/vggt/main/LICENSE.txt), [original weights CC BY-NC](https://huggingface.co/facebook/VGGT-1B/raw/main/README.md); new gated commercial checkpoint is also custom per README, R.                                                                                                                                    | [5,026.37 MB original checkpoint](https://huggingface.co/api/models/facebook/VGGT-1B?blobs=true); multi-image transformer; ORT NR.                                                                           | No default phone inference. Let an author reconstruct cameras and geometry from a few photos without per-scene optimization.                                                        | View count increases memory; “commercial-friendly” is not MIT/Apache/BSD; 15–25 days.                                             |
| [4D Gaussian Splatting, CVPR 2024](https://raw.githubusercontent.com/hustvl/4DGaussians/master/README.md)                                                                                              | [Apache-2.0 root](https://raw.githubusercontent.com/hustvl/4DGaussians/master/LICENSE.md), but [depth rasterizer Inria license](https://raw.githubusercontent.com/ingra14m/depth-diff-gaussian-rasterization/main/LICENSE.md), R for full stack; scene weights unconfirmed.                                                                                                                     | Scene-specific Gaussians plus deformation field; CUDA training, ORT NR.                                                                                                                                      | Train off device; small baked/deformation playback plausible. Let a person orbit a moving captured scene.                                                                           | Occlusion, deformation inference, and inconsistent monocular geometry; playback spike 7–12 days.                                  |
| [4DGC, CVPR 2025](https://raw.githubusercontent.com/MediaX-SJTU/4DGC/main/README.md)                                                                                                                   | No root license found in original or linked replacement repository, U; scene weights not cleared.                                                                                                                                                                                                                                                                                               | Rate-aware motion/attribute compression, scene-dependent bytes; Python/CUDA/entropy reference, browser NR.                                                                                                   | Decode-only worth studying, not shippable package. Let a person scrub a compressed moving capture.                                                                                  | Initial 3DGS, temporal dependencies, and codec/export work; 10–18 days after permission.                                          |
| [4DGCPro, NeurIPS 2025](https://raw.githubusercontent.com/MediaX-SJTU/4DGCPro/main/README.md)                                                                                                          | No root license found, U; downloadable data/checkpoint permissions unconfirmed.                                                                                                                                                                                                                                                                                                                 | Hierarchical progressive dynamic compression, scene-dependent bytes; browser NR.                                                                                                                             | Potential chunked playback, no phone proof. Let a person start a volumetric video before every quality layer arrives.                                                               | Random access, base/enhancement dependencies, and decoder state; 12–20 days after permission.                                     |
| [GS-IR, CVPR 2024](https://raw.githubusercontent.com/lzhnb/GS-IR/main/README.md)                                                                                                                       | [MIT root](https://raw.githubusercontent.com/lzhnb/GS-IR/main/LICENSE), [bundled Inria rasterizer](https://raw.githubusercontent.com/lzhnb/GS-IR/main/submodules/diff-gaussian-rasterization/LICENSE.md), R for full pipeline; material/scene checkpoints unconfirmed.                                                                                                                          | Scene-specific inverse rendering and lighting caches; CUDA reference, browser NR.                                                                                                                            | Bake off device, evaluate small material layers on phone. Let a person rotate illumination around a reconstructed object.                                                           | Separating baked radiance from albedo, shadow/occlusion storage, and non-diffuse reflections; 10–18 days.                         |
| [GaussCtrl, ECCV 2024](https://raw.githubusercontent.com/ActiveVisionLab/gaussctrl/main/README.md)                                                                                                     | [BSD-3-Clause wrapper](https://raw.githubusercontent.com/ActiveVisionLab/gaussctrl/main/LICENSE.txt); diffusion/segmentation dependencies not under blanket wrapper grant, R for full stack; model weights not cleared.                                                                                                                                                                         | Multi-view diffusion plus scene refinement; no single generic checkpoint size; ORT NR.                                                                                                                       | Offline editing, not phone generation. Let an author recolor or replace selected scene content consistently across views.                                                           | Diffusion license, identity drift, training time, and invented geometry; 10–18 days.                                              |
| [LangSplat, CVPR 2024](https://raw.githubusercontent.com/minghanqin/LangSplat/main/README.md)                                                                                                          | [Inria code license](https://raw.githubusercontent.com/minghanqin/LangSplat/main/LICENSE.md), R; language features and SAM/CLIP/checkpoint chain need separate grants.                                                                                                                                                                                                                          | Scene-specific feature field plus language/segmentation models; browser NR.                                                                                                                                  | Bake labels off device, use compact masks on phone. Let a person point to or search for an object in a captured scene.                                                              | Ambiguous labels, view leakage, and feature memory; mask-only playback 5–8 days.                                                  |
| **5. [SAM 2.1 Tiny, 2024 → splat object cutting](https://raw.githubusercontent.com/facebookresearch/sam2/main/README.md)**                                                                             | [Apache-2.0 code and checkpoints](https://raw.githubusercontent.com/facebookresearch/sam2/main/LICENSE) explicitly stated in README; [Apache-2.0 model card](https://huggingface.co/facebook/sam2.1-hiera-tiny/raw/main/README.md), P; demo fonts not needed.                                                                                                                                   | 38.9M; [155.91 MB safetensors](https://huggingface.co/api/models/facebook/sam2.1-hiera-tiny?blobs=true); PyTorch reference; ORT encoder/decoder/browser timings NR.                                          | Still-image point prompting plausible after export/quantization; continuous video uncertain. Let a person tap an object, cut its visible splats, and combine it with another scene. | A 2D mask is not 3D identity; occlusions, lifting, and activation memory; 7–12 days.                                              |
| [Inpaint360GS, WACV 2026](https://raw.githubusercontent.com/dfki-av/Inpaint360GS/main/README.md)                                                                                                       | [Apache-2.0 root](https://raw.githubusercontent.com/dfki-av/Inpaint360GS/main/LICENSE.txt), but [Inria rasterizer](https://raw.githubusercontent.com/dfki-av/Inpaint360GS/main/submodules/diff-gaussian-rasterization/LICENSE.md); LaMa code is [Apache-2.0](https://raw.githubusercontent.com/dfki-av/Inpaint360GS/main/LaMa/LICENSE), separate model grants unconfirmed, R for full pipeline. | Per-scene segmentation, color/depth inpainting, and optimization; model/checkpoint total not verified; ORT NR.                                                                                               | Offline only presently. Let an author remove an object and fill exposed scene content across views.                                                                                 | Hallucinated hidden geometry, seam consistency, and mixed dependencies; 12–20 days.                                               |
| [SuperSplat editing, 2024–2026](https://raw.githubusercontent.com/playcanvas/supersplat/main/README.md)                                                                                                | [MIT code](https://raw.githubusercontent.com/playcanvas/supersplat/main/LICENSE), P; weights N/A, user scene rights separate.                                                                                                                                                                                                                                                                   | Model-free selection/transforms/export; browser implementation exists upstream, not executed here.                                                                                                           | Small scenes plausible with touch controls. Let a person lasso, delete, crop, transform, and combine splats.                                                                        | Cutting reveals holes, no automatic completion, and touch selection ambiguity; focused integration 3–6 days.                      |
| [SOG, 2025–2026](https://developer.playcanvas.com/user-manual/gaussian-splatting/formats/sog/)                                                                                                         | [MIT converter](https://raw.githubusercontent.com/playcanvas/splat-transform/main/LICENSE), P; weights N/A; encoded asset license stays with asset.                                                                                                                                                                                                                                             | Quantized attributes and WebP textures; docs describe ~15–20× versus PLY, scene-dependent; ORT N/A, existing browser ecosystem.                                                                              | Decode/display plausible; encode off device. Let a person open a detailed capture with less transfer.                                                                               | Lossy quantization, texture decode copies, and full-resident VRAM despite small download; additional audit 2–4 days.              |
| [SPZ, 2024–2026](https://raw.githubusercontent.com/nianticlabs/spz/main/README.md)                                                                                                                     | [MIT code](https://raw.githubusercontent.com/nianticlabs/spz/main/LICENSE), P; weights N/A; scene rights separate.                                                                                                                                                                                                                                                                              | Quantized attributes, version-dependent compression; current README includes v4 ZSTD streams and WASM interface; browser implementation not measured here.                                                   | Decode plausible, large assets still costly. Let a person open a compact portable splat file locally.                                                                               | Version negotiation, coordinate/SH conventions, and decode peak; 3–5 days.                                                        |
| **2. [Spatial LOD: streamed SOG](https://developer.playcanvas.com/user-manual/splat-transform/streamed-sog/) / [Spark, 2025–2026](https://raw.githubusercontent.com/sparkjsdev/spark/main/README.md)** | [MIT converter](https://raw.githubusercontent.com/playcanvas/splat-transform/main/LICENSE), [MIT Spark](https://raw.githubusercontent.com/sparkjsdev/spark/main/LICENSE), P; weights N/A, hierarchy asset rights separate. Probe is original, not an upstream port.                                                                                                                             | Chunked multiresolution data; ORT N/A; measured CPU core below, upstream runtime not measured.                                                                                                               | Promising with hard byte/point limits. Let a person open a capture immediately and spend detail only near the current view.                                                         | Pop/seam/opacity changes, cache growth, and poor worst-case chunk sizes; 4–7 days.                                                |
| [WebGPU radix sorting, current 2026 engine](https://raw.githubusercontent.com/playcanvas/engine/main/src/scene/graphics/radix-sort/compute-radix-sort.js)                                              | [MIT engine code](https://raw.githubusercontent.com/playcanvas/engine/main/LICENSE), P; weights N/A; current upstream is not approval to upgrade vendored 2.22.3.                                                                                                                                                                                                                               | GPU uint32 key/value sort; ORT N/A, NR here. Estimated 16N bytes for two key/index pairs, before histograms and splats.                                                                                      | Feature-detected compute can help; keep CPU/WebGL fallback. Let a person rotate a larger scene without CPU sort stalls.                                                             | Workgroup limits, device loss, ordering precision, and driver variation; isolated engine spike 5–8 days.                          |
| [Mobile-GS](https://raw.githubusercontent.com/xiaobiaodu/Mobile-GS/main/README.md) / [Flux-GS, 2026](https://raw.githubusercontent.com/xiaobiaodu/Flux-GS/main/README.md)                              | Mobile-GS has no root license found; Flux root [Apache-2.0](https://raw.githubusercontent.com/xiaobiaodu/Flux-GS/main/LICENSE), but renderer repo has no root license found and [scene weights lack a declared grant](https://huggingface.co/api/datasets/mobile-gs2/mobile-gs2), U for complete package.                                                                                       | Scene-specific energy aggregation/compression; released WebGL renderer per README; not executed here, ORT N/A.                                                                                               | Explicitly targets mobile rendering, but paper/native/WebGL results do not establish Splashery performance. Let a person view dense captures on less capable devices.               | Unclear renderer/assets permission, training dependencies, and visual tradeoffs; independent kernel study 8–15 days.              |

### Decision-changing cautions

The table's component licenses override root badges. DA3 Small also has a metadata discrepancy: its
[file manifest](https://huggingface.co/api/models/depth-anything/DA3-SMALL?blobs=true) reports
34,299,463 float32 parameters / 137,248,940 bytes; its README says 0.08B parameters. Reconcile the
architecture before export. Small/Base lack the Giant GS head. TripoSR and SHARP are feed-forward;
TRELLIS, TRELLIS.2, TripoSG, and Hunyuan3D use iterative generation, although none needs per-scene
training. No official ONNX export was verified for the proposed geometry/segmentation models. A
community conversion does not meet this brief's official-host requirement. The probes need no
weights.

## Top five build plans

Ranked by visible value, license clarity, reuse, and effort. These are future plans; numerical gates
are proposed acceptance criteria, not measured results.

### 1. Depth-guided light brush — 2–4 days; Codex first, Claude for the toy

**Build and experience.** Start from the existing approved Small depth path, not a new checkpoint. A
person opens a photo, waits for one depth pass, then drags a light. Offer the source photo, an
orientation view, and the lit result. Call it “depth-guided lighting”; do not promise removal of
baked shadows or accurate materials. The prototype below isolates the inexpensive geometry/shading
stage with known albedo, so a photo integration still has a substantial quality gate.

**Implementation and location.** Codex adds a separately reviewed pure module beside `src/depth/`
that unprojects depth with explicit focal length, uses centered 3D differences, rejects depth
boundaries, and caches normals. Convert the model's relative/inverse-depth convention explicitly; do
not feed normalized grayscale into metric unprojection. Feed buffers through a worker with
generation IDs and cancellation. Add normal/debug exports without changing classic Photo to 3D. A
later Claude lane owns the labs interaction and shader, reusing PlayCanvas through `src/pc.js` and
preserving source color.

**Milestones.** First match analytic spheres/planes; then check edge masks on 20 licensed stills;
finally compare additive light modulation with the original photo at 390×844. Keep a model-free
known-depth mode for diagnostics. Do not add DSINE, Depth Pro, or a diffusion de-lighter to repair
failures.

**Release gates.** Analytic normal p95 error <1° away from silhouettes; no halos across depth
discontinuities; >30 Hz light interaction at a phone-sized working resolution on a physical midrange
phone; <32 MiB additional accounted buffers; cancellation releases work; zero upload/network
inference; no weight load before conversion. Measure end-to-end depth latency and process memory
separately. Reject or label images with strong baked shadows, glass, or unreliable depth instead of
calling the output physically correct. If the real-photo comparison fails, retain only the normal
inspector. Existing export, scene, and classic-photo regressions must remain green.

### 2. Budgeted progressive spatial LOD — 4–7 days; Codex engine/tooling lane

**Build and experience.** Display a complete coarse object quickly, then refine only the current
view within explicit point and byte caps. Model the data as a manifest, spatial chunk bounds, and
replaceable quality levels. Reuse the ideas in
[streamed SOG](https://developer.playcanvas.com/user-manual/splat-transform/streamed-sog/) and
[Spark's configurable LOD count](https://sparkjs.dev/docs/spark-renderer/); do not add a second
runtime or silently update PlayCanvas. The prototype validates chunk replacement, sorting,
cancellation, and a point cap with local binary packets; it does not validate a real codec or a
network.

**Implementation and location.** Add an off-device generator under `tools/` that derives licensed
coarse parents and SOG chunks from an existing allowed capture. A standalone loader experiment
should precede an additive engine PR under `src/`, merged before any toy lane. Separate manifest
parsing, view/error selection, fetching, decode, and cache eviction. Use abortable same-origin
requests, a bounded worker queue, generation IDs, explicit byte ownership, and an LRU byte cap.
Every node has exactly one active representation. Keep a full-file fallback for existing scenes and
saved links.

**Milestones.** First validate coverage and budget on a small real asset; then serve separate
same-origin chunks with controlled latency and interruption; then test camera reversal and repeated
open/close. Check alpha/color continuity before adding ambitious millions-of-points targets. The
current point-only cap must become a cap on decoded arrays, textures, in-flight transfers, and sort
scratch.

**Release gates.** Coarse transfer ≤1 MB and first complete coverage ≤1 second under a declared 10
Mbps/80 ms network profile; p95 frame time ≤33 ms on a physical target phone; no missing regions or
doubled parent/child opacity; no unbounded cache after 50 view changes; cancel/retry preserves a
valid coarse scene; version/corruption limits fail cleanly; legacy single-file paths pass preflight.
Measure actual HTTP bytes, decode peak, and GPU memory where available. If blending fails, use
explicit quality steps. Do not infer network performance from the local producer.

### 3. Triangle splat inspector — 5–8 days; Codex adapter, Claude visual lane

**Build and experience.** A small opaque or lightly translucent reconstructed object with a
triangle/wireframe toggle, normal view, and a planar slice. This tests whether bounded planar
primitives yield a useful crisp inspector, not whether a procedural mesh reproduces the paper's
reconstruction quality. Both
[root](https://raw.githubusercontent.com/trianglesplatting/triangle-splatting/main/LICENSE.md) and
[rasterizer](https://raw.githubusercontent.com/trianglesplatting/diff-triangle-rasterization/main/LICENSE.md)
are Apache-2.0; that does not grant rights to example captures or every training dependency.

**Implementation and location.** Start as `tools/pages/` research output with an original CC0
sample. Codex specifies a versioned triangle attribute adapter with finite-value, count, and bounds
checks. Port only the permitted inference/rendering components or independently implement documented
projection; keep training dependencies off the browser path. A later hybrid labs toy uses the
current PlayCanvas mesh pipeline through `src/pc.js`, with optional per-triangle appearance and
explicit labeling as a hybrid. Any engine addition has its own additive PR. Preserve SH degree and
color-space metadata rather than flattening them accidentally.

**Milestones.** First test triangle projection and near-plane clipping on known geometry; then
back-to-front transparency and a reference render; then one independently licensed real
reconstruction with a full asset record. The owner may train original data off device only after the
training chain is cleared. No downloaded author checkpoint ships by default.

**Release gates.** No cracks under orbit or camera-inside tests; no near-plane explosions or NaNs;
reference-view image error and SH appearance documented; 30 Hz at a declared 50k-triangle phone
tier; ≤15 MB default transfer; slice topology does not pretend to reveal unobserved interiors.
Compare visual sharpness and memory against the same source encoded as ordinary splats. If
transparency is unstable, ship only opaque inspection. Require touch targets, phone clips, license
notices, and the existing hybrid/shelf checks before a toy PR.

### 4. Joint depth, normals, and camera with MoGe-2 Small — 7–12 days; Codex feasibility lane

**Build and experience.** One still image yields a normal inspector, a field-of-view estimate, and a
small camera move with fewer inconsistent geometry assumptions. The
[35M Small normal model](https://raw.githubusercontent.com/microsoft/MoGe/main/README.md) has
[MIT weights](https://huggingface.co/Ruicheng/moge-2-vits-normal/raw/main/README.md), unlike several
normal-estimation alternatives. It is not already a working web export, and the weight download
alone is 140.55 MB. Keep the approved depth path as the default until this clears its gates.

**Implementation and location.** First keep export scripts and downloaded weights on a
research/clips branch. Freeze the official model revision, preprocessing, output axis conventions,
focal/metric postprocessing, and validity mask. Export an explicit fixed-resolution ONNX graph;
compare float32, float16, and int8. Try ORT WebGPU with complete operator accounting; measure WASM
fallback instead of allowing surprising partial CPU execution. The runtime experiment remains a
standalone page that fetches only official, approved-host weights at the person's request. Later
vendoring would require a separate scoped PR and the repository's model approval/size rules.

**Milestones.** Establish native numerical reference on original/allowed scenes; export all outputs
including camera estimation; then quantize and test on two physical phone classes. Workload
estimates of ~35 MB int8 weights are arithmetic lower bounds, not an existing checkpoint size or
total RAM prediction. Do not use the large model's desktop timing for this Small export.

**Release gates.** Normal error changes <2° and depth relative error changes <5% versus the
unquantized reference on a fixed validation set; camera convention tests pass; still-image
completion ≤5 seconds and peak incremental process memory <256 MiB on target phones; cancellable
worker; network failure leaves the existing tool usable. Record ORT version, providers, unsupported
operators, model hash, and actual download bytes. Stop if export or memory fails; an offline
geometry import is the fallback, not a hidden server. Only after these pass should a Claude lane
build the photo interaction.

### 5. Tap, cut, and combine with SAM 2.1 Tiny — 7–12 days; Codex pipeline, Claude touch UX

**Build and experience.** Tap an object in the source image, inspect a proposed mask, then cut or
move only the corresponding visible splats. Begin with stills. Keep manual lasso and undo as a
usable model-free path, informed by
[SuperSplat](https://raw.githubusercontent.com/playcanvas/supersplat/main/README.md). Neither SAM
nor a 2D mask reconstructs an object's hidden side, and deleting a foreground object does not
inpaint the background.

**Implementation and location.** Research exports live on the clips branch first. Separate the Tiny
image encoder from prompt/mask decoding, cache exactly one embedding, and bound video state to zero
initially. Use the official
[Apache-2.0 checkpoint](https://huggingface.co/facebook/sam2.1-hiera-tiny/raw/main/README.md), not
the demo's fonts or unapproved wrappers. Lift masks into the already known photo-to-splat
correspondence; for arbitrary captures require multi-view consistency and a visible confidence
preview. A future Codex module beside the photo import path handles selection IDs and undoable
transforms. A Claude labs lane owns touch correction and compositing controls; shared engine changes
are separate.

**Milestones.** First get encoder/decoder ONNX parity; then one local still, one positive/negative
click, correction, undo, and mask-to-splat mapping. Combine only separately credited assets with
compatible licenses; preserve each asset's identity rather than blending NC and BY-SA sources into a
new combined asset. No generative fill in this phase.

**Release gates.** Mask intersection-over-union ≥0.98 versus native reference on fixed prompts;
prompt response ≤150 ms after embedding on a physical phone; initial encoding ≤5 seconds; <256 MiB
incremental process peak; no background model load, upload, or retained user file; no selection
leaking behind an occluder. Verify cut/undo/reopen and old scene links. If the encoder is too large
or the mask cannot be lifted reliably, keep manual selection and ship no neural claim. Text-guided
editing and Inpaint360GS remain separate research projects with unresolved dependency/weight
permissions.

## Two working CPU probes and results

Serve the repository with `node tools/cdx-mp2-server.mjs 4173`, then open
[depth-guided light](../../tools/pages/frontier-relight.html) and
[progressive spatial detail](../../tools/pages/frontier-lod.html). They are standalone, unlinked
from the site, and make no external requests. Original code is MIT; original inline procedural
samples are CC0, made by Ryan with Codex (GPT-6). No new library, third-party code, or weight is
committed. Both pages publish live time/memory JSON and expose `window.frontier` for repeatable
diagnostics.

**Environment and protocol.** Chromium 151.0.7922.173, headless Linux x86-64, five exposed Xeon
Platinum 8573C CPUs, CPU/Canvas 2D, no WebGPU or model inference. Internal raster 640×400; desktop
viewport 1440×900 and phone-width viewport 390×844. These are desktop CPU measurements at two layout
sizes, **not physical phone measurements**. One run per layout, one warm-up excluded, 21 final-view
frames; median/p95 are within-run distributions. No CPU throttling. Timing ends after canvas
submission, not presentation; worker/frame scheduling is included in LOD startup.

**Light brush result.** Desktop sample/normal construction: 140.0/118.9 ms. Lighting median/p95:
24.9/26.2 ms; phone-width layout: 24.0/25.3 ms. Of 256,000 pixels, 250,708 pass boundary rejection;
angular error against independently analytic sphere/plane normals: median 0°, p95 0.0284°. Accounted
resident arrays and three canvas RGBA backings: 12,544,000 bytes (11.96 MiB). This proves
perspective normals and controllable shading on known geometry/albedo. It does not prove inferred
depth, normal quality on photos, illumination removal, cast shadows, hidden geometry, or real
material recovery. Rejected silhouettes remain visible as a narrow boundary, a deliberate diagnostic
limitation.

**LOD result.** With an 8,192-point cap, 16 coarse patches cover the sculpture, then 21 replacement
packets refine it to 7,936 points; no parent/child duplication. Complete coarse coverage: 267.1 ms;
refinement completion: 760.3 ms; received local packet bytes: 102,992; summed decode: 1.8 ms. Final
frame median/p95: 33.1/34.2 ms; phone-width layout: 33.4/34.2 ms. Current accounted memory:
1,786,880 bytes (1.70 MiB); maximum accounted live-plus-one-replacement/packet: 1,804,304 bytes.
Those figures exclude process/GC overhead. The 1,024-point tier takes 1.3/1.5 ms per final frame and
1,249,280 current bytes; 16,384 points take 55.6/59.1 ms and 2,416,640 bytes. Peak resident point
counts obey each cap. Local worker transfer is **not HTTP streaming**; no bandwidth, real SOG/SPZ
decoding, or production compression claim follows. Visible patch/opacity transitions and palette
banding require better parents and blending before a real viewer.

**Checks performed.** The standalone Playwright harness checks both layouts, no horizontal overflow,
no page exceptions or external requests, analytic normal accuracy, changed light pixels, all 16 LOD
patches, correct far-to-near depth order, malformed-header rejection, exact coarse/full point
counts, budget adherence, and stop/restart cancellation. Screenshots were opened for visual
inspection. Raw JSON, screenshots, source hashes, and harness are on
`codex/frontier-research-clips`. The probes intentionally need no neural model, so no weight was
fetched at runtime. Full pretrained pipelines and mobile hardware remain unmeasured; the plans gate
them explicitly.

**Repository verification.** Merged `origin/main` (`ceb51de7a`);
`SPLASHERY_CHROMIUM=/usr/bin/chromium node tools/preflight.mjs` passed all 270 tests, formatting,
American English, site consistency, shared lists, and size checks. The full suite beyond preflight
was not run. Rule check: none.

## Additional opened papers

2026 work: [triangle splatting](https://arxiv.org/abs/2505.19175),
[Universal Beta Splatting](https://arxiv.org/abs/2510.03312),
[MoGe-3](https://arxiv.org/abs/2607.17967), [Inpaint360GS](https://arxiv.org/abs/2511.06457),
[Mobile-GS](https://arxiv.org/abs/2603.11531), and [Flux-GS](https://arxiv.org/abs/2606.30017).
Preprint and conference years can differ. Other primary method, license, and model sources are
linked directly in the table.
