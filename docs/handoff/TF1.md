# Lane TF1: One splat's selection and sound, the periodic table in full screen, and a faster Volume viewer

## Brief

(Written by the Operator on October 17, 2026; summarized.) Lane TF1 (prefix `tf1`), Opus 5.5 at high
effort, branch `claude/tf1`, PR "Phase TF1: One splat's selection, the periodic table's info box, a
faster Volume viewer". All three toys are labs toys.

- One splat, many splats: show at a glance which splat a tap picked, at every level, and keep the
  top level's tap audible.
- Real elements: the element's facts box shows in full screen too, and a "Show info" switch (on by
  default) turns it off.
- Volume viewer: profile it, say where the time goes, fix the taps and drags that miss, and make it
  smooth on the phone profile, measured before and after on the walnut and the gar's head.

## State

- Engine PR first: `claude/tf1-engine` ("Engine: a recipe may take presses by its tap box"), merged
  into `claude/tf1`. The lane PR needs it merged first.
- Clips on Effect review page 2, lane TF1.

## What changed

- **One splat** (`src/packs/one-splat.js`): a tap draws a yellow ring at two sigma round the picked
  splat (never under 10 px, so a one-pixel splat at level 14 still shows) and dims the rest of the
  stage, under the readout; it follows the view and clears with the readout. The top level was
  silent for two reasons: a tap there splits nothing, so no cue played, and the pick buffer (drawn
  at half size) often missed the pixel-wide splats, so the tap never reached the toy. Now the toy
  has a tap box (the picture's rectangle) and a tap that splits nothing plays its level's note
  softly. The notes already stayed between G3 and E6 (196 to 1,319 Hz), so the scale is unchanged.
- **Real elements** (`src/packs/real-elements.js`, `src/ui.js`, `styles.css`): the facts are the
  stage legend, which focus mode hid with every other label. A legend may now say `focus: true`; the
  legend box then keeps a class `in-focus`, and one CSS rule shows it at the full stage's top left.
  The "Show info" switch is an ordinary option (saved in scenes and links).
- **Volume viewer** (`src/packs/volume-viewer.js`, `src/volume/view.js`):
  - Where the time went: (1) every press rendered the pick buffer before anything could happen
    (about 1.3 to 2.6 s here in software rendering), and on the gar it often found no splat, so the
    tap was lost; a quick drag that ended before the pick came back was taken as a tap (the sound,
    and a rebuild, with no cut). (2) Every frame drew the solid inside: the sheets inside the volume
    (43% of the splats) behind the surface, though only a cut face shows them. (3) A tap's next
    preset sampled the lattice on the main thread (0.9 to 3 s on a computer), freezing the view.
    Sorting was not a cost: it runs in a worker.
  - Fixes: `pickBox: true` (the engine PR) takes a press by the volume's box; the sheets' insides go
    into 12 parts along the cut's axis and the drive shows only those at the cut face (all in the
    Layers view); the lattice is sampled in `prepare`, 10 ms at a time, with a written-out trilinear
    sample (about twice as fast) and a remembered pitch per window.
  - Measured (`profile=low`, 390 × 844 at 3× pixels, SwiftShader software WebGL in the cloud, which
    is slower than a phone's GPU; compare before with after): walnut frame 575 → 379 ms, press to
    the cut moving 2.6 s → 0.4 s, tap to the preset taken 1.3 s → 9 ms; gar frame 392 → 281 ms, drag
    2.4 s → 0.3 s, and the tap that never landed (2 min) now lands at once.

## Tests

`tests/tf1.spec.mjs`: the notes' range; the ring and the sound at level 6 and level 14 (phone and
computer); the facts in focus mode and the switch; the volume's hidden inside, the lattice made
ahead, the trilinear sample, and a tap and a drag on the walnut and the gar.
