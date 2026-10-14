# Toy checkpoints, part e: phone evidence

Made by Codex for task 82e on October 14, 2026. This branch is evidence only; never merge it. The
runtime, assets, vendor files, and tests are unchanged from checkpoint
`41b21e74e04ccca178b95ac02b4e5dc0e51b4b45` on `claude/checkpoint-toys-2026-10-14`.

## Clips

All clips are silent WebM videos recorded from the real Chromium app at 390×844, with mobile/touch
emulation, DPR 1, WebGL2 through SwiftShader, `profile=low`, and `adapt=off`. Calls to the existing
app/player APIs select options and fire actions; no renderer, data parser, or simulation is mocked.
The full app viewport is recorded; its stage canvas is 390×645. Bootstrap/loading before the review
action is trimmed. Existing motions run on the real browser clock, not a stepped clock.

| Toy                         | Clip                                  | What is shown                                                                                                                                | Before / after                                                                     |
| --------------------------- | ------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------- |
| Powers of ten               | [Video](powers-of-ten-390x844.webm)   | The Zoom slider visits exponents 2, 4, 7.1, 21, -4, -7.4, and home 0.3. This samples transitions; it is not the full 70-second Play journey. | [Before](powers-of-ten-390x844.png) / [after](powers-of-ten-after-390x844.png)     |
| Super-resolution microscope | [Video](smlm-microscope-390x844.webm) | Nucleus sample; slice at the field center, then restore full depth.                                                                          | [Before](smlm-microscope-390x844.png) / [after](smlm-microscope-after-390x844.png) |
| Galaxy in a box             | [Video](galaxy-box-390x844.webm)      | Default gas temperature peel, then simulated telescope view and a six-second exposure.                                                       | [Before](galaxy-box-390x844.png) / [after](galaxy-box-after-390x844.png)           |
| Point clouds                | [Video](point-clouds-390x844.webm)    | Default Palace of Fine Arts LAZ, with a scan sweep.                                                                                          | [Before](point-clouds-390x844.png) / [after](point-clouds-after-390x844.png)       |
| Volume viewer               | [Video](volume-viewer-390x844.webm)   | Default walnut cut sweep, followed by the gar sample.                                                                                        | [Before](volume-viewer-390x844.png) / [after](volume-viewer-after-390x844.png)     |

Videos were decoded and dimensions checked with FFprobe. Before/after screenshots and selected
intermediate frames were visually inspected. Each PNG is below 1 MB. This is a sample of the
checkpoint's behavior, not exhaustive visual approval of every setting or a physical-phone test.

## Measurements

`measurements.json` contains the exact default-view results and method. Each toy has a fresh browser
context after app boot, no video recording, and no concurrently running test suite. Load is measured
from selecting the toy through loading completion, initial chunk settling (Powers of ten), and a
captured frame. This excludes app startup and measures a local HTTP server, not an internet
transfer. Asset byte counts come from observed response bodies excluding thumbnails; the galaxy and
point-cloud runs also saw an unrelated 53,129-byte flags metadata request. Their documents separate
that from sample data.

Rendered frame events were counted over five seconds while requesting renders and turning the
camera. Powers of ten stayed tilt-locked at home while rendering was requested. Median and 95th
percentile frame intervals are included. There is one observation per default view, with no
physical-device, WAN, peak-memory, thermal, high-DPR, WebGPU, or all-settings benchmark. The
microscope's measured default differs from the nucleus shown in its clip.

`inventory.json` records source-file byte sizes, localization counts, and galaxy headers read from
committed assets. It is not a new download or regeneration of those assets. `source-access.json` and
`zenodo-access.json` record which public scientific pages and dataset metadata were accessed. DOI
landing pages returned HTTP 403, but Zenodo's API returned the titles and CC BY 4.0 license metadata
for all six microscopy samples and both volume sources.

## Reproduction

Serve the saved checkout with the existing Python server, and run the capture script from that
repository's root (with its existing npm dependencies). Point it at the installed Chromium:

```sh
python3 -m http.server 4173 --bind 127.0.0.1
# In another terminal, from the same repository root:
SPLASHERY_CHROMIUM=/usr/bin/chromium CHECKPOINT_E_OUT=.cache/checkpoints-e-rerun node /path/to/this/evidence/capture.mjs
```

Set `CHECKPOINT_E_MODE=clips` to capture only video/screenshots and leave the saved measurement JSON
untouched. The script uses Playwright video recording, which needs its FFmpeg executable. This
workspace had system FFmpeg already installed but lacked Playwright's expected FFmpeg file; a
symlink to the existing executable supplied it. No browser was installed or application code
changed. System FFmpeg/FFprobe is already listed in the repository's `LICENSES.md`.

The recorded videos include bootstrap frames initially. `clips.json` records the action interval,
original duration, and trim offset used here. FFmpeg removed the leading bootstrap segment and
encoded the remainder as VP8 WebM (`-ss <trimStart> -an -c:v libvpx -crf 20 -b:v 0`). The listed
frame rate in a video container is an encoding rate, not the measured rendering rate.

## Verification

The first targeted run executed `pot.spec.mjs`, `sci.spec.mjs`, `sci3.spec.mjs`,
`sci3-engine.spec.mjs`, `vwr.spec.mjs`, and `vol.spec.mjs`, excluding screenshot-writing cases: 95
passed and one failed. `targeted-tests.txt` preserves test names and the failure. The failing case
was the Volume viewer browser DICOM/NIfTI import workflow. After selecting the DICOM series it
waited for new stats, but the UI remained on the walnut and reported `IM0000.dcm is empty.`
Reader/format fixture tests passed.

Shared engine verification passed the WebGL2 and WebGPU unchanged-toy and volume cut/window checks,
plus Powers of ten streaming/zoom/framing/rulers and science close-up limits/clip/pan. The
additional run finished with ten passes and one failure: all shared-engine checks passed, and the
DICOM import workflow reproduced the same empty-file error. Both renderers were exercised without
adapter skips. `engine-and-recheck-tests.txt` records the complete recheck.

The main documentation passed repository-wide Prettier and the American English diff check. Final
versions are checked again immediately before pushing.

The documentation branch changes only five Markdown checkpoint files. It does not change `src/`,
`assets/`, `vendor/`, or tests. Restore-command paths were checked against the saved git tree;
full-repository restore worktrees are documented separately from partial file restores. The
historical checkpoint branch was fetched and never pushed to, rebased, or deleted.

Rule check: none.
