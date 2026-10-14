# Studio ground truth

Original procedural scenes, made by Ryan with Codex (GPT-6), dedicated to CC0-1.0. Source code is
MIT. These are rendered fixtures, not real captures. No outside models, textures, people, logos, or
readable text are used.

Generate with the native Linux Blender 4.3.2 build:

```sh
blender -b --factory-startup --threads 4 --python-exit-code 1 \
  --python tools/studio-truth-generate.py -- \
  --out .cache/studio-truth/full --mode all
```

`--mode still` makes the 12 stills; `--mode clips` makes the sequences. The default still is
1280×720. Each 640×360 sequence is 30 fps: handheld has 120 frames (4 seconds), and walk has 300
frames (10 seconds). Depth and masks accompany every handheld frame; both sequences carry every
camera pose. Walk frames are retained for held-out scoring. `--limit` is a smoke build and marks the
manifest as incomplete; it must never be presented as the full set. CPU Cycles uses eight samples
per still and two per video frame, without denoising, motion blur, depth of field, or animated noise
seeds. This is a small geometric stress set; it does not establish photographic realism.

The seed, sample counts, Blender version, and generator hash are in `manifest.json`;
`checksums.json` records each output's SHA-256 and size. Restarting the same command resumes
existing files. Use an empty output folder when changing the generator or settings; reusing old
renders with new metadata would invalidate the dataset. Identical builds should preserve geometry,
calibration, and depth; beauty JPEG bit identity across Blender versions or CPU architectures is not
promised.

## Camera and depth contract

World coordinates are right-handed Blender coordinates, with Z up and meters as the length unit.
Camera coordinates are right-handed, with X right, Y down, and Z forward. `camera_to_world` and
`world_to_camera` are 4×4 row-major matrices acting on column vectors. Their product is identity. K
is the 3×3 pinhole intrinsic matrix. Pixels use boundary coordinates: pixel (x, y) has center (x +
0.5, y + 0.5). There is no lens distortion. The camera has a 40 mm lens, a 36 mm horizontal sensor,
square pixels, and clipping at 0.05–200 meters.

Depth is the first geometric hit at the pixel center, measured along the camera's optical axis (+Z),
in meters. It is not normalized inverse depth, Euclidean ray length, or Blender's antialiased Z
pass. The generator traces the evaluated triangle mesh with Blender's BVH separately from the beauty
render. Depth is stored as gzip-compressed IEEE-754 float32 little endian, row-major, top row first,
with no header. Dimensions come from the pose. No geometric hit is NaN, including sky. Float32
rounding is the storage limit.

PNG mask values are exact integers in the red channel: 0 = no hit, 1 = valid opaque diffuse
geometry, and 3 = valid geometry with ambiguous appearance. Bit 0 means geometry exists; bit 1 flags
transmission, metallic reflection, or emission. Geometry metrics can use either valid hit category;
the scorer's appearance and calibrated depth comparisons use mask == 1. The mask does not claim to
describe every indirect reflection or shadow. Glass first-hit depth describes its front surface, not
the objects seen through it. A reflected object has no universal appearance depth. At silhouettes,
beauty sampling covers an area while depth samples its center.

## Storage policy

Only the still set, calibration, contact sheet, and asset records belong in this folder. Full
videos, per-frame truth, raw frames, and archives live in the ignored `.cache/studio-truth/` folder.
Keep the aggregate Git addition below 40 MB. Full-archive location and measured coverage are
recorded in `docs/audits/studio-truth-2026-10.md`. No fixture is referenced by `src/`.

Run numeric checks sequentially:

```sh
python3 tests/studio-truth-camera.py
node --test --test-concurrency=1 tests/studio-truth*.test.mjs
python3 tests/studio-truth-validation.py
```

The browser scorer launches sandboxed Chromium with one page at a time and no unsafe graphics flags.
See `node tools/studio-truth.mjs --help`.

`--depth-only` calls the actual product inference entry points in a minimal browser harness and
explicitly omits render evidence. Real-app mode supplies Photo flat front-view diagnostics. Moving
depth is scored only when its decoded frame timestamp is observed through
`requestVideoFrameCallback`; unregistered frames have null metrics. Moving color metrics are
withheld because its separate renderer video copy seeks asynchronously and does not expose the
uploaded decoded frame timestamp.

After full generation finishes, prepare held-out truth and a separate training-only video:

```sh
blender -b --factory-startup --threads 4 --python-exit-code 1 \
  --python tools/studio-truth-novel-truth.py -- --input .cache/studio-truth/full \
  --camera-helper-sha256 c6484004609f177b1d2ac077b60d5470b143f32b85c956db8dfbaef65f1b215b
python3 tools/studio-truth-assets.py --input .cache/studio-truth/full --full --archive
```

Every eighth walk frame, excluding frame zero, supplies 37 evaluation-only views with exact depth
and masks. `train.mp4` is encoded only from the other 262 raw JPEG frames; `train-frames.json` maps
its new clock to the original walk clock. No held-out RGB frame enters that encoder. Photo uses only
its still, and Moving uses its separate handheld clip. `--novel` renders Photo from these held-out
cameras, using the source median-depth plane to calibrate the toy's stylized relief scale. This is a
declared camera calibration assumption, not metric reconstruction or pixel fitting to the held-out
images. Moving held-out scores remain null until both color and depth source poses can be
registered. Video training/rendering remains null without WebGPU; its solved-camera adapter is not
complete. None of these measurements establishes phone performance.

The explicit helper digest is required for legacy manifests that did not record it at startup. New
builds also check the helper identity in their resume settings. For a fixed historical baseline,
pass `--baseline 58f3d8ede13714bf4b3d1f99fbf3b29d7f60e492`; the scorer rejects product source that
differs from the requested commit, even when `main` has moved.

Retrieve the full archive with `node tools/studio-truth-fetch.mjs`. An unpublished draft archive
requires repository collaborator access. The tool verifies SHA-256, rejects links and unsafe archive
paths, extracts into a new folder, and validates every sequence. It never publishes an archive. The
report records when the archive is actually available. The current draft release has no assets: the
upload endpoint rejected the cloud credential. Local generation and local archive verification
remain available; the default remote download cannot succeed until assets are uploaded.
