# Local generated-video bridge diagnostic — negative exact-parity result

Original helper code: MIT, Made by Ryan with Codex (GPT-6). Outside-only bounded browser research; no product/runtime/native-coordinator edit or process signal. One owned browser was launched and normally closed. No camera/device request, upload, source-photo alteration, added source asset, or invented timestamp was used. R1/R2 parser, dashboard, and native jobs were left unchanged.

**The bridge does not satisfy the required exact RGBA/JPEG gate.** All12chosen anchors retained source timestamp values through the generated track (zero callback-time offset), but none reproduced the original video element's RGBA or JPEG bytes exactly. Matching timestamps are reported as timestamps, not proof of source-image identity. No tolerance was introduced; no integration is recommended from this result.

## Fixed experiment

Predeclared input order: existing synthetic `fast-extract-integration-r1/b-sar.mp4`, real chameleon-flowers (plant), cat-plays, fremantle-orbit. Exactly three original-video anchors per input at requested fractions0.2/0.5/0.8. Requested positions do not become source timestamps: actual `seekPresented` RVFC mediaTime is recorded, then matched exactly to frozen-r2 MP4 sample PTS converted to microseconds. Decoder chunks use those original PTS values, in decode order, without assigned replacement timestamps. The selected decoded VideoFrame is cloned unchanged for the bridge. Packet indices/PTS/storage, VideoFrame timestamps, independently observed original RVFC metadata, and generated-video RVFC metadata are retained.

Synthetic output uses the existing production crop at160long side; real files use320long side. Original reference, direct VideoFrame, and generated-stream video each use the existing production drawImage coordinates for their path, the same 2D canvas/context, and JPEG quality0.92. No alignment, crop tuning, color tuning, normalization, resampling beyond the existing production draw operations, image correction, or score feedback was added. Raw output bytes and hashes survive under per-input directories. Every saved JPEG is below1MB.

Parser is a byte-identical copy of frozen-r2 `demux.mjs`. Exact current source snapshots provide openVideo, seekPresented, crop/fit and generic decoderColor; source paths/copy hashes are in `source-input-bindings.json`. Raw source corpus clips remain byte-identical to the original manifest. AVC description/color metadata and dimensions are recorded. The source-color settings are the existing generic metadata/SD-height rule, not per-clip presets; explicit bitstream BT709 metadata overrides on Fremantle.

The generated API actually available/used in this main-thread Chromium151 context was experimental/nonstandard `MediaStreamTrackGenerator({kind:'video'})`; `VideoTrackGenerator` was unavailable on window. `writer.ready` and each `writer.write(frame.clone())` are awaited serially, with only one pending generated presentation, up to three retained source frames, and decodeQueueSize below4. Writer input preserves original frame timestamp and metadata. A muted local `<video playsinline>` receives a `MediaStream([track])` and each output is captured only after its own RVFC. No device stream is requested.

## Result

Exact source browser151.0.7922.173, `/usr/bin/chromium`, native benchmark `benchmarkLaunchArgs('swiftshader')`, four-core CPU quota, Node24.19.0. The Playwright default flags and exact configured benchmark arguments apply. The run occurred under concurrent root native/probe load. All elapsed values below are **diagnostic wall times, not isolated end-to-end timings or physical-device performance**.

| Input | Bridge exact RGBA/JPEG | RVFC source offset | Maximum bridge channel difference | Diagnostic whole-case time |
|---|---|---|---|---|
| Synthetic SAR |0/3,0/3|0atall3|4|7.54s|
| Plant |0/3,0/3|0atall3|1|5.30s|
| Cat |0/3,0/3|0atall3|1|4.52s|
| Fremantle |0/3,0/3|0atall3|1|6.78s|

The bridge reduces differences considerably on SAR inputs but remains inexact. Across synthetic frames the direct-path maximum channel difference was35–40, versus4through the bridge. Plant was14–22versus1; Fremantle21–23versus1. Cat was1forboth. `analysis.json` records all exact channel/pixel counts, histograms, hashes, and direct/bridge/original comparisons. These differences are retained rather than rounded away. Their cause was not isolated by this experiment, and exact source-picture identity is consequently unproven. The result cannot bypass the source mismatch guard or establish quality acceptance.

Native GPU geometry observations agree with root's prior diagnostic: plant/Fremantle original and bridge natural size854×481; decoded coded864×482, visible854×480, display854×481. Cat original/bridge270×480, decoded coded272×482. Synthetic original/bridge256×128, decoded coded192×130, visible192×128, display256×128. No geometry was rewritten to force agreement.

## Ownership and limitations

All four cases completed; cleanup receipts report zero retained frames, zero pending RVFC, decoder closed, generated track ended. Every decoder output closes or enters the bounded retained-frame map; original retained frames and writer clones close, writer aborts/releases, track stops, video pauses/disconnects/removes, source video closes/revokes URL, and browser/server close normally. Abort/deadline paths use the same final cleanup; the successful native run does not independently prove every injected failure path. Case deadline90s, RVFC8s, bounded writer-abort cleanup1s. No additional browser retry, worker API implementation, tolerance search, color/geometry fitting, or product change was attempted.

This proves the tested bridge is not an exact replacement under these native flags. It does not prove that every browser/driver/API variant is inexact. A worker-only VideoTrackGenerator route was not tested. Root owns any integration decision and further work.

## Documentation opened and read

Third-party documentation HTML is retained only as research evidence with original rights, **not relabelled own MIT**. Implementation is original code using browser APIs, not copied documentation example transforms.

- https://developer.mozilla.org/en-US/docs/Web/API/MediaStreamTrackGenerator — opened/read2026-10-15: experimental, nonstandard API; constructor accepts VideoFrame/AudioData; inherits MediaStreamTrack; exposes writable WritableStream.
- https://developer.mozilla.org/en-US/docs/Web/API/VideoTrackGenerator — opened/read2026-10-15: VideoFrame-consuming writable stream, `.track` output; API documented as available only in dedicated workers. No worker route was added after the main-thread route's negative result.

Hashes of docs, code, input source/license association, native environment, and every output are in `freeze.json`, `results.json`, and `source-input-bindings.json`. Original corpus authors/licenses/URLs are copied verbatim into `source-credits.json`; generated synthetic pattern is clearly separate. Reproduce only in a coordinated browser slot: `node probe.mjs`; analysis alone is CPU-only: `node analyze.mjs`.

Rule check: none.
