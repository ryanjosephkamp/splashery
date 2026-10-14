# Depth lab

The depth lab's test pictures, built by Codex task 75 in five parts (a to e).

## A. Plain fields and gradients (part a)

Original, code-drawn CC0 pictures and contact sheet, made by Ryan with Codex (GPT-6), October
14, 2026. Generator code is MIT. These are internal experiment inputs, not AI-made samples, real
captures, or depth-model results. Rule check: none.

[`a.json`](../../../tools/depth-lab/a.json) records **144 pictures**, all opaque 1,024 × 1,024 PNG
files. Each record includes every drawing parameter, seed 7, fixed controls, and a qualitative
expectation. [`gen-a.mjs`](../../../tools/depth-lab/gen-a.mjs) generates them under
`.cache/depth-lab/a/`; that ignored directory also contains a SHA-256 index. Only the manifest,
generator, and [contact sheet](a.jpg) are committed.

| Sweep                       | Levels | Variable and range                                               |
| --------------------------- | ------ | ---------------------------------------------------------------- |
| Gray field                  | 9      | Encoded intensity, 0–255                                         |
| Hue field                   | 9      | HSV hue, 0–320 degrees; saturation 1, value 192                  |
| Saturation field            | 9      | HSV saturation, 0–1; hue 200 degrees, value 192                  |
| Gradient direction          | 8      | 0–315 degrees in 45-degree steps; 0 points right, 90 points down |
| Gradient span               | 9      | Encoded intensity span, 0–192; midpoint 127.5                    |
| Gradient falloff            | 9      | Exponent, 0.25–6                                                 |
| Gradient shape              | 5      | Linear, radial, diamond, square, and conic                       |
| Radial radius               | 9      | 0.125–0.75 of frame width                                        |
| Radial center               | 9      | Horizontal position, 0.1–0.9; vertical position 0.5              |
| Noise amplitude             | 9      | Uniform noise half-range, 0–96 intensity units                   |
| Noise cell size             | 9      | 1–256 pixels; amplitude 32                                       |
| Direction × span            | 5 × 5  | Independent angle and intensity span                             |
| Noise amplitude × cell size | 5 × 5  | Independent amplitude and spatial scale                          |

Each sweep changes one recorded variable. The two grids change exactly two. Matching levels share
the same coordinate-hashed noise samples; changing amplitude scales one realization instead of
rerolling it. Pixels are rounded to 8-bit encoded sRGB values, not linear-light radiance. HSV value
stays fixed in the hue sweep; perceptual luminance does not. Uniform noise is achromatic and is not
a physical sensor simulation. There are intentional identical null controls across families.

The linear ramp normalizes its projection by `abs(cos(angle)) + abs(sin(angle))` so its nominal span
stays fixed when the direction changes. Radial, diamond, and square distances saturate at the
recorded radius; the conic ramp wraps at its seam. These shape definitions and their seams are part
of the treatment, not inferred geometry. Plain fields, ramps, and noise do not specify a unique 3D
surface: `expect` describes a null hypothesis, not measured or metric depth.

Regenerate with the existing pinned dependencies in `package-lock.json`:

```sh
SPLASHERY_CHROMIUM=/usr/bin/chromium node tools/depth-lab/gen-a.mjs
node tools/depth-lab/gen-a.mjs --verify
```

Set `SPLASHERY_CHROMIUM` to the installed Chromium path, or omit it to use Playwright's browser. No
server is needed. The build checks the committed manifest against the design, writes the PNGs,
decodes every file to check dimensions and opacity, and creates the sheet in a real headless
Chromium canvas. `--verify` regenerates every image in memory and checks its SHA-256 against both
the cached file and index. It leaves the sheet and files unchanged. `--manifest` rewrites only the
category's manifest after an intentional design edit.

The generator uses already pinned and licensed `pngjs` 7.0.0, `jpeg-js` 0.4.4, and
`@playwright/test` 1.56.1 from [LICENSES.md](../../../LICENSES.md). No dependencies or credits in
shared asset catalogs change: these files do not ship as site samples. Reproducibility applies to
the pinned image encoders and runtime; the contact sheet also depends on Chromium and its fonts. The
sheet shows decoded files in manifest order at 144 pixels using nearest-neighbor sampling. Use
full-size files to judge fine noise, banding, and compression.

