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
  State", "## Notes", "## Known issues" and "## For the Operator" current.
- PR: one draft PR against main (five sections: Summary, Verification, Deviations, Known issues,
  What was cut), opened early and pushed after each finished item. Finish every working turn with a
  final message that starts "READY:", "WORKING:" or "BLOCKED:".

## State

WORKING: not started yet (October 4, 2026).
