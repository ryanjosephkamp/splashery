# Lane Sharpness A: sharper toys from the October 2 review, part A

Prefix `sha`. Branch `claude/lane-sharp-a`. PR "Phase Sharpness A: sharper landmarks, vehicles,
Medieval, Open me, gems, space and weather". How lanes work: [OPERATING.md](../OPERATING.md).

## Brief

(Written by the Operator on October 2, 2026, from the owner's review of that day)

On October 2 the owner went through every toy on the preview build
(docs/reviews/2026-10-02-mega-review/review.md, word for word). He keeps saying the same thing about
many toys: "a little grainy", "could be sharper". He wants every one he named sharp before the team
moves on, and he approved this lane ("start now"). Read PACKS.md section 7c ("Sharp kit toys") and
docs/handoff/Sharpness.md and FidelityA.md / FidelityB.md (what worked before) first. The materials
rule applies: real-looking materials, no see-through solids, no blur, no speckle. Keep every toy's
shape, effect, sound and splat budget per tier; only the look gets sharper.

Your toys (his words in brackets; read his full note for each in the review):

- Landmarks: eiffel-tower ("a little grainy"), pyramids ("could be a little bit sharper overall… the
  Sphinx is really not that clear"), leaning-tower ("significantly sharper"), colosseum, parthenon,
  stonehenge, taj-mahal, castle ("I think it could all actually be a bit sharper"), pagoda,
  windmill.
- Vehicles: rocket, helicopter, hot-air-balloon, steam-train, ocean-liner ("a little grainy" each).
- Medieval: trebuchet, crossbow, knights-helmet ("a little grainy"), crown ("a little bit sharper").
- Open me: chest, sword-in-stone, gift-box, laptop ("a little bit sharper"), music-box (its wooden
  box "sharper, kind of like the wooden … Enigma machine"), book (the storybook's text sharper).
- Clothing: running-shoe ("a little bit sharper").
- Gems: amethyst-geode, sapphire, quartz-cluster.
- Space: spiral-galaxy ("too grainy, so it's a little too blurry").
- Weather: storm-cloud ("a tiny bit sharper"), tornado ("the clouds … and the ground could be a
  little bit sharper… the whole thing").
- Holidays: fireworks (the launch tubes "less grainy").

Work in this order: landmarks, vehicles, Medieval and Open me, the rest. For each toy, a
before/after still pair and a short clip of its tap, at 390×844, in your lane record "SharpA" on
Effect review page 2 ("built by Opus 5.5"). Batch cards by shelf so the owner can mark a shelf at
once. These are public toys: the PR merges after his good marks, so post cards as each shelf is done
rather than all at the end. If a toy is better split into its own small PR to merge sooner, say so.

Don't touch these toys' sounds (lane Sound C), Fix7's toys and items (storm-cloud's lightning
position, the shield, fireworks' rapid taps: coordinate through the Operator if you need the same
recipe; your change is the look only), or hollow bases (Sharpness B, later). Check
`node tools/check-packs.mjs <pack>` stays within budget and frame time on every pack you change.

### You own

- The looks of the toys above in their pack files (recipes' shapes, materials, splat placement and
  sizes), their thumbnails, tests/sha.spec.mjs, your `sha-*` screenshots and docs/handoff/SharpA.md.

Lanes Sound C, Fix7, Physics, UI r5, Photoreal (research), Fluids, Video 3D, Live input, Science and
the Integrators run at the same time; leave their files alone. The laptop is locked.

## State

Model: Opus 5.5 (claude-opus-5-5), default effort.

- October 2, 2026: started. Branch made from main, "before" measurements of all 34 toys running.

## Notes

## Known issues

## For the Operator
