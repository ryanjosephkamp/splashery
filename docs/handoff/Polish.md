# Lane Polish

## Brief

You are a Splashery worker session (lane "Polish", prefix `pol`), started by the Operator
(session_01UFMfX9RBAFMSqMHSrisZuo) for the owner, Ryan. Model: Opus 5.5, high effort. Repo:
ryanjosephkamp/splashery. Branch: `claude/lane-polish` (and `claude/lane-polish-engine` for any
small additive "Engine: …" PR). PR title: "Phase Polish: the favorites at their best". Handoff file:
docs/handoff/Polish.md (this brief under "## Brief", then "## State", "## Notes", "## Known issues",
"## For the Operator").

Read CLAUDE.md (above all "Effect quality rules"), docs/PACKS.md ("Effect quality"),
docs/OPERATING.md ("The Effect review page", "Steps for a lane"), and
docs/studio/photo-3d-checkpoint.md (the checkpoint idea).

### The job

Ryan's favorite toys get an expert look as motion at phone size, then the fixes he approves. Your
toys (toy id): Splat mirror (`splat-mirror`), Sound in a box (`chladni-cell`), Chladni plate
(`chladni-plate`), Song landscape (`song-landscape`), Picture lab (`picture-lab`), Your book
(`your-book`), Photo album (`photo-album`), Model to splats (`model-splats`), Powers of ten
(`powers-of-ten`; Codex task 81 is rewording two labels in src/powers/stops.js, so leave those
strings alone), Super-resolution microscope (`smlm-microscope`), Galaxy in a box (`galaxy-box`),
Point clouds (`point-clouds`), Volume viewer (`volume-viewer`). Not yours (other work is running on
them): the QR toys, Photo to 3D, Moving photo to 3D, Video to 3D.

Every one of these toys is saved on the branch `claude/checkpoint-toys-2026-10-14`: any change must
be at least as good as that version on every point, or it doesn't ship.

**Round 1, audit (about two hours):** for each toy, render phone-size clips (390×844,
`tools/effect-clip.mjs`) of its main interactions, judge them hard against the Effect quality rules
and against what the toy claims to show (a scientist, a musician, a photographer looking at it: is
it right, is it beautiful, is it clear?), and post one card per toy on Effect review page 2
(https://claude.ai/artifact/BSayVkzQ2FKESesrkrSUMK) as OPERATING.md "Steps for a lane" says (no
republish; ids `pol-<toy id>`), each with the clip and a short numbered list of proposed fixes, most
valuable first, each marked small, medium, or large. Then stop with READY so Ryan can mark them.

**Round 2, fixes:** after his marks (the Operator passes them on), fix what he approved, post `-r2`
cards with before-and-after clips, and keep the rest of each toy exactly as it was.

Rules: these toys are public, so nothing merges without Ryan's "good" marks; the Operator merges.
Engine changes only as small additive Engine PRs merged first. Never edit `tests/taps.spec.mjs`;
your tests go in tests/pol\*.spec.mjs. Follow CLAUDE.md "Before every push" (check-packs, contact
sheet, thumbnails, screenshots `pol-*`). Finish every turn with "READY:" (cards to mark), "WORKING:"
or "BLOCKED:".

## State

- October 15, 2026, review fixes READY; the lane stands down. Ryan marked all 11 `-r2` cards good.
  The Operator's five fixes from PR #636: (1) the Storybook keeps main's book exactly: its recipe's
  `polish: false` turns off every book change of this lane (`POL` in `src/packs/pictures.js`: the
  pull-back views, the wait before a turn, the wider page view, the cover figure, the link slack and
  tint, the bare pages, and drawn figures), with tests that its views, timings, links, and figures
  are main's. (2) Engine: the phone slider is narrower only when Play shares its row (no Play, or a
  game bar, keeps main's width), tested by the page's own bars and on Powers of ten at 390×844. (3)
  Engine: `pdfFigures`' plain path is literally as before (`withDrawn &&`). (4) The photo card's
  shape is read from the built buffer; the Storybook's figures are asked for without options; bk5's
  bare-page check is strict again. (5) The 3 km picture's color match is recorded in
  `tools/assets.json` and `CREDITS.md`, and `tools/pot-maps.mjs` runs `tools/pol-aerial-match.mjs`
  after a fetch, so a rerun keeps it. Engine PR #643 (`claude/lane-polish-engine`) has the engine
  part; it is merged into `claude/lane-polish`, and main is merged into both. Local: pol 6 of 6,
  pol-engine 5 of 5, pol-pages, bk5, and hh3-storybook all passing (31 of 31 plus the new phone
  test).

