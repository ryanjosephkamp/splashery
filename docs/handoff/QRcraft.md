# Lane QR craft: picture codes, codes built from real things, and other barcodes (prefix `qrc`)

## Brief

You are a Splashery worker session, started by the Operator (the coordinating session) for the
October push. Repo: ryanjosephkamp/splashery. Your lane: QR craft (id `QRcraft`, prefix `qrc`).
Branch: `claude/lane-qr-craft` (and `claude/lane-qr-craft-engine` for any change to the app outside
your own files, as an "Engine: …" PR merged first). PR title: "Phase QR craft: picture codes, codes
built from real things, and other barcodes". Handoff file: docs/handoff/QRcraft.md (create it; start
it with this brief, word for word, under "## Brief", then keep "## State

READY: all three items built, tested and on Effect review page 2 (October 6, 2026, Opus 5.5, default
effort). Draft PR #349. Cards (lane record `QRcraft`, groups `picture`, `build`, `barcodes`):
`qrc-qr-picture`, `qrc-qr-build-dominoes`, `qrc-qr-build-marbles`, `qrc-qr-build-tiles`,
`qrc-barcodes-code128`, `qrc-barcodes-ean13`, `qrc-barcodes-datamatrix`, `qrc-barcodes-aztec`. Each
QR clip's last frame reads with jsQR. The owner marked all eight cards good (October 6, 2026, by
17:30 UTC).

Three new labs toys on the QR shelf (Studio), pack `src/packs/qr-craft.js`:

1. **Picture QR** (`qr-picture`, Q5). A photo woven into the code as a halftone
   (`src/qr-craft/picture.js`): each module is cut into k × k cells; the middle c × c keep the
   module's bit, the rest carry the picture, darkened in dark modules and lightened in light ones as
   far as the contrast slider asks (keeping its hue). Finders, separators, timing, alignment, format
   and version information stay plain. Options: picture (four CC0 samples already in the repo, the
   Photo to 3D toy's, or your own, kept in memory only), contrast, center dot (a third, three
   sevenths, three fifths of a module), error correction (H by default), color or dithered black and
   white. The panel shows the measured contrast (mean dark against mean light module) and whether
   jsQR reads the layout at 8 and 4 pixels a module, each a little out of focus (a blur of a fifth
   of a module, without which any contrast reads), and whether the splats on the stage read at both
   sizes. "Make it scan" tries the closest versions (more contrast, then a bigger dot, then a higher
   level) and applies the first that reads. Save a PNG. Tap: every tile turns over in a wave from
   the tap, its back the plain code (3.6 s).
