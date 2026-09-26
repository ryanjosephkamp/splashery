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

2026-09-26: all four fixes are built, in draft PR #37 ("Phase E4-finish: the E4 review fixes") from
`claude/sweet-babbage-gw9z9r` (restarted from main after #33 merged). Clips of the fixes are on the
Effect review page as `e4-<toy id>-r2` cards in lane E4, group "fixes", and replace the four clips
the owner marked. Waiting for the owner's marks.

## Notes

- **Pinecone** (`src/packs/nature.js`, `looseScale`, `CONE_LOOSE`, `CONE_SEEDS`): the 42 scales
  facing the home camera most squarely are tokens (a window with none left standing on the bare
  core); the other 78 keep the morph opening. Six seeds (tokens) spin out first. A loose scale
  breaks off from the bottom up, tumbles and lands flat in a pile round the base (a scale that lands
  on others lies a little higher), and flies back top first. Each leaves a small broken stub on the
  core, hidden under it at rest. 7.2 s.
- **Lava lamp** (`src/packs/elements.js`, `LAVA_SETS`, `lavaBlobs`, `lavaGlassR`): new options
  Colour set, Blobs (2 to 12), Blob size (0.5 to 1.5) and Blob shape (mixed, round, tall), and new
  sliders Flow (a quarter to one and three quarters as fast) and Glow (the wax and liquid lit from
  within at rest). The six classic blobs come first; extra ones each have their own seed, so a blob
  keeps its path whatever the count; blobs get smaller as they get many; a blob made bigger rises
  less far so it stays in the glass. Flow runs a clock kept in `mem(c)`, so a change of speed never
  jumps. The default lamp builds exactly as before (same splats; checked by hashing the build), so
  its thumbnail was not re-rendered. A colour set other than "Pick below" ignores the Wax and Liquid
  pickers (the Base picker still works).
- **Ice swan** (`ICE_PIECES`, `iceAttached`, `icePose`, `ICE_DROPS`): the `melt` kind is gone. Ten
  parts, each melting by getting smaller about where it joins the rest and riding on the piece it
  grows from (`on`), so nothing hangs in the air; four of them (the wing tips, the head, the top of
  the neck) crack off, fall from where they were and melt in the puddle beside the pedestal (never
  in front of it, where the pedestal would draw over them). The melt level runs faster and faster
  (`L = 0.93 u^1.6`); lowered again after a piece has melted away on the ground, the piece grows
  back in place (a per-toy memory of the highest level). Thirty drops are tokens that bead at the
  low points and fall. The refreeze reverses the melt, then the frost front runs (7.6 s). 13 parts,
  30 tokens.
- **Ocean wave** (`OW_KEYS`, `owPose`, `OW_CTL`): the wave is now the same all along z, and its
  water is two sheets (the main curve: the sea in front, the face, the crest and the back; and the
  lip) skinned (`kind: "skin"`) to 28 and 10 control tokens that run through eight keyframes on
  Catmull-Rom paths, a closed loop from the resting curl. Skinning moves splats in the profile's
  plane only, and the camera looks nearly along z, so the draw order holds. The home camera turned
  to three quarters (`src/toys.js`: yaw 0.6, pitch 0.22), which shows the curl as a wave; the sea
  and the wave's ends fray (splats dropped by a colour function returning null) instead of stopping
  at a straight edge. Spray is ten clumps now (was 44), to make room for the controls. 5.8 s.
- Sounds re-timed in `src/toy-sounds.js` (pinecone, ocean wave, ice swan); the wave's swell and curl
  and the ice swan's cracks, refreeze crackle and sparkle are cues from drive().
- `tests/e4f.spec.mjs`: the lava lamp's options keep its blobs in the glass, Flow never jumps, the
  ice swan's Temperature melts it and brings it back whole, the wave's keyframes move the whole face
  and every skinned splat names real controls, and the pinecone's tokens fit.

## Known issues

- Checked as clips and larger stills in headless Chromium (SwiftShader, WebGL2 only), not on a
  phone; sounds by level and length only.
- Ocean wave: at the moment of impact the white water appears as a white curved sheet for about 0.1
  s before it falls flat; the sea's ripple and the foam's twinkle pause while the wave breaks (as
  before); the wave is a straight tube along its length (no peel), and its near end shows the
  profile's edge.
- Ice swan: the wing tips break along a straight line at a fixed height, so the wings are left with
  flat tops while they melt; the pedestal itself does not melt.
- Pinecone: only the side facing the home camera breaks off; from behind, the far side's scales just
  open and close.
- Lava lamp: some colour sets read less clearly at 320 px, since the liquid tints the wax.

## For the Operator

- PACKS.md lessons: (1) a skinned sheet (`kind: "skin"`, two tokens per splat) is how to bend a
  whole surface through keyframes (the ocean wave); keep the bending in the plane the camera looks
  along, and use rounder splats. (2) Pieces that melt should ride on the piece they grow from (scale
  about the parent's pivot too), or they are left hanging (the ice swan's `iceAttached`). (3) A
  colour function that returns null for more splats towards an edge makes a surface fray into its
  surroundings instead of stopping at a straight line.
- The lava lamp's option set could become a pattern for other toys: a preset select plus the
  pickers, with the pickers ignored by a preset (the UI cannot hide an option by another's value).