Verification on October 14, 2026: Node 24.19.0 and Chromium 151.0.7922.173 built the suite, and
`--verify` matched all 144 cached files byte for byte. Independent decoded-pixel checks confirmed
constant gray fields, ramp direction and reversal, the zero-span control, constant noise blocks, and
one-variable sweep controls. Uniform noise at half-range 32 measured a standard deviation of 18.477,
compared with the specified distribution's 18.475. The contact sheet was inspected visually. No site
or depth model was run.

## I. Resolution and compression (part a)

Original, code-drawn CC0 pictures and contact sheet, made by Ryan with Codex (GPT-6), October
14, 2026. Generator code is MIT. Rule check: none.

[`i.json`](../../../tools/depth-lab/i.json) records **158 pictures**.
[`gen-i.mjs`](../../../tools/depth-lab/gen-i.mjs) generates `.cache/depth-lab/i/` and its SHA-256
index; the manifest, generator, and [contact sheet](i.jpg) are committed. The generator imports
image writing, manifest checks, noise hashing, and sheet creation from part a's `gen-a.mjs`.

Three fixed reference pictures give encoding controls: an opaque gray field at intensity 128, a
horizontal gray ramp from 32 to 224, and an original synthetic scene containing a shaded sphere,
overlapping blocks, a floor grid, a fine checker patch, and thin bars. The scene's palette, layout,
and lighting never change. It is an encoding reference, not a ground-truth depth capture.

| Sweep                        | Pictures | Variable and levels                                                               |
| ---------------------------- | -------- | --------------------------------------------------------------------------------- |
| Resolution, each reference   | 3 × 9    | 256, 384, 512, 768, 1,024, 1,536, 2,048, 3,072, and 4,096 pixels; PNG             |
| JPEG quality, each reference | 3 × 9    | 10, 20, 30, 40, 50, 65, 80, 90, and 100; 1,024 pixels                             |
| Luma noise, each reference   | 3 × 9    | Sigma 0, 0.5, 1, 2, 4, 8, 16, 32, and 64; PNG, 1,024 pixels                       |
| RGB noise, each reference    | 3 × 9    | Same sigma levels; independent channel noise; PNG, 1,024 pixels                   |
| Resolution × JPEG quality    | 5 × 5    | Scene; 256, 512, 1,024, 2,048, and 4,096 pixels × quality 10, 30, 50, 80, and 100 |
| Noise × JPEG quality         | 5 × 5    | Scene; sigma 0, 2, 8, 16, and 32 × quality 10, 30, 50, 80, and 100; 1,024 pixels  |

Every resolution comes from the **same fixed 4,096-pixel source**. Exact area averaging handles both
integer and fractional resize ratios, including 384, 768, 1,536, and 3,072 pixels; rounding happens
after the weighted sum. Gray and ramp sources use equivalent constant/row calculations. All
averaging happens in encoded sRGB space. There is no rerendering of geometry, random crop, or
sharpening when the resolution changes. JPEG variants start from the matching clean, resized raster.
The lossless controls are `i-resolution-<reference>-1024.png`; JPEG quality 100 is still a JPEG
treatment, not the lossless control. Quality refers to the pinned `jpeg-js` encoder, not a universal
quality scale.

Sensor noise is an explicit **approximation**: seeded Box–Muller Gaussian samples are added in 8-bit
encoded sRGB units after resizing and before encoding. Luma mode adds the same sample to all three
channels; RGB mode uses independent channel samples. The noise realization stays fixed as sigma or
JPEG quality changes. Rounding and clipping to 0–255 follow noise addition, so high sigma treatments
can have a smaller observed standard deviation than their requested sigma. There is no shot noise,
demosaicing, exposure change, or sensor calibration. A null field should remain flat; the scene's
relative depth ordering should survive as detail permits. These are expectations for later
experiments, not evidence that any depth model achieves them.

```sh
SPLASHERY_CHROMIUM=/usr/bin/chromium node tools/depth-lab/gen-i.mjs
node tools/depth-lab/gen-i.mjs --verify
```

The build and verification behavior, existing dependencies, license, and thumbnail limitations are
the same as category A. Generated pictures and hash indexes stay in the ignored cache. No depth
inference, Photo to 3D changes, or comparison against the checkpoint is performed in this
picture-only task.

Verification on October 14, 2026: `--verify` matched all 158 cached files byte for byte. Independent
checks covered all 23 sweeps and four complete grids across A and I, source-based area averaging at
integer and fractional resize ratios, all resolution levels, identical zero-noise PNG baselines,
matching luma channels, and separate RGB channels. The gray control with sigma 8 measured 7.999,
with mean noise −0.016. Scene JPEG mean squared error was 94.005 at quality 10 and 0.518 at quality
100, compared with its clean PNG; quality 100 was not lossless. The contact sheet was inspected
visually.

