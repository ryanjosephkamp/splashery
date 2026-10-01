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

- **Your book** (`your-book`): opens the Tinkerer's Manual (`manual/tinkerers-manual.pdf`, 25 Letter
  pages; the switch from the Picture lab's article was handed to this lane after Manual merged), or
  any PDF from a file or an https address. A tap opens the cover, then turns one leaf at a time
  (about 1 s); at the end a tap closes the book. Previous and Next in the Toy tab step a spread; a
  link's page (or any jump) opens the spread with that page. Five styles: hardcover (cloth boards, a
  square spine, head and tail bands, the first page as a panel on the cover), paperback (a card
  cover that flexes), magazine (thin, a flexing cover, two staples in the fold), stapled paper (one
  page a sheet, a staple in the corner, the sheets flip over the top) and spiral notebook (a wire
  coil). The page shape follows the PDF's first page.
- **Photo album** (`photo-album`): six CC0 sample photos; open several of your own at once. Leather,
  linen or scrapbook covers; thick card pages; each side holds one photo, or two wide ones stacked
  or two tall ones side by side; photo corners and (a switch) the file name as a caption.
- **Picture frame** (`picture-frame`): a CC0 photo on a wall, hung from a nail by a wire; wood,
  gold, modern (with a mat) or digital (steps through a set of photos with a fade to black). A tap
  swings the frame as a damped pendulum (3 s).
- Turning pages by dragging a corner is not built (see "What was cut" in the PR): the tap, Previous
  and Next turn the pages.

## r2: a sharper book body (September 29, 2026)

The owner's marks: the frame's two clips good; the book's three and the album's "fix", each with the
note "Looks nearly perfect; mechanics seem perfect, basically. The book itself (not the pages) just
seem a little bit blurry or grainy, especially around the edges." Branch `claude/lane-books`
restarted from main; PR "Phase Books r2: a sharper book body". Only the book's and the album's own
kit parts changed (pages, the page engine and the turns as they were):

- `rect()` (every cover, board, spine, band, page block and card face) lays a staggered lattice of
  flat discs that stops two splat widths short of the face's edges, a band of discs half the size
  round it, and a line of thin splats along each edge, a little inside it, stopping short of the
  corners. The old lattice ran to the edges, so its outer splats' soft glow spilled past them (the
  fuzz). Opacity 1. It counts its layout before laying it out, and makes each splat as asked.
- Full density (the recipes' `density` 1, was 0.35): about 140k kit splats at "mid", within the kit
  budget; the pages keep their own budgets.
- Colors from smooth functions: no weave, grain or page lines at about the splats' spacing (they
  read as speckle on a phone). The leather's stitches and pressed groove are thin splats along their
  lines in front of the cover (`albumTrim`), and the scrapbook's label its own rectangle.
- The spiral's wire, the magazine's staples and the stapled paper's staple are thin splats along the
  wire instead of round blobs.
- The picture frame (marked good) keeps the old lattice (`plainRect`), so its look is unchanged.
- Before-and-after clips: `tools/bk-clip.mjs --intro=<png>` opens a clip on a still.

## r3: pages you tap and pull (September 29, 2026)

The owner reviewed the Pictures and pages shelf (docs/reviews/2026-09-29-new-toys/review.md). The
Operator's brief for r3, word for word:

