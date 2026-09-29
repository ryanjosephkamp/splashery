# Lane Books: your book, the photo album and the picture frame

Prefix `bk`. Branch `claude/lane-books`, PR "Phase Books: your book, the photo album and the picture
frame". Owns `src/packs/pictures.js` (taken over from lane Pictures, the Picture lab included),
`assets/toys/your-book/`, `assets/toys/photo-album/`, `assets/toys/picture-frame/`,
`tests/bk.spec.mjs`, its `bk-*` screenshots, this file and its toys' lines in the shared lists. How
lanes work: [OPERATING.md](../OPERATING.md). Earlier lessons: [history.md](history.md) and
[Pictures.md](Pictures.md).

## Brief

(Written by the Operator on September 28, 2026, from the owner's notes and the Pages into Splats
plan he accepted the same day; step 3 of ROADMAP.md, "Pictures and pages")

The owner's words: "Allowing people to put the pages of a PDF, such as their own research article or
their own book or something like that, into a virtual Gaussian splat book, kind of like our
storybook, but you can actually flip every page, and each page is the proper corresponding page of
the PDF that the person uploaded." "You can configure settings about, like, what else you want to be
in the toy. Like maybe if you want, like, there to be, like, a book cover, if you want it to be a
book, or, like, a magazine, or something like that. You can maybe choose how it looks, like if it's
bound or something." "I honestly want to support, like, an arbitrary number of pages." "A scrapbook,
like a photo album. Somebody could upload, you know, a little folder or a set of their own photos,
family photos or something, put them in there, and then they have a virtual digital storybook." The
accepted plan adds a picture frame.

Build three toys on the "Pictures and pages" shelf, all `labs: true`:

1. **Your book** (`your-book`).
   - Open any PDF, of any length, and flip through it: tap for the next page, Previous and Next in
     the Toy tab. Dragging a page corner to turn it by hand is welcome if the input path allows it
     without an engine change; say which you did.
   - Every page turns like paper, with the `leaf` kind: it curls as it goes over and stays a solid
     sheet. The back of the turning page shows the next page. The first tap opens the cover.
   - A "Style" option:
     - hardcover (cloth over boards, a square spine, head and tail bands);
     - paperback (a soft cover that flexes as it opens);
     - magazine (thin, glossy, saddle-stapled);
     - stapled paper (a stack of loose sheets with a staple in the top left corner, the pages
       turning over the top edge);
     - spiral notebook (a wire coil, the pages turning about it).
   - The cover shows the PDF's first page, or a plain cover with the file's name, as fits the style.
   - The page shape follows the PDF's own page size.
   - The book opens with a sample: for now the Picture lab's article. Lane Manual (running beside
     you) writes the Tinkerer's Manual, which becomes the default later; that lane makes the
     one-line switch after you merge.
   - Pages you have not reached are never built, so a 300-page PDF is as light as a 3-page one. Test
     it.
2. **Photo album** (`photo-album`).
   - Open a set of photos (several files at once) and turn through them. Covers: leather, linen or
     scrapbook.
   - Each photo sits in four photo corners on a thick page, one or two photos per page as fits their
     shapes. A switch shows each photo's file name as a small caption.
   - The pages turn like thick card, with the `leaf` kind.
   - Samples: four to six CC0 photos (checked on the live source page and credited). No people's
     faces, no logos.
   - The engine opens one file at a time today. If an album needs "several pictures as one set of
     pages", that is a small additive "Engine: …" PR on claude/lane-books-engine. Ask the Operator
     first, as the brief below says.
3. **Picture frame** (`picture-frame`).
   - One photo in a frame hung on a nail by a wire. Frames: wood, gold (a molded frame), modern
     (thin black with a white mat) or a digital frame that steps through several photos with a soft
     fade.
   - The tap: the frame swings on its wire about the nail, as one solid piece, and settles like a
     real pendulum (about 3 s).
   - Sample: one CC0 photo (checked and credited).

