# Lane Pages r6: pop-up for every page, and figures you choose (prefix `pg6`)

## Brief

You are a Splashery worker session, started by the Operator (the coordinating session). Repo:
ryanjosephkamp/splashery. Your lane: Pages r6 (id `PagesR6`, prefix `pg6`). Branches:
`claude/lane-pages-r6-engine` (the engine PR, merged first) and `claude/lane-pages-r6`. PR titles:
"Engine: a pop-up switch in the top bar, and figure depth in scenes" (or what it turns out to be)
and "Phase Pages r6: pop-up for every page, and figures you choose". Handoff file:
docs/handoff/PagesR6.md. Model: Opus 5.5.

### Brief (written by the Operator on October 4, 2026, from the owner's push notes that evening)

The owner's notes are in docs/reviews/2026-10-04-push-alignment/notes.md (read the part that starts
"So, since the last time that I checked the Labs page"). Pictures and Pages is one of the push's
main areas. He called the figures that pop out of a page "one of the coolest things that we've
created so far", and Draw a box (drag a box on a page and what's inside rises) "the real truly
coolest thing". He tried them on a computer. What he wants changed:

1. **One pop-up switch for every page toy, in the top bar.** Today Pop out is a switch in each toy's
   Toy tab (`src/packs/pictures.js`: Your book 1381-1382, the Photo album 2055; the Picture lab has
   neither). Make it a global control in the top row, beside the flag control (`flag-global` in
   index.html and `src/ui.js`), shown only while a toy that can pop figures is open: Your book, the
   Photo album and the Picture lab. One setting for all three that stays as it is across page turns,
   toy switches and reloads (store it the way the flag control stores its choice). Default off; the
   first time one of these toys opens on a device, a one-line hint says the switch is there. Scenes
   and links that had Pop out on still turn it on.
2. **With the switch on, nothing rises by itself.** Today a page turn lays a risen figure back and
   then raises "the biggest figure on the page in view" again (pictures.js 974-1011), and on a text
   page nothing is found, so in Your book it looks as if the switch had reset. What he wants:
   - The book works exactly as with the switch off (read, zoom, turn pages) until he taps a figure.
   - A tap on a figure raises it. A tap on another figure raises that one too, and the first stays
     up: several figures can be up at once (pick a cap that keeps phones smooth, and say what it
     is). Draw a box can also raise several boxes.
   - A tap on a risen figure lays it back. A tap that is not on a figure does what it does today.
   - A page turn (by tap or by drag) lays every risen figure back quickly, before the page moves.
3. **Turn the book to see them rise.** With figures up, he wants to "rotate the book back and forth,
   forward and backwards", so he sees the figures standing off the page. Give the book a tilt the
   reader controls (a drag off the pages, or a control; choose what doesn't fight page drags and
   pinch, and works on a phone), and a quick way back to the reading view.
4. **The Picture lab gets both**: the pop-up switch and Draw a box, for PDFs and pictures (its code
   is pictures.js 2458-2531).
5. **More depth, per figure, as an option.** Today's depth stays the default ("basically perfect": a
   photo's relief is a fifth of its shorter side, from the Photo to 3D depth model; a graphic's
   layered lift is 4.5%). Add a depth control for a risen figure (from today's depth up to several
   times more), so a top-down photo of a mountain range rises as real terrain. The chosen depth of
   each figure is saved in the scene and in an embed's settings, so a page opens with its figures at
   the depth its author set. Additive fields only; document them in docs/SCENE-SCHEMA.md through the
   engine PR. Check how Depth Anything V2 Small handles aerial and top-down photos (test with a
   public-domain aerial photo) and say what you found.
6. **The page sound on a drag.** Pages turned by a drag make no sound (Your book plays its page
   sound only on the tap path, pictures.js 1409-1416, with `quiet: ["turn"]` at 1385, and
   `bookDrag.end` at 1334-1347 adds none; the album's sound is the app's tap sound, toy-sounds.js
   2657-2660). A drag that turns a page plays the page sound once as the page goes over; a drag that
   falls back makes at most a soft settle. Same in the Photo album.
