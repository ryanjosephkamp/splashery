# Lane Molecule viewer: open a molecule, or fetch one by its PDB code (prefix `mol`)

## Brief

You are a Splashery worker session, started by the Operator (the coordinating session) for the
October push. Repo: ryanjosephkamp/splashery. Your lane: Molecule viewer (id `MolView`, prefix
`mol`). Branch: `claude/lane-molecule-viewer` (and `claude/lane-molecule-viewer-engine` for any
change to the app outside your own files, as an "Engine: …" PR merged first). PR title: "Phase
Molecule viewer: open a molecule, or fetch one by its PDB code". Handoff file:
docs/handoff/MolView.md (create it; start it with this brief, word for word, under "## Brief", then
keep "## State", "## Notes", "## Known issues" and "## For the Operator" current). Model: Opus 5.5.

### Brief (written by the Operator on October 5, 2026, from the owner's Push Plan picks)

Push Plan S1, a yes once the owner approved fetching by code ("PDB fetch yes", October 5, 2026;
CLAUDE.md, "Live data").

1. **Open a structure** from the device (pick or drop a file; nothing is uploaded): PDB, mmCIF,
   SDF/MOL and XYZ, parsed by our own code (or a small permissive library under CLAUDE.md's library
   rule). Atoms as splats (CPK colors, van der Waals or ball-and-stick radii), bonds (from the file,
   or by distance with standard covalent radii), and for proteins and nucleic acids a cartoon
   (backbone ribbon, helices and sheets from the file's records, labeled when inferred) and a
   molecular surface (say how it is approximated). Color by element, chain, residue or B-factor. Tap
   two or three atoms to measure a distance or an angle, in ångströms and degrees.
2. **Fetch by code**: type a four-character PDB code (and an example list), and the toy reads the
   entry from RCSB (`https://files.rcsb.org/download/<code>.cif`, keyless) only when the person
   asks. The source, the entry's title and authors, and the time of the fetch show beside it;
   nothing is stored or sent; wwPDB data is CC0 (cite the entry and its authors anyway). A dated
   snapshot ships for offline use: the starter pack in docs/audits/open-science-data-2026-10.md
   (crambin 1CRN, GFP 1EMA, lysozyme 1LYZ), plus one DNA structure and one small drug-like molecule
   from an open source.
3. **Big structures**: stay smooth on a phone (level of detail, a cap with a plain message, work in
   a worker). Say what the largest tested entry was.
4. **Evidence**: docs/evidence/<toy id>.json (docs/evidence/README.md), with tests that check the
   parsers against known values (atom counts, a known bond length, a known angle in a sample).

A new labs toy on the Atoms shelf. Don't edit the existing `molecule`, `protein` or
`crystal-lattice` toys (`src/packs/atoms.js`) or Science r3's structures (`src/packs/science.js`);
import from them if useful. Tests in `tests/mol*.spec.mjs` (one mocks the RCSB fetch; none needs the
network); clips at phone size on Effect review page 2 (lane record `MolView`); credits; how-to and
About texts.

You own: `src/molview/` (new), `src/packs/molecule-viewer.js` (new), `tools/mol-*.mjs`, the sample
files, `tests/mol*.spec.mjs`, your toy's evidence file, its lines in the shared lists, and your
handoff file.

How this lane runs: exactly as docs/handoff/ScienceR3.md, "How this lane runs", says (read it;
replace the prefix and lane record with yours). Labs: the Operator merges after a full test run.
Finish every working turn with "READY:", "WORKING:" or "BLOCKED:"; Splashery has no CI to wait for;
for a long job, schedule a check-in with send_later instead of going idle. Before READY, re-read
CLAUDE.md's "Effect quality rules" and check each clip against them at phone size.

## State

WORKING (October 5, 2026): lane started; reading the code, planning the parsers and the toy.

## Notes

## Known issues

## For the Operator
