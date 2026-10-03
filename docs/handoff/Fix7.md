# Lane Fix7: Toy fixes from the review of October 2

Prefix `fx7`. Stacked parts, merged in order: `claude/lane-fix7-1` (taps and pauses),
`claude/lane-fix7-2` (looks and bugs), and `claude/lane-fix7-engine` only if something needs
player.js, ui.js or kit.js. Lane record "Fix7" on Effect review page 2. How lanes work:
[OPERATING.md](../OPERATING.md).

## Brief

Written by the Operator on October 2, 2026, from the owner's review of that day, word for word:

The owner went through every toy on the preview build on October 2. His review, word for word, is
docs/reviews/2026-10-02-mega-review/review.md (on branch `claude/operator-mega-review` until that
Ops PR merges), with three screenshots there: `burger-bun.jpg`, `splat-equation-seam.jpg` and
`thermal-ellipsoids.jpg`. Read his words for each item below before you start it. Sounds go to lane
Sound C, sharpness and hollow bases to a later Sharpness lane, and hands-on physics (stretching,
stacking, picking up) to lane Physics: don't do those here, but if a fix of yours changes what a toy
sounds or looks like, say so.

### Part 1: taps where you tap, and pauses that make sense (claude/lane-fix7-1, first)

1. **storm-cloud**: lightning strikes straight down from the cloud at the horizontal position of the
   tap.
2. **shield**: the hit lands where you tap on the shield's face (today it always hits near the top
   corner).
3. **splat-field** (labs): on the ocean (and any liquid surface), a second tap drops another stone
   where you tapped and adds its ripples, instead of pausing. A tap that pauses should remain
   possible some other way, or not at all; say what you chose.
4. **fireworks**: rapid taps launch more fireworks; a tap never pauses the show.
5. **paper-lantern**: touching it again doesn't pause it (for example, it sends another lantern up,
   or nothing). The diya can stay as it is.
6. **puzzle-cube**: pausing mid-scramble lets the turn in progress finish, then pauses, so the cube
   is in a turnable state. A move of the person's own then ends the automatic scramble, and the next
   tap starts a new one from that state. His words: "if you're in the middle of a turn, you really
   can't make any other moves with the cube."
7. **gaussian-splatting**, one-splat view: hard to start; you have to tap its exact center. A tap
   anywhere on the toy starts it. Also check what the one-splat animation shows: if it doesn't map
   to a real step of training, make it map (for example one splat's position, size, rotation,
   opacity and color moving by gradient steps toward a target), and say so in its About text.
8. **sunglasses**: a tap on a lens starts the effect (today only the frame does).

Long effects pause on a tap since UI r3 (src/motion.js:116-141, 185-196; `pausable: false` turns it
off for a control, as Fix6 did for the Enigma). Use the existing position-aware tap (the tap point
in the toy's own space) rather than new engine code where you can.

### Part 2: looks and bugs (claude/lane-fix7-2)

1. **marble**: the outer glass is a little too clear. You should see the polished shell as a
   surface, not fog and no added highlights.
2. **molecule** and **crystal-lattice**: during the shuffle the atoms seem to leave their bonds and
   the lines tangle. Atoms and their bonds move together as solid pieces (effect quality rule: real
   motion, parts move as solid pieces).
3. **protein**: after the ribbons are pulled apart, a tap to bring them back waits too long; they
   start back at once.
4. **lungs**: inflate bigger (deflation is fine).
5. **ocean-wave**: a dark strip shows where the wave's pieces separate at the curl; make the curl
   continuous (he calls this optional).
6. **pancakes**: when the top pancake flips, the syrup stays put as if solid; it moves with its
   pancake (a drip comes later with the Fluid lab).
7. **candy-cane**: the green bow looks incomplete; add the missing ribbon tail.
8. **burger**: zooming in, the top bun flashes white (burger-bun.jpg; likely the sesame seeds or a
   highlight popping at close range). And the lettuce has a hole in its middle; real lettuce
   doesn't.
9. **taco**: beef pokes through the shell's rim; the filling falls unrealistically (pieces should
   fall and land like real food).
10. **apple**: white pixels around the bitten area.
11. **banana**: the nearest banana has the others passing through it at the dark tips; white specks
    on the skins.
12. **hoodie**: the hood comes apart from the back as it moves, and the shoulders still look like
    holes.
13. **Clothing flags** (hoodie, baseball-cap, running-shoe, sunglasses): neither the global flag nor
    the toy's own flag changes them. Cause: every splat they build has `pattern:false` (`addScan`,
    src/packs/real-objects.js:77, and `addCloud`, :108), so the shader skips the pattern. Let the
    flag reach the cloth parts (keep the lenses, laces, drawstrings and stand as they are), the way
    games.js:500-502 sets the pattern projection (PACKS.md:281-287).
