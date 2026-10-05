# Lane PDF lab: export a toy as a PDF, and what a PDF can do (prefix `pdf`)

## Brief

You are a Splashery worker session, started by the Operator (the coordinating session) for the
October push. Repo: ryanjosephkamp/splashery. Your lane: PDF lab (id `PDFLab`, prefix `pdf`).
Branch: `claude/lane-pdf-lab` (and `claude/lane-pdf-lab-engine` for any change to the app outside
your own files, as an "Engine: …" PR merged first). PR title: "Phase PDF lab: export a toy as a PDF,
and what a PDF can do". Handoff file: docs/handoff/PDFLab.md (create it; start it with this brief,
word for word, under "## Brief", then keep "## State

READY (October 5, 2026, 09:20 UTC): everything in the brief is built and tested; main merged into
both branches. Engine PR #299 (the Save PDF row) must merge first; the lane PR #301 contains it.
Clips on Effect review page 2 (cards `pdf-grapes-flipbook` and `pdf-dialog`, lane `PDFLab`; the
lane record is the Operator's to make); no marks yet. The playback test now waits for PDF.js's
scripting sandbox before pressing buttons (it raced once after the merge).

## What was built

- **Save PDF** (Share tab, labs only; engine PR #299 adds the row and `app.openPdfExport()`, which
  imports `src/pdf-export/index.js` on the tap). The dialog offers:
  - **Still + live toy** (default): page 1 with a 1080-pixel still at the current camera and
    settings, the toy's name and shelf, how-to line, About text, credits and licenses (the toy's
    scan credit, a data recipe's credits, recorded sound samples, a flag), a clickable link and a
    vector QR code to this scene (`buildShareHash` and `shareURL`, the app's own link). Before
    writing, the QR is drawn and read back with the vendored jsQR (`checkQR`); no PDF is made if it
    doesn't read back as the link.
  - **Moving recording (desktop Firefox and Acrobat)**: page 1 as above, then page 2 with one tap
    recorded on a stepped clock (a short lead-in, the tap, a toggle switched on and off again,
    frames until it settles or the chosen longest length) and played by the `animate` widget method:
    one hidden push button per frame, shown one at a time by the PDF's JavaScript on
    `app.setInterval`. Buttons: first, step back, play/pause, step forward, last; tapping the
    picture plays or pauses; a "Picture n of N" counter; the timer stops when the page is left.
    Choices: picture size (320, 420 or 540 px), pictures a second (8, 12 or 15) and longest length
    (4, 6 or 10 s). The dialog shows "About … at most" before saving, from one frame at that size.
  - Saving: the browser's file picker where it has one (`showSaveFilePicker`, asked first while the
    tap still counts), otherwise a download like the other exports.
- **pdf-lib 1.17.1** (MIT) vendored in `vendor/pdf-lib/` and listed in LICENSES.md; loaded only when
  a PDF is made.
- **The explainer**: `pdf-lab/index.html` (linked from the dialog): the short answer, how to make
  one, two samples made by the exporter from the real grapes (`pdf-lab/samples/`, 80 KB and 627 KB),
  the eight Codex samples (linked in place in `docs/audits/pdf-motion-2026-10/`), the viewer table
  as the report observed it, and what to try on each device.
- **Tools**: `tools/pdf-samples.mjs` (remakes the samples from the app), `tools/pdf-clip.mjs` (a
  phone-size clip of the flip book playing in PDF.js with scripting, and screenshots of the pages).
- **Tests**: `tests/pdf-engine.spec.mjs` (the row; on the engine branch) and `tests/pdf.spec.mjs` (8
  tests; see Notes).

## Reuse: a catalog of every toy, one page each (for the Toy pages lane)

Everything that writes the page is plain data in, bytes out, and runs in Node or a browser:

```js
import { toyEntry } from "./src/pdf-export/entry.js";
import { buildCatalogPDF, buildToyPDF } from "./src/pdf-export/pdf.js";

// still: the toy's picture as JPEG or PNG bytes ({ bytes: Uint8Array, type: "jpeg" | "png" }).
const entry = await toyEntry("grapes", { still });
const one = await buildToyPDF(entry); // one toy, one page
const book = await buildCatalogPDF([entry, ...more], { title: "Splashery: the toys" });
```

- `toyEntry(id, { still, url, base, date })` reads the name, shelf, how-to line and About text
  (`src/toy-help.js`), the scan credit (`src/toys.js`) and makes a link to the toy on the live site
  with its own starting camera (`toyLink`). Pass `url` to use another link, `base` for another site.
- Stills: thumbnails are WebP, which a PDF can't hold; capture a JPEG per toy (the app's
  `captureStill(app)` in `src/pdf-export/capture.js`, or `stage.captureFrame()` and `toBlob` as
  `tools/pdf-samples.mjs` does), one toy at a time.
- The entry is plain data: add lines to `credits` or `notes` before building (the app adds sound and
  flag credits that only it knows). The page layout is `addToyPage(doc, fonts, entry)` if a catalog
  wants its own cover or order.
- A recording for a catalog: `addRecordingPage(doc, fonts, entry, recording)` exists, but a page of
  frames per toy multiplies the size by about 0.5 MB a toy; the report advises a still catalog
  first.

## Notes

- Why the flip book works: PDF.js (Firefox) runs every PDF action with a global `eval`, so the
  `sp_*` functions set up by the page-open script stay there for the buttons; each button also
  carries the set-up script, so the order of events doesn't matter. Like `animate`, each frame
  button needs an action (`/A /ResetForm`): PDF.js skips push buttons that have none.
- Evidence for "plays": `tests/pdf.spec.mjs` opens the flip book in the PDF.js 6.3.289 viewer with
  its scripting sandbox (pdfjs-dist, a new pinned devDependency; the same version as
  `vendor/pdfjs/`) and presses first, step, last, play, pause and the picture. That is Firefox's
  engine in a test browser, not Firefox, and nothing here was tried in Acrobat.
- The recording test checks: the tap's frames are fewer than or equal to the estimate's, the file is
  no bigger than the still-only file plus the estimate, the grapes settle within 6 seconds, the
  frames differ, page 2 has one frame field per frame with only the first shown, and its words say
  it's a recording.
- Text is set in the standard Helvetica fonts (Windows-1252 only): arrows, Greek letters and the
  like get a plain stand-in (`makeSafe` in `pdf.js`).
- During a recording the toy's tap sound plays once, as when tapped.

## Known issues

- Acrobat (desktop and mobile), Preview, Chrome, Foxit and the rest are untested with our own flip
  book; the report's table and the owner's tests decide. Chrome and Preview showed `animate`'s
  sample still, so expect the first picture there.
- The scene link is long (about 700 characters), so the QR code is dense (version 17 or so, about
  0.6 mm modules at its printed size). It reads back with jsQR from the drawn code and from a render
  of the page; a phone camera scan of a printed page is untested.
- A toy that moves by itself (a song, a spinning move) never settles, so its recording stops at the
  longest length.

## For the Operator

- Merge order: #299 (engine) first, then this lane's PR. Both are labs only.
- New devDependency: `pdfjs-dist@6.3.289` (tests and `tools/pdf-clip.mjs`; listed in LICENSES.md).
  It pulls an optional native canvas package that `npm ci` installs for the platform; the playback
  test skips itself when pdfjs-dist is missing.
- Owner tests worth asking for: `pdf-lab/samples/grapes-moving.pdf` in Adobe Acrobat Reader on a
  computer (does page 2 play?), and a phone scan of `grapes-still.pdf`'s QR code.
