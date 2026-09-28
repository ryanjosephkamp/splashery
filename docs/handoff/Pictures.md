# Lane Pictures: pictures and pages, the engine

Prefix `pic`. Branch `claude/lane-pictures-engine`, PR "Engine: pictures and pages into splats". How
lanes work: [OPERATING.md](../OPERATING.md). Earlier lessons: [history.md](history.md).

## Brief

(Written by the Operator on September 28, 2026, from the owner's notes of September 27 and 28 and
the plan he accepted the same day)

The owner asked whether people could open a PDF, photos, a GIF or a video and see it made of
Gaussian splats: "a virtual Gaussian splat book, kind of like our storybook, but you can actually
flip every page, and each page is the proper corresponding page of the PDF that the person
uploaded", "an arbitrary number of pages", a photo album, and "a hologram or a TV screen that has,
like, a video that they've put on there, and it would all be Gaussian splats, with the audio
synchronized". "It should all still be Gaussian splats, like the rest of it is." "There needs to be
enough resolution for it to still resemble the original article. It doesn't have to be perfectly
legible", and it's fine if the toys are big or heavy for the sake of sharpness. His notes, word for
word, and the plan are in docs/reviews/2026-09-28-pictures/review.md (on the Operator's branch
claude/operator-pictures-plan until it merges:
`git fetch origin claude/operator-pictures-plan && git show origin/claude/operator-pictures-plan:docs/reviews/2026-09-28-pictures/review.md`).
The report he accepted is the private page "Pages into Splats":
https://claude.ai/artifact/9mrrJYPiZKbSD9s5gFBpaA (read it with the Artifact tool, action "read").

The plan he accepted, as it concerns this lane: "Start with the engine lane: pictures to splats (PDF
pages, photos, GIF and video frames), pages that stream through a few sheets, near and far detail,
Open a file in the Toy tab, and a web address for embeds. Keep the new toys behind a hidden switch
until I've tried them on my phone." "You may vendor PDF.js (Apache 2.0) and omggif (MIT), loaded
only when someone opens a PDF or a GIF." "The laptop stays as it is." The toy lanes that follow
build Your book, Photo album, Picture frame and Screen (old TV, flat TV, cinema, hologram, with
sound) on a new shelf, "Pictures and pages", plus a Gaussian splat toy (AI and computing) that
trains a cloud of splats into a picture with the code this lane builds. Build the engine they all
share, and one plain test toy to prove it.

### What the Operator's test found (September 28, on main at 30c773a)

- A research-article-style page (our own text) drawn to pixels and turned into splats, opened as a
  PLY file in the app at 390×844:
  - "Ink only" at 150 dpi (1275×1650 px, 6.6% of pixels inked) came to 172k splats. The paper was a
    white sheet of big splats (one per 8×8 px block, sigma about 5 px, 0.002 page widths behind the
    ink). Each inked pixel (min(r,g,b) < 0.94) became one flat splat: sigma 0.5 px, opacity 0.99,
    its own color.
  - Face-on, the title and headings read on the whole page; zoomed in, every word of the body text
    read. 96 dpi (80k splats) read too, softer. 200 dpi was 285k. Every pixel at 96 dpi would be
    862k, too many.
  - The paper sheet showed a faint grid; make the paper smooth.
