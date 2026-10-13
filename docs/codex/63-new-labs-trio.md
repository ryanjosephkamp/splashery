# Codex task 63: three new labs toys: a wing in the wind, a monochord, and an Apollo capsule

**Branch:** `codex/new-labs-trio`, cut from `main`. One draft PR against `main`.

Read `AGENTS.md`, `builders/RULES.md`, `docs/PACKS.md`, `docs/TOY-PLAN.md` (so nothing repeats an
existing toy) and CLAUDE.md's "Effect quality rules". All three open behind the labs switch.

## The three toys

1. **Wing section lab** (Science): an airfoil you can tilt; streamlines or smoke particles flow past
   it; lift and drag numbers from thin-airfoil theory at small angles and a real NACA 0012 or 2412
   data table beyond them (cite it), with a stall past the critical angle that you can see (the flow
   separates). The wing is a solid piece; the air moves.
2. **Monochord** (Science, a sound lab, not an instrument for the music shelf): one string over a
   sliding bridge; pluck either side; the frequencies follow Mersenne's laws (length, tension and
   linear density), the string visibly vibrates in the right mode, and the ratio between the two
   sides names the musical interval (2:1 octave, 3:2 fifth, and so on). Sound from the repo's own
   audio helpers.
3. **Apollo capsule interior** (Space): the command module's cabin from a NASA 3D Resources model
   (allowed under NASA's media guidelines; remove any NASA insignia; credit the source page; check
   the page's terms live and record them), baked to splats in tiers, with a tap that opens the hatch
   (a solid part on a hinge) and labels for the main panels.

Each gets a how-to line, About text, a sound, a plan entry, a thumbnail, and its row with the labs
flag; edit only your own lines in the shared lists. Equations and checks against a worked case go in
`docs/evidence/` and a test file `tests/cdx-trio.spec.mjs`; `taps`, `help`, `hta`, `unit`, `kit` and
`smoke` still pass (never edit `tests/taps.spec.mjs`).

## Don't touch

The files of the open PRs (#560, #562, #566, #581 and #582), the engine and `vendor/`.

## Report

A phone-size clip of each toy in use on `codex/new-labs-trio-clips` (never merged), linked in the PR
body, and what was checked per toy. Before you push: `npx prettier --check .` and
`node tools/us-english.mjs --diff` are clean.
