# Lane SPL1: the Splats slider sets the real count

## Brief

(Written by the Operator on October 17, 2026; summarized.) Lane SPL1 (prefix `spl1`), Opus 5.5 at
high effort. With labs on, the Toy tab's Splats slider says it sets a toy's splats from 60,000 to
400,000, but `splatBudget()` multiplied the slider by each recipe's `density`, and a captured toy
can't go past its file. The slider should give the count picked, or as close as the toy can get.

1. "Engine: the Splats slider sets the real count" (`claude/spl1-engine`), additive and behind labs,
   merged first: a kit or procedural toy's count is the slider's value; a recipe that can't follow a
   count says what it draws in one measured place; a capture draws every splat its file has, up to
   the slider's value, and the label says so ("31k splats (all this toy has)"); the label shows the
   true count drawn; tests in `tests/spl1-engine.spec.mjs`; a frame-time check.
2. "Phase SPL1: toys honor the Splats slider" (`claude/spl1`): the recipes that need their own
   change to look right at a high count (splats shrink as the count grows, so a toy gets sharper
   rather than thicker), measured with `tools/crisp-score.mjs` where it fits. Check Your name in
   splats (lane PT3) and Moving photo to 3D (lane MP1) and tell those lanes what they need.

## State

- Part 1 (engine): branch `claude/spl1-engine`, PR #716 (the Operator merges it after its full suite).
- Part 2: branch `claude/spl1` (it carries part 1, merged in), PR #726.

## What changed (part 1)

- `src/player.js`, `splatBudget(density)`: with the slider it returns the slider's count; without
  it, the tier's count times the density, as before.
- `src/kit.js`, `buildRecipeTo`: with the slider, a kit toy is built, its drawn count measured, and
  built again with the budget scaled by what it missed (at most twice more, the budget within 0.5 to
  2.5 times the count). Holes (a color that returns null) and fixed-size parts made 136 of 398 kit
  toys miss the count by more than 2% before. The context kept is always the last build's (recipes
  keep state between builds); when an earlier try came closer it is built again. One correction
  always runs; the builds after it stop at about 3 s of extra building ("Build time" below).
- `src/kit.js`, `statedSplats`: a recipe that can't follow a count says what it draws with
  `splats(count, options)`, a count or `{ count, all }` (`all` when that is every splat it has). It
  is then built once. The spec measures it.
