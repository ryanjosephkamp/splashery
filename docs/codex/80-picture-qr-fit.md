# Codex task 80: Picture QR fits your picture (crop, a thinner border, round corner eyes)

**Branch:** `codex/picture-qr-fit`, cut from `main`. One draft PR against `main`. Screenshots go on
`codex/picture-qr-fit-clips`, never merged. Read `AGENTS.md`, `builders/RULES.md`, CLAUDE.md,
`src/qr/circle.js`, `src/qr-craft/picture.js`, `src/packs/qr-craft.js`, `src/qr/build.js`, and
`tests/cdx-circle-qr.spec.mjs`. If task 79 has a PR open, keep your changes apart from its files
where you can, and say where they meet.

## Why

The owner's notes, on the circular codes:

- A picture of your own is cropped to a fixed center square, so the subject is often cut off, and in
  Circle mode the picture doesn't fill the whole circle the way it should.
- The white square around the code in Circle mode is thick (a fixed four-module quiet zone,
  `CIRCLE_QUIET` in `src/qr/circle.js`). Commercial circular codes that scan well show no white
  square at all: the decoration runs right up to the code.
- He'd like round corner eyes (the three finder squares drawn as circles) as an option.

## What to build

1. **Fit your picture:** after a picture of your own is chosen, a simple crop step: drag to move,
   pinch or a slider to zoom, and a choice between fitting the square code and filling the whole
   circle. In Circle mode with "fill the circle", the picture covers the ring outside the code as
   well, so the whole disc shows the picture. The crop is saved with the toy's settings (in the
   scene and share link, without the picture's pixels, which never leave the device). It works with
   touch at 390×844 and with a mouse and keyboard.
2. **A thinner border in Circle mode:** make the quiet zone a setting (for example Wide = 4 modules,
   Medium = 2, Thin = 1, None = the decoration meets the separator). Measure each setting with the
   same trials that set today's four modules (jsQR, zxing-js, and zxing-cpp; phone and small sizes;
   blur; perspective) across the payloads and pictures of the scan study, and report the pass rate
   per setting and reader. Offer a setting only if it passes every trial; keep the safest passing
   setting as the default. If none thinner than four passes, change the decoration next to the code
   (for example a lighter or sparser band one module wide) until one does, and say what you changed.
3. **Round corner eyes:** an "Eyes" option (Square, Rounded, Circle) for the QR code and Picture QR
   toys. A circular finder keeps the 1:1:3:1:1 light-and-dark pattern along every line through its
   center, which is what readers look for, but some readers may still miss it: run the same trials,
   and offer a shape only where every reader passes at phone size.

## Rules

- Every code the toy shows still passes its built-in scan check before it appears. Never lower a
  threshold or skip a test; never edit `tests/taps.spec.mjs`.
- Old `#s=` links and saved scenes keep loading and look exactly as before (the defaults stay as
  they are today).
- These are toys the public sees: the owner marks them good from 390×844 screenshots of each new
  option (Square and Circle, each border setting, each eye shape, before and after a crop) before
  the merge.
- American English and the serial comma in every new label.

## Report

`docs/audits/picture-qr-fit-2026-10.md` with the trial tables, and a PR body with Summary,
Verification, Deviations, Known issues, and What was cut.

Before you push: `npx prettier --check .` and `node tools/us-english.mjs --diff` are clean, and the
QR specs (`qr*`, `qrc-*`, `cdx-circle-qr`, `cdx-qr-*`, `kit`, `smoke`, `help`, `hta`) pass.
