# Toy Box

A concept portfolio for Ryan Kamp as a digital media researcher, with
[Splashery](https://ryanjosephkamp.github.io/splashery/) as the centerpiece. One page, static files,
no build step, no dependencies.

**The signature:** Ryan's name is a toy made of Gaussian splats. Spin it, poke it, paint it, drop it
and blow on it (Splashery's own verbs), hear a note for each letter, and copy a link that holds the
whole scene.

## Run it

```bash
python3 -m http.server 4176 --bind 127.0.0.1   # from the repo root
# open http://127.0.0.1:4176/concepts/toybox/
```

## Files

| File | What it holds |
|---|---|
| `index.html` | All of the content. It reads without JavaScript. |
| `styles.css` | Tokens at the top (`:root`), then one block per section. |
| `main.js` | The sound voices, the five toy recipes, the splat renderer and its tools, and the small pieces lower on the page. |
| `scene.js` | The parts with a right answer: the link format, one splat's opacity and covariance. |
| `tools/verify.mjs` | The checks for `scene.js`. |
| `assets/fonts/` | [Fredoka](https://fonts.google.com/specimen/Fredoka) variable font, latin subset (SIL Open Font License). |

The hero is this page's own small renderer (WebGL2: flat Gaussian discs, counting-sorted back to
front each frame, simulated on the CPU). It is not Splashery's engine, which is PlayCanvas.

## How many splats

The toy is built from one of five counts: 12,000, 24,000, 48,000, 96,000 or 192,000.

- A desktop starts at 96,000. A phone, or a machine with four cores or fewer, starts at 48,000. A
  device that reports 2 GB of memory or two cores starts at 24,000.
- **Fewer** and **More**, on the Contents label, step the count by hand. That choice is kept in
  this browser (`localStorage`, key `toybox:detail`) and is never part of a link, so a link cannot
  weigh down the phone that opens it. Paint is placed by position, so it survives a change of count
  and a link painted at one count opens correctly at another.
- A count nobody picked steps down by itself when frames average over 38 ms (under about 26 a
  second) for a couple of seconds.

Splats are placed with low-discrepancy sequences (R2 on the letters, the donut and the knot, a
Fibonacci lattice on the planet) instead of random numbers, which left clumps and holes that read
as grain. The letters' rims have several times the area of a face, so they take the largest share,
and each part's splats are sized to its own spacing.

Measured on one laptop (Apple M3 Pro), in the browser pane, as the time for one whole frame (the
sums, the upload, the draw and a pixel read back). A frame has 16.7 ms at 60 a second.

| Splats | Width | At rest | Mid-drop |
|---|---|---|---|
| 48,000 | 375 px (phone) | 3.2 ms | 4.4 ms |
| 96,000 | 375 px (phone) | 5.5 ms | 8.3 ms |
| 96,000 | 1,024 px | 6.1 ms | 8.2 ms |
| 192,000 | 1,024 px | 8.7 ms | 11.8 ms |

No real phone was timed; the step-down above is the guard for one that is slower.

## The checks

```bash
node concepts/toybox/tools/verify.mjs
```

- Every header a link can carry (5 toys x dropped or not x 256 turns x 256 tilts = 655,360) encodes
  and decodes to itself; so does every value of every byte of a paint dab, and scenes of 0 to 180 dabs.
- A splat cut off at 3 sigma keeps 1 - e^-4.5 = 98.889% of its paint; summing 16,777,216 samples of
  the function the page draws with gives the same figure.
- The covariance readout under "One splat, up close" has the right trace and determinant at all
  1,187,541 positions of its three sliders.

`window.__toybox` is for checking the toy where a browser will not run animation frames (a hidden
tab, a headless run): `advance(seconds)` steps its clock by hand, `bench(frames)` times whole
frames, `setTier(i)` picks a count, and `frame(gap)` runs one real frame after a gap of that many
seconds, which is how the automatic step-down was seen working.

## Voice

Facts trace to `docs/FACTS.md`, the project READMEs and the live pages. Invented voice: the toy
packaging lines ("Take it home", "Peel one off", "The serious sticker", "no batteries", "Unwrap it
here", "Wash it off", "And at the back of the shelf"), the line about Fredoka's strokes, and the
section ledes. The art on aqrobat's card is a picture of a QR code's corner drawn with letters, not
a code that scans. The paragraph under Research about splats as a material is a stated interest,
not a result.
