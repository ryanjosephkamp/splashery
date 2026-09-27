# Lane Math: Math you can type

Prefix `math`. Owns `src/packs/maths.js`, `src/equation.js`, the `snail` recipe in
`src/packs/animals.js` and the `american-football` recipe in `src/packs/balls.js`, its toys' entries
in the shared lists, `tests/math.spec.mjs`, its `math-*` screenshots and this file. How lanes work:
[OPERATING.md](../OPERATING.md). Earlier phases' notes and lessons: [history.md](history.md).

## Brief

Written by the Operator on September 27, 2026, from the ideas the owner approved on the Toy Ideas
page, and his notes on the snail.

Build 5 new kit-built toys for the Maths shelf, a small safe equation reader for the two plotters,
and two fixes to existing toys (the snail and the American football).

You own: src/packs/maths.js (frozen until now; add your toys, and keep the existing ones as they
are); a new module src/equation.js (the reader); your toys' rows in src/toys.js (category `maths`);
your toys' entries in src/toy-sounds.js and tools/toy-plan.json (TOY-PLAN.md regenerated); the
`snail` recipe in src/packs/animals.js and the `american-football` recipe in src/packs/balls.js
(those two toys only; their packs are otherwise frozen); tests/math.spec.mjs; your `math-*`
screenshots; and docs/handoff/Math.md.

The equation reader (src/equation.js):

- It parses and evaluates without eval or Function, like the chess and molecule readers. It supports
  numbers, the variables x, y, t, r and θ as each plotter needs, + − × ÷ ^, brackets, implicit
  multiplication where it's clear (2x, 3sin(x)), sin, cos, tan, asin, acos, atan, sinh, cosh, tanh,
  exp, log (natural), log10, sqrt, abs, floor, min, max, pi and e, and the parameters a and b.
- It caps input length (about 120 characters) because the text is saved in links.
- Bad input shows one plain, friendly message, and the toy keeps the last good curve.
- Non-finite values (division by zero, a log of a negative number) break the curve instead of
  drawing spikes.
- Give it thorough unit tests in tests/math.spec.mjs (Node-side), including hostile input.

The toys (the owner approved these, so follow them closely and note any change you must make):

1. `graph-plotter`, Graph plotter. Type y = …, r = … (polar) or x(t), y(t) (parametric), or pick one
   of about 40 famous curves: bell curve, cardioid, rose, butterfly, heart, Lissajous, spirals and
   more. Tap: a pen traces the curve across a lit grid, then the a slider sweeps and the curve bends
   in real time (y = a·sin(bx), say) before settling back (4.5 s). Sound: a tone that follows the
   curve's height as the pen draws it, so you hear the graph.
2. `surface-plotter`, Surface plotter. Type z = f(x, y), or pick a famous one: saddle, monkey
   saddle, sombrero, egg crate, Gaussian hill, Rosenbrock's banana valley and more. Tap: the surface
   rises out of a flat sheet, colored by height, then its parameter plays so it ripples, twists or
   breathes, and it settles (5 s). Sound: a low whoosh that rises with the surface.
3. `unit-circle`, Circle and waves. Tap: a point runs round the unit circle while its shadows unroll
   as a sine wave and a cosine wave on two walls, and Euler's formula e^(iθ) = cos θ + i sin θ
   lights up term by term (5 s). Sound: two pure tones a quarter turn apart, swelling and fading
   with the waves.
4. `fourier-circles`, Fourier circles. Tap: a chain of spinning circles, each riding on the last,
   draws a shape with its tip (a heart, a star or a wave); a "Circles" option sets how many, from a
   wobbly 3 to a crisp 60 (5 s). Sound: each circle hums its own frequency, building into a chord.
5. `pythagoras-proof`, Pythagoras proof. Tap: four copies of a right triangle slide and turn as
   solid pieces inside a big square, rearranging so the empty space changes from a² + b² into c²;
   then they slide back (4.5 s). Sound: wooden slides, and a click as each piece lands.

Typing: use the recipe `input` panel (PACKS.md, "Your own input": the molecule toy uses it) for the
plotters' equations, and keep the typed text in a hidden text option, so it's saved in links. A
select option lists the famous curves and surfaces. If something truly needs an engine change, see
the rule below.

The two fixes:

- Snail (src/packs/animals.js). The owner says it "looks weird while and after retracting". Today
  the hide is a toggle: the head shrinks into a lump beside the shell, and the foot's two halves
  slide together into a smooth sausage that stays lying under the shell. A real snail pulls its
  whole body, foot included, in through the shell's opening, eye stalks first (they roll inward),
  and the shell settles on the ground with nothing soft showing. Coming out, the foot slides out
  first, then the head, then the stalks unroll. Make it so, with the body moving as solid pieces
  hidden by the shell (the effect rules: no bending a soft region for a visible effect).
- American football (src/packs/balls.js). Its spiral ends half a turn round and snaps back, and its
  laces show through the ball while it's upside down (BACKLOG.md, docs/handoff/E6a.md). Round the
  spin to whole turns, like the E6a balls, and fix the laces' draw order (PACKS.md, draw order, rule
  9).
- Post clips of both fixes too (cards math-snail and math-american-football).

## State

Started September 27, 2026. Branch `claude/lane-math-typed`; PR "Phase Math: math you can type, and
two fixes" (draft).

- [ ] Equation reader (`src/equation.js`) and its unit tests
- [ ] Graph plotter
- [ ] Surface plotter
- [ ] Circle and waves
- [ ] Fourier circles
- [ ] Pythagoras proof
- [ ] Snail fix
- [ ] American football fix
- [ ] Clips posted on the Effect review page

## Notes

## Known issues

## For the Operator