- A 640×400 photo with one splat per pixel (256k splats) looked like the photo.
- The catch: with the engine's defaults the whole-page view came out blank. PlayCanvas skips splats
  smaller than about 2 screen pixels: `app.scene.gsplat.minPixelSize` defaults to 2 and
  `minContribution` to 3 (the projector's `if (max(radiusX, radiusY) < minPixelSize) return`).
  Setting both to 0 made the page appear. They are global settings. So either set them only while a
  picture toy shows and put them back after (no other toy may change), or give far pages coarse
  enough splats (near and far detail), or both. Measure it.
- The laptop already puts a live picture on splats. A recipe's `screen = { version(t), draw(g, t) }`
  redraws a canvas, `player.js` uploads it with `stage.setScreenCanvas(canvas)` to the `uSpScreen`
  texture, and kit splats of behavior kind "screen" (effects.js, index 15,
  `params: (c) => [c.u, 1 - c.v]`) take their color from it on the GPU. There is one screen texture
  per toy today. The laptop is locked: whatever you generalize, it must look and behave exactly as
  before (its smoke test guards it).
- The research, for your notes:
  - Fitting 2D Gaussians to photos exists (GaussianImage ECCV 2024, Image-GS SIGGRAPH 2025, Instant
    GaussianImage ICCV 2025). It runs on big GPUs and nobody tests text; that "fitted method" is a
    later upgrade, not this lane.
  - PDF.js (Apache 2.0, pdfjs-dist 6.x) ships `build/pdf.min.mjs` (459 KB) and `pdf.worker.min.mjs`
    (1.27 MB) as ES modules with no bare imports. The optional `standard_fonts/` and `cmaps/`
    folders cover PDFs that don't embed their fonts.
  - omggif 1.0.10 (MIT, 32 KB) is a classic script; it needs a one-line `export` wrapper.
  - ImageDecoder (GIF frames) is in Chrome and Firefox but not Safari (Technology Preview only).
  - requestVideoFrameCallback is in all three browsers.
  - WebGPU is in Chrome, Edge, Safari 26 and Firefox on Windows and macOS.
  - iPhone .mov (HEVC) videos play in Safari but not always in Chrome; MP4 (H.264) plays everywhere.

### Build

1. **Media in** (`src/media.js`, new). Open a file, or fetch a web address:
   - PDF (vendored PDF.js, loaded lazily with a dynamic import only when a PDF is opened; pass
     `isEvalSupported: false`; latest 6.x).
   - Images (PNG, JPEG, WebP, AVIF, and whatever else the browser decodes).
   - Animated GIF (ImageDecoder where it exists, else vendored omggif; both lazy).
   - Video (MP4, WebM, MOV where the browser plays it, via a `<video>` element and
     requestVideoFrameCallback).

   One small interface for the toys: page count or frame timing, a page or frame drawn at a size you
   ask for, video play, pause and seek, and the video's sound. Files stay in the browser ("nothing
   is uploaded"). Clear messages for a file the browser can't read, a password-protected PDF, a web
   address that refuses (CORS), and files too big for this device (use the per-tier limits in
   loaders.js as your model).

2. **Pictures to splats** (`src/pictures.js`, new, heavy work in a Web Worker from a static module
   file). From pixels:
   - "every pixel" for photos and frames.
   - "paper plus ink" for documents: find the paper color; the paper is a smooth sheet; inked pixels
     get splats. It must work for scanned pages with off-white paper too.
   - A texture-driven sheet (the laptop's screen method, generalized) for video and GIFs, where only
     colors change each frame.

   Choose each sheet's splat count from the device tier. Colors must match the source; no speckle,
   no blur beyond a pixel.

3. **Pages that stream through a few sheets**. A book of any length never builds every page. Only
   the open pages and the one turning exist as splats, and a page is built when it is reached, from
   the PDF, in a fraction of a second, and freed when it leaves. Memory and splat count must not
   grow with the page count (test 200 pages). How the sheets are drawn (rebuilt splat sets per page,
   several gsplat entities, or texture-driven sheets) is your design call. Measure and write it
   down.

4. **Near and far detail**. A page seen whole uses coarser splats than a page you zoom into, so
   nothing vanishes at a distance and zooming stays sharp. Settle the numbers on real measurements.
   The owner accepts big splat counts for sharpness where the device tier allows.

5. **Open a file in the Toy tab**: a recipe control type for a file (with the kinds it accepts),
   plus a web address field. Keep it in clearly marked blocks in src/ui.js, index.html and
   styles.css; lane AI's drawing-pad control is the model.

6. **Links and embeds**:
   - A scene can carry a media web address (an additive field in schema v3, documented in
     docs/SCENE-SCHEMA.md), so an embed or link rebuilds the picture from the owner's own site.
   - A file opened from the device is never put in a link; the link says "settings only", as your
     own splat files do today.
   - Old `#s=` links and saved scenes (v2 and v3) must load exactly as before.
   - Only https addresses (plus the local test server).

7. **The hidden switch**. Toys marked `labs: true` in src/toys.js stay off the shelf and out of
   Surprise me unless labs is on. `?labs=1` turns it on and remembers it in this browser; `?labs=0`
   turns it off. A link to a labs toy still opens it. The new shelf "Pictures and pages" shows only
   when it has a toy to show.

8. **One test toy, "Picture lab"** (labs only, in a new pack `src/packs/pictures.js`; the toy lanes
   take the pack over later):
   - A plain flat sheet that shows whatever you open (a PDF page with next and previous, a photo, a
     GIF, a video with play and pause), and nothing else.
   - It opens with a small sample made by this lane: a short article-style PDF of our own text,
     printed with Chromium, and a CC0 photo with its credit.
   - Its tap goes to the next page (or plays and pauses a video).
   - Give it a how-to line and About text in src/toy-help.js, and a plain sound in
     src/toy-sounds.js.
   - Video sound follows the site's speaker button (off until the visitor turns sound on; embeds
     stay silent).

9. **For the toy lanes**: an API a recipe uses to place picture sheets (size, position, part, which
   page or frame, which method) and to bend a page like paper (PACKS.md's skinned sheet, which the
   ocean wave uses). Document it in your handoff under "For the Operator" (the Operator moves it
   into PACKS.md; that file is his).

10. **Tests** in tests/pic.spec.mjs, with small fixtures you make yourself (under
    tests/fixtures/pic/, each under 200 KB):
    - Each kind opens.
    - A PDF page shows ink at phone size, whole and zoomed.
    - A 200-page PDF pages through with a steady splat count.
    - A GIF animates and a video plays (WebM, since the test Chromium may lack H.264).
    - A web address loads, and a refused one shows its message.
    - The labs switch hides and shows.
    - Old links, the laptop, other toys and the embed transfer test are unchanged.

You own:

- the new files (src/media.js, src/pictures.js, its worker, src/packs/pictures.js, vendor/pdfjs/,
  vendor/omggif/, tests/pic.spec.mjs, tests/fixtures/pic/, assets/toys/picture-lab/);
- the parts of src/stage.js, src/effects.js, src/kit.js, src/player.js, src/app.js, src/state.js,
  src/codec.js, src/ui.js, index.html, styles.css, embed/ and src/viewer.js or src/embed.js that
  this feature needs, in clearly marked blocks;
- docs/SCENE-SCHEMA.md (the new field);
- your lines in the shared lists (src/toys.js: the new shelf and the Picture lab row;
  src/toy-help.js; src/toy-sounds.js; tools/toy-plan.json; CREDITS.md; LICENSES.md with each
  vendored library, its version, source URL and license);
- your `pic-*` screenshots and docs/handoff/Pictures.md.

Two sound lanes may run at the same time as you, editing other toys' lines in src/toy-sounds.js and
later src/voices.js. Leave their lines alone; keep both sides when you merge.

### Checkpoints

- As soon as your first prototype works, put a "## Design" section in your handoff and push it.
  Cover the page architecture you chose and why, the near and far detail, the splat budgets per
  tier, the minPixelSize approach, the file and web-address flow, and the labs switch, with your
  measured numbers. Keep working; the Operator reads it at his check-in and messages you if he
  disagrees.
- Clips for the owner on the Effect review page (https://claude.ai/artifact/NCsg9V5SzFY3Mnwuwgq7pi;
  lane record "Pictures", which the Operator has made), as OPERATING.md's "Steps for a lane" says.
  Cards:
  - `pic-pdf-phone`: the sample PDF whole and zoomed at 390×844;
  - `pic-pages`: paging through a long PDF;
  - `pic-photo`: a photo;
  - `pic-gif`: a GIF;
  - `pic-video`: a video playing;
  - `pic-desktop`: a desktop view at 1440×900.

  tools/effect-clip.mjs may not open files; write your own clip script and keep it in tools/ if it's
  reusable. The owner then tries the Picture lab on his phone with ?labs=1 after the merge.

## State

September 28, 2026: the prototype works end to end in the app (Picture lab with `?labs=1`): the
sample PDF, a photo, a GIF, a WebM video, a 200-page PDF, a web address, and the messages for a
password-protected PDF and a refused address. Next: the page bend (kind "leaf"), links and embeds,
tests, the help and sound entries, the thumbnail, clips.

## Design

Measured on September 28, 2026 in the test Chromium (software WebGL, 390×844 at 2x, the "mid" tier),
with the sample article (two Letter pages, dense: about 17% of a page's pixels are ink).

**Page architecture: one gsplat entity per sheet, rebuilt per page.** A recipe places sheets with
`k.sheet(...)`. Each sheet is its own gsplat entity (`stage.addSheet`) in the kit format (it carries
`splatAnim`), drawn and sorted with the toy and moved by the same uniforms (parts, tokens, and the
new leaves), so a page can ride on a part or turn about a spine. When a sheet's page (or its level
of detail) changes, the page is drawn from the file (PDF.js, or the picture, or the GIF or video
frame) at the size wanted, a Web Worker (`src/pictures-worker.js`, pure code in
`src/picture-splats.js`) turns the pixels into packed arrays in the container's own texture layout,
and the main thread copies them into the sheet's container (a new, bigger container only when a page
needs more than it holds). Why this over the alternatives:

