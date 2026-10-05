# Lane Molecule viewer: open a molecule, or fetch one by its PDB code (prefix `mol`)

## Brief

You are a Splashery worker session, started by the Operator (the coordinating session) for the
October push. Repo: ryanjosephkamp/splashery. Your lane: Molecule viewer (id `MolView`, prefix
`mol`). Branch: `claude/lane-molecule-viewer` (and `claude/lane-molecule-viewer-engine` for any
change to the app outside your own files, as an "Engine: …" PR merged first). PR title: "Phase
Molecule viewer: open a molecule, or fetch one by its PDB code". Handoff file:
docs/handoff/MolView.md (create it; start it with this brief, word for word, under "## Brief", then
keep "## State

WORKING (October 5, 2026). Built and tested; clips being posted on Effect review page 2.

- Engine PR #300 ("Engine: a tap can say something, and a toy's panel can take dropped files",
  branch `claude/lane-molecule-viewer-engine`) should merge first; this branch has it merged in.
- The toy `molecule-viewer` (labs, Atoms shelf): `src/packs/molecule-viewer.js` and `src/molview/`
  (parse, worker, load, geom, draw, radii).
- Samples (a dated snapshot, fetched October 5, 2026, CC0): 1CRN, 1EMA, 1LYZ, 1BNA (DNA) and
  caffeine (Chemical Component CFF, ideal coordinates), in `assets/toys/molecule-viewer/`.
- Tests: `tests/mol.spec.mjs` (27; the RCSB fetch mocked twice, in Node and with `page.route`),
  `tests/mol-engine.spec.mjs` (2). Evidence: `docs/evidence/molecule-viewer.json`.
- Tools: `tools/mol-clip.mjs` (phone-size MP4 clips of the whole page, the toast included),
  `tools/mol-shot.mjs` (stills).

## Notes

- Readers: PDB (fixed columns, HELIX/SHEET, CONECT, JRNL, AUTHOR, REMARK 2), mmCIF (streamed through
  `eachCifToken`/`readCif` from `src/chem/protein.js`; `_struct_conf`, `_struct_sheet_range`,
  `_audit_author`, `_citation`, `_exptl`, resolution), SDF/MOL (`parseMolfile` from
  `src/chem/molfile.js`; 2D drawings embedded and labeled as estimates) and XYZ. First model, first
  altloc. Cap: 250,000 atoms with a plain message.
- Reading happens in a module Web Worker (`src/molview/worker.js`), with a main-thread fallback.
- Bonds: from the file, else covalent radii (Cordero 2008) + 0.45 Å, on a hashed grid.
- Secondary structure: the file's records, else the simplified DSSP of `src/chem/protein.js` (up to
  3,000 amino acids), labeled "inferred" in the Toy tab.
- Surface: a blobby Gaussian surface (each heavy atom exp(B(1 − d²/R²)), R its van der Waals radius,
  B = 1.6, level 1), drawn as splats at the grid-edge crossings; the Toy tab says how it is
  approximated.
- Level of detail: the toy draws 1.2 of the kit's count. Balls and sticks fall back to one Gaussian
  per atom and per half bond, per bond, then atoms only; past the budget only the atoms on the
  outside (a flood fill on a voxel grid), then one in k. The cartoon falls to one flat Gaussian per
  path point. Largest tested: the human 80S ribosome, 4V6X, 237,685 atoms (read in 2.1 s in Node;
  each style builds in 0.4 to 2.2 s inside the phone budget of 72k splats; the surface at the max
  tier takes about 4 s).
- Taps: a tap on an atom picks it (a ring marker in yellow, cyan, magenta that turns once); two give
  the distance (a line of beads), three the angle (and an arc). The words show as a message (the
  engine PR's `say`) and in the Toy tab. The Play button measures across a bond angle near the
  middle, then the angle, then clears. Marks are tokens, re-sorted when the picks change.
- The toy holds still (`turntable: false`) so atoms can be tapped.

## Known issues

- Along a bond the measuring line is mostly inside the balls and stick; the markers and the message
  carry it there.
- In the surface style the markers sit inside the surface and are mostly hidden; the message still
  gives the measurement.
- Titles of old entries show in capitals, as the PDB gives them.
- The surface of a very big entry takes a few seconds to build on a phone.

## For the Operator

- Merge order: #300 (engine) first, then this PR.
- The `say` field and `input.drop` could go in docs/PACKS.md, section 5 ("Action" and "Your own
  input").
