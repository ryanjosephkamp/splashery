# Lane Polish

## Brief

You are a Splashery worker session (lane "Polish", prefix `pol`), started by the Operator
(session_01UFMfX9RBAFMSqMHSrisZuo) for the owner, Ryan. Model: Opus 5.5, high effort. Repo:
ryanjosephkamp/splashery. Branch: `claude/lane-polish` (and `claude/lane-polish-engine` for any
small additive "Engine: …" PR). PR title: "Phase Polish: the favorites at their best". Handoff file:
docs/handoff/Polish.md (this brief under "## Brief", then "## State",- October 15, 2026, round 2
(WORKING): Ryan marked all 13 audit cards good (through the Operator's routine). Engine PR #643
(`claude/lane-polish-engine`: a morph channel that shrinks as it goes, and a nearer fade in the free
science view) is open and merged into this branch; it must merge first. Done in the lane so far: the
Chladni plate (framed on the plate, the mode named beside it, a wider bow hair shown beside the
tilted stick, a soft sheen), Sound in a box (faint glass walls), the Song landscape (a C ruler in
front of the plain, a ten-second reading key), Model to splats (the lift on shrinking channels and
farther out, framed on the model), Powers of ten (the 3 km picture color-matched by
`tools/pol-aerial-match.mjs`, crisper planet dots and brighter orbits), the microscope (a scale bar
and the slice's depth), the galaxy (the hot halo as a faint haze the tap peels away), and Point
clouds (bigger points, framed by the diagonal, a height key, About text). The page toys (Picture
lab, Your book, Photo album) are with this lane's helper.

"## Notes", "## Known issues", "## For the Operator").

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

- October 14, 2026, READY: round 1 (audit) done on main 41b21e74; nothing in the toys has changed.
  All 13 cards are on Effect review page 2, lane `Polish`, ids `pol-<toy id>`: each a phone-size MP4
  (390×844) and numbered fixes, most valuable first, each marked small, medium, or large, in its
  "You said" line. Waiting for Ryan's marks (through the Operator) before round 2.

## Notes", "## Known issues",

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

- October 14, 2026: round 1 (audit) on main 41b21e74. Nothing in the toys has changed. Cards posted
  on Effect review page 2, lane `Polish` (8 of 13 so far): `pol-splat-mirror`, `pol-chladni-cell`,
  `pol-chladni-plate`, `pol-song-landscape`, `pol-powers-of-ten`, `pol-smlm-microscope`,
  `pol-galaxy-box`, `pol-volume-viewer`. Each has its phone-size clip and numbered fixes (small,
  medium, or large) in its "You said" line. Still to post: `pol-picture-lab`, `pol-your-book`,
  `pol-photo-album`, `pol-model-splats`, `pol-point-clouds`.

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

## For the Operator

- Please create `lanes/Polish` on page 2 (model: Opus 5.5); the cards show under the bare id until
  then.
- The audit found real misses on the science toys (the microscope's deep zoom is blur, the galaxy's
  hot gas never shows, so its tap changes almost nothing) and on Model to splats (the lift is a
  puffball); the walnut, the crater and the Chladni plate's sand are already right.
