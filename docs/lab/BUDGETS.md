# Budgets: how many splats a kit toy should get

Lane Kit lab, October 10, 2026 (Opus 5.5). Follows [SHARPNESS.md](SHARPNESS.md), which compared
140,000 against 200,000 splats on 14 toys at a pixel ratio of 2 and found that more splats made no
toy sharper and several shimmer more. This sweep asks the same question at today's defaults (a pixel
ratio of 3 on the mid and high tiers) over five budgets and 24 views, and adds a measure of shape,
where more splats should help.

## The tiers today

| Tier | Usual splats | Most a toy can ask for | Who gets it                                      |
| ---- | ------------ | ---------------------- | ------------------------------------------------ |
| Low  | 60,000       | 120,000                | Auto on 2 GB or less, or 2 cores                 |
| Mid  | 140,000      | 240,000                | Auto on a phone-sized touch screen, 4 GB or less |
| High | 200,000      | 300,000                | Auto on anything stronger, or the High button    |
| Max  | 280,000      | 400,000                | Only the Max button                              |

A toy gets the usual count times its recipe's density, up to the most (src/generators.js,
`PROFILES`). This lane changes none of them.

## How it was measured

`node tools/shp-measure.mjs <out> --configs=b60,b140,b200,b280,b400 <toys>` renders each toy on a
390 × 844 CSS-pixel phone at a device pixel ratio of 3, mid tier (so the canvas is drawn at ratio 3,
today's default), WebGL2 in Chromium's software renderer (SwiftShader). The `bN` configs set the mid
tier's usual count to N thousand in the page (and its most in the tiers' own ratio: 120k, 240k,
300k, 400k, and 600k for 400k), so only the count changes. Five budgets: 60k, 140k, 200k, 280k and
400k.

The measures (SHARPNESS.md has the first three in detail):

- **Edge**: the median 10–90% rise across the strongest edges, in CSS pixels. Lower is sharper.
- **Speckle**: the mean difference from a 3 × 3 median over the flatter half of the toy. Lower is
  cleaner. It also counts fine texture as speckle (a painted grain resolved by more splats reads the
  same as noise).
- **Shimmer**: the mean frame-to-frame change of the fine detail over 12 frames turning 0.4° each.
  Lower is steadier.
- **Silhouette area** (new): the toy's area on screen against the same view at 400k. Over 100% means
  thin parts drawn fatter than they are (wide splats spill past the edges of a spoke or a strut).
  This is the shape measure where more splats should help.
- **Gaps** (new): the share of the toy's closed silhouette (holes up to about two CSS pixels across
  filled in) that shows the background, for pinholes and breaks in thin parts. It is not in the
  table: on no toy does it fall as the budget rises (on a few it rises a little, as finer edges
  between close parts let more background through), so low budgets don't open holes. White parts of
  a toy count as background here, so it compares a toy only with itself.
- **Frame**: milliseconds per frame in the software renderer, relative only.

Twenty-two toys: the original 14 from SHARPNESS.md, and eight thin or holey ones (the bicycle, the
Eiffel Tower, the crystal lattice, the neon knot, the torus knot, the oak, the chess set, and the
DNA), with the bicycle and the chess set also seen close up. Toys whose recipe has a density above 1
get more than the usual count (the American football, the hockey puck, and the marble ask for
twice).

## Results

Each cell lists the five budgets in order, 60k · 140k · 200k · 280k · 400k (the silhouette area has
four, against 400k). The splat column gives the counts each toy actually got.

