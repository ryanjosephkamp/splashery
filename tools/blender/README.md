# Headless Blender in Codex cloud

Build tools only; nothing here is served to visitors. Blender 4.5.3 LTS, CPU Cycles, four render
threads. Installer: Linux x86-64 and Python 3.12 or newer. The renderer runs in Blender's bundled
Python, with its bundled NumPy. No `bpy` wheel, display server, root access, or GPU is needed for
Cycles. The current cloud image already supplies the shared system libraries Blender needs; the
installer launches Blender's headless Python and fails if dependencies are missing.

## Install and run

Normal cloud setup (`bash tools/codex-setup.sh`) includes Blender. Browser-only tasks may pass
`--skip-blender`. Allow 5 GB free for npm packages, Chromium, Blender, and temporary extraction;
render datasets need additional space. To install Blender alone:

```sh
python3 tools/blender/install.py --report .cache/blender-install.json
bash tools/blender-cloud.sh --python tests/blender-cloud-render.py
```

The installer pins the archive and SHA-256 in `install.py`. It downloads over verified HTTPS, checks
the complete archive before extracting, rejects unsafe tar paths, and records every installed file's
hash. Every invocation rechecks the archive and the complete installed file inventory. It serializes
installation with a file lock. It never uses a system Blender or substitutes another version. An
intact cached installation works without a network connection.

