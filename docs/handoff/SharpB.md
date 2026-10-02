# Lane Sharpness B: sharper food, toys, math and AI toys, and closed bases

Prefix `shb`. Branch `claude/lane-sharp-b`. PR "Phase Sharpness B: sharper food, toys, math and AI,
and closed bases". How lanes work: [OPERATING.md](../OPERATING.md).

## Brief

(Written by the Operator on October 2, 2026, from the owner's review of that day)

On October 2 the owner went through every toy on the preview build
(docs/reviews/2026-10-02-mega-review/review.md, word for word). He keeps saying the same thing about
many toys: "a little grainy", "could be sharper", and, turning toys over, that some have hollow or
see-through bottoms. He wants all of it fixed before the team moves on, and he approved this second
sharpness lane. Lane Sharpness A (#172, docs/handoff/SharpA.md) is doing the landmarks, vehicles,
Medieval, Open me, gems, space and weather now: read its handoff and PR for what worked, plus
PACKS.md section 7c ("Sharp kit toys"), docs/handoff/Sharpness.md, FidelityA.md and FidelityB.md.
The materials rule applies: real-looking materials, no see-through solids, no blur, no speckle. Keep
every toy's shape, effect, sound and splat budget per tier; only the look gets sharper (and the bases
closed).

### Part 1: sharper (his words in brackets; read his full note for each in the review)

- Food: birthday-cake ("sharper overall: the icing on the sides, the plate, everything"), popcorn
  (the bucket "a little sharper"), pancakes (the plate and the whole toy), croissant ("especially the
  plate"), coffee ("sharper, less grainy"; its sound is perfect), orange, kiwi, pizza (the cheese
  stretch "slightly more subtle", less grainy).
- Toys: teddy-bear ("really grainy"), yo-yo.
- Nature: coral ("a tiny bit sharper").
- Math: menger-sponge ("grainy"), gyroid, platonic, surface-plotter ("especially the square and the
  controls under it, which are blurry"), lorenz ("maybe a little sharper; fine as is": lowest
  priority).
- AI: cnn ("some parts are still not sharp enough"), gaussian-splatting (the Sorting view: "the
  sorter above the splats is grainy").
- Photo album: the leather, linen and scrapbook covers look like real textured material (now blurry
  and grainy).

### Part 2: closed bases (the audit)

Turn every toy over (all shelves, labs included) and close hollow or see-through undersides, so a
toy looks solid from below the way the real object would. His list: cactus, strawberry, raspberry,
blackberry, blueberry (slightly), tomatoes, basket, real alarm clock (maybe), boombox (maybe), carrot
cake (slightly), real tin can, quartz cluster, bonsai, coral (from below you see stones that aren't
there from above), succulent (the pot has no bottom), pebbles (rocks), kelp, snow globe, tornado,
waterfall, birthday cake (slightly), popcorn tub. Keep as they are: lava lamp, volcano and geyser.
Bricks: hollow undersides are right for real bricks, but check they read as bricks. Then check every
other toy the same way and fix what you find; write the list (toy, what was open, what you did, or
"fine") in docs/audits/bases-2026-10.md. A scan's underside may need a kit-built base or a cap with
hard edges rather than smeared splats (effect quality rules: never bend or smear a scan).

### Who else is in these toys

- Physics (#176, #184) is building hands-on play for jelly, amoeba, pebbles (rocks), bricks,
  macarons, cherries, spring toy, sushi and the bow. The owner also asked for jelly, bricks and sushi
  to be sharper: do those three (and the pebbles' base) last, after checking with the Operator that
  Physics part 2 (#184) has merged or that your change only touches the look, so the two don't
  collide.
- Fix7 part 2 (#179) is fixing the pancakes' syrup, burger, taco, apple, banana, candy cane, hoodie
  and snowman. For the pancakes, change only the plate and the look; if you need the same lines, say
  so.
- Sharpness A (#172) owns quartz-cluster and tornado: do their bases only after #172 merges (merge
  main first), or leave them in the audit list for the Operator.
- Fix7 part 1 (#174) changed the gaussian-splatting one-splat view; your change is the Sorting
  view's sorter only.
- Sound C owns every sound: don't touch sound entries.
- Live input r3 sharpens the Room echo meter's screen text; leave that toy alone.

Work in this order: food, toys and nature, math, AI and the photo album, then the bases audit. For
each sharpened toy, a before/after still pair and a short clip of its tap; for bases, a before/after
still from below. All at 390×844 in your lane record "SharpB" on Effect review page 2 ("built by Opus
5.5"). Batch cards by shelf so the owner can mark a shelf at once. These are public toys: the PR
merges after his good marks, so post cards as each shelf is done rather than all at the end. Check
`node tools/check-packs.mjs <pack>` stays within budget and frame time on every pack you change.

### You own

- The looks and bases of the toys above in their pack files (recipes' shapes, materials, splat
  placement and sizes), their thumbnails, docs/audits/bases-2026-10.md, tests/shb.spec.mjs, your
  `shb-*` screenshots and docs/handoff/SharpB.md.

Lanes Sound C, Fix7, Physics, UI r5, Sharpness A, Fluids, Video 3D, Live input, Science and the
Integrators run at the same time; leave their files alone. The laptop is locked.

## State

Model: Opus 5.5 (claude-opus-5-5), default effort.

- October 2, 2026: started. Before stills and the from-below audit renders under way.

## Notes

## Known issues

## For the Operator
