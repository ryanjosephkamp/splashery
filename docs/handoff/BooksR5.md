# Lane Books r5: PDF links and figures that pop out (prefix `bk5`)

## Brief

You are a Splashery worker session, started by the Operator (the coordinating session). Repo:
ryanjosephkamp/splashery. Your lane: Books r5, "PDF links and figures that pop out" (prefix `bk5`).
Branches: `claude/lane-books-r5-engine` (the picture engine change, merged first) and
`claude/lane-books-r5` (the toys). PR titles: "Engine: links and figure boxes from PDF pages" (or
what the engine PR turns out to be) and "Phase Books r5: PDF links and figures that pop out".
Handoff file: docs/handoff/BooksR5.md. Model: Opus 5.5.

### Brief (written by the Operator on October 3, 2026, from the owner's answers that day)

The book and album toys (Your book, the Photo album, the Picture frame; `src/packs/pictures.js` and
the picture engine in `src/media.js`, `src/pictures.js`, `src/picture-splats.js`,
`src/pictures-worker.js`, with PDF.js in `vendor/pdfjs/`) show a PDF's pages or a person's photos as
splats. The owner likes them: what's on the pages "displays basically perfectly". Two additions,
both behind the labs switch first:

1. **Links in a PDF work** (the owner: "yes, labs first"). PDF.js reads each page's link annotations
   (`page.getAnnotations()`, subtype `Link`, with a `url` or a destination and a `rect`). When a
   reader taps a page, check whether the tap lands inside a link's box (map the page's PDF
   coordinates to where that page sits on the splat sheet, including the page curl and the reading
   mode). For a web link, show a small confirm with the address ("Open example.org?") and open it in
   a new tab with `noopener`; only `http:`, `https:` and `mailto:` addresses, never `javascript:` or
   file links. For a link to another page of the same document, turn the book to that page. A faint
   underline or glow on link boxes while the book is open is a nice touch if it reads well at phone
   size. The PDF never leaves the device.
2. **Figures and photos pop out in 3D** (the owner's idea of October 3, 2026: "a button that the
   user can click or tap to make the figures … or images within a PDF, or the photos in a photo
   album, pop up from the page seamlessly in 3D … strictly optional"). A "Pop out" button (in the
   Toy tab, and on the page itself if it reads well) lifts the figure or photo off the page as a
   depth splat that rises and turns toward the reader, and a second tap lays it back flat. Find the
   figures: for photos in the album the photo is known; for a PDF, find the image boxes from
   PDF.js's operator list (the image paint operators and their transforms), and let the reader drag
   a box around anything else (a vector plot, a diagram). For the depth, reuse the Photo to 3D
   pipeline (`src/packs/photo-3d-depth.js`, `src/packs/photo-3d-core.js`; Depth Anything V2 Small
   through ONNX Runtime Web, both vendored and loaded only on first use). Import those modules; if
   they need a change, say so in your message first, since the Photo to 3D lane owns them. For flat
   graphics (plots, diagrams, text) a depth model guesses badly, so give those a clean layered lift
   instead (the figure as a card that rises with a soft shadow, with its strongest shapes a little
   in front), and say which you used for what. The whole effect must follow the effect rules: the
   figure moves as a solid piece, no warped picture, and it reads at phone size.

#### What to deliver

- The engine PR first (small and additive: link boxes and figure boxes per page from the picture
  engine, with tests), then the toy PR. Tests in `tests/bk5*.spec.mjs`: a test PDF with a web link
  and an internal link (make it with a script, no outside files), a tap on each, the confirm, the
  page turn, `javascript:` refused; a pop-out and lay-back on an album photo and on a PDF image; old
  `#s=` links and saved scenes still load.
- Clips at phone size (`tools/effect-clip.mjs` or the book clip tool) on the Effect review page:
  tapping a link, the confirm, a page jump, a photo popping out and back, a PDF figure popping out.
- How-to and About texts updated for the toys you change.

#### You own

- The link and figure-box additions in the picture engine (through the engine PR only), the book and
  album toys' recipes in `src/packs/pictures.js` for these features, `tests/bk5*.spec.mjs`, your
  screenshots, your toys' entries in the shared lists, and this handoff file.

Many lanes run at the same time (Fidelity, Photoreal r2, Sharpness A and B, Physics, Live input,
Fluids, UI r5, Fix7 and the Integrators); you don't touch their files. Sharpness A has a storybook
PR (#202) on the Storybook toy (`book`, the kit's closed book), which is a different toy from Your
book; check its diff so you don't collide.

#### How this lane runs

- The Operator session runs the lanes. The owner, Ryan, talks only to the Operator. Don't ask him
  anything or wait for him. Put questions and blockers in your final message ("READY:", "WORKING:"
  or "BLOCKED:"), and the Operator answers or relays them. Messages that arrive "From the Operator"
  come from the coordinator on the owner's behalf.
- Model: Opus 5.5 only, at the default effort. Any helper you start uses the same model. Use at most
  one helper at a time.
- Merging: the engine PR merges after a full test run; the features stay behind the labs switch, so
  the Operator merges them after the full run too, and the owner decides when they go public. Never
  merge anything yourself.
- Language: every new text is in American English (color, center, gray, license, toward, -ize
  endings, dates like "October 3, 2026").
- Read first: CLAUDE.md, docs/OPERATING.md ("Steps for a lane"), docs/PACKS.md (the picture and book
  sections, and "Effect quality"), and the earlier Books handoff files in `docs/handoff/`.
- Your handoff file: start it with this brief, word for word, under "## Brief", then keep "## State"
  current.
- Before every push: CLAUDE.md, "Before every push".

## State

Starting, October 3, 2026.
