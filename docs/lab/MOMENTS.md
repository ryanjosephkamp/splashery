# Moments of t: 12 to 15 copies

Lane Kit lab, October 10, 2026 (Opus 5.5). The splat equation toy (labs) keeps one copy of the shape
for each of 12 moments of t across a cycle, and each splat slides in a straight line toward its
place in the next copy. A labs choice, **Moments of t** (12, 13, 14, or 15), now sets how many. 12
stays the default, so old links and saved scenes build exactly as before. 15 is the most: each copy
is a part, and a toy has at most 15.

## What was measured

The sphere program (`x = sin(v)cos(u + t)`, so it turns about its axis), built in Node with the
toy's own recipe at the weakest tier's budget (Low: 60,000 × the toy's density of 2 = 120,000
splats). The dip is how far a splat comes in toward the axis halfway between two copies, averaged
over the splats in the outer half (the chord against the arc: 1 − cos(π/n)). The silhouette dip is
the narrowest width of the rendered sphere during a step, against its width at rest (390 × 844,
WebGL2, SwiftShader).

| Moments | Dip, splats | Dip, silhouette | Splats per copy, sphere (7,000 asked) | Splats per copy, torus Fine (on Low) | Splats in all, sphere | Memory, sphere |
| ------- | ----------- | --------------- | ------------------------------------- | ------------------------------------ | --------------------- | -------------- |
| 12      | 3.41%       | 2.73%           | 6,956                                 | 9,800                                | 83,472                | 6.0 MB         |
| 13      | 2.91%       | –               | 6,956                                 | 9,045                                | 90,428                | 6.5 MB         |
| 14      | 2.51%       | –               | 6,956                                 | 8,320                                | 97,384                | 7.0 MB         |
| 15      | 2.19%       | 1.95%           | 6,956                                 | 7,750                                | 104,340               | 7.5 MB         |

Memory is the splat buffer on the CPU (18 floats a splat); the GPU copy grows the same way.

- **The dip** matches 1 − cos(π/n): 3.4% at 12 and 2.2% at 15. The silhouette dips less than the
  splats' centers (each splat has a size), 2.7% at 12 and 2.0% at 15.
- **The count is shared.** A copy gets the program's count when it fits, and 98% of the budget
  divided by the copies when it doesn't. The presets ask for 2,500 to 10,000 points, so at 15
  moments only the 10,000-point programs (the seashell and the galaxy) and Fine are cut, on the
  weakest tier, to 7,840 a copy at most (9,800 at 12). On Mid and higher no preset is cut.
- **Memory** grows with the copies when the program fits (the sphere: 6.0 MB at 12, 7.5 MB at 15,
  +25%), and stays the same when the budget is what limits it (the torus with Fine: 8.4 MB at both).
- **Build time** in Node (the container's CPU, not a phone): 200 to 650 ms a build at 12 and 230 to
  350 ms at 15, with no trend above the noise. Each copy evaluates the program once per point, so a
  build grows with the splats in all.

## Does it read at phone size?

The card (`klab-moments`) shows the sphere stepping through t at 12 and at 15 moments, side by side,
with a red ring at its rest width. The dip shows against the ring, and at 15 the ring stays closer,
but without the ring the difference is small at phone size: about a pixel and a half on a 300-pixel
sphere.

## Past 15

Each moment is a part (the 4-bit part number, and 16 part transforms in the shader). Two ways past
it, neither built:

1. **A keyframe texture.** Store each splat's place at every moment in a float texture (one row per
   moment, one texel per point) and let the shader read the two moments around t and blend them. One
   set of splats then shows every moment, so the count per copy is the whole budget, and 24 or 48
   moments cost only texture memory (24 moments × 10,000 points × 16 bytes = 3.8 MB). It needs a
   texture the kit's modifier can read (the screen texture shows the way) and an engine PR.
2. **Formulas compiled to a shader.** Translate the program's x, y, and z into GLSL and WGSL and
   evaluate them for each splat every frame, at the real t: no moments at all and no dip. The reader
   (src/equation.js) already makes a tree, so printing shader code from it is direct. The costs: a
   new program per typed equation (a compile on each change), care with NaN and infinite values on
   the GPU, and the sorting, which today relies on each copy being built in its own pose. Lane Lab's
   `gpuField` path already swaps in a recipe's own shader and showed that a field of 297,000 splats
   costs no more than the same toy frozen ([FIELDS.md](FIELDS.md), "Typed programs"), so it could
   start there, behind labs. The reader would need to hand back its tree (today it returns
   JavaScript closures).

## Recommendation

**Keep the Moments choice as a labs option, and keep 12 as the default.** At 15 the dip falls from
3.4% to 2.2%, but on the phone the difference is about a pixel and a half on the sphere's edge, and
a program that fits costs 25% more memory. If smoother turning shapes matter, the keyframe texture
above is the change that pays: it removes the dip without dividing the splats between copies.
