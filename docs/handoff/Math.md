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

Started September 27, 2026. Branch `claude/lane-math-typed`; draft PR #50, "Phase Math: math you can
type, and two fixes". Everything in the brief is built; clips go on the Effect review page (lane
`Math`, cards `math-*`).

- Equation reader: `src/equation.js` (no eval or Function; closures built from a small grammar).
  Unit tests in `tests/math.spec.mjs`, including hostile input and 4,000 random strings.
- Graph plotter (`graph-plotter`): 42 famous curves, or your own `y = …`, `r = …` (θ) or
  `x = …, y = …` (t) typed in the Toy tab. a is a live slider (it bends the curve), b an option for
  typed curves. Tap: 4.5 s.
- Surface plotter (`surface-plotter`): 16 famous surfaces, or your own `z = …` (x, y, r, θ). Tap: 5
  s.
- Circle and waves (`unit-circle`), Fourier circles (`fourier-circles`: heart, star, square wave; 3
  to 60 circles) and Pythagoras proof (`pythagoras-proof`). Taps: 5, 5 and 4.5 s.
- Snail fix and American football fix (below).

## Notes

- **Curves that bend in real time.** Splats can't be moved freely each frame, so the plotters build
  the curve (or surface) once at rest and once at each of nine values of a across the slider; copy j
  morphs exactly into copy j + 1 on channel 1, and the copy for the slider's place is shown (parts,
  so at most 15). The shape passes exactly through each knot and moves in straight lines between
  them. A cyclic parameter (a phase, as in Lissajous or the ripples) runs one way round.
- **Drawing behind a pen.** The rest copy uses `kind: "fade"` on channel 0 with `at = 1.002 − s` (s
  the arc fraction): the channel falls from 1 to 0 as the pen moves, so the ink appears exactly
  behind it, crisp (fade changes alpha, not size).
- **The tone that follows the curve** is `out.cues`: every 0.09 s while the pen draws, drive pushes
  a short gliding tone whose pitch maps the pen's height (two octaves). So the sound fits any typed
  curve with no engine change.
- **Typed text in links.** `normalizeScene` keeps only printable ASCII text options, so typed
  equations are stored in an ASCII form (`asciiEquation`: θ → theta, x² → x^2, · and × → \*, − → -).
  The panel shows that form.
- **Tiny splats vanish.** A heavily weighted thin ribbon (weight 9) got splats so small that the
  curve vanished below about 300 px. Fewer, bigger splats (weight 2 to 2.5, size 1.5) fixed it.
- **Moving far across a board.** Pieces that cross a lot of the board (the Pythagoras triangles, the
  Fourier rings turning) drew under it: sorted in their built pose. The triangles are tokens
  re-sorted six times per slide (`out.resort`); the Fourier board sits well behind the rings.
- **Snail.** Its body is 23 tokens: eight slices of the foot, the head, four pieces of neck, and
  each stalk in four pieces plus its eye. The stalks telescope into the head (tip first), the head
  and neck follow a path down the neck and back along the foot into the shell's opening, the front
  of the foot slides back and the tail forward, each piece vanishing once it is behind the shell,
  and the tokens are re-sorted every sixteenth of the way. A dark disc just inside the opening is
  the drawn-in body. Hide takes 3.2 s (was 2.4 s).
- **American football.** Built twice (PACKS.md 7b, rule 1): the second copy half a turn round its
  long axis, and whichever is within a quarter turn of its built pose shows. The cull flag (rule 9)
  did not suit it: it hides by the direction from the center, which cuts off the ends of a long
  ball. The spiral is six whole turns, so it lands laces up. Its inside hides while it spins.
  `density: 2`.

## Known issues

- The input panel always shows a file button (the engine adds it); the plotters' reads a text file's
  first line as an equation (`Open a text file…`).
- Between the nine knots a point moves in a straight line, so a traveling wave dips slightly in
  height mid-step (about 8% for the cyclic ones). It reads as smooth motion at phone size.
- A curve that runs off the board during the sweep slides along the board's edge until it comes
  back.
- Pythagoras proof: in this classic arrangement the triangles slide without turning (and one stays
  put), so "slide and turn" became "slide".
- Circle and waves: the "two walls" are two panels in the plane of the circle, beside and below it
  (the classic diagram), so the waves read face on.
- Fourier circles: the "wave" is a square wave, drawn out to the right from the tip's height.

## For the Operator

- PACKS.md lesson: a set of copies, each morphing exactly into the next, gives real-time bending
  through keyframes of any shape (the plotters); the `fade` kind on a channel draws a line crisply
  behind a moving pen.
- PACKS.md lesson: `out.cues` can make a sound that follows the effect (the plotter's pitch).
- PACKS.md lesson: a thin ribbon with a high weight gets splats too small to see below about 300 px.
- PACKS.md, draw order rule 9: the cull flag suits round bodies only; a long one (a football) loses
  its ends, so use two copies (rule 1).
- Engine idea (not needed now): `normalizeScene` drops non-ASCII text options, so typed text with θ
  or ² is kept in an ASCII form. An engine change could allow Unicode letters.
- No exceptions needed in `tests/taps.spec.mjs`.
