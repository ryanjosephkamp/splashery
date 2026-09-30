# Sharpness: grain out of the renderer, measured

Lane Sharpness, September 29, 2026 (Opus 5.5). Follows [KERNELS.md](KERNELS.md) (lane Lab).

## The question

Lanes Fidelity A and B took the grain out of how toys are built (even placement, full opacity, full
density, clean colors). This lane asks what grain is left once a toy is built well, and how much of
it comes from the settings every toy shares: the cull, the pixel-ratio cap, the adaptive drop in
resolution, the falloff (kernel) and the tier's splat budget.

## The switches

All in `src/sharpness.js`, read at each toy load in `src/player.js` and applied in `src/stage.js`.
They work only while labs is on (`?labs=1`); with labs off, or with labs on and no switch, the
renderer is exactly as before (tests/shp.spec.mjs checks the pixels are identical).

| Switch                         | What it does                                                                                                                                                                         |
| ------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `?cull=low`, `off` or a number | Lowers the engine's small-splat cull: `minPixelSize` (2 by default, both renderers) and `minContribution` (3 by default, WebGPU only) to 1 and 1.5 (`low`), 0 (`off`) or n and 1.5·n |
| `?dpr=native` or 1 to 3        | Lifts the tier's pixel-ratio cap (`PIXEL_RATIO`: 2 on mid and high phones) to the device's own ratio, up to 3                                                                        |
| `?adapt=drag`                  | The adaptive drop in resolution (a third lower while frames are slow) happens only during a drag or a paint stroke, not while a toy plays on its own (idle sway, effects)            |
| `?aa=1`                        | The engine's anti-aliased splats (`antiAlias`, Mip-Splatting's opacity compensation)                                                                                                 |
| `?sharp=1`                     | `cull=low`, `dpr=native` and `adapt=drag` together; single switches override it                                                                                                      |
| `?kernel=sharp`                | Lane Lab's sharper falloff (unchanged)                                                                                                                                               |

A recipe can set them for one toy with a `render` field (`{ cull, dpr, adapt, aa }`), read only
while labs is on; the URL wins. No toy sets one yet.

## How it was measured

`node tools/shp-measure.mjs <out> id[@zoom] …` renders each toy on a 390×844 CSS-pixel phone in
Chromium's software renderer (SwiftShader), once per config:

| Config  | The phone                                                                    |
| ------- | ---------------------------------------------------------------------------- |
| `base`  | a 2x phone today (mid tier, ratio 2)                                         |
| `drop`  | the same phone while the adaptive drop is on (ratio 2 ÷ 1.5)                 |
| `cap3`  | a 3x phone today: the mid tier caps it at 2, so it draws exactly `base`      |
| `dpr3`  | a 3x phone with the cap lifted (`?dpr=3`)                                    |
| `cull`  | a 2x phone with the cull off (`?cull=off`)                                   |
| `sharp` | a 2x phone with the sharp kernel                                             |
| `high`  | a 2x phone at the high tier (200,000 splats in a kit toy instead of 140,000) |
| `all`   | a 3x phone with every lever on (`?sharp=1&kernel=sharp`)                     |

The measures are lane Lab's, with the edge now in CSS pixels so different ratios compare:

- **Edge**: the median 10–90% rise across the strongest edges, in CSS pixels (device pixels ÷
  ratio). Lower is sharper.
- **Speckle**: the mean difference from a 3×3 median over the flatter half of the toy, in the
  canvas's own pixels. Lower is cleaner.
- **Shimmer**: the mean frame-to-frame change of the fine detail over 12 frames turning 0.4° each.
  Lower is steadier.
- **Culled**: the share of the toy's splats the engine's default cull drops in that view, estimated
  on the CPU from each splat's two largest axes, its opacity and the 0.3 px² blur every splat gets
  (kit toys only): by `minPixelSize` on WebGL2, and by `minContribution` as well on WebGPU.
- **Frame**: milliseconds per frame in the software renderer, relative only and noisy (±20%).

