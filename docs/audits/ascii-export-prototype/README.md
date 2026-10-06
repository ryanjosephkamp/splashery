# Deterministic ASCII export prototype

Codex built this package with GPT-6.1 Sol at Extra High effort. October 6, 2026. Branch:
`codex/ascii-export-prototype`, cut from main at `dc03d880ef9425eba71ee5dc5f0f97c79ec3d15d`.

The package turns RGBA image frames into plain characters and demonstrates recorded toy motion. It
needs no AI model, third-party runtime library, engine import, or remote service. It changes only
`src/export/ascii.js`, `tests/ascii-export.spec.js`, and this audit directory. The existing export
menu has no changes. PDF and text QR experiments are separate.

## Try the demo

Serve the repository on an unused local port, then open the demo:

```sh
python3 -m http.server 47832 --bind 127.0.0.1
# http://127.0.0.1:47832/docs/audits/ascii-export-prototype/
```

Choose an example, adjust detail or contrast, and press Play. Playback starts only on a tap, and
pauses when the page becomes hidden. Scrub or Reset to inspect individual frames. Color changes the
canvas presentation without changing the text. Save text, JSON, or a PNG from the current settings;
the text and JSON exports retain source credit. Plain text is also selectable without using the
Clipboard API.

The GIF and MP4 links download the original fixed 96-column monochrome clips. They do **not**
reflect the live controls. Those files are preserved from the earlier prototype, with compact
attribution on their frames; full provenance and modification notes are in `samples.json` and below.
This package does not encode new GIFs or videos.

For one self-contained offline HTML file, choose a new output path:

```sh
node docs/audits/ascii-export-prototype/build-handback.mjs /tmp/ascii-demo.html
```

The script embeds the exact core, demo, metadata, and sample bytes; it refuses to overwrite an
existing file. Open the result directly in a browser. No installation is needed. The modular
repository demo needs HTTP; the generated handback needs no sibling files or network requests.
Mobile browser file-opening and download behavior still needs device review.

## Core contract

```js
import { pixelsToText, renderTextCanvas } from "./src/export/ascii.js";

const frame = pixelsToText(imageData, {
  columns: 96,
  characterAspect: 0.5, // Glyph advance divided by line height.
});
const plainText = frame.rows.join("\n");
renderTextCanvas(canvas, frame, { color: false, footer: ["Source credit"] });
```

`pixelsToText` is a pure function. It accepts `{ data, width, height }`, where `data` is a
`Uint8Array` or `Uint8ClampedArray` containing exactly four bytes per pixel in RGBA order.
Dimensions are positive integers, each at most 4096. It does not mutate the input.

Each output cell uses an exact area-weighted average of its source pixels, including fractional
edges. Alpha composites onto the configured RGB background before brightness conversion. The
brightness weights are 0.2126 red, 0.7152 green, and 0.0722 blue. After subtracting `blackPoint`,
contrast scales the normalized value, the value is clamped to 0–1, and gamma adjusts it. The result
picks one character from the supplied dark-to-light palette. This is arithmetic over encoded RGB
bytes, not a color-managed or linear-light calculation.

| Option            | Default        | Contract                                         |
| ----------------- | -------------- | ------------------------------------------------ |
| `columns`         | 96             | Finite number, rounded to 8–200 columns          |
| `rows`            | Derived        | Finite number, rounded to 4–200 rows if supplied |
| `characterAspect` | 0.5            | Positive finite glyph advance / line height      |
| `palette`         | ` .:-=+*#%@`   | 2–64 printable ASCII characters, dark to light   |
| `contrast`        | 1.3            | Positive finite number                           |
| `gamma`           | 0.7            | Positive finite number                           |
| `blackPoint`      | 17             | Finite number from 0 through less than 255       |
| `background`      | `[17, 17, 17]` | Three finite RGB components from 0 through 255   |

Derived rows are `round(columns × imageHeight / imageWidth × characterAspect)`. If that exceeds the
bounds, reduce the columns or choose explicit rows; an explicit row count can distort the shape. The
function returns `rows`, packed RGB `colors`, `columns`, `rowCount`, `characterAspect`, and
`palette`. It returns no HTML, ANSI escapes, or Unicode drawing glyphs. The palette order is
supplied by the caller; glyph darkness is not automatically calibrated.

