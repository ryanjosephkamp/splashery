# Lane PT2: One splat, many splats, a real tap and a new sound

Built by Opus 5.5 (high effort). Session: https://claude.ai/code/session_01CZNmxeX9LLr96bBW74fR7c.
Branch `claude/lane-pt2`. Prefix `pt2`.

## The brief

The owner's review of October 16, 2026 (in the Operator's words): the toy's sound was awful, and a
click did nothing meaningful where the person clicked. The reference is Ryan Kamp's One Splat
portfolio page (the exact hierarchy, the ledger, the level dial, and the probe).

## State

Built and tested; draft PR open, clips on Effect review page 2 under lane `PT2` (three cards).

- **The tap** (`src/packs/one-splat.js`, `action.at`): the splat under the finger (the reference's
  Mahalanobis pick) splits into its two children along the real tree. The children are built in
  place with their parent's center as a morph target (channel 0), and the parent itself is drawn
  once more as a fading splat (`kind: "fade"`, channel 0), so the parent visibly comes apart into
  its halves over 1.8 s. A second tap there goes one level finer. At the finest level, a tap merges
  the piece back.
- **The hold** (`drag.start`, 420 ms): on a tapped piece, merges its parent back (it and every
  refinement inside it) through `player.switchTo`, the same path a tap that changes the toy takes,
  and sets `player.dragFired` so the press is not also a tap. The two halves slide together and
  shrink into the parent (morph channel 5: channel 1 with the shrink), drawn just behind it, as the
  parent fades in (channel 1). On a piece that can't merge, the hold shows its numbers, as before.
- **The readout** (`#one-splat-readout`) on every tap and hold, inside the stage's top-left corner:
  level, splat index, pixel count, center, size, angle, covariance, the two halves' counts and the
  ledger's residual (`checkSplit`). A tap's stays 6 s or until the next press; a hold's while the
  finger is down (as before); it goes when another toy opens.
- **The sound**: `action.quiet: ["split"]`, and `drive` pushes one cue per split or merge as the
  animation starts: a soft sine (`voice: "tone"`) on a pentatonic scale, G3 at level 0 up to E6 at
  level 14 (`LEVEL_NOTES`), finer higher; a merge is a little shorter and quieter. The
  `src/toy-sounds.js` entry is the level-4 note (the Sound Board plays it). Sound lint: ok, peak
  0.08.
- **Opens at level 4** (16 splats) instead of 13 (8,192), so the first tap visibly splits a piece.
  The dial still runs 0 to 14.
- New hidden option `lastMerge`; `splits`, `splitSource`, `splitLevel`, and `lastSplit` keep their
  meaning, so old links load the same refinements.

## Tests

`tests/pt2.spec.mjs`: the tap rules in Node (split, finer, merge at the finest level, pitch by
level); taps and a hold-merge in the browser at 390×844 and 1440×900 (ids, readout, cues, the press
not also a tap, the level dial); two frozen pre-change `#s=` links (refinements and a typed word).
`tests/cdx-pfa.spec.mjs` (this toy's Codex test): the opening count is 16, and right after a split
the buffer holds three splats (the two children and the fading parent).

## Known issues

- Links keep printable ASCII text only (the engine's `normalizeOptions`), so a typed emoji word
  falls back to "Splashery" when reopened from a link. That was so before this lane.
- The merge clip was recorded live at about 6 frames a second (`tools/drag-clip.mjs` holds don't run
  the recipe's wall-clock hold timer), so it looks choppier than the toy.

## For the Operator

- The opening level changed from 13 to 4; if the owner prefers the sharp word first, set `default`
  back to 13 (one line) and the two counts in `tests/cdx-pfa.spec.mjs`.
