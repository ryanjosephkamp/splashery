# Codex task 85: Measure four memory and lifetime questions before calling them bugs

**Branch:** `codex/lifecycle-measurements`, cut from `main`. One draft PR against `main`. Read
`AGENTS.md`, `builders/RULES.md`, and CLAUDE.md.

## Why

A static review of the code raised four possible leaks or lifetime problems. Reading the code alone
can't settle them; each needs a measurement. Measure first, and fix only what the numbers show.

## The four questions

1. **Clay and paint.** In a live session the clay edits and paint stamps are appended to arrays, and
   `normalizeClay()` and `normalizeStamps()` in `src/state.js` cap what is saved at 2,000 and 4,000
   (`exportScene` normalizes). Measure: memory and frame time during sustained use well past the
   caps; whether a reset or a change of toy or source releases them; and whether saving and
   reopening a scene near and past the caps keeps exactly what the caps promise (say what is
   dropped, and whether the person is told).
2. **The video scrub bar.** `tick()` in `src/ui.js` (about lines 1135 to 1146) re-arms
   `requestAnimationFrame` until its control leaves the page. Measure: after opening and closing
   videos 20 times, how many `tick` loops are still running (count them with a temporary counter or
   the DevTools protocol), and the heap before and after.
3. **The 250 ms timers.** Find every `setInterval` or repeating `setTimeout` at 250 ms in `src/`
   (one is in `src/packs/sound-lab.js`; the song and game controls may have others). For each, check
   whether rebuilding the toy or switching toys 20 times leaves more than one running, and whether
   it pauses when the page is hidden.
4. **The generator sliders.** Their range inputs have no `value` in the HTML and get one from
   JavaScript. Check the first paint at phone size, throttled, for a visible jump or a wrong value.

## What to deliver

- `tools/lifecycle-probe.mjs` (Playwright and the DevTools protocol) that reproduces each
  measurement, and `docs/audits/lifecycle-2026-10.md` with the method, the numbers (three runs
  each), and a verdict per question: **defect** (with a reproduction) or **not a defect** (with the
  numbers that show it).
- For each defect only: the smallest fix, in its own commit, with a regression test in
  `tests/cdx-life.spec.mjs` that fails before the fix and passes after. A fix inside the engine
  (`src/` outside a pack) goes in a commit titled "Engine: …" so the Operator can merge it first.

## Rules

Don't change how any toy looks or plays. American English and the serial comma. Before you push:
`npx prettier --check .` and `node tools/us-english.mjs --diff` are clean, and your tests pass. The
test suite on GitHub Actions runs the quick checks on your PR; the full suite runs on the Operator's
merge PR (or on yours when the Operator adds the `full-suite` label) and posts its result as a
comment. PR body with Summary, Verification, Deviations, Known issues, and What was cut.
