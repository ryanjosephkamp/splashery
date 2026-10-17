# Codex task 120: every control does what it says, measured in a browser (a Goal run, up to 8 hours)

**Where:** Codex's cloud. **Branch:** `codex/promise-audit`, cut from `main`. One draft PR against
`main` with the harness, its report, and its data. Screenshots and raw measurements go on
`codex/promise-audit-clips`, never merged. Read `AGENTS.md`, `builders/RULES.md`, `src/ui.js`,
`src/player.js` (`resolveOptions`), `src/state.js`, and `docs/SCENE-SCHEMA.md` first.

## Why

The owner set the labs Splats slider to 400,000 and Sound in a box showed 31,000: the slider's value
was multiplied by each recipe's density, so it never did what its label said. No test caught it,
because every test checked that the slider moved, not that the toy drew what it promised. The owner
asks how many other controls break their promise the same way. This task measures every one.

## The harness

`tools/promise-audit.mjs` drives the real app in Chromium (`node tools/cdx-mp2-server.mjs 4173`),
with labs off and on, at 1440×900 and 390×844. For every control and every option it records what it
promises and what it does.

1. **The controls:** every slider, select, switch, and button in the Toy, Share, Tools, Look, and
   Make tabs, the top bar, and the stage controls. Read each one's promise from its label, its note,
   its `title`, its `aria-label`, and the help text that names it.
2. **Every toy's own options:** the `options` list of each recipe (the kinds `resolveOptions` in
   `src/player.js` reads: number, select, switch, color, flag, and text) and each captured toy's
   looks (`lookOption` in `src/toys.js`). Test every option of every toy, labs ones included. Test
   the end points and one value in the middle for numbers, and every choice for selects.
3. **For each change, measure:**
   - the picture: the share of pixels that changed, after the stage settles;
   - the splat count drawn (`player.toyInfo.splats`), and the count the stage's label shows;
   - the tap: does the effect still play, and does the cue change when the option should change it;
   - the link and the saved scene: is the value in them, and does opening them give the same picture
     (pixel difference under 1%)?
4. **Numbers that promise a value** (a count, a size, a speed, a duration, a resolution, a frame
   count): compare the measured value with the label. A slider that says 400,000 and draws 31,000 is
   a failure; so is a "Size 1024" picture that saves 512 pixels wide.

## Classify every failure

- **P0, lies:** the control's promise is measurably false (a count, a size, or a length far from its
  label), or it breaks the toy (blank, error, or stuck).
- **P1, does nothing:** no measurable change in the picture, the count, the sound, or the file.
- **P2, lost:** it works, but a link or a saved scene doesn't keep it, or opening one gives a
  different picture.
- **P3, unclear:** it works, but its label or note doesn't say what it does, or says it in a way a
  person would misread.

A control that does nothing on purpose for some toys (Pop out on a toy with no pictures) is not a
failure if it's disabled or hidden there; if it shows and does nothing, it's P1.

## What to hand back

- `tools/promise-audit.mjs` and a `--toy`, `--control`, and `--quick` mode, so a lane can re-run one
  row after a fix.
- `docs/audits/promise-2026-10.md` (300 lines at most): a summary with counts by class, then every
  P0 and P1 with its steps, its numbers, a screenshot path on the clips branch, and the file and
  function you believe causes it (named only where you traced it; say "not traced" otherwise).
- `docs/audits/promise-2026-10.json`: every control and option tested, with its promise, its
  measurements, and its class (or "ok"), one object each, with a stable id.
- `tests/cdx-promise.spec.mjs`: a fast spec (under 3 minutes) that checks the ten most important
  promises that hold today (the Splats slider's count once #716 is on `main`, a GIF's size and frame
  count, a saved picture's size, Record's length, the turntable, and the like), so they stay true.

No fixes in this task: the Operator routes each failure to its owner. Don't touch other open PRs'
files. If a control is being changed by an open PR (the stage controls in lane REC1, the Splats
slider in lane SPL1, exports in lane EXP1), test `main` as it is and mark the row "in flight" with
the PR number.

## Rules

`node tools/preflight.mjs --quick`. No change to the site, any toy, or the engine. American English
and the serial comma. PR body: Summary, Verification, Deviations, Known issues, and What was cut.
Credit lines read "Codex (GPT-6)". Post a progress note on the PR at 4 hours.

**Done** means every control and every toy option measured at both sizes, labs off and on, or the
rows you didn't reach listed with the reason.