| Toy (view)               | Splats at 60k → 400k | Edge (CSS px)                    | Speckle                          | Shimmer                          | Silhouette area (% of 400k) |
| ------------------------ | -------------------- | -------------------------------- | -------------------------------- | -------------------------------- | --------------------------- |
| lamp (home)              | 60,000 → 399,998     | 0.51 · 0.52 · 0.51 · 0.51 · 0.49 | 0.32 · 0.37 · 0.39 · 0.41 · 0.44 | 1.37 · 1.57 · 1.65 · 1.71 · 1.75 | 101 · 100 · 100 · 100       |
| american-football (home) | 120,000 → 600,000    | 0.51 · 0.50 · 0.48 · 0.46 · 0.42 | 0.41 · 0.61 · 0.70 · 0.80 · 1.00 | 1.12 · 1.49 · 1.60 · 1.80 · 2.15 | 100 · 100 · 100 · 100       |
| hockey-puck (home)       | 120,000 → 600,000    | 0.28 · 0.27 · 0.29 · 0.28 · 0.27 | 0.30 · 0.24 · 0.21 · 0.22 · 0.22 | 0.90 · 1.01 · 0.99 · 1.04 · 1.11 | 102 · 101 · 101 · 100       |
| klein-bottle (home)      | 48,000 → 320,000     | 0.52 · 0.56 · 0.53 · 0.53 · 0.51 | 0.49 · 0.52 · 0.90 · 1.30 · 1.67 | 0.84 · 1.12 · 1.33 · 1.65 · 2.08 | 100 · 99 · 100 · 100        |
| clock (home)             | 60,000 → 400,000     | 0.55 · 0.51 · 0.49 · 0.48 · 0.49 | 0.31 · 0.49 · 0.54 · 0.74 · 0.86 | 1.02 · 1.64 · 1.90 · 2.29 · 2.64 | 101 · 100 · 100 · 100       |
| penguin (home)           | 60,001 → 400,002     | 0.52 · 0.51 · 0.49 · 0.49 · 0.47 | 0.31 · 0.42 · 0.46 · 0.49 · 0.50 | 1.53 · 2.92 · 3.13 · 3.40 · 3.62 | –                           |
| snow-globe (home)        | 57,539 → 383,576     | 0.52 · 0.44 · 0.44 · 0.47 · 0.51 | 0.18 · 0.20 · 0.23 · 0.24 · 0.26 | 0.50 · 0.71 · 0.84 · 0.98 · 1.13 | 102 · 101 · 100 · 100       |
| white-blood-cell (home)  | 60,000 → 400,001     | 0.62 · 0.54 · 0.53 · 0.53 · 0.52 | 0.41 · 0.72 · 0.82 · 0.95 · 1.22 | 0.94 · 0.84 · 1.02 · 1.27 · 1.86 | 101 · 100 · 99 · 100        |
| ocean-liner (home)       | 53,356 → 355,780     | 0.54 · 0.46 · 0.44 · 0.40 · 0.31 | 0.24 · 0.31 · 0.35 · 0.37 · 0.38 | 1.08 · 1.69 · 2.09 · 2.41 · 2.79 | 106 · 104 · 102 · 101       |
| marble (home)            | 120,001 → 600,001    | 0.50 · 0.46 · 0.45 · 0.46 · 0.47 | 1.30 · 1.43 · 1.65 · 1.90 · 2.37 | 2.62 · 2.63 · 2.96 · 3.47 · 4.26 | 100 · 100 · 100 · 100       |
| sailboat (home)          | 60,000 → 400,002     | 0.55 · 0.50 · 0.46 · 0.40 · 0.36 | 0.35 · 0.51 · 0.59 · 0.68 · 0.73 | 1.40 · 2.26 · 2.93 · 3.34 · 3.97 | 103 · 103 · 102 · 102       |
| toy-piano (home)         | 60,189 → 400,004     | 0.76 · 0.60 · 0.56 · 0.54 · 0.53 | 0.18 · 0.22 · 0.25 · 0.27 · 0.30 | 1.10 · 1.93 · 2.32 · 2.69 · 2.99 | 111 · 105 · 103 · 101       |
| your-book (home)         | 113,837 → 446,581    | 0.52 · 0.52 · 0.55 · 0.52 · 0.52 | 0.00 · 0.00 · 0.00 · 0.01 · 0.01 | 1.09 · 1.17 · 0.46 · 1.09 · 0.87 | –                           |
| chladni-plate (home)     | 51,398 → 149,874     | 0.73 · 0.66 · 0.66 · 0.66 · 0.66 | 0.05 · 0.26 · 0.26 · 0.25 · 0.25 | 4.74 · 6.02 · 6.01 · 6.01 · 6.01 | 100 · 100 · 100 · 100       |
| bicycle (home)           | 59,097 → 393,919     | 0.53 · 0.50 · 0.49 · 0.47 · 0.43 | 0.62 · 0.89 · 0.99 · 1.12 · 1.20 | 4.19 · 6.00 · 6.52 · 7.07 · 7.28 | 118 · 107 · 103 · 102       |
| eiffel-tower (home)      | 60,002 → 400,002     | 0.86 · 0.58 · 0.55 · 0.53 · 0.52 | 0.13 · 0.20 · 0.24 · 0.29 · 0.33 | 0.48 · 0.86 · 1.19 · 1.54 · 1.99 | 109 · 104 · 102 · 101       |
| crystal-lattice (home)   | 59,872 → 399,968     | 0.78 · 0.57 · 0.54 · 0.53 · 0.52 | 0.21 · 0.27 · 0.31 · 0.35 · 0.41 | 0.88 · 1.49 · 1.83 · 2.19 · 2.60 | 111 · 105 · 103 · 102       |
| knot (home)              | 60,000 → 400,000     | 0.55 · 0.53 · 0.52 · 0.51 · 0.51 | 0.32 · 0.48 · 0.58 · 0.70 · 0.84 | 0.98 · 1.54 · 1.87 · 2.24 · 2.67 | 103 · 101 · 101 · 100       |
| torus-knot (home)        | 60,000 → 400,000     | 0.59 · 0.53 · 0.52 · 0.51 · 0.51 | 0.20 · 0.29 · 0.34 · 0.41 · 0.48 | 0.82 · 1.10 · 1.25 · 1.40 · 1.60 | 98 · 98 · 96 · 92           |
| oak (home)               | 59,792 → 398,257     | 0.82 · 0.58 · 0.57 · 0.57 · 0.57 | 0.25 · 0.40 · 0.51 · 0.64 · 0.84 | 0.52 · 0.82 · 1.03 · 1.46 · 1.75 | 105 · 102 · 102 · 101       |
| chess-set (home)         | 58,249 → 387,829     | 0.73 · 0.58 · 0.52 · 0.51 · 0.48 | 0.11 · 0.14 · 0.15 · 0.18 · 0.21 | 1.19 · 2.44 · 3.09 · 3.59 · 3.87 | 106 · 103 · 102 · 101       |
| dna (home)               | 59,986 → 400,020     | 0.55 · 0.51 · 0.50 · 0.47 · 0.44 | 0.44 · 0.50 · 0.57 · 1.03 · 1.15 | 2.93 · 4.06 · 4.53 · 5.03 · 6.75 | –                           |
| bicycle (0.5)            | 59,097 → 393,919     | 0.63 · 0.53 · 0.52 · 0.50 · 0.47 | 0.28 · 0.36 · 0.42 · 0.49 · 0.58 | 1.63 · 2.78 · 3.25 · 3.64 · 4.16 | 118 · 107 · 103 · 101       |
| chess-set (0.6)          | 58,249 → 387,829     | 0.84 · 0.60 · 0.54 · 0.53 · 0.49 | 0.07 · 0.08 · 0.09 · 0.10 · 0.12 | 0.68 · 1.50 · 2.01 · 2.41 · 2.90 | 103 · 101 · 101 · 101       |

