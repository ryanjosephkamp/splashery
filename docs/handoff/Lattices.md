# Lane Lattices and orbitals: crystal lattices and the remaining orbitals (prefix `lat`)

## Brief

You are a Splashery worker session, started by the Operator (the coordinating session). Repo:
ryanjosephkamp/splashery. Your lane: Lattices and orbitals (prefix `lat`). Branch:
`claude/lane-lattices` (and `claude/lane-lattices-engine` for any change to the app outside your own
files, as an "Engine: …" PR merged first). PR title: "Phase Lattices and orbitals: crystal lattices
and the remaining orbitals". Handoff file: docs/handoff/Lattices.md (create it; start it with this
brief, word for word, under "## Brief", then keep "## State

Model: Opus 5.5 (claude-opus-5-5), default effort. Draft PR #393.

- October 7, 2026: both toys built in a new pack, `src/packs/lattices.js` (labs, Atoms shelf), with
  tests (`tests/lat.spec.mjs`, 13 passing), evidence (`docs/evidence/unit-cells.json`,
  `docs/evidence/orbital-atlas.json`), help, sounds (in `tools/sound-review.json` as "ready"), toy
  plan entries, credits and thumbnails.
  1. **Unit cells** (`unit-cells`): diamond, graphite, ice Ih, copper (fcc), iron (bcc) and
     magnesium (hcp), from their COD cells. The tap steps from the cell to the block to the bonds. A
     slider sets 1 to 4 cells along each edge, and "Start with" picks the first view. Thermal motion
     (off, true size or ×5) shows one Gaussian per atom in the bonds view.
  2. **Orbital atlas** (`orbital-atlas`): 68 orbitals (n = 1 to 5 in full, plus 6s, 6p, 6d, 7s and
     7p), grouped by shell. The tap cuts the orbital and lifts the front half away, and the cut face
     shows |ψ|² in that plane.

## Notes

- `src/lattice/cells.js` covers:
  - The six crystals: cells and atom positions from the Crystallography Open Database (public
    domain), and Debye–Waller B from Peng, Ren, Dudarev and Whelan 1996 (Acta Cryst. A52).
  - Blocks of cells and the nearest-neighbor bonds.
  - Ice's hydrogens by the ice rules: an Euler circuit on a periodic 6 × 6 × 6 block of oxygens
    gives every oxygen two hydrogens and every O–O line one.
- `src/lattice/orbitals.js`: hydrogen orbitals for any n, l and m (normalized Laguerre radial
  functions and real spherical harmonics in Cartesian form, without the Condon–Shortley sign, so
  each lobe's sign matches its name). They are sampled as the Electron orbital toy samples them: the
  radius from r²R² by an inverse CDF cut at 98.5%, the direction from Y² by rejection. Orbital ids
  are `4d`, `4d1`, `4d-1`, `4d2`, `4d-2` and so on (n, the letter, then m).
- How the Unit cells views work:
  - Parts: the central cell, three shells of cells around it, the bonds, the outline and the thermal
    Gaussians.
  - The cell view scales every part up about the central cell's center (and moves that center to the
    frame's middle).
  - The block view grows the shells out of the cell.
  - The bonds view uses one morph channel: every atom spreads out ×2.5 from the cell's center while
    its part shrinks by 1/2.5 about the same point, so each atom stays in place and becomes a ball
    1/2.5 its size.
  - `k.fitMorphs = false`, with `k.reach` framing the block.
- The Orbital atlas keeps still (`turntable: false`, camera yaw 0) and turns each orbital about its
  up axis so its densest vertical plane faces the viewer. Turning the halves to face the viewer was
  tried first and failed: splats sort in their built pose, so a half turned 90° drew its back over
  its cut face.
- atoms.js (the Electron orbital and Crystal lattice toys) is not changed; nobody edits it now.

## Known issues

- The block view's shells grow out of the central cell by scaling (each atom grows as it moves out),
  not by sliding at full size. One morph channel per splat is taken by the bonds view.
- The thermal motion is a still distribution (one Gaussian per atom), not an animated vibration.
- Ice's thermal U values are at 81 K (COD 1572227, the only anisotropic set found), while its
  geometry is Goto et al.'s.
- A second tap during the atlas's open hold pauses it (the app's rule for long effects).

## For the Operator

- No engine change is needed. The lane PR (#393) is labs only.
