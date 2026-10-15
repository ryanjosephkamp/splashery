# Codex task 79: Picture QR at its sharpest (a long Goal run)

**Branch:** `codex/picture-qr-fidelity`, cut from `main`. One draft PR against `main`. Review
pictures and clips go on `codex/picture-qr-fidelity-clips`, never merged. Read `AGENTS.md`,
`builders/RULES.md`, CLAUDE.md, `src/qr-craft/picture.js` (its header explains the halftone method),
`src/packs/qr-craft.js`, `src/qr/circle.js`, `src/qr/scan.js`, and `tools/qrs-study/readers.mjs`.

## Why

Picture QR turns a picture into a QR code that still scans. Today each module keeps a fixed block of
forced cells at its center (the "Center dot" setting), the rest is error-diffused, and the result is
decode-checked with jsQR at phone size before it is shown. The owner wants to find out how much of
the picture can survive: the sharpest, clearest, most faithful picture a code can carry while every
code still scans.

## Goal (for Goal mode: keep going until all hold, up to 12 hours)

On a fixed test set (the six theme packs from task 58 if merged, the current Picture QR samples, and
twenty CC0 photos of your choice: faces are not allowed, so use animals, food, landscapes, objects,
art, and high-contrast graphics), with the payloads in the scan study's ten-link set, in Square and
Circle:

1. **Clearer picture, measured:** add a fidelity measure between the source picture and the code as
   a person sees it (for example SSIM, or a perceptual distance, after a blur that matches viewing
   at phone size and at print size). Raise it clearly over `main` on every picture, and report the
   per-picture before and after.
2. **Every code still scans, with margin:** each final code decodes with at least two independent
   readers (jsQR and zxing-cpp through `tools/qrs-study/readers.mjs`) at phone size (8 px per
   module), small size (4 px per module), with the blur levels the toy already checks, and with mild
   perspective (10°) and brightness changes. No code that scans on `main` stops scanning.
3. **Try the known ideas, keep what wins:** for example a smaller or adaptive center (more picture
   where the module is already the right color), color halftone, larger code versions, error
   correction used deliberately (the free bits in a short payload can be chosen to match the
   picture, as in QArt-style codes), better error diffusion, and module shapes. Write down each idea
   you tried, its numbers, and why you kept or dropped it.
4. **Same speed or better:** a code still appears within the time it takes on `main` on the phone
   profile (report both), and the toy's existing scan check still runs before a code is shown.
5. **The owner chooses:** keep today's look as the default unless the new one is better on every
   measure. A new top setting (for example "Most detail") is fine. Before-and-after pairs at 390×844
   for every test picture go on the clips branch.

## Rules

- Stay inside the QR toys' files (`src/qr-craft/`, `src/packs/qr-craft.js`, `src/qr/`), their tests,
  and `tools/`. Engine changes go in a small additive "Engine: …" commit with a test.
- Never lower a scan threshold, skip a check, or edit `tests/taps.spec.mjs`. Old `#s=` links and
  saved scenes that hold a Picture QR keep loading and look the same unless the owner picks the new
  default.
- No new library unless its license is MIT, Apache-2.0, or BSD and it loads only when the toy opens;
  name it in `LICENSES.md`.
- Test pictures: CC0 or public domain, checked on their source page, recorded in `CREDITS.md` and
  `tools/assets.json`. No people, logos, or text.

## Report

`docs/audits/picture-qr-fidelity-2026-10.md`: the measure, the test set, every idea and its numbers,
the scan results per reader and condition, the speed, and what you recommend as the default. PR body
with Summary, Verification, Deviations, Known issues, and What was cut.

Before you push: `npx prettier --check .` and `node tools/us-english.mjs --diff` are clean, and the
QR specs (`qr*`, `qrc-*`, `cdx-circle-qr`, `cdx-qr-*`, `kit`, `smoke`) pass.
