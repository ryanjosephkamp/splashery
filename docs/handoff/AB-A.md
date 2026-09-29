# Lane AB-A: the blind A/B toy (maker A)

## Brief

You are a Splashery worker session, started by the Operator (the coordinating session). Repo:
ryanjosephkamp/splashery. Your lane: the blind A/B toy, **maker A** (prefix `aba`). Branch:
claude/lane-ab-a. PR title: "Phase A/B (maker A): the toy piano". Handoff file:
docs/handoff/AB-A.md.

### Brief (written by the Operator on September 29, 2026)

The owner accepted "one blind A/B toy, the same small toy built by each model, marked by the owner
without knowing which is which", for the blog post. Two sessions build the same toy from this same
brief, one on each model. You are maker A. The other maker works at the same time on its own branch;
don't look at its branch or cards, and don't coordinate. Only the better one of the two merges,
chosen by the owner's marks.

**Keep it blind.** The owner sees the cards, not the PRs. On your cards, your lane record and
anything else on the Effect review page, call yourself only "maker A": never name your model or say
anything that hints at it. Your PR body and handoff don't name the model either until the Operator
reveals it after the marks (commit trailers are fine).

**The toy: Toy piano** (`toy-piano`, Music shelf, public, kit-built). It's the owner's own idea from
the Toy Ideas page, word for word:

- Tap: "Tap a key: a tiny hammer strikes a metal rod inside the open back, and the rod shivers as it
  rings. Tap elsewhere: Twinkle, Twinkle, Little Star, the rods shimmering in turn."
- Sound: "The plinky, bell-like tone of a real toy piano (struck metal rods), made in the page."
- Why: "The smallest piano, with a sound nothing else on the shelf has."

What good looks like:

- A small upright toy piano, about 18 to 25 keys, painted wood (a bright lacquer), with the back
  open so you see the row of metal rods and the little hammers.
- Every key, hammer and rod is its own solid part.
- Tapping a key: the key dips and its hammer swings up and strikes its rod; the rod shivers (a
  small, fast, fading vibration) while the note rings.
- Tapping elsewhere: it plays the opening of "Twinkle, Twinkle, Little Star" (public domain; write
  the notes out yourself), each key, hammer and rod moving in time with the notes.
- The sound is struck metal rods: a bright, inharmonic, bell-like voice with a quick decay, made in
  the page. Add your own entry in src/toy-sounds.js, and a new voice in src/voices.js only if the
  existing voices can't make it. Each key plays its own pitch.
- Follow the effect quality rules in CLAUDE.md (instruments are played, parts move as solid pieces,
  materials look real, no speckle or see-through solids) and the sharpness the owner now expects:
  Fidelity A's method (even placement, full opacity, full density, clean colors) is the bar. Read
  docs/handoff/history.md for how the xylophone does per-key taps (`pick`).
- Add the toy's how-to line and About text in src/toy-help.js, its plan entry in
  tools/toy-plan.json, and a thumbnail.

Clips and cards (390×844), in the lane record "AB-A" on the Effect review page (the Operator made
it):

- `aba-toy-piano-keys`: three single keys tapped, close enough to see each hammer strike its rod;
- `aba-toy-piano-song`: the song;
- `aba-toy-piano-still`: a sharp full-resolution still.

### You own

- the toy's recipe in its pack (src/packs/ with the Music toys, only your toy),
  assets/toys/toy-piano/, your toy's entries in the shared lists, tests/aba.spec.mjs, your `aba-*`
  screenshots and docs/handoff/AB-A.md.
- Leave everything else alone. Lanes Books, Worlds, Fidelity A, Fidelity B, Studio Models, the
  Integrator and the other maker run at the same time. The laptop is locked.

### How this lane runs

The Operator session runs the lanes; the owner talks only to the Operator. Questions and blockers go
in the final message ("READY:", "WORKING:" or "BLOCKED:"). Never merge. American English for new
public text. Edit only your own entries in the shared lists. Never edit tests/taps.spec.mjs. Post
clips and cards to the Effect review page without republishing it. Push about hourly, merge main
before each push, never rebase. One draft PR with the five sections (the model is left out until the
Operator reveals it). After the cards are posted, check the owner's marks about hourly, fix every
"fix" in the same PR and post "-r2" cards.

## State

Started September 29, 2026. Reading the docs and planning the recipe.

## Notes

## Known issues

## For the Operator
