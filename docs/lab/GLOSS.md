# Gloss: color that moves with the view, on kit toys

Lane Kit lab, October 10, 2026 (Opus 5.5). A private comparison: no toy has it unless labs is on and
the toy (or the link) asks for it.

## Why kit toys have one color

Captured splats keep a first band of spherical harmonics, a few numbers per splat that change its
color with the direction it is seen from. Kit splats are placed by rule, not trained from photos, so
there is nothing to fit those numbers from, and PlayCanvas 2.22.3 turns view-dependent color off for
toys made in the browser. Some kit toys paint a shine into their colors instead (the marble's white
dot, the pool ball's soft spot). A painted shine turns with the toy, which is not how a reflection
behaves.

## What was built

No per-splat data. A kit splat that lies flat on a surface (the kit flattens surface splats along
the surface) already knows which way it faces: its thinnest axis. A separate version of the kit's
shader (`MODIFIER_KIT_GLOSS` in src/effects.js) reads that axis after the splat's own turn and its
part's, and adds a Blinn-Phong highlight from it, the camera, and a fixed light (the kit's own
light, from above and in front). Round splats (no facing) get none. The highlight adds cover as well
as light, so it shows on see-through glass.

- `?gloss=1` turns it on for any kit toy with labs on; `?gloss=0.9,250` sets the strength and the
  sharpness (the Blinn-Phong exponent). A recipe may carry `gloss: { strength, sharpness }`, read
  only with labs on. No recipe has one yet.
- Every other toy keeps the kit's shader exactly (tests/klab-engine.spec.mjs checks that the kit's
  program has no gloss in it, and that labs off ignores `?gloss=`).

## The comparison

Cards on Effect review page 2 (lane Kit lab, "Gloss that moves with the view"), each turning 60°
(40° for the chess set), today on the left and with the gloss on the right:

| Toy       | Gloss (strength, sharpness) | What shows                                                                                     |
| --------- | --------------------------- | ---------------------------------------------------------------------------------------------- |
| Marble    | 1.2, 400                    | A crisp highlight that stays with the light while the glass turns; the painted dot turns away. |
| Pool ball | 0.9, 250                    | The same on resin: a small bright spot that holds still while the 8 turns past it.             |
| Chess set | 0.6, 60                     | A softer lacquer sheen on the tops of the pieces; subtle at phone size, clearer up close.      |

## Cost

- **Memory**: none per splat. The highlight is worked out from data each splat already has. The only
  extra is one more shader program, compiled when a toy with gloss opens.
- **Frame time**: no cost the software renderer can see. The same toys, without and with the gloss
  (ms per frame, 390 × 844 at ratio 3, WebGL2 in SwiftShader): the clock 11.7 and 12.6, the bicycle
  9.9 and 10.1, the chess set 11.6 and 9.7, the marble 14.2 and 11.2, the pool ball 9.0 and 9.0, the
  oak 13.4 and 9.0, all within the run-to-run noise. On a GPU it is about 20 arithmetic operations
  per splat in the pass that already runs for every splat each frame.
- **Reads at phone size?** On the marble and the pool ball, yes: the moving highlight is the first
  thing you see when they turn. On the chess set it is faint at the full board and shows close up.

## What it doesn't do

- **Splats without a facing.** Volume splats (round ones, the inside of a toy) stay matte. A toy
  built from round splats (a cloud, fur) won't shine.
- **One light, fixed.** The light doesn't follow the room or the theme. A toy's painted shading
  already assumes the same light, so they agree.
- **Not trained color.** This is a highlight rule, not spherical harmonics fitted to anything. A
  real first band would need per-splat data (nine more numbers a splat) and a way to fill it from
  the recipe's material, which is more than this experiment needs to answer the question.

## If the owner likes it

A toy opts in with one line in its recipe (`gloss: { strength, sharpness }`), still behind labs
until he decides otherwise. The painted shine on the marble and the pool ball would then come out in
the same change, so the toy doesn't show two.
