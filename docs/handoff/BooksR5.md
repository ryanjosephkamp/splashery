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
- Your handoff file: start it with this brief, word for word, under "## Brief", then keep "## State

October 3, 2026 (Opus 5.5).

- **Engine PR** (`claude/lane-books-r5-engine`, "Engine: links and figure boxes from PDF pages"),
  small and additive, with `tests/bk5-engine.spec.mjs`:
  - `src/media.js`: a PDF's `m.links(i)` (web links, only `http:`, `https:` and `mailto:` through
    `safeLinkURL`; links to another page: explicit and named destinations and the first, last, next
    and previous page) and `m.figures(i)` (the boxes its pictures are painted in, from the operator
    list's image paints and transforms; touching boxes joined, tiny ones and full-page scans
    dropped). `m.draw(i, w, h, region)` draws part of a PDF page or a picture.
  - `src/pictures.js`: `pics.links(n)`, `pics.figures(n)`, `pics.crop(n, box, size)` and
    `pics.openLink(url)`. A sheet may show part of its page (`out.sheets[id].crop`, placed where
    that part lies), raised by a relief map (`out.sheets[id].relief = { key, w, h, d, depth }`), and
    a page may be drawn another way by the recipe's decorate (`out.sheets[id].variant`; decorate
    also gets the page's `links`). Plain sheets keep their keys, so nothing else changes.
  - `src/picture-splats.js`: `job.relief` raises each splat toward the sheet's facing; the base
    takes the lowest relief round it, so it never stands in front of the detail.
  - `src/ui.js`, `src/app.js`, `styles.css`: a link asks first ("Open example.org?" with the full
    address); Open is a real link with `target="_blank"` and `rel="noopener noreferrer"`.
  - The test PDF is made by `tests/fixtures/bk5/make-pdf.mjs` (no outside files).
- **Toy PR** (`claude/lane-books-r5`, "Phase Books r5: PDF links and figures that pop out"), on top
  of the engine PR, in `src/packs/pictures.js` (Your book and the Photo album, both labs only):
  - **Links.** A tap on a link of a page lying open follows it: a web link shows "Open example.org?"
    with the full address, and Open is a real link (new tab, `noopener noreferrer`); a link to
    another page turns the book there (the next spread turns; a farther page opens at once). A
    `javascript:` (or any other unsafe) link is no link: the tap turns the page as usual. The tap
    test uses the page's own place at rest (fitted to its shape and aligned to the spine, as the
    sheets are), with a little slack round each box; links are not hit while a page turns. Each
    page's links show a faint blue tint with an underline (`bookDecorate`), not on the cover.
  - **Pop out** (a Toy tab switch on both toys). The figure on the page in view rises toward the
    reader as one solid piece (0.95 s, a little overshoot), grows up to 1.3 times, moves a third of
    the way toward the middle of the view, turns toward it (up to about 18 degrees) and tilts back a
    little, then sways a few times and holds. The page under it is drawn again with the figure's
    place empty and a soft shadow (variant `hole:…`; the album keeps the empty photo corners). A tap
    on the book, or the switch, lays it back (0.7 s); a tap on another figure (the album's other
    photo) lays the first back and raises that one. A page turn puts it back at once.
    - Which figure: the biggest picture box on the page in view (the page in focus, else the right
      then the left) from `pics.figures`; the album's photo on the page in view; or a drawn box.
    - **Depth**: a photo (an album photo, or a PDF picture without a plain background) gets its
      depth from the Photo to 3D depth model (`photo-3d-depth.js`'s `estimateDepth` and
      `photo-3d-core.js`'s `normalizeDepth`, imported unchanged), loaded on the first pop; until the
      depth comes it rises as a flat card, then the raised version swaps in. Relief: a fifth of the
      figure's shorter side.
    - **Layered lift**: a graphic (a chart, a diagram, text: much of it the color of its border)
      rises as a card with its strongest shapes (more than 70 levels from the background, grown a
      pixel and softened) raised by about 4.5% of its shorter side.
  - **Draw a box** (a Toy tab switch on Your book): a drag on a page draws a box (four blue corners)
    instead of pulling the page; letting go raises what is inside it (as a graphic or a photo, by
    the same test).
  - Help texts (how-to and About) and plan entries updated for both toys; TOY-PLAN.md regenerated.
  - Tests: `tests/bk5.spec.mjs` (four in Node with stand-in pictures, four in the app: the links, a
    PDF picture and an album photo popping out with their depth and lying back, old links and a v2
    scene). Screenshots `bk5-link-*`, `bk5-pop-*`, `bk5-album-pop-*` at both sizes.
  - Clips: `tools/bk5-clip.mjs` (a copy of lane Books' recorder with this lane's scenes, so
    `tools/bk-clip.mjs` is untouched).

## Notes

- Kit splats on a part are sorted where they were built: the box's corners are built in front of the
  page and the recipe asks for `out.resortPose` while a box is drawn (they hid behind the page at
  the spine otherwise). The pop sheet is resorted on every second frame while it moves.
- The depth model runs on this device in about 4 s here (SwiftShader, one thread), after its 27 MB
  first load.

## Known issues

- Links on the first page don't work: a side-bound book shows it only on its cover, where a tap
  opens the book (stapled paper shows it as a page, and its links work).
- The figures found are pictures (images in the PDF). Vector plots and diagrams need Draw a box.
- A photo waits at rest (it looks just like the page) up to 2.5 s for its depth, so it rises with
  it; on the first pop, while the 27 MB model loads, it can rise flat and gain its depth in one
  step.

## For the Operator

- PACKS.md (5b, picture sheets): `pics.links(n)`, `pics.figures(n)`, `pics.crop(n, box, size)`,
  `pics.openLink(url)`; `out.sheets[id].crop`, `.relief` and `.variant`; decorate's `variant` and
  `links`. A lesson: kit splats on a part are sorted where they were built, so marks that move over
  a page are built in front of it and resorted while they move.
- Sounds: the pop-out's cues are in the recipe (`POP_SOUNDS`: a light page lift as it rises, a soft
  thud as it lies back), from the existing `pageflip` and `thud` voices.