2. **QR from real things** (`qr-build`, Q13; `src/qr-craft/pieces.js`). Dominoes (ebony and ivory, 2
   modules long where a row allows, standing on end; each row topples left to right, each domino
   knocking the next, lands with a small bounce), marbles (the eyes and alignment marks are walnut
   frames that drop in first; then a dark glass marble rolls in along its row into each other dark
   module, turning by distance over radius, relit as it turns, rocking once in its cup) and flip
   tiles (two-sided; the dark modules' tiles turn over in a wave from the tap). 6.5 s build; the toy
   reads its last frame with jsQR at 8 and 4 pixels a module.
3. **Other barcodes** (`barcodes`, Q12). Code 128 (code sets A, B and C, check symbol mod 103, 10X
   quiet zones), EAN-13 (L/G/R tables, parity by first digit, 11X/7X) and UPC-A (9X) by our own code
   (`src/qr-craft/barcodes.js`); Data Matrix (square) and Aztec from ZXing for JavaScript 0.21.3
   (vendored `vendor/zxing-js/`, Apache-2.0, 332 KB, loaded when the toy opens). Tap: a red scan
   line sweeps across and each bar lifts as it passes (2.6 s). The toy reads its own picture with
   zxing-js. Evidence: `docs/evidence/barcodes.json`.

Tests: `tests/qrc-picture.spec.mjs` (5), `tests/qrc-build.spec.mjs` (2),
`tests/qrc-barcodes.spec.mjs` (5). Also run: `tests/help.spec.mjs` (list), `tests/hta.spec.mjs`,
`tests/unit.spec.mjs`.

Tools: `tools/qrc-picture.mjs` (thresholds and the scan lab's 9 phone-like captures),
`tools/qrc-shot.mjs` (a screenshot of a toy with options), `tools/qrc-clip.mjs` (review clips).

### Picture QR, measured

`node tools/qrc-picture.mjs --phone` (October 6, 2026): each sample at level H, 50% contrast; the
module contrast, the toy's own check, and how many of the scan lab's 9 phone-like captures both jsQR
and zxing-js read exactly; then the lowest contrast the toy's check passes, and its captures.

| Sample        | Style | Dot   | Contrast | Check | Phone-like | Lowest that passes | Its captures |
| ------------- | ----- | ----- | -------- | ----- | ---------- | ------------------ | ------------ |
| still-life    | color | small | 5.30 : 1 | ✓     | 9/9        | 25%                | 9/9          |
| still-life    | color | big   | 7.91 : 1 | ✓     | 8/9        | 0%                 | 9/9          |
| still-life    | bw    | small | 5.93 : 1 | ✓     | 8/9        | 45%                | 8/9          |
| still-life    | bw    | big   | 8.55 : 1 | ✓     | 8/9        | 0%                 | 8/9          |
| wildflowers   | color | small | 3.38 : 1 | ✓     | 7/9        | 25%                | 8/9          |
| wildflowers   | color | big   | 5.87 : 1 | ✓     | 8/9        | 0%                 | 8/9          |
| wildflowers   | bw    | small | 3.49 : 1 | ✗     | 3/9        | 55%                | 3/9          |
| wildflowers   | bw    | big   | 6.08 : 1 | ✓     | 8/9        | 0%                 | 8/9          |
| spiral-stairs | color | small | 3.04 : 1 | ✓     | 8/9        | 0%                 | 8/9          |
| spiral-stairs | color | big   | 5.39 : 1 | ✓     | 8/9        | 0%                 | 7/9          |
| spiral-stairs | bw    | small | 3.18 : 1 | ✗     | 4/9        | 60%                | 8/9          |
| spiral-stairs | bw    | big   | 5.73 : 1 | ✓     | 8/9        | 0%                 | 8/9          |
| forest        | color | small | 3.40 : 1 | ✓     | 9/9        | 35%                | 8/9          |
| forest        | color | big   | 5.89 : 1 | ✓     | 8/9        | 0%                 | 8/9          |
| forest        | bw    | small | 3.72 : 1 | ✗     | 4/9        | 55%                | 7/9          |
| forest        | bw    | big   | 6.45 : 1 | ✓     | 8/9        | 0%                 | 9/9          |

What it says: a picture code is weaker than a plain one (QR r3's plain codes read 9 of 9); color
with the small dot reads in 7 to 9 of 9 at the default; the dithered black and white with the small
dot is the weak one, and the toy's own check says so and Make it scan moves it to a bigger dot or
more contrast.

### Marbles and jsQR

Round dots alone make jsQR unreliable (zxing-js read every size): a simulated marble code read at 3
to 6 of 8 sizes from 4 to 12 pixels a module. With the eyes solid, 4 to 8 of 8; with the eyes and
the alignment marks solid, 8 of 8 for every text tried. So in the marble build the eyes and
alignment marks are walnut frames that drop into the tray first.

## Notes

- A splat shows from both sides, and WebGL2 sorts the splats as they lie at rest, so a tile turned
  over showed its dark face through its light one. The flip tiles' faces are hidden while they face
  away (their top, bottom and sides are their own kinds in the GPU program).
- Clips: `tools/qrc-clip.mjs` at 540 × 720 and 20 fps (720 × 960 took about five frames a minute in
  the software renderer); at a closer distance the frame cut off the quiet zone, so the build clips
  use the toy's own distance.
- Barcodes seen at an angle were hatched: the paper's splats, only 0.12 of a module behind, sorted
  in front of some bars' splats. The paper (and Picture QR's sheet) now sits well behind.
- jsQR in Node on a big, busy picture (a 900-pixel Picture QR PNG) can take many minutes; the tests
  shrink it to phone size first.

## Known issues

- The EAN-13 quiet zones (11 and 7 modules) are as commonly cited from the GS1 General
  Specifications; GS1's pages refused our reads (HTTP 403), so the evidence file marks that claim
  "unverified".
- The picture tile flip, mid-turn, can show a tile's face in the wrong order for a frame (the same
  WebGL2 sort); it ends right.

## For the Operator

- New vendored library: ZXing for JavaScript 0.21.3 (`vendor/zxing-js/zxing.min.js`, 332 KB,
  Apache-2.0 per its LICENSE file; its package.json says MIT), loaded only when Other barcodes
  opens. Already a pinned devDependency (the scan lab's reader). Listed in LICENSES.md.
