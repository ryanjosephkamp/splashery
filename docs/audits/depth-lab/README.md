# Depth lab

## F. Perspective and texture (part d)

154 original, code-drawn pictures, CC0, made by Ryan with Codex (GPT-6), October 14, 2026. The
generator code is MIT. This is a synthetic cue study for later Photo to 3D experiments; these
pictures are not real captures, AI-made samples, or measured depth ground truth.

- Generator: [`gen-f.mjs`](../../../tools/depth-lab/gen-f.mjs).
- Manifest: [`f.json`](../../../tools/depth-lab/f.json).
- Contact sheet: [`f.jpg`](f.jpg), containing every manifest entry in order.
- Rebuild: `SPLASHERY_CHROMIUM=/usr/bin/chromium node tools/depth-lab/gen-f.mjs`.
- Manifest check: `node tools/depth-lab/gen-f.mjs --check`.

All full pictures are 1,024 × 1,024 opaque PNGs, written only to `.cache/depth-lab/f/`. The manifest
records seed 7, every rendering parameter, the variables held fixed, and the conditional ideal-depth
expectation. Labels appear only on the contact sheet. Rebuilding also writes
`.cache/depth-lab/f/hashes.json` with the actual browser version, byte counts, and SHA-256 hashes.
The drawings use headless Chromium Canvas 2D through the existing pinned Playwright 1.56.1; no new
dependencies or image model are used. Set `SPLASHERY_CHROMIUM` to an existing Chromium executable,
or leave it unset to use an already-installed Playwright browser. No site server is needed.

Eight sweeps have seven levels each; two grids have 7 × 7 combinations:

| Series                      | Variable and levels                                         | Fixed scene                                            |
| --------------------------- | ----------------------------------------------------------- | ------------------------------------------------------ |
| `lines-convergence`         | Convergence 0, 1/6, 2/6, 1/2, 4/6, 5/6, and 1               | Nine lines; horizon y = 0.22; vanishing x = 0.5        |
| `lines-vanishing-x`         | Vanishing x = 0.2 through 0.8 in steps of 0.1               | Convergence 0.75; same line starts and horizon         |
| `grid-horizon`              | Horizon y = 0.1 through 0.7 in steps of 0.1                 | Full convergence; sixteen-row grid; spacing exponent 2 |
| `grid-spacing`              | Row spacing exponent 0.5, 0.75, 1, 1.5, 2, 3, and 4         | Full convergence; horizon y = 0.22                     |
| `texture-density`           | Density exponent 0.5, 0.75, 1, 1.5, 2, 3, and 4             | 800 dots; constant 24 px diameter and contrast         |
| `texture-size`              | Diameter exponent 0, 0.25, 0.5, 0.75, 1, 1.5, and 2         | Fixed positions, count, and contrast                   |
| `texture-contrast`          | Contrast exponent 0, 0.25, 0.5, 0.75, 1, 1.5, and 2         | Fixed positions, count, and diameter                   |
| `grid-horizon-contrast`     | Floor darkening 0, 0.05, 0.1, 0.15, 0.2, 0.25, and 0.3      | Same grid geometry; only floor fill changes            |
| `lines-convergence-x-grid`  | The seven convergence levels × the seven vanishing x levels | Same line starts and horizon                           |
| `texture-density-size-grid` | The seven density exponents × the seven diameter exponents  | Same random sequence, count, and contrast              |

Coordinates x and y are fractions of frame width and height, with the origin at the upper left. For
lines, the top x is `(1 - convergence) × bottomX + convergence × vanishingX`. Horizontal grid lines
use `y = horizonY + (1 - horizonY) × (row / 16)^gridDepthExponent`. For texture, a seeded linear
congruential generator supplies x and u; `t = max(0.012, u^densityExponent)` runs from the horizon
toward the bottom. Dot diameter is `max(2, 24 × t^sizeExponent)` px; contrast is
`0.8 × t^contrastExponent`. Dots are clipped to the floor. Density redistributes a fixed count of
dots; it does not also change their diameter or contrast in its sweep. The minimum diameter and t
are recorded here to make the rasterization limits explicit.

