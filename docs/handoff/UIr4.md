# Lane UI r4: drag across the keys to play a glissando

## Brief

From the Operator, October 1, 2026 (the fourth round in the UI r2 session):

From the Operator: a new round, UI r4, from the owner's review of October 1, 2026. Stay on Opus 5.5.
First finish what's open: the main merge into #131 (Integrator 2 is testing #131 at 5688d4d; a later
main merge is fine, but never rebase), and #146. Then start r4.

Owner, word for word: "I'd like for the user to be able to basically click on a key and then click
and hold it, right? So to be able to click and hold on a key and then, like, move their cursor to
the left or to the right or up or whatever, and it will just sort of, like, play all the keys that
it touches… if I'm sitting at a physical keyboard and I stick my finger down on a key and then I
just drag it across the keyboard, it makes, like, a really nice ascent or descent… So that should
apply for all of the keyboards."

A glissando on every keyboard:

- Toys: grand-piano, upright-piano, harpsichord, electronic-keyboard, toy-piano, and any other toy
  with a row of keys (grep the packs: an organ, an accordion, a celesta). Add the mallet instruments
  (xylophone, glockenspiel, marimba) if it fits the same gesture naturally.
- Press a key: it plays, as a tap does today. Keep holding and drag along the keys: each key the
  pointer crosses goes down and plays once, in order, at the speed of the drag. Interpolate between
  pointer samples so a fast drag skips no key. Moving back plays the keys again. Let go: it stops.
  Keys go down and come back up as they do on a tap.
- Mouse and touch both. Each finger on its own if it's cheap, else one finger.
- A drag that starts on a key never turns the camera. A drag that starts anywhere else still orbits.
  Pinch still zooms. Respect r3's turntable and tilt-lock defaults.
- Sound: the existing note voices, overlapping as on a real keyboard. Cap the voices so a fast run
  never clips or crackles. No new samples (Sound A and B own the sounds).
- Engine: the player needs a way for a toy to claim a drag that starts on it (for example an
  `action.drag(p, c, phase)` beside `action.at`). Put that in a small, additive "Engine: …" PR,
  `claude/lane-ui-r4-engine`, based on main after #131 merges (both touch player.js), and merged
  first. Then the toys in `claude/lane-ui-r4`: one PR, "Phase UI r4: drag across the keys to play a
  glissando".
- Tests in tests/ui4.spec.mjs: a synthetic drag across N keys plays N notes in order; a drag off the
  keys still orbits.
- Clips (prefix ui4) on Effect review page 2, lane record "UIr4"
  (https://claude.ai/artifact/BSayVkzQ2FKESesrkrSUMK): a glissando up and down on each keyboard at
  phone size, as MP4.
- Help: add the gesture to each keyboard's how-to line in toy-help.js.

Reply with "READY:", "WORKING:" or "BLOCKED:" at the end.

## State

- Model: Opus 5.5 (claude-opus-5-5), default effort.
- Merged: the engine PR #156, then PR #157, on October 1, 2026 (main ba830c1).
- October 1, 2026: built.
  - Engine (`claude/lane-ui-r4-engine`, from main): the recipe `drag` the laptop's trackpad already
    used (`at`, `start`, `move`, `end`) may now return taps to fire from `start` and `move`
    (`{ key, pick }` or a list, in order). The player fires them through `act`; drive() sees every
    tap since the last frame as `info.taps`; the app plays each drag note under its own sound key
    (so notes overlap) with a cap of 12 notes in any half second, and a press that the drag already
    played is not also a tap. `tests/ui4-engine.spec.mjs` (2 tests).
  - Toys (`claude/lane-ui-r4`, on the engine): `src/packs/glissando.js` (the drag: it walks the path
    between pointer samples in 0.004-unit steps and fires each key it enters), on the grand piano,
    upright piano, harpsichord, electronic keyboard (`src/packs/pianos.js`, through
    `keyboardRecipe`), the toy piano and the xylophone (`src/packs/music.js`); each drive() handles
    every tap of the frame (`newTaps`). How-to lines updated. `tests/ui4.spec.mjs` (4 tests).

## Notes

- There is no organ, accordion, celesta, glockenspiel or marimba in the packs; the xylophone (bars
  in a row) takes the same gesture.
- `action.drag` was not needed: the recipe-level `drag` (lane F's input path) already claims a drag
  that starts on the toy and orbits otherwise. The engine change is only what it returns.
- One finger: a second finger makes the gesture a pinch (zoom), as before.
- Where the finger slides decides whether the black keys play: in front of them only the white keys
  sound, between them the run is chromatic, as on a real keyboard.

- Cards on Effect review page 2, lane UIr4 (MP4, 390×844): ui4-grand-piano, ui4-upright-piano,
  ui4-harpsichord, ui4-electronic-keyboard, ui4-toy-piano, ui4-xylophone. The owner marked all six
  "good" on October 1, 2026.

## Known issues

- At the end of the keyboard, a finger that runs past the last key and comes back plays that key
  again.

## For the Operator

- Both PRs are merged. The engine PR touches `src/player.js` (grabStart, grabAt, a new fireDrag),
  `src/motion.js` (info.taps) and `src/app.js` (onTap, onAction, onInteract).
