# Photo to 3D failure atlas — compact review package

Made by Ryan with Codex (GPT-6), October 15, 2026. This media branch is never merged. The tool,
tests, and report belong to draft PR #658 on `codex/photo-3d-failures`. No reconstruction
improvement is claimed.

Download this folder and open `index.html`. It is a self-contained page with local image links, both
captured profiles, failure filters, search, scores, support counts, component edge diagnostics, and
source credits. GitHub displays HTML source rather than running the gallery. If a managed browser
blocks local files, serve this folder on loopback:

```sh
python3 -m http.server 4187 --bind 127.0.0.1 --directory review/photo-3d-failures
```

Open `http://127.0.0.1:4187/`. The page has no external scripts, fonts, analytics, or uploads.
Source and license pages open only when clicked. Private runs use the separate tool's `--in` mode;
those photos are never part of this public package.

## What is preserved

- All **118 original source photos**, with unchanged hashes and their source licenses.
- All **236 profiles and 2,124 color views**, presented as WebP at most 390×844, plus 472 cropped
  front/worst previews, 236 depth previews, and 118 source thumbnails. Color quality is 84, with
  WebP method 5. Resized depth previews use lossless WebP encoding.
- **615 exact capture JSON files**, gzip-compressed without changing their decompressed bytes: the
  original atlas, 118 input records, source anchors, depth diagnostics, and model responses.
- Individual live-license snapshots, hashes, calibration logs, rejected-pilot notes, original
  validation, low-score control reviews, and the limited repeatability proof.

The original 8,496 native color/mask/UV/reveal PNGs and 2,124 projected-boundary debug files are
retained locally and omitted from this compact branch. The original validation checked all 10,620
native artifacts before packaging; it does not say those artifacts remain hosted here. Reproduce
them at the pinned capture commit when native edge inspection or new scoring is needed.

**Do not rescore the resized WebP images.** All badges were computed from native lossless captures.
Lossy downsampling can conceal fine fringes. `atlas.json.gz` is the exact original capture ledger;
its historical PNG paths and hashes identify local native evidence. `atlas.json` adds published
review links while preserving every numerical profile. Original per-pose paths remain historical;
`reviewFiles.poses` maps angles to the published WebP views.

Text logs remove terminal controls and trailing blanks where needed; corresponding `.raw.log.gz`
files preserve the exact originals. Raw records and diagnostics are downloadable `.json.gz` files.
For example:

```sh
gzip -dc records/dot-arch.json.gz > /tmp/dot-arch.json
```

## Interpretation and validation limits

Review flags are not failure rates. Several appearance filters flag 92–100% of eligible inputs. The
default priority is the largest value-to-review-level ratio across unlike quality metrics; the
combined RGB edge metric drives 64/118 phone rows. The report's ten-pattern order is a repair
judgment. Out-of-palette excess, displacement p95, and width excess are separate diagnostics, not
independently validated pure-bleed measurements.

Calibration uses synthetic fixtures. Three lowest-ranked phone controls were visually reviewed at
both profiles; none is certified clean across both. One exact-source repeat reproduced all 54
decoded frames and complete per-pose quality records. This does not establish full-corpus score
reliability, false-positive rates, or repeated latency or memory behavior. There are 49 inputs per
profile without supported thin probes; unknowns are not passes. Actual macOS, physical-phone
performance, and frame rate remain untested.

## Source and provenance

Numerical capture uses `216c34dd05ed0482ec43a896590d94d22233e68a`, based on main `ea35f3de`, after
round 4 merged. Method fingerprint:
`da9dd312972fb05de2e4507125d55ad534bf30f3b8af67f3c58edb06c097071c`. Later code-branch merges do not
update this frozen atlas. Captures use the actual pack's Sharp picture, Fine/photo detail, depth
0.5, no ground, and white background. The poses are front, yaw ±20°/±30°, and pitch ±20°/±30°. Phone
is CSS 390×844/DPR 3 with a 585×1266 drawing buffer; desktop is 1440×900/DPR 1.

Linux capture uses Debian 13, Node.js 24.19.0, Chromium 151.0.7922.173, Mesa llvmpipe, and a
four-core CPU quota. Each input/profile has one fresh-browser timing. Memory is Chromium-tree PSS,
sampled every 200 ms through first 3D and five further frames. App boot, the picker, and Node are
excluded. The OS file cache is not flushed. Mac commands use software-GL flags and process-tree RSS,
so their badges will not match this Linux atlas.

Source photos and derivatives retain the license beside each gallery row. The 30 additional photos
are individually checked CC0 sources; AI-made repository samples remain labeled. Original audit
contributions are CC0; this does not relicense source images. Gallery and helper code are MIT.
Pillow is an existing licensed build-time tool, used only for this public package.

## Reproduce

Use a separate full checkout at capture commit `216c34dd`, with its dependencies and Chromium. The
manifest helper combines that checkout's 88 defaults and this package's 30 additional originals:

```sh
node /path/to/media/verification/reproduce-public.mjs \
  /path/to/captured-code /path/to/media /tmp/p3df-inputs.json
cd /path/to/captured-code
node tools/p3d-failures.mjs \
  --manifest /tmp/p3df-inputs.json --out /path/to/new-native-capture
```

After native capture, use the current code branch's gallery generator and existing Pillow to create
a new compact output. These helpers only read and write local files:

```sh
python3 /path/to/media/verification/slim-gallery.py \
  /path/to/new-native-capture /path/to/media /path/to/new-compact-output
node /path/to/media/verification/render-review.mjs \
  /path/to/current-code /path/to/new-native-capture /path/to/new-compact-output
```

See the code PR's report for exact private Mac commands, all 30 photo credits, ten repair targets,
and the re-baselined round 5 proposal.