These are controlled perspective cues, not calibrated pinhole-camera projections. A level-floor
interpretation should recede toward the horizon without turning printed marks into ridges, but a
flat drawing also explains the image. There is no unique metric depth target. Repeated baseline
pictures across series are intentional controls; ids identify experiments, not unique rasters. The
convergence = 0 grid row intentionally repeats: vanishing x cannot affect parallel lines.
Same-browser regeneration is deterministic; other browser versions or platforms may rasterize edges
differently. The contact sheet uses high-quality reduction to preserve thin lines.

The task's shared command, `node tools/depth-lab/build.mjs <letter>`, is unavailable on the base
commit: that runner does not exist. Part d's allowed-file list excludes a shared runner, so this
part provides working direct commands. All three modules export `manifest`, `draw(canvas, entry)`,
and an async default `generate(options)` for later integration; importing them does not launch a
browser or write files. `generate` accepts `outDir` (the root containing category subfolders),
`sheetPath`, and `check`. F also holds the build support used by G and H, entirely within part d's
owned files. No experiments or depth inference have been run, and the Photo to 3D checkpoint and
runtime remain untouched.

## G. Size and height in the frame (part d)

182 original, code-drawn pictures, CC0, made by Ryan with Codex (GPT-6), October 14, 2026. The
generator code is MIT. These are silhouette cues with conditional expectations, not images with
known metric depth.

- Generator: [`gen-g.mjs`](../../../tools/depth-lab/gen-g.mjs).
- Manifest: [`g.json`](../../../tools/depth-lab/g.json).
- Contact sheet: [`g.jpg`](g.jpg), containing every entry in order.
- Rebuild: `SPLASHERY_CHROMIUM=/usr/bin/chromium node tools/depth-lab/gen-g.mjs`.
- Manifest check: `node tools/depth-lab/gen-g.mjs --check`.

All pictures are 1,024 × 1,024 opaque PNGs in `.cache/depth-lab/g/`; hashes, byte counts, and the
browser version are in that folder's `hashes.json`. Tooling, seed, module exports, and the shared
runner limitation are as described in F. Seed 7 is retained in every record; G needs no random
draws. No generated PNGs ship in the repository.

For each circle, square, and triangle, both a plain background and a fixed horizon background have a
seven-level size sweep and a seven-level height sweep: twelve sweeps, totaling 84 pictures. Two 7 ×
7 size-height grids contribute another 98 pictures.

| Series family                    | Levels                                                                                          | Controls                            |
| -------------------------------- | ----------------------------------------------------------------------------------------------- | ----------------------------------- |
| `<background>-<shape>-size`      | Diameter or bounding-box span 64, 96, 144, 216, 324, 486, and 648 px                            | Object center x = 0.58 and y = 0.55 |
| `<background>-<shape>-height`    | Center y = 0.22, 0.31, 0.40, 0.49, 0.58, 0.67, and 0.76                                         | Object span 192 px; center x = 0.58 |
| `plain-circle-size-height-grid`  | Span 64, 112, 160, 208, 256, 304, and 352 px × y = 0.32, 0.39, 0.46, 0.53, 0.60, 0.67, and 0.74 | Plain background; circle silhouette |
| `ground-square-size-height-grid` | The same span and y levels                                                                      | Fixed horizon; square silhouette    |

`background` is `plain` or `ground`; `shape` is `circle`, `square`, or `triangle`. Each experiment
changes only its named axis or axes. The object is an unshaded gray fill. For a triangle, center y
means the center of its bounding box, not its centroid. The ground background has a fixed horizon at
y = 0.14 and no floor texture. A 64 px reference disk at x = 0.14 and y = 0.85 stays unchanged in
every picture. It is spatially separate from the target, including at the largest size; objects stay
within the frame. Shapes and backgrounds define separate families, not extra variables inside a
sweep. There are no cast shadows, changing lights, blur, or haze.

Apparent size requires an equal-world-size assumption to imply distance. Frame height requires a
common-ground assumption, and the objects are silhouettes with no known contact points. Neither cue
proves absolute distance, and a perfect model should not manufacture relief inside the flat fill.
The plain-background controls help expose a response to these assumptions. Baselines repeat
intentionally across sweeps and grids. No model output or depth score is included.

## H. Haze and focus (part d)