`renderTextCanvas` is a separate browser helper. It measures a monospace glyph advance, paints on a
dark background, and returns the measured aspect. Use that aspect when converting matching frames.
Its default is bold 10-pixel Courier New with a monospace fallback and a 12-pixel line height. It
bounds frames, font size, footer count, and total canvas pixels, and widens the canvas when needed
to fit the footer. The font is referenced from the device, not redistributed. Its canvas pixels can
differ with installed fonts; the pure core's rows are deterministic for identical RGBA bytes and
options. JPEG decoding can also differ between browsers.

## Recorded examples and credits

These captures predate this package. They are not evidence that current main's live toys were
recaptured or that every toy is suitable for ASCII. Source capture metadata is retained in
`samples.json`; sample SHA-256 hashes are in `samples-manifest.json`.

| Example    | Capture revision | Source frames | Rate   | Duration    | Source                   |
| ---------- | ---------------- | ------------- | ------ | ----------- | ------------------------ |
| Grapes     | `19f8d720`       | 40            | 8 fps  | 5 seconds   | Procedural Splashery toy |
| Orange     | `f95ceca3`       | 36            | 10 fps | 3.6 seconds | Procedural Splashery toy |
| Strawberry | `f95ceca3`       | 36            | 10 fps | 3.6 seconds | Licensed captured toy    |

The original local exploration and its ZIP are preserved outside this repository. Grapes use the
earlier audit's capture; orange and strawberry use the subsequent local captures. All frames have a
fixed camera and 420 × 420 source pixels. The packaged images and media were copied byte for byte;
no source toy, engine, or asset was edited.

**Strawberry** by Dany Bittel, from the [source scene](https://superspl.at/scene/84df8849), under
[CC BY 4.0](https://creativecommons.org/licenses/by/4.0/). Both links were opened and the live
source license checked on October 6, 2026. The source asset already has an entry in the repository's
`CREDITS.md`. Splashery converted and decimated the splats, removed SH, and recentered and scaled
them. The earlier exploration made a fixed-view capture, downsampled it, and converted it to
characters. This package reuses those image and character derivatives and reconverts the images in
the demo. The derivatives retain CC BY 4.0. The code follows the repository's MIT license.

Grapes read clearly as a bunch that breaks apart, and orange wedges keep recognizable motion. The
strawberry's silhouette survives better than its small seeds and subtle surface texture. Color
helps, but fine detail remains a limitation. Those are visual assessments of these examples.

## Verification and next integration boundary

Run the requested `.spec.js` file using the scoped config. The shared repository config only
discovers `.spec.mjs`; it remains unchanged. Pick an unused port. This config refuses to reuse
another lane's server.

```sh
SPLASHERY_PORT=47832 \
SPLASHERY_CHROMIUM="/Applications/Google Chrome.app/Contents/MacOS/Google Chrome" \
npx playwright test tests/ascii-export.spec.js \
  --config=docs/audits/ascii-export-prototype/playwright.config.js
npx prettier --check .
node tools/us-english.mjs --diff
```

The tests check known brightness endpoints, transparency, fractional area averages, shape, printable
rows, repeatability, input preservation and rejection bounds. Browser checks exercise canvas
geometry and credit fitting, playback, reset, scrubbing, color, detail, all three samples,
text/JSON/PNG exports, quick sample switching, desktop/mobile layout, and an offline single-file
handback. Receipts and screenshots are in `evidence/`. Browser automation at phone dimensions does
not establish physical-phone acceptance. The full toy/engine suite is outside this package's
verification and was not run.

A later integration can call the pure converter on each captured RGBA frame, retain the timing and
credits, then pass the rendered canvas frames to an encoder. Its adapter must own capture
scheduling, camera/state restoration, cancellation, bounds, and privacy for user inputs. That
adapter, media encoders, export-menu wiring, PDF work, and text QR work are not implemented here.
