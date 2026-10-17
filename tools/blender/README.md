# Headless Blender cloud tools

Build tools only; no Blender binary, model download, or dataset is served with Splashery.

## Installation

```sh
bash tools/codex-setup.sh --blender
# Existing Chromium:
SPLASHERY_CHROMIUM=/usr/bin/chromium bash tools/codex-setup.sh --skip-browser --blender
# Just the renderer dependency:
python3 tools/blender/install.py --report .cache/blender-install.json
```

Browser-only setup remains `bash tools/codex-setup.sh`: 3,000 MB free, with no Blender download,
platform check, or Python 3.12 requirement. `--blender` requires at least 5 GB free, Linux x86-64,
and host Python 3.12 or newer for safe tar extraction. Blender 4.5.3 LTS is pinned by SHA-256,
installed outside the repository in `~/.cache/splashery-blender/`, and checked with a headless
Python/NumPy launch. The installer supports `--cache <outside-repo-path>` for a separate cache. The
normal launcher uses the default cache.

The Berkeley mirror is tried first, with
[download.blender.org](https://download.blender.org/release/Blender4.5/blender-4.5.3-linux-x64.tar.xz)
as a download fallback. Both must match the same
[official checksum](https://download.blender.org/release/Blender4.5/blender-4.5.3.sha256):
`975c58fcb244273838534bba771e64ad87739216b0f9b39a888531a49a72d845`. A checksum failure stops
installation. Reuse verifies the archive and the entire installed file inventory. Corrupt files or
an unverified installation fail rather than falling back to a system Blender. Remove the corrupt
archive or install directory and retry; do not edit its receipt.

## Calibrated model and truth-scene datasets

```sh
node tools/blender-views.mjs --model rubber-duck-real \
  --out .cache/duck-a --timings .cache/duck-a-times.json
node tools/blender-views.mjs --model garden-gnome --out .cache/gnome-a
node tools/blender-views.mjs --model wooden-elephant --out .cache/elephant-a
node tools/blender-views.mjs --scene still-life --out .cache/scene-a
# Existing self-contained CC0 GLB and its provenance record:
node tools/blender-views.mjs --model assets/toys/model-splats/burger.glb \
  --asset-record tools/blender/burger.json --out .cache/burger-a
```

The Node wrapper calls `tools/blender/render.py` through the verified headless launcher. Defaults:
24 orbit views at 512×512, 16 CPU Cycles samples, seed 105, four threads, and one 1024×512 spherical
panorama from the first orbit camera. Options: `--views`, `--width`, `--height`, `--samples`,
`--panorama-width`, `--cache` (model downloads), and `--timings`. Output must be new or empty;
operational timings must be outside the dataset. The orbit fits the geometry's bounding sphere.
Model geometry stays in its original imported coordinates. The tool supplies fixed studio lighting
for models and scenes; use the original truth generator for the truth scenes' original lighting and
camera paths.

Poly Haven IDs come from `tools/models.json`. Three inputs are already pinned in
`tools/blender/models-lock.json`: Rubber Duck Toy by Plat251, Garden Gnome by Bhargav Kubal, and
Carved Wooden Elephant by Greg Zaal. Their live source pages and
[Poly Haven's CC0 license](https://polyhaven.com/license) were checked October 17, 2026. Nothing is
added to the shipped assets. Each original 1k glTF, buffer, and texture is checked against a
committed SHA-256 on every use, then embedded losslessly with the pinned npm `NodeIO` dependency.
Material extensions are retained; unsupported extensions fail instead of being silently dropped. The
final GLB's SHA-256, dependency hashes, URLs, author, license, and changes are in the dataset.
Cached corrupt bytes are rejected. Rendering does not query the mutable API or refresh pins.

To explicitly add/update another CC0 Poly Haven model from the shared list:

```sh
node tools/blender-views.mjs --pin-model croissant-real
```

This checks the live page/license, downloads the API's 1k glTF and dependencies, checks the API's
sizes and MD5 values, and writes SHA-256 pins. Review and commit the changed lock before generating
a dataset. Models marked for logo removal are rejected; the wrapper does not bypass those edits.
External dependencies must be local paths listed in the pin. The local GLB route rejects external
URIs and requires `source`, `author`, `license` (`CC0-1.0`), `checked`, `sha256`, and `changes`.
Verify the live license before making a local record; the tool checks that record and the input
bytes.

Every view and panorama writes:

- `.png`: Standard color transform, 8-bit RGBA beauty. Text/time metadata is stripped without
  changing compressed pixels or color profiles.
- `.depth.f32.gz`: headerless, little-endian float32, top row first. Perspective depth is
  optical-axis Z in meters; panorama depth is radial meters. NaN means no geometric hit.
- `.normals.f32.gz`: the same float encoding, interleaved XYZ per pixel. Unit geometric triangle
  normals in Blender world coordinates, oriented by triangle winding, without face-forwarding,
  smoothing, or material normal maps. All three components are NaN for no hit.
- `.mask.png`: exact red-channel values: 0 for no hit, 1 for an opaque geometric hit, and 3 for a
  hit with ambiguous appearance (metal, glass, alpha, or emission). This is an object/background
  mask with material ambiguity flags, not individual object IDs.
- `.json`: exact intrinsics (pinhole K), camera-to-world and inverse matrices, dimensions, clipping,
  projection, filenames, and depth/normal conventions.

Depth, normals, and masks trace the evaluated triangle mesh at pixel centers, independently from
beauty shading. World coordinates are right-handed Blender Z-up meters. Camera axes are +X right, +Y
down, and +Z forward. Matrices are row-major, acting on column vectors. Pixel centers are
`(x+0.5,y+0.5)`, with no lens distortion. Normals are in the common world frame for both
projections; rotate by the world-to-camera 3×3 matrix to express them in camera coordinates.

Panoramas cover a full sphere: longitude −π to +π from left to right, latitude +π/2 to −π/2 from top
to bottom. At longitude/latitude zero, the ray points camera forward. Its camera-space direction is
`(sin(lon) cos(lat), -sin(lat), cos(lon) cos(lat))`. Panoramas have no pinhole K. They use one
camera center, rather than a moving turntable. Glass, alpha, reflection, emission, and silhouettes
can disagree with first-surface geometry; beauty samples pixel areas, while truth uses centers.

`manifest.json` records provenance, source hashes, settings, poses, and contracts. `checksums.json`
hashes every other file. The 24-view plus panorama default has 127 files, with no timestamps,
absolute machine paths, or timings. Gzip timestamps are zero. Run again into another empty directory
and compare every file. Identity is scoped to the same pinned Blender build, input, source,
settings, CPU architecture, and libraries; cross-platform beauty identity is unproven.

## Original truth scenes and benchmarks

```sh
bash tools/blender-cloud.sh --python tools/studio-truth-generate.py -- \
  --mode still --still-side 512 --out .cache/truth-512
bash tools/blender-cloud.sh --python tools/blender/benchmark.py -- --out .cache/truth-benchmark
```

The original generator retains its default 1280×720 stills and 120/300-frame clips. `--still-side`
changes only the still long edge, retaining 16:9. The benchmark runs its actual build, pose, render,
and geometric-depth functions on all 12 scenes at 512×288 and 1024×576, eight CPU samples, and
records build, beauty, truth, and total seconds per frame separately. Use `--limit` only for labeled
incomplete clip smoke builds.

Blender 4.5.3 reads the compressed source scenes in `tools/blender/truth-scenes/`, verifying each
against `truth-scenes.json`. Saving fixed scene inputs was necessary to stabilize actual Cycles
sampling across fresh processes. All original recipes remain in `build_procedural`.
`tools/blender/canonicalize-truth.py` explicitly rebuilds those sources; ordinary rendering never
rewrites them. Historical fixtures remain unchanged.

## Verification

```sh
python3 tools/blender/tests/setup.py
python3 tools/blender/tests/blender-cloud-install.py
python3 tools/blender/tests/blender-cloud-metadata.py
node --test tools/blender/tests/wrapper.test.mjs
bash tools/blender-cloud.sh --python tools/blender/tests/blender-cloud-render.py
python3 tools/blender/tests/blender-cloud-repeat.py
bash tools/blender-cloud.sh --python tests/studio-truth-blender.py
bash tools/blender-cloud.sh --python tools/blender/probe.py -- --backend CUDA --out .cache/cuda.json
```

The geometry tests check independent plane depth/normals and a six-color box's actual panorama axes,
radial depth, and normals. Repeat tests compare fresh-process artifacts. Installer and model checks
reject changed bytes. The setup test uses an old Python stub and an unavailable installer to prove
browser-only work stays independent. Backend probes accept CPU, CUDA, OPTIX, HIP, ONEAPI, METAL, and
EEVEE, explicitly disabling CPU fallback for GPU requests. Eevee can use Mesa llvmpipe; that is
software rendering, not a GPU measurement.

Measured results, evidence links, and limits:
[cloud audit](../../docs/audits/blender-cloud-2026-10.md).