The official download host returned HTTP 403 in this cloud run. The pin was checked against matching
checksum files on
[Berkeley's mirror](https://mirrors.ocf.berkeley.edu/blender/release/Blender4.5/blender-4.5.3.sha256),
[RWTH Aachen's mirror](https://ftp.halifax.rwth-aachen.de/blender/release/Blender4.5/blender-4.5.3.sha256),
and
[dotsrc's mirror](https://mirrors.dotsrc.org/blender/blender-release/Blender4.5/blender-4.5.3.sha256).
This verifies consistency across mirrors; it is not a signature verification.

Archive: `blender-4.5.3-linux-x64.tar.xz` (377,397,328 bytes). SHA-256:
`975c58fcb244273838534bba771e64ad87739216b0f9b39a888531a49a72d845`.

If a cached archive fails verification, remove that archive and retry. If the installed tree fails
verification, remove `.cache/blender-cloud/blender-4.5.3-linux-x64/` and retry; the verified archive
will be extracted again. Do not edit the receipt to accept changed files. The launcher disables
Blender auto-run scripts, user startup settings, and Python bytecode writes inside Blender itself.
Use the launcher for rendering; direct Python tests can otherwise create bytecode in the verified
tree and correctly cause the next integrity check to fail.

## Existing truth scenes

```sh
bash tools/blender-cloud.sh --python tools/studio-truth-generate.py -- \
  --out .cache/blender-truth/stills --mode still
```

This renders all 12 original 1280×720 stills, exact depth, masks, and poses. JPEG timing/date
comments are removed without recompressing pixels. The existing generator also supports `--mode all`
for full clips; that is a much larger dataset. See
[the truth contract](../../tests/fixtures/truth/README.md). Blender 4.5.3 loads all 12 original
scenes from hash-checked compressed sources in `tools/blender/truth-scenes/`. Their provenance,
camera targets, seeds, and hashes are in `tools/blender/truth-scenes.json`. Rebuilding the night and
forest scenes produced different beauty sampling despite identical exposed settings. Fixed
serialized inputs stabilize sampling. The procedural recipes remain in `build_procedural`; other
Blender versions retain that path without byte-identity guarantees. These 1,785,089 bytes of source
assets are never loaded by visitors. Historical fixtures remain unchanged; use a new output
directory.

To intentionally rebuild the canonical inputs after changing a recipe, run
`bash tools/blender-cloud.sh --python tools/blender/canonicalize-truth.py`, then
`npx prettier --write tools/blender/truth-scenes.json`. This updates versioned input assets and
their hash record; it is not part of normal rendering. Review the source diff and repeat the dataset
checks. Format the source record before rendering: its byte hash is part of dataset provenance.

## CC0 model views and 360-degree panoramas

```sh
bash tools/blender-cloud.sh --python tools/blender/render.py -- \
  --model assets/toys/model-splats/burger.glb \
  --asset-record tools/blender/burger.json \
  --out .cache/blender-model/run-a \
  --timings .cache/blender-model/run-a-times.json
```

Defaults: eight 640×480 orbit views, 16 samples, and one 1280×640 equirectangular panorama at the
first orbit camera's position and orientation. The orbit fits the model's bounding sphere. The model
stays in its original Blender import coordinates; the tool adds lighting and camera poses, without
changing model geometry. Options: `--views`, `--width`, `--height`, `--samples`, and
`--panorama-width`. Output must be new or empty. Operational timings must be outside that output.

Input is a self-contained GLB 2.0 with embedded buffers and textures. External file/HTTP texture
URIs are rejected so the model hash covers its dependencies. A required JSON asset record supplies
`source`, `author`, `license` (exactly `CC0-1.0`), `checked`, `sha256`, and `changes`. Check the
live source's license before making the record; the tool validates the record and bytes, not the
legal claim. The checked-in example uses the existing
[Kenney Food Kit](https://kenney.nl/assets/food-kit) model, whose live page explicitly says CC0. No
model download is needed.

Each view and panorama has:

- `.png`: Standard color transform, 8-bit RGBA beauty render. Textual/time metadata is removed;
  compressed pixel data and color information are preserved.
- `.depth.f32.gz`: headerless, row-major, top row first, little-endian float32; NaN for no hit. Gzip
  timestamp is zero. Depth traces the evaluated triangle mesh at pixel centers, separately from the
  beauty render. Perspective depth is optical-axis Z in meters; panorama depth is radial distance in
  meters. Clipping follows the corresponding depth convention.
- `.mask.png`: exact values in the red channel: 0 means no hit, 1 means opaque hit, and 3 means a
  hit whose material has ambiguous appearance (metal, transmission, alpha, or emission).
- `.json`: projection, dimensions, clipping, file names, and camera matrices. Perspective views
  include K. World coordinates are Blender's right-handed Z-up meters; camera coordinates are +X
  right, +Y down, and +Z forward. Matrices are row-major and act on column vectors. Pixel centers
  are `(x+0.5,y+0.5)`, with no lens distortion.

Panorama longitude increases from −π at the left boundary to +π at the right; latitude decreases
from +π/2 at the top to −π/2 at the bottom. At longitude zero, latitude zero, a ray points camera
forward. In camera coordinates its direction is `(sin(lon) cos(lat), -sin(lat), cos(lon) cos(lat))`.
A panorama has no pinhole K. It captures a full sphere from one camera center; it is not a moving
camera turntable or a cubemap.

Glass depth is its first geometric surface, not the background seen through it. Alpha holes,
reflection, emission, and silhouettes can disagree with beauty appearance. Masks flag material
ambiguity conservatively; they do not express every indirect lighting effect. The beauty render
samples pixel areas, while geometric truth samples only their centers.

`manifest.json` records input provenance, source hashes, camera contracts, and settings.
`checksums.json` hashes every other artifact. There are no timestamps, machine paths, or timings in
the dataset. Repeat the same command with a second empty directory and compare `checksums.json`.
Byte identity is scoped to the same pinned build, source, input, settings, CPU architecture, and
libraries. Cross-architecture or cross-version beauty identity is not guaranteed. The report lists
what was actually compared.

## Checks and backend failures

```sh
python3 tests/blender-cloud-install.py
python3 tests/blender-cloud-metadata.py
bash tools/blender-cloud.sh --python tests/blender-cloud-render.py
python3 tests/blender-cloud-repeat.py
bash tools/blender-cloud.sh --python tests/studio-truth-blender.py
bash tools/blender-cloud.sh --python tools/blender/probe.py -- \
  --backend CUDA --out .cache/blender-cuda.json
```

The repeat test renders twice in fresh processes and compares every artifact's bytes. Geometry tests
check an independent known plane and a six-color box panorama's actual rendered cardinal axes and
radial depth. Installer checks reject corrupt archive bytes and changed or added files. Backend
probes accept CPU, CUDA, OPTIX, HIP, ONEAPI, METAL, or EEVEE. Unavailable GPU probes exit nonzero
with a JSON error; they explicitly disable CPU fallback.

Measured results and limits: [cloud audit](../../docs/audits/blender-cloud-2026-10.md).
