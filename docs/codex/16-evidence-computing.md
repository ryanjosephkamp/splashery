# Codex task 16: is it right? Evidence for AI and computing, and the Lab

**Branch:** `codex/evidence-computing`, cut from `main`. **Output, and nothing else:** one
`docs/evidence/<toy id>.json` for each toy that needs one, `tests/evidence-computing.spec.mjs` (one
new test file), `docs/audits/evidence-computing-2026-10.md`, and small fixes to plainly wrong
numbers or labels under `src/` (each one listed in the report with its source).

The owner wants evidence for every toy that claims to show something scientific, mathematical or
technical: "I do not want to hallucinate these things ... Anything that we find that actually isn't
correct, we will have to improve ... in some cases you have to stretch things ... but we need to be
transparent about that." The evidence will show on each toy's page on the site, not in the toy. This
task covers the `computing` and `lab` shelves. Read `docs/evidence/README.md` first: it defines the
file you write.

## Steps

1. **List the toys.** Every toy on these shelves in `src/toys.js` (labs on, so labs toys count).
   Decide which make claims that can be right or wrong (a model, a simulation, an algorithm, a fact,
   a label). In the report, list the ones you skip and why (a toy that only plays).
2. **Check each claim** in the toy and in its How-to and About texts (`src/toy-help.js`): read the
   code that makes it (give `file:line`), find sources you open (standards, textbooks, papers, NASA,
   NIST, museum or reference pages), and give a verdict as the README says. Where a claim can be
   computed, test it.
3. **Must-checks** for this batch:

- **Sorting machine** (`sorting-machine`, `src/packs/computing.js` near 1052-1150 and 3733): for
  each of its eight algorithms (bubble, quick with Lomuto partition, bottom-up merge, insertion,
  selection, cocktail shaker, shell with gaps 4, 2, 1, heap), check that the precomputed steps are
  exactly that algorithm's comparisons and swaps (or writes), for many random and edge-case inputs,
  against an independent reference implementation in the test; check the counter it shows.
- **Enigma** (`src/packs/computing-history.js` 1124-1190): check the rotor wirings (I, II, III),
  reflector B, the stepping and the double step, and the plugboard against published sources, and
  reproduce known test vectors in the test (the toy's tests already check AAAAA → BDZGO and the
  double step; add an independent implementation and more vectors). Say what the toy can't do that a
  real Enigma I could (rotor order, rotors IV and V, ring settings, plugboard choice, start
  positions) and propose how it would decode a published historical message.
- The neural network toys (perceptron, multilayer perceptron, CNN, RNN, transformer, looped
  transformer, diffusion, gradient descent, word vectors): is the math real (forward pass, training
  step, attention), are the word vectors real vectors from a named source, and what is simplified?
- The Turing machine, the half adder and every other machine on the shelf: does it compute what it
  says (test its outputs)?

4. **Tests.** `tests/evidence-computing.spec.mjs` checks every claim that can be computed (an
   algorithm's output against an independent reference, a constant against its source value). It
   must pass on `main`. Never edit `tests/taps.spec.mjs` or any other test file.
5. **Fixes.** Fix in `src/` only a plainly wrong number or label (a wrong constant, a mislabeled
   part), each listed with its source. Anything that changes how a toy looks or moves goes in the
   report as a proposal for a Claude lane, with the evidence.
6. **Evidence files.** One `docs/evidence/<toy id>.json` per checked toy, exactly in the README's
   shape, in plain American English for a curious reader. They must not name any model, agent or
   tool that did the checking.
7. **The report**, `docs/audits/evidence-computing-2026-10.md`: a summary of at most ten lines (how
   many toys, claims, verdicts by kind), then a table of every claim that isn't `correct` with the
   evidence and the fix or proposal, then the skipped toys.
8. **Before you push:** the new test file passes on `main`
   (`SPLASHERY_CHROMIUM=<path to Chromium> npx playwright test tests/evidence-computing.spec.mjs`),
   and `npx prettier --check .` and `node tools/us-english.mjs --diff` are clean. Open a draft PR
   against `main` titled "Codex task 16: is it right? Evidence for AI and computing, and the Lab".
