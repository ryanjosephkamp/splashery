# Lane AI: AI and computing toys

Prefix `ai`. Owns `src/packs/computing.js`, the `computing` category and its toys' rows in
`src/toys.js`, those toys' entries in `src/toy-sounds.js`, `tools/toy-plan.json` (TOY-PLAN.md
regenerated) and `CREDITS.md` if needed, `tests/ai.spec.mjs`, the `ai-*` screenshots and this file.
How lanes work: [OPERATING.md](../OPERATING.md). Earlier lessons: [history.md](history.md).

## Brief

Written by the Operator on September 27, 2026, from the ideas the owner approved on the Toy Ideas
page.

Build 11 new kit-built toys on a new shelf, "AI and computing". The owner's note for the set:
"Kit-built models where you watch the data move: glowing pulses and tokens, weights you can see as
wire thickness, layers that light up in order." Each toy's tap must meet the effect quality rules:
real motion with solid pieces, separate things move separately, and it reads at a glance at phone
size. Use generic names only (no product or company names).

You own: a new pack file src/packs/computing.js; a new category in src/toys.js (id `computing`,
label "AI and computing", placed after `maths`) and your toys' rows there; your toys' entries in
src/toy-sounds.js, tools/toy-plan.json (TOY-PLAN.md regenerated) and CREDITS.md if needed;
tests/ai.spec.mjs; your `ai-*` screenshots; and docs/handoff/AI.md. Toy ids as below.

The toys (tap, sound, why; the owner approved these, so follow them closely and note any change you
must make):

1. `perceptron`, Perceptron. Tap: three input lights send pulses along wires whose thickness shows
   their weights into one node; the sum fills a gauge, and if it passes the threshold the output
   lamp snaps on. On a wrong answer the wires thicken or thin, so you watch it learn (4 s). Sound: a
   blip for each input, a click as the lamp decides, a rising tone when it learns. Why: the first
   neural network (1958), simple enough to read at a glance.
2. `neural-network`, Neural network (MLP). Tap: a forward pass: a wave of light runs left to right
   through three layers, each neuron glowing as bright as its activation; then a red backprop pulse
   runs right to left and the weights shift a little (4.5 s). Sound: a rising arpeggio going
   forward, a falling one coming back.
3. `cnn`, Convolutional network. Tap: a glowing 3×3 filter slides across a pixel picture of a
   handwritten 7, stamping a feature map tile by tile; pooling shrinks the map, and a bar chart of
   the digits 0 to 9 rises with 7 on top (5 s). Sound: a tick at each step of the filter, a chime at
   the answer.
4. `rnn`, Recurrent network. Tap: word blocks feed in one at a time; the hidden state, a glowing
   orb, loops back through the cell after each one and changes color as it carries what came before.
   An LSTM style (an option) shows its three gates opening and closing like shutters (4.5 s). Sound:
   a pulse for each word, the loop humming higher as the memory builds.
5. `transformer`, Transformer. Tap: a row of token tiles; arcs of light jump between them, thicker
   where attention is stronger and a different color for each head; the tiles rise through a
   feed-forward block and up the stack of layers, and a new token tile appears at the end of the row
   (5 s). Sound: a shimmering chord for each layer, a pop for the new token.
6. `looped-transformer`, Looped transformer. Tap: one transformer block with a track looping through
   it: the row of tokens rides round the loop several times, going from blurry to sharp on each
   pass, until the answer settles (5 s). "Blurry to sharp" must be real: tiles whose marks resolve,
   not a blurred picture. Sound: a tone that climbs a step on each loop, then resolves.
7. `diffusion-model`, Diffusion model. Tap: a cloud of random specks clears step by step into a
   crisp small toy (the rubber duck, say) while a step counter runs down from 50 to 0; then the
   noise washes back over it (5 s). You may build a small version of an existing kit toy's shapes,
   or a simple one of your own. Sound: a white-noise hiss that settles into a clean chord. Why:
   Gaussian splats are points plus noise, so this one comes naturally to Splashery.
8. `gradient-descent`, Gradient descent. Tap: a ball rolls down a hilly loss landscape, overshoots
   and settles into a valley. A "Learning rate" option makes it creep, or bounce right out of the
   valley when it's too high (4.5 s). Sound: a rolling tone that falls in pitch as the loss drops.
9. `word-vectors`, Word vectors. Tap: word points float in 3D, each with a small sign; arrows add
   up, king minus man plus woman, and land right next to queen, which lights up (4 s). Sound: three
   chimes, then a bright ding at the answer.
10. `sorting-machine`, Sorting machine. Tap: a row of colored bars of different heights sorts
    itself, the bars swapping as solid pieces, by bubble sort, quicksort or merge sort (an option),
    with a swap counter; then it shuffles again (5 s). Sound: each bar plays its height as a note,
    so you hear the sort rise into a scale.
11. `half-adder`, Half adder. Tap: two input switches flip; light flows along the wires through an
    XOR gate and an AND gate, whose shapes glow as they fire, and the sum and carry lamps show 1 + 1
    = 10 in binary (3.5 s). Sound: switch clicks, and a buzz through each gate.

Notes:

- Mind the kit's limits (15 parts, 48 tokens) and the draw-order rules in PACKS.md; pick designs
  that stay inside them.
- Text on the toys (word signs, digits, counters) must stay legible at phone size.
- Every toy ends its tap where it started (the tap test checks this).
- If two or three toys can share helpers (glowing pulses along wires, layer blocks), put them in
  computing.js, not in the engine.

## State

September 27, 2026: lane started. Handoff file, shelf category and draft PR first; then the toys.

## Notes

## Known issues

## For the Operator