- `src/kit.js`, `k.shrink` and `k.all` (for part 2's recipes): `k.shrink` is √(the max tier's count
  for this toy ÷ the slider's count) when the slider is above that count, and 1 otherwise, so a
  recipe with fixed splat sizes can let them shrink as the count grows. A recipe sets `k.all = true`
  during its build when it has drawn every splat its data has (or all the detail its source has);
  the label then says "(all this toy has)" when the toy falls short of the slider.
- `k.slider`: the slider's count when it set the build, or null, so a recipe can lift a cap of its
  own (a simulation's) only for the slider and keep the tiers' look.
- Captured toys (`src/player.js`, the builtin branch): with the slider, a capture loads its light
  file on the low tier as before, but switches to the full file when the light one has fewer than
  the slider; a file with more than the slider is thinned to it. Thinning is a shader variant
  (`MODIFIER_THIN`, `MODIFIER_RIG_THIN` in `src/effects.js`, chosen in `Stage.setToy`'s `thin`): a
  hash of each splat's index against `uSpThin.x`, the share kept; the rest shrink to nothing, as a
  cut splat does. `thinHash` and `thinnedCount` are the same hash in JavaScript, so the label's
  count is exact. Every other toy keeps its program.
- The label (`src/app.js`, `splatsText`): the status line and the render line show the count drawn,
  with `info.splatsNote` when it is more than 2% off the slider: "(all this toy has)" for a capture
  (or a recipe's `{ all }`), "(the nearest this toy draws)" otherwise. With the slider, a picture
  toy's line names the pictures that come on top ("502k splats (401k in the toy; 101k in its
  pictures)").
- `index.html`: the slider's note.

## What changed (part 2)

None of these change a toy with the slider off: `k.all` only feeds the label, `k.shrink` is 1, and
the viewers' budget is the same number as before.

- Every splat the data has (`k.all`): the baked scans (`addScan` in `src/packs/real-objects.js`, for
  Real objects and the photoreal shelf), the baked chest's largest tier, Video to 3D's scene, the
  splat toolkit's files, the point cloud's kept points, the specimen neuron's finest level, the
  charts of Data in 3D and Climate records, the cryo-EM map's surface, the contour lab's elevation
  model at full resolution, the splat equation's own count, and the toys that draw a fixed set
  whatever the budget (the nearby stars, the star systems, Powers of ten, Gaussian splatting, the
  solar orbits). The light lab says so when its panels reach their picture's detail.
- Sharper rather than thicker (`k.shrink`): the fish school. The survey (total splat footprint at
  400k over 60k) found 18 toys that thicken; most have a density of 1.43 or more, so 400k is their
  max tier's own look and `k.shrink` stays 1. Star cluster and QR three already scale with the
  budget; the volumes (walnut CT, the volume viewer) add depth, not thickness.
- The splat toolkit and point clouds sized their previews from the tier, not the count passed:
  `budgetFor` now takes the count (the same number with the slider off). Point clouds drew 382k at
  400k before.
- `tests/spl1.spec.mjs`: each "all" claim holds (twice the budget draws at most 5% more: a dome or a
  floor around the data), fish school's sizes shrink by `k.shrink`, and the two viewers follow the
  slider.

- Sound in a box (the Operator's call): with the slider its bead cap lifts from 16,000 to 28,000
  (`BEADS_SLIDER` in `src/packs/chladni-3d.js`, 7% of 400,000, the most the slider asks). It draws
  43,460 splats at 200k and at 400k (31,460 before), and the max tier keeps 31,460. Stepping 28,000
  beads takes about 5.8 ms a frame against 2.9 ms for 16,000 (this container's CPU; the screen
  picture they are written to takes under 0.1 ms), well inside a 30-frame second's 33 ms; the GPU's
  share follows the total splats, which the slider sets anyway. Above 43k it says "(the nearest this
  toy draws)".

## The slider's 10k (the Operator's call of October 17, 2026)

The slider now runs from 10,000 to 400,000: 2,000 a stop up to 58,000, then 10,000 a stop
(`SPLATS_STOPS` and `splatsStop` in `src/player.js`; the input moves through the stops' positions).
Every kit toy builds at 10k with no error and no non-finite value. 35 land more than 2% off. The
ones with a floor of their own draw more: the Chladni plate and cell, the room echo, the splat
mirror, the QR code, the sound lab and recorder, the contour lab, the terrain box, the ripple tank,
the light bench, the geo maps, the airport x-ray, the night sky, Data in 3D, Climate records, real
elements, unit cells, and Moving photo to 3D. The fixed sets draw less (the star catalogs, Powers of
ten, Gaussian splatting, One splat, QR damage, the specimen neuron). Their labels say so; none needs
a minimum to work.

## For lanes PT3 and MP1 (Your name in splats, Shape morph, Moving photo to 3D)

At 400k these still miss the slider's count (the name toy draws about 24% of it). Two ways, in the
recipe, once #716 is on main:

- Follow the count: size whatever is fixed now (the text raster's resolution, a clip's sampled
  pixels) from `k.count`, so 400k gives 400k. `buildRecipeTo` measures the build and corrects up to
  2% on its own, so it needs only to grow with the budget.
- Or say it has no more: set `k.all = true` in `build(k, o)` when the toy has drawn everything its
  source holds (every pixel of the raster or the clip). The label then reads "(all this toy has)".
- For fixed splat sizes, scale them by `k.shrink` (1 except past the max tier's count) so a higher
  count looks sharper, not thicker; `k.slider` (the slider's count or null) lets a recipe lift a cap
  of its own only for the slider.

## Left as they are (the label says "the nearest this toy draws")

Grids and simulations capped for frame rate: the Chladni plate, the sound lab and recorder at 400k,
the QR code, QR anatomy and QR damage, the room echo, the splat mirror. Maps that draw a little more
than asked (the living city, earthquakes). Point clouds lands about 5% under at 60k (its preview is
picked before the build). Other lanes' toys: Your name in splats and Shape morph (PT3), Moving photo
to 3D (MP1), the QR craft toys (PIC2), One splat and the volume viewer (TF1).

## Measured (Node, every kit toy at 60k, 200k and 400k)

- Before: 262 of 398 kit toys within 2% at all three counts. After part 1: 345.
- The 53 left are part 2's: baked scans that run out of file splats near 300k (the photoreal shelf,
  Real objects, the light lab), fixed data (the nearby stars, star systems, powers of ten, one
  splat, the Gaussian splatting explainer, the point clouds' data set in the browser), grids and
  simulations (Sound in a box, the Chladni plate, the QR toys, barcodes, data in 3D, climate
  records, contour lab), maps that add data on top (the living city, earthquakes, the harbor), and
  lane PT3's and MP1's toys (Your name in splats, Shape morph, Moving photo to 3D at 400k).

## Build time (the Operator's review)

Every kit toy at 400k on the low tier (Node, the same code the page runs): 248 build once, 98 twice,
49 three times and 3 four times. The extra building, uncapped and then capped (one correction always
runs; further builds only while the extra stays within about 3 s), in seconds over one build, on a
quiet machine:

| Toy              | One build | Extra, uncapped | Extra, capped | Drawn (capped) |
| ---------------- | --------- | --------------- | ------------- | -------------- |
| Real elements    | 1.0       | 4.9             | 2.2           | 118% (nearest) |
| Cryo-EM map      | 1.2       | 2.2             | 2.4           | 46% (all)      |
| Night sky        | 1.0       | 2.8             | 1.6           | 100%           |
| QR three         | 1.0       | 2.3             | 1.7           | 107% (nearest) |
| Fluorite crystal | 1.2       | 2.1             | 1.8           | 98%            |

Under load (the clips rendering beside it) the cap stops sooner: the browser spec allows 4% with the
label saying "(the nearest this toy draws)", and the fluorite crystal landed 2.6% under there.

## Choosing a capture's file up front (the Operator's review)

The page doesn't know a capture's splat counts before it loads a file: `src/toys.js` carries no
counts, and the `splats` and `lite` numbers in `tools/assets.json` are targets (the millipede is
listed at 300,000; its file has 116,374), and that file isn't loaded by the page. So on the low tier
a capture loads its light file and, when that has fewer splats than the slider, the full one. The
slider puts a capture on the low tier only up to about 100k, and most light files have 100k or more,
so the second download happens only for the 80k light files with the slider between 80k and 100k.

## Frame time

On the cloud container's software renderer (SwiftShader, so only the ratio means anything), the low
tier at 390 x 844 drew a frame in about 140 ms at 60k and 640 ms at 400k (the clock and the egg):
about linear in splats. A capture thinned from 100k to 60k took 225 ms against 285 ms for the full
116k: thinning saves the drawing, not the sort. With the slider, `adapt` still lowers the resolution
when frames are slow; the tier step-down stays off, as on main, since the count is the person's
choice.

## How to test it

- `SPLASHERY_CHROMIUM=/opt/pw-browsers/chromium npx playwright test tests/spl1-engine.spec.mjs`.
- By hand: `?labs=1`, the Toy tab, the Splats slider at 400k; the clock reads "400k splats", the
  millipede "116k splats (all this toy has)"; at 60k the millipede reads "60k splats".

## For the Operator

- PACKS.md lesson: a recipe that can't draw any count asked of it (a fixed grid, a data set, a
  capped simulation) states what it draws with `splats(count, options)`.
- Lane PT3 (Your name in splats, Shape morph) and lane MP1 (Moving photo to 3D): see part 2.
