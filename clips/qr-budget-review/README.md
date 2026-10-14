# QR budget compatibility review

October 14, 2026. Made by Ryan with Codex (GPT-6). The original procedural QR scene, GIF, and motion
strip are offered under CC0. Any visible assets in the interface screenshots retain the licenses
recorded in [CREDITS.md](../../CREDITS.md). This review branch is never merged; the media does not
ship with the site.

The actual current recipe runs at a 390×844 viewport. Its circular code has no available picture,
uses More detail, and encodes the public Splashery home URL. The capture explicitly limits the Kit
to 8,000 splats to reproduce the unchanged kit regression's budget. Every encoded module and bit is
preserved; both jsQR and ZXing read the 720-pixel stage capture and its 390-pixel copy in the new
regression. No test threshold changed.

The motion uses the original effect-clip tool's clock stepping at 12 fps: 0.4 seconds before a tap
and 3.5 seconds of the tile ripple. It is visual evidence, not a physical-phone performance test.
The stricter direct 4/8-pixel-per-module stage checks can still report a scan warning at this forced
budget. Their checks remain intact; normal-budget and real-picture cases pass unchanged.

![Phone-size tile ripple](qr-picture.gif)

[Motion strip](qr-picture-strip.png) · [Phone layout](cdx-qr-budget-390x844.png) ·
[Desktop layout](cdx-qr-budget-1440x900.png)

[Capture details, source hash, and media hashes](records.json). [Capture script](capture.mjs),
adapted from tools/effect-clip.mjs and offered under MIT. Serve the PR #562 checkout, then run:
SPLASHERY_URL=http://127.0.0.1:4173 node clips/qr-budget-review/capture.mjs /tmp/qr-budget-review
--size=390 --secs=3.5 --fps=12 --strip=6 qr-picture. Set SPLASHERY_CHROMIUM if Chromium is installed
outside Playwright’s default location.
[Recipe source on PR #562](https://github.com/ryanjosephkamp/splashery/blob/codex/video-3d-r2/src/packs/qr-craft.js).

Rule check: none.
