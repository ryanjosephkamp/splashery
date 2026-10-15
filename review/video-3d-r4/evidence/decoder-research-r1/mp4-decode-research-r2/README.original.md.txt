# MP4 AVC demux research r2

Original code: MIT. Made by Ryan with Codex (GPT-6). Outside-repository CPU-only research; no decoding, browser/GPU launch, source/runtime/protocol edit, asset replacement, or benchmark change. R1 is preserved byte-for-byte for every file in its frozen inventory, verified by `r1-binding-before.json` and `r1-binding-after.json`. Parent's independent browser probes are outside this CPU proof and are not claimed here.

## Interface

`demux.mjs` remains a browser-pure ES module without imports, Node globals, network, or mutation of input bytes:

```js
import { parseAvcMp4 } from './demux.mjs';
const result = parseAvcMp4(new Uint8Array(input));
// result.config = {
//   codec, description: Uint8Array, codedWidth, codedHeight,
//   displayAspectWidth, displayAspectHeight
// }
// result.sampleAspectRatio = {hSpacing, vSpacing}
// result.trackDisplay = {width, height, widthFixed16, heightFixed16}
// result.colorMetadata = null | {
//   type: 'nclc' | 'nclx', primaries, transfer, matrix,
//   fullRange: null | boolean
// }
// result.samples = [{offset,size,dts,pts,duration,key}] in DECODE order
// result.timescale, result.editOffset
```

R1 aliases remain. The config dimensions are stored sample-entry dimensions; SPS macroblock/crop dimensions are not separately parsed. `description` copies the complete avcC payload; packet bytes remain length-prefixed AVC access units, not Annex B. All sample timestamps and durations are integer TRACK ticks; PTS/DTS already subtract the one supported linear editOffset. For a future decoder probe, convert PTS with `Math.round(pts*1e6/timescale)` and submit in decode order. Literal stts duration is not necessarily presentation duration under reordered VFR; omit optional decoder-chunk duration unless display intervals are independently established.

## Geometry and color rules

R2 supports positive nonsquare pasp without altering, rescaling, reinterpreting, or synthesizing source pixels. Missing pasp means1:1. Display aspect integers are the exactly reduced ratio `(sampleWidth*hSpacing):(sampleHeight*vSpacing)`. Track display dimensions preserve raw unsigned16.16 values and their exact JavaScript values divided by65536. Their ratio must agree with the sample/pasp ratio within the uncertainty from less-than-one-LSB quantization of each stored track dimension. The comparison uses integer BigInt cross-products. Proportionally scaled track dimensions are permitted; inconsistent ratios reject. No pixel-rounding rule for HTML natural dimensions is invented here.

Predeclared additional bounds: each spacing≤1,000,000; ratio within1/64..64; stored track display sides positive and≤32768; reduced integer DAR components fit uint32. Zero/extreme spacing, malformed pasp, and inconsistent display geometry reject explicitly.

Raw colr metadata is returned with no decoder `colorSpace` setting and no automatic matrix, gamma, range, HDR, or unknown-value conversion. nclc payload must be exactly10bytes (four-byte type plus threeuint16 fields); nclx exactly11bytes (adds one full-range/reserved byte). nclx's seven reserved bits must be zero. Duplicate colr boxes, unknown colr types such as ICC `prof`, and wrong sizes reject. All numeric uint16 field values, including unsupported/HDR/reserved codes, remain raw data: their presence does not establish an applicable color conversion. nclc has `fullRange:null` because its payload does not specify a range flag. A future integration must explicitly interpret or fall back for unsupported color semantics; absence must not silently imply BT709. Parent owns generic Chromium/WebCodecs color and pixel parity research.

All R1 rotation, encryption, fragmentation, table, safe-integer, sample-storage, first-keyframe, and memory bounds remain. Only a single nonempty rate1 edit with nonnegative media_time is supported; retained PTS must lie within its span. Multiple/empty/rate-changing/trimming edits remain unsupported. The parser never drops samples to fit an edit. No product fallback is implemented; future product code must retain HTML fallback for unsupported/error cases.

