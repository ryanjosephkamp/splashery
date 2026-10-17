# Blender in Codex cloud

October 17, 2026. Built by Codex (GPT-6).

Blender 4.5.3 LTS installs headlessly from a pinned, SHA-256-checked archive. The opt-in setup and
`tools/blender-views.mjs` produce calibrated CC0 model or truth-scene views, depth, geometric
normals, object/background masks, and full spherical panoramas. All 381 files from three complete
24-view plus panorama builds matched byte for byte in fresh-process repeats. Interrupted command
sessions were rerun; their partial outputs are excluded from the measurements.

Correction: `docs/codex/105-blender-cloud.md` exists on main and at the original base `ceb51de7`.
The earlier report and PR body incorrectly called it absent. This revision follows that task file.
No toy, runtime source, vendor file, shipped model, or historical truth fixture changed. The PR
branch remains `codex/blender-cloud-public`; main was merged, without rebasing. The only generated
site changes are the license page and service-worker version required by
`node tools/site-build.mjs`.

## Install and browser-only setup

`bash tools/codex-setup.sh` retains the original browser setup and 3,000 MB disk default. It never
invokes the Blender installer. `--blender` explicitly requests Blender and at least 5 GB free; only
that step requires Linux x86-64 and host Python 3.12 or newer. Blender unpacks outside the
repository in `~/.cache/splashery-blender/`. Both real setup modes passed using the existing
Chromium; browser installation and system packages were not downloaded again.

| Measurement                                          |            Result |
| ---------------------------------------------------- | ----------------: |
| Cold download, hash, extract, headless Python launch |   52.0101 seconds |
| Cached archive/tree verification and Python launch   |    2.5085 seconds |
| Archive                                              | 377,397,328 bytes |
| Installed logical file bytes                         |     1,604,968,564 |
| Allocated install bytes, counting hard links once    |     1,181,835,264 |
| Browser-only setup, including first npm install      |        11 seconds |
| Existing-browser setup with cached `--blender`       |         5 seconds |

