# Lab notebook

A running record for the blog post and the "How it's made" page (the owner's answer of September 29,
2026: "start a running lab notebook now … so nothing is lost"). One entry per lane when it merges:
what it built, which model built it, how long it ran, the numbers that matter, and what we learned.
The Operator adds entries; the Learn lane keeps the notebook tidy.

## Models

Since September 29, 2026, each lane runs one assigned model: Opus 5.5 for the engine, the toys,
sounds, fidelity and the Operator; Sonnet 5.5 for the Worlds content, the Studio converters, the
docs and the Integrator. Earlier lanes (Phases A to E4 and the lanes up to Manual) all ran on Opus
5.5. One blind A/B toy (the same small toy built by each model, marked by the owner without knowing
which is which) is planned for the blog.

## Entries

| Date                  | Lane      | Model    | What it built                                                                                                                                                                   | Notes                                                                                                                                                                              |
| --------------------- | --------- | -------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| September 23–26, 2026 | Phase A   | Opus 5.5 | Sharper splats (device tiers and a Detail setting), embed fixes, an upright honeybee and the homepage embed (#13; homepage repository #33)                                      | Phones drew 140k splats and desktops 200k at the time; the owner called the sharpness "basically perfect". The merge date is not recorded.                                         |
| September 23–26, 2026 | Phase B   | Opus 5.5 | The phone shelf as a full grid, two-line thumbnail labels and a "Find your own splat" help panel (#17)                                                                          | 283 toys on the shelf; the first grid screen loads about 55 thumbnails (about 58 KB); 49 tests passed.                                                                             |
| September 23–26, 2026 | Phase C1  | Opus 5.5 | Visual fixes for 26 toys: grain, ball textures, and rebuilds of the camera, boombox, elephant and horse (#18)                                                                   | Grain had one cause: random placement left about a quarter of a surface thin. An even-placement option fixed it.                                                                   |
| September 23–26, 2026 | Phase C2  | Opus 5.5 | Clearer or more dramatic tap effects for 33 toys the owner found subtle (#19)                                                                                                   | Thumbnails redone for 10 toys; 4 touch-and-drag toys were left for Phase F.                                                                                                        |
| September 23–26, 2026 | Phase D   | Opus 5.5 | A sound for every toy (about 80 synthesized voices), scan rigs, taps that know where they landed and drag-to-stretch (#20)                                                      | All 283 shelf toys got a sound spec, 32 of them on and off pairs; 179 toys still only hopped. Nobody had listened to the sounds when the phase ended.                              |
| September 24, 2026    | Phase E1  | Opus 5.5 | New tap effects for 33 scans and shapes: color keys, whole-body effects and kit-built add-ons (#21)                                                                             | 23 sound specs changed. The owner's review of September 24 led to E1b.                                                                                                             |
| September 24–25, 2026 | Phase E1b | Opus 5.5 | Fixes from the E1 review (19 toys), a chess game as a kit toy, a laptop you can type on, the effect quality rules and the effect clip tool (#22–#24)                            | The clip tool takes about 90 seconds per toy under software rendering. The record also says 13 of the 33 E1 toys were redone: both figures are in history.md.                      |
| September 25, 2026    | Phase E1c | Opus 5.5 | Fixes from the E1b review: a phone panel bug, chess from PGN files, and the elephant, horse, cat, hockey puck, Newton's cradle, xylophone and tomatoes (#26–#28)                | The owner approved the effects on September 25. Chess grew to 48 tokens (32 pieces and 16 spares).                                                                                 |
| September 25–26, 2026 | Phase E2  | Opus 5.5 | New taps for 32 space, atom and gem toys, idle motion for the Sun, rings, aurora and galaxy, and (from the review) a chemistry toy that reads names and SMILES (#29–#31)        | 24 of 32 clips good at the review. The chemistry toy knows 69 elements, 66 named molecules and 4 proteins.                                                                         |
| September 26, 2026    | Phase E3  | Opus 5.5 | New taps for 26 tiny-world, anatomy and math toys, and the morph, band, fade and skin channels for soft shapes (#32)                                                            | 23 of 26 clips good at the review; the 3 notes were fixed in the same PR.                                                                                                          |
| September 26, 2026    | Phase E4  | Opus 5.5 | New taps for 28 nature and weather toys: falling leaves, petals and coconuts as loose pieces, jointed fronds, a breaking wave (#33)                                             | 30 clips (the saguaro's second tap and the pebbles' Cairn style included); 26 good, 4 needed fixes.                                                                                |
| September 26, 2026    | E4-finish | Opus 5.5 | The four E4 fixes: the ice swan melts in solid pieces, the ocean wave curls and crashes, the pinecone's scales break off, and the lava lamp gets blob options (#37)             | All approved at once. The ice swan has 10 pieces and 30 drops; the wave is a skinned sheet on 8 keyframes.                                                                         |
| September 26, 2026    | E5        | Opus 5.5 | Taps and sounds for 17 food toys that come apart as real pieces and come back (#35)                                                                                             | 14 of 17 looked right at once; redos: bananas r2, croissant r2, pretzel r2 and r3.                                                                                                 |
| September 26, 2026    | E6a       | Opus 5.5 | 20 balls with real arcs, spin and bounciness (#38)                                                                                                                              | 18 of 20 looked right at once; the basketball and the bowling ball needed a second round.                                                                                          |
| September 26, 2026    | E6b       | Opus 5.5 | 18 taps: eleven landmarks with respectful moments, a school of fish, nautilus, sea urchin, frog, shield, crown and snowman (#36)                                                | All 18 looked right at once.                                                                                                                                                       |
| September 27, 2026    | F         | Opus 5.5 | A puzzle cube that turns under the finger, Newton's cradle, chess by tapping and bricks that build five models, plus an engine re-sort for pieces that land far away (#45, #42) | All 4 looked right at once. The cube has 26 cubies as tokens; the scramble is 14 random turns.                                                                                     |
| September 27, 2026    | G         | Opus 5.5 | An image-to-3D tool (a free Hugging Face Space) and two shipped toys, a pencil and a tin can, with a Look choice (#43; looks #47, #48)                                          | 2 toys shipped, 1 failed; a run took about 30 seconds and the quota ran out after 4 runs. The owner liked the looks but wanted real-looking defaults, so there was a second round. |
| September 28, 2026    | Math      | Opus 5.5 | A safe equation reader (no eval) and five toys on the math shelf: a graph plotter, a surface plotter, circle and waves, Fourier circles and a Pythagoras proof; two fixes (#50) | 42 famous curves and 16 famous surfaces; 5 of 7 clips good the first time, the other 2 redone.                                                                                     |
| September 28, 2026    | Fix3      | Opus 5.5 | The bananas without the loose crown, and an ocean wave that collapses on one smooth clock (#54)                                                                                 | The wave was good the first time; the bananas were marked "fix" (remove the crown) and redone.                                                                                     |
| September 28, 2026    | AI        | Opus 5.5 | A shelf of 12 AI and computing toys where you watch the data move, some with 3D views (#52, engine #56)                                                                         | 4 review rounds; 2 of 11 clips good in round 1. The CNN reads a digit you draw (97.0% right on unseen digits); the word vectors use 24,000 real GloVe words.                       |
| September 28, 2026    | Help      | Opus 5.5 | A how-to line that shows when a toy opens, a "?" button and an "About this toy" text (#57)                                                                                      | 88 how-to lines and 13 About texts to start; the owner approved the texts.                                                                                                         |
| September 28, 2026    | HelpTextA | Opus 5.5 | A how-to line and an About text for every toy on ten shelves (#60)                                                                                                              | 149 toys; the owner approved every text, no "fix" marks.                                                                                                                           |
| September 28, 2026    | HelpTextB | Opus 5.5 | A how-to line and an About text for every toy on eleven shelves (#59)                                                                                                           | 154 toys (111 new how-to lines, 43 kept, 148 new About texts); the owner approved every text.                                                                                      |
| September 28, 2026    | Manual    | Opus 5.5 | The splat equation toy and the Tinkerer's Manual with its 25-page PDF (#65)                                                                                                     | About 2.5 hours; all five cards marked good the first time.                                                                                                                        |
| September 28, 2026    | Pictures  | Opus 5.5 | The picture engine: PDFs, photos, GIFs and videos into splats (#64)                                                                                                             | All eight clips marked good; a book of 200 pages kept about 19k splats shown.                                                                                                      |
| September 29, 2026    | Screens   | Opus 5.5 | The Screen in four styles and the Gaussian splatting toy with a real fit in a worker (#72, engine #71)                                                                          | About 6 hours; seven of eight clips good the first time, the sorting clip redone.                                                                                                  |
| September 29, 2026    | Viewer    | Opus 5.5 | Whole PDF figures (a NaN bug, not censorship), pinch that only zooms, tilt lock, top-bar buttons, flags per toy, terms of use (#75)                                             | About 2 hours; all five clips marked good the first time.                                                                                                                          |

Dates are merge dates where the record has them; otherwise the day of the owner's review, or the
span the record supports (Phases A to D have no recorded merge day). Every lane before September 29,
2026 ran Opus 5.5 (CLAUDE.md, "Working style"), though most lane records do not name the model.
Hours are in the records only from Manual on (the Operator's rows); the rows above say what the
records state and nothing more. The Operator adds a row for each lane when it merges, below the last
one.

## Lessons

What the lanes learned, grouped, each with the lane it came from. The full versions are in
[handoff/history.md](handoff/history.md), the lane handoff files and PACKS.md.

### Engine

- Splats are sorted in the pose they were built in, so a body that turns more than a quarter turn
  draws its far side over its near side. Build it twice, half a turn apart, and show the copy nearer
  its built pose (lane E2); for one round body, the part's `cull` flag does it with one copy (lane
  E6a), but a long body such as the football loses its ends, so it uses two copies (lane Math).
- A splat has one behavior, so a morph and another behavior cannot share a splat; morphing toys lost
  their breathing (lane E3).
- Pieces that move far, such as cube pieces and bricks, set `out.resort` on the frame they land,
  once per landing (lane F); pieces gliding just in front of a flat board need it a few times during
  the glide (lane AI).
- The app frames a toy by the bounds of all its splats, so hidden effect pieces are built inside the
  toy and grown by their part, even with `fit: false` (lanes E6a and E6b).
- Uniforms a toy does not set keep the previous toy's values in the shared shader scope, so every
  rig sets all its effect uniforms (lane E1).
- A phone panel opened while a scan loads shut itself; the sheet folds at the pick, not after the
  load (lane E1c).
- `k.roundedBox` with a high power (7 or more) leaves a thin band with no splats across its middle,
  so E5 moved the sushi board to `k.box` (lane E5); it also takes full sizes, not half sizes (lane
  E6a).
- PDF.js's modern build needs a Map method that the test browser and many phones lack, so the legacy
  build is vendored (lane Pictures).
- With the default cull limits a page built three times finer than the screen goes blank. The limits
  are lowered only while a picture toy shows, and the near and far detail follows the view (lane
  Pictures).
- One splat container per sheet, rebuilt for each page, keeps the splat count and memory flat for a
  200-page book (lane Pictures).
- A captured toy can offer looks as finished pairs of files; only the look's id goes into links
  (lane G).
- The scene reader drops characters outside ASCII, so typed text is stored in an ASCII form (lane
  Math).
- The equation reader knows only x, y, t, r, θ, a and b, so the splat equation toy hands it u and v
  as θ and y (lane Manual).
- A page that turns over (kind `leaf`) is drawn in the order it was built, so a second sheet on its
  back showed paper and no ink. The Manual's little book uses one sheet, whose far side shows in
  mirror image (lane Learn).

### Effects

- Never bend a scan with soft regions for a visible effect. Cut the part out with hard edges, swap
  in a kit-built part, or choose a different effect (lane E1b); when a scan's part cannot move
  without tearing, hide it and build a kit replacement traced from the scan's splats, as with the
  elephant's trunk (lane E1c).
- Grain had one main cause: random placement leaves about a quarter of a surface thin. An opt-in
  even placement fixes it (lane C1).
- Tiny splats vanish on small screens (under about 2 pixels). Keep size divided by the square root
  of weight near 0.5 or more and check clips at 300 to 360 pixels (lane E2). The same cause hid the
  text in the AI toys, where splats now sit only on the ink (lane AI), and a thin ribbon at weight 9
  (lane Math).
- Where a morph turns a surface a lot, use rounder splats; where it stretches one, use slightly
  larger splats, or the far side speckles through (lane E3).
- A skinned sheet (two tokens per splat) bends a whole surface through keyframes. Keep the bending
  in the plane the camera looks along and use rounder splats (lane E4-finish).
- Keyframes eased one by one stop at every key. Run one steady clock through all of them, then a
  smooth curve between the keys (lane Fix3).
- To bend one piece that touches itself, twist space smoothly instead of moving its center line, or
  the crossings pull apart (lane E5).
- Pieces that melt ride on the piece they grow from, or they are left hanging (lane E4-finish).
- Figures that walk toward the camera are built at the point of their path nearest the camera, or
  they vanish under the ground (lane E6b).
- Baked light turns with a spinning body. For a glossy ball, spin an unlit copy under a fixed
  see-through light layer (lane E6a); and paint finger holes on a body that turns instead of boring
  them (lane E6a).
- A traveling wave with morphs splits the moving pieces across three channels a third of a cycle
  apart, and something that grows out of a hidden spot is built bunched up there and morphs out
  (lane E6b).
- A set of copies, each morphing exactly into the next, gives real-time bending through keyframes of
  any shape (lane Math).
- The kit fits a toy to a sphere, so a long, thin model comes out small; lay it out as a compact
  block (lane AI).
- An image-to-3D scan's unseen side is a guess, so pick taps that keep the photographed side toward
  the camera (lane G); paint every splat of a region when recoloring a scan, or the unpainted ones
  show as pale speckle (lane G).
- Soft splats blurred together in the sorting clip. Drawing each splat as what it is, a small
  colored ellipsoid, made it crisp (lane Screens). An exact fit must divide out the random size the
  kit gives each splat (lane Screens).

### Review

- Judge an effect as a clip at phone size, not as a still, and post the clip before asking for a
  merge (lane E1b).
- Play every tap frame by frame in a test and check that its last moment matches the rest pose and
  the morph channels are back at 0 (lane E4).
- A GIF clip needs one palette for the whole clip, or flat colors split into blocks; the blocks were
  in the clip, not the toy (lanes Pictures and Screens).
- Look at legibility in the real app at 390 by 844, and make clips 480 pixels wide, because 320
  looked blurry on the phone (lane AI).
- Fix the cause. The AI text was made lighter for three review rounds before round 4 fixed it at its
  root (lane AI).
- Real photos, not our own kit renders, give an image-to-3D toy a real look (lane G).
- Help text says "the toy" does something only where it is true of the toy, and leaves out facts it
  cannot confirm (lane HelpTextA).
- Check every claim in a document against the code. The Manual's own example toys had a color in a
  format the kit does not read, and a picture-toy sample that showed a blank page back, until the
  audit built and looked at them (lane Learn).

### Parallel lanes

- An engine change goes in a small "Engine: …" PR that merges first: F's #45 before #42, AI's #56
  before #52, G's #47 before #48, and Screens' #71 before #72 (lanes F, AI, G and Screens).
- A lane test that counts a shelf's toys exactly breaks when another lane adds a toy. Count only the
  lane's own toys; the Manual's toy broke two finished lanes' tests, fixed in #69 (lanes Manual and
  Screens).
- A shared test that names a toy as its "no entry" example breaks when a text lane gives that toy an
  entry; the Operator fixed it in #61 (lane HelpTextB).
- Two text lanes editing one file keep both sides on a conflict, then run the help test (lanes
  HelpTextA and HelpTextB).
- PR #66 merged early with only the handoff, so the Screens toys came in a new PR (lane Screens).
- Seven parallel builders once used up a week's usage in one go, so the Operator watches the limits
  and paces the lanes, up to eight at once (lane Operator).
- The owner's cuts happen: emoji were dropped from the math toys because letters mattered more (lane
  Math).

### Tools

- A full test run rewrites other lanes' screenshots as well as the standard ones. After it, run
  `node tools/upkeep.mjs --restore-shots` and `git checkout -- tests/screenshots/`, then add your
  own (lane G).
- Read splat centers in the page (`player.stage.toy.resource.centers`) to place rig regions; that
  found the fly's legs that the renders hid (lane E1b).
- A rare engine warning (a texture-format mismatch in an instanced draw) came back four times from
  E2 to E6a; keep the test results if it returns (lane E2). The strawberry smoke test failed once
  under load and passed on the rerun (lanes E5 and E6a).
- The `chop` voice is a helicopter rotor, not a knife; knife chops are `slap` plus `crack` (lane
  E5).
- Where a recipe leaves a tap unclear, render a filmstrip (`effect-clip.mjs --strip=8`) and read the
  drive code; HelpTextB did this for about 45 toys (lane HelpTextB).
- In an automated browser the help line shows only with `?help=show`, so stage screenshots stay
  steady (lane Help).
- Page screenshots stall in the stepped-clock clip tool once a toy animates, so capture the stage
  canvas instead (lane Screens). And `pkill -f` with a pattern that also appears in the same command
  line stops that shell too (lane Screens).
- Keep a document's code samples in files that a test builds, and have a test compare the page with
  the files, so a sample cannot drift from the code (lane Learn).

## The two models

From September 29, 2026 each lane runs one assigned model (the Models section above), so the
notebook can compare Opus 5.5 and Sonnet 5.5 on the same kinds of numbers. For every lane the
notebook records, from the Operator's check-ins and the owner's marks:

- **Time**: how long the lane ran, from its start to READY (hours), and how long to merge.
- **Rounds of fixes**: how many review rounds came after the first (each redone clip is a `-r2` or
  `-r3` card).
- **First-time "good" marks**: how many of the lane's cards the owner marked good on the first
  review, out of how many.
- **Test failures before READY**: how many full test runs failed before the lane said READY, and
  what caused each.

What the records show today:

- **Time**: only the Operator's rows for Manual (about 2.5 hours) and Screens (about 6 hours). The
  earlier lanes have merge dates and no hours.
- **Rounds and first-time marks**: stated in the records for most lanes from Phase E2 on (see the
  rows above), and not for Phases A to D.
- **Test failures before READY**: no lane gives a count. The records mention only single events: the
  strawberry smoke test that failed once under load (E5, E6a), a cat-statue warning (E6a), two stale
  help tests (HelpTextB), and count tests that broke when a lane added toys (Manual).
- **Model**: named in the record for Screens; for the other early lanes, only the rule that they all
  ran Opus 5.5.

A caution for the blog: lanes differ in size and kind (an engine lane against a text lane), so the
notebook's numbers compare lanes, and they compare models only where the lanes are alike. Nothing is
estimated: an empty cell stays empty.

**The blind A/B toy.** The roadmap plans one small toy, built by each model, that the owner marks
without knowing which is which. The plan for the notebook, proposed by this lane for the Operator to
decide:

1. One small toy the owner wants, with one written brief that both models get word for word, on the
   same repository state, at the default effort, in two lanes at the same time.
2. Each lane posts its clip and card under a neutral name (toy A and toy B). The Operator alone
   keeps the key that says which model built which, and never tells the owner until the marks are
   in.
3. The owner marks each toy good or fix with a note, as for any card; a fix round, if there is one,
   is blind too.
4. The notebook then records, for each side: the model, time to READY, rounds of fixes, tests
   failing before READY, the size of the toy and its recipe, and the owner's marks and notes,
   followed by the reveal.
5. The blog shows both clips side by side and says plainly what the numbers can and cannot show from
   one toy.
