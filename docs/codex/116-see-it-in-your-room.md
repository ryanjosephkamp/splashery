# Codex task 116: See it in your room, a toy on your table in AR (a spike, up to 6 hours)

**Where:** Codex's cloud. **Branch:** `codex/see-it-in-your-room`, cut from `main`. One draft PR
against `main`. Test files and recordings go on `codex/see-it-in-your-room-clips`, never merged.
Read `AGENTS.md`, `builders/RULES.md`, `src/kit.js`, and `vendor/` (PlayCanvas 2.22.3's WebXR
support) first. This task needs the web for the specs it reads.

## Why

A toy is more fun on your own table. Android phones can show WebXR augmented reality in Chrome.
iPhones can't (Safari has no WebXR AR), but they open a USDZ file in AR Quick Look from a plain
link. Splats don't go into USDZ, so the iPhone route needs a mesh: the kit's shapes are meshes
already, and task 106 (PR #702) turns splats into meshes. This spike finds out how far each route
goes and builds the first one.

## The work

1. **Android:** a labs "See it in your room" button (`labs: true`) that starts a WebXR
   `immersive-ar` session with hit testing, places the current toy on a surface at its real size (or
   a size the person picks), and keeps its tap effect and sound working there. It shows only where
   the browser supports it.
2. **iPhone:** a labs "Open in AR" link for kit toys that writes a USDZ in the browser from the
   toy's kit shapes, with their colors, and opens it with `rel="ar"`:
   - write the USDZ with your own small writer (USDA text in an uncompressed zip with the 64-byte
     alignment USDZ needs), or vendor an open writer under Apache-2.0, MIT, or BSD, listed in
     `LICENSES.md` and loaded only when the link is tapped;
   - include the tap effect as a looping transform animation where the toy's parts move as solid
     pieces, and say which toys can't;
   - validate every file you make with Pixar's `usdchecker` (OpenUSD, a build tool) in the cloud.
3. **Which toys work:** run both routes over every kit toy and report which export cleanly, which
   lose something (and what), and the file size of each USDZ.
4. **The owner's check:** three USDZ files (a ball, a food toy, and an instrument) on the clips
   branch, with step-by-step instructions for opening them on his iPhone from the PR.

## Gates

- Every USDZ you make passes `usdchecker` with no errors, and is under 5 MB.
- Nothing new loads until a person taps the button or the link. Old links and saved scenes open
  exactly as before.
- Tests in `tests/cdx-ar*.spec.mjs`: the USDZ writer on three toys (parse it back and compare the
  shapes and colors), and the buttons hidden where the browser can't use them.
- `node tools/preflight.mjs`. Screenshots at 390×844 and 1440×900 as `cdx-ar-*.png`.

## Stay out of the way of open work

- New code in `src/ar/` and `tools/ar-*.mjs`. The stage controls and the Share tab are being changed
  by other lanes right now, so put the button in the Tools tab in its own block, or add one small,
  additive "Engine: …" hook commit with its own test, and name it in the PR.
- Don't edit `src/kit.js`, `src/player.js`, `src/app.js`, `src/stage.js`, `src/exports.js`, or any
  existing pack.

## Rules

American English and the serial comma. PR body: Summary, Verification, Deviations, Known issues, and
What was cut. Credit lines read "Codex (GPT-6)".

**Done** means the routes that work merged behind labs, with the per-toy report in
`docs/audits/ar-2026-10.md` (300 lines at most), or a clean negative result naming the top three
blockers you actually hit.
