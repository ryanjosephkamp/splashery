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
every toy's shape, effect, sound and splat budget per tier; only the look gets sharper (and the
bases closed).

### Part 1: sharper (his words in brackets; read his full note for each in the review)

- Food: birthday-cake ("sharper overall: the icing on the sides, the plate, everything"), popcorn
  (the bucket "a little sharper"), pancakes (the plate and the whole toy), croissant ("especially
  the plate"), coffee ("sharper, less grainy"; its sound is perfect), orange, kiwi, pizza (the
  cheese stretch "slightly more subtle", less grainy).
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
blackberry, blueberry (slightly), tomatoes, basket, real alarm clock (maybe), boombox (maybe),
carrot cake (slightly), real tin can, quartz cluster, bonsai, coral (from below you see stones that
aren't there from above), succulent (the pot has no bottom), pebbles (rocks), kelp, snow globe,
tornado, waterfall, birthday cake (slightly), popcorn tub. Keep as they are: lava lamp, volcano and
geyser. Bricks: hollow undersides are right for real bricks, but check they read as bricks. Then
check every other toy the same way and fix what you find; write the list (toy, what was open, what
you did, or "fine") in docs/audits/bases-2026-10.md. A scan's underside may need a kit-built base or
a cap with hard edges rather than smeared splats (effect quality rules: never bend or smear a scan).

### Who else is in these toys

- Physics (#176, #184) is building hands-on play for jelly, amoeba, pebbles (rocks), bricks,
  macarons, cherries, spring toy, sushi and the bow. The owner also asked for jelly, bricks and
  sushi to be sharper: do those three (and the pebbles' base) last, after checking with the Operator
  that Physics part 2 (#184) has merged or that your change only touches the look, so the two don't
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
still from below. All at 390×844 in your lane record "SharpB" on Effect review page 2 ("built by
Opus 5.5"). Batch cards by shelf so the owner can mark a shelf at once. These are public toys: the
PR merges after his good marks, so post cards as each shelf is done rather than all at the end.
Check `node tools/check-packs.mjs <pack>` stays within budget and frame time on every pack you
change.

### You own

- The looks and bases of the toys above in their pack files (recipes' shapes, materials, splat
  placement and sizes), their thumbnails, docs/audits/bases-2026-10.md, tests/shb.spec.mjs, your
  `shb-*` screenshots and docs/handoff/SharpB.md.

Lanes Sound C, Fix7, Physics, UI r5, Sharpness A, Fluids, Video 3D, Live input, Science and the
Integrators run at the same time; leave their files alone. The laptop is locked.

## State

Model: Opus 5.5 (claude-opus-5-5), default effort.

- October 2, 2026: draft PR #185. Sharper (only the look; shape, tap, sound and budget kept, every
  changed pack within budget in `node tools/check-packs.mjs`): the birthday cake, popcorn bucket,
  pancakes (plate and stack only), croissant, coffee, orange, kiwi, pizza (and its cheese strings
  subtler), teddy bear, yo-yo, coral, Menger sponge, gyroid, Platonic solids (a small change),
  surface plotter, Lorenz attractor, CNN (all three views), the gaussian-splatting Sorting view's
  camera, and the photo album's three covers.
- Bases audit done: every toy (341, labs included) rendered from below;
  [docs/audits/bases-2026-10.md](../audits/bases-2026-10.md) lists each with what was open and what
  was done. Closed: the cactus's stand, the scanned strawberry, raspberry, blackberry and blueberry
  (a solid core just inside), the tomatoes' plate, the basket's floor, the tin can's lid (rig
  add-ons in `src/rigs.js`), the coral, succulent, bonsai, kelp, waterfall, snow globe, popcorn
  bucket and cake stand from his list, and, found in the audit, the cupcake's liner, the robot's
  soles, Newton's cradle's base, the toy piano's plinth and gradient descent's block.
- Cards on Effect review page 2, lane SharpB, by shelf: Food (`shb-<toy>` before/after and
  `shb-<toy>-tap`, 8 toys), Toys and nature (teddy bear, yo-yo, coral), Math (Menger sponge, gyroid,
  Platonic solids, surface plotter, Lorenz), AI and the photo album (CNN, gaussian-splatting
  Sorting, the album's leather, leather close up, linen and scrapbook, and its tap) and Closed bases
  (`shb-base-<toy>`, 20 toys, from below).
- October 2, 2026, evening: the owner's marks came in: 51 good, 13 fix, with no notes. Redone as
  "-r2" cards: the basket's floor (no spokes), the tin can's lid (no ripples), the tomatoes' plate
  (fewer stains), the waterfall's underside, the surface plotter (and its tap) and the Lorenz
  attractor (and its tap). Not redone yet, waiting for a note: gradient descent's base and the
  pizza's tap (see "For the Operator").
- October 3, 2026: the owner's notes on the open cards (via the Operator), fixed as "-r3" cards (and
  "-r2" where none existed): the basket's, tomatoes' and waterfall's undersides (still see-through:
  the floors are now two offset layers, the tomatoes' needles under the plate are hidden, and the
  waterfall's ground and boulders are even and solid), the tin can's lid (it was off center; now
  centered on the can's rim), gradient descent (the base taken back out, by the owner's note), the
  pizza's tap (the slice drew under the board: it is now sorted where it stands as it moves), the
  Lorenz attractor (r2's opaque even splats broke the strands into dashes; now small soft splats
  drawn out along the path) and the surface plotter (its mesh lines are now thin tubes; the slider's
  track and knob are crisper). New: the graph and surface plotters' a slider can be dragged on the
  toy, and the panel's slider follows. That needs the small engine change in #200 ("Engine: a toy's
  drag can set one of its sliders", branch `claude/lane-sharp-b-engine`, merged into this branch),
  which goes in first.
- October 3, 2026, 04:14 UTC: the owner marked 12 of the 13 new cards good. The one fix (the surface
  plotter's knob drew under the slider's track while dragged) is fixed by sorting the knob where it
  stands as it moves (`sortKnob` in `src/packs/maths.js`), card `shb-surface-plotter-drag-r2`.
- October 3, 2026, 07:13 UTC: the knob card came back good. The Operator's combined run found
  `tests/unit.spec.mjs:213` failing on #185 alone: the tomatoes' rig had 13 regions (cap 12). The
  red-stain band and the needles band are now one region (anything but the plate's white, inside the
  dark rim); card `shb-base-tomatoes-r4` shows the small change from below.
- On hold (the owner's call of October 3, 2026: no new Sharpness rounds until the Fidelity lane's
  Stage 1 reports): jelly, bricks and sushi (sharper) and the pebbles' base (they waited on Physics
  #184), and the quartz cluster's and the tornado's bases (they waited on Sharpness A #172). This
  lane only finishes the owner's marks on its current cards, #185 and #200.

## Notes

- What made these toys grainy, beyond PACKS.md 7c and SharpA's notes:
  - **Random shapes left in.** `k.box`, `k.cone`, `k.torus`, `k.ellipsoid`, `k.sphere` and `k.disc`
    place at random; swapping in the even shapes (`evenBox`, `evenCylinder`, `evenTorus`,
    `evenEllipsoid`, `evenDisc`, `evenTube`) with `even: true, opacity: 1` fixed most of them.
  - **A light core under a darker skin** (the cake's cream layers, the coffee cup's dark core) shows
    as flecks: color the core near the skin like the skin, shaded like it.
  - **Per-splat random color** (`c.rand()` in a color, the teddy bear's fur) is grain: use smooth
    noise a few splats across.
  - **Custom shapes** can join even placement by declaring `dims` (the gyroid takes four even
    numbers for its start point and side; `polyTube` two) or a `sampleEven(a, b)` (the Menger
    sponge's faces).
  - **Smaller splats at edges help only where the surface is dense enough**: on a thin rim (the cake
    plate, the surface plotter's plate) they open gaps; use them on interior lines (drips, stripes,
    the Menger sponge's hole edges, which `cellFaces` now marks as real edges).
  - **Soft value noise reads as blur** (the album's leather): a cell pattern (Worley noise) with
    crisp creases reads as real pebbled grain.
- **One layer of splats is never fully opaque**: a floor seen from below lets the toy above show
  through between its splats. Two layers a hair apart, the upper one turned so its splats fall in
  the lower one's gaps, close it (`underDisc` in `src/rigs.js`).
- **Splats sort where they were built**: a part moved far (the pizza's slice, lifted toward the
  viewer) draws under what it passes; set `out.resortPose` a few times while it moves.
- Closing a scan's base: a rig `addon` (kit-built, world coordinates, follows the body) with hard
  edges: a fruit core just inside the skin, hidden while a tap breaks or peels the fruit, or a
  kit-built underside. Placed with `tools/rig-map.mjs --views=front,bottom`.
- Tools (scratchpad, not committed): `shot.mjs` (phone stills at 390×844, 3x, mid tier, from the
  home view, below, the side or close), `clip.mjs` (a tap as an MP4 at 390×844, 2x), `speck.py` (a
  speck measure and the before/after pair joiner).

## Known issues

- The strawberry scan has two small dark spots underneath that are the capture's own splats; the
  core can't cover them without poking through the skin elsewhere.
- From the side, a few faint pale needles still hang just under the tomatoes' plate (the capture's
  own, centered in the plate's glaze, so hiding them would open the plate).
- The gyroid shows a few specks at the deepest breath, where the surface stretches thin (as before).
- The Platonic solids changed little: the faint rings in the faces come from the even fan layout,
  and nudging it made the rims speckle, so that was left out.
- The pancakes' syrup is lane Fix7's (unchanged here).

## For the Operator

- The engine PR #200 (a recipe's `drag` may return `{ control, value }` to set a slider; the panel's
  slider follows) must merge before #185. Its test is `tests/shb-engine.spec.mjs`. Without it the
  plotters' sliders simply don't drag (nothing breaks).

- Jelly, bricks and sushi (and the pebbles' base) wait for Physics part 2 (#184), still open.
- Shared helpers changed additively (default off): `board()` in computing.js (`even`),
  `grassMound()` in nature.js (`even`), `buildSideBound()` in pictures.js (`coverShare`), `polyTube`
  and `cellFaces` in `src/packs/maths.js` (even placement, used only when a toy asks for
  `even: true`). The old random `fuzz()` in playthings.js gave way to `evenFuzz()` (only the teddy
  bear used it).
- `src/rigs.js` now imports the even shapes from `src/packs/even.js` for the bases' add-ons.
