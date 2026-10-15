# Full-quality exports — October 15, 2026

Made by Ryan with Codex (GPT-6), under Splashery's MIT license. Task:
[89-export-quality.md](../codex/89-export-quality.md). Status: implemented for owner review; not
accepted or merged. Rule check: none.

## What changed

`src/export/presets.js` is the shared source of choices, defaults, bitrate scaling, and budgets.
Share fills the existing controls from it. New selectors add shape, video motion, video size, frame
rate, and recording quality beside the existing controls. The Share layout, tab order, and recording
preview remain the Share lane's work. No engine files changed.

- GIF: Effect loop, 72 frames, and 720 px by default; 48/72/96/144 frames and 512/720/1080 px.
  Effect loops use the action's duration (four seconds when no duration is available). A loop
  restarts the actual toy action. Turntable remains available.
- Video: Effect loop, eight seconds, 1080 px, and 30 fps; lengths 4/8/15/30 seconds, sizes
  720/1080/1440 px, and 30/60 fps. Simulation and encoder timestamps advance by exactly one frame,
  independently of wall time. Long videos restart the effect. H.264 MP4 is preferred, then VP9 WebM.
  Browsers without either WebCodecs encoder get a plain explanation and can use Record. The pinned
  WebM muxer describes duration using the last frame's start; the exporter corrects the Segment
  Duration to include that final frame, without changing its timestamp or adding a frame.
- Match the picture keeps the source aspect ratio for Photo to 3D, Moving photo to 3D, and Video to
  3D. Other toys stay square. Dimensions are rounded to even pixels for H.264 compatibility.
- Record: ten minutes at most. Standard retains the former tier/DPR/1920-px and 8-Mb/s rules. High,
  the default, targets a 2560-px long side on computers and native stage pixels on phones. Max
  targets 3840 px on computers. High and Max never reduce native screen pixels to satisfy a tier
  cap. Max ends a take after two seconds of sustained rendering work below 20 fps.

Video uses 12 Mb/s at 1080 square and 30 fps, scaled by pixel area and frame rate, between 2 and 80
Mb/s. Record uses that same scaling for High and Max, and 128 kb/s for audio. This allocates more
bits to additional pixels and frames instead of enlarging a fixed-bitrate file.

The GIF encoder retains one raw frame at a time and resets its encoder buffer between compressed
frames. It distributes GIF's centisecond delay rounding across the loop. Share shows a size estimate
before encoding; conservative worst-case output plus working memory can refuse a choice. The
estimate is content dependent, rather than a promised final size.

Video flushes the WebCodecs queue every four frames and checks output bytes before muxing more
chunks. Both muxers are unmodified, pinned npm ESM builds loaded only when a video is saved:
`mp4-muxer@5.2.2` and `webm-muxer@5.1.4`, each MIT. See [LICENSES.md](../../LICENSES.md).

## Recording memory and handoff

Record retains compressed chunks in memory, then makes a Blob. It does not write a take to disk as
it goes. Save or Share is the visitor's explicit action. Policy ceilings are **96 MiB for phones**
and **384 MiB for computers**; available-memory and render-surface allowances can lower these
ceilings. The plan reserves working surfaces and room for a second output copy. A warning appears at
80%, and the stop reserves the larger of two chunks or two seconds at the target bitrate. A chunk
that would exceed the retained-output cap rejects and releases the take with a plain message; it
never returns a truncated file. The browser itself controls incoming chunk allocation.

The live source is a same-size canvas copy. It is updated at `frameend` only when `postrender`
marked an actual draw. The graphics device's final blit comes between those events; `frameend` by
itself also fires when nothing was drawn. Between renders, the recorder repeats the cached picture
instead of reading a cleared WebGL buffer. A rendered initial snapshot seeds the copy. The entire
cached pixel surface is submitted for idle frames; a one-pixel dirty region was unreliable on this
Chromium build. The recording owns an independent audio context and a silent clock, created in the
Record button gesture. The site's sound is bridged into it. A paused toy's original context stays
suspended, while silence continues advancing the file; resumed sound follows the same stream.
Cleanup closes only the recording-owned context. A short take uses a ten-second startup timer while
its final picture stays fixed; a stalled browser thread can extend the elapsed wait. Size overflow
stops immediately.

With sound, MP4 is selected only when the browser reports the complete H.264/AAC pair. This Linux
Chromium supports video-only MP4, but not that complete pair, so its sound recordings use WebM. This
avoids assuming a video-only capability also establishes audio support.

The Share lane receives `app.recorded = { blob, type, size, seconds, reason, name }` and the ready
`ui.setRecord({ blob, type, seconds, bytes, share, reason })` notification. No preview was built.
Closing the recording drops the app's Blob reference; encoder tracks and audio taps are stopped.

