# Tiny world r2 (lane `TinyR2`, prefix `tw2`)

Model: Opus 5.5. Branch: `claude/lane-tiny-r2`. PR: "Phase Tiny world r2: DNA to protein, and the
life of a cell".

## Brief

### Brief (written by the Operator on October 5, 2026, from the owner's push notes and Push Plan pick S13)

The owner: Tiny world stays open, low priority but "technically correct and high fidelity": "DNA to
protein is awesome. Maybe there are other things like that"; also the cell's life cycle, apoptosis
and phagocytosis.

1. **DNA to protein** (S13): type a DNA sequence or pick a real gene (sequences from NCBI, public
   domain; insulin, hemoglobin beta, GFP and a few more), and watch it happen: RNA polymerase
   opening the double helix and building mRNA (transcription, with the template strand right), then
   a ribosome reading codons, tRNAs with the matching anticodons bringing amino acids, and the chain
   growing; for a known protein, the chain settles into its real folded structure from the PDB
   (CC0). The genetic code exactly right (start and stop codons, reading frame); show a mutation's
   effect (a point change, a frameshift).
2. **The life of a cell**: mitosis through its real phases (prophase to cytokinesis, chromosomes
   condensing and separating on the spindle), apoptosis (shrinking, blebbing, breaking into
   apoptotic bodies) and phagocytosis (a white blood cell engulfing a bacterium into a phagosome).
   Clinical and textbook in tone, no gore; real motion of solid pieces (CLAUDE.md, "Effect quality
   rules"). Everything technically right, with sources you open (textbooks, NCBI, PDB, review
   papers), and plain words about what is simplified: write a docs/evidence/<toy id>.json for each
   new toy in the shape docs/evidence/README.md gives, with tests for what can be computed (the
   translation of each sample gene equals its protein sequence).

New toys are labs, on the Tiny world shelf. Tests in `tests/tw2*.spec.mjs`; clips at phone size on
Effect review page 2 (lane record `TinyR2`); credits; how-to and About texts.

You own: `src/packs/tiny-r2.js` (new), any new `src/tiny/` helpers, `tools/tw2-*.mjs`, the new
assets, `tests/tw2*.spec.mjs`, the evidence files for your toys, your toys' lines in the shared
lists, and your handoff file. Import from the existing Tiny world pack (src/packs/tiny.js) without
editing it.

How this lane runs: exactly as docs/handoff/ScienceR3.md, "How this lane runs", says (read it;
replace the prefix and lane record with yours). Labs: the Operator merges after a full test run.
Finish every working turn with "READY:", "WORKING:" or "BLOCKED:"; Splashery has no CI to wait for;
for a long job, schedule a check-in with send_later instead of going idle.

## State

STOOD DOWN (October 5, 2026): PR #291 merged into main at 9e8c45e3 (head e31ede95); all four toys
are labs. The owner had not marked the four clips on Effect review page 2 (cards tw2-dna-to-protein,
tw2-mitosis, tw2-apoptosis, tw2-phagocytosis; lane record TinyR2) when the lane stood down; the
Operator starts a follow-up round when the marks come in. Check-ins stopped.

- Last fix before the merge (Integrator 5's run): with "Your own" picked and no sequence, an
  unreadable one or one with no ATG, the DNA toy shows the default gene (HBB) and says why, instead
  of throwing (kit.spec builds every select choice). Tested in tests/tw2-dna.spec.mjs.
- **DNA to protein** (`dna-to-protein`): four NCBI genes (HBB, INS, LYZ, GFP) with the alpha carbons
  of PDB 4HHB, 1MSO, 1LZ1, 1GFL in `src/tiny/genes.js` (`node tools/tw2-genes.mjs` rebuilds it and
  checks each translation against the record). Mutations in codons 2 to 7 and typed DNA. About 34 s;
  the camera follows each step. Evidence: docs/evidence/dna-to-protein.json.
- **Cell division** (`mitosis`): prophase to cytokinesis with phase names, then one daughter grows
  back into the cell (18 s).
- **Apoptosis** (`apoptosis`): shrinkage, pyknosis, blebbing, karyorrhexis, apoptotic bodies that
  drift away; a neighbor moves in (14 s).
- **Phagocytosis** (`phagocytosis`): a neutrophil wraps a bacterium into a phagosome, lysosomes
  fuse, digestion, the waste goes out (16 s), with labels for each step.
- Evidence files for all four; tests `tests/tw2-dna.spec.mjs` and `tests/tw2-cells.spec.mjs`.
- Next: the owner's marks; fix any notes in this PR.

## Notes

- The DNA toy follows its story with the camera through `out.view` (lane Books' page focus: a recipe
  with `focus` may say what to show). `tools/effect-clip.mjs` puts the camera home every frame, so
  this lane renders its clips with `tools/tw2-clip.mjs` (MP4, phone-size portrait, `--stills=` for a
  strip of moments).
- DNA to protein: tokens 0..9 are the tRNAs, 10..19 their amino acids, 20 and 21 the tether's ends;
  DNA bases are levers (the coding strand lifts, the template's bases turn about its backbone); the
  chain's globule copy fades in bead by bead (channel 1) and swaps for a copy that morphs into the
  structure (channel 2).
- Cell division: chromatids are tokens 0..7 (condensed from a morphing chromatin copy), centrosomes
  8 and 9, kinetochore-fiber tips 10..17 (fibers are skin), envelope pieces 18..29, phase names
  30..36, polar-fiber ends 37..40. The membrane pinches by a morph (`daughterPoint`: each half's
  polar angle doubles), tested in `tests/tw2-cells.spec.mjs`.
- A source check corrected one claim: UniProt marks no removed methionine for GFP, so it stays.

## Known issues

- On a phone the DNA toy's whole-toy view (at rest) is small: the gene is drawn wide. The story's
  own views zoom in.
- Faint membranes are drawn as thin shells of faint splats (no `rim` glass, because they also
  morph); they read as translucent at phone size.

## For the Operator

- The DNA toy uses `focus`/`out.view` so the camera follows its story: please tell me if the owner
  would rather keep his own camera during a tap.