- October 15, 2026, round 2 READY: Ryan marked all 13 audit cards good; all 13 have their round 2
  answer. `-r2` cards (before on the left, after on the right) on Effect review page 2 for 11 toys;
  each says what changed, what didn't, and why. No change, with reasons: the Splat mirror (its ghost
  comes from the relief's background layer, shared with Photo to 3D) and the Volume viewer (the
  gar's colors are its data; the stair steps and the cut-face shading are in `src/volume/`). Engine
  PR #643 (`claude/lane-polish-engine`; merge it first): a morph channel that shrinks as it goes, a
  nearer fade in the free science view, drawn PDF figures only when a toy asks (`{ drawn: true }`:
  Your book, the album and the lab; the Storybook and the Arcade's pages unchanged), and the stage's
  depth slider clear of the Play button on phones. Its full suite (an earlier head) failed only
  man5:201 and tpg:205, both on CI's known list. Local: pol-engine 5 of 5; the page toys' specs (bk,
  bk5, pg6, pic, pdf, hh3-storybook, vw, pol-pages, pol-engine) 129 of 129; the other changed toys'
  specs 170 passed and 2 timed out under load, both passing alone. The page toys' thumbnails stay as
  they were (the thumbnail tool shot them before their pages built).

- October 14, 2026, READY: round 1 (audit) done on main 41b21e74. All 13 cards are on Effect review
  page 2, lane `Polish`, ids `pol-<toy id>`: each a phone-size MP4 (390×844) and numbered fixes,
  most valuable first, each marked small, medium, or large, in its "You said" line.

## Notes

- How the audit clips were made (all at 390×844, the clock stepped by hand): `tools/lv10-clip.mjs`
  (the plate with the test song, the cell's mode tour), `tools/live-clip.mjs` (taps with the page's
  own UI; the mirror on `tools/lv7-mannequin.mjs`'s talking mannequin with `--video --depth`; the
  Song landscape with `--song`), `tools/sci-clip.mjs` (`sci-microscope-r3`,
  `sci-microscope-nucleus-r2`, `sci-galaxy-r4`), `tools/vol-clip.mjs` (`vol-walnut-cut`,
  `vol-gar-sweep`) and `tools/pot-clip.mjs` (`--z=0.3,7,14,21.4 --secs=16` out,
  `--z=0.3,-3,-6,-7.5 --secs=14` in). Clips joined with ffmpeg. The Picture lab, Your book, Photo
  album, Model to splats and Point clouds clips came from one helper's recorder (a copy of
  `live-clip.mjs`'s approach, kept in the session's scratchpad, not in the repo); its Picture lab
  photo clip and Your book cover clip are short, and in the album clip a tap on the left half closes
  the album again (the recorder's aim, not a toy bug).
- `tools/lv10-clip.mjs --tour` rings only the cell's modes; for the plate it never taps, so the sand
  stays scattered (a tool limit, not a toy bug).
- The relief code (`src/live/relief*.js`) is shared with Photo to 3D, which isn't this lane's: a
  mirror fix stays in the mirror's own path.

## Known issues

- Your book, one page at a time: the view pulls back as the page lifts, so the leaf still looks
  large for a few frames mid-turn, and a tap turn now starts 0.3 s later (0.4 s for the cover).
- `tests/bk5.spec.mjs` (lane Books r5's file) has two expectations relaxed for the bare-page redraw
  (Pop out's link boxes fade after 1.6 s).

## For the Operator

- Please create `lanes/Polish` on page 2 (model: Opus 5.5); the cards show under the bare id until
  then.
- The audit found real misses on the science toys (the microscope's deep zoom is blur, the galaxy's
  hot gas never shows, so its tap changes almost nothing) and on Model to splats (the lift is a
  puffball); the walnut, the crater and the Chladni plate's sand are already right.
