# Lane Lattices and orbitals: crystal lattices and the remaining orbitals (prefix `lat`)

## Brief

You are a Splashery worker session, started by the Operator (the coordinating session). Repo:
ryanjosephkamp/splashery. Your lane: Lattices and orbitals (prefix `lat`). Branch:
`claude/lane-lattices` (and `claude/lane-lattices-engine` for any change to the app outside your own
files, as an "Engine: …" PR merged first). PR title: "Phase Lattices and orbitals: crystal lattices
and the remaining orbitals". Handoff file: docs/handoff/Lattices.md (create it; start it with this
brief, word for word, under "## Brief", then keep "## State", "## Notes", "## Known issues" and "##
For the Operator" current). Model: Opus 5.5, at the default effort.

### Brief (written by the Operator on October 7, 2026)

BACKLOG.md, "More crystal lattices and electron orbitals", asked for "some day" in the E2 review;
the push (ROADMAP.md, "Now", item 4) wants science data that already are Gaussians. Read
docs/handoff/Chemistry.md and the existing orbital and crystal toys first. Build: 1. **Crystal
lattices** as a new labs toy (or a set of them): diamond, graphite, ice Ih, and the metals (fcc
copper, bcc iron, hcp magnesium), from real lattice constants and atom positions (cite them in
docs/evidence/), atoms as solid spheres with true relative radii, a tap that steps between the unit
cell, a block of cells and the bonds, and a slider for how many cells. Optional if time allows:
thermal motion as real Gaussian displacement (Debye–Waller, from published B-factors), which is a
splat by nature. 2. **The remaining orbitals**: 4d and 5f (and any other missing ones) sampled from
|ψ|² exactly as the existing orbital toys do, with phase colors, checked against the analytic radial
and angular functions in a test. Assets: compute everything; no downloaded models.

How this lane runs: exactly as docs/handoff/ScienceR3.md, "How this lane runs", says (read it;
replace the prefix and lane record with yours). New toys go behind the labs switch (`labs: true`);
the Operator merges labs work after a full test run (the Integrators run it). Finish every working
turn with "READY:", "WORKING:" or "BLOCKED:"; Splashery has no CI to wait for; for a long job,
schedule a check-in with send_later instead of going idle. Clips at phone size go on Effect review
page 2 (https://claude.ai/artifact/BSayVkzQ2FKESesrkrSUMK) as docs/OPERATING.md, "Steps for a lane",
says (no republish), ids lat-…. New sounds go in tools/sound-review.json as "ready" (the owner hears
them on the Sound Board), not as cards. Evidence that the science or math is right goes in
docs/evidence/ (see the existing files). Before READY, re-read CLAUDE.md's "Effect quality rules"
and check each clip against them at phone size. Aim for a first READY within about six hours, then
polish rounds on the owner's marks. The push pace ends at the weekly reset (20:00 UTC today); after
it about six workers run, so keep going at an even pace. Your Operator is
session_012GmKRUMZLir2nb27Bo8Cu2.

## State

Model: Opus 5.5 (claude-opus-5-5), default effort.

- October 7, 2026: both toys built, in a new pack `src/packs/lattices.js` (labs, Atoms shelf):
  **Unit cells** (`unit-cells`) and **Orbital atlas** (`orbital-atlas`). Clips, tests and evidence
  in progress.

## Notes

- `src/lattice/cells.js`: the six crystals (cells and atom positions from the Crystallography Open
  Database, public domain; Debye–Waller B from Peng, Ren, Dudarev and Whelan 1996), blocks of cells,
  nearest-neighbor bonds, and ice's hydrogens by the ice rules (an Euler circuit on a periodic 6 × 6
  × 6 block of oxygens: every oxygen gets two, every O–O line one).
- `src/lattice/orbitals.js`: hydrogen orbitals for any n, l, m (normalized Laguerre radial functions
  and real spherical harmonics in Cartesian form), sampled as the Electron orbital toy samples them
  (radius from r²R² by an inverse CDF cut at 98.5%, direction from Y² by rejection).
- The atoms.js orbital and crystal toys are not changed (nobody edits atoms.js now); the new toys
  are separate labs toys.

## Known issues

- (none yet)

## For the Operator

- (nothing yet)
