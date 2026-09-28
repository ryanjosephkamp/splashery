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

September 27, 2026: all 11 toys are built in `src/packs/computing.js` on the new "AI and computing"
shelf (after Math), each with its sound and plan entry. Draft PR:
https://github.com/ryanjosephkamp/splashery/pull/52. Next: clips on the Effect review page, then the
owner's marks.

Clips are on the Effect review page (lane record `AI`, cards `ai-<toy id>`, posted September 27,
2026). All 11 toys are `"v": "keep"` in the plan with an `improved` entry.

The owner's marks (September 27, 2026): gradient descent and half adder "good". Fixed in this PR:

- **3D models** (perceptron, neural network, CNN, RNN, diffusion model: "perfect for the 2D poster
  version; in addition I want an actual 3D version"): each has a View option, Poster (2D, the
  default, unchanged) or 3D model. The transformer and looped transformer were marked "fix" with no
  note; they got the same 3D view (the Operator was asked to confirm that reading).
  - Neural network: glass neurons in rings on a round stand, the flow slanting toward you, golden
    cores that grow as they fire, pulses through the air.
  - Perceptron: bulbs on posts, wires through the air to a metal Σ ball, a glass gauge the sum fills
    with an orange threshold ring, an output bulb.
  - CNN: slabs of little cubes one behind another (picture, feature map, pooled map), the filter's
    receptive field as four lines from its corners to the tile it stamps, score columns on a stand.
  - RNN: a dark cell with lit edges, the loop arching over it on a slant, word blocks rising in from
    the front; the LSTM's gates on its face.
  - Diffusion: a round 3D cloud clears into a bigger duck over a stand; at step 0 a solid copy of
    the duck (sorted as it stands) takes the specks' place, so it looks right from every side.
  - Transformer: word blocks on a plinth, box-outline feed-forward blocks, head A's arcs upright and
    head B's leaning back. Looped transformer: the loop leans back, the block is a box outline, the
    tiles are blocks.
- **Sorting machine**: the algorithm's name is on the panel above the counter, and five more
  algorithms: insertion, selection, cocktail shaker, Shell and heap sort (eight in all).
- **Word vectors**: real GloVe vectors (50 dimensions, public domain) for 24,000 common words, built
  by `tools/word-vectors.mjs` into `assets/toys/word-vectors/words.txt` (1.7 MB, loaded only by this
  toy). Type "A - B + C" in the Toy tab (or open a text file with it); A − B + C is worked out over
  all 50 dimensions and the answer is the nearest of the 10,000 most common words (the runner-up
  shows in gray). The toy shows a 3-D slice: axes along A − B and C − B (each scaled to fit, so the
  parallelogram of arrows is exact) and the answer at its true offset from the sum on A − B's scale.
  The default is still king − man + woman ≈ queen.
- Text on every toy now uses a lower splat weight (4): at weight 10 the letters vanished at 320
  pixels (PACKS.md: tiny splats vanish on small screens).

Second round (the Operator's notes on the owner's review, September 27, 2026;
[review](../reviews/2026-09-27-ai-math/review.md)):

