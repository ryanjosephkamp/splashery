# Full-quality exports — October 15, 2026

Made by Ryan with Codex (GPT-6), under Splashery's MIT license. Task:
[89-export-quality.md](../codex/89-export-quality.md). Status: implemented for owner review; not
accepted or merged. Rule check: none.

The current phone-duration follow-up is [review-r3.md](export-quality/review-r3.md). Earlier
measurements below retain their original policy and capture setup.

## What changed

`src/export/presets.js` is the shared source of choices, defaults, bitrate scaling, and budgets.
Share fills the existing controls from it. New selectors add shape, video motion, video size, frame
rate, and recording quality beside the existing controls. The Share layout, tab order, and recording
preview remain the Share lane's work. No engine files changed.

- GIF: Effect loop, 72 frames, and 720 px by default; 48/72/96/144 frames and 512/720/1080 px.
  Effect loops use the action's duration, capped at eight seconds (four seconds when no duration is
  available). A loop restarts the actual toy action. Turntable remains available.
- Video: Effect loop, eight seconds, 1080 px, and 30 fps; lengths 4/8/15/30 seconds, sizes
  720/1080/1440 px, and 30/60 fps. Simulation and encoder timestamps advance by exactly one frame,
  independently of wall time. Long videos restart the effect. H.264 MP4 is preferred, then VP9 WebM.
  Browsers without either WebCodecs encoder get a plain explanation and can use Record. The pinned
  WebM muxer describes duration using the last frame's start; the exporter corrects the Segment
  Duration to include that final frame, without changing its timestamp or adding a frame.
- Match the picture keeps the source aspect ratio for Photo to 3D, Moving photo to 3D, and Video to
  3D. Other toys stay square. Dimensions are rounded to even pixels for H.264 compatibility.
- Record: ten minutes at most, with the selected level's enforced limit shown before and during a
  take. Standard is now the default and retains the former tier/DPR/1920-px dimensions. High targets
  a 2560-px long side on computers and native stage pixels on phones. Max targets 3840 px on
  computers. High and Max never reduce native screen pixels to satisfy a tier cap. Max ends a take
  after two seconds of sustained rendering work below 20 fps.

Video uses 12 Mb/s at 1080 square and 30 fps, scaled by pixel area and frame rate, between 2 and 80
Mb/s. Live Record has a separate duration policy: Standard/High/Max request 8/12/16 Mb/s per
1080-square frame at 30 fps, with a 750-kb/s nominal floor and an 80-Mb/s ceiling. The actual
request is capped further so 80% of the encoded budget can hold three minutes for both phone levels.
On computers it reserves three minutes, one minute, and 30 seconds respectively, including a
128-kb/s audio allowance. The enforced limit is the lesser of ten minutes and that 80%-budget
duration at the requested video-plus-audio rate. Unusual variable-bitrate output can still reach the
byte guard first. High keeps its native phone pixels, and the current comparison measures both
levels against the same native display reference; the earlier per-level compression scores below do
not measure the detail lost by Standard's smaller render buffer. The Operator requested this default
change after reviewing the first measurements.

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
and **384 MiB for computers**. These are policy ceilings, not measured device memory or measured
free RAM. Approximate `deviceMemory` and render-surface allowances can lower these ceilings. The
plan reserves working surfaces and room for a second output copy. A warning appears at 80%, and the
stop reserves the larger of two chunks or two seconds at the target bitrate. A chunk that would
exceed the retained-output cap rejects and releases the take with a plain message; it never returns
a truncated file. The browser itself controls incoming chunk allocation.

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

The original evidence includes main at `ea35f3de` for its Photo-to-3D fixes. GIF/video timings were
gathered before that merge. The follow-up merges main at `cb8a8315`, including Share #653, and
measures the revised Record rates on its layout. The tables below retain the original measurements;
their High samples predate the switch to Standard by default. The baseline is commit `95da2ddb`: the
runner intercepts its `app.js`, `exports.js`, and `ui.js`. The default export methods are called
directly; present-day control markup does not set the old exporter's programmatic defaults. Before
and after use different motion, resolution, and frame count, so the file-size comparison is not a
codec-efficiency comparison.

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
| Computer High (original)  | 2560 × 2150  |   647,271 | 0.992845 |       964.54 / 1003.97 |             3 |
| Computer Max              | 3840 × 3224  | 2,651,252 | 0.988700 |        312.73 / 301.31 |             3 |
| Before: phone Standard    | 584 × 966    |    41,796 | 0.890953 |       702.46 / 1220.75 |             3 |
| Phone Standard            | 586 × 968    |    21,562 | 0.968635 |        269.59 / 451.63 |             3 |
| Phone High (original)     | 1170 × 1936  |   214,121 | 0.883129 |      1542.04 / 2775.64 |             3 |

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
`5db26cc2`; it left pixel capture, dimensions, and the original bitrate rules intact and is covered
by the decoded pause/resume audio regression.

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

## Operator follow-up: usable Record duration and merged Share layout

