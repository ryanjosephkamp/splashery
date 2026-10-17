# Lane NR1: the Neuron specimen, finished to the bar

## Brief

(Written by the Operator on October 16, 2026; summarized.) Lane NR1 (prefix `nr1`), Opus 5.5 at high
effort, branch `claude/nr1`, PR "Phase NR1: Neuron specimen, finished to the bar". It takes over
Codex task 78b (#613, the labs toy `specimen-neuron` in `src/packs/neuron.js`), from a concept by
Ryan Kamp, and supersedes that PR.

- Merge `codex/portfolio-b` (keeping Codex's history), regenerate the generated files, and restore
  the Bacterium card on the `neuron` toy's page without merging or removing toys.
- Bring it to the bar as motion at phone size: a spike that reads as a wave down the axon, stains
  that look like real histology, a focus merge that looks like a microscope focusing, clear tap
  feedback, and a sound that fits a lab specimen. Keep the merge math honest and tested.
- Labs only; no engine changes; never edit `tests/taps.spec.mjs` or loosen a test.

## State

- PR #694 (READY October 17, 2026; in the Operator's merge batch, Ops #698). Clips on Effect review
  page 2, lane NR1: `nr1-spike`, `nr1-nissl`, `nr1-golgi`, `nr1-he`, `nr1-focus`. The MP4s and
  Codex's portfolio-b audit are on `claude/nr1-clips` (never merged).
- The Bacterium card: the related list keeps the top 8; the specimen's six shared tags pushed
  Bacterium (the 8th) off. Fixed by retagging the specimen only; `tests/nr1.spec.mjs` checks that no
  toy loses a related card to it.

## Notes

- Twelve materials per splat (cytoplasm, Nissl bodies, myelin, spines and nodes, nucleus, nucleolus,
  glia, dendrite, axon, boutons, the lit slide and its rim), each with a stain's ink and density
  (`STAINS`, `stainLook`). The slide is part of the merge tree, so the buffer stays `2·leaves − 1`;
  its finest splats stay drawn as the lamp at every focus.
- The shader hook (`neuronModifier`) crossfades the two neighboring focus levels, runs the
  Hodgkin-Huxley wave, and packs a tap's point into morph channels 2 and 3 (`packTap`).
- `tools/effect-clip.mjs` opens the page without `labs=1`, so film with
  `SPLASHERY_URL="http://127.0.0.1:4173/?labs=1&renderer=webgl2&x="`. `tools/nr1-focus-clip.mjs`
  films the focus sweep.
- Known issues: a pale thumbnail (Nissl is the default stain), and a tap on the axon shows the glow
  but the spike still starts at the dendrites.