154 original, code-drawn pictures, CC0, made by Ryan with Codex (GPT-6), October 14, 2026. The
generator code is MIT. These are synthetic layer operations, not a physical atmosphere or lens
simulation.

- Generator: [`gen-h.mjs`](../../../tools/depth-lab/gen-h.mjs).
- Manifest: [`h.json`](../../../tools/depth-lab/h.json).
- Contact sheet: [`h.jpg`](h.jpg), containing every entry in order.
- Rebuild: `SPLASHERY_CHROMIUM=/usr/bin/chromium node tools/depth-lab/gen-h.mjs`.
- Manifest check: `node tools/depth-lab/gen-h.mjs --check`.

All pictures are 1,024 × 1,024 opaque PNGs in `.cache/depth-lab/h/`; hashes, byte counts, and the
browser version are in that folder's `hashes.json`. Tooling, seed, module exports, and the shared
runner limitation are as described in F. Every card has the same seeded, printed pattern. The fixed
near, middle, and far cards have normalized ordinal distances 0, 0.5, and 1; centers (0.28, 0.79),
(0.69, 0.57), and (0.46, 0.34); and sizes 224, 168, and 112 px. This fixes existing size, position,
and floor-grid cues across all experiments, without overlap or clipping. Those distances are
authored layer assignments, not measured scene depths.

Eight seven-level sweeps contribute 56 pictures; two 7 × 7 grids contribute another 98.

| Series                    | Levels                                               | Controls                                |
| ------------------------- | ---------------------------------------------------- | --------------------------------------- |
| `distance-blur`           | Maximum blur 0, 1, 2, 4, 8, 12, and 20 px            | No haze; blur exponent 1                |
| `distance-haze`           | Haze strength 0, 0.1, 0.2, 0.35, 0.5, 0.7, and 0.9   | No blur; haze exponent 1                |
| `distance-blur-falloff`   | Blur exponent 0.25, 0.5, 0.75, 1, 1.5, 2, and 3      | Maximum blur 12 px; no haze             |
| `distance-haze-falloff`   | Haze exponent 0.25, 0.5, 0.75, 1, 1.5, 2, and 3      | Haze strength 0.8; no blur              |
| `uniform-blur`            | Scene-wide blur 0, 1, 2, 4, 8, 12, and 20 px         | No haze; same scene geometry            |
| `uniform-haze`            | Scene-wide haze 0, 0.1, 0.2, 0.35, 0.5, 0.7, and 0.9 | No blur; same scene geometry            |
| `focus-plane`             | Focus depth 0, 1/6, 2/6, 1/2, 4/6, 5/6, and 1        | Focus width 0.25; maximum defocus 12 px |
| `focus-width`             | Width 0.14, 0.18, 0.23, 0.3, 0.4, 0.55, and 0.75     | Focus depth 0.5; maximum defocus 12 px  |
| `distance-blur-haze-grid` | The seven blur levels × the seven haze levels        | Both distance exponents 1               |
| `focus-plane-width-grid`  | The seven focus depths × the seven focus widths      | Maximum defocus 12 px; no haze          |

Distance effects apply to cards only, leaving the reference floor and sky unchanged. At distance d,
blur is `blurMaxPx × d^blurExponent`, and haze alpha is `hazeStrength × d^hazeExponent`. Haze blends
each card toward gray 224 before blurring it. The near card at d = 0 is unchanged; the far card at d
= 1 receives the maximum effect. The falloff sweeps change the middle card while the endpoints stay
fixed. Canvas blur is specified in output pixels, so it is not tied to each card's size.

Focus effects also apply only to cards: blur is
`focusBlurMaxPx × (1 - exp(-0.5 × ((d - focusDepth) / focusWidth)^2))`. A moving focus plane can
sharpen the middle or far card while the near card is blurred. The width controls the distance range
that stays sharp; it is not a real aperture value. Uniform controls instead degrade the whole image,
including the floor and sky. Uniform blur uses extended edge pixels to keep the picture opaque and
avoid an artificial frame boundary.

Expectations preserve the authored near-middle-far order, regardless of which card is sharpest. The
texture is painted on the cards, so changing its contrast or focus should not turn it into holes or
raised geometry. Baseline repeats are intentional. No Photo to 3D inference, lens calibration,
atmospheric measurement, or runtime change is part of this deliverable.
