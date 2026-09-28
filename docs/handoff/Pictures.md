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

September 28, 2026: started. Handoff file and draft PR first, then the page architecture prototype.

## Design

(Filled in once the first prototype works.)

## Notes

## Known issues

## For the Operator
