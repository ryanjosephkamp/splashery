# Codex task 121: silent caps, hidden multipliers, and ignored settings, traced in the code (up to 8 hours)

**Where:** Codex's cloud. **Branch:** `codex/silent-caps-audit`, cut from `main`. One draft PR
against `main` with the report and its data; proof tests go on `codex/silent-caps-audit-clips`. Read
`AGENTS.md`, `builders/RULES.md`, `docs/PACKS.md`, and `docs/SCENE-SCHEMA.md` first.

## Why

The labs Splats slider promised a count, and `splatBudget()` in `src/player.js` quietly multiplied
it by each recipe's density, so the count drawn was far below it. The value went from the person to
the toy through a step that changed its meaning, and nothing said so. Task 120 measures every
control from the outside, in a browser. This task reads the code from the inside and finds every
place where a value a person chose is changed, capped, or dropped on its way to where it's used.

## What to look for

Trace every value a person can set (the controls in `index.html` and `src/ui.js`, URL parameters,
scene fields, toy options, and files a person opens) from where it's read to where it's used. Flag:

1. **Hidden multipliers and offsets:** the value is scaled by something the label doesn't mention (a
   density, a tier, a device pixel ratio, a quality factor).
2. **Silent caps and floors:** `Math.min`, `Math.max`, `clamp`, a tier's `maxCount`, a texture
   limit, or an early return that holds a value below what the person chose, with no message.
3. **Ignored settings:** an option declared in a recipe's `options` that its build or motion never
   reads; a URL parameter parsed and never used; a scene field written and never read back, or read
   back and never applied.
4. **Two sources of truth:** the same setting kept in two places that can disagree (the UI's value
   and the player's, a default in the HTML and another in the code).
5. **Swallowed failures:** `catch {}` or a `.catch(() => {})` that hides an error a person would
   notice as "it just did nothing", and promise chains whose result is never awaited.
6. **Stale-state races:** a load or a build that finishes after the person moved on and overwrites
   the newer choice (a missing `loadToken` check or the like).

Cover `src/` (the app, the player, the stage, the UI, exports, the Studio tools, and every pack) and
`site/` pages that take input. Skip `vendor/`.

## For each finding

- File and line, the value's path in one sentence, and what a person would see.
- Severity: **P0** (a promise is false or a choice is lost), **P1** (a choice is weakened without a
  word), **P2** (a latent risk: correct today, fragile tomorrow), **P3** (cleanup).
- **Proof:** for every P0 and P1, a small test that fails on `main` because of it, in
  `tests/cdx-caps-proofs.spec.mjs` on the clips branch `codex/silent-caps-audit-clips` (never
  merged, so the suite stays green). The lane that fixes the finding copies its proof into its own
  PR as the regression test.
- The fix you'd suggest, in two lines, and whether it changes what anyone sees on public toys (then
  it goes to the owner first).

## What to hand back

- `docs/audits/silent-caps-2026-10.md` (300 lines at most): the method, counts by kind and severity,
  then every P0 and P1, then a table of the rest.
- `docs/audits/silent-caps-2026-10.json`: every finding, one object each, with a stable id, its
  kind, severity, file, line, and suggested fix.
- The proofs on the clips branch, as above, with one command to run them all.
- No fixes in this task. The Operator routes each finding to its owner.

## Stay out of the way of open work

Open PRs are changing the Splats slider (lane SPL1, #716), the recorder and stage controls (lane
REC1, #710), exports (lane EXP1), and several toys. Audit `main` as it is; when a finding sits in a
file an open PR changes, note the PR number. Lane AUD1 (a Claude session) is auditing `src/app.js`,
`src/ui.js`, `src/player.js`, `src/stage.js`, `src/exports.js`, and `src/state.js` by hand at the
same time: you may cover them too, and the Operator merges the two lists.

## Rules

`node tools/preflight.mjs --quick`. No change to the site, any toy, or the engine. American English
and the serial comma. PR body: Summary, Verification, Deviations, Known issues, and What was cut.
Credit lines read "Codex (GPT-6)".

**Done** means every value path in `src/` traced and the findings filed, or the files you didn't
reach listed with the reason.