For each toy: a sound (paper turning, the cover's thud, the frame's knock on the wall), a how-to
line and an About text, a toy-plan entry (`"v": "keep"` with `improved` when it's done), a
thumbnail, and clips on the Effect review page:

- `bk-book` (opening, turning pages, one style change), `bk-book-styles` (the five styles),
  `bk-book-long` (paging through a long PDF);
- `bk-album`;
- `bk-frame` (the swing), `bk-frame-digital`.

Show every clip at 390×844.

You own:

- src/packs/pictures.js, taking it over from lane Pictures (merged), including the Picture lab: keep
  it working and labs-only;
- assets/toys/your-book/, assets/toys/photo-album/ and assets/toys/picture-frame/;
- tests/bk.spec.mjs, your `bk-*` screenshots and docs/handoff/Books.md;
- your lines in the shared lists.

Lane Screens (a screen toy and the Gaussian splat toy, in src/packs/screens.js and
src/packs/splatting.js) and lane Manual (the splat equation toy and the manual) run at the same
time. Leave their files alone.

### The engine you build on (lane Pictures, PR #64, merged before you start)

Read docs/handoff/Pictures.md first, above all "Design" and "For the Operator: picture sheets". A
recipe shows a PDF, a picture, a GIF or a video on picture sheets:

- `pictures: { sample, accept }` names the media;
- `k.sheet({ id, center, width, height, normal, up, part, method, fit, align, leaf, lift, opacity })`
  places a sheet;
- `out.sheets[id] = { page, visible }` picks its page;
- `k.spine(...)`, `leaf: slot` and `out.leaves[slot] = { angle, curl }` turn and curl a page like
  paper (kind `leaf`; a leaf's sheet stays on part 0);
- `info.data.pictures` gives `page`, `count`, `kind`, `name`, `playing`, `next()`, `prev()`, `go(n)`
  and `togglePlay()`;
- the Toy tab's panel comes from `input: { title, media: { accept }, note }`.

The engine opens files and https addresses, builds each sheet in a worker, sharpens it as you zoom,
frees pages you leave, keeps video sound on the speaker button, and puts `toy.media` in links.
Budgets are per sheet and per device tier (`PICTURE_BUDGETS` in src/pictures.js). A toy that shows
three or four sheets at once shows three or four times one page's splats, so check the splat count
at each tier. The Picture lab (`src/packs/pictures.js`, labs only) is the working example.

Every new toy is `labs: true` in src/toys.js on the new "Pictures and pages" shelf (category as lane
Pictures set it up), except where this brief names another shelf. The owner turns labs on with
`?labs=1` and tries the toys on his phone. The labs switch comes off in a later small Ops change,
when he says so.

The owner's words (docs/reviews/2026-09-28-pictures/review.md, word for word): "It should all still
be Gaussian splats, like the rest of it is." "There needs to be enough resolution for it to still
resemble the original article. It doesn't have to be perfectly legible." "It's okay if we allow the
toys to be bigger than usual, possibly even larger in file size than usual, in order for the
resolution and quality to be better." Samples only under CC0, CC BY or public domain, checked on the
live source page and credited (CREDITS.md and the toy's in-app credit); no logos, brand names or
insignia. The laptop stays exactly as it is.

### How this lane runs

- The Operator session runs the lanes. The owner, Ryan, talks only to the Operator; he reviews clips
  and merges. Don't ask him anything or wait for him. Put questions and blockers in your final
  message, and the Operator answers or relays them. Messages that arrive in this session "From the
  Operator" come from the coordinator on the owner's behalf.
- Model: Opus 5.5 only, at the default effort. Any helper you start uses the same model (don't pick
  another one). Use at most one helper at a time.
- Language: every new public-facing text is in American English: toy names and descriptions, help
  texts, credits, docs, the handoff file, PR titles and bodies. So color, center, gray, math,
  license, toward, catalog, -ize endings, and dates like "September 28, 2026". Leave code
  identifiers, file names and anything stored in links as they are, and don't rewrite existing
  British text; a single sweep does that later.
- Read first:
  - CLAUDE.md (the ground rules and "Effect quality rules" are binding);
  - docs/OPERATING.md (file ownership, shared lists, generated files, tests, screenshots, the Effect
    review page and "Steps for a lane", the help review, merging);
  - docs/PACKS.md (recipes, channels, draw order, effect quality);
  - docs/handoff/Pictures.md;
  - docs/WORKSTREAMS.md and docs/handoff/history.md (lessons from earlier lanes).
- Your handoff file: create it. Start it with this brief, word for word, under "## Brief", then keep
  "## State

September 29, 2026: all three toys are built, labs only, on the "Pictures and pages" shelf, with
their sounds, help texts, plan entries (`"v": "keep"`), credits and tests. The engine changes they
need are on `claude/lane-books-engine` (its own draft PR, to merge first); `claude/lane-books`
carries them too until then.

- **Your book** (`your-book`): opens the sample article (Lane Manual switches it to the Tinkerer's
  Manual after this merges), or any PDF from a file or an https address. A tap opens the cover, then
  turns one leaf at a time (about 1 s); at the end a tap closes the book. Previous and Next in the
  Toy tab step a spread; a link's page (or any jump) opens the spread with that page. Five styles:
  hardcover (cloth boards, a square spine, head and tail bands, the first page as a panel on the
  cover), paperback (a card cover that flexes), magazine (thin, a flexing cover, two staples in the
  fold), stapled paper (one page a sheet, a staple in the corner, the sheets flip over the top) and
  spiral notebook (a wire coil). The page shape follows the PDF's first page.
- **Photo album** (`photo-album`): six CC0 sample photos; open several of your own at once. Leather,
  linen or scrapbook covers; thick card pages; each side holds one photo, or two wide ones stacked
  or two tall ones side by side; photo corners and (a switch) the file name as a caption.
- **Picture frame** (`picture-frame`): a CC0 photo on a wall, hung from a nail by a wire; wood,
  gold, modern (with a mat) or digital (steps through a set of photos with a fade to black). A tap
  swings the frame as a damped pendulum (3 s).
- Turning pages by dragging a corner is not built (see "What was cut" in the PR): the tap, Previous
  and Next turn the pages.

## Notes

### How the book works

- The book stands facing you, its spine up the middle (`k.spine` along -Y, so a leaf turns toward
  the viewer), and slides to the middle while closed (`out.body`).
- Leaves cycle through four leaf slots. Leaf j (j >= 1) carries pages 2j - 1 (front) and 2j (back)
  in slot j % 4, each a picture sheet on that leaf; page 0 is the front cover's. On spread K only
  the left page (leaf K - 1's back) and the right page (leaf K's front) show; the pages the next
  turn and the turn back need are asked for hidden with `ahead`, and a turn waits (up to 1.5 s)
  until `pics.ready()` says its pages are built, so it never shows a blank or an old page.
- The cover is a board that turns as one piece (a part) for the hardcover, or a card on leaf slot 8
  that flexes (its kit splats use the `leaf` kind too, with their distance from the spine in toy
  units: the recipe fixes the fit with a box of reach points so it knows the fit's scale).
- Draw order: splats sort in the pose they were built in, so everything that turns over drew inside
  out (the cover over the left page, a leaf's front over its back, the page under a turning leaf
  through it). The engine's `out.resortPose` sorts the parts' and leaves' splats where they stand;
  the book asks for it every second frame while something turns and for three frames after it lands.
- Layers sit well apart (pages 0.003 off the leaf's middle, the cover 0.014 above, the page blocks'
  tops 0.014 below): splats sort by their centers, so a page too close over a surface with big
  splats mixes with it where the view is tilted (it showed as diagonal stripes on the hardcover's
  panel).
- The left page block appears under the first page as it lands and goes as that page lifts off; in a
  close it swings over with the cover (riding the cover's free edge, so a flexing cover stays
  outside it).
- Splats on show: two pages at rest, four while a leaf turns, plus the kit (about 50k at "mid"). A
  whole spread on a 390-wide phone builds each page at about 362 to 512 px wide (30k to 60k splats a
  page for the sample).

### The album and the frame

- The album shares the book's leaves (`BOOK.sides`: the photos on each side of each leaf) and its
  own sheets per side: five boxes (one, top, under, left, right) on each side of each slot. The
  photo corners and captions are drawn on each photo before it becomes splats (`pictures.decorate`),
  since a slot shows a different photo each time it comes round; the mount is drawn in the card's
  own lit color, so it doesn't show.
- The frame is one part (frame, photo sheet, wire and shadow) turning about the nail in the wall's
  plane, so no re-sort is needed. The digital frame's fade is a black layer on channel 0 (`fade`
  kind with a negative width).

### Tools

- `tools/bk-samples.mjs` makes the fixtures in `tests/fixtures/bk/` (3 and 300 numbered pages, wide
  slides, a 12-page booklet about books) from our own text.
- `tools/bk-clip.mjs` records the review clips at 390x844 with the clock stepped by hand (each step
  waits for the pages it shows).
- With the clock frozen at the test's default viewport, the app may draw no frames at all; the
  frame's test runs in real time on the player's clock instead.

## Known issues

- Early in a turn, a thin band of the page underneath can show through the turning page next to the
  spine (both are close together there, and the ink sits in front of its paper). The page underneath
  shows from about a quarter of the way through the turn; before that its margin is blank paper
  anyway.
- A page with a much finer build than the screen (zoomed out after zooming in) is rebuilt after a
  quarter second, as in the Picture lab.
- The left page block is a fixed thickness (it doesn't grow as you read).
- The rig test in `tests/smoke.spec.mjs` (line 730) fails on main too (the same numbers); not this
  lane's.

## For the Operator

### The engine PR (`claude/lane-books-engine`, "Engine: …")

Started without an answer, because the book could not work without it (the draw order), and told in
the final message. It is additive, and every other toy behaves as before:

1. `k.media`: a picture toy's media opens before its build (`Player.pictureMediaFor`), so the build
   sees `{ kind, count, name, aspect, aspects, names }` (null in the Node tools). One open is shared
   with `startPictures`; a failed open is said once and retried on the next build.
2. Sets of pictures: `input.media.multiple` (and `button`) in a recipe's panel; `openMedia(list)` in
   `src/media.js` (`kind: "image"`, `count`, `names`, `aspect(i)`, `size(i)`, `draw(i)`; decoded on
   demand, two at a time); `toy.media.files` in scenes (settings only, like `file`;
   docs/SCENE-SCHEMA.md); `pictures.sample` may return a list; Previous and Next page through a set.
3. `out.sheets[id] = { page, visible: 0, ahead: 1 }` builds a hidden sheet's page after the ones on
   show; `pics.ready(id)`, `pics.aspect(n)` and `pics.nameOf(n)` in `info.data.pictures`.
4. `out.resortPose` (src/pose.js): sorts the kit's splats on parts and leaves, and the picture
   sheets on them, where they stand now; a page rebuilt on a leaf or a part is re-sorted by itself.
5. `pictures.decorate(canvas, { page, name, sheet, kind, options })`: a recipe draws on a page or
   picture before it becomes splats.
6. Two fixes: the Toy tab's picture panel refreshes once it is in the page (it could stay blank);
   flat colored areas of a PDF page (a chart's bars) kept a NaN paper color and drew black.

### For PACKS.md (picture sheets)

- A book's pages: use the leaf slots as a ring (four is enough) and `ahead` for the pages the next
  turn needs; wait for `pics.ready` before a turn starts.
- Anything turned more than a quarter turn (a leaf, a cover on a part) needs `out.resortPose` while
  it turns and once it lands (draw order rule 1 applies to picture sheets too).
- Kit splats can ride a leaf (`kind: "leaf"`, params
  `[distance from the spine in toy units, slot]`); fix the fit with reach points to know the toy
  units at build time.
- Keep layers at least about 0.01 of the toy apart where big splats lie under a picture sheet.

### For the backlog

- Turning a page by dragging its corner (the input path would need a drag that feeds a leaf's angle;
  `drag` in a recipe could do it without an engine change, but it needs its own design with the
  ready-check and the re-sort).
- A left page block that grows as you read (a part per few leaves).
- A plain cover with the file's name for the hardcover and the spiral (the name is in `k.media` now;
  it needs a small pixel font in the kit).