- Texture-driven sheets for pages would need a sheet dense enough for the sharpest page everywhere
  (splats where there is only paper) and give up the per-splat ink colors; rebuilt splat sets spend
  splats only on ink.
- One entity per sheet (not one big container) lets a page swap without touching the others, and a
  turning page keeps its own splats.
- Memory and splat count do not grow with the page count. Paging through all 200 pages of a test
  PDF: splats on show stayed at 18,942 to 19,835, the container's capacity stayed at 23,678, the JS
  heap plateaued at 71 to 78 MB, and each page took 127 to 205 ms from "go" to shown (drawing the
  page, building and uploading). A small cache keeps built pages (up to 600,000 splats, about 40 MB;
  the page after the open one is built ahead).

**The splats.** Each sheet has a smooth base and the detail on it:

- Base: two staggered lattices of 8-pixel blocks, each a flat disc with a sigma of 3.6 px (0.45
  block). They close up to about 97% cover with no grid (the Operator's test showed a grid with one
  lattice). Its color is the paper's own color per block for a document, the mean color for a photo.
- Detail: one flat disc per pixel, sigma 0.6 px, opacity 0.99, the pixel's own color, 6 px (0.75
  block) in front of the base, so the paper does not sort over the ink until the page is seen from
  more than about 60 degrees off its face.