The first Operator review was
[PR #654, October 15, 2026](https://github.com/ryanjosephkamp/splashery/pull/654#issuecomment-6187329510).
Main was merged after Share #653 landed. Controls use explicit ids, tolerate absent slots, and
preserve controls already supplied by Share. Added selectors live beside Record or in its clip
settings rows. The original Length label and Save wiring stay intact. The Record note uses the
collapsed phone stage bounds supplied by the UI, so opening the sheet does not inflate the limit.

The prior High default could spend its budget in seconds at the target bitrate. Standard is now the
default because the original phone measurements did not establish a High advantage. Standard keeps
its previous rendering dimensions. High and Max remain explicit choices with shorter limits and
higher bitrates.

An initial policy budgeted five minutes for Standard and three for High, using 3/8/12 Mb/s per
1080-square frame. Its refreshed phone raw SSIM was 0.934992 / 0.828337 for Standard/High, with
saved/live sharpness of 42.8% / 30.0%. Those detail losses informed the final three-minute default,
one-minute High, and 30-second Max policy. The earlier samples and scores are retained on the clips
branch under `r2/policy-study`. At the reviewer's example sizes:

| Device / CSS stage         | Level    | Video request | Enforced maximum |
| -------------------------- | -------- | ------------: | ---------------: |
| Phone 390 × 664, DPR 3     | Standard |     3.12 Mb/s |             3:00 |
| Phone 390 × 664, DPR 3     | High     |     6.63 Mb/s |             1:00 |
| Phone 430 × 900, DPR 3     | Standard |     2.96 Mb/s |             3:00 |
| Phone 430 × 900, DPR 3     | High     |     4.67 Mb/s |             1:00 |
| Computer 1440 × 900, DPR 1 | Standard |     8.89 Mb/s |             4:31 |
| Computer 1440 × 900, DPR 1 | High     |    35.83 Mb/s |             1:00 |
| Computer 1440 × 900, DPR 1 | Max      |    54.31 Mb/s |             0:30 |

The [calculated example plans](export-quality/record-plans-r2.json) retain the exact rates,
dimensions, budgets, and limits. These examples assume a 1.5 tier cap and the normal phone/computer
memory policy. The stage beside the desktop panel is smaller than the whole viewport; the following
measurements use the actual stage dimensions. The 96/384 MiB ceilings are policy choices, not
measured device memory.

Real, unpaused takes replayed each toy's action about every four seconds, with the production
recorder and its audio track. Each requested 15 seconds after startup. MB means 1,000,000 bytes;
MB/min divides the entire saved file size by its actual encoded duration across both tracks,
measured with FFprobe packet timestamps. UI elapsed time is retained separately in
[original R2 rates](export-quality/record-rates-r2-original.json). Independent
[all-frame checks](export-quality/record-rates-frame-checks-r2.json) decoded every video frame; none
was dark or near uniform.

| Device   | Toy         | Level    | Saved pixels |     Bytes | Encoded seconds | Decoded video frames | MB/min |
| -------- | ----------- | -------- | ------------ | --------: | --------------: | -------------------: | -----: |
| Phone    | Photo to 3D | Standard | 586 × 900    |   649,310 |          15.742 |                   62 |  2.475 |
| Phone    | Photo to 3D | High     | 1170 × 1800  |   851,098 |          15.627 |                   34 |  3.268 |
| Phone    | Donut       | Standard | 586 × 900    |   297,891 |          15.246 |                   46 |  1.172 |
| Phone    | Donut       | High     | 1170 × 1800  |   220,833 |          15.662 |                   20 |  0.846 |
| Computer | Photo to 3D | Standard | 1072 × 900   | 1,083,580 |          15.174 |                   45 |  4.285 |
| Computer | Photo to 3D | High     | 2560 × 2150  |   671,241 |          15.822 |                    8 |  2.545 |
| Computer | Donut       | Standard | 1072 × 900   |   553,418 |          15.021 |                   39 |  2.211 |
| Computer | Donut       | High     | 2560 × 2150  |   169,365 |          16.508 |                   19 |  0.616 |

These are short, sparse software-renderer takes. They establish real bytes per saved minute for
these two toys; they do not establish sustained 30-fps throughput or long physical-phone behavior.
The policy uses conservative target rates and an explicit byte guard, rather than extrapolating
these unusually small files to a guaranteed long take. Actual counters and wall times remain in the
JSON.

### Final fixed-scene quality at the revised rates

These captures use the deterministic `player.renderAt(0, cameraState)` API: time and camera stay
fixed while render/layout updates can apply the selected buffer size. The earlier policy study used
the visibility pause. Different views do not isolate a causal bitrate improvement; compare every
saved file with its own reference. Full-frame SSIM includes the background, and horizontal alignment
remains a separate result.

| Device / level    | Raw SSIM | Aligned SSIM | Saved / live sharpness | Scored frames |
| ----------------- | -------: | -----------: | ---------------------: | ------------: |
| Computer Standard | 0.978296 |     0.978432 |      1417.88 / 1576.73 |             3 |
| Computer High     | 0.981884 |     0.981959 |        650.94 / 695.96 |             3 |
| Computer Max      | 0.975062 |     0.975251 |        257.41 / 256.44 |             3 |
| Phone Standard    | 0.907821 |     0.945036 |       726.42 / 1306.49 |             3 |
| Phone High        | 0.889163 |     0.940048 |       697.34 / 1278.77 |             3 |

The final phone Standard/High saved/live sharpness is about 55.6% / 54.5%. The one-pixel offset and
fine-detail loss remain visible in the evidence; these are not lossless or physical-phone quality
claims. Max stopped for performance and kept its take. Every final fixed-scene frame also decoded
without a dark or near-uniform picture. [Current scores](export-quality/quality-scores-r2.json),
[measurements](export-quality/fixed-measurements-r2.json), and
[all-frame checks](export-quality/fixed-frame-checks-r2.json) retain the exact counts and times.

GIF effects now sample the first eight seconds at most. Short effects retain their real duration;
Turntable remains four seconds. The cap is shared in the presets table and checked on encoded GIF
delays, so a 60-second Moving photo cannot spread 72 frames over its whole source.

The existing smoke export test now chooses 48 frames, 512 px, and a four-second 720-px video, and
accepts MP4 or WebM. The playground test chooses 512 px and checks it survives both rotations. All
previous file-size, settings-persistence, and console checks are retained. Existing Record clock
tests compare the running pill with its enforced plan and require at least three minutes at the
default; focus, footage, sound, Save, and download checks remain intact.

The requested `qr4-craft` run has one **(known on main)** builder snapshot failure. It expects
`b3918a78…` and receives `d98ad9f6…`. The same failure was already documented in
[the circular QR audit](circular-qr-2026-10.md). Running the exact hash loop on Node 24.19.0 against
separately extracted, immutable `cb8a8315` QR modules reproduced `d98ad9f6…`. Those modules are
byte-identical to this branch. The protected assertion and QR code are unchanged; the other seven QR
cases pass. [Baseline evidence](export-quality/known-main-r2.json) records full hashes and
source-file hashes.

## Reproduction and evidence

```sh
python3 -m http.server 4175 --bind 127.0.0.1
SPLASHERY_CHROMIUM=/usr/bin/chromium node tools/export-quality.mjs /tmp/export-quality/evidence
python3 tools/export-quality-score.py /tmp/export-quality/evidence
SPLASHERY_CHROMIUM=/usr/bin/chromium node tools/export-quality-record-rates.mjs /tmp/export-quality/record-rates
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

## Earlier revision verification and limits

The prior nine-file selection contains **136 cases**. Coverage was completed across the broad
135-case run and targeted corrections: **135 passed, one (known on main) QR snapshot failure, and no
missing or skipped cases**. The initial run had 133 passes and two failures; the Share capability
case was corrected and rerun, with a new companion check. This is not a single green suite run.

| Spec                   | Current result                                      |
| ---------------------- | --------------------------------------------------- |
| `cdx-export`           | 21 passed                                           |
| `smoke`                | 50 passed                                           |
| `cdx-playground-links` | 15 passed                                           |
| `pdf` / `pdf-engine`   | 9 / 2 passed                                        |
| `qr4-craft`            | 7 passed; 1 known main hash failure                 |
| `shr`                  | 13 passed across the broad run and capability rerun |
| `ui5-engine`           | 7 passed                                            |
| `cdx-a11y-layout`      | 11 passed                                           |

The export spec covers the eight-second GIF cap, both phone duration plans, null-safe/idempotent
control insertion, merged Share layout, native H.264 and VP9 timestamps/duration, shape/default
checks, four-format overlay exclusions, paused recordings and sound, decoded resumed audio,
time/byte limits, track cleanup, effect/media restoration, and old links/scenes. Embed transfer
remains **9.2 MB**, below 30 MB.

The Share fallback test now models a missing WebCodecs encoder as well as missing WebM recording.
Its previous GIF fallback, disabled Video, visibility, layout, and console checks are unchanged. A
companion verifies that WebCodecs video stays available when WebM MediaRecorder is unavailable.
Existing Record clock checks now compare with the enforced plan and require at least three minutes
at the default. Smoke and playground choices follow the new lists; file-size, persistence, and error
assertions were retained.

All **30 kit/unit tests** passed in the earlier implementation run. At that revision the whole
repository suite had not run. The Operator subsequently added the `full-suite` label; current
results and every failure are in the follow-up report.

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
frame-rate, or phone photo-library compatibility claim is made from the emulation. The current full
GitHub suite is enabled by the Operator's `full-suite` label.

The reviewer found issues in byte-cap enforcement, flight-camera ownership, lens restoration, and
long slow frames. Those were corrected. Controls and motion clocks are isolated for export; Moving
photo's source is explicitly sought on the stepped clock, and Video to 3D keeps control of its
flight camera. Export completion and failure restore controls, camera state, lens state, and the
normal update handlers. The GIF covers the action duration up to eight seconds, including long
Moving photo sources; 72 frames therefore never spread across an entire 30–60-second clip.

Owner review is still required for the public defaults. GIF estimates remain approximate. Some
high-resolution/long combinations are refused on small memory budgets; saved files and encode times
increase substantially at the new defaults. Old v2/v3 scenes and `#s=` links retain their schema,
and no export setting is written into them.
