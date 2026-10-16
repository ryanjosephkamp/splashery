# ASCII capture and media encoding prototype

Codex built this package in the owner's existing session on October 6, 2026, using GPT-6.1 Sol at
Extra High effort. Branch: `codex/ascii-capture-encoding-prototype`, cut from main at
`7488008708c6f6123b47a5abc8f634f84d37d3ec`. All changes stay in this audit directory. The site and
its export menu have no changes. [PR #335](https://github.com/ryanjosephkamp/splashery/pull/335)
remains a separate, unchanged draft. PDF and text QR work are separate.

This is the repository package of the reviewed local prototype: recorded toy frames become plain
ASCII, and the chosen detail, contrast, and color now determine newly encoded GIF/video downloads.
The converter and encoders do not call an AI model or a remote service. `capture.mjs` captures a
separate task-owned Splashery page; it never captures or rewinds the owner's live tab.

## Review and acceptance

The owner reviewed the local HTML and said: “Looks amazing! Thank you for your help. I'm ready to
proceed. Everything passes here.” Device, browser, and exact individual checks were not supplied.
This is owner-reported acceptance of the reviewed handback, not a universal browser/device matrix.
The original local HTML, full source ZIP, captures, and earlier PRs are preserved.

## Try the demo

From the repository root, use an unused local port:

```sh
python3 -m http.server 47846 --bind 127.0.0.1
# http://127.0.0.1:47846/docs/audits/ascii-capture-encoding-prototype/
```

Choose grapes, orange, or strawberry, adjust the controls, and press Play or create a media file.
The generated download uses the selected settings. The fixed reference MP4 links use the bundled
capture at 96 columns, original contrast, and 10 fps. Imported captures do not change those fixed
reference clips. Plain character rows, capture JSON, and ASCII JSON can also be saved. No camera or
microphone is requested; files stay on the device. Playback starts only on a tap. An active export
is canceled if the page becomes hidden; a GIF that has already been created is a separate media
preview.

For a single offline HTML, choose a new output file. The builder refuses an existing file:

```sh
node docs/audits/ascii-capture-encoding-prototype/build-handback.mjs /tmp/ascii-media-demo.html
```

It embeds the source PNG derivatives, six reference MP4s, code, and license notices. No network or
sibling files are needed. The modular repository demo needs HTTP.

## Implementation and integration boundary

- `ascii.js`: byte-for-byte copy of the deterministic core proposed in PR #335, SHA-256
  `04e436ddca7b011cc33f0233178b5048b6a369c7d2504faa74664f4487209950`. It is copied here for
  independent review because #335 is not on main. A later integration should use the reviewed core
  module in `src/export/ascii.js` after that PR is integrated, rather than keeping a second
  production copy.
- `capture-adapter.js`: manually steps a real player and records lossless PNGs at a fixed home
  camera. It holds a stage capture lock, rejects pending capture work, restores the values of the
  render controls it changes and the identities of its update handlers, and releases its lock on
  success, cancellation, or failure. It does **not** restore toy simulation/effect history or all
  player state. Only use a dedicated player/page and close it afterward.
- `encoders.js`: GIF encoding through the already vendored
  [gifenc 1.0.3](https://github.com/mattdesl/gifenc), and video through browser MediaRecorder/canvas
  capture. It yields between GIF frames, supports cancellation, bounds the canvas, and cleans up
  video tracks, listeners, and timers. A format capability flag does not guarantee recording
  succeeds; see
  [MediaRecorder's format check](https://developer.mozilla.org/en-US/docs/Web/API/MediaRecorder/isTypeSupported_static).
- `demo.js`: review UI, bounded PNG sequence import, character playback, progress/cancel, actual
  selected-setting exports, and explicit file downloads. Blob URLs are revoked when results are
  replaced or the page leaves.
- `capture.mjs`, `build-sources.py`, `encode-files.mjs`, and `encode-mp4.py`: reproducible local
  capture, derivative preparation, browser encoding, and exact MP4 reference encoding. Existing
  dependencies are reused. No binaries or models are bundled in this package.

The converter averages each cell's RGBA pixels and maps brightness to the ordered printable ASCII
palette. It is deterministic for identical input bytes and options. Live capture scheduling and toy
effects, image decoding, device fonts/antialiasing, GIF quantization, and real-time video timestamps
are separate sources of variation. The color presentation changes canvas colors while the underlying
rows remain ASCII. It is not a guarantee that every toy remains recognizable.

GIF delay rounding accumulates on the centisecond timeline; tested cumulative error at 8/10/12 fps
is at most 5 ms. Browser video has real-time timestamps, requires a visible page, and stops if it
cannot keep pace. It can add or drop frames. Prefer the GIF route or the offline reference encoder
when an exact frame timeline is required.

Before export-menu integration, the Operator should choose how a browser owns the isolated capture
player, its GPU/memory lifetime, input privacy, and attribution for other toy/file types. The
adapter here is not a state-safe recorder for an arbitrary live user scene. Integration and its
device/browser coverage are the next design step; neither is silently added by this PR.

The owner approved proceeding after reviewing the packaged handback. The resulting
[integration brief](integration-brief.md) recommends a disposable capture document, defines the
remaining acceptance checks, and includes a prepared Operator message for the owner to send. The
[offline HTML brief](integration-brief.html) presents the same handoff. This documentation update
does not implement the proposed host or change the existing export menu.

## Provenance, credits, and limits

The bundled samples preserve the accepted local prototype's inputs and media. Each source had 40
lossless 420 × 420 PNGs at 10 fps, a fixed camera, and a tap at frame 4. The demo embeds 210 × 210
area-averaged PNG derivatives. Capture source revision is
`f2f02656dc38b9fd15a9fc00158ea706c6effe1c`, the unmodified #335 checkout based on main at
`dc03d880ef9425eba71ee5dc5f0f97c79ec3d15d`. Its receipt is in `provenance/<toy>-capture.json`. This
historical capture revision is distinct from the newer packaging baseline.

The capture CLI was also exercised against the packaging baseline: all three toys produced 40 fresh
frames, with zero page errors/external requests and successful control/handler/lock restoration.
Those fresh captures were used to exercise the complete script pipeline. They are retained locally
as new evidence; the accepted bundled inputs were preserved.

| Bound          | Contract                                                                       |
| -------------- | ------------------------------------------------------------------------------ |
| Capture        | 256–512 pixels per side, 8/10/12 fps, 1–6 seconds, at most 64 frames           |
| Import         | 1–64 PNG data URI frames, 1–512 pixels per side, JSON under 12 MB              |
| Retention      | Four source clips, one converted sequence, one media result                    |
| Export canvas  | At most 1.5 million pixels; even padding for browser video                     |
| Credits        | Visible in every media frame; structured GIF comment and reference MP4 comment |
| Source presets | Grapes, whole orange, and strawberry; no claim for every toy                   |

Source dimensions are checked in the PNG header before decoding and again after decoding. Remote
frame URLs are rejected. Imported metadata is supplied by its file; this does not establish the
source's rights or license. Browser MP4 files rely on visible credits and accompanying receipts;
MediaRecorder does not add the structured container comment used by the reference encoder.

Grapes and orange are procedural Splashery sources under its MIT license. The code license is copied
in `licenses/splashery-MIT.txt`. **Strawberry** by Dany Bittel, from the
[source scene](https://superspl.at/scene/84df8849), uses
[CC BY 4.0](https://creativecommons.org/licenses/by/4.0/). Both source/license pages were opened on
October 6, 2026. Splashery converted and decimated it, removed spherical harmonics, and
recentered/scaled it. This prototype adds fixed-view capture, area averaging, ASCII conversion, and
GIF/H.264 encoding. Credit, source and license links, and change notices accompany the derivatives
and remain visible in each exported frame. Fine seed/texture detail remains a limitation. The
existing CREDITS.md entry covers the underlying model.

GIF uses the existing MIT library in `vendor/gifenc/`, already listed in LICENSES.md. Its notice is
also included here for offline handbacks. Pillow and FFmpeg are existing build tools already listed
there; no executable or new dependency was added. Reference MP4s were encoded with the existing
FFmpeg/libx264 build, restricted to two threads. The GIF comment appears before image blocks so a
first-frame metadata reader can expose it, following the
[GIF89a format](https://www.w3.org/Graphics/GIF/spec-gif89a.txt).

## Reproduce the capture and encoding scripts

Use existing repository dependencies and an installed Chromium; never install a browser as part of
this package. Start the local root server as above. In a second terminal, set the same port and
choose fresh paths outside the repository:

```sh
export SPLASHERY_CHROMIUM="/Applications/Google Chrome.app/Contents/MacOS/Google Chrome"
export SPLASHERY_URL="http://127.0.0.1:47846/"
node docs/audits/ascii-capture-encoding-prototype/capture.mjs --out=/tmp/new-ascii-captures
python3 docs/audits/ascii-capture-encoding-prototype/build-sources.py \
  --captures /tmp/new-ascii-captures --out /tmp/new-ascii-sources.json
node docs/audits/ascii-capture-encoding-prototype/encode-files.mjs \
  --out=/tmp/new-ascii-exports --sources=/tmp/new-ascii-sources.json
python3 docs/audits/ascii-capture-encoding-prototype/encode-mp4.py \
  --exports /tmp/new-ascii-exports/exports --receipt /tmp/new-ascii-mp4-receipt.json
```

Python needs an existing Pillow installation. `ASCII_FFMPEG` and `ASCII_FFPROBE` select existing
binaries; their defaults are `/opt/homebrew/bin/ffmpeg` and `/opt/homebrew/bin/ffprobe`. See the
[FFmpeg documentation](https://ffmpeg.org/ffmpeg.html) for the reference encoder. The CLI defaults
its dependency paths to this repository, accepts `SPLASHERY_DEPENDENCIES`, and permits only a
loopback HTTP source server. Capture/encoding scripts refuse existing outputs. Reproduction creates
new results; it does not promise identical live toy pixels or browser timestamps.

## Verification

```sh
SPLASHERY_CHROMIUM="/Applications/Google Chrome.app/Contents/MacOS/Google Chrome" \
  npx playwright test --config=docs/audits/ascii-capture-encoding-prototype/playwright.config.mjs
python3 docs/audits/ascii-capture-encoding-prototype/verify-media.py \
  --receipt /tmp/new-ascii-decode-receipt.json
npx prettier --check .
node tools/us-english.mjs --diff
```

The scoped configuration uses one worker, an unused port, and refuses another lane's server. Eight
package tests passed with Playwright 1.56.1 and Chrome 154.0.8037.98: pure brightness and
transparency endpoints/input preservation, GIF timeline rounding, offline selected-setting GIF
export and credit round-trip, cancellation, decoded video motion/track cleanup, capture restoration
after cancellation/failure on current main, import bounds, and phone-sized/desktop layout. The
screenshots in `evidence/` are browser viewport checks, not a physical-device matrix.

`verify-media.py` independently decoded all 18 shipped GIF/MP4 files with Pillow/FFmpeg, confirmed
motion, checked dimensions/counts/timing, and checked structured credit/settings in GIFs and
reference MP4s. Six GIFs and six reference MP4s have 40 frames and exactly four seconds. Native
browser MP4s retain their measured 41-frame, approximately 3.95–4.07-second recordings. Historical
`prototype-02-*` receipts retain the earlier local verification, including GIF pixel-error checks
against ASCII PNG intermediates; those intermediates and full-size original captures are in the
preserved local ZIP rather than duplicated in this repository. New package checks are recorded
separately. The full toy/engine suite was not run for this isolated audit package; no production
source, toy, or shared test/configuration changed.

No export-menu wiring, merge, deployment, Operator message, other chat/agent, PDF work, or text QR
work is part of this package. The PR is intentionally left a draft for integration review.
