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
