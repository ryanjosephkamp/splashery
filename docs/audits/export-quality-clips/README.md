# Task 89: export review files

**Review evidence only. Never merge `codex/export-quality-clips`.**

Made by Ryan with Codex (GPT-6), October 15, 2026. The implementation and measurement methods are on
[codex/export-quality](https://github.com/ryanjosephkamp/splashery/blob/codex/export-quality/docs/audits/export-quality-2026-10.md).
These files were generated locally in Chromium 151 with WebGL2 through SwiftShader, at a 1440 × 900
computer viewport and a 390 × 844 phone viewport (DPR 3). Phone emulation is not a physical phone.
Existing toy assets retain the licenses and credits in [CREDITS.md](../../../CREDITS.md) and
[LICENSES.md](../../../LICENSES.md). Export code is MIT.

## Revised defaults after Operator review

Record now defaults to **Standard**. Its separate bitrate policy budgets three minutes on the
reviewed phone sizes. High shows one minute; Max has a shorter computer-only limit. The 96/384 MiB
ceilings are policy ceilings, not measured device memory. GIF and stepped video keep their original
defaults; GIF effect sampling is now capped at eight seconds.

| Current Record choice         | Computer                                   | Phone                                    |
| ----------------------------- | ------------------------------------------ | ---------------------------------------- |
| Standard default, Photo to 3D | [Video](r2/desktop-photo-3d-standard.webm) | [Video](r2/phone-photo-3d-standard.webm) |
| Standard default, Donut       | [Video](r2/desktop-donut-standard.webm)    | [Video](r2/phone-donut-standard.webm)    |
| High, Photo to 3D             | [Video](r2/desktop-photo-3d-high.webm)     | [Video](r2/phone-photo-3d-high.webm)     |
| High, Donut                   | [Video](r2/desktop-donut-high.webm)        | [Video](r2/phone-donut-high.webm)        |

[Measured MB/min, elapsed time, duration, and frames](r2/record-rates.json),
[all-frame checks](r2/frame-checks.json), and
[motion contact sheet](r2/record-rates-contact-sheet.jpg). These real takes replay each toy's
effect. The software renderer drops frames, so these short takes do not establish sustained phone
frame rates or long-take hardware behavior. None of their frames is dark or near uniform. The
original fixed-scene SSIM below predates these bitrate changes.

### Final fixed-scene comparisons

[Computer Standard](r2/fixed/after-desktop-record-standard.webm),
[High](r2/fixed/after-desktop-record-high.webm), and [Max](r2/fixed/after-desktop-record-max.webm).
[Phone Standard](r2/fixed/after-phone-record-standard.webm) and
[High](r2/fixed/after-phone-record-high.webm). The matching `*-reference.png` files hold the live
reference. [Contact sheet](r2/fixed/contact-sheet.jpg), [scores](r2/fixed/quality-scores.json),
[measurements](r2/fixed/measurements.json), and [all-frame checks](r2/fixed/frame-checks.json).
These use deterministic renderAt(0, cameraState), with the scene/camera fixed and render/layout
updates allowed at the new size. Phone Standard/High retain about 55.6% / 54.5% of reference
sharpness; owner phone review remains required. Max stops for performance on this renderer.

The [earlier duration-policy study](r2/policy-study/README.md) retains the preceding samples and
scores. Its different camera/visibility-pause setup prevents treating the score difference as a
controlled bitrate-only improvement.

### Current Share controls after merging #653

| Controls                           | Computer, 1440 × 900                                  | Phone, 390 × 844 at DPR 3                            |
| ---------------------------------- | ----------------------------------------------------- | ---------------------------------------------------- |
| Record and its selected time limit | [Screenshot](r2/cdx-export-share-record-1440x900.png) | [Screenshot](r2/cdx-export-share-record-390x844.png) |
| Video settings and Save            | [Screenshot](r2/cdx-export-share-video-1440x900.png)  | [Screenshot](r2/cdx-export-share-video-390x844.png)  |
| GIF estimate and Save              | [Screenshot](r2/cdx-export-share-gif-1440x900.png)    | [Screenshot](r2/cdx-export-share-gif-390x844.png)    |

The phone settings scroll vertically, as in the approved Share layout. The controls remain inside
the marked slots, and the Length label stays intact. [Exact example plans](r2/record-plans-r2.json)
and [verification](r2/verification-r2.json) accompany the captures.

## Original export snapshot for comparison

| Export                                         | Computer                                        | Phone                                         |
| ---------------------------------------------- | ----------------------------------------------- | --------------------------------------------- |
| PNG                                            | [Picture](after-desktop-photo-3d-png.png)       | [Picture](after-phone-photo-3d-png.png)       |
| GIF: Effect loop, 72 frames, 720 px            | [Animated GIF](after-desktop-photo-3d-gif.gif)  | [Animated GIF](after-phone-photo-3d-gif.gif)  |
| Video: Effect loop, 8 seconds, 1080 px, 30 fps | [H.264 MP4](after-desktop-photo-3d-video.mp4)   | [H.264 MP4](after-phone-photo-3d-video.mp4)   |
| Record: High (original)                        | [VP9/Opus WebM](after-desktop-record-high.webm) | [VP9/Opus WebM](after-phone-record-high.webm) |
| Share controls                                 | [1440 × 900](share-1440x900.png)                | [390 × 844](share-390x844.png)                |

Both default MP4s have 240 decoded frames. Record is live, so it can drop frames on this software
renderer. Its High computer output is 2560 px on the long side; its phone output uses native stage
pixels. The Linux browser lacks the H.264/AAC recording pair and uses the supported WebM fallback.
Max stops for performance on this renderer. Short takes can hold their last picture while the
software encoder finishes starting. These recordings show quality, not hardware frame-rate claims.

## Three GIF effects

[Photo to 3D](after-desktop-photo-3d-gif.gif), [treasure chest](after-desktop-chest-gif.gif), and
[donut](after-desktop-donut-gif.gif). [Four frames from each](gif-contact-sheet.jpg).
[Four frames from the default video](video-contact-sheet.jpg).

## Before and after

The report contains file sizes and encoding times. All measurements are also in
[measurements.json](measurements.json). The former defaults use the exporter from `95da2ddb`.

| Export          | Computer before                            | Phone before                             |
| --------------- | ------------------------------------------ | ---------------------------------------- |
| Photo GIF       | [GIF](before-desktop-photo-3d-gif.gif)     | [GIF](before-phone-photo-3d-gif.gif)     |
| Video           | [WebM](before-desktop-photo-3d-video.webm) | [WebM](before-phone-photo-3d-video.webm) |
| Record Standard | [MP4](before-desktop-record-standard.mp4)  | [MP4](before-phone-record-standard.mp4)  |

Other GIF baselines: [chest](before-desktop-chest-gif.gif) and
[donut](before-desktop-donut-gif.gif).

## Fixed-scene recording comparisons

[Computer Standard](after-desktop-record-standard.webm), [High](after-desktop-record-high.webm), and
[Max](after-desktop-record-max.webm). [Phone Standard](after-phone-record-standard.webm) and
[High](after-phone-record-high.webm). The matching `*-reference.png` files are live-canvas
snapshots, and [quality-scores.json](quality-scores.json) records SSIM, sharpness, and the exact
decoded frame count. [budget-measurements.json](budget-measurements.json) records actual byte-cap
stops; stress videos are not retained. [manifest.json](manifest.json) identifies the review files by
size and SHA-256.

[All-frame checks](frame-checks.json) and [media metadata](media-metadata.json) retain independent
decoding results. New Record takes contain no dark or near-uniform frames; both baseline takes
contain a near-uniform final frame, retained in their scores.

Quality samples use `fa92d242`. The final audio-only isolation follow-up `5db26cc2` preserves paused
toy sound with a recording-owned clock. The native regression decodes silence before resume and an
audible tone afterward; that follow-up left pixel capture, dimensions, and the original bitrate
rules unchanged. The revision above supersedes those Record rates and its default.