The shared `tools/depth-lab/build.mjs` named in task 75 was absent at the branch's base. Direct
category commands above work within part a's file scope; a shared runner needs coordination with the
other parts.

## B. Lines

Task 75, part b, October 14, 2026. Original pictures and the contact sheet are CC0, **made by Ryan
with Codex (GPT-6)**; generator code is MIT. The original source is
[gen-b.mjs](../../../tools/depth-lab/gen-b.mjs), and the complete recipe record is
[b.json](../../../tools/depth-lab/b.json). No outside assets, image models, or new dependencies are
used. These are input pictures for later experiments; no depth model was run or scored.

There are **150 cases**, all 1,024 × 1,024 PNGs, with seed 7. Every straight-line and corner family
gets the following one-variable sweeps. A corner is a single joined V-shaped stroke; changing its
angle rotates the whole stroke.

| Variable                       | Levels                                                 |
| ------------------------------ | ------------------------------------------------------ |
| Stroke width, px               | 1, 2, 4, 8, 16, 32, 64                                 |
| Relative linear-light contrast | 0.05, 0.1, 0.2, 0.4, 0.6, 0.8, 0.95                    |
| Color                          | Gray; hue 0°, 45°, 90°, 135°, 180°, 225°, 270°         |
| Rotation, clockwise            | 0°, 22.5°, 45°, 67.5°, 90°, 112.5°, 135°, 157.5°, 180° |
| Edge blur sigma, px            | 0, 0.5, 1, 2, 4, 8, 12                                 |
| Parallel stroke count          | 1, 2, 3, 4, 5, 6, 7                                    |
| Stroke length, px              | 64, 128, 192, 256, 384, 480, 640                       |

The seven sweeps total 52 cases per geometry, or 104 cases. A 3 × 7 grid compares miter, round, and
bevel joins at interior angles of 30°, 45°, 60°, 90°, 120°, 135°, and 150°, with width fixed at 32
px. A 5 × 5 grid compares widths of 1, 2, 4, 8, and 16 px against contrasts of 0.05, 0.1, 0.2, 0.4,
and 0.8. Baselines repeat across sweeps and grids deliberately; records are experiment cases, not
independent random samples. Straight-line rotations of 0° and 180° are an invariance control.

The fixed baseline uses an RGB (240, 240, 240) background, an 8 px gray stroke, contrast 0.8,
rotation 0°, blur 0 px, one 480 px stroke, 64 px spacing, butt caps, miter joins, a 90° interior
corner angle, and miter limit 10. Seeded Mulberry32 selects the same subpixel registration for every
case; its exact center is in each record. `controls` names the variable being changed and lists
every fixed parameter. The color sweep holds linear-light luminance fixed before 8-bit RGB rounding;
contrast is `(background Y - foreground Y) / background Y`. Blur is applied only to the transparent
foreground layer, so the background stays fixed.

Regenerate with the repository's existing Playwright dependency and Chromium:

```sh
SPLASHERY_CHROMIUM=/usr/bin/chromium node tools/depth-lab/gen-b.mjs
```

Use your installed browser's path for `SPLASHERY_CHROMIUM`. The command reads and checks the
committed manifest, writes PNGs under `.cache/depth-lab/b/`, and writes [b.jpg](b.jpg). To
deliberately revise the recipe, run `node tools/depth-lab/gen-b.mjs --manifest` before rebuilding.
No generated PNG is committed. The contact sheet includes every case in manifest order, with its ID
and one-based index; inspect full-size PNGs for faint or thin strokes.

The brief's shared `tools/depth-lab/build.mjs` does not exist on the starting `main` commit,
`e404cf36`. Part b's file scope excludes that shared file, so these two generators provide direct
commands and exported `build()` functions for a future shared runner. C uses B's rendering helper;
both are owned by this part.

The expected result is the deliberately flat drawing surface. A single graphic does not uniquely
determine a real scene's depth; the manifest's `expect` is a controlled flat-plane hypothesis, not a
claim that monocular depth has one physically provable answer. There are no shadows, textures, or
perspective cues.

