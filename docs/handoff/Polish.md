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

- October 14, 2026: round 1 (audit) started on main 41b21e74. Clips render in the session's
  scratchpad; nothing in the toys has changed yet.

## Notes

## Known issues

## For the Operator