The shape measures are left out for three views: the picture book (its splats come with its
pictures, which load in their own time), the penguin (its white belly against the white background
reads as a hole) and the DNA (it turns on its own between renders).

Across all the views (the median of each toy's value against its own at 140k):

| Budget | Edge | Speckle | Shimmer | Silhouette area |
| ------ | ---- | ------- | ------- | --------------- |
| 60k    | +11% | −23%    | −36%    | +1.2%           |
| 140k   | –    | –       | –       | –               |
| 200k   | −2%  | +14%    | +18%    | −0.8%           |
| 280k   | −6%  | +31%    | +39%    | −0.8%           |
| 400k   | −9%  | +52%    | +61%    | −1.2%           |

Frame times: a clean timing pass is running; this section is filled in the next push.

## What it shows

1. **Shimmer and speckle rise with every step up.** From 60k to 400k the median toy shimmers 2.5
   times as much and shows twice the speckle. The exceptions are the hockey puck (its speckle falls)
   and the Chladni plate, whose count stops growing near 150,000. Each splat gets smaller as the
   count rises, so the fine detail in each pixel comes from fewer, smaller splats that move in and
   out of it as the view turns. This is SHARPNESS.md's finding again, now at ratio 3 and across five
   budgets.
2. **Edges sharpen a little with more splats, most from 60k to 140k.** The median edge is 11% softer
   at 60k than at 140k, and only 9% sharper at 400k. The toys with thin parts gain the most from 60k
   to 140k: the oak (0.82 → 0.58 CSS px), the Eiffel Tower (0.86 → 0.58), the crystal lattice (0.78
   → 0.57), the chess set (0.73 → 0.58, and 0.84 → 0.60 up close) and the toy piano (0.76 → 0.60).
   Past 140k most toys gain 0.01 to 0.05 CSS px, a few hundredths of a pixel. The exceptions are the
   long thin outlines of the ocean liner (0.46 → 0.31), the sailboat (0.50 → 0.36) and the bicycle
   (0.50 → 0.43), which keep sharpening to 400k.
3. **Thin parts get fatter at low budgets.** At 60k the bicycle's frame and spokes cover 18% more of
   the screen than at 400k (the card `klab-detail-slider` shows it), the crystal lattice and the toy
   piano 11%, the Eiffel Tower 9% and the oak 5%. At 140k they are within 7% (the bicycle) and
   mostly within 3 to 5%; at 200k within 3.4%; at 280k within 2.5%. Solid toys don't change shape at
   all (the clock, the marble, the Klein bottle: within 1.5% at 60k).
4. **No holes open.** At every budget the kit fills its shapes: the gaps measure found no pinholes
   or broken thin parts that more splats close. Low budgets spoil thin parts by fattening them, not
   by breaking them.

## What it doesn't show

- **One renderer, one phone size.** SwiftShader on the CPU, at 390 × 844 and ratio 3, WebGL2 only. A
  phone's GPU blends, sorts, and rounds differently; WebGPU culls small, faint splats that WebGL2
  keeps (SHARPNESS.md, "Culled"), and the shimmer of tiny splats may differ there.
- **Still views and a slow turn.** Shimmer is measured over a 4.8° turn; a fast drag, the idle sway
  and tap effects aren't.
- **Frame times are relative.** The software renderer's milliseconds say which budget costs more,
  not whether a phone keeps 60 frames a second.
- **Scans don't change.** Captured toys load their own files (lighter ones on Low); the budget is
  only for kit toys, generated shapes, and pictures.
- **Speckle is not only noise.** Kit colors carry painted grain (the bicycle's paint, the oak's
  bark), and more splats resolve more of it. Some of the rise in speckle is that texture, which
  reads as grit at phone size either way.

## Recommendation

Keep the tiers. The data supports each number in its place:

- **Mid at 140,000 is the knee.** It takes most of the edge and shape gain over 60k, and every step
  above it buys a few hundredths of a pixel of edge for 18 to 60% more shimmer.
- **High at 200,000 and Max at 280,000 don't make toys look better at phone size.** They draw thin
  outlines (a hull, a mast, spokes) a little crisper and shimmer more. They stay as a choice for the
  people who press the buttons, and Auto shouldn't move anyone up to them on a phone.
- **Low at 60,000 is the one number worth testing on a real weak phone.** It fattens thin parts by 5
  to 18% and softens their edges, the one place where more splats clearly help. If a Low phone keeps
  its frame rate at 90,000 to 100,000, that would close most of the gap. That is a test on a device,
  not something this sweep can answer, and no tier changes in this lane.
- **Fight shimmer with the levers, not the count.** If the owner wants steadier toys at today's
  counts, the renderer levers (SHARPNESS.md) and a toy's own splat sizes are the places to look;
  more splats make shimmer worse.

The labs Detail slider (in this lane's engine PR) lets anyone with labs on set the count from 60,000
to 400,000 and compare on a real phone.
