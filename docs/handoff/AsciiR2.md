# ASCII r2 (`AsciiR2`, prefix `asc2`)

Model: Sonnet 5.5, at the default effort.

## Brief

You are a Splashery worker session, started by the Operator (the coordinating session) for the
October push. Repo: ryanjosephkamp/splashery. Your lane: ASCII r2 (id `AsciiR2`, prefix `asc2`).
Branch: `claude/lane-ascii-r2` (and `claude/lane-ascii-r2-engine` for any change to the app outside
your own files, as an "Engine: …" PR merged first). PR title: "Phase ASCII r2: ASCII GIFs for more
toys". Handoff file: docs/handoff/AsciiR2.md (create it; start it with this brief, word for word,
under "## Brief", then keep "## State

- October 7, 2026 (Sonnet 5.5): items 1 to 4 done. Draft PR #377 (`claude/lane-ascii-r2`).
  1. **The list:** `src/ascii-capture/toys.json`, 85 kit toys in six shelves (food, balls, shapes,
     gems, toys, instruments). Each has a shelf and a default `columns`; `camera` is an optional
     override (none needed: every toy's own home camera framed it).
  2. **The check:** `tools/asc2-check.mjs`. 71 of 85 pass; the 14 that don't are listed with their
     reasons in `docs/audits/ascii-capture-2026-10/asc2-scores.json` and in each toy's `check.why`.
     Six plain balls (edge contrast 0.016 to 0.019), the hockey puck, ruby, emerald, origami crane,
     chess set and the four keyboard instruments (a key press changes almost no characters).
  3. **The lab:** the picker lists "First three" (as they were), then each shelf's passing toys.
     Credit: a kit toy's footer is "<name>: Splashery, MIT" (as the lab shows kit toys now).
  4. **Evidence:** `sheet-<shelf>.png` in the audit folder (1.2 MB in all); six cards (`asc2-food`
     ... `asc2-music`, lane record `AsciiR2`) on Effect review page 2.
- Checks run: `tests/asc2.spec.mjs`, `asc-unit`, `asc-core` and `asc-engine` pass; `asc.spec` (5)
  and `asc-repeat` (1, 6.4 minutes) pass too. Prettier and the US English check are clean. The full
  suite was not run here.

## Notes

- The list holds kit toys only. The first three presets are untouched (`ORIGINAL` in `protocol.js`);
  every listed toy is also a preset the capture page accepts, so the check can run candidates. The
  lab lists only toys whose `check.pass` is true; `ascii-lab.html?all=1` lists every candidate.
- The check scores the GIF a person would get (96 columns, mono, `?profile=high`): fill (inked
  character cells in the first frame, and how far the subject spans the grid), edge (mean step in
  brightness between neighboring cells where one carries ink) and motion (share of cells that change
  from frame to frame after the tap). Limits are in `LIMITS`, set from the three approved presets.
  Re-run: `node tools/asc2-check.mjs --apply` (add `--reuse --gifs=<dir>` to rescore saved GIFs).
- A bug found on the way: many toys showed an empty first frame (their splats had not sorted yet).
  `host.js` now retakes frame 0, with no time passing, up to four times until something shows. The
  first three are unaffected (their first frame is lit, so the retake never runs).
- One edit outside my files: `tests/asc-unit.spec.mjs` used "pizza" as its example of an unknown
  toy; pizza is now a listed toy, so the two lines say "no-such-toy". Nothing else changed there.
- Frame count is the same 40 frames (four seconds) for every toy; the brief's per-toy frame count
  would need protocol and GIF-check changes and nothing in the check asked for it.
- The check ran on SwiftShader (CPU), three or four jobs at once. Donut and harpsichord timed out
  once under that load and passed or failed on their score when run with fewer at a time.

## Known issues

- The six plain balls fail only narrowly on edge contrast: their ASCII reads as a flat disc. The
  keyboards fail on motion; a better "played" effect would be a toy change, not mine.
- The sheets draw each cell as a gray square, not the characters.

## For the Operator

- Labs only. `tests/asc-unit.spec.mjs` has the one-word change above.
- Screenshots: `tests/screenshots/asc2-lab-390x844.png` and `…-1440x900.png` (the lab with Pizza
  chosen). Run `node tools/upkeep.mjs --restore-shots` after the full run.
- Phone check suggestion: open `ascii-lab.html`, pick a toy from the grouped list and capture.