> a. Taps that know where they land (action.at(point, c), PACKS.md "Action"):
>
> - Your book and the photo album, styles that turn sideways: a tap on the left page goes back a
>   page; a tap on the right page, or exactly in the middle, goes forward; a tap anywhere on the
>   closed front cover opens it (as now).
> - Stapled paper (turns upward): a tap in the top quarter of a page goes back; a tap anywhere below
>   it goes forward; the cover opens as now.
> - Picture lab: a tap on the left of the page goes back, on the right (or the middle) goes forward.
>   Its pages keep sliding without a flip: he likes that ("I like that the pages don't flip like a
>   real book").
> - On the last page, forward closes the book, as now.
>
> b. Your book's page turn: "it feels unnatural and awkward, like something incorrect happens before
> the page actually turns." Find the glitch frame by frame (tools/effect-strip.mjs): a jump, a
> re-sort, the content swapping or the page lifting wrong before the turn. Make the turn one
> continuous motion, with no pop at the start or the end. The album's turn is "a bit better" and
> needs little.
>
> c. Pull a page to turn it (recipe.drag, PACKS.md; drag.at claims only presses that land on a page,
> so a drag anywhere else still turns the view). "A click without a drag should be an automatic page
> turn, with the direction depending on where the user has clicked; a drag/pull of the page should
> peel the page in a natural manner and require the user to actually move the page sufficiently far
> for the page to turn, like a real physical book would." So: the grabbed corner or edge follows the
> finger and the paper curls from it. Let go past about halfway, or with a quick flick, and it
> finishes the turn; otherwise it falls back. The album's pages are heavier ("the manual drag/pull
> page turning can feel slightly slower or otherwise subtly reflect that additional weight"): follow
> the finger with a little lag, fall back more readily, and settle with less flutter. Stapled paper
> pulls upward.
>
> d. The Picture lab's background rectangle "is a bit grainy, especially around the edges": Fidelity
> A's method, clean edges.
>
> e. Picture frame:
>
> - The gold frame "is a little too basic and grainy and should look more realistic": a real molded
>   profile (a bead, a cove and a flat, like a gilded frame), burnished highlights on the raised
>   parts and darker recesses, sharp edges; not a flat yellow band.
> - GIFs and videos in every frame style: "I can upload GIFs, but they just don't play." Add "gif"
>   and "video" to the frame's accept list; a GIF plays on a loop, a video plays muted on a loop
>   (sound with the speaker button, as on the Screen), and the tap still swings the frame on its
>   nail.
> - The digital frame: "allow users to see the uploaded images/GIFs/videos and rearrange them to be
>   in their desired order, or choose random." A list in the Toy tab of what was opened (a small
>   thumbnail and name each), to reorder (buttons to move up or down, and dragging if it's easy),
>   plus an Order choice: In order or Random. If the list needs a change in src/ui.js, make that a
>   small additive engine PR on claude/lane-books-engine-2 (titled "Engine: …"), merged first, as
>   with #74.
> - The web-address box that says "a PDF, picture, GIF or video" on a frame: I'm fixing that in the
>   engine myself (the box will name only what the toy opens, from its accept list), so leave it.
>
> f. Your toys' toy-plan entries and how-to lines: say how to tap and pull.

What r3 does:

- Taps: `bookTapAt` (the book and the album) and the Picture lab's `action.at` return the turn with
  `pick` 1 for back; drive queues the direction (`BOOK.queue` holds +1 or -1).
- Pulls: `bookDrag(BOOK_PULL)` and `bookDrag(ALBUM_PULL)`. A press on the book claims the drag; once
  it moves the way a page turns, a turn starts whose progress follows the finger (`a.pull`): the
  point grabbed stays under the finger as the page swings about the spine (the closed cover and a
  closing cover follow the finger's travel). Let go past halfway (the album 0.58) or with a flick
  and it finishes; otherwise it falls back. The album lags the finger more (0.12 s against 0.035 s),
  settles slower and curls less. A press that doesn't move is a tap. Both sides of the left leaf are
  now built ahead, so a pull back never shows a blank page.
- The turn: the angle eased with a slow cubic start while the curl followed `sin(πu)` at once, so
  the page bent where it lay before it lifted, then snapped over. The curl now follows the page's
  own angle, on a sine ease (`easeTurn`).
- The Picture lab's card is a `rect` (clean edges).
- The gold frame: `goldProfile` (a small bead at the sight edge, a flat, a cove, a big bead, a
  rounded outer edge) built as 16 strips per side at their own heights and slopes, mitered at the
  corners, lit by `goldAt` (burnished highlights on the raised parts, darker in the cove).
- Frames take GIFs and videos (the sheet's method follows the media); a video starts playing by
  itself, muted. The digital frame has an Order option (In order, Random) and lists its photos in
  the Toy tab (`media.list`, engine PR 2: `claude/lane-books-engine-2`).

## r4: the turn's flash, the stapled paper's edge, and page focus (September 30, 2026)

PR #126 (`claude/lane-books-r4`, from r3's head). The owner's two "fix" marks on the r3 cards, and
page focus (approved September 30, 2026).

- bk-book-taps: the page a leaf lands on showed its old figure for a moment as the leaf came down.
  It now hides once the leaf is within about 17 degrees of it (`landing` in `bookLayout`), as the
  page under a leaf shows only once the leaf has lifted clear (`lifted`).
- bk-stapled-taps: white paper on a white page had no outline. The stack has darker edges, a soft
  shadow behind it, and a thin gray line round the top sheet.
- Page focus: a double-tap on a page glides the view until the page fills the screen; a double-tap
  again, or a zoom out, shows both pages. While a page is in view, taps go by its halves, and
  forward goes from the left page to the right one, then turns the leaf and lands on the next left
  page (back the other way). A new option, Reading (Both pages, One page), keeps a page in view; its
  default follows the screen's shape (One page on a phone held upright), so old links and scenes,
  which don't have it, load as before and nothing new is stored unless it is chosen. The frame and
  the Picture lab focus on the photo or page. On these toys a double-tap no longer resets the view
  (↺ and the R key still do; a double-tap off the toy still resets).
- The engine hook (small, additive, marked "Page focus"): `recipe.focus(point)` and `out.view`
  (PACKS.md, "Focus"); `Player.focusAt`, `followView` and `glideTo` in src/player.js;
  `App.tapOrFocus` in src/app.js (a single tap on such a toy waits 0.3 s, to tell it from a
  double-tap).

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
- Splats on show: two pages at rest, four while a leaf turns, plus the kit (about 140k at "mid"
  since r2). A whole spread on a 390-wide phone builds each page at about 362 to 512 px wide (30k to
  60k splats a page for the sample).

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
  shows once the turning page has lifted about 17 degrees (a pale strip of the page block shows at
  the fore-edge until then); showing it sooner mixes the two pages' text.
- A page with a much finer build than the screen (zoomed out after zooming in) is rebuilt after a
  quarter second, as in the Picture lab.
- The left page block is a fixed thickness (it doesn't grow as you read).
- r2: a faint haze of a few pixels can still show beside an edge seen almost edge-on (a face's own
  splats, seen from the side).
- r3: a set on the digital frame takes photos only: a GIF in a set shows as a still and a video is
  turned away (a set's items would need their own playing media in the engine). One GIF or video
  plays in any frame.
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