- **Neural network, your own size**: options for 2 to 4 inputs, 1 to 3 hidden layers of 2 to 5
  neurons and 1 to 3 outputs (at most 14 neurons: each neuron's glow is a part). Every size gets a
  real forward pass (the default 3-4-2 keeps its weights). Up to 24 wires, each wire carries a pulse
  (a token each way); a bigger network sends waves of light along its wires instead (a band on a
  glassy sheath round each wire, channel 1). Card `ai-neural-network-sizes`.
- **Multilayer perceptron** (new toy, `multilayer-perceptron`): the neural network toy already is a
  general MLP, so, as the Operator suggested, this one solves XOR, which a single perceptron cannot:
  an OR and a NAND neuron feed an AND neuron; blue wires add, red subtract; it tries 00, 01, 10 and
  11 in turn and fills in a truth table. Poster and 3D. Cards `ai-multilayer-perceptron` and
  `ai-multilayer-perceptron-3d`.
- **Transformer, the classic encoder-decoder**: a Diagram option (Token flow, the first one, or
  Encoder–decoder), each with the View option. The classic layout follows the 2017 paper's figure
  with generic labels (EMBED, ATTENTION, ADD+NORM, FEED FWD, MASKED ATTN, LINEAR, SOFTMAX, POS, N×);
  a cyan packet rises up the encoder (boxes light as it passes, a band on channel 0), crosses into
  the decoder's middle attention, the decoder's gold packet (channel 1) meets it and goes on to the
  softmax, and the next word comes out of the top (HELLO WORLD, START HOLA → MUNDO). Cards
  `ai-transformer-classic` and `ai-transformer-classic-3d`.
- **CNN, draw a digit**: a third View, "3D, draw a digit". `tools/cnn-train.mjs` (plain JavaScript,
  no dependencies, seeded, about 10 s) trains a small CNN (conv 3×3 ×4, pool, conv 3×3 ×8, pool,
  dense to 10) on the UCI "Optical Recognition of Handwritten Digits" set (8×8, CC BY 4.0, license
  checked on the live page) and writes `src/packs/computing-cnn.js` (the weights, ten sample digits,
  97.0% test accuracy). The toy runs the network on your drawing at build time and shows every cell
  of every layer as a cube as bright as it fires; a tap lights the layers in order and raises the
  scores. The drawing pad is in the Toy tab ("Draw a digit"): it needs the engine PR #56 ("Engine: a
  drawing pad for a toy's input panel", branch `claude/lane-ai-computing-engine`), which must merge
  first. Without it, typing a digit shows a handwritten sample. okdalto/CNN-visualization is
  LGPL-3.0 and trained on MNIST (CC BY-SA), so only its idea was used: no code, no weights. Cards
  `ai-cnn-draw` and `ai-cnn-draw-pad`. After the Operator's review it is laid out in two rows
  (input, conv, pool on top; conv, pool, then the scores on a plinth and the answer below): the kit
  fits every toy to a sphere, so a long thin row came out as a small strip, and a compact block
  fills the frame like the poster does. The two cards' assets were replaced (no -r2, as they were
  not yet marked).
- Word vectors: `words.txt` loads only when that toy is built (its `prepare`), never in embeds of
  other toys; the embed transfer test stays green. Unknown words get one message: "\"xyz\" is not
  one of the 24,000 words it knows. Try a more common word."

