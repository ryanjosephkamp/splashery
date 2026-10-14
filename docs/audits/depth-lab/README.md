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
