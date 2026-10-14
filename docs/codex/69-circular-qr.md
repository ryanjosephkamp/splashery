# Codex task 69: circular QR codes, and two QR fixes

**Branch:** `codex/circular-qr`, cut from `main`. One draft PR against `main`.

Read `AGENTS.md`, `builders/RULES.md`, `src/packs/qr.js`, `src/packs/qr-lab.js`,
`src/packs/qr-craft.js`, `src/qr-craft/`, the QR tests (`tests/qr*.spec.mjs`), and CLAUDE.md's
"Effect quality rules". All the QR toys are behind the labs switch.

## Why

The owner wants the round QR codes seen on stickers: a normal square QR code inside a circle, with
extra decorative dots filling the circle around it. The dots outside the square carry no data; a
reader only needs the code itself and a clear margin around it.

## Part 1: a Circle shape option

1. **The rule.** Draw the real code exactly as now. Around it, leave a clear ring of light modules
   (the quiet zone). Fill the rest of the circle with decorative dots in the code's own module grid
   and style, at a density that looks like the code continues, plus a solid circular border. The
   decoration must never form anything a reader could take for a finder pattern (no 7×7
   square-in-square shapes, no 1:1:3:1:1 runs in line with the real finders), and it keeps the same
   dark-to-light balance as the code.
2. **Measure the margin.** The standard asks for a 4-module quiet zone; round designs often use
   less. Test quiet zones of 1, 2, 3, and 4 modules with the vendored jsQR and a second open-source
   decoder used only in tests (ZXing's JavaScript port, Apache-2.0, as a pinned devDependency listed
   in `LICENSES.md`). Test each with 20 different links, at every error-correction level, at phone
   and print size, and with mild blur and perspective. Pick the smallest margin that scans in 100%
   of trials with both decoders; default to that, never less than 2. Report the table, and say
   plainly that phone camera apps weren't tested in the cloud.
3. **Where it appears:**
   - **QR code** (`qr-code`): a Shape setting, Square or Circle, with the export (PNG, GIF, recipe)
     keeping the shape.
   - **Picture QR** (`qr-picture`): the same option; the picture fills the circle, decoration
     included.
   - **How a QR code works** (`qr-anatomy`): a small Circle view that colors the decoration
     differently and labels it "decoration: carries no data", next to the quiet zone.
   - **QR damage lab** (`qr-damage`): the Circle option, so you can see that damage to the
     decoration never matters and damage to the code does.
   - **QR from real things** (`qr-build`): the Circle option where it fits the build; if a build
     can't make a circle (dominoes on a grid), say so in the report and skip it.
4. **Splats first:** the decoration dots are splats like the code's own modules; the border is a
   crisp ring at phone size.

## Part 2: two fixes the owner asked for

1. **How a QR code works is too grainy.** Make the modules and labels crisp at 390×844 (sharper
   edges, the right splat size and density for the module size, no speckle), and turn the pop-out
   effect on by default.
2. **Three QR codes in one** still shows static horizontal white lines across the red, green, and
   blue squares. Find the cause (likely a seam between module rows, a sampling or blending artifact,
   or a texture edge) and fix it at the cause. Show before-and-after stills at phone and desktop
   size.

## Tests and proof

`tests/cdx-circle-qr.spec.mjs`: every toy with the option renders a circle that scans with both
decoders, and the decoration never changes the decoded text. Plus `qr*`, `taps`, `help`, `unit`, and
`smoke` (never edit `tests/taps.spec.mjs`). Render a phone-size clip of each changed toy
(`tools/effect-clip.mjs`) on `codex/circular-qr-clips` (never merged) and link them in the PR body.

## Don't touch

The files of the open PRs (#560, #562, #566, #581, and #582; #582 adds Picture QR backgrounds in
`src/qr-craft/samples.js`: don't edit that file), the engine, and `vendor/`.

## Report

`docs/audits/circular-qr-2026-10.md`: the margin table, the decoders, what was tested, and the cause
of the white lines. Before you push: `npx prettier --check .` and `node tools/us-english.mjs --diff`
are clean.
