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

- October 2, 2026: 33 of the 34 toys made sharper (all but the laptop, which is locked: see "For the
  Operator"). Only the look changed: every toy keeps its shape, tap, sound and splat budget
  (`node tools/check-packs.mjs` on every changed pack: all within budget and build time). Lane tests
  in `tests/sha.spec.mjs`.
- Cards on Effect review page 2, lane SharpA, two per toy: `sha-<toy id>` (a before-and-after still
  at 390×844 on a 3x phone, cropped to the toy, left before and right after) and `sha-<toy id>-tap`
  (the tap after the change, an MP4 at 390×844, 2x, the mid tier). Posted by shelf: Landmarks (10
  toys), Vehicles (5), Medieval (4) and Open me (5: the sword in the stone is there), then gems,
  space, weather, holidays and clothing.

### What changed, by toy

- **Landmarks.** Eiffel Tower: the ironwork laid evenly along every girder
  (`lattice(..., { even })`), solid decks and piers, calm gravel and lawn. Pyramids: even, solid
  faces with stone courses as readable steps (lit treads, darker risers) instead of fine blocks that
  broke into speckle; a larger Sphinx turned three-quarters to the view (lying lion, paws, raised
  chest, striped headdress and face); an even desert and dunes. Leaning Tower: even columns (no gray
  flecks), firmer cornices, belfry and drum (more, smaller splats), calm lawn. Colosseum: clean
  seating steps with broad, soft weathering, an even arena grid, calmer stone and plaza. Parthenon,
  Stonehenge, Taj Mahal, castle, pagoda and windmill: every solid even and fully opaque, broad
  weathering instead of speckle, calm lawns (`calmGrass`) and even water and ground
  (`water(..., { even })`, `ground(..., { even })`). The Taj's white marble takes slightly larger
  splats (1.15) so its darker far side doesn't show through as gray veins; the pagoda's roofs are
  even and solid (the red underside showed through).
- **Vehicles.** `rod()` takes `even` (an even cone). Rocket: a solid white body (its gray core
  showed through), crisper bands. Helicopter: even boom, fin, tailplane and skids. Balloon: an even
  envelope. Steam train: every part even and solid, calm ballast. Ocean liner: each deck laid as
  short blocks end to end (a long, thin even face spaces its splats in a hatch, which broke the
  windows into blobs), a solid hull, regular lights.
- **Medieval.** `beam()` takes `even` (an even box of calm wood, `calmWood`). Trebuchet and crossbow
  even and solid (the crossbow's stock is an even rounded box of walnut). Knight's helmet and crown:
  a much calmer glint (it read as sparkle grain) and slightly larger splats so the dark inside
  doesn't show through. Sword in the stone: even rock with broad weathering and soft lichen and
  moss.
- **Open me.** Chest: even planks, solid straps (the gems inside showed through the lid). Gift box:
  even paper, lid and bow. Music box: polished wood like the Enigma machine's case (broad soft grain
  bands with a sheen, smaller splats for crisp edges). Storybook: the words on the two pages seen
  while the book lies open are ink dots laid exactly on the font's pixels (2 × 2 per pixel, like the
  laptop's keys), instead of random page splats colored as ink.
- **Clothing.** Running shoe (a scan): exact splat sizes (no random size jitter, which frayed the
  outline), slightly smaller splats and a calmer fabric (each splat's color blended 45% toward its
  neighbors'), through new, off-by-default options of `addScan()`.
- **Gems.** The polytope takes `sampleEven` and `addGem` an `interior`, `core` and `even` option.
  Sapphire: no inner core, larger splats and a calm glint (white specks and floating blue dots
  gone). Quartz cluster: solid, even crystals (they were 0.9 opacity) with a calm glint and broader
  growth lines; a calm rock base (`calmRock`). Amethyst geode: even, solid shell, agate bands and
  cavity wall; crystal points laid out evenly (`crystalCloud(..., { even: true })`) with a calmer
  glint.
- **Space.** Spiral galaxy: pinpoint stars (smaller, exact sizes), a smooth disc glow laid out on a
  sunflower spiral, a smooth glow along each arm under its stars, and finer, darker dust lanes.
- **Weather.** Storm cloud: even, more solid puffs; finer rain streaks (its lightning, Fix7's item,
  is untouched). Tornado: the funnel's dust spread evenly in a thinner wall, solid even cloud puffs,
  and the field as a sunflower spiral of solid splats (it was a random disc with its dark underside
  showing through).
- **Holidays.** Fireworks: an even, solid crate with a calm grain, and even tubes with broad paper
  bands and a dark mouth (the bursts and the rapid taps, Fix7's item, are untouched).

## Notes

- What made these toys grainy, beyond the five causes in PACKS.md 7c:
  - **The far side or the core showing through.** A light solid over a darker inside (a core color,
    the inside of a helmet, an underside) shows the dark between splats as flecks, even when placed
    evenly. Fix: a core the same color as the skin (or none), and splats 1.1 to 1.2 times larger on
    light materials.
  - **Glints.** `kind: "glint"` on many splats reads as sparkle grain at phone size; 0.01 to 0.06 is
    enough for a soft shine.
  - **Fine patterns below a splat's size** (stone courses, mortar, wood grain at 26 to 90 per unit,
    noise at 20 to 60 per unit) turn into speckle. Keep pattern features at two splats or more:
    steps instead of mortar lines, broad grain bands, noise at 3 to 10 per unit.
  - **Long, thin even faces** (a deck 4 units long and 0.28 high) space their splats in a hatch: lay
    them as short blocks end to end (the liner) or fold them (`rect()` in music.js).
  - **Random clouds** (lattices, galaxy glow, ground discs) want an even layout too: stratify by the
    splat's index (`(i + 0.5) / n`) or a sunflower spiral.
- The kit's random size jitter on clouds (`jitter` 0.5) frays outlines; scans and dots read crisper
  with `jitter: 0`.
- `evenDisc` (a param grid) shows radial moiré on a large flat ground; a sunflower spiral cloud
  doesn't.
- Tools (scratchpad, not committed): `pair.mjs` crops a before and after still to the toy and puts
  them side by side; `phone-clip.mjs` renders a tap as an MP4 at 390×844 (2x, mid tier) from
  lossless frames (a GIF's palette adds its own dither, which hides sharpness); `evenify.py` adds
  `even`, `opacity` and `jitter` to a builder's `k.add` calls and swaps in the even shapes.

## Known issues

- The running shoe is a scan: its fabric is calmer and its outline crisper, but the collar's fuzzy
  edge is in the capture (edge-on splats); a sharper bake would need the source rebaked at a higher
  density for the mid tier, a Real objects job.
- The storybook's other leaves (seen only mid-turn) keep their random text splats.
- The Leaning Tower's belfry windows and arcades are still a little soft at phone size (small
  features at the tier's budget).

## For the Operator

- **The laptop:** the brief lists it ("a little bit sharper"), but CLAUDE.md, HANDOFF.md and
  history.md say it is locked (("do not change its look" or how it works)) and the brief ends "The
  laptop is locked." I left it untouched. If the owner wants it sharper, say so and I'll do it as
  its own small card (its body and deck the same way as the others; the keys and screen stay as they
  are).
- Shared helpers changed additively (default off): `addScan()` in real-objects.js (`sizeMul`,
  `exact`, `smooth`), `polytope().sampleEven` and `addGem` options in gems.js, `lattice`, `water`
  and `ground` `even` options in landmarks.js, `rod`'s `even` in vehicles.js, `beam`'s `even` in
  medieval.js, `crystalCloud`'s `even` in gems.js. Every other toy builds exactly as before.
- A PACKS.md lesson (section 7c): the notes above (show-through, glints, fine patterns, long thin
  faces, random clouds).
- If a toy is better merged sooner, the landmarks are self-contained in landmarks.js and could be a
  PR of their own.