## Measurements

Chromium 151.0.7922.173 on Debian 13, WebGL2 through SwiftShader, weak splat profile, adaptation
off. Desktop viewport: 1440 × 900, DPR 1. Phone emulation: 390 × 844, DPR 3, touch enabled. These
are software-renderer measurements, not measurements on an iPhone or Android device. Other checks
ran concurrently, so wall times are observations under load, not isolated performance benchmarks.

The branch includes main at `ea35f3de` for its Photo-to-3D fixes. GIF/video timings were gathered
before that merge; recording samples and final tests use the merged source. The baseline is commit
`95da2ddb`: the runner intercepts its `app.js`, `exports.js`, and `ui.js`. The default export
methods are called directly; present-day control markup does not set the old exporter's programmatic
defaults. Before and after use different motion, resolution, and frame count, so the file-size
comparison is not a codec-efficiency comparison.

| Default export              | Before bytes | After bytes | Before wall time | After wall time |
| --------------------------- | -----------: | ----------: | ---------------: | --------------: |
| Photo to 3D GIF, desktop    |    2,992,258 |  14,543,419 |          13.01 s |        118.31 s |
| Treasure chest GIF, desktop |      901,632 |   3,237,321 |          30.03 s |         99.85 s |
| Donut GIF, desktop          |    1,296,857 |   5,272,509 |          43.68 s |         99.63 s |
| Photo to 3D GIF, phone      |    2,992,258 |  14,543,419 |          19.84 s |         88.82 s |
| Photo to 3D video, desktop  |      364,348 |  11,866,301 |           6.56 s |        279.70 s |
| Photo to 3D video, phone    |      292,456 |  11,847,576 |           7.50 s |        313.72 s |

| Recording                 | Saved pixels |     Bytes | Raw SSIM | Saved / live sharpness | Scored frames |
| ------------------------- | ------------ | --------: | -------: | ---------------------: | ------------: |
| Before: computer Standard | 1072 × 900   |    28,697 | 0.960941 |        277.44 / 486.03 |             3 |
| Computer Standard         | 1072 × 900   |    47,915 | 0.995733 |       970.29 / 1054.64 |             3 |
| Computer High (default)   | 2560 × 2150  |   647,271 | 0.992845 |       964.54 / 1003.97 |             3 |
| Computer Max              | 3840 × 3224  | 2,651,252 | 0.988700 |        312.73 / 301.31 |             3 |
| Before: phone Standard    | 584 × 966    |    41,796 | 0.890953 |       702.46 / 1220.75 |             3 |
| Phone Standard            | 586 × 968    |    21,562 | 0.968635 |        269.59 / 451.63 |             3 |
| Phone High (default)      | 1170 × 1936  |   214,121 | 0.883129 |      1542.04 / 2775.64 |             3 |

The phone samples have a one-pixel horizontal offset relative to the live reference. A separate
±1-pixel horizontal alignment check raises Standard SSIM to **0.994810** and High to **0.966891**.
The table retains the raw scores. The phone High result also retains about 55.6% of its reference
sharpness; it is not a claim of lossless capture. The offset and fine-detail loss remain items for
the owner's phone review.

Every saved Record frame was independently decoded: 6/5/20 frames for computer Standard/High/Max,
and 4/4 for phone Standard/High. None was dark or near uniform. Both baseline takes contain a
near-uniform third frame; that frame remains included in the reported baseline SSIM. Max stopped for
performance and kept its take. These sparse software-renderer recordings do not establish live
frame-rate performance.

Quality samples use the source snapshot `fa92d242`. The final audio-clock isolation follow-up is
`5db26cc2`; it leaves pixel capture, dimensions, and bitrate rules intact and is covered by the
decoded pause/resume audio regression.

The live reference is the final canvas snapshot already requested inside `startRecord`, at the
take's actual buffer dimensions. The measurement runner observes that snapshot without adding a
resize or render, then encodes its PNG after stopping. The three-second requested hold can become
longer while this software renderer finishes a draw or the encoder starts. The saved take counter
and wall times are preserved in the JSON rather than normalized to three seconds.

The old desktop video decoded to 27 frames over 4.629 seconds, despite requesting five seconds at 30
fps. The new default decodes to exactly **240 frames, 1080 × 1080, 30 fps, and 8.000 seconds**. Both
desktop and phone video samples were decoded independently with FFmpeg: all 240 frames contained a
picture. The regression also deliberately delays drawing beyond the frame interval and checks that
every encoded frame remains present.

A noise-canvas stress test exercised the actual MediaRecorder and full policy ceilings:

