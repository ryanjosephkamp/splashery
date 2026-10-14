# Codex task 78: four splat toys from the owner's portfolio concepts, in four parallel parts (a to d)

**Branches:** one per part, cut from `main`: `codex/portfolio-a` … `codex/portfolio-d`. One draft PR
per part against `main`, titled "Codex task 78<letter>: …". Review clips go on
`codex/portfolio-<letter>-clips`, never merged. Read `AGENTS.md`, `builders/RULES.md`,
`docs/PACKS.md`, and CLAUDE.md's "Effect quality rules".

## Why

The owner built four concept pages for his portfolio that already draw real Gaussian splats with
their own small WebGL2 renderers. He wants each one as a Splashery toy (his yes of October 14,
2026). Most of the math is written; the work is porting it onto Splashery's engine.

## The reference code

Fetch the branch `claude/portfolio-ref` (`git fetch origin claude/portfolio-ref`) and read
`ref/portfolio/<concept>/` from it. It is the owner's own code, copied read-only. **Never merge that
branch or copy its files, fonts, or renderers into the site.** Port the ideas and the math into a
Splashery pack: splats through the engine (`src/kit.js`, `src/stage.js`, PlayCanvas via
`src/pc.js`), the shared lists, and the usual tests. Credit each toy's About text with "From a
concept by Ryan Kamp."

## The parts

Each part adds one toy behind the labs switch (`labs: true` in `src/toys.js`), its own pack file,
its own entries in the shared lists (`src/toy-sounds.js`, `src/toy-help.js`, `tools/toy-plan.json`,
`src/site-toy-pages.js` where the others are), and its own test file
`tests/cdx-pf<letter>.spec.mjs`.

**a. One splat, many splats** (`ref/portfolio/one-splat/`, math shelf, pack
`src/packs/one-splat.js`). A word (default "Splashery", or your own) or a picture becomes a tree of
Gaussians, each the exact mean and covariance of the pixels beneath it (port `fit.js`). A dial picks
the level from 1 splat to 16,384 by powers of two. Tapping a splat splits it into its two children
with visible motion. Tapping and holding shows its numbers (center, size, angle). Port
`verify.mjs`'s checks (each split conserves mass, mean, and covariance) into the test file.

**b. Neuron** (`ref/portfolio/specimen/`, Tiny world or science shelf, pack `src/packs/neuron.js`).
The neuron grown procedurally as about 32,000 splats (port `specimen.js`; fewer on the phone
profile). A switch for the three stains. Tapping fires a spike that travels down the axon as a
visible wave (the Hodgkin-Huxley model from the concept). A focus slider merges pairs of splats,
keeping mass, center, and covariance. Clinical and textbook-like, as for anatomy.

**c. Shape morph** (`ref/portfolio/overprint/`, labs, pack `src/packs/shape-morph.js`). A splat
cloud that re-forms between a word, the Lorenz attractor, a Klein bottle, a gyroid, a loop, and a QR
code: each splat flies to its place in the next form. Reuse `src/packs/splat-equation.js` forms
where they match. The QR form uses the vendored QR generator, loaded only when that form is picked.
An optional two-ink print look. Dragging pushes the splats, and they settle back.

**d. Your name in splats** (`ref/portfolio/toybox/`, Pictures and Pages shelf, pack
`src/packs/name-toy.js`). Type a name; it becomes a splat toy. The five verbs (spin, poke, paint,
drop, and blow) move the letters as solid pieces, each letter plays its own note, and the name saves
in the scene's `#s=` link. Detail steps like the concept's (fewer splats on a phone). Look first at
the "Your words" choice in `src/packs/maths.js` and reuse what fits; don't duplicate it.

## Done means

1. The toy opens with `?labs=1` on the phone profile (390×844) and on desktop, at a steady frame
   rate, and its effect reads at a glance at phone size.
2. `node tools/check-packs.mjs <pack>` passes, and the toy's spec file passes, plus `smoke`, `taps`,
   `kit`, `unit`, and the embed transfer test (≤ 30 MB).
3. Screenshots `tests/screenshots/cdx-pf<letter>-<name>-390x844.png` and `…-1440x900.png`; a
   thumbnail from `tools/make-thumbs.mjs`.
4. A clip of the effect from `tools/effect-clip.mjs` on the clips branch, linked in the PR.
5. Old `#s=` links and saved scenes still load. No engine changes, unless they are in a small
   additive "Engine: …" commit with its own test.

Before you push: `npx prettier --check .` and `node tools/us-english.mjs --diff` are clean. The PR
body has the five sections: Summary, Verification, Deviations, Known issues, and What was cut.