- "ink" (documents): the paper color is found per block from the lighter half of its pixels,
  smoothed; blocks much darker than the page's most common color (a figure) borrow that color. A
  pixel is ink when it differs from the paper under it by more than 0.075 in any channel. The page's
  edge is six rows of long thin splats (0.6 to 2 px across), so the edge is sharp while the paper
  inside stays coarse.
- "pixels" (photos): every pixel is detail; the base stays 8 px inside the edge.
- "screen" (GIF and video): the same splats as "pixels", colored on the GPU from the sheet's own
  texture (the kit's "screen" kind, 15). Each sheet has its own texture (`stage.setSheetScreen`), so
  the toy's own screen (the laptop's `uSpScreen`) is untouched. A new frame draws the frame at the
  sheet's size into a canvas and uploads it (a 192×144 video: 28k splats).

**Near and far detail.** Each frame the controller measures how many device pixels the sheet's width
covers and builds the page at about one picture pixel per device pixel, on a ladder of widths a
square root of two apart (128, 181, 256, 362, 512, 724, 1024, 1448, 2048, …), within the tier's cap.
It rebuilds when the wanted level has held for 250 ms and is over 1.3 times or under 0.6 times the
built one. Measured for the article's first page (ink method):

| Width   | Splats  | Ink pixels | Draw (PDF.js) | Worker | Total   |
| ------- | ------- | ---------- | ------------- | ------ | ------- |
| 362 px  | 31,998  | 23,890     | 65 ms         | 19 ms  | 86 ms   |
| 512 px  | 57,548  | 42,918     | 23 ms         | 47 ms  | 171 ms  |
| 724 px  | 95,307  | 68,471     | 856 ms        | 113 ms | 1026 ms |
| 1024 px | 175,215 | 124,870    | 862 ms        | 163 ms | 1041 ms |
| 1448 px | 330,060 | 234,094    | 906 ms        | 474 ms | 1397 ms |
| 1600 px | 388,004 | 271,962    | 957 ms        | 402 ms | 1377 ms |

