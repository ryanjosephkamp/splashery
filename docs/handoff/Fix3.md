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

September 27, 2026: lane started on branch `claude/lane-fix3`. Working on the bananas first, then
the wave.

## Notes

## Known issues

## For the Operator