## Actual corpus proof

`corpus-comparison.json` records all20input hashes, source URLs, authors, licenses, raw FFprobe byte hashes, every supported result, and every rejection. All20inputs match the frozen manifest unchanged.

**17clips /4,008samples are supported and exactly match FFprobe7.1.5** for every packet offset, size, PTS, DTS, duration, key flag, full avcC bytes, stored sample width/height, track timescale, sample aspect ratio, and reduced display aspect ratio. Thirteen newly supported clips account for3,216additional samples relative to R1. There are zero recorded supported-case mismatches.

The same three rejects remain: dianthus, horse-statue, royal-sovereign. Each has a two-entry edit list containing an initial empty edit. They remain full corpus cases and were neither rewritten nor omitted from evidence.

Examples directly from source metadata:

- cat-track: coded854×480, SAR1280:1281, track853.333328247×480, DAR16:9.
- chameleon-flowers: coded854×480, SAR853:854, track853×480, DAR853:480.
- fjoloy: coded1126×480, SAR51300:51233, track1127.472534180×480, DAR855:364.
- palace-statue and fremantle-orbit carry nclx primaries1/transfer1/matrix1/fullRangefalse; FFprobe independently reports BT709/BT709/BT709/tv. Other supported corpus clips have no colr box; absent container metadata is not proof that AVC bitstream VUI metadata is absent.

This is table/config proof, not browser decode, JPEG identity, color parity, speed, or bake quality proof. Parent reports separate original-four-clip pixel experiments; those reports retain their own scope and provenance, and are not mixed into this CPU result.

## Controls and limitations

Fifteen CPU checks pass, preserving the original eight R1 format/property controls and adding nonsquare/source-byte preservation, missing pasp, proportional track scaling, quantization tolerance, zero/extreme aspect bounds, raw nclc/nclx/HDR/unknown field preservation, invalid color lengths/types/reserved bits/duplicates, and malformed pasp/table boundaries. The256deterministic mutation check still runs. All packet/config rows are unchanged by adding aspect metadata.

The three tiny FFmpeg controls were rerun in r2: CFR+Bframes and VFR without Bframes match every FFprobe packet/config field. Signed-ctts VFR+Bframes matches PTS/storage/key/config/header, but retains R1's documented FFprobe-normalization difference: FFprobe shifts literal DTS by−1024 and supplies nominal512duration while stts alternates1024/512. The parser reports literal MP4 timing rather than fabricating full FFprobe parity. Generated patterns are diagnostics, never corpus captures.

The byte parser is bounded research code, not a hostile-bitstream security audit or an AVC bitstream validator. It does not parse SPS crop/color semantics, decode video, own VideoFrames/VideoDecoder resources, solve selection/cancellation, or establish physical-device performance. No source-specific color preset, held-out image, camera fit, synthetic camera, model change, or acceptance threshold is involved.

## Reproduction and rights

`node --test test.mjs`; `node compare.mjs` (20read-only FFprobe calls); `node controls.mjs` (small CPU libx264 patterns). No package/model/asset download required. `freeze.json` binds original implementation code and CPU receipts, separately from third-party source/documentation rights.

Implementation is own MIT code, not a copy of a third-party demuxer. R1's actually opened W3C AVC registration and MDN EncodedVideoChunk pages are cited by URL and immutable receipt hash from `../mp4-decode-research-r1/freeze.json`: https://www.w3.org/TR/webcodecs-avc-codec-registration/ and https://developer.mozilla.org/en-US/docs/Web/API/EncodedVideoChunk . Parent's opened MDN VideoDecoder/VideoFrame and W3C ISO-BMFF references remain under R1docs with original rights. No third-party HTML is relabelled MIT or copied into this r2 implementation. Corpus source media retains each manifest license; generated patterns are explicitly labelled and excluded from the corpus.

Rule check: none.