Verification on October 14, 2026 used Node 24.19.0, Playwright 1.56.1, and real Chromium
151.0.7922.173 on Linux. All 150 PNGs decoded as opaque, nonempty, 1,024 px squares with
background-only outer borders. Pixel checks confirmed stroke widths by integrated coverage, parallel
stroke counts, and color-sweep luminance within 0.002 after RGB rounding. Two complete builds
produced identical PNG and contact-sheet bytes. The sheet was visually reviewed. Browser versions
can change antialiasing or encoding; byte identity was verified in this environment.

- Contact sheet SHA-256: `fbe8756ac6188764f3fee59893fcbb8ebf33a2c43b019a53acf047902d5d9869`.
- PNG corpus SHA-256: `2ff9067ac2965a593159a35da304c7967c8f9eb23e2586acffb960a42c3031e0`.

The corpus digest hashes the UTF-8 concatenation of `<PNG SHA-256>  <manifest file>\n` in manifest
order, with two spaces and a final newline. Provenance: original procedural drawings from the linked
generator, by the author above, CC0, recorded on October 14, 2026; no source image was modified.

## C. Flat shapes

Task 75, part b, October 14, 2026. Original pictures and the contact sheet are CC0, **made by Ryan
with Codex (GPT-6)**; generator code is MIT. The original source is
[gen-c.mjs](../../../tools/depth-lab/gen-c.mjs), and the complete recipe record is
[c.json](../../../tools/depth-lab/c.json). No outside assets, image models, or new dependencies are
used. No depth model was run or scored.

There are **306 cases**, all 1,024 × 1,024 PNGs, with seed 7: circles, squares, and equilateral
triangles, each filled and outlined. Within each of these six families, five one-variable sweeps
have seven levels each (210 cases):

| Variable                       | Levels                                      |
| ------------------------------ | ------------------------------------------- |
| Shape size, px                 | 64, 128, 192, 256, 384, 512, 640            |
| Horizontal center, px          | 224, 288, 384, seeded center, 640, 736, 800 |
| Vertical center, px            | 224, 288, 384, seeded center, 640, 736, 800 |
| Edge blur sigma, px            | 0, 0.5, 1, 2, 4, 8, 12                      |
| Relative linear-light contrast | 0.05, 0.1, 0.2, 0.4, 0.6, 0.8, 0.95         |

Each outlined shape also gets a seven-level outline-width sweep: 1, 2, 4, 8, 16, 32, and 64 px (21
cases). Each filled shape gets a 5 × 5 size/softness grid: sizes 64, 128, 256, 384, and 640 px
versus blur sigmas 0, 1, 2, 4, and 8 px (75 cases). Repeated baseline cases intentionally connect
the sweeps and grids.

The fixed baseline is a gray 384 px shape at the seeded center, contrast 0.8, rotation 0°, blur 0
px, and an RGB (240, 240, 240) background. Outlines use width 8 px, miter joins, and miter limit 10.
Position sweeps change only one center coordinate, and retain the shape's full visible border. Size
means circle diameter, square side length, or triangle base length; the triangle's height is
`sqrt(3) / 2 × size`. Centers refer to the bounding box, not the triangle's centroid. Stroke width
is centered on the path, outside and inside its boundary. These conventions make each shape's size
sweep comparable within its own family; cross-shape comparisons do not hold area constant. Every
record states the full fixed parameters, including the exact subpixel center selected by seed 7.

Regenerate with:

```sh
SPLASHERY_CHROMIUM=/usr/bin/chromium node tools/depth-lab/gen-c.mjs
```

The command reads and checks the committed manifest, writes PNGs under `.cache/depth-lab/c/`, and
writes [c.jpg](c.jpg). To deliberately revise the recipe, run
`node tools/depth-lab/gen-c.mjs --manifest` before rebuilding. The contact sheet includes every case
in manifest order, with its ID and one-based index. Only the generator, manifest, contact sheet, and
this section are committed.

The expected result is the same flat-plane hypothesis as B. A circle is not necessarily a sphere, an
outline is not necessarily a hole, and smaller or higher graphics do not establish distance. These
cases isolate how the later depth experiment responds to those cues without adding shading or
overlap.

Verification used the same real Chromium and tool versions as B. All 306 PNGs decoded as opaque,
nonempty, 1,024 px squares with background-only outer borders. Pixel checks confirmed that filled
shapes cover their center while outlined shapes leave it at the background color. Two complete
builds produced identical PNG and contact-sheet bytes. The sheet was visually reviewed.
Reproducibility across browser versions was not measured.

