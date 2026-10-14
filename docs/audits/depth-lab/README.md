## Part C — D. Shading and shadows; E. Overlap

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