| Policy   |     Ceiling | Saved bytes | Stop time | Warning time | Stop reason |
| -------- | ----------: | ----------: | --------: | -----------: | ----------- |
| Phone    | 100,663,296 |  82,021,926 |   23.79 s |      23.79 s | Size        |
| Computer | 402,653,184 | 382,973,259 |  115.89 s |      99.11 s | Size        |

The stress source was 640 × 360, changing noise, 30 fps, and an 80-Mb/s encoder request, with H.264
MP4 and no sound. The explicit ceilings test accumulation and stopping; ordinary production plans
also subtract their larger rendering surfaces. These are real encoded-byte observations, not
estimates of available operating-system RAM. No stress-take binary is shipped.

## Reproduction and evidence

```sh
python3 -m http.server 4175 --bind 127.0.0.1
SPLASHERY_CHROMIUM=/usr/bin/chromium node tools/export-quality.mjs /tmp/export-quality/evidence
python3 tools/export-quality-score.py /tmp/export-quality/evidence
SPLASHERY_CHROMIUM=/usr/bin/chromium node tools/export-quality-budget.mjs /tmp/export-quality/budget-measurements.json
SPLASHERY_PORT=4175 SPLASHERY_CHROMIUM=/usr/bin/chromium npx playwright test tests/cdx-export.spec.mjs
```

The scorer compares decoded frames with a fixed live-canvas reference at the same resolution. SSIM
averages nonoverlapping 8 × 8 luma windows; sharpness is the variance of the four-neighbor luma
Laplacian. Higher sharpness alone is not a quality score: compare it with its own reference, not
across different resolutions. The old odd-sized phone output loses its last row and column in H.264,
so that baseline reference is cropped by one pixel, without resampling. Up to three actual decoded
frames are scored; the JSON records the exact count, including sparse software Max takes. Full-frame
SSIM includes the background. The separate alignment check crops one column from each side and
selects the best shift from −1, 0, and +1 pixels; it never replaces raw SSIM.

Large review files live only on
[codex/export-quality-clips](https://github.com/ryanjosephkamp/splashery/tree/codex/export-quality-clips/docs/audits/export-quality-clips),
which must never be merged. That branch holds phone and desktop defaults, before samples, fixed
scene recordings, references, measurements, and a review index. The implementation branch holds this
report and the reproducible runners.

## Verification and limits

- `tests/cdx-export.spec.mjs`: **16 passed** on the final implementation. Native H.264 and VP9 paths
  each encode every slow-drawn timestamp and preserve duration. The spec also covers defaults,
  aspect ratio, all four overlay exclusions, paused-scene recording, suspended sound with decoded
  silence and resumed tone, byte-cap warning/stopping, oversized-chunk refusal, track release,
  Moving photo seeking, flight-camera and lens restoration, effect repetition, encoder-failure
  cleanup, old scene versions, and old links.
- Existing `ui5-engine` Record cases and the embed transfer check: **3 passed** on the final
  implementation. The clock assertion changed from `/ 1:00` to `/ 10:00`; its timing, saved-file,
  sound, and download assertions remain intact. The embed transfer was **9.2 MB**, below 30 MB.
- An earlier broader run passed all **30 kit and unit tests**. Exploratory recording failures were
  investigated; the final named checks above are the completed reruns. The whole repository suite
  was not run.
- Independent FFmpeg decoding confirms both 240-frame defaults and the Record observations above.
  Vendored ESM bytes match the pinned npm packages; their SHA-256 values are in the verification
  JSON.

Small source-branch evidence: [measurements](export-quality/measurements.json),
[quality scores](export-quality/quality-scores.json),
[all-frame checks](export-quality/frame-checks.json),
[media metadata](export-quality/media-metadata.json),
[byte budgets](export-quality/budget-measurements.json), and
[verification](export-quality/verification.json).

The export spec uses the same WebGL2 SwiftShader launch flags as `tools/effect-clip.mjs`. The shared
suite config additionally enables Vulkan/WebGPU; exploratory runs with those additional flags
produced empty short recordings on this software renderer. No Vulkan, hardware-encoder, real-phone
frame-rate, or phone photo-library compatibility claim is made from the emulation. The full suite
remains the Operator's merge-PR check, as task 89 specifies.

The reviewer found issues in byte-cap enforcement, flight-camera ownership, lens restoration, and
long slow frames. Those were corrected. Controls and motion clocks are isolated for export; Moving
photo's source is explicitly sought on the stepped clock, and Video to 3D keeps control of its
flight camera. Export completion and failure restore controls, camera state, lens state, and the
normal update handlers. The GIF was also changed to cover the action duration instead of cutting
every effect at four seconds.

Owner review is still required for the public defaults. GIF estimates remain approximate. Some
high-resolution/long combinations are refused on small memory budgets; saved files and encode times
increase substantially at the new defaults. Old v2/v3 scenes and `#s=` links retain their schema,
and no export setting is written into them.
