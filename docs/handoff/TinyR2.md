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

WORKING (October 5, 2026):

- **DNA to protein** (`dna-to-protein`, labs, Tiny world shelf): built and tested. Four genes from
  NCBI (HBB, INS, LYZ, GFP) with the alpha carbons of their PDB structures (4HHB, 1MSO, 1LZ1, 1GFL)
  in `src/tiny/genes.js` (`node tools/tw2-genes.mjs` rebuilds it and checks each translation against
  the record's). Mutations (change, add or remove a base in codons 2 to 7) and typed DNA.
- Next: the evidence file, the clip, then mitosis, apoptosis and phagocytosis.

## Notes

- The toy follows its story with the camera through `out.view` (lane Books' page focus: a recipe
  with `focus` may say what to show). `tools/effect-clip.mjs` puts the camera home every frame, so
  this lane renders its clips with `tools/tw2-clip.mjs` (MP4, phone-size portrait, `--stills=` for a
  strip of moments).
- The story is about 34 s at normal speed: transcription (7 s), the mRNA moves down, the small
  subunit and the initiator tRNA scan to AUG, the large subunit joins, a cycle per drawn codon, a
  quick run over the codons not drawn, the last codon, the stop codon and the release factor, then
  the fold (a molten globule's copy swaps for a copy that morphs into the structure).
- Tokens 0..9 are the tRNAs, 10..19 their amino acids, 20 and 21 the tether's ends; DNA bases are
  levers (the coding strand lifts, the template's bases turn about its backbone).

## Known issues

- On a phone the whole-toy view (at rest) is small: the gene is drawn wide. The story's own views
  zoom in on each step.

## For the Operator

- Nothing yet.
