# Bounded MP4 AVC demux research

Original code: MIT, Made by Ryan with Codex (GPT-6). This is an outside-repository prototype, not a product integration or a decoder. No product/runtime/protocol file changed; no browser/GPU job launched by this helper. Corpus inputs remain byte-identical. FFmpeg controls are generated diagnostic patterns, never corpus observations.

`demux.mjs` is browser-pure ES module code with no imports, Node globals, network, or decoding. `io.mjs` adds a Node-only bounded file wrapper. Core interface:

```js
import { parseAvcMp4 } from './demux.mjs';
const {config, samples, timescale, editOffset} = parseAvcMp4(uint8Bytes);
// config: {codec, description: Uint8Array, codedWidth, codedHeight}
// samples: [{offset,size,dts,pts,duration,key}] in DECODE order.
// Timestamps/duration are integer TRACK ticks, NOT microseconds.
// PTS/DTS already subtract editOffset (do not subtract it a second time).
```

`description` copies the complete `avcC` payload. Codec strings preserve avc1/avc3 and use profile/compatibility/level bytes as six hexadecimal digits. The config dimensions are container sample-entry dimensions; SPS macroblock/crop dimensions are not separately parsed here. Packet bytes remain length-prefixed AVC access units, not Annex B. For a future decoder probe, `timestamp = Math.round(pts * 1e6 / timescale)`; submit bytes in decode order. `duration` here is literal `stts` sample duration (decode-timeline delta). With reordered VFR it is not necessarily presentation-frame duration: omit optional EncodedVideoChunk duration until independently validating display intervals. These instructions are a probe interface, not evidence of successful decode or JPEG identity.

Supported: unfragmented one-video-track MP4, avc1/avc3 with one sample description, bounded avcC SPS/PPS, stts, optional unsigned ctts-v0 or signed ctts-v1, stsc, fixed/variable stsz, stco/co64, and optional stss. Missing stss means all samples sync. Stored sample spans must lie wholly inside bounded mdat payloads and never overlap. Timescale, sample count, size tables, chunk mapping, safe integer arithmetic, box bounds, first random-access sample, and track/sample dimensions are checked.

Supported trivial edit is exactly one nonempty rate1 entry with nonnegative media_time. It applies a single composition→presentation offset. Every retained sample PTS must lie inside that edit span; no sample is silently discarded. Empty/delayed/multiple edits, changing rates, edit trims excluding samples, rotation/nonidentity track matrices, nonsquare pasp, cropped sample entries, external sample-description index, encryption/sample groups, fragmentation, compact stz2, multiple video tracks/descriptions, and unsupported codec/config forms reject with an explicit UnsupportedMp4 error. A future product path must fall back to HTML video on every rejection and every decoder error, rather than broadening support implicitly.

Hard limits:128MiB file,100000samples/table rows,10000visited boxes,12nesting levels,64mdat boxes,32MiB/sample,64KiB AVC config,64compatible-brand slots,8192px dimensions. This is not a hostile-bitstream security audit: actual AVC bitstream validity is delegated to a future platform decoder; parser proof does not establish codec safety or pixel identity.

## Observed corpus results

All20original corpus SHA-256 values matched the frozen manifest. Four were supported: **cat-plays, pisac, palace-statue, fresnel-lens**. For those four, every sample offset, size, PTS, DTS, duration, key flag, header width/height/timebase, and full avcC byte matched independent FFprobe7.1.5. Exact raw receipts and source/author/license association are in `corpus-comparison.json` and `corpus-receipts/`.

Thirteen were rejected for nonsquare pixel aspect, including small real differences such as cat-track1280:1281 and chameleon853:854. Three (dianthus, horse-statue, royal-sovereign) were rejected for two-entry edit lists containing an empty leading edit. Those are intentional current coverage limitations, not corrected source files. No accepted corpus asset was transcoded, square-normalized, or dropped from the benchmark. A WebCodecs prototype using this scope can only cover four of20inputs and needs HTML fallback for the others.

## CPU controls and an important FFprobe convention difference

Eight pure CPU checks cover known unsigned/signed composition offsets, B-order, variable chunks, co64, avc3, copied config ownership, missing stss, unsafe counts/offsets, malformed lengths, unsupported transforms/encryption/fragments, and256deterministic byte mutations. The original fixture had a manually miscounted ftyp offset (36 versus actual32); its two initial failed assertions are preserved in `cpu-tests-before-fixture-offset-fix.log`. The fixture expectation was corrected; no product test/threshold was edited.

FFmpeg-generated controls (`controls/results.json`) establish:

- CFR+Bframes:24samples, ctts-v0, all packet/config fields exactly match FFprobe.
- VFR without Bframes:16samples, alternating1024/512tick stts durations, all packet/config fields exactly match FFprobe.
- VFR+Bframes with signed ctts-v1:16samples; PTS, offset, size, key, header and config all match. **DTS/duration do not match FFprobe's presented packet convention**: FFprobe shifts every literal decode timestamp by−1024 and reports nominal512duration, whereas MP4 stts explicitly alternates1024/512. This difference is preserved, not hidden by rewriting the parser's raw track-clock fields. The first failed all-fields control and its inputs are retained in `controls-initial-r1/`. Independent CPU fixture assertions verify signed ctts semantics directly. No claim of full VFR+Bframe packet parity is made.

This makes a small presentation-PTS/JPEG identity experiment feasible; it does not establish parity of HTML compositor pixels, SPS crop/color conversion, seeking behavior, frame selection, abort/dispose ownership, cold/warm speed, or end-to-end bake quality/timing. Parent owns any coordinated browser decoder/JPEG experiment. R10 stays immutable.

## Documentation actually opened

Documentation HTML is third-party material with its original rights, **not own MIT code**. Local copies are read-only research receipts; use URLs/fact receipts when publishing, not a blanket MIT label for those pages.

- https://www.w3.org/TR/webcodecs-avc-codec-registration/ — sections1–4: avc1/avc3 six-digit codec suffix; AVC access-unit chunks; `description` is AVCDecoderConfigurationRecord; description-present selects AVC format, absent selects Annex B. Opened/read10:31UTC2026-10-15.
- https://developer.mozilla.org/en-US/docs/Web/API/EncodedVideoChunk — timestamp and duration are integer microseconds. Opened/read10:32UTC2026-10-15.
- Parent independently opened MDN VideoDecoder/VideoFrame and W3C ISO-BMFF byte-stream pages under `docs/`; those are parent-provided research references, not implementation code borrowed into this module. Receipt lists their actual page titles/URLs when available.

Reproduce: `node --test test.mjs`; `node compare.mjs` (20read-only FFprobe calls); `node controls.mjs` (tiny CPU libx264-generated patterns). Commands use Node24 and installed FFmpeg7.1.5; no new asset/model download. Data/config/input/code hashes are frozen separately with original source licenses preserved. No performance or quality acceptance claim.

Rule check: none.