The toys were measured on a local checkout of main with Fidelity A (#77), Fidelity B (#90), Worlds
(#78) and the toy piano (maker B, #91) merged in, so they are built as they will be. The test island
was measured with `world:test-island` (the world page has its own renderer, so the tool sets its
ratio and cull by hand).

## Results

Each cell is edge (CSS px) · speckle · shimmer, WebGL2.

| Toy (view)               | Today, 2x          | Adaptive drop (1.33x) | 3x phone, cap lifted | Cull off           | Sharp kernel       | High tier           | All levers, 3x     |
| ------------------------ | ------------------ | --------------------- | -------------------- | ------------------ | ------------------ | ------------------- | ------------------ |
| lamp (home)              | 0.75 · 0.42 · 1.95 | 0.95 · 0.51 · 2.18    | 0.52 · 0.37 · 1.57   | 0.75 · 0.42 · 1.95 | 0.75 · 0.42 · 1.93 | 0.72 · 0.45 · 2.03  | 0.52 · 0.34 · 1.52 |
| american-football (home) | 0.74 · 0.92 · 1.81 | 1.00 · 1.21 · 1.99    | 0.50 · 0.61 · 1.49   | 0.74 · 0.92 · 1.81 | 0.74 · 0.93 · 1.84 | 0.71 · 1.00 · 1.92  | 0.50 · 0.64 · 1.55 |
| hockey-puck (home)       | 0.41 · 0.27 · 1.17 | 0.92 · 0.44 · 1.26    | 0.27 · 0.24 · 1.01   | 0.41 · 0.27 · 1.17 | 0.41 · 0.27 · 1.17 | 0.43 · 0.24 · 1.14  | 0.27 · 0.24 · 1.02 |
| klein-bottle (home)      | 0.84 · 1.19 · 1.42 | 1.37 · 1.64 · 1.63    | 0.53 · 0.77 · 1.13   | 0.85 · 1.18 · 1.42 | 0.82 · 1.24 · 1.47 | 0.81 · 1.00 · 1.75  | 0.53 · 0.86 · 1.24 |
| clock (home)             | 0.70 · 0.74 · 2.06 | 1.05 · 0.99 · 2.40    | 0.51 · 0.49 · 1.68   | 0.72 · 0.75 · 2.14 | 0.72 · 0.64 · 2.32 | 0.70 · 0.75 · 2.37  | 0.52 · 0.30 · 1.84 |
| penguin (home)           | 0.72 · 0.53 · 2.72 | 1.08 · 0.57 · 2.74    | 0.50 · 0.40 · 2.08   | 0.75 · 0.52 · 2.55 | 0.74 · 0.51 · 2.86 | 0.73 · 0.56 · 3.90  | 0.50 · 0.34 · 2.41 |
| snow-globe (home)        | 0.77 · 0.36 · 1.22 | 1.15 · 0.46 · 1.65    | 0.49 · 0.28 · 0.85   | 0.77 · 0.36 · 1.23 | 0.76 · 0.34 · 1.31 | 0.78 · 0.40 · 1.46  | 0.51 · 0.25 · 0.99 |
| white-blood-cell (home)  | 0.77 · 1.28 · 1.64 | 1.02 · 1.90 · 2.23    | 0.54 · 0.75 · 1.15   | 0.77 · 1.28 · 1.71 | 0.75 · 1.31 · 1.78 | 0.77 · 1.39 · 1.02  | 0.54 · 0.78 · 1.32 |
| ocean-liner (home)       | 0.47 · 0.64 · 3.28 | 0.66 · 0.89 · 4.22    | 0.46 · 0.40 · 2.25   | 0.59 · 0.64 · 3.27 | 0.44 · 0.64 · 3.43 | 0.43 · 0.72 · 3.88  | 0.46 · 0.38 · 2.57 |
| marble (home)            | 0.81 · 0.69 · 1.13 | 1.15 · 1.16 · 1.58    | 0.55 · 0.48 · 0.87   | 0.80 · 0.69 · 1.12 | 0.80 · 0.92 · 1.55 | 0.78 · 0.83 · 1.41  | 0.58 · 0.61 · 1.20 |
| sailboat (home)          | 0.66 · 0.81 · 3.32 | 0.96 · 1.25 · 3.69    | 0.49 · 0.51 · 2.49   | 0.61 · 0.82 · 3.32 | 0.67 · 0.81 · 3.38 | 0.59 · 0.90 · 3.12  | 0.49 · 0.49 · 2.64 |
| toy-piano (home)         | 0.79 · 0.37 · 2.81 | 1.10 · 0.47 · 3.43    | 0.59 · 0.27 · 2.05   | 0.79 · 0.37 · 2.81 | 0.79 · 0.31 · 2.88 | 0.77 · 0.39 · 3.23  | 0.58 · 0.18 · 2.21 |
| your-book (home)         | 0.77 · 0.13 · 0.91 | 1.01 · 0.18 · 0.90    | 0.51 · 0.09 · 0.95   | 0.77 · 0.13 · 0.91 | 0.76 · 0.04 · 1.02 | 0.77 · 0.14 · 0.92  | 0.51 · 0.02 · 1.03 |
| chladni-plate (home)     | 0.96 · 3.85 · 9.59 | 1.37 · 9.54 · 14.48   | 0.75 · 1.48 · 5.39   | 0.96 · 3.85 · 9.59 | 1.07 · 3.79 · 9.98 | 0.98 · 5.51 · 10.75 | 0.76 · 1.28 · 6.40 |
| lamp (0.45)              | 0.79 · 0.31 · 1.08 | 1.17 · 0.36 · 1.35    | 0.52 · 0.25 · 0.81   | 0.79 · 0.31 · 1.08 | 0.79 · 0.25 · 1.03 | 0.77 · 0.33 · 1.14  | 0.53 · 0.21 · 0.79 |
| hockey-puck (0.4)        | 0.42 · 0.18 · 0.56 | 0.62 · 0.23 · 0.72    | 0.30 · 0.13 · 0.44   | 0.42 · 0.18 · 0.56 | 0.42 · 0.16 · 0.59 | 0.43 · 0.17 · 0.55  | 0.29 · 0.11 · 0.47 |
| chladni-plate (0.5)      | 1.25 · 0.73 · 2.99 | 1.57 · 1.79 · 5.71    | 1.07 · 0.32 · 1.49   | 1.25 · 0.73 · 2.99 | 1.22 · 0.46 · 4.30 | 1.27 · 1.18 · 3.39  | 0.90 · 0.13 · 2.72 |

| Toy (view)               | Splats (mid) | Culled today, WebGL2 / WebGPU | Culled in the drop | Culled at 3x | Frame ms 2x → 3x |
| ------------------------ | ------------ | ----------------------------- | ------------------ | ------------ | ---------------- |
| lamp (home)              | 139,999      | 1.9% / 9.3%                   | 41% / 53.5%        | 0% / 0.7%    | 7.7 → 7.5        |
| american-football (home) | 240,000      | 0% / 0%                       | 0.1% / 0.1%        | 0% / 0%      | 5.4 → 6.2        |
| hockey-puck (home)       | 240,000      | 0.4% / 0.4%                   | 26.9% / 27%        | 0.1% / 0.2%  | 6.5 → 6.8        |
| klein-bottle (home)      | 112,000      | 0% / 22.7%                    | 0% / 83.5%         | 0% / 0%      | 6.0 → 7.6        |
| clock (home)             | 140,000      | 0% / 0%                       | 0% / 0%            | 0% / 0%      | 6.0 → 7.5        |
| penguin (home)           | 139,999      | 0% / 0%                       | 0.4% / 0.5%        | 0% / 0%      | 5.9 → 7.6        |
| snow-globe (home)        | 134,253      | 0% / 6.4%                     | 0% / 35.9%         | 0% / 0%      | 7.1 → 6.7        |
| white-blood-cell (home)  | 139,998      | 0% / 0%                       | 0% / 2.4%          | 0% / 0%      | 5.5 → 5.3        |
| ocean-liner (home)       | 140,006      | 0% / 0.2%                     | 0.4% / 2.2%        | 0% / 0%      | 5.8 → 7.6        |
| marble (home)            | 140,000      | 0% / 3.6%                     | 0% / 33.7%         | 0% / 0.1%    | 5.3 → 8.6        |
| sailboat (home)          | 140,000      | 1.4% / 3%                     | 7.6% / 11.5%       | 0% / 0.1%    | 6.3 → 7.2        |
| toy-piano (home)         | 140,074      | 0% / 0%                       | 1.3% / 1.3%        | 0% / 0%      | 4.5 → 6.0        |
| your-book (home)         | 100,064      | 0.6% / 0.6%                   | 2.1% / 2.1%        | 0% / 0%      | 11.5 → 17.4      |
| chladni-plate (home)     | 221,688      | 0% / 0%                       | 8.1% / 8.1%        | 0% / 0%      | 6.7 → 9.4        |
| lamp (0.45)              | 139,999      | 0% / 0.2%                     | 0% / 1%            | 0% / 0.1%    | 6.6 → 10.1       |
| hockey-puck (0.4)        | 240,000      | 0% / 0%                       | 0.1% / 0.1%        | 0% / 0%      | 8.2 → 6.3        |
| chladni-plate (0.5)      | 221,688      | 0% / 0%                       | 0% / 0%            | 0% / 0%      | 8.2 → 7.8        |

The test island (lane Worlds, start view, WebGL2), edge · speckle over the ground, and the frame
time:

| Config                | Edge · speckle | Frame (ms, software) |
| --------------------- | -------------- | -------------------- |
| 2x (its cap today)    | 0.73 · 0.16    | 1,124                |
| Adaptive drop (1.33x) | 0.81 · 0.26    | 688                  |
| 3x                    | 0.53 · 0.10    | 2,163                |
| Cull off              | 0.73 · 0.16    | 1,170                |

On WebGPU (the renderer most new phones get) the Klein bottle and the lamp drew the same with the
cull off as with it on at the home view (the Klein bottle's picture changed in 805 of a million
pixels, none of it visible), though the estimate says 23% and 9% of their splats are culled: those
splats sit under others on a dense surface.

## Where the grain comes from

- **The pixel-ratio cap: the biggest lever.** Most recent phones (every recent iPhone and many
  Android phones) have a device pixel ratio of 3, but every tier below Max caps the canvas at 2, so
  a 3x phone draws at 2x and its screen scales the picture up by half. Lifting the cap made every
  toy's edges about a third narrower (0.75 → 0.52 CSS px on the lamp, 0.84 → 0.53 on the Klein
  bottle), cut speckle by 10 to 60% (the white blood cell 1.28 → 0.75, the Chladni plate 3.85 →
  1.48) and shimmer by 15 to 45%. It also takes the WebGPU cull to almost nothing, because each
  splat covers more pixels. This is the grain the owner sees on the Worlds, the books' edges and the
  grainy toys: on a 3x phone it is everywhere, and no toy's build can fix it.
- **The adaptive drop: the worst grain, while anything moves.** When frames are slow (over about 24
  ms), the ratio drops by a third while the view is "busy", and busy includes the idle sway and
  every effect, not only a drag. At 1.33x every toy's edges widen by a third or more, speckle rises
  (the Chladni plate 3.85 → 9.54), and the cull drops far more splats: 41% of the lamp's on WebGL2,
  84% of the Klein bottle's on WebGPU. A slow phone can sit there for as long as a toy plays.
  `?adapt=drag` keeps full resolution unless a finger is dragging.
- **The cull: small on its own.** At a toy's home view on a 2x phone, `minPixelSize` drops under 2%
  of any toy's splats and `minContribution` (WebGPU) 0 to 23%, mostly splats hidden under others;
  turning it off changed no toy visibly. It matters with the drop (above), in far views and on the
  far pages of a book, which lane Pictures already handles with its own lower cull.
- **The falloff: per toy.** The sharp kernel changed nothing on toys whose splats are a pixel or two
  (most kit toys at home view), lowered speckle a little on the clock, the toy piano, the book and
  the Chladni plate up close, and raised it on the marble (0.69 → 0.92). As lane Lab found, it is a
  choice for toys with big, smooth splats, not a default.
- **The tier's budget: not a sharpness lever.** The high tier's 200,000 splats instead of 140,000
  made no toy sharper and several shimmer more (the penguin 2.72 → 3.90), because each splat gets
  smaller and more of them fall under the cull. More splats help a toy's shape, not its grain.
- **The toy's own build: what is left.** After the levers, the highest speckle is in toys whose
  colors carry noise or whose surfaces are grains by design: the Chladni plate's sand (1.28), the
  white blood cell's membrane (0.78), the Klein bottle's textured tube (0.86), the American football
  (0.64) and the marble's glass (0.61). The sailboat's hull shows dark flecks at any ratio. These
  are for a fidelity lane, not the renderer.
- **The anti-aliased splats (`?aa=1`): slightly worse.** They dim small splats to undo the 0.3 px²
  blur. On the lamp, the sailboat, the Klein bottle and the penguin, speckle rose a little (0.42 →
  0.44, 0.81 → 0.87, 1.19 → 1.24, 0.53 → 0.65) and no edge got sharper: kit toys are built without
  that blur in mind. Kept only for testing.

## Cost

In the software renderer, lifting the cap from 2 to 3 changed a toy's frame time by less than the
noise (a toy is a few hundred thousand splats; the renderer's cost there is mostly per splat), but
it doubled the test island's (1.1 s → 2.2 s: a world is fill-bound, with large overlapping splats
across the whole screen). On a real phone GPU, 3x draws 2.25 times the pixels: expect a toy to stay
at 60 frames a second on a recent phone and a world to cost close to twice the frame time and more
battery. The adaptive drop still catches a phone that can't keep up, during a drag.

`?adapt=drag` costs frame rate on slow phones while a toy plays on its own (the sway and effects may
run below 40 frames a second there instead of dropping resolution); the step down to a lower tier
after 30 slow frames still happens during drags.

## Recommendation

See "For the Operator" in [docs/handoff/Sharpness.md](../handoff/Sharpness.md).
