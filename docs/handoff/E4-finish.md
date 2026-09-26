# Lane E4-finish: the E4 review fixes

Prefix `e4f`. Owns `src/packs/nature.js`, `src/packs/elements.js`, `tests/e4f.spec.mjs`, this file,
the E4 toys' folders under `assets/toys/` and their entries in the shared lists
(docs/WORKSTREAMS.md). How lanes work: [OPERATING.md](../OPERATING.md). The E4 phase notes (effects,
loose pieces, "built where they end", sounds, known issues) are in [history.md](history.md).

## Brief

Phase E4 (PR #33, merged 2026-09-26) gave the 28 nature and weather toys new tap effects. On the
Effect review page the owner marked 26 of the 30 clips good and four "Needs work". Their notes, word
for word (`verdicts/e4-<toy id>`):

1. **Ice swan** (`ice-statue`, `src/packs/elements.js`): "The ice swan shouldn't melt like an ice
   cream cone – it currently does, and it's basically just squishing downwards. The ice swan is made
   of water, so it melts by dripping water and slowly breaking decomposing, with the melt speed
   accelerating a bit as more of it melts, if that makes sense."
2. **Lava lamp** (`lava-lamp`, `src/packs/elements.js`): "This is basically perfect already, but I'd
   like the user to be able to choose different colors and blob numbers, sizes, etc. if possible."
   The owner wants the lava lamp expanded further (their prompt may list more wishes).
3. **Ocean wave** (`ocean-wave`, `src/packs/elements.js`): "Take a look at this. It doesn't look
   natural. The waves themselves should curl, not just the end."
4. **Pinecone** (`pinecone`, `src/packs/nature.js`): "The actual pieces of the pinecone must fall
   off of the pinecone."

Starting points from the E4 session (2026-09-26):

- Ice swan: drop the `melt` kind (a squash reads as soft ice cream). Cut the swan into solid pieces
  (parts or tokens): extremities (beak, head, wing tips, tail) thin and break off first and drop as
  pieces, while the body wears away piece by piece, faster as it goes; drips fall and a puddle
  grows; then it refreezes with the frost front. The Temperature slider should drive the same melt.
- Lava lamp: the colours are already options (Wax, Liquid, Base). Add a blob count (the current 6 as
  the default) and a blob size, and consider colour presets and other wishes from the owner.
- Ocean wave: a morph moves each splat along one straight line, so a whole-wave curl needs the
  wave's profile as a chain of pieces that turn at their joints (like the fern's fronds), or another
  approach that curls the face and not only the lip.
- Pinecone: a draft on the local branch `wip/e4-review-pinecone` in the E4 session's container (not
  pushed; built but not yet checked by eye) turns the forty scales facing the camera into tokens
  that break off from the bottom up, tumble, land flat on the ground and fly back top first, while
  the others keep the morph opening, with eight seeds.

Post the clips of the fixes as new cards in lane `E4`, group `fixes`, each with the old card's id
plus `-r2` (for example `e4-ice-statue-r2`), and mark the old card `replacedBy` (OPERATING.md,
"Steps for a lane"). Update the plan entries (`improved`), re-render thumbnails only where a resting
look changes, and re-time the sounds that change.

PR: a new draft PR from `claude/sweet-babbage-gw9z9r`, restarted from main, titled "Phase E4-finish:
the E4 review fixes".

## State

Waiting for the owner's prompt.

## Notes

## Known issues

## For the Operator

Lessons for PACKS.md, backlog items and README lines, to move after the merge.