Archive SHA-256: `975c58fcb244273838534bba771e64ad87739216b0f9b39a888531a49a72d845`. Executable
SHA-256: `5e15447670804c855fef6033ac9b8fd82696b762095becf0df79b1c2f8034397`. Build hash:
`67807e1800cc`. The pin matches the
[official checksum](https://download.blender.org/release/Blender4.5/blender-4.5.3.sha256), opened
October 17, 2026. The Berkeley download mirror worked; the official host is now reachable too and is
the fallback URL. A bad hash stops installation; no signature verification is claimed.

The archive and entire installed tree are rechecked on reuse. Safe extraction, file locking,
headless Python/NumPy startup, disabled auto-run/user startup, and disabled bytecode writes prevent
unverified reuse. The installer never silently substitutes the system Blender. Corrupt archives,
changed installed files, and unexpected installed files are rejected.

## Six datasets and byte identity

The inputs are three CC0 models already recorded in `tools/models.json`:
[Rubber Duck Toy](https://polyhaven.com/a/rubber_duck_toy), by Plat251;
[Garden Gnome](https://polyhaven.com/a/garden_gnome), by Bhargav Kubal; and
[Carved Wooden Elephant](https://polyhaven.com/a/carved_wooden_elephant), by Greg Zaal. Their live
pages and [Poly Haven's CC0 license](https://polyhaven.com/license) were opened on October 17, 2026.
The 1k glTF, buffers, and textures are individually SHA-256-pinned in
`tools/blender/models-lock.json`. NodeIO embeds them losslessly in a GLB; its hash and all
dependency hashes appear in each manifest. Rendering never refreshes pins or consults the mutable
API. Additional CC0 Poly Haven entries use an explicit `--pin-model` step. Models needing logo
removal are rejected. The existing self-contained CC0 GLB route remains available.

Each object has 24 orbit views at 512×512, 16 CPU Cycles samples, seed 105, and four threads. Each
panorama is 1024×512 at the first orbit camera center. These are rendered models, not real captures.
Raw datasets stay in ignored `.cache/blender-review/`; only compact evidence is on
`codex/blender-cloud-clips`, outside this PR.

[All 72 views](https://github.com/ryanjosephkamp/splashery/blob/codex/blender-cloud-clips/docs/audits/blender-cloud-2026-10/model-contact.jpg)
·
[Three panoramas](https://github.com/ryanjosephkamp/splashery/blob/codex/blender-cloud-clips/docs/audits/blender-cloud-2026-10/panorama-contact.jpg)
·
[Measurements and every file hash](https://github.com/ryanjosephkamp/splashery/blob/codex/blender-cloud-clips/docs/audits/blender-cloud-2026-10/measurements.json)

Times below sum beauty rendering/saving and geometric depth/normal/mask/pose generation, excluding
installer/startup, import/BVH construction, and final manifest hashing. The evidence records both
whole-process wall time and each operation. Object rows contain 120 files; panorama rows contain
five. Each combined build also has a manifest and checksums file (127 files total).

| Dataset                   |     Bytes |   Seconds A / B | SHA-256 of sorted file-hash map                                    |
| ------------------------- | --------: | --------------: | ------------------------------------------------------------------ |
| rubber-duck-real views    | 9,692,310 | 72.167 / 80.189 | `77ba7ca2cd4808cf726ec2092964f5876bf3a5587647e9890f8e8212f5218496` |
| rubber-duck-real panorama |   304,578 |   3.181 / 3.798 | `0e32f1d5500a55bcbb073ad534b4ad3e314a88ff861add312cff8835266b09e5` |
| garden-gnome views        | 9,684,336 | 78.236 / 90.002 | `c72c4f8148e36f6ab94e636693e178dbb3397628650134adf2057994e221abdb` |
| garden-gnome panorama     |   317,653 |   3.551 / 4.122 | `8328085fa5b8ce3ada2582d9dbfe7df5502a0045e996963057706e7539dbb516` |
| wooden-elephant views     | 8,618,341 | 89.505 / 31.921 | `91ff1d582a3b0087a190791c746ce0207d6a903da718f1d663fe636521b9db41` |
| wooden-elephant panorama  |   310,388 |   5.270 / 1.638 | `7f0ae08f1548341a7404bc32c055ab744a8b7ace89720e8befe6ef2df3b97fd3` |

Mean complete seconds per orbit view (A / B): rubber-duck-real 3.007 / 3.341, garden-gnome 3.260 /
3.750, wooden-elephant 3.729 / 1.330.

The group digest hashes UTF-8 compact JSON with sorted keys and one trailing newline, mapping each
filename to `bytes` and `sha256` (Python `json.dumps(..., sort_keys=True, separators=(',', ':'))`).
Every artifact was read and compared directly, then rehashed against `checksums.json`; matching
checksum files alone were not treated as proof. Combined-build checksums-file hashes:

- garden-gnome: 10,068,845 bytes;
  `ad40eec6c9a832954e97ea21b4860713b2602d4ea4216073021483025ccd8f97`.
- rubber-duck-real: 10,063,868 bytes;
  `87860b22d24b9018f5a4ffd21c9a82fc8c77d0117bf9eab48ca468e8e6638612`.
- wooden-elephant: 8,995,793 bytes;
  `7e4d33ec9d997d1c4644c17513faf95d2d492171944dc30205b2aae7d1af0749`.

Normal payload length, unit length at hits, NaN at misses, depth/mask agreement, and matrix inverses
were checked for all 75 views. The truth-scene route also matched in two fresh-process smoke builds.

## Truth scenes and seconds per frame

All 12 original truth scenes were rendered at both 512×288 and 1024×576 (16:9 long edges), with CPU
Cycles at eight samples. `tools/blender/benchmark.py` calls the original generator's actual build,
pose, render, and geometric-depth functions, timing them separately. `--still-side` also makes those
sizes available from `tools/studio-truth-generate.py` itself. Benchmark geometry time covers the
original depth/masks; the six-dataset timings also include normals.

| Backend                    | Pixels   | Frames | Mean beauty seconds | Mean geometry seconds | Mean total seconds/frame |
| -------------------------- | -------- | -----: | ------------------: | --------------------: | -----------------------: |
| CPU Cycles, 8 samples      | 512×288  |     12 |               1.024 |                 0.640 |                    1.714 |
| CPU Cycles, 8 samples      | 1024×576 |     12 |               2.967 |                 2.332 |                    5.344 |
| Software Eevee, 64 samples | 512×288  |     12 |              10.061 |                 0.574 |                   10.677 |
| Software Eevee, 64 samples | 1024×576 |     12 |              21.592 |                 2.263 |                   23.901 |

Total time includes loading the source scene and BVH construction. Timings are elapsed cloud
measurements, not isolated hardware promises; some checks overlapped the CPU work. The completed
Eevee pass ran separately, with its shader cache already populated by earlier probes. The machine
exposes five AMD EPYC 9V74 x86-64 vCPUs, Debian 13, glibc 2.41, and no GPU device. The report uses
four rendering threads. Eevee uses a different sample count, so these are not equal-quality speed
comparisons. Per-scene times are in the linked measurements.

The 12 original CC0 truth recipes remain intact. Blender 4.5.3 loads their hash-checked, compressed
source scenes (1,785,089 bytes) because rebuilding procedural scenes exposed actual Cycles sampling
variation across fresh processes. `build_procedural` and the explicit canonicalizer retain the
recipes. PNG/JPEG time/text metadata is removed without re-encoding pixels; gzip timestamps are
zero. Source hashes and versioned inputs prevent stale resume reuse.

The earlier complete 12-scene 1280×720 still repeat compared all 51 files (19,934,153 bytes). Its
[truth contact sheet](https://github.com/ryanjosephkamp/splashery/blob/codex/blender-cloud-clips/docs/audits/blender-cloud-2026-10/truth-contact.jpg),
[burger smoke sheet](https://github.com/ryanjosephkamp/splashery/blob/codex/blender-cloud-clips/docs/audits/blender-cloud-2026-10/burger-contact.jpg),
and
[original measurements](https://github.com/ryanjosephkamp/splashery/blob/codex/blender-cloud-clips/docs/audits/blender-cloud-2026-10/prior-measurements.json)
are retained on the evidence branch as historical results. Those hashes describe the earlier source
revision; the six datasets above describe this revision.

## Calibration and limitations

World coordinates are Blender Z-up meters. Camera coordinates are +X right, +Y down, and +Z forward;
row-major matrices act on column vectors. Pixel centers are `(x+0.5,y+0.5)`, without lens
distortion. Perspective K uses the horizontal sensor and square pixels. Perspective depth is
optical-axis Z; panorama depth is radial meters. Both trace the evaluated mesh with near/far clips.

Normals are unit geometric triangle normals in the common world frame, oriented by winding, without
smoothing, material normal maps, or face-forwarding. Depth is gzip little-endian float32, top row
first; normals use interleaved XYZ in the same encoding. No hit is NaN. Mask red values are 0 for
background, 1 for opaque geometry, and 3 for appearance-ambiguous geometry. Masks distinguish
object/background and ambiguity, rather than individual scene object IDs. Glass, alpha, metal,
emission, and silhouettes can disagree with first-surface truth and pixel-center sampling.

A panorama is a full sphere from one camera center, longitude −π to +π left to right, latitude +π/2
to −π/2 top to bottom. It has no pinhole K. Independent plane and six-color box tests check
axial/radial depth, actual rendered cardinal directions, world normals, and missing pixels.

Identity is established on this cloud CPU with the same pinned build, inputs, source, settings, and
libraries. Cross-architecture or cross-version beauty identity is not established. Full
120/300-frame truth clips were not regenerated; labeled smoke builds exercise both encoders. HDR
output and physical GPU acceleration measurements were cut.

## Without a GPU

GPU probes enable only the requested backend and explicitly disable CPU fallback. CUDA, OptiX, HIP,
and oneAPI return nonzero because no device is available. Metal is unsupported in this Linux build.
The CPU 64×64, two-sample probe rendered in 0.075 seconds. The 64×64, 64-sample Eevee probe rendered
in 26.091 seconds through Mesa llvmpipe (LLVM 19.1.7, 256 bits), Mesa 25.0.7, OpenGL 4.5; it must
not be reported as GPU acceleration. The measurements link records actual probe JSON, error text,
renderer/version strings, and elapsed times. The retained first-pass probes recorded EGL diagnostics
before successful software rendering. Eevee's startup/shader cost and 64 samples differ from the CPU
dataset pipeline.

## Reproduction and checks

```sh
SPLASHERY_CHROMIUM=/usr/bin/chromium bash tools/codex-setup.sh --skip-browser --blender
node tools/blender-views.mjs --model rubber-duck-real --out .cache/duck-a --timings .cache/duck-a-times.json
node tools/blender-views.mjs --model rubber-duck-real --out .cache/duck-b --timings .cache/duck-b-times.json
# Repeat both commands for garden-gnome and wooden-elephant.
bash tools/blender-cloud.sh --python tools/blender/benchmark.py -- --out .cache/benchmark
bash tools/blender-cloud.sh --python tools/blender/benchmark.py -- --backend EEVEE --out .cache/eevee
node tools/preflight.mjs --quick
```

The [tool guide](../../tools/blender/README.md) lists all tests and camera/file conventions. 51
installer, setup, metadata, wrapper, geometry, fresh-process repeat, and existing truth checks
passed. An existing resume test copies the new metadata helper into its temporary source tree; its
assertions remain unchanged. New checks live under `tools/blender/tests/`. The unrelated superpowers
plan was removed, original SETUP.md steps restored, and CREDITS.md kept from main.

Full preflight passed after merging main: all 271 browser tests (7.5 minutes), plus formatting,
American English, generated-site checks, shared-list parsing, and file sizes. The full command
finished in 529.52 seconds. Generated test screenshots were restored.

Rule check: the one-line existing test fixture update and regenerated license page/service worker
extend the task file's strict paths; they are required to keep the existing checks and generated
site current. No runtime behavior or historical fixture changed.