7. **New page ideas** the owner picks on the Push Plan page (P1 to P4: layered pop-up scenes, peel a
   figure off as a sticker, a magnifier that lifts what's under it, folds that open with the page).
   The Operator tells you which, if any; build them after items 1 to 6, keeping the page uncluttered
   (his words: "Nothing that's going to make it too cluttered or complicated to use").

Read docs/handoff/BooksR5.md first (how Pop out and Draw a box work, and their known issues), then
the earlier Books handoff files. The effect itself stays what he loves: the figure rises as one
solid piece, with the page drawn again with its place empty.

#### Deliverables

- Tests in `tests/pg6*.spec.mjs`: the switch persists across a page turn and a toy switch; several
  figures up at once; a tap on a risen figure lays it back; a page turn lays all back; the Picture
  lab pops and draws a box on a PDF; a depth saved in a scene comes back; a drag turn plays the page
  sound; old links and v2 and v3 scenes still load.
- Clips at phone size: two figures rising in turn and one laid back; a page turn laying them back;
  the book tilted with figures up; the Picture lab popping a PDF figure and a drawn box; a deeper
  terrain pop.
- How-to and About texts for the three toys updated (`src/toy-help.js`).

#### You own

`src/packs/pictures.js` (Your book, the Photo album, the Picture lab), the picture engine
(`src/media.js`, `src/pictures.js`, `src/picture-splats.js`, `src/pictures-worker.js`) and the top
bar control (`index.html`, `src/ui.js`, `src/app.js`, `styles.css`) through the engine PR only,
`tests/pg6*.spec.mjs`, `tools/pg6-*.mjs`, the three toys' lines in the shared lists, and this file.
Lane Studio media works on Photo to 3D beside you: import `photo-3d-depth.js` and `photo-3d-core.js`
unchanged; if they need a change, tell the Operator.

#### How this lane runs

- The Operator session runs the lanes. The owner, Ryan, talks only to the Operator. Don't ask him
  anything or wait for him. Put questions and blockers in your final message ("READY:", "WORKING:"
  or "BLOCKED:"), and the Operator answers or relays them. Messages that arrive "From the Operator"
  come from the coordinator on the owner's behalf.
- Model: Opus 5.5 only, at the default effort. Any helper you start uses the same model. At most one
  helper at a time.
- This is the October push (October 5 to 7, 2026): about ten lanes build at once. Edit only the
  files you own and your own toys' lines in the shared lists (`src/toys.js`, `src/toy-sounds.js`,
  `src/toy-help.js`, `tools/toy-plan.json`, `tools/assets.json`, `CREDITS.md`). Merge main into your
  branch whenever it moves (never rebase a pushed branch). Regenerate docs/TOY-PLAN.md with
  `node tools/toy-plan.mjs`; never merge it by hand.
- Engine changes: small, additive and tested, on `<your branch>-engine` with a draft PR titled
  "Engine: …", merged first. Toys that don't use them behave exactly as before.
- Merging: The engine PR merges after a full test run; the toys are labs, so the Operator merges
  them after the full run too, and the owner decides when they go public. Never merge anything
  yourself.
- Everything new is behind the labs switch (`labs: true`) unless this brief says otherwise. Old
  `#s=` links and saved scenes (schema v2 and v3) keep loading.
- Licenses (CLAUDE.md, "Ground rules"): read each asset's or dataset's license on its live source
  page; record it in CREDITS.md, `tools/assets.json` (or `tools/models.json`) and the toy's in-app
  credit; `"nc": true` on NC assets; never ND, unlicensed, personal-use or paid. A new open-source
  library is fine when it's needed (the owner's rule of October 4, 2026): vendor it in `vendor/`,
  load it only when its toy opens, list it in LICENSES.md, and name it in your PR; a copyleft
  license (GPL, AGPL), a library that calls a server, or one over 2 MB goes to the Operator first.
- Effects follow CLAUDE.md, "Effect quality rules": real motion of solid pieces, judged as clips at
  phone size.