14. **splat-equation**: a seam line shows on the torus and the Möbius strip
    (splat-equation-seam.jpg). The grid samples cell centers (:391) and normals use forward
    differences (:496, :517-518); find the cause (normals across the wrap, splat sizes or
    orientation at the seam) and close it for every preset whose u or v wraps.
15. **snowman**: it melts into a flower-like shape; it should slump into a puddle.
16. **your-book**: a page turn started by a tap is a little laggy, while dragging a page by hand is
    smooth. Make the tapped turn as smooth.
17. **periodic-table**: the lanthanides (57–71) and actinides (89–103) are real tiles in the two
    rows under the table, but the owner took the "57–71" and "89–103" cells for missing elements. A
    tap on those marker cells today starts the tour (chemistry.js:369-372). Make a marker tap
    highlight its row, and add an option "Wide table" that shows the f-block inline (the 32-column
    form) for anyone who wants it.

### Clips and marks

Post a clip for every item in your lane record "Fix7" on Effect review page 2, at 390×844, "built by
Opus 5.5". Most of these are public toys: their part merges after the owner marks the cards good.

## State

Model: Opus 5.5 (claude-opus-5-5), default effort, no helpers so far.

Part 1 (`claude/lane-fix7-1`): all eight items built, tested (tests/fx7.spec.mjs) and clipped.

- **storm-cloud**: the tapped bolt (bolt3) moves under the tap: to the tapped point's x and z (the
  tapped point is the front-most splat under the finger, so the bolt stands under the finger from
  any side). Its own end drift is smaller, so it comes straight down.
- **shield**: the flash and the sparks move to the tapped point; the sparks turn (at most a radian)
  to spray away from the middle; the shield rocks about the axis (-y, x) of the hit, so it gives way
  where it was struck. The Play button still hits the top corner.
- **splat-field** (labs): the pulse is `pausable: false`. Each tap adds its own pulse beside the
  ones still running (up to eight at once): the newest rides on the morph channels as before (the
  lab test's contract), the older ones on the tokens' uniform (unused by this toy), which the GPU
  field reads (offset = the tap's place, `visible` = its progress). The ocean drops another stone
  where you tap and the rings cross; the galaxy sends another ring; the knot's flow takes each
  pulse's lap on top of the others (a finished pulse adds a whole lap, the same as none, so nothing
  jumps). **Pausing: not at all** (the choice the brief asked for): each pulse is 3 s.
- **fireworks**: `pausable: false`. Each tap launches its own shell, with its own clock, from a free
  tube (up to three at once, one per tube; a fourth tap restarts the oldest's tube). Two more rocket
  parts (15 parts, the limit). The burst now flies out from its middle by its part's scale instead
  of the shared `grow` (several bursts of different ages can't share one grow value).
- **paper-lantern**: `pausable: false`; a tap mid-swing gives it another push. The swing's size now
  eases toward the push (it used to jump on the first tap too).
- **puzzle-cube**: `pausable: false` (the cube pauses itself). The scramble or solve has its own
  clock. A tap while it turns sets a hold at the end of the turn in progress, then it pauses with
  every cubie square; while paused the cube takes drags; a hand move ends the automatic one, and the
  next tap starts a new scramble or solve from that state. A tap while paused with no hand move
  carries on. Every turn is now recorded in the history (a solve's turns cancel it as they go), so a
  solve stopped part way leaves the history right.
- **gaussian-splatting**, one splat: a low pick alpha (0.012) in this view and a near-clear card
  (opacity 0.02) over the grid, so a tap anywhere on the toy starts it. The tap now trains the
  splat: it starts from a guess (moved, turned, the wrong sizes, faint and gray-blue) and 24
  gradient steps carry its place, turn, sizes (a morph), and color and opacity (a cross-fade between
  the guess copy and the target copy) toward the target, a dashed outline, each at its own learning
  rate, so the steps start big and shrink. About text says so.
- **sunglasses**: a lens's own splats are too small and faint for the pick pass even at a low alpha;
  37 bigger, faint splats (opacity 0.08) over each lens, with `pickAlpha: 0.06`, make a lens tap
  start the effect.

Part 2: not started.

## Notes

- `out.parts[name].visible` scales the splats (it multiplies the splat size), it doesn't fade
  opacity. The one-splat view cross-fades the guess and the target this way (many small splats
  shrinking reads as fading).
- The pick pass misses very small faint splats whatever the alpha clip; a few bigger faint splats
  over a glass surface fix it.
- A recipe's `pickAlpha` can be a getter (it is read after the build), so one view of a toy can
  lower it.
- A labs GPU field can read `uSpTokens` (always set) for extra per-tap data, when the toy has no
  tokens of its own.

## Known issues

- Sounds: the tap sounds play on every tap as before; fireworks fired quickly play their sound per
  tap, and the puzzle cube's tap sound plays on a pause tap too. The one-splat view's sound (the
  pad) is Sound C's (the owner asked for a subtler one).
- The one-splat view's near-clear card tints the grid square a little on a dark background.

## For the Operator

- No engine changes in part 1.
