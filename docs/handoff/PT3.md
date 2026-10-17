# Lane PT3: Shape morph and Your name in splats, to the bar

## Brief

(Written by the Operator on October 17, 2026; summarized.) Lane PT3 (prefix `pt3`), Opus 5.5 at high
effort, branch `claude/pt3`, one PR "Phase PT3: Shape morph and Your name in splats, to the bar".
Both toys are labs toys: the Operator merges after the full suite and the owner's marks.

- Study the two toys, the shared text module and the Toy Box in the owner's portfolio
  (`ref/portfolio/toybox/` on `origin/claude/portfolio-ref` at 5191138b) first, then say what falls
  short and the plan.
- Shape morph: a crisp, solid morph that flows from one form into the next; every form (the QR code
  too) in the toy's own palette, emoji used only for shape and brightness; a soft, musical tap sound
  in place of the robotic one; and that old sound banned for new toys (a note in docs/PACKS.md and a
  check that only the toys using it today keep it).
- Your name in splats: Toy Box's look and sound in the site's sound engine, no sound while orbiting,
  sharper letters, the Splats slider's count honored (up to 400,000), and Detail folded into Splats
  if Splats covers it, with old links opening the same.
- Tests in `tests/pt3.spec.mjs`; clips at 1080 px, 30 fps on Effect review page 2.

## Study: what fell short

- **Shape morph.** Its tap sound was the `pad` voice on one note gliding down: two detuned triangle
  waves, the robotic hum. Emoji kept their own colors and the QR code was near-black on cream. The
  morph paired splat i of one form with splat i of the next, and those indices are scattered
  (golden-ratio and R2 sequences), so mid-flight the cloud was a dust of crossing splats. At rest it
  had only 7,200 to 24,000 splats; the word's splats spilled past the letters' edges, the Lorenz
  path stacked splats on the same steps (dashes) once the count rose, and the gyroid and the Klein
  bottle showed their discs as scales.
- **Your name in splats.** A square-wave tick fired every quarter radian the view turned: the clicks
  while orbiting. Its bar was the site's modal `bar` voice, very quiet (peak 0.03), not Toy Box's
  clean sine with a short ring two octaves up. Its letters spilled past their outline (a soft,
  ragged edge) and the faces showed the sampling lattice. Its count came from five fixed tiers, so
  the Splats slider at 400,000 still built 96,000.
- **The Toy Box** (the reference): sounds are short WebAudio sines and filtered noise (bar, pop,
  squelch, clatter, zip, a held wind, and a tick while spinning); letters are flat discs from R2
  sequences, rim splats taking the largest share, each part sized to its own spacing; counts 12,000
  to 192,000, picked by the device and kept out of links.

## What changed

- `src/text-splats.js`: crisp faces (on by default; `crisp: false` keeps the old sizing). Each
  glyph's raster gets a distance field to its outline; a face splat's sigma is half its distance to
  the outline (down to 0.35 of the face's middle sigma), and splats are kept in proportion to the
  density that size needs (an extra even axis decides), so the edge closes. Face and rim splats
  overlap more (sigma 1.35 of the spacing), so the even lattice no longer shows.
- `src/packs/shape-morph.js`:
  - Every form in the toy's ink (`inkAt`, `shade`, `colorAt`): an emoji's luminance shades the ink
    at its place; the QR code's dark modules are a deep shade and its light ones a pale shade
    (contrast over 4.5 everywhere; it scans in the browser test). Two-ink keeps its two inks.
  - A morph pairs the old cloud and the new form by rank along a 3D Hilbert curve through each one's
    own box (`pairForm`), so neighbors land near neighbors.
  - Density 0.5 (30,000 to 140,000 by device; the Splats slider's count up to 400,000 once lane
    SPL1's engine is in, half of it before). The Lorenz path is sampled between its steps; the
    gyroid and the Klein bottle overlap more; QR modules shrink their splats at sides that meet the
    other shade, so modules read as clean squares.
- `src/packs/name-toy.js`:
  - No sound while the view turns (it still counts as a touch, so the idle sway waits).
  - Toy Box's voices in the site's engine (`SOUNDS`): the bar (a sine on the letter's note, 0.55 s,
    and a sine two octaves up, 0.1 s), the pop for a tool or color, a short bright squelch for
    paint, Toy Box's triangle clatter ticks as pieces land, its zip (as three quick steps up and a
    C6, since the site's sounds never glide up), and a 650 Hz wind for Blow.
  - The count: the Splats slider's when set (up to 400,000); else a link's Detail; else Toy Box's
    tier for the device. Detail is hidden (kept for older links).
- `src/toy-sounds.js`: the two toys' specs. docs/PACKS.md: "Banned sounds" (the lone `pad`).
- `tests/pt3.spec.mjs`; `tests/pt1.spec.mjs` now expects silence while the view turns.

## State

- READY (October 17, 2026), PR #717. Clips on Effect review page 2, lane PT3: `pt3-shape-morph` and
  `pt3-name-toy` (1080 px, 30 fps, with sound). Preflight passed; `tests/pt3.spec.mjs` (10 tests)
  passes, and so do `pt1`, `pt1-engine`, `cdx-pfc` and `cdx-pfd` after their expectations moved to
  the new behavior. `docs/evidence/shape-morph.json` follows the new palette, pairing and line
  numbers.

## Decisions and open questions

- Detail folds into Splats, but the slider starts at 60,000, so picking 12,000, 24,000 or 48,000 by
  hand is no longer in the UI (Auto still picks them on weaker devices, and old links keep them). If
  lane SPL1 lowers the slider's minimum, nothing is lost.
- A link's Detail gives way to the person's own Splats setting (a device choice, as in Toy Box,
  where a link never sets the count).