Round 3 (the owner's notes on round 2, September 27; everything else was marked good):

- **3D perceptron and 3D multilayer perceptron** float in space: no base plate, no posts (the bulb
  helper takes `post: false`; the gauge hangs free). The MLP's X1, X2 and XOR labels moved onto dark
  plates. Cards `ai-perceptron-r3` and `ai-multilayer-perceptron-3d-r2`.
- **3D neural network** is built like the molecule toy: each neuron a solid glossy ball (input blue,
  hidden indigo, output green) and a gold shell (its own part) that grows round it as it fires; the
  weights are bonds as thick as the weight; each layer is a ring across the flow, so it reads from
  any side; no stand. All the size sliders work in 3D, capped at 14 neurons by the kit's 15-part
  limit (each neuron is a part, which also keeps them ready for grabbing). Only the approach was
  taken from `src/packs/atoms.js` (ball and stick); nothing of it was copied or edited. Card
  `ai-neural-network-r3`.
- **Classic transformer**, 2D and 3D: a bigger board with space between the boxes; each box carries
  a pixel icon instead of its name (eye: attention, lidded eye: masked attention, +: add & norm, »:
  feed forward, a vector: embedding, a wave: position, a slash: linear, bars: softmax); a key of
  nine entries at the bottom names them (N× too); the column lines run only in the gaps between
  boxes. In 3D the key stands on its own dark plate on the base and the N× labels are on plates.
  INPUTS/OUTPUTS and POS labels were dropped. Cards `ai-transformer-classic-r2` and
  `ai-transformer-classic-3d-r2`.

Round 4 (the owner's notes on round 3, September 28): "the labels are black rectangles, the writing
too faint; higher fidelity, less blurry".

- Root cause, checked (the Operator's findings were right): `text()` spread its splats over the
  whole label rectangle and dropped the ones off the ink, and its weight had been cut from 10 to 4,
  so only a few faint specks landed on the letters; and `sign()` put the letters 0.002 in front of
  their plate, so the plate could sort over them. Now `text()` samples only the ink (a custom shape,
  one square per font pixel, evenly spread) at weight 8 with the splat size of weight 4 (twice as
  dense, same splat size, so it does not vanish at low resolution), and signs lift their letters 0.8
  font pixel in front of the plate. This changes every toy's text (it reads more solid), so the
  approved cards' clips were re-rendered too (assets replaced, same cards).
- The 3D labels were also far too small: at a font pixel of 0.018 a label letter is about one screen
  pixel in a 320-pixel clip. A new `label3D()` draws labels about twice as big (font pixel 0.032 to
  0.04), bright white on dark plates, with denser text splats (`sign`'s new `ink` weight). Used on
  the 3D perceptron, multilayer perceptron (and a 1.6× truth table) and neural network, and for N×
  on the classic transformer.
- Spreading a model out does not make its labels bigger (the kit fits every toy to a sphere): keep
  the model compact and put labels above or below their parts.
- The classic transformer's key is off the toy: it is the recipe's `note` in the Toy tab (the owner
  wants everything on the toy to be splats). Tapping a box to highlight and name it is for later.
- Clips are now 480 pixels (320 looked blurry on the phone). The perceptron, multilayer perceptron,
  neural network and transformer use `density: 2` (twice the splats), like the balls do.
- Legibility was judged on the real app at 390 × 844 (phone-size screenshots), not only in clips.
- Cards `ai-perceptron-r4`, `ai-multilayer-perceptron-3d-r3`, `ai-neural-network-r4`,
  `ai-transformer-classic-r3` and `ai-transformer-classic-3d-r3`.

What each tap does now:

1. **Perceptron** (4 s): inputs X1 and X3 light (1, 0, 1) and send pulses along wires as thick as
   their weights; the Σ node flashes, the gauge fills to under the threshold line and the lamp
   flashes red (it wanted 1). The two live wires thicken (it learns), the pulses go again, the gauge
   passes the threshold and the lamp snaps on gold. The weights ease back at the end.
2. **Neural network** (4.5 s): a 3-4-2 network with a real forward pass (sigmoid). The inputs light,
   yellow pulses (as big as the signal they carry) run to the hidden layer, whose neurons glow as
   bright as they fire, then on to the outputs, where one wins. Red pulses run back and the wires
   thicken or thin a little as they pass; they ease back at the end.
3. **Convolutional network** (5 s): a glowing 3×3 filter slides over a handwritten 7 (7×7 pixels),
   stamping a 5×5 feature map tile by tile (a real convolution with a down-left stroke filter, then
   ReLU); the tiles slide together into the 3×3 pooled map (2×2 max pooling), and the digit scores
   rise, 7 on top.
4. **Recurrent network** (4.5 s): THE, CAT and SAT rise into the cell one at a time; the cell
   flashes and the orb (the hidden state) takes on the word's color mixed with what it carried, runs
   round the loop and back in. The LSTM style adds forget, input and output gates whose slats turn
   open and shut like shutters.
5. **Transformer** (5 s): cyan and magenta arcs (two heads, thicker where attention is stronger)
   draw between THE CAT SAT ON; the tiles rise through the first feed-forward block (it glows), new
   arcs draw at the second layer, the tiles rise through its block to the top, and MAT drops into
   the row's last slot; the tiles come home and MAT fades at the end.
6. **Looped transformer** (5 s): five tiles ride three laps round a track through one block; each
   pass sharpens every tile's mark one step (noise, a coarse 2×2 mosaic, nearly right, exact) until
   "3 + 4 = 7" settles (the 7 in gold); the marks go back to noise at the end.
7. **Diffusion model** (5 s): a cloud of specks clears in ten steps into a rubber duck while the
   STEP counter runs 50, 45 … 0; then the noise washes back (counter back to 50).
8. **Gradient descent** (4.5 s): the ball takes 21 steps of gradient descent with momentum, each a
   hop, leaving a trail of dots: just right, it overshoots the valley and settles; too low, it
   creeps down the slope; too high, it bounces from wall to wall. It flies back to the start.
9. **Word vectors** (4 s): an arrow runs from the origin to KING, another from MAN to WOMAN, and the
   same step runs on from KING, landing right next to QUEEN, which lights up.
10. **Sorting machine** (5 s): eight bars sort by bubble sort, quicksort or merge sort (the
    Algorithm option), each bar a solid piece gliding to its new slot (right-movers pass in front,
    left-movers behind), with a SWAPS counter (MOVES for merge sort); then they shuffle back.
11. **Half adder** (3.5 s): switches A and B flip to 1, light fills the wires into the XOR and AND
    gates, the XOR flashes and gives 0 (the sum lamp stays dark), the AND glows and lights the carry
    lamp: "1+1=10" shows; then the switches flip back.

## Notes

- Every toy is a dark display board (`board()`), so the glowing parts read on the white stage.
- Shared helpers in `computing.js`: `board`, `wire` (thickness can change by a morph), `wireLight`
  (a lit copy that fills with light along a fade channel), `bead` (a glowing token), `lamp` and
  `lampLight`, `text` and `sign` (the 5×7 font plus Σ, +, =, →), `sevenSeg` and `showDigit`
  (counters on tokens; unlit segments are not drawn and a leading zero is blank, after the
  Operator's note that dim segments read as "8"), `resortSteps` (below).
- Draw order: tokens that travel across the board vanish behind it unless they are sorted again, so
  `resortSteps()` sets `out.resort` once per step while pieces travel (the CNN's tiles, the RNN's
  words, the transformer's tiles, the loop's tiles, the ball, the bars) and once after.
- The diffusion duck's specks rest at random places but keep their depth on the duck, so its far
  side still sorts behind its near side (splats sort where they rest).
- Text is legible at phone size at a font pixel of about 0.016 to 0.025 of a board 2.5 to 3 wide.

## Known issues

- On the weak tier (about 56,000 splats) the smallest labels (IN, HIDDEN, FFN, ATTN) blur at phone
  size; the high tier and the clips read cleanly. The words that matter (word tiles, signs,
  counters) are larger.
- The looped transformer's tiles read right to left along the top of the loop (they ride a real loop
  and keep facing you).
- Taps undo their "learning" at the end (the perceptron's and the network's weights ease back), as
  every tap must end where it started.
- The tokens that glide across a board are re-sorted a few times a second during the glide
  (`out.resort`); a very slow phone may show a brief draw-order flicker between re-sorts.
- Sounds are first drafts for the Sound Board round; the sorting machine's notes follow the default
  bubble sort only.

## For the Operator

- The engine PR #56 (the drawing pad) merged on September 28; this branch has main merged in.
- For the hands-on lane: the owner would like tapping a unit of the classic transformer diagram to
  highlight it and show its name (so the Toy tab key is not needed), and later grabbing single
  neurons of the 3D neural network (each neuron is already its own part, `n<layer><index>`).

- Please confirm: the transformer and looped transformer were marked "fix" with no note. I read them
  as the same ask as the other models (an actual 3D version) and built that; if the owner meant
  something else, tell me.
- Word vectors: GloVe is under the ODC PDDL (public domain), checked on the live page; credited in
  CREDITS.md and in the toy. The word list leaves out words about violence, weapons and sex.
- A lesson for PACKS.md: text and other small keep-colored details need size / sqrt(weight) of about
  0.5 or more, or they vanish at 320 pixels (weight 10 did).

- A lesson for PACKS.md 7b: tokens that glide across a flat board just in front of it disappear
  behind it until resorted; `out.resort` a few times during the glide fixes it.

- A lesson for PACKS.md: the kit fits a toy to a sphere around its bounding box, so a long, thin
  model (a row of layers) comes out small whatever its scale; lay it out as a compact block (two
  rows here) to fill the frame.