- Contact sheet SHA-256: `38182ac03f3263b55877acd4737b73b292dd2d0a9d057fc65b525f6ed71b4926`.
- PNG corpus SHA-256, using B's digest convention:
  `18f4172c0bfd812dd5f18a1a7b4829b189d9cc6a3be55e2f3417749fcb806b2c`.

Provenance: original procedural drawings from the linked generator, by the author above, CC0,
recorded on October 14, 2026; no source image was modified.

## D and E. Shading, shadows, and overlap (part c)

Task 75 part C, October 14, 2026. Original pictures and contact sheets are **CC0**, made by Ryan
with Codex (GPT-6); generator code is offered under Splashery's MIT license. These are code-drawn
experimental stimuli, not AI-made images, real captures, ground-truth depth maps, or results of a
depth-model experiment. No depth model or Photo to 3D code was run or changed.

### D. Shading and shadows

[Contact sheet: every D picture, in manifest order](d.jpg). **176 pictures**, each a 1,024 × 1,024
PNG with seed 7, a gray 224 background, and a fixed disc centered at (512, 460), radius 200 pixels.
Only the contact sheet carries text. The manifest records every parameter, including inactive ones,
and names the varying parameters and the fixed controls for each entry.

| Series           | Levels or grid | Variable and interpretation                                  |
| ---------------- | -------------- | ------------------------------------------------------------ |
| sphere-azimuth   | 9              | Light angle in the image plane, 0° to 320°                   |
| sphere-elevation | 7              | Light elevation above the image plane, 10° to 90°            |
| sphere-falloff   | 7              | Exponent on the positive normal/light dot product, 0.25 to 3 |
| sphere-ambient   | 7              | Constant intensity term, 0 to 0.28                           |
| sphere-diffuse   | 7              | Diffuse intensity amplitude, 0 to 0.72                       |
| sphere-reversal  | 7              | Blend toward the reversed intensity pattern, 0 to 1          |
| cast-opacity     | 7              | Shadow opacity, 0 to 0.6                                     |
| cast-blur        | 7              | Canvas Gaussian blur radius, 0 to 64 pixels                  |
| cast-offset      | 7              | Shadow center displacement from (512, 660), 0 to 240 pixels  |
| cast-direction   | 9              | Shadow displacement angle, 0° to 320°                        |
| contact-opacity  | 7              | Contact shadow opacity, 0 to 0.6                             |
| contact-blur     | 7              | Contact shadow blur radius, 0 to 32 pixels                   |
| contact-width    | 7              | Full contact shadow ellipse width, 60 to 240 pixels          |
| contact-gap      | 7              | Shadow center displacement below the disc, 0 to 96 pixels    |
| grid-light       | 7 × 7          | Light azimuth × elevation                                    |
| grid-cast        | 5 × 5          | Cast shadow opacity × blur radius                            |

The six sphere sweeps use the visible hemisphere's normals. Screen coordinates point right and down;
positive light elevation points toward the viewer. Gray values are computed directly in 8-bit canvas
channels, without a linear-light or gamma-correct radiometric simulation. A tiny, fixed
pixel-coordinate hash dither uses seed 7. The reversal sweep is a deliberate cue conflict, not a
physically modeled concave object; halfway through it, the interior becomes flat.

The eight shadow sweeps use a flat gray 150 disc to isolate shadow cues from surface shading. Cast
shadows are ellipses with radii (190, 48); contact shadows have a 14-pixel vertical radius. They are
composited before the disc. The shadow controls are independent image manipulations, not a coupled
3D light, object, and receiving-plane simulation. `contactGapPx` measures center displacement, not
empty space: small values still touch the disc because the ellipse and its blur have extent. These
definitions make the intended experiment explicit without claiming geometric truth. The ideal-depth
expectation is conditional on the intended sphere or supported-disc interpretation; shading alone is
ambiguous.

### E. Overlap

[Contact sheet: every E picture, in manifest order](e.jpg). **185 pictures**, each a 1,024 × 1,024
PNG with seed 7 and the same gray 224 background. E has no random draws, texture, lighting, shadows,
or text; the recorded seed fixes the experiment convention. Shape sizes and gray values stay fixed
within each sweep except for its named variable.