(The jump in drawing time from 724 px on is PDF.js in this software-rendered container; the numbers
on a phone will differ. The page stays on show while its sharper build runs.) Whole page on a
390-wide phone: the page shows about 340 CSS px (680 device px) wide at the Picture lab's camera, so
it is built at 724 px (95k splats); the title and headings read, and zoomed in four times (1600 px,
388k splats) every word of the body text reads.

**Splat budgets per tier** (one sheet; `PICTURE_BUDGETS` in `src/pictures.js`):

| Tier | Photo or frame ("pixels") | Video or GIF ("screen") | Page ink  | Widest page |
| ---- | ------------------------- | ----------------------- | --------- | ----------- |
| low  | 160,000                   | 100,000                 | 220,000   | 1,100 px    |
| mid  | 320,000                   | 180,000                 | 420,000   | 1,600 px    |
| high | 640,000                   | 320,000                 | 750,000   | 2,400 px    |
| max  | 1,200,000                 | 500,000                 | 1,300,000 | 3,200 px    |

A page with more ink than its budget is drawn again, smaller. Photos are never built wider than the
picture itself.

**minPixelSize: both.** The detail levels keep splats near one device pixel, and while a picture toy
shows the stage lowers `minPixelSize` and `minContribution` from 2 and 3 to 0.5 and 0.5
(`stage.setPictureCulling`), putting the defaults back for every other toy (the next toy's build
calls it with `false`). Measured on the whole page (dark pixels in the frame, default thresholds →
lowered):

| Page on screen | Built at | Default   | Lowered |
| -------------- | -------- | --------- | ------- |
| 511 px         | 512 px   | 15,247    | 15,247  |
| 511 px         | 1024 px  | 30,279    | 30,279  |
| 511 px         | 1600 px  | 0 (blank) | 32,501  |
| 256 px         | 1024 px  | 0 (blank) | 11,433  |
| 170 px         | 512 px   | 0 (blank) | 2,565   |

So with the defaults a page built at three times its screen size disappears (the Operator's blank
page); at one to two times it shows. The lowered thresholds cover the moment between a zoom-out and
the rebuild. Pages built much finer than the screen also look bolder (each sub-pixel splat covers a
whole pixel), which is another reason to follow the view.

**Files and web addresses.** `src/media.js` opens a File or an https address (or the local test
server) and gives one interface: `kind`, `count`, `aspect(i)`, `draw(i, w, h)`, and for video
`play`, `pause`, `seek`, `setMuted`, `onFrame`. PDF.js (6.3.289, the legacy build: the modern build
needs `Map.prototype.getOrInsertComputed`, which the test Chromium and many phones lack) and omggif
(1.0.10) load with a dynamic import only when a PDF or a GIF without ImageDecoder is opened. The app
opens the media first (`app.openMedia`), so a file the browser can't read, a password, an address
that refuses (CORS) or a file too big for the tier leaves the toy as it was and shows the message in
the Toy tab. Then the scene gets `toy.media = { url }` (a link or an embed opens it again) or
`{ file: { name, bytes } }` (settings only: a link says so, and whoever opens it is asked to open
the same file; the sample shows meanwhile), plus `page`.

**Labs.** `labs: true` in `src/toys.js` keeps a toy's card hidden (it stays in the shelf's list, so
the shelf tests that count every toy's card still pass) and out of Surprise me; the "Pictures and
pages" chip shows only when one of its toys is on the shelf. `?labs=1` turns labs on and remembers
it in localStorage, `?labs=0` turns it off; a link or `chooseToy` opens a labs toy either way.

## Notes

## Known issues

## For the Operator
