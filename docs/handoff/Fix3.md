# Lane Fix3: two fixes from the owner's September 27 review

Prefix `fix3`. Owns the `banana` recipe in `src/packs/food.js` and the `ocean-wave` recipe in
`src/packs/elements.js` (those two recipes only, plus helpers only they use), their entries in the
shared lists, `tests/fix3.spec.mjs`, the `fix3-*` screenshots and this file. How lanes work:
[OPERATING.md](../OPERATING.md).

## Brief

Written by the Operator on September 27, 2026, from the owner's marks on the Effect review page.

Two toys the owner approved earlier need one more fix each. Both packs are frozen except for these
two recipes, which this lane owns.

You own: the `banana` recipe in src/packs/food.js and the `ocean-wave` recipe in
src/packs/elements.js (those two recipes only, plus helpers only they use); their entries in
src/toy-sounds.js and tools/toy-plan.json (TOY-PLAN.md regenerated); their rows in src/toys.js if a
fix needs one; tests/fix3.spec.mjs; your `fix3-*` screenshots; and docs/handoff/Fix3.md.

1. Bananas (`banana`, card e5-banana-r2). The owner's words: "Sorry to have approved this one
   earlier than I should have... I've attached a screenshot of this – the stem (I think it's a stem)
   of the middle banana is really awkward and not connected properly. Can you fix that for me?" His
   screenshot is on the Effect review page's asset store: read it with the Artifact tool (action
   "read", url https://claude.ai/artifact/NCsg9V5SzFY3Mnwuwgq7pi, path
   "aabd7d7ecb48fc76ff10c90a3e5f68b4"). It shows the bunch pulled apart and peeled: the middle
   banana's dark stem stub hangs off by itself, up and to the left of the banana's neck, not joined
   to it. Find which piece that is (the banana's own stalk, or a crown piece left behind) and make
   every stalk stay joined to its banana through the whole tap, as a solid piece. Keep what he
   liked: the three bananas pull apart and each peels in three strips. Read docs/handoff/E5.md first
   (the bananas are seven pieces each, 21 tokens).
2. Ocean wave (`ocean-wave`, card e4-ocean-wave-r2). The owner's words: "Sorry to have locked this
   in too early... the rebuilding of the wave looks basically perfect, but the collapse happens
   awkwardly; it should be smooth, not so jagged, and it needs to happen more naturally." Keep the
   rebuild as it is. Make the collapse read like a real plunging breaker: the lip throws forward and
   plunges, the curl closes over, the white water rolls forward as a foaming wall and spreads flat,
   all smoothly with no jumps, tears or jagged edges in the sheet. Known issue to fix on the way: at
   impact the white water shows as a white curved sheet for about 0.1 s before it falls flat. Read
   docs/handoff/E4-finish.md first (the wave is two skinned sheets on 28 and 10 control tokens
   through eight Catmull-Rom keyframes; PACKS.md has the skin lessons). Judge it as motion at phone
   size, frame by frame through the collapse.

Post clips as cards fix3-banana and fix3-ocean-wave (lane record "Fix3"), and set replacedBy on
e5-banana-r2 and e4-ocean-wave-r2 to point at them. Check the owner's marks (verdicts starting with
"fix3-") hourly, as below.

## State

September 27, 2026: both fixes are built, in draft PR #54 ("Phase Fix3: the banana's stem and the
ocean wave's collapse") from `claude/lane-fix3`. Clips are on the Effect review page as cards
`fix3-banana` and `fix3-ocean-wave` (lane record "Fix3"), replacing `e5-banana-r2` and
`e4-ocean-wave-r2`. The owner marked the wave good and the bananas "fix" (remove the crown); the
redo is card `fix3-banana-r2`, waiting for a mark.

## Notes

- **Bananas** (`banana` in `src/packs/food.js`): the piece hanging loose in the owner's screenshot
  was the bunch's crown, a plain shape with no token, so it stayed where it was built while all
  three bananas (tokens) pulled away from it. The first fix put it on the middle banana's token; the
  owner marked that "fix" ("Just remove that stem ... so the top-left end of each banana looks the
  same"), so r2 removes the crown altogether. Each banana now ends in its own neck and stalk tip,
  the same on all three, and every splat of the toy is on one of the 21 tokens
  (`tests/fix3.spec.mjs` checks). The thumbnail was re-rendered.
- **Ocean wave** (`ocean-wave` in `src/packs/elements.js`, `OW_ROLL`, `OW_FALL`, `owFallIndex`):
  - The old collapse eased in and out of every keyframe (`ease()` per segment), so the wave stopped
    dead at the moment the lip hit the water and again at each key after it, and the keys between
    the impact and the flat water folded the face into a notch and the lip into a straight ramp.
  - The fall (from the rest curl to the flat water of key 4 at 2.2 s) now runs through its own keys
    on one clock: a smooth monotone curve through the keys' times (still at the start and at the
    end, never stopping between), and Catmull-Rom paths through the keys. It keeps the throw (keys 1
    and 2) and replaces key 3 with three keys where the barrel the lip closes shrinks as it rolls
    forward (the lip's tip stays where it plunged in), down to a low roll that meets the flat water.
    The rebuild (2.2 s on) runs exactly as before, through `OW_KEYS` (key 3 is still there for its
    first segment's path).
  - White water: the copy of the landed lip that flashed as a white curved sheet and fell flat is
    gone. A lumpy wall of foam (a cloud, part `bore`) is built round the roll at its fullest and
    fades in on channel 0 from the place the lip plunged in, so it froths up out of the plunge and
    climbs over the roll; as channel 0 falls it sinks away from the top (a fade, so no speckle) into
    the existing lace on channel 2, drifting forward a little. The lip goes (by size) while it is
    under the foam.
  - The spray off the lip at rest now goes over 0.3 s after the tap (was 0.05 s).
  - Sounds unchanged: the impact is still at 0.8 s and the rebuild's cues are where they were.

## Known issues

- Checked as clips and frame grids in headless Chromium (SwiftShader), not on a phone.
- Ocean wave: the foam wall's near end still reads as a fairly straight edge from the home camera
  (it frays, but less than the sea); the near end of the wave shows the profile's edge (as before).

## For the Operator

- PACKS.md lesson: keyframes eased one by one (`ease()` per segment) stop the motion at every key.
  For motion that should flow through keys (a falling wave), run one clock through all of them: a
  monotone curve from time to key index, still only at the start and end, then Catmull-Rom between
  the keys (`owFallIndex` in `src/packs/elements.js`).