| Series                | Levels or grid | Variable and interpretation                             |
| --------------------- | -------------- | ------------------------------------------------------- |
| pair-circles          | 7              | Horizontal overlap, 0 to 1                              |
| pair-circle-square    | 7              | Horizontal overlap with a square in front               |
| pair-squares          | 7              | Horizontal overlap between squares                      |
| pair-triangle-circle  | 7              | Horizontal overlap with a triangle behind               |
| pair-front-gray       | 7              | Front gray value, 40 to 220                             |
| pair-back-gray        | 7              | Back gray value, 40 to 220                              |
| pair-edge-blur        | 7              | Blur radius applied to both silhouettes, 0 to 32 pixels |
| pair-rotation         | 7              | Front square rotation, 0° to 90°                        |
| pair-front-scale      | 7              | Front radius or half-size multiplier, 0.4 to 1          |
| pair-height           | 7              | Front vertical displacement, −180 to 180 pixels         |
| t-gap                 | 7              | Gap between stem and bar, 0 to 96 pixels                |
| t-thickness           | 7              | Bar thickness, 24 to 168 pixels                         |
| t-overhang            | 7              | Bar extension beyond each stem edge, 0 to 120 pixels    |
| t-orientation         | 7              | Rotation of the complete T-junction, 0° to 180°         |
| t-contrast            | 7              | Bar gray value, 100 to 190; stem gray fixed at 100      |
| stack-order           | 6              | All permutations of three fixed shapes                  |
| grid-overlap-contrast | 7 × 7          | Pair overlap × front gray value                         |
| grid-t                | 5 × 5          | T-junction overhang × thickness                         |

For pairs, the base radius or half-size is 200 pixels. Both centers move symmetrically about
(512, 512) as `overlap` changes: their horizontal separation is `400 × (1 − overlap)` pixels. The
fraction describes bounding-width overlap, not area overlap. A triangle is an isosceles triangle
inside the same 400-pixel bounding square. Scaling or rotating a foreground shape can also change
the visible overlap; those sweeps hold the center separation fixed. Equal gray values, zero overlap,
and full occlusion intentionally weaken or remove visible order cues.

The T has an 80-pixel stem, a fixed stem endpoint at local y = 280, and a bar centered on the
origin. Its full width is `80 + 2 × tOverhangPx`; changing thickness also moves the stem's meeting
point to the bar's lower edge. This is a flat T-junction stimulus, not proof that a hidden stem
continues behind the bar. In stacks, shape 0 is a gray 80 circle centered at (420, 430), radius 190;
shape 1 is a gray 140 square centered at (600, 450), half-size 180; shape 2 is a gray 195 triangle
centered at (512, 650), half-size 190. `stackOrder` lists back to front. The expectations ask for
supported local occlusion order, not a metric depth scale or invented hidden geometry.

### Regeneration and integration

Run from the repository root with its existing pinned Playwright dependency and an installed
Chromium. In the verified environment:

```sh
SPLASHERY_CHROMIUM=/usr/bin/chromium node tools/depth-lab/gen-d.mjs
SPLASHERY_CHROMIUM=/usr/bin/chromium node tools/depth-lab/gen-e.mjs
```

Each command verifies its checked-in manifest against the generator, writes its PNGs only to
`.cache/depth-lab/d/` or `.cache/depth-lab/e/`, and rebuilds its own JPEG contact sheet. A
deliberate generator edit requires `--manifest`, followed by Prettier on the corresponding JSON
file. Repeated baselines across sweeps, and degenerate grid cells where a variable has no visible
effect, are intentional controls; identifiers remain unique. Within each sweep, exactly one manifest
variable changes across 6, 7, or 9 levels; each grid changes exactly two.

Task 75 names `node tools/depth-lab/build.mjs <letter>`, but no shared builder exists on the base
commit. Part C's file ownership prohibits adding it. Both modules export `category`, `manifest`,
`draw(ctx, entry)`, and `build(options)` (also the default export), so a shared builder can import
and call `build()` for either letter. `outputDir` and `contactSheet` options let verification use
separate cache paths. No other part's files, asset registries, application files, or vendors are
changed. These pictures are not shipped as toy assets; their CC0 credit and provenance stay here and
in the generator headers until any later shipping step creates the asset and in-app records.

Verification uses real Chromium 151.0.7922.173 with Playwright 1.56.1 and Node 24.19.0 on Linux.
Pixel files are deterministic within that environment; browser rasterization, JPEG encoding, and
contact-sheet fonts can vary with a different browser or platform. Image hashes, dimensions,
opacity, manifest structure, sweep isolation, grid completeness, and visual checks are verified
before handback. Model quality, depth accuracy, and performance remain unmeasured. Rule check: none.

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
