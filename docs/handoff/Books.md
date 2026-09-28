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
  "## State", "## Notes", "## Known issues" and "## For the Operator" current, like the other lanes'
  files.
- Shared lists: edit only your own toys' entries in src/toys.js, src/toy-sounds.js, src/toy-help.js
  (a how-to line and an About text for each toy, following the style guide in docs/handoff/Help.md),
  tools/toy-plan.json, CREDITS.md and tools/assets.json. Regenerate docs/TOY-PLAN.md with
  `node tools/toy-plan.mjs`; never merge it by hand (on a conflict, take main's copy and run the
  tool again).
- Never edit tests/taps.spec.mjs. If one of your toys needs an exception there, say so in your final
  message, and the Operator adds it. Your own tests go in tests/<prefix>.spec.mjs.
- Engine changes: if you truly need one (media, pictures, player, stage, effects, kit, UI), keep it
  small, additive and tested, on its own branch (<your branch>-engine) with its own draft PR titled
  "Engine: …", which merges first. Say so in your final message. Two other picture lanes run beside
  you, so tell the Operator before you start one, in case another lane needs the same thing.
- Sounds: give each toy the sound its idea describes (src/toy-sounds.js, existing voices in
  src/voices.js). Don't polish them: the new toys get their own sound round later, and sound lanes
  may be editing other toys' lines at the same time (keep both sides when you merge).
- Review: post a clip of every toy's tap and its main play to the Effect review page,
  https://claude.ai/artifact/NCsg9V5SzFY3Mnwuwgq7pi, as OPERATING.md's "Steps for a lane" says. The
  Operator has made your lane's record. tools/pic-clip.mjs records picture toys. Judge every effect
  as motion at phone size against the effect quality rules before you post it. Don't republish the
  page, and never write to "verdicts".
- Before every push, follow "Before every push" in CLAUDE.md:
  - the full Playwright suite (SPLASHERY_CHROMIUM=/opt/pw-browsers/chromium npx playwright test);
  - prettier and `node tools/us-english.mjs --diff`;
  - `node tools/check-packs.mjs <pack>`, a contact sheet and thumbnails;
  - your own screenshots at 390×844 and 1440×900.

  Then put back the standard screenshots (`node tools/upkeep.mjs --restore-shots`) and any other
  lane's screenshots your branch didn't change (`git checkout -- tests/screenshots/`, then re-add
  your own).

- PR: one draft PR against main with the five sections (Summary, Verification, Deviations, Known
  issues, What was cut). Never merge anything. When main moves, merge it into your branch (never
  rebase a pushed branch).
- After you post your cards, check the owner's marks (the "verdicts" collection, ids starting with
  your prefix) about once an hour with a scheduled check-in (send_later). Fix every "fix" in the
  same PR, post the new clip as a "-r2" card, and set replacedBy on the old one. Stop the check-ins
  once your PR is merged or closed.
- Finish every working turn with a short final message that starts with "READY:" (PR link, card ids,
  test results, anything for the Operator), "WORKING:" (what's left), or "BLOCKED:" (exactly what
  you need).

Start now: read the docs and the Picture lab recipe, create docs/handoff/Books.md, open your draft
PR early, then build the book first (it is the owner's main ask), then the album and the frame. Post
clips as you finish each toy. When all three are done and the checks pass, finish with "READY:".

## State

September 28, 2026: lane started. Docs and the picture engine read; the book's design is below
(Notes); an engine proposal is under "For the Operator". Nothing built yet.

## Notes

### The book's design (first plan)

- The book stands facing the viewer, the spine up the middle (`k.spine` along Y), so a spread reads
  face-on at phone size; the closed book slides to the middle (`out.body`) and slides back as it
  opens.
- Leaves cycle through four leaf slots, each a front and a back sheet. At rest on a spread only the
  two open pages show; the pages a turn will uncover (the back of the right-hand leaf and the page
  under it, and the same for a turn back) are built ahead, hidden, so a turn never waits for a build
  and never shows a stale page.
- Tap, Next and Previous turn one leaf (two pages); the Toy tab's page buttons step the spread, not
  single pages. At the end, a tap closes the book.

## Known issues

(None yet.)

## For the Operator

### Engine proposal (not started: waiting for a go-ahead)

A small additive "Engine: …" PR on `claude/lane-books-engine`, for all three toys. The book can be
built without it for the sample's page shape, but three things need it:

1. **The page shape at build.** The book's covers, boards and page edges are kit splats built before
   the PDF opens, so a book can't follow the PDF's own page size (A4, Letter, slides) without it.
   Proposal: a picture toy's media is opened before its build (the player already opens a file
   first), and `build(k, o)` sees `k.media = { kind, count, name, aspect }` (the first page's width
   over height), or nothing in the Node tools. Also `pics.aspect(n)` in `info.data.pictures`.
2. **Several pictures as one set** (the album, and the digital frame): `input.media.multiple: true`
   lets the file picker take several pictures at once; `src/media.js` opens them as one media
   (`kind: "images"`, `count` pictures, `aspect(i)`, `draw(i)`), the Previous and Next buttons page
   through them, a link says "settings only" as for one file, and `pictures.sample` may return a
   list of addresses.
3. **Pages built ahead, hidden**: `out.sheets[id] = { page, visible: 0, ahead: true }` builds that
   page while the sheet stays hidden (after every visible sheet), and `pics.ready(id)` says whether
   a sheet shows the page it was asked for. Without it a turn either waits for its pages (a blank or
   a stale page for a moment) or keeps them all on show underneath.
