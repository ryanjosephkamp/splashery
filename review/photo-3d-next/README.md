# Photo to 3D: task 99 review evidence

Codex (GPT-6) built this study. **The Goal is unmet: neither Layered research variant passes the
truth-view and boundary gates.** Classic's code and golden pins are unchanged.

This branch is evidence only. Never merge it into `main`. The code and report belong to
[draft PR #690](https://github.com/ryanjosephkamp/splashery/pull/690) from `codex/photo-3d-next`.

## Blind phone comparison

Open [index.html](index.html) from a local checkout, or have the Operator put this directory on the
review host. It contains 20 pairs: the 10 worst atlas ribbons, 5 boundary cases, and 5 thin-part
cases, with duplicates excluded. The page shows anonymous A and B identities and balanced positions.

Each video contains 72 actual rendered frames at 12 fps: four continuous camera arcs, with no frame
interpolation. Both sides use the same Mesa renderer, native 585×1266 phone-profile buffers, and
390×844 encoded output. The compared methods are frozen Classic and research Layered A. Source
credits appear beside every pair, and AI-made Studio samples are labeled.

Choose A, B, or Tie for each pair, then save the local choices file. No owner review has been
received; no 14-of-20 result is claimed. The synthetic vote-download smoke test only checks the
page.

The identity key is compressed in `raw/operator-key.json.gz`; leave it closed until voting is done.
The Operator can match the choices to that key. `review.json` contains the source and selection
records without revealing method identities.

## Measurement records

`raw/index.json.gz` lists archived files and hashes. Per-pose records, model configuration and input
hashes, the two failed reconstruction variants, source-license checks, and measured cost
observations are compressed in `raw/`. The CI case archive retains all 3,351 statuses, durations,
annotations, errors, and original report hashes; binary attachments and console output stay in the
Actions artifacts. `raw/study-sources.tar.gz` preserves the exact earlier capture sources and
control/figure scripts. Numeric model outputs and full-resolution renders can be regenerated from
the pinned public inputs; they are not packaged as application assets.

True-target RGB, masks, and depth rasters are deliberately absent from Git. The target metadata
records their hashes, fixed physical cameras, and guide protocol. The final protocol uses 16 Cycles
samples and normal/albedo-guided OpenImageDenoise. The source camera and source median-depth plane
fix one similarity transform; no target pixels fit a camera.

The portable depth rows use actual vendored WASM outputs on all 12 truth scenes. Their baseline
matches the app's captured worker outputs byte for byte. CPU lab checks and CPU-only reference rows
are identified separately. Only complete, explicitly supported coverage can pass a gate.

The [J figure](lab-j-review.jpg) shows **AI-made Studio challenge inputs and model outputs**, not
measured geometry. Its per-panel display scaling is for qualitative expect-line review. J never
supplies AbsRel, δ1, or metric ground truth.

## Limits and licenses

The full 118-input ribbon gate, owner preference, and a physical-phone cost run are unestablished.
The 20-input scout cannot pass the 118-input gate. The report records every added thin-probe loss;
per-pose counts prevent unchanged averages from hiding regressions.

Study code is MIT, made by Ryan with Codex (GPT-6). Recordings retain their source image conditions;
source authors, licenses, and links are in the review record. No model weights, neural inpainter, or
replacement application runtime ship here. The models' source code and weights cards were checked
live on October 16, 2026, and the records preserve those checks.

Rule check: none.