- Tests: `tests/pg6*.spec.mjs`; never edit `tests/taps.spec.mjs`. Before each push run your own
  specs and the specs of the files you touch (say which in the PR); the Integrators run the full
  suite before a merge. Prettier, `node tools/us-english.mjs --diff`, and for toys
  `node tools/check-packs.mjs <pack>`, a contact sheet and thumbnails (CLAUDE.md, "Before every
  push"). Screenshots `pg6-<name>-390x844.png` and `…-1440x900.png`, then
  `node tools/upkeep.mjs --restore-shots`.
- Clips: post every new or changed effect on Effect review page 2
  (https://claude.ai/artifact/BSayVkzQ2FKESesrkrSUMK) as docs/OPERATING.md, "Steps for a lane", says
  (lane record `PagesR6`), after watching each one. After posting, check the owner's marks about
  once an hour with a scheduled check-in (send_later); stop once your PR is merged or closed.
- Language: American English for every new text (color, center, gray, license, toward, -ize endings,
  dates like "October 5, 2026").
- Your handoff file: start it with this brief, word for word, under "## Brief", then keep "##
  State", "## Notes

- **Depth Anything V2 Small on top-down photos** (tested October 5, 2026 with public-domain NASA
  photos from Wikimedia Commons: "Anti-Atlas Mountains, Morocco (2178).jpg", straight down from
  orbit, and "Neve Glacier North Cascades USGS.jpg", an oblique aerial; neither is in the repo). The
  model reads a straight-down photo of land as ground running away from the camera: its depth is a
  smooth ramp from the top (far) to the bottom (near), and a plane fits it with R^2 = 0.97. The
  terrain is there, but faint: once the ramp and a wide blur are taken off, what is left (2 to 6% of
  the range) lines up with the ridges and the dry valleys. So more depth alone would only tilt the
  photo further. What the toys do: a photo whose depth a plane fits (R^2 over 0.9) keeps its slope
  when made deeper and gains its local relief instead (the depth less the plane, less a blur 6% of
  its size wide, scaled up), so it rises as terrain; any other photo simply gets deeper. Depth from
  shading or a model trained on aerial height maps would do better; neither is vendored (BACKLOG
  material).
- The depth model takes about 4 to 5 s a photo here (SwiftShader, one thread), after its first load.
- P1 (layered pop-up scenes), behind a Toy tab switch, **Pop-up layers**, on all three toys: a
  raised figure becomes flat cutout cards on the three pop parts: the whole picture behind, then its
  nearer half and its nearest fifth (cut by the depth model's map at the 50th and 80th percentiles),
  each a gap in front of the one behind (7% of the figure's shorter side, times the Depth slider).
  The cards part as the figure rises, and a tilt shows the gaps. A graphic splits into its card and
  its strongest shapes. One figure at a time in layers (it takes all three pop sheets); raising it
  lays the others back.
- The maybes, not built (time went to items 1 to 6 and P1):
  - **P2, peel a figure off onto a desk:** a long press on a risen figure would let it be dragged
    off the page onto a plain desk plane beside the book, where it stays as a standing card while
    the pages turn (a "desk" list in the scene, like `toy.figures`). Costs: a desk surface and a
    second pose set, and the pop sheets stop being free for new figures.
  - **P3, a magnifier lens:** the owner's note is right that Capture (Draw a box) already does most
    of this. A lens would be a round box that follows the finger and lifts what is under it a
    little, magnified, as a live crop sheet rebuilt as it moves (several times a second: heavy on a
    phone). I'd skip it, or make Draw a box's rise optionally larger instead.
  - **P4, folds that open with the page:** a figure marked to fold stands on the page as a V-shaped
    fold (two halves on hinge parts) that opens to standing as the page lands open and folds flat as
    it turns, like a pop-up book's V-fold. It needs the page turn's angle passed to the figure's
    pose (all in the recipe) and figures kept up across turns, the opposite of item 2; so it would
    be a mode of its own.

## Known issues" and "## For the Operator" current.

- PR: one draft PR against main (five sections: Summary, Verification, Deviations, Known issues,
  What was cut), opened early and pushed after each finished item. Finish every working turn with a
  final message that starts "READY:", "WORKING:" or "BLOCKED:".

## State

October 5, 2026 (Opus 5.5). WORKING.

- **Engine PR** (`claude/lane-pages-r6-engine`, "Engine: a pop-up switch in the top bar, a freed
  tilt, a stage slider and figure depths in scenes"), additive, with `tests/pg6-engine.spec.mjs`:
  - A recipe control marked `global: "pop"` is set from a new top-bar button (`#pop-toggle`), not
    the Toy tab: one setting for every toy that has it, remembered on the device
    (`localStorage["splashery.popout"]`, as the turntable is), shown only while such a toy is open;
    on a computer beside the flag, on a phone in the turntable's place (a page toy holds still). A
    scene whose controls have it on turns it on for the visit. The first time such a toy opens on a
    device, a line says the button is there.
  - `out.tiltFree`: a toy whose tilt is locked turns any way while its drive asks; when it stops
    asking, the view eases back level and square and the lock comes back.
  - `out.slider = { id, label, value }`: a small slider over the stage; `info.slider` hands its
    value back.
  - `toy.figures` in scenes (`[{ page, box, depth }]`, depth 1 to 6, at most 64), as `info.figures`;
    a drive's `out.figures` replaces it. Documented in SCENE-SCHEMA.md and PACKS.md (5c).
- **Toy PR** (`claude/lane-pages-r6`), `src/packs/pictures.js`:
  - Items 1 and 2: Pop out is the top bar's switch for Your book, the Photo album and the Picture
    lab. Nothing rises by itself: a tap on a figure raises it, a tap on another raises that one too
    (**at most three at once**: each risen figure is a picture sheet of its own, and a photo's can
    be a few hundred thousand splats on a phone's budget; a fourth lays the oldest back), a tap on a
    risen figure (where it stands, or the place it left) lays it back, a tap elsewhere does what it
    did. A page turn (a tap, the Toy tab, a link, or a drag) lays every risen figure back quickly
    (0.28 s) before the page moves. Draw a box can raise several boxes. Switching Pop out off lays
    back the figures it raised; drawn boxes stay until tapped.
  - Item 3: while a figure stands up the book's tilt is free (`out.tiltFree`): a drag on a risen
    figure (or off the pages) turns the view any way, forward and back. A drag on the page still
    pulls it over (after the figures lie down). When the last figure lies down the view eases back
    to the reading view; Reset view works too.
  - Item 4: the Picture lab has Pop out and Draw a box for PDFs and pictures (a picture is one
    figure, the whole of it); a page step waits for risen figures to lie down.
  - Item 5: a **Depth** slider over the stage sets the depth of the figure raised last, from its own
    (the default, unchanged) up to five times, in quarter steps; a depth other than its own is kept
    in the scene and links (`toy.figures`), so the figure rises at that depth when raised again, in
    the app or an embed.
  - Item 6: a page pulled over plays the page sound once, as it goes past halfway or is let go to
    finish; one that falls back makes only a soft settle. The album plays its own page sound.
  - Help texts (all three) and plan entries updated; TOY-PLAN.md regenerated.
  - Tests: `tests/pg6.spec.mjs` (ten in Node with stand-in pictures, four in the app). The test PDF
    with two pictures on a page is made by `tests/fixtures/pg6/make-pdf.mjs`.
  - `tests/bk5.spec.mjs` (lane Books r5's) changed where it assumed the old behavior (the figure
    rising by itself, one figure at a time, the switch in the Toy tab, `pop`/`bk5pop` now
    `pop0`/`bk5pop0`).
  - Clips: `tools/pg6-clip.mjs` (a copy of the Books r5 recorder with this lane's scenes).
- Next: P1 (layered pop-up scenes), then clips, screenshots and the PR.

## Notes

- Depth Anything V2 Small on top-down photos: (to come).

## Known issues

- (To come.)

## For the Operator

- `tests/bk5.spec.mjs` (lane Books r5's file) had to change with the new behavior; the change is
  only where it assumed a figure rises by itself.
