# Codex task 12: every toy picks up, lands and goes home

**Branch:** `codex/hands-l1-sweep`, cut from `main`. **Output, and nothing else:**
`tests/hl1.spec.mjs` and `docs/audits/hands-l1-sweep-2026-10.md`.

With the ✋ Hands-on switch on, Level 1 must work for every toy (`docs/HANDS-ON-PLAN.md`, first
paragraph): you pick the whole toy up and toss it, it lands, bounces and settles (soft toys squish),
and ↺ Reset sends it home. This task checks that for all of them, every time.

## Steps

1. **Read** `src/physics/world.js`, `src/physics/hands-on.js`, `tests/phy-engine.spec.mjs` (how a
   test drives the hand tool) and `docs/handoff/Physics.md` (units and known issues).
2. **The sweep.** For every toy in `src/toys.js` (labs on, so the labs toys count too), with
   Hands-on on: pick it up at its center, lift it, toss it sideways and let go. Measure from the
   engine's state, not from pictures:
   - it lands on the floor within 4 s and is still within 8 s (no endless jitter);
   - it never goes below the floor or out of the stage;
   - its height at rest is plausible (it rests on its outside, not sunk in);
   - ↺ Reset brings it back to its starting pose within 2 s, to within a small tolerance;
   - no console errors.
3. **The test file.** `tests/hl1.spec.mjs`: a fast version for the suite (a sample of about 40 toys,
   chosen to cover every shelf, scans and kit toys, soft and heavy) that must pass on main, plus
   `HL1_ALL=1` to run every toy. Never edit `tests/taps.spec.mjs` or any other test file.
4. **The report.** `docs/audits/hands-l1-sweep-2026-10.md`: a summary of at most ten lines, then a
   table of every toy that fails a check, with the measured numbers, a short cause where you can
   find it (`file:line`) and a proposed fix. Don't change the engine or any toy: the Claude lanes
   fix them.
5. **Before you push.** The full new test file passes on main with
   `SPLASHERY_CHROMIUM=<your Chrome path> npx playwright test tests/hl1.spec.mjs` (the sample), and
   `npx prettier --check .` and `node tools/us-english.mjs --diff` are clean. Open a draft PR
   against `main` titled "Codex task 12: every toy picks up, lands and goes home".
